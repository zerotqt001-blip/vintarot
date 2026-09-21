import { z } from "zod";
import { grantManualEntitlement, revokeEntitlement } from "@/lib/entitlements";
import { requirePermission } from "@/lib/admin/context";
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
    const permission = parsed.data.action === "grant" ? "admin.vip.adjust" : "admin.vip.adjust";
    const actor = await requirePermission(request, permission, database);
    const member = await database.prepare("SELECT id FROM members WHERE id=? AND disabled=0 LIMIT 1").bind(parsed.data.member_id).first<{ id: string }>();
    if (!member) return noStoreResponse(Response.json({ error: "User not found." }, { status: 404 }));
    const owner = { kind: "member" as const, ownerId: `member:${member.id}` };
    if (parsed.data.action === "grant") {
      const entitlement = await grantManualEntitlement({ database, owner, entitlementType: "VIP", benefitVersion: parsed.data.benefit_version, startsAt: parsed.data.starts_at, endsAt: parsed.data.ends_at, benefitSnapshot: parsed.data.benefit_snapshot, idempotencyKey: parsed.data.idempotency_key, reason: parsed.data.reason, actorId: actor.memberId });
      return noStoreResponse(Response.json({ entitlement: { id: entitlement.id, status: entitlement.status, startsAt: entitlement.startsAt, endsAt: entitlement.endsAt } }));
    }
    return noStoreResponse(Response.json({ revoked: await revokeEntitlement({ database, owner, entitlementId: parsed.data.entitlement_id, reason: parsed.data.reason, actorId: actor.memberId, idempotencyKey: parsed.data.idempotency_key }) }));
  });
}
