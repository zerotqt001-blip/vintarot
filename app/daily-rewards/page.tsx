import VinTarot from "@/app/vintarot";
import { getPageMember, toMemberShellUser } from "@/lib/member-page";
import DailyRewards from "./daily-rewards";

export const dynamic = "force-dynamic";

export default async function DailyRewardsPage() {
  const member = await getPageMember();
  return <VinTarot user={toMemberShellUser(member)} path="/daily-rewards"><DailyRewards authenticated={Boolean(member)} /></VinTarot>;
}
