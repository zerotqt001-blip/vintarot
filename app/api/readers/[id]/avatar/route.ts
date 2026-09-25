import { boundary, db } from "@/lib/server";
import { getReaderAvatar, readerIdSchema } from "@/lib/admin/readers";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  return boundary(async () => {
    const { id } = await context.params;
    if (!readerIdSchema.safeParse(id).success) return new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });
    const avatar = await getReaderAvatar(db(), id, "public");
    if (!avatar) return new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });
    const bytes = new Uint8Array(avatar.bytes);
    return new Response(bytes.buffer as ArrayBuffer, {
      headers: {
        "Content-Type": avatar.contentType,
        "Content-Length": String(bytes.byteLength),
        "Cache-Control": "public, max-age=300, stale-while-revalidate=60",
        "X-Content-Type-Options": "nosniff",
      },
    });
  });
}
