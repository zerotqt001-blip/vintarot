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

test("rate limiter prunes only the current key on its normal request path", () => {
  const limiter = createAuthRateLimiter({
    now: () => 1_700_000_000_000,
    windowMs: 60_000,
    maxAttempts: 2,
    maxKeys: 100,
  });
  for (let index = 0; index < 100; index += 1) {
    assert.equal(limiter.allow(`login:${index}:127.0.0.1`), true);
  }

  const originalFilter = Array.prototype.filter;
  let filterCalls = 0;
  Array.prototype.filter = function (...args: Parameters<typeof originalFilter>) {
    filterCalls += 1;
    return originalFilter.apply(this, args);
  };
  try {
    assert.equal(limiter.allow("login:0:127.0.0.1"), true);
  } finally {
    Array.prototype.filter = originalFilter;
  }

  assert.equal(filterCalls, 1);
});
