# NaTarot Feature Freeze V3

Date: 2026-09-22
Branch: `codex/natarot-integration-v3`
Scope: verified integration and staging certification only

## Frozen product semantics

The following zones are protected from unreviewed semantic changes:

- F-001 trusted identity, member sessions, Google/auth recovery and guest boundaries.
- Tarot cards, spreads, Auto Topic/Auto Spread, room state, AI prompt/schema/provider contracts and Knowledge Base V5.
- Reading persistence, follow-up, clarification draw, journal/history and opaque Share S1–S6 behavior.
- Credits ledger, reservations, FIFO allocation, VIP expiry, orders and fulfillment.
- SePay Sandbox checkout, signed return/IPN verification, reconciliation, duplicate protection and at-most-once fulfillment.
- Affiliate attribution, verified-fulfillment conversion, commission snapshots/reversals and append-only Audit.
- Admin/RBAC server-side authorization, owner scoping, IDOR protections, CSRF/origin checks and private-reading defaults.

## Allowed changes during freeze

Only functional blockers are in scope: broken navigation, data/rendering defects, accessibility blockers, mobile overflow that prevents use, safe error/loading/empty-state defects, and security or economic-integrity regressions. Preserve the NaTarot/Moonlight navy, antique-gold, ivory and celestial visual language.

Any change touching a frozen zone requires a focused failing regression test first, a semantic review against the relevant contract, and re-running the affected cross-domain suite. UI polish, copy changes, new payment providers, production credentials, schema rewrites, or migration renames are out of scope for this freeze.

## V3 integration record

The branch is based on Backend Completion V1 `8409c8d`. Only the verified SePay implementation/fix commits were ported: `d6c204a`, `4443a04`, `3924326`, `44a9eb6`, and `594e569`. Conflicts in `db/schema.ts`, `lib/runtime.ts`, and migration tests were resolved by preserving the newer Backend Completion account/Affiliate/Audit/RBAC semantics and adding the SePay payment boundary. Both historical `0007_*.sql` filenames remain because the migration runner keys by full filename.

## Validation gate

Local V3 validation passed: tracked tests `524/524`, TypeScript, production build, dependency audit (`0` production vulnerabilities), diff checks, and targeted ESLint for changed TypeScript/TSX files (excluding the inherited `app/vintarot.tsx` rule debt). Repository-wide lint remains an inherited baseline failure and is not a freeze waiver for new files.

Staging-only validation passed for health, auth, account summary, package discovery, SePay checkout creation, idempotent replay and reconciliation. The existing staging database retained one verified/fulfilled Sandbox payment, one 10-credit grant and one active VIP entitlement after migration and restart. Production was read-only throughout.

## Human gates still open

- Production payment/AI/email/OAuth activation remains unapproved and unperformed.
- Live DeepSeek reading and full provider-backed SePay checkout/IPN remain explicit external gates.
- Share create/public/image/QR/event/revoke is now verified end-to-end on staging. Affiliate attribution is verified with a disposable staging policy fixture; verified-fulfillment conversion/reversal and staff-role mutation paths remain operator gates.
- Fresh 375px, 390px and 1440px browser viewport checks found no horizontal overflow across the key routes; a full human visual sweep of the room's completed 10-card reading state remains an operator handoff item.

## Closure update — 2026-09-22

- Fixed and deployed staging-only Share analytics origin handling in `b1bf0f6`: when Nginx forwards protocol and Host separately, the event route now falls back to the trusted `Host` header. Targeted regression coverage is included.
- Live Share matrix: create `201`; public page/image/QR `200`; duplicate events `202/202` with one durable event row; foreign revoke `204` without disclosure; owner revoke `204`; revoked image `404`; revoked HTML renders the intended not-found state.
- No production service, database, credential or real-money path was changed.
