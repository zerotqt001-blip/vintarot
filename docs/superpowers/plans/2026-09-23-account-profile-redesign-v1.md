# NaTarot Account/Profile Redesign V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the functional `/account` history screen with the owner-approved Moonlight/NaTarot member dashboard from Image 1, using only authenticated member data and existing route/API truth.

**Architecture:** Keep Auth, Credits/VIP, orders/SePay, affiliate policy, Tarot ownership, and RBAC semantics frozen. Add a scoped account shell variant in `VinTarot`, a real-data `AccountDashboard` client surface, a safe order-package projection in the existing account-history read model, and account-specific responsive CSS. The dashboard composes existing owner-scoped APIs instead of adding a second account authority.

**Tech Stack:** React 19 + TypeScript, Vinext/Vite, `lucide-react`, existing `LanguageProvider`, D1-shaped SQLite read models, `tsx --test`, Node 22, local browser screenshots.

**Spec:** `docs/superpowers/specs/2026-09-23-account-profile-redesign-v1-design.md`

## Global constraints

- Base is the clean production-feature release branch `origin/codex/natarot-production-full-feature-v1` at `fc0a9c1`; keep work on `codex/account-redesign-v1`.
- Do not copy the dirty original checkout's Home/Practice edits into this branch, and do not reset or overwrite user-owned files in the original worktree.
- Preserve the Moonlight reference, NaTarot branding, existing font/logo assets, and all frozen product semantics.
- Never fabricate member values, transactions, saved readings, package names, security capabilities, or affiliate meaning. Loading/error/empty states must be explicit.
- Do not expose Tarot payloads, auth secrets, request fingerprints, raw package snapshots, provider payloads, or admin controls to the member UI.
- No real payment, order creation, owner QA mutation, production DB mutation, force push, or destructive rollback operation.
- Every implementation feature starts with a failing focused test, then the smallest implementation, then a green focused test.
- Use `apply_patch` for source/doc edits. Run `git diff --check` and staged secret inspection before each related commit.

## Task 1: Preserve historical order truth in the account read model (TDD)

**Files:**
- Modify: `tests/account-history.test.ts`
- Modify: `lib/account-history.ts`

**Interfaces:**
- `AccountHistoryItem` gains an optional safe `package` projection for order rows: localized name, slug, immutable version, Credit units, and VIP duration.
- The SQL union selects `orders.package_snapshot` only for owner-scoped order rows; all other rows continue to return null.
- Malformed or legacy snapshots remain valid history rows with `package: undefined` and no private raw snapshot leakage.

- [ ] Add a fixture with a valid immutable package snapshot and assertions that the order item exposes only the safe fields.
- [ ] Add an assertion that malformed/legacy snapshot data is omitted and the serialized response contains no raw snapshot/fingerprint.
- [ ] Run `npx tsx --test tests/account-history.test.ts`; confirm the new assertion fails before implementation.
- [ ] Implement a defensive parser and extend the SQL/mapping with no changes to order ownership or payment state.
- [ ] Run the focused account-history suite and the existing order/affiliate/security suites.

## Task 2: Account shell navigation contract (TDD)

**Files:**
- Create: `tests/account-dashboard-shell.test.ts`
- Modify: `app/vintarot.tsx`

**Interfaces:**
- `/account` selects an `.account-shell` variant with target top navigation, five-item member rail, account footer, active states, local theme state, and no old `+ Phòng`/personal-nav/ticker UI.
- Existing shells retain their current path classification and behavior.
- Header shortcuts use existing routes: guidebook for search, saved journal for favorites, profile/account for member actions, and `/auth?return_to=/account` when logged out.

- [ ] Write source-contract tests for the account class, target five routes, active account state, removal of `+ Phòng` from the account variant, and preservation of non-account shell branches.
- [ ] Run the focused shell test and confirm it fails on the current generic shell.
- [ ] Implement the smallest account-specific JSX/state branch, using the existing `Logo`, `LanguageSelect`, `Sidebar`, and `lucide-react` primitives.
- [ ] Run the focused shell test plus Home/Practice/Daily/Room shell tests; fix only regressions caused by the branch.

## Task 3: Account dashboard data and interaction surface (TDD)

**Files:**
- Create: `tests/account-dashboard.test.ts`
- Create: `components/account/account-dashboard.tsx`
- Modify: `app/account/page.tsx`

**Interfaces:**
- `AccountDashboard` consumes `/api/account/summary`, `/api/account/history?kind=orders&limit=6`, and `/api/tarot/saved-readings` with same-origin credentials and `cache: no-store`.
- The UI renders member name/username, member-since, Credit balance, active VIP state/end date, saved-reading count/items, affiliate conversion count, safe order rows, quick-access routes, profile/security destinations, and canonical logout.
- The existing `AccountHistory` component is replaced at `/account`; its API remains available and owner-scoped.
- The unauthenticated state preserves the existing sign-in return path.

- [ ] Write pure view-model tests for display-name fallback, VIP state/expiry copy, safe package localization, order status copy, date/currency formatting, and saved-reading card metadata without leaking private reading text.
- [ ] Write source-contract tests for all three API reads, no demo values, `/api/auth/logout` POST, existing CTA routes, loading/error/empty states, and removal of the admin CTA.
- [ ] Run the focused dashboard tests and confirm they fail because the dashboard module does not yet exist.
- [ ] Implement small formatting/view-model helpers and the client component; keep server data shape local and explicit.
- [ ] Add real saved-reading cards with card image alt text, question/spread/date metadata, and `/journal?tab=saved` recovery when no detail route is present.
- [ ] Add mobile-safe transaction cards while keeping package/version/quantity/price/status from server data.
- [ ] Run focused component/source tests and the relevant auth/account/reading suites.

## Task 4: i18n, visual system, and responsive behavior (TDD)

**Files:**
- Modify: `lib/i18n.ts`
- Modify: `app/globals.css`
- Modify: `tests/account-dashboard-visual-contract.test.ts`

**Interfaces:**
- New account copy exists in both `messages.en.account` and `messages.vi.account`; UI uses `t()` rather than hard-coded user-facing copy where the existing provider applies.
- `.account-shell` styles are scoped, use existing fonts/assets, and implement 1440/1280/1024/768/412/390/375 layouts without horizontal overflow.
- Background art is `public/room/celestial-observatory.png` with a readable overlay; no new asset or fake social destination is introduced.

- [ ] Add failing source/style assertions for scoped account selectors, target background asset, mobile reflow/transaction cards, focus states, reduced-motion behavior, and both locale message trees.
- [ ] Run the focused visual contract test and verify it fails before the CSS/message work.
- [ ] Implement account tokens/layout/surfaces/interactive states and responsive breakpoints; read `craft-floor.md` immediately before the first UI edit and honor its contrast/depth/type/state checks.
- [ ] Run the visual contract test and targeted TypeScript/tests; inspect copy wrapping and focus styles at the required widths.

## Task 5: Verification and visual QA

**Files:**
- Modify: `docs/PROJECT_STATE.md`
- Create outside Git: local QA screenshots under a temporary evidence directory only

- [ ] Start the app from the isolated worktree and verify unauthenticated `/account`, authenticated owner-fixture `/account`, `/profile`, `/packages`, `/affiliate`, `/journal?tab=saved`, and logout behavior.
- [ ] Capture at least one desktop and one mobile screenshot with real local fixture data; inspect for overflow, hierarchy, contrast, loading/error/empty states, and CTA reachability.
- [ ] Run the bounded visual iteration pass; attempt `impeccable detect --json` using the available launcher and record fallback if the launcher remains unavailable.
- [ ] Run targeted tests, all tracked tests, typecheck/build, `git diff --check`, secret scan, and dependency/build checks. Classify the known baseline Home test separately if it remains inherited.
- [ ] Request independent code review against `fc0a9c1`; resolve Critical/High findings with new regression tests.
- [ ] Update `docs/PROJECT_STATE.md` with source commit, validation, screenshot evidence, and explicit deployment blocker/status.

## Task 6: Commit and deployment boundary

- [ ] Inspect the complete staged diff for unrelated files and secrets.
- [ ] Commit coherent documentation, read-model, shell, dashboard, i18n, CSS, tests, and state changes on `codex/account-redesign-v1`.
- [ ] Push normally only if the configured GitHub origin accepts the branch; report any push failure.
- [ ] Check the saved deployment authority once after local verification. If SSH/production access is unavailable, stop at a verified local commit and report `NOT DEPLOYED` with the exact blocker; never claim a production URL or health check that was not observed.

## Rollback and stop conditions

- Preserve the previous source commit and production deployment; rollback means selecting the prior commit/release, not rewriting history.
- Stop and report a human gate for missing SSH/provider credentials, OTP/2FA/CAPTCHA/device approval, real-money/payment identity operations, destructive DB/Git actions, or any request to weaken owner-scope/security invariants.
