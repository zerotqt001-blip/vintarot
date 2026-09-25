"use client";

import Logo from "@/components/brand/logo";
import { LanguageSelect } from "@/components/language";
import Link from "next/link";
import { UserRound } from "lucide-react";
import type { ShellVariant, Translator } from "./types";

type HeaderProps = {
  path: string;
  variant: ShellVariant;
  t: Translator;
  accountHref: string;
};

const topNav = [
  ["nav.home", "/"],
  ["nav.decks", "/guidebook"],
  ["nav.practice", "/community"],
  ["nav.book", "/book"],
] as const;

function isActive(path: string, href: string): boolean {
  return href === path || (href === "/guidebook" && path === "/decks");
}

function HeaderNav({ path, t, variant }: Pick<HeaderProps, "path" | "t" | "variant">) {
  const className = variant === "home" ? "home-header-nav" : "nt-global-nav";
  return <nav className={className} aria-label={t("nav.decks")}>
    {topNav.map(([key, href]) => <Link
      className={isActive(path, href) ? "active" : ""}
      aria-current={isActive(path, href) ? "page" : undefined}
      href={href}
      key={href}
    >{t(key)}</Link>)}
  </nav>;
}

function HeaderActions({ variant, t, accountHref }: Pick<HeaderProps, "variant" | "t" | "accountHref">) {
  const isHome = variant === "home";
  return <div className={isHome ? "top-actions home-header-actions" : "nt-global-actions"}>
    <LanguageSelect />
    <Link className={isHome ? "home-account-link" : "nt-global-account"} href={accountHref}>
      <UserRound size={18} strokeWidth={1.4} />
      <span>{t("nav.account")}</span>
    </Link>
  </div>;
}

export default function NaTarotHeader(props: HeaderProps) {
  const isHome = props.variant === "home";
  return <header className={isHome ? "topbar home-global-header" : "nt-global-header"}>
    <div className="brand-lockup nt-global-brand">
      <Logo variant="dark" href="/" aria-label="NaTarot" priority={isHome} />
      <span className="brand-tagline">{props.t("header.tagline")}</span>
    </div>
    <HeaderNav path={props.path} t={props.t} variant={props.variant} />
    <HeaderActions
      variant={props.variant}
      t={props.t}
      accountHref={props.accountHref}
    />
  </header>;
}
