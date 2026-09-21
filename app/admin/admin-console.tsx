"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Ban, Check, RefreshCw, Shield, Sparkles, UserRound } from "lucide-react";

/* FUNCTIONAL UI — NOT FINAL DESIGN */
type UserRow = { id: string; username: string; email: string; role: string; disabled: boolean; createdAt: number };
type SessionRow = { sessionId: string; createdAt: number; expiresAt: number; revokedAt: number | null };
type OrderRow = { id: string; ownerId: string; status: string; amountMinor: number; currency: string; paymentReference: string | null; createdAt: number; fulfilledAt: number | null };
type AffiliateModel = { profiles: Array<{ id: string; memberId: string; status: string; codeStatuses: string[] }>; conversions: Array<{ id: string; orderId: string; memberId: string; commissionMinor: number; currency: string; status: string }>; ledger: Array<{ id: string; conversionId: string; direction: string; amountMinor: number; currency: string; reason: string }>; policies: Array<{ id: string; version: number; status: string }> };
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

function dateLabel(value: number): string { return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(value)); }
function moneyLabel(amount: number, currency: string): string { return new Intl.NumberFormat(undefined, { style: "currency", currency, maximumFractionDigits: 0 }).format(amount); }

export default function AdminConsole({ authenticated }: { authenticated: boolean }) {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [affiliate, setAffiliate] = useState<AffiliateModel | null>(null);
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [selectedMemberId, setSelectedMemberId] = useState("");
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

  const loadAll = useCallback(async () => {
    if (!authenticated) return;
    await Promise.resolve();
    setBusy(true);
    setMessage("");
    try {
      const [userResult, orderResult, affiliateResult, auditResult] = await Promise.all([
        readJson<{ items: UserRow[] }>("/api/admin/users?limit=50"),
        readJson<{ items: OrderRow[] }>("/api/admin/orders?limit=50"),
        readJson<AffiliateModel>("/api/admin/affiliate?limit=50"),
        readJson<{ items: AuditRow[] }>("/api/admin/audit?limit=50"),
      ]);
      setUsers(userResult.items);
      setOrders(orderResult.items);
      setAffiliate(affiliateResult);
      setAudit(auditResult.items);
      setSelectedMemberId((current) => current || userResult.items[0]?.id || "");
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Could not load admin data.");
    } finally {
      setBusy(false);
    }
  }, [authenticated]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadAll(); }, 0);
    return () => window.clearTimeout(timer);
  }, [loadAll]);

  async function loadSessions(memberId = selectedMemberId) {
    if (!memberId) return;
    try {
      const result = await readJson<{ sessions: SessionRow[] }>(`/api/admin/users/${encodeURIComponent(memberId)}/sessions`);
      setSessions(result.sessions);
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Could not load sessions.");
    }
  }

  function mutationFields() {
    if (!reason.trim() || !idempotencyKey.trim()) throw new Error("Enter a reason and a unique idempotency key first.");
    return { reason: reason.trim(), idempotency_key: idempotencyKey.trim() };
  }

  const selectedUser = users.find((user) => user.id === selectedMemberId);

  async function runMutation(action: () => Promise<void>) {
    setBusy(true);
    setMessage("");
    try { await action(); await loadAll(); } catch (error: unknown) { setMessage(error instanceof Error ? error.message : "Could not complete admin action."); } finally { setBusy(false); }
  }

  if (!authenticated) {
    return <section className="empty functional-empty"><Shield size={34} aria-hidden="true" /><h1>Admin console</h1><p>Sign in with an authorized NaTarot staff account to use this surface.</p><Link className="button black" href="/auth?return_to=/admin">Sign in</Link></section>;
  }

  return (
    <div className="functional-page admin-functional-page">
      <header className="page-head functional-page-head"><h1>Admin console</h1><p>Operational controls for users, Credits, VIP, orders, affiliate review and audit metadata.</p></header>
      <div className="functional-toolbar"><button className="button" type="button" onClick={() => void loadAll()} disabled={busy}><RefreshCw size={15} aria-hidden="true" />{busy ? "Working…" : "Refresh"}</button><span>Every mutation requires a reason and idempotency key.</span></div>
      {message && <p className="functional-status functional-status--error" role="status" aria-live="polite">{message}</p>}
      <section className="functional-section" aria-labelledby="admin-users-title">
        <div className="functional-section-heading"><div><h2 id="admin-users-title">Users and sessions</h2><p>Server-side role checks determine what this account may do.</p></div><UserRound size={20} aria-hidden="true" /></div>
        <div className="functional-controls"><label>User<select value={selectedMemberId} onChange={(event) => setSelectedMemberId(event.target.value)}>{users.map((user) => <option value={user.id} key={user.id}>{user.username} · {user.role}</option>)}</select></label><button className="button" type="button" onClick={() => void loadSessions()} disabled={!selectedMemberId}>Load sessions</button></div>
        <div className="functional-table-wrap"><table><thead><tr><th>Username</th><th>Role</th><th>Status</th><th>Created</th></tr></thead><tbody>{users.map((user) => <tr key={user.id}><td>{user.username}<small>{user.email}</small></td><td>{user.role}</td><td>{user.disabled ? "Disabled" : "Active"}</td><td>{dateLabel(user.createdAt)}</td></tr>)}</tbody></table></div>
        {sessions.length > 0 && <div className="functional-table-wrap"><table><thead><tr><th>Session</th><th>Created</th><th>Expires</th><th>Action</th></tr></thead><tbody>{sessions.map((session) => <tr key={session.sessionId}><td>{session.sessionId}</td><td>{dateLabel(session.createdAt)}</td><td>{dateLabel(session.expiresAt)}</td><td><button className="text-button" type="button" onClick={() => setSessionId(session.sessionId)}>Select</button></td></tr>)}</tbody></table></div>}
      </section>
      <section className="functional-section" aria-labelledby="admin-mutations-title">
        <div className="functional-section-heading"><div><h2 id="admin-mutations-title">Controlled mutations</h2><p>Use explicit, reviewable inputs. The API ignores client-supplied roles and owners.</p></div><Shield size={20} aria-hidden="true" /></div>
        <div className="functional-controls functional-controls--wide"><label>Reason<input value={reason} maxLength={500} onChange={(event) => setReason(event.target.value)} placeholder="Why is this action needed?" /></label><label>Idempotency key<input value={idempotencyKey} maxLength={200} onChange={(event) => setIdempotencyKey(event.target.value)} placeholder="One key per intended mutation" /></label></div>
        <div className="functional-action-grid">
          <div><h3>Member access</h3><label>Role<select value={role} onChange={(event) => setRole(event.target.value)}>{["USER", "SUPPORT", "FINANCE", "CONTENT_ADMIN", "ADMIN", "SUPER_ADMIN"].map((value) => <option key={value}>{value}</option>)}</select></label><div className="functional-inline-actions"><button className="button" type="button" disabled={!selectedMemberId || busy} onClick={() => void runMutation(async () => { await postJson(`/api/admin/users/${encodeURIComponent(selectedMemberId)}`, { action: "status", disabled: !selectedUser?.disabled, ...mutationFields() }, "PATCH"); })}>{selectedUser?.disabled ? <Check size={15} /> : <Ban size={15} />}{selectedUser?.disabled ? "Enable" : "Disable"}</button><button className="button" type="button" disabled={!selectedMemberId || busy} onClick={() => void runMutation(async () => { await postJson(`/api/admin/users/${encodeURIComponent(selectedMemberId)}`, { action: "role", role, ...mutationFields() }, "PATCH"); })}>Set role</button></div></div>
          <div><h3>Credits</h3><label>Units<input type="number" value={units} onChange={(event) => setUnits(event.target.value)} /></label><button className="button black" type="button" disabled={!selectedMemberId || busy} onClick={() => void runMutation(async () => { await postJson("/api/admin/credits", { member_id: selectedMemberId, units: Number(units), ...mutationFields() }); })}>Adjust Credits</button></div>
          <div><h3>VIP</h3><label>Entitlement ID for revoke<input value={entitlementId} onChange={(event) => setEntitlementId(event.target.value)} /></label><div className="functional-inline-actions"><button className="button black" type="button" disabled={!selectedMemberId || busy} onClick={() => void runMutation(async () => { const startsAt = Date.now(); await postJson("/api/admin/vip", { action: "grant", member_id: selectedMemberId, benefit_version: "vip-admin-v1", starts_at: startsAt, ends_at: startsAt + 30 * 86_400_000, benefit_snapshot: { source: "admin-console" }, ...mutationFields() }); })}><Sparkles size={15} />Grant 30 days</button><button className="button" type="button" disabled={!selectedMemberId || !entitlementId || busy} onClick={() => void runMutation(async () => { await postJson("/api/admin/vip", { action: "revoke", member_id: selectedMemberId, entitlement_id: entitlementId, ...mutationFields() }); })}>Revoke</button></div></div>
          <div><h3>Session</h3><label>Opaque session ID<input value={sessionId} onChange={(event) => setSessionId(event.target.value)} /></label><button className="button" type="button" disabled={!selectedMemberId || !sessionId || busy} onClick={() => void runMutation(async () => { await postJson(`/api/admin/users/${encodeURIComponent(selectedMemberId)}/sessions`, { session_id: sessionId, ...mutationFields() }); })}>Revoke session</button></div>
        </div>
      </section>
      <section className="functional-section" aria-labelledby="admin-commerce-title">
        <div className="functional-section-heading"><div><h2 id="admin-commerce-title">Commerce and affiliate read models</h2><p>Provider-neutral metadata only; no Tarot payloads or raw referral codes are shown.</p></div><Sparkles size={20} aria-hidden="true" /></div>
        <div className="functional-controls functional-controls--wide"><label>Affiliate profile<select value={affiliateProfileId} onChange={(event) => setAffiliateProfileId(event.target.value)}><option value="">Choose profile</option>{affiliate?.profiles.map((profile) => <option value={profile.id} key={profile.id}>{profile.memberId} · {profile.status}</option>)}</select></label><label>Status<select value={affiliateStatus} onChange={(event) => setAffiliateStatus(event.target.value)}><option>ACTIVE</option><option>INACTIVE</option><option>SUSPENDED</option></select></label><button className="button" type="button" disabled={!affiliateProfileId || busy} onClick={() => void runMutation(async () => { await postJson("/api/admin/affiliate", { action: "profile_status", profile_id: affiliateProfileId, status: affiliateStatus, ...mutationFields() }); })}>Update affiliate status</button></div>
        <div className="functional-controls functional-controls--wide"><label>Conversion ID<input value={conversionId} onChange={(event) => setConversionId(event.target.value)} /></label><label>Commission adjustment (minor units)<input type="number" min="0" value={commissionAmount} onChange={(event) => setCommissionAmount(event.target.value)} /></label><button className="button" type="button" disabled={!conversionId || busy} onClick={() => void runMutation(async () => { await postJson("/api/admin/affiliate", { action: "commission_adjust", conversion_id: conversionId, direction: "CREDIT", amount_minor: Number(commissionAmount), ...mutationFields() }); })}>Add commission</button></div>
        <div className="functional-table-wrap"><table><thead><tr><th>Orders</th><th>Affiliate conversions</th><th>Audit events</th></tr></thead><tbody><tr><td>{orders.length} visible · {orders[0] ? moneyLabel(orders[0].amountMinor, orders[0].currency) : "—"}</td><td>{affiliate?.conversions.length ?? 0} visible · {affiliate?.policies.length ?? 0} policies</td><td>{audit.length} visible</td></tr></tbody></table></div>
      </section>
      <section className="functional-section functional-section--compact" aria-label="Recent audit events"><h2>Recent audit events</h2><ul className="functional-audit-list">{audit.slice(0, 8).map((event) => <li key={event.id}><Check size={14} aria-hidden="true" /><span>{event.action} · {event.targetId || "system"}</span><small>{dateLabel(event.createdAt)} · {event.reason}</small></li>)}</ul></section>
    </div>
  );
}
