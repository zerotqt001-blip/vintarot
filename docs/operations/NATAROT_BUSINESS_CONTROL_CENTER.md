# NaTarot business reporting and encrypted Drive backups

## What runs

`natarot-business-control-center.timer` starts the isolated one-shot job every 15 minutes. The job refreshes the private NaTarot Business Control Center spreadsheet and verifies an encrypted mirror of the current local backup references. It records a durable full-run audit before Sheets sync starts, so a service timeout during either reporting or backup work can be recovered and counted toward the prolonged-failure alert. It runs as root so it can read the production SQLite database and existing root-owned backup archives. It does not depend on or restart the NaTarot web service. A separate systemd lock prevents overlapping manual and timer runs.

The eight workbook tabs are Dashboard, Customers, Revenue, Affiliate, Referrals, Activity, Credits, and System. The export is read-only and uses pseudonymous customer and Affiliate row keys. The sheet does not contain private Tarot questions or interpretations, source credentials, payment data, authentication tokens, or referral secrets. Google Drive files remain private; the job creates no sharing permissions.

The existing local backup service remains the sole local database-backup writer. Its retention limits remain **7 daily, 4 weekly, and 3 monthly**. At the latest audit, the populated references were 7 daily, 1 weekly, and 1 monthly; those observed counts are not the limits. The Drive mirror deduplicates hard-linked references by backup ID. It trashes only old files bearing the NaTarot offsite marker, and only after every current archive and manifest has a verified local status row and matching Drive identity. It never removes local archives.

Each archive uses a random per-file AES-256-GCM key. NaTarot wraps that key with the existing PII keyring under `natarot.offsite-backup.key.v1`. Archive and manifest content use Drive resumable upload sessions. The job downloads both again and checks their checksums and identities, decrypts the archive, and calls the existing isolated restore-test script. Only after this succeeds does the remote manifest change from `pending` to `verified`; the job downloads and verifies that final manifest before recording the backup-set run as successful. A deep restore check runs for the newest backup each HCMC business day. First-time backfill verifies each local reference before it can be retained remotely.

## Connect the owner account

Google work stays paused until exactly one enabled, email-verified `SUPER_ADMIN` account has a connected Google Drive account with the exact `https://www.googleapis.com/auth/drive.file` scope and no broader Drive grant. If the stored grant is missing that scope, the job reports `drive_scope_missing`; if it also contains a broader Drive scope, it reports `drive_scope_inappropriate`. Both conditions prevent Google API calls. Sign in to that account and open:

`https://natarot.com/api/google-drive/connect?return_to=%2Faccount`

Approve the existing NaTarot Google connection request, including the `drive.file` permission for files created by NaTarot. The workbook and encrypted backup files are created in that Google account. The job does not request full Drive access or create public links. If more than one eligible connected `SUPER_ADMIN` is present, the job pauses and reports a sanitized blocked status; resolve that account configuration before enabling the timer.

## Install and enable

The release build creates `dist/business-control-center.mjs`. The systemd units are shipped at:

- `deploy/systemd/natarot-business-control-center.service`
- `deploy/systemd/natarot-business-control-center.timer`

Install them after deploying the release. Keep the timer disabled until the owner has connected Drive:

```sh
sudo install -o root -g root -m 0644 deploy/systemd/natarot-business-control-center.service /etc/systemd/system/
sudo install -o root -g root -m 0644 deploy/systemd/natarot-business-control-center.timer /etc/systemd/system/
sudo systemctl daemon-reload
```

After confirming the owner connection in Account, enable the timer:

```sh
sudo systemctl enable --now natarot-business-control-center.timer
```

Do not enable or manually start the service before the connection exists. To pause the integration after the owner disconnects or revokes Google access:

```sh
sudo systemctl disable --now natarot-business-control-center.timer
```

Disconnecting OAuth does not delete the already-created Google files. The offsite archives stay encrypted at rest.

## Status and alerts

```sh
systemctl list-timers natarot-business-control-center.timer --no-pager
systemctl status natarot-business-control-center.service natarot-business-control-center.timer --no-pager
journalctl -u natarot-business-control-center.service --since today --no-pager
```

The service prints one JSON status line with job state, sanitized error codes, the number of local references, and whether an alert was sent. It does not print customer rows, archive contents, bearer tokens, or provider response bodies. The System sheet shows the latest sync and backup status after Google work is authorized.

If complete Drive backup-set runs fail for 24 hours, the job sends one short operational notice to the connected owner email through the existing Resend configuration, then waits at least 24 hours before sending another. Successes for individual archives do not reset this failure period or advance the last complete-set success timestamp. The notice contains no customer or business-record detail. A successful run that verifies every retained reference and finishes retention ends the failure period.

The restore verifier writes status under `/var/lib/natarot/business-control-center/restore-status`, separate from `/var/backups/natarot/last-restore-test`. Its decrypted archive is private temporary data and is removed after the isolated restore test. Check the service journal and `business_reporting_backup_runs` status fields for the recorded backup ID, checksums, Drive file IDs, verification time, and sanitized error code.

## Recovery and key changes

Do not remove an old PII key while any retained encrypted archive may use it. The keyring must continue to include historical keys needed by `decryptField` for wrapped archive keys. If the private Google files are deleted, the next successful run recreates and re-verifies the current local reference set. If restore verification fails, remote retention pruning does not run; preserve the local backup set and inspect the isolated restore status before retrying.
