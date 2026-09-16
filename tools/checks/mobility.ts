// The two carried charges: the shockwave and the rift (src/game/throwables.ts,
// src/config/throwables.json).
//
// Mobility used to be furniture. Four pads bolted to the roads, four balloons
// and three ziplines, so whether a squad could rotate was the map's decision
// and not theirs. A charge you carry moves that decision into a pocket, and
// the two things that can go wrong with it are the two things checked hardest
// here. The first is drift: the shockwave has to throw you with the roads'
// pads' own velocity, and the moment it carries a copy of those numbers
// instead of the numbers themselves the two stop feeling like one thing. The
// second is a charge becoming an escape rather than a rotation, which is what
// a missing arm time, a missing cooldown or a charge that works while you are
// down each turn it into.
//
// Everything here runs in plain node: no scene, no canvas, no window. The
// rules the game asks about live in free functions for exactly that reason.
//
// Run on its own: npx tsx tools/checks/mobility.ts.
import * as THREE from "three";
import {
  MOBILITY_KINDS,
  Ordnance,
  PAD_LAUNCH,
  THROW_KINDS,
  isMobilityKind,
  makeRift,
  makeShockwave,
  riftOpen,
  riftStep,
  shockwaveLaunch,
  shockwaveLive,
  type Mover,
} from "../../src/game/throwables";
import cfg from "../../src/config/throwables.json";
import squad from "../../src/config/squad.json";

let fails = 0;
function check(label: string, ok: boolean, detail = ""): void {
  if (!ok) fails++;
  console.log(`${ok ? "  ok  " : "FAIL  "}${label}${detail ? ` (${detail})` : ""}`);
}

console.log("\nThe carried charges");

const V = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);
/** someone standing here, on their feet */
const up = (id: number, at: THREE.Vector3): Mover => ({ id, feet: at.clone(), downed: false });
/** the same person, knocked */
const down = (id: number, at: THREE.Vector3): Mover => ({ id, feet: at.clone(), downed: true });

// ---------------------------------------------------------------- the items
check(
  "both charges are throwables, and the wire's old codes still say what they said",
  THROW_KINDS[0] === "frag" && THROW_KINDS[1] === "arcstar" && THROW_KINDS[2] === "thermite" && THROW_KINDS[3] === "shockwave" && THROW_KINDS[4] === "rift",
  THROW_KINDS.join(" ")
);
check("and the two of them are the mobility pair", MOBILITY_KINDS.length === 2 && MOBILITY_KINDS.every(isMobilityKind) && !isMobilityKind("frag"));

// ------------------------------------------------------- the numbers are config's
const S = cfg.shockwave;
const RI = cfg.rift;
const bad: string[] = [];
const NUMBERS = { "shockwave.arm": S.arm, "shockwave.life": S.life, "shockwave.radius": S.radius, "shockwave.rise": S.rise, "shockwave.under": S.under, "shockwave.regap": S.regap, "shockwave.cooldown": S.cooldown, "shockwave.stack": S.stack, "shockwave.speed": S.speed, "rift.arm": RI.arm, "rift.life": RI.life, "rift.reach": RI.reach, "rift.rise": RI.rise, "rift.under": RI.under, "rift.regap": RI.regap, "rift.cooldown": RI.cooldown, "rift.stack": RI.stack, "rift.speed": RI.speed, "rift.eye": RI.eye };
for (const [name, v] of Object.entries(NUMBERS)) {
  if (!Number.isFinite(v) || v <= 0) bad.push(name);
}
check("every number both charges use is in the config and is a real one", bad.length === 0, bad.join(", ") || `${Object.keys(NUMBERS).length} of them`);
check(
  "the config says out loud that these numbers are ours",
  /ours/i.test(cfg._carried) && /squad\.json/.test(cfg._carried) && Boolean(cfg._shockwave) && Boolean(cfg._rift),
  "_carried, _shockwave, _rift"
);

// The arm times and lives are read, not baked in: move the config and the
// charge that comes out has to move with it. A number typed into the game code
// passes every check that only reads the config back.
{
  const armWas = S.arm;
  const lifeWas = S.life;
  S.arm = 3.25;
  S.life = 7.5;
  const s = makeShockwave(1, true, V(0, 0, 0), V(0, 0, 1), 100);
  check("a shockwave's arm time and life follow the config, they are not baked into the code", s.armAt === 103.25 && s.until === 110.75, `arms at ${s.armAt}, dies at ${s.until}`);
  S.arm = armWas;
  S.life = lifeWas;
}
{
  const armWas = RI.arm;
  const lifeWas = RI.life;
  RI.arm = 1.5;
  RI.life = 4;
  const r = makeRift(1, true, V(0, 0, 0), V(9, 0, 0), 100);
  check("and so do a rift's", r.openAt === 101.5 && r.until === 105.5, `opens at ${r.openAt}, dies at ${r.until}`);
  RI.arm = armWas;
  RI.life = lifeWas;
}

// ------------------------------------------------------------- the shockwave
const AT = V(10, 0, -4);
const EAST = V(1, 0, 0);
{
  const s = makeShockwave(1, true, AT, EAST, 0);
  check("a shockwave will not throw you before it has armed", shockwaveLaunch(s, up(7, AT), S.arm - 0.01) === null && !shockwaveLive(s, S.arm - 0.01), `arm ${S.arm} s`);
  const v = shockwaveLaunch(s, up(7, AT), S.arm + 0.01);
  check(
    "a live one throws you with the roads' pads' own velocity, to the metre",
    v !== null && Math.abs(Math.hypot(v.x, v.z) - squad.pad.speed) < 1e-9 && Math.abs(v.y - squad.pad.up) < 1e-9,
    v ? `${Math.hypot(v.x, v.z).toFixed(2)} along, ${v.y.toFixed(2)} up; the pads are ${squad.pad.speed} and ${squad.pad.up}` : "nothing"
  );
  check("and along the way it was thrown, not the way anyone is facing", v !== null && Math.abs(v.x - squad.pad.speed) < 1e-9 && Math.abs(v.z) < 1e-9, v ? `(${v.x.toFixed(1)}, ${v.z.toFixed(1)})` : "nothing");
}
// The pads' numbers are not copied into the charge, they ARE the charge's: move
// the road pads and the thing in your pocket moves with them.
{
  const was = squad.pad.speed;
  squad.pad.speed = 99;
  const s = makeShockwave(1, true, AT, EAST, 0);
  const v = shockwaveLaunch(s, up(7, AT), S.arm + 0.01);
  check("it reads the pads' numbers rather than holding a second copy of them", v !== null && Math.abs(v.x - 99) < 1e-9 && PAD_LAUNCH === squad.pad, v ? `${v.x} along` : "nothing");
  squad.pad.speed = was;
}
{
  const s = makeShockwave(1, true, AT, EAST, 0);
  const live = S.arm + 0.01;
  check("it throws an enemy the same as it throws the squad that put it there", shockwaveLaunch(s, up(42, AT), live) !== null, "id 42, nobody's mate");
  check("it will not throw the same figure again inside its regap", shockwaveLaunch(s, up(42, AT), live + S.regap * 0.5) === null, `regap ${S.regap} s`);
  check("and will once the regap has passed", shockwaveLaunch(s, up(42, AT), live + S.regap + 0.01) !== null);
  check("standing off it does nothing", shockwaveLaunch(s, up(8, AT.clone().add(V(S.radius + 0.5, 0, 0))), live) === null, `radius ${S.radius} m`);
  check("and standing a storey above it does nothing", shockwaveLaunch(s, up(9, AT.clone().add(V(0, S.rise + 0.5, 0))), live) === null, `rise ${S.rise} m`);
  check("it stops throwing anyone once its life has run out", shockwaveLaunch(s, up(11, AT), s.until + 0.01) === null && !shockwaveLive(s, s.until + 0.01), `${S.life} s live`);
}

// ------------------------------------------------------------------ the rift
const THREW_FROM = V(2, 0, 2);
const LANDED = V(30, 0, 14);
{
  const r = makeRift(1, true, THREW_FROM, LANDED, 0);
  check(
    "a rift's two mouths are the two points: where it was thrown from and where it landed",
    r.a.distanceTo(THREW_FROM) < 1e-9 && r.b.distanceTo(LANDED) < 1e-9,
    `(${r.a.x}, ${r.a.z}) to (${r.b.x}, ${r.b.z})`
  );
  check("it is shut until it opens", riftStep(r, up(7, THREW_FROM), RI.arm - 0.01) === null && !riftOpen(r, RI.arm - 0.01), `arm ${RI.arm} s`);
  const open = RI.arm + 0.01;
  const outA = riftStep(r, up(7, THREW_FROM), open);
  check("walk into the near mouth and you come out of the far one", outA !== null && outA.distanceTo(LANDED) < 1e-9, outA ? `(${outA.x}, ${outA.z})` : "nowhere");
  const outB = riftStep(r, up(8, LANDED), open);
  check("and it goes the other way too, which is the point of it", outB !== null && outB.distanceTo(THREW_FROM) < 1e-9, outB ? `(${outB.x}, ${outB.z})` : "nowhere");
  check("anyone can use it, not just the squad that opened it", riftStep(r, up(99, LANDED), open) !== null, "id 99");
  check("you are not thrown straight back through the mouth you arrived in", riftStep(r, up(7, LANDED), open + RI.regap * 0.5) === null, `regap ${RI.regap} s`);
  check("standing between the mouths does nothing", riftStep(r, up(12, THREW_FROM.clone().lerp(LANDED, 0.5)), open) === null);
  check("and the rift expires", riftStep(r, up(13, THREW_FROM), r.until + 0.01) === null && !riftOpen(r, r.until + 0.01), `${RI.life} s open`);
}

// -------------------------------------------------------------------- downed
{
  const s = makeShockwave(1, true, AT, EAST, 0);
  const r = makeRift(1, true, THREW_FROM, LANDED, 0);
  check("a downed figure is not thrown by a shockwave", shockwaveLaunch(s, down(7, AT), S.arm + 0.01) === null);
  check("and a downed figure is not taken through a rift", riftStep(r, down(7, THREW_FROM), RI.arm + 0.01) === null);
  // and it was not simply that nothing was live: the same two, on their feet,
  // at the same moment, both go
  check(
    "the same two on their feet at that same moment both go",
    shockwaveLaunch(s, up(7, AT), S.arm + 0.01) !== null && riftStep(r, up(7, THREW_FROM), RI.arm + 0.01) !== null
  );
  const o = new Ordnance();
  o.endless = false;
  o.add("shockwave", 1);
  o.add("rift", 1);
  o.add("frag", 1);
  check("neither charge can be taken out while you are down", !o.canReady("shockwave", 0, true) && !o.canReady("rift", 0, true));
  check("and the key offers you neither", o.cycle(0, true) === "frag" && o.cycle(0, true) === null, "the frag is main.ts's to bar, not ours");
  check("on your feet, both are there", o.canReady("shockwave", 0) && o.canReady("rift", 0));
}

// ------------------------------------------------- counts and two in a row
check("a stack of shockwaves is two and a stack of rifts is one", Ordnance.stackOf("shockwave") === S.stack && Ordnance.stackOf("rift") === RI.stack && Ordnance.stackOf("frag") === cfg.stack, `${S.stack}, ${RI.stack}, and a frag's ${cfg.stack}`);
{
  const o = new Ordnance();
  o.endless = false;
  check("you cannot pick up more shockwaves than the stack holds", o.add("shockwave", 9) === S.stack && o.counts.shockwave === S.stack);
  check("nor more than one rift", o.add("rift", 9) === RI.stack && o.counts.rift === RI.stack);
}
{
  // two in a row, which is the whole of the worry: a stack that leaves the
  // hand in one second is a catapult, not a rotation
  const o = new Ordnance();
  o.endless = false;
  o.add("shockwave", S.stack);
  check("the first goes out", o.cycle(0) === "shockwave" && o.spend(0) === "shockwave" && o.counts.shockwave === S.stack - 1, `${o.counts.shockwave} left`);
  check("and the second is barred until the cooldown is up", o.cooldownLeft("shockwave", 0) === S.cooldown && !o.canReady("shockwave", S.cooldown - 0.01) && o.cycle(S.cooldown - 0.01) === null, `cooldown ${S.cooldown} s`);
  check("then it is there again", o.canReady("shockwave", S.cooldown) && o.cycle(S.cooldown) === "shockwave");
  o.spend(S.cooldown);
  check("and after the second the count, not the cooldown, is what stops you", o.counts.shockwave === 0 && o.cycle(S.cooldown * 9) === null, "nothing left to throw");
}
{
  const o = new Ordnance();
  o.endless = false;
  o.add("rift", 9);
  o.cycle(0);
  o.spend(0);
  check("a rift is a one-off: one thrown and there is no second to wait for", o.counts.rift === 0 && o.cycle(RI.cooldown * 2) === null);
}
{
  // the range never runs out, so a charge there is on its cooldown and nothing
  // else, which is what makes it the place to learn one
  const o = new Ordnance();
  let hand = o.cycle(0);
  while (hand && hand !== "shockwave") hand = o.cycle(0);
  const thrown = o.spend(0);
  check(
    "in the range the charges are endless, and only the cooldown holds you",
    thrown === "shockwave" && o.has("shockwave") && o.cooldownLeft("shockwave", 0) === S.cooldown && o.cycle(0) !== "shockwave",
    `the key reaches it fourth, past ${THROW_KINDS.slice(0, 3).join(", ")}`
  );
}
{
  const o = new Ordnance();
  o.endless = false;
  o.fill("kit");
  check("an arena kit carries neither charge: they are the battle royale's floor loot", o.counts.shockwave === 0 && o.counts.rift === 0 && o.counts.frag === cfg.kit.frag, `frag ${o.counts.frag}, shockwave ${o.counts.shockwave}, rift ${o.counts.rift}`);
}

export const mobilityFails = fails;
if (process.argv[1]?.includes("mobility")) console.log(fails ? `\n${fails} FAILED` : "\nmobility PASS");
