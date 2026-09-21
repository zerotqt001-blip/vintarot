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
import { createPendingOrder } from "../lib/orders";
import { getActiveEntitlements } from "../lib/entitlements";
import type { PackageBenefitSnapshot } from "../lib/packages/types";
import { getSePayConfig, type NormalizedSePayIpn } from "../lib/commercial/sepay-adapter";
import {
  applyVerifiedSePayPayment,
  createSePayPaymentAttempt,
  reconcileSePayPayment,
} from "../lib/commercial/payment-service";

const repoRoot = fileURLToPath(new URL("../", import.meta.url));
const owner: CreditOwner = { kind: "member", ownerId: "member-sepay-owner" };
const config = getSePayConfig({
  SEPAY_ENVIRONMENT: "sandbox",
  SEPAY_MERCHANT_ID: "MERCHANT123",
  SEPAY_SECRET_KEY: "sandbox-secret",
  SEPAY_IPN_SECRET: "ipn-secret",
  NATAROT_PUBLIC_ORIGIN: "https://staging.natarot.com",
});
const benefitSnapshot: PackageBenefitSnapshot = {
  credits: { units: 10 },
  vip: { durationSeconds: 86_400, benefitVersion: "vip-v1", benefits: { premiumSpreads: true } },
};

type Fixture = {
  database: D1Database;
  sqlite: DatabaseSync;
  store: CreditStore;
  now: { value: number };
};

function makeFixture(context: TestContext): Fixture {
  const directory = mkdtempSync(join(tmpdir(), "natarot-sepay-payment-"));
  const dbPath = join(directory, "natarot.sqlite");
  execFileSync(process.execPath, ["scripts/node-migrate.mjs"], {
    cwd: repoRoot,
    env: { ...process.env, NATAROT_DB_PATH: dbPath },
    stdio: "pipe",
  });
  const sqlite = new DatabaseSync(dbPath);
  const now = { value: 1_758_456_000_000 };
  const database = createSqliteD1Database(sqlite as unknown as SqliteConnection);
  const store = createCreditStore(database, () => now.value);
  context.after(() => {
    sqlite.close();
    rmSync(directory, { recursive: true, force: true });
  });
  return { database, sqlite, store, now };
}

function seedPackage(sqlite: DatabaseSync, now: number, id: string): string {
  const versionId = `${id}-v1`;
  sqlite.prepare("INSERT INTO packages (id, slug, name_en, name_vi, active, created_at, updated_at) VALUES (?, ?, ?, ?, 1, ?, ?)")
    .run(id, id, "Starter", "Khởi đầu", now, now);
  sqlite.prepare("INSERT INTO package_versions (id, package_id, version, amount_minor, currency, credit_units, vip_duration_seconds, benefit_snapshot, policy_version, status, starts_at, ends_at, created_at) VALUES (?, ?, 1, 10000, 'VND', 10, 86400, ?, 'packages-v1', 'active', ?, NULL, ?)")
    .run(versionId, id, JSON.stringify(benefitSnapshot), now - 1, now);
  return versionId;
}

function evidence(overrides: Partial<NormalizedSePayIpn> = {}): NormalizedSePayIpn {
  return {
    providerOrderId: "provider-order-1",
    invoiceNumber: "NT-SEPAY-1",
    transactionId: "provider-transaction-1",
    notificationType: "ORDER_PAID",
    orderStatus: "CAPTURED",
    transactionStatus: "APPROVED",
    transactionType: "PAYMENT",
    amountMinor: 10000,
    currency: "VND",
    payloadHash: "payload-hash-1",
    providerTimestampMs: 1_758_456_000_000,
    ...overrides,
  };
}

async function createOrder(fixture: Fixture, packageId: string, key: string) {
  const versionId = seedPackage(fixture.sqlite, fixture.now.value, packageId);
  return createPendingOrder({ database: fixture.database, creditStore: fixture.store, owner, packageVersionId: versionId, idempotencyKey: key, now: () => fixture.now.value });
}

test("verified SePay payment confirms and fulfills the existing Credits/VIP order exactly once", async (context) => {
  const fixture = makeFixture(context);
  const order = await createOrder(fixture, "package-sepay", "checkout-sepay-1");
  const attempt = await createSePayPaymentAttempt({ database: fixture.database, config, order, invoiceNumber: "NT-SEPAY-1", requestFingerprint: "checkout-fingerprint-1", now: () => fixture.now.value });
  const duplicateAttempt = await createSePayPaymentAttempt({ database: fixture.database, config, order, invoiceNumber: "NT-SEPAY-1", requestFingerprint: "checkout-fingerprint-1", now: () => fixture.now.value });
  assert.equal(duplicateAttempt.id, attempt.id);

  const first = await applyVerifiedSePayPayment({ database: fixture.database, creditStore: fixture.store, config, evidence: evidence(), now: () => fixture.now.value });
  const replay = await applyVerifiedSePayPayment({ database: fixture.database, creditStore: fixture.store, config, evidence: evidence(), now: () => fixture.now.value + 1 });
  assert.equal(first.order.status, "FULFILLED");
  assert.equal(replay.order.status, "FULFILLED");
  assert.equal(first.eventId, replay.eventId);
  assert.equal(first.fulfillment?.paymentEventId, first.eventId);
  assert.deepEqual(await fixture.store.getBalance(owner), { availableUnits: 10, reservedUnits: 0, totalUnits: 10 });
  assert.equal((await getActiveEntitlements(fixture.database, owner, fixture.now.value)).length, 1);
  assert.equal((fixture.sqlite.prepare("SELECT COUNT(*) AS count FROM commercial_payment_events").get() as { count: number }).count, 1);
  assert.equal((fixture.sqlite.prepare("SELECT COUNT(*) AS count FROM order_fulfillments").get() as { count: number }).count, 1);
  assert.equal((fixture.sqlite.prepare("SELECT COUNT(*) AS count FROM credit_grants WHERE grant_key = ?").get(`order:${order.id}:credits`) as { count: number }).count, 1);
});

test("amount mismatch is rejected before any payment event or benefit mutation", async (context) => {
  const fixture = makeFixture(context);
  const order = await createOrder(fixture, "package-sepay-mismatch", "checkout-sepay-mismatch");
  await createSePayPaymentAttempt({ database: fixture.database, config, order, invoiceNumber: "NT-SEPAY-MISMATCH", requestFingerprint: "checkout-fingerprint-mismatch", now: () => fixture.now.value });
  await assert.rejects(
    applyVerifiedSePayPayment({ database: fixture.database, creditStore: fixture.store, config, evidence: evidence({ invoiceNumber: "NT-SEPAY-MISMATCH", amountMinor: 9999, transactionId: "provider-transaction-mismatch" }), now: () => fixture.now.value }),
    (error: unknown) => error instanceof Error && "code" in error && (error as { code: string }).code === "amount_mismatch",
  );
  assert.equal((fixture.sqlite.prepare("SELECT status FROM orders WHERE id = ?").get(order.id) as { status: string }).status, "PENDING");
  assert.deepEqual(await fixture.store.getBalance(owner), { availableUnits: 0, reservedUnits: 0, totalUnits: 0 });
  assert.equal((fixture.sqlite.prepare("SELECT COUNT(*) AS count FROM commercial_payment_events").get() as { count: number }).count, 0);
});

test("concurrent duplicate callbacks converge to one event, fulfillment, grant, and entitlement", async (context) => {
  const fixture = makeFixture(context);
  const order = await createOrder(fixture, "package-sepay-concurrent", "checkout-sepay-concurrent");
  await createSePayPaymentAttempt({ database: fixture.database, config, order, invoiceNumber: "NT-SEPAY-CONCURRENT", requestFingerprint: "checkout-fingerprint-concurrent", now: () => fixture.now.value });
  const [first, second] = await Promise.all([
    applyVerifiedSePayPayment({ database: fixture.database, creditStore: fixture.store, config, evidence: evidence({ invoiceNumber: "NT-SEPAY-CONCURRENT", providerOrderId: "provider-order-concurrent", transactionId: "provider-transaction-concurrent", payloadHash: "payload-concurrent" }), now: () => fixture.now.value }),
    applyVerifiedSePayPayment({ database: fixture.database, creditStore: fixture.store, config, evidence: evidence({ invoiceNumber: "NT-SEPAY-CONCURRENT", providerOrderId: "provider-order-concurrent", transactionId: "provider-transaction-concurrent", payloadHash: "payload-concurrent" }), now: () => fixture.now.value }),
  ]);
  assert.equal(first.eventId, second.eventId);
  assert.equal((fixture.sqlite.prepare("SELECT COUNT(*) AS count FROM commercial_payment_events").get() as { count: number }).count, 1);
  assert.equal((fixture.sqlite.prepare("SELECT COUNT(*) AS count FROM order_fulfillments").get() as { count: number }).count, 1);
  assert.equal((fixture.sqlite.prepare("SELECT COUNT(*) AS count FROM credit_grants WHERE grant_key = ?").get(`order:${order.id}:credits`) as { count: number }).count, 1);
  assert.equal((await getActiveEntitlements(fixture.database, owner, fixture.now.value)).length, 1);
});

test("provider transaction cannot be reused for a different order", async (context) => {
  const fixture = makeFixture(context);
  const firstOrder = await createOrder(fixture, "package-sepay-first", "checkout-sepay-first");
  const secondOrder = await createOrder(fixture, "package-sepay-second", "checkout-sepay-second");
  await createSePayPaymentAttempt({ database: fixture.database, config, order: firstOrder, invoiceNumber: "NT-SEPAY-FIRST", requestFingerprint: "checkout-fingerprint-first", now: () => fixture.now.value });
  await createSePayPaymentAttempt({ database: fixture.database, config, order: secondOrder, invoiceNumber: "NT-SEPAY-SECOND", requestFingerprint: "checkout-fingerprint-second", now: () => fixture.now.value });
  await applyVerifiedSePayPayment({ database: fixture.database, creditStore: fixture.store, config, evidence: evidence({ invoiceNumber: "NT-SEPAY-FIRST", transactionId: "provider-transaction-reused" }), now: () => fixture.now.value });
  await assert.rejects(
    applyVerifiedSePayPayment({ database: fixture.database, creditStore: fixture.store, config, evidence: evidence({ invoiceNumber: "NT-SEPAY-SECOND", transactionId: "provider-transaction-reused" }), now: () => fixture.now.value }),
    (error: unknown) => error instanceof Error && "code" in error && (error as { code: string }).code === "provider_transaction_conflict",
  );
  assert.equal((fixture.sqlite.prepare("SELECT status FROM orders WHERE id = ?").get(secondOrder.id) as { status: string }).status, "PENDING");
  assert.equal((fixture.sqlite.prepare("SELECT COUNT(*) AS count FROM commercial_payment_events").get() as { count: number }).count, 1);
});

test("reconciliation resolves provider order detail and converges through the same fulfillment boundary", async (context) => {
  const fixture = makeFixture(context);
  const order = await createOrder(fixture, "package-sepay-reconcile", "checkout-sepay-reconcile");
  await createSePayPaymentAttempt({ database: fixture.database, config, order, invoiceNumber: "NT-SEPAY-RECONCILE", requestFingerprint: "checkout-fingerprint-reconcile", now: () => fixture.now.value });
  const calls: string[] = [];
  const fetchImpl: typeof fetch = async (input) => {
    const url = String(input);
    calls.push(url);
    if (url.includes("/v1/order?") || url.includes("/v1/order%3F")) {
      return new Response(JSON.stringify({ data: [{ id: "provider-order-reconcile", order_id: "provider-order-reconcile", order_invoice_number: "NT-SEPAY-RECONCILE" }] }), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    return new Response(JSON.stringify({ data: {
      id: "provider-order-reconcile",
      order_id: "provider-order-reconcile",
      order_status: "CAPTURED",
      order_currency: "VND",
      order_amount: "10000",
      order_invoice_number: "NT-SEPAY-RECONCILE",
      transactions: [{ id: "provider-transaction-reconcile", transaction_id: "provider-transaction-reconcile", transaction_type: "PAYMENT", transaction_status: "APPROVED", transaction_amount: "10000", transaction_currency: "VND" }],
    } }), { status: 200, headers: { "Content-Type": "application/json" } });
  };
  const result = await reconcileSePayPayment({ database: fixture.database, creditStore: fixture.store, config, orderId: order.id, fetchImpl, now: () => fixture.now.value });
  assert.equal(result.status, "FULFILLED");
  assert.ok(calls.some((url) => url.includes("/v1/order?")));
  assert.ok(calls.some((url) => url.includes("/v1/order/detail/provider-order-reconcile")));
  assert.equal((fixture.sqlite.prepare("SELECT provider_order_id FROM commercial_payment_attempts WHERE order_id = ?").get(order.id) as { provider_order_id: string }).provider_order_id, "provider-order-reconcile");
  assert.equal((fixture.sqlite.prepare("SELECT COUNT(*) AS count FROM commercial_payment_events").get() as { count: number }).count, 1);
});

test("reconciliation keeps a non-captured provider order pending", async (context) => {
  const fixture = makeFixture(context);
  const order = await createOrder(fixture, "package-sepay-pending", "checkout-sepay-pending");
  await createSePayPaymentAttempt({ database: fixture.database, config, order, invoiceNumber: "NT-SEPAY-PENDING", requestFingerprint: "checkout-fingerprint-pending", now: () => fixture.now.value });
  const fetchImpl: typeof fetch = async (input) => {
    const url = String(input);
    if (url.includes("/v1/order?")) return new Response(JSON.stringify({ data: [{ id: "provider-order-pending", order_invoice_number: "NT-SEPAY-PENDING" }] }), { status: 200 });
    return new Response(JSON.stringify({ data: { id: "provider-order-pending", order_id: "provider-order-pending", order_status: "PENDING", order_currency: "VND", order_amount: "10000", order_invoice_number: "NT-SEPAY-PENDING", transactions: [] } }), { status: 200 });
  };
  const result = await reconcileSePayPayment({ database: fixture.database, creditStore: fixture.store, config, orderId: order.id, fetchImpl, now: () => fixture.now.value });
  assert.equal(result.status, "PENDING");
  assert.equal((fixture.sqlite.prepare("SELECT status FROM orders WHERE id = ?").get(order.id) as { status: string }).status, "PENDING");
  assert.equal((fixture.sqlite.prepare("SELECT COUNT(*) AS count FROM commercial_payment_events").get() as { count: number }).count, 0);
});
