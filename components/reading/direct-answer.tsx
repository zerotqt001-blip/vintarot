import type { ReadingTranslator } from "./reading-types";

type DirectAnswerProps = {
  paragraphs: string[];
  t: ReadingTranslator;
};

export function DirectAnswer({ paragraphs, t }: DirectAnswerProps) {
  const [opening, ...remaining] = paragraphs;

  return (
    <section className="reading-section reading-section--direct-answer brand-reading-section reading-surface reading-surface--midnight-navy px-5 py-6 sm:px-9 sm:py-8" aria-labelledby="reading-direct-answer">
      <div className="reading-takeaway">
        <h3 id="reading-direct-answer" className="text-[0.68rem] font-medium tracking-[0.16em] text-antique-gold uppercase">
          {t("reading.takeaway")}
        </h3>
        {opening && <p className="mt-4 max-w-[42ch] text-[clamp(1.15rem,1.9vw,1.55rem)] leading-[1.55] text-ivory">{opening}</p>}
      </div>
      {remaining.length > 0 && (
        <div className="reading-direct-answer__body mt-7 max-w-[70ch] space-y-5 text-[1.02rem] leading-8 text-ivory/85">
          {remaining.map((paragraph, index) => <p key={`${index}-${paragraph.slice(0, 12)}`}>{paragraph}</p>)}
        </div>
      )}
    </section>
  );
}
