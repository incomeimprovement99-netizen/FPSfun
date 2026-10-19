// Short-lived world effects: the streak a JOLT leaves, and (later) the rest of
// what the others should see that is not a shot. Each effect is a mesh with a
// life; the layer fades and removes them. All drawn in code, additive, no
// textures.
import * as THREE from "three";
import hudCfg from "../config/hud.json";

const SHIELD_BREAK = hudCfg.shieldFx.break as unknown as { shards: number; seconds: number; speed: [number, number]; up: number; size: [number, number] };

interface Effect {
  obj: THREE.Object3D;
  born: number;
  life: number;
  /** 0..1 through its life: set its look */
  tick: (t: number) => void;
  dispose: () => void;
}

const streakGeo = new THREE.BoxGeometry(1, 1, 1);

export class FxLayer {
  private live: Effect[] = [];
  /** a shield breaking (Milestone 694) */
  readonly shards: ShardBurst;
  private last = 0;
  constructor(private scene: THREE.Scene) {
    this.shards = new ShardBurst(scene);
  }

  /** someone's shield broken by your round: its shards burst off `at`, their chest, in its `color` (hud.json shieldFx.break) */
  shieldBreak(at: THREE.Vector3, color: number, now: number): void {
    this.shards.burst(at, color, now, SHIELD_BREAK);
  }

  /**
   * A JOLT from `a` to `b` (feet positions): a pale blue streak at chest
   * height that thins and fades over 0.35 s, and a ring where it started.
   */
  jolt(a: THREE.Vector3, b: THREE.Vector3, now: number): void {
    const d = b.clone().sub(a);
    d.y = 0;
    const len = d.length();
    if (len < 0.2) return;
    const mat = new THREE.MeshBasicMaterial({ color: 0x8fd8ff, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false });
    const m = new THREE.Mesh(streakGeo, mat);
    m.position.set((a.x + b.x) / 2, (a.y + b.y) / 2 + 1.1, (a.z + b.z) / 2);
    m.rotation.y = Math.atan2(d.x, d.z);
    m.scale.set(0.5, 1.4, len);
    this.scene.add(m);
    this.live.push({
      obj: m,
      born: now,
      life: 0.35,
      tick: (t) => {
        mat.opacity = 0.55 * (1 - t);
        m.scale.x = 0.5 * (1 - t * 0.8);
        m.scale.y = 1.4 * (1 - t * 0.5);
      },
      dispose: () => mat.dispose(),
    });
    const ringMat = new THREE.MeshBasicMaterial({ color: 0xbfe8ff, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, forceSinglePass: true });
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.3, 0.45, 24), ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(a.x, a.y + 0.05, a.z);
    this.scene.add(ring);
    this.live.push({
      obj: ring,
      born: now,
      life: 0.45,
      tick: (t) => {
        ringMat.opacity = 0.7 * (1 - t);
        ring.scale.setScalar(1 + t * 3);
      },
      dispose: () => {
        ringMat.dispose();
        ring.geometry.dispose();
      },
    });
  }

  update(now: number): void {
    // (a frame's time for the shards' fall: its own clock, as the layer is handed only the time)
    this.shards.update(Math.min(0.1, Math.max(0, now - this.last)), now);
    this.last = now;
    for (let i = this.live.length - 1; i >= 0; i--) {
      const e = this.live[i];
      const t = (now - e.born) / e.life;
      if (t >= 1 || t < 0) {
        e.obj.removeFromParent();
        e.dispose();
        this.live.splice(i, 1);
        continue;
      }
      e.tick(t);
    }
  }

  /** everything on screen now, for the tests */
  get count(): number {
    return this.live.length;
  }

  clear(): void {
    this.shards.clear();
    for (const e of this.live) {
      e.obj.removeFromParent();
      e.dispose();
    }
    this.live = [];
  }
}

/** the shield break's shards (hud.json shieldFx.break): one drawing for every burst, so a break costs no new draw call */
interface Shard {
  p: THREE.Vector3;
  v: THREE.Vector3;
  axis: THREE.Vector3;
  spin: number;
  born: number;
  life: number;
  size: number;
  color: THREE.Color;
}
const SHARD_MAX = 128;

/**
 * A shield breaking, as the shooter sees it (Milestone 694): shards of it in its colour burst off the figure's chest
 * and fall, Apex's break. Additive, drawn as one instanced mesh that is always in the scene (no shards, nothing drawn),
 * so its shader is built with the rest before the first break rather than on it.
 */
export class ShardBurst {
  readonly mesh: THREE.InstancedMesh;
  private readonly live: Shard[] = [];
  private readonly m = new THREE.Matrix4();
  private readonly q = new THREE.Quaternion();
  private readonly s = new THREE.Vector3();
  private readonly c = new THREE.Color();

  constructor(scene: THREE.Scene) {
    const geo = new THREE.TetrahedronGeometry(1);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
    this.mesh = new THREE.InstancedMesh(geo, mat, SHARD_MAX);
    this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(SHARD_MAX * 3), 3);
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    this.mesh.name = "fx:shards";
    scene.add(this.mesh);
  }

  /** a break at `at` (the chest), in `color`, as hud.json shieldFx.break says */
  burst(at: THREE.Vector3, color: number, now: number, look: { shards: number; seconds: number; speed: [number, number]; up: number; size: [number, number] }): void {
    for (let i = 0; i < look.shards; i++) {
      if (this.live.length >= SHARD_MAX) this.live.shift();
      // outward all round, a little up: a shell coming off a body
      const a = Math.random() * Math.PI * 2;
      const y = Math.random() * 1.4 - 0.4;
      const dir = new THREE.Vector3(Math.cos(a), y, Math.sin(a)).normalize();
      const speed = look.speed[0] + Math.random() * (look.speed[1] - look.speed[0]);
      this.live.push({
        p: at.clone().addScaledVector(dir, 0.25),
        v: dir.multiplyScalar(speed).add(new THREE.Vector3(0, look.up, 0)),
        axis: new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize(),
        spin: 8 + Math.random() * 14,
        born: now,
        life: look.seconds * (0.7 + Math.random() * 0.3),
        size: look.size[0] + Math.random() * (look.size[1] - look.size[0]),
        color: new THREE.Color(color),
      });
    }
  }

  update(dt: number, now: number): void {
    let n = 0;
    for (let i = this.live.length - 1; i >= 0; i--) {
      const s = this.live[i];
      const t = (now - s.born) / s.life;
      if (t >= 1 || t < 0) {
        this.live.splice(i, 1);
        continue;
      }
      s.v.y -= 9.8 * dt;
      s.p.addScaledVector(s.v, dt);
      this.q.setFromAxisAngle(s.axis, s.spin * (now - s.born));
      // smaller and dimmer to nothing (additive: a darker colour is a fainter shard)
      this.s.setScalar(s.size * (1 - t * 0.6));
      this.m.compose(s.p, this.q, this.s);
      this.mesh.setMatrixAt(n, this.m);
      this.mesh.setColorAt(n, this.c.copy(s.color).multiplyScalar(1.6 * (1 - t)));
      n++;
    }
    this.mesh.count = n;
    if (n) {
      this.mesh.instanceMatrix.needsUpdate = true;
      if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
    }
  }

  /** shards in the air now (tools/e2e.ts) */
  get count(): number {
    return this.live.length;
  }

  clear(): void {
    this.live.length = 0;
    this.mesh.count = 0;
  }
}
