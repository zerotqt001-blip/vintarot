import assert from "node:assert/strict";
import test from "node:test";
import { makeDrawPlan, makeSelectedDrawPlan, parseDrawRequest } from "../lib/tarot-draw";

const cards = Array.from({ length: 10 }, (_, cardNumber) => ({
  id: `card-${cardNumber}`,
  cardNumber,
}));
const positions = Array.from({ length: 3 }, (_, order) => ({
  id: `position-${order}`,
  key: `position_${order}`,
  order,
  label: `Position ${order}`,
}));

test("draw plan has the exact dynamic count, unique cards, ordered positions, and orientation", () => {
  const plan = makeDrawPlan({ cards, positions, reversals: true, random: () => 0.2 });
  assert.equal(plan.length, 3);
  assert.equal(new Set(plan.map((card) => card.cardId)).size, 3);
  assert.deepEqual(plan.map((card) => card.positionOrder), [0, 1, 2]);
  assert.ok(plan.every((card) => card.orientation === "upright" || card.orientation === "reversed"));
});

test("selected draw plan preserves the cards and order chosen by the customer", () => {
  const plan = makeSelectedDrawPlan({
    cards,
    positions,
    reversals: true,
    selections: [
      { cardNumber: 7, orientation: "reversed" },
      { cardNumber: 2, orientation: "upright" },
      { cardNumber: 9, orientation: "reversed" },
    ],
  });
  assert.deepEqual(plan.map((card) => card.cardNumber), [7, 2, 9]);
  assert.deepEqual(plan.map((card) => card.positionOrder), [0, 1, 2]);
  assert.deepEqual(plan.map((card) => card.orientation), ["reversed", "upright", "reversed"]);
});

test("selected draw plan rejects duplicate or unknown customer selections", () => {
  assert.throws(() => makeSelectedDrawPlan({
    cards,
    positions,
    reversals: true,
    selections: [
      { cardNumber: 7, orientation: "upright" },
      { cardNumber: 7, orientation: "upright" },
      { cardNumber: 9, orientation: "upright" },
    ],
  }), /unique/i);
  assert.throws(() => makeSelectedDrawPlan({
    cards,
    positions,
    reversals: true,
    selections: [
      { cardNumber: 7, orientation: "upright" },
      { cardNumber: 2, orientation: "upright" },
      { cardNumber: 77, orientation: "upright" },
    ],
  }), /not found/i);
});

test("disabled reversals force upright cards", () => {
  const plan = makeDrawPlan({ cards, positions, reversals: false, random: () => 0.99 });
  assert.ok(plan.every((card) => card.orientation === "upright"));
});

test("draw plan rejects an undersized deck", () => {
  assert.throws(() => makeDrawPlan({ cards: cards.slice(0, 2), positions, reversals: false, random: () => 0 }), /enough cards/i);
});

test("draw request parser trims bounded text and defaults optional fields", () => {
  assert.deepEqual(parseDrawRequest({
    question: "  What next?  ",
    category_id: "category-planning",
    spread_template_id: "spread-planning-one-small-step",
    deck_id: "deck-rider-waite-smith",
    locale: "en",
  }), {
    question: "What next?",
    optional_context: "",
    category_id: "category-planning",
    spread_template_id: "spread-planning-one-small-step",
    deck_id: "deck-rider-waite-smith",
    locale: "en",
    reversals: true,
  });
});

test("draw request parser rejects an empty question", () => {
  assert.throws(() => parseDrawRequest({ question: "  ", category_id: "cat", spread_template_id: "spread", deck_id: "deck", locale: "en" }), /question/i);
});
