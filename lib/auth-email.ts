type AuthEmailRequest = {
  to: string;
  username: string;
  token: string;
};

export type AuthEmailSender = {
  sendVerification: (request: AuthEmailRequest) => Promise<void>;
  sendPasswordReset: (request: AuthEmailRequest) => Promise<void>;
};

type AuthEmailSenderOptions = {
  fetchImpl: typeof fetch;
  apiKey: string;
  from: string;
  origin: string;
};

const RESEND_EMAILS_URL = "https://api.resend.com/emails";

function htmlEscape(value: string): string {
  return value.replace(/[&<>\"']/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '\"': "&quot;",
      "'": "&#39;",
    };
    return entities[character];
  });
}

function emailConfigurationError(): Error {
  return new Error("Email configuration is unavailable.");
}

function providerError(status: number | "unknown", category: "provider" | "network"): Error {
  return new Error(`Email provider error (status ${status}, category: ${category}).`);
}

function createLink(origin: URL, path: string, token: string): string {
  return `${origin.origin}${path}?token=${encodeURIComponent(token)}`;
}

export function createAuthEmailSender({ fetchImpl, apiKey, from, origin }: AuthEmailSenderOptions): AuthEmailSender {
  if (!apiKey.trim() || !from.trim()) throw emailConfigurationError();

  let parsedOrigin: URL;
  try {
    parsedOrigin = new URL(origin);
  } catch {
    throw emailConfigurationError();
  }
  if (parsedOrigin.protocol !== "https:") throw emailConfigurationError();

  async function send(request: AuthEmailRequest, kind: "verification" | "reset"): Promise<void> {
    const safeUsername = htmlEscape(request.username);
    const link = createLink(parsedOrigin, kind === "verification" ? "/api/auth/verify" : "/auth/reset", request.token);
    const isVerification = kind === "verification";
    const subject = isVerification
      ? "Xác minh tài khoản NaTarot / Verify your NaTarot account"
      : "Đặt lại mật khẩu NaTarot / Reset your NaTarot password";
    const text = isVerification
      ? `Xin chào ${request.username}, hãy xác minh tài khoản NaTarot của bạn tại: ${link}\n\nHello ${request.username}, verify your NaTarot account here: ${link}`
      : `Xin chào ${request.username}, hãy đặt lại mật khẩu NaTarot của bạn tại: ${link}\n\nHello ${request.username}, reset your NaTarot password here: ${link}`;
    const html = isVerification
      ? `<p>Xin chào ${safeUsername}, hãy <a href="${link}">xác minh tài khoản NaTarot</a> của bạn.</p><p>Hello ${safeUsername}, <a href="${link}">verify your NaTarot account</a>.</p>`
      : `<p>Xin chào ${safeUsername}, hãy <a href="${link}">đặt lại mật khẩu NaTarot</a> của bạn.</p><p>Hello ${safeUsername}, <a href="${link}">reset your NaTarot password</a>.</p>`;

    try {
      const response = await fetchImpl(RESEND_EMAILS_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ from, to: [request.to], subject, text, html }),
      });
      if (!response.ok) throw providerError(response.status, "provider");
    } catch (error) {
      if (error instanceof Error && error.message.startsWith("Email provider error")) throw error;
      throw providerError("unknown", "network");
    }
  }

  return {
    sendVerification: (request) => send(request, "verification"),
    sendPasswordReset: (request) => send(request, "reset"),
  };
}
