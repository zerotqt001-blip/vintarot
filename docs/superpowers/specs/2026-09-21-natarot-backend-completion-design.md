# NaTarot Backend Completion V1 — Design Specification

**Date:** 2026-09-21

**Mission branch:** `codex/natarot-backend-completion-v1`

**Canonical development base:** `fd7d8fe14c86a282d9319d79fef73ee654ae5032` (`codex/natarot-staging-integration-v2`)
**Base decision:** This is the newest safe local product base that contains the verified Master Integration V1 tree and the Credits/VIP implementation. The staging branch carries the Credits/VIP feature as an equivalent staging commit rather than the original `121e184` commit; its unresolved SSH/VPS gate is not consumed. The current dirty checkout and the independent SePay worker remain untouched.

## Outcome

Complete the remaining non-visual NaTarot capabilities needed before a future Integration V3 and final UI/UX mission: a provider-neutral Affiliate V1, logical identity/product data isolation, a key-versioned application-encryption boundary, append-only administrative audit, server-enforced RBAC/admin operations, and authenticated account/history APIs with only functional verification surfaces.

The highest intended result is Level C (regression safe) for source and local data behavior. This mission must not claim Level D production readiness because it does not provision production encryption keys, change production credentials, run production migrations, deploy, restart services, implement SePay, or move money.

## Constraints and locked zones

- Preserve F-001 trusted identity, Google OAuth, guest ownership, session-cookie semantics, password hashing, verification/reset tokens, and existing Auth route contracts.
- Preserve Tarot AI/Knowledge Base V5, prompt v4.2.2, reading semantics, L1/L4/L5/L7/L8, share S1–S6, Credits invariants, VIP fulfillment, backup/DR, and production runtime.
- Do not implement SePay checkout, IPN, adapter, secrets, payment verification, or a competing payment boundary. Affiliate consumes only verified/fulfilled order events exposed by the existing order domain.
- Do not deploy, run production or staging migrations, restart services, change production secrets, provision production KMS/Vault keys, perform payouts, move real money, merge main, force-push, or redesign UI.
- Additive local migration only. Never renumber `0000`–`0006`; add `drizzle/0007_backend_completion.sql` and verify fresh and upgrade paths.
- New UI is explicitly `FUNCTIONAL UI — NOT FINAL DESIGN`; reuse the existing shell/components and do not alter Home, Room, Reading Result, Auth, Profile visual identity, or the Liquid Glass system.

## Research decisions

The durable research artifact is `docs/research/NATAROT_BACKEND_COMPLETION_RESEARCH.md`. The following decisions are incorporated here:

| Reference | Decision | Design consequence |
| --- | --- | --- |
| Better Auth Admin plugin, MIT, current main `41b7dc15de41a8726422c392a4857d8764828891` | ADAPT | Use the separation between administrative operations, custom permissions, ban/session revocation, and server-only checks as patterns. Do not replace NaTarot Auth or import the plugin. |
| OpenFGA, Apache-2.0, current main `ab557c5592670c899de35297e7aa067015f06502` | REFERENCE ONLY | Its resource-first ReBAC model and authorization assertions are useful for threat-model tests, but a networked authorization service is unjustified for this single-app, two-runtime scale. |
| node-casbin, Apache-2.0, current master `aad42ce2be70908bbc76c5b89b505cf0655245e8` | REFERENCE ONLY | Its RBAC/ABAC policy vocabulary is useful, but a dynamic policy engine would add persistence, reload, and policy-consistency surface without a current NaTarot need. |
| Medusa Order Affiliate plugin, MIT, main `f85c5ca1576c8234ca851a944babf04f913f9f92`; Medusa order/payment docs | REFERENCE ONLY / ADAPT DOMAIN PATTERNS | Retain captured/fulfilled event boundaries, commission association, refund/reversal, and payout hold concepts. Reject automatic PayPal payouts, commerce-framework coupling, and “captured payment alone” as NaTarot’s commission trigger. |
| `pametan/audit-log`, MIT, main `0cfdb2cdc180db9a6729d0b44e38c6a2b609ed1e`; `tomaslachmann/open-audit`, no SPDX license reported, master `3251abbb9bb2b0b2d6d6969e9963940d0abf28f3` | REJECT AS DEPENDENCIES | The hash-chain/redaction ideas are useful, but the small activity/maintenance evidence and SQLite/D1 integration mismatch do not justify importing them. Implement the narrow NaTarot audit contract locally. |
| Node `crypto` API, AES-GCM primitives | ADOPT | Use built-in Web Crypto AES-GCM with random IVs, authenticated data, explicit key IDs, and a keyring interface. No custom cipher or production key is included. |
| SePay official SDK, MIT, main `62178220f36cda2f6657731ef182ecd84dd67e2f` | REFERENCE ONLY | Preserve a future provider-neutral boundary: verified economic event → order/payment-confirmed → idempotent fulfillment. Do not call the SDK or add its secrets. |

## Architecture

### 1. Identity and authorization

The existing session cookie remains the only member identity credential. A new authorization service reads the authenticated member ID from the existing `identity(request)` result, then re-reads the current role and disabled state from the database for every privileged action. It never trusts a client role, `x-user-*` header, query parameter, or UI visibility decision.

Roles are fixed application roles stored on `members.role`:

| Role | Scope |
| --- | --- |
| `USER` | Own account, own private readings, own shares, own credits/VIP/order/affiliate projections. |
| `SUPPORT` | Masked user/support visibility and session revocation; no financial or policy authority. |
| `FINANCE` | Orders, provider-neutral reconciliation, Credits/VIP adjustments, affiliate commission review/adjustment; no Auth/security role control. |
| `CONTENT_ADMIN` | Reserved content/configuration permission namespace; no user, financial, or security authority in this mission. |
| `ADMIN` | Broad operational user/status/session, affiliate, audit, and commercial management except super-admin role control. |
| `SUPER_ADMIN` | Highest privileged actions, role assignment, security controls, policy version activation, and full audit visibility. |

The permission matrix is a typed constant in `lib/admin/permissions.ts`. `requirePermission(request, permission)` returns a server-side actor context or a safe 401/403 response. Resource ownership is a separate predicate and remains mandatory for all user-owned reads.

Existing `members.disabled` remains the account status source of truth. The migration adds `role`, `disabled_at`, `disabled_reason`, and `disabled_by`; banning sets disabled state and revokes all sessions through the existing session store behavior. Impersonation is deferred. No session contains a role snapshot, so a role change takes effect on the next request without changing F-001.

Existing auth sessions gain a non-secret `session_id` for admin display/revocation. The raw cookie and `token_hash` never leave the auth boundary. Existing rows receive generated opaque IDs during the local migration; future sessions generate IDs at creation.

### 2. Logical data isolation and PII

Identity/auth tables remain authoritative for login identifiers and session verification. Product tables continue to reference opaque member owner values (`member:<UUID>`) or credit-account IDs; they do not copy email, phone, username, or OAuth subjects. Account/history queries join through the authenticated opaque member ID.

This is logical isolation, not physical database separation. The SQLite/D1-compatible runtime and current deployment topology do not justify introducing a second database in this mission. `docs/security/NATAROT_DATA_CLASSIFICATION.md` and `docs/security/NATAROT_SECURITY_ARCHITECTURE.md` document the boundary, runtime DB capabilities, and a future physical split without claiming it exists.

`lib/security/encryption.ts` exposes a runtime-neutral AES-256-GCM field-encryption abstraction:

```ts
type PiiKeyring = {
  activeKeyId: string;
  keys: ReadonlyMap<string, Uint8Array>;
};

encryptField(plaintext: string, purpose: string, keyring: PiiKeyring): string;
decryptField(ciphertext: string, purpose: string, keyring: PiiKeyring): string;
```

The versioned format contains an algorithm/version, key ID, random 96-bit IV, authentication tag, and ciphertext. `purpose` is authenticated as additional data and separates PII from future audit/payment keys. Decryption accepts retained old key IDs; encryption uses only the active key. Missing or invalid keys fail closed without logging plaintext.

The abstraction is exercised by encrypted affiliate fraud notes. Existing email/username lookup fields remain plaintext for compatibility and deterministic queries; phone/display-name migration is documented as a future key-provisioning/data-migration gate rather than pretending current auth storage is encrypted.

### 3. Audit log

`audit_events` is an append-only application table with:

`event_id`, `created_at`, `actor_kind`, `actor_id`, `actor_role`, `action`, `resource_type`, `resource_id`, `reason`, `outcome`, and redacted bounded `metadata`.

`lib/audit/` exposes only append/list/metadata-redaction operations. Sensitive operations write audit entries in the same domain service operation or immediately after a successful idempotent state transition. Metadata is allowlist/denylist redacted recursively; passwords, raw tokens, cookies, secrets, API keys, payment secrets, full PII, Tarot questions, and reading payloads are not stored.

Hash chaining is evaluated and deferred for V1: D1/SQLite does not provide a portable cryptographic hash function or a cross-instance append lock that makes an application-calculated global chain trustworthy. The service provides append-only semantics and stable event IDs now; a future external sealed/WORM sink may add tamper evidence without changing the event contract.

### 4. Affiliate V1

The flow is:

```text
opaque code → first-touch attribution → member/guest owner → pending order
→ verified payment → idempotent fulfillment → conversion → held ledger entry
→ eligible after configurable hold → future payout (not implemented)
```

Tables:

- `affiliate_profiles`: one profile per member, status `ACTIVE|INACTIVE|FRAUD`, `fraud_flag`, encrypted optional fraud note, version counter, timestamps.
- `referral_codes`: one-way `code_hash`, affiliate owner, status, timestamps. Raw code is returned only at creation and is never stored.
- `referral_attributions`: immutable first-touch facts for `member` or `guest` owner keys, source, timestamps, expiry, and conversion status. A unique owner key prevents silent overwrite. A logged-in member cannot attribute to their own affiliate profile. Guest attribution is replayable after sign-in through the minimal capture client; no untrusted member ID is accepted.
- `affiliate_policy_versions` and `affiliate_policy_tiers`: versioned policy with configurable attribution window, hold duration, monthly qualified thresholds, and integer basis-point rates. The migration seeds a clearly documented non-final default policy (`affiliate-v1-default`, 10/20/30% basis-point tiers, 30-day attribution window, 7-day hold); all commission rows snapshot the selected policy/tier and never re-evaluate historical amounts.
- `affiliate_conversions`: one conversion per verified order fulfillment, with affiliate/referred member/order/fulfillment/attribution links, package and policy snapshots, qualified-month count, commission amount, and current derived status.
- `affiliate_commission_ledger`: append-only events `CREATED_HELD`, `ELIGIBLE`, `REVERSED`, `PAID`, and `ADJUSTMENT`. Unique economic-event/idempotency keys prevent duplicate fulfillment, retries, and concurrent requests from creating duplicate commission.

The service consumes a typed `VerifiedFulfillmentEvent` produced only after the existing order is `FULFILLED` and has a verified payment reference plus an idempotent `order_fulfillments` record. `fulfillOrder` calls the service for both the first transition and an already-fulfilled retry so a transient local affiliate write cannot leave an unrecoverable conversion gap. The service never uses checkout creation, browser redirects, or pending payment.

Refund/reversal is a provider-neutral `reverseAffiliateCommission` service accepting a verified refund-event key. It creates a compensating ledger entry and never mutates the original commission fact. It does not mark orders refunded or verify payments; that remains SePay/payment-worker scope. Payout is represented only by future `ELIGIBLE`/`PAID` ledger contracts; no payout execution exists.

### 5. Account/history

New owner-scoped account services expose bounded, cursor-based summaries without duplicating full reading payloads:

- account identity projection (member-owned fields only);
- credit balance and ledger history through the existing Credits service;
- active VIP entitlements through the existing entitlement service;
- saved reading metadata/cards via an extended owner-scoped saved-reading list, with existing detail GET for the full private reading;
- share status/created/expiry/revocation metadata, never raw share tokens;
- order/package/payment-confirmed/fulfilled/refunded timestamps through owner-scoped order reads;
- affiliate status, attribution/conversion/ledger summaries for the authenticated affiliate owner.

The history endpoint bounds `limit` to 1–50 and uses a stable `(created_at,id)` cursor. Private reading content is never exposed in admin read models; account detail remains owner-only. Deactivation is non-destructive: disable the member, revoke sessions, preserve immutable financial/audit evidence, and retain only opaque references. Full erasure/anonymization policy is documented but not silently executed because retention requirements are not specified.

### 6. Admin API and minimum functional UI

Server routes are grouped under `/api/admin/` and return no-store responses:

- users: bounded search/list/detail, ban/unban, role change, session list/revoke;
- credits and VIP: reason-required, idempotent adjustments through existing Credits/Entitlement domain services;
- orders: provider-neutral reconciliation read model with order, payment reference/status, fulfillment, and Credits/VIP result;
- affiliate: profile/code/policy/conversion/ledger reads plus status/policy/commission adjustment actions;
- audit: filtered, bounded audit events with redacted metadata.

The `/admin` route is a functional verification surface only. It uses simple existing controls, makes no visual-system changes, and never renders private reading payloads. The account/history additions use the existing `/profile` and `/journal` surfaces only as small data panels or a narrow functional route; final UI polish is explicitly deferred.

## Error and security behavior

- All new JSON boundaries use Zod strict schemas, bounded strings/arrays, bounded pagination, parameterized SQL, `originCheck` for writes, no-store responses, and generic safe errors.
- 401 is used for missing member auth; 403 for authenticated but unauthorized roles; 404 for owner-scoped missing resources without IDOR enumeration.
- Client-controlled roles, affiliate IDs, order owners, commission amounts, policy versions, account IDs, and status transitions are ignored or rejected. Server derives all owners from the session and all economic values from stored package/order/policy snapshots.
- Admin-rendered strings are escaped by React and never inserted as HTML. Audit metadata is redacted before persistence and before response.
- Affiliate attribution rejects invalid/expired/deactivated codes, self-referral, same-account referral, code tampering, and silent overwrite. Unique event keys and database constraints cover retries, double clicks, concurrent fulfillment, and duplicate refund delivery.
- No new invasive fingerprinting is introduced. Rate limiting is applied only to public attribution and sensitive admin mutation routes where existing in-memory rate-limit patterns can be reused; it is not treated as economic correctness.

## Verification contract

Focused tests will cover:

- research/source documentation and migration shape;
- encryption format, authentication failure, key rotation, purpose separation, and no-plaintext error/log behavior;
- audit append-only behavior, metadata redaction, actor/action/resource coverage, and safe listing;
- every RBAC boundary, role/header spoofing, IDOR, ban/session revocation, and F-001 regression;
- affiliate attribution, self-referral, deactivated/invalid code, tier snapshot, held/eligible/reversal ledger, duplicate/concurrent fulfillment, refund replay, and foreign access;
- admin user/session/credits/VIP/order/affiliate/audit actions with mandatory reason/idempotency;
- account/history ownership, cursor pagination, private reading/share/order/affiliate summaries;
- fresh `0000`–`0007` and upgrade `0000`–`0006` migrations with existing auth/Tarot/share/Credits data preserved.

Final checks: full tracked suite, `npx tsc --noEmit`, production build, targeted lint for all new/modified files, `git diff --check`, and a tracked-value secret-like scan. No production or staging migration/deployment is part of the evidence.

## Explicit non-goals and remaining gates

- No SePay implementation, payment verification, checkout, provider secret, payout, real-money movement, or production financial reconciliation.
- No physical database split, KMS/Vault provisioning, plaintext-auth PII migration, or legal retention-period invention.
- No impersonation, OTP/2FA/CAPTCHA, automatic payout, invasive fraud fingerprinting, or final UI/UX redesign.
- Integration V3 must connect the verified SePay event adapter to the existing `recordVerifiedPayment` → `fulfillOrder` boundary, confirm the chosen commercial policy, provision runtime PII keys, review migration/backup/rollback, and only then consider deployment.
