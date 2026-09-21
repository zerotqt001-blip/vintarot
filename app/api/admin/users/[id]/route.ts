import { z } from "zod";
import { boundary, db, json, originCheck } from "@/lib/server";
import { requirePermission } from "@/lib/admin/context";
import { AdminServiceError, getMemberDetail, setMemberRole, setMemberStatus } from "@/lib/admin/member-service";
import { ADMIN_ROLES } from "@/lib/admin/permissions";
import { noStoreResponse } from "@/lib/request-identity";

const mutationSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("status"), disabled: z.boolean(), reason: z.string().trim().min(1).max(500), idempotency_key: z.string().trim().min(1).max(200) }).strict(),
  z.object({ action: z.literal("role"), role: z.enum(ADMIN_ROLES), reason: z.string().trim().min(1).max(500), idempotency_key: z.string().trim().min(1).max(200) }).strict(),
]);

function serviceError(error: unknown): Response | null {
  if (!(error instanceof AdminServiceError)) return null;
  const status = error.code === "not_found" ? 404 : error.code === "forbidden" ? 403 : 400;
  return noStoreResponse(Response.json({ error: status === 404 ? "User not found." : status === 403 ? "Forbidden." : "Invalid user mutation." }, { status }));
}

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  return boundary(async () => {
    const database = db();
    const actor = await requirePermission(request, "admin.users.read", database);
    const { id } = await context.params;
    try {
      return noStoreResponse(Response.json({ user: await getMemberDetail(database, actor, id) }));
    } catch (error) {
      const response = serviceError(error);
      if (response) return response;
      throw error;
    }
  });
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  return boundary(async () => {
    originCheck(request);
    const database = db();
    const { id } = await context.params;
    const parsed = mutationSchema.safeParse(await json(request));
    if (!parsed.success) return noStoreResponse(Response.json({ error: "Invalid user mutation." }, { status: 400 }));
    try {
      if (parsed.data.action === "status") {
        const actor = await requirePermission(request, "admin.users.status", database);
        return noStoreResponse(Response.json({ user: await setMemberStatus(database, actor, { memberId: id, disabled: parsed.data.disabled, reason: parsed.data.reason, idempotencyKey: parsed.data.idempotency_key }) }));
      }
      const actor = await requirePermission(request, "admin.roles.manage", database);
      return noStoreResponse(Response.json({ user: await setMemberRole(database, actor, { memberId: id, role: parsed.data.role, reason: parsed.data.reason, idempotencyKey: parsed.data.idempotency_key }) }));
    } catch (error) {
      const response = serviceError(error);
      if (response) return response;
      throw error;
    }
  });
}
