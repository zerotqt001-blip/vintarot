import { boundary, db } from "@/lib/server";
import { requireMemberCreditOwner } from "@/lib/billing-http";
import { createCreditStore } from "@/lib/credits/repository";
import { noStoreResponse } from "@/lib/request-identity";

export async function GET(request: Request) {
  return boundary(async () => {
    const database = db();
    const owner = await requireMemberCreditOwner(request, database);
    const rawLimit = Number(new URL(request.url).searchParams.get("limit") || "20");
    const limit = Number.isFinite(rawLimit) ? Math.min(100, Math.max(1, Math.trunc(rawLimit))) : 20;
    const entries = await createCreditStore(database).listHistory(owner, limit);
    return noStoreResponse(Response.json({
      entries: entries.map(({ eventType, units, reason, effectiveAt }) => ({ eventType, units, reason, effectiveAt })),
    }));
  });
}
