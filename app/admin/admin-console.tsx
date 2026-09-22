"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Ban, BookOpen, Check, Eye, Receipt, RefreshCw, Search, Shield, Sparkles, UserRound, Users, WalletCards } from "lucide-react";

/* FUNCTIONAL UI — NOT FINAL DESIGN */
type UserRow = {
  id: string;
  username: string;
  emailMasked: string;
  phoneMasked: string;
  displayNameMasked: string | null;
  role: string;
  disabled: boolean;
  disabledReason: string | null;
  createdAt: number;
  updatedAt: number;
  lastLoginAt: number | null;
};

type Dashboard = {
  members: { total: number; active: number; disabled: number };
  readings: { saved: number };
  orders: { total: number; pending: number; fulfilled: number };
  vip: { active: number };
  credits: { adjustments: number };
  affiliate: { conversions: number };
  audit: { events: number };
};

type CreditHistoryRow = { id: string; eventType: string; units: number; reason: string; effectiveAt: number; createdAt: number };
type VipRow = { id: string; entitlementType: string; benefitVersion: string; sourceType: string; startsAt: number; endsAt: number | null; status: string };
type ReadingRow = { id: string; createdAt: number; updatedAt: number; sessionId: string | null };
type OrderRow = { id: string; memberId: string; status: string; amountMinor: number; currency: string; paymentReferenceMasked: string | null; createdAt: number; paymentConfirmedAt: number | null; fulfilledAt: number | null; refundedAt: number | null; fulfillmentId: string | null };
type AffiliateHistoryRow = { id: string; orderId: string; amountMinor: number; currency: string; commissionMinor: number; status: string; createdAt: number };
type AffiliateDetail = {
  profile: { id: string; status: string; codeStatuses: string[]; createdAt: number; updatedAt: number } | null;
  summary: { conversions: number; held: number; eligible: number; reversed: number; creditedMinor: number; debitedMinor: number; netMinor: number };
  history: AffiliateHistoryRow[];
};
type MemberDetail = {
  member: UserRow;
  credits: { balance: { availableUnits: number; reservedUnits: number; totalUnits: number }; history: CreditHistoryRow[] } | null;
  vip: VipRow[] | null;
  readingUsage: { total: number; saved: number; sessions: number } | null;
  readings: { items: ReadingRow[]; nextCursor: null };
  orders: OrderRow[] | null;
  affiliate: AffiliateDetail | null;
};
type SessionRow = { sessionId: string; createdAt: number; expiresAt: number; lastSeenAt: number; revokedAt: number | null };
type AffiliateModel = {
  profiles: Array<{ id: string; memberId: string; status: string; codeStatuses: string[] }>;
  conversions: Array<{ id: string; orderId: string; memberId: string; commissionMinor: number; currency: string; status: string }>;
  ledger: Array<{ id: string; conversionId: string; direction: string; amountMinor: number; currency: string; reason: string }>;
  policies: Array<{ id: string; version: number; status: string }>;
};
type AuditRow = { id: string; action: string; actorId: string; targetId: string | null; reason: string; createdAt: number };

async function readJson<T>(path: string): Promise<T> {
  const response = await fetch(path, { credentials: "same-origin", cache: "no-store" });
  const data = await response.json().catch(() => ({})) as { error?: string } & T;
  if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : "Could not load admin data.");
  return data;
}

async function postJson<T>(path: string, body: unknown, method: "POST" | "PATCH" = "POST"): Promise<T> {
  const response = await fetch(path, { method, credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await response.json().catch(() => ({})) as { error?: string } & T;
  if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : "Could not complete admin action.");
  return data;
}

function dateLabel(value: number | null | undefined): string {
  return value == null ? "—" : new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(value));
}

function moneyLabel(amount: number, currency: string): string {
  return new Intl.NumberFormat(undefined, { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);
}

function opaqueLabel(value: string): string {
  return value.length > 12 ? `${value.slice(0, 8)}…` : value;
}

export default function AdminConsole({ authenticated }: { authenticated: boolean }) {
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedMemberId, setSelectedMemberId] = useState("");
  const [detail, setDetail] = useState<MemberDetail | null>(null);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [affiliate, setAffiliate] = useState<AffiliateModel | null>(null);
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [reason, setReason] = useState("");
  const [idempotencyKey, setIdempotencyKey] = useState("");
  const [units, setUnits] = useState("1");
  const [role, setRole] = useState("SUPPORT");
  const [entitlementId, setEntitlementId] = useState("");
  const [affiliateProfileId, setAffiliateProfileId] = useState("");
  const [affiliateStatus, setAffiliateStatus] = useState("ACTIVE");
  const [conversionId, setConversionId] = useState("");
  const [commissionAmount, setCommissionAmount] = useState("0");
  const [sessionId, setSessionId] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const loadAll = useCallback(async (query = "", showBusy = true) => {
    if (!authenticated) return;
    if (showBusy) setBusy(true);
    setMessage("");
    try {
      const [dashboardResult, userResult, orderResult] = await Promise.all([
        readJson<{ dashboard: Dashboard }>("/api/admin/overview"),
        readJson<{ items: UserRow[] }>(`/api/admin/users?limit=50&q=${encodeURIComponent(query)}`),
        readJson<{ items: OrderRow[] }>("/api/admin/orders?limit=50"),
      ]);
      setDashboard(dashboardResult.dashboard);
      setUsers(userResult.items);
      setOrders(orderResult.items);
      setSelectedMemberId((current) => current && userResult.items.some((user) => user.id === current) ? current : userResult.items[0]?.id ?? "");

      const [affiliateResult, auditResult] = await Promise.all([
        readJson<AffiliateModel>("/api/admin/affiliate?limit=50").catch(() => null),
        readJson<{ items: AuditRow[] }>("/api/admin/audit?limit=50").catch(() => null),
      ]);
      if (affiliateResult) setAffiliate(affiliateResult);
      if (auditResult) setAudit(auditResult.items);
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Could not load admin data.");
    } finally {
      if (showBusy) setBusy(false);
    }
  }, [authenticated]);

  const loadMemberDetail = useCallback(async (memberId: string, showError = true) => {
    if (!memberId) {
      setDetail(null);
      setSessions([]);
      return;
    }
    try {
      const detailPath = `/api/admin/users/${encodeURIComponent(memberId)}`;
      const [result, readings] = await Promise.all([
        readJson<{ user: MemberDetail }>(detailPath),
        readJson<{ items: ReadingRow[]; nextCursor: null; usage: MemberDetail["readingUsage"] }>(`${detailPath}/readings?limit=20`).catch(() => null),
      ]);
      setDetail(readings ? { ...result.user, readingUsage: readings.usage, readings: { items: readings.items, nextCursor: readings.nextCursor } } : result.user);
    } catch (error: unknown) {
      if (showError) setMessage(error instanceof Error ? error.message : "Could not load user detail.");
    }
  }, []);

  const loadSessions = useCallback(async (memberId: string) => {
    if (!memberId) return;
    try {
      const result = await readJson<{ sessions: SessionRow[] }>(`/api/admin/users/${encodeURIComponent(memberId)}/sessions`);
      setSessions(result.sessions);
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Could not load sessions.");
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadAll(); }, 0);
    return () => window.clearTimeout(timer);
  }, [loadAll]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadMemberDetail(selectedMemberId); }, 0);
    return () => window.clearTimeout(timer);
  }, [loadMemberDetail, selectedMemberId]);

  function mutationFields() {
    if (!reason.trim() || !idempotencyKey.trim()) throw new Error("Enter a reason and a unique idempotency key first.");
    return { reason: reason.trim(), idempotency_key: idempotencyKey.trim() };
  }

  async function runMutation(action: () => Promise<void>) {
    setBusy(true);
    setMessage("");
    try {
      await action();
      setIdempotencyKey("");
      await loadAll(searchQuery, false);
      await loadMemberDetail(selectedMemberId, false);
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Could not complete admin action.");
    } finally {
      setBusy(false);
    }
  }

  if (!authenticated) {
    return <section className="empty functional-empty"><Shield size={34} aria-hidden="true" /><h1>Admin console</h1><p>Sign in with an authorized NaTarot staff account to use this surface.</p><Link className="button black" href="/auth?return_to=/admin">Sign in</Link></section>;
  }

  const selectedUser = detail?.member ?? users.find((user) => user.id === selectedMemberId);
  const summaryCards = dashboard ? [
    ["Members", dashboard.members.total, `${dashboard.members.active} active · ${dashboard.members.disabled} disabled`, Users],
    ["Saved readings", dashboard.readings.saved, "metadata count only", BookOpen],
    ["Orders", dashboard.orders.total, `${dashboard.orders.pending} pending · ${dashboard.orders.fulfilled} fulfilled`, Receipt],
    ["Active VIP", dashboard.vip.active, "current entitlements", Sparkles],
    ["Credit adjustments", dashboard.credits.adjustments, "ledger events", WalletCards],
    ["Audit events", dashboard.audit.events, "append-only records", Shield],
  ] as const : [];

  return (
    <div className="functional-page admin-functional-page">
      <header className="page-head functional-page-head"><h1>Admin control center</h1><p>Internal operations for users, Credits, VIP, orders, affiliate review, readings metadata and audit evidence.</p></header>
      <div className="functional-toolbar"><button className="button" type="button" onClick={() => void loadAll(searchQuery)} disabled={busy}><RefreshCw size={15} aria-hidden="true" />{busy ? "Working…" : "Refresh"}</button><span>Every financial or entitlement mutation requires a reason and idempotency key.</span></div>
      {message && <p className="functional-status functional-status--error" role="status" aria-live="polite">{message}</p>}

      <section className="functional-section" aria-labelledby="admin-dashboard-title">
        <div className="functional-section-heading"><div><h2 id="admin-dashboard-title">Dashboard</h2><p>Bounded operational counts from the authoritative backend.</p></div><RefreshCw size={20} aria-hidden="true" /></div>
        <div className="functional-action-grid">{summaryCards.map(([label, value, note, Icon]) => <div key={label}><Icon size={18} aria-hidden="true" /><h3>{label}</h3><strong>{value}</strong><small>{note}</small></div>)}</div>
      </section>

      <section className="functional-section" aria-labelledby="admin-users-title">
        <div className="functional-section-heading"><div><h2 id="admin-users-title">Users</h2><p>Searchable, masked account inventory. Select a user to inspect the detail read model.</p></div><UserRound size={20} aria-hidden="true" /></div>
        <form className="functional-controls" onSubmit={(event) => { event.preventDefault(); void loadAll(searchQuery); }}><label htmlFor="admin-user-search">Search users<input id="admin-user-search" value={searchQuery} maxLength={120} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Username, member ID or contact" /></label><button className="button" type="submit" disabled={busy}><Search size={15} aria-hidden="true" />Search</button></form>
        <div className="functional-table-wrap"><table><thead><tr><th>Username</th><th>Masked contact</th><th>Role</th><th>Status</th><th>Created</th><th /></tr></thead><tbody>{users.map((user) => <tr key={user.id} className={user.id === selectedMemberId ? "functional-row--selected" : undefined}><td>{user.username}<small>{user.id}</small></td><td>{user.emailMasked}<small>{user.phoneMasked}</small></td><td>{user.role}</td><td>{user.disabled ? "Disabled" : "Active"}</td><td>{dateLabel(user.createdAt)}</td><td><button className="text-button" type="button" onClick={() => setSelectedMemberId(user.id)}><Eye size={14} aria-hidden="true" />Open</button></td></tr>)}</tbody></table></div>
      </section>

      {selectedUser && <section className="functional-section" aria-labelledby="admin-user-detail-title">
        <div className="functional-section-heading"><div><h2 id="admin-user-detail-title">User detail</h2><p>{selectedUser.username} · {selectedUser.id} · account status is enforced server-side.</p></div><UserRound size={20} aria-hidden="true" /></div>
        <div className="functional-action-grid"><div><h3>Account</h3><p>{selectedUser.displayNameMasked ?? "No display name"}</p><small>{selectedUser.emailMasked} · {selectedUser.phoneMasked}</small></div><div><h3>Credits balance</h3><strong>{detail ? detail.credits ? detail.credits.balance.totalUnits : "Restricted" : "—"}</strong><small>{detail?.credits ? `${detail.credits.balance.availableUnits} available · ${detail.credits.balance.reservedUnits} reserved` : "Requires Credits permission"}</small></div><div><h3>VIP</h3><strong>{detail ? detail.vip ? `${detail.vip.filter((item) => item.status === "ACTIVE").length} active` : "Restricted" : "—"}</strong><small>{detail?.vip ? `${detail.vip.length} entitlement records` : "Requires VIP permission"}</small></div><div><h3>Reading usage</h3><strong>{detail?.readingUsage ? detail.readingUsage.total : "Restricted"}</strong><small>{detail?.readingUsage ? `${detail.readingUsage.saved} saved · ${detail.readingUsage.sessions} sessions` : "Requires readings permission"}</small></div></div>
        {detail && <div className="functional-action-grid">{detail.credits ? <div><h3>Credit ledger history</h3><div className="functional-table-wrap"><table><thead><tr><th>Event</th><th>Units</th><th>Reason</th><th>When</th></tr></thead><tbody>{detail.credits.history.slice(0, 8).map((entry) => <tr key={entry.id}><td>{entry.eventType}</td><td>{entry.units}</td><td>{entry.reason}</td><td>{dateLabel(entry.createdAt)}</td></tr>)}</tbody></table></div></div> : <div><h3>Credit ledger history</h3><p className="functional-status">Credit history is restricted for this staff role.</p></div>}{detail.vip ? <div><h3>VIP entitlements</h3><div className="functional-table-wrap"><table><thead><tr><th>Version</th><th>Status</th><th>Ends</th><th /></tr></thead><tbody>{detail.vip.slice(0, 8).map((item) => <tr key={item.id}><td>{item.benefitVersion}<small>{item.id}</small></td><td>{item.status}</td><td>{dateLabel(item.endsAt)}</td><td><button className="text-button" type="button" onClick={() => setEntitlementId(item.id)}>Use</button></td></tr>)}</tbody></table></div></div> : <div><h3>VIP entitlements</h3><p className="functional-status">VIP history is restricted for this staff role.</p></div>}</div>}
      </section>}

      {selectedUser && detail && <section className="functional-section" aria-labelledby="admin-readings-title">
        <div className="functional-section-heading"><div><h2 id="admin-readings-title">Readings metadata</h2><p>Authorized staff can inspect usage and record metadata without exposing private Tarot content.</p></div><BookOpen size={20} aria-hidden="true" /></div>
        {detail.readingUsage ? <div className="functional-table-wrap"><table><thead><tr><th>Record</th><th>Session</th><th>Created</th><th>Updated</th></tr></thead><tbody>{detail.readings.items.map((reading) => <tr key={reading.id}><td>{reading.id}</td><td>{reading.sessionId ? opaqueLabel(reading.sessionId) : "—"}</td><td>{dateLabel(reading.createdAt)}</td><td>{dateLabel(reading.updatedAt)}</td></tr>)}</tbody></table></div> : <p className="functional-status">Reading history is restricted for this staff role.</p>}
      </section>}

      <section className="functional-section" aria-labelledby="admin-orders-title">
        <div className="functional-section-heading"><div><h2 id="admin-orders-title">Orders / payments</h2><p>Operational order status and masked payment references from the canonical order model.</p></div><Receipt size={20} aria-hidden="true" /></div>
        <div className="functional-table-wrap"><table><thead><tr><th>Order</th><th>Member</th><th>Status</th><th>Amount</th><th>Payment ref</th><th>Fulfilled</th></tr></thead><tbody>{orders.map((order) => <tr key={order.id}><td>{order.id}</td><td>{order.memberId}</td><td>{order.status}</td><td>{moneyLabel(order.amountMinor, order.currency)}</td><td>{order.paymentReferenceMasked ?? "—"}</td><td>{dateLabel(order.fulfilledAt)}</td></tr>)}</tbody></table></div>
      </section>

      <section className="functional-section" aria-labelledby="admin-mutations-title">
        <div className="functional-section-heading"><div><h2 id="admin-mutations-title">Controlled actions</h2><p>Actions delegate to the canonical ledger, entitlement and auth services. The client never writes a balance.</p></div><Shield size={20} aria-hidden="true" /></div>
        <div className="functional-controls functional-controls--wide"><label>Reason<input value={reason} maxLength={500} onChange={(event) => setReason(event.target.value)} placeholder="Why is this action needed?" /></label><label>Idempotency key<input value={idempotencyKey} maxLength={200} onChange={(event) => setIdempotencyKey(event.target.value)} placeholder="One key per intended mutation" /></label></div>
        <div className="functional-action-grid">
          <div><h3>Account access</h3><label>Role<select value={role} onChange={(event) => setRole(event.target.value)}>{["USER", "SUPPORT", "FINANCE", "CONTENT_ADMIN", "ADMIN", "SUPER_ADMIN"].map((value) => <option key={value}>{value}</option>)}</select></label><div className="functional-inline-actions"><button className="button" type="button" disabled={!selectedUser || busy} onClick={() => void runMutation(async () => { await postJson(`/api/admin/users/${encodeURIComponent(selectedMemberId)}`, { action: "status", disabled: !selectedUser?.disabled, ...mutationFields() }, "PATCH"); })}>{selectedUser?.disabled ? <Check size={15} /> : <Ban size={15} />}{selectedUser?.disabled ? "Unlock" : "Lock"}</button><button className="button" type="button" disabled={!selectedUser || busy} onClick={() => void runMutation(async () => { await postJson(`/api/admin/users/${encodeURIComponent(selectedMemberId)}`, { action: "role", role, ...mutationFields() }, "PATCH"); })}>Set role</button></div></div>
          <div><h3>Credits</h3><label>Units<input type="number" min="-1000000" max="1000000" step="1" value={units} onChange={(event) => setUnits(event.target.value)} /></label><button className="button black" type="button" disabled={!selectedUser || busy} onClick={() => void runMutation(async () => { await postJson("/api/admin/credits", { member_id: selectedMemberId, units: Number(units), ...mutationFields() }); })}>Adjust Credits</button></div>
          <div><h3>VIP entitlement</h3><label>Entitlement ID for revoke<input value={entitlementId} onChange={(event) => setEntitlementId(event.target.value)} placeholder="Select one above or paste ID" /></label><div className="functional-inline-actions"><button className="button black" type="button" disabled={!selectedUser || busy} onClick={() => void runMutation(async () => { const startsAt = Date.now(); await postJson("/api/admin/vip", { action: "grant", member_id: selectedMemberId, benefit_version: "vip-admin-v1", starts_at: startsAt, ends_at: startsAt + 30 * 86_400_000, benefit_snapshot: { source: "admin-control-center-v1" }, ...mutationFields() }); })}><Sparkles size={15} />Grant 30 days</button><button className="button" type="button" disabled={!selectedUser || !entitlementId || busy} onClick={() => void runMutation(async () => { await postJson("/api/admin/vip", { action: "revoke", member_id: selectedMemberId, entitlement_id: entitlementId, ...mutationFields() }); })}>Revoke</button></div></div>
          <div><h3>Session</h3><button className="button" type="button" disabled={!selectedUser || busy} onClick={() => void loadSessions(selectedMemberId)}>Load sessions</button><label>Opaque session ID<input value={sessionId} onChange={(event) => setSessionId(event.target.value)} /></label><button className="button" type="button" disabled={!selectedUser || !sessionId || busy} onClick={() => void runMutation(async () => { await postJson(`/api/admin/users/${encodeURIComponent(selectedMemberId)}/sessions`, { session_id: sessionId, ...mutationFields() }); })}>Revoke session</button></div>
        </div>
        {sessions.length > 0 && <div className="functional-table-wrap"><table><thead><tr><th>Opaque session</th><th>Created</th><th>Last seen</th><th>Expires</th><th>Status</th><th /></tr></thead><tbody>{sessions.map((session) => <tr key={session.sessionId}><td>{opaqueLabel(session.sessionId)}</td><td>{dateLabel(session.createdAt)}</td><td>{dateLabel(session.lastSeenAt)}</td><td>{dateLabel(session.expiresAt)}</td><td>{session.revokedAt ? "Revoked" : "Active"}</td><td><button className="text-button" type="button" onClick={() => setSessionId(session.sessionId)}>Select</button></td></tr>)}</tbody></table></div>}
      </section>

      {detail && <section className="functional-section" aria-labelledby="admin-commerce-title">
        <div className="functional-section-heading"><div><h2 id="admin-commerce-title">Orders and affiliate</h2><p>Provider-neutral payment metadata is masked; fulfillment snapshots and private content stay out of this view.</p></div><Receipt size={20} aria-hidden="true" /></div>
        <div className="functional-action-grid"><div><h3>User orders</h3>{detail.orders ? <div className="functional-table-wrap"><table><thead><tr><th>Order</th><th>Status</th><th>Amount</th><th>Payment ref</th></tr></thead><tbody>{detail.orders.map((order) => <tr key={order.id}><td>{order.id}</td><td>{order.status}</td><td>{moneyLabel(order.amountMinor, order.currency)}</td><td>{order.paymentReferenceMasked ?? "—"}</td></tr>)}</tbody></table></div> : <p className="functional-status">Orders and payment state are restricted for this staff role.</p>}</div><div><h3>User affiliate state</h3>{detail.affiliate ? <><p>{detail.affiliate.profile ? `${detail.affiliate.profile.id} · ${detail.affiliate.profile.status}` : "No affiliate profile"}</p><small>{detail.affiliate.summary.conversions} conversions · {moneyLabel(detail.affiliate.summary.netMinor, "VND")} net commission</small><div className="functional-table-wrap"><table><thead><tr><th>Conversion</th><th>Status</th><th>Commission</th></tr></thead><tbody>{detail.affiliate.history.slice(0, 8).map((item) => <tr key={item.id}><td>{item.id}</td><td>{item.status}</td><td>{moneyLabel(item.commissionMinor, item.currency)}</td></tr>)}</tbody></table></div></> : <p className="functional-status">Affiliate state is restricted for this staff role.</p>}</div></div>
        <div className="functional-controls functional-controls--wide"><label>Affiliate profile<select value={affiliateProfileId} onChange={(event) => setAffiliateProfileId(event.target.value)}><option value="">Choose profile</option>{affiliate?.profiles.map((profile) => <option value={profile.id} key={profile.id}>{profile.memberId} · {profile.status}</option>)}</select></label><label>Status<select value={affiliateStatus} onChange={(event) => setAffiliateStatus(event.target.value)}><option>ACTIVE</option><option>INACTIVE</option><option>SUSPENDED</option></select></label><button className="button" type="button" disabled={!affiliateProfileId || busy} onClick={() => void runMutation(async () => { await postJson("/api/admin/affiliate", { action: "profile_status", profile_id: affiliateProfileId, status: affiliateStatus, ...mutationFields() }); })}>Update affiliate status</button></div>
        <div className="functional-controls functional-controls--wide"><label>Conversion ID<input value={conversionId} onChange={(event) => setConversionId(event.target.value)} /></label><label>Commission adjustment (minor units)<input type="number" min="0" value={commissionAmount} onChange={(event) => setCommissionAmount(event.target.value)} /></label><button className="button" type="button" disabled={!conversionId || busy} onClick={() => void runMutation(async () => { await postJson("/api/admin/affiliate", { action: "commission_adjust", conversion_id: conversionId, direction: "CREDIT", amount_minor: Number(commissionAmount), ...mutationFields() }); })}>Add commission</button></div>
        <div className="functional-table-wrap"><table><thead><tr><th>Global orders</th><th>Affiliate conversions</th><th>Audit events</th></tr></thead><tbody><tr><td>{orders.length} visible · {orders[0] ? moneyLabel(orders[0].amountMinor, orders[0].currency) : "—"}</td><td>{affiliate?.conversions.length ?? 0} visible · {affiliate?.policies.length ?? 0} policies</td><td>{audit.length} visible</td></tr></tbody></table></div>
      </section>}

      <section className="functional-section functional-section--compact" aria-label="Recent audit events"><h2>Recent audit events</h2><ul className="functional-audit-list">{audit.slice(0, 8).map((event) => <li key={event.id}><Check size={14} aria-hidden="true" /><span>{event.action} · {event.targetId || "system"}</span><small>{dateLabel(event.createdAt)} · {event.reason}</small></li>)}</ul></section>
    </div>
  );
}
