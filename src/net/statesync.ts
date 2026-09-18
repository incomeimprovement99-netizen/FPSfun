// The delta packets for a whole match: which peer gets them, and the streams
// and acknowledgements behind them.
//
// state.ts turns one player's state into a small part for one peer. This is
// the bookkeeping above it, one stream per (peer, player) pair, because "what
// has this peer got" is a different question for every peer. It is also why
// the host decodes a guest's state and encodes it again for each of the
// others rather than passing the bytes along: a baseline belongs to one pair
// of browsers and means nothing to a third.
//
// It sends nothing on a clock of its own. duel.ts calls it at the moment it
// sends or relays a state, which keeps every rate and every relay exactly as
// it was: the host still passes a guest's movement on the moment it arrives,
// even in a background tab whose frames have slowed to one a second.
//
// Nobody gets a delta packet until they have said they read one. A player's
// own full packet carries `dp`, the version this build reads, and a delta
// packet from a peer says the same thing (it is only ever sent to a peer that
// announced that version). An older build does neither and is sent the full
// packets it has always had, at the rate it has always had them, so an old
// build and a new one play together at the old cost. `?deltas=0` in the address, or `enabled: false` in net.json, turns
// the whole thing off for this browser, which then plays exactly as an older
// build would.
import netCfg from "../config/net.json";
import type { AckMsg, DeltaMsg, DeltaPart } from "./link";
import { type PlayerState, STATE_PROTOCOL, StateIn, StateOut, keyframePhase } from "./state";
import { absent, wireNum, withoutUndefined } from "./wire";

const ACK_HZ = netCfg.ackHz;

/** the address says no: `?deltas=0` plays on the full packets, for a match that looks wrong or a test */
function offInAddress(): boolean {
  try {
    return typeof location !== "undefined" && new URLSearchParams(location.search).get("deltas") === "0";
  } catch {
    return false;
  }
}

/** a state that arrived and could be used, and who it is about */
export interface Received {
  from: number;
  state: PlayerState;
}

interface PeerStreams {
  /** the far side's own full packet named our protocol; until then it gets full packets */
  deltas: boolean;
  /** what we send it, by the player it is about */
  out: Map<number, StateOut>;
  /** what it sends us, by the player it is about */
  in: Map<number, StateIn>;
  ackNext: number;
  /** the sequence we last told it we applied, per player, so an ack only says what is new */
  told: Map<number, number>;
  /** what we have asked it to send whole, so one stall asks once and not on every packet */
  asked: Set<number>;
}

/** who a part is about: an absent (or null) `f` means the peer that sent it */
function subjectOf(p: unknown, via: number): number {
  const f = p && typeof p === "object" ? (p as Record<string, unknown>).f : undefined;
  return typeof f === "number" && Number.isFinite(f) ? f : via;
}

export class StateSync {
  private peers = new Map<number, PeerStreams>();
  /** each new outgoing stream's epoch: consecutive, from a random start, so a stream begun again is never mistaken for the old one */
  private epochNext = Math.floor(Math.random() * 0x10000);
  /** on for this browser: the config says so and the address does not say otherwise */
  readonly enabled: boolean;

  /**
   * What the delta packets have done, for the tests and tools/net-cost.ts:
   * parts sent (and how many were keyframes), sends that had nothing to say,
   * parts applied and refused, acks sent (and how many asked for a keyframe),
   * and delta messages that arrived while they were off here, which only a
   * broken negotiation could send and which an older build would ignore.
   */
  readonly stats = { parts: 0, keyframes: 0, quiet: 0, applied: 0, refused: 0, acks: 0, asks: 0, unexpected: 0 };

  /** `self` is our own player id, so a relayed part about ourselves is ignored rather than fighting our own simulation */
  constructor(
    private readonly self: number,
    enabled = netCfg.enabled && !offInAddress()
  ) {
    this.enabled = enabled;
  }

  /** what our own full packet says (link.ts `dp`): our protocol, or nothing when the delta packets are off here */
  get announce(): number | undefined {
    return this.enabled ? STATE_PROTOCOL : undefined;
  }

  /**
   * What a peer's own full packet said about itself. Anything but our own
   * protocol number, including nothing at all, means full packets: a format
   * change is only ever announced, never assumed, and two builds that
   * disagree about it still play together at the old cost.
   */
  notePeer(id: number, protocol: unknown): void {
    this.peer(id).deltas = !absent(protocol) && wireNum(protocol, -1) === STATE_PROTOCOL;
  }

  /** whether this peer is sent delta packets, which is worth showing in a readout */
  speaksDeltas(id: number): boolean {
    return this.enabled && (this.peers.get(id)?.deltas ?? false);
  }

  /**
   * The part for `to` about `subject`, or null when there is nothing to say
   * (the player has not changed since the state `to` acknowledged, and no
   * keyframe is due). Only for a peer that speaksDeltas. Parts for one peer
   * can go in one delta packet ({ t: "sd", p: [...] }), which is what
   * duel.ts does with everything one frame sends.
   */
  encode(to: number, subject: number, state: PlayerState, now: number): DeltaPart | null {
    const p = this.peer(to);
    let s = p.out.get(subject);
    if (!s) {
      // the phase comes from the player, so a peer's streams keyframe in a
      // trickle rather than all on the same tick
      s = new StateOut(keyframePhase(subject), this.epochNext);
      this.epochNext = (this.epochNext + 1) & 0xffff;
      p.out.set(subject, s);
    }
    const before = s.keyframes;
    const part = s.encode(state, now, subject === this.self ? undefined : subject);
    if (!part) {
      this.stats.quiet++;
      return null;
    }
    this.stats.parts++;
    if (s.keyframes !== before) this.stats.keyframes++;
    return part;
  }

  /**
   * A delta packet that came over the link from `via`: every part that could
   * be applied, as the player it is about and their whole state. A part that
   * could not be applied is left out, so the caller keeps drawing that
   * player's last good state, and a keyframe is asked for in the next ack.
   */
  decode(m: DeltaMsg, via: number): Received[] {
    const got: Received[] = [];
    // Off here, so nobody was told we read these: drop them the way an older
    // build would, and count them, because a peer that sent one anyway is a
    // negotiation bug that the tests should see rather than have smoothed over.
    if (!this.enabled) {
      this.stats.unexpected++;
      return got;
    }
    const parts = (m as unknown as Record<string, unknown>).p;
    if (!Array.isArray(parts)) return got;
    const p = this.peer(via);
    // A delta packet is itself the announcement: a peer only sends one to a
    // peer whose own full packet named the version it reads, which was ours.
    // Without this, whichever end switched first might never send the other
    // a full packet at all, and the other would stay on full packets for the
    // whole match (it did, over the real link, before this line).
    p.deltas = true;
    for (const part of parts) {
      const from = subjectOf(part, via);
      // our own state, relayed back at us: the simulation here is the source
      if (from === this.self) continue;
      let s = p.in.get(from);
      if (!s) {
        s = new StateIn();
        p.in.set(from, s);
      }
      const state = s.decode(part);
      if (state) {
        this.stats.applied++;
        got.push({ from, state });
      } else this.stats.refused++;
    }
    return got;
  }

  /**
   * The ack this end owes `via` right now, or null. It says what we applied
   * since the last one, ackHz times a second, and what we are stuck on; a new
   * stall does not wait for the timer, because a figure is frozen until the
   * keyframe it asks for comes back.
   */
  ackFor(via: number, now: number): AckMsg | null {
    const p = this.peers.get(via);
    if (!p || !p.in.size) return null;
    const ok: Array<[number, number]> = [];
    const need: number[] = [];
    for (const [subject, s] of p.in) {
      if (s.ackSeq >= 0 && p.told.get(subject) !== s.ackSeq) ok.push([subject, s.ackSeq]);
      if (s.wantsKeyframe) need.push(subject);
    }
    const urgent = need.some((subject) => !p.asked.has(subject));
    if (!urgent && now < p.ackNext) return null;
    if (!ok.length && !need.length) return null;
    p.ackNext = now + 1 / ACK_HZ;
    p.asked = new Set(need);
    for (const [subject, seq] of ok) p.told.set(subject, seq);
    this.stats.acks++;
    if (need.length) this.stats.asks++;
    return withoutUndefined({ t: "sa", ok: ok.length ? ok : undefined, need: need.length ? need : undefined } as AckMsg);
  }

  /** an ack from `via`: its baselines move up, and anything it is stuck on goes whole next time */
  onAck(m: AckMsg, via: number): void {
    if (!this.enabled) {
      this.stats.unexpected++;
      return;
    }
    const p = this.peers.get(via);
    if (!p) return;
    const raw = m as unknown as Record<string, unknown>;
    if (Array.isArray(raw.ok)) {
      for (const pair of raw.ok) {
        if (!Array.isArray(pair) || pair.length < 2) continue;
        p.out.get(wireNum(pair[0], -1))?.ack(wireNum(pair[1], -1));
      }
    }
    if (Array.isArray(raw.need)) for (const subject of raw.need) p.out.get(wireNum(subject, -1))?.needKeyframe();
  }

  /** a peer's link is gone: everything to and from it */
  forgetPeer(id: number): void {
    this.peers.delete(id);
  }

  /**
   * A player is gone from the match: every stream about them, both ways.
   * Called for anyone who leaves, not only for a peer we held a link to, or
   * a stale stream would outlive them (the epoch makes that harmless, but
   * there is no reason to keep it).
   */
  forgetSubject(id: number): void {
    for (const p of this.peers.values()) {
      p.out.delete(id);
      p.in.delete(id);
      p.told.delete(id);
      p.asked.delete(id);
    }
  }

  private peer(id: number): PeerStreams {
    let p = this.peers.get(id);
    if (!p) {
      p = { deltas: false, out: new Map(), in: new Map(), ackNext: 0, told: new Map(), asked: new Set() };
      this.peers.set(id, p);
    }
    return p;
  }
}
