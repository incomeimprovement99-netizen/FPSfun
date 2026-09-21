// How thick the body actually is, measured off the model rather than guessed.
//
// src/config/outfits.json holds `fit`: the body's own thickness at each bone,
// which every garment sits just outside of. Those numbers began as estimates,
// and an estimate that is too small is a garment the body pokes through: a
// sleeve 8.4 cm across on a 9 cm arm shows bare skin in stripes, and it shows
// it worst on the leanest build, whose cloth is the thinnest of the three.
//
// So this measures. It reads the mannequin's own .glb, takes every vertex of
// the skinned mesh, puts it in the frame of the bone that owns it (the joint
// with the most weight), and measures how far out it sits from that bone's
// axis. The bones all point along their own +y, so that distance is the
// radius of the body there. What is checked is that every garment in the
// wardrobe clears that radius at every build, which is the thing an eye
// notices and a fit table cannot state on its own.
//
// Run on its own: npx tsx tools/checks/body.ts.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import * as THREE from "three";
import outfitCfg from "../../src/config/outfits.json";

let fails = 0;
function check(label: string, cond: boolean, detail = ""): void {
  if (!cond) fails++;
  console.log(`${cond ? "  ok  " : "FAIL  "}${label}${detail ? ` (${detail})` : ""}`);
}

interface Gltf {
  nodes?: Array<{ name?: string; mesh?: number; skin?: number; children?: number[] }>;
  meshes?: Array<{ primitives: Array<{ attributes: Record<string, number> }> }>;
  skins?: Array<{ inverseBindMatrices?: number; joints: number[] }>;
  accessors?: Array<{ bufferView?: number; byteOffset?: number; componentType: number; count: number; type: string }>;
  bufferViews?: Array<{ byteOffset?: number; byteLength: number; byteStride?: number }>;
}

const GLB = resolve(process.cwd(), "public/models/mannequin/mannequin.glb");

function readGlb(path: string): { json: Gltf; bin: Buffer } {
  const b = readFileSync(path);
  const jsonLen = b.readUInt32LE(12);
  const json = JSON.parse(b.subarray(20, 20 + jsonLen).toString("utf8")) as Gltf;
  const binStart = 20 + jsonLen;
  return { json, bin: b.subarray(binStart + 8, binStart + 8 + b.readUInt32LE(binStart)) };
}

/** the components of one accessor, read out of the binary chunk */
const SIZE: Record<number, number> = { 5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4 };
const PARTS: Record<string, number> = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };

function read(json: Gltf, bin: Buffer, index: number): number[] {
  const a = json.accessors?.[index];
  if (!a || a.bufferView === undefined) throw new Error(`accessor ${index}`);
  const v = (json.bufferViews ?? [])[a.bufferView];
  const parts = PARTS[a.type];
  const size = SIZE[a.componentType];
  const stride = v.byteStride && v.byteStride > 0 ? v.byteStride : parts * size;
  const start = (v.byteOffset ?? 0) + (a.byteOffset ?? 0);
  const out: number[] = [];
  for (let i = 0; i < a.count; i++) {
    for (let p = 0; p < parts; p++) {
      const at = start + i * stride + p * size;
      out.push(
        a.componentType === 5126
          ? bin.readFloatLE(at)
          : a.componentType === 5125
            ? bin.readUInt32LE(at)
            : a.componentType === 5123
              ? bin.readUInt16LE(at)
              : a.componentType === 5122
                ? bin.readInt16LE(at)
                : a.componentType === 5121
                  ? bin.readUInt8(at)
                  : bin.readInt8(at)
      );
    }
  }
  return out;
}

/** the bone a garment hangs on, from the joint name the model uses */
function boneOf(name: string): string | null {
  const n = name.toLowerCase();
  if (n.startsWith("upperarm")) return "arm";
  if (n.startsWith("lowerarm")) return "forearm";
  if (n.startsWith("thigh")) return "thigh";
  if (n.startsWith("calf")) return "calf";
  // the body itself: three spine bones and the two collarbones, all of which a
  // jacket has to cover, measured in the frame of the bone it hangs on
  if (n.startsWith("spine") || n.startsWith("pelvis") || n.startsWith("clavicle")) return "torso";
  return null;
}

console.log("How thick the body is, measured off the model");

const { json, bin } = readGlb(GLB);
const nodes = json.nodes ?? [];
const skinned = nodes.find((n) => n.skin !== undefined && n.mesh !== undefined);
check("the mannequin has a skinned mesh to measure", Boolean(skinned), skinned?.name ?? "none");
const skin = json.skins?.[skinned!.skin!];
const prim = json.meshes?.[skinned!.mesh!].primitives[0];
const pos = read(json, bin, prim!.attributes.POSITION);
const joints = read(json, bin, prim!.attributes.JOINTS_0);
const weights = read(json, bin, prim!.attributes.WEIGHTS_0);
const ibm = read(json, bin, skin!.inverseBindMatrices!);
check("with the skin, its joints and their bind poses", pos.length > 0 && joints.length > 0 && ibm.length === skin!.joints.length * 16, `${pos.length / 3} vertices, ${skin!.joints.length} joints`);

// every vertex, in the frame of the bone that owns it
const radii = new Map<string, number[]>();
/** the body's own half-width, and its front and back, in the spine bone's frame */
const torso: Array<[number, number, number]> = [];
const clav: Array<[number, number, number]> = [];
const byJoint = new Map<string, Array<[number, number, number]>>();
const spineJoint = skin!.joints.findIndex((j) => (nodes[j]?.name ?? "").toLowerCase().startsWith("spine_01"));
/** the same radii, kept with where along the bone they sit, so the taper can be seen */
const alongs = new Map<string, Array<[number, number]>>();
const LEN: Record<string, number> = { arm: 0.274, forearm: 0.273, thigh: 0.4, calf: 0.429 };
const m = new THREE.Matrix4();
const v = new THREE.Vector3();
for (let i = 0; i < pos.length / 3; i++) {
  let best = 0;
  let bestW = -1;
  for (let k = 0; k < 4; k++) {
    if (weights[i * 4 + k] > bestW) {
      bestW = weights[i * 4 + k];
      best = joints[i * 4 + k];
    }
  }
  const bone = boneOf(nodes[skin!.joints[best]]?.name ?? "");
  if (!bone) continue;
  // A vertex shared between two bones belongs to neither, EXCEPT down the
  // middle of the body: the chest is spread over three spine bones and two
  // collarbones, and at a half share the whole of it drops out. That is how a
  // jacket came to be measured off the shoulder caps alone.
  if (bestW <= (bone === "torso" ? 0.25 : 0.5)) continue;
  m.fromArray(ibm, bone === "torso" ? spineJoint * 16 : best * 16);
  v.set(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]).applyMatrix4(m);
  if (bone === "torso" && (nodes[skin!.joints[best]]?.name ?? "").toLowerCase().startsWith("clavicle")) clav.push([Math.abs(v.x), v.z, v.y]);
  if (bone === "torso" && process.env.BODY_SPREAD) {
    const nm = (nodes[skin!.joints[best]]?.name ?? "?").toLowerCase();
    const l = byJoint.get(nm) ?? [];
    l.push([v.x, v.y, v.z]);
    byJoint.set(nm, l);
  }
  if (bone === "torso") {
    // a box, not a tube: how far out to the side, and how far front and back
    torso.push([Math.abs(v.x), v.z, v.y]);
    continue;
  }
  // the bones point along their own +y, so the distance from that axis is the
  // body's radius there; the ends of a limb taper, so they are left out
  const list = radii.get(bone) ?? [];
  list.push(Math.hypot(v.x, v.z));
  radii.set(bone, list);
  const along = alongs.get(bone) ?? [];
  along.push([v.y / (LEN[bone] ?? 0.3), Math.hypot(v.x, v.z)]);
  alongs.set(bone, along);
}

/** the thickest the body gets at a bone, ignoring the last one vertex in fifty (a seam, a stray) */
function widest(bone: string): number {
  const list = (radii.get(bone) ?? []).slice().sort((a, b) => a - b);
  return list.length ? list[Math.floor(list.length * 0.95)] : 0;
}

/**
 * The body's radius a fraction of the way along a bone: the 95th percentile of
 * the vertices within a tenth of the bone either side of it, so a garment
 * built on it covers nearly every vertex without being sized by the single
 * widest one. The window widens if there is nothing in it, which happens at
 * the very ends of a bone where the mesh has already handed over to the next.
 */
function radiusAt(bone: string, t: number): number {
  const all = alongs.get(bone) ?? [];
  for (let w = 0.06; w <= 0.5; w += 0.06) {
    const inn = all.filter(([f]) => Math.abs(f - t) <= w).map(([, r]) => r).sort((a, b) => a - b);
    if (inn.length >= 6) return inn[Math.floor(inn.length * 0.95)];
  }
  return widest(bone);
}

/** how many samples a profile holds, from the start of the bone to its end */
const STEPS = 6;
const round = (n: number): number => Math.round(n * 1000) / 1000;
/**
 * A sample is the WIDEST the body gets in the stretch of bone that sample
 * governs, not the width at the point itself. A garment is drawn by running a
 * line between the samples, so a sample taken at a point can leave a bulge
 * between two of them outside the cloth: the knee did exactly that.
 */
function spanMax(bone: string, i: number): number {
  const half = 1 / (2 * (STEPS - 1));
  const t = i / (STEPS - 1);
  let m = 0;
  for (let k = 0; k <= 10; k++) m = Math.max(m, radiusAt(bone, t - half + (2 * half * k) / 10));
  return m;
}

const MEASURED_PROFILE: Record<string, number[]> = {};
for (const bone of ["arm", "forearm", "thigh", "calf"]) {
  MEASURED_PROFILE[bone] = Array.from({ length: STEPS }, (_, i) => round(spanMax(bone, i)));
}
if (process.env.BODY_SPREAD) console.log(`
  measured profile, to paste into outfits.json:
  ${JSON.stringify(MEASURED_PROFILE)}
`);

const MEASURED: Record<string, number> = {
  arm: widest("arm"),
  forearm: widest("forearm"),
  thigh: widest("thigh"),
  calf: widest("calf"),
};
for (const [bone, r] of Object.entries(MEASURED)) {
  check(`the ${bone} is measurable`, r > 0.02 && r < 0.2, `${(r * 1000).toFixed(0)} mm of body`);
}

// The fit table is what every garment is built from, so it has to be the body
// rather than a guess about it. It holds a profile per bone, because a limb is
// not a cylinder: the arm is 84 mm at the shoulder and 61 mm at the elbow, and
// the calf is 61 mm at the knee, 104 mm at the muscle and 54 mm at the ankle.
// A garment built on one number is either inside the body at the wide end or a
// barrel at the narrow one.
const FIT = outfitCfg.fit as unknown as { profile: Record<string, number[]> } & Record<string, number>;
for (const [bone, measured] of Object.entries(MEASURED_PROFILE)) {
  const have = FIT.profile?.[bone] ?? [];
  const off = have.length === measured.length ? Math.max(...measured.map((r, i) => Math.abs(r - have[i]))) : 1;
  check(
    `outfits.json holds the ${bone}'s own shape, measured`,
    off <= 0.004,
    have.length === measured.length ? `worst sample is ${(off * 1000).toFixed(1)} mm out` : `${have.length} samples against ${measured.length} measured`
  );
}
for (const [bone, r] of Object.entries(MEASURED)) {
  check(`and the ${bone}'s one number, for the checks that want one`, Math.abs(FIT[bone] - r) <= 0.006, `config ${(FIT[bone] * 1000).toFixed(0)} mm against a measured ${(r * 1000).toFixed(0)} mm`);
}

// The body is a box rather than a tube, and it was guessed too: how wide it is
// across the shoulders, how deep front to back, and where its middle sits
// relative to the spine bone, which runs up the back rather than the middle.
{
  const pct = (list: number[], f: number): number => {
    const l = list.slice().sort((a, b) => a - b);
    return l.length ? l[Math.floor(l.length * f)] : 0;
  };
  // The body up the spine bone, band by band, the way the limbs are measured
  // along theirs: how wide it is, how deep, and where its middle sits. One box
  // cannot hold a body that leans; six bands can. The span is the jacket's own
  // (outfits.json pieces.jacket), in the bone's own units.
  const SPINE = 0.265;
  const lo = -0.26 * SPINE;
  const hi = 1.62 * SPINE;
  const BANDS = 6;
  const band = (i: number): { at: number; w: number; d: number; mid: number } => {
    const y = lo + ((hi - lo) * i) / (BANDS - 1);
    let half = 0.05;
    let inn: Array<[number, number, number]> = [];
    while (inn.length < 12 && half < 0.3) {
      inn = torso.filter(([, , vy]) => Math.abs(vy - y) <= half);
      half += 0.03;
    }
    const f = pct(inn.map(([, z]) => z), 0.97);
    const b = -pct(inn.map(([, z]) => -z), 0.97);
    return { at: y / SPINE, w: pct(inn.map(([x]) => x), 0.97) * 2, d: f - b, mid: (f + b) / 2 };
  };
  const bands = Array.from({ length: BANDS }, (_, i) => band(i));
  const r3 = (n: number): number => Math.round(n * 1000) / 1000;
  if (process.env.BODY_SPREAD) {
    console.log(`
  the body up the spine, to paste into outfits.json fit.body:
  ${JSON.stringify({ from: -0.26, to: 1.62, w: bands.map((b) => r3(b.w)), d: bands.map((b) => r3(b.d)), mid: bands.map((b) => r3(b.mid)) })}
`);
  }
  // the chest and shoulders, not the hips: the top two thirds of the body
  const up = torso.filter(([, , y]) => y > -0.05);
  const halfW = pct(up.map(([x]) => x), 0.97);
  const front = pct(up.map(([, z]) => z), 0.97);
  const back = -pct(up.map(([, z]) => -z), 0.97);
  // Which way is forward in the spine bone's own frame? The config had a
  // garment pushed 48 mm one way on the strength of a measurement I took by
  // eye, and a sign error there puts a jacket in front of the chest with the
  // body standing out of the back of it. The feet settle it: the toes are in
  // front of the ankle, on any rig, so the direction from one to the other is
  // forward, and putting that direction in the spine's frame says which z it is.
  const originOf = (joint: number): THREE.Vector3 => new THREE.Vector3().setFromMatrixPosition(new THREE.Matrix4().fromArray(ibm, joint * 16).invert());
  const jointNamed = (want: string): number => skin!.joints.findIndex((j) => (nodes[j]?.name ?? "").toLowerCase().startsWith(want));
  const toe = jointNamed("ball_l");
  const ankle = jointNamed("foot_l");
  const spineRot = new THREE.Matrix4().fromArray(ibm, spineJoint * 16).setPosition(0, 0, 0);
  const fwd = toe >= 0 && ankle >= 0 ? originOf(toe).sub(originOf(ankle)).applyMatrix4(spineRot).normalize() : new THREE.Vector3(0, 0, -1);
  check("which way the body faces, measured off its own toes", Math.abs(fwd.z) > 0.7, `forward is ${fwd.z < 0 ? "-z" : "+z"} in the spine bone's frame (${fwd.x.toFixed(2)}, ${fwd.y.toFixed(2)}, ${fwd.z.toFixed(2)})`);
  if (process.env.BODY_SPREAD) {
    const q = (l: number[], f: number) => (pct(l, f) * 1000).toFixed(0);
    for (const [tag, set] of [["all", torso], ["chest only", torso.filter(([, , y]) => y > 0.1)], ["clavicles", clav]] as const) {
      console.log(`      ${tag}: ${set.length} vertices, |x| 97% ${q(set.map(([x]) => x), 0.97)} mm, z 3% ${q(set.map(([, z]) => z), 0.03)}, z 50% ${q(set.map(([, z]) => z), 0.5)}, z 97% ${q(set.map(([, z]) => z), 0.97)}`);
    }
  }
  if (process.env.BODY_SPREAD) {
    for (const [name, l] of byJoint) {
      const zs = l.map(([, , z]) => z).sort((a, b) => a - b);
      const ys = l.map(([, y]) => y).sort((a, b) => a - b);
      console.log(`      ${name}: ${l.length}, z ${(zs[0] * 1000).toFixed(0)} .. ${(zs[zs.length - 1] * 1000).toFixed(0)} (mid ${(zs[Math.floor(zs.length / 2)] * 1000).toFixed(0)}), y ${(ys[0] * 1000).toFixed(0)} .. ${(ys[ys.length - 1] * 1000).toFixed(0)}`);
    }
  }
  check("the body is measurable across the shoulders", halfW > 0.1 && halfW < 0.35, `${(halfW * 2000).toFixed(0)} mm across, ${((front - back) * 1000).toFixed(0)} deep, middle ${(((front + back) / 2) * 1000).toFixed(0)} mm in front of the spine bone`);
  // What the jacket is actually built on now: the bands, checked the way the
  // limbs are. A body that leans cannot be held by one box, so the garment is
  // a tube of rectangular sections up the bone, and what matters is that no
  // band of it is inside the body at the leanest build.
  const cfg = (outfitCfg.fit as unknown as { body: { from: number; to: number; w: number[]; d: number[]; mid: number[] } }).body;
  const jacket = (outfitCfg.pieces as Record<string, { over: number }>).jacket;
  const lean = Math.min(...Object.values(outfitCfg.builds).map((b) => b.cloth));
  check("outfits.json holds the body's own shape up the spine", cfg && cfg.w.length === BANDS && cfg.d.length === BANDS && cfg.mid.length === BANDS, `${cfg?.w.length ?? 0} bands`);
  let worstW = 9;
  let worstD = 9;
  let where = "";
  for (let i = 0; i < BANDS; i++) {
    const b = bands[i];
    const gw = cfg.w[i] / 2 + jacket.over * lean - b.w / 2;
    const gd = cfg.d[i] / 2 + jacket.over * lean - (b.d / 2 + Math.abs(cfg.mid[i] - b.mid));
    if (gw < worstW) {
      worstW = gw;
      where = `band ${i} of ${BANDS}`;
    }
    worstD = Math.min(worstD, gd);
  }
  check("and the jacket clears the body at every band of it, on the leanest build", worstW >= 0.002 && worstD >= 0.002, `${(Math.min(worstW, worstD) * 1000).toFixed(1)} mm at its worst, ${where}`);
  check("the body leans, which is the thing one box could not hold", Math.abs(cfg.mid[0] - cfg.mid[BANDS - 1]) > 0.04, `${((cfg.mid[0] - cfg.mid[BANDS - 1]) * 1000).toFixed(0)} mm from the hips to the collar`);

  // the kit (gear.json) is not on these bands and never was: it has its own
  // numbers on the upper spine bone. This says what it would have to clear if
  // it were measured the same way, which is the next of these.
  if (process.env.BODY_SPREAD) console.log(`      (the chest the kit hangs on: ${((front - back) * 1000).toFixed(0)} mm deep, middle running ${(cfg.mid[0] * 1000).toFixed(0)} to ${(cfg.mid[BANDS - 1] * 1000).toFixed(0)} mm)`);
}

// and the thing an eye sees: at the leanest build, does the cloth still clear?
const PIECES = outfitCfg.pieces as Record<string, { bone: string; from: number; to: number; over: number }>;
const BONE: Record<string, string> = { upperarm: "arm", lowerarm: "forearm", thigh: "thigh", calf: "calf" };
const leanest = Math.min(...Object.values(outfitCfg.builds).map((b) => b.cloth));
for (const [name, p] of Object.entries(PIECES)) {
  const bone = BONE[p.bone];
  if (!bone) continue;
  // the garment follows the profile, so the check is the worst point of the
  // span it covers, not the worst point of the whole limb
  let worst = 9;
  let at = 0;
  for (let i = 0; i <= 20; i++) {
    const t = Math.max(0, Math.min(1, p.from + ((p.to - p.from) * i) / 20));
    // the same line the garment is drawn on (outfit.ts bodyAt)
    const prof = FIT.profile[bone];
    const step = Math.max(0, Math.min(1, t)) * (prof.length - 1);
    const s0 = Math.min(prof.length - 2, Math.floor(step));
    const cloth = prof[s0] + (prof[s0 + 1] - prof[s0]) * (step - s0) + p.over * leanest;
    const gap = cloth - radiusAt(bone, t);
    if (gap < worst) {
      worst = gap;
      at = t;
    }
  }
  check(`${name}: the body does not come through it, even on the leanest build`, worst >= 0.002, `${(worst * 1000).toFixed(1)} mm of clearance, ${(at * 100).toFixed(0)}% along the bone`);
}
console.log(fails === 0 ? "\nBODY PASS" : `\nBODY FAIL (${fails})`);
export const bodyFails = fails;
if (process.argv[1]?.endsWith("body.ts")) process.exit(fails === 0 ? 0 : 1);
