import assert from "node:assert/strict";
import test from "node:test";
import { createAuthRateLimiter } from "../lib/auth-rate-limit";

test("rate limiter blocks attempts after the configured maximum and resets after its window", () => {
  let now = 1_700_000_000_000;
  const limiter = createAuthRateLimiter({ now: () => now, windowMs: 1_000, maxAttempts: 2 });

  assert.equal(limiter.allow("login:reader:127.0.0.1"), true);
  assert.equal(limiter.allow("login:reader:127.0.0.1"), true);
  assert.equal(limiter.allow("login:reader:127.0.0.1"), false);
  now += 1_001;
  assert.equal(limiter.allow("login:reader:127.0.0.1"), true);
});

test("rate limiter clears its retained attempts and caps hostile key growth", () => {
  const now = 1_700_000_000_000;
  const limiter = createAuthRateLimiter({ now: () => now, windowMs: 60_000, maxAttempts: 1, maxKeys: 2 });

  assert.equal(limiter.allow("login:one:127.0.0.1"), true);
  assert.equal(limiter.allow("login:one:127.0.0.1"), false);
  assert.equal(limiter.allow("login:two:127.0.0.1"), true);
  assert.equal(limiter.allow("login:three:127.0.0.1"), true);
  assert.equal(limiter.allow("login:one:127.0.0.1"), true);
  limiter.clear();
  assert.equal(limiter.allow("login:one:127.0.0.1"), true);
});
