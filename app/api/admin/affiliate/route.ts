import { z } from "zod";
import { createAuditService } from "@/lib/audit/service";
import { requirePermission } from "@/lib/admin/context";
import { adjustAffiliateCommission, listAdminAffiliateReadModel, setAffiliateProfileStatus } from "@/lib/affiliate/service";
import { affiliateAdjustmentAuditIdempotencyKey } from "@/lib/affiliate/idempotency";
import { boundary, db, json, originCheck } from "@/lib/server";
import { noStoreResponse } from "@/lib/request-identity";

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("profile_status"), profile_id: z.string().trim().min(1).max(200), status: z.enum(["ACTIVE", "INACTIVE", "SUSPENDED"]), reason: z.string().trim().min(1).max(500), idempotency_key: z.string().trim().min(1).max(200) }).strict(),
  z.object({ action: z.literal("commission_adjust"), conversion_id: z.string().trim().min(1).max(200), direction: z.enum(["CREDIT", "DEBIT"]), amount_minor: z.number().int().nonnegative().max(1_000_000_000_000), reason: z.string().trim().min(1).max(500), idempotency_key: z.string().trim().min(1).max(200) }).strict(),
]);

export async function GET(request: Request) {
  return boundary(async () => {
    const database = db();
    await requirePermission(request, "admin.affiliate.read", database);
    const rawLimit = new URL(request.url).searchParams.get("limit");
    const limit = rawLimit === null ? undefined : Number(rawLimit);
    if (limit !== undefined && !Number.isSafeInteger(limit)) return noStoreResponse(Response.json({ error: "Invalid affiliate list request." }, { status: 400 }));
    return noStoreResponse(Response.json(await listAdminAffiliateReadModel(database, limit)));
  });
}

export async function POST(request: Request) {
  return boundary(async () => {
    originCheck(request);
    const database = db();
    const parsed = schema.safeParse(await json(request));
    if (!parsed.success) return noStoreResponse(Response.json({ error: "Invalid affiliate mutation." }, { status: 400 }));
    const actor = await requirePermission(request, parsed.data.action === "profile_status" ? "admin.affiliate.manage" : "admin.affiliate.adjust", database);
    if (parsed.data.action === "profile_status") {
      const auditKey = `admin.affiliate.status:${parsed.data.idempotency_key}`;
      const alreadyApplied = await database.prepare("SELECT 1 AS present FROM audit_events WHERE idempotency_key=? LIMIT 1").bind(auditKey).first<{ present: number }>();
      if (alreadyApplied) return noStoreResponse(Response.json({ ok: true }));
      await setAffiliateProfileStatus(database, parsed.data.profile_id, parsed.data.status);
      await createAuditService(database).append({ actorKind: "member", actorId: actor.memberId, action: "affiliate.profile.status", targetType: "affiliate_profile", targetId: parsed.data.profile_id, reason: parsed.data.reason, idempotencyKey: auditKey, metadata: { status: parsed.data.status } });
      return noStoreResponse(Response.json({ ok: true }));
    }
    const conversion = await adjustAffiliateCommission({ database, conversionId: parsed.data.conversion_id, direction: parsed.data.direction, amountMinor: parsed.data.amount_minor, reason: parsed.data.reason, idempotencyKey: parsed.data.idempotency_key, actorId: actor.memberId });
    const legacyAuditKey = `admin.affiliate.adjust:${parsed.data.idempotency_key}`;
    const auditKey = await affiliateAdjustmentAuditIdempotencyKey(conversion.id, parsed.data.idempotency_key);
    const legacyAudit = await database.prepare("SELECT target_id FROM audit_events WHERE idempotency_key=? LIMIT 1").bind(legacyAuditKey).first<{ target_id: string | null }>();
    if (!legacyAudit || String(legacyAudit.target_id) !== conversion.id) {
      await createAuditService(database).append({ actorKind: "member", actorId: actor.memberId, action: "affiliate.commission.adjusted", targetType: "affiliate_conversion", targetId: conversion.id, reason: parsed.data.reason, idempotencyKey: auditKey, metadata: { direction: parsed.data.direction, amountMinor: parsed.data.amount_minor } });
    }
    return noStoreResponse(Response.json({ conversion: { id: conversion.id, status: conversion.status } }));
  });
}
