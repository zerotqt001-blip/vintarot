import { boundary, db } from "@/lib/server";
import { noStoreResponse } from "@/lib/request-identity";
import { listActivePackageVersions } from "@/lib/packages/catalog";

export async function GET() {
  return boundary(async () => {
    const packages = await listActivePackageVersions(db());
    return noStoreResponse(Response.json({ packages }));
  });
}
