# NATAROT — COMMERCIAL IMPLEMENTATION ROADMAP V1

**Status:** Documentation-only implementation plan
**Date:** 2026-09-21
**Baseline:** codex/natarot-integration-v1 at f5452a35d7b4bbc9884e52d0890c4f5e9c39e9fe
**Credits/VIP reference:** codex/natarot-credits-vip-foundation at c589441b78cb23bd5086d296f0deb389cf41f037

This roadmap turns the Commercial Readiness V1 architecture into an ordered implementation program. It is not an authorization to modify runtime code, run migrations, install dependencies, configure provider credentials, or deploy production.

## 1. Target outcome

Deliver a server-authoritative VND commercial flow for NaTarot:

1. A customer creates an internal order for a versioned offer.
2. The server signs and submits a SePay Gateway checkout.
3. SePay IPN and, when needed, order-detail reconciliation establish payment truth.
4. A verified order crosses an explicit fulfillment interface into the Credits/VIP system.
5. An eligible fulfilled order creates one affiliate conversion and append-only commission entries.
6. Refunds, voids, reversals, payout holds, and manual repairs remain auditable and idempotent.

The first release is intentionally narrow: SePay Gateway, VND, bank transfer/VietQR-compatible checkout behavior supported by the provider, server orders, provider IPN, and direct affiliate attribution. Automated payout rails and the separate direct bank-webhook product are later decisions.

## 2. Current starting point

The base integration branch has authentication/session and guest-owner foundations, but no commercial runtime. The current integrations status reports payments as not connected. There are no approved payment, affiliate, payout, or commercial ledger tables in the baseline.

The Credits/VIP branch is treated as a reference for boundary design only. Its implementation is not assumed stable for this roadmap and is not modified by the documentation work.

## 3. Delivery principles

- Keep payment truth on the server.
- Persist the internal order before redirecting to a provider.
- Treat browser returns as display-only.
- Verify provider order, invoice, exact amount, currency, status, transaction, and destination before fulfillment.
- Make every externally retried operation idempotent.
- Keep payment verification, fulfillment, affiliate conversion, commission, and payout as explicit state transitions.
- Preserve financial history with append-only events and compensating entries.
- Snapshot commercial configuration at the time an order or conversion is created.
- Ship sandbox evidence before any production credential or endpoint is considered.
- Keep each milestone reviewable and reversible.

## 4. Milestones

### M0 — Commercial decisions and contract freeze

**Status:** Documentation complete; human decisions remain open.

**Scope**

- Approve SePay Gateway as the V1 provider path.
- Confirm VND and the initial payment method set.
- Confirm the order, payment event, fulfillment, affiliate, conversion, ledger, and payout state machines.
- Select the V1 affiliate attribution policy, payout policy, refund policy, and retention policy.
- Confirm the Credits/VIP adapter boundary and the owner for its implementation.

**Outputs**

- Approved architecture, provider specification, affiliate specification, security controls, and this roadmap.
- Decision register with named owners and due dates.
- Provider sandbox access requested separately from production access.

**Gate**

No runtime implementation starts until product, finance, security, and Credits/VIP owners approve the decisions that affect money movement or historical data.

### M1 — Commercial persistence and domain contracts

**Dependencies:** M0 approval; database owner; existing auth/guest-owner boundaries.

**Implementation scope**

- Add versioned offer/product snapshots.
- Add internal orders and immutable order pricing/currency fields.
- Add payment attempts and payment events with provider identity and deduplication keys.
- Add fulfillment records with retryable and manual-failure states.
- Add affiliate accounts, attributions, conversions, tier versions, commission ledger, payouts, and admin audit records according to the approved schema.
- Add unique constraints and indexes for invoice numbers, provider order/transaction IDs, event fingerprints, order conversion, ledger idempotency, and payout identifiers.
- Add state-transition services that reject illegal transitions.

**Tests**

- schema constraint tests;
- state-machine transition tests;
- concurrent duplicate event tests;
- owner and authorization tests;
- snapshot immutability tests;
- migration forward/backward or rollback rehearsal in a disposable environment.

**Gate**

Database review confirms that no successful payment or conversion can be represented twice, and no historical financial record depends on mutable current pricing or tier configuration.

### M2 — SePay Gateway sandbox adapter

**Dependencies:** M1; sandbox merchant credentials; callback hostname; approved secret storage.

**Implementation scope**

- Implement server-side checkout form generation using the documented signing field order.
- Keep sandbox and production endpoint/configuration sets separate.
- Store the provider order/transaction identifiers returned by checkout initialization.
- Implement the public IPN endpoint with HTTPS, configured provider authentication, schema validation, event recording, and deterministic acknowledgement.
- Implement provider order-detail retrieval for reconciliation.
- Normalize provider statuses into internal payment event states.
- Add bounded retry/backoff and an operator-visible reconciliation queue.

**Tests**

- checkout signature fixture tests;
- required/invalid field tests;
- sandbox happy path;
- success/cancel/timeout browser-return tests that prove returns do not fulfill;
- authenticated, unauthenticated, malformed, duplicate, and replayed IPN tests;
- exact amount, currency, invoice, order, transaction, and destination mismatch tests;
- provider timeout and malformed response tests;
- order-detail reconciliation for missed IPN.

**Gate**

Sandbox evidence shows that one provider payment creates at most one verified internal payment event and one internal fulfillment request. No production endpoint or credential is used for this gate.

### M3 — Fulfillment bridge to Credits/VIP

**Dependencies:** M1; M2 verified-payment event; explicit Credits/VIP owner and contract.

**Implementation scope**

- Implement a narrow fulfillment adapter from verified internal order to the Credits/VIP service.
- Define entitlement snapshots and a stable idempotency key.
- Persist fulfillment request, processing, success, retryable failure, and manual failure states.
- Ensure a retry after a timeout cannot double-grant credits or VIP.
- Add reversal handling for approved refund/void policy.

**Tests**

- one verified order creates one grant;
- concurrent fulfillment workers converge on one result;
- transient service failure retries safely;
- permanent failure reaches manual review;
- duplicate retries and process restarts do not duplicate entitlements;
- reversal produces an auditable compensating action.

**Gate**

Credits/VIP owner confirms the adapter contract, entitlement semantics, and reversal behavior. Commercial code does not reach into unstable Credits/VIP internals.

### M4 — Affiliate attribution and commission ledger

**Dependencies:** M1; M3 fulfilled-order event; approved V1 attribution and commission policy.

**Implementation scope**

- Create server-owned referral entry and attribution flows.
- Enforce the selected first-touch or other approved policy, expiry, owner boundaries, and no automatic replacement unless explicitly approved.
- Prevent self-referral, circular relationships, arbitrary affiliate IDs, and IDOR.
- Convert only eligible fulfilled orders.
- Snapshot tier version, commission base, and policy at conversion time.
- Write append-only commission ledger entries with unique idempotency keys.
- Add reversal and refund entries without deleting originals.

**Tests**

- valid and invalid referral attribution;
- attribution expiry and different-browser behavior;
- self-referral, circular referral, and multiple-account risk controls;
- duplicate conversion requests;
- conversion before fulfillment, after refund, and after void;
- tier version changes do not rewrite old conversions;
- ledger balance and compensating-entry reconciliation.

**Gate**

Finance and product approve the calculation policy and sample ledger statements. Security approves abuse controls and audit fields.

### M5 — Admin operations, payout readiness, and reconciliation

**Dependencies:** M2–M4; finance/admin owners; approved payout policy.

**Implementation scope**

- Provide restricted operations for order inspection, reconciliation, retry, refund/void recording, conversion review, commission hold/release, payout review, and manual repair.
- Enforce role-based access, reason codes, audit records, and separation of duties.
- Add payout request states even if automated payout execution is deferred.
- Implement hold periods, minimums, destination verification, and duplicate-payout prevention.
- Add dashboards/alerts for provider failures, payment backlog, fulfillment backlog, duplicate attempts, ledger imbalance, and payout exceptions.

**Tests**

- role matrix and IDOR tests;
- admin CSRF and step-up tests;
- two-person approval tests where required;
- manual repair creates compensating records;
- payout duplicate and state-transition tests;
- alert delivery and retry exhaustion tests;
- audit log completeness and redaction tests.

**Gate**

Operations can answer who did what, when, to which order or ledger record, with which reason, without direct untracked database edits.

### M6 — Staging certification and controlled release

**Dependencies:** M2–M5; sandbox evidence; staging secrets; release owner.

**Staging sequence**

1. Provision sandbox-only SePay credentials through the approved secret manager.
2. Configure a staging callback hostname and HTTPS.
3. Run checkout, IPN, order-detail, fulfillment, affiliate, refund/void, and payout-hold scenarios.
4. Run concurrency, replay, abuse, access-control, rate-limit, and failure-injection tests.
5. Reconcile provider records against internal orders and ledger totals.
6. Confirm monitoring, alert ownership, incident runbooks, and support playbooks.
7. Produce a release evidence bundle with test results, sample IDs, configuration checksum metadata, and approvals.

**Gate**

Staging has zero unexplained paid orders, zero duplicated grants, zero unexplained ledger imbalance, and no unresolved critical/high security finding. Production configuration remains out of scope until this gate is signed.

### M7 — Production readiness and gradual activation

**Dependencies:** M6 sign-off; production credentials issued separately; finance and security approval.

**Controlled activation**

- Configure production only through the approved deployment and secret-management process.
- Start with an allowlisted internal or low-volume cohort.
- Monitor payment verification, fulfillment latency, reconciliation backlog, duplicate attempts, refund/void transitions, affiliate conversion, and ledger totals.
- Keep a manual hold path for payouts until financial reconciliation is proven.
- Expand volume only after the first observation window has no unexplained discrepancy.
- Record rollback and kill-switch behavior before enabling public traffic.

**Gate**

Production launch is a separate change approval. This documentation branch does not perform it.

## 5. Dependency and ownership map

| Workstream | Primary owner | Required partner | Blocking evidence |
|---|---|---|---|
| SePay provider integration | Backend/payments | Security, operations | Sandbox IPN and reconciliation report |
| Order/payment data model | Backend/data | Finance, security | Constraint and state-machine review |
| Credits/VIP fulfillment | Credits/VIP owner | Backend/payments | Idempotent adapter contract |
| Affiliate policy and abuse | Product/growth | Security, finance | Approved policy and abuse tests |
| Commission ledger and refunds | Backend/finance | Operations | Ledger samples and reconciliation |
| Admin and payout controls | Operations/finance | Security | RBAC and separation-of-duties evidence |
| Staging/release | Release owner | All workstream owners | Signed release evidence bundle |

## 6. Test matrix

| Area | Unit/contract | Integration | Staging/e2e | Human review |
|---|---|---|---|---|
| Checkout | Signing and field validation | SePay sandbox init | Browser redirect/return | Payments owner |
| IPN | Auth/schema/idempotency | Provider notification | Retry/replay/timeout | Security owner |
| Reconciliation | Status normalization | Order detail API | Missed IPN recovery | Operations owner |
| Fulfillment | Adapter idempotency | Credits/VIP boundary | Process restart/failure injection | Credits/VIP owner |
| Affiliate | Attribution/conversion rules | Fulfilled-order event | Abuse and cross-browser cases | Product/security |
| Ledger | Append-only and reversal | Conversion/refund flow | Full order-to-ledger reconciliation | Finance owner |
| Admin/payout | RBAC/state rules | Review and approval APIs | Two-person and audit scenarios | Finance/operations |
| Resilience | Retry/backoff | Provider/service outage | Backlog/drain and alerting | Release owner |

## 7. Release checklist

### Architecture and policy

- [ ] V1 scope remains SePay Gateway, VND, server orders, IPN, and direct affiliate attribution.
- [ ] No direct bank-webhook path was introduced without a new design review.
- [ ] Credits/VIP adapter and reversal contract are approved.
- [ ] Attribution, commission, refund, payout, retention, and incident policies have owners.

### Security

- [ ] Secrets are in the approved secret manager and absent from source, logs, client payloads, and build output.
- [ ] IPN authentication, replay handling, body limits, rate limits, and redaction are tested.
- [ ] Amount, currency, invoice, order, transaction, status, and destination checks are tested.
- [ ] RBAC, IDOR, CSRF, step-up, audit, and separation-of-duties controls are tested.

### Data and operations

- [ ] Unique constraints and state transitions are verified under concurrency.
- [ ] Reconciliation reports balance provider events, internal orders, fulfillment, conversions, and ledger entries.
- [ ] Manual repair creates auditable compensating entries.
- [ ] Monitoring, alert routing, runbooks, and support responses are ready.

### Release

- [ ] Sandbox evidence is attached.
- [ ] Staging has no unexplained discrepancies.
- [ ] Rollback/kill-switch behavior is documented.
- [ ] Production activation is separately approved and remains disabled until that approval.

## 8. Explicit non-goals for V1

- Direct bank webhook integration outside the SePay Gateway contract.
- Automated payout execution without a separate provider and payout security review.
- Multi-level affiliate commissions.
- Unversioned commission rates or mutable historical calculations.
- Client-side payment confirmation as a source of truth.
- Automatic affiliate replacement after attribution without a documented policy.
- Production credential creation, deployment, or live-money testing in this documentation phase.

## 9. Open decisions

1. Which SePay IPN authentication mode and credential rotation owner are approved?
2. Which exact payment methods are enabled for the first VND offer?
3. What are the order expiration, refund, void, and chargeback rules?
4. What is the V1 attribution policy and expiry duration?
5. What commission base, tier thresholds, hold period, and payout minimum apply?
6. Which roles can approve refunds, conversions, ledger adjustments, and payouts?
7. What data retention and deletion policy applies to payment and affiliate records?
8. Which owner accepts operational alerts and incident response?

## 10. Definition of done

Commercial V1 is ready for a separate production change approval only when:

- every milestone gate is signed;
- sandbox and staging evidence covers happy paths, retries, replays, mismatches, refunds/voids, and abuse;
- provider totals, internal orders, fulfillment results, affiliate conversions, and ledger balances reconcile;
- no critical/high security issue is unresolved;
- secrets and production configuration are managed outside Git;
- the operator runbook and rollback path are tested;
- all open decisions have a named owner and recorded answer;
- the implementation has been reviewed against the five commercial documents and the stable branch boundaries.
