import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { DatabaseSync } from "node:sqlite";
import { mkdtempSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";

const repoRoot = fileURLToPath(new URL("../", import.meta.url));

test("reporting migration adds isolated job state without changing business tables", (context) => {
  const directory = mkdtempSync(join(tmpdir(), "natarot-reporting-migration-"));
  const dbPath = join(directory, "natarot.sqlite");
  context.after(() => rmSync(directory, { recursive: true, force: true }));
  execFileSync(process.execPath, ["scripts/node-migrate.mjs"], {
    cwd: repoRoot,
    env: { ...process.env, NATAROT_DB_PATH: dbPath },
    stdio: "pipe",
  });
  const sqlite = new DatabaseSync(dbPath);

  const tables = sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map((row) => String(row.name));
  assert.ok(tables.includes("business_reporting_sync_state"));
  assert.ok(tables.includes("business_reporting_row_state"));
  assert.ok(tables.includes("business_reporting_activity_daily"));
  assert.ok(tables.includes("business_reporting_export_audit"));
  assert.ok(tables.includes("business_reporting_backup_runs"));
  assert.equal((sqlite.prepare("SELECT COUNT(*) AS count FROM business_reporting_sync_state").get() as { count: number }).count, 1);
  assert.ok(!tables.includes("business_reporting_customer_copy"));
  assert.equal((sqlite.prepare("SELECT COUNT(*) AS count FROM orders").get() as { count: number }).count, 0);
  assert.equal((sqlite.prepare("SELECT COUNT(*) AS count FROM members").get() as { count: number }).count, 0);
  sqlite.close();
});
