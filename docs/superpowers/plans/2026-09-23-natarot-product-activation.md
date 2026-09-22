# NaTarot Product Activation Implementation Plan
> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Use test-driven-development before implementation code, impeccable for the functional UI changes, and verification-before-completion before any completion claim.

**Goal:** Activate the existing NaTarot commercial and member surfaces on the production lineage with exactly one backend-defined product, a secure idempotent owner QA account, and explicit external payment/email gates.

**Architecture:** Keep the existing package catalog, server-priced order, SePay checkout, Credits/VIP ledger, member authentication, RBAC, audit, affiliate, Tarot, and Share/QR boundaries. Add only an idempotent production catalog operator, an owner-test provisioning service/operator, metadata projection for internal grants, and discoverability plus pending-state improvements to the existing account/packages/checkout UI.

**Tech Stack:** Next/Vinext App Router, TypeScript, SQLite through the existing D1 adapter, Drizzle SQL migrations, Node `node:sqlite` operator scripts, Vitest-compatible Node test runner, React client pages, existing Moonlight/NaTarot CSS, systemd/Nginx production runtime.

**Spec:** `docs/superpowers/specs/2026-09-23-natarot-product-activation-design.md`

## Global Constraints

- Work only in `/Users/tranquangthanh/.codex/worktrees/natarot-product-activation/test astra` on `codex/natarot-product-activation`.
- Preserve the Moonlight reference aesthetic and NaTarot branding; make only targeted functional/discoverability UI changes.
- Keep the single approved package authoritative in the database: `1 Tarot Credit`, `15,000 VND`, `1` Credit. Do not add VIP price, duration, benefit, commission, or payout policy.
- Do not copy staging Sandbox credentials into production, create fake orders/payments, print or commit passwords, or add client-side privilege/payment/credit authority.
- Use `apply_patch` for source edits. Keep `.env`, database files, session material, secrets, screenshots containing secrets, and build output out of Git.
- Every implementation task starts with a failing focused test or contract assertion, then the smallest implementation, then the focused test and relevant regression suite.
- Before production mutation: inspect the staged diff for secrets, create a fresh checksummed database backup, retain rollback state, and use one production worker only.

---

## Task 1: Lock the product and owner-provisioning contracts with tests

**Files:** Add `tests/production-catalog-contract.test.ts`, `tests/owner-test-provision.test.ts`; inspect existing test helpers in `tests/` and `lib/`.

**Tests:**

1. Add a production-catalog contract test that asserts the operator entrypoint contains the exact approved identity/value set and closed production-path guards, and rejects staging/Sandbox configuration.
2. Add owner-provisioning service tests against an isolated SQLite database: first run creates a verified normal member with `ADMIN`, exactly 100 Credits, one internal VIP entitlement, an owner affiliate profile, and one system audit event; a second run is idempotent; unrelated existing identity conflicts fail closed; password material never appears in the returned result or audit metadata.
3. Run the focused tests and confirm they fail for the missing implementation.

**Acceptance:** The tests express the no-fake-payment, exactly-100-Credits, internal-source, idempotency, and conflict requirements without depending on production credentials or a live database.

## Task 2: Implement the idempotent production catalog operator

**Files:** Add `scripts/seed-production-catalog.mjs`; add or update the focused catalog contract test only as needed.

**Implementation:**

1. Use the existing SQLite schema and package catalog conventions; do not add a migration or a second catalog.
2. Require an explicit production seed flag, `NODE_ENV=production`, and the exact production database path; reject staging paths and any SePay Sandbox variables.
3. Insert-or-verify one package and one active version with `amount_minor=15000`, `currency=VND`, `credit_units=1`, no VIP benefit, and stable deterministic identifiers. Abort on identity/value conflicts and leave unrelated rows untouched.
4. Verify the final row values and active-version count, then print only non-sensitive operator metadata.

**Verification:** Run the focused catalog test, execute a temp-database dry run only if the script exposes a safe test seam, run `git diff --check`, and manually review the SQL/value contract.

## Task 3: Implement the owner-test provisioning service and operator entrypoint

**Files:** Add `lib/owner-test/provision.ts`, `scripts/provision-owner-test-account.ts`; update `tests/owner-test-provision.test.ts`.

**Implementation:**

1. Reuse `member-auth` hashing and session-compatible member rows. Create or verify the exact configured owner-test identity, mark it email-verified, assign only `ADMIN`, and fail closed if the requested identity collides with another member.
2. Grant exactly 100 Credits through `createCreditStore` with stable `OWNER_TEST_GRANT` source metadata, a deterministic grant key, an explicit internal QA reason, and no order/payment reference.
3. Grant a permanent internal QA VIP entitlement through `activateEntitlement` with stable `OWNER_TEST_GRANT` source metadata and deterministic idempotency; do not represent it as a purchase.
4. Create an owner-scoped affiliate profile only when absent. Do not create conversions, payout state, or a new referral-link contract.
5. Append one redacted system audit event. Ensure all reruns are idempotent and no password enters results, logs, database metadata, or source control.
6. Make the thin operator script read a password from an explicit environment variable or stdin, require a production opt-in and production DB path, refuse staging, and print only account/result metadata.

**Verification:** Run focused service tests, then the relevant member-auth, credits, entitlements, affiliate, audit, and API tests. Review the diff and scan for password-like literals before committing.

## Task 4: Project internal/test provenance and member navigation in the UI

**Files:** Update `lib/account-history.ts`, `components/account/account-history.tsx`, `app/account/page.tsx`, `app/commerce/commerce-pages.tsx`, `lib/i18n.ts`, and `app/globals.css`; add/update account/UI tests in `tests/`.

**Implementation:**

1. Extend account summary VIP data with existing entitlement source metadata and an internal-test flag; keep the projection owner-scoped.
2. Add explicit Account CTAs for `Nạp Credit`, VIP packages, order history, reading history, and Affiliate. Preserve existing Profile/Admin access behavior.
3. Label the 100-Credit ledger activity and internal VIP entitlement as owner QA/internal, not paid or purchased. Keep source/reason traceable.
4. Add the localized VIP pending state equivalent to `Gói VIP đang được cập nhật` whenever no canonical VIP package is returned. Do not render invented pricing or benefits.
5. Keep styling within the existing Moonlight/NaTarot tokens and add only small responsive rules for the new actions/status labels.

**Verification:** Run focused account/commerce tests at mobile and desktop component widths where existing helpers support it; run TypeScript and relevant route tests; inspect the rendered markup for exact CTA/status text in both locales.

## Task 5: Make checkout visibly useful while preserving the payment gate

**Files:** Update `app/commerce/commerce-pages.tsx`; add/update checkout tests.

**Implementation:**

1. On submit, create the member-owned server-priced pending order through `/api/orders` first.
2. Reuse its idempotency key when calling `/api/commercial/checkout`; never send client amount, currency, Credit quantity, VIP, or fulfillment fields.
3. If SePay configuration is unavailable, retain and display the pending order plus a clear localized payment-unavailable state; do not grant Credits/VIP.
4. Preserve the existing SePay form and verified callback/fulfillment path when production credentials are present.

**Verification:** Add tests for order-first sequencing, client tamper rejection through existing API coverage, pending-order visibility on a 503 gate, and no fulfillment on the gate. Run all focused checkout/order tests.

## Task 6: Local regression, security review, and integration commit

**Files:** Update `docs/PROJECT_STATE.md` only after verified local implementation; no unrelated files.

**Verification:** Run, in order, focused tests, the complete tracked Node test suite, `npx tsc --noEmit`, `npm run build`, targeted lint if configured, `git diff --check`, and dependency/security checks available in the repository. Scan tracked diffs for secrets, staging credentials, fake payment artifacts, and password literals. Inspect the staged diff, then commit related changes with clear messages.

**Acceptance:** Local evidence is recorded; no production mutation happens before the clean commit is pushed to `origin/codex/natarot-product-activation`.

## Task 7: Production backup, atomic deployment, catalog seed, and owner account provisioning

**Files:** No production database or secrets enter Git. Update `docs/PROJECT_STATE.md` with evidence and external gates after completion.

**Implementation and verification:**

1. Push the verified branch and confirm the remote commit.
2. On the VPS, create a fresh timestamped backup of `/var/lib/natarot/natarot.sqlite`, checksum it, run read-only integrity/foreign-key checks against the backup, and retain the current rollback tree. Do not delete existing backups or staging data.
3. Transfer the clean application artifact without `.env`, databases, sessions, logs, or `node_modules`; install dependencies remotely and perform an atomic release while preserving the service’s existing env and runtime paths.
4. Run the existing migration runner, then the production catalog seed with its explicit guard. Restart only `natarot.service`; verify systemd status and `/api/health`.
5. Provision the owner test account through the secure stdin/keychain path. Do not print the generated password. Verify database counts and account summary without exposing password material.
6. Probe production package, account/auth, order, checkout gate, Tarot/DeepSeek, history, affiliate, admin/RBAC, Share/QR, Google configuration, and Resend/SePay status. Confirm ordinary users remain unauthorized for admin mutations.
7. Capture fresh production responsive evidence at 375/390/412 and desktop widths, including the package catalog, owner Account Credit/VIP state, checkout gate, admin surface, and relevant history/share surfaces when authenticated state is available.

**Acceptance:** Production has exactly one approved active package, the owner account is a real normal-auth member with the requested internal QA grants, no fake payment/fulfillment exists, and the final report distinguishes `PASS`, `SEPAY_PRODUCTION_CREDENTIAL_GATE`, and `RESEND_EXTERNAL_GATE` with evidence and remaining work.
