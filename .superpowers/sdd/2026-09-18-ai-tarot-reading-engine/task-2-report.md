# Task 2 implementation report

status: DONE_WITH_KNOWN_TYPECHECK_BASELINE

## Changed files

- `lib/ai/provider.ts`
- `lib/ai/http.ts`
- `lib/ai/openai.ts`
- `lib/ai/gemini.ts`
- `lib/ai/deepseek.ts`
- `lib/ai/factory.ts`
- `cloudflare-env.d.ts`
- `tests/tarot-ai.test.ts`
- This report

Unrelated pre-existing untracked files were preserved unchanged. No route, Room, draw, persistence, or UI files were modified.

## Implementation status

- Added the shared `TarotAIProvider` contract and safe classified `TarotAIError`.
- Added an injected-fetch HTTP boundary with an integer timeout constrained to 1,000-20,000ms, `AbortController`, one retry for network/timeout and 408/429/500/502/503/504 responses, no retry for ordinary 4xx responses, and response draining without upstream body disclosure.
- Added OpenAI Responses API, Gemini `v1beta/models/{model}:generateContent`, and DeepSeek chat-completions adapters.
- Gemini sends its key only in the `x-goog-api-key` header and never in the URL or body.
- OpenAI sends `store:false` and the strict JSON-schema response format. Gemini sends `responseMimeType` and `responseSchema`. DeepSeek sends `response_format:{type:"json_object"}`.
- Every adapter extracts provider JSON and passes it through Task 1's `parseReadingPayload(value, input.cards, input.locale)` boundary. No local fallback or duplicate reading validation was added.
- Added the explicit provider factory and selected-provider-only key/model lookup.
- Added optional server environment declarations without exposing values through client code or public payloads.
- Added deterministic fake-fetch coverage for request shape, extraction, configuration, timeout bounds, timeout, network errors, transient retries, ordinary 4xx behavior, malformed JSON, and error redaction.

## Commits

- `192ee0f` — `feat: add selectable tarot AI providers`
- This report is committed separately after it is written so the implementation commit can be recorded here without a self-referential hash.

## TDD evidence

The provider tests were added before production implementation. The first RED command was:

```text
npx tsx --test tests/tarot-ai.test.ts
```

The expected failure was:

```text
Error [ERR_MODULE_NOT_FOUND]: Cannot find module '/Users/tranquangthanh/Documents/ChatGPT/test astra/lib/ai/factory'
1..1
# tests 1
# pass 0
# fail 1
```

After implementation, the focused Task 2 command was:

```text
npx tsx --test tests/tarot-ai.test.ts
```

Output:

```text
1..24
# tests 24
# suites 0
# pass 24
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 2280.762916
```

## Final tests and verification

Command:

```text
npx tsx --test tests/tarot-ai.test.ts tests/tarot-interpretation.test.ts
```

Output:

```text
1..27
# tests 27
# suites 0
# pass 27
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 2239.865792
```

Command:

```text
npx eslint lib/ai/provider.ts lib/ai/http.ts lib/ai/openai.ts lib/ai/gemini.ts lib/ai/deepseek.ts lib/ai/factory.ts tests/tarot-ai.test.ts
```

Output: no output; exit code 0.

Command:

```text
git diff --check
```

Output: no output; exit code 0.

Command:

```text
git diff --cached --check
```

Output: no output; exit code 0.

The staged credential-pattern scan reported:

```text
staged secret-pattern scan: no credential-shaped values found
```

## Typecheck notes

Command:

```text
npx tsc --noEmit
```

Output: non-zero with only the unchanged Task 1 integration migration failures. No error referenced a Task 2 file. The failures remain in:

```text
app/api/tarot/interpret/route.ts: removed buildLocalReading/createInterpretationProvider and legacy type imports; parseReadingPayload call arity
app/room/room.tsx: legacy opening/card_readings/synthesis/advice payload fields and resulting implicit-any callbacks
lib/tarot-repository.ts: legacy opening/card_readings/synthesis/advice payload fields
```

These are the same route/Room/repository errors recorded in the Task 1 report. Per the brief, Tasks 3-5 own that migration, so this task did not change those files or restore a local fallback.

## Self-review concerns

- The Task 1 implementation exports the strict schema as `TAROT_RESPONSE_SCHEMA` (and `TAROT_READING_JSON_SCHEMA`), while the Task 2 briefing prose names `tarotProviderJsonSchema`. The adapters use the existing Task 1 export and do not alter Task 1 solely to add another alias.
- Provider envelope parsing intentionally accepts only the documented extraction path and turns missing, malformed, or schema-invalid content into a safe `invalid_response` error. It does not expose response bodies or original network-error messages as causes.
- API keys exist only in adapter closures and outbound authorization headers. Provider objects expose only `id`, `model`, and `generateReading`.
- Retry behavior is intentionally immediate and exactly once; no backoff, provider switching, SDK dependency, logging, or orchestration-layer retry was added in this slice.
- The timeout regression takes approximately two seconds because the required minimum is 1,000ms and timeout failures are retried exactly once.

## Round 1/5 critical fix report

status: DONE

### Critical finding addressed

The shared HTTP helper previously returned a successful `Response` from inside its per-attempt `try/finally`. That return cleared the timeout before the adapter called `response.json()`, so successful-body consumption was outside both the timeout and retry boundary. A stalled body could exceed the configured bound, and a body-stream network failure was converted by the adapter to `invalid_response` without retrying.

`createTarotHTTPClient` now consumes and parses successful JSON before the per-attempt timer is cleared and returns parsed `unknown` JSON to adapters. The same controller therefore covers fetch plus body consumption. Abort during body parsing is classified as a retryable timeout, body-stream/network failure is retried exactly once and becomes a safe retryable upstream error if exhausted, malformed envelope JSON remains a safe `invalid_response`, and ordinary 4xx behavior remains non-retryable. Adapters now extract provider content from the parsed envelope returned by the helper.

### Files changed

- `lib/ai/http.ts`
- `lib/ai/openai.ts`
- `lib/ai/gemini.ts`
- `lib/ai/deepseek.ts`
- `tests/tarot-ai.test.ts`
- This report

No Task 3-6 route, draw, Room, persistence, or UI files were changed. Concurrent unrelated workspace changes were preserved and excluded from this fix.

### TDD RED evidence

Command:

```text
npx tsx --test --test-name-pattern='response JSON parsing|response body network failure' tests/tarot-ai.test.ts
```

Output before the fix:

```text
not ok 1 - keeps the timeout active through response JSON parsing and retries a stalled body
error: Expected values to be strictly equal: 1 !== 2
not ok 2 - retries a response body network failure exactly once
error: OpenAI returned an invalid response.
code: invalid_response
1..2
# tests 2
# pass 0
# fail 2
```

### Focused GREEN evidence

Command:

```text
npx tsx --test --test-name-pattern='response JSON parsing|response body network failure' tests/tarot-ai.test.ts
```

Output:

```text
1..2
# tests 2
# suites 0
# pass 2
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 2286.771917
```

### Final covering tests and verification

Command:

```text
npx tsx --test tests/tarot-ai.test.ts tests/tarot-interpretation.test.ts
```

Output:

```text
1..29
# tests 29
# suites 0
# pass 29
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 4266.835417
```

Command:

```text
npx eslint lib/ai/provider.ts lib/ai/http.ts lib/ai/openai.ts lib/ai/gemini.ts lib/ai/deepseek.ts lib/ai/factory.ts tests/tarot-ai.test.ts
```

Output: no output; exit code 0.

Command:

```text
git diff --check
```

Output: no output; exit code 0.

### Self-review

- The timeout timer is cleared only after successful JSON parsing returns or a failed attempt is classified.
- Both regression tests use injected fetch responses and deterministic abort/body-reader behavior; no live provider or credential is involved.
- Error construction still discards body-stream exception messages and raw bodies, so API keys and provider content do not enter exposed errors.
- Existing tests continue to prove exactly one retry for fetch/network/408/429/500/502/503/504 and no retry for ordinary 400/401/403/404 responses.
- The deferred minor was not included because it is unnecessary to resolve this critical boundary defect.

### Fix commit

Pending at report-write time; the fix and this appended report are committed together immediately after final verification.
