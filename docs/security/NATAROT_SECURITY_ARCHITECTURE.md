# NaTarot Security Architecture V1

## Security boundary

The existing member session remains the trusted identity boundary. A route reads the server-side session cookie, hashes the bearer token through the existing Auth service, checks expiry/revocation/disabled state, and then derives the member owner key. Admin authorization re-reads the current member role on every privileged request. Guest ownership remains separate and cannot be upgraded by a client-supplied ID.

This implementation provides logical isolation through parameterized queries, owner predicates, and domain services. Logical isolation is not physical separation: no separate database, process, tenant, or network trust boundary is introduced here.

## Threat model and controls

| Threat | Control | Evidence expected |
| --- | --- | --- |
| IDOR across member, reading, share, order, or affiliate records | Owner derived from session; target predicate required; metadata-first models | Foreign-owner tests and adversarial review |
| Privilege escalation or role spoofing | Fixed server-side matrix; ignore headers and client role fields; disabled check | Role matrix tests |
| CSRF on mutations | Existing origin policy and no-store responses; route adapters use the shared boundary | Origin regression tests |
| Replay and duplicate economic events | Unique event/fulfillment/idempotency keys; conflict verification; compensating reversals | Duplicate and concurrent event tests |
| Self-referral or referral tampering | Hash opaque code server-side; first-touch insert-only attribution; compare member owner IDs | Affiliate adversarial tests |
| Secret/PII leakage | Never serialize token hashes or raw codes; recursive audit redaction; bounded response projections | Secret scan and hostile metadata tests |
| Ciphertext misuse or stale key | AES-256-GCM, random 12-byte IV, purpose AAD, version/key ID, keyring lookup | Round-trip, tamper, purpose, rotation tests |
| SQL injection and cursor abuse | Prepared statements, validated cursor encoding, bounded limit | Route and account-history tests |
| Tarot content leakage into admin surfaces | Provider-neutral order read models and no reading payload columns in admin queries | Admin model tests |

## Encryption abstraction

Sensitive optional fields use a versioned representation:

`natarot-pii:v1:<keyId>:<iv>:<tag>:<ciphertext>`

The implementation uses AES-256-GCM with a random 12-byte IV and the logical purpose string as authenticated additional data. Key material is supplied by a runtime keyring such as `NATAROT_PII_KEY_V1`; it is not stored in the database, checked into Git, or written to logs. Decryption accepts historical key IDs still present in the runtime keyring, so rotation can be staged. Missing keys, malformed payloads, wrong purpose, and authentication failures return fixed safe errors without revealing plaintext or key details.

V1 exercises the abstraction for optional affiliate fraud notes. Existing deterministic login fields remain compatible with F-001/Auth and are not encrypted in a way that would break lookup or OAuth semantics.

## Audit and authorization

Privileged mutations require a server-derived actor, a bounded reason, and an idempotency key when the action can be retried. The audit service accepts only redacted metadata and inserts into an append-only table. It does not expose token hashes, raw referral codes, Tarot-private payloads, or payment secrets. V1 does not claim a hash chain or external tamper-evident archive.

The permission matrix is fixed in `lib/admin/permissions.ts`. Roles are a product policy, not a client preference. A member ban revokes all active sessions; role/status mutations are audited; Credits and VIP mutations call their domain services rather than editing balances or entitlements directly.

## Operational gates

Production key provisioning, key rotation/revocation, retention schedules, backup/restore rehearsal, monitoring, incident response, and migration approval remain human-controlled gates. This branch performs local fresh/upgrade migration tests only. It does not deploy, migrate production/staging, restart services, alter credentials, add a provider SDK, or move real money.
