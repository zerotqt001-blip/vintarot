import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("major shells retain their hooks and expose canonical brand levels", () => {
  const css = read("app/globals.css");

  for (const shell of ["home-shell", "room-page", "practice-shell", "create-shell", "daily-shell", "guidebook-shell"]) {
    assert.match(css, new RegExp(`\\.${shell}`));
  }

  for (const token of ["--color-bg-deep", "--color-surface", "--color-gold", "--color-ivory"]) {
    assert.match(css, new RegExp(`${token}\\s*:`));
  }
});

test("sign-in and reading surfaces use shared brand hooks", () => {
  assert.match(read("app/pages.tsx"), /signIn|signin-with-chatgpt/);
  assert.match(read("app/pages.tsx"), /brand-panel|Panel|Logo/);

  const reading = read("components/reading/reading-panel.tsx");
  assert.match(reading, /reading-panel/);
  assert.match(reading, /brand-panel|reading-surface/);
});
