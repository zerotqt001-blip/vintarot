import VinTarot from "@/app/vintarot";
import AccountHistory from "@/components/account/account-history";
import { getPageMember, toMemberShellUser } from "@/lib/member-page";

export const dynamic = "force-dynamic";

export default async function AccountPage({ searchParams }: { searchParams?: Promise<{ activity?: string | string[] }> }) {
  const member = await getPageMember();
  const params = await searchParams;
  const requestedKind = Array.isArray(params?.activity) ? params.activity[0] : params?.activity;
  const initialKind = requestedKind && ["readings", "shares", "orders", "credits", "affiliate", "all"].includes(requestedKind)
    ? requestedKind as "readings" | "shares" | "orders" | "credits" | "affiliate" | "all"
    : "all";
  return <VinTarot user={toMemberShellUser(member)} path="/account"><AccountHistory authenticated={Boolean(member)} initialKind={initialKind} /></VinTarot>;
}
