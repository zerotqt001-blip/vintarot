'use client';

import { FormEvent, useState } from "react";
import type { ReadingFollowUp, ReadingTranslator } from "./reading-types";

type FollowUpReadingProps = {
  suggestions: string[];
  initialQuestion?: string;
  onSubmit: (question: string) => Promise<string>;
  t: ReadingTranslator;
};

export function FollowUpReading({ suggestions, initialQuestion = "", onSubmit, t }: FollowUpReadingProps) {
  const [question, setQuestion] = useState(initialQuestion);
  const [answers, setAnswers] = useState<ReadingFollowUp[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextQuestion = question.trim();
    if (!nextQuestion || isLoading) {
      if (!nextQuestion) setError(t("reading.followUpEmpty"));
      return;
    }
    setError(null);
    setIsLoading(true);
    try {
      const answer = await onSubmit(nextQuestion);
      setAnswers((current) => [...current, { id: `${Date.now()}-${current.length}`, question: nextQuestion, answer }]);
      setQuestion("");
    } catch {
      setError(t("reading.followUpError"));
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <section className="reading-section reading-section--follow-up px-5 py-6 sm:px-7" aria-labelledby="reading-follow-up">
      <h3 id="reading-follow-up" className="text-lg font-medium tracking-[-0.02em] text-ivory">
        {t("reading.followUp")}
      </h3>
      {suggestions.length > 0 && (
        <div className="mt-4 grid gap-2">
          {suggestions.map((suggestion) => (
            <button
              className="min-h-11 rounded-xl border border-antique-gold/20 px-4 py-2 text-left text-sm leading-6 text-ivory/75 hover:border-antique-gold/55 hover:text-ivory focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-antique-gold focus-visible:ring-offset-2 focus-visible:ring-offset-midnight-navy motion-reduce:transition-none"
              key={suggestion}
              type="button"
              onClick={() => setQuestion(suggestion)}
            >
              {suggestion}
            </button>
          ))}
        </div>
      )}
      <form className="mt-5 grid gap-3 sm:grid-cols-[1fr_auto]" onSubmit={submit}>
        <label className="sr-only" htmlFor="reading-follow-up-question">{t("reading.followUpInput")}</label>
        <input
          className="min-h-11 rounded-xl border border-antique-gold/25 bg-midnight-navy/55 px-4 text-sm text-ivory outline-none placeholder:text-ivory/45 focus-visible:ring-2 focus-visible:ring-antique-gold focus-visible:ring-offset-2 focus-visible:ring-offset-midnight-navy"
          id="reading-follow-up-question"
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder={t("reading.followUpInput")}
          disabled={isLoading}
        />
        <button
          className="min-h-11 rounded-xl bg-antique-gold px-5 text-sm font-medium text-midnight-navy transition-colors hover:bg-antique-gold/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ivory focus-visible:ring-offset-2 focus-visible:ring-offset-midnight-navy disabled:cursor-not-allowed disabled:opacity-55 motion-reduce:transition-none"
          type="submit"
          disabled={isLoading}
        >
          {isLoading ? t("reading.followUpLoading") : t("reading.followUpSubmit")}
        </button>
      </form>
      <div className="mt-4 min-h-6 text-sm" aria-live="polite" aria-busy={isLoading}>
        {isLoading && <p className="text-antique-gold">{t("reading.followUpLoading")}</p>}
        {error && <p className="text-rose-200" role="alert">{error}</p>}
      </div>
      {answers.length > 0 && (
        <ol className="mt-2 space-y-5" aria-label={t("reading.followUpAnswers")}>
          {answers.map((entry) => (
            <li className="reading-follow-up-answer border-t border-antique-gold/15 pt-4" key={entry.id}>
              <p className="text-sm font-medium text-antique-gold">{entry.question}</p>
              <p className="mt-2 max-w-[70ch] text-sm leading-7 text-ivory/78">{entry.answer}</p>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
