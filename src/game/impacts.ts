// Bullet impacts on the level: a hole, a puff, and (in main.ts) a sound.
//
// A round into a wall in a match showed and sounded like nothing: the only
// thing that drew a miss was the range's spray wall. Every shooter marks it,
// and it is half of how you read a fight you are not in (where the shots are
// landing, whether someone is shooting at you from behind that wall).
//
// Cheap on purpose, because a spray is dozens a second: the holes are one
// InstancedMesh, a ring of IMPACTS.holes that the oldest falls out of, each
// gone after IMPACTS.holeLife seconds; the puffs are a small pool of sprites,
// each with its own material so it can fade on its own. Nothing is made per
// shot.
import * as THREE from "three";
import cfg from "../config/hud.json";

export const IMPACTS = cfg.impacts;

const up = new THREE.Vector3(0, 0, 1);
const m4 = new THREE.Matrix4();
const q = new THREE.Quaternion();
const sc = new THREE.Vector3();
const zero = new THREE.Matrix4().makeScale(0, 0, 0);

interface Puff {
  s: THREE.Sprite;
  mat: THREE.SpriteMaterial;
  born: number;
  vel: THREE.Vector3;
}

export class ImpactLayer {
  private holes: THREE.InstancedMesh;
  private holeBorn: Float64Array;
  private next = 0;
  private puffs: Puff[] = [];
  private nextPuff = 0;
  /** impacts marked since the page opened (tools/e2e.ts) */
  count = 0;

  constructor(scene: THREE.Scene) {
    const geo = new THREE.CircleGeometry(IMPACTS.holeSize / 2, 8);
    const mat = new THREE.MeshBasicMaterial({ color: 0x1a1612, transparent: true, opacity: 0.85, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    this.holes = new THREE.InstancedMesh(geo, mat, IMPACTS.holes);
    this.holes.frustumCulled = false;
    this.holes.userData.dynamic = true;
    for (let i = 0; i < IMPACTS.holes; i++) this.holes.setMatrixAt(i, zero);
    this.holeBorn = new Float64Array(IMPACTS.holes).fill(-Infinity);
    scene.add(this.holes);
    for (let i = 0; i < IMPACTS.puffs; i++) {
      const pm = new THREE.SpriteMaterial({ color: 0xcfc3ad, transparent: true, opacity: 0, depthWrite: false });
      const s = new THREE.Sprite(pm);
      s.visible = false;
      s.userData.dynamic = true;
      scene.add(s);
      this.puffs.push({ s, mat: pm, born: -Infinity, vel: new THREE.Vector3() });
    }
  }

  /** a round into the level at `at`, on the face `normal`: a hole flat on it, and a puff off it (sparks off metal) */
  add(at: THREE.Vector3, normal: THREE.Vector3, now: number, metal = false): void {
    this.count++;
    const i = this.next;
    this.next = (this.next + 1) % IMPACTS.holes;
    q.setFromUnitVectors(up, normal);
    const p = at.clone().addScaledVector(normal, 0.012);
    const k = 0.7 + Math.random() * 0.6;
    sc.set(k, k, 1);
    m4.compose(p, q, sc);
    this.holes.setMatrixAt(i, m4);
    this.holes.instanceMatrix.needsUpdate = true;
    this.holeBorn[i] = now;
    // the puff: a few sprites thrown off the face, fading as they spread
    for (let n = 0; n < IMPACTS.puffPer; n++) {
      const pf = this.puffs[this.nextPuff];
      this.nextPuff = (this.nextPuff + 1) % this.puffs.length;
      pf.born = now;
      pf.s.position.copy(at).addScaledVector(normal, 0.05);
      pf.vel.copy(normal).multiplyScalar(0.6 + Math.random() * 0.8).add(new THREE.Vector3((Math.random() - 0.5) * 0.8, Math.random() * 0.6, (Math.random() - 0.5) * 0.8));
      pf.mat.color.setHex(metal ? 0xffc46b : 0xcfc3ad);
      pf.mat.blending = metal ? THREE.AdditiveBlending : THREE.NormalBlending;
      pf.s.visible = true;
    }
  }

  update(now: number, dt: number): void {
    // holes past their life shrink away
    let dirty = false;
    for (let i = 0; i < this.holeBorn.length; i++) {
      if (this.holeBorn[i] > -Infinity && now - this.holeBorn[i] > IMPACTS.holeLife) {
        this.holes.setMatrixAt(i, zero);
        this.holeBorn[i] = -Infinity;
        dirty = true;
      }
    }
    if (dirty) this.holes.instanceMatrix.needsUpdate = true;
    for (const pf of this.puffs) {
      if (!pf.s.visible) continue;
      const t = (now - pf.born) / IMPACTS.puffLife;
      if (t >= 1 || t < 0) {
        pf.s.visible = false;
        continue;
      }
      pf.s.position.addScaledVector(pf.vel, dt);
      pf.mat.opacity = 0.7 * (1 - t);
      pf.s.scale.setScalar(0.06 + 0.22 * t);
    }
  }

  clear(): void {
    for (let i = 0; i < this.holeBorn.length; i++) {
      this.holes.setMatrixAt(i, zero);
      this.holeBorn[i] = -Infinity;
    }
    this.holes.instanceMatrix.needsUpdate = true;
    for (const pf of this.puffs) pf.s.visible = false;
  }
}
