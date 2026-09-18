import assert from "node:assert/strict";
import test from "node:test";
import { tarotReadingProviderOutputFixture, tarotReadingQualityFixture } from "./fixtures/tarot-reading-quality";
import { parseReadingPayload } from "../lib/tarot-interpretation";

const providerOutput = tarotReadingProviderOutputFixture;

test("provider output is normalized in ordered session-card order", () => {
  const result = parseReadingPayload({ ...providerOutput, card_evidence: [...providerOutput.card_evidence].reverse() }, tarotReadingQualityFixture.cards, "en");
  assert.equal(result.directAnswer, "First paragraph.\n\nSecond paragraph.");
  assert.deepEqual(result.personalInsights, [{ title: "A pattern", body: "A useful pattern." }]);
  assert.deepEqual(result.reflectionPrompts, ["What would you like to notice?"]);
  assert.deepEqual(result.nextSteps, [{ title: "A next step", body: "Try one grounded action." }]);
  assert.deepEqual(result.cardEvidence.map((card) => card.readingCardId), tarotReadingQualityFixture.cards.map((card) => card.readingCardId));
  assert.equal(result.cardEvidence[0].card.id, tarotReadingQualityFixture.cards[0].card.id);
  assert.equal(result.cardEvidence[0].position.key, tarotReadingQualityFixture.cards[0].position.key);
  assert.equal(result.cardEvidence[0].orientation, tarotReadingQualityFixture.cards[0].orientation);
  assert.equal(result.cardEvidence[0].interpretation, "Interpretation 1.");
  assert.equal(result.deeperReading, null);
  assert.deepEqual(result.followUpSuggestions, ["Explore the pattern.", "Notice the next step."]);
  assert.match(result.disclaimer, /reflective reading/i);
});

test("strict parsing rejects the old overview key", () => {
  assert.throws(() => parseReadingPayload({ ...providerOutput, overview: "old contract" }, tarotReadingQualityFixture.cards, "en"), /provider output|overview/i);
});

test("strict parsing rejects omitted evidence", () => {
  assert.throws(() => parseReadingPayload({ ...providerOutput, card_evidence: providerOutput.card_evidence.slice(0, 2) }, tarotReadingQualityFixture.cards, "en"), /coverage|evidence|provider output/i);
});

test("strict parsing rejects duplicate evidence IDs", () => {
  const duplicateEvidence = [...providerOutput.card_evidence];
  duplicateEvidence[1] = { ...duplicateEvidence[0], position_key: tarotReadingQualityFixture.cards[1].position.key };
  assert.throws(() => parseReadingPayload({ ...providerOutput, card_evidence: duplicateEvidence }, tarotReadingQualityFixture.cards, "en"), /coverage|evidence/i);
});

test("strict parsing rejects mismatched evidence positions", () => {
  const mismatchedEvidence = [...providerOutput.card_evidence];
  mismatchedEvidence[0] = { ...mismatchedEvidence[0], position_key: tarotReadingQualityFixture.cards[1].position.key };
  assert.throws(() => parseReadingPayload({ ...providerOutput, card_evidence: mismatchedEvidence }, tarotReadingQualityFixture.cards, "en"), /position|coverage/i);
});

test("strict parsing enforces bounded V3 list sizes", () => {
  assert.throws(() => parseReadingPayload({ ...providerOutput, personal_insights: Array.from({ length: 7 }, (_, index) => ({ title: `Insight ${index}`, body: "Body" })) }, tarotReadingQualityFixture.cards, "en"), /personal_insights/i);
  assert.throws(() => parseReadingPayload({ ...providerOutput, reflection_prompts: ["one", "two", "three", "four", "five"] }, tarotReadingQualityFixture.cards, "en"), /reflection_prompts/i);
  assert.throws(() => parseReadingPayload({ ...providerOutput, next_steps: Array.from({ length: 5 }, (_, index) => ({ title: `Step ${index}`, body: "Body" })) }, tarotReadingQualityFixture.cards, "en"), /next_steps/i);
  assert.throws(() => parseReadingPayload({ ...providerOutput, follow_up_suggestions: ["one", "two", "three", "four", "five"] }, tarotReadingQualityFixture.cards, "en"), /follow_up_suggestions/i);
});

test("strict parsing requires two to four direct-answer paragraphs", () => {
  assert.throws(() => parseReadingPayload({ ...providerOutput, direct_answer: "One paragraph." }, tarotReadingQualityFixture.cards, "en"), /direct_answer/i);
});

test("strict parsing keeps the direct answer personal rather than card- or spread-led", () => {
  for (const directAnswer of [
    "Ten of Cups points to a turning point.\n\nNotice what feels actionable.",
    "The cards show a turning point.\n\nNotice what feels actionable.",
    "This three-card spread shows a turning point.\n\nNotice what feels actionable.",
    "Các lá bài cho thấy một bước ngoặt.\n\nHãy quan sát điều có thể hành động.",
  ]) {
    assert.throws(() => parseReadingPayload({ ...providerOutput, direct_answer: directAnswer }, tarotReadingQualityFixture.cards, "en"), /direct_answer/i);
  }
});

test("strict parsing enforces direct-answer, title, body, and interpretation limits", () => {
  const directAnswerAtLimit = `${"a".repeat(2999)}\n\n${"b".repeat(2999)}`;
  assert.equal(directAnswerAtLimit.length, 6000);
  assert.doesNotThrow(() => parseReadingPayload({ ...providerOutput, direct_answer: directAnswerAtLimit }, tarotReadingQualityFixture.cards, "en"));
  assert.throws(() => parseReadingPayload({ ...providerOutput, direct_answer: `${"a".repeat(3000)}\n\n${"b".repeat(2999)}` }, tarotReadingQualityFixture.cards, "en"), /direct_answer/i);

  const insightAtLimits = { title: "t".repeat(240), body: "b".repeat(1200) };
  assert.doesNotThrow(() => parseReadingPayload({ ...providerOutput, personal_insights: [insightAtLimits] }, tarotReadingQualityFixture.cards, "en"));
  assert.throws(() => parseReadingPayload({ ...providerOutput, personal_insights: [{ title: "t".repeat(241), body: "b" }] }, tarotReadingQualityFixture.cards, "en"), /personal_insights/i);
  assert.throws(() => parseReadingPayload({ ...providerOutput, personal_insights: [{ title: "t", body: "b".repeat(1201) }] }, tarotReadingQualityFixture.cards, "en"), /personal_insights/i);
  assert.throws(() => parseReadingPayload({ ...providerOutput, reflection_prompts: ["p".repeat(1001)] }, tarotReadingQualityFixture.cards, "en"), /reflection_prompts/i);
  assert.throws(() => parseReadingPayload({ ...providerOutput, follow_up_suggestions: ["s".repeat(501)] }, tarotReadingQualityFixture.cards, "en"), /follow_up_suggestions/i);
  assert.throws(() => parseReadingPayload({ ...providerOutput, deeper_reading: "d".repeat(6001) }, tarotReadingQualityFixture.cards, "en"), /deeper_reading/i);

  const evidenceAtLimit = { ...providerOutput.card_evidence[0], interpretation: "i".repeat(4000) };
  assert.doesNotThrow(() => parseReadingPayload({ ...providerOutput, card_evidence: [evidenceAtLimit, ...providerOutput.card_evidence.slice(1)] }, tarotReadingQualityFixture.cards, "en"));
  assert.throws(() => parseReadingPayload({ ...providerOutput, card_evidence: [{ ...providerOutput.card_evidence[0], interpretation: "i".repeat(4001) }, ...providerOutput.card_evidence.slice(1)] }, tarotReadingQualityFixture.cards, "en"), /card_evidence/i);
});

test("strict parsing rejects arbitrary provider metadata", () => {
  assert.throws(() => parseReadingPayload({ ...providerOutput, provider_metadata: { model: "untrusted" } }, tarotReadingQualityFixture.cards, "en"), /provider output|provider_metadata/i);
});
