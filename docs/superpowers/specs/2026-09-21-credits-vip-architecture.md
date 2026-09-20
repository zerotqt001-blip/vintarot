# NaTarot Credits + VIP Commercial Architecture

Status: architecture and implementation-readiness specification only

Date: 2026-09-21

Verified base: `origin/codex/natarot-level4-baseline` at `ed9d60883cae92d2395961199339b06c26b3e6b6`

Branch: `codex/natarot-credits-vip-foundation`

This document deliberately does not create a database migration, activate billing, change the Tarot Engine, add payment integration, add affiliate behavior, or deploy anything.

## Executive decision

NaTarot should use an append-only credit ledger backed by source-aware credit grants/lots and server-side usage reservations. A balance may be materialized for fast display and concurrency gating, but it must be rebuildable and must not be the financial source of truth.

The first commercial identity is a trusted authenticated member account. Paid credits are not attached to the current bearer guest cookie. Guest free usage is accounted for separately, and guest-to-member migration remains a future business decision.

Packages are catalog offers. Immutable package versions provide historical commercial terms. Orders snapshot those terms. Fulfillment creates credit grants and/or time-bound entitlements. VIP is derived from active entitlements rather than a boolean member flag. Payment verification is separate from order fulfillment, and future affiliate attribution consumes verified business events rather than mutating credit accounting.

The design intentionally stops before full event sourcing. It uses ordinary transactional tables, idempotency constraints, compensating ledger entries, and a narrow future event boundary.

## Scope and invariants

### In scope

- Current-state audit grounded in the verified baseline.
- M1 credit units, grants/lots, ledger, reservations, consumption, release, expiry, reversal, and admin audit rules.
- M2 package/version, order snapshot, entitlement, and VIP rules.
- Future SePay and affiliate integration boundaries without implementation.
- D1/SQLite transaction strategy, idempotency, retry behavior, security, economics, retention, and human decisions.
- A future implementation roadmap that does not start M1A.

### Explicitly out of scope

- Any `drizzle/*.sql` or database schema change.
- Live credit deduction or billing enforcement.
- Payment, SePay, webhook, order fulfillment, payout, or affiliate code.
- Final package prices, VIP benefits, discounts, or commission policy.
- Changes to authentication, guest-cookie semantics, AI prompts/providers, Tarot reading behavior, Room interaction, deployment, or production state.

### Non-negotiable invariants

1. Money, orders, payments, packages, entitlements, credits, usage, readings, and commissions are separate concepts.
2. The client never supplies an authoritative account, price, discount, credit quantity, VIP duration, or fulfillment decision.
3. A logical operation has one stable idempotency key and one financial effect, even when the request, provider, or webhook is retried.
4. A credit is reserved before an expensive paid operation and consumed only after a validated reading is persisted.
5. A known failure releases the reservation. An unknown outcome is reconciled before the reservation is released or consumed.
6. Every balance change has a durable business reference, actor/source, timestamp, and reason.
7. Existing owner predicates remain the authorization boundary for readings and sessions.

## Current state verified

The audit was performed against the clean Level 4 baseline, not the dirty shared checkout and not the active L5–L8 worktree.

### Account and ownership

| Area | Currently implemented evidence | Commercial implication |
| --- | --- | --- |
| Member account | `drizzle/0004_member_auth.sql` creates `members`, `auth_sessions`, `auth_tokens`, and OAuth state tables. `lib/member-auth.ts` resolves an authenticated member from the session cookie. | A future paid account can use the trusted member ID. |
| Request identity | `lib/request-identity.ts` maps a valid member session to the stable owner key `member:<member.id>`. | Future billing must use this server-derived identity, never a client user ID. |
| Guest identity | `lib/tarot-guest.ts` reads or creates the `vintarot_guest` HttpOnly cookie and uses it as a guest owner key. | The current cookie is a bearer owner token, not a sufficient paid-financial identity. |
| Reading ownership | `reading_sessions` stores nullable `user_id` and `guest_id`; `lib/tarot-repository.ts` exposes owner-scoped session and reading lookups. | Usage authorization must preserve the same owner check before charging. |
| Saved readings | Saved reading markers are owner-scoped records and guests are rejected by the saved-reading route. | Commercial history must not bypass existing ownership or guest restrictions. |
| Existing usage limits | The baseline has no credit balance, paid usage quota, or commercial generation counter. The Tarot flow has product-specific draw bounds and a bounded provider retry, neither of which is a billing entitlement. | A future usage authorization layer must be added deliberately rather than reusing an unrelated draw or retry limit. |
| Admin capability | The baseline has no commercial admin role, credit-adjustment command, order support view, or affiliate/payout administration. | Future adjustments need a separately authorized role and an auditable command boundary. |

### Database and runtime

- `db/schema.ts` contains records, rooms, room members, Tarot catalog, reading sessions, reading cards, and readings. It contains no credit, package, order, payment, entitlement, VIP, or affiliate tables.
- `db/index.ts` creates Drizzle on the runtime D1-compatible database.
- `lib/runtime.ts` uses Cloudflare D1 in the Cloudflare topology and Node `node:sqlite` for the standalone topology. The Node path enables foreign keys, WAL, and a five-second busy timeout.
- `lib/sqlite-d1.ts` implements D1 `batch()` with serialized `BEGIN IMMEDIATE`, statement execution, `COMMIT`, and rollback on failure.
- `scripts/node-migrate.mjs` applies checked-in SQL files in lexical order. No commercial migration is added here.
- There is no current balance field, credit calculation, order repository, payment adapter, VIP state, or affiliate ledger in the verified baseline.

### Reading execution boundary

The current reading route (`app/api/tarot/reading/route.ts`) performs origin validation, reads the owner, calls `generateTarotReading`, and returns the persisted reading. `lib/tarot-reading-service.ts` validates the owner-scoped session, calls the selected provider, and saves the validated reading. It has no credit behavior today.

The future billing seam belongs around this existing service boundary:

```text
trusted request identity
→ owner/session validation
→ reserve usage
→ existing Tarot provider and validation flow
→ persist validated reading
→ consume reservation
```

That seam is documented only. The route, service, provider, prompt, parser, reading schema, and Room remain unchanged in this mission.

### Existing verification baseline

The isolated worktree was created from `ed9d608`. Before this specification was written, the baseline passed the tracked suite at `339/339`, `npx tsc --noEmit`, `npm run build`, and `git diff --check`. Those results describe the base; they are not evidence that future billing code exists.

## Domain boundaries

| Concept | Responsibility | What it must not become |
| --- | --- | --- |
| Money | Amount and currency exchanged with a payment provider. | A credit balance or a package ID. |
| Order | Customer intent to acquire a versioned offer and its commercial state. | Proof that a payment was verified or that fulfillment happened. |
| Payment | Provider-side verified money movement and provider event evidence. | A client success-page signal or an entitlement by itself. |
| Package | Stable catalog identity for an offer. | The historical price/benefits of an old order. |
| Package version | Immutable server-controlled price, credits, validity, and benefit snapshot. | A mutable current catalog row reused for history. |
| Entitlement | A granted right such as VIP access or a premium capability, with validity and source. | A consumable balance without lifecycle/audit context. |
| Credit grant/lot | A source-aware quantity of a credit unit with eligibility and expiry rules. | A package or cash amount. |
| Credit ledger | Append-only financial/value journal of grants and compensating value movements. | An event-sourcing platform or an editable balance table. |
| Credit reservation | A temporary hold for one logical usage operation. | A completed consumption or a payment. |
| Credit consumption | The durable debit caused by a successful product action. | A provider request attempt that produced no reading. |
| Usage | The product action being authorized, such as an initial reading or a future follow-up. | An arbitrary client click without a stable business key. |
| Reading | The Tarot product result and its owner-scoped persistence. | A payment record or a credit grant. |
| Affiliate conversion | A future business attribution derived from a verified commercial event. | A direct credit-account mutation. |
| Commission | A future liability recorded from a trusted conversion and policy. | A percentage accepted from the browser. |

## M1 credit architecture

### Credit unit

The initial internal unit is the integer `reading_credit`. One unit authorizes one configured usage cost of the initial Tarot reading. The credit ledger stores integer units, not VND, provider tokens, or a hard-coded selling price.

The usage contract carries a typed `usage_type` and an integer `units` value. The initial supported type is `initial_reading` with a configurable cost of one `reading_credit`. Future follow-up, supplementary draw, or premium spread types may use different costs without changing the ledger model. Their pricing and costs remain business decisions.

### Credit grants and lots

A grant/lot is the source-aware allocation container for credits entering an account. It records:

- trusted account owner;
- source (`PURCHASE`, `VIP_GRANT`, `PROMOTION`, `TRIAL`, `REFUND`, `ADMIN`, or `MIGRATION`);
- original units;
- eligible start time;
- optional expiry time;
- originating order, entitlement, adjustment, or migration reference;
- an immutable grant key for idempotency;
- creation time and policy/version snapshot.

`REFERRAL` may be reserved as a future source, but it is not active in this mission.

Remaining eligible units are derived from the grant amount minus posted consumption, expiry, and active reservation allocations. A materialized remaining value may be added for performance only if it is rebuildable from the ledger and allocations. It is never the sole authority.

### Deterministic allocation order

When reserving credits, eligible lots are allocated in this order:

1. Lots whose expiry is soonest.
2. Non-expiring lots after expiring lots.
3. Earlier `created_at` values.
4. Stable `grant_id` ascending as the final tie-breaker.

This minimizes stranded expiring value and makes retries/reconciliation deterministic. A lot that is already expired is ineligible. Expiration must be recorded as a durable compensating value event for its unused units; it must not silently disappear.

### Append-only ledger

The ledger is the durable journal of value movements. Rows are never edited or deleted to correct history. Each row contains at least:

- `ledger_entry_id`;
- trusted account ID;
- optional grant/lot ID;
- event type;
- signed integer units;
- business reference type and ID;
- idempotency key;
- actor/source;
- effective and creation timestamps;
- optional reversal link and safe metadata snapshot.

Financial event types are:

| Event | Value effect | Meaning |
| --- | ---: | --- |
| `GRANT` | Positive | New purchased, promotional, VIP, refund, admin, or migration value. |
| `CONSUME` | Negative | A successfully delivered and persisted usage result. |
| `REFUND` | Positive or policy-controlled | Value restored by an approved refund/reversal decision. |
| `EXPIRE` | Negative | Unused value becomes ineligible at its recorded expiry. |
| `ADMIN_ADJUSTMENT` | Positive or negative | An auditable support correction or grant. |
| `REVERSAL` | Opposite of a prior entry | A compensating correction linked to the original entry. |

`RESERVE` and `RELEASE` are durable reservation lifecycle events, but do not themselves change net credit value. They belong in `credit_reservations` and its allocation records so an in-flight hold cannot be confused with a debit.

Ledger entries use a minimal state model: a posted entry is immutable; a correction is a new compensating entry linked to the original. `PENDING` belongs to order/payment/reservation workflows, not to a value row that might be counted ambiguously. `REVERSED` and `EXPIRED` are represented by explicit compensating entries plus lifecycle metadata, not by mutating the original posting.

### Balance

The authoritative available balance is the result of:

```text
posted positive grants
+ posted refunds and positive adjustments
- posted consumption
- posted expirations and negative adjustments
- active reservation holds
```

The calculation is constrained by grant/lot eligibility and allocation rows. `credit_accounts` may cache `available_units`, `reserved_units`, and a version for display and concurrency gating. The cache must be rebuildable from grants, reservations, and ledger entries, and repair must be an auditable operation.

There is no `member.balance` source-of-truth field.

### Reservation lifecycle

The future state machine is:

```text
AVAILABLE
  → RESERVED
      → CONSUMED
      → RELEASED
      → EXPIRED (only after reconciliation of an abandoned hold)
```

`credit_reservations` records one logical usage request. Its minimum contract includes reservation ID, trusted account ID, `usage_type`, units, owned product reference, idempotency key, state, lease/expiry time, creation/update times, and release/consumption reason.

Reservation allocation rows connect one reservation to one or more grant lots. They preserve the exact source lots used, the held units, and the units eventually consumed or released.

#### `reserveUsage()`

The operation must atomically:

1. Resolve the trusted member identity and the owned product reference.
2. Validate the usage type and server-side unit cost.
3. Look up an existing reservation by account and idempotency key. If it exists, validate the request fingerprint and return its current state.
4. Claim sufficient eligible lots in deterministic order.
5. Create the reservation and its allocations.
6. Update any derived account hold/cache only inside the same transaction.

If there is not enough available value, no reservation or allocation is committed and the caller receives a safe insufficient-credit result.

#### `consumeReservation()`

This operation is allowed only after the Tarot Engine has returned a validated result and the reading has been persisted under the same trusted owner. It is idempotent by reservation ID and a unique consumption key. It posts one debit per allocation or one linked aggregate debit according to the future schema, marks the reservation `CONSUMED`, and updates derived caches in the same transaction.

#### `releaseReservation()`

Known provider errors, invalid responses after the bounded provider retry, validation failures, and other failures before durable reading persistence release the hold. Release marks the reservation and allocations without posting a financial debit. It is idempotent and records a safe reason/reference.

#### Timeout and user disconnect

A disconnected browser does not prove that the server-side operation failed. A request retry uses the same logical key. If the outcome is unknown, the reservation remains `RESERVED` while reconciliation checks for the owned persisted reading. A reconciliation worker or retry path consumes when the reading exists and releases when the operation is proven not to have produced one. An abandoned reservation may expire only after that check; expiration must never be a blind timeout that destroys paid value.

### Provider failure

The chargeable point is successful validated reading persistence, not the start of a DeepSeek or other provider request.

```text
reserve
→ provider request and bounded validation retry
→ provider failure or invalid final response
→ release
```

```text
reserve
→ validated reading
→ owner-scoped persistence succeeds
→ consume
```

If persistence fails after a provider result exists, the reservation is not consumed. The retry/reconciliation path must first determine whether the reading was persisted before deciding release. This avoids both accidental loss and duplicate charge.

### Free usage

Free usage remains visible in the same usage-accounting shape but has a distinct source and policy:

- `TRIAL` identifies an initial free allowance.
- `PROMOTION` identifies campaign or manually issued free value.
- `VIP_GRANT` identifies value granted from a VIP entitlement.
- `PURCHASE` identifies paid value.

Free value may be attached to a guest owner for the limited trial policy, but it cannot be converted into paid value or used as a financial identity. Every free authorization still produces an auditable usage/reservation record. The exact number, expiry, and registration gate are human decisions.

### Member and guest strategy

Paid credits initially attach only to the trusted member account produced by `natarot_session` and `readOptionalOwner()`. The server derives the account key; request headers, arbitrary email, and client IDs are never accepted as authority.

Guests retain the current private reading/session behavior. The recommended initial product policy is:

- guest: limited separately auditable free allowance;
- member: free allowance if selected plus paid credits and future VIP;
- guest purchase: unavailable until an authenticated account exists;
- guest-to-member credit migration: not enabled until a future claim/link design binds the guest session to the member account.

This is an architecture recommendation, not an activated product policy.

### Admin adjustments

Future admin actions are ledger commands, never direct balance edits:

- `grant`: positive `ADMIN_ADJUSTMENT`;
- `revoke`: negative adjustment or an approved reversal of an identifiable grant;
- `refund`: a policy-approved `REFUND` linked to an order/usage;
- `correct`: a compensating `REVERSAL` linked to the mistaken entry.

Every action requires a trusted actor, reason, integer amount, reference, timestamp, idempotency key, and audit metadata. An admin UI is out of scope.

## M2 package and VIP architecture

### Package catalog

A package is an offer, not a balance. The future catalog separates:

- stable package identity and display metadata;
- immutable package version;
- price in integer minor units and currency;
- credit quantity and credit source policy;
- validity rules;
- a versioned benefit snapshot;
- active/sale window state.

The server resolves the selected active package/version and ignores client-supplied price, discount, credit quantity, duration, or benefit data.

### Package versioning and order snapshot

Package versions are immutable after publication. If an offer changes from `99,000 VND / 10 credits` to `119,000 VND / 12 credits`, the two versions remain separate. An order stores:

- the selected package/version IDs for lookup;
- a complete commercial snapshot containing price, currency, credits, validity, benefits, and policy/version identifiers;
- creation-time catalog metadata needed for historical support.

Completed orders never recalculate from the current catalog.

### VIP

VIP is a time-bound entitlement, usually granted by fulfilled package/order value. It contains:

- trusted account;
- entitlement type and benefit-set version;
- start and expiry timestamps;
- source order/package version or other grant reference;
- lifecycle state (`PENDING`, `ACTIVE`, `EXPIRED`, `CANCELLED` only when a policy-authorized cancellation exists);
- idempotency/grant key and timestamps.

Current VIP benefits are intentionally unspecified. Future benefits such as monthly credits, premium spreads, discounts, history features, or priority capability must be represented as versioned entitlement data rather than added to a boolean member column.

Periodic VIP credits are separate child grants with a unique `(entitlement_id, period_key, benefit_key)` grant key. A renewal or periodic grant must never be inferred from a page load or duplicated by a retry.

### Expiration policy capability

The model permits different policies:

- purchased credits may be non-expiring or expire after a package-defined validity window;
- promotional/trial credits may expire quickly;
- VIP-period credits may expire at the end of the grant period;
- VIP access may expire independently from unused purchased credits.

No policy is hard-coded here. The selected policy must be snapshotted on the grant/entitlement so later catalog changes do not rewrite history.

## Future commerce boundaries

### Order contract

The future order contract includes:

```text
order_id
account_id                 // server-derived member account
package_id
package_version_id
package_snapshot           // immutable JSON snapshot
amount_minor
currency
status                     // PENDING, PAID, FULFILLED, CANCELLED, REFUNDED
idempotency_key
payment_reference          // provider reference, not client proof
created_at
paid_at
fulfilled_at
refunded_at
```

Payment status/evidence remains conceptually separate even if the first implementation keeps a provider reference on the order for query convenience. A future `payments` or `payment_events` record is the provider evidence source.

### SePay boundary

SePay is not implemented. The future sequence is:

```text
server resolves package version
→ server creates order PENDING
→ provider reports payment
→ server verifies provider event/reference, amount, currency, and destination
→ server records PAYMENT_CONFIRMED once
→ idempotent fulfillment grants credits/entitlements
→ order becomes FULFILLED
```

The browser return URL, success page, submitted amount, and client package payload are never sufficient to fulfill value. Provider credentials and verification secrets remain server-side.

### Payment and fulfillment idempotency

Duplicate provider notifications are safe because the future payment event has a unique provider/event identity and the order transition is conditional. `fulfillOrder(order_id)` uses a unique fulfillment key. If a retry finds `PAID` with already-created grants/entitlements, it returns the existing fulfillment result. It does not create another grant.

### Affiliate boundary

Affiliate is not implemented. Future attribution consumes a verified event after the commercial system has recorded the trusted event selected by policy, normally `ORDER_FULFILLED` or a later refund-window-qualified event:

```text
verified payment
→ fulfilled order
→ conversion event
→ attribution policy
→ commission ledger
```

Affiliate code must not call `grantCredits()` directly, alter a credit reservation, or treat an order-created/client-success event as proof of revenue. Refunds and chargebacks must be able to emit a compensating commission event.

### Minimal business events

These are integration contracts, not a full event-sourcing system:

| Event | Emitted after | Main consumers |
| --- | --- | --- |
| `ORDER_CREATED` | Server creates a pending order. | Support/analytics; not fulfillment authority. |
| `PAYMENT_CONFIRMED` | Payment verification succeeds. | Order state transition. |
| `ORDER_FULFILLED` | Credits/entitlements are committed idempotently. | Future affiliate and analytics. |
| `CREDIT_GRANTED` | A grant and positive ledger entry commit. | Balance/history and audit. |
| `CREDIT_RESERVED` | A usage hold commits. | Usage audit/reconciliation. |
| `CREDIT_RELEASED` | A hold is returned. | Usage audit/support. |
| `CREDIT_CONSUMED` | A validated persisted reading is charged. | Usage history and economics. |
| `VIP_ACTIVATED` | An active entitlement commits. | Account capability checks. |
| `VIP_EXPIRED` | An entitlement reaches its recorded end. | Capability checks and support. |

If asynchronous delivery is needed later, a narrow transactional outbox can carry these events. It must not become a second financial source of truth.

## Logical future data model

No table below is created in this mission. The list is the minimum normalized shape justified by the approved architecture.

### M1 entities

| Entity | Purpose and important fields | Unique constraints / indexes |
| --- | --- | --- |
| `credit_accounts` | One account namespace per trusted member; optional separate guest-free namespace. Contains rebuildable availability/hold cache and version. | Unique `(owner_kind, owner_id)`; index owner and updated time. |
| `credit_grants` | Source-aware lots: account, source, units, starts/expiry, order/entitlement reference, policy snapshot, grant key, lifecycle metadata. | Unique grant key scoped to account/source; index account + expiry and account + source. |
| `credit_ledger` | Immutable signed entries with event type, grant, reservation/reference, idempotency, actor/source, timestamps, and reversal link. | Unique idempotency scope; index account + created time, grant + created time, reference. |
| `credit_reservations` | One usage hold with account, usage type, units, owned resource, idempotency key, state, lease, and result reference. | Unique `(account_id, idempotency_key)`; index account + state and lease expiry. |
| `credit_reservation_allocations` | Exact reservation-to-lot allocation with held/consumed/released units. | Unique `(reservation_id, grant_id)`; index grant + active state. |

The ledger and grant allocation projection together explain value. No mutable account cache may be impossible to rebuild.

### M2 entities

| Entity | Purpose and important fields | Unique constraints / indexes |
| --- | --- | --- |
| `packages` | Stable catalog identity, slug, display metadata, and lifecycle. | Unique public slug; active/display-order index. |
| `package_versions` | Immutable price, currency, units, validity, benefit snapshot, policy version, and sale window. | Unique `(package_id, version)`; active-window index. |
| `orders` | Server-created order with account, package/version IDs, immutable snapshot, amount/currency, state, idempotency, and timestamps. | Unique `(account_id, idempotency_key)`; index account + created/state. |
| `entitlements` | Time-bound VIP or capability right with source order, benefit-set version, state, start/end, and grant key. | Unique source/benefit/grant key; index account + state/end. |

### Future payment entity

`payments` or `payment_events` is a separate future entity containing provider, provider event/transaction identity, verified amount/currency/reference, verification timestamp, and order link. It needs a unique provider event identity and an index by order. It is not added now because SePay is explicitly out of scope.

### Lifecycle and retention

Commercial/audit rows are append-only or state-transitioned. Completed orders, verified payment evidence, fulfillment links, grants, ledger entries, reservations, and adjustments are not deleted as a convenience. Account deletion should remove or pseudonymize personal fields while preserving the stable internal reference and accounting relationships to the extent required by future legal/privacy policy. The retention period and legal erasure behavior remain policy decisions.

## Transaction boundaries and failure recovery

### `grantCredits()`

One transaction checks the grant idempotency key, inserts the grant lot, inserts the positive `GRANT` entry, and updates the rebuildable cache. A retry returns the original grant result. A duplicate key with a different fingerprint is rejected.

### `reserveUsage()`

One transaction performs the trusted-owner check, idempotency lookup, eligible-lot selection/claim, allocation inserts, reservation insert, and cache update. It must use conditional writes or an equivalent atomic claim, not a prior balance read followed by an unconditional debit.

### `consumeReservation()`

One transaction verifies that the reservation is owned by the same account and resource, checks it is still `RESERVED`, inserts the consumption entries exactly once, marks allocations consumed, marks the reservation `CONSUMED`, and updates caches. A second call returns the existing consumed result.

### `releaseReservation()`

One transaction verifies ownership and state, marks the hold released, records the reason/reference, and restores derived availability. A second release is a no-op returning the existing state. A consumed reservation cannot be released; it requires an explicit reversal/refund policy.

### `fulfillOrder()`

One transaction verifies `PAYMENT_CONFIRMED`, checks the fulfillment idempotency key, creates the versioned entitlements and credit grants, appends `GRANT` entries, records fulfillment, and emits the fulfillment boundary. If any statement fails, the transaction rolls back. A retry returns the already fulfilled result.

### D1/SQLite concurrency strategy

The verified runtime evidence is:

- D1-compatible access through prepared statements and `batch()`.
- The Node adapter serializes `batch()` calls and uses `BEGIN IMMEDIATE`, `COMMIT`, and rollback.

The future implementation must use one atomic D1 batch/transaction for each invariant-changing operation. It must use a conditional account/lots claim or a single guarded SQL operation whose affected-row result proves that the claim succeeded. It must not rely on PostgreSQL row-lock syntax, an application-level mutex, or a check/debit split across HTTP requests.

For the Node topology, `BEGIN IMMEDIATE` provides the writer serialization already used by the adapter. For D1, the implementation must validate atomic batch behavior with an isolated two-request test and bounded retry on a transient write conflict. If an implementation cannot inspect the conditional result inside a provider-supported transaction, it must not activate paid usage until the reservation operation is rewritten as one provider-safe guarded statement.

The required invariant test is:

```text
account has one eligible credit
→ request A and request B reserve concurrently
→ exactly one reservation is RESERVED
→ the other receives insufficient credit or the same idempotent result
→ the ledger and lot allocation never show two successful claims
```

## Future API contract

These are specification-level interfaces only.

### Public/member endpoints

| Endpoint | Future behavior |
| --- | --- |
| `GET /api/billing/balance` | Authenticated member only; returns derived available/held units and safe account state. |
| `GET /api/billing/history` | Authenticated member only; owner-scoped ledger/usage history with safe references. |
| `GET /api/packages` | Returns active server catalog versions and display data; no secret/payment state. |
| `POST /api/orders` | Authenticated member submits a package/version selection and idempotency key; server computes amount and snapshot. |
| `GET /api/orders/:id` | Returns only the authenticated owner’s order projection. |

Guest requests may receive a separate free-usage projection later, but must not receive a paid balance or create a paid order.

### Internal domain operations

```text
grantCredits(input)
reserveUsage(input)
consumeReservation(input)
releaseReservation(input)
expireGrant(input)
reverseLedgerEntry(input)
activateEntitlement(input)
fulfillOrder(input)
reconcileReservation(input)
```

Each operation accepts a server-resolved owner, a bounded input, a stable idempotency key, and an auditable business reference. No operation accepts client-authoritative money or account identity.

## Tarot integration contract

The first paid Tarot usage should be the initial interpretation of an owned, fully drawn session. The future orchestration is:

```text
request identity from session/cookie
→ load the owner-scoped session
→ derive usage key from the server session and usage type
→ reserve one configured unit
→ run the existing Tarot service/provider validation
→ persist validated reading
→ consume reservation against the persisted reading
```

For a duplicate request, the server looks up the existing usage reservation and existing owned reading before calling the provider again. A provider failure or malformed final response releases the hold. A follow-up question or supplementary draw must receive a distinct usage type and idempotency key; it must not reuse the initial reading’s key.

This future integration must be implemented in a separate authorized mission because the current reading service, AI contract, Room, database, and ownership zones are protected.

## User-experience contract

The eventual UI should expose product state without exposing internal accounting complexity:

- Available: “1 reading credit available” and a clear read action.
- None: “No reading credits available” with a package route.
- Processing: “Preparing your reading”; do not claim final consumption yet.
- Delivered: show the reading and, if desired, a history entry after consumption is confirmed.
- Known failure: explain that the credit was returned only after release commits.
- Unknown outcome: show a safe “checking your reading status” state and prevent a second logical charge while reconciliation runs.

No final VIP, billing, or pricing UI is designed or implemented here.

## Economics and pricing scenarios

The historical working assumption of `15,000 VND / reading` is used only for scenario analysis. It is not a runtime constant or approved price.

For one reading at that assumption:

```text
gross revenue:                 15,000 VND
- payment cost:                UNKNOWN
- DeepSeek/provider cost:      UNKNOWN and current-price-dependent
- infrastructure:              UNKNOWN
- affiliate commission:        scenario input
- promotion/bonus allocation:  scenario input
= contribution margin:         must be calculated before launch
```

At a future 30% affiliate scenario, the illustrative commission is `4,500 VND`, leaving `10,500 VND` before payment, provider, infrastructure, promotion, tax, refund, and support costs. This demonstrates the required margin test; it does not set a commission or price.

The package version must carry the commercial terms needed to run this calculation. Unknown provider pricing must remain unknown rather than be fabricated from model names or prompt size.

## Refund and reversal behavior

Technical capabilities are distinct from policy:

- Unused purchased credits can be reversed by a compensating ledger entry linked to the order/refund.
- Used credits cannot be silently restored; the system needs a policy for whether the reading is voided, the value becomes a debt/negative adjustment, or support grants a replacement.
- VIP access can be cancelled or shortened through a compensating entitlement transition with an effective timestamp; already delivered benefits need a separate policy.
- A payment reversal must be idempotent and must not delete the order, payment evidence, grant, or consumption history.
- Future affiliate commission should remain pending until the selected refund window, or produce a compensating commission entry if a later refund/chargeback reverses a conversion.

Legal refund, chargeback, tax, and affiliate clawback policy remains a human decision.

## Security and threat model

| Threat | Trust boundary | Mitigation |
| --- | --- | --- |
| Client price/discount tampering | Browser → order API | Resolve active package version server-side; ignore client amount, discount, units, duration, and benefits. |
| Credit balance tampering | Browser → billing API | Derive identity from the authenticated session; calculate from ledger/grants/reservations; never accept a balance field. |
| Client-controlled account ID | Request body/header → domain operation | Use `RequestIdentity` and owner predicates; account ID is server-derived. |
| Replay of usage | Browser/network → reservation/consume | Unique account-scoped usage idempotency key derived from the owned server resource; reject fingerprint mismatches. |
| Concurrent overspend | Two requests → database | Atomic conditional reservation transaction with deterministic lot allocation; balance=1 concurrency test required. |
| Cross-account reading charge | Member A request → session B | Re-check session ownership before reserve and before consume; do not trust submitted session owner. |
| Duplicate payment webhook | Provider → payment boundary | Verify provider identity and amount/currency; unique provider event key; conditional order transition. |
| Duplicate fulfillment | Payment/order service → grants | Unique fulfillment and grant keys; one transaction for order state, entitlements, grants, and ledger. |
| Refund replay | Provider/support → reversal | Unique refund/reversal reference linked to the original event; compensating entry only once. |
| Admin abuse | Staff command → ledger | Authenticated role boundary, actor/reason/reference/amount/idempotency required, no direct edits. |
| Guest-cookie financial abuse | Bearer guest cookie → paid value | Paid credits/orders require a member; guest value is limited, source-tagged, and non-cashable. |
| Secret leakage | Server/provider boundary → browser/logs | Keep payment/provider credentials server-side; redact provider payloads and never store secrets in snapshots or logs. |

The current guest cookie and optional `Origin` behavior remain documented security considerations in the project state. This mission does not alter them.

## Human decision register

The architecture does not block on these decisions, but production implementation must resolve them explicitly:

1. Whether guests receive a free trial, how many units it contains, and its expiry.
2. Whether purchased credits expire, and the validity policy for each package/source.
3. Whether any guest-to-member migration is permitted and how a claim is authenticated.
4. Final package names, prices, discounts, currencies, and credit quantities.
5. Final VIP benefits, validity, renewal behavior, and monthly grant timing.
6. Pricing and credit cost for follow-up, supplementary draw, and premium spread usage types.
7. Refund, chargeback, partial-consumption, and used-credit policy.
8. Payment verification/reconciliation requirements and the selected SePay event fields.
9. Affiliate attribution window, commission basis, refund holdback, clawback, and payout policy.
10. Legal/privacy retention, pseudonymization, tax, and support-access requirements.

## Implementation roadmap

This roadmap is future work. It is not started by this mission.

### M1A — Credit schema and ledger

Add the reviewed tables for accounts, grants/lots, ledger entries, reservations, and allocations. Add migration and isolated fixture tests only after the schema/data mission is authorized. Prove rebuildable balance and ledger invariants.

### M1B — Reservation, consumption, and release

Implement the transactional domain operations and deterministic lot allocation. Add idempotency, provider-failure, timeout/reconciliation, and two-request concurrency tests against D1-shaped and Node SQLite fixtures.

### M1C — Member balance and history

Expose authenticated member projections for available/held units, ledger history, usage references, and safe support state. Keep guest paid balance unavailable and account for free usage separately.

### M2A — Package catalog and versioning

Create server-authoritative package/version catalog behavior with immutable version snapshots and tests proving old orders cannot change when the current offer changes.

### M2B — VIP and entitlements

Add time-bound entitlement lifecycle, benefit-set versioning, periodic grant keys, expiry, and capability checks. Do not add speculative benefits before product decisions are made.

### M2C — Order contract

Create server-side pending orders with package snapshots, idempotency, ownership checks, safe status projections, and fulfillment-ready boundaries. No payment provider yet.

### M3 — SePay

Implement provider verification, payment evidence, duplicate notification handling, and idempotent order fulfillment only after payment requirements, secrets, migration, and deployment authorization are approved.

### M4 — Affiliate attribution

Consume a verified fulfillment event and apply the approved attribution window and policy. Do not grant credits or edit orders from affiliate code.

### M5 — Conversion and commission ledger

Add pending/approved/reversed commission accounting with refund/chargeback compensation.

### M6 — Affiliate tiers

Implement approved 10%/20%/30% or other tiers as server configuration with margin safeguards.

### M7 — Affiliate dashboard

Expose owner-scoped conversion and commission projections with privacy controls.

### M8 — Payout and admin

Add reviewed payout, reconciliation, support adjustment, and audit workflows.

No roadmap stage begins automatically from this commit.

## Validation and protected-zone statement

This mission produces documentation only. The final validation must confirm:

- architecture self-review covers financial correctness, concurrency, retry safety, security, auditability, product flexibility, future payment, affiliate boundaries, and simplicity;
- `git diff --check` passes;
- documentation placeholder and secret-like literal scans pass;
- the tracked baseline suite, typecheck, and build remain green;
- only the specification, implementation-readiness plan, and required project-state checkpoint are committed;
- L5–L8, Release Readiness, auth, F-001, AI/Knowledge Base, Room, database schema/migrations, deployment, and production remain unchanged;
- SePay, Affiliate, live billing, M1A, merge, and deployment remain unimplemented.

Highest completion level for this mission is documentation-complete and regression-verified, not production-ready.
