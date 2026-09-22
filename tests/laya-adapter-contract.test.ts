import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import test from "node:test";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const adapter = resolve(root, "tools/system1/laya-adapter/laya_adapter.py");

test("Laya adapter remains isolated from the production Node graph", () => {
  assert.equal(existsSync(adapter), true);
  const packageJson = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));
  const dependencies = { ...(packageJson.dependencies || {}), ...(packageJson.devDependencies || {}) };
  assert.equal(Object.hasOwn(dependencies, "laya"), false);
  for (const directory of ["app", "lib", "components"]) {
    try {
      execFileSync("rg", ["-n", "\\blaya\\b", directory], { cwd: root, stdio: "pipe" });
      assert.fail(`production directory ${directory} imports Laya`);
    } catch (error) {
      if (error && typeof error === "object" && "status" in error && error.status !== 1) throw error;
    }
  }
});

test("adapter contract exposes only sanitized shadow decisions", () => {
  const source = readFileSync(adapter, "utf8");
  assert.match(source, /class ShadowAdapter/);
  assert.match(source, /def classifyTask/);
  assert.match(source, /def shadowRecord/);
  assert.doesNotMatch(source, /DEEPSEEK_API_KEY|NATAROT_DB_PATH/);
});
