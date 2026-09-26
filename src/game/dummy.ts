// Training dummy: three hit zones (head / body / legs), health + shield
// tiers, damage application, knock and respawn.
//
// The body you SEE and the body you HIT are now two different things.
//
// The hit zones are the same boxes and sphere they always were, with the same
// dimensions to the millimetre (tools/verify.ts pins the neck-gap numbers), but
// they are drawn with an invisible material. Over them sits a jointed training
// robot: a lathed torso, capsule limbs, ball joints, a visored head. The old
// dummy WAS its hitboxes, which is exactly the Roblox look: a figure made of
// the boxes a physics engine uses.
//
// The visual body sits inside the hit zones everywhere, so a round that
// visibly lands on the robot always registers. The robot is our own design, a
// generic range mannequin, and deliberately not any game's character.
import { figureWork } from "./figlod";
import { floorGun, floorGunMat } from "./loot";
import type { Finish } from "./finishes";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { displayGunModel, applyFinishTo } from "./gunmodels";
import { buildGear } from "./gear";
import { MUZZLE, fitMuzzle, muzzleOf, showFlash } from "./muzzle";
import { ammoTypeOf } from "./ammo";
import { OPERATORS, skinMaterials, type OperatorSkin } from "./operators";
import { MannequinFigure, useMannequin } from "./mannequin";
import { emoteAt, emotePose } from "./emotes";

export type Zone = "head" | "body" | "legs";
export type ArmorTier = 0 | 1 | 2 | 3 | 4;
export const ARMOR_SHIELD: Record<ArmorTier, number> = { 0: 0, 1: 50, 2: 75, 3: 100, 4: 125 };
export const ARMOR_NAME: Record<ArmorTier, string> = { 0: "no armor", 1: "white", 2: "blue", 3: "purple", 4: "red" };
export const ARMOR_COLOR: Record<ArmorTier, number> = { 0: 0xd84a3a, 1: 0xe8e8e8, 2: 0x3b8bff, 3: 0xb04cff, 4: 0xff3b3b };

export interface HitReport {
  zone: Zone;
  amount: number;
  toShield: number;
  toHealth: number;
  broke: boolean;
  knocked: boolean;
  headshot: boolean;
  point: THREE.Vector3;
}

const HEALTH_MAX = 100;
const RESPAWN_S = 1.2;
const FALL_S = 0.32;

// human hull, metres (72 units tall)
const H = 72 * 0.0254;

/**
 * Hit zones render nothing, but the MESH stays visible. That distinction is
 * load-bearing: ProjectileSystem skips meshes whose `visible` is false (three's
 * raycaster would otherwise hit hidden ones), and the armour plate still uses
 * mesh visibility to switch itself off at tier 0.
 */
const HITBOX = new THREE.MeshBasicMaterial({ visible: false });

// ---------------------------------------------------------------- shared geo

const up = new THREE.Vector3(0, 1, 0);

/** a capsule limb between two points */
function limb(a: THREE.Vector3, b: THREE.Vector3, r: number, mat: THREE.Material): THREE.Mesh {
  const d = new THREE.Vector3().subVectors(b, a);
  const len = d.length();
  const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, Math.max(0.001, len), 4, 14), mat);
  m.position.copy(a).addScaledVector(d, 0.5);
  m.quaternion.setFromUnitVectors(up, d.normalize());
  return m;
}

function ball(p: THREE.Vector3, r: number, mat: THREE.Material): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), mat);
  m.position.copy(p);
  return m;
}

/**
 * The torso as a lathe: chest broad at the shoulders, narrow at the waist,
 * flaring at the hips, then squashed front to back so the cross-section is an
 * ellipse rather than a barrel.
 */
function torsoGeometry(): THREE.BufferGeometry {
  const pts = [
    [0.0, 0.93],
    [0.15, 0.935],
    [0.168, 0.97],
    [0.16, 1.02],
    [0.138, 1.08],
    [0.142, 1.15],
    [0.178, 1.26],
    [0.205, 1.36],
    [0.212, 1.42],
    [0.196, 1.475],
    [0.15, 1.515],
    [0.07, 1.54],
    [0.0, 1.545],
  ].map(([r, y]) => new THREE.Vector2(r, y));
  const g = new THREE.LatheGeometry(pts, 28);
  g.scale(1, 1, 0.64);
  return g;
}

/** a shell covering only the chest, worn over the torso as the armour vest */
function vestGeometry(): THREE.BufferGeometry {
  const pts = [
    [0.15, 1.16],
    [0.186, 1.26],
    [0.214, 1.36],
    [0.222, 1.42],
    [0.206, 1.47],
    [0.165, 1.5],
  ].map(([r, y]) => new THREE.Vector2(r, y));
  const g = new THREE.LatheGeometry(pts, 28);
  g.scale(1, 1, 0.68);
  return g;
}

let torsoGeo: THREE.BufferGeometry | null = null;
let vestGeo: THREE.BufferGeometry | null = null;

// joint, visor and eye materials come from the operator skin (operators.ts)
const seamMat = new THREE.MeshStandardMaterial({ color: 0x15181b, roughness: 0.8 });
const baseMat = new THREE.MeshStandardMaterial({ color: 0x3a4047, roughness: 0.5, metalness: 0.55 });

const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

/**
 * Bake a group of static meshes into one mesh per material. The robot is about
 * sixty primitives, and with thirteen dummies each drawn twice (once for the
 * shadow map) that was over 1,500 draw calls for the dummies alone. Every part
 * is rigid relative to the dummy, so merging loses nothing and leaves about
 * seven draw calls per dummy. `keep` meshes stay separate because they toggle.
 */
function bake(src: THREE.Group, keep: Set<THREE.Object3D>): THREE.Group {
  src.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(src.matrixWorld).invert();
  const byMat = new Map<THREE.Material, THREE.BufferGeometry[]>();
  const out = new THREE.Group();
  src.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    if (keep.has(m)) return;
    const g = (m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone());
    for (const k of Object.keys(g.attributes)) if (k !== "position" && k !== "normal" && k !== "uv") g.deleteAttribute(k);
    g.clearGroups();
    g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld));
    const mat = m.material as THREE.Material;
    const list = byMat.get(mat) ?? [];
    list.push(g);
    byMat.set(mat, list);
  });
  for (const [mat, geos] of byMat) {
    const merged = mergeGeometries(geos, false);
    if (!merged) continue;
    merged.userData.baked = true;
    const mesh = new THREE.Mesh(merged, mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    out.add(mesh);
    for (const g of geos) g.dispose();
  }
  for (const k of keep) {
    k.removeFromParent();
    out.add(k);
  }
  return out;
}

export interface DummyOptions {
  /** a weapon id: the robot holds it at the aim, pointing where it faces */
  armed?: string;
  /** any hit drops it, for the course's pop-up targets */
  oneHit?: boolean;
  /** stand back up after being knocked; false keeps it down until reset */
  respawn?: boolean;
  /** the operator look; the range's own dummies use the default */
  skin?: OperatorSkin;
  /**
   * A figure that moves (another player, a bot, yourself in third person):
   * built as jointed parts that `setPose` animates, about three times the
   * draw calls of a merged range dummy. Range dummies stay merged.
   */
  rig?: boolean;
  /** no plinth: a player's figure stands on the floor */
  noBase?: boolean;
}

/** what a rigged figure is doing, from the player it stands for */
export type FigureStance = "stand" | "crouch" | "slide" | "air" | "climb" | "mantle" | "zip" | "downed";
/** what its hands are busy with: a reload, a swap, a heal, a throw, a melee swing, a revive, or holding interact on something */
export type FigureAct = "reload" | "swap" | "heal" | "throw" | "melee" | "revive" | "interact" | "finish" | "finished" | null;
export interface FigurePose {
  /** horizontal speed, m/s */
  speed: number;
  stance: FigureStance;
  /** look pitch, degrees, up positive */
  pitch: number;
  /** the way it moves, radians from the way it faces: 0 forward, +pi/2 to its right, pi backward */
  moveDir?: number;
  /** 0..1 aiming down sights: the gun comes up to the eye */
  ads?: number;
  /** a reload, a weapon swap, a heal */
  act?: FigureAct;
  /** a heal's item, for what it holds */
  healItem?: string;
}
/**
 * What the hands are doing, as one small number for the network: 0 nothing,
 * 1 reload, 2 swap, 3 throw, 4 melee, 5 revive, 6 interact, 7 finishing
 * someone (finisher.ts), 8 being finished, 10 + a heal's code. A page from before 3 to 6 existed reads them as nothing, so a figure
 * on an old page just does not play the new motion.
 */
const ACT_CODES: FigureAct[] = [null, "reload", "swap", "throw", "melee", "revive", "interact", "finish", "finished"];
export const actCode = (a: FigureAct, healCode = 0): number => (a === "heal" ? 10 + healCode : Math.max(0, ACT_CODES.indexOf(a)));
export const actFromCode = (c: number | undefined): FigureAct => (c !== undefined && c >= 10 ? "heal" : c !== undefined && c > 0 && c < ACT_CODES.length ? ACT_CODES[c] : null);

/** a heal item's colour in the hand: shields blue, health red, the phoenix gold */
const HEAL_COLOUR: Record<string, number> = { cell: 0x3b8bff, battery: 0x3b8bff, syringe: 0xe84a4a, medkit: 0xe84a4a, phoenix: 0xffa000 };
/** the legs turn at most this far from the body toward the way it moves (a strafe) */
const LEG_TURN = 1.25;
/** standing still, the feet stay planted while the body turns, until it has turned this far (radians, 50 degrees); then a step round */
export const TURN_STEP_AT = 0.87;
/** the step round: the feet catch up at this rate (1/s), lifting in turn */
const TURN_STEP_RATE = 11;
const wrapAngle = (a: number): number => Math.atan2(Math.sin(a), Math.cos(a));
const STANCE_CODE: FigureStance[] = ["stand", "crouch", "slide", "air", "climb", "mantle", "zip", "downed"];
/** a stance as one small number for the network, and back */
export const stanceCode = (s: FigureStance): number => Math.max(0, STANCE_CODE.indexOf(s));
export const stanceFromCode = (c: number | undefined): FigureStance => STANCE_CODE[c ?? 0] ?? "stand";

/** the parts a rigged figure pivots */
interface Rig {
  /** at the hips: drops for a crouch or a slide, takes the torso and the legs */
  pelvis: THREE.Group;
  torso: THREE.Group;
  head: THREE.Group;
  /** both arms and the gun, pivoting at the chest: raised for a climb */
  arms: THREE.Group;
  /** the unarmed arms swing separately */
  armL: THREE.Group | null;
  armR: THREE.Group | null;
  thighL: THREE.Group;
  shinL: THREE.Group;
  thighR: THREE.Group;
  shinR: THREE.Group;
}
const PELVIS_Y = 0.9;
/** the arms turn about the chest: a rigged figure's gun sits in that frame */
const CHEST_Y = 1.44;

/**
 * Bake `meshes` (built in figure space) into one merged mesh per material,
 * translated so `pivot` is the group's origin, so the group rotates about it.
 * `keep` meshes are re-parented as they are (they toggle or change colour).
 */
function bakePart(meshes: THREE.Object3D[], pivot: THREE.Vector3, keep: Set<THREE.Object3D>): THREE.Group {
  const src = new THREE.Group();
  for (const m of meshes) src.add(m);
  const out = bake(src, keep);
  for (const o of out.children) {
    if (keep.has(o)) o.position.sub(pivot);
    else (o as THREE.Mesh).geometry.translate(-pivot.x, -pivot.y, -pivot.z);
  }
  out.position.copy(pivot);
  return out;
}


/** the contact shadow's disc and its soft dark falloff, made once and shared by every figure */
let cGeo: THREE.PlaneGeometry | null = null;
let cMat: THREE.MeshBasicMaterial | null = null;
function contactGeo(): THREE.PlaneGeometry {
  return (cGeo ??= new THREE.PlaneGeometry(1.1, 1.1));
}
function contactMat(): THREE.MeshBasicMaterial {
  if (cMat) return cMat;
  let map: THREE.Texture | null = null;
  if (typeof document !== "undefined") {
    const c = document.createElement("canvas");
    c.width = c.height = 64;
    const g = c.getContext("2d");
    if (g) {
      const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      grad.addColorStop(0, "rgba(0,0,0,1)");
      grad.addColorStop(0.5, "rgba(0,0,0,0.55)");
      grad.addColorStop(1, "rgba(0,0,0,0)");
      g.fillStyle = grad;
      g.fillRect(0, 0, 64, 64);
      map = new THREE.CanvasTexture(c);
    }
  }
  cMat = new THREE.MeshBasicMaterial({ map, color: 0x000000, transparent: true, opacity: 0.6, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
  return cMat;
}
export class Dummy {
  readonly group = new THREE.Group();
  readonly hitMeshes: THREE.Mesh[] = [];
  health = HEALTH_MAX;
  shield = 0;
  shieldMax = 0;
  /** a shield that is this whatever the armour tier (SpeedKills' one shield); null: the tier's */
  shieldCap: number | null = null;
  tier: ArmorTier = 0;
  knocked = false;
  /** time of the FIRST hit on this dummy since it was last full, or null */
  engagedAt: number | null = null;
  /** if set, this dummy tracks left and right along a rail */
  rail: { z: number; minX: number; maxX: number; speed: number } | null = null;
  private railDir = 1;
  private respawnAt = 0;
  private fall = 0;
  private flash = 0;
  private headFlash = 0;
  /** a leg hit flashes blue: the flash's colour says which zone you hit */
  private legFlash = 0;
  /** 0..1 rising from the ground after a pop-up; 1 when upright */
  private rise = 1;
  /** 0..1 Digital Threat highlight */
  private threat = 0;
  readonly oneHit: boolean;
  readonly respawns: boolean;
  private readonly plate: THREE.Mesh;
  private readonly shell: THREE.MeshStandardMaterial;
  private readonly headShell: THREE.MeshStandardMaterial;
  private readonly accent: THREE.MeshStandardMaterial;
  private readonly vest: THREE.Mesh;
  private readonly vestMat: THREE.MeshStandardMaterial;
  private readonly ringMat: THREE.MeshStandardMaterial;
  /** the merged robot body: its geometry is this dummy's own (every part, rigged) */
  private readonly baked: THREE.Group;
  private readonly rig: Rig | null = null;
  /** the hit zones, scaled down for a crouch */
  private readonly hits = new THREE.Group();
  private crouchAmt = 0;
  private pose: FigurePose = { speed: 0, stance: "stand", pitch: 0 };
  private gait = 0;
  /** eased pose values, so a change of stance blends rather than snaps */
  private readonly eased = { lean: 0, pelvisDrop: 0, thighL: 0, thighR: 0, shinL: 0, shinR: 0, armsUp: 0, armSwing: 0, headPitch: 0, legYaw: 0, ads: 0, reload: 0, swap: 0, heal: 0, down: 0, sprint: 0 };
  /** the feet's yaw while standing still (world, radians), and a step round in progress */
  private plantYaw: number | null = null;
  private stepping = false;
  private stepT = 0;
  /** a landing's squash (1 on touchdown, decaying) and how long it was in the air */
  private landAmt = 0;
  private airT = 0;
  private lastStance: FigureStance = "stand";
  /** the idle's breathing clock (also the clock the stagger is timed on) */
  private idleT = 0;
  /** when its shield last broke, on idleT's clock (the mannequin staggers) */
  private staggerAt = -Infinity;
  /** when the head was last hit, on the figure's clock */
  private headAt = -Infinity;
  /** short-lived motions: a shot's kick, a hit's flinch, a JOLT's lean (1 at their start, decaying) */
  private kickAmt = 0;
  private flinchAmt = 0;
  private joltAmt = 0;
  /** the arms' resting place on the torso (the ADS and the kick move them from it) */
  private armsBase = new THREE.Vector3();
  /** the heal item in its hands, made the first time it heals */
  private healMesh: THREE.Mesh | null = null;
  /** its gun is away for a heal, or it is down (separate from a bot's gun hidden while it searches) */
  private gunAway = false;
  /**
   * Knocked out: the gun leaves its hands and falls to the floor beside it,
   * a copy in the world (the held one hides) that tumbles, lands and lies
   * there until the figure is back up. Nobody holds a gun lying down.
   */
  private dropped: { obj: THREE.Object3D; vel: THREE.Vector3; spin: THREE.Vector3; floor: number; still: boolean } | null = null;
  /** a dropped gun's first touch of the floor (the game plays the clatter) */
  static onGunLands: ((at: THREE.Vector3) => void) | null = null;
  private gunShown = true;
  /** the motion-captured mannequin in place of the robot (mannequin.ts, a setting) */
  private mq: MannequinFigure | null = null;
  readonly distanceLabel: number;
  /** the operator this figure wears */
  readonly skin: OperatorSkin;
  /** the gun it holds, if armed */
  private gun: THREE.Object3D | null = null;
  /** the weapon in its hands, by id (figure LOD swaps in the merged mesh of it at distance) */
  private armedWith: string | null = null;
  /** the finish its gun wears (another player's, from their page): kept across a change of gun */
  private finish: Finish | null = null;

  /**
   * A soft dark disc at every figure's feet, on the presets whose shadow map
   * is drawn once (Competitive, Balanced): there a moving figure casts
   * nothing and reads as floating over the floor. main.ts turns it on for
   * those and off where shadows are live.
   */
  static contactShadows = false;
  private contact: THREE.Mesh | null = null;

  constructor(x: number, z: number, distanceLabel: number, opts: DummyOptions = {}) {
    this.distanceLabel = distanceLabel;
    if (Dummy.contactShadows) {
      this.contact = new THREE.Mesh(contactGeo(), contactMat());
      this.contact.rotation.x = -Math.PI / 2;
      this.contact.position.y = 0.02;
      this.contact.renderOrder = -1;
      this.group.add(this.contact);
    }
    this.oneHit = opts.oneHit ?? false;
    this.respawns = opts.respawn ?? true;
    // Yaw first, then the fall, so an armed dummy turned to face you falls
    // away from you rather than along the world axis.
    this.group.rotation.order = "YXZ";
    const armed = opts.armed ?? null;
    this.armedWith = armed;
    const skin = opts.skin ?? OPERATORS[0];
    this.skin = skin;
    const { joint: jointMat, visor: visorMat, eye: eyeMat } = skinMaterials(skin);

    // ---------------- hit zones: unchanged dimensions, invisible
    // legs: 0..0.92 m
    const legs = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.92, 0.3), HITBOX);
    legs.position.y = 0.46;
    legs.userData.zone = "legs";
    // torso: 0.92..1.55 m. The top must reach the head sphere's bottom
    // (1.5488) or a round through the neck registers no hit at all.
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.63, 0.32), HITBOX);
    torso.position.y = 1.235;
    torso.userData.zone = "body";
    const armL = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.6, 0.14), HITBOX);
    armL.position.set(-0.33, 1.2, 0);
    armL.userData.zone = "body";
    const armR = armL.clone();
    armR.position.x = 0.33;
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 0.1, 10), HITBOX);
    neck.position.y = 1.58;
    neck.userData.zone = "body";
    // head: sphere r 0.13 at 1.68 m (total ~1.83 m)
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.13, 20, 14), HITBOX);
    head.position.y = H - 0.15;
    head.userData.zone = "head";
    // armour plate: visibility still switches it off at tier 0
    this.plate = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.34, 0.06), HITBOX);
    this.plate.position.set(0, 1.28, 0.19);
    this.plate.userData.zone = "body";
    for (const m of [legs, torso, armL, armR, neck, head, this.plate]) {
      m.castShadow = false;
      this.hits.add(m);
      this.hitMeshes.push(m);
    }
    this.group.add(this.hits);

    // ---------------- the visible robot
    // Per-dummy shell materials, so a hit can flash just this one.
    // Light grey, not white. At 0xc3c9cf in full sun the shell clipped to a
    // flat white silhouette and lost all its shading, which is the one thing
    // that makes a rounded form read as rounded.
    this.shell = new THREE.MeshStandardMaterial({ color: skin.shell, roughness: 0.48, metalness: 0.08 });
    this.headShell = new THREE.MeshStandardMaterial({ color: skin.head, roughness: 0.4, metalness: 0.08 });
    this.accent = new THREE.MeshStandardMaterial({ color: skin.accent, roughness: 0.55, metalness: 0.1 });
    this.vestMat = new THREE.MeshStandardMaterial({ color: ARMOR_COLOR[1], roughness: 0.35, metalness: 0.3, emissive: ARMOR_COLOR[1], emissiveIntensity: 0.25 });
    const S = this.shell;
    const A = this.accent;
    // Every piece is built in figure space (origin at the feet) and sorted
    // into the part it belongs to. A merged dummy bakes all the parts into
    // one body; a rigged one bakes each part about its own pivot.
    const P = { head: [] as THREE.Object3D[], torso: [] as THREE.Object3D[], armL: [] as THREE.Object3D[], armR: [] as THREE.Object3D[], thighL: [] as THREE.Object3D[], shinL: [] as THREE.Object3D[], thighR: [] as THREE.Object3D[], shinR: [] as THREE.Object3D[] };

    // head: a slightly tall ovoid with a wraparound visor and a lit eye strip
    const headY = H - 0.15;
    const skull = new THREE.Mesh(new THREE.SphereGeometry(0.118, 28, 20), this.headShell);
    skull.scale.set(1, 1.1, 1.02);
    skull.position.y = headY;
    P.head.push(skull);
    const visor = new THREE.Mesh(new THREE.SphereGeometry(0.1215, 28, 8, Math.PI / 2 - 0.95, 1.9, Math.PI / 2 - 0.32, 0.46), visorMat);
    visor.scale.set(1, 1.1, 1.02);
    visor.position.y = headY;
    P.head.push(visor);
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.1222, 28, 3, Math.PI / 2 - 0.7, 1.4, Math.PI / 2 - 0.13, 0.05), eyeMat);
    eye.scale.set(1, 1.1, 1.02);
    eye.position.y = headY;
    P.head.push(eye);
    for (const sx of [-1, 1]) {
      const pod = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.04, 0.03, 18), A);
      pod.rotation.z = Math.PI / 2;
      pod.position.set(sx * 0.118, headY + 0.005, -0.005);
      P.head.push(pod);
    }
    // neck: a ribbed joint
    P.torso.push(limb(v(0, 1.5, 0), v(0, 1.585, 0), 0.05, jointMat));
    for (const y of [1.52, 1.55]) {
      const rib = new THREE.Mesh(new THREE.TorusGeometry(0.052, 0.006, 6, 18), seamMat);
      rib.rotation.x = Math.PI / 2;
      rib.position.y = y;
      P.torso.push(rib);
    }

    // torso, waist joint and pelvis
    torsoGeo ??= torsoGeometry();
    P.torso.push(new THREE.Mesh(torsoGeo, S));
    const waist = new THREE.Mesh(new THREE.CylinderGeometry(0.128, 0.138, 0.06, 24), jointMat);
    waist.scale.z = 0.68;
    waist.position.y = 1.06;
    P.torso.push(waist);
    const pelvis = new THREE.Mesh(new THREE.SphereGeometry(0.165, 24, 14, 0, Math.PI * 2, Math.PI / 2 - 0.2, Math.PI / 2), S);
    pelvis.scale.set(1, 0.9, 0.66);
    pelvis.position.y = 0.99;
    P.torso.push(pelvis);
    // chest panel with a status light, and a seam down the sternum
    const panel = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.12, 0.02), A);
    panel.position.set(0, 1.34, 0.13);
    panel.rotation.x = -0.12;
    P.torso.push(panel);
    const light = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.012, 0.01), eyeMat);
    light.position.set(0.05, 1.37, 0.142);
    light.rotation.x = -0.12;
    P.torso.push(light);
    const seam = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.2, 0.01), seamMat);
    seam.position.set(0, 1.18, 0.105);
    P.torso.push(seam);
    // armour vest in the tier colour
    vestGeo ??= vestGeometry();
    this.vest = new THREE.Mesh(vestGeo, this.vestMat);
    P.torso.push(this.vest);

    // arms, hanging slightly out from the body so they sit inside the arm zones
    for (const sx of [-1, 1]) {
      const arm = sx < 0 ? P.armL : P.armR;
      const sh = v(sx * 0.225, 1.44, 0);
      // Armed: both arms forward to the gun, right hand on the grip and the
      // left supporting it. Unarmed: hanging slightly out from the body.
      const el = armed ? v(sx * 0.21, 1.3, 0.22) : v(sx * 0.3, 1.17, 0.01);
      const wr = armed ? (sx > 0 ? v(0.07, 1.36, 0.43) : v(-0.01, 1.34, 0.47)) : v(sx * 0.32, 0.93, 0.03);
      const pad = new THREE.Mesh(new THREE.SphereGeometry(0.078, 18, 12), S);
      pad.scale.set(1, 0.85, 0.95);
      pad.position.copy(sh);
      P.torso.push(pad);
      const band = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.008, 6, 18), A);
      band.position.set(sh.x, sh.y - 0.04, sh.z);
      band.rotation.x = Math.PI / 2;
      P.torso.push(band);
      arm.push(limb(sh, el, 0.046, S));
      arm.push(ball(el, 0.045, jointMat));
      arm.push(limb(el, wr, 0.04, S));
      const hand = new THREE.Mesh(new THREE.CapsuleGeometry(0.03, 0.05, 4, 10), jointMat);
      hand.scale.set(0.75, 1, 1);
      if (armed) hand.position.set(wr.x, wr.y - 0.03, wr.z + 0.02);
      else hand.position.set(wr.x + sx * 0.004, wr.y - 0.07, wr.z);
      arm.push(hand);
    }

    // legs
    for (const sx of [-1, 1]) {
      const thigh = sx < 0 ? P.thighL : P.thighR;
      const shin = sx < 0 ? P.shinL : P.shinR;
      const hip = v(sx * 0.098, PELVIS_Y, 0);
      const knee = v(sx * 0.108, 0.49, 0.012);
      const ankle = v(sx * 0.108, 0.1, 0);
      thigh.push(ball(hip, 0.066, jointMat));
      thigh.push(limb(hip, knee, 0.07, S));
      shin.push(ball(knee, 0.056, jointMat));
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.042, 14, 10), A);
      cap.scale.set(1, 1.2, 0.6);
      cap.position.set(knee.x, knee.y, knee.z + 0.045);
      shin.push(cap);
      shin.push(limb(knee, ankle, 0.056, S));
      shin.push(ball(ankle, 0.042, jointMat));
      const foot = new THREE.Mesh(new THREE.CapsuleGeometry(0.042, 0.13, 4, 10), jointMat);
      foot.rotation.x = Math.PI / 2;
      foot.scale.set(1.1, 1, 0.75);
      foot.position.set(ankle.x, 0.035, 0.03);
      shin.push(foot);
    }

    // The operator's kit (src/game/gear.ts), the same pieces the mannequin
    // wears, dropped into the parts they belong to. The robot's own parts are
    // built in the figure's space rather than a bone's, so each piece is moved
    // to the anchor its bone would have been at.
    {
      const anchor: Record<string, { at: THREE.Vector3; into: THREE.Object3D[]; flip?: boolean }> = {
        Head: { at: v(0, H - 0.15, 0), into: P.head },
        spine_03: { at: v(0, CHEST_Y - 0.05, 0), into: P.torso },
        pelvis: { at: v(0, PELVIS_Y, 0), into: P.torso },
        upperarm_r: { at: v(0.235, 1.45, 0), into: P.armR },
        upperarm_l: { at: v(-0.235, 1.45, 0), into: P.armL },
        thigh_r: { at: v(0.098, PELVIS_Y, 0), into: P.thighR },
        thigh_l: { at: v(-0.098, PELVIS_Y, 0), into: P.thighL },
        calf_r: { at: v(0.108, 0.49, 0), into: P.shinR },
        calf_l: { at: v(-0.108, 0.49, 0), into: P.shinL },
      };
      for (const piece of buildGear(skin)) {
        const a = anchor[piece.bone];
        if (!a) continue;
        piece.group.position.add(a.at);
        a.into.push(piece.group);
      }
    }

    // the robot's own add-ons, which are its and not a person's kit
    const ex = skin.extras;
    if (ex.crest) {
      const crest = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.09, 0.2), A);
      crest.position.set(0, headY + 0.13, -0.01);
      crest.rotation.x = -0.25;
      P.head.push(crest);
    }
    if (ex.antenna) {
      P.head.push(limb(v(0.07, headY + 0.08, 0.02), v(0.1, headY + 0.34, -0.03), 0.006, jointMat));
      P.head.push(ball(v(0.1, headY + 0.35, -0.03), 0.016, eyeMat));
    }
    if (ex.brim) {
      const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.012, 28), A);
      brim.position.set(0, headY + 0.07, 0);
      P.head.push(brim);
      const hood = new THREE.Mesh(new THREE.SphereGeometry(0.13, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), A);
      hood.scale.set(1, 0.8, 1);
      hood.position.set(0, headY + 0.07, 0);
      P.head.push(hood);
    }
    if (ex.mask) {
      const mask = new THREE.Mesh(new THREE.SphereGeometry(0.124, 20, 8, Math.PI / 2 - 0.9, 1.8, Math.PI / 2 + 0.15, 0.55), A);
      mask.scale.set(1, 1.1, 1.05);
      mask.position.y = headY;
      P.head.push(mask);
    }
    if (ex.shoulders) {
      for (const sx of [-1, 1]) {
        const plate = new THREE.Mesh(new THREE.SphereGeometry(0.11, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), A);
        plate.scale.set(1.05, 0.75, 1.1);
        plate.position.set(sx * 0.235, 1.45, 0);
        plate.rotation.z = sx * -0.35;
        P.torso.push(plate);
      }
    }

    // The gun, pointing the way the robot faces (+z). Model space has the
    // muzzle down -z, so it turns half round, and it is placed so its grip
    // lands in the right hand.
    let gun: THREE.Object3D | null = null;
    if (armed) {
      // an untouched copy: the viewmodel's own gun carries your optic, your
      // magazine colour and a bolt caught mid-cycle
      const m = displayGunModel(armed);
      gun = m.root.clone(true);
      gun.traverse((o) => {
        if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).castShadow = true;
      });
      this.flashSprite = fitMuzzle(gun, ammoTypeOf(armed) === "energy", m.muzzle);
      gun.rotation.y = Math.PI;
      gun.position.set(0.07, 1.33 - m.grip.u, 0.45 - m.grip.f);
      this.gun = gun;
    }

    this.vest.castShadow = true;
    const keep = new Set<THREE.Object3D>([this.vest]);
    if (opts.rig) {
      // pivots: the pelvis at the hips, the torso on it, the head at the neck,
      // the arms at the chest (with the gun, which the hands hold), each
      // thigh at its hip and each shin at its knee
      const pelvisG = new THREE.Group();
      pelvisG.position.y = PELVIS_Y;
      const torso = bakePart(P.torso, v(0, PELVIS_Y, 0), keep);
      torso.position.set(0, 0, 0);
      const head = bakePart(P.head, v(0, 1.58, 0), keep);
      head.position.set(0, 1.58 - PELVIS_Y, 0);
      const chest = v(0, CHEST_Y, 0);
      const arms = new THREE.Group();
      arms.position.set(0, chest.y - PELVIS_Y, 0);
      this.armsBase.copy(arms.position);
      // the torso turns back against the hips (a strafe), then leans
      torso.rotation.order = "YXZ";
      let armL: THREE.Group | null = null;
      let armR: THREE.Group | null = null;
      if (armed) {
        const both = bakePart([...P.armL, ...P.armR], chest, keep);
        both.position.set(0, 0, 0);
        arms.add(both);
        if (gun) {
          gun.position.sub(chest);
          arms.add(gun);
        }
      } else {
        armL = bakePart(P.armL, v(-0.225, 1.44, 0), keep);
        armL.position.set(-0.225, 0, 0);
        armR = bakePart(P.armR, v(0.225, 1.44, 0), keep);
        armR.position.set(0.225, 0, 0);
        arms.add(armL, armR);
      }
      const leg = (thighParts: THREE.Object3D[], shinParts: THREE.Object3D[], sx: number) => {
        const thigh = bakePart(thighParts, v(sx * 0.098, PELVIS_Y, 0), keep);
        thigh.position.set(sx * 0.098, 0, 0);
        const shin = bakePart(shinParts, v(sx * 0.108, 0.49, 0.012), keep);
        shin.position.set(sx * 0.01, 0.49 - PELVIS_Y, 0.012);
        thigh.add(shin);
        return { thigh, shin };
      };
      const L = leg(P.thighL, P.shinL, -1);
      const R = leg(P.thighR, P.shinR, 1);
      torso.add(head, arms);
      pelvisG.add(torso, L.thigh, R.thigh);
      // only the torso and head throw a shadow: half the draw calls of a rig
      for (const part of [L.thigh, L.shin, R.thigh, R.shin, arms]) part.traverse((o) => ((o as THREE.Mesh).isMesh ? ((o as THREE.Mesh).castShadow = false) : undefined));
      this.baked = pelvisG;
      this.rig = { pelvis: pelvisG, torso, head, arms, armL, armR, thighL: L.thigh, shinL: L.shin, thighR: R.thigh, shinR: R.shin };
      this.group.add(pelvisG);
      // the mannequin instead, when Settings says so and it has loaded: the
      // robot's parts stay (hidden) and still take the pose, so nothing else changes
      if (useMannequin()) {
        this.mq = new MannequinFigure(skin, armed);
        pelvisG.visible = false;
        this.group.add(this.mq.root);
      }
    } else {
      const b = new THREE.Group();
      for (const list of Object.values(P)) for (const o of list) b.add(o);
      this.baked = bake(b, keep);
      this.group.add(this.baked);
      if (gun) this.group.add(gun);
    }

    // base plinth with a lit ring in the armour colour
    this.ringMat = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0x39d7ee, emissiveIntensity: 1.8 });
    if (!opts.noBase) {
      const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.4, 0.05, 32), baseMat);
      ring.position.y = 0.025;
      ring.receiveShadow = true;
      this.group.add(ring);
      const glow = new THREE.Mesh(new THREE.TorusGeometry(0.37, 0.008, 6, 40), this.ringMat);
      glow.rotation.x = Math.PI / 2;
      glow.position.y = 0.05;
      this.group.add(glow);
    }

    this.group.position.set(x, 0, z);
    this.setTier(0);
  }

  setTier(t: ArmorTier): void {
    this.tier = t;
    this.shieldMax = this.shieldCap ?? ARMOR_SHIELD[t];
    this.shield = this.shieldMax;
    this.health = this.oneHit ? 1 : HEALTH_MAX;
    this.plate.visible = t !== 0;
    this.vest.visible = t !== 0;
    this.mq?.setArmorColour(t !== 0 ? ARMOR_COLOR[t] : null);
    if (t !== 0) {
      this.vestMat.color.setHex(ARMOR_COLOR[t]);
      this.vestMat.emissive.setHex(ARMOR_COLOR[t]);
      this.ringMat.emissive.setHex(ARMOR_COLOR[t]);
    } else {
      this.ringMat.emissive.setHex(0x39d7ee);
    }
    this.engagedAt = null;
  }

  /** course pop-up: appear lying down and swing upright */
  popUp(): void {
    this.setTier(this.tier);
    this.knocked = false;
    this.fall = 0;
    this.rise = 0;
    this.group.visible = true;
    this.group.rotation.x = -Math.PI / 2 + 0.2;
  }

  /** course reset: gone, and not hittable (hidden groups are skipped) */
  hide(): void {
    this.dropped?.obj.removeFromParent();
    this.dropped = null;
    this.setTier(this.tier);
    this.knocked = false;
    this.fall = 0;
    this.rise = 1;
    this.group.visible = false;
    this.group.rotation.x = 0;
  }

  /**
   * Seen through a Digital Threat optic: the shell glows red. 0 is off; the
   * caller fades it with distance, as the data's fade range says.
   */
  setThreat(amount: number): void {
    if (Math.abs(amount - this.threat) < 0.01) return;
    this.threat = amount;
    this.applyGlow();
  }

  /**
   * Shell emissive: the hit flash, plus the threat highlight. The highlight
   * also darkens the grey shell, or red light on top of light grey paint
   * reads pink rather than the solid red a threat optic shows.
   */
  private applyGlow(): void {
    const t = this.threat;
    const f = this.flash * 0.9;
    const lf = this.legFlash;
    // Kept under 1: filmic tone mapping pushes a brighter red toward orange.
    this.shell.color.setHex(this.skin.shell).multiplyScalar(1 - 0.9 * t);
    this.headShell.color.setHex(this.skin.head).multiplyScalar(1 - 0.9 * t);
    this.shell.emissive.setRGB(f + t * 0.95 + lf * 0.1, f + t * 0.02 + lf * 0.45, f + t * 0.02 + lf * 1.1);
    this.mq?.setFlash(Math.max(this.flash, this.headFlash, this.legFlash) * 0.8, this.headFlash > this.flash);
    this.headShell.emissive.setRGB(this.headFlash * 1.6 + t * 0.95, this.headFlash * 1.1 + t * 0.02, this.headFlash * 0.2 + t * 0.02);
  }

  /**
   * Free what this figure alone owns: its merged body, hit boxes and its own
   * materials. The vest shape, the gun (it shares the gun model's geometry) and
   * the skin materials are shared, and stay. For figures that are replaced
   * while playing, like the 1v1 opponent's.
   */
  dispose(): void {
    if (this.kdPane) {
      this.kdPane.geometry.dispose();
      (this.kdPane.material as THREE.Material).dispose();
    }
    this.dropped?.obj.removeFromParent();
    this.dropped = null;
    this.mq?.dispose();
    if (this.healMesh) {
      this.healMesh.geometry.dispose();
      (this.healMesh.material as THREE.Material).dispose();
    }
    this.group.removeFromParent();
    this.baked.traverse((o) => {
      const m = o as THREE.Mesh;
      // the gun's geometry is the gun model's, shared; a baked part's is this figure's own
      if (m.isMesh && m !== this.vest && !m.name.startsWith("gun") && m.geometry.userData.baked) m.geometry.dispose();
    });
    for (const m of this.hitMeshes) m.geometry.dispose();
    for (const mat of [this.shell, this.headShell, this.accent, this.vestMat, this.ringMat]) mat.dispose();
  }

  /** a rigged figure: what it should be doing, from the player or bot it stands for */
  /**
   * Being finished on this page (main.ts): whatever the network or a bot's
   * own code says the figure is doing, it takes the blow. The one finishing
   * says so in its own state, but the one finished does not know yet.
   */
  finishing = false;

  setPose(p: FigurePose): void {
    this.pose = this.finishing ? { ...p, act: "finished" } : p;
  }

  /** an emote playing (emotes.ts): which, and how far in */
  private emoteIndex: number | null = null;
  private emoteT = 0;
  /** the gun this figure put away for an emote, to bring back after */
  private emoteHidGun = false;

  /** play an emote (null, or past the list: stop); it runs its length unless the figure moves */
  emote(index: number | null): void {
    this.emoteIndex = emoteAt(index) ? index : null;
    this.emoteT = 0;
  }

  /** the emote playing, or null (the tests, and the page's own figure) */
  get emoting(): number | null {
    return this.emoteIndex;
  }

  /** the finish its gun wears, or none */
  get finishId(): string {
    return this.finish?.id ?? "factory";
  }

  /** its gun in a finish (another player's own), now and after any change of gun */
  setFinish(f: Finish | null): void {
    this.finish = f;
    this.paintGuns();
  }

  private paintGuns(): void {
    if (this.gun) applyFinishTo(this.gun, this.finish);
    const mg = this.mq?.gunRoot;
    if (mg) applyFinishTo(mg, this.finish);
  }

  /** a different gun in its hands (Gun Run's next level): the same grip, the new model */
  setGun(id: string): void {
    this.mq?.setGun(id);
    this.armedWith = id;
    // the merged one belonged to the gun before it
    this.farGun?.removeFromParent();
    this.farGun = null;
    this.lodFullGun = true;
    const old = this.gun;
    const parent = old?.parent;
    if (!old || !parent) {
      this.paintGuns();
      return;
    }
    const m = displayGunModel(id);
    const gun = m.root.clone(true);
    gun.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).castShadow = true;
    });
    this.flashSprite = fitMuzzle(gun, ammoTypeOf(id) === "energy", m.muzzle);
    gun.rotation.copy(old.rotation);
    // where the grip goes, in the arms' frame (the chest) for a rigged figure
    gun.position.set(0.07, 1.33 - m.grip.u, 0.45 - m.grip.f);
    if (parent !== this.group) gun.position.y -= CHEST_Y;
    gun.visible = old.visible;
    parent.add(gun);
    old.removeFromParent();
    this.gun = gun;
    this.paintGuns();
  }

  /** show or hide the gun it holds (a bot still searching for one) */
  setGunVisible(on: boolean): void {
    this.gunShown = on;
    if (this.gun) this.gun.visible = on && !this.gunAway && !(this.knocked && this.rig);
    this.mq?.setGunVisible(on);
  }

  /** a shot: the gun kicks back into the shoulder, and its muzzle flashes */
  kick(): void {
    this.kickAmt = 1;
    this.flashLeft = MUZZLE.life;
    this.flashSpin = Math.random() * Math.PI * 2;
  }

  /** the robot gun's muzzle flash (the mannequin's is its own), and how long it has left lit */
  private flashSprite: THREE.Sprite | null = null;

  /** the muzzle of the gun this figure shows, in the world: where its tracers start (null with no gun) */
  muzzleWorld(): THREE.Vector3 | null {
    // the marker on whichever gun is being shown, not the flash sprite on it:
    // the muzzle is a place, and the flash is a picture that may not have been
    // drawn (a check with no browser under it) or may be out between shots
    for (const m of [muzzleOf(this.mq?.gunRoot ?? null), muzzleOf(this.gun)]) {
      if (!m) continue;
      let shown = true;
      for (let o: THREE.Object3D | null = m; o; o = o.parent) if (!o.visible) shown = false;
      if (!shown) continue;
      m.updateWorldMatrix(true, false);
      return m.getWorldPosition(new THREE.Vector3());
    }
    return null;
  }
  private flashLeft = 0;
  private flashSpin = 0;
  /** frames drawn with a flash lit (the suite counts them: a flash lasts two) */
  flashFrames = 0;

  /** is a muzzle flash lit on this figure now (the suite reads it) */
  get flashShown(): boolean {
    return [this.flashSprite, this.mq?.flash ?? null].some((s) => !!s && s.visible);
  }

  /** a JOLT: a lean into the dash */
  jolt(): void {
    this.joltAmt = 1;
  }

  /** what it was last told to do (the killcam records it) */
  get currentPose(): FigurePose {
    return this.pose;
  }

  /** 0..1 crouched, eased inside update(): the hit zones shrink to two thirds */
  get crouchAmount(): number {
    return this.crouchAmt;
  }

  /** the pose targets for the stance, then eased onto the joints */
  private animate(dt: number): void {
    const r = this.rig;
    if (!r) return;
    const p = this.pose;
    const speed = Math.max(0, p.speed);
    const frac = Math.min(1, speed / 6.6);
    // a step every 0.8 m, a full cycle every two steps
    this.gait += dt * (speed / 0.8) * Math.PI;
    const g = this.gait;
    const s = Math.sin(g);
    const s2 = Math.sin(g + Math.PI);
    let lean = 0;
    let drop = 0;
    let thighBase = 0;
    let shinBase = 0;
    let amp = 0;
    let armsUp = 0;
    let armSwing = 0;
    let thighL = 0;
    let thighR = 0;
    let shinL = 0;
    let shinR = 0;
    // the way it moves against the way it faces: the legs turn toward a strafe,
    // and walking backward runs the stride backward, the body still on its aim
    const dir = p.moveDir ?? 0;
    const moving = speed > 0.3 && (p.stance === "stand" || p.stance === "crouch");
    const back = moving && Math.abs(dir) > 1.9;
    let legYaw = 0;
    if (moving) {
      const d = back ? Math.atan2(Math.sin(dir - Math.PI), Math.cos(dir - Math.PI)) : dir;
      // figure space turns the other way: +x is its left
      legYaw = -Math.max(-LEG_TURN, Math.min(LEG_TURN, d));
      if (back) this.gait -= 2 * dt * (speed / 0.8) * Math.PI;
    }
    // in the air, and the landing: a squash as big as the fall was long
    if (p.stance === "air") this.airT += dt;
    else {
      if (this.lastStance === "air" && this.airT > 0.12) this.landAmt = Math.min(1, 0.35 + this.airT * 0.9);
      this.airT = 0;
    }
    this.lastStance = p.stance;
    this.landAmt = Math.max(0, this.landAmt - dt * 4);
    this.idleT += dt;
    switch (p.stance) {
      case "stand":
        lean = 0.12 * frac;
        amp = speed < 0.3 ? 0 : 0.45 + 0.45 * frac;
        armSwing = amp * 0.55;
        break;
      case "crouch":
        lean = 0.55;
        drop = 0.34;
        thighBase = 1.2;
        shinBase = -1.6;
        amp = speed < 0.3 ? 0 : 0.3;
        break;
      case "slide":
        lean = -0.35;
        drop = 0.45;
        thighBase = 1.3;
        shinBase = -0.15;
        armsUp = 0.25;
        break;
      case "air": {
        // the takeoff tucks both knees up; then one leg leads, the other trails
        const tuck = Math.max(0, 1 - this.airT / 0.25);
        lean = 0.05;
        drop = 0.05;
        thighL = 0.5 + 0.35 * tuck;
        thighR = -0.25 + 0.75 * tuck;
        shinL = -0.9 - 0.3 * tuck;
        shinR = -0.5 - 0.6 * tuck;
        break;
      }
      case "climb":
        lean = -0.1;
        drop = 0.05;
        armsUp = 1.4;
        this.gait += dt * 2.2 * Math.PI;
        thighL = 0.35 + s * 0.45;
        thighR = 0.35 + s2 * 0.45;
        shinL = shinR = -0.9;
        break;
      case "mantle":
        lean = 0.3;
        drop = 0.15;
        armsUp = 1.0;
        thighL = thighR = 1.0;
        shinL = shinR = -1.2;
        break;
      case "zip":
        lean = 0.1;
        drop = 0.02;
        armsUp = 1.5;
        thighL = thighR = 0.3;
        shinL = shinR = -0.6;
        break;
      case "downed":
        // down, not out: on the knees and the hands, no gun, crawling; the
        // arms reach in turn against the legs, the head up to see. Low: a
        // knock at 30 m must not read as a live player crouching.
        lean = 1.3;
        drop = 0.7;
        armsUp = -0.15;
        armSwing = 0.45 * Math.max(0.35, frac);
        thighL = 0.25 + s * 0.35 * frac;
        thighR = 0.25 + s2 * 0.35 * frac;
        shinL = shinR = -0.4;
        break;
    }
    if (p.stance === "stand" || p.stance === "crouch") {
      thighL = thighBase + s * amp;
      thighR = thighBase + s2 * amp;
      // the knee bends as the leg comes through
      shinL = shinBase - Math.max(0, Math.sin(g + 1.2)) * amp * 1.1;
      shinR = shinBase - Math.max(0, Math.sin(g + Math.PI + 1.2)) * amp * 1.1;
    }
    // turning on the spot: the feet stay where they are while the body turns
    // on its aim, then step round to catch up (and lift in turn as they do)
    const facing = this.group.rotation.y;
    const still = speed <= 0.3 && (p.stance === "stand" || p.stance === "crouch");
    if (!still || this.plantYaw === null) {
      this.plantYaw = facing;
      this.stepping = false;
    } else {
      if (!this.stepping && Math.abs(wrapAngle(this.plantYaw - facing)) > TURN_STEP_AT) {
        this.stepping = true;
        this.stepT = 0;
      }
      if (this.stepping) {
        this.stepT += dt;
        this.plantYaw += wrapAngle(facing - this.plantYaw) * Math.min(1, dt * TURN_STEP_RATE);
        const lift = Math.sin(Math.min(1, this.stepT / 0.3) * Math.PI);
        thighL += 0.45 * lift * (this.stepT < 0.15 ? 1 : 0.3);
        shinL -= 0.7 * lift * (this.stepT < 0.15 ? 1 : 0.3);
        thighR += 0.45 * lift * (this.stepT >= 0.15 ? 1 : 0.3);
        shinR -= 0.7 * lift * (this.stepT >= 0.15 ? 1 : 0.3);
        if (Math.abs(wrapAngle(this.plantYaw - facing)) < 0.03 || this.stepT > 0.5) {
          this.plantYaw = facing;
          this.stepping = false;
        }
      }
    }
    const plant = wrapAngle((this.plantYaw ?? facing) - facing);
    // the landing's squash on top of whatever the legs are doing
    if (this.landAmt > 0) {
      drop += 0.16 * this.landAmt;
      lean += 0.18 * this.landAmt;
      thighL += 0.6 * this.landAmt;
      thighR += 0.6 * this.landAmt;
      shinL -= 0.9 * this.landAmt;
      shinR -= 0.9 * this.landAmt;
    }
    const DEG = Math.PI / 180;
    const downed = p.stance === "downed";
    // down: the look pitch is the head's alone (the arms are on the floor)
    const pitch = downed ? 0 : Math.max(-70, Math.min(70, p.pitch)) * DEG;
    const e = this.eased;
    const k = 1 - Math.exp(-14 * dt);
    // the JOLT: a lean into it, the legs trailing
    if (this.joltAmt > 0) {
      lean += 0.55 * this.joltAmt;
      thighL -= 0.5 * this.joltAmt;
      thighR -= 0.3 * this.joltAmt;
    }
    e.lean += (lean - e.lean) * k;
    e.pelvisDrop += (drop - e.pelvisDrop) * k;
    e.thighL += (thighL - e.thighL) * k;
    e.thighR += (thighR - e.thighR) * k;
    e.shinL += (shinL - e.shinL) * k;
    e.shinR += (shinR - e.shinR) * k;
    e.armsUp += (armsUp - e.armsUp) * k;
    e.armSwing += (armSwing - e.armSwing) * k;
    e.headPitch += (-pitch * 0.6 - e.headPitch) * k;
    e.legYaw += (legYaw - e.legYaw) * (1 - Math.exp(-8 * dt));
    const act = p.act ?? null;
    const k2 = 1 - Math.exp(-10 * dt);
    e.ads += ((p.ads ?? 0) - e.ads) * k2;
    e.reload += ((act === "reload" ? 1 : 0) - e.reload) * k2;
    e.swap += ((act === "swap" ? 1 : 0) - e.swap) * k2;
    e.heal += ((act === "heal" && !downed ? 1 : 0) - e.heal) * k2;
    e.down += ((downed ? 1 : 0) - e.down) * k2;
    // sprinting with the gun not up: it comes down and cants across the body, the arms pumping
    const sprinting = p.stance === "stand" && speed > 6.2 && (p.ads ?? 0) < 0.3 && act === null;
    e.sprint += ((sprinting ? 1 : 0) - e.sprint) * k2;
    // the impulses fade: a kick in a tenth of a second, a flinch in a fifth, a JOLT's lean in a third
    this.kickAmt = Math.max(0, this.kickAmt - dt * 12);
    // the flash: lit for its few hundredths of a second after a shot, on whichever gun is drawn
    this.flashLeft = Math.max(0, this.flashLeft - dt);
    for (const s of [this.flashSprite, this.mq?.flash ?? null]) if (s) showFlash(s, this.flashLeft > 0, this.flashSpin);
    if (this.flashLeft > 0) this.flashFrames++;
    // the contact shadow: under a standing figure, not one that has fallen (its group tips over with it)
    if (this.contact) this.contact.visible = !this.knocked && this.group.visible;
    this.flinchAmt = Math.max(0, this.flinchAmt - dt * 5);
    this.joltAmt = Math.max(0, this.joltAmt - dt * 3);
    const flinch = this.flinchAmt;
    r.pelvis.position.y = PELVIS_Y - e.pelvisDrop - 0.05 * Math.max(0, flinch - 0.6);
    r.pelvis.rotation.y = e.legYaw + plant;
    r.torso.rotation.y = -(e.legYaw + plant);
    // standing still it breathes: the chest rises and settles every few seconds
    const breathe = speed < 0.3 && p.stance === "stand" ? Math.sin(this.idleT * 1.7) : 0;
    r.torso.rotation.x = e.lean - 0.2 * flinch + 0.02 * breathe;
    r.head.rotation.x = e.headPitch - e.lean * 0.7 - 0.25 * flinch + 0.15 * e.ads + 0.2 * e.reload + 0.35 * e.heal - 0.25 * e.down;
    r.head.rotation.z = 0.12 * e.ads;
    r.thighL.rotation.x = e.thighL;
    r.thighR.rotation.x = e.thighR;
    r.shinL.rotation.x = e.shinL;
    r.shinR.rotation.x = e.shinR;
    // armed: the gun follows the aim; unarmed: the arms swing against the legs
    if (r.armL && r.armR) {
      r.armL.rotation.x = s2 * e.armSwing - e.armsUp;
      r.armR.rotation.x = s * e.armSwing - e.armsUp;
      r.arms.rotation.x = 0;
    } else {
      // aimed: the gun up to the eye; a shot kicks it back; a reload rolls and
      // dips it; a swap takes it down out of sight; a heal lowers it for the item
      // down: the gun gone, the arms straight down to the floor, reaching in turn as it crawls
      const crawl = e.down * s * e.armSwing * 0.6;
      const pump = e.sprint * Math.sin(g) * 0.12;
      r.arms.rotation.x = -(e.armsUp + pitch * 0.8 * (1 - e.sprint)) - e.lean * 0.5 * (1 - e.down) - 0.1 * e.ads - 0.14 * this.kickAmt + 0.4 * e.reload + 1.1 * e.swap + 0.75 * e.heal + crawl + 0.55 * e.sprint + pump;
      r.arms.rotation.z = 0.5 * e.reload + 0.25 * crawl + 0.45 * e.sprint;
      r.arms.rotation.y = -0.3 * e.sprint;
      r.arms.position.set(this.armsBase.x, this.armsBase.y + 0.07 * e.ads + 0.006 * breathe, this.armsBase.z - 0.05 * this.kickAmt - 0.03 * e.ads);
      const away = e.heal > 0.5 || e.down > 0.15;
      if (away !== this.gunAway) {
        this.gunAway = away;
        if (this.gun) this.gun.visible = this.gunShown && !away;
      }
      if ((e.heal > 0.02 && !downed) || this.healMesh) {
        const m = this.healItemMesh(r.arms);
        m.visible = e.heal > 0.5;
        (m.material as THREE.MeshStandardMaterial).color.setHex(HEAL_COLOUR[p.healItem ?? "cell"] ?? 0x3b8bff);
      }
    }
    // An emote, on top: it runs its length, and moving or going down ends it.
    // The robot's armed arms are one piece with the gun, so it raises them
    // together; an unarmed robot and the mannequin move each arm.
    if (this.emoteIndex !== null) {
      this.emoteT += dt;
      const def = emoteAt(this.emoteIndex);
      if (!def || this.emoteT >= def.seconds || speed > 1.5 || downed || (p.stance !== "stand" && p.stance !== "crouch")) this.emoteIndex = null;
    }
    const ep = this.emoteIndex !== null ? emotePose(this.emoteIndex, this.emoteT) : null;
    const emoting = !!ep && ep.weight > 0.02;
    if (emoting) {
      r.pelvis.rotation.y += ep.hipSway;
      r.pelvis.position.y += ep.bounce;
      r.torso.rotation.y += ep.spineTwist;
      r.torso.rotation.x += ep.spineLean;
      r.torso.rotation.z += ep.spineSide;
      r.head.rotation.x += ep.headNod;
      r.head.rotation.z += ep.headTilt;
      if (r.armL && r.armR) {
        r.armR.rotation.x -= ep.rForward + ep.rRaise * 0.9;
        r.armR.rotation.z = -ep.rRaise * 0.35;
        r.armL.rotation.x -= ep.lForward + ep.lRaise * 0.9;
        r.armL.rotation.z = ep.lRaise * 0.35;
      } else {
        r.arms.rotation.x -= Math.max(ep.rRaise, ep.lRaise, ep.rForward) * 0.9;
        r.arms.rotation.z += (ep.lRaise - ep.rRaise) * 0.2;
      }
    }
    if (this.gun) {
      if (emoting && !this.emoteHidGun && this.gun.visible) {
        this.gun.visible = false;
        this.emoteHidGun = true;
      } else if (!emoting && this.emoteHidGun) {
        this.gun.visible = this.gunShown && !this.gunAway;
        this.emoteHidGun = false;
      }
    }
    // the mannequin plays its clips for the same pose, with the same corrections on top
    this.mq?.update(p, dt, !!this.gun && this.gunShown && !downed, { kick: this.kickAmt, flinch: this.flinchAmt, jolt: this.joltAmt, legYaw: e.legYaw + plant, ads: e.ads, land: this.landAmt, stagger: this.staggerAt, headHit: this.headAt, emote: emoting ? ep : null }, this.lodAnimate);
  }

  /**
   * Figure LOD (figlod.ts, src/config/lod.json): what this figure owes at its
   * distance from the camera. Its animation runs every frame up close, every
   * second or fourth further out and not at all off screen and away; it casts
   * a shadow only within `shadow` metres; and past `farGun` its gun is the one
   * merged mesh, not the full model's eleven to fifteen. Called once a frame,
   * before the pose.
   */
  private lodAnimate = true;
  private lodShadow = true;
  private lodFullGun = true;
  private stepLod(): void {
    const w = figureWork(this.group.position, this.lodSpread);
    this.lodAnimate = w.animate;
    if (w.shadow !== this.lodShadow) {
      this.lodShadow = w.shadow;
      this.setCastShadow(w.shadow);
    }
    if (w.fullGun !== this.lodFullGun) {
      this.lodFullGun = w.fullGun;
      this.showFarGun(!w.fullGun);
    }
  }

  /** its own number, so the figures that skip frames do not all skip the same one */
  private lodSpread = Math.floor(Math.random() * 4);

  /** every mesh of the figure and its gun casts a shadow, or none does */
  private setCastShadow(on: boolean): void {
    this.group.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh && m.userData.shadowOff !== true) m.castShadow = on;
    });
  }

  /**
   * The gun at distance: one merged mesh (the same one the floor guns use) in
   * place of the display model, made once per weapon and kept beside it.
   */
  private farGun: THREE.Mesh | null = null;
  private showFarGun(on: boolean): void {
    const id = this.armedWith;
    // the rig holds its gun on the mannequin, the plain figure in its own slot
    const root = this.mq?.gunRoot ?? this.gun;
    if (!root || !id) return;
    if (on && !this.farGun) {
      const mesh = new THREE.Mesh(floorGun(id), floorGunMat);
      mesh.castShadow = this.lodShadow;
      mesh.userData.farGun = true;
      root.add(mesh);
      this.farGun = mesh;
    }
    if (this.farGun) this.farGun.visible = on;
    // the full model's own meshes give way to it, except the muzzle's marker:
    // a shot from a figure across the map still has to flash (muzzle.ts)
    for (const o of root.children) if (o !== this.farGun && o.name !== "muzzle") o.visible = !on;
  }

  /** the heal item: a small canister held in front of the chest */
  private healItemMesh(parent: THREE.Group): THREE.Mesh {
    if (!this.healMesh) {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.15, 10), new THREE.MeshStandardMaterial({ color: 0x3b8bff, emissive: 0x112244, roughness: 0.4, metalness: 0.3 }));
      m.rotation.z = Math.PI / 2;
      m.position.set(0, -0.2, 0.34);
      parent.add(m);
      this.healMesh = m;
    }
    return this.healMesh;
  }

  /** knocked by something other than a hit here (the 1v1 opponent going down) */
  fallDown(dropGun = true): void {
    if (this.knocked) return;
    this.knocked = true;
    this.fall = 0.0001;
    this.respawnAt = Infinity;
    if (dropGun) this.dropGun();
    else {
      // a stand-in for a figure already down (a look change): no second drop, no gun in its hands
      this.mq?.setDead(true);
      if (this.gun) this.gun.visible = false;
    }
  }

  /** the gun on the floor goes (a figure put away, or replaced) */
  clearDropped(): void {
    this.dropped?.obj.removeFromParent();
    this.dropped = null;
  }

  reset(): void {
    this.setTier(this.tier);
    this.knocked = false;
    this.fall = 0;
    this.group.rotation.x = 0;
    if (this.mq) this.mq.root.rotation.x = 0;
    this.group.visible = true;
    this.pickUpGun();
  }

  /** down with the knockdown shield raised: a pane of light in front of it */
  private kdPane: THREE.Mesh | null = null;
  setKnockShield(on: boolean): void {
    if (!on && !this.kdPane) return;
    if (!this.kdPane) {
      const g = new THREE.CylinderGeometry(0.75, 0.75, 0.9, 16, 1, true, -0.9, 1.8);
      const m = new THREE.MeshBasicMaterial({ color: 0x6fd3ff, transparent: true, opacity: 0.32, side: THREE.DoubleSide, forceSinglePass: true, depthWrite: false, blending: THREE.AdditiveBlending });
      this.kdPane = new THREE.Mesh(g, m);
      this.kdPane.position.set(0, 0.55, 0.05);
      this.group.add(this.kdPane);
    }
    this.kdPane.visible = on && !this.knocked;
  }
  get knockShieldUp(): boolean {
    return !!this.kdPane && this.kdPane.visible;
  }

  /** the gun on the floor, or null (the tests look) */
  get droppedGun(): THREE.Object3D | null {
    return this.dropped?.obj ?? null;
  }

  /** the feet's turn from the body while standing still, radians (the tests look) */
  get plantedTurn(): number {
    return this.plantYaw === null ? 0 : wrapAngle(this.plantYaw - this.group.rotation.y);
  }

  /** is a gun in its hands and showing (the tests look: never while down or out) */
  get holdingGun(): boolean {
    if (this.knocked) return false;
    return this.mq ? this.mq.gunInHand : !!this.gun && this.gun.visible;
  }

  /**
   * Knocked out: the gun it held leaves its hands, a copy tumbling from where
   * the hands were to the floor, the held one hidden. A figure with no gun
   * showing (fists, a heal, down already, a bot unarmed) drops nothing.
   */
  private dropGun(): void {
    // a merged figure (a range dummy, a course's pop-up) topples whole, gun and all, as it always has
    if (!this.rig) return;
    const held = this.mq?.gunObject ?? this.gun;
    const showing = this.mq ? this.mq.gunInHand : !!held && held.visible && this.gunShown && !this.gunAway;
    this.mq?.setDead(true);
    if (this.gun) this.gun.visible = false;
    if (!held || !showing || this.dropped || !this.group.parent) return;
    held.updateWorldMatrix(true, false);
    const copy = held.clone(true);
    held.matrixWorld.decompose(copy.position, copy.quaternion, copy.scale);
    copy.visible = true;
    copy.traverse((o) => (o.visible = true));
    this.group.parent.add(copy);
    // out of the hands and forward a little, the muzzle dipping, a slow roll
    const yaw = this.group.rotation.y;
    const vel = new THREE.Vector3(Math.sin(yaw) * 0.9, 1.1, Math.cos(yaw) * 0.9);
    const spin = new THREE.Vector3(2.5 + Math.random(), (Math.random() - 0.5) * 2, 3 + Math.random() * 2);
    this.dropped = { obj: copy, vel, spin, floor: this.group.position.y + 0.04, still: false };
  }

  /** back up: the gun on the floor goes, the one in its hands comes back */
  private pickUpGun(): void {
    this.mq?.setDead(false);
    if (this.dropped) {
      this.dropped.obj.removeFromParent();
      this.dropped = null;
    }
    if (this.gun) this.gun.visible = this.gunShown && !this.gunAway;
    this.mq?.setGunVisible(this.gunShown);
  }

  /** the dropped gun: falls, tumbles, and lies where it lands */
  private stepDropped(dt: number): void {
    const d = this.dropped;
    if (!d) return;
    // hidden with its figure (the killcam's stand-ins, your own figure in first person)
    d.obj.visible = this.group.visible;
    // a figure knocked in the air: the floor is where its body comes to rest
    d.floor = Math.min(d.floor, this.group.position.y + 0.04);
    if (d.still) {
      if (d.obj.position.y > d.floor + 1e-3) d.still = false;
      else return;
    }
    d.vel.y -= 9.8 * dt;
    d.obj.position.addScaledVector(d.vel, dt);
    d.obj.rotation.x += d.spin.x * dt;
    d.obj.rotation.y += d.spin.y * dt;
    d.obj.rotation.z += d.spin.z * dt;
    if (d.obj.position.y <= d.floor) {
      d.obj.position.y = d.floor;
      if (Math.abs(d.vel.y) > 1.2) {
        Dummy.onGunLands?.(d.obj.position);
        // a clatter: one small bounce, most of the speed gone
        d.vel.set(d.vel.x * 0.35, -d.vel.y * 0.25, d.vel.z * 0.35);
        d.spin.multiplyScalar(0.3);
      } else {
        // it lies on its side: flat on the floor, keeping the way it points
        d.still = true;
        const e = new THREE.Euler().setFromQuaternion(d.obj.quaternion, "YXZ");
        d.obj.rotation.set(0, e.y, Math.PI / 2, "YXZ");
      }
    }
  }

  /**
   * Apply a hit. `now` is the GAME clock (the same one passed to update()),
   * not wall time: mixing the two meant a knocked dummy never respawned.
   */
  hit(now: number, zone: Zone, baseDamage: number, headshotScale: number, legScale: number, point: THREE.Vector3, shieldScale = 1, unshieldedScale = 1): HitReport | null {
    if (this.knocked) return null;
    const mult = zone === "head" ? headshotScale : zone === "legs" ? legScale : 1;
    // Hammerpoint: more against bare health (no shield up at all)
    const amount = Math.floor(baseDamage * mult * (this.shield <= 0 ? unshieldedScale : 1) + 1e-6);
    if (this.oneHit) {
      this.health = 0;
      this.knocked = true;
      this.fall = 0.0001;
      this.respawnAt = now + RESPAWN_S;
      this.dropGun();
      if (zone === "head") this.headFlash = 1;
      else if (zone === "legs") this.legFlash = 1;
      else this.flash = 1;
      return { zone, amount, toShield: 0, toHealth: amount, broke: false, knocked: true, headshot: zone === "head" && headshotScale > 1, point: point.clone() };
    }
    // Disruptor: more against a shield; what breaks through goes on at the plain rate
    let remaining = amount;
    const scaled = Math.floor(remaining * shieldScale + 1e-6);
    const toShield = Math.min(this.shield, scaled);
    this.shield -= toShield;
    remaining = scaled > 0 ? Math.max(0, Math.round((scaled - toShield) / shieldScale)) : remaining;
    const toHealth = Math.min(this.health, remaining);
    this.health -= toHealth;
    const broke = toShield > 0 && this.shield === 0;
    const knocked = this.health <= 0;
    // hit flash by zone: the head alone in gold, the shell white for the body, blue for the legs
    if (zone === "head") this.headFlash = 1;
    else if (zone === "legs") this.legFlash = 1;
    else this.flash = 1;
    if (broke) this.vest.visible = false;
    // a flinch on every hit, a stagger when the shield breaks
    this.flinchAmt = Math.min(1.5, this.flinchAmt + (broke ? 1.3 : 0.5));
    if (broke) this.staggerAt = this.idleT;
    // a headshot snaps the head back (mannequin.ts Hit_Head), so a player sees which shots were the head
    if (zone === "head") this.headAt = this.idleT;
    if (knocked) {
      this.knocked = true;
      this.respawnAt = now + RESPAWN_S;
      this.fall = 0.0001;
      this.dropGun();
    }
    // past the weapon's headshot range a head hit does body damage (the
    // caller passes a scale of 1), and it is not called a headshot either
    return { zone, amount: toShield + toHealth, toShield, toHealth, broke, knocked, headshot: zone === "head" && headshotScale > 1, point: point.clone() };
  }

  update(now: number, dt = 0): void {
    // what this figure owes at its distance (figlod.ts): its animation, its shadow, its gun
    this.stepLod();
    if (this.knocked && this.respawns && now >= this.respawnAt) this.reset();
    this.stepDropped(dt);
    // the mannequin plays its own death clip
    if (this.knocked && this.mq) this.mq.updateDead(dt);

    // crouched or sliding: the hit zones shrink to two thirds (the same blend
    // at any frame rate: 35% a frame at 60 fps); a rigged figure bends into
    // it, a merged one is squashed whole
    const wantCrouch = this.pose.stance === "crouch" || this.pose.stance === "slide" || this.pose.stance === "downed" ? 1 : 0;
    this.crouchAmt += (wantCrouch - this.crouchAmt) * (1 - Math.exp(-26 * dt));
    const sy = 1 - 0.34 * this.crouchAmt;
    if (this.rig) {
      this.hits.scale.y = sy;
      if (!this.knocked) this.animate(dt);
    } else this.group.scale.y = sy;

    // rising up after a pop-up
    if (this.rise < 1 && !this.knocked) {
      this.rise = Math.min(1, this.rise + dt / 0.22);
      const e = 1 - Math.pow(1 - this.rise, 3);
      this.group.rotation.x = (-Math.PI / 2 + 0.2) * (1 - e);
    }

    // Fall over rather than snap to the floor: ease out, with a small bounce
    // at the end, pivoting at the feet and toppling away from the shooter.
    if (this.knocked && this.fall < 1) {
      this.fall = Math.min(1, this.fall + dt / FALL_S);
      const t = this.fall;
      const ease = t < 0.82 ? Math.pow(t / 0.82, 2) : 1 - Math.sin(((t - 0.82) / 0.18) * Math.PI) * 0.06;
      this.group.rotation.x = (-Math.PI / 2 + 0.2) * ease;
      // the mannequin's death clip puts it on the floor itself: the hit zones
      // topple, the mannequin is turned back upright to play it
      if (this.mq) this.mq.root.rotation.x = -this.group.rotation.x;
    }

    // hit flashes decay in about a tenth of a second
    if (this.flash > 0 || this.headFlash > 0 || this.legFlash > 0) {
      this.flash = Math.max(0, this.flash - dt * 9);
      this.headFlash = Math.max(0, this.headFlash - dt * 7);
      this.legFlash = Math.max(0, this.legFlash - dt * 8);
      this.applyGlow();
    }

    if (this.rail && !this.knocked) {
      this.group.position.x += this.railDir * this.rail.speed * dt;
      if (this.group.position.x > this.rail.maxX) {
        this.group.position.x = this.rail.maxX;
        this.railDir = -1;
      } else if (this.group.position.x < this.rail.minX) {
        this.group.position.x = this.rail.minX;
        this.railDir = 1;
      }
      // face the firing line
      this.group.rotation.y = 0;
    }
  }
}
