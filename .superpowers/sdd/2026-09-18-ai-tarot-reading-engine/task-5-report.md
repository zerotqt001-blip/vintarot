# Task 5 audit and implementation report

## Scope and baseline

- Audited the user-owned integration commit `73280ff2d8a62f272ede1356f89ec83290abfe03` instead of recreating or reverting it.
- Reviewed `docs/PROJECT_STATE.md`, the approved design, the implementation plan, and `task-5-brief.md` before changing code.
- Limited implementation changes to `app/room/room.tsx`, `lib/i18n.ts`, and `tests/tarot-room.test.ts`. No CSS change was required.
- Preserved unrelated untracked homepage files and did not modify the SDD progress ledger.

## Requirement audit

| Requirement | Evidence and result |
| --- | --- |
| Canonical request | `interpretReading` posts only `session_id` and `locale` through `api("tarot/reading", ...)`. The compatibility route is not used by Room. |
| Canonical payload | Both result surfaces read `overview`, `cards`, `connections`, `guidance`, `closing`, and `disclaimer`. Production Room/i18n files contain no `card_readings`, `reading.opening`, `reading.synthesis`, or `reading.advice` reads. |
| Trusted metadata | Position labels come from `reading.position.name`; card names come from trusted `reading.card.nameEn/nameVi` according to the response locale; orientation comes from `reading.orientation` and is now always shown for both upright and reversed cards. Local artwork lookup remains display-only. |
| Section order | The overview presents overview, ordered cards/positions, connections, guidance, closing, then disclaimer. Dedicated tabs remain available without changing the established panel design. |
| Stale response/session guards | The existing reading epoch, request ID, session ID stamp, `isRoomRequestCurrent` check, and invalidation paths remain intact. Responses and errors commit only while current. |
| Loading/draw/reset/journal | Loading state and disabled controls are unchanged. Full 78-card customer selection, server session creation, reset/redraw invalidation, and journal payload/save behavior are untouched. |
| Accessibility | Existing `aria-live`, `role="status"`, `role="alert"`, tab roles/selection state, close label, image alt text, and keyboard draw controls remain. The error action now has a concise action label rather than repeating the full error sentence. |
| Mobile/Moonlight behavior | Existing panel classes, responsive layout, glass hierarchy, focus states, and mobile sheet behavior are unchanged. The fix reuses current wrapping containers, so no `app/globals.css` change was justified. |
| English/Vietnamese copy | Both locales now provide separate provider-neutral loading, unavailable, retry-action, overview, connection, guidance, closing, upright, and reversed labels. The obsolete local-reading source label was removed. |
| No fallback claim | `RoomInterpretation.source` remains `"ai"`; no old local fallback copy or branch remains in Room/i18n. Provider failures keep the selected spread visible and show localized unavailable/retry UI. |

## Concrete gaps fixed with TDD

1. Card identity was hard-coded to `nameVi` in both result surfaces, so English readings displayed Vietnamese card names.
2. Upright cards had no visible orientation label; only reversed cards were labeled.
3. The overview placed card details after connections and guidance instead of the approved canonical order.
4. Error message and retry action reused one sentence, and no dedicated bilingual unavailable label existed.
5. Old local-fallback source copy remained in i18n despite the AI-only production contract.

RED evidence: `npx tsx --test tests/tarot-room.test.ts` failed 3 new tests for the missing metadata formatter, wrong section order, and absent unavailable/retry labels. GREEN evidence: the same command passed 11/11 after the minimal implementation.

## Verification

- `npx tsx --test tests/tarot-room.test.ts tests/tarot-api-contract.test.ts tests/tarot-reading-service.test.ts` — 25/25 passed during implementation verification.
- Final gate: `npx tsx --test tests/tarot-room.test.ts tests/room-mobile.test.ts tests/tarot-api-contract.test.ts tests/tarot-reading-service.test.ts` — 27/27 passed.
- Repository-wide `npx tsx --test tests/*.test.ts` — 148/150 passed. The only failures are the two pre-existing user-owned untracked homepage assertions in `tests/celestial-surfaces.test.ts` and `tests/homepage-celestial.test.ts`, both still expecting the retired `cosmic-stars-far` contract; Task 5 tests pass within the same run.
- `npx tsc --noEmit` — passed during implementation verification.
- Production legacy-symbol scan over `app/room/room.tsx` and `lib/i18n.ts` — no matches.
- `git diff --check` — passed during implementation verification.
- Scoped ESLint remains red on the pre-existing Room baseline (30 errors, 9 warnings, chiefly existing explicit-`any` and legacy anchor findings). No lint suppression or unrelated cleanup was added.

## Deferred low-risk item

A fresh physical-device visual pass was not required for this text/data-mapping correction because it adds no CSS, dimensions, controls, or interaction paths. The focused mobile source regression remains part of the final verification; physical-device confirmation can be folded into the next scheduled cross-device Room QA pass.
