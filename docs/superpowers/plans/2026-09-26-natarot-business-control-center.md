# NaTarot Business Control Center Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and deploy read-only NaTarot business reporting to Google Sheets and encrypted offsite copies of the existing production backups, leaving both scheduled jobs inactive until the owner grants production Google Drive access.

**Architecture:** Add a reporting read model and idempotent Sheets writer over the canonical SQLite/D1 repositories. Add a separate Node/systemd job that uses the existing production OAuth connection and PII keyring for private Drive files, with a download/decrypt/restore verification gate. Keep the current local backup service and retention policy unchanged.

**Tech Stack:** TypeScript, SQLite/D1 adapter, Node 22, Google Drive/Sheets REST APIs, systemd oneshot/timer, AES-256-GCM, existing NaTarot OAuth/encryption and test fixtures.

**Spec:** `docs/superpowers/specs/2026-09-26-natarot-business-control-center-design.md`

## Global Constraints

- Production database stays `/var/lib/natarot/natarot.sqlite` and remains authoritative.
- The Google Sheets workbook is an output only; never mutate customer, payment, Credit, Affiliate, attribution, or access-control state.
- Export no passwords, tokens, payment credentials, referral/owner keys, private Tarot questions, interpretations, fraud notes, or source snapshots.
- Use the existing `drive.file` grant with the production OAuth client; never request full Drive scope or expose credentials.
- Keep local backup retention at 7 daily, 4 weekly, and 3 monthly; never delete local database backups due to an offsite copy.
- Do not enable the new timer until one eligible verified `SUPER_ADMIN` connects Google Drive.
- Keep NaTarot and VinTarot branding and the existing production baseline/rollback releases.

---

### Task 1: Canonical reporting schema and read model

**Files:**
- Create: `drizzle/0011_business_reporting.sql`
- Create: `lib/business-reporting/types.ts`
- Create: `lib/business-reporting/read-model.ts`
- Create: `tests/business-reporting-read-model.test.ts`
- Modify: `scripts/node-migrate.mjs` only if migration integration requires a new compatibility guard

**Interfaces:**
- `loadBusinessReport(database, { now, timeZone })` returns typed rows and aggregate KPI values for all eight tabs using only canonical tables.
- `opaqueReportId(namespace, internalId)` returns a stable prefixed SHA-256 pseudonym; no raw ID is in any exported row.
- `recordDailyActivitySnapshot(database, { businessDate, activeUsers, capturedAt })` stores only one aggregate count per business date and never a member ID.

- [x] Write fixture-first tests proving pending/rejected/mismatched events and unfulfilled orders contribute zero verified revenue.
- [x] Run `npx tsx --test tests/business-reporting-read-model.test.ts` and confirm the missing read model fails for the expected missing export.
- [x] Add schema rows for job checkpoint/lease, row fingerprints, daily aggregate activity snapshots, sanitized export audits, and offsite backup metadata.
- [x] Implement HCMC day boundaries, 30-day verified active users, 90-day pseudonymous row scope, order/refund revenue, Credit ledger signs, Affiliate ledger net totals, referral status, daily session counts, and returning readers.
- [x] Add tests for full refunds, Credit expiration/refund signs, Affiliate held/eligible/reversed/adjusted amounts, disabled/unverified members, HCMC registration date, expired row data, and absence of private source columns.
- [x] Run `npx tsx --test tests/business-reporting-read-model.test.ts tests/business-reporting-migration.test.ts tests/node-migrate.test.ts` (11/11 passed), run `npx tsc --noEmit`, and commit schema and read-model files as `feat: add canonical business reporting read model`.

### Task 2: Google authorization gate and incremental Sheets synchronization

**Files:**
- Create: `lib/business-reporting/google-sheets.ts`
- Create: `lib/business-reporting/sync.ts`
- Create: `tests/business-reporting-google-sheets.test.ts`
- Create: `tests/business-reporting-sync.test.ts`
- Modify: `lib/google-drive.ts` for app-token, private Drive-file, and Sheets request helpers
- Modify: `lib/google-drive-config.ts` only to keep its runtime import usable by the Node reporting runner

**Interfaces:**
- `resolveReportingOwner(database)` returns the one verified enabled connected `SUPER_ADMIN`, or a sanitized blocked reason.
- `ensureBusinessSpreadsheet(owner)` creates/recovers one private native workbook with the eight exact tab names and persists its returned Google ID.
- `syncBusinessReport(database, { now, forceReconcile, fetchImpl, sleep })` takes an atomic lease, writes changed keyed rows in bounded batches, updates dashboard/system status, and advances the checkpoint only after successful API confirmation.
- `googleFetchWithRetry(request, { fetchImpl, sleep, random, maxAttempts })` retries only rate-limit/transient API responses and never logs response bodies or authorization headers.

- [x] Add synthetic tests for no owner, multiple owners, workbook-create retry, exact tabs, unchanged-row no-op, changed-row upsert, duplicate retry, same-day reconciliation, failure checkpoint preservation, lock overlap, 429 `Retry-After`, 5xx backoff, and sanitized errors.
- [x] Run the two focused test files and confirm the new APIs are absent before implementation.
- [x] Implement exact-name private workbook creation through Drive/Sheets APIs and the existing `drive.file` access token; do not use Codex MCP or create sharing permissions.
- [x] Implement stable-key lookup, fingerprint comparison, changed-row batches, one full local-day reconciliation, row retention pruning, bounded retries, checkpoint/lease/audit updates, and the System status projection.
- [x] Verify with synthetic tests that the generated write contract contains no personal/private source fields and exactly the eight requested tabs.
- [x] Run focused Google/reporting tests, `npx tsc --noEmit`, and `npx tsx --test tests/google-oauth.test.ts tests/google-drive.test.ts` (40/40 focused tests passed); commit as `feat: sync business reports to private Google Sheets`.

### Task 3: Encrypted offsite Drive backups and restore verification

**Files:**
- Create: `lib/business-reporting/backup-crypto.ts`
- Create: `lib/business-reporting/offsite-backup.ts`
- Create: `tests/business-reporting-backup.test.ts`
- Modify: `lib/google-drive.ts` only for token-scoped upload/download/metadata/delete of app-owned files

**Interfaces:**
- `encryptBackupArchive(sourcePath, destinationPath, backupId, keyring)` writes a versioned AES-256-GCM stream with a per-file data key wrapped by `encryptField` under `natarot.offsite-backup.key.v1`.
- `decryptBackupArchive(sourcePath, destinationPath, keyring)` authenticates the complete stream and verifies the source archive SHA-256 before returning.
- `uploadVerifiedOffsiteBackup({ database, owner, archivePath, manifest, restoreVerifier })` uploads encrypted bytes and a separate metadata-only manifest, validates remote identity and bytes, downloads/decrypts, and calls the isolated restore verifier before recording success.
- `mirrorBackupRetention(localReferences, remoteManagedFiles)` moves only app-owned obsolete Drive files to Trash after current remote verification; it never writes to local backup paths.

- [ ] Add synthetic tests for round-trip encryption, wrong key, byte tampering, source checksum mismatch, interrupted upload, retry, remote metadata mismatch, restore failure, idempotent duplicate backup ID, and exact 7/4/3 remote references.
- [ ] Run `npx tsx --test tests/business-reporting-backup.test.ts` and verify expected missing exports.
- [ ] Implement streaming AES-GCM, wrapped key header, streaming Drive upload/download, separate metadata-only manifest, remote file ID/name/size/appProperties/hash checks, and sanitized status persistence.
- [ ] Invoke the existing restore-test script with `--archive` using a separate restore status root and a private temporary decrypted archive plus its checksum sidecar.
- [ ] Mirror the local 7 daily/4 weekly/3 monthly reference set only after a successful remote restore test; never modify `/var/backups/natarot` contents.
- [ ] Run backup tests and existing storage/restore contract tests; commit as `feat: encrypt and verify offsite production backups`.

### Task 4: Scheduled runner, failure alert, operator guide, and workbook status

**Files:**
- Create: `scripts/business-control-center.ts`
- Create: `deploy/systemd/natarot-business-control-center.service`
- Create: `deploy/systemd/natarot-business-control-center.timer`
- Create: `docs/operations/NATAROT_BUSINESS_CONTROL_CENTER.md`
- Create: `tests/business-control-center-deployment.test.ts`
- Modify: `lib/runtime.ts` if a typed reporting environment setting is required
- Modify: `docs/PROJECT_STATE.md`

**Interfaces:**
- The runner separately attempts Sheets sync and offsite backup, acquires the DB lease, records statuses, and exits without changing the web service state.
- The systemd timer is installable but disabled by default; it runs every 15 minutes with `Persistent=true`.
- The guide gives the owner’s exact production OAuth path, expected `drive.file` consent, enable/start command after connection, status checks, disconnect/revocation behavior, retention rules, and restore-verification evidence.
- A continuous 24-hour backup failure sends at most one operational alert per day to the connected owner email through existing Resend config; no alert contains customer data or provider payloads.

- [ ] Write deployment-contract tests for the 15-minute timer, `User=root`, private umask, `/etc/natarot.env`, lock/timeout, sandbox paths, explicit no-web-service dependency, and disabled-by-default install behavior.
- [ ] Run `npx tsx --test tests/business-control-center-deployment.test.ts` before adding units/runner.
- [ ] Implement the Node/TSX runner with independent Google job errors, daily local-time reconciliation, 24-hour alert threshold/dedupe, and machine-readable status-only output.
- [ ] Add systemd units and deployment guide. Verify no secrets or database/build artifacts are staged.
- [ ] Run focused reporting/backup/deployment tests, `npx tsc --noEmit`, `npm run build`, and `git diff --check`; commit as `feat: schedule isolated business reporting and backup jobs`.

### Task 5: Production deploy with Google work paused

**Files:**
- Modify: `docs/PROJECT_STATE.md` with final validation, deployment, auth gate, and exact remaining owner action.
- Production mutation: managed release deployment and additive schema migration only; do not enable the new timer.

- [ ] Run `npx tsx --test tests/*.test.ts`, TypeScript, production build, and diff checks; fix and rerun any failures.
- [ ] Run focused synthetic comparisons for verified payment/revenue, Affiliate ledger, customer/activity aggregates, row retention, encryption, and restore readiness. Do not export or print production rows.
- [ ] Recheck latest production baseline, disk/storage guard, `current` and both rollback references, then create and verify a fresh existing-format local backup before deploy.
- [ ] Build and stage only tracked release files; use the managed release manager so the new migration and units follow the existing backup/candidate/health/promotion gates.
- [ ] Confirm production health, migration version, latest backup retention and restore state, and that the new timer remains disabled and no production Google API call was attempted.
- [ ] Compare only aggregate canonical counts and record evidence in `docs/PROJECT_STATE.md`; commit and push completed source changes. Report the production owner’s Google connection as the activation gate.
