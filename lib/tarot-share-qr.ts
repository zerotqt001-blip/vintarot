import QRCode from "qrcode";
import { buildPublicShareUrl, resolvePublicOrigin } from "./tarot-share-config";
import { assertShareToken } from "./tarot-share-identity";

export const SHARE_QR_WIDTH = 218;
export const SHARE_QR_ERROR_CORRECTION = "M" as const;
export const SHARE_QR_MARGIN = 4;

export function buildShareQrPayload(token: string, origin?: string): string {
  assertShareToken(token);
  return buildPublicShareUrl(token, resolvePublicOrigin({ NATAROT_PUBLIC_ORIGIN: origin }));
}

/** Keep QR generation server-side and deterministic; the user cannot control colors/options. */
export async function generateShareQrSvg(token: string, options: { origin?: string } = {}): Promise<string> {
  const payload = buildShareQrPayload(token, options.origin);
  return QRCode.toString(payload, {
    type: "svg",
    errorCorrectionLevel: SHARE_QR_ERROR_CORRECTION,
    margin: SHARE_QR_MARGIN,
    width: SHARE_QR_WIDTH,
    color: {
      dark: "#10283b",
      light: "#f4ebdd",
    },
  });
}
