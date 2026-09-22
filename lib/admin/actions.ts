import type { D1Database } from "@cloudflare/workers-types";
import { createCreditStore, creditAccountId } from "../credits/repository";
import type { AuditAppendInput } from "../audit/types";
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

async function existingCreditAdjustment(
  database: D1Database,
  owner: { kind: "member"; ownerId: string },
  memberId: string,
  units: number,
  reason: string,
  auditIdempotencyKey: string,
  adjustmentKey: string,
): Promise<{ id: string; units: number } | null> {
  const audit = await database.prepare("SELECT action, reason, metadata_json FROM audit_events WHERE idempotency_key=? LIMIT 1").bind(auditIdempotencyKey).first<{ action: string; reason: string; metadata_json: string }>();
  if (!audit) return null;
  let priorUnits: number | null = null;
  try {
    const metadata = JSON.parse(audit.metadata_json) as { units?: unknown };
    priorUnits = typeof metadata.units === "number" && Number.isSafeInteger(metadata.units) ? metadata.units : null;
  } catch {
    priorUnits = null;
  }
  if (audit.action !== "credits.adjusted" || priorUnits === null || priorUnits !== units || audit.reason !== reason) {
    throw new AdminServiceError("invalid", `Credits idempotency key ${adjustmentKey} already belongs to a different request.`);
  }
  const accountId = creditAccountId(owner);
  const row = units > 0
    ? await database.prepare("SELECT id FROM credit_grants WHERE account_id=? AND grant_key=? LIMIT 1").bind(accountId, `adjustment:${adjustmentKey}`).first<{ id: string }>()
    : await database.prepare("SELECT id FROM credit_reservations WHERE account_id=? AND idempotency_key=? LIMIT 1").bind(accountId, `adjustment:${adjustmentKey}`).first<{ id: string }>();
  if (!row) throw new AdminServiceError("invalid", "The existing Credits audit record has no matching ledger result.");
  return { id: row.id, units };
}

export async function adjustAdminMemberCredits(database: D1Database, actor: AdminActor, input: { memberId: string; units: number; reason: string; idempotencyKey: string }): Promise<{ id: string; units: number }> {
  requirePermission(actor, "admin.credits.adjust");
  const memberId = required(input.memberId, 160, "Invalid member.");
  const reason = required(input.reason, 500, "A reason is required.");
  const idempotencyKey = required(input.idempotencyKey, 200, "An idempotency key is required.");
  if (!Number.isSafeInteger(input.units) || input.units === 0 || Math.abs(input.units) > 1_000_000) throw new AdminServiceError("invalid", "Invalid Credits adjustment.");
  const owner = await targetOwner(database, memberId);
  const auditIdempotencyKey = await scopedKey("admin.credits.adjust", memberId, idempotencyKey);
  const replay = await existingCreditAdjustment(database, owner, memberId, input.units, reason, auditIdempotencyKey, idempotencyKey);
  if (replay) return replay;
  const audit: AuditAppendInput = {
    actorKind: "member",
    actorId: actor.memberId,
    action: "credits.adjusted",
    targetType: "member",
    targetId: memberId,
    reason,
    idempotencyKey: auditIdempotencyKey,
    metadata: { units: input.units },
  };
  try {
    const result = await createCreditStore(database).adjustCredits({
      owner,
      units: input.units,
      adjustmentKey: idempotencyKey,
      eligibleFrom: 0,
      reason,
      policyVersion: "credits-admin-v1",
      policySnapshot: { actor: actor.memberId, source: "admin-control-center-v1" },
      audit,
      auditStrict: true,
    });
    return { id: result.id, units: input.units };
  } catch (error) {
    const replayAfterFailure = await existingCreditAdjustment(database, owner, memberId, input.units, reason, auditIdempotencyKey, idempotencyKey);
    if (replayAfterFailure) return replayAfterFailure;
    throw error;
  }
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
