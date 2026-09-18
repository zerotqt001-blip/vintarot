# NaTarot Brand System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Synchronize the NaTarot visual identity across the existing website so every route shares the approved deep navy, ivory, antique-gold, celestial visual language while preserving all existing Tarot logic, navigation, business flows, copy, APIs, database behavior, authentication, and responsive interactions.

**Architecture:** Introduce one canonical brand-token layer in `app/globals.css`, add a reusable asset-backed `Logo` component, then migrate shared controls, the application shell, and route surfaces to those tokens incrementally. Existing route-specific selectors remain as compatibility layers and receive canonical aliases rather than being removed in one risky rewrite.

**Tech Stack:** Next.js App Router, React, TypeScript, Tailwind CSS v4 utilities, CVA/shadcn primitives, lucide-react, Node test runner via `tsx`, Playwright-style browser inspection through the local Codex browser, and the Impeccable visual detector.

**Spec:** `docs/superpowers/specs/2026-09-19-natarot-brand-system-design.md`

## Global Constraints

- Work only on the existing `codex/` branch. Do not reset, force-push, rewrite the baseline tag, or overwrite the user-owned untracked files `docs/superpowers/plans/2026-09-17-homepage-3d.md`, `tests/celestial-surfaces.test.ts`, or `tests/homepage-celestial.test.ts`.
- Do not change Tarot interpretation logic, card data, room mechanics, navigation destinations, copy, API contracts, database access, authentication behavior, URL structure, or responsive interaction behavior.
- Preserve the supplied Moonlight/celestial reference direction and NaTarot brand name. The attached image is a visual reference only; do not crop it into a production logo and do not invent an alternate visual identity.
- Use existing `Instrument Serif` and `Work Sans`; do not add a font dependency.
- Prefer existing Lucide icons for controls. Do not replace icons with Unicode glyphs or emoji.
- Add tests before implementation for every independently verifiable slice. Keep source-contract tests deterministic and do not make them depend on a running server.
- Before each commit, stage only the files belonging to that task, run `git diff --cached --check`, and inspect staged text for secrets with:

  ```sh
  git diff --cached | rg -n -i "api[_ -]?key|secret|password|BEGIN [A-Z ]+ PRIVATE KEY|sk-[A-Za-z0-9]" || true
  ```

- Do not commit `.env` files, runtime databases, auth/session data, build output, or unrelated user changes.

## Task 1: Add failing contracts for the brand foundation

**Files:**

- Create `tests/brand-tokens.test.ts`.
- Do not modify production files in this task.

- [ ] Write the test first. It should read source files with `node:fs` and assert the following contracts:

  ```ts
  import { existsSync, readFileSync } from "node:fs";
  import { test } from "node:test";
  import assert from "node:assert/strict";

  const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
  const projectRoot = new URL("../", import.meta.url);
  const brandTokens = [
    "--color-bg-deep",
    "--color-bg",
    "--color-surface",
    "--color-surface-elevated",
    "--color-gold",
    "--color-gold-bright",
    "--color-gold-muted",
    "--color-ivory",
    "--color-text",
    "--color-text-muted",
    "--color-border",
    "--color-border-active",
    "--color-focus",
  ];

  test("canonical NaTarot tokens exist", () => {
    for (const token of brandTokens) assert.match(css, new RegExp(`${token}\\s*:`));
    assert.match(css, /--color-bg-deep\\s*:\s*#061522/);
    assert.match(css, /--color-gold\\s*:\s*#d7b36a/);
    assert.match(css, /--color-ivory\\s*:\s*#f4ebdd/);
  });

  test("stable logo asset paths exist", () => {
    for (const relativePath of [
      "public/brand/natarot-icon.svg",
      "public/brand/natarot-logo-dark.svg",
      "public/brand/natarot-logo-light.svg",
    ]) {
      assert.equal(existsSync(new URL(relativePath, projectRoot)), true, relativePath);
    }
  });

  test("Logo component exposes the approved variants without embedding a screenshot", () => {
    const logoPath = new URL("../components/brand/logo.tsx", import.meta.url);
    const source = existsSync(logoPath) ? readFileSync(logoPath, "utf8") : "";
    assert.match(source, /variant/);
    assert.match(source, /dark/);
    assert.match(source, /light/);
    assert.match(source, /icon/);
    assert.doesNotMatch(source, /MORE THAN A READING/);
  });
  ```

- [ ] Run the focused test and confirm it fails because the canonical assets/component/tokens are not implemented yet:

  ```sh
  npx tsx --test tests/brand-tokens.test.ts
  ```

- [ ] Commit only the new test after inspecting it:

  ```sh
  git add tests/brand-tokens.test.ts
  git diff --cached --check
  git diff --cached | rg -n -i "api[_ -]?key|secret|password|BEGIN [A-Z ]+ PRIVATE KEY|sk-[A-Za-z0-9]" || true
  git commit -m "test: define natarot brand foundation contracts"
  ```

## Task 2: Implement canonical tokens, logo assets, and metadata

**Files:**

- Modify `app/globals.css`.
- Create `components/brand/logo.tsx`.
- Create `public/brand/natarot-icon.svg`.
- Create `public/brand/natarot-logo-dark.svg`.
- Create `public/brand/natarot-logo-light.svg`.
- Modify `public/favicon.svg`.
- Modify `app/layout.tsx`.

- [ ] Add the canonical variables from the approved spec to the root token layer, including the exact values below. Keep existing route token blocks intact for this task, and map the Tailwind theme aliases to the canonical variables where that does not break existing selectors:

  ```css
  --color-bg-deep: #061522;
  --color-bg: #081a2a;
  --color-surface: #0b2032;
  --color-surface-elevated: #10283b;
  --color-surface-soft: rgba(11, 32, 50, 0.72);
  --color-gold: #d7b36a;
  --color-gold-bright: #e7c77d;
  --color-gold-muted: rgba(215, 179, 106, 0.52);
  --color-gold-subtle: rgba(215, 179, 106, 0.16);
  --color-ivory: #f4ebdd;
  --color-text: #eee5d7;
  --color-text-muted: rgba(238, 229, 215, 0.62);
  --color-text-subtle: rgba(238, 229, 215, 0.42);
  --color-border: rgba(215, 179, 106, 0.25);
  --color-border-active: rgba(231, 199, 125, 0.75);
  --color-focus: rgba(231, 199, 125, 0.9);
  --radius-brand-sm: 0.5rem;
  --radius-brand-md: 0.75rem;
  --radius-brand-lg: 1rem;
  --shadow-brand-panel: 0 18px 48px rgba(0, 0, 0, 0.28);
  ```

- [ ] Add shared logo sizing and visibility classes without changing the existing mobile breakpoints. The desktop wordmark should read as the primary brand, the tagline should remain separate, and the compact mobile treatment should hide only the tagline, not navigation functionality.
- [ ] Build `Logo` as a typed reusable component with `variant: "dark" | "light" | "icon"`, optional `compact`, optional `href`, and `className` props. Use the stable `/brand/...svg` paths, render the icon-only asset for `variant="icon"`, and render the dark/light wordmark assets for the corresponding variants. The component must not contain the reference screenshot or the tagline.
- [ ] Draw restrained production-safe SVG placeholders directly from the approved crescent/star motif. Use transparent backgrounds, explicit `viewBox` values, accessible `<title>` text, and stable dimensions so exact supplied production SVGs can replace the files later without changing component code.
- [ ] Replace `public/favicon.svg` with the same icon motif and update `app/layout.tsx` metadata icons to include the stable icon path. Keep the document title and description semantically unchanged unless the existing title needs the NaTarot wordmark capitalization corrected.
- [ ] Run the focused test and TypeScript check:

  ```sh
  npx tsx --test tests/brand-tokens.test.ts
  npx tsc --noEmit
  ```

- [ ] Commit only the token, logo, favicon, metadata, and related test files:

  ```sh
  git add app/globals.css app/layout.tsx components/brand/logo.tsx public/brand public/favicon.svg tests/brand-tokens.test.ts
  git diff --cached --check
  git diff --cached | rg -n -i "api[_ -]?key|secret|password|BEGIN [A-Z ]+ PRIVATE KEY|sk-[A-Za-z0-9]" || true
  git commit -m "feat: add natarot brand tokens and logo system"
  ```

## Task 3: Add failing contracts and migrate shared UI primitives

**Files:**

- Create `tests/brand-primitives.test.ts`.
- Modify `components/ui/button.tsx`.
- Modify `components/ui/input.tsx`.
- Create `components/ui/panel.tsx`.
- Modify `app/globals.css`.

- [ ] Add source-contract tests before changing the primitives. The tests should assert that `button.tsx` contains `primary`, `secondary`, `ghost`, and `icon` variants plus a 44px-sized icon target; that `input.tsx` has the canonical dark surface/focus language; that `panel.tsx` exports a `Panel` component; and that `globals.css` defines `.brand-panel` and `.brand-icon-button`.

  ```ts
  import { readFileSync } from "node:fs";
  import { test } from "node:test";
  import assert from "node:assert/strict";

  const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

  test("button variants preserve the shared control contract", () => {
    const source = read("components/ui/button.tsx");
    for (const variant of ["primary", "secondary", "ghost", "icon"]) {
      assert.match(source, new RegExp(`${variant}\\s*:`));
    }
    assert.match(source, /min-h-11|h-11|size-11/);
  });

  test("input and panel primitives use brand surfaces", () => {
    assert.match(read("components/ui/input.tsx"), /bg-(?:surface|background)|color-bg|focus/);
    assert.match(read("components/ui/panel.tsx"), /export (?:const|function) Panel/);
    const css = read("app/globals.css");
    assert.match(css, /\\.brand-panel\\s*\\{/);
    assert.match(css, /\\.brand-icon-button\\s*\\{/);
  });
  ```

- [ ] Run `npx tsx --test tests/brand-primitives.test.ts` and confirm the new contracts fail before implementation.
- [ ] Extend the existing CVA button API without removing existing aliases used by the app. Add semantic `primary`, `secondary`, `ghost`, and `icon` variants, retain `default`, `outline`, `destructive`, `link`, and existing size aliases, and make the standard/icon targets at least 44px where the spec requires it. Keep `asChild` behavior unchanged.
- [ ] Restyle `Input` for the dark surface, ivory text, muted placeholder, gold border/focus ring, autofill safety, and 44px comfortable height while retaining its current props/ref behavior.
- [ ] Create `Panel` with the existing `React.ComponentProps<"div">` style of API, forwarding `ref` if the local primitive convention requires it. Give it a `brand-panel` class, canonical surface/border/shadow tokens, and a `tone` variant limited to the approved surface hierarchy.
- [ ] Add `.brand-panel`, `.brand-icon-button`, `.brand-focus-ring`, and the shared button aliases in `app/globals.css`. Ensure `:focus-visible` uses `--color-focus` and `prefers-reduced-motion: reduce` disables nonessential transition/animation.
- [ ] Run the focused primitive test plus `npx tsc --noEmit` and commit the primitive migration:

  ```sh
  npx tsx --test tests/brand-primitives.test.ts
  npx tsc --noEmit
  git add app/globals.css components/ui/button.tsx components/ui/input.tsx components/ui/panel.tsx tests/brand-primitives.test.ts
  git diff --cached --check
  git diff --cached | rg -n -i "api[_ -]?key|secret|password|BEGIN [A-Z ]+ PRIVATE KEY|sk-[A-Za-z0-9]" || true
  git commit -m "feat: align shared controls with natarot brand"
  ```

## Task 4: Add failing shell contracts and update the shared application shell

**Files:**

- Create `tests/brand-shell.test.ts`.
- Modify `app/vintarot.tsx`.
- Modify `app/room/room.tsx` only where the room shell currently duplicates brand/header treatment.
- Modify `app/globals.css`.

- [ ] Write source-contract tests before implementation. They must verify that `vintarot.tsx` imports `Logo`, renders a dark logo in the header, includes a footer logo, preserves representative route strings such as `/guidebook`, `/community`, `/daily-spread`, `/book`, `/journal`, and `/profile`, and that CSS contains desktop/mobile logo rules.

  ```ts
  import { readFileSync } from "node:fs";
  import { test } from "node:test";
  import assert from "node:assert/strict";

  const shell = readFileSync(new URL("../app/vintarot.tsx", import.meta.url), "utf8");
  const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

  test("shared shell uses Logo without changing route destinations", () => {
    assert.match(shell, /components\\/brand\\/logo/);
    assert.match(shell, /<Logo[^>]+variant=["']dark["']/);
    assert.match(shell, /<footer[\\s\\S]*<Logo/);
    for (const route of ["/guidebook", "/community", "/daily-spread", "/book", "/journal", "/profile"]) {
      assert.match(shell, new RegExp(route.replace("/", "\\/")));
    }
  });

  test("shell exposes responsive brand hooks", () => {
    assert.match(css, /\\.brand-logo/);
    assert.match(css, /@media[^{]+\\{/);
    assert.match(css, /tagline|brand-tagline/);
  });
  ```

- [ ] Run `npx tsx --test tests/brand-shell.test.ts` and confirm it fails before changing the shell.
- [ ] Replace the text-only header brand in `app/vintarot.tsx` with the shared `Logo`, preserving the existing href, navigation arrays, language selector, personal navigation, room CTA, sidebar open/close behavior, dialog, and every route string. Keep the tagline as separate text so it can be hidden on narrow screens without shrinking the logo.
- [ ] Apply the approved shell hierarchy: a 68–76px desktop header, a visually dominant icon/wordmark, restrained gold active state, muted ivory inactive links, pill controls only where already semantically appropriate, and the existing sidebar structure. Do not add a second navigation system.
- [ ] Add a compact footer brand treatment using the same `Logo` component and preserve existing marquee/links. Keep the footer decorative and short; do not duplicate the full header controls.
- [ ] Inspect `app/room/room.tsx` for any room-local text-only brand/header and switch only that brand rendering to the shared component. Preserve tabletop controls, reading controls, mobile header, route changes, shuffle/draw interactions, and all existing state.
- [ ] Add shell-specific CSS hooks in `app/globals.css` for logo sizes, tagline visibility, header spacing, sidebar active state, footer logo, and 44px icon controls. Use the canonical tokens instead of new one-off colors.
- [ ] Run focused tests and TypeScript validation, then commit:

  ```sh
  npx tsx --test tests/brand-shell.test.ts
  npx tsc --noEmit
  git add app/globals.css app/vintarot.tsx app/room/room.tsx tests/brand-shell.test.ts
  git diff --cached --check
  git diff --cached | rg -n -i "api[_ -]?key|secret|password|BEGIN [A-Z ]+ PRIVATE KEY|sk-[A-Za-z0-9]" || true
  git commit -m "feat: apply natarot identity to shared shell"
  ```

## Task 5: Add failing surface contracts and migrate route-level surfaces

**Files:**

- Create `tests/brand-surfaces.test.ts`.
- Modify `app/globals.css`.
- Modify `app/pages.tsx`.
- Modify `app/room/room.tsx` as needed for surface hooks.
- Modify `components/reading/reading-panel.tsx`.
- Modify `components/reading/reading-header.tsx`.
- Modify `components/reading/direct-answer.tsx`.
- Modify `components/reading/follow-up-reading.tsx` only where shared surface classes are needed.
- Modify route-specific components only when an existing class/token hook is required; do not rewrite business logic.

- [ ] Add source-contract tests that assert all major route shells receive canonical aliases while preserving route-specific selectors:

  ```ts
  import { readFileSync } from "node:fs";
  import { test } from "node:test";
  import assert from "node:assert/strict";

  const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

  test("major shells retain their hooks and expose canonical brand levels", () => {
    const css = read("app/globals.css");
    for (const shell of ["home-shell", "room-page", "practice-shell", "create-shell", "daily-shell", "guidebook-shell"]) {
      assert.match(css, new RegExp(`\\.${shell}`));
    }
    for (const token of ["--color-bg-deep", "--color-surface", "--color-gold", "--color-ivory"]) {
      assert.match(css, new RegExp(`${token}\\s*:`));
    }
  });

  test("sign-in and reading surfaces use shared brand hooks", () => {
    assert.match(read("app/pages.tsx"), /signIn|signin-with-chatgpt/);
    assert.match(read("app/pages.tsx"), /brand-panel|Panel|Logo/);
    const reading = read("components/reading/reading-panel.tsx");
    assert.match(reading, /reading-panel/);
    assert.match(reading, /brand-panel|reading-surface/);
  });
  ```

- [ ] Run `npx tsx --test tests/brand-surfaces.test.ts` and confirm it fails before migration.
- [ ] Add compatibility aliases at the beginning of the relevant `.home-shell`, `.room-page`, `.practice-shell`, `.create-shell`, `.daily-shell`, and `.guidebook-shell` blocks. Each shell should consume the canonical deep background, surface, gold, ivory, muted text, border, radius, and shadow values. Keep existing route tokens available for selectors that still reference them, so this remains a controlled migration rather than a behavioral rewrite.
- [ ] Update `app/pages.tsx` sign-in/profile/journal/form surfaces to use `Panel` or `brand-panel` and shared button/input styles. Preserve the existing `/signin-with-chatgpt?return_to=/profile` destination and all page copy.
- [ ] Update `components/reading/*` to apply a shared reading-surface/panel hook, canonical gold dividers, readable ivory text, muted secondary text, and clear focus states. Keep reading data, loading states, follow-up actions, dialog behavior, and card ordering unchanged.
- [ ] Update room/tabletop surfaces only through class/token hooks: immersive deep background, elevated table panel, gold action hierarchy, and compact mobile handling. Do not alter room state or draw/shuffle logic.
- [ ] Keep all existing decorative celestial artwork, card backs, and route-specific composition. This task only unifies color, border, typography, panel, control, and focus treatment.
- [ ] Run focused surface tests, the existing route/source-contract tests, and TypeScript validation:

  ```sh
  npx tsx --test tests/brand-surfaces.test.ts tests/home-celestial-theme.test.ts tests/daily-spread-ui.test.ts tests/room-celestial-theme.test.ts tests/tarot-reading-ui.test.ts tests/mobile-navigation.test.ts
  npx tsc --noEmit
  ```

- [ ] Commit only the surface migration and its test:

  ```sh
  git add app/globals.css app/pages.tsx app/room/room.tsx components/reading tests/brand-surfaces.test.ts
  git diff --cached --check
  git diff --cached | rg -n -i "api[_ -]?key|secret|password|BEGIN [A-Z ]+ PRIVATE KEY|sk-[A-Za-z0-9]" || true
  git commit -m "feat: unify natarot route surfaces"
  ```

## Task 6: Full verification, visual QA, and project-state handoff

**Files:**

- Modify `docs/PROJECT_STATE.md`.
- Do not alter unrelated files discovered during verification.

- [ ] Run the complete tracked test suite using the repository’s current toolchain. Discover the exact test files with `rg --files tests | sort`, then run all relevant `*.test.ts` files through `npx tsx --test` without including generated output.
- [ ] Run `npx tsc --noEmit`, `npm run lint`, and `npm run build`. If a pre-existing check fails, capture the exact failure and determine whether the change caused it before making any fix.
- [ ] Run the Impeccable detector after the UI is implemented:

  ```sh
  sh .codex/skills/impeccable/scripts/impeccable detect --json app components
  ```

  Review every finding manually. Fix only findings that are within this rebrand scope, then rerun the detector and keep the final output as verification evidence.

- [ ] Use the existing local browser at `http://localhost:5173` for visual QA at desktop and narrow viewport sizes. Inspect `/`, `/guidebook`, `/community`, `/daily-spread`, `/book`, `/journal`, `/profile`, and a representative room/reading route. Confirm:

  - The header logo is legible on the deep navy surface and the tagline is separate.
  - Gold is an accent for active/focus/primary actions, not a full-page fill.
  - Panels have readable contrast and a restrained border/shadow hierarchy.
  - Sidebar/footer reuse the identity without crowding the shell.
  - Mobile keeps the existing interactions and hides only nonessential tagline/secondary decoration.
  - No layout overflow, clipped logo, unreadable text, broken SVG, or accidental light-theme flash appears.

- [ ] Inspect the final diff and status. Confirm no `.env`, build output, runtime state, or unrelated user file is staged. Run:

  ```sh
  git diff --check
  git status --short
  git diff --stat HEAD~6..HEAD
  ```

- [ ] Update `docs/PROJECT_STATE.md` with the completed brand-system decisions, canonical token/logo paths, commands and browser routes verified, any pre-existing failures, and any explicitly unfinished work. Keep the update concise and append it to the relevant current-state sections instead of deleting historical notes.
- [ ] Commit the project-state update after the final verification and staged secret scan:

  ```sh
  git add docs/PROJECT_STATE.md
  git diff --cached --check
  git diff --cached | rg -n -i "api[_ -]?key|secret|password|BEGIN [A-Z ]+ PRIVATE KEY|sk-[A-Za-z0-9]" || true
  git commit -m "docs: record natarot brand verification"
  ```

## Completion Criteria

- [ ] Canonical token values and stable logo asset paths are present and tested.
- [ ] Header, sidebar, footer, room shell, reading panel, forms, and major route surfaces visibly share the NaTarot identity.
- [ ] Existing route strings, business interactions, Tarot logic, APIs, database/auth behavior, copy, and responsive interactions are unchanged.
- [ ] Focused tests, existing tests, TypeScript, lint, build, Impeccable detector review, and desktop/mobile browser QA have evidence recorded.
- [ ] `docs/PROJECT_STATE.md` documents decisions, validation, and unfinished work.
