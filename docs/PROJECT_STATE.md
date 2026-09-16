# VinTarot state

## Product
Moonlight-inspired tarot website. Preserve reference interactions, smooth motion, and VinTarot branding. User wants real production services but has not provisioned payment/video/email accounts.

## Existing implementation
78 public-domain tarot images, room drawing/shuffling/dragging, guidebook, daily cards, journal, D1 persistence. Local preview on port 5173. Integrations visibly unavailable until configured.

## Latest feature
/create now offers a custom question, six topics with four suggestions each, and skip/back controls. Create and +Room link here. A one-use sessionStorage draft (1h expiry) transfers question into room state without exposing question in URL; existing D1 room and journal persistence retains it. Work prompts were observed in reference; other prompts are VinTarot-authored.
Deck tap starts, second tap pauses all CSS animation layers in place, next tap resumes. Done shuffling exits current pose and opens fan. Pause is local UI state, not shared across participants.

## Remaining work
Continue reference fidelity review, mobile motion tuning and provision real service accounts. Full cross-device smoothness not yet established.

## Versioning
Baseline commit 64fca6d, tag baseline-before-skills-2026-09-16. GitHub origin: https://github.com/zerotqt001-blip/vintarot (private). Baseline is on main; tooling is on codex/tooling-and-version-history. Push completed changes and verify remote refs; report any failures.

## Hosting
Existing Sites project lookup returned project_not_found. No production deployment succeeded. Do not create duplicate projects or expose stored credentials.

## Verification
Prior app TypeScript and production build passed; shuffle and card selection checked in browser. Full fidelity and production integrations remain incomplete.
