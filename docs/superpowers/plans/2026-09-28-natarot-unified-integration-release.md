# NaTarot Unified Integration and Release Plan

> **For agentic workers:** Execute this plan inline under the existing Release Manager freeze. Do not deploy, mutate production, or lift the freeze until the validation and backup gates below pass.

**Goal:** Integrate the Technical Audit, privacy-safe GA4 behavior, and Marketing Campaign Manager on the verified production source, then release one atomic production build with Daily Rewards still paused.

**Architecture:** Start from production source `230764db49ea42f5168a04622fac487a5b657a67`, already running as `natarot-audit-230764d-ga4-20260928T113007Z`. Merge Marketing commit `5fa8adedb2f8e1b93b118f1c3a9c388e35f7fae4` into this line and preserve its canonical `member:${memberId}` signup grant owner. The deployed source already contains the GA consent implementation; compare its cross-tab consent and opt-out behavior to GA branch `7f2b62b` and keep only verified behavior, never the stale branch's unrelated deletions.

**Tech Stack:** TypeScript, React/Next APIs through Vinext, SQLite/D1, checked-in SQL migrations, Node `tsx` tests, TypeScript, ESLint, and the managed VPS release manager.

**Spec:** Owner-provided “NATAROT — UNIFIED INTEGRATION & RELEASE”; supporting sources are `docs/audits/NATAROT_FULL_TECHNICAL_AUDIT.md`, `docs/superpowers/specs/2026-09-28-natarot-google-analytics-design.md`, and the Marketing design brought in by commit `5fa8ade` at `docs/design/marketing-campaign-manager.md`.

## Global Constraints

- Only this Release Manager may deploy during the temporary production freeze.
- Use current production source `230764d`; do not use root checkout `e8db82d` or the older GA branch as an integration baseline.
- Keep the existing Moonlight/VinTarot/NaTarot UI and Credit/payment/Affiliate/authentication behavior.
- Preserve exactly one Welcome TRIAL grant path, owned by `member:${memberId}`; do not modify existing grants, balances, or financial ledgers.
- Use the existing Credit ledger and `expireGrant`; free promotional Credits must create no revenue or Affiliate commission.
- Daily Rewards must be `PAUSED` in production and issue no automatic rewards.
- Do not use real customer transactions in tests or QA.
- Preserve current plus two rollback releases, every database backup, and all unknown `.incoming` or `.failed` artifacts.
- Run migrations only through the existing controlled release process after a fresh backup has passed restore verification.

---

### Task 1: Freeze and verify the production baseline

**Files:** None; read-only production and Git checks.

**Interfaces:** Consumes the owner authorization and Audit/GA worker handoffs. Produces the verified baseline SHA, release pointers, migration list, and freeze acknowledgment used by later tasks.

- [x] **Step 1: Confirm worker quiescence.** Audit and GA tasks are idle; both were told to make no further production writes, reloads, cleanup, or test traffic during this release window.
- [x] **Step 2: Verify production pointer and lock.** Current is `natarot-audit-230764d-ga4-20260928T113007Z`; rollback 1 is `natarot-ga4-7ab08e1-20260928T105805Z`; rollback 2 is `natarot-audit-230764d-20260928T105728Z`; the release lock was free at the read-only check.
- [x] **Step 3: Verify service, database and storage.** Service and health passed; SQLite integrity is `ok`, foreign-key violations are `0`, current schema ends at migration `0013`, Campaign tables are absent, and disk was 33% used with about 19 GB free.

### Task 2: Integrate Marketing commit and canonical Welcome Bonus ownership

**Files:**
- Merge changes from `5fa8ade` into the `230764d` baseline.
- Resolve `lib/auth-handlers.ts`, `lib/credits/repository.ts`, `app/globals.css`, `docs/PROJECT_STATE.md`, and `tests/auth-handlers.test.ts`.
- Preserve related tests in `tests/google-oauth.test.ts`, `tests/marketing-campaign-manager.test.ts`, `tests/marketing-campaign-admin.test.ts`, and `tests/marketing-daily-reward-http.test.ts`.

**Interfaces:** Consumes the canonical credit owner and existing signup flow from `lib/auth-handlers.ts` on `230764d`. Produces Marketing claim/admin APIs and Welcome campaign configuration without changing the single canonical signup reward boundary.

- [x] **Step 1: Merge only the approved campaign branch.** The integration merge is based on production source `230764d`; the final merge commit records campaign source `5fa8ade` in its second parent.
- [x] **Step 2: Resolve the Welcome grant path.** Password and Google completion create one one-unit `TRIAL` grant with `grant_key='signup-trial:v1'`, canonical owner ID `member:${memberId}`, no expiry, and the existing signup source/type. Existing grants remain read-only.
- [x] **Step 3: Keep campaign atomicity.** Daily claim enforces authenticated eligibility, period uniqueness, campaign status/date, per-user limits, and total budget in one database batch before calling the canonical grant writer. Concurrency and replay tests pass.
- [x] **Step 4: Run focused signup and campaign tests.** The focused auth, OAuth, Admin, claim, timezone, budget, expiry, and UI suite passed 67/67 before the full regression run.

### Task 3: Reconcile GA4 privacy behavior without importing the stale tree

**Files:**
- Compare `components/analytics/analytics-provider.tsx`, `lib/analytics-tracking.ts`, `app/layout.tsx`, and analytics tests between `230764d` and GA commit `7f2b62b`.
- Add/adjust only a focused consent regression test if the current suite does not cover opt-out and cross-tab withdrawal.

**Interfaces:** Consumes the deployed measurement ID `G-F9FTDDYV3E`, strict path/referrer sanitizers, and consent storage contract. Produces no GA collection before consent and immediate opt-out after same-tab or cross-tab withdrawal.

- [x] **Step 1: Compare the exact analytics files.** The verified production baseline includes the GA4 opt-out flag, bilingual consent banner, sanitized page location/referrer, and cross-tab withdrawal handling. The stale GA branch removes its cross-tab withdrawal listener, so no GA branch changes were imported.
- [x] **Step 2: Test consent and payload privacy.** Added passing regression tests for Measurement ID validation, allowlisted Daily Rewards/Admin campaign route templates, private query removal, opaque share-token removal, and origin-only external referrers. Browser-level consent verification remains in Task 5.
- [x] **Step 3: Keep analytics checks synthetic.** Browser QA used anonymous routes and an unconsented context; no live analytics hit or customer data was submitted. Realtime ingestion was not re-tested because that requires sending a live event after consent.

### Task 4: Review and locally verify Campaign migrations

**Files:** `drizzle/0014_marketing_campaigns.sql`, `drizzle/0015_business_reporting_campaigns.sql`, `drizzle/0016_credit_grant_expiry_index.sql`, migration tests, and the existing SQLite migration runner.

**Interfaces:** Consumes the production migration history ending at `0013_credit_adjustment_notice_legacy_baseline.sql`. Produces Campaign schema and aggregate reporting while leaving Credit grants, accounts, reservations, ledger rows, orders, and Affiliate rows unchanged.

- [x] **Step 1: Verify ordering and idempotency.** `0014`, `0015`, and the additive `0016` expiry index migration follow production `0013` in the existing sorted migration registry. Campaign migrations create campaign metadata/claim tables and reporting state; `0016` adds a partial index for the existing expiry scan. No parallel Credit ledger is introduced.
- [x] **Step 2: Test on synthetic SQLite data.** The migration test preserves synthetic Credit accounts, TRIAL/PURCHASE/PROMOTION grants, ledger, reservations, allocations, orders, and Affiliate rows exactly, with no foreign-key violations.
- [x] **Step 3: Verify seeds and protections.** Welcome Bonus seeds active at one non-expiring unit with issued-unit baseline; Daily Rewards seeds `PAUSED`. Campaign tests cover uniqueness, atomic budget/per-user checks, server-authoritative expiry, no revenue/commission, and purchase-lot preservation.
- [x] **Step 4: Run migration and ledger tests.** The complete regression suite covers the migration, campaign, expiry, Credit consumption, and Affiliate isolation paths with zero failures.

### Task 5: Run integrated regression, build and browser QA

**Files:** All integrated source and tests; no production files.

**Interfaces:** Consumes the merged source and local synthetic database. Produces a complete zero-failure validation record before backup or deployment.

- [x] **Step 1: Run the complete suite.** `npx tsx --test tests/*.test.ts` passed 802 tests with zero failures, including the 342 px spread geometry case.
- [x] **Step 2: Run static checks.** `npx tsc --noEmit` and the production build with `NEXT_PUBLIC_GA_MEASUREMENT_ID=G-F9FTDDYV3E` pass; changed-file ESLint has zero errors and one inherited unused-constant warning in `scripts/business-control-center.ts`; diff check passes.
- [x] **Step 3: Run focused security and business flows.** Regression coverage verifies registration/Welcome Bonus, daily claim and concurrency, expiration, purchase Credit preservation, AI reading consumption, Affiliate isolation, sanitized GA routes/referrers, BCC aggregates, and SUPER_ADMIN authorization.
- [x] **Step 4: Run responsive QA.** Authenticated SUPER_ADMIN Campaign Manager was checked at desktop and 390 px mobile; anonymous Daily Rewards was checked at desktop and 320, 342, 375, 390, and 412 px. The 342 px layout fits. Anonymous Admin page/API returned 404/401 and Rewards API returned 401. Campaign controls were not changed; no campaign claim was made.

### Task 6: Prepare and deploy one atomic production release

**Files:** Release artifact only; update `docs/PROJECT_STATE.md` after verification.

**Interfaces:** Consumes the zero-failure candidate, fresh restore-verified backup, and free deployment lock. Produces one active unified release and two known-good rollback references.

- [x] **Step 1: Capture the pre-deploy data baseline.** At the migration boundary the database contained 25 Credit accounts, 18 grants, 53 ledger rows, 54 reservations, 36 allocations, zero Affiliate commissions, 216 granted units and 181 available units. Existing TRIAL grants totaled 13 units with 4 available. Current baseline source was `230764d`; disk was 33% used.
- [x] **Step 2: Create and verify a fresh production backup.** `natarot-production-20260928-130624` passed checksum and isolated restore. The exact release-manager backup `natarot-production-20260928-130832` (SHA-256 `acb68c6f92f330c8a7d15a8556701bc111d2237ad78a7af4614b2a119e6942a3`) passed SQLite integrity, migration replay, and restored-application checks.
- [x] **Step 3: Deploy through the managed release manager.** With the lock free, commit `08c091402f831e22f6f3d5b762073077a0e7fc5a` was deployed atomically as `natarot-unified-08c0914-20260928T125604Z`; controlled migrations `0014`, `0015`, and `0016` applied in order.
- [x] **Step 4: Verify production.** The unified commit and release are current, service is active, internal/public health and SQLite integrity pass, and migration history includes `0014`–`0016`. Both campaign seeds are present, Daily Rewards is `PAUSED` with zero claims and budget used, Welcome Bonus remains `ACTIVE` with its existing one-credit signup behavior, and no new campaign grant or Affiliate commission was created. One independent post-deploy `TAROT_READING` consume used one existing Credit through the normal ledger; final totals are 54 ledger rows, 55 reservations, 37 allocations and 180 available units. BCC sync succeeded. Browser checks are recorded in Task 5. No live GA Realtime hit was sent.
- [x] **Step 5: Apply storage retention only after verification.** Exactly three managed releases remain: current `natarot-unified-08c0914-20260928T125604Z`, rollback 1 `natarot-audit-230764d-ga4-20260928T113007Z`, rollback 2 `natarot-ga4-7ab08e1-20260928T105805Z`. All ten pre-existing archive references were copied and verified before the standard rotation; final policy counts are 7 daily, 2 weekly and 1 monthly. Unknown `.incoming`, `.failed`, and historical release artifacts were preserved. Disk changed from 9,653,996 to 9,660,692 KiB used (33% both before and after); temporary staging peak was 34%.
- [x] **Step 6: Record and publish the result.** Release evidence and the GA Realtime limitation are recorded in `docs/PROJECT_STATE.md`; stage only the documentation updates, inspect for secrets, commit, and push this branch.

**Execution:** Inline execution is authorized by the owner’s instruction to continue autonomously. No approval checkpoint is required before the release gates pass.
