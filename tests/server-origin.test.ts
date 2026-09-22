import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";

process.env.NATAROT_DB_PATH = join(mkdtempSync(join(tmpdir(), "natarot-origin-")), "test.sqlite");
process.env.NATAROT_TRUSTED_PROXY = "true";
const { originCheck } = await import("../lib/server");

test("origin check accepts the public origin forwarded by Nginx", () => {
  assert.doesNotThrow(() => originCheck(new Request("http://127.0.0.1:8787/api/rooms", {
    headers: {
      host: "natarot.com",
      origin: "https://natarot.com",
      "x-forwarded-proto": "https",
    },
  })));
});

test("origin check still rejects a different public origin", () => {
  assert.throws(
    () => originCheck(new Request("http://127.0.0.1:8787/api/rooms", {
      headers: {
        host: "natarot.com",
        origin: "https://attacker.example",
        "x-forwarded-proto": "https",
      },
    })),
    (error) => error instanceof Response && error.status === 403,
  );
});

test("origin check ignores forwarded origin data when the proxy is not trusted", (t) => {
  const previous = process.env.NATAROT_TRUSTED_PROXY;
  process.env.NATAROT_TRUSTED_PROXY = "false";
  t.after(() => {
    if (previous === undefined) delete process.env.NATAROT_TRUSTED_PROXY;
    else process.env.NATAROT_TRUSTED_PROXY = previous;
  });
  assert.throws(
    () => originCheck(new Request("http://127.0.0.1:8787/api/auth/login", {
      headers: {
        host: "natarot.com",
        origin: "https://natarot.com",
        "x-forwarded-host": "natarot.com",
        "x-forwarded-proto": "https",
      },
    })),
    (error) => error instanceof Response && error.status === 403,
  );
});
