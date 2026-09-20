# NaTarot — Liquid Glass Design System V1

**Status:** Design specification only; no runtime implementation in this branch

**Visual reference:** Moonlight-inspired celestial space, retained and refined for NaTarot

**Product promise:** A quiet, premium space between a person and the cards

## 1. Design stance

NaTarot should feel like entering a private observatory: dark, spacious, tactile, and editorial. Gold is an instrument of attention, not decoration applied to every edge. Glass is a functional layer that floats above the observatory; the cards, writing, and interpretation remain the subject.

### Non-negotiables

- Preserve the NaTarot name, logo assets, celestial imagery, Tarot card art, and Moonlight reference character.
- Keep the primary visual hierarchy: content and card meaning first, functional chrome second, ambient atmosphere third.
- Keep Vietnamese and English as equal product languages. Never solve overflow by hiding, clipping, or shrinking Vietnamese copy.
- Keep the Room’s existing state and geometry contracts intact.
- Treat glass as a five-level progressive material, with an opaque Level 1 fallback for every component.
- Use accessible native semantics and behavior primitives beneath every visual surface.
- Make motion optional, bounded, and meaningful.

### Principles

1. **Content is the constellation.** Artwork, question, card identity, and interpretation receive the clearest contrast and the most space.
2. **Chrome floats; content rests.** Navigation, tools, sheets, and transient controls may use glass; long-form reading and form labels should be calmer.
3. **Gold marks attention.** Use gold for action, focus, selected state, and key dividers—not for every border.
4. **Depth must explain hierarchy.** Blur, edge, and shadow should show what is above what, not merely make a panel look expensive.
5. **Optics earn their cost.** Strong lensing appears only when it helps the user understand focus, selection, or a meaningful transition.
6. **Quiet states are designed states.** Reduced motion, reduced transparency, unsupported filters, and narrow screens should feel deliberate.

## 2. Semantic token foundation

The existing NaTarot colors are retained as source anchors and mapped to semantic roles. The values below are the V1 proposal; the first implementation should create the mapping before changing individual route rules.

### Color and content roles

```css
:root {
  --nt-canvas-deep: #061522;
  --nt-canvas: #081a2a;
  --nt-panel: #0b2032;
  --nt-panel-raised: #10283b;
  --nt-gold: #d7b36a;
  --nt-gold-strong: #e7c77d;
  --nt-gold-bright: #f4d99c;
  --nt-ivory: #f4ebdd;
  --nt-text: #eee5d7;
  --nt-text-muted: rgba(238, 229, 215, .62);
  --nt-text-subtle: rgba(238, 229, 215, .42);

  --nt-stroke-quiet: rgba(215, 179, 106, .25);
  --nt-stroke-strong: rgba(231, 199, 125, .75);
  --nt-stroke-focus: rgba(231, 199, 125, .90);
  --nt-tint-gold: rgba(215, 179, 106, .16);
  --nt-tint-ivory: rgba(244, 235, 221, .06);

  --nt-glass-2-fill: rgba(11, 32, 50, .72);
  --nt-glass-3-fill: rgba(11, 32, 50, .54);
  --nt-glass-4-fill: rgba(11, 32, 50, .38);
  --nt-glass-5-fill: rgba(11, 32, 50, .30);
}
```

Use semantic names in component styles. A route may alias its theme for art direction, but components should ask for `content.primary`, `surface.panel`, or `accent.primary`, not hard-code “gold-500” or “blue-900”.

### Surface roles

| Role | Default material | Content relationship |
| --- | --- | --- |
| `surface.canvas` | Level 1 | The cosmic scene and main tabletop. |
| `surface.panel` | Level 1 or 2 | Forms, reading container, guidebook sections. |
| `surface.chrome` | Level 2 | Topbar, sidebar, footer, bottom nav. |
| `surface.tool` | Level 2/3 | Room controls, filters, contextual tool groups. |
| `surface.focus` | Level 3/4 | Selected or currently active functional object. |
| `surface.transient` | Level 2/3 | Toast, tooltip, status, ephemeral helper. |
| `surface.trust` | Level 1 | Payment, booking confirmation, account ownership, destructive action. |

### State roles

```text
default     quiet border + readable text
hover       small tint shift; no scale jump required
focus       2px outside ring using stroke.focus + inner separation
pressed     tint/translate change; no content blur
selected    gold border/tint + text/icon confirmation
disabled    opacity and cursor change, still legible
loading     reserved geometry + status announcement
success     restrained green/teal semantic accent; never gold only
error       red/rose semantic accent + text; never glow only
```

Success and error colors are intentionally separate from the heritage gold. The palette should remain celestial without asking users to decode gold as every possible state.

## 3. Spacing, geometry, and elevation

### Spacing scale

Use a four-point base with eight-point rhythm for major layout:

```text
0   0px       hairline / optical alignment
1   4px       icon-to-label and compact gaps
2   8px       control internals
3   12px      field and chip gaps
4   16px      default control and panel padding
5   20px      compact section rhythm
6   24px      standard card/panel padding
8   32px      section separation
10  40px      feature breathing room
12  48px      hero and reading section separation
16  64px      major page rhythm
```

The scale is a vocabulary, not a mandate to pad every glass surface. The Room uses tighter control density; Home and reading use larger breathing room.

### Radius roles

```text
radius-control  10–12px     inputs, compact buttons, tool items
radius-panel    16–20px     drawers, sheets, standard panels
radius-feature  24–30px     hero CTA, daily spread, large surfaces
radius-pill     999px       tags, compact nav, segmented controls
radius-card     artwork-defined; do not crop card art for a global radius
```

The current `.5rem`, `.75rem`, and `1rem` brand radius variables should map into this scale before any new values are introduced.

### Elevation roles

```text
elevation-rest       0 8px 24px rgba(0,0,0,.16)
elevation-floating   0 18px 48px rgba(0,0,0,.28)
elevation-modal      0 28px 72px rgba(0,0,0,.42)
elevation-room-tool  0 16px 45px rgba(2,8,18,.42)
```

Use one primary shadow plus an optional 1px inner highlight. Multiple large shadows and repeated gold glows quickly flatten the hierarchy.

## 4. Typography

### Roles

| Role | Family | Weight/measure | Use |
| --- | --- | --- | --- |
| Display question | Instrument Serif, with a Work Sans fallback if a glyph is missing | 400, `clamp(2.3rem, 6vw, 5.5rem)`, 12–18 words max | Home greeting, Create question, one focal reading title. |
| Section heading | Instrument Serif or Work Sans 600 | 28–40px, 18–28ch | Guidebook, journal, reading sections. |
| Body | Work Sans | 400–500, 15–18px, 60–72ch | Interpretation, prompts, help, status copy. |
| UI label | Work Sans | 600, 10–13px, optional tracking | Navigation, toolbars, metadata, short actions. |
| Caption/meta | Work Sans | 400–600, 11–13px | Date, orientation, saved state, helper copy. |

Work Sans remains the operational family because it is already loaded as a variable font. Instrument Serif remains a focal display family. During implementation, verify Vietnamese glyph coverage for every loaded font file; if a display glyph is absent, allow the browser to fall back rather than substitute a broken character or reduce size.

### Copy rules

- Prefer sentence case for questions, explanations, and action labels.
- Use uppercase only for short labels, categories, or the existing brand voice where the translated string remains readable.
- Keep one idea per line in a hero question; never force a fixed line break in Vietnamese.
- Label an action by its outcome: “Save reading,” “Draw a card,” “Open guidebook.”
- Use “glass” in documentation and code concepts, not in user-facing copy unless the material itself is a product feature.

## 5. Glass tokens

Glass recipes are implemented as tokens and variants, not duplicated route selectors.

```css
--nt-glass-blur-2: 12px;
--nt-glass-blur-3: 16px;
--nt-glass-blur-4: 18px;
--nt-glass-saturation-2: 115%;
--nt-glass-saturation-3: 125%;
--nt-glass-edge: rgba(244, 235, 221, .10);
--nt-glass-edge-gold: rgba(215, 179, 106, .25);
--nt-glass-highlight: rgba(255, 255, 255, .045);
--nt-glass-shadow: 0 18px 48px rgba(0, 0, 0, .28);
```

Each variant must provide:

- `base`: opaque background, border, shadow;
- `enhanced`: same base plus blur/saturation;
- `selected`: enhanced surface plus semantic accent;
- `reduced`: Level 1 behavior;
- `focus-visible`: outside focus ring independent of background.

The CSS implementation should use `@supports (backdrop-filter: blur(1px))` and preserve the base declarations before the enhanced declarations. Displacement/refraction belongs in an explicit `lens` variant, not in the base `glass` class.

## 6. Icon system

Lucide remains the functional icon system. The official project documents `lucide-react` and a free commercial/personal-use license; see the [Lucide repository](https://github.com/lucide-icons/lucide) and [license](https://github.com/lucide-icons/lucide/blob/main/LICENSE).

Rules:

- Use one icon per action, aligned to a 24px box.
- Default stroke is 1.75–2px; use 1.5px only for dense metadata and 2px for primary actions.
- Use `currentColor`; do not bake gold into an icon asset.
- Decorative icons are `aria-hidden="true"`; action icons have a visible label or accessible name.
- Icon-only actions require a tooltip or adjacent label, plus a programmatic accessible name.
- Do not use icons as the only representation of card orientation, reversal, or destructive state.
- Use the NaTarot logo assets for identity; do not recreate the wordmark from generic icons.

Room tool icons should be grouped by the action hierarchy defined in the architecture document. The shape of the icon is not a substitute for a tooltip, status announcement, or text label.

## 7. Motion system

### Motion levels

| Level | Behavior | Use |
| --- | --- | --- |
| M0 | Instant state change | Reduced motion, reduced power, critical status, payment/trust surfaces. |
| M1 | 120–220ms opacity/transform transition | Hover, focus, button press, sheet affordance. |
| M2 | 260–520ms eased transition | Panel enter/exit, card reveal, route surface transition. |
| M3 | Spring/gesture or ambient loop | One focal ritual interaction or selected Room tool, only after measurement. |

Rules:

- Prefer CSS for simple state changes. A future Motion dependency is justified only for gestures, layout transitions, or coordinated sequences that CSS cannot express cleanly; see [Motion for React](https://motion.dev/docs/react).
- Animate `transform` and `opacity` before `filter`, `background-image`, or layout dimensions.
- Do not combine a large blur animation, a displacement animation, and a full-page pointer loop.
- Pause ambient motion when the page is hidden or the element is offscreen.
- Respect `prefers-reduced-motion: reduce`; render the final state and preserve information hierarchy.
- Card reveal motion should explain orientation and sequence, not make the user wait for decoration.
- Never make a save, error, permission, or auth state visible only through motion.

## 8. Responsive rules

### Shells

- Desktop: persistent left navigation and functional topbar are allowed; the main content uses the remaining width.
- Tablet: sidebar becomes a compact rail or contextual drawer; preserve a readable main measure.
- Mobile: use fixed bottom navigation with safe-area padding; no persistent left rail; put secondary tools in a sheet.
- Room mobile: keep the tabletop as the stage, use a labeled bottom tool dock, and open the reading panel as a full-height sheet with a close action.

### Content measures

```text
reading measure     60–72ch
form measure        32–52rem depending on context
hero measure        12–24ch for a focal display question
control group       2–6 related actions before collapsing
```

Use `clamp()` and `min()` for fluid spacing, but preserve minimum touch targets and text size. Avoid viewport-height locking for forms and readings; mobile browser chrome and the keyboard make `100vh` unreliable.

### Safe areas and touch

- Include `env(safe-area-inset-bottom)` in mobile navigation and Room tool docks.
- Keep primary touch targets at least 44px in both dimensions.
- Avoid hover-only meaning; every hover enhancement needs a focus, selected, or pressed equivalent.
- Prevent decorative pointer tracking from intercepting card taps, text selection, scrolling, or keyboard focus.

## 9. Accessibility and contrast

Use [WCAG 2.2 contrast minimum guidance](https://www.w3.org/TR/WCAG22/#contrast-minimum) as the baseline: normal text must meet the relevant 4.5:1 threshold, large text the 3:1 threshold, and UI component boundaries/focus indicators must remain discernible. Validate the actual rendered surface over the brightest and darkest artwork samples; token contrast alone is not sufficient for clear glass.

Every component must pass:

- keyboard navigation and visible focus;
- screen-reader name, role, value, and state;
- reduced motion and reduced transparency;
- zoom/reflow at narrow widths;
- English and Vietnamese copy lengths;
- high-contrast/forced-colors behavior where supported;
- error, loading, empty, and disabled states.

For Dialog, Sheet, Popover, Tabs, Dropdown, and Sidebar behavior, continue using the local Radix-backed primitives and preserve their focus/dismissal contracts. Radix explicitly notes that the consumer still provides meaningful labels and context; see [Radix accessibility](https://www.radix-ui.com/primitives/docs/overview/accessibility).

## 10. Component visual recipes

### `NaSurface`

Base semantic surface. Props conceptually include `tone`, `materialLevel`, `elevation`, `interactive`, and `as`. It must render a Level 1 base first and enhance through CSS capability and user preferences.

### `NaButton`

Primary, secondary, quiet, destructive, and icon variants. Primary uses ivory/dark or gold/dark contrast; secondary uses a quiet border; icon variant gets an accessible name and focus ring. A button never depends on glass to communicate clickability.

### `NaField`

Label, description, input, character count, error, and status. Input background defaults to Level 1/quiet Level 2. The focus ring is external to the translucent fill.

### `NaSheet` / `NaDialog`

Radix-backed behavior with a surface recipe. The title and description are required in the contract; close returns focus to the trigger; the mobile sheet includes safe-area padding and an obvious dismiss affordance.

### `NaToolbar`

Named group of related actions with `aria-label`, visible grouping, active state, and collapse behavior. It owns density and material level; individual buttons do not each create their own independent glass island.

### `NaReadingDocument`

Editorial document surface with section heading, body measure, evidence disclosure, follow-up field, and fixed action footer. It defaults to Level 1/quiet Level 2 and explicitly opts out of lensing.

### `NaCardTile`

Card art remains crisp. Surface treatment surrounds metadata or selection state; do not put backdrop blur over the image itself unless the card is intentionally presented as a background.

## 11. Design-system acceptance checklist

Before a component is considered V1-ready:

- it has a semantic role and an explicit content/chrome classification;
- it uses a token role instead of a direct visual constant;
- it renders a Level 1 fallback first;
- it has keyboard/focus/announcement behavior;
- it fits Vietnamese and English copy;
- it passes narrow/mobile and safe-area checks;
- it documents its motion level and reduced-motion state;
- it does not introduce a duplicate behavior primitive or new visual library without a measured need;
- it does not touch Room business logic or card geometry merely to apply a surface.

The implementation sequence, page blueprints, and regression gates are defined in [NATAROT_COMPONENT_ARCHITECTURE.md](NATAROT_COMPONENT_ARCHITECTURE.md) and [NATAROT_UI_ROADMAP.md](NATAROT_UI_ROADMAP.md).
