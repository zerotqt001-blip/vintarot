#!/usr/bin/env node

import { DatabaseSync } from "node:sqlite";
import { existsSync, mkdirSync, rmSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";

const [, , sourceArgument, destinationArgument] = process.argv;

if (!sourceArgument || !destinationArgument) {
  throw new Error("usage: natarot-sqlite-backup.mjs SOURCE_DB DESTINATION_DB");
}

const source = resolve(sourceArgument);
const destination = resolve(destinationArgument);

if (!existsSync(source)) {
  throw new Error(`source database does not exist: ${source}`);
}
if (existsSync(destination)) {
  throw new Error(`destination already exists: ${destination}`);
}

mkdirSync(dirname(destination), { recursive: true, mode: 0o700 });

function sqlIdentifier(value) {
  return `"${String(value).replaceAll('"', '""')}"`;
}

function metadata(database) {
  const integrity = database.prepare("PRAGMA integrity_check").get().integrity_check;
  const foreignKeyViolations = database.prepare("PRAGMA foreign_key_check").all().length;
  const tables = database
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
    .all()
    .map((row) => String(row.name));
  const rowCounts = Object.fromEntries(
    tables.map((table) => [table, Number(database.prepare(`SELECT count(*) AS count FROM ${sqlIdentifier(table)}`).get().count)]),
  );
  const journalMode = database.prepare("PRAGMA journal_mode").get().journal_mode;
  return {
    integrity: String(integrity),
    foreignKeyViolations,
    tables: tables.length,
    tableNames: tables,
    migrations: rowCounts.natarot_migrations ?? null,
    rowCounts,
    journalMode: String(journalMode),
  };
}

let sourceDatabase;
let destinationDatabase;
let completed = false;
try {
  sourceDatabase = new DatabaseSync(source);
  const sourceMetadata = metadata(sourceDatabase);
  if (sourceMetadata.integrity !== "ok") {
    throw new Error(`source database integrity check failed: ${sourceMetadata.integrity}`);
  }
  if (sourceMetadata.foreignKeyViolations !== 0) {
    throw new Error(`source database has ${sourceMetadata.foreignKeyViolations} foreign-key violations`);
  }
  if (sourceMetadata.tables === 0) {
    throw new Error("source database has no application tables");
  }

  const escapedDestination = destination.replaceAll("'", "''");
  sourceDatabase.exec(`VACUUM INTO '${escapedDestination}'`);
  sourceDatabase.close();
  sourceDatabase = undefined;

  destinationDatabase = new DatabaseSync(destination, { readOnly: true });
  const destinationMetadata = metadata(destinationDatabase);
  if (destinationMetadata.integrity !== "ok") {
    throw new Error(`destination database integrity check failed: ${destinationMetadata.integrity}`);
  }
  if (destinationMetadata.foreignKeyViolations !== 0) {
    throw new Error(`destination database has ${destinationMetadata.foreignKeyViolations} foreign-key violations`);
  }
  if (destinationMetadata.tables === 0) {
    throw new Error("destination database has no application tables");
  }

  console.log(
    JSON.stringify({
      source: { path: source, ...sourceMetadata },
      destination: { path: destination, bytes: statSync(destination).size, ...destinationMetadata },
    }),
  );
  completed = true;
} finally {
  destinationDatabase?.close();
  sourceDatabase?.close();
  if (!completed && existsSync(destination)) rmSync(destination, { force: true });
}
