import type { D1Database } from "@cloudflare/workers-types";
import type { GoogleOAuthClient } from "./google-oauth";
import { clearAffiliateGuestCookie, readAffiliateGuestId } from "./affiliate/anonymous-attribution";
import { ensureAffiliateEnrollment } from "./affiliate/enrollment";
import { claimGuestReferralAttribution } from "./affiliate/service";
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
  resetPasswordSchema,
  safeRelativeReturnPath,
  validatePassword,
  verifyPassword,
} from "./member-auth";

const VERIFICATION_TOKEN_TTL_MS = 24 * 60 * 60 * 1_000;
const PASSWORD_RESET_TOKEN_TTL_MS = 60 * 60 * 1_000;
const GOOGLE_TRANSACTION_COOKIE_NAME = "natarot_google_oauth";
const GOOGLE_TRANSACTION_TTL_SECONDS = 10 * 60;
const INVALID_CREDENTIALS = { error: "Invalid credentials." };
const INVALID_TOKEN = { error: "This link is invalid or expired." };
const DUMMY_PASSWORD_HASH = "pbkdf2-sha256$v1$600000$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";

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
  trustForwardedFor?: boolean;
  trustCloudflareIp?: boolean;
  scheduleBackground?: (task: Promise<void>) => void;
};

function requestUsesHttps(request: Request, trustForwardedFor: boolean): boolean {
  const forwardedProto = trustForwardedFor
    ? request.headers.get("x-forwarded-proto")?.split(",", 1)[0]?.trim().toLowerCase()
    : undefined;
  return forwardedProto ? forwardedProto === "https" : new URL(request.url).protocol === "https:";
}

function clientAddress(request: Request, trustForwardedFor: boolean, trustCloudflareIp: boolean): string {
  if (trustCloudflareIp) return request.headers.get("cf-connecting-ip")?.trim() || "cloudflare-unknown";
  if (trustForwardedFor) {
    return request.headers.get("x-forwarded-for")?.split(",", 1)[0]?.trim()
      || request.headers.get("x-real-ip")?.trim()
      || "trusted-proxy-unknown";
  }
  return "untrusted-client-address";
}

function rateLimitKey(action: string, identifier: string, request: Request, trustForwardedFor: boolean, trustCloudflareIp: boolean): string {
  return `${action}:${identifier.trim().toLowerCase()}:${clientAddress(request, trustForwardedFor, trustCloudflareIp)}`;
}

function allowRateLimitedAction(
  rateLimiter: { allow(key: string): boolean },
  action: string,
  identifier: string,
  request: Request,
  trustForwardedFor: boolean,
  trustCloudflareIp: boolean,
): boolean {
  return rateLimiter.allow(rateLimitKey(`${action}-address`, "all", request, trustForwardedFor, trustCloudflareIp))
    && rateLimiter.allow(rateLimitKey(action, identifier, request, trustForwardedFor, trustCloudflareIp));
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

type AuthField = "email" | "username" | "phone" | "password";
type FieldErrors = Partial<Record<AuthField, "invalid">>;

function invalidInput(fields?: FieldErrors): Response {
  const body = fields && Object.keys(fields).length > 0
    ? { error: "Please check your details.", fields }
    : { error: "Please check your details." };
  return Response.json(body, { status: 400 });
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

function parseRegistration(value: unknown): { email: string; username: string; phone: string; password: string } | { fields: FieldErrors } {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { fields: { email: "invalid", username: "invalid", phone: "invalid", password: "invalid" } };
  }
  const record = value as Record<string, unknown>;
  const fields: FieldErrors = {};
  let email = "";
  let username = "";
  let phone = "";
  let password = "";
  try {
    if (typeof record.email !== "string") throw new Error();
    email = normalizeEmail(record.email);
  } catch {
    fields.email = "invalid";
  }
  try {
    if (typeof record.username !== "string") throw new Error();
    username = normalizeUsername(record.username);
  } catch {
    fields.username = "invalid";
  }
  try {
    if (typeof record.phone !== "string") throw new Error();
    phone = normalizePhone(record.phone);
  } catch {
    fields.phone = "invalid";
  }
  try {
    if (typeof record.password !== "string") throw new Error();
    password = validatePassword(record.password);
  } catch {
    fields.password = "invalid";
  }
  return Object.keys(fields).length > 0 ? { fields } : { email, username, phone, password };
}

function verificationRedirect(request: Request, verified: boolean): Response {
  return redirect(`/auth?verified=${verified ? "1" : "0"}`);
}

function googleTransactionCookie(binding: string, secure: boolean): string {
  return `${GOOGLE_TRANSACTION_COOKIE_NAME}=${binding}; Max-Age=${GOOGLE_TRANSACTION_TTL_SECONDS}; HttpOnly; SameSite=Lax; Path=/${secure ? "; Secure" : ""}`;
}

function clearGoogleTransactionCookie(secure: boolean): string {
  return `${GOOGLE_TRANSACTION_COOKIE_NAME}=; Max-Age=0; HttpOnly; SameSite=Lax; Path=/${secure ? "; Secure" : ""}`;
}

function withGoogleTransactionCleared(response: Response, request: Request, trustForwardedFor: boolean): Response {
  response.headers.append("Set-Cookie", clearGoogleTransactionCookie(requestUsesHttps(request, trustForwardedFor)));
  return response;
}

function withAffiliateGuestCookieCleared(response: Response, request: Request, trustForwardedFor: boolean): Response {
  if (readAffiliateGuestId(request)) {
    response.headers.append("Set-Cookie", clearAffiliateGuestCookie(requestUsesHttps(request, trustForwardedFor)));
  }
  return response;
}

function redirect(location: URL | string): Response {
  return new Response(null, { status: 303, headers: { Location: String(location) } });
}

function googleErrorRedirect(request: Request, clearTransaction = false, trustForwardedFor = false): Response {
  const response = redirect("/auth?error=google");
  return clearTransaction ? withGoogleTransactionCleared(response, request, trustForwardedFor) : response;
}

function localRedirect(request: Request, returnPath: string, sessionRaw: string, clearGoogleTransaction = false, trustForwardedFor = false): Response {
  const response = new Response(null, {
    status: 303,
    headers: {
      Location: safeRelativeReturnPath(returnPath),
      "Set-Cookie": buildSessionCookie(sessionRaw, requestUsesHttps(request, trustForwardedFor)),
    },
  });
  return clearGoogleTransaction ? withGoogleTransactionCleared(response, request, trustForwardedFor) : response;
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

function googleCompletionInput(value: unknown): { token: string; username: string; phone: string } | { fields: Pick<FieldErrors, "username" | "phone"> } | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  if (typeof input.token !== "string") return null;
  const fields: Pick<FieldErrors, "username" | "phone"> = {};
  let username = "";
  let phone = "";
  try {
    if (typeof input.username !== "string") throw new Error();
    username = normalizeUsername(input.username);
  } catch {
    fields.username = "invalid";
  }
  try {
    if (typeof input.phone !== "string") throw new Error();
    phone = normalizePhone(input.phone);
  } catch {
    fields.phone = "invalid";
  }
  return Object.keys(fields).length > 0 ? { fields } : { token: input.token, username, phone };
}

export function createAuthHandlers({
  database,
  now = Date.now,
  rateLimiter,
  sendVerification,
  sendPasswordReset,
  readJson = defaultReadJson,
  googleOAuth,
  trustForwardedFor = false,
  trustCloudflareIp = false,
  scheduleBackground = (task) => { void task; },
}: AuthHandlersDependencies) {
  const store = createMemberAuthStore(database, now);
  async function claimAffiliateGuest(memberId: string, request: Request): Promise<void> {
    const guestId = readAffiliateGuestId(request);
    if (guestId) await claimGuestReferralAttribution({ database, memberId, guestId, now: now() });
  }
  async function enrollAndClaimAffiliate(memberId: string, request: Request): Promise<void> {
    await claimAffiliateGuest(memberId, request);
    await ensureAffiliateEnrollment({ database, memberId, now: now() });
  }

  return {
    async googleStart(request: Request): Promise<Response> {
      if (!googleOAuth) return Response.json({ error: "Google sign-in is unavailable." }, { status: 503 });
      try {
        const query = new URL(request.url).searchParams;
        const returnPath = query.get("return_to") ?? query.get("returnPath") ?? "/";
        const started = await googleOAuth.begin(returnPath);
        const response = redirect(started.url);
        response.headers.append("Set-Cookie", googleTransactionCookie(await digestToken(started.rawState), requestUsesHttps(request, trustForwardedFor)));
        return response;
      } catch {
        return Response.json({ error: "Google sign-in is unavailable." }, { status: 503 });
      }
    },

    async googleCallback(request: Request): Promise<Response> {
      if (!googleOAuth) return googleErrorRedirect(request, false, trustForwardedFor);
      const query = new URL(request.url).searchParams;
      const state = query.get("state");
      const code = query.get("code");
      const transactionBinding = parseCookie(request.headers.get("cookie"), GOOGLE_TRANSACTION_COOKIE_NAME);
      if (!state || !transactionBinding || transactionBinding !== await digestToken(state)) return googleErrorRedirect(request, true, trustForwardedFor);
      const statePayload = await store.consumeOAuthState(state);
      if (!statePayload || query.get("error") || !code) return googleErrorRedirect(request, true, trustForwardedFor);

      try {
        const accessToken = await googleOAuth.exchange(code, statePayload.codeVerifier);
        const identity = await googleOAuth.readVerifiedIdentity(accessToken);
        const linked = await store.findByGoogleSubject(identity.subject);
        if (linked) {
          if (linked.disabled !== 0 || linked.email_verified_at === null) return googleErrorRedirect(request, true, trustForwardedFor);
          await store.markLastLogin(linked.id);
          await enrollAndClaimAffiliate(linked.id, request);
          return withAffiliateGuestCookieCleared(localRedirect(request, statePayload.returnPath, (await store.createSession(linked.id, true)).raw, true, trustForwardedFor), request, trustForwardedFor);
        }

        const byEmail = await store.findByEmail(identity.email);
        if (byEmail) {
          if (byEmail.disabled !== 0 || byEmail.email_verified_at === null) return googleErrorRedirect(request, true, trustForwardedFor);
          try {
            if (!(await store.linkGoogleSubject(byEmail.id, identity.subject))) return googleErrorRedirect(request, true, trustForwardedFor);
          } catch (error) {
            if (!(error instanceof MemberConflictError)) throw error;
            const racedLink = await store.findByGoogleSubject(identity.subject);
            if (!racedLink || racedLink.id !== byEmail.id || racedLink.disabled !== 0 || racedLink.email_verified_at === null) return googleErrorRedirect(request, true, trustForwardedFor);
          }
          await store.markLastLogin(byEmail.id);
          await enrollAndClaimAffiliate(byEmail.id, request);
          return withAffiliateGuestCookieCleared(localRedirect(request, statePayload.returnPath, (await store.createSession(byEmail.id, true)).raw, true, trustForwardedFor), request, trustForwardedFor);
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
        const target = `/auth/complete?token=${encodeURIComponent(completion.raw)}`;
        return withGoogleTransactionCleared(redirect(target), request, trustForwardedFor);
      } catch {
        return googleErrorRedirect(request, true, trustForwardedFor);
      }
    },

    async googleComplete(request: Request): Promise<Response> {
      const parsed = googleCompletionInput(await readJson(request));
      if (!parsed) return invalidInput();
      if ("fields" in parsed) return invalidInput(parsed.fields);
      const input = parsed;
      const tokenHash = await digestToken(input.token);
      const available = await store.peekToken("google-completion", input.token);
      const payload = googleCompletionPayload(available?.payload);
      if (!payload) return invalidToken();
      try {
        const member = await store.completeGoogleMemberAtomically({
          email: payload.email,
          username: input.username,
          phone: input.phone,
          passwordHash: null,
          googleSubject: payload.subject,
          displayName: payload.displayName,
          emailVerifiedAt: now(),
          tokenHash,
        });
        if (!member) return invalidToken();
        await store.markLastLogin(member.id);
        await enrollAndClaimAffiliate(member.id, request);
        return withAffiliateGuestCookieCleared(localRedirect(request, payload.returnPath, (await store.createSession(member.id, true)).raw, false, trustForwardedFor), request, trustForwardedFor);
      } catch (error) {
        if (error instanceof MemberConflictError) return invalidInput();
        throw error;
      }
    },

    async register(request: Request): Promise<Response> {
      const parsed = parseRegistration(await readJson(request));
      if ("fields" in parsed) return invalidInput(parsed.fields);
      if (!allowRateLimitedAction(rateLimiter, "register", `${parsed.email}:${parsed.username}`, request, trustForwardedFor, trustCloudflareIp)) {
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
      await claimAffiliateGuest(member.id, request);
      return withAffiliateGuestCookieCleared(Response.json({ ok: true, next: "verify-email" }), request, trustForwardedFor);
    },

    async verify(request: Request): Promise<Response> {
      const token = new URL(request.url).searchParams.get("token");
      if (!token) return verificationRedirect(request, false);
      const consumed = await store.consumeToken("email-verification", token);
      if (!consumed?.memberId) return verificationRedirect(request, false);
      await store.markVerified(consumed.memberId);
      await enrollAndClaimAffiliate(consumed.memberId, request);
      return withAffiliateGuestCookieCleared(verificationRedirect(request, true), request, trustForwardedFor);
    },

    async login(request: Request): Promise<Response> {
      const parsed = loginSchema.safeParse(await readJson(request));
      const identifier = parsed.success ? parsed.data.identifier : "invalid";
      if (!allowRateLimitedAction(rateLimiter, "login", identifier, request, trustForwardedFor, trustCloudflareIp) || !parsed.success) {
        return invalidCredentials();
      }
      const member = await store.findByIdentifier(parsed.data.identifier);
      const candidateHash = member && member.disabled === 0 && member.email_verified_at !== null && member.password_hash
        ? member.password_hash
        : DUMMY_PASSWORD_HASH;
      if (!(await verifyPassword(parsed.data.password, candidateHash))) return invalidCredentials();
      if (!member || member.disabled !== 0 || member.email_verified_at === null || !member.password_hash) return invalidCredentials();

      const session = await store.createSessionIfPasswordMatches(member.id, member.password_hash, true);
      if (!session) return invalidCredentials();
      await store.markLastLogin(member.id);
      await enrollAndClaimAffiliate(member.id, request);
      return withAffiliateGuestCookieCleared(Response.json(
        { ok: true, member: { id: member.id, username: member.username, email: member.email, displayName: member.display_name } },
        { headers: { "Set-Cookie": buildSessionCookie(session.raw, requestUsesHttps(request, trustForwardedFor)) } },
      ), request, trustForwardedFor);
    },

    async logout(request: Request): Promise<Response> {
      const rawSessionToken = parseCookie(request.headers.get("cookie"), SESSION_COOKIE_NAME);
      if (rawSessionToken) await store.revokeSession(rawSessionToken);
      return Response.json({ ok: true }, { headers: { "Set-Cookie": clearSessionCookie(requestUsesHttps(request, trustForwardedFor)) } });
    },

    async me(request: Request): Promise<Response> {
      const rawSessionToken = parseCookie(request.headers.get("cookie"), SESSION_COOKIE_NAME);
      const member = rawSessionToken ? await store.readSession(rawSessionToken) : null;
      if (!member) return Response.json({ error: "Unauthorized." }, { status: 401 });
      return Response.json({ member });
    },

    async requestPasswordReset(request: Request): Promise<Response> {
      const parsed = passwordResetRequestSchema.safeParse(await readJson(request));
      const identifier = parsed.success ? parsed.data.identifier : "invalid";
      if (!allowRateLimitedAction(rateLimiter, "password-reset", identifier, request, trustForwardedFor, trustCloudflareIp) || !parsed.success) {
        return Response.json({ ok: true, next: "check-email" });
      }
      const member = await store.findByIdentifier(parsed.data.identifier);
      if (member && member.disabled === 0 && member.password_hash) {
        const token = await store.createToken({
          kind: "password-reset",
          memberId: member.id,
          ttlMs: PASSWORD_RESET_TOKEN_TTL_MS,
        });
        scheduleBackground((async () => {
          try {
            await sendPasswordReset({ to: member.email, username: member.username, token: token.raw });
          } catch {
            try {
              await deleteAuthToken(database, token.raw);
            } catch {
              // Keep the public response generic even if cleanup cannot complete.
            }
          }
        })());
      }
      return Response.json({ ok: true, next: "check-email" });
    },

    async confirmPasswordReset(request: Request): Promise<Response> {
      const parsed = resetPasswordSchema.safeParse(await readJson(request));
      if (!parsed.success) return invalidInput();
      if (!rateLimiter.allow(rateLimitKey("password-reset-confirm-address", "all", request, trustForwardedFor, trustCloudflareIp))) return invalidToken();
      const tokenHash = await digestToken(parsed.data.token);
      const available = await store.peekToken("password-reset", parsed.data.token);
      if (!available?.memberId) return invalidToken();
      if (!rateLimiter.allow(`password-reset-confirm-account:${available.memberId}`)
        || !rateLimiter.allow(`password-reset-confirm-token:${tokenHash}`)) return invalidToken();
      const member = await database.prepare("SELECT * FROM members WHERE id=?").bind(available.memberId).first<MemberRow>();
      if (!member || member.disabled !== 0 || !member.password_hash) return invalidToken();
      const passwordHash = await hashPassword(parsed.data.password);
      const reset = await store.resetPasswordAtomically({
        memberId: member.id,
        tokenHash,
        expectedPasswordHash: member.password_hash,
        passwordHash,
      });
      if (!reset) return invalidToken();
      return Response.json({ ok: true, next: "signed-out" });
    },

    async resendVerification(request: Request): Promise<Response> {
      const parsed = passwordResetRequestSchema.safeParse(await readJson(request));
      if (!parsed.success) return invalidInput();
      if (!allowRateLimitedAction(rateLimiter, "verification-resend", parsed.data.identifier, request, trustForwardedFor, trustCloudflareIp)) {
        return Response.json({ ok: true, next: "verify-email" });
      }
      const member = await store.findByIdentifier(parsed.data.identifier);
      if (member && member.disabled === 0 && member.email_verified_at === null) {
        const token = await store.createToken({ kind: "email-verification", memberId: member.id, ttlMs: VERIFICATION_TOKEN_TTL_MS });
        scheduleBackground((async () => {
          try {
            await sendVerification({ to: member.email, username: member.username, token: token.raw });
          } catch {
            try {
              await deleteAuthToken(database, token.raw);
            } catch {
              // Keep the public response generic even if cleanup cannot complete.
            }
          }
        })());
      }
      return Response.json({ ok: true, next: "verify-email" });
    },
  };
}
