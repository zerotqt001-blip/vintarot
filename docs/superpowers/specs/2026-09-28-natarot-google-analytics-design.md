# NaTarot Google Analytics 4 Integration

**Status:** Design approved in chat; awaiting owner review of this written specification.

## Goal

Connect the production NaTarot website at `https://natarot.com` to a dedicated Google Analytics 4 property in the owner's signed-in Google account. Measure page views and standard session metrics only after a clear visitor opt-in. Do not add custom product-interaction events.

## Current state

- The shared site shell is `app/layout.tsx` in the Next/Vinext application.
- There is no Google Analytics tag or Measurement ID in the repository.
- `/privacy` renders the bilingual document in `lib/legal-content.ts`; its current disclosures cover accounts, Google sign-in, Tarot content, AI readings, and essential session cookies.
- The selected Google account already has a GA account/property named “Kết Nối Bốn Phương”. That property is for a different business and will not receive NaTarot data.
- The product is branded NaTarot and supports English and Vietnamese. Preserve the existing Moonlight/NaTarot visual language.

## Chosen approach

Use the Google tag (`gtag.js`) directly in the shared site shell, behind an explicit opt-in choice. Do not add Google Tag Manager, Ads integrations, conversion tracking, user IDs, or custom behavioral events.

This keeps the integration to one public Measurement ID and one first-party consent UI. Google Analytics requires a GA4 property, web stream, and Measurement ID for this setup. Google's basic consent approach blocks the tag and sends no data before the visitor makes a choice. See the [GA4 setup guide](https://support.google.com/analytics/answer/14183469?hl=en) and [consent mode guide](https://support.google.com/analytics/answer/10000067?hl=en).

## Google Analytics resource

Under the already signed-in Google account, create a separate Analytics account named **NaTarot**, a GA4 property named **NaTarot Website**, and a web stream for `https://natarot.com`.

Configure the property with the `Asia/Ho_Chi_Minh` time zone and `VND` currency. Keep optional data-sharing settings disabled, leave Google Signals and advertising personalization off, and disable enhanced measurement. Use the stream's `G-...` Measurement ID in the site build configuration. Do not attach the stream to “Kết Nối Bốn Phương”.

If Google presents a legally binding agreement for acceptance during account/property setup, stop at that screen and ask the owner to accept it personally.

## Consent behavior

- Show a bilingual banner with equal-priority **“Cho phép phân tích” / “Allow analytics”** and **“Từ chối” / “Reject”** actions when there is no saved choice.
- Render the banner only when a valid Measurement ID is configured; with no ID, analytics and the consent UI are both inactive.
- Do not load `gtag.js`, set Analytics cookies, or make measurement requests before the visitor accepts.
- Store only the choice (`accepted` or `rejected`) in local browser storage, using a versioned key such as `natarot.analytics-consent.v1`. Use the existing `vintarot-locale` preference for banner language, with the document language as a fallback.
- Keep the site usable when the visitor rejects or leaves the banner unanswered.
- Provide a control on the Privacy page to reopen the choice. On withdrawal, update the Analytics storage choice to denied, stop subsequent page views and other measurement events, and clear this site's `_ga` cookies where possible. Previously transmitted Analytics data cannot be recalled by the site.
- Make the banner keyboard accessible, responsive, and visually consistent with the current Moonlight/NaTarot palette.

## Measurement and data boundaries

After consent, send a sanitized `page_view` for the initial route and subsequent client-side route changes. The standard GA4 web tag can also collect its built-in lifecycle events, such as `first_visit`, `session_start`, and `user_engagement`, for basic session metrics. These are part of GA's default implementation, not custom NaTarot interaction events. If the owner requires literally one event type and no default lifecycle events, stop before implementation and revisit the design.

- Set `send_page_view: false` and emit route changes explicitly to avoid duplicate page views.
- Send allowlisted route templates only. Omit query strings and fragments. Replace opaque or user-specific route segments, including public-share paths such as `/r/<token>`, with stable labels such as `/r/[share]`.
- Sanitize referrers too: for same-origin navigation, use the previous sanitized route; for external navigation, retain only the referrer origin. Omit query strings and fragments.
- Use a fixed page title (`NaTarot`) rather than dynamic page text.
- Never send Tarot questions, optional context, card selections, reading results, journal notes, raw share tokens, email addresses, member/session IDs, or other account data.
- Set `allow_google_signals: false` and `allow_ad_personalization_signals: false`; do not register user IDs or custom user properties.
- Configure and verify the web stream with enhanced measurement off so it does not add scroll, outbound-click, or other automatic events.

Google's default web collection can include user/session statistics, approximate location, browser/device information, and a first-party `_ga` cookie. The standard tag can also send lifecycle events such as `first_visit`, `session_start`, and `user_engagement`; disabling enhanced measurement does not remove these defaults. The Privacy Policy must explain these categories, default events, and the consent choice. Google also requires a disclosure of Analytics use and data handling: [data collection](https://support.google.com/analytics/answer/11593727?hl=en), [automatically collected events](https://support.google.com/analytics/answer/9322688?hl=en), [privacy disclosure policy](https://support.google.com/analytics/answer/7318509?hl=en).

## Site implementation

- Add one client-side analytics/consent component mounted once from `app/layout.tsx`.
- Use a public build variable named `NEXT_PUBLIC_GA_MEASUREMENT_ID`; if it is unset or invalid, do not load the tag or render the consent UI.
- Implement initial and SPA route page views from the sanitized route contract above.
- Extend `lib/legal-content.ts` with English and Vietnamese Analytics disclosures, choice/withdrawal instructions, and a link to Google's privacy information. Update the effective date when the disclosure ships.
- Add a Privacy page action that reopens consent settings.
- Keep the Measurement ID out of server secrets, private Tarot data, and committed environment files. It is a public tag destination identifier, not an authentication credential.

## Acceptance criteria

1. The dedicated `NaTarot` GA account, property, and `natarot.com` web stream exist under the requested Google login, and the Measurement ID is recorded for the build without exposing login credentials.
2. A fresh browser with no stored choice makes no Google Analytics script or collection request.
3. Accepting analytics loads the tag once and produces one initial page view plus one page view per route change. GA's documented automatic lifecycle events may also appear; no custom NaTarot interaction events are configured.
4. Rejecting analytics produces no tag or measurement request. Changing an accepted choice to rejected prevents further page views and clears this site's GA cookies where possible.
5. Page-view payloads use only allowlisted route templates, sanitized referrers, and the fixed `NaTarot` title; query strings, hashes, opaque IDs, share tokens, and private Tarot/account content are absent.
6. The banner and Privacy page controls render in Vietnamese and English, remain keyboard accessible, and do not disrupt mobile or desktop layouts.
7. The bilingual Privacy Policy discloses Analytics, the main data categories, the purpose, Google as provider, and how to reject or withdraw consent.
8. TypeScript and production build succeed. Browser verification confirms the no-consent, accepted, rejected, and withdrawal behaviors. Google Analytics Realtime is used to confirm the stream after deployment and consent; initial reports may take time to appear.

## Rollout and out of scope

The implementation should be source-reviewed and locally verified before a production release. Production deployment is a separate final owner approval because the release enables collection from live visitors. Do not enable Ads, cross-domain measurement, ecommerce/conversion events, enhanced measurement, or any tracking of Tarot interactions as part of this work.
