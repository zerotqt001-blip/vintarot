import type { D1Database } from "@cloudflare/workers-types";
import type { GoogleOAuthClient } from "./google-oauth";
import {
  MemberConflictError,
  type MemberRow,
  SESSION_COOKIE_NAME,
  buildSessionCookie,
  clearSessionCookie,
  createMemberAuthStore,
  digestToken,
  hashPassword,
  loginSchema,
  normalizeEmail,
  normalizePhone,
  normalizeUsername,
  parseCookie,
  passwordResetRequestSchema,
  registrationSchema,
  resetPasswordSchema,
  safeRelativeReturnPath,
  verifyPassword,
} from "./member-auth";

const VERIFICATION_TOKEN_TTL_MS = 24 * 60 * 60 * 1_000;
const PASSWORD_RESET_TOKEN_TTL_MS = 60 * 60 * 1_000;
const INVALID_CREDENTIALS = { error: "Invalid credentials." };
const INVALID_TOKEN = { error: "This link is invalid or expired." };

type MailMessage = { to: string; username: string; token: string };
type JsonReader = (request: Request) => Promise<unknown>;

export type AuthHandlersDependencies = {
  database: D1Database;
  now?: () => number;
  rateLimiter: { allow(key: string): boolean };
  sendVerification: (message: MailMessage) => Promise<void>;
  sendPasswordReset: (message: MailMessage) => Promise<void>;
  readJson?: JsonReader;
  googleOAuth?: GoogleOAuthClient;
};

function requestUsesHttps(request: Request): boolean {
  const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",", 1)[0]?.trim().toLowerCase();
  return forwardedProto ? forwardedProto === "https" : new URL(request.url).protocol === "https:";
}

function clientAddress(request: Request): string {
  return request.headers.get("x-forwarded-for")?.split(",", 1)[0]?.trim() || "unknown";
}

function rateLimitKey(action: string, identifier: string, request: Request): string {
  return `${action}:${identifier.trim().toLowerCase()}:${clientAddress(request)}`;
}

async function defaultReadJson(request: Request): Promise<unknown> {
  const text = await request.text();
  if (text.length > 100_000) throw new Response("Request too large", { status: 413 });
  try {
    return JSON.parse(text);
  } catch {
    throw new Response("Invalid JSON", { status: 400 });
  }
}

function invalidInput(): Response {
  return Response.json({ error: "Please check your details." }, { status: 400 });
}

function invalidCredentials(): Response {
  return Response.json(INVALID_CREDENTIALS, { status: 401 });
}

function invalidToken(): Response {
  return Response.json(INVALID_TOKEN, { status: 400 });
}

async function deleteAuthToken(database: D1Database, rawToken: string): Promise<void> {
  await database.prepare("DELETE FROM auth_tokens WHERE token_hash=?")
    .bind(await digestToken(rawToken))
    .run();
}

async function rollbackRegistration(database: D1Database, memberId: string, rawToken: string): Promise<void> {
  await database.batch([
    database.prepare("DELETE FROM auth_tokens WHERE token_hash=?").bind(await digestToken(rawToken)),
    database.prepare("DELETE FROM members WHERE id=?").bind(memberId),
  ]);
}

function parseRegistration(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (typeof record.email !== "string" || typeof record.username !== "string" || typeof record.phone !== "string") return null;
  try {
    const parsed = registrationSchema.safeParse({
      ...record,
      email: normalizeEmail(record.email),
      username: normalizeUsername(record.username),
      phone: normalizePhone(record.phone),
    });
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

function verificationRedirect(request: Request, verified: boolean): Response {
  const target = new URL("/auth", request.url);
  target.searchParams.set("verified", verified ? "1" : "0");
  return Response.redirect(target, 303);
}

function googleErrorRedirect(request: Request): Response {
  return Response.redirect(new URL("/auth?error=google", request.url), 303);
}

function localRedirect(request: Request, returnPath: string, sessionRaw: string): Response {
  return new Response(null, {
    status: 303,
    headers: {
      Location: new URL(returnPath, request.url).toString(),
      "Set-Cookie": buildSessionCookie(sessionRaw, requestUsesHttps(request)),
    },
  });
}

function googleCompletionPayload(value: unknown): { subject: string; email: string; displayName: string | null; returnPath: string } | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const payload = value as Record<string, unknown>;
  if (typeof payload.subject !== "string" || !payload.subject || typeof payload.email !== "string" || typeof payload.returnPath !== "string") return null;
  if (payload.displayName !== null && typeof payload.displayName !== "string") return null;
  try {
    return {
      subject: payload.subject,
      email: normalizeEmail(payload.email),
      displayName: payload.displayName,
      returnPath: safeRelativeReturnPath(payload.returnPath),
    };
  } catch {
    return null;
  }
}

function googleCompletionInput(value: unknown): { token: string; username: string; phone: string } | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  if (typeof input.token !== "string" || typeof input.username !== "string" || typeof input.phone !== "string") return null;
  try {
    return { token: input.token, username: normalizeUsername(input.username), phone: normalizePhone(input.phone) };
  } catch {
    return null;
  }
}

export function createAuthHandlers({
  database,
  now = Date.now,
  rateLimiter,
  sendVerification,
  sendPasswordReset,
  readJson = defaultReadJson,
  googleOAuth,
}: AuthHandlersDependencies) {
  const store = createMemberAuthStore(database, now);

  return {
    async googleStart(request: Request): Promise<Response> {
      if (!googleOAuth) return Response.json({ error: "Google sign-in is unavailable." }, { status: 503 });
      try {
        const returnPath = new URL(request.url).searchParams.get("returnPath") ?? "/";
        const started = await googleOAuth.begin(returnPath);
        return Response.redirect(started.url, 303);
      } catch {
        return Response.json({ error: "Google sign-in is unavailable." }, { status: 503 });
      }
    },

    async googleCallback(request: Request): Promise<Response> {
      if (!googleOAuth) return googleErrorRedirect(request);
      const query = new URL(request.url).searchParams;
      const state = query.get("state");
      const code = query.get("code");
      if (query.get("error") || !state || !code) return googleErrorRedirect(request);
      const statePayload = await store.consumeOAuthState(state);
      if (!statePayload) return googleErrorRedirect(request);

      try {
        const accessToken = await googleOAuth.exchange(code, statePayload.codeVerifier);
        const identity = await googleOAuth.readVerifiedIdentity(accessToken);
        const linked = await store.findByGoogleSubject(identity.subject);
        if (linked) {
          if (linked.disabled !== 0 || linked.email_verified_at === null) return googleErrorRedirect(request);
          await store.markLastLogin(linked.id);
          return localRedirect(request, statePayload.returnPath, (await store.createSession(linked.id, true)).raw);
        }

        const byEmail = await store.findByEmail(identity.email);
        if (byEmail) {
          if (byEmail.disabled !== 0 || byEmail.email_verified_at === null) return googleErrorRedirect(request);
          try {
            await store.linkGoogleSubject(byEmail.id, identity.subject);
          } catch (error) {
            if (!(error instanceof MemberConflictError)) throw error;
            const racedLink = await store.findByGoogleSubject(identity.subject);
            if (!racedLink || racedLink.id !== byEmail.id || racedLink.disabled !== 0 || racedLink.email_verified_at === null) return googleErrorRedirect(request);
          }
          await store.markLastLogin(byEmail.id);
          return localRedirect(request, statePayload.returnPath, (await store.createSession(byEmail.id, true)).raw);
        }

        const completion = await store.createToken({
          kind: "google-completion",
          ttlMs: 10 * 60 * 1_000,
          payload: {
            subject: identity.subject,
            email: identity.email,
            displayName: identity.displayName,
            returnPath: statePayload.returnPath,
          },
        });
        const target = new URL("/auth/complete", request.url);
        target.searchParams.set("token", completion.raw);
        return Response.redirect(target, 303);
      } catch {
        return googleErrorRedirect(request);
      }
    },

    async googleComplete(request: Request): Promise<Response> {
      const input = googleCompletionInput(await readJson(request));
      if (!input) return invalidInput();
      const consumed = await store.consumeToken("google-completion", input.token);
      const payload = googleCompletionPayload(consumed?.payload);
      if (!payload) return invalidToken();
      try {
        const member = await store.createMember({
          email: payload.email,
          username: input.username,
          phone: input.phone,
          passwordHash: null,
          googleSubject: payload.subject,
          displayName: payload.displayName,
          emailVerifiedAt: now(),
        });
        await store.markLastLogin(member.id);
        return localRedirect(request, payload.returnPath, (await store.createSession(member.id, true)).raw);
      } catch (error) {
        if (error instanceof MemberConflictError) return invalidInput();
        throw error;
      }
    },

    async register(request: Request): Promise<Response> {
      const parsed = parseRegistration(await readJson(request));
      if (!parsed) return invalidInput();
      if (!rateLimiter.allow(rateLimitKey("register", `${parsed.email}:${parsed.username}`, request))) {
        return Response.json({ ok: true, next: "verify-email" });
      }

      let member;
      try {
        member = await store.createMember({
          email: parsed.email,
          username: parsed.username,
          phone: parsed.phone,
          passwordHash: await hashPassword(parsed.password),
        });
      } catch (error) {
        if (error instanceof MemberConflictError) return Response.json({ ok: true, next: "verify-email" });
        throw error;
      }

      const token = await store.createToken({
        kind: "email-verification",
        memberId: member.id,
        ttlMs: VERIFICATION_TOKEN_TTL_MS,
      });
      try {
        await sendVerification({ to: member.email, username: member.username, token: token.raw });
      } catch {
        try {
          await rollbackRegistration(database, member.id, token.raw);
        } catch {
          // Keep the public response generic even if cleanup cannot complete.
        }
        return Response.json({ ok: true, next: "verify-email" });
      }
      return Response.json({ ok: true, next: "verify-email" });
    },

    async verify(request: Request): Promise<Response> {
      const token = new URL(request.url).searchParams.get("token");
      if (!token) return verificationRedirect(request, false);
      const consumed = await store.consumeToken("email-verification", token);
      if (!consumed?.memberId) return verificationRedirect(request, false);
      await store.markVerified(consumed.memberId);
      return verificationRedirect(request, true);
    },

    async login(request: Request): Promise<Response> {
      const parsed = loginSchema.safeParse(await readJson(request));
      if (!parsed.success || !rateLimiter.allow(rateLimitKey("login", parsed.success ? parsed.data.identifier : "invalid", request))) {
        return invalidCredentials();
      }
      const member = await store.findByIdentifier(parsed.data.identifier);
      if (!member || member.disabled !== 0 || member.email_verified_at === null || !member.password_hash) return invalidCredentials();
      if (!(await verifyPassword(parsed.data.password, member.password_hash))) return invalidCredentials();

      await store.markLastLogin(member.id);
      const session = await store.createSession(member.id, true);
      return Response.json(
        { ok: true, member: { id: member.id, username: member.username, email: member.email, displayName: member.display_name } },
        { headers: { "Set-Cookie": buildSessionCookie(session.raw, requestUsesHttps(request)) } },
      );
    },

    async logout(request: Request): Promise<Response> {
      const rawSessionToken = parseCookie(request.headers.get("cookie"), SESSION_COOKIE_NAME);
      if (rawSessionToken) await store.revokeSession(rawSessionToken);
      return Response.json({ ok: true }, { headers: { "Set-Cookie": clearSessionCookie(requestUsesHttps(request)) } });
    },

    async me(request: Request): Promise<Response> {
      const rawSessionToken = parseCookie(request.headers.get("cookie"), SESSION_COOKIE_NAME);
      const member = rawSessionToken ? await store.readSession(rawSessionToken) : null;
      if (!member) return Response.json({ error: "Unauthorized." }, { status: 401 });
      return Response.json({ member });
    },

    async requestPasswordReset(request: Request): Promise<Response> {
      const parsed = passwordResetRequestSchema.safeParse(await readJson(request));
      if (!parsed.success) return invalidInput();
      if (!rateLimiter.allow(rateLimitKey("password-reset", parsed.data.identifier, request))) {
        return Response.json({ ok: true, next: "check-email" });
      }
      const member = await store.findByIdentifier(parsed.data.identifier);
      if (member && member.disabled === 0 && member.password_hash) {
        const token = await store.createToken({
          kind: "password-reset",
          memberId: member.id,
          ttlMs: PASSWORD_RESET_TOKEN_TTL_MS,
        });
        try {
          await sendPasswordReset({ to: member.email, username: member.username, token: token.raw });
        } catch {
          try {
            await deleteAuthToken(database, token.raw);
          } catch {
            // Keep the public response generic even if cleanup cannot complete.
          }
        }
      }
      return Response.json({ ok: true, next: "check-email" });
    },

    async confirmPasswordReset(request: Request): Promise<Response> {
      const parsed = resetPasswordSchema.safeParse(await readJson(request));
      if (!parsed.success) return invalidInput();
      const passwordHash = await hashPassword(parsed.data.password);
      const consumed = await store.consumeToken("password-reset", parsed.data.token);
      if (!consumed?.memberId) return invalidToken();
      const member = await database.prepare("SELECT * FROM members WHERE id=?").bind(consumed.memberId).first<MemberRow>();
      if (!member || member.disabled !== 0 || !member.password_hash) return invalidToken();
      await store.updatePassword(member.id, passwordHash);
      await store.revokeAllSessions(member.id);
      return Response.json({ ok: true, next: "signed-out" });
    },
  };
}
