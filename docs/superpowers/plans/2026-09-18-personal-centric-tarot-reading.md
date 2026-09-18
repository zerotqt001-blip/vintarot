# Personal-Centric AI Tarot Reading Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Room's card-first AI result with a personal, bilingual, evidence-backed reading flow while preserving draw semantics, V5 retrieval, ownership checks, journal saving, and legacy readings.

**Architecture:** Keep `POST /api/tarot/reading` as the canonical initial-reading boundary, but change its provider contract to V3 and normalize its response into a camelCase `TarotReadingPayload`. Persist that normalized payload beside the existing compatibility columns, hydrate old rows through a dedicated compatibility parser, and add a separate owner-checked follow-up service that uses the saved normalized reading as bounded continuity context. Extract the Room result into typed reading components so the direct answer, personal insights, reflection, actions, evidence disclosure, and follow-up have one responsive reading order on desktop and mobile.

**Tech Stack:** Next.js/Vinext client components, TypeScript, Zod, Node `node:test`, SQLite/D1 through Drizzle schema and SQL migrations, existing OpenAI/Gemini/DeepSeek HTTP adapters, CSS in `app/globals.css`, and the existing `lib/i18n.ts` locale dictionary.

**Spec:** `docs/superpowers/specs/2026-09-18-personal-centric-tarot-reading-design.md`

## Global Constraints

- Preserve Moonlight-inspired NaTarot visual language, existing draw/shuffle/fan/orientation/spread behavior, and the current V5 retrieval boundary.
- Provider JSON uses the exact V3 snake_case contract; the normalized client and persistence payload uses the exact camelCase contract defined in the spec.
- Never trust provider card names, orientation, position labels, or card IDs beyond exact stored `reading_card_id` and `position_key` coverage.
- All new user-facing copy is present in English and Vietnamese; reading text remains reflective, conditional, and non-diagnostic.
- Follow-up requests re-check the same session owner and never persist a conversation transcript.
- Use TDD: add a focused failing test, run it red, make the smallest implementation pass, then run the focused test before each task commit.
- Do not stage or modify the existing unrelated files `docs/superpowers/plans/2026-09-17-homepage-3d.md`, `tests/celestial-surfaces.test.ts`, or `tests/homepage-celestial.test.ts`.
- Read `.codex/skills/impeccable/reference/craft-floor.md` completely before the first UI or CSS edit and apply its guidance without replacing the Moonlight reference.

---

### Task 1: Define and validate the Tarot Reading V3 contract

**Files:**
- Modify: `lib/ai/types.ts`
- Modify: `lib/tarot-interpretation.ts`
- Modify: `lib/ai/prompts/tarot-reading.ts`
- Modify: `lib/ai/provider.ts`
- Modify: `tests/tarot-interpretation.test.ts`
- Modify: `tests/tarot-ai.test.ts`
- Modify: `tests/fixtures/tarot-reading-quality.ts`

**Interfaces:**
- Consumes: existing `TarotReadingInput`, trusted `TarotReadingCardContext[]`, and the stored `TarotLocale`.
- Produces: `TarotProviderOutputV3`, `TarotReadingPayload`, `parseReadingPayload(value, expectedCards, locale)`, `TAROT_PROMPT_VERSION === "tarot-reading-v3"`, and the V3 prompt/schema constants consumed by every provider.

- [ ] **Step 1: Add failing parser tests for the normalized V3 shape.**

Add fixtures that contain two direct-answer paragraphs, one personal insight, one reflection prompt, one next step, one evidence item per stored card, `deeper_reading: null`, and two follow-up suggestions. Assert that parsing returns:

```ts
assert.equal(result.directAnswer, "First paragraph.\n\nSecond paragraph.");
assert.deepEqual(result.personalInsights, [{ title: "A pattern", body: "A useful pattern." }]);
assert.equal(result.cardEvidence[0].card.id, expectedCards[0].card.id);
assert.equal(result.cardEvidence[0].orientation, expectedCards[0].orientation);
assert.equal(result.deeperReading, null);
assert.match(result.disclaimer, /reflective/i);
```

Add rejection cases for an old `overview` key, an omitted evidence item, a duplicate evidence ID, a mismatched `position_key`, seven insights, five prompts, five next steps, five suggestions, a direct answer with one paragraph, and arbitrary provider metadata.

- [ ] **Step 2: Run the focused parser tests and verify the expected failures.**

Run:

```bash
npx tsx --test tests/tarot-interpretation.test.ts
```

Expected: the new V3 assertions fail because the current parser still expects `overview`, `cards`, `connections`, `guidance`, and `closing`.

- [ ] **Step 3: Replace the public AI types with the exact V3 and normalized contracts.**

In `lib/ai/types.ts`, define these shapes without provider-controlled trusted metadata:

```ts
export type TarotProviderInsight = { title: string; body: string };
export type TarotProviderNextStep = { title: string; body: string };
export type TarotProviderCardEvidence = {
  reading_card_id: string;
  position_key: string;
  interpretation: string;
};

export type TarotProviderOutputV3 = {
  direct_answer: string;
  personal_insights: TarotProviderInsight[];
  reflection_prompts: string[];
  next_steps: TarotProviderNextStep[];
  card_evidence: TarotProviderCardEvidence[];
  deeper_reading: string | null;
  follow_up_suggestions: string[];
};

export type TarotReadingPayload = {
  directAnswer: string;
  personalInsights: TarotProviderInsight[];
  reflectionPrompts: string[];
  nextSteps: TarotProviderNextStep[];
  cardEvidence: Array<{
    readingCardId: string;
    position: TarotReadingCardContext["position"];
    card: TarotReadingCardContext["card"];
    orientation: TarotOrientation;
    interpretation: string;
  }>;
  deeperReading: string | null;
  followUpSuggestions: string[];
  disclaimer: string;
};
```

Remove the old provider-facing `reflection_prompt` field from the V3 contract. Keep V5 few-shot example fields unchanged because they are retrieval data, not output data.

- [ ] **Step 4: Implement strict Zod parsing and trusted metadata injection.**

In `lib/tarot-interpretation.ts`, create strict schemas with these bounds: direct answer 1–6000 characters and 2–4 non-empty paragraphs, insight and next-step arrays 1–6 and 1–4 items respectively, reflection prompts 1–4, evidence 1–10, suggestions 0–4, titles/bodies bounded to 240/1200 characters, interpretations bounded to 4000 characters. Validate exact one-to-one evidence coverage and position-key equality, then map the provider's snake_case fields into camelCase while copying `position`, `card`, and `orientation` only from `expectedCards`.

The parser must continue to throw a plain validation error for malformed content. `parseTarotProviderContent` will translate that error into the existing retryable `TarotAIError("invalid_response", ...)` without exposing provider text.

- [ ] **Step 5: Update the V3 prompt and schema constants.**

Set `TAROT_PROMPT_VERSION` to `"tarot-reading-v3"`. Require the exact JSON object below in `TAROT_RESPONSE_SCHEMA` and `TAROT_JSON_OUTPUT_CONTRACT`:

```json
{
  "direct_answer": "string",
  "personal_insights": [{"title": "string", "body": "string"}],
  "reflection_prompts": ["string"],
  "next_steps": [{"title": "string", "body": "string"}],
  "card_evidence": [{"reading_card_id": "string", "position_key": "string", "interpretation": "string"}],
  "deeper_reading": "string or null",
  "follow_up_suggestions": ["string"]
}
```

Update `TAROT_SYSTEM_PROMPT` so the model starts with the reader's question and observable dynamics, keeps card-specific prose in `card_evidence`, separates feeling/intention/action/capacity/commitment in relationship readings, and never presents private thoughts or high-stakes advice as facts. Retain the existing V5, untrusted-input, no-chain-of-thought, and JSON-only guardrails.

- [ ] **Step 6: Run parser and prompt tests, then commit the contract.**

Run:

```bash
npx tsx --test tests/tarot-interpretation.test.ts tests/tarot-ai.test.ts
```

Expected: all focused parser/prompt tests pass and the prompt test asserts `tarot-reading-v3`, `direct_answer`, `personal_insights`, `reflection_prompts`, `next_steps`, `card_evidence`, `deeper_reading`, and `follow_up_suggestions` while rejecting the old five-key contract.

Commit only the files in this task:

```bash
git add lib/ai/types.ts lib/tarot-interpretation.ts lib/ai/prompts/tarot-reading.ts lib/ai/provider.ts tests/tarot-interpretation.test.ts tests/tarot-ai.test.ts tests/fixtures/tarot-reading-quality.ts
git diff --cached --check
git commit -m "feat: define personal-centric tarot reading contract"
```

### Task 2: Move all provider transports and service fixtures to V3

**Files:**
- Modify: `lib/ai/openai.ts`
- Modify: `lib/ai/gemini.ts`
- Modify: `lib/ai/deepseek.ts`
- Modify: `tests/tarot-ai.test.ts`
- Modify: `tests/tarot-reading-service.test.ts`
- Modify: `tests/tarot-reading-route.test.ts`
- Modify: `tests/tarot-api-contract.test.ts`

**Interfaces:**
- Consumes: V3 prompt/schema constants and `TarotProviderOutputV3` from Task 1.
- Produces: OpenAI, Gemini, and DeepSeek adapters that all parse the same V3 response and service/route fixtures with `TarotReadingPayload` camelCase fields.

- [ ] **Step 1: Add failing transport assertions for the shared V3 schema.**

Extend the existing provider transport tests to inspect each request body and assert that the provider receives `TAROT_RESPONSE_SCHEMA` with `direct_answer`, `card_evidence`, and `deeper_reading`, never `overview` or `reflection_prompt`. Make the mock response use the V3 fixture and assert that the returned reading has `directAnswer` and `cardEvidence`.

- [ ] **Step 2: Run the transport tests to verify they fail against the old request contract.**

Run:

```bash
npx tsx --test tests/tarot-ai.test.ts
```

Expected: the assertions fail because the fixture and parser still expose the old field names at the provider boundary.

- [ ] **Step 3: Update each adapter's fixture path without changing its HTTP abstraction.**

Keep the existing endpoints, retry policy, authorization headers, `store: false`, `responseMimeType`, `responseJsonSchema`, and DeepSeek JSON mode. Only consume the V3 constants already imported from `lib/ai/prompts/tarot-reading.ts`; do not add a second provider-specific response parser.

- [ ] **Step 4: Update service and route fixtures to assert the new payload.**

Replace old assertions such as:

```ts
assert.equal(result.reading.overview, "...");
assert.equal(result.reading.connections, "...");
```

with:

```ts
assert.match(result.reading.directAnswer, /.../);
assert.equal(result.reading.cardEvidence.length, 3);
assert.equal(result.reading.cardEvidence[1].position.key, template.positions[1].key);
assert.equal(result.promptVersion, "tarot-reading-v3");
```

Keep ownership, locale, orientation, exact card ordering, safe error, and metadata-only logging assertions intact.

- [ ] **Step 5: Run the provider/service/route tests and commit.**

Run:

```bash
npx tsx --test tests/tarot-ai.test.ts tests/tarot-reading-service.test.ts tests/tarot-reading-route.test.ts tests/tarot-api-contract.test.ts
```

Commit only the provider adapters and their test fixtures:

```bash
git add lib/ai/openai.ts lib/ai/gemini.ts lib/ai/deepseek.ts tests/tarot-ai.test.ts tests/tarot-reading-service.test.ts tests/tarot-reading-route.test.ts tests/tarot-api-contract.test.ts
git diff --cached --check
git commit -m "feat: migrate tarot providers to reading v3"
```

### Task 3: Persist the normalized payload and hydrate legacy rows

**Files:**
- Modify: `db/schema.ts`
- Create: `drizzle/0004_reading_payload.sql`
- Create: `lib/tarot-reading-compat.ts`
- Modify: `lib/tarot-repository.ts`
- Modify: `lib/tarot-reading-service.ts`
- Modify: `tests/tarot-migration.test.ts`
- Modify: `tests/tarot-repository.test.ts`
- Modify: `tests/tarot-reading-service.test.ts`

**Interfaces:**
- Consumes: V3 `TarotReadingPayload`, trusted session cards, historical localized spread positions, and legacy `readings` columns.
- Produces: nullable `readings.reading_payload`, `TarotRepository.getLatestReadingForOwner(sessionId, owner)`, `serializeLegacyReadingFields(reading)`, and `parseStoredReading(row, expectedCards, locale)`.

- [ ] **Step 1: Add failing migration and repository tests.**

Add a migration contract test that applies `drizzle/0004_reading_payload.sql` after the existing dynamic tarot schema and asserts:

```ts
const columns = sqlite.prepare("PRAGMA table_info(readings)").all() as Array<{ name: string }>;
assert.ok(columns.some((column) => column.name === "reading_payload"));
```

Extend the repository test to save a V3 payload, then assert `reading_payload` is valid JSON and contains `directAnswer`, `personalInsights`, `cardEvidence`, and `followUpSuggestions`. Add a legacy row with `reading_payload = NULL`, old `opening`, `card_readings`, `synthesis`, `advice`, `closing`, and `disclaimer`; assert the compatibility parser returns trusted stored card/position/orientation metadata.

- [ ] **Step 2: Run the persistence tests to verify the expected failures.**

Run:

```bash
npx tsx --test tests/tarot-migration.test.ts tests/tarot-repository.test.ts
```

Expected: the migration file, schema field, repository query, and legacy parser assertions fail because the current database has no payload column or read-back method.

- [ ] **Step 3: Add the schema field and ordered migration.**

Add this nullable Drizzle field:

```ts
readingPayload: text("reading_payload"),
```

Create `drizzle/0004_reading_payload.sql` with the schema change expected by the project's ordered D1 migration process:

```sql
ALTER TABLE `readings` ADD COLUMN `reading_payload` text;
```

Update the migration test harness to apply `0004` exactly once after `0001` and `0002` (and `0003` where the catalog is required). The deployment process uses the migration journal, so a completed migration is not replayed against the same database.

- [ ] **Step 4: Implement compatibility serialization and hydration.**

In `lib/tarot-reading-compat.ts`, implement:

```ts
export function serializeLegacyReadingFields(reading: TarotReadingPayload): {
  opening: string;
  cardReadings: string;
  synthesis: string;
  advice: string;
  closing: string;
  disclaimer: string;
};

export function parseStoredReading(
  row: StoredReadingRow,
  expectedCards: TarotReadingCardContext[],
  locale: TarotLocale,
): TarotReadingPayload;
```

For new rows, map `directAnswer` to `opening`, JSON evidence to `cardReadings`, joined personal insights to `synthesis`, joined next steps to `advice`, `deeperReading || directAnswer` to `closing`, and the localized disclaimer to `disclaimer`. For old rows, parse the old `card_readings` JSON, map `opening` to `directAnswer`, split `synthesis` and `advice` into bounded one-item insight/next-step arrays, collect any legacy `reflection_prompt` values into `reflectionPrompts`, and inject all card/position/orientation metadata from `expectedCards`. If legacy card coverage is incomplete, throw a typed persistence/compatibility error rather than fabricating evidence.

- [ ] **Step 5: Extend the repository and reading service.**

Add `getLatestReadingForOwner` using a parameterized query joined to `reading_sessions` with the same owner predicate as `getSessionForOwner`, ordered by `created_at DESC, id DESC`, and return `null` when no reading exists. Update `saveReading` to bind both the old columns and `JSON.stringify(input.reading)` into `reading_payload`. Keep the existing `session_id` association and do not rewrite historical rows during migration.

Update `generateTarotReading` persistence tests to assert the normalized payload is saved while `modelName` and `promptVersion` remain metadata. Keep `lib/tarot-narrative.ts` untouched.

- [ ] **Step 6: Run all persistence/service tests and commit.**

Run:

```bash
npx tsx --test tests/tarot-migration.test.ts tests/tarot-repository.test.ts tests/tarot-reading-service.test.ts
npx tsc --noEmit
```

Commit only the schema, migration, compatibility, repository, service, and related tests:

```bash
git add db/schema.ts drizzle/0004_reading_payload.sql lib/tarot-reading-compat.ts lib/tarot-repository.ts lib/tarot-reading-service.ts tests/tarot-migration.test.ts tests/tarot-repository.test.ts tests/tarot-reading-service.test.ts
git diff --cached --check
git commit -m "feat: persist normalized tarot reading payloads"
```

### Task 4: Add the owner-checked follow-up reading boundary

**Files:**
- Modify: `lib/ai/types.ts`
- Modify: `lib/ai/provider.ts`
- Modify: `lib/ai/prompts/tarot-reading.ts`
- Modify: `lib/ai/openai.ts`
- Modify: `lib/ai/gemini.ts`
- Modify: `lib/ai/deepseek.ts`
- Create: `lib/tarot-follow-up-service.ts`
- Create: `lib/tarot-follow-up-route.ts`
- Create: `app/api/tarot/follow-up/route.ts`
- Modify: `lib/tarot-repository.ts`
- Create: `tests/tarot-follow-up.test.ts`
- Create: `tests/tarot-follow-up-route.test.ts`
- Modify: `tests/tarot-ai.test.ts`

**Interfaces:**
- Consumes: `TarotRepository.getSessionForOwner`, `getLatestReadingForOwner`, `parseStoredReading`, historical `getReadingTemplate`, and the provider HTTP adapters.
- Produces: `TarotFollowUpInput`, `TarotFollowUpPayload`, `generateTarotFollowUp(args)`, `handleTarotFollowUpRoute(args)`, and `POST /api/tarot/follow-up`.

- [ ] **Step 1: Add failing follow-up service and route tests.**

Test the following service contract:

```ts
const result = await generateTarotFollowUp({
  repository,
  owner: { kind: "user", userId: "owner-1" },
  sessionId: "session-1",
  locale: "en",
  followUpQuestion: "What should I notice first?",
  provider,
});

assert.equal(result.answer, "Start with the smallest observable step.");
assert.equal(capturedInput.followUpQuestion, "What should I notice first?");
assert.equal(capturedInput.reading.directAnswer, storedReading.directAnswer);
assert.equal(capturedInput.cards[0].orientation, "reversed");
```

Add tests that another owner receives `not_found` before the provider runs, no saved reading receives `incomplete`, provider malformed JSON maps to a retryable invalid response, and the route accepts only `session_id`, `locale`, and `follow_up_question` with a maximum 1000-character question.

- [ ] **Step 2: Run the focused follow-up tests and verify they fail.**

Run:

```bash
npx tsx --test tests/tarot-follow-up.test.ts tests/tarot-follow-up-route.test.ts
```

Expected: the follow-up types, provider method, service, route handler, and route file do not exist.

- [ ] **Step 3: Define the bounded follow-up input and parser.**

Add these types to `lib/ai/types.ts`:

```ts
export type TarotFollowUpInput = {
  locale: TarotLocale;
  question: string;
  followUpQuestion: string;
  category: TarotReadingInput["category"];
  spread: TarotReadingInput["spread"];
  cards: Array<Pick<TarotReadingPayload["cardEvidence"][number], "readingCardId" | "position" | "card" | "orientation">>;
  reading: TarotReadingPayload;
};

export type TarotFollowUpPayload = { answer: string };
```

Add a strict `{ answer: string }` schema with a 1–3000 character bound and a `parseTarotFollowUpContent` helper that maps malformed JSON/schema failures to `TarotAIError("invalid_response", ..., { retryable: true })`.

- [ ] **Step 4: Add the follow-up prompt and provider method.**

Set `TAROT_FOLLOW_UP_PROMPT_VERSION` to `"tarot-follow-up-v1"` and add `buildTarotFollowUpPromptContext` that serializes only the original question, follow-up question, locale, category, spread, exact card evidence metadata, and current normalized reading. It must cap the user question before serialization and must not include raw V5 retrieval blobs.

Extend `TarotAIProvider` with:

```ts
generateFollowUp(input: TarotFollowUpInput): Promise<TarotFollowUpPayload>;
```

Use the same provider endpoints and HTTP client. OpenAI uses a strict JSON schema, Gemini uses `responseJsonSchema`, and DeepSeek uses `response_format: { type: "json_object" }` plus the exact JSON contract. The follow-up system prompt repeats the locale, safety, conditional-language, private-thought, and no-chain-of-thought rules.

- [ ] **Step 5: Implement service and route ownership/error handling.**

`generateTarotFollowUp` must first call `getSessionForOwner`, require a drawn complete session, load the latest reading row, hydrate it with `parseStoredReading`, load the historical spread template in the requested locale, then call `provider.generateFollowUp`. It must return `{ sessionId, locale, source: "ai", provider, modelName, promptVersion: TAROT_FOLLOW_UP_PROMPT_VERSION, answer }` and never save a follow-up transcript.

`handleTarotFollowUpRoute` mirrors the existing route's metadata-only logging. `app/api/tarot/follow-up/route.ts` must call `originCheck`, `readOptionalOwner`, `createTarotAIProvider`, and `getTarotRepository`; it must set any guest cookie returned by `readOptionalOwner` and return only the allowlisted response fields.

- [ ] **Step 6: Run follow-up/provider tests and commit.**

Run:

```bash
npx tsx --test tests/tarot-follow-up.test.ts tests/tarot-follow-up-route.test.ts tests/tarot-ai.test.ts
npx tsc --noEmit
```

Commit only follow-up code and its provider/test changes:

```bash
git add lib/ai/types.ts lib/ai/provider.ts lib/ai/prompts/tarot-reading.ts lib/ai/openai.ts lib/ai/gemini.ts lib/ai/deepseek.ts lib/tarot-follow-up-service.ts lib/tarot-follow-up-route.ts app/api/tarot/follow-up/route.ts lib/tarot-repository.ts tests/tarot-follow-up.test.ts tests/tarot-follow-up-route.test.ts tests/tarot-ai.test.ts
git diff --cached --check
git commit -m "feat: add owner-checked tarot follow-ups"
```

### Task 5: Build the typed personal reading component system

**Files:**
- Create: `components/reading/reading-types.ts`
- Create: `components/reading/reading-header.tsx`
- Create: `components/reading/direct-answer.tsx`
- Create: `components/reading/personal-insights.tsx`
- Create: `components/reading/reflection-prompts.tsx`
- Create: `components/reading/next-steps.tsx`
- Create: `components/reading/tarot-evidence.tsx`
- Create: `components/reading/follow-up-reading.tsx`
- Create: `components/reading/reading-panel.tsx`
- Create: `lib/reading-text.ts`
- Create: `tests/tarot-reading-ui.test.ts`

**Interfaces:**
- Consumes: normalized `TarotReadingPayload`, locale translator, Room session metadata, card-artwork lookup, and callbacks supplied by `app/room/room.tsx`.
- Produces: a single `ReadingPanel` with the fixed order `header → direct answer → personal insights → reflection prompts → next steps → tarot evidence → follow-up`, with no provider/D1 access inside components.

- [ ] **Step 1: Read the UI craft guidance before touching component or CSS files.**

Run:

```bash
sed -n '1,320p' .codex/skills/impeccable/reference/craft-floor.md
```

Apply the guidance to hierarchy, measure, focus states, responsive behavior, reduced motion, and content density while retaining the existing midnight navy, ivory, antique-gold, celestial NaTarot treatment.

- [ ] **Step 2: Add failing source-level component tests.**

Create `tests/tarot-reading-ui.test.ts` with assertions like:

```ts
const panel = readFileSync(new URL("../components/reading/reading-panel.tsx", import.meta.url), "utf8");
const evidence = readFileSync(new URL("../components/reading/tarot-evidence.tsx", import.meta.url), "utf8");

assert.match(panel, /DirectAnswer/);
assert.match(panel, /PersonalInsights/);
assert.match(panel, /ReflectionPrompts/);
assert.match(panel, /NextSteps/);
assert.match(panel, /TarotEvidence/);
assert.match(evidence, /<details/);
assert.doesNotMatch(panel, /role=["']tablist/);
```

Also test `splitReadingParagraphs` with empty lines, one long paragraph, and four paragraphs so primary content remains readable without HTML injection.

- [ ] **Step 3: Run the UI tests to verify they fail before files exist.**

Run:

```bash
npx tsx --test tests/tarot-reading-ui.test.ts
```

Expected: the component imports fail because the new files have not been created.

- [ ] **Step 4: Define shared component props and safe text helpers.**

In `components/reading/reading-types.ts`, define:

```ts
export type ReadingArtwork = { src: string; alt: string };
export type ReadingFollowUp = { id: string; question: string; answer: string };
export type ReadingTranslator = (key: string) => string;
```

Use `TarotReadingPayload["cardEvidence"]` for evidence props and a `Record<string, ReadingArtwork>` keyed by `readingCardId`. In `lib/reading-text.ts`, export `splitReadingParagraphs(value: string): string[]` that trims, splits on two or more newlines, removes empty entries, and returns at most four paragraphs.

- [ ] **Step 5: Implement the focused presentation components.**

Implement the following exact responsibilities:

```tsx
<DirectAnswer paragraphs={splitReadingParagraphs(reading.directAnswer)} />
<PersonalInsights items={reading.personalInsights} />
<ReflectionPrompts prompts={reading.reflectionPrompts} onSelect={seedFollowUp} />
<NextSteps items={reading.nextSteps} />
<TarotEvidence items={reading.cardEvidence} artwork={artworkByReadingCardId} />
```

`TarotEvidence` renders each item as a collapsed native `<details>` with `<summary>` containing the trusted position/card/orientation and a body containing the thumbnail plus interpretation. It never renders evidence before the primary sections. `ReflectionPrompts` uses buttons with at least a 44px hit area and does not mutate the reading. `FollowUpReading` owns the input and client-only answer list, renders loading/error states, and calls an injected `onSubmit(question)` callback.

- [ ] **Step 6: Implement `ReadingPanel` with semantic landmarks and failure states.**

The root is an `aside` with an accessible localized label. Use a `header`, `main`/`section` landmarks, `h2`/`h3`, a live region for loading and errors, and labeled close/save/follow-up controls. Render the reader's question directly below `ReadingHeader` and before `DirectAnswer`. Render `deeperReading` only when non-null after evidence. A failed provider state keeps the drawn cards available through the surrounding Room and never inserts a locally generated answer.

- [ ] **Step 7: Run the component tests, typecheck, and commit.**

Run:

```bash
npx tsx --test tests/tarot-reading-ui.test.ts
npx tsc --noEmit
```

Commit only the new presentation components, text helper, and focused tests:

```bash
git add components/reading lib/reading-text.ts tests/tarot-reading-ui.test.ts
git diff --cached --check
git commit -m "feat: add personal tarot reading components"
```

### Task 6: Wire the Room to the new result flow and remove the tabbed report

**Files:**
- Modify: `app/room/room.tsx`
- Modify: `lib/i18n.ts`
- Modify: `app/globals.css`
- Modify: `tests/tarot-room.test.ts`
- Modify: `tests/tarot-reading-ui.test.ts`

**Interfaces:**
- Consumes: `ReadingPanel`, `TarotReadingPayload`, `POST /api/tarot/follow-up`, existing `isRoomRequestCurrent`, `saveJournal`, and Room's exact stored card state.
- Produces: one reading panel on desktop/mobile, epoch-safe follow-up requests, bilingual copy, collapsed evidence, and no primary four-tab navigation.

- [ ] **Step 1: Add failing Room wiring assertions for the new payload and follow-up boundary.**

Update `tests/tarot-room.test.ts` to assert the Room source contains `reading.directAnswer`, `reading.personalInsights`, `reading.reflectionPrompts`, `reading.nextSteps`, `reading.cardEvidence`, and `tarot/follow-up`; it must also assert that the source does not contain `InterpretationTab`, `room-interpretation-tabs`, `interpretationOverviewTab`, or `reading.overview`.

Add stale-response assertions for follow-up request epochs using the existing `isRoomRequestCurrent` helper.

- [ ] **Step 2: Run Room tests to verify they fail against the current tabbed panel.**

Run:

```bash
npx tsx --test tests/tarot-room.test.ts tests/tarot-reading-ui.test.ts
```

Expected: the tests fail because `room.tsx` still owns the old four-tab `InterpretationPanel` and reads snake_case/legacy fields.

- [ ] **Step 3: Replace Room interpretation state with normalized payload state.**

Change `RoomInterpretation` to use `TarotReadingPayload` from `lib/ai/types.ts` and remove `InterpretationTab`/`interpretationTab`. Keep `interpretationOpen`, `interpretation`, `interpreting`, `interpretationError`, `retryAvailable`, `readingEpoch`, and `interpretationRequest` so draw/reset stale guards remain intact.

Add client-only follow-up state:

```ts
const [followUpError, setFollowUpError] = useState("");
const [followUpLoading, setFollowUpLoading] = useState(false);
const [followUpAnswers, setFollowUpAnswers] = useState<ReadingFollowUp[]>([]);
const followUpRequest = useRef(0);
```

Reset follow-up answers when a new session or reading epoch begins. Do not store follow-up messages in D1, sessionStorage, or the URL.

- [ ] **Step 4: Add the real follow-up callback with stale-session protection.**

Implement `submitFollowUp(question: string)` so it trims and bounds the input, captures `sessionId` and `readingEpoch`, increments `followUpRequest`, calls `api("tarot/follow-up", { session_id, locale, follow_up_question })`, and commits the answer only when:

```ts
isRoomRequestCurrent(
  { epoch: requestEpoch, id: `${requestSessionId}:${requestId}` },
  { epoch: readingEpoch.current, id: `${stateRef.current.sessionId}:${followUpRequest.current}` },
)
```

Use localized provider-neutral errors and leave the initial reading/cards untouched on failure.

- [ ] **Step 5: Mount `ReadingPanel` and remove the old tabbed result implementation.**

Build `artworkByReadingCardId` from the existing Room `s.cards` and `cards[drawn.id].moonlightImage`; pass only immutable normalized data and callbacks into `ReadingPanel`. Keep `saveJournal`, close, retry, and the existing panel-open trigger. Delete the local `InterpretationPanel` and its `renderCard`, tab list, tab state, and duplicated card-first reading markup. Keep the separate question/context/notes editor in `ReflectionPanel`, but do not render a second AI result there.

- [ ] **Step 6: Add the bilingual copy needed by the new hierarchy.**

Add matching English and Vietnamese keys in `lib/i18n.ts` for the reading question label, direct answer, personal insights, reflection prompts, next steps, Tarot evidence, evidence disclosure, deeper reading, follow-up heading, follow-up input label/hint, suggestion chips, submit/loading/error/retry, save, close, and live-region labels. Preserve existing keys used by the rest of Room until all call sites are migrated.

- [ ] **Step 7: Replace the panel CSS with the editorial reading layout.**

After reading the craft-floor reference, update the `.room-interpretation-panel` block in `app/globals.css` so desktop keeps the tabletop left and gives the result a readable `min(50vw, 760px)` column with a 55–75 character prose measure. The direct answer receives the strongest type scale; insights/actions use compact numbered rows; evidence uses a collapsed disclosure and small thumbnails.

At `max-width: 768px`, make the panel nearly full viewport with safe-area padding, one vertical scroll order, no horizontal tab strip, 44px controls, no overflow wider than `100vw`, and an evidence disclosure that remains collapsed. Preserve `prefers-reduced-motion: reduce` by disabling panel/accordion transitions. Keep the NaTarot midnight navy, ivory, antique-gold, translucent glass, and Moonlight-inspired observatory surfaces.

- [ ] **Step 8: Run focused Room tests and commit the UI integration.**

Run:

```bash
npx tsx --test tests/tarot-room.test.ts tests/tarot-reading-ui.test.ts
npx tsc --noEmit
```

Commit only Room, i18n, CSS, and related tests:

```bash
git add app/room/room.tsx lib/i18n.ts app/globals.css tests/tarot-room.test.ts tests/tarot-reading-ui.test.ts
git diff --cached --check
git commit -m "feat: redesign room tarot reading experience"
```

### Task 7: Complete verification, browser QA, and project state

**Files:**
- Modify: `docs/PROJECT_STATE.md`
- Modify: `README.md` only if the new migration or follow-up endpoint changes documented runtime commands
- Test: all Tarot tests, typecheck, lint, build, and local browser behavior

**Interfaces:**
- Consumes: all committed implementation tasks and the verified local preview.
- Produces: evidence-backed completion status, updated project state, and a clean related diff with any repository baseline failures explicitly recorded.

- [ ] **Step 1: Run the full Tarot regression suite.**

Run:

```bash
npx tsx --test tests/tarot*.test.ts
```

Expected: all Tarot contract, migration, repository, service, provider, Room, UI, and follow-up tests pass. If a pre-existing unrelated test remains red, record its exact test name and output in `docs/PROJECT_STATE.md` without modifying that unrelated file.

- [ ] **Step 2: Run static and production verification.**

Run each command separately:

```bash
npx tsc --noEmit
npm run lint
npm run build
git diff --check
```

The typecheck and build must pass. Lint output must distinguish any existing repository-wide generated/runtime or legacy-anchor baseline from new errors in the changed files.

- [ ] **Step 3: Start the local preview and exercise a representative reading.**

Use the existing local preview workflow from `README.md`. In a representative three-card session, verify at desktop width that the question and direct answer appear before insights, reflection, actions, evidence, and follow-up; evidence is collapsed; saving still invokes the journal flow; and changing locale renders the same structure in Vietnamese. Verify at tablet and 390px mobile widths that the reading is a nearly full-height single scroll, no tab strip appears, the tabletop remains available behind/after close, controls have visible focus, and expanding evidence works with keyboard and pointer.

- [ ] **Step 4: Update the project state with decisions and unfinished work.**

Append a dated entry to `docs/PROJECT_STATE.md` that records the V3 payload, `reading_payload` compatibility column, follow-up owner boundary, UI hierarchy, exact verification commands/results, browser widths checked, and any remaining provider configuration or physical-device limitation. Do not claim a provider-backed reading was manually verified if the selected provider credentials are unavailable.

- [ ] **Step 5: Inspect the final related diff and finish with the required review gate.**

Run:

```bash
git status --short
git diff --stat codex/tooling-and-version-history...HEAD
git diff --check
```

Confirm no `.env`, runtime database, auth token, session log, build output, or unrelated user file is staged. Then invoke the repository's requesting-code-review workflow before declaring the feature complete. Record the review result and any unresolved work in `docs/PROJECT_STATE.md`.

## Self-review checklist

- Spec coverage: Tasks 1–2 cover the V3 provider contract, prompt composition, V5 preservation, locale and safety rules; Task 3 covers persistence and legacy hydration; Task 4 covers the real follow-up boundary; Tasks 5–6 cover all reading hierarchy, responsive, accessibility, failure, and bilingual UI requirements; Task 7 covers verification and state documentation.
- Completeness scan: every step has a concrete file, interface, command, or assertion; no unspecified implementation step remains.
- Type consistency: `TarotProviderOutputV3` is provider-facing snake_case; `TarotReadingPayload` is normalized camelCase; `ReadingPanel` consumes `TarotReadingPayload`; follow-up service consumes `TarotFollowUpInput`; repository hydration returns `TarotReadingPayload`.
- Compatibility: the old reading columns remain populated and old rows are read without rewriting; `lib/tarot-narrative.ts` stays untouched; draw/shuffle/orientation/spread semantics stay outside the change.
- Security: owner checks happen before both provider calls, provider secrets stay server-side, logs remain metadata-only, and follow-up text is bounded and not persisted.
