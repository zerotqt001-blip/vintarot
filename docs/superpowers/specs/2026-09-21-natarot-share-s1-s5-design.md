# NaTarot S1–S5 Share System Design

**Date:** 2026-09-21
**Base:** `origin/codex/natarot-level4-spreadboard-l1c` at `a53dc44d5c088f2e9685e31f3e4a9dc51a09ebea`
**Status:** implementation design for the independent Share foundation; public persistence remains migration-gated

## Scope and guardrails

This design adds the safely independent part of the NaTarot share loop:

```text
completed private reading
  → explicit Share action
  → public share identity contract
  → allowlisted public projection
  → deterministic SVG share image
  → QR pointing to /r/{opaque-token}
  → privacy-conscious analytics contract
```

The work does not change Auth, F-001 identity semantics, guest-cookie semantics, Tarot Engine, Knowledge Base V5, AI prompts/providers, spread semantics, L5–L8, Credits/VIP, payment, SePay, Affiliate, deployment, or production configuration. No database migration is created or applied.

The existing NaTarot/Moonlight-inspired midnight navy, antique gold, ivory, Instrument Serif and Work Sans system remains the visual authority. The public page is an extension of that world, not a global redesign.

## Options considered

### A. Add a dedicated share table now

This is the correct production shape, but the mission explicitly forbids creating or applying a migration. It is documented as the future integration target only.

### B. Reuse `records` as a public-token table

This would make a demo look persisted, but it would weaken indexing, ownership, status transitions, retention and operational review. It would also contradict the existing architecture research recommendation to keep public-share identity separate from generic product records. Rejected.

### C. Implement contracts, pure logic, renderer, QR, public shell and injected adapters

This is the selected path. Production routes use an explicit `ShareStore` boundary and fail closed with a safe “share links are not configured” response until a human-authorized migration and adapter are available. Unit tests use an in-memory test store only; no fixture bypass is reachable from production code.

## Domain boundaries

```text
PrivateReading
  → ShareService (owner verification + lifecycle)
  → PublicShareRecord (opaque token hash + reading reference)
  → PublicReadingView (explicit allowlist)
  → ShareImageViewModel (renderer-safe projection)
  → ShareImageRenderer (SVG adapter)
  → ShareAnalyticsEvent (minimal event sink)
```

The public token is never an owner ID, reading ID, session ID or database row ID. The renderer receives only the sanitized public view model, never a database row, Room state, provider output, or private notes.

## S1 — Public Reading Identity

### Token

- Generate 32 cryptographically secure random bytes and encode them base64url without padding.
- Require exactly 43 URL-safe characters for the current token version.
- Store only a SHA-256 token digest in the future persistence layer.
- Resolve by hashing the presented token; reject malformed, unknown, revoked and expired tokens through the same non-enumerating public outcome.
- Keep the token version in the record contract so future rotation can invalidate the old token and issue a new one.

### Lifecycle

The contract uses `active`, `revoked` and `expired`. Expiration is optional and is `null` for the first implementation. A revoked/expired share is never returned to a public viewer. Rotation is a future owner operation behind the same store interface; it is not exposed until persistence can invalidate the old token atomically.

### Ownership

Create, revoke and rotate require the existing trusted `ReadingOwner` plus an exact session/reading ownership check. Guest shares are supported by the interface because the existing repository can owner-check guest sessions; no guest cookie or guest ID is exposed publicly. Public resolution uses the stored owner reference only to load the canonical reading through the owner-scoped repository boundary.

### Persistence gate

`ShareStore` is the integration seam. The implementation includes an unavailable runtime adapter rather than a fake in-memory production store. The required future storage is documented below and no migration file is added in this mission.

## S2 — Public Reading Page

### Route and response policy

- Public page: `GET /r/{opaque-token}`.
- Public image: `GET /r/{opaque-token}/image.svg`.
- Owner API: `POST /api/tarot/shares` and future owner-scoped revoke/rotate operations under the same route family.
- Analytics API: `POST /api/tarot/shares/{token}/events` with a strict event schema; raw tokens are hashed before persistence or logging.
- Invalid, malformed, revoked and expired public tokens produce the same not-found/unavailable response and never reveal whether a private reading exists.
- Public HTML sends `X-Robots-Tag: noindex, nofollow`, `Referrer-Policy: no-referrer`, and conservative cache headers because the source is revocable private-derived content.
- Metadata uses a generic NaTarot title/description and a canonical share-image URL; the private question is not copied into SEO metadata.

### Public view-model allowlist

The projection contains only:

- stored reading locale;
- bounded question text, because the user explicitly chose to share the reading;
- localized spread name and spread type;
- ordered cards: approved local image path, bilingual card name, orientation, public position label/order;
- direct answer, personal insights, next steps, optional deeper reading, optional reflection prompts and card evidence text from the persisted reading;
- normalized geometry values derived from the existing spread contract;
- public URL and renderer/template version metadata needed by the image boundary.

It excludes:

- email, username, display name, member ID, guest ID and cookies;
- reading/session/reading-card IDs;
- private Room notes, drawings, annotations, collaboration members and context;
- provider, model, prompt version, Knowledge Base, raw AI response and diagnostics;
- arbitrary HTML/CSS/image URLs, payment data, affiliate data and unrelated history.

Historical v2/v3 rows continue through `parseStoredReading`; absent optional arrays become empty/omitted sections and malformed rows return a safe unavailable state rather than crashing the page.

### UI

The public client shell keeps the NaTarot visual vocabulary and provides:

- clear heading and shared-reading context;
- readable card names, position labels, orientation and alt text independent of artwork;
- a calm reading hierarchy with the primary answer first and supporting card evidence behind native disclosures;
- `Copy Link`, `Save Image`, and `Create your own Tarot reading`;
- English/Vietnamese interface labels through the existing language provider;
- keyboard focus, readable contrast, loading/error states, and responsive layouts at 390px, 375px and desktop widths.

The full private Room shell is not rendered on `/r/{token}`. Public content is not mixed with account navigation or private controls.

## S3 — Share Image

### Renderer boundary

The first production-independent renderer is a deterministic SVG adapter. Its interface accepts a sanitized `ShareImageViewModel` and returns `{ contentType: "image/svg+xml", bytes, width, height, rendererVersion }`. PNG conversion remains a future adapter; the core domain never depends on Satori, resvg or a browser screenshot.

The SVG canvas is 1200×800 with a stable NaTarot composition:

```text
brand lockup + shared question
        normalized card spread
short synthesis / key insight       QR + public URL context
```

It uses allowlisted `/cards/*.webp` artwork and existing brand assets, escaped XML text, bounded text wrapping/truncation and a high-contrast QR panel. No auth token, internal ID, guest cookie, provider data or private notes are rendered.

### Geometry

Use `resolveNormalizedSpreadGeometry` / `resolveTarotSpreadGeometry` from the L1B/L1C foundation, then project normalized coordinates into the image canvas. The renderer must handle:

- one card with a large focal treatment;
- three cards with readable position labels;
- common medium spreads through generic normalized fallback;
- Celtic Cross 10 with cross and side column kept inside the canvas;
- future 12-card input through deterministic generic grid fallback.

The renderer does not copy Room pixel constants or create a second semantic spread catalog.

### Regeneration and storage

SVG is generated on demand and deterministically from the public view, URL, geometry version and renderer version. No binary is written to local disk or Google Drive. A future object-storage adapter can cache versioned artifacts without changing the domain contract. Revocation blocks new page/image requests; downloaded files and third-party/social caches cannot be erased and are documented as such.

## S4 — QR

- QR payload is exactly the trusted public URL `https://natarot.com/r/{opaque-token}` in production, or the configured local/staging origin in other environments.
- Origin is selected from `NATAROT_PUBLIC_ORIGIN` or a fixed environment default; it is never built from the incoming `Host` header.
- QR generation uses the existing QR package API, SVG output, dark modules on an ivory background, error correction M, and a tested quiet zone.
- The image route embeds the QR SVG without adding a logo cutout or user-controlled colors.
- Tests assert URL equality, deterministic output, malformed-token rejection and image inclusion. A decoder is optional only if the package/runtime can support it without a disproportionate dependency.

## S5 — Analytics and acquisition

### Event contract

Allowed events:

```text
share_created
share_opened
share_image_generated
share_image_downloaded
share_cta_clicked
```

Each event has an opaque event ID, hashed share identity, event name, locale, bounded source label, timestamp and optional renderer version. The schema rejects email, IP, cookie, question, reading payload, provider fields, arbitrary properties and affiliate fields. Reusing an event ID is idempotent at the sink boundary.

### Acquisition seam

The public CTA can carry a bounded `source=share` context to a future visitor/session attribution boundary, but no affiliate cookie, commission, payment or referral ledger is created. Share attribution and Affiliate attribution remain separate types and separate future projects.

## Security and privacy

- 256-bit token entropy and hash-at-rest reduce enumeration and database-leak impact.
- Owner verification uses `ReadingOwner` and the canonical repository; client-supplied IDs never establish ownership.
- Public projection is an allowlist, not a serialized private model.
- React text/SVG XML escaping prevents user-content injection; arbitrary HTML/CSS/remote image URLs are rejected.
- No host-header-derived public URLs; no sensitive query parameters in analytics or image URLs.
- Public routes are noindex, no-referrer and conservatively cached.
- Operational failures log only operation, safe share hash prefix, error class and timestamp where the existing boundary permits; no reading content or secrets.
- A revoked share stops page and image resolution. Previously downloaded or platform-cached copies remain outside application control.
- Rate limiting is left behind an explicit isolated adapter because the current app has no public-share limiter; global Auth semantics remain untouched.

## Future database migration proposal (not created/applied)

### `reading_shares`

| Column | Type | Rules |
|---|---|---|
| `id` | text | primary key; opaque internal share record ID, not public token |
| `token_hash` | text | unique; SHA-256 digest of the 32-byte public token |
| `owner_kind` | text | `user` or `guest` |
| `owner_id` | text | trusted member/guest owner reference |
| `reading_id` | text | foreign key to `readings.id` |
| `session_id` | text | foreign key to `reading_sessions.id` |
| `status` | text | `active`, `revoked`, `expired` |
| `locale` | text | `en` or `vi` snapshot |
| `projection_version` | text | public view contract version |
| `geometry_version` | text | normalized geometry contract version |
| `renderer_version` | text | share image renderer version |
| `created_at` | integer | required timestamp |
| `updated_at` | integer | required timestamp |
| `revoked_at` | integer nullable | revocation timestamp |
| `expires_at` | integer nullable | optional expiry timestamp |

Constraints and indexes:

- `UNIQUE(token_hash)`;
- `INDEX(owner_kind, owner_id, updated_at)`;
- `INDEX(reading_id, status)`;
- foreign keys to the canonical session/reading rows with delete behavior selected during migration review;
- no raw token column.

### `share_events` (or an approved analytics sink)

| Column | Type | Rules |
|---|---|---|
| `id` | text | primary key; opaque event ID |
| `share_id` | text nullable | foreign key/reference to `reading_shares.id` |
| `event_name` | text | strict allowlist above |
| `locale` | text nullable | `en` or `vi` |
| `source` | text nullable | bounded allowlisted label |
| `renderer_version` | text nullable | bounded version string |
| `created_at` | integer | required timestamp |

Add `UNIQUE(id)` and an index on `(share_id, event_name, created_at)`. Do not store raw token, IP, cookie, email or reading payload. Retention/purge policy must be selected before production analytics is enabled.

### Rollback and existing-data impact

The migration is additive and leaves existing sessions/readings/records unchanged. Rollback must first disable share routes, then remove only newly created share rows/artifacts after export/retention review; it must not delete canonical readings. Existing readings remain private until an explicit share record is created. A later adapter can migrate no data because this mission creates no production share rows.

## L5–L8 integration seam

This branch consumes only the already verified L1A/L1B/L1C geometry APIs. It does not edit the active L5–L8 worktree or engine files. After L8, the integration check should confirm that `ResolvedTarotSpread`, `NormalizedSpreadPosition`, `TarotReadingPayload` compatibility and card asset paths remain source-compatible. If L8 changes any of those contracts, update only the share adapter/projection layer and rerun S3 tests; do not fork Tarot semantics in the renderer.

## Validation contract

Focused tests cover token/ownership/projection/error handling, geometry for 1/3/10/12 cards, deterministic SVG/QR output, VI/EN text, analytics allowlisting/idempotency and route response headers. The relevant existing suite, typecheck, build, targeted lint, diff check and secret scan remain required. Browser QA covers the public shell only when a real store/fixture can be injected without a production bypass; otherwise the migration-gated state is reported explicitly.

## External research loop and dependency decisions

This section records the mandatory external research pass completed after the repository audit and before mechanism implementation. The research was used to narrow the implementation, not to broaden scope.

### Current repository evidence

- The application is React 19 / Next 16.3.4 through Vinext, with a Cloudflare Workers-compatible path and a Node 22 SQLite path.
- L1A/L1B/L1C already provide the canonical Tarot spread and normalized geometry contracts; the share renderer must consume those contracts.
- Card artwork is local under `/public/cards/*.webp`, and the approved NaTarot typography/assets are local under `/public/fonts` and `/public/brand`.
- There is no public-share token, public reading projection, QR renderer, share-image renderer or share analytics sink in the selected base.
- The mission forbids a database migration, so a production adapter must fail closed until a later authorized migration exists.

### Official documentation reviewed

- Node.js `node:crypto` documents cryptographically strong `randomBytes` and `createHash`; MDN documents the cross-runtime Web Crypto `getRandomValues` and `SubtleCrypto.digest` APIs. The implementation uses Web Crypto at the pure contract boundary so Cloudflare and Node share one mechanism.
- Next.js/Vercel metadata documentation confirms page-level `noindex,nofollow`, Open Graph metadata, and image-route conventions; Vercel's OG documentation confirms that Satori/Resvg is a separate HTML/CSS-to-PNG stack with font/runtime constraints.
- MDN's Referrer-Policy and HTTP caching guidance supports `no-referrer` plus `private, no-cache`/`no-store` handling for revocable private-derived content.

### Mature repositories/libraries compared

| Name | Purpose | Version/activity | License | Runtime/transitive/security notes | Decision |
|---|---|---|---|---|---|
| `soldair/node-qrcode` / `qrcode` | QR encoding, including server-side SVG | `1.5.4`; high adoption, package metadata modified 2025-11 | MIT | Node/browser compatible; 3 runtime dependencies (`dijkstrajs`, `pngjs`, `yargs`); strict options and no user-controlled colors in this feature | **ADOPT** for S4 SVG QR |
| `nuintun/qrcode` / `qrcode` | TypeScript QR encode/decode alternative | `5.0.3`; released 2026-02 | MIT | 1 runtime dependency, active, but its public API is lower-level and does not provide the same direct server SVG-string contract used here | **REFERENCE ONLY** |
| `alexeyten/qr-image` | Small QR image generator | `3.2.0`; last package update 2023-02 | MIT | No runtime dependencies, but older maintenance and narrower feature surface; not the best fit for the dual-runtime route | **REJECT** |
| `nayuki/QR-Code-generator` | Correctness-focused QR core in TypeScript/JavaScript and other languages | stable release line, latest repository release 2022 | MIT | Would require maintaining a custom SVG renderer and copying attribution-bearing code into the app | **REFERENCE ONLY** |
| `vercel/satori` | JSX/CSS-to-SVG renderer for image/OG output | active repository; 429 commits and recent activity at research time | MPL-2.0 | Node/browser/Worker capable but limited CSS, explicit font buffers, no WOFF2, and Vietnamese glyph coverage must be verified; extra renderer complexity | **REFERENCE ONLY**, not installed |
| `thx/resvg-js` | SVG-to-PNG renderer | active 2.x line with native and WASM backends | MPL-2.0 | Native addon/WASM choice complicates Vinext/Workers and bundle/runtime compatibility; PNG is not needed for S3's first deliverable | **REFERENCE ONLY**, not installed |
| `dubinc/dub` | Mature short-link and analytics product | active, large monorepo | AGPLv3 for core with commercial enterprise areas | Useful patterns for idempotent events and attribution boundaries, but broad product scope and copyleft/commercial split make code reuse inappropriate | **REFERENCE ONLY**, concepts only |

### Patterns adopted, adapted and rejected

- **Adopted:** opaque random identity, hash-at-rest lookup, explicit lifecycle state, allowlisted public projection, noindex/no-referrer policy, deterministic renderer input, event idempotency, and a storage/analytics adapter boundary.
- **Adapted:** Dub-style event identity and attribution separation are reduced to five NaTarot share events; there is no affiliate, commission, conversion, cookie, IP or visitor profile model.
- **Reference only:** Satori's explicit image dimensions/font discipline, resvg's future PNG adapter shape, Nayuki's QR correctness notes, and the existing `dub`/`Refferq` research concepts.
- **Rejected:** browser screenshots, Google Drive as a CDN, host-derived public URLs, serializing private database rows, reusing `records` as a token table, embedding provider metadata, and adding Satori/resvg for an unneeded PNG path.

### New dependency and license review

Only `qrcode@1.5.4` is intended as a new production dependency, with `@types/qrcode@1.5.6` as a development-only type package. The runtime cost is the library's three small transitive dependencies; the package is MIT and is isolated behind `lib/tarot-share-qr.ts`. No MPL/AGPL code is copied or installed. Existing local assets and Web Crypto avoid new font, browser, native-addon or WASM dependencies.

### Security review and fit

The selected approach gives NaTarot 256-bit public-token entropy, SHA-256 at rest, a fixed trusted origin, a public field allowlist, escaped SVG text, approved local image paths, bounded event fields and a fail-closed production adapter. It fits the existing Node/Cloudflare split, preserves Moonlight/NaTarot visual assets, and leaves the later `reading_shares`/`share_events` migration as a clean seam. The main deferred research item is PNG conversion and image-cache semantics after a production storage adapter and runtime target are authorized.
