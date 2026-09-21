# NATAROT — COMMERCIAL SECURITY V1

**Status:** Documentation-only security design
**Date:** 2026-09-21
**Scope:** SePay Gateway checkout/IPN, Credits/VIP fulfillment boundary, affiliate attribution/conversion, commission ledger, payout operations
**Baseline:** codex/natarot-integration-v1 at f5452a35d7b4bbc9884e52d0890c4f5e9c39e9fe
**Commercial reference:** codex/natarot-credits-vip-foundation at c589441b78cb23bd5086d296f0deb389cf41f037

This document defines the security controls required before commercial runtime work begins. It does not add code, secrets, migrations, provider accounts, payment credentials, or production configuration.

## 1. Security position

NaTarot treats payment, fulfillment, affiliate credit, commission availability, and payout eligibility as server-owned state. A browser redirect is useful for display only. It is never evidence that money was captured.

The V1 payment path is:

1. The server creates an internal order and immutable commercial snapshot.
2. The server creates the SePay checkout payload and signs it with a server-held secret.
3. The browser is redirected to SePay only after the server has persisted the order.
4. The public IPN endpoint authenticates and validates the provider notification.
5. The server verifies order identity, invoice identity, currency, exact amount, provider status, transaction status, and configured destination before fulfillment.
6. The server may reconcile through SePay order detail before moving an ambiguous order forward.
7. Fulfillment, affiliate conversion, and commission ledger writes happen in one idempotent server-owned workflow.

The direct bank-webhook product is not activated in Commercial Readiness V1. It must not be silently mixed with the SePay Gateway IPN contract.

## 2. Trust boundaries

| Boundary | Untrusted input | Required control |
|---|---|---|
| Customer browser to NaTarot | Redirect parameters, return URL, client order identifiers | Treat as presentation input; load state from the server |
| Customer browser to SePay | Checkout form values visible in browser | Sign on the server; do not put secret material in the form |
| SePay IPN to NaTarot | Headers, raw body, notification type, order and transaction fields | HTTPS, provider authentication, schema validation, replay/idempotency, amount and ownership checks |
| NaTarot to SePay REST API | Request parameters and provider response | Server-only Basic Auth, strict endpoint allowlist, timeout, bounded retries, response validation |
| Affiliate link to customer session | Referral code, cookie, local storage, query parameters | Opaque public identifier, signed or server-issued attribution token, TTL, same-site protections |
| Admin to commercial operations | Order, refund, conversion, commission, payout actions | Strong admin authentication, RBAC, step-up approval for money movement, reason and audit record |
| Runtime to database | State transitions and ledger mutations | Transactions, unique constraints, append-only records, optimistic/concurrency checks |

## 3. Threat model and abuse cases

The implementation must explicitly defend against:

- forged success or cancel redirects;
- tampered amount, currency, invoice, order, destination, or product values;
- replayed IPNs and duplicate provider notifications;
- a valid notification attached to a different internal order;
- a valid payment being fulfilled twice under concurrent requests;
- an underpayment, overpayment, wrong-currency payment, or payment to an unexpected destination;
- forged or replaced referral attribution;
- self-referral, circular referral, multiple-account farming, and commission manipulation;
- IDOR against order, affiliate, payout, or admin endpoints;
- refunding or reversing a commission without preserving the original ledger history;
- secret leakage through logs, browser payloads, source control, error pages, or analytics;
- payout approval by one actor without an independent review where policy requires separation of duties;
- denial of service against the public IPN endpoint or reconciliation worker.

## 4. Payment controls

### 4.1 Checkout creation

- Generate the internal order number and idempotency key on the server.
- Persist the product, price, currency, tier/offer version, affiliate attribution snapshot, and expected fulfillment before redirecting.
- Accept only an allowlisted currency (VND for the V1 scope), payment operation, payment method, and return URL class.
- Compute the signed SePay form from server-owned values. Never trust a browser-supplied amount or product identifier.
- Ensure the invoice number is unique and maps to one internal order.
- Return only the minimum data required for redirect and customer display.
- Do not log the signed payload, Authorization header, secret, or full customer payment data.

### 4.2 Return and cancel endpoints

- Treat all query parameters and POST values as untrusted display hints.
- Resolve the order using a server-side opaque identifier or provider order identifier.
- Show the current internal state and a safe next action.
- Never credit Credits, activate VIP, approve a conversion, or release commission from a return endpoint.
- Avoid reflecting provider values into HTML without output encoding.

### 4.3 IPN ingress

- Require HTTPS and accept only the documented provider notification method.
- Require the configured SePay authentication header, such as X-Secret-Key, when the account is configured for secret-key authentication.
- Validate the raw request body before any business side effect. Preserve the raw body only for bounded diagnostics with secrets and unnecessary personal data removed.
- Apply strict content-type, body-size, timestamp, notification-type, and schema validation.
- Use an allowlist for notification types. V1 supports the documented payment and void notifications needed by the order state machine.
- Store a provider event fingerprint and enforce uniqueness before processing.
- Acknowledge only after the request is authenticated and durably recorded. A duplicate of an already recorded event may receive the documented success response without repeating side effects.
- Do not use IP allowlisting as the sole control unless the provider publishes a stable, maintained source range and the deployment can enforce it safely.
- Rate-limit and instrument the endpoint without dropping valid provider retries silently.

### 4.4 Provider and order verification

For every candidate payment, verify all of the following against server-owned order data and the provider response:

1. provider order identity;
2. internal invoice number;
3. expected merchant/account context;
4. currency;
5. exact order amount;
6. expected payment operation and method where applicable;
7. provider order status;
8. provider transaction status;
9. transaction identity and uniqueness;
10. configured destination/account information where the provider exposes it;
11. customer or owner binding where the order includes one;
12. notification timestamp and replay window where available.

An event that cannot be fully verified is recorded as rejected or requiring reconciliation. It must not partially fulfill the order.

### 4.5 Reconciliation

- Use SePay order detail as the authoritative recovery check for ambiguous or missing IPN cases.
- Reconciliation jobs must be bounded, idempotent, observable, and rate-limited.
- A timeout, malformed provider response, or temporary provider failure produces a retryable state, not a paid state.
- Never infer payment from the existence of a checkout session, redirect, screenshot, customer claim, or client-side callback.

## 5. Fulfillment and Credits/VIP boundary

- Payment verification and fulfillment are separate state transitions.
- Fulfillment consumes a verified internal order, not raw provider input.
- The fulfillment adapter must be idempotent by internal order and fulfillment key.
- Credits/VIP implementation details remain outside this document and outside this branch. The commercial layer may define an interface such as grantEntitlement(orderId, entitlementSnapshot, idempotencyKey) but must not assume unstable reference behavior.
- If fulfillment fails after payment is verified, retain the paid order, create a retryable fulfillment record, alert operations when retry limits are reached, and do not create a second payment or commission event.
- Reversal or refund must create compensating records and preserve the original grant and ledger history.

## 6. Affiliate security controls

- Referral identifiers are public, opaque, and non-sensitive. They must not contain user IDs, email addresses, or payout data.
- Attribution is created server-side and linked to the account or guest owner boundary already defined by the product.
- The implementation must choose and document one V1 attribution policy before coding. This specification recommends first eligible attribution with explicit expiry and no automatic replacement.
- A customer must not be able to submit an arbitrary affiliate account ID to create an attribution.
- Enforce self-referral prevention using account identity and any additional risk signals approved for the product; do not treat IP address alone as identity.
- Reject circular or impossible referral relationships.
- Conversion can be requested only from a fulfilled, eligible order owned by the customer and linked to an eligible attribution.
- Repeated conversion attempts must resolve to one conversion record through a unique order/attribution constraint.
- Commission is written as an append-only ledger entry. Balance views are derived or materialized from ledger entries and are never trusted as the sole source of truth.
- Reversal and refund entries reference the original conversion and ledger entry; no destructive edit may erase the original financial history.

## 7. Admin and payout security

- Separate customer, affiliate, support, finance, and administrator permissions.
- Enforce least privilege for viewing personally identifiable information and payment details.
- Require a reason for manual order state changes, conversion rejection, commission adjustment, refund, payout approval, and payout failure resolution.
- Use dual control for payout approval or define an explicit low-value exception with a documented threshold.
- Make payout requests immutable after submission except through an audited state transition.
- Snapshot the commission tier/version and eligible amount at conversion time; do not recalculate historical payouts from current configuration.
- Apply payout minimums, currency checks, destination verification, duplicate-destination checks, and hold periods before release.
- Do not store full bank credentials or secrets in general application tables. Store only the minimum masked or tokenized payout destination needed for operations.
- Add CSRF protection for browser-based admin actions and re-authentication/step-up for high-impact actions.
- Prevent IDOR by resolving every resource through the authenticated principal and an explicit authorization policy.

## 8. Secrets and configuration

Secret names are placeholders only; no values are stored in this repository.

Expected secret/configuration classes:

- SePay merchant identifier;
- SePay checkout signing secret;
- SePay IPN authentication secret or configured key;
- SePay REST Basic Auth credentials;
- environment selector for sandbox versus production;
- allowed provider endpoint and callback URL configuration;
- internal session, encryption, and signing keys used by the application;
- payout-provider credentials, if a later phase introduces an automated payout rail.

Rules:

- Keep secrets in the approved secret manager or deployment environment.
- Use separate sandbox and production credentials.
- Rotate credentials without changing order identity semantics.
- Never commit .env files, credentials, tokens, signed payloads, or provider responses containing secrets.
- Redact Authorization headers, secret headers, signatures, bank account data, and full customer identifiers from logs.
- Fail closed when a required secret or endpoint configuration is missing.

## 9. Data protection and observability

Minimum audit fields for security-relevant events:

- event ID and correlation ID;
- internal order, provider order, transaction, attribution, conversion, ledger, payout, or admin-action ID as applicable;
- actor type and actor ID where available;
- event type and previous/new state;
- validation result and rejection reason category;
- provider event fingerprint;
- timestamp and deployment/environment;
- retry count and processing duration.

Do not log raw secrets, full authentication headers, signed forms, full card data, or unnecessary personal data. Retain payment and audit data according to the product's legal and accounting retention policy, which remains a human decision before launch.

Security alerts should cover:

- authentication failures on IPN;
- repeated invalid amounts or currencies;
- duplicate transaction attempts;
- unusual rejection or replay rates;
- repeated self-referral or account-linking signals;
- manual state changes and payout overrides;
- reconciliation backlog and retry exhaustion;
- secret/configuration failures;
- unexpected provider status transitions.

## 10. Required security tests before implementation acceptance

### Payment

- forged success redirect does not fulfill;
- modified amount, currency, invoice, order, or destination is rejected;
- missing, invalid, and replayed IPN authentication is rejected or safely deduplicated;
- duplicate IPNs and concurrent workers produce one fulfillment;
- a valid event for another order cannot affect the target order;
- underpayment, overpayment, wrong currency, void, and refund paths are covered;
- provider timeout and malformed response remain retryable and do not become paid;
- reconciliation can safely recover a missed IPN.

### Affiliate and ledger

- invalid referral code cannot create attribution;
- self-referral and circular referral are rejected;
- attribution expiry and policy behavior are deterministic;
- two conversion requests create one conversion;
- only an eligible fulfilled order can convert;
- refunds and reversals create compensating ledger records;
- historical tier snapshots remain stable after configuration changes.

### Access control and operations

- customer, affiliate, support, finance, and administrator permissions are tested separately;
- resource IDs cannot be used for IDOR;
- admin actions require reason and are auditable;
- payout approval follows the documented separation-of-duties rule;
- secrets are absent from source, build artifacts, client payloads, and logs;
- rate limits, body limits, timeout limits, and retry backoff are enforced.

## 11. Incident response boundary

The implementation must define an operator runbook for:

1. suspicious or forged IPN traffic;
2. provider outage or callback backlog;
3. paid-but-not-fulfilled orders;
4. duplicate fulfillment or commission;
5. refund and chargeback/reversal;
6. compromised SePay or payout credentials;
7. affiliate abuse and payout hold;
8. incorrect tier configuration.

The runbook must prefer containment and reconciliation over destructive edits. Manual repair must use a new audited event or compensating ledger entry, never an untracked database mutation.

## 12. Security readiness status

| Control area | Design status | Implementation gate |
|---|---|---|
| Server-owned order and fulfillment | Defined | Order and fulfillment schema/API review |
| SePay IPN authentication and validation | Defined | Sandbox integration and replay tests |
| Amount/currency/destination verification | Defined | Provider response fixture and negative tests |
| Idempotency and concurrency | Defined | Database constraint and worker tests |
| Affiliate attribution and abuse controls | Defined | Product policy decisions and abuse test set |
| Append-only commission ledger | Defined | Ledger schema and reconciliation review |
| Admin/payout controls | Defined | RBAC, dual-control, and audit acceptance |
| Secrets and logging | Defined | Secret scan, redaction test, deployment review |
| Incident response | Skeleton defined | Operator runbook and ownership sign-off |

No area is production-ready until its implementation gate is completed and evidence is attached to the release record.

## 13. Human decisions required before coding

- Exact SePay IPN authentication mode and credential rotation owner.
- Production callback hostname and network/edge protections.
- PII/payment retention and deletion policy.
- Admin roles, payout approval separation, and manual repair authority.
- V1 affiliate attribution policy and abuse review threshold.
- Refund, void, chargeback, and fulfillment reversal policy.
- Alert ownership and incident response SLA.
