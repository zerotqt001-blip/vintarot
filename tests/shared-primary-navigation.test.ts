import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const shell = readFileSync(new URL("../app/vintarot.tsx", import.meta.url), "utf8");
const room = readFileSync(new URL("../app/room/room.tsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

test("every route uses the same five-item labeled primary navigation", () => {
  assert.match(shell, /const sharedPrimaryNav = \[/);
  for (const key of ["nav.home", "nav.drawNow", "nav.membership", "nav.affiliate", "nav.account"]) {
    assert.match(shell, new RegExp(`\\[\\"${key}\\"`), key);
  }
  assert.match(shell, /function SharedPrimaryNav/);
  assert.match(shell, /className="shared-nav-label(?: home-nav-label)?">\{t\(key\)\}<\/span>/);
  assert.match(shell, /<SharedPrimaryNav path=\{path\} accountHref=\{accountHref\} t=\{t\} \/>/);
  assert.match(room, /import \{SharedPrimaryNav\} from ['"]\.\.\/vintarot['"];/);
  assert.match(room, /<SharedPrimaryNav path="\/room" accountHref=\{user\?/);
  assert.doesNotMatch(shell, /isGuidebook \? <GuidebookTargetSidebar/);
});

test("the shared navigation keeps the reference rail on desktop and five labeled touch targets on mobile", () => {
  assert.match(styles, /\.shared-navigation-sidebar\.shared-navigation-sidebar/);
  assert.match(styles, /\.shared-primary-nav/);
  assert.match(styles, /\.shared-nav-label/);
  assert.match(styles, /grid-template-columns:repeat\(5,minmax\(0,1fr\)\)/);
  assert.match(styles, /\.shared-primary-nav \.shared-nav-label\{display:block/);
  assert.match(styles, /padding-bottom:calc\(112px \+ env\(safe-area-inset-bottom\)\)!important/);
});
