import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { createMemberAuthStore } from "../lib/member-auth";
import { readRequestIdentity } from "../lib/request-identity";
import { createSqliteD1Database } from "../lib/sqlite-d1";

const memberAuthMigration = readFileSync(new URL("../drizzle/0004_member_auth.sql", import.meta.url), "utf8");

function createMemberSessionFixture(now = Date.now) {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(memberAuthMigration);
  const database = createSqliteD1Database(sqlite);
  return { database, sqlite, store: createMemberAuthStore(database, now) };
}

test("missing ChatGPT headers creates a stable guest owner and cookie", async () => {
  const first = await readRequestIdentity(new Request("https://natarot.com/api/rooms"));
  assert.equal(first.kind, "guest");
  assert.match(first.userId, /^guest:[A-Za-z0-9._-]{8,200}$/);
  assert.equal(first.email, "guest@local.invalid");
  const cookie = first.setCookie;
  if (!cookie) throw new Error("Expected a guest cookie");

  const second = await readRequestIdentity(new Request("https://natarot.com/api/rooms", {
    headers: { Cookie: cookie.split(";")[0] },
  }));
  assert.equal(second.userId, first.userId);
  if (!first.guestId) throw new Error("Expected a guest id");
  assert.equal(JSON.stringify(second).includes(first.guestId), true);
});

test("member sessions resolve a member owner before guest fallback", async (t) => {
  const { database, sqlite, store } = createMemberSessionFixture();
  t.after(() => sqlite.close());
  const member = await store.createMember({
    email: "reader@example.test",
    username: "moon_reader",
    phone: "+84912345678",
    passwordHash: null,
    displayName: "Moon Reader",
  });
  const { raw: rawSession } = await store.createSession(member.id, false);

  const memberIdentity = await readRequestIdentity(
    new Request("https://natarot.com/api/rooms", { headers: { Cookie: `natarot_session=${rawSession}` } }),
    database,
  );

  assert.equal(memberIdentity.userId, `member:${member.id}`);
  assert.equal(memberIdentity.owner.kind, "user");
  assert.equal(memberIdentity.owner.userId, `member:${member.id}`);
  assert.equal(memberIdentity.displayName, "Moon Reader");
  assert.equal(memberIdentity.email, "reader@example.test");
  assert.equal(memberIdentity.fullName, "Moon Reader");
  assert.equal(memberIdentity.setCookie, undefined);
});

test("ChatGPT headers are ignored and fall back to a guest owner", async () => {
  const request = new Request("https://natarot.com/api/rooms", { headers: {
    "oai-authenticated-user-id": "user-123",
    "oai-authenticated-user-email": "reader@example.test",
    "oai-authenticated-user-full-name": "Reader%20Name",
    "oai-authenticated-user-full-name-encoding": "percent-encoded-utf-8",
  }});
  const identity = await readRequestIdentity(request);
  assert.equal(identity.kind, "guest");
  assert.match(identity.userId, /^guest:[A-Za-z0-9._-]{8,200}$/);
  assert.equal(identity.owner.kind, "guest");
  assert.ok(identity.setCookie);
});

test("expired member sessions fall back to a guest owner", async (t) => {
  let clock = 1_700_000_000_000;
  const { database, sqlite, store } = createMemberSessionFixture(() => clock);
  t.after(() => sqlite.close());
  const member = await store.createMember({
    email: "expired@example.test",
    username: "expired_reader",
    phone: "+84912345678",
    passwordHash: null,
  });
  const { raw: rawSession } = await store.createSession(member.id, false, 1);
  clock += 2;

  const identity = await readRequestIdentity(
    new Request("https://natarot.com/api/rooms", { headers: { Cookie: `natarot_session=${rawSession}` } }),
    database,
  );

  assert.equal(identity.kind, "guest");
  assert.equal(identity.owner.kind, "guest");
  assert.notEqual(identity.userId, `member:${member.id}`);
  assert.ok(identity.setCookie);
});
