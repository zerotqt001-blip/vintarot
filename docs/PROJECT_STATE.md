# VinTarot state

## Product
Moonlight-inspired tarot website. Preserve reference interactions, smooth motion, and VinTarot branding. User wants real production services but has not provisioned payment/video/email accounts.

## Existing implementation
78 public-domain tarot images, room drawing/shuffling/dragging, guidebook, daily cards, journal, D1 persistence. Local preview on port 5173. Integrations visibly unavailable until configured.

## Latest feature
/create now offers a custom question, six topics with four suggestions each, and skip/back controls. Create and +Room link here. A one-use sessionStorage draft (1h expiry) transfers question into room state without exposing question in URL; existing D1 room and journal persistence retains it. Work prompts were observed in reference; other prompts are VinTarot-authored.
Deck tap starts, second tap pauses the current pose, then a short settle exit opens the fan. The stop action is local UI state, not shared across participants. The shuffle now uses a hands-free 3D cylinder: all 32 full-size cards orbit one central axis continuously with their radial edges aimed inward, symmetric depth shading and a static reduced-motion fallback. Stopping preserves the current rotation before the fan opens. All card-back surfaces now use the supplied custom celestial artwork while card dimensions and face-up artwork remain unchanged.
The interface now supports English and Tiếng Việt through a shared client locale provider. The selector is available in the site header and Room, with a profile selector for signed-in users. The choice is stored in localStorage and mirrored to the D1 profile record; visible navigation, Create questions, Room controls, guidebook, daily spread, journal, practice, profile, booking and invite copy are translated while Tarot card names and stored room data remain unchanged.

## Remaining work
Continue reference fidelity review, mobile motion tuning and provision real service accounts. Full cross-device smoothness not yet established.

## Versioning
Baseline commit 64fca6d, tag baseline-before-skills-2026-09-16. GitHub origin: https://github.com/zerotqt001-blip/vintarot (private). Baseline is on main; tooling is on codex/tooling-and-version-history. Push completed changes and verify remote refs; report any failures.

## Hosting
VinTarot is deployed privately on Sites at https://vintarot.lindajacksonz316.chatgpt.site. The deployment uses the current card-back artwork, 3D cylinder shuffle, question prompts, and bilingual interface. Keep the Site owner-only unless the user explicitly requests another audience; do not expose stored credentials.

## Verification
`npx tsc --noEmit`, `npm run build`, `npx tsx --test tests/i18n.test.ts tests/shuffle.test.ts tests/shuffle-motion.test.ts` (6/6), and `git diff --check` pass for the locale and shuffle work. The production archive was validated and the first private Sites deployment succeeded. Browser checks covered English/Vietnamese switching, persistence across routes, Create topic suggestions, the continuous 3D-cylinder Room shuffle, two-tap stop/settle, fan draw, card flip and translated spread controls. Full fidelity and production integrations remain incomplete.
