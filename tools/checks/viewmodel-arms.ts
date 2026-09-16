// Where the first-person forearms actually end up, in the camera's own space
// (src/game/viewmodel.ts, src/game/arms.ts, src/config/viewmodel.json).
//
// The arms are the one part of the viewmodel that is not drawn where it is
// authored: a hand is placed on the gun, and the forearm is stretched from
// there back to the far end of the arm. Nothing on screen tells you how close
// to the eye that far end came, which is how the stub of an arm ended up in
// the middle of the frame on an inspect (docs/NEXT_STEPS.md item 1). These
// checks rebuild the maths the viewmodel runs, for every gun family and across
// the whole inspect, and look at the result in metres in front of the eye.
//
// No DOM: a gun model needs a canvas to build, so the four sample guns below
// carry the handful of landmarks the arms use, read out of gunmodels.ts with
// the models built.
//
// Run on its own: npx tsx tools/checks/viewmodel-arms.ts.
import * as THREE from "three";
import { Forearm, Hand, MIN_VIEW_DEPTH, SLEEVE_CAP } from "../../src/game/arms";
import { VM_SCALE, inspectTurn, shoulderAnchor, turnAboutCentre, type ArmFamily } from "../../src/game/viewmodel";

let fails = 0;
function check(label: string, cond: boolean, detail = ""): void {
  if (!cond) fails++;
  console.log(`${cond ? "  ok  " : "FAIL  "}${label}${detail ? ` (${detail})` : ""}`);
}

/** eye to rear sight when aiming down sights, src/game/viewmodel.ts */
const ADS_EYE = 0.26;
/** the camera: 90 degrees vertical on a 16:9 screen, near plane 0.02 m (src/main.ts) */
const HALF_H = Math.tan((90 * Math.PI) / 360);
const ASPECT = 16 / 9;
const NEAR = 0.02;
/** how many places along the inspect to look at */
const SAMPLES = 41;

interface Placement {
  x?: number;
  u: number;
  f: number;
  angle: number;
  scale?: number;
}
interface SampleGun {
  name: string;
  family: ArmFamily;
  grip: Placement;
  support: Placement;
  hip: [number, number, number];
  sightY: number;
  rearF: number;
  /** the middle of the model's own box, which is what a turn in the hands pivots about */
  centre: [number, number, number];
}

// The three families, plus the bow: it holds like a pistol and is a metre
// long, so it is the worst case for an arm that has to reach the far hand.
const GUNS: SampleGun[] = [
  {
    name: "rifle (guard)",
    family: "guard",
    grip: { u: -0.075, f: -0.047, angle: 0.32 },
    support: { u: -0.004, f: 0.2608, angle: Math.PI / 2, scale: 1.15 },
    hip: [0.21, -0.22, -0.5],
    sightY: 0.092,
    rearF: -0.105,
    centre: [0, -0.071, -0.061],
  },
  {
    // the two ends of the guard family's reach: the support hand sits 0.18 m
    // along a submachine gun and 0.35 m along a light machine gun
    name: "smg (guard)",
    family: "guard",
    grip: { u: -0.075, f: -0.047, angle: 0.32 },
    support: { u: -0.004, f: 0.1846, angle: Math.PI / 2, scale: 1.15 },
    hip: [0.21, -0.22, -0.5],
    sightY: 0.092,
    rearF: -0.065,
    centre: [0, -0.07, -0.017],
  },
  {
    name: "lmg (guard)",
    family: "guard",
    grip: { u: -0.075, f: -0.047, angle: 0.32 },
    support: { u: -0.012, f: 0.346, angle: Math.PI / 2, scale: 1.15 },
    hip: [0.21, -0.22, -0.5],
    sightY: 0.106,
    rearF: -0.105,
    centre: [0, -0.033, -0.117],
  },
  {
    name: "shotgun (pump)",
    family: "pump",
    grip: { u: -0.075, f: -0.047, angle: 0.32 },
    support: { u: -0.002, f: 0.25, angle: Math.PI / 2, scale: 1.15 },
    hip: [0.21, -0.22, -0.5],
    sightY: 0.106,
    rearF: -0.105,
    centre: [0, -0.017, -0.002],
  },
  {
    name: "revolver (pistol)",
    family: "pistol",
    grip: { u: -0.07, f: -0.064, angle: 0.36, scale: 1.08 },
    support: { x: -0.04, u: -0.088, f: -0.064, angle: 0.36, scale: 1.05 },
    hip: [0.16, -0.175, -0.42],
    sightY: 0.056,
    rearF: -0.042,
    centre: [0, -0.043, -0.095],
  },
  {
    name: "bow (pistol)",
    family: "pistol",
    grip: { u: -0.035, f: 0.2, angle: 0.1 },
    support: { x: 0, u: -0.035, f: 0.305, angle: 0.05 },
    hip: [0.13, -0.16, -0.34],
    sightY: 0.035,
    rearF: 0.18,
    centre: [-0.003, 0, -0.579],
  },
];

// ---- the rig: the viewmodel's own parenting, one scale and one pose
const groupMatrix = new THREE.Matrix4().makeScale(VM_SCALE, VM_SCALE, VM_SCALE);
const right = new Hand(false);
const left = new Hand(true);
const rightArm = new Forearm();
const leftArm = new Forearm();
const pose = new THREE.Object3D();
let family: ArmFamily = "guard";

/** put the hands on a gun, the way ViewModel.placeHands does */
function placeHands(g: SampleGun): void {
  family = g.family;
  const s = g.grip.scale ?? 1;
  right.group.position.set(g.grip.x ?? 0, g.grip.u, -g.grip.f);
  right.group.rotation.set(-g.grip.angle, 0, 0);
  right.group.scale.set(s, s, s);
  const ss = g.support.scale ?? 1;
  left.group.position.set(g.support.x ?? 0, g.support.u, -g.support.f);
  left.group.rotation.set(-g.support.angle, 0, g.family === "pistol" ? 0 : 0.55, "ZYX");
  left.group.scale.set(-ss, ss, ss);
}

/**
 * The gun's pose: the hip or the sight line, the idle turn, and an inspect's
 * own offset and turn taken about the gun's centre, the way the viewmodel
 * takes it. An `inspect` below zero is no inspect at all.
 */
function setPose(g: SampleGun, ads: number, inspect: number): void {
  const p = new THREE.Vector3(...g.hip);
  p.lerp(new THREE.Vector3(0, -g.sightY, g.rearF - ADS_EYE), ads);
  const base = new THREE.Euler(0, 0.05 * (1 - ads), 0);
  const rot = new THREE.Euler(base.x, base.y, base.z);
  if (inspect >= 0) {
    const off = new THREE.Vector3();
    const turn = new THREE.Euler();
    inspectTurn(inspect, off, turn);
    p.add(off);
    rot.set(rot.x + turn.x, rot.y + turn.y, rot.z + turn.z);
    turnAboutCentre(p, base, rot, new THREE.Vector3(...g.centre));
  }
  pose.position.copy(p);
  pose.rotation.copy(rot);
  pose.updateMatrix();
}

const toView = new THREE.Matrix4();
const poseInv = new THREE.Matrix4();
const anchor = new THREE.Vector3();

interface ArmEnds {
  arm: string;
  wrist: THREE.Vector3;
  elbow: THREE.Vector3;
  /** the same two, as the animation asked for them, before the guard had a say */
  asked: [THREE.Vector3, THREE.Vector3];
}

/** both arms for the pose that is set, with their two ends in camera space */
function arms(ads: number, magDown = 0): ArmEnds[] {
  toView.multiplyMatrices(groupMatrix, pose.matrix);
  poseInv.copy(pose.matrix).invert();
  const out: ArmEnds[] = [];
  const ends = (arm: Forearm): [THREE.Vector3, THREE.Vector3] => {
    arm.group.updateMatrix();
    return [
      new THREE.Vector3(0, 0, 0).applyMatrix4(arm.group.matrix).applyMatrix4(toView),
      new THREE.Vector3(0, 1, 0).applyMatrix4(arm.group.matrix).applyMatrix4(toView),
    ];
  };
  for (const [hand, arm, side] of [
    [right, rightArm, "right"],
    [left, leftArm, "left"],
  ] as const) {
    // a magazine reload takes the support hand off the gun and down the well
    const wrist = hand.wrist(new THREE.Vector3());
    if (side === "left") wrist.y -= magDown;
    shoulderAnchor(anchor, family, side, ads).applyMatrix4(poseInv);
    // twice: once as asked, once through the guard, so a check can say whether
    // the guard is a backstop or is holding the pose up
    arm.set(wrist, anchor);
    const asked = ends(arm);
    arm.set(wrist, anchor, toView);
    const [w, e] = ends(arm);
    out.push({ arm: side, wrist: w, elbow: e, asked });
  }
  return out;
}

/** the flat full-width end this replaced, for the size of the win */
const OLD_SLEEVE_END = 0.06;
/** how much of the screen's height an arm end of this radius covers, 0..1 */
const coverage = (r: number, depth: number) => (r * VM_SCALE) / (depth * HALF_H);
/** a point outside the frame, which is where the end of an arm belongs */
const offScreen = (p: THREE.Vector3) => Math.abs(p.y) > HALF_H * -p.z || Math.abs(p.x) > HALF_H * ASPECT * -p.z;

// -------------------------------------------------- 1. nothing near the eye
console.log(`Arm ends, metres in front of the eye (near plane ${NEAR} m, guard ${MIN_VIEW_DEPTH} m)`);
for (const g of GUNS) {
  placeHands(g);
  let worst = Infinity;
  let worstAt = "";
  let inFrame = 0;
  let cover = 0;
  let coverOld = 0;
  let samples = 0;
  let shortest = Infinity;
  let longest = 0;
  let bitten = 0;
  for (const ads of [0, 0.5, 1]) {
    for (let i = -1; i < SAMPLES; i++) {
      const t = i / (SAMPLES - 1);
      // i below 0 is the resting pose and 0 the deepest of a magazine reload;
      // the rest walk the inspect at that aim blend
      if (i <= 0) setPose(g, ads, -1);
      else setPose(g, ads, t);
      if (i === 0) {
        // the reload's own tilt, at the middle of it (ViewModel.update)
        pose.position.set(pose.position.x - 0.02, pose.position.y - 0.03, pose.position.z);
        pose.rotation.set(pose.rotation.x + 0.12, pose.rotation.y, pose.rotation.z - 0.38);
        pose.updateMatrix();
      }
      for (const e of arms(ads, i === 0 ? 0.12 : 0)) {
        const len = e.wrist.distanceTo(e.elbow);
        shortest = Math.min(shortest, len);
        longest = Math.max(longest, len);
        if (Math.max(e.wrist.distanceTo(e.asked[0]), e.elbow.distanceTo(e.asked[1])) > 1e-9) bitten++;
        for (const [what, p] of [
          ["wrist", e.asked[0]],
          ["elbow", e.asked[1]],
        ] as const) {
          const depth = -p.z;
          if (depth < worst) {
            worst = depth;
            worstAt = `${e.arm} ${what}, ads ${ads}, ${i < 0 ? "resting" : i === 0 ? "reloading" : `inspect ${t.toFixed(2)}`}`;
          }
          if (what === "wrist") continue;
          samples++;
          if (!offScreen(p)) inFrame++;
          cover = Math.max(cover, coverage(SLEEVE_CAP, depth));
          coverOld = Math.max(coverOld, coverage(OLD_SLEEVE_END, depth));
        }
      }
    }
  }
  check(`${g.name}: no arm end inside the guard, resting, reloading, aimed or mid inspect`, worst >= MIN_VIEW_DEPTH - 1e-9, `nearest ${worst.toFixed(3)} m at the ${worstAt}`);
  // the anchors carry the poses on their own; the guard is there for the pose
  // nobody has written yet, and should never be the thing holding one up
  check(`${g.name}: and the guard never has to bite`, bitten === 0, `${bitten} of ${samples} arms moved by it`);
  check(`${g.name}: which leaves the near plane clear`, worst >= NEAR * 2, `${(worst / NEAR).toFixed(1)}x the near plane`);
  check(`${g.name}: and the stub of the arm stays out of frame`, inFrame === 0, `${inFrame} of ${samples} samples in frame; in one its end would cover ${(cover * 100).toFixed(0)}% of the screen's height, where the old flat one covered ${(coverOld * 100).toFixed(0)}%`);
  // an anchor moved without looking shows up here: the sleeve is drawn at a
  // fixed width and stretched to fit, so a far one is a pipe and a near one a stub
  check(`${g.name}: the forearm stays a forearm`, shortest >= 0.1 && longest <= 0.4, `${shortest.toFixed(2)} to ${longest.toFixed(2)} m of sleeve`);
}

// the guard on its own, asked for the two things an animation can ask for
{
  const endOf = (z: number): number => {
    const arm = new Forearm();
    arm.set(new THREE.Vector3(0, 0, -0.5), new THREE.Vector3(0.1, -0.1, z), groupMatrix);
    arm.group.updateMatrix();
    return -new THREE.Vector3(0, 1, 0).applyMatrix4(arm.group.matrix).applyMatrix4(groupMatrix).z;
  };
  const atEye = endOf(-0.01);
  const behind = endOf(0.3);
  check("an arm end asked for at the eye is put back to the guard", Math.abs(atEye - MIN_VIEW_DEPTH) < 1e-9, `${atEye.toFixed(3)} m`);
  check("and one asked for behind the eye comes back in front of it", behind >= MIN_VIEW_DEPTH - 1e-9, `${behind.toFixed(3)} m`);
}

// --------------------------------------- 2. the arm ends do not ride the gun
console.log("\nThe far end of an arm is a joint on the body: the gun turns in front of it");
for (const g of GUNS) {
  placeHands(g);
  const held: THREE.Vector3[] = [];
  const gunLocal: THREE.Vector3[] = [];
  // the same point kept in gun space, which is where the elbows used to live
  const asGunLocal = new THREE.Vector3(0.1, -0.355, 0.387);
  for (const rx of [-0.4, 0, 0.5]) {
    for (const ry of [-0.7, 0, 1.05]) {
      for (const rz of [-0.95, 0, Math.PI]) {
        pose.position.set(...g.hip);
        pose.rotation.set(rx, ry, rz);
        pose.updateMatrix();
        held.push(arms(0)[0]!.elbow.clone());
        gunLocal.push(asGunLocal.clone().applyMatrix4(pose.matrix).multiplyScalar(VM_SCALE));
      }
    }
  }
  const spread = (v: THREE.Vector3[]): number => Math.max(...v.map((p) => p.distanceTo(v[0]!)));
  check(`${g.name}: the arm's far end holds still while the gun turns`, spread(held) < 1e-9, `moves ${(spread(held) * 1000).toFixed(3)} mm over ${held.length} turns, where a gun-local one moves ${(spread(gunLocal) * 100).toFixed(0)} cm`);
}

// ---------------------------------- 3. an inspect turns the gun about itself
console.log("\nAn inspect turns the gun about its own middle, not about the model's origin");
for (const g of GUNS) {
  const centre = new THREE.Vector3(...g.centre);
  const rest = new THREE.Vector3();
  let drift = 0;
  let uncorrected = 0;
  for (let i = 0; i < SAMPLES; i++) {
    const t = i / (SAMPLES - 1);
    setPose(g, 0, t);
    const off = new THREE.Vector3();
    const turn = new THREE.Euler();
    inspectTurn(t, off, turn);
    // where the middle of the gun is, with the inspect's own move taken back off
    const at = centre.clone().applyMatrix4(pose.matrix).sub(off);
    if (i === 0) rest.copy(at);
    drift = Math.max(drift, at.distanceTo(rest));
    // the same turn about the model's origin, which is where it used to happen
    const naive = centre.clone().applyEuler(new THREE.Euler(turn.x, 0.05 + turn.y, turn.z)).add(new THREE.Vector3(...g.hip));
    uncorrected = Math.max(uncorrected, naive.distanceTo(rest));
  }
  check(`${g.name}: the middle of the gun stays put through the inspect`, drift < 1e-9, `drifts ${(drift * 1000).toFixed(3)} mm, where turning about the model's origin swings it ${(uncorrected * 100).toFixed(0)} cm`);
}

// --------------------------------------------- 4. the elbow end of a sleeve
console.log("\nThe elbow end of a sleeve");
{
  const arm = new Forearm();
  const params = (o: THREE.Object3D) => ((o as THREE.Mesh).geometry as THREE.BufferGeometry & { parameters?: Record<string, number> }).parameters ?? {};
  let widest = 0;
  let domed = false;
  for (const child of arm.group.children) {
    const par = params(child);
    if (par.height !== undefined) {
      // a cylinder: the radius at its top is the one facing the elbow
      if (child.position.y + par.height / 2 > 0.9) widest = Math.max(widest, par.radiusTop ?? 0);
    } else if (par.radius !== undefined && Math.abs(child.position.y - 1) < 1e-6) {
      domed = true;
      widest = Math.max(widest, par.radius);
    }
  }
  check("it narrows to a stub rather than a full-width disc", widest <= SLEEVE_CAP + 1e-9, `${(widest * 1000).toFixed(0)} mm of radius, where the sleeve is 58 mm`);
  check("and it is closed over with a dome", domed);
  // the arm is stretched along its own length, which flattens a dome with it
  arm.set(new THREE.Vector3(0, 0, -0.5), new THREE.Vector3(0.3, -0.6, -0.2));
  const cap = arm.group.children.find((c) => params(c).radius !== undefined)!;
  const stretch = arm.group.scale.y * cap.scale.y;
  check("the dome stays round however far the arm is stretched", Math.abs(stretch - 1) < 1e-9, `${stretch.toFixed(6)} of its own height`);
}

console.log(fails === 0 ? "\nVIEWMODEL ARMS PASS" : `\nVIEWMODEL ARMS FAIL (${fails})`);
export const viewmodelArmsFails = fails;
if (process.argv[1]?.endsWith("viewmodel-arms.ts")) process.exit(fails === 0 ? 0 : 1);
