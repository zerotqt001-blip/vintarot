# Task 4 audit and implementation report

**Date:** 2026-09-18
**Audited implementation:** `73280ff2d8a62f272ede1356f89ec83290abfe03` (`feat: connect knowledge v5 tarot readings`)

## Outcome

The user-owned canonical Tarot reading implementation was audited in place. It already supplied the owner-scoped service, canonical `/api/tarot/reading` route, thin `/api/tarot/interpret` alias, safe provider error responses, provider/model/prompt metadata, compatibility persistence, and no local fallback.

Two concrete Task 4 gaps were found and fixed:

1. A session with a complete card count but a stored status other than `drawn` could reach the provider. The service now classifies that state as incomplete before provider work.
2. The canonical route had no Task 4 observability events, and unexpected errors fell through to the shared logger that prints an arbitrary exception message. The route now records allowlisted metadata for success and failure (`status`, HTTP status, failure category, session id when available, provider/model when available, prompt version, successful card count, and latency). It does not log question/context, prompt content, keys, raw request/provider bodies, card meanings, or exception messages. Unexpected errors now receive the same safe generic 503 body without forwarding the exception to the shared message logger.

## Requirement audit

| Requirement | Evidence / result |
| --- | --- |
| Owner/session access | `getSessionForOwner(sessionId, owner)` remains the first repository lookup. Tests cover the exact owner argument, unknown session, and another owner receiving `not_found`. |
| Stored template and exact cards/meanings | The service uses the session's stored `spreadTemplateId`, exact stored card IDs in order, and requested-locale upright/reversed meaning pairs. Focused tests assert every repository call and the exact provider card set. |
| Incomplete state | Empty/short card sets, unavailable historical template, missing meaning pair, invalid trusted context, and non-`drawn` session status all fail before provider invocation. |
| Invalid locale | The canonical route accepts only `z.enum(["en", "vi"])`; the API contract test guards this boundary. |
| Provider configuration/upstream/invalid JSON | Configuration, upstream, and `invalid_response` errors remain typed `TarotAIError`s and map to safe 503 responses. Provider tests cover missing/unsupported configuration, upstream failures, malformed JSON, and raw-body secrecy. |
| Persistence failure | Save failures become `TarotReadingServiceError("persistence")`, map to a safe 503, and do not cause a second provider call. |
| No local fallback | The selected provider is called once; its failure is propagated. Neither canonical route nor alias imports or calls `buildLocalReading`. |
| One canonical alias | `app/api/tarot/interpret/route.ts` remains exactly a re-export of canonical `POST`. |
| Secret-free response | The service result is limited to session/locale/source/provider/model/prompt/reading fields and excludes stored question/context. Provider tests separately guard keys and raw upstream bodies. |
| Provider/model metadata | Successful responses expose `provider`, `model_name`, and `prompt_version`; persistence stores the provider-qualified model name and prompt version. |
| Route observability | Added metadata-only success/failure events. Source contract rejects logging calls containing question, optional context, prompt, key, raw body, or `error.message`. |

## TDD evidence

- Baseline focused suite: 10/10 passed.
- Added regressions first: the suite failed in the expected two places (non-`drawn` session reached the provider; observability contract absent).
- After the minimal implementation: focused Task 4 suite passed 14/14.

## Verification

- `npx tsx --test tests/tarot-ai.test.ts tests/tarot-interpretation.test.ts tests/tarot-reading-context.test.ts tests/tarot-reading-service.test.ts tests/tarot-api-contract.test.ts` — 53/53 passed.
- `npx tsc --noEmit` — passed.
- `npx eslint lib/tarot-reading-service.ts app/api/tarot/reading/route.ts app/api/tarot/interpret/route.ts tests/tarot-reading-service.test.ts tests/tarot-api-contract.test.ts` — passed.
- `npm run build` — passed; both `/api/tarot/reading` and `/api/tarot/interpret` were emitted as API routes.
- `git diff --check` — passed.
- Scoped diff secret scan found no provider key/token value.

## Files changed by this audit

- `lib/tarot-reading-service.ts`
- `app/api/tarot/reading/route.ts`
- `tests/tarot-reading-service.test.ts`
- `tests/tarot-api-contract.test.ts`
- `.superpowers/sdd/2026-09-18-ai-tarot-reading-engine/task-4-report.md`

`app/api/tarot/interpret/route.ts` was audited but required no change.

## Deferred low-risk item

The Node test runner cannot directly import the route because of the runtime-only `cloudflare:workers` module scheme. Route validation, aliasing, response metadata, and logging policy therefore remain guarded by the existing source-level API contract test, while the underlying orchestration/error behavior is executed in service/provider tests and the compiled route is validated by the production build. A future Worker-runtime integration harness could exercise the HTTP status/body branches end to end; no runtime defect is currently known in those branches.

Concurrent user-owned edits outside the Task 4 write set were left untouched and unstaged.
