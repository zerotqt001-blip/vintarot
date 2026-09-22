import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { DatabaseSync } from "node:sqlite";
import { mkdtempSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test, { type TestContext } from "node:test";
import type { D1Database } from "@cloudflare/workers-types";
import { createSqliteD1Database, type SqliteConnection } from "../lib/sqlite-d1";
import { createCreditStore, CreditInsufficientError, CreditIdempotencyError, type CreditStore } from "../lib/credits/repository";
import type { CreditOwner } from "../lib/credits/types";

const repoRoot = fileURLToPath(new URL("../", import.meta.url));

type Fixture = {
  database: D1Database;
  sqlite: DatabaseSync;
  store: CreditStore;
  now: { value: number };
};

function makeFixture(context: TestContext): Fixture {
  const directory = mkdtempSync(join(tmpdir(), "natarot-credits-repository-"));
  const dbPath = join(directory, "natarot.sqlite");
  execFileSync(process.execPath, ["scripts/node-migrate.mjs"], {
    cwd: repoRoot,
    env: { ...process.env, NATAROT_DB_PATH: dbPath },
    stdio: "pipe",
  });
  const sqlite = new DatabaseSync(dbPath);
  sqlite.exec("PRAGMA foreign_keys = ON;");
  const now = { value: 1_700_000_000_000 };
  const database = createSqliteD1Database(sqlite as unknown as SqliteConnection);
  const store = createCreditStore(database, () => now.value);
  context.after(() => {
    sqlite.close();
    rmSync(directory, { recursive: true, force: true });
  });
  return { database, sqlite, store, now };
}

const owner: CreditOwner = { kind: "member", ownerId: "member-credit-owner" };

async function grant(store: CreditStore, input: { key: string; units: number; expiresAt?: number | null; source?: "PURCHASE" | "REFUND" | "ADMIN" }) {
  return store.grantCredits({
    owner,
    source: input.source ?? "PURCHASE",
    units: input.units,
    grantKey: input.key,
    eligibleFrom: 1_700_000_000_000,
    expiresAt: input.expiresAt ?? null,
    policyVersion: "credits-v1",
    policySnapshot: { source: input.source ?? "PURCHASE" },
    reason: `test grant ${input.key}`,
  });
}

test("grantCredits is append-only and idempotent by grant key", async (context) => {
  const { store, sqlite } = makeFixture(context);
  const first = await grant(store, { key: "purchase:one", units: 5 });
  const duplicate = await grant(store, { key: "purchase:one", units: 5 });

  assert.equal(duplicate.id, first.id);
  assert.equal(duplicate.availableUnits, 5);
  assert.equal((sqlite.prepare("SELECT COUNT(*) AS count FROM credit_ledger").get() as { count: number }).count, 1);
  await assert.rejects(
    grant(store, { key: "purchase:one", units: 6 }),
    (error: unknown) => error instanceof CreditIdempotencyError,
  );
  assert.equal((sqlite.prepare("SELECT COUNT(*) AS count FROM credit_grants").get() as { count: number }).count, 1);
});

test("reserveCredits allocates earliest-expiring lots and consume closes the reservation", async (context) => {
  const { store, now } = makeFixture(context);
  const soon = await grant(store, { key: "soon", units: 2, expiresAt: now.value + 100 });
  const late = await grant(store, { key: "late", units: 5, expiresAt: now.value + 500 });

  const reservation = await store.reserveCredits({
    owner,
    units: 4,
    usageType: "TAROT_READING",
    resourceType: "reading_session",
    resourceId: "session-1",
    idempotencyKey: "tarot:session-1",
  });
  assert.equal(reservation.status, "RESERVED");
  assert.deepEqual(reservation.allocations.map(({ grantId, heldUnits }) => ({ grantId, heldUnits })), [
    { grantId: soon.id, heldUnits: 2 },
    { grantId: late.id, heldUnits: 2 },
  ]);
  assert.deepEqual(await store.getBalance(owner), { availableUnits: 3, reservedUnits: 4, totalUnits: 7 });

  const duplicate = await store.reserveCredits({
    owner,
    units: 4,
    usageType: "TAROT_READING",
    resourceType: "reading_session",
    resourceId: "session-1",
    idempotencyKey: "tarot:session-1",
  });
  assert.equal(duplicate.id, reservation.id);
  await assert.rejects(
    store.reserveCredits({
      owner,
      units: 3,
      usageType: "TAROT_READING",
      resourceType: "reading_session",
      resourceId: "session-1",
      idempotencyKey: "tarot:session-1",
    }),
    (error: unknown) => error instanceof CreditIdempotencyError,
  );

  const consumed = await store.consumeReservation({
    owner,
    reservationId: reservation.id,
    resultType: "tarot_reading",
    resultId: "reading-1",
  });
  assert.equal(consumed.status, "CONSUMED");
  assert.deepEqual(await store.getBalance(owner), { availableUnits: 3, reservedUnits: 0, totalUnits: 3 });
  assert.equal((await store.listHistory(owner, 20)).filter((entry) => entry.eventType === "CONSUME").reduce((sum, entry) => sum + entry.units, 0), -4);
});

test("release restores held lots without creating a consume ledger event", async (context) => {
  const { store } = makeFixture(context);
  await grant(store, { key: "releaseable", units: 3 });
  const reservation = await store.reserveCredits({
    owner,
    units: 3,
    usageType: "TAROT_READING",
    resourceType: "reading_session",
    resourceId: "session-release",
    idempotencyKey: "tarot:session-release",
  });
  await store.releaseReservation({ owner, reservationId: reservation.id, reason: "provider failed" });
  assert.deepEqual(await store.getBalance(owner), { availableUnits: 3, reservedUnits: 0, totalUnits: 3 });
  assert.deepEqual((await store.listHistory(owner, 20)).map((entry) => entry.eventType), ["GRANT"]);
});

test("two concurrent reservations cannot overspend one credit", async (context) => {
  const { store } = makeFixture(context);
  await grant(store, { key: "single", units: 1 });
  const results = await Promise.allSettled([
    store.reserveCredits({ owner, units: 1, usageType: "TAROT_READING", resourceType: "session", resourceId: "a", idempotencyKey: "tarot:a" }),
    store.reserveCredits({ owner, units: 1, usageType: "TAROT_READING", resourceType: "session", resourceId: "b", idempotencyKey: "tarot:b" }),
  ]);
  assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
  const rejected = results.find((result): result is PromiseRejectedResult => result.status === "rejected");
  assert.ok(rejected);
  assert.ok(rejected.reason instanceof CreditInsufficientError);
});

test("expiration excludes expired lots and is idempotent", async (context) => {
  const { store, now } = makeFixture(context);
  const expiring = await grant(store, { key: "expiring", units: 5, expiresAt: now.value + 10 });
  now.value += 11;
  assert.deepEqual(await store.getBalance(owner), { availableUnits: 0, reservedUnits: 0, totalUnits: 0 });
  assert.equal(await store.expireGrant({ owner, grantId: expiring.id }), 5);
  assert.equal(await store.expireGrant({ owner, grantId: expiring.id }), 0);
  assert.deepEqual((await store.listHistory(owner, 20)).map((entry) => ({ type: entry.eventType, units: entry.units })), [
    { type: "EXPIRATION", units: -5 },
    { type: "GRANT", units: 5 },
  ]);
});

test("rebuildGrantProjections repairs available units from ledger and active reservations", async (context) => {
  const { store, sqlite } = makeFixture(context);
  const grantRow = await grant(store, { key: "repairable", units: 5 });
  await store.reserveCredits({ owner, units: 2, usageType: "TAROT_READING", resourceType: "session", resourceId: "repair", idempotencyKey: "tarot:repair" });
  sqlite.prepare("UPDATE credit_grants SET available_units = 0 WHERE id = ?").run(grantRow.id);
  await store.rebuildGrantProjections(owner);
  assert.deepEqual(await store.getBalance(owner), { availableUnits: 3, reservedUnits: 2, totalUnits: 5 });
});

test("refunds and signed adjustments remain idempotent ledger events", async (context) => {
  const { store } = makeFixture(context);
  await grant(store, { key: "adjustment-base", units: 5 });
  await store.refundCredits({
    owner,
    units: 2,
    grantKey: "refund:one",
    policyVersion: "credits-v1",
    policySnapshot: { reason: "refund" },
    reason: "Refunded test order",
  });
  await store.adjustCredits({ owner, units: 3, adjustmentKey: "manual-positive", reason: "Manual correction" });
  await store.adjustCredits({ owner, units: -4, adjustmentKey: "manual-negative", reason: "Manual correction" });
  await store.adjustCredits({ owner, units: -4, adjustmentKey: "manual-negative", reason: "Manual correction" });
  assert.deepEqual(await store.getBalance(owner), { availableUnits: 6, reservedUnits: 0, totalUnits: 6 });
  assert.deepEqual((await store.listHistory(owner, 20)).map((entry) => ({ type: entry.eventType, units: entry.units })), [
    { type: "ADJUSTMENT", units: -4 },
    { type: "REFUND", units: 2 },
    { type: "ADJUSTMENT", units: 3 },
    { type: "GRANT", units: 5 },
  ]);
});

test("expired reservation leases restore held credits without a consume event", async (context) => {
  const { store, now } = makeFixture(context);
  await grant(store, { key: "lease-credit", units: 2 });
  const reservation = await store.reserveCredits({
    owner,
    units: 2,
    usageType: "TAROT_READING",
    resourceType: "session",
    resourceId: "lease-session",
    idempotencyKey: "tarot:lease-session",
    leaseExpiresAt: now.value + 10,
  });
  now.value += 11;
  const expired = await store.expireReservation({ owner, reservationId: reservation.id });
  assert.equal(expired.status, "EXPIRED");
  assert.deepEqual(await store.getBalance(owner), { availableUnits: 2, reservedUnits: 0, totalUnits: 2 });
  assert.deepEqual((await store.listHistory(owner, 20)).map((entry) => entry.eventType), ["GRANT"]);
});
