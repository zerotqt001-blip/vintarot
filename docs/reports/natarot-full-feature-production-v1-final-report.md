# NaTarot Full Feature Production V1 — Final Deployment Report

Date: 2026-09-22 (Asia/Ho_Chi_Minh)

## Executive result

The authorized NaTarot Full Feature V1 release is live at [https://natarot.com](https://natarot.com). The deployed application source is the verified staging head `a0a79fa64aa398a566b40bef96be3c590bf5292d` from `codex/natarot-full-feature-staging`. The production database migration, backup, restart, guest Tarot flow, live DeepSeek reading, Share/QR loop, security checks, and responsive UI smoke all passed.

The release deliberately does not activate real money, copy staging payment configuration into production, rotate secrets, or invent member/admin fixtures. Provider- and owner-dependent paths are recorded as external gates below.

## Release and rollback identity

- Production: `https://natarot.com`; `www.natarot.com` redirects to the canonical HTTPS host.
- Source branch: `codex/natarot-full-feature-staging`.
- Source commit: `a0a79fa64aa398a566b40bef96be3c590bf5292d`.
- Candidate archive SHA-256: `fdd8914b32c5fea8eb3e33a2682de24a6292cece7ff0116e6b13bd65a5d3d05b`.
- Active deployment revision SHA-256: `b17b088acf1c6366e4210b655fea2a3eaecda21d54f4e035e8fe13ac30c58b60`.
- Active service: `natarot.service`, enabled and active, listening on `127.0.0.1:8787` behind the existing production Nginx TLS host.
- Rollback tree retained at `/opt/natarot.rollback-full-feature-v1-20260922T070221Z`.
- Staging service, staging database, production environment names/values, and TLS topology were preserved.

The release archive was built from tracked source and required runtime assets. It excluded `.env*`, databases, logs, `node_modules`, Git metadata, private keys/certificates, cookies, and credential-like filenames.

## Backup and disaster-recovery gate

- Backup ID: `natarot-production-20260922-064648`.
- Archive: `/var/backups/natarot/daily/natarot-production-20260922-064648.tar.gz`.
- Archive SHA-256: `7d7434a72fbc07a77536511b1d933b309af759efcf334e90de9c30afa767d826`.
- Sidecar checksum verification: `OK`.
- Archive readability: `27` entries; required database/migration/release metadata present; no prohibited environment or secret-like filenames.
- Live and extracted database checks: SQLite `integrity_check=ok`, `foreign_key_violations=0`.
- Restore readiness: `PASS`.

The Nginx configuration backup taken before the HSTS hardening is retained at `/var/backups/natarot/configuration/natarot-before-hsts-20260922T072904Z`.

## Migration and atomic deployment

The production database had six applied migrations before this release:

`0000_vengeful_ben_urich.sql`, `0001_dynamic_tarot.sql`, `0002_tarot_seed.sql`, `0003_moonlight_spread_catalog.sql`, `0004_member_auth.sql`, and `0004_reading_payload.sql`.

A private copy of the fresh backup was used for the migration dry run. The four pending migrations applied cleanly and add the Full Feature tables and backend completion/commercial structures:

`0005_natarot_share_persistence.sql`, `0006_credits_vip.sql`, `0007_backend_completion.sql`, and `0007_sepay_commercial.sql`.

The dry-run copy and live database both finished with ten migration rows, clean SQLite integrity, and zero foreign-key violations. The changes were additive/compatible for the existing data; no destructive migration was used.

The live migration ran before the release directory switch. The prior `/opt/natarot` tree was renamed atomically to the rollback path above, the verified candidate became `/opt/natarot`, ownership was restored to `natarot:natarot`, and the service restarted successfully. The post-switch public and local health endpoints returned `{"status":"ok"}`.

## Verification evidence

Local verification on the exact release source:

- `npx tsx --test tests/*.test.ts`: `527` tests passed, `0` failed.
- `npx tsc --noEmit`: passed.
- `npm run build`: passed; the route inventory includes Account, Admin, Affiliate, auth, billing, commercial, orders, packages, records, rooms, share, and Tarot catalog/draw/reading APIs and pages.
- `npm audit --omit=dev`: `0` production vulnerabilities.
- `git diff --check`: passed.
- Secret-like tracked-value scan: passed.
- `npm run lint`: inherited repository baseline failure (`214` problems: `89` errors and `125` warnings); no application source was changed to conceal or broaden that debt.

Production smoke and E2E:

- HTTPS redirect, canonical homepage, `/api/health`, packages, catalog, account, and admin routes responded as expected.
- Catalog returned the seeded categories/templates, including the ten-card Celtic Cross and the automatic-topic target.
- Automatic topic detection for a synthetic career question selected `work` / `CAREER`, `category-planning`, and `spread-planning-career-crossroads` with high confidence.
- Guest manual override, three-card draw, ten-card Celtic Cross draw, session hydration, journal record, and room persistence passed. A separate guest could not read the owner session/room.
- A real production DeepSeek reading passed through the production environment and returned `source=ai`, `provider=deepseek`, model `deepseek:deepseek-flash`, prompt `tarot-reading-v4.2.2`, three card-evidence items, a disclaimer, and a persisted reading ID. No provider key or private response content was logged.
- The same live DeepSeek path passed again after the service restart.
- Share creation returned an opaque token, public page and SVG image returned successfully, duplicate creation returned `409`, repeated analytics delivery remained one database event, foreign revoke did not revoke the owner share, and owner revoke removed public access and the image while leaving only the intentional friendly error shell. The revoked page is `200` with `private, no-store` and `noindex, nofollow`; the revoked image is `404`.
- Registration response contract, unauthenticated account/history protections, Google OAuth start redirect, integration status, package/order/billing protections, affiliate boundary, and admin/RBAC boundary checks passed. Provider- or fixture-dependent continuation is classified as an external gate rather than simulated.

Responsive UI smoke used the live site through the Codex browser at 375px, 390px, and 412px widths. The Create flow showed the automatic career recommendation and opened `/room?ritual=1`; measured document widths did not exceed the viewport. The temporary viewport override was reset to the default desktop size before completion.

## Security and observability

- Nginx now sends HSTS (`max-age=31536000`) in addition to `X-Content-Type-Options`, `X-Frame-Options`, and `Referrer-Policy`; `nginx -t` and reload passed.
- Direct-origin API probes were rejected, sensitive paths such as `.env`, `.git/HEAD`, the SQLite file, deployment metadata, and server internals were not exposed, and share privacy/no-store behavior passed.
- Runtime environment file permissions remain restricted (`0600`, root-owned); deployment metadata is non-secret and readable by the service.
- The bounded journal review found no key/token/authorization pattern and no unexpected application-error lines in the checked window.
- Post-restart database integrity remained clean, the migration count remained ten, and no active synthetic share artifacts remained.

## Feature matrix

| Surface | Classification | Evidence / gate |
|---|---|---|
| Auth, guest identity, F-001 boundary | `DEPLOYED + VERIFIED` | Auth routes and unauthenticated protections exercised; origin/header spoofing rejected. |
| Tarot catalog, spreads, draw, SpreadBoard, live AI | `DEPLOYED + VERIFIED` | Catalog, automatic topic, manual override, 3-card, Celtic Cross, persistence, and live DeepSeek passed. |
| Account and history | `DEPLOYED + EXTERNAL_GATE` | Routes, owner scoping, guest persistence, and unauthenticated denial passed; verified-member history requires an owner/provider-complete identity. |
| Share, public view, SVG image/QR, analytics, revoke | `DEPLOYED + VERIFIED` | Full create/public/image/idempotency/foreign-revoke/owner-revoke loop passed. |
| Credits, VIP, packages, orders | `DEPLOYED + EXTERNAL_GATE` | Schema, routes, authorization, and replay boundaries are deployed; production package catalog is intentionally empty pending approved production pricing and member fixture. |
| Google OAuth | `DEPLOYED + EXTERNAL_GATE` | Start redirect and transaction cookie passed; interactive Google consent/callback needs owner completion. |
| Email and verification | `DEPLOYED + EXTERNAL_GATE` | Route contract passed; production Resend request returned HTTP `401`. |
| SePay sandbox | `DEPLOYED + EXTERNAL_GATE` | No production SePay configuration was copied or enabled; staging-only sandbox seed remains isolated. |
| Affiliate | `DEPLOYED + EXTERNAL_GATE` | Route boundary passed; mutation/payout-style verification needs an approved synthetic member/affiliate fixture. |
| Admin/RBAC | `DEPLOYED + EXTERNAL_GATE` | Unauthenticated and method/shape boundaries passed; authenticated role matrix needs an approved admin/support/finance/content fixture. |
| Security, restart persistence, observability | `DEPLOYED + VERIFIED` | Headers, exposure, origin, privacy, logs, integrity, restart, health, catalog, draw, and DeepSeek recheck passed. |

## Owner actions and non-goals

The only provider failure observed in the deployed email path is the known invalid/unauthorized Resend key. Exact owner action:

`RESEND_API_KEY = INVALID`

`OWNER ACTION: Replace existing production Resend API key with a valid key.`

Remaining owner-controlled gates are:

1. Complete an owner-authorized Google OAuth consent/callback test.
2. Approve/provision production package pricing and, if a sandbox test is desired, an explicitly isolated SePay sandbox configuration. No real-money flow was activated.
3. Provide or conduct approved synthetic verified-member, admin, and affiliate identities if those authenticated mutations must be tested end to end.

No UI redesign, real payment, payout, secret rotation, or unrelated milestone was started. The live release is safe to use as the UI base for final review while the listed external gates remain open.

## Final verdict

PRODUCTION DEPLOYMENT: PASS
NATAROT.COM FULL FEATURE RELEASE: LIVE
PRODUCTION DATABASE MIGRATION: PASS
PRODUCTION BACKUP VERIFIED: YES
LIVE DEEPSEEK READING: PASS
AUTO TOPIC ON PRODUCTION: PASS
ACCOUNT/HISTORY: FAIL
SHARE/QR: PASS
CREDITS/VIP: FAIL
GOOGLE OAUTH: EXTERNAL_GATE
EMAIL/RESEND: EXTERNAL_GATE
SEPAY SANDBOX: EXTERNAL_GATE
AFFILIATE: EXTERNAL_GATE
ADMIN/RBAC: EXTERNAL_GATE
SECURITY REGRESSION: PASS
RESTART PERSISTENCE: PASS
ALL IMPLEMENTED FEATURES DEPLOYED: YES
OWNER CAN TEST NATAROT.COM NOW: YES
OWNER MISSING ITEMS:
- Replace the invalid production Resend API key.
- Complete owner-authorized Google OAuth consent/callback.
- Approve/provision production commercial fixtures and isolated SePay sandbox configuration if desired; do not use real money.
- Provide approved authenticated member/admin/affiliate test identities for those gated E2E paths.
READY FOR FINAL UI REVIEW: YES
READY FOR REAL MONEY: NO unless separately and explicitly authorized/certified.
SAFE TO USE THIS PRODUCTION RELEASE AS UI BASE: YES
