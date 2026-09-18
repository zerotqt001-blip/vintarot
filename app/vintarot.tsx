'use client';

import CardMark from "@/components/card-mark";
import { LanguageProvider, LanguageSelect, useLanguage } from "@/components/language";
import { useEffect, useRef, useState } from "react";
import { Moon, BookOpen, Layers, Sparkles, CalendarDays, Gift, AlignLeft, Heart, ShoppingBag, Video, Plus, HelpCircle, ArrowUpRight, ArrowRight } from "lucide-react";
import { SidebarProvider, Sidebar, SidebarContent } from "@/components/ui/sidebar";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";

type User = { name: string; email: string; username: string } | null;

type ArcLabelProps = {
  id: string;
  text: string;
  className?: string;
  curve?: "top" | "bottom" | "left";
};

/**
 * Render a phrase on one continuous SVG path. Keeping the phrase in a
 * textPath prevents CSS transforms from stacking the letters vertically,
 * while still giving the navigation and ritual controls the curved label
 * treatment used by the reference interface.
 */
function ArcLabel({ id, text, className = "", curve = "top" }: ArcLabelProps) {
  const path = curve === "bottom"
    ? "M 20 28 A 55 55 0 0 0 130 28"
    : curve === "left"
      ? "M 75 100 A 45 45 0 0 1 75 10"
      : "M 20 82 A 55 55 0 0 1 130 82";
  return <svg className={`arc-label ${className}`.trim()} viewBox="0 0 150 110" aria-hidden="true" focusable="false">
    <defs><path id={id} d={path} /></defs>
    <text><textPath href={`#${id}`} startOffset="50%" textAnchor="middle">{text}</textPath></text>
  </svg>;
}

export default function VinTarot({ user, children, path = "/" }: { user: User; children?: React.ReactNode; path?: string }) {
  return <LanguageProvider user={user}><VinTarotShell user={user} path={path}>{children}</VinTarotShell></LanguageProvider>;
}

function VinTarotShell({ user, children, path }: { user: User; children?: React.ReactNode; path: string }) {
  const { t } = useLanguage();
  const [modal, setModal] = useState<"" | "collection" | "notifications" | "help">("");
  const isHome = path === "/" && !children;
  const isGuidebook = path === "/guidebook" || path === "/decks";
  const isCreate = path === "/create";
  const isPractice = path === "/community";
  const isRoom = path === "/room";
  const profileHref = user ? "/profile" : "/auth?return_to=/profile";
  const shellRef = useRef<HTMLDivElement>(null);
  const nav = [["nav.home", Moon, "/"], ["nav.decks", Layers, "/guidebook"], ["nav.practice", Sparkles, "/community"], ["nav.book", CalendarDays, "/book"]] as const;
  const topNav = [["nav.home", "/"], ["nav.decks", "/guidebook"], ["nav.practice", "/community"], ["nav.spread", "/daily-spread"], ["nav.book", "/book"]] as const;
  const personal = [["nav.journal", AlignLeft, "/journal"], ["nav.game", Layers, "/game"], ["nav.spread", Sparkles, "/daily-spread"], ["nav.bookings", CalendarDays, "/bookings"], ["nav.invites", Gift, "/invites"]] as const;
  const modalTitle = modal === "collection" ? t("header.collection") : modal === "notifications" ? t("header.notifications") : t("header.help");
  const modalDescription = modal === "notifications" ? t("header.caughtUp") : modal === "collection" ? t("header.collectionText") : t("header.helpText");
  useEffect(() => {
    const shell = shellRef.current;
    if (!shell || !isHome) return;
    let frame = 0;
    let pointerX = 0;
    let pointerY = 0;
    const schedule = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        shell.style.setProperty("--mouse-x", pointerX.toFixed(4));
        shell.style.setProperty("--mouse-y", pointerY.toFixed(4));
        const maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
        shell.style.setProperty("--scroll-progress", (window.scrollY / maxScroll).toFixed(4));
      });
    };
    const onPointerMove = (event: PointerEvent) => {
      pointerX = event.clientX / Math.max(1, window.innerWidth) - 0.5;
      pointerY = event.clientY / Math.max(1, window.innerHeight) - 0.5;
      schedule();
    };
    const onScroll = () => schedule();
    const onResize = () => schedule();
    if (window.matchMedia("(pointer: fine)").matches) window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize, { passive: true });
    schedule();
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
    };
  }, [isHome]);
  return <SidebarProvider><div ref={shellRef} className={isHome ? "home-shell" : isRoom ? "site-shell room-shell" : isGuidebook ? "site-shell guidebook-shell" : isCreate ? "site-shell create-shell" : isPractice ? "site-shell practice-shell" : "site-shell"}>
    {isHome && <div className="cosmic-scene" aria-hidden="true"><div className="cosmic-layer cosmic-sky" /><div className="cosmic-layer cosmic-nebula" /><div className="cosmic-layer cosmic-planets" /><div className="cosmic-layer cosmic-architecture" /><div className="cosmic-layer cosmic-floor" /><div className="cosmic-layer cosmic-foreground" /></div>}
    <header className="topbar">
      <a className="brand" href="/">NaTarot</a>
      <span>{t("header.tagline")}</span>
      <nav className="topbar-nav" aria-label={t("nav.decks")}>
        {topNav.map(([key, href]) => <a className={(href === path || (href === "/guidebook" && path === "/decks")) ? "active" : ""} href={href} key={href}>{t(key)}</a>)}
      </nav>
      <div className="top-actions">
        <LanguageSelect />
        <button aria-label={t("header.shopping")} onClick={() => setModal("collection")}><ShoppingBag size={17} /></button>
        <button aria-label={t("header.notifications")} onClick={() => setModal("notifications")}><Heart size={17} /></button>
        <a className="black button" href="/create">{t("header.room")}</a>
        <a className="avatar" href={profileHref} aria-label={t("header.profile")}><Moon size={20} /></a>
      </div>
    </header>
    <Sidebar collapsible="none" className="site-sidebar"><SidebarContent>
      <nav className="main-nav">{nav.map(([key, Icon, href]) => <a className={(href === path || (href === "/guidebook" && path === "/decks")) ? "active" : ""} href={href} key={href} aria-label={t(key)}><div className="nav-orb"><Icon size={29} strokeWidth={1.3} /></div><ArcLabel id={`nav-arc-${href.replace(/[^a-z0-9]+/gi, "-")}`} text={t(key)} /><span className="mobile-nav-label">{t(key)}</span></a>)}</nav>
      <nav className="personal-nav"><a className="username" href={profileHref}>{user?.username || t("nav.yourSpace")}</a>{personal.map(([key, Icon, href]) => <a key={href} href={href}><Icon size={17} strokeWidth={1.3} />{t(key)}</a>)}</nav>
    </SidebarContent></Sidebar>
    <main className="main">{children || <>
      <section className="ritual-hero"><div className="aura" /><div className="hero-phase" aria-hidden="true">☾ ◐ ✦ ◑ ☽</div><h1>{t("home.hello")}</h1><h2>{t("home.start")}</h2><p className="muted">{t("home.intro")}</p><a className="ritual" href="/create" aria-label={t("home.ritual")}><Plus size={28} /><ArcLabel id="ritual-arc" className="ritual-label" curve="left" text={t("home.ritual")} /></a><p className="ritual-caption">{t("home.ritual")}</p><p className="video-caption"><Video size={15} />{t("home.video")}</p></section>
      <section className="daily-panel"><h2>{t("home.daily")}</h2><p>{t("home.dailyText")}</p><a className="pill" href="/daily-spread">{t("home.social")} <ArrowRight size={15} /></a><div className="daily-cards">{[["home.feel", "feel"], ["home.need", "need"]].map(([key, id]) => <div key={id}><p>{t(key)}:</p><a href="/daily-spread" className="card-back" aria-label={t("home.pull")}><CardMark /></a></div>)}</div><p className="daily-quote">“{t("home.dailyQuote")}”</p><a href="/daily-spread" className="daily-panel-link">{t("home.pull")} <ArrowUpRight size={16} /></a></section>
      <section className="feature-row"><div><h2>{t("home.rhythm")}</h2><p>{t("home.rhythmText")}</p><a href="/community" className="button peach">{t("home.practice")} <ArrowUpRight size={16} /></a></div><div className="feature-cards"><div className="card-back"><CardMark /></div><div className="card-back"><CardMark /></div><div className="card-back"><CardMark /></div></div></section>
      <section className="feature-row reversed"><div><h2>{t("home.digital")}</h2><p>{t("home.digitalText")}</p><a className="button peach" href="/guidebook">{t("home.explore")}</a></div><BookOpen size={120} strokeWidth={0.5} /></section>
    </>}</main>
    <footer><div className="marquee"><span>{t("home.welcome").repeat(8)}</span></div><a href="/guidebook">{t("home.guidebook")}</a><a href={profileHref}>{t("nav.yourSpace")}</a><a href="/privacy">Privacy / Riêng tư</a><a href="/terms">Terms / Điều khoản</a></footer>
    <button className="help" aria-label={t("header.help")} onClick={() => setModal("help")}><HelpCircle size={23} strokeWidth={1} /></button>
    <Dialog open={!!modal} onOpenChange={() => setModal("")}><DialogContent><DialogTitle>{modalTitle}</DialogTitle><DialogDescription>{modalDescription}</DialogDescription><a href="/guidebook" className="button">{t("home.guidebook")}</a></DialogContent></Dialog>
  </div></SidebarProvider>;
}
