import { z } from "zod";
import { MAX_TAROT_FOLLOW_UP_QUESTION_LENGTH, TAROT_CLARIFICATION_PROMPT_VERSION } from "./ai/prompts/tarot-reading";
import { TarotAIError } from "./ai/provider";
import type { GeneratedTarotClarification } from "./tarot-clarification-service";
import { TarotClarificationServiceError } from "./tarot-clarification-service";
import { noStoreResponse } from "./request-identity";
import { TarotCreditAuthorizationError } from "./tarot-credit-authorization";

const requestSchema = z.object({
  session_id: z.string().min(1).max(100),
  locale: z.enum(["en", "vi"]),
  question: z.string().trim().min(1).max(MAX_TAROT_FOLLOW_UP_QUESTION_LENGTH),
  request_id: z.string().trim().min(1).max(100),
}).strict();

export type TarotClarificationRequest = z.infer<typeof requestSchema>;

export type TarotClarificationLogEvent = {
  status: "success" | "failure";
  httpStatus: number;
  failureCategory?: string;
  sessionId?: string;
  provider?: string;
  modelName?: string;
  promptVersion: typeof TAROT_CLARIFICATION_PROMPT_VERSION;
  questionLength?: number;
  latencyMs: number;
};

export type TarotClarificationExecutionMetadata = {
  provider?: string;
  modelName?: string;
};

type HandleTarotClarificationRouteArgs = {
  loadBody: () => Promise<unknown>;
  execute: (input: TarotClarificationRequest, metadata: TarotClarificationExecutionMetadata) => Promise<{ result: GeneratedTarotClarification; setCookie?: string }>;
  log: (event: TarotClarificationLogEvent) => void;
  now?: () => number;
};

function providerError(error: TarotAIError): Response {
  if (error.code === "configuration") return Response.json({ error: "Tarot clarification is not configured yet. Please try again later." }, { status: 503 });
  return Response.json({ error: "Tarot clarification is temporarily unavailable. Please try again." }, { status: 503 });
}

function serviceError(error: TarotClarificationServiceError): Response {
  if (error.code === "not_found") return Response.json({ error: "Reading session not found." }, { status: 404 });
  if (error.code === "invalid_request") return Response.json({ error: "Invalid Tarot clarification request." }, { status: 400 });
  if (error.code === "limit") return Response.json({ error: "This reading has reached its clarification limit." }, { status: 409 });
  if (error.code === "persistence") return Response.json({ error: "The Tarot clarification could not be saved. Please try again." }, { status: 503 });
  return Response.json({ error: "This reading is not ready for clarification." }, { status: 409 });
}

function authorizationError(error: TarotCreditAuthorizationError): Response {
  if (error.code === "unauthenticated") return noStoreResponse(Response.json({ error: "Sign in to continue this Tarot reading." }, { status: 401 }));
  if (error.code === "reading_required") return noStoreResponse(Response.json({ error: "A completed Credit-backed Tarot reading is required for clarification." }, { status: 402 }));
  return noStoreResponse(Response.json({ error: "Tarot access is temporarily unavailable. Please try again." }, { status: 503 }));
}

export async function handleTarotClarificationRoute(args: HandleTarotClarificationRouteArgs): Promise<Response> {
  const now = args.now ?? Date.now;
  const startedAt = now();
  let sessionId: string | undefined;
  const metadata: TarotClarificationExecutionMetadata = {};
  const log = (event: Omit<TarotClarificationLogEvent, "promptVersion" | "latencyMs">) => args.log({
    ...event,
    promptVersion: TAROT_CLARIFICATION_PROMPT_VERSION,
    latencyMs: now() - startedAt,
  });

  try {
    const parsed = requestSchema.safeParse(await args.loadBody());
    if (!parsed.success) {
      log({ status: "failure", httpStatus: 400, failureCategory: "invalid_request" });
      return Response.json({ error: "Invalid Tarot clarification request." }, { status: 400 });
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
      questionLength: parsed.data.question.length,
    });
    return new Response(JSON.stringify({
      session_id: result.sessionId,
      reading_id: result.readingId,
      locale: result.locale,
      source: result.source,
      provider: result.provider,
      model_name: result.modelName,
      prompt_version: result.promptVersion,
      clarification: result.clarification,
    }), { status: 200, headers });
  } catch (error) {
    if (error instanceof Response) {
      log({ status: "failure", httpStatus: error.status, failureCategory: "request_rejected", sessionId, provider: metadata.provider, modelName: metadata.modelName });
      throw error;
    }
    if (error instanceof TarotAIError) {
      const response = providerError(error);
      log({ status: "failure", httpStatus: response.status, failureCategory: `provider_${error.code}`, sessionId, provider: metadata.provider, modelName: metadata.modelName });
      return response;
    }
    if (error instanceof TarotCreditAuthorizationError) {
      const response = authorizationError(error);
      log({ status: "failure", httpStatus: response.status, failureCategory: `authorization_${error.code}`, sessionId, provider: metadata.provider, modelName: metadata.modelName });
      return response;
    }
    if (error instanceof TarotClarificationServiceError) {
      const response = serviceError(error);
      log({ status: "failure", httpStatus: response.status, failureCategory: `service_${error.code}`, sessionId, provider: metadata.provider, modelName: metadata.modelName });
      return response;
    }
    log({ status: "failure", httpStatus: 503, failureCategory: "unexpected", sessionId, provider: metadata.provider, modelName: metadata.modelName });
    return Response.json({ error: "Could not complete this request. Your input has been kept; please try again." }, { status: 503 });
  }
}
