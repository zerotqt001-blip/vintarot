# NaTarot Backend Completion V1 Operations

## Local validation

The branch is based on `fd7d8fe14c86a282d9319d79fef73ee654ae5032`. Local validation applies migrations to fresh and upgrade SQLite fixtures, runs focused security/commercial/ownership suites, then the complete tracked test suite, TypeScript, build, targeted lint, diff checks, and credential-shaped scans. The baseline is evidence only; affected regression groups must still run after changes.

## Migration procedure and rollback posture

`drizzle/0007_backend_completion.sql` is additive and follows `0000`–`0006`. It must be rehearsed against a fresh local database and a copy containing legacy members, sessions, readings, shares, Credits, orders, fulfillments, and commercial events. Production/staging migration is **NO** for this branch. There is no rollback by destructive down migration; an approved operator would use a forward corrective migration after backup verification and a human review of row counts, foreign keys, and indexes.

## Key and secret operations

`NATAROT_PII_KEY_V1` and any future keyring values are provisioned outside Git and outside the database through the deployment secret manager. Operators must record key ID, custody owner, activation time, rotation compatibility window, revocation plan, and restore procedure without recording key material. A key rotation is incomplete until old ciphertext can be read during the compatibility window and new writes use the new key ID. Missing-key behavior must fail closed without logging plaintext.

## Monitoring and incident response

Review counts and rates for failed auth, disabled-member access attempts, admin denials, session revocations, duplicate economic events, affiliate reversals, audit insert failures, encryption failures, migration failures, and unusual cursor/ID probing. Alerts must contain opaque IDs and bounded status details, never tokens, passwords, referral codes, questions, reading payloads, payment secrets, or key material.

An incident response must first revoke affected sessions or keys, preserve the append-only audit and commercial evidence, assess owner/PII/Tarot-private exposure, and apply a forward corrective action. Affiliate reversals are compensating ledger facts; they are not a reason to rewrite historical conversions or move real money in this V1.

## Release gates and handoff

This branch is **IMPLEMENTED/VERIFIED** only after the local matrix passes. It is **PUSHED** only after the branch hash is confirmed at the configured remote. It is not **MERGED** or **DEPLOYED** by this task. Integration V3 must review the migration against the real deployment backup/restore path, provision the keyring, review retention/deletion policy, run the provider-neutral commercial reconciliation plan, and separately authorize any staging or production migration. SePay remains reference-only and no SePay credentials or SDK are part of this handoff.
