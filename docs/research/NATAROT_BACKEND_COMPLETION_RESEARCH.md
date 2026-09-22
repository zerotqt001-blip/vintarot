# NaTarot Backend Completion V1 — Research Record

Status: source-grounded architecture record for the isolated branch `codex/natarot-backend-completion-v1`.

## Scope and evidence boundary

The implementation base is `fd7d8fe14c86a282d9319d79fef73ee654ae5032`, the local Staging Integration V2 checkpoint. It was selected because it contains the verified Credits/VIP V1 behavior and the preceding Auth, Tarot, Share, and order contracts. The repository had a clean local validation baseline of 474 passing tests, a passing TypeScript check, and a passing build before this work. The base selection is a repository decision, not a claim that staging or production is approved for migration.

The observations below were captured on 2026-09-21. Repository HEAD values are exact observed refs from the corresponding public Git remote at that time; activity and license statements are observations from the public repository metadata and files, not warranties about future releases.

## Decision table

| Source | Observed HEAD/tag | License evidence and activity evidence | Useful pattern | Incompatible assumption or security concern | NaTarot decision |
| --- | --- | --- | --- | --- | --- |
| [Better Auth Admin](https://github.com/better-auth/better-auth/blob/main/docs/content/docs/plugins/admin.mdx) | `41b7dc15de41a8726422c392a4857d8764828891` on `main` | MIT repository; active public project, observed pushed 2026-09-21 | Server-only permission checks, role/permission separation, ban/unban, session listing and revocation | Adopting a framework plugin would risk changing F-001/Auth semantics and its persistence model; client-visible roles are not authorization | **ADAPT** the server-side patterns only |
| [OpenFGA modeling](https://openfga.dev/docs/modeling/getting-started) and testing guidance | `ab557c5592670c899de35297e7aa067015f06502` on `main` | Apache-2.0 repository; active public project, observed pushed 2026-09-21 | Resource-first relationship modeling and explicit authorization assertions | A new ReBAC service is unnecessary for the fixed six-role admin surface and would expand the data/control plane | **REFERENCE ONLY** |
| [node-casbin](https://github.com/apache/casbin-node-casbin) | `aad42ce2be70908bbc76c5b89b505cf0655245e8` on `master` | Apache-2.0 repository; active public project, observed pushed 2026-09-09 | Explicit policy models, RBAC/ABAC vocabulary, server-side enforcement | A policy adapter and watcher would add runtime configuration and cache invalidation risks without improving the small static matrix | **REFERENCE ONLY** |
| [Medusa order affiliate example](https://github.com/headless-commerce-company-weframe-tech/medusa-order-affiliate) | `f85c5ca1576c8234ca851a944babf04f913f9f92` on `main` | MIT repository; small public project, observed pushed 2026-08-12 | Separate affiliate conversion facts from order/payment events and record commission history | It assumes Medusa modules and PayPal payout execution; payout automation and framework adoption are outside this mission | **ADAPT** event/ledger boundaries only |
| [Medusa order-management and payment-flow docs](https://docs.medusajs.com/resources/commerce-modules/payment/payment-flow) | Documentation was reviewed on 2026-09-21 | Official documentation; framework behavior is versioned independently of this repository | Capture/refund event sequencing and subscriber/workflow separation | This is not a provider-verification specification for NaTarot and must not introduce checkout or payment-provider code | **REFERENCE ONLY** |
| [pametan/audit-log](https://github.com/pametan/audit-log) | `0cfdb2cdc180db9a6729d0b44e38c6a2b609ed1e` on `main` | MIT repository; small public project, observed pushed 2026-05-26 | Redacted audit records and append-oriented history ideas | A new dependency is unnecessary; a hash chain would overstate guarantees on the portable D1/SQLite path without a tested concurrency protocol | **ADAPT** redaction vocabulary only |
| [open-audit](https://github.com/tomaslachmann/open-audit) | `3251abbb9bb2b0b2d6d6969e9963940d0abf28f3` on `master` | No SPDX license was reported in the observed metadata; small public project, observed pushed 2025-07-10 | Audit-event shape and review concepts | Unclear redistribution terms and insufficient fit for the existing runtime | **REJECT** as a dependency |
| [Node crypto API](https://nodejs.org/api/crypto.html) | Node documentation reviewed on 2026-09-21 | Official runtime documentation | AES-GCM authenticated encryption primitives, explicit IV/tag handling, key separation | Runtime crypto does not provision or rotate production keys; secrets must stay outside the database and Git | **ADOPT** the primitive through a narrow local abstraction |
| [SePay PG Node SDK](https://github.com/sepayvn/sepay-pg-node) | `62178220f36cda2f6657731ef182ecd84dd67e2f` on `main` | MIT repository; small public project, observed pushed 2025-10-20 | Provider adapter boundary and merchant credential separation as an architectural reference | Implementing it would alter the locked provider/payment scope and require credentials, webhooks, reconciliation, and production gates | **REFERENCE ONLY**; no SePay code or dependency |

## Decisions carried into implementation

1. Use NaTarot-native services and the existing D1/SQLite adapter. Do not add Better Auth, OpenFGA, Casbin, Medusa, audit-log, open-audit, or SePay as runtime dependencies.
2. Keep authorization server-derived: the current session identifies the actor, and the current member row supplies the role and disabled state. Headers, query parameters, hidden form fields, and client role claims are untrusted.
3. Treat verified order fulfillment as the only affiliate conversion boundary. The affiliate ledger records immutable facts and compensating entries; it does not pay anyone and does not verify a provider payment.
4. Use the built-in Web Crypto AES-GCM primitive through a versioned field format. Key IDs permit rotation compatibility, but key provisioning, retention, revocation, and incident response remain operational gates.
5. Keep the boundary honest: NaTarot receives logical data isolation through owner predicates and least-privilege services. Logical isolation is not physical separation, and this work does not claim a separate database, tenant, or cryptographic perimeter.
6. Use an append-only audit table with recursive redaction. Hash-chain or tamper-evident external retention is not claimed by this V1.

## Explicit non-goals

This research does not authorize deployment, migration against production or staging, process restart, secret changes, payout execution, checkout implementation, provider SDK integration, merge, or visual redesign. It does not supersede F-001 trusted identity, Google OAuth, guest ownership, KB V5, tarot-reading-v4.2.2, Share S1–S6, Credits/VIP invariants, backup/DR, or the production runtime.
