import { test } from "node:test";
import assert from "node:assert/strict";
import { createAuthEmailSender } from "../lib/auth-email";

type CapturedCall = { url: string | URL | Request; init: RequestInit };

function captureFetch(calls: CapturedCall[], response = new Response("{}", { status: 200 })) {
  return async (url: string | URL | Request, init: RequestInit = {}) => {
    calls.push({ url, init });
    return response;
  };
}

test("verification mail presents a bilingual 24-hour verification-link CTA", async () => {
  const calls: CapturedCall[] = [];
  const sender = createAuthEmailSender({
    apiKey: "test-only-key",
    from: "NaTarot <noreply@natarot.com>",
    origin: "https://natarot.com",
    fetchImpl: captureFetch(calls),
  });

  await sender.sendVerification({
    to: "reader@example.test",
    username: "moon_rider",
    token: "opaque test/token",
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "https://api.resend.com/emails");
  assert.equal(calls[0].init.headers && new Headers(calls[0].init.headers).get("Authorization"), "Bearer test-only-key");
  const body = JSON.parse(String(calls[0].init.body));
  assert.equal(body.from, "NaTarot <noreply@natarot.com>");
  assert.deepEqual(body.to, ["reader@example.test"]);
  assert.match(body.subject, /verify|xác minh/i);
  assert.match(body.html, /\/api\/auth\/verify\?token=opaque%20test%2Ftoken/);
  assert.match(body.html, /Xác nhận tài khoản/);
  assert.match(body.html, /Verify account/);
  assert.match(body.html, /24 giờ/);
  assert.match(body.html, /24 hours/);
  assert.match(body.html, /role="presentation"/);
  assert.match(body.html, /style="/);
  assert.match(body.html, /max-width:600px/);
  assert.equal((body.html.match(/<table\b/g) ?? []).length, (body.html.match(/<\/table>/g) ?? []).length);
  assert.equal((body.html.match(/<a\b/g) ?? []).length, (body.html.match(/<\/a>/g) ?? []).length);
  assert.doesNotMatch(body.html, /<script\b|https?:\/\/[^" ]+\.(png|jpg|gif|svg)\b/i);
  assert.match(body.text, /Xác nhận tài khoản/);
  assert.match(body.text, /Verify your NaTarot account/);
  assert.match(body.text, /24 giờ/);
  assert.match(body.text, /24 hours/);
  assert.match(body.text, /https:\/\/natarot\.com\/api\/auth\/verify\?token=opaque%20test%2Ftoken/);
  assert.doesNotMatch(body.html, /OTP|one-time code|verification code|mã xác nhận/i);
  assert.doesNotMatch(body.text, /OTP|one-time code|verification code|mã xác nhận/i);
  assert.equal(body.reply_to, undefined);
});

test("verification mail escapes the username without changing the verification URL", async () => {
  const calls: CapturedCall[] = [];
  const sender = createAuthEmailSender({
    apiKey: "test-only-key",
    from: "NaTarot <noreply@natarot.com>",
    origin: "https://natarot.com",
    fetchImpl: captureFetch(calls),
  });

  await sender.sendVerification({
    to: "reader@example.test",
    username: "moon<&>rider",
    token: "opaque-token",
  });

  const body = JSON.parse(String(calls[0].init.body));
  assert.match(body.html, /moon&lt;&amp;&gt;rider/);
  assert.doesNotMatch(body.html, /moon<&>rider/);
  assert.match(body.text, /moon<&>rider/);
  assert.match(body.html, /\/api\/auth\/verify\?token=opaque-token/);
  assert.match(body.text, /https:\/\/natarot\.com\/api\/auth\/verify\?token=opaque-token/);
});

test("password reset mail uses the auth reset screen and bilingual copy", async () => {
  const calls: CapturedCall[] = [];
  const sender = createAuthEmailSender({
    apiKey: "test-only-key",
    from: "NaTarot <noreply@natarot.com>",
    origin: "https://natarot.com/",
    fetchImpl: captureFetch(calls),
  });

  await sender.sendPasswordReset({
    to: "reader@example.test",
    username: "moon rider",
    token: "reset token/?&",
  });

  const body = JSON.parse(String(calls[0].init.body));
  assert.match(body.subject, /reset|đặt lại/i);
  assert.match(body.html, /\/auth\?reset=1&token=reset%20token%2F%3F%26/);
  assert.match(body.text, /Đặt lại|reset/i);
  assert.match(body.html, /Đặt lại|reset/i);
});

test("missing Resend key throws a safe configuration error", () => {
  assert.throws(
    () =>
      createAuthEmailSender({
        apiKey: "",
        from: "NaTarot <noreply@natarot.com>",
        origin: "https://natarot.com",
        fetchImpl: captureFetch([]),
      }),
    (error: unknown) => {
      assert.match(String(error), /email configuration/i);
      assert.doesNotMatch(String(error), /test-only-key|Bearer|token/i);
      return true;
    },
  );
});

test("a provider failure exposes only a safe status and category", async () => {
  const apiKey = "super-secret-resend-key";
  const token = "raw-reset-token";
  const sender = createAuthEmailSender({
    apiKey,
    from: "NaTarot <noreply@natarot.com>",
    origin: "https://natarot.com",
    fetchImpl: captureFetch([], new Response("provider details with secret", { status: 422 })),
  });

  await assert.rejects(
    sender.sendPasswordReset({ to: "reader@example.test", username: "moon_rider", token }),
    (error: unknown) => {
      const message = String(error);
      assert.match(message, /422/);
      assert.match(message, /provider|email/i);
      assert.doesNotMatch(message, new RegExp(apiKey));
      assert.doesNotMatch(message, new RegExp(token));
      assert.doesNotMatch(message, /provider details with secret/i);
      assert.doesNotMatch(message, /authorization|bearer/i);
      return true;
    },
  );
});

test("a thrown fetch error is replaced with fixed safe network metadata", async () => {
  const leakedToken = "injected-token-from-fetch";
  const leakedKey = "injected-key-from-fetch";
  const sender = createAuthEmailSender({
    apiKey: "test-only-key",
    from: "NaTarot <noreply@natarot.com>",
    origin: "https://natarot.com",
    fetchImpl: async () => {
      throw new Error(`Email provider error (status 500, category: provider): ${leakedToken} ${leakedKey}`);
    },
  });

  await assert.rejects(
    sender.sendVerification({ to: "reader@example.test", username: "moon_rider", token: leakedToken }),
    (error: unknown) => {
      const message = String(error);
      assert.equal(message, "Error: Email provider error (status unknown, category: network).");
      assert.doesNotMatch(message, new RegExp(leakedToken));
      assert.doesNotMatch(message, new RegExp(leakedKey));
      return true;
    },
  );
});
