# NaTarot Test Matrix

This matrix is dependency-driven. It names the current automated evidence without implying that every product claim has coverage. The repository contains 62 `tests/*.test.ts` files using Node's `node:test`; `package.json` has no dedicated `test` script, so the suite is executed through `tsx`.

## Standard commands

```sh
npx tsx --test tests/*.test.ts
npx tsc --noEmit
npm run build
npm run lint
git diff --check
```

The tracked project state records existing lint failures in generated/runtime and legacy anchor rules. A future run must still execute lint when relevant and distinguish baseline failures from regressions. Build/typecheck/test commands are the minimum verification for a cross-cutting mission when the local environment permits.

## Matrix

| Group | Purpose | Affected features | When required | Existing automated tests | Missing or limited coverage |
| --- | --- | --- | --- | --- | --- |
| SMOKE | Prove the repository can typecheck, build, and maintain a clean diff | All changed zones | Every completed mission that changes tracked files | `npx tsc --noEmit`, `npm run build`, `git diff --check` | Does not prove live topology, browser behavior, provider availability, or production data safety. |
| CRITICAL FLOW | Exercise the core create → room → draw → reading → result path | Create, Room, catalog, draw, AI, ReadingPanel | Any change to Room, Tarot APIs, AI input/output, or reading UI | `tarot-catalog`, `tarot-draw`, `tarot-reading-route`, `tarot-reading-service`, `tarot-reading-context`, `tarot-room`, `tarot-reading-ui`, `tarot-api-contract` | No single repository test appears to drive the whole browser flow with a live configured provider. |
| REGRESSION | Protect shared UI, navigation, motion, and persisted behaviors | Home, Guidebook, Create, Room, Journal, i18n | Any shared shell, global CSS, route, or component change | `brand-*`, `home-*`, `create-*`, `guidebook*`, `navigation-guidebook`, `mobile-navigation`, `room-*`, `saved-reading-*`, `i18n`, `language-default` | Browser exact-viewport and physical-device checks remain partly manual; do not infer them from unit tests. |
| SECURITY | Protect identity, owner matching, origin, cookie, and public/private boundaries | Auth, guest mode, records, rooms, Tarot sessions, saved readings | Any auth, API, proxy, cookie, ownership, or persistence change | `f001-identity-boundary`, `request-identity`, `server-origin`, `tarot-guest`, `room-guest-persistence`, `tarot-saved-reading-route` | Guest bearer-cookie threat model and missing-Origin behavior need a dedicated security mission; this bootstrap does not change them. |
| RESPONSIVE | Detect layout, overflow, focus, touch, pointer, zoom, and reduced-motion regressions | Shared shell, Home, Create, Room, reading panel | Any CSS/layout/motion/accessibility change | `home-mobile-polish`, `home-celestial-theme`, `mobile-navigation`, `room-mobile`, `room-mobile-first-screen`, `room-gestures`, `room-motion`, `room-backdrop`, `room-celestial-theme`, `tarot-reading-ui` | Physical iOS Safari and full device matrix are not represented by repository tests. |
| DATA | Protect schema, migrations, seed content, SQLite/D1 compatibility, ownership, and legacy rows | DB, catalog, sessions, readings, saved readings | Any schema, repository, seed, migration, data contract, or persistence change | `node-migrate`, `tarot-migration`, `tarot-seed`, `sqlite-d1`, `tarot-repository`, `tarot-reading-compat` coverage through saved/reading tests | No production migration is run by tests; backup/rollback must be reviewed separately. |
| AI CONTRACT | Protect prompt inputs, provider envelopes, parser semantics, output cardinality, and legacy compatibility | AI reading, follow-up, reading results, saved readings | Any provider, prompt, knowledge base, parser, output field, or reading UI contract change | `tarot-ai`, `tarot-interpretation`, `tarot-reading-context`, `tarot-reading-service`, `tarot-reading-route`, `tarot-follow-up`, `tarot-follow-up-route`, `tarot-reading-ui`, `tarot-api-contract` | Real provider latency, quota, model drift, and production credentials require a separate controlled smoke test. |
| DEPLOYMENT | Protect build artifact, bindings, runtime, forwarded headers, service, and release topology | Cloudflare/Sites and VPS | Any build script, hosting config, Nginx, systemd, environment strategy, or release change | `deployment-contract`, typecheck, build, secret scan, topology smoke tests when authorized | Live production is not proven by local build; deployment/restart requires explicit mission scope. |

## Focused test selection by zone

### Identity or API boundary

Run identity/origin tests, the directly affected route tests, Tarot guest or saved-reading tests if ownership is involved, then the full suite, typecheck, and build.

### Tarot catalog, draw, or spread

Run catalog, draw, seed, migration, repository, Room state, and API contract tests. If any persisted shape changes, include all data and compatibility groups.

### AI engine or reading presentation

Run provider, prompt/interpretation, context, service, route, follow-up, compatibility, saved-reading, and reading UI tests. A UI-only change must not silently skip contract tests if it reads structured fields.

### Shared shell, CSS, i18n, or navigation

Run the affected route contracts, brand tests, i18n/language/navigation tests, responsive/motion tests, then the full suite. Browser QA is required for layout/gesture claims.

### Deployment or production readiness

Run deployment contract tests, typecheck, build, `git diff --check`, secret scan, and authorized environment smoke checks. Never treat a local build as proof that an existing production revision is still active.

## Coverage honesty rules

- “Existing test” means the named file contains an assertion that exercises the behavior, not merely an import or snapshot.
- A route test does not replace ownership, browser, migration, provider, or live deployment evidence.
- A passing typecheck does not prove runtime data, credentials, CSS layout, AI quality, or production readiness.
- When a baseline command fails before the mission, record the exact failure and keep the application unchanged unless the mission explicitly unlocks that defect.
