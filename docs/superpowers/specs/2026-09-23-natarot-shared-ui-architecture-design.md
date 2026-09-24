# NaTarot Shared UI Architecture — Design Specification

## Objective

Unify the existing NaTarot product surfaces around one Celestial Tarot Observatory system matching the six owner-approved references, while preserving canonical product data, existing interaction flows, and protected backend boundaries.

The target surfaces are the Tarot Library, Practice, Credit Packages, Affiliate, Account, and dynamic Reading Result. Home, Create, Daily, Room, Auth, and public share routes remain part of the shell contract and are normalized only where that is safe and already supported by their approved visual work.

## Current-state findings

- `app/vintarot.tsx` contains route-specific header, sidebar, footer, navigation, modal, and theme branches instead of one shared chrome contract.
- `app/globals.css` contains an older light shell followed by several route-specific celestial overrides; the later rules are the current visual authority but repeated token values drift between variants.
- `/packages` is already data-driven and preserves checkout contracts, but its route wrapper still labels the surface as functional and its shell/footer are unique.
- `/affiliate` renders the newer `components/affiliate/affiliate-dashboard.tsx`, while an older `AffiliatePage` implementation remains in `app/commerce/commerce-pages.tsx`; the older subtree is not reachable from the route and should be removed only after import/build/test proof.
- `/account` is explicitly marked “FUNCTIONAL UI — NOT FINAL DESIGN” and is the largest migration target.
- Guidebook, Practice, Home, Room, Create, Daily, and Reading Result already have approved visual/interaction work recorded in `docs/PROJECT_STATE.md`; they should inherit shared tokens and primitives instead of being rebuilt.
- Current product UI source baseline (excluding API routes, generated output, tests, docs, data, and assets) is recorded before implementation in the task log and will be measured again after migration.

## Visual system

The shared visual contract is a midnight observatory with antique/champagne gold and warm ivory:

- semantic color tokens: `--nt-bg-primary`, `--nt-bg-secondary`, `--nt-surface`, `--nt-surface-elevated`, `--nt-surface-glass`, `--nt-border`, `--nt-border-gold`, `--nt-gold`, `--nt-gold-soft`, `--nt-text-primary`, `--nt-text-secondary`, `--nt-text-muted`, `--nt-success`, `--nt-warning`, `--nt-danger`;
- display type: the existing local Instrument Serif face for editorial headings and numeric moments;
- UI type: the existing local Work Sans face for navigation, actions, metadata, tables, and body copy;
- shared spacing, radius, border, shadow, focus, and motion tokens defined once in `app/globals.css`;
- calm navy surfaces by default, stronger gold emphasis only for selected/primary actions;
- no screenshot values, fake balances, fake referrals, or decorative copy used as business truth.

## Shared architecture

The shell is split into focused components under `components/shell/`:

- `natarot-shell.tsx`: route-aware composition and shared context; owns the shell variant contract, not page business data;
- `natarot-header.tsx`: brand lockup, four primary links, language, theme, account, and optional utility actions;
- `natarot-sidebar.tsx`: the canonical five-item desktop rail plus the shared mobile navigation representation;
- `natarot-footer.tsx`: brand statement, policy links, and optional social marks;
- `celestial-background.tsx`: semantic atmosphere variants without duplicating page content;
- `celestial-panel.tsx`: a small typed surface wrapper for panel/card treatment, reusing existing panel semantics where possible.

The existing `VinTarot` entry point remains the compatibility adapter for route providers and `children`; it delegates chrome to the shared shell. Route-specific content remains in its existing page/component file unless a migration requires a narrowly-scoped extraction.

The shell exposes a finite variant set: `standard`, `home`, `library`, `practice`, `membership`, `affiliate`, `account`, `reading`, and `immersive`. Variants choose atmosphere and layout density; they do not fork header/sidebar/footer markup or token names.

## Surface migrations

### Credit Packages

Keep `/api/packages`, `/api/account/summary`, checkout navigation, server prices, validity snapshots, loading/error/empty states, and the 1 → 5 → 10 → 20 ordering. Migrate only markup classes and shell usage to shared `PageHero`, `CelestialPanel`, `StatCard`, `GoldButton`, and `OutlineButton` contracts. The 10-credit Popular state remains derived from the API snapshot/name/quantity fallback already present.

### Affiliate

Keep `components/affiliate/affiliate-dashboard.tsx` as the active data-driven route component. Normalize its hero, KPI, tier, referral, history, policy, and flow panels to shared primitives and tokens. Preserve the truthful unavailable states when policy, referral-link, payout, or authenticated dashboard data is not available. Remove the unreachable `AffiliatePage` subtree only after import graph, route test, and build proof.

### Account

Migrate `components/account/account-history.tsx` to a real account dashboard composition using only `/api/account/summary` and `/api/account/history`. Add profile identity, Credits/VIP/saved-reading/Affiliate stats, recent readings, quick actions, transactions, and security rows from existing response fields. Admin navigation is rendered only when the existing permission/session boundary says it is available; no owner QA shortcut is added. Preserve filtering, cursor pagination, destination links, auth boundary, and metadata-only history response.

### Existing approved surfaces

Guidebook, Practice, Home, and Reading Result retain their content and interaction implementations. Shared token aliases and shell components remove chrome drift without replacing their working orbit/map, practice reflection, home scene, or dynamic spread geometry. Room remains an immersive exception but uses the same semantic token names and focus language.

## Data and security boundaries

No changes are allowed to authentication/F-001, Credits ledger or expiry, SePay/payment verification, Affiliate accounting, RBAC/Admin authorization, DeepSeek/AI prompt/schema/provider behavior, reading persistence, spread geometry/data, share tokens/QR, database migrations, backups, or deployment secrets. UI reads canonical API responses and treats unavailable/empty values as first-class states.

## Responsive and accessibility contract

- exact QA widths: 375, 390, 412, tablet around 768/820, and desktop around 1280/1440/1660;
- no horizontal document overflow;
- desktop sidebar collapses to the existing/shared mobile navigation without shrinking Tarot cards into illegibility;
- tables/history become readable stacked rows or bounded containers;
- all actions retain semantic links/buttons, visible focus, labels, reduced-motion behavior, and touch targets;
- both `vi` and `en` keep locale parity and Vietnamese diacritics.

## Cleanup and LOC accounting

Before/after counts are measured separately for production TS/TSX, CSS, tests, and docs. Removal is limited to proven-dead UI: unreachable imports/subtrees whose replacement is complete, route/build/import checks pass, and no protected business logic is contained inside them. Optional UI catalog files and uncertain legacy CSS are not deleted in bulk.

## Verification and release

The implementation follows red/green tests for each new shared contract, focused route tests, full tracked tests, TypeScript, production build, targeted lint for changed files, `git diff --check`, browser QA, and a cross-page comparison. Before any production mutation, take the canonical backup, verify checksum/integrity/restore capability, record disk/release state, deploy through the existing reversible procedure, verify public health and user navigation, and prune only obsolete application releases while retaining the current release and two successful rollback releases. If SSH access is still unavailable after checking existing configuration, production remains an explicit external blocker.
