import { z } from "zod";
import { TAROT_PROMPT_VERSION } from "./ai/prompts/tarot-reading";
import { TarotAIError } from "./ai/provider";
import { classifyTarotAIError, classifyTarotCreditFailure, classifyTarotServiceFailure, type TarotAIFailureCategory } from "./ai/readiness";
import { noStoreResponse } from "./request-identity";
import { TarotCreditAuthorizationError } from "./tarot-credit-authorization";
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
  requestId: string;
  failureCategory?: TarotAIFailureCategory | "invalid_request";
  providerHttpStatus?: number;
  provider?: string;
  modelName?: string;
  promptVersion: string;
  cardCount?: number;
  attemptNumber?: number;
  failureStage?: string;
  expectedCardCount?: number;
  actualCardEvidenceCount?: number;
  schemaIssuePath?: string;
  schemaIssueCode?: string;
  retryScheduled?: boolean;
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
  requestId?: string;
  now?: () => number;
};

function withRequestId(response: Response, requestId: string): Response {
  response.headers.set("X-Request-Id", requestId);
  return response;
}

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

function creditError(error: TarotCreditAuthorizationError): Response {
  if (error.code === "insufficient") return noStoreResponse(Response.json({ error: "You need more credits for this Tarot reading." }, { status: 402 }));
  if (error.code === "in_progress") return noStoreResponse(Response.json({ error: "This Tarot reading is already being prepared." }, { status: 409 }));
  if (error.code === "conflict") return noStoreResponse(Response.json({ error: "This Tarot reading request conflicts with an existing request." }, { status: 409 }));
  return noStoreResponse(Response.json({ error: "Credit authorization is temporarily unavailable. Please try again." }, { status: 503 }));
}

export async function handleTarotReadingRoute(args: HandleTarotReadingRouteArgs): Promise<Response> {
  const now = args.now ?? Date.now;
  const startedAt = now();
  const requestId = args.requestId ?? globalThis.crypto.randomUUID();
  const metadata: TarotReadingExecutionMetadata = {};

  const log = (event: Omit<TarotReadingLogEvent, "requestId" | "promptVersion" | "latencyMs">) => {
    args.log({
      ...event,
      requestId,
      promptVersion: TAROT_PROMPT_VERSION,
      latencyMs: now() - startedAt,
    });
  };

  try {
    const parsed = requestSchema.safeParse(await args.loadBody());
    if (!parsed.success) {
      log({ status: "failure", httpStatus: 400, failureCategory: "invalid_request" });
      return withRequestId(noStoreResponse(Response.json({ error: "Invalid Tarot reading request." }, { status: 400 })), requestId);
    }

    const { result, setCookie } = await args.execute(parsed.data, metadata);
    const headers = new Headers({ "Content-Type": "application/json" });
    if (setCookie) headers.set("Set-Cookie", setCookie);
    log({
      status: "success",
      httpStatus: 200,
      provider: result.provider,
      modelName: result.modelName,
      cardCount: result.reading.cardEvidence.length,
    });
    return withRequestId(noStoreResponse(new Response(JSON.stringify({
      session_id: result.sessionId,
      reading_id: result.readingId,
      locale: result.locale,
      source: result.source,
      provider: result.provider,
      model_name: result.modelName,
      prompt_version: result.promptVersion,
      reading: result.reading,
    }), { status: 200, headers })), requestId);
  } catch (error) {
    if (error instanceof Response) {
      withRequestId(noStoreResponse(error), requestId);
      log({
        status: "failure",
        httpStatus: error.status,
        failureCategory: "TAROT_AI_REQUEST_REJECTED",
        provider: metadata.provider,
        modelName: metadata.modelName,
      });
      throw error;
    }
    if (error instanceof TarotAIError) {
      const response = withRequestId(providerError(error), requestId);
      log({
        status: "failure",
        httpStatus: response.status,
        failureCategory: classifyTarotAIError(error),
        ...(error.httpStatus === undefined ? {} : { providerHttpStatus: error.httpStatus }),
        provider: metadata.provider,
        modelName: metadata.modelName,
        ...(error.failureStage ? {
          failureStage: error.failureStage,
          expectedCardCount: error.expectedCardCount,
          actualCardEvidenceCount: error.actualCardEvidenceCount,
          schemaIssuePath: error.schemaIssuePath,
          schemaIssueCode: error.schemaIssueCode,
        } : {}),
      });
      return response;
    }
    if (error instanceof TarotCreditAuthorizationError) {
      const response = withRequestId(creditError(error), requestId);
      log({
        status: "failure",
        httpStatus: response.status,
        failureCategory: classifyTarotCreditFailure(error.code),
        provider: metadata.provider,
        modelName: metadata.modelName,
      });
      return response;
    }
    if (error instanceof TarotReadingServiceError) {
      const response = withRequestId(serviceError(error), requestId);
      log({
        status: "failure",
        httpStatus: response.status,
        failureCategory: classifyTarotServiceFailure(error.code),
        provider: metadata.provider,
        modelName: metadata.modelName,
      });
      return response;
    }
    log({
      status: "failure",
      httpStatus: 503,
      failureCategory: "TAROT_AI_UNEXPECTED",
      provider: metadata.provider,
      modelName: metadata.modelName,
    });
    return withRequestId(noStoreResponse(Response.json({ error: "Could not complete this request. Your input has been kept; please try again." }, { status: 503 })), requestId);
  }
}
