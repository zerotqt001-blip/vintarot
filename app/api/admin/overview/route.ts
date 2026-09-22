import { boundary, db } from "@/lib/server";
import { requirePermission } from "@/lib/admin/context";
import { getAdminDashboard } from "@/lib/admin/read-model";
import { AdminServiceError } from "@/lib/admin/member-service";
import { noStoreResponse } from "@/lib/request-identity";

function mapError(error: unknown): Response | null {
  if (!(error instanceof AdminServiceError)) return null;
  return noStoreResponse(Response.json({ error: error.code === "forbidden" ? "Forbidden." : "Invalid admin request." }, { status: error.code === "forbidden" ? 403 : 400 }));
}

export async function GET(request: Request) {
  return boundary(async () => {
    const database = db();
    const actor = await requirePermission(request, "admin.dashboard.read", database);
    try {
      return noStoreResponse(Response.json({ dashboard: await getAdminDashboard(database, actor) }));
    } catch (error) {
      const response = mapError(error);
      if (response) return response;
      throw error;
    }
  });
}
