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
import { createCreditStore, type CreditStore } from "../lib/credits/repository";
import type { CreditOwner } from "../lib/credits/types";
import { createPendingOrder, fulfillOrder, recordVerifiedPayment } from "../lib/orders";
import type { PackageBenefitSnapshot } from "../lib/packages/types";

const repoRoot = fileURLToPath(new URL("../", import.meta.url));
const owner: CreditOwner = { kind: "member", ownerId: "member-commercial-validity" };
const validitySeconds = 30 * 24 * 60 * 60;

type Fixture = {
  database: D1Database;
  sqlite: DatabaseSync;
  store: CreditStore;
  now: { value: number };
};

function makeFixture(context: TestContext): Fixture {
  const directory = mkdtempSync(join(tmpdir(), "natarot-commercial-validity-"));
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

function seedCommercialPackage(sqlite: DatabaseSync, now: number, id: string, units: number, amountMinor: number) {
  const packageId = `package-${id}`;
  const versionId = `${packageId}-v1`;
  const benefitSnapshot: PackageBenefitSnapshot = {
    credits: { units, expiresInSeconds: validitySeconds, validityDays: 30 },
    catalog: { popular: units === 10 },
  };
  sqlite.prepare("INSERT INTO packages (id, slug, name_en, name_vi, active, created_at, updated_at) VALUES (?, ?, ?, ?, 1, ?, ?)")
    .run(packageId, id, `${units} Credit${units === 1 ? "" : "s"}`, `${units} Credit${units === 1 ? "" : "s"}`, now, now);
  sqlite.prepare("INSERT INTO package_versions (id, package_id, version, amount_minor, currency, credit_units, vip_duration_seconds, benefit_snapshot, policy_version, status, starts_at, ends_at, created_at) VALUES (?, ?, 1, ?, 'VND', ?, NULL, ?, 'commercial-catalog-v1', 'active', 0, NULL, ?)")
    .run(versionId, packageId, amountMinor, units, JSON.stringify(benefitSnapshot), now);
  return versionId;
}

test("paid Credit expiry starts at fulfillment and remains a separate immutable lot", async (context) => {
  const { database, sqlite, store, now } = makeFixture(context);
  const packageVersionId = seedCommercialPackage(sqlite, now.value, "credit-5", 5, 69_000);
  const order = await createPendingOrder({ database, creditStore: store, owner, packageVersionId, idempotencyKey: "checkout:five", now: () => now.value });
  assert.equal((sqlite.prepare("SELECT COUNT(*) AS count FROM credit_grants").get() as { count: number }).count, 0);

  const paymentConfirmedAt = now.value + 5_000;
  await recordVerifiedPayment(database, { orderId: order.id, paymentReference: "sepay:production:test-1", verifiedAt: paymentConfirmedAt });
  const fulfilledAt = paymentConfirmedAt + 17_000;
  now.value = fulfilledAt;
  const fulfilled = await fulfillOrder({ database, creditStore: store, orderId: order.id, now: () => now.value });
  const grant = sqlite.prepare("SELECT units, available_units AS availableUnits, eligible_from AS eligibleFrom, expires_at AS expiresAt, source FROM credit_grants WHERE source = 'PURCHASE'").get() as { units: number; availableUnits: number; eligibleFrom: number; expiresAt: number; source: string };

  assert.equal(fulfilled.order.status, "FULFILLED");
  assert.equal(fulfilled.order.fulfilledAt, fulfilledAt);
  assert.equal(fulfilled.order.fulfillmentStartedAt, fulfilledAt);
  assert.equal(fulfilled.order.packageSnapshot.amountMinor, 69_000);
  assert.equal(fulfilled.order.packageSnapshot.creditUnits, 5);
  assert.equal(fulfilled.order.packageSnapshot.benefitSnapshot.credits?.validityDays, 30);
  assert.equal(fulfilled.order.packageSnapshot.benefitSnapshot.credits?.expiresInSeconds, validitySeconds);
  assert.deepEqual({ ...grant }, { units: 5, availableUnits: 5, eligibleFrom: fulfilledAt, expiresAt: fulfilledAt + validitySeconds * 1000, source: "PURCHASE" });

  const replay = await fulfillOrder({ database, creditStore: store, orderId: order.id, now: () => fulfilledAt + 86_400_000 });
  assert.equal(replay.fulfillment.id, fulfilled.fulfillment.id);
  assert.equal((sqlite.prepare("SELECT COUNT(*) AS count FROM credit_grants WHERE source = 'PURCHASE'").get() as { count: number }).count, 1);

  const secondVersionId = seedCommercialPackage(sqlite, now.value, "credit-1", 1, 15_000);
  const secondOrder = await createPendingOrder({ database, creditStore: store, owner, packageVersionId: secondVersionId, idempotencyKey: "checkout:one" , now: () => now.value });
  await recordVerifiedPayment(database, { orderId: secondOrder.id, paymentReference: "sepay:production:test-2", verifiedAt: now.value });
  now.value += 1_000;
  await fulfillOrder({ database, creditStore: store, orderId: secondOrder.id, now: () => now.value });
  const purchaseLots = sqlite.prepare("SELECT units, expires_at AS expiresAt FROM credit_grants WHERE source = 'PURCHASE' ORDER BY created_at").all() as Array<{ units: number; expiresAt: number }>;
  assert.deepEqual(purchaseLots.map((lot) => ({ ...lot })), [
    { units: 5, expiresAt: fulfilledAt + validitySeconds * 1000 },
    { units: 1, expiresAt: now.value + validitySeconds * 1000 },
  ]);
});

test("owner QA credits remain non-commercial and expiration is auditable/idempotent", async (context) => {
  const { store, sqlite, now } = makeFixture(context);
  const qaGrant = await store.grantCredits({
    owner,
    source: "ADMIN",
    units: 100,
    grantKey: "owner-qa:credits",
    eligibleFrom: now.value,
    expiresAt: null,
    policyVersion: "owner-test-v1",
    policySnapshot: { ownerQa: true },
    reason: "Owner QA credits",
  });
  assert.equal(qaGrant.expiresAt, null);
  assert.equal(qaGrant.source, "ADMIN");

  const expiring = await store.grantCredits({
    owner,
    source: "PURCHASE",
    units: 1,
    grantKey: "purchase:expiring",
    eligibleFrom: now.value,
    expiresAt: now.value + 10,
    policyVersion: "commercial-catalog-v1",
    policySnapshot: { credits: { units: 1, expiresInSeconds: 10 } },
    reason: "Commercial purchase",
  });
  now.value += 11;
  assert.equal((await store.getBalance(owner)).availableUnits, 100);
  assert.equal(await store.expireGrant({ owner, grantId: expiring.id }), 1);
  assert.equal(await store.expireGrant({ owner, grantId: expiring.id }), 0);
  assert.equal((sqlite.prepare("SELECT COUNT(*) AS count FROM credit_ledger WHERE grant_id = ? AND event_type = 'EXPIRATION'").get(expiring.id) as { count: number }).count, 1);
  assert.equal((await store.getBalance(owner)).availableUnits, 100);
  assert.equal((sqlite.prepare("SELECT source, expires_at AS expiresAt FROM credit_grants WHERE id = ?").get(qaGrant.id) as { source: string; expiresAt: number | null }).expiresAt, null);
});
