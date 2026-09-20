import { buildPublicShareUrl, buildShareImageUrl } from "./tarot-share-config";
import type {
  ReadingShareSource,
  ShareEventInput,
  ShareRecord,
  ShareStore,
} from "./tarot-share-contract";
import {
  SHARE_GEOMETRY_VERSION,
  SHARE_PROJECTION_VERSION,
  SHARE_RENDERER_VERSION,
  shareEventInputSchema,
} from "./tarot-share-contract";
import { generateShareToken, hashShareToken, assertShareToken } from "./tarot-share-identity";
import { projectPublicReading } from "./tarot-share-projection";
import { ShareStorageUnavailableError } from "./tarot-share-store";
import type { ReadingOwner } from "./tarot-guest";

export class ShareNotFoundError extends Error {
  readonly code = "share_not_found" as const;

  constructor() {
    super("Shared reading not found.");
    this.name = "ShareNotFoundError";
  }
}

export class ShareServiceUnavailableError extends Error {
  readonly code = "share_unavailable" as const;

  constructor(message = "Shared reading is temporarily unavailable.", options?: { cause?: unknown }) {
    super(message, options?.cause === undefined ? undefined : { cause: options.cause });
    this.name = "ShareServiceUnavailableError";
  }
}

export type ShareServiceOptions = {
  store: ShareStore;
  source: ReadingShareSource;
  origin?: string;
  now?: () => number;
};

export type CreatedShare = {
  token: string;
  publicUrl: string;
  imageUrl: string;
  createdAt: number;
};

function shareId(tokenHash: string): string {
  if (globalThis.crypto?.randomUUID) return `share:${globalThis.crypto.randomUUID()}`;
  return `share:${tokenHash.slice(0, 32)}`;
}

function eventId(): string {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  throw new Error("Web Crypto UUID support is required for share events.");
}

function activeRecord(record: ShareRecord, now: number): boolean {
  return record.status === "active" && (record.expiresAt === null || record.expiresAt > now);
}

export class ShareService {
  private readonly now: () => number;

  constructor(private readonly options: ShareServiceOptions) {
    this.now = options.now || Date.now;
  }

  async createShare(input: { owner: ReadingOwner; readingId: string; sessionId: string }): Promise<CreatedShare> {
    const snapshot = await this.options.source.loadShareableReading(input);
    if (!snapshot) throw new ShareNotFoundError();
    const token = generateShareToken();
    const tokenHash = await hashShareToken(token);
    const now = this.now();
    const record: ShareRecord = {
      id: shareId(tokenHash),
      tokenHash,
      owner: { ...input.owner },
      readingId: input.readingId,
      sessionId: input.sessionId,
      status: "active",
      locale: snapshot.locale,
      projectionVersion: SHARE_PROJECTION_VERSION,
      geometryVersion: SHARE_GEOMETRY_VERSION,
      rendererVersion: SHARE_RENDERER_VERSION,
      createdAt: now,
      updatedAt: now,
      revokedAt: null,
      expiresAt: null,
    };
    await this.options.store.create(record);
    await this.options.store.insertEvent({
      shareId: record.id,
      tokenHash,
      now,
      event: {
        event_id: eventId(),
        event_name: "share_created",
        locale: snapshot.locale,
        source: "share",
        renderer_version: record.rendererVersion,
        created_at: now,
      },
    });
    return {
      token,
      publicUrl: buildPublicShareUrl(token, this.options.origin),
      imageUrl: buildShareImageUrl(token, this.options.origin),
      createdAt: now,
    };
  }

  async resolvePublicShare(token: string, now = this.now()) {
    assertShareToken(token);
    const tokenHash = await hashShareToken(token);
    let record: ShareRecord | null;
    try {
      record = await this.options.store.findByTokenHash(tokenHash);
    } catch (error) {
      if (error instanceof ShareStorageUnavailableError) throw error;
      throw new ShareServiceUnavailableError("Shared reading is temporarily unavailable.", { cause: error });
    }
    if (!record || !activeRecord(record, now)) return null;
    const snapshot = await this.options.source.loadShareableReading({
      owner: record.owner,
      readingId: record.readingId,
      sessionId: record.sessionId,
    });
    if (!snapshot) return null;
    try {
      return projectPublicReading({ record, token, snapshot, origin: this.options.origin });
    } catch (error) {
      throw new ShareServiceUnavailableError("Shared reading is temporarily unavailable.", { cause: error });
    }
  }

  async revokeShare(input: { shareId: string; owner: ReadingOwner; now?: number }): Promise<boolean> {
    return this.options.store.revoke({ ...input, now: input.now ?? this.now() });
  }

  async recordEvent(input: { token: string; event: ShareEventInput; now?: number }): Promise<{ accepted: boolean; duplicate: boolean }> {
    assertShareToken(input.token);
    const parsed = shareEventInputSchema.safeParse(input.event);
    if (!parsed.success) throw new Error("Invalid share event.");
    const tokenHash = await hashShareToken(input.token);
    const now = input.now ?? this.now();
    const record = await this.options.store.findByTokenHash(tokenHash);
    if (!record || !activeRecord(record, now)) return { accepted: false, duplicate: false };
    const event = { ...parsed.data, created_at: now };
    const inserted = await this.options.store.insertEvent({ shareId: record.id, tokenHash, event, now });
    return { accepted: true, duplicate: !inserted };
  }
}
