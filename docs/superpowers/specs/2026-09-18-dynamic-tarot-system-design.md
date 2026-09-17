# Dynamic Tarot Reading System Design

**Date:** 2026-09-18
**Status:** Design approved in chat; written spec awaiting user review
**Project:** VinTarot / NaTarot

## Intent

Complete the existing Tarot flow in the current VinTarot project so that Room uses the existing Moonlight-inspired experience while its catalog, spreads, draw sessions, card positions, orientations, and interpretations come from a durable Tarot data model.

The work must be an incremental extension of the current Next/vinext + TypeScript + React + Cloudflare D1/Drizzle application. It must not create a new project, replace the current interface, rename the NaTarot/VinTarot product, or discard the existing Room motion and mobile changes.

## Goals

1. Normalize the existing 78 Rider–Waite–Smith cards into D1 with stable identifiers, existing artwork paths, English/Vietnamese names, and four meaning variants per card.
2. Normalize the current Room categories, spreads, and positions into D1 while preserving their visible names, order, and Moonlight reference grouping.
3. Add a guest-safe catalog endpoint and a dynamic draw endpoint that use the selected spread’s database positions and card count rather than fixed three-card assumptions.
4. Let a visitor complete a reading without signing in. Require sign-in only for saving a reading, journal/history access, shared-room persistence, or other personal storage.
5. Keep the current Room visuals, card placement, fan interactions, orientation setting, mobile menu, and smooth direct-placement behavior while replacing hardcoded selection/draw data with API data.
6. Add a bilingual interpretation flow with an optional server-side AI adapter and a deterministic local fallback based on the project’s existing long-form narratives.
7. Keep old routes and existing saved Room state readable during the migration.

## Non-goals

- Rebuilding the site or replacing the Moonlight/Celestial Luxury visual language.
- Deleting `lib/tarot.ts`, `lib/tarot-locales.ts`, `lib/tarot-narrative.ts`, or `lib/card-images.json`; they remain compatibility/source assets during and after the migration.
- Introducing payments, video, email, a second authentication provider, or a new hosting project.
- Making Tarot interpretations deterministic claims about health, law, finance, or guaranteed future events.
- Requiring an AI API key for a guest to draw cards.
- Changing the current category names, spread names, position order, or card artwork paths merely to make the database model cleaner.

## Existing constraints to preserve

- The work stays on the current `codex/` branch and in the current workspace.
- Existing uncommitted changes in `app/room/room.tsx`, `app/globals.css`, `lib/i18n.ts`, and the untracked regression tests are user work and must not be overwritten.
- D1/SQLite is the source of persisted Tarot data. Drizzle schema and migrations remain the database interface.
- The public artwork paths in `lib/card-images.json` remain valid. The seeded `image_url` value must use those paths; CDN artwork can remain a visual fallback where the existing UI already uses it.
- The current public Room API remains compatible with previously saved room records.
- English (`en`) and Vietnamese (`vi`) are the only supported locales in this feature.

## Data architecture

### Canonical card identifiers

Each card receives a stable text ID derived from its existing canonical slug, for example `major-the-fool` or `wands-ace`. The existing `cards[].id` order is retained as `card_number` (0–77) so the current guidebook and Room can continue to map legacy numeric state without guessing. The seed must fail validation if there are not exactly 78 cards, if any slug/card number/display order is duplicated, or if an image path is missing.

The database is authoritative for new API reads. The existing TypeScript card list remains a compatibility source and a seed input, not a second runtime catalog that can silently disagree with D1.

### Tables

Add Drizzle definitions and a migration for these tables, using the field names from the product specification and explicit indexes/unique constraints:

- `decks`: stable deck slug, display name, artist, description, and timestamps.
- `tarot_cards`: deck, stable slug ID, card number, English/Vietnamese names, arcana, suit, image URL, display order, and timestamps. Enforce unique `(deck_id, card_number)`, `(deck_id, slug)`, and `(deck_id, display_order)`.
- `card_meanings`: card, locale, orientation (`upright` or `reversed`), summary, energy, actions, relationships, work, creativity, home, symbolism, journal questions, keywords, and timestamps. Enforce unique `(card_id, locale, orientation)`.
- `spread_categories`: stable slug, English/Vietnamese name and description, icon/image reference, display order, active flag, and timestamps.
- `spread_templates`: category, stable slug, English/Vietnamese name and description, card count, spread type, display order, active flag, and timestamps.
- `spread_positions`: template, position key/order, English/Vietnamese label and description, English/Vietnamese interpretation prompt, and timestamps. Enforce unique `(spread_template_id, position_key)` and `(spread_template_id, position_order)`.
- `reading_sessions`: optional authenticated user ID, optional guest ID, question, optional context, category/template IDs, spread type, card count, locale, status, and timestamps.
- `reading_cards`: session, canonical card ID, spread position ID, position key/order/label snapshot, orientation, card order, and created timestamp. Enforce unique `(session_id, card_order)` and `(session_id, spread_position_id)`.
- `readings`: session, localized opening, card readings, synthesis, advice, closing, disclaimer, model name, prompt version, and timestamps.

`reading_cards` stores position labels and keys as a snapshot in addition to foreign keys. A future catalog edit therefore cannot rewrite the meaning of a completed reading.

### Seed and import strategy

Create one idempotent Tarot seed source that assembles:

- the 78 cards from `lib/tarot.ts` and `lib/card-images.json`;
- Vietnamese card names from a checked-in static mapping, with no runtime translation request;
- four meaning rows per card by calling the existing `cardNarrative(card, locale, orientation)` for both locales and orientations;
- the current categories/templates/positions from a checked-in mapping;
- the Rider–Waite–Smith deck row.

The seed writes with upsert semantics and validates counts before making changes. It must preserve existing IDs and image paths on reruns. A seed/import command will be documented for the configured D1 environment and local D1; it will not be exposed as a public HTTP endpoint. The migration creates schema only, so schema deployment and content seeding can be verified separately.

The current visible category and spread mapping is canonical and ordered as follows:

| Category | Templates in current order | Positions come from |
| --- | --- | --- |
| Relationships | Relationship check-in | `You`, `Connection`, `Them` |
| Planning | One small step; Past · Present · Future | `Your focus`; `Past`, `Present`, `Future` |
| Moon Phase | Three-card insight | `Persona`, `Obstacle`, `Solution` |
| Creativity | Social battery check | `How I feel`, `What I need` |
| Business | Past · Present · Future | `Past`, `Present`, `Future` |
| Fool’s Journey | Celtic cross | `The present`, `The challenge`, `Foundation`, `Recent past`, `Possibility`, `Near future`, `Your approach`, `Your surroundings`, `Hopes and fears`, `Direction` |

The displayed localized strings can continue to use the existing i18n keys, but the database rows must contain independent English and Vietnamese values. Categories are never inserted into the card catalog.

## Server boundaries

### Optional identity and guest ownership

Add a server helper that attempts to read the existing ChatGPT identity without rejecting an anonymous request. If no authenticated user exists, issue or reuse an opaque, HttpOnly guest cookie and use its non-PII value as `reading_sessions.guest_id`. The guest cookie is only an ownership boundary for the visitor’s session; it is not presented as an account or used for profile data.

Authenticated operations continue to use the project’s existing `identity()` guard. A save/history/room persistence request made without an account returns the existing sign-in response rather than creating a partial personal record.

### Catalog endpoint

Add `GET /api/tarot/catalog?locale=en|vi`.

The response contains active categories in display order, each active template in display order, and each template’s ordered position metadata. It includes localized names, descriptions, labels, prompts, card count, and spread type. It does not return all card meanings or private reading data. Invalid locales are rejected with `400`; an unavailable/empty seed is a server error with a user-readable retry path.

### Dynamic draw endpoint

Add `POST /api/tarot/draw` with this input shape:

```ts
type DrawRequest = {
  question: string;
  optional_context?: string;
  category_id: string;
  spread_template_id: string;
  deck_id: string;
  locale: 'en' | 'vi';
  reversals?: boolean;
};
```

The endpoint trims and length-validates text, verifies that the template belongs to the selected active category, loads the ordered active positions, and checks that the position count equals the template card count. It draws exactly that many unique cards from the selected deck using a cryptographically secure shuffle, assigns an orientation for each card when reversals are enabled, writes one session and one `reading_cards` row per position, and returns the session plus ordered card metadata.

The response contains `session_id`, localized category/template data, locale, and cards with canonical card ID, card number, names, arcana/suit, image URL, orientation, position key/order/label/description, and reading-card ID. The response never assumes three positions and never returns fixed `portraitCard`, `obstacleCard`, or `solutionCard` properties.

Errors are explicit: malformed input is `400`, missing/inactive category/template/deck is `404`, mismatched category/template or position count is `409`, and unexpected D1/provider failures are `500` with an opaque request ID in server logs only.

### Interpretation endpoint

Add `POST /api/tarot/interpret` with:

```ts
type InterpretRequest = {
  session_id: string;
  locale: 'en' | 'vi';
};
```

The server loads the session, ordered reading cards, position prompts, and the four-field meaning variant matching each card’s locale/orientation. It builds a bounded, localized prompt that asks for reflective guidance, preserves the position meaning, avoids certainty and high-stakes claims, and includes the product disclaimer.

The provider adapter is server-only and activated only when the deployment has an AI key/configuration. Its output is parsed against the fixed reading shape:

```ts
type ReadingPayload = {
  opening: string;
  card_readings: Array<{
    reading_card_id: string;
    position_key: string;
    interpretation: string;
    reflection_prompt: string;
  }>;
  synthesis: string;
  advice: string;
  closing: string;
  disclaimer: string;
};
```

If the provider is missing, times out, returns invalid JSON, or fails safety/length validation, the endpoint returns a deterministic local reading assembled from `cardNarrative` and the stored position prompts. The response marks `source` as `ai` or `local-fallback`; it never claims that the fallback was generated by AI. Successful output is persisted in `readings` with `model_name` and a checked-in `prompt_version`.

## Client/data flow

### Create flow

Keep `/create`’s current two-step topic/question experience. Add an optional, clearly secondary context field on the question step. The one-use `sessionStorage` draft transfers `question`, `optional_context`, selected topic/category slug, locale, and timestamp to `/room?ritual=1`; it does not put the question or context in the URL.

### Room catalog and selection

On Room entry, request the catalog in the selected locale. The existing Moonlight side panel continues to show the six category labels and their current order. Selecting a category reveals its database-backed templates; selecting a template highlights it and updates the ordered position preview/card count. The draw control is disabled until a valid category/template is selected. On mobile, the existing sheet/scroll behavior remains, with no horizontal overflow.

The selected category/template IDs are stored in the Room state alongside the legacy `spread` labels. For old saved rooms that only have labels, hydrate the nearest matching seeded template by stable slug/position names and keep rendering the saved labels. Do not silently change an old completed reading’s positions.

### Room draw and rendering

Before the first draw, Room calls `POST /api/tarot/draw` with the current question, optional context, selected category/template/deck, locale, and reversals setting. The returned ordered cards are adapted into the existing Room visual state so the current fan, tap, keyboard, drag ghost, direct placement, flip, pan, and mobile behavior remain intact.

The new render path maps over returned cards and the database positions. It uses the returned `image_url` and canonical card metadata, with the current local image fallback. No view may branch on a fixed three-card position name. The card placement helper receives `(cardIndex, cardCount)` and continues to use deterministic centered slots, including the 1-, 2-, 3-, and 10-card cases.

When enough cards have been drawn, `Suy ngẫm` opens the existing reflection surface. It keeps the user’s notes and save-to-journal behavior and adds a localized interpretation action. The interpretation result renders the ordered position readings, synthesis, advice, closing, and disclaimer in a scrollable, mobile-safe panel.

Guest draw and interpretation remain available. Save-to-journal, history, shared-room persistence, and profile-linked records keep the existing sign-in boundary and explain it in the current locale.

### State compatibility

Extend the current Room state schema with optional fields rather than removing existing fields:

```ts
type TarotRoomData = {
  categoryId?: string | null;
  spreadTemplateId?: string | null;
  optionalContext?: string;
  sessionId?: string | null;
  cards: Array<{
    id: number;          // retained for legacy UI/state compatibility
    cardId?: string;     // canonical DB ID for new draws
    reversed: boolean;
    face: boolean;
    x: number;
    y: number;
  }>;
};
```

The existing `spread`, `question`, `notes`, `texts`, phase, theme, and reversals fields remain. Existing persisted rooms continue to load through the current schema. New draw results carry both the current numeric card number and canonical `cardId`, allowing gradual migration of CardFace/CardPicker consumers without a broad rewrite.

## Error and recovery behavior

- Catalog loading shows a retry state and leaves the current Room surface usable; it does not display an empty selection as if no spreads exist.
- A failed draw leaves the fan and prior cards unchanged, reports a localized status message, and allows retry. It never creates a partial client spread.
- A draw response is applied only once per successful session response; repeated clicks are disabled while the request is in flight.
- Interpretation failure falls back locally and visibly marks the source; if even the local payload cannot be built, the user keeps the drawn cards and notes and receives a retry action.
- Auth failures affect only save/history/shared persistence actions. They never block a guest from drawing or reading the fallback interpretation.
- Old room states and old journal records are read with their existing fields; new schema fields are optional until the first dynamic draw.

## Testing and acceptance

Use the repository’s current `tsx --test`/source-test conventions and browser checks. Every implementation slice starts with a failing test and then the smallest implementation that makes it pass.

### Data and API tests

- Seed validation reports exactly 78 cards, five card families, stable IDs, existing image paths, and four meaning variants per card.
- Category/template import preserves the six category order, visible template names, position order, and one-position-per-card-count invariant.
- Catalog response is localized and contains no card-category mix-up.
- Draw creates one session, exactly `card_count` reading cards, unique cards, ordered dynamic positions, and requested locale/orientation values.
- Invalid category/template/deck, mismatched ownership, empty questions, and malformed locale return the documented status codes.
- A guest can draw and interpret; unauthenticated save still returns the existing sign-in response.
- Interpretation validates the fixed payload, records `source`/model/prompt version, and uses local fallback when no provider is configured or a provider response is invalid.

### UI and interaction tests

- Room requests and renders catalog templates through `map`, not hardcoded three-card properties.
- A selected spread’s actual card count controls the fan draw limit and position layout for one, two, three, and ten cards.
- Tap, keyboard, and drag selection all place the selected card into the same deterministic slot without the removed release animation.
- Existing six-topic Room panel, mobile bottom sheet, desktop toolbar, direct table gestures, and reduced-motion behavior remain present.
- `Suy ngẫm` is reachable after drawing, localized, scrollable, and preserves notes/save behavior.
- Create-to-Room transfers question, optional context, category, and locale without exposing them in the URL.
- Browser verification checks 390×844 and desktop Room bounds, no horizontal overflow, catalog selection, exact draw count, card placement, flip/orientation, guest interpretation, and sign-in gating for save.

Run `npx tsc --noEmit`, the focused tests, the tracked test suite, `npm run build`, and `git diff --check`. Existing repository lint failures are reported separately if they remain unchanged.

## Delivery sequence

Implementation will be split into independently testable slices:

1. Schema, migration, seed source, and catalog service.
2. Guest/session ownership and dynamic draw API.
3. Create/Room catalog selection and dynamic card rendering.
4. Interpretation service/API, local fallback, and `Suy ngẫm` UI.
5. Save/history compatibility, browser verification, project-state update, commit/push, and only then public Site publication after the resulting build is verified.

Each slice must preserve the existing worktree changes, run its focused tests, and commit only related files. No credentials, runtime databases, or build output may be committed.
