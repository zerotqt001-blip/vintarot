import { getChatGPTUser } from "@/app/chatgpt-auth";

export const GUEST_COOKIE_NAME = "vintarot_guest";
const GUEST_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;
const guestIdPattern = /^[A-Za-z0-9._-]{8,200}$/;

export type ReadingOwner =
  | { kind: "user"; userId: string }
  | { kind: "guest"; guestId: string };

export type GuestIdentity = {
  guestId: string;
  setCookie: string;
};

export function createGuestIdentity(guestId = globalThis.crypto.randomUUID(), secure = true): GuestIdentity {
  if (!guestIdPattern.test(guestId)) throw new Error("Invalid guest identity");
  return {
    guestId,
    setCookie: `${GUEST_COOKIE_NAME}=${guestId}; Path=/; Max-Age=${GUEST_COOKIE_MAX_AGE}; HttpOnly; SameSite=Lax${secure ? "; Secure" : ""}`,
  };
}

export function readGuestId(request: Request): string | null {
  const cookie = request.headers.get("cookie") || "";
  for (const part of cookie.split(";")) {
    const [name, ...valueParts] = part.trim().split("=");
    if (name !== GUEST_COOKIE_NAME) continue;
    const value = valueParts.join("=");
    return guestIdPattern.test(value) ? value : null;
  }
  return null;
}

function requestUsesHttps(request: Request): boolean {
  const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",", 1)[0]?.trim().toLowerCase();
  if (forwardedProto) return forwardedProto === "https";
  return new URL(request.url).protocol === "https:";
}

export async function readOptionalOwner(request: Request): Promise<{ owner: ReadingOwner; setCookie?: string }> {
  let user: Awaited<ReturnType<typeof getChatGPTUser>> = null;
  try {
    user = await getChatGPTUser();
  } catch {
    user = null;
  }
  if (user) return { owner: { kind: "user", userId: user.userId } };

  const existingGuestId = readGuestId(request);
  if (existingGuestId) return { owner: { kind: "guest", guestId: existingGuestId } };

  const identity = createGuestIdentity(undefined, requestUsesHttps(request));
  return { owner: { kind: "guest", guestId: identity.guestId }, setCookie: identity.setCookie };
}

export function ownerMatches(owner: ReadingOwner, row: { userId?: string | null; guestId?: string | null }): boolean {
  return owner.kind === "user" ? row.userId === owner.userId : row.guestId === owner.guestId;
}
