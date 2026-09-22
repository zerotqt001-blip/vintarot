'use client';

import Logo from "@/components/brand/logo";
import ReferralCapture from "@/components/affiliate/referral-capture";
import { LanguageProvider, LanguageSelect, useLanguage } from "@/components/language";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, CalendarDays, Camera, CircleUserRound, Gift, Globe2, Heart, HelpCircle, Home, Layers, Moon, Music2, Play, Search, Share2, ShoppingBag, Sparkles, Star, UserRound, Crown } from "lucide-react";
import { SidebarProvider, Sidebar, SidebarContent } from "@/components/ui/sidebar";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";

type User = { name: string; email: string; username: string } | null;

type ArcLabelProps = {
  id: string;
  text: string;
  className?: string;
  curve?: "top" | "bottom" | "left";
};

/* Retained for the non-Home shells, where the original curved navigation remains part of the interaction language. */
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
  const [homeAtmosphere, setHomeAtmosphere] = useState<"night" | "soft">("night");
  const isHome = path === "/" && !children;
  const isGuidebook = path === "/guidebook" || path === "/decks";
  const isCreate = path === "/create";
  const isPractice = path === "/community";
  const isRoom = path === "/room";
  const isDaily = path === "/daily-spread";
  const isMembership = path === "/packages";
  const profileHref = user ? "/profile" : "/auth?return_to=/profile";
  const accountHref = user ? "/account" : "/auth?return_to=/account";
  const [membershipTheme, setMembershipTheme] = useState<"night" | "soft">("night");
  const shellRef = useRef<HTMLDivElement>(null);
  const siteNav = [["nav.home", Home, "/"], ["nav.decks", Layers, "/guidebook"], ["nav.practice", Sparkles, "/community"], ["nav.book", CalendarDays, "/book"]] as const;
  const homeNav = [["nav.home", Home, "/"], ["nav.drawNow", Layers, "/create"], ["nav.membership", Crown, "/packages"], ["nav.affiliate", Gift, "/affiliate"], ["nav.account", CircleUserRound, accountHref]] as const;
  const homeTopNav = [["nav.decks", "/guidebook"], ["nav.practice", "/community"], ["nav.book", "/book"]] as const;
  const topNav = [["nav.home", "/"], ["nav.decks", "/guidebook"], ["nav.practice", "/community"], ["nav.spread", "/daily-spread"], ["nav.book", "/book"]] as const;
  const membershipNav = [["nav.home", Home, "/"], ["nav.drawNow", Layers, "/room"], ["nav.membership", Crown, "/packages"], ["nav.affiliate", Share2, "/affiliate"], ["nav.account", UserRound, accountHref]] as const;
  const membershipTopNav = [["nav.home", "/"], ["nav.decks", "/guidebook"], ["nav.practice", "/community"], ["nav.book", "/book"]] as const;
  const personal = [["nav.journal", Layers, "/journal"], ["nav.game", Layers, "/game"], ["nav.spread", Sparkles, "/daily-spread"], ["nav.bookings", CalendarDays, "/bookings"], ["nav.invites", Gift, "/invites"]] as const;
  const commerceNav = [["nav.membership", ShoppingBag, "/packages"], ["nav.affiliate", Gift, "/affiliate"], ["nav.account", UserRound, "/account"]] as const;
  const renderCommerceAccessLinks = () => commerceNav.map(([key, Icon, href]) => <a className={`commerce-access-nav__link${href === path ? " active" : ""}`} key={href} href={href} aria-current={href === path ? "page" : undefined}><Icon size={16} strokeWidth={1.35} /><span>{t(key)}</span></a>);
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

  const renderHomePrimaryNav = () => homeNav.map(([key, Icon, href]) => {
    const active = href === String(path);
    return <a className={active ? "active" : ""} href={href} key={href} aria-current={active ? "page" : undefined}>
      <span className="nav-orb"><Icon size={27} strokeWidth={1.35} /></span>
      <span className="home-nav-label">{t(key)}</span>
    </a>;
  });

  const renderSitePrimaryNav = () => siteNav.map(([key, Icon, href]) => {
    const active = href === path || (href === "/guidebook" && path === "/decks");
    return <a className={active ? "active" : ""} href={href} key={href} aria-current={active ? "page" : undefined} aria-label={t(key)}>
      <span className="nav-orb"><Icon size={29} strokeWidth={1.3} /></span>
      <ArcLabel id={`nav-arc-${href.replace(/[^a-z0-9]+/gi, "-")}`} text={t(key)} />
      <span className="mobile-nav-label">{t(key)}</span>
    </a>;
  });

  const shellClass = isMembership ? `membership-shell${membershipTheme === "soft" ? " membership-shell-soft" : ""}` : isHome ? "home-shell" : isRoom ? "site-shell room-shell" : isGuidebook ? "site-shell guidebook-shell" : isCreate ? "site-shell create-shell" : isPractice ? "site-shell practice-shell" : isDaily ? "site-shell daily-shell" : "site-shell";
  return <SidebarProvider><ReferralCapture enabled={Boolean(user)} /><div ref={shellRef} data-home-atmosphere={homeAtmosphere} className={shellClass}>
    {isHome && <div className="cosmic-scene" aria-hidden="true"><div className="cosmic-layer cosmic-sky" /><div className="cosmic-layer cosmic-nebula" /><div className="cosmic-layer cosmic-planets" /><div className="cosmic-layer cosmic-architecture" /><div className="cosmic-layer cosmic-floor" /><div className="cosmic-layer cosmic-foreground" /></div>}
    <header className="topbar">
      <div className="brand-lockup">
        <Logo variant="dark" href="/" aria-label="NaTarot" priority={isHome} />
        <span className="brand-tagline">{t("header.tagline")}</span>
      </div>
      {isHome ? <nav className="home-header-nav" aria-label={t("nav.decks")}>
        {homeTopNav.map(([key, href]) => <a className={(href === String(path) || (href === "/guidebook" && String(path) === "/decks")) ? "active" : ""} href={href} key={href}>{t(key)}</a>)}
      </nav> : <nav className="topbar-nav" aria-label={t("nav.decks")}>
        {(isMembership ? membershipTopNav : topNav).map(([key, href]) => <a className={(href === path || (href === "/guidebook" && path === "/decks")) ? "active" : ""} href={href} key={href}>{t(key)}</a>)}
      </nav>}
      {isHome ? <div className="top-actions home-header-actions">
        <a className="home-icon-link" href="/guidebook" aria-label={t("header.search")}><Search size={20} strokeWidth={1.45} /></a>
        <button className="home-icon-link" type="button" aria-label={t("header.notifications")} onClick={() => setModal("notifications")}><Heart size={20} strokeWidth={1.45} /></button>
        <LanguageSelect />
        <button className="home-icon-link home-theme-toggle" type="button" aria-label={t("header.theme")} onClick={() => setHomeAtmosphere((value) => value === "night" ? "soft" : "night")}><Moon size={20} strokeWidth={1.35} /></button>
        <a className="home-account-link" href={accountHref}><UserRound size={18} strokeWidth={1.45} /><span>{t("nav.account")}</span></a>
      </div> : isMembership ? <div className="top-actions">
        <Link className="membership-icon-button" href="/guidebook" aria-label={t("header.search")}><Search size={17} strokeWidth={1.4} /></Link>
        <button className="membership-icon-button" type="button" aria-label={t("header.collection")} onClick={() => setModal("collection")}><Heart size={17} strokeWidth={1.4} /></button>
        <LanguageSelect />
        <button className="membership-icon-button" type="button" aria-label={t("header.theme")} aria-pressed={membershipTheme === "soft"} onClick={() => setMembershipTheme((value) => value === "night" ? "soft" : "night")}><Moon size={17} strokeWidth={1.4} /></button>
        <Link className="membership-account-link" href={accountHref}><UserRound size={17} strokeWidth={1.4} /><span>{t("nav.account")}</span></Link>
      </div> : <div className="top-actions">
        <LanguageSelect />
        <button aria-label={t("header.shopping")} onClick={() => setModal("collection")}><ShoppingBag size={17} /></button>
        <button aria-label={t("header.notifications")} onClick={() => setModal("notifications")}><Heart size={17} /></button>
        <a className="black button" href="/create">{t("header.room")}</a>
        <a className="avatar" href={profileHref} aria-label={t("header.profile")}><Moon size={20} /></a>
      </div>}
    </header>
    {!isHome && !isRoom && !isMembership && <nav className="commerce-access-nav commerce-access-nav--desktop" aria-label={`${t("nav.membership")} / ${t("nav.affiliate")} / ${t("nav.account")}`}>
      {renderCommerceAccessLinks()}
    </nav>}
    {!isHome && !isRoom && !isMembership && <nav className="commerce-access-nav commerce-access-nav--mobile" aria-label={`${t("nav.membership")} / ${t("nav.affiliate")} / ${t("nav.account")}`}>
      {renderCommerceAccessLinks()}
    </nav>}
    <Sidebar collapsible="none" className="site-sidebar"><SidebarContent>
      {isHome ? <nav className="home-primary-nav" aria-label={t("nav.home")}>{renderHomePrimaryNav()}<span className="home-rail-signature"><strong>NaTarot</strong><small>Find Your Inner Light</small></span></nav> : isMembership ? <nav className="main-nav" aria-label={t("nav.membership")}>{membershipNav.map(([key, Icon, href]) => <a className={href === path ? "active" : ""} href={href} key={href} aria-label={t(key)} aria-current={href === path ? "page" : undefined}><span className="nav-orb"><Icon size={29} strokeWidth={1.3} /></span><ArcLabel id={`membership-nav-arc-${href.replace(/[^a-z0-9]+/gi, "-")}`} text={t(key)} /><span className="mobile-nav-label">{t(key)}</span></a>)}</nav> : <nav className="main-nav">{renderSitePrimaryNav()}</nav>}
      {!isHome && !isMembership && <nav className="personal-nav"><a className="username" href={profileHref}>{user?.username || t("nav.yourSpace")}</a>{personal.map(([key, Icon, href]) => <a key={href} href={href}><Icon size={17} strokeWidth={1.3} />{t(key)}</a>)}</nav>}
      {isMembership && <div className="membership-sidebar-signoff"><span>NaTarot</span><small>Find Your Inner Light</small></div>}
    </SidebarContent></Sidebar>
    <main className="main">{children || <section className="home-hero" aria-labelledby="home-heading">
      <div className="home-hero-phase" aria-hidden="true"><span>☾</span><i>◐</i><strong>✦</strong><i>◑</i><span>☽</span></div>
      <h1 id="home-heading">{t("home.hello")}</h1>
      <h2>{t("home.start")}</h2>
      <p className="home-intro">{t("home.intro")}</p>
          <a className="home-draw-cta" href="/create" aria-label={t("home.drawNow")}><Star size={39} strokeWidth={1.2} /><span>{t("home.drawNow")}</span><ArrowRight size={26} strokeWidth={1.3} /><span className="home-ritual-compat" aria-hidden="true"><ArcLabel id="home-ritual-arc" className="ritual-label" curve="left" text={t("home.drawNow")} /></span></a>
      <div className="home-value-props" aria-label={t("home.valuesLabel")}>
        <div className="home-value-item"><span className="home-value-icon"><Globe2 size={26} strokeWidth={1.25} /></span><span>{t("home.valueSelf")}</span></div>
        <span className="home-value-divider" aria-hidden="true" />
        <div className="home-value-item"><span className="home-value-icon"><Star size={26} strokeWidth={1.2} /></span><span>{t("home.valueOpenings")}</span></div>
        <span className="home-value-divider" aria-hidden="true" />
        <div className="home-value-item"><span className="home-value-icon"><Heart size={26} strokeWidth={1.2} /></span><span>{t("home.valueAgency")}</span></div>
      </div>
    </section>}</main>
    {isHome ? <footer className="home-footer">
      <div className="home-footer-brand"><Logo variant="dark" href="/" compact /><span>{t("header.tagline")}</span></div>
          <nav className="home-footer-links" aria-label={t("home.footerLinks")}><a href="/guidebook">{t("home.explore")}</a><a href="/privacy">{t("home.privacy")}</a><a href="/terms">{t("home.terms")}</a></nav>
      <div className="home-footer-socials" aria-hidden="true"><span><Heart size={17} /></span><span><Play size={16} /></span><span><Camera size={17} /></span><span><Music2 size={17} /></span></div>
    </footer> : isMembership ? <footer className="membership-footer"><Logo variant="dark" href="/" compact /><span className="membership-footer-tagline">{t("header.tagline")}</span><nav><Link href="/guidebook">{t("home.guidebook")}</Link><Link href="/privacy">{t("footer.privacy")}</Link><Link href="/terms">{t("footer.terms")}</Link></nav><div className="membership-footer-socials" aria-label="Social links"><span aria-label={t("footer.facebook")}><b aria-hidden="true">f</b></span><span aria-label={t("footer.youtube")}><Play size={17} strokeWidth={1.4} /></span><span aria-label={t("footer.instagram")}><Camera size={17} strokeWidth={1.4} /></span><span aria-label={t("footer.tiktok")}><Music2 size={17} strokeWidth={1.4} /></span></div></footer> : <footer><Logo variant="dark" href="/" compact /><div className="marquee"><span>{t("home.welcome").repeat(8)}</span></div><a href="/guidebook">{t("home.guidebook")}</a><a href={profileHref}>{t("nav.yourSpace")}</a><a href="/privacy">Privacy / Riêng tư</a><a href="/terms">Terms / Điều khoản</a></footer>}
    {!isHome && !isMembership && <button className="help" aria-label={t("header.help")} onClick={() => setModal("help")}><HelpCircle size={23} strokeWidth={1} /></button>}
    <Dialog open={!!modal} onOpenChange={() => setModal("")}><DialogContent><DialogTitle>{modalTitle}</DialogTitle><DialogDescription>{modalDescription}</DialogDescription><a href="/guidebook" className="button">{t("home.guidebook")}</a></DialogContent></Dialog>
  </div></SidebarProvider>;
}
