import type { D1Database } from "@cloudflare/workers-types";
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
  await database.prepare("INSERT OR IGNORE INTO credit_accounts (id, owner_kind, owner_id, mutation_version, mutation_token, created_at, updated_at) VALUES (?, ?, ?, 0, NULL, ?, ?)")
    .bind(accountId, input.owner.kind, input.owner.ownerId, timestamp, timestamp)
    .run();
  await database.prepare("INSERT OR IGNORE INTO entitlements (id, account_id, entitlement_type, benefit_version, starts_at, ends_at, status, source_type, source_id, grant_key, benefit_snapshot, created_at, updated_at, cancelled_at) VALUES (?, ?, ?, ?, ?, ?, 'ACTIVE', ?, ?, ?, ?, ?, ?, NULL)")
    .bind(entitlementId, accountId, input.entitlementType, input.benefitVersion, input.startsAt, input.endsAt, input.sourceType, input.sourceId, input.grantKey, benefitSnapshot, timestamp, timestamp)
    .run();
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
