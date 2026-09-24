import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { join } from "node:path";

const root = join(import.meta.dirname, "..");
const read = (relativePath: string) => readFileSync(join(root, relativePath), "utf8");
const header = read("components/shell/natarot-header.tsx");
const sidebar = read("components/shell/natarot-sidebar.tsx");
const footer = read("components/shell/natarot-footer.tsx");
const shell = read("components/shell/natarot-shell.tsx");
const readingPanel = read("components/reading/reading-panel.tsx");
const readingSpread = read("components/reading/reading-spread.tsx");
const styles = read("app/globals.css");

test("six target surfaces share one four-destination global header", () => {
  const navDefinition = header.match(/const topNav = \[([\s\S]*?)\] as const;/)?.[1];
  assert.ok(navDefinition, "one canonical top-level navigation is defined");
  assert.deepEqual(
    [...navDefinition.matchAll(/"([^\"]+)"\s*,\s*"([^\"]+)"/g)].map((match) => match[2]),
    ["/", "/guidebook", "/community", "/book"],
  );
  assert.ok(!/GuidebookHeader|guidebookTopNav|simpleTopNav/.test(header), "header variants are consolidated");
  assert.equal((header.match(/<header\b/g) ?? []).length, 1);
  assert.equal((shell.match(/<NaTarotHeader\b/g) ?? []).length, 1);
  assert.match(header, /aria-current=\{isActive\(path, href\) \? "page" : undefined\}/);
  const actions = header.match(/function HeaderActions\([\s\S]*?\n\}/)?.[0] ?? "";
  assert.ok(!/if\s*\(variant\s*===/.test(actions), "utility controls share one order");
  assert.match(actions, /<LanguageSelect\s*\/>/);
  assert.match(actions, /onTheme/);
  assert.match(actions, /accountHref/);
});

test("target routes use one readable canonical five-link sidebar", () => {
  const navItems = sidebar.match(/const navItems = \[([\s\S]*?)\] as const;/)?.[1];
  assert.ok(navItems, "the canonical commercial/member rail is defined");
  assert.deepEqual(
    [...navItems.matchAll(/"([^\"]+)"\s*,\s*\w+\s*,\s*"([^\"]+)"/g)].map((match) => match[2]),
    ["/", "/create", "/packages", "/affiliate", "/account"],
  );
  assert.ok(!/ArcLabel|GuidebookSidebar|function SiteNav/.test(sidebar), "all target pages use the same label treatment");
  assert.match(sidebar, /className="nav-label"/);
  assert.match(sidebar, /path === "\/guidebook" && href === "\/create"\) return "\/room\?ritual=1"/);
  assert.ok(/aria-current=\{isCurrentPath\(path, href\) \? "page" : undefined\}/.test(sidebar), "only the current route is announced as current");
  assert.equal((shell.match(/<NaTarotSidebar\b/g) ?? []).length, 1);
});

test("target product routes end with one quiet shared footer, not a marquee", () => {
  assert.ok(!/marquee|\.repeat\(8\)/.test(footer), "product footer has no moving repeated copy");
  assert.match(footer, /className="site-footer/);
  assert.match(footer, /footerPrivacy|footer\.privacy/);
  assert.match(footer, /footerTerms|footer\.terms/);
  assert.equal((shell.match(/<NaTarotFooter\b/g) ?? []).length, 1);
});

test("shared semantic surfaces and background intensity roles are explicit", () => {
  for (const token of ["--nt-surface-primary", "--nt-surface-secondary", "--nt-surface-tertiary"]) {
    assert.ok(styles.includes(token), `${token} is defined`);
  }
  for (const variant of ["library", "practice", "membership", "affiliate", "account", "reading"]) {
    assert.ok(new RegExp(`data-celestial-background=\"${variant}\"`).test(styles), `${variant} background role exists`);
  }
  assert.ok(styles.includes(".nt-global-header"), "one shared header rule is present");
  assert.ok(styles.includes(".nt-global-sidebar"), "one shared rail rule is present");
  assert.ok(styles.includes(".site-footer"), "one shared footer rule is present");
});

test("the shared desktop rail respects its viewport bounds and the footer stays fixed", () => {
  assert.ok(/--nt-sidebar-width:clamp\(158px,11\.7vw,194px\)/.test(styles), "large desktop rail width is viewport-scaled");
  assert.ok(/\.site-shell \.nt-global-sidebar[^}]*height:auto!important/.test(styles), "fixed rail uses its inset bounds");
  assert.ok(/\.membership-shell \.main\{padding-top:calc\(16px \+ var\(--nt-header-height\)\)/.test(styles), "Packages clears the fixed header");
  assert.ok(/\.membership-shell,\.site-shell\.affiliate-shell\{--nt-sidebar-width:170px/.test(styles), "compact data-page rails use target width");
  assert.ok(/\.site-shell\.affiliate-shell\{--nt-sidebar-bottom:220px\}/.test(styles), "Affiliate rail leaves target footer clearance");
  assert.ok(/\.site-shell\.account-shell \.nt-global-sidebar\{[^}]*width:170px!important/.test(styles), "Account rail uses target width");
  assert.ok(!/\.guidebook-shell footer\{position:relative/.test(styles), "legacy footer cannot override shared fixed footer");
  assert.ok(/\.site-footer\{position:fixed/.test(styles), "one fixed shared footer is used");
});

test("mobile navigation rules do not hide canonical icon and label spans", () => {
  assert.ok(styles.includes(".site-shell .nt-global-sidebar .main-nav a>.nav-orb,.membership-shell .nt-global-sidebar .main-nav a>.nav-orb,.home-shell .nt-global-sidebar .home-primary-nav a>.nav-orb{display:grid}"));
  assert.ok(styles.includes(".site-shell .nt-global-sidebar .main-nav a>.nav-label,.membership-shell .nt-global-sidebar .main-nav a>.nav-label,.home-shell .nt-global-sidebar .home-primary-nav a>.nav-label{display:block}"));
  assert.ok(styles.includes(".site-shell .nt-global-sidebar .main-nav,.membership-shell .nt-global-sidebar .main-nav,.home-shell .nt-global-sidebar .home-primary-nav{display:grid;height:100%;grid-template-columns:repeat(5,minmax(0,1fr))"));
});

test("current production Reading Result follows question, dynamic spread, answer and follow-up", () => {
  const order = [
    readingPanel.indexOf("<ReadingHeader"),
    readingPanel.indexOf("<ReadingSpread"),
    readingPanel.indexOf("<DirectAnswer"),
    readingPanel.indexOf("reading-section--deeper-reading"),
    readingPanel.indexOf("<PersonalInsights"),
    readingPanel.indexOf("<NextSteps"),
    readingPanel.indexOf("<FollowUpReading"),
  ];
  assert.ok(order.every((position) => position >= 0), "each editorial layer remains present");
  assert.deepEqual(order, [...order].sort((left, right) => left - right));
  assert.ok((readingPanel.match(/<ReadingHeader\b/g) ?? []).length >= 1);
  for (const region of ["reading-result-toolbar", "reading-result-overview", "reading-result-overview__rail", "reading-result-content", "reading-result-content__main", "reading-result-content__rail"]) {
    assert.ok(readingPanel.includes(region), `${region} is part of the result composition`);
  }
  assert.match(readingPanel, /reading-section--deeper-reading/);
  assert.match(readingPanel, /<FollowUpReading/);
  assert.match(readingPanel, /onClick=\{onClose\}/);
  assert.match(readingPanel, /aria-label=\{t\("reading\.close"\)\}/);
  assert.match(readingPanel, /t\("reading\.close"\)/);
  assert.match(readingPanel, /t\("reading\.share"\)/);
  assert.match(readingPanel, /t\("reading\.save"\)/);
  assert.match(readingSpread, /resolveSpreadGeometry\(spreadType/);
  assert.match(readingSpread, /projection\.cards\.map/);
  assert.doesNotMatch(readingSpread, /reading-spread-card-[1-9]/);
  assert.ok(styles.includes(".room-reading-panel-shell .reading-result-overview{display:grid;grid-template-columns:minmax(0,1.9fr) minmax(250px,.72fr)"));
  assert.ok(styles.includes(".room-reading-panel-shell .reading-result-content{display:grid;grid-template-columns:minmax(0,1.72fr) minmax(276px,.76fr)"));
  assert.ok(styles.includes(".room-reading-panel-shell .reading-result-content__rail .reading-section--follow-up"));
});

test("result presentation remains separate from protected real-data and reading contracts", () => {
  const commerce = read("app/commerce/commerce-pages.tsx");
  const affiliate = read("components/affiliate/affiliate-dashboard.tsx");
  const account = read("components/account/account-history.tsx");
  const room = read("app/room/room.tsx");
  assert.match(commerce, /\/api\/packages/);
  assert.match(affiliate, /\/api\/affiliate\/dashboard/);
  assert.match(affiliate, /\/api\/affiliate\/policy/);
  assert.match(account, /\/api\/account\/summary/);
  assert.match(account, /\/api\/account\/history/);
  for (const source of [affiliate, account]) {
    for (const literal of ["96", "1.245.000", "320.000", "4.860.000", "THANH123"]) {
      assert.doesNotMatch(source, new RegExp(literal.replaceAll(".", "\\.")), literal);
    }
  }
  assert.match(room, /<SpreadBoard geometry=\{spreadGeometry\}/);
  assert.match(room, /spreadBoardCards/);
  assert.doesNotMatch(room, /reading-spread-card-1|reading-spread-card-2|reading-spread-card-3|reading-spread-card-4/);
});
