import type { D1Database } from "@cloudflare/workers-types";
import { creditAccountId } from "./credits/repository";
import type { CreditOwner } from "./credits/types";

export type AccountCreditAdjustmentNotice = {
  adjustmentKey: string;
  units: number;
  reason: string;
  createdAt: number;
};

// Keep pre-rollout ledger entries from appearing as newly delivered notices.
const NOTICE_ROLLOUT_START_AT = Date.parse("2026-09-27T00:00:00Z");

const nextNoticeSql = [
  "WITH adjustments AS (",
  "  SELECT l.account_id AS account_id, g.grant_key AS adjustment_key,",
  "    SUM(l.units) AS units, MAX(l.reason) AS reason, MAX(l.created_at) AS created_at",
  "  FROM credit_ledger l JOIN credit_grants g ON g.id = l.grant_id",
  "  WHERE l.account_id = ? AND l.event_type = 'ADJUSTMENT' AND l.units > 0 AND g.source = 'ADMIN' AND l.created_at >= ?",
  "  GROUP BY l.account_id, g.grant_key",
  "  UNION ALL",
  "  SELECT l.account_id AS account_id, r.idempotency_key AS adjustment_key,",
  "    SUM(l.units) AS units, MAX(l.reason) AS reason, MAX(l.created_at) AS created_at",
  "  FROM credit_ledger l JOIN credit_reservations r ON r.id = l.reservation_id AND r.account_id = l.account_id",
  "  WHERE l.account_id = ? AND l.event_type = 'ADJUSTMENT' AND l.units < 0",
  "    AND r.usage_type = 'CREDIT_ADJUSTMENT' AND r.resource_type = 'adjustment' AND r.status = 'CONSUMED' AND l.created_at >= ?",
  "  GROUP BY l.account_id, r.idempotency_key",
  ")",
  "SELECT adjustments.adjustment_key AS adjustmentKey, adjustments.units, adjustments.reason, adjustments.created_at AS createdAt",
  "FROM adjustments LEFT JOIN member_credit_adjustment_reads seen",
  "  ON seen.account_id = adjustments.account_id AND seen.adjustment_key = adjustments.adjustment_key",
  "WHERE adjustments.account_id = ? AND seen.account_id IS NULL",
  "ORDER BY adjustments.created_at ASC, adjustments.adjustment_key ASC LIMIT 1",
].join("\n");

function memberAccountId(owner: CreditOwner): string {
  if (owner.kind !== "member" || !owner.ownerId.startsWith("member:")) {
    throw new Error("Member credit account is required.");
  }
  return creditAccountId(owner);
}

export async function getNextAccountCreditAdjustmentNotice(
  database: D1Database,
  owner: CreditOwner,
): Promise<AccountCreditAdjustmentNotice | null> {
  const accountId = memberAccountId(owner);
  const row = await database.prepare(nextNoticeSql)
    .bind(accountId, NOTICE_ROLLOUT_START_AT, accountId, NOTICE_ROLLOUT_START_AT, accountId)
    .first<AccountCreditAdjustmentNotice>();
  if (!row || !Number.isSafeInteger(Number(row.units)) || !Number.isSafeInteger(Number(row.createdAt))) return null;
  return {
    adjustmentKey: String(row.adjustmentKey),
    units: Number(row.units),
    reason: String(row.reason),
    createdAt: Number(row.createdAt),
  };
}

export async function markAccountCreditAdjustmentNoticeRead(
  database: D1Database,
  owner: CreditOwner,
  adjustmentKey: string,
  readAt = Date.now(),
): Promise<void> {
  const accountId = memberAccountId(owner);
  const statement = [
    "INSERT OR IGNORE INTO member_credit_adjustment_reads (account_id, adjustment_key, read_at)",
    "SELECT ?, ?, ? WHERE EXISTS (",
    "  SELECT 1 FROM credit_ledger l",
    "  LEFT JOIN credit_grants g ON g.id = l.grant_id",
    "  LEFT JOIN credit_reservations r ON r.id = l.reservation_id AND r.account_id = l.account_id",
    "  WHERE l.account_id = ? AND l.event_type = 'ADJUSTMENT' AND (",
    "    (l.units > 0 AND g.source = 'ADMIN' AND g.grant_key = ?)",
    "    OR (l.units < 0 AND r.usage_type = 'CREDIT_ADJUSTMENT' AND r.resource_type = 'adjustment'",
    "      AND r.status = 'CONSUMED' AND r.idempotency_key = ?)",
    "  )",
    ")",
  ].join("\n");
  await database.prepare(statement)
    .bind(accountId, adjustmentKey, readAt, accountId, adjustmentKey, adjustmentKey)
    .run();
}
