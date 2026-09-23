# Dynamic Reading Result Design

## Status

Approved direction: immersive NaTarot Reading Result surface with one reusable, spread-aware card renderer.

## Context

The current Room opens a `ReadingPanel` inside `.room-reading-panel-shell`. The panel already owns the reading hierarchy, save/close actions, follow-up requests, loading/error states, and the exact normalized reading payload. The Room also owns the current canonical spread layout resolver in `lib/room-motion.ts`, which maps the existing spread types to semantic positions using position keys and order.

The current catalog contains 57 active templates and these card counts: 1, 2, 3, 4, 5, and 10. Its spread types are `single`, `row-2`, `row-3`, `row-4`, `row-5`, `triangle`, `top-1-bottom-3`, `cross-4`, `yes-no`, and `celtic-cross`. The catalog stores card count, semantic position order, localized labels, meanings, and prompts; it does not currently store normalized coordinates. The existing `resolveSpreadLayout` maps the canonical relationships from those definitions to pixel offsets and rotations.

The supplied reference images define the visual language only: NaTarot/Moonlight midnight observatory, celestial artwork, ivory editorial typography, antique gold dividers, translucent navy surfaces, prominent cards, and readable long-form interpretation. The four-card arrangement is not a product contract.

## Goals

- Make the interpretation surface feel like a finished Reading Result view inspired by the second reference image.
- Preserve every existing Room/API behavior: reading generation, save, close, retry, follow-up, loading, errors, locale, artwork, card orientation, and card evidence.
- Create one shared geometry contract so Room and Reading Result cannot drift into separate layout systems.
- Use actual `cardEvidence` positions, labels, meanings, order, and orientations instead of reference-specific labels or card counts.
- Keep long spreads readable and vertically scrollable rather than compressing them into tiny thumbnails.
- Keep mobile semantically ordered, readable, and free of horizontal overflow.
- Keep reduced-motion behavior calm and accessible.

## Non-goals

- No new route, public share system, image export, QR code, payment, authentication, provider, database, or saved-reading hydration work.
- No change to tarot draw semantics, orientation generation, spread catalog data, AI schema, prompt, or persistence.
- No hard-coded four-card result layout.
- No new production spread definitions solely to satisfy the reference image.

## Chosen approach

### One canonical geometry module

Extract the layout knowledge currently embedded in `lib/room-motion.ts` into a focused shared module. The module will retain the existing semantic mapping by spread type, position key, and position order. It will expose both:

1. A canonical geometry result expressed in a stable design coordinate space with calculated bounds, per-position scale, rotation, and optional row/group information.
2. A pure responsive projection function that receives the canonical result plus available width, height, card aspect ratio, card-count context, and readability constraints, then returns card width/height and final placements.

The coordinate space is normalized from the existing canonical offsets; it is not inferred from the screenshot and is not a generic CSS grid. Existing Room callers will receive equivalent pixel placements through a compatibility adapter so the current tabletop stays visually stable.

If a spread type has no canonical geometry, the module will use a deterministic fallback derived from position order. Known spread types always take the canonical path. The fallback supports any count without an artificial ten-card ceiling.

### Reusable Reading Result spread component

Add a single reading spread component under `components/reading/` that consumes:

- `spreadType` from the active Room template,
- the ordered `cardEvidence` items from the normalized reading,
- artwork keyed by `readingCardId`,
- locale and translator,
- available size supplied by a `ResizeObserver`-backed canvas hook or equivalent existing project pattern.

The component will render a responsive canvas in either `geometry` mode or `ordered` mobile mode. Each card keeps its image, actual position label, upright/reversed status, and short position meaning. Card artwork may rotate 180 degrees for reversed cards; surrounding text remains in normal document orientation. The card stage will expose accessible labels and a deterministic DOM order matching the reading position order even when visual placement uses absolute geometry.

The current collapsed tarot evidence section remains the full interpretation source for every card and continues to show the provider-backed interpretation text. The new spread stage is the visual overview, not a second interpretation payload.

### Immersive Reading Result composition

When interpretation is open, the existing Room reading shell will expand to an immersive result surface under the existing Room header. The tabletop becomes visually subordinate/hidden while the result surface owns the scroll region. The result content order will be:

1. Reading header with the actual question, optional reader name, active spread name, deck name, and card count.
2. Dynamic spread stage as the primary visual element.
3. Existing direct answer, deeper reading, personal insights, next steps, reflection prompts, collapsed card evidence, and follow-up in their current data-driven order.
4. Existing save and close actions in the footer.

The desktop composition will use the available width for the spread first and may place metadata beside the stage only when the measured space keeps cards readable. The body remains an editorial reading flow; it will not become a dashboard of competing columns. Long spreads are allowed to create more vertical space. On mobile, the stage falls back to a semantic ordered card sequence when preserving geometry would make cards or labels unreadable.

Visual treatment will extend the existing NaTarot tokens: deep navy/celestial backdrop, subtle star/nebula layers already available to Room, antique-gold rules and focus states, Instrument Serif for editorial headings, Work Sans for controls/body, glass surfaces with restrained borders, and no new branding system.

## Data flow

```text
Room active template + normalized reading payload
  -> ReadingPanel session metadata + cardEvidence
  -> shared spread geometry resolver
  -> responsive projection for the measured canvas
  -> ReadingSpread cards
  -> existing reading sections and actions
```

The Room will pass the active template `spreadType` and template name rather than reconstructing a spread name from position labels. The normalized payload remains authoritative for card order, position data, orientation, and interpretation.

## Responsive rules

- Desktop: preserve canonical spatial relationships and use the largest card size that fits the measured canvas without clipping.
- Tablet: scale the same geometry and allow the stage to grow vertically when width is constrained.
- Mobile: use scaled geometry when card width and label measure remain readable; otherwise use ordered card rows/cards with the canonical reading order.
- All modes: preserve card aspect ratio, prevent horizontal document overflow, keep text labels upright, and keep the stage vertically scrollable.
- The projection function will be deterministic for the same geometry and constraints so visual QA and future spread additions remain stable.

## Error and loading behavior

The spread stage renders only when normalized reading evidence exists. Loading, empty, and provider-error states retain the existing `ReadingPanel` status behavior. Missing artwork renders a framed accessible placeholder with the actual card name. A missing or unknown spread type uses the deterministic fallback rather than throwing or hiding the reading.

## Accessibility

- The result remains an accessible `aside` with the existing translated label.
- The spread canvas exposes a descriptive label and each card has an accessible name containing position, card name, and orientation.
- Visual order is never the only source of meaning; DOM order follows `position.order`.
- Existing 44px save/close/follow-up controls and keyboard focus rings remain.
- Reduced motion disables stage entrance/lift transitions and disclosure animations.

## Verification strategy

Before implementation code, add failing tests for the shared geometry/projection contract and Reading Result wiring. The focused suite will cover:

- every existing canonical spread type,
- one, three, four, five, seven, and ten-card fixtures,
- position order and labels,
- upright and reversed orientation handling,
- fallback behavior for an unknown geometry,
- no negative/clipped placements under representative desktop/mobile constraints,
- no artificial ten-card limit,
- the ReadingPanel-to-spread data boundary and full-screen shell behavior.

After implementation, run focused tests, the full tracked test suite, TypeScript, production build, and `git diff --check`. Browser QA will inspect at least 4-card desktop, 10-card desktop, 4-card at 390px, and 10-card at 390px, plus representative 1/3/5/7-card fixtures. Each capture will check visibility, order, labels, orientation, overlap/clipping, horizontal overflow, and balanced composition.

## Expected files

- Create `lib/spread-geometry.ts` for the shared canonical geometry and responsive projection contract.
- Create `components/reading/reading-spread.tsx` for the reusable visual spread stage.
- Modify `lib/room-motion.ts` to use the shared geometry contract without changing existing Room-facing behavior.
- Modify `components/reading/reading-types.ts`, `reading-panel.tsx`, and `reading-header.tsx` to carry active spread metadata and render the stage.
- Modify `app/room/room.tsx` to pass the active template geometry key/name.
- Modify `app/globals.css` for the immersive result shell, spread canvas/card treatment, responsive fallback, and reduced-motion rules.
- Add focused tests under `tests/` for geometry, Reading Result wiring, and responsive safety.
- Update `docs/PROJECT_STATE.md` with the verified implementation state and any remaining QA limits before the session ends.
