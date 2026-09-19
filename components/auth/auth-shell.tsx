"use client";

import type { ReactNode } from "react";
import { ArrowRightIcon, LoaderCircleIcon, SparklesIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { LanguageSelect, useLanguage } from "@/components/language";
import Logo from "@/components/brand/logo";
import { cn } from "@/lib/utils";

type AuthShellProps = {
  title: string;
  subtitle: string;
  titleId: string;
  status?: string;
  state?: string;
  cardClassName?: string;
  children: ReactNode;
};

type AuthFieldProps = {
  label: ReactNode;
  htmlFor: string;
  icon: ReactNode;
  labelAction?: ReactNode;
  hint?: ReactNode;
  hintId?: string;
  error?: ReactNode;
  errorId?: string;
  className?: string;
  children: ReactNode;
};

type AuthPrimaryButtonProps = {
  children: ReactNode;
  busy?: boolean;
  disabled?: boolean;
  type?: "button" | "submit" | "reset";
  endIcon?: ReactNode;
};

export function AuthBrand() {
  const { t } = useLanguage();
  return (
    <div className="auth-brand-lockup">
      <Image className="auth-brand-lockup__icon" src="/brand/natarot-icon.svg" width={128} height={128} alt="" priority />
      <span className="auth-brand-lockup__name">NaTarot</span>
      <p className="auth-brand-lockup__tagline">
        {t("auth.brandTagline")}
        <br />
        <em>{t("auth.brandSubline")}</em>
      </p>
    </div>
  );
}

export function AuthFooter() {
  const { t } = useLanguage();
  return (
    <footer className="auth-shell__footer">
      <Logo variant="dark" href="/" compact />
      <p>{t("auth.footerCopyright")}</p>
      <nav aria-label="Footer" className="auth-shell__footer-links">
        <Link href="/guidebook">{t("auth.footerGuide")}</Link>
        <Link href="/privacy">{t("auth.footerPrivacy")}</Link>
        <a href="mailto:zerotqt001@gmail.com">{t("auth.footerContact")}</a>
      </nav>
    </footer>
  );
}

export function AuthField({ label, htmlFor, icon, labelAction, hint, hintId, error, errorId, className, children }: AuthFieldProps) {
  return (
    <div className={cn("auth-field", error && "auth-field--error", className)}>
      <div className="auth-field__label-row">
        <label htmlFor={htmlFor}>{label}</label>
        {labelAction}
      </div>
      <div className="auth-field__control">
        <span className="auth-field__icon" aria-hidden="true">{icon}</span>
        {children}
      </div>
      {hint && <p id={hintId} className="auth-field__hint">{hint}</p>}
      {error && <p id={errorId} className="auth-field__error" role="alert">{error}</p>}
    </div>
  );
}

export function AuthPrimaryButton({ children, busy = false, disabled = false, type = "submit", endIcon }: AuthPrimaryButtonProps) {
  return (
    <button className="auth-primary" type={type} disabled={disabled || busy} aria-busy={busy || undefined}>
      <span className="auth-primary__label">{busy ? <LoaderCircleIcon className="auth-primary__loader" size={18} aria-hidden="true" /> : <SparklesIcon size={18} aria-hidden="true" />}{children}</span>
      {endIcon || <ArrowRightIcon className="auth-primary__arrow" size={21} aria-hidden="true" />}
    </button>
  );
}

export function AuthDivider() {
  return (
    <div className="auth-divider" aria-hidden="true">
      <span />
      <SparklesIcon size={13} />
      <span />
    </div>
  );
}

export function AuthGoogleButton({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a className="auth-google" href={href}>
      <span className="auth-google__mark" aria-hidden="true">G</span>
      <span>{children}</span>
    </a>
  );
}

function AuthHeader() {
  const { t } = useLanguage();
  return (
    <header className="auth-shell__header">
      <div className="auth-shell__header-brand">
        <Logo variant="dark" href="/" priority />
        <span className="auth-shell__header-divider" aria-hidden="true" />
        <p>{t("auth.headerTagline")}</p>
      </div>
      <div className="auth-shell__language">
        <LanguageSelect />
      </div>
    </header>
  );
}

function AuthQuote({ side, children }: { side: "left" | "right"; children: string }) {
  return (
    <aside className={cn("auth-shell__quote", `auth-shell__quote--${side}`)} aria-hidden="true">
      {children.split("\n").map((line) => <span key={line}>{line}</span>)}
    </aside>
  );
}

export function AuthShell({ title, subtitle, titleId, status, state, cardClassName, children }: AuthShellProps) {
  const { t } = useLanguage();
  return (
    <main className="auth-shell" data-auth-state={state}>
      <div className="auth-shell__background" aria-hidden="true">
        <div className="auth-shell__background-image" />
        <div className="auth-shell__background-vignette" />
      </div>
      <AuthHeader />
      <AuthQuote side="left">{t("auth.decorativeLeft")}</AuthQuote>
      <AuthQuote side="right">{t("auth.decorativeRight")}</AuthQuote>
      <div className="auth-shell__stage">
        <section className={cn("auth-shell__card", cardClassName)} aria-labelledby={titleId}>
          <AuthBrand />
          <AuthDivider />
          <div className="auth-shell__intro">
            <h1 id={titleId}>{title}</h1>
            <p>{subtitle}</p>
          </div>
          <p className="auth-shell__status" aria-live="polite">{status || ""}</p>
          {children}
        </section>
      </div>
      <AuthFooter />
    </main>
  );
}
