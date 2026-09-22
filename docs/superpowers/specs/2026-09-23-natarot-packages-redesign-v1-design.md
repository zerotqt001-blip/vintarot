# NaTarot Packages Redesign V1 — Design Specification

## Source of truth

The owner-approved Image 1 and the pasted production brief define the visual direction. Image 2 is the incumbent page and is anti-reference material. Product truth remains server-authoritative and comes from `/api/packages`, `/api/account/summary`, and the existing checkout/payment boundaries.

## Surface and mode

This is a bounded Persuade/Operate surface: help a visitor choose a Credit package while keeping the actual catalog, balance, checkout, fulfillment, expiration, and payment security owned by the server.

## Visual direction

- Midnight navy NaTarot/Moonlight observatory with the existing `celestial-observatory.png` artwork, vignette, candlelight, champagne gold, and warm ivory.
- A `/packages`-scoped shared-shell variant reuses the existing NaTarot Logo, LanguageSelect, icons, typography, focus states, and routes while presenting the approved four-link header and five-item sidebar.
- Hero hierarchy: celestial phase motif, “GÓI THÀNH VIÊN · NATAROT”, “Chọn hành trình phù hợp với bạn.”, concise supporting copy, and an authenticated balance widget that never fabricates a guest balance.
- Four presentation cards in display order 1 → 5 → 10 → 20 Credits. Card prices, currency, quantity, and validity are rendered from the API response; presentation descriptors and the Popular treatment are not price authority.
- The 10-Credit card receives the restrained champagne emphasis when its canonical name/quantity marks it as Popular. No neon, fake discount, VIP price, or technical “not included” row.
- The lower journey section explains one Credit in three steps. VIP is a truthful coming-soon state without purchase controls. Affiliate remains a link to `/affiliate`. The trust strip says Credits are added after successful verified payment fulfillment.

## Functional contracts

- Package CTA navigates to the existing `/checkout?package=<package-version-id>` route.
- Checkout continues to submit only `package_version_id`, `idempotency_key`, and the existing payment method to `/api/commercial/checkout`.
- Credit balance uses the authenticated account summary; guests see a sign-in path rather than a mock “0 Credits”.
- Validity is derived from the package’s `benefitSnapshot.credits.expiresInSeconds`; no second frontend expiration calculation or backend semantic change is introduced.
- Loading, API failure, empty catalog, authenticated status, English, Vietnamese, keyboard focus, reduced motion, and narrow-width overflow remain supported.

## Out of scope

No database migration, package catalog mutation, SePay/IPN change, fulfillment/ledger/expiration change, Affiliate accounting change, Auth change, Account redesign, or redesign of any other route.
