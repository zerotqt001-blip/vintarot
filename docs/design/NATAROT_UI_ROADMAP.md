# NaTarot — UI/UX and Liquid Glass Roadmap

**Status:** V1 implementation roadmap; this branch remains documentation-only

**Guiding order:** stabilize semantics and contracts first, then material, then optical delight

## 1. North-star outcome

NaTarot should feel like one product across Home, ritual creation, Guidebook, Practice, Room, reading, journal, and future sharing. The experience can have different art direction per route, but users should recognize the same materials, focus behavior, typography, navigation logic, language handling, and action hierarchy.

The migration is complete when:

- the Moonlight celestial identity is intact;
- functional surfaces share a small, measurable material vocabulary;
- content and card art remain readable without enhanced effects;
- Room behavior and geometry are unchanged;
- Vietnamese/English and mobile layouts are first-class;
- advanced Liquid Glass is limited to measured focal moments;
- future share and commerce surfaces have contracts, not placeholders disguised as product features.

## 2. Current-to-future inventory

| Area | Current evidence | V1 future state | Priority |
| --- | --- | --- | --- |
| Tokens | Two early token systems, route aliases, direct rgba values, late overrides in `app/globals.css`. | One semantic mapping with explicit material/elevation/state roles. | P0 |
| Shell | Shared provider and shell composition in `app/vintarot.tsx`; route-specific topbars/nav/footer rules. | Shell family with explicit surface modes and shared focus/navigation contracts. | P0 |
| Navigation | Topbar, fixed side nav, personal nav, footer, mobile bottom nav rules. | Functional Glass layer on desktop; safe-area bottom nav on mobile; `aria-current` everywhere. | P0 |
| Home | Celestial scene, greeting, ritual CTA, daily spread, feature rows, pointer/scroll effects. | One clear primary action, restrained Level 3 focal surface, bounded ambient motion. | P1 |
| Create | Two-step ritual, question/context/topic/suggestions, focus and validation. | `RitualFlow` with step semantics, localized field contracts, clear selection and status. | P1 |
| Guidebook | Map/family navigation, image library, search/filter/sort, detail/orientation. | Content-led map and cards; glass filter/navigation controls; sharp card imagery. | P1 |
| Practice | Cosmic prompt/reflection/reveal/save composition. | Shared `NaField`/reading/reflection recipes with reduced-motion reveal. | P1 |
| Room | Full-bleed tabletop, deck fan, tools, media, zoom/pan, spread, reading, save. | `SpreadBoard` adapter around unchanged state/geometry; tiered tool dock and sibling reading companion. | P0 |
| Reading | Dark editorial panel with direct answer, sections, evidence, follow-up, actions. | `NaReadingDocument` with quiet material and stable action footer. | P0 |
| Journal | Saved readings and manual entries. | Scannable history cards; ownership/date/card identity first. | P2 |
| Auth | Current route gate links to `/signin-with-chatgpt`; no local auth page in the audited base. | An explicit auth gate surface with return path, ownership state, and non-invasive provider boundary. | P1 |
| Share | No future artifact system committed in the audited base. | Stable share artifact model plus static preview and optional enhanced visual preview. | P2 |
| Profile | Form and service-status copy; booking/payment not yet configured. | Trustful account/availability surface; no fake commerce. | P2 |
| VIP/payment | Not active. | Separate trust-mode flows with opaque forms, totals, disclosures, and receipt state. | P3 |
| Affiliate | Not active. | Explicit disclosure component and independent attribution contract. | P3 |

Priority definitions: P0 protects current behavior and the visual foundation; P1 improves the core journey; P2 supports retention/sharing; P3 is future commercial scope.

## 3. Page and flow blueprints

### Home

**Purpose:** Establish the NaTarot atmosphere and guide a user to the first ritual.

```text
celestial canvas
  ├─ functional topbar (Level 2)
  ├─ quiet navigation rail / mobile bottom nav (Level 2)
  ├─ focal greeting + ritual action (Level 3 at most)
  ├─ daily spread entry (Level 1/2)
  ├─ feature/story sections (editorial surfaces)
  └─ footer/help (functional layer)
```

Primary action: create ritual. Secondary action: daily spread. Requirements: scene remains visible, action order is clear, pointer motion pauses for reduced motion/hidden tabs, and the mobile bottom action does not cover the hero copy.

### Auth gate

**Purpose:** Explain why sign-in is needed for a private room, saved reading, journal, or future booking.

```text
quiet canvas
  └─ auth panel (Level 1/quiet 2)
       ├─ purpose statement
       ├─ provider action
       ├─ return destination summary
       ├─ privacy/ownership note
       └─ cancel/back action
```

The audited base uses a ChatGPT sign-in route rather than a local auth page. The future surface should preserve that provider boundary, show an honest return path, and avoid making a provider button look like a Tarot interpretation action. Auth errors are text and status announcements, not glow.

### Create ritual

**Purpose:** Turn a vague intention into a focused question and optional direction.

```text
shell chrome
  └─ one focus surface
       ├─ step indicator
       ├─ question field + counter
       ├─ context field + helper
       ├─ topic choice group
       ├─ step-two suggestions
       └─ continue / skip / back
```

Desktop can use a Level 2/3 focus surface; mobile uses a single-column Level 1/2 panel. Preserve existing input lengths, session draft, validation, and heading focus behavior.

### Guidebook

**Purpose:** Browse and understand the 78-card language.

```text
world/map content
  ├─ family navigation (functional Level 2)
  ├─ search/filter/sort (Level 2)
  ├─ card grid/map (sharp content)
  └─ card detail (editorial document + orientation tabs)
```

The five card-family groups remain recognizable. Filter sheets on mobile are labeled and dismissible; card details do not require a refraction effect to make the selected card feel important.

### Room / SpreadBoard

**Purpose:** Create a physical-feeling Tarot table while keeping actions discoverable.

```text
tabletop canvas (Level 1)
  ├─ card slots / cards / deck fan (existing geometry)
  ├─ Tier A: leave, media, zoom/pan, session state
  ├─ Tier B: draw, spread, theme, reversal, card picker, guidebook
  ├─ Tier C: annotations, save, restart, share
  └─ reading companion (sibling panel or mobile sheet)
```

Requirements: the first draw is discoverable, current card/state is announced, tool groups have names, mobile controls do not cover the deck fan, and reading can open without destroying the tabletop context. A visual refraction experiment is limited to one active selected tool or share preview.

### Reading

**Purpose:** Turn the room state into a comprehensible reflection.

```text
ReadingDocument
  ├─ question/spread/date header
  ├─ direct answer
  ├─ insights / next steps / reflection
  ├─ evidence disclosure
  ├─ follow-up field
  └─ save/share/close actions
```

Desktop: side companion with a stable reading measure. Mobile: full-height sheet with a sticky, safe-area action footer. Material defaults to Level 1/quiet 2; decorative optics are disabled while reading.

### Share artifact

**Purpose:** Let a user share a bounded reading without exposing private room controls or requiring the receiver to load the full app.

```text
ShareReadingFlow
  ├─ visibility choice
  ├─ artifact preview (static-first)
  ├─ copy link / export image
  ├─ privacy and expiration
  └─ success/error status
```

Optional enhanced preview may use Level 4/5 for one composed surface. The same artifact must render as static HTML/image for link previews, unsupported browsers, and reduced effects.

### VIP / membership

**Purpose:** Explain benefits and boundaries without confusing aspiration with a payment state.

```text
membership page (opaque trust mode)
  ├─ tier comparison
  ├─ benefits and limits
  ├─ cancellation/renewal terms
  ├─ support/contact
  └─ choose plan
```

No Liquid Glass lensing near recurring price, terms, or purchase confirmation. A premium product may feel beautiful through typography, spacing, and imagery without compromising transaction clarity.

### Payment

**Purpose:** Complete a payment with explicit ownership and totals.

```text
checkout
  ├─ order summary
  ├─ payment method
  ├─ billing/booking details
  ├─ terms and consent
  ├─ final confirmation
  └─ receipt / recovery
```

Use Level 1/quiet 2 surfaces, visible focus, plain totals, and error recovery. Do not place animated background effects behind sensitive entry fields if they compete with the keyboard or confirmation text.

### Affiliate

**Purpose:** Recommend related products transparently and separately from Tarot interpretation.

```text
affiliate module
  ├─ “why this is shown” disclosure
  ├─ product image/name/price
  ├─ merchant attribution
  └─ outbound action
```

Affiliate content must be visibly labeled and must never appear as an evidence card or an AI-derived Tarot conclusion.

## 4. Phased roadmap

Each phase has a bounded exit gate. Do not start the next phase with known critical behavior or accessibility regressions.

### UI-0 — Baseline and guardrails

**Scope:** Capture source audit, route inventory, current tests, visual references, and the material budget.

**Deliverables:** Token mapping sheet, route fixtures, baseline screenshots/accessibility trees, and a list of protected Room contracts.

**Exit criteria:** No runtime behavior change; current baseline is reproducible; test failures are categorized as baseline or introduced.

### UI-1 — Semantic token consolidation

**Scope:** Map existing colors, text, borders, radii, shadows, spacing, and motion values to semantic roles.

**Do not:** Rewrite the entire stylesheet or change route composition in one patch.

**Exit criteria:** New component styles can use semantic roles; Level 1 fallback exists; old direct values have an explicit migration owner.

### UI-2 — Primitive and state contracts

**Scope:** Normalize Button, IconButton, Field, Surface, Dialog, Sheet, Tabs, Tooltip, Status, and LiveRegion behavior around the existing Radix/shadcn-style layer.

**Exit criteria:** Keyboard, focus, labels, dismissal, reduced motion/transparency, and VI/EN fixtures pass for primitives.

### UI-3 — Shared shell and navigation

**Scope:** Apply the functional layer to topbar/sidebar/footer/mobile nav, active route semantics, safe areas, and skip navigation.

**Exit criteria:** Home, Guidebook, Create, Practice, and site pages share navigation behavior; the Room has a dedicated shell adapter; desktop/mobile route state is stable.

### UI-4 — Home and ritual flow

**Scope:** Refine Home action hierarchy and Create’s two-step focus surface using Level 2/3 material only.

**Exit criteria:** Ritual creation, validation, step focus, draft storage, redirect, and bilingual text are unchanged; Home remains recognizable as Moonlight/NaTarot.

### UI-5 — Guidebook, Practice, daily, and journal

**Scope:** Make content-led routes share card, form, reflection, filter, and reading-document recipes.

**Exit criteria:** Search/filter/sort/orientation, daily reveal, practice save, journal list, and long-copy measures pass keyboard/mobile/localization checks.

### UI-6 — Room and SpreadBoard adapter

**Scope:** Extract tool groups and panel composition around the existing Room state and L1 geometry.

**Exit criteria:** Card draw/reveal/reversal, drag/pan/zoom, spread selection, toolbar actions, reading open/save/restart, guest/auth behavior, and reduced motion match baseline. No new refraction dependency is required.

### UI-7 — Reading, save, and share artifact

**Scope:** Stabilize `NaReadingDocument`, saved reading states, and the static-first share artifact.

**Exit criteria:** Direct answer/sections/evidence/follow-up/action footer remain readable; save/error/retry and visibility states are explicit; share preview works with enhanced effects disabled.

### UI-8 — Material and performance hardening

**Scope:** Add Level 3 surfaces where the visual hierarchy benefits; test one Level 4 fixture; add reduced transparency and browser fallbacks.

**Exit criteria:** Performance protocol passes on representative mid-range mobile; no primary task depends on blur/lensing; active surface counts and frame budgets are documented.

### UI-9 — Future trust and commercial surfaces

**Scope:** Only after real capability/auth/payment/booking contracts exist, design VIP, payment, booking, and affiliate surfaces.

**Exit criteria:** Totals, terms, consent, ownership, recovery, and disclosures pass trust review; no placeholder state is presented as active commerce; glass is Level 1/quiet 2.

### UI-10 — Visual convergence and release gate

**Scope:** Remove obsolete route overrides, consolidate documentation, tune art direction, and complete cross-browser/accessibility review.

**Exit criteria:** Critical design issues = 0; important architecture issues = 0; all protected behavior contracts pass; visual and performance baselines are signed off.

## 5. Regression strategy

### Behavior regression

Protect these flows with focused tests and manual fixtures:

- locale selection, persistence, and `<html lang>`;
- topbar/sidebar/personal nav active state and keyboard order;
- Create question/context limits, topic selection, suggestions, focus transition, draft, and redirect;
- Guidebook family filters, search, sort, card detail, orientation, pointer/touch/keyboard navigation;
- Room phase transitions, draw/reveal/reversal, card geometry, deck fan, media, zoom/pan, spread selection, tools, reading panel, save, restart, and guest/auth states;
- reading loading, ready, error, evidence disclosure, follow-up, save, share, and close focus return;
- profile form and honest service status.

### Visual regression

Capture at minimum:

| Route | Viewports | States |
| --- | --- | --- |
| Home | 1440, 1024, 768, 390 | default, reduced motion, mobile nav |
| Create | 1280, 768, 390 | step 1, step 2, validation error, long VI copy |
| Guidebook | 1440, 768, 390 | world map, filtered library, card detail, orientation |
| Room | 1440, 1024, 768, 390 | ready, drawing, face-up card, tools, reading open |
| Reading/Journal | 1280, 768, 390 | loading, ready, error, long reading, action footer |
| Profile/Auth | 1280, 768, 390 | signed out, form, status, validation |

Compare both enhanced material and Level 1 fallback. Screenshots must be paired with accessibility-tree or DOM assertions so a visually attractive regression cannot hide a broken focus order.

### Accessibility regression

- keyboard-only pass for every route;
- screen-reader landmark, heading, label, status, and dialog pass;
- focus visible over dark art, bright art, Level 1, and glass surfaces;
- reduced motion and reduced transparency pass;
- forced-colors/zoom/reflow spot checks;
- touch target and safe-area check on a real narrow viewport;
- English/Vietnamese overflow check.

### Performance regression

Measure before/after each material phase:

- first usable paint with effects off/on;
- idle and active frame time;
- scroll through dense panels;
- memory/thermal behavior on mid-range mobile;
- surface count and active filter count;
- renderer initialization, failure, teardown, and hidden-tab pause.

Reject a visual change if it improves a screenshot but degrades a primary task, causes sustained jank, or removes the Level 1 fallback.

### Data and security regression

- No visual component receives or logs tokens, auth headers, private profile data, or raw payment details.
- Share artifacts must honor visibility and expiration.
- Saved readings remain owned by the correct account/session.
- Affiliate modules cannot be mistaken for Tarot evidence.
- Future payment fields remain isolated from ambient scene capture or background mirroring.

## 6. Rollback and migration rules

- Migrate one surface family at a time behind existing route classes or a small surface-mode flag.
- Keep the prior visual recipe available until the route’s behavior and accessibility checks pass.
- Roll back a material level independently from the component behavior.
- If a renderer fails, remove only the renderer layer; do not remove the underlying action or content.
- Never use a destructive stylesheet rewrite or reset to “clean up” legacy overrides while feature work is in flight.

## 7. Decisions resolved by this roadmap

- The project will not adopt a new global Liquid Glass package in V1.
- Existing Radix/shadcn-style behavior primitives remain the foundation.
- Lucide remains the functional icon grammar.
- Motion is optional and measurement-gated; CSS remains the default for simple transitions.
- Room geometry and business state remain protected boundaries.
- Editorial reading content is intentionally calmer than the functional chrome.
- Advanced optics are localized and progressive, with an opaque fallback.
- Future VIP, payment, booking, and affiliate surfaces are specified as future architecture, not implemented or implied as currently available.

## 8. Release checklist

Before declaring the design-system implementation complete:

- [ ] `git diff --name-only` contains only intended implementation/docs files.
- [ ] No `.env`, auth token, runtime database, session log, or build output is tracked.
- [ ] Source tests, typecheck, build, accessibility fixtures, and visual matrix are recorded.
- [ ] Critical design issues = 0.
- [ ] Important architecture issues = 0.
- [ ] Room protected contracts pass.
- [ ] VI/EN and narrow mobile pass.
- [ ] Level 1 fallback and reduced effects pass.
- [ ] Material/performance budgets are documented with device/browser evidence.
- [ ] Any dependency addition has a reason, bundle impact, license review, and fallback.
