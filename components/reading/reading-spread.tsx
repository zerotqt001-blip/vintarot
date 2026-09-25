'use client';

import { useEffect, useMemo, useRef, useState } from "react";
import { projectSpreadGeometry, resolveSpreadGeometry, type SpreadProjection } from "@/lib/spread-geometry";
import type { TarotLocale } from "@/lib/ai/types";
import type { ReadingArtwork, ReadingEvidence, ReadingTranslator } from "./reading-types";

type ReadingSpreadProps = {
  items: ReadingEvidence[];
  artwork: Record<string, ReadingArtwork>;
  locale: TarotLocale;
  spreadType?: string | null;
  spreadName?: string | null;
  t: ReadingTranslator;
};

const DEFAULT_VIEWPORT = { width: 1100, height: 460, mobile: false };

function cardName(item: ReadingEvidence, locale: TarotLocale) {
  return locale === "vi" ? item.card.nameVi : item.card.nameEn;
}

function getViewport(element: HTMLDivElement | null) {
  const width = Math.max(1, element?.getBoundingClientRect().width || DEFAULT_VIEWPORT.width);
  return {
    width,
    height: Math.max(320, Math.min(520, width * 0.34)),
    mobile: width <= 760,
  };
}

export function ReadingSpread({ items, artwork, locale, spreadType, spreadName, t }: ReadingSpreadProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const [viewport, setViewport] = useState(DEFAULT_VIEWPORT);
  const geometry = useMemo(
    () => resolveSpreadGeometry(spreadType || undefined, items.map((item) => ({ key: item.position.key, order: item.position.order }))),
    [items, spreadType],
  );
  const projection: SpreadProjection = useMemo(
    () => projectSpreadGeometry(geometry, {
      width: viewport.width,
      height: viewport.height,
      cardAspectRatio: 400 / 647,
      minCardWidth: viewport.mobile ? 108 : items.length >= 8 ? 80 : 118,
      maxCardWidth: viewport.mobile ? 154 : items.length >= 8 ? 130 : 190,
      mobile: viewport.mobile,
    }),
    [geometry, items.length, viewport],
  );

  useEffect(() => {
    const element = stageRef.current;
    if (!element) return;
    const update = () => setViewport(getViewport(element));
    update();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(update);
    observer?.observe(element);
    window.addEventListener("resize", update);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", update);
    };
  }, []);

  const itemByPosition = new Map(items.map((item) => [item.position.order, item]));
  const stageHeight = projection.height + (projection.mode === "ordered" ? 112 : 20);

  return (
    <section className="reading-spread reading-section" aria-labelledby="reading-spread-title">
      <div className="reading-spread__header">
        <div>
          <h3 id="reading-spread-title" className="reading-spread__title">
            {spreadName || t("reading.spreadLabel")}
          </h3>
          <p className="reading-spread__count">{items.length} {t("common.cards")}</p>
        </div>
        <p className="reading-spread__hint">{t("reading.evidenceDisclosure")}</p>
      </div>
      <div
        ref={stageRef}
        className="reading-spread__stage"
        data-layout-mode={projection.mode}
        data-spread-type={geometry.layoutKey}
        data-card-count={items.length}
        style={{ height: `${stageHeight}px` }}
      >
        <div className="reading-spread__stage-light" aria-hidden="true" />
        {projection.cards.map((card) => {
          const item = itemByPosition.get(card.order);
          if (!item) return null;
          const name = cardName(item, locale);
          const image = artwork[item.readingCardId];
          return (
            <figure
              className="reading-spread__card"
              data-reading-card-id={item.readingCardId}
              data-position-key={item.position.key}
              data-card-order={card.order}
              data-orientation={item.orientation}
              key={item.readingCardId}
              style={{
                left: `${card.left}px`,
                top: `${card.top}px`,
                width: `${card.width}px`,
                transform: `rotate(${card.rotation}deg)`,
              }}
            >
              <div className="reading-spread__card-frame">
                {image ? (
                  // The Room supplies local or configured artwork URLs; Next Image cannot know that source set here.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img className="reading-spread__card-art" src={image.src} alt={image.alt || name} />
                ) : (
                  <span className="reading-spread__card-placeholder" aria-label={name}>{name}</span>
                )}
              </div>
              <figcaption className="reading-spread__caption">
                <span className="reading-spread__position">{item.position.name}</span>
                <span className="reading-spread__card-name">{name}</span>
                <span className="reading-spread__orientation">{t(`reading.${item.orientation}Label`)}</span>
              </figcaption>
            </figure>
          );
        })}
      </div>
    </section>
  );
}
