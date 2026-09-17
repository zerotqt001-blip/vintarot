# AI Tarot Reading Engine Design

**Date:** 2026-09-18
**Status:** Approved in chat; spec ready for user review
**Project:** VinTarot / NaTarot

## Intent

Replace the production Tarot interpretation path that assembles local card
templates with a provider-neutral AI reading engine. The engine must read one
complete spread in one context, grounded by authoritative D1 card knowledge,
spread position meaning, the user question, orientation, locale, and reading
category. The existing Room experience, card draw behavior, and Moonlight /
Celestial visual language remain intact.

The immediate provider set is OpenAI, Gemini, and DeepSeek. Provider selection
is explicit and server-side; a missing or failing selected provider is an
error with retry, not an implicit provider switch and not a silent legacy
template fallback.

## Current architecture audit

- `lib/tarot.ts` owns the compatibility 78-card TypeScript catalog, numeric
  card order, artwork paths, and compact English meanings.
- `lib/tarot-locales.ts` supplies Vietnamese compact meanings.
- `lib/tarot-narrative.ts` owns long-form Guidebook narrative templates and is
  used by Guidebook UI plus the seed generator. It is not allowed to remain
  the runtime final-reading engine.
- D1/Drizzle already contains `decks`, `tarot_cards`, `card_meanings`, spread
  category/template/position tables, `reading_sessions`, `reading_cards`, and
  `readings`.
- `POST /api/tarot/draw` validates the selected catalog and exact user-chosen
  cards, assigns orientations, stores a guest-safe session, and returns the
  resulting card/position metadata.
- `POST /api/tarot/interpret` currently loads the session and meanings but
  sends a thin generic prompt through `TAROT_AI_*`; its local fallback creates
  per-card copy and generic synthesis. The current Room result panel renders
  `opening`, `card_readings`, `synthesis`, `advice`, `closing`, and `disclaimer`.
- The current working tree contains user changes in Room/catalog/migrations;
  implementation must preserve unrelated edits and use additive compatibility
  changes.

## Goals

1. Make the AI engine the only production final-reading generator.
2. Ground the request in trusted database records for only the cards in the
   current session; never accept client-supplied card knowledge.
3. Give the model the full spread at once, including category, spread, ordered
   positions, position meaning/prompt, card metadata, orientation, and both
   orientation knowledge variants for each drawn card.
4. Make the question materially affect the reading and require all prose to
   follow the selected `en` or `vi` locale.
5. Support explicit provider selection among OpenAI, Gemini, and DeepSeek
   behind one `TarotAIProvider` interface.
6. Return validated structured JSON that the existing Room result surface can
   render without a visual redesign.
7. Preserve the physical D1 schema and existing saved data where possible.
8. Cover provider, prompt, validation, API, security, failure, locale, and
   quality-fixture behavior with focused tests.

## Non-goals

- Changing how cards are shuffled, selected, oriented, or placed in Room.
- Letting an AI provider choose, redraw, replace, or add cards.
- Sending all 78 cards, card images, or image binary data to a provider.
- Rewriting the Guidebook or replacing the Moonlight/Celestial visual world.
- Adding Gemini/DeepSeek SDK dependencies when server-side HTTP adapters are
  sufficient.
- Adding payments, accounts, history UI, or unrelated persistence features.
- Treating Tarot as a certainty, medical/legal/financial advice engine, or
  deterministic future predictor.

## Architecture

### End-to-end flow

```text
Room question + selected spread + application-drawn cards
        |
        v
POST /api/tarot/reading { session_id, locale }
        |
        v
Owner/session validation
        |
        v
Load category, spread, positions, exact drawn cards, and both card orientations
from D1; reconstruct trusted context server-side
        |
        v
Select TAROT_AI_PROVIDER -> OpenAI | Gemini | DeepSeek
        |
        v
Provider adapter receives one complete spread context
        |
        v
Provider JSON -> shared Zod validation -> card/position metadata normalization
        |
        v
Structured TarotReadingPayload -> persist compatibility columns -> Room UI
```

### Provider-neutral modules

The implementation will add a small `lib/ai/` boundary:

- `lib/ai/types.ts` — provider-neutral input and output types. The input
  contains the question, optional context, target locale, category, spread,
  ordered positions, and one trusted context object per drawn card.
- `lib/ai/provider.ts` — the `TarotAIProvider` interface and provider error
  categories. Business logic depends only on this interface.
- `lib/ai/openai.ts` — OpenAI HTTP adapter. It uses the Responses API,
  server-side authorization, versioned instructions, strict JSON schema,
  timeout, and one bounded retry for transient failures.
- `lib/ai/gemini.ts` — Gemini HTTP adapter. It maps the common prompt and
  shared JSON schema to Gemini’s native structured JSON request and converts
  its response into the shared payload.
- `lib/ai/deepseek.ts` — DeepSeek HTTP adapter. It maps the common prompt and
  JSON response request to DeepSeek’s API and converts the response into the
  shared payload.
- `lib/ai/factory.ts` — reads the server environment, validates the selected
  provider, and returns exactly one configured provider. It never silently
  falls through to another provider.
- `lib/ai/prompts/tarot-reading.ts` — `TAROT_PROMPT_VERSION`, system prompt,
  shared input serialization, and the provider-neutral JSON schema.
- `lib/tarot-interpretation.ts` — shared Zod validation, exact card coverage
  checks, metadata normalization, and compatibility exports used by the API
  and tests. It does not build a production local narrative.

The interface is intentionally provider-neutral:

```ts
interface TarotAIProvider {
  readonly id: "openai" | "gemini" | "deepseek";
  readonly model: string;
  generateReading(input: TarotReadingInput): Promise<TarotReadingPayload>;
}
```

Provider adapters may use different request formats, response extraction, and
structured-output capabilities. They must all return the same validated
domain payload or throw a classified provider error. The route and repository
never import an OpenAI, Gemini, or DeepSeek SDK type.

### Server-side configuration

Provider choice is explicit:

```env
TAROT_AI_PROVIDER=openai|gemini|deepseek

OPENAI_API_KEY=...
OPENAI_TAROT_MODEL=...

GEMINI_API_KEY=...
GEMINI_TAROT_MODEL=...

DEEPSEEK_API_KEY=...
DEEPSEEK_TAROT_MODEL=...
```

Only the selected provider’s key/model are required at runtime. Optional
provider base URLs may be injectable in tests, but production uses the
provider’s documented endpoint and does not accept a browser-supplied URL.
The worker environment type declarations will include these names as optional
server bindings. No key is imported by client components or serialized into a
response.

If `TAROT_AI_PROVIDER` is missing, unsupported, or selected credentials are
missing, the API returns a safe configuration error. There is no automatic
OpenAI -> Gemini -> DeepSeek fallback because that would make provider choice
and cost unpredictable.

The prompt version is source-controlled as `tarot-reading-v2`; changing the
system prompt requires changing the version constant and documenting the
change. The provider/model and prompt version are persisted with successful
readings and included in non-sensitive observability logs.

## Trusted Tarot context

The client sends only:

```ts
{ session_id: string; locale: "en" | "vi" }
```

The server first checks the HttpOnly guest/user owner of the session. It then
loads the category and spread template by stored IDs, ordered spread positions
by stored position IDs/keys, and the exact `reading_cards` rows. For each
drawn card it loads:

- canonical card ID, English/Vietnamese name, arcana, suit, and keywords;
- selected orientation;
- the localized upright meaning row;
- the localized reversed meaning row;
- position index/order, name, description/meaning, and prompt;
- the question and bounded optional context stored on the session.

The model receives only these drawn-card records. The server does not trust
client card names, orientations, positions, or arbitrary knowledge fields.
Card image URLs are not included. If a card or either required meaning row is
missing, the request fails before provider invocation.

The context is serialized as explicit data, not as instructions. The system
prompt tells the model to treat question/context/card text as content to
interpret, not as higher-priority instructions. Field lengths and the number
of cards are bounded by the existing session/catalog constraints.

## Prompt and reasoning contract

The versioned system prompt defines the model as a VinTarot Tarot
interpretation engine. It requires the model to:

- reason over the entire spread before writing;
- use the user question and category to personalize the interpretation;
- interpret each card through its exact position and orientation;
- use the supplied database knowledge as grounding without copying it
  verbatim or inventing contradictory meanings;
- connect cards as a progression, support, tension, contrast, suit/arcana
  pattern, orientation pattern, or useful thematic movement only when it
  helps answer the question;
- make `overview`, `connections`, and `guidance` genuinely spread-level;
- write naturally in the target locale, with no machine-translation step;
- avoid deterministic predictions, certainty, filler, SEO/dictionary tone,
  judgment, and professional medical/legal/financial advice;
- preserve the supplied `reading_card_id` and `position_key` values.

The prompt explicitly prohibits solving cards in isolation and concatenating
their meanings. The position prompt/description is supplied as reasoning
context, not as a mandatory sentence template.

The provider request asks for structured JSON. Provider-specific formats are
normalized to this shared model output:

```ts
type TarotReadingPayload = {
  overview: string;
  cards: Array<{
    reading_card_id: string;
    position_key: string;
    position: string;
    cardName: string;
    orientation: "upright" | "reversed";
    interpretation: string;
    reflection_prompt: string;
  }>;
  connections: string;
  guidance: string;
  closing: string;
  disclaimer: string;
};
```

The provider only authors prose plus stable IDs/keys. The server fills or
verifies `position`, `cardName`, and `orientation` from trusted input and
reorders cards to session order. Missing, duplicate, unknown, or mismatched
card IDs/position keys are invalid responses.

The disclaimer is localized server copy, not an instruction for the model to
invent. English and Vietnamese outputs are independently requested from the
provider; the server never translates a completed reading.

## Persistence and compatibility

No new reading migration is required. The existing `readings` table remains a
compatibility storage shape:

| Existing column | New payload field |
| --- | --- |
| `opening` | `overview` |
| `card_readings` | serialized `cards` array |
| `synthesis` | `connections` |
| `advice` | `guidance` |
| `closing` | `closing` |
| `disclaimer` | `disclaimer` |

`readings.model_name` stores the selected provider/model label and
`prompt_version` stores `tarot-reading-v2`. The mapping is isolated in the
repository so future schema work can introduce semantic column names without
changing the provider or Room contract. Existing old rows remain readable by
the compatibility boundary.

`lib/tarot-narrative.ts` remains because Guidebook and seed generation depend
on it. It is explicitly legacy/reference knowledge, not a production reading
fallback. The implementation will remove any import from the new reading
route/provider path and add comments/tests that guard this boundary. Existing
seed data is not rewritten unless the audit proves the new request needs a
missing field; no Tarot facts will be fabricated to fill absent schema fields.

## API routes

### Canonical `POST /api/tarot/reading`

Request:

```ts
{ session_id: string; locale: "en" | "vi" }
```

Behavior:

1. Check origin and parse the bounded request.
2. Resolve optional authenticated/guest owner and load the session.
3. Reject unknown/unauthorized/incomplete sessions before provider work.
4. Load trusted spread/card knowledge and construct one input context.
5. Select the configured provider and generate one spread-level reading.
6. Validate and normalize structured output against the exact session cards.
7. Persist the validated payload and provider metadata.
8. Return `{ session_id, locale, source: "ai", provider, model_name,
   prompt_version, reading }`.

Provider/configuration/timeout/malformed-output failures return a safe 5xx
response with a localized-safe retryable error message and no provider raw
response, question, card knowledge, or API key in the body/log. The drawn
cards remain available in Room.

### Compatibility `POST /api/tarot/interpret`

This route re-exports the canonical handler during migration. New client code
uses `/api/tarot/reading`; existing integrations do not break while the route
transition is completed.

## Room result UI

The existing interpretation panel, tabs, typography, glass surfaces, spacing,
and responsive behavior remain. Only data mapping and copy labels change:

- Overall Reading renders `overview`.
- Cards / Positions renders the ordered `cards` items with trusted position,
  card name, orientation, interpretation, and reflection prompt.
- How the Cards Connect renders `connections`.
- Guidance renders `guidance`.
- Closing Reflection renders `closing` and the localized disclaimer.

The existing loading/error/retry states remain active. If provider setup is
missing or the request fails, the user sees a friendly message and retry
action; no legacy narrative is displayed as if it were AI output. The result
surface remains scroll-contained and usable at the current mobile breakpoint.

## Reliability, security, cost, and observability

- Provider calls use `AbortController` with a bounded timeout and one retry
  only for transient network/429/5xx conditions.
- A provider response must pass both provider extraction and shared Zod
  validation. Refusals, empty content, invalid JSON, missing cards, duplicate
  cards, and mismatched positions fail closed.
- API keys stay in Cloudflare server bindings. The client never chooses a URL,
  sends a key, or submits card knowledge.
- Prompt injection in question/context/card text is treated as untrusted
  content by the system prompt; the server still validates all identifiers and
  output coverage.
- Only drawn cards are queried and serialized. No 78-card catalog or image
  binary is sent to any provider.
- The OpenAI adapter disables provider response storage where supported; the
  common input contains no unnecessary personal identity data.
- Development logs include provider, model, prompt version, card count,
  latency, and success/failure category only. They never include API keys,
  question text, raw prompts, card meanings, or raw provider output.
- Persistence failures do not erase the in-memory UI result; the API reports
  failure and the client can retry.

## Testing and acceptance

### Provider/domain tests

- Provider factory selects each of OpenAI, Gemini, and DeepSeek from an
  explicit configuration and rejects an unsupported/missing provider.
- All three adapters receive the same full `TarotReadingInput` and normalize
  to the shared payload shape without importing each other’s SDK types.
- OpenAI/Gemini/DeepSeek requests contain no API key in the request body and
  use provider-specific structured JSON settings.
- English and Vietnamese inputs request the target locale directly.
- Upright, reversed, and mixed orientations are present in context.
- Prompt/context includes position index/name/meaning, question, category,
  spread, and all drawn cards in one serialized context.
- A 3-card fixture and a non-3-card spread prove no fixed three-card branch.
- Prompt context contains only drawn card IDs, not the complete 78-card deck.
- Invalid card knowledge/session input, duplicate/missing card IDs, unknown
  positions, and wrong orientations are rejected.
- Timeout, transient retry exhaustion, malformed JSON, provider refusal, and
  schema mismatch produce retryable errors without local template output.

### API/UI tests

- `/api/tarot/reading` validates owner/session/locale and persists provider,
  model, prompt version, and compatibility fields.
- `/api/tarot/interpret` remains an alias.
- Room calls the canonical route and renders `overview`, `cards`,
  `connections`, `guidance`, `closing`, orientation, and position metadata.
- Existing draw logic and selected-card/session invariants remain unchanged.
- Existing Guidebook tests continue to pass and `tarot-narrative.ts` remains
  available only to Guidebook/seed compatibility paths.

### Development quality fixture

Keep a non-production fixture for:

```text
Question: Xu hướng 3 tháng tới của mối quan hệ này như thế nào?
Spread: Persona, Obstacle, Solution
Cards: Ten of Cups reversed; Page of Cups reversed; The Chariot upright
```

Tests assert that the complete context reaches the provider and that the
quality rubric can inspect progression, emotional mismatch/immaturity, and
the Chariot’s changed momentum/direction. They do not hardcode those sentences
into the production prompt or fallback.

## Delivery and deployment

Implementation will proceed after this spec review through a TDD plan:

1. Shared payload/schema, provider interface, prompt contract, and fixtures.
2. Provider adapters/factory and server-only environment declarations.
3. Trusted repository context and canonical reading route plus compatibility
   alias.
4. Room result mapping/error/retry updates and localized labels.
5. Focused tests, typecheck, build, lint baseline comparison, and diff check.
6. `docs/PROJECT_STATE.md` update with exact validation and provider setup.

Before a deployment can produce AI readings, configure the selected provider’s
secret/model in the server environment. Do not add `.env` values, runtime
databases, provider responses, or credentials to Git. If no provider is
configured, the verified app must show the retryable unavailable state rather
than claim that an AI reading was generated.

## Open review points

- Confirm that keeping the existing `readings` physical columns with an
  isolated semantic mapping is preferable to a new migration. This is the
  recommended compatibility choice.
- Confirm that explicit `TAROT_AI_PROVIDER` is required in each deployment,
  with no automatic provider fallback. This is the recommended cost/security
  choice.
- Confirm that `tarot-reading-v2` is the initial production prompt version;
  later prompt experiments must use a new version or explicit provider config.
