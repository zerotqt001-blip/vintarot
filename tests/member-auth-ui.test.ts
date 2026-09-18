import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import test from "node:test";

const root = new URL("..", import.meta.url);
const read = (path: string) => readFileSync(new URL(path, root), "utf8");
const productSources = ["app", "lib"].flatMap((directory) => collectSources(new URL(`${directory}/`, root)));

function collectSources(directory: URL): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryUrl = new URL(entry.name, directory);
    if (entry.isDirectory()) return collectSources(new URL(`${entry.name}/`, directory));
    return /\.(?:ts|tsx)$/.test(entry.name) ? [readFileSync(entryUrl, "utf8")] : [];
  });
}

test("server entrypoints use the member page projection instead of ChatGPT identity", () => {
  for (const path of ["app/page.tsx", "app/[section]/page.tsx", "app/create/page.tsx", "app/room/page.tsx", "app/guidebook/[card]/page.tsx"]) {
    const source = read(path);
    assert.doesNotMatch(source, /getChatGPTUser/);
    assert.match(source, /getPageMember/);
    assert.match(source, /dynamic\s*=\s*["']force-dynamic["']/);
  }

  const helper = read("lib/member-page.ts");
  assert.doesNotMatch(helper, /server-only/);
  assert.match(helper, /cookies\(\)/);
  assert.match(helper, /getMemberFromCookieHeader/);
  assert.match(read("lib/member-auth.ts"), /export async function getMemberFromCookieHeader\(database: D1Database, cookieHeader: string \| null\)/);
});

test("anonymous page identity skips runtime database initialization", () => {
  const helper = read("lib/member-page.ts");

  assert.doesNotMatch(helper, /from ["']@\/lib\/runtime["']/);
  assert.match(helper, /cookieStore\.get\(SESSION_COOKIE_NAME\)\?\.value/);
  assert.match(helper, /if \(!sessionCookie\) return null/);
  assert.match(helper, /await import\(["']@\/lib\/runtime["']\)/);
  assert.match(helper, /getMemberFromCookieHeader\(getRuntimeDatabase\(\), cookieStore\.toString\(\)\)/);
});

test("the member-aware shell and protected empty states link to member auth", () => {
  const shell = read("app/vintarot.tsx");
  const pages = read("app/pages.tsx");
  const room = read("app/room/room.tsx");
  const messages = read("lib/i18n.ts");

  assert.match(shell, /\/auth\?return_to=\/profile/);
  assert.match(pages, /returnTo/);
  assert.match(pages, /<SignIn returnTo="\/profile" \/>/);
  assert.match(pages, /<SignIn returnTo="\/journal" \/>/);
  assert.match(pages, /<SignIn returnTo="\/bookings" \/>/);
  assert.match(pages, /<SignIn returnTo="\/invites" \/>/);
  assert.match(pages, /\/auth\?return_to=\/daily-spread/);
  assert.match(room, /const profileHref\s*=\s*user\s*\?\s*["']\/profile["']\s*:\s*["']\/auth\?return_to=\/profile["']/);
  assert.match(room, /href=\{profileHref\}/);
  assert.doesNotMatch(messages, /Sign in with ChatGPT|Đăng nhập với ChatGPT/);
});

test("Sites tooling does not provide legacy ChatGPT mock auth", () => {
  const vite = read("vite.config.ts");
  const plugin = read("build/sites-vite-plugin.ts");

  assert.doesNotMatch(vite, /mockAuth/);
  for (const legacy of [
    /signin-with-chatgpt/,
    /signout-with-chatgpt/,
    /\/callback/,
    /oai-authenticated-user/,
    /local_seedy/,
    /sites-local-auth/,
    /__sites_local_auth/,
  ]) {
    assert.doesNotMatch(plugin, legacy);
  }
  assert.match(plugin, /async closeBundle\(\)/);
  assert.match(plugin, /cp\(hostingConfig/);
});

test("product source no longer uses ChatGPT owner resolution", () => {
  assert.doesNotMatch(productSources.join("\n"), /getChatGPTUser|signin-with-chatgpt|oai-authenticated-user/);
});

test("phone remains private to the profile surface", () => {
  assert.doesNotMatch(read("app/vintarot.tsx"), /\bphone\b/);
  assert.doesNotMatch(read("app/room/room.tsx"), /\bphone\b/);
  assert.doesNotMatch(read("components/language.tsx"), /\bphone\b/);
  assert.match(read("app/pages.tsx"), /user\.phone/);
});

test("auth entry validates its query state before rendering a localized form", () => {
  const page = read("app/auth/page.tsx");
  const screen = read("app/auth/auth.tsx");

  assert.match(page, /dynamic\s*=\s*["']force-dynamic["']/);
  assert.match(page, /safeRelativeReturnPath/);
  assert.match(page, /return_to/);
  assert.match(page, /login|register|forgot|verify/);
  assert.match(page, /verified/);
  assert.match(page, /error/);
  assert.match(page, /reset/);
  assert.match(screen, /useLanguage/);
  assert.match(screen, /t\(["']auth\./);
  assert.match(screen, /LanguageSelect/);
  assert.match(screen, /auth\/verification\/resend/);
  assert.match(screen, /phonePrivacy/);
});

test("auth forms use the member endpoints and Google uses top-level navigation", () => {
  const screen = read("app/auth/auth.tsx");

  for (const route of ["auth/login", "auth/register", "auth/password-reset/request", "auth/password-reset/confirm"]) {
    assert.match(screen, new RegExp(route.replace(/[/.]/g, "\\$&")));
  }
  for (const field of ["identifier", "email", "username", "phone", "password", "token"]) {
    assert.match(screen, new RegExp(`\\b${field}\\b`));
  }
  assert.match(screen, /href=\{googleHref\}/);
  assert.match(screen, /\/api\/auth\/google\/start\?return_to=/);
  assert.match(screen, /window\.location\.assign\(returnTo\)/);
  assert.doesNotMatch(screen, /fetch\([^)]*google\/start/);
});

test("Google completion submits the token only to its endpoint and keeps phone private", () => {
  const completion = read("app/auth/complete/page.tsx");
  const completionUi = read("app/auth/auth.tsx");
  const authSources = [read("app/auth/page.tsx"), completionUi, completion].join("\n");

  assert.match(completion, /dynamic\s*=\s*["']force-dynamic["']/);
  assert.match(completion, /searchParams/);
  assert.match(completionUi, /auth\/google\/complete/);
  assert.match(completionUi, /\{\s*token\s*,\s*username\s*,\s*phone\s*\}/);
  assert.match(completionUi, /phonePrivacy/);
  assert.match(completionUi, /LanguageSelect/);
  assert.match(completionUi, /window\.location\.assign/);
  assert.doesNotMatch(authSources, /localStorage/);
  assert.doesNotMatch(authSources, /ChatGPT/);
});
