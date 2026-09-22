import { boundary, db } from "@/lib/server";
import { createCreditStore } from "@/lib/credits/repository";
import { handleSePayIpn, readSePayConfigOrResponse } from "@/lib/commercial/http-handlers";
import { runtimeEnv } from "@/lib/runtime";

export async function POST(request: Request) {
  return boundary(async () => {
    const database = db();
    const config = readSePayConfigOrResponse(runtimeEnv as unknown as Record<string, unknown>);
    if (config instanceof Response) return config;
    return handleSePayIpn(request, { database, creditStore: createCreditStore(database), config, owner: null });
  });
}
