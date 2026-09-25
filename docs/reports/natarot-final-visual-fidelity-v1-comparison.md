# NaTarot Final Visual Fidelity V1 — Target vs Current

Date: 2026-09-23
Branch: `codex/natarot-final-visual-fidelity-v1`
Source of truth: the six owner screenshots supplied with the final visual-fidelity brief. The screenshots are visual references only; runtime data, authentication and spread geometry remain source-controlled/server-controlled.

## Capture basis

Current-state capture was performed against `https://natarot.com` before edits. Desktop layout metrics were collected at a CSS viewport of `1660 × 948` where the target screenshot supports it; the Reading Result and Account targets are additionally checked at `1536 × 1024`. The production browser was reset to its normal viewport after measurement. Public captures were intentionally unauthenticated unless an existing owner session was available.

| Target | Owner reference | Route | Target state | Current state before this pass |
| --- | --- | --- | --- | --- |
| Reading Result | `/Users/tranquangthanh/Downloads/ChatGPT Image 12_28_17 23 thg 9, 2026.png` | `/room` interpretation state | Completed four-card interpretation with actions, metadata, follow-up rail and editorial panels | Fresh public room opens in draw state; result presentation exists behind the real interpretation boundary and must retain dynamic `SpreadBoard` geometry |
| Guidebook | `/Users/tranquangthanh/Downloads/ChatGPT Image 12_31_06 23 thg 9, 2026.png` | `/guidebook` | Five-family orbit around `78 LÁ BÀI`, shared chrome, observatory atmosphere | Shared target shell is present; orbit reads too small/low-density in the production capture and needs composition-scale and spacing refinement |
| Practice | `/Users/tranquangthanh/Downloads/ChatGPT Image 12_30_55 23 thg 9, 2026.png` | `/community` | Large altar/card on the left, reflection workspace on the right, icon-led sidebar and observatory background | Two-part composition and interactions are present; the card-stage/panel balance and sidebar emphasis need closer target proportions |
| Packages | `/Users/tranquangthanh/Downloads/ChatGPT Image 12_30_45 23 thg 9, 2026.png` | `/packages` | Four visible package cards, balance context, journey/support/trust bands | Production catalog is real and contains the target 1/5/10/20 packages; desktop shell is present, but card density and lower-section cadence require final polish |
| Affiliate | `/Users/tranquangthanh/Downloads/ChatGPT Image 12_30_24 23 thg 9, 2026.png` | `/affiliate` | Authenticated dashboard: four KPIs, tier progress, referral link/QR, income, referrals, flow and policy | Public guest landing is correctly shown without a member session; authenticated dashboard component already owns the target sections and must be visually tuned without exposing fake values |
| Account | `/Users/tranquangthanh/Downloads/ChatGPT Image 12_30_10 23 thg 9, 2026.png` | `/account` | Authenticated member dashboard with profile, four status cards, recent readings, quick access, activity and security | Guest boundary is correctly a sign-in state; authenticated dashboard component owns the target composition and must remain data-driven rather than showing screenshot literals |

## Comparison matrix

| Surface | Composition / proportions | Background / atmosphere | Shared chrome | Typography / density | Data and interaction boundary | Final-pass action |
| --- | --- | --- | --- | --- | --- | --- |
| Guidebook | Hero is centered, but the orbit nodes and center count occupy less visual weight than the owner target at desktop. | Observatory image is present; target needs stronger moonlit architectural depth behind the map while keeping text readable. | Target header/sidebar/footer classes are shared and route-specific only through the shell variant. | Serif title and gold labels are present; node titles/counts need a little more scale and breathing room. | Keep `guidebookGroups` and real card navigation/search. | Increase map/node presentation scale at target desktop widths, preserve the five-group grid, tighten compact-height behavior and verify 700/420px breakpoints. |
| Practice | Left card altar should feel like the visual anchor and the right reflection panel should occupy a more confident half; current gap/rail consumes too much composition width. | Observatory background is correct; overlay needs readable contrast behind the reflection panel. | Sidebar icon orbs and active state should read like the target; header/footer remain shared. | Instrument Serif heading is close; form copy and button row should match target hierarchy without shrinking touch targets. | Preserve random card, save/reveal, journal persistence and `/room` link. | Rebalance `practice-v1-layout`/composition columns, card stage and guidance rail; keep mobile stacking and reduced-motion behavior. |
| Packages | Four cards must read as one deliberate row before the journey/support/trust bands. | Preserve `celestial-observatory.png`, with target-level dark blue/gold contrast. | Membership variant already uses shared shell pieces; footer remains fixed on desktop. | Package numbers/prices should be prominent and benefits compact; lower bands must fit the target desktop cadence. | Keep `/api/packages`, server price/version IDs, 30-day fulfillment snapshot and checkout navigation. | Tune card width/gap/padding and lower-section vertical rhythm; do not insert static 15k/69k/129k/229k values into JSX. |
| Affiliate | Authenticated target is a two-column dashboard with KPI row, tier/income main column and link/referrals side column. | Keep the observatory scene and glass panels; public state may remain a clear landing boundary. | Use the same header/sidebar/footer proportions as Packages/Account. | KPI values and panel headings need target emphasis; empty referral history must not collapse the panel. | Keep policy/dashboard fetches owner-scoped and show guest CTA only when unauthenticated. | Tune dashboard grid/panel sizing and authenticated zero-data rendering; verify no fake screenshot totals or referral URL. |
| Account | Authenticated target is a wide dashboard; guest sign-in is intentionally not the owner screenshot state. | Keep right-side moon/books/candle atmosphere and high-contrast translucent panels. | Same shared shell and footer; no old narrow profile-only fallback. | Profile/stat cards and activity panels need target density at 1536px while remaining readable at 390px. | Keep `/api/account/summary` and cursor-based `/api/account/history`; no demo names, credits or income. | Tune authenticated dashboard layout and stable loading/empty/error panel dimensions; keep guest boundary actionable. |
| Reading Result | Full-canvas result is the correct composition; card placement must remain generated by the canonical spread geometry for 1/3/4/5/7/10-card spreads. | Preserve immersive room background and editorial deep-blue/gold treatment. | Result state intentionally does not render the standard sidebar; top room header/actions remain available. | Header metadata, spread title, card captions and interpretation sections need target hierarchy without nested dashboard boxes. | Preserve real reading payload, save/follow-up actions and dynamic `SpreadBoard`; no hardcoded four-card markup. | Tune result stage scale, spacing and follow-up panel cadence; exercise representative spread geometries and mobile ordered flow. |

## Shared constraints to verify after edits

- `components/shell` remains the only shared header/sidebar/footer/background implementation.
- The Home surface is unchanged except for shared-shell CSS that is explicitly verified not to regress it.
- No screenshot image is added as a page background and no target demo value is hardcoded into a data component.
- At CSS widths `768`, `412`, `390` and `375`, there is no horizontal overflow, clipped primary CTA, unreadable table, or unusably small navigation target.
- Production asset loading remains route-scoped; all observatory backgrounds are CSS/background-owned rather than globally preloaded.
- Final production QA must compare all six routes at desktop and `390px`; this document is not a readiness claim until those captures exist.

## Expected validation evidence

1. Failing source-level fidelity contracts added before implementation, then green after implementation.
2. Local browser iteration for all six routes with at least two desktop comparison rounds and one mobile round.
3. Fresh full test suite, TypeScript, production build, `git diff --check`, changed-file lint and repository lint baseline report.
4. Production backup/integrity/rollback guard, atomic release verification and real navigation at `https://natarot.com`.
5. Final desktop and `390px` production screenshots compared against the six owner references before reporting `READY FOR OWNER VISUAL REVIEW`.
