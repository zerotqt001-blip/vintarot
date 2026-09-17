import assert from "node:assert/strict";
import test from "node:test";
import { buildLocalReading, parseReadingPayload } from "../lib/tarot-interpretation";

test("local fallback returns one localized card reading per ordered position", () => {
  const result = buildLocalReading({
    locale: "vi",
    question: "Bước tiếp theo của tôi là gì?",
    cards: [{
      readingCardId: "r1",
      positionKey: "next_step",
      positionLabel: "Bước tiếp theo",
      positionPrompt: "Tôi có thể làm gì tiếp theo?",
      orientation: "upright",
      meaning: { summary: "Tóm tắt", actions: "Hành động", journalQuestions: ["Câu hỏi"] },
    }],
  });
  assert.equal(result.source, "local-fallback");
  assert.equal(result.reading.card_readings.length, 1);
  assert.equal(result.reading.card_readings[0].reading_card_id, "r1");
  assert.match(result.reading.disclaimer, /phản chiếu|không phải/i);
});

test("provider-shaped JSON is rejected when it omits a card reading", () => {
  assert.throws(() => parseReadingPayload({
    opening: "x",
    card_readings: [],
    synthesis: "x",
    advice: "x",
    closing: "x",
    disclaimer: "x",
  }, ["r1"]), /card_readings/i);
});

test("provider card readings are reordered to match the session draw order", () => {
  const result = parseReadingPayload({
    opening: "opening",
    card_readings: [
      { reading_card_id: "r2", position_key: "present", interpretation: "second", reflection_prompt: "prompt 2" },
      { reading_card_id: "r1", position_key: "past", interpretation: "first", reflection_prompt: "prompt 1" },
    ],
    synthesis: "synthesis",
    advice: "advice",
    closing: "closing",
    disclaimer: "disclaimer",
  }, ["r1", "r2"]);
  assert.deepEqual(result.card_readings.map((reading) => reading.reading_card_id), ["r1", "r2"]);
});
