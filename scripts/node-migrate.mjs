import { mkdirSync, readdirSync, readFileSync, realpathSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));
const migrationDirectory = join(projectRoot, "drizzle");
const databasePath = process.env.NATAROT_DB_PATH?.trim() || "/var/lib/natarot/natarot.sqlite";

export function applyMigration(sqlite, name, sql, appliedAt = Date.now()) {
  if (/\bBEGIN(?:\s+(?:DEFERRED|IMMEDIATE|EXCLUSIVE))?\s*;/i.test(sql)) {
    // Preserve the transaction boundary owned by the historical seed migration.
    sqlite.exec(sql);
    sqlite.prepare("INSERT INTO natarot_migrations (name, applied_at) VALUES (?, ?)").run(name, appliedAt);
    return;
  }
  sqlite.exec("BEGIN IMMEDIATE;");
  try {
    sqlite.exec(sql);
    sqlite.prepare("INSERT INTO natarot_migrations (name, applied_at) VALUES (?, ?)").run(name, appliedAt);
    sqlite.exec("COMMIT;");
  } catch (error) {
    try {
      sqlite.exec("ROLLBACK;");
    } catch {
      // Preserve the original migration error if rollback itself cannot run.
    }
    throw error;
  }
}

export function runMigrations() {
  mkdirSync(dirname(databasePath), { recursive: true, mode: 0o700 });
  const sqlite = new DatabaseSync(databasePath);

  try {
    sqlite.exec("PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;");
    sqlite.exec("CREATE TABLE IF NOT EXISTS natarot_migrations (name TEXT PRIMARY KEY, applied_at INTEGER NOT NULL)");

    const applied = new Set(
      sqlite.prepare("SELECT name FROM natarot_migrations ORDER BY name").all().map((row) => String(row.name)),
    );
    const migrations = readdirSync(migrationDirectory)
      .filter((name) => /^\d{4}_.+\.sql$/.test(name))
      .sort();

    for (const name of migrations) {
      if (applied.has(name)) continue;
      applyMigration(sqlite, name, readFileSync(join(migrationDirectory, name), "utf8"));
      console.log(`Applied ${name}`);
    }
  } finally {
    sqlite.close();
  }
}

if (process.argv[1] && realpathSync(resolve(process.argv[1])) === realpathSync(fileURLToPath(import.meta.url))) runMigrations();
