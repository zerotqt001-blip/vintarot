import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";
import { getRuntimeDatabase } from "@/lib/runtime";

export function getDb() {
  return drizzle(getRuntimeDatabase(), { schema });
}
