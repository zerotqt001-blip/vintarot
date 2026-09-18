import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import {
  MemberConflictError,
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_SECONDS,
  buildSessionCookie,
  clearSessionCookie,
  createMemberAuthStore,
  createOpaqueToken,
  digestToken,
  hashPassword,
  loginSchema,
  normalizeEmail,
  normalizePhone,
  normalizeUsername,
  parseCookie,
  registrationSchema,
  resetPasswordSchema,
  safeRelativeReturnPath,
  validatePassword,
  verifyPassword,
} from "../lib/member-auth";
import { createSqliteD1Database } from "../lib/sqlite-d1";

const migrationSql = readFileSync(new URL("../drizzle/0004_member_auth.sql", import.meta.url), "utf8");

function createTestStore(now = () => 1_700_000_000_000) {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(migrationSql);
  return { database: createSqliteD1Database(sqlite), sqlite, now };
}

test("normalizes login identifiers and phone numbers", () => {
  assert.equal(normalizeEmail("  Reader@Example.TEST "), "reader@example.test");
  assert.equal(normalizeUsername("  Moon_Rider "), "moon_rider");
  assert.equal(normalizeUsername("abc"), "abc");
  assert.equal(normalizePhone("+84 912-345-678"), "+84912345678");
  assert.throws(() => normalizePhone("+012345678"));
  assert.throws(() => normalizeUsername("ab"));
  assert.throws(() => normalizeUsername("bad-name"));
  assert.throws(() => normalizePhone("0912345678"));
});

test("password hashes are salted, versioned and reject the wrong password", async () => {
  const first = await hashPassword("correct horse battery staple");
  const second = await hashPassword("correct horse battery staple");
  assert.match(first, /^pbkdf2-sha256\$v1\$600000\$/);
  assert.notEqual(first, second);
  assert.equal(await verifyPassword("correct horse battery staple", first), true);
  assert.equal(await verifyPassword("wrong password", first), false);
});

test("opaque token storage uses a digest and safe relative return paths", async () => {
  const token = await createOpaqueToken();
  assert.notEqual(token.raw, token.hash);
  assert.equal(token.hash, await digestToken(token.raw));
  assert.equal(safeRelativeReturnPath("/journal?tab=saved"), "/journal?tab=saved");
  assert.equal(safeRelativeReturnPath("https://evil.example/steal"), "/");
  assert.equal(safeRelativeReturnPath("//evil.example/steal"), "/");
});

test("validation enforces the member input boundaries", () => {
  assert.equal(validatePassword("1234567890"), "1234567890");
  assert.throws(() => validatePassword("short"));
  assert.throws(() => validatePassword("x".repeat(129)));
  assert.throws(() => normalizeEmail("not-an-email"));
  assert.throws(() => normalizeUsername("bad name"));
  assert.throws(() => normalizePhone("+1234567"));
  assert.throws(() => normalizePhone("+1234567890123456"));
});

test("cookies are parsed literally and session cookie builders set safe attributes", () => {
  assert.equal(parseCookie("foo=bar; natarot_session=raw=token; theme=dark", SESSION_COOKIE_NAME), "raw=token");
  assert.equal(parseCookie("natarot_session=%2Fnot-decoded", SESSION_COOKIE_NAME), "%2Fnot-decoded");
  assert.equal(parseCookie("natarot_session=one; natarot_session=two", SESSION_COOKIE_NAME), "one");
  assert.equal(parseCookie(null, SESSION_COOKIE_NAME), null);
  assert.equal(
    buildSessionCookie("opaque", false),
    `${SESSION_COOKIE_NAME}=opaque; Max-Age=${SESSION_MAX_AGE_SECONDS}; HttpOnly; SameSite=Lax; Path=/`,
  );
  assert.match(buildSessionCookie("opaque", true), /; Secure$/);
  assert.equal(
    clearSessionCookie(false),
    `${SESSION_COOKIE_NAME}=; Max-Age=0; HttpOnly; SameSite=Lax; Path=/`,
  );
});

test("auth schemas accept their exact payload shapes and reject missing fields", () => {
  assert.equal(registrationSchema.parse({
    email: "abc@example.test",
    username: "abc",
    phone: "+84912345678",
    password: "correct horse battery staple",
  }).username, "abc");
  assert.equal(registrationSchema.parse({
    email: "Reader@Example.TEST",
    username: "Moon_Rider",
    phone: "+84912345678",
    password: "correct horse battery staple",
  }).username, "Moon_Rider");
  assert.deepEqual(loginSchema.parse({ identifier: "moon_rider", password: "correct horse battery staple" }), {
    identifier: "moon_rider",
    password: "correct horse battery staple",
  });
  assert.deepEqual(resetPasswordSchema.parse({ token: "opaque", password: "correct horse battery staple" }), {
    token: "opaque",
    password: "correct horse battery staple",
  });
  assert.throws(() => registrationSchema.parse({ email: "reader@example.test" }));
  assert.throws(() => loginSchema.parse({ identifier: "moon_rider" }));
  assert.throws(() => resetPasswordSchema.parse({ token: "opaque", password: "short" }));
});

test("member store normalizes member data and keeps raw session tokens out of SQLite", async (t) => {
  const { database, sqlite, now } = createTestStore();
  t.after(() => sqlite.close());
  const store = createMemberAuthStore(database, now);
  const member = await store.createMember({
    email: "Reader@Example.test",
    username: "Moon_Rider",
    phone: "+84 912-345-678",
    passwordHash: await hashPassword("correct horse battery staple"),
    emailVerifiedAt: null,
  });
  const session = await store.createSession(member.id, false);

  assert.equal((await store.readSession(session.raw))?.id, member.id);
  assert.equal((await database.prepare("SELECT COUNT(*) AS count FROM auth_sessions WHERE token_hash=?").bind(session.raw).first<{ count: number }>())?.count, 0);
  assert.equal((await store.findByIdentifier(" moon_rider "))?.email, "reader@example.test");
  assert.deepEqual(await store.getPublicMember(member.id), member);
  await store.revokeAllSessions(member.id);
  assert.equal(await store.readSession(session.raw), null);
});

test("member store rejects duplicate members and manages member authentication fields", async (t) => {
  const { database, sqlite, now } = createTestStore();
  t.after(() => sqlite.close());
  const store = createMemberAuthStore(database, now);
  const member = await store.createMember({
    email: "reader@example.test",
    username: "reader",
    phone: "+84912345678",
    passwordHash: await hashPassword("correct horse battery staple"),
  });

  await assert.rejects(
    store.createMember({
      email: "READER@example.test",
      username: "another_reader",
      phone: "+84987654321",
      passwordHash: await hashPassword("correct horse battery staple"),
    }),
    MemberConflictError,
  );
  await store.linkGoogleSubject(member.id, "google-subject");
  assert.equal((await store.findByGoogleSubject("google-subject"))?.id, member.id);
  await store.markVerified(member.id);
  await store.markLastLogin(member.id);
  const passwordHash = await hashPassword("another correct password");
  await store.updatePassword(member.id, passwordHash);
  const row = await database.prepare("SELECT email_verified_at, last_login_at, password_hash FROM members WHERE id=?")
    .bind(member.id)
    .first<{ email_verified_at: number; last_login_at: number; password_hash: string }>();
  assert.equal(row?.email_verified_at, now());
  assert.equal(row?.last_login_at, now());
  assert.equal(row?.password_hash, passwordHash);
});

test("member store rejects expired and revoked sessions", async (t) => {
  let clock = 1_700_000_000_000;
  const { database, sqlite } = createTestStore(() => clock);
  t.after(() => sqlite.close());
  const store = createMemberAuthStore(database, () => clock);
  const member = await store.createMember({
    email: "session@example.test",
    username: "session_user",
    phone: "+84912345678",
    passwordHash: await hashPassword("correct horse battery staple"),
  });
  const expired = await store.createSession(member.id, false, 1);
  clock += 2;
  assert.equal(await store.readSession(expired.raw), null);
  const active = await store.createSession(member.id, false);
  await store.revokeSession(active.raw);
  assert.equal(await store.readSession(active.raw), null);
});

test("conditional login sessions cannot survive a password reset", async (t) => {
  const { database, sqlite, now } = createTestStore();
  t.after(() => sqlite.close());
  const store = createMemberAuthStore(database, now);
  const oldHash = await hashPassword("correct horse battery staple");
  const member = await store.createMember({
    email: "race@example.test",
    username: "race_user",
    phone: "+84912345678",
    passwordHash: oldHash,
    emailVerifiedAt: now(),
  });
  const resetToken = await store.createToken({ kind: "password-reset", memberId: member.id, ttlMs: 60_000 });
  const reset = await store.resetPasswordAtomically({
    memberId: member.id,
    tokenHash: await digestToken(resetToken.raw),
    expectedPasswordHash: oldHash,
    passwordHash: await hashPassword("new secure password"),
  });
  assert.equal(reset, true);
  const updated = await database.prepare("SELECT updated_at FROM members WHERE id=?").bind(member.id).first<{ updated_at: number }>();
  assert.equal(updated?.updated_at, now());
  assert.equal(await store.createSessionIfPasswordMatches(member.id, oldHash, true), null);

  const staleSession = await store.createSession(member.id, true);
  const failed = await store.resetPasswordAtomically({
    memberId: member.id,
    tokenHash: await digestToken("missing-token"),
    expectedPasswordHash: oldHash,
    passwordHash: await hashPassword("another secure password"),
  });
  assert.equal(failed, false);
  assert.equal((await store.readSession(staleSession.raw))?.id, member.id);

  const other = await store.createMember({
    email: "other-reset@example.test",
    username: "other_reset",
    phone: "+84987654321",
    passwordHash: await hashPassword("other current password"),
  });
  const otherToken = await store.createToken({ kind: "password-reset", memberId: other.id, ttlMs: 60_000 });
  const currentHash = (await database.prepare("SELECT password_hash FROM members WHERE id=?").bind(member.id).first<{ password_hash: string }>())?.password_hash;
  const wrongMember = await store.resetPasswordAtomically({
    memberId: member.id,
    tokenHash: await digestToken(otherToken.raw),
    expectedPasswordHash: currentHash ?? "",
    passwordHash: await hashPassword("should not apply"),
  });
  assert.equal(wrongMember, false);
  assert.equal((await database.prepare("SELECT password_hash FROM members WHERE id=?").bind(member.id).first<{ password_hash: string }>())?.password_hash, currentHash);
  assert.equal((await database.prepare("SELECT consumed_at FROM auth_tokens WHERE token_hash=?").bind(await digestToken(otherToken.raw)).first<{ consumed_at: number | null }>())?.consumed_at, null);
  assert.equal((await store.readSession(staleSession.raw))?.id, member.id);
});

test("single-use tokens expire and cannot be consumed twice", async (t) => {
  let clock = 1_700_000_000_000;
  const { database, sqlite } = createTestStore(() => clock);
  t.after(() => sqlite.close());
  const store = createMemberAuthStore(database, () => clock);
  const member = await store.createMember({
    email: "token@example.test",
    username: "token_user",
    phone: "+84912345678",
    passwordHash: await hashPassword("correct horse battery staple"),
  });
  const token = await store.createToken({ kind: "email-verification", memberId: member.id, ttlMs: 60_000 });
  assert.equal((await store.consumeToken("email-verification", token.raw))?.memberId, member.id);
  assert.equal(await store.consumeToken("email-verification", token.raw), null);
  const expired = await store.createToken({ kind: "password-reset", memberId: member.id, ttlMs: 1 });
  clock += 2;
  assert.equal(await store.consumeToken("password-reset", expired.raw), null);
});

test("OAuth states are single-use and retain only their stored callback data", async (t) => {
  const { database, sqlite, now } = createTestStore();
  t.after(() => sqlite.close());
  const store = createMemberAuthStore(database, now);
  const state = await store.createOAuthState({ codeVerifier: "verifier", returnPath: "/journal", ttlMs: 60_000 });
  assert.deepEqual(await store.consumeOAuthState(state.raw), { codeVerifier: "verifier", returnPath: "/journal" });
  assert.equal(await store.consumeOAuthState(state.raw), null);
});
