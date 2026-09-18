import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { createAuthHandlers } from "../lib/auth-handlers";
import { createAuthRateLimiter } from "../lib/auth-rate-limit";
import { SESSION_COOKIE_NAME, createMemberAuthStore, parseCookie, verifyPassword } from "../lib/member-auth";
import { createSqliteD1Database } from "../lib/sqlite-d1";

const migrationSql = readFileSync(new URL("../drizzle/0004_member_auth.sql", import.meta.url), "utf8");
const validRegistration = {
  email: "Reader@Example.test",
  username: "Moon_Rider",
  phone: "+84 912-345-678",
  password: "correct horse battery staple",
};

type SentMail = { to: string; username: string; token: string };

function jsonRequest(path: string, body: unknown, headers: HeadersInit = {}): Request {
  return new Request(`https://natarot.test${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

function createHarness(options: {
  sendVerification?: (message: SentMail) => Promise<void>;
  sendPasswordReset?: (message: SentMail) => Promise<void>;
} = {}) {
  let clock = 1_700_000_000_000;
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(migrationSql);
  const database = createSqliteD1Database(sqlite);
  const verificationMail: SentMail[] = [];
  const resetMail: SentMail[] = [];
  const handlers = createAuthHandlers({
    database,
    now: () => clock,
    rateLimiter: createAuthRateLimiter({ now: () => clock, windowMs: 60_000, maxAttempts: 10 }),
    sendVerification: options.sendVerification ?? (async (message) => { verificationMail.push(message); }),
    sendPasswordReset: options.sendPasswordReset ?? (async (message) => { resetMail.push(message); }),
  });
  return {
    database,
    handlers,
    resetMail,
    setClock(value: number) { clock = value; },
    sqlite,
    store: createMemberAuthStore(database, () => clock),
    verificationMail,
  };
}

async function registerAndVerify(harness: ReturnType<typeof createHarness>) {
  const registration = await harness.handlers.register(jsonRequest("/api/auth/register", validRegistration));
  assert.equal(registration.status, 200);
  const verification = harness.verificationMail.at(-1);
  assert.ok(verification);
  const response = await harness.handlers.verify(new Request(`https://natarot.test/api/auth/verify?token=${encodeURIComponent(verification.token)}`));
  assert.equal(response.status, 303);
}

test("registration creates one unverified member, mails once, and hides duplicate identifiers", async (t) => {
  const harness = createHarness();
  t.after(() => harness.sqlite.close());

  const first = await harness.handlers.register(jsonRequest("/api/auth/register", validRegistration));
  const duplicateEmail = await harness.handlers.register(jsonRequest("/api/auth/register", { ...validRegistration, email: "reader@example.test", username: "another_reader" }));
  const duplicateUsername = await harness.handlers.register(jsonRequest("/api/auth/register", { ...validRegistration, email: "another@example.test", username: "moon_rider" }));

  assert.deepEqual(await first.json(), { ok: true, next: "verify-email" });
  assert.deepEqual(await duplicateEmail.json(), { ok: true, next: "verify-email" });
  assert.deepEqual(await duplicateUsername.json(), { ok: true, next: "verify-email" });
  assert.equal(harness.verificationMail.length, 1);
  assert.equal(harness.verificationMail[0].to, "reader@example.test");
  assert.equal((await harness.store.findByIdentifier("moon_rider"))?.email_verified_at, null);
  assert.equal((await harness.database.prepare("SELECT COUNT(*) AS count FROM members").first<{ count: number }>())?.count, 1);
});

test("registration rejects invalid local credentials without creating a member", async (t) => {
  const harness = createHarness();
  t.after(() => harness.sqlite.close());

  for (const input of [
    { ...validRegistration, username: "bad-name" },
    { ...validRegistration, email: "not-an-email" },
    { ...validRegistration, phone: "0912345678" },
    { ...validRegistration, password: "too-short" },
  ]) {
    const response = await harness.handlers.register(jsonRequest("/api/auth/register", input));
    assert.equal(response.status, 400);
  }

  assert.equal(harness.verificationMail.length, 0);
  assert.equal((await harness.database.prepare("SELECT COUNT(*) AS count FROM members").first<{ count: number }>())?.count, 0);
});

test("verification consumes a token once, redirects locally, and rejects replay or expiry", async (t) => {
  const harness = createHarness();
  t.after(() => harness.sqlite.close());

  await harness.handlers.register(jsonRequest("/api/auth/register", validRegistration));
  const token = harness.verificationMail[0].token;
  const success = await harness.handlers.verify(new Request(`https://natarot.test/api/auth/verify?token=${token}`));
  assert.equal(success.status, 303);
  assert.equal(new URL(success.headers.get("location") ?? "", "https://natarot.test").pathname, "/auth");
  assert.equal(new URL(success.headers.get("location") ?? "", "https://natarot.test").searchParams.get("verified"), "1");
  assert.ok((await harness.store.findByIdentifier("moon_rider"))?.email_verified_at);

  const replay = await harness.handlers.verify(new Request(`https://natarot.test/api/auth/verify?token=${token}`));
  assert.equal(replay.status, 303);
  assert.equal(new URL(replay.headers.get("location") ?? "", "https://natarot.test").searchParams.get("verified"), "0");

  await harness.handlers.register(jsonRequest("/api/auth/register", { ...validRegistration, email: "expired@example.test", username: "expired_user" }));
  const expiredToken = harness.verificationMail.at(-1)?.token;
  assert.ok(expiredToken);
  harness.setClock(1_700_000_000_000 + 8 * 24 * 60 * 60 * 1_000);
  const expired = await harness.handlers.verify(new Request(`https://natarot.test/api/auth/verify?token=${expiredToken}`));
  assert.equal(expired.status, 303);
  assert.equal(new URL(expired.headers.get("location") ?? "", "https://natarot.test").searchParams.get("verified"), "0");
});

test("login uses one generic failure response until a verified active member signs in by email or username", async (t) => {
  const harness = createHarness();
  t.after(() => harness.sqlite.close());

  await harness.handlers.register(jsonRequest("/api/auth/register", validRegistration));
  const failures = await Promise.all([
    harness.handlers.login(jsonRequest("/api/auth/login", { identifier: "unknown", password: validRegistration.password })),
    harness.handlers.login(jsonRequest("/api/auth/login", { identifier: "moon_rider", password: "wrong password" })),
    harness.handlers.login(jsonRequest("/api/auth/login", { identifier: "moon_rider", password: validRegistration.password })),
  ]);
  for (const response of failures) {
    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), { error: "Invalid credentials." });
  }

  await registerAndVerify(harness);
  const member = await harness.store.findByIdentifier("moon_rider");
  assert.ok(member);
  await harness.database.prepare("UPDATE members SET disabled=1 WHERE id=?").bind(member.id).run();
  const disabled = await harness.handlers.login(jsonRequest("/api/auth/login", { identifier: "moon_rider", password: validRegistration.password }));
  assert.equal(disabled.status, 401);
  assert.deepEqual(await disabled.json(), { error: "Invalid credentials." });
  await harness.database.prepare("UPDATE members SET disabled=0 WHERE id=?").bind(member.id).run();

  for (const identifier of [" READER@EXAMPLE.TEST ", " MOON_RIDER "]) {
    const response = await harness.handlers.login(jsonRequest("/api/auth/login", { identifier, password: validRegistration.password }, { "x-forwarded-proto": "https" }));
    assert.equal(response.status, 200);
    assert.match(response.headers.get("set-cookie") ?? "", new RegExp(`${SESSION_COOKIE_NAME}=`));
    assert.match(response.headers.get("set-cookie") ?? "", /; Secure$/);
    const body = await response.json() as {
      ok: boolean;
      member: { username: string; phone?: string; password_hash?: string };
    };
    assert.equal(body.ok, true);
    assert.equal(body.member.username, "moon_rider");
    assert.equal("phone" in body.member, false);
    assert.equal(JSON.stringify(body).includes("password_hash"), false);
  }
});

test("logout revokes the session and me exposes only the authenticated member projection", async (t) => {
  const harness = createHarness();
  t.after(() => harness.sqlite.close());
  await registerAndVerify(harness);

  const login = await harness.handlers.login(jsonRequest("/api/auth/login", { identifier: "moon_rider", password: validRegistration.password }));
  const rawSessionToken = parseCookie(login.headers.get("set-cookie"), SESSION_COOKIE_NAME);
  assert.ok(rawSessionToken);
  const me = await harness.handlers.me(new Request("https://natarot.test/api/auth/me", { headers: { cookie: `${SESSION_COOKIE_NAME}=${rawSessionToken}` } }));
  assert.equal(me.status, 200);
  assert.deepEqual(await me.json(), {
    member: { id: (await harness.store.findByIdentifier("moon_rider"))?.id, username: "moon_rider", email: "reader@example.test", phone: "+84912345678", displayName: null },
  });

  const logout = await harness.handlers.logout(jsonRequest("/api/auth/logout", {}, { cookie: `${SESSION_COOKIE_NAME}=${rawSessionToken}` }));
  assert.equal(logout.status, 200);
  assert.match(logout.headers.get("set-cookie") ?? "", new RegExp(`${SESSION_COOKIE_NAME}=; Max-Age=0`));
  assert.equal(await harness.store.readSession(rawSessionToken), null);
  assert.equal((await harness.handlers.me(new Request("https://natarot.test/api/auth/me", { headers: { cookie: `${SESSION_COOKIE_NAME}=${rawSessionToken}` } }))).status, 401);
});

test("password reset hides account existence, consumes once, changes the hash, and revokes every session", async (t) => {
  const harness = createHarness();
  t.after(() => harness.sqlite.close());
  await registerAndVerify(harness);

  const login = await harness.handlers.login(jsonRequest("/api/auth/login", { identifier: "moon_rider", password: validRegistration.password }));
  const rawSessionToken = parseCookie(login.headers.get("set-cookie"), SESSION_COOKIE_NAME);
  assert.ok(rawSessionToken);
  const known = await harness.handlers.requestPasswordReset(jsonRequest("/api/auth/password-reset/request", { identifier: "MOON_RIDER" }));
  const unknown = await harness.handlers.requestPasswordReset(jsonRequest("/api/auth/password-reset/request", { identifier: "nobody" }));
  assert.deepEqual(await known.json(), { ok: true, next: "check-email" });
  assert.deepEqual(await unknown.json(), { ok: true, next: "check-email" });
  assert.equal(harness.resetMail.length, 1);

  const token = harness.resetMail[0].token;
  const reset = await harness.handlers.confirmPasswordReset(jsonRequest("/api/auth/password-reset/confirm", { token, password: "new secure password" }));
  assert.equal(reset.status, 200);
  assert.deepEqual(await reset.json(), { ok: true, next: "signed-out" });
  const updated = await harness.store.findByIdentifier("moon_rider");
  assert.ok(updated?.password_hash);
  assert.equal(await verifyPassword("new secure password", updated.password_hash), true);
  assert.equal(await harness.store.readSession(rawSessionToken), null);
  assert.equal((await harness.handlers.confirmPasswordReset(jsonRequest("/api/auth/password-reset/confirm", { token, password: "new secure password" }))).status, 400);
});

test("registration mail failure is generic and rolls back the new member and token", async (t) => {
  const harness = createHarness({
    sendVerification: async () => { throw new Error("mail provider unavailable"); },
  });
  t.after(() => harness.sqlite.close());

  const response = await harness.handlers.register(jsonRequest("/api/auth/register", validRegistration));

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true, next: "verify-email" });
  assert.equal((await harness.database.prepare("SELECT COUNT(*) AS count FROM members").first<{ count: number }>())?.count, 0);
  assert.equal((await harness.database.prepare("SELECT COUNT(*) AS count FROM auth_tokens").first<{ count: number }>())?.count, 0);
});

test("reset mail failure is generic for known and unknown identifiers and preserves the account", async (t) => {
  const harness = createHarness({
    sendPasswordReset: async () => { throw new Error("mail provider unavailable"); },
  });
  t.after(() => harness.sqlite.close());
  await registerAndVerify(harness);
  const login = await harness.handlers.login(jsonRequest("/api/auth/login", { identifier: "moon_rider", password: validRegistration.password }));
  const rawSessionToken = parseCookie(login.headers.get("set-cookie"), SESSION_COOKIE_NAME);
  assert.ok(rawSessionToken);

  const known = await harness.handlers.requestPasswordReset(jsonRequest("/api/auth/password-reset/request", { identifier: "MOON_RIDER" }));
  const unknown = await harness.handlers.requestPasswordReset(jsonRequest("/api/auth/password-reset/request", { identifier: "nobody" }));

  assert.equal(known.status, unknown.status);
  assert.deepEqual(await known.json(), { ok: true, next: "check-email" });
  assert.deepEqual(await unknown.json(), { ok: true, next: "check-email" });
  assert.equal((await harness.database.prepare("SELECT COUNT(*) AS count FROM auth_tokens WHERE kind=?").bind("password-reset").first<{ count: number }>())?.count, 0);
  assert.deepEqual(await harness.store.readSession(rawSessionToken), (await harness.store.getPublicMember((await harness.store.findByIdentifier("moon_rider"))?.id ?? "")));
});
