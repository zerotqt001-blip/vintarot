import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { generateMetadata } from "../app/r/[token]/page";
import { GET as imageGET } from "../app/r/[token]/image.svg/route";
import { POST as eventPOST } from "../app/api/tarot/shares/[token]/events/route";
import { checkShareRequestOrigin } from "../lib/tarot-share-http";

const token = "R".repeat(43);

test("S2 public metadata is generic, canonical and noindex/nofollow", async () => {
  const metadata = await generateMetadata({ params: Promise.resolve({ token }) });
  assert.deepEqual(metadata.robots, { index: false, follow: false });
  assert.equal(metadata.referrer, "no-referrer");
  assert.equal(metadata.title, "NaTarot — Shared Tarot reading");
  assert.equal(metadata.openGraph && "images" in metadata.openGraph, true);
  assert.equal(JSON.stringify(metadata).includes("reading-private"), false);
  assert.equal(JSON.stringify(metadata).includes(token), true);
});

test("S2 image route uses the migration-gated unavailable response with privacy headers", async () => {
  const response = await imageGET(new Request(`https://natarot.test/r/${token}/image.svg`), { params: Promise.resolve({ token }) });
  assert.equal(response.status, 503);
  assert.equal(response.headers.get("X-Robots-Tag"), "noindex, nofollow");
  assert.equal(response.headers.get("Referrer-Policy"), "no-referrer");
  assert.equal(response.headers.get("Cache-Control"), "private, no-store");
  assert.equal(await response.text(), JSON.stringify({ error: "Share links are not configured." }));
});

test("S5 event route rejects arbitrary fields but does not reveal whether a token exists", async () => {
  const bad = await eventPOST(new Request("https://natarot.test/api/tarot/shares/not-a-token/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ event_id: "not-an-id", event_name: "share_opened", locale: "en", ip: "192.0.2.1" }),
  }), { params: Promise.resolve({ token: "not-a-token" }) });
  assert.equal(bad.status, 400);

  const accepted = await eventPOST(new Request("https://natarot.test/api/tarot/shares/not-a-token/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ event_id: "00000000-0000-4000-8000-000000000009", event_name: "share_opened", locale: "en" }),
  }), { params: Promise.resolve({ token: "not-a-token" }) });
  assert.equal(accepted.status, 202);
  assert.equal(await accepted.text(), "");
  assert.equal(accepted.headers.get("X-Robots-Tag"), "noindex, nofollow");
});

test("S5 accepts the public origin when staging forwards protocol and Host separately", (t) => {
  const previous = process.env.NATAROT_TRUSTED_PROXY;
  process.env.NATAROT_TRUSTED_PROXY = "true";
  t.after(() => {
    if (previous === undefined) delete process.env.NATAROT_TRUSTED_PROXY;
    else process.env.NATAROT_TRUSTED_PROXY = previous;
  });
  assert.doesNotThrow(() => checkShareRequestOrigin(new Request("http://127.0.0.1:8788/api/tarot/shares/token/events", {
    headers: {
      host: "staging.natarot.com",
      origin: "https://staging.natarot.com",
      "x-forwarded-proto": "https",
    },
  })));
});

test("owner API remains behind existing identity/origin boundaries and does not echo identifiers", () => {
  const source = readFileSync(new URL("../app/api/tarot/shares/route.ts", import.meta.url), "utf8");
  assert.match(source, /identity\(request\)/);
  assert.match(source, /originCheck\(request\)/);
  assert.match(source, /reading_id/);
  assert.equal(source.includes("return response({ reading_id"), false);
  assert.equal(source.includes("return response({ session_id"), false);
});
