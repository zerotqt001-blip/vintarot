INSERT OR IGNORE INTO member_credit_adjustment_reads (account_id, adjustment_key, read_at)
SELECT legacy.account_id, legacy.adjustment_key, CAST(strftime('%s', 'now') AS INTEGER) * 1000
FROM (
  SELECT l.account_id AS account_id, g.grant_key AS adjustment_key, MAX(l.created_at) AS created_at
  FROM credit_ledger l JOIN credit_grants g ON g.id = l.grant_id
  WHERE l.event_type = 'ADJUSTMENT' AND l.units > 0 AND g.source = 'ADMIN'
    AND l.created_at < CAST(strftime('%s', '2026-09-27T00:00:00Z') AS INTEGER) * 1000
  GROUP BY l.account_id, g.grant_key
  UNION
  SELECT l.account_id AS account_id, r.idempotency_key AS adjustment_key, MAX(l.created_at) AS created_at
  FROM credit_ledger l JOIN credit_reservations r ON r.id = l.reservation_id AND r.account_id = l.account_id
  WHERE l.event_type = 'ADJUSTMENT' AND l.units < 0
    AND r.usage_type = 'CREDIT_ADJUSTMENT' AND r.resource_type = 'adjustment' AND r.status = 'CONSUMED'
    AND l.created_at < CAST(strftime('%s', '2026-09-27T00:00:00Z') AS INTEGER) * 1000
  GROUP BY l.account_id, r.idempotency_key
) legacy;
