import { createAuthEmailSender } from "@/lib/auth-email";
import { createAuthHandlers } from "@/lib/auth-handlers";
import { createAuthRateLimiter } from "@/lib/auth-rate-limit";
import { createGoogleOAuthClient } from "@/lib/google-oauth";
import { createMemberAuthStore } from "@/lib/member-auth";
import { runtimeEnv } from "@/lib/runtime";
import { boundary, db, json, originCheck } from "@/lib/server";
import { getRequestExecutionContext } from "vinext/shims/request-context";

const rateLimiter = createAuthRateLimiter({
  now: Date.now,
  windowMs: 15 * 60 * 1_000,
  maxAttempts: 10,
});

function isProduction(): boolean {
  return runtimeEnv.NODE_ENV === "production" || (typeof process !== "undefined" && process.env.NODE_ENV === "production");
}

function trustForwardedFor(): boolean {
  return /^(1|true|yes)$/i.test(runtimeEnv.NATAROT_TRUSTED_PROXY ?? "");
}

function trustCloudflareIp(): boolean {
  return typeof process === "undefined" || !process.versions?.node;
}

function requestDerivedGoogleRedirectUri(request: Request, trustForwardedFor: boolean): string | null {
  const url = new URL(request.url);
  const forwardedProto = trustForwardedFor ? request.headers.get("x-forwarded-proto")?.split(",", 1)[0]?.trim().toLowerCase() : undefined;
  const forwardedHost = trustForwardedFor ? request.headers.get("x-forwarded-host")?.split(",", 1)[0]?.trim() : undefined;
  const protocol = forwardedProto ?? url.protocol.replace(":", "");
  const host = forwardedHost ?? url.host;
  if (protocol !== "https" || !host) return null;
  return `https://${host}/api/auth/google/callback`;
}

function googleOAuthFor(request: Request, database: ReturnType<typeof db>) {
  const clientId = runtimeEnv.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = runtimeEnv.GOOGLE_CLIENT_SECRET?.trim();
  const configuredRedirectUri = runtimeEnv.GOOGLE_REDIRECT_URI?.trim();
  const redirectUri = configuredRedirectUri || (!isProduction() ? requestDerivedGoogleRedirectUri(request, trustForwardedFor()) : null);
  if (!clientId || !clientSecret || !redirectUri) return null;
  try {
    return createGoogleOAuthClient({
      clientId,
      clientSecret,
      redirectUri,
      fetchImpl: fetch,
      now: Date.now,
      store: createMemberAuthStore(database, Date.now),
      production: isProduction(),
    });
  } catch {
    return null;
  }
}

function runtimeHandlers(request?: Request) {
  const database = db();
  let sender: ReturnType<typeof createAuthEmailSender> | null = null;
  const getSender = () => {
    sender ??= createAuthEmailSender({
      fetchImpl: fetch,
      apiKey: runtimeEnv.RESEND_API_KEY ?? "",
      from: runtimeEnv.NATAROT_EMAIL_FROM ?? "NaTarot <noreply@natarot.com>",
      origin: "https://natarot.com",
    });
    return sender;
  };
  return createAuthHandlers({
    database,
    now: Date.now,
    rateLimiter,
    readJson: json,
    sendVerification: (message) => getSender().sendVerification(message),
    sendPasswordReset: (message) => getSender().sendPasswordReset(message),
    trustForwardedFor: trustForwardedFor(),
    trustCloudflareIp: trustCloudflareIp(),
    scheduleBackground: (task) => {
      const context = getRequestExecutionContext();
      if (context) context.waitUntil(task);
      else void task;
    },
    googleOAuth: request ? googleOAuthFor(request, database) ?? undefined : undefined,
  });
}

export async function postAuth(request: Request, action: "register" | "login" | "logout" | "requestPasswordReset" | "confirmPasswordReset" | "resendVerification") {
  return boundary(async () => {
    originCheck(request);
    return runtimeHandlers()[action](request);
  });
}

export async function getAuth(request: Request, action: "verify" | "me") {
  return boundary(async () => runtimeHandlers()[action](request));
}

export async function getGoogleAuth(request: Request, action: "googleStart" | "googleCallback") {
  return boundary(async () => runtimeHandlers(request)[action](request));
}

export async function postGoogleAuth(request: Request) {
  return boundary(async () => {
    originCheck(request);
    return runtimeHandlers(request).googleComplete(request);
  });
}
