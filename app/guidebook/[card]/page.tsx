import VinTarot from "../../vintarot";
import { requirePageMember, toMemberShellUser } from "@/lib/member-page";
import { cardBySlug } from "@/lib/tarot";
import { GuidebookCardPage } from "../../pages";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ card: string }> }) {
  const { card: slug } = await params;
  const user = toMemberShellUser(await requirePageMember(`/guidebook/${slug}`));
  const card = cardBySlug(slug);
  if (!card) notFound();
  return (
    <VinTarot user={user} path="/guidebook">
      <GuidebookCardPage card={card} />
    </VinTarot>
  );
}
