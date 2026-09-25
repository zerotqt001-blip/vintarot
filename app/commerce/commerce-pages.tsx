"use client";

import Link from "next/link";
import { ArrowRight, Clock3, CreditCard, Crown, ExternalLink, History, Moon, PackageCheck, Share2, ShieldCheck, Sparkles, WalletCards } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { useLanguage } from "@/components/language";
import type { PackageVersion } from "@/lib/packages/types";

type CheckoutForm = { action: string; method: "POST"; fields: Record<string, string> };
type CheckoutResult = { order: { id: string; status: string; amount_minor: number; currency: string; created_at: number }; checkout: CheckoutForm | null };

type AccountSummary = {
  member: { displayName: string | null; username: string; email?: string };
  credits: { balance: { availableUnits: number; reservedUnits: number; totalUnits: number } };
  vip: Array<{ id: string; entitlementType: string; benefitVersion: string; sourceType: string; isInternalTest: boolean; startsAt: number; endsAt: number | null; status: string }>;
  counts: { readings: number; shares: number; orders: number; affiliateConversions: number };
  affiliate: { conversions: number; held: number; eligible: number; reversed: number; creditedMinor: number; debitedMinor: number; netMinor: number };
};

type Translate = (key: string, values?: Record<string, string | number>) => string;

const accountSummaryPath = "/api/account/summary";

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

function packageName(item: PackageVersion, locale: string): string {
  return locale === "vi" ? item.nameVi : item.nameEn;
}

function vipDays(seconds: number | null): number | null {
  if (!seconds || seconds <= 0) return null;
  return Math.max(1, Math.round(seconds / 86_400));
}

function creditValidityDays(item: PackageVersion): number | null {
  const seconds = item.benefitSnapshot.credits ? item.benefitSnapshot.credits.expiresInSeconds : null;
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

function sortPackagesForPresentation(items: PackageVersion[]): PackageVersion[] {
  const order = new Map([[1, 0], [5, 1], [10, 2], [20, 3]]);
  return [...items].sort((left, right) => {
    const leftOrder = order.get(left.creditUnits) ?? 99;
    const rightOrder = order.get(right.creditUnits) ?? 99;
    return leftOrder - rightOrder || left.creditUnits - right.creditUnits || left.id.localeCompare(right.id);
  });
}

function packageDescriptorKey(item: PackageVersion): string {
  if (item.creditUnits === 1) return "member.packageExperience";
  if (item.creditUnits === 5) return "member.packageStarter";
  if (item.creditUnits === 10) return "member.packagePopular";
  if (item.creditUnits === 20) return "member.packageBestValue";
  return "member.packageEyebrow";
}

function isPopularPackage(item: PackageVersion): boolean {
  if (typeof item.benefitSnapshot.catalog?.popular === "boolean") return item.benefitSnapshot.catalog.popular;
  return /popular|phổ biến/i.test(`${item.nameEn} ${item.nameVi}`) || item.creditUnits === 10;
}

function MembershipBalance({ summary, accountLoading, authenticated, t }: { summary: AccountSummary | null; accountLoading: boolean; authenticated: boolean; t: Translate }) {
  return (
    <section className="membership-balance" aria-labelledby="membership-balance-title">
      <div className="membership-balance-icon"><WalletCards size={24} strokeWidth={1.3} aria-hidden="true" /></div>
      <div className="membership-balance-copy">
        <span id="membership-balance-title">{t("member.balanceEyebrow")}</span>
        <strong>{accountLoading ? t("member.balanceLoading") : summary ? <>{summary.credits.balance.availableUnits} <small>{t("member.credits")}</small></> : t(authenticated ? "member.balanceUnavailable" : "member.balanceSignIn")}</strong>
      </div>
      <Link className="membership-balance-link" href={authenticated ? "/account" : "/auth?return_to=/packages"}>{t("member.openHistory")} <ArrowRight size={14} aria-hidden="true" /></Link>
    </section>
  );
}

function PackageCard({ item, locale, t }: { item: PackageVersion; locale: string; t: Translate }) {
  const days = creditValidityDays(item);
  const unitPrice = item.creditUnits > 0 ? moneyLabel(item.amountMinor / item.creditUnits, item.currency, locale, 2) : null;
  const popular = isPopularPackage(item);
  return (
    <article className={`membership-package-card${popular ? " is-popular" : ""}`} aria-label={packageName(item, locale)}>
      {popular && <span className="membership-package-badge">{t("member.popularBadge")}</span>}
      <div className="membership-package-heading"><div><span className="membership-package-label">{t(packageDescriptorKey(item))}</span><h2>{item.creditUnits}<span>{t(item.creditUnits === 1 ? "member.creditUnitLabelSingular" : "member.creditUnitLabel")}</span></h2></div><Sparkles size={20} strokeWidth={1.2} aria-hidden="true" /></div>
      <div className="membership-package-price"><strong>{moneyLabel(item.amountMinor, item.currency, locale)}</strong><span>{unitPrice ? t("member.unitPrice", { value: unitPrice }) : item.currency}</span></div>
      <div className="membership-benefits">
        <span><CreditCard size={16} strokeWidth={1.3} aria-hidden="true" />{t(item.creditUnits === 1 ? "member.readingCountSingular" : "member.readingCount", { value: item.creditUnits })}</span>
        {days ? <span><Moon size={16} strokeWidth={1.3} aria-hidden="true" />{t("member.validForCredits", { value: days })}</span> : <span><Moon size={16} strokeWidth={1.3} aria-hidden="true" />{t("member.validityUnavailable")}</span>}
        <span><Sparkles size={16} strokeWidth={1.3} aria-hidden="true" />{t("member.aiAccess")}</span>
      </div>
      <Link className="membership-package-cta" href={`/checkout?package=${encodeURIComponent(item.id)}`}>{t(item.creditUnits === 1 ? "member.chooseCreditPackageSingular" : "member.chooseCreditPackage", { value: item.creditUnits })} <ArrowRight size={15} aria-hidden="true" /></Link>
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

  const orderedPackages = sortPackagesForPresentation(packages);
  return (
    <div className="membership-page">
      <header className="membership-hero">
        <div className="membership-hero-motif" aria-hidden="true"><span>☾</span><i>✦</i><span>◐</span><b>✧</b><span>☽</span></div>
        <span className="membership-eyebrow">{t("member.eyebrow")}</span>
        <h1>{t("member.title")}</h1>
        <p>{t("member.intro")}</p>
      </header>
      <div className="membership-balance-row">
        <div className="membership-editorial membership-editorial-left">{t("member.editorialLeft")}</div>
        <MembershipBalance summary={summary} accountLoading={accountLoading} authenticated={authenticated} t={t} />
        <div className="membership-editorial membership-editorial-right">{t("member.editorialRight")}</div>
      </div>
      {loading && <p className="membership-status" role="status" aria-live="polite">{t("member.catalogLoading")}</p>}
      {!loading && messageKey && <p className="membership-status membership-status-error" role="status" aria-live="polite">{t(messageKey)}</p>}
      {!loading && !messageKey && orderedPackages.length === 0 && <section className="membership-empty" role="status"><PackageCheck size={26} aria-hidden="true" /><h2>{t("member.packageEmpty")}</h2><p>{t("member.packageEmptyText")}</p><Link className="membership-secondary-cta" href="/room">{t("member.backToTarot")} <ArrowRight size={15} aria-hidden="true" /></Link></section>}
      {!loading && !messageKey && orderedPackages.length > 0 && <>
        <section className="membership-packages" aria-label={t("member.packageEyebrow")}>
          <div className="membership-package-grid">{orderedPackages.map((item) => <PackageCard key={item.id} item={item} locale={locale} t={t} />)}</div>
        </section>
        <section className="membership-journey" aria-labelledby="journey-title">
          <div className="membership-section-heading"><div><span className="membership-eyebrow">{t("member.journeyEyebrow")}</span><h2 id="journey-title">{t("member.journeyTitle")}</h2><p>{t("member.journeyIntro")}</p></div><Sparkles size={21} strokeWidth={1.2} aria-hidden="true" /></div>
          <div className="membership-journey-grid">{["question", "draw", "reading"].map((step, index) => <div className="membership-journey-step" key={step}><div className="membership-journey-icon">{index === 0 ? "?" : index === 1 ? <CreditCard size={22} strokeWidth={1.2} aria-hidden="true" /> : <Moon size={22} strokeWidth={1.2} aria-hidden="true" />}</div><div><span>0{index + 1}</span><h3>{t(`member.journey.${step}.title`)}</h3><p>{t(`member.journey.${step}.text`)}</p></div>{index < 2 && <ArrowRight className="membership-journey-arrow" size={17} strokeWidth={1.1} aria-hidden="true" />}</div>)}</div>
        </section>
        <div className="membership-support-grid">
          <section className="membership-support-panel membership-vip" aria-label={t("member.vipCatalogPending")} aria-labelledby="vip-title"><div className="membership-support-icon"><Crown size={22} strokeWidth={1.2} aria-hidden="true" /></div><div><span className="membership-eyebrow">{t("member.vipEyebrow")}</span><h2 id="vip-title">{t("member.vipTitle")}</h2><p>{t("member.vipText")}</p></div><span className="membership-coming-soon">{t("member.vipComingSoon")}</span></section>
          <section className="membership-support-panel membership-affiliate" aria-labelledby="affiliate-title"><div className="membership-support-icon"><Share2 size={22} strokeWidth={1.2} aria-hidden="true" /></div><div><span className="membership-eyebrow">{t("member.affiliateEyebrow")}</span><h2 id="affiliate-title">{t("member.affiliateTitle")}</h2><p>{t("member.affiliateText")}</p></div><Link className="membership-secondary-cta" href="/affiliate">{t("member.exploreAffiliate")} <ArrowRight size={15} aria-hidden="true" /></Link></section>
        </div>
        <section className="membership-trust" aria-label={t("member.trustLabel")}><span><ShieldCheck size={17} strokeWidth={1.3} aria-hidden="true" />{t("member.trustSafe")}</span><span><CreditCard size={17} strokeWidth={1.3} aria-hidden="true" />{t("member.trustFulfillment")}</span><span><History size={17} strokeWidth={1.3} aria-hidden="true" />{t("member.trustHistory")}</span></section>
      </>}
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
