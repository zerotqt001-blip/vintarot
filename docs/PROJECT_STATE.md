# VinTarot state

## Product
Moonlight-inspired tarot website. Preserve reference interactions, smooth motion, and VinTarot branding. User wants real production services but has not provisioned payment/video/email accounts.

## Existing implementation
78 public-domain tarot images, room drawing/shuffling/dragging, guidebook, daily cards, journal, D1 persistence. Local preview on port 5173. Integrations visibly unavailable until configured.

## Immediate unfinished work
Create a ritual currently enters room directly. Must add Ask a question (custom input, Work, Relationships, Life changes, Creativity, Inner magic, IDK, Skip theme), then topic question suggestions (Anything in mind?, Skip question), passing selection into room state and journal. Original Work suggestions observed: What's next in my career?; What wants to come alive in my work?; What should I know about this opportunity?; What is emerging with this launch? Inspect other topics before implementing. User screenshot shows purple aura, pill input, 3x2 topic buttons and back arrow.

## Versioning
Baseline commit 64fca6d, tag baseline-before-skills-2026-09-16. GitHub origin: https://github.com/zerotqt001-blip/vintarot (private). Baseline is on main; tooling is on codex/tooling-and-version-history. Push completed changes and verify remote refs; report any failures.

## Hosting
Existing Sites project lookup returned project_not_found. No production deployment succeeded. Do not create duplicate projects or expose stored credentials.

## Verification
Prior app TypeScript and production build passed; shuffle and card selection checked in browser. Full fidelity and production integrations remain incomplete.
