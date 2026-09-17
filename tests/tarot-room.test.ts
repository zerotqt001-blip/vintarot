import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { spreadCardPosition } from "../lib/room-motion";
import { consumeDrawPlan, hydrateLegacySpread, roomPositionLabels } from "../lib/tarot-room";

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

test("shuffle completion keeps the prepared dynamic deck order for the fan", () => {
  assert.match(roomSource, /Promise<RoomPlanCard\[\]\|null>/);
  assert.match(roomSource, /const plan=preparing\.current\?await preparing\.current:await prepareReadingPlan\(\)/);
  assert.doesNotMatch(roomSource, /setDeckOrder\(current\.drawPlan\?\.map\(card=>card\.cardNumber\)\|\|shuffleDeck\(\)\)/);
});

test("completed readings expose the reference CTA and interpretation panel", () => {
  assert.match(roomSource, /readingComplete/);
  assert.match(roomSource, /room-reading-actions/);
  assert.match(roomSource, /interpretationOverviewTab/);
  assert.match(roomSource, /interpretationPositionDetails/);
  assert.match(roomSource, /redrawReading/);
});
