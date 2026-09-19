// Delta compressed state packets: one player's state, for one peer.
//
// The match is a star: every guest sends its state to the host and the host
// passes it on to everyone else, so the host's UPLOAD pays for the whole
// lobby. The full state packet ("s" in link.ts) sends every field thirty
// times a second whether it changed or not, including the player's name and
// operator, which never change at all, and it sends position and look as
// JavaScript doubles, nine bytes each to say where a figure stands to the
// width of an atom.
//
// What goes out instead is the difference from a state the far side has told
// us it applied, with the numbers rounded first to steps nobody could see
// (src/config/net.json). A running player costs a handful of small integers;
// a player standing still costs nothing at all until the next keyframe.
//
// Three things make that safe on a link that could lose, delay or reorder a
// packet. The PeerJS data channel this game opens is reliable and ordered, so
// today none of that happens, but the rules below do not lean on it:
//
//   A keyframe every couple of seconds carries the whole state, so a peer
//   that lost the chain recovers by itself instead of drifting forever.
//
//   A difference is taken against a state the far side ACKNOWLEDGED, not
//   against the last one sent, so a lost packet in between costs nothing.
//   With no acknowledgement yet, every packet is a keyframe.
//
//   A difference that cannot be applied is refused whole and a keyframe is
//   asked for. The figure holds its last good pose meanwhile, which is what
//   it does when a packet is merely late. Nothing half applied is ever handed
//   to the game.
//
// The wire form has short keys and NO NULLS, ever. See wire.ts for why that
// matters: a field that is absent means "unchanged" in a difference and "the
// sender does not have one" in a keyframe, and a field that has GONE is named
// in the clear mask rather than sent as a null, so absent, null and zero can
// never be confused with one another. A transport that turns undefined into
// null on the way (PeerJS does) still decodes correctly, because absent and
// null are read as the same thing.
import netCfg from "../config/net.json";
import type { DeltaPart, StateMsg } from "./link";
import { absent, wireNum, wireStr, withoutUndefined } from "./wire";

/** the version of this format, announced on a player's own full packet (link.ts `dp`) */
export const STATE_PROTOCOL = netCfg.protocol;

const POS = netCfg.quantise.position;
const ANG = netCfg.quantise.angle;
const HP = netCfg.quantise.health;
const KEY_SECONDS = netCfg.keyframe.seconds;
const KEY_SPREAD = netCfg.keyframe.spread;
const PHASE_STEP = netCfg.keyframe.phaseStep;
const SENT_HISTORY = netCfg.keyframe.sentHistory;
const APPLIED_HISTORY = netCfg.keyframe.appliedHistory;

/**
 * Where in the keyframe interval a stream sits, from the player it is about.
 * Every stream in a match starts at about the same moment, so without this
 * they would all come due together and the host would send every whole state
 * in one tick every two seconds. The step is an irrational turn, which spreads
 * a run of consecutive ids more evenly than any fraction would.
 */
export function keyframePhase(subject: number): number {
  const p = (subject * PHASE_STEP) % 1;
  return p < 0 ? p + 1 : p;
}

/** longest a string field can be before the packet is treated as junk rather than a player */
const STR_SANE = 256;
/** what the game itself allows, clipped here so both ends hold the same baseline */
const NAME_MAX = 16;
const ID_MAX = 32;

/**
 * One player's state, as duel.ts has always sent it: the payload of the "s"
 * message without the routing on it. The optional fields are genuinely
 * optional, and which of them a sender fills in says something (a bot sends
 * no shield size, a player not aiming sends no `ad`), so "absent" has to
 * survive the round trip unchanged.
 */
export interface PlayerState {
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
  op: string;
  name: string;
  ready?: boolean;
  st?: number;
  sp?: number;
  shm?: number;
  dn?: number;
  ad?: number;
  ac?: number;
  bot?: number;
  /** the sender's clock when it made this state: milliseconds, the low 16 bits (senderStamp) */
  tm?: number;
}

/** the sender's clock for a state: performance time in milliseconds, the low 16 bits (the receiver unwraps it) */
export function senderStamp(): number {
  return Math.round(performance.now()) & 0xffff;
}

/**
 * A state quantised for the wire. Short keys because a key is paid for on
 * every packet: x y z position in centimetres, aw ap yaw and pitch in tenths
 * of a degree, cr crouch, hp sh health and shield, al alive, w the gun, op the
 * operator, nm the name, rd ready, st stance, sp speed, sm shield size, dn
 * down, ad aim down sights, ac the hands' action, bt the practice aim bot.
 */
export type Quant = Record<string, number | string>;

/** the twelve a state always has, so a keyframe missing one of them is malformed */
const REQ_KEYS = ["x", "y", "z", "aw", "ap", "cr", "hp", "sh", "al", "w", "op", "nm"] as const;
/**
 * The ones that come and go; their order IS the clear mask's bit order and
 * cannot be shuffled, only added to at the end. `tm` (the sender's clock) came
 * last: an older build ignores a key it does not know, and it is never
 * cleared, so it never sets a bit an older build would misread.
 */
const OPT_KEYS = ["rd", "st", "sp", "sm", "dn", "ad", "ac", "bt", "tm"] as const;
/** the three that are text; everything else is a finite number */
const STR_KEYS = new Set<string>(["w", "op", "nm"]);
/**
 * The five sent as a difference from the baseline rather than outright. They
 * are the ones that change every tick and the ones with the widest range: a
 * player 300 m out is x 30000 in centimetres, but a tick of running is 20.
 * Everything else is already small, or is a string, and goes outright, which
 * keeps "it changed to this" and "it changed by this" from ever being the
 * same field.
 */
const DIFF_KEYS = new Set<string>(["x", "y", "z", "aw", "ap"]);

const wrap180 = (deg: number): number => ((((deg + 180) % 360) + 360) % 360) - 180;
const clip = (s: string, n: number): string => (s.length > n ? s.slice(0, n) : s);
/**
 * Health and shield in whole points, except that a sliver is never rounded
 * away: main.ts reads "health above zero" as "still up" for the KNOCKED DOWN
 * marker and "shield above zero" for the damage colour, so 0.4 left has to
 * arrive as something rather than as nothing.
 */
const points = (v: number): number => {
  const n = Math.round(v / HP);
  return v > 0 && n < 1 ? 1 : n;
};

/** a state rounded to the steps in the config, ready to be differenced */
export function quantise(s: PlayerState): Quant {
  const q: Quant = {
    x: Math.round(wireNum(s.x) / POS),
    y: Math.round(wireNum(s.y) / POS),
    z: Math.round(wireNum(s.z) / POS),
    aw: Math.round(wrap180(wireNum(s.yaw)) / ANG),
    ap: Math.round(Math.max(-90, Math.min(90, wireNum(s.pitch))) / ANG),
    cr: s.crouch ? 1 : 0,
    hp: points(wireNum(s.hp)),
    sh: points(wireNum(s.sh)),
    al: s.alive ? 1 : 0,
    w: clip(wireStr(s.w), ID_MAX),
    op: clip(wireStr(s.op), ID_MAX),
    nm: clip(wireStr(s.name), NAME_MAX),
  };
  // Present with a value, or not there at all. Writing `rd: undefined` here
  // would be the same bug this whole file is careful about: it survives the
  // local link and arrives as null over the real one.
  if (!absent(s.ready)) q.rd = s.ready ? 1 : 0;
  if (!absent(s.st)) q.st = Math.round(wireNum(s.st));
  if (!absent(s.sp)) q.sp = Math.round(wireNum(s.sp));
  if (!absent(s.shm)) q.sm = Math.round(wireNum(s.shm));
  if (!absent(s.dn)) q.dn = Math.round(wireNum(s.dn));
  if (!absent(s.ad)) q.ad = Math.round(wireNum(s.ad));
  if (!absent(s.ac)) q.ac = Math.round(wireNum(s.ac));
  if (!absent(s.bot)) q.bt = Math.round(wireNum(s.bot));
  if (!absent(s.tm)) q.tm = Math.round(wireNum(s.tm)) & 0xffff;
  return q;
}

/** back to the numbers the game reads, half a step or less from where they started */
export function dequantise(q: Quant): PlayerState {
  const s: PlayerState = {
    x: wireNum(q.x) * POS,
    y: wireNum(q.y) * POS,
    z: wireNum(q.z) * POS,
    yaw: wireNum(q.aw) * ANG,
    pitch: wireNum(q.ap) * ANG,
    crouch: wireNum(q.cr) === 1,
    w: clip(wireStr(q.w), ID_MAX),
    hp: wireNum(q.hp) * HP,
    sh: wireNum(q.sh) * HP,
    alive: wireNum(q.al) === 1,
    op: clip(wireStr(q.op), ID_MAX),
    name: clip(wireStr(q.nm), NAME_MAX),
  };
  if (!absent(q.rd)) s.ready = wireNum(q.rd) === 1;
  if (!absent(q.st)) s.st = wireNum(q.st);
  if (!absent(q.sp)) s.sp = wireNum(q.sp);
  if (!absent(q.sm)) s.shm = wireNum(q.sm);
  if (!absent(q.dn)) s.dn = wireNum(q.dn);
  if (!absent(q.ad)) s.ad = wireNum(q.ad);
  if (!absent(q.ac)) s.ac = wireNum(q.ac);
  if (!absent(q.bt)) s.bot = wireNum(q.bt);
  if (!absent(q.tm)) s.tm = wireNum(q.tm);
  return s;
}

/** a value the codec can hold for this key: a short string for the text fields, a finite number for the rest */
function fits(k: string, v: unknown): boolean {
  return STR_KEYS.has(k) ? typeof v === "string" && v.length <= STR_SANE : typeof v === "number" && Number.isFinite(v);
}

/** every required field there and the right kind, every optional one absent or the right kind */
export function wholeQuant(q: Record<string, unknown>): boolean {
  for (const k of REQ_KEYS) if (!fits(k, q[k])) return false;
  for (const k of OPT_KEYS) if (!absent(q[k]) && !fits(k, q[k])) return false;
  return true;
}

/** the difference between two quantised states, and the mask of what has gone away */
export function diff(base: Quant, now: Quant): { d: Quant; c: number } {
  const d: Quant = {};
  let c = 0;
  for (const k of REQ_KEYS) {
    if (DIFF_KEYS.has(k)) {
      const by = wireNum(now[k]) - wireNum(base[k]);
      if (by !== 0) d[k] = by;
    } else if (base[k] !== now[k]) d[k] = now[k];
  }
  for (let i = 0; i < OPT_KEYS.length; i++) {
    const k = OPT_KEYS[i];
    const had = base[k];
    const has = now[k];
    // Gone is said in the mask, never by leaving the key out: leaving it out
    // is what "unchanged" means, and a figure that is no longer aiming would
    // otherwise keep its old aim forever.
    if (absent(has)) {
      if (!absent(had)) c |= 1 << i;
      continue;
    }
    if (had !== has) d[k] = has;
  }
  return { d, c };
}

/**
 * The baseline with a difference laid over it, or null when the difference
 * holds something that is not a value (which is refused whole rather than
 * half applied). A key that is there is the new value (or, for the five
 * difference fields, how much to move by); a key that is not there, or
 * arrived as null because of the transport, is unchanged; a bit in the mask
 * means the field is gone. A key we have never heard of is ignored, which is
 * how a newer build can add a field without breaking this one.
 */
export function applyDiff(base: Quant, d: Record<string, unknown>, clear: number): Quant | null {
  const out: Quant = { ...base };
  for (const k of REQ_KEYS) {
    const v = d[k];
    if (absent(v)) continue;
    if (!fits(k, v)) return null;
    out[k] = DIFF_KEYS.has(k) ? wireNum(out[k]) + (v as number) : (v as number | string);
  }
  for (let i = 0; i < OPT_KEYS.length; i++) {
    const k = OPT_KEYS[i];
    if (clear & (1 << i)) {
      delete out[k];
      continue;
    }
    const v = d[k];
    if (absent(v)) continue;
    if (!fits(k, v)) return null;
    out[k] = v as number;
  }
  return out;
}

/** a part as it arrived, read with null and absent meaning the same thing, or null when it is not one */
function readPart(p: unknown): { seq: number; base: number | undefined; epoch: number; clear: number; d: Record<string, unknown> } | null {
  // The wire is not typed, it is claimed: this is the one place the claim is
  // checked rather than believed.
  if (!p || typeof p !== "object" || Array.isArray(p)) return null;
  const raw = p as Record<string, unknown>;
  const seq = raw.q;
  if (typeof seq !== "number" || !Number.isFinite(seq)) return null;
  const body = raw.d;
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  return {
    seq,
    // A keyframe says so by having no baseline at all. Testing for undefined
    // alone would read a keyframe that came through PeerJS as a difference
    // against baseline null, and the receiver would ask for a keyframe it had
    // already been given, forever.
    base: absent(raw.b) ? undefined : wireNum(raw.b, -1),
    epoch: wireNum(raw.e, 0),
    clear: absent(raw.c) ? 0 : wireNum(raw.c),
    d: body as Record<string, unknown>,
  };
}

/**
 * One outgoing stream: this end's view of one player, for one peer. Every
 * pair gets its own, because "what has this peer got" is a different question
 * for every peer.
 */
export class StateOut {
  private seq = 0;
  /** what each sent sequence left the far side holding, if it applied it */
  private sent = new Map<number, Quant>();
  /** the newest sequence the far side has said it applied; -1 until it says anything */
  private acked = -1;
  private keyAt = 0;
  private force = true;
  /** every part this stream has put on the wire */
  parts = 0;
  keyframes = 0;

  /**
   * `phase` staggers this stream's keyframes against the others
   * (keyframePhase). `epoch` names this stream: a stream that starts again
   * for the same player and peer (they left and came back, say) takes a new
   * one, and a receiver still holding the old stream's sequences takes the
   * new keyframe as a fresh start instead of as a late packet.
   */
  constructor(
    private readonly phase = 0,
    readonly epoch = 0
  ) {}

  /** a keyframe is due: the timer fired, or the far side asked, or there is no baseline to speak of */
  keyframeDue(now: number): boolean {
    return this.force || now >= this.keyAt || this.acked < 0 || !this.sent.has(this.acked);
  }

  /**
   * The part for this state, or null when nothing has changed since the far
   * side's last acknowledged state and no keyframe is due. `subject` is the
   * player the state is about, left off when that is this end itself (which
   * is what the full packet does, and what the receiver reads as "whoever
   * sent this").
   */
  encode(s: PlayerState, now: number, subject?: number): DeltaPart | null {
    const q = quantise(s);
    const key = this.keyframeDue(now);
    const seq = this.seq + 1;
    let part: DeltaPart;
    if (key) {
      part = { f: subject, q: seq, e: this.epoch, d: { ...q } };
    } else {
      // keyframeDue has already ruled out a missing baseline
      const base = this.sent.get(this.acked) as Quant;
      const { d, c } = diff(base, q);
      // A player standing still, not shooting, not turning: there is nothing
      // to say, so say nothing. The keyframe timer is the heartbeat that
      // keeps duel.ts from calling them silent and dropping them. The clock
      // changes every tick and is not news on its own.
      if (c === 0 && Object.keys(d).every((k) => k === "tm")) return null;
      part = { f: subject, q: seq, b: this.acked, c: c === 0 ? undefined : c, d };
    }
    this.seq = seq;
    this.sent.set(seq, q);
    this.prune();
    if (key) {
      this.force = false;
      this.keyAt = now + KEY_SECONDS * (1 - KEY_SPREAD + 2 * KEY_SPREAD * this.phase);
      this.keyframes++;
    }
    this.parts++;
    return withoutUndefined(part);
  }

  /** the far side applied this sequence, so differences can be taken from it */
  ack(seq: number): void {
    if (Number.isFinite(seq) && seq > this.acked && this.sent.has(seq)) {
      this.acked = seq;
      this.prune();
    }
  }

  /** the far side lost the chain: the next part carries everything */
  needKeyframe(): void {
    this.force = true;
  }

  private prune(): void {
    // Anything older than the acknowledged state can never be a baseline
    // again. The size cap is the backstop for a peer that stops acknowledging
    // at all, which is also the peer that is getting keyframes anyway.
    for (const seq of this.sent.keys()) {
      if (seq < this.acked || this.sent.size > SENT_HISTORY) this.sent.delete(seq);
      else break;
    }
  }
}

/** one incoming stream: one player, as told to us by one peer */
export class StateIn {
  /** what each applied sequence left us holding, so a difference against an older one still lands */
  private applied = new Map<number, Quant>();
  private newest = -1;
  private epoch: number | null = null;
  private want = false;
  /** parts seen, the ones that came too late, and the ones that could not be used */
  parts = 0;
  stale = 0;
  broken = 0;

  /** the state this part leaves the player in, or null when it cannot be used */
  decode(p: unknown): PlayerState | null {
    const r = readPart(p);
    if (!r) {
      this.broken++;
      return null;
    }
    this.parts++;
    // A keyframe from a stream we have not been following (the first one, or
    // the same player's stream begun again) starts the count over: what we
    // held from the old stream is no use, and would make every new packet
    // look late. Anything else is late or a repeat when we already hold
    // something newer, and winding a figure backwards is worse than ignoring
    // the packet.
    const fresh = r.base === undefined && r.epoch !== this.epoch;
    if (!fresh && r.seq <= this.newest) {
      this.stale++;
      return null;
    }
    let q: Quant | null;
    if (r.base === undefined) {
      // A keyframe is the whole state by definition, so a missing field is a
      // malformed packet and not an absent one. Laid over nothing, it keeps
      // exactly the fields this build knows and leaves a newer build's out.
      q = wholeQuant(r.d) ? applyDiff({}, r.d, 0) : null;
      // only a keyframe that is whole gets to throw away what we held
      if (q && fresh) {
        this.applied.clear();
        this.newest = -1;
        this.epoch = r.epoch;
      }
    } else {
      const base = this.applied.get(r.base);
      if (!base) {
        // The state it was built from is one we never had, or one that has
        // aged out. Nothing here can be drawn, so hold the last good pose and
        // ask for a keyframe.
        this.broken++;
        this.want = true;
        return null;
      }
      q = applyDiff(base, r.d, r.clear);
    }
    if (!q || !wholeQuant(q)) {
      this.broken++;
      this.want = true;
      return null;
    }
    this.applied.set(r.seq, q);
    this.newest = r.seq;
    this.want = false;
    while (this.applied.size > APPLIED_HISTORY) {
      const oldest = this.applied.keys().next();
      if (oldest.done) break;
      this.applied.delete(oldest.value);
    }
    return dequantise(q);
  }

  /** the newest sequence we managed to apply, which is what the sender should difference against */
  get ackSeq(): number {
    return this.newest;
  }

  /** we are stuck and need the whole state again */
  get wantsKeyframe(): boolean {
    return this.want;
  }
}

/** the state inside a full "s" packet, read the null safe way an old sender needs */
export function stateOf(m: StateMsg): PlayerState {
  const raw = m as unknown as Record<string, unknown>;
  const s: PlayerState = {
    x: wireNum(raw.x),
    y: wireNum(raw.y),
    z: wireNum(raw.z),
    yaw: wireNum(raw.yaw),
    pitch: wireNum(raw.pitch),
    crouch: raw.crouch === true,
    w: clip(wireStr(raw.w), ID_MAX),
    hp: wireNum(raw.hp),
    sh: wireNum(raw.sh),
    alive: raw.alive === true,
    op: clip(wireStr(raw.op), ID_MAX),
    name: clip(wireStr(raw.name), NAME_MAX),
  };
  if (!absent(raw.ready)) s.ready = raw.ready === true;
  if (!absent(raw.st)) s.st = wireNum(raw.st);
  if (!absent(raw.sp)) s.sp = wireNum(raw.sp);
  if (!absent(raw.shm)) s.shm = wireNum(raw.shm);
  if (!absent(raw.dn)) s.dn = wireNum(raw.dn);
  if (!absent(raw.ad)) s.ad = wireNum(raw.ad);
  if (!absent(raw.ac)) s.ac = wireNum(raw.ac);
  if (!absent(raw.bot)) s.bot = wireNum(raw.bot);
  if (!absent(raw.tm)) s.tm = wireNum(raw.tm);
  return s;
}

/** a full "s" packet for a state: what a decoded part becomes before duel.ts reads it, and what an older peer is sent */
export function stateMsg(s: PlayerState, from?: number): StateMsg {
  return withoutUndefined({
    t: "s",
    from,
    x: s.x,
    y: s.y,
    z: s.z,
    yaw: s.yaw,
    pitch: s.pitch,
    crouch: s.crouch,
    w: s.w,
    hp: s.hp,
    sh: s.sh,
    alive: s.alive,
    op: s.op,
    name: s.name,
    ready: s.ready,
    st: s.st,
    sp: s.sp,
    shm: s.shm,
    dn: s.dn,
    ad: s.ad,
    ac: s.ac,
    bot: s.bot,
    tm: s.tm,
  } as StateMsg);
}
