# NaTarot S6 Share Persistence & Integration Design

## Status

Approved for implementation under the S6 mission authorization. This design is based on the S1–S5 checkpoint `02df5069abe6b3510dfcc8cf6b7347b49ff0c5ee` on `codex/natarot-share-s1-s5`.

## Goal

Replace the S1–S5 migration-gated share store with additive D1/SQLite persistence and connect the existing public page, SVG image route, QR renderer, analytics contract, owner create flow, and owner revoke flow to real local/test data without changing Auth, Tarot Engine, AI/Knowledge Base, Credits/VIP, SePay, Affiliate, L5–L8, deployment, or production data.

## Repository evidence

- `reading_sessions` is the canonical owner boundary. A member session stores `user_id` as `member:<id>`; a guest session stores `guest_id`; normal creation sets exactly one of them.
- `readings` stores the persisted normalized payload plus legacy compatibility columns and points to `reading_sessions` through `session_id`.
- `getSessionForOwner` and `getLatestReadingForOwner` already enforce exact user/guest ownership and are the only source boundary used by S2.
- Local Node runtime exposes a D1-shaped adapter backed by `node:sqlite`; `database.batch()` is serialized and transactional for the local adapter.
- Existing S1–S5 contracts generate 256-bit raw tokens, hash them before lookup, allowlist the public projection, render deterministic SVG, use `qrcode@1.5.4`, and make analytics best-effort.
- Current share routes are present but fail closed because `getProductionShareService()` uses `UnavailableShareStore` and an unavailable source.

## Options considered

### A. Duplicate owner/session columns on each share

This makes owner filters simple but creates a second copy of trusted ownership data. A stale or inconsistent duplicated owner would complicate revocation and public lookup. This option is rejected.

### B. Store only `reading_id` and derive session/owner by join

This keeps one canonical ownership source, prevents orphan shares with a foreign key, and lets the store enforce owner checks in the insert/update predicates. It requires a join for lookup and revoke, which is small and already matches the repository model. This is the selected option.

### C. Reuse `records` as a share table

The existing records table is a user-owned marker store, not a public-token relation. Reusing it would weaken foreign-key and lifecycle clarity and mix unrelated journal semantics. This option is rejected.

## Data model

### `reading_shares`

The table is additive and references `readings(id)` with `ON DELETE CASCADE`. Deleting a share can never delete its parent reading because the foreign key direction is from share to reading.

| Column | Type | Rules |
|---|---|---|
| `id` | text | internal opaque share record ID; primary key; never returned to public clients |
| `reading_id` | text | required foreign key to `readings.id`; session and owner are derived through `readings.session_id` |
| `token_hash` | text | required SHA-256 hex digest; unique; raw token is never stored |
| `status` | text | required `active`, `revoked`, or `expired` value |
| `locale` | text | required `en` or `vi` snapshot used by the S1–S5 projection contract |
| `projection_version` | text | required S2 projection version |
| `geometry_version` | text | required normalized geometry version |
| `renderer_version` | text | required S3 renderer version |
| `created_at` | integer | required epoch milliseconds |
| `updated_at` | integer | required epoch milliseconds |
| `revoked_at` | integer | nullable epoch milliseconds |
| `expires_at` | integer | nullable epoch milliseconds; S6 creates non-expiring shares because no product expiry policy exists |

Constraints and indexes:

- primary key on `id`;
- unique index on `token_hash`;
- partial unique index on `reading_id` where `status = 'active'`, giving one active share per reading while allowing a future re-share after revocation/expiry;
- lookup index on `(reading_id, status)`;
- checks for the supported status values, locale values, and 64-character token hashes;
- foreign key to `readings(id)` with `ON DELETE CASCADE`.

The partial unique index is the database idempotency boundary. Two concurrent creates for one reading cannot produce two active shares. The first request succeeds; the losing request receives a safe `share_already_exists` conflict. Because only the hash is persisted, S6 deliberately does not pretend it can recover and re-return an earlier raw token after a lost response.

### `share_events`

The table persists only the existing S5 allowlist. `id` is the client-provided UUID event ID and is the idempotency key.

| Column | Type | Rules |
|---|---|---|
| `id` | text | primary key; unique event ID |
| `share_id` | text | required foreign key to `reading_shares.id` with `ON DELETE CASCADE` |
| `event_name` | text | existing five-event allowlist only |
| `locale` | text | required `en` or `vi` |
| `source` | text | nullable existing bounded source label |
| `renderer_version` | text | nullable existing bounded version |
| `created_at` | integer | server timestamp; client timestamp is ignored |

An index on `(share_id, event_name, created_at)` supports bounded operational inspection. No question, reading text, card payload, provider data, owner ID, email, cookie, IP address, user-agent fingerprint, query string, raw token, or token hash is stored in events.

## Persistence boundary

`DatabaseShareStore` will implement the existing `ShareStore` interface next to `InMemoryShareStore` and `UnavailableShareStore`.

- `create` uses an `INSERT ... SELECT` guarded by the requested `reading_id`, `session_id`, and trusted owner predicate. A zero-row insert becomes a safe ownership/not-found failure. SQLite/D1 constraint errors are classified as token/record-ID collision or active-reading conflict.
- `findByTokenHash` looks up only the hash and joins `readings` and `reading_sessions` to reconstruct the `ShareRecord` owner/session. It requires exactly one owner identity and returns `null` for malformed relational state.
- `revoke` updates only an active, non-expired share whose joined session owner matches the trusted owner. It changes `status`, `revoked_at`, and `updated_at`; it never touches the reading.
- `insertEvent` uses `INSERT ... ON CONFLICT(id) DO NOTHING` and reports whether the event was inserted. The operation never stores a token value and is safe to repeat.

The in-memory store will mirror one-active-share, token uniqueness, event idempotency, and owner checks so service tests exercise the same contract. The production runtime will never fall back to it.

## Service and route integration

`getProductionShareService()` will construct the database-backed store, the existing owner-scoped database reading source, and the trusted configured public origin. If the database is missing the S6 migration or otherwise unavailable, route behavior remains fail-closed with the existing safe 503 response.

`ShareService` changes:

- `createShare` loads the canonical owner-scoped snapshot first, retries bounded token/record-ID collisions, creates one active share, and records `share_created` best-effort. Analytics failure cannot prevent a valid share URL from being returned.
- `resolvePublicShare` retains strict token validation, hash-only lookup, the single active/expiry predicate, the existing source boundary, and the existing allowlisted projection.
- `revokeShareByToken` hashes the presented token, derives the share record through the store, and revokes only when the trusted current owner matches. It does not require clients to know the internal share ID.
- event recording remains best-effort and non-enumerating; duplicate event IDs return an accepted duplicate result without creating another row.

Routes:

- `POST /api/tarot/shares` becomes a real owner-scoped create route. It continues to use `originCheck`, `identity`, strict body validation, and a minimal response containing the public URL, image URL, and creation time. Ownership/not-found, already-existing, unavailable, and unexpected failures have distinct safe status mappings without echoing IDs.
- `DELETE /api/tarot/shares/{token}` adds the owner revoke flow. It uses the existing identity and origin boundary, returns an empty success response for both an already-revoked/unknown/non-owned share and a successful revoke, and returns only a safe 503 for storage failure.
- `/r/{token}` and `/r/{token}/image.svg` keep the current invalid/unknown/revoked/expired fail-closed behavior, privacy headers, noindex metadata, trusted origin and deterministic renderer/QR path, but now resolve persisted active records.
- the existing event route keeps its strict schema and 202 non-enumerating response. Persistence errors are swallowed at the analytics boundary.

The existing public `Copy link` and `Save image` controls remain unchanged; once the persisted service resolves, they operate on the real public URL and image route. A minimal Room reading-panel share action will call the owner create endpoint and expose the returned public link without redesigning the reading surface or persisting the raw token in room state. Owner revoke is provided by the API boundary and covered by the local flow tests.

## Active-share and expiry semantics

The authoritative active predicate is `status === "active" && (expiresAt === null || expiresAt > now)`. S6-created shares have `expires_at = NULL`. Existing/future rows with an expiry are rejected server-side after the timestamp, regardless of UI state. Revoked and expired rows never produce a public projection or image.

## Transaction and concurrency guarantees

- The database enforces token-hash uniqueness and one active share per reading. Service retries only the collision classes that are safe to retry.
- Share creation is independent from `share_created` analytics so analytics failure cannot invalidate a valid public share. Local D1 batches remain available for future multi-statement operations; S6 does not claim stronger distributed locking than D1/SQLite provides.
- Event insertion is idempotent by primary-key event ID. `ON CONFLICT DO NOTHING` handles duplicate browser retries.
- A revoke racing a lookup may allow the lookup already past its database read to finish, but every later lookup fails closed. No immutable public cache is introduced; headers stay `private, no-store`.
- Parent deletion cascades to share rows and events, while share revocation only updates the share row.

## Security and privacy boundaries

- The raw token exists only in the create response/client URL and presented request path. It is not persisted or logged.
- Owner authorization derives from the current request identity and the canonical reading session, never request-supplied owner/email/guest values.
- Cross-member and cross-guest create/revoke attempts fail without revealing a private reading or share's existence.
- Public output continues to use the S1–S5 allowlist and compatibility parser; owner/account/session IDs, optional context, prompt/provider/KB data, private metadata and follow-up suggestions remain absent.
- React text and SVG escaping, local artwork allowlisting, trusted `NATAROT_PUBLIC_ORIGIN`, `noindex,nofollow`, `no-referrer`, `no-store`, and safe Host handling remain in force.
- Rate limiting and analytics retention/consent remain explicitly deferred operational decisions; S6 adds no new limiter or permanent retention policy.

## Verification plan

Focused tests will cover migration/schema constraints, existing-data preservation, local `DatabaseShareStore`, member and guest ownership isolation, active-share idempotency/concurrency, token collision classification, raw-token absence, revocation/expiry, public projection privacy, event idempotency/best-effort behavior, route status/headers, image/QR output, and hostile content escaping. A deterministic local E2E fixture will create a real reading, persist a share, resolve the page/image/event path, revoke it, and confirm the old page/image fail closed.

The full tracked suite, TypeScript, production build, targeted lint, `git diff --check`, migration/schema inspection, and secret scans are required. Browser QA will use an isolated local SQLite database only at desktop, 390px, and 375px widths and will verify English/Vietnamese public output, no horizontal overflow, image/QR visibility, and the revoked state. Production migration, restart, deployment, merge, and secret changes are prohibited.

## Explicit non-goals

No Auth semantic change, guest identity redesign, Tarot draw/reading/AI/KB change, L5–L8 integration, credits/VIP/payment/SePay/affiliate work, raw-token recovery, PNG/native image stack, CDN cache invalidation promise, rate-limiter platform, analytics retention policy, final UI redesign, merge, deployment, or production database operation is part of S6.
