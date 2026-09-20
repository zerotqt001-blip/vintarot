# NaTarot Credits + VIP Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the approved member-first credits, usage authorization, package, VIP entitlement, and order foundations without changing Tarot semantics or trusting client-controlled commercial values.

**Architecture:** Use an append-only credit ledger with source-aware grant lots, deterministic earliest-expiry allocation, and idempotent server-side reservations. Keep package versions, orders, payments, entitlements, usage, and readings separate; fulfill only from verified payment events. Materialized account balances are rebuildable projections, not financial truth.

**Tech Stack:** React/Vinext TypeScript application, Drizzle ORM, Cloudflare D1-compatible SQL, Node 22 `node:sqlite`, existing member session ownership, and Node test runner through `tsx`.

**Spec:** `docs/superpowers/specs/2026-09-21-credits-vip-architecture.md`

## Global Constraints

- Paid credits attach to trusted member identities derived by the existing session boundary; arbitrary client account IDs are never accepted.
- Guest paid credits and guest-to-member migration remain disabled until separately approved; guest free usage remains separately auditable.
- Ledger entries and commercial evidence are append-only or compensating; no direct mutable balance is authoritative.
- `RESERVED → CONSUMED` occurs only after a validated owner-scoped reading is persisted; known failures release the hold.
- Every financial or usage command has a stable, scoped idempotency key and safe request fingerprint validation.
- Package prices, discounts, credit quantities, VIP duration, and benefits are server-authoritative and versioned.
- D1/SQLite operations use atomic transactions or guarded SQL; no PostgreSQL row-lock assumptions and no check-then-write split.
- No Tarot prompt, provider, parser, Room, authentication, guest-cookie, or saved-reading semantics change as part of billing work.
- No SePay, affiliate, payout, production deployment, or merge is included until its milestone is explicitly authorized.
- Resolve the human decision register in the spec before activating a policy-dependent behavior.
- Run tests first for every new behavior; do not write production code before its failing test exists.

## Current mission boundary

This plan is implementation-ready future work. It is not executed by the architecture mission that created it. M1A is intentionally not started, and the current branch must contain documentation only.

## File map for future implementation

- `db/schema.ts`: future Drizzle declarations for the approved commercial tables, without altering existing Tarot table semantics.
- `drizzle/0005_credits_vip.sql`: future forward-only migration after data-mission approval.
- `lib/credits/types.ts`: unit, source, ledger, grant, reservation, and transition types.
- `lib/credits/allocation.ts`: pure deterministic lot eligibility and allocation rules.
- `lib/credits/ledger.ts`: pure validation for append-only postings and compensating entries.
- `lib/credits/repository.ts`: D1/SQLite persistence and transaction boundaries.
- `lib/credits/usage.ts`: reserve, consume, release, reconciliation, and idempotency orchestration.
- `lib/packages/types.ts`: package/version/order snapshot contracts.
- `lib/packages/catalog.ts`: server-authoritative active version resolution.
- `lib/entitlements.ts`: time-bound VIP/capability entitlement lifecycle.
- `lib/orders.ts`: payment-neutral order state and idempotent fulfillment boundary.
- `app/api/billing/balance/route.ts`: future authenticated balance projection.
- `app/api/billing/history/route.ts`: future authenticated ledger/usage projection.
- `app/api/packages/route.ts`: future catalog projection.
- `app/api/orders/route.ts`: future server-created pending order boundary.
- `app/api/orders/[id]/route.ts`: future owner-scoped order projection.
- `tests/credits-allocation.test.ts`, `tests/credits-ledger.test.ts`, `tests/credits-usage.test.ts`: pure and persistence behavior.
- `tests/credits-concurrency.test.ts`: two-request balance=1 invariant across the supported adapters.
- `tests/package-versioning.test.ts`, `tests/entitlements.test.ts`, `tests/orders.test.ts`: M2 contract behavior.

### Task 1: M1A commercial schema and migration

**Files:**
- Modify: `db/schema.ts`
- Create: `drizzle/0005_credits_vip.sql`
- Create: `tests/credits-migration.test.ts`
- Modify: `tests/node-migrate.test.ts`
- Modify: `tests/sqlite-d1.test.ts`

**Interfaces:**
- Consumes: existing member IDs, D1-compatible SQL, current migration runner.
- Produces: `credit_accounts`, `credit_grants`, `credit_ledger`, `credit_reservations`, and `credit_reservation_allocations` with the constraints from the spec.

- [ ] **Step 1: Write failing schema invariant tests** for positive units, owner namespace uniqueness, grant idempotency, reservation idempotency, allocation uniqueness, and foreign-key preservation.
- [ ] **Step 2: Run the focused migration tests and verify they fail** because the commercial tables do not exist.
- [ ] **Step 3: Add the smallest Drizzle declarations and forward-only SQL migration** without changing existing tables or migration order.
- [ ] **Step 4: Run migration and SQLite adapter tests** and verify the invariants pass on an isolated database.
- [ ] **Step 5: Inspect the diff for existing-table changes, destructive SQL, or secret-like literals.**

### Task 2: Pure grant allocation and ledger rules

**Files:**
- Create: `lib/credits/types.ts`
- Create: `lib/credits/allocation.ts`
- Create: `lib/credits/ledger.ts`
- Create: `tests/credits-allocation.test.ts`
- Create: `tests/credits-ledger.test.ts`

**Interfaces:**
- Consumes: grant lots, posted ledger entries, active reservation allocations, current time, and typed usage costs.
- Produces: deterministic eligible-lot allocation, remaining-unit calculation, valid state transitions, and compensating-entry validation.

- [ ] **Step 1: Write failing tests** for earliest-expiry-first allocation, non-expiring fallback, deterministic ties, expired-lot exclusion, partial multi-lot allocation, and insufficient units.
- [ ] **Step 2: Write failing ledger tests** for immutable posted entries, positive/negative unit rules, reversal linkage, and duplicate idempotency keys.
- [ ] **Step 3: Run the tests and confirm feature-missing failures.**
- [ ] **Step 4: Implement the smallest pure functions** with no runtime/database imports.
- [ ] **Step 5: Run focused tests, then refactor only while green.**

### Task 3: Transactional grant and reservation repository

**Files:**
- Create: `lib/credits/repository.ts`
- Create: `lib/credits/usage.ts`
- Create: `tests/credits-usage.test.ts`
- Create: `tests/credits-concurrency.test.ts`

**Interfaces:**
- Consumes: trusted member owner, typed usage request, idempotency key, `D1Database`, and the pure allocation/ledger helpers.
- Produces: `grantCredits`, `reserveUsage`, `consumeReservation`, `releaseReservation`, `expireGrant`, and `reconcileReservation`.

- [ ] **Step 1: Write failing usage tests** for first reservation, insufficient credit, same-key retry, key fingerprint mismatch, consume-after-persistence, release-on-failure, and illegal consume/release transitions.
- [ ] **Step 2: Write the failing concurrency test** with one eligible unit and two concurrent reservation attempts.
- [ ] **Step 3: Run focused tests and verify they fail** for the missing repository operations.
- [ ] **Step 4: Implement one atomic transaction boundary per command** using guarded account/lot claims and the existing D1/SQLite adapter capabilities.
- [ ] **Step 5: Add bounded transient-write retry** that reuses the same idempotency key and never repeats a financial effect.
- [ ] **Step 6: Run usage and concurrency tests on both the Node SQLite fixture and the D1-shaped fixture.**

### Task 4: Member billing projections

**Files:**
- Create: `app/api/billing/balance/route.ts`
- Create: `app/api/billing/history/route.ts`
- Create: `tests/billing-projections.test.ts`

**Interfaces:**
- Consumes: `RequestIdentity`, owner-scoped credit repository projections, and existing `boundary`/origin conventions.
- Produces: safe authenticated balance/history responses without exposing raw secrets, other owners, or guest paid state.

- [ ] **Step 1: Write failing route tests** for authenticated member access, guest denial of paid balance, cross-account isolation, and safe response shape.
- [ ] **Step 2: Run the tests and verify the routes are absent or fail the expected contract.**
- [ ] **Step 3: Implement projections only; keep all financial writes in domain operations.**
- [ ] **Step 4: Run focused ownership/security tests and the existing identity matrix.**

### Task 5: Usage authorization seam for Tarot

**Files:**
- Modify: `lib/tarot-reading-service.ts` or a narrowly scoped wrapper approved by the Tarot/ownership mission
- Modify: `app/api/tarot/reading/route.ts` only if the integration owner approves the hard-lock unlock
- Create: `tests/tarot-credit-authorization.test.ts`

**Interfaces:**
- Consumes: trusted owner, owned session ID, existing reading service, and `reserveUsage`/`consumeReservation`/`releaseReservation`.
- Produces: one idempotent initial-reading usage effect tied to the persisted reading.

- [ ] **Step 1: Write failing integration tests** for owner mismatch, duplicate initial-reading retry, provider failure release, persisted-reading consume, and unknown-outcome reconciliation.
- [ ] **Step 2: Run the tests and verify the current no-billing behavior fails the new authorized contract.**
- [ ] **Step 3: Obtain the separate Tarot/data/security mission unlock** before changing the protected route/service.
- [ ] **Step 4: Add the smallest orchestration wrapper** around the existing service; do not change prompts, provider parsing, card semantics, or Room behavior.
- [ ] **Step 5: Run the full Tarot and ownership regression matrix.**

### Task 6: Package catalog and immutable versions

**Files:**
- Modify: `db/schema.ts`
- Create: migration after the M1/M2 data review
- Create: `lib/packages/types.ts`
- Create: `lib/packages/catalog.ts`
- Create: `app/api/packages/route.ts`
- Create: `tests/package-versioning.test.ts`

**Interfaces:**
- Consumes: active catalog records and server time.
- Produces: immutable package-version resolution and a safe catalog projection.

- [ ] **Step 1: Write failing tests** proving the active version is server-selected and old snapshots remain unchanged after a new version is published.
- [ ] **Step 2: Run the tests and confirm no catalog implementation exists.**
- [ ] **Step 3: Implement versioned catalog resolution** with integer money units, explicit currency, benefit snapshot, validity policy, and status windows.
- [ ] **Step 4: Run focused catalog and migration tests.**

### Task 7: VIP and capability entitlements

**Files:**
- Create: `lib/entitlements.ts`
- Create: `tests/entitlements.test.ts`
- Modify: `lib/credits/usage.ts` only when a selected benefit grants credits

**Interfaces:**
- Consumes: fulfilled order/package snapshot and approved entitlement policy.
- Produces: time-bound `PENDING`, `ACTIVE`, `EXPIRED`, and policy-authorized `CANCELLED` transitions with idempotent periodic grant keys.

- [ ] **Step 1: Write failing lifecycle tests** for activation, expiry, cancellation, benefit-version snapshot, duplicate activation, and period-grant idempotency.
- [ ] **Step 2: Run focused tests and verify the missing entitlement behavior.**
- [ ] **Step 3: Implement capability entitlements without adding `member.isVip`.**
- [ ] **Step 4: Run entitlement and credit-grant regression tests.**

### Task 8: Payment-neutral orders and fulfillment boundary

**Files:**
- Create: `lib/orders.ts`
- Create: `app/api/orders/route.ts`
- Create: `app/api/orders/[id]/route.ts`
- Create: `tests/orders.test.ts`

**Interfaces:**
- Consumes: authenticated member, package version, immutable order snapshot, and verified payment result supplied by a future adapter.
- Produces: pending order creation, owner-scoped status, and idempotent `fulfillOrder` without a payment provider.

- [ ] **Step 1: Write failing tests** for server-authoritative price, order snapshot immutability, owner isolation, duplicate order idempotency, and one-time fulfillment.
- [ ] **Step 2: Run tests and verify missing order behavior.**
- [ ] **Step 3: Implement payment-neutral order state and fulfillment transactions.**
- [ ] **Step 4: Run order, entitlement, grant, and ledger tests together.**

### Task 9: SePay integration

**Files:**
- Create: provider-specific payment adapter and verification tests after the provider contract is approved.
- Modify: payment/order boundary only after credentials, secrets handling, and migration/deployment plans are approved.

**Interfaces:**
- Consumes: provider-verified event/reference, expected order, amount, currency, and server-side secret configuration.
- Produces: one `PAYMENT_CONFIRMED` event and one idempotent fulfillment result.

- [ ] **Step 1: Write failing signature/reference/amount/currency/replay tests** from the approved provider contract.
- [ ] **Step 2: Implement verification without trusting browser success.**
- [ ] **Step 3: Run duplicate webhook and fulfillment tests.**
- [ ] **Step 4: Perform a separate deployment/secrets review before any production enablement.**

### Task 10: Affiliate attribution, commissions, and administration

**Files:**
- Create: future event consumer and commission ledger modules.
- Create: attribution, refund reversal, tier, dashboard, payout, and admin tests.

**Interfaces:**
- Consumes: verified `ORDER_FULFILLED`/refund events and approved attribution policy.
- Produces: conversion and commission records that never mutate credit accounting directly.

- [ ] **Step 1: Write failing event, attribution-window, 30%-tier, refund-clawback, and payout-audit tests.**
- [ ] **Step 2: Implement commission records as a separate ledger.**
- [ ] **Step 3: Verify duplicate events and refund reversals are idempotent.**
- [ ] **Step 4: Run privacy, admin-audit, and margin-scenario checks before release.**

## Future validation matrix

### Focused checks per milestone

- Pure credit tests: allocation order, lot expiry, ledger posting, reversals, and idempotency.
- Persistence tests: migration, foreign keys, unique constraints, rebuildable balance, and owner isolation.
- Concurrency tests: two writers against one unit, transient retry, and same-key replay.
- Reading integration tests: provider failure release, validated persistence consume, duplicate request reconciliation, and unchanged AI payload contract.
- Commerce tests: package-version snapshots, server price authority, order/fulfillment idempotency, payment-event replay, refund reversal, and future affiliate event boundaries.

### Mission-level checks before any future completion claim

- `npx tsx --test tests/*.test.ts`
- `npx tsc --noEmit`
- `npm run build`
- `npm run lint` with baseline debt separated from mission-attributed findings
- `git diff --check`
- secret-like literal scan over tracked changed files and generated artifacts
- protected-zone path/diff audit
- isolated D1/SQLite concurrency evidence

No implementation milestone is complete from a passing unit test alone. Migration safety, ownership, idempotency, and production topology require their corresponding evidence.
