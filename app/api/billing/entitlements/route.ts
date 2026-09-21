import { boundary, db } from "@/lib/server";
import { requireMemberCreditOwner } from "@/lib/billing-http";
import { getActiveEntitlements } from "@/lib/entitlements";
import { noStoreResponse } from "@/lib/request-identity";

export async function GET(request: Request) {
  return boundary(async () => {
    const database = db();
    const owner = await requireMemberCreditOwner(request, database);
    const entitlements = await getActiveEntitlements(database, owner);
    return noStoreResponse(Response.json({
      entitlements: entitlements.map((entitlement) => ({
        id: entitlement.id,
        entitlementType: entitlement.entitlementType,
        benefitVersion: entitlement.benefitVersion,
        startsAt: entitlement.startsAt,
        endsAt: entitlement.endsAt,
        status: entitlement.status,
      })),
    }));
  });
}
