# Task 3 report — trusted D1 context and persistence mapping

Status: COMPLETE for the Task 3 slice. Self-reviewed; focused tests, scoped TypeScript, targeted ESLint, and diff checks pass. Full-project TypeScript was not green at the recorded check (Room migration outside this task). Commit message: `feat: build trusted tarot AI context`. Work performed directly on `codex/tooling-and-version-history`; no worktree, subagent, reviewer, deployment, or Tasks 4–6 implementation was created by this task.

## Implemented behavior

- Preserved and verified the existing additive `getReadingTemplate(templateId, locale)` implementation. It looks up the stored ID without active category/template filters, returning localized category, spread and ordered position name/meaning/prompt.
- Preserved and verified `getMeaningPair(cardId, locale)`: exact card and locale, both distinct orientation rows, joined to an active deck. The schema has no card-level active flag. Missing variants return null; there is no orientation or locale substitution. Complete string journal evidence is retained in this new pair method; legacy `getMeaning` behavior remains unchanged.
- `buildTarotReadingInput` validates nonempty complete card counts, session/template/category relationships, each card's session ID, unique reading-card/card/position IDs, unique integer position orders, valid orientations, matching stored position ID/key/order, and exact meaning identity/locale/orientation.
- Input order follows `positionOrder`, even when repository rows arrive in `cardOrder` order. Input arrays are copied rather than reordered in place. Localized position data comes from the requested-locale historical template.
- Question is trimmed and limited to 500 characters; optional context is trimmed and limited to 5,000, with blank context represented as null, matching draw limits. Category/spread metadata comes from the trusted template.
- D1 summary, energy, actions, relationships, work, creativity, home, symbolism, journal questions and keywords remain authoritative for BOTH orientations. The D1 actions paragraph is retained as a single array item; comma/middle-dot keyword text becomes an array. Card suit and selected-orientation keywords also come from D1.
- V5 adds only explicitly allowlisted supplemental fields. Missing V5 coverage does not invalidate otherwise complete D1 context; missing D1 rows always fails. `knowledgeVersion`, `domain`, `retrievedGuidance`, `combinationHints` and `fewShotExamples` remain populated. Combination hints use drawn cards; examples now require the requested locale and all example cards to belong to the drawn set. Retrieval stays capped at two hints/examples.
- Explicit mapping excludes artwork paths, arbitrary card/client fields, owner identity, extra meaning-map entries, the full catalog and provider output.
- Existing parameterized `saveReading` maps overview→opening, cards JSON→card_readings, connections→synthesis, guidance→advice, closing→closing and disclaimer→disclaimer, preserving modelName/promptVersion and timestamps. SQL-backed tests round-trip the provider/model label and `TAROT_PROMPT_VERSION = tarot-reading-v2`, including an SQL-like prose string.
- Ownership remains at `getSessionForOwner`; provider card/position coverage remains at `parseReadingPayload`. Neither boundary was replaced or bypassed. The repository persistence method still expects a previously authorized/validated payload, as before; no service/route was added here.

## Changed files and user-owned overlap

1. `lib/tarot-reading-context.ts` — integrated into the pre-existing untracked V5 builder, adding validation and D1-authoritative mapping. Preserved the concurrently introduced orientation-narrowing helper; restored the local meaning-pair binding needed by the new mapping.
2. `lib/tarot-repository.ts` — included pre-existing Task 3 methods/types and mapping; removed only the new pair method's ten-item journal truncation.
3. `tests/tarot-reading-context.test.ts` — retained the user's original tests and added trust-boundary cases. Changed only original assertions that directly conflicted with the approved D1 authority requirement: summaries must equal D1, and the input/prompt is allowed to contain the fixture's D1 “legacy” text. Retained V5 supplemental content checks, HR001 selection, bounded retrieval, prompt serialization and no-undrawn-Fool checks.
4. `tests/tarot-repository.test.ts` — new in-memory SQLite integration tests using shipped migrations `0001_dynamic_tarot.sql` and `0002_tarot_seed.sql` through a minimal D1 execution adapter. SQL is actually executed, not matched against canned mock answers.
5. `tests/tsconfig.tarot-context.json` — reproducible scoped typecheck extending the real project compiler options.
6. `lib/ai/types.ts` — pre-existing V5 supplemental types and required input fields included unchanged.
7. `tests/fixtures/tarot-reading-quality.ts` — pre-existing required V5 fixture additions included unchanged.
8. `lib/ai/knowledge-v5.ts` — pre-existing retrieval module preserved, with the narrow locale/drawn-card example filter described above.
9. `lib/ai/prompts/tarot-reading.ts` — ONLY the pre-existing five data-serialization additions are staged. They retain the user's V5 context/prompt assertions and serialize the required supplemental fields. No system prompt, prompt version, safety instructions, provider API or response schema changes are included.
10. `natarot-knowledge/v5/cards/all-78-cards.json` — existing imported asset, unchanged (78 cards).
11. `natarot-knowledge/v5/combinations/curated-pairs.json` — existing imported asset, unchanged (26 pairs).
12. `natarot-knowledge/v5/combinations/triad-patterns.json` — existing imported asset, unchanged (6 patterns).
13. `natarot-knowledge/v5/examples/human-style-50-complete.json` — existing imported asset, unchanged (50 examples).
14. `docs/PROJECT_STATE.md` — Task 3 decision/validation/remaining-work note.
15. This report.

The four JSON files are direct runtime imports of the preserved V5 retrieval module and are necessary for a reproducible checkout of the current typed context. The remaining handbook documents, per-suit duplicate assets, golden/evaluation data and prompt documents were not staged. Existing homepage/celestial files and the untracked homepage plan were untouched. Concurrent service/route/API-test/Room work appeared during this session and was neither edited nor staged by this task. No reset, checkout, delete, overwrite of the original user work, or worktree operation was used.

The task-observer checkpoint remained project-local and ignored; no installed skill was modified.

## TDD record

First command, before production edits:

```sh
npx tsx --test tests/tarot-reading-context.test.ts tests/tarot-repository.test.ts
```

Exact summary output (exit 1):

```text
1..13
# tests 13
# suites 0
# pass 7
# fail 6
# cancelled 0
# skipped 0
# todo 0
# duration_ms 529.444834
```

The six failures demonstrated: V5 replacing D1 summaries; missing handbook coverage rejecting otherwise valid D1; cross-session cards accepted; few-shot retrieval introducing undrawn cards; journal evidence truncated at ten; and the SQL-to-context-to-save test receiving V5 rather than D1 evidence. Existing historical lookup/ownership/meaning-pair behavior already passed and was retained.

An intermediate run exposed a shared-checkout binding change (`ReferenceError: pair is not defined`): the existing orientation-narrowing edit had removed the formerly unused local binding. Restored `const pair = validateMeaningPair(...)`, preserving that helper and its behavior. A first full typecheck also identified test expectations reaching non-public catalog fields; tests were corrected to use independently seeded literal EN/VI SQL values and the public localized prompt. No production contract was weakened to make tests pass.

## Final focused tests — exact command/output

```sh
npx tsx --test --test-reporter=spec tests/tarot-reading-context.test.ts tests/tarot-repository.test.ts tests/tarot-catalog.test.ts tests/tarot-interpretation.test.ts tests/tarot-ai.test.ts tests/tarot-draw.test.ts tests/tarot-seed.test.ts tests/card-narrative.test.ts
```

Exit 0:

```text
✔ every card has a complete English and Vietnamese guidebook narrative (4.854959ms)
✔ The Fool has a localized long form guidebook entry (0.190834ms)
✔ reversed readings have their own long-form guidance (0.4765ms)
✔ The Fool reversed narrative is localized (0.125041ms)
✔ normalizes the provider-neutral output with trusted card metadata (3.389458ms)
✔ rejects missing, duplicate, unknown, extra, or mismatched cards (0.558792ms)
✔ serializes only the complete drawn-card context (0.414458ms)
✔ marks injection-like question and context as data, not instructions (0.160583ms)
✔ does not serialize secrets, artwork paths, the full catalog, or raw provider output (0.219084ms)
✔ publishes the versioned strict prompt contract (0.086041ms)
✔ openai sends its native structured request and normalizes extracted JSON (29.277541ms)
✔ gemini sends its native structured request and normalizes extracted JSON (0.833708ms)
✔ deepseek sends its native structured request and normalizes extracted JSON (0.7985ms)
✔ factory rejects absent, unsupported, and incomplete selected-provider configuration (0.424ms)
✔ factory enforces the bounded timeout range (0.091917ms)
✔ retries status 408 exactly once (0.498375ms)
✔ retries status 429 exactly once (1.556583ms)
✔ retries status 500 exactly once (1.606667ms)
✔ retries status 502 exactly once (0.470333ms)
✔ retries status 503 exactly once (0.509458ms)
✔ retries status 504 exactly once (0.458042ms)
✔ retries a network failure exactly once and reports exhausted failures safely (1.062042ms)
✔ does not retry ordinary status 400 or expose the upstream body (0.363083ms)
✔ does not retry ordinary status 401 or expose the upstream body (0.179917ms)
✔ does not retry ordinary status 403 or expose the upstream body (0.190125ms)
✔ does not retry ordinary status 404 or expose the upstream body (0.219666ms)
✔ times out each attempt, retries once, and returns a safe timeout error (2002.997917ms)
✔ keeps the timeout active through response JSON parsing and classifies a stalled body (2003.135541ms)
✔ retries a response body network failure exactly once (1.095041ms)
✔ rejects malformed provider JSON without retrying or exposing raw content (0.319958ms)
✔ catalog response groups active categories and ordered templates/positions (1.636542ms)
✔ catalog rejects a template whose position count disagrees with card_count (0.232667ms)
✔ draw plan has the exact dynamic count, unique cards, ordered positions, and orientation (1.4005ms)
✔ selected draw plan preserves the cards and order chosen by the customer (0.160958ms)
✔ selected draw plan rejects duplicate or unknown customer selections (0.6025ms)
✔ disabled reversals force upright cards (0.53525ms)
✔ draw plan rejects an undersized deck (0.140167ms)
✔ draw request parser trims bounded text and defaults optional fields (1.40625ms)
✔ draw request parser rejects an empty question (0.44725ms)
✔ provider output is normalized in ordered session-card order (2.569833ms)
✔ strict parsing rejects omitted card output (0.433458ms)
✔ strict parsing rejects arbitrary provider metadata (0.137833ms)
✔ builds a bounded V5 context from the exact stored cards and positions (2.909916ms)
✔ preserves every localized D1 evidence field and only supplements known handbook cards (0.313208ms)
✔ rejects cards from another session and duplicate position coverage (8.529708ms)
✔ fails before a provider receives missing or mismatched D1 evidence (0.464333ms)
✔ bounds stored question/context using draw limits and normalizes empty optional context (1.008083ms)
✔ ignores extra catalog/knowledge fields and never retrieves examples with undrawn cards (0.391542ms)
✔ rejects a card without its stored position or both orientation rows before provider work (0.517167ms)
✔ rejects duplicate cards, duplicate reading ids, and an incomplete session (0.696958ms)
(node:90204) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
✔ repository enforces exact guest/user ownership and scopes cards to the stored session (35.382541ms)
✔ historical template lookup keeps inactive category/template and localizes ordered positions (21.823917ms)
✔ meaning pairs require the exact card, locale, both orientations, and active deck (20.023458ms)
✔ meaning pair preserves complete journal evidence without the legacy ten-item truncation (18.611042ms)
✔ D1 context orders exact stored cards and persists the validated payload in compatibility columns (22.357375ms)
✔ canonical seed contains 78 stable cards and four meanings per card (12.071375ms)
✔ spread seed preserves every Moonlight topic and position counts (6.913916ms)
ℹ tests 57
ℹ suites 0
ℹ pass 57
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 4530.6465
```

The SQLite experimental warning is emitted by Node v22.23.1; tests use only in-memory databases and no network/provider calls. The 57 tests include 13 dedicated context/repository tests plus relevant Task 1/2, catalog, draw, seed and Guidebook narrative coverage. They exercise a single-card context as well as three-card mixed orientation spreads.

## TypeScript and lint — exact commands/output

```sh
npx tsc --noEmit -p tests/tsconfig.tarot-context.json
```

Exit 0; no output.

```sh
npx eslint lib/tarot-reading-context.ts lib/tarot-repository.ts lib/ai/knowledge-v5.ts lib/ai/types.ts lib/ai/prompts/tarot-reading.ts tests/tarot-reading-context.test.ts tests/tarot-repository.test.ts tests/fixtures/tarot-reading-quality.ts
```

Exit 0; no output.

Full project check:

```sh
npx tsc --noEmit
```

Exit 2, exact remaining output at the recorded verification time:

```text
app/room/room.tsx(111,296): error TS2339: Property 'opening' does not exist on type 'TarotReadingPayload'.
app/room/room.tsx(111,332): error TS2339: Property 'card_readings' does not exist on type 'TarotReadingPayload'.
app/room/room.tsx(111,351): error TS7006: Parameter 'card' implicitly has an 'any' type.
app/room/room.tsx(111,356): error TS7006: Parameter 'index' implicitly has an 'any' type.
app/room/room.tsx(111,673): error TS2339: Property 'synthesis' does not exist on type 'TarotReadingPayload'.
app/room/room.tsx(111,755): error TS2339: Property 'advice' does not exist on type 'TarotReadingPayload'.
app/room/room.tsx(117,41): error TS2339: Property 'card_readings' does not exist on type 'TarotReadingPayload'.
app/room/room.tsx(118,43): error TS2339: Property 'card_readings' does not exist on type 'TarotReadingPayload'.
app/room/room.tsx(139,152): error TS2339: Property 'opening' does not exist on type 'TarotReadingPayload'.
app/room/room.tsx(139,289): error TS2339: Property 'synthesis' does not exist on type 'TarotReadingPayload'.
app/room/room.tsx(139,436): error TS2339: Property 'advice' does not exist on type 'TarotReadingPayload'.
app/room/room.tsx(139,603): error TS7006: Parameter 'reading' implicitly has an 'any' type.
app/room/room.tsx(139,611): error TS7006: Parameter 'index' implicitly has an 'any' type.
app/room/room.tsx(140,198): error TS7006: Parameter 'reading' implicitly has an 'any' type.
app/room/room.tsx(140,206): error TS7006: Parameter 'index' implicitly has an 'any' type.
app/room/room.tsx(141,180): error TS2339: Property 'synthesis' does not exist on type 'TarotReadingPayload'.
app/room/room.tsx(141,319): error TS2339: Property 'advice' does not exist on type 'TarotReadingPayload'.
app/room/room.tsx(142,184): error TS2339: Property 'advice' does not exist on type 'TarotReadingPayload'.
app/room/room.tsx(142,341): error TS7006: Parameter 'reading' implicitly has an 'any' type.
```

These are 19 Room errors from the old payload consumer, outside Task 3. The shared checkout is changing concurrently, so this is a timestamped check result rather than a claim about subsequent work by other implementers.

An earlier ad-hoc scoped TypeScript CLI invocation omitted the project's ESNext library/path alias settings and failed on Error options, the `@/app/chatgpt-auth` alias, and replaceAll. The committed scoped config extends `tsconfig.json` and passes with the actual project settings; no compiler strictness was relaxed.

## Self-review, scope and concerns

- Reviewed exact session ownership (user and guest, wrong-owner and SQL-injection-like ID), historical inactive template lookup, requested locale, card order/orientation, missing/mismatched D1 evidence, nonempty/unique identity, position coverage, bounded text, metadata allowlisting and persistence mapping.
- `git diff --check` and `git diff --cached --check` passed with no output. Reviewed the staged file allowlist and data-serialization-only prompt diff. Credential-pattern scan of staged content reported `Staged secret-pattern matches: 0`. JSON import integrity/count checks passed. No credentials, env files, runtime databases, logs or build output are included.
- No migration is necessary: the shipped SQLite schema executed the entire mapping correctly. No draw/catalog caller, Guidebook narrative or seed implementation was changed.
- The pure builder can validate row consistency, but cannot prove that a structurally valid object actually came from D1. Its API is for repository results after ownership verification; request-body objects must never be passed to it. Later service/route wiring is responsible for that provenance.
- Historical lookup preserves inactive templates, not snapshots of old text if an existing row is subsequently edited. This matches the requested stored-ID lookup and existing schema.
- The retained pair parser still sanitizes malformed journal JSON to an empty array, consistent with the pre-existing implementation. It never substitutes a missing meaning orientation or locale.
- Narrower V5 architecture: handbook facts cannot replace D1, handbook absence does not block D1, and example retrieval may return zero results when no same-locale drawn-card example exists. Example questions/position labels/prose remain explicitly labeled style-reference data, never used to replace the stored reading's question, positions or card metadata.
- IMPORTANT pre-existing overlap: three unstaged user-owned system-prompt lines remain in the working tree, including “Use Knowledge Base V5.0 as the authoritative interpretation layer…”. That line conflicts with this task's D1 authority decision and would need reconciliation by the prompt owner before production use. This task does not change/stage it because the user explicitly excluded prompt safety work. The staged/committed system prompt remains the Task 1/2 prompt. The focused tests ran in the shared working tree containing those pre-existing lines; they validate mapping and serialization, not an AI model's obedience or subjective reading quality.
- No full build or live provider/production D1 call was run. Tasks 4–6 and the Room payload transition remain outside this implementation.
- The report accompanies the implementation commit; its commit identity can be obtained from `git log -- .superpowers/sdd/2026-09-18-ai-tarot-reading-engine/task-3-report.md`. Push/ref verification is reported in the task's final response.

## Takeover verification — 2026-09-18

- Audited the pre-existing staged Task 3 diff and confirmed the allowlist contains only the trusted context/repository/V5 serialization slice, its four runtime JSON imports, focused tests/configuration, project-state note, and this report. Concurrent route, Room, API-contract, service, homepage, and handbook changes remain unstaged or untracked.
- Re-ran the reported focused suite: 57 passed, 0 failed. Scoped `npx tsc --noEmit -p tests/tsconfig.tarot-context.json`, scoped ESLint, `git diff --check`, `git diff --cached --check`, staged JSON count/integrity checks, and staged secret-pattern scan all passed.
- A fresh full-project `npx tsc --noEmit` remains outside this slice and currently stops at `app/room/room.tsx(233,1930): error TS17002: Expected corresponding JSX closing tag for 'button'` from concurrent Room work.
