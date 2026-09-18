export interface AuthRateLimitOptions {
  now: () => number;
  windowMs: number;
  maxAttempts: number;
  maxKeys?: number;
}

const DEFAULT_MAX_KEYS = 10_000;

export function createAuthRateLimiter({ now, windowMs, maxAttempts, maxKeys = DEFAULT_MAX_KEYS }: AuthRateLimitOptions) {
  const attempts = new Map<string, number[]>();
  let nextGlobalCleanupAt = now() + windowMs;

  const pruneKey = (key: string, timestamp: number): number[] => {
    const values = attempts.get(key) ?? [];
    const active = values.filter((value) => value > timestamp - windowMs);
    if (active.length === 0) attempts.delete(key);
    else attempts.set(key, active);
    return active;
  };

  const pruneAll = (timestamp: number) => {
    for (const [key, values] of attempts) {
      const active = values.filter((value) => value > timestamp - windowMs);
      if (active.length === 0) attempts.delete(key);
      else attempts.set(key, active);
    }
    nextGlobalCleanupAt = timestamp + windowMs;
  };

  return {
    allow(key: string): boolean {
      const timestamp = now();
      const active = pruneKey(key, timestamp);
      if (timestamp >= nextGlobalCleanupAt) pruneAll(timestamp);
      if (active.length >= maxAttempts) return false;
      if (!attempts.has(key) && attempts.size >= maxKeys) {
        pruneAll(timestamp);
        if (attempts.size >= maxKeys) {
          const oldest = attempts.keys().next().value;
          if (oldest !== undefined) attempts.delete(oldest);
        }
      }
      active.push(timestamp);
      attempts.set(key, active);
      return true;
    },

    clear(): void {
      attempts.clear();
    },
  };
}
