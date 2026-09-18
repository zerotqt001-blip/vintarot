# Task 6 report — documentation and verification

Status: COMPLETE for the Task 6 documentation slice, with three out-of-scope focused-test failures and the repository-wide lint baseline recorded below. Work was performed directly on `codex/tooling-and-version-history`; no deployment was performed.

## Documentation contract

- `README.md` contains the approved seven-line placeholder-only environment block. `TAROT_AI_PROVIDER` uses `openai` as the example; every key and model uses the exact approved replacement placeholder.
- The README states that only the selected provider's key/model pair is required, all provider keys are server-side secrets, `POST /api/tarot/reading` is canonical, and `POST /api/tarot/interpret` is a compatibility alias.
- The README includes the credential-free documentation test, required nine-file focused suite, typecheck, build and lint commands.
- `tests/tarot-documentation.test.ts` guards the exact environment block, provider-key placeholders, common live-token prefixes, browser-public key naming/instructions, server-side secret boundary, canonical/compatibility routes, and local verification commands.
- The documentation test followed TDD: its first run failed 0/3 against the prior README for the expected placeholder, explanation and command gaps; after the README edit it passed 3/3.

## PROJECT_STATE decisions and accuracy

- Records explicit OpenAI/Gemini/DeepSeek selection and every server variable, with no provider switching.
- Records the existing-column compatibility mapping and the decision that no new reading migration is required.
- Records that `lib/tarot-narrative.ts` remains for Guidebook/seed consumers only, not the production final-reading route.
- Distinguishes the earlier version 11 publication from this documentation task: Task 6 did not deploy. Live AI generation still requires one selected provider's server-side key/model pair.
- Does not claim a complete test-glob run. The user-owned untracked homepage assertions remain outside this task.

## Verification evidence

- `npx tsx --test tests/tarot-documentation.test.ts` — exit 0, 3 passed, 0 failed.
- `npx tsx --test tests/tarot-ai.test.ts tests/tarot-interpretation.test.ts tests/tarot-reading-context.test.ts tests/tarot-reading-service.test.ts tests/tarot-api-contract.test.ts tests/tarot-draw.test.ts tests/tarot-catalog.test.ts tests/tarot-seed.test.ts tests/tarot-room.test.ts` — first complete Task 6 run exited 0 at 68/68. After concurrent out-of-scope edits added seven tests, the final rerun exited 1 at 72/75. The three failures are all in `tests/tarot-room.test.ts`: the card-name helper is undefined, canonical reading sections are out of order, and `room.interpretationUnavailable` is untranslated in both locales.
- `npx tsc --noEmit` — exit 0, no output.
- `npm run build` — exit 0; Vinext completed all five build phases and listed both Tarot routes.
- `npx eslint tests/tarot-documentation.test.ts` — exit 0, no output.
- `npm run lint` — exit 1 with 11,460 problems: 1,851 errors and 9,609 warnings. Evidence is in existing `.codex/skills`, `.sites-runtime`, legacy `@next/next/no-html-link-for-pages` findings in `app/vintarot.tsx`, and existing `no-explicit-any` findings in `app/webmcp.tsx` and `lib/client.ts`. None of those files is in the Task 6 write set.
- `git diff --check` — exit 0 before final staging; final staged and unstaged checks are part of the pre-commit gate.

## Scope and remaining findings

Task 6 changes only `README.md`, the Task 6 paragraphs in `docs/PROJECT_STATE.md`, `tests/tarot-documentation.test.ts`, and this report. Concurrent route/service/API-test work landed separately as commit `3b224bd`; additional unstaged Room/test work remains user-owned. None of it was edited or staged by this task. The concurrent custom-domain addition in `docs/PROJECT_STATE.md` and the existing untracked homepage files were also preserved but excluded from the Task 6 commit.

Remaining work includes resolving the three concurrent Room/i18n test failures, configuring one selected provider and its key/model pair in the server environment, and addressing the repository-wide lint baseline separately. None is a Task 6 documentation implementation gap. The report accompanies the Task 6 commit; obtain its identity with `git log -- .superpowers/sdd/2026-09-18-ai-tarot-reading-engine/task-6-report.md`.
