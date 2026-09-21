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

Live AI and the full provider/browser payment journey need dedicated staging-safe provider fixtures. The fresh Sandbox checkout form was created successfully, but the provider checkout host returned HTTP `404` for the controlled form submission; no IPN or real-money flow was attempted. No DeepSeek variables are configured on staging.

## V3 closure retest

- Staging was redeployed from `b1bf0f6`; `natarot-staging.service` is active and local/public health is `200`.
- Share loop: create `201`; valid page `200`; image `200` with `image/svg+xml`; QR embedded; event calls `202`/`202` with one durable event row; foreign revoke `204` and link remains public; owner revoke `204`; revoked image `404`; revoked HTML shows the intended unavailable/not-found state.
- Affiliate: a disposable staging USER fixture with a temporarily enabled/restored policy returned invalid-code rejection, first-touch attribution and idempotent repeat attribution; all fixture rows were removed and policy restored to `DRAFT`. Verified-fulfillment conversion/reversal remains covered by the local Affiliate suite, not by a live provider event.
- RBAC: a disposable staging USER fixture received `403` on admin users/affiliate/audit/orders, while missing-session and spoofed-role requests received `401`/`401`; rows and sessions were removed after the probe. The local role matrix covers SUPPORT, FINANCE, ADMIN and SUPER_ADMIN permissions.
- The controlled provider submission returned external 404, so full provider browser/IPN certification remains a HUMAN_GATE. No secrets, customer payloads, production resources or real-money transactions are included in this report.
