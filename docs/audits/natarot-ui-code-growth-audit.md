
# NaTarot UI Code Growth Audit

Audit date: 2026-09-23
Repository: VinTarot / NaTarot
Audit mode: read-only forensic audit
Requested output: explanation of repository growth, duplication, dead code, generated files, and safe cleanup potential

## Executive conclusion

The repository did grow materially, but the reported change from approximately 44k to approximately 80k is not a like-for-like UI-source comparison.

The broad baseline checkpoint 64fca6d contains 45,462 tracked text LOC. The current integration commit e75965d contains 164,558 tracked text LOC when data, generated/tooling, documentation, tests, migrations, and scripts are included. If the current tree is narrowed to product text excluding assets, tarot data, and generated/tooling files, it contains 82,414 LOC. That is close to the reported approximately 80k figure, but the two endpoints measure different scopes.

On a like-for-like tight product-line comparison, source LOC grew from 9,968 at 6c5f9ef to 30,161 at e75965d, a net increase of 20,193 source LOC. The largest contributors are legitimate feature and backend/domain growth, a large test suite, tarot data/catalog expansion, documentation and deployment tooling, plus a substantial CSS accumulation. The UI tree itself grew by approximately 5,583 net LOC excluding API routes: approximately 3,772 TypeScript/TSX LOC and 1,811 CSS LOC.

The main code-quality issue is not one hidden duplicate application. It is parallel layers accumulating in the same repository:

- an active route shell with repeated route-specific navigation/header/sidebar/footer branches;
- a monolithic app/pages.tsx compatibility surface;
- an active commerce path beside an orphaned old AffiliatePage subtree;
- legacy and newer CSS layers coexisting in app/globals.css;
- a large optional shadcn-style UI primitive catalog with no confirmed runtime imports;
- tracked internal tooling and documentation that inflate repository-wide LOC metrics.

High-confidence removable product runtime code is estimated at approximately 70–90 LOC from the orphaned AffiliatePage subtree. A conservative duplicate/stale cleanup pool, including confirmed-or-likely CSS and shell parallelism, is estimated at approximately 400–600 LOC-equivalent. A broader optional cleanup could remove approximately 3,363 LOC from unused UI primitive catalog files, but that catalog is not proven dead and should not be batch-deleted without product-owner confirmation.

No runtime code, production branch, database, backend contract, or deployed artifact was modified by this audit.

## Audit contract and protected scope

This audit inspected Git history, archived tree manifests, source structure, imports, CSS selectors, i18n key parity, test inventory, generated/tooling directories, and branch/worktree metadata.

The audit did not delete, refactor, deploy, change database schema, alter backend contracts, change auth or payment behavior, or modify production. The only intended deliverable is this report.

Protected systems identified during the audit:

- authentication and F-001 member access behavior;
- credits ledger, expiration, reservations, fulfillment, and related repositories;
- SePay/payment paths;
- Affiliate accounting, hold, reversal, and audit behavior;
- RBAC, admin, and audit logging;
- DeepSeek/provider contracts and AI reading boundaries;
- reading persistence, legacy hydration, and result compatibility;
- share and QR contracts;
- backup, restore, release-retention, and deployment guards;
- database schema and migrations;
- i18n locale parity and existing regression tests.

## Baselines and comparability

### Primary tight baseline

- Commit: 6c5f9eff705e87dc705f74c855377ca77881862b
- Meaning: last authoritative product line before the named recent UI redesign series.
- Current comparison: e75965d7039ce46b65e47a738c1521253833efcd.
- Why this baseline: it isolates the broad feature and architecture growth that followed the pre-redesign product line.

### Broad historical checkpoint

- Tag: baseline-before-skills-2026-09-16
- Commit: 64fca6de653e560230a8041e51aadd01b0b2692c
- Tracked text: 45,462 LOC across 286 files.
- This is the closest measured repository-wide number to the reported approximately 44k starting point.

### Current integration line

- Commit: e75965d7039ce46b65e47a738c1521253833efcd
- Tracked text: 164,558 LOC across 921 files.
- Tracked bytes: 35,821,571.
- Product text excluding assets, tarot data, and generated/tooling: 82,414 LOC.

### Current production comparison

- Production source commit recorded in the project state: 8c662f0042a8a1863e1fe03bfedbee3a6668dbaf.
- The current integration line is only slightly ahead of that production source:
  - source: +49 LOC;
  - CSS: +19 LOC;
  - i18n: +22 LOC;
  - tests: +68 LOC;
  - docs: +320 LOC;
  - scripts: +37 LOC.
- Therefore, most measured growth predates the final production integration delta. It is not evidence that the live production release suddenly doubled in size.

## Measurement method

The measurements used archived Git trees so ignored local build output, node_modules, untracked worktrees, and local caches did not contaminate the comparison.

LOC means non-binary text line count as represented by the tracked Git tree. It is a size metric, not a semantic complexity score. Generated metadata, JSON data, documentation, tests, migrations, scripts, and product source are reported separately.

The UI tree comparison uses app and components. API routes are separated where noted. CSS is counted separately because a stylesheet can create a large behavioral surface without appearing as many components.

## Measured source LOC

Primary tight comparison, 6c5f9ef to e75965d:

| Category | Baseline files | Current files | Baseline LOC | Current LOC | Delta |
|---|---:|---:|---:|---:|---:|
| Product source | 108 | 281 | 9,968 | 30,161 | +20,193 |
| Tests | 8 | 135 | 233 | 13,776 | +13,543 |
| CSS | 3 | 3 | 912 | 2,723 | +1,811 |
| i18n | 1 | 1 | 725 | 1,787 | +1,062 |
| Documentation | 47 | 166 | 9,083 | 26,471 | +17,388 |
| Migrations | 3 | 14 | 241 | 3,212 | +2,971 |
| Scripts | 10 | 32 | 966 | 3,802 | +2,836 |
| Tarot/data JSON | 19 | 32 | 25,513 | 44,869 | +19,356 |
| Generated/tooling | 132 | 141 | 36,584 | 37,275 | +691 |
| Other text | 18 | 18 | 481 | 482 | +1 |
| Total tracked text | 443 | 921 | 84,706 | 164,558 | +79,852 |

The source category includes product TypeScript/TSX, server/domain source, schema source, and other first-party source classified as source. It does not include tests, docs, data, migrations, scripts, CSS, or generated/tooling.

Current source composition is therefore:

- product source: 30,161 LOC;
- tests: 13,776 LOC;
- CSS: 2,723 LOC;
- i18n: 1,787 LOC;
- docs: 26,471 LOC;
- migrations: 3,212 LOC;
- scripts: 3,802 LOC;
- data: 44,869 LOC;
- generated/tooling: 37,275 LOC.

## Why the reported approximately 44k to approximately 80k number appears

The approximately 44k starting value is close to the broad tag's 45,462 tracked text LOC.

The approximately 80k current value is close to current tracked text after excluding:

- binary assets;
- tarot/data JSON;
- generated/tooling files.

That current narrowed value is 82,414 LOC.

This is a scope mismatch rather than a single UI-only growth event. The broad baseline includes only 782 generated LOC and no tests or i18n category under the same classification, while the current repository includes:

- 13,776 test LOC;
- 44,869 tarot/data LOC;
- 37,275 generated/tooling LOC;
- 26,471 documentation LOC;
- 3,212 migration LOC;
- 3,802 script LOC.

A meaningful comparison must name the scope on both endpoints. The strongest like-for-like statements are:

- all tracked text: 45,462 to 164,558, +119,096;
- product source: 8,114 at the broad tag to 30,161 current, +22,047;
- tight pre-redesign product source: 9,968 to 30,161, +20,193;
- UI tree excluding API routes: approximately +5,583 net.

## True source increase

The true first-party product source increase from the tight baseline is +20,193 LOC, from 9,968 to 30,161.

That increase is broader than UI. It includes database/schema code, auth and member code, credits, tarot repositories/catalogs, server routes, commerce, reading logic, and other domain code.

For the UI tree:

| UI scope | Added | Removed | Net |
|---|---:|---:|---:|
| app/components, excluding CSS | 5,673 | 448 | +5,225 |
| app/components, API routes excluded | 4,208 | 436 | +3,772 |
| API routes within app/components | 1,465 | 12 | +1,453 |
| app/globals.css | 1,819 | 8 | +1,811 |
| UI tree excluding API routes, including CSS | 6,027 | 444 | +5,583 |

The UI number is an upper-bound architecture measure because shared wrappers and compatibility exports are included. It is not a claim that every added line renders in every route.

## Main causes of growth

### Legitimate product and feature growth

The recent history contains real feature expansion, including:

- guidebook constellation and card-detail work;
- Home and Practice redesigns;
- Daily Cosmic functionality;
- reading result and reading-panel improvements;
- member navigation and auth/member flows;
- affiliate dashboard functionality;
- packages, membership, checkout, and commerce surfaces;
- new shell/navigation/theme tokens;
- tarot catalog, seeded card data, and database support;
- share and QR functionality;
- deployment/release safety and production guards.

Several redesign commits added substantial UI surface, but the integration merges replayed and reconciled changes. Their additions must not be summed as unique LOC:

| Commit | Feature area | UI paths added | UI paths removed | Net |
|---|---|---:|---:|---:|
| d29da9a | room redesign | 38 | 74 | -36 |
| eca9421 | daily cosmic | 188 | 22 | +166 |
| e952744 | brand tokens | 75 | 2 | +73 |
| 338f20e | shared shell | 17 | 4 | +13 |
| 7ad236a | surface unification | 56 | 11 | +45 |
| c8e1094 | reading redesign | 193 | 84 | +109 |
| e4db7d2 | member/affiliate functional UI | 238 | 261 | -23 |
| d0c7e76 | member navigation | 25 | 1 | +24 |
| c4b90a1 | Home | 214 | 27 | +187 |
| 2ad1864 | Practice | 123 | 51 | +72 |
| 20f6f66 | Guidebook | 269 | 22 | +247 |
| 72273d9 | Affiliate | 317 | 15 | +302 |
| 69f3c97 | packages | 234 | 53 | +181 |

Integration merge churn included:

- 3c5f194: 25 files, +3,616/-17;
- 51f0f55: 22 files, +1,921/-295;
- 054a463: 13 files, +843/-151;
- e75965d: 14 files, +900/-45.

These merge figures describe reconciliation activity and are not additional unique source beyond the final tree.

### Tests

Tests grew from 233 to 13,776 LOC, a net increase of 13,543 LOC. The current tree contains 135 tracked test files.

This is legitimate repository growth rather than UI duplication. The test suite covers navigation, contracts, auth/member flows, credits, reading behavior, deployment, i18n, routes, and redesign regressions.

One duplicate test title was found in tests/deployment-contract.test.ts: the title “release retention templates expose the candidate, lock, and bounded-journal contracts” appears twice. This is a naming-quality issue, not evidence that the test behavior is duplicate or dead.

No high-confidence obsolete test file was identified solely from names or imports.

### Tarot/data growth

The tarot catalog and seed data contributed 19,356 LOC from the tight baseline:

- natarot-knowledge/v5/cards/all-78-cards.json;
- major-arcana.json;
- human-style-50-complete.json;
- golden-50.json;
- suit-specific card data;
- additional tracked data files.

This is data growth, not executable UI duplication. It should be counted separately in repository dashboards.

### Documentation and scripts

Documentation grew by 17,388 LOC from the tight baseline, including design and architecture research, implementation plans, deployment plans, and project-state history.

Scripts grew by 2,836 LOC, including production storage and release-manager tooling. These files increase repository size but are operational support, not browser UI.

### i18n

lib/i18n.ts grew from 725 to 1,787 LOC, a net increase of 1,062. An AST check found:

- 871 leaf paths in English;
- 871 leaf paths in Vietnamese;
- zero paths present in only one locale;
- zero duplicate keys in either locale.

The i18n growth is legitimate and currently has exact en/vi structural parity. Dynamic and template-derived key usage means a simple literal grep is not sufficient to remove keys.

## Top growth files

Top net file growth from 6c5f9ef to e75965d:

| File | Baseline LOC | Current LOC | Added | Removed | Net | Category |
|---|---:|---:|---:|---:|---:|---|
| natarot-knowledge/v5/cards/all-78-cards.json | 0 | 7,975 | 7,976 | 0 | +7,975 | data |
| natarot-knowledge/v5/cards/major-arcana.json | 0 | 2,204 | 2,205 | 0 | +2,204 | data |
| app/globals.css | 154 | 1,965 | 1,819 | 8 | +1,811 | CSS |
| natarot-knowledge/v5/human-style-50-complete.json | 0 | 1,655 | 1,656 | 0 | +1,655 | data |
| natarot-knowledge/v5/cards/cups.json | 0 | 1,446 | 1,447 | 0 | +1,446 | data |
| natarot-knowledge/v5/cards/pentacles.json | 0 | 1,446 | 1,447 | 0 | +1,446 | data |
| natarot-knowledge/v5/cards/swords.json | 0 | 1,446 | 1,447 | 0 | +1,446 | data |
| natarot-knowledge/v5/cards/wands.json | 0 | 1,446 | 1,447 | 0 | +1,446 | data |
| docs/superpowers/specs/2026-09-20-affiliate-share-architecture-research.md | 0 | 1,376 | 1,376 | 0 | +1,376 | docs |
| drizzle/meta/0001_snapshot.json | 0 | 1,352 | 1,353 | 0 | +1,352 | migrations |
| natarot-knowledge/v5/golden-50.json | 0 | 1,155 | 1,155 | 0 | +1,155 | data |
| lib/i18n.ts | 725 | 1,787 | 1,107 | 45 | +1,062 | i18n |
| deploy/release/natarot-release-manager.sh | 0 | 1,044 | 1,044 | 0 | +1,044 | scripts |
| docs/superpowers/plans/2026-09-20-member-auth-implementation-plan.md | 0 | 869 | 869 | 0 | +869 | docs |
| docs/superpowers/plans/2026-09-20-dynamic-tarot-reading-implementation-plan.md | 0 | 763 | 763 | 0 | +763 | docs |
| tests/tarot-ai.test.ts | 0 | 742 | 742 | 0 | +742 | tests |
| db/schema.ts | 4 | 739 | 739 | 4 | +735 | source |
| docs/superpowers/plans/2026-09-20-personal-centric-vintarot-implementation-plan.md | 0 | 680 | 680 | 0 | +680 | docs |
| lib/credits/repository.ts | 0 | 667 | 667 | 0 | +667 | source |
| drizzle/0002_tarot_seed.sql | 0 | 634 | 634 | 0 | +634 | migrations |
| lib/member-auth.ts | 0 | 628 | 628 | 0 | +628 | source |
| docs/superpowers/plans/2026-09-20-reading-result-implementation-plan.md | 0 | 556 | 556 | 0 | +556 | docs |
| docs/superpowers/plans/2026-09-20-vps-deployment-implementation-plan.md | 0 | 529 | 529 | 0 | +529 | docs |
| lib/auth-handlers.ts | 0 | 500 | 500 | 0 | +500 | source |
| lib/tarot-repository.ts | 0 | 448 | 448 | 0 | +448 | source |
| docs/PROJECT_STATE.md | 31 | 467 | 442 | 6 | +436 | docs |
| docs/superpowers/specs/2026-09-20-ai-reading-engine-architecture.md | 0 | 436 | 436 | 0 | +436 | docs |
| lib/tarot-catalog.ts | 0 | 433 | 433 | 0 | +433 | source |
| tests/tarot-reading-service.test.ts | 0 | 428 | 428 | 0 | +428 | tests |
| scripts/production-storage-guard.mjs | 0 | 416 | 416 | 0 | +416 | scripts |

The top list shows why a single UI duplication hypothesis is incomplete: the largest additions include card data, migrations, docs, deployment support, tests, and domain source.

## Top problem files and architecture findings

### app/globals.css — 1,965 LOC current

This is the highest-risk UI maintenance file. It contains old compact/legacy styles and multiple later design layers in one file.

The file includes:

- early body, topbar, sidebar, hero, daily, card, library, game, journal, profile, and book rules;
- motion and 3D card rules;
- Guidebook, Room, Home, Create, Practice, Daily, reading, auth, member, Affiliate, account, membership, and Reading Result sections;
- token aliases and later shell primitives;
- 125 media-query blocks;
- 249 uses of !important;
- 488 hex-color occurrences;
- 1,118 rgb/rgba occurrences;
- 26 reduced-motion rules.

A parser found approximately 3,590 selector tokens, 2,264 unique selectors, and 845 repeated selector tokens. Repeated selectors are not automatically bad because many are intentional responsive or route-specific overrides, but the volume confirms that the file has become a layered override system.

### app/pages.tsx — 1,128 LOC current

This remains a monolithic client surface containing:

- CardFace and CardDetail;
- GuidebookCardPage compatibility wrapper;
- CardPicker;
- SignIn;
- the Pages route switch;
- GuidebookLibrary and the Library compatibility wrapper;
- ImmersiveCardDetail;
- Practice;
- Profile;
- Book;
- Invites;
- legacy compatibility routes.

The Library wrapper is not dead: tests/navigation-guidebook.test.ts asserts that compatibility shape. The file should not be split or deleted as a first cleanup without route and test coverage, but it is a clear future architecture boundary.

### app/vintarot.tsx — 327 LOC current

This is the active shared shell, but it contains route-specific parallel branches:

- route flags for Home, Guidebook, Create, Practice, Room, Daily, Affiliate, and Membership;
- separate site, home, affiliate, membership, practice, personal, commerce, and top navigation arrays;
- route-specific header and sidebar branches;
- footer branches;
- a home hero area.

The shell has approximately 80–120 duplicate-equivalent LOC in route-specific structure and arrays. This is a medium-confidence architecture estimate, not a safe deletion number.

### app/commerce/commerce-pages.tsx — 336 LOC current

PackagesPage and CheckoutPage are active. The file also contains an old AffiliatePage, AffiliatePolicy, AffiliateDashboardView, and related types/helpers.

A repository-wide import search found AffiliatePage only at its definition; the active /affiliate route imports components/affiliate/affiliate-dashboard instead. This is the strongest high-confidence orphaned product subgraph identified in the audit, estimated at approximately 70–90 LOC including its local helper and view surface.

The old subtree should be removed only after confirming there is no dynamic import, route alias, or external contract depending on it.

### components/affiliate/affiliate-dashboard.tsx — 223 LOC current

This is the active Affiliate route implementation. Its existence beside the orphaned AffiliatePage in commerce-pages is the clearest old/new product-path coexistence found.

### lib/i18n.ts — 1,787 LOC current

This is large because the locale dictionaries are in one file. The current English and Vietnamese trees are exactly structurally aligned. A future split by domain could improve maintainability, but deleting keys based on static literal usage would be unsafe because status and template keys are dynamic.

## Old and new UI coexistence

The evidence supports coexistence of implementation layers, not necessarily two fully active versions of every page.

Confirmed or likely coexistence:

- old compact/legacy CSS blocks remain in app/globals.css alongside newer tokenized and route-specific blocks;
- old AffiliatePage code remains in commerce-pages.tsx beside active components/affiliate/affiliate-dashboard.tsx;
- app/pages.tsx keeps older compatibility exports and wrappers while newer direct route files exist;
- route-specific shell branches coexist with shared shell primitives and token aliases.

Not confirmed as dead duplicate page implementations:

- no separate old Home component was found as an active competing route;
- no separate old Practice page was found as an active competing route;
- no separate old Packages route was found competing with app/packages/page.tsx;
- no separate old Reading Result route was found that could safely be removed based on names alone.

The current route entry points are:

- app/page.tsx delegates to VinTarot;
- app/[section]/page.tsx whitelists legacy/member sections and imports Pages;
- app/guidebook/[card]/page.tsx imports GuidebookCardPage;
- app/packages/page.tsx imports PackagesPage from commerce-pages;
- app/checkout/page.tsx imports CheckoutPage from commerce-pages;
- app/affiliate/page.tsx imports the active affiliate dashboard;
- app/account/page.tsx imports AccountHistory.

This route map should be treated as the authority before any UI cleanup.

## Shared component duplication

The main structural duplication is not multiple copies of the same rendered page. It is repeated orchestration:

- VinTarotShell maintains several navigation arrays that differ by route family;
- header, sidebar, and footer composition branches repeat shell decisions;
- Pages remains a compatibility router while direct route files coexist;
- card presentation logic is shared through CardFace, CardDetail, CardPicker, and reading components, but the monolithic file makes boundaries difficult to see;
- Room imports ReadingPanel and CardPicker from different locations, so ownership of reading/card composition is distributed;
- Commerce retains old local affiliate view code while the active affiliate route uses a dedicated component.

Estimated duplicate-equivalent structural pool: approximately 80–120 LOC in shell/navigation branches plus smaller repeated compatibility/orchestration patterns. This estimate is about maintainability surface, not exact textual duplicate lines.

## CSS duplication and stale-style risk

CSS is the most plausible source of safe cleanup after the orphaned Affiliate subtree, but it requires browser confirmation.

Findings:

- app/globals.css grew from 154 LOC at the tight baseline to 1,965 LOC current;
- the CSS category grew by 1,811 LOC;
- old and new sections are separated by comments, but share selectors and overrides;
- exact repeated selector tokens: 845;
- !important: 249;
- @media: 125;
- reduced-motion blocks: 26;
- common repeated colors include #111, #fff, #888, #bbb, #f5f5f5, #f4ebdd, #e2b966, #020b18, and several repeated rgba values.

The following are candidate pools, not deletion recommendations:

- old legacy/base selector family: approximately 5.7k characters, roughly 72 80-column rule-equivalent lines;
- old Guidebook selector family: approximately 12.5k characters, roughly 157 rule-equivalent lines;
- old commerce selector family: approximately 2.8k characters, roughly 35 rule-equivalent lines;
- broader stale/overridden CSS candidate pool: approximately 30k characters, roughly 350–380 rule-equivalent lines.

Dynamic class suffixes, route parent selectors, responsive overrides, and CSS-only states create false positives in static scans. No CSS block should be removed without route smoke tests and viewport checks.

## Dead code estimate

### High-confidence dead or orphaned product code

Approximately 70–90 LOC:

- old AffiliatePage subtree in app/commerce/commerce-pages.tsx;
- AffiliatePolicy/AffiliateDashboardView and local helpers/types used only by that subtree.

This estimate is based on definition-only search plus the active route import map. It still needs a final dynamic import and contract check before deletion.

### Medium-confidence stale or duplicate code

Approximately 300–500 additional LOC-equivalent:

- old/overridden CSS families;
- route-specific shell/navigation parallelism;
- compatibility/orchestration overlap.

This is a cleanup candidate pool, not proven dead code.

### Optional UI primitive catalog

A simple import/reachability probe found 25 files under components/ui with no confirmed static runtime import, totaling approximately 3,363 LOC:

- accordion.tsx;
- aspect-ratio.tsx;
- attachment.tsx;
- breadcrumb.tsx;
- bubble.tsx;
- button-group.tsx;
- chart.tsx;
- combobox.tsx;
- command.tsx;
- context-menu.tsx;
- drawer.tsx;
- dropdown-menu.tsx;
- hover-card.tsx;
- input-otp.tsx;
- marker.tsx;
- menubar.tsx;
- message-scroller.tsx;
- native-select.tsx;
- navigation-menu.tsx;
- pagination.tsx;
- resizable.tsx;
- scroll-area.tsx;
- slider.tsx;
- sonner.tsx;
- toggle-group.tsx.

This looks like an optional shadcn-style primitive catalog, not confirmed dead product code. It may be intentionally preinstalled for future UI work. It must be inventoried and owner-approved before removal.

## Generated, vendor, and accidental LOC

Current generated/tooling classification: 37,275 LOC.

Breakdown:

| Area | Files | LOC |
|---|---:|---:|
| .codex | 129 | 36,328 |
| .superpowers | 9 | 874 |
| .openai | 1 | 5 |
| build | 2 | 68 |
| Total | 141 | 37,275 |

The largest single tracked tooling file is .codex/skills/impeccable/scripts/live-browser.js at approximately 13,510 LOC.

No tracked .next, dist, coverage, browser-trace, screenshots, temp, .bak, .old, or .tmp build/debug output was found in the measured trees.

The build directory contains a Vite plugin source file and its license rather than compiled application output.

The repository also contains a 73-file vendor/template area and large package locks, including approximately 9,961 and 14,124 LOC lockfiles. These are intentional or uncertain dependency/tooling weight, not accidental UI duplication.

A binary asset hash scan found 98 current binary assets totaling approximately 21,033,375 bytes and no exact duplicate asset hashes.

## Legitimate UI and feature growth

The UI tree's net increase is approximately 5,583 LOC excluding API routes. The growth is attributable to real product work:

- Guidebook target/header and constellation UI;
- Home owner redesign;
- Practice V1;
- Daily Cosmic and reading interactions;
- Room and reading-panel improvements;
- member navigation and account surface;
- affiliate dashboard;
- packages, membership, and checkout;
- shared brand tokens, shell behavior, motion, and responsive states;
- new card and reading presentation states.

The key distinction is that UI growth is real but not equal to the entire repository growth. The largest absolute additions are data, tests, docs, migrations, tooling, and domain/backend source.

## Legitimate test growth

The current 13,776 test LOC should remain counted as test code, not collapsed into the UI source metric.

The test suite provides contract and regression protection for systems that must not be disturbed during cleanup. In particular, route wrappers, navigation, i18n parity, auth/member behavior, credits, payment and affiliate contracts, reading persistence, deployment retention, and release guards have separate behavioral value.

Recommended test hygiene is limited to:

- rename the duplicated deployment-contract test title;
- keep test files unless a behavior-level coverage map proves they are obsolete;
- preserve tests before any CSS or shell extraction;
- add route and viewport smoke coverage before CSS deletion.

## Safe cleanup plan

### P0: low-risk inventory and orphan cleanup

1. Confirm all imports, dynamic imports, route aliases, and test references for old AffiliatePage.
2. Remove only the confirmed orphaned AffiliatePage subtree from commerce-pages.tsx.
3. Rename the duplicated deployment-contract test title.
4. Remove stale “FUNCTIONAL UI — NOT FINAL DESIGN” comments only where they are demonstrably stale and not serving as product guidance.

Risk: low to medium.
Verification: typecheck, affiliate route tests, full test suite, route smoke.

### P1: CSS and optional primitive audit

1. Build a selector-to-runtime-class inventory.
2. Browser-check room-interpretation, legacy Guidebook, and old commerce selectors.
3. Remove only CSS blocks confirmed unused across desktop, mobile, reduced-motion, and route-specific states.
4. Inventory the 25 unused UI primitives and mark each as optional catalog, planned, or removable.
5. Do not batch-delete the primitive catalog.

Risk: medium.
Verification: visual snapshots or equivalent browser checks for all routes, breakpoints, cards, reading states, and auth/member surfaces.

### P2: structural refactor after behavior is locked

1. Extract Header, Sidebar, Footer, and route navigation slots from VinTarotShell.
2. Split app/pages.tsx by route/domain while preserving compatibility exports and the exact Library wrapper contract.
3. Split commerce pages and remove the old Affiliate subtree only after P0 confirmation.
4. Split i18n by domain only if generated key parity checks remain mandatory.
5. Layer app/globals.css into tokens, shell, components, and pages only with a migration map.

Risk: high.
Verification: full test suite, all route smoke tests, browser visual checks, i18n parity, auth/member/credits/payment/affiliate contract checks.

### P3: metric and repository hygiene

1. Report product source, tests, docs, data, migrations, scripts, generated/tooling, and assets as separate dashboard categories.
2. Keep .codex and other internal tooling out of “product LOC” charts even if the files remain tracked.
3. Add a static import graph and CSS selector inventory to audit tooling.
4. Revisit vendor/template and package-lock weight only as a separate dependency/tooling decision.

## Estimated cleanup potential

The following is an estimate, not a proposed deletion commit:

| Cleanup view | Estimated LOC | Meaning |
|---|---:|---|
| High-confidence orphan | 70–90 | Old AffiliatePage subtree only |
| Conservative clean-up pool | 400–600 | Orphan plus confirmed stale/duplicate shell/CSS after verification |
| Broader optional pool | 3,700–4,500 | Conservative pool plus optional unused UI primitive catalog |

Estimated clean first-party source after conservative cleanup: approximately 29.4k–29.8k LOC, excluding tests, docs, data, migrations, scripts, assets, and generated/tooling.

If the optional 3,363-LOC UI primitive catalog is explicitly retired, a broader clean first-party source range is approximately 25.7k–26.5k LOC. This is not a recommended immediate target; the catalog may be intentional future capacity.

No responsible estimate can claim that all approximately 30k CSS candidate characters are removable. The CSS candidate pool is a review queue, not dead-code inventory.

## Final audit metrics

- BASELINE: 6c5f9ef tight product line; broad comparison tag 64fca6d.
- CURRENT: e75965d.
- REPORTED: approximately 44k to approximately 80k, explained by scope mismatch.
- MEASURED SOURCE LOC: 9,968 to 30,161 from tight baseline; +20,193.
- MEASURED UI TREE LOC: approximately +5,583 net excluding API routes.
- CURRENT TEST LOC: 13,776.
- CURRENT CSS LOC: 2,723 total; app/globals.css 1,965.
- CURRENT DATA LOC: 44,869.
- CURRENT GENERATED/TOOLING LOC: 37,275.
- DUPLICATE LOC ESTIMATE: approximately 400–600 LOC-equivalent conservative pool.
- DEAD LOC ESTIMATE: approximately 70–90 high-confidence product LOC; broader medium-confidence pool approximately 400–600.
- ACCIDENTAL/GENERATED LOC: 37,275 tracked internal/generated/tooling LOC; accidental compiled/debug output found: 0.
- LEGITIMATE TEST GROWTH: +13,543 LOC from tight baseline.
- LEGITIMATE FEATURE/UI GROWTH: approximately +5,583 UI-tree LOC excluding API routes, plus domain/backend growth.
- I18N: +1,062 LOC with exact English/Vietnamese leaf-key parity.
- OLD + NEW UI COEXISTING: yes, most clearly in CSS layers, shell branches, compatibility wrappers, and old/new Affiliate implementations.
- SHARED COMPONENT DUPLICATION: route-family shell/navigation branches and compatibility orchestration; approximately 80–120 LOC-equivalent in the shell.
- CSS DUPLICATION: 845 repeated selector tokens and approximately 350–380 rule-equivalent candidate lines; requires browser verification.
- GENERATED FILES TRACKED: primarily .codex tooling, .superpowers, .openai metadata, and build plugin sources.
- SAFE CLEANUP POTENTIAL: P0 orphan 70–90 LOC; conservative 400–600 LOC-equivalent after verification.
- ESTIMATED CLEAN SOURCE AFTER CLEANUP: approximately 29.4k–29.8k first-party source LOC conservatively; broader optional range approximately 25.7k–26.5k.
- RUNTIME MODIFIED: NO.
- PRODUCTION MODIFIED: NO.
- DATABASE/BACKEND CONTRACTS MODIFIED: NO.

## Recommended next step

Approve a separate, staged cleanup branch beginning with the old AffiliatePage import/route audit and test-title correction. Follow that with a browser-verified CSS inventory. Defer shell/pages.tsx extraction and UI primitive removal until route, i18n, auth/member, credits, payment, affiliate, reading persistence, and deployment-contract tests are locked.

This audit report is the only intended file change from the audit session.
