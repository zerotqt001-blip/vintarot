import cardKnowledge from "../../natarot-knowledge/v5/cards/all-78-cards.json";
import curatedPairs from "../../natarot-knowledge/v5/combinations/curated-pairs.json";
import triadPatterns from "../../natarot-knowledge/v5/combinations/triad-patterns.json";
import humanStyleExamples from "../../natarot-knowledge/v5/examples/human-style-50-complete.json";
import type {
  TarotCombinationHint,
  TarotFewShotExample,
  TarotLocale,
  TarotMeaningEvidence,
  TarotOrientation,
  TarotRetrievedGuidance,
} from "./types";

export const TAROT_KNOWLEDGE_VERSION = "5.0" as const;

type V5Side = {
  core_expression?: string;
  baseline?: string;
  lenses?: string[];
  lens_guide?: Record<string, string>;
};

type V5Card = {
  id: string;
  name_en: string;
  name_vi: string;
  arcana: string;
  suit: string | null;
  core: Record<string, string>;
  upright: V5Side;
  reversed: V5Side;
  context_rules?: Record<string, string>;
  contexts?: Record<string, { upright?: string; reversed?: string }>;
  position_modifiers?: Record<string, string>;
  avoid_overinterpretation?: string[];
  interpretation_checks?: string[];
  master_semantics?: Record<string, string>;
};

type V5Pair = { cards: string[]; signals: string[]; avoid: string[] };
type V5Triad = { name: string; shape: string; read: string };
type V5Example = {
  id: string;
  language: string;
  domain: string;
  question: string;
  spread: [string, string, TarotOrientation][];
  overview: string;
  connections: string;
  guidance: string;
  closing: string;
};

const cards = (cardKnowledge.cards as unknown as V5Card[]);
const pairs = (curatedPairs.curated_pairs as unknown as V5Pair[]);
const triads = (triadPatterns.patterns as unknown as V5Triad[]);
const examples = (humanStyleExamples.readings as unknown as V5Example[]);

if (cards.length !== 78) throw new Error("NaTarot Knowledge V5 must contain exactly 78 cards.");

function normalize(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/gi, " ")
    .trim()
    .toLowerCase();
}

const cardByName = new Map<string, V5Card>();
for (const card of cards) {
  const key = normalize(card.name_en);
  if (!key || cardByName.has(key)) throw new Error(`Duplicate V5 Tarot card name: ${card.name_en}`);
  cardByName.set(key, card);
}

function unique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function semanticParts(value: string | undefined): string[] {
  if (!value) return [];
  return value.split(/,| · /).map((part) => part.trim()).filter(Boolean);
}

function textFrom(values: Array<string | undefined>, fallback: string): string {
  return values.find((value) => Boolean(value?.trim()))?.trim() || fallback;
}

function domainContext(card: V5Card, domain: string, orientation: TarotOrientation): string {
  const context = card.contexts?.[domain];
  return textFrom(
    [context?.[orientation], card.context_rules?.[domain]],
    "Translate the card's archetype into the question domain without turning it into a fixed verdict.",
  );
}

function compactLensGuide(side: V5Side): string {
  const guide = side.lens_guide || {};
  return Object.entries(guide)
    .slice(0, 5)
    .map(([name, explanation]) => `${name}: ${explanation}`)
    .join("; ");
}

function evidenceFor(card: V5Card, orientation: TarotOrientation, domain: string, positionKey: string): TarotMeaningEvidence {
  const side = orientation === "upright" ? card.upright : card.reversed;
  const core = textFrom([card.core.archetype], "the card's central archetype");
  const expression = textFrom([side.core_expression, side.baseline], core);
  const positionModifier = card.position_modifiers?.[positionKey];
  const cautions = unique(card.avoid_overinterpretation || []).slice(0, 2);
  const masterSemantics = Object.values(card.master_semantics || {}).slice(0, 4);
  const context = domainContext(card, domain, orientation);
  const reversalGuidance = orientation === "reversed"
    ? textFrom([side.baseline], "Read the reversal as a contextual change in expression, not as an automatic opposite.")
    : "Keep the upright expression responsive to the position and surrounding cards.";

  return {
    summary: expression,
    energy: core,
    actions: [positionModifier || context],
    relationships: card.contexts?.love?.[orientation] || context,
    work: card.contexts?.career?.[orientation] || context,
    creativity: context,
    home: context,
    symbolism: unique([core, ...masterSemantics]).join("; "),
    journalQuestions: (card.interpretation_checks || []).slice(0, 5),
    keywords: unique([
      ...semanticParts(core),
      ...semanticParts(card.core.rank_theme),
      ...semanticParts(card.core.suit_domain),
    ]).slice(0, 8),
    core,
    contextRule: context,
    positionModifier: positionModifier || "Let the spread position determine the card's job in the story.",
    reversalGuidance: `${reversalGuidance}${orientation === "reversed" && compactLensGuide(side) ? ` Lens guide: ${compactLensGuide(side)}` : ""}`,
    cautions,
    interpretationChecks: (card.interpretation_checks || []).slice(0, 5),
    masterSemantics,
  };
}

export function getV5CardKnowledge(nameEn: string, domain: string, positionKey: string): { card: V5Card; upright: TarotMeaningEvidence; reversed: TarotMeaningEvidence } | null {
  const card = cardByName.get(normalize(nameEn));
  if (!card) return null;
  const normalizedPosition = positionModifierKey(positionKey || "current");
  return {
    card,
    upright: evidenceFor(card, "upright", domain, normalizedPosition),
    reversed: evidenceFor(card, "reversed", domain, normalizedPosition),
  };
}

export function v5CardKeywords(nameEn: string): string[] {
  const card = cardByName.get(normalize(nameEn));
  if (!card) return [];
  return unique([
    ...semanticParts(card.core.archetype),
    ...semanticParts(card.core.rank_theme),
    ...semanticParts(card.core.suit_domain),
  ]).slice(0, 8);
}

function cardSuit(nameEn: string): string | null {
  return cardByName.get(normalize(nameEn))?.suit || null;
}

function positionModifierKey(positionKey: string): string {
  const key = normalize(positionKey).replace(/ /g, "_");
  if (/obstacle|challenge|block|barrier|cost|pressure|risk|tension/.test(key)) return "obstacle";
  if (/hidden|underlying|unseen/.test(key)) return "hidden_factor";
  if (/feeling|emotion|heart/.test(key)) return "feelings";
  if (/intention|motive/.test(key)) return "intentions";
  if (/action|reply|response|next_step|steps|move/.test(key)) return "actions";
  if (/advice|solution|resolve|guidance|direction|approach|how_to|path|bridge|help/.test(key)) return "advice";
  if (/future|forecast|tomorrow|trajectory|outcome|result|leads/.test(key)) return key.includes("outcome") || key.includes("result") ? "outcome" : "future_tendency";
  if (/root|foundation|driver|past|history/.test(key)) return "root";
  return "current";
}

function matchingTriad(names: Set<string>, cardsInReading: Array<{ nameEn: string; positionKey: string }>): V5Triad | null {
  const positionKeys = cardsInReading.map((card) => card.positionKey.toLowerCase());
  const hasBlock = positionKeys.some((key) => /obstacle|challenge|block|barrier|cost|pressure|risk|tension/.test(key));
  const hasAction = positionKeys.some((key) => /action|solution|direction|path|next|future|outcome|flow|advice|approach/.test(key));

  if (names.has(normalize("The Moon")) || names.has(normalize("Seven of Cups")) || names.has(normalize("Two of Swords"))) {
    if (names.has(normalize("Justice")) || names.has(normalize("Ace of Swords")) || names.has(normalize("The Sun"))) {
      return triads.find((pattern) => pattern.name === "uncertainty_to_truth") || null;
    }
  }
  if ((names.has(normalize("The Devil")) || names.has(normalize("Six of Cups")) || names.has(normalize("Four of Pentacles")))
    && (names.has(normalize("Death")) || names.has(normalize("Eight of Cups")) || names.has(normalize("The World")))) {
    return triads.find((pattern) => pattern.name === "attachment_to_release") || null;
  }
  if (hasBlock && hasAction && cardsInReading.some((card) => cardSuit(card.nameEn) === "Cups")) {
    return triads.find((pattern) => pattern.name === "emotion_to_block_to_action") || null;
  }
  return null;
}

export function selectCombinationHints(cardsInReading: Array<{ nameEn: string; positionKey: string }>): TarotCombinationHint[] {
  const names = new Set(cardsInReading.map((card) => normalize(card.nameEn)));
  const pair = pairs.find((candidate) => candidate.cards.length === 2 && candidate.cards.every((name) => names.has(normalize(name))));
  const hints: TarotCombinationHint[] = [];
  if (pair) {
    hints.push({ kind: "pair", cards: pair.cards, signals: pair.signals.slice(0, 3), cautions: pair.avoid.slice(0, 2) });
  }
  const triad = matchingTriad(names, cardsInReading);
  if (triad) hints.push({ kind: "triad", cards: cardsInReading.map((card) => card.nameEn), signals: [triad.read], cautions: [] });
  return hints.slice(0, 2);
}

function exampleScore(example: V5Example, locale: TarotLocale, domain: string, question: string, cardNames: string[], orientations: TarotOrientation[]): number {
  let score = 0;
  if (example.language === locale) score += 8;
  if (example.domain === domain) score += 8;
  if (example.spread.length === cardNames.length) score += 3;
  const exampleReversals = example.spread.filter(([, , orientation]) => orientation === "reversed").length;
  const reversals = orientations.filter((orientation) => orientation === "reversed").length;
  if (exampleReversals === reversals) score += 2;
  if (normalize(example.question) === normalize(question)) score += 20;
  const questionWords = new Set(normalize(question).split(" ").filter((word) => word.length > 3));
  score += [...questionWords].filter((word) => normalize(example.question).includes(word)).length;
  return score;
}

export function selectFewShotExamples(args: {
  locale: TarotLocale;
  domain: string;
  question: string;
  cards: Array<{ nameEn: string; orientation: TarotOrientation }>;
}): TarotFewShotExample[] {
  const drawnNames = new Set(args.cards.map((card) => normalize(card.nameEn)));
  return examples
    // Style references must not introduce another card or target language.
    .filter((example) => example.language === args.locale && example.spread.every(([, name]) => drawnNames.has(normalize(name))))
    .map((example) => ({ example, score: exampleScore(example, args.locale, args.domain, args.question, args.cards.map((card) => card.nameEn), args.cards.map((card) => card.orientation)) }))
    .filter(({ score }) => score >= 8)
    .sort((left, right) => right.score - left.score || left.example.id.localeCompare(right.example.id))
    .slice(0, 2)
    .map(({ example }) => ({
      id: example.id,
      language: example.language === "vi" ? "vi" : "en",
      domain: example.domain,
      question: example.question,
      spread: example.spread.map(([position]) => position).join(" / "),
      cards: example.spread.map(([position, name, orientation]) => `${position}: ${name} (${orientation})`),
      overview: example.overview,
      connections: example.connections,
      guidance: example.guidance,
      closing: example.closing,
    }));
}

export function inferTarotDomain(categoryKey: string, question: string): string {
  const value = normalize(question);
  if (categoryKey === "relationships") return "love";
  if (categoryKey === "business") return "career";
  if (categoryKey === "planning") return "decision";
  if (/career|job|work|role|business|career|cong viec|su nghiep|kinh doanh/.test(value)) return "career";
  if (/money|finance|income|debt|tien|tai chinh|thu nhap/.test(value)) return "money";
  if (/relationship|love|partner|dating|reconcile|ex |moi quan he|tinh cam|nguoi yeu|nguoi cu/.test(value)) return "love";
  if (/should|whether|choose|choice|decision|decide|nen |co nen|lua chon|quyet dinh/.test(value)) return "decision";
  if (/future|upcoming|trajectory|trend|months|weeks|tomorrow|tuong lai|thang toi|sap toi/.test(value)) return "future";
  if (categoryKey === "moon-phase" || categoryKey === "self-care" || categoryKey === "creativity") return "self-reflection";
  return "future";
}

export function v5Guidance(domain: string): TarotRetrievedGuidance {
  const domainLine = domain === "love"
    ? "For relationship questions, translate cards into dynamics, communication, reciprocity, boundaries, and observable behavior; do not issue a yes/no verdict."
    : domain === "career"
      ? "For career questions, translate cards into role, agency, environment, resources, trade-offs, and next moves; avoid guaranteed outcomes."
      : domain === "decision"
        ? "For decisions, show trade-offs and conditions so the reader can choose with agency; do not command a single irreversible action."
        : domain === "future"
          ? "For future tendencies, describe a conditional trajectory if current conditions continue and name what could change it."
          : "For self-reflection, turn the archetype into a capacity, pattern, or practice without diagnosing the reader.";
  return {
    method: [
      "V5 method: question → spread position → card in position → card relationships → whole-spread thesis → grounded guidance.",
      "Position and question outrank generic card lore; use the complete spread before writing any section.",
    ],
    domain: [domainLine],
    reversal: [
      "A reversed card is not automatically bad or opposite; choose a supported lens such as blocked, internalized, excessive, deficient, resisted, or changing.",
      "Use neighboring cards and the position to decide which reversal lens is warranted.",
    ],
    synthesis: [
      "Use relationships such as reinforce, qualify, contrast, sequence, or redirect only when supported by the spread.",
      "Synthesize first, then write per-position interpretations that serve the thesis; do not concatenate dictionary meanings.",
    ],
    safety: [
      "Keep claims conditional and evidence-aware; do not present symbolic cards as proof of private thoughts, diagnoses, legal/medical/financial advice, or certain events.",
    ],
  };
}
