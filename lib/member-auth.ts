import { z } from "zod";

export const SESSION_COOKIE_NAME = "natarot_session";
export const SESSION_MAX_AGE_SECONDS = 2_592_000;
const PBKDF2_ITERATIONS = 600_000;
const HASH_BYTES = 32;
const SALT_BYTES = 16;
const TOKEN_BYTES = 32;

export type AuthTokenKind = "email-verification" | "password-reset" | "google-completion";

export interface MemberRow {
  id: string;
  username: string;
  email: string;
  phone: string;
  display_name: string | null;
  password_hash: string | null;
  google_subject: string | null;
  email_verified_at: number | null;
  created_at: number;
  updated_at: number;
  last_login_at: number | null;
  disabled: number;
}

export interface MemberView {
  id: string;
  username: string;
  email: string;
  phone: string;
  displayName: string | null;
}

export interface MemberRegistration {
  email: string;
  username: string;
  phone: string;
  passwordHash: string;
  emailVerifiedAt?: number | null;
  displayName?: string | null;
}

const emailValue = z.string().trim().email().max(254);
const usernameValue = z.string().trim().regex(/^[a-z0-9_]{4,24}$/i);
const phoneValue = z.string().trim().regex(/^\+\d{8,15}$/);
const passwordValue = z.string().min(10).max(128);

export const registrationSchema = z.object({
  email: emailValue,
  username: usernameValue,
  phone: phoneValue,
  password: passwordValue,
});

export const loginSchema = z.object({
  identifier: z.string().trim().min(1).max(254),
  password: z.string().min(1).max(128),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1).max(512),
  password: passwordValue,
});

export const passwordResetRequestSchema = z.object({
  identifier: z.string().trim().min(1).max(254),
});

export const registerSchema = registrationSchema;
export const passwordResetConfirmSchema = resetPasswordSchema;

function fail(message: string): never {
  throw new Error(message);
}

export function normalizeEmail(value: string): string {
  const normalized = value.trim().toLowerCase();
  if (!emailValue.safeParse(normalized).success) fail("Invalid email");
  return normalized;
}

export function normalizeUsername(value: string): string {
  const normalized = value.trim().toLowerCase();
  if (!usernameValue.safeParse(normalized).success) fail("Invalid username");
  return normalized;
}

export function normalizePhone(value: string): string {
  const normalized = value.trim().replace(/[\s()-]/g, "");
  if (!phoneValue.safeParse(normalized).success) fail("Invalid phone number");
  return normalized;
}

export function validatePassword(value: string): string {
  if (!passwordValue.safeParse(value).success) fail("Password must be 10-128 characters");
  return value;
}

function randomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  globalThis.crypto.getRandomValues(bytes);
  return bytes;
}

function encodeBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function decodeBase64Url(value: string): Uint8Array {
  if (!/^[A-Za-z0-9_-]*$/.test(value)) throw new Error("Invalid encoded value");
  const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (value.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

async function derivePasswordKey(value: string, salt: Uint8Array): Promise<Uint8Array> {
  const material = await globalThis.crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(value),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await globalThis.crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      iterations: PBKDF2_ITERATIONS,
      salt: salt.buffer.slice(salt.byteOffset, salt.byteOffset + salt.byteLength) as ArrayBuffer,
    },
    material,
    HASH_BYTES * 8,
  );
  return new Uint8Array(bits);
}

export async function hashPassword(value: string): Promise<string> {
  validatePassword(value);
  const salt = randomBytes(SALT_BYTES);
  const derived = await derivePasswordKey(value, salt);
  return `pbkdf2-sha256$v1$${PBKDF2_ITERATIONS}$${encodeBase64Url(salt)}$${encodeBase64Url(derived)}`;
}

export async function verifyPassword(value: string, encoded: string): Promise<boolean> {
  try {
    const parts = encoded.split("$");
    if (parts.length !== 5 || parts[0] !== "pbkdf2-sha256" || parts[1] !== "v1" || parts[2] !== String(PBKDF2_ITERATIONS)) {
      return false;
    }
    const salt = decodeBase64Url(parts[3]);
    const expected = decodeBase64Url(parts[4]);
    if (salt.length !== SALT_BYTES || expected.length !== HASH_BYTES) return false;
    const actual = await derivePasswordKey(value, salt);
    let difference = actual.length ^ expected.length;
    for (let index = 0; index < Math.max(actual.length, expected.length); index += 1) {
      difference |= (actual[index] ?? 0) ^ (expected[index] ?? 0);
    }
    return difference === 0;
  } catch {
    return false;
  }
}

export async function digestToken(raw: string): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw));
  return encodeBase64Url(new Uint8Array(digest));
}

export async function createOpaqueToken(): Promise<{ raw: string; hash: string }> {
  const raw = encodeBase64Url(randomBytes(TOKEN_BYTES));
  return { raw, hash: await digestToken(raw) };
}

export function parseCookie(header: string | null, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const separator = part.indexOf("=");
    if (separator < 0) continue;
    const key = part.slice(0, separator).trim();
    if (key === name) return part.slice(separator + 1).trim();
  }
  return null;
}

export function safeRelativeReturnPath(value: string): string {
  if (!value || value[0] !== "/" || value.startsWith("//") || value.includes("\\") || /[\u0000-\u001f\u007f]/.test(value)) return "/";
  const path = value.split(/[?#]/, 1)[0];
  if (path === "/auth" || path === "/auth/complete" || path === "/api/auth" || path.startsWith("/api/auth/")) return "/";
  return value;
}

function cookieSecurity(secure: boolean): string {
  return `HttpOnly; SameSite=Lax; Path=/${secure ? "; Secure" : ""}`;
}

export function buildSessionCookie(raw: string, secure = false): string {
  return `${SESSION_COOKIE_NAME}=${raw}; Max-Age=${SESSION_MAX_AGE_SECONDS}; ${cookieSecurity(secure)}`;
}

export function clearSessionCookie(secure = false): string {
  return `${SESSION_COOKIE_NAME}=; Max-Age=0; ${cookieSecurity(secure)}`;
}

export const sessionCookie = buildSessionCookie;
export const clearSession = clearSessionCookie;
