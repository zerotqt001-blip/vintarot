"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, BookOpen, CreditCard, Moon, Sparkles, WalletCards } from "lucide-react";
import { useLanguage } from "@/components/language";

/* FUNCTIONAL UI — NOT FINAL DESIGN */
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
  savedReadingId?: string;
  readingId?: string;
  paymentReference?: string | null;
};

type HistoryResponse = { items: HistoryItem[]; nextCursor: string | null };

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

function itemLabel(item: HistoryItem, t: (key: string) => string): string {
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

function statusLabel(item: HistoryItem, t: (key: string) => string): string {
  if (item.kind === "credit" && item.reason?.includes("OWNER_TEST_GRANT")) return t("member.internalTestGrant");
  const status = item.status?.toLowerCase();
  if (status && ["held", "eligible", "reversed", "adjusted", "active", "fulfilled", "pending", "cancelled", "refunded"].includes(status)) return t(`affiliate.status.${status}`);
  return t("member.activityRecorded");
}

type AccountHistoryKind = "readings" | "shares" | "orders" | "credits" | "affiliate" | "all";

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

  if (!authenticated) return <section className="empty functional-empty"><Moon size={34} aria-hidden="true" /><h1>{t("member.accountTitle")}</h1><p>{t("member.signInHistory")}</p><Link className="button black" href="/auth?return_to=/account">{t("member.signIn")}</Link></section>;

  return <div className="functional-page commerce-page account-page"><header className="page-head functional-page-head commerce-hero"><span className="commerce-eyebrow">{t("member.statusEyebrow")}</span><h1>{t("member.accountTitle")}</h1><p>{summary ? `${t("member.accountText")} ${summary.member.displayName || summary.member.username}.` : t("member.accountText")}</p></header><nav className="functional-toolbar account-action-toolbar" aria-label={t("member.accountDestinations")}><Link className="button black" href="/packages">{t("member.topUpCredits")}</Link><Link className="button" href="/packages#vip">{t("member.viewVipPackages")}</Link><Link className="button" href="/account?activity=orders#account-history">{t("member.orderHistory")}</Link><Link className="button" href="/account?activity=readings#account-history">{t("member.readingHistory")}</Link><Link className="button" href="/affiliate">{t("member.openAffiliate")}</Link><Link className="button" href="/profile">{t("header.profile")}</Link><Link className="button" href="/admin">Admin</Link></nav>{summary && <><section className="functional-summary" aria-label={t("member.statusEyebrow")}><div><WalletCards size={17} aria-hidden="true" /><strong>{summary.credits.balance.availableUnits}</strong><span>{t("member.creditsAvailable")}</span></div><div><Moon size={17} aria-hidden="true" /><strong>{summary.vip.length}</strong><span>{t("member.vipEntitlement")}</span></div><div><BookOpen size={17} aria-hidden="true" /><strong>{summary.counts.readings}</strong><span>{t("member.readingHistory")}</span></div><div><Sparkles size={17} aria-hidden="true" /><strong>{summary.affiliate.conversions}</strong><span>{t("member.openAffiliate")}</span></div></section><section className="functional-section commerce-account-balance" aria-labelledby="account-balance-title"><div className="functional-section-heading"><div><h2 id="account-balance-title">{t("member.credits")}</h2><p>{t("member.statusText")}</p></div><CreditCard size={20} aria-hidden="true" /></div><div className="commerce-balance-grid"><div><span>{t("member.creditsAvailable")}</span><strong>{summary.credits.balance.availableUnits}</strong></div><div><span>{t("member.creditsReservedLabel")}</span><strong>{summary.credits.balance.reservedUnits}</strong></div><div><span>{t("member.creditsTotalLabel")}</span><strong>{summary.credits.balance.totalUnits}</strong></div></div></section><section className="functional-section commerce-entitlements" aria-labelledby="account-vip-title"><div className="functional-section-heading"><div><h2 id="account-vip-title">{t("member.vipEntitlement")}</h2><p>{summary.vip.length ? t("member.statusText") : t("member.noVip")}</p></div><Moon size={20} aria-hidden="true" /></div>{summary.vip.length === 0 ? <p className="functional-status">{t("member.noVip")}</p> : <div className="commerce-entitlement-list">{summary.vip.map((entitlement) => <div key={entitlement.id}><strong>{entitlement.entitlementType}</strong><span>{entitlement.benefitVersion}</span><small>{entitlement.isInternalTest ? t("member.internalTestEntitlement") : entitlement.endsAt ? t("member.activeUntil").replace("{value}", dateLabel(entitlement.endsAt, locale)) : t("member.vipActive")}</small></div>)}</div>}</section></>}{loading && <p className="functional-status" role="status" aria-live="polite">{t("member.catalogLoading")}</p>}{!loading && message && <p className="functional-status functional-status--error" role="status" aria-live="polite">{t("member.catalogError")}</p>}<section className="functional-history" aria-labelledby="account-history-title"><div className="functional-section-heading"><div><span className="commerce-eyebrow">{t("member.accountTitle")}</span><h2 id="account-history-title">{t("member.activityTitle")}</h2><p>{t("member.activityText")}</p></div><label>{t("member.filterLabel")}<select value={kind} onChange={(event) => setKind(event.target.value as AccountHistoryKind)}><option value="all">{t("member.filterAll")}</option><option value="readings">{t("member.filterReadings")}</option><option value="shares">{t("member.filterShares")}</option><option value="orders">{t("member.filterOrders")}</option><option value="credits">{t("member.filterCredits")}</option><option value="affiliate">{t("member.filterAffiliate")}</option></select></label></div>{!loading && !message && items.length === 0 && <p className="functional-status">{t("member.activityEmpty")}</p>}{!loading && !message && items.length > 0 && <div className="functional-history-list">{items.map((item) => { const href = itemHref(item); const content = <><span className="functional-history-kind">{itemLabel(item, t)}</span><strong>{statusLabel(item, t)}</strong><small>{dateLabel(item.createdAt, locale)}{item.units !== null ? ` · ${item.units} ${t("member.credits")}` : ""}{item.amountMinor !== null ? ` · ${moneyLabel(item.amountMinor, item.currency, locale)}` : ""}</small></>; return href ? <Link className="functional-history-row" href={href} key={item.id}>{content}<ArrowUpRight size={16} aria-hidden="true" /></Link> : <div className="functional-history-row" key={item.id}>{content}</div>; })}</div>}{nextCursor && <button className="button functional-more" type="button" onClick={() => void loadMore()} disabled={loadingMore}>{loadingMore ? t("member.loadingMore") : t("member.loadMore")}</button>}</section></div>;
}
