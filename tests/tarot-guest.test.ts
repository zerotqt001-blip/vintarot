import assert from "node:assert/strict";
import test from "node:test";
import { createGuestIdentity, readGuestId, readOptionalOwner } from "../lib/tarot-guest";

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
