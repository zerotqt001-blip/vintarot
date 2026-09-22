import { postAuth } from "../route-handlers";

export async function POST(request: Request) {
  return postAuth(request, "login");
}
