# NaTarot Final UI V2 + Affiliate Integration Plan

> **For agentic workers:** Execute this plan inline in the isolated integration worktree. The user has explicitly authorized end-to-end integration, testing, backup, deployment, rollback verification, and safe release retention.

**Goal:** Integrate the existing UI Correction V2 with the production Affiliate Referral implementation without rebuilding either feature or changing Affiliate policy, attribution, commission, or payment behavior.

**Architecture:** Start from the verified production-descendant Affiliate branch, then merge the UI V2 branch. Resolve the three known conflicts by retaining each branch's independent behavior, audit the auto-merged localization and tests, run the full suite and production build, and deploy only through the existing managed release/backup/rollback tools after compatibility gates pass.

**Tech Stack:** TypeScript, React, Next/Vinext, Node test runner, SQLite, existing NaTarot VPS release manager.

**Spec:** User request “NATAROT — FINAL UI V2 + AFFILIATE INTEGRATION” (2026-09-25); production/deploy constraints in `docs/operations/NATAROT_STORAGE_RETENTION.md` and `docs/operations/natarot-production-storage-guard.md`.

## Global Constraints

- Preserve production Affiliate referral code, link, QR, owner scoping, attribution, commission ledger, payment verification, idempotency, and current policy gate.
- Do not activate Affiliate policy, change commission or attribution rules, or introduce anonymous referral cookies.
- Preserve all UI V2 source changes and current NaTarot/Moonlight design; do not duplicate shell components or CSS.
- Do not seed fake production accounts, referrals, readings, or transactions.
- Take a fresh verified production backup before deployment; deploy through the existing release manager, validate rollback, and retain current plus two rollback releases.
- Do not overwrite the user's existing checkout or unrelated active branches.

---

### Task 1: Verify baseline and merge inputs

**Files:** No application files.

- [x] Confirm the live release is `affiliate-referral-3405b75-20260924T113918Z`, health is `ok`, Affiliate policy is inactive, and the three release references are distinct.
- [x] Confirm `3405b75` is an ancestor of Affiliate branch `f95e207`; the UI V2 branch is `fc39e60` and the two source worktrees are clean.
- [x] Confirm the merge base is `e5474d3` and the known conflict set is exactly `app/globals.css`, `docs/PROJECT_STATE.md`, and `tests/member-affiliate-ui-v1.test.ts`; inspect overlap in `lib/i18n.ts` and `tests/affiliate-dashboard-redesign.test.ts`.
- [x] Install locked dependencies in this isolated worktree and capture the Affiliate baseline full-suite result (`624/624`).

### Task 2: Merge UI V2 and resolve only integration conflicts

**Files:**
- Modify: `app/globals.css`
- Modify: `docs/PROJECT_STATE.md`
- Modify: `tests/member-affiliate-ui-v1.test.ts`
- Review: `lib/i18n.ts`, `tests/affiliate-dashboard-redesign.test.ts`, and the complete UI V2 diff.

- [x] Merge `origin/codex/natarot-final-ui-correction-v2` into the integration branch.
- [x] Keep the V2 shared shell/style refactor intact and retain the Affiliate referral styles exactly once in the same stylesheet.
- [x] Combine the V2 shell/account assertions with the Affiliate owner-scoped referral/policy-gate assertions in the member/Affiliate regression test.
- [x] Preserve both branch histories in `docs/PROJECT_STATE.md`, with production claims tied to the verified release and V2 verification clearly marked as pending until measured.
- [x] Review all changed-file and CSS selector diffs for duplicate shell components, duplicated rules, lost referral behavior, or unrequested policy changes.

### Task 3: Verify integrated behavior

**Files:** Tests already present on both source branches; add a regression test only if a concrete integration defect is found.

- [x] Run focused UI V2, Affiliate referral, Affiliate dashboard, policy gate, owner-scoping, attribution, commission-ledger/idempotency, and payment-verification tests (`63/63`).
- [x] Run the full `npx tsx --test tests/*.test.ts` suite and record the complete exit status/count (`645/645`).
- [x] Run `npx tsc --noEmit`, `npm run build`, changed-file ESLint, `git diff --check`, and production dependency audit (all pass).
- [x] Verify test fixtures exercise real application boundaries and do not create or imply production test data.

### Task 4: Production QA and screenshot evidence

**Files:** No production data changes; save requested screenshots as task-local evidence, not as public source artifacts.

- [x] Capture the deployed current production Affiliate UI at desktop as the before-state; the available browser is an isolated guest session.
- [ ] After deployment, capture public/guest Affiliate and Account surfaces at desktop/mobile and verify policy-inactive behavior.
- [ ] Capture logged-in Affiliate, logged-in Account, and an existing real Reading Result only if a valid, already-authorized production session is available; do not invent credentials, seed a customer, or create a paid/provider-backed transaction.
- [ ] Record unavailable authenticated screenshots as explicit blockers; never represent guest/local fixtures as authenticated production evidence.

### Task 5: Backup, compatibility gate, deploy, rollback, and retention

**Files:** No tracked deployment changes unless the current deployment tooling requires a scoped, tested fix.

- [ ] Re-audit release pointers, storage, service, database integrity/migrations, backup and restore-test status immediately before deployment.
- [ ] Verify the existing Affiliate migration is additive and already-compatible with production data; do not alter referral hashes/history or commission/attribution records.
- [ ] Run the installed release manager backup verification and take/verify its fresh production backup.
- [ ] Package the exact integration commit without secrets, databases, or user data; deploy through the installed release manager and check health/policy/security boundaries.
- [ ] Run the manager's rollback test against `previous-1`, verify it restores the intended current release, then clean up only through the guarded manager after browser QA; retain current, previous-1, and previous-2.

### Task 6: Review, commit, push, and report

**Files:** `docs/PROJECT_STATE.md` plus the verified integration source/tests.

- [ ] Update `docs/PROJECT_STATE.md` with exact source baseline, integration commit, validation, screenshots available/missing, backup/deploy/rollback/retention evidence, and remaining blockers.
- [ ] Inspect staged changes and secret scan, commit only related files, push normally, and verify local/remote SHA equality.
- [ ] Obtain a fresh read-only code review of the integration diff; fix any critical or important finding and rerun affected tests.
- [ ] Report production commit, integration commit, test results, Affiliate regression, UI V2 verification, screenshot paths, deployment/rollback/retention status, and blockers.
