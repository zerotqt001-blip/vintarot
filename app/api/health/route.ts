import { noStoreResponse } from "@/lib/request-identity";
import { db } from "@/lib/server";

export async function GET() {
  try {
    await db().prepare("SELECT 1 AS ok").first();
    return noStoreResponse(Response.json({ status: "ok" }));
  } catch {
    return noStoreResponse(Response.json({ status: "error" }, { status: 503 }));
  }
}
