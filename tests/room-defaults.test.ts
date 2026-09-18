import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const roomSource = readFileSync(new URL("../app/room/room.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

test("Room starts with the tabletop at 70 percent zoom", () => {
  assert.match(roomSource, /\[guide,setGuide\]=useState\(false\),\[zoom,setZoom\]=useState\(\.7\)/);
});

test("mobile Room keeps the ready-phase welcome guide hidden", () => {
  assert.match(css, /@media\(max-width:768px\)[\s\S]*?\.room-page \.room-guide\.phase-ready\{display:none!important\}/);
});
