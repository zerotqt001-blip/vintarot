import { TAROT_PROMPT_VERSION } from "./ai/prompts/tarot-reading";
import { TarotAIError, type TarotAIProvider } from "./ai/provider";
import type { TarotProviderFailureStage } from "./ai/diagnostics";
import type { TarotLocale, TarotReadingPayload } from "./ai/types";
import type { ReadingOwner } from "./tarot-guest";
import { buildTarotReadingInput } from "./tarot-reading-context";
import type { TarotRepository } from "./tarot-repository";

export type TarotReadingServiceErrorCode = "not_found" | "incomplete" | "persistence";

export class TarotReadingServiceError extends Error {
  readonly code: TarotReadingServiceErrorCode;

  constructor(code: TarotReadingServiceErrorCode, message: string, options?: { cause?: unknown }) {
    super(message, options?.cause === undefined ? undefined : { cause: options.cause });
    this.name = "TarotReadingServiceError";
    this.code = code;
  }
}

export type GenerateTarotReadingArgs = {
  repository: TarotRepository;
  owner?: ReadingOwner;
  /** Compatibility input for callers that only have an authenticated user id. */
  ownerId?: string;
  sessionId: string;
  locale: TarotLocale;
  provider: TarotAIProvider;
  onProviderFailure?: (event: TarotProviderFailureEvent) => void;
};

export type TarotProviderFailureEvent = {
  attemptNumber: number;
  provider: TarotAIProvider["id"];
  modelName: string;
  promptVersion: string;
  failureStage?: TarotProviderFailureStage;
  httpStatus?: number;
  expectedCardCount: number;
  actualCardEvidenceCount?: number;
  schemaIssuePath?: string;
  schemaIssueCode?: string;
  retryScheduled: boolean;
  latencyMs: number;
};

export type GeneratedTarotReading = {
  readingId: string;
  sessionId: string;
  locale: TarotLocale;
  source: "ai";
  provider: TarotAIProvider["id"];
  modelName: string;
  promptVersion: string;
  reading: TarotReadingPayload;
};

function resolveOwner(args: GenerateTarotReadingArgs): ReadingOwner {
  if (args.owner) return args.owner;
  if (args.ownerId) return { kind: "user", userId: args.ownerId };
  throw new TarotReadingServiceError("not_found", "A reading owner is required.");
}

export async function generateTarotReading(args: GenerateTarotReadingArgs): Promise<GeneratedTarotReading> {
  const owner = resolveOwner(args);
  const stored = await args.repository.getSessionForOwner(args.sessionId, owner);
  if (!stored) throw new TarotReadingServiceError("not_found", "Reading session not found.");
  if (stored.session.status !== "drawn" || !stored.cards.length || stored.cards.length !== stored.session.cardCount) {
    throw new TarotReadingServiceError("incomplete", "This reading is not ready to interpret.");
  }

  const template = await args.repository.getReadingTemplate(stored.session.spreadTemplateId, args.locale);
  if (!template) throw new TarotReadingServiceError("incomplete", "The saved spread definition is unavailable.");

  const meaningEntries = await Promise.all(stored.cards.map(async (card) => [card.cardId, await args.repository.getMeaningPair(card.cardId, args.locale)] as const));
  const meanings = new Map<string, NonNullable<(typeof meaningEntries)[number][1]>>();
  for (const [cardId, pair] of meaningEntries) {
    if (!pair) throw new TarotReadingServiceError("incomplete", "A required card meaning is unavailable.");
    meanings.set(cardId, pair);
  }

  let input;
  try {
    input = buildTarotReadingInput({ session: stored.session, cards: stored.cards, template, meanings, locale: args.locale });
  } catch (error) {
    if (error instanceof TarotReadingServiceError) throw error;
    throw new TarotReadingServiceError("incomplete", "The saved reading context is incomplete.", { cause: error });
  }

  let reading: TarotReadingPayload | undefined;
  const modelName = `${args.provider.id}:${args.provider.model}`;
  for (let attemptNumber = 1; attemptNumber <= 2; attemptNumber += 1) {
    const attemptStartedAt = Date.now();
    try {
      reading = await args.provider.generateReading(input);
      break;
    } catch (error) {
      const shouldRetry = error instanceof TarotAIError
        && error.code === "invalid_response"
        && error.retryable
        && attemptNumber === 1;
      if (!(error instanceof TarotAIError)) {
        throw new TarotAIError("upstream", "Tarot AI provider request failed.", { retryable: true, cause: error });
      }
      if (error.code !== "invalid_response") throw error;

      const event: TarotProviderFailureEvent = {
        attemptNumber,
        provider: args.provider.id,
        modelName,
        promptVersion: TAROT_PROMPT_VERSION,
        failureStage: error.failureStage,
        httpStatus: error.httpStatus,
        expectedCardCount: input.cards.length,
        actualCardEvidenceCount: error.actualCardEvidenceCount,
        schemaIssuePath: error.schemaIssuePath,
        schemaIssueCode: error.schemaIssueCode,
        retryScheduled: shouldRetry,
        latencyMs: Date.now() - attemptStartedAt,
      };
      try {
        args.onProviderFailure?.(event);
      } catch {
        // Diagnostics must never turn a provider failure into a different request failure.
      }
      if (shouldRetry) continue;
      throw error;
    }
  }

  if (!reading) throw new TarotAIError("upstream", "Tarot AI provider request failed.", { retryable: true });
  const readingId = globalThis.crypto.randomUUID();
  try {
    await args.repository.saveReading({
      id: readingId,
      sessionId: args.sessionId,
      reading,
      modelName,
      promptVersion: TAROT_PROMPT_VERSION,
    });
  } catch (error) {
    throw new TarotReadingServiceError("persistence", "The Tarot reading could not be saved.", { cause: error });
  }

  return {
    readingId,
    sessionId: args.sessionId,
    locale: args.locale,
    source: "ai",
    provider: args.provider.id,
    modelName,
    promptVersion: TAROT_PROMPT_VERSION,
    reading,
  };
}
