import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { createAuditService } from "../lib/audit/service";
import { adjustAffiliateCommission, captureAttribution, createAffiliateConversion, getAffiliateSummary, listAffiliateHistory, markCommissionEligible, reverseAffiliateCommission, type VerifiedFulfillmentEvent } from "../lib/affiliate/service";
import { affiliateAdjustmentAuditIdempotencyKey } from "../lib/affiliate/idempotency";
import { hashReferralCode } from "../lib/affiliate/repository";
import { createPendingOrder, recordVerifiedPayment } from "../lib/orders";
import { createCreditStore } from "../lib/credits/repository";
import { createSqliteD1Database } from "../lib/sqlite-d1";
import type { CreditOwner } from "../lib/credits/types";

const repoRoot = join(import.meta.dirname, "..");
const buyerOwner: CreditOwner = { kind: "member", ownerId: "member:buyer" };

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
  const now = { value: 1_700_000_000_000 };
  const database = createSqliteD1Database(sqlite);
  sqlite.prepare("UPDATE affiliate_policy_versions SET status='ACTIVE', starts_at=? WHERE id='affiliate-v1-default'").run(now.value - 1);
  for (const id of ["buyer", "affiliate-a", "affiliate-b"]) {
    sqlite.prepare("INSERT INTO members (id, username, email, phone, created_at, updated_at, disabled, role) VALUES (?, ?, ?, ?, ?, ?, 0, 'USER')")
      .run(id, id, `${id}@example.test`, "+84912345678", now.value, now.value);
  }
  return { sqlite, database, now, creditStore: createCreditStore(database, () => now.value) };
}

async function seedAffiliate(sqlite: DatabaseSync, profileId: string, memberId: string, rawCode: string, status = "ACTIVE") {
  const codeHash = await hashReferralCode(rawCode);
  sqlite.prepare("INSERT INTO affiliate_profiles (id, member_id, status, fraud_note_ciphertext, created_at, updated_at) VALUES (?, ?, ?, NULL, ?, ?)")
    .run(profileId, memberId, status, 1, 1);
  sqlite.prepare("INSERT INTO referral_codes (id, affiliate_profile_id, code_hash, status, source, created_at, expires_at) VALUES (?, ?, ?, 'ACTIVE', 'test', ?, NULL)")
    .run(`${profileId}-code`, profileId, codeHash, 1);
  return { profileId, codeId: `${profileId}-code`, codeHash };
}

function seedPackage(sqlite: DatabaseSync, now: number) {
  const benefit = JSON.stringify({ credits: { units: 10 }, vip: { durationSeconds: 86_400, benefitVersion: "vip-v1", benefits: { premiumSpreads: true } } });
  sqlite.prepare("INSERT INTO packages (id, slug, name_en, name_vi, active, created_at, updated_at) VALUES (?, ?, ?, ?, 1, ?, ?)").run("package-affiliate", "package-affiliate", "Affiliate Package", "Gói liên kết", now, now);
  sqlite.prepare("INSERT INTO package_versions (id, package_id, version, amount_minor, currency, credit_units, vip_duration_seconds, benefit_snapshot, policy_version, status, starts_at, ends_at, created_at) VALUES (?, ?, 1, 9900, 'VND', 10, 86400, ?, 'packages-v1', 'active', ?, NULL, ?)").run("package-affiliate-v1", "package-affiliate", benefit, now - 1, now);
  return "package-affiliate-v1";
}

function fulfilledEvent(sqlite: DatabaseSync, now: number, orderId: string, fulfillmentId: string, ownerId = "member:buyer"): VerifiedFulfillmentEvent {
  const row = sqlite.prepare("SELECT amount_minor, currency, payment_reference, package_snapshot, status, fulfilled_at FROM orders WHERE id=?").get(orderId) as {
    amount_minor: number;
    currency: string;
    payment_reference: string;
    package_snapshot: string;
    status: string;
    fulfilled_at: number;
  };
  return {
    eventKey: `order:${orderId}:fulfilled`,
    orderId,
    fulfillmentId,
    orderStatus: row.status as "FULFILLED",
    memberOwnerId: ownerId,
    paymentReference: row.payment_reference,
    amountMinor: row.amount_minor,
    currency: row.currency,
    packageSnapshot: row.package_snapshot,
    fulfilledAt: row.fulfilled_at ?? now,
  };
}

async function seedFulfilledOrder(fixture: ReturnType<typeof makeFixture>, suffix = "one") {
  const existingPackage = fixture.sqlite.prepare("SELECT id FROM package_versions WHERE id='package-affiliate-v1'").get() as { id: string } | undefined;
  const versionId = existingPackage?.id ?? seedPackage(fixture.sqlite, fixture.now.value);
  const order = await createPendingOrder({ database: fixture.database, creditStore: fixture.creditStore, owner: buyerOwner, packageVersionId: versionId, idempotencyKey: `affiliate-order-${suffix}`, now: () => fixture.now.value });
  await recordVerifiedPayment(fixture.database, { orderId: order.id, paymentReference: `verified-affiliate-payment-${suffix}`, verifiedAt: fixture.now.value });
  fixture.sqlite.prepare("INSERT INTO order_fulfillments (id, order_id, fulfillment_key, result_snapshot, created_at) VALUES (?, ?, ?, ?, ?)")
    .run(`fulfillment:${order.id}`, order.id, `order:${order.id}:fulfilled:v1`, "snapshot", fixture.now.value);
  fixture.sqlite.prepare("UPDATE orders SET status='FULFILLED', fulfilled_at=? WHERE id=?").run(fixture.now.value, order.id);
  return fulfilledEvent(fixture.sqlite, fixture.now.value, order.id, `fulfillment:${order.id}`);
}

test("attribution is opaque, first-touch, owner-bound, and rejects tampering/self-referral", async () => {
  const fixture = makeFixture();
  const affiliate = await seedAffiliate(fixture.sqlite, "profile-a", "affiliate-a", "MOON-A");
  const other = await seedAffiliate(fixture.sqlite, "profile-b", "affiliate-b", "MOON-B");
  const invalid = await captureAttribution({ database: fixture.database, owner: buyerOwner, rawCode: "tampered", source: "query", now: fixture.now.value });
  assert.equal(invalid.accepted, false);
  const first = await captureAttribution({ database: fixture.database, owner: buyerOwner, rawCode: "MOON-A", source: "query", now: fixture.now.value });
  assert.equal(first.accepted, true);
  const second = await captureAttribution({ database: fixture.database, owner: buyerOwner, rawCode: "MOON-B", source: "query", now: fixture.now.value + 1 });
  assert.equal(second.attributionId, first.attributionId);
  assert.equal((fixture.sqlite.prepare("SELECT COUNT(*) AS count FROM referral_attributions").get() as { count: number }).count, 1);
  const self = await captureAttribution({ database: fixture.database, owner: { kind: "member", ownerId: "member:affiliate-a" }, rawCode: "MOON-A", source: "query", now: fixture.now.value });
  assert.equal(self.accepted, false);
  assert.equal(self.reason, "self_referral");
  assert.equal((fixture.sqlite.prepare("SELECT code_hash FROM referral_codes WHERE id=?").get(affiliate.codeId) as { code_hash: string }).code_hash.includes("MOON-A"), false);
  assert.equal(other.profileId, "profile-b");
  fixture.sqlite.close();
});

test("verified fulfillment creates an immutable tier snapshot and an append-only commission ledger", async () => {
  const fixture = makeFixture();
  await seedAffiliate(fixture.sqlite, "profile-a", "affiliate-a", "MOON-A");
  const attribution = await captureAttribution({ database: fixture.database, owner: buyerOwner, rawCode: "MOON-A", source: "query", now: fixture.now.value });
  const event = await seedFulfilledOrder(fixture);
  const conversion = await createAffiliateConversion({ database: fixture.database, event });
  assert.ok(conversion);
  assert.equal(conversion!.commissionMinor, 990);
  assert.equal(conversion!.status, "HELD");
  assert.equal(conversion!.attributionId, attribution.attributionId);
  const duplicate = await createAffiliateConversion({ database: fixture.database, event });
  assert.equal(duplicate!.id, conversion!.id);
  assert.equal((fixture.sqlite.prepare("SELECT COUNT(*) AS count FROM affiliate_conversions").get() as { count: number }).count, 1);
  assert.equal((fixture.sqlite.prepare("SELECT COUNT(*) AS count FROM affiliate_commission_ledger").get() as { count: number }).count, 1);
  const originalLedger = fixture.sqlite.prepare("SELECT tier_snapshot FROM affiliate_commission_ledger WHERE conversion_id=?").get(conversion!.id) as { tier_snapshot: string };
  fixture.sqlite.prepare("UPDATE affiliate_policy_tiers SET rate_bps=3000 WHERE tier_code='TIER_1'").run();
  assert.match(originalLedger.tier_snapshot, /1000/);
  await markCommissionEligible({ database: fixture.database, conversionId: conversion!.id, idempotencyKey: "eligible-1", reason: "hold elapsed", now: fixture.now.value + 8 * 86_400_000 });
  const reversed = await reverseAffiliateCommission({ database: fixture.database, conversionId: conversion!.id, idempotencyKey: "refund-1", reason: "verified refund", actorId: "system", now: fixture.now.value + 9 * 86_400_000 });
  assert.equal(reversed.status, "REVERSED");
  await reverseAffiliateCommission({ database: fixture.database, conversionId: conversion!.id, idempotencyKey: "refund-1", reason: "verified refund", actorId: "system", now: fixture.now.value + 9 * 86_400_000 });
  assert.equal((fixture.sqlite.prepare("SELECT COUNT(*) AS count FROM affiliate_commission_ledger").get() as { count: number }).count, 3);
  const history = await listAffiliateHistory(fixture.database, "member:buyer");
  assert.equal(history[0]?.status, "REVERSED");
  const summary = await getAffiliateSummary(fixture.database, "member:buyer");
  assert.equal(summary.conversions, 1);
  fixture.sqlite.close();
});

test("conversion requires a fulfilled member order, matching attribution window, active affiliate, and integer money", async () => {
  const fixture = makeFixture();
  await seedAffiliate(fixture.sqlite, "profile-a", "affiliate-a", "MOON-A");
  await captureAttribution({ database: fixture.database, owner: buyerOwner, rawCode: "MOON-A", source: "query", now: fixture.now.value });
  const event = await seedFulfilledOrder(fixture);
  fixture.sqlite.prepare("UPDATE referral_attributions SET attributed_at=?, expires_at=? WHERE owner_key=?").run(fixture.now.value - 3, fixture.now.value - 1, "member:buyer");
  assert.equal(await createAffiliateConversion({ database: fixture.database, event }), null);
  fixture.sqlite.prepare("UPDATE referral_attributions SET expires_at=? WHERE owner_key=?").run(fixture.now.value + 1, "member:buyer");
  fixture.sqlite.prepare("UPDATE affiliate_profiles SET status='SUSPENDED' WHERE id='profile-a'").run();
  assert.equal(await createAffiliateConversion({ database: fixture.database, event: { ...event, eventKey: `${event.eventKey}:suspended` } }), null);
  fixture.sqlite.prepare("UPDATE affiliate_profiles SET status='ACTIVE' WHERE id='profile-a'").run();
  assert.equal(await createAffiliateConversion({ database: fixture.database, event: { ...event, orderStatus: "PAYMENT_CONFIRMED", eventKey: `${event.eventKey}:unfulfilled` } }), null);
  const foreign = await listAffiliateHistory(fixture.database, "member:other");
  assert.equal(foreign.length, 0);
  fixture.sqlite.close();
});

test("concurrent fulfillment retries produce one conversion and one commission entry", async () => {
  const fixture = makeFixture();
  await seedAffiliate(fixture.sqlite, "profile-a", "affiliate-a", "MOON-A");
  await captureAttribution({ database: fixture.database, owner: buyerOwner, rawCode: "MOON-A", source: "query", now: fixture.now.value });
  const event = await seedFulfilledOrder(fixture);
  const results = await Promise.all(Array.from({ length: 8 }, () => createAffiliateConversion({ database: fixture.database, event })));
  assert.ok(results.every((result) => result?.id === results[0]?.id));
  assert.equal((fixture.sqlite.prepare("SELECT COUNT(*) AS count FROM affiliate_conversions").get() as { count: number }).count, 1);
  assert.equal((fixture.sqlite.prepare("SELECT COUNT(*) AS count FROM affiliate_commission_ledger").get() as { count: number }).count, 1);
  fixture.sqlite.close();
});

test("commission mutation idempotency is scoped to its conversion", async () => {
  const fixture = makeFixture();
  await seedAffiliate(fixture.sqlite, "profile-a", "affiliate-a", "MOON-A");
  await captureAttribution({ database: fixture.database, owner: buyerOwner, rawCode: "MOON-A", source: "query", now: fixture.now.value });

  const first = await createAffiliateConversion({ database: fixture.database, event: await seedFulfilledOrder(fixture, "first") });
  const second = await createAffiliateConversion({ database: fixture.database, event: await seedFulfilledOrder(fixture, "second") });
  assert.ok(first);
  assert.ok(second);

  await markCommissionEligible({ database: fixture.database, conversionId: first!.id, idempotencyKey: "reused-key", reason: "hold elapsed", now: fixture.now.value + 8 * 86_400_000 });
  await markCommissionEligible({ database: fixture.database, conversionId: second!.id, idempotencyKey: "reused-key", reason: "hold elapsed", now: fixture.now.value + 8 * 86_400_000 });
  await reverseAffiliateCommission({ database: fixture.database, conversionId: first!.id, idempotencyKey: "reused-key", reason: "verified refund", actorId: "system", now: fixture.now.value + 9 * 86_400_000 });
  await reverseAffiliateCommission({ database: fixture.database, conversionId: second!.id, idempotencyKey: "reused-key", reason: "verified refund", actorId: "system", now: fixture.now.value + 9 * 86_400_000 });
  await adjustAffiliateCommission({ database: fixture.database, conversionId: first!.id, direction: "CREDIT", amountMinor: 100, reason: "verified adjustment", idempotencyKey: "reused-key", actorId: "admin-a" });
  await adjustAffiliateCommission({ database: fixture.database, conversionId: second!.id, direction: "CREDIT", amountMinor: 100, reason: "verified adjustment", idempotencyKey: "reused-key", actorId: "admin-a" });

  const entries = fixture.sqlite.prepare("SELECT conversion_id, entry_type FROM affiliate_commission_ledger WHERE entry_type IN ('ELIGIBILITY', 'REVERSAL', 'ADJUSTMENT') ORDER BY conversion_id, entry_type").all() as Array<{ conversion_id: string; entry_type: string }>;
  assert.equal(entries.filter((entry) => entry.entry_type === "ELIGIBILITY").length, 2);
  assert.equal(entries.filter((entry) => entry.entry_type === "REVERSAL").length, 2);
  assert.equal(entries.filter((entry) => entry.entry_type === "ADJUSTMENT").length, 2);
  assert.equal((await loadConversionForTest(fixture, first!.id))?.status, "REVERSED");
  assert.equal((await loadConversionForTest(fixture, second!.id))?.status, "REVERSED");

  const audit = createAuditService(fixture.database, () => fixture.now.value);
  const firstAuditKey = await affiliateAdjustmentAuditIdempotencyKey(first!.id, "bar:baz");
  const secondAuditKey = await affiliateAdjustmentAuditIdempotencyKey(second!.id, "baz");
  assert.notEqual(firstAuditKey, secondAuditKey);
  const firstAudit = await audit.append({ actorKind: "member", actorId: "admin-a", action: "affiliate.commission.adjusted", targetType: "affiliate_conversion", targetId: first!.id, reason: "verified adjustment", idempotencyKey: firstAuditKey });
  await audit.append({ actorKind: "member", actorId: "admin-a", action: "affiliate.commission.adjusted", targetType: "affiliate_conversion", targetId: second!.id, reason: "verified adjustment", idempotencyKey: secondAuditKey });
  const duplicateAudit = await audit.append({ actorKind: "member", actorId: "admin-a", action: "affiliate.commission.adjusted", targetType: "affiliate_conversion", targetId: first!.id, reason: "verified adjustment", idempotencyKey: firstAuditKey });
  assert.equal(duplicateAudit.id, firstAudit.id);
  const auditTargets = fixture.sqlite.prepare("SELECT target_id FROM audit_events WHERE action='affiliate.commission.adjusted' ORDER BY target_id").all() as Array<{ target_id: string }>;
  assert.deepEqual(auditTargets.map((row) => row.target_id), [first!.id, second!.id].sort());
  fixture.sqlite.close();
});

test("commission mutation keys remain distinct when conversion IDs and keys contain delimiters", async () => {
  const fixture = makeFixture();
  await seedAffiliate(fixture.sqlite, "profile-a", "affiliate-a", "MOON-A");
  await captureAttribution({ database: fixture.database, owner: buyerOwner, rawCode: "MOON-A", source: "query", now: fixture.now.value });

  const firstEvent = await seedFulfilledOrder(fixture, "foo");
  const secondEvent = await seedFulfilledOrder(fixture, "foo:bar");
  const first = await createAffiliateConversion({ database: fixture.database, event: firstEvent });
  const second = await createAffiliateConversion({ database: fixture.database, event: secondEvent });
  assert.ok(first);
  assert.ok(second);

  await adjustAffiliateCommission({ database: fixture.database, conversionId: first!.id, direction: "CREDIT", amountMinor: 100, reason: "verified adjustment", idempotencyKey: "bar:baz", actorId: "admin-a" });
  await adjustAffiliateCommission({ database: fixture.database, conversionId: second!.id, direction: "CREDIT", amountMinor: 100, reason: "verified adjustment", idempotencyKey: "baz", actorId: "admin-a" });
  await markCommissionEligible({ database: fixture.database, conversionId: first!.id, idempotencyKey: "bar:baz", reason: "hold elapsed" });
  await markCommissionEligible({ database: fixture.database, conversionId: second!.id, idempotencyKey: "baz", reason: "hold elapsed" });
  await reverseAffiliateCommission({ database: fixture.database, conversionId: first!.id, idempotencyKey: "bar:baz", reason: "verified refund", actorId: "system" });
  await reverseAffiliateCommission({ database: fixture.database, conversionId: second!.id, idempotencyKey: "baz", reason: "verified refund", actorId: "system" });

  for (const entryType of ["ADJUSTMENT", "ELIGIBILITY", "REVERSAL"]) {
    const rows = fixture.sqlite.prepare("SELECT conversion_id FROM affiliate_commission_ledger WHERE entry_type=? ORDER BY conversion_id").all(entryType) as Array<{ conversion_id: string }>;
    assert.deepEqual(rows.map((row) => row.conversion_id), [first!.id, second!.id].sort(), `${entryType} entries should be recorded for both conversions`);
  }
  assert.equal((await loadConversionForTest(fixture, first!.id))?.status, "REVERSED");
  assert.equal((await loadConversionForTest(fixture, second!.id))?.status, "REVERSED");
  fixture.sqlite.close();
});

async function loadConversionForTest(fixture: ReturnType<typeof makeFixture>, id: string) {
  return fixture.database.prepare("SELECT status FROM affiliate_conversions WHERE id=?").bind(id).first<{ status: string }>();
}
