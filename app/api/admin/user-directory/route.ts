import { z } from "zod";
import { requirePermission } from "@/lib/admin/context";
import { ADMIN_ROLES } from "@/lib/admin/permissions";
import { AdminServiceError } from "@/lib/admin/member-service";
import { listAdminUserDirectory } from "@/lib/admin/read-model";
import { boundary, db } from "@/lib/server";
import { noStoreResponse } from "@/lib/request-identity";

const querySchema = z.object({
  q: z.string().trim().max(120).optional(),
  role: z.enum(["ALL", ...ADMIN_ROLES]).optional(),
  status: z.enum(["all", "active", "disabled"]).optional(),
  limit: z.string().regex(/^\d+$/).optional(),
  cursor: z.string().max(500).optional(),
}).strict();

export async function GET(request: Request) {
  return boundary(async () => {
    const database = db();
    const actor = await requirePermission(request, "admin.users.manage", database);
    const params = new URL(request.url).searchParams;
    const parsed = querySchema.safeParse({
      q: params.get("q") ?? undefined,
      role: params.get("role") ?? undefined,
      status: params.get("status") ?? undefined,
      limit: params.get("limit") ?? undefined,
      cursor: params.get("cursor") ?? undefined,
    });
    if (!parsed.success) return noStoreResponse(Response.json({ error: "Invalid user list request." }, { status: 400 }));
    const limit = parsed.data.limit === undefined ? undefined : Number(parsed.data.limit);
    if (limit !== undefined && (!Number.isSafeInteger(limit) || limit < 1 || limit > 50)) {
      return noStoreResponse(Response.json({ error: "Invalid user list request." }, { status: 400 }));
    }
    try {
      const page = await listAdminUserDirectory(database, actor, {
        search: parsed.data.q,
        role: parsed.data.role,
        status: parsed.data.status,
        limit,
        cursor: parsed.data.cursor,
      });
      return noStoreResponse(Response.json(page));
    } catch (error) {
      if (error instanceof AdminServiceError) {
        const status = error.code === "forbidden" ? 403 : error.code === "not_found" ? 404 : 400;
        return noStoreResponse(Response.json({ error: status === 403 ? "Forbidden." : "Invalid user list request." }, { status }));
      }
      throw error;
    }
  });
}
