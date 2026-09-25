import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import test from "node:test";

const shell = [
  "../components/shell/natarot-shell.tsx",
  "../components/shell/natarot-header.tsx",
  "../components/shell/natarot-sidebar.tsx",
].map((path) => readFileSync(new URL(path, import.meta.url), "utf8")).join("\n");
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
  assert.match(markup, /class="site-shell create-shell"/);
  const links = [...rail.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/g)];
  assert.deepEqual(links.map(([, attributes]) => attributes.match(/href="([^"]+)"/)?.[1]), [
    "/",
    "/create",
    "/packages",
    "/affiliate",
    "/auth?return_to=/account",
  ]);
  assert.deepEqual(links.map(([, , content]) => content.match(/class="nav-label">([^<]+)</)?.[1]), [
    "Trang chủ",
    "Rút Bài Ngay",
    "Gói Thành Viên",
    "Affiliate",
    "Tài Khoản",
  ]);
  assert.match(links[1]?.[0] ?? "", /class="active"[^>]*aria-current="page"/);
  assert.match(markup, /class="personal-nav"/);
  assert.match(styles, /\.site-shell:is\(\.create-shell,\.account-shell\) \.home-primary-nav\{display:grid/);
  assert.match(styles, /\.site-shell:is\(\.create-shell,\.account-shell\) \.main\{[^}]*padding-bottom:calc\(111px/);
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
  assert.match(markup, /class="site-shell account-shell"/);
  assert.deepEqual(links.map(([, , content]) => content.match(/class="nav-label">([^<]+)</)?.[1]), [
    "Trang chủ",
    "Rút Bài Ngay",
    "Gói Thành Viên",
    "Affiliate",
    "Tài Khoản",
  ]);
  assert.match(links[4]?.[0] ?? "", /class="active"[^>]*aria-current="page"/);
  assert.doesNotMatch(markup, /class="personal-nav"/);
  assert.match(styles, /\.site-shell:is\(\.create-shell,\.account-shell\) \.site-sidebar/);
  assert.doesNotMatch(styles, /\.site-shell\.account-shell \.nt-global-sidebar\{/);
  assert.match(markup, /Account page content/);
});

test("Affiliate uses the Home navigation rail with five labeled icons and Affiliate active", () => {
  const markup = execFileSync(process.execPath, ["-e", [
    "require('tsx/cjs');",
    "const React = require('react');",
    "const { renderToStaticMarkup } = require('react-dom/server');",
    "const VinTarot = require('./app/vintarot.tsx').default;",
    "process.stdout.write(renderToStaticMarkup(React.createElement(VinTarot, { user: null, path: '/affiliate', children: React.createElement('p', null, 'Affiliate page content') })));",
  ].join(" ")], { encoding: "utf8" });
  const rail = markup.match(/<nav class="home-primary-nav"[\s\S]*?<\/nav>/)?.[0];

  assert.ok(rail, "Affiliate should render the Home primary navigation rail");
  assert.match(markup, /class="site-shell affiliate-shell"/);
  const links = [...rail.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/g)];
  assert.deepEqual(links.map(([, attributes]) => attributes.match(/href="([^"]+)"/)?.[1]), [
    "/",
    "/create",
    "/packages",
    "/affiliate",
    "/auth?return_to=/account",
  ]);
  assert.deepEqual(links.map(([, , content]) => content.match(/class="nav-label">([^<]+)</)?.[1]), [
    "Trang chủ",
    "Rút Bài Ngay",
    "Gói Thành Viên",
    "Affiliate",
    "Tài Khoản",
  ]);
  assert.ok(links.every(([, , content]) => /class="nav-orb"[^>]*>\s*<svg\b/.test(content)), "All five Home destinations should retain their icons");
  assert.match(links[3]?.[0] ?? "", /class="active"[^>]*aria-current="page"/);
  assert.match(markup, /class="home-rail-signature"/);
  assert.ok(/\.site-shell\.affiliate-shell \.home-primary-nav\{\s*display:grid;\s*gap:4px;\s*padding:18px 9px/.test(styles), "Affiliate should receive the desktop Home rail styling");
  assert.ok(/@media\s*\(max-width:700px\)\s*\{[\s\S]*?\.site-shell\.affiliate-shell \.home-primary-nav\{\s*display:grid;\s*grid-template-columns:repeat\(5,minmax\(0,1fr\)\)/.test(styles), "Affiliate should keep all five labeled destinations in the Home mobile bar");
  assert.match(markup, /Affiliate page content/);
});

test("Daily spread keeps its primary navigation without secondary personal shortcuts", () => {
  const markup = execFileSync(process.execPath, ["-e", [
    "require('tsx/cjs');",
    "const React = require('react');",
    "const { renderToStaticMarkup } = require('react-dom/server');",
    "const VinTarot = require('./app/vintarot.tsx').default;",
    "process.stdout.write(renderToStaticMarkup(React.createElement(VinTarot, { user: null, path: '/daily-spread', children: React.createElement('p', null, 'Daily spread page content') })));",
  ].join(" ")], { encoding: "utf8" });
  const rail = markup.match(/<nav class="main-nav nt-global-nav-list"[\s\S]*?<\/nav>/)?.[0];

  assert.ok(rail, "Daily spread should retain its primary navigation");
  assert.deepEqual([...rail.matchAll(/<a\b[^>]*href="([^"]+)"/g)].map(([, href]) => href), [
    "/",
    "/create",
    "/packages",
    "/affiliate",
    "/auth?return_to=/account",
  ]);
  assert.doesNotMatch(markup, /class="personal-nav"/);
  assert.match(markup, /Daily spread page content/);
});

test("mobile primary navigation exposes readable labels and preserves Room's dedicated controls", () => {
  assert.match(shell, /path === "\/room"/);
  assert.match(shell, /variant === "immersive"[\s\S]*"site-shell room-shell"/);
  assert.match(shell, /className="nav-label">\{t\(key\)\}<\/span>/);
  assert.match(styles, /\.nt-global-sidebar \.nav-label\{display:block/);
});

test("mobile primary navigation moves to a full-width bottom bar with safe-area spacing", () => {
  assert.match(styles, /\.site-shell:not\(\.room-shell\) \.site-sidebar/);
  assert.match(styles, /top:auto!important/);
  assert.match(styles, /bottom:0!important/);
  assert.match(styles, /grid-template-columns:repeat\(5,minmax\(0,1fr\)\)/);
  assert.match(styles, /min-height:44px/);
  assert.match(styles, /\.home-shell \.topbar-nav,\.site-shell:not\(\.room-shell\) \.topbar-nav\{display:none\}/);
  assert.match(styles, /padding-bottom:calc\(104px \+ env\(safe-area-inset-bottom\)\)!important/);
  assert.match(styles, /\.nt-global-sidebar \.nav-label\{display:block/);
});

test("mobile bottom navigation clears the old fixed footer and keeps the page content reachable", () => {
  assert.match(styles, /(?:\.site-shell:not\(\.room-shell\) footer,\.home-shell footer|\.home-shell footer,\.site-shell:not\(\.room-shell\) footer)\{display:none\}/);
  assert.match(styles, /(?:\.site-shell:not\(\.room-shell\) \.main,\.home-shell \.main|\.home-shell \.main,\.site-shell:not\(\.room-shell\) \.main)\{[^}]*padding-bottom:calc\(/);
});

test("Daily mobile content clears both fixed navigation bars after shared shell overrides", () => {
  const sharedMobileOverrideIndex = styles.lastIndexOf(".site-shell:not(.room-shell) .main,.membership-shell .main{");
  const dailyClearanceIndex = styles.lastIndexOf(".site-shell.daily-shell .main{");

  assert.ok(dailyClearanceIndex > sharedMobileOverrideIndex, "Daily should declare its final clearance after the shared mobile shell override");
  const dailyClearanceEnd = styles.indexOf("}", dailyClearanceIndex);
  const dailyClearanceRule = styles.slice(dailyClearanceIndex, dailyClearanceEnd + 1);
  assert.match(dailyClearanceRule, /padding-bottom:calc\(152px \+ env\(safe-area-inset-bottom\)\)!important/);
});

test("Room navigation tucks to the left edge on desktop pointers and opens on hover or keyboard focus", () => {
  assert.ok(/@media\s*\(hover:\s*hover\)\s*and\s*\(pointer:\s*fine\)\s*and\s*\(min-width:\s*821px\)/.test(styles), "Room auto-hide should only target desktop pointer devices");
  assert.ok(/\.room-shell \.site-sidebar\s*\{[^}]*transform:\s*translateX\(calc\(-100% \+ 14px\)\)/.test(styles), "Room navigation should leave a 14px edge trigger");
  assert.ok(/\.room-shell \.site-sidebar:hover\s*,\s*\.room-shell \.site-sidebar:focus-within\s*\{[^}]*transform:\s*translateX\(0\)/.test(styles), "Hover and keyboard focus should reveal Room navigation");
});
