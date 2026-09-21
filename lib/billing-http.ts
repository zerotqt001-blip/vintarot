import type { D1Database } from "@cloudflare/workers-types";
import { readOptionalOwner } from "./tarot-guest";
import type { CreditOwner } from "./credits/types";

export async function requireMemberCreditOwner(request: Request, database: D1Database): Promise<CreditOwner> {
  const { owner, member } = await readOptionalOwner(request, database);
  if (!member || owner.kind !== "user") {
    throw new Response(JSON.stringify({ error: "Member authentication is required." }), {
      status: 401,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    });
  }
  return { kind: "member", ownerId: owner.userId };
}
