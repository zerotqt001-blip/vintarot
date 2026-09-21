import { z } from "zod";
import { AccountHistoryError, listAccountHistory, type AccountHistoryKind } from "@/lib/account-history";
import { boundary, db } from "@/lib/server";
import { requireMemberCreditOwner } from "@/lib/billing-http";
import { noStoreResponse } from "@/lib/request-identity";

const querySchema = z.object({
  kind: z.enum(["readings", "shares", "orders", "credits", "affiliate", "all"]).default("all"),
  limit: z.string().optional(),
  cursor: z.string().max(240).optional(),
}).strict();

function queryInput(request: Request): z.infer<typeof querySchema> {
  const params = new URL(request.url).searchParams;
  const parsed = querySchema.safeParse({ kind: params.get("kind") ?? undefined, limit: params.get("limit") ?? undefined, cursor: params.get("cursor") ?? undefined });
  if (!parsed.success) throw new Response(JSON.stringify({ error: "Invalid account history request." }), { status: 400, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
  return parsed.data;
}

export async function GET(request: Request) {
  return boundary(async () => {
    const database = db();
    const owner = await requireMemberCreditOwner(request, database);
    const input = queryInput(request);
    const limit = input.limit === undefined ? undefined : Number(input.limit);
    try {
      return noStoreResponse(Response.json(await listAccountHistory({ database, owner, kind: input.kind as AccountHistoryKind, limit, cursor: input.cursor })));
    } catch (error) {
      if (error instanceof AccountHistoryError) return noStoreResponse(Response.json({ error: error.message }, { status: 400 }));
      throw error;
    }
  });
}
