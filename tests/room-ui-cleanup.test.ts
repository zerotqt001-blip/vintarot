import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("../app/room/room.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
const i18n = readFileSync(new URL("../lib/i18n.ts", import.meta.url), "utf8");

test("the deck is the only visible shuffle entry point", () => {
  assert.match(source, /<ShuffleDeck settling=\{settling\} active=\{s\.phase==='shuffling'\} onStart=\{handleShuffleTap\}\/>/);
  assert.doesNotMatch(source, /shuffle-control|room\.readyShuffle|room\.doneShuffle/);
  assert.doesNotMatch(css, /shuffle-control/);
  assert.doesNotMatch(i18n, /doneShuffle|readyShuffle/);
});

test("the room removes the bottom deck bar and its layout compensation", () => {
  assert.doesNotMatch(source, /room-bottom|room-deck-summary|room\.deckAlt/);
  assert.doesNotMatch(css, /room-bottom/);
  assert.doesNotMatch(i18n, /deckAlt/);
  assert.match(css, /\.room-page \.room-status\{[^}]*pointer-events:none/);
  assert.match(css, /\.room-page \.tabletop\{inset:calc\(64px \+ env\(safe-area-inset-top\)\) 0 0/);
});

test("drawn cards keep pointer selection and dragging without button activation", () => {
  assert.match(source, /<div key=\{c\.readingCardId\|\|c\.id\} className=\{'drawn-card '/);
  assert.match(source, /onPointerDown=\{e=>cardDown\(e,c\.id\)\}/);
  assert.match(source, /onPointerMove=\{cardMove\}/);
  assert.match(source, /onPointerUp=\{cardUp\}/);
  assert.doesNotMatch(source, /onKeyDown=\{e=>\{if\(e\.key==='Enter'\|\|e\.key===' '\).*setSelected\(c\.id\)/);
  assert.match(source, /if\(!c\.face\)update\(\{cards:stateRef\.current\.cards\.map\(v=>v\.id===c\.id\?\{\.\.\.v,face:true/);
});

test("BookOpen remains the explicit guidebook entry point", () => {
  assert.match(source, /\[BookOpen,t\('room\.guidebook'\),\(\)=>setGuide\(!guide\)\]/);
  const drawnCardStart = source.indexOf("const renderSpreadCard=");
  const drawnCardEnd = source.indexOf("const closeMobileSheet", drawnCardStart);
  assert.ok(drawnCardStart >= 0 && drawnCardEnd > drawnCardStart);
  assert.doesNotMatch(source.slice(drawnCardStart, drawnCardEnd), /setGuide/);
});
