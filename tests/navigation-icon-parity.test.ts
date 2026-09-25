import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import postcss, { type Rule } from "postcss";
import test from "node:test";

const globalStyles = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
const bookingStyles = readFileSync(new URL("../app/booking.module.css", import.meta.url), "utf8");
const stylesheet = postcss.parse(globalStyles);

const navScopes = [
  ".site-shell .nt-global-sidebar :is(.main-nav,.home-primary-nav)",
  ".membership-shell .nt-global-sidebar :is(.main-nav,.home-primary-nav)",
  ".home-shell .nt-global-sidebar :is(.main-nav,.home-primary-nav)",
  ".booking-shell .nt-global-sidebar :is(.main-nav,.home-primary-nav)",
];

function findRule(selector: string, media?: string): Rule {
  let found: Rule | undefined;

  stylesheet.walkRules((rule) => {
    if (!rule.selectors.includes(selector)) return;
    const parent = rule.parent;
    if (media && (parent?.type !== "atrule" || parent.params !== media)) return;
    if (!media && parent?.type === "atrule") return;
    found = rule;
  });

  assert.ok(found, `Expected navigation icon rule for ${selector}`);
  return found;
}

function declaration(rule: Rule, property: string): string | undefined {
  const node = rule.nodes?.find(
    (child) => child.type === "decl" && child.prop === property
  );
  return node?.type === "decl" ? node.value : undefined;
}

test("every route uses the Guidebook primary-navigation icon treatment", () => {
  const desktop = findRule(`${navScopes[0]} .nav-orb`);
  const active = findRule(`${navScopes[0]} a.active .nav-orb`);
  const glyph = findRule(`${navScopes[0]} .nav-orb svg`);

  for (const scope of navScopes) {
    assert.ok(desktop.selectors.includes(`${scope} .nav-orb`));
    assert.ok(active.selectors.includes(`${scope} a.active .nav-orb`));
    assert.ok(glyph.selectors.includes(`${scope} .nav-orb svg`));
  }

  assert.equal(declaration(desktop, "width"), "44px");
  assert.equal(declaration(desktop, "height"), "44px");
  assert.equal(declaration(desktop, "flex"), "0 0 44px");
  assert.equal(declaration(desktop, "border"), "1px solid rgba(215,179,106,.36)");
  assert.equal(declaration(desktop, "background"), "rgba(5,20,34,.6)");
  assert.equal(declaration(desktop, "color"), "var(--nt-gold-primary)");
  assert.equal(declaration(desktop, "box-shadow"), "none");
  assert.equal(declaration(active, "border-color"), "rgba(231,199,125,.72)");
  assert.equal(declaration(active, "background"), "rgba(215,179,106,.11)");
  assert.equal(declaration(active, "box-shadow"), "none");
  assert.equal(declaration(glyph, "width"), "26px");
  assert.equal(declaration(glyph, "height"), "26px");

  const mobile = findRule(`${navScopes[0]} .nav-orb`, "(max-width:700px)");
  assert.equal(declaration(mobile, "width"), "31px");
  assert.equal(declaration(mobile, "height"), "31px");
  assert.equal(declaration(mobile, "flex-basis"), "31px");

  const membershipMobile = findRule(`${navScopes[1]} .nav-orb`, "(max-width:820px)");
  assert.equal(declaration(membershipMobile, "width"), "31px");
  assert.equal(declaration(membershipMobile, "height"), "31px");
  assert.equal(declaration(membershipMobile, "flex-basis"), "31px");

  let lastNavOrbRuleOffset = -1;
  stylesheet.walkRules((rule) => {
    if (rule.selectors.some((selector) => selector.includes(".nav-orb"))) {
      lastNavOrbRuleOffset = Math.max(lastNavOrbRuleOffset, rule.source?.start?.offset ?? -1);
    }
  });
  assert.equal(
    membershipMobile.source?.start?.offset,
    lastNavOrbRuleOffset,
    "The Guidebook icon tokens must be the final navigation-icon rules in the cascade"
  );
  assert.doesNotMatch(bookingStyles, /nav-orb/, "Booking must inherit the shared navigation-icon treatment");
});
