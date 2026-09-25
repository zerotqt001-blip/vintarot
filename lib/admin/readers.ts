import type { D1Database } from "@cloudflare/workers-types";
import { z } from "zod";
import { prepareAuditInsert } from "../audit/service";
import { normalizeGoogleDriveImageUrl } from "../google-drive-image";

function isIanaTimezone(value: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

export const readerProfileSchema = z.object({
  name: z.string().trim().min(1).max(80),
  bio: z.string().trim().min(20).max(3000),
  timezone: z.string().trim().min(1).max(100).refine(isIanaTimezone, "Enter a valid IANA time zone."),
  language: z.string().trim().min(1).max(100),
  duration: z.number().int().min(15).max(120),
  price: z.number().int().min(0).max(100_000_000),
  published: z.boolean(),
  slots: z.array(z.string().datetime()).max(50),
  driveImageUrl: z.string().trim().max(2000).nullable().refine((value) => value === null || normalizeGoogleDriveImageUrl(value) !== null, "Enter a Google Drive file link."),
}).strict();

export type ReaderProfileInput = z.infer<typeof readerProfileSchema>;
export type ReaderView = ReaderProfileInput & {
  id: string;
  avatarUrl: string | null;
  createdAt: number;
  updatedAt: number;
};
export type ReaderPublic = Pick<ReaderView, "id" | "name" | "bio" | "timezone" | "language" | "duration" | "price" | "published" | "slots" | "avatarUrl">;

export class ReaderAdminError extends Error {
  readonly code: "invalid" | "not_found";

  constructor(code: "invalid" | "not_found", message: string) {
    super(message);
    this.name = "ReaderAdminError";
    this.code = code;
  }
}

export const readerIdSchema = z.string().uuid();

type ReaderRow = Record<string, unknown>;

function parseSlots(value: unknown): string[] {
  try {
    const parsed = JSON.parse(String(value ?? "[]"));
    return z.array(z.string().datetime()).max(50).parse(parsed);
  } catch {
    return [];
  }
}

function readerView(row: ReaderRow, visibility: "public" | "admin"): ReaderView {
  const id = String(row.id);
  const uploadedAt = row.avatar_updated_at == null ? null : Number(row.avatar_updated_at);
  const driveImageUrl = row.drive_image_url == null ? null : String(row.drive_image_url);
  const normalizedDriveUrl = driveImageUrl ? normalizeGoogleDriveImageUrl(driveImageUrl)?.imageUrl ?? null : null;
  return {
    id,
    name: String(row.name),
    bio: String(row.bio),
    timezone: String(row.timezone),
    language: String(row.language),
    duration: Number(row.duration),
    price: Number(row.price),
    published: Number(row.published) === 1,
    slots: parseSlots(row.slots_json),
    driveImageUrl: visibility === "admin" ? driveImageUrl : null,
    avatarUrl: uploadedAt !== null
      ? `${visibility === "admin" ? "/api/admin/readers" : "/api/readers"}/${encodeURIComponent(id)}/avatar?v=${uploadedAt}`
      : normalizedDriveUrl,
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
  };
}

const readerSelect = `SELECT r.id, r.name, r.bio, r.timezone, r.language, r.duration, r.price, r.slots_json,
  r.drive_image_url, r.published, r.created_at, r.updated_at, a.updated_at AS avatar_updated_at
  FROM readers r LEFT JOIN reader_avatars a ON a.reader_id=r.id`;

export async function listPublishedReaders(database: D1Database): Promise<ReaderPublic[]> {
  const rows = await database.prepare(`${readerSelect} WHERE r.published=1 ORDER BY r.updated_at DESC, r.id ASC`).all<ReaderRow>();
  const now = Date.now();
  return rows.results.map((row) => {
    const view = readerView(row, "public");
    return { id: view.id, name: view.name, bio: view.bio, timezone: view.timezone, language: view.language, duration: view.duration, price: view.price, published: view.published, slots: view.slots.filter((slot) => Date.parse(slot) > now), avatarUrl: view.avatarUrl };
  });
}

export async function listAdminReaders(database: D1Database): Promise<ReaderView[]> {
  const rows = await database.prepare(`${readerSelect} ORDER BY r.updated_at DESC, r.id ASC`).all<ReaderRow>();
  return rows.results.map((row) => readerView(row, "admin"));
}

async function getReader(database: D1Database, id: string, visibility: "public" | "admin"): Promise<ReaderView | null> {
  const row = await database.prepare(`${readerSelect} WHERE r.id=?${visibility === "public" ? " AND r.published=1" : ""} LIMIT 1`)
    .bind(id)
    .first<ReaderRow>();
  return row ? readerView(row, visibility) : null;
}

async function existingAuditTarget(database: D1Database, key: string): Promise<string | null> {
  const existing = await database.prepare("SELECT target_id FROM audit_events WHERE idempotency_key=? LIMIT 1").bind(key).first<{ target_id: string | null }>();
  return existing?.target_id == null ? null : String(existing.target_id);
}

function auditStatement(database: D1Database, actorId: string, action: string, id: string, reason: string, idempotencyKey: string, metadata: Record<string, unknown>, auditId: string, guard = true) {
  return prepareAuditInsert(database, {
    id: auditId,
    actorKind: "member",
    actorId,
    action,
    targetType: "reader",
    targetId: id,
    reason,
    idempotencyKey,
    metadata,
  }, Date.now(), guard ? { guardSql: "EXISTS (SELECT 1 FROM readers WHERE id=?)", guardValues: [id] } : {});
}

export async function createAdminReader(
  database: D1Database,
  actorId: string,
  input: ReaderProfileInput,
  reason: string,
  idempotencyToken: string,
): Promise<ReaderView> {
  const auditKey = `admin.reader.create:${actorId}:${idempotencyToken}`;
  const replayTarget = await existingAuditTarget(database, auditKey);
  if (replayTarget) {
    const replay = await getReader(database, replayTarget, "admin");
    if (replay) return replay;
  }
  const id = crypto.randomUUID();
  const auditId = crypto.randomUUID();
  const now = Date.now();
  const [auditResult, insertResult] = await database.batch([
    auditStatement(database, actorId, "reader.profile.created", id, reason, auditKey, { published: input.published }, auditId, false),
    database.prepare("INSERT INTO readers (id,name,bio,timezone,language,duration,price,slots_json,drive_image_url,published,created_by,updated_by,created_at,updated_at) SELECT ?,?,?,?,?,?,?,?,?,?,?,?,?,? WHERE EXISTS (SELECT 1 FROM audit_events WHERE id=? AND idempotency_key=?)")
      .bind(id, input.name, input.bio, input.timezone, input.language, input.duration, input.price, JSON.stringify(input.slots), input.driveImageUrl ? normalizeGoogleDriveImageUrl(input.driveImageUrl)?.imageUrl ?? null : null, input.published ? 1 : 0, actorId, actorId, now, now, auditId, auditKey),
  ]);
  if (Number(auditResult?.meta?.changes ?? 0) !== 1) {
    const replayedTarget = await existingAuditTarget(database, auditKey);
    const replay = replayedTarget ? await getReader(database, replayedTarget, "admin") : null;
    if (replay) return replay;
    throw new ReaderAdminError("not_found", "Reader profile was not created.");
  }
  if (Number(insertResult?.meta?.changes ?? 0) !== 1) throw new ReaderAdminError("not_found", "Reader profile was not created.");
  const created = await getReader(database, id, "admin");
  if (!created) throw new ReaderAdminError("not_found", "Reader profile was not created.");
  return created;
}

export async function updateAdminReader(
  database: D1Database,
  actorId: string,
  id: string,
  input: ReaderProfileInput,
  reason: string,
  idempotencyToken: string,
): Promise<ReaderView> {
  const auditKey = `admin.reader.update:${actorId}:${id}:${idempotencyToken}`;
  const replayTarget = await existingAuditTarget(database, auditKey);
  if (replayTarget) {
    if (replayTarget !== id) throw new ReaderAdminError("invalid", "Invalid reader update.");
    const replay = await getReader(database, id, "admin");
    if (replay) return replay;
  }
  const auditId = crypto.randomUUID();
  const now = Date.now();
  const mutation = database.prepare("UPDATE readers SET name=?,bio=?,timezone=?,language=?,duration=?,price=?,slots_json=?,drive_image_url=?,published=?,updated_by=?,updated_at=? WHERE id=? AND EXISTS (SELECT 1 FROM audit_events WHERE id=? AND idempotency_key=?)")
    .bind(input.name, input.bio, input.timezone, input.language, input.duration, input.price, JSON.stringify(input.slots), input.driveImageUrl ? normalizeGoogleDriveImageUrl(input.driveImageUrl)?.imageUrl ?? null : null, input.published ? 1 : 0, actorId, now, id, auditId, auditKey);
  const audit = auditStatement(database, actorId, "reader.profile.updated", id, reason, auditKey, { published: input.published, slotCount: input.slots.length }, auditId);
  const statements = input.driveImageUrl
    ? [audit, mutation, database.prepare("DELETE FROM reader_avatars WHERE reader_id=? AND EXISTS (SELECT 1 FROM audit_events WHERE id=? AND idempotency_key=?)").bind(id, auditId, auditKey)]
    : [audit, mutation];
  const [auditResult, result] = await database.batch(statements);
  if (Number(auditResult?.meta?.changes ?? 0) !== 1) {
    const replayTarget = await existingAuditTarget(database, auditKey);
    if (replayTarget === id) {
      const replay = await getReader(database, id, "admin");
      if (replay) return replay;
    }
    throw new ReaderAdminError("not_found", "Reader profile not found.");
  }
  if (Number(result?.meta?.changes ?? 0) !== 1) throw new ReaderAdminError("not_found", "Reader profile not found.");
  const updated = await getReader(database, id, "admin");
  if (!updated) throw new ReaderAdminError("not_found", "Reader profile not found.");
  return updated;
}

export async function saveReaderAvatar(
  database: D1Database,
  actorId: string,
  id: string,
  bytes: Uint8Array,
  contentType: string,
  reason: string,
  idempotencyToken: string,
): Promise<void> {
  const auditKey = `admin.reader.avatar:${actorId}:${id}:${idempotencyToken}`;
  const replayTarget = await existingAuditTarget(database, auditKey);
  if (replayTarget) {
    if (replayTarget !== id) throw new ReaderAdminError("invalid", "Invalid avatar request.");
    return;
  }
  const reader = await database.prepare("SELECT id FROM readers WHERE id=? LIMIT 1").bind(id).first<{ id: string }>();
  if (!reader) throw new ReaderAdminError("not_found", "Reader profile not found.");
  const auditId = crypto.randomUUID();
  const now = Date.now();
  const [auditResult, avatarResult, readerResult] = await database.batch([
    auditStatement(database, actorId, "reader.avatar.uploaded", id, reason, auditKey, { contentType, sizeBytes: bytes.byteLength }, auditId),
    database.prepare("INSERT INTO reader_avatars (reader_id,bytes,content_type,size_bytes,updated_at) SELECT ?,?,?,?,? WHERE EXISTS (SELECT 1 FROM audit_events WHERE id=? AND idempotency_key=?) ON CONFLICT(reader_id) DO UPDATE SET bytes=excluded.bytes,content_type=excluded.content_type,size_bytes=excluded.size_bytes,updated_at=excluded.updated_at")
      .bind(id, bytes, contentType, bytes.byteLength, now, auditId, auditKey),
    database.prepare("UPDATE readers SET drive_image_url=NULL,updated_by=?,updated_at=? WHERE id=? AND EXISTS (SELECT 1 FROM audit_events WHERE id=? AND idempotency_key=?)").bind(actorId, now, id, auditId, auditKey),
  ]);
  if (Number(auditResult?.meta?.changes ?? 0) !== 1) {
    if (await existingAuditTarget(database, auditKey) === id) return;
    throw new ReaderAdminError("not_found", "Reader profile not found.");
  }
  if (Number(avatarResult?.meta?.changes ?? 0) !== 1 || Number(readerResult?.meta?.changes ?? 0) !== 1) throw new ReaderAdminError("not_found", "Reader profile not found.");
}

export async function removeReaderAvatar(database: D1Database, actorId: string, id: string, reason: string, idempotencyToken: string): Promise<void> {
  const auditKey = `admin.reader.avatar.remove:${actorId}:${id}:${idempotencyToken}`;
  const replayTarget = await existingAuditTarget(database, auditKey);
  if (replayTarget) {
    if (replayTarget !== id) throw new ReaderAdminError("invalid", "Invalid avatar request.");
    return;
  }
  const reader = await database.prepare("SELECT id FROM readers WHERE id=? LIMIT 1").bind(id).first<{ id: string }>();
  if (!reader) throw new ReaderAdminError("not_found", "Reader profile not found.");
  const auditId = crypto.randomUUID();
  const now = Date.now();
  const results = await database.batch([
    auditStatement(database, actorId, "reader.avatar.removed", id, reason, auditKey, {}, auditId),
    database.prepare("DELETE FROM reader_avatars WHERE reader_id=? AND EXISTS (SELECT 1 FROM audit_events WHERE id=? AND idempotency_key=?)").bind(id, auditId, auditKey),
    database.prepare("UPDATE readers SET drive_image_url=NULL,updated_by=?,updated_at=? WHERE id=? AND EXISTS (SELECT 1 FROM audit_events WHERE id=? AND idempotency_key=?)").bind(actorId, now, id, auditId, auditKey),
  ]);
  if (Number(results[0]?.meta?.changes ?? 0) !== 1) {
    if (await existingAuditTarget(database, auditKey) === id) return;
    throw new ReaderAdminError("not_found", "Reader profile not found.");
  }
  if (Number(results[2]?.meta?.changes ?? 0) !== 1) throw new ReaderAdminError("not_found", "Reader profile not found.");
}

export async function getReaderAvatar(database: D1Database, id: string, visibility: "public" | "admin") {
  const reader = await database.prepare(`SELECT published FROM readers WHERE id=?${visibility === "public" ? " AND published=1" : ""} LIMIT 1`).bind(id).first<{ published: number }>();
  if (!reader) return null;
  const avatar = await database.prepare("SELECT bytes,content_type FROM reader_avatars WHERE reader_id=? LIMIT 1").bind(id).first<{ bytes: ArrayBuffer | Uint8Array; content_type: string }>();
  if (!avatar) return null;
  const bytes = avatar.bytes instanceof Uint8Array ? avatar.bytes : new Uint8Array(avatar.bytes);
  return { bytes, contentType: String(avatar.content_type) };
}
