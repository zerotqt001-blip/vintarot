import { z } from "zod";
import { captureAttribution } from "@/lib/affiliate/service";
import { boundary, db, json, originCheck } from "@/lib/server";
import { requireMemberCreditOwner } from "@/lib/billing-http";
import { noStoreResponse } from "@/lib/request-identity";

const schema = z.object({
  code: z.string().trim().min(1).max(128),
  source: z.string().trim().max(120).optional(),
}).strict();

export async function POST(request: Request) {
  return boundary(async () => {
    originCheck(request);
    const database = db();
    const owner = await requireMemberCreditOwner(request, database);
    const parsed = schema.safeParse(await json(request));
    if (!parsed.success) return noStoreResponse(Response.json({ error: "Invalid referral code." }, { status: 400 }));
    const result = await captureAttribution({ database, owner, rawCode: parsed.data.code, source: parsed.data.source });
    return noStoreResponse(Response.json({ accepted: result.accepted, reason: result.accepted ? undefined : result.reason }));
  });
}
