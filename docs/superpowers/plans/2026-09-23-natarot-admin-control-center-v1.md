# NaTarot Admin Control Center V1 Implementation Plan

> **For agentic workers:** This plan is executed inline in the isolated worktree created for the Admin workstream. The user-provided Admin mission is the governing specification.

**Goal:** Complete the existing NaTarot Admin foundation into a usable, server-authorized internal control center without changing commercial activation or creating parallel financial systems.

**Architecture:** Keep the existing member-session RBAC boundary as the only Admin gate. Add a small Admin read-model layer that joins the canonical member, Credits ledger, VIP entitlement, reading metadata, orders, Affiliate and audit stores with bounded, masked projections; add reason-required Admin command functions that delegate mutations to the existing ledger/entitlement services and append idempotent audit events. Extend the existing functional Admin page to consume these projections and expose Dashboard, Users, Credits/VIP, Orders/Payments, Affiliate, Readings and Audit sections.

**Tech Stack:** React 19, TypeScript, Vinext/Vite, Cloudflare D1-compatible SQL, Zod, Node test runner with `tsx`, existing `member-auth`, `lib/admin`, Credits, VIP, Affiliate, Orders, readings and audit services.

**Spec:** User-provided `NATAROT — ADMIN CONTROL CENTER V1` mission in the task transcript.

## Global Constraints

- Do not modify or deploy package catalog, production package seeding/config, Checkout, SePay production activation, active Account commercial UI, or another worker's deployment files.
- Preserve Auth/F-001 and require server-side RBAC for every Admin API.
- VIP is an entitlement, not an Admin role.
- Financial and entitlement changes must use the authoritative ledger/entitlement services, require a reason, be idempotent, and create an audit event.
- Admin projections are metadata-only and mask sensitive PII by default; never expose secrets, raw token hashes, reading payloads, raw referral codes, SQL or arbitrary code execution.
- Do not create an owner QA account; support the commercial worker's normal audited QA flow.
- No production deployment.

---

### Task 1: Admin read models and permission coverage

**Files:**
- Create: `lib/admin/read-model.ts`
- Modify: `lib/admin/permissions.ts`
- Modify: `lib/admin/member-service.ts`
- Test: `tests/admin-control-center.test.ts`

**Interfaces:**
- `listAdminMembers(database, actor, { search?, limit? })` returns bounded members with masked email/phone and no password, OAuth, session-token or PII secrets.
- `getAdminMemberDetail(database, actor, memberId)` returns one member's account status, canonical Credits balance/history, active VIP metadata, order metadata and Affiliate summary, all filtered to that member.
- `listAdminMemberReadings(database, actor, memberId, limit?)` returns bounded reading usage/history metadata without question text, normalized reading payload, card interpretation or share tokens.
- `getAdminDashboard(database, actor)` returns aggregate operational counts only.
- The `admin.readings.read` and `admin.dashboard.read` permissions are server-enforced and granted only to the existing support/finance/admin tiers that need them.

- [x] Write failing tests for search, masked PII, owner-scoped user details, reading metadata privacy, dashboard counts and the new permission matrix.
- [x] Run `npx tsx --test tests/admin-control-center.test.ts` and confirm the new behaviors fail for the missing APIs/projections.
- [x] Implement the minimal bounded read-model and permission functions using parameterized SQL and the existing domain services.
- [x] Re-run the focused tests and then the existing Admin/RBAC suite.

### Task 2: Audited Admin credit and VIP commands

**Files:**
- Create: `lib/admin/actions.ts`
- Modify: `app/api/admin/credits/route.ts`
- Modify: `app/api/admin/vip/route.ts`
- Modify: `lib/credits/repository.ts` only if actor metadata can be added without changing commercial semantics
- Test: `tests/admin-control-center.test.ts`

**Interfaces:**
- `adjustAdminMemberCredits(database, actor, { memberId, units, reason, idempotencyKey })` delegates to `createCreditStore(database).adjustCredits`, never writes a balance, and creates one idempotent `credits.adjusted` audit event.
- `grantAdminVip` and `revokeAdminVip` delegate to `grantManualEntitlement`/`revokeEntitlement` with `sourceType: ADMIN`, reason and replay key intact.

- [x] Add failing tests proving positive and negative adjustments create ledger entries, preserve conservation, require reasons, cannot target another owner through a supplied owner object, and replay without duplicate financial/audit entries.
- [x] Add failing tests proving VIP grant/revoke use entitlement rows and audit events rather than balance or direct display updates.
- [x] Implement command functions and route adapters with strict Zod schemas, origin checks and safe error mapping.
- [x] Re-run focused ledger, entitlement, audit, RBAC and Admin tests.

### Task 3: Admin API surface and control-center UI

**Files:**
- Create: `app/api/admin/overview/route.ts`
- Create: `app/api/admin/users/[id]/readings/route.ts`
- Modify: `app/api/admin/users/route.ts`
- Modify: `app/api/admin/users/[id]/route.ts`
- Modify: `app/api/admin/orders/route.ts`
- Modify: `app/admin/admin-console.tsx`
- Test: `tests/admin-functional-ui.test.ts`
- Test: `tests/admin-route-contract.test.ts`

**Interfaces:**
- `GET /api/admin/overview` exposes Dashboard counts after `requirePermission`.
- `GET /api/admin/users?q=&limit=` supports search/list.
- `GET /api/admin/users/:id` exposes the Admin member detail projection.
- `GET /api/admin/users/:id/readings` exposes authorized reading metadata only.
- `GET /api/admin/orders?member_id=&limit=` supports global and target-member order inspection with masked payment references.
- The existing mutation endpoints retain their public paths and strict reason/idempotency contract.

- [x] Add failing source/route contract tests for every Admin area, server boundary, masked fields and forbidden sensitive field names.
- [x] Implement the new route handlers and adapt existing routes to the read-model/action layer.
- [x] Replace the thin console with usable Dashboard, searchable Users, selected-user detail, Credits/VIP controls, Orders/Payments, Affiliate, Readings and Audit sections while preserving existing NaTarot shell classes and no commercial UI changes.
- [x] Run focused Admin UI/route tests and TypeScript.

### Task 4: Verification and handoff

**Files:**
- Modify: `docs/PROJECT_STATE.md`

- [x] Run focused Admin, RBAC, owner-scoping, ledger and audit tests.
- [x] Run `npx tsc --noEmit`, `npm run build`, targeted ESLint for changed TypeScript/TSX files, `git diff --check`, and the full `npx tsx --test tests/*.test.ts` suite.
- [x] Inspect the staged diff for secrets and confirm no commercial/deployment files are included.
- [x] Commit related source/tests/state changes, push `codex/natarot-admin-control-center-v1`, and report the exact branch, commit, test evidence, conflict risk and no-deploy status.
