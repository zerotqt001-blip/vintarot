import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { buildSeedSql } from "../scripts/generate-tarot-seed";
import { buildTarotSeed } from "../db/tarot-seed";

const schema = readFileSync(new URL("../db/schema.ts", import.meta.url), "utf8");
const drawRoute = readFileSync(new URL("../app/api/tarot/draw/route.ts", import.meta.url), "utf8");

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

test("dynamic draw route returns session metadata and an array without fixed positions", () => {
  assert.match(drawRoute, /session_id/);
  assert.match(drawRoute, /cards: responseCards/);
  assert.match(drawRoute, /makeDrawPlan/);
  assert.doesNotMatch(drawRoute, /portraitCard|obstacleCard|solutionCard/);
});
