import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { shuffleDeck } from "../lib/tarot";
import { spreadCardPosition } from "../lib/room-motion";
import { consumeDrawPlan, hydrateLegacySpread, isRoomRequestCurrent, remainingFanCardNumbers, roomPositionLabels } from "../lib/tarot-room";

const roomSource = readFileSync(new URL("../app/room/room.tsx", import.meta.url), "utf8");

test("legacy spread labels hydrate without changing their order", () => {
  const result = hydrateLegacySpread(["Persona", "Obstacle", "Solution"]);
  assert.equal(result?.templateSlug, "three-card-insight");
  assert.deepEqual(roomPositionLabels(result!), ["Persona", "Obstacle", "Solution"]);
});

test("consuming any fan card uses its server position order and prevents duplicates", () => {
  const plan = [
    { readingCardId: "r1", cardId: "card-a", cardNumber: 4, positionId: "p0", positionKey: "past", positionOrder: 0, positionLabel: "Past", orientation: "upright" as const },
    { readingCardId: "r2", cardId: "card-b", cardNumber: 9, positionId: "p1", positionKey: "present", positionOrder: 1, positionLabel: "Present", orientation: "reversed" as const },
  ];
  const first = consumeDrawPlan(plan, [], 9, 2);
  assert.equal(first?.card.cardNumber, 9);
  assert.deepEqual(first?.position, spreadCardPosition(1, 2));
  assert.equal(consumeDrawPlan(plan, [first!.card], 9, 2), null);
});

test("Room reflection surface exposes interpretation and dynamic session data", () => {
  assert.match(roomSource, /api\(['"]tarot\/interpret/);
  assert.match(roomSource, /sessionId/);
  assert.match(roomSource, /local-fallback|reading\.disclaimer/);
  assert.match(roomSource, /cardId/);
});

test("fan keeps all 78 cards until the customer selects a card", () => {
  const deck = Array.from({ length: 78 }, (_, id) => id);
  assert.equal(remainingFanCardNumbers(deck, []).length, 78);
  assert.equal(remainingFanCardNumbers(deck, [{ id: 17, cardNumber: 17 }]).length, 77);
  assert.equal(remainingFanCardNumbers(deck, [{ id: 17, cardNumber: 17 }, { id: 42, cardNumber: 42 }]).length, 76);
});

test("every shuffle creates a complete unique 78-card order", () => {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const deck = shuffleDeck();
    assert.equal(deck.length, 78);
    assert.equal(new Set(deck).size, 78);
    assert.deepEqual([...deck].sort((left, right) => left - right), Array.from({ length: 78 }, (_, id) => id));
  }
});

test("room shuffles a full fan and submits only the customer's selected cards", () => {
  assert.match(roomSource, /setDeckOrder\(shuffleDeck\(\)\)/);
  assert.match(roomSource, /selected_cards/);
  assert.match(roomSource, /nextCards\.length===current\.spread\.length/);
  assert.doesNotMatch(roomSource, /void prepareReadingPlan\(\)/);
  assert.doesNotMatch(roomSource, /setDeckOrder\(plan\.map\(card=>card\.cardNumber\)\)/);
});

test("completed readings expose the reference CTA and interpretation panel", () => {
  assert.match(roomSource, /readingComplete/);
  assert.match(roomSource, /room-reading-actions/);
  assert.match(roomSource, /interpretationOverviewTab/);
  assert.match(roomSource, /interpretationPositionDetails/);
  assert.match(roomSource, /redrawReading/);
});

test("stale room requests cannot commit after a newer reading starts", () => {
  assert.equal(isRoomRequestCurrent({ epoch: 3, id: "old-reading" }, { epoch: 4, id: "new-reading" }), false);
  assert.equal(isRoomRequestCurrent({ epoch: 4, id: "old-reading" }, { epoch: 4, id: "new-reading" }), false);
  assert.equal(isRoomRequestCurrent({ epoch: 4, id: "new-reading" }, { epoch: 4, id: "new-reading" }), true);
  assert.match(roomSource, /isRoomRequestCurrent/);
});
