// Short-lived world effects: the streak a JOLT leaves, and (later) the rest of
// what the others should see that is not a shot. Each effect is a mesh with a
// life; the layer fades and removes them. All drawn in code, additive, no
// textures.
import * as THREE from "three";

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
  constructor(private scene: THREE.Scene) {}

  /**
   * SpeedKills' edge (Phase 20 A4): a red laser slamming down on `at` from
   * the sky, a core and a wider glow, and a scorch spreading on the ground.
   * Seen from inside it (the one it hit) its column fills the view. Drawn
   * without fog so the whole city sees it, and without a light, which would
   * recompile every material mid-match.
   */
  laser(at: THREE.Vector3, now: number, o: { laserSeconds: number; laserRadius: number; laserHeight: number; laserColor: string }): void {
    const h = o.laserHeight;
    const color = new THREE.Color(o.laserColor);
    const column = (r: number, peak: number): void => {
      // hung from its top, so growing its height brings it down from the sky
      const geo = new THREE.CylinderGeometry(r, r, h, 20, 1, true).translate(0, -h / 2, 0);
      const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: peak, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false, toneMapped: false, forceSinglePass: true });
      const m = new THREE.Mesh(geo, mat);
      m.position.set(at.x, at.y + h, at.z);
      m.frustumCulled = false;
      this.scene.add(m);
      this.live.push({
        obj: m,
        born: now,
        life: o.laserSeconds,
        tick: (t) => {
          m.scale.y = Math.min(1, t / 0.08);
          const shimmer = 1 + 0.08 * Math.sin(t * 90);
          m.scale.x = m.scale.z = shimmer;
          mat.opacity = peak * (t > 0.8 ? (1 - t) / 0.2 : 1);
        },
        dispose: () => {
          geo.dispose();
          mat.dispose();
        },
      });
    };
    column(o.laserRadius, 0.95);
    column(o.laserRadius * 2.4, 0.35);
    const scorchMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, forceSinglePass: true });
    const scorch = new THREE.Mesh(new THREE.RingGeometry(0.4, o.laserRadius * 2, 32), scorchMat);
    scorch.rotation.x = -Math.PI / 2;
    scorch.position.set(at.x, at.y + 0.05, at.z);
    this.scene.add(scorch);
    this.live.push({
      obj: scorch,
      born: now,
      life: o.laserSeconds,
      tick: (t) => {
        scorch.scale.setScalar(1 + t * 4);
        scorchMat.opacity = 0.8 * (1 - t);
      },
      dispose: () => {
        scorch.geometry.dispose();
        scorchMat.dispose();
      },
    });
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
    for (const e of this.live) {
      e.obj.removeFromParent();
      e.dispose();
    }
    this.live = [];
  }
}
