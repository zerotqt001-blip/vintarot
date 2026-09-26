import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { existsSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { readFileSync } from "node:fs";
import test, { type TestContext } from "node:test";

type OpenExistingDatabase = (path: string) => DatabaseSync;
type AssertExpectedMount = (path: string, readMount: (path: string) => string) => void;

const repoRoot = join(import.meta.dirname, "..");
const migrations = [
  "0000_vengeful_ben_urich.sql",
  "0001_dynamic_tarot.sql",
  "0002_tarot_seed.sql",
  "0003_moonlight_spread_catalog.sql",
  "0004_member_auth.sql",
  "0004_reading_payload.sql",
  "0005_natarot_share_persistence.sql",
  "0006_credits_vip.sql",
  "0007_backend_completion.sql",
];

function createDirectory(context: TestContext): string {
  const directory = mkdtempSync(join(tmpdir(), "natarot-first-owner-db-"));
  context.after(() => rmSync(directory, { recursive: true, force: true }));
  return directory;
}

async function loadOpener(): Promise<OpenExistingDatabase> {
  const importFile = new Function("specifier", "return import(specifier)") as (specifier: string) => Promise<Record<string, unknown>>;
  const moduleUrl = new URL("../lib/owner-bootstrap/database.ts", import.meta.url).href;
  const loaded = await importFile(moduleUrl).catch(() => null);
  const open = loaded?.openExistingFirstOwnerDatabase;
  assert.equal(typeof open, "function", "the no-create production database opener should exist");
  return open as OpenExistingDatabase;
}

async function loadMountCheck(): Promise<AssertExpectedMount> {
  const importFile = new Function("specifier", "return import(specifier)") as (specifier: string) => Promise<Record<string, unknown>>;
  const moduleUrl = new URL("../lib/owner-bootstrap/database.ts", import.meta.url).href;
  const loaded = await importFile(moduleUrl).catch(() => null);
  const check = loaded?.assertFirstOwnerDatabaseMount;
  assert.equal(typeof check, "function", "the production data mount check should exist");
  return check as AssertExpectedMount;
}

test("first-owner database opener refuses missing production files without creating them", async (context) => {
  const openExistingFirstOwnerDatabase = await loadOpener();
  const path = join(createDirectory(context), "missing.sqlite");

  assert.throws(() => openExistingFirstOwnerDatabase(path), /production database/i);
  assert.equal(existsSync(path), false);
});

test("first-owner database opener rejects blank databases and non-file paths without modifying them", async (context) => {
  const openExistingFirstOwnerDatabase = await loadOpener();
  const directory = createDirectory(context);
  const blankDatabasePath = join(directory, "blank.sqlite");
  const blank = new DatabaseSync(blankDatabasePath);
  blank.close();

  assert.throws(() => openExistingFirstOwnerDatabase(blankDatabasePath), /production database/i);
  assert.equal(new DatabaseSync(blankDatabasePath, { readOnly: true }).prepare("PRAGMA quick_check").get() !== null, true);
  assert.throws(() => openExistingFirstOwnerDatabase(directory), /production database/i);

  const symlinkPath = join(directory, "linked.sqlite");
  symlinkSync(blankDatabasePath, symlinkPath);
  assert.throws(() => openExistingFirstOwnerDatabase(symlinkPath), /production database/i);
});

test("first-owner database opener accepts only an intact existing NaTarot auth and audit schema", async (context) => {
  const openExistingFirstOwnerDatabase = await loadOpener();
  const path = join(createDirectory(context), "production.sqlite");
  const fixture = new DatabaseSync(path);
  for (const migration of migrations) fixture.exec(readFileSync(join(repoRoot, "drizzle", migration), "utf8"));
  fixture.close();

  const database = openExistingFirstOwnerDatabase(path);
  try {
    const integrity = database.prepare("PRAGMA quick_check").get() as { quick_check: string };
    assert.equal(integrity.quick_check, "ok");
    assert.equal(Number((database.prepare("SELECT COUNT(*) AS count FROM members").get() as { count: number }).count), 0);
  } finally {
    database.close();
  }

  const verifyKeyPath = new DatabaseSync(path);
  verifyKeyPath.exec("DROP INDEX audit_events_idempotency_unique");
  verifyKeyPath.close();
  assert.throws(() => openExistingFirstOwnerDatabase(path), /production database/i);

  writeFileSync(path, "not-a-sqlite-database");
  assert.throws(() => openExistingFirstOwnerDatabase(path), /production database/i);
});

test("first-owner database mount check accepts only the audited ext4 root mount", async () => {
  const assertFirstOwnerDatabaseMount = await loadMountCheck();
  assert.doesNotThrow(() => assertFirstOwnerDatabaseMount("/var/lib/natarot/natarot.sqlite", () => "/ ext4\n"));
  assert.throws(() => assertFirstOwnerDatabaseMount("/var/lib/natarot/natarot.sqlite", () => "/var/lib/natarot ext4\n"), /production storage mount/i);
  assert.throws(() => assertFirstOwnerDatabaseMount("/var/lib/natarot/natarot.sqlite", () => "/ overlay\n"), /production storage mount/i);
});
