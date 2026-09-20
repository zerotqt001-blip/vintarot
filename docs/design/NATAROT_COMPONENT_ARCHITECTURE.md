# NaTarot — Component Architecture V1

**Status:** Architecture specification only; no runtime implementation in this branch

**Purpose:** Define how the future design system wraps the current NaTarot routes without moving business logic into visual components or destabilizing the Room.

## 1. Architectural rule

NaTarot should have four explicit layers:

```text
Route composition
  → product feature state and data contracts
    → semantic NaTarot components
      → behavior primitives and DOM/SVG/CSS rendering
```

The Liquid Glass material belongs to the rendering layer and is selected by semantic component props. It must not decide whether a reading is saved, whether a card can be drawn, whether a user owns a room, or whether a booking/payment is available.

The current `app/room/room.tsx` is the highest-risk boundary. It contains phase, deck, spread, category, guest/auth state, theme, reversals, question/context/notes, cards/texts/drawing, and modal/tool state. Future UI work may extract presentational children from it, but the state machine and side effects remain owned by the feature composition until contracts are tested.

## 2. Proposed source topology

This is a target topology, not a request to create these files in the research branch.

```text
components/
  brand/                    # logo and identity assets
  ui/                       # behavior primitives already backed by Radix/Base UI
  natarot/
    surface/                # NaSurface, NaGlass, NaMaterialBoundary
    navigation/             # NaTopbar, NaSidebar, NaBottomNav, NaFooter
    forms/                  # NaField, NaChoiceTile, NaCharacterCount
    feedback/               # NaStatus, NaToast, NaLiveRegion
    room/                   # toolbar, deck rail, card controls, not state machine
    reading/                # editorial document and action footer
    guidebook/              # family filter, card tile, orientation tabs
    commerce/               # future trust-mode pricing/payment/affiliate views
  icons/                    # optional named icon wrappers, not a new icon library

app/
  ... routes and feature composition ...

lib/
  i18n.ts                   # messages and locale behavior
  room-motion/              # existing geometry and motion contracts
  tarot-catalog/            # existing card/spread catalog contracts
  natarot-tokens.ts         # future token names if JS access is needed
```

The existing `components/ui` behavior primitives remain the lowest shared layer. New NaTarot components should wrap them rather than duplicate Dialog, Sheet, Tabs, Sidebar, Dropdown, or focus logic.

## 3. Component taxonomy

### Primitives

Small, stateless or minimally controlled components that own semantics and visual tokens:

- `NaSurface`
- `NaButton`
- `NaIconButton`
- `NaField`, `NaTextarea`, `NaSelect`
- `NaBadge`, `NaDivider`, `NaProgress`
- `NaDialog`, `NaSheet`, `NaPopover`
- `NaTabs`, `NaAccordion`, `NaTooltip`
- `NaStatus`, `NaLiveRegion`

### Compositions

Components that group primitives around a product concept but receive data and callbacks:

- `NaTopbar`, `NaSidebar`, `NaBottomNav`, `NaFooter`
- `NaToolbar`
- `NaRitualPrompt`
- `NaGuidebookFilter`
- `NaReadingDocument`
- `NaRoomToolDock`
- `NaSpreadSummary`
- `NaSavedReadingCard`
- `NaSharePreview`
- `NaTrustSummary`

### Feature containers

Components that connect route state, APIs, persistence, or authentication to compositions:

- `RitualFlow`
- `GuidebookPage`
- `SpreadBoard`
- `ReadingPanel`
- `JournalPage`
- `ProfilePage`
- future `ShareReadingFlow`, `BookingFlow`, `PaymentFlow`, and `AffiliateDisclosure`

Feature containers can be client components when interaction requires it. They should translate feature state into presentational props rather than leak API response shapes throughout the component tree.

## 4. Material boundary contract

Every surface-capable component accepts a semantic material contract, conceptually:

```ts
type NaMaterialLevel = 1 | 2 | 3 | 4 | 5

type NaSurfaceProps = {
  materialLevel?: NaMaterialLevel
  tone?: 'canvas' | 'panel' | 'chrome' | 'tool' | 'focus' | 'transient' | 'trust'
  elevation?: 'rest' | 'floating' | 'modal' | 'room-tool'
  interactive?: boolean
  as?: 'div' | 'section' | 'article' | 'aside' | 'nav'
}
```

These names are conceptual and should be finalized against the project’s current TypeScript conventions during implementation. The important contract rules are:

- Level 1 markup and styling always render first.
- Level 2/3 are CSS enhancements gated by capability and user preference.
- Level 4/5 are opt-in and localized; their renderer never owns the control’s children.
- The surface exposes no business callback other than standard DOM interaction.
- Decorative layers are `aria-hidden` and `pointer-events: none`.
- The component does not inspect route pathname to choose its material.

## 5. Ownership boundaries

| Concern | Owner | Visual component responsibility |
| --- | --- | --- |
| Locale and document language | `LanguageProvider` and profile sync | Render translated labels; never store a second locale. |
| Card catalog and card identity | `lib/tarot-catalog` and feature container | Render card identity, orientation, and image slots. |
| Spread geometry | `lib/room-motion` and `SpreadBoard` adapter | Render slots and controls around geometry; do not calculate layout in `NaSurface`. |
| Draw/reveal/reversal | Room feature state machine | Render state, disabled/loading/announcement states; do not trigger draw from a visual effect. |
| AI interpretation and knowledge base | reading feature/API contract | Render pending/error/content states; do not infer meaning in the component. |
| Auth and ownership | route/auth services | Render signed-out, guest, owner, and permission states. |
| Save/persistence | journal/reading service | Render save progress, success, and error; do not silently persist on blur. |
| Booking/payment | future commerce feature contracts | Render honest capability and trust surfaces; no fake checkout. |
| Material level and motion | semantic component + route surface mode | Apply tokens and fallbacks; never alter product state. |

## 6. Shell architecture

The current `app/vintarot.tsx` determines shell by route and wraps most non-Room routes with language and sidebar providers. The future shell family should keep that composition behavior but make surface mode explicit:

```text
AppShell
  ├─ LanguageProvider
  ├─ SidebarProvider
  ├─ AmbientCanvas (decorative, route-selected)
  ├─ Topbar (functional layer)
  ├─ NavigationLayer (sidebar or bottom nav)
  ├─ MainContent (route feature)
  ├─ FeedbackLayer (live region/toast)
  └─ Footer (functional layer where present)
```

`AmbientCanvas` is not a content parent for focusable controls and must never capture pointer events. `Topbar`, navigation, feedback, and footer are siblings in the functional layer. Route content owns the main visual composition.

Shell modes:

| Mode | Route examples | Default materials |
| --- | --- | --- |
| `home` | `/` | Topbar/sidebar Level 2; hero action Level 3; content Level 1/2. |
| `ritual` | `/create` | Topbar Level 2; prompt surface Level 2/3; fields Level 1/2. |
| `guidebook` | `/guidebook`, `/guidebook/decks` | Navigation Level 2; filters Level 2; card art/content Level 1. |
| `practice` | `/practice` | Form/reflection Level 1/2; reveal control Level 3. |
| `reading` | journal, saved reading | Reading document Level 1/quiet 2; action footer Level 2. |
| `room` | `/room` | Tabletop Level 1; tools Level 2/3; reading sibling sheet/panel Level 1/2. |
| `trust` | future booking/payment | Opaque Level 1/quiet 2; no Level 4/5. |

## 7. SpreadBoard architecture

`SpreadBoard` is a presentational adapter around the existing Room geometry and state contracts. It is not a new Tarot engine.

### Inputs

Conceptual inputs:

```ts
type SpreadBoardModel = {
  phase: 'ready' | 'shuffling' | 'drawing'
  spread: SpreadDefinition
  cards: BoardCard[]
  orientation: 'upright' | 'reversed'
  question?: string
  selectedTool?: RoomTool
  theme: RoomTheme
  canDraw: boolean
  canSave: boolean
  canShare: boolean
}
```

### Outputs

- `onDraw()`
- `onSelectCard(cardId)`
- `onSelectTool(tool)`
- `onOpenReading()`
- `onOpenGuidebook(cardId)`
- `onSaveReading()`
- `onShareReading()`
- `onReset()`

The adapter does not mutate card positions, compute spread geometry, or initiate persistence. The existing L1 geometry and `lib/room-motion` remain the source of truth. Any extraction must be verified against card slot positions, deck fan behavior, drag/pan/zoom, reversal state, and reduced-motion behavior.

### Layer order

```text
room canvas / tabletop
  → decorative atmosphere
  → spread slots and cards
  → non-interactive card labels
  → Tier A tools
  → Tier B toolbar / dock
  → Tier C sheets and dialogs
  → reading companion
  → live region and toast layer
```

The reading companion is a sibling to the tabletop layer, not a child of the card fan or a glass overlay clipped by the board.

## 8. Reading architecture

Current `ReadingPanel` already has a valuable editorial sequence: direct answer, deeper reading, personal insights, next steps, reflection, evidence, follow-up, and fixed actions. Preserve that order as a data-driven document:

```text
ReadingDocument
  ├─ ReadingHeader (question, spread, date, close)
  ├─ DirectAnswer
  ├─ ReadingSection[]
  │    ├─ PersonalInsights
  │    ├─ NextSteps
  │    ├─ ReflectionPrompts
  │    └─ TarotEvidence (disclosure)
  ├─ FollowUpField
  └─ ReadingActions (save, share, close)
```

The document accepts typed content and state:

```ts
type ReadingState =
  | { status: 'idle' }
  | { status: 'loading'; requestId: string }
  | { status: 'ready'; document: ReadingDocumentModel }
  | { status: 'error'; message: string; retryable: boolean }
```

A visual material change must not change the state shape. Long-form body copy remains Level 1/quiet Level 2, with a fixed action footer that owns focus on mobile.

## 9. RitualFlow architecture

The current Create flow has two semantic steps and already manages session draft, input limits, suggestions, and focus movement. Preserve them as a feature flow:

```text
RitualFlow
  ├─ RitualStepIndicator
  ├─ RitualQuestionStep
  │    ├─ NaField question
  │    ├─ NaTextarea context
  │    └─ TopicChoiceGroup
  └─ RitualDirectionStep
       ├─ SuggestionList
       ├─ Optional context
       └─ Continue/skip actions
```

The flow owns draft and validation; `NaField`, topic tiles, and surface components do not know about `sessionStorage`, redirect URLs, or route transitions. Focus moves to the step heading after a step change and status text is announced.

## 10. Guidebook architecture

```text
GuidebookPage
  ├─ GuidebookHeader
  ├─ GuidebookFamilyNav
  ├─ GuidebookLibraryToolbar
  │    ├─ SearchField
  │    ├─ FamilyFilter
  │    └─ SortSelect
  ├─ CardGrid / WorldMap
  └─ CardDetail
       ├─ CardIdentity
       ├─ OrientationTabs
       ├─ NarrativeSections
       └─ RelatedCards
```

The world map is a content/navigation composition. Filter controls can use Level 2, while card images and narrative remain sharp. The detail route must continue supporting pointer, touch, keyboard arrows, and orientation tabs.

## 11. Future sharing architecture

Sharing is a product feature, not a CSS export. Define a stable artifact model before adding a visual share surface:

```ts
type ShareReadingArtifact = {
  id: string
  version: 1
  locale: 'vi' | 'en'
  question?: string
  spread: SpreadSummary
  cards: SharedCard[]
  directAnswer?: string
  createdAt: string
  visibility: 'private' | 'unlisted' | 'public'
}
```

`NaSharePreview` receives this model and can render a static preview or a Level 4/5 interactive preview. The static preview is the source of truth for link previews, export, and unsupported browsers. Never require a recipient to run a WebGL renderer to understand the card layout or reading title.

## 12. Future commercial architecture

Future VIP, payment, booking, and affiliate surfaces are reserved but not active in this branch.

```text
CommercePage
  ├─ OfferCard / MembershipTier
  ├─ TrustSummary
  ├─ BookingSlotPicker
  ├─ PaymentMethodForm
  ├─ OrderSummary
  └─ AffiliateDisclosure
```

Rules:

- `NaTrustSummary` and payment fields use Level 1/quiet Level 2, never Level 4/5.
- Totals, currency, recurrence, cancellation, and ownership are plain text with explicit labels.
- Affiliate content is visibly disclosed and never disguised as Tarot guidance.
- Feature availability comes from a capability contract, not from a decorative disabled card.
- Booking/payment APIs and auth are owned by feature containers; visual components only render the contract.

## 13. Localization contract

The existing `LanguageProvider` and `lib/i18n.ts` remain the single locale source. New components receive translated strings or message keys according to current project convention; they do not call a separate translation service.

Every component story/fixture should include:

- English and Vietnamese;
- a long Vietnamese label and long English label;
- empty, loading, error, and disabled text;
- an RTL-safe logical layout check even if RTL is not currently a product locale.

Use logical CSS properties (`margin-inline`, `padding-block`, `inset-inline`) for new layout rules. Avoid text-as-background or fixed-width buttons that can clip the Vietnamese copy.

## 14. Dependency policy

### Keep

- Existing React 19, TypeScript, Vinext/Vite, Tailwind, `radix-ui`, `@base-ui/react`, and `lucide-react` foundations.
- Existing local `components/ui` primitives and Room motion/catalog modules.

### Add only with a measured contract

- Motion for a gesture/layout sequence CSS cannot express and that passes bundle/performance checks.
- A refraction renderer only inside an isolated Level 4/5 prototype with a fallback and route budget.

### Do not add for V1

- A new all-in-one UI kit that duplicates current behavior primitives.
- A global Liquid Glass package used by every surface.
- A new state manager solely to support visual material selection.
- A renderer that requires changing SSR, auth, Tarot data, or persistence behavior.

## 15. Testing contracts

Each semantic component needs a small fixture with:

- Level 1 fallback;
- Level 2/3 capability enhancement;
- reduced motion/transparency;
- keyboard focus and Escape dismissal where applicable;
- English/Vietnamese copy;
- 360px, 768px, and wide desktop viewports;
- bright artwork and dark artwork backgrounds.

Feature integration tests preserve the existing behavior contracts:

- Create flow validation, step focus, draft storage, and redirect;
- Guidebook filters, card navigation, orientation, and search;
- Room draw/reveal/reversal, geometry, toolbar actions, reading panel, save, and restart;
- locale persistence and document language;
- profile form and service-status truthfulness.

Visual snapshots are useful only when paired with semantic and behavior assertions. A screenshot that looks like Liquid Glass is not evidence that focus, text contrast, or fallback behavior works.

## 16. Extraction order

1. Map existing CSS values to semantic tokens without changing route markup.
2. Extract shared focus, border, shadow, and material recipes.
3. Wrap existing buttons, fields, Dialog, Sheet, Sidebar, Tabs, and status regions.
4. Normalize navigation across Home, Guidebook, Create, Practice, and site pages.
5. Extract Room tool groups around the current state owner.
6. Stabilize `ReadingDocument` around the current reading panel.
7. Add one measured Level 4 fixture only after Level 1–3 regressions are green.
8. Consider future share/commerce compositions only after their data contracts exist.

This sequence keeps visual migration reversible and protects product behavior while reducing the current route-specific CSS density.
