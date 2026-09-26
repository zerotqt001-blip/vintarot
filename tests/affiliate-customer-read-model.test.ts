import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { getAffiliateCustomerDashboard, projectAffiliatePolicy } from "../lib/affiliate/customer";
import { createAffiliateConversion, type VerifiedFulfillmentEvent } from "../lib/affiliate/service";
import { hashReferralCode } from "../lib/affiliate/repository";
import { createCreditStore } from "../lib/credits/repository";
import { createPendingOrder, recordVerifiedPayment } from "../lib/orders";
import type { AffiliatePolicy } from "../lib/affiliate/policy";
import { createSqliteD1Database } from "../lib/sqlite-d1";

const repoRoot = join(import.meta.dirname, "..");
const now = 1_700_000_000_000;

function makePolicy(status: AffiliatePolicy["status"] = "ACTIVE"): AffiliatePolicy {
  return {
    id: "policy-live",
    version: 9,
    status,
    attributionWindowDays: 14,
    holdDays: 5,
    currency: "VND",
    startsAt: now - 1,
    endsAt: null,
    tiers: [
      { id: "tier-base", policyVersionId: "policy-live", tierCode: "BASE", minQualifiedConversions: 0, rateBps: 777 },
      { id: "tier-next", policyVersionId: "policy-live", tierCode: "NEXT", minQualifiedConversions: 2, rateBps: 1555 },
    ],
  };
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
    "0007_sepay_commercial.sql",
    "0008_credit_fulfillment_timestamp.sql",
    "0009_affiliate_referral_links.sql",
  ]) sqlite.exec(readFileSync(join(repoRoot, "drizzle", migration), "utf8"));
  sqlite.prepare("INSERT INTO members (id, username, email, phone, email_verified_at, created_at, updated_at, disabled, role) VALUES (?, ?, ?, ?, ?, ?, ?, 0, 'USER')").run("affiliate-owner", "affiliate-owner", "owner@example.test", "+84912345678", now - 1, now, now);
  sqlite.prepare("INSERT INTO members (id, username, email, phone, email_verified_at, created_at, updated_at, disabled, role) VALUES (?, ?, ?, ?, ?, ?, ?, 0, 'USER')").run("other-owner", "other-owner", "other@example.test", "+84987654321", now - 1, now, now);
  sqlite.prepare("INSERT INTO affiliate_profiles (id, member_id, status, fraud_note_ciphertext, created_at, updated_at) VALUES ('profile-owner', 'affiliate-owner', 'ACTIVE', NULL, ?, ?)").run(now, now);
  return { sqlite, database: createSqliteD1Database(sqlite) };
}

test("public affiliate policy projection only exposes active server policy fields", () => {
  assert.equal(projectAffiliatePolicy(null), null);
  assert.equal(projectAffiliatePolicy(makePolicy("DRAFT")), null);
  const projected = projectAffiliatePolicy(makePolicy());
  assert.deepEqual(projected, {
    version: 9,
    currency: "VND",
    attributionWindowDays: 14,
    holdDays: 5,
    tiers: [
      { tierCode: "BASE", minQualifiedConversions: 0, rateBps: 777 },
      { tierCode: "NEXT", minQualifiedConversions: 2, rateBps: 1555 },
    ],
  });
  assert.doesNotMatch(JSON.stringify(projected), /policy-live|tier-base|affiliate-owner|code_hash|raw/i);
});
test("affiliate dashboard is owner-scoped and computes current tier from active policy", async () => {
  const fixture = makeFixture();
  fixture.sqlite.prepare("UPDATE affiliate_policy_versions SET status='ACTIVE', starts_at=? WHERE id='affiliate-v1-default'").run(now - 1);
  fixture.sqlite.prepare("UPDATE affiliate_policy_tiers SET rate_bps=777, tier_code='BASE', min_qualified_conversions=0 WHERE id='affiliate-v1-default-tier-1'").run();
  fixture.sqlite.prepare("UPDATE affiliate_policy_tiers SET rate_bps=1555, tier_code='NEXT', min_qualified_conversions=2 WHERE id='affiliate-v1-default-tier-2'").run();
  const owner = await getAffiliateCustomerDashboard(fixture.database, { kind: "member", ownerId: "member:affiliate-owner" }, now);
  const foreign = await getAffiliateCustomerDashboard(fixture.database, { kind: "member", ownerId: "member:other-owner" }, now);
  assert.equal(owner.profile?.status, "ACTIVE");
  assert.equal(owner.progress?.qualifiedConversions, 0);
  assert.equal(owner.progress?.currentTier?.tierCode, "BASE");
  assert.equal(owner.progress?.currentTier?.rateBps, 777);
  assert.equal(owner.progress?.nextTier?.tierCode, "NEXT");
  assert.equal(owner.referralLink.available, true);
  if (owner.referralLink.available) {
    assert.match(owner.referralLink.code, /^NTR-[A-Z0-9-]{16,}$/);
    assert.equal(owner.referralLink.url, `https://natarot.com/affiliate?ref=${encodeURIComponent(owner.referralLink.code)}`);
  }
  assert.equal(foreign.profile, null);
  assert.equal(foreign.progress, null);
  assert.equal(foreign.summary.conversions, 0);
  assert.equal(foreign.history.length, 0);
  assert.doesNotMatch(JSON.stringify(owner), /code_hash|rawCode|profile-owner|affiliate-owner|payoutUrl/i);
  fixture.sqlite.close();
});

test("policy-pending members retain their referral link and see only verified enabled referral signups", async () => {
  const fixture = makeFixture();
  const insertMember = (id: string, verifiedAt: number | null, disabled = 0, disabledAt: number | null = null) => {
    fixture.sqlite.prepare("INSERT INTO members (id, username, email, phone, email_verified_at, created_at, updated_at, disabled, disabled_at, role) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'USER')")
      .run(id, id, `${id}@example.test`, "+84900000000", verifiedAt, now, now, disabled, disabledAt);
  };
  const insertProfile = (profileId: string, memberId: string) => fixture.sqlite.prepare("INSERT INTO affiliate_profiles (id, member_id, status, fraud_note_ciphertext, created_at, updated_at) VALUES (?, ?, 'ACTIVE', NULL, ?, ?)")
    .run(profileId, memberId, now, now);
  insertMember("verified-referral", now);
  insertMember("unverified-referral", null);
  insertMember("disabled-referral", now, 1);
  insertMember("other-affiliate", now);
  insertMember("other-referral", now);
  insertProfile("other-profile", "other-affiliate");
  fixture.sqlite.prepare("INSERT INTO referral_codes (id, affiliate_profile_id, code_hash, status, source, created_at, expires_at) VALUES ('owner-code', 'profile-owner', 'owner-code-hash', 'ACTIVE', 'test', ?, NULL), ('other-code', 'other-profile', 'other-code-hash', 'ACTIVE', 'test', ?, NULL)").run(now, now);
  const attribution = fixture.sqlite.prepare("INSERT INTO referral_attributions (id, owner_key, member_id, affiliate_profile_id, referral_code_id, source, attributed_at, expires_at, created_at) VALUES (?, ?, ?, ?, ?, 'test', ?, ?, ?)");
  attribution.run("owner-verified-attribution", "member:verified-referral", "verified-referral", "profile-owner", "owner-code", now - 500, now + 30 * 86_400_000, now);
  attribution.run("owner-unverified-attribution", "member:unverified-referral", "unverified-referral", "profile-owner", "owner-code", now - 400, now + 30 * 86_400_000, now);
  attribution.run("owner-disabled-attribution", "member:disabled-referral", "disabled-referral", "profile-owner", "owner-code", now - 300, now + 30 * 86_400_000, now);
  attribution.run("other-attribution", "member:other-referral", "other-referral", "other-profile", "other-code", now - 200, now + 30 * 86_400_000, now);

  const owner = await getAffiliateCustomerDashboard(fixture.database, { kind: "member", ownerId: "member:affiliate-owner" }, now);
  const foreign = await getAffiliateCustomerDashboard(fixture.database, { kind: "member", ownerId: "member:other-affiliate" }, now);

  assert.equal(owner.policy, null);
  assert.equal(owner.progress, null);
  assert.equal(owner.referralLink.available, true);
  assert.deepEqual(owner.referrals, { count: 1, history: [{ id: "owner-verified-attribution", signupAt: now, state: "VERIFIED" }] });
  assert.deepEqual(owner.income, { currency: null, currentMonthMinor: 0, confirmedMinor: 0, pendingMinor: 0, totalMinor: 0 });
  assert.equal(foreign.referrals.count, 1);
  assert.notEqual(foreign.referrals.history[0]?.id, owner.referrals.history[0]?.id);
  assert.doesNotMatch(JSON.stringify(owner.referrals), /verified-referral|owner@example|code_hash|owner-code/);
  fixture.sqlite.close();
});

test("policy-pending dashboard hides prior commission income and activity", async () => {
  const fixture = makeFixture();
  const { sqlite, database } = fixture;
  sqlite.prepare("UPDATE affiliate_policy_versions SET status='ACTIVE', starts_at=? WHERE id='affiliate-v1-default'").run(now - 1);
  sqlite.prepare("INSERT INTO members (id, username, email, phone, email_verified_at, created_at, updated_at, disabled, role) VALUES ('commission-buyer', 'commission-buyer', 'commission-buyer@example.test', '+84912345678', ?, ?, ?, 0, 'USER')")
    .run(now - 1, now, now);

  const referralCodeHash = await hashReferralCode("CUSTOMER-READ-MODEL-REF");
  sqlite.prepare("INSERT INTO referral_codes (id, affiliate_profile_id, code_hash, status, source, created_at, expires_at) VALUES ('customer-owner-code', 'profile-owner', ?, 'ACTIVE', 'test', ?, NULL)")
    .run(referralCodeHash, now);
  sqlite.prepare("INSERT INTO referral_attributions (id, owner_key, member_id, affiliate_profile_id, referral_code_id, source, attributed_at, expires_at, created_at) VALUES ('customer-commission-attribution', 'member:commission-buyer', 'commission-buyer', 'profile-owner', 'customer-owner-code', 'test', ?, ?, ?)")
    .run(now - 1000, now + 30 * 86_400_000, now - 1000);

  const benefit = JSON.stringify({ credits: { units: 10 }, vip: { durationSeconds: 86_400, benefitVersion: "vip-v1", benefits: {} } });
  sqlite.prepare("INSERT INTO packages (id, slug, name_en, name_vi, active, created_at, updated_at) VALUES ('customer-commission-package', 'customer-commission-package', 'Commission package', 'Gói hoa hồng', 1, ?, ?)")
    .run(now, now);
  sqlite.prepare("INSERT INTO package_versions (id, package_id, version, amount_minor, currency, credit_units, vip_duration_seconds, benefit_snapshot, policy_version, status, starts_at, ends_at, created_at) VALUES ('customer-commission-package-v1', 'customer-commission-package', 1, 10000, 'VND', 10, 86400, ?, 'packages-v1', 'active', ?, NULL, ?)")
    .run(benefit, now - 1, now);
  const creditStore = createCreditStore(database, () => now);
  const order = await createPendingOrder({
    database,
    creditStore,
    owner: { kind: "member", ownerId: "member:commission-buyer" },
    packageVersionId: "customer-commission-package-v1",
    idempotencyKey: "customer-commission-order",
    now: () => now,
  });
  const paid = await recordVerifiedPayment(database, { orderId: order.id, paymentReference: "customer-verified-payment", verifiedAt: now });
  const fulfillmentId = "customer-commission-fulfillment";
  sqlite.prepare("INSERT INTO order_fulfillments (id, order_id, fulfillment_key, result_snapshot, created_at) VALUES (?, ?, ?, ?, ?)")
    .run(fulfillmentId, paid.id, `order:${paid.id}:fulfilled:v1`, "commission-test", now);
  sqlite.prepare("UPDATE orders SET status='FULFILLED', fulfilled_at=? WHERE id=?").run(now, paid.id);
  const persistedOrder = sqlite.prepare("SELECT amount_minor, currency, payment_reference, package_snapshot, status, fulfilled_at FROM orders WHERE id=?")
    .get(paid.id) as { amount_minor: number; currency: string; payment_reference: string; package_snapshot: string; status: string; fulfilled_at: number };
  const event: VerifiedFulfillmentEvent = {
    eventKey: `order:${paid.id}:fulfilled`,
    orderId: paid.id,
    fulfillmentId,
    orderStatus: persistedOrder.status as "FULFILLED",
    memberOwnerId: "member:commission-buyer",
    paymentReference: persistedOrder.payment_reference,
    amountMinor: persistedOrder.amount_minor,
    currency: persistedOrder.currency,
    packageSnapshot: persistedOrder.package_snapshot,
    fulfilledAt: persistedOrder.fulfilled_at,
  };
  assert.ok(await createAffiliateConversion({ database, event, now }));
  sqlite.prepare("UPDATE affiliate_policy_versions SET status='DRAFT' WHERE id='affiliate-v1-default'").run();

  const dashboard = await getAffiliateCustomerDashboard(database, { kind: "member", ownerId: "member:affiliate-owner" }, now);

  assert.deepEqual(dashboard.income, { currency: null, currentMonthMinor: 0, confirmedMinor: 0, pendingMinor: 0, totalMinor: 0 });
  assert.deepEqual(dashboard.history, []);
  assert.deepEqual({ creditedMinor: dashboard.summary.creditedMinor, debitedMinor: dashboard.summary.debitedMinor, netMinor: dashboard.summary.netMinor }, { creditedMinor: 0, debitedMinor: 0, netMinor: 0 });
  assert.equal(dashboard.referrals.count, 1);
  sqlite.close();
});
