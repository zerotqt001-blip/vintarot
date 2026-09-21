import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { DatabaseSync } from "node:sqlite";
import { mkdtempSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test, { type TestContext } from "node:test";
import { createSqliteD1Database, type SqliteConnection } from "../lib/sqlite-d1";
import { createCreditStore } from "../lib/credits/repository";
import type { CreditOwner } from "../lib/credits/types";
import { getSePayConfig } from "../lib/commercial/sepay-adapter";
import {
  handleCommercialCheckout,
  handleCommercialReturn,
  handleCommercialReconcile,
  handleSePayIpn,
} from "../lib/commercial/http-handlers";

const repoRoot = fileURLToPath(new URL("../", import.meta.url));
const owner: CreditOwner = { kind: "member", ownerId: "member-http-owner" };
const foreignOwner: CreditOwner = { kind: "member", ownerId: "member-http-foreign" };
const config = getSePayConfig({
  SEPAY_ENVIRONMENT: "sandbox",
  SEPAY_MERCHANT_ID: "MERCHANT123",
  SEPAY_SECRET_KEY: "sandbox-secret",
  SEPAY_IPN_SECRET: "ipn-secret",
  NATAROT_PUBLIC_ORIGIN: "https://staging.natarot.com",
});

function makeFixture(context: TestContext) {
  const directory = mkdtempSync(join(tmpdir(), "natarot-sepay-http-"));
  const dbPath = join(directory, "natarot.sqlite");
  execFileSync(process.execPath, ["scripts/node-migrate.mjs"], { cwd: repoRoot, env: { ...process.env, NATAROT_DB_PATH: dbPath }, stdio: "pipe" });
  const sqlite = new DatabaseSync(dbPath);
  const now = { value: 1_758_456_000_000 };
  const database = createSqliteD1Database(sqlite as unknown as SqliteConnection);
  const creditStore = createCreditStore(database, () => now.value);
  sqlite.prepare("INSERT INTO packages (id, slug, name_en, name_vi, active, created_at, updated_at) VALUES (?, ?, ?, ?, 1, ?, ?)").run("package-http", "http-starter", "Starter", "Khởi đầu", now.value, now.value);
  sqlite.prepare("INSERT INTO package_versions (id, package_id, version, amount_minor, currency, credit_units, vip_duration_seconds, benefit_snapshot, policy_version, status, starts_at, ends_at, created_at) VALUES (?, ?, 1, 10000, 'VND', 10, 86400, ?, 'packages-v1', 'active', ?, NULL, ?)").run("package-http-v1", "package-http", JSON.stringify({ credits: { units: 10 }, vip: { durationSeconds: 86400, benefitVersion: "vip-v1", benefits: {} } }), now.value - 1, now.value);
  context.after(() => {
    sqlite.close();
    rmSync(directory, { recursive: true, force: true });
  });
  return { database, sqlite, creditStore, now };
}

function deps(fixture: ReturnType<typeof makeFixture>, requestOwner: CreditOwner | null = owner) {
  return { database: fixture.database, creditStore: fixture.creditStore, config, owner: requestOwner, now: () => fixture.now.value };
}

function checkoutRequest(body: unknown): Request {
  return new Request("https://staging.natarot.com/api/commercial/checkout", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
}

test("checkout is member-only, server-priced, and idempotent", async (context) => {
  const fixture = makeFixture(context);
  const body = { package_version_id: "package-http-v1", idempotency_key: "http-checkout-1", amount_minor: 1, credit_units: 999, vip_duration_seconds: 1 };
  const unauthenticated = await handleCommercialCheckout(checkoutRequest(body), deps(fixture, null));
  assert.equal(unauthenticated.status, 401);
  const first = await handleCommercialCheckout(checkoutRequest(body), deps(fixture));
  const duplicate = await handleCommercialCheckout(checkoutRequest(body), deps(fixture));
  assert.equal(first.status, 201);
  assert.equal(duplicate.status, 201);
  const firstBody = await first.json() as { order: { id: string; amount_minor: number; currency: string }; checkout: { fields: { order_amount: string; order_invoice_number: string; signature: string } } };
  const duplicateBody = await duplicate.json() as { order: { id: string }; checkout: { fields: { order_invoice_number: string } } };
  assert.equal(firstBody.order.amount_minor, 10000);
  assert.equal(firstBody.order.currency, "VND");
  assert.equal(firstBody.checkout.fields.order_amount, "10000");
  assert.ok(firstBody.checkout.fields.signature);
  assert.equal(duplicateBody.order.id, firstBody.order.id);
  assert.equal(duplicateBody.checkout.fields.order_invoice_number, firstBody.checkout.fields.order_invoice_number);
  assert.equal((fixture.sqlite.prepare("SELECT COUNT(*) AS count FROM orders").get() as { count: number }).count, 1);
});

test("return is owner-scoped and display-only", async (context) => {
  const fixture = makeFixture(context);
  const checkout = await handleCommercialCheckout(checkoutRequest({ package_version_id: "package-http-v1", idempotency_key: "http-return-1" }), deps(fixture));
  const checkoutBody = await checkout.json() as { order: { id: string }; checkout: { fields: { order_invoice_number: string } } };
  const foreign = await handleCommercialReturn(new Request(`https://staging.natarot.com/api/commercial/return?natarot_order_id=${encodeURIComponent(checkoutBody.order.id)}&result=success`), deps(fixture, foreignOwner));
  assert.equal(foreign.status, 404);
  const returned = await handleCommercialReturn(new Request(`https://staging.natarot.com/api/commercial/return?natarot_order_id=${encodeURIComponent(checkoutBody.order.id)}&result=success&sepay_order_id=provider-order-hint`), deps(fixture));
  assert.equal(returned.status, 200);
  const body = await returned.json() as { display_only: boolean; order: { status: string } };
  assert.equal(body.display_only, true);
  assert.equal(body.order.status, "PENDING");
  assert.equal((fixture.sqlite.prepare("SELECT COUNT(*) AS count FROM commercial_payment_events").get() as { count: number }).count, 0);
});

test("authenticated IPN applies only verified evidence and is replay-safe", async (context) => {
  const fixture = makeFixture(context);
  const checkout = await handleCommercialCheckout(checkoutRequest({ package_version_id: "package-http-v1", idempotency_key: "http-ipn-1" }), deps(fixture));
  const checkoutBody = await checkout.json() as { order: { id: string }; checkout: { fields: { order_invoice_number: string } } };
  const body = JSON.stringify({
    timestamp: new Date(fixture.now.value).toISOString(),
    notification_type: "ORDER_PAID",
    order: { id: "provider-order-http", order_id: "provider-order-http", order_status: "CAPTURED", order_currency: "VND", order_amount: "10000", order_invoice_number: checkoutBody.checkout.fields.order_invoice_number },
    transaction: { id: "provider-tx-http", transaction_id: "provider-tx-http", transaction_type: "PAYMENT", transaction_status: "APPROVED", transaction_amount: "10000", transaction_currency: "VND" },
  });
  const forged = await handleSePayIpn(new Request("https://staging.natarot.com/api/commercial/sepay/ipn", { method: "POST", body, headers: { "content-type": "application/json", "x-secret-key": "wrong" } }), deps(fixture));
  assert.equal(forged.status, 401);
  const accepted = await handleSePayIpn(new Request("https://staging.natarot.com/api/commercial/sepay/ipn", { method: "POST", body, headers: { "content-type": "application/json", "x-secret-key": "ipn-secret" } }), deps(fixture));
  const replay = await handleSePayIpn(new Request("https://staging.natarot.com/api/commercial/sepay/ipn", { method: "POST", body, headers: { "content-type": "application/json", "x-secret-key": "ipn-secret" } }), deps(fixture));
  assert.equal(accepted.status, 200);
  assert.equal(replay.status, 200);
  assert.equal((fixture.sqlite.prepare("SELECT COUNT(*) AS count FROM commercial_payment_events").get() as { count: number }).count, 1);
  assert.equal((fixture.sqlite.prepare("SELECT COUNT(*) AS count FROM order_fulfillments").get() as { count: number }).count, 1);
});

test("reconcile route is owner-scoped before calling provider", async (context) => {
  const fixture = makeFixture(context);
  const checkout = await handleCommercialCheckout(checkoutRequest({ package_version_id: "package-http-v1", idempotency_key: "http-reconcile-1" }), deps(fixture));
  const checkoutBody = await checkout.json() as { order: { id: string } };
  let called = false;
  const foreign = await handleCommercialReconcile(new Request("https://staging.natarot.com/api/commercial/orders/foreign/reconcile", { method: "POST" }), { ...deps(fixture, foreignOwner), fetchImpl: async () => { called = true; return new Response("{}", { status: 200 }); } });
  assert.equal(foreign.status, 404);
  assert.equal(called, false);
  const own = await handleCommercialReconcile(new Request(`https://staging.natarot.com/api/commercial/orders/${encodeURIComponent(checkoutBody.order.id)}/reconcile`, { method: "POST" }), { ...deps(fixture), fetchImpl: async () => new Response(JSON.stringify({ data: [] }), { status: 200 }) });
  assert.equal(own.status, 200);
});
