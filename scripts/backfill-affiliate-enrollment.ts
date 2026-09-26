import { DatabaseSync } from "node:sqlite";
import { backfillAffiliateEnrollment } from "../lib/affiliate/enrollment";
import { createSqliteD1Database, type SqliteConnection } from "../lib/sqlite-d1";

const productionDatabasePath = "/var/lib/natarot/natarot.sqlite";
const configuredDatabasePath = process.env.NATAROT_DB_PATH?.trim() ?? "";

if (process.env.NATAROT_AFFILIATE_BACKFILL !== "1") {
  throw new Error("Refusing Affiliate backfill without NATAROT_AFFILIATE_BACKFILL=1");
}
if (process.env.NODE_ENV !== "production") {
  throw new Error("Refusing Affiliate backfill unless NODE_ENV=production");
}
if (configuredDatabasePath !== productionDatabasePath || /staging|test/i.test(configuredDatabasePath)) {
  throw new Error("Refusing Affiliate backfill outside /var/lib/natarot/natarot.sqlite");
}

const sqlite = new DatabaseSync(productionDatabasePath);

try {
  sqlite.exec("PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;");
  const database = createSqliteD1Database(sqlite as unknown as SqliteConnection);
  const summary = await backfillAffiliateEnrollment({ database });
  console.log(JSON.stringify(summary));
} finally {
  sqlite.close();
}
