# NaTarot — SePay Payment Specification V1

**Status:** DOCUMENTATION-ONLY / OFFICIAL RESEARCH CAPTURED / NOT IMPLEMENTED / NOT DEPLOYED
**Date of research:** 2026-09-21
**Provider:** SePay Payment Gateway
**NaTarot scope:** one-time VND package checkout using the gateway’s bank-transfer/VietQR method first

This document records current official SePay concepts and the NaTarot decisions built on them. It contains no credentials, no migration, no provider runtime code, and no production configuration.

## 1. Recommendation

Use the SePay Payment Gateway as the initial commercial payment adapter:

```text
NaTarot server order
  → signed SePay one-time checkout form
  → SePay hosted checkout
  → customer completes VND bank transfer/VietQR
  → SePay IPN
  → NaTarot authenticates and verifies the event
  → internal payment event
  → idempotent order fulfillment
```

NaTarot will not activate a second direct bank-webhook/VietQR implementation in V1. A direct bank-webhook path remains a future provider alternative requiring a separate payment-code, bank-account, reconciliation, security, and operations review.

## 2. Source quality and current official references

The following official sources were checked on 2026-09-21. Provider behavior below is limited to what those pages state.

| Official source | Verified concepts used here |
| --- | --- |
| [SePay Payment Gateway overview](https://developer.sepay.vn/en/cong-thanh-toan/gioi-thieu) | Gateway supports VietQR/bank transfer, NAPAS QR, and cards; the merchant receives payment status through IPN; return URLs are not the sole confirmation path; production and sandbox API hosts are separate. |
| [Payment flow](https://developer.sepay.vn/en/cong-thanh-toan/luong-thanh-toan) | One-time flow: merchant order, signed form, hosted payment, callback, IPN, return/display result. Recurring payment is documented as coming later. |
| [Create payment order/form](https://developer.sepay.vn/en/cong-thanh-toan/API/don-hang/form-thanh-toan) | Checkout endpoint, fields, VND currency, `PURCHASE` operation, unique invoice number, HMAC-SHA256 signing field order, provider order/transaction identifiers. |
| [IPN](https://developer.sepay.vn/en/cong-thanh-toan/IPN) | Public HTTPS IPN, `ORDER_PAID` and `TRANSACTION_VOID`, order/transaction/customer payload shape, `X-Secret-Key` when the configured IPN authentication mode is secret-key, and HTTP 200 acknowledgement. |
| [Payment Gateway API overview](https://developer.sepay.vn/en/cong-thanh-toan/API/tong-quan) | Gateway REST API hosts and Basic Auth for merchant API calls. |
| [Sandbox Gateway](https://developer.sepay.vn/vi/cong-thanh-toan/sandbox) | Isolated sandbox hosts, separate sandbox credentials, simulated transactions, IPN/callback testing without real money. |
| [Order detail API](https://developer.sepay.vn/vi/cong-thanh-toan/API/don-hang/chi-tiet-don-hang) | Server-side order detail and transaction lookup, status values such as `CAPTURED`, `CANCELLED`, and `AUTHENTICATION_NOT_NEEDED`. |
| [Generic SePay webhooks](https://developer.sepay.vn/en/sepay-webhooks/xac-thuc) | A separate bank-webhook product supports HMAC-SHA256/API Key/OAuth/none. This is a future alternative, not the V1 gateway IPN contract. |

### 2.1 Official behavior vs NaTarot decisions

| Topic | Verified SePay behavior | NaTarot design decision |
| --- | --- | --- |
| Checkout | SePay documents a one-time hosted checkout form and signed fields | The server creates the internal order and generates the form; the browser only submits the already-derived form |
| Payment method | Gateway supports bank transfer/VietQR and other methods; V1 starts with VND bank transfer/VietQR | Do not expose unapproved methods in the package/catalog contract |
| Return URLs | SePay redirects to success/error/cancel URLs | Redirects are display-only; never transition an order to `PAID` |
| IPN | SePay sends a payment notification to a public HTTPS endpoint | IPN is the primary payment signal, but still requires NaTarot verification |
| IPN authentication | Current gateway IPN documentation shows `X-Secret-Key` when that IPN auth mode is configured | Confirm the selected merchant IPN auth mode before implementation and verify the exact raw request contract in sandbox; do not substitute generic webhook HMAC headers without evidence |
| Reconciliation | SePay documents REST order detail/list APIs | Reconcile pending, ambiguous, failed, and provider-retry cases by server-side order identity |
| Duplicate events | Provider systems can retry notifications; the gateway docs expose stable order/transaction identifiers | Use unique provider/environment/event and transaction keys; duplicate identical events return the existing internal result |
| Sandbox | SePay documents an isolated sandbox with separate hosts/credentials and simulated flow | Staging must use sandbox first; production credentials are never used for staging |

## 3. Environment endpoints

The official sandbox page distinguishes the checkout host from the REST API host:

| Environment | Checkout form action | REST API base |
| --- | --- | --- |
| Sandbox | `https://pay-sandbox.sepay.vn/v1/checkout/init` | `https://pgapi-sandbox.sepay.vn` |
| Production | `https://pay.sepay.vn/v1/checkout/init` | `https://pgapi.sepay.vn` |

The `merchant_id` and `secret_key` are environment-specific. The values must be stored only in the server runtime secret manager/environment and must never be committed, printed, sent to the browser, or written into order snapshots.

The exact merchant environment and IPN configuration must be confirmed during the authorized implementation milestone. This document intentionally records host names and variable concepts, not secret values.

## 4. Checkout contract

### 4.1 Internal order first

Before any provider form is generated, NaTarot must have:

- an authenticated member identity;
- an active immutable package version;
- a server-calculated integer VND amount;
- an immutable invoice number;
- a package snapshot;
- an order expiry;
- a member-scoped idempotency key and request fingerprint.

The client may request a package/version identifier, but the server must resolve and snapshot the amount, currency, credits, validity, and VIP benefit set.

### 4.2 Form fields

The official one-time checkout form documents these concepts:

| Field | NaTarot rule |
| --- | --- |
| `merchant` | Server-side configured SePay merchant identifier; never client-authoritative |
| `currency` | `VND` for the approved V1 scope |
| `order_amount` | Internal order amount in the provider’s documented smallest unit; derive from the order snapshot |
| `operation` | `PURCHASE` for a package purchase; `VERIFY` is not a purchase fulfillment signal |
| `order_description` | Safe, non-sensitive description generated by the server |
| `order_invoice_number` | NaTarot-generated unique invoice number; maps to exactly one internal order |
| `payment_method` | `BANK_TRANSFER` for the initial V1 focus when the merchant configuration supports it |
| `customer_id` | Optional provider field; use only if the verified provider contract and privacy policy require it |
| `success_url` | Display-only return route containing an opaque internal order reference, not proof of payment |
| `error_url` | Display-only failure route |
| `cancel_url` | Display-only cancellation route |
| `signature` | Server-computed HMAC-SHA256 form signature |

The form must preserve the provider-documented allowed signing fields and their order:

```text
order_amount,
merchant,
currency,
operation,
order_description,
order_invoice_number,
customer_id,
payment_method,
success_url,
error_url,
cancel_url
```

The provider documentation warns that field order matters. The implementation must use one tested canonical signing helper and a fixed contract test vector; it must not build the signing string by iterating an arbitrary object key order.

### 4.3 Checkout output

The future order API returns a safe checkout instruction such as:

```text
{
  orderId,
  invoiceNumber,
  providerEnvironment,
  checkoutAction,
  formFields,
  expiresAt,
}
```

It must not return the merchant secret or any internal account credential. The browser may submit the form or navigate to the hosted checkout, but it cannot alter the signed amount, invoice, package snapshot, or member identity.

## 5. IPN contract

### 5.1 Transport

The IPN endpoint must be a public HTTPS endpoint reachable by SePay. It reads the raw request body before JSON parsing when the configured provider authentication requires raw bytes. It validates the configured gateway IPN authentication header using constant-time comparison and rejects missing/incorrect credentials.

The Payment Gateway IPN documentation currently shows:

- `Content-Type: application/json`;
- `X-Secret-Key` when the merchant configures secret-key authentication;
- body `timestamp`;
- `notification_type` of `ORDER_PAID` or `TRANSACTION_VOID`;
- nested `order`, `transaction`, and `customer` objects.

The generic SePay bank-webhook HMAC contract is not interchangeable with the Payment Gateway IPN contract. If SePay changes the configured gateway IPN authentication mode, the implementation must update the adapter contract and sandbox tests before activation.

### 5.2 Normalized IPN fields

The adapter should normalize, without trusting, these provider fields:

```text
provider = "sepay-gateway"
environment = "sandbox" | "production"
notificationType = "ORDER_PAID" | "TRANSACTION_VOID"
providerOrderId = order.id or order.order_id according to the verified provider mapping
providerInvoiceNumber = order.order_invoice_number
providerOrderStatus = order.order_status
providerTransactionId = transaction.id or transaction.transaction_id according to the verified provider mapping
providerTransactionStatus = transaction.transaction_status
providerTransactionType = transaction.transaction_type
amount = order.order_amount and transaction.transaction_amount
currency = order.order_currency and transaction.transaction_currency
providerTimestamp = timestamp
destinationContext = configured account/merchant context where available
payloadHash = SHA-256(rawBody)
```

The final provider mapping must be fixed by a sandbox fixture and verified against the actual merchant account. A provider field name is not an internal identity until the mapping is tested.

### 5.3 Verification algorithm

For `ORDER_PAID`, the future handler performs these checks in order:

1. Confirm the request arrives at the intended gateway IPN route over HTTPS.
2. Authenticate the configured IPN header; do not accept an unauthenticated request.
3. Parse and validate the required shape and field types.
4. Reject stale/future timestamps according to an approved clock-skew policy; record the reason without fulfilling.
5. Locate the internal order by the immutable invoice/provider order mapping, never by a client-submitted member ID.
6. Confirm the provider/environment matches the payment attempt.
7. Confirm provider order ID and invoice number match the stored attempt/order.
8. Confirm the provider order is successful (`CAPTURED` in the documented gateway status model) and the transaction is an approved payment of the expected type.
9. Compare expected VND amount with both provider order amount and transaction amount using integer normalization; reject mismatch.
10. Compare order and transaction currency with the immutable order currency.
11. Confirm transaction identity is not already attached to a different order.
12. Confirm destination/merchant/account context where the provider payload and merchant configuration make that field available.
13. Insert one normalized `payment_events` row under unique provider/environment/event and transaction identities.
14. Conditionally transition the order to `PAID` and create/reuse its one `fulfillment` row.
15. Return the documented success acknowledgement only after the payment event is durably recorded.

`TRANSACTION_VOID` does not create a new fulfillment. It creates a unique compensating payment event and starts the refund/reversal policy path.

### 5.4 Acknowledgement behavior

| Condition | Response behavior | Business effect |
| --- | --- | --- |
| Invalid auth or impossible transport | Non-success response | No event processing; provider may retry; no fulfillment |
| Valid auth but permanent schema/order/amount mismatch | Durable rejected audit where possible, then acknowledge | No payment, order, or entitlement transition |
| Valid verified event committed | Documented success acknowledgement | Exactly one payment event; fulfillment may be pending/retryable |
| Database unavailable before durable event commit | Non-success response | Provider retry remains useful |
| Verified event already known with identical fingerprint | Documented success acknowledgement | Return existing payment/fulfillment result; no duplicate grant |
| Same provider identity with conflicting payload | Durable conflict/manual-review state | No fulfillment; block automatic transition |

## 6. Reconciliation contract

### 6.1 When reconciliation runs

Reconciliation is required for:

- a pending order near expiry;
- a browser return without an IPN;
- an IPN that was accepted but fulfillment failed;
- a provider timeout after form submission;
- a payment event whose order/transaction mapping is ambiguous;
- a refund/void that may have arrived out of order;
- a support request for an order that does not match local state.

### 6.2 Provider lookup

The official Gateway REST API uses Basic Auth against the environment-specific API base. The order-detail endpoint is documented as:

```text
GET /v1/order/detail/{order_id}
```

The implementation must look up only a server-known provider order ID or invoice mapping. It must validate the returned order amount, currency, order status, transaction list, transaction status, transaction amount, transaction currency, and transaction identity against the local snapshot before treating the result as verified.

The API response itself is evidence to process through the same payment state machine, not a shortcut around local uniqueness or fulfillment idempotency.

### 6.3 Reconciliation outcomes

| Outcome | Local action |
| --- | --- |
| Provider confirms paid and local event absent | Insert one verified payment event and run idempotent fulfillment |
| Provider confirms pending | Keep order `PENDING`; retry within policy |
| Provider confirms cancelled | Mark order `CANCELLED` only if no verified payment exists |
| Provider confirms void/refund | Append compensating payment event and follow refund policy |
| Provider response conflicts with local snapshot | Mark manual review; do not fulfill or reverse automatically |
| Provider unavailable/rate limited | Keep retryable state with bounded backoff; do not assume failure or success |

## 7. Idempotency and concurrency

Required uniqueness:

```text
one member + order idempotency key
one internal invoice number
one provider environment + provider event ID
one provider environment + provider transaction ID
one order + fulfillment
one fulfillment idempotency key
one provider refund/void reference
```

The order/payment/fulfillment path must use one database transaction for each invariant-changing operation or the final Credits/VIP service transaction boundary. It must not use:

- a client amount as a write authority;
- check-then-insert without a unique constraint;
- an application-only lock with no database guard;
- a second grant after a timeout without reading the existing fulfillment;
- a provider retry as proof that the first local transaction failed.

The mandatory race test is:

```text
same verified payment event
  → two concurrent IPN/reconciliation handlers
  → one payment event
  → one PAID transition
  → one fulfillment
  → one Credits/VIP grant set
```

## 8. Secrets and operational controls

The future implementation will use server-only configuration names, for example:

```text
SEPAY_ENVIRONMENT
SEPAY_MERCHANT_ID
SEPAY_SECRET_KEY
SEPAY_IPN_SECRET
```

These names are illustrative contracts, not provisioned values. Secrets must remain in the authorized runtime secret store, never in the repository, browser payload, order snapshot, database log, test fixture, screenshot, or error message. Rotate by environment, and treat a suspected leak as a provider credential-replacement event.

Logs may include order ID, environment, provider order/transaction identifiers, status, amount, currency, verification decision, and latency. Logs must redact authorization headers, IPN secrets, raw credentials, full card data, and unnecessary customer data.

## 9. Sandbox/staging sequence

Before any production activation:

1. Create a dedicated staging application/database and an isolated SePay sandbox merchant.
2. Configure sandbox checkout and REST API hosts separately.
3. Configure a public HTTPS staging IPN endpoint.
4. Use SePay sandbox simulated payments and test-send tools.
5. Verify success, error, cancel, pending, duplicate, delayed, and out-of-order notifications.
6. Verify wrong secret, stale timestamp, wrong invoice, wrong amount, wrong currency, wrong transaction status, and wrong destination handling.
7. Verify reconciliation when the browser closes before redirect or IPN delivery is delayed.
8. Verify Credits/VIP fulfillment exactly once under duplicate and concurrent delivery.
9. Verify refund/void reversal semantics and affiliate hold/reversal behavior.
10. Capture request/response metadata without recording credentials.
11. Obtain release review and explicit production authorization before switching hosts or secrets.

The production endpoint must never be the first environment tested.

## 10. Implementation readiness checklist

The SePay milestone is ready to start only when all are true:

- Credits/VIP V1 has a reviewed fulfillment interface;
- package/version and order snapshot contracts are implemented or explicitly approved;
- migration and backup/rollback plans are reviewed in their own mission;
- sandbox credentials are provisioned outside the repository;
- the IPN authentication mode and payload mapping are confirmed with a sandbox fixture;
- server-side amount/currency/order/transaction/destination verification tests exist;
- duplicate, replay, concurrency, out-of-order, timeout, refund, and reconciliation tests exist;
- production secrets and deployment are explicitly authorized.

## 11. Current status

| Item | State |
| --- | --- |
| Official SePay research | VERIFIED on 2026-09-21 |
| Gateway model choice | DESIGNED: Payment Gateway + IPN + order-detail reconciliation |
| Direct bank webhook path | FUTURE ALTERNATIVE ONLY |
| Runtime adapter | NOT IMPLEMENTED |
| Sandbox merchant | NOT PROVISIONED by this mission |
| Production merchant | NOT PROVISIONED/TOUCHED by this mission |
| Credentials | NOT REQUESTED/RECORDED |
| Database migration | NOT CREATED |
| Deployment | NOT PERFORMED |
