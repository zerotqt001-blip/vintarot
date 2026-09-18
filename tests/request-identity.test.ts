import assert from "node:assert/strict";
import test from "node:test";
import { readRequestIdentity } from "../lib/request-identity";

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

test("ChatGPT headers remain the authenticated owner", async () => {
  const request = new Request("https://natarot.com/api/rooms", { headers: {
    "oai-authenticated-user-id": "user-123",
    "oai-authenticated-user-email": "reader@example.test",
    "oai-authenticated-user-full-name": "Reader%20Name",
    "oai-authenticated-user-full-name-encoding": "percent-encoded-utf-8",
  }});
  const identity = await readRequestIdentity(request);
  assert.deepEqual({ kind: identity.kind, userId: identity.userId, email: identity.email, fullName: identity.fullName }, {
    kind: "user", userId: "user-123", email: "reader@example.test", fullName: "Reader Name",
  });
  assert.equal(identity.setCookie, undefined);
});
