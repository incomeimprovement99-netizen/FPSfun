/**
 * Movement trails (Hyper Scape's: "the red trail of the enemies and the blue trail of your teammates ... something that
 * every player has"; docs/HYPERSCAPE_GAP_ANALYSIS.md). Behind every other player a
 * ribbon of light along the way their feet went, fading over its seconds, turned to face the eye at every point so it
 * reads from any side, drawn only near enough to matter. Numbers: src/config/hud.json trails.
 */
import * as THREE from "three";
import cfg from "../config/hud.json";

export const TRAILS = cfg.trails;
/** a double jump's tracer (hud.json jumpTracers) */
export const TRACERS = cfg.jumpTracers;
export type TrailSide = "enemy" | "ally";

interface Trail {
  /** the samples, oldest first: where the feet were and when */
  pts: Array<{ p: THREE.Vector3; t: number }>;
  mesh: THREE.Mesh;
  geo: THREE.BufferGeometry;
  side: TrailSide;
  /** seen this frame (a trail not seen fades out and goes) */
  seen: boolean;
  /** where the feet were last frame and when, for their speed; and the way the last point was laid */
  last: THREE.Vector3 | null;
  lastAt: number;
  heading: THREE.Vector3 | null;
  /** where the body has been lately, for a tracer; the double jumps seen (null until the first count); one just made */
  air: Array<{ p: THREE.Vector3; t: number }>;
  jumps: number | null;
  jumped: { at: number; from: THREE.Vector3; before: THREE.Vector3 } | null;
}

/** a tracer drawn: its ribbon through fixed points, and when it was drawn */
interface Tracer {
  pts: THREE.Vector3[];
  mesh: THREE.Mesh;
  geo: THREE.BufferGeometry;
  side: TrailSide;
  born: number;
}

const MAX = TRAILS.points;

export class Trails {
  private readonly trails = new Map<unknown, Trail>();
  private readonly tracers: Tracer[] = [];
  private readonly mat: THREE.MeshBasicMaterial;
  private readonly colours: Record<TrailSide, THREE.Color>;
  private readonly tmpA = new THREE.Vector3();
  private readonly tmpB = new THREE.Vector3();
  private readonly tmpC = new THREE.Vector3();

  constructor(private readonly scene: THREE.Scene | null) {
    this.mat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, forceSinglePass: true, toneMapped: false, fog: false });
    this.colours = { enemy: new THREE.Color(TRAILS.colors.enemy), ally: new THREE.Color(TRAILS.colors.ally) };
  }

  /** how many trails are drawn now (tools, the checks) */
  get count(): number {
    let n = 0;
    for (const t of this.trails.values()) if (t.mesh.visible) n++;
    return n;
  }

  /** how many double-jump tracers are drawn now (the checks) */
  get tracerCount(): number {
    return this.tracers.length;
  }

  /** a trail's points now, oldest first (the checks) */
  points(key: unknown): number {
    return this.trails.get(key)?.pts.length ?? 0;
  }

  /**
   * One frame: each player `key` at `feet`, on `side`, `moving` it (not hidden, alive). The eye is where the ribbon
   * turns to face.
   */
  update(now: number, eye: THREE.Vector3, players: Array<{ key: unknown; feet: THREE.Vector3; side: TrailSide; live: boolean; airJumps?: number }>): void {
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
        t = { pts: [], mesh, geo, side: pl.side, seen: true, last: null, lastAt: now, heading: null, air: [], jumps: null, jumped: null };
        this.trails.set(pl.key, t);
      }
      t.seen = true;
      t.side = pl.side;
      const last = t.pts[t.pts.length - 1];
      const at = this.tmpA.copy(pl.feet).setY(pl.feet.y + TRAILS.lift);
      // how fast the feet go: only a player running lays a trail. A player standing and dodging in a fight laid one
      // back and forth under their feet, a red smear round the figure the owner was trying to track
      const dt = now - t.lastAt;
      const speed = t.last && dt > 0 ? Math.hypot(pl.feet.x - t.last.x, pl.feet.z - t.last.z) / dt : 0;
      t.last = (t.last ?? new THREE.Vector3()).copy(pl.feet);
      t.lastAt = now;
      // a teleport (a respawn, a DASH) starts the trail afresh rather than drawing a line across the map
      if (last && last.p.distanceTo(at) > TRAILS.jump) t.pts.length = 0;
      if (speed >= TRAILS.minSpeed && (!last || t.pts.length === 0 || last.p.distanceTo(at) >= TRAILS.step)) {
        // and a turn back on itself (a dodge) starts it afresh too, so a zigzag never piles up into a loop
        if (last) {
          const way = this.tmpB.copy(at).sub(last.p).setY(0).normalize();
          if (t.heading && way.dot(t.heading) < TRAILS.turnBack) t.pts.length = 0;
          t.heading = (t.heading ?? new THREE.Vector3()).copy(way);
        }
        t.pts.push({ p: at.clone(), t: now });
        if (t.pts.length > MAX) t.pts.shift();
      }
      this.watchJumps(t, pl, now);
    }
    // the tracers fade and go
    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const tr = this.tracers[i];
      if (now - tr.born > TRACERS.seconds) {
        tr.mesh.removeFromParent();
        tr.geo.dispose();
        this.tracers.splice(i, 1);
      } else this.buildTracer(tr, now, eye);
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
    // faded out within fight range, where the eye is on the figure itself, not on where it has been
    const near = THREE.MathUtils.smoothstep(t.pts[n - 1].p.distanceTo(eye), TRAILS.near[0], TRAILS.near[1]);
    if (near <= 0.001) {
      t.mesh.visible = false;
      return;
    }
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
      const a = i < n ? Math.max(0, 1 - (now - t.pts[k].t) / TRAILS.seconds) * Math.min(1, k / 2) * near * TRAILS.opacity : 0;
      pos.setXYZ(2 * i, p.x + across.x, p.y + across.y, p.z + across.z);
      pos.setXYZ(2 * i + 1, p.x - across.x, p.y - across.y, p.z - across.z);
      col.setXYZ(2 * i, c.r * a, c.g * a, c.b * a);
      col.setXYZ(2 * i + 1, c.r * a, c.g * a, c.b * a);
    }
    pos.needsUpdate = true;
    col.needsUpdate = true;
  }

  /**
   * A double jump that turns them: from the jump on, for up to `within` seconds, the way they go against the way they
   * went before it, and a tracer through the turn once the two are `turn` degrees apart (hud.json jumpTracers). A count
   * first seen is where it starts.
   */
  private watchJumps(t: Trail, pl: { feet: THREE.Vector3; side: TrailSide; airJumps?: number }, now: number): void {
    const T = TRACERS;
    const body = pl.feet.clone().setY(pl.feet.y + T.lift);
    // a teleport starts the body's way afresh, as it does the trail
    const prev = t.air[t.air.length - 1];
    if (prev && prev.p.distanceTo(body) > TRAILS.jump) {
      t.air.length = 0;
      t.jumped = null;
    }
    t.air.push({ p: body, t: now });
    while (t.air.length && now - t.air[0].t > T.before + T.within + 0.2) t.air.shift();
    /** where the body was `ago` seconds back, or the oldest kept */
    const at = (ago: number) => (t.air.find((a) => now - a.t <= ago) ?? t.air[0]).p;
    if (pl.airJumps !== undefined && pl.airJumps !== t.jumps) {
      if (t.jumps !== null) t.jumped = { at: now, from: body.clone(), before: body.clone().sub(at(T.before)).setY(0) };
      t.jumps = pl.airJumps;
    }
    const J = t.jumped;
    if (!J) return;
    if (now - J.at > T.within) {
      t.jumped = null;
      return;
    }
    const going = body.clone().sub(at(T.span)).setY(0);
    if (J.before.length() > 0.05 && going.length() > 0.02 && J.before.angleTo(going) >= (T.turn * Math.PI) / 180) {
      t.jumped = null;
      const pts = t.air.filter((a) => a.t >= J.at - T.before).map((a) => a.p.clone());
      if (pts.length >= 2) this.addTracer(pts, pl.side, now);
    }
  }

  private addTracer(pts: THREE.Vector3[], side: TrailSide, now: number): void {
    const n = pts.length;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(n * 2 * 3), 3));
    geo.setAttribute("color", new THREE.BufferAttribute(new Float32Array(n * 2 * 3), 3));
    const idx: number[] = [];
    for (let i = 0; i < n - 1; i++) idx.push(2 * i, 2 * i + 1, 2 * i + 2, 2 * i + 1, 2 * i + 3, 2 * i + 2);
    geo.setIndex(idx);
    const mesh = new THREE.Mesh(geo, this.mat);
    mesh.frustumCulled = false;
    mesh.renderOrder = 4;
    mesh.name = "tracer";
    this.scene?.add(mesh);
    this.tracers.push({ pts, mesh, geo, side, born: now });
  }

  /** a tracer's ribbon, turned to the eye as a trail's is, fading as a whole with its age (and close by, jumpTracers.near) */
  private buildTracer(tr: Tracer, now: number, eye: THREE.Vector3): void {
    const n = tr.pts.length;
    const near = THREE.MathUtils.smoothstep(tr.pts[n - 1].distanceTo(eye), TRACERS.near[0], TRACERS.near[1]);
    const far = tr.pts[n - 1].distanceTo(eye) <= TRAILS.maxDist ? 1 : 0;
    const pos = tr.geo.getAttribute("position") as THREE.BufferAttribute;
    const col = tr.geo.getAttribute("color") as THREE.BufferAttribute;
    const c = this.colours[tr.side];
    const a0 = Math.max(0, 1 - (now - tr.born) / TRACERS.seconds) * TRACERS.opacity * near * far;
    tr.mesh.visible = a0 > 0.001;
    if (!tr.mesh.visible) return;
    for (let i = 0; i < n; i++) {
      const p = tr.pts[i];
      const along = this.tmpB.copy(tr.pts[Math.min(i + 1, n - 1)]).sub(tr.pts[Math.max(i - 1, 0)]);
      const toEye = this.tmpC.copy(eye).sub(p);
      const across = along.cross(toEye);
      const len = across.length();
      if (len > 1e-6) across.multiplyScalar(TRACERS.width / 2 / len);
      else across.set(0, 0, 0);
      // the ends fade in, so it reads as a streak and not a bar
      const a = a0 * Math.min(1, i / 2, (n - 1 - i) / 2 + 0.5);
      pos.setXYZ(2 * i, p.x + across.x, p.y + across.y, p.z + across.z);
      pos.setXYZ(2 * i + 1, p.x - across.x, p.y - across.y, p.z - across.z);
      col.setXYZ(2 * i, c.r * a, c.g * a, c.b * a);
      col.setXYZ(2 * i + 1, c.r * a, c.g * a, c.b * a);
    }
    pos.needsUpdate = true;
    col.needsUpdate = true;
  }

  /** every trail and tracer gone (a new match) */
  clear(): void {
    for (const t of this.trails.values()) {
      t.mesh.removeFromParent();
      t.geo.dispose();
    }
    this.trails.clear();
    for (const tr of this.tracers) {
      tr.mesh.removeFromParent();
      tr.geo.dispose();
    }
    this.tracers.length = 0;
  }
}
