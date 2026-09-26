import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { DatabaseSync } from "node:sqlite";
import { mkdtempSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test, { type TestContext } from "node:test";
import { authenticatedGoogleRequest, type DriveRuntimeConfig } from "../lib/google-drive";
import { encryptField } from "../lib/security/encryption";
import { createSqliteD1Database, type SqliteConnection } from "../lib/sqlite-d1";

const repoRoot = fileURLToPath(new URL("../", import.meta.url));
const tokenUrl = "https://oauth2.googleapis.com/token";
const keyring = { currentKeyId: "test", keys: { test: new Uint8Array(32) } };

async function makeFixture(context: TestContext, fetchImpl: typeof fetch) {
  const directory = mkdtempSync(join(tmpdir(), "natarot-drive-request-"));
  const dbPath = join(directory, "natarot.sqlite");
  execFileSync(process.execPath, ["scripts/node-migrate.mjs"], {
    cwd: repoRoot,
    env: { ...process.env, NATAROT_DB_PATH: dbPath },
    stdio: "pipe",
  });
  const sqlite = new DatabaseSync(dbPath);
  sqlite.exec("PRAGMA foreign_keys = ON;");
  const database = createSqliteD1Database(sqlite as unknown as SqliteConnection);
  sqlite.prepare("INSERT INTO members (id, username, email, phone, created_at, updated_at, role, disabled) VALUES ('admin', 'admin', 'admin@example.test', 'synthetic-phone', 1, 1, 'SUPER_ADMIN', 0)").run();
  const encrypted = await encryptField("synthetic-refresh-token", "google-drive.refresh-token", keyring);
  sqlite.prepare("INSERT INTO google_drive_connections (member_id, google_subject, google_email, refresh_token_ciphertext, granted_scope, connected_at, updated_at) VALUES ('admin', 'subject', 'admin@example.test', ?, 'https://www.googleapis.com/auth/drive.file', 1, 1)")
    .run(encrypted);
  context.after(() => {
    sqlite.close();
    rmSync(directory, { recursive: true, force: true });
  });
  const config: DriveRuntimeConfig = {
    clientId: "synthetic-client-id",
    clientSecret: "synthetic-client-secret",
    redirectUri: "https://natarot.test/api/auth/google/callback",
    encryptionKeyring: keyring,
    fetchImpl,
  };
  return { database, config };
}

test("authenticated Google requests use the stored app token and permit only Google API hosts", async (context) => {
  const requests: Array<{ url: string; authorization: string | null }> = [];
  const fetchImpl: typeof fetch = async (input, init) => {
    const url = String(input);
    requests.push({ url, authorization: new Headers(init?.headers).get("authorization") });
    if (url === tokenUrl) return Response.json({ access_token: "synthetic-access-token" });
    return Response.json({ ok: true });
  };
  const fixture = await makeFixture(context, fetchImpl);

  const response = await authenticatedGoogleRequest({
    ...fixture,
    memberId: "admin",
    url: "https://sheets.googleapis.com/v4/spreadsheets",
    headers: { authorization: "Bearer attacker-supplied-value" },
  });

  assert.equal(response.status, 200);
  assert.deepEqual(requests.map((request) => request.url), [tokenUrl, "https://sheets.googleapis.com/v4/spreadsheets"]);
  assert.equal(requests[1]?.authorization, "Bearer synthetic-access-token");
  await assert.rejects(() => authenticatedGoogleRequest({
    ...fixture,
    memberId: "admin",
    url: "https://attacker.example/collect",
  }));
  await assert.rejects(() => authenticatedGoogleRequest({
    ...fixture,
    memberId: "admin",
    url: "https://sheets.googleapis.com:8443/v4/spreadsheets",
  }));
  assert.equal(requests.length, 2);
});

test("authenticated Google requests preserve Node's streaming fetch duplex setting", async (context) => {
  let receivedDuplex: string | undefined;
  const fetchImpl: typeof fetch = async (input, init) => {
    if (String(input) === tokenUrl) return Response.json({ access_token: "synthetic-access-token" });
    receivedDuplex = (init as RequestInit & { duplex?: string }).duplex;
    return Response.json({ ok: true });
  };
  const fixture = await makeFixture(context, fetchImpl);
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new Uint8Array([1, 2, 3]));
      controller.close();
    },
  });

  await authenticatedGoogleRequest({
    ...fixture,
    memberId: "admin",
    url: "https://www.googleapis.com/upload/drive/v3/files/file-id?uploadType=media",
    method: "PATCH",
    headers: { "content-type": "application/octet-stream" },
    body,
    duplex: "half",
  });

  assert.equal(receivedDuplex, "half");
});
