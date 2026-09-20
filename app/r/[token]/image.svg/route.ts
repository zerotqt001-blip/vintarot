import { getProductionShareService } from "@/lib/tarot-share-runtime";
import { generateShareQrSvg } from "@/lib/tarot-share-qr";
import { ShareServiceUnavailableError } from "@/lib/tarot-share-service";
import { isShareToken } from "@/lib/tarot-share-identity";
import { renderShareImage } from "@/lib/tarot-share-image";
import { shareHeaders, shareNotFoundResponse, shareUnavailableResponse } from "@/lib/tarot-share-http";
import { ShareStorageUnavailableError } from "@/lib/tarot-share-store";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(_request: Request, context: { params: Promise<{ token: string }> }): Promise<Response> {
  const { token } = await context.params;
  if (!isShareToken(token)) return shareNotFoundResponse();
  try {
    const service = getProductionShareService();
    const view = await service.resolvePublicShare(token);
    if (!view) return shareNotFoundResponse();
    const origin = new URL(view.publicUrl).origin;
    const qrSvg = await generateShareQrSvg(token, { origin });
    const image = renderShareImage(view, { qrSvg });
    return new Response(image.bytes as unknown as BodyInit, {
      status: 200,
      headers: shareHeaders({
        "Content-Type": image.contentType,
        "Content-Disposition": "inline; filename=\"natarot-shared-reading.svg\"",
      }),
    });
  } catch (error) {
    if (error instanceof ShareStorageUnavailableError || error instanceof ShareServiceUnavailableError) return shareUnavailableResponse();
    return shareUnavailableResponse();
  }
}
