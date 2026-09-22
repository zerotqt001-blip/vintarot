import type { D1Database } from "@cloudflare/workers-types";
import { getAffiliateSummary, listAffiliateHistory, type AffiliateHistoryItem, type AffiliateSummary } from "../affiliate/service";
import { createCreditStore } from "../credits/repository";
import type { CreditBalance, CreditHistoryEntry, CreditOwner } from "../credits/types";
import type { AdminActor } from "./context";
import { AdminServiceError, getMemberDetail, listMembers, type MemberAdminView } from "./member-service";
import { hasPermission, type Permission } from "./permissions";

const EMPTY_BALANCE: CreditBalance = { availableUnits: 0, reservedUnits: 0, totalUnits: 0 };

export type AdminReadingView = {
  id: string;
  createdAt: number;
  updatedAt: number;
  sessionId: string | null;
};

export type AdminOrderView = {
  id: string;
  memberId: string;
  status: string;
  amountMinor: number;
  currency: string;
  paymentReferenceMasked: string | null;
  createdAt: number;
  paymentConfirmedAt: number | null;
  fulfilledAt: number | null;
  refundedAt: number | null;
  fulfillmentId: string | null;
};

export type AdminAffiliateView = {
  profile: {
    id: string;
    status: string;
    codeStatuses: string[];
    createdAt: number;
    updatedAt: number;
  } | null;
  summary: AffiliateSummary;
  history: AffiliateHistoryItem[];
};

export type AdminMemberDetail = {
  member: MemberAdminView;
  credits: {
    balance: CreditBalance;
    history: CreditHistoryEntry[];
  } | null;
  vip: Array<{
    id: string;
    entitlementType: string;
    benefitVersion: string;
    sourceType: string;
    startsAt: number;
    endsAt: number | null;
    status: string;
  }> | null;
  readingUsage: {
    total: number;
    saved: number;
    sessions: number;
  } | null;
  readings: {
    items: AdminReadingView[];
    nextCursor: null;
  };
  orders: AdminOrderView[];
  affiliate: AdminAffiliateView | null;
};

export type AdminDashboard = {
  members: { total: number; active: number; disabled: number };
  readings: { saved: number };
  orders: { total: number; pending: number; fulfilled: number };
  vip: { active: number };
  credits: { adjustments: number };
  affiliate: { conversions: number };
  audit: { events: number };
};

function requirePermission(actor: AdminActor, permission: Permission): void {
  if (!hasPermission(actor.role, permission)) throw new AdminServiceError("forbidden", "Forbidden.");
}

function boundedLimit(value: number | undefined, fallback = 20): number {
  if (value === undefined) return fallback;
  if (!Number.isSafeInteger(value) || value < 1 || value > 50) throw new AdminServiceError("invalid", "Invalid admin list request.");
  return value;
}

function memberOwner(memberId: string): CreditOwner {
  const normalized = memberId.trim();
  if (!normalized || normalized.length > 160) throw new AdminServiceError("invalid", "Invalid member.");
  return { kind: "member", ownerId: `member:${normalized}` };
}

function maskPaymentReference(value: string | null): string | null {
  if (!value) return null;
  const normalized = value.trim();
  if (normalized.length <= 4) return "••••";
  return `${"•".repeat(Math.max(4, Math.min(15, normalized.length - 4)))}${normalized.slice(-4)}`;
}

function parseSessionId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    const parsed = JSON.parse(value) as { session_id?: unknown };
    return typeof parsed.session_id === "string" && parsed.session_id.length <= 160 ? parsed.session_id : null;
  } catch {
    return null;
  }
}

async function memberExists(database: D1Database, memberId: string): Promise<void> {
  const row = await database.prepare("SELECT id FROM members WHERE id=? LIMIT 1").bind(memberId).first<{ id: string }>();
  if (!row) throw new AdminServiceError("not_found", "Member not found.");
}

async function readCreditSnapshot(database: D1Database, owner: CreditOwner): Promise<AdminMemberDetail["credits"]> {
  const account = await database.prepare("SELECT id FROM credit_accounts WHERE owner_kind=? AND owner_id=? LIMIT 1").bind(owner.kind, owner.ownerId).first<{ id: string }>();
  if (!account) return { balance: EMPTY_BALANCE, history: [] };
  const store = createCreditStore(database);
  return { balance: await store.getBalance(owner), history: await store.listHistory(owner, 20) };
}

async function readVip(database: D1Database, owner: CreditOwner): Promise<AdminMemberDetail["vip"]> {
  const entitlements = await database.prepare("SELECT e.id, e.entitlement_type, e.benefit_version, e.source_type, e.starts_at, e.ends_at, e.status FROM entitlements e JOIN credit_accounts a ON a.id=e.account_id WHERE a.owner_kind=? AND a.owner_id=? ORDER BY e.starts_at DESC, e.id DESC LIMIT 20").bind(owner.kind, owner.ownerId).all<Record<string, unknown>>();
  return entitlements.results.map((row) => ({
    id: String(row.id),
    entitlementType: String(row.entitlement_type),
    benefitVersion: String(row.benefit_version),
    sourceType: String(row.source_type),
    startsAt: Number(row.starts_at),
    endsAt: row.ends_at == null ? null : Number(row.ends_at),
    status: String(row.status),
  }));
}

async function readMemberReadings(database: D1Database, memberId: string, limit = 20): Promise<{ items: AdminReadingView[]; nextCursor: null; usage: AdminMemberDetail["readingUsage"] }> {
  const ownerId = `member:${memberId}`;
  const [savedCount, sessionCount, rows] = await Promise.all([
    database.prepare("SELECT COUNT(*) AS count FROM records WHERE owner=? AND kind='tarot-reading'").bind(ownerId).first<{ count: number }>(),
    database.prepare("SELECT COUNT(*) AS count FROM reading_sessions WHERE user_id=?").bind(memberId).first<{ count: number }>(),
    database.prepare("SELECT id, created, updated, data FROM records WHERE owner=? AND kind='tarot-reading' ORDER BY updated DESC, id DESC LIMIT ?").bind(ownerId, boundedLimit(limit)).all<Record<string, unknown>>(),
  ]);
  const saved = Number(savedCount?.count ?? 0);
  const sessions = Number(sessionCount?.count ?? 0);
  return {
    items: rows.results.map((row) => ({ id: String(row.id), createdAt: Number(row.created), updatedAt: Number(row.updated), sessionId: parseSessionId(row.data) })),
    nextCursor: null,
    usage: { total: saved + sessions, saved, sessions },
  };
}

async function readOrders(database: D1Database, memberId?: string, limit = 20): Promise<AdminOrderView[]> {
  const bounded = boundedLimit(limit);
  const query = memberId
    ? database.prepare("SELECT o.id, a.owner_id, o.status, o.amount_minor, o.currency, o.payment_reference, o.created_at, o.payment_confirmed_at, o.fulfilled_at, o.refunded_at, f.id AS fulfillment_id FROM orders o JOIN credit_accounts a ON a.id=o.account_id LEFT JOIN order_fulfillments f ON f.order_id=o.id WHERE a.owner_kind='member' AND a.owner_id=? ORDER BY o.created_at DESC, o.id DESC LIMIT ?").bind(`member:${memberId}`, bounded)
    : database.prepare("SELECT o.id, a.owner_id, o.status, o.amount_minor, o.currency, o.payment_reference, o.created_at, o.payment_confirmed_at, o.fulfilled_at, o.refunded_at, f.id AS fulfillment_id FROM orders o JOIN credit_accounts a ON a.id=o.account_id LEFT JOIN order_fulfillments f ON f.order_id=o.id WHERE a.owner_kind='member' ORDER BY o.created_at DESC, o.id DESC LIMIT ?").bind(bounded);
  const result = await query.all<Record<string, unknown>>();
  return result.results.map((row) => ({
    id: String(row.id),
    memberId: String(row.owner_id).replace(/^member:/, ""),
    status: String(row.status),
    amountMinor: Number(row.amount_minor),
    currency: String(row.currency),
    paymentReferenceMasked: row.payment_reference == null ? null : maskPaymentReference(String(row.payment_reference)),
    createdAt: Number(row.created_at),
    paymentConfirmedAt: row.payment_confirmed_at == null ? null : Number(row.payment_confirmed_at),
    fulfilledAt: row.fulfilled_at == null ? null : Number(row.fulfilled_at),
    refundedAt: row.refunded_at == null ? null : Number(row.refunded_at),
    fulfillmentId: row.fulfillment_id == null ? null : String(row.fulfillment_id),
  }));
}

async function readAffiliate(database: D1Database, memberId: string): Promise<AdminAffiliateView> {
  const profile = await database.prepare("SELECT p.id, p.status, p.created_at, p.updated_at, GROUP_CONCAT(r.status) AS code_statuses FROM affiliate_profiles p LEFT JOIN referral_codes r ON r.affiliate_profile_id=p.id WHERE p.member_id=? GROUP BY p.id LIMIT 1").bind(memberId).first<Record<string, unknown>>();
  return {
    profile: profile ? {
      id: String(profile.id),
      status: String(profile.status),
      codeStatuses: profile.code_statuses ? String(profile.code_statuses).split(",") : [],
      createdAt: Number(profile.created_at),
      updatedAt: Number(profile.updated_at),
    } : null,
    summary: await getAffiliateSummary(database, `member:${memberId}`),
    history: await listAffiliateHistory(database, `member:${memberId}`, 20),
  };
}

export async function listAdminMembers(database: D1Database, actor: AdminActor, input: { search?: string; limit?: number } = {}): Promise<MemberAdminView[]> {
  requirePermission(actor, "admin.users.read");
  return listMembers(database, actor, boundedLimit(input.limit, 50), input.search ?? "");
}

export async function getAdminMemberDetail(database: D1Database, actor: AdminActor, memberId: string): Promise<AdminMemberDetail> {
  requirePermission(actor, "admin.users.read");
  const member = await getMemberDetail(database, actor, memberId);
  const owner = memberOwner(member.id);
  const canCredits = hasPermission(actor.role, "admin.credits.adjust");
  const canVip = hasPermission(actor.role, "admin.vip.adjust");
  const canReadings = hasPermission(actor.role, "admin.readings.read");
  const canAffiliate = hasPermission(actor.role, "admin.affiliate.read");
  const [credits, vip, readings, orders, affiliate] = await Promise.all([
    canCredits ? readCreditSnapshot(database, owner) : Promise.resolve(null),
    canVip ? readVip(database, owner) : Promise.resolve(null),
    canReadings ? readMemberReadings(database, member.id) : Promise.resolve({ items: [], nextCursor: null as null, usage: null }),
    readOrders(database, member.id),
    canAffiliate ? readAffiliate(database, member.id) : Promise.resolve(null),
  ]);
  return { member, credits, vip, readingUsage: canReadings ? readings.usage : null, readings: { items: readings.items, nextCursor: readings.nextCursor }, orders, affiliate };
}

export async function listAdminMemberReadings(database: D1Database, actor: AdminActor, memberId: string, limit?: number): Promise<{ items: AdminReadingView[]; nextCursor: null; usage: AdminMemberDetail["readingUsage"] }> {
  requirePermission(actor, "admin.readings.read");
  await memberExists(database, memberId);
  return readMemberReadings(database, memberId, boundedLimit(limit));
}

export async function listAdminOrders(database: D1Database, actor: AdminActor, input: { memberId?: string; limit?: number } = {}): Promise<AdminOrderView[]> {
  requirePermission(actor, "admin.orders.read");
  if (input.memberId) await memberExists(database, input.memberId);
  return readOrders(database, input.memberId, boundedLimit(input.limit, 50));
}

export async function getAdminDashboard(database: D1Database, actor: AdminActor, input: { now?: number } = {}): Promise<AdminDashboard> {
  requirePermission(actor, "admin.dashboard.read");
  const now = input.now ?? Date.now();
  const [members, readings, orders, vip, credits, affiliate, audit] = await Promise.all([
    database.prepare("SELECT COUNT(*) AS total, SUM(CASE WHEN disabled=0 THEN 1 ELSE 0 END) AS active, SUM(CASE WHEN disabled=1 THEN 1 ELSE 0 END) AS disabled FROM members").first<Record<string, number>>(),
    database.prepare("SELECT COUNT(*) AS saved FROM records WHERE kind='tarot-reading'").first<{ saved: number }>(),
    database.prepare("SELECT COUNT(*) AS total, SUM(CASE WHEN status='PENDING' THEN 1 ELSE 0 END) AS pending, SUM(CASE WHEN status='FULFILLED' THEN 1 ELSE 0 END) AS fulfilled FROM orders").first<Record<string, number>>(),
    database.prepare("SELECT COUNT(*) AS active FROM entitlements WHERE entitlement_type='VIP' AND status='ACTIVE' AND starts_at <= ? AND (ends_at IS NULL OR ends_at > ?)").bind(now, now).first<{ active: number }>(),
    database.prepare("SELECT COUNT(*) AS adjustments FROM credit_ledger WHERE event_type='ADJUSTMENT'").first<{ adjustments: number }>(),
    database.prepare("SELECT COUNT(*) AS conversions FROM affiliate_conversions").first<{ conversions: number }>(),
    database.prepare("SELECT COUNT(*) AS events FROM audit_events").first<{ events: number }>(),
  ]);
  return {
    members: { total: Number(members?.total ?? 0), active: Number(members?.active ?? 0), disabled: Number(members?.disabled ?? 0) },
    readings: { saved: Number(readings?.saved ?? 0) },
    orders: { total: Number(orders?.total ?? 0), pending: Number(orders?.pending ?? 0), fulfilled: Number(orders?.fulfilled ?? 0) },
    vip: { active: Number(vip?.active ?? 0) },
    credits: { adjustments: Number(credits?.adjustments ?? 0) },
    affiliate: { conversions: Number(affiliate?.conversions ?? 0) },
    audit: { events: Number(audit?.events ?? 0) },
  };
}
