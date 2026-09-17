# Task 1 implementation report

status: DONE_WITH_CONCERNS

## Files changed

- `lib/ai/types.ts`
- `lib/ai/prompts/tarot-reading.ts`
- `lib/tarot-interpretation.ts`
- `tests/fixtures/tarot-reading-quality.ts`
- `tests/tarot-ai.test.ts`
- `tests/tarot-interpretation.test.ts`
- This report

Unrelated pre-existing untracked files were preserved unchanged.

## Implementation

- Added the provider-neutral bilingual input, provider output, trusted card metadata, and normalized payload types.
- Added `tarot-reading-v2`, the exact system instruction lines, strict JSON schema, and complete drawn-card prompt context serialization.
- Replaced the legacy interpretation payload parser with strict Zod provider and normalized schemas.
- Added exact-card coverage validation for missing, duplicate, unknown, extra, and mismatched-position cards.
- Normalization now reorders to trusted session-card order, copies trusted position/card/orientation metadata, and supplies the localized disclaimer without accepting provider metadata.
- Added the approved three-card Vietnamese quality fixture without hardcoded expected Tarot prose.
- Removed the local template fallback and old generic provider implementation from `lib/tarot-interpretation.ts`.

## Commits created

- `fc77314336bc4534a1f62b59f2df2b27290f699f` — `feat: define structured tarot AI reading contract`
- The report-only commit is created after this report is written.

## Tests and verification

Command:

```text
npx tsx --test tests/tarot-ai.test.ts tests/tarot-interpretation.test.ts
```

Output:

```text
1..7
# tests 7
# pass 7
# fail 0
```

Command:

```text
git diff --check
```

Output: no output; exit code 0.

Command:

```text
npx tsc --noEmit
```

Output: non-zero. Existing route, Room, and repository consumers still reference the pre-Task-1 `buildLocalReading` API and `opening`/`card_readings`/`synthesis`/`advice` fields. The reported errors are in `app/api/tarot/interpret/route.ts`, `app/room/room.tsx`, and `lib/tarot-repository.ts`; those migrations belong to later route/context/UI tasks and were intentionally not implemented here.

The task-file secret scan produced no matches for API keys, tokens, or secrets.

## Self-review and concerns

- The strict boundary preserves exact drawn-card IDs and position keys while keeping all trusted metadata server-side in the normalized payload.
- Provider-authored prose is limited to the five required prose fields and four card prose/identifier fields; arbitrary fields are rejected.
- English/Vietnamese disclaimer behavior is covered; no credentials or provider responses are present in tests or logs.
- Concern: the existing production interpretation route still needs the later trusted-context/provider/route migration before the application typecheck and final-reading flow are green. Because the brief explicitly limits this slice to Task 1 and says not to implement Tasks 2–6, that migration remains unfinished rather than being approximated here.
