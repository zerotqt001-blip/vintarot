import { attachIdentityCookie, boundary, identity } from "@/lib/server";

export async function GET(req: Request) {
  return boundary(async () => {
    const user = await identity(req);
    return attachIdentityCookie(Response.json({
      video: false,
      payments: false,
      email: false,
      publicAccess: false,
      message: "Video, payments and email are not connected yet. Your tarot rooms and journal are available.",
    }), user);
  });
}
