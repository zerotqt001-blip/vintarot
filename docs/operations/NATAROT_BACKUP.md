# NaTarot VPS Backup Runbook

This runbook operates the already-running NaTarot VPS backup workflow. It is deliberately separate from product deployment and does not authorize Integration V1, S6, schema changes, or a production restore.

## Live baseline

Verified 2026-09-21 UTC:

- Host: `root@42.96.5.114`, SSH port `26266`, Ubuntu 24.04.4 LTS, 30 GB root filesystem, approximately 24 GB free at inventory time.
- Application: `/opt/natarot`, service `natarot.service`, Node `v22.14.0`, loopback listener `127.0.0.1:8787`.
- Active release: source commit `4db459a016f6335fc94a044a76318663c1b40af5`, built from `codex/auth-integration-a0`, deployed at `2026-09-19T19:46:03Z`. This is the release recorded by `/opt/natarot/DEPLOYMENT_REVISION`; it is not Integration V1.
- Database: `/var/lib/natarot/natarot.sqlite` with active `-wal` and `-shm` files, SQLite WAL mode, six recorded migrations, 17 application tables, and `PRAGMA integrity_check=ok`.
- Configuration: `/etc/natarot.env` is root-only and is never copied as plaintext. The live Nginx site is `/etc/nginx/sites-enabled/natarot`; the certificate is managed by Certbot.

The database inventory is metadata-only and contains no row contents:

| Table | Rows | Table | Rows |
| --- | ---: | --- | ---: |
| `auth_sessions` | 18 | `auth_tokens` | 7 |
| `card_meanings` | 312 | `decks` | 1 |
| `members` | 4 | `natarot_migrations` | 6 |
| `oauth_states` | 67 | `reading_cards` | 332 |
| `reading_sessions` | 88 | `readings` | 48 |
| `records` | 9 | `room_members` | 1 |
| `rooms` | 117 | `spread_categories` | 9 |
| `spread_positions` | 174 | `spread_templates` | 57 |
| `tarot_cards` | 78 |  |  |

## Installed workflow

The root-owned tools are:

```text
/usr/local/sbin/natarot-backup
/usr/local/sbin/natarot-restore-test
/usr/local/lib/natarot/natarot-sqlite-backup.mjs
/etc/systemd/system/natarot-backup.service
/etc/systemd/system/natarot-backup.timer
/etc/systemd/system/natarot-restore-test.service
/etc/systemd/system/natarot-restore-test.timer
```

The backup service uses Node `node:sqlite` and `VACUUM INTO` to create a consistent copy of the live WAL database. It validates the source and destination integrity, foreign keys, application tables, migration ledger, manifest, internal SHA-256 list, tar archive, and archive sidecar before marking success.

Each archive contains:

```text
manifest/backup-manifest.json
database/natarot.sqlite
database/verification.json
configuration/systemd/natarot.service
configuration/nginx/natarot
configuration/runtime/natarot.env.keys
configuration/runtime/natarot.env.metadata
recovery/DEPLOYMENT_REVISION
recovery/runtime.txt
recovery/restore-scope.txt
recovery/natarot-*.service
recovery/natarot-*.timer
recovery/natarot-restore-test
recovery/natarot-backup
recovery/natarot-sqlite-backup.mjs
checksums/SHA256SUMS
```

Plaintext environment values, private TLS keys, cookies, logs, `node_modules`, caches, temporary files, and rebuildable source are excluded. The database is protected production data: it is never committed to Git or copied into the repository worktree.

## Schedule and retention

- `natarot-backup.timer`: daily at `02:15 UTC`, persistent across reboot, with up to 10 minutes of jitter.
- `natarot-restore-test.timer`: monthly on day 1 at `04:30 UTC`, persistent across reboot, with up to 15 minutes of jitter.
- Local retention: 7 daily successful archives, 4 weekly hard-link snapshots, and 3 monthly hard-link snapshots.
- `latest-success` points to the newest verified daily archive. `last-status` records only stage, status, ID, timestamp, bytes, exit code, and archive hash.
- A lock prevents overlapping runs. A lock collision is a clean `skipped` result; it must not be mistaken for a successful new archive.

Inspect the schedule and current result without touching production:

```bash
ssh -i /Users/tranquangthanh/.ssh/natarot_vps -p 26266 root@42.96.5.114 \
  'systemctl list-timers --all natarot-backup.timer natarot-restore-test.timer; \
   sed -n "1,20p" /var/backups/natarot/last-status'
```

## Manual backup and verification

Use this when a release, infrastructure event, or operator review needs an immediate snapshot. It does not restart `natarot.service`.

```bash
ssh -i /Users/tranquangthanh/.ssh/natarot_vps -p 26266 root@42.96.5.114 \
  'systemctl start --wait natarot-backup.service'

ssh -i /Users/tranquangthanh/.ssh/natarot_vps -p 26266 root@42.96.5.114 \
  'backup_root=/var/backups/natarot; id=$(tr -d "[:space:]" < "$backup_root/latest-success"); \
   archive="$backup_root/daily/$id.tar.gz"; \
   sed -n "1,20p" "$backup_root/last-status"; \
   sha256sum -c "$archive.sha256"'
```

For internal checksums, extract only into a disposable directory and never use the production database path:

```bash
ssh -i /Users/tranquangthanh/.ssh/natarot_vps -p 26266 root@42.96.5.114 '
  set -eu
  root=/var/backups/natarot
  id=$(tr -d "[:space:]" < "$root/latest-success")
  archive="$root/daily/$id.tar.gz"
  tmp=$(mktemp -d /tmp/natarot-archive-verify.XXXXXX)
  trap "rm -rf -- \"$tmp\"" EXIT
  tar -xzf "$archive" -C "$tmp"
  (cd "$tmp/$id" && sha256sum -c checksums/SHA256SUMS)
'
```

A backup is not considered verified until the isolated restore service succeeds. A successful archive alone is not sufficient evidence.

## Isolated restore check

Run the monthly check manually after a backup or when reviewing a candidate archive:

```bash
ssh -i /Users/tranquangthanh/.ssh/natarot_vps -p 26266 root@42.96.5.114 \
  'systemctl start --wait natarot-restore-test.service; \
   sed -n "1,20p" /var/backups/natarot/last-restore-test'
```

The runner extracts into a temporary directory, verifies the archive and database, runs the checked-in migration runner against the restored copy, starts the application on loopback port `18878`, checks `/api/tarot/catalog?locale=en`, and removes the temporary environment. It never opens the production database as the restored target and never restarts the production service.

Expected result fields are `status=success`, `database_integrity=ok`, `migration=pass`, and `application=pass`. Confirm production remained unchanged:

```bash
ssh -i /Users/tranquangthanh/.ssh/natarot_vps -p 26266 root@42.96.5.114 \
  'systemctl is-active natarot.service; \
   systemctl show -p MainPID --value natarot.service; \
   ss -ltn | awk "NR == 1 || /:8787|:18878/"'
```

## Private off-site copy

The connected Google Drive destination is the private folder `NaTarot/Production Backups` (folder ID `1PUaIfQLJGgMK4DX8gjOxNyN8PEZouPCi`). The first final verified archive is:

```text
backup_id:       natarot-production-20260921-084336
archive_bytes:   385653
archive_sha256:  322be489648360126ff926d165bc94abf31f728b83841e72c55eecc0ce67638a
Drive file ID:   1S8BvbRbDMTKbAiBenC0vCM54AlNMVcWZ
sharing:         private / not shared
```

The VPS marker `/var/lib/natarot/backup/offsite-last-verified.json` contains only this non-secret identity, size, hash, folder ID, visibility, and timestamp. It contains no Drive token, SSH key, environment value, or customer data.

The active Codex heartbeat `natarot-daily-private-off-site-backup-verification` runs daily at 03:00 local automation time after the VPS backup window. It stays quiet when the marker already matches the latest successful backup; when a new backup exists it copies the archive to an ephemeral path outside the repository, uploads it privately, verifies exact name/size/private metadata, writes the marker atomically, and deletes the local copy. If Drive authorization is required, stop at that human authorization gate; never request credentials or tokens in chat.

## Failure handling

1. Read `last-status`, `last-restore-test`, and the stage-aware logs under `/var/backups/natarot/logs/`.
2. Check free space, ownership/modes, the lock, the source database path, the active Nginx path, and the release marker. Do not print `/etc/natarot.env`.
3. A failed or partial run must not be promoted off-site. Preserve the last successful archive and `latest-success` marker.
4. Fix the runner/unit problem in the repository, run the focused tests and shell checks, reinstall only the backup/restore tooling, and retry.
5. Never solve a backup failure by restarting the product, copying the live SQLite file blindly, deleting old successful archives, or changing the schema.

## Security and change boundary

All installed backup tools are root-owned with restrictive runtime directories. `natarot.service` remains owned by `natarot`; backup and restore services are separate oneshots. This mission did not deploy Integration V1, merge to main, run S6, change the production schema, alter product code, change Tarot/AI/Auth/Share behavior, expose secrets, or restore over production.
