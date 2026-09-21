import { z } from "zod";
import { boundary, db, json, originCheck } from "@/lib/server";
import { requireMemberCreditOwner } from "@/lib/billing-http";
import { createCreditStore } from "@/lib/credits/repository";
import { noStoreResponse } from "@/lib/request-identity";
import { createPendingOrder } from "@/lib/orders";

const requestSchema = z.object({
  package_version_id: z.string().min(1).max(160),
  idempotency_key: z.string().min(1).max(200),
});

function summary(order: Awaited<ReturnType<typeof createPendingOrder>>) {
  return {
    id: order.id,
    status: order.status,
    package: { id: order.packageId, version_id: order.packageVersionId, slug: order.packageSnapshot.slug, version: order.packageSnapshot.version },
    amount_minor: order.amountMinor,
    currency: order.currency,
    created_at: order.createdAt,
  };
}

export async function POST(request: Request) {
  return boundary(async () => {
    originCheck(request);
    const database = db();
    const owner = await requireMemberCreditOwner(request, database);
    const parsed = requestSchema.safeParse(await json(request));
    if (!parsed.success) return noStoreResponse(Response.json({ error: "Invalid order request." }, { status: 400 }));
    const order = await createPendingOrder({ database, creditStore: createCreditStore(database), owner, packageVersionId: parsed.data.package_version_id, idempotencyKey: parsed.data.idempotency_key });
    return noStoreResponse(Response.json({ order: summary(order) }, { status: 201 }));
  });
}
