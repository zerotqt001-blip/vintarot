import { getAffiliateCustomerDashboard } from "@/lib/affiliate/customer";
import { ensureAffiliateEnrollment } from "@/lib/affiliate/enrollment";
import { memberIdFromOwner } from "@/lib/affiliate/repository";
import { boundary, db } from "@/lib/server";
import { requireMemberCreditOwner } from "@/lib/billing-http";
import { noStoreResponse } from "@/lib/request-identity";

export async function GET(request: Request) {
  return boundary(async () => {
    const database = db();
    const owner = await requireMemberCreditOwner(request, database);
    const memberId = memberIdFromOwner(owner.ownerId);
    if (!memberId) throw new Response(JSON.stringify({ error: "Member authentication is required." }), { status: 401, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
    const enrollment = await ensureAffiliateEnrollment({ database, memberId });
    if (!enrollment.enrolled && ["member_not_found", "not_verified", "disabled"].includes(enrollment.reason)) {
      throw new Response(JSON.stringify({ error: "Member authentication is required." }), { status: 401, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
    }
    return noStoreResponse(Response.json(await getAffiliateCustomerDashboard(database, owner)));
  });
}
