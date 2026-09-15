// The game's own server: one Node process that
//
//   1. serves the public build (`dist/`, built with `npm run build:beta`),
//   2. runs our own PeerJS broker at /peerjs, so match codes never depend on
//      the free public one (0.peerjs.com),
//   3. answers /net.json with the broker's path and the ICE servers, including
//      short-lived credentials for our TURN relay (coturn) when TURN_SECRET is
//      set, so players on networks that block direct connections still meet,
//   4. keeps the online boards (/api/board: best course times and match
//      wins by name) in a JSON file that survives deploys,
//   5. answers /health for the deploy script.
//
// The game reads /net.json when a match is made or joined (src/net/link.ts). On
// a host without this server (GitHub Pages) the file is missing and the game
// falls back to the public broker, so the same build works on both.
//
// Behind Caddy for HTTPS (docs/SERVER_GUIDE.md). Plain JavaScript on purpose:
// the box runs it with `node serve.mjs`, no build step.
//
// Environment (all optional):
//   PORT          default 4100
//   HOST          default 127.0.0.1 (Caddy in front); 0.0.0.0 to expose it
//   DIST          the built site, default ../../dist next to this file
//   TURN_SECRET   coturn's static-auth-secret; no TURN is offered without it
//   TURN_HOST     the relay's public hostname, default the request's host
//   TURN_PORT     default 3478
//   PEER_KEY      the broker key the game must send, default "range"
//   BOARD_FILE    where the boards are kept, default boards.json next to this file
//   VERSION       shown on /health, default the build stamp in dist/version.txt
import express from "express";
import { ExpressPeerServer } from "peer";
import { createHmac } from "node:crypto";
import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT ?? 4100);
const HOST = process.env.HOST ?? "127.0.0.1";
const DIST = resolve(process.env.DIST ?? join(here, "..", "..", "dist"));
const TURN_SECRET = process.env.TURN_SECRET ?? "";
const TURN_PORT = Number(process.env.TURN_PORT ?? 3478);
const PEER_KEY = process.env.PEER_KEY ?? "range";
/** a TURN credential lives this long; a match that outlives it keeps its relay, only new allocations need a fresh one */
const TURN_TTL_S = 12 * 3600;

if (!existsSync(join(DIST, "index.html"))) {
  console.error(`no built site at ${DIST} (run npm run build:beta, or set DIST)`);
  process.exit(1);
}
const version =
  process.env.VERSION ?? (existsSync(join(DIST, "version.txt")) ? readFileSync(join(DIST, "version.txt"), "utf8").trim() : "unknown");

const app = express();
app.disable("x-powered-by");
// Caddy is the only thing that talks to us; trust its X-Forwarded-* headers
app.set("trust proxy", "loopback");

let peers = 0;
const started = Date.now();

app.get("/health", (_req, res) => {
  res.set("Cache-Control", "no-store");
  res.json({ ok: true, version, peers, turn: Boolean(TURN_SECRET), upSeconds: Math.round((Date.now() - started) / 1000) });
});

// the connection settings for the game; TURN credentials in the coturn REST
// format (use-auth-secret): username "<expiry>:range", password
// base64(HMAC-SHA1(secret, username))
app.get("/net.json", (req, res) => {
  res.set("Cache-Control", "no-store");
  const iceServers = [{ urls: "stun:stun.l.google.com:19302" }];
  if (TURN_SECRET) {
    const host = process.env.TURN_HOST ?? req.hostname;
    const username = `${Math.floor(Date.now() / 1000) + TURN_TTL_S}:range`;
    const credential = createHmac("sha1", TURN_SECRET).update(username).digest("base64");
    iceServers.push(
      { urls: `stun:${host}:${TURN_PORT}` },
      { urls: [`turn:${host}:${TURN_PORT}?transport=udp`, `turn:${host}:${TURN_PORT}?transport=tcp`], username, credential }
    );
  }
  res.json({ v: 1, peer: { path: "/peerjs/", key: PEER_KEY }, iceServers, board: "/api/board" });
});

// ---------- the online boards ----------
// One entry per name per board, the best kept, 100 per board. The game posts a
// course time when a run finishes and its win count when a match is won (the
// same contract as server/leaderboard/worker.ts). Anyone can post any number:
// the browser is the only witness, so these are boards between friends, not
// ranked play (that needs the game server of NEXT_STEPS).
const BOARD_FILE = resolve(process.env.BOARD_FILE ?? join(here, "boards.json"));
const BOARD_IDS = new Set(["course:basic", "course:advanced", "course:drill", "duel:wins", "triple:wins", "br:wins", "gunrun:wins", "tdm:wins", "crown:wins", "bots:easy:wins", "bots:normal:wins", "bots:hard:wins"]);
const LOWER_IS_BETTER = /^course:/;
const NAME = /^[A-Za-z0-9_ .-]{1,16}$/;
const MAX_ENTRIES = 100;
/** @type {Record<string, Array<{ name: string; value: number; at: string }>>} */
let boards = {};
try {
  if (existsSync(BOARD_FILE)) boards = JSON.parse(readFileSync(BOARD_FILE, "utf8"));
} catch (e) {
  console.error(`boards: could not read ${BOARD_FILE}, starting empty (${e})`);
}
let boardsDirty = false;
/** write to a temp file and rename, so a crash mid-write never leaves half a file */
const flushBoards = () => {
  if (!boardsDirty) return;
  boardsDirty = false;
  try {
    writeFileSync(`${BOARD_FILE}.tmp`, JSON.stringify(boards));
    renameSync(`${BOARD_FILE}.tmp`, BOARD_FILE);
  } catch (e) {
    boardsDirty = true;
    console.error(`boards: write failed (${e})`);
  }
};
setInterval(flushBoards, 5000).unref();

// 30 posts per 10 minutes per address: a match or a run is minutes long
const posts = new Map();
const POST_LIMIT = 30;
const POST_WINDOW_MS = 10 * 60 * 1000;
setInterval(() => {
  const now = Date.now();
  for (const [ip, p] of posts) if (p.resetAt < now) posts.delete(ip);
}, POST_WINDOW_MS).unref();

app.get("/api/board/top", (req, res) => {
  res.set("Cache-Control", "no-store");
  const board = String(req.query.board ?? "");
  if (!BOARD_IDS.has(board)) return res.status(400).json({ error: "bad board" });
  const n = Math.max(1, Math.min(100, Number(req.query.n) || 20));
  res.json({ board, entries: (boards[board] ?? []).slice(0, n) });
});

app.post("/api/board/submit", express.json({ limit: "2kb" }), (req, res) => {
  const now = Date.now();
  const ip = req.ip ?? "?";
  const p = posts.get(ip) ?? { count: 0, resetAt: now + POST_WINDOW_MS };
  if (p.resetAt < now) Object.assign(p, { count: 0, resetAt: now + POST_WINDOW_MS });
  if (++p.count > POST_LIMIT) return res.status(429).json({ error: "slow down" });
  posts.set(ip, p);
  const body = req.body && typeof req.body === "object" ? req.body : {};
  const { board, name, value } = body;
  if (typeof board !== "string" || !BOARD_IDS.has(board)) return res.status(400).json({ error: "bad board" });
  if (typeof name !== "string" || !NAME.test(name)) return res.status(400).json({ error: "bad name" });
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 1e5) return res.status(400).json({ error: "bad value" });
  const lower = LOWER_IS_BETTER.test(board);
  // no course is run in under 5 s: a smaller time is a mistake or a forgery
  if (lower && value < 5) return res.status(400).json({ error: "bad value" });
  const entries = (boards[board] ??= []);
  const mine = entries.find((e) => e.name === name);
  if (mine) {
    if (!(lower ? value < mine.value : value > mine.value)) return res.json({ ok: true, rank: entries.indexOf(mine) + 1 });
    mine.value = value;
    mine.at = new Date().toISOString();
  } else entries.push({ name, value, at: new Date().toISOString() });
  entries.sort((a, b) => (lower ? a.value - b.value : b.value - a.value));
  entries.length = Math.min(entries.length, MAX_ENTRIES);
  boardsDirty = true;
  const rank = entries.findIndex((e) => e.name === name) + 1;
  res.json({ ok: true, rank: rank || null });
});

// the built site: file names under assets/ carry a content hash, so they can be
// cached for good; everything else is revalidated so a deploy shows at once
app.use(
  express.static(DIST, {
    index: "index.html",
    setHeaders(res, path) {
      if (/[\\/]assets[\\/]/.test(path)) res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      else if (/[\\/](tex|models)[\\/]/.test(path)) res.setHeader("Cache-Control", "public, max-age=86400");
      else res.setHeader("Cache-Control", "no-cache");
    },
  })
);

const server = app.listen(PORT, HOST, () => {
  console.log(`range server ${version} on http://${HOST}:${PORT} (site ${DIST}, TURN ${TURN_SECRET ? "on" : "off"})`);
});

const broker = ExpressPeerServer(server, {
  path: "/",
  key: PEER_KEY,
  proxied: true,
  // no listing of who is online: a code is the only way in
  allow_discovery: false,
  // a few friends at a time; this caps a flood, not real use
  concurrent_limit: 500,
  alive_timeout: 60000,
  expire_timeout: 5000,
});
broker.on("connection", () => peers++);
broker.on("disconnect", () => (peers = Math.max(0, peers - 1)));
app.use("/peerjs", broker);

// unknown paths: a plain 404, not the game page (a typo in an asset path should
// fail loudly, and /net.json callers need to tell "no such file" from JSON)
app.use((_req, res) => res.status(404).type("text/plain").send("not found"));
// a body that is not JSON, or too big: a plain 400, not a stack trace in the log
app.use((err, _req, res, next) => {
  if (err?.type === "entity.parse.failed" || err?.type === "entity.too.large") return res.status(400).json({ error: "bad json" });
  next(err);
});

const stop = () => {
  flushBoards();
  server.close(() => process.exit(0));
  // open broker sockets keep close() waiting; pm2 would kill us anyway
  setTimeout(() => process.exit(0), 2000).unref();
};
process.on("SIGTERM", stop);
process.on("SIGINT", stop);
