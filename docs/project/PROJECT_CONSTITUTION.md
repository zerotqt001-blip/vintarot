# NaTarot Project Constitution

Status: Level 4 governance baseline, derived from the checked-out repository on 2026-09-20.

This constitution governs future NaTarot missions. It is a development control document, not a product specification. The current source, tests, schema, deployment files, and Git state remain the authority for what NaTarot actually does.

## 1. Source of truth

When sources disagree, resolve them in this order:

1. Current repository files and current checkout.
2. Current branch and current `HEAD`.
3. Application code and route entry points.
4. Existing tests and their actual assertions.
5. Database schema, migrations, and seed data.
6. Deployment and runtime configuration.
7. Existing project documentation and release notes.
8. Git history, when needed to explain an intentional transition.
9. Mission prompt or reference material.

Document every meaningful discrepancy. Source code wins over stale documentation; a release note is not proof that the checked-out source still has that behavior.

## 2. Core engineering principles

- Default to preserve. If a mission does not explicitly name a feature for change, that feature is out of scope.
- Use the smallest change that satisfies the objective. Prefer an existing component, then an extension, then an isolated component; shared refactors and rewrites require explicit justification.
- Never silently replace newer working functionality with code from an older branch, commit, implementation, or stale reference.
- Passing compilation is not equivalent to feature completion.
- Feature completion is not equivalent to production readiness.
- Trace dependencies before editing shared code. A change is not local merely because the diff is small.
- Keep UI, identity, data, and AI semantics separate. A visual mission must not rewrite Tarot meaning or provider contracts; an AI mission must not redesign unrelated UI.
- Preserve the NaTarot brand and the approved Moonlight reference interactions unless the mission explicitly changes them.
- Treat existing uncommitted files as user-owned. Never reset, clean, stash, overwrite, delete, or silently stage them.

## 3. Scope and change discipline

Every mission must state:

- the user outcome;
- the exact in-scope files or zones;
- explicit out-of-scope behavior;
- locked zones and any explicit unlock;
- expected blast radius;
- required validation and regression evidence;
- stop conditions.

The phrase “while I am here” is not authorization to refactor, rename, restyle, migrate, or clean up an unrelated area. If a shared dependency must change, record the dependency, choose the minimal compatible change, and expand the regression set before implementation.

## 4. Security requirements

- Treat platform-authenticated headers as a trust boundary. Do not promote arbitrary request headers to a user identity.
- Re-check ownership on the server for every user-owned record, room, reading session, saved reading, and follow-up operation.
- Validate client input at API boundaries with the existing schema patterns and bounded sizes.
- Preserve origin checks, cookie attributes, forwarded-protocol handling, and reverse-proxy header policy unless a security mission explicitly unlocks them.
- Keep provider credentials server-side. Never write secrets to source, docs, browser storage, logs, test fixtures, commits, or public responses.
- Record suspected security weaknesses with evidence and a severity estimate; do not silently “fix” them during an unrelated bootstrap or feature mission.

## 5. Data safety and backward compatibility

- Treat `records`, `rooms`, `room_members`, Tarot catalog tables, reading sessions/cards, and persisted readings as important data.
- Do not drop, truncate, bulk-overwrite, or destructively migrate production data without explicit authorization, a rollback/backup plan, and a verified migration path.
- Preserve the current migration order and compatibility readers. A normalized reading payload must not make legacy nullable-payload rows unreadable without a deliberate migration and regression coverage.
- Use parameterized database access and preserve ownership predicates.
- Do not run migrations or change production configuration during a documentation/bootstrap mission.

## 6. Responsive, accessibility, and i18n requirements

- Treat desktop, tablet, and mobile layouts as one product surface. Any global shell, layout, or CSS change requires multi-viewport regression evidence.
- Preserve keyboard focus, semantic controls, accessible names, reduced-motion handling, safe-area behavior, and pointer/touch interaction contracts.
- Keep English and Vietnamese behavior aligned. New user-facing strings belong in the existing i18n message system and must not silently fall back to an unrelated locale.
- A visual match is not complete if it introduces horizontal overflow, traps focus, changes a route's interaction contract, or breaks reduced motion.

## 7. Testing requirements

Evidence must be proportional to blast radius:

- Run the smallest focused tests while iterating.
- Run the affected critical-flow and security/data tests before declaring a mission verified.
- Run the tracked suite, typecheck, build, and `git diff --check` for a completed cross-cutting or release-relevant mission when the environment permits.
- Report missing coverage honestly. A test filename is not coverage unless the assertion exercises the behavior in question.
- Record baseline failures separately from regressions introduced by the mission.

## 8. Definition of Done

NaTarot uses four explicit levels:

### Level A — Code complete

The intended implementation or documentation exists in the expected files.

### Level B — Functionally verified

The acceptance criteria are exercised and the observed behavior matches them.

### Level C — Regression safe

Relevant existing flows, shared dependencies, security boundaries, responsive behavior, and data compatibility checks still pass.

### Level D — Production ready

Deployment/runtime configuration, environment requirements, data safety, monitoring/rollback expectations, secrets handling, and live or release-environment checks are satisfied.

Every final report must name the highest level actually evidenced. Never use an unqualified “done.”

## 9. Production-readiness rules

Build success proves only that the artifact can be built. Production readiness additionally requires:

- the intended artifact and source revision are identified;
- environment variables and provider configuration are present without exposing values;
- migrations are ordered, reviewed, and safe for the target database;
- authentication and ownership boundaries are tested in the target topology;
- representative routes and critical flows are smoke-tested;
- rollback and backup-sensitive paths are known;
- later deployments cannot silently replace a verified release with an older or incomplete tree;
- the final Git diff contains only intended files and no secrets.

If production access, credentials, destructive data operations, or an unresolved business decision is required, stop and report the blocker.

## 10. Stop conditions

Stop implementation and document the state when:

- the requested behavior conflicts with a hard lock or safety rule;
- the source cannot resolve a business ambiguity that changes the design;
- a required credential, production access, or destructive authorization is missing;
- a test or verification failure cannot be isolated as pre-existing after bounded investigation;
- the next action could overwrite or lose user work;
- the observed architecture contradicts the plan enough to change its blast radius;
- the only available fix would alter product behavior outside the explicit mission scope.

## 11. Governance self-check

Before final reporting, re-read the changed governance documents against the current repository and check for stale paths, nonexistent tests, unsupported status claims, contradictory locks, missing dependencies, secret-like values, and accidental application/configuration changes.
