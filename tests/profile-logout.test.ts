import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const pages = readFileSync(new URL("../app/pages.tsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

test("member profile exposes a working logout action", () => {
  assert.match(pages, /fetch\(["']\/api\/auth\/logout["']/);
  assert.match(pages, /method:\s*["']POST["']/);
  assert.match(pages, /credentials:\s*["']same-origin["']/);
  assert.match(pages, /t\(["']pages\.logOut["']\)/);
  assert.match(pages, /profile-logout/);
  assert.match(pages, /window\.location\.assign\(["']\/["']\)/);
  assert.match(styles, /\.profile-logout/);
});
