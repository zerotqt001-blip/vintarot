import VinTarot from "@/app/vintarot";
import { CheckoutPage } from "@/app/commerce/commerce-pages";
import { getPageMember, toMemberShellUser } from "@/lib/member-page";

export const dynamic = "force-dynamic";

type CheckoutRouteProps = { searchParams?: Promise<{ package?: string | string[] }> };

/* FUNCTIONAL UI — NOT FINAL DESIGN */
export default async function CheckoutRoute({ searchParams }: CheckoutRouteProps) {
  const member = await getPageMember();
  const params = searchParams ? await searchParams : {};
  const rawPackage = params.package;
  const packageId = Array.isArray(rawPackage) ? rawPackage[0] : rawPackage;
  return <VinTarot user={toMemberShellUser(member)} path="/checkout"><CheckoutPage authenticated={Boolean(member)} packageId={packageId} /></VinTarot>;
}
