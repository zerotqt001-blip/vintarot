# NaTarot Shared UI Architecture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate the approved NaTarot product surfaces onto one shared Celestial Tarot Observatory shell and verify that real data, protected flows, responsive behavior, and visual consistency survive the migration.

**Architecture:** Extract the route-aware chrome currently embedded in `app/vintarot.tsx` into focused shell components while keeping `VinTarot` as the compatibility entry point. Normalize route content through shared semantic tokens and existing UI primitives, then migrate Packages, Affiliate, and Account without changing API or business contracts; remove only import-proven dead UI.

**Tech Stack:** React 19, TypeScript, Vinext/Vite, Next-compatible route components, `lucide-react`, local Instrument Serif/Work Sans fonts, existing `Panel`/button primitives, `npx tsx --test`, TypeScript, production build, targeted ESLint, and browser QA.

**Spec:** `docs/superpowers/specs/2026-09-23-natarot-shared-ui-architecture-design.md`

## Global Constraints

- Preserve Moonlight/NaTarot observatory aesthetics and the six supplied screenshots as one visual system.
- Use canonical API/backend data; never hard-code screenshot balances, prices, referrals, commissions, membership, or reading content.
- Do not alter Auth/F-001, Credits ledger/expiry, SePay/payment verification, Affiliate accounting, RBAC/Admin, AI/DeepSeek, reading persistence/spread geometry, Share/QR, database migrations, backups, secrets, or deployment policy.
- Reuse existing `Logo`, `LanguageSelect`, `Panel`, button, icon, card, spread, and page logic before adding equivalents.
- Delete UI only after replacement, import reachability, route/build/tests, protected-logic review, and Git recovery are all proven.
- Verify 375px, 390px, 412px, tablet, desktop, English, Vietnamese, keyboard focus, reduced motion, and no horizontal overflow.
- Keep a separate LOC ledger for production TS/TSX, CSS, tests, and docs.

---

### Task 1: Establish the source baseline and failing shared-shell contracts

**Files:**
- Create: `tests/natarot-shared-ui-contract.test.ts`
- Create: `docs/reports/2026-09-23-natarot-shared-ui-loc.md`
- Modify: none

**Interfaces:**
- Produces the contract names used by later tasks: `NaTarotShell`, `NaTarotHeader`, `NaTarotSidebar`, `NaTarotFooter`, semantic `--nt-*` tokens, and route-preserving shell assertions.

- [ ] **Step 1: Measure the baseline before implementation**

Run:

```bash
find app components -type f \( -name '*.ts' -o -name '*.tsx' \) -not -path '*/api/*' -print0 | xargs -0 wc -l | tail -1
wc -l app/globals.css
find tests -type f -name '*.test.ts' -print0 | xargs -0 wc -l | tail -1
find docs -type f -name '*.md' -print0 | xargs -0 wc -l | tail -1
```

Record the four values in the LOC report with the current branch and commit `e5474d3`.

- [ ] **Step 2: Write the failing source contracts**

The test must read source files and assert the intended public seams before they exist. It should include these behaviors:

```ts
test("shared shell exports one canonical chrome contract", () => {
  const shell = read("components/shell/natarot-shell.tsx");
  assert.match(shell, /export (default )?function NaTarotShell/);
  assert.match(shell, /NaTarotHeader/);
  assert.match(shell, /NaTarotSidebar/);
  assert.match(shell, /NaTarotFooter/);
});

test("shared token layer defines the NaTarot semantic palette", () => {
  const css = read("app/globals.css");
  for (const token of ["--nt-bg-primary", "--nt-surface", "--nt-gold", "--nt-text-primary", "--nt-success"]) {
    assert.match(css, new RegExp(token));
  }
});

test("route wrappers keep protected data sources and destinations", () => {
  assert.match(read("app/packages/page.tsx"), /PackagesPage/);
  assert.match(read("app/affiliate/page.tsx"), /AffiliateDashboardPage/);
  assert.match(read("app/account/page.tsx"), /AccountHistory/);
  assert.match(read("app/commerce/commerce-pages.tsx"), /api\\/commercial\\/checkout/);
});
```

Add a small `read()` helper using `readFileSync` with the worktree root; do not import UI runtime code into the contract test.

- [ ] **Step 3: Run the focused test and confirm the failure is structural**

Run: `npx tsx --test tests/natarot-shared-ui-contract.test.ts`

Expected: FAIL because `components/shell/natarot-shell.tsx` and the new semantic tokens do not yet exist; existing protected-route assertions should pass.

- [ ] **Step 4: Commit the red contracts and baseline report**

```bash
git add tests/natarot-shared-ui-contract.test.ts docs/reports/2026-09-23-natarot-shared-ui-loc.md
git commit -m "test: define shared NaTarot shell contracts"
```

### Task 2: Extract the shared shell and semantic design tokens

**Files:**
- Create: `components/shell/natarot-shell.tsx`
- Create: `components/shell/natarot-header.tsx`
- Create: `components/shell/natarot-sidebar.tsx`
- Create: `components/shell/natarot-footer.tsx`
- Create: `components/shell/celestial-background.tsx`
- Modify: `app/vintarot.tsx`
- Modify: `app/globals.css`
- Test: `tests/natarot-shared-ui-contract.test.ts`

**Interfaces:**
- `NaTarotShellProps = { user, path, children, variant, activePath?, showUtilities?, profileHref?, accountHref? }`.
- `NaTarotHeaderProps = { path, variant, t, user, profileHref, accountHref, onAction? }`.
- `NaTarotSidebarProps = { path, variant, t, accountHref, user }`.
- `NaTarotFooterProps = { t, variant }`.
- `CelestialBackgroundProps = { variant: "observatory" | "library" | "practice" | "membership" | "affiliate" | "account" | "reading" | "home" | "immersive" }`.

- [ ] **Step 1: Add the failing prop-level shell tests**

Extend the contract test to assert that the shared components accept the variant and route props, that `app/vintarot.tsx` imports/delegates to `NaTarotShell`, and that route-specific shell markup is no longer duplicated in the entry point.

- [ ] **Step 2: Run the focused test and confirm it fails**

Run: `npx tsx --test tests/natarot-shared-ui-contract.test.ts`

Expected: FAIL on missing component files/import delegation.

- [ ] **Step 3: Add semantic tokens and shared focus/motion rules**

In `app/globals.css`, define the `--nt-*` palette, typography roles, spacing/radius/shadow/focus tokens, selection/caret/scrollbar colors, and reduced-motion defaults. Alias existing `--na-*`/`--tarot-*` values to the canonical tokens where the current routes depend on them so the migration does not break approved Home/Room/Guidebook surfaces.

- [ ] **Step 4: Extract chrome without changing route behavior**

Move shared header, five-item sidebar/mobile navigation, footer, logo/tagline, language/theme/account actions, and background selection into the new components. Keep Home and Guidebook-specific content/layout as explicit variants; preserve current `path` active-state rules, `profileHref`, `accountHref`, `children`, dialogs, and `ReferralCapture` behavior.

- [ ] **Step 5: Run the focused contract test and TypeScript**

Run:

```bash
npx tsx --test tests/natarot-shared-ui-contract.test.ts
npx tsc --noEmit
```

Expected: contract tests PASS and TypeScript has no new errors.

- [ ] **Step 6: Commit the shared shell**

```bash
git add components/shell app/vintarot.tsx app/globals.css tests/natarot-shared-ui-contract.test.ts
git commit -m "refactor: centralize NaTarot shell and design tokens"
```

### Task 3: Migrate Credit Packages onto shared panels and shell contracts

**Files:**
- Modify: `app/packages/page.tsx`
- Modify: `app/commerce/commerce-pages.tsx`
- Modify: `app/vintarot.tsx` only if a variant mapping is required
- Modify: `app/globals.css`
- Test: `tests/packages-ui.test.ts` or the nearest existing package-focused test file

**Interfaces:**
- Consumes the current `PackagesPage` API response types and `creditValidityDays`, `sortPackagesForPresentation`, `isPopularPackage`, checkout destination, and `MembershipBalance` behavior.
- Produces a membership route that uses the shared header/sidebar/footer, shared tokens, and data-derived 1/5/10/20 cards.

- [ ] **Step 1: Add failing package presentation assertions**

Assert that the route retains `/api/packages`, `/api/account/summary`, `/checkout?package=`, `creditValidityDays`, server amount/currency, and Popular derivation while rendering the shared shell variant and no screenshot literals such as `15.000`, `69.000`, `129.000`, `229.000`, `96`, or `0 Credits` as business values.

- [ ] **Step 2: Run the package-focused test and verify red**

Run the exact focused test file with `npx tsx --test`; expected failure is the missing shared variant/class contract, not a missing API or syntax error.

- [ ] **Step 3: Replace unique chrome/classes with shared primitives**

Keep the package grid, balance, journey, VIP teaser, Affiliate link, trust row, loading/error/empty states, and checkout links. Replace duplicate panel/button/footer styling with the shared classes/tokens and keep the canonical Popular/validity rules intact.

- [ ] **Step 4: Run focused package, commerce, and TypeScript tests**

Run:

```bash
npx tsx --test tests/packages-ui.test.ts
npx tsc --noEmit
```

Expected: all package and existing commercial regressions PASS.

- [ ] **Step 5: Commit the package migration**

```bash
git add app/packages app/commerce/commerce-pages.tsx app/globals.css tests
git commit -m "refactor: migrate packages to shared NaTarot UI"
```

### Task 4: Migrate Affiliate and remove only proven-dead duplicate UI

**Files:**
- Modify: `components/affiliate/affiliate-dashboard.tsx`
- Modify: `app/affiliate/page.tsx` only if wrapper metadata/variant changes
- Modify: `app/commerce/commerce-pages.tsx`
- Modify: `app/globals.css`
- Test: `tests/affiliate-ui.test.ts` or the nearest existing Affiliate-focused tests

**Interfaces:**
- Consumes the existing public policy and authenticated dashboard API projections, tier/income/history types, truthful unavailable states, and no-store fetch behavior.
- Produces the one active Affiliate presentation under the shared shell; `AffiliatePage` is removable only after the proof sequence below.

- [ ] **Step 1: Add failing Affiliate shell/data-boundary assertions**

Assert that the active route imports `AffiliateDashboardPage`, the active component still fetches `/api/affiliate/policy` and `/api/affiliate/dashboard`, the referral/payout unavailable states remain, and no fake screenshot values or fake tier percentages are introduced.

- [ ] **Step 2: Run focused Affiliate tests and verify red**

Run the focused test; expected failure is the missing shared presentation contract.

- [ ] **Step 3: Migrate the active Affiliate dashboard**

Keep KPI derivation, policy metadata, tier progression, referral-link availability, history status, copy action, loading/error/empty handling, authentication boundary, and real stored commission values. Apply the shared panel, button, typography, icon, and background tokens; keep the route’s public/authenticated state split.

- [ ] **Step 4: Prove the old `AffiliatePage` subtree is unreachable**

Run:

```bash
rg -n "AffiliatePage|AffiliatePolicy|AffiliateDashboardView" app components tests
npx tsc --noEmit
npm run build
```

Confirm `app/affiliate/page.tsx` and all route imports use only `components/affiliate/affiliate-dashboard.tsx`, and no protected backend service is defined only in the old subtree.

- [ ] **Step 5: Remove only the proven-dead old component code**

Delete the unreachable `AffiliatePolicy`, `AffiliateDashboardView`, and `AffiliatePage` code from `app/commerce/commerce-pages.tsx` only after Step 4 passes. Preserve the active `PackagesPage` and `CheckoutPage` exports and all shared types/helpers they still consume.

- [ ] **Step 6: Run focused Affiliate/commercial tests and commit**

```bash
npx tsx --test tests/affiliate-ui.test.ts
npx tsc --noEmit
git diff --check
git add components/affiliate app/affiliate app/commerce/commerce-pages.tsx app/globals.css tests
git commit -m "refactor: converge affiliate UI on shared NaTarot surfaces"
```

### Task 5: Build the real-data Account dashboard on the shared surface

**Files:**
- Modify: `components/account/account-history.tsx`
- Modify: `app/account/page.tsx`
- Modify: `app/globals.css`
- Modify: `lib/i18n.ts`
- Test: `tests/account-ui.test.ts` or the nearest existing account/member tests

**Interfaces:**
- Consumes `AccountSummary`, metadata-first history items, existing `activity` filter/cursor state, and `getPageMember`/`toMemberShellUser` auth ownership.
- Produces a shared-shell account surface with profile identity, Credit/VIP/saved-reading/Affiliate stats, recent readings, quick actions, transactions, and security settings without exposing Admin controls to unauthorized users.

- [ ] **Step 1: Add failing Account composition and protection assertions**

Assert that the account component keeps `/api/account/summary`, `/api/account/history`, the filter values (`readings`, `shares`, `orders`, `credits`, `affiliate`, `all`), cursor loading, real summary fields, auth boundary, and permission-based Admin visibility. Assert that screenshot values are not encoded as fixed business data.

- [ ] **Step 2: Run the account-focused test and verify red**

Run the focused test; expected failure is the missing approved dashboard sections/shared classes.

- [ ] **Step 3: Add only required bilingual account copy**

Add English/Vietnamese keys for hero, profile state, Credit/VIP/saved reading/Affiliate stats, recent readings, quick actions, transaction labels, security rows, loading/error/empty states, and sign-in. Keep locale leaf parity by adding both locales in the same patch.

- [ ] **Step 4: Replace the functional account composition**

Use shared panels/stat/action/table primitives and the account background variant. Keep existing fetch, filtering, pagination, destination links, masked metadata, and session-derived user identity. Render Admin only through the existing authorized route/action boundary; do not infer role from the screenshot or display name.

- [ ] **Step 5: Run account, i18n, TypeScript, and diff checks**

```bash
npx tsx --test tests/account-ui.test.ts
npx tsx --test tests/i18n.test.ts
npx tsc --noEmit
git diff --check
```

- [ ] **Step 6: Commit the Account migration**

```bash
git add components/account app/account app/globals.css lib/i18n.ts tests
git commit -m "feat: complete shared NaTarot account surface"
```

### Task 6: Normalize approved surfaces and consolidate reachable visual duplication

**Files:**
- Modify: `app/pages.tsx`
- Modify: `components/reading/reading-panel.tsx`
- Modify: `app/room/room.tsx` only for token aliases/classes if required
- Modify: `app/globals.css`
- Modify: `components/shell/*` as needed
- Test: existing Guidebook, Practice, Home, Room, and Reading Result focused tests

**Interfaces:**
- Consumes existing guidebook family/card data, Practice state/actions, Home route behavior, dynamic reading/spread geometry, Room interactions, and share/QR controls.
- Produces shared visual tokens/classes without changing content, prompt semantics, card order/orientation, spread geometry, follow-up actions, save/share/QR behavior, or route URLs.

- [ ] **Step 1: Add failing cross-surface token/route assertions**

Assert that the approved surfaces reference the semantic token layer and that protected markers for `SpreadBoard`, follow-up, journal save, Guidebook card data, Practice draw/reveal, and Home navigation remain present.

- [ ] **Step 2: Run the focused surface suite and verify the new assertions fail**

Run the specific existing test files for Guidebook, Practice, Home, Room, Reading UI, and Share/QR. Confirm only the new shared-token assertions are red.

- [ ] **Step 3: Apply token aliases and shared chrome classes**

Replace drifted per-route color/radius/button values with the shared semantic variables in bounded CSS edits. Keep route-specific background imagery and layout composition where the approved work depends on it. Do not add another complete route stylesheet.

- [ ] **Step 4: Remove only verified dead duplicate selectors/imports**

Use selector/import searches and browser/build evidence to remove obsolete rules made unreachable by the shared shell. Record each removal and line count in the LOC report; leave uncertain legacy selectors untouched.

- [ ] **Step 5: Run the focused regression suite and commit**

```bash
npx tsx --test tests/guidebook*.test.ts tests/practice*.test.ts tests/home*.test.ts tests/room*.test.ts tests/reading*.test.ts tests/share*.test.ts
npx tsc --noEmit
git diff --check
git add app/pages.tsx components/reading app/room components/shell app/globals.css tests
git commit -m "refactor: normalize approved NaTarot surfaces"
```

### Task 7: Responsive browser QA, cross-page comparison, and final verification

**Files:**
- Create/modify: `.impeccable/review/` screenshots and reports only if the verifier requires tracked evidence; do not add generated output to Git unless project policy requires it.
- Modify: `docs/reports/2026-09-23-natarot-shared-ui-loc.md`
- Modify: `docs/PROJECT_STATE.md`
- Modify: tests only for regressions discovered by QA, following red/green TDD

- [ ] **Step 1: Run the full automated quality gates**

Run:

```bash
npx tsx --test tests/*.test.ts
npx tsc --noEmit
npm run build
npm run lint -- --quiet
git diff --check
```

Report existing baseline lint failures separately from any new changed-file errors; do not call the result clean if the diff adds errors.

- [ ] **Step 2: Run the Impeccable detector fallback**

The launcher is not executable in this project checkout. Inspect changed UI files directly against `craft-floor.md`, run the detector through an available non-executable launcher form if supported, and record any pre-existing findings without changing unrelated code.

- [ ] **Step 3: Start the local production preview and capture all required routes**

Use the project’s build/start flow and inspect Home → Guidebook → Practice → Packages → Affiliate → Account → Room/Reading Result at desktop and 390px. Add 375px and 412px checks plus a tablet width. Verify no console errors, missing images, horizontal overflow, broken active state, fake data, unauthorized Admin, or dead action.

- [ ] **Step 4: Perform the cross-page comparison**

Compare header height/logo/nav, sidebar width/active treatment, footer, gold hue, surface opacity/border/radius, heading/body type, button/icon treatment, spacing, background contrast, locale switching, and reduced motion across all seven surfaces. Fix only evidenced visual regressions, rerun focused tests, and capture the final bounded screenshot round.

- [ ] **Step 5: Update LOC and project state**

Record before/after production TS/TSX, CSS, tests, and docs LOC; added/removed totals; shared components; proven-dead UI removed; route/width/locale verification; protected contract results; and remaining blockers in `docs/reports/2026-09-23-natarot-shared-ui-loc.md` and `docs/PROJECT_STATE.md`.

- [ ] **Step 6: Commit the verified implementation**

Inspect `git diff --cached` for secrets and unrelated changes, then:

```bash
git add components app lib/i18n.ts tests docs/reports/2026-09-23-natarot-shared-ui-loc.md docs/PROJECT_STATE.md
git diff --cached --check
git diff --cached --stat
git commit -m "feat: unify NaTarot product UI architecture"
```

### Task 8: Push, backup, deploy, production QA, and safe release retention

**Files:**
- Modify: none unless the existing deployment guard requires a separately reviewed fix
- Evidence: deployment/backup command output and final project-state entry

- [ ] **Step 1: Verify the final branch and remote state**

Run `git status --short --branch`, `git log -1 --oneline`, `git fetch origin`, and compare the feature branch with its remote. Push the branch with `git push -u origin codex/natarot-shared-ui-architecture`.

- [ ] **Step 2: Probe existing SSH configuration and production authority**

Inspect `~/.ssh/config` host aliases, agent identities, deployment scripts, and the current production marker without printing secrets. Confirm the live commit/release before mutating VPS state.

- [ ] **Step 3: Take and verify the canonical backup**

Run the existing backup/restore procedure; verify archive checksum, SQLite integrity, migrations/foreign keys, restore readability, service health, and recorded backup identity before deployment. Record `df -h`, application release count/size, and backup storage.

- [ ] **Step 4: Deploy through the existing reversible mechanism**

Build the verified commit, transfer only the release artifact without `.env` or database files, atomically switch the service, retain a rollback release, and verify `/api/health` and public HTTPS. Do not perform a real-money transaction, credential change, or schema migration for visual QA.

- [ ] **Step 5: Run production browser QA**

Navigate as a user through Home → Lá bài, Luyện tập, Gói Thành Viên, Affiliate, Tài Khoản, and Rút Bài → Reading Result at desktop and 390px; inspect 375px/412px when available. Verify no blank columns, overflow, missing images, dead CTA, wrong state, fake data, or unauthorized Admin.

- [ ] **Step 6: Prune only obsolete application releases after health passes**

Run the existing storage guard in post-success mode. Retain the current release and two successful rollback releases; never delete database/backups, persistent data, `.env`/secrets, SSL, Nginx, systemd, or SSH configuration. Record disk-after, releases-after, reclaimed space, retained rollbacks, and database-backup status.

- [ ] **Step 7: Attach/report the final evidence**

Run final `git status`, confirm the pushed commit, update `docs/PROJECT_STATE.md` with production commit/health and any genuine blocker, and produce the requested final report with every PASS/FAIL field evidence-backed.
