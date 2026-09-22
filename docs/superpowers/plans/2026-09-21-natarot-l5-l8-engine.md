# NaTarot L5–L8 Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task with verification checkpoints.

**Goal:** Complete L5 whole-spread semantics, L6 validated provider delivery reliability, L7 contextual follow-up suggestions, and L8 server-authoritative supplementary clarification draws from the verified L4 base.

**Architecture:** Derive spread semantics from the existing catalog without a new data source, carry a bounded semantic object into the existing V5 reading context, and keep validated final JSON as the only authoritative provider result. Normalize follow-up suggestions deterministically from the saved reading, and persist clarification draws as an optional backward-compatible extension of `readings.reading_payload` after owner/card/provider validation.

**Tech Stack:** React 19, TypeScript, Node `node:test` via `tsx`, Zod, existing D1/SQLite repository, existing DeepSeek/provider abstraction, Vinext/Vite, current Moonlight/NaTarot UI.

**Spec:** `docs/superpowers/specs/2026-09-21-natarot-l5-l8-engine-design.md`

## Global Constraints

- Start from `f92b073e69e57462f5ea898d2fe8a521ac2c4fac` and work only on `codex/natarot-l5-l8-engine`.
- Preserve the established catalog → L1 → L4 → Room → draw → trusted reading context → AI → follow-up chain.
- No database migration; use the existing nullable `readings.reading_payload` JSON only if the optional extension remains backward compatible.
- Do not change auth identity, ownership, OAuth, cookies, F-001, Knowledge Base V5 content, deployment/VPS configuration, or unrelated Home/UI work.
- Never persist a provider result before final schema, card-coverage, ownership, and duplicate checks pass.
- Do not implement credits, VIP, payment, affiliate, share, QR, public-reading URLs, or a final UI redesign.
- Use TDD: each new behavior gets a failing focused test, a witnessed red run, minimal implementation, and a green run before refactoring.

---

### Task 1: Add deterministic whole-spread semantics

**Files:**
- Create: `lib/tarot-spread-semantics.ts`
- Modify: `lib/tarot-catalog.ts`
- Modify: `lib/tarot-spread.ts`
- Modify: `lib/tarot-repository.ts`
- Modify: `lib/tarot-reading-context.ts`
- Modify: `lib/ai/types.ts`
- Modify: `lib/ai/prompts/tarot-reading.ts`
- Test: `tests/tarot-spread-semantics.test.ts`
- Modify: `tests/tarot-catalog.test.ts`
- Modify: `tests/tarot-reading-context.test.ts`
- Modify: `tests/tarot-repository.test.ts`

**Interfaces:**
- `deriveTarotSpreadSemantics(input): TarotSpreadSemanticsSeed` deterministically returns localized whole-spread fields and key-based relationships.
- `localizeTarotSpreadSemantics(seed, locale): TarotSpreadSemantics` returns the bounded AI/catalog representation.
- `TarotCatalogTemplate.semantics` and `ReadingTemplateWithPositions.semantics` expose the localized representation without changing IDs, positions, or geometry.
- `TarotReadingInput.spread.semantics` is populated by `buildTarotReadingInput`; it is optional at the type boundary so older test fixtures and callers remain compatible.

- [ ] **Step 1: Write failing semantics tests.** Assert all current catalog templates derive non-empty purpose, suitability, strategy, guidance, and valid key relationships; assert deterministic deep equality, no geometry fields, and distinct branch/timeline/conflict strategy behavior.
- [ ] **Step 2: Run the focused tests to verify the expected missing-semantics failure.** Run `npx tsx --test tests/tarot-spread-semantics.test.ts tests/tarot-catalog.test.ts tests/tarot-reading-context.test.ts`; confirm the new contract fails for the absent helper/property rather than a test typo.
- [ ] **Step 3: Implement the pure derivation/localization helper.** Use `spreadType`, slug/position-key patterns, and ordered positions to derive bounded purpose, intent suitability, temporal focus, emphasis, synthesis guidance, and adjacent/branch/bridge relationships. Ensure every relationship’s `from` and `to` is a valid position key and fall back to an ordered strategy for unknown legacy definitions.
- [ ] **Step 4: Thread semantics through catalog resolution and repository templates.** Add the property to localized catalog templates and `resolveTarotSpread`, derive it from D1 rows in `mapCatalogRows` and `getReadingTemplate`, and populate `TarotReadingInput.spread` without altering `SpreadBoard` geometry or draw payloads.
- [ ] **Step 5: Add bounded AI context assertions and run green focused regressions.** Include only the localized semantic fields plus capped relationships/emphasis in `buildTarotPromptContext` and follow-up context. Run `npx tsx --test tests/tarot-spread-semantics.test.ts tests/tarot-catalog.test.ts tests/tarot-spread.test.ts tests/tarot-spread-geometry.test.ts tests/tarot-reading-context.test.ts tests/tarot-repository.test.ts tests/tarot-ai.test.ts`.
- [ ] **Step 6: Run L1/L4 regression gates and commit the L5 checkpoint.** Run the relevant spread/draw/Room/recommendation suites, `npx tsc --noEmit`, `npm run build`, targeted ESLint on changed L5 files, and `git diff --check`. Inspect the staged diff for secrets/protected-zone changes, then commit `feat: add whole-spread tarot semantics`.

### Task 2: Harden validated provider delivery without partial persistence

**Files:**
- Modify: `lib/ai/http.ts`
- Modify: `lib/ai/provider.ts`
- Modify: `lib/ai/deepseek.ts`
- Modify: `lib/tarot-reading-service.ts`
- Modify: `lib/tarot-follow-up-service.ts`
- Modify: `lib/tarot-reading-route.ts`
- Test: `tests/tarot-ai.test.ts`
- Modify: `tests/tarot-reading-service.test.ts`
- Modify: `tests/tarot-reading-route.test.ts`
- Modify: `tests/tarot-follow-up.test.ts`

**Interfaces:**
- Existing `TarotAIError` remains the safe provider error boundary with bounded retryability/diagnostic fields.
- Existing `generateTarotReading` persists only after `parseReadingPayload` succeeds; its retry budget remains finite and observable through the existing diagnostics callback.
- Follow-up/clarification response parsing uses the existing strict `{ answer }` schema and never persists partial chunks.

- [ ] **Step 1: Add failing tests for empty/malformed envelopes, timeout/retry limits, and no partial persistence.** Cover valid DeepSeek JSON, empty content, malformed provider JSON, retryable HTTP status, non-retryable status, timeout, schema-invalid output, and exactly-one persistence after a successful retry.
- [ ] **Step 2: Run the reliability tests red.** Run `npx tsx --test tests/tarot-ai.test.ts tests/tarot-reading-service.test.ts tests/tarot-reading-route.test.ts`; confirm at least the new assertions fail against the current behavior and capture any baseline failures separately.
- [ ] **Step 3: Implement the smallest reliability changes at the current boundaries.** Preserve one transport retry for bounded transient statuses/errors, classify empty/malformed JSON/envelopes as invalid responses, normalize thrown non-provider errors to safe upstream failures, and retry only the allowed retryable response class once at the service layer. Do not add a second provider adapter or write partial data.
- [ ] **Step 4: Add an explicit delivery decision to code comments/tests.** Keep the single final JSON response and existing loading state because partially streamed JSON cannot be authoritative under the current client/runtime contract; assert that no persistence callback occurs before final validation.
- [ ] **Step 5: Run the full AI/follow-up regression set green.** Run `npx tsx --test tests/tarot-ai.test.ts tests/tarot-interpretation.test.ts tests/tarot-reading-context.test.ts tests/tarot-reading-service.test.ts tests/tarot-reading-route.test.ts tests/tarot-follow-up.test.ts tests/tarot-follow-up-route.test.ts tests/tarot-api-contract.test.ts`.
- [ ] **Step 6: Run static gates and commit L6.** Run `npx tsc --noEmit`, `npm run build`, targeted ESLint for provider/reading files, and `git diff --check`; inspect staged diff and commit `feat: harden tarot reading delivery`.

### Task 3: Normalize contextual follow-up suggestions

**Files:**
- Create: `lib/tarot-follow-up-suggestions.ts`
- Modify: `lib/tarot-reading-service.ts`
- Modify: `lib/tarot-reading-compat.ts`
- Modify: `lib/ai/types.ts`
- Modify: `components/reading/follow-up-reading.tsx`
- Modify: `components/reading/reading-panel.tsx`
- Modify: `app/room/room.tsx`
- Modify: `lib/i18n.ts`
- Test: `tests/tarot-follow-up-suggestions.test.ts`
- Modify: `tests/tarot-follow-up.test.ts`
- Modify: `tests/tarot-reading-ui.test.ts`

**Interfaces:**
- `selectContextualFollowUpSuggestions(reading, question, locale): string[]` returns at most three question-shaped, non-redraw suggestions derived from trusted reading fields.
- Existing `TarotReadingPayload` keys remain unchanged; suggestion normalization replaces only the existing `followUpSuggestions` array.
- `ReadingPanel` continues to use the existing follow-up callback and adds no transcript persistence or parallel chat route.

- [ ] **Step 1: Write failing deterministic suggestion tests.** Cover English/Vietnamese output, derivation from a next-step/insight/position, filtering generic redraw phrases, max-three cardinality, stable repeated output, and preservation of agency/conditional language.
- [ ] **Step 2: Run the suggestion tests red.** Run `npx tsx --test tests/tarot-follow-up-suggestions.test.ts`; confirm the helper is missing or the new contract fails for the intended reason.
- [ ] **Step 3: Implement deterministic suggestion selection.** Prefer specific existing provider suggestions that survive the no-redraw/question-shaped filter, then fill from the current insight title, next-step title, and position role using bilingual templates; deduplicate case-insensitively and cap at three without making a provider call.
- [ ] **Step 4: Normalize new readings before persistence and keep historical parsing compatible.** Apply the selector after final reading validation and before `saveReading`; keep the optional/legacy parser able to read rows with no new fields and do not alter card evidence or output cardinalities.
- [ ] **Step 5: Wire the existing UI minimally.** Keep the current manual input and suggestion buttons, add only the callback/state needed to show contextual clarification controls later, preserve VI/EN labels, and do not redesign the result surface.
- [ ] **Step 6: Run L7 focused/regression gates and commit.** Run suggestion, follow-up, reading-service, saved-reading, reading-UI, and i18n suites, then `npx tsc --noEmit`, `npm run build`, targeted ESLint, `git diff --check`; commit `feat: improve contextual tarot follow-ups` after protected-zone review.

### Task 4: Add the backward-compatible clarification provider contract

**Files:**
- Modify: `lib/ai/types.ts`
- Modify: `lib/ai/provider.ts`
- Modify: `lib/ai/deepseek.ts`
- Modify: `lib/ai/prompts/tarot-reading.ts`
- Modify: `lib/tarot-interpretation.ts`
- Modify: `lib/tarot-reading-context.ts`
- Modify: `lib/tarot-repository.ts`
- Modify: `lib/tarot-reading-compat.ts`
- Test: `tests/tarot-ai.test.ts`
- Modify: `tests/tarot-reading-context.test.ts`
- Modify: `tests/tarot-repository.test.ts`

**Interfaces:**
- `TarotClarificationInput` carries the original validated reading context plus one trusted supplementary card.
- `TarotAIProvider.generateClarification?(input)` returns the existing strict `{ answer: string }` payload; each configured provider implements it with a dedicated clarification system prompt and its native structured JSON transport.
- `TarotRepository.updateReadingPayload(readingId, sessionId, payload, expectedPayload?): Promise<boolean>` updates only the exact reading row and supports request-id idempotency checks.
- `TarotReadingPayload.supplementaryDraws?` is optional and capped; old payloads parse without it.

- [ ] **Step 1: Write failing contract/persistence tests.** Assert clarification context contains original question/spread/reading plus server-selected card, provider parsing rejects invalid answer JSON, old normalized/legacy readings still parse, and repository payload updates are session-scoped.
- [ ] **Step 2: Run the contract tests red.** Run `npx tsx --test tests/tarot-ai.test.ts tests/tarot-reading-context.test.ts tests/tarot-repository.test.ts tests/tarot-saved-reading.test.ts`; verify missing types/methods/schema behavior is the failure.
- [ ] **Step 3: Add the optional payload schema/type and trusted card-context builder.** Reuse D1 meaning/V5 evidence, keep the original card evidence untouched, bound all new strings/arrays, and expose no client-supplied card identity to the provider input.
- [ ] **Step 4: Implement the DeepSeek clarification call through the existing HTTP client.** Reuse the final JSON contract, server-side model/key configuration, timeout, and error taxonomy; do not stream or persist provider chunks.
- [ ] **Step 5: Implement the exact repository update.** Add one owner-independent low-level update method that requires reading id/session id and, when supplied, the prior JSON value; return `false` on a lost compare-and-set so the service can reload and honor an existing request id.
- [ ] **Step 6: Run contract/data regressions green.** Include compatibility, saved-reading, parser, provider, SQLite/D1, migration, and ownership tests before moving to the route/service.

### Task 5: Implement server-authoritative supplementary draw and minimal UI

**Files:**
- Create: `lib/tarot-clarification-service.ts`
- Create: `lib/tarot-clarification-route.ts`
- Create: `app/api/tarot/clarification/route.ts`
- Modify: `lib/tarot-draw.ts`
- Modify: `components/reading/follow-up-reading.tsx`
- Modify: `components/reading/reading-panel.tsx`
- Modify: `app/room/room.tsx`
- Modify: `lib/i18n.ts`
- Modify: `app/globals.css` only if existing reading tokens need one small clarification rule
- Create: `tests/tarot-clarification.test.ts`
- Create: `tests/tarot-clarification-route.test.ts`
- Modify: `tests/tarot-reading-ui.test.ts`
- Modify: `tests/tarot-draw.test.ts`
- Modify: `tests/tarot-saved-reading.test.ts`

**Interfaces:**
- Request: `{ session_id: string; locale: "en" | "vi"; question: string; request_id: string }`.
- Response: `{ session_id, reading_id, clarification: { id, request_id, sequence, question, relationship: "clarification", card, orientation, answer } }`.
- `generateTarotClarification` validates owner/session/status/card uniqueness, chooses the server card/orientation, calls the provider once plus the bounded invalid-response retry, and appends an optional payload item with a maximum of three items.

- [ ] **Step 1: Write failing service/route tests.** Cover valid owner draw, foreign owner/invalid session, incomplete reading, duplicate card exclusion, orientation, max-three limit, provider failure without payload mutation, same-request idempotency, origin/schema errors, and normal draw regression.
- [ ] **Step 2: Run the new tests red.** Run `npx tsx --test tests/tarot-clarification.test.ts tests/tarot-clarification-route.test.ts`; verify the route/service/module is absent or the intended contract assertions fail.
- [ ] **Step 3: Implement trusted server selection and context reload.** Reuse `getSessionForOwner`, `getReadingTemplate`, `getLatestReadingForOwner`, `parseStoredReading`, and deck/card repository data. Exclude every original and previously persisted supplementary card; choose the next sequence and orientation server-side; reject limits before provider work.
- [ ] **Step 4: Implement idempotent persistence and safe route mapping.** Check `request_id` in the latest payload, call the provider only for a new request, use the repository compare-and-set update, reload on a compare-and-set miss, and map provider/service failures to fixed safe status responses without logging secrets.
- [ ] **Step 5: Wire the minimal reading-surface CTA.** Add a bilingual clarification button beside manual follow-up, require/use the current follow-up question, show the returned card/orientation/answer, disable while loading, and keep the original reading plus follow-up history intact. Preserve 44px targets, mobile flow, reduced motion, and Moonlight/NaTarot tokens.
- [ ] **Step 6: Run L8 focused tests and browser checks.** Run clarification, draw, follow-up, saved-reading, UI, ownership, and AI suites; verify the desktop flow and 390/375 layouts do not overflow and the CTA remains usable.

### Task 6: Final L5–L8 integration, documentation, push, and evidence

**Files:**
- Modify: `docs/PROJECT_STATE.md`
- No other files unless a directly evidenced integration defect is found and fixed with a focused test.

- [ ] **Step 1: Run the complete required regression.** Run `npx tsx --test tests/*.test.ts` and record the exact pass/fail count; include L1A/L1B/L1C/L4 catalog, geometry, draw, Room, reading, follow-up, saved-reading, auth/ownership, and migration suites in the run or focused pre-run.
- [ ] **Step 2: Run static checks.** Run `npx tsc --noEmit`, `npm run build`, targeted ESLint for every changed/new code file, and `git diff --check`; distinguish baseline lint debt from any new error.
- [ ] **Step 3: Run runtime/browser QA where supported.** Complete question → Auto topic/spread → Room → draw → reading → contextual follow-up → clarification draw at desktop plus 390px and 375px; check Celtic Cross/10-card and a 12-card template where catalog-supported, document unavailable physical/provider checks honestly, and ensure no document overflow.
- [ ] **Step 4: Review compatibility/security/cost boundaries.** Verify historical payload parsing, old Room JSON, ownership/origin checks, no arbitrary client card injection, server-side keys, no duplicate normal-reading persistence, and provider call counts (one initial reading with bounded retries; no suggestion call; one follow-up; one clarification with bounded invalid-response retry).
- [ ] **Step 5: Update project state and inspect all staged diffs.** Append minimal L5/L6/L7/L8 verified/pushed/not-merged/not-deployed evidence without overwriting newer entries. Run `git diff --name-only f92b073e...`, inspect `git diff --cached`, and confirm no env/secrets/runtime DB/build output or protected-zone changes.
- [ ] **Step 6: Commit docs, push normally, and verify remote.** Create only an optional final docs/integration commit if needed, push `git push -u origin codex/natarot-l5-l8-engine`, then compare `git rev-parse HEAD` with `git rev-parse origin/codex/natarot-l5-l8-engine` and record the final checkpoint SHAs for the final mission report.
