# NaTarot Google Analytics 4 Integration Implementation Plan

**Status: Implemented and deployed on 2026-09-28.** Dedicated GA4 account/property/stream created; production release `natarot-ga4-4a55507-20260928T092355Z` is active from source commit `4a55507`. The user authorized deployment in the follow-up request. The GA property is separate from `Kết Nối Bốn Phương`.

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
- Implementation was initially committed on `codex/natarot-ga4-current-production`; the final live release was rebuilt from up-to-date production commit `4a55507` on `codex/natarot-ga4-active-production`.
- Production deployment required owner approval; approval was given in the follow-up request and deployment is complete.

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

- [x] In the already signed-in Google account, create Analytics account `NaTarot`, property `NaTarot Website`, and a web stream for `https://natarot.com`.
- [x] Set the time zone to `Asia/Ho_Chi_Minh` and currency to `VND`; leave optional data sharing, Google Signals, Ads personalization, and enhanced measurement disabled.
- [x] The owner accepted Google's legal terms in the browser.
- [x] Keep the Measurement ID in ignored local configuration/build environment, never in a committed environment file.
- [x] Confirm no secret environment file is staged or deployed.

**Manual check:** Analytics visibly shows the new NaTarot account, property, stream domain, settings, and `G-...` ID. The existing “Kết Nối Bốn Phương” property is untouched.

### Task 2: Add privacy-safe route and referrer helpers

**Files:**
- Create: `lib/analytics-tracking.ts`

**Interfaces:**
- `isValidGa4MeasurementId(value: string | undefined): value is string`
- `sanitizeAnalyticsPath(pathname: string): string`
- `sanitizeAnalyticsReferrer(referrer: string, siteOrigin: string, previousPath?: string): string | undefined`

- [x] Define the static route allowlist from the current app routes.
- [x] Map dynamic guidebook/share/unknown routes to stable templates; do not pass dynamic segments through.
- [x] Sanitize referrers to a same-origin sanitized path or external origin; omit query and fragment data.
- [x] Accept only IDs matching `/^G-[A-Z0-9]+$/`.

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

- [x] Create the consent context and persist only `accepted` or `rejected` under `natarot.analytics-consent.v1`.
- [x] With a valid Measurement ID and no choice, show equal-priority accept/reject actions; without an ID, render neither analytics UI nor tag.
- [x] Gate Google tag loading and Analytics storage on explicit acceptance; prevent duplicate script loads.
- [x] Configure sanitized routes/referrers, fixed title, disabled Google Signals/ad personalization, and manual page views.
- [x] Emit page views for the initial page and SPA route changes using the sanitized helpers.
- [x] Implement rejection and withdrawal behavior, including cookie clearing where possible.
- [x] Keep enhanced measurement off and add no custom NaTarot interaction events.

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

- [x] Pass `NEXT_PUBLIC_GA_MEASUREMENT_ID` from the server root layout to one `AnalyticsProvider` mount.
- [x] Add the preferences control to the Privacy page only.
- [x] Keep the root layout a server component; the client provider owns browser state and scripts.
- [x] Confirm production home and Privacy pages render under the provider.

**Manual check:** Load `/`, `/privacy`, `/auth`, and `/r/<test-token>`; verify there is one global consent banner and the Privacy page control reopens it.

### Task 5: Update disclosure and banner presentation

**Files:**
- Modify: `lib/legal-content.ts`
- Modify: `app/globals.css`
- Modify: `components/analytics/analytics-provider.tsx`

- [x] Add the bilingual Analytics disclosure, data categories, exclusions, and consent/withdrawal instructions.
- [x] Link to Google's privacy information and update the effective date to `2026-09-28`.
- [x] Add concise bilingual banner copy with equally visible allow/reject actions.
- [x] Style the responsive consent panel using the existing Moonlight/NaTarot tokens and keyboard focus treatment.

**Manual check:** View the banner and Privacy page in Vietnamese and English at desktop and mobile widths; verify button labels, focus order, contrast, layout, and the settings reopening path.

### Task 6: Verify, document, and prepare source release

**Files:**
- Modify: `docs/PROJECT_STATE.md`
- Commit only the related app, legal, and documentation files; never stage `.env.local`.

- [x] Run `npx tsc --noEmit`, `npm run build`, and `git diff --check` on the production-source build.
- [x] In the live browser, verify the consent banner and confirm there is no Google Analytics script before a visitor opts in.
- [ ] Do not choose Accept or Reject for a visitor during QA; confirm rejection/withdrawal interactions separately without changing a real visitor's choice.
- [ ] Confirm Realtime after a real visitor opts in; current zero-user count is expected before consent and Google may take up to 48 hours to populate.
- [x] Record public property/Measurement ID and deployed status in `docs/PROJECT_STATE.md`; no credentials or secrets are recorded.
- [x] Preserve the reviewed GA implementation commit and push the production-source deployment record on `codex/natarot-ga4-active-production`.
- [x] Owner approved production deployment in the follow-up request; release and browser gate completed.

**Validation note:** No automated tests were added or run. TypeScript, production build, diff review, production health, and live pre-consent browser inspection passed. Consent acceptance/rejection and Realtime data remain dependent on an actual visitor's choice.
