"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, ArrowUpRight, BookOpen, Copy, Globe2, KeyRound, LogOut, Moon, ReceiptText, Settings2, Share2, Sparkles, UserRound, WalletCards } from "lucide-react";
import { useLanguage } from "@/components/language";
import type { AffiliateReferralLink } from "@/lib/affiliate/types";

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
type AffiliateDashboardResponse = { referralLink: AffiliateReferralLink; referrals: { count: number; history: Array<{ id: string; signupAt: number; state: "VERIFIED" }> } };
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

function AccountStatCard({ icon: Icon, value, label, caption, action, href }: { icon: typeof WalletCards; value: string | number; label: string; caption: string; action: string; href: string }) {
  return <Link className="account-stat-card" href={href}>
    <span className="account-stat-icon"><Icon size={22} strokeWidth={1.25} aria-hidden="true" /></span>
    <span className="account-stat-label">{label}</span>
    <strong>{value}</strong>
    <small className="account-stat-caption">{caption}</small>
    <span className="account-stat-card__action">{action} <ArrowRight size={14} aria-hidden="true" /></span>
  </Link>;
}

function AccountAffiliateCard({ dashboard, loading, error, t }: { dashboard: AffiliateDashboardResponse | null; loading: boolean; error: boolean; t: Translator }) {
  const [feedback, setFeedback] = useState<"code" | "link" | null>(null);
  const [actionError, setActionError] = useState(false);
  const link = dashboard?.referralLink;
  async function copy(value: string, kind: "code" | "link") {
    try {
      await navigator.clipboard.writeText(value);
      setFeedback(kind);
      setActionError(false);
      window.setTimeout(() => setFeedback((current) => current === kind ? null : current), 1800);
    } catch {
      setActionError(true);
    }
  }
  return <section className="account-panel account-affiliate-panel" aria-labelledby="account-affiliate-title">
    <div className="account-panel-heading"><div><span className="account-dashboard-eyebrow">{t("member.quickAccess")}</span><h2 id="account-affiliate-title">{t("member.openAffiliate")}</h2></div><Link className="account-affiliate-open" href="/affiliate">{t("affiliate.openDashboard")} <ArrowRight size={14} aria-hidden="true" /></Link></div>
    {loading && <p className="account-affiliate-state" role="status" aria-live="polite">{t("member.catalogLoading")}</p>}
    {!loading && error && <p className="account-affiliate-state account-affiliate-state--error" role="status" aria-live="polite">{t("affiliate.dashboardError")}</p>}
    {!loading && !error && link?.available && <>
      <div className="account-affiliate-referrals"><span>{t("affiliate.referralSignups")}</span><strong>{dashboard?.referrals.count.toLocaleString() ?? "0"}</strong></div>
      <div className="account-affiliate-field"><span>{t("affiliate.referralCode")}</span><code>{link.code}</code><button type="button" onClick={() => void copy(link.code, "code")} aria-label={feedback === "code" ? t("affiliate.copied") : t("affiliate.copyCode")}><Copy size={16} aria-hidden="true" />{feedback === "code" ? t("affiliate.copied") : t("affiliate.copyCode")}</button></div>
      <div className="account-affiliate-field"><span>{t("affiliate.referralLinkTitle")}</span><code>{link.url}</code><button type="button" onClick={() => void copy(link.url, "link")} aria-label={feedback === "link" ? t("affiliate.copied") : t("affiliate.copyLink")}><Copy size={16} aria-hidden="true" />{feedback === "link" ? t("affiliate.copied") : t("affiliate.copyLink")}</button></div>
    </>}
    {!loading && !error && !link?.available && <p className="account-affiliate-state">{t("affiliate.linkUnavailable")}</p>}
    {actionError && <p className="account-affiliate-state account-affiliate-state--error" role="status" aria-live="polite">{t("affiliate.linkActionError")}</p>}
  </section>;
}

export default function AccountHistory({ authenticated, initialKind = "all" }: { authenticated: boolean; initialKind?: AccountHistoryKind }) {
  const { locale, t } = useLanguage();
  const router = useRouter();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [affiliateDashboard, setAffiliateDashboard] = useState<AffiliateDashboardResponse | null>(null);
  const [affiliateLoading, setAffiliateLoading] = useState(authenticated);
  const [affiliateError, setAffiliateError] = useState(false);
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [recentItems, setRecentItems] = useState<HistoryItem[]>([]);
  const [kind, setKind] = useState<AccountHistoryKind>(initialKind);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(authenticated);
  const [loadingMore, setLoadingMore] = useState(false);
  const [message, setMessage] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    if (!authenticated) return;
    let active = true;
    void (async () => {
      setLoading(true); setMessage(false);
      const query = new URLSearchParams({ kind, limit: "20" });
      const historyPath = `/api/account/history?${query.toString()}`;
      const recentHistoryPath = kind === "readings" ? historyPath : "/api/account/history?kind=readings&limit=3";
      try {
        const [nextSummary, history, recentHistory] = await Promise.all([readJson<Summary>("/api/account/summary"), readJson<HistoryResponse>(historyPath), readJson<HistoryResponse>(recentHistoryPath)]);
        if (!active) return;
        setSummary(nextSummary); setItems(history.items); setRecentItems(recentHistory.items.filter((item) => item.kind === "reading").slice(0, 3)); setNextCursor(history.nextCursor);
      } catch { if (active) { setRecentItems([]); setMessage(true); } } finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, [authenticated, initialKind, kind]);

  useEffect(() => {
    if (!authenticated) return;
    let active = true;
    void readJson<AffiliateDashboardResponse>("/api/affiliate/dashboard").then((dashboard) => {
      if (active) {
        setAffiliateDashboard(dashboard);
        setAffiliateError(false);
      }
    }).catch(() => {
      if (active) setAffiliateError(true);
    }).finally(() => {
      if (active) setAffiliateLoading(false);
    });
    return () => { active = false; };
  }, [authenticated]);

  async function loadMore() {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true); setMessage(false);
    try {
      const query = new URLSearchParams({ kind, limit: "20", cursor: nextCursor });
      const history = await readJson<HistoryResponse>(`/api/account/history?${query.toString()}`);
      setItems((current) => [...current, ...history.items]); setNextCursor(history.nextCursor);
    } catch { setMessage(true); } finally { setLoadingMore(false); }
  }

  async function logout() {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      const response = await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" });
      if (response.ok) router.push("/auth?return_to=/account");
    } finally {
      setLoggingOut(false);
    }
  }

  if (!authenticated) return <section className="empty functional-empty account-empty"><Moon size={34} aria-hidden="true" /><h1>{t("member.accountTitle")}</h1><p>{t("member.signInHistory")}</p><Link className="button black" href="/auth?return_to=/account">{t("member.signIn")}</Link></section>;

  const displayName = summary?.member.displayName || summary?.member.username || t("nav.yourSpace");
  const vipStatusLabel = summary?.vip.length ? (summary.vip.some((item) => item.isInternalTest) ? t("member.internalTestEntitlement") : t("member.vipActive")) : t("member.noVip");
  const vipEndsAt = summary?.vip.find((item) => item.endsAt)?.endsAt ?? null;
  const vipStatusDetail = summary?.vip.length && vipEndsAt ? `${vipStatusLabel} · ${t("member.activeUntil").replace("{value}", dateLabel(vipEndsAt, locale))}` : vipStatusLabel;
  const creditsBalanceDetail = summary ? `${t("member.creditsReservedLabel")}: ${summary.credits.balance.reservedUnits} · ${t("member.creditsTotalLabel")}: ${summary.credits.balance.totalUnits}` : t("member.creditsAvailable");
  const quickActions = [
    ["nav.drawNow", "/create", Sparkles, "member.statusText"],
    ["member.readingHistory", "/journal?tab=saved", BookOpen, "member.activityText"],
    ["member.orderHistory", "/account?activity=orders#account-history", ReceiptText, "member.statusText"],
    ["header.profile", "/profile", Settings2, "member.accountText"],
  ] as const;

  return <div className="account-dashboard" aria-busy={loading}>
    <section className="account-dashboard-hero">
      <div className="account-dashboard-hero-copy"><span className="account-dashboard-eyebrow">{t("member.statusEyebrow")}</span><h1>{t("member.accountTitle")}</h1><p>{t("member.accountText")}</p></div>
      <div className="account-dashboard-hero-note"><Sparkles size={19} aria-hidden="true" /><span>{t("member.statusText")}</span></div>
    </section>

    <section className="account-profile-card account-panel" aria-labelledby="account-profile-title">
      <div className="account-avatar" aria-hidden="true"><UserRound size={38} strokeWidth={1.1} /></div>
      <div className="account-profile-copy"><h2 id="account-profile-title">{displayName}</h2><p>{summary?.member.email || t("nav.yourSpace")}</p><span className="account-member-badge"><Sparkles size={13} aria-hidden="true" />{vipStatusLabel}</span></div>
      <Link className="account-profile-action" href="/profile">{t("header.profile")} <ArrowRight size={15} aria-hidden="true" /></Link>
    </section>

    <section className="account-stat-grid" aria-label={t("member.statusEyebrow")}>
      <AccountStatCard icon={WalletCards} value={summary?.credits.balance.availableUnits ?? "—"} label={t("member.credits")} caption={creditsBalanceDetail} action={t("member.topUpCredits")} href="/packages" />
      <AccountStatCard icon={Moon} value={summary?.vip.length ? "VIP" : "—"} label={t("member.vipEntitlement")} caption={vipStatusDetail} action={t("member.viewVipPackages")} href="/packages#vip" />
      <AccountStatCard icon={BookOpen} value={summary?.counts.readings ?? "—"} label={t("member.readingHistory")} caption={t("member.activityText")} action={t("member.openHistory")} href="/journal?tab=saved" />
      <AccountStatCard icon={Share2} value={summary?.affiliate.conversions ?? "—"} label={t("member.openAffiliate")} caption={t("member.shareCount").replace("{value}", String(summary?.affiliate.conversions ?? 0))} action={t("member.openAffiliate")} href="/affiliate" />
    </section>

    <AccountAffiliateCard dashboard={affiliateDashboard} loading={affiliateLoading} error={affiliateError} t={t} />

    <div className="account-dashboard-grid">
      <section className="account-panel account-recent-panel" aria-labelledby="account-recent-title"><div className="account-panel-heading"><div><span className="account-dashboard-eyebrow">{t("member.accountTitle")}</span><h2 id="account-recent-title">{t("member.recentReadings")}</h2></div><Link href="/journal?tab=saved">{t("member.readingHistory")} <ArrowRight size={14} aria-hidden="true" /></Link></div>{loading && <p className="functional-status" role="status" aria-live="polite">{t("member.catalogLoading")}</p>}{!loading && !message && recentItems.length === 0 && <p className="functional-status">{t("member.activityEmpty")}</p>}{!loading && !message && recentItems.length > 0 && <div className="functional-history-list account-recent-list">{recentItems.map((item) => <HistoryRow item={item} locale={locale} t={t} compact key={item.id} />)}</div>}</section>
      <section className="account-panel account-quick-panel" aria-labelledby="account-quick-title"><div className="account-panel-heading"><div><span className="account-dashboard-eyebrow">{t("member.quickAccess")}</span><h2 id="account-quick-title">{t("member.quickAccess")}</h2></div></div><div className="account-quick-grid">{quickActions.map(([key, href, Icon, description]) => <Link className="account-quick-card" href={href} key={href}><span className="account-quick-icon"><Icon size={18} strokeWidth={1.25} aria-hidden="true" /></span><span><strong>{t(key)}</strong><small>{t(description)}</small></span><ArrowRight size={15} aria-hidden="true" /></Link>)}</div></section>
    </div>

    {loading && <p className="functional-status" role="status" aria-live="polite">{t("member.catalogLoading")}</p>}{!loading && message && <p className="functional-status functional-status--error" role="status" aria-live="polite">{t("member.catalogError")}</p>}
    <div className="account-dashboard-grid account-bottom-grid">
      <section id="account-history" className="account-panel account-history-panel account-transactions-panel functional-history" aria-labelledby="account-history-title"><div className="account-panel-heading account-history-heading"><div><span className="account-dashboard-eyebrow">{t("member.accountTitle")}</span><h2 id="account-history-title">{t("member.transactions")}</h2><p>{t("member.activityText")}</p></div><label>{t("member.filterLabel")}<select value={kind} onChange={(event) => setKind(event.target.value as AccountHistoryKind)}><option value="all">{t("member.filterAll")}</option><option value="readings">{t("member.filterReadings")}</option><option value="shares">{t("member.filterShares")}</option><option value="orders">{t("member.filterOrders")}</option><option value="credits">{t("member.filterCredits")}</option><option value="affiliate">{t("member.filterAffiliate")}</option></select></label></div>{!loading && !message && items.length === 0 && <p className="functional-status">{t("member.activityEmpty")}</p>}{!loading && !message && items.length > 0 && <div className="functional-history-list">{items.map((item) => <HistoryRow item={item} locale={locale} t={t} key={item.id} />)}</div>}{nextCursor && <button className="button functional-more" type="button" onClick={() => void loadMore()} disabled={loadingMore}>{loadingMore ? t("member.loadingMore") : t("member.loadMore")}</button>}</section>
      <section id="account-security" className="account-panel account-security-panel" aria-labelledby="account-security-title"><div className="account-panel-heading"><div><span className="account-dashboard-eyebrow">{t("member.security")}</span><h2 id="account-security-title">{t("member.security")}</h2></div><KeyRound size={20} aria-hidden="true" /></div><div className="account-security-list"><Link className="account-security-item" href="/profile"><span className="account-quick-icon"><UserRound size={18} aria-hidden="true" /></span><span><strong>{t("header.profile")}</strong><small>{t("member.accountText")}</small></span><ArrowRight size={15} aria-hidden="true" /></Link><Link className="account-security-item" href="/account#account-security"><span className="account-quick-icon"><KeyRound size={18} aria-hidden="true" /></span><span><strong>{t("member.vipEntitlement")}</strong><small>{vipStatusDetail}</small></span><ArrowRight size={15} aria-hidden="true" /></Link><div className="account-security-item"><span className="account-quick-icon"><Globe2 size={18} aria-hidden="true" /></span><span><strong>{t("common.language")}</strong><small>{locale === "vi" ? t("common.vietnamese") : t("common.english")}</small></span></div><button className="account-security-item account-security-item--button" type="button" onClick={() => void logout()} disabled={loggingOut}><span className="account-quick-icon"><LogOut size={18} aria-hidden="true" /></span><span><strong>{t("auth.logout")}</strong><small>{loggingOut ? t("member.statusLoading") : t("member.accountText")}</small></span><ArrowRight size={15} aria-hidden="true" /></button></div></section>
    </div>
  </div>;
}
