import type { ReadingNextStep, ReadingTranslator } from "./reading-types";

type NextStepsProps = {
  items: ReadingNextStep[];
  t: ReadingTranslator;
};

export function NextSteps({ items, t }: NextStepsProps) {
  return (
    <section className="reading-section reading-section--next-steps brand-reading-section reading-surface px-5 py-6 sm:px-7" aria-labelledby="reading-next-steps">
      <h3 id="reading-next-steps" className="text-lg font-medium tracking-[-0.02em] text-ivory">
        {t("reading.nextSteps")}
      </h3>
      <ol className="mt-5 space-y-5">
        {items.map((item) => (
          <li className="border-l border-antique-gold/45 pl-4" key={`${item.title}-${item.body.slice(0, 16)}`}>
            <h4 className="text-base font-medium text-ivory">{item.title}</h4>
            <p className="mt-2 max-w-[70ch] text-sm leading-7 text-ivory/72">{item.body}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
