"use client";

import { CalendarDays, Crown, Home, Layers, Share2, Sparkles, UserRound } from "lucide-react";
import Link from "next/link";
import { Sidebar, SidebarContent } from "@/components/ui/sidebar";
import type { ShellVariant, NaTarotUser, Translator } from "./types";

type SidebarProps = { path: string; variant: ShellVariant; t: Translator; user: NaTarotUser; accountHref: string };

const navItems = [
  ["nav.home", Home, "/"],
  ["nav.drawNow", Layers, "/create"],
  ["nav.membership", Crown, "/packages"],
  ["nav.affiliate", Share2, "/affiliate"],
  ["nav.account", UserRound, "/account"],
] as const;

function isCurrentPath(path: string, href: string): boolean {
  return href === path;
}

function isVisuallySelected(path: string, href: string): boolean {
  return isCurrentPath(path, href) || (href === "/" && ["/guidebook", "/community"].includes(path));
}

function resolveNavHref(path: string, href: string, accountHref: string): string {
  if (href === "/account") return accountHref;
  if (path === "/guidebook" && href === "/create") return "/room?ritual=1";
  return href;
}

function CanonicalNav({ path, t, accountHref, variant }: SidebarProps) {
  return <nav className={variant === "home" ? "home-primary-nav" : "main-nav nt-global-nav-list"} aria-label={t("nav.primary")}>
    {navItems.map(([key, Icon, href]) => <Link
      className={isVisuallySelected(path, href) ? "active" : ""}
      href={resolveNavHref(path, href, accountHref)}
      key={href}
      aria-label={t(key)}
      aria-current={isCurrentPath(path, href) ? "page" : undefined}
    >
      <span className="nav-orb"><Icon size={26} strokeWidth={1.35} aria-hidden="true" /></span>
      <span className="nav-label">{t(key)}</span>
    </Link>)}
  </nav>;
}

export default function NaTarotSidebar({ path, variant, t, user, accountHref }: SidebarProps) {
  if (variant === "immersive" || variant === "reading") return null;
  const showPersonalNav = !["home", "library", "practice", "membership", "affiliate", "account"].includes(variant);
  return <Sidebar collapsible="none" className="site-sidebar nt-global-sidebar">
    <SidebarContent>
      <CanonicalNav path={path} t={t} user={user} accountHref={accountHref} variant={variant} />
      {variant === "home" ? (
        <span className="home-rail-signature"><strong>NaTarot</strong><small>Find Your Inner Light</small></span>
      ) : (
        <span className="site-rail-signature"><strong>NaTarot</strong><small>Find Your Inner Light</small></span>
      )}
      {showPersonalNav && <nav className="personal-nav">
        <Link className="username" href={user ? "/profile" : "/auth?return_to=/profile"}>{user?.username || t("nav.yourSpace")}</Link>
        <Link href="/daily-spread"><Sparkles size={17} strokeWidth={1.3} />{t("nav.spread")}</Link>
        <Link href="/bookings"><CalendarDays size={17} strokeWidth={1.3} />{t("nav.bookings")}</Link>
      </nav>}
    </SidebarContent>
  </Sidebar>;
}
