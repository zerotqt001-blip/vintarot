import { boundary, db } from "@/lib/server";
import { requireMemberCreditOwner } from "@/lib/billing-http";
import { createCreditStore } from "@/lib/credits/repository";
import { noStoreResponse } from "@/lib/request-identity";

export async function GET(request: Request) {
  return boundary(async () => {
    const database = db();
    const owner = await requireMemberCreditOwner(request, database);
    const balance = await createCreditStore(database).getBalance(owner);
    return noStoreResponse(Response.json({ balance }));
  });
}
