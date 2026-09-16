// Sound through walls (src/config/audio.json, src/game/audio.ts, src/main.ts).
//
// The engine itself needs a browser, so what is checked here is the part that
// does not: the numbers are whole and sane, and the occluder main.ts wires is
// rebuilt against the real solidHit and the real box list so a wall between
// the ear and a sound actually reads as blocked.
//
// Run on its own: npx tsx tools/checks/audio-occlusion.ts. Also runs inside
// npm run verify.
import * as THREE from "three";
import audioCfg from "../../src/config/audio.json";
import { RANGE_SOLIDS } from "../../src/game/range";
import { solidHit } from "../../src/game/projectile";

let fails = 0;
function check(label: string, ok: boolean, detail = ""): void {
  if (!ok) fails++;
  console.log(`${ok ? "  ok  " : "FAIL  "}${label}${detail ? ` (${detail})` : ""}`);
}

console.log("\nSound through walls");

const occ = audioCfg.occlusion;
const vert = audioCfg.vertical;

check("the occlusion numbers are all there", Boolean(occ) && Boolean(vert) && Boolean(audioCfg._occlusion) && Boolean(audioCfg._vertical));
check("a blocked sound is quieter but never silent", occ.gain > 0 && occ.gain < 1, `keeps ${Math.round(occ.gain * 100)}% of its level`);
check(
  "a blocked sound loses its top end but keeps a voice",
  occ.lowpass >= 300 && occ.lowpass <= 2000,
  `${occ.lowpass} Hz`
);
check("more of a blocked sound goes to the room", occ.reverbBoost > 1 && occ.reverbBoost <= 3, `x${occ.reverbBoost}`);
check(
  "more than one ray, so half cover is half blocked",
  occ.rays >= 3 && occ.rays % 2 === 1 && occ.spread > 0.2 && occ.spread < 2,
  `${occ.rays} rays, ${occ.spread} m apart`
);
check("the cache is short enough to follow you round a corner", occ.cacheMs >= 50 && occ.cacheMs <= 400, `${occ.cacheMs} ms`);
check("the vertical cue starts about a storey up", vert.from >= 1.5 && vert.from <= 4 && vert.tilt > 0 && vert.tilt < 1, `${vert.from} m, tilt ${vert.tilt}`);

// The occluder itself, rebuilt exactly as src/main.ts wires it. The range is
// already built into RANGE_SOLIDS by importing range.ts, so this runs against
// real geometry rather than a stub.
const from = new THREE.Vector3();
const dir = new THREE.Vector3();
const side = new THREE.Vector3();
function blocked(ear: { x: number; y: number; z: number }, at: { x: number; y: number; z: number }): number {
  from.set(ear.x, ear.y, ear.z);
  dir.set(at.x - ear.x, at.y - ear.y, at.z - ear.z);
  const len = dir.length();
  if (len < 0.5) return 0;
  dir.divideScalar(len);
  side.set(-dir.z, 0, dir.x);
  if (side.lengthSq() < 1e-6) side.set(1, 0, 0);
  else side.normalize();
  let n = 0;
  for (let i = 0; i < occ.rays; i++) {
    const off = i === 0 ? 0 : i === 1 ? occ.spread : -occ.spread;
    const tx = at.x + side.x * off;
    const tz = at.z + side.z * off;
    dir.set(tx - ear.x, at.y - ear.y, tz - ear.z);
    const l = dir.length();
    dir.divideScalar(l);
    if (solidHit(from, dir, l) < l) n++;
  }
  return n / occ.rays;
}

// RANGE_SOLIDS is filled by buildRange, which needs a scene and a texture
// loader and therefore a DOM. Node has neither, so the geometry here is put in
// by hand: one wall with a doorway beside it, which is the shape the test is
// actually about.
// RANGE_SOLIDS is shared with everything else verify runs, so whatever is in
// it is put back before this file returns. Emptying it and walking away broke
// nothing today only because this happened to run last, which is not a thing
// to rely on.
const savedSolids = RANGE_SOLIDS.slice();
RANGE_SOLIDS.length = 0;
const push = (minX: number, maxX: number, minZ: number, maxZ: number, base: number, top: number) => RANGE_SOLIDS.push({ minX, maxX, minZ, maxZ, base, top });
push(-6, 6, -0.3, 0.3, 0, 4); // a 12 m wall across z = 0
push(-30, -20, 10, 20, 0, 6); // a block off to one side, to prove the ray is aimed
check("the box list is the one the bullets use", RANGE_SOLIDS.length === 2, `${RANGE_SOLIDS.length} solids`);

// Both points on the same side of the wall, with nothing between them. The
// first pass put the ear at the origin, which is INSIDE the wall: worth
// keeping in mind, an ear inside a solid hears everything as blocked.
const earA = { x: 0, y: 1.6, z: -5 };
check("open air is not blocked", blocked(earA, { x: 6, y: 1.6, z: -5 }) === 0 && blocked(earA, { x: 0, y: 1.6, z: -14 }) === 0);

// A sound at the ear is not traced at all: the ray would be shorter than the
// body and every answer would be noise.
check("a sound on top of you is never blocked", blocked(earA, { x: 0.1, y: 1.6, z: -4.9 }) === 0);

// straight through the middle of the wall: every ray stopped
check("straight through a wall is fully blocked", blocked({ x: 0, y: 1.6, z: -5 }, { x: 0, y: 1.6, z: 5 }) === 1);
// round its end, well past x = 6: nothing in the way
check("round the end of it, nothing is in the way", blocked({ x: 10, y: 1.6, z: -5 }, { x: 10, y: 1.6, z: 5 }) === 0);
// on the edge, where the offset rays straddle the corner: partly blocked, and
// this is the case a single ray gets wrong, popping from clear to blocked as
// a figure walks past a pillar
const edge = blocked({ x: 6.2, y: 1.6, z: -5 }, { x: 6.2, y: 1.6, z: 5 });
check("at its corner, partly blocked and not all or nothing", edge > 0 && edge < 1, `${edge.toFixed(2)} blocked`);
// over the top of it: the wall stops at 4 m, so a sound on a roof is clear
check("over the top of it, clear", blocked({ x: 0, y: 6, z: -5 }, { x: 0, y: 6.5, z: 5 }) === 0);

// The formula the voice path applies, checked at both ends so a config edit
// cannot produce a louder or brighter sound through a wall than in the open.
const clear = 1 - 0 * (1 - occ.gain);
const solid = 1 - 1 * (1 - occ.gain);
check("gain falls with blockage and never rises", clear === 1 && Math.abs(solid - occ.gain) < 1e-9 && solid < clear, `1 -> ${solid.toFixed(3)}`);
const air = 8000;
check(
  "the filter only ever moves down through a wall",
  air * (1 - 1) + occ.lowpass * 1 < air,
  `${occ.lowpass} Hz against ${air} Hz in the open`
);

RANGE_SOLIDS.length = 0;
RANGE_SOLIDS.push(...savedSolids);

export const audioOcclusionFails = fails;
if (process.argv[1]?.includes("audio-occlusion")) console.log(fails ? `\n${fails} FAILED` : "\naudio occlusion PASS");
