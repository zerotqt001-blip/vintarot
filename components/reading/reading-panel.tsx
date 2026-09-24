'use client';

import { useState } from "react";
import { splitReadingParagraphs } from "@/lib/reading-text";
import { DirectAnswer } from "./direct-answer";
import { FollowUpReading } from "./follow-up-reading";
import { NextSteps } from "./next-steps";
import { PersonalInsights } from "./personal-insights";
import { ReadingHeader } from "./reading-header";
import { ReadingSpread } from "./reading-spread";
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
  isSaving = false,
  error = null,
  onClose,
  onSave,
  onShare,
  isSharing = false,
  shareUrl = null,
  shareError = null,
  onFollowUpSubmit,
  onClarificationSubmit,
  followUpResetKey = 0,
}: ReadingPanelProps) {
  const [followUpQuestion, setFollowUpQuestion] = useState("");
  const hasFollowUp = Boolean(onFollowUpSubmit);
  const actions = (
    <div className="reading-panel__actions flex min-w-0 shrink-0 flex-wrap gap-2 border-t border-antique-gold/20 bg-midnight-navy/90 px-5 py-4 sm:px-9">
      {onShare && (
        <button
          className="reading-action min-h-11 rounded-full border border-antique-gold/45 px-5 text-sm text-ivory hover:border-antique-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-antique-gold focus-visible:ring-offset-2 focus-visible:ring-offset-midnight-navy disabled:cursor-not-allowed disabled:opacity-45 motion-reduce:transition-none"
          type="button"
          onClick={() => { void onShare(); }}
          disabled={!reading || isSaving || isSharing}
          aria-busy={isSharing}
        >
          {isSharing ? t("reading.sharing") : t("reading.share")}
        </button>
      )}
      {onSave && (
        <button
          className="reading-action reading-action--primary min-h-11 rounded-full border border-antique-gold/45 px-5 text-sm text-ivory hover:border-antique-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-antique-gold focus-visible:ring-offset-2 focus-visible:ring-offset-midnight-navy disabled:cursor-not-allowed disabled:opacity-45 motion-reduce:transition-none"
          type="button"
          onClick={onSave}
          disabled={!reading || isSaving}
        >
          {isSaving ? t("common.saving") : t("reading.save")}
        </button>
      )}
      {onClose && (
        <button
          className="reading-action reading-action--close min-h-11 rounded-full px-4 text-sm text-ivory/65 hover:bg-ivory/10 hover:text-ivory focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-antique-gold focus-visible:ring-offset-2 focus-visible:ring-offset-midnight-navy motion-reduce:transition-none"
          type="button"
          onClick={onClose}
          aria-label={t("reading.close")}
        >
          {t("reading.close")}
        </button>
      )}
      {(shareUrl || shareError) && (
        <div className="min-w-0 basis-full pt-1" aria-live="polite">
          {shareUrl && (
            <label className="block min-w-0 text-xs text-ivory/70">
              <span className="sr-only">{t("reading.shareReady")}</span>
              <input
                className="mt-1 block min-h-10 w-full min-w-0 overflow-hidden text-ellipsis whitespace-nowrap rounded-lg border border-antique-gold/30 bg-midnight-navy px-3 text-xs text-ivory outline-none focus-visible:ring-2 focus-visible:ring-antique-gold"
                type="url"
                readOnly
                value={shareUrl}
                aria-label={t("share.copyLink")}
                onFocus={(event) => event.currentTarget.select()}
              />
            </label>
          )}
          {shareError && <p className="mt-2 text-sm leading-6 text-rose-200" role="alert">{shareError}</p>}
        </div>
      )}
    </div>
  );

  return (
    <aside className="reading-panel brand-panel brand-reading-panel reading-surface reading-panel--midnight-navy reading-panel--editorial relative flex max-h-full min-h-0 flex-col overflow-hidden bg-midnight-navy text-ivory shadow-[0_20px_70px_rgba(4,10,30,0.36)]" aria-label={t("reading.panelLabel")}>
      <div className="reading-panel__scroll min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {reading ? (
          <>
            <div className="reading-result-toolbar">{actions}</div>
            <section className="reading-result-overview" aria-label={t("reading.panelLabel")}>
              <ReadingHeader session={session} t={t} />
              <div className="reading-result-overview__rail">
                <dl className="reading-header__meta reading-result-meta">
                  {session.spreadName && (
                    <div className="reading-result-meta__item">
                      <dt>{t("reading.spreadLabel")}</dt>
                      <dd>{session.spreadName}</dd>
                    </div>
                  )}
                  {session.deckName && (
                    <div className="reading-result-meta__item">
                      <dt>{t("reading.deckLabel")}</dt>
                      <dd>{session.deckName}</dd>
                    </div>
                  )}
                  <div className="reading-result-meta__item">
                    <dt>{t("common.cards")}</dt>
                    <dd>{reading.cardEvidence.length}</dd>
                  </div>
                </dl>
              </div>
              {reading.cardEvidence.length > 0 && (
                <ReadingSpread
                  items={reading.cardEvidence}
                  artwork={artworkByReadingCardId}
                  locale={locale}
                  spreadType={session.spreadType}
                  spreadName={session.spreadName}
                  t={t}
                />
              )}
            </section>
            {(isLoading || error) && (
              <div className="reading-status px-5 pt-5 sm:px-7" aria-live="polite" aria-busy={isLoading}>
                {isLoading && <p className="text-sm text-antique-gold">{t("reading.loading")}</p>}
                {error && <p className="mt-2 text-sm leading-6 text-rose-200" role="alert">{error}</p>}
              </div>
            )}
            <div className={`reading-result-content${hasFollowUp ? " reading-result-content--with-follow-up" : ""}`}>
              <div className="reading-result-content__main">
                <div className={`reading-result-reading-grid${reading.deeperReading ? " reading-result-reading-grid--with-depth" : " reading-result-reading-grid--single"}`}>
                  <DirectAnswer paragraphs={splitReadingParagraphs(reading.directAnswer)} t={t} />
                  {reading.deeperReading && (
                    <section className="reading-section reading-section--deeper-reading brand-reading-section" aria-labelledby="reading-deeper-reading">
                      <h3 id="reading-deeper-reading" className="text-lg font-medium tracking-[-0.02em] text-ivory">
                        {t("reading.deeperReading")}
                      </h3>
                      <p className="mt-4 max-w-[70ch] whitespace-pre-line text-sm leading-7 text-ivory/75">{reading.deeperReading}</p>
                    </section>
                  )}
                </div>
                {(reading.personalInsights.length > 0 || reading.nextSteps.length > 0) && (
                  <div className="reading-result-points-grid">
                    {reading.personalInsights.length > 0 && <PersonalInsights items={reading.personalInsights} t={t} />}
                    {reading.nextSteps.length > 0 && <NextSteps items={reading.nextSteps} t={t} />}
                  </div>
                )}
                {(reading.reflectionPrompts.length > 0 || reading.cardEvidence.length > 0) && (
                  <section className="reading-supporting" aria-labelledby="reading-supporting-title">
                    <h3 id="reading-supporting-title" className="reading-supporting__title">{t("reading.supportingMaterial")}</h3>
                    {reading.reflectionPrompts.length > 0 && <ReflectionPrompts prompts={reading.reflectionPrompts} onSelect={setFollowUpQuestion} t={t} />}
                    {reading.cardEvidence.length > 0 && <TarotEvidence items={reading.cardEvidence} artwork={artworkByReadingCardId} locale={locale} t={t} />}
                  </section>
                )}
              </div>
              {hasFollowUp && (
                <div className="reading-result-content__rail">
                  <FollowUpReading
                    key={followUpResetKey}
                    suggestions={reading.followUpSuggestions}
                    question={followUpQuestion}
                    onQuestionChange={setFollowUpQuestion}
                    onSubmit={onFollowUpSubmit!}
                    onClarificationSubmit={onClarificationSubmit}
                    initialClarifications={reading.supplementaryDraws || []}
                    locale={locale}
                    resetEpoch={followUpResetKey}
                    t={t}
                  />
                </div>
              )}
            </div>
          </>
        ) : isLoading ? (
          <>
            <ReadingHeader session={session} t={t} />
            <div className="reading-status px-5 pt-8 sm:px-7" aria-live="polite" aria-busy="true">
              <p className="text-sm text-antique-gold">{t("reading.loading")}</p>
            </div>
          </>
        ) : error ? (
          <>
            <ReadingHeader session={session} t={t} />
            <div className="reading-status px-5 pt-8 sm:px-7" aria-live="polite">
              <p className="text-sm leading-6 text-rose-200" role="alert">{error}</p>
            </div>
          </>
        ) : (
          <>
            <ReadingHeader session={session} t={t} />
            <section className="reading-empty px-5 py-8 sm:px-7" aria-labelledby="reading-empty-title">
              <h3 id="reading-empty-title" className="text-lg font-medium text-ivory">{t("reading.emptyTitle")}</h3>
              <p className="mt-3 max-w-[65ch] text-sm leading-7 text-ivory/70">{t("reading.emptyDescription")}</p>
            </section>
          </>
        )}
      </div>
      {!reading && actions}
    </aside>
  );
}
