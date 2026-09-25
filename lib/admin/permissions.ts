export const ADMIN_ROLES = ["USER", "SUPPORT", "FINANCE", "CONTENT_ADMIN", "ADMIN", "SUPER_ADMIN"] as const;
export type AdminRole = (typeof ADMIN_ROLES)[number];

export const ADMIN_PERMISSIONS = [
  "admin.dashboard.read",
  "admin.users.read",
  "admin.users.status",
  "admin.roles.manage",
  "admin.sessions.read",
  "admin.sessions.revoke",
  "admin.credits.adjust",
  "admin.vip.adjust",
  "admin.orders.read",
  "admin.readings.read",
  "admin.readers.manage",
  "admin.affiliate.read",
  "admin.affiliate.manage",
  "admin.affiliate.adjust",
  "admin.audit.read",
  "admin.security.manage",
] as const;
export type Permission = (typeof ADMIN_PERMISSIONS)[number];

const permissionMatrix: Record<AdminRole, ReadonlySet<Permission>> = {
  USER: new Set(),
  SUPPORT: new Set(["admin.dashboard.read", "admin.users.read", "admin.users.status", "admin.sessions.read", "admin.sessions.revoke", "admin.orders.read"]),
  FINANCE: new Set(["admin.dashboard.read", "admin.users.read", "admin.credits.adjust", "admin.vip.adjust", "admin.orders.read", "admin.affiliate.read", "admin.affiliate.adjust", "admin.audit.read"]),
  CONTENT_ADMIN: new Set(["admin.readers.manage"]),
  ADMIN: new Set([
    "admin.dashboard.read",
    "admin.users.read",
    "admin.users.status",
    "admin.sessions.read",
    "admin.sessions.revoke",
    "admin.credits.adjust",
    "admin.vip.adjust",
    "admin.orders.read",
    "admin.readings.read",
    "admin.readers.manage",
    "admin.affiliate.read",
    "admin.affiliate.manage",
    "admin.affiliate.adjust",
    "admin.audit.read",
  ]),
  SUPER_ADMIN: new Set(ADMIN_PERMISSIONS),
};

export function isAdminRole(value: unknown): value is AdminRole {
  return typeof value === "string" && (ADMIN_ROLES as readonly string[]).includes(value);
}

export function permissionsForRole(role: AdminRole): ReadonlySet<Permission> {
  return permissionMatrix[role];
}

export function hasPermission(role: AdminRole, permission: Permission): boolean {
  return permissionMatrix[role].has(permission);
}
