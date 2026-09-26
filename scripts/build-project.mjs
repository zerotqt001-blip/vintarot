import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const frameworkBuild = spawnSync(process.execPath, [fileURLToPath(new URL("./run-framework.mjs", import.meta.url)), "build", ...process.argv.slice(2)], {
  cwd: root,
  stdio: "inherit",
});
if (frameworkBuild.error) throw frameworkBuild.error;
if (frameworkBuild.status !== 0) process.exit(frameworkBuild.status ?? 1);

const controlCenterBuild = spawnSync(process.execPath, [fileURLToPath(new URL("./build-business-control-center.mjs", import.meta.url))], {
  cwd: root,
  stdio: "inherit",
});
if (controlCenterBuild.error) throw controlCenterBuild.error;
process.exit(controlCenterBuild.status ?? 1);
