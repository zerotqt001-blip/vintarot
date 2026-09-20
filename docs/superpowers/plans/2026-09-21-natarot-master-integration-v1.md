# NaTarot Master Integration V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first authoritative NaTarot integration branch from the verified L5–L8 engine, S6 share persistence, selective verification email, and audited security patches, then prove and push it without touching main or production.

**Architecture:** Use the L5–L8 engine commit as the sole base. Integrate S6 once, compose `app/room/room.tsx` by preserving both reading/spread behavior and share/public-reading controls, then port only the email and security patches whose file-level changes apply cleanly to the engine base. Reconcile dependencies and the two canonical `0004` migrations from source evidence, validate fresh and upgraded local SQLite/D1 state, run subsystem and full regression gates, update state documentation from observed results, and push the new branch normally.

**Tech Stack:** Git worktrees and cherry-pick/merge; React 19 + TypeScript; Vinext/Vite; Node `node:sqlite` D1 adapter; `tsx --test`; npm lockfile; Cloudflare-compatible SQL migrations.

**Spec:** User-provided `NATAROT — MASTER INTEGRATION MILESTONE` attachment, authorized for autonomous execution.

## Global Constraints

- Base exactly `046c166ffa653fdd985c81fcbde8d62b35634f15` from `origin/codex/natarot-l5-l8-engine`.
- Integrate S6 exactly once from `9d7de6e971e1e610ed5c3d1343d77c4452dc8ee`; do not replay S1–S5 or L1A/L1B/L1C/L4 ancestors.
- Apply only the relevant verification-email changes from `ae7b9cf`; do not merge its historical branch tree.
- Apply only audited security commits `57db368`, `40a1844`, and `a8893db` in evidence-backed order; never merge the divergent security branch wholesale.
- Preserve L6 reliability/final JSON delivery and explicitly leave token streaming unimplemented.
- Do not modify main, existing authoritative branches, production databases, deployments, VPS state, provider credentials, secrets, payments, Credits/VIP, Affiliate, or broad UI design.
- Preserve raw-token non-persistence, owner/guest isolation, public projection allowlists, analytics idempotency, and both canonical `0004` migrations.
- A successful end state is integrated, verified, committed, and pushed; it is not merged or deployed.

---

### Task 1: Confirm isolated baseline and authoritative objects

**Files:**
- Modify: none in the application; worktree setup and Git refs only.
- Test: current repository worktree state and exact object reachability.

- [x] **Step 1: Fetch and inspect refs**

Run `git fetch origin --prune`, inspect `git worktree list`, `git status`, and `git branch -a -vv`, then verify each required commit resolves and the engine head is reachable from its authoritative remote branch.

- [x] **Step 2: Create the integration worktree and branch**

Create the isolated worktree from the exact engine commit and create `codex/natarot-integration-v1`; verify `HEAD` equals `046c166ffa653fdd985c81fcbde8d62b35634f15` and the worktree is clean.

- [x] **Step 3: Install dependencies and capture the clean-engine baseline**

Run `npm ci`, then run the repository's current tracked test command, `npx tsc --noEmit`, and `npm run build`. Record any baseline failures before integration so they are not misattributed. Baseline: `402/402` tests passed, TypeScript passed, and the production build passed.

### Task 2: Establish the integrated application graph

**Files:**
- Modify: Git history and any conflict files selected by the actual merge.
- Test: focused engine, spread, Room, and share suites after each composition step.

- [x] **Step 1: Prove ancestor relationships before replaying history**

Use `git merge-base --is-ancestor` and `git log --graph --decorate --oneline` to confirm the engine already contains L1A/L1B/L1C/L4 and that S1–S5 are ancestors of S6. Verified: `09365af`, `5668fb5`, `a53dc44`, and `f92b073` are engine ancestors; `02df506` is an S6 ancestor; S6 is not an engine ancestor.

- [x] **Step 2: Integrate S6 once**

Use the safest ancestry-aware merge or cherry-pick for `9d7de6e971e1e610ed5c3d1343d77c4452dc8ee`; inspect every conflict and never resolve with blanket `ours`/`theirs`. The divergent heads required a non-committing merge; the final merge commit is `b9ce36e`.

- [x] **Step 3: Compose Room behavior semantically**

In `app/room/room.tsx`, retain L5 whole-spread reading, L7 follow-up, L8 supplementary draw, existing state/draw behavior, and SpreadBoard behavior while preserving S6 share creation, owner-scoped controls, Copy Link, image/QR integration, status/error state, revoke behavior, and public-reading integration. Add or update the smallest regression tests for any integration-discovered state collision before keeping the fix.

- [x] **Step 4: Run the Room/share/reading focused gates**

Run the current Room, SpreadBoard, L5, L6, L7, L8, share persistence, share E2E, and public projection tests. Inspect the combined diff and commit the S6 integration/composition as a meaningful integration commit only after the focused gates pass. Verified: `148/148` focused tests passed, TypeScript passed, and `b9ce36e` records the integration.

### Task 3: Port selective verification email and security changes

**Files:**
- Modify: only files whose diffs are proven relevant from `ae7b9cf`, `57db368`, `40a1844`, and `a8893db`.
- Test: verification-email, auth, F-001, health, cache-boundary, and security regression suites.

- [x] **Step 1: Inspect source patch boundaries**

Compare each candidate commit against the engine base with `git show --stat`, `git diff`, and ancestry checks. Separate implementation/test changes from historical branch-only docs or divergent auth/migration state.

- [x] **Step 2: Apply the email implementation/tests selectively**

Port only the verified VI/EN verification-link email behavior: Resend, HTML plus text fallback, escaped username/URL, and 24-hour expiry. Preserve link authentication and current member auth semantics; do not introduce OTP.

- [x] **Step 3: Apply audited security changes selectively**

Port the no-store boundaries, `/api/health`, and compatible dependency/security changes in the order established by the actual Git evidence. Do not import the old security branch tree.

- [x] **Step 4: Run security-focused tests and commit**

Run the email, auth, F-001 spoofed-header, guest ownership, cross-owner isolation, health, cache, and security suites. Add a failing regression test first for any integration-attributed regression, then fix minimally and rerun the affected suites before a separate selective-patches commit. Verified: email/auth focused `50/50` before security, final security/auth matrix `49/49`, TypeScript passed, and selective patches are recorded in `9fcd0b3` and `eb13ba2`; no historical state-doc changes were imported.

### Task 4: Reconcile dependencies and migration behavior

**Files:**
- Modify: `package.json`, `package-lock.json`, and migration/runner files only when source evidence requires it.
- Test: npm install/audit and local migration tests using temporary SQLite/D1 state.

- [x] **Step 1: Reconcile package requirements**

Keep S6 requirements `qrcode ^1.5.4` and `@types/qrcode ^1.5.6`; incorporate compatible audited React/React DOM/RSC `19.2.8` and Vite `8.0.16` floors without replacing either branch's manifest wholesale.

- [x] **Step 2: Reinstall from the final lockfile**

Run `npm ci` and inspect the resulting manifest/lockfile diff for unrelated upgrades. Verified: qrcode `1.5.4`, @types/qrcode `1.5.6`, React/React DOM/RSC `19.2.8`, and Vite `8.0.16` are installed from the lockfile.

- [x] **Step 3: Verify canonical migrations**

Confirmed `0000`–`0005`, including both existing `0004` migrations, are discovered and applied deterministically. Fresh and pre-share upgrade databases both pass; the upgrade retains member/reading rows, applies exactly one `0005`, preserves idempotency, and passes foreign-key, index, token-hash, active-reading, privacy/status, and share-persistence checks. Migration suite: `21/21`.

- [x] **Step 4: Commit dependency/migration reconciliation**

The audited manifest/lockfile changes are in `eb13ba2`; migration upgrade coverage is in `734ce26`. No production database was touched.

### Task 5: Run complete validation and perform maintainer self-review

**Files:**
- Modify: only regression tests or minimal implementation corrections proven necessary by failures.
- Test: all focused suites, full tracked suite, TypeScript, build, targeted lint, npm audit, and diff checks.

- [x] **Step 1: Run the complete focused matrix**

The complete tracked suite covers the L5–L8 engine, Room/SpreadBoard, share persistence/routes/E2E, verification email, auth, F-001, security/health, and migrations: `441/441` passed.

- [x] **Step 2: Run full regression and static gates**

`npx tsc --noEmit`, `npm run build`, `npm audit --omit=dev` (`0 vulnerabilities`), and both committed/uncommitted `git diff --check` gates passed. Targeted lint for the newly integrated email/security/migration files passed. A broader lint over every changed source file still reports the pre-existing engine/S6 baseline (`26 errors`, `7 warnings`), concentrated outside the new selective patch files; no integration-attributed lint error remains.

- [x] **Step 3: Review the final graph and diff**

Verified the branch is based on `046c166`, contains one S6 merge with the S6 ancestors on its second-parent side, and retains the engine’s L1/L4/L5–L8 history without replay. The selective email/security commits contain only the inspected implementation/tests and dependency changes; no state-doc or production-operation files were imported. Room retains follow-up/clarification props alongside share controls, the migration/privacy constraints are covered by tests, the full suite preserves the L5–L8/KB V5/DeepSeek contracts, no token-streaming implementation is present, and the S6 responsive share styles are bounded by mobile breakpoints.

- [x] **Step 4: Fix every integration-attributed finding with a regression test**

The only integration-test failure was the migration harness’s strict comparison against Node SQLite’s null-prototype rows; the assertion was minimally normalized and the migration/full suites were rerun. No Critical or Important integration finding remains. The broader lint baseline remains documented separately and has no finding in the new selective files.

### Task 6: Reconcile state, commit, push, and verify remote

**Files:**
- Modify: `docs/PROJECT_STATE.md` only after final code and validation are proven.
- Test: final diff, commit graph, remote tracking equality, and clean worktree.

- [x] **Step 1: Update project state from observed facts**

Updated `docs/PROJECT_STATE.md` from observed facts without replaying historical state sections. It records the exact engine/S6/patch/code-head commits, L6 final-JSON versus intentionally absent token streaming, duplicate-`0004` migration behavior, validation evidence, security/privacy boundaries, and explicit `MERGED TO MAIN: NO`, `DEPLOYED: NO`, and `PRODUCTION DB: UNCHANGED` boundaries. The remote-push line remains pending until the final handoff check.

- [ ] **Step 2: Inspect staged content for secrets and unrelated changes**

Review `git diff --cached`, search staged files for secret-like values, and ensure only integration, tests, dependency/migration, plan, and state files are included.

- [ ] **Step 3: Commit the state reconciliation**

Create a clear final state commit after fresh verification; do not squash the auditable integration history.

- [ ] **Step 4: Push and verify the remote**

Run `git push -u origin codex/natarot-integration-v1`, then verify local `HEAD == origin/codex/natarot-integration-v1`, the branch is clean, and no main/production operation occurred.
