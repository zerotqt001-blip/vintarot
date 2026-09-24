import VinTarot from "@/app/vintarot";
import AdminConsole from "@/app/admin/admin-console";
import { ReaderManager } from "@/app/admin/readers/reader-manager";
import { getPageMember, toMemberShellUser } from "@/lib/member-page";
import { hasPermission, isAdminRole } from "@/lib/admin/permissions";
import { db } from "@/lib/server";

export const dynamic = "force-dynamic";

/* FUNCTIONAL UI — NOT FINAL DESIGN */
export default async function AdminPage() {
  const member = await getPageMember();
  const roleRow = member ? await db().prepare("SELECT role,disabled FROM members WHERE id=? LIMIT 1").bind(member.id).first<{ role: string; disabled: number }>() : null;
  const role = roleRow?.role;
  const activeRole = Number(roleRow?.disabled ?? 1) === 0 && isAdminRole(role) ? role : null;
  const canManageReaders = activeRole ? hasPermission(activeRole, "admin.readers.manage") : false;
  const canOpenDashboard = activeRole ? hasPermission(activeRole, "admin.dashboard.read") : false;
  return <VinTarot user={toMemberShellUser(member)} path="/admin">{canManageReaders && !canOpenDashboard ? <ReaderManager authenticated={Boolean(member)} showBackLink={false} /> : <AdminConsole authenticated={Boolean(member)} canManageReaders={canManageReaders} />}</VinTarot>;
}
