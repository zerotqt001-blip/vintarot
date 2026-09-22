# NaTarot Product Activation and Owner Test Account Design

Date: 2026-09-23

## Outcome

Activate the already-implemented NaTarot commercial, account, affiliate,
admin, Credits/VIP, Tarot, and Share/QR surfaces on the existing production
runtime without changing the Moonlight reference aesthetic or inventing
unapproved commercial policy. The production catalog receives exactly one
active package: 1 Tarot Credit for 15,000 VND, granting one Credit.

The production package is data, not frontend business logic. Its authoritative
row is read by the existing package catalog API, server-priced order boundary,
checkout UI, order snapshot, and fulfillment path.

## Current evidence and boundaries

- Production is running the expected ten-migration schema with clean SQLite
  integrity and foreign-key checks.
- Production has no package, package version, Credit grant, VIP entitlement,
  order, affiliate profile, or audit rows.
- DeepSeek and Google OAuth are configured in production; SePay production
  values are absent; staging has separate Sandbox-only values; Resend is
  present but remains invalid until a valid owner-provided key exists.
- No production payment credential will be copied from staging, no fake order
  or bank transaction will be created, and no real money will be moved.
- The existing affiliate policy remains unchanged. A policy stays pending when
  its canonical status is not active; no commission percentage is invented.
- The full visual redesign remains out of scope. Functional discoverability,
  status copy, and responsive fixes are in scope.

## Architecture

### Production catalog

Add an idempotent `scripts/seed-production-catalog.mjs` operator script. It
must fail closed unless it is explicitly pointed at the production database,
must verify the package identity before and after insertion, and must not
delete or overwrite unrelated rows. It inserts the existing `packages` and
`package_versions` records with `amount_minor=15000`, `currency=VND`,
`credit_units=1`, no VIP benefit, and the existing package policy version.
No migration or second catalog is needed.

### Owner test account

Add a reusable `lib/owner-test/provision.ts` service and a thin
`scripts/provision-owner-test-account.ts` operator entrypoint. The entrypoint
requires a password from an operator-controlled environment/stdin path and
never prints or persists it. The service creates or verifies a normal member
row, marks it verified for first-login readiness, assigns only the existing
`ADMIN` role needed to exercise the admin surface, and reuses the existing
member-auth password format and session system.

The service grants exactly 100 non-paid Credits through `createCreditStore`
with an idempotent `OWNER_TEST_GRANT` source type, grant key, policy snapshot,
and reason. It grants a non-purchased VIP entitlement through the existing
entitlement service with the same explicit internal/test source and an
idempotent key. It may create an owner-scoped affiliate profile so the
authenticated dashboard can be exercised, but it does not create payout
state, a fake order, a payment event, or a new referral-code contract. A
system audit event records the provisioning facts without password material.

The account summary and account UI project the existing source metadata so a
test Credit/VIP grant is visibly labeled internal/test rather than paid.

### Member surfaces and checkout gate

Keep `/api/packages`, `/api/orders`, `/api/commercial/checkout`, billing,
order history, fulfillment, affiliate, admin/RBAC, Tarot credit consumption,
and Share/QR on their existing server boundaries. Update the Account surface
with explicit `Nạp Credit`, VIP-package, order-history, reading-history, and
Affiliate entry points. When no canonical VIP package exists, show the
localized equivalent of “Gói VIP đang được cập nhật”.

The Checkout page first creates the owner-scoped, server-priced pending order
through `/api/orders`, then asks the existing commercial checkout boundary for
provider data using the same idempotency key. If SePay production configuration
is missing, the order remains visible and the page explains that payment is
temporarily unavailable; it never grants benefits. If configuration is later
available, the existing SePay form and verified fulfillment path remain the
only payment path.

## Error handling and safety

- Catalog conflicts abort rather than overwrite.
- Owner-test identity conflicts abort rather than mutate an unrelated member.
- Re-running provisioning is idempotent and does not add a second grant,
  entitlement, audit fact, or affiliate profile.
- Client amount, currency, credit quantity, role, owner, and payment evidence
  remain non-authoritative.
- SePay and Resend remain explicit external gates in the final report.

## Verification and deployment

Add focused contract/service/UI tests before implementation, then run the
complete tracked Node test suite, TypeScript, production build, targeted lint,
diff checks, dependency audit, and secret-like scans. Before production data or
release mutation, create and checksum a fresh database backup, verify restore
readiness, retain the current rollback tree, deploy atomically, run migrations,
seed the catalog, provision the test account through the secure operator path,
restart only the production service, and re-check health, catalog, auth,
account, order, Tarot/DeepSeek, history, affiliate, admin/RBAC, Share/QR, and
375/390/412/desktop responsive surfaces on `https://natarot.com`.

The final report must distinguish `PASS`, `SEPAY_PRODUCTION_CREDENTIAL_GATE`,
and `RESEND_EXTERNAL_GATE`; it must not claim a live payment or email delivery
without fresh evidence.
