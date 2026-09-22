import type { D1Database } from "@cloudflare/workers-types";
import { prepareAuditInsert } from "./audit/service";
import type { AuditAppendInput } from "./audit/types";
import { createRequestFingerprint } from "./credits/ledger";
import { creditAccountId, CreditIdempotencyError } from "./credits/repository";
import type { CreditOwner } from "./credits/types";

export type Entitlement = {
  id: string;
  accountId: string;
  entitlementType: string;
  benefitVersion: string;
  startsAt: number;
  endsAt: number | null;
  status: "PENDING" | "ACTIVE" | "EXPIRED" | "CANCELLED";
  sourceType: string;
  sourceId: string;
  grantKey: string;
  benefitSnapshot: string;
  createdAt: number;
  updatedAt: number;
  cancelledAt: number | null;
};

export type ActivateEntitlementInput = {
  owner: CreditOwner;
  entitlementType: string;
  benefitVersion: string;
  startsAt: number;
  endsAt: number | null;
  sourceType: string;
  sourceId: string;
  grantKey: string;
  benefitSnapshot: unknown;
  now?: number;
  audit?: AuditAppendInput;
};

type EntitlementRow = {
  id: string;
  accountId: string;
  entitlementType: string;
  benefitVersion: string;
  startsAt: number;
  endsAt: number | null;
  status: Entitlement["status"];
  sourceType: string;
  sourceId: string;
  grantKey: string;
  benefitSnapshot: string;
  createdAt: number;
  updatedAt: number;
  cancelledAt: number | null;
};

function mapEntitlement(row: EntitlementRow): Entitlement {
  return {
    ...row,
    startsAt: Number(row.startsAt),
    endsAt: row.endsAt === null ? null : Number(row.endsAt),
    createdAt: Number(row.createdAt),
    updatedAt: Number(row.updatedAt),
    cancelledAt: row.cancelledAt === null ? null : Number(row.cancelledAt),
  };
}

async function first<T>(database: D1Database, statement: string, ...values: unknown[]): Promise<T | null> {
  return (await database.prepare(statement).bind(...values).first<T>()) || null;
}

export async function activateEntitlement(database: D1Database, input: ActivateEntitlementInput): Promise<Entitlement> {
  const accountId = creditAccountId(input.owner);
  const timestamp = input.now ?? Date.now();
  const benefitSnapshot = typeof input.benefitSnapshot === "string" ? input.benefitSnapshot : createRequestFingerprint(input.benefitSnapshot);
  const entitlementId = `entitlement:${accountId}:${input.grantKey}`;
  const statements = [
    database.prepare("INSERT OR IGNORE INTO credit_accounts (id, owner_kind, owner_id, mutation_version, mutation_token, created_at, updated_at) VALUES (?, ?, ?, 0, NULL, ?, ?)")
      .bind(accountId, input.owner.kind, input.owner.ownerId, timestamp, timestamp),
    database.prepare("INSERT OR IGNORE INTO entitlements (id, account_id, entitlement_type, benefit_version, starts_at, ends_at, status, source_type, source_id, grant_key, benefit_snapshot, created_at, updated_at, cancelled_at) VALUES (?, ?, ?, ?, ?, ?, 'ACTIVE', ?, ?, ?, ?, ?, ?, NULL)")
      .bind(entitlementId, accountId, input.entitlementType, input.benefitVersion, input.startsAt, input.endsAt, input.sourceType, input.sourceId, input.grantKey, benefitSnapshot, timestamp, timestamp),
  ];
  if (input.audit) statements.push(prepareAuditInsert(database, input.audit, timestamp));
  await database.batch(statements);
  const row = await first<EntitlementRow>(database, "SELECT id, account_id AS accountId, entitlement_type AS entitlementType, benefit_version AS benefitVersion, starts_at AS startsAt, ends_at AS endsAt, status, source_type AS sourceType, source_id AS sourceId, grant_key AS grantKey, benefit_snapshot AS benefitSnapshot, created_at AS createdAt, updated_at AS updatedAt, cancelled_at AS cancelledAt FROM entitlements WHERE id = ? AND account_id = ?", entitlementId, accountId);
  if (!row) throw new Error("Entitlement was not persisted");
  const mapped = mapEntitlement(row);
  if (mapped.entitlementType !== input.entitlementType || mapped.benefitVersion !== input.benefitVersion || mapped.benefitSnapshot !== benefitSnapshot || mapped.startsAt !== input.startsAt || mapped.endsAt !== input.endsAt || mapped.sourceType !== input.sourceType || mapped.sourceId !== input.sourceId) {
    throw new CreditIdempotencyError(`Entitlement key ${input.grantKey} already belongs to a different entitlement`);
  }
  return mapped;
}

export async function getActiveEntitlements(database: D1Database, owner: CreditOwner, now = Date.now()): Promise<Entitlement[]> {
  const accountId = creditAccountId(owner);
  const result = await database.prepare("SELECT id, account_id AS accountId, entitlement_type AS entitlementType, benefit_version AS benefitVersion, starts_at AS startsAt, ends_at AS endsAt, status, source_type AS sourceType, source_id AS sourceId, grant_key AS grantKey, benefit_snapshot AS benefitSnapshot, created_at AS createdAt, updated_at AS updatedAt, cancelled_at AS cancelledAt FROM entitlements WHERE account_id = ? AND status = 'ACTIVE' AND starts_at <= ? AND (ends_at IS NULL OR ends_at > ?) ORDER BY starts_at, id").bind(accountId, now, now).all<EntitlementRow>();
  return result.results.map(mapEntitlement);
}

export async function expireEntitlements(database: D1Database, owner: CreditOwner, now = Date.now()): Promise<number> {
  const accountId = creditAccountId(owner);
  const result = await database.prepare("UPDATE entitlements SET status = 'EXPIRED', updated_at = ? WHERE account_id = ? AND status = 'ACTIVE' AND ends_at IS NOT NULL AND ends_at <= ?").bind(now, accountId, now).run();
  return Number(result.meta?.changes ?? 0);
}

export async function grantManualEntitlement(input: {
  database: D1Database;
  owner: CreditOwner;
  entitlementType: string;
  benefitVersion: string;
  startsAt: number;
  endsAt: number | null;
  benefitSnapshot: unknown;
  idempotencyKey: string;
  reason: string;
  actorId: string;
  now?: number;
}): Promise<Entitlement> {
  if (!input.reason.trim() || input.reason.length > 500 || !input.idempotencyKey.trim() || input.idempotencyKey.length > 200 || !input.actorId.trim()) {
    throw new Error("Invalid entitlement mutation");
  }
  const timestamp = input.now ?? Date.now();
  const grantKey = `admin-vip:${input.idempotencyKey}`;
  const entitlementId = `entitlement:${creditAccountId(input.owner)}:${grantKey}`;
  const entitlement = await activateEntitlement(input.database, {
    owner: input.owner,
    entitlementType: input.entitlementType,
    benefitVersion: input.benefitVersion,
    startsAt: input.startsAt,
    endsAt: input.endsAt,
    sourceType: "ADMIN",
    sourceId: input.actorId,
    grantKey,
    benefitSnapshot: input.benefitSnapshot,
    now: timestamp,
    audit: {
      actorKind: "member",
      actorId: input.actorId,
      action: "vip.granted",
      targetType: "entitlement",
      targetId: entitlementId,
      reason: input.reason,
      idempotencyKey: `admin.vip.grant:${input.idempotencyKey}`,
      metadata: { entitlementType: input.entitlementType, benefitVersion: input.benefitVersion },
    },
  });
  return entitlement;
}

export async function revokeEntitlement(input: { database: D1Database; owner: CreditOwner; entitlementId: string; reason: string; actorId: string; idempotencyKey: string; now?: number }): Promise<boolean> {
  if (!input.reason.trim() || input.reason.length > 500 || !input.idempotencyKey.trim() || input.idempotencyKey.length > 200 || !input.actorId.trim()) throw new Error("Invalid entitlement mutation");
  const accountId = creditAccountId(input.owner);
  const timestamp = input.now ?? Date.now();
  const audit: AuditAppendInput = {
    actorKind: "member",
    actorId: input.actorId,
    action: "vip.revoked",
    targetType: "entitlement",
    targetId: input.entitlementId,
    reason: input.reason,
    idempotencyKey: `admin.vip.revoke:${input.idempotencyKey}`,
    metadata: { ownerKind: input.owner.kind },
  };
  const results = await input.database.batch([
    input.database.prepare("UPDATE entitlements SET status='CANCELLED', cancelled_at=?, updated_at=? WHERE id=? AND account_id=? AND status IN ('PENDING', 'ACTIVE')").bind(timestamp, timestamp, input.entitlementId, accountId),
    prepareAuditInsert(input.database, audit, timestamp, { ignoreExisting: false, guardSql: "changes() > 0" }),
  ]);
  return Number(results[0]?.meta?.changes ?? 0) > 0;
}
