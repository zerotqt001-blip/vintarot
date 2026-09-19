import type { ReadingNextStep, ReadingTranslator } from "./reading-types";

type NextStepsProps = {
  items: ReadingNextStep[];
  t: ReadingTranslator;
};

export function NextSteps({ items, t }: NextStepsProps) {
  const visibleItems = items.slice(0, 2);
  const additionalItems = items.slice(2);

  function renderItems(values: ReadingNextStep[], offset = 0) {
    return values.map((item, index) => (
      <li className="reading-editorial-list__item" key={`${item.title}-${item.body.slice(0, 16)}`}>
        <span className="reading-editorial-list__index" aria-hidden="true">{String(offset + index + 1).padStart(2, "0")}</span>
        <div>
          <h4 className="text-base font-medium text-ivory">{item.title}</h4>
          <p className="mt-2 max-w-[70ch] text-sm leading-7 text-ivory/72">{item.body}</p>
        </div>
      </li>
    ));
  }

  return (
    <section className="reading-section reading-section--next-steps brand-reading-section reading-surface px-5 py-7 sm:px-9 sm:py-8" aria-labelledby="reading-next-steps">
      <h3 id="reading-next-steps" className="text-lg font-medium tracking-[-0.02em] text-ivory">
        {t("reading.nextSteps")}
      </h3>
      <ol className="reading-editorial-list mt-5">
        {renderItems(visibleItems)}
      </ol>
      {additionalItems.length > 0 && (
        <details className="reading-light-disclosure mt-4">
          <summary className="min-h-11 cursor-pointer list-none py-3 text-sm text-antique-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-antique-gold focus-visible:ring-inset">
            <span>{t("reading.showMore")}</span><span className="ml-2 text-ivory/45" aria-hidden="true">＋</span>
          </summary>
          <ol className="reading-editorial-list" start={3}>
            {renderItems(additionalItems, 2)}
          </ol>
        </details>
      )}
    </section>
  );
}
