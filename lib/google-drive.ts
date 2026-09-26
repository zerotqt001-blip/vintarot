import type { D1Database } from "@cloudflare/workers-types";
import type { EncryptionKeyring } from "./security/encryption";
import { decryptField, encryptField } from "./security/encryption";
import { safeRelativeReturnPath } from "./member-auth";

const GOOGLE_AUTHORIZE_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_REVOKE_URL = "https://oauth2.googleapis.com/revoke";
const GOOGLE_USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo";
const DRIVE_FILES_URL = "https://www.googleapis.com/drive/v3/files";
const DRIVE_UPLOAD_URL = "https://www.googleapis.com/upload/drive/v3/files";
const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";
const DRIVE_TOKEN_PURPOSE = "google-drive.refresh-token";
const STATE_TTL_MS = 10 * 60 * 1000;
export const MAX_DRIVE_EXPORT_BYTES = 8 * 1024 * 1024;

export type GoogleDriveFormat = "png" | "jpg";
export type GoogleDriveMime = "image/png" | "image/jpeg";

export type DriveRuntimeConfig = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  encryptionKeyring: EncryptionKeyring;
  fetchImpl?: typeof fetch;
  now?: () => number;
};

type DriveStateRow = {
  member_id: string;
  code_verifier: string;
  return_path: string;
  expires_at: number;
  consumed_at: number | null;
};

type DriveExportRow = {
  drive_file_id: string;
  drive_url: string;
  updated_at: number;
};

type GoogleTokenPayload = {
  access_token?: unknown;
  refresh_token?: unknown;
  scope?: unknown;
  error?: unknown;
};

export class GoogleDriveError extends Error {
  constructor(readonly code: "unavailable" | "not_connected" | "unauthorized" | "upload_failed" | "invalid_state", options?: { cause?: unknown }) {
    super("Google Drive could not complete this request.", options?.cause === undefined ? undefined : { cause: options.cause });
    this.name = "GoogleDriveError";
  }
}

function encodeBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function digest(value: string): Promise<string> {
  const bytes = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return encodeBase64Url(new Uint8Array(bytes));
}

export async function hashGoogleDriveState(value: string): Promise<string> {
  return digest(value);
}

function randomBase64Url(size = 32): string {
  const bytes = new Uint8Array(size);
  globalThis.crypto.getRandomValues(bytes);
  return encodeBase64Url(bytes);
}

async function pkceChallenge(verifier: string): Promise<string> {
  const bytes = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return encodeBase64Url(new Uint8Array(bytes));
}

async function responseJson(response: Response): Promise<Record<string, unknown>> {
  try {
    const value: unknown = await response.json();
    return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

function bytesMatch(bytes: Uint8Array, expected: number[]): boolean {
  return bytes.length >= expected.length && expected.every((byte, index) => bytes[index] === byte);
}

export function googleDriveFormat(value: string): { format: GoogleDriveFormat; mimeType: GoogleDriveMime; extension: string } | null {
  if (value === "png") return { format: "png", mimeType: "image/png", extension: "png" };
  if (value === "jpg") return { format: "jpg", mimeType: "image/jpeg", extension: "jpg" };
  return null;
}

export function validGoogleDriveImage(bytes: Uint8Array, mimeType: GoogleDriveMime): boolean {
  return mimeType === "image/png"
    ? bytesMatch(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    : bytesMatch(bytes, [0xff, 0xd8, 0xff]);
}

export async function createGoogleDriveAuthorizationUrl(input: {
  config: DriveRuntimeConfig;
  database: D1Database;
  memberId: string;
  returnPath: string;
  now?: number;
}): Promise<{ url: string; rawState: string }> {
  const now = input.now ?? input.config.now?.() ?? Date.now();
  const rawState = randomBase64Url();
  const verifier = randomBase64Url(48);
  const expiresAt = now + STATE_TTL_MS;
  await input.database.prepare(`INSERT INTO google_drive_oauth_states
    (state_hash, member_id, code_verifier, return_path, created_at, expires_at, consumed_at)
    VALUES (?, ?, ?, ?, ?, ?, NULL)`)
    .bind(await digest(rawState), input.memberId, verifier, safeRelativeReturnPath(input.returnPath), now, expiresAt)
    .run();
  await input.database.prepare("DELETE FROM google_drive_oauth_states WHERE expires_at <= ? OR created_at < ?")
    .bind(now, now - 24 * 60 * 60 * 1000)
    .run();

  const params = new URLSearchParams({
    client_id: input.config.clientId,
    redirect_uri: input.config.redirectUri,
    response_type: "code",
    scope: `openid email ${DRIVE_SCOPE}`,
    state: rawState,
    code_challenge: await pkceChallenge(verifier),
    code_challenge_method: "S256",
    access_type: "offline",
    include_granted_scopes: "true",
    prompt: "consent",
  });
  return { url: `${GOOGLE_AUTHORIZE_URL}?${params.toString().replace(/\+/g, "%20")}`, rawState };
}

export async function peekGoogleDriveOAuthState(database: D1Database, rawState: string, now = Date.now()): Promise<boolean> {
  if (!/^[A-Za-z0-9_-]{32,100}$/.test(rawState)) return false;
  const row = await database.prepare(`SELECT 1 AS present FROM google_drive_oauth_states
    WHERE state_hash=? AND created_at >= ? LIMIT 1`).bind(await digest(rawState), now - 24 * 60 * 60 * 1000).first<{ present: number }>();
  return Boolean(row);
}

export async function consumeGoogleDriveOAuthState(database: D1Database, rawState: string, now = Date.now()): Promise<DriveStateRow | null> {
  if (!/^[A-Za-z0-9_-]{32,100}$/.test(rawState)) return null;
  const stateHash = await digest(rawState);
  const update = await database.prepare(`UPDATE google_drive_oauth_states SET consumed_at=?
    WHERE state_hash=? AND consumed_at IS NULL AND expires_at > ?`).bind(now, stateHash, now).run();
  if (Number(update.meta.changes) !== 1) return null;
  return database.prepare(`SELECT member_id, code_verifier, return_path, expires_at, consumed_at
    FROM google_drive_oauth_states WHERE state_hash=?`).bind(stateHash).first<DriveStateRow>();
}

export async function exchangeGoogleDriveCode(input: {
  config: DriveRuntimeConfig;
  code: string;
  verifier: string;
}): Promise<{ accessToken: string; refreshToken: string | null; scope: string }> {
  const fetchImpl = input.config.fetchImpl ?? fetch;
  try {
    const response = await fetchImpl(GOOGLE_TOKEN_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code: input.code,
        client_id: input.config.clientId,
        client_secret: input.config.clientSecret,
        redirect_uri: input.config.redirectUri,
        grant_type: "authorization_code",
        code_verifier: input.verifier,
      }).toString(),
    });
    const payload = await responseJson(response) as GoogleTokenPayload;
    if (!response.ok || typeof payload.access_token !== "string" || !payload.access_token) throw new Error("Google token exchange failed");
    const scopes = typeof payload.scope === "string" ? payload.scope : "";
    if (scopes && !scopes.split(/\s+/).includes(DRIVE_SCOPE)) throw new Error("Google Drive permission was not granted");
    return {
      accessToken: payload.access_token,
      refreshToken: typeof payload.refresh_token === "string" && payload.refresh_token ? payload.refresh_token : null,
      scope: scopes,
    };
  } catch (error) {
    throw new GoogleDriveError("unavailable", { cause: error });
  }
}

export async function readGoogleDriveIdentity(input: { accessToken: string; fetchImpl?: typeof fetch }): Promise<{ subject: string; email: string }> {
  try {
    const response = await (input.fetchImpl ?? fetch)(GOOGLE_USERINFO_URL, {
      headers: { authorization: `Bearer ${input.accessToken}` },
    });
    const payload = await responseJson(response);
    if (!response.ok || typeof payload.sub !== "string" || !payload.sub.trim() || typeof payload.email !== "string" || payload.email_verified !== true) {
      throw new Error("Google identity could not be verified");
    }
    return { subject: payload.sub.trim(), email: payload.email.trim().toLowerCase() };
  } catch (error) {
    throw new GoogleDriveError("unavailable", { cause: error });
  }
}

export async function saveGoogleDriveConnection(input: {
  database: D1Database;
  config: DriveRuntimeConfig;
  memberId: string;
  googleSubject: string;
  googleEmail: string;
  refreshToken: string | null;
  scope: string;
  now?: number;
}): Promise<void> {
  let refreshToken = input.refreshToken;
  const existing = await input.database.prepare(`SELECT google_subject, refresh_token_ciphertext FROM google_drive_connections
    WHERE member_id=? LIMIT 1`).bind(input.memberId).first<{ google_subject: string; refresh_token_ciphertext: string }>();
  if (!refreshToken && existing?.google_subject === input.googleSubject) {
    refreshToken = await decryptField(existing.refresh_token_ciphertext, DRIVE_TOKEN_PURPOSE, input.config.encryptionKeyring);
  }
  if (!refreshToken) throw new GoogleDriveError("unavailable");
  const ciphertext = await encryptField(refreshToken, DRIVE_TOKEN_PURPOSE, input.config.encryptionKeyring);
  const now = input.now ?? input.config.now?.() ?? Date.now();
  await input.database.prepare(`INSERT INTO google_drive_connections
    (member_id, google_subject, google_email, refresh_token_ciphertext, granted_scope, connected_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(member_id) DO UPDATE SET google_subject=excluded.google_subject,
      google_email=excluded.google_email, refresh_token_ciphertext=excluded.refresh_token_ciphertext,
      granted_scope=excluded.granted_scope, updated_at=excluded.updated_at`)
    .bind(input.memberId, input.googleSubject, input.googleEmail, ciphertext, input.scope, now, now)
    .run();
}

export async function getGoogleDriveConnection(database: D1Database, memberId: string): Promise<{ email: string; connectedAt: number } | null> {
  const row = await database.prepare(`SELECT google_email, connected_at FROM google_drive_connections WHERE member_id=? LIMIT 1`)
    .bind(memberId).first<{ google_email: string; connected_at: number }>();
  return row ? { email: row.google_email, connectedAt: Number(row.connected_at) } : null;
}

async function driveAccessToken(input: { database: D1Database; config: DriveRuntimeConfig; memberId: string }): Promise<string> {
  const connection = await input.database.prepare(`SELECT refresh_token_ciphertext FROM google_drive_connections WHERE member_id=? LIMIT 1`)
    .bind(input.memberId).first<{ refresh_token_ciphertext: string }>();
  if (!connection) throw new GoogleDriveError("not_connected");
  const refreshToken = await decryptField(connection.refresh_token_ciphertext, DRIVE_TOKEN_PURPOSE, input.config.encryptionKeyring);
  try {
    const response = await (input.config.fetchImpl ?? fetch)(GOOGLE_TOKEN_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: input.config.clientId,
        client_secret: input.config.clientSecret,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }).toString(),
    });
    const payload = await responseJson(response) as GoogleTokenPayload;
    if (!response.ok || typeof payload.access_token !== "string" || !payload.access_token) {
      if (response.status === 400 || response.status === 401) {
        await input.database.prepare("DELETE FROM google_drive_connections WHERE member_id=?").bind(input.memberId).run();
        throw new GoogleDriveError("not_connected");
      }
      throw new Error("Google access token refresh failed");
    }
    return payload.access_token;
  } catch (error) {
    if (error instanceof GoogleDriveError) throw error;
    throw new GoogleDriveError("unavailable", { cause: error });
  }
}

async function driveRequest(input: {
  config: DriveRuntimeConfig;
  accessToken: string;
  url: string;
  method?: string;
  headers?: HeadersInit;
  body?: BodyInit | null;
  duplex?: "half";
}): Promise<Response> {
  const headers = new Headers(input.headers);
  headers.set("authorization", "Bearer " + input.accessToken);
  const requestInit = {
    method: input.method ?? "GET",
    headers,
    body: input.body,
    duplex: input.duplex,
  } as RequestInit & { duplex?: "half" };
  return (input.config.fetchImpl ?? fetch)(input.url, requestInit);
}

export async function authenticatedGoogleRequest(input: {
  database: D1Database;
  config: DriveRuntimeConfig;
  memberId: string;
  url: string;
  method?: string;
  headers?: HeadersInit;
  body?: BodyInit | null;
  duplex?: "half";
}): Promise<Response> {
  let url: URL;
  try {
    url = new URL(input.url);
  } catch {
    throw new GoogleDriveError("unavailable");
  }
  if (url.protocol !== "https:" || url.port || url.username || url.password || !["www.googleapis.com", "sheets.googleapis.com"].includes(url.hostname)) {
    throw new GoogleDriveError("unavailable");
  }
  const accessToken = await driveAccessToken(input);
  return driveRequest({
    config: input.config,
    accessToken,
    url: url.toString(),
    method: input.method,
    headers: input.headers,
    body: input.body,
    duplex: input.duplex,
  });
}

function concatenate(chunks: Uint8Array[]): Uint8Array {
  const length = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const output = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.length;
  }
  return output;
}

async function createDriveFile(input: {
  config: DriveRuntimeConfig;
  accessToken: string;
  memberId: string;
  readingId: string;
  format: GoogleDriveFormat;
  mimeType: GoogleDriveMime;
  bytes: Uint8Array;
}): Promise<{ id: string; webViewLink?: string }> {
  const boundary = `natarot_${randomBase64Url(18)}`;
  const filename = `NaTarot-reading-${input.readingId.slice(0, 40)}.${input.format}`;
  const prefix = new TextEncoder().encode(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify({ name: filename, mimeType: input.mimeType, description: "NaTarot Tarot reading export" })}\r\n--${boundary}\r\nContent-Type: ${input.mimeType}\r\n\r\n`);
  const suffix = new TextEncoder().encode(`\r\n--${boundary}--\r\n`);
  const body = concatenate([prefix, input.bytes, suffix]);
  const url = new URL(DRIVE_UPLOAD_URL);
  url.searchParams.set("uploadType", "multipart");
  url.searchParams.set("fields", "id,name,webViewLink,mimeType");
  const response = await driveRequest({
    config: input.config,
    accessToken: input.accessToken,
    url: url.toString(),
    method: "POST",
    headers: { "content-type": `multipart/related; boundary=${boundary}` },
    body: body as unknown as BodyInit,
  });
  const payload = await responseJson(response);
  if (!response.ok || typeof payload.id !== "string") throw new GoogleDriveError("upload_failed");
  return { id: payload.id, webViewLink: typeof payload.webViewLink === "string" ? payload.webViewLink : undefined };
}

async function updateDriveFile(input: {
  config: DriveRuntimeConfig;
  accessToken: string;
  fileId: string;
  mimeType: GoogleDriveMime;
  bytes: Uint8Array;
}): Promise<boolean> {
  const url = new URL(`${DRIVE_UPLOAD_URL}/${encodeURIComponent(input.fileId)}`);
  url.searchParams.set("uploadType", "media");
  url.searchParams.set("fields", "id,name,webViewLink,mimeType");
  const response = await driveRequest({
    config: input.config,
    accessToken: input.accessToken,
    url: url.toString(),
    method: "PATCH",
    headers: { "content-type": input.mimeType },
    body: input.bytes as unknown as BodyInit,
  });
  if (response.status === 404) return false;
  if (!response.ok) throw new GoogleDriveError("upload_failed");
  return true;
}

async function ensureAnyoneReader(input: { config: DriveRuntimeConfig; accessToken: string; fileId: string }): Promise<void> {
  const url = new URL(`${DRIVE_FILES_URL}/${encodeURIComponent(input.fileId)}/permissions`);
  url.searchParams.set("fields", "permissions(id,type,role,deleted)");
  const listResponse = await driveRequest({ config: input.config, accessToken: input.accessToken, url: url.toString() });
  const listing = await responseJson(listResponse);
  if (!listResponse.ok) throw new GoogleDriveError("upload_failed");
  const permissions = Array.isArray(listing.permissions) ? listing.permissions : [];
  const publicReader = permissions.some((permission) => permission && typeof permission === "object"
    && (permission as Record<string, unknown>).type === "anyone"
    && (permission as Record<string, unknown>).role === "reader"
    && (permission as Record<string, unknown>).deleted !== true);
  if (publicReader) return;
  const createResponse = await driveRequest({
    config: input.config,
    accessToken: input.accessToken,
    url: `${DRIVE_FILES_URL}/${encodeURIComponent(input.fileId)}/permissions`,
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ type: "anyone", role: "reader" }),
  });
  if (!createResponse.ok) throw new GoogleDriveError("upload_failed");
}

export async function uploadGoogleDriveReadingImage(input: {
  database: D1Database;
  config: DriveRuntimeConfig;
  memberId: string;
  readingId: string;
  format: GoogleDriveFormat;
  mimeType: GoogleDriveMime;
  bytes: Uint8Array;
  now?: number;
}): Promise<{ fileId: string; url: string; updatedAt: number }> {
  if (input.bytes.byteLength < 1 || input.bytes.byteLength > MAX_DRIVE_EXPORT_BYTES || !validGoogleDriveImage(input.bytes, input.mimeType)) {
    throw new GoogleDriveError("upload_failed");
  }
  const accessToken = await driveAccessToken(input);
  const existing = await input.database.prepare(`SELECT drive_file_id, drive_url, updated_at FROM reading_drive_exports
    WHERE member_id=? AND reading_id=? AND mime_type=? LIMIT 1`)
    .bind(input.memberId, input.readingId, input.mimeType).first<DriveExportRow>();

  let fileId = existing?.drive_file_id;
  let url = existing?.drive_url;
  if (fileId) {
    const updated = await updateDriveFile({ config: input.config, accessToken, fileId, mimeType: input.mimeType, bytes: input.bytes });
    if (!updated) fileId = undefined;
  }
  if (!fileId) {
    const created = await createDriveFile({ ...input, accessToken });
    fileId = created.id;
    url = created.webViewLink || `https://drive.google.com/file/d/${encodeURIComponent(fileId)}/view`;
  }
  await ensureAnyoneReader({ config: input.config, accessToken, fileId });
  if (!url) url = `https://drive.google.com/file/d/${encodeURIComponent(fileId)}/view`;
  const now = input.now ?? input.config.now?.() ?? Date.now();
  const exportId = `drive-export:${globalThis.crypto.randomUUID()}`;
  await input.database.prepare(`INSERT INTO reading_drive_exports
    (id, member_id, reading_id, mime_type, drive_file_id, drive_url, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(member_id, reading_id, mime_type) DO UPDATE SET drive_file_id=excluded.drive_file_id,
      drive_url=excluded.drive_url, updated_at=excluded.updated_at`)
    .bind(exportId, input.memberId, input.readingId, input.mimeType, fileId, url, now, now)
    .run();
  return { fileId, url, updatedAt: now };
}

export async function revokeGoogleDriveConnection(input: { database: D1Database; config: DriveRuntimeConfig; memberId: string }): Promise<void> {
  const existing = await input.database.prepare(`SELECT refresh_token_ciphertext FROM google_drive_connections WHERE member_id=? LIMIT 1`)
    .bind(input.memberId).first<{ refresh_token_ciphertext: string }>();
  if (!existing) return;
  const refreshToken = await decryptField(existing.refresh_token_ciphertext, DRIVE_TOKEN_PURPOSE, input.config.encryptionKeyring);
  try {
    await (input.config.fetchImpl ?? fetch)(GOOGLE_REVOKE_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ token: refreshToken }).toString(),
    });
  } catch {
    // Local credentials are removed even when Google revocation cannot be reached.
  }
  await input.database.prepare("DELETE FROM google_drive_connections WHERE member_id=?").bind(input.memberId).run();
}

export function driveFileUrlForId(fileId: string): string {
  return `https://drive.google.com/file/d/${encodeURIComponent(fileId)}/view`;
}

export async function revokeRawGoogleDriveToken(input: { config: DriveRuntimeConfig; refreshToken: string }): Promise<void> {
  try {
    await (input.config.fetchImpl ?? fetch)(GOOGLE_REVOKE_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ token: input.refreshToken }).toString(),
    });
  } catch {
    // A failed best-effort revoke must not retain the remote credential in our database.
  }
}
