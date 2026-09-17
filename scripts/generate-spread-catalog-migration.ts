import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { buildTarotSeed } from "../db/tarot-seed";
import { buildSpreadCatalogMigrationSql } from "./generate-tarot-seed";

async function main(): Promise<void> {
  const outIndex = process.argv.indexOf("--out");
  const target = outIndex === -1 ? "drizzle/0003_moonlight_spread_catalog.sql" : process.argv[outIndex + 1];
  if (!target) throw new Error("--out requires a file path");
  await writeFile(resolve(target), buildSpreadCatalogMigrationSql(buildTarotSeed()), "utf8");
}

const entrypoint = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : "";
if (import.meta.url === entrypoint) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
