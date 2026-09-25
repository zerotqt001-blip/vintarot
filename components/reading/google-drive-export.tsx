"use client";

import QRCode from "qrcode";
import Image from "next/image";
import { useEffect, useState } from "react";
import { Check, Cloud, Copy, Download, HardDrive, LoaderCircle, QrCode, Unplug } from "lucide-react";
import type { ReadingImageFormat } from "@/lib/reading-image-export";
import type { ReadingTranslator } from "./reading-types";

type ConnectionStatus = "loading" | "connected" | "disconnected" | "auth-required" | "unavailable";
type ConnectionResponse = { connected?: boolean; email?: string | null; sign_in_required?: boolean; configured?: boolean };
type ExportResponse = { drive_url?: string; error?: string };

export function GoogleDriveExport({
  readingId,
  sessionId,
  isPreparing,
  t,
  prepareImage,
}: {
  readingId: string;
  sessionId: string;
  isPreparing: boolean;
  t: ReadingTranslator;
  prepareImage: (format: ReadingImageFormat) => Promise<Blob>;
}) {
  const [status, setStatus] = useState<ConnectionStatus>("loading");
  const [email, setEmail] = useState("");
  const [format, setFormat] = useState<ReadingImageFormat>("png");
  const [downloading, setDownloading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [downloadNotice, setDownloadNotice] = useState("");
  const [connectionNotice, setConnectionNotice] = useState("");
  const [driveUrl, setDriveUrl] = useState("");
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let active = true;
    void fetch("/api/google-drive/connection", { credentials: "same-origin", cache: "no-store" })
      .then(async (response) => {
        const body = await response.json() as ConnectionResponse;
        if (!active) return;
        if (response.status === 401 || body.sign_in_required) setStatus("auth-required");
        else if (!response.ok || body.configured === false) setStatus("unavailable");
        else if (body.connected) { setStatus("connected"); setEmail(body.email || ""); }
        else setStatus("disconnected");
      })
      .catch(() => { if (active) setStatus("unavailable"); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const result = new URLSearchParams(window.location.search).get("google_drive");
    if (result === "connected") setConnectionNotice(t("reading.driveConnectedNotice"));
    else if (result === "denied") setError(t("reading.driveConsentDenied"));
    else if (result === "failed") setError(t("reading.driveConnectError"));
  }, [t]);

  useEffect(() => {
    let active = true;
    if (!driveUrl) { setQrDataUrl(""); return; }
    void QRCode.toDataURL(driveUrl, { errorCorrectionLevel: "M", margin: 2, width: 196, color: { dark: "#10283b", light: "#f4ebdd" } })
      .then((value) => { if (active) setQrDataUrl(value); })
      .catch(() => { if (active) setQrDataUrl(""); });
    return () => { active = false; };
  }, [driveUrl]);

  function connectDrive() {
    if (status === "auth-required") {
      window.location.assign(`/auth?return_to=${encodeURIComponent("/room")}`);
      return;
    }
    window.location.assign(`/api/google-drive/connect?return_to=${encodeURIComponent("/room")}`);
  }

  async function downloadImage() {
    if (downloading || saving || isPreparing) return;
    setDownloading(true);
    setError("");
    setDownloadNotice("");
    try {
      const blob = await prepareImage(format);
      const downloadUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = `natarot-reading.${format}`;
      link.style.display = "none";
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 30_000);
      setDownloadNotice(t("reading.imageDownloadStarted"));
    } catch {
      setError(t("reading.saveImageUnavailable"));
    } finally {
      setDownloading(false);
    }
  }

  async function saveImageToDrive() {
    if (status !== "connected" || downloading || saving || isPreparing) return;
    setSaving(true);
    setError("");
    setDownloadNotice("");
    setCopied(false);
    try {
      const blob = await prepareImage(format);
      const form = new FormData();
      form.set("reading_id", readingId);
      form.set("session_id", sessionId);
      form.set("format", format);
      form.set("file", new File([blob], `natarot-reading.${format}`, { type: format === "png" ? "image/png" : "image/jpeg" }));
      const response = await fetch("/api/tarot/drive-exports", { method: "POST", credentials: "same-origin", body: form });
      const body = await response.json() as ExportResponse;
      if (response.status === 401) {
        setStatus("auth-required");
        setError(t("reading.driveAuthRequired"));
        return;
      }
      if (response.status === 409) {
        setStatus("disconnected");
        setError(t("reading.driveConnect"));
        return;
      }
      if (!response.ok || !body.drive_url) {
        setError(response.status === 413 ? t("reading.driveFileTooLarge") : t("reading.driveExportError"));
        return;
      }
      setDriveUrl(body.drive_url);
    } catch {
      setError(t("reading.driveExportError"));
    } finally {
      setSaving(false);
    }
  }

  async function copyLink() {
    if (!driveUrl) return;
    try {
      await navigator.clipboard.writeText(driveUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      setError(t("reading.driveCopyError"));
    }
  }

  async function disconnect() {
    if (saving) return;
    setError("");
    try {
      const response = await fetch("/api/google-drive/connection", { method: "DELETE", credentials: "same-origin" });
      if (!response.ok) throw new Error();
      setStatus("disconnected");
      setEmail("");
    } catch {
      setError(t("reading.driveDisconnectError"));
    }
  }

  const busy = downloading || saving || isPreparing;
  const connectLabel = status === "auth-required" ? t("reading.driveSignIn") : t("reading.driveConnect");

  return <section className="reading-drive-export" aria-label={t("reading.imageExportLabel")}>
    <div className="reading-drive-export__row">
      <label className="reading-drive-export__format">
        <span>{t("reading.driveFormat")}</span>
        <select value={format} onChange={(event) => { setFormat(event.target.value as ReadingImageFormat); setDriveUrl(""); setError(""); setDownloadNotice(""); }} disabled={busy}>
          <option value="png">PNG</option>
          <option value="jpg">JPG</option>
        </select>
      </label>
      <button className="reading-action reading-action--image reading-drive-export__download min-h-11 rounded-full border border-antique-gold/55 px-4 text-sm hover:border-antique-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-antique-gold focus-visible:ring-offset-2 focus-visible:ring-offset-midnight-navy disabled:cursor-not-allowed disabled:opacity-45" type="button" onClick={() => void downloadImage()} disabled={busy} aria-busy={downloading}>
        {downloading ? <LoaderCircle size={15} className="animate-spin" aria-hidden="true" /> : <Download size={15} strokeWidth={1.6} aria-hidden="true" />}
        {downloading ? t("reading.imageDownloading") : t("reading.imageDownloadToDevice")}
      </button>
      {status === "connected" ? (
        <button className="reading-action reading-action--image reading-drive-export__drive-button min-h-11 rounded-full border border-antique-gold/55 px-4 text-sm text-ivory hover:border-antique-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-antique-gold focus-visible:ring-offset-2 focus-visible:ring-offset-midnight-navy disabled:cursor-not-allowed disabled:opacity-45" type="button" onClick={() => void saveImageToDrive()} disabled={busy} aria-busy={saving}>
          {saving ? <LoaderCircle size={15} className="animate-spin" aria-hidden="true" /> : <HardDrive size={15} strokeWidth={1.6} aria-hidden="true" />}
          {saving ? t("reading.driveSaving") : t("reading.driveSaveToDrive")}
        </button>
      ) : (
        <button className="reading-action reading-action--image reading-drive-export__drive-button min-h-11 rounded-full border border-antique-gold/55 px-4 text-sm text-ivory hover:border-antique-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-antique-gold focus-visible:ring-offset-2 focus-visible:ring-offset-midnight-navy disabled:cursor-not-allowed disabled:opacity-45" type="button" onClick={connectDrive} disabled={status === "loading" || status === "unavailable" || busy}>
          {status === "loading" ? <LoaderCircle size={15} className="animate-spin" aria-hidden="true" /> : <Cloud size={15} strokeWidth={1.6} aria-hidden="true" />}
          {status === "loading" ? t("reading.driveChecking") : status === "unavailable" ? t("reading.driveUnavailable") : connectLabel}
        </button>
      )}
    </div>
    <p className="reading-drive-export__note" role="note" aria-live="polite">
      {downloadNotice && <span className="reading-drive-export__download-notice">{downloadNotice}</span>}
      {status === "connected" && <><HardDrive size={13} aria-hidden="true" /> {t("reading.driveConnectedAs").replace("{email}", email)}</>}
      {t("reading.drivePublicLinkNotice")}
      {status === "connected" && <button type="button" className="reading-drive-export__disconnect" onClick={() => void disconnect()} disabled={busy}><Unplug size={13} aria-hidden="true" />{t("reading.driveDisconnect")}</button>}
      {connectionNotice && <span>{connectionNotice}</span>}
    </p>
    {driveUrl && <div className="reading-drive-export__result" aria-live="polite">
      <div className="reading-drive-export__link-row">
        <label className="sr-only" htmlFor="reading-drive-url">{t("reading.driveLink")}</label>
        <input id="reading-drive-url" type="url" readOnly value={driveUrl} onFocus={(event) => event.currentTarget.select()} />
        <button type="button" onClick={() => void copyLink()} aria-label={copied ? t("reading.driveCopied") : t("reading.driveCopyLink")}>
          {copied ? <Check size={15} aria-hidden="true" /> : <Copy size={15} aria-hidden="true" />}
        </button>
        <a href={driveUrl} target="_blank" rel="noreferrer" aria-label={t("reading.driveOpenLink")}><HardDrive size={15} aria-hidden="true" /></a>
      </div>
      {qrDataUrl && <div className="reading-drive-export__qr"><Image unoptimized src={qrDataUrl} width={196} height={196} alt={t("reading.driveQrAlt")} /><span><QrCode size={14} aria-hidden="true" />{t("reading.driveQrHint")}</span></div>}
    </div>}
      {error && <p className="reading-drive-export__error" role="alert">{error}</p>}
  </section>;
}
