import { TAROT_CLARIFICATION_PROMPT_VERSION, MAX_TAROT_FOLLOW_UP_QUESTION_LENGTH } from "./ai/prompts/tarot-reading";
import { getV5CardKnowledge, v5CardKeywords } from "./ai/knowledge-v5";
import { TarotAIError, type TarotAIProvider } from "./ai/provider";
import type { TarotClarificationInput, TarotClarificationPayload, TarotLocale, TarotReadingCardIdentity, TarotReadingPayload, TarotSupplementaryDraw } from "./ai/types";
import { buildTarotReadingInput, meaningEvidence } from "./tarot-reading-context";
import { parseStoredReading } from "./tarot-reading-compat";
import type { ReadingOwner } from "./tarot-guest";
import { tarotReadingPayloadSchema } from "./tarot-interpretation";
import type { CardMeaningRow, CardRow, ReadingSessionWithCards, ReadingTemplateWithPositions, TarotRepository } from "./tarot-repository";

export type TarotClarificationServiceErrorCode = "not_found" | "incomplete" | "invalid_request" | "limit" | "persistence";

export class TarotClarificationServiceError extends Error {
  readonly code: TarotClarificationServiceErrorCode;

  constructor(code: TarotClarificationServiceErrorCode, message: string, options?: { cause?: unknown }) {
    super(message, options?.cause === undefined ? undefined : { cause: options.cause });
    this.name = "TarotClarificationServiceError";
    this.code = code;
  }
}

export type GenerateTarotClarificationArgs = {
  repository: TarotRepository;
  owner: ReadingOwner;
  sessionId: string;
  locale: TarotLocale;
  followUpQuestion: string;
  requestId: string;
  provider: TarotAIProvider;
  random?: () => number;
};

export type GeneratedTarotClarification = {
  sessionId: string;
  readingId: string;
  locale: TarotLocale;
  source: "ai";
  provider: TarotAIProvider["id"];
  modelName: string;
  promptVersion: typeof TAROT_CLARIFICATION_PROMPT_VERSION;
  clarification: TarotSupplementaryDraw;
};

function secureRandom(): number {
  const buffer = new Uint32Array(1);
  globalThis.crypto.getRandomValues(buffer);
  return buffer[0] / 0x1_0000_0000;
}

function boundedRandom(random: () => number): number {
  return Math.max(0, Math.min(0.999999999, random()));
}

function expectedCards(input: ReturnType<typeof buildTarotReadingInput>): TarotReadingCardIdentity[] {
  return input.cards.map(({ readingCardId, position, card, orientation }) => ({ readingCardId, position, card, orientation }));
}

function validateStoredDraws(reading: TarotReadingPayload): TarotSupplementaryDraw[] {
  const draws = reading.supplementaryDraws || [];
  if (draws.length > 3) throw new TarotClarificationServiceError("incomplete", "The saved clarification history is invalid.");
  if (new Set(draws.map((draw) => draw.requestId)).size !== draws.length
    || new Set(draws.map((draw) => draw.id)).size !== draws.length
    || new Set(draws.map((draw) => draw.sequence)).size !== draws.length
    || draws.some((draw, index) => draw.sequence !== index + 1)) {
    throw new TarotClarificationServiceError("incomplete", "The saved clarification history is invalid.");
  }
  return draws;
}

function selectedCardContext(
  card: CardRow,
  orientation: "upright" | "reversed",
  meaning: CardMeaningRow,
  domain: string,
) {
  const knowledge = getV5CardKnowledge(card.nameEn, domain, "clarification");
  return {
    card: {
      id: card.id,
      nameEn: card.nameEn,
      nameVi: card.nameVi,
      arcana: card.arcana,
      suit: card.suit,
      keywords: v5CardKeywords(card.nameEn),
    },
    orientation,
    knowledge: meaningEvidence(meaning, knowledge?.[orientation]),
  } satisfies TarotClarificationInput["supplementaryCard"];
}

function resultFrom(readingId: string, args: GenerateTarotClarificationArgs, clarification: TarotSupplementaryDraw): GeneratedTarotClarification {
  return {
    sessionId: args.sessionId,
    readingId,
    locale: args.locale,
    source: "ai",
    provider: args.provider.id,
    modelName: `${args.provider.id}:${args.provider.model}`,
    promptVersion: TAROT_CLARIFICATION_PROMPT_VERSION,
    clarification,
  };
}

async function clarificationPayload(args: GenerateTarotClarificationArgs, input: TarotClarificationInput): Promise<TarotClarificationPayload> {
  if (!args.provider.generateClarification) {
    throw new TarotAIError("configuration", "Tarot clarification is not supported by the selected provider.");
  }
  let payload: TarotClarificationPayload | undefined;
  try {
    for (let attemptNumber = 1; attemptNumber <= 2; attemptNumber += 1) {
      try {
        payload = await args.provider.generateClarification(input);
        break;
      } catch (error) {
        const shouldRetry = error instanceof TarotAIError
          && error.code === "invalid_response"
          && error.retryable
          && attemptNumber === 1;
        if (!shouldRetry) throw error;
      }
    }
  } catch (error) {
    if (error instanceof TarotAIError) throw error;
    throw new TarotAIError("upstream", "Tarot AI provider request failed.", { retryable: true, cause: error });
  }
  if (!payload) throw new TarotAIError("upstream", "Tarot AI provider request failed.", { retryable: true });
  return payload;
}

async function trustedReadingContext(
  repository: TarotRepository,
  stored: ReadingSessionWithCards,
  template: ReadingTemplateWithPositions,
  locale: TarotLocale,
  saved: NonNullable<Awaited<ReturnType<TarotRepository["getLatestReadingForOwner"]>>>,
) {
  const meaningEntries = await Promise.all(stored.cards.map(async (card) => [card.cardId, await repository.getMeaningPair(card.cardId, locale)] as const));
  const meanings = new Map<string, NonNullable<(typeof meaningEntries)[number][1]>>();
  for (const [cardId, pair] of meaningEntries) {
    if (!pair) throw new TarotClarificationServiceError("incomplete", "A required card meaning is unavailable.");
    meanings.set(cardId, pair);
  }

  let input;
  try {
    input = buildTarotReadingInput({ session: stored.session, cards: stored.cards, template, meanings, locale });
  } catch (error) {
    if (error instanceof TarotClarificationServiceError) throw error;
    throw new TarotClarificationServiceError("incomplete", "The saved reading context is incomplete.", { cause: error });
  }
  let reading: TarotReadingPayload;
  try {
    reading = parseStoredReading(saved, expectedCards(input), locale);
  } catch (error) {
    throw new TarotClarificationServiceError("incomplete", "The saved reading context is incomplete.", { cause: error });
  }
  return { input, reading };
}

export async function generateTarotClarification(args: GenerateTarotClarificationArgs): Promise<GeneratedTarotClarification> {
  const followUpQuestion = args.followUpQuestion.trim();
  const requestId = args.requestId.trim();
  if (!followUpQuestion || followUpQuestion.length > MAX_TAROT_FOLLOW_UP_QUESTION_LENGTH || !requestId || requestId.length > 100) {
    throw new TarotClarificationServiceError("invalid_request", "The clarification request is invalid.");
  }

  const stored = await args.repository.getSessionForOwner(args.sessionId, args.owner);
  if (!stored) throw new TarotClarificationServiceError("not_found", "Reading session not found.");
  if (stored.session.status !== "drawn" || !stored.cards.length || stored.cards.length !== stored.session.cardCount) {
    throw new TarotClarificationServiceError("incomplete", "This reading is not ready for clarification.");
  }
  const template = await args.repository.getReadingTemplate(stored.session.spreadTemplateId, args.locale);
  if (!template) throw new TarotClarificationServiceError("incomplete", "The saved spread definition is unavailable.");
  const saved = await args.repository.getLatestReadingForOwner(args.sessionId, args.owner);
  if (!saved) throw new TarotClarificationServiceError("incomplete", "A saved reading is required before clarification.");
  const { input, reading } = await trustedReadingContext(args.repository, stored, template, args.locale, saved);
  const previousDraws = validateStoredDraws(reading);
  const existing = previousDraws.find((draw) => draw.requestId === requestId);
  if (existing) return resultFrom(saved.id, args, existing);
  if (previousDraws.length >= 3) throw new TarotClarificationServiceError("limit", "This reading has reached its clarification limit.");

  const deckIds = new Set(stored.cards.map((card) => card.deckId));
  if (deckIds.size !== 1) throw new TarotClarificationServiceError("incomplete", "The saved reading deck is invalid.");
  const deckId = stored.cards[0].deckId;
  if (!(await args.repository.getActiveDeck(deckId))) throw new TarotClarificationServiceError("incomplete", "The saved reading deck is unavailable.");
  const usedCardIds = new Set([...stored.cards.map((card) => card.cardId), ...previousDraws.map((draw) => draw.card.id)]);
  const availableCards = (await args.repository.listCards(deckId)).filter((card) => !usedCardIds.has(card.id));
  if (!availableCards.length) throw new TarotClarificationServiceError("incomplete", "No unused clarification card is available.");
  const random = args.random || secureRandom;
  const selected = availableCards[Math.floor(boundedRandom(random) * availableCards.length)];
  const orientation = boundedRandom(random) < 0.3 ? "reversed" : "upright";
  const selectedMeaning = await args.repository.getMeaning(selected.id, args.locale, orientation);
  if (!selectedMeaning) throw new TarotClarificationServiceError("incomplete", "The selected card meaning is unavailable.");

  const providerInput: TarotClarificationInput = {
    locale: args.locale,
    question: input.question,
    followUpQuestion,
    category: input.category,
    spread: input.spread,
    cards: input.cards.map(({ readingCardId, position, card, orientation: cardOrientation }) => ({ readingCardId, position, card, orientation: cardOrientation })),
    reading,
    supplementaryCard: selectedCardContext(selected, orientation, selectedMeaning, input.domain),
  };
  const generated = await clarificationPayload(args, providerInput);
  const clarification: TarotSupplementaryDraw = {
    id: globalThis.crypto.randomUUID(),
    requestId,
    sequence: previousDraws.length + 1,
    question: followUpQuestion,
    relationship: "clarification",
    card: {
      id: selected.id,
      nameEn: selected.nameEn,
      nameVi: selected.nameVi,
      arcana: selected.arcana,
      suit: selected.suit || null,
    },
    orientation,
    answer: generated.answer,
  };
  const parsed = tarotReadingPayloadSchema.safeParse({ ...reading, supplementaryDraws: [...previousDraws, clarification] });
  if (!parsed.success) throw new TarotClarificationServiceError("incomplete", "The clarification payload is invalid.", { cause: parsed.error });

  let persisted = false;
  try {
    persisted = await args.repository.updateReadingPayload(saved.id, args.sessionId, parsed.data, saved.readingPayload);
  } catch (error) {
    throw new TarotClarificationServiceError("persistence", "The Tarot clarification could not be saved.", { cause: error });
  }
  if (persisted) return resultFrom(saved.id, args, clarification);

  const latest = await args.repository.getLatestReadingForOwner(args.sessionId, args.owner);
  if (latest) {
    try {
      const reloaded = parseStoredReading(latest, expectedCards(input), args.locale);
      const existingAfterRace = validateStoredDraws(reloaded).find((draw) => draw.requestId === requestId);
      if (existingAfterRace) return resultFrom(latest.id, args, existingAfterRace);
    } catch {
      // Treat an unreadable compare-and-set result as a safe persistence failure.
    }
  }
  throw new TarotClarificationServiceError("persistence", "The Tarot clarification could not be saved.");
}
