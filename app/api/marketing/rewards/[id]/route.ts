import { boundary, db, originCheck } from "@/lib/server";
import { noStoreResponse } from "@/lib/request-identity";
import { createMarketingRewardHandlers } from "@/lib/marketing/handlers";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: RouteContext) {
  return boundary(async () => {
    const { id } = await context.params;
    return noStoreResponse(await createMarketingRewardHandlers(db()).campaignGET(request, id));
  });
}

export async function POST(request: Request, context: RouteContext) {
  return boundary(async () => {
    originCheck(request);
    const { id } = await context.params;
    return noStoreResponse(await createMarketingRewardHandlers(db()).claimPOST(request, id));
  });
}
