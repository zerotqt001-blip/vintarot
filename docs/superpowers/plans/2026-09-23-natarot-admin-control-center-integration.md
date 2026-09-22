# NaTarot Admin Control Center V1 Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrate Admin Control Center V1 commit `d9e2a6e` onto production commit `9216d4597bc0b4faa9d0cbf0bf60f65c27b0308f`, preserve Product Activation, and deploy only after verified backup, release and fresh production checks.

**Architecture:** Start from the production commit and merge the exact Admin commit as an overlay. Preserve Admin read models/RBAC/UI and adapt the shared Credits repository so audited Admin mutations participate in the canonical ledger transaction while commercial grant, reservation, FIFO/expiration, consume/release/refund and rebuild semantics remain unchanged. Use the existing authenticated member/RBAC, VIP entitlement, order/payment, affiliate, audit and backup/deployment boundaries.

**Tech Stack:** React 19, TypeScript, Vinext/Vite, Cloudflare D1-compatible SQL, Node `node:test`/`tsx`, SQLite D1 adapter, Zod, existing VPS systemd/Nginx release tooling and browser verification at `https://natarot.com`.

**Spec:** `docs/superpowers/specs/2026-09-23-natarot-admin-control-center-integration-design.md`

## Global Constraints

- Current production is the only integration base: `9216d4597bc0b4faa9d0cbf0bf60f65c27b0308f`.
- Admin source input is only commit `d9e2a6e`; do not copy uncommitted files from the Admin worker worktree.
- Preserve every Product Activation feature named in the mission, including package price `1 Credit = 15,000 VND`, checkout/order/SePay architecture, Credits/VIP, Affiliate, OAuth, DeepSeek, Auto Topic, Manual Topic, history and Share/QR.
- Do not create or reset the existing owner QA account and do not expose credentials.
- VIP grants use canonical entitlement mechanisms and never grant Admin authorization or invent commercial pricing.
- Admin financial mutations require server RBAC, bounded reasons, idempotency, canonical ledger/entitlement operations and auditability; never write balances directly.
- Do not copy staging SePay credentials or commit secrets; retain `SEPAY_PRODUCTION_CREDENTIAL_GATE` and `RESEND_EXTERNAL_GATE` as explicit external gates.
- Do not start global UI redesign; functional Admin must remain usable at desktop and 390px.

---

### Task 1: Create the production-based integration branch and baseline contract

**Files:**
- Create: `tests/admin-integration-credits.test.ts`
- Create: `docs/superpowers/specs/2026-09-23-natarot-admin-control-center-integration-design.md`
- Create: `docs/superpowers/plans/2026-09-23-natarot-admin-control-center-integration.md`

**Interfaces:**
- Consumes: production commit `9216d4597bc0b4faa9d0cbf0bf60f65c27b0308f`, existing `createCreditStore`, `AuditAppendInput` and migration fixture.
- Produces: an isolated `codex/natarot-admin-control-center-integration` branch, a red integration contract and the committed design/plan used for execution.

- [x] Create the managed worktree from the exact production commit and switch it to the named integration branch.
- [x] Install locked dependencies with `npm ci` and run the clean production-base suite.
- [x] Write the failing audited-credit integration test before changing production code. It covers positive and negative signed adjustments, idempotent replay, one audit row per mutation and projection rebuild.
- [x] Run `npx tsx --test tests/admin-integration-credits.test.ts` and verify it fails because the existing Credit store ignores the audit payload.
- [x] Commit the design, plan and red contract test as a planning checkpoint.

### Task 2: Merge the exact Admin source and establish Admin regression coverage

**Files:**
- Merge from `d9e2a6e`: `app/admin/admin-console.tsx`
- Merge from `d9e2a6e`: `app/api/admin/**/*.ts`
- Merge from `d9e2a6e`: `lib/admin/**/*.ts`
- Merge from `d9e2a6e`: `tests/admin-control-center.test.ts`
- Merge from `d9e2a6e`: `tests/admin-functional-ui.test.ts`
- Merge from `d9e2a6e`: `tests/admin-rbac.test.ts`
- Merge from `d9e2a6e`: `tests/admin-route-contract.test.ts`
- Review: `docs/superpowers/plans/2026-09-23-natarot-admin-control-center-v1.md`

**Interfaces:**
- Consumes: the production-base branch and the committed Admin branch.
- Produces: the Admin dashboard/users/detail/Credits/VIP/orders/affiliate/readings/audit routes and UI with server-side RBAC, masked projections and canonical service calls.

- [x] Merge `codex/natarot-admin-control-center-v1` with the exact commit `d9e2a6e`; stop if Git selects files outside the named Admin diff or if uncommitted worker files appear.
- [x] Run the focused Admin tests and record every failure before fixing it.
- [x] Run the existing Credits, entitlement, audit, orders, affiliate, owner-QA and RBAC suites to identify integration regressions.
- [x] Confirm no package catalog, checkout, SePay production, account deployment or unrelated UI files entered the diff.

### Task 3: Resolve the shared Credits/audit boundary with TDD

**Files:**
- Modify: `lib/credits/repository.ts`
- Modify: `lib/audit/service.ts`
- Modify: `lib/entitlements.ts`
- Modify: `lib/admin/actions.ts`
- Modify: `app/api/admin/credits/route.ts`
- Test: `tests/admin-integration-credits.test.ts`
- Test: `tests/admin-control-center.test.ts`
- Test: `tests/credits-repository.test.ts`

**Interfaces:**
- Consumes: `AuditAppendInput`, `prepareAuditInsert`, `createCreditStore`, Admin actor/member resolution and existing D1 batch semantics.
- Produces: optional audited `grantCredits`/`adjustCredits`/`consumeReservation` inputs, an atomic audit insert helper, and replay-safe Admin credit commands.

- [x] Add a failing trigger-backed test showing that a required audit insert failure leaves no Admin ledger mutation, entitlement/credit projection change or orphaned audit row.
- [x] Add a failing trigger-backed VIP test showing that grant and revoke cannot leave an entitlement change without its required audit row.
- [x] Add or refine a failing test showing idempotency-key reuse with changed units/reason is rejected without altering the owner balance.
- [x] Implement the smallest shared audit boundary: validate and prepare the audit insert once, include it in the same batch as positive grants and negative consume events, and retain current commercial SQL and eligibility/FIFO/rebuild behavior.
- [x] Route Admin VIP grant/revoke through the same batch-safe audit boundary while preserving the canonical entitlement model and `sourceType: ADMIN`.
- [x] Implement replay detection in the Admin action using the owner-scoped audit key plus units/reason and the matching grant/reservation row, then return the original result without a second audit or ledger row.
- [x] Run the red/green tests after each mutation, then run the focused Credits/replay/Admin/audit suites.
- [x] Inspect SQL owner predicates and verify the UI/route never accepts a client-supplied owner object.

### Task 4: Verify the complete local closed loop

**Files:**
- Modify: `docs/PROJECT_STATE.md`
- Review: all changed source/test/docs files

**Interfaces:**
- Consumes: the integrated branch and its test/build artifacts.
- Produces: a verified integration commit with an evidence-backed state checkpoint and no secret/path leakage.

- [ ] Run Admin focused, RBAC, Credits, replay, VIP, orders, affiliate, readings, audit, owner-QA and Product Activation regression tests.
- [ ] Run the full `npx tsx --test tests/*.test.ts` suite and record exact pass/total/fail counts.
- [ ] Run `npx tsc --noEmit`, `npm run build`, targeted ESLint for every changed TS/TSX file, dependency audit and `git diff --check`.
- [ ] Scan the staged diff and release inputs for secrets, raw PII, payment shortcuts, untracked files and unintended commercial/deployment changes.
- [ ] Update `docs/PROJECT_STATE.md` with the exact branch/base/Admin commit, conflict resolution, validation evidence and remaining external gates.
- [ ] Commit only related integration source/tests/state/docs with a clear message; inspect the staged diff before committing.

### Task 5: Push, back up, deploy and verify fresh production

**Files:**
- Review: existing backup/deployment scripts and production release configuration
- Modify only: authorized remote release/backup/service state through the existing deployment workflow

**Interfaces:**
- Consumes: the verified integration commit and existing saved VPS access.
- Produces: remote branch equality, a checksum-verified fresh backup and restore verification, retained rollback release, deployed production release and fresh browser evidence.

- [ ] Push the integration branch and verify local/remote commit equality.
- [ ] Record the current production release, create a fresh production backup, verify its checksum, run restore verification and confirm the rollback release is retained; stop deployment if any check fails.
- [ ] Build/package the exact integrated commit using tracked release inputs and deploy it through the active production service workflow without copying secrets.
- [ ] Verify service health, release identity and representative public APIs after restart; do not treat HTTP 200 alone as proof of the correct release.
- [ ] In a fresh browser context verify Home, Account, Nạp Credit, packages, `1 Credit = 15,000 VND`, orders, checkout, Affiliate, Tarot, DeepSeek, Auto Topic, Manual Topic, Reading History and Share/QR.
- [ ] Verify Admin dashboard, Users, existing owner QA account inspection, Credit Admin, minimal reversible audited Credit adjustment/replay, VIP Admin, Orders/Payments, Affiliate Admin, Readings, Audit, unauthenticated denial, ordinary-user denial and authorized Admin access at desktop and 390px.
- [ ] Record `SEPAY_PRODUCTION_CREDENTIAL_GATE` and `RESEND_EXTERNAL_GATE` as remaining external gates when applicable; never fake either provider.
- [ ] Append the final project-state deployment evidence and produce the requested final report with integration commit, production commit, conflicts, gates and readiness status.
