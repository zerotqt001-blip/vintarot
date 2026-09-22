# NaTarot Member + Packages + Affiliate Functional UI V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expose NaTarot’s real Member/Packages/Credits/VIP and Affiliate capabilities through usable bilingual customer UI, verify ownership/economic boundaries, deploy the dedicated branch safely to `https://natarot.com`, and complete public/browser smoke without activating real money.

**Architecture:** Extend the existing `/packages`, `/checkout`, `/affiliate`, `/account`, and shared `VinTarot` shell. Add a small read-only Affiliate customer projection and two GET routes; do not add a migration or alter accounting. Keep server catalog prices, order idempotency, verified fulfillment, policy snapshots, and session-derived ownership authoritative.

**Tech Stack:** React 19, TypeScript, Vinext/Vite, Cloudflare D1-compatible SQL, Node SQLite adapter, existing NaTarot i18n and celestial shell, `node:test` through `tsx`, existing VPS atomic deployment tooling.

**Spec:** `docs/superpowers/specs/2026-09-22-natarot-member-affiliate-ui-v1-design.md`

## Global Constraints

- Canonical baseline is immutable tag `baseline-before-skills-2026-09-16`; source baseline for this work is verified production remote HEAD `fc0a9c1fd7ebd2aaa2c0e5dad8bd33ce96bd01a4` on `origin/codex/natarot-production-full-feature-v1`. This branch is its dedicated descendant; it must not be deployed from `main`.
- Preserve Tarot/Spread/Auto Topic/DeepSeek/KB V5/L5/L7/L8/Auth/F-001/Share/Credits/VIP/Affiliate/SePay/RBAC/Audit/backup semantics.
- No schema migration is needed. Do not activate production prices, SePay, payout, Resend, Google OAuth, or real money. Do not expose or copy secrets.
- Use test-first RED → minimal GREEN → focused regression. Commit only verified related files with a secret scan and `git diff --cached --check`.
- Existing 527/527 suite is baseline evidence, not a waiver; run the full suite after changes.

---

### Task 1: Persist the audited spec/plan checkpoint

**Files:**
- Create `docs/superpowers/specs/2026-09-22-natarot-member-affiliate-ui-v1-design.md`.
- Create `docs/superpowers/plans/2026-09-22-natarot-member-affiliate-ui-v1.md`.

- [ ] Run `git diff --check` and a credential-shaped scan over the two documents.
- [ ] Stage only the two documents, inspect the staged diff, and commit `docs: specify member and affiliate functional ui v1`.

### Task 2: Add failing customer read-model and UI contract tests

**Files:**
- Create `tests/affiliate-customer-read-model.test.ts`.
- Create `tests/member-affiliate-ui-v1.test.ts`.

**Tests first:**
- Assert the new Affiliate public/dashboard routes are no-store and owner-gated appropriately.
- Seed active and unpublished policy fixtures and verify public projection hides draft policy, exposes active tiers dynamically, and never returns `code_hash`, raw code, profile/member IDs, payout controls, or private data.
- Verify owner A cannot see owner B’s profile/history/tier state; no-profile and no-policy states are safe.
- Verify package UI source renders API-provided benefit snapshot fields, does not submit authoritative price/currency/commission, preserves checkout return path/idempotency/provider form, and includes loading/empty/error/i18n hooks.
- Verify Affiliate UI source renders dynamic policy/tier/history fields, safe referral-unavailable state, no payout mutation, authenticated access, and localized states.
- Verify shell/account source exposes Membership, Affiliate, Account and keeps the existing primary destinations; CSS includes narrow responsive rules.
- Run the focused tests now; they must fail because the read model/routes/UI contract are not yet present.

### Task 3: Implement read-only Affiliate policy/dashboard routes

**Files:**
- Create `lib/affiliate/customer.ts`.
- Create `app/api/affiliate/policy/route.ts`.
- Create `app/api/affiliate/dashboard/route.ts`.
- Modify `tests/affiliate-customer-read-model.test.ts` as needed only for proven contract details.

**Implementation:**
- Reuse `getActiveAffiliatePolicy`, `selectAffiliateTier`, `utcMonthBounds`,
  `getAffiliateSummary`, and `listAffiliateHistory`.
- Query profile status and current-month non-reversed conversion count by the
  session-derived member owner only.
- Return public tier rate basis points/thresholds only from an active policy; return
  `null` policy when no active policy is effective.
- Return a typed referral-link availability reason rather than trying to recover a
  one-way hashed referral code. Return no payout fields that imply an action.
- Add `noStoreResponse`, `boundary`, and `requireMemberCreditOwner` consistent with
  existing APIs. Use safe generic errors.
- Run the read-model and existing Affiliate/ownership/security suites.
- Commit `feat: expose customer affiliate read models` after verification.

### Task 4: Expand bilingual package/member/checkout UI from real responses

**Files:**
- Modify `app/commerce/commerce-pages.tsx`.
- Modify `lib/i18n.ts`.
- Add/modify `tests/member-affiliate-ui-v1.test.ts` for discovered regressions.

**Implementation:**
- Extend package typing for `benefitSnapshot`, show server-returned credits/VIP and
  safe benefit labels, and calculate unit price only from returned values.
- Add an authenticated member status panel from `/api/account/summary` with actual
  Credits balance, active VIP expiration, entitlement count, and history links.
- Keep logged-out browsing and `/auth?return_to=/checkout?package=...`; keep checkout
  POST body to package ID/idempotency/payment method only and retain unavailable
  provider state.
- Use localized EN/VI copy for loading, empty, error, auth, package, account, and
  provider states. Map unknown API errors to safe localized text.
- Avoid final redesign; use existing functional classes and NaTarot palette.
- Run focused UI tests plus `tests/package-order.test.ts`, `tests/credits-vip-ui.test.ts`,
  `tests/full-feature-navigation.test.ts`.
- Commit `feat: connect member package and credits surfaces`.

### Task 5: Implement Affiliate landing/dashboard and account integration

**Files:**
- Modify `app/commerce/commerce-pages.tsx`.
- Modify `components/account/account-history.tsx`.
- Modify `lib/i18n.ts` if remaining keys are needed.
- Add/modify focused UI tests.

**Implementation:**
- Public `/affiliate` fetches the active policy and explains verified conversion
  semantics; no screenshot percentages or hardcoded tiers.
- Authenticated `/affiliate` consumes the dashboard projection and safely renders
  profile status, qualified progress, tier/next tier, stored summary/history, and
  no-link/no-payout states. Existing owner-scoped account endpoints remain a safe
  compatibility fallback.
- Account renders actual Credits available/reserved/total, VIP entitlement/expiry,
  counts, and links to package/checkout/Affiliate/history without exposing private
  payloads or changing Profile’s protected minimal Credits/VIP surface.
- Commit `feat: build affiliate and account functional surfaces` after focused and
  existing economic/security suites pass.

### Task 6: Make the shared shell routes discoverable and responsive

**Files:**
- Modify `app/vintarot.tsx`.
- Modify `app/globals.css`.
- Modify `lib/i18n.ts`.
- Add/modify navigation/mobile contract tests.

**Implementation:**
- Add labeled Membership, Affiliate, and Account links in the existing shell without
  deleting Home, Guidebook/Tarot, Room/Create, Auth, Share, or personal links.
- Keep the existing mobile bottom nav and use a compact commerce link group where it
  fits; add focus/hover and reduced-motion-safe styles.
- Ensure functional cards, comparison/history rows, and affiliate tables/cards do not
  overflow at 375/390/412/tablet/desktop widths.
- Commit `feat: expose member routes in natarot navigation` after navigation tests.

### Task 7: Full local verification and production release preparation

**Commands/evidence:**
- [ ] Run focused suites, then `npx tsx --test tests/*.test.ts` and record the new total.
- [ ] Run `npx tsc --noEmit`, `npm run build`, targeted ESLint on changed TS/TSX, `npm audit --omit=dev`, `git diff --check`, and secret-shaped scans.
- [ ] Inspect staged diff for secrets and protected-zone semantic changes.
- [ ] Fetch/push `codex/natarot-member-affiliate-ui-v1` and verify local HEAD equals remote HEAD.
- [ ] Read the existing production backup/deploy tooling and take a fresh backup before any production action. Verify DB integrity, archive/checksum, and restore readability; do not migrate because this milestone is additive source/UI only.

### Task 8: Atomic production deploy, live smoke, browser QA, and handoff

**Gate:** Owner authorization in the brief covers deployment. Stop only for OTP/2FA/CAPTCHA, a genuinely missing credential, destructive DB operation, real-money action, irreconcilable conflict, or broken production that cannot be safely recovered.

- [ ] Build the verified commit, use the existing atomic/reversible release procedure,
  preserve `/etc` secrets and DeepSeek configuration, and do not restart/migrate any
  unrelated service.
- [ ] Poll readiness and verify health, home, `/packages`, `/affiliate`, `/account`,
  `/checkout`, `/api/packages`, public policy, unauthenticated dashboard protection,
  and critical existing APIs.
- [ ] Use browser QA on desktop and 390px mobile for logged-out membership/packages,
  Affiliate landing, Account, checkout/unavailable state, and any approved synthetic
  member/affiliate fixture. Never use real payment.
- [ ] If unhealthy, diagnose and redeploy or use the retained rollback tree; never
  leave production on a partial release.
- [ ] Update `docs/PROJECT_STATE.md` with branch/commit, tests/build/audit, backup,
  deployment, browser results, external gates, and unfinished work.
- [ ] Commit the project-state/report checkpoint, push, verify remote equality, and
  report exact owner routes and the requested PASS/FAIL/EXTERNAL_GATE matrix.
