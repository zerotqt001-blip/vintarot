import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { createAuditService } from "../lib/audit/service";
import { createCreditStore } from "../lib/credits/repository";
import { getActiveEntitlements } from "../lib/entitlements";
import { createMemberAuthStore } from "../lib/member-auth";
import { createSqliteD1Database } from "../lib/sqlite-d1";
import { provisionOwnerTestAccount } from "../lib/owner-test/provision";

const repoRoot = join(import.meta.dirname, "..");
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
];

const now = 1_700_000_000_000;
const password = `owner-test-${globalThis.crypto.randomUUID()}`;
const identity = {
  username: "natarot_owner_test",
  email: "owner-test@natarot.com",
  phone: "+84900000001",
  password,
  displayName: "NaTarot Owner QA",
};

test("owner test operator is production-guarded and password-silent", () => {
  const operatorPath = join(repoRoot, "scripts", "provision-owner-test-account.ts");
  assert.equal(existsSync(operatorPath), true, "owner test provisioning operator is missing");
  const source = readFileSync(operatorPath, "utf8");
  assert.match(source, /provisionOwnerTestAccount/);
  assert.match(source, /NATAROT_OWNER_TEST_PROVISION/);
  assert.match(source, /NODE_ENV/);
  assert.match(source, /var\/lib\/natarot\/natarot\.sqlite/);
  assert.match(source, /stdin|readFileSync\(0/);
  assert.match(source, /natarot-staging/i);
  assert.doesNotMatch(source, /console\.log\([^\n]*password/i);
});

function createFixture() {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec("PRAGMA foreign_keys = ON");
  for (const migration of migrations) sqlite.exec(readFileSync(join(repoRoot, "drizzle", migration), "utf8"));
  return { sqlite, database: createSqliteD1Database(sqlite), now };
}

function countRows(sqlite: DatabaseSync, statement: string, ...values: Array<string | number>): number {
  const row = sqlite.prepare(statement).get(...values) as { count?: unknown } | undefined;
  assert.ok(row);
  return Number(row.count);
}

test("provisionOwnerTestAccount creates a normal-auth ADMIN owner QA account with internal grants", async () => {
  const fixture = createFixture();
  const result = await provisionOwnerTestAccount({ ...identity, database: fixture.database, now });

  assert.equal(result.role, "ADMIN");
  assert.equal(result.creditGrant.units, 100);
  assert.equal(result.creditGrant.sourceType, "OWNER_TEST_GRANT");
  assert.equal(result.entitlement.sourceType, "OWNER_TEST_GRANT");
  assert.ok(result.affiliateProfileId);
  assert.doesNotMatch(JSON.stringify(result), new RegExp(password));

  const member = fixture.sqlite.prepare("SELECT username, email, email_verified_at, password_hash, role, disabled FROM members WHERE id=?").get(result.memberId) as Record<string, unknown>;
  assert.equal(member.username, identity.username);
  assert.equal(member.email, identity.email);
  assert.ok(member.email_verified_at);
  assert.equal(member.role, "ADMIN");
  assert.equal(Number(member.disabled), 0);
  assert.equal(typeof member.password_hash, "string");

  const session = await createMemberAuthStore(fixture.database, () => now + 1).createSessionIfPasswordMatches(result.memberId, String(member.password_hash), true);
  assert.ok(session, "the account must sign in through the normal password session path");

  const owner = { kind: "member" as const, ownerId: `member:${result.memberId}` };
  assert.deepEqual(await createCreditStore(fixture.database, () => now).getBalance(owner), { availableUnits: 100, reservedUnits: 0, totalUnits: 100 });
  const entitlements = await getActiveEntitlements(fixture.database, owner, now + 1);
  assert.equal(entitlements.length, 1);
  assert.equal(entitlements[0]?.sourceType, "OWNER_TEST_GRANT");
  assert.equal(entitlements[0]?.status, "ACTIVE");
  assert.equal(countRows(fixture.sqlite, "SELECT COUNT(*) AS count FROM affiliate_profiles WHERE member_id=?", result.memberId), 1);
  assert.equal(countRows(fixture.sqlite, "SELECT COUNT(*) AS count FROM orders WHERE account_id=?", `credit-account:member:member:${result.memberId}`), 0);
  assert.equal(countRows(fixture.sqlite, "SELECT COUNT(*) AS count FROM audit_events WHERE target_id=?", result.memberId), 1);

  const audits = await createAuditService(fixture.database, () => now).list({ targetId: result.memberId });
  assert.equal(audits.length, 1);
  assert.doesNotMatch(JSON.stringify(audits), new RegExp(password));
});

test("provisionOwnerTestAccount is idempotent and does not duplicate internal benefits", async () => {
  const fixture = createFixture();
  const first = await provisionOwnerTestAccount({ ...identity, database: fixture.database, now });
  const second = await provisionOwnerTestAccount({ ...identity, database: fixture.database, now: now + 10_000 });

  assert.equal(second.memberId, first.memberId);
  assert.equal(second.creditGrant.id, first.creditGrant.id);
  assert.equal(second.entitlement.id, first.entitlement.id);
  assert.equal(countRows(fixture.sqlite, "SELECT COUNT(*) AS count FROM credit_grants"), 1);
  assert.equal(countRows(fixture.sqlite, "SELECT COUNT(*) AS count FROM credit_ledger"), 1);
  assert.equal(countRows(fixture.sqlite, "SELECT COUNT(*) AS count FROM entitlements"), 1);
  assert.equal(countRows(fixture.sqlite, "SELECT COUNT(*) AS count FROM affiliate_profiles"), 1);
  assert.equal(countRows(fixture.sqlite, "SELECT COUNT(*) AS count FROM audit_events"), 1);
});

test("provisionOwnerTestAccount fails closed when an unrelated member owns the requested email", async () => {
  const fixture = createFixture();
  await createMemberAuthStore(fixture.database, () => now).createMember({
    username: "unrelated_member",
    email: identity.email,
    phone: "+84900000002",
    passwordHash: null,
    emailVerifiedAt: now,
  });

  await assert.rejects(
    provisionOwnerTestAccount({ ...identity, database: fixture.database, now }),
    /conflict/i,
  );
  const member = fixture.sqlite.prepare("SELECT role FROM members WHERE username=?").get("unrelated_member") as { role: string };
  assert.equal(member.role, "USER");
  assert.equal(countRows(fixture.sqlite, "SELECT COUNT(*) AS count FROM credit_grants"), 0);
});
