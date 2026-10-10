/**
 * The first-person arms from KINEMATION's FPS Animation Ultimate (docs/PLAN_FIRST_PERSON_ARMS.md, src/config/fparms.json),
 * holding our guns. The pack's arms play its clips for the pack gun that stands in for ours (the USSO's is the
 * Striker-V, BOOG's the L96X), and our gun is fitted into the hands where the pack's was: turned ahead, trigger on its
 * trigger, tilted about it until its underside meets the left palm (measured, tools/checks/fparms-pack.ts).
 *
 * As KINEMATION's own player does, the camera is fixed in the rig (its FPSPlayer prefab's) and the clip moves the gun
 * and both hands; our view (hip, aim, recoil, sway, sprint, swap) moves the gun, and the hands reach it from shoulders
 * that stay put. The clip's gun motion (a reload's tilt) reaches our gun through `gunDelta`, which the view puts between
 * the gun's holder and the gun. Our magazine and charging handle follow the pack gun's own (its A_W_ clips), and a
 * hand holding one of the pack gun's parts is moved onto ours.
 *
 * The files are paid: without them, or before they are in, `ready` is false and the view keeps its own arms.
 */
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import cfg from "../config/fparms.json";
import { later } from "./later";
import { HU, MOVE } from "./movement";

type Measured = { turn: number[]; forward: number[]; up: number[]; trigger: number[]; palm: number[]; clavicleL?: number[]; clavicleR?: number[] };
type Twist = { roll: number; yaw: number; pitch: number; x: number; y: number; z: number };
type PointAt = { face: number[]; at: number; aim: number[]; elbow?: number[]; reach?: number; aimAt?: number; clearWay?: number[]; clear?: number };
/** the rack done by our own timing with the pack's grip on its handle: shares of the rack for each part of it */
type Grab = { reach: number[]; pull: number[]; release: number[]; back: number[]; clear: number; curl: number; thumbOpen: number; hook: number[]; roll?: number; along?: number[]; palm?: number[]; pinch?: boolean; close?: { index: number; thumb: number } };
const FINGER_L = /^(index|middle|ring|pinky|thumb)_0[123]_l$/;
/**
 * a hand's hold on one of our guns, fitted (tools/pack-fit.ts, pack-solve.ts, pack-thumb.ts): moved `shift` view metres
 * along our gun's axes and turned `rot` radians about its wrist, each finger `open` of the way to straight, a finger's
 * base joint turned `turn` radians about its own axes (a thumb swings across the grip, which no curl of it moves it off),
 * and any one joint turned `joint` radians about its own axes (the fit a joint at a time: a whole finger's curl left
 * one knuckle in the grip whichever way it went)
 */
type HandFit = { shift: number[]; open: Record<string, number>; turn?: Record<string, number[]>; joint?: Record<string, number[]>; rot?: number[]; copy?: Record<string, string>; pick?: HandFit };
/** one hand's fit `k` of the way to another: each number of each setting in between (a setting one lacks counts as none) */
function mixFit(a: HandFit, b: HandFit, k: number): HandFit {
  const mix3 = (x?: number[], y?: number[]) => [0, 1, 2].map((i) => (x?.[i] ?? 0) * (1 - k) + (y?.[i] ?? 0) * k);
  const each = <V>(x: Record<string, V> | undefined, y: Record<string, V> | undefined, f: (p?: V, q?: V) => V) =>
    Object.fromEntries([...new Set([...Object.keys(x ?? {}), ...Object.keys(y ?? {})])].map((n) => [n, f(x?.[n], y?.[n])]));
  return {
    shift: mix3(a.shift, b.shift),
    rot: mix3(a.rot, b.rot),
    open: each(a.open, b.open, (p, q) => (p ?? 0) * (1 - k) + (q ?? 0) * k),
    turn: each(a.turn, b.turn, mix3),
    joint: each(a.joint, b.joint, mix3),
    copy: k < 0.5 ? a.copy : b.copy,
  };
}
/** a pack gun's shoulders moved on top of its own clavicle offsets, metres in the rig (Unity's axes): at rest, and aimed */
type Shoulders = { l?: number[]; r?: number[]; adsL?: number[]; adsR?: number[] };
export type HoldFit = { l?: HandFit; r?: HandFit };
/** a fist's thumb joints turned on top of the fist, radians about each joint's own axes, per hand (tools/fist-thumb.ts) */
export type ThumbFit = { l?: Record<string, number[]>; r?: Record<string, number[]> };
type PackGun = { model: string; arms: Record<string, string>; gun: Record<string, string>; offset?: number[]; hold?: HoldFit; rack?: { clip: string; window: number[]; pose?: Twist; poseIn?: number[]; gunKeep?: number; grab?: Grab; shift?: { l?: number[]; r?: number[] } }; twist?: Twist; point?: PointAt; shoulders?: Shoulders; palmElbow?: number[]; holdElbow?: { l?: number[]; r?: number[] }; look?: { shift: number[]; turn: number[] }; inspectLook?: { shift: number[]; turn: number[] }; tacticalRack?: boolean; meleeClearWay?: number[]; meleeClear?: number; cupMove?: { l?: number[]; r?: number[] }; cup?: { turn?: number; curl?: number; shape?: { l?: number[]; r?: number[] }; moveAt?: { l?: number[]; r?: number[] } }; beforeArm?: { elbow?: number[]; shoulder?: number[] }; meleeShoulder?: number[]; reload?: ShellReload; pumpScale?: number; vent?: Vent; leftOnHand?: boolean };
/**
 * An overheat's vent (fparms.json packGuns vent, CHOOCH's): the gun tipped up and canted in both hands over `in` of the
 * lockout and back over `out`, by `roll`, `yaw` and `pitch` (radians) and `x`, `y`, `z` (view metres), the soldier's on the
 * same shares
 */
type Vent = Twist & { in: number[]; out: number[] };
/**
 * A reload a shell at a time (fparms.json packGuns reload, BIGANTLER's): shares of the empty reload's time, the left hand
 * off the pump over `leave`, `count` shells fed into the gate over `feed` (each pushed in over `push` of its own share),
 * back on the pump over `back`, and from empty the pump worked over `pump`. The shell rides at the hand's pinch `drop`
 * under the gate, the hand down by `dip` (our gun's frame) between shells, turned `turn` off the hold, and never nearer the
 * gate than `clear` (the thumb pushes the shell the last of its way), bowed out by `bow` on its way off the pump and back
 * (our gun's frame); the fingers as the
 * arms clip `shell` has them at `shellAt` of it
 */
type ShellReload = { style: string; count: number; leave: number[]; feed: number[]; push: number[]; back: number[]; pump: number[]; drop: number; clear: number; dip: number[]; bow: number[]; turn: number[]; shellAt: number };
const MEASURED = (cfg as unknown as { measured: Record<string, Measured> }).measured;
const PACK = cfg.packGuns as unknown as Record<string, PackGun>;
const GUNS = cfg.guns as Record<string, string>;
const DEG = Math.PI / 180;
/** the most our gun is tilted in the hands to meet the left palm (fparms.json tiltMost, degrees) */
const TILT_MOST = ((cfg as unknown as { tiltMost?: number }).tiltMost ?? 12) * DEG;
const UP = new THREE.Vector3(0, 1, 0);
/** how far back the right shoulder goes in the sights, metres (fparms.json adsShoulder) */
const ADS_SHOULDER = (cfg as unknown as { adsShoulder?: number }).adsShoulder ?? 0;
/** the pack's camera in its rig (fparms.json camera) */
const CAMERA = (cfg as unknown as { camera: number[] }).camera;
/** the pack gun's magazine and charging handle, by the names its models give them */
const MAG_NODE = "Mag";
// (last, the ASVal's: its handle is its Bolt, which its empty reload pulls; the MPS5 has a Bolt too, behind its ChargingHandle)
const HANDLE_NODES = ["ActiveCharging", "ChargingHandle", "Charger", "Bolt"];

/** a moving clip's own motion of the gun, read off the pack's .anim curves (tools/import-fparms.ts additive.json) */
interface AddTrack {
  t: number[];
  p: number[];
  q: number[];
}
interface AddClip {
  seconds: number;
  gun: AddTrack;
  cam: AddTrack;
}
/** a track at `time`, seconds, into `pos` and `quat` (keys every 1/30 s: straight between them) */
function sampleTrack(tr: AddTrack, time: number, pos: THREE.Vector3, quat: THREE.Quaternion): void {
  const n = tr.t.length;
  if (!n) {
    pos.set(0, 0, 0);
    quat.identity();
    return;
  }
  let lo = 0;
  let hi = n - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (tr.t[mid] <= time) lo = mid;
    else hi = mid;
  }
  const u = tr.t[hi] > tr.t[lo] ? THREE.MathUtils.clamp((time - tr.t[lo]) / (tr.t[hi] - tr.t[lo]), 0, 1) : 0;
  pos.set(tr.p[lo * 3], tr.p[lo * 3 + 1], tr.p[lo * 3 + 2]).lerp(new THREE.Vector3(tr.p[hi * 3], tr.p[hi * 3 + 1], tr.p[hi * 3 + 2]), u);
  quat.set(tr.q[lo * 4], tr.q[lo * 4 + 1], tr.q[lo * 4 + 2], tr.q[lo * 4 + 3]).slerp(new THREE.Quaternion(tr.q[hi * 4], tr.q[hi * 4 + 1], tr.q[hi * 4 + 2], tr.q[hi * 4 + 3]), u);
}
/** half a turn about y: the rig faces +z, our view -z */
const FLIP = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI);

/** the pack's sprint on the gun: seconds after a shot before it comes back, and its easing in and out (fparms.json sprint) */
export const LOCO = (cfg as unknown as { sprint: { fireHold: number; easeIn: number; easeOut: number; swing: number } }).sprint;

/** the reload with these arms: point at the magazine while it phases, then the rack (fparms.json reload) */
export const PACK_RELOAD = (cfg as unknown as { reload: { point: number[]; phaseOut: number[]; phaseIn: number[]; seat: number; rack: number[]; reach: number; aim: number[]; face: number[]; elbow: number[]; slide: number; slideIn: number; magPhase: string; tipBack: number[]; rackOut: number[]; tactical: { rack: boolean; back: number[] }; follow: number; lead: number; shift: number[]; aimAt: number; rackBlend: number; gap: number; bend: number; at: number; clear: number; twist: { roll: number; yaw: number; pitch: number; x: number; y: number; z: number } } }).reload;
/** the arms out of the picture on a swap (fparms.json swap) */
const SWAP = (cfg as unknown as { swap: { drop: number; back: number; pitch: number; clips: number; cross: number; dropFrom: number } }).swap;
/** the swap thrown: the gun pushed up and out, let go and caught (fparms.json swap style, throw) */
export const SWAP_THROW = (cfg as unknown as { swap: { style: string; throw: { to: number[]; turn: number[]; arc: number; lift: number[]; liftAt: number[]; fly: number[]; drop: number[]; clear: number; slide: number; relax: number; hands: { l: ThrowHand; r: ThrowHand } } } }).swap;
/** a hand letting a thrown gun go: backing off it `off` view metres (its frame) over `leave` of the swap, its fingertips
 * relaxing, and its fingers opening over `open` */
type ThrowHand = { leave: number[]; off: number[]; open: number[] };
/**
 * The swap in place, its style "cup" (fparms.json swap cup): each hand comes `move` view metres off the gun (in the gun's
 * frame) over `off` of the swap and turns on its forearm `turn` of the way to face the gun's middle, its fingers bent `curl`
 * of the way from open to a fist, as a Hadouken is held; over `carry` of it, once the next gun is in the view, they go
 * from where the last one left them onto the next's cup, and over `back` onto its holds
 */
export const SWAP_CUP = (cfg as unknown as { swap: { cup: { off: number[]; back: number[]; carry: number[]; move: { l: number[]; r: number[] }; moveAt: { l: number[]; r: number[] }; shape: { l: number[]; r: number[] }; turn: number; curl: number } } }).swap.cup;
/**
 * A melee in the bought arms' hands (fparms.json melee), shares of the swing: the left hand off the gun over `on` and
 * back onto it over `off`, from `chest` out to `out` over `punch` (view metres, x right, y up, z back), its elbow from
 * `chestElbow` to `outElbow`, its palm turning from `palmChest` to `palmOut`, a fist over `fist` of its way, round the gun
 * by `clear`: fparms.json _melee
 */
export const PACK_MELEE = (cfg as unknown as { melee: { on: number[]; off: number[]; punch: number[]; chest: number[]; chestElbow: number[]; out: number[]; outElbow: number[]; palmChest: number[]; palmOut: number[]; fist: number[]; clear: number; turn: number[] } }).melee;
/** the pack's pickup: its clip, how long it takes, and when in it the hand reaches the ground (fparms.json pickup) */
export const PICKUP = (cfg as unknown as { pickup: { clip: string; seconds: number; ease: number; gunKeep: number } }).pickup;
const ss = THREE.MathUtils.smoothstep;

/** the hands off a gun (fparms.json free): a fist's bend a joint, and the palm's way in the hand's own frame */
export const FREE = (cfg as unknown as { free: { fist: Record<string, number>; thumb?: ThumbFit; twistShare: number; palmSign: { l: number; r: number }; palm: { along: number[]; up: number[] }; pull: number[] } }).free;
/** an inspect in the bought arms' hands, its own length: the gun rolled about the right forearm (fparms.json inspectPack) */
export const PACK_INSPECT = (cfg as unknown as { inspectPack: { seconds: number; roll: number[]; lift: number; show: number[]; turn: number[]; settle: number[]; flourish: number } }).inspectPack;
/** where the open left hand is on an inspect, and how the hacks float, glow and are tossed away (fparms.json inspectPalm) */
export const PACK_PALM = (cfg as unknown as {
  inspectPalm: {
    at: number[];
    bob: number;
    rate: number;
    spin: number;
    hold: number[];
    lift: number;
    clear: number;
    pair: { gap: number; scale: number; dx: number };
    glow: { base: number; depth: number; rate: number };
    pips: Record<"mobility" | "utility", string>;
    toss: { at: number[]; flick: number; rise: number; spread: number; turn: number; fade: number[] };
  };
}).inspectPalm;
/** the open palm's knuckles and face on an inspect, in the view's space */
const PALM_ALONG = new THREE.Vector3().fromArray(FREE.palm.along);
const PALM_UP = new THREE.Vector3().fromArray(FREE.palm.up);
/** the bone name's joint as the fist's bends are keyed: "01", "02", "03", or "thumb01" and so on */
const jointKey = (n: string): string => (n.startsWith("thumb") ? "thumb" : "") + n.split("_")[1];
/** the barrel's pitch at rest with these arms, radians (fparms.json hipPitch) */
export const HIP_PITCH = (cfg as unknown as { hipPitch: number }).hipPitch;
/** how far the rest hold is moved, gun and arms as one, to where the gun's own hold has it (fparms.json hipOwn) */
const HIP_OWN = (cfg as unknown as { hipOwn: number }).hipOwn;
/** the look on top of the gun's own place: a move (view metres) and a turn (up, left, roll, radians) about its origin, the arms
 * with it (fparms.json hipLook) */
const HIP_LOOK = (cfg as unknown as { hipLook: { shift: number[]; turn: number[] } }).hipLook;
/** the moves made under the look before the refit that are framed with it (fparms.json beforeFrame): an inspect's and a first draw's shares */
export const BEFORE_FRAME = (cfg as unknown as { beforeFrame: { inspect: { in: number[]; out: number[] }; flourish: { in: number[]; out: number[] }; offArm: number } }).beforeFrame;

const url = (p: string): string => `${p}?v=${cfg.version}`;
const loader = new GLTFLoader();
/**
 * The pack's one pickup clip, loaded once for every gun's hands: each gun's set of clips asked for it again, so a
 * second gun in hand fetched and parsed it a second time (a hunt, 2026-10-01: GET at boot, GET again in the range)
 */
let pickupClip: Promise<THREE.AnimationClip | null> | null = null;
const loadPickup = (): Promise<THREE.AnimationClip | null> =>
  (pickupClip ??= loader
    .loadAsync(url(`${cfg.models}clips/${PICKUP.clip}.glb`))
    .then((g) => g.animations[0] ?? null)
    .catch(() => null));

/** the pack gun that stands in for one of ours, or null (the view's own arms hold it) */
export function packGunFor(id: string): string | null {
  const p = GUNS[id];
  return p && MEASURED[p] ? p : null;
}

/** our gun's underside (its frame's y) under a point along it, or null: a ray up from below, visible parts only */
function underside(gunRoot: THREE.Object3D, at: THREE.Vector3): number | null {
  gunRoot.updateWorldMatrix(true, true);
  const toLocal = new THREE.Matrix4().copy(gunRoot.matrixWorld).invert();
  const from = new THREE.Vector3(0, at.y - 0.5, at.z).applyMatrix4(gunRoot.matrixWorld);
  const dir = new THREE.Vector3(0, 1, 0).transformDirection(gunRoot.matrixWorld);
  const hits: THREE.Intersection[] = [];
  // (on every layer: the view draws its gun on one of its own, and a ray on the default layer found the gun only on its
  // first draw, before it was moved there; every draw after, the fit came out as no tilt and the left palm off the gun)
  const ray = new THREE.Raycaster(from, dir, 0, 1);
  ray.layers.enableAll();
  gunRoot.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    for (let p: THREE.Object3D | null = m; p && p !== gunRoot.parent; p = p.parent) if (!p.visible) return;
    ray.intersectObject(m, false, hits);
  });
  if (!hits.length) return null;
  hits.sort((a, b) => a.distance - b.distance);
  return hits[0].point.applyMatrix4(toLocal).y;
}

/** a pack gun clip: its parts' skeleton (the clip file keeps its nodes), and what was measured off it */
interface GunClip {
  root: THREE.Object3D;
  mixer: THREE.AnimationMixer;
  clip: THREE.AnimationClip;
  /** the magazine's and the handle's rest, in the gun's own frame, at the clip's first frame */
  magRest: THREE.Matrix4 | null;
  handleRest: THREE.Vector3 | null;
  handle: string | null;
  /** the most the handle moves in this clip, metres */
  handleTravel: number;
  /** shares of the clip: the magazine leaving the gun and home again (the phase out and in go there) */
  magOut: number | null;
  magHome: number | null;
  /** shares of the clip the handle moves over */
  handleFrom: number | null;
  handleTo: number | null;
}

interface GunSet {
  name: string;
  arms: Map<string, THREE.AnimationClip>;
  gun: Map<string, GunClip>;
}

/** what the view tells the arms about this frame */
export interface PackArmsFrame {
  dt: number;
  /** 0..1 through a reload, or null */
  reload: number | null;
  /** the reload began with the magazine empty */
  empty: boolean;
  /** seconds since the last shot, and the gun's rechamber (BOOG's bolt worked after each shot) */
  sinceShot: number;
  rechamber: number;
  /** 0..1 into the sights */
  ads: number;
  /** 0..1 how far out of the picture on a swap or holster (the gun's phase gone) */
  away: number;
  /** how much of the clip's own motion of the gun is taken off in the sights, 0..1 (a reload aimed: speedkills.json reloadAds) */
  adsDamp: number;
  /** 0..1 through taking something off the ground, or null */
  pickup: number | null;
  /** the left hand off the gun and open, palm up, `w` of the way, its wrist at `at` (world): an inspect's hack */
  palm: { w: number; at: THREE.Vector3; turn?: THREE.Quaternion } | null;
  /** the gun's pitch taken off at rest (radians, down about the view's x through `levelAt`, the gun's origin in the
   * view): the arms turn with it, so the hold is the pack's own */
  level: number;
  levelAt: THREE.Vector3;
  /** the pack's swap swinging the gun this frame, in the view's space: the arms swing with it */
  swing: THREE.Matrix4;
  /** 0..1 how far an inspect has the gun rolled in the right hand, which the right forearm takes (spreadTwist) */
  rollR: number;
  /** 0..1 the hands off a thrown gun, dropped out of the picture as far as a swap's `away` drops them */
  release: number;
  /** 0..1 each hand's fingers open, letting a thrown gun go or before catching one */
  open: { l: number; r: number };
  /** 0..1 how far each hand has backed off a thrown gun as it lets it go (fparms.json swap throw hands) */
  leave: { l: number; r: number };
  /**
   * A swap in place (fparms.json swap cup): both hands `w` of the way to their cup round the gun's middle `mid` (world);
   * `half` 0 while the outgoing gun is in the view, 1 once the incoming one is, and `carry` how far, in that second half,
   * the hands have come from where the first left them. Null outside a swap
   */
  cup: { w: number; mid: THREE.Vector3; half: number; carry: number } | null;
  /**
   * A melee in the bought arms' hands (fparms.json melee): the left hand `w` of the way off the gun to `at` (world), its
   * elbow at `elbow` (world) and its palm facing `palm` (the view's own space), made a fist; the right keeps the gun.
   * Null outside one
   */
  punch: { w: number; at: THREE.Vector3; elbow: THREE.Vector3; palm: THREE.Vector3 } | null;
  /** 0..1 how far the gun is framed as it was before the refit while a move made there plays (viewmodel beforeW): the
   * left elbow and shoulder go with it to those they had there (packGuns beforeArm) */
  before?: number;
}

/** a hand off any gun: its wrist at `at` (world), its knuckles along `along` and its palm facing `palm` (both in the
 * view's own space), curled `fist` of the way to a fist */
export interface FreeHand {
  at: THREE.Vector3;
  along: THREE.Vector3;
  palm: THREE.Vector3;
  fist: number;
}

const loc = (m: THREE.Matrix4): THREE.Vector3 => new THREE.Vector3().setFromMatrixPosition(m);

export class PackArms {
  /** hung in the view's own group, so it shares its camera and scale */
  readonly group = Object.assign(new THREE.Group(), { name: "pack-arms" });
  /** the clip's own motion of the gun, in our gun's frame: the view puts it between the holder and the gun */
  readonly gunDelta = new THREE.Group();
  ready = false;
  /** the pack gun in the hands now, once its clips are in */
  active: string | null = null;
  /** the shares of a reload over which the gun turns into its rack pose, the pack gun's own (packGuns rack poseIn), else none */
  get rackPoseIn(): number[] | null {
    return (this.active && PACK[this.active]?.rack?.poseIn) || null;
  }
  /** whether a reload with a round chambered still racks (fparms.json reload tactical, packGuns tacticalRack) */
  get tacticalRacks(): boolean {
    return PACK_RELOAD.tactical.rack || !!(this.active && PACK[this.active]?.tacticalRack);
  }
  /** how the gun turns while the hand points at its magazine: the pack gun's own, else the reload's (fparms.json) */
  get twist(): Twist {
    return this.debugTwist ?? ((this.active && PACK[this.active]?.twist) || PACK_RELOAD.twist);
  }
  /** how the gun is turned while it vents an overheat (fparms.json packGuns vent), none if it never does */
  get vent(): Vent | null {
    return (this.active && PACK[this.active]?.vent) || null;
  }
  /** a reload's turn tried in place of the pack gun's own (searched by the picture it makes) */
  debugTwist: Twist | null = null;
  /** how the gun is held out while the hands work it after the phase (fparms.json packGuns rack pose), none if not set */
  get rackPose(): Twist | null {
    return (this.active && PACK[this.active]?.rack?.pose) || null;
  }
  /**
   * the swap's cup for the gun held: the shared one (fparms.json swap cup), a pack gun's own `cup` over it. ANAKIN's
   * left hand wraps under its gun with the thumb along its side, and the shared roll and bend swung that thumb 6 to 7
   * mm into it at a swap's start and end whatever way the hand moved off
   */
  private cupFor(): typeof SWAP_CUP {
    const own = this.active ? PACK[this.active]?.cup : undefined;
    if (!own) return SWAP_CUP;
    return { ...SWAP_CUP, ...own, shape: { ...SWAP_CUP.shape, ...own.shape }, moveAt: { ...SWAP_CUP.moveAt, ...own.moveAt } } as typeof SWAP_CUP;
  }
  /** where on the magazine the finger points, and which way: the pack gun's own, else the reload's */
  get pointAt(): PointAt {
    // (the reload's own for whatever the gun's does not set: a gun's with only its elbow and reach had no face to point at)
    const R = PACK_RELOAD;
    return { face: R.face, at: R.at, aim: R.aim, ...((this.active && PACK[this.active]?.point) || {}), ...(this.debugPoint ?? {}) };
  }
  /** a point's elbow and reach tried in place of the pack gun's own (tools/pack-fit.ts wrists) */
  debugPoint: Partial<PointAt> | null = null;
  /**
   * Where the pack holds the gun at the hip, as our view places a gun (its position in the view's group, and its turn):
   * the pack's hold is made for its own camera, so our gun goes where its gun was and the arms keep the shape the pack
   * gave them. Hung the other way (the arms stretched to our own hip pose) the sleeves filled a third of the view.
   */
  readonly hip = { position: new THREE.Vector3(), euler: new THREE.Euler() };
  /** how far our gun is tilted in the hands to meet the left palm, radians (the checks) */
  tilt = 0;
  /** the clip leading this frame ("pose", "reloadTac", "reloadEmpty", "fire") */
  lead = "pose";
  /**
   * What the checks read of the last frame: how far the clip turned the gun, degrees; how far back our handle is, 0..1;
   * the left hand's middle knuckle's distance to our handle and to our magazine, metres
   */
  readonly seen = { gunTurn: 0, handleBack: 0, leftToHandle: Infinity, leftToMag: Infinity, pointMiss: Infinity, pointOff: 180, reachShort: 0, reachShortR: 0, handsBelow: 0, gripU: -1, gripMiss: -1, swapMove: 0, jumpPart: "", hookMiss: Infinity, offHold: 0, palmAhead: 0, rackCurl: 0, tipSlid: 0, magSlid: 0, cupOff: 0, cupFace: 180 };
  /** where a swap's first half left each hand, in the view's own space: the second half's hands come from there */
  private readonly cupHeld: { l: { at: THREE.Vector3; q: THREE.Quaternion } | null; r: { at: THREE.Vector3; q: THREE.Quaternion } | null } = { l: null, r: null };
  /** where the pointing fingertip is meant to be this frame (world), for the checks */
  private readonly tipTarget = new THREE.Vector3();

  private arms: THREE.Object3D | null = null;
  /** the moving clips' motion of the gun, and where through them the stride is */
  private additive: Record<string, AddClip> | null = null;
  private stride = 0;
  private airAmt = 0;
  private airT = 0;
  /** seconds since landing (the jump's end plays over them), and the air's motion as it landed, to blend from */
  private landT = Infinity;
  private readonly landFromP = new THREE.Vector3();
  private readonly landFromQ = new THREE.Quaternion();
  private mixer: THREE.AnimationMixer | null = null;
  private bones: Record<string, THREE.Object3D> = {};
  private sets = new Map<string, GunSet>();
  private loading = new Map<string, Promise<GunSet | null>>();
  private actions = new Map<string, THREE.AnimationAction>();
  /** the arms and the gun moved as one in the view, metres (fparms.json packGuns offset) */
  private readonly offset = new THREE.Vector3();
  /** our gun's frame in the gun bone's, and back */
  private readonly ourInBone = new THREE.Matrix4();
  private readonly boneInOur = new THREE.Matrix4();
  /** the pack gun's own frame into ours (its parts' moves are carried by it) */
  private readonly packToOur = new THREE.Matrix4();
  private readonly ourToPack = new THREE.Matrix4();
  /** the gun bone at the pose's first frame, in the rig's space */
  private readonly boneRefInv = new THREE.Matrix4();
  /** the left hand at the hold, in our frame, and the move that keeps its height against our gun's underside */
  private readonly restHand = new THREE.Vector3();
  /**
   * The rack's grip (a pack gun's rack `grab`): the pack's left hand where its clip has it nearest its own handle, in our
   * gun's frame, that handle there, and the hand's fingers then; null for a gun whose rack is its clip
   */
  /** a hold tried in place of the pack gun's own (tools/pack-fit.ts) */
  debugHold: HoldFit | null = null;
  /** a thrown swap's settings tried over the config's (tools/throw-release.ts) */
  debugThrow: Partial<typeof SWAP_THROW.throw> | null = null;
  /** a thrown swap's settings: the config's, or those being tried */
  get throwCfg(): typeof SWAP_THROW.throw {
    return this.debugThrow ? { ...SWAP_THROW.throw, ...this.debugThrow } : SWAP_THROW.throw;
  }
  /** the share of the way to the gun's own rest place tried in place of the config's (0 the pack's hold, 1 the gun's) */
  debugHipOwn: number | null = null;
  /** the share of the way the rest hold is moved to the gun's own rest place: the config's, or the one being tried */
  get hipOwn(): number {
    return this.debugHipOwn ?? HIP_OWN;
  }
  /** the look on top of the gun's own place tried in place of the config's: x, y, z view metres, then up, left and roll */
  debugHipLook: number[] | null = null;
  /** the look on top of the gun's own place: the config's, or the one being tried */
  /** the look an inspect is framed with (fparms.json packGuns inspectLook), else the rest look */
  get inspectLook(): { shift: number[]; turn: number[] } {
    return PACK[this.active!]?.inspectLook ?? this.hipLook;
  }
  get hipLook(): { shift: number[]; turn: number[] } {
    const d = this.debugHipLook;
    return d ? { shift: d.slice(0, 3), turn: d.slice(3, 6) } : (PACK[this.active!]?.look ?? HIP_LOOK);
  }
  /** where the open hand is held on an inspect, tried in place of the config's (tools/palm-place.ts) */
  debugPalmAt: number[] | null = null;
  /** the open hand's knuckles' way on an inspect, tried in place of the config's (tools/palm-place.ts) */
  debugPalmAlong: number[] | null = null;
  /** the open hand's elbow moved off its line on an inspect, view metres, tried in place of the pack gun's */
  debugPalmElbow: number[] | null = null;
  /** the pointing finger's lead on the magazine and how far it goes, tried in place of the config's (reload) */
  debugPointMove: { lead?: number; follow?: number } | null = null;
  /** a fist's thumb tried in place of the config's (tools/fist-thumb.ts) */
  debugThumb: ThumbFit | null = null;
  /** a grab's closing tried in place of the pack gun's own (its curl, thumb and hook) */
  debugGrab: Partial<Grab> | null = null;
  /** a rack shift tried in place of the pack gun's own */
  debugRackShift: { l?: number[]; r?: number[] } | null = null;
  /** our gun in the world, last frame (the fitter's directions) */
  private readonly gunWorldLast = new THREE.Matrix4();
  private grip: { hand: THREE.Matrix4; handle: THREE.Vector3; fingers: Map<THREE.Object3D, THREE.Quaternion>; u: number; miss: number } | null = null;
  private readonly palmShift = new THREE.Vector3();
  /** every bone's place at bind, put back before another gun's clips (a clip leaves the bones it tracks where it put them) */
  private readonly bind = new Map<THREE.Object3D, [THREE.Vector3, THREE.Quaternion, THREE.Vector3]>();
  /** our magazine at rest in our frame, its parent's frame in ours, our handle's grip, and its travel */
  private magRestO: THREE.Matrix4 | null = null;
  private magParentInv: THREE.Matrix4 | null = null;
  private handleO: THREE.Vector3 | null = null;
  /** our magazine's bounds in our frame */
  /** the right hand at the hold, against the gun bone, and its fingers then (a pickup keeps them: the pickup clip's grip is
   * another gun's) */
  private readonly poseHandR = new THREE.Matrix4();
  private readonly poseFingersR = new Map<THREE.Object3D, THREE.Quaternion>();
  /** the left hand at the hold and its fingers, which a pickup's left hand eases into as it comes back to the gun */
  private readonly poseHandL = new THREE.Matrix4();
  private readonly poseFingersL = new Map<THREE.Object3D, THREE.Quaternion>();
  /** how near a pickup's left hand is to its place on the gun, 0 to 1 */
  private pickNearL = 0;
  /** a pickup is playing: its right hand is the hold's, whole */
  private pickWhole = false;
  /** where each elbow is held at rest, tried in place of the pack gun's own (view metres from the hand: x right, y up, z back) */
  debugHoldElbow: { l?: number[]; r?: number[] } | null = null;
  /** the moving clips' motion held still (the checks: the idle's breath moved the gun 1 to 4 cm over a swap's measure,
   * and failed a check of where the gun is held by whatever moment of it the measure fell on) */
  debugStill = false;
  /** a shot's rechamber held at this share of it, 0..1 (the checks and tools: BIGANTLER's pump mid-stroke), or null */
  debugShot: number | null = null;
  /** shoulders tried in place of the pack gun's own (tools/pack-fit.ts wrists) */
  debugShoulders: Shoulders | null = null;
  /** how much the left hand held the gun last frame, 0..1: the left shoulder's hold fit fades with it */
  private holdLW = 1;
  /** how far the gun was framed as before the refit last frame, 0..1 (PackArmsFrame before) */
  private beforeArmW = 0;
  /** how far into a punch this frame, 0..1: the left shoulder goes to the gun's melee one by as much */
  private punchW = 0;
  /** our shell's rest in our gun's frame (BIGANTLER's Bullet), our pump's rest along it, and the left fingers holding a shell */
  private roundRestO: THREE.Vector3 | null = null;
  /** where the shell being fed is this frame, our gun's frame */
  private readonly feedSpotO = new THREE.Vector3();
  private pumpRestZ = 0;
  private readonly shellFingersL = new Map<THREE.Object3D, THREE.Quaternion>();
  /** a shell reload this frame, for the view: how far the hand holds the shell and how open the gate is, and where the shell is
   * in our gun's frame (null: at rest) */
  readonly feed = { w: 0, gate: 0, shellO: null as THREE.Vector3 | null, held: false };
  /** each finger joint as a fist has it (from the pack's grip, bent further along the same axis), once its clips are in */
  private readonly fistQ = new Map<THREE.Object3D, THREE.Quaternion>();
  /** the handle's knob this frame, where the grab's fingers close on it (the checks) */
  private readonly hookTarget = new THREE.Vector3();
  /** where the pointing finger points this frame (the checks: the angle off it) */
  private readonly pointAtW = new THREE.Vector3();
  private readonly magBoxO = new THREE.Box3(new THREE.Vector3(-0.015, -0.05, -0.02), new THREE.Vector3(0.015, 0, 0.02));
  private boltRestZ = 0;
  private boltTravel = 0;

  /** the arms and their materials; false if the paid files are not here */
  async load(): Promise<boolean> {
    try {
      const g = await loader.loadAsync(url(`${cfg.models}arms.glb`));
      const tl = new THREE.TextureLoader();
      const tex = (name: string, srgb: boolean): THREE.Texture => {
        const t = tl.load(url(`${cfg.textures}${name}.webp`));
        t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
        t.flipY = false;
        return t;
      };
      // The normal maps after the page's first screen (later.ts): 4.7 MB of the 6 MB the arms fetched, the glove's and the
      // sleeve's 2 MB each. A flat one meanwhile, so the material's shader is the one it keeps (a map put in later, where
      // there was none, built another).
      const flat = new THREE.DataTexture(new Uint8Array([128, 128, 255, 255]), 1, 1);
      flat.needsUpdate = true;
      const mat = (part: string): THREE.MeshStandardMaterial => {
        const orm = tex(`${part}_orm`, false);
        const m = new THREE.MeshStandardMaterial({ map: tex(`${part}_color`, true), normalMap: flat, roughnessMap: orm, metalnessMap: orm, aoMap: orm });
        later(
          () =>
            new Promise<void>((done) => {
              // (put on once its picture is in: before, it samples as black, a wrong normal)
              const n = tl.load(
                url(`${cfg.textures}${part}_normal.webp`),
                () => {
                  m.normalMap = n;
                  done();
                },
                undefined,
                () => done(),
              );
              n.colorSpace = THREE.NoColorSpace;
              n.flipY = false;
            }),
        );
        return m;
      };
      const byName: Record<string, THREE.MeshStandardMaterial> = { Glove: mat("Glove01"), Cloth: mat("Cloth01"), Hand: mat("Arm01") };
      g.scene.traverse((o) => {
        const m = o as THREE.SkinnedMesh;
        if (m.isMesh) {
          const slot = (m.material as THREE.Material).name;
          m.material = byName[Object.keys(byName).find((k) => slot.includes(k)) ?? "Hand"];
          m.frustumCulled = false;
          m.castShadow = false;
          m.receiveShadow = false;
        }
        if (o.name) this.bones[o.name] = o;
        this.bind.set(o, [o.position.clone(), o.quaternion.clone(), o.scale.clone()]);
      });
      this.arms = g.scene;
      this.group.add(g.scene);
      this.group.visible = false;
      this.mixer = new THREE.AnimationMixer(g.scene);
      this.additive = await fetch(url(`${cfg.models}additive.json`))
        .then((r) => (r.ok ? (r.json() as Promise<Record<string, AddClip>>) : null))
        .catch(() => null);
      this.ready = true;
      // (the first pack gun's clips at once: the fists are made from its grip, and a match can start with no gun)
      void this.gunSet(Object.values(cfg.guns as Record<string, string>)[0]);
      return true;
    } catch {
      return false;
    }
  }

  /** a pack gun's clips, loaded once, and its gun clips measured: where its parts rest, and when they move */
  private gunSet(name: string): Promise<GunSet | null> {
    const had = this.loading.get(name);
    if (had) return had;
    const p = (async (): Promise<GunSet | null> => {
      const pg = PACK[name];
      if (!pg) return null;
      const set: GunSet = { name, arms: new Map(), gun: new Map() };
      await Promise.all([
        ...Object.entries(pg.arms).map(async ([k, clip]) => {
          const g = await loader.loadAsync(url(`${cfg.models}clips/${clip}.glb`));
          if (g.animations[0]) set.arms.set(k, g.animations[0]);
        }),
        // (every gun's hands take things off the ground the same: the pack's one pickup, the same clip in every set)
        loadPickup().then((c) => {
          if (c) set.arms.set("pickup", c);
        }),
        ...Object.entries(pg.gun).map(async ([k, clip]) => {
          // a gun's pose can be a still with no clip file (the L96X's)
          const g = await loader.loadAsync(url(`${cfg.models}clips/${clip}.glb`)).catch(() => null);
          if (g?.animations[0]) set.gun.set(k, measureGunClip(g.scene, g.animations[0]));
        }),
      ]);
      // the hold given every bone any of the gun's clips moves, as the body was made where it has none of its own: three.js
      // blends a bone toward the value it saved of it wherever the clips' weights fall short of one, and kept that value
      // from frame to frame. The L96X's hold has no track for the left ring finger's middle joint, and once that value
      // was NaN it stayed so while BOOG was held, the finger drawn from nowhere (2026-10-01, every frame of BOOG)
      const pose = set.arms.get("pose");
      if (pose) {
        const have = new Set(pose.tracks.map((t) => t.name));
        for (const clip of set.arms.values()) {
          for (const t of clip.tracks) {
            if (have.has(t.name)) continue;
            const { nodeName, propertyName } = THREE.PropertyBinding.parseTrackName(t.name);
            const b = this.bones[nodeName];
            const made = b && this.bind.get(b);
            if (!made) continue;
            have.add(t.name);
            if (propertyName === "quaternion") pose.tracks.push(new THREE.QuaternionKeyframeTrack(t.name, [0], made[1].toArray()));
            else if (propertyName === "position") pose.tracks.push(new THREE.VectorKeyframeTrack(t.name, [0], made[0].toArray()));
            else if (propertyName === "scale") pose.tracks.push(new THREE.VectorKeyframeTrack(t.name, [0], made[2].toArray()));
          }
        }
      }
      this.sets.set(name, set);
      // (the fists come from the first grip the arms get: the right hand's round a pistol grip is nearly one)
      if (pose && this.fistQ.size === 0) this.makeFists(pose);
      return set;
    })().catch(() => null);
    this.loading.set(name, p);
    return p;
  }

  /**
   * Our gun `id` into the pack's hands: its clips (loaded the first time), and our gun measured into the pack gun's
   * place. `gunRoot` is our gun at rest; `trigger` and `boltGrip` are in its frame; `mag` and `bolt` are its moving
   * parts. Measured before the clips load: by then the gun may be spinning in on a swap.
   */
  async useGun(id: string, gunRoot: THREE.Object3D, trigger: THREE.Vector3, mag: THREE.Object3D | null, bolt: THREE.Object3D | null, boltTravel: number, boltGrip: THREE.Vector3 | null, round: THREE.Vector3 | null = null, pumpRestZ = 0): Promise<boolean> {
    this.release();
    const name = packGunFor(id);
    if (!this.ready || !name || !this.mixer || !this.arms) return false;
    const me = MEASURED[name];
    // our gun in the gun bone's frame: the pack gun's quarter turns, ours turned ahead (it looks down -z, the pack's
    // down its own `forward`), our trigger on its trigger
    // (the pack's guns are mostly made looking down +z; the KXG12 looks down -z as ours do, and turned half round as the
    // others are, BIGANTLER was held back to front, its pump against the chest)
    const turn = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(me.turn[0] * DEG, me.turn[1] * DEG, me.turn[2] * DEG));
    const about = new THREE.Matrix4().makeRotationY(me.forward[2] < 0 ? 0 : Math.PI);
    const ourTrigger = trigger.clone().applyMatrix4(about);
    const place = new THREE.Matrix4().makeTranslation(me.trigger[0] - ourTrigger.x, me.trigger[1] - ourTrigger.y, me.trigger[2] - ourTrigger.z).multiply(about);
    // Both hands where the pack's clip has them, and our gun fitted into them: tilted about the trigger until its
    // underside under the left palm is where the pack gun's was, 22 mm under the palm. Moving the hand onto our gun
    // instead bent the arm: to our old support point, BOOG's 40 cm out, it ran out of reach and the hand hung in the
    // air; down onto BOOG's deeper underside, the elbow came up into the view
    // (not a pistol's, fparms.json packGuns leftOnHand: its left hand wraps the right round the grip, its palm 11 cm under
    // the trigger by the grip's foot, and fitted to it the wingman's grip was turned 12 degrees into the right palm and the
    // left hand pushed into the grip's side)
    const onHand = !!PACK[name]?.leftOnHand;
    const palm = new THREE.Vector3().fromArray(me.palm).applyMatrix4(new THREE.Matrix4().copy(place).invert());
    const under = onHand ? null : underside(gunRoot, palm);
    const along = Math.abs(palm.z - trigger.z);
    const tilt = under === null || along < 0.05 ? 0 : THREE.MathUtils.clamp(Math.atan2(palm.y - (under + 0.022), along), -TILT_MOST, TILT_MOST);
    const pivot = new THREE.Matrix4().makeTranslation(trigger.x, trigger.y, trigger.z).multiply(new THREE.Matrix4().makeRotationX(tilt)).multiply(new THREE.Matrix4().makeTranslation(-trigger.x, -trigger.y, -trigger.z));
    const ourInBone = new THREE.Matrix4().copy(turn).multiply(place).multiply(pivot);
    const boneInOur = new THREE.Matrix4().copy(ourInBone).invert();
    // what the tilt, at most TILT_MOST, left between the pack's underside and ours under the palm: the hand is moved by it
    const palmO = new THREE.Vector3().fromArray(me.palm).applyMatrix4(boneInOur.clone().multiply(turn));
    const underT = onHand ? null : underside(gunRoot, palmO);
    const residual = underT === null ? 0 : underT + 0.022 - palmO.y;
    // our moving parts at rest, in our frame
    gunRoot.updateWorldMatrix(true, true);
    const rootInv = new THREE.Matrix4().copy(gunRoot.matrixWorld).invert();
    const magRestO = mag ? new THREE.Matrix4().multiplyMatrices(rootInv, mag.matrixWorld) : null;
    const magParentInv = mag?.parent ? new THREE.Matrix4().multiplyMatrices(rootInv, mag.parent.matrixWorld).invert() : null;
    const boltRestZ = bolt ? bolt.position.z : 0;
    // its magazine's middle and width, where the left hand points
    const magBox = new THREE.Box3();
    mag?.traverse((o) => {
      const mm = o as THREE.Mesh;
      if (!mm.isMesh) return;
      mm.geometry.computeBoundingBox();
      magBox.union(mm.geometry.boundingBox!.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(rootInv, mm.matrixWorld)));
    });

    const set = await this.gunSet(name);
    if (!set || !set.arms.get("pose") || packGunFor(id) !== name) return false;
    this.ourInBone.copy(ourInBone);
    this.boneInOur.copy(boneInOur);
    this.packToOur.copy(boneInOur).multiply(turn);
    this.ourToPack.copy(this.packToOur).invert();
    if (onHand) this.palmShift.set(0, 0, 0);
    else this.palmShift.set(-palmO.x, residual, 0);
    this.tilt = tilt;
    this.magRestO = magRestO;
    this.magParentInv = magParentInv;
    this.handleO = boltGrip ? boltGrip.clone() : null;
    this.boltRestZ = boltRestZ;
    this.boltTravel = boltTravel;
    this.roundRestO = round ? round.clone() : null;
    this.pumpRestZ = pumpRestZ;
    if (!magBox.isEmpty()) this.magBoxO.copy(magBox);
    // every clip as an action the view drives by time; the pose's first frame is the reference
    this.mixer.stopAllAction();
    for (const [o, [p, q, sc]] of this.bind) {
      o.position.copy(p);
      o.quaternion.copy(q);
      o.scale.copy(sc);
    }
    this.actions.clear();
    for (const [k, clip] of set.arms) {
      const a = this.mixer.clipAction(clip);
      a.play();
      a.paused = true;
      a.time = 0;
      a.weight = k === "pose" ? 1 : 0;
      this.actions.set(k, a);
    }
    this.mixer.update(0);
    this.arms.updateMatrixWorld(true);
    const rigInv = new THREE.Matrix4().copy(this.arms.matrixWorld).invert();
    const boneRef = new THREE.Matrix4().multiplyMatrices(rigInv, this.bones.ik_hand_gun.matrixWorld);
    this.boneRefInv.copy(boneRef).invert();
    this.poseHandR.copy(this.boneRefInv).multiply(new THREE.Matrix4().multiplyMatrices(rigInv, this.bones.ik_hand_r.matrixWorld));
    this.poseHandL.copy(this.boneRefInv).multiply(new THREE.Matrix4().multiplyMatrices(rigInv, this.bones.ik_hand_l.matrixWorld));
    this.poseFingersL.clear();
    for (const [n, b] of Object.entries(this.bones)) if (/^(index|middle|ring|pinky|thumb)_0[123]_l$/.test(n)) this.poseFingersL.set(b, b.quaternion.clone());
    this.poseFingersR.clear();
    for (const [n, b] of Object.entries(this.bones)) if (/^(index|middle|ring|pinky|thumb)_0[123]_r$/.test(n)) this.poseFingersR.set(b, b.quaternion.clone());
    this.shellFingersL.clear();
    const SR = PACK[name].reload;
    const shellA = this.actions.get("shell");
    if (SR && shellA) {
      const pose = this.actions.get("pose")!;
      pose.weight = 0;
      shellA.weight = 1;
      shellA.time = SR.shellAt * shellA.getClip().duration;
      this.mixer.update(0);
      for (const [n, b] of Object.entries(this.bones)) if (FINGER_L.test(n)) this.shellFingersL.set(b, b.quaternion.clone());
      shellA.weight = 0;
      shellA.time = 0;
      pose.weight = 1;
      this.mixer.update(0);
    }
    this.restHand.setFromMatrixPosition(new THREE.Matrix4().multiplyMatrices(this.boneRefInv, new THREE.Matrix4().multiplyMatrices(rigInv, this.bones.ik_hand_l.matrixWorld))).applyMatrix4(boneInOur);
    // the hip: our gun where the pack's was, seen from the pack's camera (the rig faces +z, ours -z: half a turn), the
    // arms and gun moved as one by the pack gun's `offset`
    this.offset.fromArray(PACK[name].offset ?? [0, 0, 0]);
    const rigToView = new THREE.Matrix4().compose(new THREE.Vector3(CAMERA[0], -CAMERA[1], CAMERA[2]).add(this.offset), new THREE.Quaternion().setFromAxisAngle(UP, Math.PI), new THREE.Vector3(1, 1, 1));
    const hq = new THREE.Quaternion();
    rigToView.multiply(boneRef).multiply(ourInBone).decompose(this.hip.position, hq, new THREE.Vector3());
    this.hip.euler.setFromQuaternion(hq, "XYZ");
    this.grip = this.measureGrip(name, set, boneInOur, turn);
    this.seen.gripU = this.grip?.u ?? -1;
    this.seen.gripMiss = this.grip?.miss ?? -1;
    this.active = name;
    return true;
  }

  /**
   * The moving clips' motion of the gun this frame, in our view's space, as KINEMATION's player adds it (its Additive
   * layer: idle, walk and sprint blended by the gait, the jump's loop in the air, at a third in the sights): our speed
   * `speed` (m/s) against SpeedKills' run and sprint (the gait's 1 and 2). The view adds it to the gun's pose; the
   * hands follow the gun.
   */
  locomotion(dt: number, speed: number, sprint: number, air: boolean, ads: number, pos: THREE.Vector3, quat: THREE.Quaternion): void {
    pos.set(0, 0, 0);
    quat.identity();
    if (this.debugStill) return;
    const A = this.additive;
    if (!A || !A.A_FP_Idle) return;
    const run = MOVE.speed * HU;
    // the walk by our speed, the sprint only by `sprint` (0..1, the view's: off while firing, aiming or reloading). By speed
    // alone the sprint's swing, 51 degrees across the body, stayed on while firing on the move, as SpeedKills always
    // sprints moving forward, and the shots left a gun pointed away from the crosshair
    const g = Math.min(1, speed / run) + (speed > run * 0.5 ? THREE.MathUtils.clamp(sprint, 0, 1) * LOCO.swing : 0);
    const w: Array<[AddClip | undefined, number]> = [
      [A.A_FP_Idle, Math.max(0, 1 - g)],
      [A.A_FP_Walk, g <= 1 ? g : 2 - g],
      [A.A_FP_Sprint, Math.max(0, g - 1)],
    ];
    // one stride through all of them together, as a blend tree keeps its children in step
    let seconds = 0;
    for (const [c, k] of w) if (c) seconds += c.seconds * k;
    this.stride = (this.stride + dt / Math.max(0.2, seconds)) % 1;
    const p = new THREE.Vector3();
    const q = new THREE.Quaternion();
    const acc = new THREE.Vector4();
    let first: THREE.Quaternion | null = null;
    for (const [c, k] of w) {
      if (!c || k <= 0) continue;
      sampleTrack(c.gun, this.stride * c.seconds, p, q);
      pos.addScaledVector(p, k);
      first ??= q.clone();
      const s = first.dot(q) < 0 ? -k : k;
      acc.x += q.x * s;
      acc.y += q.y * s;
      acc.z += q.z * s;
      acc.w += q.w * s;
    }
    quat.set(acc.x, acc.y, acc.z, acc.w).normalize();
    // the jump as the pack plays it: its start as you leave the ground, its loop in the air, its end as you land (the
    // start runs into the loop and the end out of it, so none of them is eased but the landing, from wherever the loop was)
    const start = A.A_FP_Jump_Start;
    const jump = A.A_FP_Jump_Loop;
    const end = A.A_FP_Jump_End;
    if (air) {
      this.airT += dt;
      this.landT = Infinity;
    } else if (this.airT > 0) {
      this.airT = 0;
      this.landT = 0;
    } else this.landT += dt;
    this.airAmt += ((air ? 1 : 0) - this.airAmt) * Math.min(1, dt / 0.12);
    // (which part is playing, for the checks)
    this.seen.jumpPart = air ? (start && this.airT < start.seconds ? "start" : "loop") : end && this.landT < end.seconds ? "end" : "";
    if (air && jump) {
      if (start && this.airT < start.seconds) sampleTrack(start.gun, this.airT, p, q);
      else sampleTrack(jump.gun, (this.airT - (start?.seconds ?? 0)) % jump.seconds, p, q);
      // (the start comes in whole: it begins where the hold is; eased only the first frames, off a slope)
      const k = start ? 1 : this.airAmt;
      pos.lerp(p, k);
      quat.slerp(q, k);
      this.landFromP.copy(pos);
      this.landFromQ.copy(quat);
    } else if (end && this.landT < end.seconds) {
      sampleTrack(end.gun, this.landT, p, q);
      const w = Math.min(1, this.landT / 0.06);
      pos.copy(this.landFromP).lerp(p, w);
      quat.copy(this.landFromQ).slerp(q, w);
    } else if (jump && this.airAmt > 0.001) {
      sampleTrack(jump.gun, 0, p, q);
      pos.lerp(p, this.airAmt);
      quat.slerp(q, this.airAmt);
    }
    // none of it in the sights: the pack keeps a third (FPSProceduralJob: Lerp(1, 0.3, adsWeight)), and ours aims on the
    // move, where a third of the walk and sprint took the sight off the crosshair
    const weight = 1 - ads;
    pos.multiplyScalar(weight);
    quat.slerp(new THREE.Quaternion(), 1 - weight);
    // into our view's space
    pos.applyQuaternion(FLIP);
    quat.premultiply(FLIP).multiply(new THREE.Quaternion().copy(FLIP).invert());
  }

  /**
   * The pack's own swap as its player plays it (its Rifle_Unequip and Rifle_Equip, the gun's motion on its additive
   * layer): the gun swung down and in to the chest by the hands as it phases out, the next brought up out of there as it
   * phases in. `raise` is the view's swap, 0 to 1, the guns changing at the middle (the view's swapPhase: its phase out
   * is over its first half, in over its second). In our view's space, `clips` of it (fparms.json swap).
   */
  swapMotion(raise: number, pos: THREE.Vector3, quat: THREE.Quaternion): void {
    pos.set(0, 0, 0);
    quat.identity();
    this.seen.swapMove = 0;
    const A = this.additive;
    const un = A?.A_FP_Rifle_Unequip;
    const eq = A?.A_FP_Rifle_Equip;
    if (!un || !eq || raise <= 0 || raise >= 1 || SWAP.clips <= 0) return;
    const p = new THREE.Vector3();
    const q = new THREE.Quaternion();
    sampleTrack(un.gun, Math.min(1, raise / 0.5) * un.seconds, pos, quat);
    sampleTrack(eq.gun, Math.max(0, (raise - 0.5) / 0.5) * eq.seconds, p, q);
    // (the one into the other over `cross` either side of the middle: unequip ends 10 cm off where equip starts)
    const w = ss(raise, 0.5 - SWAP.cross, 0.5 + SWAP.cross);
    pos.lerp(p, w);
    quat.slerp(q, w);
    pos.multiplyScalar(SWAP.clips);
    quat.slerp(new THREE.Quaternion(), 1 - SWAP.clips);
    this.seen.swapMove = pos.length();
    pos.applyQuaternion(FLIP);
    quat.premultiply(FLIP).multiply(new THREE.Quaternion().copy(FLIP).invert());
  }

  /** whether the pack's own swap carries the gun (its clips in, and fparms.json swap clips on) */
  get swapsByClip(): boolean {
    return SWAP.clips > 0 && !!this.additive?.A_FP_Rifle_Unequip && !!this.additive?.A_FP_Rifle_Equip;
  }

  /** the pack's arms off: another gun */
  release(): void {
    this.active = null;
    this.idle();
  }

  /** not drawn this frame (the fists, a zipline, a cast): hidden, and our gun back where the view put it */
  idle(): void {
    this.group.visible = false;
    this.gunDelta.position.set(0, 0, 0);
    this.gunDelta.quaternion.identity();
    this.gunDelta.scale.set(1, 1, 1);
  }

  /**
   * One frame: the clips to where the view's state says, the rig on the eye, our gun moved by the clip, our magazine and
   * handle moved with the pack gun's, both hands onto our gun where the view has put it.
   */
  update(f: PackArmsFrame, holder: THREE.Object3D, mag: THREE.Object3D | null, bolt: THREE.Object3D | null, pump: THREE.Object3D | null = null): void {
    const set = this.active ? this.sets.get(this.active) : null;
    if (!set || !this.mixer || !this.arms) return;
    this.group.visible = true;
    // which clip leads and how much: in a reload, the hold while the left hand points at the magazine and it phases,
    // then the pack's own hands working the gun (its `rack` clip, over the share of it where they do); after a shot the
    // bolt worked (BOOG); else the hold
    const RL = PACK_RELOAD;
    const rack = PACK[this.active!]?.rack;
    let lead = "pose";
    let u = 0;
    let leadW = 0;
    let pointW = 0;
    // how far down its own length the magazine is (0 home, 1 `slide` out): the old one drops out as it phases away, the
    // new one rises from there as it phases in; and where the pointing finger is along the same way, leading it
    let slid = 0;
    let tipSlid = 0;
    // the grab's weight, where the handle is (0 home, 1 back) and where the hand is along it (it lets go at the back)
    let grabW = 0;
    let pull = 0;
    let handBack = 0;
    const reloading = f.reload !== null;
    // a reload a shell at a time: the hand to the gate and back, the shell's way into it, the gate's opening
    const SR = PACK[this.active!]?.reload;
    let feedW = 0;
    this.feed.w = 0;
    this.feed.gate = 0;
    this.feed.shellO = null;
    this.feed.held = false;
    if (f.pickup !== null && this.actions.has("pickup") && !reloading) {
      // taking something off the ground: the pack's pickup, its left hand down and back, eased in and out
      lead = "pickup";
      u = f.pickup;
      leadW = ss(f.pickup, 0, PICKUP.ease) * (1 - ss(f.pickup, 1 - PICKUP.ease, 1));
    } else if (reloading && SR && this.roundRestO) {
      const r = f.reload!;
      feedW = ss(r, SR.leave[0], SR.leave[1]) * (1 - ss(r, SR.back[0], SR.back[1]));
      // which shell and how far through its own share: pushed in over `push`, the hand down for the next after (not
      // after the last: it stays at the gate until it goes back to the pump), and up again with it
      const k = THREE.MathUtils.clamp((r - SR.feed[0]) / (SR.feed[1] - SR.feed[0]), 0, 1) * SR.count;
      const n = Math.min(SR.count - 1, Math.floor(k));
      const phi = k - n;
      const last = n === SR.count - 1;
      const push = r < SR.feed[0] ? 0 : ss(phi, SR.push[0], SR.push[1]);
      const dip = phi < SR.push[0] ? 1 - ss(phi, 0, SR.push[0]) : last ? 0 : ss(phi, SR.push[1], 1);
      // (the shell pushed in stays in the gate while the hand goes down empty, and the next is in it from the bottom of its way)
      const empty = !last && phi > SR.push[1] && phi < SR.push[1] + 0.6 * (1 - SR.push[1]);
      // (and its drop back over the hand's way down for the next, so the next shell starts where this one's hand left off:
      // back at the full drop only at the next shell's start, the hand and the shell jumped 7 cm in a frame twice a reload,
      // the character agent's reading of it)
      const lower = !last && phi > SR.push[1] ? ss(phi, SR.push[1], 1) : 0;
      const spot = this.roundRestO.clone().add(new THREE.Vector3(0, -SR.drop * (1 - push + lower), 0)).addScaledVector(new THREE.Vector3().fromArray(SR.dip), dip);
      // (the hand's own spot stops `clear` under the gate: at the shell's, the fingers went 21 mm into the gun at the top)
      this.feedSpotO.copy(spot).setY(Math.min(spot.y, this.roundRestO.y - SR.clear));
      this.feed.w = feedW;
      // (once the hand is off the pump: from halfway there, the shell sat ahead of the hand on its way, 8 cm off it on the
      // soldier's)
      this.feed.shellO = empty || feedW < 0.98 ? null : spot;
      // (in the hand, not yet pushed on past it by the thumb)
      this.feed.held = !!this.feed.shellO && spot.y <= this.roundRestO.y - SR.clear;
      // (shut again once the hand is down off it: shut as the push ended, it closed on the fingers under it, 7 to 11 mm in)
      this.feed.gate = r < SR.feed[0] ? 0 : ss(phi, SR.push[0] - 0.1, SR.push[0]) * (1 - ss(phi, SR.push[1] + 0.1, SR.push[1] + 0.25)) * (1 - ss(r, SR.back[0], SR.back[1]));
      // and from empty the pump, its clip as after a shot
      if (f.empty && this.actions.has("fire") && r > SR.pump[0] && r < SR.pump[1]) {
        lead = "fire";
        u = (r - SR.pump[0]) / (SR.pump[1] - SR.pump[0]);
        leadW = Math.min(1, u / 0.06, (1 - u) / 0.06);
      }
    } else if (reloading) {
      const r = f.reload!;
      // (the new one comes up `slideIn` of the old one's way: none, it phases in seated, built from the well down its length,
      // the owner, 2026-09-30: "the mag phase in ... in the reverse order it currently is. Makes it visually pop a bit
      // more. So it goes from bottom to top now, should go from top to bottom now"; rising into the gun as it built, it read
      // as coming up from below)
      const mid = (RL.phaseOut[1] + RL.phaseIn[0]) / 2;
      const slidAt = (x: number) => (x < mid ? ss(x, RL.phaseOut[0], RL.phaseOut[1]) : (1 - ss(x, RL.phaseIn[0], RL.phaseIn[1])) * RL.slideIn);
      slid = slidAt(r);
      // the pointing finger `lead` of the reload ahead of the magazine, `follow` as far, so the magazine goes where the finger
      // sends it (the owner, 2026-09-29: "have the finger move up and down by a bit following where the mag goes, as if the
      // finger controls the mag going in": in step with it, the finger and magazine moved as one with the gun's turn and
      // nothing read as the finger's doing; carried 1.4 times as far, the finger went out of the bottom of the picture,
      // and aimed on along the magazine's way, the wrist bent 158 degrees)
      const P2 = { ...RL, ...(this.debugPointMove ?? {}) };
      // (and with the new one seated, the finger back to its spot over `tipBack`, ahead as ever, to point as the new one
      // builds down to it: over the gap between the two phases alone, it moved 64 mm in one frame of the sheets)
      const tipAt = (x: number) => (x < mid || RL.slideIn > 0 ? slidAt(x) : 1 - ss(x, RL.tipBack[0], RL.tipBack[1]));
      tipSlid = tipAt(r + P2.lead) * P2.follow;
      pointW = ss(r, RL.point[0], RL.point[1]) * (1 - ss(r, RL.rack[0] - 0.06, RL.rack[0] + 0.02));
      // a round still chambered: no rack and no bolt, the pointing hand back to the hold after the seat (fparms.json reload
      // tactical; `r` is already the empty reload's share, the view reads a tactical one onto its timeline)
      const racks = f.empty || RL.tactical.rack || !!PACK[this.active!]?.tacticalRack;
      if (!racks) pointW = ss(r, RL.point[0], RL.point[1]) * (1 - ss(r, RL.tactical.back[0], RL.tactical.back[1]));
      if (!racks) {
        // (nothing more: the hold's fit comes back as the point lets go)
      } else if (rack?.grab) {
        const into = THREE.MathUtils.clamp((r - RL.rack[0]) / (RL.rack[1] - RL.rack[0]), 0, 1);
        const G = rack.grab;
        grabW = ss(into, G.reach[0], G.reach[1]) * (1 - ss(into, G.back[0], G.back[1]));
        // (from the point straight to the handle, the point held until the grab has the hand: let go as the magazine
        // seated, the hand went back onto the gun between the two; the owner, 2026-09-28: "the hand goes back to the
        // grip in between pointing at the mag and hitting the charging handle")
        pointW = ss(r, RL.point[0], RL.point[1]) * (into < G.reach[1] ? 1 : 0);
        handBack = ss(into, G.pull[0], G.pull[1]);
        pull = handBack * (1 - ss(into, G.release[0], G.release[1]));
      } else if (rack && this.actions.has(rack.clip)) {
        lead = rack.clip;
        const into = THREE.MathUtils.clamp((r - RL.rack[0]) / (RL.rack[1] - RL.rack[0]), 0, 1);
        u = rack.window[0] + (rack.window[1] - rack.window[0]) * into;
        // (back to the hold over `rackOut` about the rack's end: over its last 5%, BOOG's right hand came 12 cm from the bolt
        // to the grip in one frame of the sheets, 0.15 s)
        leadW = ss(r, RL.rack[0] - 0.04, RL.rack[0] + 0.02) * (1 - ss(r, RL.rack[1] + RL.rackOut[0], RL.rack[1] + RL.rackOut[1]));
      }
    } else if (this.actions.has("fire") && ((f.sinceShot >= 0 && f.sinceShot < f.rechamber) || this.debugShot !== null)) {
      lead = "fire";
      u = this.debugShot ?? f.sinceShot / f.rechamber;
      leadW = Math.min(1, u / 0.04, (1 - u) / 0.04);
    }
    this.lead = leadW > 0.001 ? lead : "pose";
    // (the weights sum to one: three.js averages them, and the hold at a full 1 beside a clip had taken half of every
    // reload the pack's clips made)
    for (const [k, a] of this.actions) {
      if (k === "pose") {
        a.time = 0;
        a.weight = 1 - leadW;
        continue;
      }
      const on = k === lead;
      a.time = on ? u * a.getClip().duration : 0;
      a.weight = on ? leadW : 0;
    }
    // every bone back where the body was made, and the clips put on it afresh; and the mixer made to write every bone
    // again next frame. It writes a bone only when its value has changed since the frame before (three.js PropertyMixer
    // apply), and a hold is a still: from its second frame on, nothing put the bones back, and all this rig does to them
    // after the clips stacked up frame on frame. The shoulders' offset carried BOOG's right arm 100 m off in seconds; a
    // finger curled a tenth a frame wandered; and the arm's reach, bending the elbow the way it was, bent it the way the
    // last frame left it, so a hold depended on which guns had been drawn before it (the right thumb 6 mm into the
    // USSO's grip after one order, 16 after another)
    for (const [o, [p, q, sc]] of this.bind) {
      o.position.copy(p);
      o.quaternion.copy(q);
      o.scale.copy(sc);
    }
    this.mixer.update(0);
    for (const b of (this.mixer as unknown as { _bindings: Array<{ buffer: { fill(v: number, from: number, to: number): unknown }; valueSize: number }> })._bindings) b.buffer.fill(NaN, b.valueSize, 3 * b.valueSize);
    this.punchW = f.punch?.w ?? 0;
    this.moveShoulders(f.ads);
    // (the bolt worked is the right hand's: the left holds the gun as at rest, its fingers too; the pack's clip moved it
    // on its own gun's fore-end, and with BOOG's hand out ahead of the magazine that took the arm past its reach)
    if (this.lead === "fire") for (const [b, q] of this.poseFingersL) b.quaternion.copy(q);
    // the left index finger out, straight as the body was made, while it points
    if (pointW > 0.001) {
      for (const n of ["index_01_l", "index_02_l", "index_03_l"]) {
        const b = this.bones[n];
        const bind = b ? this.bind.get(b) : undefined;
        if (b && bind) b.quaternion.slerp(bind[1], pointW);
      }
    }

    // the grip relaxed as a thrown gun leaves the hands: the fingertips' last joints off it, the fingers still round it
    // (slid out of the closed hand, the USSO's grip came 5 mm through the fingertips; the middle joints relaxed too, the
    // fingers swung into the gun, and the whole fingers straightened, into the magazine in front of it)
    if (f.leave.l > 0.001 || f.leave.r > 0.001) {
      for (const [n, b] of Object.entries(this.bones)) {
        if (!/^(index|middle|ring|pinky)_03_[lr]$/.test(n)) continue;
        const bind = this.bind.get(b);
        if (bind) b.quaternion.slerp(bind[1], f.leave[n.endsWith("_l") ? "l" : "r"] * this.throwCfg.relax);
      }
    }
    // the hands open as they let a thrown gun go, and close again on the one they catch
    if (f.open.l > 0.001 || f.open.r > 0.001) {
      for (const [n, b] of Object.entries(this.bones)) {
        if (!/^(index|middle|ring|pinky|thumb)_0[123]_[lr]$/.test(n)) continue;
        const bind = this.bind.get(b);
        if (bind) b.quaternion.slerp(bind[1], f.open[n.endsWith("_l") ? "l" : "r"]);
      }
    }
    // the hold's fit on our gun: each finger opened as far as it has to be to stay out of it (our grips are thicker than the
    // pack's: the USSO's magazine runs up its grip, and the hand made for the MPS5's sank 15 mm into it), as far as the
    // hand is holding (a clip's own move of it, a point or a grab takes over)
    // (in a pickup, a hold's own `pick` fit for the left hand, blended back into the hold as the pickup lets go: the USSO's
    // left hand, moved and turned to lie flush on its side, was out of the arm's reach where the pickup's clip carries the
    // gun, and came back 10 mm into it; its fit from before, made where the clip carries it, is clean there)
    // (the left elbow and shoulder go to those the moves off the gun were made with, packGuns beforeArm, while the gun is
    // framed as it was before the refit and as the hand leaves the gun, wholly a `offArm` share of the way off: kept where
    // the new grip has them, BOOG's left wrist bent 97 degrees early in a punch and 84 at an inspect's end, against 21
    // and 42 before the refit. The grip itself stays the new one: mixed between the two, the USSO's fingers went 18 mm
    // into its front in a first draw)
    const BA = PACK[this.active!]?.beforeArm;
    const offNow = 1 - (1 - pointW) * (1 - grabW) * (1 - (f.palm?.w ?? 0)) * (1 - (f.punch?.w ?? 0));
    const bw = BA && !this.debugHold ? Math.min(1, Math.max(0, f.before ?? 0, BEFORE_FRAME.offArm * offNow)) : 0;
    this.beforeArmW = bw;
    const baseHold = this.debugHold ?? PACK[this.active!]?.hold;
    const hold = this.lead === "pickup" && baseHold?.l?.pick ? { ...baseHold, l: mixFit(baseHold.l, baseHold.l.pick, leadW) } : baseHold;
    const palmW = f.palm?.w ?? 0;
    // (in a pickup the right hand holds the gun all through, and the left takes its fit back as it comes back to its
    // place on the gun: without them, the pack's hands made for thinner grips went 13 mm into ours)
    let pickHold = { r: 0, l: 0 };
    if (this.lead === "pickup") {
      // (whole, not by the pickup's weight: part way in, the hand between the two grips went 11 mm into ours)
      for (const [b, q] of this.poseFingersR) b.quaternion.copy(q);
      this.arms.updateMatrixWorld(true);
      const rel = new THREE.Matrix4().copy(this.bones.ik_hand_gun.matrixWorld).invert().multiply(this.bones.ik_hand_l.matrixWorld);
      const handO = loc(rel).applyMatrix4(this.boneInOur);
      // (and the left eases into its own grip as it comes back: the pickup clip's was made on another gun, and came
      // back 7 to 12 mm into ours)
      // (whole by 6 cm off its place, begun at 20: begun at 10, the USSO's hand touched the gun half in its own grip)
      this.pickNearL = 1 - ss(handO.distanceTo(this.restHand), 0.06, 0.2);
      for (const [b, q] of this.poseFingersL) b.quaternion.slerp(q, this.pickNearL);
      pickHold = { r: leadW, l: leadW * this.pickNearL };
      this.pickWhole = true;
    } else this.pickWhole = false;
    // (the bolt worked after a shot or on a reload is the right hand's: the left keeps its fit on the gun through it. Let
    // go, it went back to where the pack's own gun is held, BOOG's magazine, after every shot)
    const leftClip = this.lead === "fire" ? 0 : leadW;
    const punchW = f.punch?.w ?? 0;
    const holdW = { r: 1 - leadW + pickHold.r, l: (1 - leftClip + pickHold.l) * (1 - pointW) * (1 - grabW) * (1 - palmW) * (1 - punchW) * (1 - feedW) };
    this.holdLW = Math.min(1, Math.max(0, holdW.l));
    for (const side of ["l", "r"] as const) {
      const fit = hold?.[side];
      if (!fit || holdW[side] <= 0.001) continue;
      for (const [finger, open] of Object.entries(fit.open ?? {})) {
        for (const k of ["01", "02", "03"]) {
          const b = this.bones[`${finger}_${k}_${side}`];
          const bind = b ? this.bind.get(b) : undefined;
          if (b && bind) b.quaternion.slerp(bind[1], open * holdW[side]);
        }
      }
      for (const [finger, t] of Object.entries(fit.turn ?? {})) {
        const b = this.bones[`${finger}_01_${side}`];
        if (b) b.quaternion.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(t[0] * holdW[side], t[1] * holdW[side], t[2] * holdW[side])));
      }
      // and each joint of a finger turned as the fit found it (tools/pack-fit.ts joints): the finger laid on our grip's
      // surface joint by joint, where a whole finger's curl or turn left a thumb pressed 9 mm into the grip
      // a finger bent as its neighbour is, joint by joint, from each one's own rest (`copy`): the pack's sniper grip has
      // BOOG's middle finger out straight in front of the grip, a turn past what a search round the pack's pose reaches
      for (const [to, from] of Object.entries(fit.copy ?? {})) {
        for (const k of ["01", "02", "03"]) {
          const b = this.bones[`${to}_${k}_${side}`];
          const s = this.bones[`${from}_${k}_${side}`];
          const bb = b && this.bind.get(b);
          const sb = s && this.bind.get(s);
          if (b && s && bb && sb) b.quaternion.slerp(bb[1].clone().multiply(sb[1].clone().invert()).multiply(s.quaternion), holdW[side]);
        }
      }
      for (const [joint, t] of Object.entries(fit.joint ?? {})) {
        const b = this.bones[`${joint}_${side}`];
        if (b) b.quaternion.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(t[0] * holdW[side], t[1] * holdW[side], t[2] * holdW[side])));
      }
    }
    // the left hand open for an inspect's hack: its fingers as the body was made, flat
    if (palmW > 0.001) {
      for (const [n, b] of Object.entries(this.bones)) {
        if (!FINGER_L.test(n)) continue;
        const bind = this.bind.get(b);
        if (bind) b.quaternion.slerp(bind[1], palmW);
      }
    }
    // the left hand's fingers holding a shell, as the pack's empty pump has them, while it feeds the gate
    if (feedW > 0.001) for (const [b, q] of this.shellFingersL) b.quaternion.slerp(q, feedW);
    // the left hand's fingers as the pack's are on its handle, while it grabs
    if (grabW > 0.001 && this.grip) {
      for (const [b, q] of this.grip.fingers) b.quaternion.slerp(q, grabW);
      // and closed on ours, a small knob where the pack's is a long lever: curled `curl` past the pack's, the thumb
      // opened `thumbOpen` off the gun (the owner: "we get close to it, but our fingers don't grip it")
      const G = { ...rack!.grab!, ...(this.debugGrab ?? {}) };
      for (const [n, b] of Object.entries(this.bones)) {
        if (!FINGER_L.test(n)) continue;
        const bind = this.bind.get(b);
        // (a pinch: the three last fingers curled into the palm out of the way, the thumb and forefinger on the knob)
        const fist = this.fistQ.get(b);
        if (G.pinch && fist && /^(middle|ring|pinky)/.test(n)) b.quaternion.slerp(fist, grabW);
        else if (bind) b.quaternion.slerp(bind[1], (n.startsWith("thumb") ? G.thumbOpen : -G.curl) * grabW);
        // and the forefinger and thumb closed round the knob, `close` of the way to a fist (the owner, 2026-09-29: "the
        // left hand when doing the charging handle on the usso doesn't like close its joints/fingers around the charging
        // handle ... it kind of keeps its same position from the pointing": the forefinger lay straight up the gun's
        // side, its tip on the knob)
        const c = n.startsWith("index") ? G.close?.index : n.startsWith("thumb") ? G.close?.thumb : 0;
        if (c && fist) b.quaternion.slerp(fist, c * grabW);
      }
    }
    // a swap's cup: every finger of both hands bent `curl` of the way from open to a fist, round the ball a Hadouken holds
    const cupW = f.cup?.w ?? 0;
    const cup = this.cupFor();
    // (the fingers and the turn over the later `shape` of the hand's way, once it is off the gun)
    const cupShape = { l: THREE.MathUtils.smoothstep(cupW, cup.shape.l[0], cup.shape.l[1]), r: THREE.MathUtils.smoothstep(cupW, cup.shape.r[0], cup.shape.r[1]) };
    if (cupW > 0.001) {
      for (const [b, fist] of this.fistQ) {
        const bind = this.bind.get(b);
        if (bind) b.quaternion.slerp(bind[1].clone().slerp(fist, cup.curl), cupShape[b.name.endsWith("_l") ? "l" : "r"]);
      }
    }
    // a melee: the left hand a fist, its thumb across the fingers as the free hands' is (fparms.json free thumb)
    if (punchW > 0.001) {
      const fw = ss(punchW, PACK_MELEE.fist[0], PACK_MELEE.fist[1]);
      for (const [b, fist] of this.fistQ) if (b.name.endsWith("_l")) b.quaternion.slerp(fist, fw);
      for (const [j, e] of Object.entries((this.debugThumb ?? FREE.thumb)?.l ?? {})) this.bones[`${j}_l`]?.quaternion.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(e[0] * fw, e[1] * fw, e[2] * fw)));
    }

    // the rig fixed to the eye as the pack's camera is (fparms.json camera), moved by the gun's `offset`
    this.arms.quaternion.setFromAxisAngle(UP, Math.PI);
    this.arms.position.set(CAMERA[0], -CAMERA[1], CAMERA[2]).add(this.offset);
    this.arms.scale.set(1, 1, 1);
    // out of the picture on a swap: down, back and pitched down about the eye, the hands with it
    // (only once the gun has all but gone, `dropFrom` of the way: the pack's own swap carries the gun away in the hands,
    // and dropped from the start the arms left the gun flying on its own)
    const away = Math.max(ss(f.away, SWAP.dropFrom, 1), f.release);
    const drop = new THREE.Matrix4().makeTranslation(0, -SWAP.drop * away, SWAP.back * away).multiply(new THREE.Matrix4().makeRotationX(-SWAP.pitch * away));
    // and turned down with the gun as it is levelled at rest, about the gun's origin: turned alone, the gun bent both
    // wrists (the support one from 44 degrees to 56) and moved the left hand off it
    const L = f.levelAt;
    drop.multiply(f.swing).multiply(new THREE.Matrix4().makeTranslation(L.x, L.y, L.z).multiply(new THREE.Matrix4().makeRotationX(-f.level)).multiply(new THREE.Matrix4().makeTranslation(-L.x, -L.y, -L.z)));
    this.arms.updateMatrix();
    new THREE.Matrix4().multiplyMatrices(drop, this.arms.matrix).decompose(this.arms.position, this.arms.quaternion, this.arms.scale);
    this.arms.updateMatrixWorld(true);
    const parentW = this.group.parent ? this.group.parent.matrixWorld : new THREE.Matrix4();
    const dropW = new THREE.Matrix4().multiplyMatrices(parentW, drop).multiply(new THREE.Matrix4().copy(parentW).invert());
    const dropQ = new THREE.Quaternion();
    dropW.decompose(new THREE.Vector3(), dropQ, new THREE.Vector3());
    // the swing's own turn (a swap's, and the rest hold's move to the gun's own place): the pointing elbow's hang, given in
    // the view's space, turns with the arms (left as it was, the USSO's pointing finger aimed 10 degrees off the magazine).
    // The inspect's open palm stays where the view has it (the owner: the hack inspect is right as it is)
    const swingQ = new THREE.Quaternion();
    f.swing.decompose(new THREE.Vector3(), swingQ, new THREE.Vector3());
    const rigInv =new THREE.Matrix4().copy(this.arms.matrixWorld).invert();
    const inRig = (o: THREE.Object3D): THREE.Matrix4 => new THREE.Matrix4().multiplyMatrices(rigInv, o.matrixWorld);

    // the clip's gun motion, carried to our gun
    const boneNow = inRig(this.bones.ik_hand_gun);
    new THREE.Matrix4().copy(this.boneInOur).multiply(this.boneRefInv).multiply(boneNow).multiply(this.ourInBone).decompose(this.gunDelta.position, this.gunDelta.quaternion, this.gunDelta.scale);
    // in the sights most of it is taken off, as the view does its own reload's: aimed, the reload's turn swung the sight
    // off the crosshair
    // (and in the rack only `gunKeep` of it, where set: the MPS5's empty reload throws its gun up and out, and ours went
    // small and far off in the middle of the view)
    const keep =
      (1 - f.ads * f.adsDamp) *
      (reloading && rack?.gunKeep !== undefined ? 1 - (1 - rack.gunKeep) * leadW : 1) *
      (this.lead === "pickup" ? 1 - (1 - PICKUP.gunKeep) * leadW : 1);
    this.gunDelta.position.multiplyScalar(keep);
    this.gunDelta.quaternion.slerp(new THREE.Quaternion(), 1 - keep);
    this.gunDelta.updateMatrix();

    // the pack gun's parts now (its own clip at the same moment), and ours moved as they are
    const gunClip = set.gun.get(this.lead) ?? null;
    let packMagO: THREE.Vector3 | null = null;
    let packHandleO: THREE.Vector3 | null = null;
    let ourMagO: THREE.Vector3 | null = null;
    let ourHandleO: THREE.Vector3 | null = null;
    if (gunClip) {
      gunClip.mixer.setTime(u * gunClip.clip.duration);
      gunClip.root.updateMatrixWorld(true);
    }
    const partNow = (n: string | null): THREE.Matrix4 | null => {
      const o = n && gunClip ? gunClip.root.getObjectByName(n) : null;
      return o ? new THREE.Matrix4().multiplyMatrices(new THREE.Matrix4().copy(gunClip!.root.matrixWorld).invert(), o.matrixWorld) : null;
    };
    const magNow = partNow(MAG_NODE);
    // the magazine's slide in our gun's frame: down its own length (its sweep runs top to bottom, viewmodel.ts), `slide`
    // view metres
    const slideO = new THREE.Vector3();
    const tipSlideO = new THREE.Vector3();
    if (this.magRestO && (slid > 0 || tipSlid > 0)) {
      const k = this.group.getWorldScale(new THREE.Vector3()).x / Math.max(1e-6, holder.getWorldScale(new THREE.Vector3()).x);
      slideO.set(0, -1, 0).transformDirection(this.magRestO).multiplyScalar(RL.slide * k * slid);
      tipSlideO.set(0, -1, 0).transformDirection(this.magRestO).multiplyScalar(RL.slide * k * tipSlid);
    }
    this.seen.magSlid = slid;
    this.seen.tipSlid = tipSlid;
    if (mag && this.magRestO && this.magParentInv) {
      let ours = slid > 0 ? new THREE.Matrix4().makeTranslation(slideO.x, slideO.y, slideO.z).multiply(this.magRestO) : this.magRestO;
      // (in a reload it stays in the gun, phasing out and in where it sits: the owner's point and phase)
      if (magNow && gunClip?.magRest && !reloading) {
        // its move from rest in its own frame, carried into ours
        const d = new THREE.Matrix4().multiplyMatrices(magNow, new THREE.Matrix4().copy(gunClip.magRest).invert());
        ours = new THREE.Matrix4().copy(this.packToOur).multiply(d).multiply(this.ourToPack).multiply(this.magRestO);
        packMagO = loc(magNow).applyMatrix4(this.packToOur);
      } else packMagO = gunClip?.magRest ? loc(gunClip.magRest).applyMatrix4(this.packToOur) : null;
      ourMagO = loc(ours);
      new THREE.Matrix4().multiplyMatrices(this.magParentInv, ours).decompose(mag.position, mag.quaternion, mag.scale);
    }
    const handleNow = partNow(gunClip?.handle ?? null);
    if (bolt && this.boltTravel > 0) {
      let back = 0;
      if (handleNow && gunClip?.handleRest && gunClip.handleTravel > 0.005) {
        const at = loc(handleNow);
        back = THREE.MathUtils.clamp(at.distanceTo(gunClip.handleRest) / gunClip.handleTravel, 0, 1);
        packHandleO = at.clone().applyMatrix4(this.packToOur);
      }
      back *= leadW;
      if (grabW > 0 || pull > 0) back = pull;
      bolt.position.z = this.boltRestZ + back * this.boltTravel;
      this.seen.handleBack = back;
      if (this.handleO) ourHandleO = this.handleO.clone().setZ(this.handleO.z + back * this.boltTravel);
    }

    // both hands: where the clip has them on its gun, carried onto ours where the view has put it; the left moved from
    // the pack gun's handguard, magazine or handle onto ours by as much as it is holding each
    holder.updateWorldMatrix(true, false);
    const gunWorld = new THREE.Matrix4().multiplyMatrices(holder.matrixWorld, this.gunDelta.matrix);
    const boneInWorld = new THREE.Matrix4().multiplyMatrices(gunWorld, this.boneInOur);
    const boneNowInv = new THREE.Matrix4().copy(boneNow).invert();
    const toWorldDir = new THREE.Matrix3().setFromMatrix4(gunWorld);
    this.gunWorldLast.copy(gunWorld);
    const gsW = this.group.getWorldScale(new THREE.Vector3()).x;
    // where the left elbow falls pointing (null holding): the final reach bends toward it by the share pointed
    let pointElbow: THREE.Vector3 | null = null;
    // where the hold has the left hand before a point or a grab takes it (the checks: offHold)
    const heldL = new THREE.Vector3();
    // where the open left hand's elbow goes on an inspect (null otherwise)
    let palmElbow: THREE.Vector3 | null = null;
    // a swap's cup: measured afresh each frame, and nothing kept from a swap before this one
    this.seen.cupOff = 0;
    this.seen.cupFace = cupW > 0.001 ? 0 : 180;
    if (!f.cup) this.cupHeld.l = this.cupHeld.r = null;
    for (const side of ["r", "l"] as const) {
      const rel = new THREE.Matrix4().multiplyMatrices(boneNowInv, inRig(this.bones[`ik_hand_${side}`]));
      // (a pickup's right hand stays as the hold has it on the gun)
      if (side === "r" && this.pickWhole) rel.copy(this.poseHandR);
      // (on a pump gun the clip's hand works the pump: kept as the hold has it, moved only as far as the clip moves it along
      // the gun, and our pump with it, so the hand stays where it holds ours)
      const pumpD = new THREE.Vector3();
      // (and only `pumpScale` of the pack's stroke: BIGANTLER's gate is close behind its pump, and the KXG12's whole stroke
      // took the hand 23 mm into it)
      if (side === "l" && this.lead === "fire" && pump) {
        pumpD.copy(loc(rel)).sub(loc(this.poseHandL)).multiplyScalar(PACK[this.active!]?.pumpScale ?? 1);
        // (along our pump's own line: the pack's runs a little off it, ours being tilted to fit, and the hand left our
        // pump by 8 mm)
        const along = pumpD.clone().applyMatrix3(new THREE.Matrix3().setFromMatrix4(this.boneInOur)).z;
        pumpD.set(0, 0, along).applyMatrix3(new THREE.Matrix3().setFromMatrix4(this.ourInBone));
      }
      if (side === "l" && this.lead === "fire") rel.copy(this.poseHandL).setPosition(loc(this.poseHandL).add(pumpD));
      if (pump && side === "l") pump.position.z = this.pumpRestZ + pumpD.clone().applyMatrix3(new THREE.Matrix3().setFromMatrix4(this.boneInOur)).z;
      if (side === "l" && this.pickWhole && this.pickNearL > 0.001) {
        const [ap, aq, bp, bq] = [new THREE.Vector3(), new THREE.Quaternion(), new THREE.Vector3(), new THREE.Quaternion()];
        rel.decompose(ap, aq, new THREE.Vector3());
        this.poseHandL.decompose(bp, bq, new THREE.Vector3());
        rel.compose(ap.lerp(bp, this.pickNearL), aq.slerp(bq, this.pickNearL), new THREE.Vector3(1, 1, 1));
      }
      const pos = new THREE.Vector3();
      const quat = new THREE.Quaternion();
      new THREE.Matrix4().multiplyMatrices(boneInWorld, rel).decompose(pos, quat, new THREE.Vector3());
      // moved off our gun as far as the fit says, while holding; and while the pack's rack clip works the gun, as far as
      // its rack says (the L96X's hand throws its bolt where BOOG's body is, the glove 15 mm into it)
      const fitShift = hold?.[side]?.shift;
      // (a pickup's left hand moved by it all the way, down and back: eased in only as it came back, BOOG's, moved 14 cm
      // ahead onto its fore-end, came back by way of its magazine, the pack's own place for it, 6 mm through it)
      const shiftW = side === "l" && this.lead === "pickup" ? 1 : holdW[side];
      if (fitShift && shiftW > 0.001) {
        const v = new THREE.Vector3().fromArray(fitShift);
        const len = v.length();
        if (len > 0) pos.add(v.applyMatrix3(toWorldDir).normalize().multiplyScalar(len * gsW * shiftW));
      }
      // and turned about the wrist as the fit found it (the thumb's root is in the ball of the hand: no turn of the
      // thumb's joints takes it out of a grip thicker than the pack's, the USSO's 9 mm in)
      const fitRot = hold?.[side]?.rot;
      if (fitRot && holdW[side] > 0.001) quat.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(fitRot[0] * holdW[side], fitRot[1] * holdW[side], fitRot[2] * holdW[side])));
      const rackShift = (this.debugRackShift ?? rack?.shift)?.[side];
      if (rackShift && rack && this.lead === rack.clip && leadW > 0.001) {
        const v = new THREE.Vector3().fromArray(rackShift);
        const len = v.length();
        if (len > 0) pos.add(v.applyMatrix3(toWorldDir).normalize().multiplyScalar(len * gsW * leadW));
      }
      if (side === "l") {
        // the hand in our gun's frame; where it goes on ours:
        // - at the hold, the pack's hand kept at its height against our gun's underside (what the tilt did not close);
        // - carrying the magazine, or working the handle, onto ours, over the moments the pack gun's clip moves its own
        //   (measured), with a lead-in for the reach to it
        const handO = loc(rel).sub(pumpD).applyMatrix4(this.boneInOur);
        const shift = new THREE.Vector3();
        let total = 0;
        const add = (w: number, s: THREE.Vector3): void => {
          if (w <= 0.001) return;
          shift.addScaledVector(s, w);
          total += w;
        };
        add(1 - THREE.MathUtils.smoothstep(handO.distanceTo(this.restHand), 0.03, 0.1), this.palmShift);
        const win = (from: number | null, to: number | null, lead: number, tail: number): number =>
          from === null || to === null ? 0 : THREE.MathUtils.smoothstep(u, from - lead, from) * (1 - THREE.MathUtils.smoothstep(u, to, to + tail));
        // (by the window alone: gated on the hand being near the pack's magazine too, the hand jumped 12 cm the moment
        // it came within reach of it; the offset between the two magazines turns with them, smoothly)
        if (packMagO && ourMagO && gunClip && !reloading) add(win(gunClip.magOut, gunClip.magHome, 0.08, 0.04), ourMagO.clone().sub(packMagO));
        if (packHandleO && ourHandleO && gunClip) add(win(gunClip.handleFrom, gunClip.handleTo, 0.06, 0.05), ourHandleO.clone().sub(packHandleO));
        if (total > 1) shift.divideScalar(total);
        pos.add(shift.applyMatrix3(toWorldDir));
        heldL.copy(pos);
        // pointing at the magazine: the fingertip `gap` off the face the gun's `point` names (its left, or its bottom),
        // at `at` of its height up a side face; the hand back along its forearm, turned to point
        if (pointW > 0.001) {
          const P = this.pointAt;
          const mb = this.magBoxO;
          const mc = mb.getCenter(new THREE.Vector3());
          const mh = mb.getSize(new THREE.Vector3()).multiplyScalar(0.5);
          const spotO = new THREE.Vector3(
            mc.x + P.face[0] * (mh.x + RL.gap),
            P.face[1] ? mc.y + P.face[1] * (mh.y + RL.gap) : mb.min.y + 2 * mh.y * P.at,
            mc.z + P.face[2] * (mh.z + RL.gap),
          );
          // what it points at, where the finger has the magazine going, and the fingertip `shift` view metres off it, left
          // and down (the owner: the finger "down and left more on both, not by too much")
          const atW = spotO.clone().add(tipSlideO).applyMatrix4(gunWorld);
          const viewQ = this.group.getWorldQuaternion(new THREE.Quaternion());
          const gs = this.group.getWorldScale(new THREE.Vector3()).x;
          const tipW = atW.clone().add(new THREE.Vector3(-RL.shift[0], -RL.shift[1], 0).multiplyScalar(gs).applyQuaternion(viewQ));
          // the hand along its forearm's line through the fingertip, as an arm points, bent a little toward `aim`: the
          // arm placed once toward the tip from its shoulder, then the hand aimed from where its elbow fell (along `aim`
          // alone the hand turned back on the forearm, the wrist 107 to 126 degrees)
          this.tipTarget.copy(tipW);
          const reachW = (P.reach ?? RL.reach) * this.group.getWorldScale(new THREE.Vector3()).x;
          const aimW = new THREE.Vector3().fromArray(P.aim).normalize().applyMatrix3(toWorldDir).normalize();
          const shoulder = this.bones.upperarm_l.getWorldPosition(new THREE.Vector3());
          let dirW = tipW.clone().sub(shoulder).normalize();
          const first = tipW.clone().addScaledVector(dirW, -reachW);
          // (the arm put back after: the final reach bends its elbow the way the elbow is, and left where this pass put
          // it, the first frames of a reload swung the elbow up and the upper arm across the view with the hand still
          // on the gun)
          const armBones = [this.bones.upperarm_l, this.bones.lowerarm_l, this.bones.hand_l];
          const armWas = armBones.map((b) => b.quaternion.clone());
          // the elbow hanging down from the shoulder, as one's does pointing at something near the chest (bent the way
          // the hold had it, it went up beside the eye on the way)
          const hang = new THREE.Vector3().fromArray(P.elbow ?? RL.elbow).normalize().applyQuaternion(swingQ).applyQuaternion(this.group.getWorldQuaternion(new THREE.Quaternion()));
          this.reach("l", away > 0 ? first.clone().applyMatrix4(dropW) : first, quat, shoulder.clone().add(hang));
          pointElbow = this.bones.lowerarm_l.getWorldPosition(new THREE.Vector3());
          armBones.forEach((b, i) => b.quaternion.copy(armWas[i]));
          this.bones.upperarm_l.updateMatrixWorld(true);
          const elbowW = pointElbow.clone();
          if (away > 0) elbowW.applyMatrix4(new THREE.Matrix4().copy(dropW).invert());
          dirW = tipW.clone().sub(elbowW).normalize().lerp(aimW, RL.bend).normalize();
          // and turned `aimAt` of the way to point at it from where the tip now is
          if (atW.distanceTo(tipW) > 1e-5) dirW.lerp(atW.clone().sub(tipW).normalize(), (P.aimAt ?? RL.aimAt)).normalize();
          this.pointAtW.copy(atW);
          // the index finger itself along that line, its tip on the spot: the finger's line and tip in the hand's frame
          // (straightened above), the hand turned to lay it along the line and put back from the tip by it. Aimed by the
          // hand's middle knuckle and placed by the finger's last joint, it pointed 70 degrees off what it was at
          const { tipL, lineL } = this.indexInHand();
          const handS = this.bones.hand_l.getWorldScale(new THREE.Vector3()).x;
          const pointQ = new THREE.Quaternion().setFromUnitVectors(lineL.clone().applyQuaternion(quat).normalize(), dirW).multiply(quat);
          const wristW = tipW.clone().sub(tipL.clone().multiplyScalar(handS).applyQuaternion(pointQ));
          pos.lerp(wristW, pointW);
          quat.slerp(pointQ, pointW);
          // out round the gun's left side on the way to the point and back (BOOG's hand, out on the fore-end, went 15 mm
          // through its magazine going straight), the most a third of the way from the hold, where the magazine is in the
          // way, and next to none as the finger lands on its spot (bowed evenly, it landed 50 to 74 degrees off it)
          pos.add(new THREE.Vector3().fromArray(this.pointAt.clearWay ?? [-1, 0, 0]).applyMatrix3(toWorldDir).normalize().multiplyScalar(6.75 * pointW * (1 - pointW) ** 2 * (this.pointAt.clear ?? RL.clear) * gsW));
        }
      }
      // grabbing our handle: the pack's hand as it is on its own, moved from that handle to ours, and back with it as far
      // as it has pulled (it lets go there, and the handle slams home without it)
      if (side === "l" && grabW > 0.001 && this.grip && this.handleO) {
        const at = this.handleO.clone().setZ(this.handleO.z + handBack * this.boltTravel);
        const gp = new THREE.Vector3();
        const gq = new THREE.Quaternion();
        this.grip.hand.decompose(gp, gq, new THREE.Vector3());
        gp.add(at.clone().sub(this.grip.handle));
        const held = new THREE.Matrix4().compose(gp, gq, new THREE.Vector3(1, 1, 1));
        // turned round the gun's length through the handle to where the wrist is straightest: the pack's hand comes to
        // its handle at the front of its gun, and taken as it was to ours at the back, the wrist bent 83 degrees
        const wp = new THREE.Vector3();
        const wq = new THREE.Quaternion();
        let bestBend = Infinity;
        // (each try from the arm as it was: the reach bends the elbow the way it is, so a try left in place steers the next)
        const armBones = [this.bones.upperarm_l, this.bones.lowerarm_l, this.bones.hand_l];
        const armWas = armBones.map((b) => b.quaternion.clone());
        const armBack = (): void => {
          armBones.forEach((b, i) => b.quaternion.copy(armWas[i]));
          this.bones.upperarm_l.updateMatrixWorld(true);
        };
        // (or at the gun's own `roll`, degrees, fitted with the hook and curl so the fingers close round the knob and not
        // into the gun's body: the straightest wrist rolled them 10 mm into it)
        const fixedRoll = this.debugGrab?.roll ?? rack!.grab!.roll;
        for (let a = fixedRoll ?? -90; a <= (fixedRoll ?? 90); a += 15) {
          armBack();
          const round = new THREE.Matrix4().makeTranslation(at.x, at.y, at.z).multiply(new THREE.Matrix4().makeRotationZ(a * DEG)).multiply(new THREE.Matrix4().makeTranslation(-at.x, -at.y, -at.z));
          const cp = new THREE.Vector3();
          const cq = new THREE.Quaternion();
          new THREE.Matrix4().multiplyMatrices(gunWorld, round).multiply(held).decompose(cp, cq, new THREE.Vector3());
          this.reach("l", away > 0 ? cp.clone().applyMatrix4(dropW) : cp, away > 0 ? cq.clone().premultiply(dropQ) : cq);
          const bend = this.wristBend("l") + Math.abs(a) * 0.05;
          if (bend < bestBend) {
            bestBend = bend;
            wp.copy(cp);
            wq.copy(cq);
          }
        }
        armBack();
        // (or turned as the gun's own grab says, its knuckles `along` and its palm facing `palm` in our gun's frame: no
        // roll of the pack's grip, made for the MPS5's long front lever, closed round the USSO's small knob and kept out
        // of its body, 10 mm in at best)
        const GA = this.debugGrab?.along ?? rack!.grab!.along;
        const GP = this.debugGrab?.palm ?? rack!.grab!.palm;
        if (GA && GP) {
          const toView = new THREE.Matrix3().setFromMatrix4(new THREE.Matrix4().copy(this.group.matrixWorld).invert().multiply(gunWorld));
          wq.copy(this.handTurn("l", new THREE.Vector3().fromArray(GA).applyMatrix3(toView).normalize(), new THREE.Vector3().fromArray(GP).applyMatrix3(toView).normalize()));
        }
        // the hand put where its hooked fingertips (between the index and middle fingers' last joints) close on the knob,
        // `hook` off it in our gun's frame (view metres): taken as the pack's hand is on its own handle, the fingers
        // stopped 9 cm short of ours; hooked by the fingers' middle joints, the palm went into the gun's body
        const hookL = new THREE.Vector3();
        const pinch = this.debugGrab?.pinch ?? rack!.grab!.pinch;
        for (const n of pinch ? ["index_03_l", "thumb_03_l"] : ["index_03_l", "middle_03_l"]) {
          const b = this.bones[n];
          const b1 = b.parent!;
          b1.updateMatrix();
          b1.parent!.updateMatrix();
          hookL.add(b.position.clone().applyMatrix4(b1.matrix).applyMatrix4(b1.parent!.matrix));
        }
        hookL.multiplyScalar(0.5 * this.bones.hand_l.getWorldScale(new THREE.Vector3()).x);
        const k = this.group.getWorldScale(new THREE.Vector3()).x / Math.max(1e-6, holder.getWorldScale(new THREE.Vector3()).x);
        const hookAt = at.clone().add(new THREE.Vector3().fromArray(this.debugGrab?.hook ?? rack!.grab!.hook).multiplyScalar(k)).applyMatrix4(gunWorld);
        wp.copy(hookAt).sub(hookL.applyQuaternion(wq));
        this.hookTarget.copy(at).applyMatrix4(gunWorld);
        pos.lerp(wp, grabW);
        quat.slerp(wq, grabW);
        // out round the gun's left side on the way to it and back (straight, the hand went through the gun, 19 mm in)
        const bow = 4 * grabW * (1 - grabW) * rack!.grab!.clear * this.group.getWorldScale(new THREE.Vector3()).x;
        pos.add(new THREE.Vector3(-1, 0, 0).applyMatrix3(toWorldDir).normalize().multiplyScalar(bow));
      }
      // feeding the gate: turned `turn` off the hold, and put where its pinch, between the forefinger's and thumb's last
      // joints, holds the shell
      if (side === "l" && feedW > 0.001 && SR) {
        const fq = quat.clone().multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(SR.turn[0], SR.turn[1], SR.turn[2])));
        const pinchL = new THREE.Vector3();
        for (const n of ["index_03_l", "thumb_03_l"]) {
          const b = this.bones[n];
          const b1 = b.parent!;
          b1.updateMatrix();
          b1.parent!.updateMatrix();
          pinchL.add(b.position.clone().applyMatrix4(b1.matrix).applyMatrix4(b1.parent!.matrix));
        }
        pinchL.multiplyScalar(0.5 * this.bones.hand_l.getWorldScale(new THREE.Vector3()).x);
        const fp = this.feedSpotO.clone().applyMatrix4(gunWorld).sub(pinchL.applyQuaternion(fq));
        pos.lerp(fp, feedW);
        // (straight between the pump and the gate, the hand went back through the gun's underside, 7 mm in)
        const bow = new THREE.Vector3().fromArray(SR.bow);
        pos.add(bow.clone().applyMatrix3(toWorldDir).normalize().multiplyScalar(bow.length() * gsW * 4 * feedW * (1 - feedW)));
        quat.slerp(fq, feedW);
      }
      // off the gun and open, palm up, for an inspect's hack
      if (side === "l" && palmW > 0.001 && f.palm) {
        pos.lerp(f.palm.at, palmW);
        // (its ways turned as its place was moved, with the look's change since the look it was set under: viewmodel.ts palmFrame)
        const pt = f.palm.turn ?? new THREE.Quaternion();
        const along = (this.debugPalmAlong ? new THREE.Vector3().fromArray(this.debugPalmAlong) : PALM_ALONG.clone()).applyQuaternion(pt);
        quat.slerp(this.handTurn("l", along, PALM_UP.clone().applyQuaternion(pt)), palmW);
        // the elbow back along the knuckles' line, so the forearm runs on into the hand (palm up and held up, a hanging
        // elbow bent the wrist to 100 degrees)
        const fore = this.bones.lowerarm_l.getWorldPosition(new THREE.Vector3()).distanceTo(this.bones.hand_l.getWorldPosition(new THREE.Vector3()));
        palmElbow = f.palm.at.clone().addScaledVector(along.clone().normalize().applyQuaternion(this.group.getWorldQuaternion(new THREE.Quaternion())), -fore);
        // and moved as the pack gun's rig needs it (view metres): from a shoulder lower and further ahead, BOOG's elbow
        // swung out to the left and its sleeve lay across the bottom of the picture
        const elbowBy = this.debugPalmElbow ?? PACK[this.active!]?.palmElbow;
        if (elbowBy) palmElbow.add(new THREE.Vector3().fromArray(elbowBy).applyQuaternion(pt).applyQuaternion(this.group.getWorldQuaternion(new THREE.Quaternion())).multiplyScalar(gsW));
        // down and out round the gun's left side on the way up and back, the most near the gun, as a hand lets go of what
        // it holds from under it (straight, the hand went 9 to 25 mm through it; out alone, BOOG's fingers still 9 mm)
        pos.add(new THREE.Vector3(-1, -1, 0).applyMatrix3(toWorldDir).normalize().multiplyScalar(6.75 * palmW * (1 - palmW) ** 2 * PACK_PALM.clear * gsW));
      }
      // a swap in place: the hand a little off the gun and a little toward the other, turned in on its forearm till its
      // palm faces the gun's middle, the fingers bent round it, a Hadouken's cup (the owner, 2026-09-30: "just have the two
      // hands move together slightly and have the hands form facing the center ... slightly come off of where they were
      // originally ... then slowly turn both hands inwards to that like ball type motion with the fingers bent in. Like,
      // doesn't need to be too close to the center because then you're moving the hands a lot")
      if (cupW > 0.001 && f.cup) {
        const held = pos.clone();
        // (each hand its own way off the gun, view metres in the gun's frame: straight away from the middle, the left hand at
        // the handguard went along the barrel, 19 mm into the USSO's silencer, and the right, its fingers round the grip,
        // went 15 mm into the magazine drawn along the gun and 16 mm pulled down and out square to it)
        // (a pack gun's own cup move for a hand replaces the shared one: the USSO's left hand, under its front, curled its
        // middle fingertip 17 mm into the gun moved the shared way)
        const move = new THREE.Vector3().fromArray(PACK[this.active!]?.cupMove?.[side] ?? SWAP_CUP.move[side]);
        const cupAt = move.lengthSq() > 0 ? pos.clone().add(move.clone().applyMatrix3(toWorldDir).normalize().multiplyScalar(move.length() * gsW)) : pos.clone();
        // (turned on the forearm alone, as a wrist turns a palm over: the least turn from the palm to the middle bent the
        // USSO's right wrist to 63 degrees)
        const fore = cupAt.clone().sub(this.bones[`lowerarm_${side}`].getWorldPosition(new THREE.Vector3())).normalize();
        const flat = (v: THREE.Vector3) => v.clone().addScaledVector(fore, -v.dot(fore)).normalize();
        const palmNow = flat(this.palmWay(side).applyQuaternion(quat));
        const inward = flat(f.cup.mid.clone().sub(cupAt));
        const roll = Math.atan2(new THREE.Vector3().crossVectors(palmNow, inward).dot(fore), palmNow.dot(inward));
        const cupQ = new THREE.Quaternion().setFromAxisAngle(fore, roll * cup.turn).multiply(quat);
        // (off the gun over `moveAt` of the hand's way, turned and bent over `shape`: turned and bent in place, the fingers went 8 mm into the gun at the start)
        pos.lerp(cupAt, THREE.MathUtils.smoothstep(cupW, cup.moveAt[side][0], cup.moveAt[side][1]));
        quat.slerp(cupQ, cupShape[side]);
        // (the second half from where the first left it: the next gun's holds are elsewhere, and the hand would jump. Kept
        // on the holder, which both guns are held in, so the hands breathe with the gun: kept in the view, the idle's
        // breath swayed BOOG 5.8 mm into the cupped fingers)
        const holderQ = holder.getWorldQuaternion(new THREE.Quaternion());
        const kept = this.cupHeld[side];
        if (f.cup.half === 0) this.cupHeld[side] = { at: pos.clone().applyMatrix4(new THREE.Matrix4().copy(holder.matrixWorld).invert()), q: holderQ.clone().invert().multiply(quat) };
        else if (kept && f.cup.carry < 1) {
          pos.copy(kept.at.clone().applyMatrix4(holder.matrixWorld).lerp(pos, f.cup.carry));
          quat.copy(holderQ.clone().multiply(kept.q).slerp(quat, f.cup.carry));
        }
        this.seen.cupOff = Math.max(this.seen.cupOff, pos.distanceTo(held) / gsW);
        // (how far the palm is from facing the middle across the forearm, as it is turned: BOOG's middle is far ahead along
        // the forearm, where no palm turned on it faces, 78 degrees off whatever the turn)
        this.seen.cupFace = Math.max(this.seen.cupFace, (flat(this.palmWay(side).applyQuaternion(quat)).angleTo(flat(f.cup.mid.clone().sub(pos))) * 180) / Math.PI);
      }
      // a melee: the left hand off the gun, back toward the chest and out in a punch, a fist (the owner, 2026-09-29: "HOLD
      // THE WEAPON WITH THE RIGHT ARM, SWING AT THEM WITH THE LEFT ARM, LEFT ARM SHOULD GO FROM SUPPORTING THE GUN, BACK A
      // BIT TOWARDS THE PLAYERS CHEST, THEN SWING OUT")
      if (side === "l" && punchW > 0.001 && f.punch) {
        pos.lerp(f.punch.at, punchW);
        // (the knuckles on along the forearm, elbow to hand, in the view's own space: given a way of their own, the wrist
        // bent 133 degrees drawn back)
        const viewInv = this.group.getWorldQuaternion(new THREE.Quaternion()).invert();
        const along = f.punch.at.clone().sub(f.punch.elbow).applyQuaternion(viewInv).normalize();
        // (the hand turns over `turn` of its way, after it has left the gun and before it is back on it: turning as it
        // moved, BOOG's fingers, wrapped under its fore-end, swung 15 mm into it in the first frames)
        quat.slerp(this.handTurn("l", along, f.punch.palm), THREE.MathUtils.smoothstep(punchW, PACK_MELEE.turn[0], PACK_MELEE.turn[1]));
        // (down and out round the gun on the way off it and back, the most near it: straight, the USSO's fingers went 9
        // mm into it)
        // (a pack gun's own way off the gun for the punch, in the gun's frame: BOOG's hand under its fore-end bowed out to
        // the left through it, 14 mm, leaving and coming back)
        pos.add(new THREE.Vector3().fromArray(PACK[this.active!]?.meleeClearWay ?? [-1, -1, 0]).applyMatrix3(toWorldDir).normalize().multiplyScalar(6.75 * punchW * (1 - punchW) ** 2 * (PACK[this.active!]?.meleeClear ?? PACK_MELEE.clear) * gsW));
      }
      if (side === "l") this.seen.offHold = pos.distanceTo(heldL) / gsW;
      // off the gun as the fingers open to let a thrown one go (opened in place, they went 12 mm into the USSO's front and
      // its magazine through the right hand as it left), view metres in our gun's frame
      const offV = new THREE.Vector3().fromArray(this.throwCfg.hands[side].off);
      if (f.leave[side] > 0.001 && offV.lengthSq() > 0) pos.add(offV.clone().applyMatrix3(toWorldDir).normalize().multiplyScalar(offV.length() * gsW * f.leave[side]));
      // with the rig, if it has dropped away
      if (away > 0) {
        pos.applyMatrix4(dropW);
        quat.premultiply(dropQ);
      }
      let bend = side === "l" && pointElbow ? this.bones.lowerarm_l.getWorldPosition(new THREE.Vector3()).lerp(pointElbow, pointW) : undefined;
      if (side === "l" && palmElbow) bend = (bend ?? this.bones.lowerarm_l.getWorldPosition(new THREE.Vector3())).lerp(palmElbow, palmW);
      // (a melee's elbow held low and out beside the body: left to the arm, it rose in front of the eye)
      if (side === "l" && punchW > 0.001 && f.punch) bend = (bend ?? this.bones.lowerarm_l.getWorldPosition(new THREE.Vector3())).lerp(f.punch.elbow, punchW);
      // at the hold, out of the sights, the elbow bent toward `holdElbow` from the hand (view metres), so the forearm comes
      // up from under the gun as Hyper Scape's, Apex's and EMPULSE's do (the owner, 2026-09-30: "the support arm is much
      // less pronounced than ours"; bent the clip's way, the USSO's left forearm crossed the lower left of the picture and
      // its upper arm filled the corner)
      const ownHE = (this.debugHoldElbow ?? PACK[this.active!]?.holdElbow)?.[side];
      const HE = side === "l" && ownHE && BA?.elbow && bw > 0.001 ? ownHE.map((v, i) => v + (BA.elbow![i] - v) * bw) : ownHE;
      const heW = holdW[side] * (1 - f.ads);
      if (HE && heW > 0.001) {
        // (turned with the arms' swing, the rest look's turn with it, so it holds wherever the look puts the gun)
        const hint = pos.clone().add(new THREE.Vector3().fromArray(HE).applyQuaternion(swingQ).applyQuaternion(this.group.getWorldQuaternion(new THREE.Quaternion())).multiplyScalar(gsW));
        bend = (bend ?? this.bones[`lowerarm_${side}`].getWorldPosition(new THREE.Vector3())).lerp(hint, Math.min(1, heW));
      }
      this.reach(side, pos, quat, bend);
      // (a swap's cup turns each hand on its forearm, the forearm taking its share as an inspect's roll does)
      if (side === "r" && Math.max(f.rollR, cupW) > 0.001) this.spreadTwist("r", Math.max(f.rollR, cupW));
      // (whole a quarter of the way in: the hand turns palm up faster than it moves, and spread by the palm's own weight the
      // wrist was wrung 100 degrees on the way)
      if (side === "l") this.spreadTwist("l", Math.max(Math.min(1, palmW * 4), cupW, punchW));
    }
    // for the checks: how far the index fingertip is from where it points, and how short the arm fell of its target
    const tip = this.bones.index_03_l ? this.indexTipW() : undefined;
    // (once it points: on the way from the point to the USSO's handle the point is held and the grab moves the hand, and
    // on the way in, a hand 93% there had its tip 1 to 2 cm off, and the line from it to a spot 2.5 cm away anything)
    // (landed: at 98% of its way, on a tactical reload's shorter timeline, the frame sheets caught BOOG's finger still
    // coming onto its spot and already leaving it, 14 to 18 degrees off)
    const pointing = pointW * (1 - grabW);
    this.seen.pointMiss = pointing > 0.995 && tip ? tip.distanceTo(this.tipTarget) / this.group.getWorldScale(new THREE.Vector3()).x : Infinity;
    // and how many degrees the finger's line is off the line to what it points at
    const knuckleI = this.bones.index_01_l?.getWorldPosition(new THREE.Vector3());
    this.seen.pointOff = pointing > 0.995 && tip && knuckleI ? THREE.MathUtils.radToDeg(tip.clone().sub(knuckleI).angleTo(this.pointAtW.clone().sub(tip))) : 180;
    this.seen.gunTurn = (2 * Math.acos(Math.min(1, Math.abs(this.gunDelta.quaternion.w))) * 180) / Math.PI;
    const knuckle = this.bones.middle_01_l?.getWorldPosition(new THREE.Vector3());
    this.seen.leftToHandle = knuckle && ourHandleO ? knuckle.distanceTo(ourHandleO.clone().applyMatrix4(gunWorld)) : Infinity;
    this.seen.leftToMag = knuckle && mag ? knuckle.distanceTo(mag.getWorldPosition(new THREE.Vector3())) : Infinity;
    // and how far the left palm's middle is ahead of the magazine's front along our gun, view metres (behind it, on the
    // magazine: BOOG's hand held its plate; the owner, 2026-09-28: "for the boog, the support hand is holding the mag")
    if (knuckle && !this.magBoxO.isEmpty()) {
      const toO = new THREE.Matrix4().copy(gunWorld).invert();
      // (along our gun's own barrel, its -z: along the view's ahead, with the guns once turned 22 degrees across it, BOOG's
      // palm read 1 cm behind a magazine it is 2.9 cm ahead of)
      const aheadO = new THREE.Vector3(0, 0, -1);
      const palmO = this.bones.hand_l.getWorldPosition(new THREE.Vector3()).add(knuckle).multiplyScalar(0.5).applyMatrix4(toO);
      const b = this.magBoxO;
      let front = -Infinity;
      for (const x of [b.min.x, b.max.x]) for (const y of [b.min.y, b.max.y]) for (const z of [b.min.z, b.max.z]) front = Math.max(front, new THREE.Vector3(x, y, z).dot(aheadO));
      this.seen.palmAhead = ((palmO.dot(aheadO) - front) * new THREE.Vector3().setFromMatrixScale(gunWorld).x) / this.group.getWorldScale(new THREE.Vector3()).x;
    }
    // and how far the grab's pinch (between its two fingertips) is from the handle's knob, view metres
    const i2 = this.bones.index_03_l?.getWorldPosition(new THREE.Vector3());
    const m2 = (PACK[this.active ?? ""]?.rack?.grab?.pinch ? this.bones.thumb_03_l : this.bones.middle_03_l)?.getWorldPosition(new THREE.Vector3());
    this.seen.hookMiss = grabW > 0.9 && i2 && m2 ? i2.add(m2).multiplyScalar(0.5).distanceTo(this.hookTarget) / this.group.getWorldScale(new THREE.Vector3()).x : Infinity;
    // and how far the forefinger is bent round it, degrees
    this.seen.rackCurl = grabW > 0.9 ? this.curlOf("l", "index") : 0;
    // and how far below the eye line the higher hand is, degrees (the eye is the group's origin, looking down -z; the
    // view at the hip shows 40 below it), a hand behind the eye out of the picture whatever its height. Read at the
    // knuckles: held from the corner, BOOG's left wrist is at the picture's bottom edge with the hand in it
    const below = (b: THREE.Object3D | undefined): number => {
      if (!b) return 0;
      const p = this.group.worldToLocal(b.getWorldPosition(new THREE.Vector3()));
      return p.z < 0 ? THREE.MathUtils.radToDeg(Math.atan2(-p.y, -p.z)) : 180;
    };
    this.seen.handsBelow = Math.min(below(this.bones.middle_01_l ?? this.bones.hand_l), below(this.bones.middle_01_r ?? this.bones.hand_r));
  }

  /**
   * Each shoulder moved as KINEMATION's player moves it for this gun (its settings' clavicle offsets, in the rig's space:
   * Unity's x is the glTF's -x), after the clip has put it: the L96X's right one 21 cm back, so the long gun's grip is
   * reached with the elbow bent (without it BOOG's right wrist bent 87 degrees at the hold and 155 aimed)
   */
  private moveShoulders(ads: number): void {
    const me = this.active ? MEASURED[this.active] : null;
    if (!me || !this.arms) return;
    // and aimed, both back by as much again as our sights bring the gun nearer the eye than the pack's do (fparms.json
    // adsShoulder): with the shoulders where the hold put them, the USSO's right wrist bent 109 degrees aimed, its left 70
    const back = ADS_SHOULDER * ads;
    // and the pack gun's own fit on top, at rest and aimed (packGuns shoulders, found by tools/pack-fit.ts wrists: the
    // shoulder where the wrist is straightest, the hands where they are)
    const S = this.debugShoulders ?? PACK[this.active!]?.shoulders ?? {};
    const add = (base: number[] | undefined, rest: number[] | undefined, aimed: number[] | undefined, k: number): number[] => {
      const b = base ?? [0, 0, 0];
      const a = rest ?? [0, 0, 0];
      const d = aimed ?? [0, 0, 0];
      return [0, 1, 2].map((i) => b[i] + a[i] * (1 - ads) + d[i] * ads - (i === 2 ? k : 0));
    };
    // (the left shoulder's rest fit is the hold's: searched with the hand on the gun so the forearm comes up from under
    // the picture, and 25 cm from where the point, the open palm and the punch were fitted, it put those out of the arm's
    // reach, 31 mm short in the USSO's punch. As the hand leaves the gun, or the gun is framed as before the refit, it
    // goes to the shoulder those were fitted with (packGuns beforeArm), a frame behind: faded to none, BOOG's pickup fell
    // 51 mm short)
    // (and in a punch to the gun's own melee shoulder, where it has one: PANDA's hold brings its left shoulder 8 cm
    // forward and its flourish needs it forward too, and from one shoulder for both the punching upper arm filled 11 to
    // 58% of the picture; its own, 20 cm back and 10 down, none)
    const was0 = PACK[this.active!]?.beforeArm?.shoulder ?? [0, 0, 0];
    const MS = PACK[this.active!]?.meleeShoulder;
    const was = MS ? was0.map((v, i) => v + (MS[i] - v) * this.punchW) : was0;
    const lw = this.holdLW * (1 - this.beforeArmW);
    const l = add(me.clavicleL, S.l?.map((v, i) => was[i] + (v - was[i]) * lw), S.adsL, back);
    const r = add(me.clavicleR, S.r, S.adsR, back);
    for (const [side, off] of [["l", l], ["r", r]] as const) {
      if (!off || (off[0] === 0 && off[1] === 0 && off[2] === 0)) continue;
      const clav = this.bones[`clavicle_${side}`];
      if (!clav?.parent) continue;
      this.arms.updateMatrixWorld(true);
      const inRig = new THREE.Vector3(-off[0], off[1], off[2]);
      // the rig's direction into the clavicle's parent's frame
      const toParent = new THREE.Matrix4().copy(clav.parent.matrixWorld).invert().multiply(this.arms.matrixWorld);
      const len = inRig.length();
      clav.position.add(inRig.transformDirection(toParent).multiplyScalar(len));
    }
  }

  /** the hand `side` to `target` turned `turn` (world), the arm bent to reach it in the plane the clip had its elbow */
  private reach(side: "l" | "r", target: THREE.Vector3, turn: THREE.Quaternion, bendToward?: THREE.Vector3): void {
    const up = this.bones[`upperarm_${side}`];
    const lo = this.bones[`lowerarm_${side}`];
    const hand = this.bones[`hand_${side}`];
    if (!up || !lo || !hand) return;
    const s = up.getWorldPosition(new THREE.Vector3());
    const e = lo.getWorldPosition(new THREE.Vector3());
    const w = hand.getWorldPosition(new THREE.Vector3());
    const a = s.distanceTo(e);
    const b = e.distanceTo(w);
    const d = THREE.MathUtils.clamp(s.distanceTo(target), Math.abs(a - b) + 1e-4, a + b - 1e-4);
    this.seen[side === "l" ? "reachShort" : "reachShortR"] = Math.max(0, s.distanceTo(target) - (a + b)) / this.group.getWorldScale(new THREE.Vector3()).x;
    const dir = target.clone().sub(s).normalize();
    // the elbow bends the way it is (the clip's), or toward a point given
    const pole = (bendToward ?? e).clone().sub(s);
    pole.addScaledVector(dir, -pole.dot(dir)).normalize();
    const cosA = (a * a + d * d - b * b) / (2 * a * d);
    const elbow = s.clone().addScaledVector(dir, a * cosA).addScaledVector(pole, a * Math.sqrt(Math.max(0, 1 - cosA * cosA)));
    const aim = (bone: THREE.Object3D, from: THREE.Vector3, to: THREE.Vector3, child: THREE.Vector3): void => {
      const q = new THREE.Quaternion().setFromUnitVectors(child.clone().sub(from).normalize(), to.clone().sub(from).normalize());
      const wq = bone.getWorldQuaternion(new THREE.Quaternion()).premultiply(q);
      bone.quaternion.copy(bone.parent!.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(wq));
      bone.updateMatrixWorld(true);
    };
    aim(up, s, elbow, e);
    aim(lo, lo.getWorldPosition(new THREE.Vector3()), s.clone().addScaledVector(dir, d), hand.getWorldPosition(new THREE.Vector3()));
    // the hand keeps the turn the clip gave it on its gun
    hand.quaternion.copy(hand.parent!.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(turn));
    hand.updateMatrixWorld(true);
  }

  /**
   * Where the pack's left hand holds its own handle, for a gun whose rack is a grab: the moment of its rack clip when the
   * hand's middle knuckle is nearest the handle (a sweep of the clip, measured once a gun), the hand then in our gun's
   * frame (as the frame's hands are: the gun bone's frame taken to ours), that handle in ours, and the fingers' turns.
   */
  private measureGrip(name: string, set: GunSet, boneInOur: THREE.Matrix4, turn: THREE.Matrix4): PackArms["grip"] {
    const rk = PACK[name]?.rack;
    const gc = rk?.grab ? set.gun.get(rk.clip) : undefined;
    const act = rk?.grab ? this.actions.get(rk.clip) : undefined;
    const pose = this.actions.get("pose");
    if (!rk?.grab || !gc?.handle || !act || !pose || !this.mixer || !this.arms) return null;
    const packToOur = new THREE.Matrix4().copy(boneInOur).multiply(turn);
    const handleNode = gc.root.getObjectByName(gc.handle);
    if (!handleNode) return null;
    const sample = (u: number) => {
      act.time = u * act.getClip().duration;
      this.mixer!.update(0);
      this.arms!.updateMatrixWorld(true);
      const rigInv = new THREE.Matrix4().copy(this.arms!.matrixWorld).invert();
      const boneInv = new THREE.Matrix4().multiplyMatrices(rigInv, this.bones.ik_hand_gun.matrixWorld).invert();
      const inOur = (o: THREE.Object3D) => new THREE.Matrix4().copy(boneInOur).multiply(boneInv).multiply(new THREE.Matrix4().multiplyMatrices(rigInv, o.matrixWorld));
      gc.mixer.setTime(u * gc.clip.duration);
      gc.root.updateMatrixWorld(true);
      const handle = loc(new THREE.Matrix4().multiplyMatrices(new THREE.Matrix4().copy(gc.root.matrixWorld).invert(), handleNode.matrixWorld)).applyMatrix4(packToOur);
      return { hand: inOur(this.bones.ik_hand_l), knuckle: loc(inOur(this.bones.middle_01_l)), handle };
    };
    pose.weight = 0;
    act.weight = 1;
    let best = { u: 0, d: Infinity };
    for (let u = 0; u <= 1.0001; u += 0.01) {
      const s = sample(u);
      const d = s.knuckle.distanceTo(s.handle);
      if (d < best.d) best = { u, d };
    }
    const s = sample(best.u);
    const fingers = new Map<THREE.Object3D, THREE.Quaternion>();
    for (const [n, b] of Object.entries(this.bones)) if (FINGER_L.test(n)) fingers.set(b, b.quaternion.clone());
    act.weight = 0;
    act.time = 0;
    pose.weight = 1;
    this.mixer.update(0);
    return { hand: s.hand, handle: s.handle, fingers, u: best.u, miss: best.d };
  }

  /**
   * A hand's turn (world) with its knuckles along `along` and its palm facing `palm`, both in the view's own space:
   * its knuckles' way in its own frame is to its middle finger's first joint, its palm's across its knuckles (index to
   * little finger) and that, the way round `FREE.palmSign` says for each hand (they are mirrored)
   */
  handTurn(side: "l" | "r", along: THREE.Vector3, palm: THREE.Vector3): THREE.Quaternion {
    const a = this.bones[`middle_01_${side}`].position.clone().normalize();
    const across = this.bones[`index_01_${side}`].position.clone().sub(this.bones[`pinky_01_${side}`].position);
    const p = new THREE.Vector3().crossVectors(across, a).normalize().multiplyScalar(FREE.palmSign[side]);
    const local = new THREE.Matrix4().makeBasis(a, p, new THREE.Vector3().crossVectors(a, p).normalize());
    const va = along.clone().normalize();
    const vp = palm.clone().sub(va.clone().multiplyScalar(palm.dot(va))).normalize();
    const view = new THREE.Matrix4().makeBasis(va, vp, new THREE.Vector3().crossVectors(va, vp).normalize());
    const q = new THREE.Quaternion().setFromRotationMatrix(view.multiply(local.transpose()));
    return this.group.getWorldQuaternion(new THREE.Quaternion()).multiply(q);
  }

  /** the way a hand's palm faces, in its own frame (as handTurn builds a hand's turn) */
  private palmWay(side: "l" | "r"): THREE.Vector3 {
    const a = this.bones[`middle_01_${side}`].position.clone().normalize();
    const across = this.bones[`index_01_${side}`].position.clone().sub(this.bones[`pinky_01_${side}`].position);
    return new THREE.Vector3().crossVectors(across, a).normalize().multiplyScalar(FREE.palmSign[side]);
  }

  /** a point just over the open left palm (world): where an inspect's hack floats */
  palmPoint(out: THREE.Vector3): THREE.Vector3 {
    const hand = this.bones.hand_l;
    const q = hand.getWorldQuaternion(new THREE.Quaternion());
    const s = hand.getWorldScale(new THREE.Vector3()).x;
    const a = this.bones.middle_01_l.position.clone();
    const across = this.bones.index_01_l.position.clone().sub(this.bones.pinky_01_l.position);
    const p = new THREE.Vector3().crossVectors(across, a.clone().normalize()).normalize().multiplyScalar(FREE.palmSign.l);
    return hand.getWorldPosition(out).add(a.multiplyScalar(0.6 * s).add(p.multiplyScalar(PACK_PALM.lift * this.group.getWorldScale(new THREE.Vector3()).x)).applyQuaternion(q));
  }

  /** whether the hands can be drawn off a gun (the arms and a grip to make fists from are in) */
  get freeReady(): boolean {
    return this.ready && this.fistQ.size > 0;
  }

  /** each finger joint's fist from a pose clip's grip: bent further along the axis the grip bends it (FREE.fist) */
  private makeFists(clip: THREE.AnimationClip): void {
    for (const [n, b] of Object.entries(this.bones)) {
      if (!/^(index|middle|ring|pinky|thumb)_0[123]_[lr]$/.test(n)) continue;
      const bind = this.bind.get(b);
      const tr = clip.tracks.find((t) => t.name === `${n}.quaternion`);
      if (!bind || !tr) continue;
      const cq = new THREE.Quaternion().fromArray(tr.values as unknown as number[], 0);
      const d = bind[1].clone().invert().multiply(cq);
      const angle = 2 * Math.acos(Math.min(1, Math.abs(d.w)));
      if (angle < 0.05) continue;
      const axis = new THREE.Vector3(d.x, d.y, d.z).normalize().multiplyScalar(Math.sign(d.w) || 1);
      this.fistQ.set(b, bind[1].clone().multiply(new THREE.Quaternion().setFromAxisAngle(axis, FREE.fist[jointKey(n)] ?? angle)));
    }
  }

  /**
   * One frame of the hands off any gun (the fists, the crawl): the arms on the eye as they are made, each hand to where
   * the view has it, turned as it says, its fingers curled `fist` of the way to a fist
   */
  free(hands: { l: FreeHand; r: FreeHand }): void {
    if (!this.freeReady || !this.arms) return;
    this.group.visible = true;
    this.gunDelta.position.set(0, 0, 0);
    this.gunDelta.quaternion.identity();
    this.gunDelta.scale.set(1, 1, 1);
    for (const [o, [p, q, sc]] of this.bind) {
      o.position.copy(p);
      o.quaternion.copy(q);
      o.scale.copy(sc);
    }
    for (const [b, q] of this.fistQ) {
      const side = b.name.endsWith("_l") ? "l" : "r";
      b.quaternion.slerp(q, hands[side].fist);
    }
    // (the thumb across the fingers: bent as the grip bends it, it lay along the top of the fist with its tip out ahead)
    const thumb = this.debugThumb ?? FREE.thumb;
    for (const side of ["l", "r"] as const) {
      const w = hands[side].fist;
      for (const [j, e] of Object.entries(thumb?.[side] ?? {})) this.bones[`${j}_${side}`]?.quaternion.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(e[0] * w, e[1] * w, e[2] * w)));
    }
    this.arms.quaternion.setFromAxisAngle(UP, Math.PI);
    this.arms.position.set(CAMERA[0], -CAMERA[1], CAMERA[2]);
    this.arms.scale.set(1, 1, 1);
    this.arms.updateMatrixWorld(true);
    for (const side of ["r", "l"] as const) {
      this.reach(side, hands[side].at, this.handTurn(side, hands[side].along, hands[side].palm));
      this.spreadTwist(side, 1);
    }
  }

  /**
   * The left index finger in its hand's frame (the hand's world scale taken off): where its tip is and the way it runs,
   * knuckle to tip. The skeleton ends at the last joint, so the tip is out past it by 0.8 of the middle bone's length,
   * a finger's last bone's share of the one before it.
   */
  private indexInHand(): { tipL: THREE.Vector3; lineL: THREE.Vector3 } {
    const hand = this.bones.hand_l;
    hand.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(hand.matrixWorld).invert();
    const at = (n: string) => this.bones[n].getWorldPosition(new THREE.Vector3()).applyMatrix4(inv);
    const i1 = at("index_01_l");
    const i2 = at("index_02_l");
    const i3 = at("index_03_l");
    const tipL = i3.clone().addScaledVector(i3.clone().sub(i2), 0.8);
    return { tipL, lineL: tipL.clone().sub(i1).normalize() };
  }

  /** the left index fingertip in the world (past its last joint, as indexInHand) */
  private indexTipW(): THREE.Vector3 {
    const i2 = this.bones.index_02_l.getWorldPosition(new THREE.Vector3());
    const i3 = this.bones.index_03_l.getWorldPosition(new THREE.Vector3());
    return i3.clone().addScaledVector(i3.clone().sub(i2), 0.8);
  }

  /** a direction in the world as view metres along our gun's axes (the fitter: which way to move a hand off the gun) */
  gunAxes(world: number[]): number[] {
    const v = new THREE.Vector3().fromArray(world);
    const len = v.length() / this.group.getWorldScale(new THREE.Vector3()).x;
    if (len < 1e-9) return [0, 0, 0];
    v.applyMatrix3(new THREE.Matrix3().setFromMatrix4(this.gunWorldLast).invert()).normalize().multiplyScalar(len);
    return [v.x, v.y, v.z];
  }

  /** a wrist's bend, degrees: the angle between the hand's line and its forearm's (the checks) */
  wristBend(side: "l" | "r"): number {
    const lo = this.bones[`lowerarm_${side}`];
    const hand = this.bones[`hand_${side}`];
    const knuckle = this.bones[`middle_01_${side}`];
    if (!lo || !hand || !knuckle) return 0;
    const e = lo.getWorldPosition(new THREE.Vector3());
    const w = hand.getWorldPosition(new THREE.Vector3());
    const k = knuckle.getWorldPosition(new THREE.Vector3());
    return (w.clone().sub(e).angleTo(k.clone().sub(w)) * 180) / Math.PI;
  }

  /**
   * A hand's roll on its forearm, degrees from the pack's own bind: the turn about the forearm's line, which the bend
   * (wristBend) does not see. Past a quarter turn the glove's cuff splits from the sleeve (the right fist, rolled 159
   * degrees, 2026-09-28).
   */
  wristTwist(side: "l" | "r"): number {
    const hand = this.bones[`hand_${side}`];
    const bind = hand && this.bind.get(hand);
    if (!bind) return 0;
    const d = bind[1].clone().invert().multiply(hand.quaternion);
    const axis = hand.position.clone().normalize().applyQuaternion(bind[1].clone().invert());
    const along = new THREE.Vector3(d.x, d.y, d.z).projectOnVector(axis);
    const twist = new THREE.Quaternion(along.x, along.y, along.z, d.w).normalize();
    return (2 * Math.acos(Math.min(1, Math.abs(twist.w))) * 180) / Math.PI;
  }

  /**
   * The most the forearm's skin is wrung, degrees: the hand's roll against the forearm's twist bone halfway down it, or
   * that bone's against the elbow, whichever is more (wristTwist is the two together)
   */
  skinTwist(side: "l" | "r"): number {
    const all = this.wristTwist(side);
    const tb = this.bones[`lowerarm_twist_01_${side}`];
    const bind = tb && this.bind.get(tb);
    if (!bind) return all;
    const d = bind[1].clone().invert().multiply(tb.quaternion);
    const mid = (2 * Math.acos(Math.min(1, Math.abs(d.w))) * 180) / Math.PI;
    return Math.max(mid, Math.abs(all - mid));
  }

  /**
   * A share of the hand's roll on its forearm taken by the forearm's twist bone halfway down it, as a forearm turns along
   * its length (FREE.twistShare): with the bone left as it was made the whole turn was at the wrist, and a hand posed
   * here rather than by a clip (a fist, the open palm) rolled 150 degrees split the glove's cuff from the sleeve
   */
  private spreadTwist(side: "l" | "r", w: number): void {
    const hand = this.bones[`hand_${side}`];
    const tb = this.bones[`lowerarm_twist_01_${side}`];
    const hb = hand && this.bind.get(hand);
    const bb = tb && this.bind.get(tb);
    if (!hb || !bb || w <= 0.001) return;
    const d = hb[1].clone().invert().multiply(hand.quaternion);
    const axisH = hand.position.clone().normalize().applyQuaternion(hb[1].clone().invert());
    const along = new THREE.Vector3(d.x, d.y, d.z).projectOnVector(axisH);
    const twist = new THREE.Quaternion(along.x, along.y, along.z, d.w).normalize();
    // (the short way round: a turn and its negative are the same, and 163 degrees taken as -197 put 98 on the twist bone)
    if (twist.w < 0) twist.set(-twist.x, -twist.y, -twist.z, -twist.w);
    const angle = 2 * Math.atan2(new THREE.Vector3(twist.x, twist.y, twist.z).dot(axisH), twist.w);
    // the same turn about the forearm's line, in the twist bone's own frame
    const axisT = hand.position.clone().normalize().applyQuaternion(bb[1].clone().invert());
    tb.quaternion.slerp(bb[1].clone().multiply(new THREE.Quaternion().setFromAxisAngle(axisT, angle * FREE.twistShare)), w);
  }

  /** the least curled of a hand's four fingers, degrees: the bends at its knuckle and its middle joint, added */
  fingerCurl(side: "l" | "r"): number {
    const at = (n: string) => this.bones[`${n}_${side}`]?.getWorldPosition(new THREE.Vector3());
    const wrist = at("hand");
    if (!wrist) return 0;
    let least = 360;
    for (const f of ["index", "middle", "ring", "pinky"]) {
      const [a, b, c] = [at(`${f}_01`), at(`${f}_02`), at(`${f}_03`)];
      if (a && b && c) least = Math.min(least, ((a.clone().sub(wrist).angleTo(b.clone().sub(a)) + b.clone().sub(a).angleTo(c.clone().sub(b))) * 180) / Math.PI);
    }
    return least;
  }

  /** one finger's curl, degrees, as fingerCurl measures each (0 without its bones) */
  curlOf(side: "l" | "r", finger: string): number {
    const at = (n: string) => this.bones[`${n}_${side}`]?.getWorldPosition(new THREE.Vector3());
    const [wrist, a, b, c] = [at("hand"), at(`${finger}_01`), at(`${finger}_02`), at(`${finger}_03`)];
    if (!wrist || !a || !b || !c) return 0;
    return ((a.clone().sub(wrist).angleTo(b.clone().sub(a)) + b.clone().sub(a).angleTo(c.clone().sub(b))) * 180) / Math.PI;
  }

  /**
   * How far a fist's thumb tip is from its place across the index and middle fingers' middle bones, in lengths of the
   * index's first bone (tools/fist-thumb.ts searches the thumb to it): bent as the pistol grip bends it, 1.3 to 1.6,
   * the tip out ahead of the fist like a pointing finger
   */
  thumbOff(side: "l" | "r"): number {
    const at = (n: string) => this.bones[`${n}_${side}`].getWorldPosition(new THREE.Vector3());
    const L = at("index_02").distanceTo(at("index_01"));
    const [t2, t3] = [at("thumb_02"), at("thumb_03")];
    const tip = t3.clone().addScaledVector(t3.clone().sub(t2), 0.8);
    const along = at("middle_01").sub(at("hand")).normalize();
    const mid = (f: string) => at(`${f}_02`).add(at(`${f}_03`)).multiplyScalar(0.5);
    return tip.distanceTo(mid("index").add(mid("middle")).multiplyScalar(0.5).addScaledVector(along, 0.3 * L)) / L;
  }

  /** a forearm's line, elbow to wrist, in the world (an inspect rolls the gun about the right one's) */
  forearm(side: "l" | "r", out: THREE.Vector3): THREE.Vector3 | null {
    const lo = this.bones[`lowerarm_${side}`];
    const hand = this.bones[`hand_${side}`];
    if (!lo || !hand) return null;
    return out.copy(hand.getWorldPosition(new THREE.Vector3())).sub(lo.getWorldPosition(new THREE.Vector3())).normalize();
  }

  /** a hand, in the world (the checks) */
  handAt(side: "l" | "r"): THREE.Vector3 | null {
    const h = this.bones[`hand_${side}`];
    return h ? h.getWorldPosition(new THREE.Vector3()) : null;
  }
}

/** a pack gun clip's parts measured: where the magazine and handle rest, how far the handle goes, when the magazine moves */
function measureGunClip(root: THREE.Object3D, clip: THREE.AnimationClip): GunClip {
  const mixer = new THREE.AnimationMixer(root);
  mixer.clipAction(clip).play();
  const inRoot = (o: THREE.Object3D): THREE.Matrix4 => new THREE.Matrix4().multiplyMatrices(new THREE.Matrix4().copy(root.matrixWorld).invert(), o.matrixWorld);
  mixer.setTime(0);
  root.updateMatrixWorld(true);
  const magO = root.getObjectByName(MAG_NODE) ?? null;
  const handle = HANDLE_NODES.find((n) => root.getObjectByName(n)) ?? null;
  const handleO = handle ? root.getObjectByName(handle)! : null;
  const magRest = magO ? inRoot(magO) : null;
  const handleRest = handleO ? loc(inRoot(handleO)) : null;
  let handleTravel = 0;
  let magOut: number | null = null;
  let magHome: number | null = null;
  let handleFrom: number | null = null;
  let handleTo: number | null = null;
  const steps = 120;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    mixer.setTime(t * clip.duration);
    root.updateMatrixWorld(true);
    if (handleO && handleRest) {
      const d = loc(inRoot(handleO)).distanceTo(handleRest);
      handleTravel = Math.max(handleTravel, d);
      if (d > 0.003) {
        if (handleFrom === null) handleFrom = t;
        handleTo = t;
      }
    }
    if (magO && magRest && loc(inRoot(magO)).distanceTo(loc(magRest)) > 0.004) {
      if (magOut === null) magOut = t;
      magHome = t;
    }
  }
  mixer.setTime(0);
  return { root, mixer, clip, magRest, handleRest, handle, handleTravel, magOut, magHome, handleFrom, handleTo };
}
