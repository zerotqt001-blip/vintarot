import { boundary, db } from "@/lib/server";
import { requireMemberCreditOwner } from "@/lib/billing-http";
import { noStoreResponse } from "@/lib/request-identity";
import { getOrderForOwner } from "@/lib/orders";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  return boundary(async () => {
    const database = db();
    const owner = await requireMemberCreditOwner(request, database);
    const { id } = await context.params;
    const order = await getOrderForOwner(database, owner, id);
    if (!order) return noStoreResponse(Response.json({ error: "Order not found." }, { status: 404 }));
    return noStoreResponse(Response.json({
      order: {
        id: order.id,
        status: order.status,
        amount_minor: order.amountMinor,
        currency: order.currency,
        package: { id: order.packageId, version_id: order.packageVersionId, slug: order.packageSnapshot.slug, version: order.packageSnapshot.version },
        created_at: order.createdAt,
        payment_confirmed_at: order.paymentConfirmedAt,
        fulfilled_at: order.fulfilledAt,
      },
    }));
  });
}
