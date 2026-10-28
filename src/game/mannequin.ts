// The figure: the bought soldier (soldier.ts) playing Quaternius's Universal Animation Library clips (CC0;
// public/models/mannequin), carried over to its rig (retarget.ts). A figure made before it is ready is its hit volumes
// alone until it is (dummy.ts dress). The library's clips are pistol clips
// (it has no rifle set), so a pistol is held as the aim clip holds it, and a
// long gun is not: it hangs off the chest with its stock in the right
// shoulder, and both arms reach onto it (a two-bone IK to the grip and the
// handguard), lowered and canted across the body for a sprint or a swap. The
// hit zones are the Dummy's own invisible boxes either way, so the choice
// changes nothing about what a bullet hits.
//
// The body is two layers. The legs (and the hips' bob) play the locomotion
// clip for the stance and speed: idle, walk, jog, sprint, crouched, backward
// by running the clip in reverse. The upper body plays the hands' clip: the
// aim pose, the reload, the gun lowered for a sprint or a swap; an
// unarmed figure's arms swing with the legs. Then, on top of the clips, the
// corrections the pose asks for (dummy.ts animate): the hips turn toward a strafe and the
// spine turns back onto the aim, the spine bends to the look pitch, a shot
// kicks, a hit flinches, a JOLT leans.
import * as THREE from "three";
import { fitGlint, fitMuzzle } from "./muzzle";
import { opticInfo } from "./optics";
import { ammoTypeOf } from "./ammo";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import { displayGunModel } from "./gunmodels";
import { LOWER as CARRY, REACH, gripAt, reachFraction, stockBehind } from "./hold";
import type { OperatorSkin } from "./operators";
import vmCfg from "../config/viewmodel.json";
import figureCfg from "../config/figure.json";
import perfCfg from "../config/perf.json";
import { slow } from "./slow";
import soldierHold from "../config/soldierhold.json";
import feelCfg from "../config/gunfeel.json";
import { newSweep, phaseMeshes, type PhaseSweep } from "./phase";
import { airborne, type FigurePose } from "./dummy";
import { MOVE } from "./movement";
import squadCfg from "../config/squad.json";
import type { EmotePose } from "./emotes";
import { PROFILE } from "./game";
import { loadSoldier, lookOf, readSoldierCode, soldierCode, soldierMaterial, soldierScene, SOLDIER_VARIANTS, type SoldierLook } from "./soldier";
import { retargetClip, retargeter, rigOf, type Retargeter } from "./retarget";
import { buttOf, carryLowOf, FIRST_PERSON_RELOAD, gunScaleOf, holdRifle, measureRifleRig, pistolStance, RIFLE_BONES, shellParts, shellsOf, shoulderGain, sizeFingers, supportOf, SWAP_CUP, tacticalOf, ventOf, type ReloadParts, type RifleOut, type RifleRig } from "./rifle";
import { resolveWeapon } from "./weapons";

/** the soldier is ready: a figure made now wears it, and one made before puts it on (dummy.ts dress) */
export function useMannequin(): boolean {
  return soldierTemplate !== null;
}

interface Template {
  scene: THREE.Object3D;
  /** the clips split in two: "lower:Walk_Loop", "upper:Pistol_Reload", and whole ones: "full:Slide_Loop" */
  clips: Map<string, THREE.AnimationClip>;
  /** the right hand's place in the aim pose, figure space (where a pistol's grip goes) */
  handAim: THREE.Matrix4;
  /** the upper chest bone in the aim pose, figure space (a rifle's mount hangs off it) */
  chestAim: THREE.Matrix4;
  /** the right shoulder in the aim pose, figure space (a rifle's stock goes to it) */
  shoulderR: THREE.Vector3;
  /** SpeedKills' soldier: its rifle hold's measures (rifle.ts), off its rest pose */
  rifle?: RifleRig | null;
}
/** the clips as the library's rig plays them, split three ways (addClips): which are in (hasClip) */
let libraryClips: Map<string, THREE.AnimationClip> | null = null;
let loading: Promise<void> | null = null;
/**
 * The soldier (soldier.ts), once its files and its clips are in: the game's clips carried over to its rig
 * (retarget.ts), and its hand and chest sampled in the aim pose on it. Figures made before it is ready put it on then.
 */
let soldierTemplate: Template | null = null;
let soldierMap: Retargeter | null = null;
/** the clips as they came, kept so the soldier's are made from all of them whenever it arrives */
const rawClips: THREE.AnimationClip[] = [];
/** the soldier is what new figures are (SpeedKills with its files here) */
export function soldierReady(): boolean {
  return soldierTemplate !== null;
}
/** the figures' loading is over, whichever way it went (the clips, the soldier and their retargeting) */
let figuresDone = false;
/**
 * Nothing more is coming for the figures: never asked for, failed, or in, the soldier's clips carried over. The intro
 * card waits for it (intro.ts): retargeting the soldier's clips is a half-second stall that landed on the card.
 */
export function figuresSettled(): boolean {
  return loading === null || figuresDone;
}
/** a figure's look: the one chosen, else one from its operator, so the operators still read as different people */
function soldierLookFor(skin: OperatorSkin): SoldierLook {
  const chosen = readSoldierCode(skin.soldier);
  if (chosen) return chosen;
  let h = 0;
  for (const c of skin.id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const l = lookOf(SOLDIER_VARIANTS[h % SOLDIER_VARIANTS.length]);
  l.skin = h % 6;
  l.eyes = 1 + (h % 5);
  return l;
}

const smooth = (a: number, b: number, v: number): number => {
  const t = Math.max(0, Math.min(1, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** the bones below the waist: the locomotion layer's */
const LOWER = /^(root|pelvis|thigh_|calf_|foot_|ball_)/;

/** clips into the map three ways: the legs', the rest of the body's, and whole */
function addClips(clips: Map<string, THREE.AnimationClip>, list: THREE.AnimationClip[]): void {
  for (const c of list) {
    const lower = c.tracks.filter((t) => LOWER.test(t.name.split(".")[0]));
    const upper = c.tracks.filter((t) => !LOWER.test(t.name.split(".")[0]));
    clips.set(`lower:${c.name}`, new THREE.AnimationClip(`lower:${c.name}`, c.duration, lower));
    clips.set(`upper:${c.name}`, new THREE.AnimationClip(`upper:${c.name}`, c.duration, upper));
    clips.set(`full:${c.name}`, c);
  }
}

/** a clip is in (the extras arrive after the figures do) */
export function hasClip(name: string): boolean {
  return !!libraryClips?.has(`full:${name}`);
}

/** a clip's length, s, or 0 when it is not in */
function clipSeconds(name: string): number {
  return libraryClips?.get(`full:${name}`)?.duration ?? 0;
}

/** horizontal speed, m/s, above which a jump is the athletic one (figure.json) */
const ATHLETIC_JUMP = figureCfg.athleticJump;
/** a double jump's knee lift: how long, and how far the thighs come up and the knees bend, degrees (figure.json doubleJump) */
const DOUBLE_JUMP = figureCfg.doubleJump;
/** a landing taken in the legs: the thighs forward, the knees bent and the chest over them, degrees at its hardest (figure.json landing) */
const LANDING = figureCfg.landing as { raise: number; bend: number; lean: number };
/** standing or crouched still, each foot's toe brought down to its bind pose's (figure.json flatFeet) */
const FLAT_FEET = figureCfg.flatFeet;
/** the soldier's head held up to where it looks, against the chest's lean (figure.json headUp) */
const HEAD_UP = figureCfg.headUp as { hold: number; most: number };
/** the soldier's chest held no more than this far forward of upright, degrees (figure.json chestUp) */
const CHEST_UP = figureCfg.chestUp as { most: number };
/** an aimed look's pitch as spine_01's, spine_02's and spine_03's shares of it, up and the soldier's down (figure.json aimBend) */
const AIM_BEND = figureCfg.aimBend as { up: number[]; down: number[]; downByGun: Record<string, number[]> };
/** a runner's lean into a turn: no more than `most` degrees, `share` of a balanced lean, above `minSpeed` m/s (figure.json bank) */
const BANK = figureCfg.bank as { most: number; share: number; minSpeed: number; rate: number; smooth: number };
/** a plunge (SLAM's way down): falling faster than `fall` m/s, the knees up and the chest over them (figure.json plunge) */
const PLUNGE = figureCfg.plunge as { fall: number; rate: number; raise: number; bend: number; lean: number };
/** a grapple's arm up at its hook point and back, a second (figure.json grapple) */
const GRAPPLE = figureCfg.grapple as { rate: number };
/** a zip line's hand up on the rope and back, a second, and where on the rope it holds (figure.json zipline) */
const ZIPLINE = figureCfg.zipline as { rate: number; grip: number[]; lift: number; thigh: number; knee: number };
/** a wall run's lean in and out, a second, and the most its run clip is sped up (figure.json wallRun) */
const WALL_RUN = figureCfg.wallRun as { rate: number; mostRate: number };
/** the skydive's body, degrees forward of upright gliding and diving, its limbs, and its ease (figure.json skydive) */
type Limbs = { raise: number; forward: number; elbow: number; arch: number; head: number; thigh: number; spread: number; knee: number };
/**
 * Where a long gun rides on the back in the skydive, by soldier kit and gun: the mount's place in the chest bone's frame
 * (holsterMount), measured once off the first figure of that kit to need it
 */
const HOLSTERS = new Map<string, THREE.Matrix4>();
const SKYDIVE = figureCfg.skydive as unknown as { glide: number; dive: number; rateIn: number; rateOut: number; flutter: number[]; glideLimbs: Limbs; diveLimbs: Limbs; holster: { tilt: number; gap: number; band: number; height: number } };
/** and on the back standing, for an emote, an interact or a throw: more upright and higher (figure.json sling) */
const SLING = figureCfg.sling as { tilt: number; height: number };
/** where a look goes from a glide to a dive, as the skydive's own steering has it (squad.json dive) */
const DIVE = squadCfg.dive;
/** how long the soldier's throw takes before the hands go back for the gun, s (soldierhold.json throwFor) */
const THROW_FOR = soldierHold.throwFor;
/** how far the hands have come back onto a returning long gun when it shows (soldierhold.json gunBack) */
const GUN_BACK = soldierHold.gunBack;
/** how fast a sprint jump's own carry comes in, per second (soldierhold.json airRate) */
const AIR_CARRY = soldierHold.airRate;

/** the melee swings, in the order a string of them goes through */
const MELEE_SWINGS = ["Punch_Jab", "Punch_Cross", "Melee_Hook"];

/** load the two files once; figures made after it is in use it */
export function loadMannequin(): Promise<void> {
  if (loading) return loading;
  const loader = new GLTFLoader();
  // mannequin.glb is Quaternius's Universal Animation Library: its rig and its motion, which the soldier plays carried
  // over to its own rig (makeSoldierTemplate). The soldier is asked for with the clips, not after them: it is the figure.
  const soldier = loadSoldier().catch(() => null);
  loading = Promise.all([loader.loadAsync("models/mannequin/mannequin.glb"), loader.loadAsync("models/mannequin/mannequin-more.glb")])
    .then(([main, more]) => {
      const clips = new Map<string, THREE.AnimationClip>();
      addClips(clips, [...main.animations, ...more.animations]);
      rawClips.push(...main.animations, ...more.animations);
      // The clips a figure only plays now and then (a slide's way in and out,
      // a throw, an emote) come after it is up, so they never hold a
      // page up; until they are in, whatever would play them plays what it
      // did before (hasClip). tools/fetch-clips.ts says which are which.
      for (const extra of ["models/mannequin/mannequin-extra-1.glb", "models/mannequin/mannequin-extra-2.glb"])
        void loader
          .loadAsync(extra)
          .then((g) => {
            addClips(clips, g.animations);
            rawClips.push(...g.animations);
            if (soldierTemplate && soldierMap) addClips(soldierTemplate.clips, g.animations.map((c) => retargetClip(soldierMap!, c)));
          })
          .catch(() => null);
      libraryClips = clips;
      // the bought soldier, when its files are here (they are local only; see soldier.json): without them the figures are
      // their hit volumes alone
      void soldier
        .then((a) => (a ? makeSoldierTemplate(main.scene, a.scene) : null))
        .catch(() => null)
        .finally(() => {
          figuresDone = true;
        });
    })
    .catch((e) => {
      console.warn("the figures' clips did not load; the figures are their hit volumes alone", e);
      loading = null;
    });
  return loading;
}

/**
 * The soldier's template: every clip carried over to its rig, a few a tick so the page does not stall while a
 * hundred clips are resampled, then its hand, chest and shoulder sampled in the aim pose, as the body's are.
 */
async function makeSoldierTemplate(clipRig: THREE.Object3D, soldier: THREE.Object3D): Promise<void> {
  const r = retargeter(rigOf(clipRig), rigOf(soldier));
  const clips = new Map<string, THREE.AnimationClip>();
  const todo = rawClips.slice();
  for (let i = 0; i < todo.length; i += 6) {
    addClips(clips, todo.slice(i, i + 6).map((c) => retargetClip(r, c)));
    await new Promise((ok) => setTimeout(ok, 0));
  }
  // extras that came in while this ran
  for (const c of rawClips.slice(todo.length)) addClips(clips, [retargetClip(r, c)]);
  const probe = soldierScene(lookOf("VANGUARD"));
  if (!probe) return;
  const p = cloneSkinned(probe);
  const mixer = new THREE.AnimationMixer(p);
  const aim = clips.get("full:Pistol_Aim_Neutral");
  if (!aim) return;
  mixer.clipAction(aim).play();
  mixer.update(0);
  p.updateMatrixWorld(true);
  soldierMap = r;
  soldierTemplate = {
    scene: probe,
    clips,
    handAim: p.getObjectByName("hand_r")!.matrixWorld.clone(),
    chestAim: p.getObjectByName("spine_03")!.matrixWorld.clone(),
    shoulderR: new THREE.Vector3().setFromMatrixPosition(p.getObjectByName("upperarm_r")!.matrixWorld),
    // measured on a clone no clip has touched: the rest pose is the one the measures are taken in
    rifle: measureRifleRig(cloneSkinned(probe)),
  };
}

const DEG = Math.PI / 180;
const Y = new THREE.Vector3(0, 1, 0);
const X_AXIS = new THREE.Vector3(1, 0, 0);
const Z_AXIS = new THREE.Vector3(0, 0, 1);
/** the body's lean or lay this frame, and its axis (layBody) */
const layQ = new THREE.Quaternion();
const layV = new THREE.Vector3();
const layP = new THREE.Vector3();
const layG = new THREE.Quaternion();

/**
 * a gun's reload time, seconds (weapons.ts, fusion 0), from empty (the longer, with the rack) or tactical (a round
 * still chambered): how long an enemy's figure takes over its reload
 */
const reloadTimes = new Map<string, number>();
function reloadSeconds(id: string, empty: boolean): number {
  const key = `${id}|${empty}`;
  let t = reloadTimes.get(key);
  if (t === undefined) {
    try {
      const w = resolveWeapon(id);
      t = empty ? w.reloadEmptyTime : w.reloadTime;
    } catch {
      t = 2;
    }
    reloadTimes.set(key, (t = Math.max(0.5, t)));
  }
  return t;
}

/** a gun's rechamber, seconds, as the first person's pump runs over it (viewmodel.ts: at least 0.4) */
const rechamberTimes = new Map<string, number>();
function rechamberSeconds(id: string): number {
  let t = rechamberTimes.get(id);
  if (t === undefined) {
    try {
      const w = resolveWeapon(id);
      t = Math.max(0.4, w.rechamberTime || w.shotInterval);
    } catch {
      t = 0.4;
    }
    rechamberTimes.set(id, t);
  }
  return t;
}

/** an overheated gun's lockout, seconds (weapons.ts mech.overheat, fusion 0): what the vent's shares are of (ventOf) */
const lockoutTimes = new Map<string, number>();
function lockoutSeconds(id: string): number {
  let t = lockoutTimes.get(id);
  if (t === undefined) {
    try {
      t = resolveWeapon(id).mech.overheat?.lockout ?? 1;
    } catch {
      t = 1;
    }
    lockoutTimes.set(id, (t = Math.max(0.2, t)));
  }
  return t;
}

/** the first person's magazine phases round its own middle (fparms.json reload.magPhase), not along it */
const MAG_RADIAL = (FIRST_PERSON_RELOAD as { magPhase?: string }).magPhase === "radial";

/** a signature gun's swap phase (gunfeel.json guns.<id>.swap: shares of the swap, the model changing at its middle) */
const swapOf = (id: string): { out: number[]; in: number[] } | null => (feelCfg.guns as unknown as Record<string, { swap?: { out: number[]; in: number[] } }>)[id]?.swap ?? null;
/** a gun's holster and draw times, seconds (weapons.ts, fusion 0): what a swap's phase out and in run over */
const swapTimes = new Map<string, { holster: number; deploy: number }>();
function swapSeconds(id: string): { holster: number; deploy: number } {
  let t = swapTimes.get(id);
  if (!t) {
    try {
      const w = resolveWeapon(id);
      t = { holster: Math.max(0.1, w.holsterTime), deploy: Math.max(0.1, w.deployTime) };
    } catch {
      t = { holster: 0.5, deploy: 0.5 };
    }
    swapTimes.set(id, t);
  }
  return t;
}
const tq1 = new THREE.Quaternion();
const tq2 = new THREE.Quaternion();
const tq3 = new THREE.Quaternion();
const tv = new THREE.Vector3();

/** turn a bone by `angle` about an axis given in the figure's own frame, on top of what the clip set */
function turnBone(bone: THREE.Object3D, figure: THREE.Object3D, axisLocal: THREE.Vector3, angle: number): void {
  if (Math.abs(angle) < 1e-5 || !bone.parent) return;
  bone.parent.updateWorldMatrix(true, false);
  const parentQ = bone.parent.getWorldQuaternion(tq1);
  const world = tq2.copy(parentQ).multiply(bone.quaternion);
  const axis = tv.copy(axisLocal).applyQuaternion(figure.getWorldQuaternion(tq3)).normalize();
  world.premultiply(tq3.setFromAxisAngle(axis, angle));
  bone.quaternion.copy(parentQ.invert().multiply(world));
}

export interface MannequinImpulses {
  kick: number;
  flinch: number;
  jolt: number;
  legYaw: number;
  ads: number;
  /** a landing's squash, 1 on touchdown */
  land?: number;
  /** when the shield last broke, on the figure's clock (a stagger) */
  stagger?: number;
  /** when the head was last hit, on the figure's clock */
  headHit?: number;
  /** how many double jumps it has made (FigurePose.airJumps): a change is a new one, and its knee lift */
  airJumps?: number;
  /** how many shots it has fired (dummy.ts kick): a change is a new one, and a pump gun's pump after it */
  shots?: number;
  /** an emote in progress (emotes.ts): its angles, already eased */
  emote?: EmotePose | null;
}

const v1 = new THREE.Vector3();
const v2 = new THREE.Vector3();
const v3 = new THREE.Vector3();
const v4 = new THREE.Vector3();
const v5 = new THREE.Vector3();
const q1 = new THREE.Quaternion();
const q2 = new THREE.Quaternion();
const IDENTITY = new THREE.Quaternion();

/** turn a bone (weighted by w) so its direction `from` (world) points along `to` (world) */
function aimBone(bone: THREE.Object3D, from: THREE.Vector3, to: THREE.Vector3, w: number): void {
  if (!bone.parent || from.lengthSq() < 1e-10 || to.lengthSq() < 1e-10) return;
  const d = q1.setFromUnitVectors(from.normalize(), to.normalize());
  if (w < 1) d.slerpQuaternions(IDENTITY, d.clone(), w);
  const world = bone.getWorldQuaternion(q2).premultiply(d);
  bone.quaternion.copy(bone.parent.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(world));
  bone.updateWorldMatrix(false, true);
}

/**
 * How far a gun's body reaches behind its grip, metres. The model is built
 * pointing along its own -z with the grip `gripF` in front of the origin, so
 * the rearmost point of the box, measured from the grip, is what would end up
 * in the shoulder. Measured on the gun that is actually held, so an extended
 * stock or a long barrel is measured rather than assumed.
 */
function rearOfGrip(gun: THREE.Object3D, gripF: number): number {
  const box = new THREE.Box3().setFromObject(gun);
  return Math.max(0, box.max.z + gripF);
}

/** each merged geometry's head points in the Head bone's rest frame, x y z a point (MannequinFigure.headShape) */
const headPoints = new WeakMap<THREE.BufferGeometry, Float32Array>();
/** the drawn head's ellipsoid in its Head bone's rest frame: its middle, its turn and its half sizes along its own axes */
export interface HeadShape {
  mid: THREE.Vector3;
  turn: THREE.Quaternion;
  half: THREE.Vector3;
}
/** each kit's head ellipsoid, by the head geometries it is drawn with (one fit a kit, not a figure: a match makes 27 bots) */
const headShapes = new Map<string, HeadShape>();

/**
 * The smallest ellipsoid holding every point (Khachiyan's method), as a middle, a turn and half sizes: the head's hit
 * volume as near the drawn head as one ellipsoid can be. A box round the points grown until it held them all was a
 * third again as big, and a shot beside the head took it.
 */
function enclosingEllipsoid(pts: Float32Array): HeadShape {
  const n = pts.length / 3;
  const u = new Float64Array(n).fill(1 / n);
  const X = new THREE.Matrix4();
  const Xi = new THREE.Matrix4();
  for (let it = 0; it < 400; it++) {
    // X = sum u q q^T over the lifted points q = (p, 1)
    const e = new Array(16).fill(0);
    for (let i = 0; i < n; i++) {
      const p = [pts[3 * i], pts[3 * i + 1], pts[3 * i + 2], 1];
      for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) e[c * 4 + r] += u[i] * p[r] * p[c];
    }
    X.fromArray(e);
    const k = Xi.copy(X).invert().elements;
    let best = 0;
    let at = 0;
    for (let i = 0; i < n; i++) {
      const x = pts[3 * i];
      const y = pts[3 * i + 1];
      const z = pts[3 * i + 2];
      // q^T X^-1 q for q = (x, y, z, 1), the matrix column-major
      const m =
        x * (k[0] * x + k[4] * y + k[8] * z + k[12]) +
        y * (k[1] * x + k[5] * y + k[9] * z + k[13]) +
        z * (k[2] * x + k[6] * y + k[10] * z + k[14]) +
        (k[3] * x + k[7] * y + k[11] * z + k[15]);
      if (m > best) {
        best = m;
        at = i;
      }
    }
    const step = (best - 4) / (4 * (best - 1));
    if (step < 1e-4) break;
    for (let i = 0; i < n; i++) u[i] *= 1 - step;
    u[at] += step;
  }
  // its middle and its shape matrix: A = inverse(sum u p p^T - c c^T) / 3
  const c = new THREE.Vector3();
  for (let i = 0; i < n; i++) c.x += u[i] * pts[3 * i], c.y += u[i] * pts[3 * i + 1], c.z += u[i] * pts[3 * i + 2];
  const S = [0, 0, 0, 0, 0, 0, 0, 0, 0];
  for (let i = 0; i < n; i++) {
    const d = [pts[3 * i], pts[3 * i + 1], pts[3 * i + 2]];
    for (let r = 0; r < 3; r++) for (let k = 0; k < 3; k++) S[r * 3 + k] += u[i] * d[r] * d[k];
  }
  const cc = [c.x, c.y, c.z];
  for (let r = 0; r < 3; r++) for (let k = 0; k < 3; k++) S[r * 3 + k] -= cc[r] * cc[k];
  // the axes and their lengths from S itself (A's eigenvectors are S's, its lengths sqrt(3 x S's eigenvalues))
  const { vecs, vals } = symmetricEigen(S);
  const half = new THREE.Vector3(...vals.map((v) => Math.sqrt(Math.max(1e-8, 3 * v))));
  const basis = new THREE.Matrix4().makeBasis(vecs[0], vecs[1], vecs[2]);
  if (basis.determinant() < 0) {
    vecs[2].negate();
    basis.makeBasis(vecs[0], vecs[1], vecs[2]);
  }
  const turn = new THREE.Quaternion().setFromRotationMatrix(basis);
  // (the method stops a hair short of holding them all: grown to)
  const inv = turn.clone().invert();
  const d = new THREE.Vector3();
  let s = 0;
  for (let i = 0; i < n; i++) {
    d.set(pts[3 * i] - c.x, pts[3 * i + 1] - c.y, pts[3 * i + 2] - c.z).applyQuaternion(inv);
    s = Math.max(s, Math.hypot(d.x / half.x, d.y / half.y, d.z / half.z));
  }
  return { mid: c, turn, half: half.multiplyScalar(Math.max(1, s)) };
}

/** a 3x3 symmetric matrix's eigenvectors and eigenvalues (Jacobi rotations), row-major in */
function symmetricEigen(m: number[]): { vecs: THREE.Vector3[]; vals: number[] } {
  const a = [[m[0], m[1], m[2]], [m[3], m[4], m[5]], [m[6], m[7], m[8]]];
  const v = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  for (let sweep = 0; sweep < 50; sweep++) {
    const off = a[0][1] ** 2 + a[0][2] ** 2 + a[1][2] ** 2;
    if (off < 1e-18) break;
    for (const [p, r] of [[0, 1], [0, 2], [1, 2]]) {
      if (Math.abs(a[p][r]) < 1e-14) continue;
      const th = (a[r][r] - a[p][p]) / (2 * a[p][r]);
      const t = Math.sign(th || 1) / (Math.abs(th) + Math.sqrt(th * th + 1));
      const cs = 1 / Math.sqrt(t * t + 1);
      const sn = t * cs;
      for (let k = 0; k < 3; k++) {
        const akp = a[k][p];
        const akr = a[k][r];
        a[k][p] = cs * akp - sn * akr;
        a[k][r] = sn * akp + cs * akr;
      }
      for (let k = 0; k < 3; k++) {
        const apk = a[p][k];
        const ark = a[r][k];
        a[p][k] = cs * apk - sn * ark;
        a[r][k] = sn * apk + cs * ark;
      }
      for (let k = 0; k < 3; k++) {
        const vkp = v[k][p];
        const vkr = v[k][r];
        v[k][p] = cs * vkp - sn * vkr;
        v[k][r] = sn * vkp + cs * vkr;
      }
    }
  }
  return { vecs: [0, 1, 2].map((j) => new THREE.Vector3(v[0][j], v[1][j], v[2][j])), vals: [a[0][0], a[1][1], a[2][2]] };
}
/** each merged geometry's head: the sum of its Head vertices in the Head bone's rest frame, and how many (MannequinFigure.headMiddle) */
const headSums = new WeakMap<THREE.BufferGeometry, { sum: THREE.Vector3; n: number }>();

/** a figure's height off its rest pose, skinned (the soldier's meshes are stored lying down), by its first mesh's geometry */
const figureHeights = new WeakMap<THREE.BufferGeometry, number>();

/** how tall a figure stands: its skinned meshes' box in its own frame, measured once for each kind of figure */
function figureHeight(root: THREE.Object3D, meshes: THREE.SkinnedMesh[]): number {
  const had = figureHeights.get(meshes[0].geometry);
  if (had !== undefined) return had;
  root.updateMatrixWorld(true);
  const toRoot = root.matrixWorld.clone().invert();
  const box = new THREE.Box3();
  for (const m of meshes) {
    m.computeBoundingBox();
    box.union(m.boundingBox!.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(toRoot, m.matrixWorld)));
  }
  const h = Math.max(0.5, box.max.y);
  figureHeights.set(meshes[0].geometry, h);
  return h;
}

/**
 * A figure's skinned meshes culled by one sphere round the figure, where they were never culled (?slow=cull puts that
 * back). Never, because a skinned mesh's bounds are its rest pose's and an animated one leaves them; but then every
 * figure in a match was drawn every frame wherever it stood, its skeleton worked out and sent to the GPU, behind you or
 * across the map (a battle royale's 29 bots: about 116 of a frame's 500 draw calls at the Neon City's street,
 * 2026-10-01). The sphere is the figure's, not each mesh's: half its height up and perf.json figureCull heights
 * across, so it holds the figure lying down with its gun, and every piece of it (an eye's own rest sphere is 4 cm
 * round its head) is drawn wherever the figure is. It is set in the figure's frame and carried into each mesh's (the
 * soldier's are stored lying down and stood up by their skeleton: a sphere off a mesh's own geometry stood 1.7 m out
 * along the ground, and the figure in front of you was not drawn).
 */
function cullAsFigure(root: THREE.Object3D, meshes: THREE.SkinnedMesh[], height: number): void {
  root.updateMatrixWorld(true);
  const toRoot = root.matrixWorld.clone().invert();
  for (const m of meshes) {
    const rel = new THREE.Matrix4().multiplyMatrices(toRoot, m.matrixWorld);
    const centre = new THREE.Vector3(0, height / 2, 0).applyMatrix4(rel.clone().invert());
    m.boundingSphere = new THREE.Sphere(centre, (height * perfCfg.figureCull) / rel.getMaxScaleOnAxis());
  }
}

/** two skeletons over the same bones in the same rest pose: one can do for both */
const sameRig = (a: THREE.Skeleton, b: THREE.Skeleton): boolean =>
  a.bones.length === b.bones.length && a.bones.every((x, i) => x === b.bones[i]) && a.boneInverses.every((x, i) => x.equals(b.boneInverses[i]));

/**
 * A figure's skinned meshes over the same bones in the same rest pose share one skeleton (?slow=skeleton puts one each
 * back). The clone gave each of the soldier's four meshes a skeleton of its own over the same 67 bones, each worked out
 * every frame and sent to the GPU: four times over (2026-10-01, with every figure drawn: 109 bone textures a frame).
 */
function shareSkeletons(root: THREE.Object3D): void {
  const kept: THREE.Skeleton[] = [];
  root.traverse((o) => {
    const m = o as THREE.SkinnedMesh;
    if (!m.isSkinnedMesh) return;
    const same = kept.find((k) => k !== m.skeleton && sameRig(k, m.skeleton));
    if (!same) {
      if (!kept.includes(m.skeleton)) kept.push(m.skeleton);
      return;
    }
    m.skeleton.dispose();
    m.skeleton = same;
  });
}

export class MannequinFigure {
  readonly root: THREE.Object3D;
  private headMid: THREE.Vector3 | null = null;
  private headShapeC: HeadShape | null = null;
  private mixer: THREE.AnimationMixer;
  private lower: THREE.AnimationAction | null = null;
  private upper: THREE.AnimationAction | null = null;
  private lowerName = "";
  private upperName = "";
  private bones: Record<string, THREE.Object3D> = {};
  /** how tall it stands, off its rest pose (figureHeight): the size of the sphere it is culled by */
  private height = 1.8;
  /**
   * The clip's own rotation of each bone this class turns on top of the clips.
   * three's mixer writes a bone only when the clip's value has changed since
   * the last frame ("value has changed -> update scene graph" in
   * PropertyMixer.apply), and the upper body plays a held pose: after the first
   * frame it never wrote spine_01..03 or the head again, so every frame's
   * turnBone piled onto the last frame's and the torso spun without end. So:
   * the clip's pose goes back on before the mixer runs, is taken again after
   * it, and the edits start from it every frame.
   */
  private clipPose = new Map<THREE.Object3D, THREE.Quaternion>();
  private static readonly EDITED = ["pelvis", "spine_01", "spine_02", "spine_03", "Head", "upperarm_l", "lowerarm_l", "upperarm_r", "lowerarm_r", "thigh_l", "calf_l", "thigh_r", "calf_r"];

  /** a bone of this figure by name, for what follows it (dummy.ts: SpeedKills' hit volumes) */
  bone(name: string): THREE.Object3D | undefined {
    return this.bones[name];
  }

  /**
   * The middle of this figure's head in its Head bone's own space: every vertex drawn weighted at least half to Head
   * (a helmet with it), carried from where it was bound into the bone's rest frame, averaged. Measured off the
   * geometry, so it holds for any kit, in any pose, at any scale; null before the figure has a head.
   */
  headMiddle(): THREE.Vector3 | null {
    if (this.headMid) return this.headMid;
    const sum = new THREE.Vector3();
    let n = 0;
    this.root.traverse((o) => {
      const m = o as THREE.SkinnedMesh;
      if (!m.isSkinnedMesh || !m.visible) return;
      const h = m.skeleton.bones.findIndex((b) => b.name === "Head");
      if (h < 0) return;
      let got = headSums.get(m.geometry);
      if (!got) {
        got = { sum: new THREE.Vector3(), n: 0 };
        // skinned in place: bone.matrixWorld x boneInverse x bindMatrix x p, so the part after the bone is fixed
        const toBone = m.skeleton.boneInverses[h].clone().multiply(m.bindMatrix);
        const pos = m.geometry.attributes.position as THREE.BufferAttribute;
        const si = m.geometry.attributes.skinIndex as THREE.BufferAttribute;
        const sw = m.geometry.attributes.skinWeight as THREE.BufferAttribute;
        const used = new Uint8Array(pos.count);
        const idx = m.geometry.index;
        if (idx) for (let k = 0; k < idx.count; k++) used[idx.getX(k)] = 1;
        else used.fill(1);
        const p = new THREE.Vector3();
        for (let i = 0; i < pos.count; i++) {
          if (!used[i]) continue;
          let w = 0;
          for (let c = 0; c < 4; c++) if (si.getComponent(i, c) === h) w += sw.getComponent(i, c);
          if (w < 0.5) continue;
          got.sum.add(p.fromBufferAttribute(pos, i).applyMatrix4(toBone));
          got.n++;
        }
        headSums.set(m.geometry, got);
      }
      sum.add(got.sum);
      n += got.n;
    });
    return n ? (this.headMid = sum.divideScalar(n)) : null;
  }
  /**
   * The drawn head as an ellipsoid in its Head bone's own space, for the head's hit volume (dummy.ts followBones,
   * figure.json headVolume): its middle (headMiddle) and its half sizes along the bone's axes, the head's own spread
   * grown until every point drawn weighted half and more to Head, a hat with it, is inside. Off the geometry, so a kit
   * with a hat is hit on its hat and one without on its bare head; null before the figure has a head.
   */
  headShape(): HeadShape | null {
    if (this.headShapeC) return this.headShapeC;
    const lists: Float32Array[] = [];
    const keys: string[] = [];
    this.root.traverse((o) => {
      const m = o as THREE.SkinnedMesh;
      if (!m.isSkinnedMesh || !m.visible) return;
      const h = m.skeleton.bones.findIndex((b) => b.name === "Head");
      if (h < 0) return;
      let got = headPoints.get(m.geometry);
      if (!got) {
        const toBone = m.skeleton.boneInverses[h].clone().multiply(m.bindMatrix);
        const pos = m.geometry.attributes.position as THREE.BufferAttribute;
        const si = m.geometry.attributes.skinIndex as THREE.BufferAttribute;
        const sw = m.geometry.attributes.skinWeight as THREE.BufferAttribute;
        const out: number[] = [];
        const p = new THREE.Vector3();
        for (let i = 0; i < pos.count; i++) {
          let w = 0;
          for (let c = 0; c < 4; c++) if (si.getComponent(i, c) === h) w += sw.getComponent(i, c);
          if (w < 0.5) continue;
          p.fromBufferAttribute(pos, i).applyMatrix4(toBone);
          out.push(p.x, p.y, p.z);
        }
        headPoints.set(m.geometry, (got = new Float32Array(out)));
      }
      lists.push(got);
      keys.push(m.geometry.uuid);
    });
    const n = lists.reduce((s, L) => s + L.length, 0);
    if (!n) return null;
    const key = keys.sort().join(",");
    let shape = headShapes.get(key);
    if (!shape) {
      const all = new Float32Array(n);
      let at = 0;
      for (const L of lists) {
        all.set(L, at);
        at += L.length;
      }
      const fit = enclosingEllipsoid(all);
      const margin = (figureCfg as { headVolume?: { margin: number } }).headVolume?.margin ?? 0;
      fit.half.addScalar(margin);
      headShapes.set(key, (shape = fit));
    }
    return (this.headShapeC = shape);
  }
  private restoreClipPose(): void {
    for (const [b, q] of this.clipPose) b.quaternion.copy(q);
  }
  /** the bones this figure turns on top of its clips: the soldier's rifle hold turns its hands and fingers too */
  private get edited(): readonly string[] {
    return this.rifle ? MannequinFigure.EDITED_RIFLE : MannequinFigure.EDITED;
  }
  private static readonly EDITED_RIFLE = [...MannequinFigure.EDITED, ...RIFLE_BONES];
  private captureClipPose(): void {
    for (const n of this.edited) {
      const b = this.bones[n];
      if (!b) continue;
      const q = this.clipPose.get(b);
      if (q) q.copy(b.quaternion);
      else this.clipPose.set(b, b.quaternion.clone());
    }
  }
  private gun: THREE.Object3D | null = null;
  /** the gun in its hands, for a finish to be painted on (dummy.ts) */
  get gunRoot(): THREE.Object3D | null {
    return this.gun;
  }
  /** its gun's muzzle flash, lit by the figure on a shot */
  flash: THREE.Sprite | null = null;
  /** its gun's scope glint, lit while it aims a magnified optic (muzzle.ts fitGlint), or null */
  glint: THREE.Sprite | null = null;
  /**
   * How far the figure is looking down its scope this frame, 0..1: its aim in, only while the gun is up at the eye and the
   * hands are on nothing else (a reload, a swap, a throw, a strike) and it is not carried low. The scope's glint shows by
   * it (the owner, 2026-09-30: "the sniper should only have glint when they are ADSing"); by the pose's aim alone, a bot
   * aiming as it reloaded glinted through the reload.
   */
  scoped = 0;
  private gunShown = true;
  private mats: THREE.MeshStandardMaterial[] = [];
  /** each of its materials' own colour, which a threat highlight darkens (setFlash) */
  private matColours: THREE.Color[] = [];
  /** knocked out: the death clip, once, then lying still */
  private dead = false;
  /** where the left hand holds the gun, gun-local (its handguard), and how far the reach is blended in */
  private support: THREE.Vector3 | null = null;
  private ikW = 0;
  /**
   * A long gun is not held as the clips hold a pistol, out at arm's length:
   * it hangs off the chest with its stock at the right shoulder, and both
   * hands reach onto it (the grip and the handguard). `mount` is its pivot
   * at the grip; `mountBase` its place in the aim pose; `grip` gun-local.
   */
  private mount: THREE.Object3D | null = null;
  private mountBase = new THREE.Matrix4();
  private grip: THREE.Vector3 | null = null;
  private gripW = 0;
  /** 0..1 the long gun lowered and canted across the body (a sprint, a swap) */
  private lowered = 0;
  /** how far the still figure's feet are flattened, 0 to 1, eased (figure.json flatFeet) */
  private flatW = 0;
  /** how far a figure standing still is lifted onto its flattened soles, 0 to 1, eased (figure.json flatFeet.lift) */
  private liftW = 0;
  /** each foot's foot-to-ball pitch in the bind pose against the figure's up, radians, found once */
  private footRest: Record<string, number> | null = null;
  /** the way the face looks, in the Head bone's own frame, from the bind pose (headUp); null until measured */
  private faceLocal: THREE.Vector3 | null = null;
  private readonly footA = new THREE.Vector3();
  private readonly footB = new THREE.Vector3();
  private readonly footSide = new THREE.Vector3();
  private readonly footQ = new THREE.Quaternion();
  private readonly footW = new THREE.Quaternion();
  private readonly footT = new THREE.Quaternion();
  /** the long gun is on its way back into the hands after a throw, a heal or a reach: hidden until they are on it */
  private gunComing = false;
  /** 0..1 each, eased: the lowered carry a swap's own, and a sprint jump's own (rifle.ts carryOf) */
  private carryW = { swap: 0, air: 0, vent: 0 };
  /** how far lowered the gun was as a vent began */
  private ventFrom = 0;
  /** the stance and the hands' act last frame, when a slide began and when its way out ends, and which swing a melee is on */
  private lastStance = "";
  private lastAct: FigurePose["act"] = null;
  /** when the act began, on this figure's clock: a reload, a swap or a melee swing is timed from it */
  private actAt = 0;
  private slideAt = -Infinity;
  private slideExitUntil = -Infinity;
  private meleeSwing = 0;
  private headSeen = -Infinity;
  private headUntil = -Infinity;
  /** the figure's own clock, and when a landing's clip and a stagger's end */
  private t = 0;
  private landUntil = -Infinity;
  private staggerSeen = -Infinity;
  private staggerUntil = -Infinity;
  private wasAir = false;
  /**
   * 0..1 eased: a wall run's lean off its wall (+ a wall on the left of the run, - on the right), a skydive's laying of
   * the body on the air, and its dive against its glide; and the hips' height in the bind pose, m, the point the body is
   * turned round for both (measured off the soldier as it is made)
   */
  private wallW = 0;
  private skyW = 0;
  private diveW = 0;
  private hipY = 0.95;
  /** the ankles' height over the floor in the bind pose, m (measured as the figure is made): a foot on the floor */
  private ankleY = 0.1;
  private baseY = 0;
  /**
   * The body's turn round its hips (a wall run's lean, a skydive's lay) and its lean into a turn round its feet (bank),
   * and what the lean reads: where its group was, its way of moving and the change in it (world x and z, smoothed), and
   * the lean now (world, radians toward the turn's middle)
   */
  private readonly tiltQ = new THREE.Quaternion();
  private readonly bankQ = new THREE.Quaternion();
  private lastXZ: [number, number] | null = null;
  private readonly vel = new THREE.Vector2();
  private readonly acc = new THREE.Vector2();
  private readonly bank = new THREE.Vector2();
  /** a grapple's hook point (world), until when on this figure's clock, how near is there, and the arm's weight on it */
  private grapple: { to: THREE.Vector3; until: number; arrive: number } | null = null;
  private grabW = 0;
  /** how far its left hand is up on a zip line's rope, 0 to 1, eased (figure.json zipline) */
  private zipW = 0;
  /** the left arm's reach to its knuckles held straight up at the rope, measured once it is there (reachArm) */
  private zipReach: number | null = null;
  /** its long gun on its back while something has the hands, until they have it again (Milestone 617) */
  private slung = false;
  /** where its group was last frame, its speed up or down from that (eased), and how far into a plunge it is */
  private lastY: number | null = null;
  private vy = 0;
  private plungeW = 0;
  /** the double jumps seen so far (null until the first count arrives), and when the last one's knee lift began */
  private airJumpsSeen: number | null = null;
  private liftAt = -Infinity;
  /** the shots seen so far, and when the last was fired: a pump gun's pump runs over the rechamber after it */
  private shotsSeen: number | null = null;
  private shotAt = -Infinity;
  /** the gun is in the hand and showing this frame */
  gunInHand = false;

  /** the template this figure was made from, and plays the clips of, for its whole life */
  private tpl: Template;
  /** this figure's look: the soldier's kit, colours, skin and eyes */
  readonly soldier: SoldierLook;

  /** made only once the soldier is ready (useMannequin) */
  constructor(skin: OperatorSkin, gunId: string | null) {
    this.soldier = soldierLookFor(skin);
    const t = (this.tpl = soldierTemplate!);
    this.root = cloneSkinned(soldierScene(this.soldier) ?? t.scene);
    this.root.name = "mannequin";
    const skinned: THREE.SkinnedMesh[] = [];
    this.mixer = new THREE.AnimationMixer(this.root);
    this.root.traverse((o) => {
      if ((o as THREE.Bone).isBone) this.bones[o.name] = o;
      const m = o as THREE.SkinnedMesh;
      if (m.isSkinnedMesh) {
        m.castShadow = true;
        if (slow("cull")) m.frustumCulled = false;
        else skinned.push(m);
        // its own materials, so a hit can flash this figure and not every one: the soldier's, rebuilt with this figure's
        // colours (soldier.ts)
        const src = m.material as THREE.MeshStandardMaterial;
        const slot = m.userData.soldierMaterial as string | undefined;
        const mat = slot ? soldierMaterial(slot, this.soldier) : src.clone();
        this.mats.push(mat);
        this.matColours.push(mat.color.clone());
        m.material = mat;
        m.userData.ownMaterial = mat;
      }
    });
    // The soldier's eyes are a mesh of their own, a draw call a figure (apex-lobby counted 28 bots' in a Neon street
    // frame): never in the shadow pass, where an eye's shadow is nothing, and hidden past lod.json figures.eyes (showEyes),
    // where an eye is under a pixel
    this.root.traverse((o) => {
      const m = o as THREE.SkinnedMesh;
      if (m.isSkinnedMesh && /eye/i.test(String(m.userData.soldierMaterial ?? ""))) {
        m.castShadow = false;
        m.userData.shadowOff = true;
        this.eyes.push(m);
      }
    });
    // its fingers are drawn smaller than its model's
    if (skinned.length) {
      this.height = figureHeight(this.root, skinned);
      cullAsFigure(this.root, skinned, this.height);
    }
    sizeFingers(this.bones);
    if (this.bones.pelvis) {
      this.root.updateMatrixWorld(true);
      this.hipY = this.bones.pelvis.getWorldPosition(new THREE.Vector3()).y - this.root.position.y;
      if (this.bones.foot_l) this.ankleY = this.bones.foot_l.getWorldPosition(new THREE.Vector3()).y - this.root.position.y;
    }
    if (!slow("skeleton")) shareSkeletons(this.root);
    if (gunId) this.setGun(gunId);
  }

  /** a gun into the right hand, held as the aim pose holds it: pointing the way the figure faces */
  setGun(id: string): void {
    const hand = this.bones.hand_r;
    const chest = this.bones.spine_03;
    if (!hand) return;
    this.gun?.removeFromParent();
    this.mount?.removeFromParent();
    this.mount = null;
    // (a gun in place of another is the one a swap phases in; the first one given is just there)
    if (id !== this.gunId) this.gunAt = this.gunId ? this.t : -1;
    // A gun carried low unless aimed (DEVINOS's, carryLowOf) goes out of a swap from its carry and the next comes in at its
    // own: the carry changes here, while neither gun shows (the old one phased out, the new one not yet in). Eased, the
    // swap in place had DEVINOS come in at the shoulder and drop through its draw
    if (this.gunId && id !== this.gunId && !!carryLowOf(this.gunId) !== !!carryLowOf(id)) this.lowered = carryLowOf(id) ? 1 : 0;
    this.gunId = id;
    this.rifleMem.gunInHand = null;
    const m = displayGunModel(id);
    const gun = m.root.clone(true);
    // the model's own flash out, a marker with a flash sprite in its place (muzzle.ts)
    this.flash = fitMuzzle(gun, ammoTypeOf(id) === "energy", m.muzzle, id);
    // a magnified optic glints when its holder aims (Hyper Scape's lens flare), at its front lens: the frontmost point
    // of the gun within 3 cm of its sight line, measured off the model (at the eyepiece the gun and head hid it)
    // (every gun wears its profile's one optic)
    const optic = (PROFILE.weapons as Record<string, { optic?: string }>)[id]?.optic ?? null;
    this.glint = optic && opticInfo(optic)?.overlay ? fitGlint(gun, lensFront(gun, m.sightY)) : null;
    gun.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).castShadow = true;
    });
    this.support = new THREE.Vector3(m.support.x ?? 0, m.support.u, -m.support.f);
    this.grip = new THREE.Vector3(0, m.grip.u, -m.grip.f);
    // (a pistol given the soldier's pistol stance goes the long guns' way too: the rifleman's rig holds it, rifle.ts)
    if ((m.support.kind !== "pistol" || (!!this.tpl.rifle && pistolStance(id))) && chest) {
      // A long gun: its stock in the shoulder pocket, which is OUTBOARD of the
      // joint and not inboard of it, its grip below and in front. How far in
      // front is the gun's own business: a carbine needs less room behind the
      // grip than a sniper with a full stock, and a gun given the carbine's
      // room has its stock through the chest (src/game/hold.ts).
      const sh = this.tpl.shoulderR;
      this.rear = rearOfGrip(gun, m.grip.f);
      const at = gripAt({ x: sh.x, y: sh.y, z: sh.z }, this.rear);
      const gripAtV = new THREE.Vector3(at.x, at.y, at.z);
      const inFigure = new THREE.Matrix4().compose(gripAtV, new THREE.Quaternion().setFromAxisAngle(Y, Math.PI), new THREE.Vector3(1, 1, 1));
      this.mountBase.copy(this.tpl.chestAim).invert().multiply(inFigure);
      const mount = new THREE.Object3D();
      mount.name = "gunMount";
      this.mountBase.decompose(mount.position, mount.quaternion, mount.scale);
      // the soldier's gun drawn at its own size for the glove (soldierhold.json scale), its grip still at the mount,
      // and its left hand's hold where the arm reaches it when the model's own is too far out (soldierhold.json support)
      const size = this.tpl.rifle ? gunScaleOf(id) : 1;
      if (this.tpl.rifle) this.support = supportOf(id) ?? this.support;
      gun.scale.setScalar(size);
      gun.position.copy(this.grip).multiplyScalar(size).negate();
      gun.visible = this.gunShown && !this.dead;
      mount.add(gun);
      chest.add(mount);
      this.mount = mount;
      this.gun = gun;
      // SpeedKills' soldier holds it as a rifleman does (rifle.ts): its butt measured off the gun it holds
      this.rifle = this.tpl.rifle ?? null;
      this.butt = this.rifle ? buttOf(gun) : null;
      // the magazine group the reload takes out (gunmodels.ts builds it as "mag"), where it sits, and the handle
      const mag = gun.getObjectByName("mag") ?? null;
      this.reloadParts = this.rifle ? { mag, magHome: mag ? mag.position.clone() : new THREE.Vector3(), magHomeQ: mag ? mag.quaternion.clone() : new THREE.Quaternion(), magBottom: m.magBottom.clone(), handle: m.boltGrip ? m.boltGrip.clone() : null, shells: shellsOf(id) ? shellParts(gun, m.parts?.end ?? 1) : null } : null;
      if (this.rifle && mag) {
        // the magazine's top and bottom in its own frame, for its sweep; its meshes onto this figure's phased copies
        mag.updateMatrixWorld(true);
        const inv = mag.matrixWorld.clone().invert();
        const box = new THREE.Box3();
        const v = new THREE.Vector3();
        // (the magazine as drawn: its group holds the procedural gun's magazine too, hidden, 107 mm off on the USSO)
        const drawn = (o: THREE.Object3D) => {
          for (let q: THREE.Object3D | null = o; q && q !== mag; q = q.parent) if (!q.visible) return false;
          return true;
        };
        mag.traverse((o) => {
          const mesh = o as THREE.Mesh;
          if (!mesh.isMesh || !drawn(mesh)) return;
          const pos = mesh.geometry.getAttribute("position");
          const to = new THREE.Matrix4().multiplyMatrices(inv, mesh.matrixWorld);
          for (let i = 0; i < pos.count; i++) box.expandByPoint(v.fromBufferAttribute(pos, i).applyMatrix4(to));
        });
        const cx = (box.min.x + box.max.x) / 2;
        const cz = (box.min.z + box.max.z) / 2;
        this.magTop.set(cx, box.max.y, cz);
        this.magEnd.set(cx, box.min.y, cz);
        box.getCenter(this.magMid);
        this.magRadius = Math.max(0.005, box.getSize(new THREE.Vector3()).length() / 2);
        const under = (o: THREE.Object3D, g: THREE.Object3D | null) => {
          for (let q: THREE.Object3D | null = o; q; q = q.parent) if (q === g) return true;
          return false;
        };
        // the bought model's own meshes for the swap (never the flash, the glint or a procedural gun under them), its
        // length in its own frame as the first person's sweep runs it: from the back to the muzzle
        const paid = swapOf(id) ? gun.getObjectByName("paid") ?? null : null;
        if (paid) {
          gun.updateMatrixWorld(true);
          const ginv = gun.matrixWorld.clone().invert();
          const g = new THREE.Box3();
          paid.traverse((o) => {
            const mesh = o as THREE.Mesh;
            if (!mesh.isMesh || !mesh.visible) return;
            if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
            g.union(mesh.geometry.boundingBox!.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(ginv, mesh.matrixWorld)));
          });
          const cy = (g.min.y + g.max.y) / 2;
          this.gunNear.set(0, cy, g.max.z);
          this.gunFar.set(0, cy, g.min.z);
          g.getCenter(this.gunMid);
          this.gunRadius = Math.max(0.01, g.getSize(new THREE.Vector3()).length() / 2);
        }
        phaseMeshes(gun, (mesh) => (under(mesh, mag) ? this.magSweep : paid && under(mesh, paid) ? this.gunSweep : null));
      }
      this.sight = new THREE.Vector3(m.sightX ?? 0, m.sightY, -m.rearF);
      return;
    }
    this.reloadParts = null;
    this.rifle = null;
    this.butt = null;
    // where the gun sits in the figure's frame in the aim pose: its grip in the
    // hand (a little into the palm), the muzzle forward
    const grip = new THREE.Vector3().setFromMatrixPosition(this.tpl.handAim).add(new THREE.Vector3(0.02, -0.02, 0.06));
    const inFigure = new THREE.Matrix4().compose(grip.clone().sub(new THREE.Vector3(0, m.grip.u, m.grip.f)), new THREE.Quaternion().setFromAxisAngle(Y, Math.PI), new THREE.Vector3(1, 1, 1));
    const local = new THREE.Matrix4().copy(this.tpl.handAim).invert().multiply(inFigure);
    local.decompose(gun.position, gun.quaternion, gun.scale);
    gun.visible = this.gunShown && !this.dead;
    hand.add(gun);
    this.gun = gun;
  }

  /**
   * Each foot's toe brought down by `w` of the way to no higher than its bind pose has it, about the foot's own side to
   * side (the figure stands upright, so its up is the world's). The bind pose's pitch is read off the skeleton's inverse
   * binds against the head over the feet, as the meshes are Z up.
   */
  private flattenFeet(w: number): void {
    const b = this.bones;
    if (!this.footRest) {
      let sk: THREE.Skeleton | null = null;
      this.root.traverse((o) => {
        const m = o as THREE.SkinnedMesh;
        if (!sk && m.isSkinnedMesh && m.skeleton.bones.some((x) => x.name === "foot_l")) sk = m.skeleton;
      });
      const S = sk as THREE.Skeleton | null;
      if (!S) return;
      const at = (name: string) => {
        const i = S.bones.findIndex((x) => x.name === name);
        return i < 0 ? null : new THREE.Vector3().setFromMatrixPosition(S.boneInverses[i].clone().invert());
      };
      const [head, fl, fr, bl, br] = ["Head", "foot_l", "foot_r", "ball_l", "ball_r"].map(at);
      if (!head || !fl || !fr || !bl || !br) return;
      const up = head.clone().sub(fl.clone().add(fr).multiplyScalar(0.5)).normalize();
      const pitch = (f: THREE.Vector3, ball: THREE.Vector3) => Math.asin(THREE.MathUtils.clamp(ball.clone().sub(f).normalize().dot(up), -1, 1));
      this.footRest = { l: pitch(fl, bl), r: pitch(fr, br) };
    }
    for (const s of ["l", "r"]) {
      const foot = b[`foot_${s}`];
      const ball = b[`ball_${s}`];
      if (!foot || !ball || !foot.parent) continue;
      foot.parent.updateWorldMatrix(true, false);
      foot.updateMatrixWorld(true);
      const dir = ball.getWorldPosition(this.footA).sub(foot.getWorldPosition(this.footB)).normalize();
      const lift = Math.asin(THREE.MathUtils.clamp(dir.y, -1, 1)) - this.footRest[s];
      if (lift <= 0) continue;
      // (a positive turn about this lifts the toe)
      const side = this.footSide.crossVectors(dir, Y).normalize();
      if (side.lengthSq() < 0.5) continue;
      const parentQ = foot.parent.getWorldQuaternion(this.footQ);
      const world = this.footW.copy(parentQ).multiply(foot.quaternion);
      world.premultiply(this.footT.setFromAxisAngle(side, -lift * w));
      foot.quaternion.copy(parentQ.invert().multiply(world));
    }
  }

  /**
   * The head turned about the figure's left so its face looks at the look's pitch (level when not aiming), `hold` of
   * the way, the turn no more than `most` degrees (figure.json headUp). The face's way in the Head bone's frame is the
   * bind pose's forward, the figure's left crossed with its up there (the shoulders and the head over the feet).
   */
  private holdHeadUp(head: THREE.Object3D, fig: THREE.Object3D, pitch: number): void {
    if (!this.faceLocal) {
      let sk: THREE.Skeleton | null = null;
      this.root.traverse((o) => {
        const m = o as THREE.SkinnedMesh;
        if (!sk && m.isSkinnedMesh && m.skeleton.bones.some((x) => x.name === "Head")) sk = m.skeleton;
      });
      const S = sk as THREE.Skeleton | null;
      if (!S) return;
      const idx = (name: string) => S.bones.findIndex((x) => x.name === name);
      const at = (i: number) => new THREE.Vector3().setFromMatrixPosition(S.boneInverses[i].clone().invert());
      const [h, fl, fr, ul, ur] = ["Head", "foot_l", "foot_r", "upperarm_l", "upperarm_r"].map(idx);
      if ([h, fl, fr, ul, ur].some((i) => i < 0)) return;
      const up = at(h).sub(at(fl).add(at(fr)).multiplyScalar(0.5)).normalize();
      const left = at(ul).sub(at(ur));
      const fwd = new THREE.Vector3().crossVectors(left, up).normalize();
      this.faceLocal = fwd.transformDirection(S.boneInverses[h]);
    }
    head.updateWorldMatrix(true, false);
    const face = this.headFace.copy(this.faceLocal).transformDirection(head.matrixWorld).applyQuaternion(fig.getWorldQuaternion(this.headQ).invert());
    const now = Math.asin(THREE.MathUtils.clamp(face.y, -1, 1));
    const most = HEAD_UP.most * DEG;
    // (+x is the figure's left: a positive turn tips the face down)
    turnBone(head, fig, X_AXIS, THREE.MathUtils.clamp((now - pitch) * HEAD_UP.hold, -most, most));
  }
  /**
   * The chest tipped back so the upper chest (spine_03 to the neck, what stands between a shooter behind and the head)
   * leans no more than `most` degrees forward of the figure's up (figure.json chestUp), split between spine_02 and
   * spine_03; a lean back (a slide) is the clip's.
   */
  private holdChestUp(b: Record<string, THREE.Object3D>, fig: THREE.Object3D): void {
    // (each world read brings its own bone's chain up to date: the whole figure, every bone and mesh, was updated here
    // a frame for two bones' positions)
    const toFig = this.chestQ.copy(fig.getWorldQuaternion(this.chestQ)).invert();
    const line = b.neck_01.getWorldPosition(this.chestA).sub(b.spine_03.getWorldPosition(this.chestB)).applyQuaternion(toFig);
    const lean = Math.atan2(line.z, line.y);
    const over = lean - CHEST_UP.most * DEG;
    if (over <= 0) return;
    // (+x is the figure's left: a negative turn tips the chest back)
    turnBone(b.spine_02, fig, X_AXIS, -over * 0.5);
    turnBone(b.spine_03, fig, X_AXIS, -over * 0.5);
  }
  private readonly chestA = new THREE.Vector3();
  private readonly chestB = new THREE.Vector3();
  private readonly chestQ = new THREE.Quaternion();
  private readonly headFace = new THREE.Vector3();
  private readonly headQ = new THREE.Quaternion();

  /** the soldier's eye meshes (see the constructor), shown only near the camera */
  private readonly eyes: THREE.SkinnedMesh[] = [];
  /** the eyes drawn or not: a far figure's are under a pixel (lod.json figures.eyes, the figure's level of detail) */
  showEyes(on: boolean): void {
    for (const m of this.eyes) m.visible = on;
  }

  /** how far this gun reaches behind its own grip, metres (0 for a pistol) */
  rear = 0;
  /** the soldier's rifle hold (rifle.ts), while it holds a long gun: its measures, and the held gun's butt, gun-local */
  private rifle: RifleRig | null = null;
  /** the gun in its hands, by id */
  private gunId = "";
  /** where the eye goes to aim the held gun, gun-local */
  private sight: THREE.Vector3 | null = null;
  private butt: THREE.Vector3 | null = null;
  /** what the hold did last frame (how far short each arm fell), for the checks */
  rifleOut: RifleOut | null = null;
  /** where the gun sits in the right hand, remembered while held (rifle.ts RifleState.mem) */
  private rifleMem: { gunInHand: THREE.Matrix4 | null } = { gunInHand: null };
  /** what the held gun gives a reload (its magazine, its charging handle), and last frame's reload progress */
  private reloadParts: ReloadParts | null = null;
  private lastReload: number | null = null;
  /**
   * The magazine's phase in a reload, as the first person's (phase.ts, gunfeel.json phase): its own sweep, run from the
   * magazine's top to its bottom (its group's frame), so only this figure's magazine phases. And the seat's kick.
   */
  private readonly magSweep: PhaseSweep = newSweep(feelCfg.phase);
  private readonly magTop = new THREE.Vector3();
  private readonly magEnd = new THREE.Vector3();
  /** the drawn magazine's middle (its group's frame) and half its size corner to corner, for a radial phase */
  private readonly magMid = new THREE.Vector3();
  private magRadius = 0.05;
  /**
   * A signature gun's swap, as the first person's (gunfeel.json guns.<id>.swap, viewmodel.ts): the gun going away
   * phases out over the holster, the one coming phases in over its draw, along the gun from its back to its muzzle,
   * its magazine with it. Without it the new gun appeared whole in the hands at the swap's middle, a jump in the frames.
   * A gun with no swap of its own changes as it did.
   */
  private readonly gunSweep: PhaseSweep = newSweep(feelCfg.phase);
  private readonly gunNear = new THREE.Vector3();
  private readonly gunFar = new THREE.Vector3();
  /** the bought model's middle, gun-local, and half its size corner to corner: a swap in place phases out from and to it */
  private readonly gunMid = new THREE.Vector3();
  private gunRadius = 0.3;
  /** when the gun in the hands last changed (setGun), on the figure's clock */
  private gunAt = -1;

  /** a swap in place, as the first person's (rifle.ts SWAP_CUP): a signature gun held as a rifle, being swapped */
  private cupSwap(p: FigurePose): boolean {
    return p.act === "swap" && !!SWAP_CUP && !!this.rifle && !!this.mount && !!swapOf(this.gunId);
  }
  private seatKick = 0;
  /**
   * Where the gun ended up, for the checks: how far behind the shoulder its
   * stock sits (positive is behind, and a stock is allowed a little), and how
   * far each hand is from the hold it is reaching for. A hand further than a
   * few centimetres off is the floating hand.
   */
  holdGaps(): { stock: number; grip: number; support: number; slide: number } | null {
    if (!this.gun || !this.grip || !this.support) return null;
    this.root.updateMatrixWorld(true);
    const gap = (side: "l" | "r", onGun: THREE.Vector3): number => {
      const hand = this.bones[`hand_${side}`];
      if (!hand) return 0;
      return hand.getWorldPosition(new THREE.Vector3()).distanceTo(this.gun!.localToWorld(onGun.clone()));
    };
    // the support gap is measured against the hold the hand is reaching for,
    // which on a long gun is further back than the handguard (supportHold)
    return { stock: this.mount ? stockBehind(this.rear) : 0, grip: gap("r", this.grip), support: gap("l", this.supportHold()), slide: this.supportSlide };
  }

  /** the right hand's reach onto a long gun's grip, 0..1 (the tests look) */
  get gripReach(): number {
    return this.gripW;
  }

  /** the left hand's reach onto the gun, 0..1 (the tests look) */
  get supportReach(): number {
    return this.ikW;
  }

  /**
   * The left hand onto the gun's support point: a two-bone reach (upper arm,
   * forearm) with the elbow down and out, weighted by `w`. The clips are a
   * pistol's two-hand grip; a rifle's handguard is 20 to 30 cm further out.
   */
  private reachSupport(w: number): void {
    if (!this.support) return;
    this.reach("l", this.supportHold(), w);
  }

  /**
   * Where the support hand takes hold this frame. Normally the handguard; on
   * a gun too long for the arm, as far along it as the arm reaches
   * (src/game/hold.ts reachFraction). The hand is then holding the gun in a
   * place a person would hold it, rather than hanging in the air beside the
   * place it could not get to, which is what the owner saw.
   */
  private supportHold(): THREE.Vector3 {
    const held = this.support!;
    const up = this.bones.upperarm_l;
    const lo = this.bones.lowerarm_l;
    const hand = this.bones.hand_l;
    if (!up || !lo || !hand || !this.grip || !this.gun) return held;
    // (a pistol's left hand is on the grip already, round the right: slid toward the grip it went 4 cm across into the
    // gun at a sprint, 17 mm in, and the reach was judged to the support point, 7 cm ahead of where its palm goes)
    if (this.rifle && this.gunId && pistolStance(this.gunId)) {
      this.supportSlide = 0;
      return held;
    }
    this.root.updateMatrixWorld(true);
    const shoulder = up.getWorldPosition(v1);
    // (the soldier's rifle hold reaches further with the shoulder brought forward, rifle.ts reachWithShoulder)
    const clav = this.rifle ? this.bones.clavicle_l : null;
    const gain = clav ? shoulderGain(clav.getWorldPosition(v2).distanceTo(shoulder), this.gunId) : 0;
    const arm = shoulder.distanceTo(lo.getWorldPosition(v2)) + lo.getWorldPosition(v2).distanceTo(hand.getWorldPosition(v3)) + gain;
    const a = this.gun.localToWorld(v4.copy(held));
    const b = this.gun.localToWorld(v5.copy(this.grip));
    const t = reachFraction([a.x - shoulder.x, a.y - shoulder.y, a.z - shoulder.z], [b.x - a.x, b.y - a.y, b.z - a.z], arm * 0.98);
    this.supportSlide = t;
    return t < 1e-3 ? held : this.supportAt.copy(held).lerp(this.grip, t);
  }

  /** how far back along the gun the support hand had to slide, 0..1 (the tests look) */
  supportSlide = 0;
  private readonly supportAt = new THREE.Vector3();

  /** one arm (l or r) onto a point on the gun (gun-local), weighted by w */
  private reach(side: "l" | "r", onGun: THREE.Vector3, w: number): void {
    const b = this.bones;
    const up = b[`upperarm_${side}`];
    const lo = b[`lowerarm_${side}`];
    const hand = b[`hand_${side}`];
    if (!up || !lo || !hand || !this.gun || w < 0.01) return;
    this.root.updateMatrixWorld(true);
    const target = this.gun.localToWorld(v4.copy(onGun));
    const a = up.getWorldPosition(v1);
    const bb = lo.getWorldPosition(v2);
    const c = hand.getWorldPosition(v3);
    const lab = a.distanceTo(bb);
    const lbc = bb.distanceTo(c);
    const toT = v5.copy(target).sub(a);
    const dist = Math.max(0.05, Math.min(lab + lbc - 1e-3, toT.length()));
    const dir = toT.normalize();
    // the elbow's side: down and out (the left arm to +x, the figure's left; the right to -x), a little back
    const out = side === "l" ? 0.7 : -0.9;
    const pole = new THREE.Vector3(out, -1, -0.2).applyQuaternion(this.root.getWorldQuaternion(new THREE.Quaternion()));
    pole.addScaledVector(dir, -pole.dot(dir)).normalize();
    const cosA = Math.max(-1, Math.min(1, (lab * lab + dist * dist - lbc * lbc) / (2 * lab * dist)));
    const sinA = Math.sqrt(1 - cosA * cosA);
    const elbow = a.clone().addScaledVector(dir, cosA * lab).addScaledVector(pole, sinA * lab);
    aimBone(up, bb.clone().sub(a), elbow.clone().sub(a), w);
    const b2 = lo.getWorldPosition(new THREE.Vector3());
    const c2 = hand.getWorldPosition(new THREE.Vector3());
    const goal = a.clone().addScaledVector(dir, dist);
    aimBone(lo, c2.sub(b2), goal.sub(b2), w);
  }

  setGunVisible(on: boolean): void {
    this.gunShown = on;
    if (this.gun) this.gun.visible = on && !this.dead;
    this.gunInHand = !!this.gun && this.gun.visible;
  }

  /** the gun in its hand (the figure drops a copy of it when knocked out) */
  get gunObject(): THREE.Object3D | null {
    return this.gun;
  }

  /** a bone by its name (the rig's own, e.g. hand_r or middle_01_l), for the tools that measure a figure */
  boneAt(name: string): THREE.Object3D | null {
    return this.bones[name] ?? null;
  }

  /**
   * Where each palm is meant to be this frame, in the world (tools/figure-frames.ts): the soldier's rifle hold's own
   * (its hold points and each gun's palm offsets, rifle.ts), else the gun's grip and support; null without a long gun.
   */
  holdPoints(): { grip: THREE.Vector3; support: THREE.Vector3 } | null {
    if (!this.gun || !this.grip || !this.support) return null;
    const p = this.rifle ? this.rifleOut?.palm : null;
    this.root.updateMatrixWorld(true);
    // (each hand's own target where the hold placed one: the left off the gun on a zip line, the right's grip was read off
    // the gun's bare grip point instead, 9.5 to 18 cm from where the hold puts the palm)
    if (p?.r) return { grip: p.r.clone(), support: p.l ? p.l.clone() : this.gun.localToWorld(this.supportHold().clone()) };
    return { grip: this.gun.localToWorld(this.grip.clone()), support: this.gun.localToWorld(this.supportHold().clone()) };
  }

  /** knocked out, or back up: the death clip plays once from the start; back up snaps to the pose */
  setDead(on: boolean): void {
    if (on === this.dead) return;
    this.dead = on;
    if (this.gun) this.gun.visible = this.gunShown && !on;
    this.gunInHand = !!this.gun && this.gun.visible;
    // (upright for the death clip, which lays it on the floor itself: a figure shot off a wall or out of the sky falls
    // from where it was, not leaning or lying on the air)
    this.wallW = this.skyW = 0;
    this.tiltQ.identity();
    this.bankQ.identity();
    this.bank.set(0, 0);
    this.root.quaternion.identity();
    this.placeRoot();
    if (on) {
      // the library's death is 2.4 s: a game's is quicker (1.5 s)
      this.play("lower", "Death01", 1.6, 0.12, true, "full");
      this.upper?.fadeOut(0.12);
      this.upper = null;
      this.upperName = "";
    } else {
      // up again (a new round, a respawn): the next update picks the clips, at once
      this.mixer.stopAllAction();
      this.lower = this.upper = null;
      this.lowerName = this.upperName = "";
    }
  }

  /**
   * A wall run leans the body off its wall and a skydive lays it on the air (Milestone 604): the whole figure turned
   * round its hips before the clips and everything on top, so the hold, the hands and the hit volumes that follow the
   * bones all work in it. A runner's feet go onto the wall: the player's middle is held its hull's radius off it
   * (movement.json radius, player.ts wallRun), so the lean is the angle that carries a foot a hip's height under the
   * hips that far across. A skydive is figure.json skydive.glide degrees forward of upright looking level and .dive
   * looking down, as far between as the look is between the skydive's own glide and dive (squad.json dive).
   */
  private layBody(p: FigurePose, dt: number): void {
    const wall = p.stance === "wallL" ? 1 : p.stance === "wallR" ? -1 : 0;
    this.wallW += (wall - this.wallW) * Math.min(1, dt * WALL_RUN.rate);
    const sky = p.stance === "skydive";
    this.skyW += ((sky ? 1 : 0) - this.skyW) * Math.min(1, dt * (sky ? SKYDIVE.rateIn : SKYDIVE.rateOut));
    const dive = Math.max(0, Math.min(1, (DIVE.flatPitch - p.pitch) / (DIVE.flatPitch - DIVE.downPitch)));
    if (sky) this.diveW += (dive - this.diveW) * Math.min(1, dt * SKYDIVE.rateIn);
    const q = this.tiltQ.identity();
    if (Math.abs(this.wallW) > 1e-3) {
      // about the way it runs (figure space: +z its front, +x its left): a wall on its left turns its up to its right
      const m = p.moveDir ?? 0;
      const lean = Math.asin(Math.min(0.7, MOVE.radius / this.hipY));
      q.multiply(layQ.setFromAxisAngle(layV.set(-Math.sin(m), 0, Math.cos(m)), lean * this.wallW));
    }
    if (this.skyW > 1e-3) q.multiply(layQ.setFromAxisAngle(X_AXIS, (SKYDIVE.glide + (SKYDIVE.dive - SKYDIVE.glide) * this.diveW) * DEG * this.skyW));
    this.leanIntoTurn(p, dt);
    this.root.quaternion.copy(this.bankQ).multiply(this.tiltQ);
    this.placeRoot();
  }

  /**
   * A runner leans into a turn (Milestone 609): Apex's and Titanfall's do, and ours ran a curve bolt upright. Its way of
   * moving and the change in it are read off where its group goes (an enemy's from its samples, smoothed at
   * figure.json bank.smooth), and on the ground above bank.minSpeed it leans toward the turn's middle as far as a
   * body balanced against the game's own gravity would (atan of the sideways acceleration over gravity), `share` of
   * it, no more than `most` degrees, round its feet, which stay where they are; eased at `rate` a second.
   */
  private leanIntoTurn(p: FigurePose, dt: number): void {
    const g = this.root.parent;
    const at = g ? g.getWorldPosition(layP) : null;
    let want = 0;
    let wx = 0;
    let wz = 0;
    if (at && this.lastXZ && dt > 1e-4) {
      // (no faster than 30 m/s: a figure put somewhere else is no run)
      const vx = Math.max(-30, Math.min(30, (at.x - this.lastXZ[0]) / dt));
      const vz = Math.max(-30, Math.min(30, (at.z - this.lastXZ[1]) / dt));
      const k = Math.min(1, dt * BANK.smooth);
      const ax = (vx - this.vel.x) / dt;
      const az = (vz - this.vel.y) / dt;
      this.vel.x += (vx - this.vel.x) * k;
      this.vel.y += (vz - this.vel.y) * k;
      this.acc.x += (ax - this.acc.x) * k;
      this.acc.y += (az - this.acc.y) * k;
      const speed = this.vel.length();
      const ground = p.stance === "stand" || p.stance === "crouch" || p.stance === "slide";
      if (ground && speed > BANK.minSpeed) {
        // the change across the way it moves: the turn's middle is that way
        const ux = this.vel.x / speed;
        const uz = this.vel.y / speed;
        const along = this.acc.x * ux + this.acc.y * uz;
        wx = this.acc.x - along * ux;
        wz = this.acc.y - along * uz;
        const across = Math.hypot(wx, wz);
        if (across > 1e-3) {
          want = Math.min(BANK.most * DEG, Math.atan(across / MOVE.gravity) * BANK.share);
          wx /= across;
          wz /= across;
        }
      }
    }
    if (at) this.lastXZ = [at.x, at.z];
    const e = Math.min(1, dt * BANK.rate);
    this.bank.x += (wx * want - this.bank.x) * e;
    this.bank.y += (wz * want - this.bank.y) * e;
    const angle = this.bank.length();
    if (angle < 1e-4 || !g) {
      this.bankQ.identity();
      return;
    }
    // toward the turn's middle in the group's own frame: its up turned toward it, about up x that way
    const n = layV.set(this.bank.x / angle, 0, this.bank.y / angle).applyQuaternion(g.getWorldQuaternion(layG).invert());
    this.bankQ.setFromAxisAngle(new THREE.Vector3(0, 1, 0).cross(n).normalize(), angle);
  }

  /**
   * The root where its turn round the hips leaves them where they were, then leant round its feet (bank), on its lift
   * (a still stand's, an emote's bounce)
   */
  private placeRoot(): void {
    const hip = layV.set(0, this.hipY, 0).applyQuaternion(this.tiltQ);
    const off = hip.set(-hip.x, this.hipY - hip.y, -hip.z).applyQuaternion(this.bankQ);
    this.root.position.set(off.x, this.baseY + off.y, off.z);
  }

  /**
   * The skydive's limbs (figure.json skydive), on the body at rest it is laid from. Gliding, the box a skydiver flies:
   * the upper arms out level, the forearms up past the head, the back arched, the head up to see ahead, the thighs back
   * and apart and the shins up behind. Diving: the arms back along the body, the legs together and nearly straight. As
   * far between as the dive is, the forearms and shins fluttering in the wind.
   */
  private skydiveLimbs(b: Record<string, THREE.Object3D>, fig: THREE.Object3D): void {
    const G = SKYDIVE.glideLimbs;
    const D = SKYDIVE.diveLimbs;
    const at = (key: keyof Limbs) => (G[key] + (D[key] - G[key]) * this.diveW) * DEG * this.skyW;
    const [amp, hz] = SKYDIVE.flutter;
    const flap = (phase: number) => amp * DEG * this.skyW * Math.sin(this.t * hz * 2 * Math.PI + phase);
    // (the arms as an emote's: the right hangs toward -x, so it is raised about the front axis the negative way)
    turnBone(b.upperarm_r, fig, Z_AXIS, -at("raise"));
    turnBone(b.upperarm_r, fig, X_AXIS, -at("forward"));
    if (b.upperarm_l) {
      turnBone(b.upperarm_l, fig, Z_AXIS, at("raise"));
      turnBone(b.upperarm_l, fig, X_AXIS, -at("forward"));
    }
    if (b.lowerarm_r) turnBone(b.lowerarm_r, fig, Z_AXIS, -(at("elbow") + flap(0)));
    if (b.lowerarm_l) turnBone(b.lowerarm_l, fig, Z_AXIS, at("elbow") + flap(1.7));
    if (b.spine_02) turnBone(b.spine_02, fig, X_AXIS, -at("arch"));
    if (b.Head) turnBone(b.Head, fig, X_AXIS, -at("head"));
    // (a turn about the figure's left by a positive angle takes a hanging bone's end back; the right leg is toward -x)
    for (const [s, out, phase] of [["r", -1, 0.6], ["l", 1, 2.4]] as const) {
      const thigh = b[`thigh_${s}`];
      const calf = b[`calf_${s}`];
      if (thigh) {
        turnBone(thigh, fig, X_AXIS, at("thigh"));
        turnBone(thigh, fig, Z_AXIS, out * at("spread"));
      }
      if (calf) turnBone(calf, fig, X_AXIS, at("knee") + flap(phase));
    }
  }

  /** where its left hand holds a zip line's rope (world): the rope runs ziplineHang over its feet (player.ts hangAt) */
  private ropeAt(out: THREE.Vector3): THREE.Vector3 {
    const G = ZIPLINE.grip;
    // (+x is the figure's left, +z the way it faces)
    return this.root.localToWorld(out.set(G[0], 0, G[2])).setY((this.root.parent ?? this.root).getWorldPosition(new THREE.Vector3()).y + MOVE.ziplineHang - G[1]);
  }

  /** pulled to a grapple's hook point (world): the left hand lets go of the gun and the arm reaches up at it */
  reachFor(to: THREE.Vector3, seconds: number, arrive: number): void {
    this.grapple = { to: to.clone(), until: this.t + seconds, arrive };
  }

  /**
   * The left arm up at a grapple's hook point (Milestone 607): EMPULSE's and Pathfinder's grapples are an arm thrown at
   * the point and the body hauled after it; ours was a jump pose with a line drawn from it. The upper arm and then the
   * forearm turned to point at it, eased in and out at figure.json grapple.rate, after the hold (which has let the left
   * hand go: update's support).
   */
  private reachArm(b: Record<string, THREE.Object3D>): void {
    const G = this.grapple;
    // a grapple's hook point, or a zip line's rope over its head (Milestone 616)
    const grab = !!G && this.grabW >= 0.01;
    const w = grab ? this.grabW : this.zipW;
    const up = b.upperarm_l;
    const fore = b.lowerarm_l;
    // (a grapple points the wrist at its point; a rope is held in the closed fingers, so the knuckles go to it)
    const tip = grab ? b.hand_l : b.middle_01_l;
    if (w < 0.01 || !up || !fore || !tip) return;
    const to = grab ? G!.to.clone() : this.ropeAt(new THREE.Vector3());
    const aim = () => {
      const sh = up.getWorldPosition(new THREE.Vector3());
      aimBone(up, tip.getWorldPosition(new THREE.Vector3()).sub(sh), to.clone().sub(sh), w);
      const el = fore.getWorldPosition(new THREE.Vector3());
      aimBone(fore, tip.getWorldPosition(new THREE.Vector3()).sub(el), to.clone().sub(el), w);
    };
    aim();
    // (and the straight arm's reach to its knuckles, for the next frame's lift onto the rope: update)
    if (!grab && this.zipW > 0.99) this.zipReach = up.getWorldPosition(new THREE.Vector3()).distanceTo(tip.getWorldPosition(new THREE.Vector3()));
  }

  /** knocked out: only the death clip runs */
  updateDead(dt: number): void {
    // the last live frame's turns come off first, so the death clip starts clean
    this.restoreClipPose();
    this.mixer.update(dt);
    this.captureClipPose();
  }

  /**
   * The hit flash, the body lit for a moment, and the threat highlight, 0 to 1 (a Digital Threat optic, a REVEAL: dummy.ts
   * setThreat): red light over the body darkened, since red over its own colours reads pink. Kept under 1, as filmic
   * tone mapping pushes a brighter red toward orange.
   */
  setFlash(amount: number, head: boolean, threat = 0): void {
    for (let i = 0; i < this.mats.length; i++) {
      const m = this.mats[i];
      m.emissive.setRGB(amount * 0.9 + (head ? amount * 0.6 : 0) + threat * 0.95, amount * 0.9 + (head ? amount * 0.3 : 0) + threat * 0.02, amount * 0.9 + threat * 0.02);
      m.color.copy(this.matColours[i]).multiplyScalar(1 - 0.9 * threat);
    }
  }

  /** how much of the body is drawn, 1 all of it (setFade) */
  private fade = 1;
  /**
   * The body drawn in part, 1 whole to 0 not at all (your own soldier as a wall brings the third-person camera up
   * against it: tpcam.ts selfFadeAt). Hashed, a share of its pixels dropped, not blended: a body half see-through drawn
   * blended sorts wrongly against itself and the gun in its hands.
   */
  setFade(alpha: number): void {
    const a = Math.max(0, Math.min(1, alpha));
    if (Math.abs(a - this.fade) >= 1e-3) {
      const hashed = a < 0.999;
      for (const m of this.mats) {
        if (m.alphaHash !== hashed) {
          m.alphaHash = hashed;
          m.needsUpdate = true;
        }
        m.opacity = hashed ? a : 1;
      }
      this.fade = a;
    }
    // (the gun goes with the body once the body is mostly gone: left on its own it hung in the air in front of you. Its
    // materials are its model's, shared with every figure holding one, so it is shown or not rather than thinned; called
    // after update(), which shows it again each frame)
    if (this.gun && a < 0.5) this.gun.visible = false;
  }

  /** how much of the body is drawn (setFade) */
  get faded(): number {
    return this.fade;
  }

  private play(layer: "lower" | "upper", name: string, timeScale: number, fade = 0.18, once = false, source: "lower" | "upper" | "full" = layer): void {
    const key = `${source}:${name}`;
    const clip = this.tpl.clips.get(key) ?? this.tpl.clips.get(`${layer}:Idle_Loop`);
    if (!clip) return;
    if ((layer === "lower" ? this.lowerName : this.upperName) === key) {
      const cur = layer === "lower" ? this.lower : this.upper;
      if (cur) cur.timeScale = timeScale;
      return;
    }
    const next = this.mixer.clipAction(clip);
    next.reset();
    next.timeScale = timeScale;
    next.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, Infinity);
    next.clampWhenFinished = once;
    next.play();
    const prev = layer === "lower" ? this.lower : this.upper;
    if (prev) next.crossFadeFrom(prev, fade, false);
    if (layer === "lower") {
      this.lower = next;
      this.lowerName = key;
    } else {
      this.upper = next;
      this.upperName = key;
    }
  }

  /**
   * One frame: the clips for the pose, the mixer, then the corrections on
   * top (the strafe's hips and spine, the look pitch, a kick, a flinch, a
   * JOLT's lean). `armed`: it has a gun in hand.
   */
  /** the time of the frames it sat out (figlod.ts): given to the mixer when its turn comes, so nothing drifts */
  private owed = 0;

  /**
   * Its pose this frame. `animate` false is a frame it sits out at distance
   * (figlod.ts): the time is kept and handed over on the next one it plays.
   */
  update(p: FigurePose, dt: number, armed: boolean, fx: MannequinImpulses, animate = true): void {
    if (!animate) {
      this.owed += dt;
      return;
    }
    dt += this.owed;
    this.owed = 0;
    // (armed coming in: it is put down below for what takes the hands, and the gun is then put on the back: the end)
    const armedIn = armed;
    const speed = Math.max(0, p.speed);
    this.t += dt;
    this.layBody(p, dt);
    // a grapple pulls it until it is near its hook point or its time is up; the arm comes down after
    const G = this.grapple;
    const pulled = !!G && this.t < G.until && this.root.getWorldPosition(new THREE.Vector3()).distanceTo(G.to) > G.arrive;
    this.grabW += ((pulled ? 1 : 0) - this.grabW) * Math.min(1, dt * GRAPPLE.rate);
    if (!pulled && this.grabW < 0.01) this.grapple = null;
    // on a zip line the left hand goes up onto the rope (reachArm), off the gun
    const zipping = p.stance === "zip";
    this.zipW += ((zipping ? 1 : 0) - this.zipW) * Math.min(1, dt * ZIPLINE.rate);
    // its fall from where its group goes (an enemy's is only where its samples put it), eased over the samples' steps
    const y = this.root.parent ? this.root.parent.getWorldPosition(new THREE.Vector3()).y : 0;
    // (no faster than 60 m/s: a figure put somewhere else, a respawn, is no fall)
    if (this.lastY !== null && dt > 0) this.vy += (Math.max(-60, Math.min(60, (y - this.lastY) / dt)) - this.vy) * Math.min(1, dt * 20);
    this.lastY = y;
    this.plungeW += ((p.stance === "air" && this.vy < -PLUNGE.fall ? 1 : 0) - this.plungeW) * Math.min(1, dt * PLUNGE.rate);
    // a landing from standing (or a walk): the impact's crouch from the landing clip, briefly (a skydive's too)
    const air = airborne(p.stance);
    if (this.wasAir && !air && (fx.land ?? 0) > 0.4 && speed < 2.6 && p.stance === "stand") this.landUntil = this.t + 0.32;
    this.wasAir = air;
    // A double jump: the knees come up and go back down (figure.json doubleJump). The first count a figure is given is
    // where it starts, so a player first seen after some double jumps does not lift for them.
    if (fx.airJumps !== undefined && fx.airJumps !== this.airJumpsSeen) {
      if (this.airJumpsSeen !== null && air) this.liftAt = this.t;
      this.airJumpsSeen = fx.airJumps;
    }
    // a shot (the first count is where it starts, as the double jumps')
    if (fx.shots !== undefined && fx.shots !== this.shotsSeen) {
      if (this.shotsSeen !== null) this.shotAt = this.t;
      this.shotsSeen = fx.shots;
    }
    const lift = air ? (this.t - this.liftAt) / DOUBLE_JUMP.time : 1;
    // the head was hit: the head snaps back, once
    if (fx.headHit !== undefined && fx.headHit !== this.headSeen && Number.isFinite(fx.headHit)) {
      this.headSeen = fx.headHit;
      this.headUntil = this.t + 0.35;
    }
    // the shield broke: the stagger clip on the upper body, once
    if (fx.stagger !== undefined && fx.stagger !== this.staggerSeen && Number.isFinite(fx.stagger)) {
      this.staggerSeen = fx.stagger;
      this.staggerUntil = this.t + 0.3;
    }
    const back = speed > 0.3 && Math.abs(p.moveDir ?? 0) > 1.9;
    const dirSign = back ? -1 : 1;
    const onWall = p.stance === "wallL" || p.stance === "wallR";
    // in the skydive the hands are the body's: the gun put away until the ground (Apex's legends fall with empty hands)
    if (p.stance === "skydive") armed = false;
    // and a climb or a mantle takes both hands onto the ledge: a long gun goes on the back for it (Milestone 618; it was
    // carried in the right hand through the climb clip, which planted it muzzle-down on the ledge and swung it about); a
    // pistol stays in the hand
    if ((p.stance === "climb" || p.stance === "mantle") && this.rifle && !pistolStance(this.gunId)) armed = false;
    // A slide has a way in and a way out (the free library's Slide_Start and
    // Slide_Exit, once they have loaded): it used to cut straight into its
    // loop and straight out of it, which every other player saw as a pop.
    if (p.stance !== this.lastStance) {
      if (p.stance === "slide") this.slideAt = this.t;
      else if (this.lastStance === "slide" && hasClip("Slide_Exit")) this.slideExitUntil = this.t + clipSeconds("Slide_Exit") * 0.6;
      this.lastStance = p.stance;
    }
    // a new melee picks the next of the three swings, so a string of them is not one punch over and over
    const act = p.act ?? null;
    // A throw, a swing, a revive and a reach for something take the hands
    // off the gun: it goes away for the moment, and with it the rifle's
    // two-handed hold, whose reach onto the gun ran after the clip and pulled
    // both arms straight back onto it.
    // SpeedKills' soldier with a long gun strikes with it instead (rifle.ts melee): it keeps it, and both hands on it
    const rifleMelee = act === "melee" && !!this.rifle && !!this.mount;
    if (act !== this.lastAct) {
      if (act === "melee") this.meleeSwing = (this.meleeSwing + 1) % MELEE_SWINGS.length;
      this.lastAct = act;
      this.actAt = this.t;
      // (a vent goes into its carry from wherever the gun was)
      if (act === "vent") this.ventFrom = this.lowered;
    }
    // the soldier's throw is over once the grenade has gone (soldierhold.json throwFor), and the hands go back for the
    // gun: held to the act's own time, its arms hung empty for 0.35 s after the release
    const throwing = act === "throw" && !(this.rifle && this.mount && this.t - this.actAt >= THROW_FOR);
    if (throwing || (act === "melee" && !rifleMelee) || act === "interact") armed = false;
    let lowerOnce = false;
    // the legs
    let lower = "Idle_Loop";
    let lowerRate = 1;
    let full = false;
    switch (p.stance) {
      case "crouch":
        lower = speed > 0.3 ? "Crouch_Fwd_Loop" : "Crouch_Idle_Loop";
        lowerRate = speed > 0.3 ? (speed / 2.2) * dirSign : 1;
        break;
      case "slide":
        lower = hasClip("Slide_Start") && this.t - this.slideAt < clipSeconds("Slide_Start") ? "Slide_Start" : "Slide_Loop";
        full = true;
        break;
      case "air":
        // a fast jump (out of a sprint, a slide, a pad) tucks its legs like an athlete's; a standing hop does not
        lower = speed > ATHLETIC_JUMP && hasClip("NinjaJump_Idle_Loop") ? "NinjaJump_Idle_Loop" : "Jump_Loop";
        break;
      case "climb":
      case "mantle":
        lower = "ClimbUp_1m";
        full = true;
        break;
      case "zip":
        // hanging from the rope by the left hand (reachArm), the legs down under it (below) and the gun in the right hand,
        // as Apex's legends ride theirs; it was the rail clip, the gun in both hands, standing in the air under the rope
        lower = "Idle_Loop";
        break;
      case "wallL":
      case "wallR":
        // the run along the wall, its legs no quicker than a run's at mostRate (a wall run is twice a sprint's speed)
        lower = speed > 6.2 ? "Sprint_Loop" : "Jog_Fwd_Loop";
        lowerRate = Math.min(WALL_RUN.mostRate, speed / (speed > 6.2 ? 7.5 : 4.8)) * dirSign;
        break;
      case "skydive":
        // the body laid on the air and its limbs set out on top (skydiveLimbs), from a body standing at rest
        lower = "Idle_Loop";
        full = true;
        break;
      default:
        if (this.t < this.slideExitUntil && speed > 0.3) {
          lower = "Slide_Exit";
          full = true;
        } else if (this.t < this.landUntil) {
          lower = "Jump_Land";
          lowerRate = 2.2;
        } else if (speed > 6.2) {
          lower = "Sprint_Loop";
          lowerRate = (speed / 7.5) * dirSign;
        } else if (speed > 2.6) {
          lower = "Jog_Fwd_Loop";
          lowerRate = (speed / 4.8) * dirSign;
        } else if (speed > 0.3) {
          lower = "Walk_Loop";
          lowerRate = (speed / 1.6) * dirSign;
        }
    }
    // an emote: the gun put away, the arms hanging from the legs' clip, and the pose on top (below);
    // one made of a clip (a dance, a nod) is that clip, whole, instead of a pose
    const em = fx.emote && fx.emote.weight > 0.02 ? fx.emote : null;
    if (em) armed = false;
    const emClip = em?.clip && hasClip(em.clip) ? em.clip : null;
    if (emClip && p.stance !== "air" && p.stance !== "slide") {
      lower = emClip;
      lowerRate = 1;
      full = true;
    }
    // A jump out of a sprint keeps the sprint's carry, as a runner's gun stays low until they aim: raised in the air and
    // lowered again on landing, the stock swept through the right forearm both ways. And a gun carried low into the
    // landing stays low until the landing is over, to come up in the standing body (Phase 27, 27.12)
    const sprintJump = (p.stance === "air" && speed > 6.2) || (lower === "Jump_Land" && this.lowered > 0.5);
    // the hands: a full-body clip takes them too; otherwise the gun's pose, or the arms' swing
    let upper = lower;
    let upperRate = lowerRate;
    let once = false;
    if (!full) {
      if (this.t < this.headUntil && hasClip("Hit_Head")) {
        upper = "Hit_Head";
        upperRate = 1.3;
        once = true;
      } else if (this.t < this.staggerUntil) {
        upper = "Hit_Chest";
        upperRate = 1.1;
        once = true;
      } else if (throwing && hasClip("OverhandThrow")) {
        upper = "OverhandThrow";
        upperRate = 1.3;
        once = true;
      } else if (rifleMelee) {
        upper = "Pistol_Aim_Neutral";
        upperRate = 1;
      } else if (act === "melee") {
        // a jab, a cross or a hook, whichever of them has loaded
        upper = [MELEE_SWINGS[this.meleeSwing], "Punch_Jab"].find((c) => hasClip(c))!;
        upperRate = 1.4;
        once = true;
      } else if (act === "interact" && hasClip("Interact")) {
        upper = "Interact";
        upperRate = 1;
      } else if (!armed) {
        upper = lower;
      } else if (p.act === "reload") {
        // the soldier's rifle is reloaded by its own hands (rifle.ts); the pistol's reload clip is the rest's
        upper = this.rifle && this.mount ? "Pistol_Aim_Neutral" : "Pistol_Reload";
        upperRate = 1;
        once = !(this.rifle && this.mount);
      } else if ((p.act === "swap" && !this.cupSwap(p)) || (((lower === "Sprint_Loop" && !onWall) || sprintJump) && (p.ads ?? 0) < 0.3)) {
        upper = "Pistol_Idle_Loop";
        upperRate = 1;
      } else {
        upper = "Pistol_Aim_Neutral";
        upperRate = 1;
      }
    }
    this.play("lower", lower, lowerRate, 0.18, lowerOnce);
    this.play("upper", upper, upperRate, 0.15, once);
    // no gun in the hand down (the figure says armed = false then). SpeedKills' soldier, taking its long
    // gun back (after a throw or a reach for something), has the hands go to it first and shows it once they are
    // nearly there: shown at once, it came back through both hands while they were still on their way (Phase 27, 27.12)
    const wantGun = this.gunShown && armed && !this.dead;
    if (!wantGun && this.rifle && this.mount) this.gunComing = true;
    if (this.gun) this.gun.visible = wantGun && !(this.gunComing && Math.min(this.gripW, this.ikW) < GUN_BACK);
    this.gunInHand = !!this.gun && this.gun.visible;
    this.restoreClipPose();
    this.mixer.update(dt);
    this.captureClipPose();
    // on top of the clips
    const b = this.bones;
    const fig = this.root;
    if (b.pelvis && b.spine_01) {
      turnBone(b.pelvis, fig, Y, fx.legYaw);
      turnBone(b.spine_01, fig, Y, -fx.legYaw);
    }
    const aimed = !full && armed && p.act !== "swap";
    this.scoped = aimed && !act && wantGun && !this.gunComing ? (p.ads ?? 0) * (1 - this.lowered) : 0;
    const pitch = aimed ? Math.max(-70, Math.min(70, p.pitch)) * DEG : 0;
    // (the soldier's chest held up before the look bends it: the clips lean it 33 to 40 degrees crouched and aimed or
    // sprinting, and from behind the shoulder armour and the pack hid the head; the owner, 2026-10-04: more upright)
    if (b.spine_02 && b.spine_03 && b.neck_01 && !full && !this.dead) this.holdChestUp(b, fig);
    // +x is the figure's left: a turn about it by a negative angle tips the chest back (a look up)
    const lean = fx.jolt * 0.45 - fx.flinch * 0.22;
    // (the soldier looking down bends only as far as its gun's hold needs, at the waist, and its head goes down onto the
    // stock for the rest: bent as far as a look up, the head went down between the shoulders and from behind they hid it)
    const bend = pitch < 0 ? (AIM_BEND.downByGun[this.gunId] ?? AIM_BEND.down) : AIM_BEND.up;
    if (b.spine_01 && bend[0]) turnBone(b.spine_01, fig, new THREE.Vector3(1, 0, 0), -pitch * bend[0]);
    if (b.spine_02) turnBone(b.spine_02, fig, new THREE.Vector3(1, 0, 0), -pitch * bend[1] + lean * 0.5);
    if (b.spine_03) turnBone(b.spine_03, fig, new THREE.Vector3(1, 0, 0), -pitch * bend[2] + lean * 0.5 - fx.kick * 0.1);
    // (the soldier's head held up to the look before its deliberate tilts: the clips carried it down with the chest, the
    // head 43 degrees forward of the neck standing, 52 to 56 aimed, 74 to 80 crouched or sprinting, chin on the chest,
    // and from behind a shot at the back of the head it showed took the neck's or torso's volume: 2 to 7 in 100 were
    // headshots sprinting or crouched, the owner unable to headshot one from behind with BOOG)
    if (b.Head && !full && !this.dead) this.holdHeadUp(b.Head, fig, pitch);
    if (b.Head) turnBone(b.Head, fig, new THREE.Vector3(1, 0, 0), -fx.flinch * 0.25 + 0.1 * fx.ads);
    // The emote, on top of everything: the arms raised and swung in figure
    // space (+x is the figure's left, +z its front), the forearms bent at the
    // elbow, the spine and the head turned, the hips swung. Each angle arrives
    // eased, so the figure goes into it and comes out of it smoothly. An
    // emote playing its own clip is the clip, with nothing on top.
    if (em && !(emClip && lower === emClip)) {
      const X = new THREE.Vector3(1, 0, 0);
      const Z = new THREE.Vector3(0, 0, 1);
      if (b.pelvis) turnBone(b.pelvis, fig, Y, em.hipSway);
      if (b.spine_02) {
        turnBone(b.spine_02, fig, Y, em.spineTwist);
        turnBone(b.spine_02, fig, X, em.spineLean);
        turnBone(b.spine_02, fig, Z, -em.spineSide);
      }
      if (b.Head) {
        turnBone(b.Head, fig, X, em.headNod);
        turnBone(b.Head, fig, Z, -em.headTilt);
      }
      // the right arm hangs toward -x's side: raising it turns it about the front axis the negative way
      if (b.upperarm_r) {
        turnBone(b.upperarm_r, fig, Z, -em.rRaise);
        turnBone(b.upperarm_r, fig, X, -em.rForward);
      }
      if (b.lowerarm_r) {
        turnBone(b.lowerarm_r, fig, Z, -em.rElbow);
        turnBone(b.lowerarm_r, fig, X, -em.rElbowF);
      }
      if (b.upperarm_l) {
        turnBone(b.upperarm_l, fig, Z, em.lRaise);
        turnBone(b.upperarm_l, fig, X, -em.lForward);
      }
      if (b.lowerarm_l) {
        turnBone(b.lowerarm_l, fig, Z, em.lElbow);
        turnBone(b.lowerarm_l, fig, X, -em.lElbowF);
      }
      this.baseY = em.bounce;
    } else this.baseY = FLAT_FEET.lift * this.liftW;
    this.placeRoot();
    if (this.skyW > 0.01 && b.upperarm_r) this.skydiveLimbs(b, fig);
    // A plunge (Milestone 608): SLAM's way down, 38 m/s, faster than anything else that falls in the air stance (the
    // skydive's dive is 30), seen as a body coming down onto the ground it hits, knees up and the chest over them, as
    // Hyper Scape's slam reads; it was the jump pose dropping like a stone
    if (this.plungeW > 0.01) {
      const w = this.plungeW;
      for (const s of ["l", "r"]) {
        const thigh = b[`thigh_${s}`];
        const calf = b[`calf_${s}`];
        if (thigh) turnBone(thigh, fig, X_AXIS, -PLUNGE.raise * DEG * w);
        if (calf) turnBone(calf, fig, X_AXIS, PLUNGE.bend * DEG * w);
      }
      if (b.spine_02) turnBone(b.spine_02, fig, X_AXIS, PLUNGE.lean * DEG * w);
    }
    // A landing taken in the legs (Milestone 611): the knees give and the body sinks onto them for a moment, as much as
    // the fall was long (dummy.ts land, 0.35 to 1, gone in a quarter of a second), on the run as well as standing still,
    // where only a standing landing had its clip (landUntil, which this leaves to it). The feet stay on the ground: the
    // body is lowered by what the bent legs lift them, measured off the feet before and after, and never so far that the
    // lower ankle goes under its height on the floor (measured as the figure is made).
    const landing = !air && !this.dead && this.t >= this.landUntil && (p.stance === "stand" || p.stance === "crouch") ? (fx.land ?? 0) : 0;
    if (landing > 0.01 && b.foot_l && b.foot_r) {
      const low = () => Math.min(b.foot_l.getWorldPosition(layP).y, b.foot_r.getWorldPosition(layP).y);
      const before = low();
      for (const s of ["l", "r"]) {
        const thigh = b[`thigh_${s}`];
        const calf = b[`calf_${s}`];
        if (thigh) turnBone(thigh, fig, X_AXIS, -LANDING.raise * DEG * landing);
        if (calf) turnBone(calf, fig, X_AXIS, LANDING.bend * DEG * landing);
      }
      if (b.spine_02) turnBone(b.spine_02, fig, X_AXIS, LANDING.lean * DEG * landing);
      const floor = (this.root.parent ? this.root.parent.getWorldPosition(layV).y : 0) + this.ankleY;
      this.root.position.y += Math.max(before, floor) - low();
      this.root.updateMatrixWorld(true);
    }
    // the double jump's knees, up and back down over its time: the thighs forward (a turn about the figure's left by a
    // negative angle brings a hanging bone's end forward) and the knees bent back
    if (lift >= 0 && lift < 1) {
      const w = Math.sin(Math.PI * lift);
      for (const s of ["l", "r"]) {
        const thigh = b[`thigh_${s}`];
        const calf = b[`calf_${s}`];
        if (thigh) turnBone(thigh, fig, X_AXIS, -DOUBLE_JUMP.raise * DEG * w);
        if (calf) turnBone(calf, fig, X_AXIS, DOUBLE_JUMP.bend * DEG * w);
      }
    }
    // on a zip line the legs hang under the hand on the rope, the thighs a little forward and the knees bent back
    if (this.zipW > 0.01)
      for (const s of ["l", "r"]) {
        const thigh = b[`thigh_${s}`];
        const calf = b[`calf_${s}`];
        if (thigh) turnBone(thigh, fig, X_AXIS, -ZIPLINE.thigh * DEG * this.zipW);
        if (calf) turnBone(calf, fig, X_AXIS, ZIPLINE.knee * DEG * this.zipW);
      }
    // Hung from the rope by the left hand: the body raised until that arm, as straight as it goes, reaches it. The rope
    // runs ziplineHang over the feet the game moves, and from the soldier's shoulder there its arm fell 9 cm short.
    // Raised here, before the gun is placed in the right hand (raised after it, the hand went up off the grip)
    if (this.zipW > 0.01 && b.upperarm_l && b.lowerarm_l && b.hand_l) {
      const sh = b.upperarm_l.getWorldPosition(new THREE.Vector3());
      const d = this.ropeAt(new THREE.Vector3()).sub(sh);
      // (the arm's reach to its knuckles as reachArm last left it straight, or its bones' lengths end to end)
      const el = b.lowerarm_l.getWorldPosition(new THREE.Vector3());
      const reach = this.zipReach ?? sh.distanceTo(el) + el.distanceTo(b.hand_l.getWorldPosition(new THREE.Vector3())) + 0.1;
      const lift = Math.max(0, Math.min(ZIPLINE.lift, d.y - Math.sqrt(Math.max(0, reach * reach - d.x * d.x - d.z * d.z)))) * this.zipW;
      if (lift > 1e-4) {
        this.root.position.y += lift;
        this.root.updateMatrixWorld(true);
      }
    }
    // Standing or crouched still, the soldier's clips held its toes 16 degrees up from its bind pose, so it stood on its
    // heels (measured by apex-lobby for the card, Milestone 416; the owner asked it fixed): each foot is turned about its
    // own side to side until its toe is no higher than the bind pose has it, eased in as it stops and out as it moves, so
    // a walk's, a run's, a jump's and a kneeling foot's are the clips' own
    const still = (p.stance === "stand" || p.stance === "crouch") && p.speed < FLAT_FEET.under ? 1 : 0;
    this.flatW += (still - this.flatW) * Math.min(1, dt * FLAT_FEET.rate);
    // (and lifted onto them standing: the standing clip holds the legs lower than a walk's planted foot)
    this.liftW += ((still && p.stance === "stand" ? 1 : 0) - this.liftW) * Math.min(1, dt * FLAT_FEET.rate);
    if (this.flatW > 0.01) this.flattenFeet(this.flatW);
    const shown = !!this.gun && this.gun.visible;
    if (this.mount && this.grip && this.rifle && this.butt && this.support) {
      // (the hold goes on for a gun on its way back, not yet shown: the hands go to where it will be)
      const holding = shown || (this.gunComing && wantGun);
      // SpeedKills' soldier: the rifleman's hold (rifle.ts), the stance, the gun and both hands, on top of the clips
      // (a swap in place keeps the gun where it is: SWAP_CUP)
      const cup = this.cupSwap(p);
      // An overheated gun vents in a carry of its own (soldierhold.json vent) on the first person's beats (rifle.ts ventOf):
      // into it from wherever the gun was over `in` of the lockout, held, and back over `out`, the act's own start the
      // overheat's. Eased at the carry's own rate as the act held, it ran on a clock of its own, not the first person's.
      const V = p.act === "vent" && holding && !full && !rifleMelee ? ventOf(this.gunId) : null;
      const ventU = V ? (this.t - this.actAt) / lockoutSeconds(this.gunId) : 0;
      // (and a gun carried low unless aimed in, DEVINOS's tube, whose back half up on the shoulder hid the head from behind)
      const CL = carryLowOf(this.gunId);
      const carriedLow = !!CL && (p.ads ?? 0) < 0.3 && p.act !== "reload" && this.t - this.shotAt > CL.after;
      // (and through a punch, the right hand keeping the gun where it was: brought up to the shoulder for it and down
      // again, it swept the left wrist past 70 degrees)
      const low = holding && !full && (carriedLow || (!rifleMelee && ((p.act === "swap" && !cup) || (p.act === "vent" && !V) || upper === "Pistol_Idle_Loop"))) ? 1 : 0;
      if (V) this.lowered = (this.ventFrom + (1 - this.ventFrom) * smooth(V.in[0], V.in[1], ventU)) * (1 - smooth(V.out[0], V.out[1], ventU));
      else this.lowered += (low - this.lowered) * Math.min(1, dt * REACH.lower);
      // a melee's swing: where it is, and which of a string (a string held on the act goes on from one to the next)
      const swung = rifleMelee ? (this.t - this.actAt) / soldierHold.melee.time : -1;
      const melee = swung >= 0 ? { u: swung % 1, swing: this.meleeSwing + Math.floor(swung) } : null;
      this.carryW.swap += ((p.act === "swap" && !cup ? 1 : 0) - this.carryW.swap) * Math.min(1, dt * REACH.lower);
      // (the carry's shape the vent's as the gun goes into it, and kept until it is back)
      if (V) this.carryW.vent = Math.max(this.carryW.vent, smooth(V.in[0], V.in[1], ventU));
      else this.carryW.vent += ((p.act === "vent" ? 1 : 0) - this.carryW.vent) * Math.min(1, dt * REACH.lower);
      // how far into the swap, as the first person's shares of it run: the gun going away over its holster (the first
      // half, held at its middle until the next comes), the one coming over its draw from when it came (the second)
      const SW = swapOf(this.gunId);
      const second = this.gunAt >= this.actAt;
      const swapR = SW && p.act === "swap" ? (second ? Math.min(1, 0.5 + (0.5 * (this.t - this.gunAt)) / swapSeconds(this.gunId).deploy) : Math.min(0.5, (0.5 * (this.t - this.actAt)) / swapSeconds(this.gunId).holster)) : null;
      const K = SWAP_CUP;
      const cupState = cup && K && swapR !== null ? { w: smooth(K.off[0], K.off[1], swapR) * (1 - smooth(K.back[0], K.back[1], swapR)), second, carry: smooth(K.carry[0], K.carry[1], swapR) } : null;
      // (the air's own carry as fast as the jump's clip tucks the body, 0.18 s: at the carry's own pace the body was
      // tucked round a gun still in the sprint's carry, 39 mm into the belly, as the feet left the ground)
      this.carryW.air += ((sprintJump ? 1 : 0) - this.carryW.air) * Math.min(1, dt * AIR_CARRY);
      this.gripW += ((holding && !full ? 1 : 0) - this.gripW) * Math.min(1, dt * REACH.grip);
      // the left hand stays with the gun through a reload: it is the hand that does it (but not on a zip line: the rope)
      const support = holding && !full && this.t >= this.staggerUntil && !pulled && !zipping;
      this.ikW += ((support ? 1 : 0) - this.ikW) * Math.min(1, dt * REACH.support);
      if (this.gunComing && Math.min(this.gripW, zipping ? 1 : this.ikW) >= GUN_BACK) this.gunComing = false;
      // a reload's progress, on the gun's own reload time (an enemy's figure is told only that it reloads)
      // (a tactical one, where the first person has its own, laid on the empty one's beats in seconds: rifle.ts tacticalOf)
      const empty = p.reloadEmpty ?? false;
      const tactical = !empty && !!tacticalOf(this.gunId);
      const reloadU = shown && !full && p.act === "reload" ? Math.min(1, (this.t - this.actAt) / reloadSeconds(this.gunId, empty)) : null;
      const reload = reloadU !== null && tactical ? (reloadU * reloadSeconds(this.gunId, false)) / reloadSeconds(this.gunId, true) : reloadU;
      this.rifleOut = holdRifle(this.root, this.bones, this.rifle, { id: this.gunId, gun: this.gun!, mount: this.mount, grip: this.grip, support: this.supportHold(), butt: this.butt, parts: this.reloadParts ?? undefined, sight: this.sight ?? undefined, mid: this.gunMid }, {
        pitch: (Math.max(-70, Math.min(70, p.pitch)) * DEG * (aimed ? 1 : 0)),
        ads: aimed ? (p.ads ?? 0) : 0,
        lowered: this.lowered,
        carry: this.carryW,
        wR: this.gripW,
        wL: this.ikW,
        stance: this.gripW,
        reload,
        reloadTactical: tactical,
        sinceShot: this.t - this.shotAt,
        rechamber: rechamberSeconds(this.gunId),
        lastReload: this.lastReload,
        // a seat's kick, as the first person's slap of the magazine home (soldierhold.json reload.seatKick)
        kick: Math.max(fx.kick, this.seatKick * soldierHold.reload.seatKick),
        melee,
        mem: this.rifleMem,
        cup: cupState,
        ropeL: this.zipW,
      });
      this.lastReload = reload;
      if (this.rifleOut.seated) this.seatKick = 1;
      this.seatKick = Math.max(0, this.seatKick - dt / soldierHold.reload.seatKickFor);
      // a swap's phase: the gun going away out over the first half, the new one in over the second; whole once it is over
      const swapPh = SW && swapR !== null ? (second ? smooth(SW.in[0], SW.in[1], swapR) : 1 - smooth(SW.out[0], SW.out[1], swapR)) : 1;
      const G = this.gunSweep;
      G.phase.value = swapPh;
      G.time.value = this.t;
      // in place, as the first person's (phase.ts radial): out from the gun's edges in, and the next from its middle out
      G.radial.value = cup ? 1 : 0;
      if (swapPh < 1 && this.gun) {
        this.gun.updateWorldMatrix(true, false);
        G.origin.value.copy(this.gunNear).applyMatrix4(this.gun.matrixWorld);
        G.dir.value.copy(this.gunFar).applyMatrix4(this.gun.matrixWorld).sub(G.origin.value);
        G.len.value = Math.max(1e-4, G.dir.value.length());
        G.dir.value.normalize();
        G.center.value.copy(this.gunMid).applyMatrix4(this.gun.matrixWorld);
        G.radius.value = this.gunRadius * this.gun.getWorldScale(new THREE.Vector3()).x;
      }
      // the magazine's phase: along it from its top, as far as the reload has it (1 whole); in a swap the gun's, with it
      const mag = this.reloadParts?.mag;
      const S = this.magSweep;
      S.phase.value = Math.min(this.rifleOut.magPhase ?? 1, swapPh);
      S.time.value = this.t;
      if (swapPh < 1) {
        S.origin.value.copy(G.origin.value);
        S.dir.value.copy(G.dir.value);
        S.len.value = G.len.value;
        S.radial.value = G.radial.value;
        S.center.value.copy(G.center.value);
        S.radius.value = G.radius.value;
      } else if (mag && S.phase.value < 1) {
        mag.updateMatrixWorld(true);
        // out from the top down its length; in the way gunfeel.json phase.magIn says, as the first person's ("up": from its
        // end up), the same key the guns agent's view reads
        const up = (this.rifleOut.magIn ?? false) && (feelCfg.phase as { magIn?: string }).magIn === "up";
        S.origin.value.copy(up ? this.magEnd : this.magTop).applyMatrix4(mag.matrixWorld);
        S.dir.value.copy(up ? this.magTop : this.magEnd).applyMatrix4(mag.matrixWorld).sub(S.origin.value);
        S.len.value = Math.max(1e-4, S.dir.value.length());
        S.dir.value.normalize();
        // round its own middle, as the first person's (fparms.json reload.magPhase "radial"; the owner, 2026-10-01: "make the
        // magazine phase in from the middle out and then we take the mag out it should be from the outside in")
        S.radial.value = MAG_RADIAL ? 1 : 0;
        S.center.value.copy(this.magMid).applyMatrix4(mag.matrixWorld);
        S.radius.value = this.magRadius * mag.getWorldScale(new THREE.Vector3()).x;
      }
    } else if (this.mount && this.grip) {
      // a long gun: lowered and canted across the body for a sprint or a swap, up at the shoulder otherwise
      const low = shown && !full && (p.act === "swap" || upper === "Pistol_Idle_Loop") ? 1 : 0;
      this.lowered += (low - this.lowered) * Math.min(1, dt * REACH.lower);
      this.mount.position.setFromMatrixPosition(this.mountBase);
      this.mount.quaternion.setFromRotationMatrix(this.mountBase);
      if (this.lowered > 1e-3) {
        this.mount.position.y -= CARRY.drop * this.lowered;
        this.mount.rotateX(CARRY.pitch * this.lowered);
        this.mount.rotateZ(CARRY.roll * this.lowered);
      }
      // the right hand always on the grip while it shows; the left on the handguard unless the hands are busy
      this.gripW += ((shown && !full ? 1 : 0) - this.gripW) * Math.min(1, dt * REACH.grip);
      this.reach("r", this.grip, this.gripW);
      const support = shown && !full && p.act !== "reload" && this.t >= this.staggerUntil && p.stance !== "zip";
      this.ikW += ((support ? 1 : 0) - this.ikW) * Math.min(1, dt * REACH.support);
      this.reachSupport(this.ikW);
    } else {
      // a pistol: the aim clip's two-hand grip, the left hand onto the frame's support point
      const holding = aimed && upper === "Pistol_Aim_Neutral" && shown && p.stance !== "zip";
      this.ikW += ((holding ? 1 : 0) - this.ikW) * Math.min(1, dt * 10);
      this.reachSupport(this.ikW);
    }
    this.reachArm(b);
    // in the skydive a long gun rides on the back, as Apex's legends carry theirs (holsterMount); a pistol is put away. And
    // the same for an emote, an interact or a throw, which take the hands, until the hands are back on it (Milestone 617):
    // it vanished and came back, so an enemy dancing or looting showed no gun at all
    // (from the moment something takes the hands until the gun is in them again: a gun not yet shown as a figure is made
    // is not put away, and the back measured in that first frame's pose put the gun off to the right side, for good)
    if (armedIn && !armed) this.slung = true;
    else if (!armedIn || this.gun?.visible) this.slung = false;
    const away = !!this.gun && armedIn && this.slung;
    if ((this.skyW > 0.5 || away) && this.gun && this.mount && this.gunShown && !this.dead && !pistolStance(this.gunId)) {
      const at = this.holsterMount(this.skyW <= 0.5);
      if (at) {
        at.decompose(this.mount.position, this.mount.quaternion, this.mount.scale);
        this.gun.visible = true;
        this.gunInHand = false;
      }
    }
  }

  /**
   * Where the long gun rides on the back for the skydive (Milestone 612), an emote, an interact and a throw (617): it was
   * put away for the fall and vanished, and Apex's legends fall with theirs slung on the back. Diagonal across it, the muzzle up over the left shoulder
   * `holster.tilt` degrees off upright, its side flat to the back `holster.gap` m off the soldier's skin there. The skin
   * is measured, not guessed: every vertex of the soldier as it is posed (its pack and armour with it) within
   * `holster.band` m of the spine across, between the lower chest and the neck, the one furthest back. Kept, in the
   * chest bone's frame (the mount's own), for each kit and gun. Standing (`stand`), as figure.json sling has it: at the
   * skydive's the gun's lower end hung at the right hip, where a standing figure's right arm went through it.
   */
  private holsterMount(stand: boolean): THREE.Matrix4 | null {
    const b = this.bones;
    const gun = this.gun;
    if (!gun || !this.mount || !b.spine_02 || !b.spine_03 || !b.neck_01) return null;
    const key = `${soldierCode(this.soldier)}|${this.gunId}|${stand ? "stand" : "sky"}`;
    const kept = HOLSTERS.get(key);
    if (kept) return kept;
    const H = stand ? { ...SKYDIVE.holster, ...SLING } : SKYDIVE.holster;
    // Standing, measured on the soldier in its bind pose, upright and untwisted, and the bones put back after. It is kept
    // in the chest's frame: measured as the figure stood, the rifleman's stance still turning the chest toward the gun
    // (or a climb bending it), the gun swung off to the right side of the back once the chest came back
    let skel: THREE.Skeleton | null = null;
    if (stand)
      this.root.traverse((o) => {
        if (!skel && (o as THREE.SkinnedMesh).isSkinnedMesh) skel = (o as THREE.SkinnedMesh).skeleton;
      });
    const S = skel as THREE.Skeleton | null;
    const saved = S ? S.bones.map((x) => [x.position.clone(), x.quaternion.clone(), x.scale.clone()] as const) : null;
    S?.pose();
    try {
      const held = this.measureHolster(H);
      if (held) HOLSTERS.set(key, held);
      return held;
    } finally {
      if (S && saved) {
        S.bones.forEach((x, i) => {
          x.position.copy(saved[i][0]);
          x.quaternion.copy(saved[i][1]);
          x.scale.copy(saved[i][2]);
        });
        this.root.updateMatrixWorld(true);
      }
    }
  }

  /** holsterMount's place, measured on the figure as it is posed now (the chest bone's frame), or null */
  private measureHolster(H: { tilt: number; gap: number; band: number; height: number }): THREE.Matrix4 | null {
    const b = this.bones;
    const gun = this.gun;
    if (!gun || !b.spine_02 || !b.spine_03 || !b.neck_01) return null;
    this.root.updateMatrixWorld(true);
    const toRoot = this.root.matrixWorld.clone().invert();
    const inRoot = (o: THREE.Object3D) => o.getWorldPosition(new THREE.Vector3()).applyMatrix4(toRoot);
    const lo = inRoot(b.spine_02).y;
    const hi = inRoot(b.neck_01).y;
    // the back: the furthest-back skin over the chest (the figure faces +z, +x its left)
    let back = Infinity;
    const v = new THREE.Vector3();
    this.root.traverse((o) => {
      const m = o as THREE.SkinnedMesh;
      if (!m.isSkinnedMesh || !m.visible) return;
      const pos = m.geometry.getAttribute("position");
      for (let i = 0; i < pos.count; i++) {
        m.getVertexPosition(i, v);
        v.applyMatrix4(m.matrixWorld).applyMatrix4(toRoot);
        if (v.y >= lo && v.y <= hi && Math.abs(v.x) <= H.band && v.z < back) back = v.z;
      }
    });
    if (!Number.isFinite(back)) return null;
    // the gun's own box, in its own frame: its middle, and how thick it is across (its x, laid flat to the back)
    gun.updateMatrixWorld(true);
    const ginv = gun.matrixWorld.clone().invert();
    const box = new THREE.Box3();
    gun.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh || !mesh.visible || o.name === "muzzle") return;
      if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
      box.union(mesh.geometry.boundingBox!.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(ginv, mesh.matrixWorld)));
    });
    if (box.isEmpty()) return null;
    const mid = box.getCenter(new THREE.Vector3());
    const scale = gun.getWorldScale(new THREE.Vector3()).x / this.root.getWorldScale(new THREE.Vector3()).x;
    // its barrel (its -z) up over the left shoulder, its side flat to the back (its +x to the body), its top toward the
    // right shoulder and so its grip and magazine toward the left hip: turned the other way, they stood up at the right
    // shoulder, and the dive's right arm went 13 to 24 mm into a short gun's
    const a = H.tilt * DEG;
    const zAxis = new THREE.Vector3(-Math.sin(a), -Math.cos(a), 0);
    const xAxis = new THREE.Vector3(0, 0, 1);
    const yAxis = new THREE.Vector3().crossVectors(zAxis, xAxis);
    const q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(xAxis, yAxis, zAxis));
    const centre = new THREE.Vector3(0, lo + (hi - lo) * H.height, back - H.gap - ((box.max.x - box.min.x) / 2) * scale);
    const at = centre.sub(mid.clone().multiplyScalar(scale).applyQuaternion(q));
    const gunInRoot = new THREE.Matrix4().compose(at, q, new THREE.Vector3(scale, scale, scale));
    // the mount, which holds the gun as it does in the hand, in the chest bone's frame
    const mountInRoot = gunInRoot.multiply(gun.matrix.clone().invert());
    const chestInRoot = toRoot.clone().multiply(b.spine_03.matrixWorld);
    return chestInRoot.invert().multiply(mountInRoot);
  }

  dispose(): void {
    this.mixer.stopAllAction();
    this.mixer.uncacheRoot(this.root);
    this.root.removeFromParent();
    for (const m of this.mats) m.dispose();
    // each clone has its own skeleton (and its bone texture on the GPU), or shares one (disposing a disposed one is nothing)
    this.root.traverse((o) => {
      const m = o as THREE.SkinnedMesh;
      if (m.isSkinnedMesh) m.skeleton.dispose();
    });
  }
}

// ------------------------------------------------------------ first-person arms

/**
 * The bones a first-person arm is made of: the forearm, the hand and the
 * fingers, and the end of the upper arm nearest the elbow (FP_UPPER). The
 * rest of the upper arm is left off. Run back to a shoulder by the eye it was
 * a wall of deltoid across the middle of the screen; run on down the drawn
 * forearm's line it swept up both edges of the frame past the eye; and cut
 * right at the elbow, the cut showed.
 */
const ARM_PART = /^(lowerarm|hand|thumb|index|middle|ring|pinky)_/;
/** how much of the upper arm a first-person arm keeps: all of it for the soldier (speedkills.json viewmodel upperArm) */
export const FP_UPPER: number = (PROFILE.viewmodel as { upperArm?: number } | undefined)?.upperArm ?? vmCfg.realArms.upper;

/**
 * A copy of `g` keeping only the triangles an arm owns: every corner
 * weighted at least half to the arm's own bones. What is left is the arm and
 * the hand, cut off at the shoulder, well out of the frame.
 */
function armOnly(g: THREE.BufferGeometry, skeleton: THREE.Skeleton, forearm = 0): THREE.BufferGeometry {
  const si = g.attributes.skinIndex as THREE.BufferAttribute | undefined;
  const sw = g.attributes.skinWeight as THREE.BufferAttribute | undefined;
  if (!si || !sw) return g;
  const bones = skeleton.bones.map((b) => b.name);
  const arm = bones.map((b) => ARM_PART.test(b));
  const upper = bones.map((b) => /^upperarm_/.test(b));
  // each side's elbow and upper-arm length at rest, in the mesh's own space
  const rest = (name: string): THREE.Vector3 | null => {
    const i = bones.indexOf(name);
    return i < 0 ? null : new THREE.Vector3().setFromMatrixPosition(skeleton.boneInverses[i].clone().invert());
  };
  const sides = (["l", "r"] as const).map((s) => {
    const e = rest(`lowerarm_${s}`);
    const sh = rest(`upperarm_${s}`);
    return e && sh ? { elbow: e, reach: e.distanceTo(sh) * FP_UPPER } : null;
  });
  const n = g.attributes.position.count;
  const on = new Uint8Array(n);
  const p = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    const w = (arm[si.getX(i)] ? sw.getX(i) : 0) + (arm[si.getY(i)] ? sw.getY(i) : 0) + (arm[si.getZ(i)] ? sw.getZ(i) : 0) + (arm[si.getW(i)] ? sw.getW(i) : 0);
    const u = (upper[si.getX(i)] ? sw.getX(i) : 0) + (upper[si.getY(i)] ? sw.getY(i) : 0) + (upper[si.getZ(i)] ? sw.getZ(i) : 0) + (upper[si.getW(i)] ? sw.getW(i) : 0);
    let near = false;
    if (u >= 0.5) {
      p.fromBufferAttribute(g.attributes.position as THREE.BufferAttribute, i);
      near = sides.some((sd) => !!sd && p.distanceTo(sd.elbow) < sd.reach);
    }
    on[i] = w >= 0.5 || near ? 1 : 0;
  }
  const src = g.index ? (g.index.array as ArrayLike<number>) : Array.from({ length: n }, (_, i) => i);
  const keep: number[] = [];
  for (let t = 0; t + 2 < src.length; t += 3) if (on[src[t]] && on[src[t + 1]] && on[src[t + 2]]) keep.push(src[t], src[t + 1], src[t + 2]);
  const out = g.clone();
  out.setIndex(keep);
  if (forearm > 0) {
    armWeightsOnly(out, on, arm.map((a, i) => a || upper[i]));
    slimForearms(out, skeleton, forearm);
  }
  return out;
}

/**
 * The kept points' weight all on the arm's own bones: a point near the shoulder is partly the collarbone's and the
 * spine's, which the first-person rig never poses (fparms.ts poses the upper arm, the forearm and the hand), and drawn
 * whole the upper arm's shoulder end stretched back to them across the screen. What was theirs goes to the arm bone
 * the point is most on.
 */
function armWeightsOnly(g: THREE.BufferGeometry, on: Uint8Array, arm: boolean[]): void {
  const si = g.attributes.skinIndex as THREE.BufferAttribute;
  const sw = g.attributes.skinWeight as THREE.BufferAttribute;
  for (let i = 0; i < on.length; i++) {
    if (!on[i]) continue;
    let best = -1;
    let off = 0;
    for (let k = 0; k < 4; k++) {
      const w = sw.getComponent(i, k);
      if (arm[si.getComponent(i, k)]) {
        if (best < 0 || w > sw.getComponent(i, best)) best = k;
      } else off += w;
    }
    if (best < 0 || off <= 0) continue;
    for (let k = 0; k < 4; k++) if (!arm[si.getComponent(i, k)]) sw.setComponent(i, k, 0);
    sw.setComponent(i, best, sw.getComponent(i, best) + off);
  }
  sw.needsUpdate = true;
}

/**
 * The forearms drawn thinner, their length kept: every point skinned to a forearm drawn in toward the bone, by as much
 * of its weight as the forearm has, so the forearm's median thickness is `radius` (viewmodel.json realArms
 * forearmRadius), measured off this mesh's own points as it loads. SpeedKills' soldier (soldierArmRig): at its armoured
 * thickness the two forearms walled the gun in the sights (the owner, 2026-09-27: "the hands are huge ... covering the
 * weapons"); shrunk whole, a forearm was too short to take the arm out of the frame from a handguard.
 */
function slimForearms(g: THREE.BufferGeometry, skeleton: THREE.Skeleton, radius: number): void {
  const si = g.attributes.skinIndex as THREE.BufferAttribute;
  const sw = g.attributes.skinWeight as THREE.BufferAttribute;
  const pos = g.attributes.position as THREE.BufferAttribute;
  const names = skeleton.bones.map((b) => b.name);
  const rest = (name: string): THREE.Vector3 | null => {
    const i = names.indexOf(name);
    return i < 0 ? null : new THREE.Vector3().setFromMatrixPosition(skeleton.boneInverses[i].clone().invert());
  };
  const p = new THREE.Vector3();
  const foot = new THREE.Vector3();
  for (const s of ["l", "r"] as const) {
    const bone = names.indexOf(`lowerarm_${s}`);
    const elbow = rest(`lowerarm_${s}`);
    const wrist = rest(`hand_${s}`);
    if (bone < 0 || !elbow || !wrist) continue;
    const axis = wrist.clone().sub(elbow);
    const len = axis.length();
    axis.normalize();
    const footOf = (v: THREE.Vector3) => foot.copy(elbow).addScaledVector(axis, Math.max(0, Math.min(len, v.clone().sub(elbow).dot(axis))));
    const weight = (i: number) => {
      let w = 0;
      for (let k = 0; k < 4; k++) if (si.getComponent(i, k) === bone) w += sw.getComponent(i, k);
      return w;
    };
    // its thickness now: the median distance from the bone of the points mostly on it
    const r: number[] = [];
    for (let i = 0; i < pos.count; i++) if (weight(i) >= 0.5) r.push(p.fromBufferAttribute(pos, i).distanceTo(footOf(p)));
    if (!r.length) continue;
    r.sort((a, b) => a - b);
    const slim = Math.min(1, radius / r[Math.floor(r.length / 2)]);
    for (let i = 0; i < pos.count; i++) {
      const w = weight(i);
      if (w <= 0) continue;
      p.fromBufferAttribute(pos, i);
      footOf(p);
      p.sub(foot).multiplyScalar(1 - (1 - slim) * w).add(foot);
      pos.setXYZ(i, p.x, p.y, p.z);
    }
  }
  pos.needsUpdate = true;
  g.computeVertexNormals();
}

const armBodies = new Map<string, THREE.BufferGeometry>();

/** the arms a first-person view is built from, and the clip pose their fingers take */
export interface ArmRig {
  root: THREE.Object3D;
  bones: Record<string, THREE.Bone>;
  /** every finger bone's turn in a hand closed round a grip, bone name to local rotation */
  grip: Map<string, THREE.Quaternion>;
  /** the same for a closed fist, for the empty hands while holstered */
  fist: Map<string, THREE.Quaternion>;
  /** the fist with the index finger out straight, for tapping a hack's card (hackcast.ts) */
  point: Map<string, THREE.Quaternion>;
  /** every finger straight, the body's own rest */
  open: Map<string, THREE.Quaternion>;
  /** the body, build and outfit it was built for, so a change of look rebuilds it */
  key: string;
}

/** the fingers as the body was made, straight, and a fist with only the index finger out */
function restFingers(rig: THREE.Object3D, fist: Map<string, THREE.Quaternion>): { point: Map<string, THREE.Quaternion>; open: Map<string, THREE.Quaternion> } {
  const open = new Map<string, THREE.Quaternion>();
  rig.traverse((o) => {
    if ((o as THREE.Bone).isBone && /^(thumb|index|middle|ring|pinky)_/.test(o.name)) open.set(o.name, o.quaternion.clone());
  });
  const point = new Map(fist);
  for (const [name, q] of open) if (/^index_/.test(name)) point.set(name, q);
  return { point, open };
}

/** a pose's finger turns, sampled off a clip at one moment */
function fingersFrom(rig: THREE.Object3D, clip: THREE.AnimationClip | undefined, at: number): Map<string, THREE.Quaternion> {
  const out = new Map<string, THREE.Quaternion>();
  if (!clip) return out;
  const mixer = new THREE.AnimationMixer(rig);
  const a = mixer.clipAction(clip);
  a.play();
  mixer.setTime(at);
  rig.traverse((o) => {
    if ((o as THREE.Bone).isBone && /^(thumb|index|middle|ring|pinky)_/.test(o.name)) out.set(o.name, o.quaternion.clone());
  });
  a.stop();
  mixer.uncacheRoot(rig);
  return out;
}

/** the player's own arms for the first-person view: the soldier's, or null until it is ready (the drawn arms till then) */
export function buildArmRig(skin: OperatorSkin): ArmRig | null {
  return soldierTemplate ? soldierArmRig(skin) : null;
}

/**
 * SpeedKills' soldier's own arms (soldier.ts), the same cut: its gloves and its suit's sleeves in the colours
 * picked, so the arms in the sights are the arms the others see. The old body's arms under an outfit's sleeves
 * would show a wardrobe the soldier does not wear (the picker hides it). The fingers take the soldier's own
 * copies of the clips (retarget.ts carries the fingers too).
 */
function soldierArmRig(skin: OperatorSkin): ArmRig | null {
  const look = soldierLookFor(skin);
  const src = soldierScene(look);
  if (!src || !soldierTemplate) return null;
  const root = cloneSkinned(src);
  const bones: Record<string, THREE.Bone> = {};
  root.traverse((o) => {
    if ((o as THREE.Bone).isBone) bones[o.name] = o as THREE.Bone;
  });
  const code = soldierCode(look);
  root.traverse((o) => {
    const m = o as THREE.SkinnedMesh;
    if (!m.isSkinnedMesh) return;
    const slot = m.userData.soldierMaterial as string | undefined;
    // keyed by the pieces shown, not the colours: the cut is the same whatever they are painted
    const key = `soldier|${look.variant}|${[...look.off].sort().join(",")}|${m.name}`;
    let g = armBodies.get(key);
    if (!g) {
      g = armOnly(m.geometry, m.skeleton, vmCfg.realArms.forearmRadius);
      armBodies.set(key, g);
    }
    // a piece with nothing on the arm (a helmet, a vest) is left out rather than drawn empty
    if (!g.index || g.index.count === 0) {
      m.visible = false;
      return;
    }
    m.geometry = g;
    if (slot) m.material = soldierMaterial(slot, look);
    m.frustumCulled = false;
    m.castShadow = false;
  });
  const t = soldierTemplate;
  const grip = fingersFrom(cloneSkinned(src), t.clips.get("full:Pistol_Aim_Neutral"), 0);
  const fist = fingersFrom(cloneSkinned(src), t.clips.get("full:Punch_Jab"), 0.3);
  return { root, bones, grip, fist, ...restFingers(cloneSkinned(src), fist), key: `soldier|${code}` };
}

/**
 * Where a scope's flare hangs: 12 cm ahead of the front of the gun's sight line (its frontmost drawn point within 3 cm
 * of `sightY` and 4 cm of its centre). At the lens itself the lens housing, depth-tested, hid it from every side; ahead,
 * a wall between still does
 */
function lensFront(gun: THREE.Object3D, sightY: number): THREE.Vector3 {
  gun.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(gun.matrixWorld).invert();
  const to = new THREE.Matrix4();
  const v = new THREE.Vector3();
  let front = Infinity;
  gun.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh || !mesh.visible) return;
    to.multiplyMatrices(inv, mesh.matrixWorld);
    const p = mesh.geometry.getAttribute("position");
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i).applyMatrix4(to);
      if (Math.abs(v.y - sightY) < 0.03 && Math.abs(v.x) < 0.04) front = Math.min(front, v.z);
    }
  });
  return new THREE.Vector3(0, sightY, Number.isFinite(front) ? front - 0.12 : -0.4);
}

/** what a rig built now for this look would be keyed, so the viewmodel knows when to rebuild */
export function armRigKey(skin: OperatorSkin): string {
  return soldierTemplate ? `soldier|${soldierCode(soldierLookFor(skin))}` : "none";
}
