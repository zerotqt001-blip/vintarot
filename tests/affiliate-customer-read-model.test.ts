import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { getAffiliateCustomerDashboard, projectAffiliatePolicy } from "../lib/affiliate/customer";
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
  ]) sqlite.exec(readFileSync(join(repoRoot, "drizzle", migration), "utf8"));
  sqlite.prepare("INSERT INTO members (id, username, email, phone, created_at, updated_at, disabled, role) VALUES (?, ?, ?, ?, ?, ?, 0, 'USER')").run("affiliate-owner", "affiliate-owner", "owner@example.test", "+84912345678", now, now);
  sqlite.prepare("INSERT INTO members (id, username, email, phone, created_at, updated_at, disabled, role) VALUES (?, ?, ?, ?, ?, ?, 0, 'USER')").run("other-owner", "other-owner", "other@example.test", "+84987654321", now, now);
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
  assert.equal(owner.referralLink.available, false);
  assert.equal(owner.referralLink.reason, "not_supported_by_current_backend");
  assert.equal(foreign.profile, null);
  assert.equal(foreign.progress, null);
  assert.equal(foreign.summary.conversions, 0);
  assert.equal(foreign.history.length, 0);
  assert.doesNotMatch(JSON.stringify(owner), /code_hash|rawCode|profile-owner|affiliate-owner|payoutUrl/i);
  fixture.sqlite.close();
});

