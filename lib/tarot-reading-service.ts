import { TAROT_PROMPT_VERSION } from "./ai/prompts/tarot-reading";
import { TarotAIError, type TarotAIProvider } from "./ai/provider";
import type { TarotProviderFailureStage } from "./ai/diagnostics";
import type { TarotLocale, TarotProviderId, TarotReadingCardIdentity, TarotReadingPayload } from "./ai/types";
import type { ReadingOwner } from "./tarot-guest";
import { parseStoredReading, type StoredReadingRow } from "./tarot-reading-compat";
import { buildTarotReadingInput } from "./tarot-reading-context";
import { selectContextualFollowUpSuggestions } from "./tarot-follow-up-suggestions";
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

export type HydratedTarotReading = {
  readingId: string;
  sessionId: string;
  locale: TarotLocale;
  modelName: string;
  promptVersion: string;
  reading: TarotReadingPayload;
};

function resolveOwner(args: GenerateTarotReadingArgs): ReadingOwner {
  if (args.owner) return args.owner;
  if (args.ownerId) return { kind: "user", userId: args.ownerId };
  throw new TarotReadingServiceError("not_found", "A reading owner is required.");
}

type PreparedTarotReadingContext = {
  owner: ReadingOwner;
  stored: Awaited<ReturnType<TarotRepository["getSessionForOwner"]>>;
  input: Awaited<ReturnType<typeof buildTarotReadingInput>>;
};

async function prepareTarotReadingContext(args: GenerateTarotReadingArgs): Promise<PreparedTarotReadingContext> {
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

  try {
    return {
      owner,
      stored,
      input: buildTarotReadingInput({ session: stored.session, cards: stored.cards, template, meanings, locale: args.locale }),
    };
  } catch (error) {
    if (error instanceof TarotReadingServiceError) throw error;
    throw new TarotReadingServiceError("incomplete", "The saved reading context is incomplete.", { cause: error });
  }
}

function readingCardIdentities(input: PreparedTarotReadingContext["input"]): TarotReadingCardIdentity[] {
  return input.cards.map(({ readingCardId, orientation, position, card }) => ({ readingCardId, orientation, position, card }));
}

export async function hydrateStoredTarotReading(args: {
  repository: TarotRepository;
  owner: ReadingOwner;
  sessionId: string;
  locale: TarotLocale;
  stored?: StoredReadingRow | null;
}): Promise<HydratedTarotReading | null> {
  const prepared = await prepareTarotReadingContext({
    repository: args.repository,
    owner: args.owner,
    sessionId: args.sessionId,
    locale: args.locale,
    provider: { id: "openai", model: "stored", generateReading: async () => { throw new Error("stored hydration must not call provider"); } },
  });
  const stored = args.stored === undefined ? await args.repository.getLatestReadingForOwner(args.sessionId, args.owner) : args.stored;
  if (!stored) return null;
  try {
    return {
      readingId: stored.id,
      sessionId: stored.sessionId,
      locale: args.locale,
      modelName: stored.modelName,
      promptVersion: stored.promptVersion,
      reading: parseStoredReading(stored, readingCardIdentities(prepared.input), args.locale),
    };
  } catch (error) {
    throw new TarotReadingServiceError("persistence", "The stored Tarot reading could not be read.", { cause: error });
  }
}

export async function getStoredTarotReadingForOwner(args: {
  repository: TarotRepository;
  owner: ReadingOwner;
  sessionId: string;
  locale: TarotLocale;
}): Promise<GeneratedTarotReading | null> {
  const stored = await args.repository.getLatestReadingForOwner(args.sessionId, args.owner);
  if (!stored) return null;
  const hydrated = await hydrateStoredTarotReading({ ...args, stored });
  if (!hydrated) return null;

  const provider = stored.modelName.split(":", 1)[0];
  if (provider !== "openai" && provider !== "gemini" && provider !== "deepseek") {
    throw new TarotReadingServiceError("persistence", "The stored Tarot reading has unsupported provider metadata.");
  }
  return { ...hydrated, source: "ai", provider: provider as TarotProviderId };
}

export async function generateTarotReading(args: GenerateTarotReadingArgs): Promise<GeneratedTarotReading> {
  const prepared = await prepareTarotReadingContext(args);
  const input = prepared.input;

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
  reading = {
    ...reading,
    followUpSuggestions: selectContextualFollowUpSuggestions(reading, input.question, args.locale),
  };
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
