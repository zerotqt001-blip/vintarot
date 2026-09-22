# NaTarot Admin Control Center V1 — Production Final Report

Date: 2026-09-23 (Asia/Ho_Chi_Minh)

## Lineage

- INTEGRATION BRANCH: `codex/natarot-admin-control-center-live-fixes`
- INTEGRATION COMMIT: `0b1706a51d96a259c59427004096a0f0f44aceb3` (release-tree tip; application hardening is `dd3bfb1072ac3a0f84207be89dc09d3143c077b1`)
- PRODUCTION COMMIT: `0b1706a51d96a259c59427004096a0f0f44aceb3`
- ADMIN SOURCE: `d9e2a6e606dff184e85c760e053960e0ddf60dd1`
- PRODUCT BASE: `9216d4597bc0b4faa9d0cbf0bf60f65c27b0308f`
- LIVE INTEGRATION BASE OBSERVED BEFORE HOTFIX: `dfb89ed53100e280e9798b4c946d3daaf59ab213`

## Conflicts and resolution

The live production line already contained the Admin integration and the atomic audit batching fix. The follow-up review compared that live line rather than replacing it with the earlier source-only candidate. The final changes are limited to the shared entitlement/read-model boundary and Admin UI/tests:

- `lib/entitlements.ts`: matching VIP revoke retries return the original success after cancellation, while mismatched fingerprints still conflict.
- `lib/admin/read-model.ts`: Orders are loaded only for actors with `admin.orders.read`; restricted detail returns `orders: null`.
- `app/admin/admin-console.tsx` and tests: render the restricted Orders state and cover the replay/permission cases.
- Canonical Credits ledger, FIFO/expiration behavior, consume/release/refund, order/payment architecture, Affiliate ledger, audit batching and SePay verification boundaries remain intact. No frontend payment shortcut or PAID transition was added.

## Required status matrix

| Check | Status | Evidence |
|---|---|---|
| ADMIN DASHBOARD | PASS | Fresh owner QA browser showed authoritative counts and refresh state. |
| USER MANAGEMENT | PASS | Searchable user table loaded with masked contact fields and status/role columns. |
| OWNER QA ACCOUNT ADMIN | PASS | Existing `natarot_owner_test` was recognized; Credits, VIP, usage, orders/history and Affiliate state loaded. |
| CREDIT ADMIN | PASS | Live +1/−1 reversible QA adjustment completed through the Admin control, never by direct DB edit. |
| CREDIT LEDGER | PASS | Balance returned to 98; both adjustment rows and the bounded reason are visible. |
| CREDIT REPLAY | PASS | Replayed the original idempotency key; no balance or audit duplicate was created. |
| VIP ADMIN | PASS | Live 30-day internal grant created an entitlement and the selected entitlement was revoked to `CANCELLED`. |
| ORDERS/PAYMENTS ADMIN | PASS | Global pending order and 15,000 VND amount were visible; payment reference remained masked/empty and no order was marked PAID. |
| AFFILIATE ADMIN | PASS | Owner profile/status, conversion counters and policy metadata loaded without payout controls. |
| READINGS ADMIN | PASS | Metadata-only records loaded; question payloads, interpretations and share tokens were not exposed. |
| AUDIT | PASS | Credit/VIP QA actions appeared as append-only audit events with reasons. |
| RBAC | PASS | Owner Admin access loaded; unauthenticated reads returned 401; malformed/unsupported mutation paths were 401/405 as designed; local ordinary-user/owner-scoping tests passed. |
| ORDINARY USER ADMIN DENIAL | PASS | Server-side RBAC suite and production unauthenticated boundary passed; no ordinary-user credential was created or exposed. |
| PACKAGE 1 CREDIT = 15,000 VND | PASS | Fresh browser package catalog rendered `1 Tarot Credit · 15.000 ₫`. |
| ACCOUNT → NẠP CREDIT | PASS | Account page exposed the Nạp Credit link to `/packages`. |
| OWNER TEST CREDITS | PASS | Existing internal QA grant remained intact; final balance was 98 with no payment action. |
| TAROT | PASS | Guidebook rendered 78 cards; room and manual topic path opened successfully. |
| DEEPSEEK | PASS | Existing owner QA saved reading rendered a complete reading in the fresh browser; no additional credit-consuming provider call was made. |
| AUTO TOPIC | PASS | Work topic rendered automatic spread recommendation and question suggestions. |
| SHARE/QR | PASS | Owner Share history showed an active share; complete share/QR regression/security tests passed locally. No new public share artifact was left behind by QA. |
| SEPAY | `SEPAY_PRODUCTION_CREDENTIAL_GATE` | Production credential verification remains intentionally open; no staging credential was copied. |
| RESEND | `RESEND_EXTERNAL_GATE` | Existing production provider key remains the known HTTP 401 gate; no secret was changed. |
| BACKUP | PASS | Fresh `natarot-production-20260922-191743`; archive SHA-256 `69ae6ca4c2d80f0289d485c82bfc4bc8f2e65efbe80c069892ea0c0e913ae2c8`. |
| RESTORE | PASS | Checksum, extracted DB, no-op migration and SQLite integrity/foreign-key checks passed. |
| ROLLBACK | READY | `/opt/natarot.rollback-natarot-admin-live-0b1706a-20260922T192553Z` retained. |
| FULL TESTS | PASS | `566/566`. |
| TYPESCRIPT | PASS | `npx tsc --noEmit`. |
| BUILD | PASS | Local and host-native candidate production builds. |
| SECURITY | PASS | Secret/path scan, dependency audit (0 high production vulnerabilities), RBAC, masked PII, no-payment-shortcut and database checks passed. |
| 390PX | PASS | Admin at 390px: viewport 390, document/body scroll width 375. |
| DESKTOP | PASS | Admin desktop: viewport 1424, document/body scroll width 1409. |
| PRODUCTION DEPLOYMENT | PASS | Atomic switch at `2026-09-22T19:25:53Z` UTC; local/public health 200; two controlled restarts persisted state. |

## Deployment evidence

- Release archive SHA-256: `4b083683c6fa1647ed962e9b3ff34889f4d0ed4cb60cb1d58e1285e293ff98e2`.
- Active marker source commit: `0b1706a51d96a259c59427004096a0f0f44aceb3`.
- Service: `natarot.service` active; local and apex/www HTTPS health checks returned 200 after deployment and restart.
- Database: integrity `ok`, zero foreign-key violations, 10 migrations after deployment and after QA writes/restarts.
- Nginx: `nginx -t` passed; no Nginx configuration change was made.
- Cleanup: one stale, non-active Admin candidate was removed after verifying it was not active or the recorded rollback release; no application DB or credential files were removed.

No real-money transaction, payment verification bypass, credential rotation, package price change, SePay activation or Resend change occurred.
