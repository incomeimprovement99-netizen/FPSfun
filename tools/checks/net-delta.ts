// Delta compressed state packets (src/config/net.json, src/net/state.ts,
// src/net/statesync.ts, and their wiring in src/game/duel.ts).
//
// Three questions, and they are not the same question.
//
// Is the codec HONEST: does everything that goes in come out again within a
// quantisation step, does a difference laid over the right baseline rebuild
// the state exactly, and is anything partly applied ever handed back? A long
// run over a link that drops, repeats and reorders packets at random answers
// that one, packet by packet.
//
// Is it honest over the REAL link? PeerJS packs every message with a binary
// encoder that has no undefined, so a field left undefined arrives as null,
// while the local BroadcastChannel link used for testing is a structured clone
// that keeps undefined as it was and hides the difference. This project has
// paid for that gap before. A delta format lives entirely on the difference
// between absent, null and zero, so everything below goes over three links
// and has to come out the same: the structured clone, PeerJS's own encoder
// (peerjs-js-binarypack, the very package PeerJS 1.5 packs with), and a link
// that turns every undefined anywhere into null.
//
// Does the game use it, and does an OLD build still play? The last sections
// run real Duel instances (duel.ts, the class the battle royale and the arena
// modes extend) against each other and against a peer that behaves exactly
// as a build from before the delta packets: it announces nothing, relays what
// it is given untouched, and reads only the full packet.
//
// Run on its own: npx tsx tools/checks/net-delta.ts. Also runs inside
// npm run verify.
import * as THREE from "three";
import { pack, unpack } from "peerjs-js-binarypack";
import netCfg from "../../src/config/net.json";
import { Duel, type LocalState } from "../../src/game/duel";
import type { DeltaMsg, DeltaPart, Link, NetMsg, StateMsg } from "../../src/net/link";
import { type PlayerState, STATE_PROTOCOL, StateIn, StateOut, applyDiff, dequantise, diff, quantise, stateMsg, stateOf } from "../../src/net/state";
import { StateSync } from "../../src/net/statesync";
import { withoutUndefined } from "../../src/net/wire";

let fails = 0;
function check(label: string, ok: boolean, detail = ""): void {
  if (!ok) fails++;
  console.log(`${ok ? "  ok  " : "FAIL  "}${label}${detail ? ` (${detail})` : ""}`);
}

console.log("\nDelta compressed state packets");

// ---------------------------------------------------------- the three links

/** binarypack's own packing, for anything (its types only name what it packs natively) */
const bp = (v: unknown): ArrayBuffer => pack(v as Parameters<typeof pack>[0]) as ArrayBuffer;
/** the local link: a structured clone, which keeps an undefined field exactly as it was */
const viaLocal = <T>(v: T): T => structuredClone(v);
/** the real link: PeerLink strips undefined, then PeerJS packs with binarypack */
const viaPeerJs = <T>(v: T): T => unpack(bp(withoutUndefined(v))) as T;
/** the worst a link could do: binarypack with nothing stripped first, so every undefined anywhere arrives as null */
const viaNulled = <T>(v: T): T => unpack(bp(v)) as T;
const LINKS: Array<[string, <T>(v: T) => T]> = [
  ["local", viaLocal],
  ["PeerJS", viaPeerJs],
  ["nulled", viaNulled],
];
/** what a message costs on the real link, in bytes of binarypack (the UDP packet around it is about 90 more) */
const packed = (m: unknown): number => bp(withoutUndefined(m)).byteLength;

/** anywhere in a message that a null or an undefined got in */
function holes(v: unknown, path = ""): string[] {
  if (v === null || v === undefined) return [path || "(root)"];
  if (Array.isArray(v)) return v.flatMap((x, i) => holes(x, `${path}[${i}]`));
  if (v && typeof v === "object") return Object.entries(v as Record<string, unknown>).flatMap(([k, x]) => holes(x, path ? `${path}.${k}` : k));
  return [];
}

const same = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);
/** how far apart two angles are, the short way round (JavaScript's % keeps its sign) */
const apart = (a: number, b: number): number => Math.abs(((((a - b) % 360) + 540) % 360) - 180);

/** a small seeded random, so a failure here can be run again and looked at */
function seeded(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return (s >>> 0) / 4294967296;
  };
}

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
    // half a second aiming, half not: the field genuinely comes and goes,
    // which is what the clear mask is for
    ad: tick % 60 < 30 ? 10 : undefined,
  };
}

// --------------------------------------------------------------- the config

check(
  "the config carries its own notes",
  Boolean(netCfg._note && netCfg._enabled && netCfg._protocol && netCfg._quantise && netCfg._keyframe && netCfg._ackHz),
  `${Object.keys(netCfg).filter((k) => k.startsWith("_")).length} notes`
);
check("the delta packets are on, protocol 1", netCfg.enabled === true && STATE_PROTOCOL === 1, `enabled ${netCfg.enabled}, protocol ${STATE_PROTOCOL}`);
check(
  "a centimetre of position, a tenth of a degree of look, a hit point of health",
  netCfg.quantise.position === 0.01 && netCfg.quantise.angle === 0.1 && netCfg.quantise.health === 1,
  `${netCfg.quantise.position} m, ${netCfg.quantise.angle} deg, ${netCfg.quantise.health} hp`
);
// A player or a bot standing still says nothing between keyframes, so the
// keyframe interval IS the heartbeat duel.ts's SILENCE_LIMIT (10 s) watches.
// Through the host it is two streams in a row, each waiting out its own timer.
const heartbeat = 2 * netCfg.keyframe.seconds * (1 + netCfg.keyframe.spread);
check("the keyframe heartbeat, even across the host's relay, is well inside the ten second silence limit", heartbeat <= 6, `at most ${heartbeat} s between packets about a still player, dropped at 10 s`);
check("an ack goes a few times a second, and history outlasts the round trip it waits on", netCfg.ackHz >= 2 && netCfg.keyframe.sentHistory / 30 > 1 && netCfg.keyframe.appliedHistory >= netCfg.keyframe.sentHistory, `${netCfg.ackHz} Hz, ${netCfg.keyframe.sentHistory} states kept`);

// ------------------------------------------------------------ quantisation

{
  // The worst case over thousands of states, not one lucky one.
  const rnd = seeded(7);
  let pos = 0;
  let ang = 0;
  let pitch = 0;
  for (let i = 0; i < 20000; i++) {
    const s: PlayerState = { ...sample(0, 0), x: (rnd() - 0.5) * 900, y: rnd() * 60, z: (rnd() - 0.5) * 900, yaw: (rnd() - 0.5) * 4000, pitch: (rnd() - 0.5) * 178 };
    const b = dequantise(quantise(s));
    pos = Math.max(pos, Math.hypot(b.x - s.x, b.y - s.y, b.z - s.z));
    ang = Math.max(ang, apart(b.yaw, s.yaw));
    pitch = Math.max(pitch, Math.abs(b.pitch - s.pitch));
  }
  const halfDiag = (Math.sqrt(3) * netCfg.quantise.position) / 2;
  check("worst position error over 20000 states is half a step on each axis (0.87 cm on the diagonal)", pos <= halfDiag + 1e-9, `${(pos * 1000).toFixed(2)} mm`);
  check("worst yaw error is half a tenth of a degree", ang <= netCfg.quantise.angle / 2 + 1e-9, `${ang.toFixed(4)} deg`);
  check("and worst pitch error the same", pitch <= netCfg.quantise.angle / 2 + 1e-9, `${pitch.toFixed(4)} deg`);
  const s = sample(3, 11);
  const back = dequantise(quantise(s));
  check("everything that is not a number comes back untouched", back.w === s.w && back.op === s.op && back.name === s.name && back.alive === s.alive && back.crouch === s.crouch && back.hp === s.hp && back.sh === s.sh);
  const spun = dequantise(quantise({ ...sample(0, 0), yaw: 725 }));
  check("a yaw that has wound round many times still names the same angle", apart(spun.yaw, 725) < 0.06, `${spun.yaw.toFixed(1)} for 725`);
  const sliver = dequantise(quantise({ ...sample(0, 0), hp: 0.4, sh: 0.3 }));
  const gone = dequantise(quantise({ ...sample(0, 0), hp: 0, sh: 0 }));
  check("a sliver of health or shield stays above zero, and zero stays zero", sliver.hp > 0 && sliver.sh > 0 && gone.hp === 0 && gone.sh === 0, `0.4 -> ${sliver.hp}, 0 -> ${gone.hp}`);
}

// ------------------------------------------- absent, null and zero are three things

{
  const aiming = quantise({ ...sample(0, 0), ad: 5 });
  const lowered = quantise({ ...sample(0, 0), ad: 0 });
  const gone = quantise({ ...sample(0, 0), ad: undefined });
  const same5 = quantise({ ...sample(0, 0), ad: 5 });
  const toZero = diff(aiming, lowered);
  check("aiming at zero is SENT, because zero is a value", toZero.d.ad === 0 && toZero.c === 0, `d.ad ${String(toZero.d.ad)}, mask ${toZero.c}`);
  const toGone = diff(aiming, gone);
  check("aiming that has gone away is CLEARED in the mask, not left out", toGone.d.ad === undefined && toGone.c === 32, `mask ${toGone.c}`);
  const unchanged = diff(aiming, same5);
  check("aiming that has not changed is LEFT OUT, and clears nothing", unchanged.d.ad === undefined && unchanged.c === 0);
  // The mask's bits are the wire's, so the order of OPT_KEYS in state.ts is
  // load bearing: shuffling it would clear the wrong field on an older build.
  const bits = ["ready", "st", "sp", "shm", "dn", "ad", "ac", "bot"].map((k, i) => {
    const before = quantise({ ...sample(0, 0), [k]: 1 } as PlayerState);
    const after = quantise({ ...sample(0, 0), [k]: undefined } as PlayerState);
    return diff(before, after).c === 1 << i;
  });
  check("each optional field clears its own bit and nobody else's", bits.every(Boolean), `${bits.filter(Boolean).length} of 8`);
  check("applied: zero arrives as zero, gone as gone, unchanged keeps what it had", applyDiff(aiming, toZero.d, toZero.c)?.ad === 0 && applyDiff(aiming, toGone.d, toGone.c)?.ad === undefined && applyDiff(aiming, unchanged.d, unchanged.c)?.ad === 5);
  // a sender whose own state has a null in it (an old peer's packet relayed through stateOf) means absent, never zero
  const nullish = quantise({ ...sample(0, 0), ad: null, ac: null, ready: null } as unknown as PlayerState);
  check("a null in a state is absent, not zero and not false", !("ad" in nullish) && !("ac" in nullish) && !("rd" in nullish));
}

// ------------------------------------------------- the same answer on every link

{
  // every part the encoder makes over four seconds, acknowledged as it goes
  const sender = new StateOut(0.3, 17);
  const acker = new StateIn();
  const sent: DeltaPart[] = [];
  let anyHole = "";
  for (let tick = 0; tick < 120; tick++) {
    const p = sender.encode(sample(1, tick), tick / 30);
    if (!p) continue;
    sent.push(p);
    const bad = holes(p);
    if (bad.length) anyHole = bad.join(", ");
    if (acker.decode(viaPeerJs(p))) sender.ack(p.q);
  }
  check("the first part a stream sends is a whole keyframe with its epoch", sent[0].b === undefined && sent[0].e === 17 && Object.keys(sent[0].d).length >= 12, `${Object.keys(sent[0].d).length} fields`);
  check("after it come differences", sent.slice(2).some((p) => p.b !== undefined));
  check("nothing the encoder puts on the wire is null or undefined, anywhere", !anyHole, anyHole || `${sent.length} parts`);
  // the same parts down every link, each into a fresh receiver: every one
  // of them has to end up holding the same thing, part for part
  const results = LINKS.map(([, via]) => {
    const inn = new StateIn();
    return sent.map((p) => JSON.stringify(inn.decode(via({ t: "sd", p: [p] } as DeltaMsg).p[0])));
  });
  const agree = results.every((r) => same(r, results[0]));
  const allLanded = results[0].every((x) => x !== "null");
  check("the local link, PeerJS's own encoder and a link that nulls everything decode to exactly the same states", agree && allLanded, agree ? `${sent.length} parts, all applied` : "they disagree");
}

{
  // The trap this project has been caught by, in its exact shape: a keyframe
  // says so by having NO baseline, and a field left undefined arrives from
  // binarypack as null. Read as "a difference against baseline null", a
  // receiver would ask forever for a keyframe it had already been handed.
  const out = new StateOut(0, 3);
  const key = out.encode(sample(2, 0), 0) as DeltaPart;
  const nulledKey = viaNulled({ ...key, b: undefined, c: undefined, f: undefined });
  check("a keyframe whose absent fields arrived as null through binarypack", nulledKey.b === null && nulledKey.c === null, JSON.stringify({ b: nulledKey.b, c: nulledKey.c }));
  const clean = new StateIn().decode(key);
  const mangled = new StateIn().decode(nulledKey);
  check("is still read as the keyframe it is", Boolean(mangled) && same(clean, mangled));
  // Inside the body: a value that arrived as null means "unchanged since the
  // baseline", never "this field is now null". The baseline has ad 7; the
  // difference changes it to 3; nulled, it has to leave the 7 alone.
  const held = new StateOut(0, 4);
  const inn = new StateIn();
  const base = held.encode({ ...sample(2, 0), ad: 7 }, 0) as DeltaPart;
  inn.decode(base);
  held.ack(base.q);
  const change = held.encode({ ...sample(2, 1), ad: 3 }, 1 / 30) as DeltaPart;
  check("a difference really does carry the field that changed", change.b === base.q && change.d.ad === 3, `ad ${String(change.d.ad)}`);
  const got = inn.decode(viaNulled({ ...change, d: { ...change.d, ad: undefined } }));
  check("a field that arrived as null is read as unchanged, not as a new value", got?.ad === 7, `ad ${String(got?.ad)}`);
}

// ------------------------------------------------------- loss, reorder, recovery

{
  // The property that matters, over a long run on a hostile link: a fifth of
  // the parts lost, some repeated, all of them delayed by a random few ticks
  // so they arrive out of order, and the acks and keyframe requests going
  // back over the same kind of link. Whatever the receiver hands the game has
  // to be EXACTLY the state that part was made from (to the quantisation
  // step), it must never wind a figure back to an older state than one it
  // has shown, and once the link is clean again it has to catch up.
  const rnd = seeded(42);
  const out = new StateOut(0.4, 9);
  const inn = new StateIn();
  const truth = new Map<number, string>();
  const toRecv: Array<{ at: number; p: DeltaPart }> = [];
  const toSend: Array<{ at: number; ack?: number; need?: boolean }> = [];
  let wrong = 0;
  let backwards = 0;
  let shown = -1;
  let applied = 0;
  let lastSent = -1;
  let state = sample(5, 0);
  const TICKS = 30 * 60;
  const CLEAN = TICKS - 30 * 6;
  for (let tick = 0; tick < TICKS; tick++) {
    const now = tick / 30;
    const hostile = tick < CLEAN;
    // a player doing everything: running, looking, and fields coming and going
    state = { ...sample(5, tick), crouch: rnd() < 0.1, ad: rnd() < 0.3 ? undefined : rnd() < 0.5 ? 0 : Math.floor(rnd() * 11), ac: rnd() < 0.5 ? undefined : Math.floor(rnd() * 14), bot: rnd() < 0.9 ? undefined : 1, hp: Math.floor(rnd() * 101), dn: rnd() < 0.8 ? 0 : 1 };
    const p = out.encode(state, now);
    if (p) {
      truth.set(p.q, JSON.stringify(dequantise(quantise(state))));
      lastSent = p.q;
      const copies = hostile ? (rnd() < 0.2 ? 0 : rnd() < 0.05 ? 2 : 1) : 1;
      for (let c = 0; c < copies; c++) toRecv.push({ at: tick + (hostile ? Math.floor(rnd() * 4) : 0), p });
    }
    // deliver what is due, in the order the delays made
    toRecv.sort((a, b) => a.at - b.at);
    while (toRecv.length && toRecv[0].at <= tick) {
      const { p: part } = toRecv.shift() as { at: number; p: DeltaPart };
      const got = inn.decode(viaPeerJs(part));
      if (got) {
        applied++;
        if (JSON.stringify(got) !== truth.get(part.q)) wrong++;
        if (part.q <= shown) backwards++;
        shown = part.q;
      }
    }
    // the receiver's answers go back over the same kind of link, every other tick
    if (tick % 2 === 0) {
      const drop = hostile && rnd() < 0.2;
      if (!drop) toSend.push({ at: tick + (hostile ? Math.floor(rnd() * 4) : 0), ack: inn.ackSeq, need: inn.wantsKeyframe });
    }
    toSend.sort((a, b) => a.at - b.at);
    while (toSend.length && toSend[0].at <= tick) {
      const a = toSend.shift() as { at: number; ack?: number; need?: boolean };
      if (a.ack !== undefined && a.ack >= 0) out.ack(a.ack);
      if (a.need) out.needKeyframe();
    }
  }
  check("over a minute of a hostile link, every state handed to the game is exactly the one that part was made from", wrong === 0 && applied > 500, `${applied} applied, ${wrong} wrong, ${inn.stale} late or repeated refused, ${inn.broken} without their baseline refused`);
  check("and a figure is never wound back to an older state than one it has shown", backwards === 0, `${backwards} backwards`);
  check("once the link is clean again the receiver catches up with the sender", shown === lastSent, `showing ${shown}, last sent ${lastSent}`);
}

{
  // The real failure: a difference whose baseline this receiver never had.
  // It is refused whole, the stream says it is stuck, and asking gets the
  // whole state back.
  const out = new StateOut();
  const inn = new StateIn();
  const key = out.encode(sample(5, 0), 0) as DeltaPart;
  out.ack(key.q);
  const d1 = out.encode(sample(5, 1), 1 / 30) as DeltaPart;
  out.ack(d1.q);
  const d2 = out.encode(sample(5, 2), 2 / 30) as DeltaPart;
  check("a difference with a baseline we never had is refused outright", inn.decode(viaPeerJs(d2)) === null);
  check("and the stream says so, instead of drawing something wrong", inn.wantsKeyframe);
  out.needKeyframe();
  const recover = out.encode(sample(5, 3), 3 / 30) as DeltaPart;
  check("asking gets the whole state back", recover.b === undefined);
  const back = inn.decode(viaPeerJs(recover));
  check("and the figure is whole again, one keyframe later", Boolean(back) && !inn.wantsKeyframe && same(back, dequantise(quantise(sample(5, 3)))));
}

{
  // Somebody listening from the middle with nobody to ask: every difference
  // is one it cannot use, until the keyframe timer comes round by itself.
  // That is what makes "wait for the next keyframe" a promise.
  const out = new StateOut(0.9, 5);
  const acking = new StateIn();
  const late = new StateIn();
  let refused = 0;
  let recovered = -1;
  for (let tick = 0; tick <= 30 * 6; tick++) {
    const p = out.encode(sample(6, tick), tick / 30);
    if (!p) continue;
    if (acking.decode(viaPeerJs(p))) out.ack(p.q);
    if (tick < 20) continue;
    if (late.decode(viaPeerJs(p))) {
      if (recovered < 0) recovered = tick;
    } else if (recovered < 0) refused++;
  }
  const most = netCfg.keyframe.seconds * (1 + netCfg.keyframe.spread) + 0.1;
  check("a latecomer refuses every difference it cannot use", refused > 0, `${refused} refused before it caught up`);
  check("and recovers on the keyframe timer alone, without asking for anything", recovered > 20 && (recovered - 20) / 30 <= most, `${((recovered - 20) / 30).toFixed(2)} s, at most ${most.toFixed(2)}`);
}

{
  // A stream that starts again for the same player (they left and a friend
  // came back under the same id): its sequences begin at 1 again. Without the
  // epoch every one of them would look late to a receiver still holding the
  // old stream, and the figure would stand frozen for the rest of the match.
  const inn = new StateIn();
  const old = new StateOut(0, 100);
  for (let tick = 0; tick < 90; tick++) {
    const p = old.encode(sample(1, tick), tick / 30);
    if (p && inn.decode(viaPeerJs(p))) old.ack(p.q);
  }
  const again = new StateOut(0, 101);
  const first = again.encode(sample(2, 0), 4);
  const got = first ? inn.decode(viaPeerJs(first)) : null;
  check("a stream begun again is taken from its first keyframe, not ignored as late", Boolean(got) && same(got, dequantise(quantise(sample(2, 0)))), `old stream reached ${inn.ackSeq > 0 ? "seq > 0" : "?"}, new keyframe seq ${first?.q}`);
  const next = again.encode(sample(2, 1), 4 + 1 / 30);
  check("and it carries on from there", Boolean(next && inn.decode(viaPeerJs(next))));
}

{
  // A player who is not moving is news to nobody.
  const out = new StateOut();
  const still = sample(7, 0);
  const k = out.encode(still, 0) as DeltaPart;
  out.ack(k.q);
  let spoke = 0;
  for (let tick = 1; tick < 30; tick++) if (out.encode(still, tick / 30)) spoke++;
  check("a player standing still costs nothing between keyframes", spoke === 0, `${spoke} parts in a second of standing still`);
}

{
  // A peer that never acknowledges anything gets keyframes rather than
  // differences against a baseline it might not have: the old cost, which is
  // the right thing to fall back to.
  const out = new StateOut();
  const inn = new StateIn();
  let allWhole = true;
  let landedEvery = true;
  for (let tick = 0; tick < 60; tick++) {
    const p = out.encode(sample(1, tick), tick / 30);
    if (!p) continue;
    if (p.b !== undefined) allWhole = false;
    if (!inn.decode(viaPeerJs(p))) landedEvery = false;
  }
  check("a peer that acknowledges nothing gets keyframes, never a guess", allWhole && landedEvery);
}

// ------------------------------------------------------ a malformed part

{
  const out = new StateOut();
  const key = out.encode(sample(1, 0), 0) as DeltaPart;
  out.ack(key.q);
  const d = out.encode(sample(1, 1), 1 / 30) as DeltaPart;
  const bad = (p: unknown): boolean => {
    const inn = new StateIn();
    inn.decode(key);
    return inn.decode(p) === null;
  };
  check("a keyframe missing a required field is dropped whole", new StateIn().decode({ ...key, d: { ...key.d, hp: undefined } }) === null);
  check("and one carrying a number that is not a number", new StateIn().decode({ ...key, d: { ...key.d, x: "over there" } }) === null);
  check("and one with no sequence on it at all", new StateIn().decode({ ...key, q: undefined }) === null);
  check("a difference that moves by something that is not a number is refused, not taken as no move", bad({ ...d, d: { ...d.d, x: "2" } }) && bad({ ...d, d: { ...d.d, aw: Number.NaN } }));
  check("and one that sets a name to a number, or a flag to a string", bad({ ...d, d: { ...d.d, nm: 5 } }) && bad({ ...d, d: { ...d.d, rd: "yes" } }));
  check("and things that are not parts at all", new StateIn().decode(null) === null && new StateIn().decode([key]) === null && new StateIn().decode({ ...key, d: [1, 2] }) === null);
  {
    // a broken keyframe that claims to start a new stream must not throw away the good one
    const inn = new StateIn();
    inn.decode(key);
    const junk = inn.decode({ q: 1, e: 999, d: { ...key.d, x: "nope" } });
    check("a broken keyframe claiming a new stream is refused, and the stream we had carries on", junk === null && Boolean(inn.decode(d)));
  }
  // A newer build adding a field must not break an older receiver: a key it
  // does not know is ignored, which is why a new field needs no version bump.
  const extra = new StateIn().decode({ ...key, d: { ...key.d, zz: 42 } });
  check("a field from a newer build is ignored, not fatal", Boolean(extra) && same(extra, new StateIn().decode(key)));
}

// --------------------------------------------------- the full packet fallback

{
  const s = sample(2, 40);
  check("the full packet round trips, for the peers that only read it", same(s, stateOf(stateMsg(s, 3))));
  check("a relayed state names the player it is about and our own does not", stateMsg(s, 3).from === 3 && stateMsg(s).from === undefined);
  const old = viaNulled({ ...stateMsg(s), ad: undefined, ac: undefined, bot: undefined });
  check("an old sender's nulls read as absent, not as zero", stateOf(old).ad === undefined && stateOf(old).ac === undefined && stateOf(old).bot === undefined);
}

// ------------------------------------------------------------ the negotiation

{
  const sync = new StateSync(0, true);
  check("a peer gets full packets until it says otherwise", !sync.speaksDeltas(1));
  sync.notePeer(1, undefined);
  check("and a build that names no protocol never gets deltas", !sync.speaksDeltas(1));
  sync.notePeer(1, null);
  check("nor one whose protocol arrived as null", !sync.speaksDeltas(1));
  sync.notePeer(1, "1");
  check("nor one that sent it as text", !sync.speaksDeltas(1));
  sync.notePeer(1, STATE_PROTOCOL + 1);
  check("nor one that reads a protocol we do not", !sync.speaksDeltas(1));
  sync.notePeer(1, STATE_PROTOCOL);
  check("only a peer that names our own protocol", sync.speaksDeltas(1), `protocol ${STATE_PROTOCOL}`);
  check("and our own full packet announces it", sync.announce === STATE_PROTOCOL);
  const off = new StateSync(0, false);
  off.notePeer(1, STATE_PROTOCOL);
  const dropped = off.decode({ t: "sd", p: [new StateOut().encode(sample(1, 0), 0) as DeltaPart] }, 1);
  check("turned off, nothing is announced and nobody is sent a delta, whatever they say", off.announce === undefined && !off.speaksDeltas(1));
  check("and a delta that arrives anyway is dropped the way an older build would, and counted", dropped.length === 0 && off.stats.unexpected === 1);
}

// ------------------------------------------------------ the game: real Duels
//
// Duel builds a robot figure with a gun for everyone it sees, and the gun's
// surface texture is drawn on a canvas; node has none, so a canvas that draws
// nothing stands in for the length of these checks. The match runs on
// performance.now(), which is replaced by a clock these checks move by hand,
// so a minute of a match takes no time at all and comes out the same on
// every run. Both are put back afterwards.

const g = globalThis as unknown as Record<string, unknown>;
const hadDocument = "document" in g;
if (!hadDocument) {
  g.document = {
    createElement: () => ({ width: 0, height: 0, getContext: () => ({ createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }), putImageData: () => undefined }) }),
  };
}
const perf = performance as unknown as { now: () => number };
const realNow = perf.now;
let clockMs = 5000;
perf.now = () => clockMs;
const warn = console.warn;
// three.js warns that a canvas that is not a canvas cannot be serialised, once per figure
console.warn = (...a: unknown[]) => void (String(a[0]).includes("Unable to serialize Texture") ? undefined : warn(...a));

/** one message as it crossed the wire: who sent it, to whom, what, and its size on the real link */
interface Crossing {
  from: number;
  to: number;
  t: string;
  bytes: number;
  m: NetMsg;
}

/**
 * The wire between the pages: every message goes through PeerJS's own
 * encoder (after PeerLink's withoutUndefined, as the real link does) and is
 * delivered in order when the harness drains it, which is what a reliable
 * ordered data channel does. `drop` can lose one on purpose.
 */
class Wire {
  log: Crossing[] = [];
  private queue: Array<() => void> = [];
  drop: ((c: Crossing) => boolean) | null = null;
  pair(a: number, b: number): [Link, Link] {
    const make = (me: number, them: number, role: "host" | "guest"): Link & { closed?: boolean } => ({
      role,
      send: (m: NetMsg) => {
        const self = ends[me === a ? 0 : 1];
        if (self.closed) return;
        const c: Crossing = { from: me, to: them, t: m.t, bytes: packed(m), m };
        this.log.push(c);
        if (this.drop?.(c)) return;
        const arrived = viaPeerJs(m);
        const other = ends[me === a ? 1 : 0];
        this.queue.push(() => {
          if (!other.closed) other.onMessage?.(arrived);
        });
      },
      close: () => {
        const self = ends[me === a ? 0 : 1];
        if (self.closed) return;
        self.send({ t: "bye" });
        self.closed = true;
      },
      onMessage: null,
      onClose: null,
    });
    const ends = [make(a, b, a === 0 ? "host" : "guest"), make(b, a, "guest")];
    return [ends[0], ends[1]];
  }
  drain(): void {
    for (let i = 0; i < 1000 && this.queue.length; i++) (this.queue.shift() as () => void)();
  }
  /** messages of a type from one end to another since `since` */
  count(from: number, to: number, t: string, since = 0): number {
    let n = 0;
    for (let i = since; i < this.log.length; i++) {
      const c = this.log[i];
      if (c.from === from && c.to === to && c.t === t) n++;
    }
    return n;
  }
  bytes(from: number, to: number, since = 0, t?: string): number {
    let n = 0;
    for (let i = since; i < this.log.length; i++) {
      const c = this.log[i];
      if (c.from === from && c.to === to && (!t || c.t === t)) n += c.bytes;
    }
    return n;
  }
}

const projectiles = { addDummy: () => undefined, removeDummy: () => undefined, fire: () => undefined } as unknown as ConstructorParameters<typeof Duel>[1];

/** a Duel's insides these checks look at */
interface Inside {
  remotes: Map<number, { name: string; alive: boolean; samples: Array<{ x: number; z: number; yaw: number }> }>;
  broadcast(m: NetMsg): void;
}
const inside = (d: Duel): Inside => d as unknown as Inside;
/** the newest place `viewer` has for player `id`, or null */
function seenAt(viewer: Duel, id: number): { x: number; z: number; yaw: number } | null {
  const s = inside(viewer).remotes.get(id)?.samples;
  return s?.length ? s[s.length - 1] : null;
}

/** where player `id` is at frame `f`: running a circle of their own, looking where they go */
function walk(id: number, f: number, name = `P${id}`): LocalState {
  const a = id * 1.3 + f * 0.02;
  const r = 6 + id;
  return { x: 90 + Math.cos(a) * r, y: 0, z: -40 + Math.sin(a) * r, yaw: (a * 180) / Math.PI + 90, pitch: Math.sin(f * 0.05) * 10, crouch: false, weapon: "rspn101", operator: "vanguard", name, ready: true, stance: "stand", speed: 6, ads: f % 90 < 45 ? 1 : 0, act: 0 };
}

/**
 * A build from before the delta packets, as far as the wire can tell: its
 * own full packet with no announcement, reading only full packets, and, as a
 * host, relaying each guest's packet to the others exactly as the old
 * duel.ts did ({ ...m, from }), announcement and all.
 */
class OldBuild {
  got = new Map<string, number>();
  seen = new Map<number, { x: number; z: number }>();
  private links = new Map<number, Link>();
  constructor(readonly id: number) {}
  attach(peer: number, link: Link): void {
    this.links.set(peer, link);
    link.onMessage = (m) => {
      this.got.set(m.t, (this.got.get(m.t) ?? 0) + 1);
      const from = "from" in m && typeof m.from === "number" ? m.from : peer;
      if (m.t === "s") {
        this.seen.set(from, { x: m.x, z: m.z });
        // the old relay: everything a guest sends, stamped, to every other guest
        if (this.id === 0) {
          const stamped = { ...m, from } as NetMsg;
          for (const [id, l] of this.links) if (id !== from) l.send(stamped);
        }
      }
    };
  }
  /** its own state, the way the old duel.ts sent it thirty times a second */
  send(f: number): void {
    const l = walk(this.id, f, `OLD${this.id}`);
    const m: StateMsg = { t: "s", x: l.x, y: l.y, z: l.z, yaw: l.yaw, pitch: l.pitch, crouch: l.crouch, w: l.weapon, hp: 100, sh: 75, alive: true, op: l.operator, name: l.name, ready: true, st: 0, sp: 60, shm: 75, dn: 0, ad: l.ads ? 10 : undefined };
    for (const link of this.links.values()) link.send(m);
  }
  heard(t: string): number {
    return this.got.get(t) ?? 0;
  }
}

/** run the match for `frames` at 60 a second: every Duel updates, the old builds send at 30, the wire drains */
function run(wire: Wire, duels: Array<{ d: Duel; id: number }>, olds: OldBuild[], from: number, frames: number): number {
  let f = from;
  for (; f < from + frames; f++) {
    clockMs += 1000 / 60;
    for (const { d, id } of duels) d.update(walk(id, f));
    if (f % 2 === 0) for (const o of olds) o.send(f);
    wire.drain();
  }
  return f;
}

/** how far `viewer`'s newest sample of `id` is from where `id` really stood at the last send (within a frame of running) */
function lag(viewer: Duel, id: number, f: number): number {
  const s = seenAt(viewer, id);
  if (!s) return Infinity;
  let best = Infinity;
  for (let k = f - 4; k <= f; k++) {
    const w = walk(id, k);
    best = Math.min(best, Math.hypot(w.x - s.x, w.z - s.z));
  }
  return best;
}

const scene = new THREE.Scene();

{
  // Two players of this build: they find out about each other from their
  // first full packets, switch to differences, and see each other move.
  const wire = new Wire();
  const [h, gl] = wire.pair(0, 1);
  const host = new Duel(scene, projectiles, { players: 2, myId: 0, link: h, guestId: 1 });
  const guest = new Duel(scene, projectiles, { players: 2, myId: 1, link: gl });
  const duels = [
    { d: host, id: 0 },
    { d: guest, id: 1 },
  ];
  let f = run(wire, duels, [], 0, 60);
  const fulls = wire.log.filter((c) => c.t === "s");
  const announced = fulls.every((c) => (c.m as StateMsg).dp === STATE_PROTOCOL);
  check("1v1: the first full packets each way announce the protocol", fulls.length > 0 && announced, `${fulls.length} full packets before the switch`);
  check("1v1: both ends switch to delta packets", host.sync.speaksDeltas(1) && guest.sync.speaksDeltas(0));
  const mark = wire.log.length;
  f = run(wire, duels, [], f, 600);
  check("1v1: after that, only delta packets and acks carry the states, both ways", wire.count(0, 1, "s", mark) === 0 && wire.count(1, 0, "s", mark) === 0 && wire.count(0, 1, "sd", mark) > 200 && wire.count(1, 0, "sa", mark) > 20, `${wire.count(0, 1, "sd", mark)} delta packets and ${wire.count(1, 0, "sa", mark)} acks in 10 s`);
  check("1v1: every part applied, none refused, none asked for again", host.sync.stats.refused === 0 && guest.sync.stats.refused === 0 && host.sync.stats.asks === 0 && guest.sync.stats.asks === 0, `${guest.sync.stats.applied} applied by the guest`);
  const lh = lag(guest, 0, f - 1);
  const lg = lag(host, 1, f - 1);
  check("1v1: each sees the other where they are, to the centimetre", lh < 0.01 && lg < 0.01, `${(lh * 100).toFixed(2)} cm and ${(lg * 100).toFixed(2)} cm`);
  check("1v1: names and weapons come through", inside(guest).remotes.get(0)?.name === "P0" && inside(host).remotes.get(1)?.name === "P1");
  // the cost, on the real link's encoder, against the full packets it replaced
  const since = wire.log.length;
  f = run(wire, duels, [], f, 300);
  const deltaBytes = wire.bytes(0, 1, since, "sd") / 5;
  const deltaMsgs = wire.count(0, 1, "sd", since) / 5;
  // the host's own full packet from before the switch, as it really went
  const fullOne = fulls.find((c) => c.from === 0)?.bytes ?? 0;
  check("1v1: a running player costs a fraction of the full packets, in bytes of the real encoder", fullOne > 0 && deltaBytes * 2.5 < fullOne * 30, `${deltaBytes.toFixed(0)} B/s in ${deltaMsgs.toFixed(0)} messages, against ${fullOne * 30} B/s of full packets (${fullOne} bytes each)`);
  // standing still: nothing but the keyframe heartbeat
  const stillFrom = wire.log.length;
  for (let k = 0; k < 300; k++) {
    clockMs += 1000 / 60;
    host.update(walk(0, f));
    guest.update(walk(1, f));
    wire.drain();
  }
  const still = wire.count(0, 1, "sd", stillFrom);
  check("1v1: standing still for five seconds costs only the keyframes", still >= 1 && still <= 5, `${still} delta packets in 5 s`);
  const after = lag(guest, 0, f);
  check("1v1: and the figure is still exactly where they stand", after < 0.01, `${(after * 100).toFixed(2)} cm`);
  // a lost delta: a baseline acked before it is still there, so nothing even stalls
  let dropped = 0;
  wire.drop = (c) => {
    if (c.from !== 0 || c.t !== "sd" || dropped > 0) return false;
    dropped++;
    return true;
  };
  const lossFrom = wire.log.length;
  f = run(wire, duels, [], f, 30);
  wire.drop = null;
  const refusedAfterLoss = guest.sync.stats.refused;
  check("1v1: a lost delta packet costs nothing: the next one is a difference from a state the guest has", dropped === 1 && refusedAfterLoss === 0 && lag(guest, 0, f - 1) < 0.01, `${wire.count(0, 1, "sd", lossFrom)} sent, 1 lost, ${refusedAfterLoss} refused`);
  // a guest that lost its stream (forgot it, as after a figure went away)
  // refuses the next difference, asks at once, and is whole a frame later
  guest.sync.forgetSubject(0);
  const askFrom = wire.log.length;
  f = run(wire, duels, [], f, 6);
  const asked = wire.log.slice(askFrom).some((c) => c.t === "sa" && Array.isArray((c.m as { need?: number[] }).need));
  check("1v1: a guest that cannot apply a difference asks for a keyframe at once and is whole again", asked && lag(guest, 0, f - 1) < 0.01 && guest.sync.stats.asks >= 1, `${guest.sync.stats.refused} refused, asked ${asked}`);
  guest.leave();
  wire.drain();
  host.dispose();
}

{
  // Who hears whom first. Over the real link one end often reads the
  // other's announcement before it has sent a state of its own, so its very
  // first state goes out as a delta packet and the other end never sees a
  // full packet from it at all. That end has to learn from the delta packet
  // itself, or it stays on full packets for the whole match (which is what
  // the first run over the real broker found). Both orders.
  for (const first of ["host", "guest"] as const) {
    const wire = new Wire();
    const [h, gl] = wire.pair(0, 1);
    const host = new Duel(scene, projectiles, { players: 2, myId: 0, link: h, guestId: 1 });
    const guest = new Duel(scene, projectiles, { players: 2, myId: 1, link: gl });
    const [a, b] = first === "host" ? [host, guest] : [guest, host];
    const idOf = (d: Duel): number => (d === host ? 0 : 1);
    clockMs += 1000 / 60;
    a.update(walk(idOf(a), 0));
    wire.drain();
    b.update(walk(idOf(b), 0));
    wire.drain();
    const bFirst = wire.log.find((c) => c.from === idOf(b) && (c.t === "s" || c.t === "sd"));
    const f = run(wire, [
      { d: host, id: 0 },
      { d: guest, id: 1 },
    ], [], 1, 120);
    const fullFromB = wire.log.filter((c) => c.from === idOf(b) && c.t === "s").length;
    check(`the ${first} heard first, so the other's first state was already a delta packet, and both still switched`, bFirst?.t === "sd" && fullFromB === 0 && host.sync.speaksDeltas(1) && guest.sync.speaksDeltas(0) && wire.count(0, 1, "sd") > 30 && wire.count(1, 0, "sd") > 30, `first from the ${first === "host" ? "guest" : "host"}: ${bFirst?.t}, deltas each way ${wire.count(0, 1, "sd")} and ${wire.count(1, 0, "sd")}`);
    check(`and each sees the other (${first} first)`, lag(guest, 0, f - 1) < 0.01 && lag(host, 1, f - 1) < 0.01);
    host.dispose();
    guest.dispose();
  }
}

{
  // A host of this build and a guest from before the delta packets.
  const wire = new Wire();
  const [h, gl] = wire.pair(0, 1);
  const host = new Duel(scene, projectiles, { players: 2, myId: 0, link: h, guestId: 1 });
  const old = new OldBuild(1);
  old.attach(0, gl);
  const f = run(wire, [{ d: host, id: 0 }], [old], 0, 600);
  check("old guest: never sent a delta packet or an ack, only the full packets it reads", old.heard("sd") === 0 && old.heard("sa") === 0 && old.heard("s") > 250, `${old.heard("s")} full packets, ${old.heard("sd")} deltas, ${old.heard("sa")} acks`);
  check("old guest: the new host never switched it to deltas", !host.sync.speaksDeltas(1));
  const s = old.seen.get(0);
  const w = walk(0, f - 1);
  check("old guest: sees the new host where the host is", Boolean(s) && Math.hypot((s?.x ?? 0) - w.x, (s?.z ?? 0) - w.z) < 0.5);
  check("old guest: and the new host sees it", lag(host, 1, f - 1) < 0.5);
  host.dispose();
}

{
  // A guest of this build and a host from before them. The old host relays
  // the other guest's packet with its announcement still on it, which says
  // nothing about the host; if a guest took it as the host's own, it would
  // send deltas to a build that cannot read them and freeze.
  const wire = new Wire();
  const [h1, g1] = wire.pair(0, 1);
  const [h2, g2] = wire.pair(0, 2);
  const oldHost = new OldBuild(0);
  oldHost.attach(1, h1);
  oldHost.attach(2, h2);
  const a = new Duel(scene, projectiles, { players: 3, myId: 1, link: g1 });
  const b = new Duel(scene, projectiles, { players: 3, myId: 2, link: g2 });
  const f = run(wire, [
    { d: a, id: 1 },
    { d: b, id: 2 },
  ], [oldHost], 0, 600);
  const relayedDp = wire.log.some((c) => c.from === 0 && c.t === "s" && (c.m as StateMsg).from === 2 && (c.m as StateMsg).dp === STATE_PROTOCOL);
  check("old host: it really does relay one guest's announcement to the other (the trap is set)", relayedDp);
  check("old host: neither new guest takes it for the host's, and nobody sends a delta packet", !a.sync.speaksDeltas(0) && !b.sync.speaksDeltas(0) && wire.log.every((c) => c.t !== "sd" && c.t !== "sa"), `${wire.log.filter((c) => c.t === "sd").length} deltas`);
  check("old host: the two new guests see each other through it", lag(a, 2, f - 1) < 0.5 && lag(b, 1, f - 1) < 0.5);
  check("old host: and they see the host", lag(a, 0, f - 1) < 0.5 && lag(b, 0, f - 1) < 0.5);
  a.dispose();
  b.dispose();
}

{
  // Three players: a new host, a new guest, and an old guest. The host reads
  // each guest in the form it came, passes each on in the form the OTHER
  // reads: the new guest's differences go to the old guest as full packets,
  // the old guest's full packets go to the new guest as differences.
  const wire = new Wire();
  const [h1, g1] = wire.pair(0, 1);
  const [h2, g2] = wire.pair(0, 2);
  const host = new Duel(scene, projectiles, { players: 3, myId: 0, link: h1, guestId: 1 });
  host.addGuest(h2, 2);
  const a = new Duel(scene, projectiles, { players: 3, myId: 1, link: g1 });
  const old = new OldBuild(2);
  old.attach(0, g2);
  const f = run(wire, [
    { d: host, id: 0 },
    { d: a, id: 1 },
  ], [old], 0, 600);
  check("mixed: the old guest is sent full packets only, the new one deltas", old.heard("sd") === 0 && old.heard("sa") === 0 && wire.count(0, 1, "sd") > 200, `${old.heard("s")} full to the old one, ${wire.count(0, 1, "sd")} deltas to the new one`);
  const relayed = wire.log.filter((c) => c.from === 0 && c.to === 2 && c.t === "s" && (c.m as StateMsg).from === 1);
  check("mixed: the new guest reaches the old one as full packets rebuilt by the host, with no announcement on them", relayed.length > 200 && relayed.every((c) => (c.m as StateMsg).dp === undefined), `${relayed.length} relayed`);
  const s = old.seen.get(1);
  const w = walk(1, f - 1);
  check("mixed: the old guest sees the new guest where they are", Boolean(s) && Math.hypot((s?.x ?? 0) - w.x, (s?.z ?? 0) - w.z) < 0.5);
  check("mixed: the new guest sees the old one, and the host sees both", lag(a, 2, f - 1) < 0.5 && lag(host, 1, f - 1) < 0.01 && lag(host, 2, f - 1) < 0.5);
  host.dispose();
  a.dispose();
}

{
  // Three of this build; one guest leaves and a friend takes the same id.
  // The host starts a new stream about them, from sequence 1 again, and the
  // other guest has to follow it rather than wait for the old numbers.
  const wire = new Wire();
  const [h1, g1] = wire.pair(0, 1);
  const [h2, g2] = wire.pair(0, 2);
  const host = new Duel(scene, projectiles, { players: 3, myId: 0, link: h1, guestId: 1 });
  host.addGuest(h2, 2);
  const a = new Duel(scene, projectiles, { players: 3, myId: 1, link: g1 });
  const b = new Duel(scene, projectiles, { players: 3, myId: 2, link: g2 });
  let f = run(wire, [
    { d: host, id: 0 },
    { d: a, id: 1 },
    { d: b, id: 2 },
  ], [], 0, 300);
  check("three: the relay works in deltas both ways", wire.count(0, 1, "sd") > 100 && wire.count(0, 2, "sd") > 100 && lag(a, 2, f - 1) < 0.01 && lag(b, 1, f - 1) < 0.01, `${(lag(a, 2, f - 1) * 100).toFixed(2)} cm`);
  b.leave();
  f = run(wire, [
    { d: host, id: 0 },
    { d: a, id: 1 },
  ], [], f, 30);
  check("three: a guest leaving is gone for the other", !inside(a).remotes.has(2));
  const [h3, g3] = wire.pair(0, 2);
  host.addGuest(h3, 2);
  const c = new Duel(scene, projectiles, { players: 3, myId: 2, link: g3 });
  f = run(wire, [
    { d: host, id: 0 },
    { d: a, id: 1 },
    { d: c, id: 2 },
  ], [], f, 300);
  check("three: the friend who took the same place is seen by the other guest, in deltas", lag(a, 2, f - 1) < 0.01 && lag(c, 1, f - 1) < 0.01 && a.sync.stats.refused === 0, `${(lag(a, 2, f - 1) * 100).toFixed(2)} cm, ${a.sync.stats.refused} refused`);
  host.dispose();
  a.dispose();
  c.dispose();
}

{
  // The host's bots go out through the same broadcast as everything else:
  // brmatch.ts and modematch.ts send them from their tick as
  // { t: "s", from: 100 + i }, fifteen times a second, and so does the stand
  // in for them here. A moving bot costs a difference, a still one nothing
  // but its keyframes, the whole frame goes to the guest as one packet, and
  // the guest still hears from every bot well inside ten seconds.
  const wire = new Wire();
  const [h, gl] = wire.pair(0, 1);
  const host = new Duel(scene, projectiles, { players: 2, myId: 0, link: h, guestId: 1 });
  const guest = new Duel(scene, projectiles, { players: 2, myId: 1, link: gl });
  const BOTS = 11;
  let f = 0;
  let moving: (i: number) => boolean = () => true;
  const bot = (i: number, frame: number, run: boolean): StateMsg => {
    const w = walk(10 + i, run ? frame : 0);
    return { t: "s", from: 100 + i, x: w.x, y: 0, z: w.z, yaw: w.yaw, pitch: 0, crouch: false, w: "r97", hp: 100, sh: 50, alive: true, op: "bangalore", name: `BOT ${i}`, ready: true, st: 0, sp: run ? 55 : 0 };
  };
  // the host's tick, as the subclasses have it: inside the frame, after the fight
  (host as unknown as { tick: () => void }).tick = () => {
    if (f % 4 === 0) for (let i = 0; i < BOTS; i++) inside(host).broadcast(bot(i, f, moving(i)));
  };
  const lastHeard = new Map<number, number>();
  let worstGap = 0;
  const frames = (n: number, move: (i: number) => boolean): void => {
    moving = move;
    for (let k = 0; k < n; k++, f++) {
      const before = wire.log.length;
      clockMs += 1000 / 60;
      host.update(walk(0, f));
      guest.update(walk(1, f));
      wire.drain();
      for (let i = before; i < wire.log.length; i++) {
        const c = wire.log[i];
        if (c.t !== "sd" || c.to !== 1) continue;
        for (const p of (c.m as DeltaMsg).p) if (typeof p.f === "number") lastHeard.set(p.f, clockMs);
      }
      for (let i = 0; i < BOTS; i++) worstGap = Math.max(worstGap, (clockMs - (lastHeard.get(100 + i) ?? clockMs)) / 1000);
    }
  };
  frames(120, () => true);
  const since = wire.log.length;
  frames(600, (i) => i < 4);
  const botBytes = wire.log.slice(since).filter((c) => c.to === 1 && c.t === "sd").reduce((n, c) => n + c.bytes, 0) / 10;
  const fullBots = (packed(bot(0, f, true)) * 15 * BOTS);
  const botsSeen = [...inside(guest).remotes.keys()].filter((id) => id >= 100).length;
  check("bots: the guest sees all eleven of the host's bots through the delta packets", botsSeen === BOTS && guest.sync.stats.refused === 0, `${botsSeen} bots`);
  check("bots: four running and seven standing cost a fraction of their full packets", botBytes * 3 < fullBots, `${(botBytes / 1024).toFixed(1)} kB/s against ${(fullBots / 1024).toFixed(1)} kB/s of full packets`);
  check("bots: and even a bot standing still is heard from well inside the ten second limit", worstGap > 0 && worstGap < 6, `longest silence ${worstGap.toFixed(2)} s`);
  const b3 = seenAt(guest, 103);
  const lastBots = f - 1 - ((f - 1) % 4);
  const w3 = walk(13, lastBots);
  check("bots: a running bot is where the host put it", Boolean(b3) && Math.hypot((b3?.x ?? 0) - w3.x, (b3?.z ?? 0) - w3.z) < 0.5);
  // one packet a frame: our own state and every bot that had something to say, together
  const toGuest = wire.log.slice(since).filter((c) => c.to === 1 && c.t === "sd");
  const perSecond = toGuest.length / 10;
  const most = Math.max(...toGuest.map((c) => (c.m as DeltaMsg).p.length));
  check("bots: a frame's states go to the guest as one delta packet, not one a player", perSecond <= 31 && most >= 5, `${perSecond.toFixed(0)} packets a second, up to ${most} players in one`);
  host.dispose();
  guest.dispose();
}

{
  // A host that is not id 0: what a guest becomes when it takes a match over
  // from a host that dropped (docs/PLAN_HOST_MIGRATION.md). Here player 2
  // hosts, and 0 and 1 are its guests. Everything that went by "the host is
  // 0" (a guest's replica of its host, the relay, the ping, the host's
  // goodbye, a host gone quiet) has to go by the host's id instead.
  const wire = new Wire();
  const [h0, g0] = wire.pair(2, 0);
  const [h1, g1] = wire.pair(2, 1);
  const host = new Duel(scene, projectiles, { players: 3, myId: 2, hostId: 2, link: h0, guestId: 0 });
  host.addGuest(h1, 1);
  const a = new Duel(scene, projectiles, { players: 3, myId: 0, hostId: 2, link: g0 });
  const b = new Duel(scene, projectiles, { players: 3, myId: 1, hostId: 2, link: g1 });
  check("host id 2: the roles go by the host's id", host.role === "host" && a.role === "guest" && b.role === "guest");
  let f = run(wire, [
    { d: host, id: 2 },
    { d: a, id: 0 },
    { d: b, id: 1 },
  ], [], 0, 300);
  check("host id 2: each guest sees the host and the other guest through the relay, in deltas", lag(a, 2, f - 1) < 0.01 && lag(b, 2, f - 1) < 0.01 && lag(a, 1, f - 1) < 0.01 && lag(b, 0, f - 1) < 0.01 && host.sync.speaksDeltas(0) && a.sync.speaksDeltas(2), `${(lag(a, 1, f - 1) * 100).toFixed(2)} cm`);
  check("host id 2: guest 0 makes no figure of itself for the host", !inside(a).remotes.has(0) && inside(a).remotes.has(2) && inside(host).remotes.has(0));
  check("host id 2: the guests' pings are answered by the host", wire.count(0, 2, "ping") > 0 && wire.count(2, 0, "pong") > 0 && a.ping !== null, `${wire.count(0, 2, "ping")} pings`);
  // the host goes quiet (no goodbye, no states, no answers: a frozen tab), and a guest takes it for a dropped host
  h0.onMessage = null;
  h1.onMessage = null;
  const ends: string[] = [];
  a.onEnd = (r) => ends.push(`a:${r}`);
  b.onEnd = (r) => ends.push(`b:${r}`);
  f = run(wire, [
    { d: a, id: 0 },
    { d: b, id: 1 },
  ], [], f, 60 * 12);
  check("host id 2: a host gone quiet is noticed by its guests", ends.length === 2 && ends.every((e) => /host/i.test(e)), JSON.stringify(ends));
  host.dispose();
  a.dispose();
  b.dispose();
}

{
  // and its goodbye ends the match for a guest, as host 0's always did
  const wire = new Wire();
  const [h, gl] = wire.pair(3, 1);
  const host = new Duel(scene, projectiles, { players: 2, myId: 3, hostId: 3, link: h, guestId: 1 });
  const guest = new Duel(scene, projectiles, { players: 2, myId: 1, hostId: 3, link: gl });
  let why = "";
  guest.onEnd = (r) => (why = r);
  run(wire, [
    { d: host, id: 3 },
    { d: guest, id: 1 },
  ], [], 0, 60);
  host.leave();
  wire.drain();
  check("host id 3: the host's goodbye ends the guest's match", why === "The host left the match." && guest.left, why);
  guest.dispose();
}

// put back what the Duel checks borrowed
// ------------------------------------------------------------ the sender's clock
// A state carries its sender's clock (16 bits of milliseconds). It has to
// come through a keyframe and a difference, wrap without harm, and never make
// a player standing still cost a packet between keyframes.
{
  const still: PlayerState = { ...sample(0, 0), tm: 65530 };
  const q = quantise(still);
  check("the sender's clock survives the codec", dequantise(q).tm === 65530);
  check("and wraps at 16 bits", quantise({ ...still, tm: 65536 + 7 }).tm === 7);
  const out = new StateOut();
  const inn = new StateIn();
  const k = out.encode(still, 0);
  const got = k ? inn.decode(k) : null;
  out.ack(inn.ackSeq);
  const next = out.encode({ ...still, tm: 12 }, 0.05);
  check("a player standing still costs nothing between keyframes, though the clock moved", !!got && got.tm === 65530 && next === null);
  const moved = out.encode({ ...still, x: still.x + 1, tm: 45 }, 0.1);
  const after = moved ? inn.decode(moved) : null;
  check("a state that moved carries the clock with it", !!after && after.tm === 45 && Math.abs(after.x - (still.x + 1)) < 0.01);
}

perf.now = realNow;
console.warn = warn;
if (!hadDocument) delete g.document;

export const netDeltaFails = fails;
if (process.argv[1]?.includes("net-delta")) console.log(fails ? `\n${fails} FAILED` : "\nnet delta PASS");
