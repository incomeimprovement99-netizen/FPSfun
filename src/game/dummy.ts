// A figure: three hit zones (head / body / legs), health and shield, damage, the knock and the respawn.
//
// The body you SEE and the body you HIT are two different things. The hit zones are drawn with an invisible material;
// what is drawn is the soldier (mannequin.ts MannequinFigure), whose volumes follow its bones (followBones). A figure
// made before the soldier is ready is its volumes alone until then (dress). The range's drill target is a bullseye board
// instead (board): its rings the body, its middle the crit. Our own robot stood here until Milestone 569.
import { figureWork } from "./figlod";
import { floorGun, floorGunMat } from "./loot";
import type { Finish } from "./finishes";
import * as THREE from "three";
import { applyFinishTo, displayGunModel } from "./gunmodels";
import { MUZZLE, muzzleOf, showFlash, showGlint } from "./muzzle";
import { OPERATORS, type OperatorSkin } from "./operators";
import { MannequinFigure, useMannequin } from "./mannequin";
import { CloakShell, MateOutline, Outline, ShieldShell } from "./outline";
import { emoteAt, emotePose } from "./emotes";
import figureCfg from "../config/figure.json";
import rangeCfg from "../config/rangetools.json";
import hudCfg from "../config/hud.json";

const SHIELD_FX = hudCfg.shieldFx;
const ARMOR_SHELL = parseInt(SHIELD_FX.armor.color.slice(1), 16);

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
/** a death turned away from the shot: how long a hit counts, how near the middle is no side, how fast it turns (figure.json death) */
const DEATH = figureCfg.death as { hitFor: number; near: number; turnRate: number };

// human hull, metres (72 units tall)
const H = 72 * 0.0254;

/**
 * Hit zones render nothing, but the MESH stays visible. That distinction is
 * load-bearing: ProjectileSystem skips meshes whose `visible` is false (three's
 * raycaster would otherwise hit hidden ones), and the armour plate still uses
 * mesh visibility to switch itself off at tier 0.
 */
const HITBOX = new THREE.MeshBasicMaterial({ visible: false });

/** the plinth under a range figure */
const baseMat = new THREE.MeshStandardMaterial({ color: 0x3a4047, roughness: 0.5, metalness: 0.55 });

/** how many figures put the soldier on in one frame (figure.json dressPerFrame) */
const DRESS_PER_FRAME = (figureCfg as { dressPerFrame?: number }).dressPerFrame ?? 2;

/** the bullseye board (rangetools.json board) */
const BOARD = rangeCfg.board as { radius: number; crit: number; height: number; rings: number };
let boardTex: THREE.CanvasTexture | null = null;
/** its face: rings in white and red from the edge in, the last one before the middle white, and the middle red */
function boardTexture(): THREE.CanvasTexture | null {
  if (boardTex || typeof document === "undefined") return boardTex;
  const c = document.createElement("canvas");
  c.width = c.height = 512;
  const g = c.getContext("2d");
  if (!g) return null;
  const px = (r: number) => (256 * r) / BOARD.radius;
  const disc = (r: number, colour: string) => {
    g.fillStyle = colour;
    g.beginPath();
    g.arc(256, 256, px(r), 0, Math.PI * 2);
    g.fill();
  };
  for (let i = 0; i < BOARD.rings; i++) disc(BOARD.radius - ((BOARD.radius - BOARD.crit) * i) / BOARD.rings, (BOARD.rings - i) % 2 === 1 ? "#f2efe8" : "#d8322a");
  disc(BOARD.crit, "#d8322a");
  // a thin dark line round the crit, so it reads apart from the ring around it at range
  g.strokeStyle = "#1c1c1c";
  g.lineWidth = 3;
  g.beginPath();
  g.arc(256, 256, px(BOARD.crit), 0, Math.PI * 2);
  g.stroke();
  boardTex = new THREE.CanvasTexture(c);
  boardTex.colorSpace = THREE.SRGBColorSpace;
  return boardTex;
}

export interface DummyOptions {
  /** a weapon id: the figure holds it */
  armed?: string;
  /** any hit drops it, for the course's pop-up targets */
  oneHit?: boolean;
  /** its health, not 100 (the tutorial's soldiers have 50) */
  health?: number;
  /** stand back up after being knocked; false keeps it down until reset */
  respawn?: boolean;
  /** the operator look; the range's own dummies use the default */
  skin?: OperatorSkin;
  /** no plinth: a player's figure stands on the floor */
  noBase?: boolean;
  /** a bullseye board on a post, not a figure (the drill's target): its rings the body, its middle the crit */
  board?: boolean;
}

/**
 * what a rigged figure is doing, from the player it stands for: and in the air, the two things it was only "air" for
 * until Milestone 604, a wall run with the wall on the left or the right of the way it runs, and the battle royale's
 * skydive (player.ts figureStance)
 */
export type FigureStance = "stand" | "crouch" | "slide" | "air" | "climb" | "mantle" | "zip" | "wallL" | "wallR" | "skydive";
/** off the ground: a jump or a fall, a wall run or a skydive */
export const airborne = (s: FigureStance): boolean => s === "air" || s === "wallL" || s === "wallR" || s === "skydive";
/** what its hands are busy with: a reload, a swap, a throw, a melee swing, a revive, or holding interact on something */
export type FigureAct = "reload" | "swap" | "throw" | "melee" | "interact" | "vent" | null;
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
  /** how many double jumps it has made (player.ts airJumps): a new one lifts the figure's knees (mannequin.ts) */
  airJumps?: number;
  /** a reload from an empty magazine (weapon-state.ts reloadEmpty): the longer one, with the rack; else a tactical one */
  reloadEmpty?: boolean;
}
/**
 * What the hands are doing, as one small number for the network: 0 nothing,
 * 1 reload, 2 swap, 3 throw, 4 melee, 6 interact, 9 a reload from empty, 20 a vent. 5 (a revive), 7 and 8 (finishing
 * someone, being finished) went with the knockdowns (Milestone 529) and read as nothing now, kept unused while pages from
 * before may be in play. A page from before 3 to 6 existed
 * reads them as nothing, so a figure on an old page just does not play the new motion.
 */
const ACT_CODES: FigureAct[] = [null, "reload", "swap", "throw", "melee", null, "interact", null, null];
/**
 * A reload from an empty magazine has a code of its own, 9 (1 stays the tactical reload), so the others see which: an
 * older page reads it as nothing and just does not show that reload
 */
const EMPTY_RELOAD = 9;
/**
 * 10 to 19 were a heal and its item's code, until SpeedKills' heal items went (Milestone 523): read as nothing now, so a
 * page from before shows nothing for one, and not to be given to another act while such pages may be in play.
 */
/**
 * An overheated gun venting (CHOOCH's lockout, weapon-mechanics.json lstar.lockout): 20, the first code after the
 * heals. The owner, 2026-10-01: other players see it. It had gone as a reload (the lockout is a reload to the gun's
 * state), so others saw a magazine come out of a gun that has none. A page from before reads 20 as nothing.
 */
const VENT = 20;
export const actCode = (a: FigureAct, emptyReload = false): number => (a === "vent" ? VENT : a === "reload" && emptyReload ? EMPTY_RELOAD : Math.max(0, ACT_CODES.indexOf(a)));
export const actFromCode = (c: number | undefined): FigureAct => (c === VENT ? "vent" : c === EMPTY_RELOAD ? "reload" : c !== undefined && c > 0 && c < ACT_CODES.length ? ACT_CODES[c] : null);
/** the act code is a reload from empty */
export const emptyReloadOf = (c: number | undefined): boolean => c === EMPTY_RELOAD;

/** the legs turn at most this far from the body toward the way it moves (a strafe) */
const LEG_TURN = 1.25;
/** standing still, the feet stay planted while the body turns, until it has turned this far (radians, 50 degrees); then a step round */
export const TURN_STEP_AT = 0.87;
/** the step round: the feet catch up at this rate (1/s), lifting in turn */
const TURN_STEP_RATE = 11;
const wrapAngle = (a: number): number => Math.atan2(Math.sin(a), Math.cos(a));
const STANCE_CODE: FigureStance[] = ["stand", "crouch", "slide", "air", "climb", "mantle", "zip", "stand", "wallL", "wallR", "skydive"];
/**
 * A stance as one small number for the network, and back. 7 was down, a knocked figure's crawl, gone with the
 * knockdowns (Milestone 529): a page from before that sends it reads as standing, and it stays unused. 8 and 9 (a wall
 * run, the wall on the left or the right of the way it runs) and 10 (a skydive) came in Milestone 604: a page from
 * before reads them as standing, so its figure of a player on a wall or in the drop stands in the air for a release.
 */
export const stanceCode = (s: FigureStance): number => Math.max(0, STANCE_CODE.indexOf(s));
export const stanceFromCode = (c: number | undefined): FigureStance => STANCE_CODE[c ?? 0] ?? "stand";

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
const FB_M = new THREE.Matrix4();
const FB_B = new THREE.Matrix4();
const FB_Q = new THREE.Quaternion();
const FB_X = new THREE.Vector3();
const FB_Y = new THREE.Vector3();
const FB_Z = new THREE.Vector3();
const FB_Q2 = new THREE.Quaternion();
const FB_S = new THREE.Vector3();
const FB_M2 = new THREE.Matrix4();
const FB_A = new THREE.Vector3();
const FB_C = new THREE.Vector3();
/** the head volume's sphere, metres round, and the neck's height (the volumes as made); the soldier's follow its own (followBones) */
const HEAD_R = 0.13;
const NECK_H = 0.1;
/**
 * The torso's volume, 0.5 across, 0.63 high and 0.32 deep, its top following the shoulders down from the neck
 * (figure.json torsoTop): a box with a flat top stood over the shoulders and in front of the side of the head. From
 * `bottom` up (the soldier's chest is its top half alone, from spine_02: followBones).
 */
const torsoVolGeo = new Map<number, THREE.BufferGeometry>();
function torsoVolume(bottom = -0.315): THREE.BufferGeometry {
  const made = torsoVolGeo.get(bottom);
  if (made) return made.clone();
  const top = (figureCfg as { torsoTop?: number[][] }).torsoTop ?? [[0, 0], [0.25, 0]];
  const s = new THREE.Shape();
  s.moveTo(-0.25, bottom);
  s.lineTo(0.25, bottom);
  // up the left side and across the top along the profile, then down the right side
  for (let i = top.length - 1; i >= 0; i--) s.lineTo(top[i][0], 0.315 - top[i][1]);
  for (let i = 1; i < top.length; i++) s.lineTo(-top[i][0], 0.315 - top[i][1]);
  s.lineTo(-0.25, bottom);
  // in a centimetre's steps front to back, each step's top brought down to the back's and the chest's line (torsoBack)
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.32, steps: 32, bevelEnabled: false });
  g.translate(0, 0, -0.16);
  const back = (figureCfg as { torsoBack?: number[][] }).torsoBack ?? [];
  const downAt = (z: number): number => {
    if (!back.length) return 0;
    if (z <= back[0][0]) return back[0][1];
    for (let i = 1; i < back.length; i++) if (z <= back[i][0]) return back[i - 1][1] + ((back[i][1] - back[i - 1][1]) * (z - back[i - 1][0])) / (back[i][0] - back[i - 1][0]);
    return back[back.length - 1][1];
  };
  const pos = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) pos.setY(i, Math.min(pos.getY(i), 0.315 - downAt(pos.getZ(i))));
  g.computeVertexNormals();
  g.computeBoundingBox();
  g.computeBoundingSphere();
  torsoVolGeo.set(bottom, g);
  return g.clone();
}

/** the neck's volume at its top, metres round: the drawn neck's thinnest under the skull (figure.json headVolume) */
const NECK_TOP = (figureCfg as { headVolume?: { neckTop: number } }).headVolume?.neckTop ?? 0.07;
const NECK_FOOT = (figureCfg as { headVolume?: { neckFoot: number } }).headVolume?.neckFoot ?? 0.09;
/** the soldier's arm volumes, round its upper arms and its forearms (figure.json armVolume) */
const ARM = (figureCfg as { armVolume?: { upper: number[]; fore: number[]; hand: number } }).armVolume ?? { upper: [0.11, 0.08], fore: [0.075, 0.062], hand: 0.1 };
/** the soldier's leg volumes, round its thighs, calves and boots (figure.json legVolume) */
const LEG = (figureCfg as { legVolume?: { thigh: number[]; calf: number[]; foot: { size: number[]; mid: number[] } } }).legVolume ?? { thigh: [0.15, 0.11], calf: [0.12, 0.1], foot: { size: [0.15, 0.17, 0.34], mid: [0, -0.09, 0.09] } };
/** the soldier's hands as they are hit (figure.json handVolume) */
const HAND = (figureCfg as { handVolume?: { r: number; at: number } }).handVolume ?? { r: 0.08, at: 0.5 };
/** how far under the neck bone the soldier's neck volume reaches (figure.json neckBelow) */
const NECK_BELOW = (figureCfg as { neckBelow?: number }).neckBelow ?? 0.0275;

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
  /**
   * Where the last hit landed (world x and z) and when on this figure's clock, and the way it turns to fall away from it
   * (Milestone 610): a figure's fall, its death clip's and its volumes' alike, is backward, so it turns its front to the
   * shot as it goes down (figure.json death)
   */
  private hitFrom: { x: number; z: number; at: number } | null = null;
  private fallYaw: number | null = null;
  private flash = 0;
  private headFlash = 0;
  /** a leg hit flashes blue: the flash's colour says which zone you hit */
  private legFlash = 0;
  /** 0..1 rising from the ground after a pop-up; 1 when upright */
  private rise = 1;
  /** 0..1 Digital Threat highlight */
  private threat = 0;
  /** the red outline while aimed at (outline.ts), made the first time it is */
  private outline: Outline | null = null;
  /** a teammate's ring in their squad colour, through walls (outline.ts MateOutline), made the first time it is */
  private mateRing: MateOutline | null = null;
  /** a REVEAL's rim and fill through walls (outline.ts MateOutline with a fill), made the first time it is shown */
  private revealRing: MateOutline | null = null;
  /** its shield's glow when a round lands on it, and ARMOR's gold (outline.ts ShieldShell), made the first time it shows */
  private shell: ShieldShell | null = null;
  /** the flare now, from its peak down to 0 (hud.json shieldFx.flare) */
  private shellFlare = 0;
  private shellColor = 0x3b8bff;
  private readonly shellHit = new THREE.Vector3();
  /** under INVISIBILITY past seenWithin (Milestone 715): its shimmer (outline.ts CloakShell), made the first time it is */
  private cloak: CloakShell | null = null;
  /** under ARMOR (main.ts, from the hack's message): the gold shell, pulsing */
  private armored = false;
  readonly oneHit: boolean;
  /** its own full health, when not HEALTH_MAX */
  private readonly healthCap: number | undefined;
  readonly respawns: boolean;
  private readonly plate: THREE.Mesh;
  private readonly ringMat: THREE.MeshStandardMaterial;
  /** a bullseye board's face, which a hit lights; null on a figure */
  private readonly boardMat: THREE.MeshStandardMaterial | null = null;
  /** the hit zones, scaled down for a crouch */
  private readonly hits = new THREE.Group();
  private crouchAmt = 0;
  private pose: FigurePose = { speed: 0, stance: "stand", pitch: 0 };
  /** eased pose values, so a change of stance blends rather than snaps: the legs' turn toward a strafe, the aim */
  private readonly eased = { legYaw: 0, ads: 0 };
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
  /** shots fired, for the figure (a pump gun's pump after each: MannequinImpulses.shots) */
  private shots = 0;
  private flinchAmt = 0;
  private joltAmt = 0;
  /**
   * Knocked out: the gun leaves its hands and falls to the floor beside it,
   * a copy in the world (the held one hides) that tumbles, lands and lies
   * there until the figure is back up. Nobody holds a gun lying down.
   */
  private dropped: { obj: THREE.Object3D; vel: THREE.Vector3; spin: THREE.Vector3; floor: number; still: boolean } | null = null;
  /** a dropped gun's first touch of the floor (the game plays the clatter) */
  static onGunLands: ((at: THREE.Vector3) => void) | null = null;
  private gunShown = true;
  /** the soldier, once it is ready (dress) */
  private mq: MannequinFigure | null = null;
  /** the hit volumes by part, for SpeedKills' soldier, whose volumes follow its bones (followBones) */
  private vols: {
    legs: THREE.Mesh;
    torso: THREE.Mesh;
    armL: THREE.Mesh;
    armR: THREE.Mesh;
    neck: THREE.Mesh;
    head: THREE.Mesh;
    plate: THREE.Mesh;
    foreL?: THREE.Mesh;
    foreR?: THREE.Mesh;
    belly?: THREE.Mesh;
    thighL?: THREE.Mesh;
    calfR?: THREE.Mesh;
    calfL?: THREE.Mesh;
    footR?: THREE.Mesh;
    footL?: THREE.Mesh;
    handL?: THREE.Mesh;
    handR?: THREE.Mesh;
  };
  readonly distanceLabel: number;
  /** the operator this figure wears */
  readonly skin: OperatorSkin;
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
    this.healthCap = opts.health;
    this.respawns = opts.respawn ?? true;
    // Yaw first, then the fall, so an armed dummy turned to face you falls
    // away from you rather than along the world axis.
    this.group.rotation.order = "YXZ";
    const armed = opts.armed ?? null;
    this.armedWith = armed;
    const skin = opts.skin ?? OPERATORS[0];
    this.skin = skin;

    // ---------------- hit zones: unchanged dimensions, invisible
    // legs: 0..0.92 m
    const legs = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.92, 0.3), HITBOX);
    legs.position.y = 0.46;
    legs.userData.zone = "legs";
    // torso: 0.92..1.55 m. The top must reach the head sphere's bottom
    // (1.5488) or a round through the neck registers no hit at all.
    const torso = new THREE.Mesh(torsoVolume(), HITBOX);
    torso.position.y = 1.235;
    torso.userData.zone = "body";
    const armL = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.6, 0.14), HITBOX);
    armL.position.set(-0.33, 1.2, 0);
    armL.userData.zone = "body";
    const armR = armL.clone();
    armR.position.x = 0.33;
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(NECK_TOP, NECK_FOOT, NECK_H, 10), HITBOX);
    neck.position.y = 1.58;
    neck.userData.zone = "body";
    // head: sphere r 0.13 at 1.68 m (total ~1.83 m)
    const head = new THREE.Mesh(new THREE.SphereGeometry(HEAD_R, 20, 14), HITBOX);
    head.position.y = H - 0.15;
    head.userData.zone = "head";
    // armour plate: visibility still switches it off at tier 0
    this.plate = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.34, 0.06), HITBOX);
    this.plate.position.set(0, 1.28, 0.19);
    this.plate.userData.zone = "body";
    this.vols = { legs, torso, armL, armR, neck, head, plate: this.plate };
    for (const m of [legs, torso, armL, armR, neck, head, this.plate]) {
      m.castShadow = false;
      this.hits.add(m);
      this.hitMeshes.push(m);
    }
    this.group.add(this.hits);

    if (opts.board) {
      // The board: its face, a dark back, and a post down to the floor. The torso's volume is its disc and the head's
      // the crit in its middle, a centimetre proud of it so a shot there meets the crit first; the rest are put away
      // (a hidden mesh is never hit: ProjectileSystem).
      const B = BOARD;
      const face = new THREE.MeshStandardMaterial({ color: boardTexture() ? 0xffffff : 0xd8322a, map: boardTexture(), roughness: 0.7 });
      this.boardMat = face;
      const board = new THREE.Group();
      board.name = "board";
      board.position.y = B.height;
      const front = new THREE.Mesh(new THREE.CircleGeometry(B.radius, 64), face);
      front.position.z = 0.016;
      const back = new THREE.Mesh(new THREE.CylinderGeometry(B.radius * 1.02, B.radius * 1.02, 0.03, 48), baseMat);
      back.rotation.x = Math.PI / 2;
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, B.height - B.radius, 10), baseMat);
      post.position.set(0, -(B.height + B.radius) / 2 + B.radius, -0.03);
      for (const m of [front, back, post]) {
        m.castShadow = true;
        board.add(m);
      }
      this.group.add(board);
      torso.geometry.dispose();
      torso.geometry = new THREE.CylinderGeometry(B.radius, B.radius, 0.03, 48).rotateX(Math.PI / 2);
      torso.position.set(0, B.height, 0);
      head.geometry.dispose();
      (head as THREE.Mesh).geometry = new THREE.CylinderGeometry(B.crit, B.crit, 0.05, 32).rotateX(Math.PI / 2);
      head.position.set(0, B.height, 0.01);
      for (const m of [legs, armL, armR, neck, this.plate]) m.visible = false;
    }

    // base plinth with a lit ring in the armour colour
    this.ringMat = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0x39d7ee, emissiveIntensity: 1.8 });
    if (!opts.noBase && !opts.board) {
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
    this.health = this.oneHit ? 1 : (this.healthCap ?? HEALTH_MAX);
    this.plate.visible = t !== 0 && !this.boardMat;
    this.ringMat.emissive.setHex(t !== 0 ? ARMOR_COLOR[t] : 0x39d7ee);
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
    // up from where it fell last time: the soldier off its death clip, upright in the group, its gun back
    if (this.mq) this.mq.root.rotation.x = 0;
    this.pickUpGun();
  }

  /** course reset: gone, and not hittable (hidden groups are skipped) */
  hide(): void {
    this.setTier(this.tier);
    this.knocked = false;
    this.fall = 0;
    this.rise = 1;
    this.group.visible = false;
    this.group.rotation.x = 0;
    if (this.mq) this.mq.root.rotation.x = 0;
    this.pickUpGun();
  }

  /** outlined (the enemy under the crosshair), `width` metres thick in `color`, drawn `back` metres behind (outline.ts) */
  setOutline(on: boolean, width = 0.02, color = 0xff2a3a, back = 0): void {
    if (!on && !this.outline) return;
    this.outline ??= new Outline(this.group, [this.hits], color, back);
    this.outline.setColor(color);
    this.outline.show(on, width);
  }

  /** shown by a REVEAL: its rim and its shape through walls in `color` (hacks.json reveal.outline), or off */
  setRevealed(on: boolean, color = 0xff2a3a, width = 0.03, fill = 0.3): void {
    if (!on && !this.revealRing) return;
    this.revealRing ??= new MateOutline(this.group, [this.hits], fill);
    this.revealRing.show(on, width, color);
  }

  /** the REVEAL's drawing (tools/e2e.ts), or null when this figure has never been shown */
  revealState(): { on: number; width: number; color: number; through: boolean; fill: number } | null {
    return this.revealRing?.state() ?? null;
  }

  /**
   * A round on its shield at `point`, in the shield's `color` (Milestone 694): the shell flares over the figure,
   * brightest where it landed; `broke`, the round that took the last of it, flares brighter (main.ts adds the shards).
   * A board has no shield to show.
   */
  shieldHit(point: THREE.Vector3, color: number, broke: boolean): void {
    if (!this.mq) return;
    this.shellFlare = broke ? SHIELD_FX.break.flare : SHIELD_FX.flare.peak;
    this.shellColor = color;
    this.shellHit.copy(point);
    this.drawShell();
  }

  /** under ARMOR or not: its gold shell, on until it is told off (main.ts, as the hack's message says) */
  setArmored(on: boolean): void {
    if (on === this.armored) return;
    this.armored = on;
    this.drawShell();
  }

  /** the shell as drawn (tools/e2e.ts), or null when it has never shown */
  shellState(): { on: number; amount: number; color: number } | null {
    return this.shell?.state() ?? null;
  }

  /** the middle of its chest, in the world: where its shield's shards burst from */
  chestAt(): THREE.Vector3 {
    return this.vols.torso.getWorldPosition(new THREE.Vector3());
  }

  /**
   * Its INVISIBILITY's shimmer at `amount` (0 off), in `color`, its bands at `time` (main.ts: on while it is unseen past
   * hacks.json invis.seenWithin, its group hidden; the shimmer stands outside it)
   */
  setCloak(amount: number, color: number, look: { rim: number; band: number; bandScale: number; bandSpeed: number }, time: number): void {
    if (amount <= 0.001 && !this.cloak) return;
    this.cloak ??= new CloakShell(this.group, [this.hits]);
    this.cloak.show(amount, color, look, time);
  }

  /** the shimmer as drawn (tools/e2e.ts), or null when it has never shown */
  cloakState(): { on: number; amount: number } | null {
    return this.cloak?.state() ?? null;
  }

  /** the flare over ARMOR's gold while both are on: the flare says the round landed, the gold that it is armoured */
  private drawShell(): void {
    const F = SHIELD_FX.flare;
    const A = SHIELD_FX.armor;
    const gold = this.armored ? A.glow + A.pulse * Math.sin(this.idleT * A.hz * Math.PI * 2) : 0;
    if (this.shellFlare <= 0.001 && gold <= 0.001) {
      this.shell?.show(0, this.shellColor, F);
      return;
    }
    this.shell ??= new ShieldShell(this.group, [this.hits]);
    if (this.shellFlare >= gold) this.shell.show(this.shellFlare, this.shellColor, F, this.shellHit);
    else this.shell.show(gold, ARMOR_SHELL, A);
  }

  /**
   * Where a damage number goes: `over` metres above the top of the head (its volume, which follows the soldier's bones),
   * so the number never covers the figure (hud.json damageNumbers.over)
   */
  overHead(over: number): THREE.Vector3 {
    const at = this.vols.head.getWorldPosition(new THREE.Vector3());
    at.y += HEAD_R + over;
    return at;
  }

  /** a teammate's ring through walls in their squad colour, `width` metres wide; null takes it off */
  setMateOutline(color: number | null, width = 0.02): void {
    if (color === null && !this.mateRing) return;
    this.mateRing ??= new MateOutline(this.group, [this.hits]);
    this.mateRing.show(color !== null, width, color ?? 0xffffff);
  }

  /** the ring as drawn (tools/e2e.ts), or null when this figure has never had one */
  mateOutlineState(): { on: number; width: number; color: number; through: boolean } | null {
    return this.mateRing?.state() ?? null;
  }

  /**
   * Seen through a Digital Threat optic, or shown by a REVEAL: the figure glows red. 0 is off; the caller fades it with
   * distance, as the data's fade range says.
   */
  setThreat(amount: number): void {
    if (Math.abs(amount - this.threat) < 0.01) return;
    this.threat = amount;
    this.applyGlow();
  }

  /**
   * The hit flash, and the threat highlight under it (the soldier's own: mannequin.ts setFlash). It was our robot's
   * shell alone, so on the soldier neither a Digital Threat optic nor a REVEAL showed anything until Milestone 569. A
   * board lights white, and gold for the crit.
   */
  private applyGlow(): void {
    if (this.boardMat) {
      const f = Math.max(this.flash, this.headFlash) * 0.6;
      const gold = this.headFlash > this.flash;
      this.boardMat.emissive.setRGB(f + this.threat * 0.95, f * (gold ? 0.75 : 1), f * (gold ? 0.2 : 1));
      return;
    }
    this.mq?.setFlash(Math.max(this.flash, this.headFlash, this.legFlash) * 0.8, this.headFlash > this.flash, this.threat);
  }

  /**
   * Free what this figure alone owns: its soldier, hit boxes and its own materials (the board's shapes too). For figures
   * that are replaced while playing, like the 1v1 opponent's.
   */
  dispose(): void {
    this.outline?.dispose();
    this.outline = null;
    this.mateRing?.dispose();
    this.mateRing = null;
    this.revealRing?.dispose();
    this.revealRing = null;
    this.shell?.dispose();
    this.shell = null;
    this.cloak?.dispose();
    this.cloak = null;
    this.dropped?.obj.removeFromParent();
    this.dropped = null;
    this.mq?.dispose();
    this.group.removeFromParent();
    this.group.getObjectByName("board")?.traverse((o) => ((o as THREE.Mesh).isMesh ? (o as THREE.Mesh).geometry.dispose() : undefined));
    for (const m of this.hitMeshes) m.geometry.dispose();
    this.ringMat.dispose();
    this.boardMat?.dispose();
  }

  /** a rigged figure: what it should be doing, from the player or bot it stands for */
  setPose(p: FigurePose): void {
    this.pose = p;
  }

  /**
   * GRAPPLE, seen (Milestone 607): pulled to a hook point (world), the left hand off the gun and the arm up at it,
   * until it is within `arrive` of it or `seconds` are up (main.ts sends it on a player's grapple, hacks.json grapple)
   */
  reachFor(to: THREE.Vector3, seconds: number, arrive: number): void {
    this.mq?.reachFor(to, seconds, arrive);
  }

  /** the gun it holds, by id (null unarmed) */
  get armedId(): string | null {
    return this.armedWith;
  }

  /** its soldier, for the tools that measure a figure (tools/figure-frames.ts); null until it is ready, and on a board */
  get figure(): MannequinFigure | null {
    return this.mq;
  }

  /** an emote playing (emotes.ts): which, and how far in */
  private emoteIndex: number | null = null;
  private emoteT = 0;

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
    this.paintGuns();
    Dummy.onNewLook?.(this);
  }

  /** show or hide the gun it holds (a bot still searching for one) */
  setGunVisible(on: boolean): void {
    this.gunShown = on;
    this.mq?.setGunVisible(on);
  }

  /** a shot: the gun kicks back into the shoulder, and its muzzle flashes */
  kick(): void {
    this.kickAmt = 1;
    this.shots++;
    this.flashLeft = MUZZLE.life;
    this.flashSpin = Math.random() * Math.PI * 2;
  }

  /** the scope glint's own clock, for its twinkle */
  private glintT = 0;

  /** the muzzle of the gun this figure shows, in the world: where its tracers start (null with no gun) */
  muzzleWorld(): THREE.Vector3 | null {
    // the marker on whichever gun is being shown, not the flash sprite on it:
    // the muzzle is a place, and the flash is a picture that may not have been
    // drawn (a check with no browser under it) or may be out between shots
    const m = muzzleOf(this.mq?.gunRoot ?? null);
    if (!m) return null;
    for (let o: THREE.Object3D | null = m; o; o = o.parent) if (!o.visible) return null;
    m.updateWorldMatrix(true, false);
    return m.getWorldPosition(new THREE.Vector3());
  }
  private flashLeft = 0;
  private flashSpin = 0;
  /** frames drawn with a flash lit (the suite counts them: a flash lasts two) */
  flashFrames = 0;

  /** is a muzzle flash lit on this figure now (the suite reads it) */
  get flashShown(): boolean {
    return !!this.mq?.flash?.visible;
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

  /**
   * What the soldier's clips are told on top of the pose (mannequin.ts update): the legs' turn toward a strafe and the
   * feet planted while the body turns on the spot, a landing's squash, the aim eased in, and the short-lived motions
   * (a shot's kick, a hit's flinch, a JOLT's lean, an emote) with their clocks, then its volumes onto its bones.
   */
  private animate(dt: number): void {
    const p = this.pose;
    const speed = Math.max(0, p.speed);
    // the way it moves against the way it faces: the legs turn toward a strafe; walking backward the clips run backward
    const dir = p.moveDir ?? 0;
    // (a wall run's legs run along the wall, whichever way the body looks)
    const moving = speed > 0.3 && (p.stance === "stand" || p.stance === "crouch" || p.stance === "wallL" || p.stance === "wallR");
    const back = moving && Math.abs(dir) > 1.9;
    let legYaw = 0;
    if (moving) {
      const d = back ? Math.atan2(Math.sin(dir - Math.PI), Math.cos(dir - Math.PI)) : dir;
      // figure space turns the other way: +x is its left
      legYaw = -Math.max(-LEG_TURN, Math.min(LEG_TURN, d));
    }
    // in the air, and the landing: a squash as big as the fall was long
    if (airborne(p.stance)) this.airT += dt;
    else {
      if (airborne(this.lastStance) && this.airT > 0.12) this.landAmt = Math.min(1, 0.35 + this.airT * 0.9);
      this.airT = 0;
    }
    this.lastStance = p.stance;
    this.landAmt = Math.max(0, this.landAmt - dt * 4);
    this.idleT += dt;
    // turning on the spot: the feet stay where they are while the body turns on its aim, then step round to catch up
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
        if (Math.abs(wrapAngle(this.plantYaw - facing)) < 0.03 || this.stepT > 0.5) {
          this.plantYaw = facing;
          this.stepping = false;
        }
      }
    }
    const plant = wrapAngle((this.plantYaw ?? facing) - facing);
    const e = this.eased;
    e.legYaw += (legYaw - e.legYaw) * (1 - Math.exp(-8 * dt));
    e.ads += ((p.ads ?? 0) - e.ads) * (1 - Math.exp(-10 * dt));
    // the impulses fade: a kick in a tenth of a second, a flinch in a fifth, a JOLT's lean in a third
    this.kickAmt = Math.max(0, this.kickAmt - dt * 12);
    // a figure made before the bought guns were in (main.ts loads the two in your own hands first and the rest after)
    // held the stand-in its gun was then until it was given another gun (main.ts dressed() builds the guns in hand and
    // on the floor again, and no figure's): the bought one once it is in
    if (this.armedWith && this.mq?.gunObject && !this.mq.gunObject.userData.paid && displayGunModel(this.armedWith).root.userData.paid) this.setGun(this.armedWith);
    // the flash: lit for its few hundredths of a second after a shot
    this.flashLeft = Math.max(0, this.flashLeft - dt);
    if (this.mq?.flash) showFlash(this.mq.flash, this.flashLeft > 0, this.flashSpin);
    if (this.flashLeft > 0) this.flashFrames++;
    // the contact shadow: under a standing figure, not one that has fallen (its group tips over with it)
    if (this.contact) this.contact.visible = !this.knocked && this.group.visible;
    this.flinchAmt = Math.max(0, this.flinchAmt - dt * 5);
    this.joltAmt = Math.max(0, this.joltAmt - dt * 3);
    // an emote runs its length, and moving or leaving its feet ends it
    if (this.emoteIndex !== null) {
      this.emoteT += dt;
      const def = emoteAt(this.emoteIndex);
      if (!def || this.emoteT >= def.seconds || speed > 1.5 || (p.stance !== "stand" && p.stance !== "crouch")) this.emoteIndex = null;
    }
    const ep = this.emoteIndex !== null ? emotePose(this.emoteIndex, this.emoteT) : null;
    const emoting = !!ep && ep.weight > 0.02;
    this.mq?.update(p, dt, !!this.armedWith && this.gunShown, { kick: this.kickAmt, flinch: this.flinchAmt, jolt: this.joltAmt, legYaw: e.legYaw + plant, ads: e.ads, land: this.landAmt, stagger: this.staggerAt, headHit: this.headAt, emote: emoting ? ep : null, airJumps: p.airJumps, shots: this.shots }, this.lodAnimate);
    // a scoped figure glints (muzzle.ts, Hyper Scape's lens flare) only while it is looking down its scope (mannequin.ts
    // scoped): not while its gun is away, and not for an aim held through a reload, a swap, a throw or a strike
    if (this.mq?.glint) showGlint(this.mq.glint, this.gunShown ? this.mq.scoped : 0, this.glintT += dt);
    if (this.lodAnimate) this.followBones();
  }

  /** the soldier on now, not waiting on the frame's few (a figure made only to warm what it draws with: main.ts warmPortrait) */
  dressNow(): void {
    this.dress();
  }

  /**
   * A figure's soldier or gun is new (dress, setGun): the page builds its shaders then, in the background (main.ts,
   * Milestone 699). Figures put the soldier on a few a frame, so a battle royale's bots were dressed during the ship's
   * ride, after the match's own warm, and their guns' shaders were built on the frame each first came into view.
   */
  static onNewLook: ((d: Dummy) => void) | null = null;

  /** the frame's clock when figures last put the soldier on, and how many did on it (update) */
  private static dressFrame = -1;
  private static dressedNow = 0;

  /**
   * The soldier on this figure once it is ready (mannequin.ts useMannequin). A figure is its volumes alone until this
   * runs, which update() asks every frame; what was already set on it (its gun shown, a finish, its distance's shadow and eyes, a glow) carries on.
   * An outline made before is made again, so it takes in the soldier.
   */
  private dress(): void {
    if (this.mq || this.boardMat || !useMannequin()) return;
    const mq = new MannequinFigure(this.skin, this.armedWith);
    this.mq = mq;
    this.group.add(mq.root);
    mq.setGunVisible(this.gunShown);
    if (this.knocked) {
      mq.setDead(true);
      mq.root.rotation.x = -this.group.rotation.x;
    }
    this.paintGuns();
    this.setCastShadow(this.lodShadow);
    if (!this.lodEyes) mq.showEyes(false);
    if (!this.lodFullGun) this.showFarGun(true);
    this.outline?.dispose();
    this.outline = null;
    this.mateRing?.dispose();
    this.mateRing = null;
    this.revealRing?.dispose();
    this.revealRing = null;
    this.shell?.dispose();
    this.shell = null;
    this.cloak?.dispose();
    this.cloak = null;
    this.applyGlow();
    Dummy.onNewLook?.(this);
  }

  /**
   * SpeedKills' soldier: its hit volumes follow its bones. They were a fixed upright column, the figures' of before,
   * and the soldier leans into its gun, runs bent over and slides on its back: tools/soldier-hits.ts found its head a
   * third inside the head volume standing and wholly outside it running, sprinting, crouched and sliding, so a shot
   * on the head it showed missed it. Each volume keeps its size: the head sits on the head's own measured middle
   * (MannequinFigure.headMiddle), the torso on the line from the pelvis to the neck turned with the shoulders and the
   * plate on its front where it always was, each arm from its shoulder to its hand, the neck from neck to head, and
   * the legs from the pelvis to between the feet, stretched to that length.
   */
  private followBones(): void {
    const mq = this.mq;
    if (!mq?.soldier) return;
    const names = ["Head", "neck_01", "pelvis", "upperarm_l", "upperarm_r", "hand_l", "hand_r", "thigh_l", "thigh_r", "foot_l", "foot_r", "lowerarm_l", "lowerarm_r", "spine_02", "calf_l", "calf_r", "ball_l", "ball_r"] as const;
    const b = names.map((n) => mq.bone(n));
    const mid = mq.headMiddle();
    if (!mid || b.some((x) => !x)) return;
    this.group.updateMatrixWorld(true);
    const [head, neck, pelvis, shL, shR, haL, haR, thL, thR, ftL, ftR, elL, elR, sp2, knL, knR, baL, baR] = b.map((x) => new THREE.Vector3().setFromMatrixPosition(x!.matrixWorld));
    const toHits = FB_M.copy(this.hits.matrixWorld).invert();
    const hitsQ = this.hits.getWorldQuaternion(FB_Q).invert();
    // a volume's own frame: up along a bone line, across as near the figure's left as that allows, forward from the two
    const put = (m: THREE.Mesh, at: THREE.Vector3, up: THREE.Vector3, across: THREE.Vector3): void => {
      const y = FB_Y.copy(up).normalize();
      const x = FB_X.copy(across).addScaledVector(y, -across.dot(y)).normalize();
      const z = FB_Z.crossVectors(x, y);
      m.position.copy(at).applyMatrix4(toHits);
      m.quaternion.setFromRotationMatrix(FB_B.makeBasis(x, y, z)).premultiply(hitsQ);
    };
    const V = this.vols;
    if (!V.foreL || !V.belly || !V.handL) this.soldierVolumes();
    const left = shL.clone().sub(shR);
    // The torso's volume in two, both from spine_02 (where the box's middle was, standing): the chest up along the upper
    // chest to the neck, the belly down to the pelvis. One box along the pelvis to the neck leant with the whole back,
    // 26 degrees forward sprinting where the upper chest leans 17, and its top's back corner stood up behind the head:
    // from behind, 40 of every 499 shots at the head it showed went into it, sprinting, and 28 crouched.
    put(V.torso, sp2, neck.clone().sub(sp2), left);
    if (V.belly) put(V.belly, sp2, sp2.clone().sub(pelvis), left);
    // the plate where it sat on the column, above the torso's middle and in front of it, now in the torso's frame
    V.plate.position.copy(V.torso.position).add(FB_Y.set(0, 1.28 - 1.235, 0.19).applyQuaternion(V.torso.quaternion));
    V.plate.quaternion.copy(V.torso.quaternion);
    V.head.position.copy(mid).applyMatrix4(b[0]!.matrixWorld).applyMatrix4(toHits);
    // the head's volume its drawn head's own ellipsoid, turned with it (mannequin.ts headShape): the sphere before it
    // left the bottom of the back of the head out, and a shot there went through to the neck's volume
    const shape = mq.headShape();
    if (shape) {
      V.head.position.copy(shape.mid).applyMatrix4(b[0]!.matrixWorld).applyMatrix4(toHits);
      V.head.quaternion.copy(hitsQ).multiply(b[0]!.getWorldQuaternion(FB_Q2)).multiply(shape.turn);
      const k = b[0]!.getWorldScale(FB_S).x / this.hits.getWorldScale(FB_S).x / HEAD_R;
      V.head.scale.set(shape.half.x * k, shape.half.y * k, shape.half.z * k);
    }
    // The neck's volume from down at the torso's lowered back (figure.json neckBelow) up to where the neck's line goes
    // into the head's volume, and no further: the head takes the top of the neck its drawn head reaches down over. Up to
    // the Head bone, the two overlapped, and a shot at the top of the neck under the jaw from 30 degrees behind took the
    // neck, 5 of every 100 at the head shown there.
    const neckLine = head.clone().sub(neck).normalize();
    const neckFoot = neck.clone().addScaledVector(neckLine, -NECK_BELOW);
    let neckTop = head;
    if (shape) {
      // the line in the head volume's own frame, where it is the unit sphere: its first way in
      V.head.updateMatrix();
      const toUnit = FB_M2.copy(this.hits.matrixWorld).multiply(V.head.matrix).invert();
      const o = FB_A.copy(neckFoot).applyMatrix4(toUnit);
      const d = FB_C.copy(head).applyMatrix4(toUnit).sub(o);
      const r = HEAD_R;
      const qa = d.dot(d);
      const qb = 2 * o.dot(d);
      const qc = o.dot(o) - r * r;
      const disc = qb * qb - 4 * qa * qc;
      if (disc >= 0) {
        const t = (-qb - Math.sqrt(disc)) / (2 * qa);
        if (t > 0 && t < 1) neckTop = neckFoot.clone().lerp(head, t);
      }
    }
    put(V.neck, neckFoot.clone().lerp(neckTop, 0.5), neckLine, left);
    V.neck.scale.y = Math.max(1e-3, neckFoot.distanceTo(neckTop)) / NECK_H;
    // armL stands on the column's -x, the figure's right as it faces +z; armR on its left. Each arm two volumes round its
    // drawn arm (figure.json armVolume), shoulder to elbow and elbow to past the wrist: one 0.6 m box from the shoulder
    // to the hand stood half its length past a bent arm's shoulder, behind it and beside the head, and from 30 degrees
    // behind a shot at the head it showed went into it
    const limb = (m: THREE.Mesh | undefined, from: THREE.Vector3, to: THREE.Vector3): void => {
      if (!m) return;
      put(m, from.clone().lerp(to, 0.5), from.clone().sub(to), left);
      m.scale.y = Math.max(1e-3, from.distanceTo(to));
    };
    const past = (hand: THREE.Vector3, elbow: THREE.Vector3) => hand.clone().addScaledVector(hand.clone().sub(elbow).normalize(), ARM.hand);
    limb(V.armL, shR, elR);
    limb(V.foreL, elR, past(haR, elR));
    limb(V.armR, shL, elL);
    limb(V.foreR, elL, past(haL, elL));
    // Each leg a thigh and a calf round its bones and a box round its boot (figure.json legVolume), the right thigh in the
    // legs' own volume: one box from the pelvis to the feet stood between the legs and missed a leg a stride swung out
    // of it, and of the shots at a drawn leg 58 to 80 in 100 went into nothing
    limb(V.legs, thR, knR);
    limb(V.thighL, thL, knL);
    limb(V.calfR, knR, ftR);
    limb(V.calfL, knL, ftL);
    // the boot along its sole (the ankle to the ball, square to the calf) and up its calf
    const boot = (m: THREE.Mesh | undefined, ankle: THREE.Vector3, knee: THREE.Vector3, ball: THREE.Vector3): void => {
      if (!m) return;
      const up = knee.clone().sub(ankle).normalize();
      const sole = ball.clone().sub(ankle);
      sole.addScaledVector(up, -sole.dot(up));
      put(m, ankle, up, up.clone().cross(sole));
    };
    boot(V.footR, ftR, knR, baR);
    boot(V.footL, ftL, knL, baL);
    // Each hand a sphere round the fist as it closes on the gun (figure.json handVolume): with none, a shot at a hand,
    // the left round the fore-end out in front of the body above all, went through it into nothing
    const s = this.hits.getWorldScale(FB_S).x;
    for (const [m, side] of [[V.handL, "r"], [V.handR, "l"]] as const) {
      const wrist = mq.bone(`hand_${side}`);
      const knuckle = mq.bone(`middle_02_${side}`);
      if (!m || !wrist || !knuckle) continue;
      m.position.setFromMatrixPosition(wrist.matrixWorld).lerp(FB_A.setFromMatrixPosition(knuckle.matrixWorld), HAND.at).applyMatrix4(toHits);
      m.scale.setScalar(HAND.r / s);
    }
    this.hits.updateMatrixWorld(true);
  }

  /**
   * The soldier's own volumes, made the first time its volumes follow its bones: the torso's box becomes its chest
   * (its top half, from spine_02) and a belly under it, the upper arms' boxes become cylinders round the drawn upper
   * arms, and each arm gets a forearm (figure.json armVolume). Until the soldier is on, the boxes stand.
   */
  private soldierVolumes(): void {
    const V = this.vols;
    V.torso.geometry.dispose();
    V.torso.geometry = torsoVolume(0);
    const belly = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.315, 0.32).translate(0, -0.1575, 0), HITBOX);
    belly.userData.zone = "body";
    belly.castShadow = false;
    this.hits.add(belly);
    this.hitMeshes.push(belly);
    V.belly = belly;
    const cyl = (r: number[]) => new THREE.CylinderGeometry(r[0], r[1], 1, 10);
    for (const m of [V.armL, V.armR]) {
      m.geometry.dispose();
      m.geometry = cyl(ARM.upper);
    }
    const add = (k: "foreL" | "foreR" | "thighL" | "calfR" | "calfL" | "footR" | "footL" | "handL" | "handR", g: THREE.BufferGeometry, zone: string): void => {
      const m = new THREE.Mesh(g, HITBOX);
      m.userData.zone = zone;
      m.castShadow = false;
      this.hits.add(m);
      this.hitMeshes.push(m);
      V[k] = m;
    };
    for (const k of ["foreL", "foreR"] as const) add(k, cyl(ARM.fore), "body");
    // the legs: the right thigh in the legs' own volume (it keeps its place among the hit meshes), the rest added
    V.legs.geometry.dispose();
    V.legs.geometry = cyl(LEG.thigh);
    add("thighL", cyl(LEG.thigh), "legs");
    for (const k of ["calfR", "calfL"] as const) add(k, cyl(LEG.calf), "legs");
    const [fx, fy, fz] = LEG.foot.size;
    const [mx, my, mz] = LEG.foot.mid;
    for (const k of ["footR", "footL"] as const) add(k, new THREE.BoxGeometry(fx, fy, fz).translate(mx, my, mz), "legs");
    // the hands: unit spheres, sized as they follow the bones
    for (const k of ["handL", "handR"] as const) add(k, new THREE.SphereGeometry(1, 12, 8), "body");
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
  private lodEyes = true;
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
    if (w.eyes !== this.lodEyes) {
      this.lodEyes = w.eyes;
      this.mq?.showEyes(w.eyes);
    }
  }

  /** its own number, so the figures that skip frames do not all skip the same one (wide enough for any stride a frame rate gives) */
  private lodSpread = Math.floor(Math.random() * 64);

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
    const root = this.mq?.gunRoot;
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

  /**
   * The way to fall: away from where the last hit landed, if it was lately (figure.json death.hitFor), round from the
   * body's middle to it (a hit's point is on the near side, the shooter's); a hit at the middle itself leaves it facing
   * as it was. A figure knocked with no hit here (another page's shot) falls as it faces.
   */
  private faceTheShot(): void {
    const h = this.hitFrom;
    this.fallYaw = null;
    if (!h || this.idleT - h.at > DEATH.hitFor) return;
    const ax = this.group.position.x - h.x;
    const az = this.group.position.z - h.z;
    if (Math.hypot(ax, az) < DEATH.near) return;
    // it faces +z, and its yaw turns +z to (sin, cos): its back to `away`, its front to the shot
    this.fallYaw = Math.atan2(-ax, -az);
  }

  /** knocked by something other than a hit here (the 1v1 opponent going down) */
  fallDown(dropGun = true): void {
    if (this.knocked) return;
    this.knocked = true;
    this.fall = 0.0001;
    this.faceTheShot();
    this.respawnAt = Infinity;
    if (dropGun) this.dropGun();
    else {
      // a stand-in for a figure already down (a look change): no second drop, no gun in its hands
      this.mq?.setDead(true);
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
    return !!this.mq?.gunInHand;
  }

  /**
   * Knocked out: the gun it held leaves its hands, a copy tumbling from where
   * the hands were to the floor, the held one hidden. A figure with no gun
   * showing (fists, a heal, down already, a bot unarmed) drops nothing.
   */
  private dropGun(): void {
    const held = this.mq?.gunObject;
    const showing = !!this.mq?.gunInHand;
    this.mq?.setDead(true);
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
    const raw = baseDamage * mult * (this.shield <= 0 ? unshieldedScale : 1);
    const amount = raw;
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
    const scaled = remaining * shieldScale;
    const toShield = Math.min(this.shield, scaled);
    this.shield -= toShield;
    const through = (scaled - toShield) / shieldScale;
    remaining = scaled > 0 ? Math.max(0, through) : remaining;
    const toHealth = Math.min(this.health, remaining);
    this.health -= toHealth;
    const broke = toShield > 0 && this.shield === 0;
    const knocked = this.health <= 0;
    // hit flash by zone: the head alone in gold, the shell white for the body, blue for the legs
    if (zone === "head") this.headFlash = 1;
    else if (zone === "legs") this.legFlash = 1;
    else this.flash = 1;
    // a flinch on every hit, a stagger when the shield breaks
    this.flinchAmt = Math.min(1.5, this.flinchAmt + (broke ? 1.3 : 0.5));
    if (broke) this.staggerAt = this.idleT;
    // a headshot snaps the head back (mannequin.ts Hit_Head), so a player sees which shots were the head
    if (zone === "head") this.headAt = this.idleT;
    this.hitFrom = { x: point.x, z: point.z, at: this.idleT };
    if (knocked) {
      this.knocked = true;
      this.respawnAt = now + RESPAWN_S;
      this.fall = 0.0001;
      this.faceTheShot();
      this.dropGun();
    }
    // past the weapon's headshot range a head hit does body damage (the
    // caller passes a scale of 1), and it is not called a headshot either
    return { zone, amount: toShield + toHealth, toShield, toHealth, broke, knocked, headshot: zone === "head" && headshotScale > 1, point: point.clone() };
  }

  update(now: number, dt = 0): void {
    // the soldier goes on here, not when the figure is made: a few figures a frame (figure.json dressPerFrame), so the
    // range's and the courses' fifty, made before it was ready or all at once after, never stall a frame between them
    if (!this.mq && !this.boardMat && useMannequin()) {
      if (Dummy.dressFrame !== now) {
        Dummy.dressFrame = now;
        Dummy.dressedNow = 0;
      }
      if (Dummy.dressedNow < DRESS_PER_FRAME) {
        Dummy.dressedNow++;
        this.dress();
      }
    }
    // what this figure owes at its distance (figlod.ts): its animation, its shadow, its gun
    this.stepLod();
    if (this.knocked && this.respawns && now >= this.respawnAt) this.reset();
    this.stepDropped(dt);
    // the mannequin plays its own death clip
    if (this.knocked && this.mq) this.mq.updateDead(dt);

    // crouched or sliding: the hit zones shrink to two thirds (the same blend at any frame rate: 35% a frame at 60 fps),
    // until the soldier is on it, whose volumes follow its bones down (followBones) and are not squashed too
    const wantCrouch = this.pose.stance === "crouch" || this.pose.stance === "slide" ? 1 : 0;
    this.crouchAmt += (wantCrouch - this.crouchAmt) * (1 - Math.exp(-26 * dt));
    if (!this.boardMat) {
      this.hits.scale.y = this.mq ? 1 : 1 - 0.34 * this.crouchAmt;
      if (!this.knocked) this.animate(dt);
    }

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
      // turned to fall away from the shot as it starts to go (faceTheShot), the shortest way round
      if (this.fallYaw !== null) {
        const d = Math.atan2(Math.sin(this.fallYaw - this.group.rotation.y), Math.cos(this.fallYaw - this.group.rotation.y));
        this.group.rotation.y += d * Math.min(1, dt * DEATH.turnRate);
      }
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
    // the shield's flare fades over hud.json shieldFx.flare seconds; ARMOR's gold pulses while it lasts
    if (this.shellFlare > 0 || this.armored) {
      this.shellFlare = Math.max(0, this.shellFlare - (dt * SHIELD_FX.flare.peak) / SHIELD_FX.flare.seconds);
      this.drawShell();
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
      // face the firing line, sidestepping: its right is the world's -x as it faces +z (+pi/2 a move to its right)
      this.group.rotation.y = 0;
      this.pose = { speed: this.rail.speed, stance: "stand", pitch: 0, moveDir: this.railDir > 0 ? -Math.PI / 2 : Math.PI / 2 };
    }
  }
}
