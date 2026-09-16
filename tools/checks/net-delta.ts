// Delta compressed state packets (src/config/net.json, src/net/state.ts,
// src/net/statesync.ts).
//
// Two things are checked here and they are not the same thing. The first is
// that the codec is HONEST: everything that goes in comes out again within a
// quantisation step, a difference laid over the right baseline rebuilds the
// state exactly, and nothing partly applied is ever handed back to the game.
// The second is that it is honest over the REAL link, which is a separate
// question this project has already paid for once. PeerJS packs its messages
// with a binary encoder that has no undefined, so a field left undefined
// arrives at the other browser as null, and the local BroadcastChannel
// transport used for testing keeps undefined exactly as it was and hides it.
// A delta format is built entirely on the difference between "absent",
// "null" and "zero", so every decode below is run over BOTH transports and
// has to give the same answer.
//
// The last section is the reason the feature exists at all: the same lobby,
// measured with the codec on and off, because the host's upload is what caps
// how many people can play.
//
// Run on its own: npx tsx tools/checks/net-delta.ts. Also runs inside
// npm run verify.
import { readFileSync } from "node:fs";
import netCfg from "../../src/config/net.json";
import type { DeltaMsg, NetMsg } from "../../src/net/link";
import { PlayerState, STATE_PROTOCOL, StateIn, StateOut, applyDiff, dequantise, diff, quantise, stateMsg, stateOf } from "../../src/net/state";
import { StateSync, type Subject } from "../../src/net/statesync";
import { absent, wireBytes, withoutUndefined } from "../../src/net/wire";

let fails = 0;
function check(label: string, ok: boolean, detail = ""): void {
  if (!ok) fails++;
  console.log(`${ok ? "  ok  " : "FAIL  "}${label}${detail ? ` (${detail})` : ""}`);
}

console.log("\nDelta compressed state packets");

// ---------------------------------------------------------- the two transports

/** the local link: a structured clone, which keeps undefined exactly as it was */
function asLocal<T>(v: T): T {
  if (Array.isArray(v)) return v.map((x) => asLocal(x)) as T;
  if (v && typeof v === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(v as Record<string, unknown>)) out[k] = asLocal(x);
    return out as T;
  }
  return v;
}

/** the real link: PeerJS packs binary, and binary has no undefined, so it becomes null */
function asPeerJs<T>(v: T): T {
  if (v === undefined) return null as T;
  if (Array.isArray(v)) return v.map((x) => asPeerJs(x)) as T;
  if (v && typeof v === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(v as Record<string, unknown>)) out[k] = asPeerJs(x);
    return out as T;
  }
  return v;
}

/** anywhere in a message that a null got through */
function nullsIn(v: unknown, path = ""): string[] {
  if (v === null) return [path || "(root)"];
  if (Array.isArray(v)) return v.flatMap((x, i) => nullsIn(x, `${path}[${i}]`));
  if (v && typeof v === "object") return Object.entries(v as Record<string, unknown>).flatMap(([k, x]) => nullsIn(x, path ? `${path}.${k}` : k));
  return [];
}

const sameState = (a: PlayerState | null, b: PlayerState | null): boolean => JSON.stringify(a) === JSON.stringify(b);

/** how far apart two angles are, the short way round (JavaScript's % keeps its sign) */
const apart = (a: number, b: number): number => Math.abs(((((a - b) % 360) + 540) % 360) - 180);

/** a player who is running, turning, and aiming for half of every second */
function sample(i: number, tick: number): PlayerState {
  const a = i * 0.7 + tick * 0.03;
  const r = 20 + i * 12;
  return {
    x: Math.cos(a) * r,
    y: 1.62 + (i % 2 === 0 ? 0 : Math.sin(tick * 0.11) * 0.3),
    z: Math.sin(a) * r,
    yaw: (a * 180) / Math.PI,
    pitch: Math.sin(tick * 0.07) * 18,
    crouch: tick % 97 === 0,
    w: "rspn101",
    hp: 100,
    sh: 50,
    alive: true,
    op: "wraith",
    name: `PLAYER ${i + 1}`,
    ready: true,
    st: 0,
    sp: 45,
    shm: 50,
    dn: 0,
    // half a second aiming, half a second not: the field genuinely comes and
    // goes, which is what the clear mask is for
    ad: tick % 60 < 30 ? 10 : undefined,
  };
}

// --------------------------------------------------------------- the config

check(
  "the config carries its own notes",
  Boolean(netCfg._note && netCfg._protocol && netCfg._quantise && netCfg._keyframe && netCfg._rate && netCfg._budget),
  `${Object.keys(netCfg).filter((k) => k.startsWith("_")).length} notes`
);

check(
  "a centimetre of position and a tenth of a degree of look",
  netCfg.quantise.position === 0.01 && netCfg.quantise.angle === 0.1 && netCfg.quantise.health === 1,
  `${netCfg.quantise.position} m, ${netCfg.quantise.angle} deg, ${netCfg.quantise.health} hp`
);

// A player standing perfectly still says nothing at all between keyframes, so
// the keyframe interval IS the heartbeat duel.ts's SILENCE_LIMIT is watching.
check(
  "the keyframe heartbeat is well inside duel.ts's ten second silence limit",
  netCfg.keyframe.seconds > 0 && netCfg.keyframe.seconds <= 4,
  `${netCfg.keyframe.seconds} s between keyframes, dropped at 10 s`
);

// duel.ts draws every figure INTERP_DELAY (0.1 s) behind and clamps between
// the two samples around that time, so a band slower than 10 Hz would leave a
// distant figure sitting on its last sample instead of moving.
const slowest = Math.min(...netCfg.rate.bands.map((b) => b[1]));
check("even the furthest band still interpolates rather than freezing", slowest > 10, `slowest band ${slowest} Hz, interpolation is 0.1 s behind`);

let bandsOrdered = true;
for (let i = 1; i < netCfg.rate.bands.length; i++) {
  if (netCfg.rate.bands[i][0] <= netCfg.rate.bands[i - 1][0] || netCfg.rate.bands[i][1] > netCfg.rate.bands[i - 1][1]) bandsOrdered = false;
}
check("the bands go out and down, in that order", bandsOrdered, netCfg.rate.bands.map((b) => `${b[0]}m@${b[1]}Hz`).join(", "));

// ------------------------------------------------------------ quantisation

{
  const s = sample(3, 11);
  const back = dequantise(quantise(s));
  const posErr = Math.max(Math.abs(back.x - s.x), Math.abs(back.y - s.y), Math.abs(back.z - s.z));
  const angErr = apart(back.yaw, s.yaw);
  check("a position survives the round trip within half a step", posErr <= netCfg.quantise.position / 2 + 1e-9, `${(posErr * 1000).toFixed(2)} mm`);
  check("and a look angle within half a step", angErr <= netCfg.quantise.angle / 2 + 1e-9, `${angErr.toFixed(4)} deg`);
  check(
    "and everything that is not a number comes back untouched",
    back.w === s.w && back.op === s.op && back.name === s.name && back.alive === s.alive && back.crouch === s.crouch && back.hp === s.hp && back.sh === s.sh
  );
}

{
  // yaw is wrapped so the integer on the wire cannot grow without bound; the
  // angle it names has to be the same one either way
  const spun = dequantise(quantise({ ...sample(0, 0), yaw: 725 }));
  check("a yaw that has wound round many times still means the same angle", apart(spun.yaw, 725) < 0.06, `${spun.yaw.toFixed(1)} for 725`);
}

// ------------------------------------------- absent, null and zero are three things

{
  const aiming = quantise({ ...sample(0, 0), ad: 5 });
  const lowered = quantise({ ...sample(0, 0), ad: 0 });
  const gone = quantise({ ...sample(0, 0), ad: undefined });
  const same = quantise({ ...sample(0, 0), ad: 5 });

  const toZero = diff(aiming, lowered);
  check("aiming at zero is SENT, because zero is a value", toZero.d.ad === 0 && toZero.c === 0, `d.ad ${String(toZero.d.ad)}, mask ${toZero.c}`);

  const toGone = diff(aiming, gone);
  check("aiming that has gone away is CLEARED, not left out", toGone.d.ad === undefined && toGone.c === 32, `mask ${toGone.c}`);

  const unchanged = diff(aiming, same);
  check("aiming that has not changed is LEFT OUT, and clears nothing", unchanged.d.ad === undefined && unchanged.c === 0);

  // The mask's bits are the wire's, so the order of OPT_KEYS in state.ts is
  // load bearing: shuffling it would silently clear the wrong field on a
  // build that had not been updated.
  const bits = ["ready", "st", "sp", "shm", "dn", "ad", "ac", "bot"].map((k, i) => {
    const before = quantise({ ...sample(0, 0), [k]: 1 } as PlayerState);
    const after = quantise({ ...sample(0, 0), [k]: undefined } as PlayerState);
    return diff(before, after).c === 1 << i;
  });
  check("each optional field clears its own bit and nobody else's", bits.every(Boolean), `${bits.filter(Boolean).length} of 8`);

  // The three of them, applied: zero arrives as zero, gone arrives as gone,
  // unchanged keeps what it had.
  check("and applying them gives zero, gone and unchanged, in that order", applyDiff(aiming, toZero.d, toZero.c).ad === 0 && applyDiff(aiming, toGone.d, toGone.c).ad === undefined && applyDiff(aiming, unchanged.d, unchanged.c).ad === 5);
}

// ------------------------------------------------- the same answer on both links

{
  const out = new StateOut();
  const first = out.encode(sample(1, 0), 0);
  check("the first packet a stream sends is a whole keyframe", Boolean(first && first.b === undefined && Object.keys(first.d).length >= 12), first ? `${Object.keys(first.d).length} fields` : "nothing sent");

  const sent: DeltaMsg[] = [];
  const outB = new StateOut();
  const inB = new StateIn();
  let anyNull = "";
  let disagreed = "";
  for (let tick = 0; tick < 120; tick++) {
    const m = outB.encode(sample(1, tick), tick / 30);
    if (!m) continue;
    sent.push(m);
    const bad = nullsIn(m);
    if (bad.length) anyNull = bad.join(", ");
    // the same packet down both transports, decoded by two identical
    // receivers: if they ever differ, the local link is hiding something
    const local = new StateIn();
    const peer = new StateIn();
    for (const old of sent) {
      local.decode(asLocal(old));
      peer.decode(asPeerJs(old));
    }
    if (!sameState(local.decode(asLocal(m)) ?? null, peer.decode(asPeerJs(m)) ?? null)) disagreed = `tick ${tick}`;
    const applied = inB.decode(asPeerJs(m));
    if (applied) outB.ack(m.q);
  }
  check("nothing the encoder puts on the wire is ever null", !anyNull, anyNull || `${sent.length} packets, ${sent.reduce((n, m) => n + wireBytes(m), 0)} bytes`);
  check("the local link and the real one decode to exactly the same state", !disagreed, disagreed || "120 ticks, packet for packet");
}

{
  // The trap this project has already been caught by, in its exact shape: a
  // keyframe says so by having NO baseline, and an absent field arrives from
  // PeerJS as null. Reading that as "a difference against baseline null" gives
  // a receiver that asks forever for a keyframe it has already been handed.
  const out = new StateOut();
  const key = out.encode(sample(2, 0), 0) as DeltaMsg;
  const nulled = { ...key, b: null, c: null, from: null } as unknown as DeltaMsg;
  const clean = new StateIn().decode(key);
  const mangled = new StateIn().decode(nulled);
  check("a keyframe whose absent baseline arrived as null is still read as a keyframe", Boolean(mangled) && sameState(clean, mangled));

  // And the same inside the body: a value that turned into null means
  // "unchanged since the baseline", never "this field is now null". The
  // baseline here is a keyframe with ad 7, and the difference over it changes
  // ad to 3; mangled to null it has to leave the 7 alone.
  const held = new StateOut();
  const inn = new StateIn();
  const base = held.encode({ ...sample(2, 0), ad: 7 }, 0) as DeltaMsg;
  inn.decode(base);
  held.ack(base.q);
  const change = held.encode({ ...sample(2, 1), ad: 3 }, 1 / 30) as DeltaMsg;
  check("a difference really does carry the field that changed", change.b === base.q && change.d.ad === 3, `ad ${String(change.d.ad)}`);
  const withNull = { ...change, d: { ...change.d, ad: null } } as unknown as DeltaMsg;
  const got = inn.decode(withNull);
  check("a field that arrived as null is read as unchanged, not as a new value", got?.ad === 7, `ad ${String(got?.ad)}`);
}

// ------------------------------------------------------- loss, reorder, recovery

{
  const out = new StateOut();
  const inn = new StateIn();
  const packets: DeltaMsg[] = [];
  for (let tick = 0; tick < 8; tick++) {
    const m = out.encode(sample(4, tick), tick / 30);
    if (!m) continue;
    packets.push(m);
    // acknowledge everything, so packets 2 onwards really are differences
    out.ack(m.q);
  }
  check("after the first keyframe the rest are differences", packets.length > 2 && packets.slice(1).every((m) => m.b !== undefined), `${packets.length} packets`);

  // in order: every one of them lands
  let landed = 0;
  for (const m of packets) if (inn.decode(asPeerJs(m))) landed++;
  check("in order, every packet applies", landed === packets.length, `${landed} of ${packets.length}`);

  // a packet that arrives twice, and one that arrives late, must not wind the
  // figure backwards
  const replay = inn.decode(asPeerJs(packets[packets.length - 1]));
  const rewind = inn.decode(asPeerJs(packets[1]));
  check("a duplicate and a late packet are both ignored rather than applied", replay === null && rewind === null);
}

{
  // The real failure: a difference whose baseline this receiver never had.
  // Nothing half applied may reach the game, and the stream has to say it is
  // stuck so a keyframe can be asked for.
  const out = new StateOut();
  const inn = new StateIn();
  const key = out.encode(sample(5, 0), 0) as DeltaMsg;
  out.ack(key.q);
  const d1 = out.encode(sample(5, 1), 1 / 30) as DeltaMsg;
  out.ack(d1.q);
  const d2 = out.encode(sample(5, 2), 2 / 30) as DeltaMsg;
  // the receiver never sees the keyframe or d1
  const orphan = inn.decode(asPeerJs(d2));
  check("a difference with a baseline we never had is refused outright", orphan === null);
  check("and the stream says so, instead of drawing something wrong", inn.wantsKeyframe);

  out.needKeyframe();
  const recover = out.encode(sample(5, 3), 3 / 30) as DeltaMsg;
  check("asking gets the whole state back", recover.b === undefined);
  const back = inn.decode(asPeerJs(recover));
  check("and the figure is whole again, one keyframe later", Boolean(back) && !inn.wantsKeyframe);
}

{
  // Somebody who starts listening in the middle, with nobody to ask. A host
  // that passes a guest's packets straight along rather than decoding and
  // re-encoding them puts the other guests in exactly this position, and so
  // does a request for a keyframe that never arrives. The stream is
  // acknowledged and therefore sending differences, so every packet the
  // latecomer sees is one it cannot use, until the keyframe timer comes round
  // by itself. That is what makes "wait for the next keyframe" a promise
  // rather than a hope.
  const out = new StateOut();
  const acking = new StateIn();
  const late = new StateIn();
  let refused = 0;
  let recovered = -1;
  for (let tick = 0; tick <= 30 * 6; tick++) {
    const now = tick / 30;
    const m = out.encode(sample(6, tick), now);
    if (!m) continue;
    if (acking.decode(asPeerJs(m))) out.ack(m.q);
    if (tick < 20) continue;
    if (late.decode(asPeerJs(m))) {
      if (recovered < 0) recovered = tick;
    } else if (recovered < 0) refused++;
  }
  check("a latecomer refuses every difference it cannot use", refused > 0, `${refused} refused before it caught up`);
  check(
    "and recovers on the keyframe timer alone, without asking for anything",
    recovered > 20 && (recovered - 20) / 30 <= netCfg.keyframe.seconds * (1 + netCfg.keyframe.spread) + 0.1,
    `${((recovered - 20) / 30).toFixed(2)} s, with keyframes every ${netCfg.keyframe.seconds} s`
  );
}

{
  // A player who is not moving is news to nobody.
  const out = new StateOut();
  const still = sample(7, 0);
  out.encode(still, 0);
  out.ack(1);
  let spoke = 0;
  for (let tick = 1; tick < 30; tick++) if (out.encode(still, tick / 30)) spoke++;
  check("a player standing still costs nothing between keyframes", spoke === 0, `${spoke} packets in a second of standing still`);
}

{
  // A peer that never acknowledges anything (an old build, a broken ack path)
  // gets keyframes rather than differences against a baseline it might not
  // have. That is the old cost, which is the right thing to fall back to.
  const out = new StateOut();
  const inn = new StateIn();
  let allWhole = true;
  let landedEvery = true;
  for (let tick = 0; tick < 60; tick++) {
    const m = out.encode(sample(1, tick), tick / 30);
    if (!m) continue;
    if (m.b !== undefined) allWhole = false;
    if (!inn.decode(asPeerJs(m))) landedEvery = false;
  }
  check("a peer that acknowledges nothing gets keyframes, never a guess", allWhole && landedEvery);
}

// ------------------------------------------------------ a malformed packet

{
  const out = new StateOut();
  const key = out.encode(sample(1, 0), 0) as DeltaMsg;
  const missing = { ...key, d: { ...key.d, hp: undefined } } as unknown as DeltaMsg;
  const notNumber = { ...key, d: { ...key.d, x: "over there" } } as unknown as DeltaMsg;
  const noSeq = { ...key, q: undefined } as unknown as DeltaMsg;
  check("a keyframe missing a required field is dropped whole", new StateIn().decode(missing) === null);
  check("and one carrying a number that is not a number", new StateIn().decode(notNumber) === null);
  check("and one with no sequence on it at all", new StateIn().decode(noSeq) === null);

  // A newer build adding a field must not break an older receiver: a key it
  // does not know is ignored, which is why a new field needs no version bump.
  const extra = { ...key, d: { ...key.d, zz: 42 } } as unknown as DeltaMsg;
  const decoded = new StateIn().decode(extra);
  check("a field from a newer build is ignored, not fatal", Boolean(decoded) && sameState(decoded, new StateIn().decode(key)));
}

// --------------------------------------------------- the full packet fallback

{
  const s = sample(2, 40);
  const round = stateOf(stateMsg(s, 3));
  check("the old full packet still round trips, for the peers that only speak it", sameState(s, round));
  // the packet a host sends for a bot carries the bot's id; its own carries none
  check("a relayed state names the player it is about and its own does not", stateMsg(s, 3).from === 3 && stateMsg(s).from === undefined);
  // an old sender's absent fields arrive as null: they have to read as absent
  const old = asPeerJs({ ...stateMsg(s), ad: undefined, ac: undefined, bot: undefined });
  check("and an old sender's nulls read as absent, not as zero", stateOf(old).ad === undefined && stateOf(old).ac === undefined && stateOf(old).bot === undefined);
}

// ------------------------------------------------------------ the negotiation

{
  const sync = new StateSync(0, "host");
  sync.addPeer(1);
  check("a peer gets full packets until it says otherwise", !sync.speaksDeltas(1));
  sync.notePeer(1, undefined);
  check("and a build that names no protocol never gets deltas", !sync.speaksDeltas(1));
  sync.notePeer(1, null);
  check("nor one whose protocol arrived as null", !sync.speaksDeltas(1));
  sync.notePeer(1, STATE_PROTOCOL + 1);
  check("nor one that speaks a protocol we do not", !sync.speaksDeltas(1));
  sync.notePeer(1, STATE_PROTOCOL);
  check("only a peer that names our own protocol", sync.speaksDeltas(1), `protocol ${STATE_PROTOCOL}`);
  sync.receive({ t: "hello", v: 2, d: STATE_PROTOCOL } as NetMsg, 2);
  check("and a hello announces it, so the host learns it without being told twice", sync.speaksDeltas(2));
}

{
  // The announcement has to actually be on the two messages that carry it, or
  // no two browsers would ever turn this on.
  const link = readFileSync("src/net/link.ts", "utf8");
  const welcomes = link.split('t: "welcome"').length - 1;
  const hellos = link.split('t: "hello", v: 2').length - 1;
  const stamped = link.split("d: STATE_PROTOCOL").length - 1;
  check("every hello and every welcome carries the protocol", stamped >= welcomes - 1 + hellos && stamped >= 4, `${stamped} stamped, ${welcomes - 1} welcomes and ${hellos} hellos sent`);
}

// ------------------------------------------------------------- a whole lobby

/** eight players and four bots, the lobby the cap is set by, for five seconds */
function lobby(deltas: boolean): { bytes: number; packets: number; held: number; settledHeld: number; worstTick: number } {
  const PLAYERS = 8;
  const BOTS = 4;
  const host = new StateSync(0, "host");
  const guests = new Map<number, StateSync>();
  for (let i = 1; i < PLAYERS; i++) {
    host.addPeer(i);
    if (deltas) host.notePeer(i, STATE_PROTOCOL);
    const g = new StateSync(i, "guest");
    g.addPeer(0);
    if (deltas) g.notePeer(0, STATE_PROTOCOL);
    guests.set(i, g);
  }
  let worstTick = 0;
  let firstSecond = 0;
  for (let tick = 0; tick < 150; tick++) {
    // everyone's stream starts on tick one, so the first second is one burst
    // of keyframes and is not what a match looks like
    if (tick === 30) firstSecond = host.stats.held;
    const now = tick / 30;
    // every guest tells the host where it is
    for (const [id, g] of guests) g.tick(now, [{ id, state: sample(id, tick) }], (_to, m) => void host.receive(asPeerJs(m), id));
    // the host sends itself, its bots, and everyone it has heard from
    const subjects: Subject[] = [{ id: 0, state: sample(0, tick) }];
    for (let b = 0; b < BOTS; b++) subjects.push({ id: 100 + b, state: sample(PLAYERS + b, tick) });
    for (const s of host.relayable()) subjects.push(s);
    const perPeer = new Map<number, number>();
    host.tick(now, subjects, (to, m) => {
      perPeer.set(to, (perPeer.get(to) ?? 0) + wireBytes(m));
      guests.get(to)?.receive(asPeerJs(m), 0);
    });
    for (const n of perPeer.values()) worstTick = Math.max(worstTick, n);
  }
  return { bytes: host.stats.bytes, packets: host.stats.packets, held: host.stats.held, settledHeld: host.stats.held - firstSecond, worstTick };
}

{
  const full = lobby(false);
  const thin = lobby(true);
  const fullUp = full.bytes / 5;
  const thinUp = thin.bytes / 5;
  check(
    "a full lobby costs the host less than half what it used to",
    thinUp < fullUp / 2,
    `${(fullUp / 1024).toFixed(0)} kB/s down to ${(thinUp / 1024).toFixed(0)} kB/s, ${(fullUp / thinUp).toFixed(1)}x`
  );
  check(
    "and the host's upload is inside what a home connection has",
    thinUp * 8 < 4 * 1024 * 1024,
    `${((thinUp * 8) / 1024 / 1024).toFixed(2)} Mbit/s up, was ${((fullUp * 8) / 1024 / 1024).toFixed(2)}`
  );
  check(
    "no tick sends one peer more than the budget plus the packet that crossed it",
    thin.worstTick <= netCfg.budget.bytesPerPeerTick + 512,
    `worst tick ${thin.worstTick} bytes, budget ${netCfg.budget.bytesPerPeerTick}`
  );
  // The opening tick is one burst of keyframes for everybody at once, which
  // the budget spreads over the next few ticks and is exactly what it is for.
  // Once the streams have settled nothing should ever wait again.
  check("and once the match has settled nothing waits for a later tick", thin.settledHeld === 0, `${thin.held} held in the opening second, ${thin.settledHeld} after`);
}

{
  // Twice the lobby the game allows, to prove the budget is a brake and not a
  // decoration: the tick stays inside it and the rest wait their turn.
  const host = new StateSync(0, "host");
  for (let i = 1; i < 8; i++) {
    host.addPeer(i);
    host.notePeer(i, STATE_PROTOCOL);
  }
  const subjects: Subject[] = [];
  for (let i = 0; i < 24; i++) subjects.push({ id: i === 0 ? 0 : 200 + i, state: sample(i, 0) });
  let worst = 0;
  const perPeer = new Map<number, number>();
  host.tick(0, subjects, (to, m) => perPeer.set(to, (perPeer.get(to) ?? 0) + wireBytes(m)));
  for (const n of perPeer.values()) worst = Math.max(worst, n);
  check("a crowded tick is held back rather than let grow", host.stats.held > 0 && worst <= netCfg.budget.bytesPerPeerTick + 512, `${host.stats.held} held, worst peer ${worst} bytes`);
}

{
  // Distance bands, and who is allowed to apply them. A guest must always
  // send itself at the full rate, because the host re-encodes it for people
  // it may be standing right next to.
  const near: Subject = { id: 1, state: { ...sample(0, 0), x: 0, y: 0, z: 0 } };
  const far: Subject = { id: 2, state: { ...sample(0, 0), x: 300, y: 0, z: 0 } };
  const me: Subject = { id: 0, state: { ...sample(0, 0), x: 0, y: 0, z: 0 } };
  const host = new StateSync(0, "host");
  host.addPeer(1);
  host.notePeer(1, STATE_PROTOCOL);
  let toNear = 0;
  for (let tick = 0; tick < 60; tick++) host.tick(tick / 30, [me, near, far], () => toNear++);
  const guest = new StateSync(2, "guest");
  guest.addPeer(0);
  guest.notePeer(0, STATE_PROTOCOL);
  let fromGuest = 0;
  for (let tick = 0; tick < 60; tick++) guest.tick(tick / 30, [{ id: 2, state: { ...sample(2, tick), x: 300 } }], () => fromGuest++);
  check("a guest 300 m from the host still sends itself at the full rate", fromGuest >= 55, `${fromGuest} packets in 60 ticks`);
  check("but the host sends a figure that far away less often", toNear > 0 && toNear < 120, `${toNear} packets for two players over 60 ticks`);

  // The rate lives in here, not in the caller, so this can be called from a
  // render loop at any speed without an old client's match changing.
  const old = new StateSync(0, "host");
  old.addPeer(1);
  let toOld = 0;
  for (let frame = 0; frame < 240; frame++) old.tick(frame / 120, [me, near, far], () => toOld++);
  check("a peer on the old packets gets them at 30 a second however fast the caller ticks", toOld >= 110 && toOld <= 130, `${toOld} packets for two players over two seconds of a 120 Hz loop`);
}

// ------------------------------------------------------------ the last word

{
  // Everything above is about being right. This is about being smaller: one
  // running player's difference against the packet it replaces.
  const out = new StateOut();
  out.encode(sample(1, 0), 0);
  out.ack(1);
  const d = out.encode(sample(1, 1), 1 / 30) as DeltaMsg;
  const oldSize = wireBytes(withoutUndefined(stateMsg(sample(1, 1), 1)));
  const newSize = wireBytes(d);
  check("one running player's update is a fraction of the packet it replaces", newSize * 3 < oldSize, `${newSize} bytes against ${oldSize}`);
  check("and absent still means absent after the codec has been through it", absent(d.b) === false && absent((d as unknown as Record<string, unknown>).c) === true);
}

export const netDeltaFails = fails;
if (process.argv[1]?.includes("net-delta")) console.log(fails ? `\n${fails} FAILED` : "\nnet delta PASS");
