# VinTarot state

## Product
Moonlight-inspired tarot website. Preserve reference interactions, smooth motion, and VinTarot branding. User wants real production services but has not provisioned payment/video/email accounts.

## Existing implementation
78 public-domain tarot images, room drawing/shuffling/dragging, guidebook, daily cards, journal, D1 persistence. Local preview on port 5173. Integrations visibly unavailable until configured.

## Latest feature
/create now offers a custom question, six topics with four suggestions each, and skip/back controls. Create and +Room link here. A one-use sessionStorage draft (1h expiry) transfers question into room state without exposing question in URL; existing D1 room and journal persistence retains it. Work prompts were observed in reference; other prompts are VinTarot-authored.
Deck tap starts, second tap stops the CSS shuffle in its current pose, then a short settle exit opens the fan. The stop action is local UI state, not shared across participants. The shuffle now uses an Arc Cascade motion: 32 cards travel left-to-right and back through a bowed 3D path with staggered depth and reduced-motion fallbacks.
The interface now supports English and Tiếng Việt through a shared client locale provider. The selector is available in the site header and Room, with a profile selector for signed-in users. The choice is stored in localStorage and mirrored to the D1 profile record; visible navigation, Create questions, Room controls, guidebook, daily spread, journal, practice, profile, booking and invite copy are translated while Tarot card names and stored room data remain unchanged.

## Remaining work
Continue reference fidelity review, mobile motion tuning and provision real service accounts. Full cross-device smoothness not yet established.

## Versioning
Baseline commit 64fca6d, tag baseline-before-skills-2026-09-16. GitHub origin: https://github.com/zerotqt001-blip/vintarot (private). Baseline is on main; tooling is on codex/tooling-and-version-history. Push completed changes and verify remote refs; report any failures.

## Hosting
Existing Sites project lookup returned project_not_found. No production deployment succeeded. Do not create duplicate projects or expose stored credentials.

## Verification
`npx tsc --noEmit`, `npm run build`, `npx tsx --test tests/i18n.test.ts`, `npx tsx --test tests/shuffle.test.ts`, and `git diff --check` pass for the locale and shuffle work. Browser checks covered English/Vietnamese switching, persistence across routes, Create topic suggestions, Room shuffle start/stop/settle, fan draw, card flip and translated spread controls. Full fidelity and production integrations remain incomplete.
