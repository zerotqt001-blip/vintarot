# NaTarot Full Technical Audit

- **Audit date:** 2026-09-28
- **Audited source:** `f88dd6d1b297227d19df265b7068a0f398ddf3c0` (`codex/signup-trial-credit`)
- **Audit branch:** `codex/natarot-full-technical-audit`
**Last observed production release:** `natarot-signup-trial-f88dd6d-20260928T073600Z`, rollout reported successful at 2026-09-28 07:39:50 UTC. The active release was not rechecked at audit close.

## Summary

The largest verified frontend cost is three full-resolution PNG backgrounds used by Home, Create, Room, and the custom card back. Their sources total 9,125,428 bytes. This audit adds visually matched WebP derivatives totaling 1,629,140 bytes and uses CSS `image-set()` to prefer WebP while retaining each original PNG as the fallback. This preserves the existing images, brand, and page styling. A matched cold-load comparison is recorded below after both isolated builds passed asset checks.

Production's global stylesheet is also delivered without `Content-Encoding` in the captured response: the layout CSS transferred 625,375 bytes. A narrow static-asset gzip rule is a high-value operational follow-up, but the live TLS Nginx configuration is outside the app release and was not changed.

The audit did not deploy, alter the production database, perform payment/reading/customer workflows, or run VPS cleanup. Production changed from the initial `42e1603` observation to the `f88dd6d` release while read-only inspection was in progress. SSH, backup, database, and storage verification were stopped at that point. Public GET checks were safe to continue; `/api/health` returned `{"status":"ok"}` at 08:27 UTC.

## Scope and method

- Read `AGENTS.md`, `docs/PROJECT_STATE.md`, deployment/migration configuration, tests, runtime source, and project history.
- Created an isolated worktree on `codex/natarot-full-technical-audit`; no other worktree or branch was overwritten.
- Used the committed `f88dd6d` source as the reproducible baseline after observing the intervening production rollout. Baseline asset and source counts refer to that commit.
- Ran browser checks in an isolated temporary profile. The browser accepted only same-origin GET requests; non-GET, off-origin, reading/provider, payment, checkout, and SePay requests were blocked before send. No sign-in, reading, purchase, or admin mutation was performed.
- Kept capture JSON, rendered HTML, Lighthouse output, and server state under `/tmp/natarot-audit-20260928/` or other temporary directories, outside Git.
- Production CSS, image, Lighthouse, cache, and route artifacts are under `/tmp/natarot-audit-20260928/`. Local baseline and optimized Wrangler runs used separate source/build directories, ports 8798/8797, and separate temporary persistence paths.

## Architecture and inventory

The application uses React 19 and Next 16 APIs through Vinext/Vite, with a Worker-compatible runtime and a Node SQLite/D1 adapter. Drizzle defines the SQLite schema and checked-in migrations. The API surface contains 61 `app/api/**/route.ts` handlers plus the share-image route (62 handlers total). There are 21 `page.tsx` files.

The baseline tree contains 1,038 tracked entries. The reproducible text inventory counted 836 files and 159,562 physical lines, excluding `node_modules/`, `.next/`, `dist/`, `.wrangler/`, and `vendor/`; included text extensions were TS/JS variants, CSS/SCSS, SQL, Markdown, JSON/YAML/TOML, shell, HTML/XML, INI/conf/properties, and lock files. LOC is split below so product code is not conflated with docs or lockfiles.

| Category | Files | LOC |
|---|---:|---:|
| Runtime (`app/`, `components/`, `lib/`, `hooks/`) | 309 | 37,740 |
| Tests | 155 | 18,101 |
| Scripts | 19 | 2,448 |
| Styles | 5 | 2,932 |
| SQL/migrations | 17 | 1,824 |
| Config/manifests | 56 | 40,045 |
| Documentation | 160 | 21,828 |
| Project skill code | 9 | 15,294 |
| Project skill docs | 93 | 18,128 |
| Other code/tooling | 13 | 1,222 |
| **Total** | **836** | **159,562** |

Public image/font/vector assets are inventoried separately: 92 files / 20,018,066 bytes at baseline, comprising three PNGs (9,125,428 B), 78 WebPs (10,575,398 B), seven SVGs (6,156 B), and four WOFF2 files (311,084 B). The three large PNG backgrounds account for the PNG total. The audit adds three WebP derivatives; it removes no source assets or dependencies.

### Routing and maintenance findings

- `app/[section]/page.tsx` statically imports the ten-section client dispatcher in `app/pages.tsx` (1,158 lines). `app/room/room.tsx` and the Guidebook card page also import components from that dispatcher. No `next/dynamic`, `React.lazy`, or UI dynamic import was found. This is a bundle-splitting candidate; route-level emitted JS attribution was not measured, so no code was moved.
- `app/pages.tsx` is 56,900 bytes. `app/room/room.tsx` is 77,626 bytes / 315 lines. These are review candidates for future domain/component splits, not automatic deletion targets.
- `app/globals.css` is 2,647 lines / 506,071 source bytes and is imported by the root layout. Its source gzip estimate is 87,004 bytes. The emitted production layout CSS was 625,375 bytes on the wire in the captured response.
- Five early Home cosmic rules around `app/globals.css:446-451` are fully superseded by rules around `1648-1653`; those early declarations account for 2,226 source bytes. An earlier Reading Result background rule is also superseded later. This is a small, high-confidence cleanup candidate, but compressed-build savings are unmeasured and the rules were left intact pending focused visual review.
- No dependencies, components, or assets were removed: no candidate had both a verified zero-reference result and a safe behavior boundary.

## Frontend performance

### Production observations before the image change

Chrome 153 used a 390×844 mobile viewport at DPR 3. Lighthouse mobile used its simulated slow 4G profile; CDP waterfall runs used 4× CPU, 150 ms RTT, 1,474.56 kbps down / 675 kbps up, disabled cache, and same-origin GET only. Lighthouse captures were made shortly after the observed release rollout; the release pointer was not re-read over SSH at capture time.

| Route / run | Requests | Transferred bytes | FCP | LCP | CLS | Notes |
|---|---:|---:|---:|---:|---:|---|
| Home, production cold mobile CDP | 57 | 7,590,860 | — | — | — | Two scene PNGs: 5,881,454 B; CSS: 628,414 B; scripts: 904,864 B; fonts: 158,902 B. |
| Home, production warm mobile CDP | 57 | 23,087 | — | — | — | Resources were reused from cache; navigation still made 57 requests. |
| Home, Lighthouse mobile run 1 | 57 | 7,431 KiB | 9.5 s | 40.9 s | 0.004 | Performance score 0.56; LCP varied materially across repeat runs. |
| Home, Lighthouse mobile repeat | 57 | 7,431 KiB | 9.7 s | 24.5 s | 0.001 | Performance score 0.56; no field data available. |
| Home, Lighthouse desktop | 69 | 7,614 KiB | 2.0 s | 2.0 s | 0.002 | Performance score 0.80. |
| Create, Lighthouse mobile | 56 | 4,427 KiB | 10.9 s | 25.7 s | 0 | Performance score 0.56. |

In the production CDP waterfall, Home's 3,077,377 B cosmic-table PNG and 2,802,231 B observatory PNG completed at about 41.0 s and 39.6 s. They began only after the 625,375 B layout stylesheet finished around 8.2 s. Home's text heading was LCP at 8.36 s, before either background finished. On Create, the observatory PNG took 16.3 s; the `.create-scene-nebula` background became LCP at 24.75 s, 37 ms after that image completed at 24.72 s. The two backgrounds total 77.2% of the 7.61 MB Home cold-load transfer.

The captured production CSS response had no `Content-Encoding`. Local gzip/Brotli compression estimates are not production transfer measurements. Lighthouse TBT was 0 ms on these runs; lab INP and field Core Web Vitals were not available. These results indicate severe cold mobile transfer and image-delayed Create LCP, with run-to-run LCP variation. They do not establish production server CPU, memory, or backend latency.

### WebP optimization and matched local comparison

The three WebP derivatives were encoded with Sharp at quality 92 / effort 6, keeping the original source artwork and its CSS treatment. The default CSS remains PNG; browsers that support the typed WebP `image-set()` select WebP. The unit regression checks both file pairing and a size ceiling of 20% of its PNG source.

| Asset | Original PNG | WebP | Reduction |
|---|---:|---:|---:|
| Observatory | 2,801,931 B | 452,022 B | 83.9% |
| Cosmic table | 3,077,077 B | 558,812 B | 81.8% |
| Custom card back | 3,246,420 B | 618,306 B | 81.0% |
| **All three** | **9,125,428 B** | **1,629,140 B** | **82.1%** |

The matched cold comparison used separately built `f88dd6d` and optimized trees, with one isolated browser profile, identical network/CPU settings, storage cleared before each visit, and same-origin GET requests only. Before accepting timings, the test checked that each document's own CSS/JS assets returned HTTP 200 and that the expected visual app markers were present. All 43 observed `/_next/static/` requests returned successfully; no PNG fallback was requested by the optimized build. These local Wrangler transfers are not directly comparable to production totals above because Wrangler compresses assets locally while the captured production CSS response was unencoded.

| Route | Baseline → optimized transfer | Change | Baseline → optimized FCP | Baseline → optimized LCP |
|---|---:|---:|---:|---:|
| Home `/` | 6,446,471 → 1,578,485 B | −4,867,986 B (−75.51%) | 2,328 → 2,380 ms (+52 ms) | 2,328 → 2,380 ms (+52 ms), H1 on both |
| Create `/create` | 3,370,340 → 1,020,608 B | −2,349,732 B (−69.72%) | 2,240 → 2,412 ms (+172 ms) | 18,456 → 6,008 ms (−12,448 ms / −67.45%) |

The layout CSS transferred 103,455 B before and 103,575 B after; the second stylesheet transferred 1,223 B in both. On Home, the two PNG requests were 3,077,377 B and 2,802,231 B and completed at 34.765 s and 33.311 s. Their WebP requests were 559,112 B and 452,322 B and completed at 10.010 s and 9.439 s. Home's text LCP stayed near 2.3 s because it preceded background completion in both builds. On Create, the 2,802,231 B PNG completed at 18.402 s and the 452,322 B WebP completed at 5.948 s; the background LCP followed 54–60 ms later in each run.

This is a single matched cold run per route/build under the stated mobile throttle, not a statistical field result. JSON and screenshots are stored in `/tmp/natarot-audit-20260928/local-wrangler-ab-slow4g-verified.json` and `ab-{baseline,optimized}-{home,create}-mobile.png`.

The emitted CSS grew only by the three `image-set()` definitions; no additional page layout or color changes were made. No production deployment or post-change production RUM measurement was performed.

### Route and browser coverage

Read-only route checks rendered Home, Create, Room, Library (`/book`), Guidebook and a card detail. The Practice page's canonical route is `/community` (HTTP 200); `/practice` is not a route in this app and returns 404. Packages was inspected in the isolated in-app browser. `/account` and `/journal` displayed their signed-out gates; anonymous `/admin/users` returned the expected 404 boundary. Login was not submitted. No generated Reading Result or Public Share token was created or opened. Affiliate/admin authenticated workflows were not exercised without an authorized QA session.

## Backend, database, security, and operations

### Positive controls found in source and regression tests

- Member sessions use hashed opaque cookie tokens, current enabled-role checks, generic login failures, safe return paths, and reject spoofed identity headers.
- Google OAuth state and PKCE handling are covered. Public-share reads use bearer-token hashes, owner-scoped revocation, generic/non-enumerating failures, and privacy headers.
- Credit reservations and ledger fulfillment are idempotent; provider failure paths release reserved Credits. SePay IPN validates its shared secret, timestamp, amount, currency, and status; the browser return endpoint is display-only.
- Affiliate attribution and commissions are represented by an append-only ledger and verified-order boundary. SQLite startup enables foreign keys, WAL, and a 5-second busy timeout.
- The focused auth/RBAC/Credit/payment/OAuth/affiliate/share regression set passed 125/125 on the audit worktree.

### Findings and follow-up actions

| Priority | Finding | Evidence / impact | Action and recovery |
|---|---|---|---|
| P1 | Production static CSS/JS is not compressed. | Captured layout CSS response was 625,375 B with no `Content-Encoding`; bundled Nginx template has no gzip rule. Node zlib level-1 compression of the matching 625,075 B baseline layout CSS produced 141,746 B (77.3% smaller); this is an estimate, not a production response. | In a separately gated ops change, compress only hashed `/_next/static/` CSS/JS, preserve existing proxy identity-header clearing and TLS/HSTS, validate `nginx -t`, then verify `Content-Encoding`, `Vary`, bytes, and rollback. Avoid blanket compression of personalized HTML/API responses. Nginx documents response gzip and `gzip_vary` behavior in its [gzip module documentation](https://nginx.org/en/docs/http/ngx_http_gzip_module.html). |
| P2 | Session validation writes `last_seen_at` on each successful lookup and member reads include `SELECT *`. | `lib/member-auth.ts` updates `auth_sessions` per request and loads the full member row. This may increase SQLite write contention; production query/lock data was unavailable. | Measure read/write load and WAL wait/lock behavior first. If material, throttle last-seen writes while preserving expiry, revocation, and admin session semantics. Roll back the throttle if auth freshness or tests regress. |
| P2 | Expired/revoked member auth records have no cleanup path found in the member-auth module. | `auth_sessions`, `auth_tokens`, and `oauth_states` have expiry metadata/indexes, but static search found no corresponding deletion in `lib/member-auth.ts`; actual table growth is unknown. Google Drive OAuth states do have cleanup. | Read-only count/age and backup/restore checks on a stable release; then define retention and add a bounded migration-safe cleanup job. Do not delete records until audit, token, and session semantics are confirmed. |
| P2 | SePay request body limit is checked after buffering. | `handleSePayIpn` calls `request.text()` before adapter validation; the 100 KB parser cap therefore does not prevent the initial body allocation. Nginx body-size configuration was not inspected. | Confirm upstream body cap. Add streaming byte-limit enforcement before buffering if no proxy cap exists; test oversized and valid signed fixtures. |
| P2 | Auth throttling is held in a per-process `Map`. | `lib/auth-rate-limit.ts` has a bounded in-memory map; counters reset on process restart and are not shared across isolates. Current deployment topology and abuse telemetry were not revalidated. | Keep as a single-process control only; before multi-process/worker scaling, move the limiter to a shared edge/store and preserve current response semantics. |
| P2 | Admin user search uses leading-wildcard `LIKE`; global dashboard aggregates may scan larger tables. | Static SQL in `lib/admin/member-service.ts` and `lib/admin/read-model.ts`; impact depends on table size and indexes. | On a stable release, capture sanitized row counts, `EXPLAIN QUERY PLAN`, and query timings in read-only mode. Add only measured indexes with migration, rollback, and restore verification. |
| P2 | Route dispatcher couples multiple sections to one client module. | Static import graph around `app/[section]/page.tsx` / `app/pages.tsx`; no dynamic UI imports found. | Attribute emitted JS to routes first, then split the heaviest shared sections behind regression and visual checks. |
| P3 | Superseded duplicate CSS selectors remain. | Five old Home cosmic rules (2,226 source bytes) are overridden later; one Reading Result rule also repeats. | Remove only after Home/Reading visual snapshots and production bundle measurements establish no cascade dependency. |

No production query plan, database integrity/FK result, migration metadata, row counts, current database size, CPU/RAM measurement, Nginx TLS configuration, worker/service timer/log-rotation inspection, or backup restore was completed in this audit. Those require a stable deployment/operations gate. No AI-provider request was made, so backend latency and AI-vs-app latency are unavailable.

The initial read-only server snapshot (before the release changed) showed the service active, health OK, disk at 31% with about 20 GB free, and roughly 5.3 MB in the backup root. That did not establish archive integrity or restore readiness. A later public `/api/health` GET returned HTTP 200 with `{"status":"ok"}` at 08:27 UTC. No cleanup ran; unclassified and quarantine paths remain untouched.

## Validation

| Check | Result |
|---|---|
| `npm run install:ci` | Passed before and after the PostCSS dependency fix with Node v22.23.1 / npm 10.9.8. Baseline lockfile SHA-256: `686b1dda624710e382cb435a2e7a679881043ff0e17ab9f412a2cf96b883a191`; final lockfile SHA-256: `68daec289144c47e167f504cbec403536e35bcf33c9dac717957652eb585d6a8`. The CSS regression's PostCSS parser is declared directly in `devDependencies` at locked version 8.5.23. |
| Baseline `npx tsx --test tests/*.test.ts` at `f88dd6d` | 766 total; 761 passed, 5 failed. Four failures were a Node child-process test-harness CSS-module import issue; one existing 342 px `row-3` spread-geometry assertion failed. |
| Final `npx tsx --test tests/*.test.ts` | 767 total; 766 passed, 1 failed. The CSS-loading shim makes the four baseline harness tests pass. The same `row-3` geometry assertion remains and was not changed in this audit. |
| Focused auth/RBAC/Credit/payment/OAuth/affiliate/share tests | 125/125 passed. |
| `npx tsc --noEmit` | Passed. |
| `npm run build` | Passed. |
| Targeted ESLint on changed test files | Passed. |
| Code review | Read-only review found only the undeclared test-only PostCSS dependency; it is now declared at `8.5.23`, and the reviewer confirmed the follow-up diff resolves the issue. |
| Full `npm run lint` | 216 findings: 76 errors / 140 warnings, unchanged from baseline. |
| `git diff --check` | Passed. |

The full lint findings are pre-existing and broader cleanup was not mixed into this audit. The one remaining full-suite failure is an inherited spread-geometry boundary issue at 342 px; an adjacent active workstream owns that area, so this audit did not alter it.

## Prioritized backlog and release gates

1. **P1, frontend:** ship the WebP derivative/CSS change only with a stable production lock, fresh verified backup, restore readiness, deployment health check, and post-release route/performance verification.
2. **P1, operations:** apply and measure narrowly scoped Nginx gzip for hashed CSS/JS; preserve the actual TLS/HSTS and identity-header rules.
3. **P2, reliability:** resume read-only production DB and VPS inspection only after release state is confirmed stable. Record FK/integrity, migrations, indexes/query plans, DB growth, CPU/RAM/disk, timers, log rotation, backup schedule/checksum/restore-test state, deployment lock, and release retention.
4. **P2, backend:** measure session-write contention, auth-record retention, body-size enforcement, and admin/report query plans before changing database paths.
5. **P2, frontend:** measure route-attributed JS, render/memory costs, and route transitions; then consider splitting the shared client dispatcher.
6. **P3, maintenance:** verify and remove superseded CSS and investigate unused dependencies/assets with runtime, route, test, worker, and packaging references.
7. **Validation:** after stable release and authorized QA access, exercise registration/login/OAuth, Credits, synthetic payment fixtures, reading and history, sharing, Save Image, affiliate attribution, and admin boundaries. Do not use real money or production customer mutations.

### Final audit scoreboard

| Requested item | Audit result |
|---|---|
| Production baseline | `f88dd6d` was the last release observed active during the audit; current active release at close is unknown. |
| Final source commit | `cbaaf7c075fef9b958282f6675fa3a650b3273ab` (`test: declare PostCSS parser dependency`), following image optimization commit `dd388bd141e3dc21080e7b0fb9afc50472758ff0`. |
| Final production release | None created by this audit. |
| Total LOC before / after | Baseline: 159,562 physical lines / 836 text files; final audit worktree: 159,916 lines / 839 text files (+354 lines). The after count includes the audit report, plan, new regression test, and direct dependency declarations; no business logic or API code was changed. |
| Duplicate code removed | 0; cleanup candidates remain in backlog. |
| Unused dependencies/assets removed | 0; no deletion was justified. |
| Frontend performance before/after | Production baseline and matched local image-change results are in the tables above; no post-change production measurement. |
| Backend latency before/after | Not measured; no provider/API mutation requests were initiated. |
| Database performance before/after | Not measured; production DB inspection stopped after release changed. |
| Full regression | 766/767 final tests pass; one inherited geometry assertion fails. |
| Security regression | 125 focused tests pass; static boundary review documented above. |
| Browser QA | Read-only routes, no-auth gates, and cold/warm/lab performance checks only; privileged and paid journeys not exercised. |
| Production health | Public `/api/health` was HTTP 200 at 08:27 UTC; current release pointer not rechecked. |
| Backup restore / VPS storage guard | Not checked in this audit; no restore or cleanup performed. |
