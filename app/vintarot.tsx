'use client';

import CardMark from "@/components/card-mark";
import { LanguageProvider, LanguageSelect, useLanguage } from "@/components/language";
import { useState } from "react";
import { Moon, BookOpen, Layers, Sparkles, CalendarDays, Gift, AlignLeft, Heart, ShoppingBag, Video, Plus, HelpCircle, ArrowUpRight } from "lucide-react";
import { SidebarProvider, Sidebar, SidebarContent } from "@/components/ui/sidebar";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";

type User = { name: string; email: string } | null;

export default function VinTarot({ user, children, path = "/" }: { user: User; children?: React.ReactNode; path?: string }) {
  return <LanguageProvider user={user}><VinTarotShell user={user} path={path}>{children}</VinTarotShell></LanguageProvider>;
}

function VinTarotShell({ user, children, path }: { user: User; children?: React.ReactNode; path: string }) {
  const { t } = useLanguage();
  const [modal, setModal] = useState<"" | "collection" | "notifications" | "help">("");
  const nav = [["nav.home", Moon, "/"], ["nav.decks", Layers, "/decks"], ["nav.practice", Sparkles, "/community"], ["nav.book", CalendarDays, "/book"]] as const;
  const personal = [["nav.journal", AlignLeft, "/journal"], ["nav.game", Layers, "/game"], ["nav.spread", Sparkles, "/daily-spread"], ["nav.bookings", CalendarDays, "/bookings"], ["nav.invites", Gift, "/invites"]] as const;
  const modalTitle = modal === "collection" ? t("header.collection") : modal === "notifications" ? t("header.notifications") : t("header.help");
  const modalDescription = modal === "notifications" ? t("header.caughtUp") : modal === "collection" ? t("header.collectionText") : t("header.helpText");
  return <SidebarProvider>
    <header className="topbar">
      <a className="brand" href="/">VinTarot</a>
      <span>{t("header.tagline")}</span>
      <div className="top-actions">
        <LanguageSelect />
        <button aria-label={t("header.shopping")} onClick={() => setModal("collection")}><ShoppingBag size={17} /></button>
        <button aria-label={t("header.notifications")} onClick={() => setModal("notifications")}><Heart size={17} /></button>
        <a className="black button" href="/create">{t("header.room")}</a>
        <a className="avatar" href="/profile" aria-label={t("header.profile")}><Moon size={20} /></a>
      </div>
    </header>
    <Sidebar collapsible="none" className="site-sidebar"><SidebarContent>
      <nav className="main-nav">{nav.map(([key, Icon, href]) => <a className={(href === path || (href === "/decks" && path === "/guidebook")) ? "active" : ""} href={href} key={href}><span>{t(key)}</span><div className="nav-orb"><Icon size={29} strokeWidth={1.3} /></div></a>)}</nav>
      <nav className="personal-nav"><a className="username" href="/profile">{user?.name || t("nav.yourSpace")}</a>{personal.map(([key, Icon, href]) => <a key={href} href={href}><Icon size={17} strokeWidth={1.3} />{t(key)}</a>)}</nav>
    </SidebarContent></Sidebar>
    <main className="main">{children || <>
      <section className="ritual-hero"><div className="aura" /><h1>{t("home.hello")}</h1><h2>{t("home.start")}</h2><p className="muted">{t("home.intro")}</p><a className="ritual" href="/create" aria-label={t("home.ritual")}><Plus size={28} /><span>{t("home.ritual")}</span></a><p className="video-caption"><Video size={15} />{t("home.video")}</p></section>
      <section className="daily-panel"><h2>{t("home.daily")}</h2><p>{t("home.dailyText")}</p><span className="pill">{t("home.social")}</span><div className="daily-cards">{[["home.feel", "feel"], ["home.need", "need"]].map(([key, id]) => <div key={id}><p>{t(key)}:</p><a href="/daily-spread" className="card-back" aria-label={t("home.pull")}><CardMark /></a></div>)}</div><a href="/daily-spread" className="button black">{t("home.pull")}</a></section>
      <section className="feature-row"><div><h2>{t("home.rhythm")}</h2><p>{t("home.rhythmText")}</p><a href="/community" className="button peach">{t("home.practice")} <ArrowUpRight size={16} /></a></div><div className="feature-cards"><div className="card-back"><CardMark /></div><div className="card-back"><CardMark /></div><div className="card-back"><CardMark /></div></div></section>
      <section className="feature-row reversed"><div><h2>{t("home.digital")}</h2><p>{t("home.digitalText")}</p><a className="button peach" href="/decks">{t("home.explore")}</a></div><BookOpen size={120} strokeWidth={0.5} /></section>
    </>}</main>
    <footer><div className="marquee"><span>{t("home.welcome").repeat(8)}</span></div><a href="/guidebook">{t("home.guidebook")}</a><a href="/profile">{t("nav.yourSpace")}</a></footer>
    <button className="help" aria-label={t("header.help")} onClick={() => setModal("help")}><HelpCircle size={23} strokeWidth={1} /></button>
    <Dialog open={!!modal} onOpenChange={() => setModal("")}><DialogContent><DialogTitle>{modalTitle}</DialogTitle><DialogDescription>{modalDescription}</DialogDescription><a href="/guidebook" className="button">{t("home.guidebook")}</a></DialogContent></Dialog>
  </SidebarProvider>;
}
