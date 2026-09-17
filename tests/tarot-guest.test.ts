import assert from "node:assert/strict";
import test from "node:test";
import { createGuestIdentity, readGuestId } from "../lib/tarot-guest";

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
