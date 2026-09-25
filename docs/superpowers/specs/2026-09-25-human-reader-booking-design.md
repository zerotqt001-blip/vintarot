# Human reader booking directory design

## Goal

Redesign `/book` as a NaTarot directory for real human Tarot readers and give authorized staff a focused admin surface to maintain reader profiles and photos.

## User and product decisions

- `/book` uses the Home-style header controls and navigation state, while retaining its own page layout and Moonlight-inspired NaTarot visual language.
- Public cards show only profiles that an admin has published. Each card can show the reader's avatar, name, biography, language, timezone, session duration, price, and listed available times. Do not invent reader names, ratings, availability, or credentials.
- If there are no published profiles, show a clear empty state that explains the directory is being prepared.
- The final booking action remains disabled. The current booking API deliberately returns `503` until payment and confirmation services are connected. Selecting a reader or previewing dates must not imply a reservation.
- A separate `/admin/readers` page lets content administrators create and edit profiles, update the listed times, publish or unpublish a profile, and choose either an image upload or a Google Drive image link.
- `CONTENT_ADMIN`, `ADMIN`, and `SUPER_ADMIN` receive only the new reader-management permission for this surface. Existing admin permissions stay unchanged.
- Uploaded images are stored as binary data in the database so they persist with the current Node/SQLite deployment and remain compatible with the D1 rollback runtime. Accept JPEG, PNG, and WebP files up to 1.9 MB so each BLOB plus row metadata stays below Cloudflare D1's 2,000,000-byte row limit; reject SVG and mismatched file types. Serve uploads through a same-origin avatar endpoint.
- For a Drive image, accept common file-sharing URLs, normalize the file ID and any `resourcekey` into an image URL, and offer an admin preview. The file must be shared with anyone who has the link. If the image preview fails, do not publish the broken URL.
- Public reader APIs return only published profile fields. Admin mutations require the dedicated capability, origin validation, input validation, and an audit record.
- Keep the page available in Vietnamese and English using the existing locale provider.

## Data model

Add a `readers` table with a generated public ID, name, biography, language, timezone, session duration, price, JSON-encoded available time strings, avatar source, optional Drive URL/resource key, published flag, creator/updater IDs, and creation/update timestamps. Add a `reader_avatars` table keyed by reader ID for uploaded bytes, validated content type, byte size, and update time. A reader uses either the database avatar endpoint or normalized Drive image URL.

## API boundaries

- `GET /api/readers`: return only published profiles, in a stable order, without staff IDs or internal media bytes.
- `GET /api/readers/:id/avatar`: return uploaded image bytes only when the reader is published.
- `GET /api/admin/readers`: list all profiles for an authorized content admin.
- `GET /api/admin/readers/:id/avatar`: return an unpublished or published uploaded image only to an authorized content admin for editor preview.
- `POST /api/admin/readers`: create a draft profile.
- `PATCH /api/admin/readers/:id`: update editable fields and publish state.
- `PUT /api/admin/readers/:id/avatar`: validate and persist an uploaded image.
- `DELETE /api/admin/readers/:id/avatar`: remove the uploaded image when switching to a Drive URL.

All admin endpoints call `requirePermission(..., "admin.readers.manage", ...)`, validate the request origin, and record successful profile/media changes in the audit service. Drive URLs are parsed locally; the server does not fetch arbitrary URLs.

## Page behavior

`/book` replaces the placeholder preparation panel with a reader-led directory. A customer can inspect a reader card and open a detail/calendar view of that reader's published times and session terms. The final action states that booking is not yet open and remains disabled. The page shows the actual profile list when admins publish entries and never substitutes fabricated sample people.

The admin page contains a searchable reader list and an editor with profile fields, available-time inputs, publish state, photo-source controls, image preview, upload errors, and save state. Profile edits and photo changes are separate requests so a large image is not embedded in profile JSON.

## Non-goals

- Enabling or accepting booking requests, payments, video calls, confirmations, cancellation, or customer notifications.
- Public reader self-registration or reader-owned editing.
- Adding a new object-storage vendor or credentials.
- Adding profile reviews or testimonials.

## Acceptance

- `/book` shows the reader-focused redesign and the Home-style navigation with Book marked active.
- Only published readers appear publicly; unpublished readers remain editable in admin.
- Authorized content admins can add/edit a profile, publish/unpublish it, upload/replace/remove an avatar, or use a valid public Drive image link.
- Invalid image types, oversize images, non-Drive URLs, malformed profile data, unauthenticated calls, and calls without the reader-management capability are rejected.
- Uploaded images survive reloads and are served by same-origin URLs; private/unavailable Drive links produce a useful preview error.
- Neither the directory nor detail/calendar view suggests a booking has been reserved. The final booking button remains disabled while integrations are unavailable.
- Vietnamese and English layouts remain usable on desktop and mobile.
