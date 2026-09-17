import assert from "node:assert/strict";
import test from "node:test";
import { tarotReadingQualityAssertions, tarotReadingQualityFixture } from "./fixtures/tarot-reading-quality";
import { buildTarotPromptContext, TAROT_PROMPT_VERSION, TAROT_RESPONSE_SCHEMA, TAROT_SYSTEM_PROMPT } from "../lib/ai/prompts/tarot-reading";
import { parseReadingPayload } from "../lib/tarot-interpretation";

function providerOutput(ids = tarotReadingQualityAssertions.cardIds) {
  return {
    overview: "overview",
    cards: ids.map((reading_card_id, index) => ({
      reading_card_id,
      position_key: tarotReadingQualityAssertions.positionKeys[index] ?? "unknown",
      interpretation: `interpretation ${index}`,
      reflection_prompt: `reflection ${index}`,
    })),
    connections: "connections",
    guidance: "guidance",
    closing: "closing",
  };
}

test("normalizes the provider-neutral output with trusted card metadata", () => {
  const result = parseReadingPayload(providerOutput(), tarotReadingQualityFixture.cards, "vi");
  assert.deepEqual(Object.keys(result), ["overview", "cards", "connections", "guidance", "closing", "disclaimer"]);
  assert.deepEqual(result.cards.map((card) => card.reading_card_id), tarotReadingQualityAssertions.cardIds);
  assert.deepEqual(result.cards[0].position, tarotReadingQualityFixture.cards[0].position);
  assert.deepEqual(result.cards[0].card, tarotReadingQualityFixture.cards[0].card);
  assert.equal(result.cards[0].orientation, "reversed");
  assert.match(result.disclaimer, /phản chiếu|không phải/i);
});

test("rejects missing, duplicate, unknown, extra, or mismatched cards", () => {
  for (const ids of [
    tarotReadingQualityAssertions.cardIds.slice(0, 2),
    [tarotReadingQualityAssertions.cardIds[0], tarotReadingQualityAssertions.cardIds[0], tarotReadingQualityAssertions.cardIds[2]],
    [tarotReadingQualityAssertions.cardIds[0], "unknown-card", tarotReadingQualityAssertions.cardIds[2]],
    [...tarotReadingQualityAssertions.cardIds, "extra-card"],
  ]) {
    assert.throws(() => parseReadingPayload(providerOutput(ids), tarotReadingQualityFixture.cards, "en"), /coverage|position/i);
  }
  const wrongPosition = providerOutput();
  wrongPosition.cards[0].position_key = "obstacle";
  assert.throws(() => parseReadingPayload(wrongPosition, tarotReadingQualityFixture.cards, "en"), /position|coverage/i);
});

test("serializes only the complete drawn-card context", () => {
  const context = buildTarotPromptContext(tarotReadingQualityFixture);
  const parsed = JSON.parse(context) as Record<string, unknown>;
  assert.equal(parsed.target_language, "vi");
  assert.equal(parsed.question, tarotReadingQualityFixture.question);
  assert.equal(parsed.optional_context, tarotReadingQualityFixture.optionalContext);
  assert.deepEqual(parsed.spread, tarotReadingQualityFixture.spread);
  assert.equal((parsed.drawn_cards as unknown[]).length, 3);
  assert.deepEqual((parsed.drawn_cards as Array<Record<string, unknown>>)[0], {
    reading_card_id: tarotReadingQualityFixture.cards[0].readingCardId,
    orientation: tarotReadingQualityFixture.cards[0].orientation,
    position: tarotReadingQualityFixture.cards[0].position,
    card: tarotReadingQualityFixture.cards[0].card,
    knowledge: tarotReadingQualityFixture.cards[0].knowledge,
  });
  assert.doesNotMatch(context, /78|The Fool|extra-card/);
  assert.match(context, /upright/);
  assert.match(context, /reversed/);
});

test("publishes the versioned strict prompt contract", () => {
  assert.equal(TAROT_PROMPT_VERSION, "tarot-reading-v2");
  for (const line of [
    "You are VinTarot's Tarot interpretation engine.",
    "Analyze the complete spread before writing any section.",
    "Use the question, optional context, spread, position meaning, orientation, and card knowledge as evidence.",
    "Explain meaningful connections between cards instead of concatenating isolated card meanings.",
    "Treat the reading as reflective guidance, not a prediction, diagnosis, legal advice, medical advice, or certainty about another person's private thoughts.",
    "Do not invent cards, positions, facts, citations, or events.",
    "Return only valid JSON matching the supplied schema. Do not wrap JSON in markdown.",
  ]) assert.match(TAROT_SYSTEM_PROMPT, new RegExp(line.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.equal(TAROT_RESPONSE_SCHEMA.additionalProperties, false);
  assert.deepEqual(TAROT_RESPONSE_SCHEMA.required, ["overview", "cards", "connections", "guidance", "closing"]);
  const cardsSchema = TAROT_RESPONSE_SCHEMA.properties.cards as Record<string, unknown>;
  assert.equal((cardsSchema.items as Record<string, unknown>).additionalProperties, false);
});
