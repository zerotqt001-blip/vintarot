"use client";

import { ArrowRight, BookOpen, CalendarDays, CheckCircle2, CreditCard, Gift, LogOut, Moon, ShieldCheck, Sparkles, UserRound, WalletCards } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useLanguage } from "@/components/language";
import type { Locale } from "@/lib/i18n";
import type { AccountPackageSummary } from "@/lib/account-history";

type Summary = {
  member: { displayName: string | null; username: string; createdAt: number };
  credits: { balance: { availableUnits: number; reservedUnits: number; totalUnits: number } };
  vip: Array<{ id: string; entitlementType: string; benefitVersion: string; startsAt: number; endsAt: number | null; status: string }>;
  counts: { readings: number; shares: number; orders: number; affiliateConversions: number };
  affiliate: { conversions: number; held: number; eligible: number; reversed: number; netMinor: number };
};

type HistoryItem = {
  id: string;
  kind: "reading" | "share" | "order" | "credit" | "affiliate";
  createdAt: number;
  referenceId: string | null;
  status: string | null;
  amountMinor: number | null;
  currency: string | null;
  units: number | null;
  reason: string | null;
  paymentReference?: string | null;
  package?: AccountPackageSummary;
};

type SavedReading = {
  id: string;
  question: string;
  locale: Locale;
  spreadName: string;
  cardCount: number;
  created: number;
  cards: Array<{ readingCardId: string; nameEn: string; nameVi: string; imageUrl: string; orientation: "upright" | "reversed" }>;
};

type HistoryResponse = { items: HistoryItem[]; nextCursor: string | null };

export function accountDisplayName(member: { displayName: string | null; username: string }): string {
  return member.displayName?.trim() || member.username;
}

export function localizedPackageName(item: Pick<AccountPackageSummary, "nameEn" | "nameVi">, locale: Locale): string {
  return locale === "vi" ? item.nameVi : item.nameEn;
}

export function formatAccountDate(value: number, locale: Locale): string {
  return new Intl.DateTimeFormat(locale === "vi" ? "vi-VN" : "en-US", { dateStyle: "medium" }).format(new Date(value));
}

export function formatAccountMoney(amount: number | null, currency: string | null, locale: Locale): string {
  if (amount === null) return "—";
  return new Intl.NumberFormat(locale === "vi" ? "vi-VN" : "en-US", { style: "currency", currency: currency || "VND", maximumFractionDigits: 0 }).format(amount);
}

export function orderStatusLabel(status: string, locale: Locale): string {
  const labels: Record<Locale, Record<string, string>> = {
    vi: { PENDING: "Chờ thanh toán", PAYMENT_CONFIRMED: "Đã xác nhận", FULFILLED: "Hoàn tất", CANCELLED: "Đã hủy", REFUNDED: "Đã hoàn tiền" },
    en: { PENDING: "Pending", PAYMENT_CONFIRMED: "Payment confirmed", FULFILLED: "Complete", CANCELLED: "Cancelled", REFUNDED: "Refunded" },
  };
  return labels[locale][status] || status;
}

async function readJson<T>(path: string, init: RequestInit | undefined, fallbackError: string): Promise<T> {
  const response = await fetch(path, { ...init, credentials: "same-origin", cache: "no-store" });
  const data = await response.json().catch(() => ({})) as { error?: string } & T;
  if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : fallbackError);
  return data;
}

function initialsFor(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "N";
}

function vipEntitlement(summary: Summary): Summary["vip"][number] | null {
  return summary.vip.find((entitlement) => entitlement.status === "ACTIVE") || summary.vip[0] || null;
}

function isActiveVip(entitlement: Summary["vip"][number] | null): boolean {
  return entitlement?.status === "ACTIVE";
}

function AccountLoadingState() {
  const { t } = useLanguage();
  return <div className="account-state account-state--loading" role="status" aria-live="polite"><Moon size={24} aria-hidden="true" /><p>{t("account.loading")}</p></div>;
}

function AccountErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  const { t } = useLanguage();
  return <div className="account-state account-state--error" role="alert"><ShieldCheck size={24} aria-hidden="true" /><h1>{t("account.errorTitle")}</h1><p>{message}</p><button className="account-button" type="button" onClick={onRetry}>{t("account.retry")}</button></div>;
}

function SummaryCard({ icon, label, value, detail, href, className = "" }: { icon: React.ReactNode; label: string; value: string; detail: string; href: string; className?: string }) {
  return <article className={`account-summary-card ${className}`.trim()}>
    <div className="account-summary-icon">{icon}</div>
    <div className="account-summary-copy"><p>{label}</p><strong>{value}</strong><span>{detail}</span></div>
    <a className="account-summary-link" href={href}><ArrowRight size={17} aria-hidden="true" /><span className="sr-only">{label}</span></a>
  </article>;
}

function SavedReadingRow({ item, locale, t }: { item: SavedReading; locale: Locale; t: (key: string) => string }) {
  return <a className="account-reading-row" href="/journal?tab=saved">
    <div className="account-reading-art" aria-hidden="true">
      {item.cards.slice(0, 3).map((card) => <img key={card.readingCardId} src={card.imageUrl} alt="" loading="lazy" />)}
    </div>
    <div className="account-reading-copy"><strong>{item.question}</strong><span>{item.cardCount} {t("account.cards")} · {item.spreadName}</span><time dateTime={new Date(item.created).toISOString()}>{formatAccountDate(item.created, locale)}</time></div>
    <span className="account-row-action">{t("account.review") } <ArrowRight size={16} aria-hidden="true" /></span>
  </a>;
}

function TransactionRow({ item, locale, t }: { item: HistoryItem; locale: Locale; t: (key: string) => string }) {
  const packageName = item.package ? localizedPackageName(item.package, locale) : t("account.creditOrder");
  const vipDays = item.package?.vipDurationSeconds ? t("account.vipDays").replace("{days}", String(Math.round(item.package.vipDurationSeconds / 86_400))) : "";
  const packageDetail = item.package
    ? `v${item.package.version} · ${item.package.creditUnits} ${t("account.credits")}${vipDays ? ` · ${vipDays}` : ""}`
    : item.referenceId || t("account.referenceUnavailable");
  const status = item.status || "PENDING";
  return <article className="account-transaction-row">
    <div className="account-transaction-name"><span className="account-transaction-icon"><ReceiptIcon /></span><div><strong>{packageName}</strong><small>{packageDetail}</small></div></div>
    <time dateTime={new Date(item.createdAt).toISOString()}>{formatAccountDate(item.createdAt, locale)}</time>
    <strong className="account-transaction-amount">{formatAccountMoney(item.amountMinor, item.currency, locale)}</strong>
    <span className={`account-status account-status--${status.toLowerCase()}`}><CheckCircle2 size={14} aria-hidden="true" />{orderStatusLabel(status, locale)}</span>
  </article>;
}

function ReceiptIcon() {
  return <CreditCard size={19} strokeWidth={1.45} aria-hidden="true" />;
}

export default function AccountDashboard({ authenticated }: { authenticated: boolean }) {
  const { locale, t } = useLanguage();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [orders, setOrders] = useState<HistoryItem[]>([]);
  const [savedReadings, setSavedReadings] = useState<SavedReading[]>([]);
  const [loading, setLoading] = useState(authenticated);
  const [message, setMessage] = useState("");
  const [loggingOut, setLoggingOut] = useState(false);

  async function loadDashboard() {
    if (!authenticated) return;
    setLoading(true);
    setMessage("");
    try {
      const [nextSummary, history, readings] = await Promise.all([
        readJson<Summary>("/api/account/summary", undefined, t("account.errorGeneric")),
        readJson<HistoryResponse>("/api/account/history?kind=orders&limit=6", undefined, t("account.errorGeneric")),
        readJson<{ items: SavedReading[] }>("/api/tarot/saved-readings", undefined, t("account.errorGeneric")),
      ]);
      setSummary(nextSummary);
      setOrders(history.items);
      setSavedReadings(readings.items);
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : t("account.errorGeneric"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadDashboard();
  }, [authenticated]);

  async function logout() {
    setLoggingOut(true);
    setMessage("");
    try {
      await readJson<{ ok: boolean }>("/api/auth/logout", { method: "POST" }, t("account.logoutError"));
      window.location.assign("/");
    } catch (error: unknown) {
      setLoggingOut(false);
      setMessage(error instanceof Error ? error.message : t("account.logoutError"));
    }
  }

  const memberName = useMemo(() => summary ? accountDisplayName(summary.member) : "", [summary]);
  const vip = summary ? vipEntitlement(summary) : null;
  const vipActive = isActiveVip(vip);

  if (!authenticated) {
    return <section className="account-state account-state--signed-out"><UserRound size={30} aria-hidden="true" /><h1>{t("account.signedOutTitle")}</h1><p>{t("account.signedOutText")}</p><a className="account-button account-button--filled" href="/auth?return_to=/account">{t("common.signIn")}</a></section>;
  }
  if (loading) return <div className="account-dashboard"><AccountLoadingState /></div>;
  if (message && !summary) return <div className="account-dashboard"><AccountErrorState message={message} onRetry={() => void loadDashboard()} /></div>;
  if (!summary) return <div className="account-dashboard"><AccountErrorState message={t("account.errorGeneric")} onRetry={() => void loadDashboard()} /></div>;

  return <div className="account-dashboard">
    <section className="account-hero" aria-labelledby="account-title">
      <div className="account-hero-art" aria-hidden="true" />
      <div className="account-hero-copy"><p className="account-hero-kicker">{t("account.memberSpace")}</p><h1 id="account-title">{t("account.title")}</h1><p>{t("account.subtitle")}</p></div>
      <p className="account-hero-quote">{t("account.quote")}</p>
      <div className="account-profile-card">
        <div className="account-avatar" aria-hidden="true"><span>{initialsFor(memberName)}</span></div>
        <div className="account-profile-copy"><strong>{memberName}</strong><span>{summary.member.username}</span><small>{t("account.memberSince")} {formatAccountDate(summary.member.createdAt, locale)}</small></div>
        <div className="account-profile-status"><span className={vipActive ? "account-vip-badge" : "account-muted-badge"}>{vipActive ? t("account.vipMember") : t("account.member")}</span>{vip?.endsAt && <small>{t("account.until")} {formatAccountDate(vip.endsAt, locale)}</small>}</div>
        <a className="account-button account-button--outline" href="/profile">{t("account.editProfile")} <ArrowRight size={16} aria-hidden="true" /></a>
      </div>
    </section>

    <section className="account-summary-grid" aria-label={t("account.summaryLabel")}>
      <SummaryCard className="account-summary-card--credits" icon={<CreditCard size={23} aria-hidden="true" />} label={t("account.creditsAvailable")} value={new Intl.NumberFormat(locale === "vi" ? "vi-VN" : "en-US").format(summary.credits.balance.availableUnits)} detail={t("account.creditsReady")} href="/packages" />
      <SummaryCard icon={<Moon size={23} aria-hidden="true" />} label={t("account.membership")} value={vipActive ? "VIP" : "—"} detail={vipActive ? t("account.active") : t("account.notActive")} href="/packages" />
      <SummaryCard icon={<BookOpen size={23} aria-hidden="true" />} label={t("account.savedReadings")} value={String(summary.counts.readings)} detail={t("account.savedReadingCount")} href="/journal?tab=saved" />
      <SummaryCard icon={<Gift size={23} aria-hidden="true" />} label={t("account.affiliate")} value={String(summary.affiliate.conversions)} detail={t("account.conversionCount")} href="/affiliate" />
    </section>

    <div className="account-content-grid">
      <section className="account-panel account-recent-readings" aria-labelledby="account-readings-title">
        <div className="account-panel-heading"><div><h2 id="account-readings-title">{t("account.recentReadings")}</h2><p>{t("account.recentReadingsText")}</p></div><a href="/journal?tab=saved">{t("account.viewAll")} <ArrowRight size={16} aria-hidden="true" /></a></div>
        {savedReadings.length ? <div className="account-reading-list">{savedReadings.slice(0, 3).map((item) => <SavedReadingRow key={item.id} item={item} locale={locale} t={t} />)}</div> : <div className="account-empty"><BookOpen size={24} aria-hidden="true" /><p>{t("account.noReadings")}</p><a href="/room">{t("account.startReading")} <ArrowRight size={16} aria-hidden="true" /></a></div>}
      </section>

      <section className="account-panel account-quick-links" aria-labelledby="account-quick-title">
        <div className="account-panel-heading"><div><h2 id="account-quick-title">{t("account.quickAccess")}</h2><p>{t("account.quickAccessText")}</p></div><Sparkles size={21} aria-hidden="true" /></div>
        <div className="account-quick-list">
          <a href="/room"><span className="account-quick-icon"><WalletCards size={19} aria-hidden="true" /></span><span><strong>{t("account.drawNow")}</strong><small>{t("account.drawNowText")}</small></span><ArrowRight size={17} aria-hidden="true" /></a>
          <a href="/journal?tab=saved"><span className="account-quick-icon"><BookOpen size={19} aria-hidden="true" /></span><span><strong>{t("account.savedReadings")}</strong><small>{t("account.savedReadingsText")}</small></span><ArrowRight size={17} aria-hidden="true" /></a>
          <a href="/account#transactions"><span className="account-quick-icon"><CalendarDays size={19} aria-hidden="true" /></span><span><strong>{t("account.transactions")}</strong><small>{t("account.transactionsText")}</small></span><ArrowRight size={17} aria-hidden="true" /></a>
          <a href="/profile"><span className="account-quick-icon"><UserRound size={19} aria-hidden="true" /></span><span><strong>{t("account.profileSettings")}</strong><small>{t("account.profileSettingsText")}</small></span><ArrowRight size={17} aria-hidden="true" /></a>
        </div>
      </section>

      <section className="account-panel account-transactions" id="transactions" aria-labelledby="account-transactions-title">
        <div className="account-panel-heading"><div><h2 id="account-transactions-title">{t("account.transactions")}</h2><p>{t("account.transactionsText")}</p></div><a href="/account#transactions">{t("account.viewAll")} <ArrowRight size={16} aria-hidden="true" /></a></div>
        {orders.length ? <div className="account-transaction-list">{orders.map((item) => <TransactionRow key={item.id} item={item} locale={locale} t={t} />)}</div> : <div className="account-empty"><CreditCard size={24} aria-hidden="true" /><p>{t("account.noTransactions")}</p><a href="/packages">{t("account.viewPackages")} <ArrowRight size={16} aria-hidden="true" /></a></div>}
      </section>

      <section className="account-panel account-security" aria-labelledby="account-security-title">
        <div className="account-panel-heading"><div><h2 id="account-security-title">{t("account.securityTitle")}</h2><p>{t("account.securityText")}</p></div><ShieldCheck size={21} aria-hidden="true" /></div>
        <div className="account-security-list">
          <a href="/profile"><span><UserRound size={18} aria-hidden="true" /><strong>{t("account.personalInfo")}</strong></span><ArrowRight size={16} aria-hidden="true" /></a>
          <a href="/privacy"><span><ShieldCheck size={18} aria-hidden="true" /><strong>{t("account.privacy")}</strong></span><ArrowRight size={16} aria-hidden="true" /></a>
          <button type="button" onClick={() => void logout()} disabled={loggingOut}><span><LogOut size={18} aria-hidden="true" /><strong>{loggingOut ? t("account.loggingOut") : t("account.logout")}</strong></span><ArrowRight size={16} aria-hidden="true" /></button>
        </div>
        {message && <p className="account-inline-message" role="alert">{message}</p>}
      </section>
    </div>
  </div>;
}
