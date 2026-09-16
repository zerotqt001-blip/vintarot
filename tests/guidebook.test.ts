import assert from "node:assert/strict";
import test from "node:test";
import { cardBySlug, cardSlug, cards, guidebookGroups, guidebookMapLayout } from "../lib/tarot";

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

test("guidebook map arranges the five groups around a central reading", () => {
  assert.deepEqual(
    guidebookMapLayout.map((item) => item.suit),
    ["Major Arcana", "Wands", "Cups", "Swords", "Pentacles"],
  );
  assert.deepEqual(
    guidebookMapLayout.map((item) => item.position),
    ["top", "left", "right", "bottom-left", "bottom-right"],
  );
  assert.ok(guidebookMapLayout.every((item) => item.accent.startsWith("#")));
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

test("guidebook cards carry Moonlight artwork URLs and short captions", () => {
  assert.equal(
    cards[0].moonlightImage,
    "https://moonlightcdn.imgix.net/decks/rider-waite/00-TheFool.png?w=400&auto=format",
  );
  assert.equal(cards[0].caption, "The Fool (0)");
  assert.equal(
    cards[22].moonlightImage,
    "https://moonlightcdn.imgix.net/decks/rider-waite/Wands01.png?w=400&auto=format",
  );
  assert.equal(cards[22].caption, "Ace of Wands");
  assert.equal(cards[23].caption, "2 of Wands");
  assert.ok(cards.every((card) => card.moonlightImage.includes("moonlightcdn.imgix.net/decks/rider-waite/")));
  assert.ok(cards.every((card) => card.caption.trim()));
});
