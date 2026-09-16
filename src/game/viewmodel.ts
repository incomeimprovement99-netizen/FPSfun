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
import { Forearm, Hand } from "./arms";
import { buildOptic, type OpticModel } from "./optics";
import { heirloomModel, type HeirloomModel } from "./heirlooms";

/** a melee swing, seconds */
export const MELEE_TIME = 0.38;

const VM_SCALE = 0.42;
/** eye to rear sight when aiming down sights, before VM_SCALE */
const ADS_EYE = 0.26;

export interface VMFrame {
  dt: number;
  adsFrac: number;
  moveSpeed: number;
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
}

/** an inspect's length, s, and a first draw's flourish (ours: cosmetic, the gun is usable throughout) */
export const INSPECT_TIME = 3.2;
export const FLOURISH_TIME = 0.95;

/** how hard the gun and the empty hands pump while sprinting (1 = the old swing) */
const SPRINT_PUMP = 1.6;

const smooth = (a: number, b: number, x: number): number => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));

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

  constructor() {
    const mk = (tex: THREE.Texture) => {
      const m = new THREE.MeshBasicMaterial({
        map: tex,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
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
    // Named so a model cloned for a dummy's hands can strip it.
    this.group.name = "muzzleflash";
    // No muzzle light any more. It lit the floor on every shot, which read as
    // a strobe on automatic fire, and every point light costs every lit pixel.
    this.group.visible = false;
  }

  fire(energy: boolean): void {
    this.life = 1;
    // Just over 1: bright enough to read, barely enough to bloom.
    const c = energy ? new THREE.Color(0x7ff0ff).multiplyScalar(1.3) : new THREE.Color(0xffa24a).multiplyScalar(1.4);
    for (const m of this.mats) m.color.copy(c);
    this.star.rotation.z = Math.random() * Math.PI * 2;
    const s = 0.6 + Math.random() * 0.3;
    this.group.scale.set(s, s, 0.75 + Math.random() * 0.6);
    this.group.visible = true;
  }

  update(dt: number): void {
    if (this.life <= 0) return;
    this.life -= dt / 0.035;
    const a = Math.max(0, this.life);
    this.group.visible = a > 0;
    for (const m of this.mats) m.opacity = a;
  }
}

// ------------------------------------------------------------------- brass

interface Shell {
  mesh: THREE.Mesh;
  vel: THREE.Vector3;
  spin: THREE.Vector3;
  life: number;
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

  constructor() {
    for (let i = 0; i < 18; i++) {
      const mesh = new THREE.Mesh(this.brassGeo, this.brass);
      mesh.visible = false;
      mesh.castShadow = false;
      this.group.add(mesh);
      this.pool.push({ mesh, vel: new THREE.Vector3(), spin: new THREE.Vector3(), life: 0 });
    }
  }

  emit(at: THREE.Vector3, kind: "brass" | "hull", vel: THREE.Vector3): void {
    const s = this.pool[this.next];
    this.next = (this.next + 1) % this.pool.length;
    s.mesh.geometry = kind === "hull" ? this.hullGeo : this.brassGeo;
    s.mesh.material = kind === "hull" ? this.hull : this.brass;
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
  private readonly zipHand = new Hand(true);
  private readonly zipArm = new Forearm();
  private readonly zipElbow = new THREE.Vector3();
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
  private readonly rightElbow = new THREE.Vector3();
  private readonly leftElbow = new THREE.Vector3();
  private readonly leftElbowHip = new THREE.Vector3();
  private readonly leftElbowAds = new THREE.Vector3();
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
  private cylAngle = 0;
  private cylTarget = 0;
  private bobT = 0;
  private sprintAmt = 0;
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
  /** the inverse of the gun's pose, to pin an elbow in view space */
  private readonly poseInv = new THREE.Matrix4();
  /** how far the gun is being turned in the hands this frame (an inspect, a flourish) */
  private handTurn = 0;

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
  }

  /** show this weapon; cheap to call every frame */
  setWeapon(w: ResolvedWeapon): void {
    const key = `${w.id}:${w.magLevel}:${w.optic ?? w.integralOptic ?? ""}`;
    if (key === this.key) return;
    this.key = key;
    this.weapon = w;
    if (!this.model || this.model.id !== w.id) {
      // The optic comes off the old gun first. Models are cached per weapon, so
      // one left on would still be there on the way back, under the next one.
      this.dropOptic();
      if (this.model) this.holder.remove(this.model.root);
      const m = gunModel(w.id);
      this.model = m;
      this.holder.add(m.root);
      m.root.add(this.flash.group);
      this.flash.group.position.copy(m.muzzle);
      if (m.bolt) this.boltBase.copy(m.bolt.position);
      if (m.pump) this.pumpBase.copy(m.pump.position);
      if (m.mag) this.magBase.copy(m.mag.position);
      if (m.cylinder) this.cylBase.copy(m.cylinder.position);
      this.placeHands(m);
      this.cylAngle = this.cylTarget = 0;
      // a different gun in hand: a chamber check once it has come up
      this.checkPending = true;
    }
    // no optic fitted: a scoped weapon (the Kraber) wears its own
    this.fitOptic(this.model, w.optic ?? w.integralOptic);
    setMagRarity(this.model, w.magLevel);
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
    this.optic.group.position.set(0, m.railY, -m.opticF);
  }

  /**
   * Take the fitted optic off and free it. Its reticle material and unshared
   * geometry are its own; the housing materials, reticle textures and bevelled
   * shapes are shared caches (optics.ts, geo.ts) and stay.
   */
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
    this.rightElbow.set((g.x ?? 0) + 0.1, g.u - 0.28, -g.f + 0.34);

    const sp = m.support;
    const ss = sp.scale ?? 1;
    this.supportBase.set(sp.x ?? 0, sp.u, -sp.f);
    this.left.group.position.copy(this.supportBase);
    // 'ZYX': tilt the held bar first, then roll the hand under the handguard
    // about the barrel axis, so the palm cups it from below.
    const roll = sp.kind === "pistol" ? 0 : 0.55;
    this.left.group.rotation.set(-sp.angle, 0, roll, "ZYX");
    this.left.group.scale.set(-ss, ss, ss);
    // The support elbow sits low and well LEFT, so the forearm enters from the
    // lower-left corner at a shallow angle. With the elbow nearly under the
    // hand, the forearm dropped straight down the middle of the frame.
    if (sp.kind === "pistol") this.leftElbowHip.set((sp.x ?? 0) - 0.2, sp.u - 0.24, -sp.f + 0.3);
    else this.leftElbowHip.set((sp.x ?? 0) - 0.32, sp.u - 0.19, -sp.f + 0.31);
    // Aiming brings the gun to the centre line, and a hip-position elbow then
    // stretched the forearm into a huge tube across the lower-left of the
    // sight picture. Aimed, the elbow tucks in under the gun instead, which is
    // also what a real shooter does.
    if (sp.kind === "pistol") this.leftElbowAds.set((sp.x ?? 0) - 0.08, sp.u - 0.3, -sp.f + 0.24);
    else this.leftElbowAds.set((sp.x ?? 0) - 0.1, sp.u - 0.3, -sp.f + 0.2);
    this.leftElbow.copy(this.leftElbowHip);
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
    this.kickVel += 32 * m.kick * rateScale * adsScale;
    this.kickYaw = (Math.random() - 0.5) * 0.6;
    this.kickRoll = (Math.random() - 0.5) * 0.8;
    this.flash.fire(m.energy);
    if (m.cycle === "cylinder") this.cylTarget += Math.PI / 3;
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
    this.shells.emit(this.tmp, m.shell, this.tmp2);
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
    this.lastAds = f.adsFrac;
    this.flash.update(dt);
    this.shells.update(dt);
    if (!m || !w) return;

    const ads = easeInOut(f.adsFrac);
    const reloadP = f.reloading ? f.reloadProgress : 0;
    const reloadEnv = f.reloading ? smooth(0, 0.14, reloadP) * (1 - smooth(0.84, 1, reloadP)) : 0;

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
    const hip = m.hip;
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

    // recoil: back, muzzle up, a random twist
    p.z += this.kick * 0.018;
    rx += this.kick * 0.05;
    ry += this.kick * 0.012 * this.kickYaw;
    rz += this.kick * 0.02 * this.kickRoll;

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
    // melee: a quick in-and-out envelope over the swing
    const mp = (this.t - this.meleeAt) / MELEE_TIME;
    const meleeEnv = mp >= 0 && mp < 1 ? Math.sin(mp * Math.PI) : 0;
    const swapDip = Math.sin(clamp(f.raise, 0, 1) * Math.PI);
    const dip = Math.max(swapDip, gunGone, meleeEnv * 0.8);
    p.y -= dip * 0.35;
    rx -= dip * 0.9;
    // holstering: the gun turns down and away to the right as it goes, and
    // comes back the same way (a draw), so it is not a straight lift
    const turn = Math.max(gunGone, swapDip);
    p.x += turn * 0.16;
    p.z += turn * 0.08;
    ry -= turn * 0.7;
    rz += turn * 0.55;

    // ---- an inspect: the gun comes up and turns to show its left side, then
    // over to its right and top, and settles back into the hands
    if (f.inspect !== undefined && f.inspect >= 0 && f.inspect < 1) {
      const t = f.inspect;
      const k1 = smooth(0.04, 0.26, t) - smooth(0.44, 0.62, t);
      const k2 = smooth(0.44, 0.62, t) - smooth(0.84, 1, t);
      const up = k1 + k2;
      // how far the gun is being turned IN the hands, for the elbows below
      this.handTurn = Math.max(this.handTurn, Math.min(1, up));
      p.x -= 0.07 * up;
      p.y += 0.05 * up;
      p.z -= 0.05 * up;
      ry += 1.05 * k1 - 0.75 * k2;
      rz -= 0.55 * k1 - 0.95 * k2;
      rx -= 0.2 * k1 - 0.35 * k2;
    }
    // ---- a new gun's first draw: a twirl round its barrel as it comes up
    if (f.flourish !== undefined && f.flourish >= 0 && f.flourish < 1) {
      const t = f.flourish;
      this.handTurn = Math.max(this.handTurn, Math.sin(Math.PI * smooth(0, 0.9, t)));
      rz += Math.PI * 2 * easeInOut(smooth(0.05, 0.75, t));
      p.y += 0.035 * Math.sin(Math.PI * smooth(0, 0.9, t));
      rx -= 0.25 * Math.sin(Math.PI * smooth(0, 0.9, t));
    }

    this.pose.position.copy(p);
    this.pose.rotation.set(rx, ry, rz);

    // Magnified scopes: at full aim the HUD draws the scope picture, and the
    // gun would only block it.
    const scoped = o !== null && o.info.overlay && f.adsFrac > 0.9;
    this.holder.visible = gunGone < 0.999 && !scoped;
    if (o) {
      // a reflex reticle only shows when you look through the window
      (o.reticle.material as THREE.MeshBasicMaterial).opacity = smooth(0.35, 0.85, f.adsFrac);
    }

    this.updateFists(f, Math.max(easeInOut(clamp(f.lowered * 2 - 1, 0, 1)), meleeEnv), mp >= 0 && mp < 1 ? mp : -1);
    this.heirloom?.animate?.(this.t);
    this.updateZipHand(f, dt, ads);

    this.animateAction(m, w, dt, f.clipEmpty && !f.reloading);
    this.animateReload(m, reloadP, f.reloading);

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

    // ---- arms follow the hands wherever they went
    this.leftElbow.copy(this.leftElbowHip).lerp(this.leftElbowAds, ads);
    // An elbow is a point on the gun, so when the gun turns in the hands the
    // elbow swings round with it. During an inspect that put the forearm's
    // elbow end straight down the camera: a 60 degree turn swung it in front
    // of the eye and its cap filled the middle of the screen as a dark disc.
    // Your shoulder does not move when you turn a gun over, so while the gun
    // is being turned the elbows are pinned in VIEW space instead, low and
    // back, and the forearms keep running off the bottom of the frame.
    if (this.handTurn > 0.001) {
      this.pose.updateMatrix();
      this.poseInv.copy(this.pose.matrix).invert();
      const pin = (out: THREE.Vector3, side: number): void => {
        this.tmp3.set(side * 0.3, -0.62, -0.05).applyMatrix4(this.poseInv);
        out.lerp(this.tmp3, Math.min(1, this.handTurn));
      };
      pin(this.rightElbow, 1);
      pin(this.leftElbow, -1);
    }
    this.rightArm.set(this.right.wrist(this.tmp), this.rightElbow);
    this.leftArm.set(this.left.wrist(this.tmp), this.leftElbow);
    this.handTurn = 0;
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
        arm.set(hand.wrist(this.tmp2), elbow);
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
      arm.set(hand.wrist(this.tmp2), elbow);
    }
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
    this.zipArm.set(this.zipHand.wrist(this.tmp2).applyMatrix4(this.zipRig.matrix), this.zipElbow);
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
      const drop = 0.32 * (out - back);
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
