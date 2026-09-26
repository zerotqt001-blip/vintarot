import assert from "node:assert/strict";
import test from "node:test";
import { findCanonicalSpread } from "../lib/tarot-recommendation";
import {
  createTarotAuthReturnRecord,
  createTarotRoomResumeDraft,
  decodeTarotAuthReturnRecord,
  parseTarotRoomResumeDraft,
  TAROT_AUTH_RETURN_STORAGE_KEY,
  TAROT_ROOM_RESUME_MAX_AGE_MS,
  TAROT_ROOM_RESUME_STORAGE_KEY,
  type TarotRoomResumeDraft,
} from "../lib/tarot-room-resume";

const now = 1_800_000_000_000;
const spread = findCanonicalSpread("category-everyday", "spread-everyday-persona-obstacle-solution")
  ?? findCanonicalSpread("category-everyday", "template-persona-obstacle-solution")
  ?? findCanonicalSpread("category-everyday", "spread-persona-obstacle-solution");
if (!spread) throw new Error("Resume test spread is not available in the canonical catalog");
const canonicalSpread = spread!;

function validDraft(): TarotRoomResumeDraft {
  const cardNumbers = Array.from({ length: canonicalSpread.template.cardCount }, (_, index) => index);
  return createTarotRoomResumeDraft({
    question: "What deserves my attention?",
    optionalContext: "Keep it practical.",
    topic: "work",
    categoryId: canonicalSpread.category.id,
    spreadTemplateId: canonicalSpread.template.id,
    reversals: true,
    selectedCards: cardNumbers.map((cardNumber, index) => ({ cardNumber, orientation: index === 1 ? "reversed" : "upright" })),
  }, now)!;
}

test("resume drafts round-trip only bounded reading choices and same-tab storage keys", () => {
  const draft = validDraft();
  assert.deepEqual(parseTarotRoomResumeDraft(draft, now), draft);
  assert.equal(draft.createdAt, now);
  assert.equal(TAROT_ROOM_RESUME_STORAGE_KEY, "natarot:tarot-room-resume:v1");
  assert.equal(TAROT_AUTH_RETURN_STORAGE_KEY, "natarot:auth-return:v1");
  assert.equal(Object.keys(draft).some((key) => /owner|identity|session|cookie|readingId/i.test(key)), false);
});

test("resume drafts expire after one hour and reject future timestamps", () => {
  const draft = validDraft();
  assert.equal(parseTarotRoomResumeDraft(draft, now + TAROT_ROOM_RESUME_MAX_AGE_MS), null);
  assert.equal(parseTarotRoomResumeDraft(draft, now + TAROT_ROOM_RESUME_MAX_AGE_MS - 1)?.question, draft.question);
  assert.equal(parseTarotRoomResumeDraft({ ...draft, createdAt: now + 1 }, now), null);
});

test("resume drafts reject duplicate or out-of-range cards and invalid orientations", () => {
  const draft = validDraft();
  const duplicate = { ...draft, selectedCards: [...draft.selectedCards.slice(0, -1), { ...draft.selectedCards[0] }] };
  assert.equal(parseTarotRoomResumeDraft(duplicate, now), null);
  assert.equal(parseTarotRoomResumeDraft({ ...draft, selectedCards: [{ ...draft.selectedCards[0], cardNumber: 78 }, ...draft.selectedCards.slice(1)] }, now), null);
  assert.equal(parseTarotRoomResumeDraft({ ...draft, selectedCards: [{ ...draft.selectedCards[0], orientation: "sideways" }, ...draft.selectedCards.slice(1)] }, now), null);
});

test("resume drafts require a canonical spread, a complete draw, and bounded text", () => {
  const draft = validDraft();
  assert.equal(parseTarotRoomResumeDraft({ ...draft, categoryId: "missing-category" }, now), null);
  assert.equal(parseTarotRoomResumeDraft({ ...draft, selectedCards: draft.selectedCards.slice(1) }, now), null);
  assert.equal(parseTarotRoomResumeDraft({ ...draft, question: "q".repeat(501) }, now), null);
  assert.equal(parseTarotRoomResumeDraft({ ...draft, optionalContext: "c".repeat(5001) }, now), null);
  assert.equal(parseTarotRoomResumeDraft({ ...draft, version: 2 }, now), null);
  assert.equal(parseTarotRoomResumeDraft({ ...draft, userId: "member:forged" }, now), null);
});

test("auth return records are bounded, same-origin paths and expire with the resume draft", () => {
  const returnTo = "/room?resumeTarot=1";
  const record = createTarotAuthReturnRecord(returnTo, now)!;
  assert.equal(decodeTarotAuthReturnRecord(JSON.stringify(record), now), returnTo);
  assert.equal(decodeTarotAuthReturnRecord(JSON.stringify(record), now + TAROT_ROOM_RESUME_MAX_AGE_MS), null);
  for (const unsafe of ["https://evil.example/", "//evil.example/", "/auth?return_to=/", "/api/auth/login", "/\\evil.example"]) {
    assert.equal(createTarotAuthReturnRecord(unsafe, now), null);
  }
});
