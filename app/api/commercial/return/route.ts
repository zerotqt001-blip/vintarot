import { boundary, db } from "@/lib/server";
import { requireMemberCreditOwner } from "@/lib/billing-http";
import { createCreditStore } from "@/lib/credits/repository";
import { handleCommercialReturn, readSePayConfigOrResponse } from "@/lib/commercial/http-handlers";
import { runtimeEnv } from "@/lib/runtime";

export async function GET(request: Request) {
  return boundary(async () => {
    const database = db();
    const owner = await requireMemberCreditOwner(request, database);
    const config = readSePayConfigOrResponse(runtimeEnv as unknown as Record<string, unknown>);
    if (config instanceof Response) return config;
    return handleCommercialReturn(request, { database, creditStore: createCreditStore(database), config, owner });
  });
}
