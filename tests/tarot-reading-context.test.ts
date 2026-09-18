import assert from "node:assert/strict";
import test from "node:test";
import type { CardMeaningRow, ReadingCardWithDetails, ReadingSessionRow, ReadingTemplateWithPositions } from "../lib/tarot-repository";
import { buildTarotPromptContext } from "../lib/ai/prompts/tarot-reading";
import { tarotReadingQualityFixture } from "./fixtures/tarot-reading-quality";
import { buildTarotReadingInput } from "../lib/tarot-reading-context";

const session: ReadingSessionRow = {
  id: "session-context",
  userId: null,
  guestId: "guest-context",
  question: tarotReadingQualityFixture.question,
  optionalContext: tarotReadingQualityFixture.optionalContext || "",
  categoryId: "category-relationships",
  spreadTemplateId: "spread-relationships-check",
  spreadType: "row-3",
  cardCount: 3,
  locale: "vi",
  status: "drawn",
};

const template: ReadingTemplateWithPositions = {
  category: {
    id: session.categoryId,
    slug: "relationships",
    name: "Mối quan hệ",
    description: "Kết nối, sự thành thật và khoảng không giữa những người với nhau.",
  },
  template: {
    id: session.spreadTemplateId,
    categoryId: session.categoryId,
    slug: "relationship-check",
    name: "Kiểm tra mối quan hệ",
    description: "Ba vị trí để nhìn vào động lực, điểm cần chăm sóc và hướng hỗ trợ.",
    cardCount: 3,
    spreadType: session.spreadType,
  },
  positions: tarotReadingQualityFixture.cards.map((card) => ({
    id: card.position.id,
    key: card.position.key,
    order: card.position.order,
    name: card.position.name,
    meaning: card.position.meaning,
    prompt: card.position.prompt,
  })),
};

function card(cardIndex: number): ReadingCardWithDetails {
  const source = tarotReadingQualityFixture.cards[cardIndex];
  const name = source.card.nameEn;
  const id = source.card.id === "ten-of-cups" ? "cups-ten" : source.card.id === "page-of-cups" ? "cups-page" : "major-the-chariot";
  return {
    id: source.readingCardId,
    sessionId: session.id,
    cardId: id,
    spreadPositionId: source.position.id,
    positionKey: source.position.key,
    positionOrder: source.position.order,
    positionLabel: source.position.name,
    orientation: source.orientation,
    cardOrder: source.position.order,
    deckId: "deck-rider-waite-smith",
    cardNumber: cardIndex,
    slug: name.toLowerCase().replaceAll(" ", "-"),
    nameEn: name,
    nameVi: source.card.nameVi,
    arcana: source.card.arcana,
    suit: source.card.suit || "Major Arcana",
    imageUrl: "/cards/test.webp",
    positionPrompt: source.position.prompt,
    positionDescription: source.position.meaning,
  };
}

function meaning(cardId: string, orientation: "upright" | "reversed"): CardMeaningRow {
  return {
    id: `${cardId}-vi-${orientation}`,
    cardId,
    locale: "vi",
    orientation,
    summary: `legacy ${cardId} ${orientation}`,
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

function meaningPairs(cards: ReadingCardWithDetails[]) {
  return new Map(cards.map((current) => [current.cardId, { upright: meaning(current.cardId, "upright"), reversed: meaning(current.cardId, "reversed") }]));
}

test("builds a bounded V5 context from the exact stored cards and positions", () => {
  const storedCards = [card(2), card(0), card(1)];
  const input = buildTarotReadingInput({ session, cards: storedCards, template, meanings: meaningPairs(storedCards), locale: "vi" });

  assert.equal(input.knowledgeVersion, "5.0");
  assert.equal(input.domain, "love");
  assert.equal(input.question, session.question);
  assert.equal(input.optionalContext, session.optionalContext);
  assert.deepEqual(input.category, {
    id: template.category.id,
    key: template.category.slug,
    name: template.category.name,
  });
  assert.deepEqual(input.spread, {
    id: template.template.id,
    key: template.template.slug,
    name: template.template.name,
    description: template.template.description,
  });
  assert.deepEqual(input.cards.map((current) => current.readingCardId), [
    "reading-card-persona",
    "reading-card-obstacle",
    "reading-card-solution",
  ]);
  assert.equal(input.cards[0].orientation, "reversed");
  assert.equal(input.cards[0].position.name, "Persona");
  // D1 remains authoritative; V5 only supplements the localized meaning rows.
  assert.equal(input.cards[0].knowledge.upright.summary, "legacy cups-ten upright");
  assert.equal(input.cards[0].knowledge.reversed.summary, "legacy cups-ten reversed");
  assert.match(input.cards[0].knowledge.upright.core || "", /emotional fulfillment|shared belonging/i);
  assert.ok(Object.values(input.retrievedGuidance).flat().some((item) => /position/i.test(item)));
  assert.ok(input.fewShotExamples.length <= 2);
  assert.ok(input.fewShotExamples.some((example) => example.id === "HR001"));

  const prompt = buildTarotPromptContext(input);
  assert.match(prompt, /"knowledge_version":"5\.0"/);
  assert.match(prompt, /emotional fulfillment|shared belonging/i);
  assert.doesNotMatch(prompt, /G001|B01|benchmark|evaluation/);
  assert.doesNotMatch(prompt, /The Fool/);
});

test("preserves every localized D1 evidence field and only supplements known handbook cards", () => {
  const cards = [card(0)];
  cards[0].nameEn = "An independently catalogued card";
  cards[0].suit = "Stored suit";
  const meanings = meaningPairs(cards);
  for (const row of Object.values(meanings.get(cards[0].cardId)!)) {
    row.locale = "en";
    row.actions = "One complete action paragraph. Another sentence.";
    row.keywords = "first, second · third";
    row.journalQuestions = ["Stored question?"];
  }
  const input = buildTarotReadingInput({
    session: { ...session, cardCount: 1 }, cards,
    template: { ...template, template: { ...template.template, cardCount: 1 }, positions: [template.positions[0]] },
    meanings, locale: "en",
  });
  assert.equal(input.locale, "en");
  assert.equal(input.cards[0].card.suit, "Stored suit");
  for (const orientation of ["upright", "reversed"] as const) {
    assert.deepEqual(input.cards[0].knowledge[orientation], {
      summary: `legacy cups-ten ${orientation}`, energy: "legacy energy",
      actions: ["One complete action paragraph. Another sentence."],
      relationships: "legacy relationships", work: "legacy work", creativity: "legacy creativity",
      home: "legacy home", symbolism: "legacy symbolism", journalQuestions: ["Stored question?"],
      keywords: ["first", "second", "third"],
    });
  }
  assert.deepEqual(input.cards[0].card.keywords, ["first", "second", "third"]);
});

test("rejects cards from another session and duplicate position coverage", () => {
  const cards = [card(0), card(1), card(2)];
  const build = (changedCards: ReadingCardWithDetails[], changedTemplate = template) => buildTarotReadingInput({ session, cards: changedCards, template: changedTemplate, meanings: meaningPairs(cards), locale: "vi" });
  assert.throws(() => build([{ ...cards[0], sessionId: "another-session" }, ...cards.slice(1)]), /session/i);
  assert.throws(() => build([cards[0], { ...cards[1], spreadPositionId: cards[0].spreadPositionId, positionKey: cards[0].positionKey, positionOrder: cards[0].positionOrder }, cards[2]]), /position/i);
  assert.throws(() => build(cards, { ...template, template: { ...template.template, categoryId: "wrong-category" } }), /template|category/i);
  assert.throws(() => build(cards, { ...template, positions: template.positions.map((p) => ({ ...p, order: 0 })) }), /position/i);
});

test("fails before a provider receives missing or mismatched D1 evidence", () => {
  const cards = [card(0), card(1), card(2)];
  let providerCalls = 0;
  const provider = (input: unknown) => { providerCalls++; return input; };
  const variants = [
    { locale: "en" }, { cardId: "undrawn-card" }, { orientation: "upright" },
  ] as const;
  for (const change of variants) {
    const meanings = meaningPairs(cards);
    Object.assign(meanings.get(cards[0].cardId)!.reversed, change);
    assert.throws(() => provider(buildTarotReadingInput({ session, cards, template, meanings, locale: "vi" })), /meaning/i);
  }
  const meanings = meaningPairs(cards);
  meanings.delete(cards[0].cardId);
  assert.throws(() => provider(buildTarotReadingInput({ session, cards, template, meanings, locale: "vi" })), /meaning/i);
  assert.throws(() => provider(buildTarotReadingInput({ session, cards, template: { ...template, positions: [] }, meanings: meaningPairs(cards), locale: "vi" })), /position/i);
  assert.equal(providerCalls, 0);
});

test("bounds stored question/context using draw limits and normalizes empty optional context", () => {
  const cards = [card(0), card(1), card(2)];
  const build = (question: string, optionalContext: string) => buildTarotReadingInput({ session: { ...session, question, optionalContext }, cards, template, meanings: meaningPairs(cards), locale: "vi" });
  assert.equal(build(" q ", "  ").optionalContext, null);
  assert.equal(build(" q ", " context ").question, "q");
  assert.equal(build("q".repeat(500), "c".repeat(5000)).optionalContext?.length, 5000);
  assert.throws(() => build("q".repeat(501), ""), /question/i);
  assert.throws(() => build("q", "c".repeat(5001)), /context/i);
  assert.throws(() => build("   ", ""), /question/i);
});

test("ignores extra catalog/knowledge fields and never retrieves examples with undrawn cards", () => {
  const cards = [card(2)];
  const meanings = meaningPairs(cards);
  meanings.set("undrawn", { upright: meaning("undrawn", "upright"), reversed: meaning("undrawn", "reversed") });
  const input = buildTarotReadingInput({
    session: { ...session, cardCount: 1 },
    cards: cards.map((c) => ({ ...c, knowledge: "CLIENT KNOWLEDGE", providerOutput: "PROVIDER OUTPUT" })),
    template: { ...template, template: { ...template.template, cardCount: 1 }, positions: [template.positions[2]] },
    meanings, locale: "vi",
  });
  assert.deepEqual(input.cards.map((c) => c.card.id), ["major-the-chariot"]);
  assert.deepEqual(input.fewShotExamples, []);
  assert.ok(input.combinationHints.every((hint) => hint.cards.every((name) => name === "The Chariot")));
  assert.doesNotMatch(buildTarotPromptContext(input), /CLIENT KNOWLEDGE|PROVIDER OUTPUT|imageUrl|\/cards\/|undrawn|Ten of Cups|Page of Cups|The Fool/);
});

test("rejects a card without its stored position or both orientation rows before provider work", () => {
  const cards = [card(0), card(1), card(2)];
  const missingPosition = { ...template, positions: template.positions.slice(0, 2) };
  assert.throws(() => buildTarotReadingInput({ session, cards, template: missingPosition, meanings: meaningPairs(cards), locale: "vi" }), /position/i);

  const pairs = meaningPairs(cards);
  pairs.delete(cards[1].cardId);
  assert.throws(() => buildTarotReadingInput({ session, cards, template, meanings: pairs, locale: "vi" }), /meaning/i);
});

test("rejects duplicate cards, duplicate reading ids, and an incomplete session", () => {
  const cards = [card(0), card(1), card(2)];
  assert.throws(() => buildTarotReadingInput({ session, cards: [cards[0], cards[0], cards[2]], template, meanings: meaningPairs(cards), locale: "vi" }), /unique|duplicate/i);
  assert.throws(() => buildTarotReadingInput({ session, cards: [], template, meanings: new Map(), locale: "vi" }), /non-empty|card/i);
  assert.throws(() => buildTarotReadingInput({ session: { ...session, cardCount: 2 }, cards, template, meanings: meaningPairs(cards), locale: "vi" }), /count|position/i);
  assert.throws(() => buildTarotReadingInput({ session, cards: [cards[0], { ...cards[1], id: cards[0].id }, cards[2]], template, meanings: meaningPairs(cards), locale: "vi" }), /ids.*unique/i);
  assert.throws(() => buildTarotReadingInput({ session, cards: [cards[0], { ...cards[1], cardId: cards[0].cardId }, cards[2]], template, meanings: meaningPairs(cards), locale: "vi" }), /cards.*unique/i);
  for (const change of [{ orientation: "sideways" }, { positionKey: "unknown" }, { positionOrder: 42 }]) {
    assert.throws(() => buildTarotReadingInput({ session, cards: [{ ...cards[0], ...change }, ...cards.slice(1)], template, meanings: meaningPairs(cards), locale: "vi" }), /orientation|position/i);
  }
});
