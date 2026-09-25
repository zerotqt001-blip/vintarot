import VinTarot from "@/app/vintarot";
import { ReaderManager } from "@/app/admin/readers/reader-manager";
import { getPageMember, toMemberShellUser } from "@/lib/member-page";

export const dynamic = "force-dynamic";

export default async function AdminReadersPage() {
  const member = await getPageMember();
  return <VinTarot user={toMemberShellUser(member)} path="/admin/readers"><ReaderManager authenticated={Boolean(member)} /></VinTarot>;
}
