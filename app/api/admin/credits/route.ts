import { z } from "zod";
import { createAuditService } from "@/lib/audit/service";
import { requirePermission } from "@/lib/admin/context";
import { createCreditStore } from "@/lib/credits/repository";
import { boundary, db, json, originCheck } from "@/lib/server";
import { noStoreResponse } from "@/lib/request-identity";

const schema = z.object({
  member_id: z.string().trim().min(1).max(160),
  units: z.number().int().min(-1_000_000).max(1_000_000).refine((value) => value !== 0),
  reason: z.string().trim().min(1).max(500),
  idempotency_key: z.string().trim().min(1).max(200),
}).strict();

export async function POST(request: Request) {
  return boundary(async () => {
    originCheck(request);
    const database = db();
    const actor = await requirePermission(request, "admin.credits.adjust", database);
    const parsed = schema.safeParse(await json(request));
    if (!parsed.success) return noStoreResponse(Response.json({ error: "Invalid Credits adjustment." }, { status: 400 }));
    const target = await database.prepare("SELECT id FROM members WHERE id=? AND disabled=0 LIMIT 1").bind(parsed.data.member_id).first<{ id: string }>();
    if (!target) return noStoreResponse(Response.json({ error: "User not found." }, { status: 404 }));
    const owner = { kind: "member" as const, ownerId: `member:${target.id}` };
    const result = await createCreditStore(database).adjustCredits({ owner, units: parsed.data.units, adjustmentKey: parsed.data.idempotency_key, reason: parsed.data.reason, policyVersion: "credits-admin-v1", policySnapshot: { actor: actor.memberId } });
    await createAuditService(database).append({ actorKind: "member", actorId: actor.memberId, action: "credits.adjusted", targetType: "member", targetId: target.id, reason: parsed.data.reason, idempotencyKey: `admin.credits.adjust:${parsed.data.idempotency_key}`, metadata: { units: parsed.data.units } });
    return noStoreResponse(Response.json({ adjustment: { id: result.id, units: "units" in result ? result.units : parsed.data.units } }));
  });
}
