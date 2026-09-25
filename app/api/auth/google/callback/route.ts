import { getGoogleAuth } from "../../route-handlers";
import { handleGoogleDriveCallback } from "@/lib/google-drive-auth";

export async function GET(request: Request) {
  const driveResponse = await handleGoogleDriveCallback(request).catch(() => null);
  return driveResponse ?? getGoogleAuth(request, "googleCallback");
}
