import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const repoRoot = join(import.meta.dirname, "..");
const source = (relativePath: string) => readFileSync(join(repoRoot, relativePath), "utf8");

test("Packages uses the approved membership composition and keeps server truth", () => {
  const commerce = source("app/commerce/commerce-pages.tsx");
  const styles = source("app/globals.css");

  for (const marker of [
    "membership-page",
    "membership-balance",
    "membership-package-card",
    "membership-journey",
    "membership-vip",
    "membership-affiliate",
    "membership-trust",
    "member.journeyTitle",
    "member.vipComingSoon",
    "member.trustFulfillment",
  ]) assert.match(commerce, new RegExp(marker.replaceAll(".", "\\.")), marker);

  assert.match(commerce, /benefitSnapshot\.credits\.expiresInSeconds/);
  assert.match(commerce, /creditUnits/);
  assert.match(commerce, /benefitSnapshot\.catalog\?\.popular/);
  assert.match(commerce, /sortPackagesForPresentation/);
  assert.match(commerce, /\/api\/account\/summary/);
  assert.match(commerce, /\/checkout\?package=/);
  assert.doesNotMatch(commerce, /commerce-comparison/);
  assert.doesNotMatch(commerce, /member\.packagesTitle/);
  assert.doesNotMatch(commerce, /member\.vipDuration/);
  assert.match(styles, /membership-shell/);
});

test("Packages gets the Image 1 navigation without changing other route destinations", () => {
  const shell = [
    "components/shell/natarot-shell.tsx",
    "components/shell/natarot-header.tsx",
    "components/shell/natarot-sidebar.tsx",
    "components/shell/natarot-footer.tsx",
  ].map(source).join("\n");
  for (const destination of ["/", "/guidebook", "/community", "/book", "/room", "/packages", "/affiliate", "/account"]) {
    assert.match(shell, new RegExp(destination.replaceAll("/", "\\/")), destination);
  }
  assert.match(shell, /variant === "membership"/);
  assert.match(shell, /nav\.drawNow/);
  assert.match(shell, /nav\.membership/);
  assert.match(shell, /nav\.affiliate/);
  assert.match(shell, /nav\.account/);
});
