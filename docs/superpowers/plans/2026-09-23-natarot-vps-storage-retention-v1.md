# NaTarot VPS Storage Retention V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a fail-closed production release manager that migrates NaTarot from the flat VPS layout to a locked `current`/`previous-1`/`previous-2` topology and automatically removes only obsolete successful application releases after verified deployment.

**Architecture:** Use a Bash release manager with explicit path validation, one deployment lock, a short-lived loopback candidate systemd unit, atomic symlink promotion, rollback on failed production smoke checks, and post-success cleanup. Keep the existing `/usr/local/sbin/natarot-backup` runner as the sole database-backup owner; the new manager only invokes and verifies it. Use a separate read-only storage audit script and a fixture-driven Node test suite.

**Tech Stack:** Bash, Node 22, systemd, `flock`, `df`, `du`, `find`, `readlink`, `curl`, existing SQLite backup/restore services, Node `node:test`, TypeScript test harness.

**Spec:** `docs/superpowers/specs/2026-09-23-natarot-vps-storage-retention-v1-design.md`

## Global Constraints

- Keep `current`, `previous-1`, and `previous-2`; normal successful application-release retention is at most 3.
- Never delete a current release, rollback reference, active process cwd/executable, deployment-locked path, database, WAL/SHM file, environment file, secret, user data, backup, staging environment, or unknown path.
- Run cleanup only after candidate validation, candidate smoke, production restart, production health, and browser/smoke verification succeed.
- Use the existing backup service and its 7 daily / 4 weekly / 3 monthly policy; do not add a competing backup writer or apply “keep 3” to backups.
- Keep `/var/lib/natarot/natarot.sqlite`, `/etc/natarot.env`, and `/var/backups/natarot` outside release directories.
- Do not print or commit environment values, API keys, private keys, database contents, logs with PII, or payment credentials.
- Preserve the current dirty checkout by working only in `/Users/tranquangthanh/.codex/worktrees/natarot-storage-retention-v1/test astra` on `codex/natarot-vps-storage-retention-v1`.
- Do not apply automatic production cleanup to `/opt/natarot-staging` or its `before-*` history.

---

### Task 1: Add the failing storage-retention contract tests

**Files:**
- Create: `tests/natarot-storage-retention.test.ts`
- Modify: `tests/deployment-contract.test.ts`

**Interfaces:**
- Tests invoke `deploy/release/natarot-storage-audit.sh` with temporary `NATAROT_*` roots and invoke `deploy/release/natarot-release-manager.sh` with fixture command overrides.
- The manager commands are `audit`, `verify-backups`, `migrate-flat`, `deploy --source-dir DIR --release-id ID`, and `cleanup`.
- The manager must return nonzero and leave all protected references unchanged on unsafe input or failed health checks.

- [ ] **Step 1: Write the retention tests before adding implementation files.** Create fixture helpers that make a temporary application root, `releases/`, `.staging/`, `.failed/`, external database/config/backup paths, three successful release directories, one unknown directory, and fake `systemctl`, `curl`, and backup-status commands. Include tests with these exact behaviors:

```ts
test("cleanup keeps current and both rollback references and removes only old successful releases", () => {
  const fixture = createReleaseFixture({ successfulReleaseCount: 5 });
  const result = runManager(fixture, ["cleanup"]);
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(existingReleaseIds(fixture), ["r-003", "r-004", "r-005"]);
  assert.equal(readlinkSync(fixture.current), fixture.release("r-005"));
  assert.equal(readlinkSync(fixture.previous1), fixture.release("r-004"));
  assert.equal(readlinkSync(fixture.previous2), fixture.release("r-003"));
  assert.equal(existsSync(fixture.unknown), true);
  assert.equal(existsSync(fixture.database), true);
});

test("failed promotion restores the former current release and performs no cleanup", () => {
  const fixture = createReleaseFixture({ successfulReleaseCount: 3, productionSmoke: "fail" });
  const before = snapshotProtectedReferences(fixture);
  const result = runManager(fixture, ["deploy", "--source-dir", fixture.candidateSource, "--release-id", "r-004"]);
  assert.notEqual(result.status, 0);
  assert.deepEqual(snapshotProtectedReferences(fixture), before);
  assert.equal(existsSync(fixture.release("r-001")), true);
  assert.equal(existsSync(fixture.release("r-002")), true);
  assert.equal(existsSync(fixture.release("r-003")), true);
});

test("candidate validation rejects environment and SQLite files", () => {
  const fixture = createReleaseFixture({ candidateFiles: [".env.local", "data/natarot.sqlite"] });
  const result = runManager(fixture, ["deploy", "--source-dir", fixture.candidateSource, "--release-id", "r-004"]);
  assert.notEqual(result.status, 0);
  assert.match(`${result.stdout}\n${result.stderr}`, /persistent|environment|sqlite/i);
});

test("database backup verification is separate from application cleanup", () => {
  const fixture = createReleaseFixture({ successfulReleaseCount: 5, backupRootHasVerifiedPolicy: true });
  const result = runManager(fixture, ["verify-backups"]);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(existsSync(fixture.backupRoot), true);
  assert.equal(runManager(fixture, ["cleanup"]).status, 0);
  assert.deepEqual(backupNames(fixture), fixture.initialBackupNames);
});
```

- [ ] **Step 2: Add deployment-contract assertions** for `/opt/natarot/current`, the candidate unit’s loopback-only port, external `NATAROT_DB_PATH`, the deployment lock, journald retention, and absence of release cleanup commands from the systemd service.
- [ ] **Step 3: Run the focused tests and verify the failure is caused by missing release-manager/audit files, not a test typo.**

Run:

```bash
npx tsx --test tests/natarot-storage-retention.test.ts tests/deployment-contract.test.ts
```

Expected: the existing two deployment tests pass and the new tests fail because the requested scripts and candidate unit do not yet exist.
- [ ] **Step 4: Commit the red tests.**

```bash
git add tests/natarot-storage-retention.test.ts tests/deployment-contract.test.ts
git diff --cached --check
git commit -m "test: define VPS storage retention contracts"
```

### Task 2: Implement the read-only audit and shared safety primitives

**Files:**
- Create: `deploy/release/natarot-storage-audit.sh`
- Create: `deploy/release/natarot-release-manager.sh`

**Interfaces:**
- `natarot-storage-audit.sh` accepts no required positional arguments and reads `NATAROT_APP_ROOT`, `NATAROT_RELEASE_ROOT`, `NATAROT_BACKUP_ROOT`, `NATAROT_DB_ROOT`, `NATAROT_STAGING_ROOT`, `NATAROT_LOG_ROOT`, `NATAROT_CACHE_ROOT`, and `NATAROT_MIN_FREE_KIB` overrides.
- `natarot-release-manager.sh` uses the same roots plus `NATAROT_SERVICE`, `NATAROT_CANDIDATE_SERVICE_PREFIX`, `NATAROT_SYSTEMCTL`, `NATAROT_CURL`, `NATAROT_BACKUP_STATUS_FILE`, `NATAROT_BACKUP_LATEST_FILE`, `NATAROT_BACKUP_MAX_AGE_SECONDS`, and `NATAROT_LOCK_PATH` overrides.
- Every mutating path is checked with `realpath -m`, required-prefix comparison, release-ID validation `[A-Za-z0-9][A-Za-z0-9._-]*`, and explicit non-root/non-symlink conditions before `rm`, `mv`, or symlink replacement.

- [ ] **Step 1: Implement `natarot-storage-audit.sh` in strict Bash mode.** Print `category`, `path`, `bytes`, and `classification` rows for filesystem capacity, production root, release root, staging root, backup root, database root, logs, caches, and manager-owned temp paths. Use `df -Pk` and `du -xsk`; continue past missing optional paths; classify unmatched paths as `unknown`; never call a mutating command.
- [ ] **Step 2: Implement shared manager primitives.** Add functions for `die`, `log_safe`, `require_command`, `assert_safe_release_id`, `assert_inside`, `atomic_symlink`, `read_target`, `acquire_lock`, `release_lock`, `process_references_path`, `disk_preflight`, and `require_external_state`. Use `flock` when available and a `mkdir` lock fallback only when the lock directory is an explicitly configured path.
- [ ] **Step 3: Implement `verify-backups` as read-only validation.** Require `status=success` in `last-status`, parse the recorded `backup_id` without printing values, require the matching daily archive and `.sha256` sidecar, run `sha256sum -c`, require a recent `latest-success`, require successful `last-restore-test`, and count daily/weekly/monthly archives without deleting anything. Reject any backup root equal to the release root.
- [ ] **Step 4: Run the focused tests.** The audit tests should pass; release-manager tests should still fail at the missing deploy/migration/cleanup command branches.
- [ ] **Step 5: Run shell syntax and static safety checks.**

```bash
bash -n deploy/release/natarot-storage-audit.sh deploy/release/natarot-release-manager.sh
rg -n 'rm -rf|rm -r|find .* -delete' deploy/release
git diff --check
```

Each deletion must be inside a function that first validates an explicit path below a configured manager-owned root.
- [ ] **Step 6: Commit the audit and safety primitives.**

```bash
git add deploy/release/natarot-storage-audit.sh deploy/release/natarot-release-manager.sh
git diff --cached --check
git commit -m "ops: add fail-closed VPS storage primitives"
```

### Task 3: Implement flat-layout migration and candidate deployment

**Files:**
- Modify: `deploy/release/natarot-release-manager.sh`
- Create: `deploy/systemd/natarot-candidate@.service`
- Modify: `deploy/systemd/natarot.service`

**Interfaces:**
- `migrate-flat --release-id ID` moves the current flat application entries into `releases/ID`, creates `current`, and refuses to proceed if persistent-state files are found below the flat root.
- `deploy --source-dir DIR --release-id ID` validates and installs a candidate, starts `natarot-candidate@ID.service`, runs loopback and production smoke checks, marks success, rotates references, and then calls cleanup.
- The candidate service uses `/opt/natarot/releases/%i`, the external environment file, the external `NATAROT_DB_PATH`, and `127.0.0.1:8878`; the production service uses `/opt/natarot/current` and port `8787`.

- [ ] **Step 1: Add migration tests for the safe flat-root boundary.** Test that application files move exactly once, database/env files cause refusal, the external database remains byte-identical, the service reference is changed only after the new `current` link exists, and a failed restart leaves the old flat tree recoverable.
- [ ] **Step 2: Implement `migrate-flat`.** Acquire the lock, run `verify-backups`, require the production service to be stopped only after the verified backup, enumerate top-level entries with null-delimited `find`, reject persistent/unknown names, move entries into the release directory on the same filesystem, create the current link atomically, and write a migration marker containing only release ID, timestamp, and paths.
- [ ] **Step 3: Add candidate-service and production-service contract changes.** Keep the existing `natarot` user, environment file, migration pre-start, Node/Vinext command, restart policy, and localhost bind. The candidate unit must have `PrivateTmp=true`, `ProtectHome=true`, `NoNewPrivileges=true`, `SyslogIdentifier=natarot-candidate`, and no public bind.
- [ ] **Step 4: Implement candidate install/validation.** Copy only the source tree into `.staging/ID`, reject `.env*`, `*.sqlite`, `*.sqlite-*`, private-key filenames, `/var`, `/home`, and upload-like directories, require the Vinext CLI and `dist/`, then rename the staging directory into `releases/ID` without overwriting an existing release.
- [ ] **Step 5: Implement candidate health and atomic production promotion.** Start the candidate unit, poll `http://127.0.0.1:8878/api/tarot/catalog?locale=en` with a bounded timeout, stop the candidate, atomically replace `current`, restart the production service, poll the production catalog/home endpoints, run the configured smoke command when present, and restore the old target on any failure.
- [ ] **Step 6: Run the focused migration/deploy tests and verify that each failing path is now green.**

```bash
npx tsx --test tests/natarot-storage-retention.test.ts
```

- [ ] **Step 7: Commit the topology implementation.**

```bash
git add deploy/release/natarot-release-manager.sh deploy/systemd/natarot.service deploy/systemd/natarot-candidate@.service tests/natarot-storage-retention.test.ts
git diff --cached --check
git commit -m "ops: add atomic NaTarot release promotion"
```

### Task 4: Implement retention, temporary cleanup, and logging contracts

**Files:**
- Modify: `deploy/release/natarot-release-manager.sh`
- Create: `deploy/systemd/journald-natarot-retention.conf`
- Modify: `tests/natarot-storage-retention.test.ts`
- Modify: `tests/deployment-contract.test.ts`

**Interfaces:**
- `cleanup` keeps exactly the resolved current/previous targets and removes only older successful release directories with no process references.
- `cleanup` may remove only manager-owned stale `.staging`/temporary archives and explicit regenerable cache entries; it never traverses a configured backup/database/staging root.
- The journald template bounds persistent and runtime journal usage without changing application log content.

- [ ] **Step 1: Add failing tests for cleanup guards.** Cover missing references, outside-root symlinks, active `/proc/*/cwd` references, unknown directories, failed/quarantined directories, stale staging removal, and preservation of current/previous dependencies and external database/backups.
- [ ] **Step 2: Implement post-success reference rotation.** Write `DEPLOYMENT_SUCCESS` and `DEPLOYMENT_REVISION` markers using atomic temporary files, rotate previous links from the old protected set, and only then enumerate deletable successful releases.
- [ ] **Step 3: Implement explicit cleanup allowlists.** Validate every candidate path, skip unknown and failed entries, refuse if a process or protected symlink references it, and remove one validated directory at a time. Record counts and paths without exposing secrets or file contents.
- [ ] **Step 4: Add bounded journald retention settings and update the deployment contract.** Use a standard drop-in path and document installation through `systemd-tmpfiles`/`journalctl --vacuum-time` only after inspecting current policy. Do not add a second Nginx logrotate rule when `/etc/logrotate.d/nginx` exists.
- [ ] **Step 5: Run focused retention and contract tests, shell syntax checks, and diff checks.**
- [ ] **Step 6: Commit the retention and logging work.**

```bash
git add deploy/release/natarot-release-manager.sh deploy/systemd/journald-natarot-retention.conf tests/natarot-storage-retention.test.ts tests/deployment-contract.test.ts
git diff --cached --check
git commit -m "ops: enforce bounded release and log retention"
```

### Task 5: Document operator workflow and live migration procedure

**Files:**
- Create: `docs/operations/NATAROT_STORAGE_RETENTION.md`
- Modify: `docs/PROJECT_STATE.md`

**Interfaces:**
- The runbook documents the exact audit, backup, migration, deploy, rollback, cleanup, backup-verification, log-retention, and final-disk commands with safe placeholders for paths but no credentials.
- `docs/PROJECT_STATE.md` records the live audit evidence, implementation commit, validation results, SSH alias recovery, migration/deployment result, and unfinished work without claiming any unverified browser or production state.

- [ ] **Step 1: Write the runbook.** Include the flat-layout migration command, the required verified-backup gate, the candidate/production health endpoints, the rollback command, the three-release invariant, backup 7/4/3 verification, staging separation, disk thresholds, and the explicit stop conditions for unknown paths or insufficient disk.
- [ ] **Step 2: Add the live procedure checklist.** Order the commands as read-only audit → backup → safe migration → verify → rollback test → production health → final audit. State that `scp`/`ssh` use the existing `natarot-vps` alias and never print `/etc/natarot.env`.
- [ ] **Step 3: Update project state only with evidence after implementation and live checks.** Keep separate `VERIFIED`, `MIGRATED`, `DEPLOYED`, and `ROLLBACK-TESTED` labels.
- [ ] **Step 4: Commit the operator documentation.**

```bash
git add docs/operations/NATAROT_STORAGE_RETENTION.md docs/PROJECT_STATE.md
git diff --cached --check
git commit -m "docs: document VPS storage retention operations"
```

### Task 6: Run the complete local verification suite

**Files:**
- No new files; verify all implementation and documentation files from Tasks 1–5.

- [ ] **Step 1: Run focused storage/deployment tests and shell checks.**

```bash
npx tsx --test tests/natarot-storage-retention.test.ts tests/deployment-contract.test.ts
bash -n deploy/release/*.sh
```

- [ ] **Step 2: Run repository typecheck, production build, and `git diff --check`.**

```bash
npx tsc --noEmit
npm run build
git diff --check
```

- [ ] **Step 3: Run the tracked test suite and record preserved baseline failures separately.**

```bash
npx tsx --test tests/*.test.ts
```

Do not attribute the known Home-only marker failures to this operations change.
- [ ] **Step 4: Inspect the complete diff as release engineer, security reviewer, and DBA.** Confirm no `.env`, database, archive, log, private-key, or generated build file is staged and that every delete path is allowlisted.
- [ ] **Step 5: Commit any only-related verification documentation change.** Do not amend earlier commits; create a focused verification commit if `docs/PROJECT_STATE.md` needs the final local evidence.

### Task 7: Install, migrate, verify, and test rollback on the VPS

**Files:**
- Install from the committed `deploy/release/` scripts and `deploy/systemd/` templates to root-owned VPS paths; do not copy secrets or product database files.
- Update only `/etc/systemd/system/natarot.service`, the candidate unit, the journald drop-in, and root-owned manager/script paths after backups and read-only checks pass.

- [ ] **Step 1: Re-run the live read-only audit through `natarot-vps`.** Capture `df`, release/staging/backup sizes, service cwd, database path, active process references, timers, backup status, Nginx logrotate path, and unknown top-level `/opt` entries.
- [ ] **Step 2: Run the existing backup service and verify the archive/checksum/integrity status before any service stop or filesystem move.** If the backup fails or the newest verified backup is missing, stop.
- [ ] **Step 3: Install scripts/units with restrictive modes and run `systemctl daemon-reload`.** Do not restart production until the flat migration preflight passes.
- [ ] **Step 4: Run `migrate-flat` with the explicit audited release ID.** Preserve the flat tree by same-filesystem move, create `current`, restart the service, and verify local/public health. If any check fails, restore the original path and service unit from the recorded rollback state.
- [ ] **Step 5: Import only two audit-approved historical successful production trees as `previous-1` and `previous-2`.** Leave staging, failed, candidate-failed, and unknown trees untouched or quarantine only when the exact path and non-reference status are recorded.
- [ ] **Step 6: Run the manager’s cleanup after the successful migration marker.** Remove only validated old successful releases and manager-owned temporary artifacts; verify that database, environment, backup, active, rollback, and unknown paths remain.
- [ ] **Step 7: Test rollback by switching only between protected `current` and `previous-1`, restarting, checking service state and public catalog/home health, then restoring the intended current release and rechecking health.** Do not delete the tested rollback target.
- [ ] **Step 8: Run final disk, service, backup, reference, process, and log-retention audits.** Record exact counts and sizes without printing secret values.

### Task 8: Final delivery and branch handoff

**Files:**
- Modify: `docs/PROJECT_STATE.md` only if final live evidence has not already been recorded.

- [ ] **Step 1: Run `git status`, `git diff --check`, staged secret/path scans, and `git log` to confirm only related commits are present on `codex/natarot-vps-storage-retention-v1`.**
- [ ] **Step 2: Push the branch to its configured origin.** Report the exact push result; a local commit is not a remote backup.
- [ ] **Step 3: Report implementation, local verification, live audit, migration, cleanup, rollback, production health, remaining unknown/staging data, and any deployment blocker with evidence.**
- [ ] **Step 4: Check this session’s project-local task-observer records and report the one-line observation summary.**
