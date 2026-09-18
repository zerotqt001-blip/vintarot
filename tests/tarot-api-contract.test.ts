import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import test from "node:test";
import { buildSeedSql } from "../scripts/generate-tarot-seed";
import { buildTarotSeed } from "../db/tarot-seed";

const schema = readFileSync(new URL("../db/schema.ts", import.meta.url), "utf8");
const spreadMigration = readFileSync(new URL("../drizzle/0003_moonlight_spread_catalog.sql", import.meta.url), "utf8");
const drawRoute = readFileSync(new URL("../app/api/tarot/draw/route.ts", import.meta.url), "utf8");
const interpretRoute = readFileSync(new URL("../app/api/tarot/interpret/route.ts", import.meta.url), "utf8");
const readingRoute = readFileSync(new URL("../app/api/tarot/reading/route.ts", import.meta.url), "utf8");
const readingRouteRuntime = readFileSync(new URL("../lib/tarot-reading-route.ts", import.meta.url), "utf8");
const interpretation = readFileSync(new URL("../lib/tarot-interpretation.ts", import.meta.url), "utf8");
const repository = readFileSync(new URL("../lib/tarot-repository.ts", import.meta.url), "utf8");

test("Drizzle schema declares every normalized Tarot table", () => {
  for (const table of [
    "decks", "tarotCards", "cardMeanings", "spreadCategories", "spreadTemplates",
    "spreadPositions", "readingSessions", "readingCards", "readings",
  ]) assert.match(schema, new RegExp(`export const ${table}\\s*=`));
});

test("migration creates the dynamic Tarot tables and uniqueness constraints", () => {
  const migration = readFileSync(new URL("../drizzle/0001_dynamic_tarot.sql", import.meta.url), "utf8");
  for (const table of ["decks", "tarot_cards", "card_meanings", "spread_categories", "spread_templates", "spread_positions", "reading_sessions", "reading_cards", "readings"]) {
    assert.match(migration, new RegExp(`CREATE TABLE[\\s\\S]*${table}`));
  }
  assert.match(migration, /CREATE UNIQUE INDEX `idx_card_meanings_variant` ON `card_meanings` \(`card_id`,`locale`,`orientation`\)/);
  assert.match(migration, /CREATE UNIQUE INDEX `idx_spread_positions_template_key` ON `spread_positions` \(`spread_template_id`,`position_key`\)/);
});

test("seed SQL is idempotent and contains every canonical card and meaning row", () => {
  const sql = buildSeedSql(buildTarotSeed(), 1700000000000);
  assert.equal((sql.match(/INSERT INTO `tarot_cards`/g) || []).length, 78);
  assert.equal((sql.match(/INSERT INTO `card_meanings`/g) || []).length, 312);
  assert.match(sql, /ON CONFLICT\(`id`\) DO UPDATE SET/);
  assert.match(sql, /BEGIN;[\s\S]*COMMIT;/);
});

test("catalog migration upgrades existing Room data with all Moonlight spread layouts", () => {
  assert.match(spreadMigration, /category-blank/);
  assert.match(spreadMigration, /category-everyday/);
  assert.match(spreadMigration, /category-self-care/);
  assert.match(spreadMigration, /'row-4'/);
  assert.match(spreadMigration, /'row-5'/);
  assert.match(spreadMigration, /'triangle'/);
  assert.match(spreadMigration, /'yes-no'/);
  assert.match(spreadMigration, /'celtic-cross'/);
  assert.doesNotMatch(spreadMigration, /DELETE FROM `spread_positions`/);
  assert.doesNotMatch(spreadMigration, /\bBEGIN(?: TRANSACTION)?;/);
  assert.doesNotMatch(spreadMigration, /\bCOMMIT;/);
  assert.match(spreadMigration, /WHERE `id`='spread-relationships-relationship-check-in-you'[\s\S]*`position_key`='us_right_now'/);
  assert.match(spreadMigration, /WHERE `id`='spread-relationships-relationship-check-in-connection'[\s\S]*`position_key`='needs_work'/);
  assert.match(spreadMigration, /WHERE `id`='spread-relationships-relationship-check-in-them'[\s\S]*`position_key`='can_help'/);
});

test("dynamic draw route returns session metadata and an array without fixed positions", () => {
  assert.match(drawRoute, /session_id/);
  assert.match(drawRoute, /cards: responseCards/);
  assert.match(drawRoute, /makeDrawPlan/);
  assert.match(drawRoute, /makeSelectedDrawPlan/);
  assert.match(drawRoute, /selected_cards/);
  assert.doesNotMatch(drawRoute, /portraitCard|obstacleCard|solutionCard/);
});

test("canonical reading route is guest-safe, provider-backed, and has one compatibility alias", () => {
  assert.match(readingRoute, /readOptionalOwner/);
  assert.match(readingRoute, /getTarotRepository/);
  assert.match(readingRoute, /generateTarotReading/);
  assert.match(readingRoute, /createTarotAIProvider/);
  assert.match(readingRoute, /runtimeEnv as unknown as Record/);
  assert.doesNotMatch(readingRoute, /cloudflare:workers/);
  assert.match(readingRoute, /handleTarotReadingRoute/);
  assert.match(readingRouteRuntime, /model_name/);
  assert.match(readingRouteRuntime, /prompt_version/);
  assert.match(readingRouteRuntime, /z\.enum\(\["en", "vi"\]\)/);
  assert.match(readingRoute, /logTarotReadingEvent/);
  assert.match(readingRouteRuntime, /cardCount/);
  assert.match(readingRouteRuntime, /reading\.cardEvidence\.length/);
  assert.match(readingRouteRuntime, /latencyMs/);
  assert.match(readingRouteRuntime, /failureCategory/);
  assert.doesNotMatch(readingRouteRuntime, /cloudflare:workers/);
  assert.doesNotMatch(`${readingRoute}\n${readingRouteRuntime}`, /console\.(?:info|warn|error)\([^\n]*(?:question|optionalContext|prompt|apiKey|rawBody|error\.message)/);
  assert.doesNotMatch(readingRoute, /buildLocalReading|TAROT_AI_URL|TAROT_AI_KEY/);
  assert.equal(interpretRoute.trim(), 'export { POST } from "@/app/api/tarot/reading/route";');
  assert.doesNotMatch(interpretRoute, /buildLocalReading|TAROT_AI_URL|TAROT_AI_KEY/);
  assert.match(interpretation, /disclaimer/);
  assert.match(repository, /getReadingTemplate/);
  assert.match(repository, /getMeaningPair/);
  assert.doesNotMatch(readingRoute, /portraitCard|obstacleCard|solutionCard/);
});

test("repository saves the V3 payload through legacy columns and the normalized payload column", () => {
  assert.doesNotMatch(repository, /input\.reading\.(?:overview|cards|connections|guidance|closing)/);
  assert.match(repository, /reading_payload/);
  assert.match(repository, /serializeLegacyReadingFields\(input\.reading\)/);
  assert.match(repository, /JSON\.stringify\(input\.reading\)/);
  assert.match(repository, /input\.modelName/);
  assert.match(repository, /input\.promptVersion/);
});

test("Node runtime exposes the SQLite database through the D1-shaped boundary", async (t) => {
  const directory = mkdtempSync(join(tmpdir(), "natarot-runtime-"));
  const databasePath = join(directory, "runtime.sqlite");
  const previousPath = process.env.NATAROT_DB_PATH;
  process.env.NATAROT_DB_PATH = databasePath;
  t.after(() => {
    if (previousPath === undefined) delete process.env.NATAROT_DB_PATH;
    else process.env.NATAROT_DB_PATH = previousPath;
    rmSync(directory, { recursive: true, force: true });
  });

  const runtime = await import(`${new URL("../lib/runtime.ts", import.meta.url).href}?test=${Date.now()}`);
  const database = runtime.getRuntimeDatabase();
  await database.prepare("CREATE TABLE runtime_probe (value TEXT NOT NULL)").run();
  await database.prepare("INSERT INTO runtime_probe (value) VALUES (?)").bind("node").run();
  const row = await database.prepare("SELECT value FROM runtime_probe").first() as { value: string } | null;
  assert.deepEqual(row, { value: "node" });
});
