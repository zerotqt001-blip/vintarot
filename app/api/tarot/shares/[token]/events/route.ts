import { shareEventInputSchema } from "@/lib/tarot-share-contract";
import { checkShareRequestOrigin, readShareJson, shareHeaders, shareJson } from "@/lib/tarot-share-http";
import { getProductionShareService } from "@/lib/tarot-share-runtime";
import { isShareToken } from "@/lib/tarot-share-identity";

export const dynamic = "force-dynamic";

export async function POST(request: Request, context: { params: Promise<{ token: string }> }): Promise<Response> {
  try {
    checkShareRequestOrigin(request);
    const parsed = shareEventInputSchema.safeParse(await readShareJson(request));
    if (!parsed.success) return shareJson({ error: "Invalid share event." }, 400);
    const { token } = await context.params;
    if (isShareToken(token)) {
      try {
        await (await getProductionShareService()).recordEvent({ token, event: parsed.data });
      } catch {
        // Analytics is best-effort and must not reveal token existence or storage state.
      }
    }
    // Do not reveal whether a token exists; analytics is best-effort and migration-gated.
    return new Response(null, { status: 202, headers: shareHeaders() });
  } catch (error) {
    if (error instanceof Response) return error;
    return shareJson({ error: "Could not record share event." }, 503);
  }
}
