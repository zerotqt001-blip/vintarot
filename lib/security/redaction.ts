const MAX_DEPTH = 5;
const MAX_KEYS = 48;
const MAX_ARRAY_ITEMS = 48;
const MAX_STRING_LENGTH = 1024;
const MAX_SERIALIZED_LENGTH = 32768;
const REDACTED = "[REDACTED]";
const sensitiveKey = /(password|passphrase|hash|token|cookie|secret|api[-_ ]?key|authorization|payment|email|phone|question|reading|payload|referral|share)/i;

function boundedString(value: string): string {
  return value.length > MAX_STRING_LENGTH ? `${value.slice(0, MAX_STRING_LENGTH)}…` : value;
}

function sanitize(value: unknown, depth: number, seen: WeakSet<object>): unknown {
  if (value === null || typeof value === "boolean" || typeof value === "number") return value;
  if (typeof value === "string") return boundedString(value);
  if (typeof value === "bigint") return boundedString(value.toString());
  if (typeof value === "function" || typeof value === "symbol" || typeof value === "undefined") return REDACTED;
  if (depth >= MAX_DEPTH) return REDACTED;
  if (typeof value !== "object") return REDACTED;
  if (seen.has(value)) return REDACTED;
  seen.add(value);
  try {
    if (Array.isArray(value)) return value.slice(0, MAX_ARRAY_ITEMS).map((item) => sanitize(item, depth + 1, seen));
    const result: Record<string, unknown> = {};
    for (const key of Object.keys(value).slice(0, MAX_KEYS)) {
      if (sensitiveKey.test(key)) {
        result[key] = REDACTED;
        continue;
      }
      try {
        result[key] = sanitize((value as Record<string, unknown>)[key], depth + 1, seen);
      } catch {
        result[key] = REDACTED;
      }
    }
    return result;
  } finally {
    seen.delete(value);
  }
}

export function redactAuditMetadata(value: unknown): Record<string, unknown> {
  let output: unknown;
  try {
    output = sanitize(value, 0, new WeakSet<object>());
  } catch {
    output = REDACTED;
  }
  const result = output && typeof output === "object" && !Array.isArray(output) ? output as Record<string, unknown> : { value: output };
  try {
    const serialized = JSON.stringify(result);
    if (serialized.length <= MAX_SERIALIZED_LENGTH) return result;
    return { _truncated: true };
  } catch {
    return { _redaction_failed: true };
  }
}
