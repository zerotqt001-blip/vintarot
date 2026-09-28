import { boundary, db, originCheck } from "@/lib/server";
import { noStoreResponse } from "@/lib/request-identity";
import { createDailyRewardHandlers } from "@/lib/marketing/handlers";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return boundary(async () => {
    const response = await createDailyRewardHandlers(db()).GET(request);
    return noStoreResponse(response);
  });
}

export async function POST(request: Request) {
  return boundary(async () => {
    originCheck(request);
    const response = await createDailyRewardHandlers(db()).POST(request);
    return noStoreResponse(response);
  });
}
