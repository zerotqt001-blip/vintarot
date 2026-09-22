import { getAuth } from "../route-handlers";

export async function GET(request: Request) {
  return getAuth(request, "me");
}
