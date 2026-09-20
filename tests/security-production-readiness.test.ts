import assert from "node:assert/strict";
import { readFileSync, mkdtempSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";
import { handleTarotFollowUpRoute } from "../lib/tarot-follow-up-route";
import type { GeneratedTarotFollowUp } from "../lib/tarot-follow-up-service";
import { handleTarotReadingRoute } from "../lib/tarot-reading-route";
import type { GeneratedTarotReading } from "../lib/tarot-reading-service";
import { attachIdentityCookie, noStoreResponse } from "../lib/request-identity";

const databaseDirectory = mkdtempSync(join(tmpdir(), "natarot-security-readiness-"));
const databasePath = join(databaseDirectory, "security-readiness.sqlite");
process.env.NATAROT_DB_PATH = databasePath;

const database = new DatabaseSync(databasePath);
for (const file of ["0001_dynamic_tarot.sql", "0002_tarot_seed.sql", "0004_reading_payload.sql"]) {
  database.exec(readFileSync(new URL(`../drizzle/${file}`, import.meta.url), "utf8"));
}

const deck = database.prepare("SELECT id FROM decks WHERE active = 1 ORDER BY id LIMIT 1").get() as { id: string };
const singleCardTemplate = database.prepare(`
  SELECT t.id AS template_id, t.category_id
  FROM spread_templates t
  WHERE t.active = 1 AND t.card_count = 1
  ORDER BY t.id
  LIMIT 1
`).get() as { template_id: string; category_id: string };

database.prepare(`
  INSERT INTO reading_sessions
    (id, user_id, guest_id, question, optional_context, category_id, spread_template_id, spread_type, card_count, locale, status, created_at, updated_at)
  VALUES (?, NULL, ?, ?, '', ?, ?, 'single', 1, 'en', 'drawn', 1, 1)
`).run("session-cache-test", "guest-cache-1", "Cache boundary question", singleCardTemplate.category_id, singleCardTemplate.template_id);

const { GET: getSession } = await import("../app/api/tarot/session/route");
const { POST: drawTarot } = await import("../app/api/tarot/draw/route");
const { GET: getHealth } = await import("../app/api/health/route");

const readingResult: GeneratedTarotReading = {
  readingId: "reading-cache-test",
  sessionId: "session-cache-test",
  locale: "en",
  source: "ai",
  provider: "openai",
  modelName: "openai:test-model",
  promptVersion: "tarot-reading-test",
  reading: {
    directAnswer: "A direct answer.",
    personalInsights: [],
    reflectionPrompts: [],
    nextSteps: [],
    cardEvidence: [],
    deeperReading: null,
    followUpSuggestions: [],
    disclaimer: "Reflective guidance.",
  },
};

const followUpResult: GeneratedTarotFollowUp = {
  sessionId: "session-cache-test",
  locale: "en",
  source: "ai",
  provider: "openai",
  modelName: "openai:test-model",
  promptVersion: "tarot-follow-up-v1",
  answer: "A follow-up answer.",
};

test.after(() => {
  database.close();
});

test("noStoreResponse marks a response explicitly non-cacheable", () => {
  const response = noStoreResponse(new Response("ok"));
  assert.equal(response.headers.get("cache-control"), "no-store");
});

test("identity-attached responses remain non-cacheable and preserve the guest cookie", () => {
  const response = attachIdentityCookie(new Response("ok"), {
    kind: "guest",
    userId: "guest:guest-cache-1",
    displayName: "Guest",
    email: "guest@local.invalid",
    fullName: "Guest",
    owner: { kind: "guest", guestId: "guest-cache-1" },
    guestId: "guest-cache-1",
    setCookie: "vintarot_guest=guest-cache-1; HttpOnly",
  });
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(response.headers.get("set-cookie"), "vintarot_guest=guest-cache-1; HttpOnly");
});

test("owner-scoped Tarot session responses are non-cacheable", async () => {
  const response = await getSession(new Request("https://natarot.com/api/tarot/session?id=session-cache-test", {
    headers: { cookie: "vintarot_guest=guest-cache-1" },
  }));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
});

test("draw responses that create owner-scoped state are non-cacheable", async () => {
  const response = await drawTarot(new Request("https://natarot.com/api/tarot/draw", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      question: "What should I notice?",
      category_id: singleCardTemplate.category_id,
      spread_template_id: singleCardTemplate.template_id,
      deck_id: deck.id,
      locale: "en",
      reversals: true,
    }),
  }));
  assert.equal(response.status, 201);
  assert.equal(response.headers.get("cache-control"), "no-store");
});

test("health is a read-only database readiness check", async () => {
  const response = await getHealth();
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.deepEqual(await response.json(), { status: "ok" });
});

test("reading and follow-up responses are non-cacheable on success and validation failure", async () => {
  const readingSuccess = await handleTarotReadingRoute({
    loadBody: async () => ({ session_id: readingResult.sessionId, locale: readingResult.locale }),
    execute: async () => ({ result: readingResult }),
    log: () => undefined,
  });
  assert.equal(readingSuccess.status, 200);
  assert.equal(readingSuccess.headers.get("cache-control"), "no-store");

  const readingInvalid = await handleTarotReadingRoute({
    loadBody: async () => ({ session_id: "", locale: "fr" }),
    execute: async () => ({ result: readingResult }),
    log: () => undefined,
  });
  assert.equal(readingInvalid.status, 400);
  assert.equal(readingInvalid.headers.get("cache-control"), "no-store");

  const followUpSuccess = await handleTarotFollowUpRoute({
    loadBody: async () => ({ session_id: followUpResult.sessionId, locale: followUpResult.locale, follow_up_question: "What next?" }),
    execute: async () => ({ result: followUpResult }),
    log: () => undefined,
  });
  assert.equal(followUpSuccess.status, 200);
  assert.equal(followUpSuccess.headers.get("cache-control"), "no-store");

  const followUpInvalid = await handleTarotFollowUpRoute({
    loadBody: async () => ({ session_id: followUpResult.sessionId, locale: followUpResult.locale, follow_up_question: "What next?", extra: "rejected" }),
    execute: async () => ({ result: followUpResult }),
    log: () => undefined,
  });
  assert.equal(followUpInvalid.status, 400);
  assert.equal(followUpInvalid.headers.get("cache-control"), "no-store");
});
