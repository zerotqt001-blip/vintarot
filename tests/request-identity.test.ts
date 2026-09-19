import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
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

test("untrusted ChatGPT identity headers remain a guest request", async () => {
  const request = new Request("https://natarot.com/api/rooms", { headers: {
    "oai-authenticated-user-id": "victim-id",
    "oai-authenticated-user-email": "attacker@example.test",
    "oai-authenticated-user-full-name": "Attacker%20Name",
    "oai-authenticated-user-full-name-encoding": "percent-encoded-utf-8",
  }});
  const identity = await readRequestIdentity(request);
  assert.equal(identity.kind, "guest");
  assert.notEqual(identity.userId, "victim-id");
  assert.equal(identity.email, "guest@local.invalid");
  assert.equal(identity.fullName, "Guest");
  assert.equal(identity.owner.kind, "guest");
});

test("the VPS proxy clears every discovered ChatGPT identity header", () => {
  const nginx = readFileSync(new URL("../deploy/nginx/natarot-http.conf", import.meta.url), "utf8");
  for (const header of [
    "oai-authenticated-user-id",
    "oai-authenticated-user-email",
    "oai-authenticated-user-full-name",
    "oai-authenticated-user-full-name-encoding",
  ]) {
    assert.match(nginx, new RegExp(`proxy_set_header ${header} \\"\\";`));
  }
});
