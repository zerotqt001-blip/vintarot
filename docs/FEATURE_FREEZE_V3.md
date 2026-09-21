# NaTarot Feature Freeze V3

Date: 2026-09-22
Branch: `codex/natarot-full-feature-staging`
Scope: verified integration and staging certification only; no production release

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

The branch starts from the newest safe local Integration V3 head `b1bf0f6` (the descendant of remote `d0f4cfb` that includes the verified proxied-origin Share fix). The functional staging surfaces are in `158379d`; the review correction is `672de4a` and rotates checkout idempotency keys when package selection changes while preserving the selected package through auth return paths. Both historical `0007_*.sql` filenames remain because the migration runner keys by full filename. No frozen Tarot, AI, Share, payment, Affiliate, RBAC or schema semantics were changed.

## Validation gate

Local full-feature validation passed: tracked tests `527/527`, TypeScript, production build, dependency audit (`0` production vulnerabilities), diff checks, and targeted ESLint for changed TypeScript/TSX files. The independent read-only review found no Critical or High issues; its two Medium checkout findings were fixed and retested. Repository-wide lint remains an inherited baseline failure and is not a freeze waiver for new files.

Staging-only validation passed for HTTPS isolation, health, auth/session, account summary/history, package discovery, guest catalog/draw/session, safe no-provider reading failure, server-priced SePay checkout creation, display-only return, provider reconciliation, F-001 header rejection, and exact CSS 375/390 mobile layout checks for `/packages`, `/checkout` and `/affiliate`. The database passed integrity and foreign-key checks and contains the expected 78-card/312-meaning/57-template catalog plus synthetic commercial rows. A final staging-only restart followed by readiness polling returned health `200`; the brief pre-readiness proxy `502` window is an operational warm-up characteristic. Production apex/www stayed HTTP 200 and `natarot.service` remained active; no production state was changed. The complete sandbox payment/IPN/fulfillment UI loop remains an external provider gate.

## Human gates still open

- Production payment/AI/email/OAuth activation remains unapproved and unperformed.
- Staging has SePay Sandbox configuration only. No DeepSeek, Google OAuth or Resend runtime keys are present, so live AI generation, OAuth, email verification and password-reset delivery cannot be claimed. The guest Tarot path correctly fails closed with a safe `503` until a provider is configured.
- The complete Share create/public/image/QR/event/revoke loop requires a completed provider-backed reading in the current staging run; S1–S6 ownership/privacy behavior remains covered by the automated suite and invalid-token public probes.
- Affiliate conversion/reversal mutations and the full Admin role-mutation matrix require dedicated synthetic member roles/fixtures; owner-scoped Affiliate read metadata and all server-side RBAC/security tests pass.
- The new commerce routes were browser-verified at exact CSS widths 375px and 390px with no overflow. A physical-device capture and broader existing Room/home visual pass remain operator follow-up, not a blocker for these functional routes.
