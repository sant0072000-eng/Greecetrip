import { and, asc, eq } from "drizzle-orm";
import { getDb } from "../../db/index.js";
import { expenses } from "../../db/schema.js";

function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

function validId(value: unknown): value is string {
  return typeof value === "string" && /^[a-zA-Z0-9:_-]{1,100}$/.test(value);
}

export default async (request: Request) => {
  const room = request.headers.get("X-Trip-Room");
  if (!room || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(room)) {
    return json({ error: "Open a valid shared trip link." }, 400);
  }
  if (!["GET", "POST", "DELETE"].includes(request.method)) {
    return new Response("Method not allowed", { status: 405, headers: { Allow: "GET, POST, DELETE" } });
  }
  if (request.method !== "GET") {
    const origin = request.headers.get("Origin");
    if (origin && origin !== new URL(request.url).origin) return json({ error: "Invalid origin." }, 403);
    if (!request.headers.get("Content-Type")?.startsWith("application/json")) {
      return json({ error: "JSON required." }, 415);
    }
  }
  try {
    const db = getDb();
    if (request.method === "GET") {
      const rows = await db.select().from(expenses).where(eq(expenses.room, room)).orderBy(asc(expenses.createdAt), asc(expenses.id));
      return json(rows.map((row) => ({ id: row.id, d: row.day, c: row.category, n: row.details, p: row.payer, a: row.cents / 100, t: row.createdAt })));
    }
    const raw = await request.text();
    if (raw.length > 2048) return json({ error: "Expense is too large." }, 413);
    let body;
    try { body = JSON.parse(raw); } catch { return json({ error: "Invalid JSON." }, 400); }
    if (!body || !validId(body.id)) return json({ error: "Invalid expense ID." }, 400);
    if (request.method === "DELETE") {
      await db.delete(expenses).where(and(eq(expenses.room, room), eq(expenses.id, body.id)));
      return json({ ok: true });
    }
    const categories = ["Breakfast", "Lunch", "Dinner", "Drinks / beer", "Petrol", "Hotel", "Transport", "Tickets", "Other"];
    if (!Number.isInteger(body.d) || body.d < 0 || body.d > 13 || !categories.includes(body.c)
      || !["Santhosh", "John"].includes(body.p) || typeof body.n !== "string" || body.n.length > 300
      || typeof body.a !== "number" || !Number.isFinite(body.a) || body.a <= 0 || body.a > 10000000
      || Math.round(body.a * 100) < 1 || Math.abs(body.a * 100 - Math.round(body.a * 100)) > 0.000001) {
      return json({ error: "Choose a day, category and payer, and a positive amount with at most two decimal places. Details must be under 300 characters." }, 400);
    }
    await db.insert(expenses).values({ room, id: body.id, day: body.d, category: body.c, details: body.n, payer: body.p, cents: Math.round(body.a * 100), createdAt: Number.isSafeInteger(body.t) && body.t > 0 ? body.t : Date.now() }).onConflictDoNothing();
    return json({ ok: true }, 201);
  } catch {
    return json({ error: "Shared storage is unavailable. Please try again; this expense has not been confirmed saved." }, 503);
  }
};
