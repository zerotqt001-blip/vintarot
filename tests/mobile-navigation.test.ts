import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import test from "node:test";

const shell = readFileSync(new URL("../app/vintarot.tsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

test("Create renders the same five labeled primary destinations as the Home rail", () => {
  const markup = execFileSync(process.execPath, ["-e", [
    "require('tsx/cjs');",
    "const React = require('react');",
    "const { renderToStaticMarkup } = require('react-dom/server');",
    "const VinTarot = require('./app/vintarot.tsx').default;",
    "process.stdout.write(renderToStaticMarkup(React.createElement(VinTarot, { user: null, path: '/create', children: React.createElement('p', null, 'Create page') })));",
  ].join(" ")], { encoding: "utf8" });
  const rail = markup.match(/<nav class="home-primary-nav"[\s\S]*?<\/nav>/)?.[0];

  assert.ok(rail, "Create should render the Home primary navigation rail");
  const links = [...rail.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/g)];
  assert.deepEqual(links.map(([, attributes]) => attributes.match(/href="([^"]+)"/)?.[1]), [
    "/",
    "/create",
    "/packages",
    "/affiliate",
    "/auth?return_to=/account",
  ]);
  assert.deepEqual(links.map(([, , content]) => content.match(/class="home-nav-label">([^<]+)</)?.[1]), [
    "Trang chủ",
    "Rút Bài Ngay",
    "Gói Thành Viên",
    "Affiliate",
    "Tài Khoản",
  ]);
  assert.match(links[1]?.[0] ?? "", /class="active"[^>]*aria-current="page"/);
  assert.match(markup, /class="personal-nav"/);
});

test("Account renders readable Home links and keeps its active state with the login return path", () => {
  const markup = execFileSync(process.execPath, ["-e", [
    "require('tsx/cjs');",
    "const React = require('react');",
    "const { renderToStaticMarkup } = require('react-dom/server');",
    "const VinTarot = require('./app/vintarot.tsx').default;",
    "process.stdout.write(renderToStaticMarkup(React.createElement(VinTarot, { user: null, path: '/account', children: React.createElement('p', null, 'Account page content') })));",
  ].join(" ")], { encoding: "utf8" });
  const rail = markup.match(/<nav class="home-primary-nav"[\s\S]*?<\/nav>/)?.[0];

  assert.ok(rail, "Account should render the Home primary navigation rail");
  const links = [...rail.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/g)];
  assert.deepEqual(links.map(([, attributes]) => attributes.match(/href="([^"]+)"/)?.[1]), [
    "/",
    "/create",
    "/packages",
    "/affiliate",
    "/auth?return_to=/account",
  ]);
  assert.deepEqual(links.map(([, , content]) => content.match(/class="home-nav-label">([^<]+)</)?.[1]), [
    "Trang chủ",
    "Rút Bài Ngay",
    "Gói Thành Viên",
    "Affiliate",
    "Tài Khoản",
  ]);
  assert.match(links[4]?.[0] ?? "", /class="active"[^>]*aria-current="page"/);
  assert.equal(/class="personal-nav"/.test(markup), false, "Account should hide the secondary personal shortcuts");
  assert.match(markup, /Account page content/);
});

test("Affiliate renders the same five labeled icon links as Home with Affiliate active", () => {
  const markup = execFileSync(process.execPath, ["-e", [
    "require('tsx/cjs');",
    "const React = require('react');",
    "const { renderToStaticMarkup } = require('react-dom/server');",
    "const VinTarot = require('./app/vintarot.tsx').default;",
    "process.stdout.write(renderToStaticMarkup(React.createElement(VinTarot, { user: null, path: '/affiliate', children: React.createElement('p', null, 'Affiliate page content') })));",
  ].join(" ")], { encoding: "utf8" });
  const rail = markup.match(/<nav class="home-primary-nav"[\s\S]*?<\/nav>/)?.[0];

  assert.ok(rail, "Affiliate should render the Home primary navigation rail");
  const links = [...rail.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/g)];
  assert.deepEqual(links.map(([, attributes]) => attributes.match(/href="([^"]+)"/)?.[1]), [
    "/",
    "/create",
    "/packages",
    "/affiliate",
    "/auth?return_to=/account",
  ]);
  assert.deepEqual(links.map(([, , content]) => content.match(/class="home-nav-label">([^<]+)</)?.[1]), [
    "Trang chủ",
    "Rút Bài Ngay",
    "Gói Thành Viên",
    "Affiliate",
    "Tài Khoản",
  ]);
  assert.ok(links.every(([, , content]) => /class="nav-orb"[^>]*>\s*<svg\b/.test(content)), "Every Home destination should retain its icon");
  assert.match(links[3]?.[0] ?? "", /class="active"[^>]*aria-current="page"/);
  assert.doesNotMatch(rail, /affiliate-nav-arc|arc-label/);
  assert.match(markup, /Affiliate page content/);
});

test("Affiliate Home rail keeps five readable icon labels in the mobile bottom bar", () => {
  assert.ok(styles.includes(".affiliate-shell .home-primary-nav{display:grid;grid-template-columns:repeat(5,minmax(0,1fr))"), "Affiliate should keep five Home destinations across the mobile rail");
  assert.ok(styles.includes(".affiliate-shell .home-primary-nav .nav-orb svg{width:18px;height:18px}"), "Affiliate icons should use the compact Home mobile size");
  assert.ok(styles.includes(".affiliate-shell .home-nav-label{max-width:70px;overflow:hidden;text-overflow:ellipsis}"), "Affiliate labels should remain readable without overflowing their mobile items");
  assert.ok(styles.includes(".site-shell.affiliate-shell .site-sidebar{height:calc(86px + env(safe-area-inset-bottom))!important}"), "The Affiliate mobile rail should keep Home height despite the shared shell rule");
});

test("Daily spread keeps the primary navigation and page content without the secondary personal shortcuts", () => {
  const markup = execFileSync(process.execPath, ["-e", [
    "require('tsx/cjs');",
    "const React = require('react');",
    "const { renderToStaticMarkup } = require('react-dom/server');",
    "const VinTarot = require('./app/vintarot.tsx').default;",
    "process.stdout.write(renderToStaticMarkup(React.createElement(VinTarot, { user: null, path: '/daily-spread', children: React.createElement('p', null, 'Daily spread page content') })));",
  ].join(" ")], { encoding: "utf8" });
  const rail = markup.match(/<nav class="main-nav">[\s\S]*?<\/nav>/)?.[0];

  assert.ok(rail, "Daily spread should retain its primary navigation");
  assert.deepEqual([...rail.matchAll(/<a\b[^>]*href="([^"]+)"/g)].map(([, href]) => href), [
    "/",
    "/guidebook",
    "/community",
    "/book",
  ]);
  assert.equal(/class="personal-nav"/.test(markup), false, "Daily spread should hide the secondary personal shortcuts");
  assert.match(markup, /Daily spread page content/);
});

test("mobile primary navigation exposes readable labels and preserves Room's dedicated controls", () => {
  assert.match(shell, /const isRoom = path === "\/room";/);
  assert.match(shell, /isRoom \? "site-shell room-shell"/);
  assert.match(shell, /className="mobile-nav-label">\{t\(key\)\}<\/span>/);
});

test("mobile primary navigation moves to a full-width bottom bar with safe-area spacing", () => {
  assert.match(styles, /\.site-shell:not\(\.room-shell\) \.site-sidebar/);
  assert.match(styles, /top:auto!important/);
  assert.match(styles, /bottom:0!important/);
  assert.match(styles, /grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/);
  assert.match(styles, /min-height:44px/);
  assert.match(styles, /\.home-shell \.topbar-nav,\.site-shell:not\(\.room-shell\) \.topbar-nav\{display:none\}/);
  assert.match(styles, /padding-bottom:calc\(104px \+ env\(safe-area-inset-bottom\)\)!important/);
  assert.match(styles, /\.mobile-nav-label\{display:block/);
});

test("mobile bottom navigation clears the old fixed footer and keeps the page content reachable", () => {
  assert.match(styles, /(?:\.site-shell:not\(\.room-shell\) footer,\.home-shell footer|\.home-shell footer,\.site-shell:not\(\.room-shell\) footer)\{display:none\}/);
  assert.match(styles, /(?:\.site-shell:not\(\.room-shell\) \.main,\.home-shell \.main|\.home-shell \.main,\.site-shell:not\(\.room-shell\) \.main)\{[^}]*padding-bottom:calc\(/);
});

test("Room navigation tucks to the left edge on desktop pointers and opens on hover or keyboard focus", () => {
  assert.ok(/@media\s*\(hover:\s*hover\)\s*and\s*\(pointer:\s*fine\)\s*and\s*\(min-width:\s*821px\)/.test(styles), "Room auto-hide should only target desktop pointer devices");
  assert.ok(/\.room-shell \.site-sidebar\s*\{[^}]*transform:\s*translateX\(calc\(-100% \+ 14px\)\)/.test(styles), "Room navigation should leave a 14px edge trigger");
  assert.ok(/\.room-shell \.site-sidebar:hover\s*,\s*\.room-shell \.site-sidebar:focus-within\s*\{[^}]*transform:\s*translateX\(0\)/.test(styles), "Hover and keyboard focus should reveal Room navigation");
});
