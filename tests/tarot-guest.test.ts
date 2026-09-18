import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { createMemberAuthStore } from "../lib/member-auth";
import { createSqliteD1Database } from "../lib/sqlite-d1";
import { createGuestIdentity, readGuestId, readOptionalOwner } from "../lib/tarot-guest";

const memberAuthMigration = readFileSync(new URL("../drizzle/0004_member_auth.sql", import.meta.url), "utf8");

function createMemberSessionFixture() {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(memberAuthMigration);
  const database = createSqliteD1Database(sqlite);
  return { database, sqlite, store: createMemberAuthStore(database) };
}

test("guest identity creates a reusable HttpOnly cookie and reads it from requests", () => {
  const identity = createGuestIdentity("guest-test-id");
  assert.equal(identity.guestId, "guest-test-id");
  assert.match(identity.setCookie, /^vintarot_guest=guest-test-id; Path=\/; Max-Age=2592000; HttpOnly; SameSite=Lax; Secure$/);
  const request = new Request("https://example.test/api/tarot/session", { headers: { Cookie: identity.setCookie.split(";")[0] } });
  assert.equal(readGuestId(request), "guest-test-id");
});

test("guest identity ignores unrelated or malformed cookies", () => {
  assert.equal(readGuestId(new Request("https://example.test", { headers: { Cookie: "other=value" } })), null);
  assert.equal(readGuestId(new Request("https://example.test", { headers: { Cookie: "vintarot_guest=" } })), null);
});

test("guest cookies follow the effective HTTP protocol", async () => {
  const http = await readOptionalOwner(new Request("http://natarot.com/api/tarot/draw"));
  assert.ok(http.setCookie);
  assert.doesNotMatch(http.setCookie, /; Secure$/);

  const https = await readOptionalOwner(new Request("https://natarot.com/api/tarot/draw"));
  assert.ok(https.setCookie);
  assert.match(https.setCookie, /; Secure$/);

  const forwardedHttps = await readOptionalOwner(new Request("http://127.0.0.1:8787/api/tarot/draw", {
    headers: { "x-forwarded-proto": "https" },
  }));
  assert.ok(forwardedHttps.setCookie);
  assert.match(forwardedHttps.setCookie, /; Secure$/);
});

test("member sessions produce exact member owners", async (t) => {
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

  const identity = await readOptionalOwner(
    new Request("https://natarot.com/api/tarot/session", { headers: { Cookie: `natarot_session=${rawSession}` } }),
    database,
  );

  assert.deepEqual(identity.owner, { kind: "user", userId: `member:${member.id}` });
  assert.equal(identity.member?.id, member.id);
  assert.equal(identity.member?.displayName, "Moon Reader");
  assert.equal(identity.setCookie, undefined);
});

test("invalid member sessions retain an existing guest identity", async (t) => {
  const { database, sqlite } = createMemberSessionFixture();
  t.after(() => sqlite.close());

  const identity = await readOptionalOwner(new Request("https://natarot.com/api/tarot/session", {
    headers: { Cookie: "natarot_session=invalid-session; vintarot_guest=guest-test-id" },
  }), database);

  assert.deepEqual(identity.owner, { kind: "guest", guestId: "guest-test-id" });
  assert.equal(identity.member, undefined);
  assert.equal(identity.setCookie, undefined);
});
