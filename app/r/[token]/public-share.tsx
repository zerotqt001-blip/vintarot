"use client";

import { LanguageSelect, useLanguage } from "@/components/language";
import type { PublicReadingView, ShareEventName } from "@/lib/tarot-share-contract";
import Link from "next/link";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";

function paragraphs(value: string): string[] {
  return value.split(/\n{2,}/).map((part) => part.trim()).filter(Boolean);
}

function tokenFromUrl(publicUrl: string): string | null {
  try {
    const match = new URL(publicUrl).pathname.match(/^\/r\/([A-Za-z0-9_-]{43})(?:\/|$)/);
    return match?.[1] || null;
  } catch {
    return null;
  }
}

async function recordShareEvent(view: PublicReadingView, eventName: ShareEventName, source?: "share" | "copy_link" | "save_image" | "create_cta") {
  const token = tokenFromUrl(view.publicUrl);
  if (!token) return;
  try {
    await fetch(`/api/tarot/shares/${token}/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event_id: crypto.randomUUID(),
        event_name: eventName,
        locale: view.locale,
        source,
        renderer_version: view.rendererVersion,
      }),
      keepalive: true,
    });
  } catch {
    // Analytics is deliberately best-effort and never blocks reading access.
  }
}

export function PublicShareError({ kind }: { kind: "not-found" | "unavailable" }) {
  const { t } = useLanguage();
  const unavailable = kind === "unavailable";
  return <main className="share-shell share-shell--error">
    <div className="share-stars" aria-hidden="true" />
    <section className="share-error-card" aria-labelledby="share-error-title">
      <Link className="share-error-brand" href="/" aria-label="NaTarot"><Image src="/brand/natarot-logo-light.svg" alt="NaTarot" width={170} height={40} priority /></Link>
      <p className="share-eyebrow">{t("share.eyebrow")}</p>
      <h1 id="share-error-title">{unavailable ? t("share.unavailableTitle") : t("share.notFoundTitle")}</h1>
      <p>{unavailable ? t("share.unavailableDescription") : t("share.notFoundDescription")}</p>
      <Link className="share-button share-button--primary" href="/">{t("share.goHome")}</Link>
      <div className="share-error-language"><LanguageSelect /></div>
    </section>
  </main>;
}

export default function PublicSharePage({ view }: { view: PublicReadingView }) {
  const { t } = useLanguage();
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const answerParagraphs = useMemo(() => paragraphs(view.reading.directAnswer), [view.reading.directAnswer]);

  useEffect(() => {
    void recordShareEvent(view, "share_opened", "share");
  }, [view]);

  async function copyLink() {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(view.publicUrl);
      } else {
        const input = document.createElement("textarea");
        input.value = view.publicUrl;
        input.setAttribute("readonly", "true");
        input.style.position = "fixed";
        input.style.opacity = "0";
        document.body.appendChild(input);
        input.select();
        document.execCommand("copy");
        input.remove();
      }
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
      void recordShareEvent(view, "share_cta_clicked", "copy_link");
    } catch {
      setCopied(false);
    }
  }

  function saveImage() {
    setSaving(true);
    void recordShareEvent(view, "share_image_downloaded", "save_image");
    const link = document.createElement("a");
    link.href = view.imageUrl;
    link.download = "natarot-shared-reading.svg";
    link.rel = "noreferrer";
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => setSaving(false), 900);
  }

  return <main className="share-shell">
    <div className="share-stars" aria-hidden="true" />
    <header className="share-header">
      <Link href="/" className="share-brand" aria-label="NaTarot"><Image src="/brand/natarot-logo-light.svg" alt="NaTarot" width={194} height={46} priority /></Link>
      <div className="share-header-actions"><span className="share-header-note">{t("share.createdBy")}</span><LanguageSelect /></div>
    </header>
    <div className="share-main">
      <section className="share-intro" aria-labelledby="share-title">
        <p className="share-eyebrow">{t("share.eyebrow")}</p>
        <h1 id="share-title">{t("share.title")}</h1>
        <p className="share-private-note">{t("share.privateNote")}</p>
        <div className="share-question"><span>{t("share.question")}</span><p>{view.question}</p></div>
      </section>

      <section className="share-spread" aria-labelledby="share-cards-title">
        <div className="share-section-heading"><p className="share-eyebrow">{view.spread.name}</p><h2 id="share-cards-title">{t("share.cards")}</h2></div>
        <div className="share-card-grid">
          {view.cards.map((card) => <article className="share-card-tile" key={`${card.order}-${card.cardNumber}`}>
            <div className="share-card-art"><Image src={card.imageUrl} alt={card.alt} width={400} height={647} loading="lazy" /></div>
            <div className="share-card-meta"><span className="share-card-position">{String(card.order + 1).padStart(2, "0")} · {card.position.label}</span><h3>{card.name}</h3><span className="share-card-orientation">{card.orientation === "upright" ? t("share.orientationUpright") : t("share.orientationReversed")}</span></div>
          </article>)}
        </div>
      </section>

      <div className="share-reading-layout">
        <article className="share-answer-panel">
          <p className="share-eyebrow">{t("share.directAnswer")}</p>
          <div className="share-answer-copy">{answerParagraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>)}</div>
          <p className="share-disclaimer">{view.reading.disclaimer}</p>
        </article>
        <aside className="share-action-panel" aria-label="Share actions">
          <div className="share-action-orbit" aria-hidden="true"><span>✦</span><span>☾</span><span>✦</span></div>
          <div className="share-action-copy"><p className="share-eyebrow">{view.spread.cardCount} {t("common.cards")}</p><p>{t("share.createdBy")}</p></div>
          <button type="button" className="share-button share-button--primary" onClick={() => void copyLink()}>{copied ? t("share.copied") : t("share.copyLink")}</button>
          <button type="button" className="share-button share-button--secondary" onClick={saveImage} disabled={saving}>{saving ? t("share.savePreparing") : t("share.saveImage")}</button>
          <Link className="share-create-link" href="/create?source=share" onClick={() => void recordShareEvent(view, "share_cta_clicked", "create_cta")}>{t("share.createReading")} <span aria-hidden="true">↗</span></Link>
        </aside>
      </div>

      {(view.reading.personalInsights.length > 0 || view.reading.nextSteps.length > 0 || view.reading.cardEvidence.length > 0 || view.reading.reflectionPrompts.length > 0 || view.reading.deeperReading) && <section className="share-supporting" aria-label={t("share.cardEvidence")}>
        {view.reading.personalInsights.length > 0 && <section className="share-support-block"><h2>{t("share.personalInsights")}</h2><div className="share-insight-grid">{view.reading.personalInsights.map((item) => <article key={`${item.title}-${item.body}`}><h3>{item.title}</h3><p>{item.body}</p></article>)}</div></section>}
        {view.reading.nextSteps.length > 0 && <section className="share-support-block"><h2>{t("share.nextSteps")}</h2><ol className="share-next-steps">{view.reading.nextSteps.map((item) => <li key={`${item.title}-${item.body}`}><strong>{item.title}</strong><span>{item.body}</span></li>)}</ol></section>}
        {view.reading.deeperReading && <details className="share-details"><summary>{t("share.reflectionPrompts")}</summary><p>{view.reading.deeperReading}</p></details>}
        {view.reading.reflectionPrompts.length > 0 && <details className="share-details"><summary>{t("share.reflectionPrompts")}</summary><ul>{view.reading.reflectionPrompts.map((prompt) => <li key={prompt}>{prompt}</li>)}</ul></details>}
        {view.reading.cardEvidence.length > 0 && <details className="share-details"><summary>{t("share.cardEvidence")}</summary><div className="share-evidence-list">{view.reading.cardEvidence.map((item) => <article key={`${item.order}-${item.cardName}`}><span>{String(item.order + 1).padStart(2, "0")} · {item.positionLabel}</span><h3>{item.cardName} · {item.orientation === "upright" ? t("share.orientationUpright") : t("share.orientationReversed")}</h3><p>{item.interpretation}</p></article>)}</div></details>}
      </section>}
    </div>
    <footer className="share-footer"><span>© 2026 NaTarot</span><span>{t("share.privateNote")}</span><Link href="/privacy">Privacy / Riêng tư</Link></footer>
  </main>;
}
