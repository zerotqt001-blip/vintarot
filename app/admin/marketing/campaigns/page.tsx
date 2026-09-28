import { notFound } from "next/navigation";
import VinTarot from "@/app/vintarot";
import { getPageMember, toMemberShellUser } from "@/lib/member-page";
import { getRuntimeDatabase } from "@/lib/runtime";
import CampaignManager from "./campaign-manager";

export const dynamic = "force-dynamic";

export default async function MarketingCampaignsPage() {
  const member = await getPageMember();
  if (!member) notFound();
  const role = await getRuntimeDatabase().prepare("SELECT role,disabled FROM members WHERE id=? LIMIT 1")
    .bind(member.id).first<{ role: string; disabled: number }>();
  if (role?.role !== "SUPER_ADMIN" || Number(role.disabled) !== 0) notFound();
  return <VinTarot user={toMemberShellUser(member)} path="/admin/marketing/campaigns"><CampaignManager /></VinTarot>;
}
