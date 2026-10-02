// The first-person weapon: model, hands, and every animation on it.
//
// Cosmetic only. Nothing in here moves the aim or a bullet; the camera kick
// and the projectile direction are owned by recoil.ts and main.ts.
//
// What makes a viewmodel read as a real weapon rather than a prop, roughly in
// order of how much each one buys:
//
//   hands        a gun with nothing holding it is a floating object
//   the action   the bolt, slide, pump or cylinder moves on every shot
//   the flash    a muzzle flash that lights the world for two frames
//   the brass    casings leave the ejection port and fall out of frame
//   the reload   the magazine actually comes out, and the hand goes to it
//   lag          the gun trails your mouse slightly, so it has mass
//
// Everything is drawn at VM_SCALE of its true distance from the eye, about
// the eye. Perspective makes that invisible (a thing half the size at half the
// distance covers exactly the same pixels), and it means the gun is never
// more than about 30 cm in front of the camera, so it cannot clip into a wall
// the player is standing against: the player's own radius is 41 cm.
import * as THREE from "three";
import { loadQuality } from "./quality";
import { springStep } from "./spring";
import type { ResolvedWeapon } from "./weapons";
import { aimBowString, gunModel, setMagRarity, type GunModel } from "./gunmodels";
import { DOT_EYE, IRONS_EYE, openLenses, PAID_MOTION, setPaidLevel, tintDots } from "./paidgun";
import { Forearm, Hand } from "./arms";
import { FpArms } from "./fparms";
import { BEFORE_FRAME, FREE, HIP_PITCH, LOCO, PACK_INSPECT, PACK_MELEE, PACK_PALM, PACK_RELOAD, PICKUP, PackArms, SWAP_CUP, SWAP_THROW, packGunFor, type FreeHand, type PackArmsFrame } from "./fprig";
import type { OperatorSkin } from "./operators";
import { buildOptic, type OpticModel } from "./optics";
import { heirloomModel, type HeirloomModel } from "./heirlooms";
import armCfg from "../config/viewmodel.json";
import feelCfg from "../config/gunfeel.json";
import { HackCard, hackCard } from "./hackcast";
import { newSweep, phaseMeshes } from "./phase";
import { IS_SK, PROFILE } from "./game";

/** how much of a reload's pose is gone in the sights (speedkills.json viewmodel; the legacy game keeps all of it) */
const RELOAD_ADS = PROFILE.viewmodel?.reloadAds ?? 0;
/** the gun in your hands at 2048 on the High preset (paidweapons.json textures2k; a change of preset reloads the page) */
const HI_TEX = loadQuality().preset === "high";

/** a melee swing, seconds */
export const MELEE_TIME = 0.38;

export const VM_SCALE = 0.42;
/** eye to rear sight when aiming down sights, before VM_SCALE */
const ADS_EYE = 0.26;

export interface VMFrame {
  dt: number;
  adsFrac: number;
  moveSpeed: number;
  /** sideways speed against the view, m/s, + to the right: what the gun rolls into */
  strafe?: number;
  onGround: boolean;
  /** 0..1 through a weapon swap, 1 when settled */
  raise: number;
  sprinting: boolean;
  /** in a slide: the gun rides low and rolled, still ready to fire */
  sliding: boolean;
  /** on a wall: the support hand goes up the wall, the gun hangs low */
  climbing: boolean;
  /** in a mantle: both hands go to the ledge */
  mantling: boolean;
  /** the magazine is empty: a pistol's slide locks back */
  clipEmpty: boolean;
  /** vertical speed, m/s, for the jump lift and the fall float */
  vy: number;
  reloading: boolean;
  reloadProgress: number;
  /** degrees the view turned this frame; positive yaw = left, pitch = up */
  lookYaw: number;
  lookPitch: number;
  /** the player's landing dip, metres, negative = down */
  landDip: number;
  /** 0..1 holstered: the gun is lowered out of frame and the empty hands come up */
  lowered: number;
  /** riding a zipline: the left hand goes up to the trolley */
  onZip: boolean;
  /** a bow: 0..1 drawn */
  draw?: number;
  /** 0..1 through an inspect (holding reload with a full magazine), or undefined */
  inspect?: number;
  /** the hacks carried, mobility first: each floats over the open palm on an inspect, its fusion level on its card */
  hacks?: Array<{ id: string; level: number; of: number; slot: "mobility" | "utility" }>;
  /** 0..1 through a new gun's first-draw flourish, or undefined */
  flourish?: number;
  /** 1 down, not out: no gun, the hands low on the floor, reaching in turn as you crawl */
  downed?: number;
  /** how full the magazine is, 0..1: a signature gun's glow flickers when it is nearly out */
  clipFrac?: number;
  /** the rounds in the magazine (a signature gun's screen shows them) */
  clip?: number;
}

/**
 * an inspect's length in the view's own arms, s (the bought arms' is their own: ViewModel inspectTime), and a first
 * draw's flourish (ours: cosmetic, the gun is usable throughout)
 */
export const INSPECT_TIME = 3.2;
export const FLOURISH_TIME = 0.95;

/** how hard the gun and the empty hands pump while sprinting (1 = the old swing) */
const SPRINT_PUMP = 1.6;
/** how much of the sprint pose (low, rolled and swung) the gun takes (speedkills.json viewmodel sprintPose; the legacy game all) */
const SPRINT_POSE = (PROFILE.viewmodel as { sprintPose?: number } | undefined)?.sprintPose ?? 1;

/** a signature gun's feel in the hands (gunfeel.json guns) */
interface GunFeel {
  swap: { out: number[]; in: number[]; move: number; rise: number; roll: number };
  holster: { out: number[] };
  kick: { impulse: number; spring: number; damp: number; back: number; up: number; yaw: number; roll: number };
  buzz?: { amp: number; hz: number };
  pulse: { glow: number; decay: number };
  charge?: { drained: number; ready: number };
  reload: { magOut: number[]; magIn: number[]; seat: number; snap: number; pulse: number; drop: number; twist?: { roll: number; yaw: number; pitch: number; x: number; y: number; z: number } };
  /** BOOG: over this share of the rechamber after a shot the gun cants over and back at the hip, its wheels turning */
  cycle?: { at: number[]; roll: number; yaw: number; y: number };
  flash: FlashStyle;
  shell: "cell";
  rack?: number[];
  /** the support hand's way to the handle before the rack and back after it, shares of the reload */
  rackHand?: number[];
  scan: { inspect: number; fusion: number };
  ads: number;
  lowAmmo: number;
  scope?: { boot: number; style?: string };
  hip?: number[];
  screen?: { y: number; z: number; w: number; h: number; color: string };
  tracer?: { color: string; width: number };
}

/** how much of your own muzzle flash is drawn, 0 to 1 (gunfeel.json flashOpacity) */
const FLASH_OPACITY = (feelCfg as unknown as { flashOpacity: number }).flashOpacity;
/** an inspect's glow on a signature gun, as the hack cards glow (gunfeel.json inspectGlow) */
const INSPECT_GLOW = (feelCfg as unknown as { inspectGlow: { base: number; depth: number; rate: number; in: number[]; out: number[] } }).inspectGlow;
/** a signature gun's muzzle flash (gunfeel.json flash) */
interface FlashStyle {
  color: string;
  scale: number;
  life: number;
  ring: number;
}

/** what a signature gun has just done that has a sound (main.ts plays it): phased in or out, BOOG recharging or ready, a rack, a scan, into the sights */
export type FeelSound = "in" | "out" | "recharge" | "ready" | "rack" | "scan" | "ads";
const FEEL = feelCfg.guns as unknown as Record<string, GunFeel>;
/** the draw's spin and a fusion's flood (gunfeel.json spin, fuse) */
const SPIN = feelCfg.spin;
const FUSE = feelCfg.fuse;

const smooth = (a: number, b: number, x: number): number => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));

// ------------------------------------------------------------------ the arms

/** which set of shoulders a gun uses: the kind of hold its support hand has (gunmodels.ts) */
export type ArmFamily = GunModel["support"]["kind"];

/**
 * Where a forearm's far end sits, in the camera's own space: low, wide, and
 * far enough down to be off the bottom of the frame. It stands for a joint on
 * the body, and a body joint does not move when the gun moves, so this is the
 * one place in the viewmodel that is NOT gun-local. Aiming is the exception:
 * it brings the support elbow in under the gun, so that arm has two points and
 * blends between them. Numbers: src/config/viewmodel.json.
 */
export function shoulderAnchor(out: THREE.Vector3, family: ArmFamily, side: "right" | "left", ads: number): THREE.Vector3 {
  const s = armCfg.shoulders[family];
  if (side === "right") return out.fromArray(s.right);
  return out.fromArray(s.leftHip).lerp(TMP_A.fromArray(s.leftAds), clamp(ads, 0, 1));
}

/**
 * The gun's position, moved so that a turn in the hands happens about the
 * gun's own centre instead of about the model's origin, which is back at the
 * receiver. Turning about a point behind the gun throws the barrel across the
 * screen and drags the hands with it; turning about the middle of the gun is
 * what a hand does when it rolls a weapon over to look at it.
 *
 * `base` is where the gun was pointing before the turn, `turned` after it.
 * Writes into `pos` and returns it.
 */
export function turnAboutCentre(pos: THREE.Vector3, base: THREE.Euler, turned: THREE.Euler, centre: THREE.Vector3): THREE.Vector3 {
  TMP_A.copy(centre).applyQuaternion(TMP_Q.setFromEuler(base));
  TMP_B.copy(centre).applyQuaternion(TMP_Q.setFromEuler(turned));
  return pos.add(TMP_A).sub(TMP_B);
}

/**
 * An inspect's own offset and turn, 0..1 through it: the gun comes up and
 * turns to show its left side, then over to its right and top, and settles
 * back into the hands. Pure, so tools can walk the whole animation
 * (tools/checks/viewmodel-arms.ts).
 */
export function inspectTurn(t: number, pos: THREE.Vector3, rot: THREE.Euler): void {
  const k1 = smooth(0.04, 0.26, t) - smooth(0.44, 0.62, t);
  const k2 = smooth(0.44, 0.62, t) - smooth(0.84, 1, t);
  const up = k1 + k2;
  pos.set(-0.07 * up, 0.05 * up, -0.05 * up);
  rot.set(-0.2 * k1 + 0.35 * k2, 1.05 * k1 - 0.75 * k2, -0.55 * k1 + 0.95 * k2);
}

const TMP_A = new THREE.Vector3();
const TMP_B = new THREE.Vector3();
const TMP_Q = new THREE.Quaternion();

// ------------------------------------------------------------ muzzle flash

function flashTexture(kind: "star" | "flame"): THREE.CanvasTexture {
  const S = 128;
  const cv = document.createElement("canvas");
  cv.width = cv.height = S;
  const g = cv.getContext("2d")!;
  const c = S / 2;
  if (kind === "star") {
    const core = g.createRadialGradient(c, c, 0, c, c, c);
    core.addColorStop(0, "rgba(255,255,255,1)");
    core.addColorStop(0.16, "rgba(255,255,255,0.9)");
    core.addColorStop(0.45, "rgba(255,255,255,0.28)");
    core.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = core;
    g.fillRect(0, 0, S, S);
    g.globalCompositeOperation = "lighter";
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2 + 0.3;
      const len = c * (0.72 + (0.28 * ((i * 37) % 5)) / 4);
      g.save();
      g.translate(c, c);
      g.rotate(a);
      const sg = g.createLinearGradient(0, 0, len, 0);
      sg.addColorStop(0, "rgba(255,255,255,0.85)");
      sg.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = sg;
      g.beginPath();
      g.moveTo(0, -5);
      g.lineTo(len, 0);
      g.lineTo(0, 5);
      g.closePath();
      g.fill();
      g.restore();
    }
  } else {
    // a tapered flame: base at the left edge, tip at the right
    for (let x = 0; x < S; x++) {
      const t = x / S;
      const half = (S / 2) * (0.25 + 0.75 * Math.sin(Math.PI * Math.min(1, t * 1.25))) * (1 - t * 0.7);
      const grd = g.createLinearGradient(0, c - half, 0, c + half);
      const a = (1 - t) * 0.95;
      grd.addColorStop(0, "rgba(255,255,255,0)");
      grd.addColorStop(0.5, `rgba(255,255,255,${a})`);
      grd.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = grd;
      g.fillRect(x, c - half, 1, half * 2);
    }
  }
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

class MuzzleFlash {
  readonly group = new THREE.Group();
  private readonly star: THREE.Mesh;
  private readonly mats: THREE.MeshBasicMaterial[] = [];
  private life = 0;
  /** how long this flash lasts, s */
  private span = 0.035;
  /** a signature gun's shockwave: a ring off the muzzle, facing along the barrel, growing as it fades (gunfeel.json flash ring) */
  private readonly ring: THREE.Mesh;
  private readonly ringMat: THREE.MeshBasicMaterial;
  private ringLife = 0;

  constructor() {
    const mk = (tex: THREE.Texture) => {
      const m = new THREE.MeshBasicMaterial({
        map: tex,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        forceSinglePass: true,
      });
      this.mats.push(m);
      return m;
    };
    this.star = new THREE.Mesh(new THREE.PlaneGeometry(0.085, 0.085), mk(flashTexture("star")));
    this.group.add(this.star);
    const flameTex = flashTexture("flame");
    for (const roll of [0, Math.PI / 2]) {
      const g = new THREE.PlaneGeometry(0.14, 0.06);
      g.translate(0.07, 0, 0);
      g.rotateY(Math.PI / 2);
      g.rotateZ(roll);
      this.group.add(new THREE.Mesh(g, mk(flameTex)));
    }
    this.ringMat = new THREE.MeshBasicMaterial({ color: 0xc8faff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, forceSinglePass: true });
    this.ring = new THREE.Mesh(new THREE.RingGeometry(0.018, 0.026, 40), this.ringMat);
    this.ring.visible = false;
    this.group.add(this.ring);
    // Named so a model cloned for a dummy's hands can strip it.
    this.group.name = "muzzleflash";
    // No muzzle light any more. It lit the floor on every shot, which read as
    // a strobe on automatic fire, and every point light costs every lit pixel.
    this.group.visible = false;
  }

  fire(energy: boolean, style?: FlashStyle): void {
    this.life = 1;
    this.span = style?.life ?? 0.035;
    // Just over 1: bright enough to read, barely enough to bloom.
    const c = style ? new THREE.Color(style.color).multiplyScalar(1.4) : energy ? new THREE.Color(0x7ff0ff).multiplyScalar(1.3) : new THREE.Color(0xffa24a).multiplyScalar(1.4);
    for (const m of this.mats) m.color.copy(c);
    this.star.rotation.z = Math.random() * Math.PI * 2;
    const s = (0.6 + Math.random() * 0.3) * (style?.scale ?? 1);
    this.group.scale.set(s, s, 0.75 + Math.random() * 0.6);
    this.group.visible = true;
    this.ringLife = style?.ring ? 1 : 0;
    this.ring.visible = this.ringLife > 0;
    this.ringMat.color.copy(c);
  }

  update(dt: number): void {
    if (this.ringLife > 0) {
      // the shockwave: 0.14 s, widening sixfold as it goes
      this.ringLife -= dt / 0.14;
      const k = Math.max(0, this.ringLife);
      this.ring.visible = k > 0;
      this.ring.scale.setScalar(1 + (1 - k) * 5);
      this.ringMat.opacity = k * k;
    }
    if (this.life <= 0) {
      this.group.visible = this.ringLife > 0;
      for (const c of this.group.children) if (c !== this.ring) c.visible = false;
      return;
    }
    for (const c of this.group.children) if (c !== this.ring) c.visible = true;
    this.life -= dt / this.span;
    const a = Math.max(0, this.life);
    this.group.visible = a > 0 || this.ringLife > 0;
    for (const m of this.mats) m.opacity = a * FLASH_OPACITY;
  }
}

// ------------------------------------------------------------------- brass

interface Shell {
  mesh: THREE.Mesh;
  vel: THREE.Vector3;
  spin: THREE.Vector3;
  life: number;
  /** an energy cell shrinks away over its life */
  cell: boolean;
}

/** spent casings, in viewmodel space, so they leave the gun and drop out of frame */
class Shells {
  readonly group = new THREE.Group();
  private readonly pool: Shell[] = [];
  private next = 0;
  private readonly brassGeo = new THREE.CylinderGeometry(0.0046, 0.0046, 0.02, 10);
  private readonly hullGeo = new THREE.CylinderGeometry(0.0095, 0.0095, 0.032, 12);
  private readonly brass = new THREE.MeshStandardMaterial({ color: 0xc89a4a, metalness: 1, roughness: 0.28 });
  private readonly hull = new THREE.MeshStandardMaterial({ color: 0xb0281e, metalness: 0.05, roughness: 0.55 });
  /** a signature gun's casing (gunfeel.json shell): a glowing cell, light rather than metal, that shrinks away as it falls */
  private readonly cellGeo = new THREE.CapsuleGeometry(0.0034, 0.012, 3, 8).rotateX(Math.PI / 2);
  private readonly cellMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0x8ff2ff).multiplyScalar(1.5), toneMapped: false });

  constructor() {
    for (let i = 0; i < 18; i++) {
      const mesh = new THREE.Mesh(this.brassGeo, this.brass);
      mesh.visible = false;
      mesh.castShadow = false;
      this.group.add(mesh);
      this.pool.push({ mesh, vel: new THREE.Vector3(), spin: new THREE.Vector3(), life: 0, cell: false });
    }
  }

  emit(at: THREE.Vector3, kind: "brass" | "hull" | "cell", vel: THREE.Vector3): void {
    const s = this.pool[this.next];
    this.next = (this.next + 1) % this.pool.length;
    s.mesh.geometry = kind === "hull" ? this.hullGeo : kind === "cell" ? this.cellGeo : this.brassGeo;
    s.mesh.material = kind === "hull" ? this.hull : kind === "cell" ? this.cellMat : this.brass;
    s.cell = kind === "cell";
    s.mesh.scale.setScalar(1);
    s.mesh.position.copy(at);
    s.mesh.rotation.set(Math.PI / 2, 0, 0);
    s.vel.copy(vel);
    s.spin.set((Math.random() - 0.5) * 30, (Math.random() - 0.5) * 30, (Math.random() - 0.5) * 30);
    s.life = 0.7;
    s.mesh.visible = true;
  }

  update(dt: number): void {
    for (const s of this.pool) {
      if (s.life <= 0) continue;
      s.life -= dt;
      s.vel.y -= 9.8 * dt;
      s.mesh.position.addScaledVector(s.vel, dt);
      s.mesh.rotation.x += s.spin.x * dt;
      s.mesh.rotation.y += s.spin.y * dt;
      s.mesh.rotation.z += s.spin.z * dt;
      if (s.cell) s.mesh.scale.setScalar(Math.max(0.05, s.life / 0.7));
      if (s.life <= 0) s.mesh.visible = false;
    }
  }
}

// --------------------------------------------------------------- viewmodel

export class ViewModel {
  /** child of the camera, scaled about the eye */
  readonly group = new THREE.Group();
  private readonly pose = new THREE.Group();
  private readonly holder = new THREE.Group();

  private model: GunModel | null = null;
  private weapon: ResolvedWeapon | null = null;
  private key = "";

  private readonly right = new Hand(false);
  private readonly left = new Hand(true);
  private readonly rightArm = new Forearm();
  private readonly leftArm = new Forearm();
  private readonly flash = new MuzzleFlash();

  /** the gun's muzzle in the world, for a tracer to start at (null with no gun in hand) */
  muzzleWorld(): THREE.Vector3 | null {
    if (!this.flash.group.parent) return null;
    this.flash.group.updateWorldMatrix(true, false);
    return this.flash.group.getWorldPosition(new THREE.Vector3());
  }
  private readonly shells = new Shells();
  private optic: OpticModel | null = null;

  // Holstered, Apex keeps your hands on screen: two loose fists that pump
  // while you sprint. They are their own rig, parented to the camera rather
  // than to the gun, so they stay when the gun goes.
  private readonly fists = new THREE.Group();
  private readonly fistR = new Hand(false, true);
  private readonly fistL = new Hand(true, true);
  private readonly fistArmR = new Forearm();
  private readonly fistArmL = new Forearm();
  private readonly fistElbowR = new THREE.Vector3();
  private readonly fistElbowL = new THREE.Vector3();
  /** the heirloom in the right fist, undoing the fist's roll so the blade points up and forward */
  private readonly heirloomHolder = new THREE.Group();
  private heirloom: HeirloomModel | null = null;
  private heirloomId = "";
  private meleeAt = -Infinity;

  // On a zipline the left hand holds the trolley overhead.
  private readonly zipRig = new THREE.Group();
  /** the player's own arms, posed onto the drawn gloves once they are in (fparms.ts) */
  private readonly real = new FpArms();
  /**
   * The bought first-person arms (fprig.ts, KINEMATION's pack) holding the gun, where a pack gun stands in for it: the
   * USSO and BOOG first. While they hold it, its own clips lead: the reload's twist, drop and hand, and BOOG's cant, stand
   * down, and the view's own arms are hidden
   */
  private readonly pack = new PackArms();
  private packOn = false;
  /** how far the gun is framed as before the refit, 0..1, while a move made there plays (fparms.json beforeFrame) */
  beforeW = 0;
  /** this frame's reload turn, 0..1 (the point's and the rack pose's together): a reload is framed as before the refit by it */
  private reloadFrameW = 0;
  /**
   * the rest look's move undone and the one before the refit done (inspectLook): a melee's places and an inspect's open
   * hand were set where the shoulders were under that look, and the shoulders move with the look
   */
  private readonly beforeLook = new THREE.Matrix4();
  /** the gun's swap and holster phase this frame, before a fusion's flood: the bought arms drop out as it goes */
  private swapPhase = 1;
  private readonly locoPos = new THREE.Vector3();
  /** the bought arms off a gun this frame (the fists, the crawl), and where their hands are */
  private packFree = false;
  private readonly freeHands: { l: FreeHand; r: FreeHand } = {
    l: { at: new THREE.Vector3(), along: new THREE.Vector3(), palm: new THREE.Vector3(), fist: 1 },
    r: { at: new THREE.Vector3(), along: new THREE.Vector3(), palm: new THREE.Vector3(), fist: 1 },
  };
  /** an inspect's hacks over the open left palm (the bought arms), each with the sweep it phases out by when tossed */
  private readonly palmCards = [0, 1].map(() => new HackCard(armCfg.hackCast.card.size, armCfg.hackCast.amber, 0, { solid: true, glow: true, sweep: newSweep(feelCfg.phase) }));
  /** the hack, level and slot each card shows */
  private readonly palmCardIds = ["", ""];
  /** where the cards float in the view this frame (their middle's height) and how whole they are (the checks) */
  private palmCardY = 0;
  private palmWhole = 1;
  /** how far the open palm is up this frame (the checks) */
  private palmW = 0;
  /** the pack's swap's swing of the gun this frame, in the view's space (the arms go with it: fprig.ts swing) */
  private readonly swapArms = new THREE.Matrix4();
  /** where the rest level turns the gun about: its origin before the swap's swing and the move to the gun's own place */
  private readonly levelAt = new THREE.Vector3();
  /** this frame's turn of the rest hold to the gun's own place (fparms.json hipOwn), in the view's space */
  private readonly hipOwnQ = new THREE.Quaternion();
  private readonly tmpQ = new THREE.Quaternion();
  /** the pitch taken off the bought arms' gun at rest this frame (the arms turn with it: fprig.ts level) */
  private levelBy = 0;
  /** when something was last taken off the ground (the bought arms' pickup), view seconds */
  private pickupAt = -Infinity;
  /** how far into the pack's sprint the gun is, 0..1 */
  private packSprint = 0;
  private readonly locoQuat = new THREE.Quaternion();
  /** whether the drawn gloves and forearms are showing, so they are hidden or shown once rather than every frame */
  private drawnShown = true;
  private readonly zipHand = new Hand(true);
  private readonly zipArm = new Forearm();
  private readonly zipElbow = new THREE.Vector3();
  /** a hack's cast (hackcast.ts): the left hand up off the gun, its card, and when it began */
  private readonly castRig = new THREE.Group();
  private readonly castHand = new Hand(true);
  private readonly castArm = new Forearm();
  private readonly castCard = new HackCard(armCfg.hackCast.card.size, armCfg.hackCast.amber, armCfg.hackCast.burst);
  private castAt = -Infinity;
  private castTapped = true;
  /** the hack's tap, for its sound and the hack's own effect (main.ts) */
  onCastTap: (() => void) | null = null;
  /** what is in view (tools/e2e.ts): the gun, the empty hands, how far down */
  get shown(): { gun: boolean; hands: boolean; down: number; ads: number } {
    return { gun: this.group.visible && this.holder.visible, hands: this.group.visible && this.fists.visible, down: this.downAmt, ads: this.lastAds };
  }
  /** 0..1 down (the crawl's hands), eased, and the crawl's cycle */
  private downAmt = 0;
  private crawlT = 0;
  private zipAmt = 0;

  // resting placements for this model, gun-local
  private readonly supportBase = new THREE.Vector3();
  // ...and where each forearm ends, which is the one thing here that does not
  // belong to the gun: a joint on the body, fixed in the camera's space and
  // carried back into gun space once a frame
  private readonly armEndR = new THREE.Vector3();
  private readonly armEndL = new THREE.Vector3();
  private armFamily: ArmFamily = "guard";
  /** the middle of the gun, gun-local: what an inspect or a flourish turns about */
  private readonly gunCentre = new THREE.Vector3();
  /** half the gun's box's diagonal, gun-local: how far a swap's phase reaches out from its middle */
  private gunRadius = 0.3;
  /**
   * our trigger, gun-local (packRefresh): what an inspect turns about in the bought arms' hands. About the gun's middle,
   * far ahead of the grip on a long gun, BOOG's grip swung out of the right arm's reach, 20 cm short, the hand off it
   */
  private readonly gunGrip = new THREE.Vector3();
  private gunGripOn = false;
  /** the right forearm's line in the view at rest with the bought arms (measured each frame off an inspect) */
  private readonly forearmR = new THREE.Vector3();
  private forearmOn = false;
  /** how far this frame's inspect has the gun rolled, 0..1 (the right forearm takes it) */
  private rollR = 0;
  /** how far this frame's thrown swap has the hands off the gun, 0..1 */
  private throwRelease = 0;
  /** how far open the hands are on a thrown swap, 0..1 */
  private readonly throwOpen = { l: 0, r: 0 };
  /** how far the hands have backed off a thrown gun, 0..1 */
  private readonly throwLeave = { l: 0, r: 0 };
  private readonly boltBase = new THREE.Vector3();
  /** where the support hand holds the charging handle this frame */
  private readonly rackAt = new THREE.Vector3();
  /** the gun's own roll this frame, before any turn about its centre (feelState, tools/e2e.ts) */
  private rollNow = 0;
  /** how far the support hand is on the charging handle, 0..1: a knob, not a bar, so its wrist may turn any way (fparms.ts) */
  private onKnob = 0;
  private readonly pumpBase = new THREE.Vector3();
  private readonly magBase = new THREE.Vector3();
  private readonly cylBase = new THREE.Vector3();

  // animation state
  private t = 0;
  private lastShotAt = -Infinity;
  private kick = 0;
  private kickVel = 0;
  private kickYaw = 0;
  private kickRoll = 0;
  /**
   * SpeedKills' signature gun in hand (gunfeel.json), or null for every other: it phases in and out of the hands
   * (phase.ts), kicks on its own spring, pulses its glow on a shot and phases its magazine out and a new one in
   */
  private feel: GunFeel | null = null;
  private readonly bodySweep = newSweep(feelCfg.phase);
  private readonly magSweep = newSweep(feelCfg.phase);
  /** the ends of the gun along its barrel (stock, muzzle) in its own space, and the magazine's top and bottom in its */
  private readonly gunNear = new THREE.Vector3();
  private readonly gunFar = new THREE.Vector3();
  private readonly magTop = new THREE.Vector3();
  private readonly magEnd = new THREE.Vector3();
  /** the magazine's middle, in its own frame, and half its box's diagonal: what a radial phase grows out from and reaches */
  private readonly magMid = new THREE.Vector3();
  private magRadius = 0.05;
  private feelKick = 0;
  private feelKickVel = 0;
  /** the glow's jump on a shot, a seat or a gun coming whole, 1 at its height, falling away */
  private pulse = 0;
  private lastPhase = 1;
  private lastReloadP = 0;
  /** the reload running started with the magazine empty (the USSO racks its handle after the seat) */
  private reloadEmpty = false;
  /** this frame's reload share on the bought arms' timeline: a tactical reload's read onto the empty one's */
  private packRP = 0;
  /** last frame's, for the seat's moment on that timeline */
  private lastPackRP = 0;
  private racked = false;
  /** a fusion's scan: when it started, or -Infinity */
  private scanAt = -Infinity;
  /** a fusion's flood: when it started */
  private fuseAt = -Infinity;
  private readonly spinQ = new THREE.Quaternion();
  private readonly spinV = new THREE.Vector3();
  /** BOOG's recharge: how far through it last frame, for the ready flash's sound */
  private lastCharge = 2;
  private lastAdsFeel = 0;
  /** what a signature gun has just done that has a sound: main.ts plays it (audio.ts) */
  onFeel: ((kind: FeelSound, seconds?: number) => void) | null = null;
  private readonly glowBase = new Map<THREE.Material, number>();
  private readonly hipFeel = new THREE.Vector3();
  /** a signature gun's screen (gunfeel.json screen): its canvas, and what it last drew */
  private screenCv: HTMLCanvasElement | null = null;
  private screenTex: THREE.CanvasTexture | null = null;
  private screenDrawn = "";
  private cylAngle = 0;
  private cylTarget = 0;
  /** a bought launcher's drum (paidgun.ts parts): where it is, and the chamber it is turning to */
  private drumAngle = 0;
  private drumTarget = 0;
  private bobT = 0;
  private sprintAmt = 0;
  /** -1..1 into a strafe, eased (viewmodel.json strafe) */
  private strafeAmt = 0;
  private slideAmt = 0;
  private climbAmt = 0;
  private mantleAmt = 0;
  private wasOnGround = true;
  /** a fresh weapon in hand: the bolt gets a chamber check as it comes up */
  private checkAt = -Infinity;
  private checkPending = false;
  /** the draw settle: a spring kicked when the gun comes up */
  private settle = 0;
  private settleVel = 0;
  private lastRaise = 1;
  private lastLowered = 0;
  private swayX = 0;
  private swayY = 0;
  private lastAds = 0;
  private cycleEjected = true;
  private reloadEjected = false;

  private readonly tmp = new THREE.Vector3();
  private readonly tmp2 = new THREE.Vector3();
  private readonly tmp3 = new THREE.Vector3();
  /** the inverse of the gun's pose: a body joint comes back through it into gun space */
  private readonly poseInv = new THREE.Matrix4();
  /** the gun's own space to the camera's, for the arms' near-plane guard */
  private readonly armView = new THREE.Matrix4();
  /** where the gun points before any turn in the hands, so the turn can be about its centre */
  private readonly baseRot = new THREE.Euler();
  private readonly turnPos = new THREE.Vector3();
  private readonly turnRot = new THREE.Euler();

  constructor() {
    this.group.scale.setScalar(VM_SCALE);
    this.group.add(this.pose);
    this.group.add(this.shells.group);
    this.pose.add(this.holder);
    // the pack's clip moves the gun within the hands (a reload's tilt): between the holder and the gun
    this.holder.add(this.pack.gunDelta);
    for (const o of [this.right.group, this.left.group, this.rightArm.group, this.leftArm.group]) this.holder.add(o);

    for (const o of [this.fistR.group, this.fistL.group, this.fistArmR.group, this.fistArmL.group]) this.fists.add(o);
    this.heirloomHolder.rotation.z = -Math.PI * 0.42;
    this.fistR.group.add(this.heirloomHolder);
    this.fists.visible = false;
    this.group.add(this.fists);

    // the trolley: a yellow block with a wheel, the hand closed round its bar
    const trolleyMat = new THREE.MeshStandardMaterial({ color: 0xe8b02c, roughness: 0.5, metalness: 0.3 });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x2b2f35, roughness: 0.45, metalness: 0.55 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.1), trolleyMat);
    body.position.set(0, 0.075, 0);
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.02, 18).rotateZ(Math.PI / 2), darkMat);
    wheel.position.set(0, 0.115, 0);
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.08, 10), darkMat);
    bar.position.set(0, 0.02, 0);
    this.zipRig.add(body, wheel, bar, this.zipHand.group);
    this.zipRig.visible = false;
    this.zipArm.group.visible = false;
    this.group.add(this.zipRig, this.zipArm.group);
    this.castRig.add(this.castHand.group);
    this.castRig.visible = false;
    this.castArm.group.visible = false;
    this.group.add(this.castRig, this.castArm.group, this.castCard.group, ...this.palmCards.map((c) => c.group));
    this.group.add(this.real.group);
    this.group.add(this.pack.group);
    if (IS_SK) void this.pack.load().then((ok) => ok && this.packRefresh());
  }

  /** show this weapon; cheap to call every frame */
  setWeapon(w: ResolvedWeapon): void {
    const key = `${w.id}:${w.magLevel}:${w.optic ?? w.integralOptic ?? ""}:${w.fusion ?? 0}`;
    if (key === this.key) return;
    this.key = key;
    this.weapon = w;
    const fresh = !this.model || this.model.id !== w.id;
    if (!this.model || this.model.id !== w.id) {
      // The optic comes off the old gun first. Models are cached per weapon, so
      // one left on would still be there on the way back, under the next one.
      this.dropOptic();
      if (this.model) this.model.root.removeFromParent();
      const m = gunModel(w.id);
      // aimed down a bought gun's own scope, so its painted glass comes out (paidgun.ts)
      openLenses(m);
      this.model = m;
      // the middle of the gun, measured before it is parented or given a
      // flash, so the box is the weapon itself in its own space; and at rest:
      // a cached model keeps the place a throw or a draw's spin last gave its
      // root, and measured there the middle was wherever the gun was left in
      // the air (the spin and the throw turn about it, and a USSO aimed after
      // one draw and not after another, the owner, 2026-09-29)
      m.root.position.set(0, 0, 0);
      m.root.quaternion.identity();
      const box = new THREE.Box3().setFromObject(m.root);
      box.getCenter(this.gunCentre);
      this.gunRadius = Math.max(0.01, box.getSize(new THREE.Vector3()).length() / 2);
      this.pack.gunDelta.add(m.root);
      m.root.add(this.flash.group);
      this.flash.group.position.copy(m.muzzle);
      if (m.bolt) this.boltBase.copy(m.bolt.position);
      if (m.pump) this.pumpBase.copy(m.pump.position);
      if (m.mag) this.magBase.copy(m.mag.position);
      if (m.cylinder) this.cylBase.copy(m.cylinder.position);
      this.placeHands(m);
      this.cylAngle = this.cylTarget = 0;
      this.drumAngle = this.drumTarget = 0;
      this.setFeel(m, w);
      this.packRefresh();
      // a different gun in hand: a chamber check once it has come up
      this.checkPending = true;
    }
    // no optic fitted: a scoped weapon (the Kraber) wears its own
    this.fitOptic(this.model, w.optic ?? w.integralOptic);
    setMagRarity(this.model, w.magLevel);
    // a bought gun wears its fusion level (paidgun.ts); a signature gun fused up in the hands scans along its new skin
    if (this.model.root.userData.paid && (this.model.root.userData.paidLevel !== (w.fusion ?? 0) || this.model.root.userData.paidHi !== HI_TEX)) {
      if (this.feel && !fresh && (w.fusion ?? 0) > (this.model.root.userData.paidLevel as number)) {
        this.scanAt = this.t;
        this.fuseAt = this.t;
        this.pulse = Math.max(this.pulse, 1);
        this.onFeel?.("scan", this.feel.scan.fusion);
      }
      setPaidLevel(this.model, w.fusion ?? 0, HI_TEX);
    }
    // a signature gun's skin, new or a new level's, onto the phase
    if (this.feel) this.phaseGun(this.model);
  }

  /** the pack's arms onto the gun in hand if a pack gun stands in for it (fprig.ts), measured on our gun at rest */
  private packRefresh(): void {
    const m = this.model;
    const w = this.weapon;
    this.pack.release();
    this.gunGripOn = false;
    if (!IS_SK || !m || !w || !m.root.userData.paid || !this.pack.ready || !packGunFor(w.id)) return;
    const trig = m.parts?.trigger;
    if (!trig) return;
    // our trigger in the gun's own frame, the gun's spin taken off for the moment
    const keepP = m.root.position.clone();
    const keepQ = m.root.quaternion.clone();
    m.root.position.set(0, 0, 0);
    m.root.quaternion.identity();
    m.root.updateWorldMatrix(true, true);
    const trigger = m.root.worldToLocal(trig.getWorldPosition(new THREE.Vector3()));
    this.gunGrip.copy(trigger);
    this.gunGripOn = true;
    m.root.position.copy(keepP);
    m.root.quaternion.copy(keepQ);
    const id = w.id;
    // (measured on the gun at rest: its spin taken off, as for the trigger)
    const keep2 = [m.root.position.clone(), m.root.quaternion.clone()] as const;
    m.root.position.set(0, 0, 0);
    m.root.quaternion.identity();
    const ready = this.pack.useGun(id, m.root, trigger, m.mag, m.bolt, m.travel, m.boltGrip ?? null);
    m.root.position.copy(keep2[0]);
    m.root.quaternion.copy(keep2[1]);
    void ready.then((ok) => {
      if (!ok || this.weapon?.id !== id) this.pack.release();
    });
  }


  /** the bought arms' state (tools/e2e.ts): which pack gun holds ours, whether they are drawn, the wrists' bends */
  /**
   * An inspect with the bought arms: the left hand off the gun, open and palm up, with the hack you carry floating over
   * it (the owner, 2026-09-28: "we should 'inspect' whatever hack we have in our inventory at that moment in the off
   * hand ... a palm open hand and the hack glowing/levitating off of the palm"); none without a hack
   */
  private palmFrame(f: VMFrame): { w: number; at: THREE.Vector3; turn: THREE.Quaternion } | null {
    const i = f.inspect;
    if (i === undefined || i < 0 || i >= 1 || !f.hacks?.length) return null;
    const P = PACK_PALM;
    const w = smooth(0, P.hold[0], i) * (1 - smooth(P.hold[1], 1, i));
    const at = new THREE.Vector3().fromArray(this.pack.debugPalmAt ?? P.at);
    // the palm flicked up and back as it tosses the cards away
    at.y += P.toss.flick * Math.sin(Math.PI * smooth(P.toss.at[0], P.toss.at[1], i));
    // (set where the shoulders were under the look before the refit, so carried by the look's change since: left where it
    // was as the inspect eased back to the refit's look, BOOG's open hand bent its wrist to 87 degrees, 47 under that look)
    const since = this.beforeLook.clone().invert();
    at.applyMatrix4(since);
    this.group.updateMatrixWorld(true);
    return { w, at: this.group.localToWorld(at), turn: new THREE.Quaternion().setFromRotationMatrix(since) };
  }

  /**
   * A melee in the bought arms' hands (fparms.json melee), `mp` of the way through the swing (below 0 none): how far the
   * left hand is off the gun, where it is between the chest and the punch (world), and how it is turned
   */
  private punchFrame(mp: number): PackArmsFrame["punch"] {
    if (!this.packOn || mp < 0 || mp >= 1) return null;
    const M = PACK_MELEE;
    const k = smooth(M.punch[0], M.punch[1], mp);
    const at = new THREE.Vector3().fromArray(M.chest).lerp(new THREE.Vector3().fromArray(M.out), k);
    const elbow = new THREE.Vector3().fromArray(M.chestElbow).lerp(new THREE.Vector3().fromArray(M.outElbow), k);
    // (carried with the arms, as the rest look carries them: left in the view, the arm moved 19 cm nearer with the USSO
    // fell short of the punch)
    at.applyMatrix4(this.swapArms).applyMatrix4(this.beforeLook);
    elbow.applyMatrix4(this.swapArms).applyMatrix4(this.beforeLook);
    this.group.updateMatrixWorld(true);
    return {
      w: smooth(M.on[0], M.on[1], mp) * (1 - smooth(M.off[0], M.off[1], mp)),
      at: this.group.localToWorld(at),
      elbow: this.group.localToWorld(elbow),
      palm: new THREE.Vector3().fromArray(M.palmChest).lerp(new THREE.Vector3().fromArray(M.palmOut), k).normalize(),
    };
  }

  /**
   * A swap in place (fparms.json swap cup): how far the hands are into their cup round the gun's middle, which half of
   * the swap it is (the model changes at its middle), and how far the second half's hands have come from where the first
   * left them; null outside one
   */
  private cupFrame(f: VMFrame, m: GunModel): PackArmsFrame["cup"] {
    if (!(this.packOn && SWAP_THROW.style === "cup" && f.raise > 0 && f.raise < 1)) return null;
    const C = SWAP_CUP;
    const r = f.raise;
    m.root.updateWorldMatrix(true, false);
    return { w: smooth(C.off[0], C.off[1], r) * (1 - smooth(C.back[0], C.back[1], r)), mid: this.gunCentre.clone().applyMatrix4(m.root.matrixWorld), half: r < 0.5 ? 0 : 1, carry: smooth(C.carry[0], C.carry[1], r) };
  }

  /** an inspect's length now, s: the bought arms' own when they hold the gun (fparms.json inspectPack seconds) */
  get inspectTime(): number {
    return this.packOn ? PACK_INSPECT.seconds : INSPECT_TIME;
  }

  /**
   * the inspect's hacks over the open palm: a card for each hack carried, side by side (two together: the owner,
   * 2026-09-28, "I have two hacks enabled, only 1 shows ... move one to the side a bit more and have the other next to
   * it"), floating and turning a little, each a little out of step, glowing, with its fusion level along its foot; and
   * near the end tossed up off the palm, rising slower as they go, and phased out in the air
   */
  private placePalmCard(f: VMFrame): void {
    const pf = this.palmFrame(f);
    const w = pf?.w ?? 0;
    this.palmW = w;
    const hacks = w > 0.001 ? (f.hacks ?? []).slice(0, this.palmCards.length) : [];
    const P = PACK_PALM;
    const T = P.toss;
    const i = f.inspect ?? 0;
    const at = hacks.length ? this.group.worldToLocal(this.pack.palmPoint(new THREE.Vector3())) : null;
    const up = smooth(T.at[0], T.fade[1], i);
    this.palmWhole = 1 - smooth(T.fade[0], T.fade[1], i);
    let y = 0;
    this.palmCards.forEach((card, k) => {
      const h = hacks[k];
      const key = h ? `${h.id}|${h.level}|${h.slot}` : "";
      if (h && key !== this.palmCardIds[k]) {
        card.show(hackCard(h.id, armCfg.hackCast.amber, { at: h.level, of: h.of, color: P.pips[h.slot] }));
        this.palmCardIds[k] = key;
      }
      if (h && at) {
        const side = k - (hacks.length - 1) / 2;
        card.group.position.copy(at).add(this.tmp.set(side * (P.pair.gap + T.spread * up) + P.pair.dx, P.bob * Math.sin(this.t * P.rate + k) + T.rise * (1 - (1 - up) ** 2), 0));
        card.group.rotation.set(0, P.spin * Math.sin(this.t * 0.9 + k) + T.turn * up * (side < 0 ? -1 : 1), 0);
        card.group.scale.setScalar(hacks.length > 1 ? P.pair.scale : 1);
        card.glowAt(P.glow.base + P.glow.depth * Math.sin(this.t * P.glow.rate + k * 1.3));
        y += card.group.position.y / hacks.length;
      }
      card.phaseAt(h ? this.palmWhole : 1, this.t);
      // (up once the hand is: shown as it left the gun, the cards stood over the gun)
      card.frame(h ? smooth(0.5, 1, w) : 0, false, -1, f.dt);
    });
    this.palmCardY = y;
  }

  /** something taken off the ground now: the bought arms reach down for it (fparms.json pickup) */
  pickup(): void {
    this.pickupAt = this.t;
  }

  /** a share of the pickup held, for the checks and pictures (main.ts packPickupAt) */
  pickupHold: number | null = null;

  /** a share of a melee swing held, for the checks and pictures (main.ts meleeAt) */
  meleeHold: number | null = null;

  /** how far through taking something off the ground, or null */
  private pickupShare(): number | null {
    if (this.pickupHold !== null) return this.pickupHold;
    const u = (this.t - this.pickupAt) / PICKUP.seconds;
    return u >= 0 && u < 1 ? u : null;
  }

  /** where the gun's own hold has it at the hip (a signature gun's hip moved as gunfeel.json says), in the view's space */
  private ownHipNow(): THREE.Vector3 {
    const m = this.model;
    if (!m) return this.hipFeel.set(0, 0, 0);
    return this.feel?.hip ? this.hipFeel.copy(m.hip).add(this.tmp2.fromArray(this.feel.hip)) : this.hipFeel.copy(m.hip);
  }

  /** the bought arms' rig itself (tools/pack-fit.ts tries holds on it) */
  get packRig(): PackArms {
    return this.pack;
  }

  get packState(): { active: string | null; on: boolean; lead: string; wristL: number; wristR: number; twistL: number; twistR: number; skinL: number; skinR: number; curlL: number; curlR: number; thumbL: number; thumbR: number; gunTurn: number; handleBack: number; leftToHandle: number; leftToMag: number; pointMiss: number; pointOff: number; reachShort: number; reachShortR: number; handsBelow: number; gripU: number; gripMiss: number; swapMove: number; jumpPart: string; hookMiss: number; offHold: number; palmAhead: number; free: boolean; palm: number; palmCards: number; palmCardKeys: string[]; palmCardY: number; palmWhole: number; inspectTime: number; gunCentre: number[]; poseAt: number[]; poseTurn: number[]; ownAt: number[] } {
    return { active: this.pack.active, on: this.packOn, lead: this.pack.lead, wristL: this.pack.wristBend("l"), wristR: this.pack.wristBend("r"), twistL: this.pack.wristTwist("l"), twistR: this.pack.wristTwist("r"), skinL: this.pack.skinTwist("l"), skinR: this.pack.skinTwist("r"), curlL: this.pack.fingerCurl("l"), curlR: this.pack.fingerCurl("r"), thumbL: this.pack.freeReady ? this.pack.thumbOff("l") : 0, thumbR: this.pack.freeReady ? this.pack.thumbOff("r") : 0, ...this.pack.seen, free: this.packFree && this.fists.visible, palm: this.palmW, palmCards: this.palmCards.filter((c) => c.group.visible).length, palmCardKeys: this.palmCardIds.filter((k, i) => k && this.palmCards[i].group.visible), palmCardY: this.palmCardY, palmWhole: this.palmWhole, inspectTime: this.inspectTime, gunCentre: this.gunCentre.toArray(), poseAt: this.pose.position.toArray(), poseTurn: this.pose.quaternion.toArray(), ownAt: this.ownHipNow().toArray() };
  }

  /**
   * The draw's spin (gunfeel.json spin): `k` 1 as the gun starts to come (or has all but gone), 0 whole in the hand.
   * The gun alone turns, flat, about its own middle, out ahead of the hand and a little up; the hands stay.
   */
  private spinGun(m: GunModel, k: number): void {
    if (k <= 0.001) {
      m.root.position.set(0, 0, 0);
      m.root.quaternion.identity();
      return;
    }
    const e = k * k * (3 - 2 * k);
    this.spinQ.setFromAxisAngle(this.spinV.set(0, 1, 0), e * Math.PI * 2 * SPIN.turns);
    m.root.quaternion.copy(this.spinQ);
    // about the gun's middle, not the grip: where the middle would go, put back
    this.spinV.copy(this.gunCentre).applyQuaternion(this.spinQ);
    m.root.position.copy(this.gunCentre).sub(this.spinV);
    m.root.position.z -= SPIN.ahead * e;
    m.root.position.y += SPIN.up * e;
  }

  /**
   * The thrown gun off the hands: `s` of its way on alone (view metres along `to`, turned `f` of `turn` about its middle
   * and lifted on an arc). Moved as the model itself, so the arms' rig, which holds the gun's place, lets it go.
   */
  private throwGun(m: GunModel, s: number, f: number): void {
    const T = this.pack.throwCfg;
    // (up out of the hands first, along the grip, then on ahead and over: ahead or turning at once, the grip went into
    // the right hand's fingers and the magazine swung back through them)
    const turn = smooth(T.clear, 1, f);
    this.spinQ.setFromEuler(new THREE.Euler(T.turn[0] * turn, T.turn[1] * turn, T.turn[2] * turn));
    m.root.quaternion.copy(this.spinQ);
    this.spinV.copy(this.gunCentre).applyQuaternion(this.spinQ);
    // (view metres into the gun's own units: the model is drawn scaled in the hands)
    const toGun = this.group.getWorldScale(this.tmp2).x / Math.max(1e-6, m.root.parent ? m.root.parent.getWorldScale(new THREE.Vector3()).x : 1);
    // (up along the grip's own rake, `slide` ahead for each metre up: straight up, its raked front came through the fingers)
    const up = T.to[1] * s + T.arc * Math.sin(Math.PI * f);
    m.root.position.copy(this.gunCentre).sub(this.spinV).add(new THREE.Vector3(T.to[0] * s * s, up, T.to[2] * s * s - T.slide * up * (1 - s)).multiplyScalar(toGun));
  }

  /** a signature gun's feel, and the axes its sweeps run along, measured off the bought model in the hands */
  private setFeel(m: GunModel, w: ResolvedWeapon): void {
    this.feel = IS_SK && m.root.userData.paid ? (FEEL[w.id] ?? null) : null;
    this.feelKick = this.feelKickVel = this.pulse = 0;
    this.bodySweep.phase.value = this.magSweep.phase.value = 1;
    if (!this.feel) return;
    const drawn = (root: THREE.Object3D, space: THREE.Object3D): THREE.Box3 => {
      const box = new THREE.Box3();
      root.updateWorldMatrix(true, true);
      const inv = new THREE.Matrix4().copy(space.matrixWorld).invert();
      root.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (!mesh.isMesh || !mesh.visible || !mesh.geometry.boundingBox) mesh.geometry?.computeBoundingBox?.();
        if (!mesh.isMesh || !mesh.visible || !mesh.geometry.boundingBox) return;
        box.union(mesh.geometry.boundingBox.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, mesh.matrixWorld)));
      });
      return box;
    };
    const paid = m.root.getObjectByName("paid");
    if (paid && this.feel.screen) this.mountScreen(paid.children[0], this.feel.screen);
    if (paid) {
      const g = drawn(paid, m.root);
      const cy = (g.min.y + g.max.y) / 2;
      this.gunNear.set(0, cy, g.max.z);
      this.gunFar.set(0, cy, g.min.z);
    }
    if (m.mag) {
      const b = drawn(m.mag, m.mag);
      const cx = (b.min.x + b.max.x) / 2;
      const cz = (b.min.z + b.max.z) / 2;
      this.magTop.set(cx, b.max.y, cz);
      this.magEnd.set(cx, b.min.y, cz);
      b.getCenter(this.magMid);
      this.magRadius = Math.max(1e-4, b.getSize(new THREE.Vector3()).length() / 2);
    }
    this.phaseGun(m);
  }

  /**
   * A signature gun's screen on its left side (gunfeel.json screen): a flat panel standing just proud of the gun where
   * it is placed, the side measured off the model, facing out of it. Once a gun: the model is the one cached copy.
   */
  private mountScreen(model: THREE.Object3D, S: { y: number; z: number; w: number; h: number }): void {
    if (!this.screenCv) {
      this.screenCv = document.createElement("canvas");
      this.screenCv.width = 256;
      this.screenCv.height = 140;
      this.screenTex = new THREE.CanvasTexture(this.screenCv);
      this.screenTex.colorSpace = THREE.SRGBColorSpace;
    }
    this.screenDrawn = "";
    if (model.getObjectByName("gun-screen")) return;
    model.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(model.matrixWorld).invert();
    const v = new THREE.Vector3();
    let side = -Infinity;
    model.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      const to = new THREE.Matrix4().multiplyMatrices(inv, mesh.matrixWorld);
      const pos = mesh.geometry.getAttribute("position");
      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i).applyMatrix4(to);
        if (Math.abs(v.y - S.y) < S.h / 2 && Math.abs(v.z - S.z) < S.w / 2) side = Math.max(side, v.x);
      }
    });
    if (!Number.isFinite(side)) return;
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(S.w, S.h), new THREE.MeshBasicMaterial({ map: this.screenTex, transparent: true, toneMapped: false }));
    screen.name = "gun-screen";
    // facing out of the gun's left (the pack's +x), its right way up to the eye (along the gun, muzzle to the right)
    screen.rotation.y = Math.PI / 2;
    screen.position.set(side + 0.0015, S.y, S.z);
    screen.renderOrder = 2;
    model.add(screen);
  }

  /** a signature gun's screen this frame: its rounds in big digits and its fusion level as pips, gold at the top */
  private drawScreen(clip: number, level: number, color: string): void {
    const cv = this.screenCv;
    if (!cv || !this.screenTex) return;
    const top = PROFILE.fusion?.levels ?? 5;
    const key = `${clip}|${level}`;
    if (key === this.screenDrawn) return;
    this.screenDrawn = key;
    const c = cv.getContext("2d")!;
    const W = cv.width;
    const H = cv.height;
    c.clearRect(0, 0, W, H);
    c.fillStyle = "rgba(4, 10, 16, 0.86)";
    c.beginPath();
    c.moveTo(14, 4);
    c.lineTo(W - 4, 4);
    c.lineTo(W - 4, H - 14);
    c.lineTo(W - 14, H - 4);
    c.lineTo(4, H - 4);
    c.lineTo(4, 14);
    c.closePath();
    c.fill();
    c.strokeStyle = color;
    c.globalAlpha = 0.5;
    c.lineWidth = 3;
    c.stroke();
    c.globalAlpha = 1;
    const gold = level >= top;
    // the fusion pips, down the left
    for (let i = 0; i < top; i++) {
      const on = i < level;
      c.fillStyle = on ? (gold ? "#ffcc3c" : "#e8f6ff") : "rgba(232, 246, 255, 0.16)";
      c.fillRect(20, H - 26 - i * ((H - 40) / top), 26, (H - 40) / top - 6);
    }
    // the rounds, big, right-aligned, two digits at least
    c.font = "700 104px Rajdhani, 'Arial Narrow', sans-serif";
    c.textAlign = "right";
    c.textBaseline = "middle";
    c.fillStyle = gold ? "#ffcc3c" : color;
    c.shadowColor = c.fillStyle;
    c.shadowBlur = 12;
    c.fillText(String(Math.max(0, clip)).padStart(2, "0"), W - 18, H / 2 + 6);
    c.shadowBlur = 0;
    this.screenTex.needsUpdate = true;
  }

  /** the bought gun's meshes onto the sweeps: its magazine's on the magazine's, the rest on the gun's */
  private phaseGun(m: GunModel): void {
    const paid = m.root.getObjectByName("paid");
    const under = (o: THREE.Object3D, g: THREE.Object3D | null | undefined) => {
      for (let p: THREE.Object3D | null = o; p && p !== m.root; p = p.parent) if (p === g) return true;
      return false;
    };
    // the pack's own meshes only: never the muzzle flash, the optic or the procedural gun hidden under them
    phaseMeshes(m.root, (mesh) => (under(mesh, m.mag) && mesh.visible ? this.magSweep : under(mesh, paid) || ((under(mesh, m.bolt) || under(mesh, m.pump)) && mesh.visible) ? this.bodySweep : null));
    this.glowBase.clear();
  }

  /**
   * A signature gun's sweeps this frame, along the gun as it is posed and the magazine where it is, and its glow: a
   * shot's pulse, a seat's, the gun coming whole; BOOG drains on a shot and builds back over the rechamber, flashing
   * as it is ready
   */
  private feelFrame(m: GunModel, w: ResolvedWeapon, F: GunFeel, phase: number, reloadP: number, reloading: boolean, dt: number, f: VMFrame): void {
    this.pose.updateMatrix();
    m.root.updateWorldMatrix(true, true);
    const toWorld = (v: THREE.Vector3, o: THREE.Object3D) => this.tmp.copy(v).applyMatrix4(o.matrixWorld);
    const S = this.bodySweep;
    S.phase.value = phase;
    S.time.value = this.t;
    S.origin.value.copy(toWorld(this.gunNear, m.root));
    S.dir.value.copy(toWorld(this.gunFar, m.root)).sub(S.origin.value);
    S.len.value = Math.max(1e-4, S.dir.value.length());
    S.dir.value.normalize();
    // a swap in place phases the gun out from its edges in, and the next in from its middle out (fparms.json swap cup);
    // a fusion's flood and an inspect's scan still run along it
    S.radial.value = this.packOn && SWAP_THROW.style === "cup" && (f.raise < 1 || f.lowered > 0) ? 1 : 0;
    S.center.value.copy(toWorld(this.gunCentre, m.root));
    S.radius.value = Math.max(1e-4, this.gunRadius * m.root.getWorldScale(this.tmp2).x);
    // its screen: the rounds and the fusion level
    if (F.screen && f.clip !== undefined) this.drawScreen(f.clip, w.fusion ?? 0, F.screen.color);
    // the sounds of the phase: out as it starts to go, in as it starts to come
    if (this.lastPhase >= 0.999 && phase < 0.999) this.onFeel?.("out");
    else if (this.lastPhase <= 0.001 && phase > 0.001) this.onFeel?.("in");
    // an inspect: the gun glows in the band's light, pulsing as the hack cards' glow does, where the scan's band passed
    // along it (the owner, 2026-09-29: "when we inspect it should be that glow we are using on the hacks, not the janky
    // looking highlight we made from our non-assets days"); a fusion's scan still passes along it
    let scan = -1;
    let rim = 0;
    if (f.inspect !== undefined && f.inspect >= 0 && f.inspect < 1) {
      const G = INSPECT_GLOW;
      rim = smooth(G.in[0], G.in[1], f.inspect) * (1 - smooth(G.out[0], G.out[1], f.inspect)) * (G.base + G.depth * Math.sin(this.t * G.rate));
    } else if (this.t - this.scanAt < F.scan.fusion) scan = ((this.t - this.scanAt) / F.scan.fusion) * 1.3 - 0.15;
    S.scan.value = scan;
    S.rim.value = rim;
    // into the sights: a pulse and a hum
    if (this.lastAdsFeel < 0.6 && f.adsFrac >= 0.6) {
      this.pulse = Math.max(this.pulse, F.ads);
      this.onFeel?.("ads");
    }
    this.lastAdsFeel = f.adsFrac;
    // a reload from empty: the charging handle racked after the seat (the USSO's slider, in the bolt group)
    if (reloading && this.lastReloadP === 0) {
      this.reloadEmpty = f.clipEmpty;
      this.racked = false;
    }
    // (with the bought arms, their clip racks the handle and the hand goes to it: fprig.ts)
    if (reloading && F.rack && this.reloadEmpty && m.bolt && !this.packOn) {
      const u = (reloadP - F.rack[0]) / (F.rack[1] - F.rack[0]);
      if (u > 0 && u < 1) {
        m.bolt.position.z = this.boltBase.z + m.travel * Math.sin(Math.PI * u);
        if (!this.racked) {
          this.racked = true;
          this.onFeel?.("rack");
        }
      }
      // the support hand goes to the handle, back with it and forward, and to the gun again (the owner: "the charging
      // handle moves ... but the wrist doesn't go for it to charge it back visually")
      if (m.boltGrip) {
        const R = F.rackHand ?? [0.05, 0.04];
        const reach = smooth(F.rack[0] - R[0], F.rack[0], reloadP) * (1 - smooth(F.rack[1], F.rack[1] + R[1], reloadP));
        this.onKnob = reach;
        if (reach > 0) this.left.group.position.lerp(this.rackAt.copy(m.boltGrip).setZ(m.boltGrip.z + m.bolt.position.z - this.boltBase.z), reach);
      }
    }
    // the magazine: out as it drops and a new one in as it comes back, on a reload; else with the gun
    let mp = phase;
    if (reloading) {
      const R = F.reload;
      // with the bought arms, when their clip takes the magazine out and brings the new one home (fprig.ts, measured
      // off the pack gun's clip): the old one goes as it leaves the gun, the new one comes in the hand before it seats
      const PR = this.packOn ? PACK_RELOAD : null;
      const magOut = PR ? PR.phaseOut : R.magOut;
      const magIn = PR ? PR.phaseIn : R.magIn;
      const seat = PR ? PR.seat : R.seat;
      const mid = (magOut[1] + magIn[0]) / 2;
      // (on the bought arms' timeline: a tactical reload's magazine goes and comes when the empty one's does)
      const rp = PR ? this.packRP : reloadP;
      const lastRp = PR ? this.lastPackRP : this.lastReloadP;
      mp = Math.min(phase, rp < mid ? 1 - smooth(magOut[0], magOut[1], rp) : smooth(magIn[0], magIn[1], rp));
      // the seat: a slap into the hands and a pulse
      if (lastRp < seat && rp >= seat) {
        this.feelKickVel += R.snap;
        this.pulse = Math.max(this.pulse, R.pulse);
      }
    }
    this.lastPackRP = reloading ? this.packRP : 0;
    this.lastReloadP = reloading ? reloadP : 0;
    if (!reloading) this.onKnob = 0;
    const M = this.magSweep;
    M.phase.value = mp;
    M.time.value = this.t;
    if (m.mag) {
      this.aimMagSweep(m);
      // the phase draws it in and out; the plain reload's hiding it while "empty" would cut the sweep off
      if (reloading) m.mag.visible = mp > 0;
    }
    // the glow
    if (this.lastPhase < 1 && phase >= 1) this.pulse = Math.max(this.pulse, 0.8);
    this.lastPhase = phase;
    this.pulse *= Math.exp(-dt / F.pulse.decay);
    let g = 1 + F.pulse.glow * this.pulse;
    // nearly out: the glow stutters, dropping out a few frames in a few, never while reloading
    if (!reloading && f.clipFrac !== undefined && f.clipFrac < F.lowAmmo && !f.clipEmpty) {
      const beat = Math.floor(this.t * 14);
      if (((beat * 7919) % 5) < 2) g *= 0.25;
    }
    if (F.charge) {
      const u = (this.t - this.lastShotAt) / Math.max(0.4, w.rechamberTime || w.shotInterval);
      if (this.lastCharge < 1.03 && u >= 1.03) this.onFeel?.("ready");
      this.lastCharge = u;
      if (u >= 0 && u < 1.3) {
        const drain = F.charge.drained + (1 - F.charge.drained) * smooth(0.12, 0.95, u);
        const ready = F.charge.ready * Math.max(0, 1 - Math.abs(u - 1.03) / 0.1);
        g = drain + F.pulse.glow * this.pulse + ready;
      }
    }
    m.root.traverse((o) => {
      const mat = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
      if (!(o as THREE.Mesh).isMesh || !mat || !mat.isMeshStandardMaterial || !mat.userData.phaseOf) return;
      let base = this.glowBase.get(mat);
      if (base === undefined) this.glowBase.set(mat, (base = mat.emissiveIntensity));
      mat.emissiveIntensity = base * g;
    });
  }

  /**
   * Put the fitted optic on the rail, or take it off. A pistol's optic sits on
   * the slide and cycles with it.
   */
  private fitOptic(m: GunModel, mod: string | null): void {
    const name = `optic:${mod ?? ""}`;
    if (this.optic && this.optic.group.name === name && this.optic.group.parent) return;
    this.dropOptic();
    this.optic = buildOptic(mod);
    if (m.irons) m.irons.visible = this.optic === null;
    if (!this.optic) return;
    this.optic.group.name = name;
    const parent = m.opticOnSlide && m.bolt ? m.bolt : m.root;
    parent.add(this.optic.group);
    // A bought gun is aimed down its own sights (paidgun.ts ownSight), never ours on top of them: the fitted optic lends
    // its zoom and, magnified, its picture over the screen, and is not drawn. The eye comes up the gun's own sight line,
    // the optic's eye relief behind a scope, or as far behind irons as on any gun
    const own = m.root.userData.ownSight as { y: number; f: number; irons: boolean; dot: boolean } | undefined;
    if (own) {
      m.railY = own.y - this.optic.lineH;
      // (at the sight's own eye relief, however near the gun's back end comes: pushed out until the USSO's back end was 3
      // cm off the eye, its sight shrank to a speck far down a gun held at arm's length, the owner, 2026-09-29, "adsing
      // with the usso is completely broken"; what had shown through aimed was the mounted sight's own culled faces
      // (paidgun.ts mountMaterial), and the gun camera's near plane is close enough that the back end is not cut, main.ts)
      m.opticF = own.f - this.optic.backF + (own.irons ? this.optic.info.relief - IRONS_EYE : own.dot ? this.optic.info.relief - DOT_EYE : 0);
    }
    this.optic.group.visible = !own;
    // and its own reticle dots take the optic's colour: the pack's dot is white, and a red dot reads as one
    if (own) tintDots(m.root, this.optic.info.color);
    this.optic.group.position.set(0, m.railY, -m.opticF);
  }

  /**
   * Take the fitted optic off and free it. Its reticle material and unshared
   * geometry are its own; the housing materials, reticle textures and bevelled
   * shapes are shared caches (optics.ts, geo.ts) and stay.
   */
  /** the gun in hand's model, for a check to read (the bought gun it wears, paidgun.ts) */
  get gunRoot(): THREE.Object3D | null {
    return this.model?.root ?? null;
  }

  /** let go of the gun in hand, so the next setWeapon builds it again (the bought guns have come in) */
  rebuild(): void {
    this.dropOptic();
    // (the gun hangs under the pack's gun-motion group, not the holder itself)
    if (this.model) this.model.root.removeFromParent();
    this.model = null;
    this.key = "";
  }

  private dropOptic(): void {
    const o = this.optic;
    this.optic = null;
    if (!o) return;
    o.group.removeFromParent();
    o.group.traverse((c) => {
      const g = (c as THREE.Mesh).geometry;
      if (g && !g.userData.shared) g.dispose();
    });
    (o.reticle.material as THREE.Material).dispose();
  }

  /** hold this heirloom in place of an empty right fist ("fists" for none) */
  setHeirloom(id: string): void {
    if (id === this.heirloomId) return;
    this.heirloomId = id;
    this.heirloomHolder.clear();
    this.heirloom = null;
    void heirloomModel(id).then((m) => {
      if (this.heirloomId !== id || !m) return;
      this.heirloom = m;
      this.heirloomHolder.add(m.group);
    });
  }

  /** a melee swing: the heirloom or fist sweeps across, the gun dips out of the way */
  melee(): void {
    this.meleeAt = this.t;
  }

  /** the optic in use, if any: the HUD draws the full-screen scope for magnified ones */
  get opticFitted(): OpticModel | null {
    return this.optic;
  }

  private placeHands(m: GunModel): void {
    const g = m.grip;
    const s = g.scale ?? 1;
    this.right.group.position.set(g.x ?? 0, g.u, -g.f);
    this.gripBaseZ = -g.f;
    this.right.group.rotation.set(-g.angle, 0, 0);
    this.right.group.scale.set(s, s, s);

    const sp = m.support;
    const ss = sp.scale ?? 1;
    // SpeedKills' bought guns: the hand under the gun, palm up, rather than round its side (speedkills.json viewmodel
    // support). Their bodies are wider than the procedural handguard the hand was posed round, and at 22 mm over the
    // underside and rolled 0.55 the fingers went into the gun's side (the owner: "morphed/glitched into the side of it")
    const under = IS_SK && m.root.userData.paid && sp.kind !== "pistol" && sp.kind !== "pump" ? PROFILE.viewmodel?.support : undefined;
    this.supportBase.set(sp.x ?? 0, sp.u - (under?.below ?? 0), -sp.f);
    this.left.group.position.copy(this.supportBase);
    // 'ZYX': tilt the held bar first, then roll the hand under the handguard
    // about the barrel axis, so the palm cups it from below.
    const roll = sp.kind === "pistol" ? 0 : (under?.roll ?? 0.55);
    this.left.group.rotation.set(-sp.angle, 0, roll, "ZYX");
    this.left.group.scale.set(-ss, ss, ss);
    // Which shoulders this gun hangs off. The points themselves are in the
    // camera's space and are picked up again every frame, because the whole
    // point of them is that the gun's pose cannot move them.
    this.armFamily = sp.kind;
  }

  onShot(): void {
    const m = this.model;
    const w = this.weapon;
    if (!m || !w) return;
    this.lastShotAt = this.t;
    // Per-shot jolt, scaled down for fast-firing guns: at 13 rounds a second
    // a full rifle impulse per shot stacks into a gun shoved 3 cm back and
    // tilted 5 degrees for the whole spray.
    const rateScale = Math.min(1, 4 / Math.max(1, w.fireRate));
    const adsScale = 1 - 0.6 * this.lastAds;
    // a signature gun kicks on its own spring (gunfeel.json), and its glow jumps
    if (this.feel) {
      this.feelKickVel += this.feel.kick.impulse * adsScale;
      this.pulse = 1;
    } else this.kickVel += 32 * m.kick * rateScale * adsScale;
    this.kickYaw = (Math.random() - 0.5) * 0.6;
    this.kickRoll = (Math.random() - 0.5) * 0.8;
    this.flash.fire(m.energy, this.feel?.flash);
    if (this.feel?.charge) this.onFeel?.("recharge", Math.max(0.4, w.rechamberTime || w.shotInterval));
    if (m.cycle === "cylinder") this.cylTarget += Math.PI / 3;
    // a bought launcher's drum turns a chamber a shot
    if (m.parts?.drum) this.drumTarget += m.parts.drumStep;
    // Auto and slide actions eject on the shot; pump and bolt eject partway
    // through the rechamber, when the action is actually open.
    if (m.cycle === "auto" || m.cycle === "slide") this.eject();
    else this.cycleEjected = false;
  }

  /** one spent casing out of the ejection port */
  private eject(): void {
    const m = this.model;
    if (!m || !m.port || !m.shell) return;
    this.pose.updateMatrix();
    this.tmp.copy(m.port).applyMatrix4(this.pose.matrix);
    this.tmp2.set(1.3 + Math.random() * 0.5, 1.0 + Math.random() * 0.5, 0.35 + Math.random() * 0.3);
    this.shells.emit(this.tmp, this.feel?.shell ?? m.shell, this.tmp2);
  }

  /** a bow's draw, 0..1, and where the string hand sits undrawn */
  private drawFrac = 0;
  private gripBaseZ = 0;

  update(f: VMFrame): void {
    const m = this.model;
    const w = this.weapon;
    const dt = Math.min(0.05, f.dt);
    this.drawFrac = f.draw ?? 0;
    this.t += dt;
    // the rig's own matrix, which is the viewmodel scale: every arm's
    // near-plane guard measures through it, and the fists hang straight off it
    this.group.updateMatrix();
    this.lastAds = f.adsFrac;
    this.flash.update(dt);
    this.shells.update(dt);
    if (!m || !w) return;

    const ads = easeInOut(f.adsFrac);
    const reloadP = f.reloading ? f.reloadProgress : 0;
    // the pack's arms hold this gun: not while the hands are on the fists, a zipline or a cast (the view's own arms)
    const packOn = this.pack.active !== null && this.pack.active === packGunFor(w.id) && !this.fists.visible && !this.zipRig.visible && !this.castRig.visible;
    this.packOn = packOn;
    // whether this reload began from empty, known from its first frame; and in the bought arms' hands a reload with a round
    // still chambered read onto the empty one's timeline, its beats in the same seconds, ending before the rack
    // (fparms.json reload tactical)
    if (f.reloading && this.lastReloadP === 0) this.reloadEmpty = f.clipEmpty;
    this.packRP = packOn && f.reloading && !this.reloadEmpty && !this.pack.tacticalRacks && w.reloadEmptyTime > 0 ? reloadP * (w.reloadTime / w.reloadEmptyTime) : reloadP;
    // In the sights the gun holds still for a reload, as it does for a strafe: rolled at full size, a 2x window
    // swung onto the support hand still on the handguard (PANDA, STRYDER, CHOOCH; Phase 20 A3)
    const reloadEnv = (f.reloading ? smooth(0, 0.14, reloadP) * (1 - smooth(0.84, 1, reloadP)) : 0) * (1 - ads * RELOAD_ADS);

    // ---- sprint blend; ADS and reloading both win over it
    // (not while firing either: SpeedKills sprints firing, and the sprint pose lowered the gun off the crosshair)
    const wantSprint = f.sprinting && f.adsFrac < 0.05 && !f.reloading && this.t - this.lastShotAt > LOCO.fireHold ? 1 : 0;
    this.sprintAmt += (wantSprint - this.sprintAmt) * Math.min(1, dt / 0.16);
    // (the bought arms move the gun with the pack's own walk, sprint and jump: fprig.ts locomotion)
    const sp = packOn ? 0 : easeInOut(this.sprintAmt) * SPRINT_POSE;
    // the slide: low and rolled like the sprint pose but a touch further
    // in, blended from wherever the gun was so a sprint into a slide flows
    const wantSlide = f.sliding && f.adsFrac < 0.05 ? 1 : 0;
    this.slideAmt += (wantSlide - this.slideAmt) * Math.min(1, dt / 0.1);
    const sl = easeInOut(this.slideAmt) * (1 - ads);
    // climbing and mantling: the hands go to the wall, the gun hangs off the
    // right hand; aiming is not possible on a wall so no ADS blend here
    this.climbAmt += ((f.climbing ? 1 : 0) - this.climbAmt) * Math.min(1, dt / 0.12);
    this.mantleAmt += ((f.mantling ? 1 : 0) - this.mantleAmt) * Math.min(1, dt / 0.1);
    const cl = easeInOut(this.climbAmt);
    const mt = easeInOut(this.mantleAmt);
    // leaving the ground with a jump: the gun lifts a touch, then floats
    // back as you rise; the landing dip is the player's own
    if (this.wasOnGround && !f.onGround && f.vy > 1) this.settleVel += 1.6;
    this.wasOnGround = f.onGround;
    const fall = f.onGround ? 0 : clamp(-f.vy / 12, 0, 1) * (1 - ads);
    if (this.checkPending && f.raise >= 0.97 && f.lowered < 0.2) {
      this.checkPending = false;
      this.checkAt = this.t + 0.12;
    }
    // the draw settle: when the gun finishes coming up (a swap, a draw from
    // the holster) it overshoots a little and springs back, which is what
    // reads as a hand catching it
    if ((this.lastRaise < 0.97 && f.raise >= 0.97) || (this.lastLowered > 0.2 && f.lowered <= 0.2)) this.settleVel -= 2.2;
    this.lastRaise = f.raise;
    this.lastLowered = f.lowered;
    this.settleVel += (-180 * this.settle - 16 * this.settleVel) * dt;
    this.settle += this.settleVel * dt;

    // ---- recoil spring, slightly underdamped so the gun settles with one
    // small overshoot, which is what reads as weight
    [this.kick, this.kickVel] = springStep(this.kick, this.kickVel, 260, 24, dt);

    // ---- no look lag. An earlier version made the gun trail the view in
    // proportion to how fast you turned, which is how realistic shooters sell
    // weight and exactly what makes aiming feel slow. Apex's gun is locked to
    // the view, so this one is too.
    this.swayX = 0;
    this.swayY = 0;

    // ---- walk bob and idle breathing
    if (f.onGround && f.moveSpeed > 0.5) this.bobT += dt * (f.moveSpeed * 1.7);
    const bobAmp = packOn ? 0 : 0.011 * (1 - ads * 0.85) * Math.min(1, f.moveSpeed / 5);
    const bx = Math.sin(this.bobT) * bobAmp;
    const by = Math.abs(Math.cos(this.bobT)) * bobAmp * 0.6;
    const breath = Math.sin(this.t * 1.6) * 0.0005 * (1 - ads);

    // ---- base pose: hip, ADS (sight line on the eye), sprint. With an optic
    // the OPTIC's sight line comes to the eye, at that optic's eye relief;
    // without one, the irons do.
    // a signature gun's own hip pose (gunfeel.json hip), else the gun's
    const hip = packOn ? this.pack.hip.position : this.feel?.hip ? this.hipFeel.copy(m.hip).add(this.tmp2.fromArray(this.feel.hip)) : m.hip;
    const o = this.optic;
    const adsPos = o
      ? this.tmp.set(0, -(m.railY + o.lineH), m.opticF + o.backF - o.info.relief)
      : this.tmp.set(0, -m.sightY, m.rearF - ADS_EYE);
    const p = this.tmp3.copy(hip).lerp(adsPos, ads);
    const sprintPos = this.tmp2.set(hip.x + 0.11, hip.y - 0.13, hip.z + 0.1);
    p.lerp(sprintPos, sp);
    // the slide pose: down and in, muzzle a little up, rolled outward
    p.lerp(this.tmp2.set(hip.x + 0.06, hip.y - 0.09, hip.z + 0.06), sl);
    // on a wall: the gun drops to the hip and turns out of the way; in a
    // mantle it goes low and forward as the hands reach the ledge
    p.lerp(this.tmp2.set(hip.x + 0.1, hip.y - 0.16, hip.z + 0.12), cl);
    p.lerp(this.tmp2.set(hip.x + 0.04, hip.y - 0.12, hip.z - 0.06), mt);
    // falling: the gun floats up a little, as if the arms went light
    p.y += fall * 0.02;
    // The sprint pump: the gun swings across and down with every stride and
    // rolls with it, the way the game's does. One stride is one full swing
    // (bobT counts two steps per cycle, so the pump runs at half rate).
    const stride = this.bobT * 0.5;
    const pump = sp * SPRINT_PUMP;
    let rx = sp * 0.18 + Math.sin(stride * 2) * 0.05 * pump - sl * 0.12 - cl * 0.5 + mt * 0.35 - fall * 0.08;
    let ry = 0.05 * (1 - ads) - sp * 0.55 + Math.sin(stride) * 0.09 * pump - sl * 0.3 - cl * 0.7;
    let rz = sp * 0.42 + Math.sin(stride) * 0.14 * pump + sl * 0.32 + cl * 0.6 + mt * 0.15;
    // the pack's hold turns the gun as its hands hold it (fprig.ts hip), all gone in the sights
    if (packOn) {
      rx += this.pack.hip.euler.x * (1 - ads);
      ry += this.pack.hip.euler.y * (1 - ads);
      rz += this.pack.hip.euler.z * (1 - ads);
      // and the barrel brought back down to `HIP_PITCH`: the fit tilts our gun up about its trigger until its underside
      // meets the pack's left palm (10 degrees on the USSO, 12 on BOOG), and held so the muzzle pointed up and left at
      // rest (the owner: "in the chilling / standing position, the gun is never like that"); the hands follow it down
      this.levelBy = (this.pack.tilt - HIP_PITCH) * (1 - ads);
      rx -= this.levelBy;
    } else this.levelBy = 0;
    // idle: standing still the gun drifts a hair, as held hands do
    const idle = packOn ? 0 : (1 - Math.min(1, f.moveSpeed / 1.5)) * (1 - ads) * (f.onGround ? 1 : 0);
    p.x += Math.sin(this.t * 0.9) * 0.0025 * idle;
    p.y += Math.sin(this.t * 1.3 + 1) * 0.0018 * idle;
    rz += Math.sin(this.t * 0.7) * 0.008 * idle;
    rx += Math.sin(this.t * 1.1 + 2) * 0.005 * idle;
    // the settle spring: a dip and a nod
    p.y += this.settle * 0.012;
    rx += this.settle * 0.06;

    // bob, sprint swing, breathing, look lag
    p.x += bx + Math.sin(stride) * 0.075 * pump + this.swayX;
    p.y += by - Math.abs(Math.cos(stride)) * 0.05 * pump + breath + this.swayY;
    p.z += Math.sin(stride * 2) * 0.012 * pump;
    ry += -this.swayX * 2.6;
    rx += this.swayY * 2.2;

    // a signature gun's kick: its own spring, back, up and a twist, and a buzz while it keeps firing
    const F = this.feel;
    if (F) {
      [this.feelKick, this.feelKickVel] = springStep(this.feelKick, this.feelKickVel, F.kick.spring, F.kick.damp, dt);
      p.z += this.feelKick * F.kick.back;
      rx += this.feelKick * F.kick.up;
      ry += this.feelKick * F.kick.yaw * this.kickYaw;
      rz += this.feelKick * F.kick.roll * this.kickRoll;
      if (F.buzz && this.t - this.lastShotAt < w.shotInterval * 1.6) {
        const a = F.buzz.amp * (1 - ads * 0.6);
        p.x += Math.sin(this.t * F.buzz.hz * Math.PI * 2) * a;
        p.y += Math.cos(this.t * F.buzz.hz * Math.PI * 2.6) * a;
      }
    }
    // BOOG's cycle: after a shot, at the hip, it cants over and back while its wheels turn (the owner: "can we twist it
    // again, even if slightly, to better animate and see it animating"; the pack's sniper has no charging handle)
    if (F?.cycle && !packOn) {
      const C = F.cycle;
      const u = (this.t - this.lastShotAt) / Math.max(0.4, w.rechamberTime || w.shotInterval);
      const v = clamp((u - C.at[0]) / (C.at[1] - C.at[0]), 0, 1);
      const k = Math.sin(Math.PI * v) * (1 - ads);
      rz += C.roll * k;
      ry += C.yaw * k;
      p.y += C.y * k;
    }
    // recoil: back, muzzle up, a random twist
    p.z += this.kick * 0.018;
    rx += this.kick * 0.05;
    ry += this.kick * 0.012 * this.kickYaw;
    rz += this.kick * 0.02 * this.kickRoll;

    // a hack's cast: the gun dips to the right in the one hand while the other is up (viewmodel.json hackCast gun)
    const cast = this.castEnv();
    if (cast > 0) {
      const G = armCfg.hackCast.gun;
      p.x += G.x * cast;
      p.y += G.y * cast;
      rz += G.roll * cast;
      rx += G.pitch * cast;
    }

    // into a strafe: the gun rolls toward the way you step and slides a
    // little the other way, eased, and mostly held still in the sights
    const S = armCfg.strafe;
    const wantStrafe = f.onGround ? clamp((f.strafe ?? 0) / 6.6, -1, 1) : 0;
    this.strafeAmt += (wantStrafe - this.strafeAmt) * Math.min(1, dt / S.ease);
    const st = this.strafeAmt * (1 - ads * S.ads);
    rz -= S.roll * st;
    p.x -= S.shift * st;
    // landing: the gun drops and the muzzle dips with the camera
    p.y += f.landDip * 0.5;
    rx += f.landDip * 1.5;

    // ---- reload pose, which depends on how this gun reloads; with the pack's arms their clip moves the gun
    this.reloadFrameW = 0;
    if (packOn) {
      // the bought arms: the gun turns its underside toward you while the left hand points at the magazine and it
      // phases (fparms.json reload), then the pack's clip moves it as its hands work it (fprig.ts gunDelta)
      const PR = PACK_RELOAD;
      // (the point's turn hands straight over to the rack's, over `rackBlend`: back to the hold between them, the gun had
      // jumped in 40 ms)
      // (on the arms' timeline; a round still chambered: no rack's pose, the turn easing out as the hand goes back)
      const rp = this.packRP;
      const racks = this.reloadEmpty || this.pack.tacticalRacks;
      // (a gun's own turn into its rack pose, else over `rackBlend` before the rack: the USSO's, while its finger still
      // pointed, took the magazine out of the arm's reach, the wrist bent 100 degrees and the arm 10 mm short)
      const PIn = this.pack.rackPoseIn ?? [PR.rack[0] - PR.rackBlend, PR.rack[0]];
      const into = f.reloading && racks ? smooth(PIn[0], PIn[1], rp) : 0;
      const damp = 1 - ads * RELOAD_ADS;
      const back = racks ? 0 : smooth(PR.tactical.back[0], PR.tactical.back[1], rp);
      const envP = (f.reloading ? smooth(0, PR.point[1], rp) * (1 - into) * (1 - back) : 0) * damp;
      const RP = this.pack.rackPose;
      const envR = RP && f.reloading ? into * (1 - smooth(PR.rack[1] - PR.rackBlend, PR.rack[1], rp)) * damp : 0;
      // (the two turns hand over as one: their sum, the aim taken out, frames the reload)
      this.reloadFrameW = f.reloading ? Math.min(1, (envP + envR) / Math.max(1e-6, damp)) : 0;
      for (const [T, e] of [[this.pack.twist, envP], [RP, envR]] as const) {
        if (!T || e <= 0) continue;
        rz += T.roll * e;
        ry += T.yaw * e;
        rx += T.pitch * e;
        p.x += T.x * e;
        p.y += T.y * e;
        p.z += T.z * e;
      }
    } else if (m.reload === "cylinder") {
      rz += 0.3 * reloadEnv;
      rx += 0.55 * smooth(0.24, 0.38, reloadP) * (1 - smooth(0.55, 0.7, reloadP));
      p.y -= 0.02 * reloadEnv;
    } else if (m.reload === "shells") {
      rz -= 0.34 * reloadEnv;
      rx += 0.1 * reloadEnv;
      p.y -= 0.03 * reloadEnv;
    } else if (F?.reload.twist) {
      // a signature gun turns its underside toward you, in and up, so the magazine's phase out and in is seen (the owner:
      // "rotate the gun when reloading so that the bottom is more facing the left so the mag is more obviously being
      // morphed into the gun"); the plain roll turned it the other way, the magazine under the gun and off the frame
      const T = F.reload.twist;
      rz += T.roll * reloadEnv;
      ry += T.yaw * reloadEnv;
      rx += T.pitch * reloadEnv;
      p.x += T.x * reloadEnv;
      p.y += T.y * reloadEnv;
      p.z += T.z * reloadEnv;
    } else {
      rz -= 0.38 * reloadEnv;
      rx += 0.12 * reloadEnv;
      p.y -= 0.03 * reloadEnv;
      p.x -= 0.02 * reloadEnv;
    }

    // ---- swap: the gun drops out of frame and the next one comes up.
    // Holstering takes the first half of the holster time to lower the gun
    // and the second half to bring the empty hands up.
    const gunGone = easeInOut(clamp(f.lowered * 2, 0, 1));
    // A signature gun phases out of the hands and in rather than dropping out of the frame (gunfeel.json swap): the
    // outgoing one over the swap's first half, the incoming one over its second (the model changes at the middle),
    // and out and in again over a holster and a draw. Only a little of the drop is kept, so the phase is seen
    let phase = 1;
    // a swap in place, in the bought arms' hands (fparms.json swap style "cup"): the gun stays where it is and phases out
    // from its edges in and the next in from its middle out, while the hands cup round it
    const cupped = packOn && SWAP_THROW.style === "cup";
    if (F) {
      const swapPh = f.raise >= 1 ? 1 : f.raise < 0.5 ? 1 - smooth(F.swap.out[0], F.swap.out[1], f.raise) : smooth(F.swap.in[0], F.swap.in[1], f.raise);
      phase = Math.min(swapPh, 1 - smooth(F.holster.out[0], F.holster.out[1], f.lowered));
      this.swapPhase = phase;
      // coming whole it rises into the hands and unrolls (not in place: the owner, "without the weapon moving much")
      if (!cupped) {
        p.y -= (1 - phase) * F.swap.rise;
        rz += (1 - phase) * F.swap.roll;
      }
      // a fusion floods it: the phase dips and comes back, the band sweeping it rebuilt
      const fu = (this.t - this.fuseAt) / FUSE.seconds;
      if (fu >= 0 && fu < 1) phase = Math.min(phase, 1 - (1 - FUSE.dip) * Math.sin(Math.PI * fu));
    }
    // (not in the bought arms: the pack's own swap swings the gun in the hands, and the spin turned it inside them, a
    // hand 19 mm through it)
    // ---- a swap thrown, in the bought arms' hands (fparms.json swap style "throw"; the owner, 2026-09-28: "have the
    // character throw it up and out or something while after ... some distance, the weapon phases out and the new one
    // phases in in its place and then animates towards the user's hands"): the hands lift the gun, let it go and drop
    // away as it flies on alone, turning over, and it phases out in the air; the next phases in where it went and flies
    // back, the hands coming up to catch it. The second half is the first run backwards (`u` from the far end)
    this.throwRelease = 0;
    this.throwOpen.l = this.throwOpen.r = 0;
    this.throwLeave.l = this.throwLeave.r = 0;
    const thrown = F && packOn && SWAP_THROW.style === "throw" && f.raise > 0 && f.raise < 1;
    if (thrown) {
      const T = this.pack.throwCfg;
      const u = f.raise < 0.5 ? f.raise : 1 - f.raise;
      // the lift, in the hands (up, not ahead: the arms are near their reach at rest, and pushed 10 cm ahead fell short)
      const lift = smooth(T.liftAt[0], T.liftAt[1], u);
      p.x += T.lift[0] * lift;
      p.y += T.lift[1] * lift;
      p.z += T.lift[2] * lift;
      // then on alone, once the fingers are opening (flying from a closed hand, the magazine went through it), quick off
      // the hands and slowing as it goes; the hands dropping away only once it has gone (dropped as they opened, they went
      // 13 mm into the gun still in them)
      const x = clamp((u - T.fly[0]) / (0.5 - T.fly[0]), 0, 1);
      const fly = 1 - (1 - x) * (1 - x);
      this.throwGun(m, fly, fly);
      // (each hand in its own time: the right off the pistol grip first while the left holds the gun up, then the left
      // tosses it: let go together, a fingertip of each caught the gun as it left, 5 to 7 mm in)
      for (const side of ["l", "r"] as const) {
        this.throwOpen[side] = smooth(T.hands[side].open[0], T.hands[side].open[1], u);
        this.throwLeave[side] = smooth(T.hands[side].leave[0], T.hands[side].leave[1], u);
      }
      this.throwRelease = smooth(T.drop[0], T.drop[1], u);
    } else this.spinGun(m, F && !(packOn && (this.pack.swapsByClip || cupped)) ? 1 - phase : 0);
    const move = F ? F.swap.move : 1;
    // melee: a quick in-and-out envelope over the swing
    const mp = this.meleeHold ?? (this.t - this.meleeAt) / MELEE_TIME;
    const meleeEnv = mp >= 0 && mp < 1 ? Math.sin(mp * Math.PI) : 0;
    const swapDip = cupped ? 0 : Math.sin(clamp(f.raise, 0, 1) * Math.PI);
    const dip = Math.max(swapDip, gunGone, meleeEnv * 0.8);
    p.y -= dip * 0.35 * move;
    rx -= dip * 0.9 * move;
    // holstering: the gun turns down and away to the right as it goes, and
    // comes back the same way (a draw), so it is not a straight lift
    const turn = Math.max(gunGone, swapDip) * move;
    p.x += turn * 0.16;
    p.z += turn * 0.08;
    ry -= turn * 0.7;
    rz += turn * 0.55;

    // Where the gun points before it is turned in the hands. A turn about the
    // model's origin, which is back at the receiver, throws the barrel across
    // the screen; these two poses let it turn about the middle of the gun.
    this.baseRot.set(rx, ry, rz);
    let turning = false;

    // ---- an inspect: the gun comes up and turns to show its left side, then
    // over to its right and top, and settles back into the hands
    this.rollR = 0;
    if (f.inspect !== undefined && f.inspect >= 0 && f.inspect < 1 && this.packOn && this.gunGripOn && this.forearmOn) {
      // in the bought arms' hands the forearm turns the gun: rolled about the forearm's own line through the grip to
      // show its left side, then its right, and back, the wrist as it is (turned about the gun's own axes the right wrist
      // bent 99 degrees, and about a long gun's middle BOOG's grip swung 20 cm out of the arm's reach); settled before
      // the left hand comes back to it (fparms.json inspectPack)
      const t = f.inspect;
      const IP = PACK_INSPECT;
      const k1 = smooth(IP.show[0], IP.show[1], t) - smooth(IP.turn[0], IP.turn[1], t);
      const k2 = smooth(IP.turn[0], IP.turn[1], t) - smooth(IP.settle[0], IP.settle[1], t);
      const q = new THREE.Quaternion().setFromAxisAngle(this.forearmR, IP.roll[0] * k1 - IP.roll[1] * k2).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz, this.pose.rotation.order)));
      const e = new THREE.Euler().setFromQuaternion(q, this.pose.rotation.order);
      rx = e.x;
      ry = e.y;
      rz = e.z;
      p.y += IP.lift * (k1 + k2);
      this.rollR = Math.min(1, (k1 + k2) * 2);
      turning = true;
    } else if (f.inspect !== undefined && f.inspect >= 0 && f.inspect < 1) {
      inspectTurn(f.inspect, this.turnPos, this.turnRot);
      p.add(this.turnPos);
      rx += this.turnRot.x;
      ry += this.turnRot.y;
      rz += this.turnRot.z;
      turning = true;
    }
    // ---- a new gun's first draw: a twirl round its barrel as it comes up; in the bought arms' hands a flick of the
    // forearm instead, the gun rolled out and back about its line through the grip (a whole twirl in a hand on the grip
    // wrung the wrist 152 degrees and put it through the gun; fparms.json inspectPack flourish)
    if (f.flourish !== undefined && f.flourish >= 0 && f.flourish < 1 && this.packOn && this.gunGripOn && this.forearmOn) {
      const k = Math.sin(Math.PI * smooth(0, 0.9, f.flourish));
      const q = new THREE.Quaternion().setFromAxisAngle(this.forearmR, PACK_INSPECT.flourish * k).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz, this.pose.rotation.order)));
      const e = new THREE.Euler().setFromQuaternion(q, this.pose.rotation.order);
      rx = e.x;
      ry = e.y;
      rz = e.z;
      p.y += PACK_INSPECT.lift * k;
      this.rollR = Math.max(this.rollR, Math.min(1, k * 2));
      turning = true;
    } else if (f.flourish !== undefined && f.flourish >= 0 && f.flourish < 1) {
      const t = f.flourish;
      rz += Math.PI * 2 * easeInOut(smooth(0.05, 0.75, t));
      p.y += 0.035 * Math.sin(Math.PI * smooth(0, 0.9, t));
      rx -= 0.25 * Math.sin(Math.PI * smooth(0, 0.9, t));
      turning = true;
    }

    this.pose.rotation.set(rx, ry, rz);
    this.rollNow = rz;
    if (turning) turnAboutCentre(p, this.baseRot, this.pose.rotation, this.packOn && this.gunGripOn ? this.gunGrip : this.gunCentre);
    this.pose.position.copy(p);
    // the bought arms' own motion of the gun as the body moves: walk, sprint, the jump (fprig.ts)
    if (packOn) {
      // the pack's sprint only while sprinting and not firing, aiming or reloading, eased: out fast, back slower
      const wantPackSprint = f.sprinting && f.adsFrac < 0.05 && !f.reloading && this.t - this.lastShotAt > LOCO.fireHold ? 1 : 0;
      this.packSprint += (wantPackSprint - this.packSprint) * Math.min(1, dt / (wantPackSprint ? LOCO.easeIn : LOCO.easeOut));
      this.pack.locomotion(dt, f.moveSpeed, easeInOut(this.packSprint), !f.onGround, ads, this.locoPos, this.locoQuat);
      this.pose.position.add(this.locoPos);
      this.pose.quaternion.premultiply(this.locoQuat);
      // and on a swap, the pack's own: the gun swung down to the chest in the hands as it phases out, the next up out of there
      const from = this.tmp.copy(this.pose.position);
      if (SWAP_THROW.style === "throw" || SWAP_THROW.style === "cup") {
        this.locoPos.set(0, 0, 0);
        this.locoQuat.identity();
      } else this.pack.swapMotion(f.raise, this.locoPos, this.locoQuat);
      // (the arms carried through the swing with the gun: swung alone, the gun bent the left wrist to 72 degrees)
      this.swapArms.makeTranslation(from.x + this.locoPos.x, from.y + this.locoPos.y, from.z + this.locoPos.z).multiply(new THREE.Matrix4().makeRotationFromQuaternion(this.locoQuat)).multiply(new THREE.Matrix4().makeTranslation(-from.x, -from.y, -from.z));
      // (the level is turned about where the gun was before these moves: it is part of the gun's own turn)
      this.levelAt.copy(from);
      this.pose.position.add(this.locoPos);
      this.pose.quaternion.premultiply(this.locoQuat);
      // and the rest hold moved, gun and arms as one, to where the gun's own hold has it: the place it jumped to on a melee,
      // when the bought arms let it go (the owner, 2026-09-30: "the gun goes to a different spot, which actually looks
      // smaller and placed at a more natural angle and looks more like other shooters ... we want it defaulted there");
      // everything the pack's hold does on top is carried with it, and none of it is left in the sights (fparms.json hipOwn)
      const k = this.pack.hipOwn * (1 - ads);
      this.hipOwnQ.identity();
      if (k > 0.001) {
        const own = this.ownHipNow();
        const at = this.pack.hip.position;
        // the pack's rest turn (its hold's, every gun's 3 degrees in, the level) against the gun's own (the 3 degrees alone)
        const order = this.pose.rotation.order;
        const packQ = new THREE.Quaternion().setFromEuler(new THREE.Euler(this.pack.hip.euler.x - (this.pack.tilt - HIP_PITCH), 0.05 + this.pack.hip.euler.y, this.pack.hip.euler.z, order));
        const ownQ = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0.05, 0, order));
        this.hipOwnQ.slerp(ownQ.multiply(packQ.invert()), k);
        const to = this.tmp2.copy(own).sub(at).multiplyScalar(k).add(at);
        const move = new THREE.Matrix4().makeTranslation(to.x, to.y, to.z).multiply(new THREE.Matrix4().makeRotationFromQuaternion(this.hipOwnQ)).multiply(new THREE.Matrix4().makeTranslation(-at.x, -at.y, -at.z));
        this.swapArms.premultiply(move);
        this.pose.position.applyMatrix4(move);
        this.pose.quaternion.premultiply(this.hipOwnQ);
      }
      // and the look on top, about the gun's origin where the rest hold now has it: out of the bottom right corner and
      // turned in toward the middle, as Hyper Scape, Apex and EMPULSE hold their guns, so the support arm barely shows
      // (the owner, 2026-09-30: "all of the other games the support arm barely shows and the gun is angled out of the
      // bottom right corner"); the arms with it, none of it in the sights (fparms.json hipLook)
      // (the moves made under the look before the refit framed with it while they play, eased in and out: an inspect, a
      // first draw, a reload's turn and a melee; at the new look the reload's turn swung the USSO into the eye and the
      // punch drew a sleeve across the picture: fparms.json beforeFrame)
      const BF = BEFORE_FRAME;
      const ins = f.inspect !== undefined && f.inspect >= 0 && f.inspect < 1 ? f.inspect : -1;
      const fl = f.flourish !== undefined && f.flourish >= 0 && f.flourish < 1 ? f.flourish : -1;
      const ml = mp >= 0 && mp < 1 ? mp : -1;
      this.beforeW = Math.max(
        ins >= 0 ? smooth(BF.inspect.in[0], BF.inspect.in[1], ins) * (1 - smooth(BF.inspect.out[0], BF.inspect.out[1], ins)) : 0,
        fl >= 0 ? smooth(BF.flourish.in[0], BF.flourish.in[1], fl) * (1 - smooth(BF.flourish.out[0], BF.flourish.out[1], fl)) : 0,
        ml >= 0 ? smooth(PACK_MELEE.on[0], PACK_MELEE.on[1], ml) * (1 - smooth(PACK_MELEE.off[0], PACK_MELEE.off[1], ml)) : 0,
        this.reloadFrameW,
      );
      const LR = this.pack.hipLook;
      const LI = this.pack.inspectLook;
      const iw = this.beforeW;
      const LK = iw > 0 ? { shift: LR.shift.map((v, j) => v + (LI.shift[j] - v) * iw), turn: LR.turn.map((v, j) => v + ((LI.turn[j] ?? 0) - v) * iw) } : LR;
      const kl = 1 - ads;
      if (kl > 0.001 && (LK.shift.some((v) => v !== 0) || LK.turn.some((v) => v !== 0))) {
        const at = k > 0.001 ? this.tmp2.copy(this.ownHipNow()).sub(this.pack.hip.position).multiplyScalar(k).add(this.pack.hip.position) : this.tmp2.copy(this.pack.hip.position);
        const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(LK.turn[0] * kl, LK.turn[1] * kl, (LK.turn[2] ?? 0) * kl, "YXZ"));
        const d = new THREE.Vector3().fromArray(LK.shift).multiplyScalar(kl);
        const look = new THREE.Matrix4().makeTranslation(at.x + d.x, at.y + d.y, at.z + d.z).multiply(new THREE.Matrix4().makeRotationFromQuaternion(q)).multiply(new THREE.Matrix4().makeTranslation(-at.x, -at.y, -at.z));
        this.swapArms.premultiply(look);
        this.pose.position.applyMatrix4(look);
        this.pose.quaternion.premultiply(q);
        this.hipOwnQ.premultiply(q);
        // (a melee's places are the look's before the refit, fparms.json packGuns inspectLook: carried by the refit's, the
        // chest the left hand draws back to came by the eye, a sheet of sleeve across the gun; the look between, so it
        // undoes this one and does that)
        const LO = this.pack.inspectLook;
        const qo = new THREE.Quaternion().setFromEuler(new THREE.Euler(LO.turn[0] * kl, LO.turn[1] * kl, (LO.turn[2] ?? 0) * kl, "YXZ"));
        const dO = new THREE.Vector3().fromArray(LO.shift).multiplyScalar(kl);
        const lookOld = new THREE.Matrix4().makeTranslation(at.x + dO.x, at.y + dO.y, at.z + dO.z).multiply(new THREE.Matrix4().makeRotationFromQuaternion(qo)).multiply(new THREE.Matrix4().makeTranslation(-at.x, -at.y, -at.z));
        this.beforeLook.copy(lookOld).multiply(look.clone().invert());
      } else this.beforeLook.identity();
    }

    // Magnified scopes: at full aim the HUD draws the scope picture, and the
    // gun would only block it.
    const scoped = o !== null && o.info.overlay && f.adsFrac > 0.9;
    this.holder.visible = (F ? phase > 0 : gunGone < 0.999) && !scoped;
    if (o) {
      // a reflex reticle only shows when you look through the window
      (o.reticle.material as THREE.MeshBasicMaterial).opacity = smooth(0.35, 0.85, f.adsFrac);
    }

    // (a melee in the bought arms' hands is their own: the right keeps the gun and the left punches, fprig.ts punch)
    const packPunch = this.pack.active !== null && this.pack.active === packGunFor(w.id);
    this.updateFists(f, Math.max(easeInOut(clamp(f.lowered * 2 - 1, 0, 1)), packPunch ? 0 : meleeEnv), !packPunch && mp >= 0 && mp < 1 ? mp : -1);
    this.heirloom?.animate?.(this.t);
    this.updateZipHand(f, dt, ads);
    this.updateCast(dt, ads);

    this.animateAction(m, w, dt, f.clipEmpty && !f.reloading);
    if (!packOn) this.animateReload(m, reloadP, f.reloading);
    this.animateParts(m, w, dt, ads, reloadP, f.reloading);
    if (F) this.feelFrame(m, w, F, phase, reloadP, f.reloading, dt, f);

    // climbing or mantling: the support hand leaves the gun for the wall,
    // reaching up and pulling in a rhythm on a climb, flat on the ledge in a
    // mantle (in gun space, so it stays in front of the camera as the gun dips)
    const wallHand = Math.max(cl, mt);
    if (wallHand > 0.001 && this.zipAmt < 0.5) {
      const reach = cl > mt ? 0.06 * Math.sin(this.t * 6) : 0;
      const target = this.tmp2.set(this.supportBase.x - 0.16 * wallHand, this.supportBase.y + (0.34 + reach) * cl + 0.14 * mt, this.supportBase.z - 0.22 * wallHand);
      this.left.group.position.lerp(target, wallHand);
      this.left.group.rotation.x = -1.4 * wallHand;
    }

    // ---- arms follow the hands wherever they went.
    // The far end of a forearm is a joint on the body, so it is fixed in the
    // camera's space and the gun moves in front of it. An elbow kept in gun
    // space instead swings through a wider arc than the gun does, because it
    // is further from the pivot: on an inspect that swung it in front of the
    // eye, where the end of the arm filled the middle of the screen. Aiming is
    // the one thing that moves it, because it brings the support elbow in
    // under the gun.
    this.pose.updateMatrix();
    this.poseInv.copy(this.pose.matrix).invert();
    this.armView.multiplyMatrices(this.group.matrix, this.pose.matrix);
    shoulderAnchor(this.armEndR, this.armFamily, "right", ads).applyMatrix4(this.poseInv);
    shoulderAnchor(this.armEndL, this.armFamily, "left", ads).applyMatrix4(this.poseInv);
    this.rightArm.set(this.right.wrist(this.tmp), this.armEndR, this.armView);
    this.leftArm.set(this.left.wrist(this.tmp), this.armEndL, this.armView);
    this.poseReal();
    // the bought arms: the clips to this frame's state, the rig under the holder, our magazine and handle moved
    if (packOn) {
      this.pack.update(
        { dt, reload: f.reloading ? this.packRP : null, empty: this.reloadEmpty, sinceShot: this.t - this.lastShotAt, rechamber: Math.max(0.4, w.rechamberTime || w.shotInterval), ads, adsDamp: RELOAD_ADS, away: F && SWAP_THROW.style !== "throw" && SWAP_THROW.style !== "cup" ? 1 - this.swapPhase : 0, pickup: this.pickupShare(), palm: this.palmFrame(f), level: this.levelBy, levelAt: this.levelAt, swing: this.swapArms, rollR: this.rollR, release: this.throwRelease, open: this.throwOpen, leave: this.throwLeave, cup: this.cupFrame(f, m), punch: this.punchFrame(mp >= 0 && mp < 1 ? mp : -1) },
        this.holder,
        m.mag,
        m.bolt,
      );
      // the magazine's sweep where the rig has just put it (it slides out and in): set before, it trailed it a frame
      if (F && m.mag) this.aimMagSweep(m);
      // the right forearm's line at rest, for an inspect to roll the gun about
      if (!(f.inspect !== undefined && f.inspect >= 0 && f.inspect < 1) && this.pack.forearm("r", this.forearmR)) {
        this.forearmR.transformDirection(new THREE.Matrix4().copy(this.group.matrixWorld).invert());
        // (in the frame the gun is turned in before the move to its own place: the inspect's roll is turned in there)
        this.forearmR.applyQuaternion(this.tmpQ.copy(this.hipOwnQ).invert());
        this.forearmOn = true;
      }
      this.real.group.visible = false;
      this.placePalmCard(f);
      // (and hidden with the gun when a scope's picture is up: the gun went and the arms stayed, a hand in the air
      // under BOOG's scope)
      if (!this.holder.visible) this.pack.group.visible = false;
    } else if (this.packFree && this.fists.visible) {
      this.pack.free(this.freeHands);
      this.real.group.visible = false;
      for (const c of this.palmCards) c.frame(0, false, -1, dt);
    } else {
      this.pack.idle();
      for (const c of this.palmCards) c.frame(0, false, -1, dt);
    }
  }

  /**
   * the magazine's sweep where it is now: along it, top to bottom, or in the bought arms' hands out from its middle
   * (fparms.json reload magPhase), the old one going from its edges in and the new one coming from its middle out
   */
  private aimMagSweep(m: GunModel): void {
    if (!m.mag) return;
    const M = this.magSweep;
    m.mag.updateMatrixWorld(true);
    M.origin.value.copy(this.magTop).applyMatrix4(m.mag.matrixWorld);
    M.dir.value.copy(this.magEnd).applyMatrix4(m.mag.matrixWorld).sub(M.origin.value);
    M.len.value = Math.max(1e-4, M.dir.value.length());
    M.dir.value.normalize();
    M.radial.value = this.packOn && PACK_RELOAD.magPhase === "radial" ? 1 : 0;
    M.center.value.copy(this.magMid).applyMatrix4(m.mag.matrixWorld);
    M.radius.value = Math.max(1e-4, this.magRadius * m.mag.getWorldScale(this.tmp2).x);
  }

  /** the look the first-person arms wear: the body, the build and the outfit's sleeves */
  setLook(skin: OperatorSkin): void {
    this.real.setLook(skin);
  }

  /** the gun camera's frame this frame (main.ts vmCamera), and how far in the sights: the real arms keep their elbows off it */
  setView(fovDeg: number, aspect: number, ads: number): void {
    this.real.view.tanV = Math.tan((fovDeg * Math.PI) / 360);
    this.real.view.tanH = this.real.view.tanV * aspect;
    this.real.view.ads = ads;
  }

  /**
   * A signature gun's scope picture (gunfeel.json scope, the HUD draws it): how long it powers on over, and how far the
   * gun has recharged since its last shot, 0..1, or null for a gun with neither
   */
  get scopeFeel(): { boot: number; charge: number | null; style: string | null } | null {
    const F = this.feel;
    const w = this.weapon;
    if (!F?.scope || !w) return null;
    const u = F.charge ? Math.min(1, (this.t - this.lastShotAt) / Math.max(0.4, w.rechamberTime || w.shotInterval)) : null;
    return { boot: F.scope.boot, charge: u, style: F.scope.style ?? null };
  }

  /** the signature gun's tracer (gunfeel.json tracer), for the rounds it fires (projectile.ts) */
  get tracerStyle(): { color: string; width: number } | null {
    return this.feel?.tracer ?? null;
  }

  /** the signature gun's feel in hand (gunfeel.json), its phase and its magazine's, and whether it is drawn (the e2e soldier section) */
  get feelState(): { gun: string | null; radial: number; rim: number; phase: number; mag: number; magRadial: number; magCenter: number[]; shown: boolean; scan: number; charge: number | null; screen: string | null; roll: number; onHandle: number | null } {
    const hasScreen = !!this.model?.root.getObjectByName("gun-screen");
    const m = this.model;
    // how far the support hand is from the charging handle, metres in the gun's space (the rack puts it there)
    const onHandle = m?.boltGrip && m.bolt ? this.left.group.position.distanceTo(this.tmp.copy(m.boltGrip).setZ(m.boltGrip.z + m.bolt.position.z - this.boltBase.z)) : null;
    return { gun: this.feel ? (this.model?.id ?? null) : null, radial: this.bodySweep.radial.value, rim: this.bodySweep.rim.value, phase: this.bodySweep.phase.value, mag: this.magSweep.phase.value, magRadial: this.magSweep.radial.value, magCenter: this.magSweep.center.value.toArray(), shown: this.holder.visible, scan: this.bodySweep.scan.value, charge: this.scopeFeel?.charge ?? null, screen: hasScreen ? this.screenDrawn : null, roll: this.rollNow, onHandle };
  }

  /** each real arm's wrist bend when last posed, degrees (fparms.ts; tools/e2e.ts) */
  get wristBend(): { r: number; l: number; rollL: number } {
    return { ...this.real.wristBend, rollL: this.real.wristRoll.l };
  }

  /** whether each real arm's upper arm's cut end is off the gun camera's frame (fparms.ts cutOffFrame; the e2e soldier section) */
  get cutsOff(): { r: boolean; l: boolean } {
    return { ...this.real.cutsOff };
  }

  /** the real arms are drawn rather than the gloves (tools/e2e.ts, tools/snap.ts) */
  get realArms(): boolean {
    return this.real.ready;
  }

  /** the real arms drawn this frame at all (tools/e2e.ts: hidden behind a magnified scope, Phase 20 A3) */
  get realArmsShown(): boolean {
    return this.real.group.visible;
  }

  /**
   * The real arms onto whichever gloves are out this frame: the gun's grip
   * and handguard, the zipline trolley, or the empty fists. The gloves are
   * still placed, because that is where every animation says the hands go;
   * they are just not drawn once the real arms are in.
   */
  private poseReal(): void {
    this.real.refresh();
    const ready = this.real.ready;
    if (ready !== !this.drawnShown) {
      this.drawnShown = !ready;
      const drawn = [this.right, this.left, this.fistR, this.fistL, this.zipHand, this.castHand].map((h) => h.group);
      const arms = [this.rightArm, this.leftArm, this.fistArmR, this.fistArmL, this.zipArm, this.castArm].map((a) => a.group);
      for (const g of [...drawn, ...arms]) for (const c of g.children) c.visible = !ready;
    }
    if (!ready) return;
    const gun = this.holder.visible;
    // The arms are not under the holder: when a magnified scope hid the gun they stayed drawn where the last
    // frame posed them, and the scope's narrower view blew the left arm up into its picture (HAEFY, PULSAR)
    this.real.group.visible = !IS_SK || gun || (this.fists.visible && !this.packFree) || this.zipRig.visible || this.castRig.visible;
    if (gun) this.real.pose("r", this.right, this.rightArm, "grip");
    else if (this.fists.visible) this.real.pose("r", this.fistR, this.fistArmR, "fist");
    if (this.zipRig.visible && !this.left.group.visible) this.real.pose("l", this.zipHand, this.zipArm, "grip");
    else if (this.castRig.visible && !this.left.group.visible) this.real.pose("l", this.castHand, this.castArm, "point");
    else if (gun && this.left.group.visible) this.real.pose("l", this.left, this.leftArm, "grip", this.onKnob);
    else if (this.fists.visible) this.real.pose("l", this.fistL, this.fistArmL, "fist");
  }

  /**
   * The empty hands while holstered: loose fists low in the frame, swinging
   * forward and back in turn while you run, harder when you sprint.
   */
  private updateFists(f: VMFrame, up: number, melee: number): void {
    this.fists.visible = up > 0.001;
    this.packFree = false;
    if (!this.fists.visible) return;
    this.downAmt += ((f.downed ?? 0) - this.downAmt) * Math.min(1, f.dt / 0.15);
    if (this.downAmt > 0.01) {
      this.crawlT += f.dt * (1.2 + Math.min(1, f.moveSpeed / 1.5) * 4.5);
      const k = this.downAmt;
      const moving = Math.min(1, f.moveSpeed / 0.8);
      for (const [hand, arm, elbow, side] of [
        [this.fistR, this.fistArmR, this.fistElbowR, 1],
        [this.fistL, this.fistArmL, this.fistElbowL, -1],
      ] as const) {
        // one hand reaches forward and comes down while the other pulls back:
        // palms flat, low at the edge of the frame, wide apart
        const ph = Math.sin(this.crawlT + (side > 0 ? 0 : Math.PI));
        const reach = ph * 0.07 * moving;
        const lift = Math.max(0, Math.cos(this.crawlT + (side > 0 ? 0 : Math.PI))) * 0.035 * moving;
        hand.group.position.set(side * 0.24, -0.34 - (1 - k) * 0.3 + lift, -0.44 - reach);
        hand.group.rotation.set(-1.25, side * 0.25, side * Math.PI * 0.5, "XYZ");
        elbow.set(side * 0.34, -0.62 - (1 - k) * 0.3, -0.12 - reach * 0.5);
        arm.set(hand.wrist(this.tmp2), elbow, this.group.matrix);
        // the bought arms' hands there, flat and palm down
        const fh = this.freeHands[side > 0 ? "r" : "l"];
        this.fists.updateMatrixWorld(true);
        this.fists.localToWorld(hand.wrist(fh.at));
        fh.along.set(side * 0.1, -0.35, -1);
        fh.palm.set(0, -1, 0);
        fh.fist = 0;
      }
      this.packFree = IS_SK && this.pack.freeReady;
      return;
    }
    const run = f.onGround ? Math.min(1, f.moveSpeed / 7.6) : 0.2;
    const amp = (f.sprinting ? SPRINT_PUMP : 0.45) * run;
    const swing = Math.sin(this.bobT * 0.5) * amp;
    const drop = (1 - up) * 0.4;
    for (const [hand, arm, elbow, side] of [
      [this.fistR, this.fistArmR, this.fistElbowR, 1],
      [this.fistL, this.fistArmL, this.fistElbowL, -1],
    ] as const) {
      const sw = swing * side; // the two arms swing opposite ways
      hand.group.position.set(side * (0.17 - 0.02 * amp), -0.25 - drop + Math.abs(sw) * 0.035 - Math.max(0, -sw) * 0.05, -0.4 - sw * 0.09);
      // The hand model grips a vertical bar with the back of the hand to the
      // outside. Rolled a quarter turn the back of the hand faces up, so from
      // behind you see knuckles, not curled fingers round an empty hole.
      hand.group.rotation.set(-0.55 - sw * 0.5, side * 0.3, side * Math.PI * 0.42, "XYZ");
      elbow.set(side * 0.3, -0.58 - drop, -0.1 - sw * 0.06);
      if (side === 1 && melee >= 0) {
        // the melee: a right-to-left sweep, reaching forward at mid swing
        const e = Math.sin(melee * Math.PI);
        hand.group.position.x += 0.08 - melee * 0.26;
        hand.group.position.y += 0.07 * e;
        hand.group.position.z -= 0.14 * e;
        hand.group.rotation.y += 0.9 * (melee - 0.5);
        hand.group.rotation.z -= 0.5 * e;
      }
      arm.set(hand.wrist(this.tmp2), elbow, this.group.matrix);
      // the bought arms' fists there: knuckles ahead and a little in, palms in and down, swinging with the run and, on a
      // melee, the right one sweeping across as the view's did
      const fh = this.freeHands[side > 0 ? "r" : "l"];
      this.fists.updateMatrixWorld(true);
      // (pulled in toward the eye: the bought arms are shorter than the view's own, and at its fists' place they were
      // straight out, 97% of their reach)
      this.fists.localToWorld(hand.wrist(fh.at).add(this.tmp.set(-side * FREE.pull[0], FREE.pull[1], FREE.pull[2])));
      const sweep = side === 1 && melee >= 0 ? (0.5 - melee) * 1.4 : 0;
      fh.along.set(-side * 0.25 + sweep, 0.25 - sw * 0.3, -1);
      fh.palm.set(-side, -0.5, 0);
      fh.fist = 1;
    }
    this.packFree = IS_SK && this.pack.freeReady;
  }

  /**
   * A hack used (hackcast.ts): the left hand comes up off the gun with the hack's card over it, taps it and goes back.
   * The hack itself is the game's (main.ts useHack); this is how it looks in the hands.
   */
  castHack(id: string): void {
    this.castAt = this.t;
    this.castTapped = false;
    this.castCard.show(hackCard(id, armCfg.hackCast.amber));
  }

  /** hold a cast `at` seconds in, for a picture (main.ts debugView.cast; tools/hackcast-sheet.ts) */
  holdCast(id: string, at: number): void {
    if (this.castId !== id) {
      this.castHack(id);
      this.castId = id;
    }
    this.castAt = this.t - at;
  }
  private castId = "";

  /** a cast's state, for a check: how far up the hand is, and whether it has tapped */
  get castState(): { up: number; tapped: boolean } {
    return { up: this.castEnv(), tapped: this.castTapped };
  }

  /** how far up the cast hand is, 0 to 1, now (0 when no cast is running) */
  private castEnv(): number {
    const C = armCfg.hackCast;
    const e = this.t - this.castAt;
    if (e < 0 || e >= C.total) return 0;
    return smooth(0, C.rise, e) * (1 - smooth(C.hold, C.total, e));
  }

  /** the cast's hand, card and burst this frame */
  private updateCast(dt: number, ads: number): void {
    const C = armCfg.hackCast;
    const e = this.t - this.castAt;
    const k = this.castEnv();
    const up = k > 0.001 && this.holder.visible && this.zipAmt < 0.5;
    this.castRig.visible = up;
    this.castArm.group.visible = up;
    if (up) {
      // one-handed: the support hand is off the gun and up
      this.left.group.visible = false;
      this.leftArm.group.visible = false;
      // the tap: the finger goes in toward the card and back
      const tap = e >= C.tap - 0.05 && e < C.tap + 0.06 ? Math.sin(Math.PI * clamp((e - C.tap + 0.05) / 0.11, 0, 1)) : 0;
      this.castRig.position.set(C.hand[0] - 0.04 * ads, C.hand[1] - (1 - k) * 0.22, C.hand[2] - tap * 0.02);
      this.castRig.rotation.set(C.turn[0], C.turn[1], C.turn[2]);
      this.castRig.updateMatrix();
      this.castArm.set(this.castHand.wrist(this.tmp2).applyMatrix4(this.castRig.matrix), this.tmp.set(C.hand[0] - 0.2, -0.45, -0.05), this.group.matrix);
      this.castCard.group.position.set(this.castRig.position.x + C.card.lift[0], this.castRig.position.y + C.card.lift[1], this.castRig.position.z + C.card.lift[2]);
    }
    if (!this.castTapped && e >= C.tap) {
      this.castTapped = true;
      this.castCard.burst();
      this.onCastTap?.();
    }
    this.castCard.frame(up || e < C.total + 0.3 ? k : 0, e < C.rise, e >= C.tap ? e - C.tap : -1, dt);
  }

  /** the left hand up on the zipline trolley, the gun held in the right */
  private updateZipHand(f: VMFrame, dt: number, ads: number): void {
    this.zipAmt += ((f.onZip ? 1 : 0) - this.zipAmt) * Math.min(1, dt / 0.12);
    const k = easeInOut(clamp(this.zipAmt, 0, 1));
    this.zipRig.visible = k > 0.001;
    this.zipArm.group.visible = this.zipRig.visible;
    // one-handed on the zip: the support hand leaves the gun
    const twoHanded = k < 0.5;
    this.left.group.visible = twoHanded;
    this.leftArm.group.visible = twoHanded;
    if (!this.zipRig.visible) return;
    // up and to the left, near the top edge of the frame; aiming tucks it
    // further out of the sight picture
    const x = -0.2 - 0.06 * ads;
    this.zipRig.position.set(x, 0.18 + (1 - k) * 0.25, -0.34);
    this.zipRig.rotation.set(0.2, 0, 0.25);
    this.zipElbow.set(x - 0.12, -0.2, -0.05);
    this.zipRig.updateMatrix();
    this.zipArm.set(this.zipHand.wrist(this.tmp2).applyMatrix4(this.zipRig.matrix), this.zipElbow, this.group.matrix);
  }

  /** bolt, slide, pump, cylinder and hammer, driven by time since the last shot */
  private animateAction(m: GunModel, w: ResolvedWeapon, dt: number, clipEmpty: boolean): void {
    const e = this.t - this.lastShotAt;
    // the chamber check on a fresh draw: the bolt or slide pulled back over
    // a third of a second and let go, once, after the gun is up
    const ce = this.t - this.checkAt;
    const check = ce >= 0 && ce < 0.36 ? Math.sin(Math.PI * clamp(ce / 0.36, 0, 1)) : 0;
    if (m.cycle === "auto" && m.bolt) {
      const T = Math.min(0.075, w.shotInterval * 0.85);
      const back = e < T ? (e < T * 0.3 ? e / (T * 0.3) : 1 - (e - T * 0.3) / (T * 0.7)) : 0;
      m.bolt.position.z = this.boltBase.z + m.travel * Math.max(back, check);
    } else if (m.cycle === "slide" && m.bolt) {
      const T = 0.075;
      const back = e < T ? (e < T * 0.35 ? e / (T * 0.35) : 1 - (e - T * 0.35) / (T * 0.65)) : 0;
      // an empty pistol locks its slide back until the reload seats a magazine
      m.bolt.position.z = m.travel * Math.max(back, check, clipEmpty ? 1 : 0);
    } else if (m.cycle === "pump" && m.pump) {
      // the pump runs inside the rechamber window, starting once the muzzle
      // has come back down
      const R = Math.max(0.35, w.rechamberTime || w.shotInterval);
      const u = clamp((e - 0.1) / (R * 0.7), 0, 1);
      m.pump.position.z = this.pumpBase.z + Math.sin(Math.PI * u) * m.travel;
      if (u > 0.4 && !this.cycleEjected) {
        this.cycleEjected = true;
        this.eject();
      }
    } else if (m.cycle === "draw" && m.bolt) {
      // the bow: the nock (and the string hand) come back as it is drawn
      m.bolt.position.z = this.boltBase.z + m.travel * this.drawFrac;
      aimBowString(m);
      this.right.group.position.z = this.gripBaseZ + m.travel * this.drawFrac;
    } else if (m.cycle === "bolt" && m.bolt) {
      const R = Math.max(0.4, w.rechamberTime || w.shotInterval);
      const u = clamp((e - 0.14) / (R * 0.75), 0, 1);
      const lift = smooth(0, 0.22, u) * (1 - smooth(0.78, 1, u));
      const pull = smooth(0.2, 0.45, u) * (1 - smooth(0.55, 0.8, u));
      m.bolt.rotation.z = -1.1 * lift;
      m.bolt.position.z = this.boltBase.z + m.travel * pull;
      if (u > 0.42 && !this.cycleEjected) {
        this.cycleEjected = true;
        this.eject();
      }
    }
    if (m.cylinder) {
      this.cylAngle += (this.cylTarget - this.cylAngle) * Math.min(1, dt * 22);
      m.cylinder.rotation.z = this.cylAngle;
    }
    if (m.hammer) m.hammer.rotation.x = e < 0.035 ? -0.5 * (1 - e / 0.035) : 0;

    // the support hand rides the pump
    if (m.pump && m.support.kind === "pump") {
      this.left.group.position.set(this.supportBase.x, this.supportBase.y, this.supportBase.z + (m.pump.position.z - this.pumpBase.z));
    }
  }

  /**
   * A bought gun's own parts (paidgun.ts hinges them, paidweapons.json motion): the pack gives them split and moves
   * none of them. The trigger swings back on a shot and stays back through a burst; the launcher's drum turns a
   * chamber a shot; the sniper's wheels turn over a rechamber and wind in going into the sights; the heavy shotgun's
   * loading gate opens for a shell reload and with the pump, and the shell in the hand rides up into it; a magazine
   * release goes in as a reload starts; the rifle's extruder drops on a shot.
   */
  private animateParts(m: GunModel, w: ResolvedWeapon, dt: number, ads: number, p: number, reloading: boolean): void {
    const k = m.parts;
    if (!k) return;
    const mo = PAID_MOTION;
    const e = this.t - this.lastShotAt;
    const base = (o: THREE.Object3D) => o.userData.base as THREE.Vector3;
    if (k.trigger) {
      const pull = e < mo.trigger.hold ? 1 : clamp(1 - (e - mo.trigger.hold) / mo.trigger.release, 0, 1);
      k.trigger.rotation.x = k.end * mo.trigger.pull * pull;
    }
    if (k.drum) {
      this.drumAngle += (this.drumTarget - this.drumAngle) * Math.min(1, dt * mo.drumRate);
      k.drum.rotation.z = this.drumAngle;
    }
    if (k.spinners.length) {
      // whole turns over the rechamber, so each wheel comes to rest as it started
      const R = Math.max(0.4, w.rechamberTime || w.shotInterval);
      const u = smooth(0, 1, clamp((e - 0.1) / (R * 0.75), 0, 1));
      k.spinners.forEach((s, i) => {
        const turns = mo.spinnerTurns[i % mo.spinnerTurns.length];
        s.rotation.x = Math.PI * 2 * (turns * u + Math.sign(turns) * mo.spinnerAim * ads);
      });
    }
    // the shell reload's reach to the port, as animateReload has it
    const toPort = reloading && m.reload === "shells" ? smooth(0.08, 0.18, p) * (1 - smooth(0.82, 0.92, p)) : 0;
    if (k.cover) {
      const pumped = m.pump && m.travel > 0 ? clamp((m.pump.position.z - this.pumpBase.z) / m.travel, 0, 1) : 0;
      k.cover.rotation.x = -k.end * mo.cover * Math.max(toPort, pumped);
    }
    if (k.round) {
      // each shell rides up from the hand into the port as the thumb pushes, and is in once the push is past its top
      const push = Math.max(0, Math.sin(p * Math.PI * 8));
      const phase = (p * 8) % 2;
      k.round.position.y = base(k.round).y - mo.roundTravel * toPort * (1 - push);
      k.round.visible = !(toPort > 0.5 && phase > 0.5 && phase < 1);
    }
    if (k.button) {
      const press = reloading && m.reload === "mag" ? smooth(0.02, 0.06, p) * (1 - smooth(0.12, 0.18, p)) : 0;
      k.button.position.x = base(k.button).x + k.buttonIn * mo.buttonPress * press;
    }
    if (k.extruder) {
      const T = Math.min(0.075, w.shotInterval * 0.85);
      const out = e < T ? (e < T * 0.3 ? e / (T * 0.3) : 1 - (e - T * 0.3) / (T * 0.7)) : 0;
      k.extruder.position.y = base(k.extruder).y - mo.extruder * out;
    }
  }

  /** magazine, cylinder or shell reload, with the support hand doing the work */
  private animateReload(m: GunModel, p: number, reloading: boolean): void {
    if (!reloading) {
      this.reloadEjected = false;
      if (m.mag) {
        m.mag.position.copy(this.magBase);
        m.mag.visible = true;
      }
      if (m.cylinder) m.cylinder.position.copy(this.cylBase);
      if (m.support.kind !== "pump") this.left.group.position.copy(this.supportBase);
      return;
    }

    if (m.reload === "mag" && m.mag) {
      const out = smooth(0.12, 0.3, p);
      const back = smooth(0.52, 0.76, p);
      const seat = smooth(0.76, 0.8, p) * (1 - smooth(0.8, 0.86, p));
      // a signature gun's magazine drops a short way, in sight, as it phases out and the new one in (gunfeel.json)
      const drop = (this.feel ? this.feel.reload.drop : 0.32) * (out - back);
      // pistols drop the magazine down the grip axis, rifles straight down
      const pistol = m.support.kind === "pistol";
      m.mag.position.set(
        this.magBase.x,
        this.magBase.y - drop * (pistol ? 0.97 : 1) + seat * 0.006,
        this.magBase.z + (pistol ? drop * 0.22 : 0)
      );
      // hidden while "empty", so the one that comes back up reads as a new mag
      m.mag.visible = !(p > 0.31 && p < 0.5);
      // the support hand goes to the magazine and rides it out and back in
      const onMag = smooth(0.04, 0.14, p) * (1 - smooth(0.8, 0.92, p));
      const target = this.tmp.copy(m.magBottom);
      target.y += m.mag.position.y - this.magBase.y - 0.02;
      target.z += m.mag.position.z - this.magBase.z;
      target.x -= 0.012;
      this.left.group.position.copy(this.supportBase).lerp(target, onMag);
    } else if (m.reload === "cylinder" && m.cylinder) {
      const swing = smooth(0.1, 0.22, p) * (1 - smooth(0.78, 0.9, p));
      m.cylinder.position.set(this.cylBase.x - 0.038 * swing, this.cylBase.y - 0.006 * swing, this.cylBase.z);
      // speed loader: a quick spin as the new rounds go in
      if (p > 0.55 && p < 0.75) this.cylTarget += 0.25;
      // all six casings fall out when the muzzle comes up
      if (p > 0.4 && !this.reloadEjected) {
        this.reloadEjected = true;
        this.pose.updateMatrix();
        for (let i = 0; i < 6; i++) {
          const a = (i * Math.PI) / 3;
          this.tmp
            .set(this.cylBase.x - 0.038 + Math.cos(a) * 0.017, this.cylBase.y + Math.sin(a) * 0.017, this.cylBase.z + 0.03)
            .applyMatrix4(this.pose.matrix);
          this.tmp2.set((Math.random() - 0.5) * 0.5, -0.6 - Math.random() * 0.5, 0.4 + Math.random() * 0.3);
          this.shells.emit(this.tmp, "brass", this.tmp2);
        }
      }
      const onCyl = smooth(0.12, 0.24, p) * (1 - smooth(0.8, 0.92, p));
      const target = this.tmp.copy(m.cylinder.position);
      target.x -= 0.03;
      target.y -= 0.02;
      this.left.group.position.copy(this.supportBase).lerp(target, onCyl);
    } else if (m.reload === "shells") {
      // thumbing shells into the loading port under the receiver
      const toPort = smooth(0.08, 0.18, p) * (1 - smooth(0.82, 0.92, p));
      const push = Math.max(0, Math.sin(p * Math.PI * 8)) * toPort;
      const target = this.tmp.set(-0.01, -0.045 + push * 0.02, -0.06);
      const base = this.tmp2.copy(this.supportBase);
      if (m.pump) base.z += m.pump.position.z - this.pumpBase.z;
      this.left.group.position.copy(base).lerp(target, toPort);
    }
  }
}
