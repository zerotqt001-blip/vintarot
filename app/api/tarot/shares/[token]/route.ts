import { attachIdentityCookie, boundary, identity, originCheck } from "@/lib/server";
import { ShareServiceUnavailableError } from "@/lib/tarot-share-service";
import { getProductionShareService } from "@/lib/tarot-share-runtime";
import { isShareToken } from "@/lib/tarot-share-identity";
import { ShareStorageUnavailableError } from "@/lib/tarot-share-store";

function success(identityValue?: Awaited<ReturnType<typeof identity>>): Response {
  const response = new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
  return identityValue ? attachIdentityCookie(response, identityValue) : response;
}

export async function DELETE(request: Request, context: { params: Promise<{ token: string }> }): Promise<Response> {
  return boundary(async () => {
    originCheck(request);
    const { token } = await context.params;
    if (!isShareToken(token)) return success();
    const requestIdentity = await identity(request);
    try {
      await (await getProductionShareService()).revokeShareByToken({ token, owner: requestIdentity.owner });
      return success(requestIdentity);
    } catch (error) {
      if (error instanceof ShareStorageUnavailableError || error instanceof ShareServiceUnavailableError) {
        return Response.json({ error: "Share links are not configured." }, { status: 503, headers: { "Cache-Control": "no-store" } });
      }
      throw error;
    }
  });
}
