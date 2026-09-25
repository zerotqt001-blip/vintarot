import { z } from "zod";
import { requirePermission } from "@/lib/admin/context";
import { getReaderAvatar, ReaderAdminError, readerIdSchema, removeReaderAvatar, saveReaderAvatar } from "@/lib/admin/readers";
import { readBoundedJson } from "@/lib/bounded-json";
import { boundary, db, originCheck } from "@/lib/server";
import { noStoreResponse } from "@/lib/request-identity";

const MAX_AVATAR_BYTES = 1_900_000;
const MAX_MULTIPART_BYTES = MAX_AVATAR_BYTES + 32 * 1024;
const removeSchema = z.object({ reason: z.string().trim().min(1).max(500), idempotency_key: z.string().trim().min(1).max(80) }).strict();
const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

function serviceError(error: unknown): Response | null {
  if (!(error instanceof ReaderAdminError)) return null;
  return noStoreResponse(Response.json({ error: error.code === "not_found" ? "Reader profile not found." : "Invalid avatar." }, { status: error.code === "not_found" ? 404 : 400 }));
}

function matchesSignature(bytes: Uint8Array, type: string): boolean {
  if (type === "image/jpeg") return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (type === "image/png") return bytes.length >= 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((byte, index) => bytes[index] === byte);
  return type === "image/webp" && bytes.length >= 12
    && String.fromCharCode(...bytes.slice(0, 4)) === "RIFF"
    && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
}

async function boundedFormData(request: Request): Promise<FormData> {
  const reader = request.body?.getReader();
  if (!reader) throw new Response("A photo file is required.", { status: 400 });
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_MULTIPART_BYTES) {
      await reader.cancel();
      throw new Response("Choose an image up to 1.9 MB.", { status: 413 });
    }
    chunks.push(value);
  }
  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.byteLength; }
  const headers = new Headers(request.headers);
  headers.delete("content-length");
  return new Request(request.url, { method: "PUT", headers, body: body.buffer as ArrayBuffer }).formData();
}

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  return boundary(async () => {
    const database = db();
    await requirePermission(request, "admin.readers.manage", database);
    const { id } = await context.params;
    if (!readerIdSchema.safeParse(id).success) return noStoreResponse(new Response("Not found", { status: 404 }));
    const avatar = await getReaderAvatar(database, id, "admin");
    if (!avatar) return noStoreResponse(new Response("Not found", { status: 404 }));
    const bytes = new Uint8Array(avatar.bytes);
    return noStoreResponse(new Response(bytes.buffer as ArrayBuffer, { headers: { "Content-Type": avatar.contentType, "X-Content-Type-Options": "nosniff" } }));
  });
}

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  return boundary(async () => {
    originCheck(request);
    const declaredSize = Number(request.headers.get("content-length"));
    if (Number.isFinite(declaredSize) && declaredSize > MAX_MULTIPART_BYTES) return noStoreResponse(Response.json({ error: "Choose an image up to 1.9 MB." }, { status: 413 }));
    const database = db();
    const actor = await requirePermission(request, "admin.readers.manage", database);
    const { id } = await context.params;
    if (!readerIdSchema.safeParse(id).success) return noStoreResponse(Response.json({ error: "Reader profile not found." }, { status: 404 }));
    if (!request.headers.get("content-type")?.toLowerCase().startsWith("multipart/form-data")) return noStoreResponse(Response.json({ error: "Choose an image file to upload." }, { status: 400 }));
    let form: FormData;
    try {
      form = await boundedFormData(request);
    } catch (error) {
      if (error instanceof Response) return noStoreResponse(error);
      return noStoreResponse(Response.json({ error: "Invalid image upload." }, { status: 400 }));
    }
    const file = form.get("file");
    const reason = z.string().trim().min(1).max(500).safeParse(form.get("reason"));
    const idempotencyKey = z.string().trim().min(1).max(80).safeParse(form.get("idempotency_key"));
    if (!(file instanceof File) || !allowedTypes.has(file.type) || file.size < 1 || file.size > MAX_AVATAR_BYTES || !reason.success || !idempotencyKey.success) {
      return noStoreResponse(Response.json({ error: "Upload a JPEG, PNG, or WebP image up to 1.9 MB and provide a save reason." }, { status: file instanceof File && file.size > MAX_AVATAR_BYTES ? 413 : 400 }));
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (!matchesSignature(bytes, file.type)) return noStoreResponse(Response.json({ error: "The uploaded file does not match its image type." }, { status: 400 }));
    try {
      await saveReaderAvatar(database, actor.memberId, id, bytes, file.type, reason.data, idempotencyKey.data);
      return noStoreResponse(Response.json({ ok: true }));
    } catch (error) {
      const response = serviceError(error);
      if (response) return response;
      throw error;
    }
  });
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  return boundary(async () => {
    originCheck(request);
    const database = db();
    const actor = await requirePermission(request, "admin.readers.manage", database);
    const { id } = await context.params;
    if (!readerIdSchema.safeParse(id).success) return noStoreResponse(Response.json({ error: "Reader profile not found." }, { status: 404 }));
    const parsed = removeSchema.safeParse(await readBoundedJson(request));
    if (!parsed.success) return noStoreResponse(Response.json({ error: "Add a reason before removing the photo." }, { status: 400 }));
    try {
      await removeReaderAvatar(database, actor.memberId, id, parsed.data.reason, parsed.data.idempotency_key);
      return noStoreResponse(Response.json({ ok: true }));
    } catch (error) {
      const response = serviceError(error);
      if (response) return response;
      throw error;
    }
  });
}
