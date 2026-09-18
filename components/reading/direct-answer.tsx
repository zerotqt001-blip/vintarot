import type { ReadingTranslator } from "./reading-types";

type DirectAnswerProps = {
  paragraphs: string[];
  t: ReadingTranslator;
};

export function DirectAnswer({ paragraphs, t }: DirectAnswerProps) {
  return (
    <section className="reading-section reading-section--direct-answer brand-reading-section reading-surface reading-surface--midnight-navy px-5 py-6 sm:px-7" aria-labelledby="reading-direct-answer">
      <h3 id="reading-direct-answer" className="text-lg font-medium tracking-[-0.02em] text-antique-gold">
        {t("reading.directAnswer")}
      </h3>
      <div className="mt-4 max-w-[70ch] space-y-4 text-[1.02rem] leading-8 text-ivory/90">
        {paragraphs.map((paragraph, index) => <p key={`${index}-${paragraph.slice(0, 12)}`}>{paragraph}</p>)}
      </div>
    </section>
  );
}
