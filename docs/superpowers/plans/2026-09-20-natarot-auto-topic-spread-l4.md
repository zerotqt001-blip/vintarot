# NaTarot L4 Auto Topic + Auto Spread Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a deterministic bilingual Auto topic and spread recommendation that hands one explicit final spread into the existing L1C Room draw flow while preserving manual override.

**Architecture:** A pure recommender will score bilingual question signals and resolve all results through `currentSpreadCatalog`. Create will show the advisory result and write exact category/template IDs plus `spreadMode: "auto"` into the existing session draft. Room will hydrate those IDs, expose an Auto row beside the existing manual picker, and keep manual selections authoritative.

**Tech Stack:** React 19, TypeScript, Node `node:test` via `tsx`, existing D1 catalog/repository, existing CSS tokens, Vinext/Vite.

**Spec:** `docs/superpowers/specs/2026-09-20-natarot-auto-topic-spread-l4-design.md`

## Global Constraints

- Use `codex/natarot-level4-spreadboard-l1c` at `a53dc44d5c088f2e9685e31f3e4a9dc51a09ebea` as the implementation base.
- Reuse the existing `work`, `relationships`, `changes`, `creativity`, `magic`, and `idk` topic identifiers.
- Resolve every recommendation through `currentSpreadCatalog`; do not add a second catalog or geometry implementation.
- Keep the recommendation local and deterministic; do not add a provider/API call.
- Do not add a database migration or change auth/security, AI/Knowledge Base, reading, draw, persistence, or deployment contracts.
- Preserve explicit manual spread selections until the user chooses Auto again.
- Add only the bilingual strings and small layout hooks needed for L4.
- Keep existing L1A/L1B/L1C tests and behavior intact.

## File Map

- Create: `lib/tarot-recommendation.ts` — topic IDs, deterministic intent/topic scoring, canonical spread resolution, recommendation contract, and Auto/manual mode types.
- Create: `tests/tarot-recommendation.test.ts` — recommender, catalog validity, fallback, and selection precedence tests.
- Modify: `app/create/ritual.tsx` — compute/show the recommendation and write exact draft selection IDs.
- Modify: `app/room/room.tsx` — hydrate draft selections, track Auto/manual mode, and add return-to-Auto behavior without changing draw submission.
- Modify: `lib/i18n.ts` — required English/Vietnamese recommendation and Auto/manual copy.
- Modify: `app/globals.css` — restrained recommendation card and responsive Auto picker row using existing NaTarot tokens.
- Modify: `tests/create-celestial.test.ts` — source/accessibility contract for the new recommendation surface.
- Create: `tests/tarot-auto-spread-ui.test.ts` — source-level Create/Room wiring and protected-boundary assertions.
- Modify: `docs/PROJECT_STATE.md` — record the verified L4 state, base, commit, tests, and explicit non-changes before session end.

---

### Task 1: Build the catalog-backed deterministic recommender

**Files:**
- Create: `tests/tarot-recommendation.test.ts`
- Create: `lib/tarot-recommendation.ts`

**Interfaces:**
- `recommendTarotSpread(question: string, explicitTopic?: TarotTopic | null): TarotRecommendation`
- `findCanonicalSpread(categoryId: string, templateId: string): { category: TarotCatalogCategory; template: TarotCatalogTemplate } | null`
- `type TarotSpreadSelectionMode = "auto" | "manual"`
- `type TarotRecommendation` with `mode`, `detectedTopic`, `intent`, `recommendedSpreadId`, `categoryId`, `confidence`, and `reasonKey`.

- [x] **Step 1: Write failing tests for bilingual detection and safe defaults.**

```ts
test("detects a Vietnamese relationship question and recommends a relationship spread", () => {
  const result = recommendTarotSpread("Người ấy còn tình cảm với tôi không?");
  assert.equal(result.detectedTopic, "relationships");
  assert.equal(result.categoryId, "category-relationships");
  assert.equal(result.recommendedSpreadId, "spread-relationships-unclear-feelings");
  assert.equal(result.mode, "auto");
});

test("detects an English career question and resolves the career crossroads spread", () => {
  const result = recommendTarotSpread("Should I take this new career opportunity?");
  assert.equal(result.detectedTopic, "work");
  assert.equal(result.recommendedSpreadId, "spread-planning-career-crossroads");
});

test("uses a catalog-valid general fallback for empty and short questions", () => {
  const empty = recommendTarotSpread("");
  const short = recommendTarotSpread("Why?");
  for (const result of [empty, short]) {
    assert.equal(result.detectedTopic, "idk");
    assert.equal(result.categoryId, "category-everyday");
    assert.equal(result.recommendedSpreadId, "spread-everyday-persona-obstacle-solution");
    assert.equal(result.confidence, "low");
  }
});
```

- [x] **Step 2: Run the focused tests and verify they fail for the missing module.**

Run: `npx tsx --test tests/tarot-recommendation.test.ts`

Expected: FAIL because `@/lib/tarot-recommendation` does not exist yet.

- [x] **Step 3: Write the minimal catalog-backed implementation.**

Implement these rules in `lib/tarot-recommendation.ts`:

```ts
export const tarotTopics = ["work", "relationships", "changes", "creativity", "magic", "idk"] as const;
export type TarotTopic = (typeof tarotTopics)[number];
export type TarotSpreadSelectionMode = "auto" | "manual";
export type TarotRecommendationIntent = "GENERAL" | "RELATIONSHIP" | "DECISION" | "OBSTACLE" | "DIRECTION" | "SELF_REFLECTION" | "CAREER" | "FINANCE";
export type TarotRecommendationReasonKey = "relationship" | "career" | "finance" | "creativity" | "change" | "selfReflection" | "decision" | "obstacle" | "general";
export type TarotRecommendation = {
  mode: "auto";
  detectedTopic: TarotTopic;
  intent: TarotRecommendationIntent;
  recommendedSpreadId: string;
  categoryId: string;
  confidence: "high" | "medium" | "low";
  reasonKey: TarotRecommendationReasonKey;
};
```

Normalize accents with NFD and lower case, score keyword families in both languages, respect an explicitly selected existing topic, then choose a semantic spread slug from the existing catalog. Use these canonical mappings: relationships → `relationship-check-in` or `unclear-feelings`/`act-or-wait`/`conflict-resolution`; work → `career-crossroads` for career decisions, `strategic-overview-swot` for finance, otherwise `finding-your-magic`; creativity → `getting-unstuck` for obstacles, `creative-direction` for direction, otherwise `seed-sprout-harvest`; changes → `between-worlds`; magic → `mind-body-spirit`; idk → `yes-or-no`, `how-to-handle-it`, or `past-present-future` only when the intent signals it, otherwise `persona-obstacle-solution`.

Resolve the selected category and template by catalog slug, assert its position count equals `cardCount`, and fall back to `category-everyday`/`spread-everyday-persona-obstacle-solution` if a mapping ever becomes stale. No function may fabricate a spread ID or mutate the catalog.

- [x] **Step 4: Run the focused tests and verify they pass.**

Run: `npx tsx --test tests/tarot-recommendation.test.ts`

Expected: all recommender tests pass with deterministic IDs and catalog-compatible counts.

- [x] **Step 5: Add edge-case and precedence tests before moving on.**

Cover finance without introducing a `finance` topic, mixed-language input, explicit `relationships` override, deterministic repeated calls, every supported topic's canonical template, and the invariant that `findCanonicalSpread` returns a template whose positions match `cardCount`.

- [x] **Step 6: Run the expanded recommender tests.**

Run: `npx tsx --test tests/tarot-recommendation.test.ts tests/tarot-spread.test.ts tests/tarot-spread-geometry.test.ts`

Expected: all new recommender tests and all L1A/L1B geometry tests pass.

### Task 2: Add the advisory recommendation to Create and persist exact draft selection

**Files:**
- Modify: `app/create/ritual.tsx`
- Modify: `lib/i18n.ts`
- Modify: `app/globals.css`
- Modify: `tests/create-celestial.test.ts`
- Create: `tests/tarot-auto-spread-ui.test.ts`

**Interfaces:**
- Consume `recommendTarotSpread`, `findCanonicalSpread`, `TarotTopic`, and `TarotRecommendation` from Task 1.
- Produce a session draft with `categoryId`, `spreadTemplateId`, and `spreadMode: "auto"` alongside the existing question/topic/context fields.

- [x] **Step 1: Add failing source-contract tests for recommendation rendering and draft handoff.**

Assert that Create imports and calls `recommendTarotSpread`, renders a `data-auto-recommendation` surface with detected topic/spread/reason/card count, and writes `categoryId`, `spreadTemplateId`, and `spreadMode: "auto"`. Assert that the bilingual messages contain the recommendation labels and reason keys.

- [x] **Step 2: Run the UI contract tests and verify the new assertions fail.**

Run: `npx tsx --test tests/create-celestial.test.ts tests/tarot-auto-spread-ui.test.ts`

Expected: the existing Create tests pass and the new recommendation assertions fail because the integration does not exist yet.

- [x] **Step 3: Add the minimal bilingual strings.**

Add only the `create.auto*` and `room.auto*` keys needed for: Auto label, detected topic, recommended spread, cards, reason, confidence, manual selection, and return-to-Auto. Keep the existing topic labels and suggestion copy unchanged.

- [x] **Step 4: Implement the Create recommendation surface and exact session draft.**

Compute the recommendation from `currentQuestion` plus `selectedTopic` on render. Show it when there is a question or an explicit topic, using the localized catalog template name and `t("create.topics." + recommendation.detectedTopic)` for the detected topic. Keep the existing submit and suggestion buttons as the only navigation actions. In `begin`, resolve the recommendation for the submitted value/topic and store the exact category/template IDs, detected topic, optional context, locale, and `spreadMode: "auto"` in `vintarot:new-reading`.

- [x] **Step 5: Add restrained responsive styling.**

Add a recommendation card that fits the existing cosmic Create stage: one gold Auto marker, a readable spread title, a compact topic/reason line, and no new rectangular dashboard treatment. Keep the card within the existing 620px measure, stack it cleanly below the form on 390px/375px, preserve 44px-equivalent focus targets, and add it to the existing reduced-motion selector.

- [x] **Step 6: Run the focused Create/UI tests and verify they pass.**

Run: `npx tsx --test tests/create-celestial.test.ts tests/tarot-auto-spread-ui.test.ts tests/tarot-recommendation.test.ts`

Expected: Create renders the advisory contract, the draft contains one exact Auto selection, localization keys exist in both locales, and recommender tests remain green.

### Task 3: Make Room authoritative for Auto/manual precedence and L1C handoff

**Files:**
- Modify: `app/room/room.tsx`
- Modify: `tests/tarot-auto-spread-ui.test.ts`

**Interfaces:**
- Consume `recommendTarotSpread`, `findCanonicalSpread`, `TarotSpreadSelectionMode`, and the existing `currentSpreadCatalog`/localized API catalog.
- Preserve the existing `/api/tarot/draw` payload and `SpreadBoard` geometry props.

- [x] **Step 1: Add failing tests for legacy hydration, manual precedence, and Auto return.**

Assert that Room state includes `spreadMode`, legacy state defaults to `"auto"`, draft restoration prefers exact `categoryId`/`spreadTemplateId` over recomputation, `chooseTemplate` writes `spreadMode: "manual"`, the Auto action calls the same recommender, and draw submission still uses `draft.categoryId`/`draft.spreadTemplateId`.

- [x] **Step 2: Run the Room contract tests and verify the new assertions fail.**

Run: `npx tsx --test tests/tarot-auto-spread-ui.test.ts tests/room-content.test.ts tests/room-defaults.test.ts tests/room-mobile.test.ts`

Expected: existing Room regressions pass and the new Auto/manual assertions fail before the state integration is added.

- [x] **Step 3: Extend the existing Room state and legacy normalizer.**

Add `spreadMode?: TarotSpreadSelectionMode` to the state, default it to `"auto"`, and normalize only `"auto"`/`"manual"`. During `ritual=1` draft restoration, use draft IDs when both are present; otherwise call the recommender with the draft question/topic and derive labels from the canonical catalog. Keep the current default state and saved room JSON readable.

- [x] **Step 4: Mark manual choices and add the Auto action.**

Update `chooseTemplate` to set `spreadMode: "manual"`. Add `chooseAutoSpread` that applies the current question/topic recommendation, localizes its labels through the hydrated catalog, sets `spreadMode: "auto"`, and uses the same existing reset guard so no spread changes after drawing/session creation. Add an Auto row before the category options in the existing picker; its selected state must reflect both mode and exact template ID.

- [x] **Step 5: Preserve the existing draw and SpreadBoard chain.**

Do not edit `submitDrawnCards` request fields, `/api/tarot/draw`, geometry calculation, or `SpreadBoard` rendering. Verify that the selected template still flows through `spreadTemplateId` → repository validation → draw plan → normalized geometry.

- [x] **Step 6: Run focused Room, spread, and UI tests.**

Run: `npx tsx --test tests/tarot-auto-spread-ui.test.ts tests/tarot-recommendation.test.ts tests/tarot-spread.test.ts tests/tarot-spread-geometry.test.ts tests/spread-board.test.ts tests/room-content.test.ts tests/room-defaults.test.ts tests/room-mobile.test.ts`

Expected: Auto/manual precedence, draft hydration, L1A/L1B/L1C, and mobile Room contracts pass.

### Task 4: Verify runtime behavior and protected-zone boundaries

**Files:**
- Modify: `docs/PROJECT_STATE.md`

- [x] **Step 1: Run TypeScript and the complete tracked suite.**

Run: `npx tsc --noEmit` and `npx tsx --test tests/*.test.ts`.

Expected: TypeScript exits 0 and the full suite reports 0 failures; record the exact counts.

- [x] **Step 2: Run the production build, targeted lint, and diff check.**

Run: `npm run build`, `npx eslint lib/tarot-recommendation.ts app/create/ritual.tsx app/room/room.tsx tests/tarot-recommendation.test.ts tests/tarot-auto-spread-ui.test.ts`, and `git diff --check`.

Expected: build and diff check exit 0. Targeted lint must have no new L4 errors; if legacy warnings/errors in the touched Room file remain, compare them to the clean L1C baseline and report only the delta.

- [x] **Step 3: Run one local browser verification pass at desktop, 390px, and 375px.**

Start the local preview from the isolated worktree. Verify `/create` shows the Auto recommendation for an English and Vietnamese question, has no horizontal overflow at all three widths, and navigates to `/room?ritual=1`. Verify Room opens with the recommended template, the spread picker can select a different template and leaves it selected, returning to Auto changes it back to the recommender's template, and the existing Celtic Cross/10-card layout still uses the L1C SpreadBoard. Stop the preview after capture.

- [x] **Step 4: Audit the final diff against protected zones.**

Run:

```bash
git diff --name-only a53dc44d5c088f2e9685e31f3e4a9dc51a09ebea
git diff -- app/api db drizzle lib/ai lib/auth lib/request-identity.ts deploy scripts
```

Expected: only the planned Create/Room/i18n/CSS/recommender/tests/docs files are changed; there is no migration, auth/security, AI/KB, API, draw, reading, or deployment change.

- [x] **Step 5: Record the verified milestone in `docs/PROJECT_STATE.md`.**

Append one concise dated entry naming the L4 branch, base, recommendation method, exact test/build/lint/browser evidence, and the unchanged DB/Auth/AI/draw/deployment boundaries. State that the branch is verified and pushed, not merged or deployed.

### Task 5: Review, commit, push, and verify the remote

**Files:**
- Commit only the planned L4 files after inspecting the staged diff.

- [x] **Step 1: Review the full diff and staged secret scan.**

Run `git diff --stat`, `git diff --check`, `git diff -- docs/superpowers/specs/2026-09-20-natarot-auto-topic-spread-l4-design.md docs/superpowers/plans/2026-09-20-natarot-auto-topic-spread-l4.md`, and `git diff --cached` after staging. Confirm there are no `.env`, credentials, runtime databases, generated build artifacts, unrelated user files, or protected-zone edits.

- [x] **Step 2: Commit one focused feature commit.**

Run:

```bash
git add lib/tarot-recommendation.ts app/create/ritual.tsx app/room/room.tsx lib/i18n.ts app/globals.css tests/tarot-recommendation.test.ts tests/tarot-auto-spread-ui.test.ts tests/create-celestial.test.ts docs/superpowers/specs/2026-09-20-natarot-auto-topic-spread-l4-design.md docs/superpowers/plans/2026-09-20-natarot-auto-topic-spread-l4.md docs/PROJECT_STATE.md
git commit -m "feat: add automatic tarot topic and spread recommendation"
```

- [x] **Step 3: Push normally and verify remote identity.**

Run `git push -u origin codex/natarot-auto-topic-spread-l4`, then `git rev-parse HEAD`, `git rev-parse origin/codex/natarot-auto-topic-spread-l4`, and `git status --short --branch`.

Expected: local and remote SHAs match, the branch is clean, and no merge or deployment occurs.
