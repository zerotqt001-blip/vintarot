# NaTarot SePay Implementation V1 Plan

> **For agentic workers:** follow this plan task-by-task and keep the verification evidence with the implementation.

**Goal:** Add a sandbox-only SePay Gateway payment flow to the existing Credits/VIP foundation so a member can create a server-priced order, receive a signed SePay checkout form, complete payment in SePay Sandbox, and have a verified IPN or reconciliation result drive the existing idempotent payment-confirmed and fulfillment boundary.

**Architecture:** Keep the existing `orders` state machine and `lib/orders.ts` Credits/VIP fulfillment as the domain authority. Add a provider adapter for SePay Gateway (not the separate bank-webhook product), append-only commercial payment-attempt/event persistence, and one verified-payment application service shared by IPN and reconciliation. Browser redirects remain display-only. The staging release uses the existing isolated service, database, origin, and systemd unit; production files and production data are out of scope.

**Tech Stack:** TypeScript, Cloudflare-compatible Web Crypto APIs, SQLite/D1 adapter, Drizzle schema declarations, Hono-style route handlers, Vitest, Node 22 migration scripts, SePay Gateway Sandbox REST/hosted checkout.

**Spec:** `docs/commercial/NATAROT_SEPAY_SPEC.md`, `docs/commercial/NATAROT_COMMERCIAL_ARCHITECTURE_V1.md`, `docs/commercial/NATAROT_COMMERCIAL_SECURITY.md`.

## Global constraints

- Work only in `codex/natarot-sepay-implementation-v1`; preserve the existing Credits/VIP and staging merge history.
- Sandbox/staging only. Do not deploy to production, alter the production database, alter the production service, or move real money.
- Never put merchant secrets, IPN secrets, session cookies, provider payloads, or tokens in source, fixtures, logs, Markdown, commits, or the final report.
- Use current SePay Gateway contracts: hosted form signing with the documented ordered fields, `X-Secret-Key` Gateway IPN authentication, and Basic Auth for the Sandbox REST API. Do not use generic bank-webhook contracts.
- Never trust browser redirect parameters, client amount/credit/VIP fields, or package labels as payment authority.
- Do not add Affiliate, Admin/RBAC, user-data-isolation, final UI redesign, or L6 streaming work.

## Task 1: Add provider evidence and payment-attempt persistence

**Files:**

- Add `drizzle/0007_sepay_commercial.sql`.
- Update `db/schema.ts` with typed tables/indexes for payment attempts and payment events, plus fulfillment linkage fields.
- Update `tests/node-migrate.test.ts` and add `tests/sepay-persistence.test.ts`.

**Data model:**

- `commercial_payment_attempts`: one stable attempt per internal order, provider/environment, immutable invoice number, order id, request fingerprint, provider order id hint, lifecycle status, timestamps, and no secret/payload storage.
- `commercial_payment_events`: append-only normalized provider evidence with provider/environment event key, provider order/invoice/transaction identifiers, notification/source, provider statuses/types, integer VND amount, currency, payload hash, verification state, rejection code, and received/verified timestamps. Enforce uniqueness for provider event identity and provider transaction identity per provider/environment.
- Add nullable `payment_event_id` and `updated_at` to `order_fulfillments`; preserve existing rows and defaults. The existing one-fulfillment-per-order constraint remains authoritative.

**Red-green sequence:**

1. Extend migration tests to expect migration `0007`, assert the new tables, indexes, and fulfillment columns, and verify applying all migrations to a fresh database and upgrading a `0000`–`0006` database.
2. Run the focused migration test and record the expected failure because `0007` is absent.
3. Implement the migration and schema declarations only.
4. Rerun the focused migration/persistence tests, then inspect `git diff --check`.

**Acceptance:** Migration is additive and idempotent through the existing Node migrator, does not rewrite `0006`, and supports duplicate/concurrent event handling with database uniqueness.

## Task 2: Implement pure SePay Gateway adapter primitives

**Files:**

- Add `lib/commercial/sepay-types.ts`.
- Add `lib/commercial/sepay-adapter.ts`.
- Add `lib/commercial/amount.ts`.
- Add `tests/sepay-signing.test.ts` and `tests/sepay-normalization.test.ts`.
- Extend `lib/runtime.ts` only with typed SePay environment fields needed by the adapter.

**Interfaces:**

- `getSePayConfig(env): SePayConfig` fails closed unless environment, merchant id, checkout secret, IPN secret, and public origin are present; staging must use `sandbox`.
- `buildCheckoutForm(input): { action, method, fields }` creates the exact ordered signing string for `order_amount, merchant, currency, operation, order_description, order_invoice_number, customer_id, payment_method, success_url, error_url, cancel_url`, signs it with HMAC-SHA256/base64, and returns no secret.
- `normalizeVndAmount(value)` accepts only a non-negative VND integer representation (zero-padded decimal `.00` is allowed) and returns an integer minor amount; commas, exponent notation, fractional VND, and unsafe numbers are rejected.
- `parseAndNormalizeGatewayIpn(rawBody, headers, config)` authenticates `X-Secret-Key` with constant-time comparison, parses a bounded JSON body, and returns normalized order/transaction evidence without retaining card or customer-sensitive fields.
- `buildBasicAuthHeader(config)` and `fetchOrderDetail` use the Sandbox REST base when `environment=sandbox`, with an explicit timeout and no secret in errors.

**Red-green sequence:**

1. Add the official signing vector, amount edge cases, IPN auth/malformed/status/transaction cases, and config fail-closed tests; run them to verify red.
2. Implement the smallest adapter and normalization functions.
3. Rerun focused tests until green; add a regression proving the signing field order is stable and client-controlled price/benefit fields cannot enter the signed form.

**Acceptance:** Adapter matches the current official Gateway docs, uses VND integer comparison, supports only explicit Sandbox/Production base selection, and returns safe error categories.

## Task 3: Build the verified payment state machine and fulfillment bridge

**Files:**

- Add `lib/commercial/payment-store.ts`.
- Add `lib/commercial/payment-service.ts`.
- Add `tests/sepay-payment-service.test.ts`.
- Make the minimal related change to `lib/orders.ts` so fulfillment can record the verified payment-event linkage while retaining its existing idempotent Credits/VIP grant and entitlement activation.

**Behavior:**

- `createPaymentAttempt` is idempotent by member/order and returns the same invoice/form on retry.
- `applyVerifiedSePayPayment` maps only an existing payment attempt and owner order; checks provider/environment, exact invoice, provider order id when available, `CAPTURED` order status, approved payment transaction/type, exact VND amount/currency, and a non-empty unique provider transaction id.
- Within one database transaction, insert the normalized verified event (or resolve an identical replay), mark the attempt verified/paid, and transition `PENDING` to `PAYMENT_CONFIRMED`. Conflicting reuse of an event or transaction is rejected and never fulfills.
- After durable payment confirmation, call the existing `fulfillOrder` bridge. Repeated/concurrent calls may retry idempotent grant/entitlement work but must produce one fulfillment row, one purchase grant, and one VIP entitlement.
- If fulfillment fails after verified payment is durable, preserve `PAYMENT_CONFIRMED` and return a retryable state; reconciliation retries the same fulfillment path.
- `reconcileSePayOrder` obtains a server-side provider order detail using a known provider order id or an authenticated invoice lookup followed by order detail, normalizes it into the same evidence type, and calls `applyVerifiedSePayPayment`; it must not have a second fulfillment implementation.

**Red-green sequence:**

1. Add isolated SQLite tests for checkout-attempt idempotency, exact-match verification, each mismatch, duplicate/replay, provider-transaction collision, and concurrent same-event processing; run red.
2. Implement store/service transactions and the fulfillment bridge.
3. Rerun until green, then add a regression that a failed or forged callback cannot change Credits/VIP state.

## Task 4: Add authenticated checkout, IPN, display-only return, and reconciliation routes

**Files:**

- Add `app/api/commercial/checkout/route.ts`.
- Add `app/api/commercial/sepay/ipn/route.ts`.
- Add `app/api/commercial/return/route.ts`.
- Add `app/api/commercial/orders/[id]/reconcile/route.ts`.
- Add `tests/sepay-routes.test.ts`.

**Behavior and security:**

- Checkout requires a trusted authenticated member and origin check, resolves package/version server-side, snapshots server price/credits/VIP, creates the internal order first, and returns only safe order summary plus a signed hosted-form payload.
- IPN reads raw body, authenticates current Gateway secret-key mode, defensively parses/validates, and ACKs only after durable accepted-event state. Valid duplicate/replay is a safe idempotent 200; malformed/auth/mismatch/unavailable cases never grant and use safe non-secret responses.
- Return route is owner-scoped and display-only. It may persist a provider-order-id hint for later verified reconciliation, but query parameters never mark an order paid or fulfilled.
- Reconciliation is owner-scoped, uses the provider REST adapter, and returns safe status without provider payloads or secrets. It converges through `applyVerifiedSePayPayment`.
- Any order lookup remains owner-scoped to prevent IDOR. No route accepts client amount, currency, credits, VIP duration, payment reference, or fulfillment state as authority.

**Red-green sequence:**

1. Add route tests for auth/origin, package and price tampering, IDOR, forged/malformed/wrong-amount/wrong-order/wrong-transaction IPNs, duplicates/concurrency, redirect manipulation, and reconciliation convergence; run red.
2. Implement routes using the existing boundary/identity helpers and safe JSON responses.
3. Rerun focused route/service tests and verify all existing Auth/F-001, Tarot, Share, Credits/VIP route tests remain green.

## Task 5: Add staging-only synthetic package tooling and contract tests

**Files:**

- Add `scripts/seed-staging-commercial.mjs`.
- Add `tests/staging-commercial-contract.test.ts`.
- Extend staging docs/runbook with only non-secret configuration names and the reserved IPN endpoint.

**Safety:** The seed script must require an explicit staging flag, a database path containing the isolated staging directory, and `SEPAY_ENVIRONMENT=sandbox`; it must refuse production paths/environments. It creates or verifies one clearly named synthetic VND package/version without changing pricing strategy or real member data. It must never print credentials, cookies, or database contents.

## Task 6: Validate locally before any external mutation

Run, in this order, from the SePay worktree:

1. Focused migration, adapter, payment-service, route, staging-contract, and Credits/VIP tests.
2. Auth/F-001, Tarot, Share, and all existing commercial tests.
3. Full test suite (`npm test` or the repository’s configured equivalent), typecheck, build, targeted lint, `git diff --check`, and a targeted secret scan over tracked diffs.
4. Record known unrelated global lint baseline separately; do not clean unrelated errors.

Do not deploy if any new focused test, typecheck, build, migration, or secret-scan check fails.

## Task 7: Deploy and configure staging only

After local validation and a reviewed diff:

1. Inspect SSH access without printing key material; use the existing staging host/runbook only.
2. Back up/snapshot the isolated staging database before migrations.
3. Package and deploy this branch to `/opt/natarot-staging`; run the existing migrator against only `/var/lib/natarot-staging/natarot.sqlite` so `0006` and `0007` apply.
4. Configure only staging environment variables: sandbox environment, merchant id, checkout secret, IPN secret, and public origin. Keep values server-only and out of command output/logs.
5. Restart only `natarot-staging.service`; verify the service, `https://staging.natarot.com`, health/route behavior, and production service/URL remain unchanged.
6. Configure the SePay Sandbox Gateway IPN URL exactly as `https://staging.natarot.com/api/commercial/sepay/ipn` with the current documented secret-key mode. Stop at any password/OTP/2FA/CAPTCHA/device-confirmation/permission gate.

## Task 8: Run sandbox E2E and close the loop

Use a synthetic staging member and the seeded synthetic package. Do not expose credentials or cookies.

1. Create/login the synthetic member, record baseline balance/entitlements, create the order, and inspect the signed checkout form without exposing its secret fields.
2. Complete the SePay Sandbox checkout. If a provider UI requires a human confirmation or other gate, stop exactly there and report that live E2E is blocked at that gate; do not claim completion.
3. Verify the real IPN reaches staging, order status becomes `PAYMENT_CONFIRMED`/`FULFILLED`, Credits and VIP state update exactly once, and browser redirects alone do not grant.
4. Replay the callback and exercise duplicate/concurrent delivery, mismatch rejection, restart persistence, and authenticated reconciliation. Confirm one payment event, one fulfillment, one Credits purchase grant, and one entitlement.
5. Use provider order detail to verify reconciliation converges when IPN processing is retried; keep provider data and secrets out of reports.

## Task 9: Document, commit, push, and report

- Update `docs/PROJECT_STATE.md` with the SePay implementation status, migration/deploy/E2E evidence, security-test evidence, limitations, and any human gate; do not claim live E2E beyond observed evidence.
- Inspect staged diff for secrets and unrelated files, commit only related work with a clear message, and push `codex/natarot-sepay-implementation-v1` if the existing origin allows it. Never force-push.
- Verify local HEAD equals the remote branch after push.
- Final report must include branch/commit/remote, non-secret account configuration, architecture, staging result, live E2E result, tests, explicit production flags (`DEPLOYED:NO`, `PRODUCTION DB CHANGED:NO`, `PRODUCTION SERVICE CHANGED:NO`, `REAL MONEY MOVED:NO`), Affiliate `NO`, gates/limitations, and whether it is safe to archive.
