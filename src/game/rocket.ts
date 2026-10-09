// HAEFY's rocket (docs/PLAN_THE_EIGHT_GUNS.md 5.7; the owner, 2026-10-06: "it shouldn't hurt the shooter, but it should
// do more damage the further it travels, so a point blank or very close does like 10 damage and then it scales like
// that, the skybreaker is the reference for hyperscape"). The round itself flies as every gun's does (projectile.ts,
// the launcher's speed and no drop); where it stops it bursts, and the burst is what does the damage: rocketDamage(the
// distance it flew) at the burst's middle, less with distance from it out to its reach, which grows with the flight too
// (the Skybreaker's "Min Range for Full Damage & Full Explosion AoE: 20m"). Who decides the damage is the shooter, as a
// bullet's: their page finds who is in reach and in sight and claims each hit (main.ts). Never the shooter, never a
// teammate. Others see the rocket fly (the shot message redraws it, projectile.ts) and its burst where it stops. A bot's
// rocket is the same: drawn, it bursts where it stops, and the bot's match settles the burst (bots.ts onRocket).
//
// The damage at the middle is the gun's own for the distance flown (projectile.ts falloff on the launcher, which
// weapons.ts builds from rocket.json's ramp), so whatever changes a gun's damage changes the rocket's; rocketDamage is the
// ramp as rocket.json gives it, for the checks.
//
// The rocket model is one model: the shot in flight, the soldier's reload and the first person's reload all draw it.
import * as THREE from "three";
import cfg from "../config/rocket.json";

export const ROCKET = cfg as {
  speed: number;
  lifetime: number;
  magazine: number;
  fireRate: number;
  reload: number;
  damage: { pointBlank: number; from: number; full: number; fullFrom: number };
  blast: { inner: number; reachPointBlank: number; reach: number };
  body: { radius: number; top: number; crouch: number; sight: number };
  model: { length: number; radius: number; nose: number; fin: number };
};

const clamp01 = (t: number) => Math.max(0, Math.min(1, t));
const ramp = (travelled: number) => clamp01((travelled - ROCKET.damage.from) / (ROCKET.damage.fullFrom - ROCKET.damage.from));

/** the damage at a burst's middle for a rocket that flew `travelled` metres: little point blank, full from fullFrom */
export function rocketDamage(travelled: number): number {
  return ROCKET.damage.pointBlank + (ROCKET.damage.full - ROCKET.damage.pointBlank) * ramp(travelled);
}

/** how far the burst reaches, metres: it grows with the flight as the damage does */
export function blastReach(travelled: number): number {
  return ROCKET.blast.reachPointBlank + (ROCKET.blast.reach - ROCKET.blast.reachPointBlank) * ramp(travelled);
}

/** the share of the middle's damage a body takes `gap` metres from the burst (from its skin): all within the inner reach, none at its edge */
export function blastShare(travelled: number, gap: number): number {
  const reach = blastReach(travelled);
  if (gap >= reach) return 0;
  return gap <= ROCKET.blast.inner ? 1 : 1 - (gap - ROCKET.blast.inner) / Math.max(1e-6, reach - ROCKET.blast.inner);
}

/** the damage `gap` metres from the burst, on rocket.json's ramp */
export function blastAt(travelled: number, gap: number): number {
  return rocketDamage(travelled) * blastShare(travelled, gap);
}

/** the burst can reach a chest only through open air: a wall between them takes it (`solid`: projectile.ts solidHit) */
export function blastSees(at: THREE.Vector3, chest: THREE.Vector3, solidHit: (from: THREE.Vector3, dir: THREE.Vector3, len: number) => number): boolean {
  const d = chest.clone().sub(at);
  const len = d.length();
  if (len < 1e-3) return true;
  // (from a hair off the face it burst on, or the face itself would block)
  const from = at.clone().addScaledVector(d, 0.05 / len);
  return solidHit(from, d.divideScalar(len), Math.max(0, len - 0.05)) === Infinity;
}

/** how tall a body stands, metres, crouched or not (rocket.json body: the hit volumes' own) */
export function bodyTop(low: boolean): number {
  return ROCKET.body.top * (low ? ROCKET.body.crouch : 1);
}

/** the point of a body standing at `feet` that a burst must see (its chest) */
export function bodySight(feet: THREE.Vector3, low: boolean): THREE.Vector3 {
  return feet.clone().setY(feet.y + bodyTop(low) * ROCKET.body.sight);
}

/**
 * How far a burst at `at` is from the skin of a body standing at `feet`, 0 inside it: a body with no figure to measure,
 * known by its feet alone (you on your own page, a bot's rocket's victims on the host's). Measured to the skin, not to a
 * chest point: a rocket at someone's feet is a rocket on them, and to a chest 1.1 m up it had been at the inner reach's
 * edge.
 */
export function bodyGap(at: THREE.Vector3, feet: THREE.Vector3, low = false): number {
  const r = ROCKET.body.radius;
  const y = Math.max(feet.y + r, Math.min(feet.y + bodyTop(low) - r, at.y));
  return Math.max(0, Math.hypot(at.x - feet.x, at.y - y, at.z - feet.z) - r);
}

const along = new THREE.Vector3();
/** where along a rocket's step (from `p0` along `unit`, `len` metres) it first touches a body at `feet`, or Infinity */
export function bodyAlong(p0: THREE.Vector3, unit: THREE.Vector3, len: number, feet: THREE.Vector3, low = false): number {
  if (Math.hypot(p0.x - feet.x, p0.z - feet.z) > len + ROCKET.body.radius) return Infinity;
  // in steps finer than the body is wide, so none passes through it
  const n = Math.max(1, Math.ceil(len / (ROCKET.body.radius / 4)));
  for (let i = 0; i <= n; i++) {
    const k = (len * i) / n;
    if (bodyGap(along.copy(p0).addScaledVector(unit, k), feet, low) <= 0) return k;
  }
  return Infinity;
}

const local = new THREE.Vector3();
const near = new THREE.Vector3();
/**
 * How far a burst at `at` is from a figure's skin as its hit volumes give it, as posed this frame: each volume's own box
 * (a box's exactly, the head's and neck's round ones by the box round them), 0 inside one. The volumes are what a round
 * hits, so a rocket's burst measures to the body a round would have found.
 */
export function meshGap(at: THREE.Vector3, meshes: readonly THREE.Mesh[]): number {
  let best = Infinity;
  for (const m of meshes) {
    if (!m.visible) continue;
    const g = m.geometry;
    if (!g.boundingBox) g.computeBoundingBox();
    m.updateWorldMatrix(true, false);
    m.worldToLocal(local.copy(at));
    g.boundingBox!.clampPoint(local, local);
    best = Math.min(best, m.localToWorld(near.copy(local)).distanceTo(at));
  }
  return best;
}

/**
 * A burst's damage to a body known by its feet alone (bodyGap): `full` at the middle (the gun's damage for the distance
 * flown), its share for the gap to the skin, none through a wall.
 */
export function rocketHurts(full: number, at: THREE.Vector3, travelled: number, feet: THREE.Vector3, low: boolean, solidHit: (from: THREE.Vector3, dir: THREE.Vector3, len: number) => number): number {
  const k = blastShare(travelled, bodyGap(at, feet, low));
  return k > 0 && blastSees(at, bodySight(feet, low), solidHit) ? full * k : 0;
}

const BODY = new THREE.MeshStandardMaterial({ color: 0xc9ccd1, roughness: 0.45, metalness: 0.6 });
const BAND = new THREE.MeshStandardMaterial({ color: 0xd8582a, roughness: 0.5, metalness: 0.3, emissive: 0x6a1c06, emissiveIntensity: 0.6 });
const GLOW = new THREE.MeshBasicMaterial({ color: 0xffb35a, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false });

/**
 * The rocket, its nose along +z: a body, a nose cone, four fins and its motor's glow at the tail. `lit` false leaves the
 * glow off (a rocket being loaded, not flying). Built once and cloned: its geometry and materials are shared.
 */
let template: THREE.Group | null = null;
export function buildRocket(lit = true): THREE.Group {
  if (!template) {
    const M = ROCKET.model;
    const g = new THREE.Group();
    g.name = "rocket";
    const body = new THREE.Mesh(new THREE.CylinderGeometry(M.radius, M.radius, M.length, 12), BODY);
    body.rotation.x = Math.PI / 2;
    g.add(body);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(M.radius * 1.04, M.radius * 1.04, M.length * 0.12, 12), BAND);
    band.rotation.x = Math.PI / 2;
    band.position.z = M.length * 0.2;
    g.add(band);
    const nose = new THREE.Mesh(new THREE.ConeGeometry(M.radius, M.nose, 12), BODY);
    nose.rotation.x = Math.PI / 2;
    nose.position.z = M.length / 2 + M.nose / 2;
    g.add(nose);
    for (let i = 0; i < 4; i++) {
      const fin = new THREE.Mesh(new THREE.BoxGeometry(0.004, M.fin, M.fin * 1.3), BAND);
      const a = (i * Math.PI) / 2;
      fin.position.set(Math.cos(a) * (M.radius + M.fin / 2), Math.sin(a) * (M.radius + M.fin / 2), -M.length / 2 + M.fin * 0.65);
      fin.rotation.z = a;
      g.add(fin);
    }
    const glow = new THREE.Mesh(new THREE.SphereGeometry(M.radius * 1.3, 10, 8), GLOW);
    glow.name = "glow";
    glow.scale.set(1, 1, 2.2);
    glow.position.z = -M.length / 2 - M.radius * 1.6;
    g.add(glow);
    template = g;
  }
  const r = template.clone();
  const glow = r.getObjectByName("glow");
  if (glow) glow.visible = lit;
  return r;
}

/**
 * A burst's look: a fireball that swells and fades. No light: a light put in the scene for a moment rebuilt the shader of
 * every lit material in view (a shader is built for the lights it is lit by), a hitch on every burst, and one kept in it
 * for good would cost every lit pixel of every frame for a sight seen now and then. The frags' flashes are meshes too.
 */
interface Burst {
  ball: THREE.Mesh;
  age: number;
  reach: number;
}
const BALL = new THREE.MeshBasicMaterial({ color: 0xffa040, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false });
const ballGeo = new THREE.SphereGeometry(1, 16, 12);
const BURST_FOR = 0.55;

export class RocketBursts {
  private live: Burst[] = [];
  constructor(private scene: THREE.Scene) {}

  /** the last burst: where, and how far its rocket flew (tools/e2e.ts) */
  last: { at: [number, number, number]; travelled: number } | null = null;

  /** a rocket's burst at `at`, as big as its reach for a rocket that flew `travelled` metres */
  add(at: THREE.Vector3, travelled: number): void {
    this.last = { at: [at.x, at.y, at.z], travelled };
    const ball = new THREE.Mesh(ballGeo, BALL.clone());
    ball.position.copy(at);
    ball.scale.setScalar(0.01);
    this.scene.add(ball);
    this.live.push({ ball, age: 0, reach: blastReach(travelled) });
  }

  update(dt: number): void {
    for (let i = this.live.length - 1; i >= 0; i--) {
      const b = this.live[i];
      b.age += dt;
      const t = b.age / BURST_FOR;
      if (t >= 1) {
        this.scene.remove(b.ball);
        (b.ball.material as THREE.Material).dispose();
        this.live.splice(i, 1);
        continue;
      }
      // swells fast to the reach, then fades
      b.ball.scale.setScalar(Math.max(0.01, b.reach * Math.min(1, t * 4)));
      (b.ball.material as THREE.MeshBasicMaterial).opacity = 0.85 * (1 - t);
    }
  }

  /** how many are showing (tools/e2e.ts) */
  get count(): number {
    return this.live.length;
  }
}
