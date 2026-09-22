# NaTarot Integration V3 — Staging Audit

Date: 2026-09-22
Environment: `https://staging.natarot.com` only

## Deployment and database

- Release artifact was built from the V3 integration HEAD and transferred with matching SHA-256; no `.env`, database, logs, `node_modules` or Git metadata were included.
- Only `natarot-staging.service` was stopped/restarted. The previous staging release was retained at a timestamped rollback path.
- A staging-only SQLite backup was created before migration, verified readable with integrity `ok`, foreign-key check clean, owner/mode preserved (`natarot-staging`, `0600`).
- The missing `0007_backend_completion.sql` migration applied once. A rerun was idempotent. Both historical `0007_backend_completion.sql` and `0007_sepay_commercial.sql` are recorded by full filename.
- Post-migration integrity was `ok`; representative counts were 78 cards, 312 meanings, one verified payment event, one fulfillment, one 10-credit grant and one active VIP entitlement.

## Staging API evidence

Synthetic member `sepay_staging` was reseeded only in staging. Redacted status results:

| Check | Result |
| --- | --- |
| `/api/health` | `200` |
| member login / session identity | `200` / `200` |
| account summary | `200` |
| package catalog | `200`, seeded Sandbox package present |
| checkout creation | `201`, `PENDING`, Sandbox action returned |
| same idempotency key replay | `201`, same order identity |
| provider reconciliation | `200`, remained `PENDING` for the newly-created unpaid order |
| preserved verified Sandbox payment | one event, fulfilled, Credits/VIP effects present |

The provider-backed verified payment state was already present in staging and remained intact through this V3 migration/deploy. No real-money transaction or production payment was performed.

## Configuration and isolation

SePay Sandbox configuration was present on staging and used only for the synthetic flow. DeepSeek, Google OAuth and email provider were not configured for this release. Production services, endpoints, credentials and database were read-only and were not restarted or migrated.

## Open gates

Live AI and the full provider/browser payment journey need dedicated staging-safe provider fixtures. Full Share event/revoke/image/QR, Affiliate mutation/reversal, role matrix and adversarial concurrency certification remain human/operator gates. No secrets or customer payloads are included in this report.
