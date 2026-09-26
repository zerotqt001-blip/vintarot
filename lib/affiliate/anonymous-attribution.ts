export const AFFILIATE_GUEST_COOKIE_NAME = "natarot_affiliate_guest";

const guestIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isAffiliateGuestId(value: string): boolean {
  return guestIdPattern.test(value);
}

export function newAffiliateGuestId(): string {
  return globalThis.crypto.randomUUID();
}

export function readAffiliateGuestId(request: Request): string | null {
  for (const part of (request.headers.get("cookie") ?? "").split(";")) {
    const separator = part.indexOf("=");
    if (separator < 0 || part.slice(0, separator).trim() !== AFFILIATE_GUEST_COOKIE_NAME) continue;
    const value = part.slice(separator + 1).trim();
    return isAffiliateGuestId(value) ? value : null;
  }
  return null;
}

export function requestUsesHttps(request: Request, trustForwardedFor = false): boolean {
  const forwardedProto = trustForwardedFor
    ? request.headers.get("x-forwarded-proto")?.split(",", 1)[0]?.trim().toLowerCase()
    : undefined;
  if (forwardedProto) return forwardedProto === "https";
  return new URL(request.url).protocol === "https:";
}

export function createAffiliateGuestCookie(guestId: string, expiresAt: number, now = Date.now(), secure = true): string {
  if (!isAffiliateGuestId(guestId)) throw new Error("Invalid anonymous Affiliate identity");
  const maxAge = Math.max(0, Math.ceil((expiresAt - now) / 1_000));
  return `${AFFILIATE_GUEST_COOKIE_NAME}=${guestId}; Path=/; Max-Age=${maxAge}; HttpOnly; SameSite=Lax${secure ? "; Secure" : ""}`;
}

export function clearAffiliateGuestCookie(secure = true): string {
  return `${AFFILIATE_GUEST_COOKIE_NAME}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax${secure ? "; Secure" : ""}`;
}
