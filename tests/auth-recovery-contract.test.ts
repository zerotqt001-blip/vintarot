import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");

test("member auth exposes the public page and API entrypoints", () => {
  const requiredFiles = [
    "app/auth/page.tsx",
    "app/auth/complete/page.tsx",
    "app/login/page.tsx",
    "app/register/page.tsx",
    "app/forgot-password/page.tsx",
    "app/reset-password/page.tsx",
    "app/api/auth/login/route.ts",
    "app/api/auth/register/route.ts",
    "app/api/auth/password-reset/request/route.ts",
    "app/api/auth/password-reset/confirm/route.ts",
    "app/api/auth/google/start/route.ts",
    "app/api/auth/google/callback/route.ts",
    "app/api/auth/google/complete/route.ts",
  ];

  for (const relativePath of requiredFiles) {
    assert.equal(existsSync(resolve(root, relativePath)), true, `missing auth entrypoint: ${relativePath}`);
  }
});

test("logged-out profile entrypoints resolve through the member auth screen", () => {
  const shell = readFileSync(resolve(root, "components/shell/natarot-shell.tsx"), "utf8");
  const room = readFileSync(resolve(root, "app/room/room.tsx"), "utf8");

  assert.match(shell, /profileHref\s*=\s*user\s*\?\s*[\s\S]*?\/auth\?return_to=\/profile/);
  assert.match(room, /profileHref\s*=\s*user\s*\?\s*[\s\S]*?\/auth\?return_to=\/profile/);
});

test("protected page entrypoints preserve their requested return paths", () => {
  const pages = readFileSync(resolve(root, "app/pages.tsx"), "utf8");

  assert.match(pages, /section\s*===\s*["']bookings["']\s*\?\s*["']\/bookings["']/);
  assert.match(pages, /section\s*===\s*["']invites["']\s*\?\s*["']\/invites["']/);
});
