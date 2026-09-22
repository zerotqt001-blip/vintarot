import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const source = readFileSync(join(import.meta.dirname, "..", "app", "vintarot.tsx"), "utf8");

test("account route selects a dedicated five-destination member shell", () => {
  assert.match(source, /const isAccount = path === ["']\/account["']/);
  assert.match(source, /account-shell/);
  for (const href of ["/", "/room", "/packages", "/affiliate", "/account"]) {
    assert.ok(source.includes(`href: "${href}"`) || source.includes(`href="${href}"`), `missing account destination ${href}`);
  }
  assert.match(source, /isAccount/);
  assert.match(source, /accountTheme/);
  assert.match(source, /journal\?tab=saved/);
});

test("account shell does not remove the existing shell classifications", () => {
  for (const branch of ["isHome", "isGuidebook", "isCreate", "isPractice", "isRoom", "isDaily"]) {
    assert.match(source, new RegExp(`const ${branch} =`));
  }
  assert.match(source, /practice-shell/);
  assert.match(source, /daily-shell/);
  assert.match(source, /room-shell/);
});

test("account shell keeps member actions on existing auth/profile routes", () => {
  assert.match(source, /profileHref/);
  assert.match(source, /auth\?return_to=\/account/);
  assert.match(source, /LanguageSelect/);
});
