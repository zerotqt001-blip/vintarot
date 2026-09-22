import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { messageFor } from "../lib/i18n";
import { shuffleDeck } from "../lib/tarot";
import { spreadCardPosition } from "../lib/room-motion";
import { consumeDrawPlan, hydrateLegacySpread, isRoomRequestCurrent, remainingFanCardNumbers, roomPositionLabels } from "../lib/tarot-room";

const roomSource = readFileSync(new URL("../app/room/room.tsx", import.meta.url), "utf8");
const readingPanelSource = readFileSync(new URL("../components/reading/reading-panel.tsx", import.meta.url), "utf8");

test("legacy spread labels hydrate without changing their order", () => {
  const result = hydrateLegacySpread(["Persona", "Obstacle", "Solution"]);
  assert.equal(result?.templateSlug, "persona-obstacle-solution");
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

test("Room reflection surface exposes normalized personal reading and follow-up boundary", () => {
  assert.match(roomSource, /api\(['"]tarot\/reading/);
  assert.match(roomSource, /api\(['"]tarot\/follow-up/);
  assert.match(roomSource, /api\(['"]tarot\/clarification/);
  assert.match(roomSource, /sessionId/);
  for (const field of ["directAnswer", "personalInsights", "reflectionPrompts", "nextSteps", "cardEvidence"]) {
    assert.match(`${roomSource}\n${readingPanelSource}`, new RegExp(`reading\\.${field}`));
  }
  assert.match(roomSource, /ReadingPanel/);
  assert.doesNotMatch(roomSource, /InterpretationTab|room-interpretation-tabs|interpretationOverviewTab|reading\.overview/);
  assert.match(roomSource, /cardId/);
});

test("Room mounts one editorial reading panel and keeps the question editor separate", () => {
  assert.match(roomSource, /<ReadingPanel[\s\S]*onClose=/);
  assert.match(roomSource, /artworkByReadingCardId/);
  assert.match(roomSource, /saveJournal/);
  assert.match(roomSource, /onFollowUpSubmit/);
  assert.match(roomSource, /onClarificationSubmit/);
  assert.match(roomSource, /clarification\.requestId/);
  assert.match(roomSource, /followUpResetKey=\{readingEpoch\.current\}/);
  assert.match(roomSource, /ReflectionPanel/);
  assert.match(roomSource, /room-reading-panel-retry/);
  assert.match(roomSource, /interpretationRetryAction/);
  assert.doesNotMatch(roomSource, /reading\.cards|reading\.connections|reading\.guidance|reading\.closing|reading\.disclaimer/);
});

test("Room keeps the guidebook closed until the BookOpen control is used", () => {
  assert.match(roomSource, /\[guide,setGuide\]=useState\(false\)/);
  assert.doesNotMatch(roomSource, /setGuide\(true\)/);
  assert.match(roomSource, /\[BookOpen,t\('room\.guidebook'\),\(\)=>setGuide\(!guide\)\]/);
});

test("Room exposes the canonical reading hierarchy in source order", () => {
  const orderedMarkers = [
    "reading.directAnswer",
    "reading.personalInsights",
    "reading.nextSteps",
    "reading.reflectionPrompts",
    "reading.cardEvidence",
  ];
  const offsets = orderedMarkers.map((marker) => readingPanelSource.indexOf(marker));
  assert.ok(offsets.every((offset) => offset >= 0), `missing canonical section: ${JSON.stringify(offsets)}`);
  assert.deepEqual(offsets, [...offsets].sort((left, right) => left - right));
});

test("reading errors have bilingual provider-neutral unavailable and retry labels", () => {
  for (const locale of ["en", "vi"] as const) {
    const unavailable = messageFor(locale, "room.interpretationUnavailable");
    const retry = messageFor(locale, "room.interpretationRetryAction");
    assert.notEqual(unavailable, "room.interpretationUnavailable");
    assert.notEqual(retry, "room.interpretationRetryAction");
    assert.doesNotMatch(`${unavailable} ${retry}`, /OpenAI|Gemini|DeepSeek/i);
  }
  assert.match(roomSource, /interpretationUnavailable/);
  assert.match(roomSource, /interpretationRetryAction/);
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
  assert.match(roomSource, /<ReadingPanel/);
  assert.doesNotMatch(roomSource, /room-interpretation-tabs/);
  assert.match(roomSource, /redrawReading/);
});

test("completed readings expose a transient owner share action without persisting the link", () => {
  assert.match(roomSource, /api\(['"]tarot\/shares['"]/);
  assert.match(roomSource, /reading_id/);
  assert.match(roomSource, /session_id/);
  assert.match(roomSource, /share_url/);
  assert.match(roomSource, /onShare=/);
  assert.match(readingPanelSource, /onShare/);
  assert.match(readingPanelSource, /isSharing/);
  assert.match(readingPanelSource, /shareUrl/);
  assert.match(readingPanelSource, /shareError/);
  assert.doesNotMatch(roomSource, /(?:localStorage|sessionStorage)\.[^\n]*share/i);
  for (const locale of ["en", "vi"] as const) {
    for (const key of ["reading.share", "reading.sharing", "reading.shareReady", "reading.shareUnavailable"]) {
      assert.notEqual(messageFor(locale, key), key);
    }
  }
});

test("stale room requests cannot commit after a newer reading starts", () => {
  assert.equal(isRoomRequestCurrent({ epoch: 3, id: "old-reading" }, { epoch: 4, id: "new-reading" }), false);
  assert.equal(isRoomRequestCurrent({ epoch: 4, id: "old-reading" }, { epoch: 4, id: "new-reading" }), false);
  assert.equal(isRoomRequestCurrent({ epoch: 4, id: "new-reading" }, { epoch: 4, id: "new-reading" }), true);
  assert.match(roomSource, /isRoomRequestCurrent/);
  assert.match(roomSource, /followUpRequest/);
  assert.match(roomSource, /requestSessionId/);
  assert.match(roomSource, /readingEpoch\.current/);
  assert.match(roomSource, /follow_up_question/);
});

test("the local catalog fallback keeps L5 semantics available", () => {
  assert.match(roomSource, /localizedTarotSpreadSemantics/);
  assert.match(roomSource, /semantics/);
});
