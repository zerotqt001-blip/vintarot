import assert from "node:assert/strict";
import test from "node:test";
import { tarotReadingQualityFixture } from "./fixtures/tarot-reading-quality";
import { parseReadingPayload } from "../lib/tarot-interpretation";

const providerOutput = {
  overview: "overview",
  cards: tarotReadingQualityFixture.cards.map((card, index) => ({ reading_card_id: card.readingCardId, position_key: card.position.key, interpretation: `interpretation ${index}`, reflection_prompt: `reflection ${index}` })),
  connections: "connections",
  guidance: "guidance",
  closing: "closing",
};

test("provider output is normalized in ordered session-card order", () => {
  const result = parseReadingPayload({ ...providerOutput, cards: [...providerOutput.cards].reverse() }, tarotReadingQualityFixture.cards, "en");
  assert.deepEqual(result.cards.map((card) => card.reading_card_id), tarotReadingQualityFixture.cards.map((card) => card.readingCardId));
  assert.deepEqual(result.cards[0].position, tarotReadingQualityFixture.cards[0].position);
  assert.deepEqual(result.cards[0].card, tarotReadingQualityFixture.cards[0].card);
  assert.equal(result.cards[0].orientation, tarotReadingQualityFixture.cards[0].orientation);
  assert.match(result.disclaimer, /reflective reading/i);
});

test("strict parsing rejects omitted card output", () => {
  assert.throws(() => parseReadingPayload({ ...providerOutput, cards: [] }, tarotReadingQualityFixture.cards, "en"), /provider output|cards/i);
});

test("strict parsing rejects arbitrary provider metadata", () => {
  assert.throws(() => parseReadingPayload({ ...providerOutput, unexpected: "not trusted" }, tarotReadingQualityFixture.cards, "en"), /provider output|unexpected/i);
});
