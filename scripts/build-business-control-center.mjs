import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const root = fileURLToPath(new URL("../", import.meta.url));
const outfile = resolve(root, "dist/business-control-center.mjs");
mkdirSync(dirname(outfile), { recursive: true });

await build({
  entryPoints: [resolve(root, "scripts/business-control-center.ts")],
  outfile,
  bundle: true,
  platform: "node",
  target: "node22",
  format: "esm",
  external: ["cloudflare:workers"],
  legalComments: "none",
  sourcemap: false,
  minify: true,
});
