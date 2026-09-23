import VinTarot from "@/app/vintarot";
import AffiliateDashboardPage from "@/components/affiliate/affiliate-dashboard";
import { getPageMember, toMemberShellUser } from "@/lib/member-page";

export const dynamic = "force-dynamic";

export default async function AffiliateRoute() {
  const member = await getPageMember();
  return <VinTarot user={toMemberShellUser(member)} path="/affiliate"><AffiliateDashboardPage authenticated={Boolean(member)} /></VinTarot>;
}
