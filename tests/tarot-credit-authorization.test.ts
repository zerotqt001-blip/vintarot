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
import { assertPaidMemberTarotSession, generateMemberTarotReading, TarotCreditAuthorizationError } from "../lib/tarot-credit-authorization";
import { getStoredTarotReadingForOwner } from "../lib/tarot-reading-service";
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

function storedReading(id: string, modelName = "deepseek:test-model"): StoredReadingRow {
  const reading = payload();
  return {
    id,
    sessionId: session.id,
    opening: reading.directAnswer,
    cardReadings: JSON.stringify(reading.cardEvidence),
    synthesis: reading.personalInsights.map((item) => `${item.title}: ${item.body}`).join("\n"),
    advice: reading.nextSteps.map((item) => `${item.title}: ${item.body}`).join("\n"),
    closing: reading.deeperReading ?? "",
    disclaimer: reading.disclaimer,
    readingPayload: JSON.stringify(reading),
    modelName,
    promptVersion: "tarot-v-test",
    createdAt: 1,
    updatedAt: 1,
  };
}

function makeRepository(context: { stored: StoredReadingRow | null; saveCalls: number[] }, allowedOwner: ReadingOwner = owner): TarotRepository {
  const allows = (requestedOwner: ReadingOwner) => requestedOwner.kind === allowedOwner.kind
    && (requestedOwner.kind === "user" ? requestedOwner.userId === (allowedOwner as Extract<ReadingOwner, { kind: "user" }>).userId : requestedOwner.guestId === (allowedOwner as Extract<ReadingOwner, { kind: "guest" }>).guestId);
  return {
    getSessionForOwner: async (sessionId: string, requestedOwner: ReadingOwner) => sessionId === session.id && allows(requestedOwner) ? { session, cards: [card] } : null,
    getReadingTemplate: async () => template,
    getMeaningPair: async () => ({ upright: meaning("upright"), reversed: meaning("reversed") }),
    getLatestReadingForOwner: async (_sessionId: string, requestedOwner: ReadingOwner) => allows(requestedOwner) ? context.stored : null,
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
  let providerCreations = 0;
  const provider: TarotAIProvider = { id: "openai", model: "test-model", generateReading: async () => { providerCalls += 1; return payload(); } };
  const repository = makeRepository(state);
  const providerFactory = () => { providerCreations += 1; return provider; };
  const first = await generateMemberTarotReading({ database, creditStore: store, repository, owner, sessionId: session.id, locale: "en", providerFactory });
  const duplicate = await generateMemberTarotReading({ database, creditStore: store, repository, owner, sessionId: session.id, locale: "en", providerFactory });
  assert.equal(providerCalls, 1);
  assert.equal(providerCreations, 1);
  assert.equal(state.saveCalls[0], 1);
  assert.equal(duplicate.readingId, first.readingId);
  assert.deepEqual(await store.getBalance({ kind: "member", ownerId: owner.userId }), { availableUnits: 0, reservedUnits: 0, totalUnits: 0 });
  assert.equal((await store.listHistory({ kind: "member", ownerId: owner.userId }, 20)).filter((entry) => entry.eventType === "CONSUME").length, 1);
});

test("member can reopen an owner-scoped stored reading without a new provider request", async (context) => {
  const { database, store } = makeFixture(context);
  const state: { stored: StoredReadingRow | null; saveCalls: number[] } = { stored: storedReading("member-history-1"), saveCalls: [0] };
  let providerCreations = 0;

  const reopened = await generateMemberTarotReading({
    database,
    creditStore: store,
    repository: makeRepository(state),
    owner,
    sessionId: session.id,
    locale: "en",
    providerFactory: () => { providerCreations += 1; throw new Error("must not construct a provider for a saved result"); },
  });

  assert.equal(reopened.readingId, "member-history-1");
  assert.equal(providerCreations, 0);
  assert.deepEqual(await store.getBalance({ kind: "member", ownerId: owner.userId }), { availableUnits: 0, reservedUnits: 0, totalUnits: 0 });
});

test("provider factory runs only after the member's Credit reservation is acquired", async (context) => {
  const { database, store } = makeFixture(context);
  const state: { stored: StoredReadingRow | null; saveCalls: number[] } = { stored: null, saveCalls: [0] };
  let providerCreations = 0;
  const providerFactory = () => {
    providerCreations += 1;
    return { id: "openai" as const, model: "test-model", generateReading: async () => payload() };
  };

  await assert.rejects(
    generateMemberTarotReading({ database, creditStore: store, repository: makeRepository(state), owner, sessionId: session.id, locale: "en", providerFactory }),
    (error: unknown) => error instanceof TarotCreditAuthorizationError && error.code === "insufficient",
  );
  assert.equal(providerCreations, 0);

  await store.grantCredits({ owner: { kind: "member", ownerId: owner.userId }, source: "PURCHASE", units: 1, grantKey: "lazy-provider-credit", policyVersion: "credits-v1", policySnapshot: {}, reason: "test" });
  const createdAfterReservation = { value: false };
  const instrumentedStore = {
    ...store,
    reserveCredits: async (input: Parameters<CreditStore["reserveCredits"]>[0]) => {
      const reservation = await store.reserveCredits(input);
      createdAfterReservation.value = reservation.acquired === true;
      return reservation;
    },
  } as CreditStore;
  await generateMemberTarotReading({ database, creditStore: instrumentedStore, repository: makeRepository(state), owner, sessionId: session.id, locale: "en", providerFactory: () => {
    assert.equal(createdAfterReservation.value, true);
    return providerFactory();
  } });
  assert.equal(providerCreations, 1);
});

test("provider configuration failure after reservation releases the Credit", async (context) => {
  const { database, store } = makeFixture(context);
  await store.grantCredits({ owner: { kind: "member", ownerId: owner.userId }, source: "PURCHASE", units: 1, grantKey: "provider-config-credit", policyVersion: "credits-v1", policySnapshot: {}, reason: "test" });
  const state: { stored: StoredReadingRow | null; saveCalls: number[] } = { stored: null, saveCalls: [0] };

  await assert.rejects(
    generateMemberTarotReading({ database, creditStore: store, repository: makeRepository(state), owner, sessionId: session.id, locale: "en", providerFactory: () => { throw new TarotAIError("configuration", "not configured"); } }),
    (error: unknown) => error instanceof TarotAIError && error.code === "configuration",
  );
  assert.deepEqual(await store.getBalance({ kind: "member", ownerId: owner.userId }), { availableUnits: 1, reservedUnits: 0, totalUnits: 1 });
});

test("follow-up access requires the matching consumed Tarot reservation", async (context) => {
  const { database, store } = makeFixture(context);
  const repositoryState: { stored: StoredReadingRow | null; saveCalls: number[] } = { stored: null, saveCalls: [0] };
  const repository = makeRepository(repositoryState);
  const creditOwner = { kind: "member" as const, ownerId: owner.userId };

  await assert.rejects(
    assertPaidMemberTarotSession({ creditStore: store, repository, owner, sessionId: session.id }),
    (error: unknown) => error instanceof TarotCreditAuthorizationError && error.code === "reading_required",
  );
  await store.grantCredits({ owner: creditOwner, source: "PURCHASE", units: 1, grantKey: "paid-follow-up", policyVersion: "credits-v1", policySnapshot: {}, reason: "test" });
  const provider: TarotAIProvider = { id: "openai", model: "test-model", generateReading: async () => payload() };
  const generated = await generateMemberTarotReading({ database, creditStore: store, repository, owner, sessionId: session.id, locale: "en", providerFactory: () => provider });
  await assertPaidMemberTarotSession({ creditStore: store, repository, owner, sessionId: session.id });

  repositoryState.stored = { ...repositoryState.stored!, id: "different-reading" };
  await assert.rejects(
    assertPaidMemberTarotSession({ creditStore: store, repository, owner, sessionId: session.id }),
    (error: unknown) => error instanceof TarotCreditAuthorizationError && error.code === "reading_required",
  );
  assert.notEqual(generated.readingId, repositoryState.stored.id);
});

test("guest follow-up access fails as unauthenticated before checking the ledger", async () => {
  let ledgerCalls = 0;
  const guestStore = { getReservationByKey: async () => { ledgerCalls += 1; return null; } } as unknown as CreditStore;
  await assert.rejects(
    assertPaidMemberTarotSession({ creditStore: guestStore, repository: makeRepository({ stored: null, saveCalls: [0] }), owner: { kind: "guest", guestId: "guest-auth-check" }, sessionId: session.id }),
    (error: unknown) => error instanceof TarotCreditAuthorizationError && error.code === "unauthenticated",
  );
  assert.equal(ledgerCalls, 0);
});

test("guest identity cannot enter the member AI generation service", async (context) => {
  const { database, store } = makeFixture(context);
  const state: { stored: StoredReadingRow | null; saveCalls: number[] } = { stored: null, saveCalls: [0] };
  let providerCalls = 0;
  const provider: TarotAIProvider = { id: "openai", model: "test-model", generateReading: async () => { providerCalls += 1; return payload(); } };
  await assert.rejects(
    generateMemberTarotReading({ database, creditStore: store, repository: makeRepository(state), owner: { kind: "guest", guestId: "guest-without-credit" }, sessionId: session.id, locale: "en", providerFactory: () => provider }),
    (error: unknown) => error instanceof TarotCreditAuthorizationError && error.code === "unauthenticated",
  );
  assert.equal(providerCalls, 0);
});

test("guest can hydrate only their own already-stored reading without an AI provider", async () => {
  const guest: ReadingOwner = { kind: "guest", guestId: "guest-stored-reading" };
  const context: { stored: StoredReadingRow | null; saveCalls: number[] } = { stored: storedReading("guest-reading-1"), saveCalls: [0] };
  const repository = makeRepository(context, guest);
  const hydrated = await getStoredTarotReadingForOwner({ repository, owner: guest, sessionId: session.id, locale: "en" });
  assert.equal(hydrated?.readingId, "guest-reading-1");
  assert.equal(hydrated?.provider, "deepseek");

  const otherGuest = await getStoredTarotReadingForOwner({ repository, owner: { kind: "guest", guestId: "guest-someone-else" }, sessionId: session.id, locale: "en" });
  assert.equal(otherGuest, null);
  assert.equal(context.saveCalls[0], 0);
});

test("provider failure releases the reservation and a retry can charge once", async (context) => {
  const { database, store } = makeFixture(context);
  await store.grantCredits({ owner: { kind: "member", ownerId: owner.userId }, source: "PURCHASE", units: 1, grantKey: "retry-credit", policyVersion: "credits-v1", policySnapshot: {}, reason: "test" });
  const state: { stored: StoredReadingRow | null; saveCalls: number[] } = { stored: null, saveCalls: [0] };
  const repository = makeRepository(state);
  let shouldFail = true;
  let providerCalls = 0;
  const provider: TarotAIProvider = { id: "openai", model: "test-model", generateReading: async () => { providerCalls += 1; if (shouldFail) throw new TarotAIError("upstream", "safe", { retryable: true }); return payload(); } };
  await assert.rejects(generateMemberTarotReading({ database, creditStore: store, repository, owner, sessionId: session.id, locale: "en", providerFactory: () => provider }));
  assert.deepEqual(await store.getBalance({ kind: "member", ownerId: owner.userId }), { availableUnits: 1, reservedUnits: 0, totalUnits: 1 });
  shouldFail = false;
  await generateMemberTarotReading({ database, creditStore: store, repository, owner, sessionId: session.id, locale: "en", providerFactory: () => provider });
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
  const first = generateMemberTarotReading({ database, creditStore: store, repository, owner, sessionId: session.id, locale: "en", providerFactory: () => provider });
  await new Promise((resolve) => setTimeout(resolve, 20));
  await assert.rejects(
    generateMemberTarotReading({ database, creditStore: store, repository, owner, sessionId: session.id, locale: "en", providerFactory: () => provider }),
    (error: unknown) => error instanceof TarotCreditAuthorizationError && error.code === "in_progress",
  );
  releaseProvider?.();
  await first;
  assert.equal(providerCalls, 1);
});
