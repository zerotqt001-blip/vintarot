import type { ReadingTranslator } from "./reading-types";

type ReflectionPromptsProps = {
  prompts: string[];
  onSelect: (prompt: string) => void;
  t: ReadingTranslator;
};

export function ReflectionPrompts({ prompts, onSelect, t }: ReflectionPromptsProps) {
  return (
    <section className="reading-section reading-section--reflection-prompts brand-reading-section reading-surface px-5 py-4 sm:px-9" aria-labelledby="reading-reflection-prompts">
      <details className="reading-light-disclosure">
        <summary id="reading-reflection-prompts" className="min-h-11 cursor-pointer list-none py-3 text-base text-ivory focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-antique-gold focus-visible:ring-inset">
          <span>{t("reading.reflectionPrompts")}</span><span className="ml-2 text-antique-gold" aria-hidden="true">＋</span>
        </summary>
        <div className="grid gap-2 pb-4 pt-3">
          {prompts.map((prompt) => (
            <button
              className="min-h-11 rounded-lg px-3 py-2 text-left text-sm leading-6 text-ivory/78 transition-colors hover:bg-antique-gold/10 hover:text-ivory focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-antique-gold focus-visible:ring-inset motion-reduce:transition-none"
              key={prompt}
              type="button"
              onClick={() => onSelect(prompt)}
            >
              {prompt}
            </button>
          ))}
        </div>
      </details>
    </section>
  );
}
