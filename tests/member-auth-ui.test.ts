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
  assert.match(helper, /cookies\(\)/);
  assert.match(helper, /getMemberFromCookieHeader/);
  assert.match(read("lib/member-auth.ts"), /export async function getMemberFromCookieHeader\(database: D1Database, cookieHeader: string \| null\)/);
});

test("the member-aware shell and protected empty states link to member auth", () => {
  const shell = read("app/vintarot.tsx");
  const pages = read("app/pages.tsx");
  const room = read("app/room/room.tsx");
  const messages = read("lib/i18n.ts");

  assert.match(shell, /\/auth\?return_to=\/profile/);
  assert.match(pages, /\/auth\?return_to=\/profile/);
  assert.match(pages, /\/auth\?return_to=\/daily-spread/);
  assert.match(room, /\/auth\?return_to=\/room/);
  assert.doesNotMatch(messages, /Sign in with ChatGPT|Đăng nhập với ChatGPT/);
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
