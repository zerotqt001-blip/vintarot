import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";

const repoRoot = fileURLToPath(new URL("../", import.meta.url));

function createPreShareDatabase(dbPath: string): void {
  const sqlite = new DatabaseSync(dbPath);
  sqlite.exec("PRAGMA foreign_keys = ON; CREATE TABLE IF NOT EXISTS natarot_migrations (name TEXT PRIMARY KEY, applied_at INTEGER NOT NULL)");
  const migrationDirectory = join(repoRoot, "drizzle");
  const migrations = readdirSync(migrationDirectory)
    .filter((name) => /^\d{4}_.+\.sql$/.test(name) && !name.startsWith("0005_") && !name.startsWith("0006_"))
    .sort();
  for (const name of migrations) {
    sqlite.exec(readFileSync(join(migrationDirectory, name), "utf8"));
    sqlite.prepare("INSERT INTO natarot_migrations (name, applied_at) VALUES (?, ?)").run(name, Date.now());
  }
  sqlite.prepare("INSERT INTO members (id, username, email, phone, created_at, updated_at, disabled) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .run("member-legacy", "legacy_reader", "legacy@example.test", "", 1, 1, 0);
  sqlite.prepare("INSERT INTO reading_sessions (id, user_id, guest_id, question, optional_context, category_id, spread_template_id, spread_type, card_count, locale, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
    .run("session-legacy", "member-legacy", null, "A legacy question", "", "category-everyday", "spread-everyday-persona-obstacle-solution", "row-3", 3, "en", "complete", 1, 1);
  sqlite.prepare("INSERT INTO readings (id, session_id, opening, card_readings, synthesis, advice, closing, disclaimer, model_name, prompt_version, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
    .run("reading-legacy", "session-legacy", "opening", "[]", "synthesis", "advice", "closing", "disclaimer", "legacy-model", "legacy-prompt", 1, 1);
  sqlite.close();
}

test("Node migration bootstrap applies and repeats the full schema and seed", (t) => {
  const directory = mkdtempSync(join(tmpdir(), "natarot-migrate-"));
  const dbPath = join(directory, "natarot.sqlite");
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const env = { ...process.env, NATAROT_DB_PATH: dbPath };

  execFileSync(process.execPath, ["scripts/node-migrate.mjs"], { cwd: repoRoot, env, stdio: "pipe" });
  execFileSync(process.execPath, ["scripts/node-migrate.mjs"], { cwd: repoRoot, env, stdio: "pipe" });

  const sqlite = new DatabaseSync(dbPath);
  assert.equal((sqlite.prepare("SELECT COUNT(*) AS count FROM tarot_cards").get() as { count: number }).count, 78);
  assert.equal((sqlite.prepare("SELECT COUNT(*) AS count FROM card_meanings").get() as { count: number }).count, 312);
  assert.equal((sqlite.prepare("SELECT COUNT(*) AS count FROM natarot_migrations").get() as { count: number }).count, 8);
  assert.deepEqual(
    sqlite.prepare("SELECT name FROM natarot_migrations ORDER BY name").all().map((row) => row.name),
    [
      "0000_vengeful_ben_urich.sql",
      "0001_dynamic_tarot.sql",
      "0002_tarot_seed.sql",
      "0003_moonlight_spread_catalog.sql",
      "0004_member_auth.sql",
      "0004_reading_payload.sql",
      "0005_natarot_share_persistence.sql",
      "0006_credits_vip.sql",
    ],
  );
  const columns = sqlite.prepare("PRAGMA table_info(readings)").all() as Array<{ name: string }>;
  assert.ok(columns.some((column) => column.name === "reading_payload"));
  for (const table of ["reading_shares", "share_events"]) {
    assert.equal(
      (sqlite.prepare("SELECT COUNT(*) AS count FROM sqlite_master WHERE type='table' AND name=?").get(table) as {
        count: number;
      }).count,
      1,
    );
  }
  const shareIndexes = sqlite.prepare("PRAGMA index_list('reading_shares')").all() as Array<{ name: string; unique: number; partial: number }>;
  assert.ok(shareIndexes.some((index) => index.name === "reading_shares_token_hash_unique" && index.unique === 1));
  assert.ok(shareIndexes.some((index) => index.name === "reading_shares_active_reading_unique" && index.unique === 1 && index.partial === 1));
  const shareColumns = sqlite.prepare("PRAGMA table_info('reading_shares')").all() as Array<{ name: string }>;
  assert.ok(shareColumns.some((column) => column.name === "token_hash"));
  assert.ok(!shareColumns.some((column) => column.name === "token" || column.name === "owner" || column.name === "user_id" || column.name === "guest_id"));
  const shareSql = (sqlite.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='reading_shares'").get() as { sql: string }).sql;
  const eventSql = (sqlite.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='share_events'").get() as { sql: string }).sql;
  assert.match(shareSql, /`status`\s+IN\s*\('active',\s*'revoked',\s*'expired'\)/i);
  assert.ok(eventSql.includes("CHECK (`event_name` IN ('share_created', 'share_opened', 'share_image_generated', 'share_image_downloaded', 'share_cta_clicked'))"));
  const shareForeignKeys = sqlite.prepare("PRAGMA foreign_key_list('reading_shares')").all() as Array<{ table: string; on_delete: string }>;
  assert.ok(shareForeignKeys.some((foreignKey) => foreignKey.table === "readings" && foreignKey.on_delete.toUpperCase() === "CASCADE"));
  const eventForeignKeys = sqlite.prepare("PRAGMA foreign_key_list('share_events')").all() as Array<{ table: string; on_delete: string }>;
  assert.ok(eventForeignKeys.some((foreignKey) => foreignKey.table === "reading_shares" && foreignKey.on_delete.toUpperCase() === "CASCADE"));
  for (const table of ["members", "auth_sessions", "auth_tokens", "oauth_states"]) {
    assert.equal(
      (sqlite.prepare("SELECT COUNT(*) AS count FROM sqlite_master WHERE type='table' AND name=?").get(table) as {
        count: number;
      }).count,
      1,
    );
  }
  for (const table of [
    "credit_accounts",
    "credit_grants",
    "credit_ledger",
    "credit_reservations",
    "credit_reservation_allocations",
    "packages",
    "package_versions",
    "orders",
    "entitlements",
    "order_fulfillments",
    "commercial_events",
  ]) {
    assert.equal(
      (sqlite.prepare("SELECT COUNT(*) AS count FROM sqlite_master WHERE type='table' AND name=?").get(table) as {
        count: number;
      }).count,
      1,
      `expected ${table} to exist`,
    );
  }
  const creditAccountIndexes = sqlite.prepare("PRAGMA index_list('credit_accounts')").all() as Array<{ name: string; unique: number }>;
  assert.ok(creditAccountIndexes.some((index) => index.name === "credit_accounts_owner_unique" && index.unique === 1));
  const reservationIndexes = sqlite.prepare("PRAGMA index_list('credit_reservations')").all() as Array<{ name: string; unique: number }>;
  assert.ok(reservationIndexes.some((index) => index.name === "credit_reservations_owner_key_unique" && index.unique === 1));
  const grantSql = (sqlite.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='credit_grants'").get() as { sql: string }).sql;
  assert.match(grantSql, /`available_units`\s+INTEGER\s+NOT NULL/i);
  assert.match(grantSql, /CHECK\s*\(`available_units`\s*>=\s*0\s+AND\s+`available_units`\s*<=\s*`units`\)/i);
  const ledgerSql = (sqlite.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='credit_ledger'").get() as { sql: string }).sql;
  assert.match(ledgerSql, /`units`\s+INTEGER\s+NOT NULL/i);
  assert.match(ledgerSql, /CHECK\s*\(`units`\s*<>\s*0\)/i);
  assert.deepEqual(sqlite.prepare("PRAGMA foreign_key_check").all(), []);
  sqlite.close();
});

test("Node migration upgrades an existing pre-share database without losing member or reading data", (t) => {
  const directory = mkdtempSync(join(tmpdir(), "natarot-migrate-upgrade-"));
  const dbPath = join(directory, "natarot.sqlite");
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  createPreShareDatabase(dbPath);

  execFileSync(process.execPath, ["scripts/node-migrate.mjs"], {
    cwd: repoRoot,
    env: { ...process.env, NATAROT_DB_PATH: dbPath },
    stdio: "pipe",
  });

  const sqlite = new DatabaseSync(dbPath);
  assert.deepEqual(
    sqlite.prepare("SELECT id, username FROM members").all().map(({ id, username }) => ({ id, username })),
    [{ id: "member-legacy", username: "legacy_reader" }],
  );
  assert.deepEqual(
    sqlite.prepare("SELECT id, session_id FROM readings").all().map(({ id, session_id }) => ({ id, session_id })),
    [{ id: "reading-legacy", session_id: "session-legacy" }],
  );
  assert.equal((sqlite.prepare("SELECT COUNT(*) AS count FROM natarot_migrations WHERE name LIKE '0005_%'").get() as { count: number }).count, 1);
  assert.equal((sqlite.prepare("SELECT COUNT(*) AS count FROM natarot_migrations WHERE name LIKE '0006_%'").get() as { count: number }).count, 1);
  assert.equal((sqlite.prepare("SELECT COUNT(*) AS count FROM reading_shares").get() as { count: number }).count, 0);
  assert.equal((sqlite.prepare("SELECT COUNT(*) AS count FROM credit_accounts").get() as { count: number }).count, 0);
  assert.deepEqual(sqlite.prepare("PRAGMA foreign_key_check").all(), []);
  sqlite.close();
});
