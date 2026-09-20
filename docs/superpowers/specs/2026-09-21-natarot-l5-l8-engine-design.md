# NaTarot L5–L8 Engine Design

## Goal

Extend the verified L4 Tarot chain with whole-spread semantics, bounded provider delivery reliability, contextual follow-up prompts, and server-authoritative clarification draws while preserving the existing reading payload, ownership boundary, Moonlight visual language, and D1 schema.

## Source-of-truth audit

The implementation base is `f92b073e69e57462f5ea898d2fe8a521ac2c4fac` (`codex/natarot-auto-topic-spread-l4`). The existing chain is:

`current spread catalog / D1 catalog → L1 semantic positions → L4 recommendation → Room draw → owner-scoped reading session/cards → V5 Tarot input → validated provider payload → saved reading / follow-up`.

The repository already contains bounded HTTP retry and one invalid-response retry for initial readings. Follow-up already reloads the owner-scoped session, exact stored cards, template, and latest saved reading. The `readings.reading_payload` column is nullable JSON and is already the normalized reading source; no supplementary-draw table exists.

## Architecture

### L5 — derived whole-spread semantics

`lib/tarot-spread-semantics.ts` owns a deterministic semantic derivation and localization layer. It derives purpose, question suitability, interpretation strategy, temporal focus, emphasis, synthesis guidance, and position relationships from the existing catalog template/category/position contract. It uses stable semantic strategy rules for known spread types and position-key patterns, then a safe ordered fallback for every other supported spread. Relationships reference position keys only and never contain geometry.

The D1 catalog remains authoritative for active and historical spread identity and localized copy. `mapCatalogRows`, `getReadingTemplate`, the local catalog fallback, and the reading-input builder enrich the existing catalog/template contract with derived semantics. The AI input gains one bounded `spread.semantics` object; the normalized reading output keys and cardinalities do not change. Prompt construction includes at most a small bounded relationship/emphasis subset.

### L6 — validated final result with reliability progress

The current provider abstraction and DeepSeek adapter remain the only provider pipeline. Reliability is strengthened at the existing HTTP/service boundaries: classify empty/malformed envelopes safely, keep transport retries bounded, retry only retryable invalid structured results at most once at the service layer, and never persist until the final payload passes the existing parser/schema and card-coverage checks. Follow-up and clarification provider calls reuse the same bounded response validation policy.

The runtime does not safely expose partial JSON as authoritative data, and the current client `api()` helper expects a single JSON response. Therefore L6 uses the existing loading/progress presentation and a single validated final JSON response rather than token-streaming partial JSON. This is recorded as the delivery decision and tested as the persistence boundary.

### L7 — deterministic contextual suggestions

`lib/tarot-follow-up-suggestions.ts` creates up to three bilingual, question-shaped suggestions from the current normalized reading’s insights, next steps, card-position evidence, and original question. It filters redraw/generic suggestions and fills missing entries deterministically, without a second provider call. The service normalizes provider suggestions before persistence, so new readings and future follow-ups share the same payload contract. Historical payloads remain parseable; their existing suggestions remain valid if no new reading is generated.

The existing `/api/tarot/follow-up` route and owner checks remain unchanged. The existing `FollowUpReading` component receives the normalized suggestions and keeps the manual question path.

### L8 — clarification draw attached to the existing reading

`POST /api/tarot/clarification` accepts an owner-scoped `session_id`, locale, a bounded follow-up question, and a caller-generated `request_id`. The server loads the session/cards/template/latest reading through the existing owner boundary, chooses an unused card from the stored deck server-side, applies the existing upright/reversed convention, builds a clarification provider context from trusted D1 card/meaning data, calls the existing provider abstraction with a dedicated clarification prompt, validates the concise answer, and appends the result to the existing `reading_payload` JSON.

The payload extension is optional and backward-compatible:

```ts
supplementaryDraws?: Array<{
  id: string;
  requestId: string;
  sequence: number;
  question: string;
  relationship: "clarification";
  card: { id: string; nameEn: string; nameVi: string; arcana: string; suit: string | null };
  orientation: "upright" | "reversed";
  answer: string;
}>;
```

Existing rows with no field remain valid. The repository updates only the owning reading row identified by the trusted session and reading id. A repeated request with the same `request_id` returns the existing persisted clarification instead of drawing or charging another provider call. Server validation rejects foreign sessions, incomplete sessions, invalid locales/questions, exhausted clarification limits, and duplicate cards; it never trusts a client card id.

The existing follow-up provider abstraction gains an optional clarification method implemented by DeepSeek. The clarification prompt includes the original question, spread semantics, original normalized reading, follow-up question, and only the server-selected supplementary card. It returns the same validated `{ answer }` shape and does not regenerate the original reading.

The result UI adds a small “Draw clarification card” control beside the existing follow-up input. It displays the returned card, orientation, and focused answer inside the existing reading surface; it does not redesign the result screen or add payment/share logic.

## Compatibility and protected zones

- No Drizzle schema or SQL migration is added.
- `TarotReadingPayload` remains backward compatible; the supplementary array is optional and the existing schema/output fields remain unchanged.
- Existing stored readings, legacy compatibility columns, saved-reading loading, and old Room JSON remain readable.
- Member/guest ownership, origin checks, cookies, OAuth, F-001 protections, provider secrets, Knowledge Base V5, deployment files, and unrelated Home work remain untouched.
- Card identity, orientation, and draw eligibility are server-authoritative for L8.
- No credits, VIP, payments, affiliates, share tokens, QR, public-reading route, or final visual redesign is included.

## Verification gates

Each level has focused red/green tests, affected regressions, typecheck, production build, targeted lint, diff check, and protected-zone review before its checkpoint commit. Final verification includes the full tracked suite, the L1/L4 catalog and geometry suites, AI/reading/follow-up/saved-reading suites, ownership tests, desktop and 390/375 responsive checks where the local browser runtime is available, and local/remote commit identity after a normal push.
