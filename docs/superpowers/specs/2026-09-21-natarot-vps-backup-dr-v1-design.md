# NaTarot VPS Backup & Disaster Recovery V1 Design

## Scope

This mission adds operational backup and recovery tooling for the already-running NaTarot VPS. It does not deploy product code, merge or deploy Integration V1, run the S6 migration, change the production schema, or alter Tarot, AI, Auth, Share, or UI behavior.

## Live evidence

- Host: Ubuntu 24.04.4 LTS, 30 GB ext4 root disk, approximately 24 GB free at inventory time.
- Application: `/opt/natarot`, owned by `natarot:natarot`; `natarot.service` is enabled and active behind Nginx.
- Release: `/opt/natarot/DEPLOYMENT_REVISION` identifies commit `4db459a016f6335fc94a044a76318663c1b40af5`, branch `codex/auth-integration-a0`, deployed at `2026-09-19T19:46:03Z`.
- Database: `/var/lib/natarot/natarot.sqlite`, SQLite WAL mode, with active `-wal` and `-shm` files. Node 22.14.0's `node:sqlite` runtime can create a consistent `VACUUM INTO` copy and reopen it with integrity `ok`.
- Existing backup state: no NaTarot backup job or off-site CLI exists on the VPS. `flock` and `tar` are available; `sqlite3`, `rclone`, `restic`, and `borg` are not.

## Architecture

The VPS installs a root-owned `natarot-backup.service` and daily `natarot-backup.timer`. The service invokes a strict Bash backup runner under `flock`, checks disk headroom, creates a timestamped staging tree, uses a Node `node:sqlite` helper to run `VACUUM INTO` against the live database, validates the source and resulting database without printing records, captures non-secret service/Nginx/release metadata, writes a manifest and SHA-256 checksums, produces a private tarball, verifies the tarball, records success, and applies fail-safe daily/weekly/monthly retention. Staging is removed only after verification.

The monthly `natarot-restore-test.timer` extracts the newest verified archive into an isolated temporary directory, validates the restored database and configuration metadata, runs the checked-in migration runner against the restored copy, starts the deployed application on a loopback-only test port with `NATAROT_DB_PATH` pointed at the restored database, checks a read-only catalog endpoint, and tears the environment down. It never opens or replaces the production database and never restarts the production service.

The first off-site archive is uploaded privately to a dedicated Google Drive `NaTarot/Production Backups` folder through the already-connected Drive connector. The local backup automation remains independent of that connector; the final operational setup records the remote file identity, size, and SHA-256 in a non-secret off-site verification marker. Recurring connector-based off-site synchronization is represented as a quiet daily task because the VPS has no Drive client or credential configured.

## Backup contents

Each archive contains:

```text
natarot-production-YYYYMMDD-HHMMSS/
  manifest/backup-manifest.json
  database/natarot.sqlite
  configuration/systemd/natarot.service
  configuration/nginx/<active-site-config>
  configuration/runtime/natarot.env.keys
  configuration/runtime/natarot.env.metadata
  recovery/DEPLOYMENT_REVISION
  recovery/runtime.txt
  recovery/restore-scope.txt
  checksums/SHA256SUMS
```

Plaintext environment values, private TLS keys, cookies, logs, `node_modules`, caches, temporary files, and customer records outside the consistent database backup are excluded. The database is treated as protected production data and is never committed to Git or placed in the repository worktree.

## Error and retention behavior

The backup runner uses `set -Eeuo pipefail`, a trap that records the current stage and exit status, and a persistent status file containing only timestamps, backup ID, archive path, byte count, and checksums. It refuses to proceed below the configured free-space threshold, refuses to delete the only successful archive, and does not prune a retention class if its candidate inventory cannot be read. A second invocation exits cleanly with a lock message while the first run continues.

## Verification

Local tests exercise shell syntax, successful fixture backup, checksum/manifest contents, missing database, low disk threshold, overlapping lock behavior, retention safety, and restored database verification. Live verification repeats the production inventory, creates a real backup, copies it off-site, verifies the remote artifact, runs the isolated restore/application test, confirms the production service and database metadata are unchanged, and records all evidence in the backup and recovery runbooks.
