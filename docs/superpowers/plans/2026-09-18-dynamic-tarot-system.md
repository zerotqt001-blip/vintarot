# Dynamic Tarot Reading System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the current VinTarot/NaTarot Room into a database-backed, guest-safe, bilingual Tarot reading flow without replacing its Moonlight/Celestial interface or current card motion.

**Architecture:** Keep the existing TypeScript card/narrative files as seed and legacy compatibility sources, add normalized D1/Drizzle Tarot tables, and expose catalog/draw/interpretation services through small server boundaries. Room fetches a selected catalog, creates one server-side draw plan per reading, consumes that plan through the existing fan/tap/keyboard/drag interactions, and renders cards/positions with `map` over dynamic data.

**Tech Stack:** Next 16/vinext, React 19, TypeScript, Cloudflare D1/SQLite, Drizzle ORM, Zod, existing `node:test` + `tsx` test convention, existing CSS motion system, and a server-only provider-neutral AI adapter with deterministic local fallback.

**Spec:** `docs/superpowers/specs/2026-09-18-dynamic-tarot-system-design.md`

## Global Constraints

- Work directly in the current `/Users/tranquangthanh/Documents/ChatGPT/test astra` project on `codex/tooling-and-version-history`; do not create a new project or worktree.
- Preserve the existing Moonlight reference, NaTarot/VinTarot branding, Room motion, direct card placement, mobile sheet, reduced-motion behavior, and all current routes.
- Do not overwrite or stage the existing unrelated changes in `app/room/room.tsx`, `app/globals.css`, `lib/i18n.ts`, the homepage plan, or the existing untracked tests unless a task explicitly modifies a required portion and stages only its related files.
- Preserve `lib/tarot.ts`, `lib/tarot-locales.ts`, `lib/tarot-narrative.ts`, `lib/card-images.json`, current image paths, and legacy Room state readers.
- Keep exactly 78 canonical cards, stable text card IDs, existing numeric card order as `card_number` 0–77, six current categories, current spread names/order, and dynamic position counts.
- New APIs must allow guest draw and interpretation; authentication remains required only for personal save/history/journal/shared-room persistence.
- Never expose provider credentials to the client or commit secrets, runtime D1 state, `.env` files, or build output.
- Every implementation slice starts with a failing focused test, reaches green, runs `git diff --check`, and commits only its related files.
- Do not render fixed `portraitCard`, `obstacleCard`, or `solutionCard` fields; render returned card/position arrays with `map`.
- Do not claim AI output when the configured provider is unavailable; return and display `source: "local-fallback"` for the deterministic path.

## File Map

Create or modify only the following feature files plus generated migration, focused tests, and project state documentation:

- `lib/tarot-catalog.ts`: shared locale/orientation/catalog/draw-plan types and the checked-in current category/template/position mapping.
- `db/tarot-names-vi.ts`: static Vietnamese names for the 78 canonical cards.
- `db/tarot-seed.ts`: validated seed builder and SQL statement generator from the existing card/narrative sources.
- `db/schema.ts`: Drizzle definitions for decks, cards, meanings, spread catalog, sessions, reading cards, and readings.
- `lib/tarot-repository.ts`: D1 query boundary for catalog, draw, session, meanings, and persisted readings.
- `lib/tarot-draw.ts`: pure unique-card/orientation/position draw-plan logic with injectable randomness.
- `lib/tarot-guest.ts`: optional authenticated identity and opaque guest-cookie ownership helpers.
- `lib/tarot-interpretation.ts`: validated reading shape, local fallback, and optional server provider adapter.
- `app/api/tarot/catalog/route.ts`: localized active catalog endpoint.
- `app/api/tarot/draw/route.ts`: guest-safe dynamic draw endpoint.
- `app/api/tarot/interpret/route.ts`: guest-safe interpretation endpoint.
- `app/api/tarot/session/route.ts`: owner-checked session read endpoint for resume/recovery.
- `app/api/rooms/route.ts`: backward-compatible Room state validation for dynamic draw metadata.
- `app/api/records/route.ts`: journal payload compatibility for session/card metadata.
- `app/create/ritual.tsx`: optional context in the existing question flow and draft transfer.
- `app/room/room.tsx`: catalog loading, dynamic plan consumption, rendering, interpretation UI, and existing interaction preservation.
- `app/globals.css`: only the responsive/scrollable presentation needed by the new catalog/interpretation surfaces.
- `lib/i18n.ts`: English/Vietnamese copy for catalog loading, errors, context, interpretation source, disclaimer, and sign-in gating.
- `scripts/generate-tarot-seed.ts`: idempotent SQL seed file generator for local/remote D1 execution.
- `package.json`: checked-in seed command only; no runtime AI SDK dependency.
- `drizzle/0001_dynamic_tarot.sql`: generated schema migration.
- `tests/tarot-seed.test.ts`, `tests/tarot-draw.test.ts`, `tests/tarot-catalog.test.ts`, `tests/tarot-api-contract.test.ts`, `tests/tarot-interpretation.test.ts`, `tests/tarot-room.test.ts`: focused RED/GREEN tests.
- `docs/PROJECT_STATE.md`: decisions, verification evidence, deployment status, and remaining work.

---

### Task 1: Establish the canonical Tarot catalog and seed contracts

**Files:**
- Create: `lib/tarot-catalog.ts`
- Create: `db/tarot-names-vi.ts`
- Create: `db/tarot-seed.ts`
- Test: `tests/tarot-seed.test.ts`

**Interfaces:**
- Consumes: `cards`, `cardMeaning`, `cardNarrative`, and image paths from `lib/tarot.ts`, `lib/tarot-locales.ts`, `lib/tarot-narrative.ts`, and `lib/card-images.json`.
- Produces: `TarotLocale`, `TarotOrientation`, `TarotCatalog`, `TarotCardSeed`, `TarotMeaningSeed`, `TarotCategorySeed`, `TarotTemplateSeed`, `TarotPositionSeed`, `TarotDrawPlanCard`, `buildTarotSeed()`, `validateTarotSeed()`, and `currentSpreadCatalog`.

- [ ] **Step 1: Write the failing seed invariants.**

```ts
import assert from "node:assert/strict";
import test from "node:test";
import { buildTarotSeed, validateTarotSeed } from "../db/tarot-seed";

test("canonical seed contains 78 stable cards and four meanings per card", () => {
  const seed = buildTarotSeed();
  validateTarotSeed(seed);
  assert.equal(seed.cards.length, 78);
  assert.equal(new Set(seed.cards.map((card) => card.id)).size, 78);
  assert.equal(new Set(seed.cards.map((card) => card.cardNumber)).size, 78);
  assert.equal(seed.meanings.length, 78 * 2 * 2);
  assert.equal(new Set(seed.meanings.map((meaning) => `${meaning.cardId}:${meaning.locale}:${meaning.orientation}`)).size, 312);
  assert.ok(seed.cards.every((card) => card.imageUrl.startsWith("/cards/")));
});

test("spread seed preserves the six Room topics and position counts", () => {
  const seed = buildTarotSeed();
  assert.deepEqual(seed.categories.map((category) => category.slug), [
    "relationships", "planning", "moon-phase", "creativity", "business", "fools-journey",
  ]);
  for (const template of seed.templates) {
    assert.equal(seed.positions.filter((position) => position.templateId === template.id).length, template.cardCount);
  }
});
```

- [ ] **Step 2: Run the focused test to verify RED.**

Run: `npx tsx --test tests/tarot-seed.test.ts`
Expected: FAIL because the canonical seed modules and exports do not exist.

- [ ] **Step 3: Define shared catalog types and current spread mapping.**

Implement `lib/tarot-catalog.ts` with string unions for `"en" | "vi"` and `"upright" | "reversed"`, and define the current mapping in display order:

```ts
export type TarotLocale = "en" | "vi";
export type TarotOrientation = "upright" | "reversed";

export type TarotPositionSeed = {
  id: string;
  templateId: string;
  key: string;
  order: number;
  label: { en: string; vi: string };
  description: { en: string; vi: string };
  prompt: { en: string; vi: string };
};

export type TarotDrawPlanCard = {
  readingCardId: string;
  cardId: string;
  cardNumber: number;
  positionId: string;
  positionKey: string;
  positionOrder: number;
  positionLabel: string;
  orientation: TarotOrientation;
};
```

Use the exact current mapping: Relationships → Relationship check-in; Planning → One small step and Past · Present · Future; Moon Phase → Three-card insight; Creativity → Social battery check; Business → Past · Present · Future; Fool’s Journey → Celtic cross. Give each category/template/position a stable slug/key and preserve current position order.

- [ ] **Step 4: Implement the static Vietnamese card-name map.**

Add all 78 canonical English-name keys to `db/tarot-names-vi.ts`; use explicit major names and explicit suit/rank names for minors so every card receives a checked-in `nameVi`. Reject missing keys in `validateTarotSeed()` rather than deriving an incomplete translation at runtime.

- [ ] **Step 5: Implement `buildTarotSeed()` and validation.**

Map the existing numeric cards to stable IDs such as `major-the-fool` and `wands-ace`; preserve `card_number` 0–77 and the existing `/cards/...` image path. Build two locale rows and two orientation rows per card. Convert `cardNarrative()` sections into the database fields `summary`, `energy`, `actions`, `relationships`, `work`, `creativity`, `home`, `symbolism`, and `journalQuestions`; obtain `keywords` from `cardMeaning()`.

Validate exact counts, stable uniqueness, existing image paths, known locales/orientations, category/template references, and `template.cardCount === positionCount`. Throw an error containing the failed invariant and count.

- [ ] **Step 6: Run the focused test to verify GREEN.**

Run: `npx tsx --test tests/tarot-seed.test.ts`
Expected: PASS with 78 cards, 312 meaning rows, six categories, and current spread positions.

- [ ] **Step 7: Commit the seed contract.**

```bash
git add lib/tarot-catalog.ts db/tarot-names-vi.ts db/tarot-seed.ts tests/tarot-seed.test.ts
git diff --cached --check
git commit -m "feat: define canonical tarot catalog seed"
```

### Task 2: Add D1/Drizzle schema, migration, and idempotent seed execution

**Files:**
- Modify: `db/schema.ts`
- Create: `drizzle/0001_dynamic_tarot.sql`
- Create: `scripts/generate-tarot-seed.ts`
- Modify: `package.json`
- Test: `tests/tarot-api-contract.test.ts`

**Interfaces:**
- Consumes: `TarotSeed` and catalog types from Task 1.
- Produces: Drizzle tables `decks`, `tarotCards`, `cardMeanings`, `spreadCategories`, `spreadTemplates`, `spreadPositions`, `readingSessions`, `readingCards`, and `readings`; a repeatable SQL seed generator.

- [ ] **Step 1: Write the failing schema/seed contract tests.**

```ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const schema = readFileSync(new URL("../db/schema.ts", import.meta.url), "utf8");

test("Drizzle schema declares every normalized Tarot table", () => {
  for (const table of [
    "decks", "tarotCards", "cardMeanings", "spreadCategories", "spreadTemplates",
    "spreadPositions", "readingSessions", "readingCards", "readings",
  ]) assert.match(schema, new RegExp(`export const ${table}\\s*=`));
});

test("migration creates the dynamic Tarot tables and uniqueness constraints", () => {
  const migration = readFileSync(new URL("../drizzle/0001_dynamic_tarot.sql", import.meta.url), "utf8");
  for (const table of ["decks", "tarot_cards", "card_meanings", "spread_categories", "spread_templates", "spread_positions", "reading_sessions", "reading_cards", "readings"]) {
    assert.match(migration, new RegExp(`CREATE TABLE[^;]*${table}`, "s"));
  }
  assert.match(migration, /card_meanings[^;]*UNIQUE[^;]*card_id[^;]*locale[^;]*orientation/s);
  assert.match(migration, /spread_positions[^;]*UNIQUE[^;]*spread_template_id[^;]*position_key/s);
});
```

- [ ] **Step 2: Run the contract test to verify RED.**

Run: `npx tsx --test tests/tarot-api-contract.test.ts`
Expected: FAIL because the tables and migration are not present.

- [ ] **Step 3: Add the normalized Drizzle schema.**

Use text primary keys and integer timestamps consistent with the existing `records`, `rooms`, and `room_members` tables. Add foreign-key references, active/display-order indexes, and the unique constraints from the spec. Store localized meaning fields as text and serialized `journal_questions`/`card_readings` as JSON text at the database boundary.

- [ ] **Step 4: Generate and inspect the migration.**

Run: `npm run db:generate`
Expected: a migration creates all nine tables, indexes, and unique constraints without altering the existing three tables. Rename the generated file to `drizzle/0001_dynamic_tarot.sql` only if the generator uses a different timestamp/name, then inspect it with `sed` before staging.

- [ ] **Step 5: Implement the idempotent SQL seed generator.**

Create `scripts/generate-tarot-seed.ts` with a `buildSeedSql(seed: TarotSeed): string` export. It must emit escaped `INSERT ... ON CONFLICT DO UPDATE` statements for the deck, 78 cards, 312 meanings, six categories, templates, and positions. It must validate the seed before writing and accept `--out <path>`; default to stdout so a temporary file outside the repository can be used.

Add this package script without adding a runtime dependency:

```json
{
  "scripts": {
    "db:seed:tarot": "npx tsx scripts/generate-tarot-seed.ts"
  }
}
```

- [ ] **Step 6: Run migration/seed smoke checks.**

Run:

```bash
npm run db:generate
npx tsx scripts/generate-tarot-seed.ts --out /tmp/vintarot-tarot-seed.sql
test -s /tmp/vintarot-tarot-seed.sql
rg -c "INSERT INTO tarot_cards" /tmp/vintarot-tarot-seed.sql
rg -c "INSERT INTO card_meanings" /tmp/vintarot-tarot-seed.sql
```

Expected: the seed file exists, card insert count is 78, meaning insert count is 312, and no secret-like value appears. Apply locally with `npx wrangler d1 execute DB --local --file=/tmp/vintarot-tarot-seed.sql` when the local D1 binding is available, then query the counts.

- [ ] **Step 7: Run focused tests and commit.**

Run: `npx tsx --test tests/tarot-seed.test.ts tests/tarot-api-contract.test.ts`
Expected: PASS.

```bash
git add db/schema.ts drizzle/0001_dynamic_tarot.sql scripts/generate-tarot-seed.ts package.json tests/tarot-api-contract.test.ts
git diff --cached --check
git commit -m "feat: add normalized tarot database schema"
```

### Task 3: Build the catalog repository and localized catalog endpoint

**Files:**
- Create: `lib/tarot-repository.ts`
- Create: `app/api/tarot/catalog/route.ts`
- Test: `tests/tarot-catalog.test.ts`

**Interfaces:**
- Consumes: D1 binding through `db()`/`getDb()`, normalized catalog tables, and `TarotLocale`.
- Produces: `TarotRepository`, `getTarotRepository(database)`, `listCatalog(locale)`, and `GET /api/tarot/catalog?locale=en|vi`.

- [ ] **Step 1: Write repository mapping tests with an in-memory fake.**

```ts
import assert from "node:assert/strict";
import test from "node:test";
import { mapCatalogRows, type CatalogRows } from "../lib/tarot-repository";

test("catalog response groups active categories and ordered templates/positions", () => {
  const rows: CatalogRows = {
    categories: [{ id: "cat-planning", slug: "planning", nameEn: "Planning", nameVi: "Lập kế hoạch", displayOrder: 1 }],
    templates: [{ id: "spread-step", categoryId: "cat-planning", slug: "one-small-step", nameEn: "One Small Step", nameVi: "Một bước nhỏ", cardCount: 1, displayOrder: 0 }],
    positions: [{ id: "pos-focus", templateId: "spread-step", key: "next_step", order: 0, labelEn: "Your focus", labelVi: "Trọng tâm của bạn" }],
  };
  const catalog = mapCatalogRows(rows, "en");
  assert.deepEqual(catalog.categories[0].templates[0].positions.map((position) => position.key), ["next_step"]);
  assert.equal(catalog.categories[0].templates[0].cardCount, 1);
  assert.equal(catalog.categories[0].templates[0].name, "One Small Step");
});

test("catalog rejects a template whose position count disagrees with card_count", () => {
  assert.throws(() => mapCatalogRows({ categories: [], templates: [{ id: "spread", categoryId: "cat", slug: "bad", nameEn: "Bad", nameVi: "Sai", cardCount: 2, displayOrder: 0 }], positions: [] }, "en"), /position count/i);
});
```

- [ ] **Step 2: Run the focused test to verify RED.**

Run: `npx tsx --test tests/tarot-catalog.test.ts`
Expected: FAIL because the repository module does not exist.

- [ ] **Step 3: Implement the repository interface and row mapper.**

Define the repository around the operations later API tasks need, keeping SQL out of route components:

```ts
export type TarotRepository = {
  listCatalog(locale: TarotLocale): Promise<TarotCatalog>;
  getActiveDeck(deckId: string): Promise<DeckRow | null>;
  getActiveTemplate(categoryId: string, templateId: string): Promise<TemplateWithPositions | null>;
  listCards(deckId: string): Promise<CardRow[]>;
  createReadingSession(input: NewReadingSession): Promise<string>;
  createReadingCards(rows: NewReadingCard[]): Promise<void>;
  getSessionForOwner(sessionId: string, owner: ReadingOwner): Promise<ReadingSessionWithCards | null>;
  getMeaning(cardId: string, locale: TarotLocale, orientation: TarotOrientation): Promise<CardMeaningRow | null>;
  saveReading(input: NewReading): Promise<string>;
};
```

Use parameterized D1 statements, filter `active = 1`, order categories/templates/positions by `display_order`/position order, and map localized columns at the boundary. Fail closed when a template’s position count is inconsistent.

- [ ] **Step 4: Implement the catalog route.**

Create `GET` in `app/api/tarot/catalog/route.ts`. Parse locale with Zod, call `listCatalog`, return `Response.json({ locale, categories })`, and return `400` for an invalid locale, `503` for an unavailable/empty seed, and `500` through the existing `boundary` handler for unexpected errors. Do not require `identity()`.

- [ ] **Step 5: Run focused tests and commit.**

Run: `npx tsx --test tests/tarot-catalog.test.ts tests/tarot-api-contract.test.ts`
Expected: PASS.

```bash
git add lib/tarot-repository.ts app/api/tarot/catalog/route.ts tests/tarot-catalog.test.ts
git diff --cached --check
git commit -m "feat: expose localized tarot catalog"
```

### Task 4: Add guest ownership and the dynamic draw/session API

**Files:**
- Create: `lib/tarot-guest.ts`
- Create: `lib/tarot-draw.ts`
- Create: `app/api/tarot/draw/route.ts`
- Create: `app/api/tarot/session/route.ts`
- Test: `tests/tarot-draw.test.ts`
- Test: `tests/tarot-api-contract.test.ts`

**Interfaces:**
- Consumes: `TarotRepository`, catalog types, D1, existing `getChatGPTUser()`, `json()`, `originCheck()`, and `boundary()`.
- Produces: `makeDrawPlan()`, `readOptionalOwner()`, `withGuestCookie()`, `POST /api/tarot/draw`, and owner-checked `GET /api/tarot/session?id=...`.

- [ ] **Step 1: Write deterministic draw tests before implementation.**

```ts
import assert from "node:assert/strict";
import test from "node:test";
import { makeDrawPlan } from "../lib/tarot-draw";

const cards = Array.from({ length: 10 }, (_, cardNumber) => ({
  id: `card-${cardNumber}`, cardNumber,
}));
const positions = Array.from({ length: 3 }, (_, order) => ({
  id: `position-${order}`, key: `position_${order}`, order,
  label: `Position ${order}`,
}));

test("draw plan has the exact dynamic count, unique cards, ordered positions, and orientation", () => {
  const plan = makeDrawPlan({ cards, positions, reversals: true, random: () => 0.2 });
  assert.equal(plan.length, 3);
  assert.equal(new Set(plan.map((card) => card.cardId)).size, 3);
  assert.deepEqual(plan.map((card) => card.positionOrder), [0, 1, 2]);
  assert.ok(plan.every((card) => card.orientation === "upright" || card.orientation === "reversed"));
});

test("disabled reversals force upright cards", () => {
  const plan = makeDrawPlan({ cards, positions, reversals: false, random: () => 0.99 });
  assert.ok(plan.every((card) => card.orientation === "upright"));
});

test("draw plan rejects an undersized deck", () => {
  assert.throws(() => makeDrawPlan({ cards: cards.slice(0, 2), positions, reversals: false, random: () => 0 }), /enough cards/i);
});
```

- [ ] **Step 2: Run the focused test to verify RED.**

Run: `npx tsx --test tests/tarot-draw.test.ts`
Expected: FAIL because the draw-plan module does not exist.

- [ ] **Step 3: Implement injectable cryptographic draw logic.**

Implement `makeDrawPlan()` with a Fisher–Yates selection over the database card rows, a `random()` dependency for tests, and a production default based on `crypto.getRandomValues`. Assign one selected card to each ordered position, generate a UUID per `readingCardId`, and never use `Math.random()` for card selection or orientation.

- [ ] **Step 4: Implement guest ownership helpers.**

`readOptionalOwner()` should return `{ kind: "user", userId }` when `getChatGPTUser()` succeeds, otherwise `{ kind: "guest", guestId, setCookie }`. Generate an opaque UUID guest ID, set `HttpOnly; SameSite=Lax; Secure; Path=/; Max-Age=2592000`, and merge `Set-Cookie` into successful draw/session responses. Never put the guest ID in the URL or JSON response.

- [ ] **Step 5: Implement `POST /api/tarot/draw`.**

Validate:

```ts
const drawRequest = z.object({
  question: z.string().trim().min(1).max(500),
  optional_context: z.string().trim().max(5000).optional().default(""),
  category_id: z.string().min(1).max(100),
  spread_template_id: z.string().min(1).max(100),
  deck_id: z.string().min(1).max(100),
  locale: z.enum(["en", "vi"]),
  reversals: z.boolean().optional().default(true),
});
```

Verify active deck/category/template ownership and position count, build the exact plan, insert one `reading_sessions` row and one `reading_cards` row per position in a D1 batch/transaction-compatible sequence, and return the session ID, localized category/template/positions, and all card metadata. On validation/relation/count errors return `400`, `404`, or `409` as specified; preserve the cookie on `201` success.

- [ ] **Step 6: Implement owner-checked session recovery.**

`GET /api/tarot/session?id=...` accepts the authenticated user or matching guest cookie, returns the session and ordered reading cards without meaning/AI output, and returns `404` for an unknown or different owner. This endpoint supports guest tab reload and signed-in Room resume without exposing another visitor’s reading.

- [ ] **Step 7: Add API contract assertions.**

Extend `tests/tarot-api-contract.test.ts` to assert the draw route contains the required request keys, calls the dynamic plan, persists `reading_sessions`/`reading_cards`, and returns `session_id` plus an array of cards rather than fixed position properties. Keep the assertions focused on public contract, not formatting.

- [ ] **Step 8: Run focused tests and commit.**

Run: `npx tsx --test tests/tarot-draw.test.ts tests/tarot-api-contract.test.ts`
Expected: PASS.

```bash
git add lib/tarot-guest.ts lib/tarot-draw.ts app/api/tarot/draw/route.ts app/api/tarot/session/route.ts tests/tarot-draw.test.ts tests/tarot-api-contract.test.ts
git diff --cached --check
git commit -m "feat: add guest-safe dynamic tarot draws"
```

### Task 5: Connect Create and Room to catalog-backed dynamic draw plans

**Files:**
- Create: `lib/tarot-room.ts`
- Modify: `app/create/ritual.tsx`
- Modify: `app/room/room.tsx`
- Modify: `app/api/rooms/route.ts`
- Modify: `lib/i18n.ts`
- Test: `tests/tarot-room.test.ts`

**Interfaces:**
- Consumes: catalog/draw/session endpoints, `TarotDrawPlanCard`, current Room state, current `spreadCardPosition`, existing fan and direct-placement handlers.
- Produces: backward-compatible Room state with `categoryId`, `spreadTemplateId`, `optionalContext`, `sessionId`, `drawPlan`, and dynamic card rendering/placement.

- [ ] **Step 1: Write failing room adapter tests.**

```ts
import assert from "node:assert/strict";
import test from "node:test";
import { consumeDrawPlan, hydrateLegacySpread, roomPositionLabels } from "../lib/tarot-room";
import { spreadCardPosition } from "../lib/room-motion";

test("legacy spread labels hydrate without changing their order", () => {
  const result = hydrateLegacySpread(["Persona", "Obstacle", "Solution"]);
  assert.equal(result?.templateSlug, "three-card-insight");
  assert.deepEqual(roomPositionLabels(result!), ["Persona", "Obstacle", "Solution"]);
});

test("consuming any fan card uses its server position order and prevents duplicates", () => {
  const plan = [
    { readingCardId: "r1", cardId: "card-a", cardNumber: 4, positionId: "p0", positionKey: "past", positionOrder: 0, positionLabel: "Past", orientation: "upright" as const },
    { readingCardId: "r2", cardId: "card-b", cardNumber: 9, positionId: "p1", positionKey: "present", positionOrder: 1, positionLabel: "Present", orientation: "reversed" as const },
  ];
  const first = consumeDrawPlan(plan, [], 9, 2);
  assert.equal(first?.card.cardNumber, 9);
  assert.deepEqual(first?.position, spreadCardPosition(1, 2));
  assert.equal(consumeDrawPlan(plan, [first!.card], 9, 2), null);
});
```

- [ ] **Step 2: Run the focused test to verify RED.**

Run: `npx tsx --test tests/tarot-room.test.ts`
Expected: FAIL because the adapter does not exist.

- [ ] **Step 3: Implement pure Room adapters.**

Define `LegacySpreadMatch` as the same shape as the catalog template returned by `hydrateLegacySpread`; it must include `templateSlug` and ordered positions. Define a `DynamicRoomCard` that retains the existing numeric `id` for CardFace compatibility and adds `cardId`, `readingCardId`, `positionKey`, `positionOrder`, and `orientation`. Implement:

```ts
export function hydrateLegacySpread(labels: string[]): LegacySpreadMatch | null;
export function roomPositionLabels(template: CatalogTemplate): string[];
export function consumeDrawPlan(
  plan: TarotDrawPlanCard[],
  drawn: DynamicRoomCard[],
  cardNumber: number,
  cardCount: number,
): { card: DynamicRoomCard; remaining: TarotDrawPlanCard[]; position: { x: number; y: number } } | null;
```

The room test imports `spreadCardPosition` from `lib/room-motion` so its expected position uses the same production slot helper.

Use `spreadCardPosition(positionOrder, cardCount)` so a 1-, 2-, 3-, or 10-card spread remains centered and deterministic. Do not use selection index as the position order.

- [ ] **Step 4: Extend the Room API state schema without breaking legacy rooms.**

Update `app/api/rooms/route.ts` to accept optional fields:

```ts
categoryId: z.string().max(100).nullable().optional(),
spreadTemplateId: z.string().max(100).nullable().optional(),
optionalContext: z.string().max(5000).optional(),
sessionId: z.string().max(100).nullable().optional(),
drawPlan: z.array(z.object({
  readingCardId: z.string().max(100), cardId: z.string().max(100),
  cardNumber: z.number().int().min(0).max(77), positionKey: z.string().max(100),
  positionOrder: z.number().int().min(0).max(9), positionLabel: z.string().max(160),
  orientation: z.enum(["upright", "reversed"]), drawn: z.boolean(),
})).max(10).optional(),
```

Accept legacy numeric `cards[].id` exactly as before. New writes include both numeric `id` and canonical `cardId`; old state remains valid.

- [ ] **Step 5: Add optional context to the existing Create draft.**

In `app/create/ritual.tsx`, keep the current two-step composition and add a secondary textarea/input on the question step. Store `optionalContext` with the existing `vintarot:new-reading` payload, trim to 5000 characters, and preserve the one-hour expiry and no-question-in-URL behavior. Add only the required `create.context*` English/Vietnamese messages.

- [ ] **Step 6: Load the catalog and preserve the current Room selection surface.**

In `app/room/room.tsx`, fetch `/api/tarot/catalog?locale=${locale}` on entry and keep loading/error/retry state separate from tabletop state. Replace the hardcoded `spreadTopics`/`spreads` read path with the API’s six categories and templates while retaining the existing labels, panel, mobile sheet, `Plus` affordances, selection highlight, and card-count copy. Use the existing hardcoded mapping only to hydrate old saved rooms when no IDs exist; do not silently use it for a new draw when catalog loading fails.

Disable a new spread choice after a reading has started unless the user first confirms/uses the existing “Start again” action. Selecting a spread before drawing updates category/template IDs and ordered labels, clears stale `drawPlan`, and keeps the deck/fan visuals unchanged.

- [ ] **Step 7: Prepare the server draw during the existing shuffle and consume it smoothly.**

Add a `prepareReadingPlan()` path that posts question, optional context, selected category/template, Rider–Waite–Smith deck ID, locale, and reversals to `/api/tarot/draw`. Start the request when the first shuffle action begins so the existing 3D cylinder can continue; on the stop action, enter the fan as soon as the plan is ready. If the request fails, keep the visual phase recoverable and expose a localized retry without creating partial cards.

Store the response’s `sessionId`, `drawPlan`, and position labels. Set `deckOrder` from the returned card numbers. Change fan tap, keyboard, drag, and `CardPicker` selection to call the adapter with the selected card number; the selected server card is placed at its server-assigned position, removed from the available plan, and never added twice. Keep the existing direct-placement path and do not add a release animation or a new timeout.

- [ ] **Step 8: Render dynamic cards and positions with the current visual components.**

Render `drawPlan`/drawn cards with `.map`, use `positionOrder` for `spreadCardPosition`, and use returned canonical card metadata/image URL with the existing local fallback. Keep the current `CardFace`, flip, focus, drag, pan, fan ghost, mobile bottom toolbar, and reduced-motion CSS. Add canonical `cardId`/orientation to the guide and journal payload without replacing the current visual card shape.

- [ ] **Step 9: Add Room integration tests and run focused checks.**

Extend `tests/tarot-room.test.ts` to assert `cards.map`, no fixed three-card property names, dynamic `drawPlan` state fields, and the existing removed-animation guards. Run:

```bash
npx tsx --test tests/tarot-room.test.ts tests/room-mobile.test.ts tests/room-mobile-first-screen.test.ts tests/room-features.test.ts
npx tsc --noEmit
```

Expected: PASS, with any unrelated pre-existing test failures reported separately rather than masked.

- [ ] **Step 10: Commit the Create/Room integration.**

```bash
git add lib/tarot-room.ts app/create/ritual.tsx app/room/room.tsx app/api/rooms/route.ts lib/i18n.ts tests/tarot-room.test.ts
git diff --cached --check
git commit -m "feat: connect room to dynamic tarot spreads"
```

### Task 6: Add bilingual interpretation with safe AI adapter and local fallback

**Files:**
- Create: `lib/tarot-interpretation.ts`
- Create: `app/api/tarot/interpret/route.ts`
- Modify: `lib/tarot-repository.ts`
- Modify: `lib/i18n.ts`
- Test: `tests/tarot-interpretation.test.ts`

**Interfaces:**
- Consumes: owner-checked reading sessions/cards, localized meaning rows, position prompts, `cardNarrative`, optional deployment env configuration.
- Produces: `buildLocalReading()`, `createInterpretationProvider()`, validated `ReadingPayload`, and `POST /api/tarot/interpret`.

- [ ] **Step 1: Write failing interpretation tests.**

```ts
import assert from "node:assert/strict";
import test from "node:test";
import { buildLocalReading, parseReadingPayload } from "../lib/tarot-interpretation";

test("local fallback returns one localized card reading per ordered position", () => {
  const result = buildLocalReading({
    locale: "vi",
    question: "Bước tiếp theo của tôi là gì?",
    cards: [{ readingCardId: "r1", positionKey: "next_step", positionLabel: "Bước tiếp theo", orientation: "upright", meaning: { summary: "Tóm tắt", actions: "Hành động", journalQuestions: ["Câu hỏi"] } }],
  });
  assert.equal(result.source, "local-fallback");
  assert.equal(result.reading.card_readings.length, 1);
  assert.match(result.reading.disclaimer, /phản chiếu|không phải/i);
});

test("provider-shaped JSON is rejected when it omits a card reading", () => {
  assert.throws(() => parseReadingPayload({ opening: "x", card_readings: [], synthesis: "x", advice: "x", closing: "x", disclaimer: "x" }, ["r1"]), /card_readings/i);
});
```

- [ ] **Step 2: Run the focused test to verify RED.**

Run: `npx tsx --test tests/tarot-interpretation.test.ts`
Expected: FAIL because the interpretation module does not exist.

- [ ] **Step 3: Define and validate the fixed reading shape.**

Use Zod to validate `opening`, ordered `card_readings` with `reading_card_id`, `position_key`, `interpretation`, and `reflection_prompt`, plus `synthesis`, `advice`, `closing`, and `disclaimer`. Enforce maximum lengths and exact session card coverage; reject extra/missing card IDs and reorder provider output to session order.

- [ ] **Step 4: Implement the deterministic local fallback.**

Build localized copy from the stored orientation-specific meaning fields and position prompts. Include the existing disclaimer in both locales, use reflective language, and set `source: "local-fallback"`, `modelName: "local-narrative"`, and a checked-in `promptVersion` such as `tarot-reading-v1`.

- [ ] **Step 5: Implement the optional server-only provider adapter.**

Read provider configuration only from the Cloudflare worker environment. Use `fetch` from the server, send a bounded localized prompt containing question/context, position prompts, and meaning evidence, request the fixed JSON shape, enforce a timeout with `AbortController`, and never return raw provider errors or credentials. If configuration is absent, the request times out, JSON is invalid, or validation fails, call the local fallback.

- [ ] **Step 6: Implement `POST /api/tarot/interpret`.**

Validate `{ session_id, locale }`, verify guest/auth ownership through the session repository, load ordered meanings, call the configured adapter or fallback, persist `readings` with serialized card readings, `model_name`, and `prompt_version`, and return `{ session_id, locale, source, model_name, reading }`. Do not require sign-in.

- [ ] **Step 7: Add tests for provider failure/fallback and persistence contract.**

Use a fake provider that returns malformed JSON and assert that `buildLocalReading()` is used and source is `local-fallback`. Assert that the route contract includes disclaimer, model, prompt version, and all session cards. Run:

```bash
npx tsx --test tests/tarot-interpretation.test.ts tests/tarot-api-contract.test.ts
```

Expected: PASS.

- [ ] **Step 8: Commit the interpretation service.**

```bash
git add lib/tarot-interpretation.ts app/api/tarot/interpret/route.ts lib/tarot-repository.ts lib/i18n.ts tests/tarot-interpretation.test.ts tests/tarot-api-contract.test.ts
git diff --cached --check
git commit -m "feat: add bilingual tarot interpretation fallback"
```

### Task 7: Add Suy ngẫm interpretation UI and authenticated save metadata

**Files:**
- Modify: `app/room/room.tsx`
- Modify: `app/globals.css`
- Modify: `app/api/records/route.ts`
- Modify: `lib/i18n.ts`
- Test: `tests/tarot-room.test.ts`

**Interfaces:**
- Consumes: `POST /api/tarot/interpret`, current notes/reflection dialog, `api("records", ...)`, `identity()` sign-in boundary.
- Produces: guest interpretation panel, localized source/disclaimer display, and journal payload that retains session/card/position/orientation metadata when authenticated.

- [ ] **Step 1: Write failing UI contract assertions.**

```ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("../app/room/room.tsx", import.meta.url), "utf8");

test("Room reflection surface exposes interpretation and dynamic session data", () => {
  assert.match(source, /api\(['"]tarot\/interpret/);
  assert.match(source, /sessionId/);
  assert.match(source, /local-fallback|reading\.disclaimer/);
  assert.match(source, /cardId/);
});
```

- [ ] **Step 2: Run the focused test to verify RED.**

Run: `npx tsx --test tests/tarot-room.test.ts`
Expected: FAIL because Room has no interpretation call or dynamic metadata yet.

- [ ] **Step 3: Add a localized interpretation action to the existing reflection dialog.**

Keep the current question/notes inputs and save button. Add an interpretation button enabled only when all selected spread positions are drawn and `sessionId` exists. Show loading/status/error states without removing the notes. Render the returned ordered card readings, synthesis, advice, closing, source label, and disclaimer in a scrollable panel that works in the current desktop dialog and mobile sheet.

- [ ] **Step 4: Keep guest access and make save gating explicit.**

Guest users can interpret and keep the result in the active Room. If they press save/journal/shared-room controls, preserve the existing 401 handling but show the localized sign-in action/modal rather than losing the reading. Authenticated saves include `session_id`, `category_id`, `spread_template_id`, `optional_context`, and cards with `cardId`, numeric compatibility `id`, position key/order, and orientation.

- [ ] **Step 5: Extend journal validation without changing existing records.**

Update the `journal` Zod shape in `app/api/records/route.ts` to accept optional session/template/context metadata and card metadata while keeping the current `question`, `notes`, and existing numeric card fields valid. Do not require the Tarot tables for old journal records.

- [ ] **Step 6: Add only necessary responsive CSS and i18n.**

Add scroll containment, readable card-reading spacing, source badge, disclaimer styling, and safe-area behavior to `app/globals.css`; keep the current Celestial tokens and reduced-motion rules. Add English/Vietnamese keys for context, interpretation, loading, retry, source, disclaimer, and sign-in/save messaging.

- [ ] **Step 7: Run focused UI/type checks and commit.**

Run:

```bash
npx tsx --test tests/tarot-room.test.ts tests/room-content.test.ts tests/room-mobile.test.ts
npx tsc --noEmit
git diff --check
```

Expected: PASS.

```bash
git add app/room/room.tsx app/globals.css app/api/records/route.ts lib/i18n.ts tests/tarot-room.test.ts
git diff --cached --check
git commit -m "feat: add room reflection interpretation flow"
```

### Task 8: Full verification, state documentation, push, and Site release

**Files:**
- Modify: `docs/PROJECT_STATE.md`
- Test: all tracked tests and focused Tarot tests

**Interfaces:**
- Consumes: all completed Tasks 1–7, local/remote D1 configuration, current Site hosting configuration.
- Produces: verified branch, pushed commits, documented deployment/version, and a public URL only after build/browser checks pass.

- [ ] **Step 1: Run the complete focused Tarot test set.**

```bash
npx tsx --test tests/tarot-seed.test.ts tests/tarot-draw.test.ts tests/tarot-catalog.test.ts tests/tarot-api-contract.test.ts tests/tarot-interpretation.test.ts tests/tarot-room.test.ts
```

Expected: PASS for every new Tarot test.

- [ ] **Step 2: Run repository verification.**

```bash
npx tsc --noEmit
npm run build
git diff --check
npm run lint
```

Record lint failures only when they are unchanged/pre-existing; do not weaken lint rules to hide a regression.

- [ ] **Step 3: Run local D1 and browser checks.**

Apply the generated schema and seed to local D1, start the existing local Site command, and verify at desktop and `390x844`:

1. `/create` keeps the current two-step topic/question UI and transfers optional context.
2. `/room?ritual=1` loads six API categories and current templates in English/Vietnamese.
3. One-, two-, three-, and ten-card templates show exact position counts and centered slots.
4. Shuffle start/stop remains smooth; tap, keyboard, and drag all place a selected server-plan card without a release animation or duplicate.
5. Guest interpretation works, marks AI vs local fallback honestly, scrolls on mobile, and keeps the disclaimer.
6. Save/journal/shared-room controls request sign-in for guests while the drawn reading remains visible.
7. Existing signed-in Room invite/text/drawing/persistence behavior remains intact.
8. There is no horizontal overflow, and reduced-motion mode remains calm.

- [ ] **Step 4: Update project state with evidence.**

Append a dated entry to `docs/PROJECT_STATE.md` covering normalized table/seed decisions, API routes, compatibility behavior, exact commands and test counts, local/browser checks, AI configuration status, and any unfinished production integration. Do not claim a public release until the Site deployment succeeds.

- [ ] **Step 5: Inspect and commit only project-state changes.**

```bash
git add docs/PROJECT_STATE.md
git diff --cached --check
git diff --cached --stat
git diff --cached | rg -n 'OPENAI_API_KEY=|sk-[A-Za-z0-9]|BEGIN (RSA|OPENSSH|EC) PRIVATE KEY' && exit 1 || true
git commit -m "docs: record dynamic tarot verification"
```

- [ ] **Step 6: Push and verify the branch.**

```bash
git push origin codex/tooling-and-version-history
git status --short --branch
git log --oneline -n 8
```

Expected: the new commits are present on the remote branch; unrelated pre-existing worktree changes remain visible and are not silently discarded.

- [ ] **Step 7: Publish only the verified build through the existing Site flow.**

Use the project’s existing Sites hosting configuration and publish the current verified source. Confirm the public URL, deployment version/source commit, `/create`, `/room`, and guest draw/interpretation after publish. If hosting or AI secrets are unavailable, report that specifically and leave the local verified build intact; do not create a second Site or expose credentials.

## Plan Self-Review

- Spec coverage: schema/seed is Tasks 1–2; catalog is Task 3; guest/dynamic draw is Task 4; Create/Room dynamic state and motion compatibility is Task 5; bilingual AI/local interpretation is Task 6; Suy ngẫm/save/auth boundary is Task 7; verification/deployment is Task 8.
- Placeholder scan: no unresolved placeholder markers or incomplete steps remain.
- Type consistency: `TarotDrawPlanCard`, `TarotRepository`, `makeDrawPlan`, `buildLocalReading`, and `consumeDrawPlan` are introduced before their consumers and use the same field names across tasks.
- Backward compatibility: old numeric Room cards, spread labels, journal records, and existing controls remain valid; new canonical IDs and session metadata are additive.
- Scope: the plan intentionally avoids a new project, a full Room rewrite, new runtime dependencies, payment/video/email integrations, or a new history UI beyond the existing journal/save boundary.
