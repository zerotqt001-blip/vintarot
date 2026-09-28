import { requirePermission } from "@/lib/admin/context";
import { AdminServiceError } from "@/lib/admin/member-service";
import { boundary, db, json, originCheck } from "@/lib/server";
import { noStoreResponse } from "@/lib/request-identity";
import { createMarketingCampaignAdminService } from "@/lib/marketing/admin";
import { marketingCampaignSchema, marketingCampaignStatusSchema } from "@/lib/marketing/schema";

type RouteContext = { params: Promise<{ id: string }> };

function mapError(error: unknown): Response | null {
  if (!(error instanceof AdminServiceError)) return null;
  const status = error.code === "not_found" ? 404 : error.code === "forbidden" ? 403 : 400;
  return noStoreResponse(Response.json({ error: status === 404 ? "Campaign not found." : status === 403 ? "Forbidden." : "Invalid campaign request." }, { status }));
}

function mutationKey(request: Request): string | null {
  const value = request.headers.get("idempotency-key")?.trim();
  return value && value.length <= 160 ? value : null;
}

export async function GET(request: Request, context: RouteContext) {
  return boundary(async () => {
    const database = db();
    const actor = await requirePermission(request, "admin.marketing.manage", database);
    const { id } = await context.params;
    try {
      const admin = createMarketingCampaignAdminService(database);
      const campaign = await admin.get(actor, id);
      if (!campaign) return noStoreResponse(Response.json({ error: "Campaign not found." }, { status: 404 }));
      return noStoreResponse(Response.json({ campaign, history: await admin.history(actor, id) }));
    } catch (error) {
      const response = mapError(error);
      if (response) return response;
      throw error;
    }
  });
}

export async function PATCH(request: Request, context: RouteContext) {
  return boundary(async () => {
    originCheck(request);
    const database = db();
    const actor = await requirePermission(request, "admin.marketing.manage", database);
    const parsed = marketingCampaignSchema.safeParse(await json(request));
    const key = mutationKey(request);
    if (!parsed.success || !key) return noStoreResponse(Response.json({ error: "Invalid campaign request." }, { status: 400 }));
    const { id } = await context.params;
    try {
      const campaign = await createMarketingCampaignAdminService(database).update(actor, id, parsed.data, { idempotencyKey: key });
      return noStoreResponse(Response.json({ campaign }));
    } catch (error) {
      const response = mapError(error);
      if (response) return response;
      throw error;
    }
  });
}

export async function POST(request: Request, context: RouteContext) {
  return boundary(async () => {
    originCheck(request);
    const database = db();
    const actor = await requirePermission(request, "admin.marketing.manage", database);
    const parsed = marketingCampaignStatusSchema.safeParse(await json(request));
    const key = mutationKey(request);
    if (!parsed.success || !key) return noStoreResponse(Response.json({ error: "Invalid campaign request." }, { status: 400 }));
    const { id } = await context.params;
    try {
      const campaign = await createMarketingCampaignAdminService(database).setStatus(actor, id, parsed.data.status, { idempotencyKey: key });
      return noStoreResponse(Response.json({ campaign }));
    } catch (error) {
      const response = mapError(error);
      if (response) return response;
      throw error;
    }
  });
}
