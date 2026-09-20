import { TAROT_FOLLOW_UP_PROMPT_VERSION, MAX_TAROT_FOLLOW_UP_QUESTION_LENGTH } from "./ai/prompts/tarot-reading";
import { TarotAIError, type TarotAIProvider } from "./ai/provider";
import type { TarotFollowUpInput, TarotFollowUpPayload, TarotLocale, TarotMeaningEvidence, TarotReadingCardContext, TarotReadingPayload } from "./ai/types";
import type { ReadingOwner } from "./tarot-guest";
import { parseStoredReading } from "./tarot-reading-compat";
import type { ReadingCardWithDetails, ReadingTemplateWithPositions, TarotRepository } from "./tarot-repository";

export type TarotFollowUpServiceErrorCode = "not_found" | "incomplete" | "invalid_request";

export class TarotFollowUpServiceError extends Error {
  readonly code: TarotFollowUpServiceErrorCode;

  constructor(code: TarotFollowUpServiceErrorCode, message: string, options?: { cause?: unknown }) {
    super(message, options?.cause === undefined ? undefined : { cause: options.cause });
    this.name = "TarotFollowUpServiceError";
    this.code = code;
  }
}

export type GenerateTarotFollowUpArgs = {
  repository: TarotRepository;
  owner: ReadingOwner;
  sessionId: string;
  locale: TarotLocale;
  followUpQuestion: string;
  provider: TarotAIProvider;
};

export type GeneratedTarotFollowUp = {
  sessionId: string;
  locale: TarotLocale;
  source: "ai";
  provider: TarotAIProvider["id"];
  modelName: string;
  promptVersion: typeof TAROT_FOLLOW_UP_PROMPT_VERSION;
  answer: string;
};

const emptyMeaning: TarotMeaningEvidence = {
  summary: "",
  energy: "",
  actions: [],
  relationships: "",
  work: "",
  creativity: "",
  home: "",
  symbolism: "",
  journalQuestions: [],
  keywords: [],
};

function expectedCards(cards: ReadingCardWithDetails[], template: ReadingTemplateWithPositions): TarotReadingCardContext[] {
  if (cards.length !== template.template.cardCount || template.positions.length !== template.template.cardCount) {
    throw new TarotFollowUpServiceError("incomplete", "The saved reading cards are incomplete.");
  }
  const positions = new Map(template.positions.map((position) => [position.id, position]));
  const sortedCards = [...cards].sort((left, right) => left.positionOrder - right.positionOrder || left.id.localeCompare(right.id));
  if (new Set(sortedCards.map((card) => card.id)).size !== sortedCards.length || new Set(sortedCards.map((card) => card.spreadPositionId)).size !== sortedCards.length) {
    throw new TarotFollowUpServiceError("incomplete", "The saved reading card metadata is invalid.");
  }

  return sortedCards.map((card) => {
    const position = positions.get(card.spreadPositionId);
    if (!position || position.key !== card.positionKey || position.order !== card.positionOrder) {
      throw new TarotFollowUpServiceError("incomplete", "The saved reading card metadata is invalid.");
    }
    if (card.orientation !== "upright" && card.orientation !== "reversed") {
      throw new TarotFollowUpServiceError("incomplete", "The saved reading card orientation is invalid.");
    }
    return {
      readingCardId: card.id,
      orientation: card.orientation,
      position: {
        id: position.id,
        key: position.key,
        order: position.order,
        name: position.name,
        meaning: position.meaning,
        prompt: position.prompt,
      },
      card: {
        id: card.cardId,
        nameEn: card.nameEn,
        nameVi: card.nameVi,
        arcana: card.arcana,
        suit: card.suit,
        keywords: [],
      },
      knowledge: { upright: emptyMeaning, reversed: emptyMeaning },
    };
  });
}

function buildFollowUpInput(
  session: NonNullable<Awaited<ReturnType<TarotRepository["getSessionForOwner"]>>>["session"],
  cards: ReadingCardWithDetails[],
  template: ReadingTemplateWithPositions,
  reading: TarotReadingPayload,
  locale: TarotLocale,
  followUpQuestion: string,
): TarotFollowUpInput {
  const question = session.question.trim();
  if (!question) throw new TarotFollowUpServiceError("incomplete", "The saved reading question is unavailable.");
  const cardEvidence = reading.cardEvidence.map(({ readingCardId, position, card, orientation }) => ({
    readingCardId,
    position,
    card,
    orientation,
  }));
  if (cardEvidence.length !== cards.length) throw new TarotFollowUpServiceError("incomplete", "The saved reading card evidence is incomplete.");
  return {
    locale,
    question,
    followUpQuestion,
    category: { id: template.category.id, key: template.category.slug, name: template.category.name },
    spread: {
      id: template.template.id,
      key: template.template.slug,
      name: template.template.name,
      description: template.template.description,
    },
    cards: cardEvidence,
    reading,
  };
}

export async function generateTarotFollowUp(args: GenerateTarotFollowUpArgs): Promise<GeneratedTarotFollowUp> {
  const followUpQuestion = args.followUpQuestion.trim();
  if (!followUpQuestion || followUpQuestion.length > MAX_TAROT_FOLLOW_UP_QUESTION_LENGTH) {
    throw new TarotFollowUpServiceError("invalid_request", "The follow-up question is invalid.");
  }

  const stored = await args.repository.getSessionForOwner(args.sessionId, args.owner);
  if (!stored) throw new TarotFollowUpServiceError("not_found", "Reading session not found.");
  if (stored.session.status !== "drawn" || !stored.cards.length || stored.cards.length !== stored.session.cardCount) {
    throw new TarotFollowUpServiceError("incomplete", "This reading is not ready for a follow-up.");
  }

  const saved = await args.repository.getLatestReadingForOwner(args.sessionId, args.owner);
  if (!saved) throw new TarotFollowUpServiceError("incomplete", "A saved reading is required before a follow-up.");

  const template = await args.repository.getReadingTemplate(stored.session.spreadTemplateId, args.locale);
  if (!template) throw new TarotFollowUpServiceError("incomplete", "The saved spread definition is unavailable.");

  let reading: TarotReadingPayload;
  let input: TarotFollowUpInput;
  try {
    const trustedCards = expectedCards(stored.cards, template);
    reading = parseStoredReading(saved, trustedCards, args.locale);
    input = buildFollowUpInput(stored.session, stored.cards, template, reading, args.locale, followUpQuestion);
  } catch (error) {
    if (error instanceof TarotFollowUpServiceError) throw error;
    throw new TarotFollowUpServiceError("incomplete", "The saved reading context is incomplete.", { cause: error });
  }

  let followUp: TarotFollowUpPayload | undefined;
  try {
    if (!args.provider.generateFollowUp) {
      throw new TarotAIError("configuration", "Tarot follow-up is not supported by the selected provider.");
    }
    for (let attemptNumber = 1; attemptNumber <= 2; attemptNumber += 1) {
      try {
        followUp = await args.provider.generateFollowUp(input);
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

  if (!followUp) throw new TarotAIError("upstream", "Tarot AI provider request failed.", { retryable: true });

  return {
    sessionId: args.sessionId,
    locale: args.locale,
    source: "ai",
    provider: args.provider.id,
    modelName: `${args.provider.id}:${args.provider.model}`,
    promptVersion: TAROT_FOLLOW_UP_PROMPT_VERSION,
    answer: followUp.answer,
  };
}
