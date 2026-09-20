import type { Metadata } from "next";
import { LanguageProvider } from "@/components/language";
import { buildShareImageUrl, resolvePublicOrigin } from "@/lib/tarot-share-config";
import { ShareServiceUnavailableError } from "@/lib/tarot-share-service";
import { ShareTokenError, isShareToken } from "@/lib/tarot-share-identity";
import { getProductionShareService } from "@/lib/tarot-share-runtime";
import { ShareStorageUnavailableError } from "@/lib/tarot-share-store";
import PublicSharePage, { PublicShareError } from "./public-share";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type SharePageProps = { params: Promise<{ token: string }> };

export async function generateMetadata({ params }: SharePageProps): Promise<Metadata> {
  const { token } = await params;
  const validToken = isShareToken(token);
  const origin = resolvePublicOrigin();
  const imageUrl = validToken ? buildShareImageUrl(token, origin) : undefined;
  return {
    title: validToken ? "NaTarot — Shared Tarot reading" : "NaTarot — Shared reading unavailable",
    description: "A private NaTarot Tarot reading shared by invitation.",
    robots: { index: false, follow: false },
    referrer: "no-referrer",
    ...(validToken ? {
      alternates: { canonical: `${origin}/r/${token}` },
      openGraph: {
        title: "NaTarot — Shared Tarot reading",
        description: "A private NaTarot Tarot reading shared by invitation.",
        url: `${origin}/r/${token}`,
        siteName: "NaTarot",
        type: "article",
        images: [{ url: imageUrl!, width: 1200, height: 800, alt: "NaTarot shared Tarot reading" }],
      },
      twitter: { card: "summary_large_image", title: "NaTarot — Shared Tarot reading", description: "A private NaTarot Tarot reading shared by invitation.", images: [imageUrl!] },
    } : {}),
  };
}

export default async function SharePage({ params }: SharePageProps) {
  const { token } = await params;
  let view = null;
  let errorKind: "not-found" | "unavailable" = "not-found";
  if (isShareToken(token)) {
    try {
      view = await (await getProductionShareService()).resolvePublicShare(token);
      if (!view) errorKind = "not-found";
    } catch (error) {
      if (error instanceof ShareTokenError) errorKind = "not-found";
      else if (error instanceof ShareStorageUnavailableError || error instanceof ShareServiceUnavailableError) errorKind = "unavailable";
      else errorKind = "unavailable";
    }
  }
  return <LanguageProvider user={null} initialLocale={view?.locale || "en"}>
    {view ? <PublicSharePage view={view} /> : <PublicShareError kind={errorKind} />}
  </LanguageProvider>;
}
