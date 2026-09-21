import VinTarot from "@/app/vintarot";
import AccountHistory from "@/components/account/account-history";
import { getPageMember, toMemberShellUser } from "@/lib/member-page";

export const dynamic = "force-dynamic";

/* FUNCTIONAL UI — NOT FINAL DESIGN */
export default async function AccountPage() {
  const member = await getPageMember();
  return <VinTarot user={toMemberShellUser(member)} path="/account"><AccountHistory authenticated={Boolean(member)} /></VinTarot>;
}
