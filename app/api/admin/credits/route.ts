import { z } from "zod";
import { requirePermission } from "@/lib/admin/context";
import { AdminServiceError } from "@/lib/admin/member-service";
import { adjustAdminMemberCredits } from "@/lib/admin/actions";
import { CreditError } from "@/lib/credits/repository";
import { boundary, db, json, originCheck } from "@/lib/server";
import { noStoreResponse } from "@/lib/request-identity";

const schema = z.object({
  member_id: z.string().trim().min(1).max(160),
  units: z.number().int().min(-1_000_000).max(1_000_000).refine((value) => value !== 0),
  reason: z.string().trim().min(1).max(500),
  idempotency_key: z.string().trim().min(1).max(200),
}).strict();

export async function POST(request: Request) {
  return boundary(async () => {
    originCheck(request);
    const database = db();
    const actor = await requirePermission(request, "admin.credits.adjust", database);
    const parsed = schema.safeParse(await json(request));
    if (!parsed.success) return noStoreResponse(Response.json({ error: "Invalid Credits adjustment." }, { status: 400 }));
    try {
      const result = await adjustAdminMemberCredits(database, actor, { memberId: parsed.data.member_id, units: parsed.data.units, reason: parsed.data.reason, idempotencyKey: parsed.data.idempotency_key });
      return noStoreResponse(Response.json({ adjustment: result }));
    } catch (error) {
      if (error instanceof AdminServiceError) {
        const status = error.code === "not_found" ? 404 : error.code === "forbidden" ? 403 : 400;
        return noStoreResponse(Response.json({ error: status === 404 ? "User not found." : status === 403 ? "Forbidden." : "Invalid Credits adjustment." }, { status }));
      }
      if (error instanceof CreditError) {
        return noStoreResponse(Response.json({ error: error.code === "insufficient_credits" ? "Insufficient Credits." : "Credits adjustment conflicts with an existing request." }, { status: error.code === "insufficient_credits" ? 409 : 400 }));
      }
      throw error;
    }
  });
}
