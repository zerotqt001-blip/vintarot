import { mkdirSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));
const migrationDirectory = join(projectRoot, "drizzle");
const databasePath = process.env.NATAROT_DB_PATH?.trim() || "/var/lib/natarot/natarot.sqlite";

mkdirSync(dirname(databasePath), { recursive: true, mode: 0o700 });
const sqlite = new DatabaseSync(databasePath);

try {
  sqlite.exec("PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;");
  sqlite.exec("CREATE TABLE IF NOT EXISTS natarot_migrations (name TEXT PRIMARY KEY, applied_at INTEGER NOT NULL)");

  const applied = new Set(
    sqlite.prepare("SELECT name FROM natarot_migrations ORDER BY name").all().map((row) => String(row.name)),
  );
  const migrations = readdirSync(migrationDirectory)
    .filter((name) => /^000[0-4]_.+\.sql$/.test(name))
    .sort();

  for (const name of migrations) {
    if (applied.has(name)) continue;
    sqlite.exec(readFileSync(join(migrationDirectory, name), "utf8"));
    sqlite.prepare("INSERT INTO natarot_migrations (name, applied_at) VALUES (?, ?)").run(name, Date.now());
    console.log(`Applied ${name}`);
  }
} finally {
  sqlite.close();
}
