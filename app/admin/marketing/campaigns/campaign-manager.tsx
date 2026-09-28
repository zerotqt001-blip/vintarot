"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CalendarClock, Check, Clock3, Gift, History, LoaderCircle, Pause, Play, Plus, RefreshCw, Save, ShieldCheck, X } from "lucide-react";
import type { MarketingCampaignInput, MarketingCampaignRecord, MarketingCampaignHistoryEntry } from "@/lib/marketing/admin";
import styles from "./campaign-manager.module.css";

type CampaignListResponse = { campaigns?: MarketingCampaignRecord[]; error?: string };
type CampaignDetailResponse = { campaign?: MarketingCampaignRecord; history?: MarketingCampaignHistoryEntry[]; error?: string };
type CampaignForm = {
  campaignType: MarketingCampaignInput["campaignType"];
  name: string;
  rewardUnits: string;
  startAt: string;
  endAt: string;
  timeZone: string;
  eligibilityRule: MarketingCampaignInput["eligibilityRule"];
  claimFrequency: MarketingCampaignInput["claimFrequency"];
  expirationDays: string;
  totalBudgetUnits: string;
  perUserLimit: string;
};

const timeZones = ["Asia/Ho_Chi_Minh", "UTC", "America/Los_Angeles", "Europe/London"];

function wallDateTime(value: number | null, timeZone = "Asia/Ho_Chi_Minh"): string {
  if (value === null) return "";
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(value)).map((part) => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

function timeZoneOffsetAt(timestamp: number, timeZone: string): number {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(timestamp)).map((part) => [part.type, part.value]));
  const wallClockUtc = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour) % 24, Number(parts.minute), Number(parts.second));
  return wallClockUtc - Math.floor(timestamp / 1_000) * 1_000;
}

function timestampInZone(value: string, timeZone: string): number {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
  if (!match) return Number.NaN;
  const [, year, month, day, hour, minute] = match;
  const wallClockUtc = Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute));
  let estimate = wallClockUtc - timeZoneOffsetAt(wallClockUtc, timeZone);
  for (let attempt = 0; attempt < 3; attempt += 1) estimate = wallClockUtc - timeZoneOffsetAt(estimate, timeZone);
  return wallDateTime(estimate, timeZone) === value ? estimate : Number.NaN;
}

function emptyForm(): CampaignForm {
  return {
    campaignType: "DAILY_REWARD",
    name: "",
    rewardUnits: "1",
    startAt: wallDateTime(Date.now()),
    endAt: "",
    timeZone: "Asia/Ho_Chi_Minh",
    eligibilityRule: "ACTIVE_MEMBER",
    claimFrequency: "DAILY",
    expirationDays: "7",
    totalBudgetUnits: "10000",
    perUserLimit: "",
  };
}

function formFromCampaign(campaign: MarketingCampaignRecord): CampaignForm {
  return {
    campaignType: campaign.campaignType,
    name: campaign.name,
    rewardUnits: String(campaign.rewardUnits),
    startAt: wallDateTime(campaign.startAt, campaign.timeZone),
    endAt: wallDateTime(campaign.endAt, campaign.timeZone),
    timeZone: campaign.timeZone,
    eligibilityRule: campaign.eligibilityRule,
    claimFrequency: campaign.claimFrequency,
    expirationDays: campaign.creditExpirationSeconds === null ? "" : String(campaign.creditExpirationSeconds / 86400),
    totalBudgetUnits: campaign.totalBudgetUnits === null ? "" : String(campaign.totalBudgetUnits),
    perUserLimit: campaign.perUserLimit === null ? "" : String(campaign.perUserLimit),
  };
}

function numberOrNull(value: string): number | null {
  if (!value.trim()) return null;
  const number = Number(value);
  return Number.isSafeInteger(number) && number > 0 ? number : Number.NaN;
}

function campaignInput(form: CampaignForm): MarketingCampaignInput | null {
  let startAt = Number.NaN;
  let endAt: number | null = null;
  try {
    startAt = form.startAt ? timestampInZone(form.startAt, form.timeZone) : Number.NaN;
    endAt = form.endAt ? timestampInZone(form.endAt, form.timeZone) : null;
  } catch {
    return null;
  }
  const rewardUnits = Number(form.rewardUnits);
  const expirationDays = numberOrNull(form.expirationDays);
  const totalBudgetUnits = numberOrNull(form.totalBudgetUnits);
  const perUserLimit = numberOrNull(form.perUserLimit);
  if (!form.name.trim() || !Number.isFinite(startAt) || (form.endAt && (!Number.isFinite(endAt) || endAt! <= startAt))
    || !Number.isSafeInteger(rewardUnits) || rewardUnits <= 0
    || (expirationDays !== null && (!Number.isFinite(expirationDays) || expirationDays > 3650))
    || (totalBudgetUnits !== null && (!Number.isFinite(totalBudgetUnits) || totalBudgetUnits > 2_000_000_000))
    || (perUserLimit !== null && (!Number.isFinite(perUserLimit) || perUserLimit > 1_000_000))) return null;
  return {
    campaignType: form.campaignType,
    name: form.name.trim(),
    rewardUnits,
    startAt,
    endAt,
    timeZone: form.timeZone,
    eligibilityRule: form.eligibilityRule,
    claimFrequency: form.claimFrequency,
    creditExpirationSeconds: expirationDays === null ? null : expirationDays * 86400,
    totalBudgetUnits,
    perUserLimit,
  };
}

function dateLabel(value: number | null, timeZone?: string): string {
  if (value === null) return "No end date";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short", ...(timeZone ? { timeZone } : {}) }).format(new Date(value));
}

function campaignTypeLabel(value: MarketingCampaignRecord["campaignType"]): string {
  return value === "WELCOME_BONUS" ? "Welcome Bonus" : value === "DAILY_REWARD" ? "Daily Reward" : "Custom reward";
}

export default function CampaignManager() {
  const [campaigns, setCampaigns] = useState<MarketingCampaignRecord[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [history, setHistory] = useState<MarketingCampaignHistoryEntry[]>([]);
  const [formDraft, setFormDraft] = useState<CampaignForm | null>(null);
  const [createForm, setCreateForm] = useState<CampaignForm>(emptyForm);
  const [creating, setCreating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const retryKeys = useRef(new Map<string, string>());
  const selected = campaigns.find((campaign) => campaign.id === selectedId) ?? null;
  const form = formDraft ?? (creating ? createForm : selected ? formFromCampaign(selected) : createForm);
  const normalizedInput = campaignInput(form);

  function updateForm(update: (current: CampaignForm) => CampaignForm) {
    setFormDraft((current) => update(current ?? form));
  }

  const loadCampaigns = useCallback(async (signal?: AbortSignal) => {
    try {
      const response = await fetch("/api/admin/marketing/campaigns", { credentials: "same-origin", cache: "no-store", signal });
      const data = await response.json().catch(() => ({})) as CampaignListResponse;
      if (!response.ok) throw new Error(data.error || "Could not load campaigns.");
      const items = Array.isArray(data.campaigns) ? data.campaigns : [];
      setCampaigns(items);
      setSelectedId((current) => current && items.some((item) => item.id === current) ? current : items[0]?.id ?? "");
      setError("");
    } catch (cause) {
      if (cause instanceof Error && cause.name === "AbortError") return;
      setError(cause instanceof Error ? cause.message : "Could not load campaigns.");
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Fetch response state is applied asynchronously.
    void loadCampaigns(controller.signal);
    return () => controller.abort();
  }, [loadCampaigns, revision]);

  useEffect(() => {
    if (!selectedId || creating) {
      return;
    }
    const controller = new AbortController();
    void fetch(`/api/admin/marketing/campaigns/${encodeURIComponent(selectedId)}`, { credentials: "same-origin", cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const data = await response.json().catch(() => ({})) as CampaignDetailResponse;
        if (!response.ok) throw new Error(data.error || "Could not load campaign history.");
        setHistory(Array.isArray(data.history) ? data.history : []);
      })
      .catch((cause: unknown) => {
        if (cause instanceof Error && cause.name !== "AbortError") setError(cause.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setHistoryLoading(false);
      });
    return () => controller.abort();
  }, [selectedId, creating, revision]);

  async function mutate(path: string, method: "POST" | "PATCH", body: unknown, success: string) {
    const requestScope = `${method}:${path}:${JSON.stringify(body)}`;
    const key = retryKeys.current.get(requestScope) ?? crypto.randomUUID();
    retryKeys.current.set(requestScope, key);
    setBusy(true);
    setNotice("");
    setError("");
    try {
      const response = await fetch(path, {
        method,
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", "Idempotency-Key": key },
        body: JSON.stringify(body),
      });
      const data = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(data.error || "The campaign could not be saved.");
      retryKeys.current.delete(requestScope);
      setNotice(success);
      setCreating(false);
      setFormDraft(null);
      setHistoryLoading(true);
      setLoading(true);
      setRevision((value) => value + 1);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The campaign could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  async function saveCampaign(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!normalizedInput || busy) return;
    const path = creating ? "/api/admin/marketing/campaigns" : `/api/admin/marketing/campaigns/${encodeURIComponent(selected!.id)}`;
    await mutate(path, creating ? "POST" : "PATCH", normalizedInput, creating ? "Campaign created in paused state." : "Campaign settings saved.");
  }

  async function changeStatus(status: MarketingCampaignRecord["status"]) {
    if (!selected || busy) return;
    await mutate(`/api/admin/marketing/campaigns/${encodeURIComponent(selected.id)}`, "POST", { status }, `Campaign ${status.toLowerCase()}.`);
  }

  function startCreate() {
    const draft = emptyForm();
    setCreateForm(draft);
    setFormDraft(draft);
    setSelectedId("");
    setCreating(true);
    setHistory([]);
    setHistoryLoading(false);
    setNotice("");
    setError("");
  }

  function selectCampaign(id: string) {
    setCreating(false);
    setSelectedId(id);
    setFormDraft(null);
    setHistory([]);
    setHistoryLoading(true);
    setNotice("");
    setError("");
  }

  return <main className={styles.page}>
    <div className={styles.breadcrumbs}><Link href="/admin"><ArrowLeft size={14} aria-hidden="true" />Admin console</Link><span>/</span><span aria-current="page">Marketing campaigns</span><span className={styles.badge}><ShieldCheck size={14} aria-hidden="true" />SUPER_ADMIN</span></div>
    <header className={styles.header}>
      <div><h1>Campaigns</h1><p>Manage member rewards, delivery windows, budgets and campaign outcomes.</p></div>
      <button type="button" className={styles.primaryButton} onClick={startCreate}><Plus size={16} aria-hidden="true" />New campaign</button>
    </header>

    {(notice || error) && <p className={`${styles.notice} ${error ? styles.noticeError : styles.noticeSuccess}`} role="status" aria-live="polite">{error || notice}</p>}
    <div className={styles.workspace}>
      <section className={styles.listPanel} aria-label="Campaign list">
        <div className={styles.panelHeading}><div><h2>Campaigns</h2><p>{campaigns.length} configured</p></div><button type="button" className={styles.iconButton} onClick={() => { setLoading(true); setRevision((value) => value + 1); }} aria-label="Refresh campaigns"><RefreshCw size={15} /></button></div>
        {loading ? <div className={styles.loading}><LoaderCircle size={18} />Loading campaigns…</div> : campaigns.length === 0 ? <p className={styles.empty}>No campaigns configured.</p> : <div className={styles.campaignList}>
          {campaigns.map((campaign) => <button key={campaign.id} type="button" onClick={() => selectCampaign(campaign.id)} className={`${styles.campaignItem}${campaign.id === selectedId && !creating ? ` ${styles.selected}` : ""}`} aria-pressed={campaign.id === selectedId && !creating}>
            <span className={styles.campaignItemTop}><span className={`${styles.status} ${styles[`status${campaign.status}`]}`}>{campaign.status}</span><span className={styles.units}>{campaign.rewardUnits} cr</span></span>
            <strong>{campaign.name}</strong><small>{campaignTypeLabel(campaign.campaignType)} · {campaign.claimFrequency.toLowerCase()}</small>
          </button>)}
        </div>}
      </section>

      <section className={styles.editorPanel} aria-label={creating ? "Create campaign" : "Campaign details"}>
        {!selected && !creating ? <div className={styles.blank}><Gift size={30} /><h2>Select a campaign</h2><p>Choose a campaign to review its settings and results.</p></div> : <>
          <div className={styles.editorHeading}>
            <div><span className={styles.contextLabel}>{creating ? "New reward" : campaignTypeLabel(selected!.campaignType)}</span><h2>{creating ? "Create campaign" : selected!.name}</h2></div>
            {selected && <span className={`${styles.status} ${styles[`status${selected.status}`]}`}>{selected.status}</span>}
          </div>
          {selected && <div className={styles.metrics}>
            <div><span>Claims</span><strong>{selected.claimedRewards.toLocaleString()}</strong><small>{selected.eligibleMembers.toLocaleString()} currently eligible</small></div>
            <div><span>Credits redeemed</span><strong>{selected.redeemedPromotionalUnits.toLocaleString()}</strong><small>{selected.expiredPromotionalUnits.toLocaleString()} expired</small></div>
            <div><span>Returning members</span><strong>{selected.returningUsers.toLocaleString()}</strong><small>{selected.budgetUtilizationPercent === null ? "No total budget" : `${selected.budgetUtilizationPercent}% of budget used`}</small></div>
          </div>}
          <form className={styles.form} onSubmit={(event) => void saveCampaign(event)}>
            <div className={styles.formIntro}><CalendarClock size={16} aria-hidden="true" /><span>Configure when members can claim and how the campaign is funded.</span></div>
            <div className={styles.formGrid}>
              <label className={styles.wide}>Campaign name<input value={form.name} maxLength={120} required onChange={(event) => updateForm((current) => ({ ...current, name: event.target.value }))} /></label>
              <label>Campaign type<select value={form.campaignType} disabled={!creating} onChange={(event) => updateForm((current) => ({ ...current, campaignType: event.target.value as CampaignForm["campaignType"] }))}><option value="DAILY_REWARD">Daily Reward</option><option value="CUSTOM">Custom reward</option></select></label>
              <label>Reward Credits<input type="number" min="1" max="1000000" step="1" value={form.rewardUnits} required onChange={(event) => updateForm((current) => ({ ...current, rewardUnits: event.target.value }))} /></label>
              <label>Starts at<input type="datetime-local" value={form.startAt} required onChange={(event) => updateForm((current) => ({ ...current, startAt: event.target.value }))} /></label>
              <label>Ends at <span className={styles.optional}>(optional)</span><input type="datetime-local" value={form.endAt} onChange={(event) => updateForm((current) => ({ ...current, endAt: event.target.value }))} /></label>
              <label>Claim frequency<select value={form.claimFrequency} disabled={selected?.campaignType === "WELCOME_BONUS"} onChange={(event) => updateForm((current) => ({ ...current, claimFrequency: event.target.value as CampaignForm["claimFrequency"] }))}><option value="ONCE">One time</option><option value="DAILY">Daily</option><option value="WEEKLY">Weekly</option><option value="MONTHLY">Monthly</option></select></label>
              <label>Eligible members<select value={form.eligibilityRule} disabled={selected?.campaignType === "WELCOME_BONUS"} onChange={(event) => updateForm((current) => ({ ...current, eligibilityRule: event.target.value as CampaignForm["eligibilityRule"] }))}><option value="ACTIVE_MEMBER">Active verified members</option><option value="NEW_MEMBER">Members who joined during the campaign</option></select></label>
              <label>Campaign time zone<select value={form.timeZone} onChange={(event) => updateForm((current) => ({ ...current, timeZone: event.target.value }))}>{timeZones.map((zone) => <option value={zone} key={zone}>{zone}</option>)}</select></label>
              <label>Credit expiry <span className={styles.optional}>(days; blank = no expiry)</span><input type="number" min="1" max="3650" step="1" value={form.expirationDays} onChange={(event) => updateForm((current) => ({ ...current, expirationDays: event.target.value }))} /></label>
              <label>Total budget <span className={styles.optional}>(Credits; blank = unlimited)</span><input type="number" min="1" max="2000000000" step="1" value={form.totalBudgetUnits} onChange={(event) => updateForm((current) => ({ ...current, totalBudgetUnits: event.target.value }))} /></label>
              <label>Limit per member <span className={styles.optional}>(blank = no extra limit)</span><input type="number" min="1" max="1000000" step="1" value={form.perUserLimit} onChange={(event) => updateForm((current) => ({ ...current, perUserLimit: event.target.value }))} /></label>
            </div>
            {selected && <div className={styles.schedule}><Clock3 size={15} aria-hidden="true" /><span>{dateLabel(selected.startAt, selected.timeZone)} — {dateLabel(selected.endAt, selected.timeZone)} · {selected.timeZone}</span></div>}
            <div className={styles.formActions}>
              <button className={styles.primaryButton} type="submit" disabled={!normalizedInput || busy}><Save size={15} aria-hidden="true" />{busy ? "Saving…" : creating ? "Create paused campaign" : "Save changes"}</button>
              {creating ? <button className={styles.secondaryButton} type="button" disabled={busy} onClick={() => { setCreating(false); setFormDraft(null); }}><X size={15} aria-hidden="true" />Cancel</button> : <>
                {selected?.status === "PAUSED" && <button className={styles.secondaryButton} type="button" disabled={busy} onClick={() => void changeStatus("ACTIVE")}><Play size={15} aria-hidden="true" />Activate</button>}
                {selected?.status === "ACTIVE" && <button className={styles.secondaryButton} type="button" disabled={busy} onClick={() => void changeStatus("PAUSED")}><Pause size={15} aria-hidden="true" />Pause</button>}
                {selected && selected.status !== "ENDED" && <button className={styles.tertiaryButton} type="button" disabled={busy} onClick={() => void changeStatus("ENDED")}><Check size={15} aria-hidden="true" />End campaign</button>}
              </>}
            </div>
          </form>
          {!creating && selected && <section className={styles.history} aria-labelledby="campaign-history-heading">
            <div className={styles.panelHeading}><div><h3 id="campaign-history-heading"><History size={16} aria-hidden="true" />Change history</h3><p>Administrative changes with before/after values</p></div></div>
            {historyLoading ? <div className={styles.loading}><LoaderCircle size={16} />Loading history…</div> : history.length === 0 ? <p className={styles.empty}>No changes recorded.</p> : <ol>{history.map((entry) => <li key={entry.id}><div><strong>{entry.action.replace("marketing.campaign.", "").replaceAll("_", " ")}</strong><time dateTime={new Date(entry.createdAt).toISOString()}>{dateLabel(entry.createdAt)}</time></div><small>{entry.reason} · {entry.actorId}</small><code>{JSON.stringify({ before: entry.metadata.before ?? null, after: entry.metadata.after ?? null })}</code></li>)}</ol>}
          </section>}
        </>}
      </section>
    </div>
    <p className={styles.footerNote}>New campaigns are created paused. Existing campaigns keep their current settings until a Super Admin changes them.</p>
  </main>;
}
