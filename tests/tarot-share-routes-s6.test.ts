import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test, { type TestContext } from "node:test";

const repoRoot = fileURLToPath(new URL("../", import.meta.url));
const baseUrl = "https://natarot.test";
const guestId = "guest-share-e2e";

type Fixture = {
  sqlite: DatabaseSync;
  sessionId: string;
  readingId: string;
};

function makeFixture(context: TestContext): Fixture {
  const directory = mkdtempSync(join(tmpdir(), "natarot-share-route-s6-"));
  const dbPath = join(directory, "natarot.sqlite");
  const previousPath = process.env.NATAROT_DB_PATH;
  const previousOrigin = process.env.NATAROT_PUBLIC_ORIGIN;
  process.env.NATAROT_DB_PATH = dbPath;
  process.env.NATAROT_PUBLIC_ORIGIN = baseUrl;
  execFileSync(process.execPath, ["scripts/node-migrate.mjs"], {
    cwd: repoRoot,
    env: { ...process.env, NATAROT_DB_PATH: dbPath },
    stdio: "pipe",
  });

  const sqlite = new DatabaseSync(dbPath);
  sqlite.exec("PRAGMA foreign_keys = ON;");
  const catalog = sqlite.prepare(`
    SELECT
      c.id AS categoryId,
      t.id AS templateId,
      t.spread_type AS spreadType,
      t.card_count AS cardCount,
      p.id AS positionId,
      p.position_key AS positionKey,
      p.position_order AS positionOrder,
      p.label_en AS labelEn,
      p.description_en AS descriptionEn,
      p.prompt_en AS promptEn,
      tc.id AS cardId,
      tc.card_number AS cardNumber,
      tc.name_en AS nameEn,
      tc.name_vi AS nameVi,
      tc.arcana,
      tc.suit,
      tc.image_url AS imageUrl
    FROM spread_categories c
    JOIN spread_templates t ON t.category_id = c.id
    JOIN spread_positions p ON p.spread_template_id = t.id AND p.position_order = 0
    JOIN tarot_cards tc ON tc.deck_id = (SELECT id FROM decks ORDER BY id LIMIT 1)
    WHERE t.card_count = 1
    ORDER BY c.id, t.id, p.id, tc.id
    LIMIT 1
  `).get() as {
    categoryId: string;
    templateId: string;
    spreadType: string;
    cardCount: number;
    positionId: string;
    positionKey: string;
    positionOrder: number;
    labelEn: string;
    descriptionEn: string;
    promptEn: string;
    cardId: string;
    cardNumber: number;
    nameEn: string;
    nameVi: string;
    arcana: string;
    suit: string;
    imageUrl: string;
  };
  const sessionId = "session-share-e2e";
  const readingId = "reading-share-e2e";
  const timestamp = 1_700_000_000_000;
  sqlite.prepare("INSERT INTO reading_sessions (id, user_id, guest_id, question, optional_context, category_id, spread_template_id, spread_type, card_count, locale, status, created_at, updated_at) VALUES (?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").run(
    sessionId,
    guestId,
    "What should I notice next?",
    "A private context that must stay owner-scoped.",
    catalog.categoryId,
    catalog.templateId,
    catalog.spreadType,
    catalog.cardCount,
    "en",
    "complete",
    timestamp,
    timestamp,
  );
  const readingCardId = "reading-card-share-e2e";
  sqlite.prepare("INSERT INTO reading_cards (id, session_id, card_id, spread_position_id, position_key, position_order, position_label, orientation, card_order, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").run(
    readingCardId,
    sessionId,
    catalog.cardId,
    catalog.positionId,
    catalog.positionKey,
    catalog.positionOrder,
    catalog.labelEn,
    "upright",
    0,
    timestamp,
  );
  const position = {
    id: catalog.positionId,
    key: catalog.positionKey,
    order: catalog.positionOrder,
    name: catalog.labelEn,
    meaning: catalog.descriptionEn,
    prompt: catalog.promptEn,
  };
  const card = {
    id: catalog.cardId,
    nameEn: catalog.nameEn,
    nameVi: catalog.nameVi,
    arcana: catalog.arcana,
    suit: catalog.suit || null,
    keywords: [],
  };
  const payload = {
    directAnswer: "Your question has room for one clear next step.\n\nNotice what feels possible before you ask for certainty.",
    personalInsights: [{ title: "Notice", body: "A small observation can change the next choice." }],
    reflectionPrompts: ["What feels possible today?"],
    nextSteps: [{ title: "Try this", body: "Choose one gentle action and finish it." }],
    cardEvidence: [{ readingCardId, position, card, orientation: "upright", interpretation: "The card invites a grounded beginning." }],
    deeperReading: null,
    followUpSuggestions: ["Keep the reflection close to your lived experience."],
    disclaimer: "A reflective reading, not certainty.",
  };
  sqlite.prepare("INSERT INTO readings (id, session_id, opening, card_readings, synthesis, advice, closing, disclaimer, reading_payload, model_name, prompt_version, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").run(
    readingId,
    sessionId,
    payload.directAnswer,
    JSON.stringify(payload.cardEvidence),
    "A small observation can change the next choice.",
    "Choose one gentle action and finish it.",
    "Let the next step stay small.",
    payload.disclaimer,
    JSON.stringify(payload),
    "test-model",
    "test-prompt",
    timestamp,
    timestamp,
  );

  context.after(() => {
    sqlite.close();
    rmSync(directory, { recursive: true, force: true });
    if (previousPath === undefined) delete process.env.NATAROT_DB_PATH;
    else process.env.NATAROT_DB_PATH = previousPath;
    if (previousOrigin === undefined) delete process.env.NATAROT_PUBLIC_ORIGIN;
    else process.env.NATAROT_PUBLIC_ORIGIN = previousOrigin;
  });
  return { sqlite, sessionId, readingId };
}

function request(url: string, init: RequestInit = {}, requestedGuestId = guestId): Request {
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  headers.set("cookie", `vintarot_guest=${requestedGuestId}`);
  return new Request(url, { ...init, headers });
}

test("S6 owner share route closes the create, public, image, analytics, and revoke loop", async (context) => {
  const fixture = makeFixture(context);
  const { POST } = await import("../app/api/tarot/shares/route");
  const { DELETE } = await import("../app/api/tarot/shares/[token]/route");
  const { POST: eventPOST } = await import("../app/api/tarot/shares/[token]/events/route");
  const { GET: imageGET } = await import("../app/r/[token]/image.svg/route");
  const { getProductionShareService } = await import("../lib/tarot-share-runtime");

  const invalidOrigin = await POST(request(`${baseUrl}/api/tarot/shares`, {
    method: "POST",
    headers: { origin: "https://attacker.example" },
    body: JSON.stringify({ reading_id: fixture.readingId, session_id: fixture.sessionId }),
  }));
  assert.equal(invalidOrigin.status, 403);

  const createdResponse = await POST(request(`${baseUrl}/api/tarot/shares`, {
    method: "POST",
    body: JSON.stringify({ reading_id: fixture.readingId, session_id: fixture.sessionId }),
  }));
  assert.equal(createdResponse.status, 201);
  const created = await createdResponse.json() as { share_url: string; image_url: string; created_at: number; token?: string };
  assert.deepEqual(Object.keys(created).sort(), ["created_at", "image_url", "share_url"]);
  assert.equal(created.share_url.startsWith(`${baseUrl}/r/`), true);
  const token = new URL(created.share_url).pathname.split("/").at(-1)!;
  assert.equal(token.length, 43);
  assert.equal(created.image_url, `${baseUrl}/r/${token}/image.svg`);

  const duplicate = await POST(request(`${baseUrl}/api/tarot/shares`, {
    method: "POST",
    body: JSON.stringify({ reading_id: fixture.readingId, session_id: fixture.sessionId }),
  }));
  assert.equal(duplicate.status, 409);
  assert.deepEqual(await duplicate.json(), { error: "An active share already exists for this reading." });

  const view = await (await getProductionShareService()).resolvePublicShare(token);
  assert.ok(view);
  assert.equal(view.question, "What should I notice next?");
  assert.equal(JSON.stringify(view).includes("private context"), false);

  const image = await imageGET(new Request(`${baseUrl}/r/${token}/image.svg`), { params: Promise.resolve({ token }) });
  assert.equal(image.status, 200);
  assert.match(image.headers.get("Content-Type") || "", /^image\/svg\+xml/);
  assert.equal((await image.text()).includes("<svg"), true);
  assert.equal(image.headers.get("X-Robots-Tag"), "noindex, nofollow");

  const eventBody = { event_id: "00000000-0000-4000-8000-000000000101", event_name: "share_opened", locale: "en" };
  const eventResponse = await eventPOST(request(`${baseUrl}/api/tarot/shares/${token}/events`, {
    method: "POST",
    body: JSON.stringify(eventBody),
  }), { params: Promise.resolve({ token }) });
  assert.equal(eventResponse.status, 202);
  assert.equal((fixture.sqlite.prepare("SELECT COUNT(*) AS count FROM share_events WHERE event_name = 'share_opened'").get() as { count: number }).count, 1);

  const foreignRevoke = await DELETE(request(`${baseUrl}/api/tarot/shares/${token}`, { method: "DELETE" }, "guest-other-e2e"), { params: Promise.resolve({ token }) });
  assert.equal(foreignRevoke.status, 204);
  assert.equal((await (await getProductionShareService()).resolvePublicShare(token)) !== null, true);

  const revoked = await DELETE(request(`${baseUrl}/api/tarot/shares/${token}`, { method: "DELETE" }), { params: Promise.resolve({ token }) });
  assert.equal(revoked.status, 204);
  assert.equal(await revoked.text(), "");
  const repeated = await DELETE(request(`${baseUrl}/api/tarot/shares/${token}`, { method: "DELETE" }), { params: Promise.resolve({ token }) });
  assert.equal(repeated.status, 204);
  assert.equal(await (await getProductionShareService()).resolvePublicShare(token), null);

  const imageAfterRevoke = await imageGET(new Request(`${baseUrl}/r/${token}/image.svg`), { params: Promise.resolve({ token }) });
  assert.equal(imageAfterRevoke.status, 404);
  assert.equal((fixture.sqlite.prepare("SELECT status FROM reading_shares WHERE id = (SELECT share_id FROM share_events WHERE event_name = 'share_opened' LIMIT 1)").get() as { status: string }).status, "revoked");
});
