import { z } from "zod";
import { boundary, db } from "@/lib/server";
import { requirePermission } from "@/lib/admin/context";
import { listAdminMembers } from "@/lib/admin/read-model";
import { noStoreResponse } from "@/lib/request-identity";

const querySchema = z.object({ limit: z.string().optional(), q: z.string().trim().max(120).optional() }).strict();

export async function GET(request: Request) {
  return boundary(async () => {
    const database = db();
    const actor = await requirePermission(request, "admin.users.read", database);
    const params = new URL(request.url).searchParams;
    const parsed = querySchema.safeParse({ limit: params.get("limit") ?? undefined, q: params.get("q") ?? undefined });
    if (!parsed.success) return noStoreResponse(Response.json({ error: "Invalid user list request." }, { status: 400 }));
    const limit = parsed.data.limit === undefined ? undefined : Number(parsed.data.limit);
    if (limit !== undefined && !Number.isSafeInteger(limit)) return noStoreResponse(Response.json({ error: "Invalid user list request." }, { status: 400 }));
    return noStoreResponse(Response.json({ items: await listAdminMembers(database, actor, { limit, search: parsed.data.q ?? "" }) }));
  });
}
