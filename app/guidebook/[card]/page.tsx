import VinTarot from "../../vintarot";
import { getChatGPTUser } from "../../chatgpt-auth";
import { cardBySlug } from "@/lib/tarot";
import { GuidebookCardPage } from "../../pages";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ card: string }> }) {
  const { card: slug } = await params;
  const card = cardBySlug(slug);
  if (!card) notFound();
  const u = await getChatGPTUser();
  const user = u ? { name: u.fullName || u.email.split("@")[0], email: u.email } : null;
  return (
    <VinTarot user={user} path="/guidebook">
      <GuidebookCardPage card={card} />
    </VinTarot>
  );
}
