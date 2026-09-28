import type { D1Database } from "@cloudflare/workers-types";
import { readOptionalOwner } from "../tarot-guest";
import { claimDailyReward, claimMarketingReward, getDailyRewardState, getMarketingRewardState, getMarketingRewardStates } from "./campaigns";

function unauthorized(): Response {
  return Response.json({ error: "Member authentication is required." }, {
    status: 401,
    headers: { "Cache-Control": "no-store" },
  });
}

export function createDailyRewardHandlers(database: D1Database, now: () => number = Date.now) {
  async function authenticatedMember(request: Request) {
    const { member } = await readOptionalOwner(request, database);
    return member ?? null;
  }

  return {
    async GET(request: Request): Promise<Response> {
      const member = await authenticatedMember(request);
      if (!member) return unauthorized();
      const state = await getDailyRewardState(database, member.id, now());
      return Response.json({ state }, { headers: { "Cache-Control": "no-store" } });
    },
    async POST(request: Request): Promise<Response> {
      const member = await authenticatedMember(request);
      if (!member) return unauthorized();
      const result = await claimDailyReward(database, member.id, now());
      return Response.json({ result }, { headers: { "Cache-Control": "no-store" } });
    },
  };
}

export function createMarketingRewardHandlers(database: D1Database, now: () => number = Date.now) {
  async function authenticatedMember(request: Request) {
    const { member } = await readOptionalOwner(request, database);
    return member ?? null;
  }

  return {
    async GET(request: Request): Promise<Response> {
      const member = await authenticatedMember(request);
      if (!member) return unauthorized();
      const rewards = await getMarketingRewardStates(database, member.id, now());
      return Response.json({ rewards }, { headers: { "Cache-Control": "no-store" } });
    },
    async campaignGET(request: Request, campaignId: string): Promise<Response> {
      const member = await authenticatedMember(request);
      if (!member) return unauthorized();
      const state = await getMarketingRewardState(database, member.id, campaignId, now());
      return Response.json({ state }, { headers: { "Cache-Control": "no-store" } });
    },
    async claimPOST(request: Request, campaignId: string): Promise<Response> {
      const member = await authenticatedMember(request);
      if (!member) return unauthorized();
      const result = await claimMarketingReward(database, member.id, campaignId, now());
      return Response.json({ result }, { headers: { "Cache-Control": "no-store" } });
    },
  };
}
