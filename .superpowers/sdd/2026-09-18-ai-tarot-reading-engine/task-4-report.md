# Task 4 audit and implementation report

**Date:** 2026-09-18
**Audited implementation:** `73280ff2d8a62f272ede1356f89ec83290abfe03` (`feat: connect knowledge v5 tarot readings`)
**P2 runtime-test closure:** 2026-09-18 follow-up

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

## Historical deferred item

The original audit deferred direct Node coverage of the route's HTTP branches because the Worker module imports `cloudflare:workers`. The P2 follow-up below closes that finding through a runtime-testable extraction without faking the Cloudflare module.

Concurrent user-owned edits outside the Task 4 write set were left untouched and unstaged.

## P2 runtime-test closure

The deferred route-runtime finding is now closed without mocking `cloudflare:workers`. HTTP validation, response/error mapping, canonical response assembly, `Set-Cookie` passthrough, and allowlisted log-event assembly were extracted to `lib/tarot-reading-route.ts`. The Worker route still owns origin checking, request-body loading, Cloudflare environment access, guest/user owner resolution, D1 repository creation, provider creation, service invocation, and the canonical alias remains unchanged.

The focused runtime suite imports the helper directly under Node and exercises real `Response` objects for:

- invalid request `400` responses;
- provider `configuration`, `upstream`, and `invalid_response` `503` responses;
- service `not_found` `404`, `incomplete` `409`, and `persistence` `503` responses;
- canonical success metadata and `Set-Cookie` passthrough; and
- request-rejection and success/failure log events containing metadata only, with question/context/prompt/key/raw-body/exception sentinels excluded.

### Follow-up TDD evidence

- RED: `npx tsx --test tests/tarot-reading-route.test.ts` exited 1 with 0/5 top-level tests passing (0/5 overall); every failure was the expected assertion that `lib/tarot-reading-route.ts` did not exist.
- GREEN: `npx tsx --test tests/tarot-reading-route.test.ts` exited 0 with 11/11 assertions passing after the minimal extraction.
- Focused integration: `npx tsx --test tests/tarot-reading-route.test.ts tests/tarot-reading-service.test.ts tests/tarot-api-contract.test.ts` exited 0 with 25/25 assertions passing.
- TypeScript: `npx tsc --noEmit` exited 0.
- `git diff --check` over the five scoped files exited 0.
- The scoped credential-pattern scan passed with no matches.

### Follow-up files

- `app/api/tarot/reading/route.ts`
- `lib/tarot-reading-route.ts`
- `tests/tarot-reading-route.test.ts`
- `tests/tarot-api-contract.test.ts`
- `.superpowers/sdd/2026-09-18-ai-tarot-reading-engine/task-4-report.md`

### Residual limitation

The Node suite does not instantiate the full Cloudflare Worker module or a real D1/provider deployment. Those runtime-owned integrations remain covered by their existing service/provider tests and deployment/build boundaries; the previously unexecuted HTTP status/body/header/log branches themselves are now runtime-tested without a Cloudflare module fake.
