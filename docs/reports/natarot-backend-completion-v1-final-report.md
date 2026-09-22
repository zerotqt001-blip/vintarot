# NATAROT — BACKEND COMPLETION V1 — FINAL REPORT

## Status

PASS — source-only backend/product completion on an isolated branch. This milestone is safe for a separately controlled Integration V3 review. It is not merged, deployed, migrated to staging or production, and it moved no real money.

## Base

- Repository: `https://github.com/zerotqt001-blip/vintarot`
- Chosen safe base: `fd7d8fe14c86a282d9319d79fef73ee654ae5032` (`codex/natarot-staging-integration-v2`).
- Reason: this is the verified Staging Integration V2 product head containing the verified Credits/VIP V1 foundation, without consuming the blocked VPS-only work or the separate SePay worker.
- Worktree: `/Users/tranquangthanh/.codex/worktrees/natarot-backend-completion-v1/test astra`

## Branch

`codex/natarot-backend-completion-v1`

## Final Commit

Implementation and durable-report checkpoint: `c53605d0c87b07a5db871656adae05ce0d03cb86`. A final source-only metadata commit records the completed remote verification below; the completion response reports the resulting branch tip.

## Remote Verified

YES — the normal push of `c53605d0c87b07a5db871656adae05ce0d03cb86` succeeded, and local `HEAD` matched `origin/codex/natarot-backend-completion-v1`. No force push was used.

## External Research

Research details and boundaries are recorded in [`NATAROT_BACKEND_COMPLETION_RESEARCH.md`](../research/NATAROT_BACKEND_COMPLETION_RESEARCH.md). The decisions were:

| Source | Observed revision/license | Decision | NaTarot use |
| --- | --- | --- | --- |
| [Better Auth Admin](https://github.com/better-auth/better-auth/blob/main/docs/content/docs/plugins/admin.mdx) | `41b7dc15de41a8726422c392a4857d8764828891`, MIT, active | ADAPT | Server-side role, ban/unban and session-management patterns only; existing NaTarot Auth/F-001 remains authoritative. |
| [OpenFGA modeling](https://openfga.dev/docs/modeling/getting-started) | `ab557c5592670c899de35297e7aa067015f06502`, Apache-2.0 | REFERENCE ONLY | ReBAC/RBAC modeling and test ideas; a new authorization service is unjustified at current scale. |
| [node-casbin](https://github.com/apache/casbin-node-casbin) | `aad42ce2be70908bbc76c5b89b505cf0655245e8`, Apache-2.0, active | REFERENCE ONLY | Compared ABAC/RBAC enforcement; the fixed NaTarot-native matrix is smaller and easier to audit. |
| [Medusa order-affiliate example](https://github.com/headless-commerce-company-weframe-tech/medusa-order-affiliate) | `f85c5ca1576c8234ca851a944babf04f913f9f92`, MIT, active | ADAPT | Attribution, conversion, tier and reversal concepts; no Medusa framework or code was imported. |
| [Medusa payment flow](https://docs.medusajs.com/resources/commerce-modules/payment/payment-flow) | Current documentation | REFERENCE ONLY | Confirmed that affiliate must consume a verified economic/fulfillment boundary rather than a browser success redirect. |
| [pametan/audit-log](https://github.com/pametan/audit-log) | `0cfdb2cdc180db9a6729d0b44e38c6a2b609ed1e`, MIT, active | REFERENCE ONLY | Append-only actor/action/resource and metadata ideas; no dependency was added. |
| [tomaslachmann/open-audit](https://github.com/tomaslachmann/open-audit) | `3251abbb9bb2b0b2d6d6969e9963940d0abf28f3`, no SPDX license observed | REJECT | License/provenance confidence was insufficient for a security boundary. |
| [Node.js crypto](https://nodejs.org/api/crypto.html) | Official runtime API | ADOPT | WebCrypto AES-256-GCM with versioned ciphertext, AAD and key identifiers. No custom cryptography. |
| [SePay SDK](https://github.com/sepayvn/sepay-pg-node) | `62178220f36cda2f6657731ef182ecd84dd67e2f`, MIT | REFERENCE ONLY | Future provider boundary only; no checkout, webhook/IPN, secret or payment implementation here. |

## Affiliate

- Attribution stores only a hash of the normalized referral code; the first accepted attribution is owner-bound and cannot be silently overwritten.
- The V1 route captures attribution for an authenticated member after sign-in, with source and timestamps; self-referral and inactive/expired code cases fail closed. Anonymous-cookie attribution is deliberately deferred.
- The default policy is versioned/configurable: 30-day attribution, 7-day hold, and seeded 10%/20%/30% basis-point tiers. These are testable defaults, not approved immutable commercial pricing.
- Conversion creation is accepted only after a stored member order and stored `order_fulfillments` row both match the verified `FULFILLED` event, payment reference, integer amount, currency, package snapshot and fulfillment timestamp.
- Commission facts are append-only ledger entries with order/fulfillment, referred member, profile, policy/tier/package snapshots and idempotency keys. Duplicate fulfillment repairs/replays rather than duplicating.
- Hold, eligibility, reversal and manual adjustment are represented by compensating ledger entries. Refund/payout execution is not implemented; payout remains a future integration boundary.
- Concurrent fulfillment, foreign-owner/profile access, code tampering, deleted/deactivated affiliates, self-referral and reversal paths are covered by focused and adversarial tests.

## User Data Security

- Classification is documented in [`NATAROT_DATA_CLASSIFICATION.md`](../security/NATAROT_DATA_CLASSIFICATION.md): identity/auth PII and secrets are separate from product, Tarot-private, share, commercial, financial-metadata, operational and audit projections.
- Product joins use opaque `member:<id>` owner keys. Product/admin read models do not duplicate email, phone, password, OAuth identity or Tarot payloads unnecessarily.
- The implemented boundary is logical, not physical: the current D1/SQLite database remains one database with explicit owner predicates and allowlisted projections. A future identity/product database split is documented as an operational migration, not claimed as complete here.
- `lib/security/encryption.ts` provides authenticated AES-256-GCM using WebCrypto, a versioned `natarot-pii:v1` format, purpose-bound AAD, key IDs and current/historical key-ring support. Keys are environment inputs outside the database and Git; no production key was provisioned.
- Existing password hashing, HttpOnly session-cookie semantics, Google/Auth flows, guest identity and F-001 trusted identity remain unchanged. No endpoint exposes password hashes, raw session secrets, reset/verification tokens or provider credentials.
- Least-privilege roles and operational separation for `APP_RUNTIME`, `MIGRATION_ADMIN`, `BACKUP` and `ADMIN/OPS` are documented. This source-only milestone does not change production credentials or database grants.
- Deactivation disables authorization and revokes sessions. No destructive account-delete endpoint was added; future deletion must retain immutable accounting/audit evidence and anonymize or pseudonymize identity-linked projections where legally/operationally required.

## Audit

- `audit_events` is append-only at the application boundary and records event id, timestamp, actor, role, action, resource, reason, outcome and redacted metadata.
- Idempotency keys use `INSERT OR IGNORE`; list projections are bounded and safe. There are no application update/delete audit methods.
- Recursive bounded redaction removes passwords, tokens, keys, secrets, raw referral codes and unnecessary PII before persistence.
- Hash chaining was evaluated and deferred: it would add operational/key-management complexity without a current approved verification consumer. Database write protection, backup controls and future tamper-evidence can be added at the deployment gate.

## RBAC

- Roles: `USER`, `SUPPORT`, `FINANCE`, `CONTENT_ADMIN`, `ADMIN`, `SUPER_ADMIN`.
- The fixed permission matrix is documented in [`NATAROT_RBAC_PERMISSION_MATRIX.md`](../security/NATAROT_RBAC_PERMISSION_MATRIX.md). VIP entitlements never confer administrative authority.
- Every admin route derives identity and current role from the server-side session/member row; client headers, client role fields and hidden UI controls are not trusted.
- Target predicates prevent IDOR. Role changes are `SUPER_ADMIN`-only; support cannot perform finance operations; finance cannot perform security/role operations; no impersonation was added.
- Disabled members are denied server-side even with a previously issued cookie, and targeted session revocation uses an opaque server-issued session id.

## Admin

- User list/detail/status/role APIs: `/api/admin/users`, `/api/admin/users/:id`.
- Session list/revoke: `/api/admin/users/:id/sessions`.
- Existing Credits/VIP domain services are used for manual adjustments, mandatory reason/idempotency fields and audit events: `/api/admin/credits`, `/api/admin/vip`.
- Provider-neutral order read model: `/api/admin/orders`; it exposes status, payment reference, timestamps and fulfillment result metadata, never Tarot/private reading payloads or package secrets.
- Affiliate profile status, conversion/ledger/policy read models and manual commission adjustments: `/api/admin/affiliate`.
- Bounded audit projection: `/api/admin/audit`.
- No payout, provider payment, SePay, private-reading admin viewer or real-money reconciliation action is included.

## Account / History

- `/api/account/summary` and `/api/account/history` are authenticated, owner-scoped and `no-store`.
- The history union provides bounded cursor pagination for the member’s saved readings, share metadata, order metadata, Credits ledger entries and affiliate conversions. It exposes metadata and stable references, not full Tarot payloads, question text, raw tokens or auth secrets.
- Summary includes member projection, Credits balance/history, active VIP projection, counts and affiliate summary.
- `/account` is the minimum functional surface for those projections, filtering and pagination. It is explicitly marked `FUNCTIONAL UI — NOT FINAL DESIGN`.

## Database

- New forward-only migration: `drizzle/0007_backend_completion.sql`; historical migrations were not renumbered.
- Adds member role/status fields, opaque session ids, audit tables, affiliate profiles/codes/attributions, versioned policies/tiers, conversions and append-only commission ledger constraints/indexes.
- Fresh database and upgrade paths from the existing chain through Credits/VIP were exercised by migration tests; migration application is idempotent and locally verified.
- Production migration: **NO**. Staging migration: **NO**. No remote database, runtime, secret or service was changed.

## Security Tests

Focused tests cover IDOR/owner isolation, F-001/auth regression, role spoofing/header spoofing, disabled-session behavior, self-referral, code tampering, duplicate/replay/concurrent fulfillment, ledger reversal, PII/encryption/redaction, SQL-bound input paths, safe admin projections and private-reading exclusion. The adversarial security review is in `tests/backend-completion-security-review.test.ts`.

## Tests

- Focused migration/security/RBAC/affiliate/account/route/UI suites: pass.
- Full tracked suite: **502 tests passed, 0 failed** (`npx tsx --test tests/*.test.ts`).
- TypeScript: `npx tsc --noEmit` passed.
- Production build: `npm run build` passed and lists `/account`, `/admin` and all new API routes.
- Targeted lint: all changed/new TypeScript/TSX files pass when excluding the touched legacy shell file `app/vintarot.tsx`. The full changed-source command still reports 14 inherited `@next/next/no-html-link-for-pages` errors in that shell; the diff only adds the referral-capture mount and does not introduce those legacy navigation lines. No new lint exception was added.
- `git diff --check`: passed.
- Secret scan: changed diff and tracked HEAD found no API-key/PEM/token patterns; no `.env`, database, build artifact or credential was committed.

## UI

FINAL UI REDESIGNED: **NO**.

Functional placeholder surfaces only:

- `/account` — account summary and metadata-only history.
- `/admin` — user/session controls and minimal Credits/VIP/order/affiliate/audit controls.
- Referral query capture mounted in the existing shell; it preserves `ref` through auth return and posts only to the authenticated attribution endpoint.

Existing NaTarot/Moonlight branding, shell, Auth, Profile, Room, Reading Result and Liquid Glass redesign scope were not changed.

## Deployment

- STAGING DEPLOYED BY THIS WORKER: **NO**
- PRODUCTION DEPLOYED: **NO**
- PRODUCTION DB CHANGED: **NO**
- PRODUCTION SECRETS CHANGED: **NO**
- REAL MONEY MOVED: **NO**
- PAYOUTS EXECUTED: **NO**
- SEPAY IMPLEMENTED: **NO**
- MERGED TO MAIN/INTEGRATION V3: **NO**

## Known Limitations

- Production KMS/Vault key provisioning, database grants, physical identity/product separation and deployment backup/restore validation remain integration/deployment gates.
- Affiliate payout and provider payment verification remain separate workers/boundaries. The default tier values are not final commercial policy.
- Anonymous referral-cookie attribution, impersonation and invasive fraud fingerprinting are intentionally deferred.
- Audit hash chaining and a dedicated immutable log sink are deferred pending an approved operational consumer.
- The account/admin pages are functional placeholders for owner review, not the final UI/UX redesign.

## Integration Requirements

Integration V3 must combine the following deliberately:

1. Start from the verified Staging Integration V2 product head and preserve its Credits/VIP invariants, existing Auth/F-001, Tarot/KB/L1/L4/L5/L7/L8 and Share S1–S6 boundaries.
2. Apply this branch’s `0007_backend_completion.sql` after `0006_credits_vip.sql`, run fresh and upgrade migrations in the V3 worktree, and repeat the full verification suite before any remote migration.
3. Keep the separate SePay V1 worker provider-specific. Its only contract into this branch is a server-verified fulfilled economic event matching `VerifiedFulfillmentEvent`; browser redirects, pending orders and unverified payment notifications must not create commission.
4. Resolve route/UI file composition in V3 without broadening the functional placeholder UI into the final redesign. Preserve no-store, origin, owner-scope and server-side RBAC boundaries.
5. Review production KMS, database roles, backup/restore, monitoring, rate limits, retention and migration rollback before requesting any deployment or production migration gate.

No automatic merge into Integration V3 was performed.

## Production Security Gates Remaining

Approve and separately execute: production key/KMS provisioning and rotation test; least-privilege database credentials; migration backup/rollback rehearsal; operational audit retention/tamper monitoring; payment/SePay verified-event contract test; affiliate fraud/reconciliation runbook; privacy/retention review; and final UI/UX approval.

## Safe for Integration V3

**YES**, as an isolated, source-only branch after normal code review and the explicit integration requirements above.

## Safe to Archive

**YES**, after the final push is verified. Keep the branch and report as the reviewable artifact; do not delete or merge it automatically.
