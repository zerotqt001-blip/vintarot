# VPS Node + SQLite deployment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the NaTarot application run as a complete guest-capable Node/Vinext website on the existing BKNS VPS, backed by seeded SQLite, with Nginx/HTTPS and `natarot.com` cut over only after verification.

**Architecture:** Keep the Cloudflare Sites/D1 path intact and add a runtime boundary that selects D1 on Cloudflare or a D1-shaped adapter over Node 22's built-in SQLite on the VPS. Run the Node server as an unprivileged systemd service, initialize `/var/lib/natarot/natarot.sqlite` from the checked-in migrations, and proxy the public domain through Nginx. Missing ChatGPT headers produce an HttpOnly guest identity on the VPS; missing AI credentials retain the existing safe 503 contract.

**Tech Stack:** TypeScript, Node.js `>=22.13.0`, Vinext, Node `node:sqlite`/`DatabaseSync`, Cloudflare Workers types, SQLite migrations in `drizzle/*.sql`, systemd, Nginx, Certbot, BKNS DNS.

**Spec:** `docs/superpowers/specs/2026-09-18-vps-node-sqlite-deployment-design.md`

## Global Constraints

- Preserve the existing NaTarot/Moonlight reference UI and branding; this cutover is runtime/infrastructure work.
- Keep the Cloudflare Sites/D1 implementation and URL available as rollback; do not remove D1 bindings or mutate the Sites deployment during local implementation.
- The Node-loaded API path must not statically resolve `cloudflare:workers`; Cloudflare resolution must remain lazy and conditional.
- Use the existing migrations `0000` through `0003` and their idempotent Tarot seed/catalog data; do not invent a second schema or silently import D1 user data.
- Store the VPS database at `/var/lib/natarot/natarot.sqlite`, outside `/opt/natarot` and Git, owned by `natarot:natarot` with restrictive permissions.
- Use guest ownership when ChatGPT user headers are absent; use `guest:<guestId>` as the room/record owner key and preserve the existing `vintarot_guest` cookie contract.
- Keep AI credentials only in `/etc/natarot.env` on the VPS if the user separately supplies them; never copy `.env.local`, print a secret, or commit an environment file.
- Do not change BKNS DNS records until the VPS host-override smoke test passes and the user confirms the DNS action immediately before mutation.
- Use `apply_patch` for repository edits, test-first implementation, focused commits, and `git diff --check` plus a staged secret scan before every commit.

---

### Task 4: Let the Room use guest persistence on the standalone site

**Files:**
- Create: `tests/room-guest-persistence.test.ts`
- Modify: `app/room/room.tsx`

**Interfaces:**
- The existing `Room` component still accepts `user: { name: string; email: string } | null` for display, but persistence no longer depends on that prop.
- `persist()` calls the guest-capable `/api/rooms` route whenever the Room is ready and has pending state.
- Invite loading/joining and journal save work with the browser's same-origin guest cookie.

- [ ] **Step 1: Write the failing UI contract tests**

Read `app/room/room.tsx` as source and assert the standalone guards are removed: `persist` must not contain `if(!user||!ready.current`, room loading must not return `signInOpen` merely because `user` is null, `openInvite` must not immediately open the sign-in modal for a guest, and the status line must not always display `noSignInStatus` when `user` is null.

Run: `npx tsx --test tests/room-guest-persistence.test.ts`

Expected: FAIL against the current user-gated Room source.

- [ ] **Step 2: Remove the user-only persistence guards**

Allow `persist`, the `id`/`invite` loading branch, and `openInvite` to call the guest-capable API. Keep the ChatGPT user prop for authenticated display names, but show the normal reversal/status copy for guests instead of a sign-in warning. Remove the `user` dependency from the persistence callback and from the before-unload guard so unsaved guest state is treated the same as authenticated state.

- [ ] **Step 3: Run the UI contract and existing Room tests**

Run: `npx tsx --test tests/room-guest-persistence.test.ts tests/tarot-room.test.ts tests/room-features.test.ts tests/tarot-guest.test.ts`

Expected: PASS with the existing tabletop behavior unchanged.

- [ ] **Step 4: Commit guest-capable Room persistence**

Run:

```sh
git diff --check
git add app/room/room.tsx tests/room-guest-persistence.test.ts
git diff --cached --name-only
if git diff --cached | rg -n '(sk-[A-Za-z0-9]{20,}|AIza[0-9A-Za-z_-]{20,}|BEGIN (RSA|OPENSSH|EC|PRIVATE) KEY)'; then exit 1; fi
git commit -m "feat: persist standalone guest rooms"
```

---

### Task 5: Add repeatable systemd/Nginx deployment templates

**Files:**
- Create: `deploy/systemd/natarot.service`
- Create: `deploy/nginx/natarot-http.conf`
- Create: `tests/deployment-contract.test.ts`

**Interfaces:**
- The systemd template runs the migration preflight as `natarot` and starts Vinext on `127.0.0.1:8787`.
- The Nginx template serves `natarot.com` and `www.natarot.com` on port 80 and proxies to `127.0.0.1:8787`; Certbot may later add the TLS server block.

- [ ] **Step 1: Write the failing deployment contract test**

Assert that the service contains `User=natarot`, `EnvironmentFile=-/etc/natarot.env`, `ExecStartPre` for `scripts/node-migrate.mjs`, the Node Vinext command, `Restart=always`, and the localhost bind. Assert that Nginx contains both names, `proxy_pass http://127.0.0.1:8787`, forwarded host/proto headers, and a bounded `client_max_body_size`.

Run: `npx tsx --test tests/deployment-contract.test.ts`

Expected: FAIL because the tracked deployment templates do not exist.

- [ ] **Step 2: Add the systemd template**

Use:

```ini
[Unit]
Description=NaTarot Vinext Node production server
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=natarot
WorkingDirectory=/opt/natarot
EnvironmentFile=-/etc/natarot.env
UMask=0077
ExecStartPre=/usr/local/bin/node /opt/natarot/scripts/node-migrate.mjs
ExecStart=/usr/local/bin/node /opt/natarot/node_modules/vinext/dist/cli.js start --port 8787 --hostname 127.0.0.1
Restart=always
RestartSec=5
LimitNOFILE=65535

[Install]
WantedBy=multi-user.target
```

- [ ] **Step 3: Add the Nginx HTTP template**

Proxy `natarot.com` and `www.natarot.com`, set `client_max_body_size 2m`, forward `Host`, `X-Real-IP`, `X-Forwarded-For`, and `X-Forwarded-Proto`, and add `X-Content-Type-Options nosniff`, `X-Frame-Options SAMEORIGIN`, and `Referrer-Policy strict-origin-when-cross-origin`. Do not add HSTS before HTTPS is active.

- [ ] **Step 4: Run contract checks and commit deployment templates**

Run: `npx tsx --test tests/deployment-contract.test.ts && node --check scripts/node-migrate.mjs`

Expected: PASS.

Then commit:

```sh
git diff --check
git add deploy/systemd/natarot.service deploy/nginx/natarot-http.conf tests/deployment-contract.test.ts
git diff --cached --name-only
if git diff --cached | rg -n '(sk-[A-Za-z0-9]{20,}|AIza[0-9A-Za-z_-]{20,}|BEGIN (RSA|OPENSSH|EC|PRIVATE) KEY)'; then exit 1; fi
git commit -m "ops: add VPS service and proxy templates"
```

---

### Task 6: Run the complete local verification and deploy the application to the VPS

**Files/Systems:**
- Verify repository files from Tasks 1–5.
- Update remote `/opt/natarot`, `/etc/systemd/system/natarot.service`, `/etc/nginx/sites-available/natarot`, and `/etc/natarot.env` without adding secrets.
- Create remote `/var/lib/natarot` owned by `natarot:natarot`.

**Interfaces:**
- The remote service starts only after `node-migrate.mjs` succeeds.
- Nginx proxies public HTTP to the active Node service before DNS is changed.

- [ ] **Step 1: Run local repository verification**

Run:

```sh
npx tsx --test tests/tarot*.test.ts tests/room*.test.ts tests/request-identity.test.ts tests/sqlite-d1.test.ts tests/node-migrate.test.ts tests/deployment-contract.test.ts
npx tsc --noEmit
npm run build
git diff --check
```

Expected: all selected tests pass, TypeScript exits 0, production build exits 0, and diff check is clean. Existing repository-wide lint findings outside this change must be recorded rather than silently fixed.

- [ ] **Step 2: Build a secret-free deployment archive**

Create a temporary archive containing tracked source, `public`, `drizzle`, `scripts`, `deploy`, `package.json`, lockfile, and configuration, excluding `.git`, `node_modules`, `.wrangler`, `.sites-runtime`, `dist`, `.next`, `.env*`, `*.sqlite`, `*.log`, and the temporary archive itself. Inspect the archive listing and run a secret scan before transfer.

- [ ] **Step 3: Upload and install on the VPS**

Transfer the archive over the already verified SSH port `26266`, extract to `/opt/natarot`, run `npm ci --no-audit --no-fund`, ensure `/opt/natarot` is owned by `natarot:natarot`, and install the service/proxy templates. Keep `/etc/natarot.env` limited to:

```text
NODE_ENV=production
HOME=/opt/natarot
PATH=/usr/local/bin:/usr/bin:/bin
NATAROT_DB_PATH=/var/lib/natarot/natarot.sqlite
```

Do not copy the local `.env.local` or any provider credential. Install Nginx's site, run `nginx -t`, enable `natarot.service`, and inspect `systemctl status` plus `journalctl -u natarot --no-pager -n 80` without printing environment values.

- [ ] **Step 4: Configure firewall after confirming SSH remains reachable**

From a second connection check port `26266` before enabling UFW. Then allow only `26266/tcp`, `80/tcp`, and `443/tcp`, enable UFW, and recheck SSH, localhost:8787, and Nginx. If SSH is not reachable, do not enable the firewall; use the KVM console to recover the configuration.

- [ ] **Step 5: Run pre-DNS host-override smoke tests**

Run against the VPS IP without changing DNS:

```sh
curl --resolve natarot.com:80:42.96.5.114 http://natarot.com/
curl --resolve natarot.com:80:42.96.5.114 'http://natarot.com/api/tarot/catalog?locale=vi'
DRAW_RESPONSE=$(curl --resolve natarot.com:80:42.96.5.114 -c /tmp/natarot-guest.cookies -H 'Content-Type: application/json' -X POST http://natarot.com/api/tarot/draw --data '{"question":"Kiểm tra VPS","optional_context":"","category_id":"category-everyday","spread_template_id":"spread-everyday-persona-obstacle-solution","deck_id":"deck-rider-waite-smith","locale":"vi","reversals":true,"selected_cards":[{"card_number":0,"orientation":"upright"},{"card_number":1,"orientation":"reversed"},{"card_number":2,"orientation":"upright"}]}' )
SESSION_ID=$(printf '%s' "$DRAW_RESPONSE" | node -e 'let s="";process.stdin.on("data",c=>s+=c).on("end",()=>process.stdout.write(JSON.parse(s).session_id))')
curl --resolve natarot.com:80:42.96.5.114 -b /tmp/natarot-guest.cookies "http://natarot.com/api/tarot/session?id=$SESSION_ID"
curl --resolve natarot.com:80:42.96.5.114 -b /tmp/natarot-guest.cookies -H 'Content-Type: application/json' -X POST http://natarot.com/api/rooms --data '{"state":{"phase":"ready","deck":"Rider Waite Smith","spread":["Persona"],"theme":"light","reversals":true,"question":"Guest room","cards":[],"notes":"","drawing":"","texts":[]}}'
curl --resolve natarot.com:80:42.96.5.114 -b /tmp/natarot-guest.cookies -H 'Content-Type: application/json' -X POST http://natarot.com/api/records --data '{"kind":"journal","data":{"question":"Guest journal","notes":"Smoke test","cards":[]}}'
curl --resolve natarot.com:80:42.96.5.114 -b /tmp/natarot-guest.cookies -H 'Content-Type: application/json' -X POST http://natarot.com/api/tarot/reading --data "{\"session_id\":\"$SESSION_ID\",\"locale\":\"vi\"}"
```

The shell variable is populated only from the immediately preceding draw response; do not commit the response data or cookie file. Expect homepage/catalog 200, draw 201 with `Set-Cookie`, session/room/record success, and reading 503 with the safe provider-configuration message.

- [ ] **Step 6: Commit/update deployment state only after remote checks pass**

Record the actual service, migration, and smoke-test results in `docs/PROJECT_STATE.md` without adding credentials. Commit only the related state/deployment changes after reviewing the staged diff.

---

### Task 7: Cut over DNS, issue HTTPS, and verify both public hosts

**Systems:** BKNS DNS for `natarot.com`, VPS Nginx/Certbot, public HTTPS.

**Interfaces:**
- Apex A records resolve to `42.96.5.114`.
- `www` resolves to the apex/VPS and is covered by the same certificate.
- Existing Sites validation TXT records and the Sites deployment remain intact until rollback is no longer needed.

- [ ] **Step 1: Stop and request action-time DNS confirmation**

After Task 6 passes, report the exact records that will change and ask the user to confirm the DNS mutation immediately. Do not delete the Sites deployment or validation TXT records. This is the only user confirmation gate for the DNS write.

- [ ] **Step 2: Update BKNS records after confirmation**

In the already authenticated BKNS panel, change the apex A targets from the Sites addresses to `42.96.5.114` and change `www` from the Sites custom-domain target to a record resolving to the apex/VPS. Leave TXT validation records untouched. Re-read the panel values after saving.

- [ ] **Step 3: Install Certbot and enable HTTPS**

On the VPS run `apt-get install -y certbot python3-certbot-nginx`, wait for DNS to resolve to `42.96.5.114`, then run `certbot --nginx -d natarot.com -d www.natarot.com --non-interactive --agree-tos --register-unsafely-without-email --redirect`. Verify `nginx -t`, reload Nginx, and confirm the certificate names and expiry with `certbot certificates` without exposing account data.

- [ ] **Step 4: Run public smoke tests and retain rollback**

Run `curl -fsS https://natarot.com/`, `curl -fsS https://www.natarot.com/`, the HTTPS catalog request, a cookie-backed guest draw/session/room/record flow, and the no-provider reading request. Check browser navigation at `https://natarot.com/room?ritual=1`, static assets, HTTPS redirect, and no mixed-content failures. Keep the old Sites URL and DNS rollback values documented until both hosts pass.

- [ ] **Step 5: Commit the final state and push**

Update `docs/PROJECT_STATE.md` with the final VPS architecture, database freshness limitation, service/HTTPS/DNS verification, and any unfinished AI/provider work. Then run:

```sh
git diff --check
git add docs/PROJECT_STATE.md
git diff --cached --name-only
if git diff --cached | rg -n '(sk-[A-Za-z0-9]{20,}|AIza[0-9A-Za-z_-]{20,}|BEGIN (RSA|OPENSSH|EC|PRIVATE) KEY|OPENAI_API_KEY=[A-Za-z0-9_-]{20,}|GEMINI_API_KEY=[A-Za-z0-9_-]{20,}|DEEPSEEK_API_KEY=[A-Za-z0-9_-]{20,})'; then exit 1; fi
git commit -m "docs: record VPS deployment verification"
git push origin codex/tooling-and-version-history
```

Report any push failure explicitly; a local commit is not treated as a remote backup.

## Review checklist before execution

- [ ] The plan covers each spec section: Node runtime bridge, SQLite lifecycle, guest identity, AI boundary, systemd/Nginx, firewall, host-override verification, DNS/HTTPS, rollback, and project-state update.
- [ ] No task depends on an undefined interface: `createSqliteD1Database`, `runtimeEnv`, `getRuntimeDatabase`, `readRequestIdentity`, `identity(request)`, and `attachIdentityCookie` are defined before use.
- [ ] Run the repository placeholder scan against this plan and confirm it reports no unfinished markers.
- [ ] Every implementation task begins with a failing test and ends with a focused test plus a related commit.
- [ ] DNS remains a separate action-time confirmation after all code, migrations, service, proxy, and host-override checks pass.

### Task 1: Add the platform runtime and D1-shaped SQLite adapter

**Files:**
- Create: `lib/sqlite-d1.ts`
- Create: `lib/runtime.ts`
- Modify: `lib/server.ts`
- Modify: `app/api/tarot/reading/route.ts`
- Modify: `db/index.ts`
- Modify: `tests/tarot-api-contract.test.ts`
- Test: `tests/sqlite-d1.test.ts`

**Interfaces:**
- `lib/sqlite-d1.ts` produces `createSqliteD1Database(sqlite: SqliteConnection): D1Database`.
- `lib/runtime.ts` produces `runtimeEnv: RuntimeEnvironment` and `getRuntimeDatabase(): D1Database`.
- `lib/server.ts` consumes `getRuntimeDatabase()` from the runtime boundary; API callers continue to call `db()` without changing repository SQL.
- The Tarot reading route consumes `runtimeEnv` instead of importing `cloudflare:workers`.

- [ ] **Step 1: Write the failing adapter tests**

Add tests that use a temporary in-memory SQLite connection and assert the exact D1 calls used by the app:

```ts
test("SQLite adapter supports bind, all, first, and run metadata", async () => {
  const sqlite = new DatabaseSync(":memory:");
  const database = createSqliteD1Database(sqlite);
  sqlite.exec("CREATE TABLE items (id TEXT PRIMARY KEY, value INTEGER)");

  await database.prepare("INSERT INTO items (id, value) VALUES (?, ?)")
    .bind("one", 1)
    .run();
  const first = await database.prepare("SELECT id, value FROM items WHERE id = ?")
    .bind("one")
    .first<{ id: string; value: number }>();
  const all = await database.prepare("SELECT id, value FROM items ORDER BY id").all<{ id: string; value: number }>();
  const update = await database.prepare("UPDATE items SET value = ? WHERE id = ?")
    .bind(2, "one")
    .run();

  assert.deepEqual(first, { id: "one", value: 1 });
  assert.deepEqual(all.results, [{ id: "one", value: 1 }]);
  assert.equal(update.meta.changes, 1);
  sqlite.close();
});

test("SQLite adapter executes a batch in order", async () => {
  const sqlite = new DatabaseSync(":memory:");
  const database = createSqliteD1Database(sqlite);
  sqlite.exec("CREATE TABLE items (id TEXT PRIMARY KEY, value INTEGER)");
  const statements = [1, 2, 3].map((value) => database.prepare("INSERT INTO items (id, value) VALUES (?, ?)").bind(`item-${value}`, value));
  await database.batch(statements);
  const rows = await database.prepare("SELECT value FROM items ORDER BY value").all<{ value: number }>();
  assert.deepEqual(rows.results, [{ value: 1 }, { value: 2 }, { value: 3 }]);
  sqlite.close();
});
```

Run: `npx tsx --test tests/sqlite-d1.test.ts`

Expected: FAIL because `createSqliteD1Database` does not exist yet.

- [ ] **Step 2: Implement the minimal D1-shaped adapter**

Define the narrow connection type in `lib/sqlite-d1.ts` so the adapter does not import `node:sqlite` at module evaluation time:

```ts
export type SqliteConnection = {
  exec(sql: string): void;
  prepare(sql: string): {
    all(...values: SqliteValue[]): unknown[];
    get(...values: SqliteValue[]): unknown;
    run(...values: SqliteValue[]): { changes: number | bigint; lastInsertRowid: number | bigint };
  };
};
```

Implement `bind()` as a chainable closure, `all()` as `{ results }`, `first()` as the first row or `null`, `run()` as `{ success: true, meta: { changes, last_row_id } }`, and `batch()` as sequential awaited `run()` calls on the supplied prepared statements. Convert only `undefined` bind values to `null`; reject unsupported objects before SQLite receives them.

- [ ] **Step 3: Run the adapter tests**

Run: `npx tsx --test tests/sqlite-d1.test.ts`

Expected: PASS for both adapter tests.

- [ ] **Step 4: Write the failing runtime-boundary contract test**

Update `tests/tarot-api-contract.test.ts` so it asserts that `app/api/tarot/reading/route.ts` imports `runtimeEnv` and has no `cloudflare:workers` text. Add a test that dynamically imports `lib/runtime.ts` with `NATAROT_DB_PATH` pointing at a temporary file, calls `getRuntimeDatabase()`, creates a table, writes a row, and reads it back. The test must remove the temporary file in `t.after()` and must not use `/var/lib/natarot`.

Run: `npx tsx --test tests/tarot-api-contract.test.ts`

Expected: FAIL because the route still imports `cloudflare:workers` and `lib/runtime.ts` is absent.

- [ ] **Step 5: Implement the conditional runtime**

In `lib/runtime.ts`:

```ts
export type RuntimeEnvironment = TarotAIEnvironment & {
  DB?: D1Database;
  NATAROT_DB_PATH?: string;
};

export const runtimeEnv: RuntimeEnvironment = await loadRuntimeEnvironment();
export const runtimeDatabase: D1Database = await loadRuntimeDatabase(runtimeEnv);

export function getRuntimeDatabase(): D1Database {
  return runtimeDatabase;
}
```

`loadRuntimeEnvironment()` must return `process.env` on Node and only then use `await import("cloudflare:workers")` for the Cloudflare path. `loadRuntimeDatabase()` must dynamically import `node:sqlite` only on Node, open `runtimeEnv.NATAROT_DB_PATH || "/var/lib/natarot/natarot.sqlite"`, enable `PRAGMA foreign_keys = ON`, `PRAGMA journal_mode = WAL`, and `PRAGMA busy_timeout = 5000`, then wrap the connection with `createSqliteD1Database`. On Cloudflare it must return `runtimeEnv.DB` or throw the existing storage-unavailable error.

Replace `lib/server.ts`'s top-level Cloudflare import with `getRuntimeDatabase()`. Replace the reading route's `env as unknown as Record<string, string | undefined>` source with `runtimeEnv as unknown as Record<string, string | undefined>`. Change `db/index.ts` to call `drizzle(getRuntimeDatabase(), { schema })`, preserving its public `getDb()` function.

- [ ] **Step 6: Run focused runtime and route tests**

Run: `npx tsx --test tests/sqlite-d1.test.ts tests/tarot-api-contract.test.ts`

Expected: PASS, including the assertion that the Node-loaded route path has no static Cloudflare import.

- [ ] **Step 7: Commit the runtime boundary**

Run:

```sh
git diff --check
git add lib/sqlite-d1.ts lib/runtime.ts lib/server.ts app/api/tarot/reading/route.ts db/index.ts tests/sqlite-d1.test.ts tests/tarot-api-contract.test.ts
git diff --cached --name-only
if git diff --cached -- ':!*.lock' | rg -n '(sk-[A-Za-z0-9]{20,}|AIza[0-9A-Za-z_-]{20,}|BEGIN (RSA|OPENSSH|EC|PRIVATE) KEY)'; then exit 1; fi
git commit -m "feat: add Node runtime storage bridge"
```

---

### Task 2: Add idempotent VPS migrations and seed bootstrap

**Files:**
- Create: `scripts/node-migrate.mjs`
- Create: `tests/node-migrate.test.ts`
- Modify: `package.json`

**Interfaces:**
- `scripts/node-migrate.mjs` reads `NATAROT_DB_PATH` or defaults to `/var/lib/natarot/natarot.sqlite` and exits non-zero on failure.
- The script creates `natarot_migrations (name TEXT PRIMARY KEY, applied_at INTEGER NOT NULL)` and applies sorted `drizzle/0000_*.sql` through `drizzle/0003_*.sql` exactly once.
- `npm run db:migrate:node` executes `node scripts/node-migrate.mjs`.

- [ ] **Step 1: Write the failing migration test**

Create a test that runs the script twice against a temporary file and checks the real seeded rows:

```ts
test("Node migration bootstrap applies and repeats the full schema and seed", async (t) => {
  const dbPath = join(tmpdir(), `natarot-migrate-${randomUUID()}.sqlite`);
  t.after(() => rmSync(dbPath, { force: true }));
  const env = { ...process.env, NATAROT_DB_PATH: dbPath };
  execFileSync(process.execPath, ["scripts/node-migrate.mjs"], { cwd: repoRoot, env, stdio: "pipe" });
  execFileSync(process.execPath, ["scripts/node-migrate.mjs"], { cwd: repoRoot, env, stdio: "pipe" });

  const sqlite = new DatabaseSync(dbPath);
  assert.equal(sqlite.prepare("SELECT COUNT(*) AS count FROM tarot_cards").get().count, 78);
  assert.equal(sqlite.prepare("SELECT COUNT(*) AS count FROM card_meanings").get().count, 312);
  assert.equal(sqlite.prepare("SELECT COUNT(*) AS count FROM natarot_migrations").get().count, 4);
  assert.deepEqual(sqlite.prepare("PRAGMA foreign_key_check").all(), []);
  sqlite.close();
});
```

Run: `npx tsx --test tests/node-migrate.test.ts`

Expected: FAIL because `scripts/node-migrate.mjs` and the package script do not exist.

- [ ] **Step 2: Implement the migration runner**

Use `DatabaseSync`, `readFileSync`, and `readdirSync`. Resolve the migration directory from `import.meta.url`, filter only `/^000[0-3]_.+\.sql$/`, sort lexically, enable foreign keys/WAL/busy timeout, and insert the migration name only after `sqlite.exec(sql)` succeeds. Do not strip or rewrite the existing SQL; SQLite accepts the Drizzle statement-breakpoint comments and the seed transaction as checked in.

- [ ] **Step 3: Add the package command and run the test**

Add:

```json
"db:migrate:node": "node scripts/node-migrate.mjs"
```

Run: `npx tsx --test tests/node-migrate.test.ts`

Expected: PASS with two successful runs, 78 cards, 312 meanings, four applied migrations, and no foreign-key violations.

- [ ] **Step 4: Commit the migration bootstrap**

Run:

```sh
git diff --check
git add scripts/node-migrate.mjs tests/node-migrate.test.ts package.json
git diff --cached --name-only
if git diff --cached -- package.json scripts/node-migrate.mjs tests/node-migrate.test.ts | rg -n '(sk-[A-Za-z0-9]{20,}|AIza[0-9A-Za-z_-]{20,}|BEGIN (RSA|OPENSSH|EC|PRIVATE) KEY)'; then exit 1; fi
git commit -m "feat: add idempotent VPS database bootstrap"
```

---

### Task 3: Add guest request identity to protected APIs

**Files:**
- Create: `lib/request-identity.ts`
- Create: `tests/request-identity.test.ts`
- Modify: `lib/server.ts`
- Modify: `app/api/rooms/route.ts`
- Modify: `app/api/records/route.ts`
- Modify: `app/api/integrations/route.ts`

**Interfaces:**
- `readRequestIdentity(request: Request): Promise<RequestIdentity>` returns a ChatGPT identity when its headers exist, otherwise a guest identity with `userId: "guest:<guestId>"`, `displayName: "Guest"`, `email: "guest@local.invalid"`, `fullName: "Guest"`, and optional `setCookie`.
- `identity(request)` in `lib/server.ts` delegates to `readRequestIdentity` and remains the route-facing function.
- `attachIdentityCookie(response, identity)` returns the response after setting `Set-Cookie` when `identity.setCookie` exists.

- [ ] **Step 1: Write the failing identity tests**

Cover both modes and cookie safety:

```ts
test("missing ChatGPT headers creates a stable guest owner and cookie", async () => {
  const first = await readRequestIdentity(new Request("https://natarot.com/api/rooms"));
  assert.equal(first.kind, "guest");
  assert.match(first.userId, /^guest:[A-Za-z0-9._-]{8,200}$/);
  assert.equal(first.email, "guest@local.invalid");
  assert.match(first.setCookie || "", /^vintarot_guest=/);
  const second = await readRequestIdentity(new Request("https://natarot.com/api/rooms", { headers: { Cookie: first.setCookie!.split(";")[0] } }));
  assert.equal(second.userId, first.userId);
  assert.equal(JSON.stringify(second).includes(first.guestId), true);
});

test("ChatGPT headers remain the authenticated owner", async () => {
  const request = new Request("https://natarot.com/api/rooms", { headers: {
    "oai-authenticated-user-id": "user-123",
    "oai-authenticated-user-email": "reader@example.test",
    "oai-authenticated-user-full-name": "Reader%20Name",
    "oai-authenticated-user-full-name-encoding": "percent-encoded-utf-8",
  }});
  const identity = await readRequestIdentity(request);
  assert.deepEqual({ kind: identity.kind, userId: identity.userId, email: identity.email, fullName: identity.fullName }, {
    kind: "user", userId: "user-123", email: "reader@example.test", fullName: "Reader Name",
  });
  assert.equal(identity.setCookie, undefined);
});
```

Run: `npx tsx --test tests/request-identity.test.ts`

Expected: FAIL because the request identity module does not exist.

- [ ] **Step 2: Implement the identity boundary**

Reuse `readOptionalOwner(request)` so Tarot and room/record routes share the same cookie parser. If the owner is a user, use the existing user fields. If it is a guest, prefix the owner key with `guest:` and expose only the display-safe `Guest` fields. Never log the raw cookie value. `attachIdentityCookie` must clone no body and only set the header.

- [ ] **Step 3: Update protected routes and response cookies**

Change every `identity()` call in rooms, records, and integrations to `identity(req)`. Wrap all successful JSON responses in `attachIdentityCookie(response, user)`, including room list/detail/create/update/join and record list/save responses. Change `integrations.GET` to accept `req: Request`. Leave Tarot draw's existing cookie handling unchanged.

- [ ] **Step 4: Run focused identity/API tests**

Run: `npx tsx --test tests/request-identity.test.ts tests/tarot-guest.test.ts tests/tarot-api-contract.test.ts`

Expected: PASS with the existing Tarot guest contract intact and no route requiring a ChatGPT header for basic guest ownership.

- [ ] **Step 5: Commit the protected API identity change**

Run:

```sh
git diff --check
git add lib/request-identity.ts tests/request-identity.test.ts lib/server.ts app/api/rooms/route.ts app/api/records/route.ts app/api/integrations/route.ts
git diff --cached --name-only
if git diff --cached | rg -n '(sk-[A-Za-z0-9]{20,}|AIza[0-9A-Za-z_-]{20,}|BEGIN (RSA|OPENSSH|EC|PRIVATE) KEY)'; then exit 1; fi
git commit -m "feat: support guest ownership on VPS APIs"
```

---
