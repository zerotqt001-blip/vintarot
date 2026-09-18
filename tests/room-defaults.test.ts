import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const roomSource = readFileSync(new URL("../app/room/room.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

test("Room starts with the tabletop at 70 percent zoom", () => {
  assert.match(roomSource, /\[guide,setGuide\]=useState\(false\),\[zoom,setZoom\]=useState\(\.7\)/);
});

test("mobile Room removes the ready-phase welcome guide from the layout", () => {
  assert.match(roomSource, /useIsMobile/);
  assert.match(roomSource, /const isMobile=useIsMobile\(\)/);
  assert.match(roomSource, /const showGuide=guide&&\(!isMobile\|\|s\.phase!=='ready'\)/);
  assert.match(roomSource, /\{showGuide&&<aside className=\{'room-guide phase-'\+s\.phase\}/);
  assert.doesNotMatch(css, /room-guide\.phase-ready/);
});
