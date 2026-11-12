import { db } from "ponder:api";
import schema from "ponder:schema";
import { Hono } from "hono";
import { secureHeaders } from "hono/secure-headers";
import { and, asc, client, count, countDistinct, desc, eq, graphql, isNull, lt, replaceBigInts } from "ponder";

const CHAINS = new Set([8453, 84532]);
/**
 * Public, read-only API over public on-chain data. Ponder's server already answers CORS with "*",
 * which is intended: nothing here is private. Rate limiting is done by the reverse proxy.
 */
const app = new Hono();

app.use("*", secureHeaders());

app.use("/sql/*", client({ db, schema }));
app.use("/graphql", graphql({ db, schema }));

const json = (v: unknown) => replaceBigInts(v, (b) => b.toString());

function chainParam(raw: string | undefined): number | null {
  const id = Number(raw ?? 8453);
  return CHAINS.has(id) ? id : null;
}

/** Summary numbers for one chain. */
app.get("/stats", async (c) => {
  const chainId = chainParam(c.req.query("chain"));
  if (chainId === null) return c.json({ error: "Unsupported chain." }, 400);

  const [entries, signers, skills, badges] = await Promise.all([
    db.select({ total: count() }).from(schema.guestbookEntry).where(eq(schema.guestbookEntry.chainId, chainId)),
    db.select({ n: countDistinct(schema.guestbookEntry.author) }).from(schema.guestbookEntry).where(eq(schema.guestbookEntry.chainId, chainId)),
    db.select().from(schema.skill).where(eq(schema.skill.chainId, chainId)).orderBy(asc(schema.skill.skillId)),
    db.select({ n: count() }).from(schema.badge).where(and(eq(schema.badge.chainId, chainId), isNull(schema.badge.burnedAt))),
  ]);
  const hiddenRows = await db
    .select({ n: count() })
    .from(schema.guestbookEntry)
    .where(and(eq(schema.guestbookEntry.chainId, chainId), eq(schema.guestbookEntry.hidden, true)));

  c.header("Cache-Control", "public, max-age=15");
  return c.json(
    json({
      chainId,
      guestbook: { entries: entries[0]?.total ?? 0, hidden: hiddenRows[0]?.n ?? 0, signers: signers[0]?.n ?? 0 },
      endorsements: {
        total: skills.reduce((s, k) => s + k.count, 0),
        skills: skills.map((k) => ({ id: k.skillId, name: k.name, count: k.count })),
      },
      badges: { active: badges[0]?.n ?? 0 },
    }),
  );
});

/** Latest guestbook entries, newest first. Hidden entries are excluded. ?before=<id> pages back. */
app.get("/guestbook", async (c) => {
  const chainId = chainParam(c.req.query("chain"));
  if (chainId === null) return c.json({ error: "Unsupported chain." }, 400);
  const limit = Math.min(Math.max(Number(c.req.query("limit") ?? 20) || 20, 1), 100);
  const beforeRaw = c.req.query("before");
  const before = beforeRaw && /^\d{1,20}$/.test(beforeRaw) ? BigInt(beforeRaw) : null;

  const where = [eq(schema.guestbookEntry.chainId, chainId), eq(schema.guestbookEntry.hidden, false)];
  if (before !== null) where.push(lt(schema.guestbookEntry.id, before));
  const rows = await db.select().from(schema.guestbookEntry).where(and(...where)).orderBy(desc(schema.guestbookEntry.id)).limit(limit);

  c.header("Cache-Control", "public, max-age=10");
  return c.json(json({ chainId, entries: rows }));
});

/** Recent activity across all contracts on one chain. */
app.get("/activity", async (c) => {
  const chainId = chainParam(c.req.query("chain"));
  if (chainId === null) return c.json({ error: "Unsupported chain." }, 400);
  const limit = Math.min(Math.max(Number(c.req.query("limit") ?? 20) || 20, 1), 100);

  const rows = await db
    .select()
    .from(schema.activity)
    .where(eq(schema.activity.chainId, chainId))
    .orderBy(desc(schema.activity.timestamp), desc(schema.activity.id))
    .limit(limit);

  // Messages of hidden guestbook entries are not repeated in the feed.
  const hidden = await db
    .select({ id: schema.guestbookEntry.id })
    .from(schema.guestbookEntry)
    .where(and(eq(schema.guestbookEntry.chainId, chainId), eq(schema.guestbookEntry.hidden, true)));
  const hiddenIds = new Set(hidden.map((h) => h.id.toString()));
  const safe = rows.map((r) => (r.kind === "signed" && hiddenIds.has(r.ref) ? { ...r, detail: "" } : r));

  c.header("Cache-Control", "public, max-age=10");
  return c.json(json({ chainId, activity: safe }));
});

export default app;
