import { createTarotAIProvider } from "@/lib/ai/factory";
import { boundary, db, json, originCheck } from "@/lib/server";
import { readOptionalOwner } from "@/lib/tarot-guest";
import { runtimeEnv } from "@/lib/runtime";
import { handleTarotFollowUpRoute, type TarotFollowUpLogEvent } from "@/lib/tarot-follow-up-route";
import { generateTarotFollowUp } from "@/lib/tarot-follow-up-service";
import { getTarotRepository } from "@/lib/tarot-repository";
import { createCreditStore } from "@/lib/credits/repository";
import { assertPaidMemberTarotSession, TarotCreditAuthorizationError } from "@/lib/tarot-credit-authorization";

function logTarotFollowUpEvent(event: TarotFollowUpLogEvent) {
  console.info("VinTarot Tarot follow-up", event);
}

export async function POST(req: Request) {
  return boundary(() => handleTarotFollowUpRoute({
    loadBody: async () => {
      originCheck(req);
      return json(req);
    },
    execute: async (input, metadata) => {
      const database = db();
      const { owner, member, setCookie } = await readOptionalOwner(req, database);
      const repository = getTarotRepository(database);
      if (!member) {
        throw new TarotCreditAuthorizationError("unauthenticated", "A trusted member session is required.");
      }
      await assertPaidMemberTarotSession({ creditStore: createCreditStore(database), repository, owner, sessionId: input.session_id });
      const provider = createTarotAIProvider(runtimeEnv as unknown as Record<string, string | undefined>);
      metadata.provider = provider.id;
      metadata.modelName = `${provider.id}:${provider.model}`;
      const result = await generateTarotFollowUp({
        repository,
        owner,
        sessionId: input.session_id,
        locale: input.locale,
        followUpQuestion: input.follow_up_question,
        provider,
      });
      return { result, setCookie };
    },
    log: logTarotFollowUpEvent,
  }));
}
