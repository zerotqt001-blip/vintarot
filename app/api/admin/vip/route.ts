import { z } from "zod";
import { requirePermission } from "@/lib/admin/context";
import { AdminServiceError } from "@/lib/admin/member-service";
import { grantAdminVip, revokeAdminVip } from "@/lib/admin/actions";
import { CreditError } from "@/lib/credits/repository";
import { boundary, db, json, originCheck } from "@/lib/server";
import { noStoreResponse } from "@/lib/request-identity";

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("grant"), member_id: z.string().trim().min(1).max(160), benefit_version: z.string().trim().min(1).max(120), starts_at: z.number().int().nonnegative(), ends_at: z.number().int().positive().nullable(), benefit_snapshot: z.record(z.string(), z.unknown()), reason: z.string().trim().min(1).max(500), idempotency_key: z.string().trim().min(1).max(200) }).strict(),
  z.object({ action: z.literal("revoke"), member_id: z.string().trim().min(1).max(160), entitlement_id: z.string().trim().min(1).max(200), reason: z.string().trim().min(1).max(500), idempotency_key: z.string().trim().min(1).max(200) }).strict(),
]);

export async function POST(request: Request) {
  return boundary(async () => {
    originCheck(request);
    const database = db();
    const parsed = schema.safeParse(await json(request));
    if (!parsed.success) return noStoreResponse(Response.json({ error: "Invalid VIP mutation." }, { status: 400 }));
    const actor = await requirePermission(request, "admin.vip.adjust", database);
    try {
      if (parsed.data.action === "grant") {
        const entitlement = await grantAdminVip(database, actor, { memberId: parsed.data.member_id, benefitVersion: parsed.data.benefit_version, startsAt: parsed.data.starts_at, endsAt: parsed.data.ends_at, benefitSnapshot: parsed.data.benefit_snapshot, reason: parsed.data.reason, idempotencyKey: parsed.data.idempotency_key });
        return noStoreResponse(Response.json({ entitlement: { id: entitlement.id, status: entitlement.status, startsAt: entitlement.startsAt, endsAt: entitlement.endsAt } }));
      }
      return noStoreResponse(Response.json({ revoked: await revokeAdminVip(database, actor, { memberId: parsed.data.member_id, entitlementId: parsed.data.entitlement_id, reason: parsed.data.reason, idempotencyKey: parsed.data.idempotency_key }) }));
    } catch (error) {
      if (error instanceof AdminServiceError) {
        const status = error.code === "not_found" ? 404 : error.code === "forbidden" ? 403 : 400;
        return noStoreResponse(Response.json({ error: status === 404 ? "User not found." : status === 403 ? "Forbidden." : "Invalid VIP mutation." }, { status }));
      }
      if (error instanceof CreditError) return noStoreResponse(Response.json({ error: "VIP entitlement conflicts with an existing request." }, { status: 400 }));
      throw error;
    }
  });
}
