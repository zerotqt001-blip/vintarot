import type { D1Database } from "@cloudflare/workers-types";
import type { TarotAIProvider } from "./ai/provider";
import type { TarotLocale } from "./ai/types";
import {
  CreditError,
  CreditIdempotencyError,
  CreditInsufficientError,
  type CreditStore,
} from "./credits/repository";
import type { ReadingOwner } from "./tarot-guest";
import {
  generateTarotReading,
  hydrateStoredTarotReading,
  type GeneratedTarotReading,
  type TarotProviderFailureEvent,
} from "./tarot-reading-service";
import type { TarotRepository } from "./tarot-repository";

export type TarotCreditAuthorizationCode = "insufficient" | "in_progress" | "conflict" | "unavailable";

export class TarotCreditAuthorizationError extends Error {
  constructor(readonly code: TarotCreditAuthorizationCode, message: string, options?: { cause?: unknown }) {
    super(message, options?.cause === undefined ? undefined : { cause: options.cause });
    this.name = "TarotCreditAuthorizationError";
  }
}

export type GenerateMemberTarotReadingArgs = {
  database: D1Database;
  creditStore: CreditStore;
  repository: TarotRepository;
  owner: ReadingOwner;
  sessionId: string;
  locale: TarotLocale;
  provider: TarotAIProvider;
  onProviderFailure?: (event: TarotProviderFailureEvent) => void;
};

function creditOwner(owner: ReadingOwner) {
  if (owner.kind !== "user") throw new TarotCreditAuthorizationError("unavailable", "Member credit authorization requires a trusted member session.");
  return { kind: "member" as const, ownerId: owner.userId };
}

function hydrationResult(hydrated: Awaited<ReturnType<typeof hydrateStoredTarotReading>>, provider: TarotAIProvider): GeneratedTarotReading {
  if (!hydrated) throw new TarotCreditAuthorizationError("unavailable", "Stored Tarot reading is unavailable.");
  return { ...hydrated, source: "ai", provider: provider.id };
}

function mapCreditError(error: unknown): TarotCreditAuthorizationError {
  if (error instanceof TarotCreditAuthorizationError) return error;
  if (error instanceof CreditInsufficientError) return new TarotCreditAuthorizationError("insufficient", "You need more credits for this Tarot reading.", { cause: error });
  if (error instanceof CreditIdempotencyError) return new TarotCreditAuthorizationError("conflict", "This Tarot reading request conflicts with an existing request.", { cause: error });
  if (error instanceof CreditError && error.code === "reservation_state") return new TarotCreditAuthorizationError("in_progress", "This Tarot reading is already being prepared.", { cause: error });
  return new TarotCreditAuthorizationError("unavailable", "Credit authorization is temporarily unavailable.", { cause: error });
}

export async function generateMemberTarotReading(args: GenerateMemberTarotReadingArgs): Promise<GeneratedTarotReading> {
  const ownerForCredits = creditOwner(args.owner);
  const reservationKey = `tarot:${args.sessionId}`;
  const existingReservation = await args.creditStore.getReservationByKey(ownerForCredits, reservationKey);
  const existingStored = await args.repository.getLatestReadingForOwner(args.sessionId, args.owner);

  if (existingStored) {
    const hydrated = await hydrateStoredTarotReading({ repository: args.repository, owner: args.owner, sessionId: args.sessionId, locale: args.locale, stored: existingStored });
    if (existingReservation?.status === "RESERVED") {
      try {
        await args.creditStore.consumeReservation({ owner: ownerForCredits, reservationId: existingReservation.id, resultType: "tarot_reading", resultId: hydrated?.readingId });
      } catch (error) {
        throw mapCreditError(error);
      }
    }
    return hydrationResult(hydrated, args.provider);
  }

  let reservation;
  try {
    reservation = await args.creditStore.reserveCredits({
      owner: ownerForCredits,
      units: 1,
      usageType: "TAROT_READING",
      resourceType: "reading_session",
      resourceId: args.sessionId,
      idempotencyKey: reservationKey,
    });
  } catch (error) {
    throw mapCreditError(error);
  }

  if (reservation.acquired !== true) {
    const racedStored = await args.repository.getLatestReadingForOwner(args.sessionId, args.owner);
    if (racedStored) {
      const hydrated = await hydrateStoredTarotReading({ repository: args.repository, owner: args.owner, sessionId: args.sessionId, locale: args.locale, stored: racedStored });
      try {
        await args.creditStore.consumeReservation({ owner: ownerForCredits, reservationId: reservation.id, resultType: "tarot_reading", resultId: hydrated?.readingId });
      } catch (error) {
        throw mapCreditError(error);
      }
      return hydrationResult(hydrated, args.provider);
    }
    throw new TarotCreditAuthorizationError("in_progress", "This Tarot reading is already being prepared.");
  }

  const racedStored = await args.repository.getLatestReadingForOwner(args.sessionId, args.owner);
  if (racedStored) {
    const hydrated = await hydrateStoredTarotReading({ repository: args.repository, owner: args.owner, sessionId: args.sessionId, locale: args.locale, stored: racedStored });
    try {
      await args.creditStore.consumeReservation({ owner: ownerForCredits, reservationId: reservation.id, resultType: "tarot_reading", resultId: hydrated?.readingId });
    } catch (error) {
      throw mapCreditError(error);
    }
    return hydrationResult(hydrated, args.provider);
  }

  let generated: GeneratedTarotReading;
  try {
    generated = await generateTarotReading({
      repository: args.repository,
      owner: args.owner,
      sessionId: args.sessionId,
      locale: args.locale,
      provider: args.provider,
      onProviderFailure: args.onProviderFailure,
    });
  } catch (error) {
    const saved = await args.repository.getLatestReadingForOwner(args.sessionId, args.owner);
    if (saved) {
      const hydrated = await hydrateStoredTarotReading({ repository: args.repository, owner: args.owner, sessionId: args.sessionId, locale: args.locale, stored: saved });
      try {
        await args.creditStore.consumeReservation({ owner: ownerForCredits, reservationId: reservation.id, resultType: "tarot_reading", resultId: hydrated?.readingId });
      } catch (consumeError) {
        throw mapCreditError(consumeError);
      }
      return hydrationResult(hydrated, args.provider);
    }
    try {
      await args.creditStore.releaseReservation({ owner: ownerForCredits, reservationId: reservation.id, reason: "Tarot provider or persistence failed" });
    } catch (releaseError) {
      throw new TarotCreditAuthorizationError("unavailable", "Credit reservation could not be released safely.", { cause: releaseError });
    }
    throw error;
  }

  try {
    await args.creditStore.consumeReservation({ owner: ownerForCredits, reservationId: reservation.id, resultType: "tarot_reading", resultId: generated.readingId });
  } catch (error) {
    throw mapCreditError(error);
  }
  return generated;
}
