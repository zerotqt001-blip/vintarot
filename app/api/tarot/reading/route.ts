import { env } from "cloudflare:workers";
import { z } from "zod";
import { TarotAIError } from "@/lib/ai/provider";
import { createTarotAIProvider } from "@/lib/ai/factory";
import { boundary, db, json, originCheck } from "@/lib/server";
import { readOptionalOwner } from "@/lib/tarot-guest";
import { generateTarotReading, TarotReadingServiceError } from "@/lib/tarot-reading-service";
import { getTarotRepository } from "@/lib/tarot-repository";

const requestSchema = z.object({
  session_id: z.string().min(1).max(100),
  locale: z.enum(["en", "vi"]),
});

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
    try {
      originCheck(req);
      const parsed = requestSchema.safeParse(await json(req));
      if (!parsed.success) return Response.json({ error: "Invalid Tarot reading request." }, { status: 400 });

      const { owner, setCookie } = await readOptionalOwner(req);
      const provider = createTarotAIProvider(env as unknown as Record<string, string | undefined>);
      const result = await generateTarotReading({
        repository: getTarotRepository(db()),
        owner,
        sessionId: parsed.data.session_id,
        locale: parsed.data.locale,
        provider,
      });

      const headers = new Headers({ "Content-Type": "application/json" });
      if (setCookie) headers.set("Set-Cookie", setCookie);
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
      if (error instanceof TarotAIError) return providerError(error);
      if (error instanceof TarotReadingServiceError) return serviceError(error);
      throw error;
    }
  });
}
