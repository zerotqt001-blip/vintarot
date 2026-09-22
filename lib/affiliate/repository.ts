import type { D1Database } from "@cloudflare/workers-types";
import type { AffiliateOwner } from "./types";

function encode(bytes: Uint8Array): string {
  let output = "";
  for (const byte of bytes) output += byte.toString(16).padStart(2, "0");
  return output;
}

export async function hashReferralCode(rawCode: string): Promise<string> {
  const normalized = rawCode.trim().toUpperCase();
  if (!normalized || normalized.length > 128) throw new Error("Invalid referral code");
  const digest = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(normalized));
  return encode(new Uint8Array(digest));
}

export function ownerKey(owner: AffiliateOwner): string {
  return owner.ownerId.startsWith(`${owner.kind}:`) ? owner.ownerId : `${owner.kind}:${owner.ownerId}`;
}

export function memberIdFromOwner(ownerId: string): string | null {
  return ownerId.startsWith("member:") ? ownerId.slice("member:".length) : null;
}

export async function findReferralAttribution(database: D1Database, owner: AffiliateOwner): Promise<Record<string, unknown> | null> {
  return database.prepare("SELECT id, owner_key, member_id, affiliate_profile_id, referral_code_id, source, attributed_at, expires_at, created_at FROM referral_attributions WHERE owner_key=? LIMIT 1").bind(ownerKey(owner)).first<Record<string, unknown>>();
}

export async function findReferralCode(database: D1Database, codeHash: string, now: number): Promise<Record<string, unknown> | null> {
  return database.prepare(`SELECT r.id, r.affiliate_profile_id, r.code_hash, r.status AS code_status, r.expires_at AS code_expires_at,
    p.member_id AS affiliate_member_id, p.status AS profile_status
    FROM referral_codes r JOIN affiliate_profiles p ON p.id=r.affiliate_profile_id
    WHERE r.code_hash=? AND r.status='ACTIVE' AND (r.expires_at IS NULL OR r.expires_at > ?) LIMIT 1`)
    .bind(codeHash, now)
    .first<Record<string, unknown>>();
}

export function mapAffiliateConversion(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    eventKey: String(row.event_key),
    orderId: String(row.order_id),
    fulfillmentId: String(row.fulfillment_id),
    memberId: String(row.member_id),
    attributionId: String(row.attribution_id),
    affiliateProfileId: String(row.affiliate_profile_id),
    policyVersionId: String(row.policy_version_id),
    tierId: String(row.tier_id),
    amountMinor: Number(row.amount_minor),
    currency: String(row.currency),
    commissionMinor: Number(row.commission_minor),
    paymentReference: String(row.payment_reference),
    packageSnapshot: String(row.package_snapshot),
    status: String(row.status) as "HELD" | "ELIGIBLE" | "REVERSED" | "ADJUSTED",
    fulfilledAt: Number(row.fulfilled_at),
    eligibleAt: row.eligible_at == null ? null : Number(row.eligible_at),
    reversedAt: row.reversed_at == null ? null : Number(row.reversed_at),
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
  };
}

export async function getAffiliateConversion(database: D1Database, key: { id?: string; eventKey?: string; fulfillmentId?: string }): Promise<ReturnType<typeof mapAffiliateConversion> | null> {
  const clauses: string[] = [];
  const values: string[] = [];
  if (key.id) { clauses.push("id=?"); values.push(key.id); }
  if (key.eventKey) { clauses.push("event_key=?"); values.push(key.eventKey); }
  if (key.fulfillmentId) { clauses.push("fulfillment_id=?"); values.push(key.fulfillmentId); }
  if (!clauses.length) return null;
  const row = await database.prepare(`SELECT id, event_key, order_id, fulfillment_id, member_id, attribution_id, affiliate_profile_id, policy_version_id, tier_id, amount_minor, currency, commission_minor, payment_reference, package_snapshot, status, fulfilled_at, eligible_at, reversed_at, created_at, updated_at FROM affiliate_conversions WHERE ${clauses.join(" OR ")} LIMIT 1`).bind(...values).first<Record<string, unknown>>();
  return row ? mapAffiliateConversion(row) : null;
}
