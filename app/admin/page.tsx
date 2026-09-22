import VinTarot from "@/app/vintarot";
import AdminConsole from "@/app/admin/admin-console";
import { getPageMember, toMemberShellUser } from "@/lib/member-page";

export const dynamic = "force-dynamic";

/* FUNCTIONAL UI — NOT FINAL DESIGN */
export default async function AdminPage() {
  const member = await getPageMember();
  return <VinTarot user={toMemberShellUser(member)} path="/admin"><AdminConsole authenticated={Boolean(member)} /></VinTarot>;
}
