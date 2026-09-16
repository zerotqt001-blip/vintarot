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
      assert.equal(
        narrative.sections.some((section) => section.key === "memes"),
        false,
        `${card.name} ${locale} has no Meme section`,
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

test("reversed readings have their own long-form guidance", () => {
  for (const card of cards) {
    const upright = cardNarrative(card, "en", "upright");
    const reversed = cardNarrative(card, "en", "reversed");
    assert.notEqual(reversed.summary, upright.summary, `${card.name} summary`);
    assert.notEqual(reversed.sections[0].body, upright.sections[0].body, `${card.name} energy`);
    assert.notEqual(reversed.sections[1].body, upright.sections[1].body, `${card.name} actions`);
  }
});

test("The Fool reversed narrative is localized", () => {
  const reversedEnglish = cardNarrative(cards[0], "en", "reversed");
  const reversedVietnamese = cardNarrative(cards[0], "vi", "reversed");
  assert.match(reversedEnglish.summary, /pause|slow|recalibrat/i);
  assert.match(reversedEnglish.sections[0].body, /reversed|hesitat|motion/i);
  assert.equal(reversedVietnamese.sections[0].title, "Năng lượng");
  assert.match(reversedVietnamese.summary, /khoảng dừng|chậm|điều chỉnh/i);
  assert.doesNotMatch(reversedVietnamese.summary, /The Fool|The chaotic/i);
});
