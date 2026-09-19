import { getChatGPTUser, type ChatGPTUser } from "@/app/chatgpt-auth";
import { readOptionalOwner, type ReadingOwner } from "@/lib/tarot-guest";

export type RequestIdentity = {
  kind: "user" | "guest";
  userId: string;
  displayName: string;
  email: string;
  fullName: string | null;
  owner: ReadingOwner;
  guestId?: string;
  setCookie?: string;
};

function authenticatedIdentity(user: ChatGPTUser): RequestIdentity {
  return {
    kind: "user",
    userId: user.userId,
    displayName: user.displayName,
    email: user.email,
    fullName: user.fullName,
    owner: { kind: "user", userId: user.userId },
  };
}

export async function readRequestIdentity(request: Request): Promise<RequestIdentity> {
  // The framework/platform helper is the only application authentication boundary.
  // Never promote arbitrary headers on a Request object to a user identity.
  try {
    const contextUser = await getChatGPTUser();
    if (contextUser) return authenticatedIdentity(contextUser);
  } catch {
    // Standalone Node requests do not have the ChatGPT request context.
  }

  const { owner, setCookie } = await readOptionalOwner(request);
  if (owner.kind === "user") {
    try {
      const contextUser = await getChatGPTUser();
      if (contextUser) return authenticatedIdentity(contextUser);
    } catch {
      // Fall through to a safe guest identity if the context cannot be read.
    }
  }

  const guestId = owner.kind === "guest" ? owner.guestId : `user-${owner.userId}`;
  return {
    kind: "guest",
    userId: `guest:${guestId}`,
    displayName: "Guest",
    email: "guest@local.invalid",
    fullName: "Guest",
    owner: { kind: "guest", guestId },
    guestId,
    setCookie,
  };
}

export function attachIdentityCookie(response: Response, identity: RequestIdentity): Response {
  if (identity.setCookie) response.headers.set("Set-Cookie", identity.setCookie);
  return response;
}
