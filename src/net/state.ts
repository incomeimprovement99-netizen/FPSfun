// Delta compressed state packets.
//
// The match is a star: every guest sends its state to the host and the host
// passes it on to everyone else, so the host's UPLOAD pays for the whole
// lobby and is what caps how many people can play. The old packet made that
// worse than it had to be. It sent every field thirty times a second whether
// it had changed or not, including the player's name and their operator,
// which never change at all, and it sent position and look as JavaScript
// doubles, which print as seventeen digits to say where a figure is standing
// to the width of an atom. About 250 bytes, all of it, every tick.
//
// What goes out now is the difference from a state the far side has told us
// it applied, with the numbers rounded first to steps a person could not see
// (src/config/net.json). A player running in a straight line costs about 50
// bytes; a player standing still costs nothing at all until the next
// keyframe. The saving is not cleverness, it is that most of a state packet
// was never news.
//
// Three things make that safe over a link that can lose, delay or reorder a
// packet:
//
//   A keyframe every two seconds carries the whole state, so a peer that
//   missed the chain recovers by itself instead of drifting forever.
//
//   A difference is taken against a state the far side ACKNOWLEDGED, not
//   against the last one sent, so a lost packet in between costs nothing.
//   With no acknowledgement yet, every packet is a keyframe, which is the old
//   behaviour and is the right thing to fall back to.
//
//   A difference that cannot be applied is dropped and a keyframe is asked
//   for. The figure holds its last good pose for a fraction of a second,
//   which is the same thing it does when a packet is simply late. Nothing
//   half applied is ever handed to the game.
//
// The wire form is an object with short keys and NO NULLS, ever. See wire.ts
// for why that matters: a field that is absent means "unchanged" in a
// difference and "the sender does not have one" in a keyframe, and a field
// that has GONE is named in the clear mask rather than sent as a null, so
// absent, null and zero can never be confused for one another. A transport
// that turns undefined into null on the way (PeerJS does) still decodes
// correctly, because absent and null are read as the same thing.
import netCfg from "../config/net.json";
import type { AckMsg, DeltaMsg, StateMsg } from "./link";
import { absent, wireBytes, wireNum, wireStr, withoutUndefined } from "./wire";

/** the version of this format, announced in the hello and the welcome (link.ts) */
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
 * Every stream in a match starts on the same tick, so without this they would
 * all come due together and the host would send eleven whole states in one
 * tick every two seconds. The step is an irrational turn, which spreads a run
 * of consecutive ids more evenly than any fraction would.
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
}

/**
 * A state quantised for the wire. Short keys because a key is paid for on
 * every packet: x y z position in centimetres, aw ap yaw and pitch in tenths
 * of a degree, cr crouch, hp sh health and shield, al alive, w the gun, op the
 * operator, nm the name, rd ready, st stance, sp speed, sm shield size, dn
 * down, ad aim down sights, ac the hands' action, bt the practice aim bot.
 */
export type Quant = Record<string, number | string | undefined>;

/** the twelve a state always has, so a keyframe missing one of them is malformed */
const REQ_KEYS = ["x", "y", "z", "aw", "ap", "cr", "hp", "sh", "al", "w", "op", "nm"] as const;
/** the eight that come and go; their order IS the clear mask's bit order and cannot be shuffled */
const OPT_KEYS = ["rd", "st", "sp", "sm", "dn", "ad", "ac", "bt"] as const;
/**
 * The five sent as a difference from the baseline rather than outright. They
 * are the ones that change every tick and the ones with the widest range: a
 * player 300 m out is x 30000 in centimetres, but a tick of running is 15.
 * Everything else is already small, or is a string, and goes outright, which
 * keeps "it changed to this" and "it changed by this" from ever being the
 * same field.
 */
const DIFF_KEYS = new Set<string>(["x", "y", "z", "aw", "ap"]);

const wrap180 = (deg: number): number => ((((deg + 180) % 360) + 360) % 360) - 180;
const clip = (s: string, n: number): string => (s.length > n ? s.slice(0, n) : s);

/** a state rounded to the steps in the config, ready to be differenced */
export function quantise(s: PlayerState): Quant {
  const q: Quant = {
    x: Math.round(wireNum(s.x) / POS),
    y: Math.round(wireNum(s.y) / POS),
    z: Math.round(wireNum(s.z) / POS),
    aw: Math.round(wrap180(wireNum(s.yaw)) / ANG),
    ap: Math.round(Math.max(-90, Math.min(90, wireNum(s.pitch))) / ANG),
    cr: s.crouch ? 1 : 0,
    hp: Math.round(wireNum(s.hp) / HP),
    sh: Math.round(wireNum(s.sh) / HP),
    al: s.alive ? 1 : 0,
    w: clip(wireStr(s.w), ID_MAX),
    op: clip(wireStr(s.op), ID_MAX),
    nm: clip(wireStr(s.name), NAME_MAX),
  };
  // Present with a value, or not there at all. Writing `rd: undefined` here
  // would be the same bug this whole file is careful about: it survives the
  // local link and arrives as null over the real one.
  if (s.ready !== undefined) q.rd = s.ready ? 1 : 0;
  if (s.st !== undefined) q.st = Math.round(wireNum(s.st));
  if (s.sp !== undefined) q.sp = Math.round(wireNum(s.sp));
  if (s.shm !== undefined) q.sm = Math.round(wireNum(s.shm));
  if (s.dn !== undefined) q.dn = Math.round(wireNum(s.dn));
  if (s.ad !== undefined) q.ad = Math.round(wireNum(s.ad));
  if (s.ac !== undefined) q.ac = Math.round(wireNum(s.ac));
  if (s.bot !== undefined) q.bt = Math.round(wireNum(s.bot));
  return q;
}

/** back to the numbers the game reads, a step or less from where they started */
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
  return s;
}

/** every required field there, every number finite, every string short enough to be a real one */
export function wholeQuant(q: Quant): boolean {
  for (const k of REQ_KEYS) {
    const v = q[k];
    if (k === "w" || k === "op" || k === "nm") {
      if (typeof v !== "string" || v.length > STR_SANE) return false;
    } else if (typeof v !== "number" || !Number.isFinite(v)) return false;
  }
  for (const k of OPT_KEYS) {
    const v = q[k];
    if (!absent(v) && (typeof v !== "number" || !Number.isFinite(v))) return false;
  }
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
 * The baseline with a difference laid over it. A key that is there is the new
 * value (or, for the five difference fields, how much to move by); a key that
 * is not there, or arrived as null because of the transport, is unchanged; a
 * bit in the mask means the field is gone. A key we have never heard of is
 * ignored, which is how a newer build can add a field without breaking this
 * one.
 */
export function applyDiff(base: Quant, d: Quant, clear: number): Quant {
  const out: Quant = { ...base };
  for (const k of REQ_KEYS) {
    const v = d[k];
    if (absent(v)) continue;
    out[k] = DIFF_KEYS.has(k) ? wireNum(out[k]) + wireNum(v) : v;
  }
  for (let i = 0; i < OPT_KEYS.length; i++) {
    const k = OPT_KEYS[i];
    if (clear & (1 << i)) {
      delete out[k];
      continue;
    }
    const v = d[k];
    if (!absent(v)) out[k] = v;
  }
  return out;
}

/** what actually arrived, read with null and absent meaning the same thing */
function readDelta(m: DeltaMsg): { seq: number; base: number | undefined; clear: number; d: Quant } | null {
  // The wire is not typed, it is claimed: this is the one place the claim is
  // checked rather than believed.
  const raw = m as unknown as Record<string, unknown>;
  const seq = raw.q;
  if (typeof seq !== "number" || !Number.isFinite(seq)) return null;
  const b = raw.b;
  const body = raw.d;
  return {
    seq,
    // A keyframe says so by having no baseline at all. Testing for undefined
    // alone would read a keyframe that came through PeerJS as a difference
    // against baseline null, and the receiver would ask for a keyframe it had
    // already been given, forever.
    base: absent(b) ? undefined : wireNum(b, -1),
    clear: absent(raw.c) ? 0 : wireNum(raw.c),
    d: body && typeof body === "object" && !Array.isArray(body) ? (body as Quant) : {},
  };
}

/**
 * One outgoing stream: this end's view of one player, for one peer. Every
 * pair gets its own, because "what has this peer got" is a different question
 * for every peer.
 */
export class StateOut {
  private seq = 0;
  /** what each sent sequence left the far side holding, if it applies it */
  private sent = new Map<number, Quant>();
  /** the newest sequence the far side has said it applied; -1 until it says anything */
  private acked = -1;
  private keyAt = 0;
  private force = true;
  /** every packet this stream has put on the wire, and what they cost as JSON */
  packets = 0;
  bytes = 0;
  keyframes = 0;

  /** `phase` staggers this stream's keyframes against the others (keyframePhase) */
  constructor(private readonly phase = 0) {}

  /** a keyframe is due: the timer fired, or the far side asked, or there is no baseline to speak of */
  keyframeDue(now: number): boolean {
    return this.force || now >= this.keyAt || this.acked < 0 || !this.sent.has(this.acked);
  }

  /**
   * The packet for this tick, or null when nothing has changed since the far
   * side's last acknowledged state and no keyframe is due. `from` is the
   * player the state is about, left off when that is this end itself (which
   * is what the old "s" packet did, and what the receiver reads as "whoever
   * sent this").
   */
  encode(s: PlayerState, now: number, from?: number): DeltaMsg | null {
    const q = quantise(s);
    const key = this.keyframeDue(now);
    const seq = this.seq + 1;
    let msg: DeltaMsg;
    if (key) {
      msg = { t: "sd", from, q: seq, d: { ...q } };
    } else {
      // keyframeDue has already ruled out a missing baseline
      const base = this.sent.get(this.acked) as Quant;
      const { d, c } = diff(base, q);
      // A player standing still, not shooting, not turning: there is nothing
      // to say, so say nothing. The keyframe timer is the heartbeat that
      // keeps duel.ts from calling them silent and dropping them.
      if (c === 0 && Object.keys(d).length === 0) return null;
      msg = { t: "sd", from, q: seq, b: this.acked, c: c === 0 ? undefined : c, d };
    }
    this.seq = seq;
    this.sent.set(seq, q);
    this.prune();
    if (key) {
      this.force = false;
      this.keyAt = now + KEY_SECONDS * (1 - KEY_SPREAD + 2 * KEY_SPREAD * this.phase);
      this.keyframes++;
    }
    const out = withoutUndefined(msg);
    this.packets++;
    this.bytes += wireBytes(out);
    return out;
  }

  /** the far side applied this sequence, so differences can be taken from it */
  ack(seq: number): void {
    if (Number.isFinite(seq) && seq > this.acked && this.sent.has(seq)) {
      this.acked = seq;
      this.prune();
    }
  }

  /** the far side lost the chain: the next packet carries everything */
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
  private want = false;
  /** packets seen, and the ones that could not be used */
  packets = 0;
  stale = 0;
  broken = 0;

  /** the state this packet leaves the player in, or null when it cannot be used */
  decode(m: DeltaMsg): PlayerState | null {
    const r = readDelta(m);
    if (!r) return null;
    this.packets++;
    // Late or duplicate: we already hold something newer, and winding a
    // figure backwards is worse than ignoring the packet.
    if (r.seq <= this.newest) {
      this.stale++;
      return null;
    }
    let q: Quant;
    if (r.base === undefined) {
      q = { ...r.d };
      // A keyframe is the whole state by definition, so a missing field is a
      // malformed packet and not an absent one.
      if (!wholeQuant(q)) {
        this.broken++;
        return null;
      }
    } else {
      const base = this.applied.get(r.base);
      if (!base) {
        // The state it was built from is one we never had, or one that has
        // aged out. Nothing here can be rendered, so hold the last good pose
        // and ask for a keyframe.
        this.broken++;
        this.want = true;
        return null;
      }
      q = applyDiff(base, r.d, r.clear);
      if (!wholeQuant(q)) {
        this.broken++;
        this.want = true;
        return null;
      }
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

/** the ack a receiver owes a sender: what it applied, and what it is stuck on */
export function ackMsg(ok: Array<[number, number]>, need: number[]): AckMsg {
  return withoutUndefined({ t: "sa", ok: ok.length ? ok : undefined, need: need.length ? need : undefined } as AckMsg);
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
  return s;
}

/** a full "s" packet, which is what a peer that does not speak deltas still gets */
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
  } as StateMsg);
}
