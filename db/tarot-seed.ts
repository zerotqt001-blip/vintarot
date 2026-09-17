import { cardMeaning, cards, cardNarrative, cardSlug, type Card } from "../lib/tarot";
import {
  currentSpreadCatalog,
  type TarotCardSeed,
  type TarotDeckSeed,
  type TarotMeaningSeed,
  type TarotOrientation,
  type TarotSeed,
} from "../lib/tarot-catalog";
import { tarotNamesVi } from "./tarot-names-vi";

export const RIDER_WAITE_DECK_ID = "deck-rider-waite-smith";

const deck: TarotDeckSeed = {
  id: RIDER_WAITE_DECK_ID,
  slug: "rider-waite-smith",
  name: "Rider Waite Smith",
  artist: "Pamela Colman Smith",
  description: "The Rider–Waite–Smith Tarot deck used by the existing NaTarot reading flow.",
};

function slugPart(value: string): string {
  return value.toLowerCase().replace(/[’']/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
function canonicalCardId(card: Card): string {
  if (card.suit === "Major Arcana") return `major-${slugPart(card.name)}`;
  const rank = card.name.split(" of ")[0] || card.name;
  return `${slugPart(card.suit)}-${slugPart(rank)}`;
}

function sectionBodies(card: Card, locale: "en" | "vi", orientation: TarotOrientation) {
  const narrative = cardNarrative(card, locale, orientation);
  return Object.fromEntries(narrative.sections.map((section) => [section.key, section.body]));
}

function cardSeed(card: Card): TarotCardSeed {
  const id = canonicalCardId(card);
  const nameVi = tarotNamesVi[card.name];
  if (!nameVi) throw new Error(`Missing Vietnamese Tarot name for ${card.name}`);
  return {
    id,
    deckId: deck.id,
    cardNumber: card.id,
    slug: cardSlug(card),
    nameEn: card.name,
    nameVi,
    arcana: card.suit === "Major Arcana" ? "major" : "minor",
    suit: card.suit,
    imageUrl: card.image,
    displayOrder: card.id,
  };
}

function meaningSeed(card: Card, locale: "en" | "vi", orientation: TarotOrientation): TarotMeaningSeed {
  const id = canonicalCardId(card);
  const meaning = cardMeaning(card, locale);
  const sections = sectionBodies(card, locale, orientation);
  return {
    id: `${id}-${locale}-${orientation}`,
    cardId: id,
    locale,
    orientation,
    summary: cardNarrative(card, locale, orientation).summary,
    energy: sections.energy || meaning.upright,
    actions: sections.actions || meaning.upright,
    relationships: sections.relationships || meaning.upright,
    work: sections.work || meaning.upright,
    creativity: sections.creativity || meaning.upright,
    home: sections.home || meaning.upright,
    symbolism: sections.symbolism || meaning.keywords,
    journalQuestions: sections.journalQuestions ? [sections.journalQuestions] : [],
    keywords: meaning.keywords,
  };
}

export function buildTarotSeed(): TarotSeed {
  const cardRows = cards.map(cardSeed);
  const meanings = cards.flatMap((card) => [
    meaningSeed(card, "en", "upright"),
    meaningSeed(card, "en", "reversed"),
    meaningSeed(card, "vi", "upright"),
    meaningSeed(card, "vi", "reversed"),
  ]);
  return {
    deck,
    cards: cardRows,
    meanings,
    categories: currentSpreadCatalog.categories,
    templates: currentSpreadCatalog.templates,
    positions: currentSpreadCatalog.positions,
  };
}

export function validateTarotSeed(seed: TarotSeed): void {
  if (seed.cards.length !== 78) throw new Error(`Expected 78 Tarot cards, received ${seed.cards.length}`);
  if (new Set(seed.cards.map((card) => card.id)).size !== 78) throw new Error("Tarot card IDs must be unique");
  if (new Set(seed.cards.map((card) => card.cardNumber)).size !== 78) throw new Error("Tarot card numbers must be unique");
  if (!seed.cards.every((card, index) => card.cardNumber === index && card.displayOrder === index)) throw new Error("Tarot card order must remain 0–77");
  if (seed.cards.some((card) => !card.imageUrl.startsWith("/cards/"))) throw new Error("Every Tarot card must preserve a local image path");
  if (seed.cards.some((card) => !tarotNamesVi[card.nameEn])) throw new Error("Every Tarot card must have a Vietnamese name");

  const meaningKeys = new Set(seed.meanings.map((meaning) => `${meaning.cardId}:${meaning.locale}:${meaning.orientation}`));
  if (seed.meanings.length !== 78 * 2 * 2 || meaningKeys.size !== seed.meanings.length) throw new Error("Every Tarot card must have four unique meaning variants");
  for (const card of seed.cards) {
    for (const locale of ["en", "vi"] as const) {
      for (const orientation of ["upright", "reversed"] as const) {
        if (!meaningKeys.has(`${card.id}:${locale}:${orientation}`)) throw new Error(`Missing meaning variant for ${card.id}:${locale}:${orientation}`);
      }
    }
  }

  const categoryIds = new Set(seed.categories.map((category) => category.id));
  const templateIds = new Set(seed.templates.map((template) => template.id));
  if (categoryIds.size !== seed.categories.length || templateIds.size !== seed.templates.length) throw new Error("Spread catalog IDs must be unique");
  if (seed.templates.some((template) => !categoryIds.has(template.categoryId))) throw new Error("Every spread template must belong to a category");
  if (seed.positions.some((position) => !templateIds.has(position.templateId))) throw new Error("Every spread position must belong to a template");
  for (const template of seed.templates) {
    const positions = seed.positions.filter((position) => position.templateId === template.id);
    if (positions.length !== template.cardCount) throw new Error(`Spread ${template.slug} expects ${template.cardCount} positions, received ${positions.length}`);
    if (new Set(positions.map((position) => position.key)).size !== positions.length) throw new Error(`Spread ${template.slug} has duplicate position keys`);
  }
}
