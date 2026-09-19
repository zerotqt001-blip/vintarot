import type { D1Database } from "@cloudflare/workers-types";
import { z } from "zod";
import type { TarotLocale, TarotReadingCardIdentity, TarotReadingPayload } from "./ai/types";
import type { ReadingOwner } from "./tarot-guest";
import { parseStoredReading, type StoredReadingRow } from "./tarot-reading-compat";
import type { ReadingTemplateWithPositions, TarotRepository } from "./tarot-repository";

export const SAVED_READING_RECORD_KIND = "tarot-reading";

const markerSchema = z.object({
  reading_id: z.string().min(1).max(100),
  session_id: z.string().min(1).max(100),
}).strict();

type SavedReadingMarker = z.infer<typeof markerSchema>;

type RecordRow = {
  id: string;
  owner: string;
  kind: string;
  data: string;
  created: number;
  updated: number;
};

export type SavedReadingErrorCode = "unauthenticated" | "not_found" | "invalid_stored_reading" | "storage";

export class SavedReadingError extends Error {
  readonly code: SavedReadingErrorCode;

  constructor(code: SavedReadingErrorCode, message: string, options?: { cause?: unknown }) {
    super(message, options?.cause === undefined ? undefined : { cause: options.cause });
    this.name = "SavedReadingError";
    this.code = code;
  }
}

export type SavedReadingRecord = {
  id: string;
  readingId: string;
  sessionId: string;
  created: number;
  updated: number;
};

export type SavedReadingCardSummary = {
  readingCardId: string;
  cardId: string;
  cardNumber: number;
  nameEn: string;
  nameVi: string;
  imageUrl: string;
  positionId: string;
  positionKey: string;
  positionOrder: number;
  orientation: "upright" | "reversed";
};

export type SavedReadingSummary = SavedReadingRecord & {
  question: string;
  locale: TarotLocale;
  spreadName: string;
  cardCount: number;
  cards: SavedReadingCardSummary[];
};

export type SavedReadingDetail = {
  savedReading: SavedReadingRecord;
  session: {
    id: string;
    question: string;
    optionalContext: string;
    categoryId: string;
    spreadTemplateId: string;
    spreadType: string;
    cardCount: number;
    locale: TarotLocale;
    status: string;
  };
  spread: {
    categoryId: string;
    categoryName: string;
    templateId: string;
    name: string;
    description: string;
    spreadType: string;
  };
  cards: SavedReadingCardSummary[];
  reading: TarotReadingPayload;
  metadata: {
    modelName: string;
    promptVersion: string;
    createdAt: number;
    updatedAt: number;
  };
};

async function first<T>(database: D1Database, statement: string, ...values: unknown[]): Promise<T | null> {
  const result = await database.prepare(statement).bind(...values).first();
  return (result as T | null) || null;
}

async function rows<T>(database: D1Database, statement: string, ...values: unknown[]): Promise<T[]> {
  const result = await database.prepare(statement).bind(...values).all();
  return result.results as unknown as T[];
}

function authenticatedUser(owner: ReadingOwner): string {
  if (owner.kind !== "user") throw new SavedReadingError("unauthenticated", "Sign in to save this reading.");
  return owner.userId;
}

function markerId(readingId: string): string {
  return "saved-reading:" + readingId;
}

function parseMarker(value: string): SavedReadingMarker | null {
  try {
    const parsed = markerSchema.safeParse(JSON.parse(value));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

function recordFromRow(row: RecordRow, marker: SavedReadingMarker): SavedReadingRecord {
  return {
    id: row.id,
    readingId: marker.reading_id,
    sessionId: marker.session_id,
    created: row.created,
    updated: row.updated,
  };
}

async function ownedReading(
  database: D1Database,
  readingId: string,
  sessionId: string,
  userId: string,
): Promise<StoredReadingRow | null> {
  return first<StoredReadingRow>(database, "SELECT r.id, r.session_id AS sessionId, r.opening, r.card_readings AS cardReadings, r.synthesis, r.advice, r.closing, r.disclaimer, r.reading_payload AS readingPayload, r.model_name AS modelName, r.prompt_version AS promptVersion, r.created_at AS createdAt, r.updated_at AS updatedAt FROM readings r JOIN reading_sessions s ON s.id = r.session_id WHERE r.id = ? AND r.session_id = ? AND s.user_id = ?", readingId, sessionId, userId);
}

function expectedCards(stored: NonNullable<Awaited<ReturnType<TarotRepository["getSessionForOwner"]>>>, template: ReadingTemplateWithPositions): TarotReadingCardIdentity[] {
  const { session } = stored;
  if (session.cardCount !== template.template.cardCount || stored.cards.length !== session.cardCount) {
    throw new SavedReadingError("invalid_stored_reading", "The saved Tarot reading has incomplete card coverage.");
  }
  const positions = [...template.positions].sort((left, right) => left.order - right.order || left.id.localeCompare(right.id));
  if (positions.length !== template.template.cardCount) {
    throw new SavedReadingError("invalid_stored_reading", "The saved Tarot spread definition is incomplete.");
  }
  const positionById = new Map(positions.map((position) => [position.id, position]));
  const orderedCards = [...stored.cards].sort((left, right) => left.positionOrder - right.positionOrder || left.id.localeCompare(right.id));
  const readingCardIds = new Set<string>();
  return orderedCards.map((card) => {
    const position = positionById.get(card.spreadPositionId);
    if (!position || position.key !== card.positionKey || position.order !== card.positionOrder || readingCardIds.has(card.id)) {
      throw new SavedReadingError("invalid_stored_reading", "The saved Tarot reading has invalid card positions.");
    }
    if (card.orientation !== "upright" && card.orientation !== "reversed") {
      throw new SavedReadingError("invalid_stored_reading", "The saved Tarot reading has an invalid orientation.");
    }
    readingCardIds.add(card.id);
    return {
      readingCardId: card.id,
      orientation: card.orientation,
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
        suit: card.suit || null,
        keywords: [],
      },
    };
  });
}

function cardSummaries(stored: NonNullable<Awaited<ReturnType<TarotRepository["getSessionForOwner"]>>>, template: ReadingTemplateWithPositions): SavedReadingCardSummary[] {
  const positions = new Map(template.positions.map((position) => [position.id, position]));
  return [...stored.cards]
    .sort((left, right) => left.positionOrder - right.positionOrder || left.id.localeCompare(right.id))
    .map((card) => {
      const position = positions.get(card.spreadPositionId);
      if (!position) throw new SavedReadingError("invalid_stored_reading", "The saved Tarot card position is unavailable.");
      return {
        readingCardId: card.id,
        cardId: card.cardId,
        cardNumber: card.cardNumber,
        nameEn: card.nameEn,
        nameVi: card.nameVi,
        imageUrl: card.imageUrl,
        positionId: position.id,
        positionKey: position.key,
        positionOrder: position.order,
        orientation: card.orientation as "upright" | "reversed",
      };
    });
}

async function savedRow(database: D1Database, id: string, userId: string): Promise<{ row: RecordRow; marker: SavedReadingMarker } | null> {
  const row = await first<RecordRow>(database, "SELECT id, owner, kind, data, created, updated FROM records WHERE id = ? AND owner = ?", id, userId);
  if (!row || row.kind !== SAVED_READING_RECORD_KIND) return null;
  const marker = parseMarker(row.data);
  return marker ? { row, marker } : null;
}

async function ownedSession(repository: TarotRepository, sessionId: string, owner: ReadingOwner) {
  const stored = await repository.getSessionForOwner(sessionId, owner);
  if (!stored) throw new SavedReadingError("not_found", "Saved Tarot reading not found.");
  return stored;
}

async function buildDetail(args: {
  database: D1Database;
  repository: TarotRepository;
  owner: ReadingOwner;
  saved: SavedReadingRecord;
  stored: NonNullable<Awaited<ReturnType<TarotRepository["getSessionForOwner"]>>>;
  row: StoredReadingRow;
}): Promise<SavedReadingDetail> {
  const template = await args.repository.getReadingTemplate(args.stored.session.spreadTemplateId, args.stored.session.locale);
  if (!template) throw new SavedReadingError("invalid_stored_reading", "The saved Tarot spread definition is unavailable.");
  const expected = expectedCards(args.stored, template);
  let reading: TarotReadingPayload;
  try {
    reading = parseStoredReading(args.row, expected, args.stored.session.locale);
  } catch (error) {
    throw new SavedReadingError("invalid_stored_reading", "The saved Tarot reading payload is not compatible.", { cause: error });
  }
  return {
    savedReading: args.saved,
    session: args.stored.session,
    spread: {
      categoryId: template.category.id,
      categoryName: template.category.name,
      templateId: template.template.id,
      name: template.template.name,
      description: template.template.description,
      spreadType: template.template.spreadType,
    },
    cards: cardSummaries(args.stored, template),
    reading,
    metadata: {
      modelName: args.row.modelName,
      promptVersion: args.row.promptVersion,
      createdAt: args.row.createdAt,
      updatedAt: args.row.updatedAt,
    },
  };
}

export async function saveTarotReading(args: {
  database: D1Database;
  repository: TarotRepository;
  owner: ReadingOwner;
  sessionId: string;
  readingId: string;
}): Promise<SavedReadingRecord> {
  const userId = authenticatedUser(args.owner);
  const stored = await ownedSession(args.repository, args.sessionId, args.owner);
  const reading = await ownedReading(args.database, args.readingId, args.sessionId, userId);
  if (!reading || reading.sessionId !== stored.session.id) throw new SavedReadingError("not_found", "Saved Tarot reading not found.");

  const id = markerId(args.readingId);
  const existing = await first<RecordRow>(args.database, "SELECT id, owner, kind, data, created, updated FROM records WHERE id = ?", id);
  if (existing && (existing.owner !== userId || existing.kind !== SAVED_READING_RECORD_KIND)) {
    throw new SavedReadingError("not_found", "Saved Tarot reading not found.");
  }
  const now = Date.now();
  const data = JSON.stringify({ reading_id: args.readingId, session_id: args.sessionId });
  if (existing) {
    await args.database.prepare("UPDATE records SET data = ?, updated = ? WHERE id = ? AND owner = ? AND kind = ?").bind(data, now, id, userId, SAVED_READING_RECORD_KIND).run();
  } else {
    await args.database.prepare("INSERT INTO records (id, owner, kind, data, created, updated) VALUES (?, ?, ?, ?, ?, ?)").bind(id, userId, SAVED_READING_RECORD_KIND, data, now, now).run();
  }
  const saved = await first<RecordRow>(args.database, "SELECT id, owner, kind, data, created, updated FROM records WHERE id = ? AND owner = ? AND kind = ?", id, userId, SAVED_READING_RECORD_KIND);
  if (!saved) throw new SavedReadingError("storage", "The saved Tarot reading could not be recorded.");
  return recordFromRow(saved, { reading_id: args.readingId, session_id: args.sessionId });
}

export async function listTarotSavedReadings(args: {
  database: D1Database;
  repository: TarotRepository;
  owner: ReadingOwner;
}): Promise<SavedReadingSummary[]> {
  const userId = authenticatedUser(args.owner);
  const records = await rows<RecordRow>(args.database, "SELECT id, owner, kind, data, created, updated FROM records WHERE owner = ? AND kind = ? ORDER BY updated DESC, id DESC LIMIT 100", userId, SAVED_READING_RECORD_KIND);
  const items: SavedReadingSummary[] = [];
  for (const row of records) {
    const marker = parseMarker(row.data);
    if (!marker) continue;
    const stored = await args.repository.getSessionForOwner(marker.session_id, args.owner);
    if (!stored) continue;
    const reading = await ownedReading(args.database, marker.reading_id, marker.session_id, userId);
    if (!reading) continue;
    const template = await args.repository.getReadingTemplate(stored.session.spreadTemplateId, stored.session.locale);
    if (!template) continue;
    items.push({
      ...recordFromRow(row, marker),
      question: stored.session.question,
      locale: stored.session.locale,
      spreadName: template.template.name,
      cardCount: stored.session.cardCount,
      cards: cardSummaries(stored, template),
    });
  }
  return items;
}

export async function loadTarotSavedReading(args: {
  database: D1Database;
  repository: TarotRepository;
  owner: ReadingOwner;
  savedId: string;
}): Promise<SavedReadingDetail> {
  const userId = authenticatedUser(args.owner);
  const saved = await savedRow(args.database, args.savedId, userId);
  if (!saved) throw new SavedReadingError("not_found", "Saved Tarot reading not found.");
  const stored = await ownedSession(args.repository, saved.marker.session_id, args.owner);
  const row = await ownedReading(args.database, saved.marker.reading_id, saved.marker.session_id, userId);
  if (!row) throw new SavedReadingError("not_found", "Saved Tarot reading not found.");
  return buildDetail({
    database: args.database,
    repository: args.repository,
    owner: args.owner,
    saved: recordFromRow(saved.row, saved.marker),
    stored,
    row,
  });
}
