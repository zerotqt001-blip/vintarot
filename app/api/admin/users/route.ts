import { z } from "zod";
import { boundary, db } from "@/lib/server";
import { requirePermission } from "@/lib/admin/context";
import { listMembers } from "@/lib/admin/member-service";
import { noStoreResponse } from "@/lib/request-identity";

const querySchema = z.object({ limit: z.string().optional() }).strict();

export async function GET(request: Request) {
  return boundary(async () => {
    const database = db();
    const actor = await requirePermission(request, "admin.users.read", database);
    const parsed = querySchema.safeParse({ limit: new URL(request.url).searchParams.get("limit") ?? undefined });
    if (!parsed.success) return noStoreResponse(Response.json({ error: "Invalid user list request." }, { status: 400 }));
    const limit = parsed.data.limit === undefined ? undefined : Number(parsed.data.limit);
    if (limit !== undefined && !Number.isSafeInteger(limit)) return noStoreResponse(Response.json({ error: "Invalid user list request." }, { status: 400 }));
    return noStoreResponse(Response.json({ items: await listMembers(database, actor, limit) }));
  });
}
