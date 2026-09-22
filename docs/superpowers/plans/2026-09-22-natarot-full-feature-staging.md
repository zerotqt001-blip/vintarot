# NaTarot Full Feature Staging Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrate the newest safe NaTarot V3 product head into one delivery branch, make every implemented owner-testable surface reachable, deploy it to staging only, and report verified state without redesigning the UI or touching production.

**Architecture:** Preserve `b1bf0f6` as the approved descendant of the remote Integration V3 checkpoint `d0f4cfb`; do not re-merge historical feature branches. Keep frozen Auth, Tarot/AI, Share, Credits/VIP, SePay, Affiliate, Audit, RBAC, and persistence semantics unchanged. Add only minimal client-facing Packages, Checkout, and Affiliate route surfaces that consume the existing owner-scoped APIs, then validate the built artifact and the isolated staging topology.

**Tech Stack:** React 19 + TypeScript, Next/Vinext/Vite, existing `VinTarot` shell and functional UI primitives, D1-shaped SQLite runtime, Drizzle-compatible SQL migrations, `tsx --test`, Node 22, systemd/Nginx staging deployment.

**Spec:** User-provided NaTarot Full Feature Staging Deployment V1 at `/Users/tranquangthanh/.codex/attachments/85318895-c191-44d3-8c9e-ba309175ffac/Văn bản đã dán.txt`, with `docs/FEATURE_FREEZE_V3.md` as the repository freeze contract.

## Global Constraints

- Canonical base: `origin/codex/natarot-integration-v3` at `d0f4cfb`; current approved descendant: local `codex/natarot-integration-v3` at `b1bf0f6`.
- Delivery branch: `codex/natarot-full-feature-staging`; no main merge, force push, or history rewrite.
- Preserve the Moonlight reference and NaTarot navy/antique-gold/ivory/celestial branding; no Final UI redesign or Liquid Glass work.
- Functional UI additions must use existing style primitives and must not alter frozen business semantics.
- Staging target only: `https://staging.natarot.com`, `natarot-staging.service`, `/opt/natarot-staging`, `/var/lib/natarot-staging/natarot.sqlite`.
- Never deploy, migrate, restart, reconfigure, or read-write production `natarot.service`, production DB, production environment, or production credentials.
- Never print, commit, log, or document passwords, tokens, provider keys, PII key material, or payment secrets.
- Before staging migration: identify the exact DB, record metadata only, create and verify a new rollback backup, then apply only missing idempotent migrations.
- Mark missing provider/device capabilities as external gates while continuing unrelated safe work.
- Every changed/new source file must pass targeted lint; inherited repository-wide lint debt must be separated from mission regressions.
- Update `docs/PROJECT_STATE.md`, `docs/FEATURE_FREEZE_V3.md`, and `docs/design/NATAROT_FINAL_UI_HANDOFF.md` with source, staging, verification, and unfinished-work distinctions.

## Baseline and Integration Record

- [ ] Record repository, dirty original worktree, branch, exact HEADs, remote refs, ancestry, and preservation boundary in the feature matrix.
- [ ] Confirm `b1bf0f6` is a clean descendant of `d0f4cfb` and retain its proxied-origin regression fix.
- [ ] Do not import the dirty original checkout's user-owned Home/UI files or untracked tests.
- [ ] Confirm the isolated branch starts with a fresh baseline: 525/525 tracked tests, Node 22, clean `git status`.

## Task 1: Feature Inventory and Runtime Gap Audit

**Files:**
- Create: `docs/reports/natarot-full-feature-staging-feature-matrix.md`
- Inspect: `app/**`, `lib/**`, `db/**`, `drizzle/**`, `deploy/**`, `tests/**`, staging docs, and live staging metadata

**Interfaces:**
- Consumes: current Integration V3 source and the staging runbook.
- Produces: a source/integration/API/DB/config/deployed/runtime/E2E matrix for every feature named by the mission, with explicit blockers and evidence references.

- [ ] Audit Auth, OAuth, verification/recovery, guest/F-001, Tarot catalog/spreads/SpreadBoard/10-card/Auto/manual/draw/details/persistence, AI/KB/L5/L7/L8, Share S1–S6, Credits/VIP/packages/orders/SePay, Affiliate, Account/History, Admin/RBAC/Audit, and PII security.
- [ ] Inspect actual staging release/service/database/migration/configuration state over the authorized staging path without reading private row contents or secrets.
- [ ] Identify only safe gaps. Treat missing owner routes as navigation gaps; do not invent unsupported payment, affiliate payout, or provider semantics.

## Task 2: Functional Navigation Surfaces (TDD)

**Files:**
- Create: `tests/full-feature-navigation.test.ts`
- Create: `app/packages/page.tsx`
- Create: `app/checkout/page.tsx`
- Create: `app/affiliate/page.tsx`
- Create or modify: `app/commerce/commerce-pages.tsx` if a shared client boundary is needed
- Modify: `components/account/account-history.tsx` for minimal links to Packages, Affiliate, and the existing Account/Admin surfaces
- Modify: `app/[section]/page.tsx` only if an existing route allowlist must be extended

**Interfaces:**
- Packages page consumes `GET /api/packages` and exposes active server-priced package versions.
- Checkout page consumes `POST /api/commercial/checkout` and posts the returned signed form to the returned SePay Sandbox action; it must never calculate price or expose server secrets.
- Affiliate page consumes owner-scoped `/api/account/summary` and `/api/account/history?kind=affiliate`, showing metadata-only conversion/commission state and safe next actions.
- Logged-out users receive the existing `/auth?return_to=...` flow; server-side ownership remains authoritative.

- [ ] Write source-contract tests for route existence, API usage, server-priced checkout, no secret/payload leakage, authenticated return paths, and minimal account navigation.
- [ ] Run the new test file and verify it fails because the route surfaces do not yet exist.
- [ ] Implement the smallest route/client components using existing functional CSS classes and accessible loading/error/empty states.
- [ ] Run the focused test file until green, then run the affected account/admin/package/order/security tests.
- [ ] Check 375px and 390px functional usability for the new routes; fix only P0/P1 blockers.

## Task 3: Migration, Security, and Economic Regression

**Files:**
- Inspect: `scripts/node-migrate.mjs`, all `drizzle/*.sql`, `db/schema.ts`, migration and security tests
- Modify only if a verified in-scope defect is reproduced: the smallest affected source/test files

**Interfaces:**
- Fresh and upgrade fixtures must preserve Auth, 78 cards, 312 meanings, readings, Share, Credits/VIP, Orders, Affiliate, Audit, and Account/History.
- Economic effects remain at-most-once across duplicate/concurrent IPN, fulfillment, credit, conversion, and commission attempts.

- [ ] Run fresh and realistic upgrade migration fixtures, including duplicate-numbered `0004` and `0007` files, and inspect integrity/count metadata only.
- [ ] Run Auth/F-001, ownership/IDOR, CSRF/origin, Share, Credits/VIP, SePay, Affiliate, Audit, RBAC/Admin, PII, and concurrency suites.
- [ ] For every failure, reproduce with a focused regression test before changing implementation; diagnose, fix, and retest without weakening invariants.

## Task 4: Build, Package, and Staging Deployment

**Files:**
- Inspect/modify only when required by verified staging gaps: `scripts/build-verified.sh`, `deploy/systemd/natarot-staging.service`, `deploy/nginx/natarot-staging*.conf`, release packaging inputs
- Create outside Git only through the runbook: timestamped staging DB backup and release archive

**Interfaces:**
- Release identity is the final commit SHA and matching artifact digest.
- Only `natarot-staging.service` may be restarted; previous known-good staging release and verified backup remain available for rollback.

- [ ] Run typecheck, production build, targeted lint, dependency audit, secret scan, `git diff --check`, and the full tracked suite before deployment.
- [ ] Audit current staging reality, verify no simultaneous staging deploy is active, back up the exact staging DB, and verify backup integrity.
- [ ] Package only tracked release inputs with no `.env*`, runtime DB, logs, credentials, node_modules, Git metadata, or local state.
- [ ] Transfer/deploy the full-feature release to staging using the existing authorized path; run missing migrations only after backup verification.
- [ ] Restart only `natarot-staging.service`; verify active service, release identity, database path, migration state, health, no-store/noindex headers, and rollback retention.

## Task 5: Staging E2E and Adversarial QA

**Files:**
- Create/modify only evidence docs: `docs/reports/natarot-full-feature-staging-final-report.md`, `docs/reports/natarot-full-feature-staging-feature-matrix.md`
- Inspect/fix only verified functional/security blockers in existing source

- [ ] Run the maximum permitted customer journey: register/login, Account, Packages, Room, Auto/manual spread, draw, reading or explicit DeepSeek gate, history, follow-up, clarification, Share/QR where configured, and return to Account.
- [ ] Run commercial Sandbox order/checkout/IPN/verification/fulfillment/Credits/VIP/replay/reconciliation; verify exactly-once effects and no real money.
- [ ] Run Affiliate A → User B attribution/order/fulfillment/conversion/commission and replay/concurrency/self-referral/owner-isolation checks where safe fixtures permit.
- [ ] Run Share create/public/image/QR/events/revoke/privacy checks with synthetic data and no private-reading leakage.
- [ ] Run Account/History and Admin/RBAC allow/deny/IDOR/spoof/audit checks through APIs and reachable UI.
- [ ] Run browser/mobile functional QA at 375px and 390px (plus one larger mobile viewport if available); record P0/P1/P2/P3 findings and fix only P0/P1.
- [ ] Test safe restart persistence for sessions/readings/shares/orders/payments/fulfillment/Credits/VIP/Affiliate/Audit and re-run health/selected flows.

## Task 6: Freeze, Handoff, Verification, and Delivery

**Files:**
- Modify: `docs/FEATURE_FREEZE_V3.md`
- Modify: `docs/design/NATAROT_FINAL_UI_HANDOFF.md`
- Modify: `docs/PROJECT_STATE.md`
- Create: `docs/reports/natarot-full-feature-staging-final-report.md`

- [ ] Update the freeze with protected functional zones, safe UI-only changes, semantic-review requirements, and regression expectations.
- [ ] Update UI handoff with current routes, route/component/API/data contracts, loading/error/empty/permission/mobile/SpreadBoard/reading/follow-up/clarification/Share/Credits/VIP/package/checkout/Affiliate/Account/History/Admin state, plus P0–P3 findings.
- [ ] Update Project State with separate IMPLEMENTED, INTEGRATED, STAGING DEPLOYED, STAGING RUNTIME VERIFIED, STAGING E2E VERIFIED, EXTERNAL_GATE, and PRODUCTION DEPLOYED values.
- [ ] Perform an independent focused code/security/release review; resolve Critical/High and safe correctness Medium findings or document exact remaining gates.
- [ ] Run final focused suites, full tracked tests, TypeScript, build, targeted ESLint, repository lint classification, `git diff --check`, secret scan, and production dependency audit.
- [ ] Inspect staged diff for secrets and unrelated files, commit coherent changes on `codex/natarot-full-feature-staging`, push normally, and verify local SHA equals `origin/codex/natarot-full-feature-staging`.
- [ ] Produce the requested comprehensive final report with all production hard-lock assertions set to `NO`, then stop before Final UI redesign.

## Rollback and Stop Conditions

- Stop and report a HUMAN_GATE for missing authorized SSH/provider credentials, password/OTP/2FA/CAPTCHA/device approval, real-money/payout/provider identity operations, destructive Git/DB/backup deletion, simultaneous staging deployment, or an unsafe protected semantic change.
- If a provider or device gate occurs, continue all unrelated source, test, deployment, security, and documentation work and mark only that capability `EXTERNAL_GATE`.
- If staging deployment fails, preserve the previous release and backup; do not delete or force-replace rollback assets.
