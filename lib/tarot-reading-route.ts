import { z } from "zod";
import { TAROT_PROMPT_VERSION } from "./ai/prompts/tarot-reading";
import { TarotAIError } from "./ai/provider";
import { noStoreResponse } from "./request-identity";
import type { GeneratedTarotReading } from "./tarot-reading-service";
import { TarotReadingServiceError } from "./tarot-reading-service";

const requestSchema = z.object({
  session_id: z.string().min(1).max(100),
  locale: z.enum(["en", "vi"]),
});

export type TarotReadingRequest = z.infer<typeof requestSchema>;

export type TarotReadingLogEvent = {
  status: "success" | "failure";
  httpStatus: number;
  failureCategory?: string;
  sessionId?: string;
  provider?: string;
  modelName?: string;
  promptVersion: string;
  cardCount?: number;
  latencyMs: number;
};

export type TarotReadingExecutionMetadata = {
  provider?: string;
  modelName?: string;
};

type HandleTarotReadingRouteArgs = {
  loadBody: () => Promise<unknown>;
  execute: (
    input: TarotReadingRequest,
    metadata: TarotReadingExecutionMetadata,
  ) => Promise<{ result: GeneratedTarotReading; setCookie?: string }>;
  log: (event: TarotReadingLogEvent) => void;
  now?: () => number;
};

function providerError(error: TarotAIError): Response {
  if (error.code === "configuration") {
    return noStoreResponse(Response.json({ error: "Tarot reading is not configured yet. Please try again later." }, { status: 503 }));
  }
  return noStoreResponse(Response.json({ error: "Tarot reading is temporarily unavailable. Please try again." }, { status: 503 }));
}

function serviceError(error: TarotReadingServiceError): Response {
  if (error.code === "not_found") return noStoreResponse(Response.json({ error: "Reading session not found." }, { status: 404 }));
  if (error.code === "incomplete") return noStoreResponse(Response.json({ error: "This reading is not ready to interpret." }, { status: 409 }));
  return noStoreResponse(Response.json({ error: "The Tarot reading could not be saved. Please try again." }, { status: 503 }));
}

export async function handleTarotReadingRoute(args: HandleTarotReadingRouteArgs): Promise<Response> {
  const now = args.now ?? Date.now;
  const startedAt = now();
  let sessionId: string | undefined;
  const metadata: TarotReadingExecutionMetadata = {};

  const log = (event: Omit<TarotReadingLogEvent, "promptVersion" | "latencyMs">) => {
    args.log({
      ...event,
      promptVersion: TAROT_PROMPT_VERSION,
      latencyMs: now() - startedAt,
    });
  };

  try {
    const parsed = requestSchema.safeParse(await args.loadBody());
    if (!parsed.success) {
      log({ status: "failure", httpStatus: 400, failureCategory: "invalid_request" });
      return noStoreResponse(Response.json({ error: "Invalid Tarot reading request." }, { status: 400 }));
    }
    sessionId = parsed.data.session_id;

    const { result, setCookie } = await args.execute(parsed.data, metadata);
    const headers = new Headers({ "Content-Type": "application/json" });
    if (setCookie) headers.set("Set-Cookie", setCookie);
    log({
      status: "success",
      httpStatus: 200,
      sessionId: result.sessionId,
      provider: result.provider,
      modelName: result.modelName,
      cardCount: result.reading.cardEvidence.length,
    });
    return noStoreResponse(new Response(JSON.stringify({
      session_id: result.sessionId,
      reading_id: result.readingId,
      locale: result.locale,
      source: result.source,
      provider: result.provider,
      model_name: result.modelName,
      prompt_version: result.promptVersion,
      reading: result.reading,
    }), { status: 200, headers }));
  } catch (error) {
    if (error instanceof Response) {
      noStoreResponse(error);
      log({
        status: "failure",
        httpStatus: error.status,
        failureCategory: "request_rejected",
        sessionId,
        provider: metadata.provider,
        modelName: metadata.modelName,
      });
      throw error;
    }
    if (error instanceof TarotAIError) {
      const response = providerError(error);
      log({
        status: "failure",
        httpStatus: response.status,
        failureCategory: `provider_${error.code}`,
        sessionId,
        provider: metadata.provider,
        modelName: metadata.modelName,
      });
      return response;
    }
    if (error instanceof TarotReadingServiceError) {
      const response = serviceError(error);
      log({
        status: "failure",
        httpStatus: response.status,
        failureCategory: `service_${error.code}`,
        sessionId,
        provider: metadata.provider,
        modelName: metadata.modelName,
      });
      return response;
    }
    log({
      status: "failure",
      httpStatus: 503,
      failureCategory: "unexpected",
      sessionId,
      provider: metadata.provider,
      modelName: metadata.modelName,
    });
    return noStoreResponse(Response.json({ error: "Could not complete this request. Your input has been kept; please try again." }, { status: 503 }));
  }
}
