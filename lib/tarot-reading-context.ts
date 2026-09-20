import type { TarotLocale, TarotMeaningEvidence, TarotReadingCardContext, TarotReadingInput } from "./ai/types";
import {
  TAROT_KNOWLEDGE_VERSION,
  getV5CardKnowledge,
  inferTarotDomain,
  selectCombinationHints,
  selectFewShotExamples,
  v5Guidance,
} from "./ai/knowledge-v5";
import type {
  CardMeaningRow,
  ReadingCardWithDetails,
  ReadingSessionRow,
  ReadingTemplateWithPositions,
} from "./tarot-repository";
import { localizedTarotSpreadSemantics } from "./tarot-spread-semantics";

export const MAX_READING_QUESTION_LENGTH = 500;
export const MAX_READING_CONTEXT_LENGTH = 5_000;

type MeaningPair = { upright: CardMeaningRow; reversed: CardMeaningRow };

export type BuildTarotReadingInputArgs = {
  session: ReadingSessionRow;
  cards: ReadingCardWithDetails[];
  template: ReadingTemplateWithPositions;
  meanings: Map<string, MeaningPair>;
  locale: TarotLocale;
};

function boundedText(value: string, max: number, label: string): string {
  const trimmed = value.trim();
  if (!trimmed) throw new Error(`${label} is required`);
  if (trimmed.length > max) throw new Error(`${label} exceeds the supported length`);
  return trimmed;
}

function validateMeaningPair(card: ReadingCardWithDetails, locale: TarotLocale, meanings: Map<string, MeaningPair>): MeaningPair {
  const pair = meanings.get(card.cardId);
  if (!pair || !pair.upright || !pair.reversed) throw new Error(`Both orientation meanings are required for card ${card.cardId}`);
  if (pair.upright.cardId !== card.cardId || pair.reversed.cardId !== card.cardId) throw new Error(`Meaning card identity does not match ${card.cardId}`);
  if (pair.upright.locale !== locale || pair.reversed.locale !== locale) throw new Error(`Meaning locale does not match ${card.cardId}`);
  if (pair.upright.orientation !== "upright" || pair.reversed.orientation !== "reversed") throw new Error(`Meaning orientations are incomplete for ${card.cardId}`);
  return pair;
}

function cardOrientation(card: ReadingCardWithDetails) {
  if (card.orientation === "upright" || card.orientation === "reversed") return card.orientation;
  throw new Error(`Stored card orientation is invalid for ${card.id}`);
}

function orderedPositions(template: ReadingTemplateWithPositions) {
  const positions = [...template.positions].sort((left, right) => left.order - right.order || left.id.localeCompare(right.id));
  if (positions.length !== template.template.cardCount) throw new Error("Spread position count does not match the stored template");
  if (new Set(positions.map((position) => position.id)).size !== positions.length) throw new Error("Spread positions must be unique");
  if (new Set(positions.map((position) => position.key)).size !== positions.length) throw new Error("Spread position keys must be unique");
  if (positions.some((position) => !Number.isInteger(position.order) || position.order < 0)
    || new Set(positions.map((position) => position.order)).size !== positions.length) throw new Error("Spread position orders must be unique non-negative integers");
  return positions;
}

function validateCardShape(cards: ReadingCardWithDetails[], session: ReadingSessionRow, template: ReadingTemplateWithPositions) {
  if (!cards.length) throw new Error("A reading must contain at least one stored card");
  if (session.spreadTemplateId !== template.template.id || session.categoryId !== template.category.id || template.template.categoryId !== template.category.id) {
    throw new Error("Stored reading template does not match the session");
  }
  if (session.cardCount !== template.template.cardCount || cards.length !== session.cardCount) {
    throw new Error("Stored card count does not match the reading template");
  }
  if (new Set(cards.map((card) => card.id)).size !== cards.length) throw new Error("Reading card ids must be unique");
  if (new Set(cards.map((card) => card.cardId)).size !== cards.length) throw new Error("Drawn cards must be unique");
  if (cards.some((card) => card.sessionId !== session.id)) throw new Error("Stored cards must belong to the reading session");
  if (new Set(cards.map((card) => card.spreadPositionId)).size !== cards.length) throw new Error("Stored card positions must be unique");
  if (cards.some((card) => card.orientation !== "upright" && card.orientation !== "reversed")) {
    throw new Error("Stored card orientation is invalid");
  }
}

function keywords(value: string): string[] {
  return value.split(/[,·]/).map((part) => part.trim()).filter(Boolean);
}

function meaningEvidence(row: CardMeaningRow, supplemental?: TarotMeaningEvidence): TarotMeaningEvidence {
  // Allowlist V5-only guidance. It may never overwrite localized D1 evidence.
  return {
    ...(supplemental ? {
      core: supplemental.core,
      contextRule: supplemental.contextRule,
      positionModifier: supplemental.positionModifier,
      reversalGuidance: supplemental.reversalGuidance,
      cautions: supplemental.cautions,
      interpretationChecks: supplemental.interpretationChecks,
      masterSemantics: supplemental.masterSemantics,
    } : {}),
    summary: row.summary,
    energy: row.energy,
    actions: [row.actions],
    relationships: row.relationships,
    work: row.work,
    creativity: row.creativity,
    home: row.home,
    symbolism: row.symbolism,
    journalQuestions: [...row.journalQuestions],
    keywords: keywords(row.keywords),
  };
}

function mapCardContext(
  card: ReadingCardWithDetails,
  position: ReadingTemplateWithPositions["positions"][number],
  domain: string,
  locale: TarotLocale,
  meanings: Map<string, MeaningPair>,
): TarotReadingCardContext {
  const pair = validateMeaningPair(card, locale, meanings);
  const knowledge = getV5CardKnowledge(card.nameEn, domain, position.key);

  return {
    readingCardId: card.id,
    orientation: cardOrientation(card),
    position: {
      id: position.id,
      key: position.key,
      order: position.order,
      name: position.name,
      meaning: position.meaning,
      prompt: position.prompt,
    },
    card: {
      id: card.cardId,
      nameEn: card.nameEn,
      nameVi: card.nameVi,
      arcana: card.arcana,
      suit: card.suit,
      keywords: keywords(pair[cardOrientation(card)].keywords),
    },
    knowledge: {
      upright: meaningEvidence(pair.upright, knowledge?.upright),
      reversed: meaningEvidence(pair.reversed, knowledge?.reversed),
    },
  };
}

/** Accept only repository rows loaded after getSessionForOwner succeeds, never request-body cards. */
export function buildTarotReadingInput(args: BuildTarotReadingInputArgs): TarotReadingInput {
  const question = boundedText(args.session.question, MAX_READING_QUESTION_LENGTH, "Reading question");
  const optionalContext = args.session.optionalContext.trim();
  if (optionalContext.length > MAX_READING_CONTEXT_LENGTH) throw new Error("Reading context exceeds the supported length");

  const positions = orderedPositions(args.template);
  validateCardShape(args.cards, args.session, args.template);
  const storedCards = [...args.cards].sort((left, right) => left.positionOrder - right.positionOrder || left.id.localeCompare(right.id));
  const positionById = new Map(positions.map((position) => [position.id, position]));
  const domain = inferTarotDomain(args.template.category.slug, question);
  const semantics = args.template.semantics || localizedTarotSpreadSemantics({
    categorySlug: args.template.category.slug,
    categoryName: args.template.category.name,
    categoryDescription: args.template.category.description,
    template: {
      slug: args.template.template.slug,
      name: args.template.template.name,
      description: args.template.template.description,
      spreadType: args.template.template.spreadType,
      cardCount: args.template.template.cardCount,
    },
    positions: positions.map((position) => ({
      key: position.key,
      order: position.order,
      label: position.name,
      description: position.meaning,
    })),
  }, args.locale);
  const cards = storedCards.map((card) => {
    const position = positionById.get(card.spreadPositionId);
    if (!position || position.key !== card.positionKey || position.order !== card.positionOrder) {
      throw new Error(`Stored card ${card.id} does not match a spread position`);
    }
    return mapCardContext(card, position, domain, args.locale, args.meanings);
  });

  return {
    knowledgeVersion: TAROT_KNOWLEDGE_VERSION,
    domain,
    locale: args.locale,
    question,
    optionalContext: optionalContext || null,
    category: {
      id: args.template.category.id,
      key: args.template.category.slug,
      name: args.template.category.name,
    },
    spread: {
      id: args.template.template.id,
      key: args.template.template.slug,
      name: args.template.template.name,
      description: args.template.template.description,
      semantics,
    },
    cards,
    retrievedGuidance: v5Guidance(domain),
    combinationHints: selectCombinationHints(cards.map((card) => ({ nameEn: card.card.nameEn, positionKey: card.position.key }))),
    fewShotExamples: selectFewShotExamples({
      locale: args.locale,
      domain,
      question,
      cards: cards.map((card) => ({ nameEn: card.card.nameEn, orientation: card.orientation })),
    }),
  };
}
