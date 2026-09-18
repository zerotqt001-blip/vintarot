import { z } from "zod";
import type { TarotLocale, TarotReadingCardContext, TarotReadingPayload } from "./ai/types";
import { assertPersonalOpening, tarotReadingPayloadSchema } from "./tarot-interpretation";

export type StoredReadingRow = {
  id: string;
  sessionId: string;
  opening: string;
  cardReadings: string;
  synthesis: string;
  advice: string;
  closing: string;
  disclaimer: string;
  readingPayload: string | null;
  modelName: string;
  promptVersion: string;
  createdAt: number;
  updatedAt: number;
};

export class TarotReadingCompatibilityError extends Error {
  readonly code = "reading_compatibility" as const;

  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options?.cause === undefined ? undefined : { cause: options.cause });
    this.name = "TarotReadingCompatibilityError";
  }
}

const disclaimer = {
  en: "This is a reflective reading, not a certain prediction or professional advice.",
  vi: "Đây là một lời mời để phản chiếu, không phải lời tiên đoán chắc chắn hay lời khuyên chuyên môn.",
} as const;

const legacyLabels = {
  en: { insight: "What is emerging", nextStep: "A next step" },
  vi: { insight: "Điều đang nổi lên", nextStep: "Một bước tiếp theo" },
} as const;

const legacyCardSchema = z.object({
  reading_card_id: z.string().min(1).max(100).optional(),
  readingCardId: z.string().min(1).max(100).optional(),
  position_key: z.string().min(1).max(100).optional(),
  positionKey: z.string().min(1).max(100).optional(),
  position: z.object({ key: z.string().min(1).max(100) }).passthrough().optional(),
  interpretation: z.string().min(1).max(4000),
  reflection_prompt: z.string().min(1).max(1000).optional(),
  reflectionPrompt: z.string().min(1).max(1000).optional(),
}).passthrough();

function text(value: string, max: number): string {
  return value.trim().slice(0, max);
}

function parseJson(value: string, field: string): unknown {
  try {
    return JSON.parse(value);
  } catch (error) {
    throw new TarotReadingCompatibilityError(`Stored Tarot ${field} is not valid JSON.`, { cause: error });
  }
}

function expectedCardEvidence(
  evidence: Array<{ readingCardId: string; interpretation: string; positionKey?: string }>,
  expectedCards: TarotReadingCardContext[],
): TarotReadingPayload["cardEvidence"] {
  const expectedIds = expectedCards.map((card) => card.readingCardId);
  if (expectedIds.length === 0 || expectedIds.length > 10 || new Set(expectedIds).size !== expectedIds.length) {
    throw new TarotReadingCompatibilityError("Stored Tarot reading has invalid expected card coverage.");
  }
  if (
    evidence.length !== expectedIds.length
    || new Set(evidence.map((item) => item.readingCardId)).size !== evidence.length
    || evidence.some((item) => !expectedIds.includes(item.readingCardId))
  ) {
    throw new TarotReadingCompatibilityError("Stored Tarot reading has incomplete card evidence coverage.");
  }

  const byId = new Map(evidence.map((item) => [item.readingCardId, item]));
  return expectedCards.map((expected) => {
    const item = byId.get(expected.readingCardId);
    if (!item || (item.positionKey !== undefined && item.positionKey !== expected.position.key)) {
      throw new TarotReadingCompatibilityError("Stored Tarot reading has incomplete position coverage.");
    }
    return {
      readingCardId: expected.readingCardId,
      position: expected.position,
      card: expected.card,
      orientation: expected.orientation,
      interpretation: text(item.interpretation, 4000),
    };
  });
}

function parseNormalizedPayload(row: StoredReadingRow, expectedCards: TarotReadingCardContext[]): TarotReadingPayload {
  const parsed = tarotReadingPayloadSchema.safeParse(parseJson(row.readingPayload!, "reading_payload"));
  if (!parsed.success) {
    throw new TarotReadingCompatibilityError("Stored Tarot reading payload does not match the normalized contract.", { cause: parsed.error });
  }
  try {
    assertPersonalOpening(parsed.data.directAnswer, expectedCards);
  } catch (error) {
    throw new TarotReadingCompatibilityError("Stored Tarot reading payload has an invalid direct answer.", { cause: error });
  }
  return {
    ...parsed.data,
    cardEvidence: expectedCardEvidence(parsed.data.cardEvidence.map((item) => ({
      readingCardId: item.readingCardId,
      positionKey: item.position.key,
      interpretation: item.interpretation,
    })), expectedCards),
  };
}

function parseLegacyPayload(row: StoredReadingRow, expectedCards: TarotReadingCardContext[], locale: TarotLocale): TarotReadingPayload {
  const rawCards = parseJson(row.cardReadings, "card_readings");
  if (!Array.isArray(rawCards)) {
    throw new TarotReadingCompatibilityError("Legacy Tarot card readings must be an array.");
  }
  const legacyCards = rawCards.map((value) => {
    const parsed = legacyCardSchema.safeParse(value);
    if (!parsed.success) {
      throw new TarotReadingCompatibilityError("Legacy Tarot card readings contain an invalid card entry.", { cause: parsed.error });
    }
    const readingCardId = parsed.data.reading_card_id || parsed.data.readingCardId;
    const positionKey = parsed.data.position_key || parsed.data.positionKey || parsed.data.position?.key;
    if (!readingCardId || !positionKey) {
      throw new TarotReadingCompatibilityError("Legacy Tarot card readings are missing trusted card coverage identifiers.");
    }
    return {
      readingCardId,
      positionKey,
      interpretation: parsed.data.interpretation,
      reflectionPrompt: parsed.data.reflection_prompt || parsed.data.reflectionPrompt,
    };
  });
  const cardEvidence = expectedCardEvidence(legacyCards, expectedCards);
  const reflectionPrompts = [...new Set(legacyCards.map((card) => card.reflectionPrompt).filter((prompt): prompt is string => Boolean(prompt)).map((prompt) => text(prompt, 1000)))].slice(0, 4);
  const labels = legacyLabels[locale];
  const candidate = {
    directAnswer: text(row.opening, 6000),
    personalInsights: row.synthesis.trim() ? [{ title: labels.insight, body: text(row.synthesis, 1200) }] : [],
    reflectionPrompts,
    nextSteps: row.advice.trim() ? [{ title: labels.nextStep, body: text(row.advice, 1200) }] : [],
    cardEvidence,
    deeperReading: row.closing.trim() ? text(row.closing, 6000) : null,
    followUpSuggestions: [],
    disclaimer: row.disclaimer.trim() || disclaimer[locale],
  };
  const normalized = tarotReadingPayloadSchema.safeParse(candidate);
  if (!normalized.success) {
    throw new TarotReadingCompatibilityError("Legacy Tarot reading does not satisfy the normalized contract.", { cause: normalized.error });
  }
  try {
    assertPersonalOpening(normalized.data.directAnswer, expectedCards);
  } catch (error) {
    throw new TarotReadingCompatibilityError("Legacy Tarot reading has an invalid direct answer.", { cause: error });
  }
  return normalized.data;
}

export function serializeLegacyReadingFields(reading: TarotReadingPayload): {
  opening: string;
  cardReadings: string;
  synthesis: string;
  advice: string;
  closing: string;
  disclaimer: string;
} {
  return {
    opening: reading.directAnswer,
    cardReadings: JSON.stringify(reading.cardEvidence),
    synthesis: reading.personalInsights.map(({ title, body }) => `${title}: ${body}`).join("\n\n"),
    advice: reading.nextSteps.map(({ title, body }) => `${title}: ${body}`).join("\n\n"),
    closing: reading.deeperReading || reading.directAnswer,
    disclaimer: reading.disclaimer,
  };
}

export function parseStoredReading(row: StoredReadingRow, expectedCards: TarotReadingCardContext[], locale: TarotLocale): TarotReadingPayload {
  if (row.readingPayload !== null) return parseNormalizedPayload(row, expectedCards);
  return parseLegacyPayload(row, expectedCards, locale);
}
