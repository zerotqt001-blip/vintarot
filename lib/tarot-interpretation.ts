import { z } from "zod";
import type { TarotLocale, TarotOrientation, TarotProviderCard, TarotReadingCardContext, TarotReadingPayload } from "./ai/types";

export { TAROT_PROMPT_VERSION as PROMPT_VERSION } from "./ai/prompts/tarot-reading";
export type { TarotReadingPayload } from "./ai/types";

const providerCardSchema = z.object({
  reading_card_id: z.string().min(1).max(100), position_key: z.string().min(1).max(100),
  interpretation: z.string().min(1).max(4000), reflection_prompt: z.string().min(1).max(1000),
}).strict();

export const tarotProviderOutputSchema = z.object({
  overview: z.string().min(1).max(4000), cards: z.array(providerCardSchema).min(1).max(10),
  connections: z.string().min(1).max(4000), guidance: z.string().min(1).max(3000), closing: z.string().min(1).max(2000),
}).strict();

const readingCardSchema = providerCardSchema.extend({
  position: z.object({ id: z.string(), key: z.string(), order: z.number(), name: z.string(), meaning: z.string(), prompt: z.string() }).strict(),
  card: z.object({ id: z.string(), nameEn: z.string(), nameVi: z.string(), arcana: z.string(), suit: z.string().nullable(), keywords: z.array(z.string()) }).strict(),
  orientation: z.enum(["upright", "reversed"]),
});

export const tarotReadingPayloadSchema = z.object({
  overview: z.string(), cards: z.array(readingCardSchema), connections: z.string(), guidance: z.string(), closing: z.string(), disclaimer: z.string(),
}).strict();

export type ReadingPayload = TarotReadingPayload;

const disclaimer = {
  en: "This is a reflective reading, not a certain prediction or professional advice.",
  vi: "Đây là một lời mời để phản chiếu, không phải lời tiên đoán chắc chắn hay lời khuyên chuyên môn.",
} as const;

export function parseReadingPayload(value: unknown, expectedCards: TarotReadingCardContext[], locale: TarotLocale): TarotReadingPayload {
  const parsed = tarotProviderOutputSchema.safeParse(value);
  if (!parsed.success) throw new Error(`Invalid Tarot provider output: ${parsed.error.issues[0]?.path.join(".") || "reading"}`);

  const expectedIds = expectedCards.map((card) => card.readingCardId);
  if (expectedIds.length === 0 || new Set(expectedIds).size !== expectedIds.length) throw new Error("Invalid expected card coverage for the session");
  const actualIds = parsed.data.cards.map((card) => card.reading_card_id);
  if (actualIds.length !== expectedIds.length || new Set(actualIds).size !== actualIds.length || actualIds.some((id) => !expectedIds.includes(id))) throw new Error("Invalid card coverage for the session");

  const providerById = new Map(parsed.data.cards.map((card) => [card.reading_card_id, card]));
  const cards = expectedCards.map((expected) => {
    const provider = providerById.get(expected.readingCardId) as TarotProviderCard;
    if (provider.position_key !== expected.position.key) throw new Error("Invalid position coverage for the session");
    return { ...provider, position: expected.position, card: expected.card, orientation: expected.orientation };
  });

  return tarotReadingPayloadSchema.parse({ overview: parsed.data.overview, cards, connections: parsed.data.connections, guidance: parsed.data.guidance, closing: parsed.data.closing, disclaimer: disclaimer[locale] });
}

export type TarotInterpretationOrientation = TarotOrientation;
