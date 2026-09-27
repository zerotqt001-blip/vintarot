"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, ChevronDown, RefreshCw, Search, ShieldCheck, Users, WalletCards } from "lucide-react";
import styles from "./user-directory.module.css";

type Role = "USER" | "SUPPORT" | "FINANCE" | "CONTENT_ADMIN" | "ADMIN" | "SUPER_ADMIN";
type DirectoryUser = {
  id: string;
  username: string;
  emailMasked: string;
  phoneMasked: string;
  role: Role;
  disabled: boolean;
  createdAt: number;
  credits: { availableUnits: number; reservedUnits: number; totalUnits: number };
};
type RoleFilter = "ALL" | Role;
type StatusFilter = "all" | "active" | "disabled";
type Direction = "add" | "deduct";

const roles: RoleFilter[] = ["ALL", "USER", "SUPPORT", "FINANCE", "CONTENT_ADMIN", "ADMIN", "SUPER_ADMIN"];

function numberLabel(value: number): string {
  return new Intl.NumberFormat().format(value);
}

function dateLabel(value: number): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(value));
}

export default function UserDirectory() {
  const [users, setUsers] = useState<DirectoryUser[]>([]);
  const [total, setTotal] = useState(0);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [role, setRole] = useState<RoleFilter>("ALL");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [cursor, setCursor] = useState<string | null>(null);
  const [cursorHistory, setCursorHistory] = useState<Array<string | null>>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [pageIndex, setPageIndex] = useState(0);
  const [selectedId, setSelectedId] = useState("");
  const [direction, setDirection] = useState<Direction>("add");
  const [units, setUnits] = useState("1");
  const [reason, setReason] = useState("");
  const [loadedRequestKey, setLoadedRequestKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const params = new URLSearchParams({ limit: "20", role, status });
  if (search) params.set("q", search);
  if (cursor) params.set("cursor", cursor);
  const queryString = params.toString();
  const requestKey = `${queryString}:${revision}`;
  const loading = loadedRequestKey !== requestKey;

  useEffect(() => {
    const controller = new AbortController();
    void fetch(`/api/admin/user-directory?${queryString}`, { credentials: "same-origin", cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const data = await response.json().catch(() => ({})) as { error?: string; items?: DirectoryUser[]; total?: number; nextCursor?: string | null };
        if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : "Could not load the user directory.");
        setError("");
        setUsers(Array.isArray(data.items) ? data.items : []);
        setTotal(Number(data.total ?? 0));
        setNextCursor(typeof data.nextCursor === "string" ? data.nextCursor : null);
        setLoadedRequestKey(requestKey);
      })
      .catch((cause: unknown) => {
        if (cause instanceof Error && cause.name === "AbortError") return;
        setError(cause instanceof Error ? cause.message : "Could not load the user directory.");
        setLoadedRequestKey(requestKey);
      })
    return () => controller.abort();
  }, [queryString, requestKey]);

  const selected = users.find((user) => user.id === selectedId) ?? null;
  const amount = Number(units);
  const validAmount = Number.isSafeInteger(amount) && amount > 0 && amount <= 1_000_000;
  const canDeduct = Boolean(selected && validAmount && amount <= selected.credits.availableUnits);
  const canApply = Boolean(selected && validAmount && reason.trim() && (direction === "add" || canDeduct) && !busy);
  const changeFilters = (nextRole: RoleFilter, nextStatus: StatusFilter) => {
    setRole(nextRole);
    setStatus(nextStatus);
    setCursor(null);
    setCursorHistory([]);
    setPageIndex(0);
    setSelectedId("");
  };

  async function applyAdjustment() {
    if (!selected || !canApply) return;
    setBusy(true);
    setMessage("");
    setError("");
    try {
      const response = await fetch("/api/admin/credits", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          member_id: selected.id,
          units: direction === "add" ? amount : -amount,
          reason: reason.trim(),
          idempotency_key: `super-admin-directory:${crypto.randomUUID()}`,
        }),
      });
      const result = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(typeof result.error === "string" ? result.error : "Could not update Credits.");
      setMessage(`${direction === "add" ? "Added" : "Deducted"} ${numberLabel(amount)} Credits for ${selected.username}.`);
      setUnits("1");
      setReason("");
      setRevision((value) => value + 1);
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : "Could not update Credits.");
    } finally {
      setBusy(false);
    }
  }

  const firstVisible = total === 0 ? 0 : pageIndex * 20 + 1;
  const lastVisible = Math.min(pageIndex * 20 + users.length, total);
  const projectedAvailable = selected && validAmount ? selected.credits.availableUnits + (direction === "add" ? amount : -amount) : selected?.credits.availableUnits ?? 0;
  const projectedTotal = selected && validAmount ? selected.credits.totalUnits + (direction === "add" ? amount : -amount) : selected?.credits.totalUnits ?? 0;

  return (
    <main className={styles.page}>
      <div className={styles.breadcrumbs}><Link href="/admin">Admin console</Link><span>/</span><span aria-current="page">User management</span><span className={styles.superAdminBadge}><ShieldCheck size={14} aria-hidden="true" /> SUPER_ADMIN</span></div>
      <header className={styles.header}>
        <div><span className={styles.eyebrow}>BUSINESS CONTROL CENTER</span><h1>User directory</h1><p>Search every account, review live Credit balances, and apply an audited adjustment.</p></div>
        <div className={styles.headerCount}><Users size={18} aria-hidden="true" /><strong>{numberLabel(total)}</strong><span>matching users</span></div>
      </header>

      <section className={styles.directoryCard} aria-label="User directory">
        <div className={styles.toolbar}>
          <form className={styles.searchForm} onSubmit={(event) => { event.preventDefault(); setSearch(searchInput.trim()); setCursor(null); setCursorHistory([]); setPageIndex(0); setSelectedId(""); }}>
            <label className={styles.searchBox}><Search size={17} aria-hidden="true" /><span className={styles.srOnly}>Search users</span><input value={searchInput} maxLength={120} onChange={(event) => setSearchInput(event.target.value)} placeholder="Search name, email, phone, or ID" /></label>
            <button className={styles.searchButton} type="submit">Search</button>
          </form>
          <div className={styles.filters}>
            <label>Role<select value={role} onChange={(event) => changeFilters(event.target.value as RoleFilter, status)}>{roles.map((value) => <option key={value} value={value}>{value === "ALL" ? "All roles" : value}</option>)}</select></label>
            <label>Status<select value={status} onChange={(event) => changeFilters(role, event.target.value as StatusFilter)}><option value="all">All status</option><option value="active">Active</option><option value="disabled">Disabled</option></select></label>
            <button className={styles.refreshButton} type="button" aria-label="Refresh user directory" onClick={() => setRevision((value) => value + 1)}><RefreshCw size={15} aria-hidden="true" />Refresh</button>
          </div>
        </div>

        {(message || error) && !loading && <p className={`${styles.notice} ${error ? styles.noticeError : styles.noticeSuccess}`} role="status" aria-live="polite">{error || message}</p>}

        <div className={styles.tableWrap}>
          <table>
            <thead><tr><th>User</th><th>Role</th><th>Status</th><th>Credit balance</th><th>Joined</th><th><span className={styles.srOnly}>Actions</span></th></tr></thead>
            <tbody>
              {loading && <tr><td className={styles.tableMessage} colSpan={6}>Loading user accounts…</td></tr>}
              {!loading && error && <tr><td className={styles.tableMessage} colSpan={6}>The directory could not be loaded. Refresh to try again.</td></tr>}
              {!loading && !error && users.length === 0 && <tr><td className={styles.tableMessage} colSpan={6}>No users match these filters.</td></tr>}
              {!loading && !error && users.map((user) => {
                const isOpen = selectedId === user.id;
                return <tr className={isOpen ? styles.selectedRow : undefined} key={user.id}>
                  <td><div className={styles.identity}><span className={styles.avatar}>{user.username.slice(0, 1).toUpperCase()}</span><span><strong>{user.username}</strong><small>{user.emailMasked} · {user.id}</small></span></div></td>
                  <td><span className={styles.roleTag}>{user.role}</span></td>
                  <td><span className={`${styles.status} ${user.disabled ? styles.statusDisabled : styles.statusActive}`}><i />{user.disabled ? "Disabled" : "Active"}</span></td>
                  <td><div className={styles.balance}><strong>{numberLabel(user.credits.totalUnits)}</strong><small>{numberLabel(user.credits.availableUnits)} available · {numberLabel(user.credits.reservedUnits)} reserved</small></div></td>
                  <td>{dateLabel(user.createdAt)}</td>
                  <td><button className={`${styles.manageButton} ${isOpen ? styles.manageButtonOpen : ""}`} type="button" aria-expanded={isOpen} onClick={() => { setSelectedId(isOpen ? "" : user.id); setDirection("add"); setUnits("1"); setReason(""); setError(""); }}><WalletCards size={15} aria-hidden="true" />{isOpen ? "Close" : "Adjust"}<ChevronDown size={14} aria-hidden="true" /></button></td>
                </tr>;
              })}
            </tbody>
          </table>
        </div>

        {selected && !loading && <section className={styles.adjustment} aria-labelledby="credit-adjust-title">
          <div className={styles.adjustmentHeading}><div><span className={styles.eyebrow}>CREDIT ADJUSTMENT</span><h2 id="credit-adjust-title">{selected.username}</h2><p>{selected.emailMasked} · {numberLabel(selected.credits.totalUnits)} total Credits</p></div><div className={styles.directionSwitch} role="group" aria-label="Adjustment type"><button className={direction === "add" ? styles.directionActive : ""} type="button" onClick={() => setDirection("add")}><ArrowUp size={15} aria-hidden="true" />Add</button><button className={direction === "deduct" ? styles.directionActive : ""} type="button" onClick={() => setDirection("deduct")}><ArrowDown size={15} aria-hidden="true" />Deduct</button></div></div>
          <div className={styles.adjustmentGrid}>
            <label>Amount<input type="number" min="1" max="1000000" step="1" value={units} onChange={(event) => setUnits(event.target.value)} inputMode="numeric" /></label>
            <label className={styles.reasonField}>Reason<input value={reason} maxLength={500} onChange={(event) => setReason(event.target.value)} placeholder="Required for the audit record" /></label>
            <div className={styles.balancePreview}><span>New available balance</span><strong>{numberLabel(Math.max(0, projectedAvailable))}</strong><small>Total after change: {numberLabel(Math.max(0, projectedTotal))}</small></div>
          </div>
          {direction === "deduct" && validAmount && amount > selected.credits.availableUnits && <p className={styles.validation}>You can deduct up to {numberLabel(selected.credits.availableUnits)} available Credits.</p>}
          <div className={styles.adjustmentFooter}><small>Every adjustment is recorded in the Credit ledger with your reason.</small><button type="button" disabled={!canApply} onClick={() => void applyAdjustment()}>{busy ? "Applying…" : `${direction === "add" ? "Add" : "Deduct"} Credits`}</button></div>
        </section>}

        <footer className={styles.pagination}><span>{loading ? "Loading…" : `Showing ${firstVisible}–${lastVisible} of ${numberLabel(total)} users`}</span><div><button type="button" aria-label="Previous page" disabled={pageIndex === 0 || loading} onClick={() => { const previous = cursorHistory.at(-1) ?? null; setCursor(previous); setCursorHistory((history) => history.slice(0, -1)); setPageIndex((value) => Math.max(0, value - 1)); setSelectedId(""); }}><ArrowLeft size={15} aria-hidden="true" />Previous</button><button type="button" disabled={!nextCursor || loading} onClick={() => { if (!nextCursor) return; setCursorHistory((history) => [...history, cursor]); setCursor(nextCursor); setPageIndex((value) => value + 1); setSelectedId(""); }}>Next<ArrowRight size={15} aria-hidden="true" /></button></div></footer>
      </section>
      <p className={styles.securityNote}><ShieldCheck size={15} aria-hidden="true" /> User directory and Credit adjustments are restricted to the active SUPER_ADMIN account.</p>
    </main>
  );
}
