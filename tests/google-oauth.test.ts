import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { createAuthHandlers } from "../lib/auth-handlers";
import { createGoogleOAuthClient } from "../lib/google-oauth";
import { SESSION_COOKIE_NAME, createMemberAuthStore, digestToken, parseCookie } from "../lib/member-auth";
import { createSqliteD1Database } from "../lib/sqlite-d1";

const migrationSql = readFileSync(new URL("../drizzle/0004_member_auth.sql", import.meta.url), "utf8");
const tokenUrl = "https://oauth2.googleapis.com/token";
const userInfoUrl = "https://openidconnect.googleapis.com/v1/userinfo";

type GoogleResponse = { token?: Record<string, unknown>; userInfo?: Record<string, unknown>; status?: number };

function jsonRequest(path: string, body: unknown): Request {
  return new Request(`https://natarot.test${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function count(database: ReturnType<typeof createSqliteD1Database>, table: "members" | "auth_tokens" | "oauth_states"): Promise<number> {
  return database.prepare(`SELECT COUNT(*) AS count FROM ${table}`).first<{ count: number }>()
    .then((row) => row?.count ?? 0);
}

function createHarness(response: GoogleResponse = {}) {
  let clock = 1_700_000_000_000;
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(migrationSql);
  const database = createSqliteD1Database(sqlite);
  const requests: Array<{ url: string; body: string; authorization: string | null }> = [];
  const fetchImpl: typeof fetch = async (input, init) => {
    const url = String(input);
    const body = typeof init?.body === "string" ? init.body : "";
    requests.push({ url, body, authorization: new Headers(init?.headers).get("authorization") });
    if (url === tokenUrl) {
      return Response.json(response.token ?? { access_token: "provider-access-token", token_type: "Bearer", expires_in: 3600 }, { status: response.status ?? 200 });
    }
    if (url === userInfoUrl) {
      return Response.json(response.userInfo ?? { sub: "google-subject", email: "Reader@Example.test", email_verified: true, name: "Moon Reader" }, { status: response.status ?? 200 });
    }
    throw new Error(`Unexpected fetch URL: ${url}`);
  };
  const store = createMemberAuthStore(database, () => clock);
  const googleOAuth = createGoogleOAuthClient({
    clientId: "google-client-id",
    clientSecret: "google-client-secret",
    redirectUri: "https://natarot.test/api/auth/google/callback",
    fetchImpl,
    now: () => clock,
    store,
  });
  const handlers = createAuthHandlers({
    database,
    now: () => clock,
    rateLimiter: { allow: () => true },
    sendVerification: async () => {},
    sendPasswordReset: async () => {},
    googleOAuth,
  });
  return {
    database,
    googleOAuth,
    handlers,
    requests,
    setClock(value: number) { clock = value; },
    sqlite,
    store,
  };
}

async function beginAndCallback(harness: ReturnType<typeof createHarness>, returnPath = "/profile") {
  const started = await harness.handlers.googleStart(new Request(`https://natarot.test/api/auth/google/start?returnPath=${encodeURIComponent(returnPath)}`));
  assert.equal(started.status, 303);
  const state = new URL(started.headers.get("location") ?? "").searchParams.get("state");
  assert.ok(state);
  const binding = parseCookie(started.headers.get("set-cookie"), "natarot_google_oauth");
  assert.ok(binding);
  return harness.handlers.googleCallback(new Request(`https://natarot.test/api/auth/google/callback?code=good-code&state=${encodeURIComponent(state)}`, { headers: { cookie: `natarot_google_oauth=${binding}` } }));
}

test("Google start stores hashed single-use state and a PKCE challenge", async (t) => {
  const harness = createHarness();
  t.after(() => harness.sqlite.close());

  const start = await harness.googleOAuth.begin("/profile");

  assert.match(start.url, /response_type=code/);
  assert.match(start.url, /scope=openid%20email%20profile/);
  assert.match(start.url, /code_challenge_method=S256/);
  assert.equal(await harness.store.consumeOAuthState("wrong-state"), null);
  assert.ok(await harness.store.consumeOAuthState(start.rawState));
  assert.equal(await harness.store.consumeOAuthState(start.rawState), null);
  const rawStateRow = await harness.database.prepare("SELECT COUNT(*) AS count FROM oauth_states WHERE state_hash=?").bind(start.rawState).first<{ count: number }>();
  assert.equal(rawStateRow?.count, 0);
});

test("Google callback rejects wrong, expired, and replayed states before exchanging a code", async (t) => {
  const harness = createHarness();
  t.after(() => harness.sqlite.close());
  const start = await harness.googleOAuth.begin("/profile");

  const wrong = await harness.handlers.googleCallback(new Request("https://natarot.test/api/auth/google/callback?code=good-code&state=wrong-state"));
  assert.equal(new URL(wrong.headers.get("location") ?? "", "https://natarot.test").href, "https://natarot.test/auth?error=google");
  assert.equal(harness.requests.length, 0);

  const stateCookie = `natarot_google_oauth=${await digestToken(start.rawState)}`;
  const replayFirst = await harness.handlers.googleCallback(new Request(`https://natarot.test/api/auth/google/callback?code=good-code&state=${start.rawState}`, { headers: { cookie: stateCookie } }));
  assert.equal(replayFirst.status, 303);
  const replay = await harness.handlers.googleCallback(new Request(`https://natarot.test/api/auth/google/callback?code=good-code&state=${start.rawState}`, { headers: { cookie: stateCookie } }));
  assert.equal(new URL(replay.headers.get("location") ?? "", "https://natarot.test").href, "https://natarot.test/auth?error=google");

  const expires = await harness.googleOAuth.begin("/journal");
  harness.setClock(1_700_000_000_000 + 11 * 60_000);
  const expired = await harness.handlers.googleCallback(new Request(`https://natarot.test/api/auth/google/callback?code=good-code&state=${expires.rawState}`, { headers: { cookie: `natarot_google_oauth=${await digestToken(expires.rawState)}` } }));
  assert.equal(new URL(expired.headers.get("location") ?? "", "https://natarot.test").href, "https://natarot.test/auth?error=google");
});

test("Google start binds state to the initiating browser and rejects a cross-browser callback", async (t) => {
  const harness = createHarness();
  t.after(() => harness.sqlite.close());

  const start = await harness.handlers.googleStart(new Request("https://natarot.test/api/auth/google/start?returnPath=%2Fprofile"));
  const state = new URL(start.headers.get("location") ?? "").searchParams.get("state");
  assert.ok(state);
  const binding = parseCookie(start.headers.get("set-cookie"), "natarot_google_oauth");
  assert.equal(binding, await digestToken(state));
  assert.doesNotMatch(start.headers.get("set-cookie") ?? "", new RegExp(state));
  assert.match(start.headers.get("set-cookie") ?? "", /HttpOnly; SameSite=Lax; Path=\/; Secure$/);

  const crossBrowser = await harness.handlers.googleCallback(new Request(`https://natarot.test/api/auth/google/callback?code=good-code&state=${encodeURIComponent(state)}`));
  assert.equal(new URL(crossBrowser.headers.get("location") ?? "", "https://natarot.test").href, "https://natarot.test/auth?error=google");
  assert.equal(harness.requests.length, 0);
  assert.equal(await count(harness.database, "members"), 0);
});

test("Google start accepts safe return_to and ignores unsafe destinations", async (t) => {
  const harness = createHarness();
  t.after(() => harness.sqlite.close());

  const safeStart = await harness.handlers.googleStart(new Request("https://natarot.test/api/auth/google/start?return_to=%2Fjournal%3Ftab%3Dsaved"));
  const safeState = new URL(safeStart.headers.get("location") ?? "").searchParams.get("state");
  assert.ok(safeState);
  const safeCookie = parseCookie(safeStart.headers.get("set-cookie"), "natarot_google_oauth");
  assert.ok(safeCookie);
  const safeCallback = await harness.handlers.googleCallback(new Request(`https://natarot.test/api/auth/google/callback?code=good-code&state=${encodeURIComponent(safeState)}`, { headers: { cookie: `natarot_google_oauth=${safeCookie}` } }));
  const safeToken = new URL(safeCallback.headers.get("location") ?? "", "https://natarot.test").searchParams.get("token");
  assert.ok(safeToken);
  const safePayload = await harness.database.prepare("SELECT payload FROM auth_tokens WHERE kind=?").bind("google-completion").first<{ payload: string }>();
  assert.equal(JSON.parse(safePayload?.payload ?? "{}").returnPath, "/journal?tab=saved");

  const unsafeHarness = createHarness();
  t.after(() => unsafeHarness.sqlite.close());
  const unsafeStart = await unsafeHarness.handlers.googleStart(new Request("https://natarot.test/api/auth/google/start?return_to=https%3A%2F%2Fevil.example%2Fsteal"));
  const unsafeState = new URL(unsafeStart.headers.get("location") ?? "").searchParams.get("state");
  assert.ok(unsafeState);
  const unsafeCookie = parseCookie(unsafeStart.headers.get("set-cookie"), "natarot_google_oauth");
  assert.ok(unsafeCookie);
  const unsafeCallback = await unsafeHarness.handlers.googleCallback(new Request(`https://natarot.test/api/auth/google/callback?code=good-code&state=${encodeURIComponent(unsafeState)}`, { headers: { cookie: `natarot_google_oauth=${unsafeCookie}` } }));
  const unsafeToken = new URL(unsafeCallback.headers.get("location") ?? "", "https://natarot.test").searchParams.get("token");
  assert.ok(unsafeToken);
  const unsafePayload = await unsafeHarness.database.prepare("SELECT payload FROM auth_tokens WHERE kind=?").bind("google-completion").first<{ payload: string }>();
  assert.equal(JSON.parse(unsafePayload?.payload ?? "{}").returnPath, "/");
});

test("Google completion uses a relative local redirect behind an HTTPS-terminating proxy", async (t) => {
  const harness = createHarness();
  t.after(() => harness.sqlite.close());
  const started = await harness.handlers.googleStart(new Request("http://backend.test/api/auth/google/start?return_to=%2Fprofile", {
    headers: { "x-forwarded-proto": "https" },
  }));
  const state = new URL(started.headers.get("location") ?? "").searchParams.get("state");
  const cookie = parseCookie(started.headers.get("set-cookie"), "natarot_google_oauth");
  assert.ok(state && cookie);
  const callback = await harness.handlers.googleCallback(new Request(`http://backend.test/api/auth/google/callback?code=good-code&state=${encodeURIComponent(state)}`, {
    headers: { cookie: `natarot_google_oauth=${cookie}`, "x-forwarded-proto": "https" },
  }));
  const location = callback.headers.get("location") ?? "";
  assert.match(location, /^\/auth\/complete\?token=/);
  assert.doesNotMatch(location, /^http:/i);
});

test("Google provider-error callback consumes a browser-bound state and clears its transaction cookie", async (t) => {
  const harness = createHarness();
  t.after(() => harness.sqlite.close());
  const state = await harness.googleOAuth.begin("/profile");
  const cookie = `natarot_google_oauth=${await digestToken(state.rawState)}`;

  const rejected = await harness.handlers.googleCallback(new Request(`https://natarot.test/api/auth/google/callback?error=access_denied&state=${encodeURIComponent(state.rawState)}`, { headers: { cookie } }));

  assert.equal(new URL(rejected.headers.get("location") ?? "", "https://natarot.test").href, "https://natarot.test/auth?error=google");
  assert.match(rejected.headers.get("set-cookie") ?? "", /natarot_google_oauth=; Max-Age=0/);
  assert.equal(await harness.store.consumeOAuthState(state.rawState), null);
});

test("Google token exchange rejects a wrong PKCE verifier without exposing provider details", async (t) => {
  const harness = createHarness({ status: 400, token: { error: "invalid_grant", error_description: "verifier is wrong" } });
  t.after(() => harness.sqlite.close());

  await assert.rejects(harness.googleOAuth.exchange("good-code", "wrong-verifier"), /Google sign-in could not be completed/);
  assert.equal(harness.requests[0]?.url, tokenUrl);
  assert.match(harness.requests[0]?.body ?? "", /code_verifier=wrong-verifier/);
});

test("Google callback safely rejects provider errors and invalid provider identities", async (t) => {
  for (const response of [
    { token: { error: "invalid_grant", error_description: "provider secret" }, status: 400 },
    { userInfo: { email: "reader@example.test", email_verified: true } },
    { userInfo: { sub: "subject", email: "reader@example.test", email_verified: false } },
  ]) {
    const harness = createHarness(response);
    t.after(() => harness.sqlite.close());
    const result = await beginAndCallback(harness);
    const location = result.headers.get("location") ?? "";
    assert.equal(new URL(location, "https://natarot.test").href, "https://natarot.test/auth?error=google");
    assert.doesNotMatch(location, /provider secret|invalid_grant|email_verified/i);
    assert.equal(await count(harness.database, "members"), 0);
  }
});

test("Google callback links a verified member by normalized email and starts a member session", async (t) => {
  const harness = createHarness({ userInfo: { sub: "linked-google-subject", email: "READER@EXAMPLE.TEST", email_verified: true, name: "Reader" } });
  t.after(() => harness.sqlite.close());
  const existing = await harness.store.createMember({
    email: "reader@example.test",
    username: "reader",
    phone: "+84912345678",
    passwordHash: "not-used",
    emailVerifiedAt: 1_700_000_000_000,
  });

  const result = await beginAndCallback(harness, "/journal?tab=saved");

  assert.equal(new URL(result.headers.get("location") ?? "", "https://natarot.test").pathname, "/journal");
  assert.equal(new URL(result.headers.get("location") ?? "", "https://natarot.test").searchParams.get("tab"), "saved");
  const session = parseCookie(result.headers.get("set-cookie"), SESSION_COOKIE_NAME);
  assert.ok(session);
  assert.equal((await harness.store.readSession(session))?.id, existing.id);
  assert.equal((await harness.store.findByGoogleSubject("linked-google-subject"))?.id, existing.id);
});

test("Google callback does not replace a different Google subject already linked to an email match", async (t) => {
  const harness = createHarness({ userInfo: { sub: "incoming-google-subject", email: "reader@example.test", email_verified: true } });
  t.after(() => harness.sqlite.close());
  const existing = await harness.store.createMember({
    email: "reader@example.test",
    username: "reader",
    phone: "+84912345678",
    passwordHash: null,
    googleSubject: "original-google-subject",
    emailVerifiedAt: 1_700_000_000_000,
  });

  const result = await beginAndCallback(harness);

  assert.equal(new URL(result.headers.get("location") ?? "", "https://natarot.test").href, "https://natarot.test/auth?error=google");
  assert.equal((await harness.store.findByIdentifier(existing.email))?.google_subject, "original-google-subject");
  assert.equal(await count(harness.database, "auth_tokens"), 0);
});

test("Google callback signs in an active member already linked to the Google subject", async (t) => {
  const harness = createHarness({ userInfo: { sub: "existing-google-subject", email: "reader@example.test", email_verified: true } });
  t.after(() => harness.sqlite.close());
  const existing = await harness.store.createMember({
    email: "reader@example.test",
    username: "reader",
    phone: "+84912345678",
    passwordHash: null,
    googleSubject: "existing-google-subject",
    emailVerifiedAt: 1_700_000_000_000,
  });

  const result = await beginAndCallback(harness, "/profile");

  assert.equal(new URL(result.headers.get("location") ?? "", "https://natarot.test").pathname, "/profile");
  const session = parseCookie(result.headers.get("set-cookie"), SESSION_COOKIE_NAME);
  assert.ok(session);
  assert.equal((await harness.store.readSession(session))?.id, existing.id);
  assert.equal(await count(harness.database, "members"), 1);
});

test("Google first login creates a completion token with no provider tokens and completion creates a passwordless verified member once", async (t) => {
  const harness = createHarness();
  t.after(() => harness.sqlite.close());

  const callback = await beginAndCallback(harness, "https://evil.example/steal");
  const completionUrl = new URL(callback.headers.get("location") ?? "", "https://natarot.test");
  assert.equal(completionUrl.pathname, "/auth/complete");
  const completionToken = completionUrl.searchParams.get("token");
  assert.ok(completionToken);
  const stored = await harness.database.prepare("SELECT payload FROM auth_tokens WHERE kind=?").bind("google-completion").first<{ payload: string }>();
  assert.deepEqual(JSON.parse(stored?.payload ?? "{}"), {
    subject: "google-subject",
    email: "reader@example.test",
    displayName: "Moon Reader",
    returnPath: "/",
  });
  const persisted = JSON.stringify({
    members: await harness.database.prepare("SELECT * FROM members").all(),
    authTokens: await harness.database.prepare("SELECT * FROM auth_tokens").all(),
    oauthStates: await harness.database.prepare("SELECT * FROM oauth_states").all(),
  });
  assert.doesNotMatch(persisted, /provider-access-token/);

  const complete = await harness.handlers.googleComplete(jsonRequest("/api/auth/google/complete", { token: completionToken, username: "new_reader", phone: "+84 912-345-678" }));
  assert.equal(new URL(complete.headers.get("location") ?? "", "https://natarot.test").pathname, "/");
  const member = await harness.store.findByGoogleSubject("google-subject");
  assert.equal(member?.username, "new_reader");
  assert.equal(member?.phone, "+84912345678");
  assert.equal(member?.password_hash, null);
  assert.ok(member?.email_verified_at);
  assert.ok(parseCookie(complete.headers.get("set-cookie"), SESSION_COOKIE_NAME));

  const replay = await harness.handlers.googleComplete(jsonRequest("/api/auth/google/complete", { token: completionToken, username: "other_reader", phone: "+84987654321" }));
  assert.equal(replay.status, 400);
});

test("Google completion rejects duplicate username, duplicate email, and invalid local identifiers", async (t) => {
  const harness = createHarness();
  t.after(() => harness.sqlite.close());
  await harness.store.createMember({ email: "taken@example.test", username: "taken_name", phone: "+84912345678", passwordHash: "unused", emailVerifiedAt: 1 });

  const first = await beginAndCallback(harness);
  const firstToken = new URL(first.headers.get("location") ?? "", "https://natarot.test").searchParams.get("token");
  assert.ok(firstToken);
  const duplicateUsername = await harness.handlers.googleComplete(jsonRequest("/api/auth/google/complete", { token: firstToken, username: "taken_name", phone: "+84987654321" }));
  assert.equal(duplicateUsername.status, 400);
  const correctedUsername = await harness.handlers.googleComplete(jsonRequest("/api/auth/google/complete", { token: firstToken, username: "corrected_name", phone: "+84987654321" }));
  assert.equal(correctedUsername.status, 303);
  assert.equal((await harness.store.findByIdentifier("corrected_name"))?.email, "reader@example.test");

  const duplicateEmailHarness = createHarness({ userInfo: { sub: "new-subject", email: "late@example.test", email_verified: true } });
  t.after(() => duplicateEmailHarness.sqlite.close());
  const duplicateEmailStart = await beginAndCallback(duplicateEmailHarness);
  const duplicateEmailToken = new URL(duplicateEmailStart.headers.get("location") ?? "", "https://natarot.test").searchParams.get("token");
  assert.ok(duplicateEmailToken);
  await duplicateEmailHarness.store.createMember({ email: "late@example.test", username: "existing_user", phone: "+84911111111", passwordHash: "unused", emailVerifiedAt: 1 });
  const duplicateEmail = await duplicateEmailHarness.handlers.googleComplete(jsonRequest("/api/auth/google/complete", { token: duplicateEmailToken, username: "new_user", phone: "+84922222222" }));
  assert.equal(duplicateEmail.status, 400);

  const invalidHarness = createHarness({ userInfo: { sub: "invalid-subject", email: "invalid@example.test", email_verified: true } });
  t.after(() => invalidHarness.sqlite.close());
  const invalidStart = await beginAndCallback(invalidHarness);
  const invalidToken = new URL(invalidStart.headers.get("location") ?? "", "https://natarot.test").searchParams.get("token");
  assert.ok(invalidToken);
  const invalid = await invalidHarness.handlers.googleComplete(jsonRequest("/api/auth/google/complete", { token: invalidToken, username: "bad-name", phone: "0912345678" }));
  assert.equal(invalid.status, 400);
});

test("Google OAuth rejects a non-HTTPS redirect URI in production", () => {
  assert.throws(() => createGoogleOAuthClient({
    clientId: "google-client-id",
    clientSecret: "google-client-secret",
    redirectUri: "http://natarot.test/api/auth/google/callback",
    fetchImpl: fetch,
    now: Date.now,
    store: createMemberAuthStore(createSqliteD1Database(new DatabaseSync(":memory:"))),
    production: true,
  }), /Google sign-in could not be completed/);
});

test("Google routes are safely unavailable when no client is configured", async (t) => {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(migrationSql);
  t.after(() => sqlite.close());
  const handlers = createAuthHandlers({
    database: createSqliteD1Database(sqlite),
    rateLimiter: { allow: () => true },
    sendVerification: async () => {},
    sendPasswordReset: async () => {},
  });

  const start = await handlers.googleStart(new Request("https://natarot.test/api/auth/google/start"));
  const callback = await handlers.googleCallback(new Request("https://natarot.test/api/auth/google/callback?error=access_denied&error_description=provider-details"));

  assert.equal(start.status, 503);
  assert.deepEqual(await start.json(), { error: "Google sign-in is unavailable." });
  assert.equal(new URL(callback.headers.get("location") ?? "", "https://natarot.test").href, "https://natarot.test/auth?error=google");
});
