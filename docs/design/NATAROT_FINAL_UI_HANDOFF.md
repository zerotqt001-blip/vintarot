# NaTarot Final UI Handoff — V3

Date: 2026-09-22
Reference: Moonlight-inspired NaTarot shell; preserve the existing celestial visual system

## Route and component ownership

| Surface | Route | Owner boundary | Contract to preserve |
| --- | --- | --- | --- |
| Home/shell | `/` | `app/vintarot.tsx`, `app/globals.css`, brand components | Header/sidebar/footer, EN/VI, no horizontal overflow |
| Guidebook | `/guidebook`, `/guidebook/:slug` | guidebook page/components | 78 cards, family navigation, upright/reversed detail |
| Create | `/create` | `app/create/*` | question/topic draft, Auto recommendation, safe room transition |
| Room/SpreadBoard | `/room` | `app/room/*`, `app/room/spread-board.tsx`, spread geometry | deterministic slots, pan/zoom, draw/flip, reduced motion |
| Reading | room reading panel | `components/reading/*` | direct answer, insights, evidence, follow-up/clarification, save/share |
| Auth | `/auth`, `/register`, recovery routes | `app/auth/*`, auth APIs | F-001 identity, session cookie, safe errors |
| Account/history | `/profile`, `/account` | account components and APIs | owner-scoped summary/history, Credits/VIP status |
| Commercial | API `/api/packages`, `/api/commercial/*` | `lib/commercial/*` | SePay Sandbox signed checkout/IPN/reconcile; no public `/packages` page |
| Admin | `/admin` | `app/admin/*`, admin APIs | server-side RBAC, reason/idempotency inputs, audit metadata |

## UI contracts and states

- Loading: keep existing disabled controls and `aria-busy`/live status messaging; do not expose provider payloads or secrets.
- Error: show safe user-facing text only. Preserve no-store headers on identity, account and payment responses.
- Empty: reading panel, history and admin collections must explain the next safe action without fabricating data.
- Permissions: guest, member, staff and finance/admin views must be owner- and role-scoped server-side; client controls are not authorization.
- Mobile: fixed rails, room tabletop, card fan and reading panel must remain inside the viewport with safe-area padding; no nested dashboard treatment in the reading flow.
- Accessibility: keep labels, named regions, keyboard navigation, focus rings, reduced-motion behavior and hidden unrevealed card faces.

## Reading and sharing handoff

`ReadingPanel` owns the presentation of the stored v4.x reading: one direct-answer lead, personal insights, next steps, optional deeper reading, supporting prompts/evidence, follow-up suggestions and clarification draw. Save, Share and Close remain action callbacks owned by the room. Share links remain opaque and permission-checked; public-reading, export, QR and event analytics are not to be invented during this freeze.

## Credits, VIP and checkout handoff

Profile displays the account summary and active VIP state. The commercial API exposes active package versions and a member-scoped checkout that returns the SePay Sandbox form action. `/packages` is not a public page in this release. Profile currently labels payment setup as pending; this is an integration boundary, not a reason to redesign the Profile surface. Economic effects occur only after verified payment evidence and must remain idempotent.

## QA findings

- P0/P1: none observed in the available desktop staging pass.
- P2: Profile's service list still presents payment as “needs setup” while the staging-only API checkout is functional; coordinate product copy/UI work after provider/account provisioning.
- P2: Live AI and provider-backed SePay checkout/IPN remain external configuration gates; no real money or production provider activation is approved.
- P2: Affiliate verified-fulfillment conversion/reversal and staff-role mutation flows still need dedicated operator fixtures. Staging attribution, first-touch replay and USER-role admin denial are verified.
- P2: Fresh 375px/390px/1440px viewport checks found no horizontal overflow across key routes. Owner review should still exercise the completed 10-card room/reading state on a physical device before final UI sign-off.
- P3: Repository-wide lint retains inherited legacy/generated debt; do not use UI cleanup to broaden this integration.

## Closure evidence

The staging Share loop is now live-verified after the proxied-origin fix in `b1bf0f6`; the prior analytics-origin finding is closed. Share semantics, public privacy, QR/image output and owner-scoped revoke remain frozen for final UI work.
