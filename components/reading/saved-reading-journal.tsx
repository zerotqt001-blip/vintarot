"use client";

import { useEffect, useState } from "react";
import { useLanguage } from "@/components/language";
import { api } from "@/lib/client";
import { cards } from "@/lib/tarot";
import type { SavedReadingDetail, SavedReadingSummary } from "@/lib/tarot-saved-reading";
import { ReadingPanel } from "./reading-panel";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

export function SavedReadingJournal() {
  const { t, locale } = useLanguage();
  const [items, setItems] = useState<SavedReadingSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [detail, setDetail] = useState<SavedReadingDetail | null>(null);

  useEffect(() => {
    let live = true;
    api("tarot/saved-readings")
      .then((result) => {
        if (live) setItems(Array.isArray(result.items) ? result.items as SavedReadingSummary[] : []);
      })
      .catch((error: any) => {
        if (live) setMessage(error?.message || t("pages.savedReadingUnavailable"));
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [t]);

  async function openSavedReading(item: SavedReadingSummary) {
    setMessage("");
    try {
      const result = await api("tarot/saved-readings?id=" + encodeURIComponent(item.id));
      setDetail(result as SavedReadingDetail);
    } catch (error: any) {
      setMessage(error?.message || t("pages.savedReadingUnavailable"));
    }
  }

  const artwork = detail
    ? Object.fromEntries(detail.cards.map((card) => {
      const artworkCard = cards[card.cardNumber];
      return [card.readingCardId, {
        src: artworkCard?.moonlightImage || card.imageUrl,
        alt: detail.session.locale === "vi" ? card.nameVi : card.nameEn,
      }];
    }))
    : {};

  return (
    <section className="saved-reading-journal" aria-labelledby="saved-reading-journal-title">
      <div className="journal-head">
        <div>
          <h2 id="saved-reading-journal-title">{t("pages.savedReadings")}</h2>
          <p>{t("pages.savedReadingsText")}</p>
        </div>
      </div>
      {message && <p role="status" className="status">{message}</p>}
      {loading ? (
        <p className="empty">{t("pages.openingJournal")}</p>
      ) : items.length === 0 ? (
        <p className="empty">{t("pages.savedReadingsEmpty")}</p>
      ) : (
        <div className="journal-grid">
          {items.map((item) => (
            <button className="journal-entry saved-reading-entry" key={item.id} onClick={() => void openSavedReading(item)}>
              <time>{new Date(item.created).toLocaleDateString(locale === "vi" ? "vi-VN" : "en-GB", { day: "numeric", month: "long", year: "numeric" })}</time>
              <h3>{item.question}</h3>
              <p>{item.spreadName} · {item.cardCount} {t("common.cards")}</p>
              <div className="mini-cards">
                {item.cards.map((card) => {
                  const artworkCard = cards[card.cardNumber];
                  return artworkCard ? <img key={card.readingCardId} src={artworkCard.moonlightImage} alt={locale === "vi" ? card.nameVi : card.nameEn} /> : null;
                })}
              </div>
              <span>{t("pages.openSavedReading")}</span>
            </button>
          ))}
        </div>
      )}
      <Dialog open={Boolean(detail)} onOpenChange={(open) => { if (!open) setDetail(null); }}>
        <DialogContent className="journal-dialog saved-reading-dialog">
          <DialogTitle className="sr-only">{detail?.session.question || t("pages.savedReadings")}</DialogTitle>
          <DialogDescription className="sr-only">{t("pages.savedReadingsText")}</DialogDescription>
          {detail && (
            <ReadingPanel
              reading={detail.reading}
              locale={detail.session.locale}
              session={{
                question: detail.session.question,
                spreadName: detail.spread.name,
              }}
              artworkByReadingCardId={artwork}
              t={t}
              onClose={() => setDetail(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
