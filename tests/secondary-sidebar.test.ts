import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import test from "node:test";

function renderShell(path: string, content: string) {
  return execFileSync(process.execPath, ["-e", [
    "require('tsx/cjs');",
    "const React = require('react');",
    "const { renderToStaticMarkup } = require('react-dom/server');",
    "const VinTarot = require('./app/vintarot.tsx').default;",
    `process.stdout.write(renderToStaticMarkup(React.createElement(VinTarot, { user: null, path: ${JSON.stringify(path)}, children: React.createElement('p', null, ${JSON.stringify(content)}) })));`,
  ].join(" ")], { encoding: "utf8" });
}

test("Account keeps the primary navigation and content while omitting personal shortcuts", () => {
  const markup = renderShell("/account", "Account page content");
  const rail = markup.match(/<nav class="main-nav">[\s\S]*?<\/nav>/)?.[0];

  assert.ok(rail, "Account should keep its primary navigation rail");
  assert.deepEqual([...rail.matchAll(/<a\b[^>]*href="([^"]+)"/g)].map(([, href]) => href), [
    "/",
    "/guidebook",
    "/community",
    "/book",
  ]);
  assert.equal(/class="personal-nav"/.test(markup), false, "Account should omit the secondary personal shortcuts");
  assert.ok(markup.includes("Account page content"), "Account content should remain");
});

test("Daily Spread keeps the site navigation and content while omitting personal shortcuts", () => {
  const markup = renderShell("/daily-spread", "Daily Spread page content");
  const rail = markup.match(/<nav class="main-nav">[\s\S]*?<\/nav>/)?.[0];

  assert.ok(rail, "Daily Spread should keep its primary navigation rail");
  assert.deepEqual([...rail.matchAll(/<a\b[^>]*href="([^"]+)"/g)].map(([, href]) => href), [
    "/",
    "/guidebook",
    "/community",
    "/book",
  ]);
  assert.equal(/class="personal-nav"/.test(markup), false, "Daily Spread should omit the secondary personal shortcuts");
  assert.ok(markup.includes("Daily Spread page content"), "Daily Spread content should remain");
});
