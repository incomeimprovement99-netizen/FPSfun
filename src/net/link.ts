// The connection between players.
//
// Peer to peer over WebRTC data channels. The PeerJS library's free public
// broker only introduces the browsers (it passes the connection offer
// across); after that the game traffic goes straight between them. So there is
// no game server to run and the build stays a static site.
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
import Peer, { type DataConnection } from "peerjs";

/** everything that goes over the link; see duel.ts for the meanings */
export type NetMsg =
  | { t: "hello"; v: number }
  /** host to a guest on connect: its id and how many will play */
  | { t: "welcome"; id: number; players: number }
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
    }
  | { t: "zone"; live: boolean; caps: number[]; startsIn: number }
  | { t: "shot"; from?: number; o: [number, number, number]; d: [number, number, number]; w: string }
  | { t: "hit"; from?: number; to: number; amount: number; head: boolean }
  | { t: "down"; from?: number; by: number }
  | { t: "round"; n: number; scores: number[]; phase: RoundPhase; left: number; winner: number }
  | { t: "ping"; at: number }
  | { t: "pong"; at: number }
  | { t: "bye"; from?: number };

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
    if (!this.closed && this.conn.open) this.conn.send(m);
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
}

const useLocal = (): boolean => new URLSearchParams(location.search).get("net") === "local";

/**
 * Make a match for `players` (2 or 3). Calls `onCode` once the code is
 * registered and `onLink` for each guest that arrives, with the id given to
 * them (1, then 2). Guests past the count are turned away.
 */
export function hostMatch(players: number, onCode: (code: string) => void, onLink: (l: Link, id: number) => void, onError: (msg: string) => void): HostHandle {
  let code = makeCode();
  let cancelled = false;
  let next = 1;
  const full = () => next >= players;
  if (useLocal()) {
    const ch = new BroadcastChannel(`${PREFIX}${code}`);
    const known = new Set<string>();
    ch.addEventListener("message", (e: MessageEvent<Envelope>) => {
      if (cancelled || e.data.to !== "host" || e.data.m.t !== "hello" || known.has(e.data.from)) return;
      if (full()) return;
      known.add(e.data.from);
      const id = next++;
      const link = new LocalLink("host", ch, "host", e.data.from, false);
      link.send({ t: "welcome", id, players });
      onLink(link, id);
    });
    onCode(code);
    return { code, cancel: () => ((cancelled = true), ch.close()) };
  }
  let peer: Peer | null = null;
  const start = (attempt: number) => {
    peer = new Peer(`${PREFIX}${code}`);
    peer.on("open", () => !cancelled && onCode(code));
    peer.on("connection", (conn) => {
      if (cancelled || full()) return conn.close();
      conn.on("open", () => {
        if (cancelled || full()) return conn.close();
        const id = next++;
        const link = new PeerLink("host", peer!, conn, false);
        link.send({ t: "welcome", id, players });
        onLink(link, id);
      });
    });
    peer.on("error", (err: { type?: string }) => {
      // once someone is in, a broker hiccup does not touch the direct connections
      if (cancelled || next > 1) return;
      if (err.type === "unavailable-id" && attempt < 3) {
        // someone already has this code: pick another
        peer?.destroy();
        code = makeCode();
        start(attempt + 1);
      } else onError(peerError(err.type));
    });
  };
  start(0);
  return {
    get code() {
      return code;
    },
    cancel: () => {
      cancelled = true;
      peer?.destroy();
    },
  };
}

/** join a match by its code; `onLink` gets the link once the host has said welcome */
export function joinMatch(rawCode: string, onLink: (l: Link, welcome: { id: number; players: number }) => void, onError: (msg: string) => void): () => void {
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
        onLink(link, { id: m.id, players: m.players });
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
  const peer = new Peer();
  let done = false;
  peer.on("open", () => {
    const conn = peer.connect(`${PREFIX}${code}`, { reliable: true });
    conn.on("open", () => {
      const link = new PeerLink("guest", peer, conn, true);
      const inner = link.onMessage;
      link.onMessage = (m) => {
        if (!done && m.t === "welcome") {
          done = true;
          onLink(link, { id: m.id, players: m.players });
        }
        inner?.(m);
      };
      link.send({ t: "hello", v: 2 });
    });
    conn.on("close", () => {
      if (!done) onError("The host turned the connection away (the match is full, or over).");
    });
  });
  peer.on("error", (err: { type?: string }) => {
    if (!done) onError(peerError(err.type));
  });
  return () => peer.destroy();
}

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
