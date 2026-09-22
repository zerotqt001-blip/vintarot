# NaTarot Packages Redesign V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace only the NaTarot `/packages` presentation with the owner-approved Image 1 experience while preserving server-authoritative package, Credit, checkout, payment, Affiliate, and expiration semantics.

**Architecture:** Add a `/packages`-scoped membership shell variant to the existing `VinTarot` shell, then replace only the `PackagesPage` presentation layer with semantic hero, balance, package-card, journey, VIP, Affiliate, trust, and footer sections. The package page will continue fetching `/api/packages` and `/api/account/summary`; every purchase CTA will keep using the existing checkout route.

**Tech Stack:** React 19, TypeScript, Vinext/Vite, existing NaTarot i18n, Lucide icons, CSS, `node:test` through `tsx`, local Wrangler preview, and the existing VPS atomic deployment workflow.

**Spec:** `docs/superpowers/specs/2026-09-23-natarot-packages-redesign-v1-design.md`

## Global Constraints

- Image 1 is the approved target; Image 2 is the old UI and must not be copied back.
- The server catalog remains authoritative for package ID, quantity, amount, currency, availability, and validity.
- Preserve 30-day Credit validity from verified payment fulfillment time; do not calculate or change expiry in the frontend/backend.
- Do not modify SePay, IPN, order state, amount matching, idempotency, fulfillment, Credit ledger/lots, Affiliate accounting, Auth, or database schema.
- Modify only the Packages route/presentation and the shared-shell branch required to render its approved header/sidebar; leave Home, Guidebook, Practice, Room, Account, Affiliate, Admin, and checkout behavior intact.
- Use existing NaTarot typography/assets/icons; no new heavy dependency or generated raster is needed.
- Follow TDD: write a failing UI contract test, observe the expected failure, implement minimally, then run focused and full verification.
- Do not use real money or mark a payment fulfilled during QA.

---

### Task 1: Capture the failing Packages redesign contract

**Files:**
- Create: `tests/packages-redesign.test.ts`
- Read: `docs/superpowers/specs/2026-09-23-natarot-packages-redesign-v1-design.md`

- [ ] Add source contracts for the membership shell variant, exact Packages destinations, approved section classes/copy keys, server catalog fetch, account balance fetch, 1/5/10/20 presentation ordering, 30-day disclosure from `benefitSnapshot`, existing checkout CTA, Affiliate route, and removed comparison/VIP-not-included structure.
- [ ] Run `npx tsx --test tests/packages-redesign.test.ts` and confirm it fails because the target classes/section structure are not implemented yet.

### Task 2: Add the Packages-only approved shell variant

**Files:**
- Modify: `app/vintarot.tsx`
- Modify: `lib/i18n.ts` only for new shell copy
- Test: `tests/packages-redesign.test.ts`

- [ ] Add `isMembership` for `/packages` and keep the existing shell branches unchanged for every other route.
- [ ] Render the Image 1 header destinations, icon controls with accessible labels, LanguageSelect, theme toggle, account link, and exactly the five requested sidebar entries with the Membership entry active.
- [ ] Replace only the Packages footer presentation with NaTarot branding, tagline, policy links, and social icon labels; do not render `+ Phòng`, the old personal sidebar, the old commerce toolbar, or the ticker on `/packages`.
- [ ] Keep all links real: Home `/`, Guidebook `/guidebook`, Practice `/community`, Book `/book`, Draw `/room`, Membership `/packages`, Affiliate `/affiliate`, Account `/account`.

### Task 3: Replace only the Packages page presentation

**Files:**
- Modify: `app/commerce/commerce-pages.tsx`
- Modify: `lib/i18n.ts`
- Test: `tests/packages-redesign.test.ts`

- [ ] Preserve the current `PackagesPage` API fetch/loading/error/empty/authenticated-summary behavior and the existing checkout navigation.
- [ ] Sort the presentation copy by returned credit quantity without rewriting package IDs or amounts; render server amount/currency and derive unit price from returned values.
- [ ] Derive the validity label from returned Credit expiry seconds and omit the old VIP-not-included row; show only truthful customer-facing Credit benefits.
- [ ] Render the balance widget from the account read model with a sign-in/loading/error state instead of a fabricated guest balance.
- [ ] Add the one-Credit journey, VIP coming-soon panel with no purchase action, Affiliate promotion, and verified-payment trust strip using i18n keys.
- [ ] Remove the old comparison panel and implementation-oriented copy from the Packages render path without deleting underlying routes or APIs.

### Task 4: Implement the Image 1 responsive visual system

**Files:**
- Modify: `app/globals.css`
- Test: `tests/packages-redesign.test.ts`

- [ ] Add isolated `.membership-shell` and `.membership-page` rules for background art/vignette, header/sidebar/footer, hero, balance widget, package cards, Popular emphasis, journey, VIP, Affiliate, trust strip, focus, and reduced motion.
- [ ] Verify the composition at desktop, tablet, and 375/390/412 widths: four cards on wide screens, 2×2 at medium widths, one column on mobile, no horizontal overflow, tap-sized CTAs, and no badge/price/English-copy clipping.

### Task 5: Run the closed-loop local visual and functional QA

**Commands/evidence:**

- [ ] Run the focused package/UI/catalog/order/Credit/Affiliate/Auth/navigation suites and the new red-green test.
- [ ] Run `npx tsc --noEmit`, `npm run build`, changed-file ESLint, `git diff --check`, a secret-shaped scan, and `npm audit --omit=dev`.
- [ ] Run the real app in a local production preview, capture desktop and 390px screenshots, compare them against Image 1, fix material mismatches once, and recapture.
- [ ] Verify package values/order, actual authenticated balance, 30-day disclosure, checkout links, Affiliate CTA, shell links, English/Vietnamese, theme toggle, focus states, and no real payment.

### Task 6: Commit, back up, deploy, and verify production

**Files:**
- Modify: `docs/PROJECT_STATE.md`

- [ ] Inspect the staged diff for secrets and protected payment/ledger changes, commit only related files, push `codex/natarot-packages-redesign`, and verify remote equality.
- [ ] Confirm no newer production deployment superseded the audited `e4db7d2…` baseline; take and verify a fresh SQLite backup/checksum/restore readability before switching releases.
- [ ] Build and deploy atomically using the existing reversible VPS procedure, preserve `/etc/natarot.env`, restart only `natarot.service`, and retain rollback readiness.
- [ ] Verify production HTTP/API smoke, fresh-browser desktop, and 375/390/412 mobile acceptance for `/packages`, plus Home/Guidebook/Practice/Room/Account/Affiliate/Admin health and checkout/IPN protection without payment.
- [ ] Record exact branch, source/deployed commits, backup/rollback IDs, screenshots, test totals, and any external gates in `docs/PROJECT_STATE.md`; commit and push the checkpoint.
