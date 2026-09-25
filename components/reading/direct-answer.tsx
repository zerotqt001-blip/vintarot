import type { ReadingArtwork, ReadingTranslator } from "./reading-types";

type FeaturedCard = {
  name: string;
  position: string;
  orientation: string;
  artwork?: ReadingArtwork;
};

type DirectAnswerProps = {
  paragraphs: string[];
  featuredCard?: FeaturedCard;
  t: ReadingTranslator;
};

export function DirectAnswer({ paragraphs, featuredCard, t }: DirectAnswerProps) {
  const [opening, ...remaining] = paragraphs;

  return (
    <section className="reading-section reading-section--direct-answer brand-reading-section reading-surface reading-surface--midnight-navy px-5 py-6 sm:px-9 sm:py-8" aria-labelledby="reading-direct-answer">
      <div className="reading-direct-answer__layout">
        {featuredCard && (
          <figure className="reading-direct-answer__feature">
            {featuredCard.artwork ? (
              // The Room supplies local or configured artwork URLs; Next Image cannot know that source set here.
              // eslint-disable-next-line @next/next/no-img-element
              <img className="reading-direct-answer__feature-art" src={featuredCard.artwork.src} alt={featuredCard.artwork.alt || featuredCard.name} />
            ) : <div className="reading-direct-answer__feature-placeholder" aria-hidden="true">✦</div>}
            <figcaption>
              <span>{featuredCard.position}</span>
              <strong>{featuredCard.name}</strong>
              <span>{featuredCard.orientation}</span>
            </figcaption>
          </figure>
        )}
        <div className="reading-direct-answer__copy">
          <div className="reading-takeaway">
            <h3 id="reading-direct-answer" className="reading-takeaway__label text-[0.68rem] font-medium tracking-[0.08em] text-antique-gold">
              {t("reading.takeaway")}
            </h3>
            {opening && <p className="mt-4 max-w-[42ch] text-[clamp(1.15rem,1.9vw,1.55rem)] leading-[1.55] text-ivory">{opening}</p>}
          </div>
          {remaining.length > 0 && (
            <div className="reading-direct-answer__body mt-7 max-w-[70ch] space-y-5 text-[1.02rem] leading-8 text-ivory/85">
              {remaining.map((paragraph, index) => <p key={`${index}-${paragraph.slice(0, 12)}`}>{paragraph}</p>)}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
