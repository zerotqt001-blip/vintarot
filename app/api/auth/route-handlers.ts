import { createAuthEmailSender } from "@/lib/auth-email";
import { createAuthHandlers } from "@/lib/auth-handlers";
import { createAuthRateLimiter } from "@/lib/auth-rate-limit";
import { runtimeEnv } from "@/lib/runtime";
import { boundary, db, json, originCheck } from "@/lib/server";

const rateLimiter = createAuthRateLimiter({
  now: Date.now,
  windowMs: 15 * 60 * 1_000,
  maxAttempts: 10,
});

function runtimeHandlers() {
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
    database: db(),
    now: Date.now,
    rateLimiter,
    readJson: json,
    sendVerification: (message) => getSender().sendVerification(message),
    sendPasswordReset: (message) => getSender().sendPasswordReset(message),
  });
}

export async function postAuth(request: Request, action: "register" | "login" | "logout" | "requestPasswordReset" | "confirmPasswordReset") {
  return boundary(async () => {
    originCheck(request);
    return runtimeHandlers()[action](request);
  });
}

export async function getAuth(request: Request, action: "verify" | "me") {
  return boundary(async () => runtimeHandlers()[action](request));
}
