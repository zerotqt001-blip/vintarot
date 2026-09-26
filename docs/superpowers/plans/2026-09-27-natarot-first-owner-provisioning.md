# NaTarot First Owner Provisioning Implementation Plan

> **For agentic workers:** Execute this plan inline in the existing isolated worktree. Do not use production account credentials or ask for passwords or one-time codes. Current status: implementation, review, and synthetic verification are complete; live account creation/provisioning is gated on Owner-provided email, completed registration/verification, independent identity verification, and explicit authorization.

**Goal:** Add a tested, root-only, one-use path for the legitimate Owner's new, email-verified `USER` account to become the first `SUPER_ADMIN`.

**Architecture:** Keep public registration and authentication unchanged. Add one transaction-capable server-side provisioning function and a production-guarded CLI; use the existing unique audit idempotency key as replay protection, write the audit event and role change in the same transaction, and revoke the target's existing sessions. Narrow the Google Drive OAuth request to the identity and per-file scopes used by the callback and backup workflow.

**Tech Stack:** TypeScript, Node `node:sqlite`, the existing D1-shaped SQLite adapter, existing audit service, standalone esbuild output, Node test runner with `tsx`.

**Spec:** `docs/superpowers/specs/2026-09-27-natarot-first-owner-provisioning-design.md`

## Global Constraints

- Never target or modify existing `ADMIN` or QA accounts.
- Never add a public bootstrap endpoint or promotion based on email address.
- Never log or store passwords, password hashes, cookies, verification tokens, OAuth credentials, identity documents, or document contents.
- Do not change registration behavior, role permissions, existing accounts, business data, schema, migrations, or the BCC timer.
- Run all account-role changes only after independent Owner identity verification, explicit Owner authorization, and a fresh restore-verified production backup.
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
- [x] Within `database.transaction`, reject a prior bootstrap event or any existing `SUPER_ADMIN`, then verify the exact enabled `USER`, normalized email, non-null app email-verification timestamp, non-null password hash, consumed app-issued email-verification token, and absence of `owner_test.provisioned` for the target.
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
- [x] Require an interactive human gate that re-confirms the candidate email, independent identity and authorization references, verified backup/hash, restore reference, and exact one-time phrase.
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
- [x] Run the full suite (`753/753`), `npx tsc --noEmit`, `npm run build`, changed-file ESLint, and `git diff --check`; build/check the standalone first-owner bundle and scan changed source/docs for secret-like values.
- [x] Verify the production route inventory has no first-owner HTTP endpoint and that the existing Admin/QA accounts are not modified by the code path.
- [x] Incorporate the final read-only code review, stage only related source, tests, operational/spec/plan docs, and project-state update, inspect the staged diff for secrets, commit only related files, push the branch, and confirm remote equality.

### Task 6: Execute production gates when Owner evidence is available

**Files:**
- No additional source file changes unless a verification step exposes a defect.

- [ ] Obtain a new email address directly from the Owner; have the Owner complete `/register` and the emailed verification link personally.
- [ ] Have a trusted operator verify an authoritative business ownership or authorized-representative record out of band and record an opaque evidence reference plus a separate explicit authorization reference for that account.
- [ ] Create and restore-verify a fresh production backup with the installed backup/release tooling; capture only its backup ID, SHA-256, and restore-verification reference.
- [ ] Run the root-only CLI once against the fixed production database; verify the role, audit event, and revoked pre-provision sessions, and confirm replay is rejected.
- [ ] Have the Owner sign in personally, verify login/logout and the admin dashboard, then complete Google consent personally at the existing connection URL.
- [ ] Verify the connected Google email is the Owner's selected account, the returned grant includes `drive.file` and no broader Drive permission, and the same production Owner session remains the authenticated member.
- [ ] Stop without role mutation if independent Owner identity evidence or explicit authorization is absent.
