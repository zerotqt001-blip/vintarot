import { z } from "zod";
import { requirePermission } from "@/lib/admin/context";
import { AdminServiceError } from "@/lib/admin/member-service";
import { listAdminMemberReadings } from "@/lib/admin/read-model";
import { boundary, db } from "@/lib/server";
import { noStoreResponse } from "@/lib/request-identity";

const querySchema = z.object({ limit: z.string().optional() }).strict();

function mapError(error: unknown): Response | null {
  if (!(error instanceof AdminServiceError)) return null;
  const status = error.code === "forbidden" ? 403 : error.code === "not_found" ? 404 : 400;
  return noStoreResponse(Response.json({ error: status === 403 ? "Forbidden." : status === 404 ? "User not found." : "Invalid reading request." }, { status }));
}

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  return boundary(async () => {
    const database = db();
    const actor = await requirePermission(request, "admin.readings.read", database);
    const params = new URL(request.url).searchParams;
    const parsed = querySchema.safeParse({ limit: params.get("limit") ?? undefined });
    if (!parsed.success) return noStoreResponse(Response.json({ error: "Invalid reading request." }, { status: 400 }));
    const limit = parsed.data.limit === undefined ? undefined : Number(parsed.data.limit);
    if (limit !== undefined && !Number.isSafeInteger(limit)) return noStoreResponse(Response.json({ error: "Invalid reading request." }, { status: 400 }));
    const { id } = await context.params;
    try {
      return noStoreResponse(Response.json(await listAdminMemberReadings(database, actor, id, limit)));
    } catch (error) {
      const response = mapError(error);
      if (response) return response;
      throw error;
    }
  });
}
