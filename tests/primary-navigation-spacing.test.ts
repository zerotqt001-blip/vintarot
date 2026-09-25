import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import postcss, { type Rule } from "postcss";
import test from "node:test";

const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
const stylesheet = postcss.parse(css);

function mediaRules(params: string | RegExp): Rule[] {
  const rules: Rule[] = [];

  stylesheet.walkAtRules("media", (media) => {
    if (typeof params === "string" ? media.params !== params : !params.test(media.params)) return;
    media.walkRules((rule) => {
      rules.push(rule);
    });
  });

  return rules;
}

function findRuleWithSelectors(rules: Rule[], expected: string[]): Rule {
  const rule = rules.find((candidate) =>
    expected.every((selector) => candidate.selectors.includes(selector))
  );

  assert.ok(rule, `Expected one shared rule for: ${expected.join(", ")}`);
  return rule;
}

function declaration(rule: Rule, property: string): string | undefined {
  const node = rule.nodes?.find(
    (node) => node.type === "decl" && node.prop === property
  );

  return node?.type === "decl" ? node.value : undefined;
}

function lastNavigationSizingRuleOffset(excludedShells: string[] = []): number {
  let lastOffset = 0;
  const navigationNames = [
    ".home-primary-nav",
    ".main-nav",
    ".guidebook-target-sidebar-nav",
  ];

  stylesheet.walkRules((rule) => {
    const isNavLink = rule.selectors.some((selector) =>
      navigationNames.some((name) => selector.includes(name)) &&
      !excludedShells.some((shell) => selector.includes(shell)) &&
      /(?:\s|>)a(?:[.#:[\s>]|$)/.test(selector)
    );
    const changesSpacing = rule.nodes?.some(
      (node) =>
        node.type === "decl" &&
        ["height", "min-height", "margin", "gap"].includes(node.prop)
    );

    if (isNavLink && changesSpacing) {
      lastOffset = Math.max(lastOffset, rule.source?.start?.offset ?? 0);
    }
  });

  return lastOffset;
}

test("desktop vertical primary rails share a compact, top-aligned rhythm", () => {
  const expectedContainers = [
    ".home-shell .home-primary-nav",
    ".site-shell:not(.affiliate-shell):not(.membership-shell) .home-primary-nav",
    ".site-shell:not(.affiliate-shell):not(.membership-shell) .main-nav",
    ".guidebook-target-sidebar-nav",
  ];
  const expectedLinks = [
    ".home-shell .home-primary-nav > a",
    ".site-shell:not(.affiliate-shell):not(.membership-shell) .home-primary-nav > a",
    ".site-shell:not(.affiliate-shell):not(.membership-shell) .main-nav > a",
    ".guidebook-target-sidebar-nav > a",
  ];
  const rules = mediaRules("(min-width: 701px)");
  const containers = findRuleWithSelectors(rules, expectedContainers);
  const links = findRuleWithSelectors(rules, expectedLinks);

  assert.equal(declaration(containers, "align-content"), "start");
  assert.equal(declaration(containers, "gap"), "8px");
  assert.equal(declaration(links, "min-height"), "104px");
  assert.equal(declaration(links, "height"), "auto");
  assert.equal(declaration(links, "margin"), "0");

  assert.equal(
    links.source?.start?.offset,
    lastNavigationSizingRuleOffset([".affiliate-shell", ".membership-shell"]),
    "The shared desktop sizing rule must be the final sizing rule so it wins the cascade"
  );
});

test("Affiliate and Membership keep their mobile bottom bars and share desktop spacing", () => {
  const expectedContainers = [
    ".affiliate-shell .main-nav",
    ".membership-shell .main-nav",
  ];
  const expectedLinks = [
    ".affiliate-shell .main-nav > a",
    ".membership-shell .main-nav > a",
  ];
  const rules = mediaRules("(min-width: 821px)");
  const containers = findRuleWithSelectors(rules, expectedContainers);
  const links = findRuleWithSelectors(rules, expectedLinks);

  assert.equal(declaration(containers, "align-content"), "start");
  assert.equal(declaration(containers, "gap"), "8px");
  assert.equal(declaration(links, "min-height"), "104px");
  assert.ok(
    mediaRules(/max-width:\s*820px/).some((rule) =>
      rule.selectors.includes(".affiliate-shell .main-nav")
    ),
    "Affiliate's mobile bottom navigation breakpoint should remain intact"
  );
  assert.ok(
    mediaRules(/max-width:\s*820px/).some((rule) =>
      rule.selectors.includes(".membership-shell .main-nav")
    ),
    "Membership's mobile bottom navigation breakpoint should remain intact"
  );
});
