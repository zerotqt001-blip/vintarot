import { execFileSync } from "node:child_process";
import { lstatSync, realpathSync, statSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";

const REQUIRED_COLUMNS: Record<string, string[]> = {
  members: ["id", "email", "password_hash", "email_verified_at", "role", "disabled", "disabled_at", "updated_at"],
  auth_tokens: ["member_id", "kind", "consumed_at"],
  auth_sessions: ["member_id", "revoked_at"],
  audit_events: ["id", "actor_kind", "actor_id", "action", "target_type", "target_id", "reason", "idempotency_key", "outcome", "metadata_json", "created_at"],
};

function invalidProductionDatabase(): Error {
  return new Error("Production database validation failed.");
}

function validateDatabaseSchema(database: DatabaseSync): void {
  const integrity = database.prepare("PRAGMA quick_check").get() as { quick_check?: unknown } | undefined;
  if (integrity?.quick_check !== "ok") throw invalidProductionDatabase();

  for (const [table, requiredColumns] of Object.entries(REQUIRED_COLUMNS)) {
    const columns = database.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name?: unknown }>;
    const available = new Set(columns.map((column) => column.name).filter((name): name is string => typeof name === "string"));
    if (requiredColumns.some((column) => !available.has(column))) throw invalidProductionDatabase();
  }

  const idempotencyIndexes = database.prepare("PRAGMA index_list(audit_events)").all() as Array<{ name?: unknown; unique?: unknown }>;
  const hasUniqueIdempotencyIndex = idempotencyIndexes.some((index) => {
    if (index.unique !== 1 || typeof index.name !== "string") return false;
    const escapedName = index.name.replaceAll('"', '""');
    const indexedColumns = database.prepare(`PRAGMA index_info("${escapedName}")`).all() as Array<{ name?: unknown }>;
    return indexedColumns.length === 1 && indexedColumns[0]?.name === "idempotency_key";
  });
  if (!hasUniqueIdempotencyIndex) throw invalidProductionDatabase();
}

function sameFile(path: string, expected: { dev: number; ino: number }): boolean {
  const actual = lstatSync(path);
  return actual.isFile() && actual.dev === expected.dev && actual.ino === expected.ino;
}

export function openExistingFirstOwnerDatabase(path: string): DatabaseSync {
  let realPath: string;
  let initialFile: ReturnType<typeof lstatSync>;
  try {
    initialFile = lstatSync(path);
    const parentDirectory = lstatSync(dirname(realpathSync(path)));
    if (!initialFile.isFile()
      || initialFile.size <= 0
      || (initialFile.mode & 0o022) !== 0
      || !parentDirectory.isDirectory()
      || (parentDirectory.mode & 0o022) !== 0) throw invalidProductionDatabase();
    realPath = realpathSync(path);
  } catch {
    throw invalidProductionDatabase();
  }

  let readOnly: DatabaseSync | undefined;
  try {
    readOnly = new DatabaseSync(realPath, { readOnly: true });
    validateDatabaseSchema(readOnly);
  } catch {
    readOnly?.close();
    throw invalidProductionDatabase();
  }
  readOnly.close();

  let database: DatabaseSync | undefined;
  try {
    if (!sameFile(path, initialFile) || realpathSync(path) !== realPath) throw invalidProductionDatabase();
    // Supported Node 22 releases treat location as a file path and expose no writable no-CREATE flag.
    // The read-only preflight, protected parent directory, and inode checks prevent a missing or replaced DB from being accepted.
    database = new DatabaseSync(realPath);
    const currentFile = statSync(realPath);
    if (!sameFile(path, initialFile) || realpathSync(path) !== realPath || currentFile.dev !== initialFile.dev || currentFile.ino !== initialFile.ino) {
      throw invalidProductionDatabase();
    }
    database.exec("PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;");
    validateDatabaseSchema(database);
    return database;
  } catch {
    database?.close();
    throw invalidProductionDatabase();
  }
}

export function assertFirstOwnerDatabaseMount(
  path: string,
  readMount: (path: string) => string = (target) => execFileSync(
    "/usr/bin/findmnt",
    ["--target", target, "--noheadings", "--output", "TARGET,FSTYPE"],
    { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], timeout: 5_000 },
  ),
): void {
  try {
    const mount = readMount(path).trim().split(/\s+/);
    if (mount.length !== 2 || mount[0] !== "/" || mount[1] !== "ext4") throw invalidProductionDatabase();
  } catch {
    throw new Error("Production storage mount validation failed.");
  }
}
