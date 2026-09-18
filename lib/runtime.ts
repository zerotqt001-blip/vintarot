import type { D1Database } from "@cloudflare/workers-types";
import type { TarotAIEnvironment } from "./ai/factory";
import { createSqliteD1Database, type SqliteConnection } from "./sqlite-d1";

export type RuntimeEnvironment = TarotAIEnvironment & {
  DB?: D1Database;
  NATAROT_DB_PATH?: string;
};

type RuntimeContext = {
  environment: RuntimeEnvironment;
  platform: "cloudflare" | "node";
};

function isCloudflareModuleUnavailable(error: unknown): boolean {
  if (typeof error !== "object" || error === null || !("code" in error)) return false;
  const code = (error as { code?: unknown }).code;
  return code === "ERR_UNSUPPORTED_ESM_URL_SCHEME" || code === "ERR_MODULE_NOT_FOUND";
}

async function loadRuntimeContext(): Promise<RuntimeContext> {
  try {
    const cloudflare = await import("cloudflare:workers");
    return {
      environment: cloudflare.env as unknown as RuntimeEnvironment,
      platform: "cloudflare",
    };
  } catch (error) {
    if (typeof process === "undefined" || !isCloudflareModuleUnavailable(error)) throw error;
    return { environment: process.env as RuntimeEnvironment, platform: "node" };
  }
}

async function loadRuntimeDatabase(context: RuntimeContext): Promise<D1Database> {
  if (context.platform === "cloudflare") {
    if (!context.environment.DB) throw new Error("Storage is not available. Please try again shortly.");
    return context.environment.DB;
  }

  const { DatabaseSync } = await import("node:sqlite");
  const sqlite = new DatabaseSync(context.environment.NATAROT_DB_PATH?.trim() || "/var/lib/natarot/natarot.sqlite");
  sqlite.exec("PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;");
  return createSqliteD1Database(sqlite as unknown as SqliteConnection);
}

const runtimeContext = await loadRuntimeContext();
export const runtimeEnv: RuntimeEnvironment = runtimeContext.environment;
export const runtimeDatabase: D1Database = await loadRuntimeDatabase(runtimeContext);

export function getRuntimeDatabase(): D1Database {
  return runtimeDatabase;
}
