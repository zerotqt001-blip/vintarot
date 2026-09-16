import assert from "node:assert/strict";
import test from "node:test";
import { cardNarrative } from "../lib/tarot-narrative";
import { cards } from "../lib/tarot";

const sectionKeys = [
  "energy",
  "actions",
  "strengthsChallenges",
  "relationships",
  "work",
  "creativity",
  "home",
  "symbolism",
  "journalQuestions",
  "memes",
] as const;

test("every card has a complete English and Vietnamese guidebook narrative", () => {
  for (const card of cards) {
    for (const locale of ["en", "vi"] as const) {
      const narrative = cardNarrative(card, locale);
      assert.ok(narrative.summary.trim(), `${card.name} ${locale} summary`);
      assert.deepEqual(
        narrative.sections.map((section) => section.key),
        sectionKeys,
        `${card.name} ${locale} section order`,
      );
      for (const section of narrative.sections) {
        assert.ok(section.title.trim(), `${card.name} ${locale} ${section.key} title`);
        assert.ok(section.body.trim(), `${card.name} ${locale} ${section.key} body`);
      }
    }
  }
});

test("The Fool has a localized long form guidebook entry", () => {
  const fool = cards[0];
  const english = cardNarrative(fool, "en");
  const vietnamese = cardNarrative(fool, "vi");
  assert.match(english.summary, /new|begin/i);
  assert.match(english.sections[0].body, /Fool|begin|energy/i);
  assert.equal(vietnamese.sections[0].title, "Năng lượng");
  assert.match(vietnamese.summary, /khởi đầu|mới/i);
  assert.doesNotMatch(vietnamese.summary, /The chaotic/i);
});
