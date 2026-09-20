import type { ReadingOwner } from "./tarot-guest";
import type { ShareEventInput, ShareRecord, ShareStore } from "./tarot-share-contract";

export class ShareStorageUnavailableError extends Error {
  readonly code = "share_storage_unavailable" as const;

  constructor(message = "Share links are not configured.", options?: { cause?: unknown }) {
    super(message, options?.cause === undefined ? undefined : { cause: options.cause });
    this.name = "ShareStorageUnavailableError";
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
