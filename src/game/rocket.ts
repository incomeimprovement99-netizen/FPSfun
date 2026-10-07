// HAEFY's rocket (docs/PLAN_THE_EIGHT_GUNS.md 5.7; the owner, 2026-10-06: "it shouldn't hurt the shooter, but it should
// do more damage the further it travels, so a point blank or very close does like 10 damage and then it scales like
// that, the skybreaker is the reference for hyperscape"). The round itself flies as every gun's does (projectile.ts,
// the launcher's speed and no drop); where it stops it bursts, and the burst is what does the damage: rocketDamage(the
// distance it flew) at the burst's middle, less with distance from it out to its reach, which grows with the flight too
// (the Skybreaker's "Min Range for Full Damage & Full Explosion AoE: 20m"). Who decides the damage is the shooter, as a
// bullet's: their page finds who is in reach and in sight and claims each hit (main.ts). Never the shooter, never a
// teammate. Others see the rocket fly (the shot message redraws it, projectile.ts) and its burst where it stops.
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

/** the damage `dist` metres from the burst's middle: full within the inner reach, none at its edge */
export function blastAt(travelled: number, dist: number): number {
  const reach = blastReach(travelled);
  if (dist >= reach) return 0;
  const k = dist <= ROCKET.blast.inner ? 1 : 1 - (dist - ROCKET.blast.inner) / Math.max(1e-6, reach - ROCKET.blast.inner);
  return rocketDamage(travelled) * k;
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

/** a burst's look: a flash, a fireball that swells and fades, and a light for a moment */
interface Burst {
  group: THREE.Group;
  ball: THREE.Mesh;
  flash: THREE.PointLight;
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
    const group = new THREE.Group();
    group.position.copy(at);
    const ball = new THREE.Mesh(ballGeo, BALL.clone());
    ball.scale.setScalar(0.01);
    group.add(ball);
    const flash = new THREE.PointLight(0xffa050, 6, blastReach(travelled) * 4, 2);
    group.add(flash);
    this.scene.add(group);
    this.live.push({ group, ball, flash, age: 0, reach: blastReach(travelled) });
  }

  update(dt: number): void {
    for (let i = this.live.length - 1; i >= 0; i--) {
      const b = this.live[i];
      b.age += dt;
      const t = b.age / BURST_FOR;
      if (t >= 1) {
        this.scene.remove(b.group);
        (b.ball.material as THREE.Material).dispose();
        this.live.splice(i, 1);
        continue;
      }
      // swells fast to the reach, then fades
      b.ball.scale.setScalar(Math.max(0.01, b.reach * Math.min(1, t * 4)));
      (b.ball.material as THREE.MeshBasicMaterial).opacity = 0.85 * (1 - t);
      b.flash.intensity = 6 * Math.max(0, 1 - t * 2.5);
    }
  }

  /** how many are showing (tools/e2e.ts) */
  get count(): number {
    return this.live.length;
  }
}
