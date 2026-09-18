import type { ReadingTranslator } from "./reading-types";

type ReflectionPromptsProps = {
  prompts: string[];
  onSelect: (prompt: string) => void;
  t: ReadingTranslator;
};

export function ReflectionPrompts({ prompts, onSelect, t }: ReflectionPromptsProps) {
  return (
    <section className="reading-section reading-section--reflection-prompts px-5 py-6 sm:px-7" aria-labelledby="reading-reflection-prompts">
      <h3 id="reading-reflection-prompts" className="text-lg font-medium tracking-[-0.02em] text-ivory">
        {t("reading.reflectionPrompts")}
      </h3>
      <div className="mt-4 grid gap-2">
        {prompts.map((prompt) => (
          <button
            className="min-h-11 rounded-xl border border-antique-gold/25 px-4 py-2 text-left text-sm leading-6 text-ivory/85 transition-colors hover:border-antique-gold/60 hover:bg-antique-gold/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-antique-gold focus-visible:ring-offset-2 focus-visible:ring-offset-midnight-navy motion-reduce:transition-none"
            key={prompt}
            type="button"
            onClick={() => onSelect(prompt)}
          >
            {prompt}
          </button>
        ))}
      </div>
    </section>
  );
}
