import type { DatabaseSync } from "node:sqlite";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { provisionFirstOwner } from "../lib/owner-bootstrap/provision";
import { confirmFirstOwnerEvidence, readFirstOwnerOperatorInput } from "../lib/owner-bootstrap/operator";
import { FIRST_OWNER_BACKUP_ROOT, FIRST_OWNER_FINAL_BACKUP_MAX_AGE_MS, runFirstOwnerBackupManagerVerifier, verifyFirstOwnerBackupEvidence } from "../lib/owner-bootstrap/backup-verification";
import { assertFirstOwnerDatabaseMount, openExistingFirstOwnerDatabase } from "../lib/owner-bootstrap/database";
import { createSqliteD1Database, type SqliteConnection, type TransactionalD1Database } from "../lib/sqlite-d1";

async function main(): Promise<void> {
  const { databasePath, input } = readFirstOwnerOperatorInput(
    process.env,
    process.getuid?.() ?? null,
    process.env.NODE_ENV,
  );
  let sqlite: DatabaseSync | undefined;
  let terminal: ReturnType<typeof createInterface> | undefined;

  try {
    if (!stdin.isTTY || !stdout.isTTY) throw new Error("First-owner provisioning requires interactive human review.");
    terminal = createInterface({ input: stdin, output: stdout });
    await verifyFirstOwnerBackupEvidence(input, {
      backupRoot: FIRST_OWNER_BACKUP_ROOT,
      now: Date.now,
      runManagerVerifier: runFirstOwnerBackupManagerVerifier,
    });
    await confirmFirstOwnerEvidence(input, (prompt) => terminal!.question(`${prompt}: `));
    assertFirstOwnerDatabaseMount(databasePath);
    sqlite = openExistingFirstOwnerDatabase(databasePath);
    const database = createSqliteD1Database(sqlite as unknown as SqliteConnection) as TransactionalD1Database;
    await verifyFirstOwnerBackupEvidence(input, {
      backupRoot: FIRST_OWNER_BACKUP_ROOT,
      now: Date.now,
      maxBackupAgeMs: FIRST_OWNER_FINAL_BACKUP_MAX_AGE_MS,
      runManagerVerifier: runFirstOwnerBackupManagerVerifier,
    });
    await provisionFirstOwner(database, input);
    console.log("First Owner provisioning completed; prior Owner sessions were invalidated.");
  } finally {
    terminal?.close();
    sqlite?.close();
  }
}

try {
  await main();
} catch {
  console.error("First Owner provisioning failed. Review the server-side audit record and operator evidence.");
  process.exitCode = 1;
}
