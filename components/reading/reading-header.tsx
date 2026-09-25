import type { ReadingSessionMetadata, ReadingTranslator } from "./reading-types";

type ReadingHeaderProps = {
  session: ReadingSessionMetadata;
  t: ReadingTranslator;
};

export function ReadingHeader({ session, t }: ReadingHeaderProps) {
  return (
    <header className="reading-header brand-reading-header reading-surface reading-surface--midnight-navy px-5 py-7 sm:px-9 sm:py-9">
      <p className="reading-header__title max-w-2xl text-balance text-2xl font-medium tracking-[-0.03em] text-ivory sm:text-3xl">
        {t("reading.resultEyebrow")}
      </p>
      <h2 className="reading-header__question mt-4 max-w-[30ch] text-balance text-2xl leading-[1.18] text-ivory sm:text-[clamp(1.8rem,3.1vw,2.7rem)]">
        {session.question}
      </h2>
      {session.readerName && (
        <p className="reading-header__context mt-4 max-w-[60ch] text-sm leading-7 text-ivory/65">
          {t("reading.forReader").replace("{name}", session.readerName)}
        </p>
      )}
      {(session.spreadName || session.deckName) && (
        <dl className="reading-header__meta mt-7 flex flex-wrap gap-x-6 gap-y-2 text-[0.68rem] tracking-[0.14em] text-antique-gold/85 uppercase">
          {session.spreadName && (
            <div className="reading-header__positions" data-reading-meta="positions">
              <dt className="sr-only">{t("reading.spreadLabel")}</dt>
              <dd>{session.spreadName}</dd>
            </div>
          )}
          {session.deckName && (
            <div className="reading-header__deck" data-reading-meta="deck">
              <dt className="sr-only">{t("reading.deckLabel")}</dt>
              <dd>{session.deckName}</dd>
            </div>
          )}
        </dl>
      )}
    </header>
  );
}
