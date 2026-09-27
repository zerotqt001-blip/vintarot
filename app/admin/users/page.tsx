import { notFound } from "next/navigation";
import VinTarot from "@/app/vintarot";
import UserDirectory from "@/app/admin/users/user-directory";
import { getPageMember, toMemberShellUser } from "@/lib/member-page";
import { getRuntimeDatabase } from "@/lib/runtime";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  const member = await getPageMember();
  if (!member) notFound();
  const row = await getRuntimeDatabase().prepare("SELECT role,disabled FROM members WHERE id=? LIMIT 1").bind(member.id).first<{ role: string; disabled: number }>();
  if (row?.role !== "SUPER_ADMIN" || Number(row.disabled) !== 0) notFound();
  return <VinTarot user={toMemberShellUser(member)} path="/admin/users"><UserDirectory /></VinTarot>;
}
