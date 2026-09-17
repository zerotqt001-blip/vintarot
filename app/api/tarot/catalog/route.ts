import { z } from "zod";
import { boundary, db } from "@/lib/server";
import { getTarotRepository } from "@/lib/tarot-repository";

const localeSchema = z.enum(["en", "vi"]);

export async function GET(req: Request) {
  return boundary(async () => {
    const parsed = localeSchema.safeParse(new URL(req.url).searchParams.get("locale") || "en");
    if (!parsed.success) return Response.json({ error: "Unsupported locale" }, { status: 400 });
    const catalog = await getTarotRepository(db()).listCatalog(parsed.data);
    if (!catalog.categories.length) return Response.json({ error: "Tarot catalog is not seeded." }, { status: 503 });
    return Response.json(catalog);
  });
}
