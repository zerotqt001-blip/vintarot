import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const componentSource = readFileSync(new URL("../components/reading/saved-reading-journal.tsx", import.meta.url), "utf8");
const pagesSource = readFileSync(new URL("../app/pages.tsx", import.meta.url), "utf8");

test("Journal renders authenticated saved readings through the existing ReadingPanel", () => {
  assert.match(pagesSource, /SavedReadingJournal/);
  assert.match(componentSource, /ReadingPanel/);
  assert.match(componentSource, /api\(["']tarot\/saved-readings/);
  assert.match(componentSource, /ReadingPanel[\s\S]*onClose/);
  assert.doesNotMatch(componentSource, /tarot\/reading/);
  assert.doesNotMatch(componentSource, /onSave=/);
  assert.doesNotMatch(componentSource, /onFollowUpSubmit=/);
});

test("saved history preserves original card evidence identity and uses stored detail GET", () => {
  assert.match(componentSource, /readingCardId/);
  assert.match(componentSource, /reading=\{detail\.reading\}/);
  assert.match(componentSource, /encodeURIComponent/);
  assert.match(componentSource, /reading=\{detail\.reading\}/);
});
