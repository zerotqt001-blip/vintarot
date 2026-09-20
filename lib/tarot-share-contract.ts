import { z } from "zod";
import type { TarotLocale, TarotOrientation, TarotReadingPayload } from "./ai/types";
import type { ReadingOwner } from "./tarot-guest";
import type { NormalizedSpreadPosition } from "./tarot-spread-geometry";

export const SHARE_PROJECTION_VERSION = "share-public-v1" as const;
export const SHARE_GEOMETRY_VERSION = "spread-geometry-v1" as const;
export const SHARE_RENDERER_VERSION = "svg-v1" as const;

export type ShareStatus = "active" | "revoked" | "expired";

export type ShareRecord = {
  id: string;
  tokenHash: string;
  owner: ReadingOwner;
  readingId: string;
  sessionId: string;
  status: ShareStatus;
  locale: TarotLocale;
  projectionVersion: string;
  geometryVersion: string;
  rendererVersion: string;
  createdAt: number;
  updatedAt: number;
  revokedAt: number | null;
  expiresAt: number | null;
};

export const SHARE_EVENT_NAMES = [
  "share_created",
  "share_opened",
  "share_image_generated",
  "share_image_downloaded",
  "share_cta_clicked",
] as const;

export type ShareEventName = (typeof SHARE_EVENT_NAMES)[number];

export const shareEventNameSchema = z.enum(SHARE_EVENT_NAMES);
export const shareLocaleSchema = z.enum(["en", "vi"]);
export const shareSourceSchema = z.enum(["share", "copy_link", "save_image", "create_cta"]);

export const shareEventInputSchema = z.object({
  event_id: z.string().uuid(),
  event_name: shareEventNameSchema,
  locale: shareLocaleSchema,
  source: shareSourceSchema.optional(),
  renderer_version: z.string().regex(/^[a-z0-9-]{1,40}$/).optional(),
  created_at: z.number().int().finite().min(0).max(4102444800000).optional(),
}).strict();

export type ShareEventInput = z.infer<typeof shareEventInputSchema>;

export type SharePublicPosition = {
  order: number;
  label: string;
  meaning: string;
  prompt: string;
};

export type SharePublicCard = {
  order: number;
  cardNumber: number;
  name: string;
  nameEn: string;
  nameVi: string;
  imageUrl: string;
  position: SharePublicPosition;
  orientation: TarotOrientation;
  alt: string;
};

export type SharePublicCardEvidence = {
  order: number;
  cardName: string;
  positionLabel: string;
  orientation: TarotOrientation;
  interpretation: string;
};

export type PublicReadingView = {
  publicUrl: string;
  imageUrl: string;
  locale: TarotLocale;
  question: string;
  spread: {
    name: string;
    spreadType: string;
    cardCount: number;
    positions: SharePublicPosition[];
  };
  cards: SharePublicCard[];
  geometry: NormalizedSpreadPosition[];
  reading: {
    directAnswer: string;
    personalInsights: Array<{ title: string; body: string }>;
    reflectionPrompts: string[];
    nextSteps: Array<{ title: string; body: string }>;
    cardEvidence: SharePublicCardEvidence[];
    deeperReading: string | null;
    disclaimer: string;
  };
  projectionVersion: string;
  geometryVersion: string;
  rendererVersion: string;
};

export type ShareableSpreadPosition = SharePublicPosition & {
  id: string;
  key: string;
};

export type ShareableReadingCard = {
  readingCardId: string;
  cardId: string;
  cardNumber: number;
  nameEn: string;
  nameVi: string;
  imageUrl: string;
  positionId: string;
  positionKey: string;
  positionOrder: number;
  position: ShareableSpreadPosition;
  orientation: TarotOrientation;
};

export type ShareableReadingSnapshot = {
  locale: TarotLocale;
  question: string;
  spread: {
    name: string;
    spreadType: string;
    cardCount: number;
    positions: ShareableSpreadPosition[];
  };
  cards: ShareableReadingCard[];
  reading: TarotReadingPayload;
};

export type ReadingShareSource = {
  loadShareableReading(input: {
    owner: ReadingOwner;
    readingId: string;
    sessionId: string;
  }): Promise<ShareableReadingSnapshot | null>;
};

export type ShareStore = {
  create(record: ShareRecord): Promise<void>;
  findByTokenHash(tokenHash: string): Promise<ShareRecord | null>;
  revoke(input: { shareId: string; owner: ReadingOwner; now: number }): Promise<boolean>;
  insertEvent(input: {
    shareId: string;
    tokenHash: string;
    event: ShareEventInput;
    now: number;
  }): Promise<boolean>;
};
