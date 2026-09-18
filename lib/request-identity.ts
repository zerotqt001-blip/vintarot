import { getChatGPTUser, type ChatGPTUser } from "@/app/chatgpt-auth";
import { readOptionalOwner, type ReadingOwner } from "@/lib/tarot-guest";

const USER_ID_HEADER = "oai-authenticated-user-id";
const USER_EMAIL_HEADER = "oai-authenticated-user-email";
const USER_FULL_NAME_HEADER = "oai-authenticated-user-full-name";
const USER_FULL_NAME_ENCODING_HEADER = "oai-authenticated-user-full-name-encoding";
const PERCENT_ENCODED_UTF8 = "percent-encoded-utf-8";

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

function decodeFullName(headers: Headers): string | null {
  const encoded = headers.get(USER_FULL_NAME_HEADER);
  if (!encoded || headers.get(USER_FULL_NAME_ENCODING_HEADER) !== PERCENT_ENCODED_UTF8) return null;
  try {
    return decodeURIComponent(encoded);
  } catch {
    return null;
  }
}

function userFromRequestHeaders(headers: Headers): ChatGPTUser | null {
  const userId = headers.get(USER_ID_HEADER);
  const email = headers.get(USER_EMAIL_HEADER);
  if (!userId || !email) return null;
  const fullName = decodeFullName(headers);
  return { userId, displayName: fullName ?? email, email, fullName };
}

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
  const requestUser = userFromRequestHeaders(request.headers);
  if (requestUser) return authenticatedIdentity(requestUser);

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
