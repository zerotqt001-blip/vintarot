import { boundary, db } from "@/lib/server";
import { getAccountSummary } from "@/lib/account-history";
import { requireMemberCreditOwner } from "@/lib/billing-http";
import { noStoreResponse } from "@/lib/request-identity";

export async function GET(request: Request) {
  return boundary(async () => {
    const database = db();
    const owner = await requireMemberCreditOwner(request, database);
    return noStoreResponse(Response.json(await getAccountSummary({ database, owner })));
  });
}
