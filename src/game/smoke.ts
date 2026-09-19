// Smoke clouds (SMOKE's kit, src/config/kits.json).
//
// A canister flies to where it was aimed, lands, and blooms into a ball of
// puffs that stands for its seconds. What it does to the game is block sight:
// a bot cannot see through one (bots.ts asks smokeBlocks), and a player cannot
// see through it because it is opaque. Bullets go through it, as they do in
// the game this follows: smoke hides, it does not stop.
//
// The clouds are a list here rather than part of throwables.ts, because they
// are not a carried grenade: they are a kit's, thrown by it, and every page
// blooms its own from the two points the effect carries, so they stand in the
// same places on every screen without anything more on the wire.
import * as THREE from "three";
import kits from "../config/kits.json";

const CFG = kits.smoke;

export interface SmokeCloud {
  at: THREE.Vector3;
  r: number;
  until: number;
  /** the puffs, and the canister while it still flies */
  group: THREE.Group;
  bloomAt: number;
}

/** every cloud standing now: bots.ts reads it through smokeBlocks */
export const SMOKES: SmokeCloud[] = [];

/** the puffs of one cloud, made once and shared */
let puffGeo: THREE.SphereGeometry | null = null;

/**
 * A canister thrown from `from` to `to`: it flies there in `fly` seconds and
 * blooms into a cloud for `seconds`. Returns the cloud.
 */
export function throwSmoke(parent: THREE.Object3D, from: THREE.Vector3, to: THREE.Vector3, now: number): SmokeCloud {
  puffGeo ??= new THREE.SphereGeometry(1, 10, 8);
  const group = new THREE.Group();
  const can = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.26, 8), new THREE.MeshStandardMaterial({ color: 0x4a5058, roughness: 0.6, metalness: 0.4 }));
  can.name = "can";
  can.position.copy(from);
  group.add(can);
  parent.add(group);
  const cloud: SmokeCloud = { at: to.clone(), r: CFG.radius, until: now + CFG.fly + CFG.seconds, group, bloomAt: now + CFG.fly };
  SMOKES.push(cloud);
  return cloud;
}

/** the puffs of a cloud that has just landed: a ball of them round its middle */
function bloom(cloud: SmokeCloud): void {
  const mat = new THREE.MeshBasicMaterial({ color: 0xbfc4c9, transparent: true, opacity: CFG.opacity, depthWrite: false });
  cloud.group.userData.mat = mat;
  const can = cloud.group.getObjectByName("can");
  if (can) can.visible = false;
  // a puff at the middle and a ring of them round it, so the ball has no seams
  const spots: Array<[number, number, number, number]> = [[0, 0.9, 0, cloud.r * 0.75]];
  for (let i = 0; i < CFG.puffs; i++) {
    const a = (i / CFG.puffs) * Math.PI * 2;
    const rr = cloud.r * (i % 2 === 0 ? 0.62 : 0.5);
    spots.push([Math.cos(a) * rr, 0.5 + (i % 3) * 0.7, Math.sin(a) * rr, cloud.r * 0.55]);
  }
  for (const [dx, dy, dz, s] of spots) {
    const puff = new THREE.Mesh(puffGeo as THREE.SphereGeometry, mat);
    puff.position.set(cloud.at.x + dx, cloud.at.y + dy, cloud.at.z + dz);
    puff.scale.setScalar(0.2);
    puff.userData.full = s;
    cloud.group.add(puff);
  }
}

/**
 * Every cloud a step on: a canister still flying moves along its line, one
 * that has landed blooms, a full one drifts a little, and one whose time is up
 * fades and goes.
 */
export function stepSmoke(now: number, dt: number): void {
  for (let i = SMOKES.length - 1; i >= 0; i--) {
    const c = SMOKES[i];
    const can = c.group.getObjectByName("can");
    if (now < c.bloomAt) {
      // the throw: along the line, with a little arc over it
      const k = 1 - (c.bloomAt - now) / CFG.fly;
      if (can) {
        const start = can.userData.from as THREE.Vector3 | undefined;
        const a = start ?? (can.userData.from = can.position.clone());
        can.position.lerpVectors(a, c.at, k);
        can.position.y += Math.sin(k * Math.PI) * 1.6;
        can.rotation.x += dt * 12;
      }
      continue;
    }
    if (c.group.children.length <= 1) bloom(c);
    const mat = c.group.userData.mat as THREE.MeshBasicMaterial | undefined;
    const left = c.until - now;
    for (const puff of c.group.children) {
      if (puff.name === "can") continue;
      const full = (puff.userData.full as number) ?? 1;
      // it swells into place over grow seconds, then hangs
      puff.scale.setScalar(Math.min(full, puff.scale.x + (full / CFG.grow) * dt));
      puff.position.y += dt * 0.05;
    }
    if (mat) mat.opacity = CFG.opacity * Math.max(0, Math.min(1, left / CFG.fade));
    if (left <= 0) {
      dropSmoke(c);
      SMOKES.splice(i, 1);
    }
  }
}

/** one cloud out of the world (its shared puff geometry stays) */
function dropSmoke(c: SmokeCloud): void {
  c.group.removeFromParent();
  const mat = c.group.userData.mat as THREE.Material | undefined;
  mat?.dispose();
  const can = c.group.getObjectByName("can") as THREE.Mesh | undefined;
  if (can) {
    can.geometry.dispose();
    (can.material as THREE.Material).dispose();
  }
}

/** every cloud gone (a match ending) */
export function clearSmoke(): void {
  for (const c of SMOKES) dropSmoke(c);
  SMOKES.length = 0;
}

/**
 * Is the line from `from` to `to` inside any standing cloud: the segment
 * against each cloud's ball. A cloud still flying blocks nothing.
 */
export function smokeBlocks(from: THREE.Vector3, to: THREE.Vector3, now: number): boolean {
  if (!SMOKES.length) return false;
  const d = to.clone().sub(from);
  const len = d.length();
  if (len < 1e-3) return false;
  d.divideScalar(len);
  for (const c of SMOKES) {
    if (now < c.bloomAt) continue;
    const m = c.at.clone().setY(c.at.y + 1.2).sub(from);
    const t = Math.max(0, Math.min(len, m.dot(d)));
    const closest = from.clone().addScaledVector(d, t);
    if (closest.distanceTo(c.at.clone().setY(c.at.y + 1.2)) <= c.r) return true;
  }
  return false;
}

/** the cloud a point stands in, or null (SMOKE's passive looks for enemies in one) */
export function smokeAt(p: THREE.Vector3, now: number): SmokeCloud | null {
  for (const c of SMOKES) {
    if (now < c.bloomAt) continue;
    if (p.distanceTo(c.at.clone().setY(c.at.y + 1.2)) <= c.r) return c;
  }
  return null;
}
