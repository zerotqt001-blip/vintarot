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

- [x] Recheck the live release before deployment: current is `human-reader-account-8263b50`, `previous-1` is `human-reader-booking-2f2dee8`, and `previous-2` is `secondary-nav-95e7eb4-20260924235312Z`; service and public health are healthy, policy API is `null`/DRAFT, and all three references are distinct.
- [x] Confirm exact live source `8263b50b19d22eebbd73bdf9cc2510da4e58ab17` (merge of current Human Reader source `2f2dee8` and Account/Daily navigation branch `df6fcde`, itself containing `7d21a30`/`95e7eb4`), Affiliate branch `f95e207`, and UI V2 branch `fc39e60`.
- [x] Inspect production SQLite read-only: integrity is `ok`, FK violations are zero, both additive migrations `0009_affiliate_referral_links.sql` and `0009_human_readers.sql` are applied, referral/attribution/conversion/commission rows are zero, there are two ACTIVE Affiliate profiles, and policy v1 remains DRAFT with its existing 30-day attribution / 7-day hold / VND values unchanged.
- [x] Audit active navigation/UI branches. Port the Account/Daily secondary-sidebar correction from `95e7eb4`; do not merge `origin/codex/room-sidebar-autohide` wholesale because its `9e4a6c8` tree deletes the deployed Human Reader API/Admin/migration and contains a separate, non-production Reading Result redesign.
- [x] Confirm the original Affiliate/UI V2 conflict set (`app/globals.css`, `docs/PROJECT_STATE.md`, `tests/member-affiliate-ui-v1.test.ts`) plus the later live-production conflict (`app/vintarot.tsx`); inspect localization, dashboard tests, production Room/Create navigation changes, and the canonical V2 shell.
- [x] Install locked dependencies in this isolated worktree and capture the Affiliate baseline full-suite result (`624/624`).

### Task 2: Merge UI V2 and resolve only integration conflicts

**Files:**
- Modify: `app/globals.css`
- Modify: `docs/PROJECT_STATE.md`
- Modify: `tests/member-affiliate-ui-v1.test.ts`
- Review: `lib/i18n.ts`, `tests/affiliate-dashboard-redesign.test.ts`, and the complete UI V2 diff.

- [x] Merge `origin/codex/natarot-final-ui-correction-v2`, production navigation commits `e326acda1e2437642bdbc0a656990bf6ffc33508`, `7d21a30712541ab3c0d371054ea89d5ae1ec5141`, and `8263b50b19d22eebbd73bdf9cc2510da4e58ab17`, the exact production Reading Result commit `d26ce8d67e0a2efc9200290b9ebeafee38e89079`, and current Human Reader source `2f2dee8ecafbac6c0ff91109b96aae51f5375b3a` into the Affiliate-based integration branch.
- [x] Keep the V2 shared shell/style refactor intact and retain the Affiliate referral styles exactly once in the same stylesheet.
- [x] Combine the V2 shell/account assertions with the Affiliate owner-scoped referral/policy-gate assertions in the member/Affiliate regression test.
- [x] Preserve both branch histories in `docs/PROJECT_STATE.md`, with production claims tied to the verified release and V2 verification clearly marked as pending until measured.
- [x] Review all changed-file and CSS selector diffs for duplicate shell components, duplicated rules, lost referral behavior, or unrequested policy changes.
- [x] Port live `/create` and `/account` Home-rail parity into the existing V2 canonical sidebar instead of restoring the obsolete monolithic shell; retain live Room auto-hide and responsive rail styles with V2 label classes and sufficient cascade priority. Account/Create styling shares one rule group and uses the same stable `nav-label` class; the later secondary-sidebar correction keeps Account and Daily free of duplicate personal shortcuts.
- [x] Preserve the active production Reading Result composition and semantics while retaining UI V2's adaptive spread geometry and the real-question context in loading/error/empty states; remove the superseded duplicate Reading Result V2 CSS block.
- [x] Preserve the deployed Human Reader Booking/API/Admin feature and its already-applied additive `0009_human_readers.sql` migration while keeping the V2 shared shell authoritative.

### Task 3: Verify integrated behavior

**Files:** Tests already present on both source branches; add a regression test only if a concrete integration defect is found.

- [x] Run focused UI V2/Reading Result/navigation tests (`29/29`), Affiliate/service/route tests (`10/10`), and policy gate, owner-scoping, attribution, commission-ledger/idempotency, and payment-verification coverage.
- [x] Run the full `npx tsx --test tests/*.test.ts` suite after the exact live-production merge and regression fixes (`651/651`).
- [x] Run `npx tsc --noEmit`, `npm run build`, scoped ESLint for integration/navigation/migration tests (0 errors), and `npm audit --omit=dev --audit-level=high` (0 vulnerabilities). The imported, unchanged current-production Human Reader files retain their existing broader ESLint findings (32 errors, 12 warnings).
- [x] Verify test fixtures exercise real application boundaries and do not create or imply production test data.

### Task 4: Production QA and screenshot evidence

**Files:** No production data changes; browser captures were emitted inline in the task (the browser tool did not provide exportable screenshot file paths).

- [x] Capture the deployed production Affiliate UI at desktop for current-state verification; the existing IAB session was already authenticated to the production QA account.
- [x] After deployment, capture production Affiliate and Account surfaces at desktop/mobile and verify policy-inactive behavior; Affiliate and Account were captured in the existing authenticated production QA session.
- [x] Capture logged-in Affiliate and Account. The Affiliate panel accurately shows no code/link/QR while policy is DRAFT; no customer or fake data was used.
- [x] Check for an existing real Reading Result without creating one. None exists in the authorized production QA account/database, so this screenshot is explicitly unavailable; captures remain inline in tool output rather than exported files.

### Task 5: Backup, compatibility gate, deploy, rollback, and retention

**Files:** No tracked deployment changes unless the current deployment tooling requires a scoped, tested fix.

- [x] Re-audit release pointers, storage, service, database integrity/migrations, backup and restore-test status immediately before deployment.
- [x] Verify the existing Affiliate migration is additive and already-compatible with production data; preserve referral hashes/history, attribution and commission records. Existing migrations were applied and production counts/digests remained unchanged.
- [x] Run the installed release manager backup verification and take/verify a fresh production backup (`natarot-production-20260925-011115`, SHA-256 `2abd7b0fcf95c79d044162dd5622341b2b2b196aada2cf06a9e5ea9e5865d6aa`).
- [x] Package exact integration source `a2615d1` without secrets/databases/user data, deploy through the release manager, and verify service/API health plus unchanged DRAFT policy.
- [x] Rollback-test `previous-1`; the manager passed both health checks and restored `natarot-final-ui-v2-a2615d1-20260925T010940Z`. Guarded cleanup retained exactly current + two rollback releases and removed one obsolete successful release. Final storage audit passed.

### Task 6: Review, commit, push, and report

**Files:** `docs/PROJECT_STATE.md` plus the verified integration source/tests.

- [x] Update `docs/PROJECT_STATE.md` with exact source baseline, integration commit, validation, browser captures available/missing, backup/deploy/rollback/retention evidence, and remaining blockers.
- [x] Inspect staged changes and secret scan; commit only the two related docs files; push normally to the existing PR branch and verify local/remote SHA equality (`23676cc5ce34a8148ecfa71197cedc5af083ee60` at first push verification).
- [x] Obtain fresh read-only review of the integration diff; no Critical/Important issues remained after the Daily mobile clearance regression fix and tests.
- [x] Report production commit, integration commit, test results, Affiliate regression, UI V2 verification, screenshot evidence/limitations, deployment/rollback/retention status, and blockers in the final handoff.
