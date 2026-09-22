import { z } from "zod";
import { requirePermission } from "@/lib/admin/context";
import { AdminServiceError } from "@/lib/admin/member-service";
import { listAdminOrders } from "@/lib/admin/read-model";
import { boundary, db } from "@/lib/server";
import { noStoreResponse } from "@/lib/request-identity";

const querySchema = z.object({ limit: z.string().optional(), member_id: z.string().trim().min(1).max(160).optional() }).strict();

export async function GET(request: Request) {
  return boundary(async () => {
    const database = db();
    const actor = await requirePermission(request, "admin.orders.read", database);
    const params = new URL(request.url).searchParams;
    const parsed = querySchema.safeParse({ limit: params.get("limit") ?? undefined, member_id: params.get("member_id") ?? undefined });
    if (!parsed.success) return noStoreResponse(Response.json({ error: "Invalid order list request." }, { status: 400 }));
    const limit = parsed.data.limit === undefined ? undefined : Number(parsed.data.limit);
    if (limit !== undefined && !Number.isSafeInteger(limit)) return noStoreResponse(Response.json({ error: "Invalid order list request." }, { status: 400 }));
    try {
      return noStoreResponse(Response.json({ items: await listAdminOrders(database, actor, { memberId: parsed.data.member_id, limit }) }));
    } catch (error) {
      if (error instanceof AdminServiceError) {
        const status = error.code === "not_found" ? 404 : error.code === "forbidden" ? 403 : 400;
        return noStoreResponse(Response.json({ error: status === 404 ? "User not found." : status === 403 ? "Forbidden." : "Invalid order list request." }, { status }));
      }
      throw error;
    }
  });
}
