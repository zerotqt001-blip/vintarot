import cardImages from "./card-images.json";
import type { TarotOrientation } from "./ai/types";
import { resolveNormalizedSpreadGeometry } from "./tarot-spread-geometry";
import { buildPublicShareUrl, buildShareImageUrl } from "./tarot-share-config";
import type {
  PublicReadingView,
  ShareRecord,
  ShareableReadingSnapshot,
  SharePublicCard,
  SharePublicCardEvidence,
  SharePublicPosition,
} from "./tarot-share-contract";

export class ShareProjectionError extends Error {
  readonly code = "share_projection" as const;

  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options?.cause === undefined ? undefined : { cause: options.cause });
    this.name = "ShareProjectionError";
  }
}

const MAX_QUESTION = 600;
const MAX_DIRECT_ANSWER = 6000;
const MAX_INSIGHT_TITLE = 120;
const MAX_INSIGHT_BODY = 1400;
const MAX_REFLECTION = 400;
const MAX_NEXT_STEP_TITLE = 120;
const MAX_NEXT_STEP_BODY = 1400;
const MAX_DEEPER_READING = 6000;
const MAX_INTERPRETATION = 4000;
const MAX_DISCLAIMER = 500;
const LOCAL_CARD_IMAGE = /^\/cards\/[a-z0-9-]+\.webp$/;

function bounded(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  return value.replace(/[\u0000\u0001-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim().slice(0, max);
}

function nonEmpty(value: unknown, max: number, label: string): string {
  const result = bounded(value, max);
  if (!result) throw new ShareProjectionError(`Share ${label} is empty.`);
  return result;
}

function approvedCardImage(imageUrl: unknown): string {
  if (typeof imageUrl !== "string" || !LOCAL_CARD_IMAGE.test(imageUrl) || !Object.values(cardImages).includes(imageUrl)) {
    throw new ShareProjectionError("Share card artwork is not an approved local asset.");
  }
  return imageUrl;
}

function orientation(value: unknown): TarotOrientation {
  if (value !== "upright" && value !== "reversed") {
    throw new ShareProjectionError("Share card orientation is invalid.");
  }
  return value;
}

function publicPosition(position: ShareableReadingSnapshot["spread"]["positions"][number]): SharePublicPosition {
  return {
    order: position.order,
    label: nonEmpty(position.label, 160, "position label"),
    meaning: bounded(position.meaning, 500),
    prompt: bounded(position.prompt, 500),
  };
}

function publicCard(
  card: ShareableReadingSnapshot["cards"][number],
  position: SharePublicPosition,
  locale: ShareableReadingSnapshot["locale"],
): SharePublicCard {
  const cardName = locale === "vi" ? card.nameVi : card.nameEn;
  const nameEn = nonEmpty(card.nameEn, 160, "English card name");
  const nameVi = nonEmpty(card.nameVi, 160, "Vietnamese card name");
  return {
    order: card.positionOrder,
    cardNumber: Number.isFinite(card.cardNumber) ? Math.max(0, Math.trunc(card.cardNumber)) : 0,
    name: locale === "vi" ? nameVi : nameEn,
    nameEn,
    nameVi,
    imageUrl: approvedCardImage(card.imageUrl),
    position,
    orientation: orientation(card.orientation),
    alt: `${cardName} — ${position.label}`,
  };
}

function publicCardEvidence(
  evidence: ShareableReadingSnapshot["reading"]["cardEvidence"][number],
  card: ShareableReadingSnapshot["cards"][number],
  position: SharePublicPosition,
  order: number,
  locale: ShareableReadingSnapshot["locale"],
): SharePublicCardEvidence {
  return {
    order,
    cardName: locale === "vi" ? nonEmpty(card.nameVi, 160, "Vietnamese card name") : nonEmpty(card.nameEn, 160, "English card name"),
    positionLabel: position.label,
    orientation: orientation(evidence.orientation),
    interpretation: nonEmpty(evidence.interpretation, MAX_INTERPRETATION, "card interpretation"),
  };
}

/** Convert trusted internal reading data into the only shape a public page/image may see. */
export function projectPublicReading(input: {
  record: ShareRecord;
  token: string;
  snapshot: ShareableReadingSnapshot;
  origin?: string;
}): PublicReadingView {
  const { record, snapshot } = input;
  if (record.locale !== snapshot.locale) throw new ShareProjectionError("Share locale does not match the reading.");
  if (snapshot.spread.cardCount !== snapshot.cards.length || snapshot.spread.cardCount !== snapshot.spread.positions.length) {
    throw new ShareProjectionError("Share card coverage is incomplete.");
  }

  const positions = [...snapshot.spread.positions].sort((left, right) => left.order - right.order || left.id.localeCompare(right.id));
  const positionById = new Map(positions.map((position) => [position.id, position]));
  const cards = [...snapshot.cards].sort((left, right) => left.positionOrder - right.positionOrder || left.readingCardId.localeCompare(right.readingCardId));
  const cardByReadingId = new Map<string, ShareableReadingSnapshot["cards"][number]>();
  const publicCards = cards.map((card) => {
    if (cardByReadingId.has(card.readingCardId)) throw new ShareProjectionError("Share card identity is duplicated.");
    const position = positionById.get(card.positionId);
    if (!position || position.key !== card.positionKey || position.order !== card.positionOrder) {
      throw new ShareProjectionError("Share card position is invalid.");
    }
    cardByReadingId.set(card.readingCardId, card);
    return publicCard(card, publicPosition(position), snapshot.locale);
  });

  const publicPositions = positions.map(publicPosition);
  const geometry = resolveNormalizedSpreadGeometry(snapshot.spread.spreadType, positions);
  if (geometry.length !== cards.length) throw new ShareProjectionError("Share geometry coverage is incomplete.");

  const evidence = snapshot.reading.cardEvidence.map((item, index) => {
    const card = cardByReadingId.get(item.readingCardId);
    if (!card) throw new ShareProjectionError("Share interpretation coverage is incomplete.");
    const position = positionById.get(card.positionId);
    if (!position) throw new ShareProjectionError("Share interpretation position is unavailable.");
    return publicCardEvidence(item, card, publicPosition(position), index, snapshot.locale);
  });

  return {
    publicUrl: buildPublicShareUrl(input.token, input.origin),
    imageUrl: buildShareImageUrl(input.token, input.origin),
    locale: snapshot.locale,
    question: nonEmpty(snapshot.question, MAX_QUESTION, "question"),
    spread: {
      name: nonEmpty(snapshot.spread.name, 180, "spread name"),
      spreadType: nonEmpty(snapshot.spread.spreadType, 80, "spread type"),
      cardCount: snapshot.spread.cardCount,
      positions: publicPositions,
    },
    cards: publicCards,
    geometry,
    reading: {
      directAnswer: nonEmpty(snapshot.reading.directAnswer, MAX_DIRECT_ANSWER, "direct answer"),
      personalInsights: snapshot.reading.personalInsights.slice(0, 4).map((item) => ({
        title: nonEmpty(item.title, MAX_INSIGHT_TITLE, "insight title"),
        body: nonEmpty(item.body, MAX_INSIGHT_BODY, "insight body"),
      })),
      reflectionPrompts: snapshot.reading.reflectionPrompts.slice(0, 4).map((item) => nonEmpty(item, MAX_REFLECTION, "reflection prompt")),
      nextSteps: snapshot.reading.nextSteps.slice(0, 4).map((item) => ({
        title: nonEmpty(item.title, MAX_NEXT_STEP_TITLE, "next-step title"),
        body: nonEmpty(item.body, MAX_NEXT_STEP_BODY, "next-step body"),
      })),
      cardEvidence: evidence,
      deeperReading: snapshot.reading.deeperReading ? bounded(snapshot.reading.deeperReading, MAX_DEEPER_READING) : null,
      disclaimer: nonEmpty(snapshot.reading.disclaimer, MAX_DISCLAIMER, "disclaimer"),
    },
    projectionVersion: record.projectionVersion,
    geometryVersion: record.geometryVersion,
    rendererVersion: record.rendererVersion,
  };
}

export function isApprovedCardImageUrl(value: unknown): value is string {
  return typeof value === "string" && LOCAL_CARD_IMAGE.test(value) && Object.values(cardImages).includes(value);
}
