# NaTarot Reading Presentation V1.2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refine the existing NaTarot ReadingPanel presentation so its header, metadata, editorial sections, numbering, and responsive spacing are calmer and easier to scan without changing reading behavior.

**Architecture:** Keep the current ReadingPanel composition, follow-up behavior, left Tarot stage, and all data/provider boundaries intact. Make the duplicate-number fix and metadata semantics explicit in the small reading components, then scope the visual treatment to `.room-reading-panel-shell` in `app/globals.css` so the change cannot redesign other surfaces.

**Tech Stack:** React/TSX, scoped CSS in `app/globals.css`, Node test runner through `tsx`, TypeScript, Vinext production build, browser screenshot QA.

**Spec:** Approved V1.2 requirements in `/Users/tranquangthanh/.codex/attachments/641031a5-a66c-4f5e-b3d2-6fa1f8a3ee7a/Văn bản đã dán.txt` (the task attachment is the authoritative spec for this bounded change).

## Global Constraints

- Keep `tarot-reading-v4.1`, all prompts, Knowledge Base V5, provider configuration, schema, APIs, persistence, authentication/F-001, cards, spreads, Saved Reading V1, the left Tarot stage, and follow-up behavior unchanged.
- Do not change AI-generated content or make provider/DeepSeek calls.
- Do not touch the unrelated Home work from the root worktree; this worktree is based at `757b3b366eb9e16635712302b2f59b889f113f62`.
- Change only presentation markup/CSS and focused presentation tests; do not add boxes, redesign the follow-up section, or compensate for the host overlay.
- Create one local commit only, with no push or deployment.

---

### Task 1: Add failing Reading Presentation V1.2 contract tests

**Files:**
- Create: `tests/tarot-reading-presentation-v1-2.test.ts`
- Read: `components/reading/reading-header.tsx`, `components/reading/personal-insights.tsx`, `components/reading/next-steps.tsx`, `components/reading/direct-answer.tsx`, `app/globals.css`, `components/reading/follow-up-reading.tsx`, `app/room/room.tsx`

**Interfaces:**
- Consumes: current ReadingPanel component source and scoped stylesheet as text contracts, plus existing frozen follow-up/Room source.
- Produces: focused regression assertions for the new metadata hooks, one-number rendering, scoped compact editorial rules, and frozen behavior boundaries.

- [ ] **Step 1: Write the failing test**

  Add assertions that require:
  - the header to expose separate spread-position and deck metadata hooks;
  - insight and next-step rows to render one explicit padded index and not use CSS-generated `counter()` numbering;
  - the V1.2 CSS to compact the header, quiet metadata/deck, preserve a 72ch prose cap, and provide scoped editorial section rhythm;
  - the follow-up source and Room interpretation boundary to retain their existing structure.

- [ ] **Step 2: Run the focused test and verify it fails**

  Run:

  ```bash
  npx tsx --test tests/tarot-reading-presentation-v1-2.test.ts
  ```

  Expected: FAIL because the current header has no separate metadata hooks, the legacy generated counter rule remains, and the V1.2 scoped rules do not yet exist.

---

### Task 2: Implement the minimal presentation markup and CSS

**Files:**
- Modify: `components/reading/reading-header.tsx`
- Modify: `components/reading/personal-insights.tsx`
- Modify: `components/reading/next-steps.tsx`
- Modify: `app/globals.css`
- Test: `tests/tarot-reading-presentation-v1-2.test.ts`

**Interfaces:**
- Consumes: the current `ReadingSessionMetadata`, translated labels, and existing editorial list components.
- Produces: a compact, responsive ReadingPanel presentation with stable metadata/deck hooks and a single visible `01`/`02`/`03` numbering system.

- [ ] **Step 1: Remove only the source of duplicate list ordinals**

  Keep the existing `<ol>` semantics and explicit `String(...).padStart(2, "0")` spans in `PersonalInsights` and `NextSteps`; remove the scoped legacy pseudo-element/counter rule from `app/globals.css`. Do not alter item order, content, disclosure behavior, or the follow-up component.

- [ ] **Step 2: Add minimal header metadata hooks**

  Give the spread-position metadata wrapper and deck metadata wrapper distinct classes/data hooks while retaining the same translated values, question, title, and conditional rendering.

- [ ] **Step 3: Add scoped V1.2 styling**

  In the `.room-reading-panel-shell` scope only:
  - reduce header block padding and inter-element gaps without changing title scale;
  - make positions muted and less letter-spaced, allow them to wrap, and style the deck as a separate tertiary line;
  - keep the takeaway open with its gold rule and align it to the existing centered grid;
  - tighten section-to-section cadence and list row separators while preserving the 72ch prose width;
  - keep major section headings distinct from secondary disclosure headings;
  - keep the existing follow-up selectors/interaction structure unchanged;
  - add mobile overrides for wrapped metadata, readable spacing, aligned indices, and no horizontal overflow.

- [ ] **Step 4: Run the focused test and verify it passes**

  Run:

  ```bash
  npx tsx --test tests/tarot-reading-presentation-v1-2.test.ts tests/tarot-reading-ui.test.ts
  ```

  Expected: PASS with the existing Reading UI contracts preserved.

---

### Task 3: Run regression validation and visual QA

**Files:**
- No additional source files; screenshots are saved outside the commit or in the task artifact directory.

**Interfaces:**
- Consumes: the V1.2 implementation and the approved local production build path.
- Produces: test/build evidence and desktop/mobile screenshots at `1440x900`, `1280x720`, `390x844`, and `375x812`, without provider calls.

- [ ] **Step 1: Run focused Reading, Room, and Saved Reading tests**

  Run the relevant `tests/tarot-reading-ui.test.ts`, Room tests, and Saved Reading tests with `npx tsx --test`; record each result.

- [ ] **Step 2: Run all Tarot tests and the full tracked suite**

  Run:

  ```bash
  npx tsx --test tests/tarot*.test.ts
  git ls-files 'tests/*.test.ts' | xargs npx tsx --test
  ```

- [ ] **Step 3: Run typecheck, production build, and whitespace validation**

  Run:

  ```bash
  npx tsc --noEmit
  npm run build
  git diff --check
  ```

  Do not configure or invoke a Tarot reading during this validation.

- [ ] **Step 4: Perform bounded browser QA**

  Start the built worktree locally on an unused port without clicking the interpretation/provider path. Inspect the real ReadingPanel using existing local reading data or a safe existing fixture if available. Capture the desktop top/middle/bottom and mobile top/lower surfaces, verify compact header, quiet metadata, one-number lists, controlled prose width, unchanged follow-up/left stage, footer access, and no overflow. If the local runtime cannot render a completed panel without a provider call, document that blocker rather than making a provider request.

- [ ] **Step 5: Audit the final diff and commit once**

  Confirm only the plan, focused presentation test, ReadingPanel presentation components, and scoped CSS changed; inspect the staged diff for secrets and frozen-file changes. Commit:

  ```bash
  git add docs/superpowers/plans/2026-09-19-tarot-reading-presentation-v1-2.md tests/tarot-reading-presentation-v1-2.test.ts components/reading/reading-header.tsx components/reading/personal-insights.tsx components/reading/next-steps.tsx app/globals.css
  git diff --cached --check
  git commit -m "ui: refine tarot reading presentation"
  ```
