import { attachIdentityCookie, boundary, db, identity, json, originCheck } from "@/lib/server";
import { z } from "zod";

const dynamicCardSchema = z.object({
  id: z.number().int().min(0).max(77),
  cardId: z.string().max(100).optional(),
  readingCardId: z.string().max(100).optional(),
  positionKey: z.string().max(100).optional(),
  positionOrder: z.number().int().min(0).max(9).optional(),
  orientation: z.enum(["upright", "reversed"]).optional(),
  reversed: z.boolean(),
  face: z.boolean(),
  x: z.number().min(-2000).max(2000),
  y: z.number().min(-2000).max(2000),
});
const drawPlanSchema = z.object({
  readingCardId: z.string().max(100),
  cardId: z.string().max(100),
  cardNumber: z.number().int().min(0).max(77),
  positionKey: z.string().max(100),
  positionOrder: z.number().int().min(0).max(9),
  positionLabel: z.string().max(160),
  orientation: z.enum(["upright", "reversed"]),
  drawn: z.boolean(),
});
const stateSchema = z.object({
  phase: z.enum(["ready", "shuffling", "drawing"]),
  deck: z.string().max(100),
  spread: z.array(z.string().max(160)).min(1).max(10),
  categoryId: z.string().max(100).nullable().optional(),
  spreadTemplateId: z.string().max(100).nullable().optional(),
  optionalContext: z.string().max(5000).optional(),
  sessionId: z.string().max(100).nullable().optional(),
  drawPlan: z.array(drawPlanSchema).max(10).optional(),
  theme: z.enum(["light", "night", "forest", "rose"]),
  reversals: z.boolean(),
  question: z.string().max(500),
  cards: z.array(dynamicCardSchema).max(78),
  notes: z.string().max(10000),
  drawing: z.string().max(60000).refine((value) => {
    if (!value) return true;
    try {
      const paths = JSON.parse(value);
      return Array.isArray(paths) && paths.length <= 500 && paths.every((path) => typeof path === "string" && /^[ML0-9., \-]+$/.test(path));
    } catch {
      return false;
    }
  }),
  texts: z.array(z.object({
    id: z.string().max(100),
    x: z.number().min(0).max(100),
    y: z.number().min(0).max(100),
    text: z.string().max(500),
  })).max(100).default([]),
});

export async function GET(req: Request) {
  return boundary(async () => {
    const user = await identity(req);
    const respond = (body: unknown, init?: ResponseInit) => attachIdentityCookie(Response.json(body, init), user);
    const id = new URL(req.url).searchParams.get("id");
    if (!id) {
      const result = await db().prepare("SELECT id,state,updated FROM rooms WHERE owner=? ORDER BY updated DESC LIMIT 30").bind(user.userId).all();
      return respond({ items: result.results.map((row: any) => ({ id: row.id, state: JSON.parse(row.state), updated: row.updated })) });
    }
    const room: any = await db().prepare("SELECT * FROM rooms WHERE id=? AND (owner=? OR id IN (SELECT room FROM room_members WHERE user=?))")
      .bind(id, user.userId, user.userId)
      .first();
    if (!room) return respond({ error: "Room not found or you need an invitation." }, { status: 404 });
    const members = await db().prepare("SELECT name FROM room_members WHERE room=?").bind(id).all();
    return respond({
      id: room.id,
      state: JSON.parse(room.state),
      revision: room.revision,
      owner: room.owner === user.userId,
      invite: room.owner === user.userId ? room.invite : undefined,
      members: members.results,
    });
  });
}

export async function POST(req: Request) {
  return boundary(async () => {
    originCheck(req);
    const user = await identity(req);
    const respond = (body: unknown, init?: ResponseInit) => attachIdentityCookie(Response.json(body, init), user);
    const body = await json(req);

    if (body.action === "join") {
      if (typeof body.invite !== "string") return respond({ error: "Invalid invitation" }, { status: 400 });
      const room: any = await db().prepare("SELECT id FROM rooms WHERE invite=?").bind(body.invite).first();
      if (!room) return respond({ error: "Invitation not found" }, { status: 404 });
      await db().prepare("INSERT OR IGNORE INTO room_members(id,room,user,name) VALUES(?,?,?,?)")
        .bind(crypto.randomUUID(), room.id, user.userId, user.fullName || user.email.split("@")[0])
        .run();
      return respond({ id: room.id });
    }

    const result = stateSchema.safeParse(body.state);
    if (!result.success) return respond({ error: "Invalid room state" }, { status: 400 });
    const now = Date.now();
    if (!body.id) {
      const id = crypto.randomUUID();
      const invite = crypto.randomUUID();
      await db().prepare("INSERT INTO rooms(id,owner,state,revision,invite,created,updated) VALUES(?,?,?,0,?,?,?)")
        .bind(id, user.userId, JSON.stringify(result.data), invite, now, now)
        .run();
      return respond({ id, invite, revision: 0, owner: true, state: result.data });
    }
    if (typeof body.id !== "string" || !Number.isInteger(body.revision)) return respond({ error: "Invalid update" }, { status: 400 });
    const update = await db().prepare("UPDATE rooms SET state=?,revision=revision+1,updated=? WHERE id=? AND revision=? AND (owner=? OR id IN (SELECT room FROM room_members WHERE user=?))")
      .bind(JSON.stringify(result.data), now, body.id, body.revision, user.userId, user.userId)
      .run();
    if (update.meta.changes !== 1) return respond({ error: "The room changed. Reloading the latest state." }, { status: 409 });
    return respond({ id: body.id, revision: body.revision + 1 });
  });
}
