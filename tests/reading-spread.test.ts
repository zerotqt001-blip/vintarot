import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const componentPath = path.join(process.cwd(), "components/reading/reading-spread.tsx");
const panelPath = path.join(process.cwd(), "components/reading/reading-panel.tsx");

test("ReadingSpread uses the shared geometry contract and real evidence artwork", () => {
  const source = fs.readFileSync(componentPath, "utf8");
  assert.match(source, /resolveSpreadGeometry/);
  assert.match(source, /projectSpreadGeometry/);
  assert.match(source, /artwork\[item\.readingCardId\]/);
  assert.match(source, /data-layout-mode/);
  assert.match(source, /card\.order/);
});

test("ReadingPanel mounts the dynamic spread before prose interpretation", () => {
  const source = fs.readFileSync(panelPath, "utf8");
  const spreadIndex = source.indexOf("<ReadingSpread");
  const answerIndex = source.indexOf("<DirectAnswer");
  assert.ok(spreadIndex >= 0);
  assert.ok(answerIndex > spreadIndex);
});
