# NaTarot Staging Environment V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add and deploy an isolated public HTTPS NaTarot staging runtime at `staging.natarot.com` without changing production.

**Architecture:** Use a separate `natarot-staging` systemd service on `127.0.0.1:8788`, an independent `/opt/natarot-staging` release directory, `/var/lib/natarot-staging/natarot.sqlite` database, `/etc/natarot-staging.env` environment boundary, and a separate Nginx host with its own certificate. Reuse the exact application/migration chain from the approved integration commit; the existing read-only `/api/health` route is unchanged.

**Tech Stack:** Node 22, Vinext/Vite, systemd, Nginx, Certbot/Let's Encrypt, SQLite through the existing `node:sqlite` D1 adapter, TypeScript tests through `tsx` and Node's test runner.

**Spec:** `docs/superpowers/specs/2026-09-21-natarot-staging-environment-v1-design.md`

## Global Constraints

- Base commit: `f5452a35d7b4bbc9884e52d0890c4f5e9c39e9fe`.
- Branch: `codex/natarot-staging-v1`; never modify the dirty calling checkout.
- Staging host: `staging.natarot.com`; VPS address: `42.96.5.114`.
- Staging service/port: `natarot-staging` / `127.0.0.1:8788`.
- Staging paths: `/opt/natarot-staging`, `/var/lib/natarot-staging/natarot.sqlite`, `/etc/natarot-staging.env`.
- Production service, port, paths, database, DNS, certificate, secrets and application release remain untouched.
- Apply the existing migration chain only; do not add or renumber migrations and do not add Credits/VIP schema.
- Do not configure SePay or copy DeepSeek, provider, auth, payment, session, database or production secrets.
- Commit only staging-related files, inspect the staged diff for secret values, push normally, and verify local/remote equality.

---

### Task 1: Add failing staging deployment contracts

**Files:**
- Create: `tests/staging-deployment-contract.test.ts`
- Read-only reference: `deploy/systemd/natarot.service`
- Read-only reference: `deploy/nginx/natarot-http.conf`

**Interfaces:**
- Produces the executable contract for `deploy/systemd/natarot-staging.service`, `deploy/nginx/natarot-staging-bootstrap.conf`, and `deploy/nginx/natarot-staging.conf`.

- [ ] **Step 1: Write the failing contract test**

Create a Node test that reads the three not-yet-created staging files and asserts:

```ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const service = readFileSync(new URL("../deploy/systemd/natarot-staging.service", import.meta.url), "utf8");
const bootstrap = readFileSync(new URL("../deploy/nginx/natarot-staging-bootstrap.conf", import.meta.url), "utf8");
const nginx = readFileSync(new URL("../deploy/nginx/natarot-staging.conf", import.meta.url), "utf8");

test("staging systemd service is isolated from production", () => {
  assert.match(service, /User=natarot-staging/);
  assert.match(service, /Group=natarot-staging/);
  assert.match(service, /WorkingDirectory=\/opt\/natarot-staging/);
  assert.match(service, /EnvironmentFile=-\/etc\/natarot-staging\.env/);
  assert.match(service, /NATAROT_DB_PATH=\/var\/lib\/natarot-staging\/natarot\.sqlite/);
  assert.match(service, /NATAROT_PUBLIC_ORIGIN=https:\/\/staging\.natarot\.com/);
  assert.match(service, /NATAROT_TRUSTED_PROXY=1/);
  assert.match(service, /StateDirectory=natarot-staging/);
  assert.match(service, /ExecStartPre=.*\/opt\/natarot-staging\/scripts\/node-migrate\.mjs/);
  assert.match(service, /ExecStart=.*--port 8788/);
  assert.match(service, /--hostname 127\.0\.0\.1/);
  assert.match(service, /Restart=always/);
  assert.match(service, /ProtectSystem=strict/);
  assert.match(service, /NoNewPrivileges=true/);
  assert.doesNotMatch(service, /natarot\.service/);
  assert.doesNotMatch(service, /127\.0\.0\.1:8787/);
  assert.doesNotMatch(service, /\/opt\/natarot(?:\/|\b)/);
  assert.doesNotMatch(service, /\/var\/lib\/natarot\/natarot\.sqlite/);
  assert.doesNotMatch(service, /\/etc\/natarot\.env(?:\b|$)/);
});

test("bootstrap Nginx host exposes only staging over the staging port", () => {
  assert.match(bootstrap, /server_name\s+staging\.natarot\.com/);
  assert.match(bootstrap, /proxy_pass\s+http:\/\/127\.0\.0\.1:8788/);
  assert.match(bootstrap, /proxy_set_header\s+Host\s+\$host/);
  assert.match(bootstrap, /proxy_set_header\s+X-Forwarded-Proto\s+\$scheme/);
  assert.match(bootstrap, /X-Robots-Tag\s+"noindex, nofollow"/);
  assert.doesNotMatch(bootstrap, /server_name\s+natarot\.com/);
  assert.doesNotMatch(bootstrap, /127\.0\.0\.1:8787/);
});

test("final Nginx host redirects HTTP and terminates TLS for staging only", () => {
  assert.match(nginx, /listen 80/);
  assert.match(nginx, /return 301 https:\/\/\$host\$request_uri/);
  assert.match(nginx, /listen 443 ssl/);
  assert.match(nginx, /server_name\s+staging\.natarot\.com/);
  assert.match(nginx, /ssl_certificate\s+\/etc\/letsencrypt\/live\/staging\.natarot\.com\/fullchain\.pem/);
  assert.match(nginx, /ssl_certificate_key\s+\/etc\/letsencrypt\/live\/staging\.natarot\.com\/privkey\.pem/);
  assert.match(nginx, /proxy_pass\s+http:\/\/127\.0\.0\.1:8788/);
  assert.match(nginx, /proxy_set_header\s+oai-authenticated-user-id\s+""/);
  assert.match(nginx, /add_header\s+X-Content-Type-Options\s+nosniff/);
  assert.match(nginx, /add_header\s+X-Frame-Options\s+SAMEORIGIN/);
  assert.match(nginx, /add_header\s+Referrer-Policy\s+strict-origin-when-cross-origin/);
  assert.match(nginx, /add_header\s+X-Robots-Tag\s+"noindex, nofollow"/);
  assert.doesNotMatch(nginx, /server_name\s+natarot\.com/);
  assert.doesNotMatch(nginx, /127\.0\.0\.1:8787/);
});

test("staging health route exposes no runtime configuration", () => {
  const health = readFileSync(new URL("../app/api/health/route.ts", import.meta.url), "utf8");
  assert.match(health, /Response\.json\(\{ status: "ok" \}\)/);
  assert.doesNotMatch(health, /process\.env|runtimeEnv|NATAROT_|SECRET|TOKEN|PASSWORD/i);
});
```

- [ ] **Step 2: Run the focused test to verify the expected failure**

Run: `npx tsx --test tests/staging-deployment-contract.test.ts`

Expected: FAIL before the first assertion because the staging service file does not exist. This confirms the test is exercising the new staging contract rather than existing production files.

### Task 2: Implement isolated systemd and Nginx contracts

**Files:**
- Create: `deploy/systemd/natarot-staging.service`
- Create: `deploy/nginx/natarot-staging-bootstrap.conf`
- Create: `deploy/nginx/natarot-staging.conf`
- Test: `tests/staging-deployment-contract.test.ts`

**Interfaces:**
- Consumes: existing `scripts/node-migrate.mjs`, built Vinext release, Nginx, systemd, and the exact environment/path contract from the spec.
- Produces: installable staging unit and pre-/post-Certbot Nginx virtual-host templates.

- [ ] **Step 1: Add the staging systemd unit**

Write exactly these boundaries into the unit:

```ini
[Unit]
Description=NaTarot isolated staging Node server
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=natarot-staging
Group=natarot-staging
WorkingDirectory=/opt/natarot-staging
EnvironmentFile=-/etc/natarot-staging.env
Environment=NATAROT_DB_PATH=/var/lib/natarot-staging/natarot.sqlite
Environment=NATAROT_PUBLIC_ORIGIN=https://staging.natarot.com
Environment=NATAROT_TRUSTED_PROXY=1
UMask=0077
StateDirectory=natarot-staging
StateDirectoryMode=0700
PrivateTmp=true
ProtectHome=true
ProtectSystem=strict
ReadWritePaths=/var/lib/natarot-staging
NoNewPrivileges=true
ExecStartPre=/usr/local/bin/node /opt/natarot-staging/scripts/node-migrate.mjs
ExecStart=/usr/local/bin/node /opt/natarot-staging/node_modules/vinext/dist/cli.js start --port 8788 --hostname 127.0.0.1
Restart=always
RestartSec=5
LimitNOFILE=65535
SyslogIdentifier=natarot-staging

[Install]
WantedBy=multi-user.target
```

- [ ] **Step 2: Add the HTTP-only bootstrap host**

Create `deploy/nginx/natarot-staging-bootstrap.conf` with one port-80 server for `staging.natarot.com`, a 2 MB request limit, noindex headers, forwarded host/protocol/client headers, cleared `oai-authenticated-user-*` headers, a `proxy_pass` to `http://127.0.0.1:8788`, WebSocket upgrade headers, and a 120-second proxy timeout. It must not mention production hostnames, port 8787, or production paths.

- [ ] **Step 3: Add the final TLS host**

Create `deploy/nginx/natarot-staging.conf` with:

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name staging.natarot.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    listen [::]:443 ssl;
    server_name staging.natarot.com;

    ssl_certificate /etc/letsencrypt/live/staging.natarot.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/staging.natarot.com/privkey.pem;

    client_max_body_size 2m;
    add_header X-Content-Type-Options nosniff always;
    add_header X-Frame-Options SAMEORIGIN always;
    add_header Referrer-Policy strict-origin-when-cross-origin always;
    add_header X-Robots-Tag "noindex, nofollow" always;

    location / {
        proxy_pass http://127.0.0.1:8788;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header oai-authenticated-user-id "";
        proxy_set_header oai-authenticated-user-email "";
        proxy_set_header oai-authenticated-user-full-name "";
        proxy_set_header oai-authenticated-user-full-name-encoding "";
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 120s;
    }
}
```

- [ ] **Step 4: Run the focused contract test to verify green**

Run: `npx tsx --test tests/staging-deployment-contract.test.ts`

Expected: all four staging contract tests pass.

- [ ] **Step 5: Run whitespace and targeted lint checks**

Run: `git diff --check`

Expected: no output and exit code 0.

Run: `npx eslint tests/staging-deployment-contract.test.ts`

Expected: exit code 0 for the new test file.

### Task 3: Write the staging operations runbook

**Files:**
- Create: `docs/operations/natarot-staging-v1.md`
- Test: `tests/staging-deployment-contract.test.ts` (no behavior change)

**Interfaces:**
- Consumes: the service and Nginx file paths from Task 2, BKNS DNS record, existing migration runner, existing build wrapper, and the approved human gates.
- Produces: a repeatable deployment, validation, rollback, and evidence procedure with no secrets.

- [ ] **Step 1: Document preflight and DNS evidence**

Record the approved base, branch, production lock, DNS action, and verification commands:

```bash
dig +short @1.1.1.1 staging.natarot.com A
dig +short @8.8.8.8 staging.natarot.com A
curl -fsSI https://natarot.com/
```

The required DNS result is exactly `42.96.5.114`; no unrelated record may be edited.

- [ ] **Step 2: Document authorized VPS provisioning**

Use an existing authorized non-root SSH account or provider console. The runbook must create the `natarot-staging` system user, install the release under `/opt/natarot-staging`, create the staging state directory with mode 0700, and create `/etc/natarot-staging.env` with only non-secret values. It must explicitly omit provider, SePay, Google, Resend, password, token, and database-export values.

- [ ] **Step 3: Document release and migration commands**

Build locally with `npm run build`, exclude `.env*`, `*.sqlite`, `*.sqlite-*`, `.git`, `dist` archives, logs and backups from the transfer package, install dependencies/release contents in the staging directory, run `node scripts/node-migrate.mjs` through the service preflight, and verify the migration metadata and foreign-key integrity only on `/var/lib/natarot-staging/natarot.sqlite`.

- [ ] **Step 4: Document Nginx and TLS sequencing**

Install the bootstrap host, run `nginx -t`, reload gracefully, issue the certificate with Certbot for only `staging.natarot.com`, install the final host, run `nginx -t` again, reload gracefully, and verify both production and staging HTTPS. Never stop Nginx, change the production upstream, or modify the production certificate.

- [ ] **Step 5: Document closed-loop smoke tests**

Include exact read-only/public checks for `/api/health`, homepage, Room, catalog, guest draw/session/room/journal, safe no-provider reading 503, share create/public/revoke with synthetic data, HTTP redirect, TLS hostname, `X-Robots-Tag`, no `.env`/SQLite/Git exposure, restart persistence, and production health. State that `/api/commercial/sepay/ipn` is only a future URL and is not implemented by this mission.

- [ ] **Step 6: Document rollback and human gates**

Rollback must disable or remove only staging artifacts. If no authorized VPS account/key/console is available, stop with `SSH HOST: 42.96.5.114` and `REQUIRED: authorized SSH username/key or approved access path`; never request private-key contents or passwords in chat.

### Task 4: Record project state and verify the repository deliverable

**Files:**
- Modify: `docs/PROJECT_STATE.md`
- Test: `tests/staging-deployment-contract.test.ts`

**Interfaces:**
- Consumes: DNS verification, repository test results, deployment access result, and production read-only health checks.
- Produces: a truthful checkpoint separating DNS/repository implementation from public service deployment and explicitly stating production unchanged.

- [ ] **Step 1: Append the staging checkpoint after external checks**

Record `STAGING IMPLEMENTED` only for the repository artifacts that actually exist, `STAGING VERIFIED` only for checks actually run, `PRODUCTION UNCHANGED` with evidence, the exact DNS result, the exact SSH/TLS blocker if present, and the next authorized action. Do not claim public HTTPS or service health without live evidence.

- [ ] **Step 2: Run all repository gates**

Run in order:

```bash
npx tsx --test tests/*.test.ts
npx tsc --noEmit
npm run build
npm run lint -- --no-warn-ignored tests/staging-deployment-contract.test.ts
git diff --check
```

Expected: the full tracked suite, typecheck, build, targeted lint, and diff check pass. Any inherited repository lint failure must be recorded separately and not attributed to staging.

- [ ] **Step 3: Scan the staged diff**

Before committing, inspect `git diff --cached`, verify only staging spec/plan/ops/tests/state files are staged, and scan for real secret values (`sk-`, provider key assignments, PEM blocks, private key material, `.env` contents, SQLite files, logs, or backups). Documentation words such as “secret” are not themselves secret values.

- [ ] **Step 4: Commit the implementation**

Run:

```bash
git add deploy/systemd/natarot-staging.service deploy/nginx/natarot-staging-bootstrap.conf deploy/nginx/natarot-staging.conf docs/operations/natarot-staging-v1.md docs/PROJECT_STATE.md tests/staging-deployment-contract.test.ts
git commit -m "ops: add isolated NaTarot staging environment"
```

- [ ] **Step 5: Push and verify the remote**

Run:

```bash
git push -u origin codex/natarot-staging-v1
git fetch origin codex/natarot-staging-v1
test "$(git rev-parse HEAD)" = "$(git rev-parse origin/codex/natarot-staging-v1)"
```

Expected: normal push succeeds and local HEAD equals the remote branch HEAD. A failure is reported with the command result; no force push is attempted.

## Completion evidence

The final report must distinguish:

- Repository branch/commit and remote equality.
- DNS record and public propagation.
- Public HTTPS/TLS/health/service/database/isolation results.
- Auth/F-001, Tarot safe no-provider, share S1-S6 and restart results.
- Production health and explicit no-change assertions.
- The future SePay IPN URL as a host capability only; `SEPAY IPN IMPLEMENTED: NO`.
- Any real human blocker, exact required action, and whether staging is safe for the later SePay Sandbox implementation.
