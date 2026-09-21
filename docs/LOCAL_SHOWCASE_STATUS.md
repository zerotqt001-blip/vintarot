# NaTarot Local Showcase Status

Date: 2026-09-21
Scope: local-only product reality check; no production deploy, VPS mutation, domain change, database migration, or main-branch merge.

## Authority and runtime

- Authoritative branch: `codex/natarot-integration-v1`
- Authoritative commit: `f5452a35d7b4bbc9884e52d0890c4f5e9c39e9fe`
- Showcase branch: `codex/natarot-local-showcase`
- Showcase URL: [http://127.0.0.1:5187/](http://127.0.0.1:5187/)
- Runtime: production-like Wrangler local worker with local D1 state under the ignored `.wrangler/state` directory.
- Fixture data is synthetic and local-only. No customer records, production database, real email, or real payment flow was used.
- The Moonlight/Celestial reference treatment and existing NaTarot branding were preserved. This pass is an audit and integration check, not a redesign.

The status vocabulary below is deliberately strict:

- `IMPLEMENTED`: present in the authoritative source.
- `VERIFIED LOCAL`: exercised successfully in this local showcase, usually through both browser and HTTP/API evidence.
- `SOURCE ONLY`: present in source or project records, but not exercised end to end here.
- `RESEARCH ONLY`: described as research or direction; no product implementation was found.
- `ARCHITECTURE ONLY`: structural foundation exists, but the product behavior is not complete.
- `PLANNED`: identified direction without a working implementation in this showcase.
- `BLOCKED`: the check could not proceed because a required local dependency/configuration was absent.
- `NOT IMPLEMENTED`: no working product implementation was found.
- `NOT DEPLOYED`: intentionally not promoted or verified in production during this task.

## Feature reality map

| Capability | Source status | Local showcase status | Owner can see/use | Production status | Evidence or boundary |
|---|---|---|---|---|---|
| 78-card Tarot data | IMPLEMENTED | VERIFIED LOCAL | Yes | NOT DEPLOYED | D1 catalog contains 78 cards. |
| Upright/reversed meanings | IMPLEMENTED | VERIFIED LOCAL | Yes | NOT DEPLOYED | D1 contains 312 card-meaning rows; catalog route returned successfully. |
| Spread catalog and spread engine | IMPLEMENTED | VERIFIED LOCAL | Yes | NOT DEPLOYED | Local catalog contains 9 categories, 57 templates, and 174 positions. |
| Responsive SpreadBoard | IMPLEMENTED | VERIFIED LOCAL | Yes | NOT DEPLOYED | Three-card room and ten-card Celtic Cross were exercised; desktop and reliable 390px mobile checks had no horizontal overflow. |
| Multi-card draw flow | IMPLEMENTED | VERIFIED LOCAL | Yes | NOT DEPLOYED | Three-card and Celtic Cross ten-card draws completed in the browser. |
| Auto Topic recommendation | IMPLEMENTED | VERIFIED LOCAL | Yes | NOT DEPLOYED | Work question recommended Career Crossroads with a fit explanation. |
| Manual spread override | IMPLEMENTED | VERIFIED LOCAL | Yes | NOT DEPLOYED | Relationships → Relationship Check-In was selected and remained active. |
| DeepSeek reading generation | IMPLEMENTED | VERIFIED LOCAL | Yes | NOT DEPLOYED | Live local reading succeeded with provider `deepseek`; no key values were logged or committed. |
| Knowledge Base V5 context | IMPLEMENTED | VERIFIED LOCAL | Yes | NOT DEPLOYED | Live reading used the integrated reading path and returned structured editorial sections. |
| Seven-layer philosophy | IMPLEMENTED | VERIFIED LOCAL | Yes | NOT DEPLOYED | Source path is integrated; live output exposed whole-spread synthesis, reflection, and next-step guidance. |
| L5 whole-spread semantics | IMPLEMENTED | VERIFIED LOCAL | Yes | NOT DEPLOYED | Reading result showed spread-level synthesis and card evidence, not only isolated card definitions. |
| L6 reliability and final JSON contract | IMPLEMENTED | VERIFIED LOCAL | Yes | NOT DEPLOYED | Success, provider failure, follow-up, and clarification paths were observed with truthful UI states. |
| L6 true token streaming | NOT IMPLEMENTED | NOT IMPLEMENTED | No | NOT DEPLOYED | The current path returns final structured JSON; it is not a token-by-token stream. |
| L7 follow-up questions | IMPLEMENTED | VERIFIED LOCAL | Yes | NOT DEPLOYED | Suggestion prefill and a submitted follow-up both worked with a live DeepSeek response. |
| L8 clarification-card draw | IMPLEMENTED | VERIFIED LOCAL | Yes | NOT DEPLOYED | Clarification draw returned King of Wands with orientation and interpretation. |
| Member login and session | IMPLEMENTED | VERIFIED LOCAL | Yes | NOT DEPLOYED | Local synthetic `showcase` member logged in and persisted across the owner walkthrough. |
| Profile settings | IMPLEMENTED | VERIFIED LOCAL | Yes | NOT DEPLOYED | `/profile` showed the seeded display name, email, phone, language, and timezone. |
| Google OAuth | IMPLEMENTED | BLOCKED | No | NOT DEPLOYED | Source route exists; local start returned 503 because Google OAuth environment configuration is absent. |
| Password recovery and verification email | IMPLEMENTED | SOURCE ONLY | Route only | NOT DEPLOYED | Forms/routes exist, but no external email provider was connected or invoked. |
| Public share token | IMPLEMENTED | VERIFIED LOCAL | Yes | NOT DEPLOYED | Seeded public share resolved with a 200 page and active owner-scoped share. |
| Public reading page | IMPLEMENTED | VERIFIED LOCAL | Yes | NOT DEPLOYED | Seeded share displayed question, spread, cards, orientations, synthesis, and next step. A live share page also rendered. |
| Share QR/image endpoint | IMPLEMENTED | VERIFIED LOCAL | Yes | NOT DEPLOYED | Seeded share image endpoint returned 200 `image/svg+xml`; no real public domain was used. |
| Share revoke | IMPLEMENTED | VERIFIED LOCAL | Yes | NOT DEPLOYED | Owner-scoped revoke returned 204; the revoked share image then returned 404. Fixture was restored afterward. |
| Share analytics/events | IMPLEMENTED | VERIFIED LOCAL | Yes | NOT DEPLOYED | Local fixture recorded share events; no production analytics were touched. |
| Journal/history | IMPLEMENTED | VERIFIED LOCAL | Yes | NOT DEPLOYED | `/journal` loaded for the seeded member and correctly showed an empty local saved-reading state. |
| Credits, VIP, and usage limits | NOT IMPLEMENTED | NOT IMPLEMENTED | No | NOT DEPLOYED | No complete product flow was found in the authoritative source. |
| SePay/payment/booking | PLANNED | NOT IMPLEMENTED | No | NOT DEPLOYED | No payment transaction was attempted; this showcase is deliberately payment-free. |
| Affiliate attribution, commission, dashboard | RESEARCH ONLY | RESEARCH ONLY | No | NOT DEPLOYED | Research direction exists; no working product entry point was verified. |
| VPS backup and rollback | SOURCE ONLY | SOURCE ONLY | No | NOT DEPLOYED | Existing project records describe verified operational state; this task did not touch or re-verify the VPS. |
| Liquid Glass redesign | RESEARCH ONLY | RESEARCH ONLY | No | NOT DEPLOYED | Not in scope. Existing Moonlight/Celestial NaTarot UI was preserved. |
| Video, payments, email, and public-access integrations | ARCHITECTURE ONLY | VERIFIED LOCAL status page | No | NOT DEPLOYED | `/api/integrations` truthfully reports these integrations are not connected. |

## Local database and fixture

The Node migration runner applied the checked-in migrations `0000` through `0005` to an explicitly scoped ignored SQLite file. The actual production-like worker uses its D1 binding, so the same schema was also applied to Wrangler local D1 state.

Wrangler local D1 rejects explicit `BEGIN`/`COMMIT` statements in the checked-in `0002_tarot_seed.sql`. For this showcase only, an ignored transaction-free copy was created under `.sites-runtime/showcase-migrations/`; the checked-in migration was not edited. The remaining checked-in migrations were applied unchanged.

The ignored local fixture contains one synthetic member, one reading session, one active public share, and one deterministic auth session. It exists solely to make the owner walkthrough repeatable. Runtime databases, raw session tokens, environment files, and build output remain untracked.

## DeepSeek configuration reality

The existing ignored local environment contained the expected DeepSeek provider/model configuration. Wrangler did not expose process environment values to the worker until the local-only `CLOUDFLARE_INCLUDE_PROCESS_ENV=true` bridge was enabled when starting the worker. No application source change was required.

Before that bridge, the app correctly returned a provider-configuration failure. After the bridge, the same room produced a live DeepSeek reading, follow-up, and clarification response. This is a local runtime setup fact, not evidence of a production secret or deployment change.

## QA evidence

| Check | Result |
|---|---|
| Full test suite | 441 passing, 0 failing on the authoritative source before showcase documentation; final verification is rerun before handoff. |
| TypeScript | `npx tsc --noEmit` passed before documentation; final verification is rerun before handoff. |
| Production-like build | `npm run build` passed before documentation; final verification is rerun before handoff. |
| Core routes | Home, auth forms, profile, journal, create, room, public share, catalog, integrations, and health loaded locally. |
| Mobile check | Home, create, login, room, reading panel, and public share were checked at a reliable 390px viewport; no horizontal overflow was observed. |
| Desktop check | Home, room, reading result, public share, and Celtic Cross were checked at the default desktop viewport. |
| Lint | Existing baseline lint debt is tracked separately from this showcase; it is not silently represented as a clean pass. |

## Owner walkthrough

1. Open [http://127.0.0.1:5187/](http://127.0.0.1:5187/). The local worker is left running.
2. Choose Sign in and use the synthetic local fixture `showcase` account. The walkthrough password is `ShowcaseLocalPass123!`; it is not a production credential.
3. Open Create a reading, ask `Should I change direction in my work?`, add `I want a grounded next step, not a prediction.`, and continue.
4. In the room, open Choose a spread, select Relationships, then Relationship Check-In. Shuffle, stop, draw the three cards, and open View Tarot reading.
5. Exercise a suggested follow-up, then use Draw a clarification card. Share link opens the live local public-reading route.
6. Confirm Profile and Journal from the account menu.
7. The deterministic public fixture is available at [http://127.0.0.1:5187/r/SSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSS](http://127.0.0.1:5187/r/SSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSS), where the 43 `S` characters are the local-only fixture token.

## Explicit non-goals and unfinished work

- No true token streaming was added; L6 remains final-response JSON only.
- No production deploy, migration, VPS change, payment, email, OAuth, or external customer action was performed.
- No visual polish was applied during this audit. Concrete visual gaps are listed in [LOCAL_UI_GAP_REPORT.md](LOCAL_UI_GAP_REPORT.md).
