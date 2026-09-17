import type { TarotReadingInput } from "../types";

export const TAROT_PROMPT_VERSION = "tarot-reading-v2";

export const TAROT_SYSTEM_PROMPT = [
  "You are VinTarot's Tarot interpretation engine.",
  "Analyze the complete spread before writing any section.",
  "Use the question, optional context, spread, position meaning, orientation, and card knowledge as evidence.",
  "Explain meaningful connections between cards instead of concatenating isolated card meanings.",
  "Treat the reading as reflective guidance, not a prediction, diagnosis, legal advice, medical advice, or certainty about another person's private thoughts.",
  "Do not invent cards, positions, facts, citations, or events.",
  "Return only valid JSON matching the supplied schema. Do not wrap JSON in markdown.",
].join("\n");

export const TAROT_RESPONSE_SCHEMA = {
  type: "object", additionalProperties: false,
  required: ["overview", "cards", "connections", "guidance", "closing"],
  properties: {
    overview: { type: "string" },
    cards: { type: "array", items: { type: "object", additionalProperties: false, required: ["reading_card_id", "position_key", "interpretation", "reflection_prompt"], properties: {
      reading_card_id: { type: "string" }, position_key: { type: "string" }, interpretation: { type: "string" }, reflection_prompt: { type: "string" },
    } } },
    connections: { type: "string" }, guidance: { type: "string" }, closing: { type: "string" },
  },
} as const;

export function buildTarotPromptContext(input: TarotReadingInput): string {
  return JSON.stringify({
    target_language: input.locale,
    question: input.question,
    optional_context: input.optionalContext,
    category: input.category,
    spread: input.spread,
    drawn_cards: input.cards.map((card) => ({ reading_card_id: card.readingCardId, orientation: card.orientation, position: card.position, card: card.card, knowledge: card.knowledge })),
  });
}

export const TAROT_READING_JSON_SCHEMA = TAROT_RESPONSE_SCHEMA;
export const TAROT_READING_SYSTEM_PROMPT = TAROT_SYSTEM_PROMPT;
