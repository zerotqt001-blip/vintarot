"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { ArrowLeft, CalendarPlus, ImagePlus, Link2, Search, Trash2, UploadCloud, UserRound, Users } from "lucide-react";
import { useLanguage } from "@/components/language";
import { normalizeGoogleDriveImageUrl } from "@/lib/google-drive-image";
import styles from "./readers.module.css";

type Reader = {
  id: string;
  name: string;
  bio: string;
  timezone: string;
  language: string;
  duration: number;
  price: number;
  published: boolean;
  slots: string[];
  driveImageUrl: string | null;
  avatarUrl: string | null;
  createdAt: number;
  updatedAt: number;
};

type Profile = Omit<Reader, "id" | "avatarUrl" | "createdAt" | "updatedAt">;
type PhotoMode = "upload" | "drive" | "none";
type ApiFailure = Error & { status?: number };

const MAX_AVATAR_BYTES = 1_900_000;
const EMPTY_PROFILE = (locale: string): Profile => ({
  name: "",
  bio: "",
  timezone: "Asia/Ho_Chi_Minh",
  language: locale === "vi" ? "Tiếng Việt" : "English",
  duration: 30,
  price: 0,
  published: false,
  slots: [],
  driveImageUrl: null,
});

type LocalDateTimeParts = { year: number; month: number; day: number; hour: number; minute: number };

function localDateTimeParts(timestamp: number, timezone: string): LocalDateTimeParts | null {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(new Date(timestamp));
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return {
      year: Number(values.year),
      month: Number(values.month),
      day: Number(values.day),
      hour: Number(values.hour),
      minute: Number(values.minute),
    };
  } catch {
    return null;
  }
}

function slotToIso(value: string, timezone: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const wanted: LocalDateTimeParts = {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour: Number(match[4]),
    minute: Number(match[5]),
  };
  const wallTime = Date.UTC(wanted.year, wanted.month - 1, wanted.day, wanted.hour, wanted.minute);
  const calendar = new Date(wallTime);
  if (calendar.getUTCFullYear() !== wanted.year || calendar.getUTCMonth() + 1 !== wanted.month || calendar.getUTCDate() !== wanted.day || wanted.hour > 23 || wanted.minute > 59) return null;

  let timestamp = wallTime;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const local = localDateTimeParts(timestamp, timezone);
    if (!local) return null;
    const representedWallTime = Date.UTC(local.year, local.month - 1, local.day, local.hour, local.minute);
    timestamp += wallTime - representedWallTime;
  }

  const verified = localDateTimeParts(timestamp, timezone);
  if (!verified || verified.year !== wanted.year || verified.month !== wanted.month || verified.day !== wanted.day || verified.hour !== wanted.hour || verified.minute !== wanted.minute) return null;
  return new Date(timestamp).toISOString();
}

function formatSlot(value: string, locale: string, timezone: string): string {
  try {
    return new Intl.DateTimeFormat(locale === "vi" ? "vi-VN" : "en-GB", {
      timeZone: timezone,
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

async function responseJson<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => ({})) as { error?: unknown } & T;
  if (!response.ok) {
    const error = new Error(typeof body.error === "string" ? body.error : "Request failed.") as ApiFailure;
    error.status = response.status;
    throw error;
  }
  return body;
}

export function ReaderManager({ authenticated, showBackLink = true }: { authenticated: boolean; showBackLink?: boolean }) {
  const { locale, t } = useLanguage();
  const [readers, setReaders] = useState<Reader[]>([]);
  const [profile, setProfile] = useState<Profile>(EMPTY_PROFILE(locale));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedReader, setSelectedReader] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [photoMode, setPhotoMode] = useState<PhotoMode>("none");
  const [upload, setUpload] = useState<File | null>(null);
  const [slotInput, setSlotInput] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [previewState, setPreviewState] = useState<{ url: string; state: "loaded" | "failed" }>({ url: "", state: "failed" });
  const [accessDenied, setAccessDenied] = useState(false);

  const loadReaders = useCallback(async () => {
    if (!authenticated) { setLoading(false); return; }
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/readers", { credentials: "same-origin", cache: "no-store" });
      const data = await responseJson<{ items: Reader[] }>(response);
      setReaders(data.items);
      setAccessDenied(false);
    } catch (cause) {
      const failure = cause as ApiFailure;
      const denied = failure.status === 401 || failure.status === 403;
      setAccessDenied(denied);
      setError(denied ? t("humanReaders.accessDenied") : t("humanReaders.loadError"));
    } finally {
      setLoading(false);
    }
  }, [authenticated, t]);

  useEffect(() => { void loadReaders(); }, [loadReaders]);

  const currentReader = readers.find((reader) => reader.id === editingId) ?? null;
  const uploadPreview = useMemo(() => upload ? URL.createObjectURL(upload) : null, [upload]);
  useEffect(() => () => { if (uploadPreview) URL.revokeObjectURL(uploadPreview); }, [uploadPreview]);
  const normalizedDrive = profile.driveImageUrl ? normalizeGoogleDriveImageUrl(profile.driveImageUrl) : null;
  const previewUrl = photoMode === "upload" ? uploadPreview ?? (currentReader?.avatarUrl?.startsWith("/api/admin/readers/") ? currentReader.avatarUrl : null)
    : photoMode === "drive" ? normalizedDrive?.imageUrl ?? null
      : null;
  const previewStatus = previewState.url === previewUrl ? previewState.state : "pending";
  const filteredReaders = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    return normalized ? readers.filter((reader) => `${reader.name} ${reader.bio} ${reader.language}`.toLocaleLowerCase().includes(normalized)) : readers;
  }, [query, readers]);

  const chooseReader = (reader: Reader) => {
    setEditingId(reader.id);
    setSelectedReader(reader.id);
    const { id: _id, avatarUrl: _avatarUrl, createdAt: _createdAt, updatedAt: _updatedAt, ...editable } = reader;
    setProfile(editable);
    setPhotoMode(reader.driveImageUrl ? "drive" : reader.avatarUrl ? "upload" : "none");
    setUpload(null);
    setReason("");
    setSlotInput("");
    setError("");
    setMessage("");
  };

  const startNewReader = () => {
    setEditingId(null);
    setSelectedReader(null);
    setProfile(EMPTY_PROFILE(locale));
    setPhotoMode("none");
    setUpload(null);
    setReason("");
    setSlotInput("");
    setError("");
    setMessage("");
  };

  const addSlot = () => {
    const normalized = slotToIso(slotInput, profile.timezone);
    if (!normalized) { setError(t("humanReaders.timezoneInvalid")); return; }
    setError("");
    setProfile((current) => ({ ...current, slots: [...new Set([...current.slots, normalized])].sort() }));
    setSlotInput("");
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setMessage("");
    if (!reason.trim()) { setError(t("humanReaders.reasonRequired")); return; }
    try { new Intl.DateTimeFormat("en-US", { timeZone: profile.timezone }); }
    catch { setError(t("humanReaders.timezoneInvalid")); return; }
    if (photoMode === "drive" && !normalizedDrive) { setError(t("humanReaders.driveLinkError")); return; }
    if (photoMode === "drive" && profile.published && (previewUrl === null || previewStatus !== "loaded")) { setError(t(previewStatus === "failed" ? "humanReaders.drivePreviewFailed" : "humanReaders.previewRequired")); return; }
    if (photoMode === "upload") {
      if (upload && (upload.size > MAX_AVATAR_BYTES || !["image/jpeg", "image/png", "image/webp"].includes(upload.type))) { setError(t("humanReaders.photoTypeError")); return; }
      if (upload && (previewUrl === null || previewStatus !== "loaded")) { setError(t(previewStatus === "failed" ? "humanReaders.uploadPreviewFailed" : "humanReaders.uploadPreviewPending")); return; }
      if (!upload && currentReader?.driveImageUrl) { setError(t("humanReaders.photoTypeError")); return; }
    }

    setBusy(true);
    try {
      const idempotencyKey = crypto.randomUUID();
      let avatarWarning = false;
      let uploadWarning = false;
      const uploadAvatar = async (readerId: string) => {
        if (!upload) return;
        const form = new FormData();
        form.set("file", upload);
        form.set("reason", reason.trim());
        form.set("idempotency_key", crypto.randomUUID());
        const avatarResponse = await fetch(`/api/admin/readers/${encodeURIComponent(readerId)}/avatar`, { method: "PUT", credentials: "same-origin", body: form });
        await responseJson(avatarResponse);
      };
      if (upload && editingId) await uploadAvatar(editingId);
      const payload = {
        ...profile,
        driveImageUrl: photoMode === "drive" ? profile.driveImageUrl?.trim() || null : null,
        slots: profile.slots,
        reason: reason.trim(),
        idempotency_key: idempotencyKey,
      };
      const endpoint = editingId ? `/api/admin/readers/${encodeURIComponent(editingId)}` : "/api/admin/readers";
      const response = await fetch(endpoint, {
        method: editingId ? "PATCH" : "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const saved = await responseJson<{ reader: Reader }>(response);
      if (upload && !editingId) {
        try { await uploadAvatar(saved.reader.id); } catch { uploadWarning = true; }
      } else if (!upload && photoMode === "none" && (currentReader?.avatarUrl || currentReader?.driveImageUrl)) {
        const removeResponse = await fetch(`/api/admin/readers/${encodeURIComponent(saved.reader.id)}/avatar`, {
          method: "DELETE",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason: reason.trim(), idempotency_key: crypto.randomUUID() }),
        });
        try { await responseJson(removeResponse); } catch { avatarWarning = true; }
      }
      await loadReaders();
      setEditingId(saved.reader.id);
      setSelectedReader(saved.reader.id);
      setProfile({
        name: saved.reader.name,
        bio: saved.reader.bio,
        timezone: saved.reader.timezone,
        language: saved.reader.language,
        duration: saved.reader.duration,
        price: saved.reader.price,
        published: saved.reader.published,
        slots: saved.reader.slots,
        driveImageUrl: saved.reader.driveImageUrl,
      });
      setUpload(uploadWarning ? upload : null);
      setReason(uploadWarning ? reason : "");
      setMessage(uploadWarning ? t("humanReaders.uploadRetryAvailable") : avatarWarning ? t("humanReaders.photoUpdateFailed") : t("humanReaders.saved"));
    } catch (cause) {
      const failure = cause as ApiFailure;
      setError(failure.status === 401 || failure.status === 403 ? t("humanReaders.accessDenied") : t("humanReaders.saveFailed"));
    } finally {
      setBusy(false);
    }
  };

  if (!authenticated) return <section className={styles.accessPanel}><UserRound size={30} /><h1>{t("humanReaders.adminTitle")}</h1><p>{t("humanReaders.signInAdmin")}</p><Link className="button black" href="/auth?return_to=%2Fadmin%2Freaders">{t("common.signIn")}</Link></section>;
  if (accessDenied) return <section className={styles.accessPanel}><UserRound size={30} /><h1>{t("humanReaders.adminTitle")}</h1><p>{t("humanReaders.accessDenied")}</p><Link className="button" href="/">{t("common.home")}</Link></section>;

  return <div className={styles.page}>
    <header className={styles.header}>
      <div>
        <p className={styles.eyebrow}>{t("humanReaders.eyebrow")}</p>
        <h1>{t("humanReaders.adminTitle")}</h1>
        <p className={styles.intro}>{t("humanReaders.adminIntro")}</p>
      </div>
      {showBackLink && <Link className={styles.backLink} href="/admin"><ArrowLeft size={16} />{t("humanReaders.backToAdmin")}</Link>}
    </header>

    <div className={styles.layout}>
      <aside className={styles.directory} aria-label={t("humanReaders.adminTitle")}>
        <div className={styles.directoryHeader}>
          <div className={styles.count}><Users size={17} /><span>{readers.length}</span></div>
          <button className={styles.addButton} type="button" onClick={startNewReader}><ImagePlus size={16} />{t("humanReaders.addReader")}</button>
        </div>
        <label className={styles.search}><Search size={16} /><span className="sr-only">{t("humanReaders.searchReaders")}</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("humanReaders.searchReaders")} /></label>
        {loading ? <p className={styles.listHint}>{t("humanReaders.loading")}</p> : filteredReaders.length ? <div className={styles.readerList}>
          {filteredReaders.map((reader) => <button className={`${styles.readerRow}${selectedReader === reader.id ? ` ${styles.readerRowActive}` : ""}`} key={reader.id} type="button" onClick={() => chooseReader(reader)}>
            <span className={styles.listAvatar}>{reader.avatarUrl ? <img src={reader.avatarUrl} alt="" /> : <span>{reader.name.slice(0, 1).toLocaleUpperCase()}</span>}</span>
            <span className={styles.readerRowText}><strong>{reader.name}</strong><small>{reader.published ? t("humanReaders.published") : t("humanReaders.draft")}</small></span>
          </button>)}
        </div> : <p className={styles.listHint}>{query ? t("humanReaders.searchEmpty") : t("humanReaders.noReadersAdmin")}</p>}
      </aside>

      <form className={styles.editor} onSubmit={(event) => void submit(event)}>
        <div className={styles.editorHeader}>
          <div><span className={styles.editorIcon}><UserRound size={19} /></span><div><p className={styles.editorEyebrow}>{editingId ? t("humanReaders.editReader") : t("humanReaders.newReader")}</p><h2>{profile.name || t("humanReaders.newReader")}</h2></div></div>
          <label className={styles.publishToggle}><input type="checkbox" checked={profile.published} onChange={(event) => setProfile((current) => ({ ...current, published: event.target.checked }))} /><span>{profile.published ? t("humanReaders.published") : t("humanReaders.publish")}</span></label>
        </div>

        <div className={styles.fields}>
          <label className={styles.field}>{t("humanReaders.readerName")}<input required minLength={1} maxLength={80} value={profile.name} onChange={(event) => setProfile((current) => ({ ...current, name: event.target.value }))} /></label>
          <label className={`${styles.field} ${styles.fullWidth}`}>{t("humanReaders.bio")}<textarea required minLength={20} maxLength={3000} rows={4} value={profile.bio} onChange={(event) => setProfile((current) => ({ ...current, bio: event.target.value }))} /></label>
          <label className={styles.field}>{t("humanReaders.languageField")}<input required maxLength={100} value={profile.language} onChange={(event) => setProfile((current) => ({ ...current, language: event.target.value }))} /></label>
          <label className={styles.field}>{t("humanReaders.timezoneField")}<input required maxLength={100} value={profile.timezone} onChange={(event) => setProfile((current) => ({ ...current, timezone: event.target.value }))} /></label>
          <label className={styles.field}>{t("humanReaders.durationField")}<input required type="number" min={15} max={120} step={5} value={profile.duration} onChange={(event) => setProfile((current) => ({ ...current, duration: Number(event.target.value) }))} /></label>
          <label className={styles.field}>{t("humanReaders.priceField")}<input required type="number" min={0} max={100000000} step={1000} value={profile.price} onChange={(event) => setProfile((current) => ({ ...current, price: Number(event.target.value) }))} /></label>
        </div>

        <section className={styles.slotsSection}>
          <div className={styles.sectionTitle}><CalendarPlus size={17} /><h3>{t("humanReaders.availableSlots")}</h3></div>
          <div className={styles.slotAdd}><label className="sr-only" htmlFor="reader-slot">{t("humanReaders.availableSlots")}</label><input id="reader-slot" type="datetime-local" value={slotInput} onChange={(event) => setSlotInput(event.target.value)} /><button type="button" className={styles.secondaryButton} onClick={addSlot} disabled={!slotInput}>{t("humanReaders.addSlot")}</button></div>
          <p className={styles.hint}>{t("humanReaders.slotTimezoneHint")} · {profile.timezone}</p>
          {profile.slots.length ? <ul className={styles.slotList}>{profile.slots.map((slot) => <li key={slot}><span>{formatSlot(slot, locale, profile.timezone)}</span><button type="button" aria-label={`${t("common.remove")} ${formatSlot(slot, locale, profile.timezone)}`} onClick={() => setProfile((current) => ({ ...current, slots: current.slots.filter((value) => value !== slot) }))}><Trash2 size={15} /></button></li>)}</ul> : <p className={styles.hint}>{t("humanReaders.noSlotsAdmin")}</p>}
        </section>

        <section className={styles.photoSection}>
          <div className={styles.sectionTitle}><ImagePlus size={17} /><h3>{t("humanReaders.photo")}</h3></div>
          <div className={styles.photoModes}>
            <button type="button" className={photoMode === "upload" ? styles.modeActive : ""} onClick={() => setPhotoMode("upload")}><UploadCloud size={16} />{t("humanReaders.upload")}</button>
            <button type="button" className={photoMode === "drive" ? styles.modeActive : ""} onClick={() => { setPhotoMode("drive"); setUpload(null); setPreviewState({ url: "", state: "failed" }); }}><Link2 size={16} />{t("humanReaders.driveUrl")}</button>
            <button type="button" className={photoMode === "none" ? styles.modeActive : ""} onClick={() => { setPhotoMode("none"); setUpload(null); setProfile((current) => ({ ...current, driveImageUrl: null })); }}><Trash2 size={15} />{t("humanReaders.removePhoto")}</button>
          </div>
          {photoMode === "upload" && <label className={styles.filePicker}><span>{t("humanReaders.upload")}</span><input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => { const file = event.target.files?.[0] ?? null; setUpload(file); setPreviewState({ url: "", state: "failed" }); }} /><small>{t("humanReaders.uploadHint")}</small></label>}
          {photoMode === "drive" && <label className={styles.field}>{t("humanReaders.driveUrl")}<input type="url" value={profile.driveImageUrl ?? ""} onChange={(event) => { setProfile((current) => ({ ...current, driveImageUrl: event.target.value || null })); setPreviewState({ url: "", state: "failed" }); }} placeholder="https://drive.google.com/file/d/.../view" /><small className={styles.hint}>{t("humanReaders.driveHint")}</small></label>}
          {photoMode === "drive" && !normalizedDrive && profile.driveImageUrl && <p className={styles.error}>{t("humanReaders.driveLinkError")}</p>}
          {previewUrl ? <div className={styles.preview}>
            <img src={previewUrl} alt={t("humanReaders.photo")} onLoad={() => setPreviewState({ url: previewUrl, state: "loaded" })} onError={() => setPreviewState({ url: previewUrl, state: "failed" })} />
            <p className={previewStatus === "loaded" ? styles.previewOk : styles.previewError}>{t(previewStatus === "loaded" ? "humanReaders.drivePreviewReady" : previewStatus === "failed" ? photoMode === "upload" ? "humanReaders.uploadPreviewFailed" : "humanReaders.drivePreviewFailed" : "humanReaders.drivePreviewPending")}</p>
          </div> : photoMode === "upload" && currentReader?.avatarUrl && !upload ? <div className={styles.preview}><img src={currentReader.avatarUrl} alt={t("humanReaders.photo")} /><p className={styles.previewOk}>{t("humanReaders.drivePreviewReady")}</p></div> : null}
        </section>

        <label className={`${styles.field} ${styles.reasonField}`}>{t("humanReaders.reason")}<input required maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} placeholder={t("humanReaders.reasonPlaceholder")} /></label>
        {error && <p className={styles.error} role="alert">{error}</p>}
        {message && <p className={styles.success} role="status">{message}</p>}
        <div className={styles.actions}><button className="button black" type="submit" disabled={busy || loading}>{busy ? t("humanReaders.saving") : editingId ? t("humanReaders.saveChanges") : t("humanReaders.saveReader")}</button></div>
      </form>
    </div>
  </div>;
}
