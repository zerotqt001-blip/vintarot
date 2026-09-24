# Human Reader Booking Directory Implementation Plan

> **For agentic workers:** Execute this plan inline in the current workspace. Preserve the user's existing uncommitted changes and stage only files and hunks created for this feature.

**Goal:** Build a public human-reader directory at `/book` and an authorized admin editor for profile details, availability, and photos.

**Architecture:** Use dedicated `readers` and `reader_avatars` tables, public read-only API projections, and admin APIs guarded by a single reader-management capability. Store uploads as validated database blobs for SQLite/D1 portability; normalize public Google Drive file links in the browser-facing image URL without server-side fetching. Keep the final booking action disabled until booking integrations exist.

**Tech Stack:** Next/Vinext App Router, React, TypeScript, SQLite/D1, raw SQL migrations, existing admin permission and audit services, existing NaTarot design tokens and locale provider.

**Spec:** `docs/superpowers/specs/2026-09-25-human-reader-booking-design.md`

## Global Constraints

- Preserve the Moonlight-inspired NaTarot visual language and reuse the Home toolbar behavior on `/book`.
- Return only published profile fields from public endpoints.
- Require `admin.readers.manage` for all reader-management APIs.
- Limit uploaded avatars to JPEG, PNG, or WebP and 1.9 MB to stay below D1's 2,000,000-byte row limit after metadata; reject SVG and verify file signatures.
- Do not accept, confirm, or imply a booking while the existing booking endpoint remains unavailable.
- Keep all customer-facing directory and admin copy localized in Vietnamese and English.
- Do not alter or include the current uncommitted reading-result and project-state changes in feature commits.
- Do not add or run tests unless the user asks for testing or verification; use typecheck/build and focused browser review as available.

---

### Task 1: Reader storage and protected APIs

**Files:**
- Modify: `db/schema.ts`
- Create: `drizzle/0009_human_readers.sql`
- Modify: `lib/admin/permissions.ts`
- Create: `lib/admin/readers.ts`
- Create: `lib/google-drive-image.ts`
- Create: `app/api/readers/route.ts`
- Create: `app/api/readers/[id]/avatar/route.ts`
- Create: `app/api/admin/readers/route.ts`
- Create: `app/api/admin/readers/[id]/route.ts`
- Create: `app/api/admin/readers/[id]/avatar/route.ts`
- Modify: `app/admin/page.tsx`

**Interfaces:**
- Public `GET /api/readers` returns `{ items: ReaderPublic[] }` for published readers only.
- `ReaderPublic` contains `id`, `name`, `bio`, `timezone`, `language`, `duration`, `price`, `slots`, `avatarUrl`, and `published`.
- Admin JSON requests use a validated profile payload and include an audit `reason` plus an `idempotency_key`.
- Admin avatar upload uses multipart field `file`; `DELETE` with an audit reason and idempotency key removes the stored upload when switching to a Drive URL.

- [x] Add schema definitions and the additive SQL migration for reader profiles and avatar blobs. Use integer booleans, JSON text for slots, foreign key media ownership, and timestamps in milliseconds.
- [x] Add `admin.readers.manage` to the permission union/matrix for `CONTENT_ADMIN`, `ADMIN`, and `SUPER_ADMIN` only.
- [x] Add a Drive URL normalizer that accepts supported Drive file-share URL forms, preserves `resourcekey`, rejects other hosts, and returns `null` for malformed IDs.
- [x] Implement an admin service that lists, creates, and patches reader profiles; validates names, biography, price, language, IANA timezone, duration, and ISO slots; and appends audit events for each mutation.
- [x] Implement a public list endpoint that projects only published fields and emits `/api/readers/:id/avatar` for uploaded photos or a normalized Drive URL. The public avatar endpoint rejects unpublished reader IDs.
- [x] Implement admin create/list/update endpoints with origin checks, no-store responses, strict permission checks, payload bounds, and non-enumerating not-found responses.
- [x] Implement avatar upload/removal endpoints with multipart size checks before buffering, MIME allowlist, byte-signature verification, max 1.9 MB, and database persistence. Add a protected admin GET for editing hidden-profile previews; return public images with `X-Content-Type-Options: nosniff`.
- [x] Run `npx tsc --noEmit` after API/type changes; do not add or run tests. The command reports only the existing `/s` regular-expression flag errors in `tests/mobile-navigation.test.ts:63–64`.

### Task 2: Admin reader editor

**Files:**
- Create: `app/admin/readers/page.tsx`
- Create: `app/admin/readers/reader-manager.tsx`
- Create: `app/admin/readers/readers.module.css`
- Modify: `app/vintarot.tsx` for route-shell styling only if needed.
- Modify: `app/admin/page.tsx` to route reader-only content admins to `/admin/readers` and expose an authorized shortcut to other admins.

**Interfaces:**
- `ReaderManager` consumes `/api/admin/readers` and sends profile payloads to the admin reader APIs.
- The page is a focused route; failed API authorization renders the existing sign-in/forbidden state and never leaks reader drafts. The `/admin` entry point routes `CONTENT_ADMIN` users to this editor without invoking unrelated console APIs.

- [x] Build a responsive reader list and editor with name, bio, language, timezone, session duration, price, available-time entries, and publish toggle.
- [x] Add photo controls with two explicit sources: upload a JPEG/PNG/WebP file or paste a public Google Drive file link.
- [x] Show a local preview for uploads and a normalized preview for Drive links; surface decode/load failures before save.
- [x] Use a save reason and fresh idempotency key for audited changes; preserve form values and show API validation errors.
- [x] Show uploaded-image size/type limits in the form and prevent oversized files before submission.
- [x] Keep the route separate from the broad Admin Console so `CONTENT_ADMIN` does not need unrelated user, billing, or affiliate permissions.
- [ ] Review the editor at desktop and mobile widths in the browser.

### Task 3: Public `/book` experience and Home toolbar parity

**Files:**
- Modify: `app/pages.tsx`
- Modify: `app/vintarot.tsx`
- Create: `app/booking.module.css`
- Modify: `lib/i18n.ts`

**Interfaces:**
- `Book` loads `GET /api/readers`, handles loading/error/empty states, and renders published reader cards.
- Reader detail uses the selected public profile and never creates a booking record.

- [x] Replace the generic empty preparation panel with a reader-led heading, trust copy, and responsive profile-card grid.
- [x] Load only the public directory API and render real avatar, biography, language, timezone, duration, price, and published slots without ratings or sample readers.
- [x] Add a selected-reader detail/calendar view; display the closed-booking message and keep the final action disabled.
- [x] Add loading, broken-avatar, no-reader, fetch-error, and no-available-times states.
- [x] Give `/book` the Home-style header nav, actions, active Book state, and appropriate mobile behavior while keeping its page shell distinct from Home's parallax scene.
- [x] Add responsive styles using the existing midnight navy, antique gold, ivory, and Moonlight visual language.
- [x] Add Vietnamese and English copy for every new public/admin page state.
- [x] Run `npx tsc --noEmit`; it reports only the existing `/s` regular-expression flag errors in `tests/mobile-navigation.test.ts:63–64`. Run `npm run build` successfully. Do not run tests.
- [x] Inspect `/book` in the browser at desktop width using an isolated temporary D1 database; confirm the Home-style navigation and empty directory state.
- [ ] Inspect authenticated `/admin/readers` and `/book` at desktop and mobile widths in the browser.

### Task 4: Project state and release record

**Files:**
- Modify: `docs/PROJECT_STATE.md`

- [x] Append the feature outcome, permission/data/image-storage decisions, verification actually completed, booking integration limitation, and deployment status.
- [ ] Stage only this feature's hunks and files. Inspect `git diff --cached` for unrelated user changes or secrets before committing.
- [ ] Commit the completed feature on the current `codex/` branch with a clear message.
- [ ] Since `origin` is configured, push the feature commit and verify the remote ref; report any push failure. Do not deploy to production.
