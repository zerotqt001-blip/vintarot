import { disconnectGoogleDrive, googleDriveConnection } from "@/lib/google-drive-auth";

export async function GET(request: Request): Promise<Response> {
  return googleDriveConnection(request);
}

export async function DELETE(request: Request): Promise<Response> {
  return disconnectGoogleDrive(request);
}
