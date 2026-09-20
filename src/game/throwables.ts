// Throwables: the frag grenade, the arc star and thermite, and the two
// carried mobility charges, the shockwave and the rift (src/config/
// throwables.json, Season 30's numbers where Apex publishes them, ours for
// the two charges, which are no game's).
//
// A throw is a small body under gravity that collides with the world's boxes
// (RANGE_SOLIDS) one axis at a time: a frag bounces and rolls until its fuse
// runs out; an arc star sticks to the first thing it touches, a wall, the
// floor or a figure, and goes off 2.8 s later; thermite bursts into a line of
// fire across the throw where it lands. The flight is deterministic, so the
// others' screens replay a throw from its start and its velocity alone.
//
// The two charges take that same flight and, instead of hurting anyone, leave
// something behind on landing. A shockwave charge becomes a launch pad facing
// the way it was thrown, and after it arms it throws whoever stands on it with
// exactly the velocity the roads' pads use (src/config/squad.json pad.speed
// and pad.up, read here rather than copied, because two sets of numbers for
// one feeling is how the two drift apart). A rift charge opens a mouth where
// it lands and a second mouth where it was thrown from, and for a few seconds
// anyone who walks into either comes out of the other. Both throw enemies and
// carry enemies: they are ground you left behind, not an ability aimed at
// someone. Mobility on this map was furniture until now, four pads and three
// ziplines bolted where the map put them, so where you could rotate to was the
// map's decision. A charge in your pocket makes it yours.
//
// Who decides the damage: the thrower, like the shooter decides a bullet's
// (duel.ts). The match's side of it lives in main.ts: at a blast or a tick
// of fire this module says where, and main.ts works out who is in reach and
// in sight and sends the hits. The charges are the same shape of deal: this
// module says who a live charge would move and where to, and the caller does
// the moving, because only the caller knows who is down and who is on a
// zipline.
import * as THREE from "three";
import cfg from "../config/throwables.json";
import paintCfg from "../config/paint.json";
import squad from "../config/squad.json";
import { RANGE_SOLIDS } from "./range";
import { solidHit } from "./projectile";

export type ThrowKind = "frag" | "arcstar" | "thermite" | "shockwave" | "rift" | "speedpaint" | "jumppaint";
/**
 * The order is the wire's: throwCode is the index, so the two charges go on
 * the end and an older build's 0, 1 and 2 still mean what they always meant.
 */
export const THROW_KINDS: ThrowKind[] = ["frag", "arcstar", "thermite", "shockwave", "rift", "speedpaint", "jumppaint"];
/** the two that move people instead of hurting them */
export type MobilityKind = "shockwave" | "rift";
export const MOBILITY_KINDS: MobilityKind[] = ["shockwave", "rift"];
/** the two that paint the ground instead of landing on it (src/config/paint.json) */
export type PaintKind = "speed" | "jump";
export const PAINT_KINDS: ThrowKind[] = ["speedpaint", "jumppaint"];
export const isPaintThrow = (x: unknown): x is ThrowKind => x === "speedpaint" || x === "jumppaint";
export const PAINT = paintCfg;
export const THROWABLES = cfg;
/** the roads' launch pads, borrowed whole: a shockwave charge is one of these you carry */
export const PAD_LAUNCH = squad.pad;
export const throwCode = (k: ThrowKind): number => THROW_KINDS.indexOf(k);
export const throwFromCode = (n: number | undefined): ThrowKind | null => (n !== undefined && THROW_KINDS[n]) || null;
export const isThrowKind = (x: unknown): x is ThrowKind => THROW_KINDS.includes(x as ThrowKind);
export const isMobilityKind = (x: unknown): x is MobilityKind => x === "shockwave" || x === "rift";

/** a body's radius, m */
const R = 0.08;
/** the preview's dots along the arc */
const ARC_DOTS = 36;

/**
 * A flame, drawn in code: white-yellow at the root through orange to nothing
 * at the tip, ragged at the sides. Null without a canvas (Node, the tests).
 */
function flameTexture(): THREE.Texture | null {
  if (typeof document === "undefined") return null;
  const c = document.createElement("canvas");
  c.width = 64;
  c.height = 128;
  const g = c.getContext("2d")!;
  const grad = g.createLinearGradient(0, 128, 0, 0);
  grad.addColorStop(0, "rgba(255,250,220,1)");
  grad.addColorStop(0.25, "rgba(255,190,70,0.95)");
  grad.addColorStop(0.6, "rgba(255,90,20,0.6)");
  grad.addColorStop(1, "rgba(160,20,0,0)");
  g.fillStyle = grad;
  // a tongue of flame: wide at the root, narrowing and wavering to the tip
  g.beginPath();
  g.moveTo(4, 128);
  for (let y = 128; y >= 0; y -= 8) {
    const w = 28 * Math.pow(y / 128, 0.7) + 2;
    g.lineTo(32 - w + Math.sin(y * 0.21) * 3, y);
  }
  for (let y = 0; y <= 128; y += 8) {
    const w = 28 * Math.pow(y / 128, 0.7) + 2;
    g.lineTo(32 + w + Math.sin(y * 0.17 + 1) * 3, y);
  }
  g.closePath();
  g.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** a soft round glow for the ground under a fire and the landing mark */
function glowTexture(): THREE.Texture | null {
  if (typeof document === "undefined") return null;
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d")!;
  const grad = g.createRadialGradient(32, 32, 2, 32, 32, 32);
  grad.addColorStop(0, "rgba(255,170,60,0.9)");
  grad.addColorStop(1, "rgba(255,80,0,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}
const SUBSTEPS = 4;

/**
 * The shapes, made once and shared by every throw, flame and flash (a
 * geometry per event was never freed: a frag spammed in the range grew the
 * GPU's memory without end). Made on first use, so Node's tests pay nothing.
 */
let GEO: Record<"frag" | "blink" | "hub" | "blade" | "can" | "flame" | "ball" | "ring" | "puck" | "disc" | "chev" | "mouth", THREE.BufferGeometry> | null = null;
function geo(): NonNullable<typeof GEO> {
  if (!GEO) {
    const flame = new THREE.PlaneGeometry(0.8, 1.5);
    // the plane's base on the ground, so a flame grows up from it
    flame.translate(0, 0.75, 0);
    GEO = {
      frag: new THREE.SphereGeometry(0.075, 12, 10),
      blink: new THREE.SphereGeometry(0.02, 6, 6),
      hub: new THREE.CylinderGeometry(0.05, 0.05, 0.03, 14),
      blade: new THREE.ConeGeometry(0.03, 0.12, 4),
      can: new THREE.CylinderGeometry(0.045, 0.045, 0.16, 12),
      flame,
      ball: new THREE.SphereGeometry(1, 16, 12),
      ring: new THREE.RingGeometry(0.85, 1, 40),
      // the two charges in the hand, and what they leave on the ground: a
      // plate with a chevron on it the way the roads' pads are built (br.ts),
      // and a standing hoop for a rift's mouth
      puck: new THREE.CylinderGeometry(0.07, 0.07, 0.05, 14),
      disc: new THREE.CylinderGeometry(1, 1, 0.06, 26),
      chev: new THREE.ConeGeometry(0.34, 0.6, 3),
      mouth: new THREE.TorusGeometry(1, 0.08, 10, 30),
    };
  }
  return GEO;
}

/**
 * A blast's damage at a distance from its centre: the full amount inside the
 * inner radius, falling in a straight line to nothing at the outer one.
 */
export function blastDamage(kind: "frag" | "arcstar", dist: number): number {
  const k = cfg[kind];
  if (dist <= k.inner) return k.damage;
  if (dist >= k.radius) return 0;
  return Math.round(k.damage * (1 - (dist - k.inner) / (k.radius - k.inner)));
}

/** the arc star's slow: seconds, scaled by the damage it did (its full 75 is the full 5 s) */
export function arcSlowFor(damage: number): number {
  return cfg.arcstar.slow * Math.max(0, Math.min(1, damage / cfg.arcstar.damage));
}

/** is a point inside something solid (or under the floor), a body's radius around it */
function solidAt(x: number, y: number, z: number): boolean {
  if (y < R) return true;
  for (const s of RANGE_SOLIDS) {
    if (x > s.minX - R && x < s.maxX + R && z > s.minZ - R && z < s.maxZ + R && y > s.base - R && y < s.top + R) return true;
  }
  return false;
}

/** a figure a thrown body can hit (an arc star sticks to it; a frag's direct hit) */
export interface ThrowTarget {
  id: number;
  feet: THREE.Vector3;
}

export interface Thrown {
  kind: ThrowKind;
  /** the thrower's id (the match's), or -1 in the range */
  owner: number;
  /** this side's own throw: this side decides its damage */
  mine: boolean;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  /** where it left the hand, and the ground the thrower stood on: a rift's near mouth is there */
  from: THREE.Vector3;
  fromFeet: THREE.Vector3;
  /** when it goes off: a frag's fuse from the throw, an arc star's from where it stuck */
  fuseAt: number;
  /** an arc star stuck here: to a figure (followed), or the world (null) */
  stuck: { target: number | null; offset: THREE.Vector3 } | null;
  /** the figure it already hit (a frag's +10 once) */
  hitTarget: number | null;
  mesh: THREE.Object3D;
  done: boolean;
}

/** thermite's line of fire on the ground */
export interface FireStrip {
  owner: number;
  mine: boolean;
  a: THREE.Vector3;
  b: THREE.Vector3;
  until: number;
  nextTick: number;
  group: THREE.Group;
}

/**
 * A shockwave charge on the ground: where it sits, the flat direction it was
 * thrown in (which is the way it throws you), when it arms and when it dies.
 * `lastAt` is the last time it threw each figure, so standing on a live one
 * does not launch you thirty times a second.
 */
export interface Shockwave {
  owner: number;
  mine: boolean;
  at: THREE.Vector3;
  /** unit, flat: the way it faces and the way it throws */
  face: THREE.Vector3;
  armAt: number;
  until: number;
  lastAt: Map<number, number>;
  mesh: THREE.Object3D | null;
}

/**
 * A rift: two mouths, `a` where the charge was thrown from and `b` where it
 * landed, and walking into either takes you to the other. It is two-way on
 * purpose. A one-way rift is a retreat, and a retreat is the thing a squad
 * already has; a rift a squad can come back through is a position they have to
 * decide about.
 */
export interface Rift {
  owner: number;
  mine: boolean;
  a: THREE.Vector3;
  b: THREE.Vector3;
  openAt: number;
  until: number;
  lastAt: Map<number, number>;
  mesh: THREE.Object3D | null;
}

/**
 * A patch of paint (src/config/paint.json): where it struck, which way the
 * surface it stuck to faces, and what it does to whoever stands in it. A
 * floor patch is a disc on the ground; a wall patch faces out of the wall and
 * is there for a climb rather than a run.
 */
export interface Paint {
  owner: number;
  mine: boolean;
  kind: PaintKind;
  at: THREE.Vector3;
  /** the surface's normal: up for a floor, out of the wall for a wall */
  normal: THREE.Vector3;
  radius: number;
  /** a wall patch boosts a climb, a floor patch a run */
  wall: boolean;
  until: number;
  mesh: THREE.Object3D | null;
}

/** anyone a charge could move: the match's id for them, where their feet are, and whether they are down */
export interface Mover {
  id: number;
  feet: THREE.Vector3;
  downed: boolean;
}

/** a flat unit vector from a throw's velocity, falling back to `or` when it came straight down */
function facing(vel: THREE.Vector3, or: THREE.Vector3): THREE.Vector3 {
  const flat = new THREE.Vector3(vel.x, 0, vel.z);
  if (flat.lengthSq() < 1e-6) flat.copy(or).setY(0);
  if (flat.lengthSq() < 1e-6) flat.set(0, 0, 1);
  return flat.normalize();
}

/**
 * Paint where a bomb struck. `normal` is the face it stuck to, so a patch on
 * a wall knows it is on a wall: a wall patch is no use underfoot and a floor
 * patch is no use to a climb, and neither pretends otherwise.
 */
export function makePaint(owner: number, mine: boolean, kind: PaintKind, at: THREE.Vector3, normal: THREE.Vector3, now: number): Paint {
  const wall = Math.abs(normal.y) < 0.5;
  return {
    owner,
    mine,
    kind,
    at: at.clone(),
    normal: normal.clone().normalize(),
    radius: wall ? paintCfg.radius.wall : paintCfg.radius.floor,
    wall,
    until: now + paintCfg.life.seconds,
    mesh: null,
  };
}

/**
 * The paint under a pair of feet: the newest patch they are standing in, or
 * null. Only floor patches count, and only within a boot's height of the
 * ground the patch is on, so paint on a roof is not paint in the room below.
 */
export function paintUnder(paints: Paint[], feet: THREE.Vector3): Paint | null {
  let best: Paint | null = null;
  for (const p of paints) {
    if (p.wall) continue;
    if (Math.abs(feet.y - p.at.y) > 1.2) continue;
    if (Math.hypot(feet.x - p.at.x, feet.z - p.at.z) > p.radius) continue;
    if (!best || p.until > best.until) best = p;
  }
  return best;
}

/** a shockwave charge planted at `at`, facing `face`, from a landing at `now` */
export function makeShockwave(owner: number, mine: boolean, at: THREE.Vector3, face: THREE.Vector3, now: number): Shockwave {
  const armAt = now + cfg.shockwave.arm;
  return { owner, mine, at: at.clone(), face: facing(face, new THREE.Vector3(0, 0, 1)), armAt, until: armAt + cfg.shockwave.life, lastAt: new Map(), mesh: null };
}

/** a rift between `a` (the throw) and `b` (the landing), opened from a landing at `now` */
export function makeRift(owner: number, mine: boolean, a: THREE.Vector3, b: THREE.Vector3, now: number): Rift {
  const openAt = now + cfg.rift.arm;
  return { owner, mine, a: a.clone(), b: b.clone(), openAt, until: openAt + cfg.rift.life, lastAt: new Map(), mesh: null };
}

/** a charge is live when it has armed and has not run out */
export const shockwaveLive = (s: Shockwave, now: number): boolean => now >= s.armAt && now < s.until;
export const riftOpen = (r: Rift, now: number): boolean => now >= r.openAt && now < r.until;

/**
 * What a shockwave charge should throw `who` with, or null if it should not:
 * it is not armed yet, it has run out, they are not standing on it, they were
 * thrown by it a moment ago, or they are down. Being down is the whole of the
 * rule for both charges: a knocked player crawling over one is not making a
 * rotation, they are being flung out of reach of the mate trying to pick them
 * up, and the same charge is what got them knocked half the time.
 *
 * The velocity is the roads' pads', to the metre. Asking books the launch, so
 * a caller that asks and then ignores the answer has spent it.
 */
export function shockwaveLaunch(s: Shockwave, who: Mover, now: number): THREE.Vector3 | null {
  if (who.downed || !shockwaveLive(s, now)) return null;
  if (now - (s.lastAt.get(who.id) ?? -Infinity) < cfg.shockwave.regap) return null;
  const up = who.feet.y - s.at.y;
  if (up < -cfg.shockwave.under || up > cfg.shockwave.rise) return null;
  if (Math.hypot(who.feet.x - s.at.x, who.feet.z - s.at.z) > cfg.shockwave.radius) return null;
  s.lastAt.set(who.id, now);
  return new THREE.Vector3(s.face.x * PAD_LAUNCH.speed, PAD_LAUNCH.up, s.face.z * PAD_LAUNCH.speed);
}

/**
 * Where a rift should put `who`'s feet, or null if it should not move them.
 * Whichever mouth they are in, they come out of the other one, and the same
 * short gap that stops a shockwave firing every frame stops the far mouth
 * throwing them straight back through the one they arrived in.
 */
export function riftStep(r: Rift, who: Mover, now: number): THREE.Vector3 | null {
  if (who.downed || !riftOpen(r, now)) return null;
  if (now - (r.lastAt.get(who.id) ?? -Infinity) < cfg.rift.regap) return null;
  const inMouth = (m: THREE.Vector3): boolean => {
    const up = who.feet.y - m.y;
    return up > -cfg.rift.under && up < cfg.rift.rise && Math.hypot(who.feet.x - m.x, who.feet.z - m.z) <= cfg.rift.reach;
  };
  const out = inMouth(r.a) ? r.b : inMouth(r.b) ? r.a : null;
  if (!out) return null;
  r.lastAt.set(who.id, now);
  return out.clone();
}

export interface ThrowEvents {
  /** a frag or an arc star went off here */
  onBlast: (t: Thrown, at: THREE.Vector3) => void;
  /** a thrown body struck a figure: a frag's direct hit, an arc star sticking */
  onStrike: (t: Thrown, target: number) => void;
  /** a tick of a line of fire */
  onFireTick: (f: FireStrip) => void;
  /** a sound for it: the bounce of a frag, a blast, the fire catching */
  onSound: (kind: "bounce" | "blast" | "fire" | "stick", at: THREE.Vector3, what: ThrowKind) => void;
  /**
   * A carried charge landed and is now a thing on the map. Optional, because
   * the two charges work without anyone listening: this is for the caller that
   * wants to ping it on the map, name it in the HUD or give it its own noise.
   */
  onDeploy?: (kind: MobilityKind, what: Shockwave | Rift) => void;
  /** paint went down (src/config/paint.json): the page can sound it or mark it */
  onPaint?: (p: Paint) => void;
}

/** the arc a throw takes from `from` with `vel`, until it touches something (the preview) */
export function throwPath(from: THREE.Vector3, vel: THREE.Vector3, seconds = 3, step = 1 / 30): THREE.Vector3[] {
  const p = from.clone();
  const v = vel.clone();
  const out = [p.clone()];
  for (let t = 0; t < seconds; t += step) {
    v.y -= cfg.gravity * step;
    const n = p.clone().addScaledVector(v, step);
    if (solidAt(n.x, n.y, n.z)) {
      // where it meets the world: along the last step, to the first solid
      const d = n.clone().sub(p);
      const len = d.length();
      const hit = Math.min(len, solidHit(p, d.clone().divideScalar(len || 1), len));
      out.push(p.clone().addScaledVector(d.normalize(), Math.max(0, hit - R)).setY(Math.max(R, p.y + (n.y - p.y) * (hit / (len || 1)))));
      return out;
    }
    p.copy(n);
    out.push(p.clone());
  }
  return out;
}

export class Throwables {
  readonly group = new THREE.Group();
  live: Thrown[] = [];
  fires: FireStrip[] = [];
  /** the charges lying about: pads to stand on and rifts to walk into */
  pads: Shockwave[] = [];
  rifts: Rift[] = [];
  /** the paint on the floors and walls (src/config/paint.json) */
  paints: Paint[] = [];
  private flashes: Array<{ obj: THREE.Mesh; ring: THREE.Mesh; born: number; life: number; size: number }> = [];
  private readonly mats: Record<ThrowKind, THREE.Material>;
  private readonly blink = new THREE.MeshBasicMaterial({ color: 0xff3020 });
  private readonly flameMat = new THREE.MeshBasicMaterial({ color: 0xffffff, map: flameTexture(), transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  private readonly glowMat = new THREE.MeshBasicMaterial({ color: 0xffffff, map: glowTexture(), transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false });
  /** the preview: dots along the arc and a ring where it lands */
  private readonly arc: THREE.InstancedMesh;
  private readonly landing: THREE.Mesh;

  constructor(scene: THREE.Scene, private events: ThrowEvents) {
    this.group.name = "throwables";
    scene.add(this.group);
    this.mats = {
      frag: new THREE.MeshStandardMaterial({ color: 0x3d4a36, roughness: 0.6, metalness: 0.4 }),
      arcstar: new THREE.MeshStandardMaterial({ color: 0x9ad8ff, emissive: 0x2a8cff, emissiveIntensity: 1.4, roughness: 0.3, metalness: 0.6 }),
      thermite: new THREE.MeshStandardMaterial({ color: 0x8a6a3a, emissive: 0x552200, roughness: 0.5, metalness: 0.3 }),
      // the roads' pads are amber and the charge that copies them is amber too,
      // so a player reads it as the same thing without being told
      shockwave: new THREE.MeshStandardMaterial({ color: 0xffc21a, emissive: 0xc07800, emissiveIntensity: 1.1, roughness: 0.4, metalness: 0.5 }),
          rift: new THREE.MeshStandardMaterial({ color: 0xc9a6ff, emissive: 0x7a3cff, emissiveIntensity: 1.3, roughness: 0.3, metalness: 0.4 }),
      // orange for speed and blue for jump, the way Empulse reads them, and
      // the same two colours on the bomb in the air and the paint on the floor
      speedpaint: new THREE.MeshStandardMaterial({ color: 0xff8a2a, emissive: 0xc04000, emissiveIntensity: 1.2, roughness: 0.5, metalness: 0.2 }),
      jumppaint: new THREE.MeshStandardMaterial({ color: 0x4ab8ff, emissive: 0x0060c0, emissiveIntensity: 1.2, roughness: 0.5, metalness: 0.2 }),
    };
    this.arc = new THREE.InstancedMesh(new THREE.SphereGeometry(0.028, 8, 6), new THREE.MeshBasicMaterial({ color: 0xfff2a8, transparent: true, opacity: 0.9, depthTest: false }), ARC_DOTS);
    this.arc.renderOrder = 10;
    this.arc.frustumCulled = false;
    this.arc.visible = false;
    this.landing = new THREE.Mesh(new THREE.RingGeometry(0.35, 0.45, 28), new THREE.MeshBasicMaterial({ color: 0xfff2a8, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthTest: false }));
    this.landing.rotation.x = -Math.PI / 2;
    this.landing.renderOrder = 10;
    this.landing.visible = false;
    this.group.add(this.arc, this.landing);
  }

  /** the look of a thrown body */
  private body(kind: ThrowKind): THREE.Object3D {
    const g = new THREE.Group();
    if (kind === "frag") {
      const m = new THREE.Mesh(geo().frag, this.mats.frag);
      m.scale.y = 1.25;
      const light = new THREE.Mesh(geo().blink, this.blink);
      light.position.y = 0.1;
      light.name = "blink";
      g.add(m, light);
    } else if (kind === "arcstar") {
      const hub = new THREE.Mesh(geo().hub, this.mats.arcstar);
      g.add(hub);
      for (let i = 0; i < 4; i++) {
        const blade = new THREE.Mesh(geo().blade, this.mats.arcstar);
        blade.rotation.z = Math.PI / 2;
        blade.position.x = 0.09;
        const arm = new THREE.Group();
        arm.rotation.y = (i * Math.PI) / 2;
        arm.add(blade);
        g.add(arm);
      }
    } else if (kind === "shockwave" || kind === "rift") {
      // both charges are the same puck in the hand: what they are is written
      // on the ground they land on, not on the thing spinning through the air
      const m = new THREE.Mesh(geo().puck, this.mats[kind]);
      m.rotation.z = Math.PI / 2;
      g.add(m);
    } else {
      const m = new THREE.Mesh(geo().can, this.mats.thermite);
      m.rotation.z = Math.PI / 2;
      g.add(m);
    }
    return g;
  }

  /**
   * A throw: from `from` with `vel`; `mine` when this side threw it. `feet` is
   * the ground the thrower is standing on, which only a rift needs, for its
   * near mouth. Without it the mouth is dropped an eye's height below the hand
   * (src/config/throwables.json rift.eye), which is right on flat ground and
   * near enough everywhere else: a replay of someone else's throw off the wire
   * carries a hand and a velocity and never carried their feet.
   */
  throw(kind: ThrowKind, from: THREE.Vector3, vel: THREE.Vector3, owner: number, mine: boolean, now: number, feet?: THREE.Vector3): Thrown {
    const mesh = this.body(kind);
    mesh.position.copy(from);
    this.group.add(mesh);
    const t: Thrown = {
      kind,
      owner,
      mine,
      pos: from.clone(),
      vel: vel.clone(),
      from: from.clone(),
      fromFeet: feet ? feet.clone() : new THREE.Vector3(from.x, Math.max(0, from.y - cfg.rift.eye), from.z),
      fuseAt: kind === "frag" ? now + cfg.frag.fuse : Infinity,
      stuck: null,
      hitTarget: null,
      mesh,
      done: false,
    };
    this.live.push(t);
    return t;
  }

  /** the launch a figure standing on one of the charges has earned, or null */
  launchFor(who: Mover, now: number): THREE.Vector3 | null {
    for (const s of this.pads) {
      const v = shockwaveLaunch(s, who, now);
      if (v) return v;
    }
    return null;
  }

  /** where a figure walking into a rift comes out, or null */
  riftFor(who: Mover, now: number): THREE.Vector3 | null {
    for (const r of this.rifts) {
      const out = riftStep(r, who, now);
      if (out) return out;
    }
    return null;
  }

  /** the preview while one is readied: the arc it would take and where it lands */
  preview(from: THREE.Vector3 | null, vel: THREE.Vector3 | null): void {
    if (!from || !vel) {
      this.arc.visible = false;
      this.landing.visible = false;
      return;
    }
    const pts = throwPath(from, vel);
    // a dot every so far along the path, the first ones skipped (they sit in your hand)
    const m = new THREE.Matrix4();
    let n = 0;
    for (let i = 3; i < pts.length && n < ARC_DOTS; i += 2) {
      m.makeTranslation(pts[i].x, pts[i].y, pts[i].z);
      this.arc.setMatrixAt(n++, m);
    }
    this.arc.count = n;
    this.arc.instanceMatrix.needsUpdate = true;
    this.arc.visible = true;
    const end = pts[pts.length - 1];
    this.landing.position.set(end.x, end.y + 0.03, end.z);
    this.landing.visible = true;
  }

  /**
   * One frame: flights, fuses, fires, flashes. `targets`: the figures a body
   * can strike (an arc star sticks to them and follows them).
   */
  update(now: number, dt: number, targets: ThrowTarget[]): void {
    for (const t of this.live) this.step(t, now, dt, targets);
    this.live = this.live.filter((t) => {
      if (t.done) t.mesh.removeFromParent();
      return !t.done;
    });
    this.ageCharges(now);
    for (const f of this.fires) {
      if (now >= f.nextTick && now < f.until) {
        f.nextTick += cfg.thermite.tick;
        this.events.onFireTick(f);
      }
      // the flames flicker and shrink as it burns out
      const left = Math.max(0, (f.until - now) / cfg.thermite.duration);
      f.group.children.forEach((c, i) => {
        c.scale.y = (0.6 + 0.4 * Math.sin(now * 13 + i * 1.7)) * (0.35 + 0.65 * left);
      });
    }
    this.fires = this.fires.filter((f) => {
      if (now >= f.until) this.dropFire(f);
      return now < f.until;
    });
    for (const fl of this.flashes) {
      const k = (now - fl.born) / fl.life;
      fl.obj.scale.setScalar(fl.size * (0.3 + 0.9 * k));
      (fl.obj.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 0.9 * (1 - k));
      fl.ring.scale.setScalar(fl.size * (0.2 + 1.4 * k));
      (fl.ring.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 0.7 * (1 - k));
    }
    this.flashes = this.flashes.filter((fl) => {
      const over = now - fl.born > fl.life;
      if (over) this.dropFlash(fl);
      return !over;
    });
  }

  private step(t: Thrown, now: number, dt: number, targets: ThrowTarget[]): void {
    const c = cfg;
    if (t.stuck) {
      // stuck to a figure: it goes where they go
      if (t.stuck.target !== null) {
        const tg = targets.find((x) => x.id === t.stuck!.target);
        if (tg) t.pos.copy(tg.feet).add(t.stuck.offset);
      }
    } else {
      // at least SUBSTEPS slices, and none longer than cfg.maxStep, so the
      // flight is the same at 10 fps as at 60 (throwables.json _maxStep)
      const n = Math.max(SUBSTEPS, Math.ceil(dt / cfg.maxStep));
      const h = dt / n;
      for (let i = 0; i < n && !t.stuck && !t.done; i++) {
        t.vel.y -= c.gravity * h;
        // a figure in the way: a direct hit (a frag's +10, once), an arc star sticks
        for (const tg of targets) {
          if (tg.id === t.owner || t.hitTarget === tg.id) continue;
          const dx = t.pos.x - tg.feet.x;
          const dz = t.pos.z - tg.feet.z;
          const up = t.pos.y - tg.feet.y;
          if (dx * dx + dz * dz < 0.36 * 0.36 && up > 0 && up < 1.85) {
            t.hitTarget = tg.id;
            this.events.onStrike(t, tg.id);
            if (t.kind === "arcstar") {
              t.stuck = { target: tg.id, offset: t.pos.clone().sub(tg.feet) };
              t.fuseAt = now + c.arcstar.fuse;
              this.events.onSound("stick", t.pos, t.kind);
            } else if (t.kind === "thermite") {
              this.ignite(t, now);
            } else if (isPaintThrow(t.kind)) {
              // a paint bomb that hits a body bursts under them: it is paint,
              // not a weapon, and the floor is what it was aimed at
              this.splat(t, now, new THREE.Vector3(0, 1, 0), tg.feet.y);
            } else if (t.kind === "shockwave" || t.kind === "rift") {
              // a charge that hits someone sets up on them, which is a fair
              // thing to do to a person standing where you wanted a pad
              this.deploy(t, now);
            } else {
              // a frag off a body: it drops at their feet
              t.vel.set(t.vel.x * -0.2, 0, t.vel.z * -0.2);
            }
            break;
          }
        }
        if (t.stuck || t.done) break;
        // the world, an axis at a time: the axis that runs into something is the one that bounces
        let touched = false;
        // the face it struck, from the axis that stopped it: a floor and a
        // wall take paint differently
        const normal = new THREE.Vector3();
        for (const axis of ["x", "y", "z"] as const) {
          const before = t.pos[axis];
          t.pos[axis] += t.vel[axis] * h;
          if (!solidAt(t.pos.x, t.pos.y, t.pos.z)) continue;
          t.pos[axis] = before;
          touched = true;
          normal[axis] = t.vel[axis] > 0 ? -1 : 1;
          if (t.kind === "frag") {
            const speed = Math.abs(t.vel[axis]);
            t.vel[axis] *= -c.frag.bounce;
            if (axis === "y") {
              // on the floor it rolls to a stop
              const damp = Math.max(0, 1 - c.frag.roll * h);
              t.vel.x *= damp;
              t.vel.z *= damp;
              if (Math.abs(t.vel.y) < 0.6) t.vel.y = 0;
            }
            if (speed > 1.5) this.events.onSound("bounce", t.pos, t.kind);
          }
        }
        if (touched && t.kind === "arcstar") {
          t.stuck = { target: null, offset: new THREE.Vector3() };
          t.vel.set(0, 0, 0);
          t.fuseAt = now + c.arcstar.fuse;
          this.events.onSound("stick", t.pos, t.kind);
        } else if (touched && t.kind === "thermite") this.ignite(t, now);
        else if (touched && isPaintThrow(t.kind)) this.splat(t, now, normal);
        else if (touched && (t.kind === "shockwave" || t.kind === "rift")) this.deploy(t, now);
      }
    }
    t.mesh.position.copy(t.pos);
    if (!t.stuck) t.mesh.rotation.x += dt * 9;
    const blink = t.mesh.getObjectByName("blink");
    if (blink) blink.visible = Math.sin(now * (t.fuseAt - now < 1.2 ? 40 : 14)) > 0;
    if (!t.done && now >= t.fuseAt && t.kind !== "thermite") {
      t.done = true;
      this.flash(t.pos, t.kind === "frag" ? c.frag.radius : c.arcstar.radius, t.kind === "frag" ? 0xffa040 : 0x6ab8ff, now);
      this.events.onSound("blast", t.pos, t.kind);
      this.events.onBlast(t, t.pos.clone());
    }
  }

  /**
   * A carried charge lands: the thrown body is gone and what it leaves behind
   * takes its place. A shockwave becomes a plate on the ground facing the way
   * it was travelling, so you aim one by the direction you threw it and not by
   * where you were standing. A rift's far mouth is here and its near mouth is
   * back at the throw.
   */
  private deploy(t: Thrown, now: number): void {
    t.done = true;
    const ground = t.pos.clone().setY(Math.max(0, t.pos.y - R));
    if (t.kind === "shockwave") {
      const s = makeShockwave(t.owner, t.mine, ground, facing(t.vel, t.pos.clone().sub(t.from)), now);
      s.mesh = this.padMesh(s);
      this.group.add(s.mesh);
      this.pads.push(s);
      this.events.onSound("stick", ground, t.kind);
      this.events.onDeploy?.("shockwave", s);
    } else {
      const r = makeRift(t.owner, t.mine, t.fromFeet.clone(), ground, now);
      r.mesh = this.riftMesh(r);
      this.group.add(r.mesh);
      this.rifts.push(r);
      this.events.onSound("stick", ground, t.kind);
      this.events.onDeploy?.("rift", r);
    }
  }

  /**
   * A paint bomb strikes: the paint goes on the face it hit, the bomb is
   * gone, and anyone can use it from now on. `floorY` puts a patch thrown at
   * a body on the ground under them rather than in the air at their chest.
   */
  private splat(t: Thrown, now: number, normal: THREE.Vector3, floorY?: number): void {
    t.done = true;
    const kind: PaintKind = t.kind === "jumppaint" ? "jump" : "speed";
    const at = t.pos.clone();
    if (floorY !== undefined) at.y = floorY;
    else if (normal.y > 0.5) at.y = Math.max(0, at.y - R);
    const p = makePaint(t.owner, t.mine, kind, at, normal.lengthSq() > 0 ? normal : new THREE.Vector3(0, 1, 0), now);
    p.mesh = this.paintMesh(p);
    this.group.add(p.mesh);
    this.paints.push(p);
    this.events.onSound("stick", at, t.kind);
    this.events.onPaint?.(p);
  }

  /** the paint on the ground: a disc lying on the face it stuck to, its colour its kind */
  private paintMesh(p: Paint): THREE.Object3D {
    const disc = new THREE.Mesh(geo().disc, this.mats[p.kind === "jump" ? "jumppaint" : "speedpaint"]);
    disc.scale.set(p.radius, 1, p.radius);
    const g = new THREE.Group();
    g.add(disc);
    g.position.copy(p.at).addScaledVector(p.normal, 0.02);
    // a disc lies flat by default, so a wall patch is tipped onto the wall
    if (p.wall) {
      const up = new THREE.Vector3(0, 1, 0);
      g.quaternion.setFromUnitVectors(up, p.normal);
    }
    return g;
  }

  /** a planted shockwave: a plate the size of its reach with a chevron pointing the way it throws */
  private padMesh(s: Shockwave): THREE.Object3D {
    const g = new THREE.Group();
    const plate = new THREE.Mesh(geo().disc, this.mats.shockwave);
    plate.scale.set(cfg.shockwave.radius, 1, cfg.shockwave.radius);
    const chev = new THREE.Mesh(geo().chev, this.mats.shockwave);
    chev.name = "chev";
    chev.position.y = 0.35;
    // a cone points up by default, so lay it on its side facing the throw
    chev.rotation.x = Math.PI / 2;
    const aim = new THREE.Group();
    aim.rotation.y = Math.atan2(s.face.x, s.face.z);
    aim.add(chev);
    g.add(plate, aim);
    g.position.copy(s.at).setY(s.at.y + 0.03);
    return g;
  }

  /** a rift: a standing hoop at each mouth */
  private riftMesh(r: Rift): THREE.Object3D {
    const g = new THREE.Group();
    const across = new THREE.Vector3().subVectors(r.b, r.a).setY(0);
    const turn = across.lengthSq() > 1e-6 ? Math.atan2(across.x, across.z) : 0;
    for (const at of [r.a, r.b]) {
      const hoop = new THREE.Mesh(geo().mouth, this.mats.rift);
      hoop.scale.setScalar(cfg.rift.reach);
      // the hoops face each other, so from one mouth you are looking at the other
      hoop.rotation.y = turn + Math.PI / 2;
      hoop.position.copy(at).setY(at.y + cfg.rift.reach * 0.8);
      g.add(hoop);
    }
    return g;
  }

  /**
   * The charges as time passes: a pad's chevron beats faster once it is armed,
   * a rift's hoops turn, and both fade away in their last second so nobody is
   * surprised by one that is about to stop being there.
   */
  private ageCharges(now: number): void {
    for (const s of this.pads) {
      const chev = s.mesh?.getObjectByName("chev");
      if (chev) chev.visible = now < s.armAt ? Math.sin(now * 9) > 0 : true;
      if (s.mesh) s.mesh.scale.setScalar(Math.min(1, Math.max(0.2, s.until - now)));
    }
    this.pads = this.pads.filter((s) => {
      if (now >= s.until) s.mesh?.removeFromParent();
      return now < s.until;
    });
    for (const r of this.rifts) {
      if (!r.mesh) continue;
      r.mesh.children.forEach((c, i) => (c.rotation.z = now * (i ? -1.4 : 1.4)));
      r.mesh.visible = now >= r.openAt;
      r.mesh.scale.setScalar(Math.min(1, Math.max(0.2, r.until - now)));
    }
    this.rifts = this.rifts.filter((r) => {
      if (now >= r.until) r.mesh?.removeFromParent();
      return now < r.until;
    });
    // paint dries: it fades over its last seconds so nobody is surprised by a
    // patch that was carrying them a moment ago
    for (const p of this.paints) {
      const mat = (p.mesh?.children[0] as THREE.Mesh | undefined)?.material as THREE.Material | undefined;
      if (!mat) continue;
      const left = p.until - now;
      mat.transparent = true;
      mat.opacity = Math.min(1, Math.max(0, left / paintCfg.life.fade));
    }
    this.paints = this.paints.filter((p) => {
      if (now >= p.until) p.mesh?.removeFromParent();
      return now < p.until;
    });
  }

  /** thermite lands: a line of fire across the throw, on the ground where it is */
  private ignite(t: Thrown, now: number): void {
    t.done = true;
    const c = cfg.thermite;
    const flat = new THREE.Vector3(t.vel.x, 0, t.vel.z);
    if (flat.lengthSq() < 1e-6) flat.set(0, 0, 1);
    flat.normalize();
    const across = new THREE.Vector3(-flat.z, 0, flat.x);
    const ground = t.pos.clone();
    ground.y = Math.max(0, ground.y - R);
    const a = ground.clone().addScaledVector(across, -c.length / 2);
    const b = ground.clone().addScaledVector(across, c.length / 2);
    const g = new THREE.Group();
    const n = 14;
    const plane = geo().flame;
    for (let i = 0; i <= n; i++) {
      const p = a.clone().lerp(b, i / n);
      // two crossed planes a flame, so it has body from any side
      for (const turn of [0.5, -0.5 + Math.PI / 2]) {
        const flame = new THREE.Mesh(plane, this.flameMat);
        flame.position.set(p.x + (Math.random() - 0.5) * 0.2, p.y, p.z + (Math.random() - 0.5) * 0.2);
        flame.rotation.y = Math.atan2(across.x, across.z) + turn + i * 0.3;
        g.add(flame);
      }
    }
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(c.length, c.width), this.glowMat);
    glow.rotation.x = -Math.PI / 2;
    glow.rotation.z = -Math.atan2(across.z, across.x);
    glow.position.copy(ground).setY(ground.y + 0.03);
    g.add(glow);
    // the glow's size is this fire's own: its geometry goes with the fire
    glow.userData.own = true;
    this.group.add(g);
    const strip: FireStrip = { owner: t.owner, mine: t.mine, a, b, until: now + c.duration, nextTick: now, group: g };
    this.fires.push(strip);
    this.events.onSound("fire", ground, "thermite");
  }

  /** a blast's light: a ball and a ring on the ground, growing and fading */
  private flash(at: THREE.Vector3, radius: number, colour: number, now: number): void {
    const obj = new THREE.Mesh(geo().ball, new THREE.MeshBasicMaterial({ color: colour, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }));
    obj.position.copy(at);
    const ring = new THREE.Mesh(geo().ring, new THREE.MeshBasicMaterial({ color: colour, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(at.x, Math.max(0.05, at.y - 0.05), at.z);
    this.group.add(obj, ring);
    this.flashes.push({ obj, ring, born: now, life: 0.45, size: radius * 0.35 });
  }

  /** is a point within a line of fire (the thermite's width across it) */
  static inFire(f: FireStrip, p: THREE.Vector3): boolean {
    const ab = f.b.clone().sub(f.a).setY(0);
    const ap = p.clone().sub(f.a).setY(0);
    const t = Math.max(0, Math.min(1, ap.dot(ab) / Math.max(1e-6, ab.lengthSq())));
    const closest = f.a.clone().addScaledVector(f.b.clone().sub(f.a), t);
    return Math.hypot(p.x - closest.x, p.z - closest.z) <= cfg.thermite.width / 2 && Math.abs(p.y - f.a.y) < 1.2;
  }

  /** in sight of a blast: nothing solid between it and a figure's chest */
  static inSight(from: THREE.Vector3, to: THREE.Vector3): boolean {
    const d = to.clone().sub(from);
    const len = d.length();
    if (len < 1e-3) return true;
    return solidHit(from, d.divideScalar(len), len) >= len - 0.05;
  }

  /** a fire gone: out of the scene, and its own glow plane freed */
  private dropFire(f: FireStrip): void {
    f.group.removeFromParent();
    for (const c of f.group.children) if (c.userData.own) (c as THREE.Mesh).geometry.dispose();
  }

  /** a flash gone: out of the scene, and its two materials (its own, for its fade) freed */
  private dropFlash(fl: { obj: THREE.Mesh; ring: THREE.Mesh }): void {
    fl.obj.removeFromParent();
    fl.ring.removeFromParent();
    (fl.obj.material as THREE.Material).dispose();
    (fl.ring.material as THREE.Material).dispose();
  }

  clear(): void {
    for (const t of this.live) t.mesh.removeFromParent();
    for (const f of this.fires) this.dropFire(f);
    for (const fl of this.flashes) this.dropFlash(fl);
    for (const s of this.pads) s.mesh?.removeFromParent();
    for (const r of this.rifts) r.mesh?.removeFromParent();
    this.live = [];
    this.fires = [];
    this.flashes = [];
    this.pads = [];
    this.rifts = [];
    this.preview(null, null);
  }
}

/**
 * What you carry: a count of each, up to the stack; the one readied. The
 * range has no count (`endless`).
 */
export class Ordnance {
  counts: Record<ThrowKind, number> = { frag: 0, arcstar: 0, thermite: 0, shockwave: 0, rift: 0, speedpaint: 0, jumppaint: 0 };
  endless = true;
  /** the one in hand, and when its pin was out (ready to throw), or null */
  readied: { kind: ThrowKind; readyAt: number } | null = null;
  /**
   * When each of the two charges last left the hand. A count alone would let a
   * whole stack go out in one second, and two shockwaves a second apart is not
   * a rotation, it is a catapult, so a charge also has to wait its cooldown.
   * The grenades are not in here: they always had only their count.
   */
  private thrownAt: Partial<Record<ThrowKind, number>> = {};

  fill(which: "kit" | "empty"): void {
    for (const k of THROW_KINDS) this.counts[k] = which === "kit" ? (cfg.kit as Record<ThrowKind, number>)[k] : 0;
    this.thrownAt = {};
  }

  has(k: ThrowKind): boolean {
    return this.endless || this.counts[k] > 0;
  }

  /** how many of a kind you can carry: the charges carry their own number, everything else the shared one */
  static stackOf(k: ThrowKind): number {
    if (isPaintThrow(k)) return paintCfg.throw.stack;
    return k === "shockwave" ? cfg.shockwave.stack : k === "rift" ? cfg.rift.stack : cfg.stack;
  }

  /** seconds until another of this kind can be readied (0: now) */
  cooldownLeft(k: ThrowKind, now: number): number {
    const gap = isPaintThrow(k) ? paintCfg.throw.cooldown : k === "shockwave" ? cfg.shockwave.cooldown : k === "rift" ? cfg.rift.cooldown : 0;
    const last = this.thrownAt[k];
    return last === undefined ? 0 : Math.max(0, last + gap - now);
  }

  /**
   * Can this one be taken out right now: you have one, its cooldown has run
   * out, and you are not down. Down is only ever a bar on the two charges
   * here, because a downed player has no hands for anything anyway and that
   * wider rule belongs to whoever owns the key.
   */
  canReady(k: ThrowKind, now: number, downed = false): boolean {
    if (downed && isMobilityKind(k)) return false;
    return this.has(k) && this.cooldownLeft(k, now) <= 0;
  }

  add(k: ThrowKind, n: number): number {
    const room = Math.max(0, Ordnance.stackOf(k) - this.counts[k]);
    const put = Math.min(room, n);
    this.counts[k] += put;
    return put;
  }

  /**
   * The key: nothing in hand, the first you have; one in hand, the next you
   * have (and after the last, back to the gun). Returns what is in hand now.
   * A charge still on its cooldown is stepped over rather than offered, so the
   * key never puts something in your hand you are not allowed to throw.
   */
  cycle(now: number, downed = false): ThrowKind | null {
    const order = THROW_KINDS.filter((k) => this.canReady(k, now, downed));
    if (!order.length) {
      this.readied = null;
      return null;
    }
    const at = this.readied ? order.indexOf(this.readied.kind) : -1;
    const next = at + 1 < order.length ? order[at + 1] : null;
    this.readied = next ? { kind: next, readyAt: now + cfg.ready } : null;
    return next;
  }

  /** thrown: one fewer; the hand is empty; a charge starts its cooldown */
  spend(now = 0): ThrowKind | null {
    const r = this.readied;
    if (!r) return null;
    if (!this.endless) this.counts[r.kind] = Math.max(0, this.counts[r.kind] - 1);
    if (isMobilityKind(r.kind)) this.thrownAt[r.kind] = now;
    this.readied = null;
    return r.kind;
  }
}
