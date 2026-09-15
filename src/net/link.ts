// The connection between players.
//
// Peer to peer over WebRTC data channels. A PeerJS broker only introduces the
// browsers (it passes the connection offer across); after that the game
// traffic goes straight between them, or through a TURN relay when a network
// blocks the direct path. The broker is our own when the site is served by
// server/game/serve.mjs (it answers /net.json), else the free public one, so
// the same build works on GitHub Pages too.
//
// A match code is 5 letters. The player who makes the match registers as
// `PREFIX + code` with the broker; the others connect to that name. The host
// takes up to `players - 1` guests and gives each an id (1, 2); everything a
// guest sends goes to the host, which relays it to the other guest with the
// sender's id on it (duel.ts). So a 1v1v1 is a star with the host in the
// middle, and the host's connection is the one that matters.
//
// `?net=local` in the URL swaps in a BroadcastChannel link instead, which
// joins tabs of the same browser on one machine. It is how the match is
// tested without the internet, and it is handy for trying it alone.
import Peer, { type DataConnection, type PeerOptions } from "peerjs";

/** everything that goes over the link; see duel.ts for the meanings */
export type NetMsg =
  | { t: "hello"; v: number }
  /** host to a guest on connect: its id and how many will play; a battle royale says so, with its drop */
  | { t: "welcome"; id: number; players: number; br?: BrWelcome; opts?: MatchOpts }
  | {
      t: "s";
      from?: number;
      x: number;
      y: number;
      z: number;
      yaw: number;
      pitch: number;
      crouch: boolean;
      w: string;
      hp: number;
      sh: number;
      alive: boolean;
      /** operator look, so the other side draws the right figure */
      op: string;
      /** the player's name, for the scoreboard */
      name: string;
      /** in the game (not on the menu): the host waits for everyone before round 1 */
      ready?: boolean;
      /** stance code (dummy.ts stanceCode) and speed in dm/s, for the figure's animation */
      st?: number;
      sp?: number;
      /** their armour's size (a battle royale's shield core) */
      shm?: number;
      /** down, not out (a battle royale squad) */
      dn?: number;
      /** aiming down sights, 0..10; the hands' action (dummy.ts actCode): the figure's arms */
      ad?: number;
      ac?: number;
    }
  | { t: "zone"; live: boolean; caps: number[]; startsIn: number }
  | { t: "shot"; from?: number; o: [number, number, number]; d: [number, number, number]; w: string }
  /** a hit, from the shooter: `w` the gun and `d` the distance in metres, for the death recap (an older build sends neither) */
  | { t: "hit"; from?: number; to: number; amount: number; head: boolean; w?: string; d?: number }
  /** a player (or a host's bot) is out: `by` whom; `m` 1 when it was a melee (Gun Run takes a level for it) */
  | { t: "down"; from?: number; by: number; m?: number }
  | { t: "round"; n: number; scores: number[]; phase: RoundPhase; left: number; winner: number }
  | { t: "ping"; at: number }
  | { t: "pong"; at: number }
  /** the battle royale's ring from the host, twice a second: phase, 0 waiting 1 closing 2 closed, seconds left, the live and the next circle, how many are alive */
  | { t: "ring"; ph: number; st: number; left: number; cur: [number, number, number]; next: [number, number, number]; alive: number }
  /** the battle royale is over for the squad */
  | { t: "brend"; won: boolean; placement: number }
  /**
   * Something the others should see or hear that is not a shot: a JOLT (from
   * a to b), and later pings, throwables and the like. `k` names it; bots'
   * effects carry the bot's id in `from`.
   */
  | { t: "fx"; from?: number; k: string; a?: [number, number, number]; b?: [number, number, number]; n?: number }
  /**
   * Battle royale loot, the host's to decide: a guest asks to `take` an item
   * or `drop` one (a swapped gun, its death box); the host says an item is
   * `gone` (and who took it) or that one was `add`ed, with its key.
   */
  | { t: "loot"; from?: number; op: "take" | "gone" | "add" | "drop"; key?: number; by?: number; item?: LootItemWire; at?: [number, number, number] }
  /** a squad member is down, not out (a squad mate can still revive them) */
  | { t: "dnd"; from?: number; by: number }
  /** a revive on `to`: started, given up, or done */
  | { t: "rev"; from?: number; to: number; op: "start" | "stop" | "done" }
  /** `to` comes back, dropping in over `at` (a respawn beacon) */
  | { t: "respawn"; from?: number; to: number; at: [number, number, number] }
  /** a ping for the squad: what (`k`), where, a label, a figure's id when it is on one */
  | { t: "mark"; from?: number; k: string; at: [number, number, number]; label?: string; target?: number }
  /** a care package is on its way down to `at`, landing in `lands` seconds */
  | { t: "pod"; from?: number; at: [number, number, number]; lands: number }
  /**
   * The arena modes' state from the host, four times a second and on every
   * change (modematch.ts): seconds left on the clock; a row per player and bot
   * [id, level, kills, deaths, team]; the teams' scores; the crown [phase (0
   * waiting, 1 on the ground, 2 carried), x, z, carrier, held]; the winner
   * (an id, or a team as -10 - team) once it is decided.
   */
  | { t: "mode"; left: number; rows: Array<[number, number, number, number, number]>; tm?: [number, number]; cr?: [number, number, number, number, number]; win?: number }
  | { t: "bye"; from?: number };

/**
 * A message without its undefined fields. PeerJS packs `undefined` as `null`,
 * and a field checked as "absent or a string" then fails: a hit sent without
 * its gun, a JOLT's effect without its number, were dropped whole on the real
 * connection while the local transport (a structured clone) kept them.
 */
export function withoutUndefined<T>(v: T): T {
  if (Array.isArray(v)) return v.map((x) => withoutUndefined(x)) as T;
  if (v && typeof v === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(v as Record<string, unknown>)) if (x !== undefined) out[k] = withoutUndefined(x);
    return out as T;
  }
  return v;
}

/** what a guest needs to drop into the same battle royale as the host */
export interface BrWelcome {
  /** the POI id the squad drops on */
  poi: string;
  bots: number;
  difficulty: string;
  /** the floor loot's seed: every browser lays out the same items with the same keys */
  seed?: number;
  /** land with nothing and loot (the default), or with your loadout */
  start?: "loot" | "loadout";
}

/** a loot item as it goes over the wire (loot.ts LootItem) */
export interface LootItemWire {
  kind: string;
  id: string;
  n: number;
  rarity: string;
  mag?: number;
  attach?: Record<string, string | null>;
  owner?: number;
  ownerName?: string;
}

/** the host's settings for the match, told to every guest in the welcome */
export interface MatchOpts {
  /** JOLT and TRIAGE are on (abilities.ts) */
  abilities: boolean;
  /** an arena mode (modematch.ts): which, how many bots and how good, Gun Run's list */
  mode?: ModeWelcome;
}

/** what a guest needs to play the host's arena mode */
export interface ModeWelcome {
  kind: string;
  bots: number;
  difficulty: string;
  list?: "short" | "full";
}

export type RoundPhase = "waiting" | "countdown" | "fight" | "roundEnd" | "matchEnd";

export interface Link {
  readonly role: "host" | "guest";
  send(m: NetMsg): void;
  close(): void;
  onMessage: ((m: NetMsg) => void) | null;
  onClose: (() => void) | null;
}

const PREFIX = "rng1v1-";
/** no 0/O, 1/I/L: codes get read out loud and typed on phones */
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function makeCode(): string {
  let s = "";
  const r = new Uint32Array(5);
  crypto.getRandomValues(r);
  for (const x of r) s += ALPHABET[x % ALPHABET.length];
  return s;
}

export function normaliseCode(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 5);
}

/** a link over a PeerJS data connection */
class PeerLink implements Link {
  onMessage: ((m: NetMsg) => void) | null = null;
  onClose: (() => void) | null = null;
  private closed = false;
  constructor(
    readonly role: "host" | "guest",
    private peer: Peer,
    private conn: DataConnection,
    /** the host keeps its peer open for the other guest; a guest owns its peer */
    private ownsPeer: boolean
  ) {
    conn.on("data", (d) => {
      if (!this.closed) this.onMessage?.(d as NetMsg);
    });
    const end = () => {
      if (this.closed) return;
      this.closed = true;
      this.onClose?.();
      if (this.ownsPeer) setTimeout(() => this.peer.destroy(), 0);
    };
    conn.on("close", end);
    conn.on("error", end);
    peer.on("disconnected", () => {
      // losing the broker does not matter once the data channel is open
    });
  }
  send(m: NetMsg): void {
    if (!this.closed && this.conn.open) this.conn.send(withoutUndefined(m));
  }
  close(): void {
    if (this.closed) return;
    this.send({ t: "bye" });
    this.closed = true;
    setTimeout(() => {
      this.conn.close();
      if (this.ownsPeer) this.peer.destroy();
    }, 100);
  }
}

/** a link between two tabs of one browser: an envelope addressed by name */
interface Envelope {
  from: string;
  to: string;
  m: NetMsg;
}
class LocalLink implements Link {
  onMessage: ((m: NetMsg) => void) | null = null;
  onClose: (() => void) | null = null;
  private closed = false;
  private readonly handler: (e: MessageEvent<Envelope>) => void;
  constructor(
    readonly role: "host" | "guest",
    private ch: BroadcastChannel,
    private me: string,
    private peer: string,
    /** a guest owns its channel; the host's links share one */
    private ownsChannel: boolean
  ) {
    this.handler = (e: MessageEvent<Envelope>) => {
      if (this.closed || e.data.to !== this.me || e.data.from !== this.peer) return;
      if (e.data.m.t === "bye") this.onClose?.();
      this.onMessage?.(e.data.m);
    };
    ch.addEventListener("message", this.handler);
  }
  send(m: NetMsg): void {
    if (!this.closed) this.ch.postMessage({ from: this.me, to: this.peer, m } satisfies Envelope);
  }
  close(): void {
    if (this.closed) return;
    this.send({ t: "bye" });
    this.closed = true;
    this.ch.removeEventListener("message", this.handler);
    if (this.ownsChannel) this.ch.close();
  }
}

export interface HostHandle {
  code: string;
  cancel(): void;
  /** a guest left before the match began: their place (and id) is open again */
  release(id: number): void;
}

const useLocal = (): boolean => new URLSearchParams(location.search).get("net") === "local";

/**
 * Where the broker is and which relays to use. Our own server answers
 * /net.json with its broker path and fresh TURN credentials; a site without it
 * (GitHub Pages, the dev server) has no such file, and the public PeerJS
 * broker with the library's default relays is used. Fetched per match so the
 * credentials are never stale. `?broker=public` forces the public one.
 */
async function peerOptions(): Promise<PeerOptions> {
  if (new URLSearchParams(location.search).get("broker") === "public") return {};
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 3000);
  try {
    const r = await fetch("./net.json", { cache: "no-store", signal: ctl.signal });
    // the dev server answers any path with the game page, so check the type
    if (!r.ok || !(r.headers.get("content-type") ?? "").includes("json")) return {};
    const j = (await r.json()) as { peer?: { path?: string; key?: string }; iceServers?: RTCIceServer[] };
    if (!j.peer?.path) return {};
    const secure = location.protocol === "https:";
    return {
      host: location.hostname,
      port: location.port ? Number(location.port) : secure ? 443 : 80,
      path: j.peer.path,
      key: j.peer.key ?? "peerjs",
      secure,
      config: { iceServers: j.iceServers ?? [] },
    };
  } catch {
    return {};
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Make a match for `players` (2 or 3). Calls `onCode` once the code is
 * registered and `onLink` for each guest that arrives, with the id given to
 * them (the lowest free one: 1, then 2). Guests past the count are turned
 * away; `release` opens a place again when a guest leaves before the start.
 */
export function hostMatch(
  players: number,
  onCode: (code: string) => void,
  onLink: (l: Link, id: number) => void,
  onError: (msg: string) => void,
  /** a battle royale: what the welcome tells each guest */
  br?: BrWelcome,
  /** the host's settings, for every guest */
  opts?: MatchOpts
): HostHandle {
  let code = makeCode();
  let cancelled = false;
  const taken = new Set<number>();
  const full = () => taken.size >= players - 1;
  /** the lowest free guest id, marked taken */
  const claim = (): number => {
    let id = 1;
    while (taken.has(id)) id++;
    taken.add(id);
    return id;
  };
  const release = (id: number) => void taken.delete(id);
  if (useLocal()) {
    const ch = new BroadcastChannel(`${PREFIX}${code}`);
    const known = new Set<string>();
    ch.addEventListener("message", (e: MessageEvent<Envelope>) => {
      if (cancelled || e.data.to !== "host" || e.data.m.t !== "hello" || known.has(e.data.from)) return;
      if (full()) return;
      known.add(e.data.from);
      const id = claim();
      const link = new LocalLink("host", ch, "host", e.data.from, false);
      link.send({ t: "welcome", id, players, br, opts });
      onLink(link, id);
    });
    onCode(code);
    return { code, cancel: () => ((cancelled = true), ch.close()), release };
  }
  let peer: Peer | null = null;
  const peerOpts = peerOptions();
  const start = async (attempt: number) => {
    const o = await peerOpts;
    if (cancelled) return;
    const p = new Peer(`${PREFIX}${code}`, o);
    peer = p;
    p.on("open", () => !cancelled && onCode(code));
    p.on("connection", (conn) => {
      conn.on("open", () => {
        // a full or cancelled match lets the connection open and then closes
        // it, so the guest hears "turned away"; closing before it opens left
        // the guest with no answer at all
        if (cancelled || full()) {
          setTimeout(() => conn.close(), 250);
          return;
        }
        const id = claim();
        const link = new PeerLink("host", p, conn, false);
        link.send({ t: "welcome", id, players, br, opts });
        onLink(link, id);
      });
    });
    // a broker blip while a place is still open: register the code again, or
    // the next friend gets "no match with that code" while we show it
    p.on("disconnected", () => {
      if (!cancelled && !p.destroyed && !full()) p.reconnect();
    });
    p.on("error", (err: { type?: string }) => {
      // once someone is in, a broker hiccup does not touch the direct connections
      if (cancelled || taken.size > 0) return;
      if (err.type === "unavailable-id" && attempt < 3) {
        // someone already has this code: pick another
        p.destroy();
        code = makeCode();
        void start(attempt + 1);
      } else onError(peerError(err.type));
    });
  };
  void start(0);
  return {
    get code() {
      return code;
    },
    cancel: () => {
      cancelled = true;
      peer?.destroy();
    },
    release,
  };
}

/** join a match by its code; `onLink` gets the link once the host has said welcome */
export function joinMatch(rawCode: string, onLink: (l: Link, welcome: { id: number; players: number; br?: BrWelcome; opts?: MatchOpts }) => void, onError: (msg: string) => void): () => void {
  const code = normaliseCode(rawCode);
  if (code.length !== 5) {
    onError("A match code is 5 letters and numbers.");
    return () => undefined;
  }
  if (useLocal()) {
    const ch = new BroadcastChannel(`${PREFIX}${code}`);
    const me = `g${Math.random().toString(36).slice(2, 8)}`;
    const link = new LocalLink("guest", ch, me, "host", true);
    let joined = false;
    const inner = link.onMessage;
    link.onMessage = (m) => {
      if (!joined && m.t === "welcome") {
        joined = true;
        onLink(link, { id: m.id, players: m.players, br: m.br, opts: m.opts });
      }
      inner?.(m);
    };
    link.send({ t: "hello", v: 2 });
    // no host answers: say so rather than sitting there
    const timer = setTimeout(() => {
      if (!joined) onError("No match with that code (no host answered).");
    }, 4000);
    return () => {
      clearTimeout(timer);
      ch.close();
    };
  }
  let peer: Peer | null = null;
  let done = false;
  let cancelled = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  /** report once, and let go of the broker: a failed join leaves nothing behind */
  const fail = (msg: string) => {
    if (done || cancelled) return;
    done = true;
    clearTimeout(timer);
    onError(msg);
    setTimeout(() => peer?.destroy(), 0);
  };
  void peerOptions().then((o) => {
    if (cancelled) return;
    const p = new Peer(o);
    peer = p;
    p.on("open", () => {
      const conn = p.connect(`${PREFIX}${code}`, { reliable: true });
      let opened = false;
      // the broker found the host but the two browsers never reach each other:
      // both behind networks that block direct connections, and no relay got
      // through either. Without this the status sits on "Joining..." for good.
      timer = setTimeout(() => fail(JOIN_TIMEOUT), JOIN_TIMEOUT_MS);
      conn.on("open", () => {
        opened = true;
        const link = new PeerLink("guest", p, conn, true);
        link.onMessage = (m) => {
          if (!done && m.t === "welcome") {
            done = true;
            clearTimeout(timer);
            onLink(link, { id: m.id, players: m.players, br: m.br, opts: m.opts });
          }
        };
        link.send({ t: "hello", v: 2 });
      });
      conn.on("close", () => fail(opened ? "The host turned the connection away (the match is full, or over)." : JOIN_TIMEOUT));
      // ICE failing shows up only as an error on the connection (PeerJS sends
      // no close for a connection that never opened)
      conn.on("error", () => fail(opened ? "Lost the connection to the host." : JOIN_TIMEOUT));
    });
    p.on("error", (err: { type?: string }) => fail(peerError(err.type)));
  });
  return () => {
    cancelled = true;
    clearTimeout(timer);
    peer?.destroy();
  };
}

const JOIN_TIMEOUT_MS = 20000;
const JOIN_TIMEOUT =
  "Found the match but could not connect to the host. One of you is on a network that blocks game connections (a VPN, school or office wifi, a phone hotspot): try another network or turn the VPN off.";

function peerError(type: string | undefined): string {
  switch (type) {
    case "peer-unavailable":
      return "No match with that code. Check it, or ask your friend to make a new one.";
    case "network":
    case "server-error":
    case "socket-error":
    case "socket-closed":
      return "Could not reach the matchmaking server. Check your internet connection.";
    case "browser-incompatible":
      return "This browser cannot make peer-to-peer connections.";
    default:
      return `Connection failed (${type ?? "unknown"}).`;
  }
}
