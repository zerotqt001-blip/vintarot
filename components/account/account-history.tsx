"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, BookOpen, CreditCard, Moon, ReceiptText, Settings2, Share2, Sparkles, UserRound, WalletCards } from "lucide-react";
import { useLanguage } from "@/components/language";

type Summary = {
  member: { displayName: string | null; username: string; email: string };
  credits: { balance: { availableUnits: number; reservedUnits: number; totalUnits: number } };
  vip: Array<{ id: string; entitlementType: string; benefitVersion: string; sourceType: string; isInternalTest: boolean; startsAt: number; endsAt: number | null; status: string }>;
  counts: { readings: number; shares: number; orders: number; affiliateConversions: number };
  affiliate: { conversions: number; held: number; eligible: number; netMinor: number };
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
  sourceType: string | null;
  savedReadingId?: string;
  readingId?: string;
  paymentReference?: string | null;
};

type HistoryResponse = { items: HistoryItem[]; nextCursor: string | null };
type AccountHistoryKind = "readings" | "shares" | "orders" | "credits" | "affiliate" | "all";
type Translator = (key: string) => string;

async function readJson<T>(path: string): Promise<T> {
  const response = await fetch(path, { credentials: "same-origin", cache: "no-store" });
  if (!response.ok) throw new Error("Account request failed");
  return response.json() as Promise<T>;
}

function dateLabel(value: number, locale: string): string {
  return new Intl.DateTimeFormat(locale === "vi" ? "vi-VN" : "en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function moneyLabel(amount: number | null, currency: string | null, locale: string): string {
  if (amount === null || !currency) return "—";
  return new Intl.NumberFormat(locale === "vi" ? "vi-VN" : "en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);
}

function itemLabel(item: HistoryItem, t: Translator): string {
  if (item.kind === "reading") return t("member.activityReading");
  if (item.kind === "share") return t("member.activityShare");
  if (item.kind === "order") return t("member.activityOrder");
  if (item.kind === "credit") return t("member.activityCredit");
  return t("member.activityAffiliate");
}

function itemHref(item: HistoryItem): string | null {
  if (item.kind === "reading" || item.kind === "share") return "/journal?tab=saved";
  if (item.kind === "order" || item.kind === "credit") return "/packages";
  return "/affiliate";
}

function statusLabel(item: HistoryItem, t: Translator): string {
  if (item.kind === "credit" && item.sourceType === "OWNER_TEST_GRANT") return t("member.internalTestGrant");
  const status = item.status?.toLowerCase();
  if (status && ["held", "eligible", "reversed", "adjusted", "active", "fulfilled", "pending", "cancelled", "refunded"].includes(status)) return t(`affiliate.status.${status}`);
  return t("member.activityRecorded");
}

function HistoryRow({ item, locale, t, compact = false }: { item: HistoryItem; locale: string; t: Translator; compact?: boolean }) {
  const content = <><span className="functional-history-kind">{itemLabel(item, t)}</span><strong>{statusLabel(item, t)}</strong><small>{dateLabel(item.createdAt, locale)}{item.units !== null ? ` · ${item.units} ${t("member.credits")}` : ""}{item.amountMinor !== null ? ` · ${moneyLabel(item.amountMinor, item.currency, locale)}` : ""}</small></>;
  const className = `functional-history-row account-history-row${compact ? " account-history-row--compact" : ""}`;
  const href = itemHref(item);
  return href ? <Link className={className} href={href} key={item.id}>{content}<ArrowUpRight size={16} aria-hidden="true" /></Link> : <div className={className} key={item.id}>{content}</div>;
}

const quickActions = [
  ["nav.drawNow", "/create", Sparkles, "home.drawNow"],
  ["member.readingHistory", "/journal?tab=saved", BookOpen, "member.activityText"],
  ["member.orderHistory", "/account?activity=orders#account-history", ReceiptText, "member.statusText"],
  ["header.profile", "/profile", Settings2, "member.accountText"],
] as const;

export default function AccountHistory({ authenticated, initialKind = "all" }: { authenticated: boolean; initialKind?: AccountHistoryKind }) {
  const { locale, t } = useLanguage();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [kind, setKind] = useState<AccountHistoryKind>(initialKind);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(authenticated);
  const [loadingMore, setLoadingMore] = useState(false);
  const [message, setMessage] = useState(false);

  useEffect(() => {
    if (!authenticated) return;
    let active = true;
    void (async () => {
      setLoading(true); setMessage(false);
      const query = new URLSearchParams({ kind, limit: "20" });
      try {
        const [nextSummary, history] = await Promise.all([readJson<Summary>("/api/account/summary"), readJson<HistoryResponse>(`/api/account/history?${query.toString()}`)]);
        if (!active) return;
        setSummary(nextSummary); setItems(history.items); setNextCursor(history.nextCursor);
      } catch { if (active) setMessage(true); } finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, [authenticated, initialKind, kind]);

  async function loadMore() {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true); setMessage(false);
    try {
      const query = new URLSearchParams({ kind, limit: "20", cursor: nextCursor });
      const history = await readJson<HistoryResponse>(`/api/account/history?${query.toString()}`);
      setItems((current) => [...current, ...history.items]); setNextCursor(history.nextCursor);
    } catch { setMessage(true); } finally { setLoadingMore(false); }
  }

  if (!authenticated) return <section className="empty functional-empty account-empty"><Moon size={34} aria-hidden="true" /><h1>{t("member.accountTitle")}</h1><p>{t("member.signInHistory")}</p><Link className="button black" href="/auth?return_to=/account">{t("member.signIn")}</Link></section>;

  const displayName = summary?.member.displayName || summary?.member.username || t("nav.yourSpace");
  const recentItems = items.slice(0, 3);
  const statCards = [
    [WalletCards, summary?.credits.balance.availableUnits ?? "—", t("member.creditsAvailable"), "/packages"],
    [Moon, summary?.vip.length ?? "—", t("member.vipEntitlement"), "/packages#vip"],
    [BookOpen, summary?.counts.readings ?? "—", t("member.readingHistory"), "/journal?tab=saved"],
    [Share2, summary?.affiliate.conversions ?? "—", t("member.openAffiliate"), "/affiliate"],
  ] as const;

  return <div className="account-dashboard" aria-busy={loading}>
    <section className="account-dashboard-hero">
      <div className="account-dashboard-hero-copy"><span className="account-dashboard-eyebrow">{t("member.statusEyebrow")}</span><h1>{t("member.accountTitle")}</h1><p>{t("member.accountText")}</p></div>
      <div className="account-dashboard-hero-note"><Sparkles size={19} aria-hidden="true" /><span>{t("member.statusText")}</span></div>
    </section>

    <section className="account-profile-card account-panel" aria-labelledby="account-profile-title">
      <div className="account-avatar" aria-hidden="true"><UserRound size={38} strokeWidth={1.1} /></div>
      <div className="account-profile-copy"><h2 id="account-profile-title">{displayName}</h2><p>{summary?.member.email || t("nav.yourSpace")}</p><span className="account-member-badge"><Sparkles size={13} aria-hidden="true" />{summary?.vip.length ? t("member.vipActive") : t("member.noVip")}</span></div>
      <Link className="account-profile-action" href="/profile">{t("header.profile")} <ArrowRight size={15} aria-hidden="true" /></Link>
    </section>

    <section className="account-stat-grid" aria-label={t("member.statusEyebrow")}>
      {statCards.map(([Icon, value, label, href]) => <Link className="account-stat-card" href={href} key={label}><span className="account-stat-icon"><Icon size={22} strokeWidth={1.25} aria-hidden="true" /></span><span className="account-stat-label">{label}</span><strong>{value}</strong><ArrowRight className="account-stat-arrow" size={15} aria-hidden="true" /></Link>)}
    </section>

    <nav className="account-action-strip" aria-label={t("member.accountDestinations")}>
      <Link className="button black" href="/packages">{t("member.topUpCredits")} <ArrowRight size={15} aria-hidden="true" /></Link>
      <Link className="button" href="/packages#vip">{t("member.viewVipPackages")}</Link>
      <Link className="button" href="/affiliate">{t("member.openAffiliate")}</Link>
    </nav>

    <div className="account-dashboard-grid">
      <section className="account-panel account-recent-panel" aria-labelledby="account-recent-title"><div className="account-panel-heading"><div><span className="account-dashboard-eyebrow">{t("member.accountTitle")}</span><h2 id="account-recent-title">{t("member.activityTitle")}</h2></div><Link href="#account-history">{t("member.orderHistory")} <ArrowRight size={14} aria-hidden="true" /></Link></div>{loading && <p className="functional-status" role="status" aria-live="polite">{t("member.catalogLoading")}</p>}{!loading && !message && recentItems.length === 0 && <p className="functional-status">{t("member.activityEmpty")}</p>}{!loading && !message && recentItems.length > 0 && <div className="functional-history-list account-recent-list">{recentItems.map((item) => <HistoryRow item={item} locale={locale} t={t} compact key={item.id} />)}</div>}</section>
      <section className="account-panel account-quick-panel" aria-labelledby="account-quick-title"><div className="account-panel-heading"><div><span className="account-dashboard-eyebrow">{t("member.accountDestinations")}</span><h2 id="account-quick-title">{t("member.openHistory")}</h2></div></div><div className="account-quick-grid">{quickActions.map(([key, href, Icon, description]) => <Link className="account-quick-card" href={href} key={href}><span className="account-quick-icon"><Icon size={18} strokeWidth={1.25} aria-hidden="true" /></span><span><strong>{t(key)}</strong><small>{t(description)}</small></span><ArrowRight size={15} aria-hidden="true" /></Link>)}</div></section>
    </div>

    {summary && <div className="account-dashboard-grid account-detail-grid"><section className="account-panel account-credit-panel" aria-labelledby="account-credit-title"><div className="account-panel-heading"><div><span className="account-dashboard-eyebrow">{t("member.credits")}</span><h2 id="account-credit-title">{t("member.statusText")}</h2></div><CreditCard size={20} aria-hidden="true" /></div><div className="account-balance-grid"><div><span>{t("member.creditsAvailable")}</span><strong>{summary.credits.balance.availableUnits}</strong></div><div><span>{t("member.creditsReservedLabel")}</span><strong>{summary.credits.balance.reservedUnits}</strong></div><div><span>{t("member.creditsTotalLabel")}</span><strong>{summary.credits.balance.totalUnits}</strong></div></div></section><section className="account-panel account-vip-panel" aria-labelledby="account-vip-title"><div className="account-panel-heading"><div><span className="account-dashboard-eyebrow">{t("member.vipEntitlement")}</span><h2 id="account-vip-title">{summary.vip.length ? t("member.vipActive") : t("member.noVip")}</h2></div><Moon size={20} aria-hidden="true" /></div>{summary.vip.length === 0 ? <p className="functional-status">{t("member.noVip")}</p> : <div className="account-vip-list">{summary.vip.map((entitlement) => <div key={entitlement.id}><strong>{entitlement.entitlementType}</strong><span>{entitlement.isInternalTest ? t("member.internalTestEntitlement") : entitlement.endsAt ? t("member.activeUntil").replace("{value}", dateLabel(entitlement.endsAt, locale)) : t("member.vipActive")}</span></div>)}</div>}</section></div>}

    {loading && <p className="functional-status" role="status" aria-live="polite">{t("member.catalogLoading")}</p>}{!loading && message && <p className="functional-status functional-status--error" role="status" aria-live="polite">{t("member.catalogError")}</p>}
    <section id="account-history" className="account-panel account-history-panel functional-history" aria-labelledby="account-history-title"><div className="account-panel-heading account-history-heading"><div><span className="account-dashboard-eyebrow">{t("member.accountTitle")}</span><h2 id="account-history-title">{t("member.activityTitle")}</h2><p>{t("member.activityText")}</p></div><label>{t("member.filterLabel")}<select value={kind} onChange={(event) => setKind(event.target.value as AccountHistoryKind)}><option value="all">{t("member.filterAll")}</option><option value="readings">{t("member.filterReadings")}</option><option value="shares">{t("member.filterShares")}</option><option value="orders">{t("member.filterOrders")}</option><option value="credits">{t("member.filterCredits")}</option><option value="affiliate">{t("member.filterAffiliate")}</option></select></label></div>{!loading && !message && items.length === 0 && <p className="functional-status">{t("member.activityEmpty")}</p>}{!loading && !message && items.length > 0 && <div className="functional-history-list">{items.map((item) => <HistoryRow item={item} locale={locale} t={t} key={item.id} />)}</div>}{nextCursor && <button className="button functional-more" type="button" onClick={() => void loadMore()} disabled={loadingMore}>{loadingMore ? t("member.loadingMore") : t("member.loadMore")}</button>}</section>
  </div>;
}
