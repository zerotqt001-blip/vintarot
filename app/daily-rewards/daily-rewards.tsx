"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Clock3, Gift, RefreshCw, Sparkles } from "lucide-react";
import { useLanguage } from "@/components/language";
import type { DailyRewardState } from "@/lib/marketing/campaigns";
import styles from "./daily-rewards.module.css";

type RewardItem = { campaign: NonNullable<DailyRewardState["campaign"]>; state: DailyRewardState };
type RewardListResponse = { rewards?: RewardItem[]; error?: string };

function statusCopyKey(status: DailyRewardState["status"]): string {
  switch (status) {
    case "eligible": return "marketing.statusEligible";
    case "already_claimed": return "marketing.statusClaimed";
    case "paused": return "marketing.statusPaused";
    case "scheduled": return "marketing.statusScheduled";
    case "ended": return "marketing.statusEnded";
    case "not_eligible": return "marketing.statusNotEligible";
    case "per_user_limit": return "marketing.statusPerUser";
    case "budget_exhausted": return "marketing.statusBudget";
    default: return "marketing.statusUnavailable";
  }
}

function statusTone(status: DailyRewardState["status"]): string {
  return status === "eligible" ? styles.eligible : status === "already_claimed" ? styles.complete : status === "paused" || status === "scheduled" ? styles.waiting : styles.muted;
}

function dateLabel(timestamp: number, timeZone: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short", timeZone }).format(new Date(timestamp));
}

function expiryDuration(seconds: number | null, locale: string): string | null {
  if (seconds === null) return null;
  const days = seconds / 86_400;
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(days);
}

export default function DailyRewards({ authenticated }: { authenticated: boolean }) {
  const { t, locale } = useLanguage();
  const [rewards, setRewards] = useState<RewardItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);

  const load = useCallback(async (signal?: AbortSignal) => {
    try {
      const response = await fetch("/api/marketing/rewards", { credentials: "same-origin", cache: "no-store", signal });
      const data = await response.json().catch(() => ({})) as RewardListResponse;
      if (!response.ok) throw new Error(data.error || t("marketing.loadError"));
      setRewards(Array.isArray(data.rewards) ? data.rewards : []);
      setError("");
    } catch (cause) {
      if (cause instanceof Error && cause.name === "AbortError") return;
      setError(cause instanceof Error ? cause.message : t("marketing.loadError"));
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    if (!authenticated) return;
    const controller = new AbortController();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Fetch response state is applied asynchronously.
    void load(controller.signal);
    return () => controller.abort();
  }, [authenticated, load, revision]);

  async function claim(campaignId: string) {
    setBusyId(campaignId);
    setError("");
    try {
      const response = await fetch(`/api/marketing/rewards/${encodeURIComponent(campaignId)}`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const data = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(data.error || t("marketing.loadError"));
      setLoading(true);
      setRevision((value) => value + 1);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("marketing.loadError"));
    } finally {
      setBusyId("");
    }
  }

  return <main className={styles.page}>
    <header className={styles.header}>
      <span className={styles.moon} aria-hidden="true"><Gift size={24} strokeWidth={1.2} /><i>✦</i></span>
      <h1>{t("marketing.title")}</h1>
      <p>{t("marketing.intro")}</p>
    </header>

    {!authenticated ? <section className={styles.signIn} aria-labelledby="reward-signin-heading">
      <span><Sparkles size={19} strokeWidth={1.2} aria-hidden="true" /></span>
      <h2 id="reward-signin-heading">{t("marketing.signInTitle")}</h2>
      <p>{t("marketing.signInText")}</p>
      <div><Link className={styles.primaryLink} href="/auth?return_to=%2Fdaily-rewards">{t("marketing.signIn")}<ArrowRight size={16} /></Link><Link className={styles.secondaryLink} href="/auth?return_to=%2Fdaily-rewards&mode=register">{t("marketing.register")}</Link></div>
    </section> : <section className={styles.rewards} aria-label={t("marketing.title")} aria-busy={loading || Boolean(busyId)}>
      <div className={styles.sectionHeading}><div><span>{t("marketing.reward")}</span><h2>{rewards.length === 1 ? rewards[0]?.campaign.name : t("marketing.title")}</h2></div><button type="button" aria-label={t("marketing.retry")} disabled={loading} onClick={() => { setLoading(true); setRevision((value) => value + 1); }}><RefreshCw size={15} aria-hidden="true" /></button></div>
      {error && <p className={styles.error} role="alert">{error}<button type="button" onClick={() => { setLoading(true); setRevision((value) => value + 1); }}>{t("marketing.retry")}</button></p>}
      {loading && <p className={styles.loading} role="status"><RefreshCw size={16} aria-hidden="true" />{t("marketing.statusLoading")}</p>}
      {!loading && !error && rewards.length === 0 && <div className={styles.empty}><Gift size={25} aria-hidden="true" /><h3>{t("marketing.emptyTitle")}</h3><p>{t("marketing.emptyText")}</p></div>}
      {!loading && rewards.map(({ campaign, state }) => {
        const status = state.status;
        const validDays = expiryDuration(campaign.creditExpirationSeconds, locale === "vi" ? "vi-VN" : "en-US");
        return <article key={campaign.id} className={styles.reward}>
          <div className={styles.rewardMain}>
            <div className={styles.rewardMark}><Gift size={22} strokeWidth={1.25} aria-hidden="true" /></div>
            <div className={styles.rewardCopy}><span>{campaign.campaignType === "DAILY_REWARD" ? t("marketing.rewardNameDaily") : t("marketing.rewardNameCustom")}</span><h3>{campaign.name}</h3><p>{t("marketing.timeZone", { zone: campaign.timeZone })}</p></div>
            <div className={styles.amount}><strong>{campaign.rewardUnits}</strong><span>{campaign.rewardUnits === 1 ? "Credit" : "Credits"}</span></div>
          </div>
          <div className={styles.rewardStatus}>
            <p className={statusTone(status)} role="status">{t(statusCopyKey(status))}</p>
            {state.claim?.expiresAt !== null && state.claim?.expiresAt !== undefined
              ? <span className={styles.expiry}><Clock3 size={14} aria-hidden="true" />{t("marketing.expires", { date: dateLabel(state.claim.expiresAt, campaign.timeZone, locale === "vi" ? "vi-VN" : "en-US") })}</span>
              : validDays ? <span className={styles.expiry}><Clock3 size={14} aria-hidden="true" />{locale === "vi" ? `Hạn dùng ${validDays} ngày kể từ khi nhận` : `Valid for ${validDays} days after claiming`}</span>
                : <span className={styles.expiry}><Clock3 size={14} aria-hidden="true" />{t("marketing.noExpiry")}</span>}
            {state.nextClaimAt !== null && <span className={styles.nextClaim}>{t("marketing.nextClaim", { date: dateLabel(state.nextClaimAt, campaign.timeZone, locale === "vi" ? "vi-VN" : "en-US") })}</span>}
            {state.eligible && <button className={styles.claimButton} type="button" disabled={busyId === campaign.id} onClick={() => void claim(campaign.id)}>{busyId === campaign.id ? t("marketing.claiming") : t("marketing.claim")}<ArrowRight size={16} aria-hidden="true" /></button>}
            {status === "already_claimed" && <span className={styles.claimedTag}><Sparkles size={13} aria-hidden="true" />{t("marketing.claimed")}</span>}
          </div>
        </article>;
      })}
    </section>}
    <p className={styles.footer}><Link href="/account?activity=credits">{t("marketing.creditHistory")}<ArrowRight size={13} /></Link></p>
  </main>;
}
