import { db, boundary } from "@/lib/server";
import { noStoreResponse } from "@/lib/request-identity";
import { listPublishedReaders } from "@/lib/admin/readers";

export async function GET() {
  return boundary(async () => noStoreResponse(Response.json({ items: await listPublishedReaders(db()) })));
}
