import { startGoogleDriveConnection } from "@/lib/google-drive-auth";

export async function GET(request: Request): Promise<Response> {
  return startGoogleDriveConnection(request);
}
