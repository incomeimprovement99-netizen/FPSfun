// Projectiles with launch speed and scaled gravity, sub-stepped, swept
// against dummy hit meshes with a raycast per step.
import * as THREE from "three";
import type { Dummy, HitReport, Zone } from "./dummy";
import type { Target } from "./targets";
import type { ResolvedWeapon } from "./weapons";
import { RANGE_SOLIDS } from "./range";

/**
 * Distance along a segment to the first solid box it enters, or Infinity.
 * Slab test on the collision boxes the player walks on, which are also the
 * walls. Before this, bullets went through walls: harmless on an open range,
 * but in the course it let you shoot the next room's dummies before you got
 * there.
 */
export function solidHit(p0: THREE.Vector3, dir: THREE.Vector3, len: number): number {
  let best = Infinity;
  for (const s of RANGE_SOLIDS) {
    let t0 = 0;
    let t1 = len;
    const axes: Array<[number, number, number, number]> = [
      [p0.x, dir.x, s.minX, s.maxX],
      [p0.y, dir.y, s.base, s.top],
      [p0.z, dir.z, s.minZ, s.maxZ],
    ];
    let miss = false;
    for (const [o, d, lo, hi] of axes) {
      if (Math.abs(d) < 1e-9) {
        if (o < lo || o > hi) {
          miss = true;
          break;
        }
        continue;
      }
      let a = (lo - o) / d;
      let b = (hi - o) / d;
      if (a > b) [a, b] = [b, a];
      t0 = Math.max(t0, a);
      t1 = Math.min(t1, b);
      if (t0 > t1) {
        miss = true;
        break;
      }
    }
    if (!miss && t0 < best) best = t0;
  }
  return best;
}

interface Bullet {
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  origin: THREE.Vector3;
  age: number;
  mesh: THREE.Mesh;
  weapon: ResolvedWeapon;
  /** the other player's shot in a 1v1: drawn, stopped by walls, hits nothing */
  visual: boolean;
  /** it has already cracked past the listener */
  whizzed: boolean;
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
}

const SUBSTEPS = 4;
const tracerGeo = new THREE.SphereGeometry(0.02, 6, 4);
const tracerMat = new THREE.MeshBasicMaterial({ color: 0xffd27a });
/** the other player's rounds, redder so you can tell whose is whose */
const remoteTracerMat = new THREE.MeshBasicMaterial({ color: 0xff6a4a });

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

  fire(origin: THREE.Vector3, dir: THREE.Vector3, w: ResolvedWeapon, visual = false): void {
    const mesh = new THREE.Mesh(tracerGeo, visual ? remoteTracerMat : tracerMat);
    mesh.position.copy(origin);
    this.scene.add(mesh);
    this.bullets.push({
      pos: origin.clone(),
      vel: dir.clone().normalize().multiplyScalar(w.projectile.speed),
      origin: origin.clone(),
      age: 0,
      mesh,
      weapon: w,
      visual,
      whizzed: false,
    });
  }

  /** where your ears are: someone else's round passing within 2.5 m cracks past you (onWhiz) */
  listener: THREE.Vector3 | null = null;
  onWhiz: ((at: THREE.Vector3) => void) | null = null;

  /** add something bullets can hit after construction (the 1v1 opponent) */
  addDummy(d: Dummy): void {
    if (!this.dummies.includes(d)) this.dummies.push(d);
  }
  removeDummy(d: Dummy): void {
    const i = this.dummies.indexOf(d);
    if (i >= 0) this.dummies.splice(i, 1);
  }

  /**
   * A melee strike: the first dummy, target or wall within `range` along
   * `dir`. Melee does the same damage wherever it lands, so no headshot
   * multiplier. Returns true if it hit something that takes damage.
   */
  melee(origin: THREE.Vector3, dir: THREE.Vector3, range: number, damage: number, now: number, onImpact: (e: ImpactEvent) => void): boolean {
    const { meshes, owner, tOwner } = this.gather(now);
    const unit = dir.clone().normalize();
    this.ray.set(origin, unit);
    this.ray.far = Math.min(range, solidHit(origin, unit, range));
    const hit = meshes.length ? this.ray.intersectObjects(meshes, false)[0] : undefined;
    if (!hit) return false;
    const d = owner.get(hit.object);
    const dist = hit.distance;
    if (d) {
      const zone = (hit.object.userData.zone as Zone) ?? "body";
      const report = d.hit(now, zone, damage, 1, 1, hit.point);
      onImpact({ dummy: d, report, target: null, targetHead: false, damage: report?.amount ?? 0, point: hit.point.clone(), distance: dist, weapon: "melee" });
      return true;
    }
    const t = tOwner.get(hit.object);
    if (!t) return false;
    t.hit(now, false, damage);
    onImpact({ dummy: null, report: null, target: t, targetHead: false, damage, point: hit.point.clone(), distance: dist, weapon: "melee" });
    return true;
  }

  /** every hit mesh in play, and who owns it */
  private gather(now: number): { meshes: THREE.Mesh[]; owner: Map<THREE.Object3D, Dummy>; tOwner: Map<THREE.Object3D, Target> } {
    const meshes: THREE.Mesh[] = [];
    const owner = new Map<THREE.Object3D, Dummy>();
    const tOwner = new Map<THREE.Object3D, Target>();
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
    return { meshes, owner, tOwner };
  }

  update(dt: number, now: number, onImpact: (e: ImpactEvent) => void): void {
    const h = dt / SUBSTEPS;
    const { meshes, owner, tOwner } = this.gather(now);
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
          if (wallAt < Infinity || b.pos.y <= this.floorY || b.age > b.weapon.projectile.lifetime) dead = true;
          continue;
        }
        if (len > 0 && meshes.length) {
          this.ray.set(prev, unit);
          this.ray.far = Math.min(len, wallAt);
          const hits = this.ray.intersectObjects(meshes, false);
          if (hits.length) {
            const hit = hits[0];
            const dist = hit.point.distanceTo(b.origin);
            const dmg = falloff(b.weapon, dist);
            const zone = (hit.object.userData.zone as Zone) ?? "body";
            const headshotScale = dist <= b.weapon.damage.headshotMaxDist ? b.weapon.damage.headshot : 1;
            const d = owner.get(hit.object);
            if (d) {
              const report = d.hit(now, zone, dmg, headshotScale, b.weapon.damage.leg, hit.point);
              onImpact({
                dummy: d, report, target: null, targetHead: false,
                damage: report?.amount ?? 0, point: hit.point.clone(), distance: dist, weapon: b.weapon.id,
              });
            } else {
              const t = tOwner.get(hit.object)!;
              // a head hit past headshot range is body damage and no headshot
              const head = zone === "head" && headshotScale > 1;
              const amount = Math.floor(dmg * (head ? headshotScale : 1) + 1e-6);
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
          onImpact({ dummy: null, report: null, target: null, targetHead: false, damage: 0, point: at, distance: at.distanceTo(b.origin), weapon: b.weapon.id });
          dead = true;
          break;
        }
        if (b.pos.y <= this.floorY) {
          onImpact({
            dummy: null, report: null, target: null, targetHead: false, damage: 0,
            point: b.pos.clone(), distance: b.pos.distanceTo(b.origin), weapon: b.weapon.id,
          });
          dead = true;
        } else if (b.age > b.weapon.projectile.lifetime) dead = true;
      }
      if (dead) {
        this.scene.remove(b.mesh);
        this.bullets.splice(bi, 1);
      } else b.mesh.position.copy(b.pos);
    }
  }
}

function falloff(w: ResolvedWeapon, dist: number): number {
  const d = w.damage;
  if (dist <= d.nearDist) return d.near;
  if (dist <= d.farDist) return lerp(d.near, d.far, (dist - d.nearDist) / (d.farDist - d.nearDist));
  if (dist <= d.veryFarDist) return lerp(d.far, d.veryFar, (dist - d.farDist) / (d.veryFarDist - d.farDist));
  return d.veryFar;
}
const lerp = (a: number, b: number, t: number) => a + (b - a) * Math.max(0, Math.min(1, t));
