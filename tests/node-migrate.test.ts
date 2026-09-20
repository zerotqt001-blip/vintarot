import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";

const repoRoot = fileURLToPath(new URL("../", import.meta.url));

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
  assert.equal((sqlite.prepare("SELECT COUNT(*) AS count FROM natarot_migrations").get() as { count: number }).count, 7);
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
  assert.deepEqual(sqlite.prepare("PRAGMA foreign_key_check").all(), []);
  sqlite.close();
});
