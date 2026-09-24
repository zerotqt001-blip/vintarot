"use client";

import {
  ArrowRight,
  BadgeCheck,
  Check,
  ChevronRight,
  CircleAlert,
  CircleDollarSign,
  Clock3,
  Copy,
  Download,
  Gift,
  Link2,
  LoaderCircle,
  LockKeyhole,
  MessageCircle,
  ReceiptText,
  Share2,
  Sparkles,
  UsersRound,
  WalletCards,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useLanguage } from "@/components/language";

type PublicAffiliateTier = { tierCode: string; minQualifiedConversions: number; rateBps: number };
type PublicAffiliatePolicy = { version: number; currency: string; attributionWindowDays: number; holdDays: number; tiers: PublicAffiliateTier[] };
type AffiliateIncome = { currency: string | null; currentMonthMinor: number; confirmedMinor: number; pendingMinor: number; totalMinor: number };
type AffiliateHistoryItem = { id: string; amountMinor: number; currency: string; commissionMinor: number; status: string; fulfilledAt: number; eligibleAt: number | null; reversedAt: number | null; createdAt: number };
type AffiliateReferralLink =
  | { available: false; reason: string }
  | { available: true; url: string; qrUrl?: string | null };
type AffiliateDashboard = {
  profile: { status: "ACTIVE" | "INACTIVE" | "SUSPENDED" } | null;
  policy: PublicAffiliatePolicy | null;
  progress: { qualifiedConversions: number; currentTier: PublicAffiliateTier | null; nextTier: PublicAffiliateTier | null } | null;
  referralLink: AffiliateReferralLink;
  summary: { conversions: number; held: number; eligible: number; reversed: number; creditedMinor: number; debitedMinor: number; netMinor: number };
  income: AffiliateIncome;
  history: AffiliateHistoryItem[];
};

type PolicyResponse = { policy: PublicAffiliatePolicy | null };

function moneyLabel(value: number, currency: string | null, locale: string): string {
  if (!currency) return "—";
  try {
    return new Intl.NumberFormat(locale === "vi" ? "vi-VN" : "en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(value);
  } catch {
    return `${value.toLocaleString(locale === "vi" ? "vi-VN" : "en-US")} ${currency}`;
  }
}

function rateLabel(rateBps: number | null, locale: string): string {
  if (rateBps == null) return "—";
  return `${new Intl.NumberFormat(locale === "vi" ? "vi-VN" : "en-US", { maximumFractionDigits: 2 }).format(rateBps / 100)}%`;
}

function dateLabel(value: number, locale: string): string {
  return new Intl.DateTimeFormat(locale === "vi" ? "vi-VN" : "en-US", { dateStyle: "medium" }).format(new Date(value));
}

function tierCodeLabel(code: string): string {
  return code.replaceAll("_", " ").toLocaleLowerCase().replace(/(^|\s)\S/g, (letter) => letter.toUpperCase());
}

function statusKey(value: string): string {
  return value.trim().toLowerCase();
}

async function readJson<T>(path: string, signal: AbortSignal): Promise<T> {
  const response = await fetch(path, { credentials: "same-origin", cache: "no-store", signal });
  if (!response.ok) throw new Error(`Request failed: ${response.status}`);
  return response.json() as Promise<T>;
}

function PanelHeading({ icon: Icon, title, description, action }: { icon: typeof Gift; title: string; description?: string; action?: React.ReactNode }) {
  return (
    <div className="affiliate-panel-heading">
      <div className="affiliate-panel-heading__icon" aria-hidden="true"><Icon size={22} strokeWidth={1.35} /></div>
      <div className="affiliate-panel-heading__copy"><h2>{title}</h2>{description && <p>{description}</p>}</div>
      {action}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, note }: { icon: typeof Gift; label: string; value: string; note?: string }) {
  return <article className="affiliate-kpi"><div className="affiliate-kpi__icon" aria-hidden="true"><Icon size={23} strokeWidth={1.35} /></div><div className="affiliate-kpi__copy"><span>{label}</span><strong>{value}</strong>{note && <small>{note}</small>}</div></article>;
}

function LoadingState({ label }: { label: string }) {
  return <div className="affiliate-dashboard affiliate-dashboard--loading" role="status" aria-live="polite"><LoaderCircle className="affiliate-spinner" size={30} aria-hidden="true" /><p>{label}</p></div>;
}

function EmptyPolicyPanel({ t }: { t: (key: string) => string }) {
  return <section className="affiliate-policy-panel affiliate-panel affiliate-panel--empty" aria-labelledby="affiliate-policy-title"><PanelHeading icon={Gift} title={t("affiliate.policyTitle")} description={t("affiliate.policyUnavailable")} action={<span className="affiliate-panel-heading__status">{t("affiliate.policyComingSoon")}</span>} /><p className="affiliate-panel-note"><CircleAlert size={16} aria-hidden="true" />{t("affiliate.policyPending")}</p></section>;
}

function PolicyPanel({ policy, t, locale }: { policy: PublicAffiliatePolicy; t: (key: string, values?: Record<string, string | number>) => string; locale: string }) {
  return <section className="affiliate-policy-panel affiliate-panel" aria-labelledby="affiliate-policy-title">
    <PanelHeading icon={ReceiptText} title={t("affiliate.policyTitle")} description={t("affiliate.policyText", { version: policy.version })} />
    <div className="affiliate-policy-meta"><span>{t("affiliate.attributionWindow", { value: policy.attributionWindowDays })}</span><span>{t("affiliate.holdWindow", { value: policy.holdDays })}</span><span>{policy.currency}</span></div>
    <div className="affiliate-tier-table" role="table" aria-label={t("affiliate.tierTitle")}>
      {policy.tiers.map((tier, index) => <div className="affiliate-tier-table__row" role="row" key={`${tier.tierCode}-${tier.minQualifiedConversions}`}><span role="cell"><b>{tierCodeLabel(tier.tierCode)}</b><small>{t("affiliate.tierFrom", { value: tier.minQualifiedConversions })}</small></span><strong role="cell">{rateLabel(tier.rateBps, locale)}</strong><span className="affiliate-tier-table__index" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span></div>)}
    </div>
  </section>;
}

function ReferralLinkPanel({ dashboard, t }: { dashboard: AffiliateDashboard; t: (key: string) => string }) {
  const [copied, setCopied] = useState(false);
  const link = dashboard.referralLink;
  const copy = async () => {
    if (!link.available || !dashboard.referralLink.available) return;
    try {
      await navigator.clipboard.writeText(link.url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };
  return <section className="affiliate-link-panel affiliate-panel" aria-labelledby="affiliate-link-title">
    <PanelHeading icon={Link2} title={t("affiliate.referralLinkTitle")} description={link.available ? t("affiliate.linkReady") : t("affiliate.linkUnavailable")} />
    {link.available ? <div className="affiliate-referral-layout">
      <div className="affiliate-referral-copy">
        <div className="affiliate-link-field"><span>{link.url}</span><button type="button" onClick={copy} aria-label={copied ? t("affiliate.copied") : t("affiliate.copyLink")}><Copy size={17} aria-hidden="true" />{copied ? t("affiliate.copied") : t("affiliate.copyLink")}</button></div>
        <div className="affiliate-share-marks" aria-label={t("affiliate.shareQuickly")}><span className="affiliate-share-marks__label">{t("affiliate.shareQuickly")}</span><span aria-hidden="true"><b>f</b></span><span aria-hidden="true"><MessageCircle size={14} /></span><span aria-hidden="true"><Share2 size={14} /></span><span aria-hidden="true"><Link2 size={14} /></span></div>
        <p className="affiliate-panel-note"><BadgeCheck size={16} aria-hidden="true" />{t("affiliate.linkSecurityText")}</p>
      </div>
      {link.qrUrl && <div className="affiliate-qr-stack"><div className="affiliate-qr"><img src={link.qrUrl} alt={t("affiliate.qrAlt")} /></div><a className="affiliate-qr-download" href={link.qrUrl} download aria-label={t("affiliate.downloadQr")}><Download size={14} aria-hidden="true" />{t("affiliate.downloadQr")}</a></div>}
    </div> : <div className="affiliate-unavailable"><LockKeyhole size={24} aria-hidden="true" /><p>{t("affiliate.linkSecurityText")}</p><span>{t("affiliate.linkUnavailableAction")}</span></div>}
  </section>;
}

function TierPanel({ dashboard, policy, t, locale }: { dashboard: AffiliateDashboard; policy: PublicAffiliatePolicy | null; t: (key: string, values?: Record<string, string | number>) => string; locale: string }) {
  const progress = dashboard.progress;
  if (!policy || !progress) return <section className="affiliate-tier-panel affiliate-panel affiliate-panel--empty" aria-labelledby="affiliate-tier-title"><PanelHeading icon={Sparkles} title={t("affiliate.tierTitle")} description={t("affiliate.tierUnavailable")} /><p className="affiliate-panel-note"><CircleAlert size={16} aria-hidden="true" />{t("affiliate.policyPending")}</p></section>;
  const current = progress.currentTier;
  const next = progress.nextTier;
  const start = current?.minQualifiedConversions ?? 0;
  const end = next?.minQualifiedConversions ?? Math.max(start, progress.qualifiedConversions);
  const span = Math.max(1, end - start);
  const percent = next ? Math.min(100, Math.max(0, ((progress.qualifiedConversions - start) / span) * 100)) : 100;
  const remaining = next ? Math.max(0, next.minQualifiedConversions - progress.qualifiedConversions) : 0;
  return <section className="affiliate-tier-panel affiliate-panel" aria-labelledby="affiliate-tier-title">
    <PanelHeading icon={Sparkles} title={t("affiliate.tierTitle")} description={t("affiliate.tierDescription")} action={<Sparkles className="affiliate-panel-heading__mark" size={22} strokeWidth={1.2} aria-hidden="true" />} />
    <div className="affiliate-tier-track" aria-label={t("affiliate.tierProgressLabel")}><div className="affiliate-tier-track__line"><span style={{ width: `${percent}%` }} /></div><div className="affiliate-tier-track__nodes">{policy.tiers.map((tier, index) => <div className={current?.tierCode === tier.tierCode ? "is-current" : tier.minQualifiedConversions <= progress.qualifiedConversions ? "is-reached" : ""} key={`${tier.tierCode}-${index}`}><span className="affiliate-tier-node" aria-hidden="true">✦</span><strong>{tierCodeLabel(tier.tierCode)}</strong><b>{rateLabel(tier.rateBps, locale)}</b><small>{tier.minQualifiedConversions}</small></div>)}</div></div>
    <p className="affiliate-tier-qualified">{t("affiliate.qualifiedProgress", { value: progress.qualifiedConversions, next: next?.minQualifiedConversions ?? progress.qualifiedConversions })}</p>
    <div className="affiliate-tier-summary"><div><span>{t("affiliate.currentTier")}</span><strong>{current ? `${tierCodeLabel(current.tierCode)} · ${rateLabel(current.rateBps, locale)}` : t("affiliate.notAvailable")}</strong></div><div><span>{next ? t("affiliate.nextTier") : t("affiliate.highestTier")}</span><strong>{next ? `${tierCodeLabel(next.tierCode)} · ${t("affiliate.tierFrom", { value: next.minQualifiedConversions })}` : t("affiliate.highestTierValue")}</strong></div></div>
    {next && <p className="affiliate-tier-next">{t("affiliate.remaining", { value: remaining })}</p>}
  </section>;
}

function IncomePanel({ dashboard, currency, t, locale }: { dashboard: AffiliateDashboard; currency: string | null; t: (key: string) => string; locale: string }) {
  return <section className="affiliate-income-panel affiliate-panel" aria-labelledby="affiliate-income-title">
    <PanelHeading icon={WalletCards} title={t("affiliate.incomeTitle")} description={t("affiliate.incomeText")} action={<Link className="affiliate-panel-link" href="/account?tab=activity">{t("affiliate.viewHistory")} <ArrowRight size={14} aria-hidden="true" /></Link>} />
    <div className="affiliate-income-grid"><div><span>{t("affiliate.monthIncome")}</span><strong>{moneyLabel(dashboard.income.currentMonthMinor, currency, locale)}</strong></div><div><span>{t("affiliate.confirmedIncome")}</span><strong>{moneyLabel(dashboard.income.confirmedMinor, currency, locale)}</strong></div><div><span>{t("affiliate.pendingIncome")}</span><strong>{moneyLabel(dashboard.income.pendingMinor, currency, locale)}</strong></div><div><span>{t("affiliate.totalIncome")}</span><strong>{moneyLabel(dashboard.income.totalMinor, currency, locale)}</strong></div></div>
  </section>;
}

function ReferralHistoryPanel({ dashboard, t, locale }: { dashboard: AffiliateDashboard; t: (key: string) => string; locale: string }) {
  return <section className="affiliate-referrals-panel affiliate-panel" aria-labelledby="affiliate-referrals-title">
    <PanelHeading icon={UsersRound} title={t("affiliate.recentTitle")} description={t("affiliate.recentText")} action={<Link className="affiliate-panel-link" href="/account?tab=activity">{t("affiliate.viewAll")} <ChevronRight size={14} aria-hidden="true" /></Link>} />
    {dashboard.history.length === 0 ? <div className="affiliate-empty-list"><UsersRound size={25} aria-hidden="true" /><p>{t("affiliate.historyEmpty")}</p></div> : <div className="affiliate-history-table" role="table" aria-label={t("affiliate.recentTitle")}><div className="affiliate-history-table-heading" role="row"><span role="columnheader">{t("affiliate.referredMember")}</span><span role="columnheader">{t("affiliate.referralDate")}</span><span role="columnheader">{t("affiliate.referralStatus")}</span><span role="columnheader">{t("affiliate.referralCommission")}</span></div><div className="affiliate-history-list">{dashboard.history.slice(0, 5).map((item) => <div className="affiliate-history-row" role="row" key={item.id}><strong className="affiliate-history-member" role="cell">{t("affiliate.qualifiedMember")}</strong><span className="affiliate-history-date" role="cell">{dateLabel(item.fulfilledAt, locale)}</span><div className="affiliate-history-status" role="cell"><span className={`affiliate-status-dot affiliate-status-dot--${statusKey(item.status)}`} aria-hidden="true" />{t(`affiliate.status.${statusKey(item.status)}`)}</div><strong className="affiliate-history-amount" role="cell">{item.currency ? moneyLabel(item.commissionMinor, item.currency, locale) : t("affiliate.notAvailable")}</strong></div>)}</div></div>}
  </section>;
}

function HowItWorks({ t }: { t: (key: string) => string }) {
  const steps = [[Link2, "affiliate.flow.join"], [Share2, "affiliate.flow.share"], [BadgeCheck, "affiliate.flow.verify"], [ReceiptText, "affiliate.flow.ledger"]] as const;
  return <section className="affiliate-how-panel affiliate-panel" aria-labelledby="affiliate-how-title"><PanelHeading icon={Sparkles} title={t("affiliate.flowTitle")} description={t("affiliate.flowNote")} /><div className="affiliate-flow">{steps.map(([Icon, key], index) => <div className="affiliate-flow-step" key={key}><div className="affiliate-flow-icon" aria-hidden="true"><Icon size={20} strokeWidth={1.35} /></div><span>{String(index + 1).padStart(2, "0")}</span><p>{t(key)}</p>{index < steps.length - 1 && <ArrowRight className="affiliate-flow-arrow" size={17} aria-hidden="true" />}</div>)}</div></section>;
}

function PublicAffiliateIntro({ policy, t, authenticated, locale }: { policy: PublicAffiliatePolicy | null; t: (key: string, values?: Record<string, string | number>) => string; authenticated: boolean; locale: string }) {
  return <>
        <section className="affiliate-public-panel affiliate-panel"><PanelHeading icon={BadgeCheck} title={t("affiliate.publicProofTitle")} description={t("affiliate.publicProofText")} /><div className="affiliate-public-points"><span><Check size={15} aria-hidden="true" />{t("affiliate.publicPointOne")}</span><span><Check size={15} aria-hidden="true" />{t("affiliate.publicPointTwo")}</span><span><Check size={15} aria-hidden="true" />{t("affiliate.publicPointThree")}</span></div>{!authenticated && <div className="affiliate-action-row"><Link className="button black" href="/auth?return_to=/affiliate">{t("affiliate.signIn")} <ArrowRight size={15} aria-hidden="true" /></Link><Link className="button" href="/auth?mode=register&return_to=/affiliate">{t("affiliate.register")}</Link></div>}</section>
    {policy ? <PolicyPanel policy={policy} t={t} locale={locale} /> : <EmptyPolicyPanel t={t} />}
  </>;
}

export default function AffiliateDashboardPage({ authenticated }: { authenticated: boolean }) {
  const { t, locale } = useLanguage();
  const [policy, setPolicy] = useState<PublicAffiliatePolicy | null>(null);
  const [dashboard, setDashboard] = useState<AffiliateDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    void Promise.all([
      readJson<PolicyResponse>("/api/affiliate/policy", controller.signal),
      authenticated ? readJson<AffiliateDashboard>("/api/affiliate/dashboard", controller.signal) : Promise.resolve(null),
    ]).then(([policyResponse, dashboardResponse]) => {
      if (!active) return;
      setPolicy(policyResponse.policy);
      setDashboard(dashboardResponse);
      setLoading(false);
    }).catch((reason: unknown) => {
      if (!active || (reason instanceof DOMException && reason.name === "AbortError")) return;
      setError(true);
      setLoading(false);
    });
    return () => { active = false; controller.abort(); };
  }, [authenticated]);

  const activePolicy = dashboard?.policy ?? policy;
  const hasActiveAffiliateProfile = dashboard?.profile?.status === "ACTIVE";
  const currency = dashboard?.income.currency ?? activePolicy?.currency ?? null;
  const kpis = useMemo(() => dashboard ? [
    { icon: Sparkles, label: t("affiliate.currentCommission"), value: rateLabel(dashboard.progress?.currentTier?.rateBps ?? null, locale), note: dashboard.progress?.currentTier ? t("affiliate.serverPolicyRate") : t("affiliate.notAvailable") },
    { icon: UsersRound, label: t("affiliate.qualifiedUsers"), value: dashboard.summary.conversions.toLocaleString(locale === "vi" ? "vi-VN" : "en-US"), note: t("affiliate.qualifiedUsersNote") },
    { icon: CircleDollarSign, label: t("affiliate.monthIncome"), value: moneyLabel(dashboard.income.currentMonthMinor, currency, locale), note: t("affiliate.ledgerDerived") },
    { icon: Clock3, label: t("affiliate.pendingIncome"), value: moneyLabel(dashboard.income.pendingMinor, currency, locale), note: t("affiliate.holdWindowShort") },
  ] : [], [currency, dashboard, locale, t]);

  if (loading) return <LoadingState label={t("affiliate.loading")} />;
  return <div className="affiliate-dashboard">
    <section className="affiliate-dashboard__hero">
      <div className="affiliate-hero-copy"><span className="affiliate-hero-kicker">{t("affiliate.heroKicker")}</span><h1>{t("affiliate.heroTitle")}</h1><p>{t("affiliate.heroText")}</p>{error && <p className="affiliate-error"><CircleAlert size={15} aria-hidden="true" />{t(authenticated ? "affiliate.dashboardError" : "affiliate.policyError")}</p>}</div>
      <div className="affiliate-hero-orbit" aria-hidden="true"><div className="affiliate-orbit-ring affiliate-orbit-ring--outer" /><div className="affiliate-orbit-ring affiliate-orbit-ring--inner" /><Sparkles size={42} strokeWidth={1} /><span>✦</span><span>✧</span></div>
    </section>
    {dashboard && hasActiveAffiliateProfile ? <>
      <section className="affiliate-kpi-grid" aria-label={t("affiliate.dashboardEyebrow")}>{kpis.map((item) => <StatCard key={item.label} {...item} />)}</section>
      <div className="affiliate-dashboard-grid"><div className="affiliate-dashboard-grid__main"><TierPanel dashboard={dashboard} policy={activePolicy} t={t} locale={locale} /><IncomePanel dashboard={dashboard} currency={currency} t={t} locale={locale} /></div><div className="affiliate-dashboard-grid__side"><ReferralLinkPanel dashboard={dashboard} t={t} /><ReferralHistoryPanel dashboard={dashboard} t={t} locale={locale} /></div></div>
      <div className="affiliate-lower-grid"><HowItWorks t={t} />{activePolicy ? <PolicyPanel policy={activePolicy} t={t} locale={locale} /> : <EmptyPolicyPanel t={t} />}</div>
    </> : <div className="affiliate-public-grid"><PublicAffiliateIntro policy={activePolicy} t={t} authenticated={authenticated} locale={locale} /><HowItWorks t={t} /></div>}
  </div>;
}
