import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("../app/room/room.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

test("Room keeps the three spread labels without secondary hint copy", () => {
  for (const label of ["Persona", "Obstacle", "Solution"]) {
    assert.match(source, new RegExp(`${label}:'room\\.${label.toLowerCase()}'`));
  }
  assert.match(source, /<strong>\{spreadLabel\(label\)\}<\/strong><\/span>/);
  assert.doesNotMatch(source, /spreadHintKeys/);
  assert.doesNotMatch(source, /spreadHint\(/);
});

test("Room removes the reader avatar and uses a subdued NaTarot watermark", () => {
  assert.doesNotMatch(source, /className="room-avatar"/);
  assert.doesNotMatch(source, /room-question-user/);
  assert.doesNotMatch(source, /chooseCardToStart/);
  assert.match(source, /className="deck-instruction" aria-hidden="true">NaTarot\.com<\/div>/);
  assert.match(css, /\.room-page \.deck-instruction\{[^}]*text-transform:none/);
  assert.match(css, /\.room-page \.deck-instruction\{[^}]*opacity:/);
});

test("Room promotes the question into the former Tarot Reading header position", () => {
  assert.doesNotMatch(source, /readingOverview|room-question-kicker|room-question-rule/);
  assert.match(source, /className="room-question"><span className="room-question-copy">\{s\.question\}<\/span><\/div>/);
  assert.doesNotMatch(css, /room-question-kicker|room-question-rule/);
  assert.match(css, /\.room-page \.room-question\{[^}]*top:148px;[^}]*gap:0/);
  assert.match(css, /\.room-page \.room-question-copy\{[^}]*display:block/);
});
