import { strict as assert } from "node:assert";
import { test } from "node:test";
import { localeLabel, normalizeLocale, messages } from "../lib/i18n";

test("normalizes supported language values and falls back to English", () => {
  assert.equal(normalizeLocale("vi"), "vi");
  assert.equal(normalizeLocale("Tiếng Việt"), "vi");
  assert.equal(normalizeLocale("en-US"), "en");
  assert.equal(normalizeLocale("unknown"), "en");
});

test("provides translated labels for the language control", () => {
  assert.equal(localeLabel("en"), "English");
  assert.equal(localeLabel("vi"), "Tiếng Việt");
  assert.equal(messages.vi.nav.home, "Trang chủ");
  assert.equal(messages.en.nav.home, "Home");
});
