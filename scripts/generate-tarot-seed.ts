import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { buildTarotSeed, validateTarotSeed } from "../db/tarot-seed";
import type { TarotSeed } from "../lib/tarot-catalog";

type SqlValue = string | number | boolean | null;

function quote(value: SqlValue): string {
  if (value === null) return "NULL";
  if (typeof value === "boolean") return value ? "1" : "0";
  if (typeof value === "number") return String(value);
  return `'${value.replace(/'/g, "''")}'`;
}

function upsert(table: string, columns: string[], values: SqlValue[]): string {
  const names = columns.map((column) => `\`${column}\``).join(",");
  const assignments = columns.slice(1).map((column) => `\`${column}\`=excluded.\`${column}\``).join(",");
  return `INSERT INTO \`${table}\` (${names}) VALUES (${values.map(quote).join(",")}) ON CONFLICT(\`id\`) DO UPDATE SET ${assignments};`;
}

export function buildSeedSql(seed: TarotSeed, now = Date.now()): string {
  validateTarotSeed(seed);
  const statements: string[] = ["PRAGMA foreign_keys=ON;", "BEGIN;"];

  statements.push(upsert("decks", ["id", "slug", "name", "artist", "description", "active", "created_at", "updated_at"], [seed.deck.id, seed.deck.slug, seed.deck.name, seed.deck.artist, seed.deck.description, true, now, now]));

  for (const category of seed.categories) {
    statements.push(upsert("spread_categories", ["id", "slug", "name_en", "name_vi", "description_en", "description_vi", "icon", "image_url", "display_order", "active", "created_at", "updated_at"], [category.id, category.slug, category.name.en, category.name.vi, category.description.en, category.description.vi, category.icon, category.imageUrl, category.displayOrder, category.active, now, now]));
  }

  for (const template of seed.templates) {
    statements.push(upsert("spread_templates", ["id", "category_id", "slug", "name_en", "name_vi", "description_en", "description_vi", "card_count", "spread_type", "display_order", "active", "created_at", "updated_at"], [template.id, template.categoryId, template.slug, template.name.en, template.name.vi, template.description.en, template.description.vi, template.cardCount, template.spreadType, template.displayOrder, template.active, now, now]));
  }

  for (const position of seed.positions) {
    statements.push(upsert("spread_positions", ["id", "spread_template_id", "position_key", "position_order", "label_en", "label_vi", "description_en", "description_vi", "prompt_en", "prompt_vi", "created_at", "updated_at"], [position.id, position.templateId, position.key, position.order, position.label.en, position.label.vi, position.description.en, position.description.vi, position.prompt.en, position.prompt.vi, now, now]));
  }

  for (const card of seed.cards) {
    statements.push(upsert("tarot_cards", ["id", "deck_id", "card_number", "slug", "name_en", "name_vi", "arcana", "suit", "image_url", "display_order", "created_at", "updated_at"], [card.id, card.deckId, card.cardNumber, card.slug, card.nameEn, card.nameVi, card.arcana, card.suit, card.imageUrl, card.displayOrder, now, now]));
  }

  for (const meaning of seed.meanings) {
    statements.push(upsert("card_meanings", ["id", "card_id", "locale", "orientation", "summary", "energy", "actions", "relationships", "work", "creativity", "home", "symbolism", "journal_questions", "keywords", "created_at", "updated_at"], [meaning.id, meaning.cardId, meaning.locale, meaning.orientation, meaning.summary, meaning.energy, meaning.actions, meaning.relationships, meaning.work, meaning.creativity, meaning.home, meaning.symbolism, JSON.stringify(meaning.journalQuestions), meaning.keywords, now, now]));
  }

  statements.push("COMMIT;");
  return `${statements.join("\n")}\n`;
}

/** Build an idempotent catalog-only migration for an already seeded database. */
export function buildSpreadCatalogMigrationSql(seed: TarotSeed, now = Date.now()): string {
  validateTarotSeed(seed);
  const statements: string[] = [];
  const legacyTemplateIds = [
    "spread-planning-one-small-step",
    "spread-moon-phase-three-card-insight",
    "spread-creativity-social-battery-check",
    "spread-business-past-present-future",
    "spread-fools-journey-celtic-cross",
  ];
  const legacyPositionIds: Record<string, string> = {
    "spread-relationships-relationship-check-in-us_right_now": "spread-relationships-relationship-check-in-you",
    "spread-relationships-relationship-check-in-needs_work": "spread-relationships-relationship-check-in-connection",
    "spread-relationships-relationship-check-in-can_help": "spread-relationships-relationship-check-in-them",
  };
  statements.push(`UPDATE \`spread_templates\` SET \`active\`=0,\`updated_at\`=${now} WHERE \`id\` IN (${legacyTemplateIds.map((id) => quote(id)).join(",")});`);

  for (const category of seed.categories) {
    statements.push(upsert("spread_categories", ["id", "slug", "name_en", "name_vi", "description_en", "description_vi", "icon", "image_url", "display_order", "active", "created_at", "updated_at"], [category.id, category.slug, category.name.en, category.name.vi, category.description.en, category.description.vi, category.icon, category.imageUrl, category.displayOrder, category.active, now, now]));
  }
  for (const template of seed.templates) {
    statements.push(upsert("spread_templates", ["id", "category_id", "slug", "name_en", "name_vi", "description_en", "description_vi", "card_count", "spread_type", "display_order", "active", "created_at", "updated_at"], [template.id, template.categoryId, template.slug, template.name.en, template.name.vi, template.description.en, template.description.vi, template.cardCount, template.spreadType, template.displayOrder, template.active, now, now]));
  }
  for (const position of seed.positions) {
    const columns = ["id", "spread_template_id", "position_key", "position_order", "label_en", "label_vi", "description_en", "description_vi", "prompt_en", "prompt_vi", "created_at", "updated_at"];
    const values: SqlValue[] = [position.id, position.templateId, position.key, position.order, position.label.en, position.label.vi, position.description.en, position.description.vi, position.prompt.en, position.prompt.vi, now, now];
    const legacyPositionId = legacyPositionIds[position.id];
    if (!legacyPositionId) {
      statements.push(upsert("spread_positions", columns, values));
      continue;
    }

    const assignments = columns.slice(1).map((column, index) => `\`${column}\`=${quote(values[index + 1])}`).join(",");
    const naturalConflict = (candidateId: string) => `NOT EXISTS (SELECT 1 FROM \`spread_positions\` WHERE \`spread_template_id\`=${quote(position.templateId)} AND (\`position_key\`=${quote(position.key)} OR \`position_order\`=${position.order}) AND \`id\`<>${quote(candidateId)})`;
    statements.push(`UPDATE \`spread_positions\` SET ${assignments} WHERE \`id\`=${quote(position.id)} AND NOT EXISTS (SELECT 1 FROM \`spread_positions\` WHERE \`id\`=${quote(legacyPositionId)}) AND ${naturalConflict(position.id)};`);
    statements.push(`UPDATE \`spread_positions\` SET ${assignments} WHERE \`id\`=${quote(legacyPositionId)} AND NOT EXISTS (SELECT 1 FROM \`spread_positions\` WHERE \`id\`=${quote(position.id)}) AND ${naturalConflict(legacyPositionId)};`);
    statements.push(`INSERT INTO \`spread_positions\` (${columns.map((column) => `\`${column}\``).join(",")}) SELECT ${values.map(quote).join(",")} WHERE NOT EXISTS (SELECT 1 FROM \`spread_positions\` WHERE \`id\` IN (${quote(position.id)},${quote(legacyPositionId)})) AND NOT EXISTS (SELECT 1 FROM \`spread_positions\` WHERE \`spread_template_id\`=${quote(position.templateId)} AND (\`position_key\`=${quote(position.key)} OR \`position_order\`=${position.order}));`);
  }
  return `${statements.join("\n")}\n`;
}

function outputPath(args: string[]): string | null {
  const index = args.indexOf("--out");
  if (index === -1) return null;
  const value = args[index + 1];
  if (!value) throw new Error("--out requires a file path");
  return resolve(value);
}

async function main(): Promise<void> {
  const sql = buildSeedSql(buildTarotSeed());
  const target = outputPath(process.argv.slice(2));
  if (target) {
    await writeFile(target, sql, "utf8");
    return;
  }
  process.stdout.write(sql);
}

const entrypoint = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : "";
if (import.meta.url === entrypoint) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
