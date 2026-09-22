import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { createCreditStore } from "../lib/credits/repository";
import { createSqliteD1Database } from "../lib/sqlite-d1";
import type { AuditAppendInput } from "../lib/audit/types";

const repoRoot = join(import.meta.dirname, "..");

function fixture() {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec("PRAGMA foreign_keys = ON");
  for (const migration of [
    "0000_vengeful_ben_urich.sql",
    "0001_dynamic_tarot.sql",
    "0002_tarot_seed.sql",
    "0003_moonlight_spread_catalog.sql",
    "0004_member_auth.sql",
    "0004_reading_payload.sql",
    "0005_natarot_share_persistence.sql",
    "0006_credits_vip.sql",
    "0007_backend_completion.sql",
  ]) sqlite.exec(readFileSync(join(repoRoot, "drizzle", migration), "utf8"));
  return { sqlite, database: createSqliteD1Database(sqlite) };
}

const owner = { kind: "member" as const, ownerId: "member:owner-qa" };

function audit(input: { units: number; key: string; reason: string }): AuditAppendInput {
  return {
    actorKind: "member",
    actorId: "owner-qa-admin",
    action: "credits.adjusted",
    targetType: "member",
    targetId: "owner-qa",
    reason: input.reason,
    idempotencyKey: `admin.credits.adjust:${input.key}`,
    metadata: { units: input.units },
  };
}

test("audited credit adjustments preserve commercial ledger semantics and replay safely", async () => {
  const { sqlite, database } = fixture();
  const now = () => 1_000;
  const store = createCreditStore(database, now);
  await store.grantCredits({
    owner,
    source: "PURCHASE",
    units: 7,
    grantKey: "purchase:owner-qa",
    policyVersion: "commercial-v1",
    policySnapshot: { priceMinor: 15_000, units: 7 },
    reason: "owner QA purchase fixture",
  });

  const positiveInput = {
    owner,
    units: 3,
    adjustmentKey: "owner-qa-positive",
    eligibleFrom: 0,
    reason: "owner QA audited grant",
    audit: audit({ units: 3, key: "owner-qa-positive", reason: "owner QA audited grant" }),
  };
  const positive = await (store.adjustCredits as (input: typeof positiveInput) => Promise<{ id: string }>)(positiveInput);
  const positiveReplay = await (store.adjustCredits as (input: typeof positiveInput) => Promise<{ id: string }>)(positiveInput);
  assert.equal(positiveReplay.id, positive.id);

  const negativeInput = {
    owner,
    units: -2,
    adjustmentKey: "owner-qa-negative",
    reason: "owner QA audited correction",
    audit: audit({ units: -2, key: "owner-qa-negative", reason: "owner QA audited correction" }),
  };
  const negative = await (store.adjustCredits as (input: typeof negativeInput) => Promise<{ id: string }>)(negativeInput);
  const negativeReplay = await (store.adjustCredits as (input: typeof negativeInput) => Promise<{ id: string }>)(negativeInput);
  assert.equal(negativeReplay.id, negative.id);

  assert.deepEqual(await store.getBalance(owner), { availableUnits: 8, reservedUnits: 0, totalUnits: 8 });
  assert.equal((await database.prepare("SELECT COUNT(*) AS count FROM credit_ledger WHERE event_type='ADJUSTMENT'").first<{ count: number }>())?.count, 2);
  assert.equal((await database.prepare("SELECT COUNT(*) AS count FROM audit_events WHERE action='credits.adjusted'").first<{ count: number }>())?.count, 2);

  await database.prepare("UPDATE credit_grants SET available_units=0 WHERE account_id=(SELECT id FROM credit_accounts WHERE owner_kind='member' AND owner_id='member:owner-qa')").run();
  await store.rebuildGrantProjections(owner);
  assert.deepEqual(await store.getBalance(owner), { availableUnits: 8, reservedUnits: 0, totalUnits: 8 });
  sqlite.close();
});

test("required credit audits roll back positive and negative adjustments", async () => {
  const positiveFixture = fixture();
  const positiveStore = createCreditStore(positiveFixture.database, () => 1_000);
  await positiveStore.grantCredits({
    owner,
    source: "PURCHASE",
    units: 7,
    grantKey: "purchase:rollback-positive",
    policyVersion: "commercial-v1",
    policySnapshot: { priceMinor: 15_000, units: 7 },
    reason: "rollback fixture",
  });
  positiveFixture.sqlite.exec("CREATE TRIGGER fail_credit_audit BEFORE INSERT ON audit_events WHEN NEW.action='credits.adjusted' BEGIN SELECT RAISE(ABORT, 'audit unavailable'); END");
  const positiveInput = {
    owner,
    units: 3,
    adjustmentKey: "rollback-positive",
    eligibleFrom: 0,
    reason: "positive audit rollback",
    audit: audit({ units: 3, key: "rollback-positive", reason: "positive audit rollback" }),
    auditStrict: true,
  };
  await assert.rejects(() => (positiveStore.adjustCredits as (input: typeof positiveInput) => Promise<unknown>)(positiveInput));
  assert.deepEqual(await positiveStore.getBalance(owner), { availableUnits: 7, reservedUnits: 0, totalUnits: 7 });
  assert.equal((await positiveFixture.database.prepare("SELECT COUNT(*) AS count FROM credit_ledger WHERE event_type='ADJUSTMENT'").first<{ count: number }>())?.count, 0);
  assert.equal((await positiveFixture.database.prepare("SELECT COUNT(*) AS count FROM audit_events WHERE action='credits.adjusted'").first<{ count: number }>())?.count, 0);
  positiveFixture.sqlite.close();

  const negativeFixture = fixture();
  const negativeStore = createCreditStore(negativeFixture.database, () => 1_000);
  await negativeStore.grantCredits({
    owner,
    source: "PURCHASE",
    units: 7,
    grantKey: "purchase:rollback-negative",
    policyVersion: "commercial-v1",
    policySnapshot: { priceMinor: 15_000, units: 7 },
    reason: "rollback fixture",
  });
  negativeFixture.sqlite.exec("CREATE TRIGGER fail_credit_audit BEFORE INSERT ON audit_events WHEN NEW.action='credits.adjusted' BEGIN SELECT RAISE(ABORT, 'audit unavailable'); END");
  const negativeInput = {
    owner,
    units: -2,
    adjustmentKey: "rollback-negative",
    reason: "negative audit rollback",
    audit: audit({ units: -2, key: "rollback-negative", reason: "negative audit rollback" }),
    auditStrict: true,
  };
  await assert.rejects(() => (negativeStore.adjustCredits as (input: typeof negativeInput) => Promise<unknown>)(negativeInput));
  assert.deepEqual(await negativeStore.getBalance(owner), { availableUnits: 7, reservedUnits: 0, totalUnits: 7 });
  assert.equal((await negativeFixture.database.prepare("SELECT COUNT(*) AS count FROM credit_ledger WHERE event_type='ADJUSTMENT'").first<{ count: number }>())?.count, 0);
  assert.equal((await negativeFixture.database.prepare("SELECT COUNT(*) AS count FROM audit_events WHERE action='credits.adjusted'").first<{ count: number }>())?.count, 0);
  assert.equal((await negativeFixture.database.prepare("SELECT COUNT(*) AS count FROM credit_reservations WHERE status='RESERVED'").first<{ count: number }>())?.count, 0);
  negativeFixture.sqlite.close();
});
