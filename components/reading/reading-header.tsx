import type { ReadingSessionMetadata, ReadingTranslator } from "./reading-types";

type ReadingHeaderProps = {
  session: ReadingSessionMetadata;
  t: ReadingTranslator;
};

export function ReadingHeader({ session, t }: ReadingHeaderProps) {
  return (
    <header className="reading-header reading-surface reading-surface--midnight-navy border-b border-antique-gold/20 px-5 py-6 sm:px-7">
      <h2 className="max-w-2xl text-balance text-2xl font-medium tracking-[-0.03em] text-ivory sm:text-3xl">
        {t("reading.title")}
      </h2>
      <p className="mt-3 max-w-[70ch] text-sm leading-7 text-ivory/75">
        {session.readerName ? t("reading.forReader").replace("{name}", session.readerName) : t("reading.forYou")}
      </p>
      {(session.spreadName || session.deckName) && (
        <dl className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-xs tracking-[0.08em] text-antique-gold/85 uppercase">
          {session.spreadName && (
            <div>
              <dt className="sr-only">{t("reading.spreadLabel")}</dt>
              <dd>{session.spreadName}</dd>
            </div>
          )}
          {session.deckName && (
            <div>
              <dt className="sr-only">{t("reading.deckLabel")}</dt>
              <dd>{session.deckName}</dd>
            </div>
          )}
        </dl>
      )}
    </header>
  );
}
