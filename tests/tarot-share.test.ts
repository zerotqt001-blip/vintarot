import test from "node:test";
import assert from "node:assert/strict";
import type { D1Database } from "@cloudflare/workers-types";
import type { TarotReadingPayload } from "../lib/ai/types";
import type { ReadingOwner } from "../lib/tarot-guest";
import type { TarotRepository } from "../lib/tarot-repository";
import type { ShareableReadingSnapshot } from "../lib/tarot-share-contract";
import {
  SHARE_GEOMETRY_VERSION,
  SHARE_PROJECTION_VERSION,
  SHARE_RENDERER_VERSION,
} from "../lib/tarot-share-contract";
import { buildPublicShareUrl, buildShareImageUrl, resolvePublicOrigin } from "../lib/tarot-share-config";
import { generateShareToken, hashShareToken, isShareToken, SHARE_TOKEN_BYTES } from "../lib/tarot-share-identity";
import { projectPublicReading } from "../lib/tarot-share-projection";
import { ShareService } from "../lib/tarot-share-service";
import { InMemoryShareStore, ShareStorageUnavailableError, UnavailableShareStore } from "../lib/tarot-share-store";
import { renderShareImage } from "../lib/tarot-share-image";
import { buildShareQrPayload, generateShareQrSvg } from "../lib/tarot-share-qr";
import { buildShareableReadingSnapshot } from "../lib/tarot-share-source";

const owner: ReadingOwner = { kind: "user", userId: "member:test-owner" };
const cardArtwork = [
  "/cards/the-fool.webp",
  "/cards/the-magician.webp",
  "/cards/the-star.webp",
  "/cards/the-sun.webp",
  "/cards/the-moon.webp",
  "/cards/death.webp",
  "/cards/justice.webp",
  "/cards/strength.webp",
  "/cards/temperance.webp",
  "/cards/the-world.webp",
  "/cards/the-tower.webp",
  "/cards/the-emperor.webp",
];

function snapshotFor(count = 3, spreadType = count === 3 ? "row-3" : "generic"): ShareableReadingSnapshot {
  const positions = Array.from({ length: count }, (_, index) => ({
    id: `position-${index}`,
    key: `position-${index}`,
    order: index,
    label: `Position ${index + 1}`,
    meaning: `Meaning ${index + 1}`,
    prompt: `Prompt ${index + 1}`,
  }));
  const cards = positions.map((position, index) => ({
    readingCardId: `reading-card-${index}`,
    cardId: `card-${index}`,
    cardNumber: index + 1,
    nameEn: `The Card ${index + 1}`,
    nameVi: `Lá bài ${index + 1}`,
    imageUrl: cardArtwork[index % cardArtwork.length],
    positionId: position.id,
    positionKey: position.key,
    positionOrder: position.order,
    position,
    orientation: index % 2 === 0 ? "upright" as const : "reversed" as const,
  }));
  const cardEvidence = cards.map((card) => ({
    readingCardId: card.readingCardId,
    position: {
      id: card.position.id,
      key: card.position.key,
      order: card.position.order,
      name: card.position.label,
      meaning: card.position.meaning,
      prompt: card.position.prompt,
    },
    card: {
      id: card.cardId,
      nameEn: card.nameEn,
      nameVi: card.nameVi,
      arcana: "major",
      suit: null,
      keywords: [],
    },
    orientation: card.orientation,
    interpretation: `Interpretation ${card.position.order + 1}`,
  }));
  const reading: TarotReadingPayload = {
    directAnswer: "The answer stays close to the question.",
    personalInsights: [{ title: "Notice", body: "A grounded insight." }],
    reflectionPrompts: ["What do you notice first?"],
    nextSteps: [{ title: "Try this", body: "Take one clear next step." }],
    cardEvidence,
    deeperReading: null,
    followUpSuggestions: ["This must not cross the public projection."],
    disclaimer: "A reflective reading, not certainty.",
  };
  return {
    locale: "en",
    question: "What should I notice now?",
    spread: { name: `${count}-card spread`, spreadType, cardCount: count, positions },
    cards,
    reading,
  };
}

function shareRecord(tokenHash = "a".repeat(64)) {
  return {
    id: "share:record-test",
    tokenHash,
    owner,
    readingId: "reading-private",
    sessionId: "session-private",
    status: "active" as const,
    locale: "en" as const,
    projectionVersion: SHARE_PROJECTION_VERSION,
    geometryVersion: SHARE_GEOMETRY_VERSION,
    rendererVersion: SHARE_RENDERER_VERSION,
    createdAt: 1_000,
    updatedAt: 1_000,
    revokedAt: null,
    expiresAt: null,
  };
}

test("S2 source resolves only owner-scoped canonical data and preserves normalized compatibility", async () => {
  const position = {
    id: "position-focus",
    templateId: "template-one",
    key: "focus",
    order: 0,
    name: "Focus",
    meaning: "What is most present.",
    prompt: "What is asking for attention?",
  };
  const card = {
    id: "reading-card-one",
    sessionId: "session-one",
    cardId: "card-one",
    spreadPositionId: position.id,
    positionKey: position.key,
    positionOrder: 0,
    positionLabel: position.name,
    orientation: "upright",
    cardOrder: 0,
    deckId: "deck-rider-waite-smith",
    cardNumber: 0,
    slug: "the-fool",
    nameEn: "The Fool",
    nameVi: "Kẻ Khờ",
    arcana: "major",
    suit: "",
    imageUrl: "/cards/the-fool.webp",
    positionPrompt: position.prompt,
    positionDescription: position.meaning,
  };
  const session = {
    id: "session-one",
    userId: owner.kind === "user" ? owner.userId : null,
    guestId: null,
    question: "Where should I begin?",
    optionalContext: "private context must not cross the source boundary",
    categoryId: "category-everyday",
    spreadTemplateId: "template-one",
    spreadType: "single",
    cardCount: 1,
    locale: "en" as const,
    status: "complete",
  };
  const readingPayload = {
    directAnswer: "Your question has room for one clear beginning.\n\nLet the first step be small enough to notice.",
    personalInsights: [{ title: "Notice", body: "A small beginning can still be decisive." }],
    reflectionPrompts: [],
    nextSteps: [{ title: "Try this", body: "Choose one action you can finish today." }],
    cardEvidence: [{
      readingCardId: card.id,
      position: { id: position.id, key: position.key, order: position.order, name: position.name, meaning: position.meaning, prompt: position.prompt },
      card: { id: card.cardId, nameEn: card.nameEn, nameVi: card.nameVi, arcana: card.arcana, suit: null, keywords: [] },
      orientation: "upright" as const,
      interpretation: "The card points toward an open, curious beginning.",
    }],
    deeperReading: null,
    followUpSuggestions: ["Private follow-up must not be projected."],
    disclaimer: "A reflective reading, not certainty.",
  };
  const row = {
    id: "reading-one",
    sessionId: session.id,
    opening: readingPayload.directAnswer,
    cardReadings: "[]",
    synthesis: "",
    advice: "",
    closing: "",
    disclaimer: readingPayload.disclaimer,
    readingPayload: JSON.stringify(readingPayload),
    modelName: "private-provider",
    promptVersion: "private-prompt",
    createdAt: 1,
    updatedAt: 1,
  };
  const repository = {
    async getSessionForOwner(sessionId: string, requestedOwner: ReadingOwner) {
      if (sessionId !== session.id || requestedOwner.kind !== "user" || requestedOwner.userId !== owner.userId) return null;
      return { session, cards: [card] };
    },
    async getLatestReadingForOwner(sessionId: string, requestedOwner: ReadingOwner) {
      if (sessionId !== session.id || requestedOwner.kind !== "user" || requestedOwner.userId !== owner.userId) return null;
      return row;
    },
    async getReadingTemplate() {
      return { category: { id: "category-everyday", slug: "everyday", name: "Everyday", description: "" }, template: { id: "template-one", categoryId: "category-everyday", slug: "one", name: "One Card", description: "", cardCount: 1, spreadType: "single" }, positions: [position] };
    },
  } as unknown as TarotRepository;
  const snapshot = await buildShareableReadingSnapshot({ database: {} as D1Database, repository, owner, readingId: row.id, sessionId: session.id });
  assert.ok(snapshot);
  assert.equal(snapshot.question, session.question);
  assert.equal(snapshot.cards[0]?.imageUrl, "/cards/the-fool.webp");
  assert.equal(snapshot.reading.followUpSuggestions[0], "Private follow-up must not be projected.");
  const denied = await buildShareableReadingSnapshot({ database: {} as D1Database, repository, owner: { kind: "user", userId: "member:other" }, readingId: row.id, sessionId: session.id });
  assert.equal(denied, null);
});

test("S1 generates an opaque URL-safe share token", async () => {
  const token = await generateShareToken();
  assert.equal(isShareToken(token), true);
  assert.equal(token.length, 43);
});

test("S1 token hashing is stable and does not use the raw token as the digest", async () => {
  const token = "A".repeat(43);
  const hash = await hashShareToken(token);
  assert.match(hash, /^[a-f0-9]{64}$/);
  assert.notEqual(hash, token);
  assert.equal((await hashShareToken(token)), hash);
  assert.equal(SHARE_TOKEN_BYTES, 32);
});

test("S1 rejects malformed token shapes before hashing or URL construction", async () => {
  await assert.rejects(() => hashShareToken("short"), /share token is invalid/i);
  assert.equal(isShareToken("a".repeat(42)), false);
  assert.equal(isShareToken("a".repeat(44)), false);
  assert.throws(() => buildPublicShareUrl("not-a-token"), /share token is invalid/i);
});

test("S1 public origin is configured explicitly and never inferred from a request host", () => {
  assert.equal(resolvePublicOrigin({ NATAROT_PUBLIC_ORIGIN: "https://share.example.test/" }), "https://share.example.test");
  assert.equal(resolvePublicOrigin({ NATAROT_PUBLIC_ORIGIN: "not-an-origin" }), "https://natarot.com");
  assert.equal(resolvePublicOrigin({ NATAROT_PUBLIC_ORIGIN: "https://share.example.test/private" }), "https://natarot.com");
  const token = "B".repeat(43);
  assert.equal(buildPublicShareUrl(token, "https://share.example.test"), `https://share.example.test/r/${token}`);
  assert.equal(buildShareImageUrl(token, "https://share.example.test"), `https://share.example.test/r/${token}/image.svg`);
});

test("S2 projects only allowlisted public reading fields", () => {
  const token = "C".repeat(43);
  const view = projectPublicReading({ record: shareRecord(), token, snapshot: snapshotFor() });
  assert.equal(view.publicUrl, `https://natarot.com/r/${token}`);
  assert.equal(view.imageUrl, `https://natarot.com/r/${token}/image.svg`);
  assert.equal(view.cards.length, 3);
  assert.equal(view.reading.cardEvidence.length, 3);
  assert.equal("followUpSuggestions" in view.reading, false);
  const serialized = JSON.stringify(view);
  assert.equal(serialized.includes("reading-private"), false);
  assert.equal(serialized.includes("session-private"), false);
  assert.equal(serialized.includes("member:test-owner"), false);
  assert.equal(serialized.includes("This must not cross"), false);
});

test("S2 keeps localized card labels and uses canonical normalized geometry for 1/3/10/12 cards", () => {
  const token = "D".repeat(43);
  for (const [count, spreadType] of [[1, "single"], [3, "row-3"], [10, "celtic-cross"], [12, "future-12"]] as const) {
    const view = projectPublicReading({
      record: { ...shareRecord(), locale: "vi" },
      token,
      snapshot: { ...snapshotFor(count, spreadType), locale: "vi" },
    });
    assert.equal(view.geometry.length, count);
    assert.equal(view.cards[0]?.name, "Lá bài 1");
    for (const position of view.geometry) {
      assert.ok(position.x >= 0 && position.x <= 1);
      assert.ok(position.y >= 0 && position.y <= 1);
    }
  }
});

test("S2 rejects non-local artwork before it can reach a public view or renderer", () => {
  const invalid = snapshotFor();
  invalid.cards[0] = { ...invalid.cards[0], imageUrl: "https://attacker.example/card.webp" };
  assert.throws(
    () => projectPublicReading({ record: shareRecord(), token: "E".repeat(43), snapshot: invalid }),
    /approved local asset/i,
  );
});

test("S1/S2 service stores only the token hash and revocation closes the public projection", async () => {
  const tokenSnapshot = snapshotFor();
  const source = {
    async loadShareableReading(input: { owner: ReadingOwner; readingId: string; sessionId: string }) {
      assert.equal(input.owner.kind, "user");
      assert.equal(input.readingId, "reading-1");
      assert.equal(input.sessionId, "session-1");
      return tokenSnapshot;
    },
  };
  const store = new InMemoryShareStore();
  const service = new ShareService({ store, source, now: () => 10_000 });
  const created = await service.createShare({ owner, readingId: "reading-1", sessionId: "session-1" });
  assert.equal(isShareToken(created.token), true);
  const stored = await store.findByTokenHash(await hashShareToken(created.token));
  assert.ok(stored);
  assert.equal(JSON.stringify(stored).includes(created.token), false);
  assert.equal(store.getEvents().length, 1);
  assert.ok(await service.resolvePublicShare(created.token));
  assert.equal(await service.revokeShare({ shareId: stored.id, owner }), true);
  assert.equal(await service.resolvePublicShare(created.token), null);
  assert.equal(await service.revokeShare({ shareId: stored.id, owner: { kind: "user", userId: "member:other" } }), false);
});

test("S5 validates privacy-bounded events and makes event IDs idempotent", async () => {
  const store = new InMemoryShareStore();
  const token = "F".repeat(43);
  const tokenHash = await hashShareToken(token);
  await store.create(shareRecord(tokenHash));
  const service = new ShareService({
    store,
    source: { async loadShareableReading() { return snapshotFor(); } },
    now: () => 20_000,
  });
  const event = {
    event_id: "00000000-0000-4000-8000-000000000001",
    event_name: "share_opened" as const,
    locale: "en" as const,
    source: "share" as const,
    created_at: 1,
  };
  assert.deepEqual(await service.recordEvent({ token, event }), { accepted: true, duplicate: false });
  assert.deepEqual(await service.recordEvent({ token, event }), { accepted: true, duplicate: true });
  assert.equal(store.getEvents().length, 1);
  assert.equal(store.getEvents()[0]?.event.created_at, 20_000);
  await assert.rejects(
    () => service.recordEvent({ token, event: { ...event, event_name: "share_opened", ip: "192.0.2.1" } as never }),
    /invalid share event/i,
  );
});

test("migration-gated production store fails closed instead of using a fake persistence path", async () => {
  const store = new UnavailableShareStore();
  await assert.rejects(
    () => store.findByTokenHash("a".repeat(64)),
    (error: unknown) => error instanceof ShareStorageUnavailableError,
  );
});

test("S3 renders deterministic 1200x800 SVG with escaped bilingual-safe text and QR slot", () => {
  const snapshot = snapshotFor(3);
  snapshot.question = "<script>alert('no')</script> & a quiet question";
  snapshot.reading.directAnswer = "A direct answer with <unsafe> text & no executable markup.";
  const view = projectPublicReading({ record: shareRecord(), token: "G".repeat(43), snapshot });
  const qrSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10" fill="#f4ebdd"/><path d="M1 1h8v8H1z" fill="#10283b"/></svg>`;
  const first = renderShareImage(view, { qrSvg });
  const second = renderShareImage(view, { qrSvg });
  assert.equal(new TextDecoder().decode(first.bytes), new TextDecoder().decode(second.bytes));
  assert.equal(first.width, 1200);
  assert.equal(first.height, 800);
  const output = new TextDecoder().decode(first.bytes);
  assert.match(output, /<svg[^>]+width="1200"[^>]+height="800"/);
  assert.match(output, /&lt;script&gt;alert/);
  assert.match(output, /&amp; a quiet question/);
  assert.equal(output.includes("<script>"), false);
  assert.equal(output.includes("reading-private"), false);
  assert.match(output, /viewBox="0 0 10 10"/);
  assert.equal(output.includes("followUpSuggestions"), false);
});

test("S3 handles Celtic Cross and future twelve-card geometry without leaving the canvas contract", () => {
  for (const count of [10, 12]) {
    const spreadType = count === 10 ? "celtic-cross" : "future-12";
    const view = projectPublicReading({ record: shareRecord(), token: "H".repeat(43), snapshot: snapshotFor(count, spreadType) });
    const result = renderShareImage(view);
    const output = new TextDecoder().decode(result.bytes);
    assert.equal((output.match(/<image /g) || []).length, count);
    assert.equal(output.includes("NaTarot"), true);
    assert.equal(output.includes("undefined"), false);
  }
});

test("S3 rejects unsafe injected QR markup", () => {
  const view = projectPublicReading({ record: shareRecord(), token: "I".repeat(43), snapshot: snapshotFor(1, "single") });
  assert.throws(() => renderShareImage(view, { qrSvg: `<svg><script>alert(1)</script></svg>` }), /QR markup is not safe/i);
});

test("S4 generates a deterministic QR SVG for the trusted canonical URL", async () => {
  const token = "J".repeat(43);
  const payload = buildShareQrPayload(token, "https://share.example.test");
  assert.equal(payload, `https://share.example.test/r/${token}`);
  const first = await generateShareQrSvg(token, { origin: "https://share.example.test" });
  const second = await generateShareQrSvg(token, { origin: "https://share.example.test" });
  assert.equal(first, second);
  assert.match(first, /^<svg\b/);
  assert.match(first, /#10283b/i);
  assert.match(first, /#f4ebdd/i);
  assert.equal(first.includes("share.example.test"), false);
});

test("S4 rejects malformed QR tokens and never accepts a request-host substitute", async () => {
  await assert.rejects(() => generateShareQrSvg("bad-token"), /share token is invalid/i);
  assert.equal(buildShareQrPayload("K".repeat(43)), `https://natarot.com/r/${"K".repeat(43)}`);
});
