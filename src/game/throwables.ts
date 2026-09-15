// Throwables: the frag grenade, the arc star and thermite (src/config/
// throwables.json, Season 30's numbers where Apex publishes them).
//
// A throw is a small body under gravity that collides with the world's boxes
// (RANGE_SOLIDS) one axis at a time: a frag bounces and rolls until its fuse
// runs out; an arc star sticks to the first thing it touches, a wall, the
// floor or a figure, and goes off 2.8 s later; thermite bursts into a line of
// fire across the throw where it lands. The flight is deterministic, so the
// others' screens replay a throw from its start and its velocity alone.
//
// Who decides the damage: the thrower, like the shooter decides a bullet's
// (duel.ts). The match's side of it lives in main.ts: at a blast or a tick
// of fire this module says where, and main.ts works out who is in reach and
// in sight and sends the hits.
import * as THREE from "three";
import cfg from "../config/throwables.json";
import { RANGE_SOLIDS } from "./range";
import { solidHit } from "./projectile";

export type ThrowKind = "frag" | "arcstar" | "thermite";
export const THROW_KINDS: ThrowKind[] = ["frag", "arcstar", "thermite"];
export const THROWABLES = cfg;
export const throwCode = (k: ThrowKind): number => THROW_KINDS.indexOf(k);
export const throwFromCode = (n: number | undefined): ThrowKind | null => (n !== undefined && THROW_KINDS[n]) || null;
export const isThrowKind = (x: unknown): x is ThrowKind => x === "frag" || x === "arcstar" || x === "thermite";

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

export interface ThrowEvents {
  /** a frag or an arc star went off here */
  onBlast: (t: Thrown, at: THREE.Vector3) => void;
  /** a thrown body struck a figure: a frag's direct hit, an arc star sticking */
  onStrike: (t: Thrown, target: number) => void;
  /** a tick of a line of fire */
  onFireTick: (f: FireStrip) => void;
  /** a sound for it: the bounce of a frag, a blast, the fire catching */
  onSound: (kind: "bounce" | "blast" | "fire" | "stick", at: THREE.Vector3, what: ThrowKind) => void;
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
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.075, 12, 10), this.mats.frag);
      m.scale.y = 1.25;
      const light = new THREE.Mesh(new THREE.SphereGeometry(0.02, 6, 6), this.blink);
      light.position.y = 0.1;
      light.name = "blink";
      g.add(m, light);
    } else if (kind === "arcstar") {
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.03, 14), this.mats.arcstar);
      g.add(hub);
      for (let i = 0; i < 4; i++) {
        const blade = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.12, 4), this.mats.arcstar);
        blade.rotation.z = Math.PI / 2;
        blade.position.x = 0.09;
        const arm = new THREE.Group();
        arm.rotation.y = (i * Math.PI) / 2;
        arm.add(blade);
        g.add(arm);
      }
    } else {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.16, 12), this.mats.thermite);
      m.rotation.z = Math.PI / 2;
      g.add(m);
    }
    return g;
  }

  /** a throw: from `from` with `vel`; `mine` when this side threw it */
  throw(kind: ThrowKind, from: THREE.Vector3, vel: THREE.Vector3, owner: number, mine: boolean, now: number): Thrown {
    const mesh = this.body(kind);
    mesh.position.copy(from);
    this.group.add(mesh);
    const t: Thrown = { kind, owner, mine, pos: from.clone(), vel: vel.clone(), fuseAt: kind === "frag" ? now + cfg.frag.fuse : Infinity, stuck: null, hitTarget: null, mesh, done: false };
    this.live.push(t);
    return t;
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
      if (now >= f.until) f.group.removeFromParent();
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
      if (over) {
        fl.obj.removeFromParent();
        fl.ring.removeFromParent();
      }
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
      const h = dt / SUBSTEPS;
      for (let i = 0; i < SUBSTEPS && !t.stuck && !t.done; i++) {
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
        for (const axis of ["x", "y", "z"] as const) {
          const before = t.pos[axis];
          t.pos[axis] += t.vel[axis] * h;
          if (!solidAt(t.pos.x, t.pos.y, t.pos.z)) continue;
          t.pos[axis] = before;
          touched = true;
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
    const plane = new THREE.PlaneGeometry(0.8, 1.5);
    // the plane's base on the ground, so a flame grows up from it
    plane.translate(0, 0.75, 0);
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
    this.group.add(g);
    const strip: FireStrip = { owner: t.owner, mine: t.mine, a, b, until: now + c.duration, nextTick: now, group: g };
    this.fires.push(strip);
    this.events.onSound("fire", ground, "thermite");
  }

  /** a blast's light: a ball and a ring on the ground, growing and fading */
  private flash(at: THREE.Vector3, radius: number, colour: number, now: number): void {
    const obj = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), new THREE.MeshBasicMaterial({ color: colour, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }));
    obj.position.copy(at);
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.85, 1, 40), new THREE.MeshBasicMaterial({ color: colour, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
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

  clear(): void {
    for (const t of this.live) t.mesh.removeFromParent();
    for (const f of this.fires) f.group.removeFromParent();
    for (const fl of this.flashes) {
      fl.obj.removeFromParent();
      fl.ring.removeFromParent();
    }
    this.live = [];
    this.fires = [];
    this.flashes = [];
    this.preview(null, null);
  }
}

/**
 * What you carry: a count of each, up to the stack; the one readied. The
 * range has no count (`endless`).
 */
export class Ordnance {
  counts: Record<ThrowKind, number> = { frag: 0, arcstar: 0, thermite: 0 };
  endless = true;
  /** the one in hand, and when its pin was out (ready to throw), or null */
  readied: { kind: ThrowKind; readyAt: number } | null = null;

  fill(which: "kit" | "empty"): void {
    for (const k of THROW_KINDS) this.counts[k] = which === "kit" ? (cfg.kit as Record<ThrowKind, number>)[k] : 0;
  }

  has(k: ThrowKind): boolean {
    return this.endless || this.counts[k] > 0;
  }

  add(k: ThrowKind, n: number): number {
    const room = Math.max(0, cfg.stack - this.counts[k]);
    const put = Math.min(room, n);
    this.counts[k] += put;
    return put;
  }

  /**
   * The key: nothing in hand, the first you have; one in hand, the next you
   * have (and after the last, back to the gun). Returns what is in hand now.
   */
  cycle(now: number): ThrowKind | null {
    const order = THROW_KINDS.filter((k) => this.has(k));
    if (!order.length) {
      this.readied = null;
      return null;
    }
    const at = this.readied ? order.indexOf(this.readied.kind) : -1;
    const next = at + 1 < order.length ? order[at + 1] : null;
    this.readied = next ? { kind: next, readyAt: now + cfg.ready } : null;
    return next;
  }

  /** thrown: one fewer; the hand is empty */
  spend(): ThrowKind | null {
    const r = this.readied;
    if (!r) return null;
    if (!this.endless) this.counts[r.kind] = Math.max(0, this.counts[r.kind] - 1);
    this.readied = null;
    return r.kind;
  }
}
