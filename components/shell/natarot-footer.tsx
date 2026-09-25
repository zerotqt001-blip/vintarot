import Logo from "@/components/brand/logo";
import { Camera, CirclePlay, Heart, Music2 } from "lucide-react";
import Link from "next/link";
import type { ShellVariant, Translator } from "./types";

export default function NaTarotFooter({ variant, t }: { variant: ShellVariant; t: Translator }) {
  if (variant === "immersive" || variant === "reading") return null;

  if (variant === "home") return <footer className="home-footer">
    <div className="home-footer-brand"><Logo variant="dark" href="/" compact /><span>{t("header.tagline")}</span></div>
    <nav className="home-footer-links" aria-label={t("home.footerLinks")}>
      <Link href="/guidebook">{t("home.explore")}</Link>
      <Link href="/privacy">{t("home.privacy")}</Link>
      <Link href="/terms">{t("home.terms")}</Link>
    </nav>
    <div className="home-footer-socials" aria-hidden="true">
      <span><Heart size={17} /></span><span><CirclePlay size={16} /></span><span><Camera size={17} /></span><span><Music2 size={17} /></span>
    </div>
  </footer>;

  return <footer className="site-footer">
    <div className="site-footer-brand">
      <Logo variant="dark" href="/" compact />
      <span>{t("header.tagline")}</span>
    </div>
    <nav className="site-footer-links" aria-label={t("nav.footer")}>
      <Link href="/guidebook">{t("auth.footerGuide")}</Link>
      <Link href="/privacy">{t("auth.footerPrivacy")}</Link>
      <Link href="/terms">{t("auth.footerTerms")}</Link>
    </nav>
    <div className="site-footer-socials" aria-label="Social links">
      <span aria-label={t("footer.facebook")}><b aria-hidden="true">f</b></span>
      <span aria-label={t("footer.youtube")}><CirclePlay size={17} strokeWidth={1.4} /></span>
      <span aria-label={t("footer.instagram")}><Camera size={17} strokeWidth={1.4} /></span>
      <span aria-label={t("footer.tiktok")}><Music2 size={17} strokeWidth={1.4} /></span>
    </div>
  </footer>;
}
