# NaTarot Audit Architecture V1

## Purpose

`audit_events` records security-sensitive and privileged domain actions: actor, action, target, reason, idempotency key, outcome, timestamp, and bounded redacted metadata. It is an operational record for review and incident response, not a replacement for accounting or a claim of immutable external evidence.

## Append-only contract

The service exposes `append` and safe `list` operations. It issues insert statements only for writes; there are no update or delete methods. A unique event ID and optional idempotency key make retried audit writes deterministic. Database-level foreign keys are not used to make historical audit rows disappear when a target is anonymized.

V1 deliberately does not claim a cryptographic hash chain. D1/SQLite concurrency, key custody, and external retention would need a separate tested design before such a claim could be made.

## Redaction contract

Metadata is recursively normalized before insertion. Keys matching password, hash, token, cookie, secret, API-key, authorization, payment-secret, email, phone, question, reading, or payload concepts are removed or masked case-insensitively. Depth, string length, array length, object key count, and serialized size are bounded. Hostile circular-like or unsupported values never cause a route to serialize a secret or throw an uncontrolled error.

The safe list projection includes only the audit ID, actor ID, action, target ID, outcome, reason, idempotency key, timestamp, and already-redacted metadata. Raw session tokens, token hashes, referral codes, payment secrets, Tarot-private content, and encryption key material are never accepted as useful audit metadata.

## Access and retention

`admin.audit.read` is required for audit listing. Every privileged audit read is eligible for a bounded access audit in a future retention integration; V1 records the core mutation actions without recursively auditing an audit read loop. Retention, export, legal hold, backup, and deletion/anonymization policy remain operations-owned gates and must not be implemented by ad hoc SQL.
