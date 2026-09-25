import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { join } from "node:path";
import { messageFor } from "../lib/i18n";

const root = join(import.meta.dirname, "..");
const read = (relativePath: string) => readFileSync(join(root, relativePath), "utf8");
const shell = [
  "components/shell/natarot-shell.tsx",
  "components/shell/natarot-header.tsx",
  "components/shell/natarot-sidebar.tsx",
  "components/shell/natarot-footer.tsx",
].map(read).join("\n");
const pages = read("app/pages.tsx");
const commerce = read("app/commerce/commerce-pages.tsx");
const affiliate = read("components/affiliate/affiliate-dashboard.tsx");
const account = read("components/account/account-history.tsx");
const room = read("app/room/room.tsx");
const styles = read("app/globals.css");

test("final fidelity keeps one shared shell for all owner surfaces", () => {
  for (const route of ["/guidebook", "/community", "/packages", "/affiliate", "/account", "/room"]) {
    assert.match(shell, new RegExp(route.replaceAll("/", "\\/")), route);
  }
  for (const marker of [
    "guidebook-target-shell",
    "practice-shell",
    "membership-shell",
    "affiliate-shell",
    "account-shell",
    "room-shell",
  ]) assert.match(shell, new RegExp(marker), marker);
  assert.equal((shell.match(/<NaTarotHeader/g) ?? []).length, 1);
  assert.equal((shell.match(/<NaTarotSidebar/g) ?? []).length, 1);
  assert.equal((shell.match(/<NaTarotFooter/g) ?? []).length, 1);
});

test("final fidelity preserves the target page compositions and dynamic reading renderer", () => {
  for (const marker of [
    "guidebook-target-map",
    "guidebook-target-center",
    "guidebook-target-node",
    "practice-v1-composition",
    "practice-v1-reflection",
  ]) assert.match(pages, new RegExp(marker), marker);
  for (const marker of [
    "membership-package-grid",
    "affiliate-kpi-grid",
    "affiliate-dashboard-grid",
    "account-profile-card",
    "account-stat-grid",
    "account-history-panel",
    "account-transactions-panel",
    "account-security-panel",
    "account-stat-card__action",
  ]) assert.match(commerce + affiliate + account, new RegExp(marker), marker);
  assert.match(room, /<SpreadBoard geometry=\{spreadGeometry\}/);
  assert.match(room, /spreadBoardCards/);
  assert.doesNotMatch(room, /reading-spread-card-1|reading-spread-card-2|reading-spread-card-3|reading-spread-card-4/);
});

test("final fidelity uses server truth instead of owner screenshot demo values", () => {
  assert.match(commerce, /\/api\/packages/);
  assert.match(commerce, /benefitSnapshot\.credits\.expiresInSeconds/);
  assert.match(affiliate, /\/api\/affiliate\/policy/);
  assert.match(affiliate, /\/api\/affiliate\/dashboard/);
  assert.match(account, /\/api\/account\/summary/);
  assert.match(account, /\/api\/account\/history/);
  assert.match(account, /creditsReservedLabel/);
  assert.match(account, /creditsTotalLabel/);
  assert.match(account, /activeUntil/);
  assert.match(account, /recentItems/);
  assert.match(account, /kind=readings&limit=3/);
  assert.match(account, /id="account-security"/);
  assert.match(account, /\/account#account-security/);
  for (const source of [affiliate, account]) {
    for (const literal of ["96", "1.245.000", "320.000", "4.860.000", "THANH123"]) {
      assert.doesNotMatch(source, new RegExp(literal.replaceAll(".", "\\.")), literal);
    }
  }
});

test("final desktop composition has the target visual weight and mobile safety hooks", () => {
  assert.match(styles, /\.guidebook-target-map\{[^}]*grid-template-rows:185px 285px 120px;[^}]*height:590px/);
  assert.match(styles, /\.guidebook-target-node-bottom-left,\.guidebook-target-node-bottom-right\{transform:translateY\(-72px\)/);
  assert.match(styles, /\.practice-shell \.practice-v1-composition\{[^}]*grid-template-columns:minmax\(320px,40%\) minmax\(0,1fr\);[^}]*gap:48px;[^}]*max-width:1120px/);
  assert.match(styles, /@media\(min-width:1500px\)[\s\S]*\.practice-shell \.practice-v1-layout\{transform:translateX\(28px\)/);
  assert.match(styles, /@media\(min-width:1500px\)[\s\S]*\.practice-shell \.practice-v1-composition\{[^}]*grid-template-columns:minmax\(420px,44%\)/);
  assert.match(styles, /\.membership-package-grid\{[^}]*gap:16px/);
  assert.ok(/\.membership-shell \.main\{padding-top:calc\(16px \+ var\(--nt-header-height\)\)/.test(styles), "Membership content offsets below the fixed header");
  assert.match(styles, /\.membership-page\{[^}]*gap:14px/);
  assert.match(styles, /\.membership-balance-row\{[^}]*height:0/);
  assert.match(styles, /\.membership-package-grid\{[^}]*max-width:920px/);
  assert.match(styles, /@media\(min-width:1181px\)[\s\S]*\.membership-package-grid\{max-width:920px;margin:0 auto;gap:16px\}/);
  assert.match(styles, /\.membership-journey\{[^}]*gap:10px/);
  assert.match(styles, /\.membership-footer\{[^}]*min-height:64px/);
  assert.match(styles, /\.affiliate-kpi-grid\{[^}]*gap:14px/);
  assert.match(styles, /\.account-dashboard\{[^}]*max-width:1320px/);
  assert.match(styles, /\.site-shell\.account-shell[^}]*\.main/);
  assert.match(styles, /\.site-shell\.affiliate-shell[^}]*\.main/);
  assert.match(styles, /\.site-shell\.account-shell \.account-dashboard-hero\{[^}]*min-height:112px/);
  assert.match(styles, /\.site-shell\.affiliate-shell \.affiliate-dashboard__hero\{[^}]*min-height:143px/);
  assert.match(styles, /\.site-shell\.affiliate-shell[^}]*\.main\{[^}]*padding:16px 32px 88px 88px/);
  assert.match(styles, /\.site-shell\.account-shell \.account-security-list\{[^}]*grid-template-columns:repeat\(2,minmax\(0,1fr\)/);
  assert.match(styles, /\.room-reading-panel-shell \.reading-spread\{[^}]*max-width:1320px/);
  assert.match(styles, /@media\(max-width:768px\)[\s\S]*\.room-page\.has-interpretation \.room-reading-panel-shell\{top:64px/);
  for (const breakpoint of ["max-width:768px", "max-width:700px", "max-width:420px", "max-width:400px"]) {
    assert.match(styles, new RegExp(`@media\\(${breakpoint}\\)`), breakpoint);
  }
  assert.match(styles, /@media\(max-width:900px\) and \(min-width:701px\)[\s\S]*\.practice-shell \.topbar-nav\{display:none\}/);
  assert.match(styles, /@media\(max-width:900px\) and \(min-width:701px\)[\s\S]*\.guidebook-target-map\{grid-template-columns:repeat\(2,minmax\(0,1fr\)/);
  assert.match(styles, /@media\(prefers-reduced-motion:reduce\)[\s\S]*guidebook-target/);
  assert.match(styles, /@media\(prefers-reduced-motion:reduce\)[\s\S]*practice-v1/);
  assert.match(styles, /overflow-x:(?:clip|hidden)/);
});

test("final fidelity renders values in localized Affiliate terms", () => {
  assert.equal(messageFor("vi", "affiliate.policyText", { version: 1 }), "Tỷ lệ hoa hồng và điều kiện hiện tại · phiên bản 1");
  assert.equal(messageFor("vi", "affiliate.tierFrom", { value: 10 }), "Từ 10 đơn hàng đủ điều kiện");
  assert.equal(messageFor("en", "affiliate.holdWindow", { value: 30 }), "Review period: 30 days");
});
