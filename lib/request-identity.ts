import type { D1Database } from "@cloudflare/workers-types";
import type { MemberView } from "@/lib/member-auth";
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

function authenticatedIdentity(member: MemberView): RequestIdentity {
  const displayName = member.displayName ?? member.username;
  return {
    kind: "user",
    userId: `member:${member.id}`,
    displayName,
    email: member.email,
    fullName: member.displayName,
    owner: { kind: "user", userId: `member:${member.id}` },
  };
}

export async function readRequestIdentity(request: Request, database?: D1Database): Promise<RequestIdentity> {
  const { owner, member, setCookie } = await readOptionalOwner(request, database);
  if (member) return authenticatedIdentity(member);

  const guestId = owner.kind === "guest" ? owner.guestId : "unknown";
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
