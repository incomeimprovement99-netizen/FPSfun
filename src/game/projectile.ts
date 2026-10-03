// Projectiles with launch speed and scaled gravity, sub-stepped, swept
// against dummy hit meshes with a raycast per step.
import { solidsAlong } from "./solidgrid";
import { floorAt } from "./floors";
const ALONG: import("./range").Solid[] = [];
import * as THREE from "three";
import tracerCfg from "../config/hud.json";
import { viewer } from "./muzzle";
import type { Dummy, HitReport, Zone } from "./dummy";
import type { Target } from "./targets";
import type { ResolvedWeapon } from "./weapons";
import { IS_SK } from "./game";


/**
 * Distance along a segment to the first solid box it enters, or Infinity.
 * Slab test on the collision boxes the player walks on, which are also the
 * walls. Before this, bullets went through walls: harmless on an open range,
 * but in the course it let you shoot the next room's dummies before you got
 * there.
 */
/**
 * The face the last solidHit() entered through, as a unit normal: the axis
 * whose slab it crossed last, facing back along the ray. A box's faces are
 * axis-aligned, so this is the face's own normal, for nothing: an impact's
 * hole and dust sit flat on the wall it hit.
 */
export const lastSolidNormal = new THREE.Vector3(0, 1, 0);

export function solidHit(p0: THREE.Vector3, dir: THREE.Vector3, len: number): number {
  let best = Infinity;
  let bestAxis = -1;
  // The boxes along the ray (solidgrid.ts), not every box in the world. Nothing is made a box: a frame casts hundreds
  // of these (the bots' sight lines, the shots, the hacks' reach), and each box tested made four arrays, 0.46 ms of a
  // Neon City frame and the garbage after it (tools/profile-frame.ts, 2026-10-03).
  boxes: for (const s of solidsAlong(p0, dir, len, ALONG)) {
    let t0 = 0;
    let t1 = len;
    let axis = -1;
    // the three slabs in turn: across x, from the box's base to its top, across z
    for (let k = 0; k < 3; k++) {
      const o = k === 0 ? p0.x : k === 1 ? p0.y : p0.z;
      const d = k === 0 ? dir.x : k === 1 ? dir.y : dir.z;
      const lo = k === 0 ? s.minX : k === 1 ? s.base : s.minZ;
      const hi = k === 0 ? s.maxX : k === 1 ? s.top : s.maxZ;
      if (Math.abs(d) < 1e-9) {
        if (o < lo || o > hi) continue boxes;
        continue;
      }
      let a = (lo - o) / d;
      let b = (hi - o) / d;
      if (a > b) {
        const t = a;
        a = b;
        b = t;
      }
      if (a > t0) {
        t0 = a;
        axis = k;
      }
      if (b < t1) t1 = b;
      if (t0 > t1) continue boxes;
    }
    if (t0 < best) {
      best = t0;
      bestAxis = axis;
    }
  }
  if (best < Infinity) {
    lastSolidNormal.set(0, 0, 0);
    if (bestAxis >= 0) lastSolidNormal.setComponent(bestAxis, -Math.sign(bestAxis === 0 ? dir.x : bestAxis === 1 ? dir.y : dir.z) || 1);
    else lastSolidNormal.set(0, 1, 0);
  }
  return best;
}

interface Bullet {
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  origin: THREE.Vector3;
  age: number;
  mesh: THREE.Mesh;
  /** where the streak is drawn from (the muzzle) less where the round really left (the eye): blended out over the first metres */
  drawOffset: THREE.Vector3 | null;
  weapon: ResolvedWeapon;
  /** the other player's shot in a 1v1: drawn, stopped by walls, hits nothing */
  visual: boolean;
  /** it has already cracked past the listener */
  whizzed: boolean;
  /** its damage scale (a charged 30-30 round) */
  dmgScale: number;
}

export interface ImpactEvent {
  dummy: Dummy | null;
  report: HitReport | null;
  /** a shootable target, when the bullet hit one of those instead */
  target: Target | null;
  targetHead: boolean;
  damage: number;
  point: THREE.Vector3;
  distance: number;
  /** the gun that fired it ("melee" for a melee), for the death recap */
  weapon: string;
  /** it landed on something shootable that took it (the README screen's arrows) */
  shootable?: boolean;
  /** a round into the level: the face it hit (a wall's, or the ground's) */
  normal?: THREE.Vector3;
}

/**
 * Something bullets can hit that is not a figure or a target: the README
 * screen's arrow plates (readmetv.ts). `onHit` returns true when it took the
 * hit; false leaves it an ordinary miss, so a round on the rest of the screen
 * still behaves like a round into the wall behind it.
 */
export interface Shootable {
  meshes: THREE.Mesh[];
  onHit(point: THREE.Vector3, weapon: string): boolean;
}

const SUBSTEPS = 4;
/**
 * A tracer is a streak along the round's flight, not a dot: a unit box
 * stretched along the velocity to a frame's travel (at most TRACER.maxLen),
 * additive, and never thinner than TRACER.minPx on screen. A 4 cm sphere
 * moving 6 to 12 m a frame read as a string of dots, when it read at all.
 */
const TRACER = tracerCfg.tracers;
const tracerGeo = new THREE.BoxGeometry(1, 1, 1);
/** your own rounds, dim (hud.json tracers ownOpacity: sprayed, the USSO's were a sheet of light over the target) */
const tracerMat = new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: TRACER.ownOpacity, blending: THREE.AdditiveBlending, depthWrite: false });
/** a signature gun's own tracer (gunfeel.json tracer), one material a colour */
const tracerMats = new Map<string, THREE.MeshBasicMaterial>();
function tracerMatFor(color: string): THREE.MeshBasicMaterial {
  let m = tracerMats.get(color);
  if (!m) tracerMats.set(color, (m = new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(1.3), transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false })));
  return m;
}
/** the other player's rounds, redder so you can tell whose is whose */
const remoteTracerMat = new THREE.MeshBasicMaterial({ color: 0xff6a4a, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false });
const Z = new THREE.Vector3(0, 0, 1);
const tv = new THREE.Vector3();
const td = new THREE.Vector3();

export class ProjectileSystem {
  private bullets: Bullet[] = [];
  private ray = new THREE.Raycaster();
  private tmpDir = new THREE.Vector3();

  constructor(
    private scene: THREE.Scene,
    private dummies: Dummy[],
    private targets: Target[],
    private floorY = 0
  ) {}

  /**
   * A round. `drawFrom` is where its tracer is drawn from (the gun's muzzle):
   * the round itself leaves the eye, so a tracer drawn from there sat on the
   * line of sight and was never seen; drawn from the muzzle, it joins the
   * real path over the first TRACER.blend metres.
   */
  fire(origin: THREE.Vector3, dir: THREE.Vector3, w: ResolvedWeapon, visual = false, dmgScale = 1, speedScale = 1, drawFrom: THREE.Vector3 | null = null, style: { color: string; width: number } | null = null): void {
    const mesh = new THREE.Mesh(tracerGeo, visual ? remoteTracerMat : style ? tracerMatFor(style.color) : tracerMat);
    mesh.userData.width = style && !visual ? style.width : 1;
    mesh.position.copy(drawFrom ?? origin);
    mesh.scale.setScalar(0.001);
    mesh.renderOrder = 5;
    this.scene.add(mesh);
    this.bullets.push({
      pos: origin.clone(),
      vel: dir.clone().normalize().multiplyScalar(w.projectile.speed * speedScale),
      origin: origin.clone(),
      age: 0,
      mesh,
      drawOffset: drawFrom ? drawFrom.clone().sub(origin) : null,
      weapon: w,
      visual,
      whizzed: false,
      dmgScale,
    });
  }

  /** the live rounds' tracers: how long and wide each is drawn, and how far its head is off the real path (tools/e2e.ts) */
  get tracers(): Array<{ len: number; width: number; off: number; travelled: number; opacity: number }> {
    return this.bullets.map((b) => {
      const head = b.mesh.position.clone().addScaledVector(b.vel.clone().normalize(), b.mesh.scale.z / 2);
      return { len: b.mesh.scale.z, width: b.mesh.scale.x, off: head.distanceTo(b.pos), travelled: b.pos.distanceTo(b.origin), opacity: (b.mesh.material as THREE.MeshBasicMaterial).opacity };
    });
  }

  /** the streak: along the velocity, a frame's travel long, from the muzzle blending onto the real path */
  private placeTracer(b: Bullet, dt: number): void {
    const speed = b.vel.length();
    if (speed < 1e-6) return;
    td.copy(b.vel).divideScalar(speed);
    const travelled = b.pos.distanceTo(b.origin);
    const len = Math.min(TRACER.maxLen, speed * Math.max(dt, 1 / 60), travelled + 0.05);
    tv.copy(b.pos);
    if (b.drawOffset) tv.addScaledVector(b.drawOffset, Math.max(0, 1 - travelled / TRACER.blend));
    // its middle half a length behind the round's head
    b.mesh.position.copy(tv).addScaledVector(td, -len / 2);
    b.mesh.quaternion.setFromUnitVectors(Z, td);
    const dist = viewer.pos.distanceTo(tv);
    const width = Math.max(TRACER.width, (dist * TRACER.minPx) / viewer.pxPerRad) * ((b.mesh.userData.width as number | undefined) ?? 1);
    b.mesh.scale.set(width, width, len);
  }

  /** where your ears are: someone else's round passing within 2.5 m cracks past you (onWhiz) */
  listener: THREE.Vector3 | null = null;
  onWhiz: ((at: THREE.Vector3) => void) | null = null;
  /** someone else's round stopped against the level (where, the face, the gun): the page marks it */
  onVisualImpact: ((at: THREE.Vector3, normal: THREE.Vector3, weapon: string) => void) | null = null;

  /** add something bullets can hit after construction (the 1v1 opponent) */
  addDummy(d: Dummy): void {
    if (!this.dummies.includes(d)) this.dummies.push(d);
  }
  removeDummy(d: Dummy): void {
    const i = this.dummies.indexOf(d);
    if (i >= 0) this.dummies.splice(i, 1);
  }

  private shootables: Shootable[] = [];
  /** add something that reacts to being shot but takes no damage (the README screen) */
  addShootable(s: Shootable): void {
    if (!this.shootables.includes(s)) this.shootables.push(s);
  }

  /**
   * A melee strike: the first dummy, target or wall within `range` along
   * `dir`. Melee does the same damage wherever it lands, so no headshot
   * multiplier. Returns true if it hit something that takes damage.
   */
  melee(origin: THREE.Vector3, dir: THREE.Vector3, range: number, damage: number, now: number, onImpact: (e: ImpactEvent) => void, headDamage = damage): boolean {
    const { meshes, owner, tOwner, sOwner } = this.gather(now);
    const unit = dir.clone().normalize();
    this.ray.set(origin, unit);
    this.ray.far = Math.min(range, solidHit(origin, unit, range));
    const hit = meshes.length ? this.ray.intersectObjects(meshes, false)[0] : undefined;
    if (!hit) return false;
    const d = owner.get(hit.object);
    const dist = hit.distance;
    if (d) {
      const zone = (hit.object.userData.zone as Zone) ?? "body";
      const report = d.hit(now, zone, zone === "head" ? headDamage : damage, 1, 1, hit.point);
      onImpact({ dummy: d, report, target: null, targetHead: false, damage: report?.amount ?? 0, point: hit.point.clone(), distance: dist, weapon: "melee" });
      return true;
    }
    const s = sOwner.get(hit.object);
    if (s) {
      // a punch on the README screen's arrows turns the page too
      const took = s.onHit(hit.point.clone(), "melee");
      onImpact({ dummy: null, report: null, target: null, targetHead: false, damage: 0, point: hit.point.clone(), distance: dist, weapon: "melee", shootable: took });
      return took;
    }
    const t = tOwner.get(hit.object);
    if (!t) return false;
    t.hit(now, false, damage);
    onImpact({ dummy: null, report: null, target: t, targetHead: false, damage, point: hit.point.clone(), distance: dist, weapon: "melee" });
    return true;
  }

  /** every hit mesh in play, and who owns it */
  private gather(now: number): { meshes: THREE.Mesh[]; owner: Map<THREE.Object3D, Dummy>; tOwner: Map<THREE.Object3D, Target>; sOwner: Map<THREE.Object3D, Shootable> } {
    const meshes: THREE.Mesh[] = [];
    const owner = new Map<THREE.Object3D, Dummy>();
    const tOwner = new Map<THREE.Object3D, Target>();
    const sOwner = new Map<THREE.Object3D, Shootable>();
    for (const s of this.shootables) {
      for (const m of s.meshes) {
        if (!m.visible) continue;
        // nothing else updates these: with ?norender the renderer never runs,
        // and an un-updated matrix leaves the mesh at the origin to a raycast
        m.updateMatrixWorld();
        meshes.push(m);
        sOwner.set(m, s);
      }
    }
    for (const d of this.dummies) {
      if (!d.group.visible || d.knocked) continue;
      for (const m of d.hitMeshes) {
        // three's Raycaster ignores `visible`, so an invisible mesh would
        // still block. The armor plate is hidden at tier 0 and must not.
        if (!m.visible) continue;
        meshes.push(m);
        owner.set(m, d);
      }
    }
    for (const t of this.targets) {
      if (!t.isLive(now) || !t.group.visible) continue;
      for (const m of t.hitMeshes) {
        meshes.push(m);
        tOwner.set(m, t);
      }
    }
    // world matrices must be current or fast-moving rail targets are tested
    // against last frame's position
    for (const t of this.targets) t.group.updateMatrixWorld();
    for (const d of this.dummies) d.group.updateMatrixWorld();
    return { meshes, owner, tOwner, sOwner };
  }

  update(dt: number, now: number, onImpact: (e: ImpactEvent) => void): void {
    // Nothing in flight, nothing to test: the gathering made its maps and walked every figure's matrices (the frame's
    // own walk does that before it is drawn) each frame of a match, shot or not.
    if (!this.bullets.length) return;
    const h = dt / SUBSTEPS;
    const { meshes, owner, tOwner, sOwner } = this.gather(now);
    for (let bi = this.bullets.length - 1; bi >= 0; bi--) {
      const b = this.bullets[bi];
      let dead = false;
      for (let s = 0; s < SUBSTEPS && !dead; s++) {
        const prev = b.pos.clone();
        b.vel.y -= b.weapon.projectile.gravity * h;
        b.pos.addScaledVector(b.vel, h);
        b.age += h;
        const seg = this.tmpDir.subVectors(b.pos, prev);
        const len = seg.length();
        const unit = len > 0 ? seg.clone().divideScalar(len) : seg.clone();
        const wallAt = len > 0 ? solidHit(prev, unit, len) : Infinity;
        const wallNormal = wallAt < Infinity ? lastSolidNormal.clone() : null;
        if (b.visual && !b.whizzed && this.listener && len > 0 && b.origin.distanceToSquared(this.listener) > 9) {
          // the closest this step comes to the listener
          const L = this.listener;
          const k = Math.max(0, Math.min(len, (L.x - prev.x) * unit.x + (L.y - prev.y) * unit.y + (L.z - prev.z) * unit.z));
          const cx = prev.x + unit.x * k;
          const cy = prev.y + unit.y * k;
          const cz = prev.z + unit.z * k;
          if ((cx - L.x) ** 2 + (cy - L.y) ** 2 + (cz - L.z) ** 2 < 6.25) {
            b.whizzed = true;
            this.onWhiz?.(new THREE.Vector3(cx, cy, cz));
          }
        }
        if (b.visual) {
          // someone else's shot: it only needs to stop where it would
          // and it marks where it stopped, as a round of your own does
          if (wallAt < Infinity) this.onVisualImpact?.(prev.clone().addScaledVector(unit, wallAt), wallNormal!, b.weapon.id);
          else if (b.pos.y <= this.floorY + floorAt(b.pos.x, b.pos.z)) this.onVisualImpact?.(b.pos.clone(), new THREE.Vector3(0, 1, 0), b.weapon.id);
          if (wallAt < Infinity || b.pos.y <= this.floorY + floorAt(b.pos.x, b.pos.z) || b.age > b.weapon.projectile.lifetime) dead = true;
          continue;
        }
        if (len > 0 && meshes.length) {
          this.ray.set(prev, unit);
          this.ray.far = Math.min(len, wallAt);
          const hits = this.ray.intersectObjects(meshes, false);
          if (hits.length) {
            const hit = hits[0];
            const dist = hit.point.distanceTo(b.origin);
            const dmg = falloff(b.weapon, dist) * b.dmgScale;
            const zone = (hit.object.userData.zone as Zone) ?? "body";
            const headshotScale = dist <= b.weapon.damage.headshotMaxDist ? b.weapon.damage.headshot : 1;
            const d = owner.get(hit.object);
            if (d) {
              const report = d.hit(now, zone, dmg, headshotScale, b.weapon.damage.leg, hit.point, b.weapon.damage.shieldScale, b.weapon.damage.unshieldedScale);
              onImpact({
                dummy: d, report, target: null, targetHead: false,
                damage: report?.amount ?? 0, point: hit.point.clone(), distance: dist, weapon: b.weapon.id,
              });
            } else if (sOwner.has(hit.object)) {
              // the README screen: it turns its own page, and takes no damage
              const s = sOwner.get(hit.object)!;
              const took = s.onHit(hit.point.clone(), b.weapon.id);
              onImpact({
                dummy: null, report: null, target: null, targetHead: false, damage: 0,
                point: hit.point.clone(), distance: dist, weapon: b.weapon.id, shootable: took,
              });
            } else {
              const t = tOwner.get(hit.object)!;
              // a head hit past headshot range is body damage and no headshot
              const head = zone === "head" && headshotScale > 1;
              // whole points in the legacy game; SpeedKills' tuned value, as a figure takes it (dummy.ts WHOLE_HITS)
              const raw = dmg * (head ? headshotScale : 1);
              const amount = IS_SK ? raw : Math.floor(raw + 1e-6);
              t.hit(now, head, amount);
              onImpact({
                dummy: null, report: null, target: t, targetHead: head,
                damage: amount, point: hit.point.clone(), distance: dist, weapon: b.weapon.id,
              });
            }
            dead = true;
            break;
          }
        }
        if (wallAt < Infinity) {
          // stopped by a wall: report it as a miss where it landed
          const at = prev.clone().addScaledVector(unit, wallAt);
          onImpact({ dummy: null, report: null, target: null, targetHead: false, damage: 0, point: at, distance: at.distanceTo(b.origin), weapon: b.weapon.id, normal: wallNormal ?? undefined });
          dead = true;
          break;
        }
        if (b.pos.y <= this.floorY + floorAt(b.pos.x, b.pos.z)) {
          onImpact({
            dummy: null, report: null, target: null, targetHead: false, damage: 0,
            point: b.pos.clone(), distance: b.pos.distanceTo(b.origin), weapon: b.weapon.id, normal: new THREE.Vector3(0, 1, 0),
          });
          dead = true;
        } else if (b.age > b.weapon.projectile.lifetime) dead = true;
      }
      if (dead) {
        this.scene.remove(b.mesh);
        this.bullets.splice(bi, 1);
      } else this.placeTracer(b, dt);
    }
  }
}

export function falloff(w: ResolvedWeapon, dist: number): number {
  const d = w.damage;
  if (dist <= d.nearDist) return d.near;
  if (dist <= d.farDist) return lerp(d.near, d.far, (dist - d.nearDist) / (d.farDist - d.nearDist));
  if (dist <= d.veryFarDist) return lerp(d.far, d.veryFar, (dist - d.farDist) / (d.veryFarDist - d.farDist));
  return d.veryFar;
}
const lerp = (a: number, b: number, t: number) => a + (b - a) * Math.max(0, Math.min(1, t));
