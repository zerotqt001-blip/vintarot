import type { D1Database } from "@cloudflare/workers-types";
import { createMemberAuthStore, parseCookie, SESSION_COOKIE_NAME } from "../member-auth";
import { hasPermission, isAdminRole, permissionsForRole, type AdminRole, type Permission } from "./permissions";

export interface AdminActor {
  memberId: string;
  role: AdminRole;
  permissions: ReadonlySet<Permission>;
}

function authorizationError(status: 401 | 403): Response {
  return new Response(JSON.stringify({ error: status === 401 ? "Unauthorized." : "Forbidden." }), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

export async function requirePermission(request: Request, permission: Permission, database: D1Database): Promise<AdminActor> {
  const rawSession = parseCookie(request.headers.get("cookie"), SESSION_COOKIE_NAME);
  if (!rawSession) throw authorizationError(401);
  const member = await createMemberAuthStore(database).readSession(rawSession);
  if (!member) throw authorizationError(401);
  const row = await database.prepare("SELECT id, role, disabled FROM members WHERE id=? LIMIT 1").bind(member.id).first<{ id: string; role: string; disabled: number }>();
  if (!row || Number(row.disabled) !== 0 || !isAdminRole(row.role)) throw authorizationError(401);
  if (!hasPermission(row.role, permission)) throw authorizationError(403);
  return { memberId: row.id, role: row.role, permissions: permissionsForRole(row.role) };
}
