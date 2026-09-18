# NaTarot Brand System Design

## Status

Approved direction: token-first brand synchronization for the existing NaTarot product. The visual reference defines color, logo character, typography hierarchy, spacing, and celestial language; existing product copy, routes, interactions, artwork, and backend behavior remain authoritative.

## Product truth and constraints

NaTarot is an introspective tarot product with a Moonlight-inspired cosmic environment. The interface should feel mystical, elegant, premium, calm, introspective, and celestial. It must not read as a fantasy game, casino, neon interface, gothic-horror product, SaaS dashboard, or an over-decorated poster.

The implementation must not change:

- Tarot draw, shuffle, spread, reading, or card-art behavior.
- Database schema, persistence, API contracts, or provider behavior.
- ChatGPT authentication and sign-in routing.
- Existing route structure or bilingual English/Vietnamese copy.
- Responsive interaction patterns, including mobile Room sheets and bottom navigation.

The work is limited to branding, semantic design tokens, reusable visual primitives, and the shared visual treatment of existing surfaces.

## Current implementation findings

- `app/globals.css` is the central stylesheet, but the baseline variables are still light/black while route-specific systems are layered later through `--na-*`, `--tarot-*`, `--daily-*`, `--practice-*`, and `--create-*` values.
- `app/vintarot.tsx` owns the shared header, sidebar, footer, language control, utility controls, and home composition. The header currently renders a text-only `NaTarot` wordmark; there is no reusable logo component.
- `components/card-mark.tsx` is a generic decorative card mark, not the NaTarot identity mark.
- `components/ui/button.tsx`, `components/ui/input.tsx`, `components/ui/card.tsx`, and `components/ui/dialog.tsx` are shadcn-style primitives with light/default tokens that do not yet express the NaTarot semantic system.
- `app/room/room.tsx` and `components/reading/*` own the immersive tabletop and reading pane; their interactions and content hierarchy must remain intact while their surfaces consume shared semantic aliases.
- The repository contains `Instrument Serif` and `Work Sans` font assets. They already satisfy the requested editorial-serif/display and readable-sans roles; no new font dependency is needed.
- `public/favicon.svg` is a legacy lavender crescent mark. No production NaTarot SVG logo asset was supplied with the reference image.
- There is no local Login/Register page in this repository. Authenticated gates use the existing `/signin-with-chatgpt` destination. Only the local sign-in gate can be visually branded here; the external auth screen is out of scope.

## Design system architecture

### 1. Semantic token layer

Add one canonical NaTarot token layer near the top of `app/globals.css`. The values remain semantic so surfaces can vary in decoration without inventing a second palette.

```css
:root {
  --color-bg-deep: #061522;
  --color-bg: #081a2a;
  --color-surface: #0b2032;
  --color-surface-elevated: #10283b;
  --color-surface-soft: rgba(11, 32, 50, 0.72);
  --color-gold: #d7b36a;
  --color-gold-bright: #e7c77d;
  --color-gold-muted: rgba(215, 179, 106, 0.52);
  --color-gold-subtle: rgba(215, 179, 106, 0.16);
  --color-ivory: #f4ebdd;
  --color-text: #eee5d7;
  --color-text-muted: rgba(238, 229, 215, 0.62);
  --color-text-subtle: rgba(238, 229, 215, 0.42);
  --color-border: rgba(215, 179, 106, 0.25);
  --color-border-active: rgba(231, 199, 125, 0.75);
  --color-focus: rgba(231, 199, 125, 0.9);
  --radius-control: 14px;
  --radius-panel: 18px;
  --radius-panel-large: 24px;
  --shadow-panel: 0 20px 55px rgba(1, 8, 17, 0.32);
  --shadow-card: 0 16px 32px rgba(1, 8, 17, 0.42);
}
```

The existing route-specific tokens remain as compatibility aliases where the route requires a distinct atmospheric treatment. They should point back to the semantic layer instead of introducing competing hard-coded hues. `@theme inline` maps Tailwind/shadcn names such as `background`, `foreground`, `card`, `border`, `input`, `ring`, `sidebar`, `midnight-navy`, `ivory`, and `antique-gold` to these semantic values.

Gold usage is hierarchical:

- 100% emphasis for active state, primary CTA, selected card edge, and key celestial ornament.
- 40–60% emphasis for button/panel borders and dividers.
- 20–30% emphasis for utility controls and inactive separators.
- 5–15% emphasis for background geometry, constellations, and decoration.

### 2. Logo system

Create `components/brand/logo.tsx` with a typed variant API:

```ts
type LogoVariant = "dark" | "light" | "icon";
type LogoProps = {
  variant?: LogoVariant;
  compact?: boolean;
  href?: string;
  className?: string;
};
```

The component is the single header/footer/brand-mark integration point. It links to `/` by default, exposes an accessible name, and hides the tagline from the compact header logo. Desktop header composition is icon + `NaTarot` + optional separate tagline; mobile composition is icon + wordmark only.

Because the supplied input is a screenshot rather than a production logo file, the implementation will not crop the screenshot or embed it as a logo. The component will use explicit replaceable assets under `public/brand/`:

- `natarot-icon.svg` — crescent moon + four-point star for favicon, compact navigation, and loading marks.
- `natarot-logo-dark.svg` — champagne/ivory lockup for navy surfaces.
- `natarot-logo-light.svg` — deep-navy/antique-gold lockup for light surfaces.

The initial vector mark may be a restrained hand-authored placeholder matching the approved geometry; the asset paths stay stable so an exact production SVG can replace them without changing component consumers. No JPG or screenshot-derived asset is used.

Update `app/layout.tsx` metadata and `public/favicon.svg` to use the icon-only mark. The favicon must retain a simple silhouette that remains legible at 16px, 32px, and 64px.

### 3. Shared component primitives

Update the existing primitives rather than introducing a second UI library:

- `components/ui/button.tsx`: expose `primary`, `secondary`, `ghost`, and `icon` variants while preserving existing `default`, `outline`, `secondary`, `ghost`, `link`, and `destructive` callers through compatible aliases. Icon buttons have a 44px minimum touch target. Primary buttons use dark/navy fill, gold edge, and ivory text; they do not use a bright yellow gradient or large glow.
- `components/ui/input.tsx` and the global `input`, `textarea`, and `select` rules: use dark transparent surfaces, low-opacity gold borders, 52–58px form controls where the surrounding form owns the height, muted-ivory labels/placeholders, and a clear but restrained gold focus ring.
- Add `components/ui/panel.tsx` as a small presentational surface primitive consumed by the shared shell, reading panel, and utility/form surfaces. Its API is class-name compatible with the existing route-specific panels and owns no business state.
- Add shared CSS classes for panel, divider, icon control, and focus states so legacy `.button` consumers in the existing pages can migrate without rewriting page behavior.
- Update dialog, tabs, field, badge, separator, and sidebar visual tokens through the shared theme instead of per-page one-off colors.

### 4. Shared shell

Update `app/vintarot.tsx` without changing navigation arrays or handlers:

- Header height settles in the 68–76px range on desktop.
- Logo gains the highest visual priority; tagline is a separate muted text element.
- Desktop retains language, utility, favorite, `+ Room`, and profile actions with secondary/utility emphasis.
- Mobile keeps only logo, language, theme/menu controls required by the current shell; desktop actions are not forced into the mobile row.
- Sidebar keeps the current routes and two navigation groups. Active items receive a subtle gold surface/accent; inactive icons use muted ivory rather than all-gold treatment.
- Footer gains a compact icon/wordmark and the existing brand tagline/links without becoming a tall marketing section. Existing marquee and links remain functional.

The Room shell continues to use its existing mobile-specific header and tabletop controls. It should consume the shared Logo, button, icon-button, dialog, and token aliases where the JSX already exposes equivalent controls.

### 5. Surface levels

Use three decoration levels so shared identity does not flatten every page into the same poster:

- Immersive: Room tabletop, card selection, and reading. Existing cosmic artwork, moon/stars, and geometry remain, but decoration and glow are restrained around the card object.
- Atmospheric: Home, Create, Practice, Guidebook, Daily, and local sign-in gates. Navy surfaces, subtle stars/moon/orbital geometry, and glass only where it supports hierarchy.
- Utility: profile, journal forms, service status, booking/invite dialogs, and other account-like states. Clean navy surfaces with minimal decoration.

Existing Tarot artwork and Moonlight background assets remain unchanged. The new system changes their surrounding surfaces, not the cards.

### 6. Responsive and accessibility rules

The brand system must remain usable at 320, 360, 375, 390, 414, 430, 768, 1024, 1280, 1440, and 1920px widths. Logo sizing changes by breakpoint: approximately 42–48px icon and 30–36px wordmark on desktop; 30–36px icon and 22–28px wordmark on mobile. Header tagline is hidden when the mobile width cannot support it.

All interactive states retain keyboard focus, disabled, loading, error, and reduced-motion behavior. Body text must maintain readable contrast on navy surfaces; controls maintain a minimum 44px touch target; dialogs remain keyboard-dismissible and scrollable; icon-only controls retain accessible labels.

## Migration and verification strategy

Migration is incremental and CSS-first:

1. Add token and compatibility aliases.
2. Add logo assets/component and switch shared shell integration.
3. Update shared primitives and legacy `.button`/form rules.
4. Migrate shell, dialog, reading, and route surface styles to semantic tokens.
5. Remove only dead conflicting style declarations after all consumers are migrated.

Before implementation code, add focused source-contract tests for the semantic token names, logo variants/asset paths, shared button/input contracts, and unchanged route/logic markers. Run the focused tests through a red-green cycle, then run the full tracked test suite, `npx tsc --noEmit`, `npm run build`, `git diff --check`, and the Impeccable detector over changed UI files. Browser QA will cover Home, Guidebook, Practice, Create, Room, Daily, sign-in gate, reading, and Reflection at desktop and mobile widths, including no-horizontal-overflow, interactions, locale switching, and console-error checks.

## Non-goals and known handoff

This spec does not add local registration, replace ChatGPT authentication, change Tarot business logic, replace Tarot artwork, change API/database contracts, or add a large UI dependency. The exact production logo SVGs are still a user-provided asset handoff; the stable component and public asset paths make that swap local and safe.
