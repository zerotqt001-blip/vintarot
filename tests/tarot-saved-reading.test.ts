import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import type { D1Database } from "@cloudflare/workers-types";
import test, { type TestContext } from "node:test";
import { parseReadingPayload } from "../lib/tarot-interpretation";
import { buildTarotReadingInput } from "../lib/tarot-reading-context";
import {
  loadTarotSavedReading,
  listTarotSavedReadings,
  saveTarotReading,
  SavedReadingError,
} from "../lib/tarot-saved-reading";
import { getTarotRepository, type TarotRepository } from "../lib/tarot-repository";

function database(t: TestContext) {
  const sqlite = new DatabaseSync(":memory:");
  t.after(() => sqlite.close());
  for (const file of ["0000_vengeful_ben_urich.sql", "0001_dynamic_tarot.sql", "0002_tarot_seed.sql", "0003_moonlight_spread_catalog.sql", "0004_reading_payload.sql"]) {
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
  const d1 = { prepare, batch: async (statements: ReturnType<typeof prepare>[]) => Promise.all(statements.map((statement) => statement.run())) } as unknown as D1Database;
  return { sqlite, d1, repository: getTarotRepository(d1) };
}

async function fixture(t: TestContext, legacy = false) {
  const { sqlite, d1, repository } = database(t);
  const catalog = await repository.listCatalog("vi");
  const category = catalog.categories.find((item) => item.templates.some((template) => template.cardCount === 3))!;
  const template = category.templates.find((item) => item.cardCount === 3)!;
  const deckId = sqlite.prepare("SELECT id FROM decks ORDER BY id LIMIT 1").get()!.id as string;
  const cards = (await repository.listCards(deckId)).slice(0, 3);
  const sessionId = legacy ? "saved-legacy-session" : "saved-v4-session";
  const readingId = legacy ? "saved-legacy-reading" : "saved-v4-reading";
  await repository.createReadingSession({
    id: sessionId,
    owner: { kind: "user", userId: "owner-1" },
    question: "Điều gì đang muốn được nhìn rõ hơn?",
    optionalContext: "Hãy giữ phần diễn giải thực tế.",
    categoryId: category.id,
    spreadTemplateId: template.id,
    spreadType: template.spreadType,
    cardCount: 3,
    locale: "vi",
    status: "drawn",
  });
  await repository.createReadingCards(cards.map((card, index) => ({
    id: `${sessionId}-card-${index}`,
    sessionId,
    cardId: card.id,
    spreadPositionId: template.positions[index].id,
    positionKey: template.positions[index].key,
    positionOrder: index,
    positionLabel: template.positions[index].label,
    orientation: index === 1 ? "reversed" : "upright",
    cardOrder: index,
  })));

  const stored = (await repository.getSessionForOwner(sessionId, { kind: "user", userId: "owner-1" }))!;
  const storedTemplate = (await repository.getReadingTemplate(template.id, "vi"))!;
  const meanings = new Map(await Promise.all(cards.map(async (card) => [card.id, (await repository.getMeaningPair(card.id, "vi"))!] as const)));
  const input = buildTarotReadingInput({ ...stored, template: storedTemplate, meanings, locale: "vi" });
  const payload = parseReadingPayload({
    direct_answer: "Bạn đang đứng trước một nhu cầu rất cụ thể: nhìn rõ điều gì còn phù hợp với mình.\n\nMột câu trả lời hữu ích sẽ đến từ việc quan sát tín hiệu thực tế và thử một bước nhỏ.",
    personal_insights: [
      { title: "Điều đang nổi lên", body: "Bạn có thể đang cần gọi tên ưu tiên thay vì cố đoán toàn bộ tương lai." },
      { title: "Điểm cần giữ", body: "Nhịp đi chậm và có kiểm chứng giúp bạn phân biệt cảm giác với dữ kiện." },
    ],
    reflection_prompts: ["Dữ kiện nào đang rõ nhất trong tuần này?"],
    next_steps: [
      { title: "Ghi lại tín hiệu", body: "Viết xuống hai điều đang làm bạn có năng lượng và hai điều đang bào mòn bạn." },
      { title: "Thử một bước nhỏ", body: "Chọn một hành động có thể kiểm chứng trong vài ngày tới." },
    ],
    card_evidence: input.cards.map((card) => ({
      reading_card_id: card.readingCardId,
      position_key: card.position.key,
      interpretation: `Ở vị trí ${card.position.name}, lá bài gợi ý một tín hiệu cần được quan sát.`,
    })),
    deeper_reading: null,
    follow_up_suggestions: ["Tôi có thể quan sát điều gì tiếp theo?"],
  }, input.cards, "vi");

  if (legacy) {
    const legacyCards = JSON.stringify(input.cards.map((card) => ({
      reading_card_id: card.readingCardId,
      position_key: card.position.key,
      interpretation: `Diễn giải lịch sử cho ${card.position.name}.`,
      reflection_prompt: `Tôi nhận thấy gì ở vị trí ${card.position.name}?`,
    })));
    sqlite.prepare("INSERT INTO readings (id, session_id, opening, card_readings, synthesis, advice, closing, disclaimer, reading_payload, model_name, prompt_version, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?)")
      .run(readingId, sessionId, "Bạn đang muốn nhìn rõ điều gì còn phù hợp với mình.\n\nHãy bắt đầu từ điều có thể quan sát.", legacyCards, "Điều đang nổi lên: một ưu tiên cần được gọi tên.", "Một bước tiếp theo: thử một hành động nhỏ.", "Một kết luận lịch sử.", payload.disclaimer, "deepseek:legacy-model", "tarot-reading-v3", 10, 10);
  } else {
    await repository.saveReading({ id: readingId, sessionId, reading: payload, modelName: "deepseek:test-model", promptVersion: "tarot-reading-v4.1" });
  }

  return { sqlite, d1, repository, sessionId, readingId, input, payload, template };
}

test("saves an owned reading idempotently and lists it newest first", async (t) => {
  const fixtureData = await fixture(t);
  const owner = { kind: "user" as const, userId: "owner-1" };
  const first = await saveTarotReading({ database: fixtureData.d1, repository: fixtureData.repository, owner, sessionId: fixtureData.sessionId, readingId: fixtureData.readingId });
  const second = await saveTarotReading({ database: fixtureData.d1, repository: fixtureData.repository, owner, sessionId: fixtureData.sessionId, readingId: fixtureData.readingId });

  assert.equal(first.id, `saved-reading:${fixtureData.readingId}`);
  assert.equal(second.id, first.id);
  assert.equal(second.readingId, first.readingId);
  assert.equal(second.sessionId, first.sessionId);
  assert.equal(second.created, first.created);
  assert.ok(second.updated >= first.updated);
  assert.equal((fixtureData.sqlite.prepare("SELECT COUNT(*) AS count FROM records WHERE owner = ? AND kind = ?").get("owner-1", "tarot-reading") as { count: number }).count, 1);

  const items = await listTarotSavedReadings({ database: fixtureData.d1, repository: fixtureData.repository, owner });
  assert.equal(items.length, 1);
  assert.equal(items[0].id, first.id);
  assert.equal(items[0].readingId, fixtureData.readingId);
  assert.equal(items[0].question, "Điều gì đang muốn được nhìn rõ hơn?");
  assert.equal(items[0].cards.length, 3);
  assert.deepEqual(items[0].cards.map((card) => [card.readingCardId, card.positionKey, card.positionOrder, card.orientation]), fixtureData.input.cards.map((card) => [card.readingCardId, card.position.key, card.position.order, card.orientation]));
});

test("rejects guests, other owners, and mismatched session claims before writing", async (t) => {
  const fixtureData = await fixture(t);
  await assert.rejects(
    saveTarotReading({ database: fixtureData.d1, repository: fixtureData.repository, owner: { kind: "guest", guestId: "guest-1" }, sessionId: fixtureData.sessionId, readingId: fixtureData.readingId }),
    (error) => error instanceof SavedReadingError && error.code === "unauthenticated",
  );
  await assert.rejects(
    saveTarotReading({ database: fixtureData.d1, repository: fixtureData.repository, owner: { kind: "user", userId: "owner-2" }, sessionId: fixtureData.sessionId, readingId: fixtureData.readingId }),
    (error) => error instanceof SavedReadingError && error.code === "not_found",
  );
  await assert.rejects(
    saveTarotReading({ database: fixtureData.d1, repository: fixtureData.repository, owner: { kind: "user", userId: "owner-1" }, sessionId: "other-session", readingId: fixtureData.readingId }),
    (error) => error instanceof SavedReadingError && error.code === "not_found",
  );
  assert.equal((fixtureData.sqlite.prepare("SELECT COUNT(*) AS count FROM records").get() as { count: number }).count, 0);
});

test("reopens a v4.1 reading from stored payload without a provider call", async (t) => {
  const fixtureData = await fixture(t);
  const owner = { kind: "user" as const, userId: "owner-1" };
  const saved = await saveTarotReading({ database: fixtureData.d1, repository: fixtureData.repository, owner, sessionId: fixtureData.sessionId, readingId: fixtureData.readingId });
  let providerCalls = 0;
  const detail = await loadTarotSavedReading({ database: fixtureData.d1, repository: fixtureData.repository, owner, savedId: saved.id });
  assert.equal(providerCalls, 0);
  assert.equal(detail.reading.directAnswer, fixtureData.payload.directAnswer);
  assert.equal(detail.reading.cardEvidence.length, 3);
  assert.deepEqual(detail.reading.cardEvidence.map((card) => [card.readingCardId, card.position.id, card.position.key, card.position.order, card.orientation]), fixtureData.input.cards.map((card) => [card.readingCardId, card.position.id, card.position.key, card.position.order, card.orientation]));
  assert.deepEqual(detail.cards.map((card) => [card.readingCardId, card.cardId, card.positionKey, card.positionOrder, card.orientation]), fixtureData.input.cards.map((card) => [card.readingCardId, card.card.id, card.position.key, card.position.order, card.orientation]));
  assert.equal(detail.metadata.modelName, "deepseek:test-model");
  assert.equal(detail.metadata.promptVersion, "tarot-reading-v4.1");
});

test("reopens a legacy v2/v3 reading through the same compatibility parser", async (t) => {
  const fixtureData = await fixture(t, true);
  const owner = { kind: "user" as const, userId: "owner-1" };
  const saved = await saveTarotReading({ database: fixtureData.d1, repository: fixtureData.repository, owner, sessionId: fixtureData.sessionId, readingId: fixtureData.readingId });
  const detail = await loadTarotSavedReading({ database: fixtureData.d1, repository: fixtureData.repository, owner, savedId: saved.id });
  assert.equal(detail.metadata.promptVersion, "tarot-reading-v3");
  assert.equal(detail.reading.cardEvidence.length, 3);
  assert.deepEqual(detail.reading.cardEvidence.map((card) => card.readingCardId), fixtureData.input.cards.map((card) => card.readingCardId));
  assert.equal((fixtureData.sqlite.prepare("SELECT reading_payload FROM readings WHERE id = ?").get(fixtureData.readingId) as { reading_payload: string | null }).reading_payload, null);
});

test("saved-reading implementation has no provider or regeneration dependency", async () => {
  const source = readFileSync(new URL("../lib/tarot-saved-reading.ts", import.meta.url), "utf8");
  assert.doesNotMatch(source, /createTarotAIProvider|generateTarotReading|DeepSeek/i);
});
