import { spreadCardPosition } from "./room-motion";
import { currentSpreadCatalog, type TarotCatalogTemplate, type TarotDrawPlanCard, type TarotPositionSeed } from "./tarot-catalog";

export type LegacySpreadMatch = {
  categoryId: string;
  categorySlug: string;
  templateId: string;
  templateSlug: string;
  cardCount: number;
  positions: TarotPositionSeed[];
};

export type DynamicRoomCard = {
  id: number;
  cardNumber?: number;
  cardId?: string;
  readingCardId?: string;
  positionKey?: string;
  positionOrder?: number;
  reversed: boolean;
  orientation?: "upright" | "reversed";
  face: boolean;
  x: number;
  y: number;
};

export type RoomRequestStamp = { epoch: number; id: string };

export function isRoomRequestCurrent(request: RoomRequestStamp, current: RoomRequestStamp): boolean {
  return request.epoch === current.epoch && request.id === current.id;
}

/** Keep the complete shuffled fan visible and remove only cards already selected. */
export function remainingFanCardNumbers(deckOrder: number[], drawn: Array<Pick<DynamicRoomCard, "id" | "cardNumber">>): number[] {
  const drawnNumbers = new Set(drawn.map((card) => card.cardNumber ?? card.id));
  return deckOrder.filter((cardNumber) => !drawnNumbers.has(cardNumber));
}

function labelsForTemplate(template: LegacySpreadMatch | TarotCatalogTemplate): string[] {
  return template.positions.map((position) => typeof position.label === "string" ? position.label : position.label.en);
}

export function roomPositionLabels(template: LegacySpreadMatch | TarotCatalogTemplate): string[] {
  return labelsForTemplate(template);
}

export function hydrateLegacySpread(labels: string[]): LegacySpreadMatch | null {
  const match = currentSpreadCatalog.templates.find((template) => {
    const positions = currentSpreadCatalog.positions.filter((position) => position.templateId === template.id);
    return positions.map((position) => position.label.en).join("|") === labels.join("|");
  });
  if (!match) return null;
  const category = currentSpreadCatalog.categories.find((item) => item.id === match.categoryId);
  if (!category) return null;
  const positions = currentSpreadCatalog.positions.filter((position) => position.templateId === match.id).sort((left, right) => left.order - right.order);
  return {
    categoryId: category.id,
    categorySlug: category.slug,
    templateId: match.id,
    templateSlug: match.slug,
    cardCount: match.cardCount,
    positions,
  };
}

export function consumeDrawPlan(
  plan: TarotDrawPlanCard[],
  drawn: DynamicRoomCard[],
  cardNumber: number,
  cardCount: number,
): { card: DynamicRoomCard; remaining: TarotDrawPlanCard[]; position: { x: number; y: number } } | null {
  const selected = plan.find((card) => card.cardNumber === cardNumber);
  if (!selected || drawn.some((card) => card.cardId === selected.cardId || (card.cardNumber ?? card.id) === selected.cardNumber)) return null;
  const position = spreadCardPosition(selected.positionOrder, cardCount);
  const card: DynamicRoomCard = {
    id: selected.cardNumber,
    cardNumber: selected.cardNumber,
    cardId: selected.cardId,
    readingCardId: selected.readingCardId,
    positionKey: selected.positionKey,
    positionOrder: selected.positionOrder,
    reversed: selected.orientation === "reversed",
    orientation: selected.orientation,
    face: false,
    ...position,
  };
  return { card, remaining: plan.filter((candidate) => candidate.cardId !== selected.cardId), position };
}
