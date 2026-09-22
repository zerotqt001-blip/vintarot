# NaTarot Data Classification V1

This classification is a handling contract for the backend completion work. It describes field categories, not real customer data. Logical isolation is not physical separation: the application uses owner predicates and service boundaries in the existing D1/SQLite store, and this document does not claim separate databases or tenant-level physical barriers.

## Categories and handling

| Category | Example fields | Storage/response rule | Logging rule |
| --- | --- | --- | --- |
| Public | active deck/card catalog, public share contract, product display names | May be returned by the existing public contracts | Safe to log as bounded identifiers or slugs |
| Internal | opaque member ID, order ID, fulfillment ID, policy version, status, timestamps | Return only to the authenticated owner or a permitted admin read model | Use opaque IDs and bounded values |
| PII | email, phone, display name, OAuth subject, IP-derived operational context | Minimize access; deterministic auth fields remain in their existing auth tables; optional sensitive operational fields use the encryption abstraction | Redact or mask; never place raw values in generic audit metadata |
| Auth secret | password hash, session token, token hash, OAuth state, reset token, cookie value | Never return; token hashes remain server-only; session listings use opaque session IDs | Never log or audit raw secret material |
| Commercial | package/version snapshot, order status, fulfillment result, affiliate code status, conversion status | Return provider-neutral metadata only to the owner or permitted role | Audit action and opaque object ID; no provider secrets |
| Financial metadata | integer minor-unit amount, currency, payment reference, commission amount, eligibility/hold state | Use integer arithmetic, explicit currency, and bounded provider-neutral read models | No payment secret or raw webhook body |
| Tarot-private | question, optional context, reading payload, card interpretation, journal detail | Owner-only through existing predicates; admin order/affiliate models exclude it | Never copy into audit metadata or admin summaries |
| Audit | actor ID, target ID, action, reason, idempotency key, redacted metadata, timestamp | Append-only insert; safe projection for reads; audit read requires permission | Recursive redaction and bounded size |
| Operational | migration marker, environment name, version, backup result, deployment gate status | Internal operations access only | Safe status strings; never print key material |

## Opaque identifier and ownership rules

- IDs are random or otherwise opaque text values. Public routes do not expose database row assumptions or referral member IDs.
- Account/history routes derive the owner from the existing cookie-backed identity. A client-supplied owner/member/account field is ignored or rejected.
- Admin routes may target an opaque member or order ID only after server-side permission and target existence checks. A target ID does not grant access.
- Share URLs continue to use token hashes and the existing Share S1–S6 contract. Account/history read models never return raw share bearer tokens.

## Retention and deletion semantics

Account deletion is a controlled domain operation, not a blind row cascade. Public profile fields may be anonymized where required by commercial/audit retention; auth sessions and bearer tokens are revoked; Tarot-private content is deleted or detached only through an explicit, tested retention policy. Financial metadata and audit records use legal/operational retention rules and compensating records rather than mutable history. V1 implements safe reads and status controls, but does not silently claim a production deletion schedule.

## Review checklist

Before a field is added to a response, identify its category, owner predicate, role requirement, retention rule, and log/audit treatment. Any field without those answers stays internal. The classification must be revisited for provider integration, key provisioning, data export, or a future physical isolation project.
