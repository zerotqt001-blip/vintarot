import assert from "node:assert/strict";
import test from "node:test";
import type { TarotAIProvider } from "../lib/ai/provider";
import { TarotAIError } from "../lib/ai/provider";
import type { TarotProviderOutputV3 } from "../lib/ai/types";
import type {
  CardMeaningRow,
  ReadingCardWithDetails,
  ReadingSessionRow,
  ReadingTemplateWithPositions,
  TarotRepository,
} from "../lib/tarot-repository";
import { generateTarotReading, TarotReadingServiceError } from "../lib/tarot-reading-service";

const session: ReadingSessionRow = {
  id: "service-session",
  userId: "user-service",
  guestId: null,
  question: "What is the next useful step in my work?",
  optionalContext: "Keep this reflective and practical.",
  categoryId: "category-business",
  spreadTemplateId: "spread-business-meeting",
  spreadType: "row-3",
  cardCount: 3,
  locale: "en",
  status: "drawn",
};

const template: ReadingTemplateWithPositions = {
  category: { id: session.categoryId, slug: "business", name: "Business", description: "Work and grounded decisions." },
  template: { id: session.spreadTemplateId, categoryId: session.categoryId, slug: "the-big-meeting", name: "The Big Meeting", description: "A practical three-card spread.", cardCount: 3, spreadType: "row-3" },
  positions: ["strength", "needs", "bridge"].map((key, order) => ({ id: `position-${key}`, key, order, name: key, meaning: `Meaning ${key}`, prompt: `Prompt ${key}` })),
};

const cardNames = [
  ["wands-eight", "Eight of Wands", "Eight of Wands", "Wands"],
  ["pentacles-ten", "Ten of Pentacles", "Ten of Pentacles", "Pentacles"],
  ["major-temperance", "Temperance", "Temperance", "Major Arcana"],
] as const;

function cards(): ReadingCardWithDetails[] {
  return cardNames.map(([cardId, nameEn, nameVi, suit], index) => ({
    id: `service-card-${index}`,
    sessionId: session.id,
    cardId,
    spreadPositionId: template.positions[index].id,
    positionKey: template.positions[index].key,
    positionOrder: index,
    positionLabel: template.positions[index].name,
    orientation: index === 1 ? "reversed" : "upright",
    cardOrder: index,
    deckId: "deck-rider-waite-smith",
    cardNumber: index,
    slug: nameEn.toLowerCase().replaceAll(" ", "-"),
    nameEn,
    nameVi,
    arcana: suit === "Major Arcana" ? "major" : "minor",
    suit,
    imageUrl: "/cards/service.webp",
    positionPrompt: template.positions[index].prompt,
    positionDescription: template.positions[index].meaning,
  }));
}

function meaning(cardId: string, orientation: "upright" | "reversed"): CardMeaningRow {
  return {
    id: `${cardId}-${orientation}`,
    cardId,
    locale: "en",
    orientation,
    summary: "legacy summary",
    energy: "legacy energy",
    actions: "legacy actions",
    relationships: "legacy relationships",
    work: "legacy work",
    creativity: "legacy creativity",
    home: "legacy home",
    symbolism: "legacy symbolism",
    journalQuestions: [],
    keywords: "legacy",
  };
}

function output(inputCards: ReadingCardWithDetails[]): TarotProviderOutputV3 {
  return {
    direct_answer: "A spread-level direct answer.\n\nChoose one practical next step.",
    personal_insights: [{ title: "The pattern", body: "The cards show a practical progression." }],
    reflection_prompts: ["What would you like to notice?"],
    next_steps: [{ title: "One experiment", body: "Choose one small experiment." }],
    card_evidence: inputCards.map((card) => ({ reading_card_id: card.id, position_key: card.positionKey, interpretation: "A grounded interpretation." })),
    deeper_reading: null,
    follow_up_suggestions: ["Explore the pattern."],
  };
}

function repository(overrides: Partial<TarotRepository> = {}): TarotRepository {
  const storedCards = cards();
  return {
    listCatalog: async () => ({ locale: "en", categories: [] }),
    getActiveDeck: async () => null,
    getActiveTemplate: async () => null,
    getReadingTemplate: async () => template,
    listCards: async () => [],
    createReadingSession: async () => session.id,
    createReadingCards: async () => undefined,
    getSessionForOwner: async () => ({ session, cards: storedCards }),
    getLatestReadingForOwner: async () => null,
    getMeaning: async () => null,
    getMeaningPair: async (cardId) => ({ upright: meaning(cardId, "upright"), reversed: meaning(cardId, "reversed") }),
    saveReading: async () => "saved-reading",
    ...overrides,
  };
}

function provider(overrides: Partial<TarotAIProvider> = {}): TarotAIProvider {
  const base: TarotAIProvider = {
    id: "openai",
    model: "test-model",
    generateReading: async (input) => {
      const value = output(input.cards.map((card) => ({
        id: card.readingCardId,
        cardId: card.card.id,
        sessionId: session.id,
        spreadPositionId: card.position.id,
        positionKey: card.position.key,
        positionOrder: card.position.order,
        positionLabel: card.position.name,
        orientation: card.orientation,
        cardOrder: card.position.order,
        deckId: "deck",
        cardNumber: card.position.order,
        slug: card.card.id,
        nameEn: card.card.nameEn,
        nameVi: card.card.nameVi,
        arcana: card.card.arcana,
        suit: card.card.suit || "Major Arcana",
        imageUrl: "/cards/test.webp",
        positionPrompt: card.position.prompt,
        positionDescription: card.position.meaning,
      })));
      const { parseReadingPayload } = await import("../lib/tarot-interpretation");
      return parseReadingPayload(value, input.cards, input.locale);
    },
    ...overrides,
  };
  return base;
}

test("orchestrates one owner-checked V5 context, provider call, and persistence", async () => {
  let providerCalls = 0;
  let saved: Parameters<TarotRepository["saveReading"]>[0] | undefined;
  const result = await generateTarotReading({
    repository: repository({ saveReading: async (input) => { saved = input; return input.id; } }),
    owner: { kind: "user", userId: "user-service" },
    sessionId: session.id,
    locale: "en",
    provider: provider({ generateReading: async (input) => { providerCalls += 1; return provider().generateReading(input); } }),
  });

  assert.equal(providerCalls, 1);
  assert.equal(result.source, "ai");
  assert.equal(result.readingId, saved?.id);
  assert.equal(result.provider, "openai");
  assert.equal(result.modelName, "openai:test-model");
  assert.equal(result.promptVersion, "tarot-reading-v4.2");
  assert.match(result.reading.directAnswer, /spread-level direct answer/);
  assert.equal(result.reading.cardEvidence.length, 3);
  assert.deepEqual(result.reading.cardEvidence.map((card) => card.readingCardId), cards().map((card) => card.id));
  assert.equal(result.reading.cardEvidence[1].position.key, template.positions[1].key);
  assert.equal(result.reading.cardEvidence[1].orientation, "reversed");
  assert.equal(saved?.reading.directAnswer, result.reading.directAnswer);
  assert.equal(saved?.reading.cardEvidence.length, result.reading.cardEvidence.length);
  assert.deepEqual(saved?.reading, result.reading);
  assert.equal(saved?.modelName, "openai:test-model");
  assert.equal(saved?.promptVersion, "tarot-reading-v4.2");
});

test("loads the owner's stored template, exact cards, and requested-locale meaning pairs", async () => {
  const calls: string[] = [];
  let providerCardIds: string[] = [];
  const result = await generateTarotReading({
    repository: repository({
      getSessionForOwner: async (sessionId, owner) => {
        calls.push(`session:${sessionId}:${owner.kind}:${owner.kind === "user" ? owner.userId : owner.guestId}`);
        return { session, cards: cards() };
      },
      getReadingTemplate: async (templateId, locale) => {
        calls.push(`template:${templateId}:${locale}`);
        return template;
      },
      getMeaningPair: async (cardId, locale) => {
        calls.push(`meaning:${cardId}:${locale}`);
        return { upright: meaning(cardId, "upright"), reversed: meaning(cardId, "reversed") };
      },
    }),
    owner: { kind: "user", userId: "user-service" },
    sessionId: session.id,
    locale: "en",
    provider: provider({
      generateReading: async (input) => {
        providerCardIds = input.cards.map((card) => card.card.id);
        return provider().generateReading(input);
      },
    }),
  });

  assert.deepEqual(calls, [
    "session:service-session:user:user-service",
    "template:spread-business-meeting:en",
    "meaning:wands-eight:en",
    "meaning:pentacles-ten:en",
    "meaning:major-temperance:en",
  ]);
  assert.deepEqual(providerCardIds, ["wands-eight", "pentacles-ten", "major-temperance"]);
  assert.deepEqual(Object.keys(result).sort(), ["locale", "modelName", "promptVersion", "provider", "reading", "readingId", "sessionId", "source"]);
  assert.equal(JSON.stringify(result).includes(session.question), false);
  assert.equal(JSON.stringify(result).includes(session.optionalContext), false);
});

test("rejects an unknown or incomplete owned session before invoking the provider", async () => {
  let calls = 0;
  const countingProvider = provider({ generateReading: async () => { calls += 1; throw new Error("should not run"); } });
  await assert.rejects(
    generateTarotReading({ repository: repository({ getSessionForOwner: async () => null }), ownerId: "user-service", sessionId: session.id, locale: "en", provider: countingProvider }),
    (error) => error instanceof TarotReadingServiceError && error.code === "not_found",
  );
  await assert.rejects(
    generateTarotReading({ repository: repository({ getSessionForOwner: async () => ({ session, cards: cards().slice(0, 2) }) }), ownerId: "user-service", sessionId: session.id, locale: "en", provider: countingProvider }),
    (error) => error instanceof TarotReadingServiceError && error.code === "incomplete",
  );
  await assert.rejects(
    generateTarotReading({ repository: repository({ getSessionForOwner: async () => ({ session: { ...session, status: "pending" }, cards: cards() }) }), ownerId: "user-service", sessionId: session.id, locale: "en", provider: countingProvider }),
    (error) => error instanceof TarotReadingServiceError && error.code === "incomplete",
  );
  assert.equal(calls, 0);
});

test("treats another owner's session as not found", async () => {
  await assert.rejects(
    generateTarotReading({
      repository: repository({
        getSessionForOwner: async (_sessionId, owner) => owner.kind === "user" && owner.userId === "user-service"
          ? { session, cards: cards() }
          : null,
      }),
      ownerId: "user-other",
      sessionId: session.id,
      locale: "en",
      provider: provider(),
    }),
    (error) => error instanceof TarotReadingServiceError && error.code === "not_found",
  );
});

test("does not replace a selected provider failure with a local template", async () => {
  const providerError = new TarotAIError("upstream", "Selected provider failed safely.", { retryable: true });
  await assert.rejects(
    generateTarotReading({ repository: repository(), ownerId: "user-service", sessionId: session.id, locale: "en", provider: provider({ generateReading: async () => { throw providerError; } }) }),
    (error) => error === providerError,
  );
});

test("preserves safe configuration, upstream, and invalid-response provider errors", async () => {
  for (const code of ["configuration", "upstream", "invalid_response"] as const) {
    const expected = new TarotAIError(code, `safe ${code}`, { retryable: code !== "configuration" });
    await assert.rejects(
      generateTarotReading({
        repository: repository(),
        ownerId: "user-service",
        sessionId: session.id,
        locale: "en",
        provider: provider({ generateReading: async () => { throw expected; } }),
      }),
      (error) => error === expected,
    );
  }
});

test("classifies persistence failure after one provider call", async () => {
  let providerCalls = 0;
  await assert.rejects(
    generateTarotReading({
      repository: repository({ saveReading: async () => { throw new Error("database unavailable"); } }),
      ownerId: "user-service",
      sessionId: session.id,
      locale: "en",
      provider: provider({
        generateReading: async (input) => {
          providerCalls += 1;
          return provider().generateReading(input);
        },
      }),
    }),
    (error) => error instanceof TarotReadingServiceError && error.code === "persistence",
  );
  assert.equal(providerCalls, 1);
});

test("fails before provider work when a historical template or meaning pair is missing", async () => {
  let calls = 0;
  const countingProvider = provider({ generateReading: async () => { calls += 1; throw new Error("should not run"); } });
  await assert.rejects(
    generateTarotReading({ repository: repository({ getReadingTemplate: async () => null }), ownerId: "user-service", sessionId: session.id, locale: "en", provider: countingProvider }),
    (error) => error instanceof TarotReadingServiceError && error.code === "incomplete",
  );
  await assert.rejects(
    generateTarotReading({ repository: repository({ getMeaningPair: async () => null }), ownerId: "user-service", sessionId: session.id, locale: "en", provider: countingProvider }),
    (error) => error instanceof TarotReadingServiceError && error.code === "incomplete",
  );
  assert.equal(calls, 0);
});
