import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("../app/room/room.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

test("Room provides a compact mobile header without removing existing navigation", () => {
  assert.match(source, /className="room-mobile-actions"/);
  assert.match(source, /className="room-mobile-menu-trigger"/);
  assert.match(source, /setModal\('mobile-menu'\)/);
  assert.match(source, /className="room-mobile-theme"/);
  assert.match(source, /className="top-actions room-desktop-actions"/);
});

test("Room exposes the real tabletop controls through mobile sheets", () => {
  assert.match(source, /modal==='mobile-menu'/);
  assert.match(source, /modal==='mobile-tools'/);
  assert.match(source, /className="room-mobile-tool-grid"/);
  assert.match(source, /t\('room\.mobileTools'/);
  assert.match(source, /t\('room\.mobileHome'/);
  assert.match(source, /t\('room\.mobileInvite'/);
  assert.match(source, /t\('room\.mobileGuide'/);
});

test("mobile Room hides the permanent desktop utilities and protects the first-screen composition", () => {
  assert.match(css, /@media\s*\(max-width:\s*768px\)[\s\S]*?\.room-page \.room-toolbar,[\s\S]*?\.room-page \.media-tools,[\s\S]*?display:none/);
  assert.match(css, /\.room-mobile-sheet/);
  assert.match(css, /\.room-page \.room-mobile-actions/);
  assert.match(css, /\.room-page\{[^}]*min-height:100dvh/);
  assert.match(css, /\.room-page \.shuffle-control\{[^}]*min-height:56px/);
});

test("mobile sheets reset the dialog centering translation", () => {
  assert.match(css, /\.room-mobile-sheet\{[^}]*translate:0 0!important/);
});
