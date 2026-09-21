# NaTarot Credits / VIP Implementation V1

Status: approved implementation specification

Date: 2026-09-21

## Goal

Implement the payment-independent Credits/VIP foundation on top of the Integration V1 branch so member credit usage is auditable, idempotent, concurrency-safe and ready for a later verified-payment adapter. Guest Tarot usage, existing identity boundaries, Tarot semantics and Share behavior remain unchanged.

## Decisions

- Migration `0006_credits_vip.sql` is the next migration. Historical `0004_*` and `0005_*` files are not renamed or reordered.
- A trusted member account is keyed by the existing internal member ID. No credit/order/entitlement row copies email, phone, display name or OAuth data.
- Credit value is integer `reading_credit` units. Grants/lots carry source, eligibility window, policy snapshot and an idempotent grant key.
- `credit_ledger` is append-only. Corrections are new compensating rows; the mutable lot `available_units` field is only a rebuildable projection used for guarded allocation.
- Reservation allocation is earliest-expiring-first, then non-expiring, creation time and grant ID. Expired lots are never spendable even when their projection has not yet been swept.
- A member's initial Tarot interpretation reserves one server-derived unit using `initial_reading:<sessionId>`. The reservation is consumed only after the existing service persists a validated reading. Provider, validation and persistence failures release the hold; a persisted result is reconciled before release.
- Guest requests bypass paid reservation and continue through the existing free path. No paid credit or order may be attached to a guest bearer cookie.
- A duplicate member request returns the owned persisted reading or an in-progress response; it never invokes the provider twice for the same initial-reading key.
- VIP is an auditable time-bound entitlement with start/end, state, benefit version and grant key. There is no `member.is_vip` boolean.
- Package versions are server-authored immutable snapshots. Orders copy the snapshot. `recordVerifiedPayment` and `fulfillOrder` are internal payment-neutral boundaries; no SePay, webhook/IPN, VietQR, credential or real payment call is added.
- Fulfillment is idempotent through order, fulfillment, grant, entitlement and event keys. `ORDER_FULFILLED` is the future affiliate boundary; no affiliate code is implemented.

## Domain surface

The implementation adds:

- M1 tables for accounts, grants, append-only ledger, reservations and lot allocations.
- M2 tables for packages, immutable package versions, orders, entitlements and fulfillment/event idempotency.
- Pure allocation and ledger validators.
- D1/SQLite repository operations: grant, reserve, consume, release, refund, adjustment, expiration, balance, history and reconciliation.
- Authenticated member projections for balance/history, a safe package projection and owner-scoped pending-order projection.
- A minimal profile card showing spendable/held units and derived VIP expiry.

The implementation does not add admin/RBAC, guest-to-member migration, pricing policy, payment verification, affiliate attribution, a commercial checkout, final billing UI or deployment.

## Transaction and security contract

Every write command is a single D1 batch/SQLite transaction. A per-account mutation marker and conditional eligible-lot aggregate guard prevent a one-credit account from reserving twice. Lot allocation is computed in the transaction; incomplete allocation rolls back its projection changes and removes the pending reservation. Node SQLite uses the existing serialized `BEGIN IMMEDIATE` adapter; the concurrency suite exercises two concurrent requests against it.

Member APIs derive the account only from `readOptionalOwner()` and the trusted session member row. Guest, spoofed account IDs, cross-owner order IDs, client amounts, client credit quantities and client VIP duration are rejected or ignored. No client can invoke adjustment, grant, fulfillment or payment-confirmation operations through a route.

## Tarot contract

The route validates origin and resolves the existing owner first. Guests call the existing `generateTarotReading`. Members use the authorization wrapper:

```text
trusted member + owned session
→ return/reconcile an existing owned reading when present
→ reserve one reading_credit with a server-derived key
→ existing Tarot provider/validation/persistence path
→ consume the reservation
```

Known failures release the reservation. If a request disconnects after persistence, a retry sees the stored reading and consumes the outstanding reservation instead of generating again.

## Verification contract

Focused tests cover schema/migration, allocation, ledger invariants, grants, expiry, reservation transitions, duplicate keys, refund/adjustment, balance/history, two-request overspend, package snapshots, VIP lifecycle, order/fulfillment replay, API ownership, Tarot charge/release/reconciliation, and the minimum UI contract. Full tracked tests, typecheck, build, relevant lint, migration upgrade/fresh-database checks, secret scan and diff-check are required before the branch is reported ready.

Production migration/deploy/service/database changes: NO. Staging infrastructure changes: NO. SePay: NO. Affiliate: NO.
