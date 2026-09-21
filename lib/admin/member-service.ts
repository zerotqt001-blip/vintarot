import type { D1Database } from "@cloudflare/workers-types";
import { createAuditService } from "../audit/service";
import type { AdminActor } from "./context";
import { hasPermission, isAdminRole, type AdminRole, type Permission } from "./permissions";

export class AdminServiceError extends Error {
  readonly code: "forbidden" | "invalid" | "not_found";

  constructor(code: "forbidden" | "invalid" | "not_found", message: string) {
    super(message);
    this.name = "AdminServiceError";
    this.code = code;
  }
}

export interface MemberAdminView {
  id: string;
  username: string;
  email: string;
  phone: string;
  displayName: string | null;
  role: AdminRole;
  disabled: boolean;
  disabledAt: number | null;
  disabledReason: string | null;
  createdAt: number;
  updatedAt: number;
  lastLoginAt: number | null;
}

export interface MemberSessionView {
  sessionId: string;
  memberId: string;
  createdAt: number;
  expiresAt: number;
  lastSeenAt: number;
  revokedAt: number | null;
}

function requirePermission(actor: AdminActor, permission: Permission): void {
  if (!hasPermission(actor.role, permission)) throw new AdminServiceError("forbidden", "Forbidden.");
}

function required(value: string, max: number): string {
  const normalized = value.trim();
  if (!normalized || normalized.length > max) throw new AdminServiceError("invalid", "Invalid admin mutation.");
  return normalized;
}

function memberProjection(row: Record<string, unknown>): MemberAdminView {
  const role = String(row.role);
  if (!isAdminRole(role)) throw new AdminServiceError("invalid", "Invalid member role.");
  return {
    id: String(row.id),
    username: String(row.username),
    email: String(row.email),
    phone: String(row.phone),
    displayName: row.display_name == null ? null : String(row.display_name),
    role,
    disabled: Number(row.disabled) === 1,
    disabledAt: row.disabled_at == null ? null : Number(row.disabled_at),
    disabledReason: row.disabled_reason == null ? null : String(row.disabled_reason),
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
    lastLoginAt: row.last_login_at == null ? null : Number(row.last_login_at),
  };
}

async function getMember(database: D1Database, memberId: string): Promise<MemberAdminView> {
  const row = await database.prepare("SELECT id, username, email, phone, display_name, role, disabled, disabled_at, disabled_reason, created_at, updated_at, last_login_at FROM members WHERE id=? LIMIT 1").bind(memberId).first<Record<string, unknown>>();
  if (!row) throw new AdminServiceError("not_found", "Member not found.");
  return memberProjection(row);
}

async function alreadyApplied(database: D1Database, idempotencyKey: string): Promise<boolean> {
  const row = await database.prepare("SELECT 1 AS present FROM audit_events WHERE idempotency_key=? LIMIT 1").bind(idempotencyKey).first<{ present: number }>();
  return Boolean(row?.present);
}

async function auditMutation(database: D1Database, actor: AdminActor, action: string, targetId: string, reason: string, idempotencyKey: string, metadata: unknown): Promise<void> {
  await createAuditService(database).append({
    actorKind: "member",
    actorId: actor.memberId,
    action,
    targetType: "member",
    targetId,
    reason,
    idempotencyKey,
    metadata,
  });
}

export async function listMembers(database: D1Database, actor: AdminActor, limit = 50): Promise<MemberAdminView[]> {
  requirePermission(actor, "admin.users.read");
  const boundedLimit = Math.max(1, Math.min(50, Math.trunc(limit)));
  const result = await database.prepare("SELECT id, username, email, phone, display_name, role, disabled, disabled_at, disabled_reason, created_at, updated_at, last_login_at FROM members ORDER BY created_at DESC, id DESC LIMIT ?").bind(boundedLimit).all<Record<string, unknown>>();
  return result.results.map(memberProjection);
}

export async function getMemberDetail(database: D1Database, actor: AdminActor, memberId: string): Promise<MemberAdminView> {
  requirePermission(actor, "admin.users.read");
  return getMember(database, required(memberId, 160));
}

export async function setMemberStatus(database: D1Database, actor: AdminActor, input: { memberId: string; disabled: boolean; reason: string; idempotencyKey: string }, now = Date.now): Promise<MemberAdminView> {
  requirePermission(actor, "admin.users.status");
  const memberId = required(input.memberId, 160);
  const reason = required(input.reason, 500);
  const idempotencyKey = `admin.member.status:${required(input.idempotencyKey, 200)}`;
  if (await alreadyApplied(database, idempotencyKey)) return getMember(database, memberId);
  const timestamp = now();
  const result = await database.prepare("UPDATE members SET disabled=?, disabled_at=?, disabled_reason=?, disabled_by=?, updated_at=? WHERE id=?").bind(
    input.disabled ? 1 : 0,
    input.disabled ? timestamp : null,
    input.disabled ? reason : null,
    input.disabled ? actor.memberId : null,
    timestamp,
    memberId,
  ).run();
  if (Number(result.meta.changes) !== 1) throw new AdminServiceError("not_found", "Member not found.");
  if (input.disabled) {
    await database.prepare("UPDATE auth_sessions SET revoked_at=? WHERE member_id=? AND revoked_at IS NULL").bind(timestamp, memberId).run();
  }
  await auditMutation(database, actor, input.disabled ? "member.disabled" : "member.enabled", memberId, reason, idempotencyKey, { disabled: input.disabled });
  return getMember(database, memberId);
}

export async function setMemberRole(database: D1Database, actor: AdminActor, input: { memberId: string; role: AdminRole; reason: string; idempotencyKey: string }, now = Date.now): Promise<MemberAdminView> {
  requirePermission(actor, "admin.roles.manage");
  const memberId = required(input.memberId, 160);
  const reason = required(input.reason, 500);
  const idempotencyKey = `admin.member.role:${required(input.idempotencyKey, 200)}`;
  if (!isAdminRole(input.role)) throw new AdminServiceError("invalid", "Invalid admin mutation.");
  if (await alreadyApplied(database, idempotencyKey)) return getMember(database, memberId);
  const result = await database.prepare("UPDATE members SET role=?, updated_at=? WHERE id=?").bind(input.role, now(), memberId).run();
  if (Number(result.meta.changes) !== 1) throw new AdminServiceError("not_found", "Member not found.");
  await auditMutation(database, actor, "member.role.changed", memberId, reason, idempotencyKey, { role: input.role });
  return getMember(database, memberId);
}

export async function listMemberSessions(database: D1Database, actor: AdminActor, memberId = actor.memberId): Promise<MemberSessionView[]> {
  requirePermission(actor, "admin.sessions.read");
  const result = await database.prepare("SELECT session_id, member_id, created_at, expires_at, last_seen_at, revoked_at FROM auth_sessions WHERE member_id=? AND session_id IS NOT NULL ORDER BY created_at DESC, session_id DESC LIMIT 50").bind(required(memberId, 160)).all<Record<string, unknown>>();
  return result.results.map((row) => ({
    sessionId: String(row.session_id),
    memberId: String(row.member_id),
    createdAt: Number(row.created_at),
    expiresAt: Number(row.expires_at),
    lastSeenAt: Number(row.last_seen_at),
    revokedAt: row.revoked_at == null ? null : Number(row.revoked_at),
  }));
}

export async function revokeMemberSession(database: D1Database, actor: AdminActor, input: { memberId: string; sessionId: string; reason: string; idempotencyKey: string }, now = Date.now): Promise<boolean> {
  requirePermission(actor, "admin.sessions.revoke");
  const memberId = required(input.memberId, 160);
  const sessionId = required(input.sessionId, 160);
  const reason = required(input.reason, 500);
  const idempotencyKey = `admin.session.revoke:${required(input.idempotencyKey, 200)}`;
  if (await alreadyApplied(database, idempotencyKey)) return true;
  const result = await database.prepare("UPDATE auth_sessions SET revoked_at=? WHERE session_id=? AND member_id=? AND revoked_at IS NULL").bind(now(), sessionId, memberId).run();
  if (Number(result.meta.changes) !== 1) throw new AdminServiceError("not_found", "Session not found.");
  await auditMutation(database, actor, "member.session.revoked", memberId, reason, idempotencyKey, { sessionId });
  return true;
}
