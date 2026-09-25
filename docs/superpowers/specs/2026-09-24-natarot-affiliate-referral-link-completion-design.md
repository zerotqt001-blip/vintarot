# NaTarot Affiliate Referral Link Completion

## Goal

Complete the missing referral-link capability on top of the existing Affiliate backend. Every already-eligible Affiliate profile (existing `affiliate_profiles.status = ACTIVE` plus an active server policy) receives one stable opaque public code, a canonical `/affiliate?ref=...` link, and a QR representation without changing attribution, policy, payment verification, commission, ledger, or idempotency rules.

## Audit findings

- `drizzle/0007_backend_completion.sql` and `db/schema.ts` already contain Affiliate profiles, one-way referral-code hashes, owner-bound attributions, versioned policy/tiers, conversions, and an append-only commission ledger.
- `lib/affiliate/service.ts` already captures authenticated attribution, rejects inactive/self referral, requires a stored `FULFILLED` order/fulfillment match before conversion creation, and supports hold/eligibility/reversal with idempotency.
- `lib/affiliate/customer.ts` already exposes an owner-scoped dashboard, but intentionally returns `referralLink.available = false` because the stored hash cannot recover a displayable code.
- `app/api/affiliate/dashboard/route.ts` is the existing authenticated no-store dashboard API. No new public read endpoint is needed.
- `components/affiliate/affiliate-dashboard.tsx` already contains the “LIÊN KẾT GIỚI THIỆU” panel and clipboard behavior; it lacks code, share, download, and usable QR states.
- `components/affiliate/referral-capture.tsx` only submits attribution for authenticated members. Anonymous cookie attribution is explicitly excluded from this change.
- The `qrcode` dependency and `NATAROT_PUBLIC_ORIGIN` resolver already exist and will be reused.

## Data design

Add forward-only migration `0009_affiliate_referral_links.sql` after the existing `0008_credit_fulfillment_timestamp.sql` migration. Add nullable `referral_codes.public_code`, a unique partial index for non-null public codes, and a unique partial index for the generated dashboard code per profile. Existing `code_hash`, attribution, conversion, and ledger rows are not updated, deleted, or rehashed. Existing legacy hash-only codes remain valid for attribution; only the new canonical dashboard code is displayed.

Generated codes are opaque, random WebCrypto values with no member id, username, email, phone, or other personal data. The public token is intentionally shareable and is returned only through the authenticated owner-scoped dashboard projection. Attribution continues to hash the submitted code before lookup.

## API and link design

Extend the existing `GET /api/affiliate/dashboard` response:

```ts
type AffiliateReferralLink =
  | { available: false; reason: "not_eligible" | "policy_inactive" | "profile_inactive" }
  | { available: true; code: string; url: string; qrUrl: string; downloadName: string };
```

The service lazily ensures the canonical code only when the member has an active Affiliate profile and an active policy. The absolute URL is built with the existing validated `resolvePublicOrigin()` value and `/affiliate?ref=<encoded-code>`. QR is generated with the existing `qrcode` package as an SVG data URL for display/download. The route remains `no-store`, requires the current authenticated member owner, and does not expose hashes, profile ids, or another member’s link.

If no active policy exists, the dashboard returns an explicit unavailable state and does not generate a code or link. No policy row is activated or changed by this feature.

## Frontend design

Keep the existing Affiliate panel and styling vocabulary. Add:

- an opaque referral-code read-only field;
- a canonical link read-only field with copy feedback;
- QR preview with accessible alt text;
- QR download using the API-provided data URL and filename;
- Web Share API action with copy fallback;
- localized loading, error, unavailable, copied, shared, and download labels.

No other route or shell UI is redesigned.

## Safety and verification

The existing attribution and commission services remain unchanged except for shared response types. Tests must prove migration compatibility and preservation of legacy hashes/attributions/commission rows, stable code across repeated dashboard reads, random uniqueness, inactive-policy behavior, owner isolation, exact link/QR payload, authenticated attribution behavior, self-referral rejection, and no commission from pending/failed/unfulfilled/redirect-only events.

Deployment uses the existing backup/restore and atomic release manager. Before any production mutation, verify the live Affiliate table counts/hashes/attributions/conversions/ledger and run the new migration against a restored copy. Keep current plus two rollback releases; do not delete databases, credentials, or active/rollback releases.

## Non-goals

- No anonymous referral cookie, last-click rule, attribution-window change, policy activation, payout flow, or commission formula change.
- No automatic Affiliate enrollment for ordinary registrations.
- No destructive data cleanup or rewrite of existing referral hashes, attributions, conversions, or ledger history.
