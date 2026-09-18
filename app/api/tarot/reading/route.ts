import { env } from "cloudflare:workers";
import { createTarotAIProvider } from "@/lib/ai/factory";
import { boundary, db, json, originCheck } from "@/lib/server";
import { readOptionalOwner } from "@/lib/tarot-guest";
import { handleTarotReadingRoute, type TarotReadingLogEvent } from "@/lib/tarot-reading-route";
import { generateTarotReading } from "@/lib/tarot-reading-service";
import { getTarotRepository } from "@/lib/tarot-repository";

function logTarotReadingEvent(event: TarotReadingLogEvent) {
  console.info("VinTarot Tarot reading", event);
}

export async function POST(req: Request) {
  return boundary(() => handleTarotReadingRoute({
    loadBody: async () => {
      originCheck(req);
      return json(req);
    },
    execute: async (input, metadata) => {
      const { owner, setCookie } = await readOptionalOwner(req);
      const provider = createTarotAIProvider(env as unknown as Record<string, string | undefined>);
      metadata.provider = provider.id;
      metadata.modelName = `${provider.id}:${provider.model}`;
      const result = await generateTarotReading({
        repository: getTarotRepository(db()),
        owner,
        sessionId: input.session_id,
        locale: input.locale,
        provider,
      });
      return { result, setCookie };
    },
    log: logTarotReadingEvent,
  }));
}
