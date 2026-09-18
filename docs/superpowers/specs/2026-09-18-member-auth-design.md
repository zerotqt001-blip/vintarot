# NaTarot Member Authentication Design

**Date:** 2026-09-18
**Status:** Proposed for user review

## Goal

Add a first-party member account system to NaTarot so a visitor can register with an email address, username, phone number and password, sign in with either email/username or Google, receive verification and password-reset emails from Resend, and use member-owned rooms and journal records without ChatGPT sign-in.

## Confirmed product decisions

- ChatGPT sign-in is removed from the product flow and is not a fallback identity source.
- A local registration requires:
  - email address;
  - username;
  - phone number;
  - password.
- Username login accepts either the normalized username or normalized email address.
- Username is unique and case-insensitive. The first implementation accepts `a-z`, `0-9` and `_`, with 3–24 characters; the value is stored lowercase. A separate display name remains available for friendly profile copy.
- Phone number is collected for customer care, is not used for login or SMS/OTP in this slice, is not required to be unique, and is not displayed publicly.
- Email verification is required before a password account can sign in. Password recovery is sent to email, not phone.
- Google sign-in uses Google OAuth/OIDC with the `openid email profile` scopes. A first-time Google user must choose a unique username and enter a phone number before the member session is created. Google’s verified email satisfies the email-verification requirement.
- A Google identity matching an existing member’s verified email may be linked to that member; otherwise the flow creates a new member after the username/phone completion step.
- Visitors without a member session remain guests. Existing guest data is not automatically claimed by a new member and no existing records are deleted.
- The verified Resend domain and the least-privilege `RESEND_API_KEY` already exist on the VPS. The sender defaults to `NaTarot <noreply@natarot.com>`; a mailbox is not required for outbound mail.

## Architecture

### Identity and ownership

`readRequestIdentity()` will resolve identities in this order:

1. a valid `natarot_session` HttpOnly cookie linked to an active member;
2. a guest cookie created by the existing guest flow.

ChatGPT headers and `getChatGPTUser()` will no longer participate in identity resolution or appear in sign-in UI. A member identity will expose a stable owner key of `member:<member-id>` to the existing `rooms` and `records` tables, while guests retain their current `guest:<guest-id>` owner keys.

### Database

Migration `0004_member_auth.sql` will add portable D1/SQLite tables:

- `members`: member id, normalized username, normalized email, E.164 phone, optional display name, versioned password hash, optional Google subject, email verification timestamp, created/updated/last-login timestamps and disabled flag. Username and email are unique; phone is indexed but not unique.
- `auth_sessions`: hashed opaque session token, member id, creation/expiry/last-seen timestamps and revocation timestamp. The raw token is only held in the browser cookie.
- `auth_tokens`: hashed single-use email-verification, password-reset and Google-completion tokens, optional member id/payload, creation/expiry timestamps and consumed timestamp.
- `oauth_states`: hashed OAuth state, PKCE verifier, safe return path, creation/expiry timestamps and consumed timestamp.
- indexes covering member lookup, session lookup, token kind/expiry and OAuth state lookup.

All timestamps are integer milliseconds, all member foreign keys use `ON DELETE CASCADE`, and migrations must remain valid for both the existing SQLite adapter and Cloudflare D1 SQL.

### Password and session security

- Passwords are never stored or logged in plaintext. The portable implementation uses versioned PBKDF2-HMAC-SHA-256 with a per-password random salt and 600,000 iterations, encoded with the algorithm and cost so the work factor can be upgraded on a later login. The work factor follows the current OWASP guidance; the implementation must benchmark the VPS and keep one verification below the service’s practical latency budget. See [OWASP Password Storage](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html).
- Password input is limited to a reasonable maximum to prevent hashing denial-of-service payloads; the initial policy is 10–128 characters and does not require forced symbol patterns.
- Sessions use cryptographically random opaque tokens. Only a SHA-256 token digest is stored in the database. The cookie is `HttpOnly`, `SameSite=Lax`, `Path=/`, `Secure` on HTTPS, and expires 30 days after issue; logging in again creates a fresh session token.
- Password reset and verification links contain random single-use tokens; only token digests are stored, links expire, and consumption is atomic. A successful password reset revokes all existing sessions for that member.
- POST auth routes use the existing origin check. Login and password-reset responses avoid revealing whether an email or username exists. Login/reset/register attempts have bounded rate limits keyed by normalized identifier and forwarded client address so the single VPS cannot be trivially spammed.
- No Google access or refresh tokens are persisted. The server exchanges the authorization code, obtains the verified identity, links/creates the member, and discards provider tokens.

## HTTP/API surface

All routes use the existing `boundary`, `json`, `originCheck`, database adapter and consistent JSON error shape.

- `POST /api/auth/register`: validate email, username, E.164 phone and password; create an unverified member; issue a verification email; return a generic success response.
- `GET /api/auth/verify?token=...`: consume a valid email-verification token and redirect to the auth screen with a localized success state.
- `POST /api/auth/login`: accept `identifier` plus password; allow normalized email or username; require verified/non-disabled member; issue/rotate a member session cookie.
- `POST /api/auth/logout`: revoke the current session and clear the cookie.
- `GET /api/auth/me`: return the minimal current-member profile for client UI, or `401` without a member session.
- `POST /api/auth/password-reset/request`: accept email or username, always return a generic response, and send a time-limited reset email when a matching member exists.
- `POST /api/auth/password-reset/confirm`: validate the single-use token and new password, update the hash, revoke old sessions, and issue no automatic session.
- `GET /api/auth/google/start`: validate a safe return path, create state/PKCE data, and redirect to Google with `openid email profile` only. Production uses `https://natarot.com/api/auth/google/callback`; the redirect URI is configurable for local development.
- `GET /api/auth/google/callback`: validate/consume state, exchange the code, verify the Google subject/email/email_verified response, link an existing member or issue a short-lived completion token.
- `POST /api/auth/google/complete`: accept the Google completion token, username and phone, create/link the member atomically, and issue the member session cookie.

The callback and email links only honor relative local return paths; external URLs are rejected.

## Email delivery

`lib/auth-email.ts` will wrap the Resend HTTP API with injectable `fetch` and environment dependencies so tests never use the live key. It will send:

- a bilingual verification message containing a one-time `/api/auth/verify` link;
- a bilingual password-reset message containing a one-time `/auth/reset?token=...` link.

The sender uses `RESEND_API_KEY` from the existing VPS secret file and `NATAROT_EMAIL_FROM` when configured, otherwise `NaTarot <noreply@natarot.com>`. API failures are logged only as safe status/error metadata; tokens, API keys, passwords and phone numbers are never logged.

Google configuration is kept outside Git and will be supplied separately as:

```text
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
GOOGLE_REDIRECT_URI=https://natarot.com/api/auth/google/callback
```

Google’s web-server flow requires a registered Web OAuth client and exact authorized redirect URI; production must use the HTTPS domain. See [Google OAuth for Web Server Applications](https://developers.google.com/identity/protocols/oauth2/web-server) and [Google OAuth policy](https://developers.google.com/identity/protocols/oauth2/policies).

## UI and navigation

- Add `/auth` with localized login, registration, verification-pending, forgot-password and reset-password states.
- Add `/auth/complete` for the first Google sign-in’s username/phone completion step.
- Provide a visible “Đăng nhập bằng Google / Sign in with Google” action alongside the email/password form.
- Replace the current ChatGPT sign-in links and empty-state copy with member-auth links. The existing profile/avatar navigation remains, but it points to `/auth` for guests and the member profile for authenticated users.
- Preserve the NaTarot Moonlight/cosmic visual language and existing English/Vietnamese translation system; add all auth labels, errors and email copy to the locale dictionary.
- Do not display phone numbers or password/account tokens in public profile, room invite, journal or card screens.

## File boundaries

Expected implementation units:

- `drizzle/0004_member_auth.sql`: schema migration only.
- `lib/member-auth.ts`: normalization, password hashing/verification, token/session primitives and member lookup.
- `lib/auth-email.ts`: Resend message construction and delivery boundary.
- `lib/request-identity.ts`: member-session-first identity resolution and cookie attachment.
- `app/api/auth/*/route.ts`: thin route handlers for the API surface above.
- `app/auth/page.tsx`, `app/auth/auth.tsx`, `app/auth/complete/page.tsx`: auth screens and client interactions.
- `app/[section]/page.tsx`, `app/page.tsx`, `app/create/page.tsx`, `app/room/page.tsx`, profile/navigation components and `lib/i18n.ts`: member-aware shell and copy; remove ChatGPT sign-in UI/imports.
- Focused auth tests plus migration, identity and API contract coverage. No unrelated tarot, room, or visual refactor is part of this feature.

## Testing and acceptance criteria

The implementation is test-first. Before production deployment it must demonstrate:

1. Username/email/phone/password validation and normalization, including duplicate username/email rejection and invalid phone rejection.
2. Password hashes are salted/versioned, never equal to the input, verify correctly, and reject wrong passwords.
3. Registration creates an unverified member and a single-use expiry-bound verification token without leaking account existence.
4. Verified member login succeeds by email and username, sets a secure session, and member identity owns rooms/journal records.
5. Logout, expiry and password reset revoke sessions as specified; reset/verification tokens cannot be reused.
6. Google state/PKCE validation rejects replay, wrong state, expired state and unverified Google email; first-time completion requires unique username and phone.
7. Resend requests contain the configured sender, recipient, subject and link without logging or exposing secrets; network failures produce safe user-facing errors.
8. Guest room/journal behavior still works without a member cookie, while ChatGPT sign-in is absent from the UI and identity resolution.
9. Focused tests, the tracked regression suite, TypeScript, production build and `git diff --check` pass before deployment. VPS smoke tests confirm the service restarts with the new migration and `https://natarot.com` remains healthy.

## Out of scope for this slice

- SMS/OTP, phone verification and phone-based login.
- Social providers other than Google.
- Automatic migration/claiming of old guest records.
- Account deletion, support-admin impersonation, subscriptions, payment and marketing opt-ins.
- Public exposure of member contact data.
