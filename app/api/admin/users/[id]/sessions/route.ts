import { z } from "zod";
import { boundary, db, json, originCheck } from "@/lib/server";
import { requirePermission } from "@/lib/admin/context";
import { AdminServiceError, listMemberSessions, revokeMemberSession } from "@/lib/admin/member-service";
import { noStoreResponse } from "@/lib/request-identity";

const mutationSchema = z.object({ session_id: z.string().trim().min(1).max(160), reason: z.string().trim().min(1).max(500), idempotency_key: z.string().trim().min(1).max(200) }).strict();

function mapError(error: unknown): Response | null {
  if (!(error instanceof AdminServiceError)) return null;
  return noStoreResponse(Response.json({ error: error.code === "not_found" ? "Session not found." : "Invalid session mutation." }, { status: error.code === "not_found" ? 404 : error.code === "forbidden" ? 403 : 400 }));
}

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  return boundary(async () => {
    const database = db();
    const actor = await requirePermission(request, "admin.sessions.read", database);
    const { id } = await context.params;
    return noStoreResponse(Response.json({ sessions: await listMemberSessions(database, actor, id) }));
  });
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return boundary(async () => {
    originCheck(request);
    const database = db();
    const actor = await requirePermission(request, "admin.sessions.revoke", database);
    const { id } = await context.params;
    const parsed = mutationSchema.safeParse(await json(request));
    if (!parsed.success) return noStoreResponse(Response.json({ error: "Invalid session mutation." }, { status: 400 }));
    try {
      return noStoreResponse(Response.json({ revoked: await revokeMemberSession(database, actor, { memberId: id, sessionId: parsed.data.session_id, reason: parsed.data.reason, idempotencyKey: parsed.data.idempotency_key }) }));
    } catch (error) {
      const response = mapError(error);
      if (response) return response;
      throw error;
    }
  });
}
