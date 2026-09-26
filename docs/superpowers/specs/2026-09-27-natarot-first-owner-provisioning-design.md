# NaTarot First Owner Provisioning Design

## Goal

Allow the legitimate NaTarot Owner to create a new account through normal registration, verify its email, and receive the first `SUPER_ADMIN` role through a trusted, one-time server-side operation with explicit Owner authorization and independently verified identity.

## Current evidence

- Production currently has no `SUPER_ADMIN` account.
- The two enabled, email-verified production `ADMIN` accounts are `admin` and `natarot_owner_test`; both have `owner_test.provisioned` audit events from the QA provisioner. Neither is evidence of the legitimate Owner, and neither is eligible for promotion.
- Normal registration stores a `USER`, sends an app-issued verification link, and leaves sign-in blocked until the link is consumed.
- Role management through the application requires `admin.roles.manage`, which only `SUPER_ADMIN` receives. No approved first-owner or break-glass procedure exists in source or operational documentation.
- `audit_events` has a unique idempotency key and the production SQLite adapter supports a transaction callback.
- MFA is not implemented in the member schema or application.
- Production health and SQLite integrity checks currently pass. The latest release is the BCC migration-fix release, and its timer is disabled.

## Provisioning path

1. The Owner supplies a new email address directly and registers at the existing public registration page. The Owner enters the password and consumes the verification email personally; Codex never receives a password or one-time code.
2. A trusted human operator verifies the Owner against an authoritative business ownership or authorized-representative record through a channel independent of the new account. The same operator records a separate reference for the Owner's explicit authorization of the exact account. Documents and personal identity data stay out of the application database and Codex chat.
3. Before role mutation, the operator creates and restore-verifies a fresh production backup with the installed release/backup tooling. The backup identifier, checksum, and restore-verification reference are passed to the one-time command and retained in its audit event.
4. A root-only CLI runs against the fixed production SQLite path. It requires production mode, an explicit invocation flag, the exact member ID and normalized email, both Owner evidence references, an operator reference, and verified-backup references. It has no HTTP route. Its release build emits a standalone Node bundle so production does not need a development TypeScript loader.
5. Inside one transaction, the CLI requires: no existing `SUPER_ADMIN`, no prior successful first-owner audit marker, a matching enabled `USER`, a non-null app email-verification timestamp, a consumed app-issued email-verification token, a password-authenticated account, and no `owner_test.provisioned` event for that member. It updates only that member's role, revokes every existing session for that member, and inserts the success audit event. Any failed check or failed audit insert rolls back the full transaction.
6. A fixed unique audit idempotency key permanently closes first-owner bootstrap after success. The normal application role endpoint remains unchanged and no automatic email-based promotion is added.
7. The Owner signs in again personally after the CLI has invalidated all prior sessions. The operator verifies the admin dashboard and account security state without handling the Owner's password or codes.

Before opening the database, the CLI requires an interactive terminal, re-confirms the exact member ID, candidate email, separate evidence references, backup checksum, and restore reference, verifies the latest archive against its checksum sidecar and SHA-256, requires the restore status to be successful and later than the backup, runs the installed release manager's read-only backup verifier, checks the expected ext4 root mount, and validates an existing regular SQLite file with the required auth/session/audit schema and integrity. The supported Node 22 SQLite API has no writable no-create option, so the operator performs read-only file/schema preflight and restricted-parent checks before a plain-path write open, then verifies the same file identity and schema again.

## Audit record and privacy

The success audit record identifies the target member, operator reference, independent identity-check reference, Owner authorization reference, backup identifier, backup SHA-256, and restore-verification reference. It stores no email address, password, password hash, session cookie, verification token, Google credential, identity document, or document contents. CLI output is limited to a generic success or failure message.

## Google Drive connection

The existing member-authenticated connection flow remains the only connection path. It continues to use one-time state, PKCE, the same signed-in member at callback, a verified Google email, and encrypted refresh-token storage. The authorization request will request only `openid`, `email`, and the existing per-file `drive.file` scope; the callback uses only Google subject and verified email, so the unused `profile` permission is removed. No Google account is connected until the Owner personally signs in and consents.

## Verification and production gates

- Synthetic tests prove each precondition, rejection of QA/ADMIN accounts, replay protection, atomic rollback, audit contents, session revocation, and the exact OAuth scopes.
- Run the full test suite, typecheck, production build, and diff/secret review before a release.
- Use the installed release manager for any production deployment. Do not activate the BCC timer as part of this Owner task.
- Do not perform the production role mutation until the Owner email, successful app email verification, independent identity evidence, explicit Owner authorization, and a fresh restore-verified production backup are all present.
- After provisioning, require the Owner-controlled sign-in and Google consent steps before claiming account or Google readiness.

## Known blocker

The existing production account registry does not establish who legally owns or represents NaTarot. The QA audit records cannot establish ownership. Required additional evidence is an authoritative business ownership/authorized-representative record checked out of band by a trusted operator, plus a separate explicit Owner authorization reference naming the new email/account. The Owner must also provide the new email directly and verify it through the website. Until then, no account is registered or promoted.
