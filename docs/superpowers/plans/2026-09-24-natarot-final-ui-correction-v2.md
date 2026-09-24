# NaTarot Final UI Correction V2 Implementation Plan

> **For agentic workers:** Use the executing-plans skill to implement this plan task-by-task with verification checkpoints. No subagent-dispatch tool is available in this session; execution remains in the current isolated worktree.

**Goal:** Correct the six NaTarot production surfaces to the owner-provided target hierarchy while preserving the canonical shared shell, real backend data, Tarot behavior, and account/payment/security boundaries.

**Architecture:** Refine the existing `components/shell` components and semantic styles rather than adding a parallel shell. Keep route ownership and server data contracts intact; make the Reading Result question, dynamic spread, and primary interpretation the editorial center, with secondary controls and follow-up progressively quieter.

**Tech Stack:** React/TypeScript, Next-compatible Vinext runtime, shared CSS in `app/globals.css`, Node test runner via `tsx`, existing CUA browser for visual QA.

**Spec:** Owner request in `/Users/tranquangthanh/.codex/attachments/685c8885-7082-4889-9771-dfd70d57a6ff/Văn bản đã dán.txt`; pre-edit target/current and data audit in `docs/reports/natarot-final-ui-correction-v2-audit.md`.

## Global Constraints

- The six supplied screenshots define visual design; backend/configuration defines business data.
- Reuse, correct, consolidate, and remove only proven-dead UI; do not create V2/Final duplicate components or parallel responsive systems.
- Maintain the three-level surface hierarchy and selective antique/champagne-gold emphasis.
- Decoration intensity follows purpose: high for Library/Practice/spread, medium for Packages, low for Affiliate/Account/result prose.
- Preserve real package values, 30-day Credits validity, Affiliate policy/ledger behavior, owner-scoped Account reads, Auth/F-001, SePay, reading persistence, dynamic spread geometry, Share/QR, and L7/L8 follow-up/clarification.
- Do not synthesize member data or use screenshot values as production truth; do not bypass authentication, buy Credits, or fake payments.
- Verify the completed result with responsive browser captures and all 1/3/4/5/10-card layouts; mobile must not shrink a complex spread into unreadability.
- Run focused and full tests, TypeScript, production build, changed-file lint, and `git diff --check`; do not expand unrelated lint cleanup.
- Production deployment is authorized only after current-release, fresh-backup, integrity, rollback, disk, release-retention and browser gates pass. Current read-only SSH access is denied, so no remote mutation is allowed unless access becomes available and all checks can be independently verified.

## Files and boundaries

- `components/shell/natarot-header.tsx`: one shared top-level navigation and one consistent set/order of utility controls, preserving localized labels and working destinations.
- `components/shell/natarot-sidebar.tsx`: one accessible canonical five-destination rail for the six target surfaces; use readable labels under icons and retain mobile navigation behavior.
- `components/shell/natarot-footer.tsx`: shared quiet footer for target routes; retain a Home-only composition if needed to protect the existing Home design, but remove the generic moving marquee from product pages.
- `components/shell/natarot-shell.tsx`: route-to-variant composition, reading result shell consistency, and shared decoration intensity hooks; no duplicate shell or page implementation.
- `components/reading/reading-panel.tsx`, `reading-header.tsx`, `direct-answer.tsx`, `personal-insights.tsx`, `next-steps.tsx`, `follow-up-reading.tsx`, and `reading-spread.tsx`: semantic hierarchy and progressive disclosure only; no prompt, payload, persistence, card-order, or geometry changes.
- `app/pages.tsx`, `app/commerce/commerce-pages.tsx`, `components/affiliate/affiliate-dashboard.tsx`, and `components/account/account-history.tsx`: adjust presentation only if the shared surface cannot achieve the target hierarchy; preserve all API reads, empty states, CTA handlers, and owner boundaries.
- `app/globals.css`: consolidate the existing shared and route-variant styles into consistent header/rail/footer, semantic surface levels, and page-specific atmosphere; edit existing rules instead of appending a second CSS universe.
- `tests/natarot-final-ui-correction-v2.test.ts`: focused regressions for shared shell semantics, reading hierarchy, dynamic spread contracts, and real-data source boundaries. Keep existing V1, commerce, affiliate, account, spread, and auth tests intact.
- `docs/reports/natarot-final-ui-correction-v2-audit.md` and `docs/PROJECT_STATE.md`: preserve the target/current findings and record only verified implementation, test, screenshot, and deployment facts.

### Task 1: Canonical shared shell and restraint tokens

**Files:**
- Modify: `components/shell/natarot-header.tsx`
- Modify: `components/shell/natarot-sidebar.tsx`
- Modify: `components/shell/natarot-footer.tsx`
- Modify: `components/shell/natarot-shell.tsx`
- Modify: `app/globals.css`
- Create: `tests/natarot-final-ui-correction-v2.test.ts`

**Interfaces:**
- The shell continues to receive `path`, authenticated `user`, and localized `t`; its existing modal, language, theme, search, and route handlers remain the only interaction owners.
- The primary desktop links are `/`, `/guidebook`, `/community`, and `/book`; commercial/member links remain reachable from the shared rail at `/create`, `/packages`, `/affiliate`, and `/account`.

- [x] **Step 1: Add failing shared-shell contract tests.** Assert all four top-level destinations are present in the canonical header; assert Library/Practice/Packages/Affiliate/Account use the shared header/sidebar/footer components once; assert rail links retain accessible text and `aria-current` only for the actual route; assert target product footers do not render the moving marquee; assert shared surface variables and responsive breakpoints exist.
- [x] **Step 2: Run the focused test and confirm the expected red.** Run `npx tsx --test tests/natarot-final-ui-correction-v2.test.ts`; the new expectations should fail on the per-variant header/sidebar/footer markup, arc-only labels, or missing V2 surface roles—not on syntax or test setup.
- [x] **Step 3: Consolidate existing shell markup.** Render one semantic header/navigation/action structure, one five-link rail with labels below icons, and one quiet footer for the six target routes. Keep working link destinations and modal/language/theme/account behavior; do not introduce new state or routes.
- [x] **Step 4: Apply the global visual hierarchy.** Define/reuse three semantic surface strengths in `app/globals.css`; reduce rail dominance by adjusting its existing width/item spacing; make selected/primary gold distinct from secondary panel borders; assign background intensity by the existing route variant; keep focus, contrast, and mobile navigation intact.
- [x] **Step 5: Re-run shell, V1 fidelity, brand, responsive, and navigation tests.** Run `npx tsx --test tests/natarot-final-ui-correction-v2.test.ts tests/natarot-final-visual-fidelity-v1.test.ts tests/brand-shell.test.ts`; preserve all current functional link contracts.

### Task 2: Reading Result hierarchy and dynamic spread safety

**Files:**
- Modify: `components/reading/reading-panel.tsx`
- Modify: `components/reading/reading-header.tsx`
- Modify: `components/reading/direct-answer.tsx`
- Modify: `components/reading/personal-insights.tsx`
- Modify: `components/reading/next-steps.tsx`
- Modify: `components/reading/follow-up-reading.tsx`
- Modify: `components/reading/reading-spread.tsx` only if presentation needs a small semantic class/label adjustment
- Modify: `app/room/room.tsx` only if required to connect the existing shared shell/continue CTA
- Modify: `app/globals.css`
- Test: `tests/natarot-final-ui-correction-v2.test.ts`, `tests/reading-spread.test.ts`, `tests/spread-geometry.test.ts`, `tests/tarot-reading-ui.test.ts`, `tests/tarot-reading-route.test.ts`

**Interfaces:**
- Inputs remain the saved `reading`, `session` metadata, `artworkByReadingCardId`, locale, existing callbacks, `reading.cardEvidence`, canonical geometry, and persisted L7/L8 follow-up data.
- Output remains the same reading result, card order/orientations, CTA handlers, save/share/QR paths, accessibility states, and L7/L8 behavior; presentation classes may change.

- [x] **Step 1: Add a failing hierarchy regression.** In the V2 contract suite, assert the DOM/source order is question/meta → `ReadingSpread` → `DirectAnswer` → insights/practical direction → optional depth/follow-up; assert Save/Share controls remain available but are not the primary content heading. Assert the renderer still maps `reading.cardEvidence` into `ReadingSpread` and does not enumerate fixed card indices.
- [x] **Step 2: Run the focused hierarchy/spread tests and verify the failure is the expected current ordering or styling contract.** Run `npx tsx --test tests/natarot-final-ui-correction-v2.test.ts tests/reading-spread.test.ts tests/spread-geometry.test.ts tests/tarot-reading-ui.test.ts tests/tarot-reading-route.test.ts`.
- [x] **Step 3: Make the minimum semantic hierarchy correction.** Promote the question, dynamic spread, and core answer; group related insights and actions with whitespace; put extended interpretation/supporting card evidence behind native, keyboard-operable disclosure only when it remains discoverable; keep follow-up secondary and retain the clear “Tiếp tục rút bài” action.
- [x] **Step 4: Refine only existing reading-result styles.** Give the spread a localized atmospheric stage, keep result prose on quiet readable surfaces, reduce repeated gold borders/glows, and move secondary metadata/actions out of the reading’s visual lead without removing them.
- [x] **Step 5: Verify 1/3/4/5/10 card rendering contracts and L7/L8 controls.** Run the named reading/spread tests plus `tests/follow-up-reading.test.ts` if present; add no screenshot-specific card placement and no prompt/payload changes.

### Task 3: Route-specific target corrections without data changes

**Files:**
- Modify: `app/globals.css`
- Modify: `app/pages.tsx` only if Library or Practice hierarchy cannot be corrected through existing classes
- Modify: `app/commerce/commerce-pages.tsx` only if Packages presentation needs a semantic grouping change
- Modify: `components/affiliate/affiliate-dashboard.tsx` only if its authenticated dashboard or empty state needs semantic grouping
- Modify: `components/account/account-history.tsx` only if its authenticated dashboard or empty state needs semantic grouping
- Test: `tests/natarot-final-ui-correction-v2.test.ts`, `tests/practice-v1-production.test.ts`, `tests/packages-redesign.test.ts`, `tests/affiliate-dashboard-redesign.test.ts`, `tests/natarot-account-dashboard.test.ts`, `tests/account-history.test.ts`, `tests/affiliate-customer-read-model.test.ts`, `tests/commercial-catalog-validity.test.ts`

**Interfaces:**
- Packages stay server/API-derived with the existing four canonical products and 30-day validity.
- Affiliate and Account remain owner-scoped API/read-model projections; unauthenticated production pages remain honest sign-in/empty states.
- Library keeps five canonical Tarot groups and their 22/14/14/14/14 counts; Practice keeps live card/reflection/save/reveal behavior.

- [x] **Step 1: Extend the V2 data/surface tests before route edits.** Assert the target page compositions remain present, packages read `/api/packages` and validity from its benefit snapshot, Affiliate reads its policy/dashboard endpoints, Account reads owner-scoped summary/history endpoints, and target screenshot values are absent from production component fallbacks.
- [x] **Step 2: Confirm red on only the new semantic hierarchy assertions.** Run the V2 suite and the existing route-specific test files; fix test setup if the failure is not an unmet V2 expectation.
- [x] **Step 3: Refine existing page surfaces.** Keep Library’s five-node constellation and Practice’s card/reflection two-column focal flow; make package choice/count/price/unit-price/validity/popular state/CTA the fastest scan; reduce Affiliate/Account ornament and group data rather than repeating dashboard cards.
- [x] **Step 4: Preserve real loading, error, empty, and auth-boundary states.** Do not add literal names, balances, income, policy percentages, referrals, or transaction values from screenshots.
- [x] **Step 5: Run the named page/data contracts and verify no business source changed.** If any presentation-only edit touches a data component, inspect its diff alongside the original API and handler lines before continuing.

### Task 4: Desktop-first browser iteration and mobile QA

**Files:**
- Modify: only the already listed shell/page source and CSS files when a screenshot exposes a real issue
- Evidence: save screenshots only through an authorized, reproducible browser capture flow under `docs/reports/evidence/natarot-final-ui-correction-v2/`; do not add screenshots to the application bundle.

- [x] **Step 1: Start the local preview from this worktree and inspect Library, Practice, Packages, Affiliate, Account, and a real persisted Reading Result at the supplied target viewport sizes where the necessary authorized session/result exists.** All six routes were inspected locally; Reading Result remains guest entry because there is no authorized persisted-result fixture.
- [x] **Step 2: Capture and compare desktop iteration 1 against the six owner targets.** Local visual QA found and corrected shell/footer, rail, and package top-offset differences; screenshots document final local guest states.
- [x] **Step 3: Capture desktop iteration 2.** Iterative desktop inspection corrected material hierarchy/spacing differences; evidence contains final one-per-route captures, not production captures.
- [x] **Step 4: Verify 390px and 375/412/768px layouts.** Check keyboard/focus, Vietnamese text, navigation, tap targets, horizontal overflow, and dynamic long/complex spreads; do not simply scale down desktop geometry.
- [x] **Step 5: Record each unavailable authenticated/persisted state as a gate, not a pass.** Do not use fixture data in the production browser; do not claim screenshot evidence that was not captured and saved.

### Task 5: Full verification, review, branch handoff, and conditional release gate

**Files:**
- Modify: `docs/reports/natarot-final-ui-correction-v2-audit.md`
- Modify: `docs/PROJECT_STATE.md`
- Commit: only the V2 plan, audit, tests, and changed UI source files

- [x] **Step 1: Run complete tests and protected contracts.** Run `npx tsx --test tests/*.test.ts`, `npx tsc --noEmit`, `npm run build`, ESLint over every changed TS/TSX file, `git diff --check`, and the existing production-data/auth/spread/payment contracts. Record exact output counts and inherited full-lint baseline without claiming unrelated debt was fixed.
- [x] **Step 2: Perform a fresh code/data review.** Inspect the full diff for duplicate components, demo literals, changed business logic, secret-like strings, regressions in dynamic spread behavior, and unrelated files. Request an independent reviewer only if an agent-review tool becomes available; otherwise record self-review and its limits.
- [x] **Step 3: Recompute tracked LOC and finalize evidence.** Record production TS/TSX, CSS, shared shell+brand LOC, added/removed/net lines, iteration count, exact screenshot paths, and all gates in the audit/report and `docs/PROJECT_STATE.md`.
- [x] **Step 4: Commit and push the dedicated branch normally.** Scoped implementation/evidence commit `303a1d8` is pushed to `origin/codex/natarot-final-ui-correction-v2`; staged diff and credential-pattern scan were clean. No PR was created.
- [x] **Step 5: Deploy only after fresh remote gates pass.** No V2 production deploy was made: SSH denied public-key/password authentication, so current-release/backup/rollback/browser gates cannot be freshly verified. Production screenshots and authenticated states remain blocked.

---

## Self-review

- Spec sections 5–13 map to Task 1; sections 14–18 map to Task 3; section 19 is a strict Task 4/5 gate; sections 20–28 map to Task 2; sections 29–37 map to Tasks 2–5; sections 38–44 map to Task 5 and the release gate; owner-only approval in section 45 is preserved in the final status.
- The implementation uses only the existing shared shell/route owners; added tests assert public behavior and protected data boundaries rather than invented data.
- Production deploy and authenticated screenshot claims are conditional on access and cannot be marked passed from the current guest/SSH evidence.
