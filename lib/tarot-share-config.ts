import { assertShareToken } from "./tarot-share-identity";

export const DEFAULT_NATAROT_PUBLIC_ORIGIN = "https://natarot.com";

export type PublicOriginEnvironment = {
  NATAROT_PUBLIC_ORIGIN?: string;
};

function processEnvironment(): PublicOriginEnvironment {
  return typeof process === "undefined" ? {} : { NATAROT_PUBLIC_ORIGIN: process.env.NATAROT_PUBLIC_ORIGIN };
}

/** Accept only an explicit origin; an incoming Host header is deliberately not an input. */
export function resolvePublicOrigin(environment: PublicOriginEnvironment = processEnvironment()): string {
  const configured = environment.NATAROT_PUBLIC_ORIGIN?.trim();
  if (!configured) return DEFAULT_NATAROT_PUBLIC_ORIGIN;

  try {
    const url = new URL(configured);
    if ((url.protocol !== "https:" && url.protocol !== "http:") || url.username || url.password || url.search || url.hash) {
      return DEFAULT_NATAROT_PUBLIC_ORIGIN;
    }
    if (url.pathname !== "/" && url.pathname !== "") return DEFAULT_NATAROT_PUBLIC_ORIGIN;
    return url.origin;
  } catch {
    return DEFAULT_NATAROT_PUBLIC_ORIGIN;
  }
}

export function buildPublicShareUrl(token: string, origin?: string): string {
  assertShareToken(token);
  return `${resolvePublicOrigin({ NATAROT_PUBLIC_ORIGIN: origin })}/r/${token}`;
}

export function buildShareImageUrl(token: string, origin?: string): string {
  assertShareToken(token);
  return `${resolvePublicOrigin({ NATAROT_PUBLIC_ORIGIN: origin })}/r/${token}/image.svg`;
}
