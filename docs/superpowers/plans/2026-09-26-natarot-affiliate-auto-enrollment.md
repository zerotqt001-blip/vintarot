# NaTarot Affiliate Auto Enrollment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Automatically enroll each valid verified member in the existing Affiliate system, provide a stable code/link/QR, preserve referral context through registration, and expose owner-scoped member and Admin views without changing commission terms.

**Architecture:** Extend the existing `affiliate_profiles`, `referral_codes`, `referral_attributions`, and commission services. Enroll from verified Auth lifecycle paths and an idempotent production backfill; use a first-party opaque cookie key for anonymous first-touch attribution and claim it for the member after registration or login. Keep conversion creation behind the active policy and verified fulfillment boundary.

**Tech Stack:** Next/Vinext, TypeScript, Cloudflare D1-compatible database interface, SQLite `node:sqlite` operator script, Node test runner via `tsx`, existing `qrcode` package, React and NaTarot i18n.

**Spec:** The user-provided task brief; existing Affiliate design: `docs/superpowers/specs/2026-09-24-natarot-affiliate-referral-link-completion-design.md`.

## Global Constraints

- Preserve the Moonlight reference and current NaTarot branding; do not replace the live UI V2 or other deployed surfaces.
- Reuse the canonical Affiliate schema, policies, attribution, commission ledger, and Admin permissions; do not add a parallel Affiliate system.
- Preserve existing codes, referral ownership, attribution windows, commission eligibility, holds, reversals, idempotency, and audit history.
- Never enroll unverified or disabled members; never reactivate a `SUSPENDED` Affiliate profile or a disabled member.
- Keep referral cookies first-party, opaque, `HttpOnly`, `SameSite=Lax`, `Secure` on HTTPS, and free of PII; add no third-party tracking.
- Do not activate or modify the DRAFT production policy, its 30-day attribution window, 7-day hold, or tier rates without owner approval.
- Do not create commissions from client redirects, pending/failed orders, duplicate payment events, or unverified fulfillment; do not move real money.
- Do not modify production records until a fresh database backup and restore verification pass. Use the managed atomic release and retention tooling.

---

### Task 1: Idempotent enrollment and existing-member backfill

**Files:**
- Create: `lib/affiliate/enrollment.ts`
- Modify: `lib/affiliate/referral-link.ts`
- Create: `scripts/backfill-affiliate-enrollment.ts`
- Test: `tests/affiliate-auto-enrollment.test.ts`
- Test: `tests/affiliate-referral-link.test.ts`

**Interfaces:**
- `ensureAffiliateEnrollment({ database, memberId, now? })` checks `members.email_verified_at`, `members.disabled`, and `members.disabled_at`, preserves `SUSPENDED`, activates only an eligible `INACTIVE` profile, creates at most one profile, and ensures the existing canonical public code.
- `backfillAffiliateEnrollment({ database, now? })` scans only verified, enabled members and returns aggregate counts without member IDs or referral codes.
- `ensureAffiliateReferralLink(...)` returns an existing or newly created code for an active profile even while the public commission policy is pending; the customer projection still omits policy rates and commission terms.

- [x] Add service tests for new eligible member, two repeated runs, unique codes for different members, existing code stability, suspended-profile preservation, disabled-member skip, and unverified-member skip.
- [x] Run `npx tsx --test tests/affiliate-auto-enrollment.test.ts tests/affiliate-referral-link.test.ts` and confirm the new enrollment tests fail for the missing behavior.
- [x] Implement race-safe `INSERT OR IGNORE` profile/code creation using the existing unique indexes and Web Crypto code generator. Never update `code_hash`, `public_code`, or an existing profile's `SUSPENDED` status.
- [x] Add a backfill function that selects verified members with `disabled=0 AND disabled_at IS NULL`, processes each through the same enrollment function, and emits only totals.
- [x] Add a production-only Node SQLite entry point fixed to `/var/lib/natarot/natarot.sqlite`; print totals only and reject any other database path.
- [x] Re-run the focused tests and verify idempotency and profile/code uniqueness.

### Task 2: Auth lifecycle enrollment and first-touch attribution

**Files:**
- Modify: `lib/affiliate/policy.ts`
- Modify: `lib/affiliate/service.ts`
- Create: `lib/affiliate/anonymous-attribution.ts`
- Modify: `app/api/affiliate/attribute/route.ts`
- Modify: `components/affiliate/referral-capture.tsx` only if the API response contract requires it
- Modify: `lib/auth-handlers.ts`
- Test: `tests/affiliate-auto-enrollment.test.ts`
- Test: `tests/auth-handlers.test.ts`

**Interfaces:**
- `getAffiliateAttributionWindow(database, now)` uses the active policy window only. While policy is pending, referral links remain available, but attribution capture returns `no_policy` and stores no commission-bearing referral record.
- `captureAttribution({ database, owner, rawCode, source?, now? })` accepts the existing member or anonymous owner, keeps the current insert-only first-touch rule, and returns the stored expiry.
- `claimGuestReferralAttribution({ database, memberId, guestOwnerId, now? })` moves only an unclaimed anonymous attribution to a member with no existing attribution, rejects self-referral and expired context, and leaves an existing member referral untouched.
- `AFFILIATE_GUEST_COOKIE_NAME` stores a random opaque owner key with an expiry bounded by the attribution record; it contains no code, user ID, email, or other PII.

- [x] Write tests for anonymous first touch, cookie reuse across repeated links, exact configured-window expiry, registration claim, existing-member attribution precedence, self-referral rejection, expired context, and no code/cookie PII.
- [x] Run the focused Affiliate/Auth tests and confirm they fail on the absent anonymous capture/claim and lifecycle calls.
- [x] Update the capture API to derive the current member owner or a random anonymous owner, capture through the existing attribution table, and set/clear the opaque first-party cookie without recording arbitrary cookie data.
- [x] Call enrollment after email verification, successful login, Google member completion, and existing Google sign-in. Claim anonymous attribution after registration mail delivery succeeds, verification, login, and Google completion; do not claim when a registration is rolled back.
- [x] Preserve active-policy-only commission creation and the stored first-touch `expires_at`; DRAFT policy state must never create a conversion or expose commission rates.
- [x] Re-run the focused tests and verify no existing member attribution can be replaced by a new code.

While the policy is DRAFT, clicks are not persisted as attributions. A separate explicitly noncommissionable event model would be required to count pending-period referrals safely.

### Task 3: Owner-scoped dashboard and Account access

**Files:**
- Modify: `lib/affiliate/customer.ts`
- Modify: `components/affiliate/affiliate-dashboard.tsx`
- Modify: `components/account/account-history.tsx`
- Modify: `lib/i18n.ts`
- Modify: `app/globals.css`
- Test: `tests/affiliate-customer-read-model.test.ts`
- Test: `tests/member-affiliate-ui-v1.test.ts`
- Test: `tests/affiliate-dashboard-redesign.test.ts`

**Interfaces:**
- Extend the customer dashboard with verified, enabled referral count and a bounded signup timeline containing only opaque attribution ID, signup time, and a safe state; do not return referred-member IDs, PII, code hashes, or ledger internals.
- Keep existing ledger-derived income and conversion history owner-scoped. Display zero when the canonical ledger has no income and no currency is available; display no invented policy rate or tier.
- Add an Account Affiliate card that fetches `/api/affiliate/dashboard`, displays the server-provided code/link, supports copy, and links to `/affiliate`; do not add a second enrollment action.

- [x] Add read-model tests for referral count/history, disabled/unverified referrals, owner isolation, policy-pending zero state, and absent profile auto-enrollment through the authenticated dashboard path.
- [x] Add UI contract tests for policy-pending member dashboard, visible stable code/link/QR, download/share actions, copy feedback, Account card, and localized empty/error states.
- [x] Run the focused read-model/UI tests and verify the new cases fail before implementation.
- [x] Show the existing referral code, production-domain link, QR download and Web Share action when the profile is active even if the policy is pending; show an honest pending-policy message and zero or empty income without exposing DRAFT rates.
- [x] Add verified referral signups/count to the existing customer dashboard and Account quick-access area. Keep the current NaTarot/Moonlight shell, existing section hierarchy, and desktop/mobile navigation.
- [x] Add Vietnamese and English labels and responsive styles using the existing affiliate/account tokens.
- [x] Re-run focused tests and inspect the authenticated dashboard at desktop width and the affiliate shell at 390px; responsive and accessible-action contracts also pass in tests.

### Task 4: Admin referral inspection and suspension regression

**Files:**
- Modify: `lib/affiliate/service.ts`
- Modify: `app/api/admin/affiliate/route.ts` only if response validation changes
- Modify: `app/admin/admin-console.tsx`
- Test: `tests/affiliate-service.test.ts`
- Test: `tests/admin-control-center.test.ts`
- Test: `tests/admin-functional-ui.test.ts`

**Interfaces:**
- Extend `listAdminAffiliateReadModel` with bounded referral attributions showing internal referrer/referred member IDs and timestamps only to callers already authorized by `admin.affiliate.read`; never return raw referral codes or hashes.
- Keep existing `profile_status` mutations, server-side permission checks, reason/idempotency validation, and audit history.

- [x] Add Admin read-model tests for an attributed member, anonymous context omission, bounded results, no code/hash/PII exposure, and foreign-role denial.
- [x] Add a suspension regression proving a `SUSPENDED` profile receives no new referral attribution or commission and remains suspended after enrollment/backfill reruns.
- [x] Run focused Affiliate/Admin tests and confirm new assertions fail on the missing attribution read model.
- [x] Render an Admin referral-attribution table using the existing control-center table style and show that suspension/status changes remain audited.
- [x] Re-run focused Admin/Affiliate tests and verify the canonical commission ledger and audit rows are unchanged by enrollment.

### Task 5: Full regression, release, backfill, and production QA

**Files:**
- Update: `docs/PROJECT_STATE.md`
- Update test assertions only if the current production-source baseline failure is proven stale against deployed behavior; preserve each test's intent and do not delete or loosen coverage.

- [x] Capture the pre-edit full-suite state: baseline was 647 pass and 11 older UI/migration failures; compare the exact failure names after implementation.
- [x] Run the full suite, `npx tsc --noEmit`, `npm run build`, targeted ESLint for changed files, `git diff --check`, and confirm no schema migration is required.
- [x] Verify commission-boundary tests for pending/failed/redirect/duplicate/refunded events still pass; do not run a bank transaction.
- [x] Push the verified `codex/affiliate-auto-enrollment` branch.
- [x] Run production storage and backup/restore verification immediately before mutation. Preserve unclassified paths and report the cleanup gate instead of deleting them.
- [x] Deploy with the managed atomic release manager, apply no schema migration, then run the production-only idempotent backfill and verify aggregate profile/code counts.
- [x] Verify health, policy `null`, guest dashboard `401`, login/register/account routes, referral URL route, visible QR control, Admin guest boundary `401`, and commission boundary (`no_policy`). Do not create a real payment or send a test email to an unapproved recipient.
- [x] Retain `current`, `previous-1`, and `previous-2`; release-manager cleanup remains deferred while storage-audit paths remain unclassified.
- [x] Record the production policy as inactive; attribution and commission capture remain gated on approved terms and an approval audit.

---

## Self-review

- Coverage: enrollment and backfill are Task 1; Auth lifecycle and anonymous attribution are Task 2; QR/link/dashboard/Account are Task 3; Admin/suspension/audit are Task 4; regression and controlled production release are Task 5.
- No schema migration is assumed: the deployed source already has `public_code`, unique profile/code constraints, and owner-bound `referral_attributions`.
- Financial logic remains behind `getActiveAffiliatePolicy` and stored fulfilled-order verification; the DRAFT policy's rates are not projected to members or activated by this plan.
- The plan preserves the known 11 pre-existing failing source-contract tests as a measured baseline; any maintenance must retain equivalent intent and assertions.
