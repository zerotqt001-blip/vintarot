import type { D1Database } from "@cloudflare/workers-types";
import type { ReadingOwner } from "./tarot-guest";
import type { ShareEventInput, ShareRecord, ShareStore } from "./tarot-share-contract";

export class ShareStorageUnavailableError extends Error {
  readonly code = "share_storage_unavailable" as const;

  constructor(message = "Share links are not configured.", options?: { cause?: unknown }) {
    super(message, options?.cause === undefined ? undefined : { cause: options.cause });
    this.name = "ShareStorageUnavailableError";
  }
}

export class ShareOwnershipError extends Error {
  readonly code = "share_ownership" as const;

  constructor() {
    super("The reading is not owned by this identity.");
    this.name = "ShareOwnershipError";
  }
}

export class ShareActiveConflictError extends Error {
  readonly code = "share_active_conflict" as const;

  constructor() {
    super("An active share already exists for this reading.");
    this.name = "ShareActiveConflictError";
  }
}

export class ShareTokenHashConflictError extends Error {
  readonly code = "share_token_hash_conflict" as const;

  constructor() {
    super("The share token hash already exists.");
    this.name = "ShareTokenHashConflictError";
  }
}

export class ShareIdConflictError extends Error {
  readonly code = "share_id_conflict" as const;

  constructor() {
    super("The share id already exists.");
    this.name = "ShareIdConflictError";
  }
}

type ShareRow = {
  id: string;
  tokenHash: string;
  userId: string | null;
  guestId: string | null;
  readingId: string;
  sessionId: string;
  status: ShareRecord["status"];
  locale: ShareRecord["locale"];
  projectionVersion: string;
  geometryVersion: string;
  rendererVersion: string;
  createdAt: number;
  updatedAt: number;
  revokedAt: number | null;
  expiresAt: number | null;
};

function isUniqueConstraint(error: unknown): boolean {
  return error instanceof Error && /unique constraint failed|is not unique/i.test(error.message);
}

function isTokenHashConstraint(error: unknown): boolean {
  return error instanceof Error && /token_hash|reading_shares_token_hash_unique/i.test(error.message);
}

function isActiveReadingConstraint(error: unknown): boolean {
  return error instanceof Error && /reading_id|reading_shares_active_reading_unique/i.test(error.message);
}

function isShareIdConstraint(error: unknown): boolean {
  return error instanceof Error && /reading_shares\.id|share_id_conflict/i.test(error.message);
}

function mapRow(row: ShareRow): ShareRecord | null {
  const owner = row.userId !== null && row.guestId === null
    ? { kind: "user" as const, userId: row.userId }
    : row.userId === null && row.guestId !== null
      ? { kind: "guest" as const, guestId: row.guestId }
      : null;
  if (!owner) return null;
  return {
    id: row.id,
    tokenHash: row.tokenHash,
    owner,
    readingId: row.readingId,
    sessionId: row.sessionId,
    status: row.status,
    locale: row.locale,
    projectionVersion: row.projectionVersion,
    geometryVersion: row.geometryVersion,
    rendererVersion: row.rendererVersion,
    createdAt: Number(row.createdAt),
    updatedAt: Number(row.updatedAt),
    revokedAt: row.revokedAt === null ? null : Number(row.revokedAt),
    expiresAt: row.expiresAt === null ? null : Number(row.expiresAt),
  };
}

function shareSelect(): string {
  return `SELECT
    rs.id,
    rs.token_hash AS tokenHash,
    s.user_id AS userId,
    s.guest_id AS guestId,
    r.id AS readingId,
    r.session_id AS sessionId,
    rs.status,
    rs.locale,
    rs.public_contract_version AS projectionVersion,
    rs.geometry_version AS geometryVersion,
    rs.renderer_version AS rendererVersion,
    rs.created_at AS createdAt,
    rs.updated_at AS updatedAt,
    rs.revoked_at AS revokedAt,
    rs.expires_at AS expiresAt
  FROM reading_shares rs
  JOIN readings r ON r.id = rs.reading_id
  JOIN reading_sessions s ON s.id = r.session_id`;
}

/** Durable owner-scoped adapter shared by the Node SQLite and Cloudflare D1 runtimes. */
export class DatabaseShareStore implements ShareStore {
  constructor(private readonly database: D1Database) {}

  async create(record: ShareRecord): Promise<void> {
    const values = [
      record.id,
      record.tokenHash,
      record.status,
      record.locale,
      record.projectionVersion,
      record.geometryVersion,
      record.rendererVersion,
      record.createdAt,
      record.updatedAt,
      record.revokedAt,
      record.expiresAt,
      record.readingId,
      record.sessionId,
    ];
    const statement = record.owner.kind === "user"
      ? this.database.prepare(`INSERT INTO reading_shares (
          id, reading_id, token_hash, status, locale, public_contract_version,
          geometry_version, renderer_version, created_at, updated_at, revoked_at, expires_at
        )
        SELECT ?, r.id, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
        FROM readings r
        JOIN reading_sessions s ON s.id = r.session_id
        WHERE r.id = ? AND s.id = ? AND s.user_id = ?`).bind(...values, record.owner.userId)
      : this.database.prepare(`INSERT INTO reading_shares (
          id, reading_id, token_hash, status, locale, public_contract_version,
          geometry_version, renderer_version, created_at, updated_at, revoked_at, expires_at
        )
        SELECT ?, r.id, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
        FROM readings r
        JOIN reading_sessions s ON s.id = r.session_id
        WHERE r.id = ? AND s.id = ? AND s.guest_id = ?`).bind(...values, record.owner.guestId);

    try {
      const result = await statement.run();
      if (Number(result.meta.changes) !== 1) throw new ShareOwnershipError();
    } catch (error) {
      if (error instanceof ShareOwnershipError) throw error;
      if (isUniqueConstraint(error)) {
        if (isTokenHashConstraint(error)) throw new ShareTokenHashConflictError();
        if (isShareIdConstraint(error)) throw new ShareIdConflictError();
        if (isActiveReadingConstraint(error)) throw new ShareActiveConflictError();
      }
      if (error instanceof ShareStorageUnavailableError) throw error;
      throw new ShareStorageUnavailableError("Share storage is temporarily unavailable.", { cause: error });
    }
  }

  async findByTokenHash(tokenHash: string): Promise<ShareRecord | null> {
    try {
      const row = await this.database.prepare(`${shareSelect()} WHERE rs.token_hash = ?`).bind(tokenHash).first<ShareRow>();
      return row ? mapRow(row) : null;
    } catch (error) {
      throw new ShareStorageUnavailableError("Share storage is temporarily unavailable.", { cause: error });
    }
  }

  async revoke(input: { shareId: string; owner: ReadingOwner; now: number }): Promise<boolean> {
    const ownerPredicate = input.owner.kind === "user" ? "s.user_id = ?" : "s.guest_id = ?";
    const statement = this.database.prepare(`UPDATE reading_shares
      SET status = 'revoked', revoked_at = ?, updated_at = ?
      WHERE id = ?
        AND status = 'active'
        AND (expires_at IS NULL OR expires_at > ?)
        AND EXISTS (
          SELECT 1
          FROM readings r
          JOIN reading_sessions s ON s.id = r.session_id
          WHERE r.id = reading_shares.reading_id AND ${ownerPredicate}
        )`).bind(input.now, input.now, input.shareId, input.now, input.owner.kind === "user" ? input.owner.userId : input.owner.guestId);
    try {
      const result = await statement.run();
      return Number(result.meta.changes) === 1;
    } catch (error) {
      throw new ShareStorageUnavailableError("Share storage is temporarily unavailable.", { cause: error });
    }
  }

  async insertEvent(input: { shareId: string; tokenHash: string; event: ShareEventInput; now: number }): Promise<boolean> {
    void input.tokenHash;
    try {
      const result = await this.database.prepare(`INSERT INTO share_events (
        id, share_id, event_name, locale, source, renderer_version, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO NOTHING`).bind(
        input.event.event_id,
        input.shareId,
        input.event.event_name,
        input.event.locale,
        input.event.source ?? null,
        input.event.renderer_version ?? null,
        input.event.created_at ?? input.now,
      ).run();
      return Number(result.meta.changes) === 1;
    } catch (error) {
      throw new ShareStorageUnavailableError("Share storage is temporarily unavailable.", { cause: error });
    }
  }
}

function ownerKey(owner: ReadingOwner): string {
  return owner.kind === "user" ? `user:${owner.userId}` : `guest:${owner.guestId}`;
}

function copyRecord(record: ShareRecord): ShareRecord {
  return { ...record, owner: { ...record.owner } };
}

/** Test-only store. Production routes deliberately never import this adapter. */
export class InMemoryShareStore implements ShareStore {
  private readonly records = new Map<string, ShareRecord>();
  private readonly events = new Map<string, { shareId: string; tokenHash: string; event: ShareEventInput; now: number }>();

  async create(record: ShareRecord): Promise<void> {
    if ([...this.records.values()].some((existing) => existing.tokenHash === record.tokenHash)) {
      throw new Error("Share token hash already exists.");
    }
    this.records.set(record.id, copyRecord(record));
  }

  async findByTokenHash(tokenHash: string): Promise<ShareRecord | null> {
    for (const record of this.records.values()) {
      if (record.tokenHash === tokenHash) return copyRecord(record);
    }
    return null;
  }

  async revoke(input: { shareId: string; owner: ReadingOwner; now: number }): Promise<boolean> {
    const record = this.records.get(input.shareId);
    if (!record || ownerKey(record.owner) !== ownerKey(input.owner) || record.status !== "active") return false;
    record.status = "revoked";
    record.revokedAt = input.now;
    record.updatedAt = input.now;
    return true;
  }

  async insertEvent(input: { shareId: string; tokenHash: string; event: ShareEventInput; now: number }): Promise<boolean> {
    if (this.events.has(input.event.event_id)) return false;
    this.events.set(input.event.event_id, { ...input, event: { ...input.event } });
    return true;
  }

  getRecordById(id: string): ShareRecord | null {
    const record = this.records.get(id);
    return record ? copyRecord(record) : null;
  }

  getEvents(): Array<{ shareId: string; tokenHash: string; event: ShareEventInput; now: number }> {
    return [...this.events.values()].map((item) => ({ ...item, event: { ...item.event } }));
  }
}

export class UnavailableShareStore implements ShareStore {
  async create(record: ShareRecord): Promise<void> {
    void record;
    throw new ShareStorageUnavailableError();
  }

  async findByTokenHash(tokenHash: string): Promise<ShareRecord | null> {
    void tokenHash;
    throw new ShareStorageUnavailableError();
  }

  async revoke(input: { shareId: string; owner: ReadingOwner; now: number }): Promise<boolean> {
    void input;
    throw new ShareStorageUnavailableError();
  }

  async insertEvent(input: { shareId: string; tokenHash: string; event: ShareEventInput; now: number }): Promise<boolean> {
    void input;
    throw new ShareStorageUnavailableError();
  }
}
