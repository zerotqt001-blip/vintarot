import { postGoogleAuth } from "../../route-handlers";

export async function POST(request: Request) {
  return postGoogleAuth(request);
}
