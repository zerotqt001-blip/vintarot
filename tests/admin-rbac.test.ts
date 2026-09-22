import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { requirePermission } from "../lib/admin/context";
import { hasPermission, type AdminRole, type Permission } from "../lib/admin/permissions";
import { listMemberSessions, revokeMemberSession, setMemberRole, setMemberStatus } from "../lib/admin/member-service";
import { createMemberAuthStore } from "../lib/member-auth";
import { createSqliteD1Database } from "../lib/sqlite-d1";

const repoRoot = join(import.meta.dirname, "..");

function database() {
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
  return { sqlite, database: createSqliteD1Database(sqlite) };
}

async function member(database: ReturnType<typeof createSqliteD1Database>, id: string, role: AdminRole) {
  await database.prepare("INSERT INTO members (id, username, email, phone, created_at, updated_at, disabled, role) VALUES (?, ?, ?, ?, ?, ?, 0, ?)")
    .bind(id, id, `${id}@example.test`, "+84912345678", 1, 1, role).run();
  return createMemberAuthStore(database, Date.now).createSession(id, false);
}

function requestFor(raw: string, headers: Record<string, string> = {}): Request {
  return new Request("https://natarot.test/api/admin", { headers: { cookie: `natarot_session=${raw}`, ...headers } });
}

test("the fixed role matrix denies spoofing and enforces every privilege boundary", async () => {
  const fixture = database();
  const sessions = new Map<AdminRole, string>();
  for (const role of ["USER", "SUPPORT", "FINANCE", "CONTENT_ADMIN", "ADMIN", "SUPER_ADMIN"] as AdminRole[]) {
    sessions.set(role, (await member(fixture.database, `member-${role.toLowerCase()}`, role)).raw);
  }
  const checks: Array<[AdminRole, Permission, boolean]> = [
    ["USER", "admin.users.read", false],
    ["SUPPORT", "admin.users.read", true],
    ["SUPPORT", "admin.dashboard.read", true],
    ["SUPPORT", "admin.readings.read", false],
    ["SUPPORT", "admin.credits.adjust", false],
    ["FINANCE", "admin.dashboard.read", true],
    ["FINANCE", "admin.credits.adjust", true],
    ["FINANCE", "admin.roles.manage", false],
    ["CONTENT_ADMIN", "admin.users.read", false],
    ["CONTENT_ADMIN", "admin.dashboard.read", false],
    ["ADMIN", "admin.affiliate.manage", true],
    ["ADMIN", "admin.readings.read", true],
    ["ADMIN", "admin.roles.manage", false],
    ["ADMIN", "admin.security.manage", false],
    ["SUPER_ADMIN", "admin.roles.manage", true],
    ["SUPER_ADMIN", "admin.security.manage", true],
  ];
  for (const [role, permission, allowed] of checks) {
    const request = requestFor(sessions.get(role)!, permission === "admin.users.read" ? { "x-role": "SUPER_ADMIN" } : {});
    if (allowed) {
      const result = await requirePermission(request, permission, fixture.database);
      assert.equal(result.role, role);
    } else {
      await assert.rejects(() => requirePermission(request, permission, fixture.database), (error: unknown) => error instanceof Response && error.status === 403);
    }
  }
  await assert.rejects(() => requirePermission(new Request("https://natarot.test/api/admin", { headers: { "x-role": "SUPER_ADMIN" } }), "admin.users.read", fixture.database), (error: unknown) => error instanceof Response && error.status === 401);
  fixture.sqlite.close();
});

test("disabled members cannot authorize and sessions expose only opaque metadata", async () => {
  const fixture = database();
  const session = await member(fixture.database, "member-support", "SUPPORT");
  const second = await createMemberAuthStore(fixture.database, Date.now).createSession("member-support", false);
  const listed = await listMemberSessions(fixture.database, { memberId: "member-support", role: "SUPPORT", permissions: new Set(["admin.sessions.read"]) });
  assert.equal(listed.length, 2);
  assert.ok(listed.every((row) => row.sessionId && !("tokenHash" in row)));
  assert.ok(listed.every((row) => row.sessionId !== session.raw && row.sessionId !== second.raw));

  await fixture.database.prepare("UPDATE members SET disabled=1, disabled_at=1000, disabled_reason='review', disabled_by='member-support' WHERE id='member-support'").run();
  await assert.rejects(() => requirePermission(requestFor(session.raw), "admin.sessions.read", fixture.database), (error: unknown) => error instanceof Response && error.status === 401);
  fixture.sqlite.close();
});

test("ban, unban, role changes, and targeted session revocation are audited", async () => {
  const fixture = database();
  const actorSession = await member(fixture.database, "member-super", "SUPER_ADMIN");
  const targetSession = await member(fixture.database, "member-target", "USER");
  const targetStore = createMemberAuthStore(fixture.database, Date.now);
  const secondTargetSession = await targetStore.createSession("member-target", false);
  const actor = await requirePermission(requestFor(actorSession.raw), "admin.security.manage", fixture.database);

  const banned = await setMemberStatus(fixture.database, actor, { memberId: "member-target", disabled: true, reason: "abuse review", idempotencyKey: "ban-target-1" });
  assert.equal(banned.disabled, true);
  assert.equal(await targetStore.readSession(targetSession.raw), null);
  assert.equal(await targetStore.readSession(secondTargetSession.raw), null);
  const unbanned = await setMemberStatus(fixture.database, actor, { memberId: "member-target", disabled: false, reason: "review complete", idempotencyKey: "unban-target-1" });
  assert.equal(unbanned.disabled, false);
  const changed = await setMemberRole(fixture.database, actor, { memberId: "member-target", role: "SUPPORT", reason: "support assignment", idempotencyKey: "role-target-1" });
  assert.equal(changed.role, "SUPPORT");
  const freshTargetSession = await targetStore.createSession("member-target", false);
  const targetSessions = await listMemberSessions(fixture.database, actor, "member-target");
  const targetSessionRow = targetSessions.find((row) => row.memberId === "member-target" && row.revokedAt === null);
  assert.ok(targetSessionRow);
  const revoked = await revokeMemberSession(fixture.database, actor, { memberId: "member-target", sessionId: targetSessionRow!.sessionId, reason: "security review", idempotencyKey: "revoke-target-1" });
  assert.equal(revoked, true);
  assert.equal(await targetStore.readSession(freshTargetSession.raw), null);
  assert.equal((await fixture.database.prepare("SELECT COUNT(*) AS count FROM audit_events WHERE actor_id='member-super'").first<{ count: number }>())?.count, 4);
  fixture.sqlite.close();
});

test("permission helper agrees with the documented matrix", () => {
  assert.equal(hasPermission("USER", "admin.users.read"), false);
  assert.equal(hasPermission("SUPPORT", "admin.dashboard.read"), true);
  assert.equal(hasPermission("SUPPORT", "admin.readings.read"), false);
  assert.equal(hasPermission("SUPPORT", "admin.sessions.revoke"), true);
  assert.equal(hasPermission("FINANCE", "admin.affiliate.adjust"), true);
  assert.equal(hasPermission("ADMIN", "admin.readings.read"), true);
  assert.equal(hasPermission("CONTENT_ADMIN", "admin.orders.read"), false);
  assert.equal(hasPermission("ADMIN", "admin.security.manage"), false);
  assert.equal(hasPermission("SUPER_ADMIN", "admin.audit.read"), true);
});
