import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import test, { type TestContext } from "node:test";
import { TAROT_PROMPT_VERSION } from "../lib/ai/prompts/tarot-reading";
import { parseReadingPayload } from "../lib/tarot-interpretation";
import { buildTarotReadingInput } from "../lib/tarot-reading-context";
import { getTarotRepository } from "../lib/tarot-repository";

// Execute repository SQL against the shipped schema/seed, not canned query results.
function database(t: TestContext) {
  const sqlite = new DatabaseSync(":memory:");
  t.after(() => sqlite.close());
  for (const file of ["0001_dynamic_tarot.sql", "0002_tarot_seed.sql"]) {
    sqlite.exec(readFileSync(new URL(`../drizzle/${file}`, import.meta.url), "utf8"));
  }
  const prepare = (sql: string) => {
    let values: SQLInputValue[] = [];
    return {
      bind(...args: SQLInputValue[]) { values = args; return this; },
      async first() { return sqlite.prepare(sql).get(...values) || null; },
      async all() { return { results: sqlite.prepare(sql).all(...values) }; },
      async run() { return sqlite.prepare(sql).run(...values); },
    };
  };
  const d1 = { prepare, batch: async (statements: ReturnType<typeof prepare>[]) => Promise.all(statements.map((s) => s.run())) } as unknown as D1Database;
  return { sqlite, repository: getTarotRepository(d1) };
}

async function storedReading(t: TestContext) {
  const { sqlite, repository } = database(t);
  const catalog = await repository.listCatalog("en");
  const category = catalog.categories.find((c) => c.templates.some((s) => s.cardCount === 3))!;
  const template = category.templates.find((s) => s.cardCount === 3)!;
  const deck = sqlite.prepare("SELECT id FROM decks LIMIT 1").get()!.id as string;
  const cards = (await repository.listCards(deck)).slice(0, 3);
  for (const [id, owner] of [
    ["guest-session", { kind: "guest", guestId: "owner-guest" }],
    ["user-session", { kind: "user", userId: "owner-user" }],
  ] as const) {
    await repository.createReadingSession({ id, owner, question: "Stored question?", optionalContext: "Stored context", categoryId: category.id, spreadTemplateId: template.id, spreadType: template.spreadType, cardCount: 3, locale: "vi", status: "drawn" });
    await repository.createReadingCards(cards.map((card, index) => ({ id: `${id}-${index}`, sessionId: id, cardId: card.id, spreadPositionId: template.positions[index].id, positionKey: template.positions[index].key, positionOrder: index, positionLabel: "Stored label", orientation: index === 1 ? "reversed" : "upright", cardOrder: 2 - index })));
  }
  return { sqlite, repository, category, template, cards };
}

test("repository enforces exact guest/user ownership and scopes cards to the stored session", async (t) => {
  const { repository, cards } = await storedReading(t);
  for (const owner of [{ kind: "guest", guestId: "wrong" }, { kind: "user", userId: "owner-guest" }] as const) {
    assert.equal(await repository.getSessionForOwner("guest-session", owner), null);
  }
  assert.equal(await repository.getSessionForOwner("guest-session' OR 1=1 --", { kind: "guest", guestId: "owner-guest" }), null);
  assert.equal(await repository.getSessionForOwner("user-session", { kind: "guest", guestId: "owner-user" }), null);
  assert.equal(await repository.getSessionForOwner("user-session", { kind: "user", userId: "wrong" }), null);
  assert.ok(await repository.getSessionForOwner("user-session", { kind: "user", userId: "owner-user" }));
  const stored = await repository.getSessionForOwner("guest-session", { kind: "guest", guestId: "owner-guest" });
  assert.ok(stored);
  assert.deepEqual(stored.cards.map((c) => c.cardId), [cards[2].id, cards[1].id, cards[0].id]);
  assert.ok(stored.cards.every((c) => c.sessionId === "guest-session"));
  assert.equal(stored.session.question, "Stored question?");
  assert.equal(stored.session.optionalContext, "Stored context");
});

test("historical template lookup keeps inactive category/template and localizes ordered positions", async (t) => {
  const { sqlite, repository, category, template } = await storedReading(t);
  sqlite.prepare("UPDATE spread_categories SET active = 0, name_en = 'English category', name_vi = 'Danh mục' WHERE id = ?").run(category.id);
  sqlite.prepare("UPDATE spread_templates SET active = 0, name_en = 'English spread', name_vi = 'Trải bài' WHERE id = ?").run(template.id);
  sqlite.prepare("UPDATE spread_positions SET label_en = 'English position', label_vi = 'Vị trí', description_en = 'English meaning', description_vi = 'Ý nghĩa', prompt_en = 'English prompt?', prompt_vi = 'Câu hỏi?' WHERE spread_template_id = ?").run(template.id);
  assert.equal(await repository.getActiveTemplate(category.id, template.id), null);
  assert.equal(await repository.getReadingTemplate("missing", "en"), null);
  for (const locale of ["en", "vi"] as const) {
    const historical = await repository.getReadingTemplate(template.id, locale);
    assert.ok(historical);
    assert.equal(historical.category.name, locale === "en" ? "English category" : "Danh mục");
    assert.equal(historical.template.name, locale === "en" ? "English spread" : "Trải bài");
    assert.deepEqual(historical.positions, template.positions.map((p) => ({ id: p.id, key: p.key, order: p.order, name: locale === "en" ? "English position" : "Vị trí", meaning: locale === "en" ? "English meaning" : "Ý nghĩa", prompt: locale === "en" ? "English prompt?" : "Câu hỏi?" })));
  }
});

test("meaning pairs require the exact card, locale, both orientations, and active deck", async (t) => {
  const { sqlite, repository, cards } = await storedReading(t);
  for (const locale of ["en", "vi"] as const) {
    const pair = await repository.getMeaningPair(cards[0].id, locale);
    assert.ok(pair);
    for (const orientation of ["upright", "reversed"] as const) {
      assert.equal(pair[orientation].cardId, cards[0].id);
      assert.equal(pair[orientation].locale, locale);
      assert.equal(pair[orientation].orientation, orientation);
      assert.deepEqual(pair[orientation], await repository.getMeaning(cards[0].id, locale, orientation));
    }
  }
  assert.equal(await repository.getMeaningPair("missing", "en"), null);
  sqlite.prepare("DELETE FROM card_meanings WHERE card_id = ? AND locale = 'vi' AND orientation = 'reversed'").run(cards[0].id);
  assert.equal(await repository.getMeaningPair(cards[0].id, "vi"), null);
  assert.ok(await repository.getMeaningPair(cards[0].id, "en"));
  sqlite.prepare("UPDATE decks SET active = 0 WHERE id = ?").run(cards[0].deckId);
  assert.equal(await repository.getMeaningPair(cards[0].id, "en"), null);
});

test("meaning pair preserves complete journal evidence without the legacy ten-item truncation", async (t) => {
  const { sqlite, repository, cards } = await storedReading(t);
  const questions = Array.from({ length: 12 }, (_, index) => `Question ${index}?`);
  sqlite.prepare("UPDATE card_meanings SET journal_questions = ? WHERE card_id = ? AND locale = 'en'").run(JSON.stringify(questions), cards[0].id);
  const pair = await repository.getMeaningPair(cards[0].id, "en");
  assert.deepEqual(pair?.upright.journalQuestions, questions);
  assert.deepEqual(pair?.reversed.journalQuestions, questions);
});

test("D1 context orders exact stored cards and persists the validated payload in compatibility columns", async (t) => {
  const { sqlite, repository, template, cards } = await storedReading(t);
  const stored = (await repository.getSessionForOwner("guest-session", { kind: "guest", guestId: "owner-guest" }))!;
  const historical = (await repository.getReadingTemplate(template.id, "en"))!;
  const meanings = new Map(await Promise.all(cards.map(async (card) => [card.id, (await repository.getMeaningPair(card.id, "en"))!] as const)));
  const input = buildTarotReadingInput({ ...stored, template: historical, meanings, locale: "en" });
  assert.deepEqual(input.cards.map((c) => c.readingCardId), ["guest-session-0", "guest-session-1", "guest-session-2"]);
  assert.deepEqual(input.cards.map((c) => c.orientation), ["upright", "reversed", "upright"]);
  assert.equal(input.cards[0].knowledge.upright.summary, meanings.get(cards[0].id)!.upright.summary);
  assert.equal(input.cards[1].position.prompt, template.positions[1].prompt);
  assert.equal(input.locale, "en");
  const output = { overview: "Overview '); DROP TABLE readings; --", cards: input.cards.map((c) => ({ reading_card_id: c.readingCardId, position_key: c.position.key, interpretation: "Interpretation", reflection_prompt: "Reflection?" })).reverse(), connections: "Connections", guidance: "Guidance", closing: "Closing" };
  assert.throws(() => parseReadingPayload({ ...output, cards: [{ ...output.cards[0], reading_card_id: "other-session-card" }, ...output.cards.slice(1)] }, input.cards, "en"), /coverage/i);
  const reading = parseReadingPayload(output, input.cards, "en");
  assert.equal(await repository.saveReading({ id: "saved-reading", sessionId: stored.session.id, reading, modelName: "openai/test-model", promptVersion: TAROT_PROMPT_VERSION }), "saved-reading");
  const saved = sqlite.prepare("SELECT * FROM readings WHERE id = ?").get("saved-reading")!;
  assert.equal(saved.session_id, "guest-session");
  assert.equal(saved.opening, output.overview);
  assert.deepEqual(JSON.parse(saved.card_readings as string), reading.cards);
  assert.equal(saved.synthesis, "Connections");
  assert.equal(saved.advice, "Guidance");
  assert.equal(saved.closing, "Closing");
  assert.equal(saved.disclaimer, "This is a reflective reading, not a certain prediction or professional advice.");
  assert.equal(saved.model_name, "openai/test-model");
  assert.equal(saved.prompt_version, "tarot-reading-v2");
  assert.equal(typeof saved.created_at, "number");
  assert.equal(saved.updated_at, saved.created_at);
});
