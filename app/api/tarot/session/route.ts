import { boundary, db } from "@/lib/server";
import { getTarotRepository } from "@/lib/tarot-repository";
import { readOptionalOwner } from "@/lib/tarot-guest";

export async function GET(req: Request) {
  return boundary(async () => {
    const sessionId = new URL(req.url).searchParams.get("id");
    if (!sessionId || sessionId.length > 100) return Response.json({ error: "A reading session is required." }, { status: 400 });
    const { owner } = await readOptionalOwner(req);
    const result = await getTarotRepository(db()).getSessionForOwner(sessionId, owner);
    if (!result) return Response.json({ error: "Reading session not found." }, { status: 404 });
    return Response.json({ session: result.session, cards: result.cards });
  });
}
