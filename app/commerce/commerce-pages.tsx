"use client";

import Link from "next/link";
import { ArrowRight, Check, Clock3, CreditCard, ExternalLink, Gift, History, Link2, Moon, PackageCheck, ShieldCheck, Sparkles, Users, WalletCards } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { useLanguage } from "@/components/language";

type PackageBenefitSnapshot = {
  credits?: { units: number; expiresInSeconds?: number | null; validityDays?: number | null };
  catalog?: { popular?: boolean };
  vip?: { durationSeconds: number; benefitVersion: string; benefits: Record<string, unknown> };
  [key: string]: unknown;
};

type PackageVersion = {
  id: string;
  packageId: string;
  nameEn: string;
  nameVi: string;
  version: number;
  amountMinor: number;
  currency: string;
  creditUnits: number;
  vipDurationSeconds: number | null;
  benefitSnapshot: PackageBenefitSnapshot;
};

type CheckoutForm = { action: string; method: "POST"; fields: Record<string, string> };
type CheckoutResult = { order: { id: string; status: string; amount_minor: number; currency: string; created_at: number }; checkout: CheckoutForm | null };

type AccountSummary = {
  member: { displayName: string | null; username: string; email?: string };
  credits: { balance: { availableUnits: number; reservedUnits: number; totalUnits: number } };
  vip: Array<{ id: string; entitlementType: string; benefitVersion: string; sourceType: string; isInternalTest: boolean; startsAt: number; endsAt: number | null; status: string }>;
  counts: { readings: number; shares: number; orders: number; affiliateConversions: number };
  affiliate: { conversions: number; held: number; eligible: number; reversed: number; creditedMinor: number; debitedMinor: number; netMinor: number };
};

type PublicAffiliateTier = { tierCode: string; minQualifiedConversions: number; rateBps: number };
type PublicAffiliatePolicy = { version: number; currency: string; attributionWindowDays: number; holdDays: number; tiers: PublicAffiliateTier[] };
type AffiliateHistoryItem = { id: string; amountMinor: number; currency: string; commissionMinor: number; status: string; fulfilledAt: number; eligibleAt: number | null; reversedAt: number | null; createdAt: number };
type AffiliateDashboard = {
  profile: { status: "ACTIVE" | "INACTIVE" | "SUSPENDED" } | null;
  policy: PublicAffiliatePolicy | null;
  progress: { qualifiedConversions: number; currentTier: PublicAffiliateTier | null; nextTier: PublicAffiliateTier | null } | null;
  referralLink: { available: false; reason: "not_supported_by_current_backend" };
  summary: AccountSummary["affiliate"];
  history: AffiliateHistoryItem[];
};

type LegacyHistoryItem = { id: string; createdAt: number; status: string | null; amountMinor: number | null; currency: string | null; referenceId: string | null };
type Translate = (key: string, values?: Record<string, string | number>) => string;

const accountSummaryPath = "/api/account/summary";
const affiliateHistoryPath = "/api/account/history?kind=affiliate";

function interpolateCopy(value: string, values?: Record<string, string | number>): string {
  if (!values) return value;
  return Object.entries(values).reduce((result, [key, replacement]) => result.replaceAll(`{${key}}`, String(replacement)), value);
}

class ApiRequestError extends Error {
  constructor(readonly status: number) {
    super("NaTarot request failed");
    this.name = "ApiRequestError";
  }
}

async function readJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, { ...init, credentials: "same-origin", cache: "no-store" });
  if (!response.ok) throw new ApiRequestError(response.status);
  return response.json() as Promise<T>;
}

function moneyLabel(amount: number, currency: string, locale: string, maximumFractionDigits = 0): string {
  return new Intl.NumberFormat(locale === "vi" ? "vi-VN" : "en-US", { style: "currency", currency, maximumFractionDigits }).format(amount);
}

function dateLabel(value: number, locale: string): string {
  return new Intl.DateTimeFormat(locale === "vi" ? "vi-VN" : "en-US", { dateStyle: "medium" }).format(new Date(value));
}

function packageName(item: PackageVersion, locale: string): string {
  return locale === "vi" ? item.nameVi : item.nameEn;
}

function vipDays(seconds: number | null): number | null {
  if (!seconds || seconds <= 0) return null;
  return Math.max(1, Math.round(seconds / 86_400));
}

function creditValidityDays(item: PackageVersion): number | null {
  const seconds = item.benefitSnapshot.credits?.expiresInSeconds;
  if (!Number.isSafeInteger(seconds) || !seconds || seconds <= 0) return null;
  const snapshotDays = item.benefitSnapshot.credits?.validityDays;
  return Number.isSafeInteger(snapshotDays) && snapshotDays && snapshotDays > 0 ? snapshotDays : Math.round(seconds / 86_400);
}

function createCheckoutIdempotencyKey(): string {
  const suffix = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `${Date.now()}:${Math.random().toString(36).slice(2, 10)}`;
  return `checkout:${suffix}`;
}

function checkoutReturnPath(packageId?: string): string {
  return packageId ? `/checkout?package=${encodeURIComponent(packageId)}` : "/checkout";
}

function rateLabel(rateBps: number, locale: string): string {
  return `${new Intl.NumberFormat(locale === "vi" ? "vi-VN" : "en-US", { maximumFractionDigits: 2 }).format(rateBps / 100)}%`;
}

function benefitKeys(item: PackageVersion, t: (key: string) => string): string[] {
  const labels: string[] = [];
  const benefits = item.benefitSnapshot.vip?.benefits ?? {};
  const supported: Record<string, string> = {
    premiumSpreads: "member.benefitPremiumSpreads",
    guidebookAccess: "member.benefitGuidebookAccess",
    savedReadings: "member.benefitSavedReadings",
  };
  for (const [key, labelKey] of Object.entries(supported)) if (benefits[key] === true) labels.push(t(labelKey));
  return labels;
}

function MemberStatusPanel({ summary, locale, t }: { summary: AccountSummary; locale: string; t: Translate }) {
  const activeVip = summary.vip[0] ?? null;
  return (
    <section className="commerce-member-status functional-section" aria-labelledby="member-status-title">
      <div className="functional-section-heading">
        <div><span className="commerce-eyebrow">{t("member.statusEyebrow")}</span><h2 id="member-status-title">{summary.member.displayName || summary.member.username}</h2><p>{t("member.statusText")}</p></div>
        <ShieldCheck size={22} aria-hidden="true" />
      </div>
      <div className="commerce-stat-grid">
        <div><WalletCards size={17} aria-hidden="true" /><span>{t("member.creditsAvailable")}</span><strong>{summary.credits.balance.availableUnits}</strong><small>{t("member.creditsReserved", { value: summary.credits.balance.reservedUnits })}</small></div>
        <div><Moon size={17} aria-hidden="true" /><span>{t("member.vipStatus")}</span><strong>{activeVip ? t("member.vipActive") : t("member.vipInactive")}</strong><small>{activeVip?.isInternalTest ? t("member.internalTestEntitlement") : activeVip?.endsAt ? t("member.vipUntil", { value: dateLabel(activeVip.endsAt, locale) }) : activeVip ? activeVip.benefitVersion : t("member.noVip")}</small></div>
        <div><History size={17} aria-hidden="true" /><span>{t("member.readingHistory")}</span><strong>{summary.counts.readings}</strong><small>{t("member.shareCount", { value: summary.counts.shares })}</small></div>
        <div><PackageCheck size={17} aria-hidden="true" /><span>{t("member.orderHistory")}</span><strong>{summary.counts.orders}</strong><small>{t("member.entitlementCount", { value: summary.vip.length })}</small></div>
      </div>
      <div className="functional-inline-actions"><Link className="button" href="/account">{t("member.openAccount")} <ArrowRight size={15} aria-hidden="true" /></Link><Link className="button" href="/affiliate">{t("member.openAffiliate")} <ArrowRight size={15} aria-hidden="true" /></Link></div>
    </section>
  );
}

function PackageCard({ item, locale, t }: { item: PackageVersion; locale: string; t: Translate }) {
  const days = vipDays(item.vipDurationSeconds ?? item.benefitSnapshot.vip?.durationSeconds ?? null);
  const creditDays = creditValidityDays(item);
  const benefits = benefitKeys(item, t);
  const unitPrice = item.creditUnits > 0 ? moneyLabel(item.amountMinor / item.creditUnits, item.currency, locale, 2) : null;
  return (
    <article className="commerce-package-card functional-section">
      <div className="functional-section-heading"><div><span className="commerce-eyebrow">{t("member.packageEyebrow")}</span><h2>{packageName(item, locale)} {item.benefitSnapshot.catalog?.popular && <small>{t("member.popular")}</small>}</h2><p>{t("member.packageReady")}</p></div><Sparkles size={20} aria-hidden="true" /></div>
      <div className="commerce-package-price"><strong>{moneyLabel(item.amountMinor, item.currency, locale)}</strong><span>{item.currency}</span></div>
      <div className="commerce-benefit-list"><div><CreditCard size={17} aria-hidden="true" /><span>{t("member.credits")}</span><strong>{item.creditUnits}</strong></div>{creditDays && <div><Clock3 size={17} aria-hidden="true" /><span>{t("member.creditValidityLabel")}</span><strong>{t("member.days", { value: creditDays })}</strong></div>}<div><Moon size={17} aria-hidden="true" /><span>{t("member.vipDuration")}</span><strong>{days ? t("member.days", { value: days }) : t("member.notIncluded")}</strong></div>{benefits.map((benefit) => <div key={benefit}><Check size={17} aria-hidden="true" /><span>{benefit}</span></div>)}</div>
      {unitPrice && <p className="commerce-unit-price">{t("member.unitPrice", { value: unitPrice })}</p>}
      <Link className="button black" href={`/checkout?package=${encodeURIComponent(item.id)}`}>{t("member.choosePackage")} <ArrowRight size={15} aria-hidden="true" /></Link>
    </article>
  );
}

export function PackagesPage({ authenticated = false }: { authenticated?: boolean }) {
  const { locale, t: translate } = useLanguage();
  const t: Translate = (key, values) => interpolateCopy(translate(key), values);
  const [packages, setPackages] = useState<PackageVersion[]>([]);
  const [summary, setSummary] = useState<AccountSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [accountLoading, setAccountLoading] = useState(authenticated);
  const [messageKey, setMessageKey] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void readJson<{ packages: PackageVersion[] }>("/api/packages")
      .then((result) => { if (active) setPackages(result.packages); })
      .catch(() => { if (active) setMessageKey("member.catalogError"); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!authenticated) return;
    let active = true;
    void readJson<AccountSummary>(accountSummaryPath)
      .then((result) => { if (active) setSummary(result); })
      .catch(() => undefined)
      .finally(() => { if (active) setAccountLoading(false); });
    return () => { active = false; };
  }, [authenticated]);

  return (
    <div className="functional-page commerce-page">
      <header className="page-head functional-page-head commerce-hero"><span className="commerce-eyebrow">{t("member.eyebrow")}</span><h1>{t("member.title")}</h1><p>{t("member.intro")}</p>{!authenticated && <div className="functional-inline-actions commerce-hero-actions"><Link className="button black" href="/auth?return_to=/packages">{t("member.signIn")}</Link><Link className="button" href="/auth?mode=register&return_to=/packages">{t("member.register")}</Link></div>}</header>
      {authenticated && accountLoading && <p className="functional-status" role="status" aria-live="polite">{t("member.statusLoading")}</p>}
      {authenticated && !accountLoading && summary && <MemberStatusPanel summary={summary} locale={locale} t={t} />}
      {loading && <p className="functional-status" role="status" aria-live="polite">{t("member.catalogLoading")}</p>}
      {!loading && messageKey && <p className="functional-status functional-status--error" role="status" aria-live="polite">{t(messageKey)}</p>}
      {!loading && !messageKey && packages.length === 0 && <section className="functional-section commerce-empty" role="status"><PackageCheck size={24} aria-hidden="true" /><h2>{t("member.packageEmpty")}</h2><p>{t("member.packageEmptyText")}</p></section>}
      {!loading && !messageKey && packages.length > 0 && <><section id="vip" className="commerce-package-grid" aria-labelledby="packages-title"><div className="commerce-section-heading"><div><span className="commerce-eyebrow">{t("member.packageEyebrow")}</span><h2 id="packages-title">{t("member.packagesTitle")}</h2></div><Link className="text-button" href="/account">{t("member.openHistory")} <ArrowRight size={14} aria-hidden="true" /></Link></div><div className="commerce-package-cards">{packages.map((item) => <PackageCard key={item.id} item={item} locale={locale} t={t} />)}</div></section><section className="functional-section commerce-comparison" aria-labelledby="comparison-title"><div className="functional-section-heading"><div><span className="commerce-eyebrow">{t("member.comparisonEyebrow")}</span><h2 id="comparison-title">{t("member.comparisonTitle")}</h2><p>{t("member.comparisonText")}</p></div><CreditCard size={20} aria-hidden="true" /></div><div className="commerce-comparison-grid">{packages.map((item) => { const days = vipDays(item.vipDurationSeconds ?? item.benefitSnapshot.vip?.durationSeconds ?? null); return <article key={item.id}><strong>{packageName(item, locale)}</strong><span><CreditCard size={14} aria-hidden="true" />{item.creditUnits} {t("member.credits")}</span><span><Moon size={14} aria-hidden="true" />{days ? t("member.days", { value: days }) : t("member.notIncluded")}</span></article>; })}</div></section></>}
      {!loading && !messageKey && !packages.some((item) => Boolean(item.vipDurationSeconds || item.benefitSnapshot.vip)) && <section id="vip" className="functional-section commerce-vip-pending" aria-labelledby="vip-pending-title"><div className="functional-section-heading"><div><h2 id="vip-pending-title">{t("member.vipCatalogPending")}</h2><p>{t("member.vipCatalogPendingText")}</p></div><Moon size={20} aria-hidden="true" /></div></section>}
      <div className="functional-toolbar"><Link className="button" href="/affiliate">{t("member.openAffiliate")} <ArrowRight size={15} aria-hidden="true" /></Link><Link className="button" href="/account">{t("member.openAccount")} <ArrowRight size={15} aria-hidden="true" /></Link></div>
    </div>
  );
}

export function CheckoutPage({ authenticated, packageId }: { authenticated: boolean; packageId?: string }) {
  const { locale, t: translate } = useLanguage();
  const t: Translate = (key, values) => interpolateCopy(translate(key), values);
  const [packages, setPackages] = useState<PackageVersion[]>([]);
  const [selectedId, setSelectedId] = useState(packageId ?? "");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [messageKey, setMessageKey] = useState<string | null>(null);
  const [order, setOrder] = useState<CheckoutResult["order"] | null>(null);
  const [checkout, setCheckout] = useState<CheckoutForm | null>(null);
  const [idempotencyKey, setIdempotencyKey] = useState(createCheckoutIdempotencyKey);

  useEffect(() => {
    if (!authenticated) return;
    let active = true;
    void readJson<{ packages: PackageVersion[] }>("/api/packages")
      .then((result) => { if (!active) return; setPackages(result.packages); const initialId = packageId && result.packages.some((item) => item.id === packageId) ? packageId : result.packages[0]?.id ?? ""; setSelectedId(initialId); })
      .catch(() => { if (active) setMessageKey("member.catalogError"); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [authenticated, packageId]);

  const selected = useMemo(() => packages.find((item) => item.id === selectedId) ?? null, [packages, selectedId]);
  const selectedCreditDays = selected ? creditValidityDays(selected) : null;

  async function startCheckout(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    setBusy(true); setMessageKey(null); setOrder(null); setCheckout(null);
    try {
      const pending = await readJson<{ order: CheckoutResult["order"] }>("/api/orders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ package_version_id: selected.id, idempotency_key: idempotencyKey }) });
      setOrder(pending.order);
      try {
        const result = await readJson<CheckoutResult>("/api/commercial/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ package_version_id: selected.id, idempotency_key: idempotencyKey, payment_method: "BANK_TRANSFER" }) });
        setOrder(result.order); setCheckout(result.checkout);
      } catch (error: unknown) {
        setCheckout(null);
        setMessageKey(error instanceof ApiRequestError && error.status === 503 ? "member.paymentUnavailable" : "member.checkoutError");
      }
    } catch (error: unknown) {
      setMessageKey(error instanceof ApiRequestError && error.status === 503 ? "member.paymentUnavailable" : "member.checkoutError");
    } finally { setBusy(false); }
  }

  const selectedDays = selected ? vipDays(selected.vipDurationSeconds) : null;
  if (!authenticated) return <section className="empty functional-empty commerce-page"><CreditCard size={34} aria-hidden="true" /><h1>{t("member.checkoutTitle")}</h1><p>{t("member.checkoutAuth")}</p><Link className="button black" href={`/auth?return_to=${encodeURIComponent(checkoutReturnPath(packageId))}`}>{t("member.signIn")}</Link></section>;

  return <div className="functional-page commerce-page"><header className="page-head functional-page-head commerce-hero"><span className="commerce-eyebrow">{t("member.checkoutEyebrow")}</span><h1>{t("member.checkoutTitle")}</h1><p>{t("member.checkoutIntro")}</p></header><div className="functional-toolbar"><Link className="button" href="/packages">{t("member.backToPackages")}</Link><Link className="button" href="/account">{t("member.openAccount")}</Link></div>{loading && <p className="functional-status" role="status" aria-live="polite">{t("member.catalogLoading")}</p>}{!loading && messageKey && <p className="functional-status functional-status--error" role="status" aria-live="polite">{t(messageKey)}</p>}{!loading && !messageKey && packages.length === 0 && <section className="functional-section commerce-empty" role="status"><PackageCheck size={24} aria-hidden="true" /><h2>{t("member.packageEmpty")}</h2><p>{t("member.packageEmptyText")}</p></section>}{!loading && !messageKey && packages.length > 0 && <section className="functional-section" aria-labelledby="checkout-package-title"><div className="functional-section-heading"><div><span className="commerce-eyebrow">{t("member.checkoutEyebrow")}</span><h2 id="checkout-package-title">{t("member.choosePackage")}</h2><p>{t("member.checkoutServerTruth")}</p></div><CreditCard size={20} aria-hidden="true" /></div><form onSubmit={startCheckout} className="commerce-checkout-form"><label>{t("member.packageLabel")}<select value={selectedId} onChange={(event) => { setSelectedId(event.target.value); setIdempotencyKey(createCheckoutIdempotencyKey()); setOrder(null); setCheckout(null); }}>{packages.map((item) => <option key={item.id} value={item.id}>{packageName(item, locale)} · {moneyLabel(item.amountMinor, item.currency, locale)}</option>)}</select></label>{selected && <div className="commerce-selected-package"><strong>{moneyLabel(selected.amountMinor, selected.currency, locale)}</strong><span>{selected.creditUnits} {t("member.credits")}{selectedDays ? ` · ${t("member.days", { value: selectedDays })}` : ""}</span>{selectedCreditDays && <p className="commerce-credit-validity">{t("member.creditValidity", { value: selectedCreditDays })}</p>}</div>}<button className="button black" type="submit" disabled={!selected || busy}>{busy ? t("member.checkoutPreparing") : t("member.startCheckout")} <ArrowRight size={15} aria-hidden="true" /></button></form></section>}{order && <section className="functional-section commerce-order-state" aria-labelledby="checkout-order-title"><div className="functional-section-heading"><div><span className="commerce-eyebrow">{t("member.orderEyebrow")}</span><h2 id="checkout-order-title">{t("member.orderCreated")}</h2><p>{t("member.orderStatus", { value: order.status })} · {moneyLabel(order.amount_minor, order.currency, locale)}</p></div><Clock3 size={20} aria-hidden="true" /></div>{checkout ? <form action={checkout.action} method={checkout.method}><input type="hidden" name="natarot_order_id" value={order.id} />{Object.entries(checkout.fields).map(([name, value]) => <input key={name} type="hidden" name={name} value={value} />)}<button className="button black" type="submit">{t("member.continueProvider")} <ExternalLink size={15} aria-hidden="true" /></button></form> : <p className="functional-status">{t("member.paymentUnavailable")}</p>}</section>}</div>;
}

function policyTierLabel(tier: PublicAffiliateTier, locale: string, t: Translate): string {
  return `${tier.tierCode} · ${rateLabel(tier.rateBps, locale)} · ${t("affiliate.fromConversions", { value: tier.minQualifiedConversions })}`;
}

function affiliateStatusLabel(status: string, t: (key: string) => string): string {
  const key = `affiliate.status.${status.toLowerCase()}`;
  const translated = t(key);
  return translated === key ? status : translated;
}

function AffiliatePolicy({ policy, locale, t }: { policy: PublicAffiliatePolicy | null; locale: string; t: Translate }) {
  return <section className="functional-section commerce-policy" aria-labelledby="affiliate-policy-title"><div className="functional-section-heading"><div><span className="commerce-eyebrow">{t("affiliate.policyEyebrow")}</span><h2 id="affiliate-policy-title">{t("affiliate.policyTitle")}</h2><p>{policy ? t("affiliate.policyText", { version: policy.version }) : t("affiliate.policyUnavailable")}</p></div><Gift size={20} aria-hidden="true" /></div>{policy ? <><div className="commerce-policy-meta"><span>{t("affiliate.attributionWindow", { value: policy.attributionWindowDays })}</span><span>{t("affiliate.holdWindow", { value: policy.holdDays })}</span><span>{policy.currency}</span></div><div className="commerce-tier-list">{policy.tiers.map((tier) => <div key={`${tier.tierCode}-${tier.minQualifiedConversions}`}><strong>{tier.tierCode}</strong><span>{rateLabel(tier.rateBps, locale)}</span><small>{t("affiliate.fromConversions", { value: tier.minQualifiedConversions })}</small></div>)}</div></> : <p className="functional-status">{t("affiliate.policyPending")}</p>}</section>;
}

function AffiliateDashboardView({ dashboard, locale, t }: { dashboard: AffiliateDashboard; locale: string; t: Translate }) {
  const currency = dashboard.policy?.currency;
  return <div className="commerce-affiliate-dashboard"><section className="commerce-member-status functional-section" aria-labelledby="affiliate-status-title"><div className="functional-section-heading"><div><span className="commerce-eyebrow">{t("affiliate.dashboardEyebrow")}</span><h2 id="affiliate-status-title">{dashboard.profile ? affiliateStatusLabel(dashboard.profile.status, t) : t("affiliate.notJoined")}</h2><p>{dashboard.profile ? t("affiliate.dashboardText") : t("affiliate.profileUnavailable")}</p></div><Users size={22} aria-hidden="true" /></div><div className="commerce-stat-grid"><div><Sparkles size={17} aria-hidden="true" /><span>{t("affiliate.conversions")}</span><strong>{dashboard.summary.conversions}</strong><small>{t("affiliate.heldAndEligible", { held: dashboard.summary.held, eligible: dashboard.summary.eligible })}</small></div><div><WalletCards size={17} aria-hidden="true" /><span>{t("affiliate.netCommission")}</span><strong>{currency ? moneyLabel(dashboard.summary.netMinor, currency, locale) : t("affiliate.notAvailable")}</strong><small>{t("affiliate.reversed", { value: dashboard.summary.reversed })}</small></div><div><Link2 size={17} aria-hidden="true" /><span>{t("affiliate.referralLinkTitle")}</span><strong>{t("affiliate.notAvailable")}</strong><small>{t("affiliate.linkUnavailable")}</small></div><div><Clock3 size={17} aria-hidden="true" /><span>{t("affiliate.payoutTitle")}</span><strong>{t("affiliate.notAvailable")}</strong><small>{t("affiliate.payoutUnavailable")}</small></div></div></section>{dashboard.progress && <section className="functional-section commerce-tier-progress" aria-labelledby="affiliate-tier-title"><div className="functional-section-heading"><div><span className="commerce-eyebrow">{t("affiliate.tierEyebrow")}</span><h2 id="affiliate-tier-title">{t("affiliate.tierTitle")}</h2><p>{t("affiliate.qualified", { value: dashboard.progress.qualifiedConversions })}</p></div><Sparkles size={20} aria-hidden="true" /></div><div className="commerce-tier-current"><div><span>{t("affiliate.currentTier")}</span><strong>{dashboard.progress.currentTier ? policyTierLabel(dashboard.progress.currentTier, locale, t) : t("affiliate.notAvailable")}</strong></div>{dashboard.progress.nextTier && <div><span>{t("affiliate.nextTier")}</span><strong>{policyTierLabel(dashboard.progress.nextTier, locale, t)}</strong></div>}</div></section>}<section className="functional-section commerce-referral-state" aria-labelledby="affiliate-link-title"><div className="functional-section-heading"><div><span className="commerce-eyebrow">{t("affiliate.referralEyebrow")}</span><h2 id="affiliate-link-title">{t("affiliate.referralLinkTitle")}</h2><p>{t("affiliate.linkUnavailable")}</p></div><Link2 size={20} aria-hidden="true" /></div><p className="functional-status">{t("affiliate.linkSecurityText")}</p></section><section className="functional-section" aria-labelledby="affiliate-history-title"><div className="functional-section-heading"><div><span className="commerce-eyebrow">{t("affiliate.historyEyebrow")}</span><h2 id="affiliate-history-title">{t("affiliate.historyTitle")}</h2><p>{t("affiliate.historyText")}</p></div><History size={20} aria-hidden="true" /></div>{dashboard.history.length === 0 ? <p className="functional-status">{t("affiliate.historyEmpty")}</p> : <div className="functional-history-list">{dashboard.history.map((item) => <div className="functional-history-row commerce-affiliate-history-row" key={item.id}><span className="functional-history-kind">{affiliateStatusLabel(item.status, t)}</span><strong>{item.commissionMinor > 0 && item.currency ? moneyLabel(item.commissionMinor, item.currency, locale) : t("affiliate.commissionPending")}</strong><small>{dateLabel(item.createdAt, locale)} · {item.currency ? moneyLabel(item.amountMinor, item.currency, locale) : t("affiliate.notAvailable")}</small></div>)}</div>}</section></div>;
}

export function AffiliatePage({ authenticated }: { authenticated: boolean }) {
  const { locale, t: translate } = useLanguage();
  const t: Translate = (key, values) => interpolateCopy(translate(key), values);
  const [policy, setPolicy] = useState<PublicAffiliatePolicy | null>(null);
  const [dashboard, setDashboard] = useState<AffiliateDashboard | null>(null);
  const [policyLoading, setPolicyLoading] = useState(true);
  const [dashboardLoading, setDashboardLoading] = useState(authenticated);
  const [messageKey, setMessageKey] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void readJson<{ policy: PublicAffiliatePolicy | null }>("/api/affiliate/policy")
      .then((result) => { if (active) setPolicy(result.policy); })
      .catch(() => { if (active) setMessageKey("affiliate.policyError"); })
      .finally(() => { if (active) setPolicyLoading(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!authenticated) return;
    let active = true;
    void readJson<AffiliateDashboard>("/api/affiliate/dashboard")
      .then((result) => { if (active) setDashboard(result); })
      .catch(async () => {
        try {
          const [summary, history] = await Promise.all([readJson<AccountSummary>(accountSummaryPath), readJson<{ items: LegacyHistoryItem[] }>(affiliateHistoryPath)]);
          if (!active) return;
          setDashboard({ profile: null, policy: null, progress: null, referralLink: { available: false, reason: "not_supported_by_current_backend" }, summary: summary.affiliate, history: history.items.map((item) => ({ id: item.id, amountMinor: item.amountMinor ?? 0, currency: item.currency ?? "", commissionMinor: 0, status: item.status ?? "HELD", fulfilledAt: item.createdAt, eligibleAt: null, reversedAt: null, createdAt: item.createdAt })) });
        } catch {
          if (active) setMessageKey("affiliate.dashboardError");
        }
      })
      .finally(() => { if (active) setDashboardLoading(false); });
    return () => { active = false; };
  }, [authenticated]);

  return <div className="functional-page commerce-page affiliate-page"><header className="page-head functional-page-head commerce-hero"><span className="commerce-eyebrow">{t("affiliate.eyebrow")}</span><h1>{t("affiliate.title")}</h1><p>{t("affiliate.intro")}</p>{!authenticated && <div className="functional-inline-actions commerce-hero-actions"><Link className="button black" href="/auth?return_to=/affiliate">{t("affiliate.signIn")}</Link><Link className="button" href="/auth?mode=register&return_to=/affiliate">{t("affiliate.register")}</Link></div>}</header><section className="functional-section commerce-flow" aria-labelledby="affiliate-flow-title"><div className="functional-section-heading"><div><span className="commerce-eyebrow">{t("affiliate.flowEyebrow")}</span><h2 id="affiliate-flow-title">{t("affiliate.flowTitle")}</h2></div><Users size={20} aria-hidden="true" /></div><div className="commerce-flow-grid">{["join", "share", "verify", "ledger"].map((step, index) => <div key={step}><span>0{index + 1}</span><strong>{t(`affiliate.flow.${step}`)}</strong></div>)}</div><p className="functional-status">{t("affiliate.flowNote")}</p></section>{policyLoading && <p className="functional-status" role="status" aria-live="polite">{t("affiliate.loading")}</p>}{!policyLoading && messageKey && <p className="functional-status functional-status--error" role="status" aria-live="polite">{t(messageKey)}</p>}{!policyLoading && <AffiliatePolicy policy={policy} locale={locale} t={t} />}{authenticated && dashboardLoading && <p className="functional-status" role="status" aria-live="polite">{t("affiliate.loading")}</p>}{authenticated && !dashboardLoading && dashboard && <AffiliateDashboardView dashboard={dashboard} locale={locale} t={t} />}{authenticated && !dashboardLoading && !dashboard && <p className="functional-status" role="status" aria-live="polite">{t("affiliate.dashboardError")}</p>}<div className="functional-toolbar"><Link className="button" href="/packages">{t("affiliate.openPackages")} <ArrowRight size={15} aria-hidden="true" /></Link><Link className="button" href="/account">{t("affiliate.openAccount")} <ArrowRight size={15} aria-hidden="true" /></Link></div></div>;
}
