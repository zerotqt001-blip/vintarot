import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { DatabaseSync } from "node:sqlite";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test, { type TestContext } from "node:test";
import type { D1Database } from "@cloudflare/workers-types";
import { createSqliteD1Database, type SqliteConnection } from "../lib/sqlite-d1";
import type { ReadingOwner } from "../lib/tarot-guest";
import { DatabaseShareStore } from "../lib/tarot-share-store";
import {
  SHARE_GEOMETRY_VERSION,
  SHARE_PROJECTION_VERSION,
  SHARE_RENDERER_VERSION,
  type ShareEventInput,
  type ShareRecord,
} from "../lib/tarot-share-contract";

const repoRoot = new URL("../", import.meta.url);

type Fixture = {
  database: D1Database;
  sqlite: DatabaseSync;
};

function makeFixture(context: TestContext): Fixture {
  const directory = mkdtempSync(join(tmpdir(), "natarot-share-persistence-"));
  const dbPath = join(directory, "natarot.sqlite");
  execFileSync(process.execPath, ["scripts/node-migrate.mjs"], {
    cwd: repoRoot,
    env: { ...process.env, NATAROT_DB_PATH: dbPath },
    stdio: "pipe",
  });

  const sqlite = new DatabaseSync(dbPath);
  sqlite.exec("PRAGMA foreign_keys = ON;");
  const catalog = sqlite.prepare("SELECT c.id AS category_id, t.id AS template_id FROM spread_categories c JOIN spread_templates t ON t.category_id = c.id ORDER BY c.id, t.id LIMIT 1").get() as { category_id: string; template_id: string };
  const insertSession = sqlite.prepare("INSERT INTO reading_sessions (id, user_id, guest_id, question, optional_context, category_id, spread_template_id, spread_type, card_count, locale, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
  const insertReading = sqlite.prepare("INSERT INTO readings (id, session_id, opening, card_readings, synthesis, advice, closing, disclaimer, reading_payload, model_name, prompt_version, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
  const now = 1_700_000_000_000;
  const sessions = [
    ["session-user-a", "member:owner-a", null],
    ["session-user-b", "member:owner-b", null],
    ["session-guest-a", null, "guest-owner-a"],
  ] as const;
  for (const [sessionId, userId, guestId] of sessions) {
    insertSession.run(sessionId, userId, guestId, "A private question", "private context", catalog.category_id, catalog.template_id, "single", 1, "en", "complete", now, now);
    insertReading.run(`reading-${sessionId.slice("session-".length)}`, sessionId, "Opening", "[]", "Synthesis", "Advice", "Closing", "Disclaimer", null, "test-model", "test-prompt", now, now);
  }

  context.after(() => {
    sqlite.close();
    rmSync(directory, { recursive: true, force: true });
  });
  return { database: createSqliteD1Database(sqlite as unknown as SqliteConnection), sqlite };
}

function makeRecord(input: {
  id: string;
  tokenHash: string;
  owner: ReadingOwner;
  readingId: string;
  sessionId: string;
  status?: ShareRecord["status"];
  expiresAt?: number | null;
}): ShareRecord {
  const now = 1_700_000_000_000;
  return {
    id: input.id,
    tokenHash: input.tokenHash,
    owner: { ...input.owner },
    readingId: input.readingId,
    sessionId: input.sessionId,
    status: input.status ?? "active",
    locale: "en",
    projectionVersion: SHARE_PROJECTION_VERSION,
    geometryVersion: SHARE_GEOMETRY_VERSION,
    rendererVersion: SHARE_RENDERER_VERSION,
    createdAt: now,
    updatedAt: now,
    revokedAt: null,
    expiresAt: input.expiresAt ?? null,
  };
}

function event(eventId: string): ShareEventInput {
  return {
    event_id: eventId,
    event_name: "share_opened",
    locale: "en",
    source: "share",
    renderer_version: SHARE_RENDERER_VERSION,
    created_at: 1_700_000_000_000,
  };
}

test("DatabaseShareStore derives ownership through the reading/session join", async (context) => {
  const { database, sqlite } = makeFixture(context);
  const store = new DatabaseShareStore(database);
  const userOwner = { kind: "user", userId: "member:owner-a" } as const;
  const guestOwner = { kind: "guest", guestId: "guest-owner-a" } as const;

  await store.create(makeRecord({
    id: "share:user-a",
    tokenHash: "hash-user-a",
    owner: userOwner,
    readingId: "reading-user-a",
    sessionId: "session-user-a",
  }));
  await store.create(makeRecord({
    id: "share:guest-a",
    tokenHash: "hash-guest-a",
    owner: guestOwner,
    readingId: "reading-guest-a",
    sessionId: "session-guest-a",
  }));

  const userShare = await store.findByTokenHash("hash-user-a");
  assert.deepEqual(userShare?.owner, userOwner);
  assert.equal(userShare?.readingId, "reading-user-a");
  assert.equal(userShare?.sessionId, "session-user-a");
  assert.equal(JSON.stringify(userShare).includes("raw-token"), false);
  assert.equal(JSON.stringify(userShare).includes("token_hash"), false);

  const guestShare = await store.findByTokenHash("hash-guest-a");
  assert.deepEqual(guestShare?.owner, guestOwner);

  await assert.rejects(
    () => store.create(makeRecord({
      id: "share:foreign",
      tokenHash: "hash-foreign",
      owner: { kind: "user", userId: "member:owner-b" },
      readingId: "reading-user-a",
      sessionId: "session-user-a",
    })),
    /owner|ownership|not found/i,
  );
  await assert.rejects(
    () => store.create(makeRecord({
      id: "share:mismatched-session",
      tokenHash: "hash-mismatched-session",
      owner: userOwner,
      readingId: "reading-user-a",
      sessionId: "session-user-b",
    })),
    /owner|ownership|not found/i,
  );
  assert.equal((sqlite.prepare("SELECT COUNT(*) AS count FROM reading_shares").get() as { count: number }).count, 2);
});

test("DatabaseShareStore enforces one active share, hash uniqueness, and owner-scoped revocation", async (context) => {
  const { database } = makeFixture(context);
  const store = new DatabaseShareStore(database);
  const owner = { kind: "user", userId: "member:owner-a" } as const;
  const first = makeRecord({ id: "share:first", tokenHash: "hash-first", owner, readingId: "reading-user-a", sessionId: "session-user-a" });
  await store.create(first);

  await assert.rejects(
    () => store.create(makeRecord({ id: "share:active-conflict", tokenHash: "hash-second", owner, readingId: "reading-user-a", sessionId: "session-user-a" })),
    /active|already|conflict|unique/i,
  );
  await assert.rejects(
    () => store.create(makeRecord({ id: "share:hash-conflict", tokenHash: "hash-first", owner: { kind: "user", userId: "member:owner-b" }, readingId: "reading-user-b", sessionId: "session-user-b" })),
    /hash|unique|conflict/i,
  );
  assert.equal(await store.revoke({ shareId: first.id, owner: { kind: "user", userId: "member:owner-b" }, now: 1_700_000_000_001 }), false);
  assert.equal(await store.revoke({ shareId: first.id, owner, now: 1_700_000_000_002 }), true);
  assert.equal((await store.findByTokenHash(first.tokenHash))?.status, "revoked");

  await store.create(makeRecord({ id: "share:replacement", tokenHash: "hash-replacement", owner, readingId: "reading-user-a", sessionId: "session-user-a" }));
  const otherOwner = { kind: "user", userId: "member:owner-b" } as const;
  await store.create(makeRecord({ id: "share:expired", tokenHash: "hash-expired", owner: otherOwner, readingId: "reading-user-b", sessionId: "session-user-b", status: "expired", expiresAt: 1_699_999_999_999 }));
  assert.equal(await store.revoke({ shareId: "share:expired", owner: otherOwner, now: 1_700_000_000_010 }), false);
});

test("DatabaseShareStore makes analytics events idempotent and keeps token hashes out of event rows", async (context) => {
  const { database, sqlite } = makeFixture(context);
  const store = new DatabaseShareStore(database);
  const record = makeRecord({ id: "share:events", tokenHash: "hash-events", owner: { kind: "guest", guestId: "guest-owner-a" }, readingId: "reading-guest-a", sessionId: "session-guest-a" });
  await store.create(record);

  assert.equal(await store.insertEvent({ shareId: record.id, tokenHash: record.tokenHash, event: event("00000000-0000-4000-8000-000000000001"), now: 1_700_000_000_100 }), true);
  assert.equal(await store.insertEvent({ shareId: record.id, tokenHash: record.tokenHash, event: event("00000000-0000-4000-8000-000000000001"), now: 1_700_000_000_101 }), false);
  const columns = sqlite.prepare("PRAGMA table_info('share_events')").all() as Array<{ name: string }>;
  assert.equal(columns.some((column) => column.name === "token_hash"), false);
  assert.equal((sqlite.prepare("SELECT COUNT(*) AS count FROM share_events").get() as { count: number }).count, 1);
});

test("DatabaseShareStore cascades events without deleting their reading", async (context) => {
  const { database, sqlite } = makeFixture(context);
  const store = new DatabaseShareStore(database);
  const record = makeRecord({ id: "share:cascade", tokenHash: "hash-cascade", owner: { kind: "user", userId: "member:owner-a" }, readingId: "reading-user-a", sessionId: "session-user-a" });
  await store.create(record);
  await store.insertEvent({ shareId: record.id, tokenHash: record.tokenHash, event: event("00000000-0000-4000-8000-000000000002"), now: 1_700_000_000_200 });

  sqlite.prepare("DELETE FROM reading_shares WHERE id = ?").run(record.id);
  assert.equal((sqlite.prepare("SELECT COUNT(*) AS count FROM share_events WHERE share_id = ?").get(record.id) as { count: number }).count, 0);
  assert.equal((sqlite.prepare("SELECT COUNT(*) AS count FROM readings WHERE id = ?").get(record.readingId) as { count: number }).count, 1);
});
