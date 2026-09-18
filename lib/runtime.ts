import type { D1Database } from "@cloudflare/workers-types";
import type { TarotAIEnvironment } from "./ai/factory";
import { createSqliteD1Database, type SqliteConnection } from "./sqlite-d1";

export type RuntimeEnvironment = TarotAIEnvironment & {
  NODE_ENV?: string;
  DB?: D1Database;
  NATAROT_DB_PATH?: string;
  RESEND_API_KEY?: string;
  NATAROT_EMAIL_FROM?: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  GOOGLE_REDIRECT_URI?: string;
  NATAROT_TRUSTED_PROXY?: string;
};

function isNodeRuntime(): boolean {
  return typeof process !== "undefined" && Boolean(process.versions?.node);
}

async function loadRuntimeEnvironment(): Promise<RuntimeEnvironment> {
  if (isNodeRuntime()) return process.env as RuntimeEnvironment;
  const cloudflare = await import("cloudflare:workers");
  return cloudflare.env as unknown as RuntimeEnvironment;
}

async function loadRuntimeDatabase(environment: RuntimeEnvironment): Promise<D1Database> {
  if (!isNodeRuntime()) {
    if (!environment.DB) throw new Error("Storage is not available. Please try again shortly.");
    return environment.DB;
  }

  const { DatabaseSync } = await import("node:sqlite");
  const sqlite = new DatabaseSync(environment.NATAROT_DB_PATH?.trim() || "/var/lib/natarot/natarot.sqlite");
  sqlite.exec("PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;");
  return createSqliteD1Database(sqlite as unknown as SqliteConnection);
}

export const runtimeEnv: RuntimeEnvironment = await loadRuntimeEnvironment();
export const runtimeDatabase: D1Database = await loadRuntimeDatabase(runtimeEnv);

export function getRuntimeDatabase(): D1Database {
  return runtimeDatabase;
}
