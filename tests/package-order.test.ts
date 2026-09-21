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
import { createCreditStore, CreditIdempotencyError, type CreditStore } from "../lib/credits/repository";
import type { CreditOwner } from "../lib/credits/types";
import {
  createPendingOrder,
  fulfillOrder,
  getOrderForOwner,
  recordVerifiedPayment,
} from "../lib/orders";
import { expireEntitlements, getActiveEntitlements } from "../lib/entitlements";
import { listActivePackageVersions } from "../lib/packages/catalog";
import type { PackageBenefitSnapshot } from "../lib/packages/types";

const repoRoot = fileURLToPath(new URL("../", import.meta.url));
const owner: CreditOwner = { kind: "member", ownerId: "member-package-owner" };

type Fixture = {
  database: D1Database;
  sqlite: DatabaseSync;
  store: CreditStore;
  now: { value: number };
};

function makeFixture(context: TestContext): Fixture {
  const directory = mkdtempSync(join(tmpdir(), "natarot-package-order-"));
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

const benefitSnapshot: PackageBenefitSnapshot = {
  credits: { units: 10 },
  vip: {
    durationSeconds: 86_400,
    benefitVersion: "vip-v1",
    benefits: { premiumSpreads: true, dailyBonus: 1 },
  },
};

function seedPackage(sqlite: DatabaseSync, now: number, overrides: { id?: string; active?: number; version?: number; status?: string; startsAt?: number; endsAt?: number | null; amountMinor?: number; creditUnits?: number; vipDurationSeconds?: number | null } = {}) {
  const packageId = overrides.id ?? "package-starter";
  const version = overrides.version ?? 1;
  const versionId = `${packageId}-v${version}`;
  sqlite.prepare("INSERT INTO packages (id, slug, name_en, name_vi, active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .run(packageId, packageId, "Starter", "Gói khởi đầu", overrides.active ?? 1, now, now);
  sqlite.prepare("INSERT INTO package_versions (id, package_id, version, amount_minor, currency, credit_units, vip_duration_seconds, benefit_snapshot, policy_version, status, starts_at, ends_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
    .run(versionId, packageId, version, overrides.amountMinor ?? 9900, "VND", overrides.creditUnits ?? 10, overrides.vipDurationSeconds ?? 86_400, JSON.stringify(benefitSnapshot), "packages-v1", overrides.status ?? "active", overrides.startsAt ?? now - 1, overrides.endsAt ?? null, now);
  return { packageId, versionId };
}

test("active package catalog is server-filtered and versioned", async (context) => {
  const { database, sqlite, now } = makeFixture(context);
  const active = seedPackage(sqlite, now.value, { id: "package-active" });
  seedPackage(sqlite, now.value, { id: "package-inactive", active: 0 });
  seedPackage(sqlite, now.value, { id: "package-future", startsAt: now.value + 100 });
  seedPackage(sqlite, now.value, { id: "package-expired", startsAt: now.value - 100, endsAt: now.value - 1 });
  const catalog = await listActivePackageVersions(database, now.value);
  assert.deepEqual(catalog.map((item) => item.id), [active.versionId]);
  assert.equal(catalog[0]?.amountMinor, 9900);
  assert.deepEqual(catalog[0]?.benefitSnapshot, benefitSnapshot);
});

test("pending orders snapshot the selected package and enforce owner/idempotency boundaries", async (context) => {
  const { database, sqlite, store, now } = makeFixture(context);
  const seeded = seedPackage(sqlite, now.value);
  const alternate = seedPackage(sqlite, now.value, { id: "package-alternate", amountMinor: 19900 });
  const first = await createPendingOrder({ database, creditStore: store, owner, packageVersionId: seeded.versionId, idempotencyKey: "checkout:one", now: () => now.value });
  const duplicate = await createPendingOrder({ database, creditStore: store, owner, packageVersionId: seeded.versionId, idempotencyKey: "checkout:one", now: () => now.value });
  assert.equal(duplicate.id, first.id);
  await assert.rejects(
    createPendingOrder({ database, creditStore: store, owner, packageVersionId: "missing", idempotencyKey: "checkout:missing", now: () => now.value }),
    /package/i,
  );
  await assert.rejects(
    createPendingOrder({ database, creditStore: store, owner, packageVersionId: alternate.versionId, idempotencyKey: "checkout:one", now: () => now.value + 1 }),
    (error: unknown) => error instanceof CreditIdempotencyError,
  );
  const foreign = await getOrderForOwner(database, { kind: "member", ownerId: "member-other" }, first.id);
  assert.equal(foreign, null);
  sqlite.prepare("UPDATE package_versions SET amount_minor = 123456 WHERE id = ?").run(seeded.versionId);
  const stored = await getOrderForOwner(database, owner, first.id);
  assert.equal(stored?.amountMinor, 9900);
});

test("fulfillment is payment-boundary gated, grants credits/VIP once, and is replay safe", async (context) => {
  const { database, sqlite, store, now } = makeFixture(context);
  const seeded = seedPackage(sqlite, now.value);
  const order = await createPendingOrder({ database, creditStore: store, owner, packageVersionId: seeded.versionId, idempotencyKey: "checkout:fulfill", now: () => now.value });
  await assert.rejects(fulfillOrder({ database, creditStore: store, orderId: order.id, now: () => now.value }), /payment/i);
  await recordVerifiedPayment(database, { orderId: order.id, paymentReference: "verified-payment-1", verifiedAt: now.value });
  const fulfilled = await fulfillOrder({ database, creditStore: store, orderId: order.id, now: () => now.value });
  const replay = await fulfillOrder({ database, creditStore: store, orderId: order.id, now: () => now.value + 1 });
  assert.equal(fulfilled.order.status, "FULFILLED");
  assert.deepEqual(replay.fulfillment, fulfilled.fulfillment);
  assert.deepEqual(await store.getBalance(owner), { availableUnits: 10, reservedUnits: 0, totalUnits: 10 });
  assert.equal((await getActiveEntitlements(database, owner, now.value)).length, 1);
  assert.equal((sqlite.prepare("SELECT COUNT(*) AS count FROM order_fulfillments").get() as { count: number }).count, 1);
  assert.equal((sqlite.prepare("SELECT COUNT(*) AS count FROM commercial_events WHERE event_type = 'ORDER_FULFILLED'").get() as { count: number }).count, 1);
  await assert.rejects(
    recordVerifiedPayment(database, { orderId: order.id, paymentReference: "different-payment", verifiedAt: now.value }),
    /payment/i,
  );
});

test("VIP entitlement expiry is explicit and does not mutate package or payment state", async (context) => {
  const { database, sqlite, store, now } = makeFixture(context);
  const seeded = seedPackage(sqlite, now.value, { vipDurationSeconds: 10 });
  const order = await createPendingOrder({ database, creditStore: store, owner, packageVersionId: seeded.versionId, idempotencyKey: "checkout:expiry", now: () => now.value });
  await recordVerifiedPayment(database, { orderId: order.id, paymentReference: "verified-payment-expiry", verifiedAt: now.value });
  await fulfillOrder({ database, creditStore: store, orderId: order.id, now: () => now.value });
  now.value += 11_000;
  assert.equal((await getActiveEntitlements(database, owner, now.value)).length, 0);
  assert.equal(await expireEntitlements(database, owner, now.value), 1);
  assert.equal((sqlite.prepare("SELECT status FROM entitlements").get() as { status: string }).status, "EXPIRED");
});
