# NaTarot VPS Backup & Disaster Recovery V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and verify a private, consistency-safe NaTarot VPS backup and disaster-recovery workflow without changing production product behavior or schema.

**Architecture:** Install a strict Bash backup runner plus a Node `node:sqlite` `VACUUM INTO` helper on the VPS. Add systemd daily backup and monthly isolated restore-test units, private Google Drive off-site verification, and operator runbooks; all restore work points at temporary paths and loopback-only test ports.

**Tech Stack:** Bash, Node 22 `node:sqlite`, SQLite WAL, `tar`, `sha256sum`, `flock`, systemd, Nginx metadata, Google Drive connector, Node test runner.

**Spec:** `docs/superpowers/specs/2026-09-21-natarot-vps-backup-dr-v1-design.md`

## Global Constraints

- Production database path is `/var/lib/natarot/natarot.sqlite`; a live SQLite file must never be copied blindly.
- The active release is identified from `/opt/natarot/DEPLOYMENT_REVISION`, not from `main` or the Integration V1 commit.
- Production product code, schema, service restart state, credentials, and user records remain unchanged.
- Backup archives, `.env` values, private keys, logs, build output, and customer data are never committed.
- Restore tests use a temporary directory and a loopback port only; they never restore over production.
- Retention is 7 daily, 4 weekly, and 3 monthly successful snapshots, with at least one known-good snapshot preserved.
- Every stage is independently verified before the mission is reported complete.

---

### Task 1: Test fixtures and SQLite consistency helper

**Files:**
- Create: `deploy/backup/natarot-sqlite-backup.mjs`
- Test: `tests/natarot-backup.test.ts`

**Interfaces:**
- Consumes: a source SQLite path and destination SQLite path from positional arguments.
- Produces: JSON metadata on stdout with source/destination integrity, table count, migration count, safe table row counts, and byte size; nonzero exit on source or destination validation failure.

- [x] **Step 1: Write failing tests** for the helper's `VACUUM INTO` copy, WAL-safe reopen, integrity check, migration/table metadata, and missing-source failure.
- [x] **Step 2: Run the focused test file** and confirm it fails because the helper does not exist.
- [x] **Step 3: Implement the smallest Node helper** using `DatabaseSync`, escaped `VACUUM INTO`, read-only destination validation, and metadata-only output.
- [x] **Step 4: Run the focused test file** and confirm all helper cases pass.
- [x] **Step 5: Commit** `test: cover SQLite backup verification`.

### Task 2: Strict backup runner and retention

**Files:**
- Create: `deploy/backup/natarot-backup.sh`
- Modify: `tests/natarot-backup.test.ts`

**Interfaces:**
- Consumes: `NATAROT_BACKUP_ROOT`, `NATAROT_APP_ROOT`, `NATAROT_DB_PATH`, `NATAROT_NODE_BIN`, `NATAROT_MIN_FREE_KIB`, and `NATAROT_BACKUP_ID` overrides for fixture testing.
- Produces: a verified tarball under `daily/`, manifest/checksum entries, `latest-success`, `last-status`, stage-aware logs, and safe retention links under `weekly/` and `monthly/`.

- [x] **Step 1: Add failing tests** for successful fixture backup, missing database, disk threshold failure, archive checksum, manifest exclusion of environment values, and lock overlap.
- [x] **Step 2: Run the focused tests** and confirm the expected failures.
- [x] **Step 3: Implement the runner** with strict mode, `flock`, stage trap, disk preflight, helper invocation, allowlisted configuration capture, manifest/checksum generation, tar verification, status markers, and fail-safe retention.
- [x] **Step 4: Run the focused tests** and confirm success, then run `bash -n deploy/backup/natarot-backup.sh`.
- [x] **Step 5: Commit** `ops: add verified VPS backup runner`.

### Task 3: Isolated restore-test runner

**Files:**
- Create: `deploy/backup/natarot-restore-test.sh`
- Modify: `tests/natarot-backup.test.ts`

**Interfaces:**
- Consumes: `--archive PATH` or the latest-success marker, application root, Node binary, and optional test port.
- Produces: a stage-aware restore result; restored database integrity and schema evidence; a loopback application smoke result; no writes under the production database path.

- [x] **Step 1: Add failing tests** for archive extraction, restored database validation, production-path isolation, missing archive failure, and no-provider read-only catalog smoke behavior.
- [x] **Step 2: Run the focused tests** and confirm the expected failures.
- [x] **Step 3: Implement isolated extraction, migration-runner validation, optional local server startup, HTTP catalog check, cleanup trap, and safe result logging.
- [x] **Step 4: Run the focused tests** and confirm success.
- [x] **Step 5: Commit** `ops: add isolated backup restore verification`.

### Task 4: Systemd units and recovery documentation

**Files:**
- Create: `deploy/systemd/natarot-backup.service`
- Create: `deploy/systemd/natarot-backup.timer`
- Create: `deploy/systemd/natarot-restore-test.service`
- Create: `deploy/systemd/natarot-restore-test.timer`
- Create: `docs/operations/NATAROT_BACKUP.md`
- Create: `docs/operations/NATAROT_DISASTER_RECOVERY.md`
- Modify: `tests/deployment-contract.test.ts`

**Interfaces:**
- Systemd units invoke `/usr/local/sbin/natarot-backup` and `/usr/local/sbin/natarot-restore-test` with explicit environment paths and no product-service restart.
- Runbooks describe installation, manual backup, Drive upload/verification, selection, checksums, source checkout at the recorded commit, runtime setup, database restore, Nginx/systemd recovery, health checks, rollback, and monthly restore verification.

- [x] **Step 1: Add failing deployment-contract assertions** for daily and monthly timers, lock/failure logging, no product migration, and restore isolation.
- [x] **Step 2: Run the focused contract test** and confirm it fails.
- [x] **Step 3: Add the units and runbooks** with exact paths and commands, excluding all secrets and private key material.
- [x] **Step 4: Run contract tests, Markdown placeholder scans, shell syntax checks, and `git diff --check`.
- [x] **Step 5: Commit** `docs: document NaTarot backup and disaster recovery`.

### Task 5: Install and verify the live VPS workflow

**Files:**
- Source files from Tasks 1–4 copied to root-owned `/usr/local/lib/natarot`, `/usr/local/sbin`, and `/etc/systemd/system` on the VPS; no production application files modified.

- [x] **Step 1: Re-run read-only production inventory** and record release, database, service, Nginx, disk, and firewall evidence.
- [x] **Step 2: Install the helper, scripts, and units** with restrictive ownership/modes and run `systemctl daemon-reload`.
- [x] **Step 3: Enable the backup and restore-test timers** without restarting `natarot.service`.
- [x] **Step 4: Run one real backup** with `systemctl start --wait natarot-backup.service` and verify archive, manifest, checksum, database integrity, and status markers.
- [x] **Step 5: Run the isolated restore test** and verify the restored database and loopback catalog response.
- [x] **Step 6: Re-check production service, database file/WAL/SHM metadata, release marker, and schema counts** to prove production was not modified by restore testing.

### Task 6: Private off-site copy and recurring sync

**Files:**
- Drive folder: private `NaTarot/Production Backups`.
- VPS marker: `/var/lib/natarot/backup/offsite-last-verified.json`.

- [x] **Step 1: Create or locate the private Drive folder** without changing sharing permissions.
- [x] **Step 2: Copy the verified archive to a local ephemeral path**, upload it, and verify remote filename, size, timestamp, and checksum metadata where available.
- [x] **Step 3: Write only non-secret remote identity/checksum metadata to the VPS marker** and verify the marker has no credentials.
- [x] **Step 4: Configure a quiet daily off-site sync task** that triggers only when the backup ID is new or remote verification is missing, and remains silent when unchanged.
- [x] **Step 5: Test the sync task once** and document the exact off-site health check.

### Task 7: Self-review, project state, and delivery

**Files:**
- Modify: `docs/PROJECT_STATE.md`
- Commit only related backup/DR files and project-state evidence.

- [x] **Step 1: Review as SRE, DBA, security engineer, release engineer, and operator.**
- [x] **Step 2: Fix every Critical or Important finding and rerun focused tests/live verification.**
- [x] **Step 3: Run the final repository gates**: focused tests, tracked regression baseline as practical, TypeScript/build only if source tooling requires it, shell syntax, deployment contracts, secret scan, and `git diff --check`.
- [x] **Step 4: Inspect staged diff for secrets, database files, archives, logs, and generated output.**
- [x] **Step 5: Commit `ops: add verified VPS backup and recovery workflow` and push `codex/natarot-vps-backup-dr-v1`.
- [x] **Step 6: Verify local and remote branch heads match and produce the specified final report, then stop.
