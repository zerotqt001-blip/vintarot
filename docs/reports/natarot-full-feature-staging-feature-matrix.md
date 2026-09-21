# NaTarot Full Feature Staging — Feature Matrix

Date: 2026-09-22
Branch: `codex/natarot-full-feature-staging`
Target: `https://staging.natarot.com` only
Source chain: Integration V3 `b1bf0f6` → `158379d` → `672de4a`

Status vocabulary: `PASS` means the source and staging evidence are complete for the stated boundary; `PARTIAL` means the implemented boundary is live but an external provider or operator flow is not available; `GATE` is the exact remaining blocker.

| Feature | SOURCE | INTEGRATED | ROUTE/API | DB | STAGING CONFIG | DEPLOYED | VERIFIED | E2E | BLOCKER |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| F-001 member auth/session | PASS | PASS | `/auth`, `/api/auth/*` | `members`, sessions/tokens | PASS | PASS | automated + live login/me | PASS | none for local/member path |
| Google OAuth | PASS | PASS | `/api/auth/google/*` | OAuth state/token tables | GATE | PASS | automated contract | GATE | no Google client/secret/redirect runtime configuration |
| Email verification/password recovery | PASS | PASS | `/api/auth/verify`, resend/reset APIs | auth token tables | GATE | PASS | automated mail/error contracts | GATE | no Resend runtime key/from configuration |
| Guest/F-001 identity boundary | PASS | PASS | Tarot session/draw/reading APIs | owner-scoped session/reading rows | PASS | PASS | live spoofed-header rejection | PASS | provider-backed reading intentionally unavailable |
| 78-card catalog + orientations | PASS | PASS | `/api/tarot/catalog`, guidebook routes | `decks`, `tarot_cards`, `card_meanings` | PASS | PASS | live 78/312 metadata + automated | PASS | none |
| Spread catalog / Auto + Manual / 10-card support | PASS | PASS | catalog, create, room, draw APIs | 9 categories, 57 templates, 174 positions | PASS | PASS | live catalog/draw + automated | PASS | no 12-card template is present in this seed |
| Room / SpreadBoard / draw-flip-card detail | PASS | PASS | `/room`, draw/session APIs | reading sessions/cards | PASS | PASS | source + live guest draw/session | PARTIAL | broader physical-device Room capture remains operator follow-up |
| DeepSeek AI / Tarot reading v4.2.2 | PASS | PASS | `/api/tarot/reading`, follow-up/clarification | reading payload/persistence | GATE | PASS | safe live `503` + automated provider contracts | GATE | no DeepSeek runtime key; no live provider generation claimed |
| Knowledge Base V5 / L5–L8 | PASS | PASS | trusted reading context/follow-up/clarification paths | existing reading payload | GATE | PASS | automated suites | GATE | live AI provider gate above |
| Reading persistence / journal / history | PASS | PASS | saved-reading/history APIs and Account | readings, records, sessions | PASS | PASS | automated ownership + live session persistence | PARTIAL | full provider-backed completed reading unavailable |
| Share S1–S6 / public / image / QR / events / revoke | PASS | PASS | `/api/tarot/shares/*`, `/r/:token*` | `reading_shares`, `share_events` | PASS | PASS | automated full matrix + live invalid-token/noindex probes | PARTIAL | current run has no completed provider-backed reading for a fresh full loop |
| Credits ledger / reservations / VIP | PASS | PASS | billing APIs and Tarot authorization | credits, grants, reservations, entitlements | PASS | PASS | automated + live billing reads | PARTIAL | live fulfillment depends on verified sandbox payment |
| Packages / server catalog | PASS | PASS | `/packages`, `/api/packages` | `packages`, `package_versions` | PASS | PASS | live public/member route and API | PASS | none |
| Orders / owner scope / idempotency | PASS | PASS | `/api/orders`, commercial checkout | `orders`, fulfillment/events | PASS | PASS | automated + live order creation/return | PASS | none after review fix |
| SePay Sandbox signed checkout | PASS | PASS | `/checkout`, `/api/commercial/checkout` | payment attempts/events | PASS | PASS | live `201`, signed field presence, sandbox action host | PARTIAL | no provider UI payment/OTP/2FA action performed |
| SePay IPN / exact verification / fulfillment | PASS | PASS | `/api/commercial/sepay/ipn`, reconcile | payment events + fulfillment | PASS | PASS | automated + live reconcile `200` | GATE | real sandbox payment/IPN callback requires operator/provider gate |
| Affiliate attribution/conversion/commission | PASS | PASS | attribute/admin/account history APIs, `/affiliate` | profiles, attributions, conversions, ledger | PASS | PASS | automated security/conversion suite + live owner metadata read | PARTIAL | dedicated synthetic mutation/role fixture not run live |
| Account / History / owner metadata | PASS | PASS | `/account`, summary/history APIs | owner-scoped read models | PASS | PASS | live member summary/history + browser route | PASS | none |
| Admin / RBAC / Audit | PASS | PASS | `/admin`, admin APIs | audit/RBAC/member tables | PASS | PASS | automated full role matrix + route/browser availability | PARTIAL | live mutation requires dedicated admin/support/finance fixtures |
| NaTarot/Moonlight shell and brand | PASS | PASS | shared shell | N/A | PASS | PASS | live browser staging pass | PASS | no redesign performed |
| Functional mobile navigation | PASS | PASS | `/packages`, `/checkout`, `/affiliate` | N/A | PASS | PASS | exact CSS 375/390: headings present, no horizontal overflow | PASS | physical device capture remains optional operator follow-up |
| Production isolation | PASS | PASS | staging host only | staging DB only | PASS | PASS | staging/prod health and service checks | PASS | no production mutation authorized or performed |

## Evidence summary

- Local tracked suite: `527/527` passing; TypeScript, production build, `npm audit --omit=dev` (`0` vulnerabilities), `git diff --check`, targeted ESLint and staged secret scan pass.
- Staging database: `PRAGMA integrity_check = ok`, zero foreign-key violations; 78 cards, 312 meanings, 57 templates, 174 positions; staging DB mode `600`, app mode `700`; timestamped backups retained before each staging replacement.
- Live public smoke: staging HTTPS/HTTP redirect, health `200` with `{"status":"ok"}`, `noindex,nofollow`, no-store health, packages/checkout/affiliate/account/admin/room/catalog APIs reachable; production apex/www remained `200` and production service remained active.
- Restart persistence: a staging-only service restart returned active and a bounded readiness poll reached health `200`; an immediate probe may see the short proxy warm-up before the Vinext listener is ready.
- Live member/commerce smoke: ephemeral synthetic `sepay_staging` seed, login/me, account summary/history, billing reads, server-priced checkout `201`, display-only return `200`, reconcile `200`; no credentials or signed field values were printed.
- Live guest/security smoke: catalog, 3-card draw `201`, owner session `200`, safe provider-gated reading `503`, spoofed OAI header rejected `401`, invalid share probes did not expose content.

## Exact external gates

The staging environment exposes `NODE_ENV` plus SePay Sandbox variable names only. No DeepSeek, Google OAuth or Resend runtime keys are configured. A complete AI-backed reading, email/OAuth activation, fresh provider-backed Share loop, and real Sandbox payment → IPN → fulfillment loop therefore remain explicitly unclaimed. Production was not used as a substitute, and no real-money transaction or production restart/migration occurred.
