import { getGoogleAuth } from "../../route-handlers";

export async function GET(request: Request) {
  return getGoogleAuth(request, "googleCallback");
}
