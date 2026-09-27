# NaTarot first Owner provisioning

This procedure grants the first `SUPER_ADMIN` role to the exact existing account named by the NaTarot Owner. It is a one-time, root-only operation. There is no public bootstrap endpoint, email-based promotion, or password/OTP collection by the operator.

## Required before role assignment

1. The Owner names the exact existing account and signs in through the normal website flow. Do not create a duplicate account. For an account created or linked through Google, the Owner must personally choose the same Google account. Do not ask the Owner to send a password, verification code, session cookie, or identity document through Codex.
2. A trusted operator verifies control of the exact account through the application's authentication evidence, then records a separate reference to the Owner's explicit authorization for that email and member ID. A Google-linked account qualifies only when the application's OIDC flow has verified Google's `email_verified=true` claim, the account has a non-empty Google subject, and the Owner has completed a successful application login within the preceding 15 minutes. Its identity reference must exactly equal `google-login-<last_login_at as UTC ISO timestamp>`; the transaction also requires an active, unexpired application session created at or after that login. A password-backed account continues to require an app-issued email-verification token marked consumed. Knowledge of an email address alone is not proof.
3. The target must be the exact enabled `USER` returned by the normal authentication system. Existing `ADMIN`, QA-provisioned, disabled, unverified, or previously promoted accounts are ineligible.
4. Create a fresh production backup and run the approved restore verification against that exact archive. The one-time tool verifies the latest archive ID, checksum sidecar, archive SHA-256, successful restore status, and that its timestamp follows the backup timestamp; the initial check requires a backup no more than 30 minutes old. After the human confirmation and database preflight, it repeats all checks and requires the backup to be no more than 25 minutes old, leaving a five-minute execution margin. The legacy restore-status file does not record a backup ID, so the trusted operator must check the exact archive used and enter the corresponding restore reference at the human gate. The installed release manager's `verify-backups` check must also pass.
5. Confirm the production database exists as a regular file with the expected authentication, session, and audit schema, SQLite integrity `ok`, a unique audit idempotency index, and the audited `/` ext4 storage mount. The tool refuses to create a missing file.

If the operator cannot verify control of the exact account or obtain separate explicit Owner authorization, stop. The present production `ADMIN` and QA audit events do not establish Owner authorization.

## Run the one-time operator

The release build emits `dist/provision-first-owner.mjs`. Run it with Node from an interactive root terminal on the production host; the runtime does not require the development-only `tsx` package. The process requires `NODE_ENV=production`, `NATAROT_FIRST_OWNER_PROVISION=1`, and these exact account/evidence inputs:

- `NATAROT_FIRST_OWNER_MEMBER_ID`
- `NATAROT_FIRST_OWNER_EMAIL`
- `NATAROT_FIRST_OWNER_IDENTITY_VERIFICATION_REF`
- `NATAROT_FIRST_OWNER_AUTHORIZATION_REF`
- `NATAROT_FIRST_OWNER_OPERATOR_REF`
- `NATAROT_FIRST_OWNER_BACKUP_ID`
- `NATAROT_FIRST_OWNER_BACKUP_SHA256`
- `NATAROT_FIRST_OWNER_RESTORE_VERIFICATION_REF`

The tool checks the current backup and restore records itself, then asks the operator to re-enter the candidate email and member ID, identity and authorization references, backup ID plus checksum, restore reference, and the exact phrase `OWNER IDENTITY AND AUTHORIZATION VERIFIED FOR THIS ACCOUNT`. For a Google-linked account, use the exact recent-login reference derived from its `last_login_at` timestamp. Do not redirect terminal input/output to logs. The tool prints only a generic outcome and never prints the supplied values.

Provisioning runs in one database transaction. It assigns `SUPER_ADMIN` only to the eligible exact `USER`, revokes that member's pre-provision sessions, and writes the single-use `member.first_owner.provisioned` audit event. The audit records `consumed_app_token` or `google_oauth_recent_login` and, for Google, the verified login timestamp. An audit insert failure rolls the transaction back. The unique audit key permanently prevents replay. Existing account roles and business data are not modified.

## After provisioning

The Owner signs in personally; the operator does not handle credentials or codes. Verify login/logout, session invalidation, the admin dashboard, and the Google Drive connection entry point. The NaTarot application does not support MFA. If the Owner uses Google sign-in, they can enable MFA on their Google Account; if they use an app password, they should use a strong unique password.

Google consent is a separate Owner-controlled action. The existing connection URL is `https://natarot.com/api/google-drive/connect?return_to=%2Faccount`; it requests only `openid`, `email`, and `https://www.googleapis.com/auth/drive.file`. The Owner must confirm the Google account shown is theirs and personally approve consent. Keep the Business Control Center timer disabled until this connection and the initial workbook, synchronization, and backup verification all pass.
