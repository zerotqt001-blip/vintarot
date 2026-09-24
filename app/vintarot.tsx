'use client';

import Logo from "@/components/brand/logo";
import ReferralCapture from "@/components/affiliate/referral-capture";
import { LanguageProvider, LanguageSelect, useLanguage } from "@/components/language";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, CalendarDays, Camera, CirclePlay, CircleUserRound, Gift, Globe2, Heart, HelpCircle, Home, Layers, Moon, Music2, Play, Search, Share2, ShoppingBag, Sparkles, Star, UserRound, Crown } from "lucide-react";
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

type Translator = (key: string) => string;
type GuidebookTargetTheme = "night" | "soft";

const guidebookTargetHeaderNav = [
  ["nav.decks", "/guidebook"],
  ["nav.practice", "/community"],
  ["nav.book", "/book"],
] as const;

const guidebookTargetNav = [
  ["nav.home", Home, "/"],
  ["nav.drawNow", Sparkles, "/room?ritual=1"],
  ["nav.targetMembership", Crown, "/packages"],
  ["nav.affiliate", Share2, "/affiliate"],
  ["nav.targetAccount", UserRound, "/account"],
] as const;

function GuidebookTargetHeader({
  path,
  t,
  theme,
  profileHref,
  onSearch,
  onCollection,
  onTheme,
}: {
  path: string;
  t: Translator;
  theme: GuidebookTargetTheme;
  profileHref: string;
  onSearch: () => void;
  onCollection: () => void;
  onTheme: () => void;
}) {
  return (
    <header className="guidebook-target-header">
      <div className="guidebook-target-brand">
        <Logo variant="dark" href="/" aria-label="NaTarot" priority />
        <span>{t("header.tagline")}</span>
      </div>
      <nav className="guidebook-target-header-nav" aria-label={t("nav.decks")}>
        {guidebookTargetHeaderNav.map(([key, href]) => (
          <a className={href === path || (href === "/guidebook" && path === "/decks") ? "active" : ""} aria-current={href === path || (href === "/guidebook" && path === "/decks") ? "page" : undefined} href={href} key={href}>
            {t(key)}
          </a>
        ))}
      </nav>
      <div className="guidebook-target-header-actions">
        <button type="button" className="guidebook-target-icon-button" aria-label={t("header.search")} onClick={onSearch}>
          <Search size={18} strokeWidth={1.35} />
        </button>
        <button type="button" className="guidebook-target-icon-button" aria-label={t("header.collection")} onClick={onCollection}>
          <Heart size={18} strokeWidth={1.35} />
        </button>
        <LanguageSelect />
        <button type="button" className="guidebook-target-icon-button" aria-label={t("header.theme")} aria-pressed={theme === "soft"} onClick={onTheme}>
          <Moon size={18} strokeWidth={1.35} />
        </button>
        <a className="guidebook-target-account" href={profileHref} aria-label={t("nav.targetAccount")}>
          <UserRound size={17} strokeWidth={1.35} />
          <span>{t("nav.targetAccount")}</span>
        </a>
      </div>
    </header>
  );
}

function GuidebookTargetSidebar({ t }: { t: Translator }) {
  const links = guidebookTargetNav.map(([key, Icon, href]) => (
    <a className={href === "/" ? "active" : ""} href={href} key={href}>
      <span className="guidebook-target-sidebar-icon"><Icon size={24} strokeWidth={1.25} /></span>
      <span>{t(key)}</span>
    </a>
  ));
  return (
    <>
      <aside className="guidebook-target-sidebar" aria-label={t("nav.primary")}>
        <nav className="guidebook-target-sidebar-nav">{links}</nav>
        <div className="guidebook-target-sidebar-signoff"><strong>NaTarot</strong><span>Find Your Inner Light</span></div>
      </aside>
      <nav className="guidebook-target-mobile-nav" aria-label={t("nav.primary")}>{links}</nav>
    </>
  );
}

function GuidebookTargetFooter({ t }: { t: Translator }) {
  return (
    <footer className="guidebook-target-footer">
      <div className="guidebook-target-footer-brand"><Logo variant="dark" href="/" compact /><span>{t("header.tagline")}</span></div>
      <nav aria-label={t("nav.footer")}>
        <a href="/guidebook">{t("auth.footerGuide")}</a>
        <a href="/privacy">{t("auth.footerPrivacy")}</a>
        <a href="/terms">{t("auth.footerTerms")}</a>
      </nav>
    </footer>
  );
}

export default function VinTarot({ user, children, path = "/" }: { user: User; children?: React.ReactNode; path?: string }) {
  return <LanguageProvider user={user}><VinTarotShell user={user} path={path}>{children}</VinTarotShell></LanguageProvider>;
}

function VinTarotShell({ user, children, path }: { user: User; children?: React.ReactNode; path: string }) {
  const { t } = useLanguage();
  const [modal, setModal] = useState<"" | "collection" | "notifications" | "help">("");
  const [practiceTheme, setPracticeTheme] = useState<"night" | "soft">("night");
  const [guidebookTheme, setGuidebookTheme] = useState<GuidebookTargetTheme>("night");
  const [homeAtmosphere, setHomeAtmosphere] = useState<"night" | "soft">("night");
  const isHome = path === "/" && !children;
  const isBook = path === "/book";
  const isGuidebook = path === "/guidebook" || path === "/decks";
  const isCreate = path === "/create";
  const isPractice = path === "/community";
  const isRoom = path === "/room";
  const isDaily = path === "/daily-spread";
  const isAffiliate = path === "/affiliate";
  const isMembership = path === "/packages";
  const profileHref = user ? "/profile" : "/auth?return_to=/profile";
  const accountHref = user ? "/account" : "/auth?return_to=/account";
  const [membershipTheme, setMembershipTheme] = useState<"night" | "soft">("night");
  const shellRef = useRef<HTMLDivElement>(null);
  const siteNav = [["nav.home", Home, "/"], ["nav.decks", Layers, "/guidebook"], ["nav.practice", Sparkles, "/community"], ["nav.book", CalendarDays, "/book"]] as const;
  const homeNav = [["nav.home", Home, "/"], ["nav.drawNow", Layers, "/create"], ["nav.membership", Crown, "/packages"], ["nav.affiliate", Gift, "/affiliate"], ["nav.account", CircleUserRound, accountHref]] as const;
  const bookingHomeNav = [["nav.home", Home, "/"], ["nav.decks", Layers, "/guidebook"], ["nav.practice", Sparkles, "/community"], ["nav.spread", Star, "/daily-spread"], ["nav.book", CalendarDays, "/book"]] as const;
  const affiliateNav = [["nav.home", Home, "/"], ["nav.drawNow", Layers, "/room"], ["nav.membership", Crown, "/packages"], ["nav.affiliate", Share2, "/affiliate"], ["nav.account", UserRound, "/account"]] as const;
  const homeTopNav = [["nav.decks", "/guidebook"], ["nav.practice", "/community"], ["nav.book", "/book"]] as const;
  const topNav = [["nav.home", "/"], ["nav.decks", "/guidebook"], ["nav.practice", "/community"], ["nav.spread", "/daily-spread"], ["nav.book", "/book"]] as const;
  const affiliateTopNav = [["nav.home", "/"], ["nav.decks", "/guidebook"], ["nav.practice", "/community"], ["nav.book", "/book"]] as const;
  const membershipNav = [["nav.home", Home, "/"], ["nav.drawNow", Layers, "/room"], ["nav.membership", Crown, "/packages"], ["nav.affiliate", Share2, "/affiliate"], ["nav.account", UserRound, accountHref]] as const;
  const membershipTopNav = [["nav.home", "/"], ["nav.decks", "/guidebook"], ["nav.practice", "/community"], ["nav.book", "/book"]] as const;
  const practiceNav = [["nav.home", Moon, "/"], ["nav.drawNow", Layers, "/room"], ["nav.membership", Crown, "/packages"], ["nav.affiliate", Share2, "/affiliate"], ["nav.account", UserRound, accountHref]] as const;
  const practiceTopNav = [["nav.home", "/"], ["nav.decks", "/guidebook"], ["nav.practice", "/community"], ["nav.book", "/book"]] as const;
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
  const focusGuidebookSearch = () => window.dispatchEvent(new Event("guidebook:focus-search"));
  const renderHomePrimaryNav = () => homeNav.map(([key, Icon, href]) => {
    const active = href === String(path);
    return <a className={active ? "active" : ""} href={href} key={href} aria-current={active ? "page" : undefined}>
      <span className="nav-orb"><Icon size={27} strokeWidth={1.35} /></span>
      <span className="home-nav-label">{t(key)}</span>
    </a>;
  });

  const renderBookingPrimaryNav = () => bookingHomeNav.map(([key, Icon, href]) => {
    const active = href === String(path);
    return <a className={active ? "active" : ""} href={href} key={href} aria-current={active ? "page" : undefined}>
      <span className="nav-orb"><Icon size={27} strokeWidth={1.35} /></span>
      <span className="home-nav-label">{t(key)}</span>
    </a>;
  });

  const renderSitePrimaryNav = () => siteNav.map(([key, Icon, href]) => {
    const active = href === path || (href === "/guidebook" && path === "/decks");
    return <a className={active ? "active" : ""} href={href} key={href} aria-current={active ? "page" : undefined}>
      <span className="nav-orb"><Icon size={29} strokeWidth={1.3} /></span>
      <ArcLabel id={`nav-arc-${href.replace(/[^a-z0-9]+/gi, "-")}`} text={t(key)} />
      <span className="mobile-nav-label">{t(key)}</span>
    </a>;
  });

  const renderAffiliatePrimaryNav = () => affiliateNav.map(([key, Icon, href]) => {
    const active = href === path;
    return <a className={active ? "active" : ""} href={href} key={href} aria-current={active ? "page" : undefined} aria-label={t(key)}>
      <span className="nav-orb"><Icon size={29} strokeWidth={1.3} /></span>
      <ArcLabel id={`affiliate-nav-arc-${href.replace(/[^a-z0-9]+/gi, "-")}`} text={t(key)} />
      <span className="mobile-nav-label">{t(key)}</span>
    </a>;
  });

  const shellClassName = isMembership ? `membership-shell${membershipTheme === "soft" ? " membership-shell-soft" : ""}` : isHome ? "home-shell" : isBook ? "home-shell booking-shell" : isRoom ? "site-shell room-shell" : isGuidebook ? "site-shell guidebook-shell guidebook-target-shell" : isCreate ? "site-shell create-shell" : isPractice ? `site-shell practice-shell${practiceTheme === "soft" ? " practice-shell-soft" : ""}` : isDaily ? "site-shell daily-shell" : isAffiliate ? "site-shell affiliate-shell" : "site-shell";
  return <SidebarProvider><ReferralCapture enabled={Boolean(user)} /><div ref={shellRef} data-home-atmosphere={homeAtmosphere} data-guidebook-theme={isGuidebook ? guidebookTheme : undefined} className={shellClassName}>
    {isHome && <div className="cosmic-scene" aria-hidden="true"><div className="cosmic-layer cosmic-sky" /><div className="cosmic-layer cosmic-nebula" /><div className="cosmic-layer cosmic-planets" /><div className="cosmic-layer cosmic-architecture" /><div className="cosmic-layer cosmic-floor" /><div className="cosmic-layer cosmic-foreground" /></div>}
    {isGuidebook && <GuidebookTargetHeader path={path} t={t} theme={guidebookTheme} profileHref="/account" onSearch={focusGuidebookSearch} onCollection={() => setModal("collection")} onTheme={() => setGuidebookTheme((current) => current === "night" ? "soft" : "night")} />}
    {!isGuidebook && (
      <header className="topbar">
      <div className="brand-lockup">
        <Logo variant="dark" href="/" aria-label="NaTarot" priority={isHome} />
        <span className="brand-tagline">{t("header.tagline")}</span>
      </div>
      {isPractice ? <nav className="topbar-nav" aria-label={t("nav.decks")}>
        {practiceTopNav.map(([key, href]) => <a className={(href === String(path) || (href === "/guidebook" && String(path) === "/decks")) ? "active" : ""} href={href} key={href}>{t(key)}</a>)}
      </nav> : isHome || isBook ? <nav className="home-header-nav" aria-label={t("nav.decks")}>
        {homeTopNav.map(([key, href]) => <a className={(href === String(path) || (href === "/guidebook" && String(path) === "/decks")) ? "active" : ""} href={href} key={href}>{t(key)}</a>)}
      </nav> : <nav className="topbar-nav" aria-label={t("nav.decks")}>
        {(isAffiliate ? affiliateTopNav : isMembership ? membershipTopNav : topNav).map(([key, href]) => <a className={(href === path || (href === "/guidebook" && path === "/decks")) ? "active" : ""} href={href} key={href}>{t(key)}</a>)}
      </nav>}
      {isPractice ? <div className="top-actions">
        <a className="practice-v1-icon-button" href="/guidebook" aria-label={t("header.search")}><Search size={18} strokeWidth={1.4} /></a>
        <button className="practice-v1-icon-button" type="button" aria-label={t("header.notifications")} onClick={() => setModal("notifications")}><Heart size={18} strokeWidth={1.4} /></button>
        <LanguageSelect />
        <button className="practice-v1-icon-button" type="button" aria-label={t("header.theme")} aria-pressed={practiceTheme === "soft"} onClick={() => setPracticeTheme((value) => value === "night" ? "soft" : "night")}><Moon size={18} strokeWidth={1.4} /></button>
        <a className="practice-v1-account" href={profileHref}><UserRound size={18} strokeWidth={1.4} /><span>{t("nav.account")}</span></a>
      </div> : isHome || isBook ? <div className="top-actions home-header-actions">
        <a className="home-icon-link" href="/guidebook" aria-label={t("header.search")}><Search size={20} strokeWidth={1.45} /></a>
        <button className="home-icon-link" type="button" aria-label={t("header.notifications")} onClick={() => setModal("notifications")}><Heart size={20} strokeWidth={1.45} /></button>
        <LanguageSelect />
        <button className="home-icon-link home-theme-toggle" type="button" aria-label={t("header.theme")} onClick={() => setHomeAtmosphere((value) => value === "night" ? "soft" : "night")}><Moon size={20} strokeWidth={1.35} /></button>
        <a className="home-account-link" href={accountHref}><UserRound size={18} strokeWidth={1.45} /><span>{t("nav.account")}</span></a>
      </div> : isAffiliate ? <div className="top-actions">
        <a className="affiliate-top-icon" href="/guidebook" aria-label={t("header.search")}><Search size={18} /></a>
        <button type="button" aria-label={t("header.notifications")} onClick={() => setModal("notifications")}><Heart size={17} /></button>
        <LanguageSelect />
        <span className="affiliate-theme-mark" aria-hidden="true"><Moon size={19} /></span>
        <a className="avatar" href={profileHref} aria-label={t("header.profile")}><UserRound size={18} /></a>
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
    )}
    {!isHome && !isBook && !isRoom && !isGuidebook && !isPractice && !isAffiliate && !isMembership && <nav className="commerce-access-nav commerce-access-nav--desktop" aria-label={`${t("nav.membership")} / ${t("nav.affiliate")} / ${t("nav.account")}`}>
      {renderCommerceAccessLinks()}
    </nav>}
    {!isHome && !isBook && !isRoom && !isGuidebook && !isPractice && !isAffiliate && !isMembership && <nav className="commerce-access-nav commerce-access-nav--mobile" aria-label={`${t("nav.membership")} / ${t("nav.affiliate")} / ${t("nav.account")}`}>
      {renderCommerceAccessLinks()}
    </nav>}
    {isGuidebook ? <GuidebookTargetSidebar t={t} /> : <Sidebar collapsible="none" className="site-sidebar"><SidebarContent>
      {isHome || isCreate || isBook ? <nav className="home-primary-nav" aria-label={t("nav.primary")}>{isBook ? renderBookingPrimaryNav() : renderHomePrimaryNav()}<span className="home-rail-signature"><strong>NaTarot</strong><small>Find Your Inner Light</small></span></nav> : isPractice ? <nav className="main-nav">{practiceNav.map(([key, Icon, href]) => {
        const active = String(href) === String(path);
        const variant = href === "/" ? "home" : href === "/room" ? "cards" : "book";
        return <a className={active ? "active" : ""} href={href} key={href} aria-label={t(key)} aria-current={active ? "page" : undefined}>
          <div className={`nav-orb nav-orb-${variant}`} data-nav-icon={variant}><Icon size={29} strokeWidth={1.3} aria-hidden="true" /></div>
          <ArcLabel id={`nav-arc-practice-${href.replace(/[^a-z0-9]+/gi, "-")}`} text={t(key)} />
          <span className="mobile-nav-label">{t(key)}</span>
        </a>;
      })}</nav> : isAffiliate ? <nav className="main-nav">{renderAffiliatePrimaryNav()}</nav> : isMembership ? <nav className="main-nav" aria-label={t("nav.membership")}>{membershipNav.map(([key, Icon, href]) => <a className={href === path ? "active" : ""} href={href} key={href} aria-label={t(key)} aria-current={href === path ? "page" : undefined}><span className="nav-orb"><Icon size={29} strokeWidth={1.3} /></span><ArcLabel id={`membership-nav-arc-${href.replace(/[^a-z0-9]+/gi, "-")}`} text={t(key)} /><span className="mobile-nav-label">{t(key)}</span></a>)}</nav> : <nav className="main-nav">{renderSitePrimaryNav()}</nav>}
      {isPractice ? <div className="practice-v1-sidebar-signoff"><span>NaTarot</span><small>{t("nav.innerLight")}</small></div> : !isHome && !isBook && !isAffiliate && !isMembership && <nav className="personal-nav"><a className="username" href={profileHref}>{user?.username || t("nav.yourSpace")}</a>{personal.map(([key, Icon, href]) => <a key={href} href={href}><Icon size={17} strokeWidth={1.3} />{t(key)}</a>)}</nav>}
      {isMembership && <div className="membership-sidebar-signoff"><span>NaTarot</span><small>Find Your Inner Light</small></div>}
    </SidebarContent></Sidebar>}
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
    {isGuidebook ? <GuidebookTargetFooter t={t} /> : isHome || isBook ? <footer className="home-footer">
      <div className="home-footer-brand"><Logo variant="dark" href="/" compact /><span>{t("header.tagline")}</span></div>
      <nav className="home-footer-links" aria-label={t("home.footerLinks")}><a href="/guidebook">{t("home.explore")}</a><a href="/privacy">{t("home.privacy")}</a><a href="/terms">{t("home.terms")}</a></nav>
      <div className="home-footer-socials" aria-hidden="true"><span><Heart size={17} /></span><span><Play size={16} /></span><span><Camera size={17} /></span><span><Music2 size={17} /></span></div>
    </footer> : isPractice ? <footer className="practice-v1-footer">
      <Logo variant="dark" href="/" compact />
      <span className="practice-v1-footer-tagline">{t("header.tagline")}</span>
      <nav className="practice-v1-footer-links"><a href="/guidebook">{t("home.guidebook")}</a><a href="/privacy">{t("footer.privacy")}</a><a href="/terms">{t("footer.terms")}</a></nav>
      <div className="practice-v1-socials" aria-label="Social links"><span aria-label={t("footer.facebook")}><b className="practice-v1-social-letter" aria-hidden="true">f</b></span><span aria-label={t("footer.youtube")}><CirclePlay size={18} strokeWidth={1.35} /></span><span aria-label={t("footer.instagram")}><Camera size={18} strokeWidth={1.35} /></span><span aria-label={t("footer.tiktok")}><Music2 size={18} strokeWidth={1.35} /></span></div>
    </footer> : isAffiliate ? <footer className="affiliate-footer"><Logo variant="dark" href="/" compact /><span className="affiliate-footer-tagline">{t("header.tagline")}</span><div className="affiliate-footer-links"><a href="/guidebook">{t("home.guidebook")}</a><a href="/privacy">{t("footer.privacy")}</a><a href="/terms">{t("footer.terms")}</a></div></footer> : isMembership ? <footer className="membership-footer"><Logo variant="dark" href="/" compact /><span className="membership-footer-tagline">{t("header.tagline")}</span><nav><Link href="/guidebook">{t("home.guidebook")}</Link><Link href="/privacy">{t("footer.privacy")}</Link><Link href="/terms">{t("footer.terms")}</Link></nav><div className="membership-footer-socials" aria-label="Social links"><span aria-label={t("footer.facebook")}><b aria-hidden="true">f</b></span><span aria-label={t("footer.youtube")}><Play size={17} strokeWidth={1.4} /></span><span aria-label={t("footer.instagram")}><Camera size={17} strokeWidth={1.4} /></span><span aria-label={t("footer.tiktok")}><Music2 size={17} strokeWidth={1.4} /></span></div></footer> : <footer><Logo variant="dark" href="/" compact /><div className="marquee"><span>{t("home.welcome").repeat(8)}</span></div><a href="/guidebook">{t("home.guidebook")}</a><a href={profileHref}>{t("nav.yourSpace")}</a><a href="/privacy">Privacy / Riêng tư</a><a href="/terms">Terms / Điều khoản</a></footer>}
    {!isHome && !isBook && !isGuidebook && !isPractice && !isMembership && <button className="help" aria-label={t("header.help")} onClick={() => setModal("help")}><HelpCircle size={23} strokeWidth={1} /></button>}
    <Dialog open={!!modal} onOpenChange={() => setModal("")}><DialogContent><DialogTitle>{modalTitle}</DialogTitle><DialogDescription>{modalDescription}</DialogDescription><a href="/guidebook" className="button">{t("home.guidebook")}</a></DialogContent></Dialog>
  </div></SidebarProvider>;
}
