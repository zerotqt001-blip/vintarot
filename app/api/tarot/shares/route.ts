import { z } from "zod";
import { attachIdentityCookie, boundary, identity, json, originCheck } from "@/lib/server";
import { ShareAlreadyExistsError, ShareNotFoundError, ShareServiceUnavailableError } from "@/lib/tarot-share-service";
import { getProductionShareService } from "@/lib/tarot-share-runtime";
import { ShareStorageUnavailableError } from "@/lib/tarot-share-store";

const createShareSchema = z.object({
  reading_id: z.string().min(1).max(100),
  session_id: z.string().min(1).max(100),
}).strict();

function response(body: unknown, status = 200, identityValue?: Awaited<ReturnType<typeof identity>>): Response {
  const result = Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
  return identityValue ? attachIdentityCookie(result, identityValue) : result;
}

export async function POST(request: Request): Promise<Response> {
  return boundary(async () => {
    originCheck(request);
    const parsed = createShareSchema.safeParse(await json(request));
    if (!parsed.success) return response({ error: "A reading and session are required." }, 400);
    const requestIdentity = await identity(request);
    try {
      const created = await (await getProductionShareService()).createShare({
        owner: requestIdentity.owner,
        readingId: parsed.data.reading_id,
        sessionId: parsed.data.session_id,
      });
      return response({ share_url: created.publicUrl, image_url: created.imageUrl, created_at: created.createdAt }, 201, requestIdentity);
    } catch (error) {
      if (error instanceof ShareNotFoundError) return response({ error: "Reading not found." }, 404, requestIdentity);
      if (error instanceof ShareAlreadyExistsError) return response({ error: error.message }, 409, requestIdentity);
      if (error instanceof ShareStorageUnavailableError || error instanceof ShareServiceUnavailableError) return response({ error: "Share links are not configured." }, 503, requestIdentity);
      throw error;
    }
  });
}
