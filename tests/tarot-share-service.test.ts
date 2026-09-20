import assert from "node:assert/strict";
import test from "node:test";
import type { ReadingOwner } from "../lib/tarot-guest";
import type { ShareableReadingSnapshot, ShareEventInput, ShareRecord, ShareStore } from "../lib/tarot-share-contract";
import { hashShareToken } from "../lib/tarot-share-identity";
import {
  SHARE_GEOMETRY_VERSION,
  SHARE_PROJECTION_VERSION,
  SHARE_RENDERER_VERSION,
} from "../lib/tarot-share-contract";
import { ShareService, ShareAlreadyExistsError, ShareServiceUnavailableError } from "../lib/tarot-share-service";
import {
  ShareActiveConflictError,
  ShareStorageUnavailableError,
  ShareTokenHashConflictError,
} from "../lib/tarot-share-store";

const owner: ReadingOwner = { kind: "user", userId: "member:service-owner" };
const snapshot = { locale: "en" } as ShareableReadingSnapshot;

function recordFor(tokenHash: string, overrides: Partial<ShareRecord> = {}): ShareRecord {
  return {
    id: "share:service",
    tokenHash,
    owner: { ...owner },
    readingId: "reading-service",
    sessionId: "session-service",
    status: "active",
    locale: "en",
    projectionVersion: SHARE_PROJECTION_VERSION,
    geometryVersion: SHARE_GEOMETRY_VERSION,
    rendererVersion: SHARE_RENDERER_VERSION,
    createdAt: 1_000,
    updatedAt: 1_000,
    revokedAt: null,
    expiresAt: null,
    ...overrides,
  };
}

class ControlledStore implements ShareStore {
  readonly records = new Map<string, ShareRecord>();
  readonly createErrors: Error[] = [];
  createCalls = 0;
  eventCalls = 0;
  failEvents = false;

  async create(record: ShareRecord): Promise<void> {
    this.createCalls += 1;
    const error = this.createErrors.shift();
    if (error) throw error;
    this.records.set(record.id, { ...record, owner: { ...record.owner } });
  }

  async findByTokenHash(tokenHash: string): Promise<ShareRecord | null> {
    return [...this.records.values()].find((record) => record.tokenHash === tokenHash) ?? null;
  }

  async revoke(input: { shareId: string; owner: ReadingOwner; now: number }): Promise<boolean> {
    const record = this.records.get(input.shareId);
    if (!record || record.status !== "active") return false;
    const sameOwner = record.owner.kind === "user" && input.owner.kind === "user"
      ? record.owner.userId === input.owner.userId
      : record.owner.kind === "guest" && input.owner.kind === "guest"
        ? record.owner.guestId === input.owner.guestId
        : false;
    if (!sameOwner) return false;
    record.status = "revoked";
    record.revokedAt = input.now;
    record.updatedAt = input.now;
    return true;
  }

  async insertEvent(_input: { shareId: string; tokenHash: string; event: ShareEventInput; now: number }): Promise<boolean> {
    this.eventCalls += 1;
    if (this.failEvents) throw new ShareStorageUnavailableError();
    return true;
  }
}

function serviceFor(store: ShareStore, now = 2_000): ShareService {
  return new ShareService({
    store,
    source: { async loadShareableReading() { return snapshot; } },
    origin: "https://share.example.test",
    now: () => now,
  });
}

test("ShareService retries only bounded token/id collisions and keeps creation analytics best-effort", async () => {
  const store = new ControlledStore();
  store.createErrors.push(new ShareTokenHashConflictError(), new ShareTokenHashConflictError());
  const service = serviceFor(store);
  const created = await service.createShare({ owner, readingId: "reading-service", sessionId: "session-service" });
  assert.match(created.publicUrl, /^https:\/\/share\.example\.test\/r\/[A-Za-z0-9_-]{43}$/);
  assert.equal(store.createCalls, 3);

  const exhausted = new ControlledStore();
  exhausted.createErrors.push(new ShareTokenHashConflictError(), new ShareTokenHashConflictError(), new ShareTokenHashConflictError(), new ShareTokenHashConflictError(), new ShareTokenHashConflictError());
  await assert.rejects(
    () => serviceFor(exhausted).createShare({ owner, readingId: "reading-service", sessionId: "session-service" }),
    (error: unknown) => error instanceof ShareServiceUnavailableError,
  );
  assert.equal(exhausted.createCalls, 4);

  const analyticsStore = new ControlledStore();
  analyticsStore.failEvents = true;
  const analyticsResult = await serviceFor(analyticsStore).createShare({ owner, readingId: "reading-service", sessionId: "session-service" });
  assert.equal(analyticsStore.eventCalls, 1);
  assert.equal(typeof analyticsResult.token, "string");
  assert.equal(analyticsStore.records.size, 1);
});

test("ShareService maps active-reading conflicts safely and revokes by bearer token without enumeration", async () => {
  const conflictStore = new ControlledStore();
  conflictStore.createErrors.push(new ShareActiveConflictError());
  await assert.rejects(
    () => serviceFor(conflictStore).createShare({ owner, readingId: "reading-service", sessionId: "session-service" }),
    (error: unknown) => error instanceof ShareAlreadyExistsError,
  );

  const store = new ControlledStore();
  const service = serviceFor(store, 3_000);
  const created = await service.createShare({ owner, readingId: "reading-service", sessionId: "session-service" });
  assert.equal(await service.revokeShareByToken({ token: created.token, owner }), true);
  assert.equal(await service.revokeShareByToken({ token: created.token, owner }), false);
  assert.equal(await service.revokeShareByToken({ token: "Z".repeat(43), owner }), false);
});

test("ShareService applies the active and expiry predicate before loading public source data", async () => {
  const store = new ControlledStore();
  const token = "Y".repeat(43);
  await store.create(recordFor(await hashShareToken(token), { expiresAt: 2_999 }));
  let sourceCalls = 0;
  const service = new ShareService({
    store,
    source: { async loadShareableReading() { sourceCalls += 1; return snapshot; } },
    now: () => 3_000,
  });
  assert.equal(await service.resolvePublicShare(token), null);
  assert.equal(sourceCalls, 0);
});
