# NaTarot L4 Auto Topic + Auto Spread Design

## Goal

When a visitor provides a question, NaTarot should make a fast, explainable recommendation from the existing topic taxonomy and canonical L1 spread catalog, show that recommendation before the room opens, and preserve the visitor's ability to choose a different spread.

## Scope and boundaries

This is a local recommendation and handoff feature. It does not call an AI provider, add an API route, write recommendation metadata to D1, change the draw request contract, change reading semantics, or alter authentication, security, deployment, or runtime configuration.

The existing L1C responsive `SpreadBoard` remains the only geometry and rendering authority. The existing D1 catalog remains the only spread-definition authority. The existing Room draw path remains responsible for validating the final category/template pair before persistence.

## Architecture

### Pure recommender

`lib/tarot-recommendation.ts` will own the reusable topic identifiers, intent classification, deterministic keyword scoring, topic-to-category mapping, canonical template lookup, reason keys, and safe fallback. It will use `currentSpreadCatalog` from `lib/tarot-catalog.ts` to resolve every returned template and verify that the template's card count matches its canonical positions.

The public contract is intentionally small:

```ts
type TarotSpreadSelectionMode = "auto" | "manual";

type TarotRecommendation = {
  mode: "auto";
  detectedTopic: TarotTopic;
  intent: TarotRecommendationIntent;
  recommendedSpreadId: string;
  categoryId: string;
  confidence: "high" | "medium" | "low";
  reasonKey: TarotRecommendationReasonKey;
};
```

The classifier normalizes English and Vietnamese text, scores relationship, career/finance, creativity, life-change and self-reflection signals, then refines the selected topic with broad intent signals such as decision, obstacle, direction, and self-reflection. An explicitly chosen existing topic is respected as the topic input; an empty or ambiguous question uses the everyday `Persona, Obstacle, Solution` spread as the safe fallback. All lookup failures also fall back to that canonical template rather than returning a fabricated ID.

### Create handoff

`app/create/ritual.tsx` will compute the recommendation synchronously as the question changes. A compact bilingual recommendation surface will expose the detected topic, spread name, card count, and reason. The existing submit/suggestion actions will store the final auto selection in the current `vintarot:new-reading` session draft: question, optional context, topic, category ID, template ID, and `spreadMode: "auto"`.

No new URL fields or server endpoint are required. The recommendation is advisory; the draft contains an explicit selection so Room does not need to reinterpret the question before drawing.

### Room authority and override

`app/room/room.tsx` will extend its existing JSON room state with `spreadMode`, defaulting to `"auto"` for legacy state. Draft restoration uses the exact draft category/template when supplied, and only falls back to the pure recommender for older drafts that do not contain those IDs. The existing spread picker remains the manual override surface. Selecting a template sets `spreadMode: "manual"` and never lets a later question edit overwrite it. A dedicated Auto option resolves the current question/topic through the same recommender, sets `spreadMode: "auto"`, and is disabled after drawing has started by the existing reset guard.

Draw submission continues to send the final `category_id` and `spread_template_id` to `/api/tarot/draw`; no draw or reading code is changed. The stored session therefore records exactly the spread the visitor confirmed through the existing server validation boundary.

## UI direction

The Create surface keeps its existing Moonlight-inspired cosmic composition. The recommendation is a restrained glass/gold card below the question field or suggestion list, with a small `AUTO` marker and plain-language helper copy. It must not become a new wizard or replace the topic or question flow. The Room picker adds only a compact Auto recommendation row above the existing catalog options and keeps all existing responsive behavior, safe-area spacing, and reduced-motion rules.

Required strings are added in English and Vietnamese only for the recommendation label, detected-topic label, reason text, Auto mode, manual selection state, and return-to-Auto action.

## Error and compatibility behavior

- A blank question yields the canonical general fallback and never throws.
- Short or mixed-language input is accepted and produces a low-confidence, catalog-valid result.
- If a topic keyword is present but a refined spread slug is absent, the topic's safe default is used.
- Legacy room JSON without `spreadMode` remains readable and behaves as Auto.
- Existing room JSON with a manually selected category/template remains authoritative.
- If catalog API hydration fails, the existing local catalog fallback still renders the picker and the recommendation IDs remain based on the same local source.

## Verification

Focused tests will cover bilingual relationship and career detection, finance mapping without adding a new topic taxonomy, ambiguous/short/empty fallback, deterministic output, canonical IDs and card counts, Create draft wiring, manual override precedence, return-to-Auto behavior, and source-level UI/accessibility hooks. Existing L1A/L1B/L1C spread tests remain unchanged and will run with the full tracked suite. TypeScript, production build, targeted lint, diff check, and browser checks at desktop, 390px, and 375px will be run before commit.
