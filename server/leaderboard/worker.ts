// The online leaderboard: a Cloudflare Worker with a KV store. Free tier.
//
// The game is a static site with no server, and a leaderboard shared between
// players needs one: something has to hold the scores. This is the smallest
// thing that does. Deploy it with your Cloudflare account and point the game
// at it (README, "Online leaderboards"); until then the game keeps every
// board in the browser and this file is unused.
//
//   POST /submit   { board, name, value, secret }   record a result
//   GET  /top?board=course:basic&n=20              the best results
//
// Boards: "course:basic", "course:advanced" (lower is better), "duel:wins",
// "triple:wins", "bots:hard:wins" (higher is better). One entry per name per
// board, the best one kept. `secret` is a shared string the game is built
// with (VITE_LEADERBOARD_SECRET) so a stray POST cannot fill the board; it
// is not security, only a lock on the door, since the game itself is public.
//
// Build: npx wrangler deploy (with wrangler.toml beside this file).

export interface Env {
  BOARDS: KVNamespace;
  SECRET: string;
}

interface KVNamespace {
  get(key: string): Promise<string | null>;
  put(key: string, value: string): Promise<void>;
}

interface Entry {
  name: string;
  value: number;
  at: string;
}

const LOWER_IS_BETTER = /^course:/;
const NAME = /^[A-Za-z0-9_ .-]{1,16}$/;
/** the only boards the game posts to; anything else would be a new KV key per request */
const BOARDS = new Set(["course:basic", "course:advanced", "duel:wins", "triple:wins", "br:wins", "bots:easy:wins", "bots:normal:wins", "bots:hard:wins"]);
const MAX_ENTRIES = 100;

const CORS = { "access-control-allow-origin": "*", "access-control-allow-headers": "content-type", "access-control-allow-methods": "GET, POST, OPTIONS" };
const json = (data: unknown, status = 200): Response => new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json", ...CORS } });

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    // a 204 may not carry a body: Response("null", 204) throws, and the
    // browser's preflight for every POST got a 500 without CORS headers
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
    if (req.method === "GET" && url.pathname === "/top") {
      const board = url.searchParams.get("board") ?? "";
      if (!BOARDS.has(board)) return json({ error: "bad board" }, 400);
      const n = Math.max(1, Math.min(100, Number(url.searchParams.get("n")) || 20));
      const entries = JSON.parse((await env.BOARDS.get(board)) ?? "[]") as Entry[];
      return json({ board, entries: entries.slice(0, n) });
    }
    if (req.method === "POST" && url.pathname === "/submit") {
      let body: { board?: unknown; name?: unknown; value?: unknown; secret?: unknown } | null;
      try {
        body = (await req.json()) as typeof body;
      } catch {
        return json({ error: "bad json" }, 400);
      }
      if (!body || typeof body !== "object") return json({ error: "bad json" }, 400);
      if (body.secret !== env.SECRET) return json({ error: "no" }, 403);
      const { board, name, value } = body;
      if (typeof board !== "string" || !BOARDS.has(board)) return json({ error: "bad board" }, 400);
      if (typeof name !== "string" || !NAME.test(name)) return json({ error: "bad name" }, 400);
      if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 1e7) return json({ error: "bad value" }, 400);
      const lower = LOWER_IS_BETTER.test(board);
      const entries = JSON.parse((await env.BOARDS.get(board)) ?? "[]") as Entry[];
      const worst = entries[MAX_ENTRIES - 1];
      // a full board this result would not get onto costs no write
      if (!entries.some((e) => e.name === name) && worst && (lower ? value >= worst.value : value <= worst.value)) return json({ ok: true, rank: null });
      const mine = entries.find((e) => e.name === name);
      if (mine) {
        const better = lower ? value < mine.value : value > mine.value;
        if (!better) return json({ ok: true, kept: mine });
        mine.value = value;
        mine.at = new Date().toISOString();
      } else entries.push({ name, value, at: new Date().toISOString() });
      entries.sort((a, b) => (lower ? a.value - b.value : b.value - a.value));
      entries.length = Math.min(entries.length, MAX_ENTRIES);
      await env.BOARDS.put(board, JSON.stringify(entries));
      const rank = entries.findIndex((e) => e.name === name) + 1;
      return json({ ok: true, rank });
    }
    return json({ error: "not found" }, 404);
  },
};
