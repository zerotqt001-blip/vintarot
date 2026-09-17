# Configurable AI Tarot Reading Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace VinTarot’s production template-based final reading with one validated, spread-level AI reading that can explicitly use OpenAI, Gemini, or DeepSeek.

**Architecture:** Keep card drawing, session ownership, and the existing D1 schema compatible. Build a provider-neutral AI boundary around a trusted D1 context builder, validate every provider response with a strict structured schema, persist the normalized reading through the existing reading columns, and render one canonical payload in Room. Provider selection is explicit through server-side environment variables; there is no silent provider fallback or local template fallback for the final reading.

**Tech Stack:** TypeScript, React, Next/vinext route handlers, Cloudflare Workers/D1, Drizzle schema, Zod, native fetch, Node tsx --test, and the existing VinTarot CSS/i18n system.

**Spec:** docs/superpowers/specs/2026-09-18-ai-tarot-reading-engine-design.md

## Global Constraints

- Work directly on the current checkout and branch. Preserve all unrelated staged, unstaged, and untracked user changes.
- Do not change draw logic, deck shuffling, orientation assignment, session creation, or the session-card write path.
- The browser sends only session_id and locale to the reading endpoint. The server loads question, optional context, category, spread, positions, cards, orientations, and both localized knowledge rows from D1.
- The AI prompt may contain only cards drawn in the current session. Never send the full 78-card catalog, artwork paths, API keys, or internal raw provider output to the browser.
- Provider selection is explicit: TAROT_AI_PROVIDER=openai|gemini|deepseek. A missing key/model or failed selected provider is a retryable error; it must not silently switch providers or return the old local template reading.
- OPENAI_API_KEY, GEMINI_API_KEY, and DEEPSEEK_API_KEY are server-only secrets. Their corresponding model variables are OPENAI_TAROT_MODEL, GEMINI_TAROT_MODEL, and DEEPSEEK_TAROT_MODEL.
- Keep lib/tarot-narrative.ts available for the Guidebook and seed generation. It must not be called by the production final-reading route.
- Preserve English and Vietnamese output, localized position labels, orientation, and the existing Moonlight visual language and mobile layout.
- Reuse the existing readings columns unless a verified schema limitation requires a migration. No migration is expected for this feature.
- Follow test-driven development: add a failing focused test before the implementation for each behavioral slice, then run the focused suite before moving on.
- At each completed task, inspect the related diff, scan staged content for secrets, and commit only the files belonging to that task with a clear message.

## File Map

Create:

- lib/ai/types.ts — shared provider input/output and normalized reading types.
- lib/ai/provider.ts — provider interface and safe typed AI errors.
- lib/ai/http.ts — timeout, abort, retry, and response extraction helpers.
- lib/ai/openai.ts — OpenAI Responses API adapter.
- lib/ai/gemini.ts — Gemini generateContent adapter.
- lib/ai/deepseek.ts — DeepSeek chat completions adapter.
- lib/ai/factory.ts — explicit environment-driven provider factory.
- lib/ai/prompts/tarot-reading.ts — prompt version, system instructions, JSON schema, and prompt context serializer.
- lib/tarot-reading-context.ts — trusted D1-to-AI context builder.
- lib/tarot-reading-service.ts — owner-checked reading orchestration and persistence.
- app/api/tarot/reading/route.ts — canonical reading route.
- tests/fixtures/tarot-reading-quality.ts — approved quality fixture with exact cards and no expected answer.
- tests/tarot-ai.test.ts — provider contract, factory, retry, and secret-safety tests.
- tests/tarot-reading-context.test.ts — context completeness and data-boundary tests.
- tests/tarot-reading-service.test.ts — orchestration, persistence, and error mapping tests.

Modify:

- lib/tarot-interpretation.ts — replace the old local-reading contract with strict response validation and normalized types.
- lib/tarot-repository.ts — add historical-template and upright/reversed meaning reads; map the new payload into existing physical reading columns.
- app/api/tarot/interpret/route.ts — compatibility re-export of the canonical route.
- cloudflare-env.d.ts — declare the optional server-side provider variables.
- app/room/room.tsx — call the canonical endpoint and render the structured payload.
- lib/i18n.ts — add English/Vietnamese labels and retry/unavailable copy.
- app/globals.css — touch only if the new structured sections need a minimal style adjustment.
- existing Tarot tests — update contracts from the old local fallback shape to the canonical shape.
- README.md — document provider setup and endpoint compatibility.
- docs/PROJECT_STATE.md — record the verified implementation, configuration, and remaining deployment work.

Do not modify:

- app/api/tarot/draw/route.ts, except for a test-only contract assertion if needed.
- db/schema.ts or migrations, unless implementation verification proves the existing readings columns cannot store the normalized payload.
- lib/tarot-narrative.ts for this feature.

---

## Task 1: Define the structured AI reading contract and prompt

**Files:**

- Create lib/ai/types.ts
- Create lib/ai/prompts/tarot-reading.ts
- Create tests/fixtures/tarot-reading-quality.ts
- Create tests/tarot-ai.test.ts
- Modify lib/tarot-interpretation.ts

- [ ] Write failing tests that require a provider-neutral input and output contract. The output must contain overview, cards, connections, guidance, and closing. Each card item must contain the stable reading-card id, position key, interpretation, and reflection_prompt. The expected-card set must be exact: no missing drawn card, duplicate card, unknown card, or extra card.
- [ ] Add lib/ai/types.ts with these exported types:

      export type TarotLocale = "en" | "vi";
      export type TarotOrientation = "upright" | "reversed";
      export type TarotProviderId = "openai" | "gemini" | "deepseek";

      export type TarotMeaningEvidence = {
        summary: string;
        energy: string;
        actions: string[];
        relationships: string;
        work: string;
        creativity: string;
        home: string;
        symbolism: string;
        journalQuestions: string[];
        keywords: string[];
      };

      export type TarotReadingCardContext = {
        readingCardId: string;
        orientation: TarotOrientation;
        position: {
          id: string;
          key: string;
          order: number;
          name: string;
          meaning: string;
          prompt: string;
        };
        card: {
          id: string;
          nameEn: string;
          nameVi: string;
          arcana: string;
          suit: string | null;
          keywords: string[];
        };
        knowledge: {
          upright: TarotMeaningEvidence;
          reversed: TarotMeaningEvidence;
        };
      };

      export type TarotReadingInput = {
        locale: TarotLocale;
        question: string;
        optionalContext: string | null;
        category: { id: string; key: string; name: string } | null;
        spread: { id: string; key: string; name: string; description: string };
        cards: TarotReadingCardContext[];
      };

      export type TarotProviderCard = {
        reading_card_id: string;
        position_key: string;
        interpretation: string;
        reflection_prompt: string;
      };

      export type TarotProviderOutput = {
        overview: string;
        cards: TarotProviderCard[];
        connections: string;
        guidance: string;
        closing: string;
      };

      export type TarotReadingCard = TarotProviderCard & {
        position: TarotReadingCardContext["position"];
        card: TarotReadingCardContext["card"];
        orientation: TarotOrientation;
      };

      export type TarotReadingPayload = {
        overview: string;
        cards: TarotReadingCard[];
        connections: string;
        guidance: string;
        closing: string;
        disclaimer: string;
      };

- [ ] Replace the old production-facing contract in lib/tarot-interpretation.ts with Zod schemas for the raw provider output and the normalized payload. Export ReadingPayload as an alias of TarotReadingPayload for existing imports. Implement parseReadingPayload(value, expectedCards, locale): parse strict provider JSON, index the expected cards, reject exact-coverage violations, copy only trusted position/card/orientation metadata into the normalized card array, and choose the localized disclaimer from the locale. Do not include arbitrary provider metadata in the returned object.
- [ ] Remove buildLocalReading and the old generic provider implementation from the production interpretation path. Keep any legacy type aliases only when a current caller or test needs them during the transition, and make them point to the new strict types rather than preserving the old response shape.
- [ ] Create the quality fixture with the exact quality question and spread/card combination approved in the spec. Store only trusted input data and assertions about structural quality; do not encode an expected Tarot answer or force a particular interpretation.
- [ ] Add prompt tests that assert the serialized prompt includes the locale, question, optional context, spread, position meanings, orientation, both upright/reversed knowledge rows, and only the drawn cards. Assert that the instructions demand whole-spread reasoning, card-to-card connections, uncertainty-aware language, no diagnosis or certainty claims, and valid JSON with no markdown wrapper.
- [ ] Implement lib/ai/prompts/tarot-reading.ts. Set TAROT_PROMPT_VERSION to tarot-reading-v2. Define an exact JSON schema object with additionalProperties false, required overview/cards/connections/guidance/closing, and card fields reading_card_id/position_key/interpretation/reflection_prompt. Define the system prompt as these exact instruction lines:

      You are VinTarot's Tarot interpretation engine.
      Analyze the complete spread before writing any section.
      Use the question, optional context, spread, position meaning, orientation, and card knowledge as evidence.
      Explain meaningful connections between cards instead of concatenating isolated card meanings.
      Treat the reading as reflective guidance, not a prediction, diagnosis, legal advice, medical advice, or certainty about another person's private thoughts.
      Do not invent cards, positions, facts, citations, or events.
      Return only valid JSON matching the supplied schema. Do not wrap JSON in markdown.

  Implement buildTarotPromptContext(input) by returning JSON.stringify of an object containing target_language, question, optional_context, category, spread, and drawn_cards. Each drawn card must serialize reading_card_id, orientation, position, card, and knowledge. Treat question and optional context as untrusted data fields, not instructions.
- [ ] Run the focused contract tests and commit the completed slice as feat: define structured tarot AI reading contract.

## Task 2: Add explicit OpenAI, Gemini, and DeepSeek adapters

**Files:**

- Create lib/ai/provider.ts
- Create lib/ai/http.ts
- Create lib/ai/openai.ts
- Create lib/ai/gemini.ts
- Create lib/ai/deepseek.ts
- Create lib/ai/factory.ts
- Modify cloudflare-env.d.ts
- Modify tests/tarot-ai.test.ts

- [ ] Extend failing tests for the provider boundary. Cover successful extraction for each provider, request headers and body shape, missing provider configuration, unsupported provider, timeout, network failure, 408/429/5xx retry once, no retry for ordinary 4xx, malformed JSON, and error messages that never contain an API key or raw upstream body.
- [ ] Implement lib/ai/provider.ts:

      export type TarotAIErrorCode =
        | "configuration"
        | "timeout"
        | "upstream"
        | "invalid_response";

      export class TarotAIError extends Error {
        readonly code: TarotAIErrorCode;
        readonly retryable: boolean;
        constructor(
          code: TarotAIErrorCode,
          message: string,
          options?: { retryable?: boolean; cause?: unknown },
        );
      }

      export type TarotAIProvider = {
        id: TarotProviderId;
        model: string;
        generateReading(input: TarotReadingInput): Promise<TarotReadingPayload>;
      };

- [ ] Implement lib/ai/http.ts with an injectable fetch function and timeoutMs constrained to 1,000 through 20,000 milliseconds. Use AbortController, classify timeout and network errors as retryable, retry exactly once for network failures and status 408, 429, 500, 502, 503, or 504, and close/read the response without including its body in thrown errors. Parse only JSON content supplied by an adapter.
- [ ] Implement lib/ai/openai.ts against POST https://api.openai.com/v1/responses. Send Authorization Bearer key and application/json. Send model, instructions, input, store:false, temperature:0.35, max_output_tokens:5000, and text.format with type json_schema, a strict schema name, strict:true, and the Tarot JSON schema. Extract the first output_text string, parse JSON, and pass it to parseReadingPayload.
- [ ] Implement lib/ai/gemini.ts against POST https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={key}. Send systemInstruction, one user content containing the serialized prompt, and generationConfig with temperature:0.35, responseMimeType:application/json, and responseSchema matching the Tarot JSON schema. Extract the first candidate content part text, parse JSON, and pass it to parseReadingPayload.
- [ ] Implement lib/ai/deepseek.ts against POST https://api.deepseek.com/chat/completions. Send Authorization Bearer key and application/json. Send model, temperature:0.35, response_format:{ type:"json_object" }, and system/user messages containing the exact prompt instructions and serialized context. Extract choices[0].message.content, parse JSON, and pass it to parseReadingPayload.
- [ ] Implement lib/ai/factory.ts with createTarotAIProvider(env, dependencies). Read TAROT_AI_PROVIDER and reject absent or unsupported values with TarotAIError code configuration. Map exactly:

      openai -> OPENAI_API_KEY + OPENAI_TAROT_MODEL
      gemini -> GEMINI_API_KEY + GEMINI_TAROT_MODEL
      deepseek -> DEEPSEEK_API_KEY + DEEPSEEK_TAROT_MODEL

  Require both key and model for the selected provider. Never inspect another provider's key as a fallback. Keep the key inside the adapter closure and never return it from the provider object.
- [ ] Add optional string declarations for TAROT_AI_PROVIDER, OPENAI_API_KEY, OPENAI_TAROT_MODEL, GEMINI_API_KEY, GEMINI_TAROT_MODEL, DEEPSEEK_API_KEY, and DEEPSEEK_TAROT_MODEL in cloudflare-env.d.ts. Do not expose these values through a client module or a public response.
- [ ] Run provider tests with fake fetch implementations and commit the completed slice as feat: add selectable tarot AI providers.

## Task 3: Build trusted D1 context and persistence mapping

**Files:**

- Create lib/tarot-reading-context.ts
- Create tests/tarot-reading-context.test.ts
- Modify lib/tarot-repository.ts

- [ ] Write failing repository/context tests for exact session ownership, historical spread lookup, locale selection, card order, orientation, position metadata, both upright and reversed meanings, question and optional context, and category metadata. Assert that missing positions or missing meaning rows fail before any provider call. Assert that a prompt context cannot contain a card not present in reading_cards.
- [ ] Add getReadingTemplate(templateId, locale) to lib/tarot-repository.ts. It must load the stored spread template and its positions by ID without requiring the template to remain active, so an older session remains interpretable after catalog changes. Return localized position name, meaning, and prompt in the requested locale.
- [ ] Add getMeaningPair(cardId, locale) to lib/tarot-repository.ts. Return both upright and reversed CardMeaningRow values for the active card/deck and locale. Do not let the caller silently substitute the opposite orientation or a different locale.
- [ ] Add buildTarotReadingInput(args) to lib/tarot-reading-context.ts with this signature:

      export function buildTarotReadingInput(args: {
        session: ReadingSessionRow;
        cards: ReadingCardWithDetails[];
        template: ReadingTemplateWithPositions;
        meanings: Map<string, { upright: CardMeaningRow; reversed: CardMeaningRow }>;
        locale: TarotLocale;
      }): TarotReadingInput;

  Validate that session cards are non-empty, ordered by positionOrder, have unique readingCardId values, have matching template positions, and have a meaning pair. Map only the selected card metadata, localized position metadata, and the complete pair of knowledge rows into the AI input. Keep question and optional context bounded to the route/service input limits.
- [ ] Update saveReading in lib/tarot-repository.ts to persist:

      overview -> readings.opening
      cards JSON -> readings.card_readings
      connections -> readings.synthesis
      guidance -> readings.advice
      closing -> readings.closing
      disclaimer -> readings.disclaimer

  Persist provider model and TAROT_PROMPT_VERSION in the existing model_name and prompt_version columns. Keep the write parameterized and preserve the session/provider ownership checks.
- [ ] Run context and repository tests and commit the completed slice as feat: build trusted tarot AI context.

## Task 4: Serve one canonical, owner-checked AI reading

**Files:**

- Create lib/tarot-reading-service.ts
- Create app/api/tarot/reading/route.ts
- Modify app/api/tarot/interpret/route.ts
- Modify tests/tarot-reading-service.test.ts
- Modify tests/tarot-api-contract.test.ts

- [ ] Write failing route/service tests for valid owner access, unknown session, another owner's session, empty or incomplete sessions, invalid locale, missing provider configuration, upstream failure, invalid provider JSON, persistence failure, and compatibility through /api/tarot/interpret. Assert that no local template fallback is returned and that the client payload exposes provider/model metadata without secrets.
- [ ] Implement generateTarotReading(args) in lib/tarot-reading-service.ts:

      export async function generateTarotReading(args: {
        repository: TarotRepository;
        ownerId: string;
        sessionId: string;
        locale: TarotLocale;
        provider: TarotAIProvider;
      }): Promise<{
        sessionId: string;
        locale: TarotLocale;
        source: "ai";
        provider: TarotProviderId;
        modelName: string;
        promptVersion: string;
        reading: TarotReadingPayload;
      }>;

  Load the session with owner check, load the historical template by the session's stored template ID, load exact session cards in position order, load meaning pairs, build trusted input, call the selected provider once, persist the normalized result, and return the canonical response. Convert repository absence to 404, incomplete draw/session state to 409, and provider configuration/upstream/invalid-response errors to safe retryable 503 responses. Do not retry at the orchestration layer after the provider HTTP helper has exhausted its one retry.
- [ ] Implement POST in app/api/tarot/reading/route.ts. Parse only z.object({ session_id:z.string().min(1), locale:z.enum(["en","vi"]) }). Resolve origin, owner, and D1 using the existing server helpers. Create the provider with the server env, call the service, and return the canonical JSON. Log only request/session/provider/model/status metadata; never log question text, optional context, prompt, key, or raw upstream body.
- [ ] Replace app/api/tarot/interpret/route.ts with a compatibility re-export:

      export { POST } from "@/app/api/tarot/reading/route";

  Do not maintain a second implementation or a divergent response shape.
- [ ] Run route/service/API contract tests and commit the completed slice as feat: serve trusted AI tarot readings.

## Task 5: Render the structured reading in Room

**Files:**

- Modify app/room/room.tsx
- Modify lib/i18n.ts
- Modify app/globals.css only if focused UI tests or browser inspection require it
- Modify tests/tarot-room.test.ts and any existing reading contract tests

- [ ] Write failing Room tests that require a request to /api/tarot/reading, a response read from reading.overview, reading.cards, reading.connections, reading.guidance, reading.closing, and reading.disclaimer, and card rendering from trusted cardName/orientation/position metadata. Assert that reading.card_readings and the old local fallback copy are not used.
- [ ] Update the Room ReadingPayload type and interpretReading request to the canonical endpoint. Preserve the current request-id/session-id stale-response guard, loading state, draw flow, reset behavior, journal input, accessibility labels, and mobile result layout.
- [ ] Render the sections in this order: Overview, cards by spread position, How cards connect, Guidance, Closing reflection, and disclaimer. Show each card's position, localized card name, orientation, interpretation, and reflection prompt. Use the trusted normalized metadata returned by the server for labels; do not derive labels from arbitrary provider text.
- [ ] Add English and Vietnamese i18n labels for the section headings, AI unavailable message, retry action, and provider-neutral loading/error copy. Keep the final reading framed as reflective guidance.
- [ ] Make only the smallest CSS adjustment required to preserve the Moonlight visual language, reading hierarchy, contrast, focus states, and narrow-screen wrapping. Do not redesign the Room or replace existing reference styling.
- [ ] Run Room and focused API tests and commit the completed slice as feat: render structured AI tarot readings in Room.

## Task 6: Document and verify the feature

**Files:**

- Modify README.md
- Modify docs/PROJECT_STATE.md
- Add or update tests only when required for a documented contract

- [ ] Add a README section with a placeholder-only environment block:

      TAROT_AI_PROVIDER=openai
      OPENAI_API_KEY=replace-with-server-secret
      OPENAI_TAROT_MODEL=replace-with-supported-model
      GEMINI_API_KEY=replace-with-server-secret
      GEMINI_TAROT_MODEL=replace-with-supported-model
      DEEPSEEK_API_KEY=replace-with-server-secret
      DEEPSEEK_TAROT_MODEL=replace-with-supported-model

  Explain that only the selected provider's key/model pair is required, all keys are server-side secrets, the canonical endpoint is /api/tarot/reading, and /api/tarot/interpret is a compatibility alias. Include local test commands without real credentials.
- [ ] Add a documentation contract test that fails if README contains a credential-looking value, a real token prefix, or instructions to expose provider keys to the browser.
- [ ] Run the complete focused suite:

      npx tsx --test tests/tarot-ai.test.ts tests/tarot-interpretation.test.ts tests/tarot-reading-context.test.ts tests/tarot-reading-service.test.ts tests/tarot-api-contract.test.ts tests/tarot-draw.test.ts tests/tarot-catalog.test.ts tests/tarot-seed.test.ts tests/tarot-room.test.ts

- [ ] Run typecheck, the repository's build command, lint if configured, and git diff --check. If lint reports an unchanged pre-existing baseline issue, record the exact command and evidence in PROJECT_STATE.md rather than hiding it.
- [ ] Update docs/PROJECT_STATE.md with the provider environment contract, canonical and compatibility routes, no-migration decision, boundary that keeps tarot-narrative for Guidebook/seed only, verification commands and counts, and any deployment configuration still required.
- [ ] Inspect the final staged diff for secrets and unrelated files, then commit the documentation and verification slice as docs: record configurable tarot AI verification.
- [ ] Push the completed branch to its configured origin. Report the remote result explicitly; a local commit alone is not a backup.

## Self-Review Checklist

- [ ] Every task has a failing test before implementation and an explicit focused verification command.
- [ ] Provider selection is explicit and tested for all three providers; no provider silently falls back to another provider.
- [ ] All provider request bodies are server-only and contain no keys in logs or responses.
- [ ] The final payload uses overview/cards/connections/guidance/closing and exact drawn-card coverage.
- [ ] Historical sessions use stored template and position IDs, not the current active catalog.
- [ ] Both upright and reversed meaning rows are supplied as evidence while the selected orientation is preserved.
- [ ] The old local template path is absent from the production reading route but remains available to Guidebook/seed consumers.
- [ ] Room preserves draw behavior, stale-request guards, accessibility, Moonlight styling, and mobile layout.
- [ ] README and PROJECT_STATE match the implemented environment names, endpoint names, persistence mapping, and verified commands.
- [ ] No placeholder tokens, real secrets, unrelated files, or unverified completion claims remain.
