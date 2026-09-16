// The state packets for a whole match: who gets what, how often, and how much.
//
// state.ts knows how to turn one player's state into a small packet for one
// peer. This is the part above it that decides which of those packets are
// worth sending this tick, and it exists because the interesting question is
// not "how small is a packet" but "how many of them does the host have to
// send". In a star every guest's view of every other player is carried by the
// host's upload, so the host sends (players - 1) x (players + bots) packets a
// tick and the cost grows with the square of the lobby.
//
// Three things push back on that, all of them tuned in src/config/net.json:
//
//   A stream per (peer, player) pair, so a difference is measured against
//   what THAT peer has, not against some shared idea of the world. This is
//   also why the host should decode a guest's packet and encode it again for
//   the others rather than passing the bytes along: a baseline belongs to one
//   pair of browsers and means nothing to a third.
//
//   Distance bands. A figure 200 m away is a few pixels tall and is being
//   drawn a tenth of a second behind anyway, so it does not need thirty
//   updates a second. Only the host bands, because only the host knows where
//   everyone is and only the host's upload is the bottleneck.
//
//   A byte budget per peer per tick. When a tick would go over, whatever is
//   furthest past its own due time is sent and the rest wait, which costs a
//   distant figure one frame and never costs a near one anything.
//
// A peer that has not said it speaks this format is sent the old full packets
// at the old rate, unbanded and unbudgeted, so an old build plays exactly as
// it does today. Nothing here changes what a match looks like; it changes
// what it costs.
import netCfg from "../config/net.json";
import type { NetMsg } from "./link";
import { PlayerState, STATE_PROTOCOL, StateIn, StateOut, ackMsg, keyframePhase, stateMsg, stateOf } from "./state";
import { absent, wireBytes, wireNum } from "./wire";

const BANDS = netCfg.rate.bands;
const SLACK = netCfg.rate.slack;
const ACK_HZ = netCfg.rate.ackHz;
const BUDGET = netCfg.budget.bytesPerPeerTick;
const GUESS = netCfg.budget.guessBytes;
const BLEND = netCfg.budget.guessBlend;

/** one player, and where they are right now: what a tick has to offer everybody */
export interface Subject {
  /** the player id, the same one duel.ts uses for a figure */
  id: number;
  state: PlayerState;
}

/** a state that arrived and could be used, and who it is about */
export interface Received {
  from: number;
  state: PlayerState;
}

interface PeerState {
  /** the far side announced the same protocol; until then it gets full packets */
  deltas: boolean;
  out: Map<number, StateOut>;
  /** when each player last went to this peer, for the distance bands */
  sentAt: Map<number, number>;
  ackNext: number;
  /** what we have already asked this peer to re-send, so one stall asks once */
  asked: Set<number>;
  /** a running guess at what the next packet costs, so the budget never has to encode one to find out */
  guess: number;
}

/** who a message is about: an absent (or null) `from` means the peer that sent it */
function subjectOf(m: NetMsg, via: number): number {
  const f = (m as unknown as Record<string, unknown>).from;
  return typeof f === "number" && Number.isFinite(f) ? f : via;
}

export class StateSync {
  private peers = new Map<number, PeerState>();
  /** incoming streams, by the peer it came over and then by the player it is about */
  private incoming = new Map<number, Map<number, StateIn>>();
  /** the last state decoded for each player, which is what a host passes on */
  private last = new Map<number, PlayerState>();

  /** what this has cost and saved, for measuring a real match rather than guessing at one */
  readonly stats = { packets: 0, bytes: 0, keyframes: 0, quiet: 0, held: 0, full: 0 };

  /**
   * `self` is our own player id, so a relayed packet about ourselves is
   * ignored rather than fighting our own simulation. `role` decides whether
   * distance bands apply: a guest always sends itself at the full rate,
   * because the host re-encodes it for everyone else and a guest far from the
   * host may be standing next to somebody else.
   */
  constructor(
    private readonly self: number,
    private readonly role: "host" | "guest"
  ) {}

  /** a link opened. Deltas stay off until the far side announces the protocol. */
  addPeer(id: number): void {
    this.peer(id);
  }

  /**
   * A player is gone: their streams, both ways, and their last known state go
   * with them. Call it for anyone who leaves, not only for a peer we held a
   * link to, or a guest would keep re-sending a figure that left the match to
   * everyone still in it.
   */
  removePeer(id: number): void {
    this.peers.delete(id);
    this.incoming.delete(id);
    this.last.delete(id);
    for (const p of this.peers.values()) {
      p.out.delete(id);
      p.sentAt.delete(id);
      p.asked.delete(id);
    }
    // they may also have been a subject somebody else was telling us about
    for (const byVia of this.incoming.values()) byVia.delete(id);
  }

  /**
   * What the far side said in its hello or its welcome. Anything but our own
   * protocol number, including nothing at all, means full packets: a format
   * change is only ever announced, never assumed, and two builds that
   * disagree about it still play together at the old cost.
   */
  notePeer(id: number, protocol: unknown): void {
    this.peer(id).deltas = !absent(protocol) && wireNum(protocol, -1) === STATE_PROTOCOL;
  }

  /** whether this peer is getting deltas, which is worth showing in a network readout */
  speaksDeltas(id: number): boolean {
    return this.peers.get(id)?.deltas ?? false;
  }

  /** the last state we decoded for a player */
  known(id: number): PlayerState | undefined {
    return this.last.get(id);
  }

  /** everyone we have heard about, for a host building the list it passes on */
  relayable(): Subject[] {
    const out: Subject[] = [];
    for (const [id, state] of this.last) if (id !== this.self) out.push({ id, state });
    return out;
  }

  /**
   * This tick's packets. `subjects` is everyone whose state we are the source
   * of: ourselves, any bots we run, and (on the host) everyone we have
   * decoded. `send` gets the peer to send to and the message; a peer is never
   * sent its own state.
   */
  tick(now: number, subjects: readonly Subject[], send: (to: number, m: NetMsg) => void): void {
    const at = new Map<number, Subject>();
    for (const s of subjects) at.set(s.id, s);
    for (const [to, p] of this.peers) {
      this.ackTo(now, to, p, send);
      if (!p.deltas) {
        // An old build, or one that has not said hello yet: what it has
        // always been given, at the rate it has always been given it. No
        // distance band and no budget, because an old client's match must not
        // change at all; the only gate is the top band's rate, which is the
        // 30 Hz duel.ts has always sent at and which lets this be called from
        // a render loop of any speed.
        for (const s of subjects) {
          if (s.id === to) continue;
          if (now - (p.sentAt.get(s.id) ?? -1e9) < SLACK / BANDS[0][1]) continue;
          p.sentAt.set(s.id, now);
          const m = stateMsg(s.state, s.id === this.self ? undefined : s.id);
          this.stats.packets++;
          this.stats.full++;
          this.stats.bytes += wireBytes(m);
          send(to, m);
        }
        continue;
      }
      const peerAt = at.get(to);
      // Keyframes first, then whatever is most overdue, so if the budget
      // bites it bites the figure whose next update matters least. A keyframe
      // does NOT escape its distance band: a peer that has stopped
      // acknowledging gets nothing but keyframes, and at thirty a second to a
      // player 300 m away that would be worse than what this replaced.
      const queue: Array<{ s: Subject; over: number; key: boolean }> = [];
      for (const s of subjects) {
        if (s.id === to) continue;
        const over = now - (p.sentAt.get(s.id) ?? -1e9) - SLACK / this.hzFor(s, peerAt);
        if (over >= 0) queue.push({ s, over, key: this.stream(p, s.id).keyframeDue(now) });
      }
      queue.sort((a, b) => (a.key === b.key ? b.over - a.over : a.key ? -1 : 1));
      let bytes = 0;
      for (let i = 0; i < queue.length; i++) {
        const q = queue[i];
        // The budget is checked against a guess rather than against the real
        // packet, because encoding one and then throwing it away would spend
        // a sequence number on something the far side never sees. The first
        // of the queue always goes: a budget smaller than one packet would
        // otherwise send NOTHING, forever, and a stream that never sends a
        // keyframe is a match that quietly times out.
        if (i > 0 && bytes + p.guess > BUDGET) {
          this.stats.held += queue.length - i;
          break;
        }
        const stream = this.stream(p, q.s.id);
        const before = stream.keyframes;
        const m = stream.encode(q.s.state, now, q.s.id === this.self ? undefined : q.s.id);
        p.sentAt.set(q.s.id, now);
        // Nothing has moved since the state this peer acknowledged. Silence
        // IS the update; the keyframe timer is the heartbeat underneath it.
        if (!m) {
          this.stats.quiet++;
          continue;
        }
        const n = wireBytes(m);
        bytes += n;
        // a slow average, so one fat keyframe does not choke the next tick
        p.guess += (n - p.guess) * BLEND;
        this.stats.packets++;
        this.stats.bytes += n;
        if (stream.keyframes !== before) this.stats.keyframes++;
        send(to, m);
      }
    }
  }

  /**
   * A message that arrived over the link from `via`. Returns the player it is
   * about and their whole state when there is one, and null for everything
   * else, including a delta that could not be applied: the caller keeps
   * drawing the last good state and a keyframe is asked for behind its back.
   */
  receive(m: NetMsg, via: number): Received | null {
    if (m.t === "hello" || m.t === "welcome") {
      this.notePeer(via, (m as unknown as Record<string, unknown>).d);
      return null;
    }
    if (m.t === "sa") {
      this.acksFrom(m, via);
      return null;
    }
    if (m.t !== "s" && m.t !== "sd") return null;
    const from = subjectOf(m, via);
    // our own state, relayed back at us: the simulation here is the source
    if (from === this.self) return null;
    const state = m.t === "s" ? stateOf(m) : this.inStream(via, from).decode(m);
    if (!state) return null;
    this.last.set(from, state);
    return { from, state };
  }

  /** what each stream has cost, one line per peer, for a readout or a check */
  report(): string[] {
    const lines: string[] = [];
    for (const [id, p] of this.peers) lines.push(`peer ${id}: ${p.deltas ? "deltas" : "full packets"}, ${p.out.size} streams`);
    lines.push(`sent ${this.stats.packets} packets, ${this.stats.bytes} bytes, ${this.stats.keyframes} keyframes, ${this.stats.quiet} ticks with nothing to say`);
    return lines;
  }

  // ------------------------------------------------------------ the plumbing

  private peer(id: number): PeerState {
    let p = this.peers.get(id);
    if (!p) {
      p = { deltas: false, out: new Map(), sentAt: new Map(), ackNext: 0, asked: new Set(), guess: GUESS };
      this.peers.set(id, p);
    }
    return p;
  }

  private stream(p: PeerState, subject: number): StateOut {
    let s = p.out.get(subject);
    if (!s) {
      // the phase comes from the player, so a peer's streams keyframe in a
      // trickle rather than all on the same tick
      s = new StateOut(keyframePhase(subject));
      p.out.set(subject, s);
    }
    return s;
  }

  private inStream(via: number, subject: number): StateIn {
    let byVia = this.incoming.get(via);
    if (!byVia) {
      byVia = new Map();
      this.incoming.set(via, byVia);
    }
    let s = byVia.get(subject);
    if (!s) {
      s = new StateIn();
      byVia.set(subject, s);
    }
    return s;
  }

  /** how far the two of them are apart, and what the config says that is worth */
  private hzFor(s: Subject, peerAt: Subject | undefined): number {
    if (this.role !== "host" || !peerAt) return BANDS[0][1];
    const a = s.state;
    const b = peerAt.state;
    const d = Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
    for (const band of BANDS) if (d <= band[0]) return band[1];
    return BANDS[BANDS.length - 1][1];
  }

  /**
   * What we have managed to apply from this peer, and what we are stuck on. A
   * new stall does not wait for the timer: the whole point of asking is that
   * a figure is frozen until the answer comes back.
   */
  private ackTo(now: number, to: number, p: PeerState, send: (to: number, m: NetMsg) => void): void {
    const streams = this.incoming.get(to);
    if (!streams?.size) return;
    const ok: Array<[number, number]> = [];
    const need: number[] = [];
    for (const [subject, s] of streams) {
      if (s.ackSeq >= 0) ok.push([subject, s.ackSeq]);
      if (s.wantsKeyframe) need.push(subject);
    }
    const urgent = need.some((subject) => !p.asked.has(subject));
    p.asked = new Set(need);
    if (!urgent && now < p.ackNext) return;
    p.ackNext = now + 1 / ACK_HZ;
    if (ok.length || need.length) send(to, ackMsg(ok, need));
  }

  private acksFrom(m: NetMsg, via: number): void {
    const p = this.peers.get(via);
    if (!p) return;
    const raw = m as unknown as Record<string, unknown>;
    const ok = raw.ok;
    if (Array.isArray(ok)) {
      for (const pair of ok) {
        if (!Array.isArray(pair) || pair.length < 2) continue;
        p.out.get(wireNum(pair[0], -1))?.ack(wireNum(pair[1], -1));
      }
    }
    const need = raw.need;
    if (Array.isArray(need)) for (const subject of need) p.out.get(wireNum(subject, -1))?.needKeyframe();
  }
}
