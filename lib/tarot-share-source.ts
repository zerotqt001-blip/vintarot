import type { D1Database } from "@cloudflare/workers-types";
import type { TarotReadingCardIdentity } from "./ai/types";
import { parseStoredReading } from "./tarot-reading-compat";
import type { ReadingOwner } from "./tarot-guest";
import type { ReadingTemplateWithPositions, TarotRepository } from "./tarot-repository";
import type { ReadingShareSource, ShareableReadingSnapshot, ShareableSpreadPosition } from "./tarot-share-contract";

function orderedPositions(template: ReadingTemplateWithPositions): ShareableSpreadPosition[] {
  return [...template.positions]
    .sort((left, right) => left.order - right.order || left.id.localeCompare(right.id))
    .map((position) => ({
      id: position.id,
      key: position.key,
      order: position.order,
      label: position.name,
      meaning: position.meaning,
      prompt: position.prompt,
    }));
}

/**
 * Resolve only an owner-authorized canonical reading. This intentionally has no
 * public-token or share-table knowledge so the future DB adapter can be swapped
 * without widening the public projection.
 */
export async function buildShareableReadingSnapshot(args: {
  database: D1Database;
  repository: TarotRepository;
  owner: ReadingOwner;
  readingId: string;
  sessionId: string;
}): Promise<ShareableReadingSnapshot | null> {
  const stored = await args.repository.getSessionForOwner(args.sessionId, args.owner);
  if (!stored || stored.session.id !== args.sessionId) return null;

  const row = await args.repository.getLatestReadingForOwner(args.sessionId, args.owner);
  if (!row || row.id !== args.readingId || row.sessionId !== args.sessionId) return null;

  const template = await args.repository.getReadingTemplate(stored.session.spreadTemplateId, stored.session.locale);
  if (!template || template.template.cardCount !== stored.session.cardCount || template.positions.length !== stored.session.cardCount || stored.cards.length !== stored.session.cardCount) {
    return null;
  }

  const positions = orderedPositions(template);
  const positionById = new Map(positions.map((position) => [position.id, position]));
  const cards = [...stored.cards].sort((left, right) => left.positionOrder - right.positionOrder || left.id.localeCompare(right.id));
  const readingCardIds = new Set<string>();
  const expectedCards: TarotReadingCardIdentity[] = [];
  const shareCards: ShareableReadingSnapshot["cards"] = [];

  for (const card of cards) {
    const position = positionById.get(card.spreadPositionId);
    if (!position || position.key !== card.positionKey || position.order !== card.positionOrder || readingCardIds.has(card.id)) return null;
    if (card.orientation !== "upright" && card.orientation !== "reversed") return null;
    readingCardIds.add(card.id);
    expectedCards.push({
      readingCardId: card.id,
      orientation: card.orientation,
      position: {
        id: position.id,
        key: position.key,
        order: position.order,
        name: position.label,
        meaning: position.meaning,
        prompt: position.prompt,
      },
      card: {
        id: card.cardId,
        nameEn: card.nameEn,
        nameVi: card.nameVi,
        arcana: card.arcana,
        suit: card.suit || null,
        keywords: [],
      },
    });
    shareCards.push({
      readingCardId: card.id,
      cardId: card.cardId,
      cardNumber: card.cardNumber,
      nameEn: card.nameEn,
      nameVi: card.nameVi,
      imageUrl: card.imageUrl,
      positionId: position.id,
      positionKey: position.key,
      positionOrder: position.order,
      position,
      orientation: card.orientation,
    });
  }

  try {
    const reading = parseStoredReading(row, expectedCards, stored.session.locale);
    return {
      locale: stored.session.locale,
      question: stored.session.question,
      spread: {
        name: template.template.name,
        spreadType: template.template.spreadType,
        cardCount: stored.session.cardCount,
        positions,
      },
      cards: shareCards,
      reading,
    };
  } catch {
    return null;
  }
}

export function createDatabaseReadingShareSource(args: {
  database: D1Database;
  repository: TarotRepository;
}): ReadingShareSource {
  return {
    loadShareableReading(input) {
      return buildShareableReadingSnapshot({
        ...args,
        owner: input.owner,
        readingId: input.readingId,
        sessionId: input.sessionId,
      });
    },
  };
}
