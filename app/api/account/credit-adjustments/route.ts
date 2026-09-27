import { z } from "zod";
import {
  getNextAccountCreditAdjustmentNotice,
  markAccountCreditAdjustmentNoticeRead,
} from "@/lib/account-credit-adjustments";
import { requireMemberCreditOwner } from "@/lib/billing-http";
import { boundary, db, json, originCheck } from "@/lib/server";
import { noStoreResponse } from "@/lib/request-identity";

const readSchema = z.object({
  adjustment_key: z.string().trim().min(1).max(240),
}).strict();

export async function GET(request: Request) {
  return boundary(async () => {
    const database = db();
    const owner = await requireMemberCreditOwner(request, database);
    const notification = await getNextAccountCreditAdjustmentNotice(database, owner);
    return noStoreResponse(Response.json({ notification }));
  });
}

export async function POST(request: Request) {
  return boundary(async () => {
    originCheck(request);
    const database = db();
    const owner = await requireMemberCreditOwner(request, database);
    const parsed = readSchema.safeParse(await json(request));
    if (!parsed.success) {
      return noStoreResponse(Response.json({ error: "Invalid credit notification." }, { status: 400 }));
    }
    await markAccountCreditAdjustmentNoticeRead(database, owner, parsed.data.adjustment_key);
    return noStoreResponse(Response.json({ ok: true }));
  });
}
