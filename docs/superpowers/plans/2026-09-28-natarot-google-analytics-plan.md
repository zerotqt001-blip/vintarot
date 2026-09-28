# NaTarot Google Analytics 4 Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Connect `https://natarot.com` to a dedicated GA4 property with clear opt-in and privacy-safe page measurement.

**Architecture:** Create a separate GA account/property and inject its public Measurement ID through build configuration. A root client provider owns the consent banner, loads `gtag.js` only after acceptance, and sends sanitized SPA page views; small pure helpers redact routes and referrers. The bilingual Privacy Policy explains the data and lets visitors reopen their choice.

**Tech Stack:** TypeScript, React 19, Next 16 / Vinext, `localStorage`, Google tag (`gtag.js`); no new package.

**Spec:** `docs/superpowers/specs/2026-09-28-natarot-google-analytics-design.md`

## Global Constraints

- Use a separate Google Analytics account named `NaTarot`, a GA4 property named `NaTarot Website`, and a web stream for `https://natarot.com`.
- Set the property time zone to `Asia/Ho_Chi_Minh` and currency to `VND`; keep optional sharing, Google Signals, advertising personalization, and enhanced measurement off.
- Do not load the Google tag or send measurement requests before the visitor accepts analytics.
- Persist only `accepted` or `rejected` in browser storage; with no valid Measurement ID, render neither the tag nor the consent UI.
- Send allowlisted route templates, sanitized referrers, and a fixed `NaTarot` page title; omit query strings and fragments.
- Never send Tarot questions/context, cards, readings, journal notes, share tokens, email, member/session IDs, or other account data.
- Do not add Google Tag Manager, Ads integrations, conversion events, user IDs, or custom product-interaction events.
- Preserve the existing Moonlight/NaTarot visual language and the English/Vietnamese choice.
- Use `NEXT_PUBLIC_GA_MEASUREMENT_ID`; `.env.local` is ignored and must never be staged or printed.
- If Google presents a legally binding agreement, stop and ask the owner to accept it personally.
- Before code edits, create an isolated worktree from `codex/google-analytics-natarot` using the `using-git-worktrees` skill.
- Production deployment is a separate final owner approval; this plan ends with a source-only release candidate.

---

## File map

- `lib/analytics-tracking.ts` — Measurement ID validation, allowlisted route sanitization, and referrer sanitization.
- `components/analytics/analytics-provider.tsx` — Consent state/UI, controlled tag loading, SPA page views, revocation, and the Privacy page preferences control.
- `app/layout.tsx` — Mount the provider once around the site.
- `app/legal-page.tsx` — Show the preferences control only on the Privacy page.
- `lib/legal-content.ts` — Add the bilingual Analytics disclosure and update the effective date.
- `app/globals.css` — Style the opt-in banner in the current brand system.
- `.env.local` — Add the public Measurement ID locally; ignored and never committed.
- `docs/PROJECT_STATE.md` — Record implementation, verification, and source-only deployment status.

### Task 1: Create the dedicated GA4 resource

**Files:**
- Google Analytics account/property/stream in the browser.
- Modify ignored `.env.local` by adding only `NEXT_PUBLIC_GA_MEASUREMENT_ID=G-...`.

**Produces:** A visible `G-...` Measurement ID for the `https://natarot.com` stream.

- [ ] In the already signed-in Google account, create Analytics account `NaTarot`, property `NaTarot Website`, and a web stream for `https://natarot.com`.
- [ ] Set the time zone to `Asia/Ho_Chi_Minh` and currency to `VND`; leave optional data sharing, Google Signals, Ads personalization, and enhanced measurement disabled.
- [ ] If a legal agreement appears, stop at that page and ask the owner to accept it.
- [ ] Copy the stream Measurement ID into `.env.local` without printing existing file contents.
- [ ] Confirm `.env.local` is ignored and absent from staged changes with `git check-ignore -v .env.local` and `git status --short`.

**Manual check:** Analytics visibly shows the new NaTarot account, property, stream domain, settings, and `G-...` ID. The existing “Kết Nối Bốn Phương” property is untouched.

### Task 2: Add privacy-safe route and referrer helpers

**Files:**
- Create: `lib/analytics-tracking.ts`

**Interfaces:**
- `isValidGa4MeasurementId(value: string | undefined): value is string`
- `sanitizeAnalyticsPath(pathname: string): string`
- `sanitizeAnalyticsReferrer(referrer: string, siteOrigin: string, previousPath?: string): string | undefined`

- [ ] Define the static page-path allowlist from the current app routes: `/`, `/account`, `/admin`, `/admin/readers`, `/affiliate`, `/auth`, `/auth/complete`, `/book`, `/bookings`, `/checkout`, `/community`, `/create`, `/daily-spread`, `/decks`, `/forgot-password`, `/game`, `/guidebook`, `/invites`, `/journal`, `/login`, `/packages`, `/practice`, `/privacy`, `/profile`, `/register`, `/reset-password`, `/room`, and `/terms`.
- [ ] Map `/guidebook/<card>` to `/guidebook/[card]`, `/r/<token>` to `/r/[share]`, and every unknown route to `/[page]`; never pass a dynamic segment through unchanged.
- [ ] Make referrers same-origin sanitized paths or external origins only. Return `undefined` for an invalid/empty referrer; drop query and fragment data in all cases.
- [ ] Accept only IDs matching `/^G-[A-Z0-9]+$/`.

```ts
export function sanitizeAnalyticsPath(pathname: string): string;
export function sanitizeAnalyticsReferrer(
  referrer: string,
  siteOrigin: string,
  previousPath?: string,
): string | undefined;
```

**Manual check:** Review the route table against `app/`; confirm raw share tokens, card slugs, unknown path segments, query strings, and fragments cannot appear in the returned GA fields.

### Task 3: Implement consent-gated GA loading and page views

**Files:**
- Create: `components/analytics/analytics-provider.tsx`
- Consume: `lib/analytics-tracking.ts`

**Interfaces:**
- `type AnalyticsConsent = "accepted" | "rejected" | null`
- `AnalyticsProvider({ children, measurementId }: { children: React.ReactNode; measurementId?: string })`
- `AnalyticsPreferencesButton()` — reopens the choice from the Privacy page.

- [ ] Create a client context with an `openPreferences(): void` method. Store the decision under `natarot.analytics-consent.v1` and load it after hydration.
- [ ] Render no banner, script, or network request when the Measurement ID is missing/invalid. With a valid ID and no choice, render equal-priority “Cho phép phân tích / Allow analytics” and “Từ chối / Reject” buttons.
- [ ] On acceptance, store `accepted`, set `analytics_storage`, `ad_storage`, `ad_user_data`, and `ad_personalization` to denied before loading the Google tag, then grant only `analytics_storage`. Ensure a stable script ID prevents duplicate loads.
- [ ] Initialize the tag with `send_page_view: false`, `allow_google_signals: false`, `allow_ad_personalization_signals: false`, fixed title `NaTarot`, and a sanitized `page_location`/`page_referrer`.
- [ ] After the tag is ready, emit the initial `page_view` and one event on each `usePathname()` change using only `sanitizeAnalyticsPath` and `sanitizeAnalyticsReferrer`. Track the previous sanitized path in a ref.
- [ ] On rejection before acceptance, store `rejected` and never load the tag. On withdrawal after acceptance, set consent to denied, stop further events, clear `_ga`/`_ga_*` cookies for this site where possible, and reset the previous-path ref.
- [ ] Keep only GA4's standard lifecycle events; add no custom NaTarot events. Enhanced measurement remains disabled in the GA property.

```ts
type AnalyticsConsent = "accepted" | "rejected" | null;

type AnalyticsConsentContextValue = {
  openPreferences: () => void;
};

const CONSENT_STORAGE_KEY = "natarot.analytics-consent.v1";
```

**Manual check:** In a fresh browser context, no choice creates no Google tag; acceptance creates one tag and one manual page view for the current route; route changes add one view; rejection/withdrawal stops subsequent measurement and clears site GA cookies where possible.

### Task 4: Mount the provider and expose settings

**Files:**
- Modify: `app/layout.tsx`
- Modify: `app/legal-page.tsx`
- Consume: `components/analytics/analytics-provider.tsx`

- [ ] Pass `process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID` from the server root layout to `AnalyticsProvider`; wrap page content and `WebMCP` exactly once.
- [ ] Add `AnalyticsPreferencesButton` to the Privacy page footer only, not the Terms page.
- [ ] Keep `app/layout.tsx` a server component; the analytics provider owns browser state and scripts.
- [ ] Confirm existing auth, share, and normal page shells still render under the provider.

**Manual check:** Load `/`, `/privacy`, `/auth`, and `/r/<test-token>`; verify there is one global consent banner and the Privacy page control reopens it.

### Task 5: Update disclosure and banner presentation

**Files:**
- Modify: `lib/legal-content.ts`
- Modify: `app/globals.css`
- Modify: `components/analytics/analytics-provider.tsx`

- [ ] Add an English/Vietnamese “Google Analytics” section. State that, after consent, Google receives sanitized page routes and standard session data, which may include a pseudonymous `_ga` cookie, approximate region, browser/device details, and standard lifecycle events. State that NaTarot excludes Tarot/account content and explain rejection/withdrawal.
- [ ] Link to Google's privacy information and update `legalUpdatedAt` to `2026-09-28`.
- [ ] Use concise bilingual banner copy: explain page/session measurement, say it runs only after permission, and keep Accept and Reject equally visible.
- [ ] Add namespaced CSS for a fixed, responsive consent panel using current navy/gold tokens, visible keyboard focus, and safe-area spacing. Avoid changes to other page surfaces.

**Manual check:** View the banner and Privacy page in Vietnamese and English at desktop and mobile widths; verify button labels, focus order, contrast, layout, and the settings reopening path.

### Task 6: Verify, document, and prepare source release

**Files:**
- Modify: `docs/PROJECT_STATE.md`
- Commit only the related app, legal, and documentation files; never stage `.env.local`.

- [ ] Run `npx tsc --noEmit`, `npm run build`, and `git diff --check`.
- [ ] Use a fresh local browser state to verify no tag/request before consent; after acceptance inspect the Google tag requests and page-view payloads for sanitized routes/referrers, fixed title, and absence of query/token/content fields.
- [ ] Verify rejection and withdrawal stop further collection; verify `/r/<token>` is represented only as `/r/[share]`.
- [ ] Confirm the GA Realtime report after a deployed consented visit; do not treat the source-only build as production verification.
- [ ] Record the Measurement ID as a public identifier only if useful for operator setup; never record Google login credentials or secrets. Update `docs/PROJECT_STATE.md` with source commit, checks, account/property/stream settings, and **SOURCE VERIFIED; NOT DEPLOYED** status.
- [ ] Review the staged diff for unrelated files/secrets, commit the implementation, and push `codex/google-analytics-natarot`.
- [ ] Present the finished source and request separate owner approval before any production deployment.

**Validation note:** This plan does not add or run automated tests; verification is TypeScript, production build, diff review, and manual browser/network inspection.
