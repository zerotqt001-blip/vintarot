import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const repoRoot = join(import.meta.dirname, "..");
const source = (relativePath: string) => readFileSync(join(repoRoot, relativePath), "utf8");

test("Packages uses the current functional composition and keeps server truth", () => {
  const commerce = source("app/commerce/commerce-pages.tsx");
  const styles = source("app/globals.css");

  for (const marker of [
    "functional-page",
    "commerce-member-status",
    "commerce-package-card",
    "commerce-comparison",
    "member.packagesTitle",
    "member.vipDuration",
  ]) assert.match(commerce, new RegExp(marker.replaceAll(".", "\\.")), marker);

  assert.match(commerce, /benefitSnapshot\.credits\?\.expiresInSeconds/);
  assert.match(commerce, /creditUnits/);
  assert.match(commerce, /benefitSnapshot\.catalog\?\.popular/);
  assert.match(commerce, /benefitKeys/);
  assert.match(commerce, /\/api\/account\/summary/);
  assert.match(commerce, /\/checkout\?package=/);
  assert.match(styles, /functional-section/);
  assert.match(styles, /commerce-package-card/);
});

test("Packages keeps the shared navigation without changing other route destinations", () => {
  const shell = source("app/vintarot.tsx");
  for (const destination of ["/", "/guidebook", "/community", "/book", "/room", "/packages", "/affiliate", "/account"]) {
    assert.match(shell, new RegExp(destination.replaceAll("/", "\\/")), destination);
  }
  assert.match(shell, /nav\.drawNow/);
  assert.match(shell, /nav\.membership/);
  assert.match(shell, /nav\.affiliate/);
  assert.match(shell, /nav\.account/);
  assert.match(shell, /commerce-access-nav/);
});
