# NaTarot Admin Control Center V1 Integration Design

## Mission

Layer the completed Admin Control Center V1 from `d9e2a6e` onto the authoritative production application commit `9216d4597bc0b4faa9d0cbf0bf60f65c27b0308f`, preserving the existing commercial Product Activation behavior and releasing only after local and fresh production verification.

The integration branch is created from the production commit. The Admin worker's separate uncommitted worktree changes are not an input; only the named commit is authoritative.

## Chosen approach

Use a production-base-first integration, then repair the shared Credits boundary semantically rather than accepting either side mechanically.

1. Create `codex/natarot-admin-control-center-integration` from the production commit.
2. Add the integration regression contract before implementation changes. It asserts that Admin-style positive and negative adjustments remain commercial-ledger operations, are replay-safe, write exactly one audit event, and can rebuild their projections.
3. Merge the exact Admin commit `d9e2a6e` without importing uncommitted worker edits.
4. Keep the Admin read models, routes, UI, RBAC matrix, masked PII, order metadata, affiliate projections and readings metadata from that commit.
5. Extend the canonical Credits repository only at its shared audit boundary. Commercial grants, refunds, reservations, FIFO/expiration, consume/release/refund, owner scoping and replay/rebuild behavior remain the existing implementation. Admin adjustments add an optional audited mutation payload that is inserted in the same D1 batch as the corresponding ledger mutation. A failed required audit insert aborts the batch; a replay returns the original idempotent result without adding another financial or audit row.
6. Make Admin command replay checks validate the original units, reason and owner-scoped ledger result before returning a replay. A supplied owner object is never accepted from the client; the member id is resolved server-side.
7. Preserve VIP as an entitlement, not an authorization role. Preserve the production order/SePay architecture and expose only masked provider-neutral metadata in Admin.

## Data and security boundaries

- Every Admin API continues through the authenticated member-session boundary and server-side permission matrix.
- `USER` and ordinary non-privileged roles cannot read or mutate Admin data; only the documented role permissions can access each projection.
- User detail exposes masked PII, bounded Credits/VIP/order/affiliate summaries and reading metadata, never passwords, OAuth material, session tokens, raw payment references, raw Tarot questions/payloads or share tokens.
- Credit and VIP mutations require bounded reasons and idempotency keys and are delegated to the canonical Credits/entitlement services. No route or UI writes a balance directly and no order is marked paid by the frontend.
- The existing owner QA member remains the only owner QA account. No account or password is created, reset or printed by this integration.

## Verification and release flow

The local gate runs focused Admin/RBAC/Credits/replay/VIP/orders/affiliate/readings/audit/owner tests, the full repository suite, TypeScript, build, targeted changed-file lint, dependency audit and `git diff --check`. Responsive Admin source contracts cover desktop and 390px functional layout hooks.

Before deployment, use the existing authorized VPS access to create a fresh production database/release backup, verify its checksum, run a restore verification, record the active release and retain a rollback release. A backup or restore failure blocks deployment.

After the integration commit is verified and pushed, deploy the exact integrated artifact to the production service. Use a fresh browser context at `https://natarot.com` to verify the existing Home, Account, package/checkout/order, Credits, VIP, Affiliate, Tarot, DeepSeek, Auto Topic, Manual Topic, history and Share/QR flows, then verify Admin dashboard, users, owner QA inspection, audited reversible Credit adjustment/replay, VIP, orders/payments, affiliate, readings, audit and RBAC denial. External `SEPAY_PRODUCTION_CREDENTIAL_GATE` and `RESEND_EXTERNAL_GATE` remain explicit gates and are not bypassed.

## Non-goals

- No global UI redesign or Moonlight/NaTarot visual-system replacement.
- No new VIP pricing or payment shortcut.
- No copying of staging SePay credentials or production secrets into the repository or Admin UI.
- No creation of another owner account.
- No unrelated cleanup of the existing repository lint baseline.
