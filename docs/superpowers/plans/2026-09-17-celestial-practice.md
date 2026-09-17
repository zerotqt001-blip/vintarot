# Celestial Practice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign `/community` (Luyện tập) as a calm Celestial Tarot Sanctuary while preserving its random card, reflection, interpretation, save, replacement and room actions.

**Architecture:** Keep `Practice` in `app/pages.tsx` and reuse `CardFace`, `cardMeaning`, `shuffleDeck`, `api`, `useLanguage` and the existing shell. Add semantic Practice composition classes and one scoped CSS layer in `app/globals.css`; motion uses class toggles with transform/opacity and reduced-motion fallbacks, without changing routes, API payloads or state meanings.

**Tech Stack:** React 19, TypeScript, existing lucide icons, CSS animations/transforms, Node test runner via `tsx` and Vinext build.

**Spec:** `/Users/tranquangthanh/.codex/attachments/3486c965-12aa-4e52-bf7d-9b253bab449c/pasted-text.txt`

## Global Constraints

- Preserve the existing NaTarot header, sidebar, typography, card artwork, buttons, API payload and `/community` route.
- Keep the midnight navy `#020B18` / `#061426` / `#0A1B32` palette with champagne gold accents and a dark, readable center.
- Use transform/opacity motion only for card replacement, interpretation reveal and sanctuary decoration.
- Keep English and Vietnamese copy through `useLanguage`; do not add a new translation source.
- Support `prefers-reduced-motion: reduce` and mobile layouts without horizontal overflow.

### Task 1: Practice composition and state-preserving interaction

**Files:**
- Modify: `app/pages.tsx` (`Practice` function)
- Test: `tests/celestial-surfaces.test.ts` (existing Practice contract)

**Interfaces:**
- Consumes: existing `id`, `shown`, `text`, `message` state; `shuffleDeck`, `cards`, `cardMeaning`, `api`, `t`, `locale`.
- Produces: `.practice-cosmic-page`, `.practice-celestial-scene`, `.practice-card-stage`, `.practice-reflection`, `.practice-interpretation`, `.practice-community-card` markup while retaining every current action handler.

- [ ] **Step 1: Write/extend the failing test**

Assert the Practice source contains the six semantic classes, the existing card/random/API/action calls, and a card transition state marker.

- [ ] **Step 2: Run the focused test**

Run: `npx tsx --test --test-name-pattern='practice page' tests/celestial-surfaces.test.ts`

Expected: FAIL because the Celestial classes are not present in the current Practice markup.

- [ ] **Step 3: Implement the composition**

Wrap the current Practice body in a `practice-cosmic-page`; add decorative scene layers, moon phases and a labeled hero. Keep the current random card, textarea, reveal toggle, save handler and `/room` CTA. Add a local `cardChanging` boolean to apply an exit class before replacing the id, then clear it after the next frame; reveal interpretation in a dedicated `.practice-interpretation` panel.

- [ ] **Step 4: Run the focused test and typecheck**

Run: `npx tsx --test --test-name-pattern='practice page' tests/celestial-surfaces.test.ts` and `npx tsc --noEmit`.

Expected: focused test passes and TypeScript reports no errors.

### Task 2: Celestial Practice styling and responsive motion

**Files:**
- Modify: `app/globals.css` (scoped `.practice-cosmic-page` layer)

**Interfaces:**
- Consumes: semantic classes produced by Task 1 and existing global NaTarot tokens/assets.
- Produces: dark celestial sanctuary background, 2-column desktop composition, mobile flow, card frame, reflection surface, interpretation panel and community card.

- [ ] **Step 1: Add scoped CSS**

Use `/room/celestial-observatory.png` as the existing local visual universe, dark radial center overlay, restrained rings/stars, gold glass surfaces, card hover lift, `.practice-card-swap` and card-entry transitions, and reduced-motion overrides. Scope every rule to `.practice-cosmic-page` so other routes keep their current styling.

- [ ] **Step 2: Run focused verification**

Run: `npx tsx --test --test-name-pattern='practice page' tests/celestial-surfaces.test.ts`, `npx tsc --noEmit`, `npm run build`, and `git diff --check`.

Expected: all commands exit 0; no dev server or watch mode is started.

- [ ] **Step 3: Update project state and commit**

Update `docs/PROJECT_STATE.md` with the completed Practice composition and validation, inspect the staged diff for secrets, then commit only the Practice files and tests with `feat(practice): add celestial sanctuary experience`.
