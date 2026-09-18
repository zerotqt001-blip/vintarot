import { z } from "zod";
import type { TarotLocale, TarotOrientation, TarotReadingCardContext, TarotReadingPayload } from "./ai/types";

export { TAROT_PROMPT_VERSION as PROMPT_VERSION } from "./ai/prompts/tarot-reading";
export type { TarotReadingPayload } from "./ai/types";

const boundedProviderString = (max: number) => z.string().min(1).max(max);

const insightSchema = z.object({
  title: boundedProviderString(240),
  body: boundedProviderString(1200),
}).strict();

const nextStepSchema = z.object({
  title: boundedProviderString(240),
  body: boundedProviderString(1200),
}).strict();

const cardEvidenceSchema = z.object({
  reading_card_id: z.string().min(1).max(100),
  position_key: z.string().min(1).max(100),
  interpretation: boundedProviderString(4000),
}).strict();

const directAnswerSchema = z.string().min(1).max(6000).refine((value) => {
  const paragraphs = value.split(/\n\s*\n/);
  return paragraphs.length >= 2 && paragraphs.length <= 4 && paragraphs.every((paragraph) => paragraph.trim().length > 0);
}, { message: "direct_answer must contain 2 to 4 non-empty paragraphs" });

export const tarotProviderOutputSchema = z.object({
  direct_answer: directAnswerSchema,
  personal_insights: z.array(insightSchema).min(1).max(6),
  reflection_prompts: z.array(z.string().min(1)).min(1).max(4),
  next_steps: z.array(nextStepSchema).min(1).max(4),
  card_evidence: z.array(cardEvidenceSchema).min(1).max(10),
  deeper_reading: z.union([z.string().min(1), z.null()]),
  follow_up_suggestions: z.array(z.string().min(1)).min(0).max(4),
}).strict();

const positionSchema = z.object({
  id: z.string(),
  key: z.string(),
  order: z.number(),
  name: z.string(),
  meaning: z.string(),
  prompt: z.string(),
}).strict();

const cardSchema = z.object({
  id: z.string(),
  nameEn: z.string(),
  nameVi: z.string(),
  arcana: z.string(),
  suit: z.string().nullable(),
  keywords: z.array(z.string()),
}).strict();

const readingCardEvidenceSchema = z.object({
  readingCardId: z.string(),
  position: positionSchema,
  card: cardSchema,
  orientation: z.enum(["upright", "reversed"]),
  interpretation: z.string(),
}).strict();

export const tarotReadingPayloadSchema = z.object({
  directAnswer: z.string(),
  personalInsights: z.array(insightSchema),
  reflectionPrompts: z.array(z.string()),
  nextSteps: z.array(nextStepSchema),
  cardEvidence: z.array(readingCardEvidenceSchema),
  deeperReading: z.string().nullable(),
  followUpSuggestions: z.array(z.string()),
  disclaimer: z.string(),
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
  if (expectedIds.length === 0 || expectedIds.length > 10 || new Set(expectedIds).size !== expectedIds.length) {
    throw new Error("Invalid expected card coverage for the session");
  }

  const actualIds = parsed.data.card_evidence.map((evidence) => evidence.reading_card_id);
  if (
    actualIds.length !== expectedIds.length
    || new Set(actualIds).size !== actualIds.length
    || actualIds.some((id) => !expectedIds.includes(id))
  ) {
    throw new Error("Invalid card evidence coverage for the session");
  }

  const providerById = new Map(parsed.data.card_evidence.map((evidence) => [evidence.reading_card_id, evidence]));
  const cardEvidence = expectedCards.map((expected) => {
    const provider = providerById.get(expected.readingCardId);
    if (!provider) throw new Error("Invalid card evidence coverage for the session");
    if (provider.position_key !== expected.position.key) throw new Error("Invalid position coverage for the session");
    return {
      readingCardId: expected.readingCardId,
      position: expected.position,
      card: expected.card,
      orientation: expected.orientation,
      interpretation: provider.interpretation,
    };
  });

  const normalized = {
    directAnswer: parsed.data.direct_answer,
    personalInsights: parsed.data.personal_insights,
    reflectionPrompts: parsed.data.reflection_prompts,
    nextSteps: parsed.data.next_steps,
    cardEvidence,
    deeperReading: parsed.data.deeper_reading,
    followUpSuggestions: parsed.data.follow_up_suggestions,
    disclaimer: disclaimer[locale],
  };
  const result = tarotReadingPayloadSchema.safeParse(normalized);
  if (!result.success) throw new Error(`Invalid Tarot reading payload: ${result.error.issues[0]?.path.join(".") || "reading"}`);
  return result.data;
}

export type TarotInterpretationOrientation = TarotOrientation;
