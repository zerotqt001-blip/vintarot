# NaTarot Backend Completion V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement and locally verify NaTarot’s remaining non-visual backend capabilities: Affiliate V1, logical data/security boundaries, encryption and audit primitives, server-side RBAC/admin operations, and owner-scoped account/history APIs with functional-only verification surfaces.

**Architecture:** Preserve the existing F-001/Auth, D1/SQLite, Credits/VIP, order, Tarot, and share contracts. Add one additive `0007_backend_completion.sql` migration, small NaTarot-native domain services, a fixed server-side permission matrix, an encrypted-field abstraction, an append-only audit table, and an explicit verified-fulfillment affiliate event adapter. Admin/account routes derive owners from the existing session identity and never trust client IDs or roles.

**Tech Stack:** React 19, TypeScript, Vinext/Vite, Cloudflare D1-compatible SQL, Node `node:sqlite`, Drizzle schema declarations, Web Crypto AES-GCM, Zod, Node `node:test` through `tsx`, existing NaTarot route/repository/service patterns.

**Spec:** `docs/superpowers/specs/2026-09-21-natarot-backend-completion-design.md`

## Global Constraints

- Work only in `codex/natarot-backend-completion-v1`, based on `fd7d8fe14c86a282d9319d79fef73ee654ae5032`; do not modify the staging or SePay worktrees.
- Preserve F-001 trusted identity, Google OAuth, guest ownership, existing Auth semantics, Tarot AI/KB V5, L1/L4/L5/L7/L8, Share S1–S6, Credits invariants, VIP fulfillment, backup/DR, and production runtime.
- Do not implement SePay, provider payment verification, checkout, payouts, production/staging migrations, production credentials, KMS/Vault provisioning, deployment, restart, merge, force-push, or real-money movement.
- Do not renumber `0000`–`0006`; add only `drizzle/0007_backend_completion.sql` and verify fresh/upgrade local fixtures.
- New screens are `FUNCTIONAL UI — NOT FINAL DESIGN`; do not redesign Home, Room, Reading Result, Auth, Profile, or the Liquid Glass system.
- Every production-code behavior follows RED → expected failure → minimal GREEN → focused regression → refactor while green.
- Every privileged mutation requires a reason, server-derived actor, idempotency key where the domain is retryable, audit coverage, and no-store safe responses.

---

### Task 1: Record external research, classifications, and operational boundaries

**Files:**
- Create: `docs/research/NATAROT_BACKEND_COMPLETION_RESEARCH.md`
- Create: `docs/security/NATAROT_DATA_CLASSIFICATION.md`
- Create: `docs/security/NATAROT_SECURITY_ARCHITECTURE.md`
- Create: `docs/security/NATAROT_RBAC_PERMISSION_MATRIX.md`
- Create: `docs/security/NATAROT_AUDIT_ARCHITECTURE.md`
- Create: `docs/account/NATAROT_ACCOUNT_HISTORY_V1.md`
- Create: `docs/operations/NATAROT_BACKEND_COMPLETION_OPERATIONS.md`
- Test: `tests/backend-completion-documentation.test.ts`

**Interfaces:**
- Produces the source-grounded decisions consumed by every later task.
- The research table must record repository URL, exact observed HEAD/tag, SPDX/license evidence, activity evidence, useful patterns, incompatible assumptions, security concerns, and one of `ADOPT`, `ADAPT`, `REFERENCE ONLY`, or `REJECT`.
- The classification document must label public, internal, PII, auth secret, commercial, financial metadata, Tarot-private, audit, and operational fields without real customer values.
- The RBAC document must use the exact role and permission names implemented in Task 4.

- [ ] **Step 1: Write the failing documentation contract test.** Assert that every required document exists, includes the base commit, explicitly says logical isolation is not physical separation, names SePay as reference-only, contains all six roles, and has no credential-shaped literals.
- [ ] **Step 2: Run the documentation test.** Run `npx tsx --test tests/backend-completion-documentation.test.ts`; it must fail because the seven durable documents do not yet exist.
- [ ] **Step 3: Write the documents from observed evidence.** Include official links to Better Auth Admin, OpenFGA modeling/testing, node-casbin, Medusa payment/order event docs, Node crypto, and SePay; include exact commits `41b7dc15de41a8726422c392a4857d8764828891`, `ab557c5592670c899de35297e7aa067015f06502`, `aad42ce2be70908bbc76c5b89b505cf0655245e8`, `f85c5ca1576c8234ca851a944babf04f913f9f92`, `0cfdb2cdc180db9a6729d0b44e38c6a2b609ed1e`, `3251abbb9bb2b0b2d6d6969e9963940d0abf28f3`, and `62178220f36cda2f6657731ef182ecd84dd67e2f`.
- [ ] **Step 4: Run the documentation test and secret-shaped scan.** Run `npx tsx --test tests/backend-completion-documentation.test.ts` and `rg -n -i '(sk-[A-Za-z0-9]{20,}|-----BEGIN (RSA|EC|OPENSSH|PRIVATE) KEY-----|AKIA[0-9A-Z]{16}|ghp_[A-Za-z0-9]{20,}|AIza[0-9A-Za-z_-]{20,})' docs/research/NATAROT_BACKEND_COMPLETION_RESEARCH.md docs/security docs/account docs/operations`; expected result is all tests passing and no matches.
- [ ] **Step 5: Commit the research/docs checkpoint.** Run `git add docs/research docs/security docs/account docs/operations tests/backend-completion-documentation.test.ts && git diff --cached --check && git commit -m "docs: record backend completion research and boundaries"`.

### Task 2: Add the additive schema/migration and migration regression fixtures

**Files:**
- Modify: `db/schema.ts`
- Create: `drizzle/0007_backend_completion.sql`
- Modify: `scripts/node-migrate.mjs` only if the existing deterministic filename runner needs no behavior change; otherwise leave it unchanged
- Create: `tests/backend-completion-migration.test.ts`
- Modify: `tests/node-migrate.test.ts` with the `0007` ordering assertion

**Interfaces:**
- Produces tables consumed by `lib/security`, `lib/audit`, `lib/admin`, `lib/affiliate`, and account-history services.
- Auth additions: `members.role` default `USER` with the six-role check, `disabled_at`, `disabled_reason`, `disabled_by`; `auth_sessions.session_id` generated/backfilled and uniquely indexed.
- Domain tables: `audit_events`, `affiliate_profiles`, `referral_codes`, `referral_attributions`, `affiliate_policy_versions`, `affiliate_policy_tiers`, `affiliate_conversions`, `affiliate_commission_ledger`.
- All new IDs are opaque text; all timestamps are integer milliseconds; all financial amounts are non-negative integer minor units; all status fields have explicit checks; all event/idempotency keys have unique indexes.

- [ ] **Step 1: Write migration tests before SQL.** Create an in-memory SQLite fixture that applies the checked-in `0000`–`0006` files, then assert that `0007` is the next lexicographic migration, adds the auth columns and session IDs, creates all new tables/indexes/checks, and leaves existing members, sessions, rooms, readings, shares, credit accounts, orders, fulfillments, and commercial events readable.
- [ ] **Step 2: Run the migration tests to verify RED.** Run `npx tsx --test tests/backend-completion-migration.test.ts tests/node-migrate.test.ts`; expected failure is missing `0007` tables/columns.
- [ ] **Step 3: Add `drizzle/0007_backend_completion.sql`.** Use additive `ALTER TABLE` statements for existing auth tables, deterministic `UPDATE auth_sessions SET session_id = lower(hex(randomblob(16))) WHERE session_id IS NULL`, unique/index constraints, and `CREATE TABLE`/`CREATE INDEX` statements for the new domain tables. Seed one explicitly non-final `affiliate-v1-default` policy row with normalized tier rows and 30-day attribution/7-day hold values.
- [ ] **Step 4: Add matching Drizzle declarations.** Define the new application tables and indexes in `db/schema.ts`; keep raw Auth tables represented by the migration because they are already outside the current Drizzle schema.
- [ ] **Step 5: Run fresh and upgrade migration tests.** Run `npx tsx --test tests/backend-completion-migration.test.ts tests/node-migrate.test.ts tests/tarot-migration.test.ts`; expected result is PASS with existing row counts and foreign keys intact.
- [ ] **Step 6: Commit the migration checkpoint.** Run `git add db/schema.ts drizzle/0007_backend_completion.sql tests/backend-completion-migration.test.ts tests/node-migrate.test.ts && git diff --cached --check && git commit -m "feat: add backend completion persistence schema"`.

### Task 3: Implement encrypted fields, safe metadata redaction, and the audit service

**Files:**
- Create: `lib/security/encryption.ts`
- Create: `lib/security/redaction.ts`
- Create: `lib/audit/types.ts`
- Create: `lib/audit/service.ts`
- Modify: `lib/runtime.ts` with `NATAROT_PII_KEY_V1`/keyring configuration types only
- Create: `tests/security-encryption.test.ts`
- Create: `tests/audit-service.test.ts`

**Interfaces:**
- `encryptField(plaintext, purpose, keyring): string` and `decryptField(ciphertext, purpose, keyring): string` use AES-256-GCM, 12-byte random IV, authenticated purpose, versioned format, and key IDs.
- `redactAuditMetadata(value: unknown): Record<string, unknown>` removes or masks password/hash/token/cookie/secret/API-key/authorization/payment-secret/email/phone/question/reading-payload keys, bounds depth and string/array/object sizes, and never throws on hostile input.
- `createAuditService(database, now)` exposes `append(input)`, `list(filter)`, and `redactMetadata`; it writes only insert statements and returns safe projections.

- [ ] **Step 1: Write failing crypto/redaction/audit tests.** Cover round-trip, tamper failure, wrong purpose failure, missing historical key failure, key rotation, empty/oversized input, recursive sensitive-key removal, append/list actor fields, duplicate event idempotency, and absence of update/delete methods.
- [ ] **Step 2: Run the focused tests to verify RED.** Run `npx tsx --test tests/security-encryption.test.ts tests/audit-service.test.ts`; expected failure is missing modules/exports.
- [ ] **Step 3: Implement the Web Crypto keyring.** Parse test/runtime base64url keys without logging them; reject non-32-byte keys; encode `natarot-pii:v1:<keyId>:<iv>:<tag>:<ciphertext>`; use `crypto.subtle.encrypt/decrypt` with `purpose` as additional authenticated data; return fixed safe errors.
- [ ] **Step 4: Implement bounded metadata redaction and audit inserts.** Canonicalize metadata, redact sensitive keys case-insensitively, cap serialized size, insert `audit_events` with a unique event ID, and map list rows without raw metadata leakage. Do not add a false hash-chain claim.
- [ ] **Step 5: Run focused security/audit tests and `git diff --check`.** Expected result is all focused tests PASS and no diff errors.
- [ ] **Step 6: Commit the security primitives checkpoint.** Run `git add lib/security lib/audit lib/runtime.ts tests/security-encryption.test.ts tests/audit-service.test.ts && git diff --cached --check && git commit -m "feat: add encrypted fields and audit primitives"`.

### Task 4: Add server-side RBAC, member status/session management, and admin authorization

**Files:**
- Create: `lib/admin/permissions.ts`
- Create: `lib/admin/context.ts`
- Create: `lib/admin/member-service.ts`
- Modify: `lib/member-auth.ts` to write/read opaque `session_id` and expose internal session list/revoke helpers without changing public auth views
- Create: `tests/admin-rbac.test.ts`
- Modify: `tests/auth-handlers.test.ts` or `tests/member-auth.test.ts` with session-ID/ban regression coverage

**Interfaces:**
- `type AdminRole = "USER" | "SUPPORT" | "FINANCE" | "CONTENT_ADMIN" | "ADMIN" | "SUPER_ADMIN"`.
- `type Permission = "admin.users.read" | "admin.users.status" | "admin.roles.manage" | "admin.sessions.read" | "admin.sessions.revoke" | "admin.credits.adjust" | "admin.vip.adjust" | "admin.orders.read" | "admin.affiliate.read" | "admin.affiliate.manage" | "admin.affiliate.adjust" | "admin.audit.read" | "admin.security.manage"`.
- `requirePermission(request, permission, database): Promise<AdminActor>` derives member ID from the existing cookie-backed `identity`, re-reads role/disabled state, and returns 401/403 safely.
- `listMembers`, `getMemberDetail`, `setMemberStatus`, `setMemberRole`, `listMemberSessions`, and `revokeMemberSession` accept server-derived actor context, target opaque member IDs, mandatory reasons for mutations, and idempotency keys where repeated state changes are possible.

- [ ] **Step 1: Write the failing role matrix and spoofing tests.** Test every role boundary: USER denied admin, SUPPORT denied finance, FINANCE denied super-admin/role changes, CONTENT_ADMIN denied user/finance, ADMIN denied super-admin-only role/security actions, SUPER_ADMIN allowed; test spoofed headers/client role fields do not affect authorization; test disabled users cannot use admin routes.
- [ ] **Step 2: Run the focused RBAC tests to verify RED.** Run `npx tsx --test tests/admin-rbac.test.ts tests/f001-identity-boundary.test.ts tests/request-identity.test.ts`; expected failure is missing permission/context/service exports.
- [ ] **Step 3: Implement the fixed permission matrix and context.** Use only the session cookie and current `members` row. Keep USER ownership authorization separate from admin role authorization. Return generic 401/403 bodies.
- [ ] **Step 4: Extend the existing auth session store minimally.** Add `session_id` to new inserts, select only metadata for admin listing, revoke by internal session ID with target-member predicate, and keep `token_hash`/raw tokens private. Ban/unban updates `members.disabled*`, revokes all sessions on ban, and writes an audit event.
- [ ] **Step 5: Run the role/auth matrix and existing auth suite.** Run `npx tsx --test tests/admin-rbac.test.ts tests/f001-identity-boundary.test.ts tests/request-identity.test.ts tests/member-auth.test.ts tests/auth-handlers.test.ts`; expected result is PASS with existing auth semantics unchanged.
- [ ] **Step 6: Commit the RBAC/auth checkpoint.** Run `git add lib/admin lib/member-auth.ts tests/admin-rbac.test.ts tests/f001-identity-boundary.test.ts tests/request-identity.test.ts tests/member-auth.test.ts tests/auth-handlers.test.ts && git diff --cached --check && git commit -m "feat: add server-side admin authorization"`.

### Task 5: Implement Affiliate attribution, policy/tier snapshots, fulfillment conversion, and reversal ledger

**Files:**
- Create: `lib/affiliate/types.ts`
- Create: `lib/affiliate/policy.ts`
- Create: `lib/affiliate/service.ts`
- Create: `lib/affiliate/repository.ts`
- Modify: `lib/orders.ts` to emit/repair the verified-fulfillment affiliate boundary after the existing idempotent fulfillment record exists
- Create: `tests/affiliate-service.test.ts`
- Modify: `tests/credits-ledger.test.ts` or create `tests/orders-affiliate-boundary.test.ts` for Credits/VIP/fulfillment invariants

**Interfaces:**
- `type VerifiedFulfillmentEvent = { eventKey; orderId; fulfillmentId; memberOwnerId; paymentReference; amountMinor; currency; packageSnapshot; fulfilledAt }`.
- `captureAttribution({ database, owner, rawCode, source, now }): Promise<AttributionResult>` hashes the code server-side, validates active affiliate/code/window/self-referral, and inserts first-touch attribution without overwrite.
- `createAffiliateConversion({ database, event }): Promise<AffiliateConversion | null>` requires `FULFILLED`, a payment reference, an owner member, a matching attribution, and an active policy; it is idempotent by fulfillment/economic-event key.
- `markCommissionEligible`, `reverseAffiliateCommission`, `adjustAffiliateCommission`, `listAffiliateHistory`, and `getAffiliateSummary` use append-only ledger rows and snapshot policy/tier/package facts.

- [ ] **Step 1: Write failing attribution and ledger tests.** Cover valid/invalid/expired/deactivated code, code tampering, first-touch non-overwrite, guest/member owner association, self-referral, same-account referral, attribution window, policy threshold selection, historical tier immutability, held/eligible/reversed events, duplicate/concurrent fulfillment, duplicate refund/reversal, deactivated affiliate conversion behavior, foreign access, and integer currency arithmetic.
- [ ] **Step 2: Run the focused affiliate tests to verify RED.** Run `npx tsx --test tests/affiliate-service.test.ts tests/orders-affiliate-boundary.test.ts`; expected failure is missing domain modules and boundary behavior.
- [ ] **Step 3: Implement code hashing and attribution.** Store only SHA-256 code hashes, use the session-derived `owner` key, make first valid attribution immutable for the configured window, and reject self-referral both at capture and conversion.
- [ ] **Step 4: Implement policy selection and tier snapshots.** Select the active version by effective time, count qualified non-reversed conversions in the UTC calendar month including the current conversion deterministically, select the highest matching threshold, calculate `floor(amountMinor * rateBps / 10000)`, and persist policy/tier/package snapshots.
- [ ] **Step 5: Implement the append-only commission ledger.** Use unique event/idempotency keys, `INSERT OR IGNORE`/conflict verification, compensating reversal entries, encrypted optional fraud notes, and no mutable total balance as the accounting source of truth.
- [ ] **Step 6: Integrate the existing fulfillment boundary.** In `fulfillOrder`, build the event only from stored `PAYMENT_CONFIRMED` + `FULFILLED` data and the durable `order_fulfillments` row; call the affiliate ensure function after the first transition and from the already-fulfilled retry path. Never introduce checkout/payment-provider logic.
- [ ] **Step 7: Run the focused affiliate + existing commercial suite.** Run `npx tsx --test tests/affiliate-service.test.ts tests/orders-affiliate-boundary.test.ts tests/credits-ledger.test.ts tests/credits-repository.test.ts tests/credits-allocation.test.ts`; expected result is PASS with existing Credits/VIP behavior preserved.
- [ ] **Step 8: Commit the Affiliate checkpoint.** Run `git add lib/affiliate lib/orders.ts tests/affiliate-service.test.ts tests/orders-affiliate-boundary.test.ts tests/credits-ledger.test.ts tests/credits-repository.test.ts tests/credits-allocation.test.ts && git diff --cached --check && git commit -m "feat: add verified fulfillment affiliate ledger"`.

### Task 6: Add owner-scoped account/history services and provider-neutral admin read models

**Files:**
- Create: `lib/account-history.ts`
- Modify: `lib/tarot-saved-reading.ts` only to add bounded cursor metadata summaries while preserving the existing detail parser
- Modify: `lib/tarot-share-store.ts` with owner-scoped metadata listing only
- Modify: `lib/orders.ts` with bounded owner order listing only
- Modify: `lib/entitlements.ts` with authorized manual grant/revoke helpers that do not bypass existing entitlement invariants
- Create: `tests/account-history.test.ts`

**Interfaces:**
- `listAccountHistory({ database, owner, kind, limit, cursor }): Promise<{items, nextCursor}>` supports `readings`, `shares`, `orders`, `credits`, `affiliate`, and `all` with a stable `(createdAt,id)` cursor and limit 1–50.
- `getAccountSummary({ database, owner }): Promise<AccountSummary>` returns the member projection, Credits balance/history summary, VIP status, reading/share/order/affiliate counts/summaries, and no raw bearer tokens.
- `listAdminOrderReadModel` returns order ID/status/amount/currency/payment reference/confirmed/fulfilled/refunded timestamps plus fulfillment and Credits/VIP result snapshots, never Tarot question/reading content.

- [ ] **Step 1: Write failing account/history ownership and pagination tests.** Cover owner-only reading detail/list, foreign member denial, private reading payload exclusion from admin models, share token omission, order ownership, credits/VIP/affiliate summaries, stable cursor pagination, invalid/oversized cursors, and empty history.
- [ ] **Step 2: Run the focused account tests to verify RED.** Run `npx tsx --test tests/account-history.test.ts tests/tarot-saved-reading.test.ts tests/tarot-share-service.test.ts`; expected failure is missing service/listing exports.
- [ ] **Step 3: Implement metadata-first account queries.** Reuse the current owner predicates and saved-reading compatibility/detail path; do not duplicate `reading_payload`; derive share ownership through reading/session joins; use parameterized SQL and stable cursor predicates.
- [ ] **Step 4: Implement admin payment/order read models and manual Credits/VIP domain calls.** Keep all payment state provider-neutral and ensure admin mutations call `createCreditStore().adjustCredits`/authorized entitlement helpers rather than editing projections directly.
- [ ] **Step 5: Run focused account/share/credits/auth tests.** Run `npx tsx --test tests/account-history.test.ts tests/tarot-saved-reading.test.ts tests/tarot-saved-reading-route.test.ts tests/tarot-share-service.test.ts tests/tarot-share-routes.test.ts tests/credits-repository.test.ts tests/credits-vip-ui.test.ts`; expected result is PASS.
- [ ] **Step 6: Commit the account/history checkpoint.** Run `git add lib/account-history.ts lib/tarot-saved-reading.ts lib/tarot-share-store.ts lib/orders.ts lib/entitlements.ts tests/account-history.test.ts && git diff --cached --check && git commit -m "feat: add owner-scoped account history"`.

### Task 7: Add API routes for attribution, account/history, and admin operations

**Files:**
- Create: `app/api/affiliate/attribute/route.ts`
- Create: `app/api/account/summary/route.ts`
- Create: `app/api/account/history/route.ts`
- Create: `app/api/account/readings/[id]/route.ts` only if the existing saved-reading route cannot provide the required stable account URL without duplication
- Create: `app/api/admin/users/route.ts`
- Create: `app/api/admin/users/[id]/route.ts`
- Create: `app/api/admin/users/[id]/sessions/route.ts`
- Create: `app/api/admin/credits/route.ts`
- Create: `app/api/admin/vip/route.ts`
- Create: `app/api/admin/orders/route.ts`
- Create: `app/api/admin/affiliate/route.ts`
- Create: `app/api/admin/audit/route.ts`
- Create: `tests/backend-completion-routes.test.ts`

**Interfaces:**
- Public attribution POST: `{ code: string, source?: string }`; response never echoes the raw code or affiliate member ID.
- Account summary/history GET: cookie-authenticated owner only, no client owner parameter, no-store, bounded `limit`/cursor, safe 401/400/404.
- Admin GET/POST/PATCH routes use `requirePermission` and strict schemas; mutations require `{ reason, idempotency_key }` plus only the action-specific bounded fields.
- Admin affiliate responses expose profile/status/code status/policy/conversion/ledger facts but not raw code, encrypted note plaintext without an available runtime key, or private readings.

- [ ] **Step 1: Write failing route contract tests.** Exercise all route handlers with fixture requests: no session, wrong role, spoofed role headers, invalid schemas, missing Origin on writes according to current policy, foreign IDs, safe no-store responses, and successful owner/admin cases.
- [ ] **Step 2: Run route tests to verify RED.** Run `npx tsx --test tests/backend-completion-routes.test.ts`; expected failure is missing route modules/exports.
- [ ] **Step 3: Implement route adapters.** Match existing `boundary`, `db`, `identity`, `json`, `originCheck`, `attachIdentityCookie`, and `noStoreResponse` patterns. Map domain errors to stable generic responses; never serialize raw error/provider/database bodies.
- [ ] **Step 4: Add the public referral capture adapter.** Accept only an opaque raw code, store only its hash through the Affiliate service, and return a generic attribution status. The minimal client capture may replay a query `ref` after sign-in but cannot submit an affiliate ID.
- [ ] **Step 5: Run route and ownership suites.** Run `npx tsx --test tests/backend-completion-routes.test.ts tests/f001-identity-boundary.test.ts tests/server-origin.test.ts tests/tarot-saved-reading-route.test.ts tests/tarot-share-routes.test.ts`; expected result is PASS.
- [ ] **Step 6: Commit the API checkpoint.** Run `git add app/api/affiliate app/api/account app/api/admin tests/backend-completion-routes.test.ts && git diff --cached --check && git commit -m "feat: add account affiliate and admin APIs"`.

### Task 8: Add functional-only admin/account verification surfaces

**Files:**
- Create: `app/admin/page.tsx`
- Create: `app/admin/admin-console.tsx`
- Create: `components/account/account-history.tsx`
- Modify: `app/[section]/page.tsx` only to add a narrowly scoped account/history route if required by the existing shell
- Modify: `app/pages.tsx` only for a small functional account/history data panel if the route reuse is safer
- Modify: `app/vintarot.tsx` only if the public referral capture effect is required; add no visual-system changes
- Create: `tests/admin-functional-ui.test.ts`

**Interfaces:**
- `/admin` renders `FUNCTIONAL UI — NOT FINAL DESIGN`, loads only the authenticated actor’s permitted data, and offers reason/idempotency fields for mutations.
- Account/history surface renders own summaries and links to the existing saved-reading detail; it must not add private content to HTML for another owner.
- Referral capture uses the raw `?ref=` query only as a transient client value and calls the already-protected attribution API; no raw code is persisted in localStorage or server rows.

- [ ] **Step 1: Write failing source-contract/UI tests.** Assert route/page existence, the explicit functional-only marker, API calls, reason/idempotency controls, no `dangerouslySetInnerHTML`, no Liquid Glass/Home/Room redesign markers, and no raw affiliate code storage.
- [ ] **Step 2: Run UI tests to verify RED.** Run `npx tsx --test tests/admin-functional-ui.test.ts`; expected failure is missing pages/components.
- [ ] **Step 3: Implement the smallest existing-style client panels.** Use current buttons, panels, tables, labels, and language provider; keep the feature operationally legible, not visually redesigned. Render only fields returned by the new API read models.
- [ ] **Step 4: Run focused UI and regression tests.** Run `npx tsx --test tests/admin-functional-ui.test.ts tests/brand-shell.test.ts tests/profile-logout.test.ts tests/saved-reading-journal.test.ts tests/i18n.test.ts`; expected result is PASS.
- [ ] **Step 5: Commit the functional UI checkpoint.** Run `git add app/admin components/account app/[section]/page.tsx app/pages.tsx app/vintarot.tsx tests/admin-functional-ui.test.ts && git diff --cached --check && git commit -m "feat: add functional admin and account surfaces"`.

### Task 9: Execute adversarial review, harden findings, and verify the complete local loop

**Files:**
- Create: `tests/backend-completion-security-review.test.ts`
- Modify: any implementation file that fails the adversarial checks, only with a new regression assertion in this test or the nearest focused suite
- Modify: `docs/PROJECT_STATE.md`
- Modify: `docs/reports/natarot-backend-completion-v1-final-report.md`

**Interfaces:**
- The review suite must cover IDOR, privilege escalation, mass assignment, client/header role spoofing, self-referral, duplicate/concurrent economic events, credit/VIP bypass, SQL injection-shaped input, XSS-shaped admin data, Origin/CSRF behavior, PII/log/secret leakage, encryption misuse, session abuse, replay, and cursor abuse.
- The final report must distinguish `IMPLEMENTED`, `VERIFIED`, `PUSHED`, `MERGED`, and `DEPLOYED`, state production/staging migrations are `NO`, and list all remaining production gates.

- [ ] **Step 1: Write adversarial tests for the implemented surfaces.** Use two members, two roles, two affiliates, two orders, foreign share/reading IDs, concurrent fulfillment promises, duplicate refund keys, hostile metadata, and client-supplied role/owner/amount fields.
- [ ] **Step 2: Run the adversarial suite and record every failure.** Run `npx tsx --test tests/backend-completion-security-review.test.ts`; do not waive a failure as “only UI.”
- [ ] **Step 3: Fix each in-scope finding with a reproducing regression test first.** Preserve all hard locks and do not patch unrelated baseline lint debt.
- [ ] **Step 4: Run the focused complete mission matrix.** Run the backend-completion tests, all auth/F-001/origin/member tests, all Credits/VIP/order tests, all saved-reading/share/migration tests, and the complete tracked suite `npx tsx --test tests/*.test.ts`.
- [ ] **Step 5: Run release-quality local checks.** Run `npx tsc --noEmit`, `npm run build`, targeted ESLint over every new/modified source file, `git diff --check`, and the credential-shaped tracked scan. Record repository-wide lint baseline separately if it remains red.
- [ ] **Step 6: Update PROJECT_STATE and the final report from actual evidence.** Include base/branch/head, focused/full counts, typecheck/build/lint/diff/secret evidence, logical-vs-physical isolation, external research decisions, no deployment/payment/SePay claims, unfinished key provisioning/retention/integration gates, and the exact Integration V3 handoff contract.
- [ ] **Step 7: Inspect the final staged diff and commit the verified mission.** Run `git status --short`, `git diff --stat`, `git diff --check`, stage only related files, scan staged content for credential-shaped literals, and commit with `feat: complete natarot backend capabilities v1`.
- [ ] **Step 8: Push and verify the remote branch.** Run `git push -u origin codex/natarot-backend-completion-v1`, then `git rev-parse HEAD`, `git ls-remote origin refs/heads/codex/natarot-backend-completion-v1`, and confirm the hashes match. Do not merge or deploy.

## Execution notes

- Each task is independently committed and tested; if a later task exposes a boundary defect, add a focused regression in the owning task’s test file and keep the commit scope narrow.
- The current base’s 474/474, TypeScript, and build baseline is evidence, not a reason to skip affected regression groups after changes.
- Existing repository-wide lint debt is a baseline unless a new/modified file adds an error; targeted lint for changed files is required.
- If a required operation would need production credentials, production access, real-money movement, a destructive migration, or an unavoidable F-001 semantic change, stop at that human gate and document it instead of improvising.
