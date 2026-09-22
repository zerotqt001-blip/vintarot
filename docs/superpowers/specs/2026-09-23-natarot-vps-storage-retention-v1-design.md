# NaTarot VPS Storage Retention V1 — Design Specification

**Status:** approved for implementation
**Date:** 2026-09-23
**Scope:** production application release topology, deployment retention, disk safety, temporary/cache cleanup, and log bounds

## Goal

Stop repeated NaTarot production deployments from accumulating unbounded application trees on the VPS while preserving a deterministic rollback window:

```text
current + previous-1 + previous-2 = at most 3 successful production releases
```

Database backups remain an independent concern and retain the existing verified policy of 7 daily, 4 weekly, and 3 monthly snapshots.

## Live audit findings

The audit used the existing `natarot-vps` SSH alias from the development machine. It did not print private-key contents or environment values.

- Production is currently served directly from `/opt/natarot` by `natarot.service`; no `current` symlink exists today.
- `/dev/vda1` is 29 GB total, approximately 27 GB used, approximately 1.4 GB free, and 96% full.
- `/opt/natarot` is approximately 1.2 GB, mostly `node_modules`.
- `/opt` contains many production-looking `release`, `rollback`, `previous`, `failed`, and `candidate-failed` trees ranging from tens of megabytes to approximately 1.5 GB each. Several trees duplicate full dependency installations.
- `/opt/natarot-staging` is a separate active environment with its own database/service and multiple `before-*` trees. Its history is not automatically included in the production three-release policy.
- The production database is outside the application root at `/var/lib/natarot/natarot.sqlite`.
- The existing `natarot-backup.service` and timer are active. The runner already creates checksum-backed, SQLite-integrity-verified archives and applies 7 daily / 4 weekly / 3 monthly retention. The latest recorded backup and isolated restore test were successful during the audit.
- The production environment file is `/etc/natarot.env`; it remains outside releases and is never copied into an application release.
- The active Nginx logrotate configuration already exists; the implementation must inspect and reuse it rather than install a competing rule.

The audit is evidence for the migration design, not permission to delete the discovered trees blindly. Unknown paths remain protected until individually classified.

## Target topology

Production will use the following stable layout:

```text
/opt/natarot/
  current -> releases/<active-release-id>
  previous-1 -> releases/<previous-successful-release-id>
  previous-2 -> releases/<older-successful-release-id>
  releases/
    <release-id>/
  .staging/
  .failed/
```

The systemd service runs through `/opt/natarot/current`. A release directory is disposable application code plus build/runtime dependencies only. Persistent state remains outside it:

- database: `/var/lib/natarot/natarot.sqlite` and its WAL/SHM files;
- environment/secrets: `/etc/natarot.env`;
- database backups: `/var/backups/natarot`;
- TLS, Nginx, systemd and OS configuration: their existing `/etc` locations;
- user data and any future uploads: their existing external persistent locations.

If a shared dependency pool exists, releases may link `node_modules` to a validated external directory such as `/opt/natarot-deps/node_modules`. The manager must never delete a dependency target that is outside the release root, and it must not create a release-local copy of the production database or environment file.

## Components

### Release manager

`deploy/release/natarot-release-manager.sh` is the single mutating entrypoint for production release topology operations. It provides:

- `audit`: read-only classification and disk inventory;
- `migrate-flat`: one-time adoption of the current flat `/opt/natarot` tree;
- `deploy`: candidate installation, validation, promotion, health/smoke checks, success marking, and post-success cleanup;
- `cleanup`: bounded release and temporary-artifact cleanup only after a recorded successful deployment;
- `verify-backups`: read-only validation that the existing backup policy is healthy and separate.

All mutating commands acquire one exclusive deployment lock before reading or changing release references. The lock path is configurable for synthetic tests and defaults to a root-owned `/run/lock/natarot-deploy.lock` on the VPS.

### Storage audit

`deploy/release/natarot-storage-audit.sh` reports filesystem capacity and byte usage for production releases, staging, backup storage, logs, caches, temporary deployment paths, the database, and configuration. It prints a category for every inspected path and never deletes data. It must report unknown paths rather than assigning them a disposable category.

### Candidate service

`deploy/systemd/natarot-candidate@.service` starts a candidate release on a loopback-only test port using the existing environment and external production database path. It is short-lived, does not become the public service, and is stopped before promotion. Its health scope is read-only catalog/home smoke traffic; the candidate must not run destructive migrations or point at a copied database.

### Production service

`deploy/systemd/natarot.service` changes only its application path from the flat root to `/opt/natarot/current`. Existing user, environment-file handling, migration runner, Node/Vinext command, localhost binding, restart behavior, and file descriptor limit remain intact.

### Retention and maintenance templates

The repository will include a journald retention drop-in template and an operations runbook. Nginx rotation remains delegated to the installed standard `/etc/logrotate.d/nginx` policy; the runbook verifies it rather than creating a duplicate rule.

## Deployment state machine

The production deployment order is:

1. Acquire the deployment lock and record the current reference set.
2. Run the read-only disk preflight. If capacity is below the configured safety floor, remove only validated abandoned staging artifacts allowed by the cleanup policy; fail if the floor is still not met.
3. Invoke the existing `natarot-backup.service` and require a successful status, archive, sidecar checksum, and recent verified-backup marker. Do not implement a second backup writer.
4. Validate the source artifact and release ID. Reject path traversal, absolute archive paths, `.env*` files, SQLite files/WAL/SHM files, private-key material, and unknown persistent-state directories.
5. Extract or copy the candidate into `/opt/natarot/.staging/<release-id>` and validate its runtime entrypoints, build artifact, dependency target, ownership, permissions, and configuration references.
6. Move the validated candidate into `/opt/natarot/releases/<release-id>` without copying persistent state.
7. Start `natarot-candidate@<release-id>.service`, run loopback HTTP health/smoke checks, and stop the candidate. A failed candidate is quarantined under `.failed` and is never made current.
8. Atomically replace `current` with the candidate and restart `natarot.service`.
9. Run production localhost/public health checks and the configured browser/smoke verification. On failure, atomically restore the recorded old `current` target, restart the service, recheck the old release, and stop without cleanup.
10. Write a success marker and release metadata only after the new service is healthy.
11. Update `previous-2` from the old `previous-1`, update `previous-1` from the former current target, and leave `current` on the new release. Reference updates are atomic and occur before any deletion.
12. Remove only old successful release directories outside the three protected targets, after checking current/rollback symlinks, deployment lock state, and every running process cwd/executable reference.
13. Remove only validated abandoned staging/extracted artifacts and bounded regenerable caches. Never remove backup, database, secret, user-data, current, rollback, or unknown paths.
14. Verify the existing backup retention classification and log/cache policy, then run a final disk audit.

Cleanup is unreachable from a failed candidate, failed promotion, failed production health check, failed browser/smoke check, or failed success-marker write.

## Release retention invariants

The manager must fail closed unless all of these are true:

- `current` resolves to an existing release directory with a success marker;
- `previous-1` and `previous-2`, when present, resolve inside the release root;
- no protected path is a symlink to an outside or unknown target;
- a release selected for deletion is an explicitly named directory below the configured release root;
- no process cwd or executable path resolves inside that release;
- the release is not one of the current/previous references;
- the release is classified as a successful application release, not a failed/unknown/quarantined artifact;
- the deployment lock is held by the current operation.

The normal result is no more than three successful production releases. If fewer than three valid successful releases exist, cleanup preserves all valid releases and does not manufacture or delete references.

## Flat-layout migration

The first production migration is deliberately separate from normal deployment:

1. Re-run the audit and require the production service, database path, environment path, and active process cwd to match the known topology.
2. Run and verify a fresh database backup before stopping the service.
3. Confirm that `/opt/natarot` contains no database, WAL/SHM file, environment file, uploads, or unknown persistent directory.
4. Stop the service under the deployment lock.
5. Move the current flat application entries into a timestamped release directory on the same filesystem. Moving is used instead of copying so the migration does not require a second full dependency tree.
6. Create `current` pointing to that release, update the service template, reload systemd, and restart the service.
7. Verify production health before adopting any historical top-level trees.
8. Classify historical `/opt/natarot.*` trees from the audit. Only explicitly recognized successful production trees may be imported as `previous-1`/`previous-2`; failed, candidate-failed, staging, and unknown trees are quarantined or left untouched until separately reviewed.
9. Perform release cleanup only after a successful post-migration deployment or an explicit successful migration marker; never delete the only pre-migration release.

If any expected path, marker, process, or ownership check differs, migration stops without deleting or overwriting the flat production tree.

## Backup separation and safety

Release cleanup never traverses `/var/backups/natarot` and never interprets a backup filename as a release. Backup verification requires:

- `last-status` reports success;
- the referenced archive and checksum sidecar exist and match;
- the archive is newer than the configured maximum age;
- the existing backup runner has reported SQLite integrity and foreign-key success;
- the latest verified restore-test status is present and successful within its allowed age;
- the newest verified backup and at least one recent valid backup remain preserved.

The deployed backup runner remains the owner of 7 daily / 4 weekly / 3 monthly pruning. This mission only validates that policy and wires the release pipeline to it.

## Disk, temporary, cache, and log policy

- The default deployment floor is at least 1 GiB free and at least 10% filesystem free, with an additional estimate for the candidate artifact. These values are configurable for tests and documented for the VPS.
- Safe preflight cleanup may remove only stale manager-owned `.staging` entries, temporary archives, and explicitly allowlisted build caches. It may not remove old successful releases before the new deployment is healthy.
- A shared dependency pool is preferred when already present. Runtime dependencies for current/previous releases are protected.
- Journald is bounded through a standard drop-in with a maximum disk budget, keep-free floor, and retention age. Nginx remains under its existing standard logrotate rule. Deployment logs contain phase/status metadata only and no secrets, tokens, PII, or payment data.
- `/opt/natarot-staging` and its `before-*` trees are audited as a separate environment. They are not automatically deleted by production release cleanup.

## Testing and verification

Synthetic tests use temporary roots and fake systemd/curl/backup commands. They cover:

- audit classification and disk threshold refusal;
- flat-layout migration preserving the application tree and external database;
- candidate validation rejecting secrets, databases, traversal, and persistent-state copies;
- candidate failure leaving `current` and all rollback references unchanged;
- successful promotion retaining exactly current plus two previous releases;
- cleanup refusal for symlink references, active process cwd, unknown directories, and outside-root paths;
- backup-policy verification remaining separate from application-release cleanup;
- deployment lock exclusion;
- temporary/cache allowlists and log-retention contract;
- systemd service/candidate paths and environment-file boundaries.

Before live mutation, run repository tests, shell syntax checks, typecheck/build where applicable, `git diff --check`, and a secret/path scan. After live migration and deployment, verify service state, database path and integrity, release references, rollback, public HTTPS health, browser smoke behavior, backup status, and final disk usage. A rollback test may switch only between protected releases and must restore the production service to its prior healthy target before the mission is reported complete.

## Non-goals

- No application product behavior, database schema, user data, authentication, provider configuration, or secret rotation.
- No automatic cleanup of staging history without a separate classified policy.
- No deletion of unknown `/opt` trees, old backup snapshots, TLS material, environment backups, or user data.
- No competing backup scheduler or off-site backup system.
