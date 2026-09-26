import { findCanonicalSpread, tarotTopics, type TarotTopic } from "./tarot-recommendation";

export const TAROT_ROOM_RESUME_STORAGE_KEY = "natarot:tarot-room-resume:v1";
export const TAROT_AUTH_RETURN_STORAGE_KEY = "natarot:auth-return:v1";
export const TAROT_ROOM_RESUME_MAX_AGE_MS = 60 * 60 * 1000;

export type TarotRoomResumeDraft = {
  version: 1;
  createdAt: number;
  question: string;
  optionalContext: string;
  topic: TarotTopic | null;
  categoryId: string;
  spreadTemplateId: string;
  reversals: boolean;
  selectedCards: Array<{ cardNumber: number; orientation: "upright" | "reversed" }>;
};

const draftKeys = ["version", "createdAt", "question", "optionalContext", "topic", "categoryId", "spreadTemplateId", "reversals", "selectedCards"];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validCreatedAt(value: unknown, now: number): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value <= now && now - value < TAROT_ROOM_RESUME_MAX_AGE_MS;
}

export function parseTarotRoomResumeDraft(value: unknown, now = Date.now()): TarotRoomResumeDraft | null {
  if (!isRecord(value) || Object.keys(value).length !== draftKeys.length || draftKeys.some((key) => !(key in value))) return null;
  if (value.version !== 1 || !validCreatedAt(value.createdAt, now)) return null;
  if (typeof value.question !== "string" || value.question.length > 500) return null;
  if (typeof value.optionalContext !== "string" || value.optionalContext.length > 5000) return null;
  if (value.topic !== null && (typeof value.topic !== "string" || !tarotTopics.includes(value.topic as TarotTopic))) return null;
  if (typeof value.categoryId !== "string" || value.categoryId.length < 1 || value.categoryId.length > 100) return null;
  if (typeof value.spreadTemplateId !== "string" || value.spreadTemplateId.length < 1 || value.spreadTemplateId.length > 100) return null;
  if (typeof value.reversals !== "boolean") return null;
  if (!Array.isArray(value.selectedCards) || value.selectedCards.length < 1 || value.selectedCards.length > 10) return null;

  const canonical = findCanonicalSpread(value.categoryId, value.spreadTemplateId);
  if (!canonical || value.selectedCards.length !== canonical.template.cardCount) return null;
  const cardNumbers = new Set<number>();
  const selectedCards: TarotRoomResumeDraft["selectedCards"] = [];
  for (const candidate of value.selectedCards) {
    if (!isRecord(candidate) || Object.keys(candidate).length !== 2 || typeof candidate.cardNumber !== "number"
      || !Number.isInteger(candidate.cardNumber) || candidate.cardNumber < 0 || candidate.cardNumber > 77
      || (candidate.orientation !== "upright" && candidate.orientation !== "reversed") || cardNumbers.has(candidate.cardNumber)) return null;
    cardNumbers.add(candidate.cardNumber);
    selectedCards.push({ cardNumber: candidate.cardNumber, orientation: candidate.orientation });
  }

  return {
    version: 1,
    createdAt: value.createdAt,
    question: value.question,
    optionalContext: value.optionalContext,
    topic: value.topic as TarotTopic | null,
    categoryId: value.categoryId,
    spreadTemplateId: value.spreadTemplateId,
    reversals: value.reversals,
    selectedCards,
  };
}

export function createTarotRoomResumeDraft(input: Omit<TarotRoomResumeDraft, "version" | "createdAt">, now = Date.now()): TarotRoomResumeDraft | null {
  return parseTarotRoomResumeDraft({ ...input, version: 1, createdAt: now }, now);
}

export function isSafeTarotAuthReturnPath(value: unknown): value is string {
  if (typeof value !== "string" || value.length < 1 || value.length > 1000 || !value.startsWith("/")
    || value.startsWith("//") || value.includes("\\") || /[\u0000-\u001f\u007f]/.test(value)) return false;
  try {
    const url = new URL(value, "https://natarot.invalid");
    if (url.origin !== "https://natarot.invalid") return false;
    if (url.pathname === "/auth" || url.pathname === "/auth/complete" || url.pathname === "/api/auth" || url.pathname.startsWith("/api/auth/")) return false;
    return true;
  } catch {
    return false;
  }
}

export type TarotAuthReturnRecord = { version: 1; createdAt: number; returnTo: string };

export function createTarotAuthReturnRecord(returnTo: string, now = Date.now()): TarotAuthReturnRecord | null {
  return isSafeTarotAuthReturnPath(returnTo) ? { version: 1, createdAt: now, returnTo } : null;
}

export function parseTarotAuthReturnRecord(value: unknown, now = Date.now()): string | null {
  if (!isRecord(value) || Object.keys(value).length !== 3 || value.version !== 1 || !validCreatedAt(value.createdAt, now)
    || !isSafeTarotAuthReturnPath(value.returnTo)) return null;
  return value.returnTo;
}

export function decodeTarotAuthReturnRecord(raw: string | null, now = Date.now()): string | null {
  if (!raw || raw.length > 1200) return null;
  try {
    return parseTarotAuthReturnRecord(JSON.parse(raw), now);
  } catch {
    return null;
  }
}
