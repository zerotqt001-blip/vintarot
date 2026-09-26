import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { DatabaseSync } from "node:sqlite";
import { mkdtempSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test, { type TestContext } from "node:test";
import { createSqliteD1Database, type SqliteConnection } from "../lib/sqlite-d1";
import { BUSINESS_REPORT_SHEETS, BusinessReportingGoogleError, ensureBusinessSpreadsheet, googleFetchWithRetry } from "../lib/business-reporting/google-sheets";
import { resolveReportingOwner } from "../lib/business-reporting/sync";
import type { DriveRuntimeConfig } from "../lib/google-drive";

const repoRoot = fileURLToPath(new URL("../", import.meta.url));
const expectedTabs = ["Dashboard", "Customers", "Revenue", "Affiliate", "Referrals", "Activity", "Credits", "System"];
const keyring = { currentKeyId: "test", keys: { test: new Uint8Array(32) } };
const config: DriveRuntimeConfig = {
  clientId: "synthetic-client-id",
  clientSecret: "synthetic-client-secret",
  redirectUri: "https://natarot.test/api/auth/google/callback",
  encryptionKeyring: keyring,
};

function makeFixture(context: TestContext) {
  const directory = mkdtempSync(join(tmpdir(), "natarot-business-sheets-"));
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

function addMember(sqlite: DatabaseSync, input: {
  id: string; role?: string; emailVerifiedAt?: number | null; disabled?: number; connected?: boolean;
}) {
  sqlite.prepare("INSERT INTO members (id, username, email, phone, created_at, updated_at, email_verified_at, disabled, role) VALUES (?, ?, ?, ?, 100, 100, ?, ?, ?)")
    .run(input.id, input.id, input.id + "@example.test", "synthetic-phone", input.emailVerifiedAt === undefined ? 1 : input.emailVerifiedAt, input.disabled ?? 0, input.role ?? "SUPER_ADMIN");
  if (input.connected) sqlite.prepare("INSERT INTO google_drive_connections (member_id, google_subject, google_email, refresh_token_ciphertext, granted_scope, connected_at, updated_at) VALUES (?, ?, ?, ?, ?, 100, 100)")
    .run(input.id, "subject-" + input.id, input.id + "@example.test", "synthetic-encrypted-token", "https://www.googleapis.com/auth/drive.file");
}

test("reporting owner resolution fails closed for none or multiple connected verified enabled SUPER_ADMINs", async (context) => {
  const { database, sqlite } = makeFixture(context);
  assert.deepEqual(await resolveReportingOwner(database), { owner: null, blockedReason: "no_connected_owner" });

  addMember(sqlite, { id: "admin-disabled", disabled: 1, connected: true });
  addMember(sqlite, { id: "admin-unverified", emailVerifiedAt: null, connected: true });
  addMember(sqlite, { id: "member-user", role: "USER", connected: true });
  assert.deepEqual(await resolveReportingOwner(database), { owner: null, blockedReason: "no_connected_owner" });

  addMember(sqlite, { id: "admin-one", connected: true });
  addMember(sqlite, { id: "admin-two", connected: true });
  assert.deepEqual(await resolveReportingOwner(database), { owner: null, blockedReason: "multiple_connected_owners" });
});

test("reporting owner exposes one verified account identity without returning credentials", async (context) => {
  const { database, sqlite } = makeFixture(context);
  addMember(sqlite, { id: "admin-one", connected: true });

  const result = await resolveReportingOwner(database);

  assert.deepEqual(result, {
    owner: { memberId: "admin-one", googleSubject: "subject-admin-one", googleEmail: "admin-one@example.test" },
    blockedReason: null,
  });
  assert.doesNotMatch(JSON.stringify(result), /synthetic-encrypted-token|refresh_token_ciphertext/);
});

test("Google API retry honors Retry-After and sanitizes provider response bodies", async () => {
  const waits: number[] = [];
  let calls = 0;
  const response = await googleFetchWithRetry(async () => {
    calls += 1;
    return calls === 1
      ? new Response("provider-internal-detail", { status: 429, headers: { "Retry-After": "0.25" } })
      : new Response("ok", { status: 200 });
  }, { maxAttempts: 3, sleep: async (milliseconds) => { waits.push(milliseconds); }, random: () => 0 });

  assert.equal(response.status, 200);
  assert.equal(calls, 2);
  assert.deepEqual(waits, [250]);
});

test("Google API retry backs off on transient failures and never surfaces provider bodies", async () => {
  const waits: number[] = [];
  await assert.rejects(
    () => googleFetchWithRetry(async () => new Response("private-provider-error", { status: 503 }), {
      maxAttempts: 3,
      baseDelayMs: 100,
      sleep: async (milliseconds) => { waits.push(milliseconds); },
      random: () => 0,
    }),
    (error: unknown) => {
      assert.equal((error as Error).message, "Google reporting service is temporarily unavailable.");
      assert.doesNotMatch((error as Error).message, /private-provider-error/);
      return true;
    },
  );
  assert.deepEqual(waits, [100, 200]);
});

test("spreadsheet creation retries safely, creates the exact private workbook tabs, and stores its ID", async (context) => {
  const { database, sqlite } = makeFixture(context);
  addMember(sqlite, { id: "admin-one", connected: true });
  const result = await resolveReportingOwner(database);
  assert.ok(result.owner);

  const requests: Array<{ url: string; method: string; body: string }> = [];
  let createAttempts = 0;
  let listAttempts = 0;
  let tabs = ["Sheet1"];
  const request = async (input: { url: string; method?: string; body?: BodyInit | null }) => {
    const url = input.url;
    const method = input.method ?? "GET";
    const body = typeof input.body === "string" ? input.body : "";
    requests.push({ url, method, body });
    if (url.startsWith("https://www.googleapis.com/drive/v3/files?")) {
      listAttempts += 1;
      if (listAttempts > 1) return Response.json({ files: [{ id: "synthetic-sheet-id", name: "NaTarot Business Control Center", mimeType: "application/vnd.google-apps.spreadsheet", appProperties: { natarotPurpose: "business-control-center-v1" } }] });
      return Response.json({ files: [] });
    }
    if (url === "https://www.googleapis.com/drive/v3/files" && method === "POST") {
      createAttempts += 1;
      return Response.json({ error: { message: "provider detail" } }, { status: 503 });
    }
    if (url.startsWith("https://sheets.googleapis.com/v4/spreadsheets/synthetic-sheet-id") && method === "GET") {
      return Response.json({ spreadsheetId: "synthetic-sheet-id", sheets: tabs.map((title, sheetId) => ({ properties: { sheetId, title } })) });
    }
    if (url.endsWith(":batchUpdate") && method === "POST") {
      const parsed = JSON.parse(body) as { requests: Array<{ addSheet?: { properties: { title: string } }; deleteSheet?: { sheetId: number } }> };
      const current = tabs.map((title, sheetId) => ({ title, sheetId }));
      for (const item of parsed.requests) {
        if (item.addSheet) current.push({ title: item.addSheet.properties.title, sheetId: 100 + current.length });
      }
      tabs = current.filter(({ title }) => expectedTabs.includes(title)).map(({ title }) => title);
      return Response.json({ replies: [] });
    }
    if (url.startsWith("https://sheets.googleapis.com/v4/spreadsheets/synthetic-sheet-id/values:batchUpdate")) {
      return Response.json({ totalUpdatedCells: 0 });
    }
    throw new Error("Unexpected test request: " + method + " " + url);
  };

  const workbook = await ensureBusinessSpreadsheet({
    database, owner: result.owner, config, request,
    sleep: async () => {}, random: () => 0,
  });

  assert.equal(createAttempts, 1);
  assert.equal(workbook.spreadsheetId, "synthetic-sheet-id");
  assert.deepEqual(workbook.tabs, expectedTabs);
  assert.deepEqual(tabs, expectedTabs);
  assert.deepEqual(BUSINESS_REPORT_SHEETS.map((sheet) => sheet.name), expectedTabs);
  assert.deepEqual(BUSINESS_REPORT_SHEETS.map((sheet) => sheet.headers.length), [5, 7, 6, 8, 5, 6, 5, 4]);
  const headerWrite = requests.find((entry) => entry.url.includes("/values:batchUpdate"));
  assert.ok(headerWrite);
  const headerPayload = JSON.parse(headerWrite.body) as { data: Array<{ range: string; values: string[][] }> };
  assert.deepEqual(headerPayload.data.map((range) => range.range.split("!")[0]), expectedTabs);
  assert.deepEqual(headerPayload.data.map((range) => range.values[0]?.[0]), ["Metric", "Opaque customer ID", "Reporting date", "Opaque affiliate ID", "Opaque referrer ID", "Date", "Date", "Metric"]);
  assert.ok(requests.some((entry) => entry.url.includes("appProperties") || entry.url.includes("q=")));
  assert.ok(requests.some((entry) => JSON.stringify(JSON.parse(entry.body || "{}")).includes("natarotPurpose")));
  assert.equal(requests.some((entry) => entry.url.includes("/permissions")), false);
  assert.equal((await database.prepare("SELECT spreadsheet_id AS id FROM business_reporting_sync_state WHERE id='primary'").first<{ id: string }>())?.id, "synthetic-sheet-id");
});

test("incomplete Drive marker search fails closed instead of creating a possible duplicate workbook", async (context) => {
  const { database, sqlite } = makeFixture(context);
  addMember(sqlite, { id: "admin-one", connected: true });
  const result = await resolveReportingOwner(database);
  assert.ok(result.owner);
  let creates = 0;
  const request = async (input: { url: string; method?: string }) => {
    if (input.url.startsWith("https://www.googleapis.com/drive/v3/files?")) return Response.json({ files: [], incompleteSearch: true });
    if (input.url === "https://www.googleapis.com/drive/v3/files" && input.method === "POST") {
      creates += 1;
      return Response.json({ id: "unexpected-duplicate", mimeType: "application/vnd.google-apps.spreadsheet" });
    }
    throw new Error("Unexpected request.");
  };

  await assert.rejects(
    () => ensureBusinessSpreadsheet({ database, owner: result.owner, config, request }),
    (error: unknown) => error instanceof BusinessReportingGoogleError && error.code === "google_unavailable",
  );
  assert.equal(creates, 0);
});
