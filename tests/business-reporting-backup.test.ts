import { Buffer } from "node:buffer";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { DatabaseSync } from "node:sqlite";
import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test, { type TestContext } from "node:test";
import { decryptBackupArchive, encryptBackupArchive, BackupCryptoError } from "../lib/business-reporting/backup-crypto";
import { mirrorBackupRetention, selectOffsiteRetentionReferences, uploadVerifiedOffsiteBackup } from "../lib/business-reporting/offsite-backup";
import { createSqliteD1Database, type SqliteConnection } from "../lib/sqlite-d1";
import type { DriveRuntimeConfig } from "../lib/google-drive";

const repoRoot = fileURLToPath(new URL("../", import.meta.url));
const keyring = { currentKeyId: "synthetic", keys: { synthetic: new Uint8Array(32).fill(11) } };
const wrongKeyring = { currentKeyId: "other", keys: { other: new Uint8Array(32).fill(12) } };
const config: DriveRuntimeConfig = {
  clientId: "synthetic-client-id",
  clientSecret: "synthetic-client-secret",
  redirectUri: "https://natarot.test/api/auth/google/callback",
  encryptionKeyring: keyring,
};
const owner = { memberId: "synthetic-admin", googleSubject: "synthetic-google-subject", googleEmail: "owner@example.test" };

function makeFixture(context: TestContext) {
  const directory = mkdtempSync(join(tmpdir(), "natarot-business-backup-"));
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
  return { database, directory, sqlite };
}

function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

test("backup encryption streams a private archive, emits integrity metadata, and round-trips", async (context) => {
  const { directory } = makeFixture(context);
  const sourcePath = join(directory, "source.tar.gz");
  const encryptedPath = join(directory, "source.ntrenc");
  const restoredPath = join(directory, "restored.tar.gz");
  const source = Buffer.from(("synthetic backup member-email@example.test private-reading-content\n").repeat(60_000));
  writeFileSync(sourcePath, source, { mode: 0o600 });

  const encrypted = await encryptBackupArchive({
    sourcePath, destinationPath: encryptedPath, backupId: "natarot-production-20260926-120000", keyring,
    expectedSourceSha256: sha256(source),
  });
  const envelope = readFileSync(encryptedPath);
  const restored = await decryptBackupArchive({ sourcePath: encryptedPath, destinationPath: restoredPath, keyring });

  assert.equal(encrypted.sourceSha256, sha256(source));
  assert.equal(encrypted.encryptedSha256, sha256(envelope));
  assert.equal(encrypted.sourceBytes, source.byteLength);
  assert.equal(statSync(encryptedPath).mode & 0o777, 0o600);
  assert.equal(envelope.includes(Buffer.from("private-reading-content")), false);
  assert.deepEqual(readFileSync(restoredPath), source);
  assert.equal(restored.backupId, "natarot-production-20260926-120000");
  assert.equal(restored.sourceSha256, sha256(source));
});

test("backup decryption rejects wrong keys and tampering and encryption rejects a source checksum mismatch", async (context) => {
  const { directory } = makeFixture(context);
  const sourcePath = join(directory, "source.tar.gz");
  const encryptedPath = join(directory, "source.ntrenc");
  const wrongKeyOutput = join(directory, "wrong-key.tar.gz");
  const tamperedOutput = join(directory, "tampered.tar.gz");
  const source = Buffer.from("synthetic archive bytes that must remain confidential");
  writeFileSync(sourcePath, source);
  await encryptBackupArchive({ sourcePath, destinationPath: encryptedPath, backupId: "backup-synthetic-1", keyring });

  await assert.rejects(() => decryptBackupArchive({ sourcePath: encryptedPath, destinationPath: wrongKeyOutput, keyring: wrongKeyring }));
  const tampered = readFileSync(encryptedPath);
  tampered[Math.floor(tampered.length / 2)] ^= 0x01;
  writeFileSync(encryptedPath, tampered);
  await assert.rejects(() => decryptBackupArchive({ sourcePath: encryptedPath, destinationPath: tamperedOutput, keyring }));
  await assert.rejects(
    () => encryptBackupArchive({ sourcePath, destinationPath: join(directory, "mismatch.ntrenc"), backupId: "backup-synthetic-2", keyring, expectedSourceSha256: "0".repeat(64) }),
    (error: unknown) => error instanceof BackupCryptoError && error.code === "source_checksum_mismatch",
  );
});

test("verified offsite upload checks remote identity and bytes, downloads, decrypts, and invokes restore verification", async (context) => {
  const { database, directory } = makeFixture(context);
  const archivePath = join(directory, "local.tar.gz");
  const archive = Buffer.alloc(5 * 1024 * 1024 + 1, 0x5a);
  writeFileSync(archivePath, archive, { mode: 0o600 });
  const remote = new Map<string, { metadata: Record<string, unknown>; bytes: Uint8Array }>();
  const calls: Array<{ url: string; method: string; bodyPresent: boolean; contentRange: string | null }> = [];
  const sessions = new Map<string, string>();
  let nextSession = 1;
  let firstArchiveUpload = true;
  const request = async (input: { url: string; method?: string; headers?: HeadersInit; body?: BodyInit | null }) => {
    const method = input.method ?? "GET";
    calls.push({ url: input.url, method, bodyPresent: input.body != null, contentRange: new Headers(input.headers).get("content-range") });
    if (input.url.startsWith("https://www.googleapis.com/drive/v3/files?")) {
      const query = new URL(input.url).searchParams.get("q") ?? "";
      const backupId = query.match(/backupId' and value='([^']+)'/)?.[1];
      const kind = query.match(/kind' and value='([^']+)'/)?.[1];
      const files = [...remote.values()].filter((file) => {
        const properties = file.metadata.appProperties as Record<string, string> | undefined;
        return properties?.backupId === backupId && properties?.kind === kind;
      }).map((file) => file.metadata);
      return Response.json({ files });
    }
    if (input.url === "https://www.googleapis.com/drive/v3/files" && method === "POST") {
      const metadata = JSON.parse(String(input.body)) as Record<string, unknown>;
      const properties = metadata.appProperties as Record<string, unknown>;
      const id = `drive-file-${String(properties.backupId)}-${String(properties.kind)}`;
      remote.set(id, { metadata: { ...metadata, id, size: "0", appProperties: metadata.appProperties }, bytes: new Uint8Array() });
      return Response.json({ ...metadata, id, size: "0" });
    }
    if (input.url.startsWith("https://www.googleapis.com/upload/drive/v3/files/") && method === "PATCH" && new URL(input.url).searchParams.get("uploadType") === "resumable") {
      const id = decodeURIComponent(new URL(input.url).pathname.split("/").at(-1)!);
      assert.equal(new Headers(input.headers).get("x-upload-content-length") !== null, true);
      assert.equal(new Headers(input.headers).get("x-upload-content-type"), id.endsWith("-manifest") ? "application/json" : "application/octet-stream");
      const session = `https://www.googleapis.com/upload/drive/v3/files/session-${nextSession++}`;
      sessions.set(session, id);
      return new Response(null, { status: 200, headers: { location: session } });
    }
    if (input.url.startsWith("https://www.googleapis.com/upload/drive/v3/files/session-") && method === "PUT") {
      const id = sessions.get(input.url);
      assert.ok(id);
      const entry = remote.get(id);
      assert.ok(entry);
      if (input.body == null) {
        assert.match(new Headers(input.headers).get("content-range") ?? "", /^bytes \*\//);
        return new Response(null, { status: 308 });
      }
      if (id === "drive-file-backup-synthetic-3-archive" && firstArchiveUpload) {
        firstArchiveUpload = false;
        await (input.body as ReadableStream<Uint8Array>).cancel();
        return new Response("temporary upload error", { status: 503 });
      }
      const body = input.body as ReadableStream<Uint8Array>;
      const chunks: Uint8Array[] = [];
      const reader = body.getReader();
      while (true) {
        const next = await reader.read();
        if (next.done) break;
        chunks.push(next.value);
      }
      const bytes = Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)));
      entry.bytes = bytes;
      entry.metadata.size = String(bytes.byteLength);
      return Response.json(entry.metadata);
    }
    const filePath = new URL(input.url).pathname;
    const fileId = decodeURIComponent(filePath.split("/").at(-1)!);
    const entry = remote.get(fileId);
    assert.ok(entry);
    if (input.url.includes("alt=media")) return new Response(Buffer.from(entry.bytes));
    if (method === "GET") return Response.json(entry.metadata);
    throw new Error("Unexpected backup API request.");
  };
  let restoreCalls = 0;
  let restoreError: unknown;

  const result = await uploadVerifiedOffsiteBackup({
    database, owner, config, archivePath, backupId: "backup-synthetic-3", archiveSha256: sha256(archive), archiveBytes: archive.byteLength,
    backupTimestamp: "2026-09-26T12:00:00Z", retentionClasses: ["daily"], keyring, restoreStatusRoot: join(directory, "restore-state"),
    request, sleep: async () => {}, restoreVerifier: async ({ archivePath: restoredPath }) => {
      restoreCalls += 1;
      try {
        assert.deepEqual(readFileSync(restoredPath), archive);
      } catch (error) {
        restoreError = error;
        throw error;
      }
    },
  });

  assert.equal(result.status, "verified", `${result.errorCode}; ${String(restoreError)}`);
  assert.equal(restoreCalls, 1);
  assert.ok(calls.some((call) => call.url.includes("alt=media")));
  assert.equal(calls.filter((call) => call.method === "PATCH" && call.url.includes("uploadType=media")).length, 0);
  assert.equal((await database.prepare("SELECT status FROM business_reporting_backup_runs WHERE backup_id='backup-synthetic-3'").first<{ status: string }>())?.status, "verified");
  const verifiedManifest = JSON.parse(Buffer.from(remote.get("drive-file-backup-synthetic-3-manifest")!.bytes).toString("utf8")) as { verification: string };
  assert.equal(verifiedManifest.verification, "verified");

  assert.ok(archive.byteLength > 5 * 1024 * 1024);
  assert.equal(calls.filter((call) => call.method === "PATCH" && call.url.includes("uploadType=resumable")).length, 3);
  assert.ok(calls.some((call) => call.method === "PUT" && !call.bodyPresent && call.contentRange?.startsWith("bytes */")));
  assert.equal(calls.filter((call) => call.method === "PUT" && call.url.includes("session-")).length, 5);
  assert.equal((await database.prepare("SELECT last_backup_success_at AS successfulJobAt FROM business_reporting_sync_state WHERE id='primary'").first<{ successfulJobAt: number | null }>())?.successfulJobAt, null);
  const uploadCallCount = calls.filter((call) => call.method === "PUT" && call.url.includes("session-")).length;
  const duplicate = await uploadVerifiedOffsiteBackup({
    database, owner, config, archivePath, backupId: "backup-synthetic-3", archiveSha256: sha256(archive), archiveBytes: archive.byteLength,
    backupTimestamp: "2026-09-26T12:00:00Z", retentionClasses: ["daily"], keyring, restoreStatusRoot: join(directory, "restore-state"),
    request, sleep: async () => {}, restoreVerifier: async () => { restoreCalls += 1; },
  });
  assert.equal(duplicate.status, "verified");
  assert.equal(duplicate.alreadyVerified, true);
  assert.equal(restoreCalls, 1);
  assert.equal(calls.filter((call) => call.method === "PUT" && call.url.includes("session-")).length, uploadCallCount);

  remote.get("drive-file-backup-synthetic-3-archive")!.metadata.size = "999";
  const mismatched = await uploadVerifiedOffsiteBackup({
    database, owner, config, archivePath, backupId: "backup-synthetic-3", archiveSha256: sha256(archive), archiveBytes: archive.byteLength,
    backupTimestamp: "2026-09-26T12:00:00Z", retentionClasses: ["daily"], keyring, restoreStatusRoot: join(directory, "restore-state"),
    request, sleep: async () => {}, restoreVerifier: async () => {},
  });
  assert.equal(mismatched.status, "failed");
  assert.equal(mismatched.errorCode, "remote_identity_mismatch");

  const restoreFailure = await uploadVerifiedOffsiteBackup({
    database, owner, config, archivePath, backupId: "backup-synthetic-restore-fail", archiveSha256: sha256(archive), archiveBytes: archive.byteLength,
    backupTimestamp: "2026-09-26T12:00:00Z", retentionClasses: ["daily"], keyring, restoreStatusRoot: join(directory, "restore-state"),
    request, sleep: async () => {}, restoreVerifier: async () => { throw new Error("synthetic restore failure"); },
  });
  assert.equal(restoreFailure.status, "failed");
  assert.equal(restoreFailure.errorCode, "restore_verification_failed");
});

test("backup retention trashes only app-owned archive and manifest pairs outside verified local references", async (context) => {
  const { database } = makeFixture(context);
  const calls: Array<{ url: string; method: string; body: string }> = [];
  const sourceSha256 = "a".repeat(64);
  const encryptedSha256 = "b".repeat(64);
  const managed = [
    { id: "keep-archive", name: "NaTarot-encrypted-keep-1.ntrenc", mimeType: "application/octet-stream", size: "123", appProperties: { natarotPurpose: "offsite-backup-v1", backupId: "keep-1", kind: "archive", sourceSha256, encryptedSha256 } },
    { id: "keep-manifest", name: "NaTarot-manifest-keep-1.json", mimeType: "application/json", size: "55", appProperties: { natarotPurpose: "offsite-backup-v1", backupId: "keep-1", kind: "manifest", sourceSha256, encryptedSha256 } },
    { id: "remove-archive", name: "NaTarot-encrypted-remove-1.ntrenc", mimeType: "application/octet-stream", appProperties: { natarotPurpose: "offsite-backup-v1", backupId: "remove-1", kind: "archive" } },
    { id: "remove-manifest", name: "NaTarot-manifest-remove-1.json", mimeType: "application/json", appProperties: { natarotPurpose: "offsite-backup-v1", backupId: "remove-1", kind: "manifest" } },
  ];
  const unrelated = { id: "unrelated", name: "family-photo.jpg", mimeType: "image/jpeg", appProperties: { otherApp: "marker" } };
  await database.prepare("INSERT INTO business_reporting_backup_runs (backup_id, status, source_sha256, encrypted_sha256, drive_file_id, manifest_file_id, source_bytes, encrypted_bytes, verified_at, error_code, created_at, updated_at) VALUES ('keep-1', 'verified', ?, ?, 'keep-archive', 'keep-manifest', 100, 123, 1000, NULL, 900, 1000)")
    .bind(sourceSha256, encryptedSha256).run();
  const request = async (input: { url: string; method?: string; body?: BodyInit | null }) => {
    const method = input.method ?? "GET";
    const body = typeof input.body === "string" ? input.body : "";
    calls.push({ url: input.url, method, body });
    if (input.url.startsWith("https://www.googleapis.com/drive/v3/files?")) return Response.json({ files: [...managed, unrelated] });
    if (input.url.includes("/files/remove-") && method === "PATCH") {
      assert.equal(JSON.parse(body).trashed, true);
      return Response.json({ id: decodeURIComponent(new URL(input.url).pathname.split("/").at(-1)!), trashed: true });
    }
    throw new Error("Unexpected backup API request.");
  };
  const result = await mirrorBackupRetention({
    database, owner, config, references: [{ backupId: "keep-1", retentionClasses: ["daily"] }], verifiedBackupIds: ["keep-1"],
    request, sleep: async () => {},
  });

  assert.deepEqual(result.trashedFileIds, ["remove-archive", "remove-manifest"]);
  assert.equal(calls.some((call) => call.url.includes("/files/unrelated")), false);
});

test("offsite retention selects seven daily, four weekly, and three monthly references and deduplicates backup IDs", () => {
  const candidates: import("../lib/business-reporting/offsite-backup").LocalBackupRetentionCandidate[] = Array.from({ length: 10 }, (_, index) => ({
    backupId: `backup-${String(index).padStart(2, "0")}`,
    archivePath: `/verified/backup-${index}.tar.gz`,
    archiveSha256: index.toString(16).padStart(64, "0"),
    archiveBytes: 100 + index,
    backupTimestamp: `2026-09-${String(26 - index).padStart(2, "0")}T02:00:00.000Z`,
    retentionClass: "daily" as const,
  }));
  candidates.push(
    { ...candidates[0]!, retentionClass: "weekly" },
    { ...candidates[1]!, retentionClass: "weekly" },
    { ...candidates[7]!, backupId: "weekly-1", archivePath: "/verified/weekly-1.tar.gz", retentionClass: "weekly" },
    { ...candidates[8]!, backupId: "weekly-2", archivePath: "/verified/weekly-2.tar.gz", retentionClass: "weekly" },
    { ...candidates[0]!, retentionClass: "monthly" },
    { ...candidates[8]!, backupId: "monthly-1", archivePath: "/verified/monthly-1.tar.gz", retentionClass: "monthly" },
    { ...candidates[9]!, backupId: "monthly-2", archivePath: "/verified/monthly-2.tar.gz", retentionClass: "monthly" },
  );

  const selected = selectOffsiteRetentionReferences(candidates);
  const daily = selected.filter((entry) => entry.retentionClasses.includes("daily"));
  const weekly = selected.filter((entry) => entry.retentionClasses.includes("weekly"));
  const monthly = selected.filter((entry) => entry.retentionClasses.includes("monthly"));
  assert.equal(daily.length, 7);
  assert.equal(weekly.length, 4);
  assert.equal(monthly.length, 3);
  assert.equal(selected.length, 11);
});
