# NaTarot Practice Page V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the `/community` Practice page presentation with the owner-approved celestial two-column experience while preserving every existing Practice action and route contract.

**Architecture:** Keep `Practice` and its state/API behavior in `app/pages.tsx`. Add a conditional Practice variant to the existing shared shell in `app/vintarot.tsx`, add only the required bilingual labels to `lib/i18n.ts`, and layer a scoped `.practice-v1` CSS system at the end of `app/globals.css` so Home and other routes remain untouched.

**Tech Stack:** React 19, TypeScript, Vinext/Vite, Lucide icons, existing NaTarot logo/assets, Node test runner through `tsx`, CSS media queries.

**Spec:** `docs/superpowers/specs/2026-09-23-practice-page-v1-design.md`

## Global Constraints

- Preserve the existing `shuffleDeck()`, `CardFace`, `cardMeaning`, `api("records")`, `/room`, save, reveal, replacement and locale behavior exactly.
- Modify only Practice markup/shell/i18n/styles/tests/state documentation; do not change Home, Room, Reading Result, Membership, Checkout, Account, Affiliate, Admin, API or database behavior.
- Reuse the existing shared `VinTarotShell`; do not create a competing header/sidebar/footer implementation.
- Keep all new visible copy bilingual through `lib/i18n.ts`.
- Preserve existing user-owned dirty files and stage only related files for the final commit.

---

### Task 1: Add the Practice V1 regression contract

**Files:**
- Create: `tests/practice-v1-production.test.ts`
- Read: `docs/superpowers/specs/2026-09-23-practice-page-v1-design.md`

**Interfaces:**
- Consumes: source strings from `app/pages.tsx`, `app/vintarot.tsx`, `lib/i18n.ts`, and `app/globals.css`.
- Produces: a focused source contract that fails until the new Practice shell, markup and scoped style hooks exist.

- [x] **Step 1: Write the failing test**

Create a Node test that reads the four source files and asserts:

```ts
test("Practice V1 keeps the target shell and existing interaction contracts", () => {
  for (const marker of [
    "practice-v1",
    "practice-v1-guidance",
    "practice-v1-card-meta",
    "practice-v1-step",
    "practice-v1-footer",
  ]) assert.match(pages + shell + styles, new RegExp(marker));
  for (const marker of [
    "practiceNav",
    "header.search",
    "header.theme",
    "nav.drawNow",
    "nav.membership",
    "nav.affiliate",
    "nav.account",
  ]) assert.match(shell + translations, new RegExp(marker));
  assert.match(pages, /shuffleDeck\(\)\[0\]/);
  assert.match(pages, /cardMeaning\(cards\[id\], locale\)/);
  assert.match(pages, /api\("records"/);
  assert.match(pages, /href="\/room"/);
  assert.match(styles, /prefers-reduced-motion[^}]*practice-v1/);
});
```

Use an explicit `translations` source read for `lib/i18n.ts` and keep assertions focused on user-visible contracts rather than implementation line numbers.

- [x] **Step 2: Run test to verify it fails**

Run: `npx tsx --test tests/practice-v1-production.test.ts`

Expected: FAIL because the Practice V1 hooks and conditional shell labels do not exist yet.

- [ ] **Step 3: Commit**

Do not commit yet; keep the red test in the working tree while implementing Tasks 2–4 so the full feature remains one scoped commit.

### Task 2: Add bilingual Practice shell labels and shared-shell variant

**Files:**
- Modify: `lib/i18n.ts` in the `nav`, `header` and `pages` dictionaries
- Modify: `app/vintarot.tsx` in `VinTarotShell`
- Test: `tests/practice-v1-production.test.ts`

**Interfaces:**
- Consumes: `isPractice`, `useLanguage`, existing Logo/Sidebar/LanguageSelect/Dialog primitives.
- Produces: Practice-only `practiceNav`, four-link top navigation, icon actions, account link and footer/social presentation using the existing shared shell markup.

- [x] **Step 1: Add the exact localized strings**

Add English and Vietnamese values for `nav.drawNow`, `nav.membership`, `nav.affiliate`, `nav.account`, `header.search`, `header.theme`, `pages.practiceSubtitle`, `pages.practiceEyebrow`, `pages.practiceNotePlaceholder`, `pages.practiceStep`, `pages.practiceGuidanceQuote`, `pages.practiceGuidanceObserve`, `pages.practiceGuidanceReflect`, `pages.practiceGuidanceExplore`, `pages.practiceGuidanceClosing`, and `pages.practiceCardEarth`.

- [x] **Step 2: Implement the conditional shell arrays and actions**

Keep the existing `nav`, `topNav`, `personal` arrays unchanged for other routes. Define Practice-only arrays inside `VinTarotShell`, choose them only when `isPractice`, and preserve active state/`aria-current`. Practice header actions must be normal accessible controls/links and must omit `+ Room`, duplicate shopping/obsolete personal navigation, and the daily-spread top link.

- [x] **Step 3: Add the Practice footer presentation**

Keep the existing footer branch for every other route. For Practice, render the same shared `<footer>` element with `practice-v1-footer`, the existing Logo, tagline, guide/privacy/terms links and Lucide social marks without inventing account URLs or changing other routes.

- [x] **Step 4: Run focused test**

Run: `npx tsx --test tests/practice-v1-production.test.ts`

Expected: still FAIL on the page and CSS markers only; the shell and localization markers should be satisfied.

### Task 3: Implement the target Practice composition without changing behavior

**Files:**
- Modify: `app/pages.tsx` in `Practice`
- Test: `tests/practice-v1-production.test.ts`

**Interfaces:**
- Consumes: existing Practice state and handlers, localized strings, `CardFace`, `cards`, `cardMeaning`, `api`.
- Produces: `practice-v1`, `practice-v1-hero`, `practice-v1-composition`, `practice-v1-card-meta`, `practice-v1-reflection`, `practice-v1-guidance` and below-fold read-together markup.

- [x] **Step 1: Add the failing markup assertions**

Extend the focused test to require `practice-v1-eyebrow`, `practice-v1-card-meta`, `practice-v1-guidance`, `practice-v1-step`, `practice-v1-reflect`, `practice-v1-observe`, and `practice-v1-explore`.

- [x] **Step 2: Replace only the Practice JSX composition**

Retain the existing state declarations, timer cleanup, `changeCard` logic and button handlers. Add the target hero copy, card metadata derived from `cards[id]`, the reordered save/reveal action row, the localized textarea placeholder/count, the guidance rail and the existing read-together CTA below the main composition. Do not hard-code a Tarot card name or change the journal payload.

- [x] **Step 3: Run focused test and typecheck**

Run: `npx tsx --test tests/practice-v1-production.test.ts` and `npx tsc --noEmit`

Expected: focused test PASS and typecheck PASS.

### Task 4: Add scoped desktop/tablet/mobile visual system

**Files:**
- Modify: `app/globals.css` by appending the scoped Practice V1 block
- Test: `tests/practice-v1-production.test.ts`

**Interfaces:**
- Consumes: the Practice V1 classes from Tasks 2–3 and existing token/logo/icon primitives.
- Produces: Image 1-like desktop composition, compact tablet behavior, one-column mobile flow, accessible states and reduced-motion behavior.

- [x] **Step 1: Add the failing CSS contract**

Require the CSS source to contain `.practice-v1`, `.practice-v1-guidance`, a desktop `grid-template-columns`, `@media(max-width:700px)` and a reduced-motion rule that mentions `.practice-v1`.

- [x] **Step 2: Implement the CSS**

Use the existing celestial background asset, midnight/navy surfaces, champagne borders, Instrument Serif headings, Work Sans controls, deliberate spacing and focus states. Keep the right guidance rail visible on desktop, reflow it below the main content on tablet/mobile, keep the community card below the first desktop viewport, and scope every new rule to `.practice-shell` or `.practice-v1`.

- [x] **Step 3: Run the focused test**

Run: `npx tsx --test tests/practice-v1-production.test.ts`

Expected: PASS.

### Task 5: Run visual QA and repository verification

**Files:**
- Create/modify only if needed: `.impeccable/review/desktop.png`, `.impeccable/review/mobile.png`, and `.impeccable/review/user-<width>.png` (ignored review evidence)
- Modify: `docs/PROJECT_STATE.md`

**Interfaces:**
- Consumes: local production preview, focused tests and target screenshots.
- Produces: verified local Practice screenshots, exact command evidence, and a state note that separates verified local work from deployment status.

- [ ] **Step 1: Start the local preview and capture desktop/mobile**

Run the project preview on an unused local port, open `/community`, capture at `1440×900` and `390×844`, inspect both images once, and check `document.documentElement.scrollWidth === window.innerWidth` plus visible header/sidebar/footer/action markers.

QA note: the local in-app browser rendered and was inspected at `1280×720`; it did not expose a 390px viewport override during this session. The responsive CSS was source-inspected, but the requested mobile capture remains open.

- [ ] **Step 2: Make one batched visual correction pass**

Fix only issues visible in the two captures: clipped labels, wrong first-viewport hierarchy, overflow, weak contrast or missing controls. Rebuild and recapture the same two viewports once.

- [x] **Step 3: Run verification commands**

Run: `npx tsx --test tests/practice-v1-production.test.ts`, `npx tsx --test tests/*.test.ts`, `npx tsc --noEmit`, `npm run build`, and `git diff --check`.

Record actual counts and known baseline failures; do not claim repository-wide success from a partial command.

- [x] **Step 4: Update project state and inspect the diff**

Append the Practice V1 decision, verification evidence, preserved dirty files and deployment status to `docs/PROJECT_STATE.md`. Run `git diff --stat`, `git diff --check`, and a secret-like literal scan over staged files before committing.

### Task 6: Commit, review and deploy only with evidence

**Files:**
- Commit only the related Practice/i18n/shell/style/test/state files.

**Interfaces:**
- Consumes: verified local build and visual evidence, current branch/remote state and the documented VPS release procedure.
- Produces: a scoped `codex/` commit and, if SSH access and release tooling are available, an atomically deployed and publicly verified Practice page.

- [ ] **Step 1: Request code review against the pre-feature HEAD**

Provide the reviewer the exact base/head SHAs, spec path, focused test result, full verification output and screenshot paths. Fix Critical/Important findings before the commit is presented as complete.

- [ ] **Step 2: Stage and commit only related files**

Run `git add app/pages.tsx app/vintarot.tsx app/globals.css lib/i18n.ts tests/practice-v1-production.test.ts docs/superpowers/specs/2026-09-23-practice-page-v1-design.md docs/superpowers/plans/2026-09-23-practice-page-v1.md docs/PROJECT_STATE.md`, inspect the staged diff for secrets and unrelated Home files, then commit with `feat(practice): ship owner-aligned practice page v1`.

- [ ] **Step 3: Push the `codex/` branch if origin is configured**

Push the completed commit to the matching `origin/codex/...` branch and report any push failure explicitly. Do not force-push or rewrite existing history.

- [ ] **Step 4: Deploy only through the verified VPS procedure**

Build a secret-free release artifact, retain the prior release for rollback, install atomically, restart only the intended service, and run public `/community` and asset smoke checks. If SSH authentication remains unavailable, stop deployment and state the exact blocker; do not claim a production screenshot or deployment.

- [ ] **Step 5: Append final deployment evidence**

Update `docs/PROJECT_STATE.md` with the actual commit, public verification, screenshot status and any unfinished remote step, then run the final verification command set before reporting completion.
