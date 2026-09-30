// The Neon centre's streets (neonmap.json rules.streets), shared by the layout (tools/neon-layout.ts), the bake
// (tools/import-neon.ts: the road's surface) and the checks: the Loop round the tower, a circle, and from four forks
// on it the eight streets out to the ring road, each an S (Hermite curves through a waypoint), meeting the outer
// districts' straight roads where they always met them. The owner, 2026-09-30: "since the outer districts are straight
// roads, we should make the ones in the center district be not straight, have them curve left and right along with
// buildings so that it's different visually". Map-local metres, x east, z south.

export type Pt = [number, number];
export type Street = {
  id: string;
  closed: boolean;
  /** the centreline, a point every `STEP` metres */
  pts: Pt[];
  /** the unit tangent at each point */
  tan: Pt[];
  half: number;
};
type Rules = {
  road: number;
  pave: number;
  loop: { r: number };
  spokes: Array<{ id: string; from: number; dir: Pt; via: Pt; to: Pt; out: Pt }>;
};

export const STEP = 0.5;

const sub = (a: Pt, b: Pt): Pt => [a[0] - b[0], a[1] - b[1]];
const len = (a: Pt) => Math.hypot(a[0], a[1]);
const unit = (a: Pt): Pt => {
  const l = len(a) || 1;
  return [a[0] / l, a[1] / l];
};

/** a cubic Hermite from p0 to p1 with end tangents m0, m1, sampled finely */
function hermite(p0: Pt, m0: Pt, p1: Pt, m1: Pt, n: number): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const [h00, h10, h01, h11] = [2 * t ** 3 - 3 * t ** 2 + 1, t ** 3 - 2 * t ** 2 + t, -2 * t ** 3 + 3 * t ** 2, t ** 3 - t ** 2];
    out.push([h00 * p0[0] + h10 * m0[0] + h01 * p1[0] + h11 * m1[0], h00 * p0[1] + h10 * m0[1] + h01 * p1[1] + h11 * m1[1]]);
  }
  return out;
}

/** a dense polyline resampled every `step` metres along its length */
function resample(poly: Pt[], step: number, closed: boolean): Pt[] {
  const src = closed ? [...poly, poly[0]] : poly;
  const out: Pt[] = [src[0]];
  let carry = 0;
  for (let i = 1; i < src.length; i++) {
    const [a, b] = [src[i - 1], src[i]];
    const d = len(sub(b, a));
    let t = step - carry;
    while (t <= d + 1e-9) {
      out.push([a[0] + ((b[0] - a[0]) * t) / d, a[1] + ((b[1] - a[1]) * t) / d]);
      t += step;
    }
    carry = d - (t - step);
  }
  if (!closed) {
    const last = src[src.length - 1];
    if (len(sub(last, out[out.length - 1])) > 1e-6) out.push(last);
  } else if (len(sub(out[0], out[out.length - 1])) < step / 2) out.pop();
  return out;
}

function tangents(pts: Pt[], closed: boolean): Pt[] {
  return pts.map((_, i) => {
    const a = closed ? pts[(i - 1 + pts.length) % pts.length] : pts[Math.max(0, i - 1)];
    const b = closed ? pts[(i + 1) % pts.length] : pts[Math.min(pts.length - 1, i + 1)];
    return unit(sub(b, a));
  });
}

/** the fork on the Loop at `deg` degrees (from +x toward +z) */
export const junction = (r: number, deg: number): Pt => [r * Math.cos((deg * Math.PI) / 180), r * Math.sin((deg * Math.PI) / 180)];

export function streets(S: Rules): Street[] {
  const half = S.road / 2;
  const out: Street[] = [];
  // the Loop
  const ring: Pt[] = [];
  for (let i = 0; i < 2048; i++) ring.push(junction(S.loop.r, (i / 2048) * 360));
  const lp = resample(ring, STEP, true);
  out.push({ id: "loop", closed: true, pts: lp, tan: tangents(lp, true), half });
  // the eight: from the fork, setting off along `dir`, through `via`, into the ring road along `out`
  for (const s of S.spokes) {
    const j = junction(S.loop.r, s.from);
    const d0 = unit(s.dir);
    const d1 = unit(s.out);
    const mid = unit(sub(s.to, j));
    const l0 = len(sub(s.via, j));
    const l1 = len(sub(s.to, s.via));
    const mv: Pt = [(mid[0] * (l0 + l1)) / 2, (mid[1] * (l0 + l1)) / 2];
    const a = hermite(j, [d0[0] * l0, d0[1] * l0], s.via, mv, 400);
    const b = hermite(s.via, mv, s.to, [d1[0] * l1, d1[1] * l1], 400);
    const pts = resample([...a, ...b.slice(1)], STEP, false);
    out.push({ id: s.id, closed: false, pts, tan: tangents(pts, false), half });
  }
  return out;
}

/** the distance from a point to the streets' centrelines: a grid of their segments, 4 m a cell */
export class StreetField {
  private grid = new Map<string, Array<[number, number]>>();
  constructor(public readonly list: Street[]) {
    list.forEach((s, si) => {
      const n = s.closed ? s.pts.length : s.pts.length - 1;
      for (let i = 0; i < n; i++) {
        const [a, b] = [s.pts[i], s.pts[(i + 1) % s.pts.length]];
        for (const k of new Set([this.key(a[0], a[1]), this.key(b[0], b[1])])) {
          const l = this.grid.get(k);
          if (l) l.push([si, i]);
          else this.grid.set(k, [[si, i]]);
        }
      }
    });
  }
  private key(x: number, z: number) {
    return `${Math.floor(x / 4)},${Math.floor(z / 4)}`;
  }
  /** the nearest centreline within `reach` metres: which street, where along it, how far, and its tangent there */
  nearest(x: number, z: number, reach = 12): { street: Street; i: number; d: number; t: Pt; side: number } | null {
    let best: { street: Street; i: number; d: number; t: Pt; side: number } | null = null;
    const r = Math.ceil(reach / 4);
    const [cx, cz] = [Math.floor(x / 4), Math.floor(z / 4)];
    for (let gx = cx - r; gx <= cx + r; gx++)
      for (let gz = cz - r; gz <= cz + r; gz++)
        for (const [si, i] of this.grid.get(`${gx},${gz}`) ?? []) {
          const s = this.list[si];
          const a = s.pts[i];
          const b = s.pts[(i + 1) % s.pts.length];
          const ab = sub(b, a);
          const l2 = ab[0] * ab[0] + ab[1] * ab[1];
          const u = Math.max(0, Math.min(1, ((x - a[0]) * ab[0] + (z - a[1]) * ab[1]) / l2));
          const px = a[0] + ab[0] * u;
          const pz = a[1] + ab[1] * u;
          const d = Math.hypot(x - px, z - pz);
          if (!best || d < best.d) {
            const t = unit(ab);
            // (which side of the centreline: + to its right, looking along it with z south)
            const side = Math.sign(t[0] * (z - pz) - t[1] * (x - px)) || 1;
            best = { street: s, i, d, t, side };
          }
        }
    return best && best.d <= reach ? best : null;
  }
  /** how far outside the nearest carriageway a point is (negative: on the road) */
  road(x: number, z: number): number {
    const n = this.nearest(x, z, 12);
    return n ? n.d - n.street.half : Infinity;
  }
  /** each street's distance from (x, z), those within `reach` */
  near(x: number, z: number, reach = 16): Map<Street, number> {
    const out = new Map<Street, number>();
    const r = Math.ceil(reach / 4);
    const [cx, cz] = [Math.floor(x / 4), Math.floor(z / 4)];
    for (let gx = cx - r; gx <= cx + r; gx++)
      for (let gz = cz - r; gz <= cz + r; gz++)
        for (const [si, i] of this.grid.get(`${gx},${gz}`) ?? []) {
          const s = this.list[si];
          const a = s.pts[i];
          const b = s.pts[(i + 1) % s.pts.length];
          const ab = sub(b, a);
          const l2 = ab[0] * ab[0] + ab[1] * ab[1];
          const u = Math.max(0, Math.min(1, ((x - a[0]) * ab[0] + (z - a[1]) * ab[1]) / l2));
          const d = Math.hypot(x - a[0] - ab[0] * u, z - a[1] - ab[1] * u);
          if (d <= reach && d < (out.get(s) ?? Infinity)) out.set(s, d);
        }
    return out;
  }
  /**
   * The carriageways as one surface, how far outside it a point is (negative: on it): the streets joined by a smooth
   * minimum `round` metres wide, so where two meet the kerb turns a rounded corner as a real junction's does and not a
   * sharp one; `except` leaves a street out (how near a point on one street is to the others)
   */
  surface(x: number, z: number, round: number, except?: Street): number {
    let v = Infinity;
    for (const [s, d] of this.near(x, z)) {
      if (s === except) continue;
      const q = d - s.half;
      if (v === Infinity) v = q;
      else {
        // polynomial smooth minimum (the kerb's fillet at a junction)
        const h = Math.max(round - Math.abs(v - q), 0) / round;
        v = Math.min(v, q) - (h * h * round) / 4;
      }
    }
    return v;
  }
}

/**
 * Where `value` crosses zero, as polylines: marching squares over the box a `cell` at a time, the pieces chained end to
 * end. Each point with the way the surface lies from it (`inward`: the unit direction toward negative `value`)
 */
export function contours(value: (x: number, z: number) => number, x0: number, x1: number, z0: number, z1: number, cell: number): Array<{ pts: Pt[]; closed: boolean }> {
  const nx = Math.round((x1 - x0) / cell);
  const nz = Math.round((z1 - z0) / cell);
  const v = new Float32Array((nx + 1) * (nz + 1));
  for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) v[j * (nx + 1) + i] = value(x0 + i * cell, z0 + j * cell);
  const at = (i: number, j: number) => v[j * (nx + 1) + i];
  const segs: Array<[Pt, Pt]> = [];
  const cross = (xa: number, za: number, va: number, xb: number, zb: number, vb: number): Pt => {
    const t = va / (va - vb);
    return [xa + (xb - xa) * t, za + (zb - za) * t];
  };
  for (let j = 0; j < nz; j++)
    for (let i = 0; i < nx; i++) {
      const X = [x0 + i * cell, x0 + (i + 1) * cell];
      const Z = [z0 + j * cell, z0 + (j + 1) * cell];
      const c = [at(i, j), at(i + 1, j), at(i + 1, j + 1), at(i, j + 1)];
      const P: Pt[] = [
        [X[0], Z[0]],
        [X[1], Z[0]],
        [X[1], Z[1]],
        [X[0], Z[1]],
      ];
      const edge: Pt[] = [];
      for (let k = 0; k < 4; k++) {
        const k2 = (k + 1) % 4;
        if (c[k] < 0 !== c[k2] < 0) edge.push(cross(P[k][0], P[k][1], c[k], P[k2][0], P[k2][1], c[k2]));
      }
      if (edge.length === 2) segs.push([edge[0], edge[1]]);
      else if (edge.length === 4) {
        // a saddle: pair by the cell's middle
        const mid = (c[0] + c[1] + c[2] + c[3]) / 4;
        if (mid < 0 === c[0] < 0) segs.push([edge[0], edge[1]], [edge[2], edge[3]]);
        else segs.push([edge[0], edge[3]], [edge[1], edge[2]]);
      }
    }
  // chained by their shared ends
  const key = (p: Pt) => `${Math.round(p[0] * 1000)},${Math.round(p[1] * 1000)}`;
  const ends = new Map<string, number[]>();
  segs.forEach(([a, b], k) => {
    for (const p of [a, b]) {
      const l = ends.get(key(p));
      if (l) l.push(k);
      else ends.set(key(p), [k]);
    }
  });
  const used = new Uint8Array(segs.length);
  const out: Array<{ pts: Pt[]; closed: boolean }> = [];
  for (let s0 = 0; s0 < segs.length; s0++) {
    if (used[s0]) continue;
    used[s0] = 1;
    const line: Pt[] = [segs[s0][0], segs[s0][1]];
    // on from the tail, then from the head
    for (const back of [false, true]) {
      for (;;) {
        const tip = back ? line[0] : line[line.length - 1];
        const next = (ends.get(key(tip)) ?? []).find((k) => !used[k]);
        if (next === undefined) break;
        used[next] = 1;
        const [a, b] = segs[next];
        const far = key(a) === key(tip) ? b : a;
        if (back) line.unshift(far);
        else line.push(far);
      }
    }
    const closed = line.length > 2 && key(line[0]) === key(line[line.length - 1]);
    out.push({ pts: closed ? line.slice(0, -1) : line, closed });
  }
  return out;
}

/** a polyline's points every `every` metres along it, each with its unit tangent */
export function along(pts: Pt[], closed: boolean, every: number, from = every / 2): Array<{ p: Pt; t: Pt }> {
  const src = closed ? [...pts, pts[0]] : pts;
  const out: Array<{ p: Pt; t: Pt }> = [];
  let next = from;
  let run = 0;
  for (let i = 1; i < src.length; i++) {
    const [a, b] = [src[i - 1], src[i]];
    const d = len(sub(b, a));
    if (d < 1e-9) continue;
    const t = unit(sub(b, a));
    while (next <= run + d + 1e-9) {
      const u = (next - run) / d;
      out.push({ p: [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u], t });
      next += every;
    }
    run += d;
  }
  return out;
}

/**
 * The surface where `inside` holds, as triangles facing up at height `y`: whole cells a row at a time, and the cells its
 * edge crosses by marching squares, the edge where `value` (negative inside) crosses zero. Positions and indices, x z
 * map-local, y up; the triangles wound to face up (three.js: counter-clockwise seen from above)
 */
export function fieldSurface(value: (x: number, z: number) => number, x0: number, x1: number, z0: number, z1: number, cell: number, y: number): { pos: number[]; idx: number[] } {
  const nx = Math.round((x1 - x0) / cell);
  const nz = Math.round((z1 - z0) / cell);
  const v = new Float32Array((nx + 1) * (nz + 1));
  for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) v[j * (nx + 1) + i] = value(x0 + i * cell, z0 + j * cell);
  const pos: number[] = [];
  const idx: number[] = [];
  const vert = (x: number, z: number) => {
    pos.push(x, y, z);
    return pos.length / 3 - 1;
  };
  /** a polygon (x z pairs, in order round it) fanned into triangles facing up */
  const poly = (pts: Pt[]) => {
    if (pts.length < 3) return;
    // (wound so the first edge runs +z then +x round: the fan's triangles face up whichever way the list turns)
    let area = 0;
    for (let k = 0; k < pts.length; k++) {
      const [a, b] = [pts[k], pts[(k + 1) % pts.length]];
      area += a[0] * b[1] - b[0] * a[1];
    }
    const ordered = area < 0 ? pts : [...pts].reverse();
    const ids = ordered.map(([x, z]) => vert(x, z));
    for (let k = 1; k + 1 < ids.length; k++) idx.push(ids[0], ids[k], ids[k + 1]);
  };
  const at = (i: number, j: number) => v[j * (nx + 1) + i];
  for (let j = 0; j < nz; j++) {
    let runStart = -1;
    const flush = (end: number) => {
      if (runStart < 0) return;
      poly([
        [x0 + runStart * cell, z0 + j * cell],
        [x0 + end * cell, z0 + j * cell],
        [x0 + end * cell, z0 + (j + 1) * cell],
        [x0 + runStart * cell, z0 + (j + 1) * cell],
      ]);
      runStart = -1;
    };
    for (let i = 0; i < nx; i++) {
      const c = [at(i, j), at(i + 1, j), at(i + 1, j + 1), at(i, j + 1)];
      const inside = c.map((q) => q < 0);
      if (inside.every(Boolean)) {
        if (runStart < 0) runStart = i;
        continue;
      }
      flush(i);
      if (!inside.some(Boolean)) continue;
      // the cell's corners in order round it, and where the edge crosses each side
      const corners: Pt[] = [
        [x0 + i * cell, z0 + j * cell],
        [x0 + (i + 1) * cell, z0 + j * cell],
        [x0 + (i + 1) * cell, z0 + (j + 1) * cell],
        [x0 + i * cell, z0 + (j + 1) * cell],
      ];
      const pts: Pt[] = [];
      for (let k = 0; k < 4; k++) {
        const k2 = (k + 1) % 4;
        if (inside[k]) pts.push(corners[k]);
        if (inside[k] !== inside[k2]) {
          const t = c[k] / (c[k] - c[k2]);
          pts.push([corners[k][0] + (corners[k2][0] - corners[k][0]) * t, corners[k][1] + (corners[k2][1] - corners[k][1]) * t]);
        }
      }
      poly(pts);
    }
    flush(nx);
  }
  return { pos, idx };
}
