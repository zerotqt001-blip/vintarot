"use client";

import CardMark from "@/components/card-mark";
import { useLanguage } from "@/components/language";
import { useEffect, useState, type FormEvent } from "react";
import { cardSlug, cards, guidebookGroups, shuffleDeck, type Card, type GuidebookGroup } from "@/lib/tarot";
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
} from "lucide-react";

export function CardFace({
  card,
  reversed = false,
}: {
  card: Card;
  reversed?: boolean;
}) {
  return (
    <img
      className={"tarot-face" + (reversed ? " reversed-card" : "")}
      src={card.image}
      alt={card.name + (reversed ? " reversed" : "")}
      loading="lazy"
      draggable={false}
    />
  );
}

export function CardDetail({
  card,
  onClose,
  closeHref,
}: {
  card: Card | null;
  onClose: () => void;
  closeHref?: string;
}) {
  const { t } = useLanguage();
  const [reverse, setReverse] = useState(false);
  useEffect(() => setReverse(false), [card]);
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
            <DialogDescription>{card?.keywords}</DialogDescription>
          </div>
          {closeHref && <a className="card-detail-back" href={closeHref}>{t("common.back")}</a>}
        </div>
        {card && (
          <>
            <div className="card-reading">
              <CardFace card={card} reversed={reverse} />
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
                <p>{reverse ? card.reversed : card.upright}</p>
                <h3>{t("pages.questionSit")}</h3>
                <p>{t("pages.recognize")}</p>
              </div>
            </div>
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
  return <Library section="guidebook" initialCard={card} closeHref="/guidebook" />;
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
                <CardFace card={card} />
                <span>{card.name}</span>
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
    <div className="empty">
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
    </div>
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
  if (section === "decks" || section === "guidebook") return <Library section={section} />;
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

function Library({ section, initialCard = null, closeHref }: { section: string; initialCard?: Card | null; closeHref?: string }) {
  const { t } = useLanguage();
  const [query, setQuery] = useState("");
  const [suit, setSuit] = useState("All");
  const [detail, setDetail] = useState<Card | null>(initialCard);
  const [deck, setDeck] = useState(false);
  const [openGroup, setOpenGroup] = useState<GuidebookGroup | null>(null);
  const groups = [
    ["All", "pages.all"],
    ["Major Arcana", "pages.majorArcana"],
    ["Wands", "pages.wands"],
    ["Cups", "pages.cups"],
    ["Swords", "pages.swords"],
    ["Pentacles", "pages.pentacles"],
  ] as const;
  const filteredCards = cards.filter(
    (card) =>
      (suit === "All" || card.suit === suit) &&
      card.name.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <>
      <div className="library-hero">
        <Tabs value={section} onValueChange={(value) => (location.href = "/" + value)}>
          <TabsList>
            <TabsTrigger value="guidebook">{t("pages.guidebook")}</TabsTrigger>
            <TabsTrigger value="decks">{t("pages.decks")}</TabsTrigger>
          </TabsList>
        </Tabs>
        {section === "decks" ? (
          <div className="library-intro">
            <div>
              <h1>{t("pages.digitalDecks")}</h1>
              <p>{t("pages.digitalDecksText")}</p>
              <button className="button peach" onClick={() => setDeck(true)}>
                {t("pages.aboutArtist")}
              </button>
            </div>
            <div className="display-fan">
              {[2, 17, 19].map((id) => (
                <CardFace key={id} card={cards[id]} />
              ))}
            </div>
          </div>
        ) : (
          <>
            <h1>{t("pages.meanings")}</h1>
            <p className="intro-copy">{t("pages.meaningsText")}</p>
          </>
        )}
      </div>
      {section === "decks" ? (
        <>
          <button className="deck-product" onClick={() => setDeck(true)}>
            <div className="deck-art">
              {[0, 1, 2].map((id) => (
                <CardFace key={id} card={cards[id]} />
              ))}
            </div>
            <h2>Rider Waite Smith</h2>
            <p>Pamela Colman Smith · 78 {t("common.cards")}</p>
            <span className="included">✓ {t("room.included")}</span>
          </button>
          <p className="attribution">
            {t("pages.artworkAttribution")}{" "}
            <a href="/ATTRIBUTION.md" target="_blank">
              {t("pages.artworkCredits")}
            </a>
          </p>
          <Dialog open={deck} onOpenChange={setDeck}>
            <DialogContent>
              <DialogTitle>Rider Waite Smith</DialogTitle>
              <DialogDescription>{t("pages.deckArtist")}</DialogDescription>
              <div className="deck-modal-art">
                <CardFace card={cards[2]} />
                <p>
                  {t("pages.deckDescription")}
                  <br />
                  <br />
                  {t("pages.deckSource")}
                </p>
              </div>
              <a className="button black" href="/room">
                {t("pages.useDeck")}
              </a>
              <a className="button" href="/guidebook">
                {t("pages.browseGuidebook")}
              </a>
            </DialogContent>
          </Dialog>
        </>
      ) : (
        <>
          {section === "guidebook" ? (
            <>
              <div className="guidebook-groups" aria-label={t("pages.chooseGroup")}>
                {guidebookGroups.map((group) => (
                  <button className="guidebook-group-card" key={group.suit} onClick={() => setOpenGroup(group)}>
                    <div className="guidebook-group-art" aria-hidden="true">
                      {group.previewIds.map((id) => <CardFace key={id} card={cards[id]} />)}
                    </div>
                    <h2>{t(groupLabelKey(group.suit))}</h2>
                    <p>{t(groupDescriptionKey(group.suit))}</p>
                    <small>{t(groupElementKey(group.suit)).toUpperCase()}</small>
                  </button>
                ))}
              </div>
              <Dialog open={!!openGroup} onOpenChange={() => setOpenGroup(null)}>
                <DialogContent className="guidebook-group-dialog">
                  <DialogTitle>{openGroup && t(groupLabelKey(openGroup.suit))}</DialogTitle>
                  <DialogDescription>{openGroup && t(groupDescriptionKey(openGroup.suit))}</DialogDescription>
                  <div className="guidebook-card-grid">
                    {openGroup?.cardIds.map((id) => {
                      const card = cards[id];
                      return (
                        <a key={card.id} className="guidebook-card-link" href={`/guidebook/${cardSlug(card)}`}>
                          <CardFace card={card} />
                          <span>{card.name}</span>
                        </a>
                      );
                    })}
                  </div>
                </DialogContent>
              </Dialog>
            </>
          ) : (
            <>
              <div className="library-tools">
                <label className="search">
                  <Search size={18} />
                  <input
                    aria-label={t("pages.searchCards")}
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder={t("pages.findCard")}
                  />
                </label>
                <div className="suit-tabs">
                  {groups.map(([value, key]) => (
                    <button
                      className={suit === value ? "selected" : ""}
                      onClick={() => setSuit(value)}
                      key={value}
                    >
                      {t(key)}
                    </button>
                  ))}
                </div>
              </div>
              <div className="card-grid">
                {filteredCards.map((card) => (
                  <button
                    key={card.id}
                    className="library-card"
                    onClick={() => setDetail(card)}
                  >
                    <CardFace card={card} />
                    <span>{card.name}</span>
                    <small>{card.suit}</small>
                  </button>
                ))}
              </div>
              {!filteredCards.length && <div className="empty">{t("pages.noMatch")}</div>}
              <CardDetail card={detail} onClose={() => setDetail(null)} />
            </>
          )}
          {section === "guidebook" && <CardDetail card={detail} onClose={() => setDetail(null)} closeHref={closeHref} />}
        </>
      )}
    </>
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
  return (
    <div className="daily-view">
      <a className="button back-home" href="/">
        <ArrowLeft size={15} /> {t("common.home")}
      </a>
      <span className="pill">{t("pages.daily")}</span>
      <div className="daily-frame">
        <div className="daily-cards">
          {labels.map((label, index) => (
            <div key={label}>
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
                  <span className="flip-front">
                    {draw.length > 0 && <CardFace card={cards[draw[index]]} />}
                  </span>
                </span>
              </button>
            </div>
          ))}
        </div>
      </div>
      <p>{flipped.every(Boolean) ? t("pages.dailyExplore") : t("pages.dailyReady")}</p>
      {flipped.every(Boolean) && (
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
  const { t } = useLanguage();
  const [id, setId] = useState(0);
  const [shown, setShown] = useState(false);
  const [text, setText] = useState("");
  const [message, setMessage] = useState("");
  useEffect(() => setId(shuffleDeck()[0]), []);
  return (
    <>
      <Header title={t("pages.practiceTitle")} text={t("pages.practiceText")} />
      <div className="practice-panel">
        <div>
          <CardFace card={cards[id]} />
          <button className="button" onClick={() => { setId(shuffleDeck()[0]); setText(""); setShown(false); setMessage(""); }}>{t("pages.practiceAnother")}</button>
        </div>
        <div>
          <h2>{t("pages.standsOut")}</h2>
          <p>{t("pages.practicePrompt")}</p>
          <textarea aria-label={t("pages.interpretation")} rows={6} value={text} onChange={(event) => setText(event.target.value)} placeholder={t("pages.writeInterpretation")} />
          <div className="form-actions">
            <button className="button" onClick={() => setShown(!shown)}>{shown ? t("pages.hideMeaning") : t("pages.revealMeaning")}</button>
            <button className="button black" disabled={!text.trim()} onClick={async () => {
              try {
                await api("records", { kind: "journal", data: { question: "Practice: " + cards[id].name, notes: text, cards: [{ id, reversed: false }] } });
                setMessage(t("pages.saveStatus"));
              } catch (error: any) { setMessage(error.message); }
            }}>{t("pages.saveReflection")}</button>
          </div>
          {shown && <div className="meaning-block"><h2>{cards[id].name}</h2><p>{cards[id].upright}</p></div>}
          <p role="status">{message}</p>
        </div>
      </div>
      <div className="empty">
        <h2>{t("pages.readTogether")}</h2>
        <p>{t("pages.readTogetherText")}</p>
        <a className="button" href="/room">{t("pages.createRoom")}</a>
      </div>
    </>
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
          <div className="tiny-top">VinTarot <span>{t("pages.yourTarotRoom")}</span></div>
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
