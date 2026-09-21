"use client";

import Link from "next/link";
import { ArrowRight, CreditCard, ExternalLink, Moon, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useLanguage } from "@/components/language";

type PackageVersion = {
  id: string;
  packageId: string;
  slug: string;
  nameEn: string;
  nameVi: string;
  version: number;
  amountMinor: number;
  currency: string;
  creditUnits: number;
  vipDurationSeconds: number | null;
};

type CheckoutForm = {
  action: string;
  method: "POST";
  fields: Record<string, string>;
};

type CheckoutResult = {
  order: { id: string; status: string; amount_minor: number; currency: string; created_at: number };
  checkout: CheckoutForm;
};

type AccountSummary = {
  member: { displayName: string | null; username: string };
  affiliate: { conversions: number; held: number; eligible: number; reversed: number; creditedMinor: number; debitedMinor: number; netMinor: number };
};

type AffiliateHistoryItem = {
  id: string;
  kind: string;
  createdAt: number;
  referenceId: string | null;
  status: string | null;
  amountMinor: number | null;
  currency: string | null;
};

async function readJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, { ...init, credentials: "same-origin", cache: "no-store" });
  const data = await response.json().catch(() => ({})) as { error?: string } & T;
  if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : "Could not load this NaTarot surface.");
  return data;
}

function moneyLabel(amount: number, currency: string, locale: string): string {
  return new Intl.NumberFormat(locale === "vi" ? "vi-VN" : "en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);
}

function packageName(item: PackageVersion, locale: string): string {
  return locale === "vi" ? item.nameVi : item.nameEn;
}

function vipLabel(seconds: number | null): string {
  if (!seconds || seconds <= 0) return "No VIP entitlement";
  const days = Math.max(1, Math.round(seconds / 86_400));
  return `${days} day${days === 1 ? "" : "s"} VIP access`;
}

function createCheckoutIdempotencyKey(): string {
  const suffix = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now()}:${Math.random().toString(36).slice(2, 10)}`;
  return `checkout:${suffix}`;
}

function checkoutReturnPath(packageId?: string): string {
  return packageId ? `/checkout?package=${encodeURIComponent(packageId)}` : "/checkout";
}

function PackageCard({ item, locale }: { item: PackageVersion; locale: string }) {
  return (
    <article className="functional-section">
      <div className="functional-section-heading">
        <div>
          <h2>{packageName(item, locale)}</h2>
          <p>Version {item.version} · {item.slug}</p>
        </div>
        <Sparkles size={20} aria-hidden="true" />
      </div>
      <div className="functional-summary" aria-label={`${packageName(item, locale)} benefits`}>
        <div><CreditCard size={17} aria-hidden="true" /><strong>{item.creditUnits}</strong><span>Credits</span></div>
        <div><Moon size={17} aria-hidden="true" /><strong>{item.vipDurationSeconds ? "VIP" : "—"}</strong><span>{vipLabel(item.vipDurationSeconds)}</span></div>
      </div>
      <p className="functional-status">Server-priced total: <strong>{moneyLabel(item.amountMinor, item.currency, locale)}</strong></p>
      <Link className="button black" href={`/checkout?package=${encodeURIComponent(item.id)}`}>
        Continue to checkout <ArrowRight size={15} aria-hidden="true" />
      </Link>
    </article>
  );
}

export function PackagesPage() {
  const { locale } = useLanguage();
  const [packages, setPackages] = useState<PackageVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    void readJson<{ packages: PackageVersion[] }>("/api/packages")
      .then((result) => { if (active) setPackages(result.packages); })
      .catch((error: unknown) => { if (active) setMessage(error instanceof Error ? error.message : "Could not load packages."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  return (
    <div className="functional-page">
      <header className="page-head functional-page-head">
        <h1>Packages</h1>
        <p>Review the active server-defined benefits before opening the member checkout.</p>
      </header>
      <div className="functional-toolbar">
        <Link className="button" href="/account">Account history</Link>
        <Link className="button" href="/affiliate">Affiliate activity</Link>
      </div>
      {loading && <p className="functional-status" role="status" aria-live="polite">Loading active packages…</p>}
      {!loading && message && <p className="functional-status functional-status--error" role="status" aria-live="polite">{message}</p>}
      {!loading && !message && packages.length === 0 && <p className="functional-status" role="status">No active package versions are available.</p>}
      {!loading && !message && packages.length > 0 && <div className="functional-page">{packages.map((item) => <PackageCard key={item.id} item={item} locale={locale} />)}</div>}
    </div>
  );
}

export function CheckoutPage({ authenticated, packageId }: { authenticated: boolean; packageId?: string }) {
  const { locale } = useLanguage();
  const [packages, setPackages] = useState<PackageVersion[]>([]);
  const [selectedId, setSelectedId] = useState(packageId ?? "");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [order, setOrder] = useState<CheckoutResult["order"] | null>(null);
  const [checkout, setCheckout] = useState<CheckoutForm | null>(null);
  const [idempotencyKey, setIdempotencyKey] = useState(createCheckoutIdempotencyKey);

  useEffect(() => {
    if (!authenticated) return;
    let active = true;
    void readJson<{ packages: PackageVersion[] }>("/api/packages")
      .then((result) => {
        if (!active) return;
        setPackages(result.packages);
        if (!packageId && result.packages[0]) setSelectedId(result.packages[0].id);
      })
      .catch((error: unknown) => { if (active) setMessage(error instanceof Error ? error.message : "Could not load packages."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [authenticated, packageId]);

  const selected = useMemo(() => packages.find((item) => item.id === selectedId) ?? null, [packages, selectedId]);

  async function startCheckout(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    setBusy(true);
    setMessage("");
    setOrder(null);
    setCheckout(null);
    try {
      const result = await readJson<CheckoutResult>("/api/commercial/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ package_version_id: selected.id, idempotency_key: idempotencyKey, payment_method: "BANK_TRANSFER" }),
      });
      setOrder(result.order);
      setCheckout(result.checkout);
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Checkout could not be started.");
    } finally {
      setBusy(false);
    }
  }

  if (!authenticated) {
    return (
      <section className="empty functional-empty">
        <CreditCard size={34} aria-hidden="true" />
        <h1>Member checkout</h1>
        <p>Sign in before creating an owner-scoped order.</p>
        <Link className="button black" href={`/auth?return_to=${encodeURIComponent(checkoutReturnPath(packageId))}`}>Sign in</Link>
      </section>
    );
  }

  return (
    <div className="functional-page">
      <header className="page-head functional-page-head">
        <h1>Checkout</h1>
        <p>Prices, benefits, order ownership and payment fields come from the server.</p>
      </header>
      <div className="functional-toolbar"><Link className="button" href="/packages">Back to packages</Link><Link className="button" href="/account">Account history</Link></div>
      {loading && <p className="functional-status" role="status" aria-live="polite">Loading package choices…</p>}
      {!loading && message && <p className="functional-status functional-status--error" role="status" aria-live="polite">{message}</p>}
      {!loading && !message && packages.length === 0 && <p className="functional-status" role="status">No active package versions are available.</p>}
      {!loading && !message && packages.length > 0 && (
        <section className="functional-section" aria-labelledby="checkout-package-title">
          <div className="functional-section-heading"><div><h2 id="checkout-package-title">Choose a package</h2><p>The order is created once with an idempotency key; payment confirmation happens only through verified SePay evidence.</p></div><CreditCard size={20} aria-hidden="true" /></div>
          <form onSubmit={startCheckout}>
            <label>Package<select value={selectedId} onChange={(event) => { setSelectedId(event.target.value); setIdempotencyKey(createCheckoutIdempotencyKey()); setOrder(null); setCheckout(null); }}>{packages.map((item) => <option key={item.id} value={item.id}>{packageName(item, locale)} · {moneyLabel(item.amountMinor, item.currency, locale)}</option>)}</select></label>
            {selected && <p className="functional-status">{selected.creditUnits} Credits · {vipLabel(selected.vipDurationSeconds)}</p>}
            <button className="button black" type="submit" disabled={!selected || busy}>{busy ? "Preparing checkout…" : "Create Sandbox checkout"}</button>
          </form>
        </section>
      )}
      {order && <section className="functional-section" aria-labelledby="checkout-order-title"><div className="functional-section-heading"><div><h2 id="checkout-order-title">Order {order.status}</h2><p>{order.id} · {moneyLabel(order.amount_minor, order.currency, locale)}</p></div><Sparkles size={20} aria-hidden="true" /></div>{checkout ? <form action={checkout.action} method={checkout.method}><input type="hidden" name="natarot_order_id" value={order.id} />{Object.entries(checkout.fields).map(([name, value]) => <input key={name} type="hidden" name={name} value={value} />)}<button className="button black" type="submit">Continue to SePay Sandbox <ExternalLink size={15} aria-hidden="true" /></button></form> : <p className="functional-status">Payment service is not ready for this staging environment.</p>}</section>}
    </div>
  );
}

export function AffiliatePage({ authenticated }: { authenticated: boolean }) {
  const { locale } = useLanguage();
  const [summary, setSummary] = useState<AccountSummary | null>(null);
  const [items, setItems] = useState<AffiliateHistoryItem[]>([]);
  const [loading, setLoading] = useState(authenticated);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!authenticated) return;
    let active = true;
    void Promise.all([
      readJson<AccountSummary>("/api/account/summary"),
      readJson<{ items: AffiliateHistoryItem[] }>("/api/account/history?kind=affiliate"),
    ]).then(([nextSummary, history]) => {
      if (!active) return;
      setSummary(nextSummary);
      setItems(history.items);
    }).catch((error: unknown) => { if (active) setMessage(error instanceof Error ? error.message : "Could not load affiliate activity."); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [authenticated]);

  if (!authenticated) {
    return (
      <section className="empty functional-empty">
        <Sparkles size={34} aria-hidden="true" />
        <h1>Affiliate activity</h1>
        <p>Sign in to view owner-scoped attribution and commission metadata.</p>
        <Link className="button black" href="/auth?return_to=/affiliate">Sign in</Link>
      </section>
    );
  }

  const affiliate = summary?.affiliate;
  return (
    <div className="functional-page">
      <header className="page-head functional-page-head"><h1>Affiliate activity</h1><p>Only metadata for your own conversions is shown. Raw referral codes and private Tarot content stay out of this surface.</p></header>
      <div className="functional-toolbar"><Link className="button" href="/account">Account history</Link><Link className="button" href="/packages">Packages</Link></div>
      {loading && <p className="functional-status" role="status" aria-live="polite">Loading affiliate activity…</p>}
      {!loading && message && <p className="functional-status functional-status--error" role="status" aria-live="polite">{message}</p>}
      {!loading && !message && affiliate && <>
        <section className="functional-summary" aria-label="Affiliate summary">
          <div><Sparkles size={17} aria-hidden="true" /><strong>{affiliate.conversions}</strong><span>Conversions</span></div>
          <div><strong>{affiliate.held}</strong><span>Held</span></div>
          <div><strong>{affiliate.eligible}</strong><span>Eligible</span></div>
          <div><strong>{moneyLabel(affiliate.netMinor, "VND", locale)}</strong><span>Net commission</span></div>
        </section>
        <section className="functional-section" aria-labelledby="affiliate-history-title"><div className="functional-section-heading"><div><h2 id="affiliate-history-title">Conversion history</h2><p>Verified fulfillment and policy snapshots remain server-controlled.</p></div><Sparkles size={20} aria-hidden="true" /></div>{items.length === 0 ? <p className="functional-status">No affiliate conversions yet. Attribution is captured automatically when a valid referral link is opened.</p> : <div className="functional-history-list">{items.map((item) => <div className="functional-history-row" key={item.id}><span className="functional-history-kind">{item.kind}</span><strong>{item.status || "Conversion"}</strong><small>{new Intl.DateTimeFormat(locale === "vi" ? "vi-VN" : "en-US", { dateStyle: "medium" }).format(new Date(item.createdAt))}{item.amountMinor !== null ? ` · ${moneyLabel(item.amountMinor, item.currency || "VND", locale)}` : ""}</small></div>)}</div>}</section>
      </>}
    </div>
  );
}
