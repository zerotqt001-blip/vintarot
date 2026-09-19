import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";

const databaseDirectory = mkdtempSync(join(tmpdir(), "natarot-f001-"));
const databasePath = join(databaseDirectory, "identity.sqlite");
process.env.NATAROT_DB_PATH = databasePath;

const { GET: getRecords } = await import("../app/api/records/route");
const { GET: getRooms } = await import("../app/api/rooms/route");
const { GET: getSession } = await import("../app/api/tarot/session/route");

const database = new DatabaseSync(databasePath);
database.exec(`
  CREATE TABLE records (
    id TEXT PRIMARY KEY,
    owner TEXT NOT NULL,
    kind TEXT NOT NULL,
    data TEXT NOT NULL,
    created INTEGER NOT NULL,
    updated INTEGER NOT NULL
  );
  CREATE TABLE rooms (
    id TEXT PRIMARY KEY,
    owner TEXT NOT NULL,
    state TEXT NOT NULL,
    revision INTEGER NOT NULL,
    invite TEXT NOT NULL,
    created INTEGER NOT NULL,
    updated INTEGER NOT NULL
  );
  CREATE TABLE room_members (
    id TEXT PRIMARY KEY,
    room TEXT NOT NULL,
    user TEXT NOT NULL,
    name TEXT NOT NULL
  );
  CREATE TABLE reading_sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    guest_id TEXT,
    question TEXT NOT NULL,
    optional_context TEXT NOT NULL,
    category_id TEXT NOT NULL,
    spread_template_id TEXT NOT NULL,
    spread_type TEXT NOT NULL,
    card_count INTEGER NOT NULL,
    locale TEXT NOT NULL,
    status TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );
  CREATE TABLE reading_cards (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    card_id TEXT NOT NULL,
    spread_position_id TEXT NOT NULL,
    position_key TEXT NOT NULL,
    position_order INTEGER NOT NULL,
    position_label TEXT NOT NULL,
    orientation TEXT NOT NULL,
    card_order INTEGER NOT NULL,
    created_at INTEGER NOT NULL
  );
  CREATE TABLE tarot_cards (
    id TEXT PRIMARY KEY,
    deck_id TEXT NOT NULL,
    card_number INTEGER NOT NULL,
    slug TEXT NOT NULL,
    name_en TEXT NOT NULL,
    name_vi TEXT NOT NULL,
    arcana TEXT NOT NULL,
    suit TEXT NOT NULL,
    image_url TEXT NOT NULL,
    display_order INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );
  CREATE TABLE spread_positions (
    id TEXT PRIMARY KEY,
    spread_template_id TEXT NOT NULL,
    position_key TEXT NOT NULL,
    position_order INTEGER NOT NULL,
    label_en TEXT NOT NULL,
    label_vi TEXT NOT NULL,
    description_en TEXT NOT NULL,
    description_vi TEXT NOT NULL,
    prompt_en TEXT NOT NULL,
    prompt_vi TEXT NOT NULL
  );
  INSERT INTO records VALUES ('victim-record', 'victim-id', 'profile', '{"name":"Victim"}', 1, 1);
  INSERT INTO rooms VALUES ('victim-room', 'victim-id', '{"phase":"ready"}', 0, 'victim-invite', 1, 1);
  INSERT INTO reading_sessions VALUES ('victim-session', 'victim-id', NULL, 'Victim question', '', 'category', 'spread', 'line', 1, 'en', 'drawn', 1, 1);
`);

const spoofedHeaders = {
  "oai-authenticated-user-id": "victim-id",
  "oai-authenticated-user-email": "attacker@example.test",
  "oai-authenticated-user-full-name": "Attacker%20Name",
  "oai-authenticated-user-full-name-encoding": "percent-encoded-utf-8",
};

function spoofedRequest(path: string): Request {
  return new Request(`https://natarot.com${path}`, { headers: spoofedHeaders });
}

test.after(() => {
  database.close();
  rmSync(databaseDirectory, { recursive: true, force: true });
});

test("spoofed identity cannot read another owner's records", async () => {
  const response = await getRecords(spoofedRequest("/api/records?kind=profile"));
  assert.equal(response.status, 200);
  const body = await response.json() as { items: unknown[] };
  assert.deepEqual(body.items, []);
});

test("spoofed identity cannot read another owner's rooms", async () => {
  const response = await getRooms(spoofedRequest("/api/rooms"));
  assert.equal(response.status, 200);
  const body = await response.json() as { items: unknown[] };
  assert.deepEqual(body.items, []);
});

test("spoofed identity cannot read another owner's Tarot session", async () => {
  const response = await getSession(spoofedRequest("/api/tarot/session?id=victim-session"));
  assert.equal(response.status, 404);
});
