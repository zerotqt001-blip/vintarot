# NaTarot — UI/UX Research and Product Surface Audit

**Status:** V1 research specification, documentation-only

**Audit date:** 2026-09-21

**Repository baseline:** `60db3db7db535560feb6ff1178a975793bec26bf`

**Research branch:** `codex/natarot-design-system-research`

## Executive decision

NaTarot already has a coherent visual identity: a dark Moonlight-like celestial environment, antique gold accents, editorial serif moments, and an unusually immersive Tarot room. The next design-system step is not to replace that identity with generic translucent cards. It is to consolidate the visual language around a semantic token layer and to reserve stronger Liquid Glass behavior for functional surfaces that float above the content layer.

The recommended direction is:

1. Keep the celestial artwork, card imagery, gold/ivory palette, and “space between you and the cards” tone.
2. Make navigation, toolbars, sheets, drawers, and transient controls feel like a distinct functional layer.
3. Keep questions, interpretations, journal entries, guidebook copy, and long-form reading evidence on calmer editorial materials with strong text contrast.
4. Preserve the Room’s card geometry, draw/reveal state machine, orientation handling, AI/knowledge-base contracts, authentication ownership, and persistence boundaries.
5. Build the visual system as a five-level progressive material model. The base browser experience must remain useful when blur, displacement, WebGL, or motion are unavailable.

This follows Apple’s current Liquid Glass guidance that the material is for controls and navigation, not the content layer, and that custom use should be sparse and context-aware. The recommendation is Apple-inspired in material behavior, not a reproduction of Apple assets or platform APIs. See [Apple’s Materials guidance](https://developer.apple.com/design/human-interface-guidelines/materials) and [Meet Liquid Glass](https://developer.apple.com/videos/play/wwdc2025/219/).

## Scope and evidence

This pass is intentionally non-invasive. It inspected the committed source baseline, ran the local app, inspected representative routes and accessibility trees, reviewed the existing stylesheet and component primitives, and researched the named component and Liquid Glass references. The current checkout also contains unrelated, uncommitted Home/mobile work; those changes were compared read-only and were not copied into this research branch.

Evidence used:

| Evidence | What it established |
| --- | --- |
| `app/vintarot.tsx`, `app/layout.tsx`, `app/pages.tsx` | Route shell, topbar, side navigation, footer, route selection, and provider boundaries. |
| `app/globals.css` | Token generations, route-specific overrides, fixed chrome, blur usage, responsive breakpoints, and motion/reduced-motion rules. |
| `app/create/ritual.tsx` | The two-step ritual flow, input limits, focus transition, suggestion buttons, session draft, and topic selection. |
| `app/room/room.tsx`, `app/room/reading-panel.tsx`, `components/shuffle-deck.tsx` | Room geometry, draw/reveal flow, reading companion, 78-card deck, animation, and persistence boundaries. |
| `lib/i18n.ts`, `components/language.tsx` | Vietnamese-first language behavior, English parity, locale persistence, document language updates, and profile synchronization. |
| Local Home/Create/Guidebook/Room/Profile routes | Actual visual density, focus order, navigation, mobile-sensitive content, and presentation hierarchy. |
| Official Radix, shadcn/ui, Lucide, Motion, Apple, and MDN references | Accessibility, ownership, icon, animation, browser, and material constraints. |

## Current product surface map

| Surface | Observed experience | Design implication |
| --- | --- | --- |
| Home | Cosmic background, large greeting, ritual CTA, daily spread, feature rows, fixed topbar/sidebar/footer, pointer and scroll-driven scene motion. | The scene is the primary content. Glass should support navigation and the ritual CTA without covering the artwork with many equal-weight panels. |
| Create ritual | Two-step question flow. Step one captures question/context and topic; step two offers contextual suggestions. Inputs have limits, status/error states, and heading focus management. | Use a calm focus surface with clear progress and generous text width. Topic orbs can carry celestial personality; the controls must remain ordinary, labeled, and keyboard usable. |
| Guidebook | World/map-like family view, five card groups, card imagery, library search/filter/sort, card details and orientation tabs. | Treat the map and card art as content. Use functional glass for filters and navigation, not for every card or explanatory paragraph. |
| Room | Full-bleed tabletop, face-up cards, large card-back fan, media tools, zoom/pan controls, spread/tool toolbar, card picker, annotations, reading panel, and save/restart actions. | This is the highest-complexity surface. Controls need a predictable hierarchy, a “quiet canvas” mode, and a responsive tool rail. The L1 card geometry must not be altered by visual polish. |
| Reading panel | Editorial dark panel with direct answer first, deeper sections, evidence accordion, follow-up input, and fixed actions. | Reading is the comprehension layer. Keep body copy opaque/steady, limit decorative effects, and preserve 70–72ch reading measure. |
| Practice | Prompt, card, reflection textarea, reveal/save actions, and cosmic composition. | Use the same focus and reflection materials as Create; avoid making writing feel like an object inside a decorative card maze. |
| Daily spread | Flip-card interaction with daily orientation and supporting copy. | Motion should explain the reveal. Reduced motion should show the final card and text without a forced flip. |
| Journal/history | Saved readings, cards, summaries, and manual entries. | Prioritize scanability, dates, card identity, and ownership state. Use compact surfaces, not a wall of translucent containers. |
| Profile/space | Profile form, language/timezone controls, service-status copy, and future booking/payment readiness. | Form controls need high contrast and clear status. Service availability must be described as status, not represented as fake commerce UI. |
| Bookings/invites | Current route placeholders or room lists, with future booking and sharing paths. | Reserve architecture slots for future commercial and sharing features without presenting them as active now. |

## Framework and component inventory

The project is a React 19 + TypeScript application using Vinext/Vite and Tailwind CSS 4. It has `@base-ui/react`, `@shadcn/react`, `radix-ui`, and `lucide-react` available in the dependency graph. The project’s `components.json` describes a shadcn-style `new-york` setup with CSS variables and aliases. Existing local primitives are more important than adding a third-party visual system:

| Existing layer | Current role | V1 direction |
| --- | --- | --- |
| `components/ui/button.tsx` | Variant-driven button primitive using semantic variables. | Keep as the action contract; add material variants only through a wrapper or variant slot. |
| `components/ui/dialog.tsx`, `sheet.tsx` | Radix-backed overlays, focus, portal, and keyboard behavior. | Keep behavior; give overlays a material level through tokens and route context. |
| `components/ui/sidebar.tsx`, `panel.tsx`, `input.tsx` | Navigation, panels, and form primitives. | Consolidate styling around semantic tokens and responsive contracts. |
| `components/brand/logo.tsx` | Stable NaTarot SVG logo assets with `NaTarot` alt text. | Preserve assets and wordmark. Do not replace with a generated logo or icon font. |
| `components/language.tsx` | Vietnamese-first provider, locale persistence, profile sync, `<html lang>`, native select. | Preserve native control semantics; style the shell around it rather than replacing the select with an unlabeled custom menu. |
| `lucide-react` usage | Functional icons in Create, Room, and shared controls. | Keep one optical icon grammar and add accessible labels/tooltips for icon-only controls. |
| `app/globals.css` | One large stylesheet containing multiple token and route override generations. | Migrate incrementally to one authoritative semantic token layer; do not attempt a full stylesheet rewrite in the research phase. |

Radix is a good behavior foundation because it follows WAI-ARIA patterns and supplies focus management, keyboard navigation, and labeling hooks; it still requires the product to provide meaningful labels and context. See [Radix accessibility](https://www.radix-ui.com/primitives/docs/overview/accessibility). shadcn/ui is useful as a source-ownership model: its components are open code that the project owns and customizes, rather than a mandatory runtime theme. See the [shadcn/ui repository](https://github.com/shadcn-ui/ui).

## Current token and CSS audit

The canonical-looking NaTarot variables begin near the top of `app/globals.css`:

```css
--color-bg-deep: #061522;
--color-bg: #081a2a;
--color-surface: #0b2032;
--color-surface-elevated: #10283b;
--color-gold: #d7b36a;
--color-gold-bright: #e7c77d;
--color-ivory: #f4ebdd;
--color-text: #eee5d7;
```

Those variables are valuable brand anchors. The problem is not their existence; it is that the file also contains an older light token set, route-specific variables, direct rgba values, late aliases, and repeated selectors. This creates four practical risks:

- A surface can look correct in one shell and fall back to a different generation of background, border, radius, or shadow in another.
- Visual fixes can be applied at the wrong specificity level and silently affect unrelated routes.
- Glass opacity and blur values are scattered, so performance and contrast cannot be audited from one table.
- Responsive changes are distributed across several breakpoints and route selectors rather than a small set of component contracts.

The design-system migration should therefore start with a mapping table, not a new visual layer:

| Existing concept | Proposed semantic owner |
| --- | --- |
| `--color-bg-deep`, `--color-bg` | `surface.canvas`, `surface.canvas-raised` |
| `--color-surface`, `--color-surface-elevated` | `surface.panel`, `surface.panel-raised` |
| `--color-surface-soft` | `surface.glass.frosted` only where appropriate |
| `--color-gold`, `--color-gold-bright` | `accent.primary`, `accent.primary-strong` |
| `--color-border`, `--color-border-active` | `stroke.quiet`, `stroke.focus` |
| `--color-text`, muted, subtle | `content.primary`, `content.secondary`, `content.tertiary` |
| scattered `backdrop-filter` | material levels with explicit budget and fallback |
| route-specific shadows | elevation roles: `rest`, `floating`, `modal`, `room-control` |

## Typography and content audit

The current font system is a strong starting point:

- Work Sans is loaded as a variable font at weights 100–900 and is used as the main UI family.
- Instrument Serif regular is loaded for editorial headings and Tarot mood.
- `font-display: swap` is already present.
- Vietnamese and English message leaves are structurally complete in `lib/i18n.ts`; both locales have 486 message leaves and no missing keys in either direction.
- `components/language.tsx` updates the document language and stores the locale, which is the right semantic foundation for screen readers and browser behavior.

The main content risks are hierarchy and line length, not missing localization keys. The English and Vietnamese copy differ in cadence and casing. Examples include “Your reading” / “Lời đọc của bạn”, “The thread to carry forward” / “Mạch điều bạn có thể mang theo”, and “Read the language of the cards” / “Đọc ngôn ngữ của những lá bài”. V1 should preserve sentence case for explanatory copy, reserve uppercase for short labels, and avoid forcing Vietnamese into the same narrow measure used for English.

Typography rules for future implementation:

- Use Instrument Serif for one focal heading or question per surface, not every label.
- Use Work Sans for navigation, controls, metadata, helper text, and long-form body copy.
- Keep a minimum body size of 15–16 CSS px on desktop and mobile; never communicate hierarchy by reducing Vietnamese copy below comfortable reading size.
- Use `max-inline-size` rather than hard-coded width for question and reading copy.
- Test every visual change in both `vi` and `en` at narrow mobile width, because Vietnamese line breaks and button labels expose overflow earlier.

## Accessibility audit

### Strengths to preserve

- Native form controls are used in several places, including language selection.
- Radix-backed Dialog, Sheet, and Sidebar primitives provide a strong behavior baseline.
- Create flow moves focus to the next heading after the question step.
- Room exposes a large number of actions with visible controls and labels in the current accessibility tree.
- Reduced-motion rules already exist globally and in route-specific sections.
- Card detail and reading structures use headings, buttons, and semantic regions rather than a canvas-only experience.

### High-value improvements for implementation phases

1. Ensure every icon-only button has an accessible name and a visible or discoverable tooltip; do not rely on the icon shape.
2. Add an explicit “skip to main content” link and a consistent landmark order to all shells.
3. Make active route state use `aria-current="page"` everywhere, including the shared top navigation and personal navigation.
4. Keep focus rings outside the glass surface with a high-contrast two-layer treatment so they remain visible over artwork and blur.
5. Treat Room tools as a named toolbar or grouped controls with a predictable tab order; avoid requiring a user to infer meaning from spatial position.
6. When a modal, sheet, or reading panel opens, move focus to its heading or first meaningful action and return focus to the trigger on close.
7. Announce card draw, reversal, save, and interpretation status through a polite live region; visual glow is not an announcement.
8. Provide a no-transparency mode that removes blur, lensing, sheen, and moving background interactions while keeping surface separation.
9. Keep text and control contrast measurable against both the dark canvas and bright card artwork beneath a clear surface.

These requirements align with Radix’s guidance that the primitive can handle many difficult behaviors but the consumer remains responsible for labels and context.

## Responsive and interaction audit

The current stylesheet uses a mixture of 400, 430, 700, 768, 950, 1050, and 1100px media queries. Mobile navigation moves to a fixed bottom bar around 700px; Room reading content becomes a full-viewport sheet-like panel around 768px; desktop reading content uses a large side panel. The layout works because each route has intentional art direction, but it is difficult to reason about as a shared system.

V1 responsive contracts:

| Range | Layout contract |
| --- | --- |
| Compact mobile, under 430px | One content column; fixed bottom navigation; no persistent left rail; controls use text labels when ambiguity is possible; card art and primary action remain above the fold. |
| Mobile/tablet, 430–767px | One column with optional stacked tool groups; sheets and drawers are full-width with safe-area padding; reading panel is a modal layer with an explicit close action. |
| Wide tablet, 768–1099px | Two-column composition only when the content measure remains readable; Room controls collapse to labeled groups; sidebar can become a compact rail. |
| Desktop, 1100px and up | Persistent navigation and contextual floating controls are allowed; reading panel may sit beside the tabletop; content still owns the dominant visual hierarchy. |

The important responsive unit is not viewport width alone. It is “available reading width after functional chrome.” Each route should have a `contentMeasure`, `controlDensity`, and `surfaceMode` contract so a narrow reading panel does not inherit Home’s art-direction assumptions.

## Route-specific UX recommendations

### Home

Keep the large Hello/ritual moment, but establish one clear action hierarchy: create ritual first, daily spread second, exploration third. The left rail and footer should be visually quiet at rest and become more legible on focus/hover. A clear Glass surface may support the topbar and rail; the hero artwork should never sit behind a grid of equally opaque cards.

### Create ritual

Make progress explicit with “Question” and “Direction” steps, but do not add a wizard chrome that competes with the question. Use a single elevated focus surface, a labeled context field, visible character limits, and clear error text. Topic tiles should expose their selected state with border, tint, and text—not glow alone. Suggestions in step two should read as optional prompts, not preselected answers.

### Guidebook

Keep the world map and orbit language. Add a persistent search/filter affordance with a compact functional material, then let card imagery remain crisp. On mobile, family filters become a horizontally scrollable labeled control or sheet; card detail uses a readable column with orientation tabs that remain reachable by keyboard.

### Room / SpreadBoard

The Room must preserve the current tabletop as the stage and place controls into three tiers:

- Tier A: leave, media, zoom/pan, and essential session state.
- Tier B: draw, spread, theme, reversal, card picker, and guidebook.
- Tier C: annotation, save, restart, share, and secondary utilities.

Tier A should be visible or one action away. Tier B should be grouped in one contextual rail or bottom dock. Tier C can live in a sheet. The reading panel should be a sibling composition, not a glass card embedded inside the deck geometry.

### Reading and journal

Direct answer, personal insights, next steps, reflection, and evidence should read like one editorial document with section rhythm. Use a quiet surface with dividers and a single action footer. Saved reading cards should expose date, question, spread, and card thumbnails in the first scan; the interpretation body should open only when requested.

### Profile and future commerce

Profile stays a service/status surface until booking, payment, and affiliate capabilities are real. Future pricing, checkout, VIP, and affiliate surfaces should use the same semantic controls but a stricter “trust mode”: opaque form controls, explicit totals, clear ownership, and no decorative refraction near payment confirmation.

## Current-to-future inventory

| Current | Future V1 role | Migration rule |
| --- | --- | --- |
| Multiple route shells | One shell family with route surface modes | Normalize tokens first; do not merge route markup prematurely. |
| Fixed glassy nav/sidebar/footer | Functional Glass layer | Centralize material tokens and add opaque fallback. |
| Direct route CSS | Component and surface recipes | Move one component contract at a time and keep visual snapshots. |
| `room-page` geometry and state | Stable SpreadBoard core | Only wrap controls and panels; never rewrite card math during visual work. |
| Reading panel editorial styling | Reading document surface | Keep text calm; reserve glass for the outer panel edge and actions. |
| Native language select | Accessible locale control | Retain native semantics unless a replacement passes keyboard and screen-reader checks. |
| Pointer/scroll effects on Home | Bounded ambient motion | Pause on reduced motion, battery saver, hidden tab, and low-power device heuristics. |
| Profile service-status copy | Honest capability state | Do not add fake payment or booking interactions before their contracts exist. |

## Research disposition

### Adopt

- Existing NaTarot brand assets, color anchors, Work Sans + Instrument Serif pairing, and editorial reading structure.
- Radix behavior primitives and the project’s existing shadcn-style source ownership model.
- Lucide functional icons with accessible names and consistent stroke/optical sizing.
- CSS transitions and the current requestAnimationFrame scene effects where they remain within a measured budget.

### Adapt

- shadcn/ui component patterns as local source code, not as a visual theme.
- Cult UI’s copy-in visual exploration pattern for isolated prototypes only.
- Magic UI’s interaction ideas for hero/ambient moments only after motion and accessibility review.
- tweakcn as a token exploration and contrast-checking aid, not as a runtime dependency.

### Reference only

- Apple Liquid Glass principles and materials guidance.
- LiquidLens and the named Liquid Glass repositories for refraction math, fallbacks, and performance caveats.
- Motion documentation for a future measured gesture or layout transition.

### Reject for V1 runtime

- A global liquid-glass wrapper around every card and reading section.
- A new component library that duplicates the current Radix/shadcn behavior layer.
- A WebGL or SVG displacement dependency on the critical path of every route.
- Unbounded pointer-reactive blur, chromatic aberration, or continuous shader animation on mobile.
- Any dependency that changes authentication, Tarot business logic, persistence, or room geometry merely to achieve a visual effect.

## Success criteria for the next implementation phase

The research is ready to implement when a developer can answer these questions without re-reading the entire stylesheet:

- Which surface level does this component use, and what is its fallback?
- Is this element content, navigation, control, transient feedback, or ambient art?
- What happens in Vietnamese, at 360px, with reduced motion, and without backdrop filters?
- Which behavior primitive owns focus, keyboard navigation, dismissal, and announcements?
- Does the change preserve Room geometry, card state, reading contracts, auth ownership, and persistence?
- Can the effect be disabled or simplified on a mid-range mobile device without losing the task?

The detailed material, token, architecture, and rollout decisions are in the companion documents:

- [NATAROT_LIQUID_GLASS_RESEARCH.md](NATAROT_LIQUID_GLASS_RESEARCH.md)
- [NATAROT_DESIGN_SYSTEM_V1.md](NATAROT_DESIGN_SYSTEM_V1.md)
- [NATAROT_COMPONENT_ARCHITECTURE.md](NATAROT_COMPONENT_ARCHITECTURE.md)
- [NATAROT_UI_ROADMAP.md](NATAROT_UI_ROADMAP.md)
