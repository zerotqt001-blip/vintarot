# NaTarot Full Feature Production Deployment V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deploy the verified `codex/natarot-full-feature-staging` release to the existing NaTarot production VPS as a reversible, source-tracked production release and verify every implemented feature that can run without an external human/provider gate.

**Architecture:** Preserve the current `/etc/natarot.env`, `/var/lib/natarot/natarot.sqlite`, Nginx TLS topology, staging service, and old release. Build a candidate release in a separate `/opt/natarot.release-*` directory, run the target migration runner against a cloned production database before cutover, then atomically retain the current `/opt/natarot` as a rollback directory and activate the candidate at `/opt/natarot`. Restart only `natarot.service`, poll bounded readiness, and restore the previous tree if the service or public health checks cannot become healthy.

**Tech Stack:** React 19 + TypeScript, Vinext/Vite, Node 22 `node:sqlite`, Drizzle-compatible SQLite migrations, systemd, Nginx/Certbot, `tsx --test`, curl, and the existing BKNS VPS backup tooling.

**Spec:** User-provided deployment runbook at `/Users/tranquangthanh/.codex/attachments/1f535978-b63a-433c-9110-f554ae9c4275/Văn bản đã dán.txt`.

## Global Constraints

- Deploy from `origin/codex/natarot-full-feature-staging` at the independently verified latest safe descendant; do not deploy from `main`.
- Use branch `codex/natarot-production-full-feature-v1`; never force-push, rewrite history, or overwrite the user's dirty checkout.
- Preserve existing working VPS configuration and secret variable names; never print secret values or commit environment files, tokens, cookies, databases, logs, or build output.
- Create and verify a new production pre-deployment backup before any production migration or release switch.
- Classify each migration as additive/compatible/destructive from source and dry-run evidence; a destructive production migration requires a human gate.
- Do not enable real SePay payments, copy staging sandbox credentials into production, change AI/Knowledge V5/auth/payment/accounting/share semantics, or begin UI redesign.
- Treat `RESEND_API_KEY` HTTP 401 as `DEPLOYED + EXTERNAL_GATE`; continue unrelated deployment and E2E work.
- Fix only proven internally controllable P0/P1 defects discovered during this mission; every source fix starts with a failing regression test and ends with focused verification.
- Keep the known-good production tree, database backup, and rollback metadata recoverable until final verification and documentation are complete.

---

### Task 1: Reconcile source and live production reality

**Files/Systems:**
- Inspect: `docs/PROJECT_STATE.md`, `docs/reports/natarot-full-feature-staging-feature-matrix.md`, `deploy/systemd/natarot.service`, `deploy/nginx/*`, `drizzle/*.sql`, `scripts/node-migrate.mjs`.
- Inspect remotely: `natarot.service`, `natarot-staging.service`, `/opt/natarot`, `/var/lib/natarot/natarot.sqlite`, `/etc/natarot.env`, Nginx, backup timers, and public `natarot.com`/`www.natarot.com`.

**Interfaces:**
- Consumes: `origin/codex/natarot-full-feature-staging`, current production source metadata, service metadata, database metadata, and environment variable names.
- Produces: a redacted inventory of release identity, route coverage, current rollback path, database/migration state, configuration names, backup state, and exact source/runtime differences for the deployment report.

- [ ] **Step 1: Confirm the remote source head**

Run:

```bash
git fetch origin --prune
git rev-parse origin/codex/natarot-full-feature-staging
git show -s --format='%H %ad %s' --date=iso-strict origin/codex/natarot-full-feature-staging
```

Expected: the functional source resolves to `a0a79fa64aa398a566b40bef96be3c590bf5292d` unless a newer verified descendant is present.

- [ ] **Step 2: Record live metadata without values**

Run the authorized SSH audit using `systemctl show` for safe service properties, `readlink/stat/find` for release and database metadata, `nginx -T` filtered to domain/upstream lines, `ss -ltnp`, `df -h`, and an `awk -F=` variable-name inventory for `/etc/natarot.env`. Do not run unrestricted `env`, `printenv`, or `cat` on environment files.

Expected: the audit identifies the active release, PID/start time, `127.0.0.1:8787`, database path/mode/owner, Nginx TLS upstream, disk headroom, existing rollback tree, and all production variable names without exposing secret values.

- [ ] **Step 3: Compare feature inventories**

Compare the target route/file inventory with the live release inventory, focusing on auth/OAuth/email, F-001, Tarot/SpreadBoard/AI, share, account/history, Credits/VIP/packages/orders, SePay, Affiliate, and Admin/RBAC. Preserve any live auth/configuration behavior that the target represents differently; do not delete Nginx TLS or staging topology.

- [ ] **Step 4: Commit the deployment plan**

Run `git diff --check`, scan the plan for unfinished markers, inspect the plan text, and commit only this plan with:

```bash
git add docs/superpowers/plans/2026-09-22-natarot-production-full-feature-v1.md
git diff --cached --check
git commit -m "docs: plan full feature production deployment"
```

Expected: the plan has no unfinished markers and the commit contains no secrets.

### Task 2: Run source verification and migration compatibility checks

**Files/Systems:**
- Verify: all tracked source, `tests/*.test.ts`, `package.json`, `package-lock.json`, and `drizzle/*.sql`.
- Modify only if required by a proven regression: the smallest source/test files, with a focused commit.

**Interfaces:**
- Consumes: the clean deployment branch at the verified Full Feature head.
- Produces: verified test/build/lint/audit evidence and a migration classification before any VPS release switch.

- [ ] **Step 1: Install exact dependencies in the isolated worktree**

Run `npm ci --no-audit --no-fund` and confirm the worktree remains free of tracked source changes.

- [ ] **Step 2: Run the complete tracked test suite**

Run:

```bash
npx tsx --test tests/*.test.ts
```

Expected: zero failures. If a failure occurs, reproduce only that test, state one root-cause hypothesis, add a minimal failing regression test before changing implementation, then rerun the focused test and complete suite.

- [ ] **Step 3: Run static/build/security gates**

Run:

```bash
npx tsc --noEmit
npm run build
npm run lint
npm audit --omit=dev
git diff --check
```

Record inherited lint findings separately from any new finding; do not hide or broadly refactor unrelated legacy lint debt.

- [ ] **Step 4: Validate migrations on fresh and existing fixtures**

Run the migration, backend-completion, commercial, member-auth, Tarot, Share, Credits/VIP, Affiliate, and security migration tests. Enumerate all target migration filenames by full filename, including duplicate numeric prefixes (`0004_*`, `0007_*`), and classify each pending production migration as additive or compatible. A destructive operation stops the production mutation path for a human gate.

- [ ] **Step 5: Inspect the candidate diff before release preparation**

Run:

```bash
git diff HEAD^ HEAD --stat
git diff HEAD^ HEAD -- . ':!docs/PROJECT_STATE.md'
if git diff HEAD^ HEAD | rg -n '(sk-[A-Za-z0-9]{20,}|AIza[0-9A-Za-z_-]{20,}|BEGIN (RSA|OPENSSH|EC|PRIVATE) KEY|DEEPSEEK_API_KEY=[A-Za-z0-9_-]{20,}|RESEND_API_KEY=[A-Za-z0-9_-]{20,}|SEPAY_(SECRET_KEY|IPN_SECRET)=[A-Za-z0-9_-]{20,})'; then exit 1; fi
```

Expected: only intended Full Feature source/docs are present and no credential values are present.

### Task 3: Create and verify the mandatory production backup

**Files/Systems:**
- Remote: `/var/backups/natarot`, `/var/lib/natarot/natarot.sqlite`, and the existing `natarot-backup.service` tooling.
- Local: no persistent production-data copy.

**Interfaces:**
- Consumes: the current active production database and backup scripts.
- Produces: a new backup ID/timestamp/archive hash, readable archive, database integrity result, and restore-readiness evidence.

- [ ] **Step 1: Confirm no backup is currently running**

Run `systemctl is-active natarot-backup.service` and inspect the timer/job metadata. Do not start a second backup concurrently.

- [ ] **Step 2: Trigger a new backup**

Run `systemctl start natarot-backup.service` and read only status metadata plus the safe backup log lines containing `backup_id`, stage, result, and archive hash.

- [ ] **Step 3: Verify checksum and archive readability**

Resolve the newest archive from the safe `latest-success` metadata, run `sha256sum -c` against its sidecar, list the archive entries with `tar -tzf`, and assert that it contains the production database, migration metadata, release metadata, and no plaintext environment/secret file.

- [ ] **Step 4: Verify database and restore readiness**

Run `PRAGMA integrity_check` and `PRAGMA foreign_key_check` on the live database read-only, extract the archive into a private temporary directory, repeat integrity checks on the extracted database, and remove only that explicitly created temporary directory after verification. Record `RESTORE_READINESS=PASS` only after all checks pass.

### Task 4: Prepare and migration-dry-run the candidate release

**Files/Systems:**
- Local candidate archive created outside Git from the verified branch.
- Remote candidate directory `/opt/natarot.release-<release-id>` and a temporary cloned production database.

**Interfaces:**
- Consumes: verified source, local production build, fresh backup, and preserved `/etc/natarot.env`.
- Produces: a secret-free candidate release with dependencies/build, a dry-run migration result, file/archive hashes, and a rollback-ready release ID.

- [ ] **Step 1: Build the candidate locally**

Run `npm run build`, inspect `dist` route/static inventory, and scan generated files for secret-like values before packaging. Do not copy `.env*`, databases, cookies, logs, `.git`, `node_modules`, or temporary state into the archive.

- [ ] **Step 2: Create and inspect a reproducible archive**

Create a restrictive temporary directory with `mktemp -d`, archive tracked source plus `dist`/required public assets and lockfile, list the archive, compute its SHA-256, and scan the archive contents and extracted text for credential values. Keep the archive outside Git and delete it only after the remote candidate has its own verified hash.

- [ ] **Step 3: Upload without changing the active release**

Create `/opt/natarot.release-<release-id>` owned by `natarot:natarot`, transfer the archive over the configured SSH connection, extract it there, and run `npm ci --no-audit --no-fund` plus the production build on Linux when the candidate requires a host-native artifact. Verify the candidate `package.json`, `dist`, migration files, service template, and route inventory.

- [ ] **Step 4: Dry-run migration against a clone**

Copy `/var/lib/natarot/natarot.sqlite` to a private `/var/lib/natarot/preflight-<release-id>.sqlite` with mode `600`, run the candidate `node scripts/node-migrate.mjs` with `NATAROT_DB_PATH` set to the clone, and inspect only migration names, schema/table names, counts, `integrity_check`, and `foreign_key_check`. Do not touch the live database during this step.

- [ ] **Step 5: Validate runtime configuration compatibility**

Compare the candidate systemd template to the active unit and keep the existing Nginx TLS configuration if the upstream remains `127.0.0.1:8787`. Preserve every existing production environment value; add only a non-secret mapping proven necessary by the candidate smoke test. Do not add SePay sandbox or production credentials.

### Task 5: Atomically deploy, migrate, restart, and prove readiness

**Files/Systems:**
- Remote active path `/opt/natarot`, new candidate path, new rollback path, `/var/lib/natarot/natarot.sqlite`, and `natarot.service`.
- Preserve `/etc/natarot.env`, production Nginx TLS/certificates, `natarot-staging.service`, and staging data.

**Interfaces:**
- Consumes: candidate release, passed backup, passed migration dry-run, and rollback metadata.
- Produces: a live release identity, migrated production database, healthy service, and verified HTTPS/public health.

- [ ] **Step 1: Capture rollback metadata**

Record the active tree identity, service PID/start time, database hash/metadata, migration rows, Nginx config hash, and backup ID. Confirm the candidate and rollback target are on the same filesystem before renaming.

- [ ] **Step 2: Apply only classified safe migrations**

Run the candidate migration runner against the live database only after the backup and dry-run checks pass. Immediately run integrity/foreign-key/schema/catalog/count sanity checks and stop the release switch if any check fails.

- [ ] **Step 3: Switch release directories atomically**

Move the active `/opt/natarot` to a new timestamped rollback path, move the prepared candidate into `/opt/natarot`, write non-secret `DEPLOYMENT_REVISION` metadata, preserve ownership/mode, and never delete the prior tree.

- [ ] **Step 4: Restart and poll bounded readiness**

Run `systemctl daemon-reload` only if the unit changed, then restart only `natarot.service`. Poll `systemctl is-active`, `127.0.0.1:8787/api/health`, `https://natarot.com/api/health`, and `https://www.natarot.com/api/health` for a bounded window. If diagnosis and safe repair do not restore health, atomically restore the prior tree and compatible database state, restart, and verify rollback health.

- [ ] **Step 5: Confirm release persistence and route inventory**

After readiness, verify the active deployment metadata matches the target commit, route/static inventory contains the Full Feature surfaces, and no later process or release overwrote the candidate tree.

### Task 6: Run real production smoke and customer E2E

**Files/Systems:**
- Public `https://natarot.com` and `https://www.natarot.com`.
- Synthetic guest cookies/IDs and temporary test artifacts only.

**Interfaces:**
- Consumes: healthy production release, live DeepSeek credential already present on VPS, and synthetic questions/identities.
- Produces: status-only E2E evidence for Home/Auth/Guest/Tarot/SpreadBoard/reading/persistence/share and precise external-gate classifications.

- [ ] **Step 1: Run public health and static smoke**

Verify HTTPS `200`, HTTP-to-HTTPS redirects, security/no-store headers, homepage, `/room`, `/create`, `/guidebook`, `/account`, `/packages`, `/checkout`, `/affiliate`, `/admin`, and representative static assets without logging response bodies containing private data.

- [ ] **Step 2: Run guest catalog/draw/session flow**

With a fresh cookie jar, call catalog, automatic topic recommendation, manual topic override, 3-card draw, 10-card Celtic Cross draw, session hydration, room persistence, and orientation/card-detail checks. Verify F-001 spoofed-header rejection and owner isolation using separate synthetic cookies.

- [ ] **Step 3: Run one real provider-backed reading**

Use a synthetic Vietnamese question and the actual production flow through draw → reading → DeepSeek → parser → persistence → response. Verify prompt `tarot-reading-v4.2.2`, KB V5, L5/L7/L8 semantics, valid cardinalities, stored reading ownership, no raw provider error, no secret/token leakage, and safe reservation/consume/release behavior where the guest path exposes it.

- [ ] **Step 4: Run the complete Share loop**

From the completed synthetic reading, create a share, fetch the opaque public URL, render public view, fetch image/QR, post an analytics event twice to verify idempotency, verify owner history, revoke, and confirm revoked access is denied. Verify private readings remain private by default and response payloads contain no PII or sequential sensitive IDs.

- [ ] **Step 5: Exercise auth/account and classify human/provider gates**

Verify unauthenticated protections, register/login/password-recovery/verification response contracts, `/account` and history ownership, Google start/redirect/callback mapping, and foreign-user denial. Do not request or print credentials; classify Resend HTTP 401 as `EXTERNAL_GATE` and Google interactive login as `EXTERNAL_GATE` if browser consent is required.

### Task 7: Run commercial, affiliate, admin, security, mobile, restart, and observability checks

**Files/Systems:**
- Production APIs/UI and logs; synthetic records only.
- No real payment, payout, privilege change, or secret rotation.

**Interfaces:**
- Consumes: completed reading/share evidence and safe synthetic request boundaries.
- Produces: final feature matrix classifications, adversarial security evidence, restart persistence evidence, and remaining external-gate list.

- [ ] **Step 1: Verify Packages/Credits/VIP/Orders without real money**

Verify server-priced package reads, owner scoping, idempotency/replay protections, unauthenticated denial, and safe no-provider/no-payment responses. Do not enable SePay on production; classify the production-domain Sandbox path as `EXTERNAL_GATE` unless the source explicitly supports a safe isolated test mode already configured on production.

- [ ] **Step 2: Verify Affiliate and Admin/RBAC boundaries**

Use only implemented safe test boundaries. Check self-referral, replay, duplicate commission, IDOR, role spoofing, F-001 spoofing, admin/support/finance/content permissions, ledger-only credit changes, authorized VIP changes, and audit records. Classify provider/fixture-dependent mutation paths rather than faking financial records.

- [ ] **Step 3: Run adversarial security checks**

Probe origin/CSRF, F-001, IDOR, RBAC escalation, mass assignment, XSS/SQL injection boundaries, PII/secret/log leakage, share privacy, replay/idempotency, and concurrency. Fix Critical/High internally controllable findings with TDD and redeploy/retest; do not change protected semantics for speculative hardening.

- [ ] **Step 4: Run functional mobile checks**

At 375px, 390px, and 412px verify Home, Auth, Room, SpreadBoard/10-card, Reading, Share, Account, Packages, Checkout, Affiliate, and Admin for horizontal overflow, unreachable CTAs, broken modals, impossible navigation, and hidden essential controls. Record visual polish separately as future UI work.

- [ ] **Step 5: Restart once and verify persistence**

Restart only `natarot.service` after successful E2E. Verify health, auth boundaries, database integrity/migration state, Tarot catalog/draw, DeepSeek reading, Account/history responses, Packages, Share/revoke state, and presence of every required production configuration name. Ensure migrations do not rerun destructively.

- [ ] **Step 6: Inspect logs safely**

Review bounded production journal output with redaction/filtering for keys, tokens, OAuth secrets, payment secrets, raw provider authorization, unexpected PII, and expected provider failure stack traces. Fix unsafe logging only if a proven internal defect exists, then repeat the relevant tests.

### Task 8: Document, review, commit, push, and hand off

**Files:**
- Create: `docs/reports/natarot-full-feature-production-v1-final-report.md`
- Modify: `docs/PROJECT_STATE.md`
- Modify: this plan to check completed steps when execution is finished.

**Interfaces:**
- Consumes: all source, backup, deployment, database, E2E, security, mobile, restart, and log evidence.
- Produces: source-tracked deployment report, updated durable project state, reviewed commit, pushed branch, and final owner checklist.

- [ ] **Step 1: Write the final report and feature matrix**

Record exact release commit/ID, backup ID/timestamp/hash/restore readiness, migration names/result, service/release/rollback identity, health and E2E evidence, and classify every required feature exactly as `DEPLOYED + VERIFIED`, `DEPLOYED + EXTERNAL_GATE`, or `NOT DEPLOYED`. Never include secret values, tokens, private row contents, or cookie contents.

- [ ] **Step 2: Update project state**

Append a dated production checkpoint to `docs/PROJECT_STATE.md` separating source/integrated/deployed/runtime/E2E verification, listing inherited lint findings and unfinished external gates, and stating that no UI redesign or real-money activation began.

- [ ] **Step 3: Perform independent review**

Run the full regression suite, TypeScript, production build, targeted lint, `npm audit --omit=dev`, `git diff --check`, secret scan, database integrity/migration checks, and the final public health/E2E checks on the exact committed tree. Dispatch a code review for the documentation/source diff when multi-agent support is available; independently inspect any findings before pushing.

- [ ] **Step 4: Inspect and commit only related files**

Run `git status --short`, `git diff --cached --stat`, `git diff --cached`, and the secret scan before committing. Commit the report/state/necessary source fixes with a clear message; do not stage runtime artifacts, local test data, or unrelated user files.

- [ ] **Step 5: Push and verify remote equality**

Run `git push -u origin codex/natarot-production-full-feature-v1` and verify `git rev-parse HEAD` equals `git ls-remote origin refs/heads/codex/natarot-production-full-feature-v1`. Report any push failure explicitly; a local commit is not a remote backup.

- [ ] **Step 6: Deliver the exact owner checklist and verdict**

Provide the simple `natarot.com` test sequence, list only genuinely missing owner-provided items (expected: the invalid Resend key), and end with the exact verdict lines required by the runbook. Do not start UI redesign, real payments, or another milestone.

## Execution status (2026-09-22)

- [x] Task 1 — source/live audit, reconciliation, and plan checkpoint completed.
- [x] Task 2 — local tests/build/type/security gates and migration compatibility checks completed.
- [x] Task 3 — fresh production backup, checksum, archive, integrity, and restore-readiness checks completed.
- [x] Task 4 — reproducible candidate archive, Linux dependency/build verification, and migration dry run completed.
- [x] Task 5 — safe live migrations, atomic release switch, restart, and public readiness completed.
- [x] Task 6 — guest, auto-topic, Tarot, live DeepSeek, persistence, and Share/QR production E2E completed.
- [x] Task 7 — security, HSTS hardening, external-gate classification, responsive smoke, restart persistence, and bounded log review completed.
- [x] Task 8 — documentation is written and independently reviewed; documentation commit `6667fce` is pushed to `origin/codex/natarot-production-full-feature-v1`.
