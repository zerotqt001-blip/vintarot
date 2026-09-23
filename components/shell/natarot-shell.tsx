"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRight, Globe2, HelpCircle, Heart, ShoppingBag, Star, UserRound, Gift } from "lucide-react";
import Link from "next/link";
import { SidebarProvider } from "@/components/ui/sidebar";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import ReferralCapture from "@/components/affiliate/referral-capture";
import { useLanguage } from "@/components/language";
import CelestialBackground from "./celestial-background";
import NaTarotFooter from "./natarot-footer";
import NaTarotHeader from "./natarot-header";
import NaTarotSidebar from "./natarot-sidebar";
import type { NaTarotShellProps, ShellModal, ShellTheme, ShellVariant, Translator } from "./types";

function ArcLabel({ id, text, className = "", curve = "top" }: { id: string; text: string; className?: string; curve?: "top" | "bottom" | "left" }) {
  const path = curve === "bottom"
    ? "M 20 28 A 55 55 0 0 0 130 28"
    : curve === "left"
      ? "M 75 100 A 45 45 0 0 1 75 10"
      : "M 20 82 A 55 55 0 0 1 130 82";
  return <svg className={`arc-label ${className}`.trim()} viewBox="0 0 150 110" aria-hidden="true" focusable="false"><defs><path id={id} d={path} /></defs><text><textPath href={`#${id}`} startOffset="50%" textAnchor="middle">{text}</textPath></text></svg>;
}

function HomeContent({ t }: { t: Translator }) {
  return <section className="home-hero" aria-labelledby="home-heading">
    <div className="home-hero-phase" aria-hidden="true"><span>☾</span><i>◐</i><strong>✦</strong><i>◑</i><span>☽</span></div>
    <h1 id="home-heading">{t("home.hello")}</h1>
    <h2>{t("home.start")}</h2>
    <p className="home-intro">{t("home.intro")}</p>
    <Link className="home-draw-cta" href="/create" aria-label={t("home.drawNow")}><Star size={39} strokeWidth={1.2} /><span>{t("home.drawNow")}</span><ArrowRight size={26} strokeWidth={1.3} /><span className="home-ritual-compat" aria-hidden="true"><ArcLabel id="home-ritual-arc" className="ritual-label" curve="left" text={t("home.drawNow")} /></span></Link>
    <div className="home-value-props" aria-label={t("home.valuesLabel")}>
      <div className="home-value-item"><span className="home-value-icon"><Globe2 size={26} strokeWidth={1.25} /></span><span>{t("home.valueSelf")}</span></div>
      <span className="home-value-divider" aria-hidden="true" />
      <div className="home-value-item"><span className="home-value-icon"><Star size={26} strokeWidth={1.2} /></span><span>{t("home.valueOpenings")}</span></div>
      <span className="home-value-divider" aria-hidden="true" />
      <div className="home-value-item"><span className="home-value-icon"><Heart size={26} strokeWidth={1.2} /></span><span>{t("home.valueAgency")}</span></div>
    </div>
  </section>;
}

function resolveVariant(path: string, hasChildren: boolean): ShellVariant {
  if (path === "/" && !hasChildren) return "home";
  if (path === "/guidebook" || path === "/decks") return "library";
  if (path === "/community") return "practice";
  if (path === "/packages") return "membership";
  if (path === "/affiliate") return "affiliate";
  if (path === "/account") return "account";
  if (path === "/room") return "immersive";
  if (path === "/create") return "create";
  if (path === "/daily-spread") return "daily";
  if (path === "/reading") return "reading";
  return "standard";
}

const commerceNav = [
  ["nav.membership", ShoppingBag, "/packages"],
  ["nav.affiliate", Gift, "/affiliate"],
  ["nav.account", UserRound, "/account"],
] as const;

export default function NaTarotShell({ user, children, path }: NaTarotShellProps) {
  const { t } = useLanguage();
  const hasChildren = Boolean(children);
  const variant = resolveVariant(path, hasChildren);
  const isHome = variant === "home";
  const [modal, setModal] = useState<ShellModal>("");
  const [theme, setTheme] = useState<ShellTheme>("night");
  const shellRef = useRef<HTMLDivElement>(null);
  const profileHref = user ? "/profile" : "/auth?return_to=/profile";
  const accountHref = user ? "/account" : "/auth?return_to=/account";

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

  const toggleTheme = () => setTheme((current) => current === "night" ? "soft" : "night");
  const focusGuidebookSearch = () => window.dispatchEvent(new Event("guidebook:focus-search"));
  const showCommerceAccess = !isHome && variant !== "immersive" && variant !== "library" && variant !== "practice" && variant !== "affiliate" && variant !== "membership";
  const shellThemeClass = theme === "soft" && variant === "membership" ? " membership-shell-soft" : theme === "soft" && variant === "practice" ? " practice-shell-soft" : "";
  const shellClassName = variant === "membership"
    ? `membership-shell${shellThemeClass}`
    : variant === "home"
      ? "home-shell"
      : variant === "immersive"
        ? "site-shell room-shell"
        : variant === "library"
          ? "site-shell guidebook-shell guidebook-target-shell"
          : variant === "create"
            ? "site-shell create-shell"
            : variant === "practice"
              ? `site-shell practice-shell${shellThemeClass}`
              : variant === "daily"
                ? "site-shell daily-shell"
                : variant === "affiliate"
                  ? "site-shell affiliate-shell"
                  : variant === "account"
                    ? "site-shell account-shell"
                    : "site-shell";
  const modalTitle = modal === "collection" ? t("header.collection") : modal === "notifications" ? t("header.notifications") : t("header.help");
  const modalDescription = modal === "notifications" ? t("header.caughtUp") : modal === "collection" ? t("header.collectionText") : t("header.helpText");
  const openModal = (next: Exclude<ShellModal, "">) => setModal(next);

  return <SidebarProvider>
    <ReferralCapture enabled={Boolean(user)} />
    <div ref={shellRef} data-home-atmosphere={isHome ? theme : undefined} data-guidebook-theme={variant === "library" ? theme : undefined} className={shellClassName}>
      <CelestialBackground variant={variant} />
      <NaTarotHeader path={path} variant={variant} t={t} user={user} profileHref={profileHref} accountHref={accountHref} theme={theme} onTheme={toggleTheme} onModal={openModal} onSearch={focusGuidebookSearch} />
      {showCommerceAccess && <>
        <nav className="commerce-access-nav commerce-access-nav--desktop" aria-label={`${t("nav.membership")} / ${t("nav.affiliate")} / ${t("nav.account")}`}>
          {commerceNav.map(([key, Icon, href]) => <Link className={`commerce-access-nav__link${href === path ? " active" : ""}`} key={href} href={href} aria-current={href === path ? "page" : undefined}><Icon size={16} strokeWidth={1.35} /><span>{t(key)}</span></Link>)}
        </nav>
        <nav className="commerce-access-nav commerce-access-nav--mobile" aria-label={`${t("nav.membership")} / ${t("nav.affiliate")} / ${t("nav.account")}`}>
          {commerceNav.map(([key, Icon, href]) => <Link className={`commerce-access-nav__link${href === path ? " active" : ""}`} key={href} href={href} aria-current={href === path ? "page" : undefined}><Icon size={16} strokeWidth={1.35} /><span>{t(key)}</span></Link>)}
        </nav>
      </>}
      <NaTarotSidebar path={path} variant={variant} t={t} user={user} accountHref={accountHref} />
      <main className="main">{children || (isHome ? <HomeContent t={t} /> : null)}</main>
      <NaTarotFooter variant={variant} t={t} />
      {!isHome && variant !== "library" && variant !== "practice" && variant !== "membership" && <button className="help" aria-label={t("header.help")} onClick={() => openModal("help")}><HelpCircle size={23} strokeWidth={1} /></button>}
      <Dialog open={Boolean(modal)} onOpenChange={() => setModal("")}><DialogContent><DialogTitle>{modalTitle}</DialogTitle><DialogDescription>{modalDescription}</DialogDescription><Link href="/guidebook" className="button">{t("home.guidebook")}</Link></DialogContent></Dialog>
    </div>
  </SidebarProvider>;
}
