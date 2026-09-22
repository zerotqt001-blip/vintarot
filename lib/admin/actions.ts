import type { D1Database } from "@cloudflare/workers-types";
import { createAuditService } from "../audit/service";
import { createCreditStore } from "../credits/repository";
import { grantManualEntitlement, revokeEntitlement, type Entitlement } from "../entitlements";
import { digestToken } from "../member-auth";
import type { AdminActor } from "./context";
import { AdminServiceError } from "./member-service";
import { hasPermission } from "./permissions";

function required(value: string, max: number, message = "Invalid admin mutation."): string {
  const normalized = value.trim();
  if (!normalized || normalized.length > max) throw new AdminServiceError("invalid", message);
  return normalized;
}

function requirePermission(actor: AdminActor, permission: "admin.credits.adjust" | "admin.vip.adjust"): void {
  if (!hasPermission(actor.role, permission)) throw new AdminServiceError("forbidden", "Forbidden.");
}

async function targetOwner(database: D1Database, memberId: string): Promise<{ kind: "member"; ownerId: string }> {
  const normalized = required(memberId, 160, "Invalid member.");
  const member = await database.prepare("SELECT id FROM members WHERE id=? AND disabled=0 LIMIT 1").bind(normalized).first<{ id: string }>();
  if (!member) throw new AdminServiceError("not_found", "Member not found.");
  return { kind: "member", ownerId: `member:${member.id}` };
}

async function scopedKey(prefix: string, memberId: string, idempotencyKey: string): Promise<string> {
  const digest = await digestToken(JSON.stringify({ memberId, idempotencyKey }));
  return `${prefix}:${digest}`;
}

export async function adjustAdminMemberCredits(database: D1Database, actor: AdminActor, input: { memberId: string; units: number; reason: string; idempotencyKey: string }): Promise<{ id: string; units: number }> {
  requirePermission(actor, "admin.credits.adjust");
  const memberId = required(input.memberId, 160, "Invalid member.");
  const reason = required(input.reason, 500, "A reason is required.");
  const idempotencyKey = required(input.idempotencyKey, 200, "An idempotency key is required.");
  if (!Number.isSafeInteger(input.units) || input.units === 0 || Math.abs(input.units) > 1_000_000) throw new AdminServiceError("invalid", "Invalid Credits adjustment.");
  const owner = await targetOwner(database, memberId);
  const result = await createCreditStore(database).adjustCredits({
    owner,
    units: input.units,
    adjustmentKey: idempotencyKey,
    eligibleFrom: 0,
    reason,
    policyVersion: "credits-admin-v1",
    policySnapshot: { actor: actor.memberId, source: "admin-control-center-v1" },
  });
  await createAuditService(database).append({
    actorKind: "member",
    actorId: actor.memberId,
    action: "credits.adjusted",
    targetType: "member",
    targetId: memberId,
    reason,
    idempotencyKey: await scopedKey("admin.credits.adjust", memberId, idempotencyKey),
    metadata: { units: input.units },
  });
  return { id: result.id, units: input.units };
}

export async function grantAdminVip(database: D1Database, actor: AdminActor, input: { memberId: string; benefitVersion: string; startsAt: number; endsAt: number | null; benefitSnapshot: unknown; reason: string; idempotencyKey: string }): Promise<Entitlement> {
  requirePermission(actor, "admin.vip.adjust");
  const memberId = required(input.memberId, 160, "Invalid member.");
  const benefitVersion = required(input.benefitVersion, 120, "Invalid VIP entitlement.");
  const reason = required(input.reason, 500, "A reason is required.");
  const idempotencyKey = required(input.idempotencyKey, 200, "An idempotency key is required.");
  if (!Number.isSafeInteger(input.startsAt) || input.startsAt < 0 || (input.endsAt !== null && (!Number.isSafeInteger(input.endsAt) || input.endsAt <= input.startsAt))) throw new AdminServiceError("invalid", "Invalid VIP entitlement.");
  const owner = await targetOwner(database, memberId);
  return grantManualEntitlement({
    database,
    owner,
    entitlementType: "VIP",
    benefitVersion,
    startsAt: input.startsAt,
    endsAt: input.endsAt,
    benefitSnapshot: input.benefitSnapshot,
    idempotencyKey: await scopedKey("admin.vip.grant", memberId, idempotencyKey),
    reason,
    actorId: actor.memberId,
  });
}

export async function revokeAdminVip(database: D1Database, actor: AdminActor, input: { memberId: string; entitlementId: string; reason: string; idempotencyKey: string }): Promise<boolean> {
  requirePermission(actor, "admin.vip.adjust");
  const memberId = required(input.memberId, 160, "Invalid member.");
  const entitlementId = required(input.entitlementId, 200, "Invalid entitlement.");
  const reason = required(input.reason, 500, "A reason is required.");
  const idempotencyKey = required(input.idempotencyKey, 200, "An idempotency key is required.");
  const owner = await targetOwner(database, memberId);
  return revokeEntitlement({
    database,
    owner,
    entitlementId,
    reason,
    actorId: actor.memberId,
    idempotencyKey: await scopedKey("admin.vip.revoke", memberId, idempotencyKey),
  });
}
