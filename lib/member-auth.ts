import { z } from "zod";
import type { D1Database } from "@cloudflare/workers-types";

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

export class MemberConflictError extends Error {
  readonly code = "MEMBER_CONFLICT";

  constructor() {
    super("A member with that identifier already exists");
    this.name = "MemberConflictError";
  }
}

export interface AuthSession {
  raw: string;
  expiresAt: number;
}

export interface AuthToken {
  raw: string;
  expiresAt: number;
}

export interface AuthTokenPayload {
  kind: AuthTokenKind;
  memberId: string | null;
  payload: unknown;
}

export interface OAuthStatePayload {
  codeVerifier: string;
  returnPath: string;
}

const emailValue = z.string().trim().email().max(254);
const usernameValue = z.string().trim().regex(/^[a-z0-9_]{3,24}$/i);
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

function toMemberView(row: MemberRow): MemberView {
  return {
    id: row.id,
    username: row.username,
    email: row.email,
    phone: row.phone,
    displayName: row.display_name,
  };
}

function isUniqueConstraint(error: unknown): boolean {
  return error instanceof Error && /unique constraint failed/i.test(error.message);
}

function jsonPayload(value: unknown): string | null {
  return value === undefined ? null : JSON.stringify(value);
}

function parsePayload(value: string | null): unknown {
  return value === null ? null : JSON.parse(value);
}

export function createMemberAuthStore(database: D1Database, now: () => number = Date.now) {
  const memberById = async (id: string): Promise<MemberRow | null> => database
    .prepare("SELECT * FROM members WHERE id=?")
    .bind(id)
    .first<MemberRow>();

  return {
    async createMember(input: MemberRegistration): Promise<MemberView> {
      const timestamp = now();
      const row: MemberRow = {
        id: crypto.randomUUID(),
        username: normalizeUsername(input.username),
        email: normalizeEmail(input.email),
        phone: normalizePhone(input.phone),
        display_name: input.displayName ?? null,
        password_hash: input.passwordHash,
        google_subject: null,
        email_verified_at: input.emailVerifiedAt ?? null,
        created_at: timestamp,
        updated_at: timestamp,
        last_login_at: null,
        disabled: 0,
      };
      try {
        await database.prepare(`INSERT INTO members (
          id, username, email, phone, display_name, password_hash, google_subject,
          email_verified_at, created_at, updated_at, last_login_at, disabled
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
          .bind(
            row.id, row.username, row.email, row.phone, row.display_name, row.password_hash,
            row.google_subject, row.email_verified_at, row.created_at, row.updated_at,
            row.last_login_at, row.disabled,
          )
          .run();
      } catch (error) {
        if (isUniqueConstraint(error)) throw new MemberConflictError();
        throw error;
      }
      return toMemberView(row);
    },

    async findByIdentifier(identifier: string): Promise<MemberRow | null> {
      const normalized = identifier.trim().toLowerCase();
      return database.prepare("SELECT * FROM members WHERE email=? OR username=?")
        .bind(normalized, normalized)
        .first<MemberRow>();
    },

    async findByEmail(email: string): Promise<MemberRow | null> {
      return database.prepare("SELECT * FROM members WHERE email=?")
        .bind(normalizeEmail(email))
        .first<MemberRow>();
    },

    async findByGoogleSubject(subject: string): Promise<MemberRow | null> {
      return database.prepare("SELECT * FROM members WHERE google_subject=?")
        .bind(subject)
        .first<MemberRow>();
    },

    async getPublicMember(id: string): Promise<MemberView | null> {
      const row = await memberById(id);
      return row ? toMemberView(row) : null;
    },

    async createSession(memberId: string, _remember: boolean, ttlMs = SESSION_MAX_AGE_SECONDS * 1_000): Promise<AuthSession> {
      const token = await createOpaqueToken();
      const timestamp = now();
      const expiresAt = timestamp + ttlMs;
      await database.prepare(`INSERT INTO auth_sessions
        (token_hash, member_id, created_at, expires_at, last_seen_at, revoked_at)
        VALUES (?, ?, ?, ?, ?, NULL)`)
        .bind(token.hash, memberId, timestamp, expiresAt, timestamp)
        .run();
      return { raw: token.raw, expiresAt };
    },

    async readSession(raw: string): Promise<MemberView | null> {
      const hash = await digestToken(raw);
      const timestamp = now();
      const session = await database.prepare(`SELECT member_id FROM auth_sessions
        WHERE token_hash=? AND revoked_at IS NULL AND expires_at > ?`)
        .bind(hash, timestamp)
        .first<{ member_id: string }>();
      if (!session) return null;
      await database.prepare("UPDATE auth_sessions SET last_seen_at=? WHERE token_hash=?")
        .bind(timestamp, hash)
        .run();
      const member = await memberById(session.member_id);
      return member && member.disabled === 0 ? toMemberView(member) : null;
    },

    async revokeSession(raw: string): Promise<void> {
      await database.prepare("UPDATE auth_sessions SET revoked_at=? WHERE token_hash=? AND revoked_at IS NULL")
        .bind(now(), await digestToken(raw))
        .run();
    },

    async revokeAllSessions(memberId: string): Promise<void> {
      await database.prepare("UPDATE auth_sessions SET revoked_at=? WHERE member_id=? AND revoked_at IS NULL")
        .bind(now(), memberId)
        .run();
    },

    async createToken(input: { kind: AuthTokenKind; memberId?: string | null; payload?: unknown; ttlMs: number }): Promise<AuthToken> {
      const token = await createOpaqueToken();
      const timestamp = now();
      const expiresAt = timestamp + input.ttlMs;
      await database.prepare(`INSERT INTO auth_tokens
        (token_hash, kind, member_id, payload, created_at, expires_at, consumed_at)
        VALUES (?, ?, ?, ?, ?, ?, NULL)`)
        .bind(token.hash, input.kind, input.memberId ?? null, jsonPayload(input.payload), timestamp, expiresAt)
        .run();
      return { raw: token.raw, expiresAt };
    },

    async consumeToken(kind: AuthTokenKind, raw: string): Promise<AuthTokenPayload | null> {
      const hash = await digestToken(raw);
      const timestamp = now();
      const update = await database.prepare(`UPDATE auth_tokens SET consumed_at=?
        WHERE token_hash=? AND kind=? AND consumed_at IS NULL AND expires_at > ?`)
        .bind(timestamp, hash, kind, timestamp)
        .run();
      if (Number(update.meta.changes) !== 1) return null;
      const row = await database.prepare("SELECT member_id, payload FROM auth_tokens WHERE token_hash=?")
        .bind(hash)
        .first<{ member_id: string | null; payload: string | null }>();
      return row ? { kind, memberId: row.member_id, payload: parsePayload(row.payload) } : null;
    },

    async createOAuthState(input: OAuthStatePayload & { ttlMs: number }): Promise<AuthToken> {
      const token = await createOpaqueToken();
      const timestamp = now();
      const expiresAt = timestamp + input.ttlMs;
      await database.prepare(`INSERT INTO oauth_states
        (state_hash, code_verifier, return_path, created_at, expires_at, consumed_at)
        VALUES (?, ?, ?, ?, ?, NULL)`)
        .bind(token.hash, input.codeVerifier, safeRelativeReturnPath(input.returnPath), timestamp, expiresAt)
        .run();
      return { raw: token.raw, expiresAt };
    },

    async consumeOAuthState(raw: string): Promise<OAuthStatePayload | null> {
      const hash = await digestToken(raw);
      const timestamp = now();
      const update = await database.prepare(`UPDATE oauth_states SET consumed_at=?
        WHERE state_hash=? AND consumed_at IS NULL AND expires_at > ?`)
        .bind(timestamp, hash, timestamp)
        .run();
      if (Number(update.meta.changes) !== 1) return null;
      return database.prepare("SELECT code_verifier, return_path FROM oauth_states WHERE state_hash=?")
        .bind(hash)
        .first<{ code_verifier: string; return_path: string }>()
        .then((row) => row ? { codeVerifier: row.code_verifier, returnPath: row.return_path } : null);
    },

    async linkGoogleSubject(memberId: string, subject: string): Promise<void> {
      try {
        await database.prepare("UPDATE members SET google_subject=?, updated_at=? WHERE id=?")
          .bind(subject, now(), memberId)
          .run();
      } catch (error) {
        if (isUniqueConstraint(error)) throw new MemberConflictError();
        throw error;
      }
    },

    async markVerified(memberId: string): Promise<void> {
      const timestamp = now();
      await database.prepare("UPDATE members SET email_verified_at=?, updated_at=? WHERE id=?")
        .bind(timestamp, timestamp, memberId)
        .run();
    },

    async markLastLogin(memberId: string): Promise<void> {
      const timestamp = now();
      await database.prepare("UPDATE members SET last_login_at=?, updated_at=? WHERE id=?")
        .bind(timestamp, timestamp, memberId)
        .run();
    },

    async updatePassword(memberId: string, passwordHash: string): Promise<void> {
      await database.prepare("UPDATE members SET password_hash=?, updated_at=? WHERE id=?")
        .bind(passwordHash, now(), memberId)
        .run();
    },
  };
}
