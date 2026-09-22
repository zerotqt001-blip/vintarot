# NaTarot Member + Packages + Affiliate Functional UI V1

## Decision summary

This milestone exposes the already-deployed member, package, Credits/VIP, order,
and Affiliate backend through a temporary customer-facing UI. It continues from
the independently verified production line `fc0a9c1fd7ebd2aaa2c0e5dad8bd33ce96bd01a4`
on `origin/codex/natarot-production-full-feature-v1`; the dedicated work branch is
`codex/natarot-member-affiliate-ui-v1`.

The canonical customer routes remain:

- `/packages`: public package and member overview.
- `/checkout?package=<active-package-version-id>`: authenticated server-priced checkout.
- `/affiliate`: public Affiliate explanation and authenticated owner dashboard.
- `/account`: owner-scoped account, Credits/VIP summary, and metadata-first history.

No `/membership` or `/affiliate/dashboard` duplicate route is introduced. Existing
Profile Credits/VIP status remains intentionally minimal and does not become an
Affiliate or payment dashboard.

## Capability map and source of truth

| Capability | Current route/API | Auth and authority | UI treatment |
|---|---|---|---|
| Active package catalog | `GET /api/packages` | Public; `listActivePackageVersions` filters active time-windowed versions | Render returned names, server amount/currency, Credits, VIP snapshot, and safe benefits only. Empty catalog is a normal state. |
| Member balance | `GET /api/billing/balance` and `GET /api/account/summary` | Session-derived member owner; no-store | Account/membership cards render available, reserved, and total units from the response. |
| VIP/entitlements | `GET /api/billing/entitlements` and `GET /api/account/summary` | Session-derived member owner; no-store | Show active entitlement type, benefit version, and expiration. Never infer VIP from a client flag. |
| Account history | `GET /api/account/history?kind=...` | Session-derived member owner; cursor and metadata allowlist | Keep readings, shares, orders, Credits, and Affiliate links discoverable without private payloads. |
| Pending order | `POST /api/orders` | Member owner, origin check, server catalog price, idempotency | Keep order creation and ownership contract tests; checkout submits only package ID and idempotency key. |
| Commercial checkout | `POST /api/commercial/checkout`, display-only return | Member owner, origin check, SePay configuration and verified reconciliation boundary | Show provider form only when returned; otherwise use localized unavailable/sandbox state. Never show fake success. |
| Affiliate public policy | New `GET /api/affiliate/policy` | Public; active policy only | Expose only attribution/hold/currency/tier fields from the active policy. When none is active, show policy-unavailable copy and no percentages. |
| Affiliate dashboard | New `GET /api/affiliate/dashboard` | Session-derived member owner; no-store | Return owner-scoped status, current active policy/tier progress, existing summary, and existing history. Do not return profile IDs, code hashes, raw referral codes, payout controls, or foreign data. |
| Referral attribution | Existing `POST /api/affiliate/attribute` | Authenticated owner, origin check, first-touch/self-referral checks | Continue URL capture. Because the current backend stores only a hash and has no customer code-recovery/generation flow, show a truthful referral-link-unavailable state instead of inventing a link. |
| Affiliate conversion/commission | Existing fulfillment boundary and service | Verified fulfilled order, immutable policy/tier/package snapshots | Render stored commission/history metadata. Do not recalculate historical amounts from the current policy. |
| Payout | No customer payout service or route | Not implemented | Omit money-moving controls and show localized “not yet available” status where useful. |

## Read-only Affiliate projection

`lib/affiliate/customer.ts` is a presentation read model, not a new accounting
service. It uses the existing `getActiveAffiliatePolicy`, `selectAffiliateTier`,
`utcMonthBounds`, `getAffiliateSummary`, and `listAffiliateHistory` functions.

The public policy projection contains only:

- policy version, currency, attribution window, and hold period;
- tier code, minimum qualified conversions, and rate basis points.

The member dashboard projection contains:

- profile status or `null` when no profile exists;
- the public active policy or `null`;
- current UTC-month qualified conversion count, current tier, and next tier;
- existing owner-scoped summary and history;
- a typed referral-link availability state with no raw code.

Tier progress is calculated from the current policy and current-month non-reversed
conversions only. Historical rows continue to display stored `commissionMinor` and
stored status. The projection never joins by a client-supplied member ID.

## UI behavior

### Membership/packages

The package page has a short NaTarot membership introduction, a logged-in status
panel when available, a dynamic package grid, a compact comparison derived only
from Credits/VIP/benefit snapshot fields, and links to account, Affiliate, and the
existing checkout. Logged-out users can browse the same public catalog and are sent
to `/auth?return_to=/checkout?package=...` when they choose a member action.

The checkout page preserves the current server-priced `POST /api/commercial/checkout`
request, idempotency-key rotation on package change, ownership response, and
provider form. The client never sends `amount_minor`, `currency`, commission, or
benefit authority. Any discount/unit-price display is derived from returned catalog
values only; no baseline means no savings badge.

### Affiliate

The public page explains the real flow:

`Join → share when a supported link exists → valid member activity → verified fulfilled order → held commission → eligible/reversed ledger state`.

It does not promise commission for clicks, registrations, or unverified orders.
The logged-in view shows supported summary/history, profile/policy/tier state, and
the truthful link/payout unavailable states. It has no withdrawal or manual
commission action.

### Account and navigation

`/account` remains the metadata-first owner surface, but now makes Credits/VIP
balances, expiration, counts, package checkout, Affiliate, reading history, order
history, and share history easier to reach. The shared shell adds labeled
Membership, Affiliate, and Account destinations while preserving Home, Room,
Tarot/Guidebook, Auth, and Share paths. Mobile navigation remains the existing
full-width bottom bar; commerce links are compact and do not create a second
competing navigation system.

## i18n, accessibility, and responsive behavior

All new customer copy, status labels, errors, empty states, and actions are added to
the existing EN/VI message tree and rendered through `useLanguage().t`. Server
errors are mapped to safe localized fallback copy; raw JSON and stack traces never
reach the UI. Interactive controls have labels/focus states and live status regions.

The existing dark celestial NaTarot/Moonlight shell remains the visual authority.
New functional cards use restrained navy, violet, champagne/gold, and selective
glass surfaces. They avoid neon/casino/crypto/generic SaaS treatment. Grids stack
at narrow widths, history rows become readable cards, and no page intentionally
overflows at 375, 390, 412, tablet, or desktop widths.

## Security and compatibility constraints

- No database migration, provider activation, real-money movement, secret change,
  DeepSeek change, Auth/F-001 change, RBAC change, Audit change, or accounting change.
- Existing owner-scoping, CSRF/origin, idempotency, server pricing, payment
  verification, self-referral, replay, PII, and Share privacy tests remain required.
- New APIs are no-store and fail closed on unauthenticated access.
- Production package catalog may be empty, SePay may be unavailable, Affiliate
  policy may be unpublished, and Resend/Google external gates do not block this UI.

## Verification and release gates

Before deployment: focused red/green UI/read-model tests, full tracked suite,
TypeScript, production build, targeted lint, `git diff --check`, secret scan, and
production dependency audit. The deployment gate requires a fresh production
backup with integrity/checksum/restore readability verification, then the existing
atomic/reversible release procedure with no unnecessary migration. Production
smoke and browser QA cover public, authenticated where owner access exists, and
390px/desktop surfaces without real payment.
