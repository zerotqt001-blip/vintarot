import type { TarotLocale } from "@/lib/ai/types";
import type { ReadingArtwork, ReadingEvidence, ReadingTranslator } from "./reading-types";

type TarotEvidenceProps = {
  items: ReadingEvidence[];
  artwork: Record<string, ReadingArtwork>;
  locale: TarotLocale;
  t: ReadingTranslator;
};

function cardName(item: ReadingEvidence, locale: TarotLocale) {
  return locale === "vi" ? item.card.nameVi : item.card.nameEn;
}

export function TarotEvidence({ items, artwork, locale, t }: TarotEvidenceProps) {
  return (
    <section className="reading-section reading-section--tarot-evidence border-t border-antique-gold/15 px-5 py-6 sm:px-7" aria-labelledby="reading-tarot-evidence">
      <h3 id="reading-tarot-evidence" className="text-lg font-medium tracking-[-0.02em] text-ivory">
        {t("reading.tarotEvidence")}
      </h3>
      <div className="mt-4 space-y-2">
        {items.map((item) => {
          const name = cardName(item, locale);
          const image = artwork[item.readingCardId];
          return (
            <details className="reading-card-evidence rounded-xl border border-antique-gold/20 bg-midnight-navy/45" key={item.readingCardId}>
              <summary className="min-h-11 cursor-pointer list-none px-4 py-3 text-sm text-ivory marker:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-antique-gold focus-visible:ring-inset">
                <span className="font-medium text-antique-gold">{item.position.name}</span>
                <span className="px-2 text-ivory/45" aria-hidden="true">·</span>
                <span>{name}</span>
                <span className="px-2 text-ivory/45" aria-hidden="true">·</span>
                <span className="text-ivory/65">{t(`reading.${item.orientation}Label`)}</span>
              </summary>
              <div className="grid gap-4 border-t border-antique-gold/15 px-4 py-4 sm:grid-cols-[4.5rem_1fr]">
                {image ? (
                  // The Room supplies local or configured artwork URLs; Next Image cannot know that source set here.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img className="aspect-[2/3] w-18 rounded-md object-cover shadow-[0_10px_28px_rgba(0,0,0,0.24)]" src={image.src} alt={image.alt || name} />
                ) : (
                  <span className="flex aspect-[2/3] w-18 items-center justify-center rounded-md border border-antique-gold/25 text-center text-[0.65rem] text-ivory/55" aria-hidden="true">
                    {name}
                  </span>
                )}
                <p className="max-w-[70ch] self-center text-sm leading-7 text-ivory/78">{item.interpretation}</p>
              </div>
            </details>
          );
        })}
      </div>
    </section>
  );
}
