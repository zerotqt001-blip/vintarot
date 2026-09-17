import assert from "node:assert/strict";
import test from "node:test";
import { buildTarotSeed, validateTarotSeed } from "../db/tarot-seed";

test("canonical seed contains 78 stable cards and four meanings per card", () => {
  const seed = buildTarotSeed();
  validateTarotSeed(seed);
  assert.equal(seed.cards.length, 78);
  assert.equal(new Set(seed.cards.map((card) => card.id)).size, 78);
  assert.equal(new Set(seed.cards.map((card) => card.cardNumber)).size, 78);
  assert.equal(seed.meanings.length, 78 * 2 * 2);
  assert.equal(new Set(seed.meanings.map((meaning) => `${meaning.cardId}:${meaning.locale}:${meaning.orientation}`)).size, 312);
  assert.ok(seed.cards.every((card) => card.imageUrl.startsWith("/cards/")));
});

test("spread seed preserves every Moonlight topic and position counts", () => {
  const seed = buildTarotSeed();
  assert.deepEqual(seed.categories.map((category) => category.slug), [
    "blank", "everyday", "self-care", "relationships", "planning", "moon-phase", "creativity", "business", "fools-journey",
  ]);
  assert.equal(seed.templates.length, 57);
  for (const template of seed.templates) {
    assert.equal(seed.positions.filter((position) => position.templateId === template.id).length, template.cardCount);
  }
});
