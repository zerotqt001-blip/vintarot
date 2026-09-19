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
    <section className="reading-section reading-section--tarot-evidence border-t border-antique-gold/15 px-5 py-5 sm:px-9" aria-labelledby="reading-tarot-evidence">
      <details className="reading-evidence-disclosure">
        <summary id="reading-tarot-evidence" className="min-h-11 cursor-pointer list-none py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-antique-gold focus-visible:ring-inset">
          <span className="block text-base font-medium text-ivory">{t("reading.tarotEvidence")}</span>
          <span className="mt-1 block text-sm text-ivory/55">{t("reading.evidenceDisclosure")}</span>
          <span className="reading-disclosure-mark" aria-hidden="true">＋</span>
        </summary>
        <ol className="mt-3 space-y-1 pb-3">
        {items.map((item) => {
          const name = cardName(item, locale);
          const image = artwork[item.readingCardId];
          return (
            <li className="reading-card-evidence grid gap-4 border-t border-antique-gold/15 py-5 first:border-t-0 sm:grid-cols-[4.5rem_1fr]" data-reading-card-id={item.readingCardId} data-position-id={item.position.id} data-position-key={item.position.key} key={item.readingCardId}>
                {image ? (
                  // The Room supplies local or configured artwork URLs; Next Image cannot know that source set here.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img className="aspect-[2/3] w-18 rounded-md object-cover shadow-[0_10px_28px_rgba(0,0,0,0.24)]" src={image.src} alt={image.alt || name} data-card-id={item.card.id} />
                ) : (
                  <span className="flex aspect-[2/3] w-18 items-center justify-center rounded-md border border-antique-gold/25 text-center text-[0.65rem] text-ivory/55" aria-hidden="true">
                    {name}
                  </span>
                )}
                <div className="self-center">
                  <p className="text-sm font-medium text-antique-gold">{item.position.name} · {name}</p>
                  <p className="mt-1 text-xs uppercase tracking-[0.12em] text-ivory/55">{t(`reading.${item.orientation}Label`)}</p>
                  <p className="mt-3 max-w-[70ch] text-sm leading-7 text-ivory/78">{item.interpretation}</p>
                </div>
            </li>
          );
        })}
        </ol>
      </details>
    </section>
  );
}
