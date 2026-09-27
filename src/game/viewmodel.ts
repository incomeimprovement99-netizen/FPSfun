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
import type { ResolvedWeapon } from "./weapons";
import { aimBowString, gunModel, setMagRarity, type GunModel } from "./gunmodels";
import { DOT_EYE, IRONS_EYE, openLenses, PAID_MOTION, setPaidLevel, tintDots } from "./paidgun";
import { Forearm, Hand } from "./arms";
import { FpArms } from "./fparms";
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
  /** 0..1 through a new gun's first-draw flourish, or undefined */
  flourish?: number;
  /** 1 down, not out: no gun, the hands low on the floor, reaching in turn as you crawl */
  downed?: number;
  /** how full the magazine is, 0..1: a signature gun's glow flickers when it is nearly out */
  clipFrac?: number;
}

/** an inspect's length, s, and a first draw's flourish (ours: cosmetic, the gun is usable throughout) */
export const INSPECT_TIME = 3.2;
export const FLOURISH_TIME = 0.95;

/** how hard the gun and the empty hands pump while sprinting (1 = the old swing) */
const SPRINT_PUMP = 1.6;

/** a signature gun's feel in the hands (gunfeel.json guns) */
interface GunFeel {
  swap: { out: number[]; in: number[]; move: number; rise: number; roll: number };
  holster: { out: number[] };
  kick: { impulse: number; spring: number; damp: number; back: number; up: number; yaw: number; roll: number };
  buzz?: { amp: number; hz: number };
  pulse: { glow: number; decay: number };
  charge?: { drained: number; ready: number };
  reload: { magOut: number[]; magIn: number[]; seat: number; snap: number; pulse: number; drop: number };
  flash: FlashStyle;
  shell: "cell";
  rack?: number[];
  scan: { inspect: number; fusion: number };
  ads: number;
  lowAmmo: number;
  scope?: { boot: number };
  hip?: number[];
}

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
    for (const m of this.mats) m.opacity = a;
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
  private readonly boltBase = new THREE.Vector3();
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
  private feelKick = 0;
  private feelKickVel = 0;
  /** the glow's jump on a shot, a seat or a gun coming whole, 1 at its height, falling away */
  private pulse = 0;
  private lastPhase = 1;
  private lastReloadP = 0;
  /** the reload running started with the magazine empty (the USSO racks its handle after the seat) */
  private reloadEmpty = false;
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
    this.group.add(this.castRig, this.castArm.group, this.castCard.group);
    this.group.add(this.real.group);
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
      if (this.model) this.holder.remove(this.model.root);
      const m = gunModel(w.id);
      // aimed down a bought gun's own scope, so its painted glass comes out (paidgun.ts)
      openLenses(m);
      this.model = m;
      // the middle of the gun, measured before it is parented or given a
      // flash, so the box is the weapon itself in its own space
      new THREE.Box3().setFromObject(m.root).getCenter(this.gunCentre);
      this.holder.add(m.root);
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
      // a different gun in hand: a chamber check once it has come up
      this.checkPending = true;
    }
    // no optic fitted: a scoped weapon (the Kraber) wears its own
    this.fitOptic(this.model, w.optic ?? w.integralOptic);
    setMagRarity(this.model, w.magLevel);
    // a bought gun wears its fusion level (paidgun.ts); a signature gun fused up in the hands scans along its new skin
    if (this.model.root.userData.paid && this.model.root.userData.paidLevel !== (w.fusion ?? 0)) {
      if (this.feel && !fresh && (w.fusion ?? 0) > (this.model.root.userData.paidLevel as number)) {
        this.scanAt = this.t;
        this.fuseAt = this.t;
        this.pulse = Math.max(this.pulse, 1);
        this.onFeel?.("scan", this.feel.scan.fusion);
      }
      setPaidLevel(this.model, w.fusion ?? 0);
    }
    // a signature gun's skin, new or a new level's, onto the phase
    if (this.feel) this.phaseGun(this.model);
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
    }
    this.phaseGun(m);
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
    // the sounds of the phase: out as it starts to go, in as it starts to come
    if (this.lastPhase >= 0.999 && phase < 0.999) this.onFeel?.("out");
    else if (this.lastPhase <= 0.001 && phase > 0.001) this.onFeel?.("in");
    // the scan: an inspect's passes, or a fusion's, a band along the whole gun
    let scan = -1;
    if (f.inspect !== undefined && f.inspect >= 0 && f.inspect < 1) scan = ((f.inspect * F.scan.inspect) % 1) * 1.3 - 0.15;
    else if (this.t - this.scanAt < F.scan.fusion) scan = ((this.t - this.scanAt) / F.scan.fusion) * 1.3 - 0.15;
    S.scan.value = scan;
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
    if (reloading && F.rack && this.reloadEmpty && m.bolt) {
      const u = (reloadP - F.rack[0]) / (F.rack[1] - F.rack[0]);
      if (u > 0 && u < 1) {
        m.bolt.position.z = this.boltBase.z + m.travel * Math.sin(Math.PI * u);
        if (!this.racked) {
          this.racked = true;
          this.onFeel?.("rack");
        }
      }
    }
    // the magazine: out as it drops and a new one in as it comes back, on a reload; else with the gun
    let mp = phase;
    if (reloading) {
      const R = F.reload;
      const mid = (R.magOut[1] + R.magIn[0]) / 2;
      mp = Math.min(phase, reloadP < mid ? 1 - smooth(R.magOut[0], R.magOut[1], reloadP) : smooth(R.magIn[0], R.magIn[1], reloadP));
      // the seat: a slap into the hands and a pulse
      if (this.lastReloadP < R.seat && reloadP >= R.seat) {
        this.feelKickVel += R.snap;
        this.pulse = Math.max(this.pulse, R.pulse);
      }
    }
    this.lastReloadP = reloading ? reloadP : 0;
    const M = this.magSweep;
    M.phase.value = mp;
    M.time.value = this.t;
    if (m.mag) {
      M.origin.value.copy(toWorld(this.magTop, m.mag));
      M.dir.value.copy(toWorld(this.magEnd, m.mag)).sub(M.origin.value);
      M.len.value = Math.max(1e-4, M.dir.value.length());
      M.dir.value.normalize();
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
    if (this.model) this.holder.remove(this.model.root);
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
    this.supportBase.set(sp.x ?? 0, sp.u, -sp.f);
    this.left.group.position.copy(this.supportBase);
    // 'ZYX': tilt the held bar first, then roll the hand under the handguard
    // about the barrel axis, so the palm cups it from below.
    const roll = sp.kind === "pistol" ? 0 : 0.55;
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
    // In the sights the gun holds still for a reload, as it does for a strafe: rolled at full size, a 2x window
    // swung onto the support hand still on the handguard (PANDA, ZEPHYR, NOVA; Phase 20 A3)
    const reloadEnv = (f.reloading ? smooth(0, 0.14, reloadP) * (1 - smooth(0.84, 1, reloadP)) : 0) * (1 - ads * RELOAD_ADS);

    // ---- sprint blend; ADS and reloading both win over it
    const wantSprint = f.sprinting && f.adsFrac < 0.05 && !f.reloading ? 1 : 0;
    this.sprintAmt += (wantSprint - this.sprintAmt) * Math.min(1, dt / 0.16);
    const sp = easeInOut(this.sprintAmt);
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
    this.kickVel += (-260 * this.kick - 24 * this.kickVel) * dt;
    this.kick += this.kickVel * dt;

    // ---- no look lag. An earlier version made the gun trail the view in
    // proportion to how fast you turned, which is how realistic shooters sell
    // weight and exactly what makes aiming feel slow. Apex's gun is locked to
    // the view, so this one is too.
    this.swayX = 0;
    this.swayY = 0;

    // ---- walk bob and idle breathing
    if (f.onGround && f.moveSpeed > 0.5) this.bobT += dt * (f.moveSpeed * 1.7);
    const bobAmp = 0.011 * (1 - ads * 0.85) * Math.min(1, f.moveSpeed / 5);
    const bx = Math.sin(this.bobT) * bobAmp;
    const by = Math.abs(Math.cos(this.bobT)) * bobAmp * 0.6;
    const breath = Math.sin(this.t * 1.6) * 0.0005 * (1 - ads);

    // ---- base pose: hip, ADS (sight line on the eye), sprint. With an optic
    // the OPTIC's sight line comes to the eye, at that optic's eye relief;
    // without one, the irons do.
    // a signature gun's own hip pose (gunfeel.json hip), else the gun's
    const hip = this.feel?.hip ? this.hipFeel.copy(m.hip).add(this.tmp2.fromArray(this.feel.hip)) : m.hip;
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
    // idle: standing still the gun drifts a hair, as held hands do
    const idle = (1 - Math.min(1, f.moveSpeed / 1.5)) * (1 - ads) * (f.onGround ? 1 : 0);
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
      this.feelKickVel += (-F.kick.spring * this.feelKick - F.kick.damp * this.feelKickVel) * dt;
      this.feelKick += this.feelKickVel * dt;
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

    // ---- reload pose, which depends on how this gun reloads
    if (m.reload === "cylinder") {
      rz += 0.3 * reloadEnv;
      rx += 0.55 * smooth(0.24, 0.38, reloadP) * (1 - smooth(0.55, 0.7, reloadP));
      p.y -= 0.02 * reloadEnv;
    } else if (m.reload === "shells") {
      rz -= 0.34 * reloadEnv;
      rx += 0.1 * reloadEnv;
      p.y -= 0.03 * reloadEnv;
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
    if (F) {
      const swapPh = f.raise >= 1 ? 1 : f.raise < 0.5 ? 1 - smooth(F.swap.out[0], F.swap.out[1], f.raise) : smooth(F.swap.in[0], F.swap.in[1], f.raise);
      phase = Math.min(swapPh, 1 - smooth(F.holster.out[0], F.holster.out[1], f.lowered));
      // coming whole it rises into the hands and unrolls
      p.y -= (1 - phase) * F.swap.rise;
      rz += (1 - phase) * F.swap.roll;
      // a fusion floods it: the phase dips and comes back, the band sweeping it rebuilt
      const fu = (this.t - this.fuseAt) / FUSE.seconds;
      if (fu >= 0 && fu < 1) phase = Math.min(phase, 1 - (1 - FUSE.dip) * Math.sin(Math.PI * fu));
    }
    this.spinGun(m, F ? 1 - phase : 0);
    const move = F ? F.swap.move : 1;
    // melee: a quick in-and-out envelope over the swing
    const mp = (this.t - this.meleeAt) / MELEE_TIME;
    const meleeEnv = mp >= 0 && mp < 1 ? Math.sin(mp * Math.PI) : 0;
    const swapDip = Math.sin(clamp(f.raise, 0, 1) * Math.PI);
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
    if (f.inspect !== undefined && f.inspect >= 0 && f.inspect < 1) {
      inspectTurn(f.inspect, this.turnPos, this.turnRot);
      p.add(this.turnPos);
      rx += this.turnRot.x;
      ry += this.turnRot.y;
      rz += this.turnRot.z;
      turning = true;
    }
    // ---- a new gun's first draw: a twirl round its barrel as it comes up
    if (f.flourish !== undefined && f.flourish >= 0 && f.flourish < 1) {
      const t = f.flourish;
      rz += Math.PI * 2 * easeInOut(smooth(0.05, 0.75, t));
      p.y += 0.035 * Math.sin(Math.PI * smooth(0, 0.9, t));
      rx -= 0.25 * Math.sin(Math.PI * smooth(0, 0.9, t));
      turning = true;
    }

    this.pose.rotation.set(rx, ry, rz);
    if (turning) turnAboutCentre(p, this.baseRot, this.pose.rotation, this.gunCentre);
    this.pose.position.copy(p);

    // Magnified scopes: at full aim the HUD draws the scope picture, and the
    // gun would only block it.
    const scoped = o !== null && o.info.overlay && f.adsFrac > 0.9;
    this.holder.visible = (F ? phase > 0 : gunGone < 0.999) && !scoped;
    if (o) {
      // a reflex reticle only shows when you look through the window
      (o.reticle.material as THREE.MeshBasicMaterial).opacity = smooth(0.35, 0.85, f.adsFrac);
    }

    this.updateFists(f, Math.max(easeInOut(clamp(f.lowered * 2 - 1, 0, 1)), meleeEnv), mp >= 0 && mp < 1 ? mp : -1);
    this.heirloom?.animate?.(this.t);
    this.updateZipHand(f, dt, ads);
    this.updateCast(dt, ads);

    this.animateAction(m, w, dt, f.clipEmpty && !f.reloading);
    this.animateReload(m, reloadP, f.reloading);
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
  get scopeFeel(): { boot: number; charge: number | null } | null {
    const F = this.feel;
    const w = this.weapon;
    if (!F?.scope || !w) return null;
    const u = F.charge ? Math.min(1, (this.t - this.lastShotAt) / Math.max(0.4, w.rechamberTime || w.shotInterval)) : null;
    return { boot: F.scope.boot, charge: u };
  }

  /** the signature gun's feel in hand (gunfeel.json), its phase and its magazine's, and whether it is drawn (the e2e soldier section) */
  get feelState(): { gun: string | null; phase: number; mag: number; shown: boolean; scan: number; charge: number | null } {
    return { gun: this.feel ? (this.model?.id ?? null) : null, phase: this.bodySweep.phase.value, mag: this.magSweep.phase.value, shown: this.holder.visible, scan: this.bodySweep.scan.value, charge: this.scopeFeel?.charge ?? null };
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
    // frame posed them, and the scope's narrower view blew the left arm up into its picture (HELIX, PULSAR)
    this.real.group.visible = !IS_SK || gun || this.fists.visible || this.zipRig.visible || this.castRig.visible;
    if (gun) this.real.pose("r", this.right, this.rightArm, "grip");
    else if (this.fists.visible) this.real.pose("r", this.fistR, this.fistArmR, "fist");
    if (this.zipRig.visible && !this.left.group.visible) this.real.pose("l", this.zipHand, this.zipArm, "grip");
    else if (this.castRig.visible && !this.left.group.visible) this.real.pose("l", this.castHand, this.castArm, "point");
    else if (gun && this.left.group.visible) this.real.pose("l", this.left, this.leftArm, "grip");
    else if (this.fists.visible) this.real.pose("l", this.fistL, this.fistArmL, "fist");
  }

  /**
   * The empty hands while holstered: loose fists low in the frame, swinging
   * forward and back in turn while you run, harder when you sprint.
   */
  private updateFists(f: VMFrame, up: number, melee: number): void {
    this.fists.visible = up > 0.001;
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
      }
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
    }
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
