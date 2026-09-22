import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { DatabaseSync } from "node:sqlite";
import { mkdtempSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test, { type TestContext } from "node:test";
import type { D1Database } from "@cloudflare/workers-types";
import { createSqliteD1Database, type SqliteConnection } from "../lib/sqlite-d1";
import { TarotAIError, type TarotAIProvider } from "../lib/ai/provider";
import type { TarotRepository, ReadingTemplateWithPositions, ReadingCardWithDetails, CardMeaningRow, ReadingSessionRow } from "../lib/tarot-repository";
import type { StoredReadingRow } from "../lib/tarot-reading-compat";
import { createCreditStore, type CreditStore } from "../lib/credits/repository";
import { generateMemberTarotReading, TarotCreditAuthorizationError } from "../lib/tarot-credit-authorization";
import type { ReadingOwner } from "../lib/tarot-guest";
import type { TarotReadingPayload } from "../lib/ai/types";

const repoRoot = fileURLToPath(new URL("../", import.meta.url));
const owner = { kind: "user" as const, userId: "member:tarot-credit-owner" } satisfies ReadingOwner;

const session: ReadingSessionRow = {
  id: "session-credit",
  userId: owner.userId,
  guestId: null,
  question: "What is the next useful step?",
  optionalContext: "",
  categoryId: "category-credit",
  spreadTemplateId: "template-credit",
  spreadType: "single",
  cardCount: 1,
  locale: "en",
  status: "drawn",
};

const template: ReadingTemplateWithPositions = {
  category: { id: session.categoryId, slug: "reflection", name: "Reflection", description: "A reflective spread." },
  template: { id: session.spreadTemplateId, categoryId: session.categoryId, slug: "single", name: "Single card", description: "One card.", cardCount: 1, spreadType: "single" },
  positions: [{ id: "position-present", key: "present", order: 0, name: "Present", meaning: "What is present.", prompt: "What is present?" }],
};

const card: ReadingCardWithDetails = {
  id: "reading-card-credit",
  sessionId: session.id,
  cardId: "card-credit",
  spreadPositionId: "position-present",
  positionKey: "present",
  positionOrder: 0,
  positionLabel: "Present",
  orientation: "upright",
  cardOrder: 0,
  deckId: "deck-credit",
  cardNumber: 0,
  slug: "the-star",
  nameEn: "The Star",
  nameVi: "The Star",
  arcana: "major",
  suit: "Major Arcana",
  imageUrl: "/cards/star.webp",
  positionPrompt: "What is present?",
  positionDescription: "What is present.",
};

function meaning(orientation: "upright" | "reversed"): CardMeaningRow {
  return {
    id: `meaning-credit-${orientation}`,
    cardId: card.cardId,
    locale: "en",
    orientation,
    summary: "A clear signal.",
    energy: "Open and steady.",
    actions: "Take one step.",
    relationships: "Be direct.",
    work: "Make the next move.",
    creativity: "Keep exploring.",
    home: "Make space.",
    symbolism: "Light after uncertainty.",
    journalQuestions: ["What is one next step?"],
    keywords: "hope, clarity",
  };
}

function payload(): TarotReadingPayload {
  return {
    directAnswer: "Choose one clear next step.\n\nWrite it down before the day moves on.",
    personalInsights: [{ title: "Signal", body: "The pattern is becoming clearer." }],
    reflectionPrompts: ["What is one clear next step?"],
    nextSteps: [{ title: "One step", body: "Write it down." }],
    cardEvidence: [{
      readingCardId: card.id,
      position: { id: "position-present", key: "present", order: 0, name: "Present", meaning: "What is present.", prompt: "What is present?" },
      card: { id: card.cardId, nameEn: card.nameEn, nameVi: card.nameVi, arcana: card.arcana, suit: card.suit, keywords: ["hope"] },
      orientation: "upright",
      interpretation: "Notice the clear signal.",
    }],
    deeperReading: null,
    followUpSuggestions: ["Explore the signal."],
    disclaimer: "Reflective guidance only.",
  };
}

function makeRepository(context: { stored: StoredReadingRow | null; saveCalls: number[] }): TarotRepository {
  return {
    getSessionForOwner: async (sessionId: string, requestedOwner: ReadingOwner) => sessionId === session.id && requestedOwner.kind === "user" && requestedOwner.userId === owner.userId ? { session, cards: [card] } : null,
    getReadingTemplate: async () => template,
    getMeaningPair: async () => ({ upright: meaning("upright"), reversed: meaning("reversed") }),
    getLatestReadingForOwner: async () => context.stored,
    saveReading: async (input: Parameters<TarotRepository["saveReading"]>[0]) => {
      context.saveCalls[0] += 1;
      context.stored = {
        id: input.id,
        sessionId: input.sessionId,
        opening: input.reading.directAnswer,
        cardReadings: JSON.stringify(input.reading.cardEvidence),
        synthesis: input.reading.personalInsights.map((item) => `${item.title}: ${item.body}`).join("\n"),
        advice: input.reading.nextSteps.map((item) => `${item.title}: ${item.body}`).join("\n"),
        closing: input.reading.deeperReading ?? "",
        disclaimer: input.reading.disclaimer,
        readingPayload: JSON.stringify(input.reading),
        modelName: input.modelName,
        promptVersion: input.promptVersion,
        createdAt: 1,
        updatedAt: 1,
      };
      return input.id;
    },
  } as unknown as TarotRepository;
}

function makeFixture(context: TestContext): { database: D1Database; store: CreditStore; now: { value: number }; sqlite: DatabaseSync } {
  const directory = mkdtempSync(join(tmpdir(), "natarot-tarot-credit-"));
  const dbPath = join(directory, "natarot.sqlite");
  execFileSync(process.execPath, ["scripts/node-migrate.mjs"], { cwd: repoRoot, env: { ...process.env, NATAROT_DB_PATH: dbPath }, stdio: "pipe" });
  const sqlite = new DatabaseSync(dbPath);
  const now = { value: 1_700_000_000_000 };
  const database = createSqliteD1Database(sqlite as unknown as SqliteConnection);
  const store = createCreditStore(database, () => now.value);
  context.after(() => { sqlite.close(); rmSync(directory, { recursive: true, force: true }); });
  return { database, store, now, sqlite };
}

test("member Tarot charge is one reservation/consume and duplicate requests reuse the saved reading", async (context) => {
  const { database, store } = makeFixture(context);
  await store.grantCredits({ owner: { kind: "member", ownerId: owner.userId }, source: "PURCHASE", units: 1, grantKey: "test-credit", policyVersion: "credits-v1", policySnapshot: {}, reason: "test" });
  const state: { stored: StoredReadingRow | null; saveCalls: number[] } = { stored: null, saveCalls: [0] };
  let providerCalls = 0;
  const provider: TarotAIProvider = { id: "openai", model: "test-model", generateReading: async () => { providerCalls += 1; return payload(); } };
  const repository = makeRepository(state);
  const first = await generateMemberTarotReading({ database, creditStore: store, repository, owner, sessionId: session.id, locale: "en", provider });
  const duplicate = await generateMemberTarotReading({ database, creditStore: store, repository, owner, sessionId: session.id, locale: "en", provider });
  assert.equal(providerCalls, 1);
  assert.equal(state.saveCalls[0], 1);
  assert.equal(duplicate.readingId, first.readingId);
  assert.deepEqual(await store.getBalance({ kind: "member", ownerId: owner.userId }), { availableUnits: 0, reservedUnits: 0, totalUnits: 0 });
  assert.equal((await store.listHistory({ kind: "member", ownerId: owner.userId }, 20)).filter((entry) => entry.eventType === "CONSUME").length, 1);
});

test("provider failure releases the reservation and a retry can charge once", async (context) => {
  const { database, store } = makeFixture(context);
  await store.grantCredits({ owner: { kind: "member", ownerId: owner.userId }, source: "PURCHASE", units: 1, grantKey: "retry-credit", policyVersion: "credits-v1", policySnapshot: {}, reason: "test" });
  const state: { stored: StoredReadingRow | null; saveCalls: number[] } = { stored: null, saveCalls: [0] };
  const repository = makeRepository(state);
  let shouldFail = true;
  let providerCalls = 0;
  const provider: TarotAIProvider = { id: "openai", model: "test-model", generateReading: async () => { providerCalls += 1; if (shouldFail) throw new TarotAIError("upstream", "safe", { retryable: true }); return payload(); } };
  await assert.rejects(generateMemberTarotReading({ database, creditStore: store, repository, owner, sessionId: session.id, locale: "en", provider }));
  assert.deepEqual(await store.getBalance({ kind: "member", ownerId: owner.userId }), { availableUnits: 1, reservedUnits: 0, totalUnits: 1 });
  shouldFail = false;
  await generateMemberTarotReading({ database, creditStore: store, repository, owner, sessionId: session.id, locale: "en", provider });
  assert.equal(providerCalls, 2);
  assert.deepEqual(await store.getBalance({ kind: "member", ownerId: owner.userId }), { availableUnits: 0, reservedUnits: 0, totalUnits: 0 });
});

test("a concurrent member Tarot request cannot start a second provider call", async (context) => {
  const { database, store } = makeFixture(context);
  await store.grantCredits({ owner: { kind: "member", ownerId: owner.userId }, source: "PURCHASE", units: 1, grantKey: "concurrent-credit", policyVersion: "credits-v1", policySnapshot: {}, reason: "test" });
  const state: { stored: StoredReadingRow | null; saveCalls: number[] } = { stored: null, saveCalls: [0] };
  const repository = makeRepository(state);
  let providerCalls = 0;
  let releaseProvider: (() => void) | undefined;
  const providerStarted = new Promise<void>((resolve) => {
    releaseProvider = resolve;
  });
  const provider: TarotAIProvider = {
    id: "openai",
    model: "test-model",
    generateReading: async () => {
      providerCalls += 1;
      await providerStarted;
      return payload();
    },
  };
  const first = generateMemberTarotReading({ database, creditStore: store, repository, owner, sessionId: session.id, locale: "en", provider });
  await new Promise((resolve) => setTimeout(resolve, 20));
  await assert.rejects(
    generateMemberTarotReading({ database, creditStore: store, repository, owner, sessionId: session.id, locale: "en", provider }),
    (error: unknown) => error instanceof TarotCreditAuthorizationError && error.code === "in_progress",
  );
  releaseProvider?.();
  await first;
  assert.equal(providerCalls, 1);
});
