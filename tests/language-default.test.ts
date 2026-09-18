import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("../components/language.tsx", import.meta.url), "utf8");

test("Vietnamese is the first-load language while an explicit locale can hydrate", () => {
  assert.match(source, /useState<Locale>\("vi"\)/);
  assert.match(source, /const localeHydrating = useRef\(true\)/);
  assert.match(source, /if \(stored\) \{\s*setLocaleState\(normalizeLocale\(stored\)\);\s*return;\s*\}/);
  assert.match(source, /if \(localeHydrating\.current\) \{[\s\S]*?localeHydrating\.current = false;[\s\S]*?return;\s*\}/);
});
