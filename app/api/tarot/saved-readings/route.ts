import { z } from "zod";
import { attachIdentityCookie, boundary, db, identity, json, originCheck } from "@/lib/server";
import { getTarotRepository } from "@/lib/tarot-repository";
import {
  listTarotSavedReadings,
  loadTarotSavedReading,
  saveTarotReading,
  SavedReadingError,
} from "@/lib/tarot-saved-reading";

const saveRequestSchema = z.object({
  reading_id: z.string().min(1).max(100),
  session_id: z.string().min(1).max(100),
}).strict();

function errorPayload(error: SavedReadingError): { body: { error: string }; status: number } {
  if (error.code === "unauthenticated") return { body: { error: "Sign in to save this reading." }, status: 401 };
  if (error.code === "not_found") return { body: { error: "Saved Tarot reading not found." }, status: 404 };
  if (error.code === "invalid_stored_reading") return { body: { error: "This saved Tarot reading is temporarily unavailable." }, status: 409 };
  return { body: { error: "The saved Tarot reading could not be loaded. Please try again." }, status: 503 };
}

export async function GET(req: Request) {
  return boundary(async () => {
    const requestIdentity = await identity(req);
    const respond = (body: unknown, init?: ResponseInit) => attachIdentityCookie(Response.json(body, init), requestIdentity);
    if (requestIdentity.kind !== "user") return respond({ error: "Sign in to open saved readings." }, { status: 401 });

    const repository = getTarotRepository(db());
    try {
      const id = new URL(req.url).searchParams.get("id");
      if (id) return respond(await loadTarotSavedReading({ database: db(), repository, owner: requestIdentity.owner, savedId: id }));
      return respond({ items: await listTarotSavedReadings({ database: db(), repository, owner: requestIdentity.owner }) });
    } catch (error) {
      if (error instanceof SavedReadingError) {
        const mapped = errorPayload(error);
        return respond(mapped.body, { status: mapped.status });
      }
      throw error;
    }
  });
}

export async function POST(req: Request) {
  return boundary(async () => {
    originCheck(req);
    const requestIdentity = await identity(req);
    const respond = (body: unknown, init?: ResponseInit) => attachIdentityCookie(Response.json(body, init), requestIdentity);
    if (requestIdentity.kind !== "user") return respond({ error: "Sign in to save this reading." }, { status: 401 });

    const parsed = saveRequestSchema.safeParse(await json(req));
    if (!parsed.success) return respond({ error: "A reading and session are required." }, { status: 400 });

    try {
      const savedReading = await saveTarotReading({
        database: db(),
        repository: getTarotRepository(db()),
        owner: requestIdentity.owner,
        sessionId: parsed.data.session_id,
        readingId: parsed.data.reading_id,
      });
      return respond({ saved_reading: savedReading });
    } catch (error) {
      if (error instanceof SavedReadingError) {
        const mapped = errorPayload(error);
        return respond(mapped.body, { status: mapped.status });
      }
      throw error;
    }
  });
}
