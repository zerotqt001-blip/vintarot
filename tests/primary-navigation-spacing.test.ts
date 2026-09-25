import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import postcss, { type Rule } from "postcss";
import test from "node:test";

const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
const stylesheet = postcss.parse(css);

function mediaRules(params: string): Rule[] {
  const rules: Rule[] = [];

  stylesheet.walkAtRules("media", (media) => {
    if (media.params !== params) return;
    media.walkRules((rule) => {
      rules.push(rule);
    });
  });

  return rules;
}

function findRule(rules: Rule[], selectors: string[]): Rule {
  const rule = rules.find((candidate) =>
    selectors.every((selector) => candidate.selectors.includes(selector))
  );

  assert.ok(rule, `Expected a shared rule for ${selectors.join(", ")}`);
  return rule;
}

function declaration(rule: Rule, property: string): string | undefined {
  const node = rule.nodes?.find(
    (child) => child.type === "decl" && child.prop === property
  );

  return node?.type === "decl" ? node.value : undefined;
}

function lastDesktopLinkSizingRuleOffset(excludedShells: string[] = []): number {
  let lastOffset = 0;

  stylesheet.walkRules((rule) => {
    const isPrimaryLink = rule.selectors.some((selector) =>
      /\.nt-global-sidebar\s+\.(?:main-nav|home-primary-nav)\s*>?\s*a(?:\s|$)/.test(selector) &&
      !excludedShells.some((shell) => selector.includes(shell))
    );
    const changesSpacing = rule.nodes?.some(
      (node) =>
        node.type === "decl" &&
        ["height", "min-height", "margin", "gap"].includes(node.prop)
    );

    if (isPrimaryLink && changesSpacing) {
      lastOffset = Math.max(lastOffset, rule.source?.start?.offset ?? 0);
    }
  });

  return lastOffset;
}

test("desktop primary navigation uses a compact, top-aligned rhythm across shared rails", () => {
  const rules = mediaRules("(min-width:701px)");
  const containers = findRule(rules, [
    ".nt-global-sidebar .main-nav",
    ".nt-global-sidebar .home-primary-nav",
  ]);
  const links = findRule(rules, [
    ".nt-global-sidebar .main-nav > a",
    ".nt-global-sidebar .home-primary-nav > a",
  ]);

  assert.equal(declaration(containers, "justify-content"), "flex-start");
  assert.equal(declaration(containers, "align-content"), "flex-start");
  assert.equal(declaration(containers, "gap"), "8px");
  assert.equal(declaration(containers, "flex"), "0 0 auto");
  assert.equal(declaration(links, "height"), "auto");
  assert.equal(declaration(links, "min-height"), "104px");
  assert.equal(declaration(links, "margin"), "0");
  assert.equal(
    links.source?.start?.offset,
    lastDesktopLinkSizingRuleOffset([".affiliate-shell"]),
    "The shared compact link sizing must remain the final spacing rule in the cascade"
  );
});

test("Affiliate keeps the shared spacing without changing mobile bottom navigation", () => {
  const desktopRules = mediaRules("(min-width:701px)");
  const affiliateContainer = findRule(desktopRules, [
    ".site-shell.affiliate-shell .nt-global-sidebar .home-primary-nav",
  ]);
  const affiliateLinks = findRule(desktopRules, [
    ".site-shell.affiliate-shell .nt-global-sidebar .home-primary-nav > a",
  ]);

  assert.equal(declaration(affiliateContainer, "display"), "flex");
  assert.equal(declaration(affiliateContainer, "gap"), "8px");
  assert.equal(declaration(affiliateContainer, "align-content"), "flex-start");
  assert.equal(declaration(affiliateLinks, "min-height"), "104px");
  assert.equal(
    affiliateLinks.source?.start?.offset,
    lastDesktopLinkSizingRuleOffset(),
    "Affiliate's scoped desktop sizing should override its taller legacy rows"
  );

  const mobileRules = mediaRules("(max-width:700px)");
  assert.ok(
    mobileRules.some((rule) =>
      rule.selectors.includes(".site-shell.affiliate-shell .home-primary-nav") &&
      declaration(rule, "grid-template-columns") === "repeat(5,minmax(0,1fr))"
    ),
    "Affiliate should retain its five-item mobile bottom bar"
  );
});
