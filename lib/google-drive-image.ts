export type GoogleDriveImage = {
  fileId: string;
  resourceKey: string | null;
  imageUrl: string;
};

const GOOGLE_DRIVE_HOST = "drive.google.com";
const DRIVE_ID_PATTERN = /^[a-zA-Z0-9_-]{10,200}$/;

export function normalizeGoogleDriveImageUrl(value: string): GoogleDriveImage | null {
  let sharedUrl: URL;
  try {
    sharedUrl = new URL(value.trim());
  } catch {
    return null;
  }
  if (sharedUrl.protocol !== "https:" || sharedUrl.hostname.toLowerCase() !== GOOGLE_DRIVE_HOST) return null;

  const filePath = sharedUrl.pathname.match(/^\/file\/d\/([^/]+)(?:\/|$)/);
  const fileId = sharedUrl.searchParams.get("id") || filePath?.[1] || "";
  if (!DRIVE_ID_PATTERN.test(fileId)) return null;

  const resourceKey = sharedUrl.searchParams.get("resourcekey")?.trim() || null;
  const imageUrl = new URL("https://drive.google.com/uc");
  imageUrl.searchParams.set("export", "view");
  imageUrl.searchParams.set("id", fileId);
  if (resourceKey) imageUrl.searchParams.set("resourcekey", resourceKey);
  return { fileId, resourceKey, imageUrl: imageUrl.toString() };
}
