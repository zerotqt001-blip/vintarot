import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";

const root = new URL("../", import.meta.url);

function source(path: string): string {
  return readFileSync(new URL(path, root), "utf8");
}

test("public privacy policy route discloses Google, member and reading data", () => {
  const path = new URL("../app/privacy/page.tsx", import.meta.url);
  assert.equal(existsSync(path), true, "the public privacy policy route must exist");
  const contentPath = new URL("../lib/legal-content.ts", import.meta.url);
  assert.equal(existsSync(contentPath), true, "the legal content module must exist");
  const page = `${readFileSync(path, "utf8")}\n${readFileSync(contentPath, "utf8")}`;
  assert.match(page, /Google/i);
  assert.match(page, /email/i);
  assert.match(page, /username/i);
  assert.match(page, /phone/i);
  assert.match(page, /reading|journal|trải bài|nhật ký/i);
  assert.match(page, /Resend/i);
});

test("public terms route exists and the homepage links both legal documents", () => {
  assert.equal(existsSync(new URL("../app/terms/page.tsx", import.meta.url)), true, "the public terms route must exist");
  const homepage = source("components/shell/natarot-footer.tsx");
  assert.match(homepage, /href="\/privacy"/);
  assert.match(homepage, /href="\/terms"/);
});
