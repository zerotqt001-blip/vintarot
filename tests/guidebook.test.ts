import assert from "node:assert/strict";
import test from "node:test";
import { cardBySlug, cardSlug, cards, guidebookGroups } from "../lib/tarot";

test("guidebook exposes the five tarot groups in reference order", () => {
  assert.deepEqual(
    guidebookGroups.map((group) => group.suit),
    ["Major Arcana", "Wands", "Cups", "Swords", "Pentacles"],
  );
  assert.deepEqual(
    guidebookGroups.map((group) => group.cardIds.length),
    [22, 14, 14, 14, 14],
  );
});

test("card slugs round-trip every guidebook card", () => {
  for (const card of cards) {
    assert.equal(cardBySlug(cardSlug(card))?.id, card.id);
  }
  assert.equal(cardSlug(cards[0]), "the-fool");
  assert.equal(cardBySlug("ace-of-wands")?.name, "Ace of Wands");
  assert.equal(cardBySlug("not-a-card"), undefined);
});

test("every card has distinct upright and reversed meaning copy", () => {
  for (const card of cards) {
    assert.ok(card.upright.trim());
    assert.ok(card.reversed.trim());
    assert.notEqual(card.upright, card.reversed);
  }
});
