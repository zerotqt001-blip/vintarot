# NaTarot — Liquid Glass Research and Material Specification

**Status:** V1 research specification, documentation-only

**Decision:** Use progressive, functional-layer glass. Do not make advanced refraction a global runtime dependency.

## 1. What “Liquid Glass” means for NaTarot

Basic glassmorphism usually means a semi-transparent surface plus a blurred backdrop, a light border, a shadow, and perhaps a gradient highlight. It creates separation, but the material itself is visually static.

Advanced Liquid Glass adds context-sensitive behavior: content behind the surface appears to bend or concentrate near its edge, highlights respond to shape and motion, surfaces adapt to their background, and transitions feel like materializing or dissolving rather than simply fading. Apple describes this as a dynamic digital material with “lensing,” while also directing designers to keep it in the functional layer and away from the main content layer. See [Apple’s Materials guidance](https://developer.apple.com/design/human-interface-guidelines/materials) and [Apple’s WWDC25 material overview](https://developer.apple.com/videos/play/wwdc2025/219/).

For NaTarot, the difference is a product decision:

| Basic glassmorphism | NaTarot Liquid Glass direction |
| --- | --- |
| A style applied to any card | A role-based material applied to navigation, tools, sheets, and transient controls |
| Blur is the effect | Blur is only one layer in a material stack |
| Same opacity everywhere | Surface responds to contrast, content behind it, and interaction state |
| Decorative sparkle can carry the illusion | Edges, depth, and motion explain what is floating above what |
| Usually no fallback plan | Every level has an opaque, readable fallback |
| Can obscure text when overused | Editorial content remains calm and mostly opaque |

The system should be inspired by Liquid Glass principles without attempting to clone Apple’s private rendering pipeline or visual assets.

## 2. Material model

Every future glass surface is modeled as five separable layers. A route may omit layers; it should never be forced to render all five.

1. **Backdrop:** the actual celestial art, card art, gradient, or tabletop behind the surface.
2. **Tint:** a semantic NaTarot color wash that controls contrast and hierarchy.
3. **Optical layer:** blur, saturation, translucency, and optionally a controlled displacement/refraction pass.
4. **Edge layer:** border, inner highlight, rim light, and shadow that define shape without relying on contrast through the backdrop.
5. **Interaction layer:** focus ring, press/drag response, active tint, and motion. This layer is disabled or simplified for reduced motion and low-power modes.

This model prevents a common failure mode: treating a translucent background as the entire component. A glass surface must still have readable text, a semantic role, a focus state, a fallback, and a bounded cost.

## 3. Five NaTarot material levels

The five levels include a non-glass fallback so the system remains resilient when transparency or advanced rendering is unavailable.

| Level | Name | Visual recipe | Appropriate use | Fallback and limits |
| --- | --- | --- | --- | --- |
| 1 | Moonlight Solid | Opaque `surface.canvas` or `surface.panel`, border, shadow, no blur or displacement. | Reduced-transparency mode, low-power devices, payment confirmation, dense editorial copy. | This is the guaranteed readable state. No dependency on `backdrop-filter`, SVG, Canvas, or WebGL. |
| 2 | Frosted Veil | Semi-transparent tint, `backdrop-filter: blur() saturate()`, quiet border, restrained shadow. | Topbar, sidebar, bottom nav, simple sheet, room tool group. | Falls back to Level 1 under `@supports` failure, high contrast, or explicit reduced transparency. Limit simultaneous surfaces. |
| 3 | Clear Layer | Lower tint opacity, stronger edge definition, inner highlight, adaptive shadow, optional background brightness adjustment. | Home hero CTA, Guidebook filters, transient status, a focused toolbar. | Falls back to Level 2 or Level 1. Never use behind long paragraphs unless contrast is verified. |
| 4 | Lens Accent | Level 3 plus localized SVG displacement or a captured backdrop, with a static first frame and paused/limited turbulence. | One hero control, selected Room tool, share preview, or a single focal surface on a rich background. | Falls back to Level 3. Do not apply to a grid of cards or every navigation item. |
| 5 | Living Liquid | Level 4 plus pointer/gesture-aware light, controlled lens motion, or a measured WebGL/canvas renderer. | Opt-in premium moment, immersive share artifact, or one Room interaction where the effect explains the action. | Falls back to Level 3/2 and preserves the action. One active renderer per route; never on the critical path of all pages. |

Level is a visual budget, not a prestige ranking. A Level 1 surface is correct for a reading paragraph if it improves comprehension; a Level 5 surface is wrong if it hides the card meaning or delays the task.

## 4. Browser and rendering constraints

`backdrop-filter` is now a Baseline 2024 feature across current browsers, but MDN still notes that older devices and browsers may not support it. The page must therefore declare an opaque background before the translucent enhancement and use `@supports` to opt into the effect. See [MDN `backdrop-filter`](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/backdrop-filter).

SVG `feDisplacementMap` can spatially displace an input image based on a second image’s pixel values. It is useful for a localized lens effect, but it is not equivalent to a native system material and can have browser-specific behavior. See [MDN `feDisplacementMap`](https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Element/feDisplacementMap).

The required progressive-enhancement order is:

```text
semantic HTML and content
  → opaque surface and visible border
    → CSS tint/gradient
      → backdrop blur and saturation
        → localized SVG/captured refraction
          → optional interaction-aware renderer
```

No stage may be required for the content to be understandable or for the primary action to work.

### Browser behavior requirements

- Detect support with CSS capability queries, not user-agent strings.
- Keep the base background and border visible before any effect is ready.
- Avoid an SSR/client mismatch by rendering the same semantic surface in the initial server output; enhance after capability detection.
- Do not use a dynamically generated filter ID that can collide across multiple surfaces.
- Keep displacement and capture layers `aria-hidden="true"`; the real control content remains in the normal DOM.
- Never use color fringing, blur, or background movement as the only selected, disabled, or error state.
- Honor `prefers-reduced-motion` and a separate reduced-transparency setting if product settings expose one.

## 5. Technique comparison

The table describes expected behavior and implementation risk. It is a decision benchmark, not a claim that a laboratory benchmark was run in this documentation-only phase.

| Technique | Visual capability | Cost profile | SSR/hydration risk | Fallback | NaTarot disposition |
| --- | --- | --- | --- | --- | --- |
| Solid/gradient surface | Tint and hierarchy | Minimal | None | Itself | Adopt for all roles as the base. |
| CSS `backdrop-filter` | Blur, saturation, color adjustment | Moderate paint/compositor cost; can compound across nested surfaces | Low if CSS-only | Opaque surface | Adopt for Level 2/3 with a surface budget. |
| Pseudo-element highlights/masks | Rim light, sheen, depth | Low to moderate paint cost | Low | Border/shadow | Adopt sparingly; keep decorative layers non-interactive. |
| SVG `feDisplacementMap` | Localized lensing and refraction | High GPU/paint cost; artifacts possible | Medium if filter is injected client-side | Level 3 | Reference/adapt for one focal surface after measurement. |
| Canvas scene capture | Precise source capture for a surface | CPU/GPU and memory cost; invalidation complexity | High if capture is needed before hydration | CSS blur | Reference only; no global capture in V1. |
| WebGL shader/capture | Rich refraction and chromatic behavior | Highest GPU/memory/thermal risk; context loss handling | High | Level 3/2 | Reject as a shared V1 dependency; allow an isolated prototype. |
| CSS/JS pointer light | Responsive highlight and tilt | Low to moderate; can cause event churn | Low | Static highlight | Adopt only for one focal control and pause when hidden. |
| Motion layout/gesture | Coordinated state transitions and gestures | Moderate bundle and runtime cost; still must animate compositor-safe properties | Low when initial state is stable | CSS transition or instant state | Adapt selectively; do not add a library for simple hover/focus. |

Apple’s guidance is a useful guardrail here: the most optical effect should not automatically be placed on the most content-heavy surface. Functional layer, content layer, and ambient art have different budgets.

## 6. Proposed performance budgets

These are acceptance targets for implementation phases. They are intentionally conservative until measurements exist on representative devices.

### Per-route budgets

- At most one Level 4/5 refractive surface active at a time.
- At most six Level 2/3 backdrop-filter surfaces visible in the Home shell; fewer in Room because the tabletop already has a high visual and GPU load.
- No continuous shader, turbulence, or pointer loop while the surface is offscreen, the document is hidden, reduced motion is enabled, or the user has disabled enhanced effects.
- No blocking network request or font wait for the glass effect.
- No visual effect may delay first contentful paint or the first usable form control.

### Interaction targets

- Target 60fps for a focused interaction on a representative mid-range mobile device; treat a sustained frame rate below 50fps during a primary action as a release blocker for that level.
- Animate `transform` and `opacity` where possible; avoid animating layout properties or large filter regions.
- Keep the active filter region close to the surface bounds; avoid applying filters to the entire page root.
- For Canvas/WebGL prototypes, document texture dimensions, capture frequency, context-loss behavior, and GPU memory before considering reuse.

### Measurement protocol

Each candidate material should be measured in a small route fixture containing: a starfield/celestial background, a card-art background, long text, six controls, a scrollable panel, and a mobile viewport.

Record:

1. Cold load and first usable paint with the effect disabled.
2. Cold load and first usable paint with the effect enabled.
3. 10-second idle frame time with no pointer movement.
4. 10-second pointer/drag interaction over the active surface.
5. Scroll through the surface with six sibling controls visible.
6. Reduced-motion and reduced-transparency behavior.
7. Browser matrix: current Chromium, Safari/WebKit, Firefox, and an iOS/Android representative device.
8. Text contrast and focus-ring visibility on the darkest and brightest background samples.

The result should be stored as a small implementation-phase benchmark note with browser version, device class, surface count, and effect level. Do not promote a material level based on a desktop-only demo.

## 7. Repository and library research

The following repositories were reviewed as design or implementation references. Their README claims are treated as repository-specific evidence, not independent performance certification.

| Reference | Observed contribution | NaTarot classification |
| --- | --- | --- |
| [DevBehindYou/LiquidLens](https://github.com/DevBehindYou/LiquidLens) | Cross-platform Liquid Glass exploration, including SVG displacement for web and bundled shader paths for other platforms. | Reference math and fallback ideas; do not adopt as a global dependency in V1. |
| [lucaperullo/simple-liquid-glass](https://github.com/lucaperullo/simple-liquid-glass) | React/web-component library with SVG optics, optional WebGL capture, SSR/hydration tests, browser tests, and bundle/capture budgets. | Best benchmark reference for capability detection and test surfaces; isolate before any adoption. |
| [ObaidQatan/liquid-glass-component-library](https://github.com/ObaidQatan/liquid-glass-component-library) | Experimental React/Tailwind library with a practical glass mode and an experimental refractive mode; README explicitly describes it as a personal learning project. | Reference-only. Useful for separating practical frosted mode from limit-testing refraction. |
| [zakisheriff/Liquid-Glass](https://github.com/zakisheriff/Liquid-Glass) | Small React package combining CSS layers, masks, `backdrop-filter`, and SVG displacement filters. | Reference-only; version, browser, and maintenance risk make it unsuitable for V1 lock-in. |
| [sohumsuthar/liquid-glass](https://github.com/sohumsuthar/liquid-glass) | Physics-oriented React implementation and accompanying explanation of refraction/Snell-law ideas. | Reference math and visual vocabulary; no runtime dependency decision. |
| [dpawlikowski/liquid-glass](https://github.com/dpawlikowski/liquid-glass) | CSS/SVG implementation with presets, an explicit fallback, reduced-motion handling, and performance cautions. | Strong reference for an isolated Level 4 prototype and for documenting practical limits. |
| [rizzytoday/liquid-glass](https://github.com/rizzytoday/liquid-glass) | Canvas-generated displacement map with SVG displacement and a Chromium-only full path plus blur fallback. | Reference for browser divergence; reject as a universal effect. |
| [nikdelvin/liquid-glass](https://github.com/nikdelvin/liquid-glass) | CSS/SVG recreation with a Safari fallback and component examples. | Reference-only for fallback language and component boundaries. |
| [nolly-studio/cult-ui](https://github.com/nolly-studio/cult-ui) | Copy-in, Tailwind-based design-engineering components compatible with shadcn-style ownership. | Adapt source exploration patterns; do not add a second runtime primitive layer. |
| [Magic UI components](https://magicui.design/docs/components) | Broad catalog of animation, beams, grids, particles, lens, marquee, and interactive display patterns. | Reference only for ambient moments; reject wholesale visual import. |
| [jnsahaj/tweakcn](https://github.com/jnsahaj/tweakcn) | Visual theme editor and preset exploration for Tailwind/shadcn token systems. | Adopt as a design-time aid if useful; no runtime dependency. |

The current project already has the behavior primitives needed for the first four levels. The existence of an impressive demo is not sufficient evidence to add a renderer to a Tarot application where card readability, mobile thermal cost, and SSR stability matter more than visual novelty.

## 8. Material recipes

### Functional chrome

Use Level 2 by default: opaque base, 72–88% dark tint, 12–16px blur when supported, a 1px low-alpha gold/ivory border, and a shadow that separates the surface from the artwork. Active/focus state changes tint and border, not only blur or glow.

### Home focal action

Use Level 3. The ritual button may receive a localized sheen or subtle lens accent, but the surrounding daily spread and feature copy should remain quieter. Keep the CTA shape generous and the label visible in both languages.

### Room tools

Use Level 2 for the persistent rail and Level 3 for the currently active group. The tabletop itself is not a glass surface. If a selected tool receives Level 4, the optical effect must sit behind the tool content and must never deform the cards or table controls.

### Reading and journal

Use Level 1 or a mostly opaque Level 2 panel. Long-form text should not shimmer, bend, or vary in contrast as the user scrolls. A translucent action footer can be used if the reading content remains clearly separated from it.

### Share preview

A future share artifact can use Level 4/5 because it is a single composed object. It must also have a static exported image or server-rendered fallback so a recipient sees the reading without requiring a shader, WebGL, or the NaTarot runtime.

## 9. Accessibility and failure states

Material is never a semantic state. Each component needs explicit states for:

- default, hover, focus-visible, pressed, selected, disabled, loading, success, and error;
- reduced motion;
- reduced transparency/high contrast;
- unsupported filter or renderer;
- slow initialization or capture failure;
- narrow viewport and safe-area overlap.

The fallback should preserve shape, spacing, border, shadow, text contrast, and action order. It may lose blur, lensing, sheen, and adaptive highlight. A user who disables transparency should not lose navigation, card orientation, saved reading actions, or the ability to close a sheet.

## 10. V1 adoption decision

Implement only after the semantic token and component contracts in the companion documents exist. The first production slice should be:

1. Level 1 and Level 2 tokens for shared navigation, buttons, sheets, and Room tool groups.
2. A single Level 3 Home focal action and one Guidebook filter surface.
3. A fixture for one Level 4 lens accent, measured against the budgets above.
4. No Level 5 production dependency until the fixture passes mobile, reduced-motion, reduced-transparency, SSR, and browser checks.

The visual goal is a calm, premium celestial interface with moments of optical delight. It is not maximum transparency everywhere.
