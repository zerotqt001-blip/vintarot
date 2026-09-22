import { z } from "zod";
import { createAuditService } from "@/lib/audit/service";
import { requirePermission } from "@/lib/admin/context";
import { boundary, db } from "@/lib/server";
import { noStoreResponse } from "@/lib/request-identity";

const querySchema = z.object({ actor_id: z.string().trim().max(160).optional(), target_id: z.string().trim().max(160).optional(), target_type: z.string().trim().max(120).optional(), limit: z.string().optional() }).strict();

export async function GET(request: Request) {
  return boundary(async () => {
    const database = db();
    await requirePermission(request, "admin.audit.read", database);
    const params = new URL(request.url).searchParams;
    const parsed = querySchema.safeParse({ actor_id: params.get("actor_id") ?? undefined, target_id: params.get("target_id") ?? undefined, target_type: params.get("target_type") ?? undefined, limit: params.get("limit") ?? undefined });
    if (!parsed.success) return noStoreResponse(Response.json({ error: "Invalid audit request." }, { status: 400 }));
    const limit = parsed.data.limit === undefined ? undefined : Number(parsed.data.limit);
    if (limit !== undefined && !Number.isSafeInteger(limit)) return noStoreResponse(Response.json({ error: "Invalid audit request." }, { status: 400 }));
    return noStoreResponse(Response.json({ items: await createAuditService(database).list({ actorId: parsed.data.actor_id, targetId: parsed.data.target_id, targetType: parsed.data.target_type, limit }) }));
  });
}
