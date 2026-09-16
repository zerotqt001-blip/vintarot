# VinTarot state

## Product
Moonlight-inspired tarot website. Preserve reference interactions, smooth motion, and VinTarot branding. User wants real production services but has not provisioned payment/video/email accounts.

## Existing implementation
78 public-domain tarot images, room drawing/shuffling/dragging, guidebook, daily cards, journal, D1 persistence. Local preview on port 5173. Integrations visibly unavailable until configured.

## Latest feature
/create now offers a custom question, six topics with four suggestions each, and skip/back controls. Create and +Room link here. A one-use sessionStorage draft (1h expiry) transfers question into room state without exposing question in URL; existing D1 room and journal persistence retains it. Work prompts were observed in reference; other prompts are VinTarot-authored.
Deck tap starts, second tap pauses the current pose, then a short settle exit opens the fan. The stop action is local UI state, not shared across participants. The shuffle now uses a hands-free 3D cylinder: all 32 full-size cards orbit one central axis continuously with their radial edges aimed inward, symmetric depth shading and a static reduced-motion fallback. Stopping preserves the current rotation before the fan opens. All card-back surfaces now use the supplied custom celestial artwork while card dimensions and face-up artwork remain unchanged.
The interface now supports English and Tiếng Việt through a shared client locale provider. The selector is available in the site header and Room, with a profile selector for signed-in users. The choice is stored in localStorage and mirrored to the D1 profile record; visible navigation, Create questions, Room controls, guidebook, daily spread, journal, practice, profile, booking and invite copy are translated while Tarot card names and stored room data remain unchanged.
Guidebook browsing now follows the reference's category-first flow: Major Arcana, Wands, Cups, Swords and Pentacles appear as animated family cards, each opening its full card grid. Selecting a card navigates to `/guidebook/<card-slug>` with a detail view, card flip and separate upright/reversed meaning copy.
Guidebook and spread-facing card faces now use the Moonlight Rider–Waite CDN artwork and its short labels (Major Arcana numerals and numeric minor-card captions), with the local public-domain artwork retained as an image-load fallback.
Room face-up cards now use the Moonlight artwork's 400×647 aspect ratio (220×356 at the desktop table size) and no longer add a second CSS border, so the title and lower artwork stay visible. Tarot guide copy is localized through `cardMeaning`: Vietnamese Room, Guidebook detail and Practice views use translated keywords and upright/reversed prompts while English keeps the original copy.
Guidebook card details now include an original long-form narrative for all 78 cards. Each entry has a summary plus Energy, Actions, Strengths & Challenges, Relationships, Work, Creativity, Home, Symbolism, Journal Questions and Memes sections. `cardNarrative` supplies English and Vietnamese copy, and the detail dialog is scrollable with a Moonlight-like summary callout so the full reading remains usable on mobile.
The long-form Guidebook narrative now follows the selected upright or reversed tab. Reversed cards receive their own summary and ten-section guidance, including a dedicated bilingual The Fool reversal, while the artwork flips with the existing card control.
Room trải bài now has a Moonlight-like interaction pass: cards tilt symmetrically, lift and scale on focus, show contextual prompt pills, and the top-right camera D-pad pans the table with clamped smooth transitions; keyboard arrows mirror the controls.
The Room tabletop now uses the supplied celestial artwork as a dark cosmic stage with layered overlays, restrained parallax drift and a 1400px perspective so the spread, fan and card lift read as a balanced 3D scene. The artwork is local to the Site and loads without a network dependency.

## Remaining work
Continue reference fidelity review, mobile motion tuning and provision real service accounts. Full cross-device smoothness not yet established.

## Versioning
Baseline commit 64fca6d, tag baseline-before-skills-2026-09-16. GitHub origin: https://github.com/zerotqt001-blip/vintarot (private). Baseline is on main; tooling is on codex/tooling-and-version-history. Push completed changes and verify remote refs; report any failures.

## Hosting
VinTarot is deployed privately on Sites at https://vintarot.lindajacksonz316.chatgpt.site. The deployment uses the current card-back artwork, 3D cylinder shuffle, question prompts, and bilingual interface. Keep the Site owner-only unless the user explicitly requests another audience; do not expose stored credentials.

## Verification
`npx tsc --noEmit`, `npm run build`, `npx tsx --test tests/card-narrative.test.ts tests/i18n.test.ts tests/shuffle.test.ts tests/shuffle-motion.test.ts tests/guidebook.test.ts tests/room-display.test.ts tests/room-motion.test.ts tests/room-backdrop.test.ts` (20/20), and `git diff --check` pass for the bilingual long-form Guidebook narrative, locale, shuffle, Guidebook and Room visual interaction work. Browser checks additionally confirm Moonlight CDN image URLs and captions in Guidebook, a complete face-up card without the extra border in Room, Vietnamese tarot guidance for Queen of Cups, and the full scrollable English/Vietnamese The Fool narrative with distinct upright/reversed sections. The production archive was validated and the first private Sites deployment succeeded. Browser checks covered English/Vietnamese switching, persistence across routes, Create topic suggestions, the continuous 3D-cylinder Room shuffle, two-tap stop/settle, fan draw, card flip, translated spread controls, Guidebook family selection, upright/reversed card details, Moonlight artwork fallback behavior, symmetric spread-card tilt/lift, contextual prompts, bounded table pan controls, and the layered cosmic Room backdrop with perspective drift. Full fidelity and production integrations remain incomplete.
