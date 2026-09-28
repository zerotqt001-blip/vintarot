# NaTarot Full Technical Audit and Performance Optimization Plan

> **For agentic workers:** Use superpowers:subagent-driven-development for independent audit tracks; keep all inspection read-only until a measured optimization is selected.

**Goal:** Audit NaTarot at the verified production baseline and deliver an evidence-backed audit report plus narrowly scoped, verified optimizations that preserve business behavior.

**Architecture:** Use the production source commit as the reproducible base, separate source/runtime measurements from VPS/database observations, and rank findings by severity and evidence. Implement only independently verifiable changes with before/after measurements; keep production data and release state protected.

**Tech Stack:** Node 22, React 19, Next 16/Vinext, Vite, TypeScript, Drizzle, SQLite/D1-compatible database, Node test runner through tsx, systemd, Nginx, Lighthouse.

**Spec:** `/Users/tranquangthanh/.codex/attachments/25281f66-beb3-4e1d-b0cd-aec2f61809c2/Văn bản đã dán.txt`

## Global Constraints

- Preserve all existing business functionality.
- Do not delete code based only on an automated unused-code report.
- Never cache private AI readings across different users.
- Never weaken Credit enforcement to improve performance.
- Do not delete production data.
- Do not modify financial ledgers.
- Any schema change requires migration, rollback planning and restore verification.
- Do not delete unknown directories.
- Preserve production data and secrets.
- Preserve approved visual designs.
- Do not deploy while another worker is modifying production.

---

### Task 1: Establish and record the production baseline

**Files:**
- Modify: `docs/audits/NATAROT_FULL_TECHNICAL_AUDIT.md`
- Modify: `docs/PROJECT_STATE.md` after findings and validation are complete

**Interfaces:**
- Initial source baseline: `42e1603940cd35fcb1bbcd8ba4fe1f3ddf8e607d`
- Current audited source baseline after an independently observed production rollout: `f88dd6d1b297227d19df265b7068a0f398ddf3c0` (`codex/signup-trial-credit`)
- Audit branch: `codex/natarot-full-technical-audit`
- Initial observed release: `natarot-admin-member-summary-42e1603-20260928T025007Z`
- Later observed release: `natarot-signup-trial-f88dd6d-20260928T073600Z`

- [x] Verify the isolated worktree is on the audit branch at the current audited source baseline; preserve concurrent worktrees.
- [x] Record that production changed from `42e1603` to `f88dd6d` during read-only inspection; pause any deployment or further VPS audit until a stable production gate is confirmed.
- [x] Record Node/npm versions, lockfile SHA-256, tracked file count, code LOC by category, test command/count, TypeScript result, build result, lint result, and artifact sizes.
- [x] Run `npm run install:ci`, `npx tsx --test tests/*.test.ts`, `npx tsc --noEmit`, `npm run build`, and `npm run lint`; preserve full lint output under `/tmp` and summarize it in the report.
- [x] Record inherited failures without attributing them to this audit branch.

### Task 2: Inventory code and maintenance complexity

**Files:**
- Inspect: tracked files under `app/`, `components/`, `lib/`, `db/`, `scripts/`, `drizzle/`, `tests/`, `public/`, and `natarot-knowledge/`
- Modify: `docs/audits/NATAROT_FULL_TECHNICAL_AUDIT.md`

**Interfaces:**
- Classify source, tests, docs, data, migrations, scripts, assets, generated/tooling, dependencies, and build output separately.
- Verify static candidates against routes, dynamic imports, server routes, workers, scripts, tests, and deployment packaging before calling them unused.

- [x] Calculate tracked text LOC excluding dependencies and generated/build artifacts; record the exact file selection rule.
- [x] Build a route/component/import inventory; identify oversized components, repeated logic, unused dependencies/assets, and duplicate CSS selectors.
- [x] Manually verify each high-confidence candidate and record file/line evidence, confidence, risk, and required regression checks.
- [x] Keep unproven candidates in the backlog; do not delete them.

### Task 3: Measure frontend behavior

**Files:**
- Inspect: production routes and their emitted JS/CSS/image/font assets
- Modify: `docs/audits/NATAROT_FULL_TECHNICAL_AUDIT.md`

**Interfaces:**
- Public production origin: `https://natarot.com`
- Required matrix: desktop/mobile, cold/warm cache, and throttled/slow network.
- Preserve the approved Moonlight/NaTarot reference aesthetic.

- [x] Capture Lighthouse lab metrics and cold/warm/mobile/desktop runs for reachable public routes; field Core Web Vitals and memory data were unavailable and are explicitly labeled as such. JSON artifacts remain outside Git.
- [x] Record transferred CSS/JS/image/font bytes, request counts, navigation timings, and measured LCP behavior; production uncompressed asset detail is reported only where the response exposed it.
- [x] Inspect reachable target routes and record auth gates; do not generate readings, shares, payments, or login sessions without an authorized QA fixture.
- [x] Select and verify WebP only after measurements showed large background transfer costs; preserve original PNG fallback and Moonlight/VinTarot styling.

### Task 4: Audit backend, database, security, and operations

**Files:**
- Inspect: `app/api/`, `lib/`, `db/`, `drizzle/`, `deploy/`, and `scripts/`
- Modify: `docs/audits/NATAROT_FULL_TECHNICAL_AUDIT.md`

**Interfaces:**
- Production inspection uses the existing `natarot-vps` SSH alias and read-only commands.
- Production database reads must use SQLite read-only mode; do not print row contents or secrets.
- Do not trigger real AI-provider, payment, credit, affiliate, or customer-data workflows.

- [x] Trace authentication, authorization, customer isolation, Credits reservation/consumption, payment idempotency, affiliate attribution/ledger, OAuth, and public sharing to source and tests.
- [ ] Record production API latency and separate external AI latency from application processing; only public `/api/health` status was observed, and no provider request was initiated.
- [ ] Inspect the production schema, indexes, foreign keys, integrity, migration history, row counts, and representative query plans. Static schema/migration review is documented; production DB reads stopped after the release changed.
- [ ] Recheck current CPU/RAM/disk, service/Nginx/timers/log rotation, backup/restore verification, deployment lock, and release topology. An initial read-only snapshot is recorded, but no current-state/restore gate was rechecked.
- [x] Classify findings with evidence, severity, blast radius, owner/action, and rollback or recovery method.

### Task 5: Implement measured, isolated optimizations

**Files:**
- Select only after Tasks 1–4 produce evidence.
- Add or update focused regression tests before implementation.
- Update the audit report and `docs/PROJECT_STATE.md` with before/after measurements.

**Interfaces:**
- Every optimization must have a reproducible baseline, a focused regression check, and a measurable before/after result.
- Any database change must follow the migration, rollback, backup, and restore gates in the request.

- [x] Write a concrete task plan for the selected asset optimization, including exact files, tests, baseline commands, and fallback/rollback behavior.
- [x] Add the failing WebP pairing/size regression test before implementation; adapt the existing child-process CSS test harness after recording its baseline failure.
- [x] Implement the measured image change without touching business logic or the approved styling.
- [x] Re-run full and focused regression, TypeScript, build, targeted lint, and matched before/after browser measurement. Full suite retains one documented inherited geometry failure.
- [ ] Do not deploy until a fresh backup is verified, restore readiness is confirmed, the deployment lock is clear, and production integration/rollback gates pass.

### Task 6: Complete the report and final audit trail

**Files:**
- Create: `docs/audits/NATAROT_FULL_TECHNICAL_AUDIT.md`
- Modify: `docs/PROJECT_STATE.md`

- [x] Include the observed production baseline, source architecture, code inventory, before/after measurements, severity-ranked findings, verification evidence, prioritized backlog, unresolved risks, and explicit unavailable gates. No production release was created by this audit.
- [x] Verify that numerical claims are reproducible from `/tmp/natarot-audit-20260928/` captures, code inventory, file sizes, or command output; the report includes no secrets or customer data.
- [x] Run `git diff --check`, inspect the complete staged diff for secrets, commit only audit-related files, and report local/remote commit status.

---

## Completion continuation (2026-09-28)

**Updated live baseline:** release `natarot-admin-credit-read-7ab08e1-20260928T094059Z`, source commit `7ab08e136dfe89f475c276978830dc20d15cc2c9`. Read-only VPS inspection confirmed that `current` pointed to this release, `natarot.service` was active, localhost health returned `{"status":"ok"}`, and the deployment lock was clear. The active Marketing Campaign worktree contains uncommitted auth/Credit changes and remains isolated; its worker confirmed no current or planned production write.

- [ ] Merge the exact live source commit into this audit branch without rewriting prior commits; resolve shared CSS and project-state changes while preserving the audit's WebP work.
- [ ] Add regression coverage for every supported spread type at 320, 342, 375, 390, and 412 CSS pixels; prove the 342 px failure before changing the projector; preserve canonical keys, orders, labels, and positioning semantics.
- [ ] Verify actual mobile rendering at those widths and inspect the winning CSS cascade before any UI cleanup.
- [ ] Capture matched Create-page cold mobile measurements on live-baseline source and the final candidate, separating image, CSS, JavaScript, font, server response, and render delay. Optimize only measured bottlenecks and preserve Moonlight/VinTarot appearance.
- [ ] Recheck duplicate CSS and unused code/dependencies/assets against the merged live source. Remove only proven dead material; do not edit financial logic or historical migrations.
- [ ] Run the full regression suite, TypeScript, build, lint, and focused spread checks; record baseline and final transfer/LCP measurements and document any existing lint findings.
- [ ] Before deployment, recheck production pointer, active deployment lock, concurrent worker state, free-space policy, and rollback references; create a fresh backup and verify exact restore readiness.
- [ ] Deploy only a fully verified candidate under the release manager, retain current plus two known-good rollback releases and all protected backups, and run production browser QA for Login, Tarot, Credit, Affiliate, and public sharing without real payments, AI generation, or customer-data mutations.
- [ ] Update the audit report and `docs/PROJECT_STATE.md`, inspect the staged diff for secrets, commit only related changes, and push the audit branch.

---
