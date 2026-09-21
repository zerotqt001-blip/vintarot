"use client";

import { useEffect, useState } from "react";
import { ArrowUpRight, BookOpen, Clock3, CreditCard, Moon, Sparkles } from "lucide-react";

/* FUNCTIONAL UI — NOT FINAL DESIGN */
type Summary = {
  member: { displayName: string | null; username: string; email: string };
  credits: { balance: { availableUnits: number; reservedUnits: number; totalUnits: number } };
  vip: Array<{ id: string; entitlementType: string; benefitVersion: string; endsAt: number | null; status: string }>;
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
  const data = await response.json().catch(() => ({})) as { error?: string } & T;
  if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : "Could not load account history.");
  return data;
}

function dateLabel(value: number): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function moneyLabel(amount: number | null, currency: string | null): string {
  if (amount === null) return "—";
  return new Intl.NumberFormat(undefined, { style: "currency", currency: currency || "VND", maximumFractionDigits: 0 }).format(amount);
}

function itemLabel(item: HistoryItem): string {
  if (item.kind === "reading") return "Saved Tarot reading";
  if (item.kind === "share") return "Share link activity";
  if (item.kind === "order") return "Order activity";
  if (item.kind === "credit") return `Credits · ${item.status ?? "ledger entry"}`;
  return "Affiliate conversion";
}

function itemHref(item: HistoryItem): string | null {
  if (item.kind === "reading") return "/journal?tab=saved";
  if (item.kind === "share") return "/journal?tab=saved";
  if (item.kind === "order" || item.kind === "credit") return "/profile#credits-status";
  return null;
}

export default function AccountHistory({ authenticated }: { authenticated: boolean }) {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [kind, setKind] = useState("all");
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(authenticated);
  const [loadingMore, setLoadingMore] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!authenticated) return;
    let active = true;
    setLoading(true);
    setMessage("");
    const query = new URLSearchParams({ kind, limit: "20" });
    Promise.all([
      readJson<Summary>("/api/account/summary"),
      readJson<HistoryResponse>(`/api/account/history?${query.toString()}`),
    ]).then(([nextSummary, history]) => {
      if (!active) return;
      setSummary(nextSummary);
      setItems(history.items);
      setNextCursor(history.nextCursor);
    }).catch((error: unknown) => {
      if (active) setMessage(error instanceof Error ? error.message : "Could not load account history.");
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [authenticated, kind]);

  async function loadMore() {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    setMessage("");
    try {
      const query = new URLSearchParams({ kind, limit: "20", cursor: nextCursor });
      const history = await readJson<HistoryResponse>(`/api/account/history?${query.toString()}`);
      setItems((current) => [...current, ...history.items]);
      setNextCursor(history.nextCursor);
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Could not load more history.");
    } finally {
      setLoadingMore(false);
    }
  }

  if (!authenticated) {
    return (
      <section className="empty functional-empty">
        <Moon size={34} aria-hidden="true" />
        <h1>Your account history</h1>
        <p>Sign in to see your Tarot readings, shares, orders, Credits and affiliate activity.</p>
        <a className="button black" href="/auth?return_to=/account">Sign in</a>
      </section>
    );
  }

  return (
    <div className="functional-page">
      <header className="page-head functional-page-head">
        <h1>Account history</h1>
        <p>Metadata-first activity for {summary?.member.displayName || summary?.member.username || "your NaTarot account"}.</p>
      </header>
      {summary && (
        <section className="functional-summary" aria-label="Account summary">
          <div><CreditCard size={17} aria-hidden="true" /><strong>{summary.credits.balance.availableUnits}</strong><span>Credits available</span></div>
          <div><BookOpen size={17} aria-hidden="true" /><strong>{summary.counts.readings}</strong><span>Saved readings</span></div>
          <div><Sparkles size={17} aria-hidden="true" /><strong>{summary.affiliate.conversions}</strong><span>Affiliate conversions</span></div>
          <div><Clock3 size={17} aria-hidden="true" /><strong>{summary.vip.length}</strong><span>Active VIP grants</span></div>
        </section>
      )}
      <section className="functional-history" aria-labelledby="account-history-title">
        <div className="functional-section-heading">
          <div><h2 id="account-history-title">Activity</h2><p>Private Tarot payloads and auth secrets never appear here.</p></div>
          <label>Filter <select value={kind} onChange={(event) => setKind(event.target.value)}><option value="all">All activity</option><option value="readings">Readings</option><option value="shares">Shares</option><option value="orders">Orders</option><option value="credits">Credits</option><option value="affiliate">Affiliate</option></select></label>
        </div>
        {loading && <p className="functional-status" role="status" aria-live="polite">Loading account history…</p>}
        {!loading && message && <p className="functional-status functional-status--error" role="status" aria-live="polite">{message}</p>}
        {!loading && !message && items.length === 0 && <p className="functional-status" role="status">No activity in this view yet.</p>}
        {!loading && !message && items.length > 0 && (
          <div className="functional-history-list">
            {items.map((item) => {
              const href = itemHref(item);
              const content = <><span className="functional-history-kind">{itemLabel(item)}</span><strong>{item.status || item.reason || item.referenceId || "Account event"}</strong><small>{dateLabel(item.createdAt)}{item.units !== null ? ` · ${item.units} units` : ""}{item.amountMinor !== null ? ` · ${moneyLabel(item.amountMinor, item.currency)}` : ""}</small></>;
              return href ? <a className="functional-history-row" href={href} key={item.id}>{content}<ArrowUpRight size={16} aria-hidden="true" /></a> : <div className="functional-history-row" key={item.id}>{content}</div>;
            })}
          </div>
        )}
        {nextCursor && <button className="button functional-more" type="button" onClick={() => void loadMore()} disabled={loadingMore}>{loadingMore ? "Loading…" : "Load more"}</button>}
      </section>
    </div>
  );
}
