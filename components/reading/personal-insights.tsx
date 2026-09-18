import type { ReadingInsight, ReadingTranslator } from "./reading-types";

type PersonalInsightsProps = {
  items: ReadingInsight[];
  t: ReadingTranslator;
};

export function PersonalInsights({ items, t }: PersonalInsightsProps) {
  return (
    <section className="reading-section reading-section--personal-insights brand-reading-section reading-surface px-5 py-6 sm:px-7" aria-labelledby="reading-personal-insights">
      <h3 id="reading-personal-insights" className="text-lg font-medium tracking-[-0.02em] text-ivory">
        {t("reading.personalInsights")}
      </h3>
      <ul className="mt-5 divide-y divide-antique-gold/15 border-y border-antique-gold/15">
        {items.map((item) => (
          <li className="py-5 first:pt-4 last:pb-4" key={`${item.title}-${item.body.slice(0, 16)}`}>
            <h4 className="text-base font-medium text-antique-gold">{item.title}</h4>
            <p className="mt-2 max-w-[70ch] text-sm leading-7 text-ivory/76">{item.body}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
