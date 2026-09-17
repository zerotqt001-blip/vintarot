import { env } from "cloudflare:workers";
import { z } from "zod";
import { boundary, db, json, originCheck } from "@/lib/server";
import { getTarotRepository } from "@/lib/tarot-repository";
import { readOptionalOwner } from "@/lib/tarot-guest";
import { buildLocalReading, createInterpretationProvider, parseReadingPayload, PROMPT_VERSION, type InterpretationCardInput, type InterpretationResult } from "@/lib/tarot-interpretation";

const requestSchema = z.object({ session_id: z.string().min(1).max(100), locale: z.enum(["en", "vi"]) });

function providerConfig() {
  const runtimeEnv = env as unknown as Record<string, string | undefined>;
  if (!runtimeEnv.TAROT_AI_URL || !runtimeEnv.TAROT_AI_KEY || !runtimeEnv.TAROT_AI_MODEL) return null;
  return { url: runtimeEnv.TAROT_AI_URL, apiKey: runtimeEnv.TAROT_AI_KEY, model: runtimeEnv.TAROT_AI_MODEL, timeoutMs: 12000 };
}

export async function POST(req: Request) {
  return boundary(async () => {
    originCheck(req);
    const parsed = requestSchema.safeParse(await json(req));
    if (!parsed.success) return Response.json({ error: "Invalid Tarot interpretation request." }, { status: 400 });
    const { owner } = await readOptionalOwner(req);
    const repository = getTarotRepository(db());
    const session = await repository.getSessionForOwner(parsed.data.session_id, owner);
    if (!session) return Response.json({ error: "Reading session not found." }, { status: 404 });
    if (session.cards.length !== session.session.cardCount) return Response.json({ error: "This reading is not ready to interpret." }, { status: 409 });

    const cards: InterpretationCardInput[] = [];
    for (const card of session.cards) {
      const orientation = card.orientation === "reversed" ? "reversed" : "upright";
      const meaning = await repository.getMeaning(card.cardId, parsed.data.locale, orientation);
      if (!meaning) return Response.json({ error: "A card meaning is not available yet." }, { status: 503 });
      cards.push({
        readingCardId: card.id,
        positionKey: card.positionKey,
        positionLabel: card.positionLabel,
        positionPrompt: card.positionPrompt,
        orientation,
        meaning,
      });
    }

    const localInput = { locale: parsed.data.locale, question: session.session.question, optionalContext: session.session.optionalContext, cards };
    let result: InterpretationResult = buildLocalReading(localInput);
    const config = providerConfig();
    const provider = createInterpretationProvider(config);
    if (provider && config) {
      try {
        const raw = await provider(localInput);
        result = { source: "ai", modelName: config.model, promptVersion: PROMPT_VERSION, reading: parseReadingPayload(raw, cards.map((card) => card.readingCardId)) };
      } catch {
        result = buildLocalReading(localInput);
      }
    }

    await repository.saveReading({ id: globalThis.crypto.randomUUID(), sessionId: parsed.data.session_id, reading: result.reading, modelName: result.modelName, promptVersion: result.promptVersion });
    return Response.json({ session_id: parsed.data.session_id, locale: parsed.data.locale, source: result.source, model_name: result.modelName, prompt_version: result.promptVersion, reading: result.reading });
  });
}

