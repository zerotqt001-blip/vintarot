import { requirePermission } from "@/lib/admin/context";
import { AdminServiceError } from "@/lib/admin/member-service";
import { boundary, db, json, originCheck } from "@/lib/server";
import { noStoreResponse } from "@/lib/request-identity";
import { createMarketingCampaignAdminService } from "@/lib/marketing/admin";
import { marketingCampaignSchema } from "@/lib/marketing/schema";

function mapError(error: unknown): Response | null {
  if (!(error instanceof AdminServiceError)) return null;
  const status = error.code === "not_found" ? 404 : error.code === "forbidden" ? 403 : 400;
  return noStoreResponse(Response.json({ error: status === 404 ? "Campaign not found." : status === 403 ? "Forbidden." : "Invalid campaign request." }, { status }));
}

function mutationKey(request: Request): string | null {
  const value = request.headers.get("idempotency-key")?.trim();
  return value && value.length <= 160 ? value : null;
}

export async function GET(request: Request) {
  return boundary(async () => {
    const database = db();
    const actor = await requirePermission(request, "admin.marketing.manage", database);
    try {
      return noStoreResponse(Response.json({ campaigns: await createMarketingCampaignAdminService(database).list(actor) }));
    } catch (error) {
      const response = mapError(error);
      if (response) return response;
      throw error;
    }
  });
}

export async function POST(request: Request) {
  return boundary(async () => {
    originCheck(request);
    const database = db();
    const actor = await requirePermission(request, "admin.marketing.manage", database);
    const parsed = marketingCampaignSchema.safeParse(await json(request));
    const key = mutationKey(request);
    if (!parsed.success || !key) return noStoreResponse(Response.json({ error: "Invalid campaign request." }, { status: 400 }));
    try {
      const campaign = await createMarketingCampaignAdminService(database).create(actor, parsed.data, { idempotencyKey: key });
      return noStoreResponse(Response.json({ campaign }, { status: 201 }));
    } catch (error) {
      const response = mapError(error);
      if (response) return response;
      throw error;
    }
  });
}
