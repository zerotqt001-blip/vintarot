import { z } from "zod";
import type { TarotAIDiagnosticDetails, TarotProviderFailureStage } from "./ai/diagnostics";
import type { TarotLocale, TarotOrientation, TarotReadingCardContext, TarotReadingCardIdentity, TarotReadingPayload } from "./ai/types";

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

const reflectionPromptSchema = boundedProviderString(1000);
const followUpSuggestionSchema = boundedProviderString(500);
const deeperReadingSchema = z.union([boundedProviderString(6000), z.null()]);

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
  personal_insights: z.array(insightSchema).min(1).max(3),
  reflection_prompts: z.array(reflectionPromptSchema).min(0).max(2),
  next_steps: z.array(nextStepSchema).min(1).max(3),
  card_evidence: z.array(cardEvidenceSchema).min(1).max(10),
  deeper_reading: deeperReadingSchema,
  follow_up_suggestions: z.array(followUpSuggestionSchema).min(1).max(3),
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
  interpretation: boundedProviderString(4000),
}).strict();

export const tarotReadingPayloadSchema = z.object({
  directAnswer: directAnswerSchema,
  // Stored payloads intentionally retain the wider v2/v3 bounds so historical readings remain readable.
  personalInsights: z.array(insightSchema).min(1).max(6),
  reflectionPrompts: z.array(reflectionPromptSchema).min(0).max(4),
  nextSteps: z.array(nextStepSchema).min(1).max(4),
  cardEvidence: z.array(readingCardEvidenceSchema).min(1).max(10),
  deeperReading: deeperReadingSchema,
  followUpSuggestions: z.array(followUpSuggestionSchema).max(4),
  disclaimer: boundedProviderString(500),
}).strict();

export type ReadingPayload = TarotReadingPayload;

const disclaimer = {
  en: "This is a reflective reading, not a certain prediction or professional advice.",
  vi: "Đây là một lời mời để phản chiếu, không phải lời tiên đoán chắc chắn hay lời khuyên chuyên môn.",
} as const;

const openingMechanicsPattern = /^(?:(?:the\s+)?cards?\s+(?:show|suggest|indicate|reveal|point|tell|say)\b|(?:the\s+)?spread\s+(?:show|suggest|indicate|reveal|point|tell|say)\b|(?:this|the)\s+(?:\w+\s*[- ]\s*card\s+)?spread\b|(?:in|from|looking\s+at)\s+(?:this|the)\s+(?:\w+\s*[- ]\s*card\s+)?spread\b|(?:the\s+)?(?:first|second|third|fourth|fifth|last)\s+card\b|(?:card|position)\s*#?\s*\d+\b|(?:các\s+)?lá\s+bài\s+(?:cho\s+thấy|gợi\s+ý|chỉ\s+ra|tiết\s+lộ)\b|(?:trải|bộ)\s+bài\s+(?:cho\s+thấy|gợi\s+ý|chỉ\s+ra|tiết\s+lộ)\b|(?:lá\s+)?bài\s+(?:đầu|thứ)\s+(?:tiên|hai|ba|tư|năm)\b)/iu;

function openingText(value: string): string {
  return value.split(/\n\s*\n/)[0].trim().replace(/^[\s"'“”‘’*_#-]+/u, "");
}

function startsWithPhrase(value: string, phrase: string): boolean {
  const normalizedValue = value.toLocaleLowerCase();
  const normalizedPhrase = phrase.trim().toLocaleLowerCase();
  if (!normalizedPhrase || !normalizedValue.startsWith(normalizedPhrase)) return false;
  const next = normalizedValue.slice(normalizedPhrase.length);
  return next.length === 0 || /^[\s,:;.!?—–-]/u.test(next);
}

export function assertPersonalOpening(value: string, expectedCards: TarotReadingCardIdentity[]): void {
  const opening = openingText(value);
  if (openingMechanicsPattern.test(opening)) {
    throw new Error("direct_answer must begin with the reader's situation, not spread mechanics");
  }

  const cardNames = expectedCards.flatMap((card) => [card.card.nameEn, card.card.nameVi]);
  if (cardNames.some((name) => startsWithPhrase(opening, name) || startsWithPhrase(opening, `the ${name}`))) {
    throw new Error("direct_answer must not begin with a card name");
  }
}

export class TarotReadingValidationError extends Error {
  readonly details: TarotAIDiagnosticDetails;

  constructor(message: string, details: TarotAIDiagnosticDetails) {
    super(message);
    this.name = "TarotReadingValidationError";
    this.details = details;
  }
}

function schemaValidationError(error: z.ZodError, label = "Invalid Tarot provider output"): TarotReadingValidationError {
  const issue = error.issues[0];
  return new TarotReadingValidationError(`${label}: ${issue?.path.join(".") || "reading"}`, {
    failureStage: "reading_schema_invalid",
    schemaIssuePath: issue?.path.join(".") || "reading",
    schemaIssueCode: issue?.code,
  });
}

function providerValidationError(message: string, failureStage: TarotProviderFailureStage, details: Omit<TarotAIDiagnosticDetails, "failureStage"> = {}) {
  return new TarotReadingValidationError(message, { failureStage, ...details });
}

export function parseReadingPayload(value: unknown, expectedCards: TarotReadingCardContext[], locale: TarotLocale): TarotReadingPayload {
  const parsed = tarotProviderOutputSchema.safeParse(value);
  if (!parsed.success) throw schemaValidationError(parsed.error);

  const expectedIds = expectedCards.map((card) => card.readingCardId);
  if (expectedIds.length === 0 || expectedIds.length > 10 || new Set(expectedIds).size !== expectedIds.length) {
    throw new Error("Invalid expected card coverage for the session");
  }
  try {
    assertPersonalOpening(parsed.data.direct_answer, expectedCards);
  } catch (error) {
    throw providerValidationError(
      error instanceof Error ? error.message : "Invalid direct answer opening.",
      "reading_schema_invalid",
      { schemaIssueCode: "personal_opening" },
    );
  }

  const actualIds = parsed.data.card_evidence.map((evidence) => evidence.reading_card_id);
  if (actualIds.length !== expectedIds.length) {
    throw providerValidationError("Invalid card evidence coverage for the session.", "card_evidence_count_invalid", {
      expectedCardCount: expectedIds.length,
      actualCardEvidenceCount: actualIds.length,
    });
  }
  if (new Set(actualIds).size !== actualIds.length || actualIds.some((id) => !expectedIds.includes(id))) {
    throw providerValidationError("Invalid card evidence coverage for the session.", "card_identity_invalid", {
      expectedCardCount: expectedIds.length,
      actualCardEvidenceCount: actualIds.length,
    });
  }

  const providerById = new Map(parsed.data.card_evidence.map((evidence) => [evidence.reading_card_id, evidence]));
  const cardEvidence = expectedCards.map((expected) => {
    const provider = providerById.get(expected.readingCardId);
    if (!provider) throw providerValidationError("Invalid card evidence coverage for the session.", "card_identity_invalid", {
      expectedCardCount: expectedIds.length,
      actualCardEvidenceCount: actualIds.length,
    });
    if (provider.position_key !== expected.position.key) throw providerValidationError("Invalid position coverage for the session.", "position_key_invalid", {
      expectedCardCount: expectedIds.length,
      actualCardEvidenceCount: actualIds.length,
    });
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
  if (!result.success) throw schemaValidationError(result.error, "Invalid Tarot reading payload");
  return result.data;
}

export type TarotInterpretationOrientation = TarotOrientation;
