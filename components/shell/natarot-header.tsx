"use client";

import Logo from "@/components/brand/logo";
import { LanguageSelect } from "@/components/language";
import Link from "next/link";
import { Heart, Moon, Search, ShoppingBag, UserRound } from "lucide-react";
import type { ShellModal, ShellTheme, ShellVariant, NaTarotUser, Translator } from "./types";

type HeaderProps = {
  path: string;
  variant: ShellVariant;
  t: Translator;
  user: NaTarotUser;
  profileHref: string;
  accountHref: string;
  theme: ShellTheme;
  onTheme: () => void;
  onModal: (modal: Exclude<ShellModal, "">) => void;
  onSearch: () => void;
};

const topNav = [["nav.home", "/"], ["nav.decks", "/guidebook"], ["nav.practice", "/community"], ["nav.spread", "/daily-spread"], ["nav.book", "/book"]] as const;
const simpleTopNav = [["nav.home", "/"], ["nav.decks", "/guidebook"], ["nav.practice", "/community"], ["nav.book", "/book"]] as const;
const guidebookTopNav = [["nav.decks", "/guidebook"], ["nav.practice", "/community"], ["nav.book", "/book"]] as const;

function isActive(path: string, href: string): boolean {
  return href === path || (href === "/guidebook" && path === "/decks");
}

function GuidebookHeader({ path, t, profileHref, theme, onTheme, onModal, onSearch }: HeaderProps) {
  return <header className="guidebook-target-header">
    <div className="guidebook-target-brand">
      <Logo variant="dark" href="/" aria-label="NaTarot" priority />
      <span>{t("header.tagline")}</span>
    </div>
    <nav className="guidebook-target-header-nav" aria-label={t("nav.decks")}>
      {guidebookTopNav.map(([key, href]) => <Link className={isActive(path, href) ? "active" : ""} aria-current={isActive(path, href) ? "page" : undefined} href={href} key={href}>{t(key)}</Link>)}
    </nav>
    <div className="guidebook-target-header-actions">
      <button type="button" className="guidebook-target-icon-button" aria-label={t("header.search")} onClick={onSearch}><Search size={18} strokeWidth={1.35} /></button>
      <button type="button" className="guidebook-target-icon-button" aria-label={t("header.collection")} onClick={() => onModal("collection")}><Heart size={18} strokeWidth={1.35} /></button>
      <LanguageSelect />
      <button type="button" className="guidebook-target-icon-button" aria-label={t("header.theme")} aria-pressed={theme === "soft"} onClick={onTheme}><Moon size={18} strokeWidth={1.35} /></button>
      <Link className="guidebook-target-account" href={profileHref} aria-label={t("nav.targetAccount")}><UserRound size={17} strokeWidth={1.35} /><span>{t("nav.targetAccount")}</span></Link>
    </div>
  </header>;
}

function HeaderNav({ path, t, variant }: Pick<HeaderProps, "path" | "t" | "variant">) {
  const links = variant === "home" ? simpleTopNav : variant === "affiliate" || variant === "membership" || variant === "practice" ? simpleTopNav : topNav;
  return <nav className={variant === "home" ? "home-header-nav" : "topbar-nav"} aria-label={t("nav.decks")}>
    {links.map(([key, href]) => <Link className={isActive(path, href) ? "active" : ""} href={href} key={href}>{t(key)}</Link>)}
  </nav>;
}

function HeaderActions({ variant, t, profileHref, accountHref, theme, onTheme, onModal }: Omit<HeaderProps, "path" | "user" | "onSearch">) {
  if (variant === "practice") return <div className="top-actions">
    <Link className="practice-v1-icon-button" href="/guidebook" aria-label={t("header.search")}><Search size={18} strokeWidth={1.4} /></Link>
    <button className="practice-v1-icon-button" type="button" aria-label={t("header.notifications")} onClick={() => onModal("notifications")}><Heart size={18} strokeWidth={1.4} /></button>
    <LanguageSelect />
    <button className="practice-v1-icon-button" type="button" aria-label={t("header.theme")} aria-pressed={theme === "soft"} onClick={onTheme}><Moon size={18} strokeWidth={1.4} /></button>
    <Link className="practice-v1-account" href={profileHref}><UserRound size={18} strokeWidth={1.4} /><span>{t("nav.account")}</span></Link>
  </div>;
  if (variant === "home") return <div className="top-actions home-header-actions">
    <Link className="home-icon-link" href="/guidebook" aria-label={t("header.search")}><Search size={20} strokeWidth={1.45} /></Link>
    <button className="home-icon-link" type="button" aria-label={t("header.notifications")} onClick={() => onModal("notifications")}><Heart size={20} strokeWidth={1.45} /></button>
    <LanguageSelect />
    <button className="home-icon-link home-theme-toggle" type="button" aria-label={t("header.theme")} aria-pressed={theme === "soft"} onClick={onTheme}><Moon size={20} strokeWidth={1.35} /></button>
    <Link className="home-account-link" href={accountHref}><UserRound size={18} strokeWidth={1.45} /><span>{t("nav.account")}</span></Link>
  </div>;
  if (variant === "affiliate") return <div className="top-actions">
    <Link className="affiliate-top-icon" href="/guidebook" aria-label={t("header.search")}><Search size={18} /></Link>
    <button type="button" aria-label={t("header.notifications")} onClick={() => onModal("notifications")}><Heart size={17} /></button>
    <LanguageSelect />
    <button className="affiliate-theme-mark" type="button" aria-label={t("header.theme")} aria-pressed={theme === "soft"} onClick={onTheme}><Moon size={19} /></button>
    <Link className="avatar" href={profileHref} aria-label={t("header.profile")}><UserRound size={18} /></Link>
  </div>;
  if (variant === "membership") return <div className="top-actions">
    <Link className="membership-icon-button" href="/guidebook" aria-label={t("header.search")}><Search size={17} strokeWidth={1.4} /></Link>
    <button className="membership-icon-button" type="button" aria-label={t("header.collection")} onClick={() => onModal("collection")}><Heart size={17} strokeWidth={1.4} /></button>
    <LanguageSelect />
    <button className="membership-icon-button" type="button" aria-label={t("header.theme")} aria-pressed={theme === "soft"} onClick={onTheme}><Moon size={17} strokeWidth={1.4} /></button>
    <Link className="membership-account-link" href={accountHref}><UserRound size={17} strokeWidth={1.4} /><span>{t("nav.account")}</span></Link>
  </div>;
  return <div className="top-actions">
    <LanguageSelect />
    <button type="button" aria-label={t("header.shopping")} onClick={() => onModal("collection")}><ShoppingBag size={17} /></button>
    <button type="button" aria-label={t("header.notifications")} onClick={() => onModal("notifications")}><Heart size={17} /></button>
    <Link className="black button" href="/create">{t("header.room")}</Link>
    <Link className="avatar" href={profileHref} aria-label={t("header.profile")}><Moon size={20} /></Link>
  </div>;
}

export default function NaTarotHeader(props: HeaderProps) {
  if (props.variant === "library") return <GuidebookHeader {...props} profileHref={props.accountHref} />;
  return <header className="topbar">
    <div className="brand-lockup"><Logo variant="dark" href="/" aria-label="NaTarot" priority={props.variant === "home"} /><span className="brand-tagline">{props.t("header.tagline")}</span></div>
    <HeaderNav path={props.path} t={props.t} variant={props.variant} />
    <HeaderActions variant={props.variant} t={props.t} profileHref={props.profileHref} accountHref={props.accountHref} theme={props.theme} onTheme={props.onTheme} onModal={props.onModal} />
  </header>;
}
