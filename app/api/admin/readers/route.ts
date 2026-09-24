import { z } from "zod";
import { requirePermission } from "@/lib/admin/context";
import { createAdminReader, listAdminReaders, ReaderAdminError, readerProfileSchema } from "@/lib/admin/readers";
import { boundary, db, originCheck } from "@/lib/server";
import { noStoreResponse } from "@/lib/request-identity";
import { readBoundedJson } from "@/lib/bounded-json";

const createSchema = readerProfileSchema.extend({
  reason: z.string().trim().min(1).max(500),
  idempotency_key: z.string().trim().min(1).max(80),
}).strict();

function serviceError(error: unknown): Response | null {
  if (!(error instanceof ReaderAdminError)) return null;
  return noStoreResponse(Response.json({ error: error.code === "not_found" ? "Reader profile not found." : "Invalid reader profile." }, { status: error.code === "not_found" ? 404 : 400 }));
}

export async function GET(request: Request) {
  return boundary(async () => {
    const database = db();
    await requirePermission(request, "admin.readers.manage", database);
    return noStoreResponse(Response.json({ items: await listAdminReaders(database) }));
  });
}

export async function POST(request: Request) {
  return boundary(async () => {
    originCheck(request);
    const database = db();
    const actor = await requirePermission(request, "admin.readers.manage", database);
    const parsed = createSchema.safeParse(await readBoundedJson(request));
    if (!parsed.success) return noStoreResponse(Response.json({ error: "Please check the reader profile fields and Google Drive link." }, { status: 400 }));
    const { reason, idempotency_key: idempotencyKey, ...profile } = parsed.data;
    try {
      return noStoreResponse(Response.json({ reader: await createAdminReader(database, actor.memberId, profile, reason, idempotencyKey) }, { status: 201 }));
    } catch (error) {
      const response = serviceError(error);
      if (response) return response;
      throw error;
    }
  });
}
