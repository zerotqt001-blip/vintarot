# NaTarot First Owner Provisioning Implementation Plan

> **For agentic workers:** Execute this plan inline in the existing isolated worktree. Do not use production account credentials or ask for passwords or one-time codes. Current status: implementation, review, production deployment, verified backup restore, and guarded first-owner provisioning are complete. The Owner must sign in again because provisioning revoked prior sessions, then personally complete Google consent before reporting work can begin.

**Goal:** Add a tested, root-only, one-use path for the exact existing, email-verified `USER` account named by the legitimate Owner to become the first `SUPER_ADMIN`.

**Architecture:** Keep public registration and authentication unchanged. Add one transaction-capable server-side provisioning function and a production-guarded CLI; use the existing unique audit idempotency key as replay protection, write the audit event and role change in the same transaction, and revoke the target's existing sessions. Narrow the Google Drive OAuth request to the identity and per-file scopes used by the callback and backup workflow.

**Tech Stack:** TypeScript, Node `node:sqlite`, the existing D1-shaped SQLite adapter, existing audit service, standalone esbuild output, Node test runner with `tsx`.

**Spec:** `docs/superpowers/specs/2026-09-27-natarot-first-owner-provisioning-design.md`

## Global Constraints

- Never target or modify existing `ADMIN` or QA accounts.
- Never add a public bootstrap endpoint or promotion based on email address.
- Never log or store passwords, password hashes, cookies, verification tokens, OAuth credentials, identity documents, or document contents.
- Do not change registration behavior, role permissions, existing accounts, business data, schema, migrations, or the BCC timer.
- Run account-role changes only after fresh Google OIDC sign-in of the exact account, explicit Owner authorization for that account, and a fresh restore-verified production backup.
- Preserve the current production release as the canonical product baseline and keep the work on `codex/natarot-business-control-center`.

---

### Task 1: Add failing first-owner transaction tests

**Files:**
- Create: `tests/first-owner-provision.test.ts`
- Read: `tests/owner-test-provision.test.ts`, `drizzle/0004_member_auth.sql`, `drizzle/0007_backend_completion.sql`

**Interfaces:**
- `provisionFirstOwner(database, input, now)` accepts a transaction-capable database, exact member ID and email, independent identity and authorization references, operator reference, verified backup ID/hash, and restore-verification reference.
- Successful provisioning returns only an opaque member ID, revoked-session count, and audit event ID.
- Every rejected input leaves member role, sessions, and audit rows unchanged.

- [x] Write tests for a normal verified `USER`, requiring a consumed `email-verification` token and an existing session; expect the target to become `SUPER_ADMIN`, the session to be revoked, and exactly one success audit event to be written without email or credential values in audit metadata.
- [x] Write rejection tests for an existing `SUPER_ADMIN`, existing `ADMIN`, `owner_test.provisioned` QA account, unverified or disabled `USER`, account without a consumed app verification token, wrong member ID/email pairing, a missing evidence reference, an invalid backup hash, and a previously used bootstrap key.
- [x] Write a replay test that calls the operation twice and proves the second call cannot change roles or add an audit event.
- [x] Write a transaction rollback test that makes the audit insert fail and proves the role and sessions remain unchanged.
- [x] Run `npx tsx --test tests/first-owner-provision.test.ts`; first confirmed the tests failed because the implementation did not exist, then confirmed they pass after implementation.

### Task 2: Implement transactional first-owner provisioning

**Files:**
- Create: `lib/owner-bootstrap/provision.ts`
- Modify: `tests/first-owner-provision.test.ts`

**Interfaces:**
- `provisionFirstOwner(database, input, now = Date.now)` returns `{ memberId, revokedSessions, auditEventId }`.
- The fixed audit idempotency key is `natarot:first-owner:bootstrap:v1`.
- The audit action is `member.first_owner.provisioned`; metadata contains only opaque verification, authorization, operator, backup, and restore-verification references plus the archive hash.

- [x] Implement bounded validation for the email, member ID, evidence references, and SHA-256 value; throw generic errors that do not include those input values.
- [x] Require the transaction-capable database interface and fail closed if it is absent.
- [x] Within `database.transaction`, reject a prior bootstrap event or any existing `SUPER_ADMIN`, then verify the exact enabled `USER`, normalized email, non-null app email-verification timestamp, and absence of `owner_test.provisioned`; accept either the consumed app-verification-token path or the linked Google identity with a recent matching login and active session.
- [x] Update only the matched `USER` to `SUPER_ADMIN`; require exactly one changed row.
- [x] Revoke all unrevoked sessions for the target.
- [x] Insert the fixed-key success audit record with `ignoreExisting: false` before committing so an audit failure rolls the role/session updates back.
- [x] Run `npx tsx --test tests/first-owner-provision.test.ts`; all seven provisioning tests pass.

### Task 3: Add a guarded root-only operator CLI

**Files:**
- Create: `scripts/provision-first-owner.ts`
- Modify: `tests/first-owner-provision.test.ts`

- [x] Require `process.getuid() === 0`, `NODE_ENV=production`, `NATAROT_FIRST_OWNER_PROVISION=1`, and the fixed `/var/lib/natarot/natarot.sqlite` database path before opening the database.
- [x] Require the exact member ID/email, Owner authorization reference, identity-verification reference, operator reference, backup identifier, 64-character backup SHA-256, and restore-verification reference from environment inputs.
- [x] Require an interactive human gate that re-confirms the candidate email, account-control and authorization references, verified backup/hash, restore reference, and exact one-time phrase.
- [x] Verify current backup files, checksum and restore status, run the installed release manager's verifier, require the audited `/` ext4 mount, and open only an existing regular SQLite file with the expected integrity, auth/session/audit schema, and unique audit key.
- [x] Bundle the operator to `dist/provision-first-owner.mjs` for production so it does not require the development-only `tsx` loader.
- [x] Wrap the production connection in the existing SQLite adapter, invoke `provisionFirstOwner`, close resources in `finally`, and print only a generic completion or failure message.
- [x] Add and pass a safe missing-opt-in CLI regression that proves the script exits before attempting to open the production database and does not echo supplied values.
- [x] Run the focused first-owner tests and CLI regression; the current focused suite passes.

### Task 4: Request only the Google scopes used by the connection

**Files:**
- Modify: `lib/google-drive.ts`
- Modify: `tests/google-drive.test.ts`

- [x] Add a test that calls the real authorization URL builder and asserts its scope set is exactly `openid email https://www.googleapis.com/auth/drive.file`.
- [x] Run the focused test and verify it fails while `profile` is requested.
- [x] Remove only the unused `profile` scope from the Google Drive authorization request; preserve state, PKCE, refresh access, callback behavior, and existing Drive scope validation.
- [x] Run the Google Drive tests; the new scope test and existing Drive tests pass.

### Task 5: Record evidence and run regression gates

**Files:**
- Modify: `docs/PROJECT_STATE.md`
- Review: all changed files and staged diff

- [x] Record the production audit, Owner evidence blocker, implementation state, missing MFA support, Google callback URI, and BCC timer state without recording emails, credentials, backup secrets, or verification documents.
- [x] Run the full suite (`757/757`), `npx tsc --noEmit`, `npm run build`, changed-file ESLint, and `git diff --check`; build/check the standalone first-owner bundle and scan changed source/docs for secret-like values.
- [x] Verify the production route inventory has no first-owner HTTP endpoint and that the existing Admin/QA accounts are not modified by the code path.
- [x] Incorporate the final read-only code review, stage only related source, tests, operational/spec/plan docs, and project-state update, inspect the staged diff for secrets, commit only related files, push the branch, and confirm remote equality.

### Task 6: Execute production gates when Owner evidence is available

**Files:**
- No additional source file changes unless a verification step exposes a defect.

- [x] Audit the exact existing production account read-only; confirm it is an enabled verified `USER` with a linked Google identity, no QA provisioning event, and no account-targeted audit events. Preserve all other member roles and business data.
- [x] Record the Owner's explicit authorization for the exact email/account from the direct task instruction; do not treat knowledge of the email address alone as identity verification.
- [x] Have the Owner sign in personally through the existing Google login using the linked email. Require an active app session and a `last_login_at` less than 15 minutes old before provisioning.
- [x] Create and restore-verify a fresh production backup with the installed backup/release tooling; capture only its backup ID, SHA-256, and restore-verification reference.
- [x] Run the root-only CLI once against the fixed production database; verify the role, audit event, and revoked pre-provision sessions. The success audit row's unique bootstrap key preserves replay rejection.
- [x] Have the Owner sign in again personally after the role change; verify the account identity, active `SUPER_ADMIN` role, and protected admin dashboard.
- [ ] Have the Owner complete Google consent personally at the existing connection URL. The in-app browser did not display the consent screen, so continue from the signed-in NaTarot tab and let the Owner approve the grant.
- [ ] Verify the connected Google email is the Owner's selected account, the returned grant includes `drive.file` and no broader Drive permission, and the same production Owner session remains the authenticated member.
- [ ] Create the workbook, perform and reconcile the initial production synchronization, create and restore-verify the encrypted Drive backup, and enable the BCC timer only after all prior checks pass.
- [x] Stop without role mutation if the exact account has no fresh verified login, the separate Owner authorization is absent, the exact backup/restore gate fails, or any transactional eligibility check rejects the target; all required gates passed before the one-time role mutation.

### Follow-up: Existing Google-verified Owner account compatibility

**Files:**
- Modify: `lib/owner-bootstrap/provision.ts`
- Modify: `tests/first-owner-provision.test.ts`
- Modify: `docs/operations/NATAROT_FIRST_OWNER.md`
- Modify: `docs/superpowers/specs/2026-09-27-natarot-first-owner-provisioning-design.md`
- Modify: `docs/PROJECT_STATE.md`

**Security contract:**
- Preserve the existing password path: exact enabled `USER`, app verification timestamp, and consumed app-issued verification token.
- Also permit the same account assurance from a linked Google identity only when the account has a non-empty Google subject, verified email, and a successful application login within the preceding 15 minutes.
- For the Google path, bind the identity evidence reference to `google-login-<last_login_at ISO timestamp>`; record the method and timestamp in the one-time audit event.
- Keep all existing single-use, QA rejection, backup, exact-account, transactional role assignment, and session-revocation gates.

- [x] Add a failing transaction test for a verified Google-linked account after a fresh Google login; assert role assignment, session revocation, and audit method/timestamp.
- [x] Run the focused test and confirm it fails because the existing implementation requires a password and consumed email token.
- [x] Add the minimum implementation and focused rejection coverage for stale Google login, a missing active app session, and mismatched login evidence reference.
- [x] Add a regression proving login freshness is evaluated after the transaction waits for its database write lock.
- [x] Update the operator runbook and design record to document the existing-account Google verification path and its 15-minute login window.
- [x] Run focused first-owner tests, full regression suite (`757/757`), typecheck, production build, targeted lint, diff and secret review.
- [x] Commit and push the reviewed change to `codex/natarot-business-control-center`.
- [x] Deploy the reviewed source through the release manager; verify production health and release rotation, confirm the configured Google callback, and leave cleanup deferred pending browser verification.
