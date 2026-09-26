import { createTarotAIProvider } from "@/lib/ai/factory";
import { boundary, db, json, originCheck } from "@/lib/server";
import { readOptionalOwner } from "@/lib/tarot-guest";
import { runtimeEnv } from "@/lib/runtime";
import { handleTarotReadingRoute, type TarotReadingLogEvent } from "@/lib/tarot-reading-route";
import { getStoredTarotReadingForOwner, type TarotProviderFailureEvent } from "@/lib/tarot-reading-service";
import { getTarotRepository } from "@/lib/tarot-repository";
import { createCreditStore } from "@/lib/credits/repository";
import { generateMemberTarotReading, TarotCreditAuthorizationError } from "@/lib/tarot-credit-authorization";

function logTarotReadingEvent(event: TarotReadingLogEvent) {
  console.info("VinTarot Tarot reading", event);
}

function logTarotProviderFailure(event: TarotProviderFailureEvent, requestId: string) {
  logTarotReadingEvent({
    requestId,
    status: "failure",
    httpStatus: event.httpStatus ?? 503,
    failureCategory: "TAROT_AI_RESPONSE_INVALID",
    providerHttpStatus: event.httpStatus,
    provider: event.provider,
    modelName: event.modelName,
    promptVersion: event.promptVersion,
    attemptNumber: event.attemptNumber,
    failureStage: event.failureStage,
    expectedCardCount: event.expectedCardCount,
    actualCardEvidenceCount: event.actualCardEvidenceCount,
    schemaIssuePath: event.schemaIssuePath,
    schemaIssueCode: event.schemaIssueCode,
    retryScheduled: event.retryScheduled,
    latencyMs: event.latencyMs,
  });
}

export async function POST(req: Request) {
  const requestId = globalThis.crypto.randomUUID();
  return boundary(() => handleTarotReadingRoute({
    requestId,
    loadBody: async () => {
      originCheck(req);
      return json(req);
    },
    execute: async (input, metadata) => {
      const database = db();
      const { owner, member, setCookie } = await readOptionalOwner(req, database);
      const repository = getTarotRepository(database);
      if (!member) {
        const result = await getStoredTarotReadingForOwner({ repository, owner, sessionId: input.session_id, locale: input.locale });
        if (!result) throw new TarotCreditAuthorizationError("unauthenticated", "A member session is required for a new Tarot AI reading.");
        metadata.provider = result.provider;
        metadata.modelName = result.modelName;
        return { result, setCookie };
      }

      const result = await generateMemberTarotReading({
        database,
        creditStore: createCreditStore(database),
        repository,
        owner,
        sessionId: input.session_id,
        locale: input.locale,
        providerFactory: () => createTarotAIProvider(runtimeEnv as unknown as Record<string, string | undefined>),
        onProviderCreated: (provider) => {
          metadata.provider = provider.id;
          metadata.modelName = `${provider.id}:${provider.model}`;
        },
        onProviderFailure: (event) => logTarotProviderFailure(event, requestId),
      });
      return { result, setCookie };
    },
    log: logTarotReadingEvent,
  }));
}
