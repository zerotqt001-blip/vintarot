"use client";

import CardMark from "@/components/card-mark";
import { useLanguage } from "@/components/language";
import { Panel } from "@/components/ui/panel";
import { useEffect, useRef, useState, type CSSProperties, type FormEvent } from "react";
import { cardMeaning, cardNarrative, cardSlug, cards, guidebookGroups, guidebookMapLayout, shuffleDeck, type Card, type GuidebookGroup } from "@/lib/tarot";
import { api } from "@/lib/client";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar } from "@/components/ui/calendar";
import {
  Search,
  ArrowLeft,
  ArrowRight,
  Plus,
  BookOpen,
  Moon,
  Check,
  CalendarDays,
  Video,
  User,
  RotateCcw,
  Sparkles,
  Users,
} from "lucide-react";

export function CardFace({
  card,
  reversed = false,
  source = "moonlight",
}: {
  card: Card;
  reversed?: boolean;
  source?: "local" | "moonlight";
}) {
  return (
    <img
      className={"tarot-face" + (reversed ? " reversed-card" : "")}
      src={source === "moonlight" ? card.moonlightImage : card.image}
      alt={card.name + (reversed ? " reversed" : "")}
      loading="lazy"
      draggable={false}
      onError={(event) => {
        if (source !== "moonlight") return;
        event.currentTarget.onerror = null;
        event.currentTarget.src = card.image;
      }}
    />
  );
}

export function CardDetail({
  card,
  onClose,
  closeHref,
  source = "local",
}: {
  card: Card | null;
  onClose: () => void;
  closeHref?: string;
  source?: "local" | "moonlight";
}) {
  const { t, locale } = useLanguage();
  const [reverse, setReverse] = useState(false);
  useEffect(() => setReverse(false), [card]);
  const localized = card ? cardMeaning(card, locale) : null;
  const narrative = card ? cardNarrative(card, locale, reverse ? "reversed" : "upright") : null;
  const close = () => {
    if (closeHref) {
      location.href = closeHref;
      return;
    }
    onClose();
  };
  return (
    <Dialog open={!!card} onOpenChange={close}>
      <DialogContent className="card-detail">
        <div className="card-detail-head">
          <div>
            <DialogTitle>{card && (reverse ? `${card.name} (${t("pages.reversed")})` : card.name)}</DialogTitle>
            <DialogDescription>{localized?.keywords}</DialogDescription>
          </div>
          {closeHref && <a className="card-detail-back" href={closeHref}>{t("common.back")}</a>}
        </div>
        {card && (
          <>
            <div className="card-reading">
              <CardFace card={card} reversed={reverse} source={source} />
              <div>
                <Tabs
                  value={reverse ? "reverse" : "upright"}
                  onValueChange={(value) => setReverse(value === "reverse")}
                >
                  <TabsList>
                    <TabsTrigger value="upright">{t("pages.upright")}</TabsTrigger>
                    <TabsTrigger value="reverse">{t("pages.reversed")}</TabsTrigger>
                  </TabsList>
                </Tabs>
                <p>{localized && (reverse ? localized.reversed : localized.upright)}</p>
                <h3>{t("pages.questionSit")}</h3>
                <p>{t("pages.recognize")}</p>
              </div>
            </div>
            {narrative && (
              <div className="card-narrative">
                <p className="card-summary">{narrative.summary}</p>
                {narrative.sections.map((section) => (
                  <section className="card-narrative-section" key={section.key}>
                    <h3>{section.title}</h3>
                    <p>{section.body}</p>
                  </section>
                ))}
              </div>
            )}
            <a href={"/room?card=" + card.id} className="button black">
              {t("pages.exploreRoom")}
            </a>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function GuidebookCardPage({ card }: { card: Card }) {
  return <ImmersiveCardDetail card={card} />;
}

export function CardPicker({
  open,
  onClose,
  onSelect,
  exclude = [],
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (id: number) => void;
  exclude?: number[];
}) {
  const { t } = useLanguage();
  const [query, setQuery] = useState("");
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="picker-dialog">
        <DialogTitle>{t("pages.chooseCard")}</DialogTitle>
        <DialogDescription>{t("pages.searchAll")}</DialogDescription>
        <input
          autoFocus
          aria-label={t("pages.searchCards")}
          placeholder={t("pages.searchCards") + "…"}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <div className="picker-grid">
          {cards
            .filter(
              (card) =>
                card.name.toLowerCase().includes(query.toLowerCase()) &&
                !exclude.includes(card.id),
            )
            .map((card) => (
              <button
                key={card.id}
                onClick={() => {
                  onSelect(card.id);
                  onClose();
                }}
              >
                <CardFace card={card} source="moonlight" />
                <span>{card.caption}</span>
              </button>
            ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function SignIn() {
  const { t } = useLanguage();
  return (
    <Panel tone="elevated" className="empty sign-in-panel">
      <Moon size={34} />
      <h2>{t("pages.yourSpace")}</h2>
      <p>{t("pages.signInText")}</p>
      <a
        className="button black"
        href="/signin-with-chatgpt?return_to=/profile"
        target="_top"
      >
        {t("common.signIn")}
      </a>
    </Panel>
  );
}

export default function Pages({
  section,
  user,
}: {
  section: string;
  user: { name: string; email: string } | null;
}) {
  const { t } = useLanguage();
  if (section === "decks" || section === "guidebook") return <Library />;
  if (section === "daily-spread") return <Daily user={user} />;
  if (section === "game") return <Game user={user} />;
  if (section === "journal") return <Journal user={user} />;
  if (section === "community") return <Practice user={user} />;
  if (section === "profile") return <Profile user={user} />;
  if (section === "book") return <Book />;
  if (!user) return <SignIn />;
  if (section === "bookings")
    return (
      <>
        <Header title={t("pages.bookings")} text={t("pages.bookingsText")} />
        <div className="empty">
          <CalendarDays size={36} />
          <h2>{t("pages.noSessions")}</h2>
          <p>{t("pages.bookingText")}</p>
          <a className="button" href="/book">
            {t("pages.exploreReadings")}
          </a>
        </div>
      </>
    );
  return <Invites />;
}

function Header({ title, text }: { title: string; text?: string }) {
  return (
    <header className="page-head">
      <h1>{title}</h1>
      {text && <p>{text}</p>}
    </header>
  );
}

const groupLabelKeys: Record<GuidebookGroup["suit"], string> = {
  "Major Arcana": "pages.majorArcana",
  Wands: "pages.wands",
  Cups: "pages.cups",
  Swords: "pages.swords",
  Pentacles: "pages.pentacles",
};
const groupLabelKey = (suit: GuidebookGroup["suit"]) => groupLabelKeys[suit];

const groupDescriptionKeys: Record<GuidebookGroup["suit"], string> = {
  "Major Arcana": "pages.majorDescription",
  Wands: "pages.wandsDescription",
  Cups: "pages.cupsDescription",
  Swords: "pages.swordsDescription",
  Pentacles: "pages.pentaclesDescription",
};
const groupDescriptionKey = (suit: GuidebookGroup["suit"]) => groupDescriptionKeys[suit];

const groupElementKeys: Record<GuidebookGroup["suit"], string> = {
  "Major Arcana": "pages.heroJourney",
  Wands: "pages.fire",
  Cups: "pages.water",
  Swords: "pages.air",
  Pentacles: "pages.earth",
};
const groupElementKey = (suit: GuidebookGroup["suit"]) => groupElementKeys[suit];

const guidebookGroupSlug = (suit: GuidebookGroup["suit"]) =>
  suit.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

function Library() {
  return <GuidebookLibrary />;
}

function GuidebookLibrary() {
  const section = "guidebook";
  const { t } = useLanguage();
  const [view, setView] = useState<"worlds" | "library">("worlds");
  const [selectedSuit, setSelectedSuit] = useState<GuidebookGroup["suit"] | null>(null);
  const [query, setQuery] = useState("");
  const [orientation, setOrientation] = useState<"all" | "upright" | "reversed">("all");
  const [sort, setSort] = useState<"classic" | "alphabetical">("classic");

  useEffect(() => {
    const syncFromUrl = () => {
      const groupParam = new URLSearchParams(window.location.search).get("group");
      if (!groupParam) {
        setSelectedSuit(null);
        setView("worlds");
        return;
      }
      const group = guidebookGroups.find((item) => guidebookGroupSlug(item.suit) === groupParam);
      setSelectedSuit(group?.suit ?? null);
      setView("library");
    };
    syncFromUrl();
    window.addEventListener("popstate", syncFromUrl);
    return () => window.removeEventListener("popstate", syncFromUrl);
  }, []);

  const selectGroup = (group: GuidebookGroup | null) => {
    setSelectedSuit(group?.suit ?? null);
    setView("library");
    window.history.pushState({}, "", `/guidebook?group=${group ? guidebookGroupSlug(group.suit) : "all"}`);
  };
  const selectedGroup = selectedSuit ? guidebookGroups.find((group) => group.suit === selectedSuit) ?? null : null;
  const baseCards = selectedGroup ? selectedGroup.cardIds.map((id) => cards[id]) : cards;
  const filteredCards = baseCards
    .filter((card) => card.name.toLowerCase().includes(query.trim().toLowerCase()))
    .sort((a, b) => sort === "alphabetical" ? a.name.localeCompare(b.name) : a.id - b.id);
  const cardHref = (card: Card) => `/guidebook/${cardSlug(card)}?group=${selectedGroup ? guidebookGroupSlug(selectedGroup.suit) : "all"}`;

  if (view === "library") {
    return (
      <div className="guidebook-cosmic-page guidebook-library-page" data-section={section}>
        <div className="guidebook-page-topline">
          <button className="guidebook-back-link" type="button" onClick={() => { setView("worlds"); setSelectedSuit(null); window.history.pushState({}, "", "/guidebook"); }}>
            <ArrowLeft size={16} /> {t("pages.backToFamilies")}
          </button>
          <span>{t("pages.libraryKicker")}</span>
        </div>
        <section className="guidebook-library-intro">
          <div>
            <span className="guidebook-kicker">{selectedGroup ? t(groupElementKey(selectedGroup.suit)).toUpperCase() : t("pages.allCards").toUpperCase()}</span>
            <h1>{selectedGroup ? t(groupLabelKey(selectedGroup.suit)) : t("pages.allCards")}</h1>
            <p>{selectedGroup ? t(groupDescriptionKey(selectedGroup.suit)) : t("pages.meaningsText")}</p>
            <small>{baseCards.length} {t("common.cards")} · {t("pages.deckArtist")}</small>
          </div>
          <div className="guidebook-library-fan" aria-hidden="true">
            {(selectedGroup?.previewIds ?? [0, 17, 19]).map((id) => <CardFace key={id} card={cards[id]} source="moonlight" />)}
          </div>
        </section>
        <div className="guidebook-library-layout">
          <aside className="guidebook-families" aria-label={t("pages.chooseGroup")}>
            <span>{t("pages.familyLabel")}</span>
            <button type="button" className={!selectedGroup ? "selected" : ""} onClick={() => selectGroup(null)}>{t("pages.allCards")} <small>78</small></button>
            {guidebookGroups.map((group) => (
              <button type="button" className={selectedSuit === group.suit ? "selected" : ""} onClick={() => selectGroup(group)} key={group.suit}>
                <span>{t(groupLabelKey(group.suit))}</span><small>{group.cardIds.length}</small>
              </button>
            ))}
            <div className="guidebook-family-quote">“{t("pages.cardsQuote")}”</div>
          </aside>
          <section className="guidebook-library-content" aria-label={t("pages.meanings")}>
            <div className="guidebook-toolbar">
              <label className="guidebook-search">
                <Search size={16} />
                <input aria-label={t("pages.searchCards")} value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("pages.searchGuidebook")} />
              </label>
              <div className="guidebook-filters" role="group" aria-label={t("pages.readingFilter")}>
                {(["all", "upright", "reversed"] as const).map((value) => (
                  <button type="button" className={orientation === value ? "selected" : ""} onClick={() => setOrientation(value)} key={value}>
                    {value === "all" ? t("pages.all") : value === "upright" ? t("pages.upright") : t("pages.reversed")}
                  </button>
                ))}
              </div>
              <label className="guidebook-sort">
                <span className="sr-only">{t("pages.sortCards")}</span>
                <select aria-label={t("pages.sortCards")} value={sort} onChange={(event) => setSort(event.target.value as "classic" | "alphabetical")}>
                  <option value="classic">{t("pages.classicOrder")}</option>
                  <option value="alphabetical">{t("pages.alphabetical")}</option>
                </select>
              </label>
            </div>
            <p className="guidebook-result-count">{filteredCards.length} / {baseCards.length} {t("common.cards")}</p>
            <div className="guidebook-card-grid">
              {filteredCards.map((card) => (
                <a key={card.id} className="guidebook-card-link" href={cardHref(card)} aria-label={`${card.name} · ${t("pages.openCard")}`}>
                  <span className="guidebook-card-art"><CardFace card={card} reversed={orientation === "reversed"} source="moonlight" /></span>
                  <strong>{card.name}</strong>
                  <small>{card.caption}</small>
                </a>
              ))}
            </div>
            {!filteredCards.length && <div className="guidebook-empty">{t("pages.noMatch")}</div>}
          </section>
        </div>
      </div>
    );
  }

  return (
    <div className="guidebook-cosmic-page guidebook-worlds-page" data-section={section}>
      <section className="guidebook-worlds-hero">
        <span className="guidebook-kicker">{t("pages.cardsHeroKicker")}</span>
        <h1>{t("pages.cardsHeroTitle")}</h1>
        <p>{t("pages.cardsHeroDescription")}</p>
      </section>
      <div className="guidebook-world-map" aria-label={t("pages.chooseGroup")}>
        <div className="guidebook-world-orbit guidebook-world-orbit-one" />
        <div className="guidebook-world-orbit guidebook-world-orbit-two" />
        <div className="guidebook-world-center">
          <span>{t("pages.chooseGroup")}</span>
          <strong>5</strong>
          <small>78 {t("common.cards")}</small>
        </div>
        {guidebookMapLayout.map((layout) => {
          const group = guidebookGroups.find((item) => item.suit === layout.suit);
          if (!group) return null;
          return (
            <button type="button" className={`guidebook-world-node guidebook-world-node-${layout.position}`} style={{ "--world-accent": layout.accent } as CSSProperties} key={group.suit} onClick={() => selectGroup(group)} aria-label={`${t(groupLabelKey(group.suit))}: ${group.cardIds.length} ${t("common.cards")}`}>
              <span className="guidebook-world-node-art">{group.previewIds.map((id) => <CardFace key={id} card={cards[id]} source="moonlight" />)}</span>
              <span className="guidebook-world-node-copy"><strong>{t(groupLabelKey(group.suit))}</strong><small>{t(groupDescriptionKey(group.suit))}</small><em>{group.cardIds.length} {t("common.cards")} · {t(groupElementKey(group.suit))}</em></span>
            </button>
          );
        })}
      </div>
      <p className="guidebook-worlds-hint">{t("pages.meaningsText")}</p>
    </div>
  );
}

function ImmersiveCardDetail({ card }: { card: Card }) {
  const { t, locale } = useLanguage();
  const familyCards = cards.filter((item) => item.suit === card.suit);
  const [activeIndex, setActiveIndex] = useState(Math.max(0, familyCards.findIndex((item) => item.id === card.id)));
  const [reverse, setReverse] = useState(false);
  const [direction, setDirection] = useState<"next" | "prev" | "">("");
  const touchStart = useRef<number | null>(null);
  const activeCard = familyCards[activeIndex] ?? card;
  const localized = cardMeaning(activeCard, locale);
  const narrative = cardNarrative(activeCard, locale, reverse ? "reversed" : "upright");
  const canPrev = activeIndex > 0;
  const canNext = activeIndex < familyCards.length - 1;

  useEffect(() => {
    setReverse(false);
    window.history.replaceState({}, "", `/guidebook/${cardSlug(activeCard)}?group=${guidebookGroupSlug(activeCard.suit as GuidebookGroup["suit"])}`);
    const timer = window.setTimeout(() => setDirection(""), 520);
    return () => window.clearTimeout(timer);
  }, [activeCard, card]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLElement && (event.target.tagName === "INPUT" || event.target.tagName === "TEXTAREA" || event.target.isContentEditable)) return;
      if (event.key === "ArrowLeft" && canPrev) { event.preventDefault(); moveCard(-1); }
      if (event.key === "ArrowRight" && canNext) { event.preventDefault(); moveCard(1); }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  function moveCard(step: -1 | 1) {
    const nextIndex = activeIndex + step;
    if (nextIndex < 0 || nextIndex >= familyCards.length) return;
    setDirection(step > 0 ? "next" : "prev");
    setActiveIndex(nextIndex);
  }

  return (
    <div className="guidebook-card-detail-page" onTouchStart={(event) => { touchStart.current = event.touches[0]?.clientX ?? null; }} onTouchEnd={(event) => { const start = touchStart.current; const end = event.changedTouches[0]?.clientX ?? start ?? 0; touchStart.current = null; if (start === null || Math.abs(end - start) < 55) return; if (end < start) moveCard(1); else moveCard(-1); }}>
      <div className="guidebook-detail-topline">
        <a href={`/guidebook?group=${guidebookGroupSlug(activeCard.suit as GuidebookGroup["suit"])}`}><ArrowLeft size={17} /> {t("pages.backToLibrary")}</a>
        <span>{t("pages.detailKicker")}</span>
        <a className="guidebook-detail-close" href={`/guidebook?group=${guidebookGroupSlug(activeCard.suit as GuidebookGroup["suit"])}`} aria-label={t("common.back")}>×</a>
      </div>
      <div className={`guidebook-detail-layout ${direction ? `is-${direction}` : ""}`}>
        <section className="guidebook-detail-visual" aria-label={activeCard.name}>
          <button type="button" className="guidebook-detail-arrow guidebook-detail-arrow-prev" disabled={!canPrev} onClick={() => moveCard(-1)} aria-label={t("pages.previousCard")}><ArrowLeft size={23} /></button>
          <div className="guidebook-detail-card-frame"><CardFace card={activeCard} reversed={reverse} source="moonlight" /></div>
          <button type="button" className="guidebook-detail-arrow guidebook-detail-arrow-next" disabled={!canNext} onClick={() => moveCard(1)} aria-label={t("pages.nextCard")}><ArrowRight size={23} /></button>
          <div className="guidebook-detail-thumbs" aria-label={t("pages.nearbyCards")}>
            {familyCards.slice(Math.max(0, activeIndex - 2), activeIndex + 3).map((item) => (
              <button type="button" className={item.id === activeCard.id ? "selected" : ""} key={item.id} onClick={() => setActiveIndex(familyCards.findIndex((candidate) => candidate.id === item.id))} aria-label={item.name}><CardFace card={item} source="moonlight" /></button>
            ))}
          </div>
        </section>
        <article className="guidebook-detail-copy">
          <span className="guidebook-kicker">{t(groupLabelKey(activeCard.suit as GuidebookGroup["suit"]))} · {activeIndex + 1} / {familyCards.length}</span>
          <h1>{activeCard.name}</h1>
          <p className="guidebook-detail-keywords">{localized.keywords}</p>
          <div className="guidebook-orientation" role="tablist" aria-label={t("pages.readingFilter")}>
            <button type="button" className={!reverse ? "selected" : ""} onClick={() => setReverse(false)} role="tab" aria-selected={!reverse}>{t("pages.upright")}</button>
            <button type="button" className={reverse ? "selected" : ""} onClick={() => setReverse(true)} role="tab" aria-selected={reverse}>{t("pages.reversed")}</button>
          </div>
          <p className="guidebook-detail-meaning">{reverse ? localized.reversed : localized.upright}</p>
          <div className="guidebook-narrative">
            <p className="guidebook-summary">{narrative.summary}</p>
            <div className="guidebook-narrative-grid">
              {narrative.sections.map((section) => <section key={section.key}><h2>{section.title}</h2><p>{section.body}</p></section>)}
            </div>
          </div>
          <a className="guidebook-reading-cta" href={`/room?card=${activeCard.id}`}>{t("pages.exploreRoom")} <ArrowRight size={16} /></a>
        </article>
      </div>
    </div>
  );
}

function Daily({ user }: { user: any }) {
  const { t } = useLanguage();
  const [draw, setDraw] = useState<number[]>([]);
  const [flipped, setFlipped] = useState<boolean[]>([false, false]);
  const [detail, setDetail] = useState<Card | null>(null);
  const [message, setMessage] = useState("");
  const [saved, setSaved] = useState(false);
  useEffect(() => setDraw(shuffleDeck().slice(0, 2)), []);
  async function save() {
    try {
      await api("records", {
        kind: "journal",
        data: {
          question: "Social battery check",
          notes: "How social I feel like being / How social I need to be",
          cards: draw.map((id) => ({ id, reversed: false })),
        },
      });
      setSaved(true);
      setMessage(t("pages.saveStatus"));
    } catch (error: any) {
      setMessage(error.message);
    }
  }
  const labels = [t("pages.dailyFeel"), t("pages.dailyNeed")];
  const complete = flipped.every(Boolean);
  return (
    <div className="daily-view daily-cosmic-page">
      <a className="button daily-back-link" href="/">
        <ArrowLeft size={15} /> {t("common.home")}
      </a>
      <header className="daily-hero">
        <div className="daily-ornament" aria-hidden="true"><span />✦<span /></div>
        <h1>{t("pages.daily")}</h1>
        <p>{t("pages.dailyReady")}</p>
      </header>
      <section className="daily-stage" aria-label={t("pages.daily")}>
        <div className="daily-cards">
          {labels.map((label, index) => (
            <div className="daily-card-slot" key={label}>
              <p>{label}:</p>
              <button
                className={"flip-card " + (flipped[index] ? "flipped" : "")}
                aria-label={
                  flipped[index]
                    ? cards[draw[index]]?.name
                    : t("pages.revealCard") + " " + (index + 1)
                }
                onClick={() => {
                  if (flipped[index]) setDetail(cards[draw[index]]);
                  else setFlipped((value) => value.map((item, i) => (i === index ? true : item)));
                }}
              >
                <span className="flip-inner">
                  <span className="card-back flip-back">
                    <CardMark />
                  </span>
                  <span className="flip-front" aria-hidden={!flipped[index]}>
                    {draw.length > 0 && <CardFace card={cards[draw[index]]} />}
                  </span>
                </span>
              </button>
            </div>
          ))}
        </div>
      </section>
      <section className={"daily-reflection" + (complete ? " is-complete" : "")} aria-live="polite">
        <div className="daily-reflection-icon" aria-hidden="true"><Sparkles size={18} strokeWidth={1.4} /></div>
        <div className="daily-reflection-copy">
          <strong>{complete ? t("pages.dailyExplore") : t("pages.dailyReady")}</strong>
          {complete && (
            <div className="daily-result">
              <h2>{t("pages.reflect")}</h2>
              <p>{t("pages.reflectText")}</p>
              {user ? (
                <button className="button black" disabled={saved} onClick={save}>
                  {saved ? t("pages.savedReflection") : t("pages.saveJournal")}
                </button>
              ) : (
                <a className="button" href="/signin-with-chatgpt?return_to=/daily-spread" target="_top">
                  {t("common.signIn")}
                </a>
              )}
            </div>
          )}
        </div>
      </section>
      <p className="status" role="status">{message}</p>
      <CardDetail card={detail} onClose={() => setDetail(null)} />
    </div>
  );
}

const puzzles = [
  { clue: "A new beginning asks you to trust a small spark of hope.", answer: [0, 17] },
  { clue: "Clear boundaries make room for a nurturing kind of care.", answer: [4, 3] },
  { clue: "A quiet pause reveals what your intuition already knows.", answer: [9, 2] },
  { clue: "An old structure falls, making space for a new chapter.", answer: [16, 13] },
  { clue: "Patience and courage bring a difficult moment into balance.", answer: [8, 14] },
];

function Game({ user }: { user: any }) {
  const { t } = useLanguage();
  const [round, setRound] = useState(0);
  const [choices, setChoices] = useState<number[]>([]);
  const [picker, setPicker] = useState<number | null>(null);
  const [history, setHistory] = useState<{ ids: number[]; correct: number }[]>([]);
  const [rules, setRules] = useState(false);
  const [message, setMessage] = useState("");
  const puzzle = puzzles[round];
  const won = history.some((item) => item.correct === 2);
  const finished = won || history.length === 5;
  async function guess() {
    if (choices.length !== 2 || finished) return;
    const correct = choices.filter((id) => puzzle.answer.includes(id)).length;
    const next = [...history, { ids: [...choices], correct }];
    setHistory(next);
    setChoices([]);
    if (user && (correct === 2 || next.length === 5)) {
      try {
        await api("records", {
          kind: "game",
          data: { day: new Date().toISOString().slice(0, 10), guesses: next.length, won: correct === 2, round },
        });
      } catch (error: any) {
        setMessage(error.message);
      }
    }
  }
  return (
    <div className="game-view">
      <h2>PAIROT</h2>
      <h1>{t("pages.pairTitle")}</h1>
      <button className="soft-button" onClick={() => setRules(true)}>{t("pages.howToPlay")}</button>
      <p className="muted">{t("pages.dailyPuzzle")} {round + 1} OF 5</p>
      <p className="game-clue">{puzzle.clue}</p>
      <div className="game-selection">
        {[0, 1].map((index) => (
          <button key={index} disabled={finished} onClick={() => setPicker(index)} aria-label={t("pages.chooseCardNumber") + " " + (index + 1)}>
            {choices[index] !== undefined ? <CardFace card={cards[choices[index]]} /> : <Plus size={18} />}
          </button>
        ))}
      </div>
      {choices.length === 2 && !finished && <button className="button black" onClick={guess}>{t("pages.checkPair")}</button>}
      <p className="muted">{won ? t("pages.foundPair") : 5 - history.length + " " + t("pages.guessesLeft")}</p>
      <div className="guess-history">
        {history.map((item, index) => (
          <div key={index}>
            <span>{cards[item.ids[0]].name}</span>
            <span>{cards[item.ids[1]].name}</span>
            <small>{item.correct}/2 {t("pages.gameMatched")}</small>
          </div>
        ))}
      </div>
      {finished && (
        <div className="game-end">
          <h2>{won ? t("pages.gameConnected") : t("pages.gameNewWay")}</h2>
          <p>{puzzle.answer.map((id) => cards[id].name).join(" + ")}</p>
          {round < 4 ? (
            <button className="button" onClick={() => { setRound(round + 1); setHistory([]); setChoices([]); }}>
              {t("pages.nextPuzzle")} <ArrowRight size={15} />
            </button>
          ) : (
            <a className="button" href="/guidebook">{t("pages.exploreGuidebook")}</a>
          )}
        </div>
      )}
      <p role="status">{message}</p>
      <CardPicker
        open={picker !== null}
        onClose={() => setPicker(null)}
        exclude={choices}
        onSelect={(id) => setChoices((value) => { const next = [...value]; next[picker ?? 0] = id; return next; })}
      />
      <Dialog open={rules} onOpenChange={setRules}>
        <DialogContent>
          <DialogTitle>{t("pages.gameRulesTitle")}</DialogTitle>
          <DialogDescription>{t("pages.gameRulesText")}</DialogDescription>
          <button className="button black" onClick={() => setRules(false)}>{t("pages.gamePlay")}</button>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Journal({ user }: { user: any }) {
  const { t, locale } = useLanguage();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [open, setOpen] = useState(false);
  const [picker, setPicker] = useState(false);
  const [question, setQuestion] = useState("");
  const [notes, setNotes] = useState("");
  const [chosen, setChosen] = useState<{ id: number; reversed: boolean }[]>([]);
  const [edit, setEdit] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  async function load() {
    try {
      const result = await api("records?kind=journal");
      setItems(result.items);
    } catch (error: any) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { if (user) load(); }, [user]);
  async function save(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      await api("records", { id: edit, kind: "journal", data: { question, notes, cards: chosen } });
      setOpen(false);
      setMessage(t("pages.savedReflection"));
      await load();
    } catch (error: any) {
      setMessage(error.message);
    } finally {
      setBusy(false);
    }
  }
  if (!user) return <SignIn />;
  return (
    <>
      <div className="journal-head">
        <Header title={t("pages.yourJournal")} text={t("pages.journalText")} />
        <button className="button" onClick={() => { setEdit(undefined); setQuestion(""); setNotes(""); setChosen([]); setOpen(true); }}>
          {t("pages.physicalEntry")}
        </button>
      </div>
      <p role="status" className="status">{message}</p>
      {loading ? (
        <p className="empty">{t("pages.openingJournal")}</p>
      ) : items.length === 0 ? (
        <div className="empty">
          <BookOpen size={36} />
          <h2>{t("pages.nextChapter")}</h2>
          <p>{t("pages.journalEmpty")}</p>
          <a className="button black" href="/room">{t("common.openRoom")}</a>
        </div>
      ) : (
        <div className="journal-grid">
          {items.map((item) => (
            <button className="journal-entry" key={item.id} onClick={() => { setEdit(item.id); setQuestion(item.question); setNotes(item.notes); setChosen(item.cards); setOpen(true); }}>
              <time>{new Date(item.created).toLocaleDateString(locale === "vi" ? "vi-VN" : "en-GB", { day: "numeric", month: "long", year: "numeric" })}</time>
              <h2>{item.question}</h2>
              <div className="mini-cards">{item.cards.map((card: any) => <CardFace key={card.id} card={cards[card.id]} reversed={card.reversed} />)}</div>
              <p>{item.notes}</p>
              <span>{t("pages.openReflection")}</span>
            </button>
          ))}
        </div>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="journal-dialog">
          <DialogTitle>{edit ? t("pages.yourReflection") : t("pages.physicalQuestion")}</DialogTitle>
          <DialogDescription>{t("pages.keepCards")}</DialogDescription>
          <form onSubmit={save}>
            <label>{t("pages.questionSit")}<input required maxLength={500} value={question} onChange={(event) => setQuestion(event.target.value)} placeholder={t("pages.journalQuestionPlaceholder")} /></label>
            <label>{t("pages.reflection")}<textarea rows={5} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder={t("pages.journalReflectionPlaceholder")} /></label>
            <label>{t("pages.cardsCount")} ({chosen.length}/10)</label>
            <div className="chosen-cards">
              {chosen.map((card, index) => (
                <div key={card.id + "-" + index}>
                  <CardFace card={cards[card.id]} reversed={card.reversed} />
                  <button type="button" onClick={() => setChosen((value) => value.map((item, i) => i === index ? { ...item, reversed: !item.reversed } : item))}>{t("common.reverse")}</button>
                  <button type="button" onClick={() => setChosen((value) => value.filter((_, i) => i !== index))}>{t("common.remove")}</button>
                </div>
              ))}
              {chosen.length < 10 && <button type="button" className="button" onClick={() => setPicker(true)}><Plus size={16} /> {t("pages.addCard")}</button>}
            </div>
            <p role="status">{message}</p>
            <div className="form-actions">
              <button type="button" className="button" onClick={() => setOpen(false)}>{t("common.cancel")}</button>
              <button className="button black" disabled={busy}>{busy ? t("common.saving") : t("common.save")}</button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
      <CardPicker open={picker} onClose={() => setPicker(false)} exclude={chosen.map((card) => card.id)} onSelect={(id) => setChosen((value) => [...value, { id, reversed: false }])} />
    </>
  );
}

function Practice({ user }: { user: any }) {
  const { t, locale } = useLanguage();
  const [id, setId] = useState(0);
  const [shown, setShown] = useState(false);
  const [text, setText] = useState("");
  const [message, setMessage] = useState("");
  const [cardChanging, setCardChanging] = useState(false);
  const changeTimer = useRef<number | undefined>(undefined);
  useEffect(() => setId(shuffleDeck()[0]), []);
  useEffect(() => () => {
    if (changeTimer.current !== undefined) window.clearTimeout(changeTimer.current);
  }, []);

  function changeCard() {
    if (cardChanging) return;
    setCardChanging(true);
    changeTimer.current = window.setTimeout(() => {
      setId(shuffleDeck()[0]);
      setText("");
      setShown(false);
      setMessage("");
      window.requestAnimationFrame(() => setCardChanging(false));
    }, 250);
  }

  return (
    <section className="practice-cosmic-page" aria-label={t("pages.practiceTitle")}>
      <div className="practice-celestial-scene" aria-hidden="true">
        <div className="practice-scene-layer practice-scene-sky" />
        <div className="practice-scene-layer practice-scene-stars" />
        <div className="practice-scene-layer practice-scene-nebula" />
        <div className="practice-scene-layer practice-scene-architecture" />
        <div className="practice-scene-layer practice-scene-floor" />
        <div className="practice-scene-layer practice-scene-vignette" />
      </div>
      <div className="practice-content">
        <div className="practice-hero">
          <div className="practice-moon-phases" aria-hidden="true"><span>☾</span><span>◐</span><span>●</span><span>◑</span><span>☽</span></div>
          <Header title={t("pages.practiceTitle")} text={t("pages.practiceText")} />
          <div className="practice-divider" aria-hidden="true"><span />✦<span /></div>
        </div>
        <div className="practice-panel practice-composition">
          <div className={`practice-card-stage ${cardChanging ? "practice-card-swap" : ""}`} aria-live="polite">
            <div className="practice-card-geometry" aria-hidden="true"><span /><span /><span /><i>✦</i><b>✦</b></div>
            <div key={id} className="practice-card-frame">
              <CardFace card={cards[id]} />
            </div>
            <button className="button practice-change-card" disabled={cardChanging} onClick={changeCard}>
              <RotateCcw size={16} strokeWidth={1.4} />
              {t("pages.practiceAnother")}
            </button>
          </div>
          <div className="practice-reflection">
            <p className="practice-eyebrow">{t("pages.practiceTitle")}</p>
            <div className="practice-heading-row"><h2>{t("pages.standsOut")}</h2><span aria-hidden="true">✦</span></div>
            <p className="practice-prompt">{t("pages.practicePrompt")}</p>
            <div className="practice-textarea-wrap">
              <textarea aria-label={t("pages.interpretation")} maxLength={500} rows={6} value={text} onChange={(event) => setText(event.target.value)} placeholder={t("pages.writeInterpretation")} />
              <span aria-hidden="true">{text.length}/500</span>
            </div>
            <div className="form-actions practice-actions">
              <button className="button practice-reveal" type="button" aria-expanded={shown} onClick={() => setShown(!shown)}>
                <BookOpen size={17} strokeWidth={1.35} />
                {shown ? t("pages.hideMeaning") : t("pages.revealMeaning")}
              </button>
              <button className="button black practice-save" type="button" disabled={!text.trim()} onClick={async () => {
                try {
                  await api("records", { kind: "journal", data: { question: "Practice: " + cards[id].name, notes: text, cards: [{ id, reversed: false }] } });
                  setMessage(t("pages.saveStatus"));
                } catch (error: any) { setMessage(error.message); }
              }}>
                <Sparkles size={17} strokeWidth={1.35} />
                {t("pages.saveReflection")}
              </button>
            </div>
            {shown && <div className="meaning-block practice-interpretation"><h2>{cards[id].name}</h2><p>{cardMeaning(cards[id], locale).upright}</p></div>}
            <p role="status" className="practice-status">{message}</p>
          </div>
        </div>
        <div className="practice-community-card">
          <div className="practice-community-visual" aria-hidden="true">
            <div className="practice-community-orbit"><span>✦</span><i>✦</i></div>
            <BookOpen size={74} strokeWidth={0.75} />
          </div>
          <div className="practice-community-copy">
            <p className="practice-eyebrow">{t("pages.readTogether")}</p>
            <h2>{t("pages.readTogether")}</h2>
            <p>{t("pages.readTogetherText")}</p>
            <a className="button practice-room-cta" href="/room"><Users size={17} strokeWidth={1.35} />{t("pages.createRoom")}</a>
          </div>
        </div>
      </div>
    </section>
  );
}

function Profile({ user }: { user: any }) {
  const { t, locale, setLocale } = useLanguage();
  const [name, setName] = useState(user?.name || "");
  const [bio, setBio] = useState("");
  const [timezone, setTimezone] = useState("Asia/Ho_Chi_Minh");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (user)
      api("records?kind=profile")
        .then((result) => {
          if (result.items[0]) {
            const profile = result.items[0];
            setName(profile.name);
            setBio(profile.bio);
            setTimezone(profile.timezone);
          }
        })
        .catch((error) => setMessage(error.message));
  }, [user]);
  if (!user) return <SignIn />;
  return (
    <>
      <Header title={t("pages.yourSpace")} text={t("pages.yourSpaceText")} />
      <form className="profile-form" onSubmit={async (event) => {
        event.preventDefault();
        setBusy(true);
        try {
          await api("records", { kind: "profile", data: { name, bio, timezone, language: locale === "vi" ? "Tiếng Việt" : "English" } });
          setMessage(t("pages.profileSaved"));
        } catch (error: any) { setMessage(error.message); }
        finally { setBusy(false); }
      }}>
        <div className="profile-avatar"><Moon size={43} /></div>
        <label>{t("pages.displayName")}<input value={name} required maxLength={80} onChange={(event) => setName(event.target.value)} /></label>
        <label>{t("pages.email")}<input readOnly value={user.email} /></label>
        <label>{t("pages.aboutYou")}<textarea value={bio} rows={4} onChange={(event) => setBio(event.target.value)} /></label>
        <label>{t("common.language")}<select value={locale} onChange={(event) => setLocale(event.target.value === "vi" ? "vi" : "en")}><option value="en">English</option><option value="vi">Tiếng Việt</option></select></label>
        <label>{t("pages.timezone")}<select value={timezone} onChange={(event) => setTimezone(event.target.value)}>{["Asia/Ho_Chi_Minh", "Asia/Bangkok", "Asia/Singapore", "Europe/London", "America/New_York", "America/Los_Angeles", "UTC"].map((zone) => <option key={zone}>{zone}</option>)}</select></label>
        <button className="button black" disabled={busy}>{busy ? t("common.saving") : t("pages.saveProfile")}</button>
        <p role="status">{message}</p>
      </form>
      <div className="service-status">
        <h2>{t("pages.services")}</h2>
        <p><Check size={16} />{t("pages.tarotService")}</p>
        <p><span className="pending-dot" />{t("pages.videoPending")}</p>
        <p><span className="pending-dot" />{t("pages.paymentPending")}</p>
        <p><span className="pending-dot" />{t("pages.emailPending")}</p>
        <p><span className="pending-dot" />{t("pages.membersPending")}</p>
      </div>
    </>
  );
}

function Book() {
  const { t, locale } = useLanguage();
  const [date, setDate] = useState<Date | undefined>();
  const [open, setOpen] = useState(false);
  const sessions = [
    [t("pages.sessionFresh"), t("pages.minutes30")],
    [t("pages.sessionDeep"), t("pages.minutes60")],
    [t("pages.sessionLearn"), t("pages.minutes60")],
  ];
  return (
    <>
      <section className="booking-hero">
        <div>
          <h1>{t("pages.bookingHero")}<br />{t("pages.bookingHeroLine")}</h1>
          <p>{t("pages.bookingIntro")}</p>
          <button className="button black" onClick={() => setOpen(true)}>{t("pages.exploreSessions")}</button>
        </div>
        <div className="booking-illustration">
          <div className="tiny-top">NaTarot <span>{t("pages.yourTarotRoom")}</span></div>
          <div className="tiny-avatars"><Moon /><User /></div>
          <div className="tiny-spread">{[2, 17, 19].map((id) => <CardFace key={id} card={cards[id]} />)}</div>
        </div>
      </section>
      <div className="empty">
        <h2>{t("pages.readingRoomReady")}</h2>
        <p>{t("pages.bookingClosedText")}</p>
        <a className="button" href="/room">{t("pages.startOwnRoom")}</a>
      </div>
      <div className="session-options">
        {sessions.map(([name, duration]) => <button key={name} onClick={() => setOpen(true)}><Video size={22} /><h2>{name}</h2><p>{duration}</p><span>{t("pages.exploreSession")}</span></button>)}
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="booking-dialog">
          <DialogTitle>{t("pages.planReading")}</DialogTitle>
          <DialogDescription>{t("pages.calendarPreview")}</DialogDescription>
          <Calendar mode="single" selected={date} onSelect={setDate} disabled={(day) => day < new Date(new Date().setHours(0, 0, 0, 0))} />
          <p>{date ? date.toLocaleDateString(locale === "vi" ? "vi-VN" : "en-GB", { dateStyle: "full" }) : t("pages.chooseDay")}</p>
          <p className="notice">{t("pages.bookingNotice")}</p>
          <button disabled className="button black">{t("pages.bookingNotOpen")}</button>
        </DialogContent>
      </Dialog>
    </>
  );
}

function Invites() {
  const { t, locale } = useLanguage();
  const [items, setItems] = useState<any[]>([]);
  const [message, setMessage] = useState("");
  useEffect(() => { api("rooms").then((result) => setItems(result.items)).catch((error) => setMessage(error.message)); }, []);
  return (
    <>
      <Header title={t("pages.yourRooms")} text={t("pages.yourRoomsText")} />
      <p className="notice">{t("pages.privateSite")}</p>
      <p role="status">{message}</p>
      {items.length ? (
        <div className="room-list">
          {items.map((room) => <a key={room.id} href={"/room?id=" + room.id}><Moon size={24} /><div><h2>{room.state.question || t("pages.roomsFallback")}</h2><p>{room.state.cards.length} {t("pages.roomCards")} · {new Date(room.updated).toLocaleDateString(locale === "vi" ? "vi-VN" : undefined)}</p></div><ArrowRight size={20} /></a>)}
        </div>
      ) : (
        <div className="empty">
          <Moon size={34} />
          <h2>{t("pages.sharedRitual")}</h2>
          <p>{t("pages.roomsEmpty")}</p>
          <a className="button black" href="/room">{t("pages.createRoom")}</a>
        </div>
      )}
    </>
  );
}
