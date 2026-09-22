# Dynamic Reading Result Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current narrow interpretation pane with an immersive, full-screen NaTarot Reading Result view driven by one reusable responsive spread geometry system.

**Architecture:** Extract the canonical spread mapping from lib/room-motion.ts into a shared geometry and projection module. Add one ReadingSpread component that renders ordered reading evidence in canonical geometry when readable and in a deterministic semantic sequence when it is not. Keep the existing ReadingPanel data flow, Room API calls, AI payloads, persistence, follow-up, save, close, and retry behavior unchanged.

**Tech Stack:** React 19, TypeScript 5.9, Vinext/Vite, CSS in app/globals.css, Node node:test, existing NaTarot fonts/assets, Wrangler local preview, CUA browser verification, VPS Node/Vinext release.

**Spec:** docs/superpowers/specs/2026-09-23-reading-result-dynamic-design.md

## Global Constraints

- The four-card reference is visual direction only; never encode a fixed four-card result layout.
- Preserve the current catalog’s card counts, position order, localized labels, meanings, prompts, orientation, AI payload, ownership, i18n, follow-up, save, history, and existing sharing features.
- Use one reusable spread renderer; do not create Spread3, Spread4, Spread5, Spread7, or Spread10 components.
- Reuse the current canonical relationships for single, row-2, row-3, row-4, row-5, triangle, top-1-bottom-3, cross-4, yes-no, and celtic-cross.
- Support one, three, four, five, seven, and ten-card fixtures, plus every production spread present in lib/tarot-catalog.ts.
- Keep reversed artwork rotated while position labels and interpretation copy remain upright and readable.
- Do not change DeepSeek, Knowledge Base, prompt, provider, database, auth, ownership, route, or migration semantics.
- Do not add unsupported Share Image or QR infrastructure; preserve any existing implementation and report any absent capability accurately.
- Do not deploy a checkout that could roll back newer production work. Determine the actual production revision and integrate semantically before release.
- Before VPS deployment, create and verify a fresh backup, keep the current release and two previous successful releases when the installed retention mechanism supports it, and never print secrets or database contents.
- Before any completion claim, run the relevant fresh tests, typecheck, build, browser checks, diff check, and deployment smoke checks and report their actual exit status.

---

## File and responsibility map

- Create lib/spread-geometry.ts: canonical layout points, normalized bounds, responsive projection, deterministic fallback, and compatibility types.
- Modify lib/room-motion.ts: delegate existing Room layout calls to the shared geometry module and preserve current Room-facing pixel positions.
- Create tests/spread-geometry.test.ts: pure geometry/projection tests for all canonical types, representative counts, fallback, bounds, and orientation-independent order.
- Create components/reading/reading-spread.tsx: measured responsive canvas, ordered evidence rendering, accessible labels, artwork/orientation treatment, and semantic mobile fallback.
- Modify components/reading/reading-types.ts: add active spread metadata and spread-stage props without changing normalized reading payload types.
- Modify components/reading/reading-panel.tsx and components/reading/reading-header.tsx: mount the stage and expose real spread name/count metadata.
- Create tests/reading-spread.test.ts: helper/component contract tests for order, labels, orientation, missing artwork, and projection-mode wiring.
- Modify app/room/room.tsx: pass the active catalog template’s name, spreadType, and card count into ReadingPanel.
- Modify app/globals.css: immersive result shell, spread canvas/card styling, responsive layout, celestial surfaces, focus states, and reduced-motion rules.
- Modify tests/tarot-reading-ui.test.ts and/or create tests/reading-result-shell.test.ts: preserve hierarchy and assert full-screen/result-stage wiring without brittle screenshot-specific card counts.
- Modify docs/PROJECT_STATE.md: record implementation, validation, deployment, rollback, and unfinished QA truth at the end.

## Task 0: Establish the isolated baseline and release comparison

**Files:**
- Read: docs/PROJECT_STATE.md, docs/project/LOCKED_ZONES.md, docs/project/TEST_MATRIX.md, docs/superpowers/specs/2026-09-23-reading-result-dynamic-design.md
- Modify: none

**Interfaces:**
- Consumes: current worktree branch, repository remotes, current production release metadata.
- Produces: a recorded baseline test result, current production commit/release identity, and a clean implementation starting point.

- [ ] **Step 1: Install the locked dependency graph in the isolated worktree.**

  Run:

  ~~~bash
  npm run install:ci
  node --version
  npm --version
  ~~~

  Expected: Node satisfies >=22.13.0; the shared lockfile installs without changing application source.

- [ ] **Step 2: Record repository and remote state without changing user-owned work.**

  Run:

  ~~~bash
  git status --short --branch
  git log -1 --oneline
  git remote -v
  git fetch --all --prune
  git branch -a --contains HEAD
  git log --oneline --decorate -12
  ~~~

  Expected: implementation branch is codex/reading-result-dynamic; any divergence from remote is recorded before edits.

- [ ] **Step 3: Establish the baseline test/build evidence.**

  Run:

  ~~~bash
  npx tsx --test tests/*.test.ts
  npx tsc --noEmit
  npm run build
  git diff --check
  ~~~

  Expected: capture exact pass/fail counts and distinguish pre-existing failures from changes made in this branch. Do not modify unrelated failing tests.

- [ ] **Step 4: Determine the current production revision before implementation is released.**

  Run read-only source checks:

  ~~~bash
  rg -n "natarot\.service|/opt/natarot|previous-|build ID|source commit|42\.96\.5\.114|26266" docs deploy scripts
  git ls-remote --heads origin
  ~~~

  If SSH access is available, run without printing environments, secrets, or database contents:

  ~~~bash
  ssh -p 26266 42.96.5.114 'systemctl is-active natarot.service; systemctl show natarot.service -p ExecStart -p WorkingDirectory --no-pager; readlink -f /opt/natarot; git -C /opt/natarot rev-parse --short HEAD 2>/dev/null || true; ls -ld /opt/natarot /opt/natarot.previous-* 2>/dev/null | tail -n 8'
  ~~~

  Expected: actual active release identity is written into the execution notes; if unavailable, deployment remains blocked until a safe comparison is possible.

- [ ] **Step 5: Commit only the approved plan if baseline setup created no source changes.**

  ~~~bash
  git status --short
  git diff --check
  git add docs/superpowers/plans/2026-09-23-reading-result-dynamic.md
  git diff --cached --stat
  git commit -m "docs: plan dynamic reading result implementation"
  ~~~

## Task 1: Extract and verify the shared spread geometry contract

**Files:**
- Create: lib/spread-geometry.ts
- Modify: lib/room-motion.ts
- Create: tests/spread-geometry.test.ts
- Modify: tests/spread-layout.test.ts only when an existing assertion must follow the extracted API

**Interfaces:**
- Consumes: spreadType and ordered { key, order } position values from lib/tarot-catalog.ts and Room.
- Produces:

  ~~~ts
  export type SpreadPositionInput = { key: string; order: number };
  export type SpreadGeometryPoint = {
    key: string;
    order: number;
    x: number;
    y: number;
    normalizedX: number;
    normalizedY: number;
    scale: number;
    rotation: number;
    row: number;
  };
  export type SpreadGeometry = {
    spreadType: string;
    canonical: boolean;
    points: SpreadGeometryPoint[];
    bounds: { left: number; top: number; right: number; bottom: number };
  };
  export type SpreadProjectionOptions = {
    width: number;
    height: number;
    cardAspectRatio: number;
    minCardWidth: number;
    maxCardWidth: number;
    mobile: boolean;
  };
  export type SpreadProjectionCard = {
    key: string;
    order: number;
    left: number;
    top: number;
    width: number;
    height: number;
    rotation: number;
  };
  export type SpreadProjection = {
    mode: "geometry" | "ordered";
    width: number;
    height: number;
    cards: SpreadProjectionCard[];
  };
  export function resolveSpreadGeometry(
    spreadType: string | undefined,
    positions: readonly SpreadPositionInput[],
  ): SpreadGeometry;
  export function projectSpreadGeometry(
    geometry: SpreadGeometry,
    options: SpreadProjectionOptions,
  ): SpreadProjection;
  ~~~

- [ ] **Step 1: Write the failing geometry tests.**

  Add tests with real position keys from the catalog:

  ~~~ts
  test("preserves the canonical four-card row order and spacing", () => {
    const geometry = resolveSpreadGeometry("row-4", positions("gift", "magic", "yearning", "beacon"));
    assert.equal(geometry.canonical, true);
    assert.deepEqual(geometry.points.map((point) => point.key), ["gift", "magic", "yearning", "beacon"]);
    assert.ok(geometry.points[0].normalizedX < geometry.points[1].normalizedX);
    assert.ok(geometry.points[1].normalizedX < geometry.points[2].normalizedX);
    assert.ok(geometry.points[2].normalizedX < geometry.points[3].normalizedX);
  });

  test("keeps every Celtic Cross point unique, including the crossing card rotation", () => {
    const geometry = resolveSpreadGeometry("celtic-cross", positions(...Array.from({ length: 10 }, (_, index) => "position-" + index)));
    assert.equal(geometry.points.length, 10);
    assert.equal(new Set(geometry.points.map((point) => `${point.normalizedX}:${point.normalizedY}`)).size, 10);
    assert.equal(geometry.points[1].rotation, 90);
  });

  test("falls back deterministically for an unknown seven-card geometry", () => {
    const positions7 = positions("one", "two", "three", "four", "five", "six", "seven");
    const first = resolveSpreadGeometry("future-layout", positions7);
    const second = resolveSpreadGeometry("future-layout", positions7);
    assert.equal(first.canonical, false);
    assert.deepEqual(first.points, second.points);
    assert.equal(first.points.length, 7);
  });
  ~~~

- [ ] **Step 2: Run the focused tests and verify the expected RED failure.**

  ~~~bash
  npx tsx --test tests/spread-geometry.test.ts tests/spread-layout.test.ts
  ~~~

  Expected: failure because lib/spread-geometry.ts and the exported functions do not exist yet; fix only test typos if the failure is an import/setup error.

- [ ] **Step 3: Implement the canonical point tables and normalization.**

  Move the existing switch data from resolveSpreadLayout into lib/spread-geometry.ts. Keep the exact existing semantic keys, pixel offsets, scale, and rotation. Normalize each resolved point against its calculated bounds, preserve the point’s scale and rotation, sort by order, and use an order-based deterministic layout for unknown types. Never branch on a fixed card count except inside named canonical geometry rules already represented by a spread type.

- [ ] **Step 4: Implement the responsive projection.**

  Calculate card width from the available width and normalized horizontal span, cap it between minCardWidth and maxCardWidth, derive height using cardAspectRatio, and center the projected bounds in the canvas. If the projected minimum card width would be below the readable threshold or the geometry would exceed the mobile height, return mode: "ordered" and place cards in position order with no overlap. For desktop/tablet geometry mode, preserve normalized relative positions and rotation. Clamp only the outer placement to the canvas; do not silently reorder or drop cards.

- [ ] **Step 5: Delegate Room geometry to the shared module.**

  Replace the layout-specific switch body in lib/room-motion.ts with a call to resolveSpreadGeometry. Adapt SpreadGeometryPoint.x/y/scale/rotation back to the existing SpreadLayoutPosition shape used by the tabletop and spread picker, retaining the current pixel coordinate scale and fallback return values. Keep spreadCardPosition, spreadCardPose, pan, pinch, and fan helpers unchanged.

- [ ] **Step 6: Run the focused tests and compatibility checks.**

  ~~~bash
  npx tsx --test tests/spread-geometry.test.ts tests/spread-layout.test.ts tests/room-gestures.test.ts tests/room-mobile.test.ts
  npx tsc --noEmit
  ~~~

  Expected: all focused geometry/Room tests pass and the Room helper signatures remain compatible.

- [ ] **Step 7: Commit the shared geometry milestone.**

  ~~~bash
  git diff --check
  git add lib/spread-geometry.ts lib/room-motion.ts tests/spread-geometry.test.ts tests/spread-layout.test.ts
  git diff --cached --stat
  git commit -m "feat: share responsive spread geometry"
  ~~~

## Task 2: Add the reusable Reading Result spread stage

**Files:**
- Create: components/reading/reading-spread.tsx
- Create: tests/reading-spread.test.ts

**Interfaces:**
- Consumes: ReadingEvidence, ReadingArtwork, TarotLocale, ReadingTranslator, spreadType from reading-types.ts, resolveSpreadGeometry, and projectSpreadGeometry.
- Produces:

  ~~~ts
  export type ReadingSpreadProps = {
    items: ReadingEvidence[];
    artwork: Record<string, ReadingArtwork>;
    locale: TarotLocale;
    spreadType?: string;
    t: ReadingTranslator;
  };
  export function orderReadingEvidence(items: readonly ReadingEvidence[]): ReadingEvidence[];
  export function ReadingSpread(props: ReadingSpreadProps): JSX.Element;
  ~~~

- [ ] **Step 1: Write failing helper and source-contract tests.**

  Assert that orderReadingEvidence returns a new array sorted by position.order, that the component includes data-position-key, data-orientation, the actual position label, a reversed artwork class, a missing-artwork placeholder, and a ResizeObserver-backed measurement path. Also assert that the source calls resolveSpreadGeometry and projectSpreadGeometry rather than declaring separate count-specific components.

- [ ] **Step 2: Run the focused test and verify RED.**

  ~~~bash
  npx tsx --test tests/reading-spread.test.ts
  ~~~

  Expected: failure because the component and helper do not exist.

- [ ] **Step 3: Implement ordered evidence and measured canvas.**

  Sort evidence once by position.order, preserve the original readingCardId, and measure the canvas with ResizeObserver when available. Use an SSR-safe initial size so the first render is deterministic. Compute geometry with resolveSpreadGeometry(spreadType, items.map(({ position }) => ({ key: position.key, order: position.order }))) and project it with the measured size, a 400 / 647 card aspect ratio, a desktop minimum/maximum width, and a mobile readability threshold.

- [ ] **Step 4: Implement accessible card rendering.**

  Render cards in sorted DOM order. For each item, render the actual artwork or a labeled placeholder, the localized card name from locale, actual position label, orientation label via t, and the short position.meaning. Use an accessible label such as position.name + cardName + orientationLabel. Apply the reversed transform only to the artwork wrapper; keep the position copy outside that transform. Include data-reading-card-id, data-position-key, and data-orientation for QA.

- [ ] **Step 5: Implement geometry and ordered visual modes.**

  In geometry mode, place cards using the pure projection’s left, top, width, height, and rotation values. In ordered mode, render a vertical/compact grid with the same DOM order and no absolute overlap. Keep the card stage’s height at least the projection height and allow the parent reading scroll surface to grow.

- [ ] **Step 6: Run the focused tests and typecheck.**

  ~~~bash
  npx tsx --test tests/reading-spread.test.ts tests/spread-geometry.test.ts
  npx tsc --noEmit
  ~~~

  Expected: helper/component contracts pass and the component typechecks without adding a new dependency.

- [ ] **Step 7: Commit the spread-stage milestone.**

  ~~~bash
  git diff --check
  git add components/reading/reading-spread.tsx tests/reading-spread.test.ts
  git diff --cached --stat
  git commit -m "feat: add dynamic reading spread stage"
  ~~~

## Task 3: Wire real Room metadata and build the immersive Reading Result surface

**Files:**
- Modify: components/reading/reading-types.ts
- Modify: components/reading/reading-panel.tsx
- Modify: components/reading/reading-header.tsx
- Modify: app/room/room.tsx
- Modify: lib/i18n.ts
- Modify: app/globals.css
- Modify: tests/tarot-reading-ui.test.ts
- Create: tests/reading-result-shell.test.ts if the existing UI test file becomes too broad

**Interfaces:**
- Consumes: ReadingSpread from Task 2, ReadingPanelProps, active TarotCatalogTemplate, existing NaTarot tokens and Room shell classes.
- Produces: a full-screen result surface under the existing Room header with real question/spread/deck/card metadata and unchanged reading actions.

- [ ] **Step 1: Write failing wiring and shell tests.**

  Add assertions that ReadingPanel mounts ReadingSpread only for non-empty reading.cardEvidence, passes session.spreadType, passes artworkByReadingCardId, and keeps TarotEvidence after the existing reading sections. Assert that room.tsx passes activeTemplate?.spreadType, activeTemplate?.name, and s.spread.length, and that CSS includes a full-screen shell, a spread stage, a mobile ordered mode, and reduced-motion rules. Keep existing assertions for save, close, follow-up, loading, error, and hierarchy.

- [ ] **Step 2: Run focused UI tests and verify RED.**

  ~~~bash
  npx tsx --test tests/tarot-reading-ui.test.ts tests/reading-result-shell.test.ts tests/tarot-room.test.ts
  ~~~

  Expected: failures for the missing spread mount, metadata fields, and immersive shell markers.

- [ ] **Step 3: Extend the reading metadata types and header.**

  Add optional spreadType?: string and cardCount?: number to ReadingSessionMetadata. Keep spreadName as the actual catalog template name. Add bilingual reading.cardCount translation strings and render the count alongside the existing actual spread/deck metadata; do not reconstruct labels or invent time/topic data.

- [ ] **Step 4: Mount the visual stage without changing payload order.**

  In ReadingPanel, render ReadingSpread immediately after ReadingHeader and before DirectAnswer only when reading.cardEvidence.length > 0. Pass the exact normalized cardEvidence, artwork map, locale, session.spreadType, and translator. Keep the existing direct answer → deeper reading → personal insights → next steps → reflection → collapsed evidence → follow-up order unchanged.

- [ ] **Step 5: Pass active catalog metadata from Room.**

  Change readingSession to use activeTemplate?.name || null, activeTemplate?.spreadType, and s.spread.length. Keep question, reader name, deck, interpretation request, save, retry, follow-up, and epoch reset behavior unchanged. Do not add a new API call or alter the reading payload.

- [ ] **Step 6: Implement the full-screen visual shell and spread styling.**

  Update the final reading-shell CSS block so .room-reading-panel-shell spans the available viewport beneath the existing Room header, owns the scroll surface, uses the existing celestial Room backdrop/tokens, and hides or disables the tabletop only while interpretation is open. Add styles for .reading-spread, .reading-spread__canvas, .reading-spread__card, position labels, orientation labels, placeholders, geometry mode, ordered mode, and the metadata row. Keep action footer safe-area padding, 44px controls, keyboard focus rings, and prefers-reduced-motion: reduce overrides. Use responsive rules for 375px, 390px, 412px, tablet, and desktop; never add fixed four-card selectors.

- [ ] **Step 7: Run focused UI tests, typecheck, and a production build.**

  ~~~bash
  npx tsx --test tests/tarot-reading-ui.test.ts tests/reading-result-shell.test.ts tests/tarot-room.test.ts tests/room-mobile.test.ts
  npx tsc --noEmit
  npm run build
  ~~~

  Expected: the result view preserves existing reading interactions and the build emits a deployable artifact.

- [ ] **Step 8: Commit the immersive result milestone.**

  ~~~bash
  git diff --check
  git add components/reading/reading-types.ts components/reading/reading-panel.tsx components/reading/reading-header.tsx app/room/room.tsx lib/i18n.ts app/globals.css tests/tarot-reading-ui.test.ts tests/reading-result-shell.test.ts
  git diff --cached --stat
  git commit -m "feat: redesign immersive reading result"
  ~~~

## Task 4: Run local functional and visual QA, then fix defects in bounded rounds

**Files:**
- Modify: only files implicated by a failing test or screenshot defect from Tasks 1–3
- Add/modify: focused regression tests for every defect before its fix

**Interfaces:**
- Consumes: completed local Reading Result UI and existing real catalog/draw/reading flow.
- Produces: verified desktop/mobile screenshots, regression coverage, and a clean local release candidate.

- [ ] **Step 1: Start the real production preview from a fresh build.**

  ~~~bash
  npm run build
  npm start -- --port 5187
  ~~~

  Use the actual preview URL printed by Wrangler. Do not use mock screenshot data in the application.

- [ ] **Step 2: Exercise a real guest flow and capture required viewports.**

  Through the browser, navigate to /room?ritual=1, choose production catalog spreads, draw cards with mixed upright/reversed states, open the real interpretation when the configured provider is available, and capture at least 1280px desktop, 375px, 390px, and 412px. For deterministic visual fixtures, use the existing catalog contracts or a non-persisting test fixture; never replace runtime payloads.

- [ ] **Step 3: Verify the spread matrix.**

  Inspect 1-card, 3-card, 4-card, 5-card, 7-card, and 10-card fixtures plus Celtic Cross, triangle, yes/no, and top/bottom geometry. For each viewport verify all cards visible, DOM order, position labels, meanings, orientation, no unintended overlap, no clipping, readable text, balanced composition, and document.documentElement.scrollWidth === document.documentElement.clientWidth.

- [ ] **Step 4: Verify preserved product behavior.**

  Exercise existing follow-up submission, clarification/reflection prompt selection, save reading, close/reopen behavior, history/journal path, locale switch, ownership boundary, Home navigation, and any existing Share Link/QR/Save Image controls. If a named capability is absent in this checkout, record it as absent rather than implementing unrelated infrastructure.

- [ ] **Step 5: Perform one bounded screenshot defect round.**

  Group screenshot findings by geometry, typography/spacing, overflow, interaction, and accessibility. Write a failing regression assertion for each functional defect, patch the smallest relevant file, then rerun affected tests and recapture desktop/mobile screenshots.

- [ ] **Step 6: Run local release gates.**

  ~~~bash
  npx tsx --test tests/*.test.ts
  npx tsc --noEmit
  npm run build
  npx eslint lib/spread-geometry.ts lib/room-motion.ts components/reading/reading-spread.tsx components/reading/reading-types.ts components/reading/reading-panel.tsx components/reading/reading-header.tsx app/room/room.tsx tests/spread-geometry.test.ts tests/reading-spread.test.ts tests/reading-result-shell.test.ts tests/tarot-reading-ui.test.ts
  git diff --check
  ~~~

  Expected: report exact full-suite counts, any known baseline failures, typecheck/build exit status, changed-file lint result, and diff-check result.

- [ ] **Step 7: Commit verified local QA fixes.**

  ~~~bash
  git status --short
  git diff --check
  git add app/globals.css app/room/room.tsx components/reading lib/room-motion.ts lib/spread-geometry.ts lib/i18n.ts tests/spread-geometry.test.ts tests/reading-spread.test.ts tests/reading-result-shell.test.ts tests/tarot-reading-ui.test.ts
  git diff --cached --stat
  git commit -m "fix: polish responsive reading result QA"
  ~~~

## Task 5: Integrate safely with the latest production baseline and deploy

**Files:**
- Modify: docs/PROJECT_STATE.md
- Read/operate: VPS release directories, systemd service, backup/restore tooling, Nginx, public HTTPS site
- Do not modify: /etc/natarot.env, provider secrets, database schema, database contents, auth, or unrelated production files

**Interfaces:**
- Consumes: verified branch/build from Task 4 and the actual production revision recorded in Task 0.
- Produces: pushed branch, fresh backup evidence, deployed release, rollback inventory, public browser QA evidence, and accurate project state.

- [ ] **Step 1: Reconcile against the latest production source and remote refs.**

  Run:

  ~~~bash
  git fetch --all --prune
  git status --short --branch
  git log --oneline --decorate --all -20
  git diff --stat PRODUCTION_REF...HEAD
  git diff --name-status PRODUCTION_REF...HEAD
  ~~~

  Set PRODUCTION_REF to the exact source commit or release ref recorded in Task 0 before running these commands.

  If newer approved Home, Header, Sidebar, Footer, Practice, Packages, Affiliate, or global CSS work is present in the production source, integrate it by preserving its semantics before the final verification cycle. Re-run Task 4 after any integration.

- [ ] **Step 2: Inspect the release/backup mechanism and create a fresh database backup.**

  Read-only inventory:

  ~~~bash
  ssh -p 26266 42.96.5.114 'systemctl list-timers --all | grep -E "natarot-(backup|restore)" || true; systemctl cat natarot-backup.timer natarot-restore-test.timer 2>/dev/null || true; ls -ld /opt/natarot /opt/natarot.previous-* /var/backups/natarot 2>/dev/null | tail -n 12'
  ~~~

  Use the installed canonical backup command discovered from the timer/service definition. Verify the fresh archive exists, has restrictive permissions, has a checksum, and passes the installed restore-test/integrity check. Never print the SQLite file, environment, credential values, or user rows.

- [ ] **Step 3: Push the verified branch and record the remote result.**

  ~~~bash
  git diff --check
  git status --short
  git push -u origin codex/reading-result-dynamic
  git rev-parse HEAD
  ~~~

  Expected: push succeeds and the exact remote branch/commit are recorded. If push fails, report the failure and do not treat the local commit as a remote backup.

- [ ] **Step 4: Build and secret-scan the deployable artifact.**

  ~~~bash
  npm run build
  git diff --check
  find dist -maxdepth 5 -type f -print | sort | sed -n '1,240p'
  rg -n -i --glob '!*.map' '(api[_-]?key|secret|password|token|BEGIN [A-Z ]+ PRIVATE KEY|DEEPSEEK_API_KEY|RESEND_API_KEY|SEPAY_SECRET_KEY)' dist .env .env.* 2>/dev/null || true
  ~~~

  Expected: no credentials, local env files, runtime database, logs, or unrelated build artifacts are included in the transfer archive. If the scan finds a secret-like value, stop and remove it from the artifact before proceeding.

- [ ] **Step 5: Deploy atomically while preserving rollback releases.**

  Package only the verified source and dist output according to the existing VPS deployment layout, transfer over SSH port 26266, create a unique release directory, retain CURRENT plus the two previous successful release directories, update the release symlink/working tree atomically, run the existing idempotent migration pre-start, and restart natarot.service. Do not edit /etc/natarot.env, database files, Nginx routing, DNS, or provider configuration.

  Verify remotely:

  ~~~bash
  ssh -p 26266 42.96.5.114 'systemctl is-active natarot.service; systemctl status natarot.service --no-pager -n 40; readlink -f /opt/natarot; ls -ld /opt/natarot /opt/natarot.previous-* 2>/dev/null | tail -n 8; curl -fsS http://127.0.0.1:8787/ >/dev/null'
  ~~~

- [ ] **Step 6: Run public HTTPS functional smoke tests.**

  Use cookie-isolated, non-secret test data and the real public host:

  ~~~bash
  curl --fail --silent --show-error https://natarot.com/ >/dev/null
  curl --fail --silent --show-error 'https://natarot.com/api/tarot/catalog?locale=vi' >/dev/null
  curl --fail --silent --show-error -c /tmp/natarot-reading-result.cookies -H 'Content-Type: application/json' -X POST https://natarot.com/api/tarot/draw --data '{"question":"Reading Result QA","optional_context":"","category_id":"category-business","spread_template_id":"spread-business-product-market-fit","deck_id":"deck-rider-waite-smith","locale":"vi","reversals":true,"selected_cards":[{"card_number":0,"orientation":"upright"},{"card_number":1,"orientation":"reversed"},{"card_number":2,"orientation":"upright"},{"card_number":3,"orientation":"reversed"},{"card_number":4,"orientation":"upright"}]}' >/tmp/natarot-reading-result-draw.json
  ~~~

  Extract only the returned session identifier from the JSON without printing cookies or secret fields, then request the room/session and verify the result page through the browser. Do not claim AI reading success unless the provider-backed response is actually available; a configured/unavailable 503 must be reported accurately.

- [ ] **Step 7: Perform production browser QA at desktop and required mobile widths.**

  Navigate the public site through Home → Room → draw → Reading Result, then inspect 1280px desktop and 375px, 390px, and 412px mobile. Verify visible canonical cards, mixed orientation, actual labels, full reading scroll, follow-up input, save/close, locale, no horizontal overflow, and no browser console errors. Capture screenshots for the final report. HTTP 200 alone is not acceptance.

- [ ] **Step 8: Update project state with evidence and commit the documentation.**

  Append a dated docs/PROJECT_STATE.md entry containing:

  - branch and final commit,
  - shared geometry and Reading Result files,
  - exact focused/full test counts,
  - typecheck/build/lint/diff-check results,
  - local and production browser viewport evidence,
  - actual production source/release identity,
  - fresh backup/checksum/restore-test evidence without secrets,
  - retained rollback releases,
  - deployment/restart/health-check result,
  - any unavailable provider, absent capability, baseline failure, or unfinished QA.

  Then run:

  ~~~bash
  git diff --check
  git add docs/PROJECT_STATE.md
  git diff --cached --stat
  git commit -m "docs: record reading result release evidence"
  git push
  ~~~

## Plan self-review

- Dynamic geometry is covered by Tasks 1–2 and is shared with Room through lib/room-motion.ts.
- All required representative counts and additional canonical types are covered by Tasks 1 and 4.
- Real payload, orientation, labels, i18n, follow-up, save, history, ownership, and existing sharing behavior are preserved by Task 3 and verified in Task 4.
- Full-screen responsive composition and reduced motion are covered by Task 3 and screenshot-tested in Tasks 4–5.
- No database, AI, auth, prompt, provider, or unrelated feature work is introduced.
- Production safety, latest-baseline integration, backup, release retention, public browser QA, and project-state evidence are covered by Task 5.
- No unbounded implementation placeholders appear in the plan; the one production source ref is explicitly resolved in Task 0 before release.
