import { env } from "cloudflare:workers";
import { z } from "zod";
import { TarotAIError } from "@/lib/ai/provider";
import { createTarotAIProvider } from "@/lib/ai/factory";
import { TAROT_PROMPT_VERSION } from "@/lib/ai/prompts/tarot-reading";
import { boundary, db, json, originCheck } from "@/lib/server";
import { readOptionalOwner } from "@/lib/tarot-guest";
import { generateTarotReading, TarotReadingServiceError } from "@/lib/tarot-reading-service";
import { getTarotRepository } from "@/lib/tarot-repository";

const requestSchema = z.object({
  session_id: z.string().min(1).max(100),
  locale: z.enum(["en", "vi"]),
});

type TarotReadingLogEvent = {
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

function logTarotReadingEvent(event: TarotReadingLogEvent) {
  console.info("VinTarot Tarot reading", event);
}

function providerError(error: TarotAIError): Response {
  if (error.code === "configuration") {
    return Response.json({ error: "Tarot reading is not configured yet. Please try again later." }, { status: 503 });
  }
  return Response.json({ error: "Tarot reading is temporarily unavailable. Please try again." }, { status: 503 });
}

function serviceError(error: TarotReadingServiceError): Response {
  if (error.code === "not_found") return Response.json({ error: "Reading session not found." }, { status: 404 });
  if (error.code === "incomplete") return Response.json({ error: "This reading is not ready to interpret." }, { status: 409 });
  return Response.json({ error: "The Tarot reading could not be saved. Please try again." }, { status: 503 });
}

export async function POST(req: Request) {
  return boundary(async () => {
    const startedAt = Date.now();
    let sessionId: string | undefined;
    let providerId: string | undefined;
    let modelName: string | undefined;
    try {
      originCheck(req);
      const parsed = requestSchema.safeParse(await json(req));
      if (!parsed.success) {
        logTarotReadingEvent({
          status: "failure",
          httpStatus: 400,
          failureCategory: "invalid_request",
          promptVersion: TAROT_PROMPT_VERSION,
          latencyMs: Date.now() - startedAt,
        });
        return Response.json({ error: "Invalid Tarot reading request." }, { status: 400 });
      }
      sessionId = parsed.data.session_id;

      const { owner, setCookie } = await readOptionalOwner(req);
      const provider = createTarotAIProvider(env as unknown as Record<string, string | undefined>);
      providerId = provider.id;
      modelName = `${provider.id}:${provider.model}`;
      const result = await generateTarotReading({
        repository: getTarotRepository(db()),
        owner,
        sessionId: parsed.data.session_id,
        locale: parsed.data.locale,
        provider,
      });

      const headers = new Headers({ "Content-Type": "application/json" });
      if (setCookie) headers.set("Set-Cookie", setCookie);
      logTarotReadingEvent({
        status: "success",
        httpStatus: 200,
        sessionId: result.sessionId,
        provider: result.provider,
        modelName: result.modelName,
        promptVersion: result.promptVersion,
        cardCount: result.reading.cards.length,
        latencyMs: Date.now() - startedAt,
      });
      return new Response(JSON.stringify({
        session_id: result.sessionId,
        locale: result.locale,
        source: result.source,
        provider: result.provider,
        model_name: result.modelName,
        prompt_version: result.promptVersion,
        reading: result.reading,
      }), { status: 200, headers });
    } catch (error) {
      if (error instanceof Response) {
        logTarotReadingEvent({
          status: "failure",
          httpStatus: error.status,
          failureCategory: "request_rejected",
          sessionId,
          provider: providerId,
          modelName,
          promptVersion: TAROT_PROMPT_VERSION,
          latencyMs: Date.now() - startedAt,
        });
        throw error;
      }
      if (error instanceof TarotAIError) {
        const response = providerError(error);
        logTarotReadingEvent({
          status: "failure",
          httpStatus: response.status,
          failureCategory: `provider_${error.code}`,
          sessionId,
          provider: providerId,
          modelName,
          promptVersion: TAROT_PROMPT_VERSION,
          latencyMs: Date.now() - startedAt,
        });
        return response;
      }
      if (error instanceof TarotReadingServiceError) {
        const response = serviceError(error);
        logTarotReadingEvent({
          status: "failure",
          httpStatus: response.status,
          failureCategory: `service_${error.code}`,
          sessionId,
          provider: providerId,
          modelName,
          promptVersion: TAROT_PROMPT_VERSION,
          latencyMs: Date.now() - startedAt,
        });
        return response;
      }
      logTarotReadingEvent({
        status: "failure",
        httpStatus: 503,
        failureCategory: "unexpected",
        sessionId,
        provider: providerId,
        modelName,
        promptVersion: TAROT_PROMPT_VERSION,
        latencyMs: Date.now() - startedAt,
      });
      return Response.json({ error: "Could not complete this request. Your input has been kept; please try again." }, { status: 503 });
    }
  });
}
