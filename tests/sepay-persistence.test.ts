import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { DatabaseSync } from "node:sqlite";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import test from "node:test";

const repoRoot = fileURLToPath(new URL("../", import.meta.url));

function fixture(t: { after(callback: () => void): void }) {
  const directory = mkdtempSync(join(tmpdir(), "natarot-sepay-persistence-"));
  const dbPath = join(directory, "natarot.sqlite");
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  execFileSync(process.execPath, ["scripts/node-migrate.mjs"], {
    cwd: repoRoot,
    env: { ...process.env, NATAROT_DB_PATH: dbPath },
    stdio: "pipe",
  });
  const sqlite = new DatabaseSync(dbPath);
  t.after(() => sqlite.close());
  return sqlite;
}

function seedOrder(sqlite: DatabaseSync): void {
  sqlite.prepare("INSERT INTO credit_accounts (id, owner_kind, owner_id, mutation_version, created_at, updated_at) VALUES (?, ?, ?, 0, ?, ?)")
    .run("credit-account:member:member-1", "member", "member-1", 1, 1);
  sqlite.prepare("INSERT INTO packages (id, slug, name_en, name_vi, active, created_at, updated_at) VALUES (?, ?, ?, ?, 1, ?, ?)")
    .run("package-1", "starter", "Starter", "Khởi đầu", 1, 1);
  sqlite.prepare("INSERT INTO package_versions (id, package_id, version, amount_minor, currency, credit_units, vip_duration_seconds, benefit_snapshot, policy_version, status, starts_at, ends_at, created_at) VALUES (?, ?, 1, ?, 'VND', 10, NULL, ?, 'v1', 'active', ?, NULL, ?)")
    .run("package-version-1", "package-1", 10000, JSON.stringify({ credits: { units: 10 } }), 1, 1);
  sqlite.prepare("INSERT INTO orders (id, account_id, package_id, package_version_id, package_snapshot, amount_minor, currency, status, idempotency_key, request_fingerprint, payment_reference, created_at) VALUES (?, ?, ?, ?, ?, ?, 'VND', 'PENDING', ?, ?, NULL, ?)")
    .run("order-1", "credit-account:member:member-1", "package-1", "package-version-1", JSON.stringify({ id: "package-version-1", packageId: "package-1", slug: "starter", version: 1, amountMinor: 10000, currency: "VND", creditUnits: 10, vipDurationSeconds: null, benefitSnapshot: { credits: { units: 10 } }, policyVersion: "v1" }), 10000, "idempotency-1", "fingerprint-1", 1);
}

test("SePay persistence enforces one attempt per order and invoice", (t) => {
  const sqlite = fixture(t);
  seedOrder(sqlite);
  sqlite.prepare("INSERT INTO commercial_payment_attempts (id, order_id, provider, environment, invoice_number, request_fingerprint, status, created_at, updated_at) VALUES (?, ?, 'sepay', 'sandbox', ?, ?, 'PENDING', ?, ?)")
    .run("payment-attempt-1", "order-1", "NT-ORDER-1", "fingerprint-1", 1, 1);
  assert.throws(
    () => sqlite.prepare("INSERT INTO commercial_payment_attempts (id, order_id, provider, environment, invoice_number, request_fingerprint, status, created_at, updated_at) VALUES (?, ?, 'sepay', 'sandbox', ?, ?, 'PENDING', ?, ?)")
      .run("payment-attempt-2", "order-1", "NT-ORDER-2", "fingerprint-1", 2, 2),
    /UNIQUE constraint failed/i,
  );
  assert.throws(
    () => sqlite.prepare("INSERT INTO commercial_payment_attempts (id, order_id, provider, environment, invoice_number, request_fingerprint, status, created_at, updated_at) VALUES (?, ?, 'sepay', 'sandbox', ?, ?, 'PENDING', ?, ?)")
      .run("payment-attempt-3", "order-other", "NT-ORDER-1", "fingerprint-2", 3, 3),
    /UNIQUE constraint failed/i,
  );
});

test("SePay payment event identity is replay-safe and transaction-scoped", (t) => {
  const sqlite = fixture(t);
  seedOrder(sqlite);
  sqlite.prepare("INSERT INTO commercial_payment_events (id, order_id, provider, environment, provider_event_key, provider_order_id, provider_invoice_number, provider_transaction_id, notification_type, provider_order_status, provider_transaction_status, provider_transaction_type, amount_minor, currency, source, payload_hash, verification_status, received_at, verified_at, created_at) VALUES (?, ?, 'sepay', 'sandbox', ?, ?, ?, ?, 'ORDER_PAID', 'CAPTURED', 'APPROVED', 'PAYMENT', 10000, 'VND', 'ipn', ?, 'VERIFIED', ?, ?, ?)")
    .run("payment-event-1", "order-1", "event-1", "provider-order-1", "NT-ORDER-1", "provider-transaction-1", "payload-hash-1", 1, 1, 1);
  assert.throws(
    () => sqlite.prepare("INSERT INTO commercial_payment_events (id, order_id, provider, environment, provider_event_key, provider_order_id, provider_invoice_number, provider_transaction_id, notification_type, provider_order_status, provider_transaction_status, provider_transaction_type, amount_minor, currency, source, payload_hash, verification_status, received_at, verified_at, created_at) VALUES (?, ?, 'sepay', 'sandbox', ?, ?, ?, ?, 'ORDER_PAID', 'CAPTURED', 'APPROVED', 'PAYMENT', 10000, 'VND', 'ipn', ?, 'VERIFIED', ?, ?, ?)")
      .run("payment-event-2", "order-1", "event-1", "provider-order-1", "NT-ORDER-1", "provider-transaction-1", "payload-hash-2", 2, 2, 2),
    /UNIQUE constraint failed/i,
  );
  assert.equal((sqlite.prepare("SELECT COUNT(*) AS count FROM commercial_payment_events").get() as { count: number }).count, 1);
});
