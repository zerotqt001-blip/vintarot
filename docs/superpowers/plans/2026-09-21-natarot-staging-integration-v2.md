# NaTarot Staging Integration V2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to execute this plan task-by-task with verification checkpoints.

**Goal:** Integrate the verified Credits/VIP V1 product into Master Integration V1, safely audit and clean only provably disposable staging/VPS artifacts, migrate and deploy staging only, then produce a live feature/browser/UI reality audit without redesigning the UI.

**Architecture:** Start from `f5452a35d7b4bbc9884e52d0890c4f5e9c39e9fe` on `codex/natarot-staging-integration-v2`, cherry-pick the verified Credits/VIP commit `121e184a617f43df049407ff5981e17ba6613616`, and preserve the existing staging infrastructure and protected subsystems. Use read-only VPS discovery and explicit manifests before any exact-target cleanup; back up the staging SQLite database before migration; deploy only the staging release; and document evidence in a mission report and project state.

**Tech Stack:** Git/worktrees, Next.js/TypeScript application, Wrangler/D1-compatible migrations, SQLite, systemd, Nginx, SSH/VPS runtime, live HTTPS staging, desktop/mobile browser QA.

**Spec:** `/Users/tranquangthanh/.codex/attachments/e26776ba-ff85-4568-92e2-4b22fbdc46d4/Văn bản đã dán.txt`

## Global Constraints

- Staging only; never deploy, migrate, restart, or modify production.
- Never implement SePay, Affiliate, commission, Admin/RBAC, User Data Isolation migration, final UI redesign, true L6 token streaming, new pricing, or production payment.
- Before every staging cleanup or deployment, independently re-check the current staging service/release path for a parallel SePay worker race.
- Unknown files, databases, secrets, active releases, active SQLite WAL/SHM, required backups, and the only rollback release are KEEP/HUMAN_GATE, never automatic deletion targets.
- Keep at least one known-good staging rollback release and the production retention minimum when the discovered architecture supports it.
- Do not print secrets or customer/synthetic database contents.
- Use failing tests before any implementation fix; use systematic debugging for failures; verify all claims with fresh command output.

### Task 1: Authoritative graph and integration branch

**Files:**
- Create: `docs/superpowers/plans/2026-09-21-natarot-staging-integration-v2.md`
- Modify later: `docs/PROJECT_STATE.md`

**Interfaces:**
- Consumes: Master Integration V1 commit, Credits/VIP V1 commit, staging V1 commit, remote branch refs.
- Produces: exact integration branch based on Master Integration V1 with Credits/VIP V1 included.

- [x] **Step 1: Audit graph and refs**

Run `git status --short --branch`, `git worktree list --porcelain`, `git branch -a -vv`, and inspect parents/merge-bases for the authoritative commits. Confirm the worktree is isolated and has no user changes.

- [x] **Step 2: Create the exact branch**

Create `codex/natarot-staging-integration-v2` from `f5452a35d7b4bbc9884e52d0890c4f5e9c39e9fe`; do not merge `main` or use another worker's worktree.

- [ ] **Step 3: Integrate the verified Credits/VIP commit**

Use the simplest semantically correct ancestry operation after confirming the common ancestor. Prefer a fast-forward or single cherry-pick of `121e184a617f43df049407ff5981e17ba6613616`; resolve only safe conflicts, preserving Auth, F-001, tarot, L1/L4/L5/L7/L8, Share S1–S6, verification/security, backup/DR, and Credits/VIP invariants.

- [ ] **Step 4: Inventory actual feature files and migration 0006**

Inspect the resulting diff and source paths for the credit ledger, FIFO allocation, idempotency, VIP entitlement, orders, Tarot reserve/consume integration, migration, tests, and staging config. Record omissions rather than inventing replacements.

### Task 2: Read-only VPS audit and safe cleanup decision

**Files:**
- Create outside Git or local evidence only: redacted audit/cleanup manifest; do not commit secrets, DBs, backups, or runtime output.
- Modify later: `docs/PROJECT_STATE.md`

**Interfaces:**
- Consumes: discovered VPS filesystem, `natarot.service`, `natarot-staging.service`, Nginx config, backup tooling, release markers.
- Produces: disk/inode baseline, runtime map, DB/release inventory, backup/secret/cache/log analysis, exact-target cleanup manifest.

- [ ] **Step 1: Capture disk and inode baseline**

Run `df -h` and `df -i`, then inspect only discovered relevant paths under `/var/lib/natarot`, `/var/lib/natarot-staging`, `/opt`, `/srv`, `/var/www`, `/var/log`, `/tmp`, and `/var/tmp`. Use metadata and bounded depth to identify large consumers.

- [ ] **Step 2: Resolve active runtime paths**

Inspect both systemd unit definitions, `ExecStart`, `WorkingDirectory`, environment-file paths, runtime users, release markers, DB paths, and writable/log paths. Inspect Nginx host/upstream/static/TLS references. Establish active production and staging releases and DBs without printing secret values.

- [ ] **Step 3: Classify databases, releases, backups, logs, caches, and secrets**

Classify every database-looking artifact as active, backup, restore-test, temp, or unknown; classify releases as ACTIVE, ROLLBACK_KEEP, HISTORICAL_KEEP, SAFE_DELETE, or UNKNOWN; inspect backup retention/off-site markers and presence-only secret metadata. Unknown remains KEEP.

- [ ] **Step 4: Write and review the cleanup manifest**

For every candidate record path, size, purpose, active reference, DB/backup relationship, secret presence, regenerability, rollback value, risk, and action. Allow DELETE only for exact, high-confidence disposable caches/temp/failed artifacts or inactive reproducible releases satisfying every mission criterion.

- [ ] **Step 5: Recheck staging before cleanup**

Re-read the staging service, active release, DB path, and version marker immediately before deletion. If a SePay worker changed staging or ownership is uncertain, stop at HUMAN_GATE with exact evidence.

- [ ] **Step 6: Execute exact-target cleanup and verify**

Delete only reviewed exact paths, never broad parent globs. Preserve active/unknown DBs, WAL/SHM, secrets, user data, required backups, and rollback releases. Re-run service checks and disk/inode measurements.

### Task 3: Product verification and staging database safety

**Files:**
- Modify later: `docs/PROJECT_STATE.md`
- Do not commit: staging DB backup, runtime DB, VPS env, deployment archives, or test/customer data.

**Interfaces:**
- Consumes: integrated product branch, staging DB path, verified backup tooling.
- Produces: passing focused/full validation, verified staging-only DB backup, migration-ready release.

- [ ] **Step 1: Run focused integration tests**

Run Credits/VIP, Auth/F-001, tarot, spread, Share, migration, and staging-deployment tests discovered from the repository scripts. Preserve inherited global lint debt and do not weaken tests.

- [ ] **Step 2: Run TypeScript, build, targeted lint, diff, and secret checks**

Run `npx tsc --noEmit`, production build, targeted lint for changed files, `git diff --check`, and a redacted secret scan that reports paths/presence without values.

- [ ] **Step 3: Create and verify the staging-only DB backup**

Recheck the staging DB path, create a timestamped backup using the existing safe mechanism, verify its integrity and migration state without exposing rows, and confirm the production DB path is not the target.

- [ ] **Step 4: Apply and verify migration 0006**

Run migration 0006 against staging only. Verify the migration chain, schema constraints/indexes, existing data compatibility, 78-card catalog, Share persistence, and Auth compatibility. If migration fails, use the verified staging backup and systematic debugging; never touch production.

### Task 4: Staging deployment and live regression

**Files:**
- Modify only staging VPS release/service/config as required by the mission; no production files.
- Modify later: `docs/PROJECT_STATE.md`

**Interfaces:**
- Consumes: tested integration release, migrated staging DB, staging service and Nginx.
- Produces: live `https://staging.natarot.com` release with health/API evidence and no production mutation.

- [ ] **Step 1: Recheck parallel staging state immediately before deployment**

Inspect `natarot-staging.service`, active release, staging DB, and version marker again. Compare against the initial audit; reconcile safe changes or stop for an unresolvable SePay race.

- [ ] **Step 2: Deploy and restart staging only**

Publish the new release, retain the previous known-good staging rollback, restart only `natarot-staging.service`, and verify `/`, `/room`, `/api/health`, relevant catalog/share/auth APIs, and the migration marker.

- [ ] **Step 3: Run feature inventory against live staging**

Exercise Auth/guest/member/F-001 contracts, 78-card/spread/Auto/manual/draw/orientation/SpreadBoard/L5/L7/L8 behavior, Share create/public/image/QR/analytics/revoke/IDOR, profile Credits/VIP, package/orders/fulfillment boundaries, and explicitly report SePay as not implemented.

- [ ] **Step 4: Audit provider/email/OAuth configuration**

Determine whether staging-authorized DeepSeek/email/Google OAuth configuration already exists securely. Perform at most one controlled live reading only if authorized staging credentials are already present; otherwise record NOT_CONFIGURED and continue.

### Task 5: Browser QA and UI reality audit

**Files:**
- Create: `docs/reports/natarot-staging-ui-reality-audit-v2.md`
- Modify later: `docs/PROJECT_STATE.md`

**Interfaces:**
- Consumes: live staging browser behavior at desktop and mobile viewports, current components/assets, design-system research reference only.
- Produces: concrete P0–P3 issue inventory with platform, area, actual/expected behavior, owning component/file, logic impact, and redesign safety.

- [ ] **Step 1: Verify desktop home/auth/room/reading/share/profile/commercial flows**

Use live staging screenshots and interaction checks for layout, assets, overflow, validation, Auto/manual spread, cards, reading hierarchy, follow-up/clarification, share, Credits/VIP, and navigation.

- [ ] **Step 2: Verify mobile equivalents**

Repeat at phone-sized viewport, checking safe areas, touch targets, table pan/zoom, SpreadBoard large/Celtic layouts, document overflow, dialogs, and bottom navigation.

- [ ] **Step 3: Run the Impeccable reality audit**

Use Impeccable only for critique/audit evidence; preserve the Moonlight/NaTarot reference and do not edit UI. Separate broken behavior from polish and place each issue in P0/P1/P2/P3 with DESKTOP/MOBILE/BOTH.

- [ ] **Step 4: Record the safe redesign base**

Document protected logic, files/components safe for UI-only work, current known limitations, and scope for the next explicit redesign milestone. Do not change UI code in this mission.

### Task 6: Final verification, documentation, commit, and push

**Files:**
- Modify: `docs/PROJECT_STATE.md`
- Create/modify: `docs/reports/natarot-staging-ui-reality-audit-v2.md`

**Interfaces:**
- Consumes: all audit/test/deploy/browser evidence.
- Produces: final report, committed branch, verified remote branch, and explicit production-isolation statement.

- [ ] **Step 1: Capture post-deploy disk/inode and production-isolation evidence**

Re-run `df -h`/`df -i`, calculate reclaimed space, new release size, net change, check release retention, and verify production health/homepage/catalog without restarting or modifying production.

- [ ] **Step 2: Run the complete final regression set**

Repeat focused and full tests, TypeScript, build, targeted lint, migration/staging contract checks, secret scan, and `git diff --check` after any fixes. Use systematic debugging and TDD for any code fix.

- [ ] **Step 3: Inspect staged diff for secrets and commit related repository files**

Stage only the integration/docs/report/project-state files, inspect `git diff --cached --stat` and content for secrets/customer data, then create a clear commit on `codex/natarot-staging-integration-v2`.

- [ ] **Step 4: Push and verify remote parity**

Push without force, then verify local HEAD equals `origin/codex/natarot-staging-integration-v2` and no unrelated worktree was touched.

- [ ] **Step 5: Write the final mission report and stop**

Use the exact requested headings and report PASS, HUMAN_GATE, or BLOCKED based on evidence. State production deployed/DB/service changed as NO, list limitations, and do not begin UI redesign, SePay, Affiliate, Admin/RBAC, or production work.

## Self-Review Checklist

- [x] Mission requirements are decomposed into auditable tasks.
- [x] Protected production, backup/DR, auth, tarot, share, and Credits/VIP areas are explicit.
- [x] Staging race and human-gate conditions are explicit before cleanup/deployment.
- [x] No task authorizes secrets, customer data, broad deletion, production, or final redesign.
- [x] Verification and documentation are required before commit/push/final claims.
