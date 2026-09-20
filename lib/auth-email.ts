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
  return `${origin.origin}${path}${path.includes("?") ? "&" : "?"}token=${encodeURIComponent(token)}`;
}

function createVerificationEmail(username: string, link: string): { subject: string; text: string; html: string } {
  const safeUsername = htmlEscape(username);
  const safeLink = htmlEscape(link);

  return {
    subject: "Xác nhận tài khoản NaTarot / Verify your NaTarot account",
    text: `NaTarot — Xác nhận tài khoản

Xác nhận tài khoản NaTarot

Chào ${username},

Cảm ơn bạn đã bắt đầu hành trình cùng NaTarot.

Hãy xác nhận địa chỉ email để hoàn tất việc tạo tài khoản và bắt đầu sử dụng NaTarot.

Xác nhận tài khoản: ${link}

Liên kết xác nhận có hiệu lực trong 24 giờ.

Nếu nút xác nhận không hoạt động, hãy sao chép liên kết dưới đây và mở trong trình duyệt:
${link}

Nếu bạn không tạo tài khoản NaTarot, bạn có thể bỏ qua email này.

Vì lý do bảo mật, vui lòng không chuyển tiếp email xác nhận này cho người khác.

---

NaTarot — Verify your NaTarot account

Hello ${username},

Thank you for beginning your journey with NaTarot.

Please verify your email address to complete your account registration and start using NaTarot.

Verify account: ${link}

This verification link is valid for 24 hours.

If the button does not work, copy the verification link above and open it in your browser.

If you did not create a NaTarot account, you can safely ignore this email.

For your security, please do not forward this verification email to anyone.

NaTarot
Lắng nghe trực giác · Hiểu rõ chính mình
Listen inward · Understand yourself
natarot.com`,
    html: `<!doctype html>
<html lang="vi">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="x-apple-disable-message-reformatting">
    <title>Xác nhận tài khoản NaTarot</title>
  </head>
  <body style="margin:0;padding:0;background-color:#080f1d;color:#f4efe7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#080f1d" style="width:100%;background-color:#080f1d;">
      <tr>
        <td align="center" style="padding:32px 16px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#101b2e" style="width:100%;max-width:600px;background-color:#101b2e;border:1px solid #283752;border-radius:16px;">
            <tr>
              <td style="padding:34px 34px 20px;">
                <p style="margin:0;color:#d8b776;font-family:Georgia,'Times New Roman',serif;font-size:25px;line-height:1.2;letter-spacing:.08em;">NaTarot</p>
                <p style="margin:8px 0 0;color:#aebbd0;font-size:12px;line-height:1.5;letter-spacing:.08em;">LẮNG NGHE TRỰC GIÁC · HIỂU RÕ CHÍNH MÌNH</p>
              </td>
            </tr>
            <tr>
              <td style="padding:0 34px;">
                <table role="presentation" width="56" cellpadding="0" cellspacing="0" border="0" style="width:56px;">
                  <tr>
                    <td height="2" bgcolor="#d8b776" style="height:2px;background-color:#d8b776;font-size:0;line-height:0;">&nbsp;</td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:24px 34px 36px;">
                <h1 style="margin:0;color:#fffaf3;font-family:Georgia,'Times New Roman',serif;font-size:31px;font-weight:600;line-height:1.2;">Xác nhận tài khoản NaTarot</h1>
                <p style="margin:26px 0 0;color:#f4efe7;font-size:16px;line-height:1.7;">Chào ${safeUsername},</p>
                <p style="margin:12px 0 0;color:#d5dcea;font-size:16px;line-height:1.7;">Cảm ơn bạn đã bắt đầu hành trình cùng NaTarot.</p>
                <p style="margin:12px 0 0;color:#d5dcea;font-size:16px;line-height:1.7;">Hãy xác nhận địa chỉ email để hoàn tất việc tạo tài khoản và bắt đầu sử dụng NaTarot.</p>

                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;margin:28px 0;">
                  <tr>
                    <td align="center">
                      <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                        <tr>
                          <td align="center" bgcolor="#d8b776" style="border-radius:10px;background-color:#d8b776;">
                            <a href="${safeLink}" style="display:inline-block;padding:16px 26px;color:#101b2e;font-size:16px;font-weight:700;line-height:1.35;text-align:center;text-decoration:none;">
                              Xác nhận tài khoản<br>
                              <span style="font-size:13px;font-weight:600;">Verify account</span>
                            </a>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>

                <p style="margin:0;color:#f4efe7;font-size:15px;line-height:1.6;">Liên kết xác nhận có hiệu lực trong <strong style="color:#d8b776;">24 giờ</strong>.</p>
                <p style="margin:26px 0 0;color:#d5dcea;font-size:15px;line-height:1.6;">Nếu nút phía trên không hoạt động, hãy sao chép liên kết xác nhận dưới đây và mở trong trình duyệt.</p>

                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#0b1425" style="width:100%;margin-top:14px;background-color:#0b1425;border:1px solid #283752;border-radius:10px;">
                  <tr>
                    <td style="padding:14px 16px;">
                      <p style="margin:0 0 7px;color:#aebbd0;font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;">Liên kết xác nhận</p>
                      <a href="${safeLink}" style="color:#d8b776;font-size:13px;line-height:1.6;text-decoration:underline;word-break:break-all;">${safeLink}</a>
                    </td>
                  </tr>
                </table>

                <p style="margin:26px 0 0;color:#d5dcea;font-size:14px;line-height:1.6;">Nếu bạn không tạo tài khoản NaTarot, bạn có thể bỏ qua email này.</p>
                <p style="margin:10px 0 0;color:#d5dcea;font-size:14px;line-height:1.6;">Vì lý do bảo mật, vui lòng không chuyển tiếp email xác nhận này cho người khác.</p>

                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;margin-top:30px;border-top:1px solid #283752;">
                  <tr>
                    <td style="padding-top:22px;">
                      <p style="margin:0;color:#f4efe7;font-size:15px;font-weight:700;line-height:1.5;">Verify your NaTarot account</p>
                      <p style="margin:10px 0 0;color:#aebbd0;font-size:14px;line-height:1.6;">Hello ${safeUsername},</p>
                      <p style="margin:10px 0 0;color:#aebbd0;font-size:14px;line-height:1.6;">Thank you for beginning your journey with NaTarot. Please verify your email address to complete your account registration.</p>
                      <p style="margin:10px 0 0;color:#aebbd0;font-size:14px;line-height:1.6;">This verification link is valid for <strong style="color:#d8b776;">24 hours</strong>. If the button does not work, copy the verification link above and open it in your browser.</p>
                      <p style="margin:10px 0 0;color:#aebbd0;font-size:14px;line-height:1.6;">If you did not create a NaTarot account, you can safely ignore this email. For your security, please do not forward this verification email to anyone.</p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td align="center" style="padding:22px 34px 30px;background-color:#0b1425;border-radius:0 0 16px 16px;">
                <p style="margin:0;color:#d8b776;font-family:Georgia,'Times New Roman',serif;font-size:17px;line-height:1.4;">NaTarot</p>
                <p style="margin:7px 0 0;color:#aebbd0;font-size:12px;line-height:1.5;">Lắng nghe trực giác · Hiểu rõ chính mình</p>
                <p style="margin:4px 0 0;color:#71819a;font-size:12px;line-height:1.5;">Listen inward · Understand yourself · natarot.com</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`,
  };
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
    const link = createLink(parsedOrigin, kind === "verification" ? "/api/auth/verify" : "/auth?reset=1", request.token);
    const isVerification = kind === "verification";
    let subject: string;
    let text: string;
    let html: string;
    if (isVerification) {
      ({ subject, text, html } = createVerificationEmail(request.username, link));
    } else {
      const safeUsername = htmlEscape(request.username);
      subject = "Đặt lại mật khẩu NaTarot / Reset your NaTarot password";
      text = `Xin chào ${request.username}, hãy đặt lại mật khẩu NaTarot của bạn tại: ${link}\n\nHello ${request.username}, reset your NaTarot password here: ${link}`;
      html = `<p>Xin chào ${safeUsername}, hãy <a href="${link}">đặt lại mật khẩu NaTarot</a> của bạn.</p><p>Hello ${safeUsername}, <a href="${link}">reset your NaTarot password</a>.</p>`;
    }

    let response: Response;
    try {
      response = await fetchImpl(RESEND_EMAILS_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ from, to: [request.to], subject, text, html }),
      });
    } catch {
      throw providerError("unknown", "network");
    }
    if (!response.ok) throw providerError(response.status, "provider");
  }

  return {
    sendVerification: (request) => send(request, "verification"),
    sendPasswordReset: (request) => send(request, "reset"),
  };
}
