/**
 * Movement trails (Hyper Scape's: "the red trail of the enemies and the blue trail of your teammates ... something that
 * every player has", the crown's carrier's in gold; docs/HYPERSCAPE_GAP_ANALYSIS.md). Behind every other player a
 * ribbon of light along the way their feet went, fading over its seconds, turned to face the eye at every point so it
 * reads from any side, drawn only near enough to matter. Numbers: src/config/hud.json trails.
 */
import * as THREE from "three";
import cfg from "../config/hud.json";

export const TRAILS = cfg.trails;
export type TrailSide = "enemy" | "ally" | "crown";

interface Trail {
  /** the samples, oldest first: where the feet were and when */
  pts: Array<{ p: THREE.Vector3; t: number }>;
  mesh: THREE.Mesh;
  geo: THREE.BufferGeometry;
  side: TrailSide;
  /** seen this frame (a trail not seen fades out and goes) */
  seen: boolean;
}

const MAX = TRAILS.points;

export class Trails {
  private readonly trails = new Map<unknown, Trail>();
  private readonly mat: THREE.MeshBasicMaterial;
  private readonly colours: Record<TrailSide, THREE.Color>;
  private readonly tmpA = new THREE.Vector3();
  private readonly tmpB = new THREE.Vector3();
  private readonly tmpC = new THREE.Vector3();

  constructor(private readonly scene: THREE.Scene | null) {
    this.mat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, forceSinglePass: true, toneMapped: false, fog: false });
    this.colours = { enemy: new THREE.Color(TRAILS.colors.enemy), ally: new THREE.Color(TRAILS.colors.ally), crown: new THREE.Color(TRAILS.colors.crown) };
  }

  /** how many trails are drawn now (tools, the checks) */
  get count(): number {
    let n = 0;
    for (const t of this.trails.values()) if (t.mesh.visible) n++;
    return n;
  }

  /** a trail's points now, oldest first (the checks) */
  points(key: unknown): number {
    return this.trails.get(key)?.pts.length ?? 0;
  }

  /**
   * One frame: each player `key` at `feet`, on `side`, `moving` it (not hidden, alive). The eye is where the ribbon
   * turns to face.
   */
  update(now: number, eye: THREE.Vector3, players: Array<{ key: unknown; feet: THREE.Vector3; side: TrailSide; live: boolean }>): void {
    for (const t of this.trails.values()) t.seen = false;
    const far2 = TRAILS.maxDist * TRAILS.maxDist;
    for (const pl of players) {
      let t = this.trails.get(pl.key);
      if (!pl.live || pl.feet.distanceToSquared(eye) > far2) {
        if (t) t.seen = true;
        continue;
      }
      if (!t) {
        const geo = new THREE.BufferGeometry();
        geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(MAX * 2 * 3), 3));
        geo.setAttribute("color", new THREE.BufferAttribute(new Float32Array(MAX * 2 * 3), 3));
        const idx: number[] = [];
        for (let i = 0; i < MAX - 1; i++) idx.push(2 * i, 2 * i + 1, 2 * i + 2, 2 * i + 1, 2 * i + 3, 2 * i + 2);
        geo.setIndex(idx);
        const mesh = new THREE.Mesh(geo, this.mat);
        mesh.frustumCulled = false;
        mesh.renderOrder = 4;
        mesh.name = "trail";
        this.scene?.add(mesh);
        t = { pts: [], mesh, geo, side: pl.side, seen: true };
        this.trails.set(pl.key, t);
      }
      t.seen = true;
      t.side = pl.side;
      const last = t.pts[t.pts.length - 1];
      const at = this.tmpA.copy(pl.feet).setY(pl.feet.y + TRAILS.lift);
      // a teleport (a respawn, a DASH) starts the trail afresh rather than drawing a line across the map
      if (last && last.p.distanceTo(at) > TRAILS.jump) t.pts.length = 0;
      if (!last || t.pts.length === 0 || last.p.distanceTo(at) >= TRAILS.step) {
        t.pts.push({ p: at.clone(), t: now });
        if (t.pts.length > MAX) t.pts.shift();
      }
    }
    for (const [key, t] of this.trails) {
      // the old points go; a player gone or out of sight leaves theirs to fade
      while (t.pts.length && now - t.pts[0].t > TRAILS.seconds) t.pts.shift();
      if (!t.seen && t.pts.length === 0) {
        t.mesh.removeFromParent();
        t.geo.dispose();
        this.trails.delete(key);
        continue;
      }
      this.build(t, now, eye);
    }
  }

  /** the ribbon: two vertices a point, apart across the way it went and the way to the eye, fading with age */
  private build(t: Trail, now: number, eye: THREE.Vector3): void {
    const n = t.pts.length;
    t.mesh.visible = n >= 2;
    if (n < 2) return;
    const pos = t.geo.getAttribute("position") as THREE.BufferAttribute;
    const col = t.geo.getAttribute("color") as THREE.BufferAttribute;
    const c = this.colours[t.side];
    for (let i = 0; i < MAX; i++) {
      const k = Math.min(i, n - 1);
      const p = t.pts[k].p;
      const along = this.tmpB.copy(t.pts[Math.min(k + 1, n - 1)].p).sub(t.pts[Math.max(k - 1, 0)].p);
      const toEye = this.tmpC.copy(eye).sub(p);
      const across = along.cross(toEye);
      const len = across.length();
      if (len > 1e-6) across.multiplyScalar(TRAILS.width / 2 / len);
      else across.set(0, 0, 0);
      // young is bright, old is gone; past the last point, the rest collapse on it
      const a = i < n ? Math.max(0, 1 - (now - t.pts[k].t) / TRAILS.seconds) * Math.min(1, k / 2) : 0;
      pos.setXYZ(2 * i, p.x + across.x, p.y + across.y, p.z + across.z);
      pos.setXYZ(2 * i + 1, p.x - across.x, p.y - across.y, p.z - across.z);
      col.setXYZ(2 * i, c.r * a, c.g * a, c.b * a);
      col.setXYZ(2 * i + 1, c.r * a, c.g * a, c.b * a);
    }
    pos.needsUpdate = true;
    col.needsUpdate = true;
  }

  /** every trail gone (a new match) */
  clear(): void {
    for (const t of this.trails.values()) {
      t.mesh.removeFromParent();
      t.geo.dispose();
    }
    this.trails.clear();
  }
}
