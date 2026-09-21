import { z } from "zod";
import { listAdminOrderReadModel } from "@/lib/account-history";
import { requirePermission } from "@/lib/admin/context";
import { boundary, db } from "@/lib/server";
import { noStoreResponse } from "@/lib/request-identity";

const querySchema = z.object({ limit: z.string().optional() }).strict();

export async function GET(request: Request) {
  return boundary(async () => {
    const database = db();
    await requirePermission(request, "admin.orders.read", database);
    const parsed = querySchema.safeParse({ limit: new URL(request.url).searchParams.get("limit") ?? undefined });
    if (!parsed.success) return noStoreResponse(Response.json({ error: "Invalid order list request." }, { status: 400 }));
    const limit = parsed.data.limit === undefined ? undefined : Number(parsed.data.limit);
    if (limit !== undefined && !Number.isSafeInteger(limit)) return noStoreResponse(Response.json({ error: "Invalid order list request." }, { status: 400 }));
    return noStoreResponse(Response.json({ items: await listAdminOrderReadModel({ database, limit }) }));
  });
}
