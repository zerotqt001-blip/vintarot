# NaTarot S1–S5 Share System Implementation Plan

## Goal

Implement the independent NaTarot public Share foundation on `codex/natarot-share-s1-s5`: secure opaque share identity, allowlisted public projection, a responsive `/r/[token]` shell, deterministic SVG share image, QR support, and privacy-conscious analytics contracts. Keep production persistence migration-gated and fail closed.

## Architecture

```text
ReadingShareSource + ReadingOwner
  -> ShareService
     -> ShareStore (unavailable production adapter; in-memory test adapter)
     -> PublicReadingProjection
     -> ShareImageRenderer (hand-authored SVG)
     -> QR adapter (node-qrcode SVG)
     -> Analytics sink (strict/idempotent)
```

The service owns token generation, SHA-256 lookup, status/expiry checks, public allowlisting, canonical origin selection and event validation. DB-specific loading stays behind a source/store seam. The public page never imports private Room state or auth UI.

## Tech stack

- Existing React/Next/Vinext app, TypeScript, Zod and existing spread geometry.
- Web Crypto `getRandomValues`/`subtle.digest` for cross-runtime S1 identity.
- `qrcode@1.5.4` with `@types/qrcode@1.5.6` for server-side QR SVG only.
- Existing local NaTarot assets; no Satori, resvg, browser screenshot, Drive or native image dependency.

## Spec / global constraints

- No migration file, migration generation/application, Auth change, Tarot Engine change, L5–L8 change, credits/payment/affiliate/deployment change or merge.
- Never expose raw token, owner/member/guest IDs, reading/session IDs, provider/model/prompt/diagnostic data, cookies, email or private Room data in public output or analytics.
- Never derive public origin from `Host`; use `NATAROT_PUBLIC_ORIGIN` or fixed `https://natarot.com`.
- Invalid, revoked and expired public tokens share the same public not-found outcome; unavailable persistence is a safe 503 state.
- Use TDD: write a failing focused test, verify failure, implement the smallest contract, verify pass, then refactor.
- Run focused tests after each slice, flush task-observer checkpoint after three completed slices and at deliverable/commit events.

## Implementation steps

### Step 1 — Add the researched dependency and test scaffolding

Files: `package.json`, `package-lock.json`, `tests/tarot-share.test.ts`.

1. Add `qrcode@1.5.4` and `@types/qrcode@1.5.6` only.
2. Add an initial failing test import for the S1 token contract and confirm it fails because the module does not exist.
3. Record package/license/transitive decision in the design spec.

### Step 2 — S1 token, lifecycle and origin contracts

Files: `lib/tarot-share-identity.ts`, `lib/tarot-share-config.ts`, `tests/tarot-share.test.ts`.

Implement exact signatures:

- `generateShareToken(): Promise<string>` — 32 Web Crypto random bytes, unpadded base64url, exact 43-character token.
- `isShareToken(value: unknown): value is string` and `hashShareToken(token: string): Promise<string>` — strict format plus SHA-256 hex.
- `resolvePublicOrigin(env?: { NATAROT_PUBLIC_ORIGIN?: string }): string` — validate http/https configured origin, otherwise fixed `https://natarot.com`; never inspect request Host.
- `buildPublicShareUrl(token, origin?)` and `buildShareImageUrl(token, origin?)` — canonical `/r/{token}` paths.
- `ShareRecord`, `ShareStatus`, `ShareEventName` and bounded input schemas.

Tests: entropy/format, digest stability, malformed token rejection, origin override/trailing slash/invalid fallback, lifecycle expiration and no internal identifier in generated URL.

### Step 3 — Public projection and source boundary

Files: `lib/tarot-share-projection.ts`, `lib/tarot-share-source.ts`, `tests/tarot-share.test.ts`.

Implement:

- `ShareableReadingSnapshot` and `ReadingShareSource` interfaces.
- `buildShareableReadingSnapshot({ database, repository, owner, readingId, sessionId })` using the existing owner-scoped repository, `parseStoredReading`, localized template positions and normalized geometry; reject mismatched/incomplete/historical-invalid rows safely.
- `projectPublicReading({ record, snapshot, origin })` with explicit field allowlist, bounded text, approved local `/cards/*.webp` images, and no IDs/provider/private context.

Tests: user/guest owner boundary through the source seam, historical payload compatibility, optional-array omission, 1/3/10/12 geometry, field exclusion and invalid image rejection.

### Step 4 — Share service and migration-gated adapters

Files: `lib/tarot-share-service.ts`, `lib/tarot-share-store.ts`, `tests/tarot-share.test.ts`.

Implement:

- `ShareStore` methods for create/find/revoke/event insert, with the future database adapter shape documented but not implemented.
- `InMemoryShareStore` for isolated tests only; it is not imported by production routes.
- `UnavailableShareStore` that throws `ShareStorageUnavailableError` for runtime fail-closed behavior.
- `ShareService.createShare`, `.resolvePublicShare`, `.revokeShare`, `.recordEvent`; hash token before lookup, compare status/expiry, avoid enumeration and make event IDs idempotent.

Tests: create returns raw token only once, store has only hash, resolve/revoke/expiry behavior, owner mismatch, event allowlist/idempotency and analytics exclusion of sensitive fields.

### Step 5 — S3 deterministic SVG renderer

Files: `lib/tarot-share-image.ts`, `tests/tarot-share-image.test.ts`.

Implement exact boundary:

- `renderShareImage(view: PublicReadingView, options?: { qrSvg?: string }): ShareImageRenderResult`.
- 1200×800 SVG; fixed NaTarot colors; XML escaping; bounded line wrapping; local approved image references; normalized geometry via existing resolver; one/three/medium/Celtic Cross 10/future 12 generic fallback.
- Add QR panel using an injected SVG string so renderer tests stay deterministic and do not depend on QR library internals.

Tests: deterministic byte output for the same model, EN/VI text, escaped question/content, no `<script>`/external arbitrary URL/internal IDs, all supported card counts inside bounds, renderer metadata and output dimensions.

### Step 6 — S4 QR adapter

Files: `lib/tarot-share-qr.ts`, `tests/tarot-share-qr.test.ts`.

Implement:

- `generateShareQrSvg(token, options?): Promise<string>` using `qrcode` `toString` with `type: "svg"`, error correction `M`, `margin: 4`, dark `#10283b`, light `#f4ebdd`, fixed width.
- `buildShareQrPayload(token, origin?)` delegates to trusted canonical URL.

Tests: exact payload equality, deterministic QR output, quiet-zone/options assertions, malformed token rejection, no Host-derived URL.

### Step 7 — S2/S5 routes and public shell

Files: `app/r/[token]/page.tsx`, `app/r/[token]/public-share.tsx`, `app/r/[token]/share-loading.tsx` if needed, `app/r/[token]/share-error.tsx`, `app/r/[token]/image.svg/route.ts`, `app/api/tarot/shares/route.ts`, `app/api/tarot/shares/[token]/events/route.ts`, `tests/tarot-share-routes.test.ts`, `app/globals.css`.

Implement:

- Public page metadata with generic NaTarot title/description, `noindex,nofollow`, canonical share-image URL only through trusted origin, and route headers `X-Robots-Tag`, `Referrer-Policy`, conservative cache policy.
- Runtime routes use only the unavailable production store until migration; no fixture or in-memory fallback is reachable from the app.
- A complete public shell for an injected future `PublicReadingView`: cards/alt text, answer-first reading, native disclosure for evidence/support, Copy Link, Save Image, CTA with bounded `source=share`, EN/VI labels, error/loading and responsive Moonlight/NaTarot styling.
- Owner create route parses `{ reading_id, session_id }`, checks origin/identity boundary before service invocation, and returns safe 503 while persistence is unavailable; no raw IDs are reflected in public output.
- Analytics route validates only the strict event contract, hashes the token, and returns safe idempotent responses without collecting IP/cookie/query payload.

Tests: route status/header contracts, generic metadata/noindex, unavailable state, event validation and absence of private data in response/source.

### Step 8 — Documentation, verification and review

Files: `docs/PROJECT_STATE.md`, spec/plan as needed.

1. Add decision/validation/unfinished-work entry to `docs/PROJECT_STATE.md` without claiming production persistence or deployment.
2. Run focused share tests, full `npx tsx --test tests/*.test.ts`, `npx tsc --noEmit`, `npm run build`, targeted lint for changed files, `git diff --check`, secret/migration scans, and image/SVG/QR checks.
3. Perform an inline code-review pass against the mission/addendum, fix findings, and rerun affected verification.
4. Inspect staged diff for secrets and unrelated files, commit related work with clear messages, push `codex/natarot-share-s1-s5`, then verify local `HEAD` equals `origin/codex/natarot-share-s1-s5`.
5. Report one consolidated final result with the required S1–S5 and `## EXTERNAL RESEARCH` sections, including explicit migration-gated/browser-QA limits.

## Self-review checklist

- [x] Addendum research loop is documented before implementation.
- [x] Selected dependency is justified and license-reviewed.
- [x] No production DB bypass is planned.
- [x] Existing geometry/reading compatibility is reused.
- [x] Renderer receives a sanitized projection, not a database row.
- [x] Public headers/origin/token/privacy constraints are testable.
- [x] Implementation, focused tests, full verification and browser fallback checks are complete; commit and remote equality are the remaining handoff steps.
