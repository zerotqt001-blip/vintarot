import { createTarotAIProvider } from "@/lib/ai/factory";
import { boundary, db, json, originCheck } from "@/lib/server";
import { readOptionalOwner } from "@/lib/tarot-guest";
import { runtimeEnv } from "@/lib/runtime";
import { handleTarotReadingRoute, type TarotReadingLogEvent } from "@/lib/tarot-reading-route";
import { generateTarotReading, type TarotProviderFailureEvent } from "@/lib/tarot-reading-service";
import { getTarotRepository } from "@/lib/tarot-repository";

function logTarotReadingEvent(event: TarotReadingLogEvent) {
  console.info("VinTarot Tarot reading", event);
}

function logTarotProviderFailure(event: TarotProviderFailureEvent) {
  logTarotReadingEvent({
    status: "failure",
    httpStatus: event.httpStatus ?? 503,
    failureCategory: "provider_invalid_response",
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
  return boundary(() => handleTarotReadingRoute({
    loadBody: async () => {
      originCheck(req);
      return json(req);
    },
    execute: async (input, metadata) => {
      const { owner, setCookie } = await readOptionalOwner(req);
      const provider = createTarotAIProvider(runtimeEnv as unknown as Record<string, string | undefined>);
      metadata.provider = provider.id;
      metadata.modelName = `${provider.id}:${provider.model}`;
      const result = await generateTarotReading({
        repository: getTarotRepository(db()),
        owner,
        sessionId: input.session_id,
        locale: input.locale,
        provider,
        onProviderFailure: logTarotProviderFailure,
      });
      return { result, setCookie };
    },
    log: logTarotReadingEvent,
  }));
}
