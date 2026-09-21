import type { D1Database } from "@cloudflare/workers-types";
import { createCreditStore } from "./credits/repository";
import type { CreditOwner } from "./credits/types";
import { getActiveEntitlements } from "./entitlements";
import { getAffiliateSummary, listAffiliateHistory } from "./affiliate/service";

export type AccountHistoryKind = "readings" | "shares" | "orders" | "credits" | "affiliate" | "all";
type AccountHistoryItemKind = "reading" | "share" | "order" | "credit" | "affiliate";

export type AccountHistoryItem = {
  id: string;
  kind: AccountHistoryItemKind;
  createdAt: number;
  referenceId: string | null;
  status: string | null;
  amountMinor: number | null;
  currency: string | null;
  units: number | null;
  reason: string | null;
  savedReadingId?: string;
  sessionId?: string;
  readingId?: string;
  paymentReference?: string | null;
};

export type AccountSummary = {
  member: {
    id: string;
    username: string;
    email: string;
    phone: string;
    displayName: string | null;
    createdAt: number;
  };
  credits: {
    balance: Awaited<ReturnType<ReturnType<typeof createCreditStore>["getBalance"]>>;
    history: Awaited<ReturnType<ReturnType<typeof createCreditStore>["listHistory"]>>;
  };
  vip: Array<{
    id: string;
    entitlementType: string;
    benefitVersion: string;
    startsAt: number;
    endsAt: number | null;
    status: string;
  }>;
  counts: { readings: number; shares: number; orders: number; affiliateConversions: number };
  affiliate: Awaited<ReturnType<typeof getAffiliateSummary>>;
};

export type AdminOrderReadModel = {
  id: string;
  ownerId: string;
  status: string;
  amountMinor: number;
  currency: string;
  paymentReference: string | null;
  createdAt: number;
  paymentConfirmedAt: number | null;
  fulfilledAt: number | null;
  refundedAt: number | null;
  fulfillmentId: string | null;
  fulfillmentResultSnapshot: string | null;
};

export class AccountHistoryError extends Error {
  constructor(message: string, readonly code: "unauthenticated" | "invalid_cursor" | "invalid_limit" = "unauthenticated") {
    super(message);
    this.name = "AccountHistoryError";
  }
}

function memberId(owner: CreditOwner): string {
  if (owner.kind !== "member" || !owner.ownerId.startsWith("member:")) throw new AccountHistoryError("Member account is required");
  return owner.ownerId.slice("member:".length);
}

function encodeBase64Url(value: string): string {
  return btoa(value).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function decodeBase64Url(value: string): string {
  if (!/^[A-Za-z0-9_-]{1,240}$/.test(value)) throw new AccountHistoryError("Invalid history cursor", "invalid_cursor");
  try {
    return atob(value.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (value.length % 4)) % 4));
  } catch {
    throw new AccountHistoryError("Invalid history cursor", "invalid_cursor");
  }
}

export function encodeHistoryCursor(createdAt: number, id: string): string {
  if (!Number.isSafeInteger(createdAt) || !id || id.length > 200) throw new AccountHistoryError("Invalid history cursor", "invalid_cursor");
  return encodeBase64Url(JSON.stringify({ createdAt, id }));
}

export function decodeHistoryCursor(cursor: string | null | undefined): { createdAt: number; id: string } | null {
  if (!cursor) return null;
  try {
    const value = JSON.parse(decodeBase64Url(cursor)) as { createdAt?: unknown; id?: unknown };
    if (!Number.isSafeInteger(value.createdAt) || typeof value.id !== "string" || !value.id || value.id.length > 200) throw new Error("invalid");
    return { createdAt: Number(value.createdAt), id: value.id };
  } catch {
    throw new AccountHistoryError("Invalid history cursor", "invalid_cursor");
  }
}

function boundedLimit(value: number | undefined): number {
  if (value === undefined) return 20;
  if (!Number.isSafeInteger(value) || value < 1 || value > 50) throw new AccountHistoryError("Invalid history limit", "invalid_limit");
  return value;
}

function marker(value: unknown): { readingId?: string; sessionId?: string } {
  if (typeof value !== "string") return {};
  try {
    const parsed = JSON.parse(value) as { reading_id?: unknown; session_id?: unknown };
    return {
      readingId: typeof parsed.reading_id === "string" ? parsed.reading_id : undefined,
      sessionId: typeof parsed.session_id === "string" ? parsed.session_id : undefined,
    };
  } catch {
    return {};
  }
}

function mapHistoryRow(row: Record<string, unknown>): AccountHistoryItem {
  const kind = String(row.kind) as AccountHistoryItemKind;
  const item: AccountHistoryItem = {
    id: String(row.id),
    kind,
    createdAt: Number(row.created_at),
    referenceId: row.reference_id == null ? null : String(row.reference_id),
    status: row.status == null ? null : String(row.status),
    amountMinor: row.amount_minor == null ? null : Number(row.amount_minor),
    currency: row.currency == null ? null : String(row.currency),
    units: row.units == null ? null : Number(row.units),
    reason: row.reason == null ? null : String(row.reason),
  };
  if (kind === "reading") {
    const parsed = marker(row.private_marker);
    item.savedReadingId = item.id;
    item.readingId = parsed.readingId;
    item.sessionId = parsed.sessionId;
  }
  if (kind === "share") item.readingId = item.referenceId ?? undefined;
  if (kind === "order") item.paymentReference = row.payment_reference == null ? null : String(row.payment_reference);
  return item;
}

const historyUnion = `
  SELECT r.id, 'reading' AS kind, r.updated AS created_at, NULL AS reference_id, NULL AS status,
    NULL AS amount_minor, NULL AS currency, NULL AS units, NULL AS reason, r.data AS private_marker, NULL AS payment_reference
    FROM records r WHERE r.owner=? AND r.kind='tarot-reading'
  UNION ALL
  SELECT rs.id, 'share' AS kind, rs.created_at, r.id AS reference_id, rs.status,
    NULL, NULL, NULL, NULL, NULL, NULL
    FROM reading_shares rs JOIN readings r ON r.id=rs.reading_id JOIN reading_sessions s ON s.id=r.session_id
    WHERE s.user_id=?
  UNION ALL
  SELECT o.id, 'order' AS kind, o.created_at, o.id AS reference_id, o.status,
    o.amount_minor, o.currency, NULL, NULL, NULL, o.payment_reference
    FROM orders o JOIN credit_accounts a ON a.id=o.account_id
    WHERE a.owner_kind='member' AND a.owner_id=?
  UNION ALL
  SELECT l.id, 'credit' AS kind, l.created_at, l.reference_id, l.event_type,
    NULL, NULL, l.units, l.reason, NULL, NULL
    FROM credit_ledger l JOIN credit_accounts a ON a.id=l.account_id
    WHERE a.owner_kind='member' AND a.owner_id=?
  UNION ALL
  SELECT c.id, 'affiliate' AS kind, c.created_at, c.order_id, c.status,
    c.commission_minor, c.currency, NULL, NULL, NULL, NULL
    FROM affiliate_conversions c WHERE c.member_id=?
`;

export async function listAccountHistory(input: { database: D1Database; owner: CreditOwner; kind?: AccountHistoryKind; limit?: number; cursor?: string | null }): Promise<{ items: AccountHistoryItem[]; nextCursor: string | null }> {
  const ownerId = input.owner.kind === "member" ? input.owner.ownerId : (() => { throw new AccountHistoryError("Member account is required"); })();
  const actualMemberId = memberId(input.owner);
  const kind = input.kind ?? "all";
  if (!["readings", "shares", "orders", "credits", "affiliate", "all"].includes(kind)) throw new AccountHistoryError("Invalid history kind", "invalid_limit");
  const limit = boundedLimit(input.limit);
  const cursor = decodeHistoryCursor(input.cursor);
  const values: Array<string | number> = [ownerId, ownerId, ownerId, ownerId, actualMemberId];
  const predicates: string[] = [];
  const kindMap: Record<Exclude<AccountHistoryKind, "all">, string> = { readings: "reading", shares: "share", orders: "order", credits: "credit", affiliate: "affiliate" };
  if (kind !== "all") { predicates.push("history.kind=?"); values.push(kindMap[kind]); }
  if (cursor) {
    predicates.push("(history.created_at < ? OR (history.created_at = ? AND history.id < ?))");
    values.push(cursor.createdAt, cursor.createdAt, cursor.id);
  }
  values.push(limit + 1);
  const where = predicates.length ? `WHERE ${predicates.join(" AND ")}` : "";
  const result = await input.database.prepare(`SELECT id, kind, created_at, reference_id, status, amount_minor, currency, units, reason, private_marker, payment_reference FROM (${historyUnion}) history ${where} ORDER BY history.created_at DESC, history.id DESC LIMIT ?`).bind(...values).all<Record<string, unknown>>();
  const rows = result.results.map(mapHistoryRow);
  const items = rows.slice(0, limit);
  const nextCursor = rows.length > limit && items.length > 0 ? encodeHistoryCursor(items[items.length - 1].createdAt, items[items.length - 1].id) : null;
  return { items, nextCursor };
}

export async function getAccountSummary(input: { database: D1Database; owner: CreditOwner; now?: number }): Promise<AccountSummary> {
  const ownerId = input.owner.ownerId;
  const id = memberId(input.owner);
  const member = await input.database.prepare("SELECT id, username, email, phone, display_name, created_at FROM members WHERE id=? AND disabled=0 LIMIT 1").bind(id).first<Record<string, unknown>>();
  if (!member) throw new AccountHistoryError("Member account is required");
  const account = await input.database.prepare("SELECT id FROM credit_accounts WHERE owner_kind='member' AND owner_id=? LIMIT 1").bind(ownerId).first<{ id: string }>();
  const currentTime = input.now ?? Date.now();
  const creditStore = createCreditStore(input.database, () => currentTime);
  const credits = {
    balance: await creditStore.getBalance(input.owner),
    history: await creditStore.listHistory(input.owner, 10),
  };
  const vip = (await getActiveEntitlements(input.database, input.owner, currentTime)).map((entitlement) => ({ id: entitlement.id, entitlementType: entitlement.entitlementType, benefitVersion: entitlement.benefitVersion, startsAt: entitlement.startsAt, endsAt: entitlement.endsAt, status: entitlement.status }));
  const readings = await input.database.prepare("SELECT COUNT(*) AS count FROM records WHERE owner=? AND kind='tarot-reading'").bind(ownerId).first<{ count: number }>();
  const shares = await input.database.prepare("SELECT COUNT(*) AS count FROM reading_shares rs JOIN readings r ON r.id=rs.reading_id JOIN reading_sessions s ON s.id=r.session_id WHERE s.user_id=?").bind(ownerId).first<{ count: number }>();
  const orders = account ? await input.database.prepare("SELECT COUNT(*) AS count FROM orders WHERE account_id=?").bind(account.id).first<{ count: number }>() : { count: 0 };
  const affiliate = await getAffiliateSummary(input.database, ownerId);
  return {
    member: { id: String(member.id), username: String(member.username), email: String(member.email), phone: String(member.phone), displayName: member.display_name == null ? null : String(member.display_name), createdAt: Number(member.created_at) },
    credits,
    vip,
    counts: { readings: Number(readings?.count ?? 0), shares: Number(shares?.count ?? 0), orders: Number(orders?.count ?? 0), affiliateConversions: affiliate.conversions },
    affiliate,
  };
}

export async function listAdminOrderReadModel(input: { database: D1Database; limit?: number }): Promise<AdminOrderReadModel[]> {
  const limit = boundedLimit(input.limit);
  const result = await input.database.prepare(`SELECT o.id, a.owner_id, o.status, o.amount_minor, o.currency, o.payment_reference, o.created_at, o.payment_confirmed_at, o.fulfilled_at, o.refunded_at, f.id AS fulfillment_id, f.result_snapshot
    FROM orders o JOIN credit_accounts a ON a.id=o.account_id LEFT JOIN order_fulfillments f ON f.order_id=o.id
    ORDER BY o.created_at DESC, o.id DESC LIMIT ?`).bind(limit).all<Record<string, unknown>>();
  return result.results.map((row) => ({ id: String(row.id), ownerId: String(row.owner_id), status: String(row.status), amountMinor: Number(row.amount_minor), currency: String(row.currency), paymentReference: row.payment_reference == null ? null : String(row.payment_reference), createdAt: Number(row.created_at), paymentConfirmedAt: row.payment_confirmed_at == null ? null : Number(row.payment_confirmed_at), fulfilledAt: row.fulfilled_at == null ? null : Number(row.fulfilled_at), refundedAt: row.refunded_at == null ? null : Number(row.refunded_at), fulfillmentId: row.fulfillment_id == null ? null : String(row.fulfillment_id), fulfillmentResultSnapshot: row.result_snapshot == null ? null : String(row.result_snapshot) }));
}
