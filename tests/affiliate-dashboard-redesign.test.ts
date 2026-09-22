import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { getAffiliateCustomerDashboard } from "../lib/affiliate/customer";
import { captureAttribution, createAffiliateConversion, markCommissionEligible, type VerifiedFulfillmentEvent } from "../lib/affiliate/service";
import { hashReferralCode } from "../lib/affiliate/repository";
import { createCreditStore } from "../lib/credits/repository";
import { createPendingOrder, recordVerifiedPayment } from "../lib/orders";
import { createSqliteD1Database } from "../lib/sqlite-d1";

const repoRoot = join(import.meta.dirname, "..");
const now = 1_700_000_000_000;
const day = 86_400_000;

function source(relativePath: string): string {
  return readFileSync(join(repoRoot, relativePath), "utf8");
}

function makeFixture() {
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
  const database = createSqliteD1Database(sqlite);
  sqlite.prepare("UPDATE affiliate_policy_versions SET status='ACTIVE', starts_at=0 WHERE id='affiliate-v1-default'").run();
  for (const id of ["affiliate-owner", "buyer"]) {
    sqlite.prepare("INSERT INTO members (id, username, email, phone, created_at, updated_at, disabled, role) VALUES (?, ?, ?, ?, ?, ?, 0, 'USER')")
      .run(id, id, `${id}@example.test`, `+8491234${id === "buyer" ? "0001" : "0002"}`, now, now);
  }
  sqlite.prepare("INSERT INTO affiliate_profiles (id, member_id, status, fraud_note_ciphertext, created_at, updated_at) VALUES ('profile-owner', 'affiliate-owner', 'ACTIVE', NULL, ?, ?)").run(now, now);
  const benefit = JSON.stringify({ credits: { units: 10 }, vip: { durationSeconds: 86_400, benefitVersion: "vip-v1", benefits: {} } });
  sqlite.prepare("INSERT INTO packages (id, slug, name_en, name_vi, active, created_at, updated_at) VALUES (?, ?, ?, ?, 1, ?, ?)")
    .run("package-affiliate-redesign", "package-affiliate-redesign", "Affiliate Package", "Gói liên kết", now, now);
  sqlite.prepare("INSERT INTO package_versions (id, package_id, version, amount_minor, currency, credit_units, vip_duration_seconds, benefit_snapshot, policy_version, status, starts_at, ends_at, created_at) VALUES (?, ?, 1, 10000, 'VND', 10, 86400, ?, 'packages-v1', 'active', ?, NULL, ?)")
    .run("package-affiliate-redesign-v1", "package-affiliate-redesign", benefit, 0, now);
  return { sqlite, database, creditStore: createCreditStore(database, () => now) };
}

async function seedReferralCode(sqlite: DatabaseSync): Promise<void> {
  const codeHash = await hashReferralCode("MOON-REDESIGN");
  sqlite.prepare("INSERT INTO referral_codes (id, affiliate_profile_id, code_hash, status, source, created_at, expires_at) VALUES (?, ?, ?, 'ACTIVE', 'test', ?, NULL)")
    .run("code-owner", "profile-owner", codeHash, now);
}

async function seedFulfilledEvent(
  fixture: ReturnType<typeof makeFixture>,
  key: string,
  fulfilledAt: number,
): Promise<VerifiedFulfillmentEvent> {
  const order = await createPendingOrder({
    database: fixture.database,
    creditStore: fixture.creditStore,
    owner: { kind: "member", ownerId: "member:buyer" },
    packageVersionId: "package-affiliate-redesign-v1",
    idempotencyKey: `redesign-order-${key}`,
    now: () => fulfilledAt,
  });
  await recordVerifiedPayment(fixture.database, { orderId: order.id, paymentReference: `verified-${key}`, verifiedAt: fulfilledAt });
  const fulfillmentId = `fulfillment:${key}`;
  fixture.sqlite.prepare("INSERT INTO order_fulfillments (id, order_id, fulfillment_key, result_snapshot, created_at) VALUES (?, ?, ?, ?, ?)")
    .run(fulfillmentId, order.id, `order:${order.id}:fulfilled:v1`, "snapshot", fulfilledAt);
  fixture.sqlite.prepare("UPDATE orders SET status='FULFILLED', fulfilled_at=? WHERE id=?").run(fulfilledAt, order.id);
  const row = fixture.sqlite.prepare("SELECT amount_minor, currency, payment_reference, package_snapshot, status, fulfilled_at FROM orders WHERE id=?")
    .get(order.id) as { amount_minor: number; currency: string; payment_reference: string; package_snapshot: string; status: string; fulfilled_at: number };
  return {
    eventKey: `order:${order.id}:fulfilled`,
    orderId: order.id,
    fulfillmentId,
    orderStatus: row.status as "FULFILLED",
    memberOwnerId: "member:buyer",
    paymentReference: row.payment_reference,
    amountMinor: row.amount_minor,
    currency: row.currency,
    packageSnapshot: row.package_snapshot,
    fulfilledAt: row.fulfilled_at,
  };
}

test("affiliate dashboard income buckets come from the verified commission ledger", async () => {
  const fixture = makeFixture();
  await seedReferralCode(fixture.sqlite);
  const attribution = await captureAttribution({ database: fixture.database, owner: { kind: "member", ownerId: "member:buyer" }, rawCode: "MOON-REDESIGN", source: "test", now });
  assert.equal(attribution.accepted, true);
  fixture.sqlite.prepare("UPDATE referral_attributions SET expires_at=? WHERE owner_key=?").run(now + 365 * day, "member:buyer");

  const heldEvent = await seedFulfilledEvent(fixture, "held", now - day);
  const held = await createAffiliateConversion({ database: fixture.database, event: heldEvent, now: now - day });
  assert.equal(held?.commissionMinor, 1000);

  const confirmedEvent = await seedFulfilledEvent(fixture, "confirmed", now - 2 * day);
  const confirmed = await createAffiliateConversion({ database: fixture.database, event: confirmedEvent, now: now - 2 * day });
  assert.equal(confirmed?.commissionMinor, 1000);
  await markCommissionEligible({ database: fixture.database, conversionId: confirmed!.id, idempotencyKey: "confirmed", reason: "hold elapsed", now: now - day });

  const priorEvent = await seedFulfilledEvent(fixture, "prior", now - 90 * day);
  const prior = await createAffiliateConversion({ database: fixture.database, event: priorEvent, now: now - 90 * day });
  assert.equal(prior?.commissionMinor, 1000);
  await markCommissionEligible({ database: fixture.database, conversionId: prior!.id, idempotencyKey: "prior", reason: "hold elapsed", now: now - 89 * day });

  const dashboard = await getAffiliateCustomerDashboard(fixture.database, { kind: "member", ownerId: "member:affiliate-owner" }, now);
  assert.deepEqual(dashboard.income, {
    currency: "VND",
    currentMonthMinor: 2000,
    confirmedMinor: 2000,
    pendingMinor: 1000,
    totalMinor: 3000,
  });
  assert.equal(dashboard.summary.conversions, 3);
  assert.equal(dashboard.summary.netMinor, 3000);
  assert.equal(dashboard.history.length, 3);
  assert.equal(dashboard.referralLink.available, false);
  assert.equal(dashboard.referralLink.reason, "not_supported_by_current_backend");
  fixture.sqlite.close();
});

test("Affiliate target source preserves real-data boundaries and the approved shell direction", () => {
  const dashboard = source("components/affiliate/affiliate-dashboard.tsx");
  const customer = source("lib/affiliate/customer.ts");
  const shell = source("app/vintarot.tsx");
  const messages = source("lib/i18n.ts");

  assert.match(dashboard, /affiliate-dashboard/);
  assert.match(dashboard, /income\.currentMonthMinor/);
  assert.match(dashboard, /referralLink\.available/);
  assert.match(dashboard, /navigator\.clipboard/);
  assert.doesNotMatch(dashboard, /18 referred|1\.245\.000|320\.000|4\.860\.000|925\.000|THANH123/);
  assert.match(customer, /currentMonthMinor/);
  assert.match(customer, /confirmedMinor/);
  assert.match(customer, /pendingMinor/);
  assert.match(shell, /const isAffiliate = path === "\/affiliate";/);
  assert.match(shell, /affiliate-shell/);
  assert.match(shell, /nav\.drawNow/);
  assert.doesNotMatch(shell, /isAffiliate[\s\S]{0,600}\+ Phòng/);
  for (const key of ["affiliate.dashboardEyebrow", "affiliate.linkUnavailable", "affiliate.incomeTitle", "affiliate.policyPending"]) {
    assert.match(messages, new RegExp(`${key.split(".")[1]}:`));
  }
});
