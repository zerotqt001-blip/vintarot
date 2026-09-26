import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

function read(path: string): string {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

test("auth shell defines one shared celestial experience for every auth state", () => {
  const shell = read("components/auth/auth-shell.tsx");
  const styles = read("app/globals.css");

  assert.match(shell, /export function AuthShell/);
  assert.match(shell, /AuthBrand/);
  assert.match(shell, /AuthFooter/);
  assert.match(styles, /celestial-observatory\.png/);
  assert.match(shell, /auth-shell__background/);
  assert.match(shell, /auth-shell__quote/);
});

test("auth screens use shared fields, icon affordances, and real auth navigation", () => {
  const auth = read("app/auth/auth.tsx");
  const shell = read("components/auth/auth-shell.tsx");
  const authSources = `${auth}\n${shell}`;

  assert.match(auth, /from "@\/components\/auth\/auth-shell"/);
  assert.match(auth, /AuthShell/);
  assert.match(auth, /AuthField/);
  assert.match(auth, /MailIcon/);
  assert.match(auth, /LockKeyholeIcon/);
  assert.match(auth, /UserRoundIcon/);
  assert.match(auth, /PhoneIcon/);
  assert.match(auth, /ArrowRightIcon/);
  assert.match(authSources, /auth\.placeholderEmail/);
  assert.match(authSources, /auth\.placeholderUsername/);
  assert.match(authSources, /auth\.placeholderPhone/);
  assert.match(authSources, /auth\.placeholderPassword/);
  assert.match(authSources, /auth\.brandTagline/);
});

test("same-tab verification keeps only a safe, expiring return path for Tarot draft resumption", () => {
  const auth = read("app/auth/auth.tsx");
  const resume = read("lib/tarot-room-resume.ts");
  const messages = read("lib/i18n.ts");
  assert.match(auth, /initialMode !== "verify"/);
  assert.match(auth, /decodeTarotAuthReturnRecord/);
  assert.match(auth, /window\.location\.assign\(authReturnTo\)/);
  assert.match(auth, /TAROT_AUTH_RETURN_STORAGE_KEY/);
  assert.match(resume, /isSafeTarotAuthReturnPath/);
  assert.match(resume, /TAROT_ROOM_RESUME_MAX_AGE_MS/);
  assert.doesNotMatch(auth, /localStorage/);
  assert.match(messages, /verifyPending: "[^"]*return to this tab to sign in and continue your reading/i);
  assert.match(messages, /verifyPending: "[^"]*quay lại thẻ trình duyệt này để đăng nhập và tiếp tục trải bài/i);
});

test("auth visual contract includes responsive shell, field states, and shared footer", () => {
  const styles = read("app/globals.css");

  for (const selector of [
    ".auth-shell",
    ".auth-shell__header",
    ".auth-shell__card",
    ".auth-shell__footer",
    ".auth-shell__quote",
    ".auth-field",
    ".auth-field--error",
    ".auth-primary",
    ".auth-google",
    "@media(max-width:768px)",
    "@media(max-width:480px)",
  ]) {
    assert.match(styles, new RegExp(selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});

test("auth copy exposes the new shared brand, placeholders, quotes, and footer labels", () => {
  const messages = read("lib/i18n.ts");

  for (const key of [
    "brandTagline",
    "brandSubline",
    "placeholderEmail",
    "placeholderUsername",
    "placeholderPhone",
    "placeholderPassword",
    "decorativeLeft",
    "decorativeRight",
    "footerGuide",
    "footerPrivacy",
    "footerContact",
  ]) {
    assert.match(messages, new RegExp(`${key}:`));
  }
});
