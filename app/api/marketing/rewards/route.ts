import { boundary, db } from "@/lib/server";
import { noStoreResponse } from "@/lib/request-identity";
import { createMarketingRewardHandlers } from "@/lib/marketing/handlers";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return boundary(async () => noStoreResponse(await createMarketingRewardHandlers(db()).GET(request)));
}
