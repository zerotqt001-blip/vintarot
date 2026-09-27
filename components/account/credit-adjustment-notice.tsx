"use client";

import { useCallback, useEffect, useState } from "react";
import { Bell, X } from "lucide-react";
import { useLanguage } from "@/components/language";
import styles from "./credit-adjustment-notice.module.css";

type Notice = {
  adjustmentKey: string;
  units: number;
  reason: string;
  createdAt: number;
};

function parseNotice(value: unknown): Notice | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Record<string, unknown>;
  if (typeof candidate.adjustmentKey !== "string"
    || typeof candidate.units !== "number"
    || !Number.isSafeInteger(candidate.units)
    || candidate.units === 0
    || typeof candidate.reason !== "string"
    || typeof candidate.createdAt !== "number"
    || !Number.isSafeInteger(candidate.createdAt)) return null;
  return {
    adjustmentKey: candidate.adjustmentKey,
    units: candidate.units,
    reason: candidate.reason,
    createdAt: candidate.createdAt,
  };
}

export default function CreditAdjustmentNotice({ enabled }: { enabled: boolean }) {
  const { locale, t } = useLanguage();
  const [notice, setNotice] = useState<Notice | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const loadNextNotice = useCallback(async () => {
    if (!enabled) return null;
    try {
      const response = await fetch("/api/account/credit-adjustments", {
        credentials: "same-origin",
        cache: "no-store",
      });
      if (!response.ok) return null;
      const payload = await response.json() as { notification?: unknown };
      return parseNotice(payload.notification);
    } catch {
      return null;
    }
  }, [enabled]);

  useEffect(() => {
    let active = true;
    void loadNextNotice().then((next) => {
      if (active) setNotice(next);
    });
    return () => {
      active = false;
    };
  }, [loadNextNotice]);

  const acknowledge = async () => {
    if (!notice || busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/account/credit-adjustments", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adjustment_key: notice.adjustmentKey }),
      });
      if (!response.ok) throw new Error("Could not mark notice as read.");
      setNotice(null);
      void loadNextNotice().then(setNotice);
    } catch {
      setError(t("member.creditAdjustmentNoticeError"));
    } finally {
      setBusy(false);
    }
  };

  if (!enabled || !notice) return null;

  const units = Math.abs(notice.units);
  const unitLabel = locale === "en" && units !== 1 ? "Credits" : "Credit";
  const values = {
    units: new Intl.NumberFormat(locale === "vi" ? "vi-VN" : "en-US").format(units),
    unit: unitLabel,
  };

  return <aside className={styles.notice} role="status" aria-live="polite" aria-atomic="true" aria-label={t("member.creditAdjustmentNoticeTitle")}>
    <span className={styles.icon} aria-hidden="true"><Bell size={20} strokeWidth={1.7} /></span>
    <div className={styles.content}>
      <h2>{t("member.creditAdjustmentNoticeTitle")}</h2>
      <p className={styles.change}>{t(notice.units > 0 ? "member.creditAdjustmentAddedNotice" : "member.creditAdjustmentDeductedNotice", values)}</p>
      <p className={styles.reason}><strong>{t("member.creditAdjustmentReason")}</strong> {notice.reason}</p>
      {error && <p className={styles.error}>{error}</p>}
      <button className={styles.acknowledge} type="button" disabled={busy} onClick={() => void acknowledge()}>{t("member.creditAdjustmentNoticeDismiss")}</button>
    </div>
    <button className={styles.close} type="button" aria-label={t("member.creditAdjustmentNoticeDismiss")} disabled={busy} onClick={() => void acknowledge()}><X size={17} aria-hidden="true" /></button>
  </aside>;
}
