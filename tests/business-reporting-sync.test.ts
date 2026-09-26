import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { DatabaseSync } from "node:sqlite";
import { mkdtempSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test, { type TestContext } from "node:test";
import { createSqliteD1Database, type SqliteConnection } from "../lib/sqlite-d1";
import { syncBusinessReport } from "../lib/business-reporting/sync";
import type { DriveRuntimeConfig } from "../lib/google-drive";

const repoRoot = fileURLToPath(new URL("../", import.meta.url));
const now = Date.UTC(2026, 8, 26, 5);
const keyring = { currentKeyId: "test", keys: { test: new Uint8Array(32) } };
const config: DriveRuntimeConfig = {
  clientId: "synthetic-client-id",
  clientSecret: "synthetic-client-secret",
  redirectUri: "https://natarot.test/api/auth/google/callback",
  encryptionKeyring: keyring,
};

function makeFixture(context: TestContext) {
  const directory = mkdtempSync(join(tmpdir(), "natarot-business-sync-"));
  const dbPath = join(directory, "natarot.sqlite");
  execFileSync(process.execPath, ["scripts/node-migrate.mjs"], {
    cwd: repoRoot,
    env: { ...process.env, NATAROT_DB_PATH: dbPath },
    stdio: "pipe",
  });
  const sqlite = new DatabaseSync(dbPath);
  sqlite.exec("PRAGMA foreign_keys = ON;");
  const database = createSqliteD1Database(sqlite as unknown as SqliteConnection);
  context.after(() => {
    sqlite.close();
    rmSync(directory, { recursive: true, force: true });
  });
  return { database, sqlite };
}

function addOwner(sqlite: DatabaseSync) {
  sqlite.prepare("INSERT INTO members (id, username, email, phone, created_at, updated_at, email_verified_at, disabled, role) VALUES ('admin', 'admin', 'admin@example.test', 'synthetic-phone', 1, 1, 1, 0, 'SUPER_ADMIN')").run();
  sqlite.prepare("INSERT INTO google_drive_connections (member_id, google_subject, google_email, refresh_token_ciphertext, granted_scope, connected_at, updated_at) VALUES ('admin', 'google-subject-admin', 'admin@example.test', 'synthetic-encrypted-token', 'https://www.googleapis.com/auth/drive.file', 1, 1)").run();
}

function addCustomer(sqlite: DatabaseSync, id: string, createdAt: number) {
  sqlite.prepare("INSERT INTO members (id, username, email, phone, created_at, updated_at, email_verified_at, disabled, role) VALUES (?, ?, ?, ?, ?, ?, ?, 0, 'USER')")
    .run(id, id, id + "@example.test", "synthetic-phone", createdAt, createdAt, createdAt);
  sqlite.prepare("INSERT INTO auth_sessions (token_hash, member_id, created_at, expires_at, last_seen_at, revoked_at, session_id) VALUES (?, ?, ?, ?, ?, NULL, ?)")
    .run("hash-" + id, id, createdAt, createdAt + 86_400_000, createdAt, "session-" + id);
}

function createApiHarness() {
  const calls: Array<{ url: string; method: string; body: string }> = [];
  let tabs = ["Sheet1"];
  const request = async (input: { url: string; method?: string; body?: BodyInit | null }) => {
    const url = input.url;
    const method = input.method ?? "GET";
    const body = typeof input.body === "string" ? input.body : "";
    calls.push({ url, method, body });
    if (url.startsWith("https://www.googleapis.com/drive/v3/files?")) return Response.json({ files: [] });
    if (url === "https://www.googleapis.com/drive/v3/files" && method === "POST") {
      return Response.json({ id: "synthetic-sheet-id", name: "NaTarot Business Control Center", mimeType: "application/vnd.google-apps.spreadsheet" });
    }
    if (url.startsWith("https://sheets.googleapis.com/v4/spreadsheets/synthetic-sheet-id") && method === "GET") {
      return Response.json({ spreadsheetId: "synthetic-sheet-id", sheets: tabs.map((title, sheetId) => ({ properties: { sheetId, title } })) });
    }
    if (url.endsWith(":batchUpdate") && method === "POST") {
      const parsed = JSON.parse(body) as { requests: Array<{ addSheet?: { properties: { title: string } }; deleteSheet?: { sheetId: number } }> };
      const current = tabs.map((title, sheetId) => ({ title, sheetId }));
      for (const item of parsed.requests) if (item.addSheet) current.push({ title: item.addSheet.properties.title, sheetId: 100 + current.length });
      tabs = current.filter(({ title }) => ["Dashboard", "Customers", "Revenue", "Affiliate", "Referrals", "Activity", "Credits", "System"].includes(title)).map(({ title }) => title);
      return Response.json({ replies: [] });
    }
    if (url.includes("/values:batchUpdate")) return Response.json({ totalUpdatedCells: 100 });
    throw new Error("Unexpected test request: " + method + " " + url);
  };
  return { calls, request };
}

test("synchronization skips without an eligible Drive owner and preserves the checkpoint", async (context) => {
  const { database, sqlite } = makeFixture(context);
  await database.prepare("UPDATE business_reporting_sync_state SET last_success_at=? WHERE id='primary'").bind(123).run();
  const api = createApiHarness();

  const result = await syncBusinessReport(database, { now, config, request: api.request, sleep: async () => {} });

  assert.equal(result.status, "blocked");
  assert.equal(result.reason, "no_connected_owner");
  assert.equal(api.calls.length, 0);
  assert.equal((await database.prepare("SELECT last_success_at AS value FROM business_reporting_sync_state WHERE id='primary'").first<{ value: number }>())?.value, 123);
  assert.equal((await database.prepare("SELECT COUNT(*) AS count FROM business_reporting_export_audit").first<{ count: number }>())?.count, 1);
  sqlite.exec("PRAGMA optimize;");
});

test("incremental synchronization writes only changed rows and replays safely", async (context) => {
  const { database, sqlite } = makeFixture(context);
  addOwner(sqlite);
  addCustomer(sqlite, "customer-one", now - 1_000);
  const api = createApiHarness();

  const first = await syncBusinessReport(database, { now, config, request: api.request, sleep: async () => {}, random: () => 0 });
  assert.equal(first.status, "success");
  assert.equal(first.reconciled, true);
  assert.doesNotMatch(api.calls.map((call) => call.body).join("\n"), /customer-one|admin@example\.test|synthetic-phone|private optional context|Tarot question/i);
  const customerWritesAfterFirst = api.calls.filter((call) => call.url.includes("/values:batchUpdate") && call.body.includes("Customers!A2:G2")).length;
  assert.equal(customerWritesAfterFirst, 1);

  const second = await syncBusinessReport(database, { now: now + 60_000, config, request: api.request, sleep: async () => {}, random: () => 0 });
  assert.equal(second.status, "success");
  assert.equal(second.reconciled, false);
  const customerWritesAfterSecond = api.calls.filter((call) => call.url.includes("/values:batchUpdate") && call.body.includes("Customers!A2:G2")).length;
  assert.equal(customerWritesAfterSecond, customerWritesAfterFirst);

  addCustomer(sqlite, "customer-two", now + 60_000);
  const third = await syncBusinessReport(database, { now: now + 120_000, config, request: api.request, sleep: async () => {}, random: () => 0 });
  assert.equal(third.status, "success");
  assert.ok(api.calls.some((call) => call.url.includes("/values:batchUpdate") && call.body.includes("Customers!A3:G3")));
  assert.equal((await database.prepare("SELECT COUNT(*) AS count FROM business_reporting_row_state WHERE sheet_name='Customers'").first<{ count: number }>())?.count, 2);
});

test("same-day reconciliation runs once, daily reconciliation runs after the HCMC date changes, and force can repeat it", async (context) => {
  const { database, sqlite } = makeFixture(context);
  addOwner(sqlite);
  const api = createApiHarness();

  const first = await syncBusinessReport(database, { now, config, request: api.request, sleep: async () => {}, random: () => 0 });
  const sameDay = await syncBusinessReport(database, { now: now + 60_000, config, request: api.request, sleep: async () => {}, random: () => 0 });
  const nextDay = await syncBusinessReport(database, { now: Date.UTC(2026, 8, 26, 17), config, request: api.request, sleep: async () => {}, random: () => 0 });
  const forced = await syncBusinessReport(database, { now: Date.UTC(2026, 8, 26, 18), forceReconcile: true, config, request: api.request, sleep: async () => {}, random: () => 0 });

  assert.equal(first.reconciled, true);
  assert.equal(sameDay.reconciled, false);
  assert.equal(nextDay.reconciled, true);
  assert.equal(forced.reconciled, true);
  assert.equal((await database.prepare("SELECT last_reconciliation_date AS value FROM business_reporting_sync_state WHERE id='primary'").first<{ value: string }>())?.value, "2026-09-27");
});

test("an overlapping synchronization lease skips without calling Google", async (context) => {
  const { database, sqlite } = makeFixture(context);
  addOwner(sqlite);
  await database.prepare("UPDATE business_reporting_sync_state SET lease_owner='another-run', lease_expires_at=? WHERE id='primary'").bind(now + 60_000).run();
  const api = createApiHarness();

  const result = await syncBusinessReport(database, { now, config, request: api.request, sleep: async () => {} });

  assert.equal(result.status, "skipped");
  assert.equal(result.reason, "lease_held");
  assert.equal(api.calls.length, 0);
});

test("synchronization honors scheduled exponential retry backoff without advancing the checkpoint", async (context) => {
  const { database, sqlite } = makeFixture(context);
  addOwner(sqlite);
  await database.prepare("UPDATE business_reporting_sync_state SET last_success_at=?, retry_attempt=2, next_retry_at=? WHERE id='primary'").bind(123, now + 60_000).run();
  const api = createApiHarness();

  const result = await syncBusinessReport(database, { now, config, request: api.request, sleep: async () => {} });
  const state = await database.prepare("SELECT last_success_at AS lastSuccessAt, retry_attempt AS retryAttempt, next_retry_at AS nextRetryAt FROM business_reporting_sync_state WHERE id='primary'").first<{ lastSuccessAt: number; retryAttempt: number; nextRetryAt: number }>();

  assert.deepEqual(result, { status: "skipped", reason: "retry_backoff" });
  assert.equal(api.calls.length, 0);
  assert.equal(state?.lastSuccessAt, 123);
  assert.equal(state?.retryAttempt, 2);
  assert.equal(state?.nextRetryAt, now + 60_000);
});

test("a failed Sheets write preserves the previous checkpoint and records only a sanitized error code", async (context) => {
  const { database, sqlite } = makeFixture(context);
  addOwner(sqlite);
  await database.prepare("UPDATE business_reporting_sync_state SET last_success_at=?, last_reconciliation_date='2026-09-25', retry_attempt=2 WHERE id='primary'").bind(123).run();
  const api = createApiHarness();
  const originalRequest = api.request;
  api.request = async (input) => {
    if (input.url.includes("/values:batchUpdate")) return new Response("private-provider-body", { status: 503 });
    return originalRequest(input);
  };

  const result = await syncBusinessReport(database, { now, config, request: api.request, sleep: async () => {}, random: () => 0 });
  const state = await database.prepare("SELECT last_success_at AS lastSuccessAt, last_reconciliation_date AS reconciliationDate, last_error_code AS errorCode, next_retry_at AS nextRetryAt FROM business_reporting_sync_state WHERE id='primary'").first<{ lastSuccessAt: number; reconciliationDate: string; errorCode: string; nextRetryAt: number }>();

  assert.equal(result.status, "failed");
  assert.equal(state?.lastSuccessAt, 123);
  assert.equal(state?.reconciliationDate, "2026-09-25");
  assert.equal(state?.errorCode, "google_unavailable");
  assert.equal(state?.nextRetryAt, now + 60 * 60 * 1000);
  assert.doesNotMatch(JSON.stringify(state), /private-provider-body/);
});
