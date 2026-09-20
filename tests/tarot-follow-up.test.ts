import assert from "node:assert/strict";
import test from "node:test";
import type { TarotAIProvider } from "../lib/ai/provider";
import { TarotAIError } from "../lib/ai/provider";
import type { TarotReadingPayload } from "../lib/ai/types";
import type { ReadingCardWithDetails, ReadingSessionRow, ReadingTemplateWithPositions, TarotRepository } from "../lib/tarot-repository";
import { generateTarotFollowUp, TarotFollowUpServiceError } from "../lib/tarot-follow-up-service";

const session: ReadingSessionRow = {
  id: "session-1",
  userId: "owner-1",
  guestId: null,
  question: "What is asking for my attention?",
  optionalContext: "Keep this reflective.",
  categoryId: "category-reflection",
  spreadTemplateId: "spread-three-card",
  spreadType: "row-3",
  cardCount: 1,
  locale: "en",
  status: "drawn",
};

const template: ReadingTemplateWithPositions = {
  category: { id: session.categoryId, slug: "reflection", name: "Reflection", description: "A reflective spread." },
  template: { id: session.spreadTemplateId, categoryId: session.categoryId, slug: "three-card", name: "Three Card", description: "A one-card test spread.", cardCount: 1, spreadType: "row-3" },
  positions: [{ id: "position-1", key: "present", order: 0, name: "Present", meaning: "What is present.", prompt: "What is present?" }],
};

const storedCard: ReadingCardWithDetails = {
  id: "reading-card-1",
  sessionId: session.id,
  cardId: "major-fool",
  spreadPositionId: "position-1",
  positionKey: "present",
  positionOrder: 0,
  positionLabel: "Present",
  orientation: "reversed",
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

const storedReading: TarotReadingPayload = {
  directAnswer: "Start with what is observable.\n\nLet the next step stay small.",
  personalInsights: [{ title: "A pattern", body: "A new beginning wants patience." }],
  reflectionPrompts: ["What can you notice without forcing an answer?"],
  nextSteps: [{ title: "One step", body: "Write down the smallest useful action." }],
  cardEvidence: [{
    readingCardId: storedCard.id,
    position: { id: "position-1", key: "present", order: 0, name: "Present", meaning: "What is present.", prompt: "What is present?" },
    card: { id: storedCard.cardId, nameEn: storedCard.nameEn, nameVi: storedCard.nameVi, arcana: storedCard.arcana, suit: storedCard.suit, keywords: ["beginning"] },
    orientation: "reversed",
    interpretation: "Notice the hesitation before acting.",
  }],
  deeperReading: null,
  followUpSuggestions: ["What should I notice first?"],
  disclaimer: "This is reflective guidance.",
};

const storedRow = {
  id: "reading-1",
  sessionId: session.id,
  opening: storedReading.directAnswer,
  cardReadings: JSON.stringify(storedReading.cardEvidence),
  synthesis: "A pattern: A new beginning wants patience.",
  advice: "One step: Write down the smallest useful action.",
  closing: "",
  disclaimer: storedReading.disclaimer,
  readingPayload: JSON.stringify(storedReading),
  modelName: "openai:reading-model",
  promptVersion: "tarot-reading-v3",
  createdAt: 1,
  updatedAt: 1,
};

function repository(overrides: Partial<TarotRepository> = {}): TarotRepository {
  return {
    listCatalog: async () => ({ locale: "en", categories: [] }),
    getActiveDeck: async () => null,
    getActiveTemplate: async () => null,
    getReadingTemplate: async () => template,
    listCards: async () => [],
    createReadingSession: async () => session.id,
    createReadingCards: async () => undefined,
    getSessionForOwner: async () => ({ session, cards: [storedCard] }),
    getLatestReadingForOwner: async () => storedRow,
    getMeaning: async () => null,
    getMeaningPair: async () => null,
    saveReading: async () => "unexpected-save",
    ...overrides,
  };
}

function provider(overrides: Partial<TarotAIProvider> = {}): TarotAIProvider {
  return {
    id: "openai",
    model: "follow-up-model",
    generateReading: async () => storedReading,
    generateFollowUp: async () => ({ answer: "Start with the smallest observable step." }),
    ...overrides,
  };
}

test("hydrates the owned stored reading and sends only bounded continuity context", async () => {
  let capturedInput: Parameters<NonNullable<TarotAIProvider["generateFollowUp"]>>[0] | undefined;
  const result = await generateTarotFollowUp({
    repository: repository(),
    owner: { kind: "user", userId: "owner-1" },
    sessionId: session.id,
    locale: "en",
    followUpQuestion: "What should I notice first?",
    provider: provider({ generateFollowUp: async (input) => {
      capturedInput = input;
      return { answer: "Start with the smallest observable step." };
    } }),
  });

  assert.equal(result.answer, "Start with the smallest observable step.");
  assert.equal(capturedInput?.followUpQuestion, "What should I notice first?");
  assert.equal(capturedInput?.reading.directAnswer, storedReading.directAnswer);
  assert.equal(capturedInput?.cards[0].orientation, "reversed");
  assert.equal(result.promptVersion, "tarot-follow-up-v1");
  assert.equal(result.modelName, "openai:follow-up-model");
  assert.equal(result.source, "ai");
});

test("rejects another owner before invoking the provider", async () => {
  let providerCalls = 0;
  await assert.rejects(
    generateTarotFollowUp({
      repository: repository({ getSessionForOwner: async () => null }),
      owner: { kind: "user", userId: "owner-2" },
      sessionId: session.id,
      locale: "en",
      followUpQuestion: "What should I notice first?",
      provider: provider({ generateFollowUp: async () => { providerCalls += 1; return { answer: "no" }; } }),
    }),
    (error) => error instanceof TarotFollowUpServiceError && error.code === "not_found",
  );
  assert.equal(providerCalls, 0);
});

test("requires a complete drawn session and a saved reading", async (t) => {
  for (const [name, override] of [
    ["pending session", { getSessionForOwner: async () => ({ session: { ...session, status: "pending" }, cards: [storedCard] }) }],
    ["missing card", { getSessionForOwner: async () => ({ session, cards: [] }) }],
    ["missing saved reading", { getLatestReadingForOwner: async () => null }],
  ] as const) {
    await t.test(name, async () => {
      await assert.rejects(
        generateTarotFollowUp({ repository: repository(override), owner: { kind: "user", userId: "owner-1" }, sessionId: session.id, locale: "en", followUpQuestion: "What should I notice first?", provider: provider() }),
        (error) => error instanceof TarotFollowUpServiceError && error.code === "incomplete",
      );
    });
  }
});

test("does not save follow-up transcripts and preserves provider errors", async () => {
  let saveCalls = 0;
  const expected = new TarotAIError("invalid_response", "safe invalid response", { retryable: true });
  await assert.rejects(
    generateTarotFollowUp({
      repository: repository({ saveReading: async () => { saveCalls += 1; return "saved"; } }),
      owner: { kind: "user", userId: "owner-1" },
      sessionId: session.id,
      locale: "en",
      followUpQuestion: "What should I notice first?",
      provider: provider({ generateFollowUp: async () => { throw expected; } }),
    }),
    (error) => error === expected ? expected.retryable : false,
  );
  assert.equal(saveCalls, 0);
});

test("retries one retryable invalid follow-up response without saving a transcript", async () => {
  let providerCalls = 0;
  let saveCalls = 0;
  const invalid = new TarotAIError("invalid_response", "safe invalid follow-up", { retryable: true });

  const result = await generateTarotFollowUp({
    repository: repository({ saveReading: async () => { saveCalls += 1; return "saved"; } }),
    owner: { kind: "user", userId: "owner-1" },
    sessionId: session.id,
    locale: "en",
    followUpQuestion: "What should I notice first?",
    provider: provider({
      generateFollowUp: async () => {
        providerCalls += 1;
        if (providerCalls === 1) throw invalid;
        return { answer: "Start with the smallest observable step." };
      },
    }),
  });

  assert.equal(result.answer, "Start with the smallest observable step.");
  assert.equal(providerCalls, 2);
  assert.equal(saveCalls, 0);
});
