import { DatabaseSync } from "node:sqlite";
import { provisionFirstOwner } from "../lib/owner-bootstrap/provision";
import { readFirstOwnerOperatorInput } from "../lib/owner-bootstrap/operator";
import { createSqliteD1Database, type SqliteConnection, type TransactionalD1Database } from "../lib/sqlite-d1";

async function main(): Promise<void> {
  const { databasePath, input } = readFirstOwnerOperatorInput(
    process.env,
    process.getuid?.() ?? null,
    process.env.NODE_ENV,
  );
  let sqlite: DatabaseSync | undefined;

  try {
    sqlite = new DatabaseSync(databasePath);
    sqlite.exec("PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;");
    const database = createSqliteD1Database(sqlite as unknown as SqliteConnection) as TransactionalD1Database;
    await provisionFirstOwner(database, input);
    console.log("First Owner provisioning completed; prior Owner sessions were invalidated.");
  } finally {
    sqlite?.close();
  }
}

try {
  await main();
} catch {
  console.error("First Owner provisioning failed. Review the server-side audit record and operator evidence.");
  process.exitCode = 1;
}
