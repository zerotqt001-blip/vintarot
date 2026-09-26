import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test, { type TestContext } from "node:test";
import { createMemberAuthStore } from "../lib/member-auth";
import { createSqliteD1Database, type TransactionalD1Database } from "../lib/sqlite-d1";

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
const now = 1_790_000_000_000;
const email = "new-owner@example.test";
const authPasswordHash = "synthetic-pbkdf2-hash-not-a-password";

type FirstOwnerInput = {
  memberId: string;
  email: string;
  identityVerificationRef: string;
  ownerAuthorizationRef: string;
  operatorRef: string;
  backupId: string;
  backupSha256: string;
  restoreVerificationRef: string;
};

type FirstOwnerResult = { memberId: string; revokedSessions: number; auditEventId: string };
type ProvisionFirstOwner = (database: TransactionalD1Database, input: FirstOwnerInput, clock?: () => number) => Promise<FirstOwnerResult>;

function createFixture(context: TestContext) {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec("PRAGMA foreign_keys = ON");
  for (const migration of migrations) sqlite.exec(readFileSync(join(repoRoot, "drizzle", migration), "utf8"));
  context.after(() => sqlite.close());
  return { sqlite, database: createSqliteD1Database(sqlite) as TransactionalD1Database };
}

async function loadProvisioner(): Promise<ProvisionFirstOwner> {
  const importFile = new Function("specifier", "return import(specifier)") as (specifier: string) => Promise<Record<string, unknown>>;
  const moduleUrl = new URL("../lib/owner-bootstrap/provision.ts", import.meta.url).href;
  const loaded = await importFile(moduleUrl).catch(() => null);
  const provision = loaded?.provisionFirstOwner;
  assert.equal(typeof provision, "function", "the first-owner provisioning function should exist");
  return provision as ProvisionFirstOwner;
}

async function insertEligibleOwner(database: TransactionalD1Database, suffix = "") {
  const targetEmail = suffix ? `new-owner-${suffix}@example.test` : email;
  const username = suffix ? `new_owner_${suffix}` : "new_owner";
  const phone = suffix === "disabled" ? "+84900000002" : suffix === "wrong" ? "+84900000005" : "+84900000001";
  const store = createMemberAuthStore(database, () => now);
  const member = await store.createMember({
    username,
    email: targetEmail,
    phone,
    passwordHash: authPasswordHash,
    emailVerifiedAt: now,
  });
  await database.prepare(`INSERT INTO auth_tokens
    (token_hash, kind, member_id, payload, created_at, expires_at, consumed_at)
    VALUES (?, 'email-verification', ?, NULL, ?, ?, ?)`)
    .bind(`synthetic-verification-hash-${member.id}`, member.id, now - 1_000, now + 60_000, now)
    .run();
  const session = await store.createSession(member.id, true);
  return { member, session, store, email: targetEmail };
}

function validInput(memberId: string, targetEmail = email): FirstOwnerInput {
  return {
    memberId,
    email: targetEmail,
    identityVerificationRef: "registry-record-20420927",
    ownerAuthorizationRef: "owner-authorization-20420927",
    operatorRef: "operator-case-20420927",
    backupId: "natarot-production-20420927",
    backupSha256: "a".repeat(64),
    restoreVerificationRef: "restore-check-20420927",
  };
}

function countRows(sqlite: DatabaseSync, sql: string, ...values: Array<string | number>): number {
  const row = sqlite.prepare(sql).get(...values) as { count: number };
  return Number(row.count);
}

test("first-owner provisioning grants only the verified new USER, audits it, and invalidates existing sessions", async (context) => {
  const fixture = createFixture(context);
  const { member, session, store } = await insertEligibleOwner(fixture.database);
  const provisionFirstOwner = await loadProvisioner();

  const result = await provisionFirstOwner(fixture.database, validInput(member.id), () => now + 1);

  assert.deepEqual(result, { memberId: member.id, revokedSessions: 1, auditEventId: result.auditEventId });
  assert.match(result.auditEventId, /^[0-9a-f-]{36}$/i);
  const memberRow = await fixture.database.prepare("SELECT role, email_verified_at, disabled FROM members WHERE id=?")
    .bind(member.id).first<{ role: string; email_verified_at: number | null; disabled: number }>();
  assert.equal(memberRow?.role, "SUPER_ADMIN");
  assert.equal(memberRow?.email_verified_at, now);
  assert.equal(memberRow?.disabled, 0);
  assert.equal(await store.readSession(session.raw), null);

  const audit = await fixture.database.prepare(`SELECT action, actor_kind, actor_id, target_id, reason, idempotency_key, outcome, metadata_json
    FROM audit_events WHERE id=?`).bind(result.auditEventId)
    .first<{ action: string; actor_kind: string; actor_id: string; target_id: string; reason: string; idempotency_key: string; outcome: string; metadata_json: string }>();
  assert.ok(audit);
  assert.equal(audit.action, "member.first_owner.provisioned");
  assert.equal(audit.actor_kind, "system");
  assert.equal(audit.actor_id, "first-owner-provisioner");
  assert.equal(audit.target_id, member.id);
  assert.equal(audit.idempotency_key, "natarot:first-owner:bootstrap:v1");
  assert.equal(audit.outcome, "SUCCESS");
  assert.match(audit.reason, /identity verification/i);
  const metadata = JSON.parse(audit.metadata_json) as Record<string, unknown>;
  assert.deepEqual(metadata, {
    identityVerificationRef: "registry-record-20420927",
    ownerApprovalRecord: "owner-authorization-20420927",
    operatorRef: "operator-case-20420927",
    backupId: "natarot-production-20420927",
    archiveChecksum: "a".repeat(64),
    restoreVerificationRef: "restore-check-20420927",
    verificationMethod: "consumed_app_token",
  });
  assert.doesNotMatch(audit.metadata_json, new RegExp(email));
  assert.doesNotMatch(audit.metadata_json, new RegExp(authPasswordHash));
  assert.equal(result.memberId, member.id);
});

test("first-owner provisioning cannot change an ADMIN or an existing SUPER_ADMIN", async (context) => {
  const fixture = createFixture(context);
  const provisionFirstOwner = await loadProvisioner();
  const admin = await insertEligibleOwner(fixture.database);
  fixture.sqlite.prepare("UPDATE members SET role='ADMIN' WHERE id=?").run(admin.member.id);
  await assert.rejects(provisionFirstOwner(fixture.database, validInput(admin.member.id), () => now + 1), Error);
  assert.equal(countRows(fixture.sqlite, "SELECT COUNT(*) AS count FROM members WHERE id=? AND role='ADMIN'", admin.member.id), 1);

  const nextFixture = createFixture(context);
  const owner = await insertEligibleOwner(nextFixture.database);
  nextFixture.sqlite.prepare(`INSERT INTO members
    (id, username, email, phone, password_hash, email_verified_at, created_at, updated_at, disabled, role)
    VALUES ('existing-super', 'existing_super', 'existing-super@example.test', '+84900000002', 'synthetic-hash', ?, ?, ?, 0, 'SUPER_ADMIN')`)
    .run(now, now, now);
  await assert.rejects(provisionFirstOwner(nextFixture.database, validInput(owner.member.id), () => now + 1), Error);
  assert.equal(countRows(nextFixture.sqlite, "SELECT COUNT(*) AS count FROM members WHERE id=? AND role='USER'", owner.member.id), 1);
  assert.equal(countRows(nextFixture.sqlite, "SELECT COUNT(*) AS count FROM audit_events WHERE action='member.first_owner.provisioned'"), 0);
});

test("first-owner provisioning rejects an Owner QA provisioner target", async (context) => {
  const fixture = createFixture(context);
  const { member, session, store } = await insertEligibleOwner(fixture.database);
  fixture.sqlite.prepare(`INSERT INTO audit_events
    (id, actor_kind, actor_id, action, target_type, target_id, reason, idempotency_key, outcome, metadata_json, created_at)
    VALUES ('qa-event', 'system', 'owner-test-provisioner', 'owner_test.provisioned', 'member', ?, 'internal QA', 'qa:owner:test', 'SUCCESS', '{}', ?)`)
    .run(member.id, now);
  const provisionFirstOwner = await loadProvisioner();

  await assert.rejects(provisionFirstOwner(fixture.database, validInput(member.id), () => now + 1), Error);
  assert.equal(countRows(fixture.sqlite, "SELECT COUNT(*) AS count FROM members WHERE id=? AND role='USER'", member.id), 1);
  assert.ok(await store.readSession(session.raw));
  assert.equal(countRows(fixture.sqlite, "SELECT COUNT(*) AS count FROM audit_events WHERE idempotency_key='natarot:first-owner:bootstrap:v1'"), 0);
});

test("first-owner provisioning requires app-issued email verification for the exact enabled USER", async (context) => {
  const fixture = createFixture(context);
  const provisionFirstOwner = await loadProvisioner();
  const noToken = await createMemberAuthStore(fixture.database, () => now).createMember({
    username: "verified_without_token",
    email: "verified-without-token@example.test",
    phone: "+84900000003",
    passwordHash: authPasswordHash,
    emailVerifiedAt: now,
  });
  await assert.rejects(provisionFirstOwner(fixture.database, { ...validInput(noToken.id), email: "verified-without-token@example.test" }, () => now + 1), Error);
  assert.equal(countRows(fixture.sqlite, "SELECT COUNT(*) AS count FROM members WHERE id=? AND role='USER'", noToken.id), 1);

  const disabled = await insertEligibleOwner(fixture.database, "disabled");
  fixture.sqlite.prepare("UPDATE members SET disabled=1, disabled_at=? WHERE id=?").run(now, disabled.member.id);
  await assert.rejects(provisionFirstOwner(fixture.database, validInput(disabled.member.id, disabled.email), () => now + 1), Error);
  assert.equal(countRows(fixture.sqlite, "SELECT COUNT(*) AS count FROM members WHERE id=? AND role='USER' AND disabled=1", disabled.member.id), 1);

  const wrongEmail = await insertEligibleOwner(fixture.database, "wrong");
  await assert.rejects(provisionFirstOwner(fixture.database, { ...validInput(wrongEmail.member.id, wrongEmail.email), email: "other-owner@example.test" }, () => now + 1), Error);
  assert.equal(countRows(fixture.sqlite, "SELECT COUNT(*) AS count FROM members WHERE id=? AND role='USER'", wrongEmail.member.id), 1);
});

test("first-owner provisioning rejects incomplete identity and backup evidence references", async (context) => {
  const fixture = createFixture(context);
  const { member } = await insertEligibleOwner(fixture.database);
  const provisionFirstOwner = await loadProvisioner();

  for (const input of [
    { ...validInput(member.id), identityVerificationRef: "" },
    { ...validInput(member.id), ownerAuthorizationRef: "" },
    { ...validInput(member.id), operatorRef: "" },
    { ...validInput(member.id), backupId: "" },
    { ...validInput(member.id), restoreVerificationRef: "" },
    { ...validInput(member.id), backupSha256: "not-a-checksum" },
  ]) {
    await assert.rejects(provisionFirstOwner(fixture.database, input, () => now + 1), Error);
  }

  assert.equal(countRows(fixture.sqlite, "SELECT COUNT(*) AS count FROM members WHERE id=? AND role='USER'", member.id), 1);
  assert.equal(countRows(fixture.sqlite, "SELECT COUNT(*) AS count FROM audit_events"), 0);
});

test("first-owner bootstrap is single-use and rejects every replay", async (context) => {
  const fixture = createFixture(context);
  const { member, store } = await insertEligibleOwner(fixture.database);
  const provisionFirstOwner = await loadProvisioner();
  await provisionFirstOwner(fixture.database, validInput(member.id), () => now + 1);
  const postProvisionSession = await store.createSession(member.id, true);

  await assert.rejects(provisionFirstOwner(fixture.database, validInput(member.id), () => now + 2), /already been used/i);
  assert.equal(countRows(fixture.sqlite, "SELECT COUNT(*) AS count FROM audit_events WHERE idempotency_key='natarot:first-owner:bootstrap:v1'"), 1);
  assert.equal(countRows(fixture.sqlite, "SELECT COUNT(*) AS count FROM members WHERE id=? AND role='SUPER_ADMIN'", member.id), 1);
  assert.ok(await store.readSession(postProvisionSession.raw), "a rejected replay must not invalidate later Owner sessions");
});

test("first-owner provisioning rolls back role and session changes when the success audit insert fails", async (context) => {
  const fixture = createFixture(context);
  const { member, session, store } = await insertEligibleOwner(fixture.database);
  fixture.sqlite.exec(`CREATE TRIGGER fail_first_owner_audit BEFORE INSERT ON audit_events
    WHEN NEW.action='member.first_owner.provisioned'
    BEGIN SELECT RAISE(ABORT, 'forced first-owner audit failure'); END;`);
  const provisionFirstOwner = await loadProvisioner();

  await assert.rejects(provisionFirstOwner(fixture.database, validInput(member.id), () => now + 1), /forced first-owner audit failure/);
  assert.equal(countRows(fixture.sqlite, "SELECT COUNT(*) AS count FROM members WHERE id=? AND role='USER'", member.id), 1);
  assert.ok(await store.readSession(session.raw));
  assert.equal(countRows(fixture.sqlite, "SELECT COUNT(*) AS count FROM auth_sessions WHERE member_id=? AND revoked_at IS NOT NULL", member.id), 0);
  assert.equal(countRows(fixture.sqlite, "SELECT COUNT(*) AS count FROM audit_events"), 0);
});
