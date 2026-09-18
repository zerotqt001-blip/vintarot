import VinTarot from "../../vintarot";
import { getPageMember, toMemberShellUser } from "@/lib/member-page";
import { cardBySlug } from "@/lib/tarot";
import { GuidebookCardPage } from "../../pages";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ card: string }> }) {
  const { card: slug } = await params;
  const card = cardBySlug(slug);
  if (!card) notFound();
  const user = toMemberShellUser(await getPageMember());
  return (
    <VinTarot user={user} path="/guidebook">
      <GuidebookCardPage card={card} />
    </VinTarot>
  );
}
