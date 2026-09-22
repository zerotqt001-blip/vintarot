import { createTarotAIProvider } from "@/lib/ai/factory";
import { boundary, db, json, originCheck } from "@/lib/server";
import { readOptionalOwner } from "@/lib/tarot-guest";
import { runtimeEnv } from "@/lib/runtime";
import { handleTarotReadingRoute, type TarotReadingLogEvent } from "@/lib/tarot-reading-route";
import { generateTarotReading, type TarotProviderFailureEvent } from "@/lib/tarot-reading-service";
import { getTarotRepository } from "@/lib/tarot-repository";
import { createCreditStore } from "@/lib/credits/repository";
import { generateMemberTarotReading } from "@/lib/tarot-credit-authorization";

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
      const provider = createTarotAIProvider(runtimeEnv as unknown as Record<string, string | undefined>);
      metadata.provider = provider.id;
      metadata.modelName = `${provider.id}:${provider.model}`;
      const repository = getTarotRepository(database);
      const result = member
        ? await generateMemberTarotReading({
          database,
          creditStore: createCreditStore(database),
          repository,
          owner,
          sessionId: input.session_id,
          locale: input.locale,
          provider,
          onProviderFailure: (event) => logTarotProviderFailure(event, requestId),
        })
        : await generateTarotReading({
          repository,
          owner,
          sessionId: input.session_id,
          locale: input.locale,
          provider,
          onProviderFailure: (event) => logTarotProviderFailure(event, requestId),
        });
      return { result, setCookie };
    },
    log: logTarotReadingEvent,
  }));
}
