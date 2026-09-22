import assert from "node:assert/strict";
import test from "node:test";
import type { TarotReadingPayload } from "../lib/ai/types";
import { selectContextualFollowUpSuggestions } from "../lib/tarot-follow-up-suggestions";

const reading: TarotReadingPayload = {
  directAnswer: "Start with what is observable.\n\nLet the next step stay small.",
  personalInsights: [{ title: "A pattern", body: "You are waiting for certainty before choosing." }],
  reflectionPrompts: [],
  nextSteps: [{ title: "Name one boundary", body: "Choose the smallest boundary you can keep." }],
  cardEvidence: [{
    readingCardId: "reading-card-1",
    position: { id: "position-1", key: "present", order: 0, name: "Present", meaning: "What is present.", prompt: "What is present?" },
    card: { id: "major-fool", nameEn: "The Fool", nameVi: "Kẻ Khờ", arcana: "major", suit: null, keywords: ["beginning"] },
    orientation: "upright",
    interpretation: "Notice the current pattern.",
  }],
  deeperReading: null,
  followUpSuggestions: ["What should I notice first?", "Draw another card to clarify?", "What should I notice first?"],
  disclaimer: "This is reflective guidance.",
};

test("keeps specific question suggestions and fills contextual English questions deterministically", () => {
  const first = selectContextualFollowUpSuggestions(reading, "What should I notice?", "en");
  const second = selectContextualFollowUpSuggestions(reading, "What should I notice?", "en");

  assert.deepEqual(first, second);
  assert.equal(first.length, 3);
  assert.equal(first[0], "What should I notice first?");
  assert.match(first[1], /A pattern/);
  assert.match(first[1], /could|might/);
  assert.match(first[2], /Name one boundary/);
  assert.doesNotMatch(first.join(" "), /draw another|draw again|another card/i);
});

test("localizes generated questions, preserves agency, and caps the list", () => {
  const localized = selectContextualFollowUpSuggestions({
    ...reading,
    followUpSuggestions: [
      "Rút thêm một lá để chắc hơn?",
      "Bạn có thể quan sát điều gì trước?",
      "Hãy rút thêm lá khác?",
      "Bạn có thể quan sát điều gì trước?",
      "Nói thêm đi.",
    ],
  }, "Mình nên bắt đầu từ đâu?", "vi");

  assert.equal(localized.length, 3);
  assert.equal(localized[0], "Bạn có thể quan sát điều gì trước?");
  assert.match(localized[1], /có thể|điều gì/iu);
  assert.match(localized[2], /có thể|như thế nào/iu);
  assert.doesNotMatch(localized.join(" "), /rút thêm|rút lại|lá khác|trải lại/iu);
  assert.equal(new Set(localized.map((item) => item.toLocaleLowerCase())).size, localized.length);
});

test("falls back to the original question only when no contextual field can form a suggestion", () => {
  const minimal: TarotReadingPayload = {
    ...reading,
    personalInsights: [],
    nextSteps: [],
    cardEvidence: [],
    followUpSuggestions: [],
  };

  assert.deepEqual(selectContextualFollowUpSuggestions(minimal, "What would help me stay grounded?", "en"), [
    "What would help me stay grounded?",
  ]);
});
