# Member Authentication Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a first-party NaTarot member system where visitors register with email, username, phone and password, verify and recover access by email, sign in by email/username or Google, and own rooms and journal records without ChatGPT sign-in.

**Architecture:** Keep authentication behind small, dependency-injected server modules. `lib/member-auth.ts` owns normalization, Web Crypto password/token primitives, member/session/token persistence and safe cookie handling; `lib/auth-email.ts` owns the Resend boundary; `lib/google-oauth.ts` owns Google state/PKCE and provider exchange. Thin Next route files call testable handlers with the runtime D1/SQLite database and the existing `boundary`, `json` and `originCheck` helpers. Request identity first resolves a valid `natarot_session` to the owner key `member:<member-id>`, then preserves the existing guest cookie behavior.

**Tech Stack:** Next 16.3.4/vinext, React 19, TypeScript, Zod, Cloudflare D1-compatible SQL, Node 22 `node:sqlite`, Web Crypto (`crypto.subtle`), Resend HTTP API, Google OAuth/OIDC authorization-code flow with PKCE, and the repository's `npx tsx --test` test runner.

**Spec:** `docs/superpowers/specs/2026-09-18-member-auth-design.md`

## Global Constraints

- Keep Node.js `>=22.13.0`, the existing Next/vinext runtime, and the existing SQLite-to-D1 adapter; do not add an ORM auth plugin.
- Local registration requires a valid email, a unique case-insensitive username (`a-z`, `0-9`, `_`, 3–24 characters), an E.164 phone number, and a 10–128 character password.
- Store usernames and emails normalized; store the phone in normalized E.164 form; do not use phone for login, OTP or public display in this slice.
- Password hashes use versioned PBKDF2-HMAC-SHA-256 with a random salt and 600,000 iterations; raw passwords never enter logs, responses or persistent storage.
- Store only SHA-256 digests of opaque session, verification, reset and Google-completion tokens; raw values appear only in cookies or links sent to the user.
- Member cookies are `HttpOnly`, `SameSite=Lax`, `Path=/`, `Secure` on HTTPS, and expire after 30 days; reset revokes every existing member session.
- Every POST auth route performs the existing origin check, uses generic account-enumeration-safe responses where the account state is not required, and applies bounded login/register/reset rate limits keyed by identifier and client address.
- Google uses only `openid email profile`, exact configured redirect URI, state and PKCE; no Google access or refresh token is persisted.
- Outbound mail uses `RESEND_API_KEY` and `NATAROT_EMAIL_FROM` from server-only environment variables, defaulting to `NaTarot <noreply@natarot.com>`; secrets never enter Git, tests, browser storage or logs.
- Guests remain supported. A new member never automatically claims old guest rooms, readings or journal rows.
- Remove ChatGPT sign-in from the UI and identity resolution. No auth screen, room prompt, page import or request owner may depend on `getChatGPTUser()` or ChatGPT headers.
- Preserve the NaTarot Moonlight/cosmic visual language and the existing English/Vietnamese locale structure; do not refactor unrelated tarot or visual code.

## File Map

Create these focused units:

- `drizzle/0004_member_auth.sql` — member, session, one-time token and OAuth-state schema only.
- `lib/member-auth.ts` — normalized input schemas, Web Crypto primitives, cookie parsing, member/session/token store and public member projection.
- `lib/auth-email.ts` — injectable Resend sender and bilingual verification/reset messages.
- `lib/google-oauth.ts` — OAuth configuration, PKCE creation, Google token/userinfo exchange and provider response validation.
- `lib/auth-rate-limit.ts` — bounded in-process attempt limiter used by the single VPS process.
- `lib/auth-handlers.ts` — dependency-injected local-auth and Google-completion handlers; route files stay thin.
- `lib/member-page.ts` — server-component helper that reads the member session from Next cookies without importing ChatGPT helpers.
- `app/api/auth/**/route.ts` — the public HTTP surface from the spec.
- `app/auth/page.tsx`, `app/auth/auth.tsx`, `app/auth/complete/page.tsx` — auth screens and interactions.
- `tests/member-auth.test.ts`, `tests/auth-email.test.ts`, `tests/google-oauth.test.ts`, `tests/auth-handlers.test.ts`, `tests/member-auth-ui.test.ts` — focused unit, handler and source-contract coverage.

Modify these existing units:

- `scripts/node-migrate.mjs`, `tests/node-migrate.test.ts` — discover and verify migration `0004`.
- `lib/runtime.ts` — type the server-only Resend/Google environment values.
- `lib/request-identity.ts`, `lib/tarot-guest.ts` — member-session-first identity and guest fallback, with ChatGPT removed.
- `lib/server.ts` — expose the database-aware identity helper without introducing a circular import.
- `app/page.tsx`, `app/[section]/page.tsx`, `app/create/page.tsx`, `app/room/page.tsx` — read the member session for server-rendered props.
- `app/vintarot.tsx`, `app/pages.tsx`, `app/room/room.tsx`, `components/language.tsx`, `lib/i18n.ts`, `app/globals.css` — member-aware navigation, copy, forms and styling.
- `README.md`, `docs/PROJECT_STATE.md` — replace the stale ChatGPT auth description and record deployment/configuration evidence without secrets.
- `app/chatgpt-auth.ts` — delete after all product imports and identity usage are removed.

---

### Task 1: Add the portable member-auth database schema

**Files:**
- Create: `drizzle/0004_member_auth.sql`
- Modify: `scripts/node-migrate.mjs:21`
- Modify: `tests/node-migrate.test.ts:12-26`

**Interfaces:**
- Produces tables and indexes consumed by `createMemberAuthStore()` in Task 3.
- Uses integer millisecond timestamps and `ON DELETE CASCADE` member foreign keys so the same SQL runs through the existing Node SQLite adapter and Cloudflare D1.

- [ ] **Step 1: Write the failing migration assertions**

Extend the existing migration test so the second bootstrap must discover five migrations and the new tables must expose the fields used by the later store. Add assertions like:

```ts
assert.equal(
  (sqlite.prepare("SELECT COUNT(*) AS count FROM natarot_migrations").get() as { count: number }).count,
  5,
);
for (const table of ["members", "auth_sessions", "auth_tokens", "oauth_states"]) {
  assert.equal(
    (sqlite.prepare("SELECT COUNT(*) AS count FROM sqlite_master WHERE type='table' AND name=?").get(table) as { count: number }).count,
    1,
  );
}
assert.deepEqual(
  sqlite.prepare("PRAGMA table_info(members)").all().map((row: any) => row.name),
  ["id", "username", "email", "phone", "display_name", "password_hash", "google_subject", "email_verified_at", "created_at", "updated_at", "last_login_at", "disabled"],
);
```

- [ ] **Step 2: Run the migration test and verify it fails**

Run:

```sh
npx tsx --test tests/node-migrate.test.ts
```

Expected: FAIL because the runner currently applies only four migrations and `members` does not exist.

- [ ] **Step 3: Create the member-auth migration**

Create `drizzle/0004_member_auth.sql` with these exact logical fields and indexes:

```sql
CREATE TABLE `members` (
  `id` text PRIMARY KEY NOT NULL,
  `username` text NOT NULL,
  `email` text NOT NULL,
  `phone` text NOT NULL,
  `display_name` text,
  `password_hash` text,
  `google_subject` text,
  `email_verified_at` integer,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL,
  `last_login_at` integer,
  `disabled` integer DEFAULT 0 NOT NULL
);
CREATE UNIQUE INDEX `idx_members_username` ON `members` (`username`);
CREATE UNIQUE INDEX `idx_members_email` ON `members` (`email`);
CREATE UNIQUE INDEX `idx_members_google_subject` ON `members` (`google_subject`);
CREATE INDEX `idx_members_phone` ON `members` (`phone`);
CREATE TABLE `auth_sessions` (
  `token_hash` text PRIMARY KEY NOT NULL,
  `member_id` text NOT NULL REFERENCES `members`(`id`) ON DELETE CASCADE,
  `created_at` integer NOT NULL,
  `expires_at` integer NOT NULL,
  `last_seen_at` integer NOT NULL,
  `revoked_at` integer
);
CREATE INDEX `idx_auth_sessions_member` ON `auth_sessions` (`member_id`);
CREATE INDEX `idx_auth_sessions_expiry` ON `auth_sessions` (`expires_at`);
CREATE TABLE `auth_tokens` (
  `token_hash` text PRIMARY KEY NOT NULL,
  `kind` text NOT NULL,
  `member_id` text REFERENCES `members`(`id`) ON DELETE CASCADE,
  `payload` text,
  `created_at` integer NOT NULL,
  `expires_at` integer NOT NULL,
  `consumed_at` integer
);
CREATE INDEX `idx_auth_tokens_kind_expiry` ON `auth_tokens` (`kind`, `expires_at`);
CREATE INDEX `idx_auth_tokens_member` ON `auth_tokens` (`member_id`);
CREATE TABLE `oauth_states` (
  `state_hash` text PRIMARY KEY NOT NULL,
  `code_verifier` text NOT NULL,
  `return_path` text NOT NULL,
  `created_at` integer NOT NULL,
  `expires_at` integer NOT NULL,
  `consumed_at` integer
);
CREATE INDEX `idx_oauth_states_expiry` ON `oauth_states` (`expires_at`);
```

The unique index on nullable `google_subject` permits multiple Google-less local members because SQLite/D1 do not treat `NULL` values as equal.

- [ ] **Step 4: Extend the Node migration discovery range**

Change the migration filename filter from `^000[0-3]_.+\\.sql$` to `^000[0-4]_.+\\.sql$`. Do not widen it to arbitrary filenames because seed/build artifacts must not be applied accidentally.

- [ ] **Step 5: Run the migration test and inspect the schema**

Run:

```sh
npx tsx --test tests/node-migrate.test.ts
```

Expected: PASS, five recorded migrations, all four auth tables present, and `PRAGMA foreign_key_check` empty.

- [ ] **Step 6: Commit the schema milestone**

```sh
git add drizzle/0004_member_auth.sql scripts/node-migrate.mjs tests/node-migrate.test.ts
git diff --cached --check
git commit -m "feat: add member authentication schema"
```

### Task 2: Implement validation, password hashing and opaque-token primitives

**Files:**
- Create: `lib/member-auth.ts`
- Create: `tests/member-auth.test.ts`

**Interfaces:**
- Produces `normalizeEmail(value: string): string`, `normalizeUsername(value: string): string`, `normalizePhone(value: string): string`, `validatePassword(value: string): string`, `hashPassword(value: string): Promise<string>`, `verifyPassword(value: string, encoded: string): Promise<boolean>`, `createOpaqueToken(): Promise<{ raw: string; hash: string }>`, `digestToken(raw: string): Promise<string>`, `parseCookie(header: string | null, name: string): string | null`, `safeRelativeReturnPath(value: string): string`, and cookie builders used by later tasks.
- Defines `MemberRow`, `MemberView`, `MemberRegistration`, `AuthTokenKind`, `SESSION_COOKIE_NAME`, `SESSION_MAX_AGE_SECONDS`, and the exact Zod registration/login/reset schemas.

- [ ] **Step 1: Write failing pure-function tests**

Cover the accepted and rejected boundaries before implementation:

```ts
test("normalizes login identifiers and phone numbers", () => {
  assert.equal(normalizeEmail("  Reader@Example.TEST "), "reader@example.test");
  assert.equal(normalizeUsername("  Moon_Rider "), "moon_rider");
  assert.equal(normalizePhone("+84 912-345-678"), "+84912345678");
  assert.throws(() => normalizeUsername("two"));
  assert.throws(() => normalizeUsername("bad-name"));
  assert.throws(() => normalizePhone("0912345678"));
});

test("password hashes are salted, versioned and reject the wrong password", async () => {
  const first = await hashPassword("correct horse battery staple");
  const second = await hashPassword("correct horse battery staple");
  assert.match(first, /^pbkdf2-sha256\\$v1\\$600000\\$/);
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
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run:

```sh
npx tsx --test tests/member-auth.test.ts
```

Expected: FAIL because `lib/member-auth.ts` does not exist.

- [ ] **Step 3: Implement the minimal validation and Web Crypto layer**

Use lowercased trimmed email, lowercased trimmed username, a phone normalizer that removes spaces, hyphens and parentheses but still requires `+` followed by 8–15 digits, and explicit password length checks. Use `crypto.getRandomValues` for salts/tokens and `crypto.subtle.deriveBits` with `{ name: "PBKDF2", hash: "SHA-256", iterations: 600000, salt }`. Encode hashes as `pbkdf2-sha256$v1$600000$<salt-base64url>$<derived-key-base64url>` and compare derived bytes without early-returning on the first differing byte.

Implement the cookie parser without decoding arbitrary values and reject reserved return paths such as `/auth`, `/auth/complete`, `/api/auth/*` and protocol-relative URLs.

- [ ] **Step 4: Run the focused test and verify it passes**

Run:

```sh
npx tsx --test tests/member-auth.test.ts
```

Expected: PASS. Record the measured PBKDF2 verification time in the implementation notes if the VPS benchmark is performed later; do not lower the specified work factor to make tests faster.

- [ ] **Step 5: Commit the crypto milestone**

```sh
git add lib/member-auth.ts tests/member-auth.test.ts
git diff --cached --check
git commit -m "feat: add member auth crypto primitives"
```

### Task 3: Add the member/session/token store and rate limiter

**Files:**
- Modify: `lib/member-auth.ts`
- Create: `lib/auth-rate-limit.ts`
- Modify: `tests/member-auth.test.ts`
- Create: `tests/auth-rate-limit.test.ts`

**Interfaces:**
- `createMemberAuthStore(database: D1Database, now?: () => number)` returns `createMember`, `findByIdentifier`, `findByEmail`, `findByGoogleSubject`, `getPublicMember`, `createSession`, `readSession`, `revokeSession`, `revokeAllSessions`, `createToken`, `consumeToken`, `createOAuthState`, `consumeOAuthState`, `linkGoogleSubject`, `markVerified`, `markLastLogin` and `updatePassword`.
- `createAuthRateLimiter({ now, windowMs, maxAttempts })` returns `allow(key): boolean` and `clear(): void`; the implementation prunes expired entries and caps retained keys so a hostile address cannot grow memory without bound.

- [ ] **Step 1: Write failing store tests against an in-memory D1 adapter**

Create a `DatabaseSync(":memory:")`, run the contents of `drizzle/0004_member_auth.sql`, wrap it with `createSqliteD1Database`, and verify:

```ts
test("member store normalizes member data and keeps raw session tokens out of SQLite", async () => {
  const store = createMemberAuthStore(database, () => 1_700_000_000_000);
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
  await store.revokeAllSessions(member.id);
  assert.equal(await store.readSession(session.raw), null);
});

test("single-use tokens expire and cannot be consumed twice", async () => {
  const store = createMemberAuthStore(database, () => 1_700_000_000_000);
  const member = await store.createMember({
    email: "token@example.test",
    username: "token_user",
    phone: "+84912345678",
    passwordHash: await hashPassword("correct horse battery staple"),
    emailVerifiedAt: null,
  });
  const token = await store.createToken({ kind: "email-verification", memberId: member.id, ttlMs: 60_000 });
  assert.equal((await store.consumeToken("email-verification", token.raw))?.memberId, member.id);
  assert.equal(await store.consumeToken("email-verification", token.raw), null);
});
```

- [ ] **Step 2: Run the store tests and verify they fail**

Run:

```sh
npx tsx --test tests/member-auth.test.ts
```

Expected: FAIL because store methods are not defined.

- [ ] **Step 3: Implement the D1-compatible store**

Insert normalized member rows with `crypto.randomUUID()`, map SQLite uniqueness errors to a typed `MemberConflictError`, and return only `MemberView` values to UI-facing callers. Store sessions and one-time tokens by `digestToken(raw)`. A session is valid only when `revoked_at IS NULL` and `expires_at > now`; update `last_seen_at` after a successful lookup. Consume a token with a conditional update requiring `consumed_at IS NULL` and `expires_at > now`, then return its payload only if the update changed one row. Consume OAuth state with the same conditional-update pattern and return its stored verifier/return path.

Use `natarot_session` for the cookie. The session cookie builder must emit `Max-Age=2592000; HttpOnly; SameSite=Lax; Path=/` and append `Secure` for HTTPS. The clear-cookie builder must use `Max-Age=0` and the same path/security attributes.

- [ ] **Step 4: Add the bounded attempt limiter**

Implement a per-process map keyed by a stable combination such as `login:<normalized-identifier>:<client-address>`. Retain timestamps only inside the active window, return `false` after the configured maximum, and prune the oldest key when the map reaches its hard cap. Do not log identifiers, addresses or passwords.

- [ ] **Step 5: Run all store and limiter tests and verify they pass**

Run:

```sh
npx tsx --test tests/member-auth.test.ts tests/auth-rate-limit.test.ts
```

Expected: PASS, including expired-session, revoked-session, duplicate-member, token-replay and limiter-window cases.

- [ ] **Step 6: Commit the persistence milestone**

```sh
git add lib/member-auth.ts lib/auth-rate-limit.ts tests/member-auth.test.ts tests/auth-rate-limit.test.ts
git diff --cached --check
git commit -m "feat: add member sessions and auth tokens"
```

### Task 4: Add the Resend email boundary

**Files:**
- Create: `lib/auth-email.ts`
- Create: `tests/auth-email.test.ts`
- Modify: `lib/runtime.ts:4-8`

**Interfaces:**
- `createAuthEmailSender({ fetchImpl, apiKey, from, origin })` returns `sendVerification({ to, username, token })` and `sendPasswordReset({ to, username, token })`.
- The sender posts to `https://api.resend.com/emails` with `Authorization: Bearer <server-key>` and a JSON body containing `from`, `to`, subject, bilingual text and HTML, with links built from the configured HTTPS origin.

- [ ] **Step 1: Write the fake-fetch contract tests**

Capture the request without contacting Resend and assert the sender, recipient, subject, one-time link path and bilingual copy. Also assert a missing key throws a safe configuration error and a non-2xx response throws without including the API key or token in the error message.

```ts
test("verification mail uses the configured sender and one-time link", async () => {
  const calls: RequestInit[] = [];
  const sender = createAuthEmailSender({
    apiKey: "test-only-key",
    from: "NaTarot <noreply@natarot.com>",
    origin: "https://natarot.com",
    fetchImpl: async (_url, init) => { calls.push(init); return new Response("{}", { status: 200 }); },
  });
  await sender.sendVerification({ to: "reader@example.test", username: "moon_rider", token: "opaque-test-token" });
  const body = JSON.parse(String(calls[0].body));
  assert.equal(body.from, "NaTarot <noreply@natarot.com>");
  assert.deepEqual(body.to, ["reader@example.test"]);
  assert.match(body.html, /\\/api\\/auth\\/verify\\?token=opaque-test-token/);
  assert.match(body.text, /Xác minh|verify/i);
});
```

- [ ] **Step 2: Run the email test and verify it fails**

Run:

```sh
npx tsx --test tests/auth-email.test.ts
```

Expected: FAIL because the email boundary is not present.

- [ ] **Step 3: Implement safe Resend request construction**

Use `encodeURIComponent` for all values inserted into links, keep the API key only in the authorization header, and expose only status code plus a safe provider error category to callers. Build separate English/Vietnamese subject/body text for verification and reset. Never include phone numbers, passwords, raw reset tokens or authorization headers in thrown errors or logs.

- [ ] **Step 4: Extend runtime environment typing**

Add optional `RESEND_API_KEY`, `NATAROT_EMAIL_FROM`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` and `GOOGLE_REDIRECT_URI` fields to `RuntimeEnvironment`. Do not add values to source, `.env`, tests or documentation examples.

- [ ] **Step 5: Run email tests and type-check the boundary**

Run:

```sh
npx tsx --test tests/auth-email.test.ts
npx tsc --noEmit
```

Expected: PASS with no network request, and TypeScript accepts the expanded environment type.

- [ ] **Step 6: Commit the email milestone**

```sh
git add lib/auth-email.ts tests/auth-email.test.ts lib/runtime.ts
git diff --cached --check
git commit -m "feat: add Resend auth email boundary"
```

### Task 5: Implement local registration, verification, login, logout, profile and reset handlers

**Files:**
- Create: `lib/auth-handlers.ts`
- Create: `app/api/auth/register/route.ts`
- Create: `app/api/auth/verify/route.ts`
- Create: `app/api/auth/login/route.ts`
- Create: `app/api/auth/logout/route.ts`
- Create: `app/api/auth/me/route.ts`
- Create: `app/api/auth/password-reset/request/route.ts`
- Create: `app/api/auth/password-reset/confirm/route.ts`
- Create: `tests/auth-handlers.test.ts`

**Interfaces:**
- `createAuthHandlers(dependencies)` returns `register(request)`, `verify(request)`, `login(request)`, `logout(request)`, `me(request)`, `requestPasswordReset(request)` and `confirmPasswordReset(request)`.
- Dependencies include a D1 database, `sendVerification`, `sendPasswordReset`, a clock, an auth rate limiter and `fetch`-independent configuration, so tests never import the live runtime database or Resend key.
- Route files export the returned handler using the existing `boundary`; POST handlers call `originCheck` before parsing JSON and all JSON responses use the existing `json()` size/error behavior.

- [ ] **Step 1: Write failing handler tests for the complete local flow**

Use an in-memory migrated database and fake mail callbacks. Cover:

1. Valid registration creates one unverified member, sends one verification link and returns the same generic success shape for a duplicate email or username.
2. Invalid username, email, E.164 phone and password return 400 without inserting a member.
3. Verification succeeds once, updates `email_verified_at`, redirects to `/auth?verified=1`, and rejects replay/expiry.
4. Login is rejected before verification and returns the same generic 401 for an unknown identifier, wrong password, disabled member and unverified member.
5. Verified login succeeds with both normalized email and normalized username, sets a `natarot_session` cookie, and never returns the password hash or phone in the login response.
6. Logout revokes the current digest and clears the cookie; `/api/auth/me` returns only the authenticated member projection or 401.
7. Reset request is generic for known and unknown identifiers; known members receive a reset link. Reset confirmation consumes once, updates the hash and revokes all old sessions.

Example assertions:

```ts
assert.deepEqual(await response.json(), { ok: true, next: "verify-email" });
assert.match(response.headers.get("set-cookie") ?? "", /natarot_session=/);
assert.equal((await store.readSession(rawSessionToken)), null);
assert.equal(resetResponse.status, 200);
assert.equal(await verifyPassword("new secure password", updatedHash), true);
```

- [ ] **Step 2: Run the handler tests and verify they fail**

Run:

```sh
npx tsx --test tests/auth-handlers.test.ts
```

Expected: FAIL because the handlers and route-independent dependency boundary do not exist.

- [ ] **Step 3: Implement registration and verification**

Parse with Zod, normalize before lookup/insert, and generate an email-verification token with a bounded expiry. Insert the member with `password_hash`, `email_verified_at = NULL`, `disabled = 0`; send mail after the insert succeeds. Return `{ ok: true, next: "verify-email" }` for valid registration whether or not a normalized email/username already exists, and do not send mail or reveal the reason for duplicate data. The GET verifier consumes the token conditionally and redirects only to the fixed local auth result path.

- [ ] **Step 4: Implement login, logout and current-member lookup**

Read `identifier` and `password`, look up email or username through the same normalized path, verify the versioned hash, require `email_verified_at` and `disabled = 0`, update `last_login_at`, create a new session and set the secure cookie based on the request URL or forwarded HTTPS header. For all failures use one generic 401 response. Logout revokes the digest if present and always clears the cookie. `/api/auth/me` returns `id`, `username`, `email`, `phone` and display name only after a valid session; the phone is available only to the same authenticated member.

- [ ] **Step 5: Implement password-reset request and confirmation**

Normalize the identifier, apply the limiter, and always return `{ ok: true, next: "check-email" }` for syntactically valid requests. Send a reset email only for an existing non-disabled member with a password hash. Confirmation validates the token and new password, updates the hash, revokes all member sessions, consumes the token, and returns `{ ok: true, next: "signed-out" }` without automatically logging in.

- [ ] **Step 6: Add thin Next route files**

Each route should be a small adapter that imports `db()`, `runtimeEnv`, the sender factory and `createAuthHandlers`, then exports the corresponding function. Keep Google routes out of this task. Ensure GET verification returns a redirect response and never emits an auth token in JSON.

- [ ] **Step 7: Run the handler tests and verify they pass**

Run:

```sh
npx tsx --test tests/auth-handlers.test.ts
```

Expected: PASS for validation, generic failures, verification, email/username login, secure cookie, logout, reset revocation and token replay.

- [ ] **Step 8: Commit the local-auth API milestone**

```sh
git add lib/auth-handlers.ts app/api/auth tests/auth-handlers.test.ts
git diff --cached --check
git commit -m "feat: add local member auth routes"
```

### Task 6: Add Google OAuth/OIDC with state, PKCE and first-login completion

**Files:**
- Create: `lib/google-oauth.ts`
- Create: `app/api/auth/google/start/route.ts`
- Create: `app/api/auth/google/callback/route.ts`
- Create: `app/api/auth/google/complete/route.ts`
- Create: `tests/google-oauth.test.ts`
- Modify: `lib/auth-handlers.ts`

**Interfaces:**
- `createGoogleOAuthClient({ clientId, clientSecret, redirectUri, fetchImpl, now })` exposes `begin(returnPath)`, `exchange(code, verifier)`, and `readVerifiedIdentity(accessToken)`.
- Google identity shape is `{ subject: string; email: string; displayName: string | null }`; reject missing subject/email and any `email_verified` value other than `true`.
- `begin()` stores only a hashed state, PKCE verifier, safe return path, timestamps and expiry in `oauth_states`; the raw state is returned only in the authorization URL.

- [ ] **Step 1: Write failing Google protocol tests**

Use fake fetch responses and an in-memory store. Assert:

```ts
const start = await client.begin("/profile");
assert.match(start.url, /response_type=code/);
assert.match(start.url, /scope=openid%20email%20profile/);
assert.match(start.url, /code_challenge_method=S256/);
assert.equal(await store.consumeOAuthState("wrong-state"), null);
assert.ok(await store.consumeOAuthState(start.rawState));
assert.equal(await store.consumeOAuthState(start.rawState), null); // the second consumption is rejected
```

Also cover wrong state, expired state, callback replay, wrong PKCE verifier, provider error, missing subject, unverified email and a non-HTTPS production redirect configuration. Assert the fake token response is never inserted into `members`, `auth_tokens` or `oauth_states`.

- [ ] **Step 2: Run the Google test and verify it fails**

Run:

```sh
npx tsx --test tests/google-oauth.test.ts
```

Expected: FAIL because the Google client and routes do not exist.

- [ ] **Step 3: Implement state and PKCE creation**

Generate a random state and verifier, derive the S256 challenge with Web Crypto, validate the return path with `safeRelativeReturnPath`, and create the authorization URL with only `openid email profile`. Require `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` and a configured redirect URI in production. Allow an HTTPS request-derived callback only for local tests/development when the explicit environment value is absent.

- [ ] **Step 4: Implement the provider exchange and verified identity read**

POST the authorization code to `https://oauth2.googleapis.com/token` with client ID, client secret, redirect URI and verifier. Use the returned access token only for the request to `https://openidconnect.googleapis.com/v1/userinfo`; validate `sub`, normalized email and `email_verified === true`, then discard the response/token after the handler finishes. Provider failures become safe auth errors without copying provider payloads to the client.

- [ ] **Step 5: Implement callback linking and completion token flow**

The callback consumes state before accepting the code. If the Google subject is already linked to an active member, issue a fresh member session and redirect to the stored local path. If the verified email matches an existing verified member, link the subject atomically and issue the session. Otherwise create a short-lived `google-completion` token whose server-side payload contains only subject, normalized email, display name and safe return path, then redirect to `/auth/complete?token=...`.

The completion handler consumes that token, validates unique username and E.164 phone, creates the Google member with `password_hash = NULL` and `email_verified_at = now`, issues the session, and redirects only to the payload's local path. It must reject duplicate username, duplicate email, replayed/expired token and unverified provider identity.

- [ ] **Step 6: Add thin Google route files and environment access**

Wire the three route files to the shared handlers. `GET /api/auth/google/start` must return a safe 503 when configuration is absent instead of exposing a stack trace. `GET /api/auth/google/callback` must redirect provider errors to `/auth?error=google`; it must not render raw provider errors.

- [ ] **Step 7: Run Google tests and verify they pass**

Run:

```sh
npx tsx --test tests/google-oauth.test.ts
```

Expected: PASS for state/PKCE, provider validation, link-existing-member, first-time completion, replay rejection and token non-persistence.

- [ ] **Step 8: Commit the Google milestone**

```sh
git add lib/google-oauth.ts lib/auth-handlers.ts app/api/auth/google tests/google-oauth.test.ts
git diff --cached --check
git commit -m "feat: add Google member sign-in"
```

### Task 7: Switch request identity and ownership to member sessions while preserving guests

**Files:**
- Modify: `lib/request-identity.ts`
- Modify: `lib/tarot-guest.ts`
- Modify: `lib/server.ts`
- Modify: `app/api/rooms/route.ts:89-95`
- Modify: `tests/request-identity.test.ts`
- Modify: `tests/tarot-guest.test.ts`
- Modify: `tests/room-guest-persistence.test.ts`

**Interfaces:**
- `readRequestIdentity(request, database?)` checks a valid `natarot_session` first, then returns the existing guest identity and cookie.
- `readOptionalOwner(request, database?)` returns `{ owner, member?, setCookie? }`; member owners use `{ kind: "user", userId: "member:<member-id>" }`, while guests retain `{ kind: "guest", guestId }`.
- The existing room, records and tarot repositories continue receiving a `ReadingOwner`; no guest rows are migrated or claimed.

- [ ] **Step 1: Write failing identity tests**

Add a migrated in-memory member/session fixture and assert:

```ts
const memberIdentity = await readRequestIdentity(
  new Request("https://natarot.com/api/rooms", { headers: { Cookie: `natarot_session=${rawSession}` } }),
  database,
);
assert.equal(memberIdentity.userId, `member:${member.id}`);
assert.equal(memberIdentity.owner.kind, "user");
assert.equal(memberIdentity.owner.userId, `member:${member.id}`);
```

Change the old ChatGPT-header test to prove those headers are ignored and produce a guest identity. Keep the stable guest-cookie test and assert an invalid/expired member cookie falls back to a guest rather than impersonating a member.

- [ ] **Step 2: Run identity tests and verify the expected failure**

Run:

```sh
npx tsx --test tests/request-identity.test.ts tests/tarot-guest.test.ts
```

Expected: FAIL because the current code trusts ChatGPT headers and has no member session lookup.

- [ ] **Step 3: Implement member-first identity resolution**

Remove `getChatGPTUser`, ChatGPT header parsing and the context fallback from `lib/request-identity.ts` and `lib/tarot-guest.ts`. Resolve the member session through the store, expose `displayName`, `email`, `fullName` and the `member:<id>` owner key, then use the current guest cookie code only when no valid member exists. Preserve `attachIdentityCookie` for guest responses.

- [ ] **Step 4: Update room member labels**

Use `user.displayName` for `room_members.name` instead of deriving a label from a ChatGPT-only `fullName` field. Keep the owner comparisons on `user.userId`, so a member's room/journal ownership is automatically isolated under `member:<id>`.

- [ ] **Step 5: Run identity and regression tests**

Run:

```sh
npx tsx --test tests/request-identity.test.ts tests/tarot-guest.test.ts tests/room-guest-persistence.test.ts tests/tarot-api-contract.test.ts
```

Expected: PASS for member sessions, invalid-session guest fallback, ignored ChatGPT headers, guest persistence and existing tarot owner contracts.

- [ ] **Step 6: Commit the identity milestone**

```sh
git add lib/request-identity.ts lib/tarot-guest.ts lib/server.ts app/api/rooms/route.ts tests/request-identity.test.ts tests/tarot-guest.test.ts tests/room-guest-persistence.test.ts
git diff --cached --check
git commit -m "feat: use member sessions for request ownership"
```

### Task 8: Replace ChatGPT page identity and add the member-aware shell

**Files:**
- Create: `lib/member-page.ts`
- Modify: `app/page.tsx`
- Modify: `app/[section]/page.tsx`
- Modify: `app/create/page.tsx`
- Modify: `app/room/page.tsx`
- Modify: `app/vintarot.tsx`
- Modify: `app/pages.tsx`
- Modify: `app/room/room.tsx`
- Modify: `components/language.tsx`
- Delete: `app/chatgpt-auth.ts`
- Modify: `README.md`
- Create: `tests/member-auth-ui.test.ts`

**Interfaces:**
- `getPageMember(): Promise<MemberView | null>` reads Next's cookie store and delegates to the database-aware session lookup; it is used only in server components.
- UI user props become `{ name: string; email: string; username: string; phone?: string } | null`; phone is used only on the private account screen and never passed to public room/card/invite copy.

- [ ] **Step 1: Write failing UI/source-contract tests**

Assert that page sources no longer import `getChatGPTUser`, the shell links guests to `/auth`, room/page empty states use member-auth copy, the auth UI files exist, and no source under `app/` or `lib/` contains `/signin-with-chatgpt` or ChatGPT owner resolution. Keep tests focused on this feature rather than asserting the full rendered DOM.

- [ ] **Step 2: Run the UI contract test and verify it fails**

Run:

```sh
npx tsx --test tests/member-auth-ui.test.ts
```

Expected: FAIL because the current pages still import ChatGPT helpers and link to `/signin-with-chatgpt`.

- [ ] **Step 3: Add the server page member helper and replace page imports**

Implement `getPageMember()` using `cookies()` and `getMemberFromCookieHeader`. Update the four server page entrypoints to pass the member projection or `null` to `VinTarot`, `Pages`, `Room` and `LanguageProvider`. Keep `dynamic = "force-dynamic"` because page output depends on the session cookie.

- [ ] **Step 4: Update navigation and protected empty states**

In `app/vintarot.tsx`, send a guest avatar/name link to `/auth?return_to=/profile` and authenticated users to `/profile`; keep member username in the personal nav. In `app/pages.tsx` and `app/room/room.tsx`, replace every ChatGPT sign-in link with `/auth?return_to=<same-local-path>`. Change `room.signInSpace` and `common.signIn` copy to member sign-in language. Keep guest reading and room creation available where they were previously available.

- [ ] **Step 5: Update the private profile projection**

Keep email and phone available only on the authenticated profile screen, with the phone rendered as a read-only customer-care contact field. Do not include phone in room invites, public reader cards, journal list items or the shell's `User` display object. Add a logout action that posts `/api/auth/logout` and then navigates to `/auth`.

- [ ] **Step 6: Remove the ChatGPT helper and stale documentation**

Delete `app/chatgpt-auth.ts` after all imports are gone. Replace the README's product-auth description with the member routes and server-only environment names; remove instructions that direct a user to `/signin-with-chatgpt` while retaining unrelated starter/runtime documentation. Do not add real secret values.

- [ ] **Step 7: Run the UI contract and regression tests**

Run:

```sh
npx tsx --test tests/member-auth-ui.test.ts tests/i18n.test.ts tests/room-guest-persistence.test.ts tests/mobile-navigation.test.ts
```

Expected: PASS with no ChatGPT auth import/link in product code and existing navigation/guest tests intact.

- [ ] **Step 8: Commit the page-identity milestone**

```sh
git add lib/member-page.ts app/page.tsx 'app/[section]/page.tsx' app/create/page.tsx app/room/page.tsx app/vintarot.tsx app/pages.tsx app/room/room.tsx components/language.tsx README.md tests/member-auth-ui.test.ts
git rm app/chatgpt-auth.ts
git diff --cached --check
git commit -m "feat: replace ChatGPT page auth with members"
```

### Task 9: Build the bilingual auth screens and Google completion form

**Files:**
- Create: `app/auth/page.tsx`
- Create: `app/auth/auth.tsx`
- Create: `app/auth/complete/page.tsx`
- Modify: `lib/i18n.ts`
- Modify: `app/globals.css`
- Modify: `tests/member-auth-ui.test.ts`

**Interfaces:**
- `/auth` accepts only safe local `return_to` values and renders login, register, verification-pending, forgot-password and reset-password states based on query parameters.
- `/auth/complete?token=...` renders username and phone fields and posts `{ token, username, phone }` to `/api/auth/google/complete`; it never stores the Google token in local storage.
- Google entry is a normal top-level anchor to `/api/auth/google/start?return_to=...`, not a client-side fetch.

- [ ] **Step 1: Extend locale tests before adding UI copy**

Add assertions that every auth key exists in both English and Vietnamese dictionaries and that `messageFor()` resolves the login, phone, verification, reset and Google-completion labels. Use these concrete key groups:

```text
auth.loginTitle, auth.registerTitle, auth.email, auth.username, auth.phone,
auth.password, auth.identifier, auth.submitLogin, auth.submitRegister,
auth.google, auth.forgotPassword, auth.resetPassword, auth.sendReset,
auth.verifyPending, auth.verifySuccess, auth.genericError, auth.logout,
auth.completeTitle, auth.completeHelp, auth.phonePrivacy
```

English values should use phrases such as “Sign in”, “Create your account”, “Phone number”, “Continue with Google” and “Check your email”; Vietnamese values should use “Đăng nhập”, “Tạo tài khoản”, “Số điện thoại”, “Tiếp tục với Google” and “Kiểm tra email”. Keep all values in the dictionary rather than inline JSX.

- [ ] **Step 2: Run the locale test and verify the new keys fail**

Run:

```sh
npx tsx --test tests/i18n.test.ts
```

Expected: FAIL until both locale dictionaries contain the auth keys.

- [ ] **Step 3: Add the auth translations and update existing sign-in copy**

Add the full `auth` object to both locale branches, replace ChatGPT-specific `common.signIn`, `room.signInSpace` and page empty-state copy, and keep error messages generic enough not to expose account existence.

- [ ] **Step 4: Implement the server wrappers and client form state**

Make `app/auth/page.tsx` a dynamic server wrapper that passes validated `returnTo`, `verified`, `error` and `token` query values to `AuthScreen`. In `auth.tsx`, use controlled forms for login/register/forgot/reset, show only one state at a time, call the JSON API helper, show the generic response, and navigate with `window.location.assign` after a successful session cookie response. Include visible labels and `aria-live` status text for failures/success.

- [ ] **Step 5: Implement Google completion and the private phone notice**

Render the Google button as a top-level link. The completion screen must require username and phone, explain that the phone is used for NaTarot customer care and not public display, and redirect to the server-provided local destination after success. Never echo the token into the DOM beyond the form submission value or persist it client-side.

- [ ] **Step 6: Add Moonlight-consistent responsive auth styling**

Add small, scoped classes in `app/globals.css` for the auth card, form rows, provider button, status/error states and mobile layout. Reuse the existing border, radius, muted text, black action and cosmic surface tokens; keep focus outlines visible and preserve the existing mobile breakpoints. Do not alter unrelated tarot/card styles.

- [ ] **Step 7: Run focused UI tests and type-check**

Run:

```sh
npx tsx --test tests/i18n.test.ts tests/member-auth-ui.test.ts
npx tsc --noEmit
```

Expected: PASS, with the auth fields and routes present, translations complete, no token persistence and no ChatGPT copy.

- [ ] **Step 8: Commit the auth UI milestone**

```sh
git add app/auth lib/i18n.ts app/globals.css tests/i18n.test.ts tests/member-auth-ui.test.ts
git diff --cached --check
git commit -m "feat: add bilingual member auth screens"
```

### Task 10: Verify integration, deployment configuration and production readiness

**Files:**
- Modify: `docs/PROJECT_STATE.md`
- Modify: `tests/deployment-contract.test.ts` when environment/name coverage is needed
- Modify: `README.md` if the final commands or migration instructions require correction

**Interfaces:**
- Produces a verified branch with local migration, auth, guest regression, TypeScript, lint and production-build evidence.
- Leaves Google secrets as an explicit external deployment prerequisite: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI=https://natarot.com/api/auth/google/callback`.

- [ ] **Step 1: Run the complete focused and regression test set**

Run:

```sh
npx tsx --test tests/member-auth.test.ts tests/auth-rate-limit.test.ts tests/auth-email.test.ts tests/auth-handlers.test.ts tests/google-oauth.test.ts tests/member-auth-ui.test.ts tests/node-migrate.test.ts tests/request-identity.test.ts tests/tarot-guest.test.ts tests/tarot-api-contract.test.ts tests/room-guest-persistence.test.ts tests/i18n.test.ts
```

Expected: PASS with no skipped auth assertions and no real provider request.

- [ ] **Step 2: Run static, build and formatting verification**

Run:

```sh
npx tsc --noEmit
npm run lint
npm run build
git diff --check
```

Expected: all commands exit 0. The build must include the new auth routes and migration-aware server bundle without emitting credentials.

- [ ] **Step 3: Inspect the staged diff for secret and scope safety**

Before the final commit, run:

```sh
git diff --cached --name-only
git diff --cached --check
rg -n "re_[A-Za-z0-9]|RESEND_API_KEY=|GOOGLE_CLIENT_SECRET=|password_hash.*password|signin-with-chatgpt|ChatGPT" app lib drizzle scripts tests README.md
```

The only permitted matches are intentional source/docs references that explain removal or environment variable names; no API key, client secret, raw password, session token or test provider credential may be present.

- [ ] **Step 4: Apply and verify the migration on the VPS**

After the build/deployment workflow is ready, run the existing service migration with the VPS's `NATAROT_DB_PATH` and restart `natarot.service`. Verify the service is active and `curl -fsS -o /dev/null -w 'public-https=%{http_code}\\n' https://natarot.com/` returns `public-https=200`. Do not print `/etc/natarot.env` values or database contents containing member contact data.

- [ ] **Step 5: Configure Google OAuth without sending secrets through chat**

Create a Google Cloud Web OAuth client with the exact production redirect URI `https://natarot.com/api/auth/google/callback`, then place the client ID and client secret in the VPS service environment using the same secure secret-transfer path used for `RESEND_API_KEY`. Keep `GOOGLE_REDIRECT_URI` set to the exact HTTPS callback. Do not paste the client secret into the repository, terminal output, browser chat or plan.

- [ ] **Step 6: Perform safe browser smoke tests**

Check these paths with a fresh browser session:

1. `/auth` renders both local and Google actions in English/Vietnamese.
2. Registering with email, username, phone and password produces the verification-pending state and one outbound Resend request.
3. The verification link permits login by email and by username; the profile shows the private phone field only after login.
4. Logout removes the member session; old room/journal guest data remains separate.
5. Forgot-password and reset revoke the old session; the reset link cannot be reused.
6. Google first login asks for username and phone, while a linked Google identity returns to the requested local path.
7. Room/journal ownership and guest reading still work; no screen offers ChatGPT sign-in.

- [ ] **Step 7: Update project state and commit the verified feature**

Record decisions, commands, deployment status, Google configuration status and any remaining user action in `docs/PROJECT_STATE.md`, without secrets or member data. Then commit only related files:

```sh
git add docs/PROJECT_STATE.md tests/deployment-contract.test.ts README.md
git diff --cached --check
git commit -m "chore: verify member authentication integration"
git push origin HEAD
```

Report any push failure explicitly and do not claim deployment success without the fresh VPS/browser evidence above.

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-09-18-member-auth.md`. Two execution options:

1. **Subagent-Driven (recommended)** — dispatch a fresh subagent per task and review between tasks.
2. **Inline Execution** — execute the tasks in this session with checkpoints.

Choose one approach before implementation begins. The implementation session must invoke `using-git-worktrees` before code changes and `test-driven-development` before production code; frontend work must also follow the UI review guidance from `impeccable`.
