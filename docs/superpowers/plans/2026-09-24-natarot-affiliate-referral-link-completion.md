# NaTarot Affiliate Referral Link Completion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a stable owner-scoped Affiliate referral code, canonical link, QR, and current-panel actions without changing Affiliate eligibility, attribution, payment verification, commission, or ledger behavior.

**Architecture:** Extend the existing `referral_codes` table with a nullable opaque public token and partial uniqueness constraints. The existing customer dashboard service lazily creates/reuses one canonical dashboard code only for an already-active Affiliate profile under an active policy, then returns a canonical origin-based link and QR data URL through the existing authenticated no-store API. The existing Affiliate panel consumes this response and exposes code/link copy, share, QR preview, and QR download while preserving its current Moonlight/NaTarot composition.

**Tech Stack:** TypeScript, React, Vinext/Vite, Cloudflare D1-shaped SQL, Node `node:sqlite`, Drizzle SQL migrations, WebCrypto, existing `qrcode` package, Node test runner.

**Spec:** `docs/superpowers/specs/2026-09-24-natarot-affiliate-referral-link-completion-design.md`

## Global Constraints

- Preserve existing Affiliate eligibility: only an existing `affiliate_profiles.status = ACTIVE` profile under an active server policy receives a link.
- Preserve existing attribution window, authenticated-only attribution, self-referral rejection, payment verification, commission formula, hold/eligibility/reversal logic, ledger snapshots, and idempotency.
- Do not add anonymous referral cookies or invent a new attribution rule.
- Do not update, delete, rehash, or rewrite existing referral hashes, attributions, conversions, or commission ledger entries.
- Do not auto-enroll ordinary registrations or activate a policy.
- Keep the current Affiliate UI design and scope changes to “LIÊN KẾT GIỚI THIỆU”.
- Run tests and verification before claiming completion; never claim production success without fresh backup, migration compatibility, health, and live QA evidence.

---

### Task 1: Add compatible public-code migration and schema declarations

**Files:**
- Create: `drizzle/0009_affiliate_referral_links.sql`
- Modify: `db/schema.ts:609-624`
- Test: `tests/affiliate-referral-link.test.ts`
- Test: `tests/node-migrate.test.ts` (only if migration inventory assertions require the new file)

**Interfaces:**
- Produces a nullable `referral_codes.public_code` column and two partial unique indexes.
- Preserves existing `code_hash`, `referral_attributions`, `affiliate_conversions`, and `affiliate_commission_ledger` rows byte-for-byte.

- [ ] **Step 1: Write failing migration-preservation tests.** Create an in-memory database using migrations `0000` through `0008`, insert one legacy referral code, attribution, fulfilled conversion, commission entry, and a second profile, then apply `0009`. Assert the old hash and all referenced rows remain unchanged; assert `public_code` is nullable; assert duplicate non-null public codes and duplicate generated active profile codes fail with a unique constraint.

- [ ] **Step 2: Run the focused test to verify it fails.**

Run: `npx tsx --test tests/affiliate-referral-link.test.ts`

Expected: FAIL because `0009_affiliate_referral_links.sql` and `public_code` do not exist.

- [ ] **Step 3: Implement the forward-only migration.** Add:

```sql
ALTER TABLE `referral_codes` ADD COLUMN `public_code` text;
CREATE UNIQUE INDEX `referral_codes_public_code_unique`
  ON `referral_codes` (`public_code`)
  WHERE `public_code` IS NOT NULL;
CREATE UNIQUE INDEX `referral_codes_dashboard_profile_unique`
  ON `referral_codes` (`affiliate_profile_id`)
  WHERE `status` = 'ACTIVE' AND `source` = 'natarot-dashboard-v1';
```

Update the Drizzle declaration with `publicCode: text("public_code")` and do not add any destructive backfill.

- [ ] **Step 4: Run the migration tests.**

Run: `npx tsx --test tests/affiliate-referral-link.test.ts tests/node-migrate.test.ts`

Expected: PASS, including unchanged legacy rows and unique-index behavior.

- [ ] **Step 5: Commit the migration unit.**

```bash
git add drizzle/0009_affiliate_referral_links.sql db/schema.ts tests/affiliate-referral-link.test.ts tests/node-migrate.test.ts
git commit -m "feat: add stable affiliate public referral codes"
```

### Task 2: Implement stable opaque code generation and link/QR projection

**Files:**
- Create: `lib/affiliate/referral-link.ts`
- Modify: `lib/affiliate/customer.ts`
- Modify: `lib/affiliate/types.ts`
- Test: `tests/affiliate-referral-link.test.ts`
- Test: `tests/affiliate-customer-read-model.test.ts`

**Interfaces:**
- `ensureAffiliateReferralLink(database, memberOwnerId, origin, now?)` returns either the unavailable union or `{ available: true; code; url; qrUrl; downloadName }`.
- `getAffiliateCustomerDashboard()` returns the same `referralLink` union.

- [ ] **Step 1: Add failing service tests.** Cover: active profile plus active policy creates one code; two profiles never share a code; repeated calls return the same code/link/QR; code has no member identifiers; inactive profile and missing/inactive policy return unavailable without inserting a row; owner B cannot read owner A’s code; QR data decodes/contains the exact canonical URL; existing hash-only code and attribution rows are unchanged.

- [ ] **Step 2: Run the focused tests to verify failure.**

Run: `npx tsx --test tests/affiliate-referral-link.test.ts tests/affiliate-customer-read-model.test.ts`

Expected: FAIL because the public code service and available response do not exist.

- [ ] **Step 3: Implement the generator and projection.** In `lib/affiliate/referral-link.ts`, generate a random `NTR-`-prefixed token from WebCrypto/`crypto.randomUUID()`, insert it with `source = 'natarot-dashboard-v1'`, `public_code`, and the existing SHA-256 `code_hash`, then re-read the canonical row. Retry boundedly on a collision. Build the URL with `resolvePublicOrigin()` and `URLSearchParams`; generate an SVG QR data URL with the existing `qrcode` dependency and fixed safe rendering options. Query by the authenticated member id and active profile/policy only.

- [ ] **Step 4: Wire the customer dashboard.** Replace the hardcoded unavailable response in `lib/affiliate/customer.ts` with the service result after the existing active-profile and active-policy checks. Keep inactive/no-policy branches explicit and do not call the generator in those branches. Do not expose `code_hash`, internal ids, or other-member rows.

- [ ] **Step 5: Run the focused tests to verify behavior.**

Run: `npx tsx --test tests/affiliate-referral-link.test.ts tests/affiliate-customer-read-model.test.ts tests/affiliate-dashboard-redesign.test.ts`

Expected: PASS with stable, owner-scoped code/link/QR data and unchanged commission tests.

- [ ] **Step 6: Commit the service unit.**

```bash
git add lib/affiliate/referral-link.ts lib/affiliate/customer.ts lib/affiliate/types.ts tests/affiliate-referral-link.test.ts tests/affiliate-customer-read-model.test.ts tests/affiliate-dashboard-redesign.test.ts
git commit -m "feat: expose owner-scoped affiliate referral links"
```

### Task 3: Verify the existing API boundary and QR contract

**Files:**
- Modify: `app/api/affiliate/dashboard/route.ts` only if the existing route needs no-store/type wiring
- Modify: `tests/backend-completion-routes.test.ts`
- Modify: `tests/backend-completion-security-review.test.ts`
- Test: `tests/affiliate-referral-link.test.ts`

**Interfaces:**
- `GET /api/affiliate/dashboard` remains the sole authenticated dashboard endpoint.
- The response remains `Cache-Control: no-store` and is derived from `requireMemberCreditOwner()`.

- [ ] **Step 1: Add failing route assertions.** Assert the dashboard route still uses `requireMemberCreditOwner` and `noStoreResponse`, the response type includes code/link/QR only through the customer projection, no code hash or member contact data is returned, and unauthenticated access remains `401`.

- [ ] **Step 2: Run route/security tests to verify failure.**

Run: `npx tsx --test tests/backend-completion-routes.test.ts tests/backend-completion-security-review.test.ts tests/affiliate-referral-link.test.ts`

Expected: FAIL only on the new referral-link response/security assertions.

- [ ] **Step 3: Make the minimum API adjustment.** Keep the current route structure and pass the existing owner into the updated customer service. Do not add a public code lookup endpoint, query by `member_id` from the client, or accept owner/profile ids in request input.

- [ ] **Step 4: Run the route/security suite.**

Run: `npx tsx --test tests/backend-completion-routes.test.ts tests/backend-completion-security-review.test.ts tests/affiliate-referral-link.test.ts`

Expected: PASS with guest `401`, owner-only data, no-store headers, and no sensitive projection leakage.

- [ ] **Step 5: Commit the API contract unit.**

```bash
git add app/api/affiliate/dashboard/route.ts tests/backend-completion-routes.test.ts tests/backend-completion-security-review.test.ts tests/affiliate-referral-link.test.ts
git commit -m "test: lock affiliate referral API ownership boundary"
```

### Task 4: Complete the current Affiliate referral panel

**Files:**
- Modify: `components/affiliate/affiliate-dashboard.tsx`
- Modify: `app/globals.css` only for scoped referral-panel layout/actions
- Modify: `lib/i18n.ts` for Vietnamese and English referral labels
- Test: `tests/affiliate-dashboard-redesign.test.ts`
- Test: `tests/member-affiliate-ui-v1.test.ts`

**Interfaces:**
- Consumes the dashboard `referralLink` union from Task 2.
- Renders copy, share, QR preview, and download without inventing data or payout actions.

- [ ] **Step 1: Add failing UI contract tests.** Assert the panel references `link.code`, `link.url`, `navigator.clipboard`, `navigator.share` with a fallback, an `<img>`/QR alt label, and an anchor download. Assert unavailable policy/profile states render no fake URL and preserve loading/error/empty semantics.

- [ ] **Step 2: Run the focused UI tests to verify failure.**

Run: `npx tsx --test tests/affiliate-dashboard-redesign.test.ts tests/member-affiliate-ui-v1.test.ts`

Expected: FAIL on the missing code/share/download/QR contracts.

- [ ] **Step 3: Implement the panel behavior.** Preserve existing `ReferralLinkPanel` structure and classes. Add read-only code/link fields, copy feedback, `navigator.share({ title, text, url })` with copy fallback, QR preview, and an accessible download link using `downloadName`. Disable actions when unavailable and show localized status text for copied/shared/error states.

- [ ] **Step 4: Add only scoped styles and translations.** Reuse existing Affiliate colors, borders, spacing, and responsive breakpoints. Add no shell/navigation redesign and no fake commission/payout action.

- [ ] **Step 5: Run UI/build checks.**

Run: `npx tsx --test tests/affiliate-dashboard-redesign.test.ts tests/member-affiliate-ui-v1.test.ts && npx tsc --noEmit && npm run build && git diff --check`

Expected: PASS; the existing repository-wide lint baseline may remain unchanged, but changed Affiliate files must pass targeted ESLint.

- [ ] **Step 6: Commit the UI unit.**

```bash
git add components/affiliate/affiliate-dashboard.tsx app/globals.css lib/i18n.ts tests/affiliate-dashboard-redesign.test.ts tests/member-affiliate-ui-v1.test.ts
git commit -m "feat: complete affiliate referral link panel"
```

### Task 5: Regression, compatibility, and security verification

**Files:**
- Modify: `tests/affiliate-service.test.ts` only for explicit preservation regressions
- Modify: `tests/orders-affiliate-boundary.test.ts` only for pending/failed/redirect safety coverage
- Modify: `docs/PROJECT_STATE.md` with verified implementation and unfinished production gates

- [ ] **Step 1: Run Affiliate and payment-boundary suites.**

Run: `npx tsx --test tests/affiliate-service.test.ts tests/orders-affiliate-boundary.test.ts tests/affiliate-referral-link.test.ts tests/affiliate-customer-read-model.test.ts tests/affiliate-dashboard-redesign.test.ts tests/backend-completion-routes.test.ts tests/backend-completion-security-review.test.ts`

Expected: all focused tests pass; no new commission appears for pending, failed, redirect-only, self-referral, foreign-owner, or duplicate fulfillment cases.

- [ ] **Step 2: Run the full regression and static gates.**

Run: `npx tsx --test tests/*.test.ts`

Expected: all tracked tests pass or any inherited baseline failure is identified by exact file and not attributed to this change.

Run: `npx tsc --noEmit && npm run build && npm audit --omit=dev --audit-level=high && git diff --check`

Expected: TypeScript/build/diff pass and no production dependency vulnerability is introduced.

- [ ] **Step 3: Run targeted lint and staged secret checks.**

Run: `npx eslint lib/affiliate/referral-link.ts lib/affiliate/customer.ts lib/affiliate/types.ts app/api/affiliate/dashboard/route.ts components/affiliate/affiliate-dashboard.tsx tests/affiliate-referral-link.test.ts tests/affiliate-dashboard-redesign.test.ts`

Expected: PASS, with only documented unrelated repository lint debt if the full lint is run.

- [ ] **Step 4: Inspect the staged diff for secrets and unrelated UI changes.** Confirm no `.env`, database, build output, credential, raw referral hash, user contact field, or unrelated route/shell change is staged.

- [ ] **Step 5: Update `docs/PROJECT_STATE.md` with source verification, migration number, test counts, policy behavior, and explicit production status.**

- [ ] **Step 6: Commit the verified source and state update.**

```bash
git add docs/PROJECT_STATE.md tests/affiliate-service.test.ts tests/orders-affiliate-boundary.test.ts
git commit -m "docs: record affiliate referral completion verification"
```

### Task 6: Production backup, migration compatibility, deployment, and QA

**Files/operations:**
- Use: `scripts/production-storage-guard.mjs`
- Use: `deploy/release/natarot-release-manager.sh`
- Use: existing `natarot-vps` SSH alias and production backup/restore services
- Record: `docs/PROJECT_STATE.md` and final Affiliate report

- [ ] **Step 1: Push the verified `codex/` branch and verify local/remote equality.** Do not force-push or rewrite history.

- [ ] **Step 2: Read-only inspect production release, active marker, database counts, migration rows, Affiliate table counts, and current/previous-1/previous-2 release targets.** Save the evidence path before any mutation.

- [ ] **Step 3: Create a fresh production backup and verify archive checksum plus restore-readability/integrity.** Abort before deployment if backup or restore test fails.

- [ ] **Step 4: Run `0009` against an isolated restored database copy and assert legacy referral hash, attribution, conversion, and ledger counts/content remain unchanged.** Abort if any row is rewritten, deleted, or rehashed.

- [ ] **Step 5: Package the clean release, run the candidate build/migration/readiness checks, and atomically promote with the existing release manager.** Keep current plus two rollback releases; do not run release cleanup until the new service and browser checks pass.

- [ ] **Step 6: Verify production health, migration row `0009`, Affiliate routes, guest `401`, public policy state, security headers, and release marker.** Confirm no policy row was activated by deployment.

- [ ] **Step 7: Run production browser QA on `https://natarot.com/affiliate` at desktop and mobile widths.** Verify public inactive-policy state if no active policy exists; with an authorized eligible fixture, verify code, stable link, QR payload, copy, share fallback, download, and owner isolation. Do not invent a fixture or mutate real-money data.

- [ ] **Step 8: Run production commission smoke checks using only existing non-mutating/read-only evidence and controlled synthetic/isolated fixtures.** Confirm pending/failed/redirect-only/test events do not create conversions or ledger entries.

- [ ] **Step 9: Run the existing release-retention cleanup only after deployment success and confirm current + two rollback releases remain.**

- [ ] **Step 10: Update the final report with exact PASS/FAIL/PARTIAL, policy ACTIVE/INACTIVE, customer feature YES/NO, backup/release identifiers, tests, and remaining gates.**

---

## Plan self-review

- Spec coverage: migration compatibility is Task 1; stable generation and owner scope are Task 2; API boundary is Task 3; UI/QR/actions are Task 4; commission/attribution regressions are Task 5; backup/deploy/production policy verification are Task 6.
- Placeholder scan: no `TBD`, `TODO`, or unspecified implementation step remains; all commands and expected outcomes are stated.
- Type consistency: the `AffiliateReferralLink` union is defined in Task 2 and consumed by Tasks 3–4; migration column/index names match Task 1 and the spec.
