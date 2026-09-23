import VinTarot from "@/app/vintarot";
import { AffiliatePage } from "@/app/commerce/commerce-pages";
import { getPageMember, toMemberShellUser } from "@/lib/member-page";

export const dynamic = "force-dynamic";

/* FUNCTIONAL UI — NOT FINAL DESIGN */
export default async function AffiliateRoute() {
  const member = await getPageMember();
  return <VinTarot user={toMemberShellUser(member)} path="/affiliate"><AffiliatePage authenticated={Boolean(member)} /></VinTarot>;
}
