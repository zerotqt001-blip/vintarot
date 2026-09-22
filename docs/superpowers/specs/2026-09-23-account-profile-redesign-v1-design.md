# NaTarot Account/Profile Redesign V1 — Design Specification

## Status

Approved for implementation from the owner brief and the supplied visual references. Image 1 is the target composition and Image 2 is the current functional surface to replace. This specification treats the pasted brief as the operative product request; the screenshots are visual evidence, not data or route contracts.

## Product intent

Turn `/account` into a private member home: a quiet, celestial NaTarot space where a member can understand their current Credits, membership, saved readings, affiliate activity, transactions, and account/security destinations at a glance.

The visual world follows the approved Moonlight/NaTarot reference: deep observatory navy, champagne gold, warm ivory typography, restrained borders, and an atmospheric celestial background. The page must feel authored and spacious without changing product semantics or inventing account capabilities.

## Truth and ownership boundaries

- The page reads `GET /api/account/summary` for the member record, canonical Credit balance/history, active entitlements, counts, and affiliate policy-derived summary.
- The page reads `GET /api/account/history?kind=orders` for member-owned order history and the existing account-history endpoint for any additional activity needed by the transaction surface.
- The page reads `GET /api/tarot/saved-readings` for recent saved readings. That endpoint already enforces authenticated owner scope and returns only metadata plus card summaries.
- `member.createdAt` is the sole source for “member since.” Display name falls back to username; no sample avatar, email, phone, or date is fabricated.
- Active membership is derived from active entitlement rows. Customer-facing copy may say “VIP” and show its active/end state, but must not expose entitlement IDs or internal benefit-version IDs.
- Affiliate “Lượt chuyển đổi” is the policy-backed `affiliate.conversions` metric. The UI must not relabel it as raw clicks, leads, or guaranteed referrals.
- Order rows may expose only a safe projection of the immutable historical package snapshot: localized package name, version, Credit quantity, VIP duration, amount, currency, order status, date, and payment reference when available. No request fingerprints, private snapshots, provider payloads, or fulfillment internals are returned.
- Credit expiration remains governed by the existing Credit lots/ledger. The redesign does not calculate or invent an expiry date from the aggregate balance. Credit actions link to the existing packages/profile surfaces.
- Unauthenticated members see the existing sign-in recovery state. Admin/RBAC controls are not rendered on the member account page.

## Information architecture

The account shell has two navigation levels, matching Image 1 while remaining truthful to existing routes.

1. Top header: NaTarot logo/tagline; `Trang chủ`, `Lá bài`, `Luyện tập`, `Đặt Phiên Đọc`; search/favorites shortcuts to existing guidebook/saved-reading surfaces; language selector; local theme toggle; active `Tài khoản` link.
2. Left rail: `Trang chủ` (`/`), `Rút Bài Ngay` (`/room`), `Gói Thành Viên` (`/packages`), `Affiliate` (`/affiliate`), and active `Tài Khoản` (`/account`). The old personal-navigation list and `+ Phòng` CTA are not part of this shell.
3. Hero: “Tài khoản của bạn,” member-space supporting copy, profile identity card, member-since date, VIP state, and `/profile` edit link. Avatar is a deterministic moon/initial treatment because the current member model has no avatar contract.
4. Summary band: Credit balance with `/packages` CTA, active membership with `/packages` benefits link, saved-reading count with `/journal?tab=saved`, and policy-backed affiliate conversion count with `/affiliate` link.
5. Main content: recent saved readings (real questions, spread/card metadata, dates, and saved-reading CTA); quick access to real routes; recent transactions from canonical order metadata; account/security links to existing profile/logout/privacy surfaces.
6. Footer: NaTarot lockup, tagline, guide/privacy/terms links, and no fabricated social destinations or ticker copy.

## Interaction model

- Summary and content sections have loading, recoverable error, and empty states; empty states explain what can be done next.
- Theme toggling is local to the account shell and does not alter stored account data. It must respect `prefers-reduced-motion` and retain readable contrast.
- Language uses the existing `LanguageProvider` and `LanguageSelect`; all new account copy is added to both English and Vietnamese message trees.
- Logout uses the existing canonical `POST /api/auth/logout` handler, then redirects to `/`. No client-side cookie mutation or alternate logout route is introduced.
- Every CTA is an existing route or an in-page anchor. No payment is initiated by the account dashboard.
- Transaction rows remain on `/account#transactions`; Credit/package actions use `/packages`, profile actions use `/profile`, and saved-reading rows use `/journal?tab=saved` because the existing journal owns the detail dialog.

## Responsive composition

- 1440px and 1280px: fixed compact rail, atmospheric hero, four-column summary, two-column content grid.
- 1024px: reduced rail/content gap, summary may become two columns, recent readings and quick access remain distinct sections.
- 768px: rail collapses to a compact horizontal/mobile navigation treatment; hero/profile stack; content becomes one column.
- 412px, 390px, and 375px: no horizontal overflow; one-column summary; profile actions stack; transaction rows become readable cards with label/value pairs; long questions and order references wrap safely.
- Touch targets remain at least 44px, focus states remain visible, and icons never carry meaning without a text label or accessible name.

## Visual system

- Use existing NaTarot font assets and logo assets. Use `public/room/celestial-observatory.png` as the supplied atmospheric source with a dark overlay; do not add decorative fake data or a new image-generation dependency.
- Use one border/elevation treatment per surface, generous section spacing, a restrained gold accent, and warm ivory/secondary text tuned for contrast.
- Use existing `lucide-react` icons with consistent stroke weight. Do not use emoji or Unicode glyphs as UI icons.
- Keep the approved Moonlight reference and NaTarot identity intact; account-specific CSS is scoped under `.account-shell` and must not regress Home, Practice, Room, Daily, Guidebook, or checkout shells.

## Accessibility and operational checks

- Semantic headings, landmark labels, focus-visible styles, keyboard-operable controls, status announcements for async loads, and meaningful alt text for card art.
- Verify at desktop and mobile with real route rendering, including authenticated owner fixture data locally and unauthenticated behavior.
- Capture bounded visual QA screenshots at desktop and mobile, inspect for overflow/contrast/focus/state regressions, and record any environment limitation.
- Keep the current owner QA account and production database untouched. Deployment is attempted only after local verification and only with existing deployment authority; if SSH/production access remains unavailable, report the exact blocker instead of claiming deployment.

## Non-goals

- No changes to authentication, session cookies, Credits allocation/expiration, VIP grants, payment verification, SePay/IPN, affiliate policy, Tarot ownership, or admin permissions.
- No new security feature claims such as 2FA, device management, password rotation, or session revocation controls unless an existing route already provides them.
- No real payment or order creation from `/account`.
- No changes to the QA account or production data.
