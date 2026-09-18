'use client';

import { useState } from "react";
import { splitReadingParagraphs } from "@/lib/reading-text";
import { DirectAnswer } from "./direct-answer";
import { FollowUpReading } from "./follow-up-reading";
import { NextSteps } from "./next-steps";
import { PersonalInsights } from "./personal-insights";
import { ReadingHeader } from "./reading-header";
import { ReflectionPrompts } from "./reflection-prompts";
import { TarotEvidence } from "./tarot-evidence";
import type { ReadingPanelProps } from "./reading-types";

export function ReadingPanel({
  reading,
  locale,
  session,
  artworkByReadingCardId,
  t,
  isLoading = false,
  error = null,
  onClose,
  onSave,
  onFollowUpSubmit,
  followUpResetKey = 0,
}: ReadingPanelProps) {
  const [followUpQuestion, setFollowUpQuestion] = useState("");
  const hasFollowUp = Boolean(onFollowUpSubmit);

  return (
    <aside className="reading-panel reading-panel--midnight-navy relative flex max-h-full min-h-0 flex-col overflow-hidden bg-midnight-navy text-ivory shadow-[0_20px_70px_rgba(4,10,30,0.36)]" aria-label={t("reading.panelLabel")}>
      <ReadingHeader session={session} t={t} />
      <div className="reading-panel__scroll min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <p className="reading-question border-b border-antique-gold/15 px-5 py-5 text-sm leading-7 text-ivory/80 sm:px-7">
          <span className="mr-2 font-medium text-antique-gold">{t("reading.questionLabel")}</span>
          {session.question}
        </p>

        {reading ? (
          <>
            {(isLoading || error) && (
              <div className="reading-status px-5 pt-5 sm:px-7" aria-live="polite" aria-busy={isLoading}>
                {isLoading && <p className="text-sm text-antique-gold">{t("reading.loading")}</p>}
                {error && <p className="mt-2 text-sm leading-6 text-rose-200" role="alert">{error}</p>}
              </div>
            )}
            <DirectAnswer paragraphs={splitReadingParagraphs(reading.directAnswer)} t={t} />
            <PersonalInsights items={reading.personalInsights} t={t} />
            <ReflectionPrompts prompts={reading.reflectionPrompts} onSelect={setFollowUpQuestion} t={t} />
            <NextSteps items={reading.nextSteps} t={t} />
            <TarotEvidence items={reading.cardEvidence} artwork={artworkByReadingCardId} locale={locale} t={t} />
            {reading.deeperReading && (
              <section className="reading-section reading-section--deeper-reading border-t border-antique-gold/15 px-5 py-6 sm:px-7" aria-labelledby="reading-deeper-reading">
                <h3 id="reading-deeper-reading" className="text-lg font-medium tracking-[-0.02em] text-ivory">
                  {t("reading.deeperReading")}
                </h3>
                <p className="mt-4 max-w-[70ch] whitespace-pre-line text-sm leading-7 text-ivory/78">{reading.deeperReading}</p>
              </section>
            )}
            {hasFollowUp && (
              <FollowUpReading
                key={followUpResetKey}
                suggestions={reading.followUpSuggestions}
                question={followUpQuestion}
                onQuestionChange={setFollowUpQuestion}
                onSubmit={onFollowUpSubmit!}
                resetEpoch={followUpResetKey}
                t={t}
              />
            )}
          </>
        ) : isLoading ? (
          <div className="reading-status px-5 pt-8 sm:px-7" aria-live="polite" aria-busy="true">
            <p className="text-sm text-antique-gold">{t("reading.loading")}</p>
          </div>
        ) : error ? (
          <div className="reading-status px-5 pt-8 sm:px-7" aria-live="polite">
            <p className="text-sm leading-6 text-rose-200" role="alert">{error}</p>
          </div>
        ) : (
          <section className="reading-empty px-5 py-8 sm:px-7" aria-labelledby="reading-empty-title">
            <h3 id="reading-empty-title" className="text-lg font-medium text-ivory">{t("reading.emptyTitle")}</h3>
            <p className="mt-3 max-w-[65ch] text-sm leading-7 text-ivory/70">{t("reading.emptyDescription")}</p>
          </section>
        )}
      </div>
      <footer className="reading-panel__actions flex shrink-0 flex-wrap gap-2 border-t border-antique-gold/20 bg-midnight-navy/90 px-5 py-4 sm:px-7">
        {onSave && (
          <button
            className="min-h-11 rounded-xl border border-antique-gold/35 px-4 text-sm text-ivory hover:border-antique-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-antique-gold focus-visible:ring-offset-2 focus-visible:ring-offset-midnight-navy disabled:cursor-not-allowed disabled:opacity-45 motion-reduce:transition-none"
            type="button"
            onClick={onSave}
            disabled={!reading}
          >
            {t("reading.save")}
          </button>
        )}
        {onClose && (
          <button
            className="min-h-11 rounded-xl px-4 text-sm text-ivory/75 hover:bg-ivory/10 hover:text-ivory focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-antique-gold focus-visible:ring-offset-2 focus-visible:ring-offset-midnight-navy motion-reduce:transition-none"
            type="button"
            onClick={onClose}
            aria-label={t("reading.close")}
          >
            {t("reading.close")}
          </button>
        )}
      </footer>
    </aside>
  );
}
