import VinTarot from "@/app/vintarot";
import { PackagesPage } from "@/app/commerce/commerce-pages";
import { getPageMember, toMemberShellUser } from "@/lib/member-page";

export const dynamic = "force-dynamic";

/* FUNCTIONAL UI — NOT FINAL DESIGN */
export default async function PackagesRoute() {
  const member = await getPageMember();
  return <VinTarot user={toMemberShellUser(member)} path="/packages"><PackagesPage authenticated={Boolean(member)} /></VinTarot>;
}
