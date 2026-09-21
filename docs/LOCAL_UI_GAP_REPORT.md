# NaTarot Local UI Gap Report

Date: 2026-09-21
Scope: visual and interaction audit of the local showcase only. No cosmetic fixes were authorized or made.

The existing Moonlight/Celestial reference direction and NaTarot branding were treated as the design baseline. Severity is practical: `P1` would block the owner walkthrough, `P2` is a noticeable product-quality issue worth scheduling, and `P3` is polish or follow-up work.

## Observed gaps

| Area | Current observation | Expected direction | Severity | Design-system V1 relevance |
|---|---|---|---|---|
| Public share header | In the captured desktop and mobile public-share views, the logo/wordmark reads darker and lower-contrast than the surrounding light text against the dark celestial background. | Keep the existing mark, but ensure its contrast and treatment remain legible on every dark share state. | P2 | Moderate/high: contrast and brand-token consistency. |
| Celtic Cross board | The ten-card desktop layout is spatially correct, but the lower/outer cards sit close to or partly below the default viewport at 1091×1086. The existing pan/zoom controls are needed to inspect the whole composition. | Make the complete spread discoverable on first load, or provide a clearer board affordance/zoom hint before the user assumes cards are missing. | P2 | Medium: responsive board geometry and interaction affordance. |

## Areas checked without a blocking issue

| Area | Result | Follow-up |
|---|---|---|
| Home | Moonlight/Celestial hero, daily spread, and navigation rendered with no obvious horizontal overflow. | Preserve the current reference aesthetic. |
| Auth pages | Login, register, forgot-password, and reset-password routes rendered at desktop and mobile widths. | No blocker observed. External email/OAuth behavior remains a product-integration boundary, not a visual fix. |
| Create flow | Question prompt, context field, topic cards, Auto Topic result, and continue CTA were legible and usable. | No blocker observed. |
| Three-card room | Question, deck, controls, slot labels, cards, and reading CTA were readable on desktop and reliable 390px mobile. | No blocker observed. |
| Reading result | Desktop side panel and mobile full-width panel exposed the same editorial sections and actions without horizontal overflow. | No blocker observed. |
| Public share cards | Mobile used a readable two-column card grid and a long, scrollable page with no horizontal overflow. | No blocker observed. |
| Profile and Journal | Routes loaded with the intended Moonlight/Celestial shell and no horizontal overflow. | No blocker observed. |

## Audit boundary

The report intentionally does not recommend a new visual language, replace the Moonlight reference, or turn research ideas such as Liquid Glass into implementation work. Any P2 item should be reviewed against the existing design tokens and interaction model before a separate UI-change task is authorized.
