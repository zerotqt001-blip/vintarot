# NaTarot — Commercial Architecture V1

**Status:** DOCUMENTATION-ONLY / DESIGNED / REVIEWED / VERIFIED / NOT IMPLEMENTED / NOT DEPLOYED
**Date:** 2026-09-21
**Product baseline:** `codex/natarot-integration-v1` at `f5452a35d7b4bbc9884e52d0890c4f5e9c39e9fe`
**Documentation branch:** `codex/natarot-commercial-readiness-v1`
**Credits/VIP architecture input:** `codex/natarot-credits-vip-foundation` at `c589441b78cb23bd5086d296f0deb389cf41f037`

This document defines the commercial boundaries that later implementation work must follow. It does not create a database migration, add a payment provider, change the Credits/VIP workstream, or authorize production payment processing.

## 1. Mission and hard boundaries

The mission is to make NaTarot’s remaining commercial stack implementation-ready:

```text
versioned package
  → server-owned order
  → SePay checkout attempt
  → authenticated and verified payment event
  → idempotent fulfillment
  → Credits/VIP domain service
  → verified fulfillment event
  → affiliate conversion
  → commission ledger
  → reviewed payout boundary
```

The following are explicitly outside this mission:

- SePay runtime code or live payment processing;
- database migrations or schema files;
- dependency changes;
- Credits/VIP runtime changes;
- affiliate, payout, dashboard, or final UI implementation;
- production configuration, credentials, deployment, restart, or data changes;
- final pricing, VIP benefits, attribution windows, commission thresholds, refund policy, or payout policy.

## 2. Source authority and evidence labels

### 2.1 Stable inputs

The specification is grounded in these stable inputs only:

| Input | Use | Status |
| --- | --- | --- |
| Integration V1 `f5452a35d7b4bbc9884e52d0890c4f5e9c39e9fe` | Product routes, member identity, guest identity, database/runtime topology, protected zones | Verified source baseline |
| Credits/VIP foundation `c589441b78cb23bd5086d296f0deb389cf41f037` | Credit ledger, package version, order-neutral fulfillment, VIP entitlement, transaction and identity contracts | Verified architecture reference; runtime details intentionally not assumed |
| Official SePay documentation listed in [NATAROT_SEPAY_SPEC.md](./NATAROT_SEPAY_SPEC.md) | Provider behavior, endpoints, payload fields, authentication, sandbox and reconciliation concepts | External source-grounded reference |

The current shared checkout was dirty and divergent at `60db3db7db535560feb6ff1178a975793bec26bf`. It was not used for implementation and remains untouched.

### 2.2 Evidence vocabulary

| Label | Meaning |
| --- | --- |
| **VERIFIED CURRENT STATE** | Directly observed in the stable source baseline, a committed architecture document, or a cited official provider document. |
| **DESIGNED** | The contract NaTarot will implement after the required milestone and human gates. |
| **PLANNED** | Sequenced future work with dependencies and a definition of done. |
| **NOT IMPLEMENTED** | No runtime code, migration, or active provider behavior exists in this mission. |
| **NOT DEPLOYED** | No production or staging environment was changed by this mission. |
| **HUMAN DECISION REQUIRED** | A policy or commercial value is intentionally not invented here. |

## 3. Verified current state

### 3.1 Identity and ownership

**VERIFIED CURRENT STATE:** the existing member session is resolved server-side and represented in the request identity boundary as `member:<member.id>`. Existing Tarot ownership predicates use that server-derived identity. Guest sessions use the `vintarot_guest` bearer cookie and are a separate ownership mode.

Commercial consequences:

- paid orders and paid entitlements require a trusted authenticated member;
- the browser may not submit an authoritative member ID, account ID, email, amount, package terms, discount, credit quantity, or VIP duration;
- guest free usage can remain a separate source-tagged policy, but guest cookies are not a financial identity;
- F-001 identity and owner matching remain protected boundaries.

### 3.2 Current product and persistence

**VERIFIED CURRENT STATE:** the Integration V1 source contains members, sessions, guest ownership, Tarot catalog/draw/session/reading persistence, rooms, records, and share-related source. It does not contain commercial orders, payment events, payment attempts, fulfillments, affiliate accounts, conversions, commission ledger, tier versions, or payout tables.

The integration status endpoint in the stable baseline reports payments as unavailable. This mission records that fact; it does not change the endpoint.

### 3.3 Credits/VIP boundary

**VERIFIED CURRENT STATE:** the Credits/VIP architecture specifies append-only credit accounting, source-aware grant lots, reservations, immutable package versions, time-bound VIP entitlements, and a future payment-neutral order/fulfillment seam. It explicitly leaves SePay and affiliate runtime work for later milestones.

**DESIGNED:** commercial payment code calls a narrow fulfillment contract. It never directly increments a balance, mutates a VIP flag, or writes a Tarot usage record.

## 4. Executive decisions

### 4.1 SePay model

Use SePay Payment Gateway for the initial one-time package checkout, focused on VND bank transfer/VietQR through the gateway. The payment gateway’s signed checkout form, server-side IPN, and order-detail API form one provider adapter. NaTarot does not activate a second direct bank-webhook/VietQR path in V1.

This is a product architecture decision. Provider facts and endpoint details are separated in [NATAROT_SEPAY_SPEC.md](./NATAROT_SEPAY_SPEC.md).

### 4.2 Payment is not fulfillment

The system must preserve this distinction:

```text
provider notification
  → authenticated payment event
  → verified payment
  → order PAID
  → idempotent fulfillment
  → order FULFILLED
  → Credits/VIP grant result
```

An IPN is evidence to verify, not an instruction to grant value. A browser redirect is display-only. A `PAID` order is not yet a `FULFILLED` order.

### 4.3 Source of truth

- Package versions are immutable commercial terms.
- Orders snapshot package terms and are never recalculated from the current catalog.
- Payment events are append-only provider evidence.
- Fulfillment has one unique logical result per order/payment event.
- Credits/VIP remain authoritative inside their own domain.
- Affiliate commissions are append-only ledger entries derived from verified fulfillment.
- Display totals are rebuildable projections, never financial truth.

## 5. Domain boundaries

| Domain | Owns | Must not own |
| --- | --- | --- |
| Package catalog | Active package versions, prices, currencies, credit/VIP benefit snapshots | Payment status, member balance, affiliate commission |
| Order | Member intent, package snapshot, lifecycle, internal idempotency | Proof of payment, direct credit mutation |
| Payment adapter | Provider checkout request, IPN authentication, event normalization, reconciliation | Package selection, browser success, Credits/VIP mutation |
| Payment evidence | Provider event identity, verified amount/currency/reference, audit trail | Fulfillment result |
| Fulfillment | One idempotent application of the verified commercial result | Repricing, attribution policy, arbitrary balance edits |
| Credits/VIP | Grants, reservations, consumption, entitlements, capability projection | SePay credentials, affiliate totals |
| Affiliate | Attribution, verified conversions, commission policy and ledger | Payment verification, credit grants, order status mutation |
| Payout/admin | Reviewed claims against available commission and auditable support commands | Frontend totals, direct balance edits, untracked transfers |

## 6. Order contract and state machine

### 6.1 Server-created order

`POST /api/orders` is a future authenticated-member endpoint. The request may contain only a package/version selection and an idempotency key. The server:

1. resolves the member from the existing session;
2. resolves the currently active package version;
3. snapshots price, currency, credit quantity, validity, benefits, and policy versions;
4. derives a unique internal invoice number;
5. stores the request fingerprint and idempotency key;
6. returns the order projection and the next checkout action.

The request never supplies the authoritative amount or entitlement terms.

### 6.2 Order states

| State | Meaning | Allowed next states |
| --- | --- | --- |
| `CREATED` | Internal order exists with a valid immutable snapshot; no provider attempt is active yet | `PENDING`, `CANCELLED`, `FAILED` |
| `PENDING` | Checkout was prepared or submitted; no verified payment exists | `PAID`, `EXPIRED`, `CANCELLED`, `FAILED` |
| `PAID` | A provider payment event passed server verification and is durably recorded | `FULFILLED`, `REFUNDED` |
| `FULFILLED` | Credits/VIP fulfillment committed exactly once | `REFUNDED` |
| `EXPIRED` | The order passed its expiry without a verified payment | terminal |
| `CANCELLED` | The order was cancelled before a verified payment | terminal unless a new order is created |
| `FAILED` | Provider initiation or a permanent order failure prevented checkout | terminal unless a new attempt is created under policy |
| `REFUNDED` | An approved provider refund/void/reversal has been recorded | terminal for the order lifecycle; compensating domain events may continue |

Required transition rules:

- `PENDING → PAID` is conditional on one verified payment event.
- `PAID → FULFILLED` is conditional on the Credits/VIP fulfillment contract succeeding.
- `PAID` may remain pending fulfillment after a valid payment; provider retry is not the fulfillment source of truth.
- `FULFILLED` is never silently deleted or changed back to `PENDING`.
- Refunds and reversals append compensating records; they do not erase the order or payment evidence.

### 6.3 Order idempotency

The order creation idempotency key is unique per authenticated member and operation intent. The server stores a request fingerprint. Reuse with the same fingerprint returns the existing order; reuse with a different fingerprint returns a conflict and creates no new order.

Provider invoice numbers are unique independently of the client idempotency key. A browser refresh can therefore return the existing pending order without creating a second provider invoice.

## 7. Payment contract and state machine

### 7.1 Payment event states

| State | Meaning | Fulfillment allowed? |
| --- | --- | --- |
| `RECEIVED` | Authenticated provider notification was accepted for normalization but exact business verification is not complete | No |
| `VERIFIED` | Provider identity, order/invoice, status, amount, currency, transaction and destination checks passed | Yes, through fulfillment only |
| `REJECTED` | The event is unauthenticated, malformed, unmatched, duplicated with conflicting data, or fails a business check | No |
| `VOIDED` | A trusted provider void/reversal event invalidated a previously verified payment | No new fulfillment |
| `REFUNDED` | An approved refund has been recorded with a compensating reference | No new fulfillment |

The order may become `PAID` only after a payment event reaches `VERIFIED`. A `VERIFIED` payment event does not itself grant credits or VIP.

### 7.2 Verification invariant

The provider event must be matched against the internal order snapshot and the provider configuration:

```text
authenticated event
∧ known provider/environment
∧ known internal order/invoice
∧ expected provider order identity
∧ expected amount == received amount
∧ expected currency == received currency
∧ successful provider order status
∧ successful transaction status/type
∧ unique transaction/event identity
∧ expected destination/account context where applicable
→ VERIFIED
```

Any mismatch produces no entitlement and no affiliate conversion. The mismatch is classified for support/reconciliation without storing credentials or unnecessary sensitive payload data.

### 7.3 Payment idempotency

At minimum, the future payment evidence table requires unique provider/environment/event identity and unique provider/environment/transaction identity where the provider supplies both. A duplicate event with the same normalized fingerprint returns the existing result. A duplicate provider identity with different amount, order, currency, or destination is a conflict requiring review and never triggers another state transition.

## 8. Fulfillment contract

### 8.1 Interface

The payment domain consumes a future Credits/VIP service contract rather than implementation details:

```text
fulfillVerifiedOrder({
  orderId,
  paymentEventId,
  memberId,
  packageVersionId,
  immutablePackageSnapshot,
  fulfillmentIdempotencyKey,
  source: "SEPAY",
}) → {
  fulfillmentId,
  creditGrantIds,
  entitlementIds,
  status,
}
```

The final Credits/VIP V1 interface may rename fields, but it must preserve the semantics:

- member identity is server-derived;
- package terms are supplied from the immutable order snapshot;
- the operation is idempotent by a stable fulfillment key;
- the domain creates source-aware grants and time-bound entitlements as appropriate;
- an existing successful result is returned on retry;
- a different snapshot under the same key is rejected;
- payment code never writes a balance or VIP boolean directly.

### 8.2 Fulfillment states

| State | Meaning |
| --- | --- |
| `PENDING` | Verified payment is recorded and fulfillment has not committed yet |
| `PROCESSING` | A bounded worker/command has claimed the fulfillment |
| `FULFILLED` | Credits/VIP domain returned a committed idempotent result |
| `FAILED_RETRYABLE` | A transient dependency or transaction failure occurred; safe retry is available |
| `FAILED_MANUAL` | A contract/data conflict requires support review |
| `REVERSED` | A policy-approved refund/reversal produced compensating Credits/VIP events |

There is one logical fulfillment row per order. A payment retry, browser reload, IPN replay, or support retry cannot create a second grant set.

### 8.3 IPN acknowledgement boundary

The payment endpoint must durably record a verified provider event before acknowledging it as processed. If the database is unavailable before that commit, the endpoint returns a failure response so SePay can retry. If the verified event is committed but fulfillment is temporarily unavailable, the endpoint keeps the payment evidence and fulfillment state retryable; internal reconciliation, not browser state, completes the work.

This prevents a successful provider retry from being required to keep a payment alive while preserving at-most-once fulfillment.

## 9. End-to-end sequence

```text
member session
  → package catalog resolves active version
  → order CREATED with immutable snapshot
  → payment attempt PENDING
  → signed SePay checkout form
  → customer pays on SePay
  → browser redirect (display-only)
  → SePay IPN
      → authenticate raw request
      → normalize payload
      → locate internal order by provider/invoice identity
      → verify status, amount, currency, transaction and destination
      → insert one payment event
      → conditional order CREATED/PENDING → PAID
      → idempotent fulfillment boundary
          → Credits/VIP grant/entitlement transaction
          → one fulfillment result
      → order FULFILLED
      → emit verified fulfillment event
          → affiliate conversion
          → commission ledger
```

The reconciliation path repeats server-side provider verification for a known order/provider reference. It never trusts a URL parameter or a customer-provided “paid” flag.

## 10. Proposed commercial data model

This is a logical model only. No migration is created by this mission. All financial/audit rows use restrictive foreign-key behavior; account deletion must pseudonymize personal fields without deleting accounting relationships unless a future legal-retention policy explicitly authorizes another treatment.

### 10.1 Orders and payments

| Table | Key fields and constraints | Ownership/index rules |
| --- | --- | --- |
| `orders` | `id` PK; `member_id` FK to `members.id`; `package_id`; `package_version_id`; immutable `package_snapshot_json`; integer `amount_minor`; `currency`; `invoice_number` UNIQUE; `status`; member-scoped `idempotency_key`; request fingerprint; expiry and lifecycle timestamps; optional provider order reference | `UNIQUE(member_id, idempotency_key)`; `UNIQUE(invoice_number)`; provider reference unique when present; indexes on `(member_id, created_at)` and `(status, expires_at)`; all reads require authenticated member ownership |
| `payment_attempts` | `id` PK; `order_id` FK; provider/environment; attempt idempotency key; checkout invoice/provider order reference; status; expiry; timestamps | `UNIQUE(provider, environment, attempt_key)`; indexes on `(order_id, created_at)` and `(status, expires_at)`; no secret or card data |
| `payment_events` | `id` PK; optional `order_id` FK for unmatched events; provider/environment; provider event ID; provider order ID; provider transaction ID; provider invoice; normalized status; amount/currency; non-secret destination reference; payload hash; verification/rejection timestamps and reason | `UNIQUE(provider, environment, provider_event_id)`; unique provider transaction identity when present; indexes on order/status/time; store normalized evidence and hash, not credentials or unredacted raw body by default |
| `fulfillments` | `id` PK; `order_id` FK; `payment_event_id` FK; status; fulfillment idempotency key; Credits/VIP contract version; safe result summary; error classification; timestamps | `UNIQUE(order_id)`; `UNIQUE(payment_event_id)`; `UNIQUE(idempotency_key)`; indexes on `(status, updated_at)` for retry/reconciliation |

### 10.2 Affiliate and commission

| Table | Key fields and constraints | Ownership/index rules |
| --- | --- | --- |
| `affiliate_accounts` | `id` PK; `member_id` FK; opaque/public referral code; status; policy version; created/disabled timestamps | `UNIQUE(member_id)`; `UNIQUE(referral_code)`; member can view only their own account |
| `affiliate_attributions` | `id` PK; `affiliate_id` FK; hashed random visitor token; optional server session reference; nullable `member_id` until trusted account attachment; first/last touch; expiry; lifecycle; attribution policy snapshot | Indexes on visitor hash, member, affiliate, expiry; the browser stores only an opaque token; no email, commission rate, amount, or member ID in the token |
| `affiliate_conversions` | `id` PK; attribution/affiliate/referred member FKs; `order_id` FK; `fulfillment_id` FK; conversion status; immutable commissionable amount/currency and policy snapshot; qualified/reversed timestamps | `UNIQUE(order_id)` in V1; unique fulfillment link; indexes on affiliate/status/time; created only from verified fulfillment |
| `commission_ledger` | Append-only rows linked to affiliate, conversion, order, fulfillment, and tier version; immutable event type, signed amount/currency, root commission ID, idempotency key, actor/source, timestamp, reversal link | `UNIQUE(idempotency_key)`; indexes on affiliate/time and conversion; no `affiliate.totalCommission += x` source-of-truth field; current states are derived from ledger lineage |
| `affiliate_tier_versions` | `id` PK; version name; rate in configurable basis points; qualification period; metric; thresholds/config JSON; effective start/end; status; creation actor/time | Unique version/effective identity; historical commissions store the selected version ID and snapshot; no guessed thresholds are seeded |
| `payouts` | `id` PK; affiliate FK; requested amount/currency; status; claimed ledger IDs or claim key; review actor/reason; provider/reference fields; lifecycle timestamps | `UNIQUE(affiliate_id, request_idempotency_key)`; indexes on affiliate/status/time; only `AVAILABLE` commission may be claimed; actual bank transfer is out of scope |

### 10.3 Audit support

Future admin mutations require a `commercial_admin_audit` record or an equivalent existing audit boundary containing actor, role, action, target, reason, idempotency key, before/after safe snapshots or hashes, and timestamp. It must not be possible to mutate a balance or commission total without an audit record.

## 11. Affiliate boundary

The trusted event chain is:

```text
opaque referral visit
  → server attribution candidate
  → trusted member registration/login attachment
  → verified order fulfillment
  → conversion policy
  → commission ledger
```

Cookies are discovery/continuity aids only. They are not sufficient evidence of a commission. The default V1 policy is first eligible attribution wins; after an attribution is attached to a member, later referral codes cannot replace it. Self-referral is rejected. A conversion is unique to an order and is created only after `ORDER_FULFILLED`.

The tier engine is versioned and configurable. The business direction permits rates around 10%, 20%, and 30% maximum, but this mission does not approve thresholds, rates, qualification metrics, refund windows, or payout minimums.

## 12. Refund and reversal model

Payment refund, Credit/VIP reversal, and affiliate commission reversal are separate decisions:

1. Record the provider or support refund/void event exactly once.
2. Mark the payment/order transition only if the event matches the original payment identity.
3. Ask the Credits/VIP domain to apply an idempotent compensating policy; never delete a grant or entitlement history.
4. Keep the affiliate conversion and append a compensating commission reversal if it was created.
5. Preserve the original order, payment evidence, fulfillment, and ledger entries for audit.

Used-credit behavior, partial fulfillment, VIP shortening, chargebacks, tax, and clawback law remain human decisions.

## 13. Payout and admin boundary

Payout is a future reviewed workflow:

```text
AVAILABLE commission
  → REQUESTED
  → UNDER_REVIEW
  → APPROVED
  → PAID
```

Rejected or cancelled requests release the claim without inventing new commission. `PAID` requires a provider/reference record or an explicitly approved manual settlement record. No frontend total, arbitrary member input, or direct balance-edit button can create a payout.

Minimum future admin projections:

- orders and package snapshots;
- payment events, failed verification, and reconciliation state;
- fulfillment attempts and retry/manual-review state;
- affiliate attributions and conversions;
- commission ledger and reversal history;
- payout requests and audit records.

Minimum admin mutations:

- retry/reconcile a known payment or fulfillment;
- approve/reject a policy-defined refund or commission reversal;
- approve/reject a payout;
- create an auditable ledger adjustment with actor, reason, reference, and idempotency key.

Unrestricted balance editing is prohibited.

## 14. Functional UI boundary

The later implementation needs functional surfaces only:

- package/VIP catalog;
- authenticated checkout initiation;
- payment pending, success-display, failure, and cancelled states;
- server-polled order/payment status;
- credit balance and history projections;
- affiliate link/status, conversion and commission history;
- payout request/status;
- support/admin review surfaces.

Final visual appearance, Moonlight/NaTarot styling, animation, typography, and responsive polish are separate UI work after commercial logic is verified.

## 15. Required invariants and review checklist

- Browser success/cancel is never payment authority.
- Provider notification is verified before the order becomes `PAID`.
- One provider payment identity maps to at most one internal payment event and one fulfillment.
- A fulfillment retry returns the existing Credits/VIP result instead of issuing another grant set.
- Amount, currency, order identity, package terms, and account identity are server-authoritative.
- Affiliate conversion is downstream of verified fulfillment.
- Commission is append-only, traceable, and reproducible from the tier version snapshot.
- Refunds/reversals are compensating records, not deletes.
- Cross-user order/payment/affiliate/payout access is denied by server ownership checks.
- F-001 trusted identity remains unchanged.
- No secret is included in URLs, browser state, logs, docs, snapshots, or commits.

## 16. Readiness state

| Area | State after this mission |
| --- | --- |
| Commercial architecture | DESIGNED / DOCUMENTED |
| SePay provider contract | RESEARCHED / DESIGNED / NOT IMPLEMENTED |
| Order/payment state machine | DESIGNED / NOT IMPLEMENTED |
| Idempotent fulfillment boundary | DESIGNED / NOT IMPLEMENTED |
| Credits/VIP integration | INTERFACE CONTRACT ONLY |
| Affiliate attribution/conversion | DESIGNED / NOT IMPLEMENTED |
| Commission/tier ledger | DESIGNED / NOT IMPLEMENTED |
| Payout/admin | DESIGNED / NOT IMPLEMENTED |
| Database model | PROPOSED ONLY; NO MIGRATION |
| Staging/release plan | DOCUMENTED |
| Production payment | NOT DEPLOYED / NOT AUTHORIZED |

## 17. Human decision register

Implementation cannot activate policy-dependent behavior until these are approved:

1. package names, prices, currencies, credit quantities, validity, and VIP benefits;
2. free guest/member allowance and expiration;
3. payment refund, void, chargeback, partial-fulfillment, and used-credit policy;
4. exact SePay merchant environment, IPN authentication mode, destination/account verification fields, and reconciliation cadence;
5. affiliate first/last-touch policy, attribution window, replacement policy, self-referral/household policy, and consent/retention rules;
6. commissionable amount basis, refund holdback, rate/threshold versions, payout minimum, schedule, and clawback policy;
7. commercial admin role and support-access policy;
8. Credits/VIP V1 final service interface and transaction/rollback guarantees.

## 18. Final status

This is a source-grounded commercial architecture for implementation planning. It is ready to move to an authorized implementation milestone after Credits/VIP V1 is verified and the human decision register is resolved. It does not claim that NaTarot is commercially live.
