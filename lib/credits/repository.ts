import type { D1Database, D1Result } from "@cloudflare/workers-types";
import { prepareAuditInsert } from "../audit/service";
import type { AuditAppendInput } from "../audit/types";
import { createRequestFingerprint, validateLedgerEntry } from "./ledger";
import type {
  CreditBalance,
  CreditHistoryEntry,
  CreditLedgerEventType,
  CreditLot,
  CreditOwner,
  CreditReservationStatus,
  CreditSource,
} from "./types";

export class CreditError extends Error {
  constructor(message: string, readonly code: string) {
    super(message);
    this.name = "CreditError";
  }
}

export class CreditInsufficientError extends CreditError {
  constructor(message = "Insufficient credits") {
    super(message, "insufficient_credits");
    this.name = "CreditInsufficientError";
  }
}

export class CreditIdempotencyError extends CreditError {
  constructor(message = "Credit request conflicts with an existing idempotency key") {
    super(message, "idempotency_conflict");
    this.name = "CreditIdempotencyError";
  }
}

export class CreditNotFoundError extends CreditError {
  constructor(message = "Credit record not found") {
    super(message, "credit_not_found");
    this.name = "CreditNotFoundError";
  }
}

export class CreditReservationStateError extends CreditError {
  constructor(message = "Credit reservation is not in a mutable state") {
    super(message, "reservation_state");
    this.name = "CreditReservationStateError";
  }
}

export type CreditAccount = {
  id: string;
  owner: CreditOwner;
  mutationVersion: number;
  createdAt: number;
  updatedAt: number;
};

export type CreditGrant = CreditLot & {
  accountId: string;
  source: CreditSource;
  sourceType: string | null;
  sourceId: string | null;
  grantKey: string;
  policyVersion: string;
  policySnapshot: string;
  requestFingerprint: string;
  updatedAt: number;
};

export type CreditReservationAllocation = {
  id: string;
  reservationId: string;
  grantId: string;
  heldUnits: number;
  consumedUnits: number;
  releasedUnits: number;
  createdAt: number;
  updatedAt: number;
};

export type CreditReservation = {
  id: string;
  accountId: string;
  owner: CreditOwner;
  usageType: string;
  units: number;
  resourceType: string;
  resourceId: string;
  idempotencyKey: string;
  requestFingerprint: string;
  status: CreditReservationStatus;
  leaseExpiresAt: number | null;
  retryCount: number;
  resultType: string | null;
  resultId: string | null;
  reason: string | null;
  createdAt: number;
  updatedAt: number;
  consumedAt: number | null;
  releasedAt: number | null;
  allocations: CreditReservationAllocation[];
  acquired?: boolean;
};

export type GrantCreditsInput = {
  owner: CreditOwner;
  source: CreditSource;
  units: number;
  grantKey: string;
  eligibleFrom?: number;
  expiresAt?: number | null;
  sourceType?: string | null;
  sourceId?: string | null;
  policyVersion: string;
  policySnapshot: unknown;
  reason: string;
  audit?: AuditAppendInput;
  auditStrict?: boolean;
};

export type RefundCreditsInput = Omit<GrantCreditsInput, "source">;

export type AdjustCreditsInput = {
  owner: CreditOwner;
  units: number;
  adjustmentKey: string;
  eligibleFrom?: number;
  reason: string;
  policyVersion?: string;
  policySnapshot?: unknown;
  audit?: AuditAppendInput;
  auditStrict?: boolean;
};

export type ReserveCreditsInput = {
  owner: CreditOwner;
  units: number;
  usageType: string;
  resourceType: string;
  resourceId: string;
  idempotencyKey: string;
  leaseExpiresAt?: number | null;
};

export type ConsumeReservationInput = {
  owner: CreditOwner;
  reservationId: string;
  resultType?: string | null;
  resultId?: string | null;
  reason?: string;
  eventType?: "CONSUME" | "ADJUSTMENT";
  audit?: AuditAppendInput;
  auditStrict?: boolean;
};

export type ReleaseReservationInput = {
  owner: CreditOwner;
  reservationId: string;
  reason?: string;
};

export type CreditStore = {
  ensureAccount(owner: CreditOwner): Promise<CreditAccount>;
  grantCredits(input: GrantCreditsInput): Promise<CreditGrant>;
  refundCredits(input: RefundCreditsInput): Promise<CreditGrant>;
  adjustCredits(input: AdjustCreditsInput): Promise<CreditGrant | CreditReservation>;
  getBalance(owner: CreditOwner): Promise<CreditBalance>;
  listHistory(owner: CreditOwner, limit?: number): Promise<CreditHistoryEntry[]>;
  reserveCredits(input: ReserveCreditsInput): Promise<CreditReservation>;
  getReservation(owner: CreditOwner, reservationId: string): Promise<CreditReservation | null>;
  getReservationByKey(owner: CreditOwner, idempotencyKey: string): Promise<CreditReservation | null>;
  consumeReservation(input: ConsumeReservationInput): Promise<CreditReservation>;
  releaseReservation(input: ReleaseReservationInput): Promise<CreditReservation>;
  expireReservation(input: { owner: CreditOwner; reservationId: string }): Promise<CreditReservation>;
  expireGrant(input: { owner: CreditOwner; grantId: string }): Promise<number>;
  rebuildGrantProjections(owner: CreditOwner): Promise<void>;
};

type AccountRow = {
  id: string;
  ownerKind: CreditOwner["kind"];
  ownerId: string;
  mutationVersion: number;
  createdAt: number;
  updatedAt: number;
};

type GrantRow = {
  id: string;
  accountId: string;
  source: CreditSource;
  sourceType: string | null;
  sourceId: string | null;
  grantKey: string;
  requestFingerprint: string;
  units: number;
  availableUnits: number;
  eligibleFrom: number;
  expiresAt: number | null;
  policyVersion: string;
  policySnapshot: string;
  createdAt: number;
  updatedAt: number;
};

type ReservationRow = {
  id: string;
  accountId: string;
  ownerKind: CreditOwner["kind"];
  ownerId: string;
  usageType: string;
  units: number;
  resourceType: string;
  resourceId: string;
  idempotencyKey: string;
  requestFingerprint: string;
  status: CreditReservationStatus;
  leaseExpiresAt: number | null;
  retryCount: number;
  resultType: string | null;
  resultId: string | null;
  reason: string | null;
  createdAt: number;
  updatedAt: number;
  consumedAt: number | null;
  releasedAt: number | null;
};

type AllocationRow = {
  id: string;
  reservationId: string;
  grantId: string;
  heldUnits: number;
  consumedUnits: number;
  releasedUnits: number;
  createdAt: number;
  updatedAt: number;
};

export function creditAccountId(owner: CreditOwner): string {
  if (!owner.ownerId.trim()) throw new CreditError("Credit owner id is required", "invalid_owner");
  return `credit-account:${owner.kind}:${owner.ownerId}`;
}

function scopedId(prefix: string, accountId: string, key: string): string {
  return `${prefix}:${accountId}:${key}`;
}

function snapshot(value: unknown): string {
  return typeof value === "string" ? value : createRequestFingerprint(value);
}

async function first<T>(database: D1Database, statement: string, ...values: unknown[]): Promise<T | null> {
  return (await database.prepare(statement).bind(...values).first<T>()) || null;
}

async function rows<T>(database: D1Database, statement: string, ...values: unknown[]): Promise<T[]> {
  const result = await database.prepare(statement).bind(...values).all<T>();
  return result.results;
}

function changes(result: D1Result<unknown> | undefined): number {
  return Number(result?.meta?.changes ?? 0);
}

function mapAccount(row: AccountRow): CreditAccount {
  return {
    id: row.id,
    owner: { kind: row.ownerKind, ownerId: row.ownerId },
    mutationVersion: Number(row.mutationVersion),
    createdAt: Number(row.createdAt),
    updatedAt: Number(row.updatedAt),
  };
}

function mapGrant(row: GrantRow): CreditGrant {
  return {
    id: row.id,
    accountId: row.accountId,
    source: row.source,
    sourceType: row.sourceType,
    sourceId: row.sourceId,
    grantKey: row.grantKey,
    requestFingerprint: row.requestFingerprint,
    units: Number(row.units),
    availableUnits: Number(row.availableUnits),
    eligibleFrom: Number(row.eligibleFrom),
    expiresAt: row.expiresAt === null ? null : Number(row.expiresAt),
    createdAt: Number(row.createdAt),
    updatedAt: Number(row.updatedAt),
    policyVersion: row.policyVersion,
    policySnapshot: row.policySnapshot,
  };
}

function mapReservation(row: ReservationRow, allocationRows: AllocationRow[]): CreditReservation {
  return {
    id: row.id,
    accountId: row.accountId,
    owner: { kind: row.ownerKind, ownerId: row.ownerId },
    usageType: row.usageType,
    units: Number(row.units),
    resourceType: row.resourceType,
    resourceId: row.resourceId,
    idempotencyKey: row.idempotencyKey,
    requestFingerprint: row.requestFingerprint,
    status: row.status,
    leaseExpiresAt: row.leaseExpiresAt === null ? null : Number(row.leaseExpiresAt),
    retryCount: Number(row.retryCount),
    resultType: row.resultType,
    resultId: row.resultId,
    reason: row.reason,
    createdAt: Number(row.createdAt),
    updatedAt: Number(row.updatedAt),
    consumedAt: row.consumedAt === null ? null : Number(row.consumedAt),
    releasedAt: row.releasedAt === null ? null : Number(row.releasedAt),
    allocations: allocationRows.map((allocation) => ({
      id: allocation.id,
      reservationId: allocation.reservationId,
      grantId: allocation.grantId,
      heldUnits: Number(allocation.heldUnits),
      consumedUnits: Number(allocation.consumedUnits),
      releasedUnits: Number(allocation.releasedUnits),
      createdAt: Number(allocation.createdAt),
      updatedAt: Number(allocation.updatedAt),
    })),
  };
}

export function createCreditStore(database: D1Database, now: () => number = Date.now): CreditStore {
  async function ensureAccount(owner: CreditOwner): Promise<CreditAccount> {
    const accountId = creditAccountId(owner);
    const timestamp = now();
    await database.prepare("INSERT OR IGNORE INTO credit_accounts (id, owner_kind, owner_id, mutation_version, mutation_token, created_at, updated_at) VALUES (?, ?, ?, 0, NULL, ?, ?)")
      .bind(accountId, owner.kind, owner.ownerId, timestamp, timestamp)
      .run();
    const row = await first<AccountRow>(database, "SELECT id, owner_kind AS ownerKind, owner_id AS ownerId, mutation_version AS mutationVersion, created_at AS createdAt, updated_at AS updatedAt FROM credit_accounts WHERE id = ?", accountId);
    if (!row) throw new CreditError("Could not create credit account", "account_unavailable");
    return mapAccount(row);
  }

  async function grantCreditsWithEvent(input: GrantCreditsInput, eventType: "GRANT" | "REFUND" | "ADJUSTMENT"): Promise<CreditGrant> {
    if (!Number.isSafeInteger(input.units) || input.units <= 0) throw new CreditError("Grant units must be a positive integer", "invalid_units");
    if (!input.grantKey.trim()) throw new CreditError("Grant key is required", "invalid_grant_key");
    const account = await ensureAccount(input.owner);
    const timestamp = now();
    const eligibleFrom = input.eligibleFrom ?? timestamp;
    const expiresAt = input.expiresAt ?? null;
    const policySnapshot = snapshot(input.policySnapshot);
    const requestFingerprint = createRequestFingerprint({
      eventType,
      source: input.source,
      units: input.units,
      grantKey: input.grantKey,
      eligibleFrom,
      expiresAt,
      sourceType: input.sourceType ?? null,
      sourceId: input.sourceId ?? null,
      policyVersion: input.policyVersion,
      policySnapshot,
      reason: input.reason,
    });
    const grantId = scopedId("credit-grant", account.id, input.grantKey);
    const ledgerKey = `grant:${input.grantKey}`;
    const ledgerId = scopedId("credit-ledger", account.id, ledgerKey);
    validateLedgerEntry({
      eventType,
      units: input.units,
      idempotencyKey: ledgerKey,
      requestFingerprint,
      reason: input.reason,
      effectiveAt: eligibleFrom,
      createdAt: timestamp,
    });
    const statements = [
      database.prepare("UPDATE credit_accounts SET mutation_version = mutation_version + 1, updated_at = ? WHERE id = ?").bind(timestamp, account.id),
      database.prepare("INSERT OR IGNORE INTO credit_grants (id, account_id, source, source_type, source_id, grant_key, request_fingerprint, units, available_units, eligible_from, expires_at, policy_version, policy_snapshot, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
        .bind(grantId, account.id, input.source, input.sourceType ?? null, input.sourceId ?? null, input.grantKey, requestFingerprint, input.units, input.units, eligibleFrom, expiresAt, input.policyVersion, policySnapshot, timestamp, timestamp),
      database.prepare("INSERT OR IGNORE INTO credit_ledger (id, account_id, grant_id, reservation_id, event_type, units, reference_type, reference_id, idempotency_key, request_fingerprint, actor_kind, actor_id, reason, effective_at, created_at, reversed_entry_id) VALUES (?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, 'system', NULL, ?, ?, ?, NULL)")
        .bind(ledgerId, account.id, grantId, eventType, input.units, input.sourceType ?? "grant", input.sourceId ?? input.grantKey, ledgerKey, requestFingerprint, input.reason, eligibleFrom, timestamp),
    ];
    if (input.audit) statements.push(prepareAuditInsert(database, input.audit, timestamp, { ignoreExisting: input.auditStrict !== true }));
    await database.batch(statements);
    const row = await first<GrantRow>(database, "SELECT id, account_id AS accountId, source, source_type AS sourceType, source_id AS sourceId, grant_key AS grantKey, request_fingerprint AS requestFingerprint, units, available_units AS availableUnits, eligible_from AS eligibleFrom, expires_at AS expiresAt, policy_version AS policyVersion, policy_snapshot AS policySnapshot, created_at AS createdAt, updated_at AS updatedAt FROM credit_grants WHERE id = ? AND account_id = ?", grantId, account.id);
    if (!row) throw new CreditError("Credit grant was not persisted", "grant_unavailable");
    if (row.requestFingerprint !== requestFingerprint) throw new CreditIdempotencyError(`Grant key ${input.grantKey} already belongs to a different request`);
    return mapGrant(row);
  }

  async function getReservationRow(owner: CreditOwner, reservationId: string): Promise<CreditReservation | null> {
    const row = await first<ReservationRow>(database, "SELECT r.id, r.account_id AS accountId, a.owner_kind AS ownerKind, a.owner_id AS ownerId, r.usage_type AS usageType, r.units, r.resource_type AS resourceType, r.resource_id AS resourceId, r.idempotency_key AS idempotencyKey, r.request_fingerprint AS requestFingerprint, r.status, r.lease_expires_at AS leaseExpiresAt, r.retry_count AS retryCount, r.result_type AS resultType, r.result_id AS resultId, r.reason, r.created_at AS createdAt, r.updated_at AS updatedAt, r.consumed_at AS consumedAt, r.released_at AS releasedAt FROM credit_reservations r JOIN credit_accounts a ON a.id = r.account_id WHERE r.id = ? AND a.owner_kind = ? AND a.owner_id = ?", reservationId, owner.kind, owner.ownerId);
    if (!row) return null;
    const allocationRows = await rows<AllocationRow>(database, "SELECT a.id, a.reservation_id AS reservationId, a.grant_id AS grantId, a.held_units AS heldUnits, a.consumed_units AS consumedUnits, a.released_units AS releasedUnits, a.created_at AS createdAt, a.updated_at AS updatedAt FROM credit_reservation_allocations a JOIN credit_grants g ON g.id = a.grant_id WHERE a.reservation_id = ? ORDER BY CASE WHEN g.expires_at IS NULL THEN 1 ELSE 0 END, g.expires_at, g.created_at, g.id", reservationId);
    return mapReservation(row, allocationRows);
  }

  async function getReservationByKey(owner: CreditOwner, idempotencyKey: string): Promise<CreditReservation | null> {
    const accountId = creditAccountId(owner);
    const row = await first<ReservationRow>(database, "SELECT r.id, r.account_id AS accountId, a.owner_kind AS ownerKind, a.owner_id AS ownerId, r.usage_type AS usageType, r.units, r.resource_type AS resourceType, r.resource_id AS resourceId, r.idempotency_key AS idempotencyKey, r.request_fingerprint AS requestFingerprint, r.status, r.lease_expires_at AS leaseExpiresAt, r.retry_count AS retryCount, r.result_type AS resultType, r.result_id AS resultId, r.reason, r.created_at AS createdAt, r.updated_at AS updatedAt, r.consumed_at AS consumedAt, r.released_at AS releasedAt FROM credit_reservations r JOIN credit_accounts a ON a.id = r.account_id WHERE r.account_id = ? AND r.idempotency_key = ?", accountId, idempotencyKey);
    if (!row) return null;
    const allocationRows = await rows<AllocationRow>(database, "SELECT a.id, a.reservation_id AS reservationId, a.grant_id AS grantId, a.held_units AS heldUnits, a.consumed_units AS consumedUnits, a.released_units AS releasedUnits, a.created_at AS createdAt, a.updated_at AS updatedAt FROM credit_reservation_allocations a JOIN credit_grants g ON g.id = a.grant_id WHERE a.reservation_id = ? ORDER BY CASE WHEN g.expires_at IS NULL THEN 1 ELSE 0 END, g.expires_at, g.created_at, g.id", row.id);
    return mapReservation(row, allocationRows);
  }

  async function reserveCredits(input: ReserveCreditsInput): Promise<CreditReservation> {
    if (!Number.isSafeInteger(input.units) || input.units <= 0) throw new CreditError("Reservation units must be a positive integer", "invalid_units");
    if (!input.idempotencyKey.trim()) throw new CreditError("Reservation idempotency key is required", "invalid_idempotency_key");
    const account = await ensureAccount(input.owner);
    const requestFingerprint = createRequestFingerprint({
      units: input.units,
      usageType: input.usageType,
      resourceType: input.resourceType,
      resourceId: input.resourceId,
      idempotencyKey: input.idempotencyKey,
    });
    const existing = await getReservationByKey(input.owner, input.idempotencyKey);
    if (existing && existing.requestFingerprint !== requestFingerprint) {
      throw new CreditIdempotencyError(`Reservation key ${input.idempotencyKey} already belongs to a different request`);
    }
    if (existing && (existing.status === "RESERVED" || existing.status === "CONSUMED")) return { ...existing, acquired: false };
    const timestamp = now();
    const reservationId = existing?.id ?? scopedId("credit-reservation", account.id, input.idempotencyKey);
    const leaseExpiresAt = input.leaseExpiresAt === undefined ? timestamp + 10 * 60 * 1000 : input.leaseExpiresAt;
    const batchResult = await database.batch([
      database.prepare("UPDATE credit_accounts SET mutation_version = mutation_version + 1, updated_at = ? WHERE id = ?").bind(timestamp, account.id),
      database.prepare("INSERT OR IGNORE INTO credit_reservations (id, account_id, usage_type, units, resource_type, resource_id, idempotency_key, request_fingerprint, status, lease_expires_at, retry_count, result_type, result_id, reason, created_at, updated_at, consumed_at, released_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', ?, 0, NULL, NULL, NULL, ?, ?, NULL, NULL)")
        .bind(reservationId, account.id, input.usageType, input.units, input.resourceType, input.resourceId, input.idempotencyKey, requestFingerprint, leaseExpiresAt, timestamp, timestamp),
      database.prepare("UPDATE credit_reservations SET status = 'PENDING', retry_count = retry_count + 1, reason = NULL, updated_at = ?, consumed_at = NULL, released_at = NULL WHERE id = ? AND request_fingerprint = ? AND status IN ('RELEASED', 'EXPIRED')")
        .bind(timestamp, reservationId, requestFingerprint),
      database.prepare("DELETE FROM credit_reservation_allocations WHERE reservation_id = ? AND EXISTS (SELECT 1 FROM credit_reservations WHERE id = ? AND status = 'PENDING')")
        .bind(reservationId, reservationId),
      database.prepare(`WITH eligible AS (
          SELECT g.id, g.available_units,
            ? - COALESCE(SUM(g.available_units) OVER (
              ORDER BY CASE WHEN g.expires_at IS NULL THEN 1 ELSE 0 END, g.expires_at, g.created_at, g.id
              ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
            ), 0) AS remaining_before
          FROM credit_grants g
          WHERE g.account_id = ?
            AND g.available_units > 0
            AND g.eligible_from <= ?
            AND (g.expires_at IS NULL OR g.expires_at > ?)
        ), allocations AS (
          SELECT id, CASE WHEN available_units < remaining_before THEN available_units ELSE remaining_before END AS held_units
          FROM eligible
          WHERE remaining_before > 0
        ), available AS (
          SELECT COALESCE(SUM(g.available_units), 0) AS units
          FROM credit_grants g
          WHERE g.account_id = ?
            AND g.available_units > 0
            AND g.eligible_from <= ?
            AND (g.expires_at IS NULL OR g.expires_at > ?)
        )
        INSERT INTO credit_reservation_allocations (id, reservation_id, grant_id, held_units, consumed_units, released_units, created_at, updated_at)
        SELECT 'credit-allocation:' || ? || ':' || allocations.id, ?, allocations.id, allocations.held_units, 0, 0, ?, ?
        FROM allocations CROSS JOIN available
        WHERE allocations.held_units > 0
          AND available.units >= ?
          AND EXISTS (SELECT 1 FROM credit_reservations r WHERE r.id = ? AND r.status = 'PENDING' AND r.units = ?)`)
        .bind(input.units, account.id, timestamp, timestamp, account.id, timestamp, timestamp, reservationId, reservationId, timestamp, timestamp, input.units, reservationId, input.units),
      database.prepare("UPDATE credit_grants SET available_units = available_units - (SELECT COALESCE(SUM(held_units), 0) FROM credit_reservation_allocations WHERE grant_id = credit_grants.id AND reservation_id = ?), updated_at = ? WHERE account_id = ? AND id IN (SELECT grant_id FROM credit_reservation_allocations WHERE reservation_id = ?) AND EXISTS (SELECT 1 FROM credit_reservations WHERE id = ? AND status = 'PENDING')")
        .bind(reservationId, timestamp, account.id, reservationId, reservationId),
      database.prepare("UPDATE credit_reservations SET status = 'RESERVED', updated_at = ? WHERE id = ? AND status = 'PENDING' AND (SELECT COALESCE(SUM(held_units), 0) FROM credit_reservation_allocations WHERE reservation_id = ?) = units")
        .bind(timestamp, reservationId, reservationId),
      database.prepare("UPDATE credit_reservations SET status = 'EXPIRED', reason = 'insufficient_credits', updated_at = ? WHERE id = ? AND status = 'PENDING' AND (SELECT COALESCE(SUM(held_units), 0) FROM credit_reservation_allocations WHERE reservation_id = ?) < units")
        .bind(timestamp, reservationId, reservationId),
    ]);
    const result = await getReservationRow(input.owner, reservationId);
    if (!result) throw new CreditError("Credit reservation was not persisted", "reservation_unavailable");
    if (result.requestFingerprint !== requestFingerprint) throw new CreditIdempotencyError(`Reservation key ${input.idempotencyKey} already belongs to a different request`);
    if (result.status === "EXPIRED") throw new CreditInsufficientError();
    if (result.status !== "RESERVED" && result.status !== "CONSUMED") throw new CreditReservationStateError(`Reservation ${reservationId} did not reach RESERVED state`);
    const acquired = changes(batchResult[1]) === 1 || changes(batchResult[2]) === 1;
    return { ...result, acquired };
  }

  async function consumeReservation(input: ConsumeReservationInput): Promise<CreditReservation> {
    const existing = await getReservationRow(input.owner, input.reservationId);
    if (!existing) throw new CreditNotFoundError("Reservation not found for this owner");
    if (existing.status === "CONSUMED") {
      if (input.resultType !== undefined && input.resultType !== existing.resultType) throw new CreditIdempotencyError("Consumed reservation result type conflicts");
      if (input.resultId !== undefined && input.resultId !== existing.resultId) throw new CreditIdempotencyError("Consumed reservation result id conflicts");
      return existing;
    }
    if (existing.status !== "RESERVED") throw new CreditReservationStateError(`Reservation ${input.reservationId} is ${existing.status}`);
    const accountId = creditAccountId(input.owner);
    const timestamp = now();
    const eventType: CreditLedgerEventType = input.eventType ?? "CONSUME";
    const reason = input.reason ?? (eventType === "ADJUSTMENT" ? "Credit adjustment" : "Credit usage consumed");
    const requestFingerprint = createRequestFingerprint({ reservationId: input.reservationId, resultType: input.resultType ?? null, resultId: input.resultId ?? null, eventType });
    const statements = [
      database.prepare("UPDATE credit_accounts SET mutation_version = mutation_version + 1, updated_at = ? WHERE id = ?").bind(timestamp, accountId),
      database.prepare(`INSERT OR IGNORE INTO credit_ledger (id, account_id, grant_id, reservation_id, event_type, units, reference_type, reference_id, idempotency_key, request_fingerprint, actor_kind, actor_id, reason, effective_at, created_at, reversed_entry_id)
        SELECT 'credit-ledger:' || r.id || ':' || a.grant_id || ':' || ?, r.account_id, a.grant_id, r.id, ?, -(a.held_units - a.consumed_units - a.released_units), 'reservation', r.id, 'consume:' || r.id || ':' || a.grant_id || ':' || ?, ?, 'system', NULL, ?, ?, ?, NULL
        FROM credit_reservations r JOIN credit_reservation_allocations a ON a.reservation_id = r.id
        WHERE r.id = ? AND r.account_id = ? AND r.status = 'RESERVED' AND a.held_units > a.consumed_units + a.released_units`)
        .bind(eventType, eventType, eventType, requestFingerprint, reason, timestamp, timestamp, input.reservationId, accountId),
      database.prepare("UPDATE credit_reservation_allocations SET consumed_units = held_units - released_units, updated_at = ? WHERE reservation_id = ? AND consumed_units + released_units < held_units").bind(timestamp, input.reservationId),
      database.prepare("UPDATE credit_reservations SET status = 'CONSUMED', result_type = ?, result_id = ?, reason = ?, consumed_at = ?, updated_at = ? WHERE id = ? AND account_id = ? AND status = 'RESERVED'")
        .bind(input.resultType ?? null, input.resultId ?? null, reason, timestamp, timestamp, input.reservationId, accountId),
    ];
    if (input.audit) statements.push(prepareAuditInsert(database, input.audit, timestamp, { ignoreExisting: input.auditStrict !== true }));
    await database.batch(statements);
    const result = await getReservationRow(input.owner, input.reservationId);
    if (!result) throw new CreditNotFoundError("Reservation disappeared during consume");
    if (result.status !== "CONSUMED") throw new CreditReservationStateError(`Reservation ${input.reservationId} did not reach CONSUMED state`);
    return result;
  }

  async function releaseReservation(input: ReleaseReservationInput): Promise<CreditReservation> {
    const existing = await getReservationRow(input.owner, input.reservationId);
    if (!existing) throw new CreditNotFoundError("Reservation not found for this owner");
    if (existing.status === "RELEASED" || existing.status === "EXPIRED" || existing.status === "CONSUMED") return existing;
    if (existing.status !== "RESERVED") throw new CreditReservationStateError(`Reservation ${input.reservationId} is ${existing.status}`);
    const accountId = creditAccountId(input.owner);
    const timestamp = now();
    await database.batch([
      database.prepare("UPDATE credit_accounts SET mutation_version = mutation_version + 1, updated_at = ? WHERE id = ?").bind(timestamp, accountId),
      database.prepare("UPDATE credit_grants SET available_units = available_units + (SELECT COALESCE(SUM(held_units - consumed_units - released_units), 0) FROM credit_reservation_allocations WHERE grant_id = credit_grants.id AND reservation_id = ?), updated_at = ? WHERE account_id = ? AND id IN (SELECT grant_id FROM credit_reservation_allocations WHERE reservation_id = ?) AND EXISTS (SELECT 1 FROM credit_reservations WHERE id = ? AND status = 'RESERVED')")
        .bind(input.reservationId, timestamp, accountId, input.reservationId, input.reservationId),
      database.prepare("UPDATE credit_reservation_allocations SET released_units = held_units - consumed_units, updated_at = ? WHERE reservation_id = ? AND consumed_units + released_units < held_units").bind(timestamp, input.reservationId),
      database.prepare("UPDATE credit_reservations SET status = 'RELEASED', reason = ?, released_at = ?, updated_at = ? WHERE id = ? AND account_id = ? AND status = 'RESERVED'")
        .bind(input.reason ?? "Credit reservation released", timestamp, timestamp, input.reservationId, accountId),
    ]);
    const result = await getReservationRow(input.owner, input.reservationId);
    if (!result) throw new CreditNotFoundError("Reservation disappeared during release");
    return result;
  }

  async function expireReservation(input: { owner: CreditOwner; reservationId: string }): Promise<CreditReservation> {
    const existing = await getReservationRow(input.owner, input.reservationId);
    if (!existing) throw new CreditNotFoundError("Reservation not found for this owner");
    if (existing.status === "EXPIRED" || existing.status === "RELEASED" || existing.status === "CONSUMED") return existing;
    if (existing.status !== "RESERVED") throw new CreditReservationStateError(`Reservation ${input.reservationId} is ${existing.status}`);
    const timestamp = now();
    if (existing.leaseExpiresAt === null || existing.leaseExpiresAt > timestamp) {
      throw new CreditReservationStateError(`Reservation ${input.reservationId} has not expired`);
    }
    const accountId = creditAccountId(input.owner);
    await database.batch([
      database.prepare("UPDATE credit_accounts SET mutation_version = mutation_version + 1, updated_at = ? WHERE id = ?").bind(timestamp, accountId),
      database.prepare("UPDATE credit_grants SET available_units = available_units + (SELECT COALESCE(SUM(held_units - consumed_units - released_units), 0) FROM credit_reservation_allocations WHERE grant_id = credit_grants.id AND reservation_id = ?), updated_at = ? WHERE account_id = ? AND id IN (SELECT grant_id FROM credit_reservation_allocations WHERE reservation_id = ?) AND EXISTS (SELECT 1 FROM credit_reservations WHERE id = ? AND status = 'RESERVED')")
        .bind(input.reservationId, timestamp, accountId, input.reservationId, input.reservationId),
      database.prepare("UPDATE credit_reservation_allocations SET released_units = held_units - consumed_units, updated_at = ? WHERE reservation_id = ? AND consumed_units + released_units < held_units").bind(timestamp, input.reservationId),
      database.prepare("UPDATE credit_reservations SET status = 'EXPIRED', reason = 'reservation_lease_expired', released_at = ?, updated_at = ? WHERE id = ? AND account_id = ? AND status = 'RESERVED'")
        .bind(timestamp, timestamp, input.reservationId, accountId),
    ]);
    const result = await getReservationRow(input.owner, input.reservationId);
    if (!result) throw new CreditNotFoundError("Reservation disappeared during expiration");
    return result;
  }

  async function expireGrant(input: { owner: CreditOwner; grantId: string }): Promise<number> {
    const account = await ensureAccount(input.owner);
    const timestamp = now();
    const idempotencyKey = `expire:${input.grantId}`;
    const requestFingerprint = createRequestFingerprint({ grantId: input.grantId, idempotencyKey });
    const result = await database.batch([
      database.prepare("UPDATE credit_accounts SET mutation_version = mutation_version + 1, updated_at = ? WHERE id = ?").bind(timestamp, account.id),
      database.prepare("INSERT OR IGNORE INTO credit_ledger (id, account_id, grant_id, reservation_id, event_type, units, reference_type, reference_id, idempotency_key, request_fingerprint, actor_kind, actor_id, reason, effective_at, created_at, reversed_entry_id) SELECT ?, account_id, id, NULL, 'EXPIRATION', -available_units, 'grant', id, ?, ?, 'system', NULL, 'Credit grant expired', expires_at, ?, NULL FROM credit_grants WHERE id = ? AND account_id = ? AND expires_at IS NOT NULL AND expires_at <= ? AND available_units > 0")
        .bind(scopedId("credit-ledger", account.id, idempotencyKey), idempotencyKey, requestFingerprint, timestamp, input.grantId, account.id, timestamp),
      database.prepare("UPDATE credit_grants SET available_units = 0, updated_at = ? WHERE id = ? AND account_id = ? AND expires_at IS NOT NULL AND expires_at <= ? AND available_units > 0").bind(timestamp, input.grantId, account.id, timestamp),
    ]);
    const inserted = changes(result[1]);
    if (inserted === 0) return 0;
    const ledgerRow = await first<{ units: number }>(database, "SELECT units FROM credit_ledger WHERE account_id = ? AND idempotency_key = ?", account.id, idempotencyKey);
    return ledgerRow ? Math.abs(Number(ledgerRow.units)) : 0;
  }

  async function rebuildGrantProjections(owner: CreditOwner): Promise<void> {
    const account = await ensureAccount(owner);
    const timestamp = now();
    await database.prepare(`UPDATE credit_grants AS g SET available_units = MIN(g.units, MAX(0,
      (SELECT COALESCE(SUM(l.units), 0) FROM credit_ledger l WHERE l.grant_id = g.id)
      - (SELECT COALESCE(SUM(a.held_units - a.consumed_units - a.released_units), 0)
         FROM credit_reservation_allocations a JOIN credit_reservations r ON r.id = a.reservation_id
         WHERE a.grant_id = g.id AND r.status = 'RESERVED')
    )), updated_at = ? WHERE g.account_id = ?`).bind(timestamp, account.id).run();
  }

  const store: CreditStore = {
    ensureAccount,
    async grantCredits(input) {
      return grantCreditsWithEvent(input, "GRANT");
    },
    async refundCredits(input) {
      return grantCreditsWithEvent({ ...input, source: "REFUND" }, "REFUND");
    },
    async adjustCredits(input) {
      if (!Number.isSafeInteger(input.units) || input.units === 0) throw new CreditError("Adjustment units must be a non-zero integer", "invalid_units");
      if (input.units > 0) {
        return grantCreditsWithEvent({
          owner: input.owner,
          source: "ADMIN",
          units: input.units,
          grantKey: `adjustment:${input.adjustmentKey}`,
          eligibleFrom: input.eligibleFrom,
          policyVersion: input.policyVersion ?? "credits-v1",
          policySnapshot: input.policySnapshot ?? { adjustment: true },
          reason: input.reason,
          audit: input.audit,
          auditStrict: input.auditStrict,
        }, "ADJUSTMENT");
      }
      const reservation = await reserveCredits({
        owner: input.owner,
        units: Math.abs(input.units),
        usageType: "CREDIT_ADJUSTMENT",
        resourceType: "adjustment",
        resourceId: input.adjustmentKey,
        idempotencyKey: `adjustment:${input.adjustmentKey}`,
      });
      try {
        return await consumeReservation({
          owner: input.owner,
          reservationId: reservation.id,
          eventType: "ADJUSTMENT",
          reason: input.reason,
          audit: input.audit,
          auditStrict: input.auditStrict,
        });
      } catch (error) {
        if (input.audit) {
          try {
            await releaseReservation({ owner: input.owner, reservationId: reservation.id, reason: "Credit adjustment audit write failed" });
          } catch {
            // Preserve the original mutation/audit failure for the caller.
          }
        }
        throw error;
      }
    },
    async getBalance(owner) {
      const account = await ensureAccount(owner);
      const timestamp = now();
      const row = await first<{ availableUnits: number; reservedUnits: number }>(database, `SELECT
        COALESCE((SELECT SUM(g.available_units) FROM credit_grants g WHERE g.account_id = ? AND g.eligible_from <= ? AND (g.expires_at IS NULL OR g.expires_at > ?)), 0) AS availableUnits,
        COALESCE((SELECT SUM(a.held_units - a.consumed_units - a.released_units)
          FROM credit_reservation_allocations a JOIN credit_reservations r ON r.id = a.reservation_id JOIN credit_grants g ON g.id = a.grant_id
          WHERE r.account_id = ? AND r.status = 'RESERVED' AND g.eligible_from <= ? AND (g.expires_at IS NULL OR g.expires_at > ?)), 0) AS reservedUnits`, account.id, timestamp, timestamp, account.id, timestamp, timestamp);
      const availableUnits = Number(row?.availableUnits ?? 0);
      const reservedUnits = Number(row?.reservedUnits ?? 0);
      return { availableUnits, reservedUnits, totalUnits: availableUnits + reservedUnits };
    },
    async listHistory(owner, limit = 50) {
      const account = await ensureAccount(owner);
      const boundedLimit = Math.min(100, Math.max(1, Math.trunc(limit)));
      const historyRows = await rows<{
        id: string;
        eventType: CreditLedgerEventType;
        units: number;
        grantId: string | null;
        referenceType: string | null;
        referenceId: string | null;
        reason: string;
        effectiveAt: number;
        createdAt: number;
      }>(database, "SELECT id, event_type AS eventType, units, grant_id AS grantId, reference_type AS referenceType, reference_id AS referenceId, reason, effective_at AS effectiveAt, created_at AS createdAt FROM credit_ledger WHERE account_id = ? ORDER BY effective_at DESC, created_at DESC, id DESC LIMIT ?", account.id, boundedLimit);
      return historyRows.map((entry) => ({ ...entry, units: Number(entry.units), effectiveAt: Number(entry.effectiveAt), createdAt: Number(entry.createdAt) }));
    },
    reserveCredits,
    getReservation(owner, reservationId) {
      return getReservationRow(owner, reservationId);
    },
    getReservationByKey,
    consumeReservation,
    releaseReservation,
    expireReservation,
    expireGrant,
    rebuildGrantProjections,
  };
  return store;
}
