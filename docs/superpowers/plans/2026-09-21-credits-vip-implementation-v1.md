# NaTarot Credits / VIP Implementation V1 Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver production-grade, payment-independent member Credits/VIP code readiness with append-only accounting, idempotent usage charging and a minimal verification surface.

**Architecture:** Add one forward-only commercial migration and a small domain layer over the existing D1-compatible database. The ledger remains the accounting source; source-aware lot projections and an account mutation marker make deterministic reservation and SQLite/D1 concurrency safe. Packages, orders, entitlements and fulfillment remain separate and emit only a narrow future event boundary.

**Tech Stack:** React 19 + TypeScript, Drizzle declarations, Cloudflare D1-compatible SQL, Node 22 `node:sqlite`, existing member-session identity and `tsx` Node tests.

**Spec:** `docs/superpowers/specs/2026-09-21-credits-vip-implementation-v1.md`

## Global Constraints

- Use branch `codex/natarot-credits-vip-v1`, based on `codex/natarot-integration-v1` at `f5452a35d7b4bbc9884e52d0890c4f5e9c39e9fe`.
- Do not merge or wholesale copy `codex/natarot-credits-vip-foundation`; use its architecture documents as reference only.
- Add `drizzle/0006_credits_vip.sql`; never renumber `0004_*` or `0005_*` migrations.
- Paid credit identity is a server-derived member ID. Guests keep their existing free Tarot behavior and cannot create paid orders.
- Ledger entries are append-only and compensating; no mutable member balance is authoritative.
- `RESERVED → CONSUMED` happens only after an owner-scoped validated reading is persisted. Known failures release the hold.
- All financial/usage/fulfillment commands are idempotent and fingerprint-checked.
- No SePay, webhook/IPN, VietQR, payment credentials, affiliate accounting, admin/RBAC, production migration, staging change or deployment.
- Do not change Tarot prompts, provider semantics, Knowledge Base, spread semantics, Share behavior or existing auth/guest-cookie behavior.
- Apply TDD: each new behavior has a failing test observed before production code.

## File Map

- Create `drizzle/0006_credits_vip.sql`: commercial tables and constraints.
- Modify `db/schema.ts`: Drizzle declarations matching the migration.
- Create `lib/credits/types.ts`, `allocation.ts`, `ledger.ts`, `repository.ts`, `usage.ts`: accounting contracts, pure rules and D1/SQLite operations.
- Create `lib/packages/types.ts`, `lib/packages/catalog.ts`, `lib/entitlements.ts`, `lib/orders.ts`: package snapshots, VIP lifecycle and payment-neutral order/fulfillment boundary.
- Create `app/api/billing/balance/route.ts`, `app/api/billing/history/route.ts`, `app/api/packages/route.ts`, `app/api/orders/route.ts`, `app/api/orders/[id]/route.ts`: minimum owner-scoped projections and pending-order boundary.
- Create `lib/tarot-credit-authorization.ts`: member-only reserve/consume/release/reconcile wrapper.
- Modify `app/api/tarot/reading/route.ts` and `lib/tarot-reading-route.ts`: wire the wrapper and safe billing errors without changing AI behavior.
- Modify `lib/tarot-reading-service.ts`: expose persisted-reading hydration needed for idempotent retries, preserving provider/prompt contracts.
- Modify `app/pages.tsx`, `lib/i18n.ts`, and focused UI tests: minimal Profile Credits/VIP status card.
- Create focused tests under `tests/credits-*.test.ts`, `tests/package-versioning.test.ts`, `tests/entitlements.test.ts`, `tests/orders.test.ts`, `tests/billing-projections.test.ts`, `tests/tarot-credit-authorization.test.ts`, and migration additions.
- Modify `docs/PROJECT_STATE.md` only at the end with verified implementation evidence and explicit non-deployment state.

### Task 1: Migration and schema

**Files:** migration, Drizzle schema, migration/adapter tests.

- [ ] Write failing migration tests for fresh bootstrap, existing `0000`–`0005` upgrade, foreign keys, check constraints, unique grant/reservation/order/fulfillment keys and indexes.
- [ ] Run focused migration tests and observe missing-table failures.
- [ ] Add `0006_credits_vip.sql` with accounts, grants, ledger, reservations, allocations, packages, package_versions, orders, entitlements, order_fulfillments and commercial_events.
- [ ] Add matching Drizzle declarations without changing existing Tarot/auth/share declarations.
- [ ] Run fresh and upgrade migration tests, then `git diff --check`.

### Task 2: Pure accounting rules

**Files:** `lib/credits/types.ts`, `allocation.ts`, `ledger.ts` and focused tests.

- [ ] Write failing tests for expiry filtering, earliest-expiring-first allocation, stable tie-breaks, partial multi-lot allocation, insufficient units and non-mutating input.
- [ ] Write failing ledger tests for event sign rules, immutable posting shape, reversal linkage and duplicate fingerprint conflicts.
- [ ] Run tests and confirm feature-missing failures.
- [ ] Implement only pure functions and typed errors; no database/runtime imports.
- [ ] Run focused tests green and refactor without adding behavior.

### Task 3: Transactional credits repository

**Files:** `lib/credits/repository.ts`, `usage.ts` and credit persistence/concurrency tests.

- [ ] Write failing tests for grant idempotency, duplicate-key fingerprint rejection, balance, expired exclusion, refund, adjustment, explicit expiration, reserve/consume/release transitions and retry after release.
- [ ] Write the one-credit/two-concurrent-reservations test against the real SQLite D1 adapter; assert one `RESERVED`, no two successful consumes and no negative projection.
- [ ] Implement account creation, grant/ledger batch writes, guarded lot reservation with mutation marker, exact allocation rows, consume ledger debits, release restoration, expiration and reconciliation.
- [ ] Add rebuildable lot-projection verification and owner-scoped balance/history queries.
- [ ] Run focused credits and adapter tests on fresh isolated databases.

### Task 4: Packages, VIP and fulfillment boundary

**Files:** package/catalog, entitlements, orders modules and focused tests.

- [ ] Write failing tests for server-selected package versions, immutable order snapshots, time-bound VIP active/expired/cancelled states, periodic grant-key idempotency, owner isolation and duplicate fulfillment.
- [ ] Implement active catalog resolution with integer minor units and no price constants.
- [ ] Implement pending order creation, internal verified-payment transition, one-transaction fulfillment, credit/VIP grants and `ORDER_FULFILLED` event emission.
- [ ] Run package/entitlement/order/grant/ledger tests together.

### Task 5: Member APIs and minimum Profile surface

**Files:** API routes, UI component/strings and API/UI tests.

- [ ] Write failing tests for authenticated balance/history, guest denial, IDOR rejection, safe package projection, pending order creation and owner-scoped order lookup.
- [ ] Implement origin/no-store/auth boundaries; never expose raw ledger metadata, PII duplication or payment secrets.
- [ ] Add a restrained Profile Credits/VIP status card using the existing visual shell; do not redesign Home/Room/Auth or add checkout/pricing UI.
- [ ] Run focused API/UI tests and relevant lint.

### Task 6: Tarot charging seam

**Files:** authorization wrapper, route/service helper, route tests.

- [ ] Write failing tests for member insufficient credit, owner mismatch, successful reserve/consume, provider failure release, persistence failure release, duplicate request, retry after release, two-tab in-progress behavior and persisted-reading reconciliation.
- [ ] Add persisted-reading hydration only as a compatibility helper; preserve the existing prompt/provider/payload contract.
- [ ] Wire members through the wrapper and guests through the unchanged free path; map billing errors to safe `402/409/503` responses.
- [ ] Run the focused authorization suite plus the complete existing Tarot/auth/share matrix.

### Task 7: Full verification and handoff

- [ ] Run fresh/upgrade migration checks and inspect all schema constraints/indexes.
- [ ] Run focused tests, then `npx tsx --test tests/*.test.ts` and record exact totals.
- [ ] Run `npx tsc --noEmit`, `npm run build`, relevant ESLint, `git diff --check`, changed-file secret scan and protected-zone diff audit.
- [ ] Fix every in-scope failure and rerun the affected checks until clean; do not weaken tests.
- [ ] Inspect staged diff for secrets/unrelated files, update `docs/PROJECT_STATE.md`, commit with `feat: add credits and VIP foundation`, push `codex/natarot-credits-vip-v1`, and verify local HEAD equals remote HEAD.
- [ ] Report production/staging/SePay/affiliate state explicitly and stop.

## Completion Evidence

The final report must include exact branch/commit/remote equality, tables/constraints/transactions, API/UI contracts, accounting and Tarot semantics, security/IDOR/spoofing tests, focused/full/typecheck/build/lint/migration/concurrency/secret/diff results, protected-zone status, `DEPLOYED: NO`, `PRODUCTION DB CHANGED: NO`, `STAGING MODIFIED: NO`, `SePay IMPLEMENTED: NO`, `Affiliate IMPLEMENTED: NO`, limitations/blockers and the next milestone without executing it.
