import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import QRCode from "qrcode";
import { getAffiliateCustomerDashboard } from "../lib/affiliate/customer";
import { ensureAffiliateReferralLink } from "../lib/affiliate/referral-link";
import { hashReferralCode } from "../lib/affiliate/repository";
import type { AffiliateReferralLink } from "../lib/affiliate/types";
import { createSqliteD1Database } from "../lib/sqlite-d1";

const repoRoot = join(import.meta.dirname, "..");
const now = 1_700_000_000_000;
const day = 86_400_000;
const migrationsThrough0008 = [
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
];

function applyMigrations(sqlite: DatabaseSync, includeReferralLinkMigration = false): void {
  for (const migration of migrationsThrough0008) sqlite.exec(readFileSync(join(repoRoot, "drizzle", migration), "utf8"));
  if (includeReferralLinkMigration) sqlite.exec(readFileSync(join(repoRoot, "drizzle", "0009_affiliate_referral_links.sql"), "utf8"));
}

function insertMember(sqlite: DatabaseSync, id: string, timestamp = now): void {
  sqlite.prepare("INSERT INTO members (id, username, email, phone, email_verified_at, created_at, updated_at, disabled, role) VALUES (?, ?, ?, ?, ?, ?, ?, 0, 'USER')")
    .run(id, id, `${id}@example.test`, "+84900000000", timestamp - 1, timestamp, timestamp);
}

function expectAvailable(result: AffiliateReferralLink): Extract<AffiliateReferralLink, { available: true }> {
  assert.equal(result.available, true);
  if (!result.available) throw new Error("Expected an available referral link");
  return result;
}

async function seedLegacyAffiliateRows(sqlite: DatabaseSync): Promise<{ codeHash: string }> {
  insertMember(sqlite, "legacy-affiliate");
  insertMember(sqlite, "legacy-buyer");
  sqlite.prepare("INSERT INTO affiliate_profiles (id, member_id, status, fraud_note_ciphertext, created_at, updated_at) VALUES (?, ?, 'ACTIVE', NULL, ?, ?)")
    .run("legacy-profile", "legacy-affiliate", now, now);
  const codeHash = await hashReferralCode("LEGACY-ALPHA");
  sqlite.prepare("INSERT INTO referral_codes (id, affiliate_profile_id, code_hash, status, source, created_at, expires_at) VALUES (?, ?, ?, 'ACTIVE', ?, ?, NULL)")
    .run("legacy-code", "legacy-profile", codeHash, "legacy-import", now);
  sqlite.prepare("INSERT INTO referral_attributions (id, owner_key, member_id, affiliate_profile_id, referral_code_id, source, attributed_at, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
    .run("legacy-attribution", "member:legacy-buyer", "legacy-buyer", "legacy-profile", "legacy-code", "legacy-import", now, now + 30 * day, now);

  sqlite.prepare("INSERT INTO credit_accounts (id, owner_kind, owner_id, mutation_version, mutation_token, created_at, updated_at) VALUES (?, 'member', ?, 0, NULL, ?, ?)")
    .run("legacy-account", "legacy-buyer", now, now);
  sqlite.prepare("INSERT INTO packages (id, slug, name_en, name_vi, active, created_at, updated_at) VALUES (?, ?, ?, ?, 1, ?, ?)")
    .run("legacy-package", "legacy-package", "Legacy package", "Gói cũ", now, now);
  sqlite.prepare("INSERT INTO package_versions (id, package_id, version, amount_minor, currency, credit_units, vip_duration_seconds, benefit_snapshot, policy_version, status, starts_at, ends_at, created_at) VALUES (?, ?, 1, 10000, 'VND', 10, 86400, ?, 'packages-v1', 'active', ?, NULL, ?)")
    .run("legacy-package-v1", "legacy-package", "{}", now - day, now);
  sqlite.prepare("INSERT INTO orders (id, account_id, package_id, package_version_id, package_snapshot, amount_minor, currency, status, idempotency_key, request_fingerprint, payment_reference, created_at, payment_confirmed_at, fulfilled_at, cancelled_at, refunded_at) VALUES (?, ?, ?, ?, ?, 10000, 'VND', 'FULFILLED', ?, ?, ?, ?, ?, ?, NULL, NULL)")
    .run("legacy-order", "legacy-account", "legacy-package", "legacy-package-v1", "{\"package\":\"legacy\"}", "legacy-order-key", "legacy-order-fingerprint", "legacy-payment", now, now, now);
  sqlite.prepare("INSERT INTO order_fulfillments (id, order_id, fulfillment_key, result_snapshot, created_at) VALUES (?, ?, ?, ?, ?)")
    .run("legacy-fulfillment", "legacy-order", "legacy-order:fulfilled:v1", "{\"fulfilled\":true}", now);
  sqlite.prepare("INSERT INTO affiliate_conversions (id, event_key, order_id, fulfillment_id, member_id, attribution_id, affiliate_profile_id, policy_version_id, tier_id, amount_minor, currency, commission_minor, payment_reference, package_snapshot, status, fulfilled_at, eligible_at, reversed_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 10000, 'VND', 1000, ?, ?, 'HELD', ?, NULL, NULL, ?, ?)")
    .run("legacy-conversion", "order:legacy-order:fulfilled", "legacy-order", "legacy-fulfillment", "legacy-buyer", "legacy-attribution", "legacy-profile", "affiliate-v1-default", "affiliate-v1-default-tier-1", "legacy-payment", "{\"package\":\"legacy\"}", now, now, now);
  sqlite.prepare("INSERT INTO affiliate_commission_ledger (id, conversion_id, entry_type, direction, amount_minor, currency, idempotency_key, reversal_of_id, actor_kind, actor_id, reason, policy_snapshot, tier_snapshot, package_snapshot, fraud_note_ciphertext, created_at) VALUES (?, ?, 'COMMISSION', 'CREDIT', 1000, 'VND', ?, NULL, 'system', 'system', ?, ?, ?, ?, NULL, ?)")
    .run("legacy-ledger", "legacy-conversion", "affiliate:commission:legacy", "verified legacy fulfillment", "{\"policy\":1}", "{\"tier\":1}", "{\"package\":\"legacy\"}", now);
  return { codeHash };
}

function makeLinkFixture() {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec("PRAGMA foreign_keys = ON");
  applyMigrations(sqlite, true);
  const database = createSqliteD1Database(sqlite);
  sqlite.prepare("UPDATE affiliate_policy_versions SET status='ACTIVE', starts_at=? WHERE id='affiliate-v1-default'").run(now - 1);
  for (const id of ["affiliate-a", "affiliate-b", "inactive-affiliate", "buyer"]) insertMember(sqlite, id);
  sqlite.prepare("INSERT INTO affiliate_profiles (id, member_id, status, fraud_note_ciphertext, created_at, updated_at) VALUES (?, ?, ?, NULL, ?, ?)")
    .run("profile-a", "affiliate-a", "ACTIVE", now, now);
  sqlite.prepare("INSERT INTO affiliate_profiles (id, member_id, status, fraud_note_ciphertext, created_at, updated_at) VALUES (?, ?, ?, NULL, ?, ?)")
    .run("profile-b", "affiliate-b", "ACTIVE", now, now);
  sqlite.prepare("INSERT INTO affiliate_profiles (id, member_id, status, fraud_note_ciphertext, created_at, updated_at) VALUES (?, ?, ?, NULL, ?, ?)")
    .run("profile-inactive", "inactive-affiliate", "INACTIVE", now, now);
  return { sqlite, database };
}

test("0009 preserves legacy hashes, attributions, fulfilled conversions, and commission ledger rows", async () => {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec("PRAGMA foreign_keys = ON");
  applyMigrations(sqlite);
  const { codeHash } = await seedLegacyAffiliateRows(sqlite);
  const before = {
    code: sqlite.prepare("SELECT id, affiliate_profile_id, code_hash, status, source, created_at, expires_at FROM referral_codes WHERE id='legacy-code'").get(),
    attribution: sqlite.prepare("SELECT id, owner_key, member_id, affiliate_profile_id, referral_code_id, source, attributed_at, expires_at, created_at FROM referral_attributions WHERE id='legacy-attribution'").get(),
    conversion: sqlite.prepare("SELECT id, event_key, order_id, fulfillment_id, member_id, attribution_id, affiliate_profile_id, policy_version_id, tier_id, amount_minor, currency, commission_minor, payment_reference, package_snapshot, status, fulfilled_at, eligible_at, reversed_at, created_at, updated_at FROM affiliate_conversions WHERE id='legacy-conversion'").get(),
    ledger: sqlite.prepare("SELECT id, conversion_id, entry_type, direction, amount_minor, currency, idempotency_key, reversal_of_id, actor_kind, actor_id, reason, policy_snapshot, tier_snapshot, package_snapshot, fraud_note_ciphertext, created_at FROM affiliate_commission_ledger WHERE id='legacy-ledger'").get(),
  };

  sqlite.exec(readFileSync(join(repoRoot, "drizzle", "0009_affiliate_referral_links.sql"), "utf8"));

  assert.deepEqual(sqlite.prepare("SELECT id, affiliate_profile_id, code_hash, status, source, created_at, expires_at FROM referral_codes WHERE id='legacy-code'").get(), before.code);
  assert.deepEqual(sqlite.prepare("SELECT id, owner_key, member_id, affiliate_profile_id, referral_code_id, source, attributed_at, expires_at, created_at FROM referral_attributions WHERE id='legacy-attribution'").get(), before.attribution);
  assert.deepEqual(sqlite.prepare("SELECT id, event_key, order_id, fulfillment_id, member_id, attribution_id, affiliate_profile_id, policy_version_id, tier_id, amount_minor, currency, commission_minor, payment_reference, package_snapshot, status, fulfilled_at, eligible_at, reversed_at, created_at, updated_at FROM affiliate_conversions WHERE id='legacy-conversion'").get(), before.conversion);
  assert.deepEqual(sqlite.prepare("SELECT id, conversion_id, entry_type, direction, amount_minor, currency, idempotency_key, reversal_of_id, actor_kind, actor_id, reason, policy_snapshot, tier_snapshot, package_snapshot, fraud_note_ciphertext, created_at FROM affiliate_commission_ledger WHERE id='legacy-ledger'").get(), before.ledger);
  assert.equal((sqlite.prepare("SELECT code_hash FROM referral_codes WHERE id='legacy-code'").get() as { code_hash: string }).code_hash, codeHash);
  assert.ok((sqlite.prepare("PRAGMA table_info(referral_codes)").all() as Array<{ name: string; notnull: number }>).some((column) => column.name === "public_code" && column.notnull === 0));
  assert.equal((sqlite.prepare("SELECT public_code FROM referral_codes WHERE id='legacy-code'").get() as { public_code: string | null }).public_code, null);

  sqlite.prepare("UPDATE referral_codes SET public_code='NTR-SAME' WHERE id='legacy-code'").run();
  insertMember(sqlite, "second-affiliate");
  sqlite.prepare("INSERT INTO affiliate_profiles (id, member_id, status, fraud_note_ciphertext, created_at, updated_at) VALUES (?, ?, 'ACTIVE', NULL, ?, ?)").run("second-profile", "second-affiliate", now, now);
  const duplicateHash = await hashReferralCode("SECOND-CODE");
  assert.throws(() => sqlite.prepare("INSERT INTO referral_codes (id, affiliate_profile_id, code_hash, status, source, public_code, created_at, expires_at) VALUES (?, ?, ?, 'ACTIVE', 'legacy-import', ?, ?, NULL)").run("second-code", "second-profile", duplicateHash, "NTR-SAME", now), /UNIQUE/i);
  const secondDashboardHash = await hashReferralCode("SECOND-DASHBOARD");
  const secondDashboardDuplicateHash = await hashReferralCode("SECOND-DASHBOARD-2");
  sqlite.prepare("INSERT INTO referral_codes (id, affiliate_profile_id, code_hash, status, source, public_code, created_at, expires_at) VALUES (?, ?, ?, 'ACTIVE', 'natarot-dashboard-v1', ?, ?, NULL)").run("second-dashboard-code", "second-profile", secondDashboardHash, "NTR-SECOND", now);
  assert.throws(() => sqlite.prepare("INSERT INTO referral_codes (id, affiliate_profile_id, code_hash, status, source, public_code, created_at, expires_at) VALUES (?, ?, ?, 'ACTIVE', 'natarot-dashboard-v1', ?, ?, NULL)").run("second-dashboard-code-duplicate", "second-profile", secondDashboardDuplicateHash, "NTR-THIRD", now), /UNIQUE/i);
  sqlite.close();
});

test("stable referral links are opaque, canonical, QR-backed, and owner-scoped", async () => {
  const fixture = makeLinkFixture();
  const ownerA = { kind: "member", ownerId: "member:affiliate-a" } as const;
  const ownerB = { kind: "member", ownerId: "member:affiliate-b" } as const;
  const origin = "https://natarot.com";
  const first = expectAvailable(await ensureAffiliateReferralLink(fixture.database, ownerA, origin, now));
  const repeat = expectAvailable(await ensureAffiliateReferralLink(fixture.database, ownerA, origin, now + 1));
  const other = expectAvailable(await ensureAffiliateReferralLink(fixture.database, ownerB, origin, now));

  assert.match(first.code, /^NTR-[A-Z0-9-]{16,}$/);
  assert.doesNotMatch(first.code, /affiliate-a|owner@example|849/i);
  assert.equal(first.url, `https://natarot.com/affiliate?ref=${encodeURIComponent(first.code)}`);
  assert.equal(first.downloadName, `natarot-referral-${first.code}.svg`);
  assert.equal(first.code, repeat.code);
  assert.equal(first.url, repeat.url);
  assert.equal(first.qrUrl, repeat.qrUrl);
  assert.notEqual(first.code, other.code);
  assert.equal((fixture.sqlite.prepare("SELECT COUNT(*) AS count FROM referral_codes WHERE affiliate_profile_id='profile-a' AND source='natarot-dashboard-v1'").get() as { count: number }).count, 1);
  assert.equal((fixture.sqlite.prepare("SELECT COUNT(*) AS count FROM referral_codes WHERE affiliate_profile_id='profile-b' AND source='natarot-dashboard-v1'").get() as { count: number }).count, 1);

  const expectedSvg = await QRCode.toString(first.url, { type: "svg", errorCorrectionLevel: "M", margin: 4, width: 218, color: { dark: "#10283b", light: "#f4ebdd" } });
  assert.equal(first.qrUrl, `data:image/svg+xml;charset=utf-8,${encodeURIComponent(expectedSvg)}`);
  const dashboardA = await getAffiliateCustomerDashboard(fixture.database, ownerA, now);
  const dashboardB = await getAffiliateCustomerDashboard(fixture.database, ownerB, now);
  assert.equal(dashboardA.referralLink.available, true);
  assert.equal(dashboardB.referralLink.available, true);
  if (dashboardA.referralLink.available && dashboardB.referralLink.available) {
    assert.equal(dashboardA.referralLink.code, first.code);
    assert.equal(dashboardB.referralLink.code, other.code);
    assert.notEqual(dashboardB.referralLink.code, dashboardA.referralLink.code);
  }
  assert.doesNotMatch(JSON.stringify(dashboardA), /code_hash|profile-a|affiliate-a|owner@example|phone/i);
  fixture.sqlite.close();
});

test("existing hash-only codes and attribution rows remain untouched when the dashboard code is added", async () => {
  const fixture = makeLinkFixture();
  const legacyHash = await hashReferralCode("LEGACY-OWNER-CODE");
  fixture.sqlite.prepare("INSERT INTO referral_codes (id, affiliate_profile_id, code_hash, status, source, created_at, expires_at) VALUES (?, ?, ?, 'ACTIVE', 'legacy-import', ?, NULL)")
    .run("owner-legacy-code", "profile-a", legacyHash, now);
  fixture.sqlite.prepare("INSERT INTO referral_attributions (id, owner_key, member_id, affiliate_profile_id, referral_code_id, source, attributed_at, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
    .run("owner-legacy-attribution", "member:buyer", "buyer", "profile-a", "owner-legacy-code", "legacy-import", now, now + 30 * day, now);
  const before = fixture.sqlite.prepare("SELECT code_hash, source FROM referral_codes WHERE id='owner-legacy-code'").get();
  const beforeAttribution = fixture.sqlite.prepare("SELECT * FROM referral_attributions WHERE id='owner-legacy-attribution'").get();
  const result = expectAvailable(await ensureAffiliateReferralLink(fixture.database, { kind: "member", ownerId: "member:affiliate-a" }, "https://natarot.com", now));
  assert.ok(result.code);
  assert.deepEqual(fixture.sqlite.prepare("SELECT code_hash, source FROM referral_codes WHERE id='owner-legacy-code'").get(), before);
  assert.deepEqual(fixture.sqlite.prepare("SELECT * FROM referral_attributions WHERE id='owner-legacy-attribution'").get(), beforeAttribution);
  assert.equal((fixture.sqlite.prepare("SELECT COUNT(*) AS count FROM referral_attributions").get() as { count: number }).count, 1);
  fixture.sqlite.close();
});

test("inactive profiles stay unavailable while policy-pending active profiles receive a referral link", async () => {
  const fixture = makeLinkFixture();
  const inactive = await ensureAffiliateReferralLink(fixture.database, { kind: "member", ownerId: "member:inactive-affiliate" }, "https://natarot.com", now);
  assert.deepEqual(inactive, { available: false, reason: "profile_inactive" });
  assert.equal((fixture.sqlite.prepare("SELECT COUNT(*) AS count FROM referral_codes WHERE affiliate_profile_id='profile-inactive'").get() as { count: number }).count, 0);

  insertMember(fixture.sqlite, "no-policy-affiliate");
  fixture.sqlite.prepare("INSERT INTO affiliate_profiles (id, member_id, status, fraud_note_ciphertext, created_at, updated_at) VALUES (?, ?, 'ACTIVE', NULL, ?, ?)").run("profile-no-policy", "no-policy-affiliate", now, now);
  fixture.sqlite.prepare("UPDATE affiliate_policy_versions SET status='DRAFT' WHERE id='affiliate-v1-default'").run();
  const noPolicy = await ensureAffiliateReferralLink(fixture.database, { kind: "member", ownerId: "member:no-policy-affiliate" }, "https://natarot.com", now);
  assert.equal(noPolicy.available, true);
  assert.equal((fixture.sqlite.prepare("SELECT COUNT(*) AS count FROM referral_codes WHERE affiliate_profile_id='profile-no-policy'").get() as { count: number }).count, 1);
  fixture.sqlite.close();
});
