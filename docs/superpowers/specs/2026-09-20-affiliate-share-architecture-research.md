# NaTarot Affiliate + Share Image/QR Architecture Research

**Date:** 2026-09-20
**Scope:** read-only architecture audit and implementation-ready design proposal
**Product-code status:** unchanged by this mission

## Audit scope and evidence snapshot

This document is an architecture recommendation, not an implementation plan being executed in code. The mission inspected the NaTarot source tree, the canonical Level 4 baseline, later spread branches, and the requested reference repositories. No application code, database schema, migration, authentication flow, AI/Knowledge Base V5 behavior, Room behavior, deployment, VPS state, or production data was changed.

The evidence is intentionally split into source facts and proposals:

| Evidence | State observed | Interpretation |
|---|---|---|
| Current checkout | codex/tooling-and-version-history, HEAD dec2db0ef76f0ad4f5888747fb32f75e1a79478b | This checkout is dirty with user-owned UI/state/test work. It is not the canonical Level 4 branch. |
| Canonical baseline | codex/natarot-level4-baseline, ed9d60883cae92d2395961199339b06c26b3e6b6 | Source-of-truth baseline required by the mission. |
| Spread runtime | codex/natarot-level4-spread-engine, 09365af65cca555e0a55dee95b2483edce048b7b | Verified semantic ResolvedTarotSpread contract; branch is pushed. |
| Normalized geometry | codex/natarot-level4-spread-geometry-l1, b49dda8623d644340b64fa90a56c5d4f3d6bcfd3 | Verified normalized geometry source; local branch only at audit time. |
| L1A+B integration | codex/natarot-level4-spread-l1ab-integration, 5668fb5bafca3052e47bd9fe7f4b1196ad640d60 | Pushed integration of semantic spread plus normalized geometry. |
| Responsive SpreadBoard | codex/natarot-level4-spreadboard-l1c, a53dc44d5c088f2e9685e31f3e4a9dc51a09ebea | Verified/pushed responsive projection; not evidence of merge or deployment. |
| Current feature inventory | docs/project/ARCHITECTURE_MAP.md, FEATURE_REGISTRY.md, LOCKED_ZONES.md on the canonical branch | No public reading share, QR/image export, affiliate, payment, R2, Google Drive, or admin subsystem is present in the inspected source. |

The distinction VERIFIED + PUSHED does not mean MERGED, and MERGED does not mean DEPLOYED. This document uses those words only when supported by a local ref or project record.

## Executive Summary

NaTarot should treat sharing and affiliate monetization as two different domains with one carefully defined boundary:

1. **Share is a privacy-sensitive projection of an existing reading.** It should use an opaque, revocable public token and an allowlisted public view model. The QR code should point to /r/{opaque-token}; it should never point directly to a PNG or encode private reading data.
2. **The share renderer must consume the same semantic spread contract as Room.** The durable path is ResolvedTarotSpread → normalized geometry → renderer projection. A second hard-coded share layout would immediately create drift for 1/3/5/Celtic/10/12-card spreads.
3. **The canonical renderer should be deterministic SVG first, PNG second.** Satori is a good HTML/CSS-to-SVG layer; node-qrcode can produce an SVG QR; a resvg adapter can produce PNG. The renderer must be abstracted because NaTarot has both a Cloudflare/Sites shape and a Node/VPS shape, while native resvg-js and WASM have different packaging constraints.
4. **Affiliate should begin as a direct-referral ledger, not a full network.** The core funnel is link → visitor attribution → registration → user → trusted successful payment event → conversion → commission pending → approved/eligible → payout. Tiers 10/20/30 may be supported by a versioned policy model later, but thresholds and rates remain business decisions.
5. **Financial state must be ledger-backed.** A mutable totalCommission or cached balance is a read model only. Commission rates, tier, qualifying policy, basis amount, currency, and attribution decision must be snapshotted at conversion time. Refunds and chargebacks must create auditable negative adjustments rather than silently rewriting history.
6. **Public share must not silently become affiliate attribution.** A shared reading is content distribution. It should not transfer the original sharer’s affiliate credit or create a chain of sub-affiliates unless that future policy is explicitly approved.

Recommended sequencing:

~~~text
source-grounded contracts
  → public share/token/privacy boundary
  → shared spread projection
  → SVG/QR renderer spike
  → storage/cache adapter
  → payment event boundary
  → direct affiliate attribution
  → commission ledger, review, payout, fraud controls
~~~

## Current NaTarot Architecture

### Existing source shape

The inspected NaTarot baseline is a React 19 + TypeScript application using Vinext/Vite, Cloudflare D1-compatible persistence, and a Node node:sqlite adapter for the VPS topology. The source has a server boundary, repository layer, Tarot catalog/draw/session/readings, Room state persistence, member authentication on the canonical Level 4 baseline, and a guest cookie path.

Relevant current modules:

| Area | Source evidence | What it means for this mission |
|---|---|---|
| Identity | lib/request-identity.ts, lib/tarot-guest.ts | Share owner operations must use the existing trusted owner boundary; public reads must use a separate token resolver. |
| Guest identity | vintarot_guest cookie, 30-day max age, HttpOnly/SameSite behavior | This is an existing bearer-style guest identity. It is not a public-share token and should not be reused for public URLs. |
| Tarot persistence | db/schema.ts, lib/tarot-repository.ts | Reading/session/card payloads exist and are owner-scoped. The future share projection should reference a reading, not duplicate the whole domain record. |
| Reading route | app/api/tarot/reading/route.ts, lib/tarot-reading-service.ts | The future share flow should consume persisted output; it must not regenerate AI text merely to render a share image. |
| Saved readings | app/api/tarot/saved-readings/route.ts, lib/tarot-saved-reading.ts | Saved ownership and reopen behavior are private concerns. A public share should be an explicit separate capability. |
| Room | app/api/rooms/route.ts, lib/tarot-room.ts, Room UI | Room state is collaborative/private state with optimistic revision behavior. It is not a public reading-share contract. |
| Generic records | records table and /api/records | Useful for bounded product records, but not suitable as a public-token or financial-ledger substitute. |
| Deployment | .openai/hosting.json, Vite/Wrangler/VPS documentation | No R2 binding is declared in the inspected baseline; renderer/storage choices must remain deployment-aware. |

### Current database shape relevant to sharing

The current database has records, rooms, room_members, Tarot catalog tables, reading_sessions, reading_cards, and readings. A reading contains normalized and compatibility/legacy fields, including a persisted reading payload in the current source.

There are no inspected tables for:

- public share tokens or revocation;
- share projections or image assets;
- affiliate links, visitor attribution, or affiliate accounts;
- conversion events, commission entries, payout batches, refunds, or fraud decisions;
- payment provider events or entitlements;
- renderer jobs, generated-artifact metadata, or cache invalidation.

This is a gap statement, not permission to add migrations in this mission.

### Existing ownership and privacy boundary

The current reading/session paths apply owner predicates through the Tarot repository. Member authentication and guest access are separate flows in the canonical baseline. The guest cookie is a bearer identity visible to the browser and has no inspected server signature/binding; that observation remains in the security backlog and is not fixed here.

The future public-share resolver must not infer ownership from a public token alone. It should:

- hash the presented token and look up an active share record;
- verify share status and expiry;
- select only the stored public projection;
- never use the public token as an owner ID;
- never expose the private reading/session row wholesale.

### Existing spread source of truth

The later spread branches establish the intended contract:

- L1A exposes semantic ResolvedTarotSpread and ordered semantic positions.
- L1B resolves semantic positions into NormalizedSpreadPosition values with bounded x, y, rotation, zIndex, and scale.
- L1A+B adds resolveTarotSpreadGeometry(spread) and validates card-count equality.
- L1C projects normalized geometry into responsive board bounds.

The geometry is viewport-independent and can be projected into Room or a future share image canvas. The share renderer should consume this contract rather than copy Room coordinates or create a second spread catalog.

### Current integration gap

The canonical source inventory explicitly marks public access, image export, QR, Google Drive, R2, payments, and affiliate/admin features as absent or unproven. The Room invite/member flow is private-room sharing only. The research target is therefore a new bounded domain, not a refactor of an existing public-sharing implementation.

## Reference Repository Audit

### dubinc/dub

Audited snapshot: local shallow clone 70350f7, repository [dubinc/dub](https://github.com/dubinc/dub).

Dub is useful as a systems reference for:

- short links and click attribution;
- separate partner/program enrollment concepts;
- customer and conversion records;
- commission statuses such as pending, processed, paid, refunded, duplicate, fraud, and canceled;
- payout batches and holding periods;
- event/invoice idempotency;
- fraud rules and alerts;
- aggregate counters treated as projections rather than the only financial truth.

Observed source patterns include:

- link records tied to program and partner;
- customer records retaining click/link context;
- unique invoiceId + programId protection on commissions;
- Redis idempotency keys around lead/sale tracking;
- a first-conversion guard for concurrent events;
- payout claiming with a status guard;
- deterministic payout idempotency keys;
- separate fraud hold/release paths.

License and reuse boundary:

- LICENSE.md says most files are AGPLv3 and identifies apps/web/app/(ee) and related paths as covered by a separate commercial license.
- Dub’s own README describes it as an attribution platform for short links, conversion tracking, and affiliate programs.
- NaTarot may use these concepts as architecture research only. Do not copy Dub code, schema fragments, UI, names, or a mixed AGPL/enterprise implementation into NaTarot.

### Refferq/Refferq

Audited snapshot: local shallow clone 25df659, repository [Refferq/Refferq](https://github.com/Refferq/Refferq).

Refferq is useful as a compact domain inventory:

- affiliate accounts and referral codes;
- referral and click records;
- conversion statuses;
- commission rates and maturity dates;
- payout records;
- commission rules;
- program settings such as cookie duration, minimum payout, payout frequency, self-referral policy, and hold days;
- audit logs;
- admin and affiliate dashboard surfaces.

The inspected Prisma schema is a useful checklist, but not a target schema. Important limitations found in the audited implementation:

- the referral tracking route records a click path but does not demonstrate a complete durable browser attribution-cookie flow;
- conversion and webhook paths do not show a robust unique external-event boundary equivalent to the one required here;
- refund matching can fall back to broad customer-email metadata, which is unsafe as the primary financial identity;
- the schema has denormalized balances and commission records without enough evidence of an append-only ledger model;
- admin and integration routes need independent authorization/idempotency review before any production reuse.

License and reuse boundary:

- The repository is MIT licensed, so a future dependency review could permit use under MIT terms.
- This audit still recommends designing NaTarot’s domain from its own identity, payment, privacy, and ledger requirements rather than copying the Prisma schema or UI.
- Repository README claims such as “production ready” are not treated as evidence for NaTarot.

### vercel/satori

Audited snapshot: local shallow clone 499436f, repository [vercel/satori](https://github.com/vercel/satori).

Relevant capabilities and constraints:

- JSX-like pure/stateless input;
- HTML/CSS subset rendered to SVG;
- explicit width and height;
- fonts supplied as ArrayBuffer/Buffer;
- images supported, with explicit dimensions recommended;
- base64 or buffer image data avoids an extra I/O dependency during downstream SVG-to-PNG rendering;
- flexbox and absolute positioning are appropriate; browser-only features, external stylesheets, and arbitrary DOM behavior are not;
- SVG output may not exactly match browser layout;
- current README supports TTF, OTF, and WOFF, but explicitly says WOFF2 is not supported;
- Satori can run in Node and Web Workers, with a standalone build when dynamic WASM loading is constrained;
- text is embedded as paths by default, which improves downstream portability but increases output size.

Implications for Vietnamese:

- Font coverage must be verified for the full Vietnamese alphabet, punctuation, combining marks, and the exact font weights used by the brand.
- Existing web font assets must not be assumed compatible; a WOFF2-only asset cannot be passed directly to the audited Satori version.
- A deterministic font fixture and golden-image test are required before product integration.

License: Satori is MPL-2.0. Adding it as an unmodified dependency is a licensing decision separate from copying or modifying source files; the dependency notices and any modified MPL-covered files must be handled by the implementation owner.

### soldair/node-qrcode

Audited snapshot: local shallow clone 3848ed2, repository [soldair/node-qrcode](https://github.com/soldair/node-qrcode).

Relevant capabilities:

- server and client usage;
- PNG, SVG, and UTF-8 renderers;
- multibyte text support;
- error-correction levels L/M/Q/H;
- quiet-zone and output-size options;
- default error correction level M.

Recommendation:

- Encode only the canonical public URL, such as https://natarot.com/r/{opaque-token}.
- Prefer SVG output for composition into the Satori SVG tree.
- Use a tested quiet zone and sufficient output size; keep colors high-contrast.
- Choose M/Q/H by the actual digital/print use case after scan tests, not by intuition.

License: MIT. Preserve the MIT notice if source is copied or redistributed; prefer the package API rather than vendoring code.

### thx/resvg-js

Audited snapshot: local shallow clone 9de8ddd, repository [thx/resvg-js](https://github.com/thx/resvg-js).

Relevant capabilities:

- Rust-based SVG renderer;
- native Node backend via napi-rs;
- separate pure WebAssembly backend;
- SVG-to-PNG conversion, scaling, cropping, custom fonts, and image loading.

The native and WASM paths must be treated as separate adapters. The existence of a WASM backend does not prove that a specific Cloudflare/Vinext bundle, memory limit, or request budget works for NaTarot. A small deployment spike is required.

License: the audited repository is MPL-2.0. Do not copy source into the product without a license review and file-level notice handling.

### Renderer alternatives

| Pipeline | Strength | Weakness | NaTarot recommendation |
|---|---|---|---|
| Satori → SVG → resvg native | Deterministic structured layout; good Node/VPS fit; avoids browser startup | Native addon is deployment-specific; not a Worker default | Preferred Node/VPS adapter behind an interface. |
| Satori → SVG → resvg WASM | Same layout contract; potentially portable | Bundle, memory, WASM initialization, and CPU limits require proof | Candidate edge adapter; spike before choosing. |
| Browser screenshot/Puppeteer | High browser fidelity; useful for visual QA | Browser runtime, slower startup, heavier memory, less portable to Workers, more nondeterminism | QA/reference fallback, not canonical production renderer. |
| Browser Canvas | Available in browser; QR/image primitives possible | Text shaping/layout and font determinism become custom work; server rendering is awkward | Not the canonical multi-card pipeline. |
| Client-only export | No server image workload | Cannot guarantee privacy, exact fonts, or a stable share artifact; QR/public URL still needs server domain | Optional enhancement after server contract. |

The canonical domain must not depend on which renderer is used. The input is a versioned, sanitized share view model; the output adapter may be SVG or PNG.

## Affiliate Findings

### Conceptual funnel

~~~text
affiliate link
  → visitor click / attribution candidate
  → registration or account association
  → user
  → trusted successful payment event
  → conversion
  → commission pending
  → approved / matured / eligible
  → payout batch
  → payout sent / paid
~~~

Required principle: each transition is an auditable event or state change with an external idempotency key where an external system is involved. A click or registration is not a commission. A client redirect or “checkout completed” page is not a successful payment event.

### Proposed initial scope

Implement conceptually in two stages:

1. **Direct referral only:** one referring affiliate may receive credit for an eligible conversion. No recursive partner network, parent/child commission, or multi-level payout is implied.
2. **Future tier policy:** tiers 10/20/30 can be represented as versioned policy rows, but exact rates, thresholds, qualification window, reset behavior, and whether the metric is paid or approved conversions are business decisions.

The share system should not create affiliate credit by itself. A visitor who reaches NaTarot through an ordinary shared reading is not automatically a referral for the reader. A share CTA may link to an ordinary product route. If future campaigns need share-specific affiliate links, they must be explicit links with their own attribution metadata.

### Attribution rules to decide and then freeze

The implementation must not quietly choose these rules:

- cookie/attribution duration;
- first-click, last-click, or a defined hybrid;
- whether a later affiliate click overwrites an earlier click;
- whether attribution is decided at click, registration, first paid conversion, or all three;
- what happens when an anonymous visitor later registers;
- what happens when an existing user clicks an affiliate link;
- whether repeat purchases qualify;
- whether refunds reverse only the most recent commission or all related eligible commissions;
- gross, net-of-tax, net-of-refund, or product-specific commission basis;
- commission rate/tier snapshot timing;
- self-referral and household/device/payment-identity policy;
- duplicate-account handling;
- pending/hold duration;
- payout batch schedule, minimum amount, currency, and failed-payout retry policy;
- admin adjustment permissions and audit requirements.

### Recommended technical attribution shape

Store a server-side attribution candidate:

- visitor_key: random opaque identifier, not an email or account ID;
- affiliate_id and link/campaign ID;
- first-seen and last-seen timestamps;
- landing path and campaign metadata allowlisted by name;
- expiration timestamp and policy version;
- optional coarse fraud signals stored as hashes or bounded categories, not raw fingerprint dumps.

Give the browser only a signed or random opaque cookie. Do not put commission rate, user ID, email, payment amount, or private reading data in the cookie. Resolve attribution into a durable account association only at a trusted registration/account event, retaining the original click and policy snapshot.

The recommended default to take to business review is last eligible click within the configured window, with a clear overwrite rule and no retroactive reassignment after the first approved conversion. This is a proposal, not an approved policy.

### Payment boundary

Affiliate conversion ingestion should accept only a trusted internal payment event or a verified provider webhook:

- authenticated with a server-side secret/HMAC or equivalent;
- tied to a provider event ID and merchant order/payment ID;
- carries user/account ID where the provider can safely map it;
- carries amount, currency, product/entitlement, tax/fee/refund metadata as available;
- has received-at and occurred-at timestamps;
- is idempotent on the provider event ID and the merchant payment/order ID;
- is processed under a transaction that either records the event and conversion or makes an observable retry-safe result.

No payment provider is selected in this research. The contract comes first.

### Commission and payout rules

Use explicit statuses, for example:

~~~text
conversion: received → eligible | rejected | reversed
commission: pending → approved → available → batched → paid
                         ↘ canceled / held / reversed
payout: draft → processing → paid
                    ↘ failed / canceled
~~~

Names can change during implementation, but state semantics must not be ambiguous. A pending commission is not spendable balance. A paid payout is not proof that the underlying conversion was valid forever; a later chargeback needs a negative adjustment, recovery policy, or account hold.

Every commission should snapshot:

- attribution decision and link/campaign;
- conversion event ID and order/payment ID;
- basis amount and currency;
- rate or fixed amount;
- tier ID/version;
- policy/ruleset version;
- calculation explanation;
- hold/maturity date;
- created-by/system actor and timestamps.

Use integer minor units plus an explicit ISO currency. Do not use floating-point money in the durable ledger.

### What to learn from Dub without copying it

Adopt the architecture patterns of event idempotency, invoice/order uniqueness, holding periods, fraud holds, payout-claim status guards, and projection counters. Keep NaTarot’s implementation smaller: one direct referral path, one payment boundary, one ledger, one admin review path. Do not begin with Dub’s enterprise/network breadth.

### What not to inherit from Refferq

Do not use email-only refund matching, client-controlled transaction identity, placeholder attribution keys, or mutable balance as the primary financial record. A compact product can still have a strong event boundary and append-only adjustment model.

## Share/Image/QR Findings

### Share contract

The public URL contract is:

~~~text
GET /r/{opaque-token}
~~~

The token is a high-entropy random secret, preferably at least 128 bits of entropy and represented with a URL-safe alphabet. Store only a cryptographic hash of the token at rest. Rotation creates a new token and invalidates the old one. The token must not be a database ID, session ID, reading ID, timestamp, or short sequential slug.

A share has explicit state:

~~~text
PRIVATE
PUBLIC_LINK
REVOKED
~~~

An optional expiry may make an otherwise public link invalid. The public route should return a non-enumerating not-found response for an invalid, revoked, or expired token. Owners can create, rotate, revoke, and inspect their own share records; public visitors can only resolve the allowlisted projection.

### Public view model

Do not serialize the full reading_sessions, readings, Room state, or AI provider response. Persist or derive a versioned projection containing only:

- share ID and public token hash reference;
- reading ID/session ID reference;
- locale;
- spread type and display name;
- ordered public positions;
- card identity and approved card art key;
- orientation if intended to be public;
- bounded question/title only if the user opted in;
- bounded summary/excerpt only if the user opted in;
- geometry contract version;
- renderer/template version;
- created/updated/revoked/expiry timestamps.

Explicitly exclude by default:

- owner ID, email, member information, guest cookie, or account metadata;
- private Room notes, marks, paths, context, or collaboration state;
- provider name, prompt, model, raw AI response, internal error, or token;
- hidden card meanings or unapproved analysis;
- arbitrary HTML, CSS, image URL, or user-supplied markup;
- payment, affiliate, admin, or moderation data.

### Share image content

The first image version should be a recognizable NaTarot composition, not a full transcript:

- NaTarot mark/brand lockup;
- spread name and selected locale;
- card arrangement with position labels;
- card art from an allowlisted asset key;
- short, sanitized question/title only when consented;
- short safe summary or “open to read the full interpretation” CTA;
- QR code pointing to /r/{opaque-token};
- canonical NaTarot URL or product CTA.

Do not put the full AI answer, private question, account details, or raw token metadata in the image. A share image is likely to be reposted permanently even after the page is revoked.

### Shared spread geometry

The renderer input should be a pure view model:

~~~text
ResolvedTarotSpread
  → resolveTarotSpreadGeometry
  → NormalizedSpreadPosition[]
  → project to image canvas bounds
  → card/image/text compositor
~~~

The normalized positions are bounded and deterministic. They support one-card, 3-card, 5-card, Celtic Cross (10), and generic/future 12-card layouts without duplicating the semantic spread catalog. The image renderer should carry geometry_version, spread_type, and an ordered position key for snapshot compatibility.

Use layout presets by card count/layout family rather than one universal hard-coded canvas. The implementation spike should prove:

- 1 card: clear focal hierarchy;
- 3 and 5 cards: position labels remain readable;
- Celtic Cross: cross and side column do not collide;
- 10 and 12 cards: card minimums, text truncation, and QR safe area remain valid;
- all card images retain aspect ratio;
- deterministic projection at portrait and landscape presets;
- no card disappears when a semantic position is unknown; fallback is explicit and tested.

### Image pipeline recommendation

1. Load a sanitized public view model.
2. Resolve shared normalized geometry.
3. Load local/allowlisted card and logo bytes.
4. Load a Vietnamese-capable font in a Satori-compatible format.
5. Generate an SVG layout with Satori.
6. Generate the QR as SVG from the canonical public URL.
7. Compose QR SVG/data into the SVG layout.
8. Return SVG directly or convert SVG to PNG through a renderer adapter.
9. Store artifact metadata and cache identity; do not store the binary in the relational database.

Satori should not fetch arbitrary user-provided URLs. Remote assets should be avoided or passed through a strict allowlist/proxy with size, content-type, redirect, and timeout limits. Prefer bytes loaded from the application bundle or approved object storage.

### SVG versus PNG

| Output | Use | Notes |
|---|---|---|
| SVG | Internal preview, deterministic composition, accessible test artifact | Must sanitize/contain all text and URLs; some social networks require PNG. |
| PNG | Download and social metadata | Requires resvg/native/WASM adapter and visual regression testing. |
| Browser screenshot | QA comparison only | Useful to compare the live UI to the canonical renderer; not the source of truth. |

### QR design

The QR payload must be the canonical public URL, not a direct asset URL. Use a stable token route so the owner can revoke the page or rotate the token without leaving an unbounded public PNG link.

Initial defaults for review:

- error correction M for clean digital images;
- Q or H for small, compressed, printed, or damaged contexts;
- tested quiet zone;
- black/dark modules on a light background;
- no logo cutout until decode tests prove safety;
- no user-controlled colors or gradients;
- QR generation includes source=qr only if analytics need it and the canonical URL policy permits query parameters.

The exact error-correction level and visual size remain implementation/test decisions.

### Storage and cache

Separate these concerns:

1. **Reading data:** canonical relational/app data.
2. **Share projection:** privacy-filtered immutable/versioned snapshot.
3. **Generated artifact:** SVG/PNG bytes and metadata.
4. **Delivery/cache:** CDN or object-storage cache.

Recommended target:

- relational metadata records share state and artifact status;
- object storage/CDN stores generated SVG/PNG;
- on-demand generation is cached by a versioned projection hash;
- large/Celtic images may use an asynchronous job;
- invalid/revoked pages are denied at the public resolver even if an old artifact remains in a cache;
- artifact URLs use versioned keys and short/revocable delivery policy where immediate takedown is required.

Options:

| Option | Good for | Risk/constraint |
|---|---|---|
| Local VPS disk | Prototype or private internal artifacts | Not durable across redeploy/scale; requires backup and permissions. |
| Object storage/CDN | Durable public delivery and cache | Requires binding/credentials, lifecycle, content-type, purge/expiry policy. |
| Cloudflare R2 | Natural if the edge deployment is the chosen owner | No R2 binding was found in the canonical baseline; do not assume it exists. |
| Google Drive | Human archive/admin export | Not a public CDN contract; permissions and hot-linking are unsuitable for primary delivery. |
| On-demand only | Minimal first implementation | CPU/timeout cost, repeated rendering, social crawler latency; use bounded cache. |

The recommendation is object-storage/CDN behind an adapter, with a Node/VPS or edge rendering worker selected only after the runtime spike. Google Drive should not be used as the public image CDN.

## License Matrix

| Reference | Audited license | Safe use in this mission | Main caution |
|---|---|---|---|
| Dub | AGPLv3 for most files; identified enterprise paths under separate commercial terms; third-party licenses retained | Read schemas, workflows, and concepts; cite repository | Do not copy code, mixed-license paths, UI, or schema fragments. Any future dependency requires legal review. |
| Refferq | MIT | Read domain inventory and implementation patterns | MIT permits reuse but weak observed idempotency/refund patterns are not a design standard. Preserve MIT notices if code is ever reused. |
| Satori | MPL-2.0 | Evaluate as an unmodified dependency; use documented API | WOFF2 unsupported in audited README; modified MPL files require notice/source obligations review. |
| node-qrcode | MIT | Evaluate as an unmodified dependency through package API | Preserve MIT notice if redistributing copied code; still validate QR security/readability. |
| resvg-js | MPL-2.0 | Evaluate native/WASM package path behind adapter | Runtime/bundle/CPU compatibility is unproven; file-level license obligations apply to modifications. |

No source code from these repositories was copied into NaTarot by this mission. The eventual dependency bill of materials must be reviewed independently before package installation.

## NaTarot Target Share Architecture

### Domain components

Proposed components, not yet implemented:

~~~text
SharePolicy
  → ShareService (owner auth, create/rotate/revoke)
  → PublicShareResolver (hash token, state/expiry, allowlist)
  → ShareProjectionBuilder (private reading → public snapshot)
  → SpreadProjection (semantic → normalized → canvas)
  → ImageRenderer interface (SVG/PNG adapters)
  → ArtifactStore interface (metadata + object storage)
  → ShareAnalytics event sink
~~~

The renderer must receive a fully sanitized ShareImageViewModel, never a database row or an AI response object.

### Lifecycle

~~~text
private reading
  → owner chooses Share
  → explicit public projection/consent
  → token hash + projection created
  → public route resolves
  → image generated/cached
  → owner may rotate or revoke
~~~

Create/rotate/revoke operations are authenticated and owner-scoped. Public GET/image operations are token-scoped and rate-limited. Revocation must affect page resolution immediately; binary cache invalidation can use versioned keys and a bounded cache policy.

### Suggested artifact states

~~~text
NOT_REQUESTED → QUEUED → RENDERING → READY
                          ↘ FAILED
READY → STALE → QUEUED
~~~

Failure responses must not leak private reading content or renderer stack traces. A failed image should not invalidate the public reading page.

### Renderer adapter boundary

Conceptual interface:

~~~text
renderShareSvg(viewModel, rendererVersion) -> { bytes, contentType, dimensions, digest }
renderSharePng(svgBytes, rendererVersion) -> { bytes, contentType, dimensions, digest }
~~~

The implementation should keep Satori and resvg options, font loading, and asset loading behind this boundary. The core share domain must not know whether the artifact was generated on the VPS, a Worker, a queue, or a build service.

### Caching rules

Cache key should include:

- immutable share projection/version;
- geometry version;
- renderer/template version;
- font asset/version;
- card/logo asset versions;
- output format and dimensions.

Do not key only by reading ID. The same reading can have different privacy projections, locale, template, token, or artifact version.

## NaTarot Target Affiliate Architecture

### Domain components

~~~text
AffiliateProgram / Policy
  → AffiliateAccount + Link
  → AttributionService
  → RegistrationAssociation
  → PaymentEventIngestor
  → ConversionService
  → CommissionLedger
  → Review/Hold/FraudService
  → PayoutBatchService
  → Affiliate/Admin projections
~~~

The first release should have one program and one direct-referral path, but the data model should keep program/policy IDs so later rates or campaigns do not require rewriting history.

### Attribution state machine

~~~text
CLICKED
  → CANDIDATE_ACTIVE
  → ASSOCIATED_WITH_USER
  → CONVERSION_ELIGIBLE
  → EXPIRED / INVALIDATED / REJECTED
~~~

Only a trusted account/payment event can move from an anonymous candidate to an eligible conversion. A share-view event is analytics, not attribution.

### Commission state machine

~~~text
PENDING
  → APPROVED
  → AVAILABLE
  → BATCHED
  → PAID

PENDING/APPROVED → HELD / REJECTED / CANCELED
PAID → REVERSED only through a separate adjustment/recovery path
~~~

The exact labels can be adapted to business language, but every status must have an allowed transition, actor, timestamp, reason, and audit record.

### Ledger rules

Use an immutable entry or journal model:

- positive credit for a commission;
- negative adjustment for refund/chargeback/clawback;
- payout debit or settlement record;
- manual adjustment with mandatory reason and actor;
- all amounts in integer minor units and explicit currency;
- no delete/update that destroys the original economic event;
- balance and dashboard totals computed from ledger entries or maintained as rebuildable projections.

If a mutable balance is added for performance, it must be derivable and repairable. It is never the only financial truth.

### Tiers 10/20/30

Represent future tiers as policy versions:

- tier_code: 10, 20, or 30 as a business label;
- qualification metric;
- threshold and evaluation window;
- rate/fixed reward;
- eligibility conditions;
- effective start/end;
- policy version.

Do not assume “10/20/30” means a percentage, number of conversions, monthly revenue, or lifetime count. The business decision must define that. A conversion snapshots the tier/rule it used; later tier changes do not rewrite past commissions.

## Privacy Model

### Share privacy states

| State | Owner | Public resolver | Image |
|---|---|---|---|
| Private | Full private reading according to existing owner rules | No public result | Not publicly addressable |
| Public link | Can inspect/rotate/revoke | Allowlisted projection only | Available according to artifact policy |
| Revoked | Owner/admin audit only | Non-enumerating not-found | New requests denied; cached delivery policy must be bounded |
| Expired | Owner can see status | Non-enumerating not-found | New requests denied |

Public-by-default is not recommended. Sharing should be an explicit user action with a clear preview of what will be visible.

### Consent and content minimization

Consent copy should distinguish:

- public page;
- downloadable image;
- QR distribution;
- search indexing;
- question/title visibility;
- interpretation excerpt visibility.

Default to noindex/nofollow, no public owner identity, and no full AI answer. If the user chooses to include a question or summary, bound length and sanitize it.

### Affiliate privacy

Use the smallest data needed:

- opaque visitor ID;
- affiliate/link IDs;
- timestamps and campaign metadata;
- user/account ID only after trusted association;
- payment event IDs and amounts only for financial processing;
- hashed or coarse fraud signals where possible.

Do not expose email, payment method, raw IP, full user-agent, private question, or cookie contents to affiliate dashboards unless a separate privacy review approves it. Data retention, deletion, export, and consent rules must be defined before launch.

## Security Model

### Public-share controls

- hash public tokens at rest;
- use high entropy and rotation;
- use constant-time comparison where applicable;
- prevent token leakage in logs, analytics query strings, referrers, and error pages;
- add X-Robots-Tag: noindex, nofollow by default;
- use a restrictive CSP and Referrer-Policy: no-referrer;
- escape all user text;
- never render user HTML/CSS;
- allowlist card/logo assets;
- limit public resolver/image rate;
- use bounded response sizes and timeouts;
- keep revoked/expired resolution authoritative even when an artifact is cached;
- never expose owner/session IDs in the public URL.

### Renderer controls

- no arbitrary remote URL fetches;
- strict asset host/key allowlist;
- redirect limit and content-type validation;
- byte-size and dimension limits;
- reject SVG with script, external resource, or unsafe URL content;
- sanitize QR payload to the canonical NaTarot origin/path;
- cap question/summary length before layout;
- deterministic font and image loading;
- fail closed on missing card assets;
- use queue limits and concurrency controls.

### Affiliate controls

- server-side attribution cookie or signed opaque token; never trust client-supplied commission fields;
- CSRF/origin/auth protection for owner/admin writes;
- verified provider webhook signature/HMAC and replay window;
- unique provider event/order keys;
- transactionally record event and conversion;
- rate-limit link/click endpoints;
- do not treat Referer as proof of attribution;
- self-referral/duplicate-account review;
- separate admin authorization from affiliate self-service;
- payout state guards and idempotency keys;
- hold periods for refund/chargeback risk;
- immutable audit log for policy, status, payout, and manual adjustments;
- alert on retry storms, duplicate events, unusual click-to-conversion ratios, and payout changes.

### Security items inherited from existing architecture

The existing guest cookie is a separate bearer identity concern. Before public sharing or affiliate launch, the existing identity threat model should be reviewed for signing/binding, cookie theft, session fixation, and cross-origin writes. This research records the dependency; it does not change the current identity implementation.

## Logical Data Model

The following is a logical model only. It is not a migration or schema instruction.

### Share domain

~~~text
share
  id
  owner_id
  reading_id
  status
  token_hash
  token_version
  created_at
  expires_at nullable
  revoked_at nullable
  revoked_by nullable
  projection_version
  geometry_version
  renderer_version
  public_question_policy
  public_summary_policy
  last_accessed_at nullable

share_projection
  share_id
  locale
  spread_type
  spread_label
  positions_json (ordered, allowlisted)
  cards_json (card key, position key, orientation, art key)
  public_text_json (bounded, sanitized)
  projection_digest
  created_at

share_artifact
  id
  share_id
  projection_digest
  format
  width
  height
  storage_key
  content_digest
  status
  failure_code nullable
  renderer_version
  created_at
  updated_at
~~~

Recommended uniqueness/indices:

- unique token hash/version;
- owner/status lookup;
- share/format/projection digest;
- no public index on raw token;
- no artifact row containing private text beyond the approved projection.

### Affiliate domain

~~~text
affiliate_program
  id
  name
  status
  currency_policy
  policy_version

affiliate_policy_version
  id
  program_id
  attribution_window
  attribution_rule
  eligible_event_rule
  commission_basis_rule
  hold_days
  min_payout_minor
  effective_at
  retired_at nullable

affiliate_account
  id
  user_id
  program_id
  status
  public_code
  payout_profile_reference
  created_at

affiliate_link
  id
  affiliate_account_id
  campaign_code
  destination_path
  status
  created_at

attribution_touch
  id
  program_id
  affiliate_account_id
  affiliate_link_id
  visitor_key_hash
  user_id nullable
  first_seen_at
  last_seen_at
  expires_at
  policy_version
  metadata_json_allowlisted

conversion_event
  id
  program_id
  user_id
  source
  provider_event_id
  provider_order_id nullable
  event_type
  amount_minor
  currency
  occurred_at
  received_at
  payload_digest
  status

commission_entry
  id
  program_id
  affiliate_account_id
  conversion_event_id
  attribution_touch_id nullable
  entry_type
  amount_minor
  currency
  status
  rate_or_fixed_snapshot
  basis_minor_snapshot
  tier_snapshot
  policy_version
  available_at
  created_at

commission_adjustment
  id
  original_entry_id
  conversion_event_id nullable
  reason
  amount_minor
  currency
  external_event_id
  actor
  created_at

payout_batch
  id
  program_id
  status
  currency
  total_minor
  idempotency_key
  provider_batch_id nullable
  created_at

payout_item
  payout_batch_id
  commission_entry_id
  amount_minor
  status

affiliate_audit_log
  id
  actor_id/system_actor
  object_type
  object_id
  action
  before_digest nullable
  after_digest nullable
  reason
  created_at
~~~

Required uniqueness candidates:

- affiliate code;
- provider event ID within source/program;
- provider order/payment ID within the merchant context;
- one commission rule application per conversion/affiliate/event type;
- one adjustment per external refund/chargeback event;
- payout item cannot be claimed twice;
- payout batch idempotency key.

The exact composite keys require the payment provider contract and business policy.

## API Contracts

These are future contracts, not implemented endpoints.

### Share owner APIs

POST /api/tarot/readings/{readingId}/share

- Auth: existing trusted owner/member boundary; guest behavior must be explicitly decided.
- Request: locale, public-question policy, public-summary policy, optional expiry.
- Response: share ID, public URL, status, visible-field summary, expiry.
- Must not return the raw token hash or private reading.

GET /api/tarot/readings/{readingId}/share

- Auth: owner only.
- Response: current share statuses and artifact statuses, not public visitor analytics containing raw identifiers.

POST /api/tarot/shares/{shareId}/rotate

- Auth: owner only.
- Invalidates the old token and creates a new public URL.

DELETE /api/tarot/shares/{shareId}

- Auth: owner/admin policy.
- Revokes public resolution; must be idempotent.

GET /r/{opaque-token}

- Auth: public token only.
- Response: public share page/view model.
- Headers: noindex/nofollow, CSP, referrer policy, bounded cache policy.
- Invalid/revoked/expired: non-enumerating not-found.

GET /r/{opaque-token}/image.svg and GET /r/{opaque-token}/image.png

- Auth: public token plus active share.
- Must resolve active share before serving; artifact URL must not bypass revocation policy.
- Content type and dimensions are explicit.

### Affiliate member APIs

Future routes should be narrow and read projections from the ledger:

- POST /api/affiliate/apply
- GET /api/affiliate/me
- POST /api/affiliate/links
- GET /api/affiliate/links
- GET /api/affiliate/referrals
- GET /api/affiliate/conversions
- GET /api/affiliate/commissions
- GET /api/affiliate/payouts

Affiliate clients must not be allowed to submit amount, rate, tier, approval, payout status, or “successful purchase” claims as authoritative values.

### Affiliate/admin APIs

Future admin routes should cover:

- program/policy versions;
- affiliate approval/suspension;
- link/campaign management;
- attribution inspection and dispute;
- conversion review;
- commission approve/reject/hold/release;
- refund/chargeback adjustment;
- payout batch create/claim/send/retry/cancel;
- fraud case and audit log.

Every write needs role authorization, reason where financial, idempotency where external, and an audit event.

### Payment event boundary

POST /api/internal/payments/events

Request fields:

- source/provider;
- provider event ID;
- merchant payment/order ID;
- user/account ID;
- event type;
- amount minor/currency;
- occurred-at;
- product/entitlement reference;
- refund/chargeback reference where applicable;
- signed payload or an already verified internal envelope.

Response:

- accepted with stable internal event ID;
- duplicate with prior result;
- rejected with a safe reason.

This route must be server-to-server only. No provider is selected by this document.

## Event Model

Use an append-only event/audit vocabulary, with a stable event ID and actor/source:

### Share events

- share.created
- share.rotated
- share.revoked
- share.expired
- share.viewed
- share.image.requested
- share.image.ready
- share.image.failed
- share.downloaded
- share.qr.opened
- share.cta.clicked

Events should contain share ID, projection version, renderer version, coarse context, and timestamps. Do not log the raw token or private question.

### Affiliate events

- affiliate.application.created
- affiliate.approved
- affiliate.suspended
- affiliate.link.created
- affiliate.link.clicked
- affiliate.attribution.created
- affiliate.attribution.associated
- affiliate.registration.associated
- payment.event.received
- conversion.created
- conversion.rejected
- commission.created
- commission.approved
- commission.held
- commission.released
- commission.reversed
- payout.batch.created
- payout.item.claimed
- payout.sent
- payout.failed
- payout.paid
- fraud.case.opened
- fraud.case.resolved
- affiliate.manual_adjustment.created

Each financial event needs source, external event ID, policy/rate snapshots, amount/currency, and actor. Analytics events can be eventually consistent; ledger transitions cannot be silently dropped.

## UI Surfaces

This section describes future surfaces only. It does not authorize visual implementation in this mission.

### Reader/Room

- Explicit Share action after a persisted reading exists.
- Preview of the public fields: cards, spread, optional question/title, optional summary.
- Clear warning that anyone with the link can view it.
- Create, copy, download, rotate, revoke status.
- No share action before persistence if the output would require regenerating AI.

### Public share page

- NaTarot-branded reading summary.
- Visible shared-reading state and creation date if useful.
- Cards and positions using the same semantic order as Room.
- Safe excerpt and CTA to create a new reading.
- No owner identity by default.
- No search indexing by default.
- Error state for revoked/expired link without revealing whether a token ever existed.

### Share image dialog

- Format/size preview.
- Toggle for question/title visibility.
- Toggle for summary visibility.
- Locale.
- Download SVG/PNG only after renderer support is ready.
- QR preview with decode-test status only in internal QA, not a user-facing technical badge.

### Affiliate member portal

- Apply/status/profile.
- Copy affiliate link.
- Clicks, attributed visitors, registrations, conversions, pending/available/paid commissions.
- Payout profile and batch history.
- Policy/terms and hold-period explanation.
- No editable financial fields.

### Admin portal

- Program and versioned policy settings.
- Affiliate approval/suspension.
- Attribution/conversion review.
- Commission hold/release/reversal.
- Fraud cases and duplicate-account review.
- Payout batches and provider status.
- Audit log and export.

## Business Decisions Required

These decisions must be recorded before implementation is considered ready:

1. Is a public share link private-by-default until explicitly created?
2. Can guest users create a share, and what durable ownership/claim path is allowed?
3. Is a share token permanent, expiring, or both?
4. Can a user include question/title text?
5. Can a user include an AI summary, and who approves the summary policy?
6. Is the public page noindex/nofollow permanently?
7. Are public shares allowed to be embedded or crawled?
8. What image formats and presets are required first?
9. Which existing font files are legally and technically usable for Vietnamese Satori output?
10. Where are artifacts stored and how are revoked artifacts purged?
11. Is rendering synchronous for small images and queued for large images?
12. Which runtime owns rendering: VPS Node, Worker WASM, or a dedicated service?
13. Is affiliate attribution first-click, last-click, or another rule?
14. What is the attribution duration and overwrite rule?
15. Is attribution locked at registration, first purchase, or each eligible purchase?
16. Do repeat purchases qualify?
17. Are conversions based on gross, net, tax-excluded, fee-excluded, or product-specific amount?
18. What are tier 10/20/30 rates, thresholds, windows, and reset rules?
19. Is a tier based on approved, available, or paid conversions?
20. What hold period protects against refunds and chargebacks?
21. What is the minimum payout, currency, schedule, and payment provider?
22. Are self-referrals, household referrals, or same-payment-identity referrals disallowed?
23. What is the duplicate-account and appeal policy?
24. Who may create manual ledger adjustments, and what evidence/reason is required?
25. Does a shared reading ever carry an affiliate referral, or are those flows strictly separate?
26. What retention/deletion/export obligations apply to click, attribution, payment, and fraud data?

## Implementation Dependencies

### Share dependencies

- Stable public origin and route contract.
- Persisted reading payload available without AI regeneration.
- Approved public projection and privacy policy.
- Shared L1A/L1B/L1C spread contract available to the target branch.
- Card art asset registry with stable allowlisted keys.
- Vietnamese-capable TTF/OTF/WOFF font fixture; WOFF2 conversion or alternate asset decision.
- Satori + renderer package review and license inventory.
- Renderer runtime spike for Node/VPS and edge/Sites topology.
- Object storage/CDN choice, cache headers, purge/revocation behavior.
- QR decode test harness.
- Observability and bounded job execution.

### Affiliate dependencies

- Trusted user/account identity boundary.
- Payment provider event contract and signature verification.
- Product/entitlement model and successful-payment definition.
- Currency and amount basis policy.
- Attribution consent and cookie policy.
- Ledger/adjustment model and transaction semantics.
- Admin authorization and audit log.
- Payout provider contract and idempotency behavior.
- Fraud/duplicate-account signals and review workflow.
- Terms, privacy, affiliate agreement, refund/chargeback policy.

### Quality dependencies

- Unit and integration tests with isolated D1-shaped fixtures.
- Renderer golden fixtures for every supported spread family.
- Vietnamese text fixtures containing diacritics and combining marks.
- QR decode tests across output sizes and error-correction levels.
- Security tests for token enumeration, revocation, XSS, SSRF, noindex headers, and rate limits.
- Financial race tests for duplicate provider events, concurrent commissions, refunds, chargebacks, payout claim, and retry.
- License/BOM review before dependency installation.

## Recommended Roadmap

### Phase 0 — contract and decision freeze

- Approve public share/privacy decisions.
- Approve affiliate attribution and money policies.
- Record the payment event envelope without selecting a provider.
- Confirm target branch and merge/deployment gates.

### Phase 1 — shared spread and share projection

- Bring the verified semantic/normalized geometry contract into the implementation branch through normal review.
- Define ShareImageViewModel and public allowlist.
- Add privacy policy tests without exposing a route yet.

### Phase 2 — public share lifecycle

- Add owner-scoped create/rotate/revoke service.
- Hash high-entropy tokens.
- Add public resolver with state/expiry/noindex/security headers.
- Test invalid/revoked/expired/non-enumerating behavior.

### Phase 3 — renderer spike

- Prove Satori with a Vietnamese font in TTF/OTF/WOFF.
- Render 1/3/5/Celtic/10/12 fixtures from normalized geometry.
- Generate QR SVG for canonical /r/{token} URLs.
- Compare Node native resvg and WASM paths where applicable.
- Record dimensions, latency, memory, output size, and decode results.

### Phase 4 — artifacts and delivery

- Add SVG/PNG adapter and artifact metadata.
- Add object-storage/CDN adapter or bounded on-demand cache.
- Add background rendering for large images.
- Verify revocation versus cached artifacts.

### Phase 5 — affiliate foundation

- Add program/policy version model.
- Add affiliate application/account/link.
- Add server-side click/attribution candidate and account association.
- Add analytics projections without financial credit.

### Phase 6 — payment and ledger

- Integrate verified payment event envelope.
- Add conversion idempotency and commission ledger.
- Snapshot rules/tier/basis.
- Add pending/hold/approval/reversal and audit paths.

### Phase 7 — payout/fraud/admin

- Add payout batches, provider idempotency, retries, and minimum payout.
- Add refund/chargeback adjustments.
- Add self-referral/duplicate/fraud review.
- Add affiliate/admin surfaces.

Share can be shipped before affiliate if its privacy and renderer gates are complete. Affiliate must not ship before the payment event and ledger gates are complete.

## Protected Zones

The following areas are out of scope for this research and require their own review before changes:

- authentication, member sessions, guest identity, cookie semantics, and request identity;
- db/schema.ts, migrations, D1/SQLite adapters, and existing records/readings ownership;
- AI provider selection, prompts, Knowledge Base V5, DeepSeek transport, and reading generation;
- Room state, saved-reading reopen behavior, spread draw/orientation semantics;
- existing Tarot repository contracts and compatibility paths;
- deployment files, Sites/VPS/Nginx/systemd/Wrangler configuration;
- production database, production credentials, .env files, runtime state, and deployment artifacts;
- Moonlight reference assets and NaTarot visual identity;
- existing user-owned UI edits and untracked tests in the current checkout.

No product code in these zones was changed by this mission.

## Risks

| Risk | Impact | Mitigation / gate |
|---|---|---|
| Public token leaks in logs/referrers | Private reading exposure | Hash at rest, no raw token logs, strict referrer policy, opaque rotation. |
| Share projection exposes AI/private fields | Privacy and trust failure | Explicit allowlist, snapshot tests, opt-in text fields. |
| Share image outlives revocation | Persistent disclosure | Resolver gate, short/cache-versioned artifacts, purge policy. |
| Satori font mismatch or missing Vietnamese glyphs | Broken/incorrect brand output | TTF/OTF/WOFF fixture, glyph coverage and visual tests. |
| Satori WOFF2 limitation | Runtime integration failure | Convert/procure compatible font before package adoption. |
| Native renderer unavailable on edge | Production failure | Adapter boundary and Node/WASM runtime spike. |
| Browser screenshot becomes canonical by accident | Non-deterministic layout and operational cost | Keep canonical view model/SVG pipeline; use browser only for QA. |
| QR points directly to an image | No revocation/analytics/privacy control | QR always resolves /r/{opaque-token}. |
| Google Drive treated as CDN | Slow/unstable public delivery and permissions leak | Use object storage/CDN; Drive only archive/export. |
| Duplicate spread logic | Room/share visual drift | Consume shared normalized geometry contract. |
| Affiliate conversion duplicated | Overpayment and reconciliation pain | Unique provider event/order keys, transactions, race tests. |
| Refund or chargeback mutates history | Financial audit failure | Append-only negative adjustments and immutable original entries. |
| Mutable total used as ledger | Irrecoverable balance drift | Rebuildable projections from ledger. |
| Self-referral/duplicate accounts | Fraud and payout loss | Policy, review, hold, hashed signals, audit. |
| Share traffic becomes unintended affiliate traffic | Attribution disputes | Keep share and affiliate domains separate by default. |
| Overbuilt affiliate network | Unnecessary complexity | Direct referral first; tier/network expansion only after decisions. |
| License contamination | Legal and release risk | No copied reference code; dependency BOM and MPL/AGPL review. |
| Existing auth weakness reused for public trust | Account/share takeover | Separate token model; identity security mission before monetization. |

## Definition of Ready for Implementation

Implementation is ready only when all of the following are true:

### Product and policy

- Public/private share defaults and expiry are approved.
- Public fields and question/summary consent are approved.
- Noindex/embedding policy is approved.
- Affiliate attribution rule/window/overwrite/registration/repeat-purchase policy is approved.
- Tier 10/20/30 definitions and effective-date behavior are approved.
- Commission basis, hold, refund/chargeback, self-referral, duplicate-account, payout minimum/schedule/provider policies are approved.
- Share-to-affiliate separation is approved.

### Architecture

- Target branch contains or imports one reviewed semantic spread/normalized geometry contract.
- Share projection and renderer view model are versioned and allowlisted.
- Token hashing/rotation/revocation design is reviewed.
- Storage/CDN and renderer runtime owner are selected.
- Payment event envelope and idempotency keys are reviewed.
- Ledger and adjustment semantics are reviewed.
- Admin/audit boundaries are reviewed.

### Renderer evidence

- Vietnamese TTF/OTF/WOFF font fixture renders all required text.
- Satori SVG snapshots pass for 1/3/5/Celtic/10/12 layouts.
- PNG adapter output is stable under the target runtime.
- QR decodes at required output sizes and error-correction settings.
- Assets are allowlisted and do not require arbitrary network fetches.
- Renderer latency/memory/output-size budgets are recorded.

### Security and privacy evidence

- Token enumeration, replay, rotation, revocation, expiry, and rate-limit tests pass.
- Public route cannot disclose owner/private/AI/provider fields.
- XSS/SSRF/external-resource tests pass.
- Security headers and noindex behavior are tested.
- Payment webhook signature/replay/idempotency tests pass.
- Duplicate events, concurrent conversion, refund, chargeback, payout, and manual-adjustment tests pass.
- Data retention/deletion/export behavior is documented.

### Operational and legal evidence

- Dependency licenses are in the BOM and reviewed.
- MPL obligations are understood for Satori/resvg use or modifications.
- No Dub AGPL/enterprise code has entered the product.
- Artifact storage lifecycle, cache purge, queue retry, and failure alerting are defined.
- Rollback and migration plans are reviewed separately.
- Only after the above gates may migrations, packages, routes, UI, deployment, or production changes begin.

## Audit conclusion

The architecture is ready for human review, not for unreviewed implementation. The smallest safe path is a privacy-first public share projection backed by a revocable opaque token and shared normalized spread geometry, followed by a deterministic Satori/SVG/QR renderer spike. Affiliate work should remain a separate, direct-referral, payment-event-driven ledger project until the business decisions and financial controls are approved.

**NATARTOT AFFILIATE + SHARE RESEARCH COMPLETE — ARCHITECTURE READY FOR HUMAN REVIEW — PRODUCT CODE UNCHANGED.**
