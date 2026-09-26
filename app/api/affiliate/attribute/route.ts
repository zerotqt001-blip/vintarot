import { z } from "zod";
import { captureAttribution, claimGuestReferralAttribution } from "@/lib/affiliate/service";
import { clearAffiliateGuestCookie, createAffiliateGuestCookie, newAffiliateGuestId, readAffiliateGuestId, requestUsesHttps } from "@/lib/affiliate/anonymous-attribution";
import { boundary, db, json, originCheck } from "@/lib/server";
import { runtimeEnv } from "@/lib/runtime";
import { readOptionalOwner } from "@/lib/tarot-guest";
import { noStoreResponse } from "@/lib/request-identity";

const schema = z.object({
  code: z.string().trim().min(1).max(128),
  source: z.string().trim().max(120).optional(),
}).strict();

export async function POST(request: Request) {
  return boundary(async () => {
    originCheck(request);
    const database = db();
    const parsed = schema.safeParse(await json(request));
    if (!parsed.success) return noStoreResponse(Response.json({ error: "Invalid referral code." }, { status: 400 }));
    const identity = await readOptionalOwner(request, database);
    const guestId = readAffiliateGuestId(request);
    const trustForwardedFor = /^(1|true|yes)$/i.test(runtimeEnv.NATAROT_TRUSTED_PROXY ?? "");
    const secureCookie = requestUsesHttps(request, trustForwardedFor);
    const response = (accepted: boolean, reason?: string) => noStoreResponse(Response.json({ accepted, reason }));
    if (identity.member && identity.owner.kind === "user") {
      if (guestId) await claimGuestReferralAttribution({ database, memberId: identity.member.id, guestId });
      const result = await captureAttribution({ database, owner: { kind: "member", ownerId: identity.owner.userId }, rawCode: parsed.data.code, source: parsed.data.source });
      const resultResponse = response(result.accepted, result.accepted ? undefined : result.reason);
      if (guestId) resultResponse.headers.append("Set-Cookie", clearAffiliateGuestCookie(secureCookie));
      return resultResponse;
    }

    const anonymousId = guestId ?? newAffiliateGuestId();
    const result = await captureAttribution({ database, owner: { kind: "guest", ownerId: `affiliate:${anonymousId}` }, rawCode: parsed.data.code, source: parsed.data.source });
    const resultResponse = response(result.accepted, result.accepted ? undefined : result.reason);
    if (result.accepted && result.expiresAt !== undefined && result.expiresAt > Date.now()) {
      resultResponse.headers.set("Set-Cookie", createAffiliateGuestCookie(anonymousId, result.expiresAt, Date.now(), secureCookie));
    }
    return resultResponse;
  });
}
