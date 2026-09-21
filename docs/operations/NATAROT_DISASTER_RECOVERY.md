# NaTarot Disaster Recovery Runbook

This runbook describes how to validate and, only after separate owner approval, recover NaTarot from a verified private archive. The V1 mission validated recovery in isolation; it did not restore over production or authorize a production cutover.

## Recovery invariants

- Never use `/var/lib/natarot/natarot.sqlite` as the target of a test restore.
- Never restore over the running VPS, stop the product service, or change production schema as part of routine verification.
- Treat `/etc/natarot.env` as an external secret source. The backup contains only environment key names and file metadata, not values.
- Restore the database with the archive's verified copy and run integrity, foreign-key, migration, and application checks before any cutover decision.
- Keep the recorded release commit and deployment marker aligned. The verified production release is `4db459a016f6335fc94a044a76318663c1b40af5`, built from `codex/auth-integration-a0`.

## What is recoverable

The archive supplies a consistent SQLite database, the deployment revision, active Nginx site content, the `natarot.service` definition, backup/restore tooling, runtime metadata, environment key names, a manifest, and checksums. It intentionally does not supply application source/build duplication, `node_modules`, secret values, private TLS keys, cookies, or logs.

For a replacement host, application source/artifacts must be reconstructed from the recorded release commit or a separately retained release artifact. Secret values must be provisioned through the approved secret-management path. Do not invent or copy them from chat, logs, or the archive.

## Routine isolated verification

The installed monthly service is the normal recovery rehearsal:

```bash
ssh -i /Users/tranquangthanh/.ssh/natarot_vps -p 26266 root@42.96.5.114 \
  'systemctl start --wait natarot-restore-test.service; \
   cat /var/backups/natarot/last-restore-test'
```

The service extracts to a disposable `mktemp` directory, validates both archive and internal checksums, opens the restored database read-only for integrity and foreign-key checks, runs the migration runner against that copy, starts the application on `127.0.0.1:18878`, checks the read-only catalog endpoint, and cleans up. The production service is not restarted.

The final rehearsal on 2026-09-21 returned:

```text
status=success
database_integrity=ok
migration=pass
application=pass
```

During the rehearsal, production `natarot.service` stayed active with the same main PID and start timestamp; production database, WAL, and SHM hashes remained unchanged. The temporary restore port was closed after cleanup.

## Off-site disaster simulation

The final archive was fetched from the private Google Drive file, not read from the VPS copy, and its size/hash matched the off-site verification marker:

```text
Drive file:      1S8BvbRbDMTKbAiBenC0vCM54AlNMVcWZ
Archive bytes:   385653
Archive SHA-256: 322be489648360126ff926d165bc94abf31f728b83841e72c55eecc0ce67638a
```

It was copied only to a disposable VPS temp path, restored with `NATAROT_DB_PATH` pointing at the extracted copy, and checked with the migration runner. The final off-site simulation returned `database_integrity=ok`, `migration=pass`, `production_service=active`, and `production_db_unchanged=yes`. The temporary archive and recovery directory were removed afterward. App launch was already proven by the installed monthly rehearsal; the off-site simulation skipped a second app launch to minimize production-adjacent activity.

## Replacement-host recovery procedure

Use this only on a new or isolated replacement host until the owner separately approves a production cutover.

1. Establish the approved Ubuntu/Node runtime, firewall policy, hostname, time synchronization, and a private SSH path. Do not open public application ports before the reverse proxy and TLS plan is ready.
2. Retrieve the private archive from `NaTarot/Production Backups` with the connected Drive workflow. Verify the exact filename, size, private visibility, archive sidecar if available, and internal `SHA256SUMS` before extraction.
3. Extract into a new restricted recovery directory. Verify `database/natarot.sqlite` with Node `node:sqlite`: `PRAGMA integrity_check`, `PRAGMA foreign_key_check`, application tables, and the migration ledger must pass.
4. Install the application from the recorded release commit or an independently retained release artifact. Do not use the Integration V1 branch and do not assume the backup contains source or `node_modules`.
5. Install the backed-up systemd/Nginx configuration after reviewing host-specific paths. Install fresh secret values separately with root-only permissions; never recreate them from the archive.
6. Place the restored database at the replacement host's intended data path, run the migration runner once against that replacement path, and repeat integrity and foreign-key checks. A migration that changes the replacement copy is expected; it must not run against the original VPS database during rehearsal.
7. Start the application on loopback, confirm the catalog/health endpoints, inspect systemd status, then validate Nginx/TLS and a read-only public flow from a controlled client.
8. Compare release marker, service user, database counts, migration ledger, Nginx hostnames, firewall rules, and backup timers with the known-good manifest.
9. Keep the original host untouched until the owner approves a separate cutover and rollback window. Record the new host identity, archive hash, checks, and all deviations.

## Production cutover boundary

This V1 mission does not authorize a production restore. If a real production recovery is required, obtain a separate explicit maintenance decision, preserve the original data directory and release for rollback, stop writes in a controlled window, restore only after a final checksum/integrity review, run the migration policy approved for that incident, and verify the service before DNS or proxy cutover. Never improvise a destructive command and never delete the only original copy.

## Failure response

- Check the stage in `last-restore-test` and the restore log before changing anything.
- Archive extraction or checksum failure means the candidate is rejected; use the previous successful archive and verify the Drive copy again.
- Database integrity or foreign-key failure means do not run migrations or start the app from that copy.
- Migration failure means keep the restored directory isolated, capture only metadata/error stage, and diagnose against the replacement copy.
- Application smoke failure means keep the database copy isolated and inspect runtime/dependency/release compatibility; do not restart production as a workaround.
- Drive authorization failure is a human gate. Stop and report that authorization is required without requesting credentials or tokens in chat.
