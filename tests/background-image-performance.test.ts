import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import postcss from "postcss";

const root = resolve(import.meta.dirname, "..");
const css = postcss.parse(
  readFileSync(resolve(root, "app/globals.css"), "utf8"),
);
const backgroundImageSets = new Map<string, Set<string>>();

css.walkDecls((declaration) => {
  if (!declaration.value.includes("image-set(")) return;
  const urls = new Set(
    [...declaration.value.matchAll(/url\(['"]?([^'")]+)['"]?\)/g)].map(([, url]) => url),
  );
  for (const url of urls) {
    if (url.endsWith(".webp")) backgroundImageSets.set(url, urls);
  }
});

test("large branded backgrounds prefer WebP while retaining their PNG fallback", () => {
  for (const path of [
    "/room/celestial-observatory",
    "/room/vintarot-cosmic-table",
    "/cards/vintarot-card-back",
  ]) {
    const webpUrl = `${path}.webp`;
    const pngUrl = `${path}.png`;
    const imageSet = backgroundImageSets.get(webpUrl);

    assert.ok(imageSet?.has(pngUrl), `${webpUrl} should be paired with ${pngUrl} in image-set()`);

    const webpBytes = statSync(resolve(root, `public${webpUrl}`)).size;
    const pngBytes = statSync(resolve(root, `public${pngUrl}`)).size;
    assert.ok(webpBytes <= pngBytes * 0.2, `${webpUrl} should stay at or below 20% of the PNG size`);
  }
});
