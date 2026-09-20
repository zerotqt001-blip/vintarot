# NaTarot Mission Protocol

This protocol is mandatory for substantial NaTarot work. It turns a request into an auditable sequence:

`MISSION → BASELINE AUDIT → DISCOVERY → IMPACT ANALYSIS → PLAN → IMPLEMENT → TEST → REGRESSION → SELF REVIEW → FINAL AUDIT → PRODUCTION READINESS`

The phases below are gates, not merely headings. A later phase cannot silently compensate for missing evidence from an earlier phase.

## Operating rules

- Default to preserve. Unnamed features are out of scope.
- Never silently replace newer working functionality with code from an older branch, commit, implementation, or stale reference.
- Passing compilation is not equivalent to feature completion; feature completion is not equivalent to production readiness.
- Preserve all user-owned working-tree changes. Do not reset, checkout, stash, clean, overwrite, delete, or broadly stage them.
- Use the minimum blast-radius change. Shared refactors, schema changes, auth changes, AI contract changes, deployment changes, and production actions require explicit unlock.
- Do not expose secrets. Do not put credentials in docs, tests, logs, browser storage, commits, or responses.
- Record discrepancies, suspected security issues, missing coverage, and blocked work instead of hiding them.

## PHASE 0 — Baseline

**Entry:** A mission request exists.

**Required actions:**

1. Read `AGENTS.md` and `docs/PROJECT_STATE.md`.
2. Inspect repository root, current branch, `HEAD`, tracking status, staged files, modified files, untracked files, and relevant ignored files.
3. Record the baseline before creating or changing mission files.
4. Identify existing work that the mission must preserve.

**Exit gate:** The baseline includes exact branch/HEAD/status evidence and a list of intended mission files. If the tree is dirty, the mission continues only with explicit preservation boundaries.

**Stop:** Any action would overwrite user work, or the checkout is detached and the mission requires branch integration.

## PHASE 1 — Discovery

**Entry:** Phase 0 is recorded.

**Required actions:** Trace the actual application framework/runtime, routes, shared shell, state, styling, i18n, auth/guest identity, Tarot data and draw logic, AI pipeline, database/schema/migrations, sharing/storage, deployment, and tests. Use source code first and mark unsupported documentation claims.

**Exit gate:** The architecture map can name the real entry points and data/request flows without inventing modules or tests.

**Stop:** Source contradicts the mission enough to change the objective or a required business decision cannot be resolved from the repository.

## PHASE 2 — Impact Analysis

**Entry:** Discovery names the affected components.

**Required actions:**

- Identify direct and transitive consumers of each planned file/module.
- Map auth, data, UI, i18n, AI, deployment, and migration blast radius.
- Classify zones as hard lock, soft lock, active, or unknown.
- Select focused tests and the broader regression matrix from `TEST_MATRIX.md`.
- Identify security and data-safety assumptions.

**Exit gate:** The mission explicitly states what is in scope, out of scope, locked, unlocked, and what regression evidence is required.

**Stop:** The smallest safe change cannot satisfy the objective without crossing an unapproved hard lock.

## PHASE 3 — Plan

**Entry:** Impact analysis is complete.

**Required actions:** Write a bite-sized plan with exact files, interfaces, acceptance criteria, tests, rollback/compatibility considerations, and phase gates. Prefer an existing component or extension over a shared refactor. If the task is substantial, save the plan under `docs/superpowers/plans/` and review it for placeholders and contradictions.

**Exit gate:** Another engineer can execute the plan without guessing the target files, contract, tests, or stop conditions.

**Stop:** The plan has unresolved ambiguity, missing test strategy, or a change budget larger than the stated objective.

## PHASE 4 — Implementation

**Entry:** Plan is reviewed and any required zone unlock is explicit.

**Required actions:** Make the smallest scoped change. Keep UI, auth, data, and AI semantics separate. Add or update focused tests for behavior changes. Preserve unrelated diffs. Do not refactor merely because adjacent code is imperfect.

**Exit gate:** The intended change exists only in the named scope and focused checks can be run.

**Stop:** A test reveals a broader defect, user work would be touched, a migration/destructive action appears necessary, or implementation requires an unapproved boundary change.

## PHASE 5 — Verification

**Entry:** Implementation is present.

**Required actions:** Run focused tests, typecheck, build, lint where relevant, and diff checks. Exercise the acceptance criteria. For responsive or interaction claims, use the required browser/viewport checks. For production claims, verify the actual artifact and target topology rather than inferring from local compilation.

**Exit gate:** Every claimed behavior has fresh evidence or is explicitly marked unverified.

**Stop:** Verification fails and cannot be isolated as pre-existing after bounded investigation. Do not repair unrelated baseline failures under a feature mission.

## PHASE 6 — Regression

**Entry:** Focused verification passes or known baseline failures are isolated.

**Required actions:** Run the dependency-selected matrix: critical flow, security, data, AI contract, responsive, and deployment groups as applicable. Re-check shared consumers and backward compatibility.

**Exit gate:** Relevant existing behavior is evidenced as preserved, or the final report names exact regressions/blockers.

## PHASE 7 — Self Review

**Entry:** Verification and regression evidence are available.

**Required actions:** Review the diff as an architect, QA engineer, security reviewer, release engineer, and documentation owner. Check scope creep, stale references, unsupported assumptions, secrets, accessibility/i18n gaps, data risk, ownership boundaries, and missing tests.

**Exit gate:** Findings are resolved, documented as baseline, or carried as explicit blockers. The final report can name the achieved DoD level.

## PHASE 8 — Final Audit

**Entry:** Self review is complete.

**Required actions:**

- Re-read changed docs/code against current source.
- Run `git status`, `git diff`, and `git diff --check`.
- Confirm only intended files changed and unrelated user work remains intact.
- Search changed files for secret-like content and accidental environment/config changes.
- Confirm no stale older implementation was silently restored.
- Update `docs/PROJECT_STATE.md` for significant decisions, validation, and unfinished work.

**Exit gate:** File list, diff, tests, and remaining risks are explicit.

## PHASE 9 — Production Readiness

**Entry:** Final audit is clean and the mission requires a release decision.

**Required actions:** Verify release source/commit, artifact inventory, environment strategy, migrations, ownership/auth topology, smoke checks, rollback/backup plan, monitoring, and deployment permissions. Commit, push, deploy, restart, or merge only when the mission explicitly authorizes that action.

**Exit gate:** Report Level D only when the target production environment has fresh evidence. Otherwise report the highest lower level and state what remains.

**Stop:** Credential, production access, destructive authorization, or rollback certainty is missing.

## Change budget

Use this order of preference:

`existing component > extension > isolated new component > shared refactor > architecture rewrite`

Architecture rewrites require an explicit mission objective and evidence that the current boundary blocks the objective. “While I am here” is never a justification.

## Required final report

Every substantial mission reports:

1. Mission and user outcome.
2. Baseline: repository, branch, starting `HEAD`, working-tree state.
3. Architecture/dependencies discovered.
4. Scope and locked/unlocked zones.
5. Files changed and unrelated work preserved.
6. Tests, typecheck, build, lint, browser, data, security, and deployment evidence.
7. Baseline failures and existing technical risks.
8. Security observations with evidence and recommended future mission.
9. Highest DoD level: A, B, C, or D.
10. Final status: PASS, PARTIAL, or BLOCKED.
11. Recommended next mission and explicit unfinished work.
