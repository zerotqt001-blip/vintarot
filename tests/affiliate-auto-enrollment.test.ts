import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { ensureAffiliateEnrollment, backfillAffiliateEnrollment } from "../lib/affiliate/enrollment";
import { captureAttribution, claimGuestReferralAttribution } from "../lib/affiliate/service";
import { hashReferralCode } from "../lib/affiliate/repository";
import { getAffiliateAttributionWindow } from "../lib/affiliate/policy";
import { AFFILIATE_GUEST_COOKIE_NAME, createAffiliateGuestCookie, readAffiliateGuestId, requestUsesHttps } from "../lib/affiliate/anonymous-attribution";
import { createSqliteD1Database } from "../lib/sqlite-d1";

const repoRoot = join(import.meta.dirname, "..");
const now = 1_790_000_000_000;
const migrations = [
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
];

function fixture() {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec("PRAGMA foreign_keys = ON");
  for (const migration of migrations) sqlite.exec(readFileSync(join(repoRoot, "drizzle", migration), "utf8"));
  return { sqlite, database: createSqliteD1Database(sqlite) };
}

function insertMember(sqlite: DatabaseSync, id: string, options: { verified?: boolean; disabled?: boolean; disabledAt?: number | null } = {}) {
  sqlite.prepare("INSERT INTO members (id, username, email, phone, email_verified_at, created_at, updated_at, disabled, disabled_at, role) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'USER')")
    .run(id, id, `${id}@example.test`, "+84900000000", options.verified === false ? null : now - 1000, now - 2000, now - 2000, options.disabled ? 1 : 0, options.disabledAt ?? null);
}

async function addReferrer(sqlite: DatabaseSync, id: string, code: string) {
  insertMember(sqlite, id);
  sqlite.prepare("INSERT INTO affiliate_profiles (id, member_id, status, fraud_note_ciphertext, created_at, updated_at) VALUES (?, ?, 'ACTIVE', NULL, ?, ?)")
    .run(`profile-${id}`, id, now - 10, now - 10);
  sqlite.prepare("INSERT INTO referral_codes (id, affiliate_profile_id, code_hash, status, source, created_at, expires_at) VALUES (?, ?, ?, 'ACTIVE', 'test', ?, NULL)")
    .run(`code-${id}`, `profile-${id}`, await hashReferralCode(code), now - 10);
}

test("eligible verified members receive a stable active profile and referral link without activating policy", async () => {
  const { sqlite, database } = fixture();
  insertMember(sqlite, "member-a");
  insertMember(sqlite, "member-b");

  const first = await ensureAffiliateEnrollment({ database, memberId: "member-a", now, origin: "https://natarot.com" });
  const repeated = await ensureAffiliateEnrollment({ database, memberId: "member-a", now: now + 1, origin: "https://natarot.com" });
  const other = await ensureAffiliateEnrollment({ database, memberId: "member-b", now, origin: "https://natarot.com" });

  assert.equal(first.enrolled, true);
  if (!first.enrolled || !repeated.enrolled || !other.enrolled) throw new Error("Eligible member was not enrolled");
  assert.equal(first.status, "ACTIVE");
  assert.equal(first.referralLink.available, true);
  assert.equal(repeated.referralLink.available, true);
  assert.equal(other.referralLink.available, true);
  if (first.referralLink.available && repeated.referralLink.available && other.referralLink.available) {
    assert.equal(first.profileId, repeated.profileId);
    assert.equal(first.referralLink.code, repeated.referralLink.code);
    assert.notEqual(first.referralLink.code, other.referralLink.code);
    assert.equal(first.referralLink.url, `https://natarot.com/affiliate?ref=${encodeURIComponent(first.referralLink.code)}`);
  }
  assert.equal((sqlite.prepare("SELECT status FROM affiliate_policy_versions WHERE id='affiliate-v1-default'").get() as { status: string }).status, "DRAFT");
  assert.equal((sqlite.prepare("SELECT COUNT(*) AS count FROM affiliate_profiles").get() as { count: number }).count, 2);
  assert.equal((sqlite.prepare("SELECT COUNT(*) AS count FROM referral_codes WHERE source='natarot-dashboard-v1'").get() as { count: number }).count, 2);
  sqlite.close();
});

test("enrollment preserves an existing referral code and does not reactivate suspended profiles", async () => {
  const { sqlite, database } = fixture();
  insertMember(sqlite, "legacy-member");
  insertMember(sqlite, "suspended-member");
  sqlite.prepare("INSERT INTO affiliate_profiles (id, member_id, status, fraud_note_ciphertext, created_at, updated_at) VALUES ('legacy-profile', 'legacy-member', 'INACTIVE', NULL, ?, ?), ('suspended-profile', 'suspended-member', 'SUSPENDED', NULL, ?, ?)").run(now - 100, now - 100, now - 100, now - 100);
  const codeHash = "preserve-this-existing-hash";
  sqlite.prepare("INSERT INTO referral_codes (id, affiliate_profile_id, code_hash, public_code, status, source, created_at, expires_at) VALUES ('legacy-code', 'legacy-profile', ?, 'NTR-KEEPTHISCODE', 'ACTIVE', 'natarot-dashboard-v1', ?, NULL)").run(codeHash, now - 100);

  const existing = await ensureAffiliateEnrollment({ database, memberId: "legacy-member", now, origin: "https://natarot.com" });
  const suspended = await ensureAffiliateEnrollment({ database, memberId: "suspended-member", now, origin: "https://natarot.com" });

  assert.equal(existing.status, "ACTIVE");
  assert.equal(existing.referralLink.available, true);
  if (existing.referralLink.available) assert.equal(existing.referralLink.code, "NTR-KEEPTHISCODE");
  assert.equal(suspended.enrolled, false);
  assert.equal(suspended.reason, "profile_suspended");
  assert.deepEqual(Object.fromEntries(Object.entries(sqlite.prepare("SELECT code_hash, public_code FROM referral_codes WHERE id='legacy-code'").get() as Record<string, unknown>)), { code_hash: codeHash, public_code: "NTR-KEEPTHISCODE" });
  assert.equal((sqlite.prepare("SELECT status FROM affiliate_profiles WHERE id='suspended-profile'").get() as { status: string }).status, "SUSPENDED");
  assert.equal((sqlite.prepare("SELECT COUNT(*) AS count FROM referral_codes WHERE affiliate_profile_id='suspended-profile'").get() as { count: number }).count, 0);
  sqlite.close();
});

test("unverified, disabled, and missing members are never enrolled", async () => {
  const { sqlite, database } = fixture();
  insertMember(sqlite, "unverified", { verified: false });
  insertMember(sqlite, "disabled", { disabled: true });
  insertMember(sqlite, "disabled-at", { disabledAt: now - 1 });

  const unverified = await ensureAffiliateEnrollment({ database, memberId: "unverified", now });
  const disabled = await ensureAffiliateEnrollment({ database, memberId: "disabled", now });
  const disabledAt = await ensureAffiliateEnrollment({ database, memberId: "disabled-at", now });
  const missing = await ensureAffiliateEnrollment({ database, memberId: "does-not-exist", now });

  if (unverified.enrolled || disabled.enrolled || disabledAt.enrolled || missing.enrolled) throw new Error("Ineligible member was enrolled");
  assert.equal(unverified.reason, "not_verified");
  assert.equal(disabled.reason, "disabled");
  assert.equal(disabledAt.reason, "disabled");
  assert.equal(missing.reason, "member_not_found");
  assert.equal((sqlite.prepare("SELECT COUNT(*) AS count FROM affiliate_profiles").get() as { count: number }).count, 0);
  assert.equal((sqlite.prepare("SELECT COUNT(*) AS count FROM referral_codes").get() as { count: number }).count, 0);
  sqlite.close();
});

test("existing-member backfill is eligible-only, aggregate-only, and idempotent", async () => {
  const { sqlite, database } = fixture();
  for (const id of ["eligible-a", "eligible-b"]) insertMember(sqlite, id);
  insertMember(sqlite, "unverified", { verified: false });
  insertMember(sqlite, "disabled", { disabled: true });
  insertMember(sqlite, "suspended");
  sqlite.prepare("INSERT INTO affiliate_profiles (id, member_id, status, fraud_note_ciphertext, created_at, updated_at) VALUES ('suspended-profile', 'suspended', 'SUSPENDED', NULL, ?, ?)").run(now, now);

  const first = await backfillAffiliateEnrollment({ database, now, origin: "https://natarot.com" });
  const second = await backfillAffiliateEnrollment({ database, now: now + 1, origin: "https://natarot.com" });

  assert.deepEqual(first, { eligibleMembers: 3, enrolled: 2, profilesCreated: 2, linksEnsured: 2, suspendedPreserved: 1 });
  assert.deepEqual(second, { eligibleMembers: 3, enrolled: 2, profilesCreated: 0, linksEnsured: 2, suspendedPreserved: 1 });
  assert.doesNotMatch(JSON.stringify(first), /eligible-a|eligible-b|memberId|NTR-|@example/);
  assert.equal((sqlite.prepare("SELECT COUNT(*) AS count FROM affiliate_profiles").get() as { count: number }).count, 3);
  assert.equal((sqlite.prepare("SELECT COUNT(*) AS count FROM referral_codes WHERE source='natarot-dashboard-v1'").get() as { count: number }).count, 2);
  sqlite.close();
});

test("anonymous first touch uses the active policy window and claims once for the registered member", async () => {
  const { sqlite, database } = fixture();
  sqlite.prepare("UPDATE affiliate_policy_versions SET status='ACTIVE', starts_at=? WHERE id='affiliate-v1-default'").run(now - 1);
  await addReferrer(sqlite, "referrer", "NTR-REFERRER-CODE");
  insertMember(sqlite, "new-member", { verified: false });
  const guestId = "8ac513f2-46d3-4f2b-8a2a-dff811fbc58c";
  const owner = { kind: "guest", ownerId: `affiliate:${guestId}` } as const;

  assert.equal(await getAffiliateAttributionWindow(database, now), 30);
  const captured = await captureAttribution({ database, owner, rawCode: "NTR-REFERRER-CODE", source: "signup", now });
  const repeated = await captureAttribution({ database, owner, rawCode: "INVALID-SECOND-CODE", now: now + 1 });
  assert.equal(captured.accepted, true);
  assert.equal(captured.reason, "attributed");
  assert.equal(captured.expiresAt, now + 30 * 86_400_000);
  assert.equal(repeated.reason, "already_attributed");
  assert.equal(repeated.attributionId, captured.attributionId);

  const claimed = await claimGuestReferralAttribution({ database, memberId: "new-member", guestId, now: now + 2 });
  assert.deepEqual(claimed, { claimed: true, reason: "claimed" });
  const row = sqlite.prepare("SELECT owner_key, member_id, affiliate_profile_id FROM referral_attributions").get() as Record<string, unknown>;
  assert.equal(row.owner_key, "member:new-member");
  assert.equal(row.member_id, "new-member");
  assert.equal(row.affiliate_profile_id, "profile-referrer");
  assert.equal((sqlite.prepare("SELECT status FROM affiliate_policy_versions WHERE id='affiliate-v1-default'").get() as { status: string }).status, "ACTIVE");
  sqlite.close();
});

test("draft attribution terms never persist commission-bearing attribution", async () => {
  const { sqlite, database } = fixture();
  await addReferrer(sqlite, "referrer", "NTR-REFERRER-CODE");
  const owner = { kind: "guest", ownerId: "affiliate:11111111-1111-4111-8111-111111111111" } as const;

  assert.equal(await getAffiliateAttributionWindow(database, now), null);
  const captured = await captureAttribution({ database, owner, rawCode: "NTR-REFERRER-CODE", source: "signup", now });

  assert.deepEqual(captured, { accepted: false, reason: "no_policy" });
  assert.equal((sqlite.prepare("SELECT COUNT(*) AS count FROM referral_attributions").get() as { count: number }).count, 0);
  sqlite.close();
});

test("affiliate suspension before the attribution insert prevents capture", async () => {
  const { sqlite, database } = fixture();
  sqlite.prepare("UPDATE affiliate_policy_versions SET status='ACTIVE', starts_at=? WHERE id='affiliate-v1-default'").run(now - 1);
  await addReferrer(sqlite, "referrer", "NTR-REFERRER-CODE");
  let suspensionApplied = false;
  const raceDatabase = new Proxy(database, {
    get(target, property, receiver) {
      if (property === "prepare") {
        return (sql: string) => {
          if (!suspensionApplied && sql.startsWith("INSERT OR IGNORE INTO referral_attributions")) {
            suspensionApplied = true;
            sqlite.prepare("UPDATE affiliate_profiles SET status='SUSPENDED' WHERE id='profile-referrer'").run();
          }
          return target.prepare(sql);
        };
      }
      return Reflect.get(target, property, receiver);
    },
  });

  const captured = await captureAttribution({
    database: raceDatabase,
    owner: { kind: "guest", ownerId: "affiliate:22222222-2222-4222-8222-222222222222" },
    rawCode: "NTR-REFERRER-CODE",
    source: "signup",
    now,
  });

  assert.equal(suspensionApplied, true);
  assert.equal(captured.accepted, false);
  assert.equal((sqlite.prepare("SELECT COUNT(*) AS count FROM referral_attributions").get() as { count: number }).count, 0);
  sqlite.close();
});

test("member attribution wins, self referrals and expired anonymous context are not claimed", async () => {
  const { sqlite, database } = fixture();
  sqlite.prepare("UPDATE affiliate_policy_versions SET status='ACTIVE', starts_at=? WHERE id='affiliate-v1-default'").run(now - 1);
  await addReferrer(sqlite, "referrer-a", "NTR-REFERRER-A");
  await addReferrer(sqlite, "referrer-b", "NTR-REFERRER-B");
  insertMember(sqlite, "member-with-first-touch");
  insertMember(sqlite, "expired-member");

  await captureAttribution({ database, owner: { kind: "member", ownerId: "member:member-with-first-touch" }, rawCode: "NTR-REFERRER-A", now });
  await captureAttribution({ database, owner: { kind: "guest", ownerId: "affiliate:11111111-1111-4111-8111-111111111111" }, rawCode: "NTR-REFERRER-B", now });
  const precedence = await claimGuestReferralAttribution({ database, memberId: "member-with-first-touch", guestId: "11111111-1111-4111-8111-111111111111", now: now + 1 });
  assert.deepEqual(precedence, { claimed: false, reason: "member_already_attributed" });

  await captureAttribution({ database, owner: { kind: "guest", ownerId: "affiliate:22222222-2222-4222-8222-222222222222" }, rawCode: "NTR-REFERRER-A", now });
  const selfReferral = await claimGuestReferralAttribution({ database, memberId: "referrer-a", guestId: "22222222-2222-4222-8222-222222222222", now: now + 1 });
  assert.deepEqual(selfReferral, { claimed: false, reason: "self_referral" });

  await captureAttribution({ database, owner: { kind: "guest", ownerId: "affiliate:33333333-3333-4333-8333-333333333333" }, rawCode: "NTR-REFERRER-A", now });
  const expired = await claimGuestReferralAttribution({ database, memberId: "expired-member", guestId: "33333333-3333-4333-8333-333333333333", now: now + 31 * 86_400_000 });
  assert.deepEqual(expired, { claimed: false, reason: "expired" });
  assert.equal((sqlite.prepare("SELECT owner_key FROM referral_attributions WHERE id=(SELECT id FROM referral_attributions WHERE owner_key='guest:affiliate:33333333-3333-4333-8333-333333333333')").get() as { owner_key: string }).owner_key, "guest:affiliate:33333333-3333-4333-8333-333333333333");
  sqlite.close();
});

test("affiliate guest cookie is opaque, first-party, secure on HTTPS, and expires with attribution", () => {
  const guestId = "8ac513f2-46d3-4f2b-8a2a-dff811fbc58c";
  const expiresAt = now + 30 * 86_400_000;
  const cookie = createAffiliateGuestCookie(guestId, expiresAt, now, true);
  assert.match(cookie, new RegExp(`^${AFFILIATE_GUEST_COOKIE_NAME}=${guestId}; Path=/; Max-Age=2592000; HttpOnly; SameSite=Lax; Secure$`));
  assert.doesNotMatch(cookie, /referrer|NTR-|@|member:/i);
  const request = new Request("https://natarot.com/", { headers: { Cookie: cookie.split(";")[0] } });
  assert.equal(readAffiliateGuestId(request), guestId);
});

test("affiliate guest cookie transport trusts forwarded protocol only behind configured proxy", () => {
  assert.equal(requestUsesHttps(new Request("https://natarot.com/", { headers: { "x-forwarded-proto": "http" } })), true);
  assert.equal(requestUsesHttps(new Request("http://natarot.com/", { headers: { "x-forwarded-proto": "https" } })), false);
  assert.equal(requestUsesHttps(new Request("http://natarot.com/", { headers: { "x-forwarded-proto": "https" } }), true), true);
  assert.equal(requestUsesHttps(new Request("https://natarot.com/", { headers: { "x-forwarded-proto": "http" } }), true), false);
});
