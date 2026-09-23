"use client";

import { CalendarDays, Crown, Gift, Home, Layers, Share2, Sparkles, UserRound } from "lucide-react";
import { Sidebar, SidebarContent } from "@/components/ui/sidebar";
import type { ShellVariant, NaTarotUser, Translator } from "./types";

type SidebarProps = { path: string; variant: ShellVariant; t: Translator; user: NaTarotUser; accountHref: string };

function ArcLabel({ id, text }: { id: string; text: string }) {
  return <svg className="arc-label" viewBox="0 0 150 110" aria-hidden="true" focusable="false"><defs><path id={id} d="M 20 82 A 55 55 0 0 1 130 82" /></defs><text><textPath href={`#${id}`} startOffset="50%" textAnchor="middle">{text}</textPath></text></svg>;
}

const navItems = [
  ["nav.home", Home, "/"],
  ["nav.drawNow", Layers, "/create"],
  ["nav.membership", Crown, "/packages"],
  ["nav.affiliate", Share2, "/affiliate"],
  ["nav.account", UserRound, "/account"],
] as const;

const siteNav = [
  ["nav.home", Home, "/"],
  ["nav.decks", Layers, "/guidebook"],
  ["nav.practice", Sparkles, "/community"],
  ["nav.book", CalendarDays, "/book"],
] as const;

function activePath(path: string, href: string): boolean {
  return href === path || (href === "/guidebook" && path === "/decks");
}

function CanonicalNav({ path, t, accountHref, variant }: Pick<SidebarProps, "path" | "t" | "accountHref"> & { variant: ShellVariant }) {
  return <nav className={variant === "home" ? "home-primary-nav" : "main-nav"} aria-label={t("nav.primary")}>
    {navItems.map(([key, Icon, href]) => <a className={activePath(path, href) ? "active" : ""} href={href === "/account" ? accountHref : href} key={href} aria-label={t(key)} aria-current={activePath(path, href) ? "page" : undefined}>
      <span className="nav-orb"><Icon size={29} strokeWidth={1.3} aria-hidden="true" /></span>
      <ArcLabel id={`nav-arc-${href.slice(1).replace(/[^a-z0-9]+/gi, "-") || "home"}`} text={t(key)} />
      <span className="mobile-nav-label">{t(key)}</span>
    </a>)}
  </nav>;
}

function SiteNav({ path, t }: Pick<SidebarProps, "path" | "t">) {
  return <nav className="main-nav" aria-label={t("nav.primary")}>
    {siteNav.map(([key, Icon, href]) => <a className={activePath(path, href) ? "active" : ""} href={href} key={href} aria-label={t(key)} aria-current={activePath(path, href) ? "page" : undefined}>
      <span className="nav-orb"><Icon size={29} strokeWidth={1.3} aria-hidden="true" /></span>
      <ArcLabel id={`site-nav-arc-${href.slice(1).replace(/[^a-z0-9]+/gi, "-") || "home"}`} text={t(key)} />
      <span className="mobile-nav-label">{t(key)}</span>
    </a>)}
  </nav>;
}

function GuidebookSidebar({ t }: { t: Translator }) {
  return <>
    <aside className="guidebook-target-sidebar" aria-label={t("nav.primary")}><nav className="guidebook-target-sidebar-nav">{navItems.map(([key, Icon, href]) => <a className={href === "/" ? "active" : ""} href={href} key={href}><span className="guidebook-target-sidebar-icon"><Icon size={24} strokeWidth={1.25} /></span><span>{t(key)}</span></a>)}</nav><div className="guidebook-target-sidebar-signoff"><strong>NaTarot</strong><span>Find Your Inner Light</span></div></aside>
    <nav className="guidebook-target-mobile-nav" aria-label={t("nav.primary")}>{navItems.map(([key, Icon, href]) => <a href={href} key={href}><span className="guidebook-target-sidebar-icon"><Icon size={24} strokeWidth={1.25} /></span><span>{t(key)}</span></a>)}</nav>
  </>;
}

export default function NaTarotSidebar({ path, variant, t, user, accountHref }: SidebarProps) {
  if (variant === "immersive" || variant === "reading") return null;
  if (variant === "library") return <GuidebookSidebar t={t} />;
  const canonical = variant === "home" || variant === "practice" || variant === "membership" || variant === "affiliate" || variant === "account";
  return <Sidebar collapsible="none" className="site-sidebar"><SidebarContent>
    {canonical ? <><CanonicalNav path={path} t={t} accountHref={accountHref} variant={variant} />{variant === "home" && <span className="home-rail-signature"><strong>NaTarot</strong><small>Find Your Inner Light</small></span>}</> : <SiteNav path={path} t={t} />}
    {variant === "practice" && <div className="practice-v1-sidebar-signoff"><span>NaTarot</span><small>{t("nav.innerLight")}</small></div>}
    {variant !== "home" && variant !== "practice" && variant !== "membership" && variant !== "affiliate" && <nav className="personal-nav"><a className="username" href={user ? "/profile" : "/auth?return_to=/profile"}>{user?.username || t("nav.yourSpace")}</a><a href="/daily-spread"><Sparkles size={17} strokeWidth={1.3} />{t("nav.spread")}</a><a href="/bookings"><CalendarDays size={17} strokeWidth={1.3} />{t("nav.bookings")}</a></nav>}
    {variant === "membership" && <div className="membership-sidebar-signoff"><span>NaTarot</span><small>Find Your Inner Light</small></div>}
  </SidebarContent></Sidebar>;
}
