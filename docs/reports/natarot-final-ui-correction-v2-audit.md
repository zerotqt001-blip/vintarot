# NaTarot Final UI Correction V2 — Target vs Production Audit

Date: 2026-09-24 (Asia/Ho_Chi_Minh)

Base source: `codex/natarot-final-visual-fidelity-v1`, `a78873cae0f9dadad74cc3435a3bddc5bea2c5aa`

Production release previously recorded: `final-visual-v1-4ec9ecb-20260923T192720Z-runtime` (live VPS identity could not be freshly read: SSH returned `Permission denied (publickey,password)`).

Scope: owner-provided six target screenshots and the public `https://natarot.com` routes. This is the pre-edit audit; it records observed guest state rather than manufacturing member data.

## Evidence and severity

| Surface | Owner target | Target size | Current production route/state |
| --- | --- | ---: | --- |
| Tarot Library | `/Users/tranquangthanh/Downloads/ChatGPT Image 12_31_06 23 thg 9, 2026.png` | 1660×948 | `/guidebook`, public library |
| Practice | `/Users/tranquangthanh/Downloads/ChatGPT Image 12_30_55 23 thg 9, 2026.png` | 1660×948 | `/community`, public practice |
| Packages | `/Users/tranquangthanh/Downloads/ChatGPT Image 12_30_45 23 thg 9, 2026.png` | 1672×941 | `/packages`, live catalog after loading |
| Affiliate | `/Users/tranquangthanh/Downloads/ChatGPT Image 12_30_24 23 thg 9, 2026.png` | 1672×941 | `/affiliate`, unauthenticated safe state |
| Account | `/Users/tranquangthanh/Downloads/ChatGPT Image 12_30_10 23 thg 9, 2026.png` | 1536×1024 | `/account`, unauthenticated safe state |
| Reading Result | `/Users/tranquangthanh/Downloads/ChatGPT Image 12_28_17 23 thg 9, 2026.png` | 1536×1024 | `/room`, guest entry/draw state; no completed persisted result loaded |

Target dimensions were read from the supplied PNGs. Current routes were inspected in the real production browser on 2026-09-24; desktop capture viewport was 1660×948 for the route sweep. Packages was allowed to settle from loading before comparison. Affiliate and Account were not authenticated. `/room` rendered a guest draw/session surface, not a completed Reading Result. No target-screenshot business values were used as production data.

Severity: **CRITICAL** means the primary task or its visual verification is blocked; **MAJOR** means the target hierarchy/composition is materially weakened; **MINOR** means localized polish that does not displace the page purpose.

## Shared system audit

| Dimension | Owner target language | Current production observation | Severity |
| --- | --- | --- | --- |
| Overall composition / content width | Stable global header; compact left rail on most product pages; content receives the width; reading result is immersive but still part of the same product. | Shared shell exists, but variants create visibly different header/action/sidebar/footer compositions. Library and Practice retain target concepts; account/affiliate and `/room` are not the same authenticated/result states as the targets. | MAJOR; Reading Result state is CRITICAL |
| Header / logo / wordmark / tagline | One slim midnight header; same NaTarot lockup, tagline, top-level links, locale/theme/account controls and active indicator. | `NaTarotHeader` branches into Guidebook, Home, Practice, Affiliate, Membership and generic implementations/classes; `/room` resolves to an immersive variant with a different navigation composition. Shared brand is present, but control treatment/spacing differs by variant. | MAJOR |
| Sidebar / width / item rhythm / active state | Approximately 200px in target captures; five clear icon-and-label destinations; restrained active fill; compact brand sign-off. | Canonical sidebar is reused, but arc labels and route-specific nav arrays make labels visually small/curved and active treatment inconsistent; rail/item rhythm competes with content on denser pages. Some page variants replace the rail with a separate target sidebar. | MAJOR |
| Footer / links / social controls | Quiet, shallow navy close with small logo/tagline, links and restrained social icons. | Variant-specific footer implementations remain; generic footer repeats welcome copy in a marquee, while Affiliate and Membership each have separate markup/classes. This creates inconsistent height and visual motion. | MAJOR |
| Surface hierarchy / panel count and weight | Three clear levels: one primary focus, functional secondary panels, quiet tertiary support. | Shared CSS exposes several page-specific surface families; current dense routes use many bounded boxes and stronger borders than their reading hierarchy needs. | MAJOR |
| Gold / borders / glow | Selective champagne gold for active/primary/selected details; navy surfaces and thin muted edges carry the rest. | Repeated gold edges/highlight treatments across routes flatten emphasis; glow/border intensity varies by page and draws attention away from content. | MAJOR |
| Background / decoration | Persistent celestial identity with intensity keyed to page purpose: high on Library/Practice/spread, medium Packages, lower Affiliate/Account/reading text. | Celestial assets and motifs exist, but page variants do not consistently control contrast/texture behind the content; data-heavy/member surfaces compete with decorative context. | MAJOR |
| Typography / spacing / negative space | Editorial serif for display and important headings; clean sans for body, controls, metadata and tables; meaningful breathing room and readable measures. | Brand fonts and editorial headings are present. Variants use distinct title sizes, small labels, compressed support copy and uneven gaps; dense result/member layouts need clearer scale and whitespace. | MAJOR |

## Page-by-page comparison

### Tarot Library — `/guidebook` (requested change level: LOW)

| Dimension | Target vs current | Severity |
| --- | --- | --- |
| Overall composition / focal point | Target is a large, centered five-suit constellation with `78 LÁ BÀI` at the core. Current preserves the constellation, five canonical groups and counts; target’s central map/card system is more prominent and legible. | MINOR |
| Visual hierarchy / CTA | Target moves from title to constellation to per-suit `Khám phá`; current uses similar sequence, but small category labels/actions lose weight against the orbit and side copy. | MINOR |
| Content width / spacing / negative space | Target gives the orbit a broad central stage with clear gutters; current stage is narrower relative to the full shell and surrounding orbit/decor occupy more of the canvas. | MAJOR |
| Header | Target top bar is compact and has the standard five links plus utilities; current Guidebook-specific top nav retains brand/tagline and controls but uses a reduced route set and variant-specific action labels. | MAJOR |
| Sidebar | Target has five large, readable icon-over-label links and a brand sign-off; current has the same destinations but uses the canonical arc-label treatment and visually tight repeated item rhythm. | MAJOR |
| Footer | Target is a quiet horizontal signature and link row; current footer has a different compact link arrangement. | MINOR |
| Background / ornament | Target has a dramatic observatory scene, visible objects and a readable orbit; current’s celestial backdrop is darker/fainter and the horoscope/orbit lines cover more of the field than the target’s clear central grouping. | MAJOR |
| Panel count / weight | Both rely on five suit nodes, not generic grids. Current nodes read as smaller, repeated bounded circles; target nodes form a more generous, connected map. | MINOR |
| Gold / border / glow | Target uses bright gold on orbit nodes, central star and CTA only; current gold is less legible in the map and more distributed among outlines. | MINOR |
| Typography / readability / density | Target uses a larger page title and readable suit descriptions; current suit microcopy is denser/smaller and title-to-map spacing compresses the content. | MAJOR |

### Practice — `/community` (requested change level: LOW–MEDIUM)

| Dimension | Target vs current | Severity |
| --- | --- | --- |
| Overall composition / focal point | Both use a large Tarot card/altar on the left and reflection workspace on the right. Current retains this composition; target card is larger and its artwork is clearly the first focal point. | MINOR |
| Visual hierarchy / CTA | Target’s flow is Card → Observe → Reflect → Save/Reveal. Current adds visible quote/guidance/read-together elements that compete with the reflection step and primary actions. | MAJOR |
| Content width / spacing / negative space | Target leaves space between the card stage and one primary reflection panel; current stage/panel proportions are acceptable but secondary copy and decorative rails fill more of the canvas. | MAJOR |
| Header | Target uses the same concise global header as Library/Packages; current Practice uses its own action arrangement and account control treatment. | MAJOR |
| Sidebar | Target icon labels are clear beneath each icon; current arc labels/spacing are less direct and the rail draws attention from the practice workspace. | MAJOR |
| Footer | Target footer is a simple consistent close; current footer behavior varies from the target global row. | MINOR |
| Background / ornament | Target uses a rich altar scene around the focal card with localized light; current backdrop is faint/low-contrast, while side quote/vertical guidance still add competing ornaments. | MAJOR |
| Panel count / weight | Target has one dominant reflection surface and restrained guidance; current reflection, guidance, quote and read-together blocks are more equal in weight. | MAJOR |
| Gold / border / glow | Target frames the card/reflection CTA selectively; current border/highlight repeats around controls and panels. | MINOR |
| Typography / readability / density | Target body copy is readable and the quote is tertiary; current quote/guidance labels have excess visual weight and competing line lengths. | MAJOR |

### Packages — `/packages` (requested change level: MEDIUM)

| Dimension | Target vs current | Severity |
| --- | --- | --- |
| Overall composition / focal point | Target puts four comparable purchase choices first, followed by a concise “what one Credit does” flow and quiet supporting sections. Current has the same live four-package row and supporting journey, but more ornament/metadata competes above it. | MAJOR |
| Visual hierarchy / CTA | Target’s 10-Credit option is clearly popular, while all package counts/prices and selection buttons scan quickly. Current canonical products/prices and popular state are present; decorative icons, microcopy and surrounding regions dilute buying actions. | MAJOR |
| Content width / spacing / negative space | Target uses four medium cards with even spacing and enough room for a separate three-step explanation; current content is dense and secondary blocks push the decision region down. | MAJOR |
| Header / sidebar / footer | Target uses the same global header and compact left rail/footer as the other account surfaces; current Membership-specific top actions/footer and shared rail variant do not fully match. | MAJOR |
| Background / ornament | Target keeps a low-to-medium celestial scene behind cards and isolates the purchase surface; current decorative background/side copy competes with price selection. | MAJOR |
| Panel count / weight | Target has four plan cards, one explanatory process, two small secondary cards and one assurance row; current boxes/borders across these supporting regions read as several co-primary panels. | MAJOR |
| Gold / border / glow | Target reserves strongest gold treatment for the 10-Credit selection and small icons; current card borders and gold details are more evenly applied. | MAJOR |
| Typography / readability / density | Target makes amount, unit price, 30-day validity and button label scan in seconds; current package labels remain small relative to decoration and have denser supporting copy. | MAJOR |

### Affiliate — `/affiliate` (requested change level: MEDIUM–HIGH)

| Dimension | Target vs current | Severity |
| --- | --- | --- |
| Overall composition / focal point | Target is a member dashboard: KPI strip, tier/progress, referral link/QR, income/history and a process/policy row. Current public state is an unauthenticated safe page and cannot be treated as a member-dashboard comparison. | CRITICAL (authenticated state not available) |
| Visual hierarchy / CTA | Target emphasizes rate/tier and referral sharing first; current public page emphasizes joining/explaining the program and safe no-policy state. Authenticated CTA placement is not comparable. | MAJOR; auth state is CRITICAL |
| Content width / spacing / negative space | Target gives data panels room in a two-column dashboard; current marketing/safe-state composition is more vertically explanatory and lower-density. | MAJOR |
| Header / sidebar / footer | Target follows global header, left rail and quiet footer. Current Affiliate has its own right-side header actions and footer implementation; rail remains visually prominent. | MAJOR |
| Background / ornament | Target uses medium atmosphere behind the dashboard, with data panels legible; current public page still has prominent celestial decorative regions relative to its safe-state content. | MAJOR |
| Panel count / weight | Target has a KPI row, two primary panels and lower income/referral/how-it-works groups; current page has explanatory/empty-policy panels rather than these owner-scoped datasets. | CRITICAL (state mismatch) |
| Gold / border / glow | Target’s gold indicates key rate/progress/share details, not every dashboard edge; current offers more distributed emphasis. | MAJOR |
| Typography / readability / density | Target values and table rows are legible in compact data typography; current is copy-heavy public program content, not the target data density. | MAJOR |

### Account — `/account` (requested change level: MEDIUM–HIGH)

| Dimension | Target vs current | Severity |
| --- | --- | --- |
| Overall composition / focal point | Target is “my NaTarot space”: profile identity, Credits/membership/reading/Affiliate status, recent readings/transactions/settings. Current guest state correctly shows a sign-in boundary, so owner-state composition is unavailable. | CRITICAL (authenticated state not available) |
| Visual hierarchy / CTA | Target prioritizes member identity and Credits while keeping history and settings reachable. Current guest sign-in CTA is the only safe primary action. | MAJOR; auth state is CRITICAL |
| Content width / spacing / negative space | Target has a broad profile banner plus grouped data rows and shortcuts; current sign-in content uses a small guest panel and does not exercise that layout. | MAJOR |
| Header / sidebar / footer | Target has the global top nav, left rail and restrained footer. Current generic account shell includes alternate header/nav treatment, arc labels, duplicate mini navigation and a repeated marquee footer. | MAJOR |
| Background / ornament | Target’s account art is medium/subdued and anchored in the banner; current decorative surface and ticker have stronger relative weight because the guest body is sparse. | MAJOR |
| Panel count / weight | Target groups four status summaries, recent readings, shortcuts, transactions and settings; current has one authentication panel. | CRITICAL (state mismatch) |
| Gold / border / glow | Target highlights only the Credits card and selected membership/active states; current shell accents are more uniform. | MAJOR |
| Typography / readability / density | Target mixes editorial title with compact, scannable numbers/tables; current guest state is readable but not a valid target-state comparison. | MINOR visually; auth gate remains CRITICAL |

### Reading Result — `/room` (requested change level: HIGH)

| Dimension | Target vs current | Severity |
| --- | --- | --- |
| Overall composition / focal point | Target is a question-led four-card result with interpretation as the primary content and a narrow related-questions rail. Current guest route is a room/draw entry board with full-width immersive staging; a completed result was not loaded. | CRITICAL |
| Visual hierarchy / CTA | Target order is question → spread → one core answer → insights/action → follow-up; Save/Share/QR are secondary. Current guest entry focuses on draw/session controls and has no completed-answer hierarchy. | CRITICAL |
| Content width / spacing / negative space | Target retains a compact result column with enough width for body text and a right follow-up column; current room screen devotes most of its width to an empty/card-draw scene. | CRITICAL |
| Header / sidebar / footer | Target shows the standard NaTarot header, actions and quiet continuation footer. Current room resolves to a separate immersive shell with no normal product nav/sidebar/footer. | MAJOR |
| Background / ornament | Target keeps atmosphere behind the spread, but cleans the text area; current board has broad immersive celestial decoration with no reading content to balance it. | MAJOR |
| Panel count / weight | Target consolidates related interpretation into fewer editorial surfaces; current entry state is not the result composition and cannot verify result fragmentation. | CRITICAL |
| Gold / border / glow | Target uses focused frame/CTA gold and restrained card highlights; current room staging emphasizes atmospheric gold and session controls. | MAJOR |
| Typography / readability / density | Target gives question/result prose readable editorial measure and keeps metadata small; current guest screen has no result prose to compare. | CRITICAL |

## Data-source audit (screenshot values are visual references only)

| Page / visible data | Source traced in current implementation | Classification / baseline result |
| --- | --- | --- |
| Packages: unit count, price, popularity, validity | `GET /api/packages` → `app/commerce/commerce-pages.tsx`; server catalog/version and benefit snapshot in `lib/packages/catalog.ts`; canonical seed in `scripts/seed-production-catalog.mjs`. | REAL BACKEND/CANONICAL CONFIG. Live values observed: 1/15,000; 5/69,000; 10/129,000 (popular); 20/229,000 VND. All Credit validity is 30 days from verified fulfillment. No purchase/checkout submitted. |
| Affiliate: commission %, referral totals, income, pending balance, referral rows, code/link, QR | `GET /api/affiliate/dashboard` and `/api/affiliate/policy`; `components/affiliate/affiliate-dashboard.tsx`, `lib/affiliate/customer.ts`, `lib/affiliate/policy.ts`; dashboard routes require member-credit owner identity and read active DB policy/profile/ledger projections. | REAL BACKEND/DERIVED when authenticated; public production state safely exposes no owner dashboard. Target screenshot values (10%, 18, 1,245,000, 320,000, 4,860,000, `THANH123`) were not found as dashboard fallbacks and are not accepted as truth. Referral URL stays unavailable when only a one-way stored code hash exists. |
| Account: name, Credits, VIP, saved readings, referrals, transactions | `app/account/page.tsx`, `/api/account/summary`, `/api/account/history`; existing owner-scoped account and history read models. | REAL BACKEND/OWNER-SCOPED when authenticated; public production state is sign-in boundary. Target screenshot values (name, 96 Credits, VIP, 2 readings, 0 referrals and transaction examples) are not used as screenshot fixtures. |
| Reading Result: question/cards/orientations/position meanings/answer/follow-ups | Existing reading/session persistence and payload; `ReadingSpread` consumes canonical spread geometry/position data; `L7/L8` follow-ups and clarification behavior are backend/payload-derived. | REAL PERSISTED/DERIVED. No target question, four-card sequence or answer is substituted. Completed result could not be opened in current guest production session. |

## Pre-edit implementation baseline

Measured from tracked production source on this V2 branch, excluding tests/scripts/vendor where applicable:

- Production TypeScript/TSX: **31,916 LOC**.
- CSS: **2,924 LOC**.
- Canonical shell + brand components: **461 LOC**.
- The canonical system is already under `components/shell`; do not introduce parallel `*V2` shells/components or page-specific duplicate responsive systems.
- Existing protected contracts to preserve: owner-scoped Account/Affiliate routes, Credits ledger/30-day expiry, SePay/payment flows, Auth/F-001, reading persistence, spread identity/order/orientation/geometry, Share/QR, and L7/L8 follow-up/continue behavior.

## Initial priority order

1. **CRITICAL:** make completed Reading Result the hero and use a coherent shared product header without changing reading payload, geometry, prompt, save/share/QR or L7/L8 behavior. Preserve the guest-safe boundary if no persisted result fixture is available.
2. **MAJOR:** fix shared header/sidebar/footer inconsistencies and define shared 3-level surfaces, restrained gold and page-intensity backgrounds.
3. **MAJOR:** reduce packages ornament so plan count, total price/unit price, validity, popular tier and purchase CTA scan first; leave catalog/fulfillment behavior untouched.
4. **CRITICAL state gate / MAJOR visual:** account and Affiliate dashboard remain unauditable against the authenticated targets until an existing owner-test credential can be accessed through a secure mechanism. Never seed target values or bypass auth; continue only safe public/empty-state UI work if the gate persists.
5. **MINOR–MAJOR:** keep Library’s five-group constellation and Practice’s card/reflection composition intact; make only focused hierarchy, shell, whitespace and ornament corrections.

No UI source was modified while creating this audit.

## Final implementation and verification (2026-09-24)

The correction is implemented locally on `codex/natarot-final-ui-correction-v2`, based on `a78873cae0f9dadad74cc3435a3bddc5bea2c5aa`. This is a source candidate only; production was not modified. The prior production release identity is documented above, but fresh SSH access still returns `Permission denied (publickey,password)`, so no current VPS revision, fresh backup, rollback set, production browser capture, or deployment gate could be independently revalidated.

The existing shared shell now presents the common four-destination header, a readable five-destination labeled rail, and a quiet fixed footer across the target product surfaces. Semantic surface/background roles are shared rather than implemented as parallel V2 shells. The Reading Result presentation emphasizes question → dynamic spread → direct answer → insights/actions, preserving the stored payload, card identity/order/orientation, canonical spread geometry, actions, and follow-up behavior. Package framing now clears the fixed header and keeps the existing API/catalog as its only value source. Mobile navigation regression fixes retain all five labeled destinations and visible keyboard focus.

Browser evidence is local and deliberately labeled as guest/empty state, not as authenticated or production fidelity:

| Route / state | Final local capture |
| --- | --- |
| `/guidebook`, guest, 1660×948 | `docs/reports/evidence/natarot-final-ui-correction-v2/local-guest-guidebook-1660x948.png` |
| `/community`, guest, 1660×948 | `docs/reports/evidence/natarot-final-ui-correction-v2/local-guest-practice-1660x948.png` |
| `/packages`, local catalog-empty guest, 1672×941 | `docs/reports/evidence/natarot-final-ui-correction-v2/local-guest-packages-1672x941.png` |
| `/affiliate`, unauthenticated guest, 1672×941 | `docs/reports/evidence/natarot-final-ui-correction-v2/local-guest-affiliate-1672x941.png` |
| `/account`, unauthenticated guest, 1536×1024 | `docs/reports/evidence/natarot-final-ui-correction-v2/local-guest-account-1536x1024.png` |
| `/room`, guest entry (not a persisted result), 1536×1024 | `docs/reports/evidence/natarot-final-ui-correction-v2/local-guest-room-entry-1536x1024.png` |
| `/community`, guest, 390×844 | `docs/reports/evidence/natarot-final-ui-correction-v2/local-guest-practice-mobile-390x844.png` |
| `/community`, guest, 375×812 | `docs/reports/evidence/natarot-final-ui-correction-v2/local-guest-practice-mobile-375x812.png` |
| `/packages`, guest, 412×915 | `docs/reports/evidence/natarot-final-ui-correction-v2/local-guest-packages-mobile-412x915.png` |
| `/affiliate`, guest, 768×1024 | `docs/reports/evidence/natarot-final-ui-correction-v2/local-guest-affiliate-tablet-768x1024.png` |

At 375, 390, 412, and 768 CSS pixels the local DOM checks found all five navigation links and labels, visible 2px keyboard focus, and no horizontal page overflow. Desktop screenshots were saved at each supplied target size; local screenshots are not a substitute for owner-state production evidence. The fresh local D1 has no owner/member/session/reading rows and has 78 canonical Tarot cards. No member/affiliate values or package prices were fabricated, and no target screenshot values were used as data. As a result, the signed-in Account/Affiliate targets and a completed persisted Reading Result remain explicit visual gates.

Final local verification:

- `npx tsx --test tests/*.test.ts`: **637 passed, 0 failed**.
- `npx tsc --noEmit`: passed.
- `npm run build`: passed (runtime reports its non-fatal dynamic-route advisory).
- ESLint over changed TypeScript/TSX files: passed with no findings.
- `git diff --check`: passed.
- Repository-wide `npm run lint` remains an inherited baseline failure (89 errors, 125 warnings outside this change); this pass did not attempt unrelated cleanup.
- Independent review tooling was unavailable; this is a self-review and is not represented as an independent code review.

Source-size accounting on the candidate: production TypeScript/TSX **31,946 LOC** (31,916 baseline; +30); tracked CSS **3,101 LOC** (2,924 baseline; +177); shell and brand components **460 LOC** (461 baseline). The staged `app/components/lib/tests` diff is **+614 / −233 lines** (net +381), including the 12-line spread-layout helper and 135-line V2 contract test. Binary evidence is excluded from line counts. Desktop QA used two visual refinement passes; the final captures above were retained as evidence.

Implementation/evidence commit `303a1d8` is pushed to `origin/codex/natarot-final-ui-correction-v2`; no PR was created. Status: **READY FOR OWNER REVIEW — PRODUCTION UNCHANGED; VISUAL OWNER APPROVAL PENDING.** Deployment was intentionally not attempted because SSH access failed and required release/backup/browser gates cannot be freshly verified. Do not interpret the older deployment records in `docs/PROJECT_STATE.md` as evidence that this V2 candidate has been deployed.
