import { Buffer } from "node:buffer";
import { createHash, randomUUID } from "node:crypto";
import { createReadStream, createWriteStream, lstatSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { mkdir, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { D1Database } from "@cloudflare/workers-types";
import { authenticatedGoogleRequest, GoogleDriveError, type DriveRuntimeConfig } from "../google-drive";
import type { EncryptionKeyring } from "../security/encryption";
import { BackupCryptoError, decryptBackupArchive, encryptBackupArchive } from "./backup-crypto";
import { BusinessReportingGoogleError, googleFetchWithRetry, type ReportingRequest } from "./google-sheets";

const DRIVE_FILES_URL = "https://www.googleapis.com/drive/v3/files";
const DRIVE_UPLOAD_URL = "https://www.googleapis.com/upload/drive/v3/files";
const APP_PROPERTY = "natarotPurpose";
const APP_PROPERTY_VALUE = "offsite-backup-v1";
const ENCRYPTED_MIME_TYPE = "application/octet-stream";
const MANIFEST_MIME_TYPE = "application/json";
const RETENTION_LIMITS = { daily: 7, weekly: 4, monthly: 3 } as const;
const MAX_BATCH_BYTES = 1_000_000;
const RESUMABLE_UPLOAD_RETRY_COUNT = 4;

export type BackupRetentionClass = keyof typeof RETENTION_LIMITS;

export type LocalBackupRetentionCandidate = {
  backupId: string;
  archivePath: string;
  archiveSha256: string;
  archiveBytes: number;
  backupTimestamp: string;
  retentionClass: BackupRetentionClass;
};

export type LocalBackupRetentionReference = {
  backupId: string;
  archivePath: string;
  archiveSha256: string;
  archiveBytes: number;
  backupTimestamp: string;
  retentionClasses: BackupRetentionClass[];
};

export type ManagedDriveFile = {
  id?: string;
  name?: string;
  mimeType?: string;
  size?: string;
  trashed?: boolean;
  appProperties?: Record<string, string>;
};

export class OffsiteBackupError extends Error {
  constructor(readonly code: "invalid_local_archive" | "remote_identity_mismatch" | "duplicate_remote_file" | "retention_unverified" | "restore_verification_failed" | "google_unavailable") {
    const message = code === "remote_identity_mismatch"
      ? "The remote backup identity or checksum does not match."
      : code === "duplicate_remote_file"
        ? "Multiple remote backup files have the same NaTarot identity."
        : code === "retention_unverified"
          ? "The remote backup retention set is not fully verified."
          : code === "restore_verification_failed"
            ? "The downloaded backup did not pass restore verification."
            : code === "google_unavailable"
              ? "Google Drive backup storage is temporarily unavailable."
              : "The local backup archive is invalid.";
    super(message);
    this.name = "OffsiteBackupError";
  }
}

type RequestInput = Parameters<ReportingRequest>[0];
type BackupRequest = (input: RequestInput) => Promise<Response>;
type DriveContext = {
  database: D1Database;
  owner: { memberId: string; googleSubject: string; googleEmail: string };
  config: DriveRuntimeConfig;
  request?: BackupRequest;
  sleep?: (milliseconds: number) => Promise<void>;
  random?: () => number;
};

type RemoteIdentity = {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  kind: "archive" | "manifest";
  backupId: string;
  sourceSha256: string;
};

function validId(value: string): boolean {
  return /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(value);
}

function validHash(value: string): boolean {
  return /^[a-f0-9]{64}$/i.test(value);
}

function validRetentionClass(value: string): value is BackupRetentionClass {
  return value === "daily" || value === "weekly" || value === "monthly";
}

function digestFile(path: string): Promise<{ sha256: string; bytes: number }> {
  return new Promise((resolve, reject) => {
    let info;
    try {
      info = lstatSync(path);
    } catch {
      reject(new OffsiteBackupError("invalid_local_archive"));
      return;
    }
    if (!info.isFile()) {
      reject(new OffsiteBackupError("invalid_local_archive"));
      return;
    }
    const digest = createHash("sha256");
    let bytes = 0;
    const stream = createReadStream(path);
    stream.on("data", (chunk: string | Uint8Array) => {
      const value = Buffer.from(chunk);
      digest.update(value);
      bytes += value.byteLength;
    });
    stream.once("error", () => reject(new OffsiteBackupError("invalid_local_archive")));
    stream.once("end", () => resolve({ sha256: digest.digest("hex"), bytes }));
  });
}

function json<T>(response: Response): Promise<T> {
  return response.json().catch(() => {
    throw new OffsiteBackupError("google_unavailable");
  }) as Promise<T>;
}

async function callApi(context: DriveContext, url: string, init: Partial<RequestInput> = {}, retryOptions: { allowNotFound?: boolean; maxAttempts?: number } = {}): Promise<Response> {
  const request = context.request ?? authenticatedGoogleRequest;
  return googleFetchWithRetry(
    () => request({ database: context.database, config: context.config, memberId: context.owner.memberId, url, ...init }),
    { sleep: context.sleep, random: context.random, allowNotFound: retryOptions.allowNotFound, maxAttempts: retryOptions.maxAttempts },
  );
}

function fileSearchUrl(backupId: string, kind: "archive" | "manifest"): string {
  const url = new URL(DRIVE_FILES_URL);
  const query = "appProperties has { key='" + APP_PROPERTY + "' and value='" + APP_PROPERTY_VALUE + "' }"
    + " and appProperties has { key='backupId' and value='" + backupId + "' }"
    + " and appProperties has { key='kind' and value='" + kind + "' } and trashed=false";
  url.searchParams.set("q", query);
  url.searchParams.set("pageSize", "100");
  url.searchParams.set("fields", "incompleteSearch,nextPageToken,files(id,name,mimeType,size,trashed,appProperties)");
  return url.toString();
}

async function listManagedFiles(context: DriveContext): Promise<ManagedDriveFile[]> {
  const files: ManagedDriveFile[] = [];
  let pageToken: string | undefined;
  do {
    const url = new URL(DRIVE_FILES_URL);
    url.searchParams.set("q", "appProperties has { key='" + APP_PROPERTY + "' and value='" + APP_PROPERTY_VALUE + "' } and trashed=false");
    url.searchParams.set("pageSize", "100");
    url.searchParams.set("fields", "incompleteSearch,nextPageToken,files(id,name,mimeType,size,trashed,appProperties)");
    if (pageToken) url.searchParams.set("pageToken", pageToken);
    const result = await json<{ files?: ManagedDriveFile[]; incompleteSearch?: boolean; nextPageToken?: string }>(await callApi(context, url.toString()));
    if (result.incompleteSearch === true) throw new OffsiteBackupError("google_unavailable");
    files.push(...(Array.isArray(result.files) ? result.files : []));
    pageToken = result.nextPageToken;
  } while (pageToken);
  return files;
}

async function findManagedFile(context: DriveContext, input: {
  backupId: string;
  kind: "archive" | "manifest";
  name: string;
  mimeType: string;
  sourceSha256: string;
}): Promise<ManagedDriveFile | null> {
  const response = await callApi(context, fileSearchUrl(input.backupId, input.kind));
  const result = await json<{ files?: ManagedDriveFile[]; incompleteSearch?: boolean }>(response);
  if (result.incompleteSearch === true) throw new OffsiteBackupError("google_unavailable");
  const files = Array.isArray(result.files) ? result.files : [];
  if (files.length > 1) throw new OffsiteBackupError("duplicate_remote_file");
  const file = files[0];
  if (!file) return null;
  if (typeof file.id !== "string" || file.name !== input.name || file.mimeType !== input.mimeType
    || file.trashed === true || file.appProperties?.[APP_PROPERTY] !== APP_PROPERTY_VALUE
    || file.appProperties?.backupId !== input.backupId || file.appProperties?.kind !== input.kind
    || file.appProperties?.sourceSha256 !== input.sourceSha256) {
    throw new OffsiteBackupError("remote_identity_mismatch");
  }
  return file;
}

async function createManagedFile(context: DriveContext, input: {
  backupId: string;
  kind: "archive" | "manifest";
  name: string;
  mimeType: string;
  sourceSha256: string;
  encryptedSha256?: string;
}): Promise<ManagedDriveFile> {
  const appProperties: Record<string, string> = {
    [APP_PROPERTY]: APP_PROPERTY_VALUE,
    backupId: input.backupId,
    kind: input.kind,
    sourceSha256: input.sourceSha256,
  };
  if (input.encryptedSha256) appProperties.encryptedSha256 = input.encryptedSha256;
  const body = JSON.stringify({ name: input.name, mimeType: input.mimeType, appProperties });
  try {
    const response = await callApi(context, DRIVE_FILES_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
    }, { maxAttempts: 1 });
    const file = await json<ManagedDriveFile>(response);
    if (typeof file.id !== "string" || file.name !== input.name || file.mimeType !== input.mimeType) {
      throw new OffsiteBackupError("remote_identity_mismatch");
    }
    return file;
  } catch (error) {
    if (!(error instanceof Error) || error.name !== "BusinessReportingGoogleError" || !("code" in error) || error.code !== "google_unavailable") {
      if (error instanceof OffsiteBackupError) throw error;
      throw error;
    }
    const recovered = await findManagedFile(context, input);
    if (recovered) return recovered;
    throw new OffsiteBackupError("google_unavailable");
  }
}

async function ensureManagedFile(context: DriveContext, input: {
  backupId: string;
  kind: "archive" | "manifest";
  name: string;
  mimeType: string;
  sourceSha256: string;
  encryptedSha256?: string;
}): Promise<ManagedDriveFile> {
  return await findManagedFile(context, input) ?? await createManagedFile(context, input);
}

async function uploadMedia(context: DriveContext, input: {
  fileId: string;
  sourcePath: string;
  size: number;
  mimeType: string;
}): Promise<void> {
  const request = context.request ?? authenticatedGoogleRequest;
  if (!Number.isSafeInteger(input.size) || input.size < 1) throw new OffsiteBackupError("invalid_local_archive");
  const send = (url: string, init: Omit<RequestInput, "database" | "config" | "memberId" | "url">) => request({
    database: context.database,
    config: context.config,
    memberId: context.owner.memberId,
    url,
    ...init,
  });
  const sleep = context.sleep ?? ((milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds)));

  const startSession = async (): Promise<string> => {
    const initiateUrl = new URL(DRIVE_UPLOAD_URL + "/" + encodeURIComponent(input.fileId));
    initiateUrl.searchParams.set("uploadType", "resumable");
    const response = await googleFetchWithRetry(() => send(initiateUrl.toString(), {
      method: "PATCH",
      headers: {
        "content-length": "0",
        "x-upload-content-length": String(input.size),
        "x-upload-content-type": input.mimeType,
      },
    }), { sleep: context.sleep, random: context.random, maxAttempts: RESUMABLE_UPLOAD_RETRY_COUNT });
    const location = response.headers.get("location");
    await response.body?.cancel().catch(() => {});
    if (!location) throw new OffsiteBackupError("google_unavailable");
    let session: URL;
    try {
      session = new URL(location);
    } catch {
      throw new OffsiteBackupError("google_unavailable");
    }
    if (session.protocol !== "https:" || session.port || session.username || session.password || session.hostname !== "www.googleapis.com"
      || !session.pathname.startsWith("/upload/drive/v3/files/")) throw new OffsiteBackupError("google_unavailable");
    return session.toString();
  };

  const uploadOffset = (response: Response): number => {
    const range = response.headers.get("range");
    const match = range?.match(/^bytes=0-(\d+)$/i);
    if (!match) return 0;
    const offset = Number(match[1]) + 1;
    return Number.isSafeInteger(offset) && offset <= input.size ? offset : 0;
  };

  let sessionUrl = await startSession();
  let offset = 0;
  for (let attempt = 0; attempt < RESUMABLE_UPLOAD_RETRY_COUNT; attempt += 1) {
    let response: Response | null = null;
    try {
      const headers: Record<string, string> = {
        "content-length": String(input.size - offset),
      };
      if (offset > 0) headers["content-range"] = `bytes ${offset}-${input.size - 1}/${input.size}`;
      response = await send(sessionUrl, {
        method: "PUT",
        headers,
        body: Readable.toWeb(createReadStream(input.sourcePath, { start: offset })) as ReadableStream<Uint8Array>,
        duplex: "half",
      });
    } catch (error) {
      if (error instanceof GoogleDriveError && error.code === "not_connected") throw new BusinessReportingGoogleError("google_authorization");
      if (attempt === RESUMABLE_UPLOAD_RETRY_COUNT - 1) throw new OffsiteBackupError("google_unavailable");
    }

    if (response?.ok) {
      await response.body?.cancel().catch(() => {});
      return;
    }
    if (response?.status === 401 || response?.status === 403) {
      await response.body?.cancel().catch(() => {});
      throw new BusinessReportingGoogleError("google_authorization");
    }
    if (response?.status === 308) {
      offset = uploadOffset(response);
      await response.body?.cancel().catch(() => {});
      continue;
    }
    if (response?.status === 404) {
      await response.body?.cancel().catch(() => {});
      sessionUrl = await startSession();
      offset = 0;
      continue;
    }
    if (response && ![408, 429].includes(response.status) && response.status < 500) {
      await response.body?.cancel().catch(() => {});
      throw new BusinessReportingGoogleError("google_rejected");
    }
    await response?.body?.cancel().catch(() => {});

    try {
      const status = await send(sessionUrl, {
        method: "PUT",
        headers: { "content-length": "0", "content-range": `bytes */${input.size}` },
      });
      if (status.ok) {
        await status.body?.cancel().catch(() => {});
        return;
      }
      if (status.status === 308) {
        offset = uploadOffset(status);
        await status.body?.cancel().catch(() => {});
      } else if (status.status === 404) {
        await status.body?.cancel().catch(() => {});
        sessionUrl = await startSession();
        offset = 0;
      } else if (status.status === 401 || status.status === 403) {
        await status.body?.cancel().catch(() => {});
        throw new BusinessReportingGoogleError("google_authorization");
      } else {
        await status.body?.cancel().catch(() => {});
        if (status.status < 500) throw new BusinessReportingGoogleError("google_rejected");
      }
    } catch (error) {
      if (error instanceof BusinessReportingGoogleError) throw error;
      if (error instanceof GoogleDriveError && error.code === "not_connected") throw new BusinessReportingGoogleError("google_authorization");
      if (attempt === RESUMABLE_UPLOAD_RETRY_COUNT - 1) throw new OffsiteBackupError("google_unavailable");
    }
    if (attempt < RESUMABLE_UPLOAD_RETRY_COUNT - 1) await sleep(Math.min(8_000, 500 * 2 ** attempt));
  }
  throw new OffsiteBackupError("google_unavailable");
}

function remoteName(backupId: string, kind: "archive" | "manifest"): string {
  return kind === "archive" ? "NaTarot-encrypted-" + backupId + ".ntrenc" : "NaTarot-manifest-" + backupId + ".json";
}

function remoteMime(kind: "archive" | "manifest"): string {
  return kind === "archive" ? ENCRYPTED_MIME_TYPE : MANIFEST_MIME_TYPE;
}

function validateRemoteFile(file: ManagedDriveFile, input: {
  fileId: string;
  backupId: string;
  kind: "archive" | "manifest";
  sourceSha256: string;
  encryptedSha256?: string;
  size: number;
}): RemoteIdentity {
  if (file.id !== input.fileId || file.name !== remoteName(input.backupId, input.kind) || file.mimeType !== remoteMime(input.kind)
    || file.trashed === true || file.appProperties?.[APP_PROPERTY] !== APP_PROPERTY_VALUE
    || file.appProperties?.backupId !== input.backupId || file.appProperties?.kind !== input.kind
    || file.appProperties?.sourceSha256 !== input.sourceSha256 || Number(file.size) !== input.size
    || (input.encryptedSha256 && file.appProperties?.encryptedSha256 !== input.encryptedSha256)) {
    throw new OffsiteBackupError("remote_identity_mismatch");
  }
  return {
    id: file.id!,
    name: file.name!,
    mimeType: file.mimeType!,
    size: input.size,
    kind: input.kind,
    backupId: input.backupId,
    sourceSha256: input.sourceSha256,
  };
}

async function getFileMetadata(context: DriveContext, fileId: string, allowNotFound = false): Promise<{ response: Response; file: ManagedDriveFile | null }> {
  const url = new URL(DRIVE_FILES_URL + "/" + encodeURIComponent(fileId));
  url.searchParams.set("fields", "id,name,mimeType,size,trashed,appProperties");
  const response = await callApi(context, url.toString(), {}, { allowNotFound });
  return { response, file: response.status === 404 ? null : await json<ManagedDriveFile>(response) };
}

async function downloadFile(context: DriveContext, input: {
  fileId: string;
  destinationPath: string;
  expectedSha256: string;
  expectedBytes: number;
}): Promise<void> {
  const request = context.request ?? authenticatedGoogleRequest;
  const url = new URL(DRIVE_FILES_URL + "/" + encodeURIComponent(input.fileId));
  url.searchParams.set("alt", "media");
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await googleFetchWithRetry(
        () => request({ database: context.database, config: context.config, memberId: context.owner.memberId, url: url.toString() }),
        { sleep: context.sleep, random: context.random },
      );
      if (!response.body) throw new OffsiteBackupError("google_unavailable");
      await pipeline(
        Readable.fromWeb(response.body as import("node:stream/web").ReadableStream<Uint8Array>),
        createWriteStream(input.destinationPath, { flags: "wx", mode: 0o600 }),
      );
      const actual = await digestFile(input.destinationPath);
      if (actual.sha256 !== input.expectedSha256 || actual.bytes !== input.expectedBytes) {
        throw new OffsiteBackupError("remote_identity_mismatch");
      }
      return;
    } catch (error) {
      rmSync(input.destinationPath, { force: true });
      if (error instanceof OffsiteBackupError && error.code !== "google_unavailable") throw error;
      if (attempt === 2) throw new OffsiteBackupError("google_unavailable");
      const delay = 500 * 2 ** attempt;
      await (context.sleep ?? ((milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds))))(delay);
    }
  }
}

function backupErrorCode(error: unknown): string {
  if (error instanceof BackupCryptoError) return error.code;
  if (error instanceof OffsiteBackupError) return error.code;
  if (error instanceof Error && error.name === "BusinessReportingGoogleError" && "code" in error) return String(error.code);
  if (error instanceof Error && error.name === "GoogleDriveError") return "google_authorization";
  return "backup_verification_failed";
}

async function startBackupAudit(database: D1Database, id: string, now: number): Promise<void> {
  await database.prepare("INSERT INTO business_reporting_export_audit (id, job_type, outcome, started_at, finished_at, rows_written, error_code) VALUES (?, 'drive_backup', 'started', ?, NULL, 0, NULL)")
    .bind(id, now).run();
}

async function finishBackupAudit(database: D1Database, id: string, now: number, outcome: "success" | "failure", errorCode: string | null): Promise<void> {
  await database.prepare("UPDATE business_reporting_export_audit SET outcome=?, finished_at=?, error_code=? WHERE id=?")
    .bind(outcome, now, errorCode, id).run();
}

function validBackupInput(input: {
  backupId: string;
  archiveSha256: string;
  archiveBytes: number;
  backupTimestamp: string;
  retentionClasses: string[];
}): boolean {
  return validId(input.backupId) && validHash(input.archiveSha256) && Number.isSafeInteger(input.archiveBytes) && input.archiveBytes > 0
    && Number.isFinite(Date.parse(input.backupTimestamp)) && input.retentionClasses.length > 0
    && input.retentionClasses.every(validRetentionClass);
}

function hasVerifiedState(row: {
  status: string;
  sourceSha256: string | null;
  encryptedSha256: string | null;
  driveFileId: string | null;
  manifestFileId: string | null;
  sourceBytes: number | null;
  encryptedBytes: number | null;
  verifiedAt: number | null;
} | null, input: { archiveSha256: string; archiveBytes: number }): row is NonNullable<typeof row> {
  return Boolean(row?.status === "verified" && row.sourceSha256 === input.archiveSha256 && Number(row.sourceBytes) === input.archiveBytes
    && row.encryptedSha256 && row.driveFileId && row.manifestFileId && row.verifiedAt);
}

async function verifyExistingBackup(context: DriveContext, input: {
  row: NonNullable<Awaited<ReturnType<typeof loadBackupRow>>>;
  backupId: string;
  archiveSha256: string;
  archiveBytes: number;
  forceVerify: boolean;
  keyring: EncryptionKeyring;
  tempDirectory: string;
  restoreStatusRoot: string;
  restoreVerifier: (input: { archivePath: string; restoreStatusRoot: string; backupId: string }) => Promise<void>;
}): Promise<boolean> {
  const [archiveMetadata, manifestMetadata] = await Promise.all([
    getFileMetadata(context, input.row.driveFileId!, true),
    getFileMetadata(context, input.row.manifestFileId!, true),
  ]);
  if (!archiveMetadata.file || !manifestMetadata.file) return false;
  try {
    validateRemoteFile(archiveMetadata.file, {
      fileId: input.row.driveFileId!,
      backupId: input.backupId,
      kind: "archive",
      sourceSha256: input.archiveSha256,
      encryptedSha256: input.row.encryptedSha256!,
      size: Number(input.row.encryptedBytes),
    });
    validateRemoteFile(manifestMetadata.file, {
      fileId: input.row.manifestFileId!,
      backupId: input.backupId,
      kind: "manifest",
      sourceSha256: input.archiveSha256,
      encryptedSha256: input.row.encryptedSha256!,
      size: Number(manifestMetadata.file.size),
    });
  } catch {
    return false;
  }
  if (!input.forceVerify) return true;
  const encryptedPath = join(input.tempDirectory, input.backupId + ".remote.ntrenc");
  const restoredPath = join(input.tempDirectory, input.backupId + ".verified.tar.gz");
  try {
    await downloadFile(context, {
      fileId: input.row.driveFileId!,
      destinationPath: encryptedPath,
      expectedSha256: input.row.encryptedSha256!,
      expectedBytes: Number(input.row.encryptedBytes),
    });
    await decryptBackupArchive({
      sourcePath: encryptedPath,
      destinationPath: restoredPath,
      keyring: input.keyring,
      expectedSourceSha256: input.archiveSha256,
    });
    await writeRestoreSidecar(restoredPath, input.archiveSha256);
    await input.restoreVerifier({ archivePath: restoredPath, restoreStatusRoot: input.restoreStatusRoot, backupId: input.backupId });
    await context.database.prepare("UPDATE business_reporting_backup_runs SET verified_at=?, updated_at=? WHERE backup_id=?")
      .bind(Date.now(), Date.now(), input.backupId).run();
    return true;
  } catch {
    return false;
  }
}

async function loadBackupRow(database: D1Database, backupId: string) {
  return database.prepare("SELECT status, source_sha256 AS sourceSha256, encrypted_sha256 AS encryptedSha256, drive_file_id AS driveFileId, manifest_file_id AS manifestFileId, source_bytes AS sourceBytes, encrypted_bytes AS encryptedBytes, verified_at AS verifiedAt FROM business_reporting_backup_runs WHERE backup_id=?")
    .bind(backupId).first<{
      status: string;
      sourceSha256: string | null;
      encryptedSha256: string | null;
      driveFileId: string | null;
      manifestFileId: string | null;
      sourceBytes: number | null;
      encryptedBytes: number | null;
      verifiedAt: number | null;
    }>();
}

async function writeRestoreSidecar(archivePath: string, hash: string): Promise<void> {
  const sidecar = archivePath + ".sha256";
  writeFileSync(sidecar, hash + "  " + basename(archivePath) + "\n", { flag: "wx", mode: 0o600 });
}

export async function uploadVerifiedOffsiteBackup(input: {
  database: D1Database;
  owner: DriveContext["owner"];
  config: DriveRuntimeConfig;
  archivePath: string;
  backupId: string;
  archiveSha256: string;
  archiveBytes: number;
  backupTimestamp: string;
  retentionClasses: BackupRetentionClass[];
  keyring: EncryptionKeyring;
  restoreStatusRoot: string;
  restoreVerifier: (input: { archivePath: string; restoreStatusRoot: string; backupId: string }) => Promise<void>;
  request?: BackupRequest;
  sleep?: (milliseconds: number) => Promise<void>;
  random?: () => number;
  now?: number;
  forceVerify?: boolean;
}): Promise<{ status: "verified" | "failed"; backupId: string; errorCode?: string; archiveFileId?: string; manifestFileId?: string; alreadyVerified?: boolean }> {
  const now = input.now ?? Date.now();
  const auditId = randomUUID();
  await startBackupAudit(input.database, auditId, now);
  if (!input.archivePath || !validBackupInput(input)) {
    await finishBackupAudit(input.database, auditId, now, "failure", "invalid_local_archive");
    return { status: "failed", backupId: input.backupId, errorCode: "invalid_local_archive" };
  }
  const context: DriveContext = {
    database: input.database,
    owner: input.owner,
    config: input.config,
    request: input.request,
    sleep: input.sleep,
    random: input.random,
  };
  const directory = mkdtempSync(join(tmpdir(), "natarot-offsite-backup-"));
  let activeStage = "local_archive";
  try {
    const local = await digestFile(input.archivePath);
    if (local.sha256 !== input.archiveSha256.toLowerCase() || local.bytes !== input.archiveBytes) {
      throw new OffsiteBackupError("invalid_local_archive");
    }
    const previous = await loadBackupRow(input.database, input.backupId);
    if (hasVerifiedState(previous, { archiveSha256: input.archiveSha256.toLowerCase(), archiveBytes: input.archiveBytes })
      && await verifyExistingBackup(context, {
        row: previous,
        backupId: input.backupId,
        archiveSha256: input.archiveSha256.toLowerCase(),
        archiveBytes: input.archiveBytes,
        forceVerify: Boolean(input.forceVerify),
        keyring: input.keyring,
        tempDirectory: directory,
        restoreStatusRoot: input.restoreStatusRoot,
        restoreVerifier: input.restoreVerifier,
      })) {
      await finishBackupAudit(input.database, auditId, now, "success", null);
      return {
        status: "verified",
        backupId: input.backupId,
        archiveFileId: previous.driveFileId!,
        manifestFileId: previous.manifestFileId!,
        alreadyVerified: true,
      };
    }

    await input.database.prepare("INSERT INTO business_reporting_backup_runs (backup_id, status, source_sha256, encrypted_sha256, drive_file_id, manifest_file_id, source_bytes, encrypted_bytes, verified_at, error_code, created_at, updated_at) VALUES (?, 'pending', ?, NULL, NULL, NULL, ?, NULL, NULL, NULL, ?, ?) ON CONFLICT(backup_id) DO UPDATE SET status='pending', source_sha256=excluded.source_sha256, error_code=NULL, updated_at=excluded.updated_at")
      .bind(input.backupId, input.archiveSha256.toLowerCase(), input.archiveBytes, now, now).run();
    await input.database.prepare("UPDATE business_reporting_sync_state SET last_backup_id=?, last_backup_attempt_at=?, updated_at=? WHERE id='primary'")
      .bind(input.backupId, now, now).run();

    const encryptedPath = join(directory, input.backupId + ".ntrenc");
    const encrypted = await encryptBackupArchive({
      sourcePath: input.archivePath,
      destinationPath: encryptedPath,
      backupId: input.backupId,
      keyring: input.keyring,
      expectedSourceSha256: input.archiveSha256.toLowerCase(),
    });
    await input.database.prepare("UPDATE business_reporting_backup_runs SET encrypted_sha256=?, encrypted_bytes=?, updated_at=? WHERE backup_id=?")
      .bind(encrypted.encryptedSha256, encrypted.encryptedBytes, now, input.backupId).run();

    const archiveFileName = remoteName(input.backupId, "archive");
    const archiveFile = await ensureManagedFile(context, {
      backupId: input.backupId,
      kind: "archive",
      name: archiveFileName,
      mimeType: ENCRYPTED_MIME_TYPE,
      sourceSha256: encrypted.sourceSha256,
      encryptedSha256: encrypted.encryptedSha256,
    });
    activeStage = "archive_upload";
    await uploadMedia(context, {
      fileId: archiveFile.id!,
      sourcePath: encryptedPath,
      size: encrypted.encryptedBytes,
      mimeType: ENCRYPTED_MIME_TYPE,
    });
    const uploadedArchive = await getFileMetadata(context, archiveFile.id!);
    validateRemoteFile(uploadedArchive.file!, {
      fileId: archiveFile.id!,
      backupId: input.backupId,
      kind: "archive",
      sourceSha256: encrypted.sourceSha256,
      encryptedSha256: encrypted.encryptedSha256,
      size: encrypted.encryptedBytes,
    });

    const metadata = {
      schemaVersion: 1,
      backupId: input.backupId,
      backupTimestamp: input.backupTimestamp,
      retentionClasses: [...input.retentionClasses].sort(),
      sourceSha256: encrypted.sourceSha256,
      sourceBytes: encrypted.sourceBytes,
      encryptedSha256: encrypted.encryptedSha256,
      encryptedBytes: encrypted.encryptedBytes,
      encryption: "AES-256-GCM",
      envelopeVersion: 1,
      verification: "pending",
    };
    const manifestPath = join(directory, input.backupId + ".manifest.json");
    writeFileSync(manifestPath, JSON.stringify(metadata) + "\n", { flag: "wx", mode: 0o600 });
    const manifestInfo = await stat(manifestPath);
    const manifestSha256 = (await digestFile(manifestPath)).sha256;
    const manifestFile = await ensureManagedFile(context, {
      backupId: input.backupId,
      kind: "manifest",
      name: remoteName(input.backupId, "manifest"),
      mimeType: MANIFEST_MIME_TYPE,
      sourceSha256: encrypted.sourceSha256,
      encryptedSha256: encrypted.encryptedSha256,
    });
    activeStage = "manifest_upload";
    await uploadMedia(context, { fileId: manifestFile.id!, sourcePath: manifestPath, size: manifestInfo.size, mimeType: MANIFEST_MIME_TYPE });
    const uploadedManifest = await getFileMetadata(context, manifestFile.id!);
    validateRemoteFile(uploadedManifest.file!, {
      fileId: manifestFile.id!,
      backupId: input.backupId,
      kind: "manifest",
      sourceSha256: encrypted.sourceSha256,
      encryptedSha256: encrypted.encryptedSha256,
      size: manifestInfo.size,
    });

    const remoteEncryptedPath = join(directory, input.backupId + ".remote.ntrenc");
    const remoteManifestPath = join(directory, input.backupId + ".remote.manifest.json");
    activeStage = "remote_download";
    await downloadFile(context, {
      fileId: archiveFile.id!,
      destinationPath: remoteEncryptedPath,
      expectedSha256: encrypted.encryptedSha256,
      expectedBytes: encrypted.encryptedBytes,
    });
    await downloadFile(context, {
      fileId: manifestFile.id!,
      destinationPath: remoteManifestPath,
      expectedSha256: manifestSha256,
      expectedBytes: manifestInfo.size,
    });
    let remoteManifest: typeof metadata;
    try {
      remoteManifest = JSON.parse(readFileSync(remoteManifestPath, "utf8")) as typeof metadata;
    } catch {
      throw new OffsiteBackupError("remote_identity_mismatch");
    }
    if (remoteManifest.backupId !== metadata.backupId || remoteManifest.sourceSha256 !== metadata.sourceSha256
      || remoteManifest.encryptedSha256 !== metadata.encryptedSha256 || remoteManifest.encryptedBytes !== metadata.encryptedBytes) {
      throw new OffsiteBackupError("remote_identity_mismatch");
    }

    const restoredPath = join(directory, input.backupId + ".restore-test.tar.gz");
    activeStage = "remote_decrypt";
    await decryptBackupArchive({
      sourcePath: remoteEncryptedPath,
      destinationPath: restoredPath,
      keyring: input.keyring,
      expectedSourceSha256: input.archiveSha256.toLowerCase(),
    });
    const restored = await digestFile(restoredPath);
    if (restored.sha256 !== input.archiveSha256.toLowerCase() || restored.bytes !== input.archiveBytes) {
      throw new OffsiteBackupError("remote_identity_mismatch");
    }
    await writeRestoreSidecar(restoredPath, input.archiveSha256.toLowerCase());
    activeStage = "restore_verification";
    await mkdir(input.restoreStatusRoot, { recursive: true, mode: 0o700 });
    try {
      await input.restoreVerifier({ archivePath: restoredPath, restoreStatusRoot: input.restoreStatusRoot, backupId: input.backupId });
    } catch {
      throw new OffsiteBackupError("restore_verification_failed");
    }

    const verifiedManifest = { ...metadata, verification: "verified" };
    writeFileSync(manifestPath, JSON.stringify(verifiedManifest) + "\n", { mode: 0o600 });
    const verifiedManifestInfo = await stat(manifestPath);
    const verifiedManifestSha256 = (await digestFile(manifestPath)).sha256;
    activeStage = "manifest_finalization";
    await uploadMedia(context, { fileId: manifestFile.id!, sourcePath: manifestPath, size: verifiedManifestInfo.size, mimeType: MANIFEST_MIME_TYPE });
    const verifiedManifestMetadata = await getFileMetadata(context, manifestFile.id!);
    validateRemoteFile(verifiedManifestMetadata.file!, {
      fileId: manifestFile.id!,
      backupId: input.backupId,
      kind: "manifest",
      sourceSha256: encrypted.sourceSha256,
      encryptedSha256: encrypted.encryptedSha256,
      size: verifiedManifestInfo.size,
    });
    const verifiedManifestDownloadPath = join(directory, input.backupId + ".verified.manifest.json");
    await downloadFile(context, {
      fileId: manifestFile.id!,
      destinationPath: verifiedManifestDownloadPath,
      expectedSha256: verifiedManifestSha256,
      expectedBytes: verifiedManifestInfo.size,
    });
    let downloadedVerifiedManifest: typeof verifiedManifest;
    try {
      downloadedVerifiedManifest = JSON.parse(readFileSync(verifiedManifestDownloadPath, "utf8")) as typeof verifiedManifest;
    } catch {
      throw new OffsiteBackupError("remote_identity_mismatch");
    }
    if (downloadedVerifiedManifest.verification !== "verified" || downloadedVerifiedManifest.backupId !== input.backupId
      || downloadedVerifiedManifest.sourceSha256 !== encrypted.sourceSha256 || downloadedVerifiedManifest.encryptedSha256 !== encrypted.encryptedSha256
      || downloadedVerifiedManifest.encryptedBytes !== encrypted.encryptedBytes) {
      throw new OffsiteBackupError("remote_identity_mismatch");
    }

    const verifiedAt = input.now ?? Date.now();
    await input.database.prepare("UPDATE business_reporting_backup_runs SET status='verified', source_sha256=?, encrypted_sha256=?, drive_file_id=?, manifest_file_id=?, source_bytes=?, encrypted_bytes=?, verified_at=?, error_code=NULL, updated_at=? WHERE backup_id=?")
      .bind(encrypted.sourceSha256, encrypted.encryptedSha256, archiveFile.id, manifestFile.id, encrypted.sourceBytes, encrypted.encryptedBytes, verifiedAt, verifiedAt, input.backupId).run();
    await input.database.prepare("UPDATE business_reporting_sync_state SET last_backup_id=?, last_backup_drive_file_id=?, updated_at=? WHERE id='primary'")
      .bind(input.backupId, archiveFile.id, verifiedAt).run();
    await finishBackupAudit(input.database, auditId, verifiedAt, "success", null);
    return { status: "verified", backupId: input.backupId, archiveFileId: archiveFile.id, manifestFileId: manifestFile.id };
  } catch (error) {
    const errorCode = activeStage === "restore_verification" ? "restore_verification_failed" : backupErrorCode(error);
    await input.database.prepare("INSERT INTO business_reporting_backup_runs (backup_id, status, source_sha256, encrypted_sha256, drive_file_id, manifest_file_id, source_bytes, encrypted_bytes, verified_at, error_code, created_at, updated_at) VALUES (?, 'failed', ?, NULL, NULL, NULL, ?, NULL, NULL, ?, ?, ?) ON CONFLICT(backup_id) DO UPDATE SET status='failed', error_code=excluded.error_code, updated_at=excluded.updated_at")
      .bind(input.backupId, input.archiveSha256.toLowerCase(), input.archiveBytes, errorCode, now, now).run();
    await input.database.prepare("UPDATE business_reporting_sync_state SET last_backup_id=?, last_backup_status='failed', last_backup_error_code=?, updated_at=? WHERE id='primary'")
      .bind(input.backupId, errorCode, now).run();
    await finishBackupAudit(input.database, auditId, now, "failure", errorCode);
    return { status: "failed", backupId: input.backupId, errorCode };
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

export function selectOffsiteRetentionReferences(candidates: LocalBackupRetentionCandidate[]): LocalBackupRetentionReference[] {
  const byBackupId = new Map<string, LocalBackupRetentionReference>();
  for (const candidate of candidates) {
    if (!validId(candidate.backupId) || !validHash(candidate.archiveSha256) || !validRetentionClass(candidate.retentionClass)
      || !Number.isSafeInteger(candidate.archiveBytes) || candidate.archiveBytes < 1 || !Number.isFinite(Date.parse(candidate.backupTimestamp))
      || !candidate.archivePath) throw new OffsiteBackupError("invalid_local_archive");
  }
  for (const retentionClass of Object.keys(RETENTION_LIMITS) as BackupRetentionClass[]) {
    const selected = candidates
      .filter((candidate) => candidate.retentionClass === retentionClass)
      .sort((left, right) => right.backupTimestamp.localeCompare(left.backupTimestamp))
      .slice(0, RETENTION_LIMITS[retentionClass]);
    for (const candidate of selected) {
      const existing = byBackupId.get(candidate.backupId);
      if (existing) {
        if (existing.archiveSha256 !== candidate.archiveSha256 || existing.archiveBytes !== candidate.archiveBytes) {
          throw new OffsiteBackupError("invalid_local_archive");
        }
        if (!existing.retentionClasses.includes(retentionClass)) existing.retentionClasses.push(retentionClass);
      } else {
        byBackupId.set(candidate.backupId, {
          backupId: candidate.backupId,
          archivePath: candidate.archivePath,
          archiveSha256: candidate.archiveSha256.toLowerCase(),
          archiveBytes: candidate.archiveBytes,
          backupTimestamp: candidate.backupTimestamp,
          retentionClasses: [retentionClass],
        });
      }
    }
  }
  return [...byBackupId.values()].sort((left, right) => right.backupTimestamp.localeCompare(left.backupTimestamp));
}

export async function mirrorBackupRetention(input: {
  database: D1Database;
  owner: DriveContext["owner"];
  config: DriveRuntimeConfig;
  references: Array<{ backupId: string; retentionClasses: BackupRetentionClass[] }>;
  verifiedBackupIds: string[];
  request?: BackupRequest;
  sleep?: (milliseconds: number) => Promise<void>;
  random?: () => number;
}): Promise<{ trashedFileIds: string[] }> {
  const desiredIds = new Set<string>();
  for (const reference of input.references) {
    if (!validId(reference.backupId) || !reference.retentionClasses.length || !reference.retentionClasses.every(validRetentionClass)) {
      throw new OffsiteBackupError("invalid_local_archive");
    }
    desiredIds.add(reference.backupId);
  }
  const verified = new Set(input.verifiedBackupIds);
  if ([...desiredIds].some((backupId) => !verified.has(backupId))) throw new OffsiteBackupError("retention_unverified");

  const context: DriveContext = {
    database: input.database,
    owner: input.owner,
    config: input.config,
    request: input.request,
    sleep: input.sleep,
    random: input.random,
  };
  const files = await listManagedFiles(context);
  const byIdentity = new Map<string, ManagedDriveFile[]>();
  for (const file of files) {
    if (file.appProperties?.[APP_PROPERTY] !== APP_PROPERTY_VALUE || typeof file.id !== "string") continue;
    const backupId = file.appProperties.backupId;
    const kind = file.appProperties.kind;
    if (!validId(backupId ?? "") || (kind !== "archive" && kind !== "manifest")) throw new OffsiteBackupError("remote_identity_mismatch");
    const key = backupId + ":" + kind;
    const entries = byIdentity.get(key) ?? [];
    entries.push(file);
    byIdentity.set(key, entries);
  }
  for (const backupId of desiredIds) {
    const row = await input.database.prepare("SELECT status, source_sha256 AS sourceSha256, encrypted_sha256 AS encryptedSha256, drive_file_id AS driveFileId, manifest_file_id AS manifestFileId, source_bytes AS sourceBytes, encrypted_bytes AS encryptedBytes, verified_at AS verifiedAt FROM business_reporting_backup_runs WHERE backup_id=?")
      .bind(backupId).first<{
        status: string;
        sourceSha256: string | null;
        encryptedSha256: string | null;
        driveFileId: string | null;
        manifestFileId: string | null;
        sourceBytes: number | null;
        encryptedBytes: number | null;
        verifiedAt: number | null;
      }>();
    if (row?.status !== "verified" || !validHash(row.sourceSha256 ?? "") || !validHash(row.encryptedSha256 ?? "")
      || !row.driveFileId || !row.manifestFileId || !Number.isSafeInteger(row.sourceBytes) || Number(row.sourceBytes) < 1
      || !Number.isSafeInteger(row.encryptedBytes) || Number(row.encryptedBytes) < 1 || !row.verifiedAt) {
      throw new OffsiteBackupError("retention_unverified");
    }
    for (const kind of ["archive", "manifest"] as const) {
      const entries = byIdentity.get(backupId + ":" + kind) ?? [];
      if (entries.length !== 1) throw new OffsiteBackupError(entries.length > 1 ? "duplicate_remote_file" : "retention_unverified");
      const file = entries[0]!;
      if (kind === "archive") {
        validateRemoteFile(file, {
          fileId: row.driveFileId,
          backupId,
          kind,
          sourceSha256: row.sourceSha256!,
          encryptedSha256: row.encryptedSha256!,
          size: Number(row.encryptedBytes),
        });
      } else if (file.id !== row.manifestFileId || file.name !== remoteName(backupId, kind) || file.mimeType !== remoteMime(kind)
        || file.trashed === true || file.appProperties?.[APP_PROPERTY] !== APP_PROPERTY_VALUE
        || file.appProperties?.backupId !== backupId || file.appProperties?.kind !== kind
        || file.appProperties?.sourceSha256 !== row.sourceSha256 || file.appProperties?.encryptedSha256 !== row.encryptedSha256
        || !Number.isSafeInteger(Number(file.size)) || Number(file.size) < 1) {
        throw new OffsiteBackupError("remote_identity_mismatch");
      }
    }
  }

  const obsolete = files.filter((file) => file.appProperties?.[APP_PROPERTY] === APP_PROPERTY_VALUE
    && typeof file.id === "string" && !desiredIds.has(file.appProperties.backupId ?? ""));
  const trashedFileIds: string[] = [];
  for (const file of obsolete) {
    const url = DRIVE_FILES_URL + "/" + encodeURIComponent(file.id!);
    await callApi(context, url, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ trashed: true }),
    });
    trashedFileIds.push(file.id!);
  }
  return { trashedFileIds };
}
