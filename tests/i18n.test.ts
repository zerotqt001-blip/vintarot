import { strict as assert } from "node:assert";
import { test } from "node:test";
import { localeLabel, messageFor, normalizeLocale, messages } from "../lib/i18n";

const authKeys = [
  "loginTitle",
  "registerTitle",
  "email",
  "username",
  "phone",
  "password",
  "verifyTitle",
  "identifier",
  "verificationIdentifier",
  "submitLogin",
  "submitRegister",
  "google",
  "forgotPassword",
  "resetPassword",
  "sendReset",
  "verifyPending",
  "resendVerification",
  "resendVerificationSubmit",
  "verifySuccess",
  "genericError",
  "logout",
  "completeTitle",
  "completeHelp",
  "phonePrivacy",
  "loginHelp",
  "registerHelp",
  "verifyHelp",
  "forgotHelp",
  "resetHelp",
  "submitReset",
  "checkEmail",
  "backToLogin",
  "createAccount",
  "haveAccount",
  "noAccount",
  "continueGoogle",
  "completeSubmit",
  "invalidLink",
  "signedOut",
  "googleError",
  "loginSuccess",
] as const;

test("normalizes supported language values and falls back to English", () => {
  assert.equal(normalizeLocale("vi"), "vi");
  assert.equal(normalizeLocale("Tiếng Việt"), "vi");
  assert.equal(normalizeLocale("en-US"), "en");
  assert.equal(normalizeLocale("unknown"), "en");
});

test("provides translated labels for the language control", () => {
  assert.equal(localeLabel("en"), "English");
  assert.equal(localeLabel("vi"), "Tiếng Việt");
  assert.equal(messages.vi.nav.home, "Trang chủ");
  assert.equal(messages.en.nav.home, "Home");
});

test("provides the complete bilingual auth dictionary", () => {
  for (const key of authKeys) {
    assert.equal(typeof messages.en.auth[key], "string", `missing English auth.${key}`);
    assert.equal(typeof messages.vi.auth[key], "string", `missing Vietnamese auth.${key}`);
  }

  assert.equal(messages.en.auth.loginTitle, "Sign in");
  assert.equal(messages.en.auth.registerTitle, "Create your account");
  assert.equal(messages.en.auth.verifyTitle, "Verify your email");
  assert.equal(messages.en.auth.phone, "Phone number");
  assert.equal(messages.en.auth.continueGoogle, "Continue with Google");
  assert.equal(messages.en.auth.identifier, "Email or username");
  assert.equal(messages.en.auth.checkEmail, "Check your email");
  assert.match(messages.en.auth.phonePrivacy, /NaTarot customer care/);
  assert.match(messages.en.auth.phonePrivacy, /not shown publicly/);
  assert.equal(messages.vi.auth.loginTitle, "Đăng nhập");
  assert.equal(messages.vi.auth.registerTitle, "Tạo tài khoản");
  assert.equal(messages.vi.auth.verifyTitle, "Xác minh email");
  assert.equal(messages.vi.auth.phone, "Số điện thoại");
  assert.equal(messages.vi.auth.continueGoogle, "Tiếp tục với Google");
  assert.equal(messages.vi.auth.identifier, "Email hoặc tên người dùng");
  assert.equal(messages.vi.auth.checkEmail, "Kiểm tra email");
  assert.match(messages.vi.auth.phonePrivacy, /chăm sóc khách hàng NaTarot/);
  assert.match(messages.vi.auth.phonePrivacy, /không hiển thị công khai/);
});

test("resolves representative auth messages by locale and dotted key", () => {
  assert.equal(messageFor("en", "auth.loginTitle"), "Sign in");
  assert.equal(messageFor("vi", "auth.phone"), "Số điện thoại");
  assert.equal(messageFor("en", "auth.verifySuccess"), "Email verified successfully");
  assert.equal(messageFor("vi", "auth.resetPassword"), "Đặt lại mật khẩu");
  assert.equal(messageFor("en", "auth.completeTitle"), "Complete your profile");
});
