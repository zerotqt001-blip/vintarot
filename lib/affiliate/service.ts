import type { D1Database } from "@cloudflare/workers-types";
import { encryptField, keyringFromEnvironment } from "../security/encryption";
import { getActiveAffiliatePolicy, selectAffiliateTier, utcMonthBounds } from "./policy";
import { findReferralAttribution, findReferralCode, getAffiliateConversion, hashReferralCode, memberIdFromOwner, ownerKey } from "./repository";
import type { AffiliateConversion, AffiliateHistoryItem, AffiliateOwner, AffiliateProfileStatus, AffiliateSummary, AttributionResult, VerifiedFulfillmentEvent } from "./types";

export type { AffiliateConversion, AffiliateHistoryItem, AffiliateSummary, AttributionResult, VerifiedFulfillmentEvent } from "./types";

export class AffiliateError extends Error {
  constructor(message: string, readonly code = "affiliate_error") {
    super(message);
    this.name = "AffiliateError";
  }
}

function requireBounded(value: string, max: number, message: string): string {
  const normalized = value.trim();
  if (!normalized || normalized.length > max) throw new AffiliateError(message, "invalid_input");
  return normalized;
}

function safeMinor(value: number): number {
  if (!Number.isSafeInteger(value) || value < 0) throw new AffiliateError("Invalid monetary amount", "invalid_amount");
  return value;
}

async function loadConversion(database: D1Database, id: string): Promise<AffiliateConversion | null> {
  return getAffiliateConversion(database, { id }) as Promise<AffiliateConversion | null>;
}

function scopedLedgerKey(entryType: "eligibility" | "reversal" | "adjustment", conversionId: string, rawKey: string): { key: string; legacyKey: string } {
  const normalized = requireBounded(rawKey, 200, `Invalid ${entryType} key`);
  return {
    key: `affiliate:${entryType}:${conversionId}:${normalized}`,
    legacyKey: `affiliate:${entryType}:${normalized}`,
  };
}

async function hasLedgerEntry(database: D1Database, conversionId: string, entryType: "ELIGIBILITY" | "REVERSAL" | "ADJUSTMENT", keys: { key: string; legacyKey: string }): Promise<boolean> {
  const row = await database.prepare("SELECT 1 AS present FROM affiliate_commission_ledger WHERE conversion_id=? AND entry_type=? AND idempotency_key IN (?, ?) LIMIT 1")
    .bind(conversionId, entryType, keys.key, keys.legacyKey)
    .first<{ present: number }>();
  return Boolean(row);
}

export async function createAffiliateProfile(input: { database: D1Database; memberOwnerId: string; profileId?: string; status?: AffiliateProfileStatus; fraudNote?: string; now?: number; keyring?: ReturnType<typeof keyringFromEnvironment> }): Promise<{ id: string; memberId: string; status: AffiliateProfileStatus }> {
  const memberId = memberIdFromOwner(requireBounded(input.memberOwnerId, 160, "Invalid member owner"));
  if (!memberId) throw new AffiliateError("Member owner is required", "invalid_owner");
  const id = input.profileId ?? `affiliate-profile:${globalThis.crypto.randomUUID()}`;
  const status = input.status ?? "ACTIVE";
  if (!["ACTIVE", "INACTIVE", "SUSPENDED"].includes(status)) throw new AffiliateError("Invalid affiliate status", "invalid_status");
  const fraudNoteCiphertext = input.fraudNote && input.keyring
    ? await encryptField(input.fraudNote, "affiliate.fraud-note", input.keyring)
    : null;
  const timestamp = input.now ?? Date.now();
  await input.database.prepare("INSERT INTO affiliate_profiles (id, member_id, status, fraud_note_ciphertext, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)").bind(id, memberId, status, fraudNoteCiphertext, timestamp, timestamp).run();
  return { id, memberId, status };
}

export async function createReferralCode(input: { database: D1Database; affiliateProfileId: string; rawCode: string; codeId?: string; source?: string; expiresAt?: number | null; now?: number }): Promise<{ id: string; status: "ACTIVE" }> {
  const id = input.codeId ?? `referral-code:${globalThis.crypto.randomUUID()}`;
  const hash = await hashReferralCode(input.rawCode);
  const timestamp = input.now ?? Date.now();
  await input.database.prepare("INSERT INTO referral_codes (id, affiliate_profile_id, code_hash, status, source, created_at, expires_at) VALUES (?, ?, ?, 'ACTIVE', ?, ?, ?)").bind(id, input.affiliateProfileId, hash, input.source?.trim().slice(0, 120) || null, timestamp, input.expiresAt ?? null).run();
  return { id, status: "ACTIVE" };
}

export async function setAffiliateProfileStatus(database: D1Database, profileId: string, status: AffiliateProfileStatus, now = Date.now): Promise<void> {
  if (!["ACTIVE", "INACTIVE", "SUSPENDED"].includes(status)) throw new AffiliateError("Invalid affiliate status", "invalid_status");
  const result = await database.prepare("UPDATE affiliate_profiles SET status=?, updated_at=? WHERE id=?").bind(status, now(), profileId).run();
  if (Number(result.meta.changes) !== 1) throw new AffiliateError("Affiliate profile not found", "not_found");
}

export async function captureAttribution(input: { database: D1Database; owner: AffiliateOwner; rawCode: string; source?: string; now?: number }): Promise<AttributionResult> {
  const rawCode = input.rawCode.trim();
  if (!rawCode || rawCode.length > 128) return { accepted: false, reason: "invalid_code" };
  const now = input.now ?? Date.now();
  const existing = await findReferralAttribution(input.database, input.owner);
  if (existing) return { accepted: true, reason: "already_attributed", attributionId: String(existing.id), expiresAt: Number(existing.expires_at) };
  const policy = await getActiveAffiliatePolicy(input.database, now);
  if (!policy) return { accepted: false, reason: "no_policy" };
  const code = await findReferralCode(input.database, await hashReferralCode(rawCode), now);
  if (!code) return { accepted: false, reason: "invalid_code" };
  if (String(code.profile_status) !== "ACTIVE") return { accepted: false, reason: "inactive_affiliate" };
  const memberId = memberIdFromOwner(ownerKey(input.owner));
  if (memberId && memberId === String(code.affiliate_member_id)) return { accepted: false, reason: "self_referral" };
  const attributionId = `affiliate-attribution:${globalThis.crypto.randomUUID()}`;
  const expiresAt = now + policy.attributionWindowDays * 86_400_000;
  await input.database.prepare("INSERT OR IGNORE INTO referral_attributions (id, owner_key, member_id, affiliate_profile_id, referral_code_id, source, attributed_at, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
    .bind(attributionId, ownerKey(input.owner), memberId, code.affiliate_profile_id, code.id, input.source?.trim().slice(0, 120) || null, now, expiresAt, now).run();
  const persisted = await findReferralAttribution(input.database, input.owner);
  return persisted
    ? { accepted: true, reason: persisted.id === attributionId ? "attributed" : "already_attributed", attributionId: String(persisted.id), expiresAt: Number(persisted.expires_at) }
    : { accepted: false, reason: "invalid_code" };
}

async function storedFulfillment(database: D1Database, event: VerifiedFulfillmentEvent): Promise<Record<string, unknown>> {
  const order = await database.prepare(`SELECT o.id, o.status, o.payment_reference, o.amount_minor, o.currency, o.package_snapshot, o.fulfilled_at,
    a.owner_kind, a.owner_id, f.id AS fulfillment_id
    FROM orders o JOIN credit_accounts a ON a.id=o.account_id LEFT JOIN order_fulfillments f ON f.order_id=o.id AND f.id=?
    WHERE o.id=? LIMIT 1`).bind(event.fulfillmentId, event.orderId).first<Record<string, unknown>>();
  if (!order) throw new AffiliateError("Order not found", "not_found");
  if (!order.fulfillment_id) throw new AffiliateError("Fulfillment not found", "fulfillment_not_found");
  return order;
}

export async function createAffiliateConversion(input: { database: D1Database; event: VerifiedFulfillmentEvent; now?: number }): Promise<AffiliateConversion | null> {
  const event = input.event;
  const order = await storedFulfillment(input.database, event);
  const existing = await getAffiliateConversion(input.database, { eventKey: event.eventKey, fulfillmentId: event.fulfillmentId }) as AffiliateConversion | null;
  if (existing) {
    if (existing.orderId !== event.orderId || existing.memberId !== memberIdFromOwner(event.memberOwnerId)) throw new AffiliateError("Affiliate event conflicts", "idempotency_conflict");
    return existing;
  }
  if (String(order.status) !== "FULFILLED" || event.orderStatus !== "FULFILLED") return null;
  const memberId = memberIdFromOwner(event.memberOwnerId);
  if (!memberId || String(order.owner_kind) !== "member" || String(order.owner_id) !== event.memberOwnerId) return null;
  if (String(order.payment_reference) !== event.paymentReference || Number(order.amount_minor) !== safeMinor(event.amountMinor) || String(order.currency) !== event.currency || String(order.package_snapshot) !== event.packageSnapshot || Number(order.fulfilled_at) !== event.fulfilledAt) return null;
  const now = input.now ?? Date.now();
  const attribution = await input.database.prepare(`SELECT a.id, a.affiliate_profile_id, a.expires_at, p.member_id AS affiliate_member_id, p.status AS profile_status
    FROM referral_attributions a JOIN affiliate_profiles p ON p.id=a.affiliate_profile_id
    WHERE a.owner_key=? AND a.expires_at >= ? LIMIT 1`).bind(event.memberOwnerId, event.fulfilledAt).first<Record<string, unknown>>();
  if (!attribution || String(attribution.profile_status) !== "ACTIVE" || String(attribution.affiliate_member_id) === memberId) return null;
  const policy = await getActiveAffiliatePolicy(input.database, event.fulfilledAt, event.currency);
  if (!policy) return null;
  const month = utcMonthBounds(event.fulfilledAt);
  const countRow = await input.database.prepare("SELECT COUNT(*) AS count FROM affiliate_conversions WHERE affiliate_profile_id=? AND fulfilled_at >= ? AND fulfilled_at < ? AND status <> 'REVERSED'").bind(attribution.affiliate_profile_id, month.start, month.end).first<{ count: number }>();
  const tier = selectAffiliateTier(policy, Number(countRow?.count ?? 0) + 1);
  if (!tier) return null;
  const amountMinor = safeMinor(event.amountMinor);
  const commissionMinor = Math.floor(amountMinor * tier.rateBps / 10_000);
  if (!Number.isSafeInteger(commissionMinor)) throw new AffiliateError("Commission amount is unsafe", "invalid_amount");
  const conversionId = `affiliate-conversion:${event.orderId}`;
  const timestamp = now;
  const policySnapshot = JSON.stringify({ id: policy.id, version: policy.version, attributionWindowDays: policy.attributionWindowDays, holdDays: policy.holdDays, currency: policy.currency });
  const tierSnapshot = JSON.stringify({ id: tier.id, tierCode: tier.tierCode, minQualifiedConversions: tier.minQualifiedConversions, rateBps: tier.rateBps });
  await input.database.batch([
    input.database.prepare("INSERT OR IGNORE INTO affiliate_conversions (id, event_key, order_id, fulfillment_id, member_id, attribution_id, affiliate_profile_id, policy_version_id, tier_id, amount_minor, currency, commission_minor, payment_reference, package_snapshot, status, fulfilled_at, eligible_at, reversed_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'HELD', ?, NULL, NULL, ?, ?)").bind(conversionId, event.eventKey, event.orderId, event.fulfillmentId, memberId, attribution.id, attribution.affiliate_profile_id, policy.id, tier.id, amountMinor, event.currency, commissionMinor, event.paymentReference, event.packageSnapshot, event.fulfilledAt, timestamp, timestamp),
    input.database.prepare("INSERT OR IGNORE INTO affiliate_commission_ledger (id, conversion_id, entry_type, direction, amount_minor, currency, idempotency_key, reversal_of_id, actor_kind, actor_id, reason, policy_snapshot, tier_snapshot, package_snapshot, fraud_note_ciphertext, created_at) VALUES (?, ?, 'COMMISSION', 'CREDIT', ?, ?, ?, NULL, 'system', 'system', ?, ?, ?, ?, NULL, ?)").bind(`affiliate-ledger:${event.eventKey}`, conversionId, commissionMinor, event.currency, `affiliate:commission:${event.eventKey}`, "Verified fulfilled order commission held", policySnapshot, tierSnapshot, event.packageSnapshot, timestamp),
  ]);
  return loadConversion(input.database, conversionId);
}

async function ledgerSnapshot(database: D1Database, conversionId: string): Promise<{ policySnapshot: string; tierSnapshot: string; packageSnapshot: string } | null> {
  const row = await database.prepare("SELECT policy_snapshot, tier_snapshot, package_snapshot FROM affiliate_commission_ledger WHERE conversion_id=? ORDER BY created_at ASC, id ASC LIMIT 1").bind(conversionId).first<{ policy_snapshot: string; tier_snapshot: string; package_snapshot: string }>();
  return row ? { policySnapshot: row.policy_snapshot, tierSnapshot: row.tier_snapshot, packageSnapshot: row.package_snapshot } : null;
}

export async function markCommissionEligible(input: { database: D1Database; conversionId: string; idempotencyKey: string; reason: string; now?: number }): Promise<AffiliateConversion> {
  const conversion = await loadConversion(input.database, input.conversionId);
  if (!conversion) throw new AffiliateError("Affiliate conversion not found", "not_found");
  if (conversion.status === "REVERSED" || conversion.status === "ELIGIBLE") return conversion;
  const reason = requireBounded(input.reason, 500, "Invalid eligibility reason");
  const keys = scopedLedgerKey("eligibility", conversion.id, input.idempotencyKey);
  const snapshot = await ledgerSnapshot(input.database, conversion.id);
  if (!snapshot) throw new AffiliateError("Affiliate ledger snapshot missing", "ledger_missing");
  if (await hasLedgerEntry(input.database, conversion.id, "ELIGIBILITY", keys)) return conversion;
  const timestamp = input.now ?? Date.now();
  await input.database.batch([
    input.database.prepare("UPDATE affiliate_conversions SET status='ELIGIBLE', eligible_at=?, updated_at=? WHERE id=? AND status='HELD'").bind(timestamp, timestamp, conversion.id),
    input.database.prepare("INSERT OR IGNORE INTO affiliate_commission_ledger (id, conversion_id, entry_type, direction, amount_minor, currency, idempotency_key, reversal_of_id, actor_kind, actor_id, reason, policy_snapshot, tier_snapshot, package_snapshot, fraud_note_ciphertext, created_at) VALUES (?, ?, 'ELIGIBILITY', 'CREDIT', 0, ?, ?, NULL, 'system', 'system', ?, ?, ?, ?, NULL, ?)").bind(`affiliate-ledger:${keys.key}`, conversion.id, conversion.currency, keys.key, reason, snapshot.policySnapshot, snapshot.tierSnapshot, snapshot.packageSnapshot, timestamp),
  ]);
  return (await loadConversion(input.database, conversion.id))!;
}

export async function reverseAffiliateCommission(input: { database: D1Database; conversionId: string; idempotencyKey: string; reason: string; actorId: string; now?: number }): Promise<AffiliateConversion> {
  const conversion = await loadConversion(input.database, input.conversionId);
  if (!conversion) throw new AffiliateError("Affiliate conversion not found", "not_found");
  if (conversion.status === "REVERSED") return conversion;
  const reason = requireBounded(input.reason, 500, "Invalid reversal reason");
  const actorId = requireBounded(input.actorId, 160, "Invalid reversal actor");
  const keys = scopedLedgerKey("reversal", conversion.id, input.idempotencyKey);
  const snapshot = await ledgerSnapshot(input.database, conversion.id);
  const original = await input.database.prepare("SELECT id FROM affiliate_commission_ledger WHERE conversion_id=? AND entry_type='COMMISSION' ORDER BY created_at ASC, id ASC LIMIT 1").bind(conversion.id).first<{ id: string }>();
  if (!snapshot || !original) throw new AffiliateError("Affiliate ledger snapshot missing", "ledger_missing");
  if (await hasLedgerEntry(input.database, conversion.id, "REVERSAL", keys)) return conversion;
  const timestamp = input.now ?? Date.now();
  await input.database.batch([
    input.database.prepare("UPDATE affiliate_conversions SET status='REVERSED', reversed_at=?, updated_at=? WHERE id=? AND status <> 'REVERSED'").bind(timestamp, timestamp, conversion.id),
    input.database.prepare("INSERT OR IGNORE INTO affiliate_commission_ledger (id, conversion_id, entry_type, direction, amount_minor, currency, idempotency_key, reversal_of_id, actor_kind, actor_id, reason, policy_snapshot, tier_snapshot, package_snapshot, fraud_note_ciphertext, created_at) VALUES (?, ?, 'REVERSAL', 'DEBIT', ?, ?, ?, ?, 'system', ?, ?, ?, ?, ?, NULL, ?)").bind(`affiliate-ledger:${keys.key}`, conversion.id, conversion.commissionMinor, conversion.currency, keys.key, original.id, actorId, reason, snapshot.policySnapshot, snapshot.tierSnapshot, snapshot.packageSnapshot, timestamp),
  ]);
  return (await loadConversion(input.database, conversion.id))!;
}

export async function adjustAffiliateCommission(input: { database: D1Database; conversionId: string; direction: "CREDIT" | "DEBIT"; amountMinor: number; reason: string; idempotencyKey: string; actorId: string; now?: number }): Promise<AffiliateConversion> {
  const conversion = await loadConversion(input.database, input.conversionId);
  if (!conversion) throw new AffiliateError("Affiliate conversion not found", "not_found");
  const amountMinor = safeMinor(input.amountMinor);
  const reason = requireBounded(input.reason, 500, "Invalid adjustment reason");
  const actorId = requireBounded(input.actorId, 160, "Invalid adjustment actor");
  const keys = scopedLedgerKey("adjustment", conversion.id, input.idempotencyKey);
  const snapshot = await ledgerSnapshot(input.database, conversion.id);
  if (!snapshot) throw new AffiliateError("Affiliate ledger snapshot missing", "ledger_missing");
  if (await hasLedgerEntry(input.database, conversion.id, "ADJUSTMENT", keys)) return conversion;
  const timestamp = input.now ?? Date.now();
  await input.database.prepare("INSERT OR IGNORE INTO affiliate_commission_ledger (id, conversion_id, entry_type, direction, amount_minor, currency, idempotency_key, reversal_of_id, actor_kind, actor_id, reason, policy_snapshot, tier_snapshot, package_snapshot, fraud_note_ciphertext, created_at) VALUES (?, ?, 'ADJUSTMENT', ?, ?, ?, ?, NULL, 'admin', ?, ?, ?, ?, ?, NULL, ?)").bind(`affiliate-ledger:${keys.key}`, conversion.id, input.direction, amountMinor, conversion.currency, keys.key, actorId, reason, snapshot.policySnapshot, snapshot.tierSnapshot, snapshot.packageSnapshot, timestamp).run();
  return conversion;
}

export async function listAffiliateHistory(database: D1Database, memberOwnerId: string, limit = 50): Promise<AffiliateHistoryItem[]> {
  const memberId = memberIdFromOwner(requireBounded(memberOwnerId, 160, "Invalid member owner"));
  if (!memberId) return [];
  const boundedLimit = Math.max(1, Math.min(50, Math.trunc(limit)));
  const result = await database.prepare("SELECT id, order_id, amount_minor, currency, commission_minor, status, fulfilled_at, eligible_at, reversed_at, created_at FROM affiliate_conversions WHERE member_id=? ORDER BY created_at DESC, id DESC LIMIT ?").bind(memberId, boundedLimit).all<Record<string, unknown>>();
  return result.results.map((row) => ({ id: String(row.id), orderId: String(row.order_id), amountMinor: Number(row.amount_minor), currency: String(row.currency), commissionMinor: Number(row.commission_minor), status: String(row.status) as AffiliateHistoryItem["status"], fulfilledAt: Number(row.fulfilled_at), eligibleAt: row.eligible_at == null ? null : Number(row.eligible_at), reversedAt: row.reversed_at == null ? null : Number(row.reversed_at), createdAt: Number(row.created_at) }));
}

export async function listAffiliateOwnerHistory(database: D1Database, memberOwnerId: string, limit = 50): Promise<AffiliateHistoryItem[]> {
  const memberId = memberIdFromOwner(requireBounded(memberOwnerId, 160, "Invalid member owner"));
  if (!memberId) return [];
  const boundedLimit = Math.max(1, Math.min(50, Math.trunc(limit)));
  const result = await database.prepare(`SELECT id, order_id, amount_minor, currency, commission_minor, status, fulfilled_at, eligible_at, reversed_at, created_at
    FROM affiliate_conversions
    WHERE affiliate_profile_id IN (SELECT id FROM affiliate_profiles WHERE member_id=?)
    ORDER BY created_at DESC, id DESC LIMIT ?`).bind(memberId, boundedLimit).all<Record<string, unknown>>();
  return result.results.map((row) => ({ id: String(row.id), orderId: String(row.order_id), amountMinor: Number(row.amount_minor), currency: String(row.currency), commissionMinor: Number(row.commission_minor), status: String(row.status) as AffiliateHistoryItem["status"], fulfilledAt: Number(row.fulfilled_at), eligibleAt: row.eligible_at == null ? null : Number(row.eligible_at), reversedAt: row.reversed_at == null ? null : Number(row.reversed_at), createdAt: Number(row.created_at) }));
}

export async function getAffiliateSummary(database: D1Database, memberOwnerId: string): Promise<AffiliateSummary> {
  const memberId = memberIdFromOwner(requireBounded(memberOwnerId, 160, "Invalid member owner"));
  if (!memberId) return { conversions: 0, held: 0, eligible: 0, reversed: 0, creditedMinor: 0, debitedMinor: 0, netMinor: 0 };
  const counts = await database.prepare("SELECT COUNT(*) AS conversions, SUM(CASE WHEN status='HELD' THEN 1 ELSE 0 END) AS held, SUM(CASE WHEN status='ELIGIBLE' THEN 1 ELSE 0 END) AS eligible, SUM(CASE WHEN status='REVERSED' THEN 1 ELSE 0 END) AS reversed FROM affiliate_conversions WHERE member_id=?").bind(memberId).first<Record<string, unknown>>();
  const amounts = await database.prepare("SELECT COALESCE(SUM(CASE WHEN l.direction='CREDIT' THEN l.amount_minor ELSE 0 END), 0) AS credited, COALESCE(SUM(CASE WHEN l.direction='DEBIT' THEN l.amount_minor ELSE 0 END), 0) AS debited FROM affiliate_commission_ledger l JOIN affiliate_conversions c ON c.id=l.conversion_id WHERE c.member_id=?").bind(memberId).first<Record<string, unknown>>();
  const creditedMinor = Number(amounts?.credited ?? 0);
  const debitedMinor = Number(amounts?.debited ?? 0);
  return { conversions: Number(counts?.conversions ?? 0), held: Number(counts?.held ?? 0), eligible: Number(counts?.eligible ?? 0), reversed: Number(counts?.reversed ?? 0), creditedMinor, debitedMinor, netMinor: creditedMinor - debitedMinor };
}

export async function getAffiliateOwnerSummary(database: D1Database, memberOwnerId: string): Promise<AffiliateSummary> {
  const memberId = memberIdFromOwner(requireBounded(memberOwnerId, 160, "Invalid member owner"));
  if (!memberId) return { conversions: 0, held: 0, eligible: 0, reversed: 0, creditedMinor: 0, debitedMinor: 0, netMinor: 0 };
  const scope = "affiliate_profile_id IN (SELECT id FROM affiliate_profiles WHERE member_id=?)";
  const counts = await database.prepare(`SELECT COUNT(*) AS conversions, SUM(CASE WHEN status='HELD' THEN 1 ELSE 0 END) AS held, SUM(CASE WHEN status='ELIGIBLE' THEN 1 ELSE 0 END) AS eligible, SUM(CASE WHEN status='REVERSED' THEN 1 ELSE 0 END) AS reversed FROM affiliate_conversions WHERE ${scope}`).bind(memberId).first<Record<string, unknown>>();
  const amounts = await database.prepare(`SELECT COALESCE(SUM(CASE WHEN l.direction='CREDIT' THEN l.amount_minor ELSE 0 END), 0) AS credited, COALESCE(SUM(CASE WHEN l.direction='DEBIT' THEN l.amount_minor ELSE 0 END), 0) AS debited FROM affiliate_commission_ledger l JOIN affiliate_conversions c ON c.id=l.conversion_id WHERE c.${scope}`).bind(memberId).first<Record<string, unknown>>();
  const creditedMinor = Number(amounts?.credited ?? 0);
  const debitedMinor = Number(amounts?.debited ?? 0);
  return { conversions: Number(counts?.conversions ?? 0), held: Number(counts?.held ?? 0), eligible: Number(counts?.eligible ?? 0), reversed: Number(counts?.reversed ?? 0), creditedMinor, debitedMinor, netMinor: creditedMinor - debitedMinor };
}

export async function listAdminAffiliateReadModel(database: D1Database, limit = 50): Promise<{
  profiles: Array<{ id: string; memberId: string; status: AffiliateProfileStatus; codeStatuses: string[]; createdAt: number; updatedAt: number }>;
  conversions: Array<Pick<AffiliateConversion, "id" | "orderId" | "memberId" | "affiliateProfileId" | "amountMinor" | "currency" | "commissionMinor" | "status" | "fulfilledAt" | "eligibleAt" | "reversedAt">>;
  ledger: Array<{ id: string; conversionId: string; entryType: string; direction: string; amountMinor: number; currency: string; reason: string; createdAt: number }>;
  policies: Array<{ id: string; version: number; status: string; attributionWindowDays: number; holdDays: number; currency: string; tiers: Array<{ tierCode: string; minQualifiedConversions: number; rateBps: number }> }>;
}> {
  const boundedLimit = Math.max(1, Math.min(50, Math.trunc(limit)));
  const profiles = await database.prepare("SELECT p.id, p.member_id, p.status, p.created_at, p.updated_at, GROUP_CONCAT(r.status) AS code_statuses FROM affiliate_profiles p LEFT JOIN referral_codes r ON r.affiliate_profile_id=p.id GROUP BY p.id ORDER BY p.created_at DESC, p.id DESC LIMIT ?").bind(boundedLimit).all<Record<string, unknown>>();
  const conversions = await database.prepare("SELECT id, order_id, member_id, affiliate_profile_id, amount_minor, currency, commission_minor, status, fulfilled_at, eligible_at, reversed_at FROM affiliate_conversions ORDER BY created_at DESC, id DESC LIMIT ?").bind(boundedLimit).all<Record<string, unknown>>();
  const ledger = await database.prepare("SELECT id, conversion_id, entry_type, direction, amount_minor, currency, reason, created_at FROM affiliate_commission_ledger ORDER BY created_at DESC, id DESC LIMIT ?").bind(boundedLimit).all<Record<string, unknown>>();
  const policies = await database.prepare("SELECT id, version, status, attribution_window_days, hold_days, currency FROM affiliate_policy_versions ORDER BY version DESC LIMIT ?").bind(boundedLimit).all<Record<string, unknown>>();
  const policyValues = await Promise.all(policies.results.map(async (policy) => {
    const tiers = await database.prepare("SELECT tier_code, min_qualified_conversions, rate_bps FROM affiliate_policy_tiers WHERE policy_version_id=? ORDER BY min_qualified_conversions ASC").bind(policy.id).all<Record<string, unknown>>();
    return { id: String(policy.id), version: Number(policy.version), status: String(policy.status), attributionWindowDays: Number(policy.attribution_window_days), holdDays: Number(policy.hold_days), currency: String(policy.currency), tiers: tiers.results.map((tier) => ({ tierCode: String(tier.tier_code), minQualifiedConversions: Number(tier.min_qualified_conversions), rateBps: Number(tier.rate_bps) })) };
  }));
  return {
    profiles: profiles.results.map((profile) => ({ id: String(profile.id), memberId: String(profile.member_id), status: String(profile.status) as AffiliateProfileStatus, codeStatuses: profile.code_statuses ? String(profile.code_statuses).split(",") : [], createdAt: Number(profile.created_at), updatedAt: Number(profile.updated_at) })),
    conversions: conversions.results.map((row) => ({ id: String(row.id), orderId: String(row.order_id), memberId: String(row.member_id), affiliateProfileId: String(row.affiliate_profile_id), amountMinor: Number(row.amount_minor), currency: String(row.currency), commissionMinor: Number(row.commission_minor), status: String(row.status) as AffiliateConversion["status"], fulfilledAt: Number(row.fulfilled_at), eligibleAt: row.eligible_at == null ? null : Number(row.eligible_at), reversedAt: row.reversed_at == null ? null : Number(row.reversed_at) })),
    ledger: ledger.results.map((row) => ({ id: String(row.id), conversionId: String(row.conversion_id), entryType: String(row.entry_type), direction: String(row.direction), amountMinor: Number(row.amount_minor), currency: String(row.currency), reason: String(row.reason), createdAt: Number(row.created_at) })),
    policies: policyValues,
  };
}
