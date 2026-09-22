import { getActiveAffiliatePolicy } from "@/lib/affiliate/policy";
import { projectAffiliatePolicy } from "@/lib/affiliate/customer";
import { boundary, db } from "@/lib/server";
import { noStoreResponse } from "@/lib/request-identity";

export async function GET() {
  return boundary(async () => {
    const policy = await getActiveAffiliatePolicy(db(), Date.now());
    return noStoreResponse(Response.json({ policy: projectAffiliatePolicy(policy) }));
  });
}

