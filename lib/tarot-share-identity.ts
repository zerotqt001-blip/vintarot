export const SHARE_TOKEN_VERSION = "s1" as const;
export const SHARE_TOKEN_BYTES = 32;
export const SHARE_TOKEN_LENGTH = 43;

const BASE64URL_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
const SHARE_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export class ShareTokenError extends Error {
  constructor(message = "The share token is invalid.") {
    super(message);
    this.name = "ShareTokenError";
  }
}

function cryptoProvider(): Crypto {
  if (!globalThis.crypto?.getRandomValues || !globalThis.crypto.subtle) {
    throw new Error("Web Crypto is required for NaTarot share identity.");
  }
  return globalThis.crypto;
}

function encodeBase64Url(bytes: Uint8Array): string {
  let output = "";
  for (let index = 0; index < bytes.length; index += 3) {
    const first = bytes[index] ?? 0;
    const second = bytes[index + 1];
    const third = bytes[index + 2];
    const value = (first << 16) | ((second ?? 0) << 8) | (third ?? 0);
    output += BASE64URL_ALPHABET[(value >>> 18) & 63];
    output += BASE64URL_ALPHABET[(value >>> 12) & 63];
    if (second !== undefined) output += BASE64URL_ALPHABET[(value >>> 6) & 63];
    if (third !== undefined) output += BASE64URL_ALPHABET[value & 63];
  }
  return output;
}

function hexDigest(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** Generate a 256-bit opaque public identity; the raw token must never be persisted. */
export function generateShareToken(): string {
  const bytes = new Uint8Array(SHARE_TOKEN_BYTES);
  cryptoProvider().getRandomValues(bytes);
  return encodeBase64Url(bytes);
}

export function isShareToken(value: unknown): value is string {
  return typeof value === "string" && SHARE_TOKEN_PATTERN.test(value);
}

export function assertShareToken(value: unknown): asserts value is string {
  if (!isShareToken(value)) throw new ShareTokenError();
}

/** Hash the presented token before any store lookup so the raw token is never a lookup key. */
export async function hashShareToken(token: string): Promise<string> {
  assertShareToken(token);
  const data = new TextEncoder().encode(token);
  return hexDigest(await cryptoProvider().subtle.digest("SHA-256", data));
}

export function shareHashPrefix(hash: string): string {
  return /^[a-f0-9]{64}$/.test(hash) ? hash.slice(0, 12) : "invalid";
}
