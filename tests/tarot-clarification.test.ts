import assert from "node:assert/strict";
import test from "node:test";
import type { TarotAIProvider } from "../lib/ai/provider";
import { TarotAIError } from "../lib/ai/provider";
import type { TarotReadingPayload } from "../lib/ai/types";
import type { StoredReadingRow } from "../lib/tarot-reading-compat";
import type { CardMeaningRow, CardRow, ReadingCardWithDetails, ReadingSessionRow, ReadingTemplateWithPositions, TarotRepository } from "../lib/tarot-repository";
import { generateTarotClarification, TarotClarificationServiceError } from "../lib/tarot-clarification-service";

const session: ReadingSessionRow = {
  id: "clarification-session",
  userId: null,
  guestId: "guest-1",
  question: "What should I notice in this decision?",
  optionalContext: "Keep this practical.",
  categoryId: "category-business",
  spreadTemplateId: "spread-single",
  spreadType: "single",
  cardCount: 1,
  locale: "en",
  status: "drawn",
};

const template: ReadingTemplateWithPositions = {
  category: { id: session.categoryId, slug: "business", name: "Business", description: "Work and grounded decisions." },
  template: { id: session.spreadTemplateId, categoryId: session.categoryId, slug: "one-card", name: "One Card", description: "A focused reflection.", cardCount: 1, spreadType: "single" },
  positions: [{ id: "position-present", key: "present", order: 0, name: "Present", meaning: "What is present.", prompt: "What is present?" }],
};

const originalCard: ReadingCardWithDetails = {
  id: "reading-card-original",
  sessionId: session.id,
  cardId: "card-original",
  spreadPositionId: "position-present",
  positionKey: "present",
  positionOrder: 0,
  positionLabel: "Present",
  orientation: "upright",
  cardOrder: 0,
  deckId: "deck-rws",
  cardNumber: 0,
  slug: "the-fool",
  nameEn: "The Fool",
  nameVi: "The Fool",
  arcana: "major",
  suit: "Major Arcana",
  imageUrl: "/cards/the-fool.webp",
  positionPrompt: "What is present?",
  positionDescription: "What is present.",
};

const candidateCards: CardRow[] = [
  { id: "card-original", deckId: "deck-rws", cardNumber: 0, slug: "the-fool", nameEn: "The Fool", nameVi: "The Fool", arcana: "major", suit: "Major Arcana", imageUrl: "/cards/the-fool.webp" },
  { id: "card-sun", deckId: "deck-rws", cardNumber: 1, slug: "the-sun", nameEn: "The Sun", nameVi: "The Sun", arcana: "major", suit: "Major Arcana", imageUrl: "/cards/the-sun.webp" },
  { id: "card-moon", deckId: "deck-rws", cardNumber: 2, slug: "the-moon", nameEn: "The Moon", nameVi: "The Moon", arcana: "major", suit: "Major Arcana", imageUrl: "/cards/the-moon.webp" },
];

function meaning(cardId: string, orientation: "upright" | "reversed"): CardMeaningRow {
  return {
    id: `${cardId}-${orientation}`,
    cardId,
    locale: "en",
    orientation,
    summary: "A grounded meaning.",
    energy: "A clear energy.",
    actions: "Notice the next choice.",
    relationships: "Communicate plainly.",
    work: "Choose a practical step.",
    creativity: "Make room to try.",
    home: "Stay close to what is real.",
    symbolism: "A useful symbol.",
    journalQuestions: ["What is observable?"],
    keywords: "clarity, choice",
  };
}

const originalReading: TarotReadingPayload = {
  directAnswer: "Start with what is observable.\n\nLet the next step stay small.",
  personalInsights: [{ title: "A pattern", body: "You are waiting for certainty before choosing." }],
  reflectionPrompts: [],
  nextSteps: [{ title: "One step", body: "Choose one practical action." }],
  cardEvidence: [{
    readingCardId: originalCard.id,
    position: { id: "position-present", key: "present", order: 0, name: "Present", meaning: "What is present.", prompt: "What is present?" },
    card: { id: originalCard.cardId, nameEn: originalCard.nameEn, nameVi: originalCard.nameVi, arcana: originalCard.arcana, suit: originalCard.suit, keywords: ["beginning"] },
    orientation: "upright",
    interpretation: "Notice the current pattern.",
  }],
  deeperReading: null,
  followUpSuggestions: ["What should I notice next?"],
  disclaimer: "This is reflective guidance.",
};

const storedRow: StoredReadingRow = {
  id: "reading-original",
  sessionId: session.id,
  opening: originalReading.directAnswer,
  cardReadings: JSON.stringify(originalReading.cardEvidence),
  synthesis: "A pattern: You are waiting for certainty.",
  advice: "One step: Choose one practical action.",
  closing: "",
  disclaimer: originalReading.disclaimer,
  readingPayload: JSON.stringify(originalReading),
  modelName: "deepseek:test-model",
  promptVersion: "tarot-reading-v4.2.2",
  createdAt: 1,
  updatedAt: 1,
};

function repository(reading: TarotReadingPayload = originalReading, overrides: Partial<TarotRepository> = {}): TarotRepository {
  return {
    listCatalog: async () => ({ locale: "en", categories: [] }),
    getActiveDeck: async () => ({ id: "deck-rws", slug: "rws", name: "Rider Waite Smith", artist: "Artist", description: "Deck" }),
    getActiveTemplate: async () => null,
    getReadingTemplate: async () => template,
    listCards: async () => candidateCards,
    createReadingSession: async () => session.id,
    createReadingCards: async () => undefined,
    getSessionForOwner: async () => ({ session, cards: [originalCard] }),
    getLatestReadingForOwner: async () => ({ ...storedRow, readingPayload: JSON.stringify(reading) }),
    getMeaning: async (cardId, _locale, orientation) => meaning(cardId, orientation),
    getMeaningPair: async (cardId) => ({ upright: meaning(cardId, "upright"), reversed: meaning(cardId, "reversed") }),
    saveReading: async () => "unexpected-save",
    updateReadingPayload: async () => true,
    ...overrides,
  };
}

function provider(overrides: Partial<TarotAIProvider> = {}): TarotAIProvider {
  return {
    id: "deepseek",
    model: "clarification-model",
    generateReading: async () => originalReading,
    generateClarification: async () => ({ answer: "Notice the smallest observable choice." }),
    ...overrides,
  };
}

function random(values: number[]): () => number {
  return () => values.shift() ?? 0.99;
}

test("draws a server-selected unused card, sends trusted context, and persists one clarification", async () => {
  let capturedInput: Parameters<NonNullable<TarotAIProvider["generateClarification"]>>[0] | undefined;
  let updateCalls = 0;
  let savedPayload: TarotReadingPayload | undefined;
  const result = await generateTarotClarification({
    repository: repository(originalReading, {
      updateReadingPayload: async (_readingId, _sessionId, payload) => { updateCalls += 1; savedPayload = payload; return true; },
    }),
    owner: { kind: "guest", guestId: "guest-1" },
    sessionId: session.id,
    locale: "en",
    followUpQuestion: "What should I notice first?",
    requestId: "request-1",
    provider: provider({ generateClarification: async (input) => { capturedInput = input; return { answer: "Notice the smallest observable choice." }; } }),
    random: random([0, 0.99]),
  });

  assert.equal(result.readingId, storedRow.id);
  assert.equal(result.clarification.card.id, "card-sun");
  assert.equal(result.clarification.orientation, "upright");
  assert.equal(result.clarification.sequence, 1);
  assert.equal(result.clarification.relationship, "clarification");
  assert.equal(capturedInput?.supplementaryCard.card.id, "card-sun");
  assert.equal(capturedInput?.followUpQuestion, "What should I notice first?");
  assert.equal(updateCalls, 1);
  assert.equal(savedPayload?.supplementaryDraws?.length, 1);
});

test("rejects foreign or incomplete sessions before provider work", async (t) => {
  for (const [name, override] of [
    ["foreign owner", { getSessionForOwner: async () => null }],
    ["pending session", { getSessionForOwner: async () => ({ session: { ...session, status: "pending" }, cards: [originalCard] }) }],
  ] as const) {
    await t.test(name, async () => {
      let providerCalls = 0;
      await assert.rejects(
        generateTarotClarification({ repository: repository(originalReading, override), owner: { kind: "guest", guestId: "guest-1" }, sessionId: session.id, locale: "en", followUpQuestion: "What should I notice?", requestId: "request-1", provider: provider({ generateClarification: async () => { providerCalls += 1; return { answer: "No" }; } }) }),
        (error) => error instanceof TarotClarificationServiceError && (name === "foreign owner" ? error.code === "not_found" : error.code === "incomplete"),
      );
      assert.equal(providerCalls, 0);
    });
  }
});

test("excludes original and previous supplementary cards, applies orientation, and enforces the three-draw limit", async () => {
  const previous = {
    ...originalReading,
    supplementaryDraws: [{ id: "old-1", requestId: "old-request", sequence: 1, question: "Old?", relationship: "clarification" as const, card: { id: "card-sun", nameEn: "The Sun", nameVi: "The Sun", arcana: "major", suit: "Major Arcana" }, orientation: "upright" as const, answer: "Old answer." }],
  };
  let capturedCard = "";
  const result = await generateTarotClarification({
    repository: repository(previous),
    owner: { kind: "guest", guestId: "guest-1" },
    sessionId: session.id,
    locale: "en",
    followUpQuestion: "What changes now?",
    requestId: "request-2",
    provider: provider({ generateClarification: async (input) => { capturedCard = input.supplementaryCard.card.id; return { answer: "A different card adds another angle." }; } }),
    random: random([0, 0]),
  });
  assert.equal(capturedCard, "card-moon");
  assert.equal(result.clarification.orientation, "reversed");

  const exhausted = { ...originalReading, supplementaryDraws: [1, 2, 3].map((sequence) => ({ id: `old-${sequence}`, requestId: `old-request-${sequence}`, sequence, question: `Old ${sequence}?`, relationship: "clarification" as const, card: { id: `old-card-${sequence}`, nameEn: "Old", nameVi: "Cũ", arcana: "major", suit: null }, orientation: "upright" as const, answer: "Old answer." })) };
  let providerCalls = 0;
  await assert.rejects(
    generateTarotClarification({ repository: repository(exhausted), owner: { kind: "guest", guestId: "guest-1" }, sessionId: session.id, locale: "en", followUpQuestion: "One more?", requestId: "request-4", provider: provider({ generateClarification: async () => { providerCalls += 1; return { answer: "No" }; } }) }),
    (error) => error instanceof TarotClarificationServiceError && error.code === "limit",
  );
  assert.equal(providerCalls, 0);
});

test("returns an existing request id without another provider call and leaves failed payloads unchanged", async () => {
  const existing = {
    ...originalReading,
    supplementaryDraws: [{ id: "existing", requestId: "same-request", sequence: 1, question: "Existing?", relationship: "clarification" as const, card: { id: "card-sun", nameEn: "The Sun", nameVi: "The Sun", arcana: "major", suit: "Major Arcana" }, orientation: "upright" as const, answer: "Already answered." }],
  };
  let providerCalls = 0;
  let updateCalls = 0;
  const idempotent = await generateTarotClarification({ repository: repository(existing, { updateReadingPayload: async () => { updateCalls += 1; return true; } }), owner: { kind: "guest", guestId: "guest-1" }, sessionId: session.id, locale: "en", followUpQuestion: "Existing?", requestId: "same-request", provider: provider({ generateClarification: async () => { providerCalls += 1; return { answer: "Wrong" }; } }) });
  assert.equal(idempotent.clarification.id, "existing");
  assert.equal(providerCalls, 0);
  assert.equal(updateCalls, 0);

  const expectedError = new TarotAIError("upstream", "safe provider failure", { retryable: true });
  let failedUpdates = 0;
  await assert.rejects(
    generateTarotClarification({ repository: repository(originalReading, { updateReadingPayload: async () => { failedUpdates += 1; return true; } }), owner: { kind: "guest", guestId: "guest-1" }, sessionId: session.id, locale: "en", followUpQuestion: "Will this work?", requestId: "failed-request", provider: provider({ generateClarification: async () => { throw expectedError; } }) }),
    (error) => error === expectedError,
  );
  assert.equal(failedUpdates, 0);
});

test("retries one invalid clarification response and persists only the final answer", async () => {
  let calls = 0;
  let updates = 0;
  const result = await generateTarotClarification({
    repository: repository(originalReading, { updateReadingPayload: async () => { updates += 1; return true; } }),
    owner: { kind: "guest", guestId: "guest-1" },
    sessionId: session.id,
    locale: "en",
    followUpQuestion: "What should I notice?",
    requestId: "retry-request",
    provider: provider({ generateClarification: async () => { calls += 1; if (calls === 1) throw new TarotAIError("invalid_response", "safe invalid", { retryable: true }); return { answer: "Final clarification." }; } }),
    random: random([0, 0.99]),
  });
  assert.equal(result.clarification.answer, "Final clarification.");
  assert.equal(calls, 2);
  assert.equal(updates, 1);
});
