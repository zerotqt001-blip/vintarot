# Implementation Plan: NaTarot Final Visual Fidelity V1

**Goal:** Bring the six owner-target NaTarot surfaces to a final visual-fidelity pass while preserving the existing shared shell, real data boundaries, dynamic spread geometry, interaction behavior and Home styling.

**Architecture:** Keep `components/shell` as the sole shared header/sidebar/footer/background system. Refine the route-scoped CSS in `app/globals.css`, make only small semantic markup adjustments where the target composition needs a stable hook, and keep authenticated dashboard states data-driven. Use the existing `SpreadBoard`/spread geometry contract for Reading Result rather than introducing a screenshot-specific layout.

**Tech Stack:** Next.js/React, TypeScript, CSS in `app/globals.css`, Node `node:test` source-contract tests, `tsx`, ESLint, local production build, CUA browser QA, existing VPS release/rollback workflow.

**Spec/evidence:** `docs/reports/natarot-final-visual-fidelity-v1-comparison.md` plus the owner brief supplied in the task attachments.

**Execution:** The owner brief pre-authorizes the bounded implementation and deployment gates. Continue in this isolated worktree without pausing for routine approval; stop only for an external-state conflict or an unrecoverable production-access gate.

## Global constraints

- Preserve the Moonlight/NaTarot celestial observatory aesthetic and latest Home surface.
- Do not create a second shell, duplicate page versions, screenshot backgrounds, fake package/account/affiliate values, or hardcoded four-card Reading Result markup.
- Keep package prices, credit validity, checkout IDs, affiliate policy/dashboard values, account summary/history and reading payloads server-owned.
- Preserve save/reveal interactions, navigation destinations, mobile safe-area behavior, reduced-motion behavior and accessibility labels.
- Use `apply_patch` for source/docs edits. Commit only related files after staged diff and secret checks.

## Task 1 — Add red fidelity contracts before UI edits

**Files:** `tests/natarot-final-visual-fidelity-v1.test.ts` (new), existing source files read by the test.

1. Add source-level assertions for the six canonical route variants and shared shell ownership.
2. Assert target composition hooks: Guidebook orbit/78 center, Practice two-part layout, four-card package grid, Affiliate KPI/dashboard grid, Account profile/stat/history grid, and Reading Result `SpreadBoard` delegation.
3. Assert data boundaries: package rendering consumes `/api/packages`/server package version data, Affiliate uses policy/dashboard routes, Account uses summary/history routes, and Account/Affiliate do not contain owner screenshot literals.
4. Assert CSS contracts for desktop composition sizing, mobile breakpoints at `768`, `420`/`400`, and reduced-motion/overflow-safe rules.
5. Run `npx tsx --test tests/natarot-final-visual-fidelity-v1.test.ts` and record the intentional failure before implementation.

## Task 2 — Refine shared chrome and atmosphere once

**Files:** `components/shell/natarot-header.tsx`, `components/shell/natarot-sidebar.tsx`, `components/shell/natarot-footer.tsx`, `components/shell/celestial-background.tsx`, `app/globals.css`.

1. Compare the shared header/sidebar/footer geometry at the owner desktop dimensions and make only shared or variant-scoped CSS changes needed for logo scale, navigation spacing, icon-orb visibility, active states, panel borders, and footer cadence.
2. Keep Guidebook’s target shell hooks and the membership/practice/account/affiliate shared shell variants aligned without changing route destinations.
3. Keep observatory backgrounds route-scoped and readable; do not add a global preload or duplicate background component.
4. Add/retain focus-visible, reduced-motion and mobile bottom-navigation rules while preventing horizontal overflow.
5. Run the shared-shell and new fidelity tests, then inspect the diff for accidental Home selectors.

## Task 3 — Tune Guidebook and Practice composition

**Files:** `app/pages.tsx`, `app/globals.css`, relevant Guidebook/Practice tests.

1. Increase the Guidebook orbit/node presentation to match the target’s visual weight at desktop while preserving the five canonical groups and real card data.
2. Rebalance Practice’s altar/card stage, reflection workspace and guidance rail so the left card and right panel occupy the same visual hierarchy as the target.
3. Preserve card randomization, card replacement, reflection save/reveal, journal record behavior, `/room` navigation, and touch/keyboard affordances.
4. Keep the target’s observatory depth, gold edge treatment, serif headings and readable blue-glass surfaces; do not over-brighten copy against the background.
5. Verify desktop, tablet and `390px`/`375px` stacking with the existing Practice/Guidebook contracts and browser measurements.

## Task 4 — Tune Packages without changing commerce truth

**Files:** `app/commerce/commerce-pages.tsx`, `app/globals.css`, `tests/packages-redesign.test.ts` if a missing contract is identified.

1. Preserve the live server catalog and current package order; verify the production catalog contains the owner target’s 1/5/10/20 credit packages before visual QA.
2. Tune package card width, gap, badge, number/price hierarchy, benefits, CTA height and the journey/support/trust rhythm so the target’s full desktop composition fits without cramped copy.
3. Keep 30-day credit validity derived from `benefitSnapshot.credits.expiresInSeconds` and keep checkout keyed by package version ID.
4. Keep guest balance/empty states actionable and visually stable; never substitute screenshot demo balances or prices.

## Task 5 — Tune authenticated Affiliate and Account dashboards safely

**Files:** `components/affiliate/affiliate-dashboard.tsx`, `components/account/account-history.tsx`, `app/globals.css`, `tests/affiliate-dashboard-redesign.test.ts`, `tests/natarot-account-dashboard.test.ts`.

1. Keep guest Affiliate and Account boundaries explicit and actionable; do not make unauthenticated production captures pretend to be owner dashboards.
2. Refine authenticated Affiliate KPI, tier, link/QR, income, referrals, flow and policy grids so zero-data panels retain the target composition rather than collapsing.
3. Refine authenticated Account hero/profile/status cards/recent/quick-access/history/credit/VIP panels while preserving owner-scoped fetches and cursor pagination.
4. Keep all values derived from API responses; retain empty/loading/error states with target-sized panels and no screenshot literals.
5. Verify both authenticated dashboard DOM fixtures locally if available, plus public production boundaries.

## Task 6 — Polish Reading Result while preserving dynamic spreads

**Files:** `app/room/room.tsx`, `components/reading/reading-panel.tsx`, `components/reading/spread-board.tsx`, `app/globals.css`, spread/reading tests.

1. Tune result-state header, actions, spread stage, card captions, interpretation sections and follow-up cadence toward the owner screenshot.
2. Preserve the normalized `SpreadBoard` projection and dynamic card count/positions for representative 1/3/4/5/7/10-card readings.
3. Verify full-canvas result behavior, no obsolete tabletop/sidebar overlap, readable scroll behavior, save/follow-up controls and mobile ordered flow.
4. Keep room/background assets and reading payload/provider boundaries unchanged.

## Task 7 — Browser iteration and responsive/performance gate

**Files:** `docs/reports/natarot-final-visual-fidelity-v1-comparison.md`, `app/globals.css` only if iteration changes are required.

1. Start the isolated local app and capture at least two desktop comparison rounds for `/guidebook`, `/community`, `/packages`, `/affiliate`, `/account` and Reading Result interpretation state.
2. Capture a final local `390px` round and check `768`, `412`, `390`, `375` layout metrics for body/document overflow, clipped CTAs, broken tables and unusably small controls.
3. Check image/background requests are route-scoped and no all-background preload was introduced.
4. Record iteration deltas and remaining auth-fixture limitations in the comparison matrix.

## Task 8 — Verification, documentation, commit and controlled deployment

**Files:** `docs/PROJECT_STATE.md`, final source/test/docs files, deployment artifacts outside Git only.

1. Run the focused fidelity tests, full `npx tsx --test tests/*.test.ts`, `npx tsc --noEmit`, `npm run build`, `git diff --check`, changed-file ESLint and repository lint for the documented baseline.
2. Read the final staged diff and scan tracked/staged files for secrets, environment files, runtime databases, logs and build output.
3. Inspect the current production HEAD/release marker before deployment; stop if a newer unmanaged release or conflicting deploy is active.
4. Follow the existing production workflow: fresh backup/checksum/restore-readability/integrity, storage guard, candidate build/health, atomic switch, exactly current + rollback1 + rollback2 retention, post-switch health and no persistent-data deletion.
5. Run real production navigation and screenshot comparison at desktop and `390px` for all six routes. Only report `READY FOR OWNER VISUAL REVIEW` after those screenshots are actually compared.
6. Append decisions, validation, production state and unfinished gates to `docs/PROJECT_STATE.md`, commit related files on the `codex/` branch, push to origin, and report any push/deployment failure explicitly.

## Self-review checklist

- [x] The plan identifies concrete files, interfaces, tests and commands for each task.
- [x] The plan preserves shared architecture and names the dynamic/data boundaries that must not change.
- [x] The plan includes red-test-first order, browser evidence, responsive widths, production safety and rollback gates.
- [x] The plan has no placeholder task or unspecified visual deliverable.
