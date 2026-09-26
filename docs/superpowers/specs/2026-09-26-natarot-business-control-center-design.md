# NaTarot Business Control Center and Offsite Backup Design

## Goal

Provide an operationally isolated, read-only Google Sheets business report and an encrypted offsite copy of the existing verified production database backup, without changing customer, payment, Credit, Affiliate, or reading behavior.

## Production baseline

- Start from `codex/natarot-auth-access-security` at production source merge `69a1675`, which includes the deployed Affiliate branch.
- Production is a Node/Vinext service using `/var/lib/natarot/natarot.sqlite`; the current service is healthy and its latest local backup passes checksum and restore verification.
- `/api/google-drive/connection` reports `configured=true`; a read-only aggregate query found zero Google Drive connections for enabled, verified administrators.
- The existing NaTarot OAuth connection requests `openid email profile https://www.googleapis.com/auth/drive.file`, stores an encrypted refresh token, and has a working per-member Drive-image feature. Google documents `drive.file` as supported and recommended for both Drive and Sheets files created or opened by the app.
- Local backup remains owned by the existing `natarot-backup.service` and retains 7 daily, 4 weekly, and 3 monthly references. The existing archive contains a consistent SQLite snapshot, sidecar and manifest checksums, deployment/configuration metadata, and restore-test support; it is not encrypted before upload. Do not replace it or delete local backup data.

## Approved design decisions

- Reporting uses the existing SQLite database as its sole source of truth. No second database is introduced.
- The production app, using a connected enabled and verified `SUPER_ADMIN` Google account, creates the workbook through Sheets API and uploads backup files through Drive API. Exactly one eligible connected `SUPER_ADMIN` is required; zero or multiple eligible accounts fail closed. The file stays private in that account's My Drive; the app does not add sharing permissions.
- Reuse the existing least-privilege `drive.file` OAuth scope with the same production OAuth client that creates the workbook and Drive files. Do not use the separate Codex Drive connector as production authorization and do not request full-Drive access.
- Workbook tabs are exactly `Dashboard`, `Customers`, `Revenue`, `Affiliate`, `Referrals`, `Activity`, `Credits`, and `System`. Google Sheets is an output only.
- Business dates use `Asia/Ho_Chi_Minh`.
- A dashboard active user is an enabled, email-verified member with an authenticated session touch in the rolling 30 days. The `Activity` tab's daily active count is captured as an aggregate from session `last_seen_at` values at each 15-minute sync and frozen after the local day closes; the report never stores a daily member-level activity table.
- Daily returning users are distinct registered members with a member-owned Tarot session on that day and at least one earlier member-owned session. Tarot reading counts use session metadata only; questions, context, card interpretations, and reading payloads never enter reporting code or output.
- A verified purchase requires a fulfilled order and its linked `order_fulfillments.payment_event_id` to point to a `VERIFIED` `ORDER_PAID` SePay event whose amount and currency match the order. Redirects, pending events, mismatches, rejected/voided events, and payment-confirmed orders without fulfillment are excluded.
- Revenue is recorded on the fulfillment date; a full refund is recorded on `refunded_at` only when the canonical order state is `REFUNDED`. Net revenue by day is verified fulfillment revenue minus full refunds recorded that day. Partial refunds are not synthesized because the current canonical schema does not represent them.
- Credits sold come from purchase grants tied to verified fulfilled orders. Credits consumed, expired, and refunded come from their respective canonical ledger event types and signs.
- Affiliate referral and commission amounts come from the existing conversion and commission ledger. Pending is `HELD`; eligible is `ELIGIBLE`; reversals and adjustments remain visible as signed ledger totals. Do not activate the seeded `DRAFT` policy or mutate any Affiliate state.
- `Customers`, `Affiliate`, and `Referrals` contain only stable opaque IDs and minimal status/timestamp/aggregate fields. IDs are SHA-256 pseudonyms of internal random identifiers, with no raw account ID, email, phone, owner key, referral code, order ID, payment reference, commission reason/snapshot, or fraud note exported. Pseudonymous row-level records are retained for 90 days after their latest relevant business activity, then removed from the workbook. Aggregate daily revenue/activity and lifetime dashboard counts remain available.
- Every 15 minutes the reporting process computes authoritative aggregates and upserts only changed report rows. A once-per-local-day reconciliation rebuilds the eight app-owned tabs from canonical data, restores deleted/edited cells, and prunes expired row-level records. Google writes use stable keys, row fingerprints, bounded batches, idempotent retries, backoff, and a persistent lease/checkpoint. Failures are recorded as sanitized status codes without payloads or secrets.
- A separate root-owned systemd oneshot/timer reads only the existing latest verified local archive for offsite work. It encrypts each archive with AES-256-GCM using a per-archive data key wrapped by the existing NaTarot PII keyring under a distinct purpose; no new plaintext secret is stored. It uploads encrypted bytes and a separate metadata-only manifest, verifies remote ID/name/size/app properties/checksum, downloads and decrypts the remote copy, and runs the existing isolated restore verifier with a separate status root. Retry state is retained. Offsite copies mirror the existing 7/4/3 retention references; after a new copy passes restore verification, only app-owned obsolete Drive files are moved to Trash. Local backups remain untouched.
- Prolonged offsite failures are recorded in the `System` tab and systemd journal. Once a connected owner account exists, a single bilingual operational alert is sent to that account's verified Google email after a continuous 24-hour backup failure and at most once per 24 hours, using the existing configured Resend service. The alert contains only the failure category and last-success timestamp.
- The timer is installed disabled. Production synchronization and offsite backup do not run until an eligible `SUPER_ADMIN` connects Google Drive in NaTarot and the owner enables the timer. The app remains operational if Google is unavailable.

## Data contracts

| Tab | Key and exported columns |
|---|---|
| Dashboard | Metric, value, reporting currency/time zone, as-of time |
| Customers | Opaque customer ID, registration date, account status, last recorded activity, verified purchases, net verified spending, Affiliate status |
| Revenue | Business date, verified revenue, successful orders, refunds, net revenue, new paying customers |
| Affiliate | Opaque affiliate ID, referrals, verified conversions, commission tier, eligible, pending, reversed/net adjusted commission |
| Referrals | Opaque referrer ID, opaque referred customer ID, attribution timestamp/status, verified conversion status |
| Activity | Business date, registered members (cumulative), active users, new users, Tarot sessions, returning users |
| Credits | Business date, Credits sold, consumed, expired, refunded |
| System | Last sync, last local backup, last offsite backup, backup verification, sync/backup error status, reporting version |

All money amounts are VND minor units converted to VND for display; dates are local business dates. Where the source schema has no event history, the workbook describes the metric's precise source rather than fabricating historic values.

## Failure boundaries

- The timer runs outside the web request lifecycle and has its own lock. No registration, payment, reading, session, Credit, or Affiliate request waits on a Google call.
- OAuth missing, invalid or ambiguous owner identity prevents both export jobs from running and preserves the checkpoint.
- A Google failure does not advance the checkpoint or delete a Drive backup; retries are bounded per run and resume on later ticks.
- A remote backup is not marked verified until it is downloaded, authenticated/decrypted, checksum-checked, and restore-tested.
- Workbook and backup operations log only opaque artifact IDs, counts, timestamps, durations, and sanitized categories.

## Validation

Use synthetic SQLite fixtures and mocked Google/Resend HTTP responses. Cover verified-payment boundaries, refunds, Credit ledger signs, Affiliate ledger reversals/adjustments, customer and activity date windows, pseudonymization/privacy, row-level retention, idempotent upserts, reconciliation, overlap locks, rate limits, outages, encrypted archive tampering, remote metadata/checksum, and isolated restore invocation. Then run the full test suite, TypeScript, production build, and deployment checks. Compare production aggregate counts without exposing rows. Deploy the code and migration with the new timer disabled; activate only after the production owner connects Google Drive.
