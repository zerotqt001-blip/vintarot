import type { ReadingTranslator } from "./reading-types";

type DirectAnswerProps = {
  paragraphs: string[];
  t: ReadingTranslator;
};

export function DirectAnswer({ paragraphs, t }: DirectAnswerProps) {
  return (
    <section className="reading-section reading-section--direct-answer reading-surface reading-surface--ivory px-5 py-6 sm:px-7" aria-labelledby="reading-direct-answer">
      <h3 id="reading-direct-answer" className="text-lg font-medium tracking-[-0.02em] text-midnight-navy">
        {t("reading.directAnswer")}
      </h3>
      <div className="mt-4 max-w-[70ch] space-y-4 text-[1.02rem] leading-8 text-midnight-navy/85">
        {paragraphs.map((paragraph, index) => <p key={`${index}-${paragraph.slice(0, 12)}`}>{paragraph}</p>)}
      </div>
    </section>
  );
}
