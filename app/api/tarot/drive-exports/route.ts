import { attachIdentityCookie, boundary, db, identity, originCheck } from "@/lib/server";
import { GoogleDriveError, MAX_DRIVE_EXPORT_BYTES, googleDriveFormat, uploadGoogleDriveReadingImage, validGoogleDriveImage } from "@/lib/google-drive";
import { getGoogleDriveConfig } from "@/lib/google-drive-config";

function memberDatabaseId(userId: string): string {
  return userId.replace(/^member:/, "");
}

function json(requestIdentity: Awaited<ReturnType<typeof identity>>, body: unknown, status = 200): Response {
  return attachIdentityCookie(Response.json(body, { status, headers: { "Cache-Control": "no-store" } }), requestIdentity);
}

export async function POST(request: Request): Promise<Response> {
  return boundary(async () => {
    originCheck(request);
    const requestIdentity = await identity(request);
    if (requestIdentity.kind !== "user" || requestIdentity.owner.kind !== "user") {
      return json(requestIdentity, { error: "Sign in to save this image to Google Drive." }, 401);
    }
    const contentLength = Number(request.headers.get("content-length") || 0);
    if (Number.isFinite(contentLength) && contentLength > MAX_DRIVE_EXPORT_BYTES + 64_000) {
      return json(requestIdentity, { error: "The image file is too large." }, 413);
    }
    const config = getGoogleDriveConfig(request);
    if (!config) return json(requestIdentity, { error: "Google Drive connection is not configured." }, 503);

    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      return json(requestIdentity, { error: "The image upload could not be read." }, 400);
    }
    const readingId = form.get("reading_id");
    const sessionId = form.get("session_id");
    const formatValue = form.get("format");
    const file = form.get("file");
    const format = typeof formatValue === "string" ? googleDriveFormat(formatValue) : null;
    if (typeof readingId !== "string" || readingId.length < 1 || readingId.length > 100
      || typeof sessionId !== "string" || sessionId.length < 1 || sessionId.length > 100
      || !format || !(file instanceof File)) {
      return json(requestIdentity, { error: "A reading, session, format, and image file are required." }, 400);
    }
    if (file.size < 1 || file.size > MAX_DRIVE_EXPORT_BYTES) {
      return json(requestIdentity, { error: "The image file must be 8 MB or smaller." }, 413);
    }

    const owned = await db().prepare(`SELECT r.id FROM readings r
      JOIN reading_sessions s ON s.id=r.session_id
      WHERE r.id=? AND r.session_id=? AND s.user_id=? LIMIT 1`)
      .bind(readingId, sessionId, requestIdentity.userId)
      .first<{ id: string }>();
    if (!owned) return json(requestIdentity, { error: "Reading not found." }, 404);

    const bytes = new Uint8Array(await file.arrayBuffer());
    if (!validGoogleDriveImage(bytes, format.mimeType)) {
      return json(requestIdentity, { error: "Choose a valid PNG or JPG image." }, 400);
    }
    try {
      const saved = await uploadGoogleDriveReadingImage({
        database: db(),
        config,
        memberId: memberDatabaseId(requestIdentity.userId),
        readingId,
        format: format.format,
        mimeType: format.mimeType,
        bytes,
      });
      return json(requestIdentity, { drive_url: saved.url, file_id: saved.fileId, format: format.format, updated_at: saved.updatedAt }, 201);
    } catch (error) {
      if (error instanceof GoogleDriveError && error.code === "not_connected") {
        return json(requestIdentity, { error: "Connect Google Drive before saving images." }, 409);
      }
      if (error instanceof GoogleDriveError && error.code === "upload_failed") {
        return json(requestIdentity, { error: "Google Drive could not save or share the image. Check Drive sharing settings and try again." }, 502);
      }
      if (error instanceof GoogleDriveError) return json(requestIdentity, { error: "Google Drive is temporarily unavailable. Try again." }, 503);
      throw error;
    }
  });
}
