# NaTarot Integration V3 — Browser QA

Date: 2026-09-22
Environment: isolated browser against `https://staging.natarot.com`

## Desktop observations

At the available 1280px browser viewport, the following rendered with no detected document horizontal overflow: Home, Guidebook, Daily Spread, Practice, Auth, Create, Admin and authenticated Profile. The homepage screenshot retained the NaTarot wordmark, Moonlight-like celestial background, antique-gold controls and glass/navy shell. Create exposed the question/topic entry controls; Profile exposed account fields, Credit/VIP status and safe service-state copy.

Authenticated UI login succeeded with the synthetic staging member and redirected to `/profile`. The account surface showed 10 available Credits and active VIP state. No browser console error was used as a reason to modify product semantics.

## Route outcomes

- `/guidebook`: family/library heading rendered.
- `/daily-spread`: social-energy spread heading rendered.
- `/community`: practice headings rendered.
- `/auth?return_to=/profile`: sign-in form rendered and accepted the synthetic staging member.
- `/create`: question prompt and six topic controls rendered.
- `/admin`: unauthenticated/authorized console boundary rendered; no admin mutation was performed.
- `/packages`: intentionally no public page (`404`); package discovery is API-only in this release.

## Mobile gate

Fresh isolated Chrome viewport checks were available in the closure run. At CSS viewport widths 375px and 390px, Home, Guidebook, Daily Spread, Community, Auth, Create, Profile, Admin, Room and the Share unavailable state all rendered with no document horizontal overflow. A 1440px Home check also had no overflow. The room route loaded its opening state; a physical-device pass of a completed 10-card reading remains an owner-review item.

## Findings

No P0/P1 blocker observed. P2: Profile copy still describes payment as needing setup while the staging-only commercial API is available; defer UI copy/product treatment until payment provisioning is formally approved. P2: live AI and provider-backed SePay checkout/IPN remain external gates. Share is live-verified; Affiliate verified fulfillment/reversal and staff-role mutation flows remain operator-gated.
