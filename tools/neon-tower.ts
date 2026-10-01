// The tower's floors (rules.tower): the geometry the bake makes for them. Its stair core is a box up the middle of the
// tower's main body, a switchback stair a storey inside it, a landing at every storey with its doors, its walls and
// stairs worn as the pack's plain walls and floors wear theirs; the pack's own floors it passes through are cut, their
// triangles inside the core's box clipped away exactly (a 10 m floor tile straddles the core: left whole it stood
// across the stairwell, left out it left a 10 m hole).
type Part = { pos: number[]; uv: number[]; nrm: number[]; idx: number[] };
export type Box3 = [number, number, number, number, number, number];

/** a vertex as clipping carries it: where, its normal, its texture place */
type V = { p: number[]; n: number[]; t: number[] };
const lerp = (a: V, b: V, f: number): V => ({ p: a.p.map((v, i) => v + (b.p[i] - v) * f), n: a.n.map((v, i) => v + (b.n[i] - v) * f), t: a.t.map((v, i) => v + (b.t[i] - v) * f) });
/** a convex polygon clipped to the side of a plane where `axis` is under (`keepBelow`) or over `at` */
function clipPlane(poly: V[], axis: number, at: number, keepBelow: boolean): V[] {
  const out: V[] = [];
  const inside = (v: V) => (keepBelow ? v.p[axis] <= at : v.p[axis] >= at);
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    const [ia, ib] = [inside(a), inside(b)];
    if (ia) out.push(a);
    if (ia !== ib) out.push(lerp(a, b, (at - a.p[axis]) / (b.p[axis] - a.p[axis])));
  }
  return out;
}

/**
 * A mesh's triangles less what lies inside a box: each triangle crossing it cut into the pieces of it in the six
 * regions round the box (left of it, right of it, before it, behind it, under it, over it, each a convex region, so a
 * triangle cut to one stays convex), fanned back into triangles, normals and texture places carried along
 */
export function cutOut(pos: ArrayLike<number>, nrm: ArrayLike<number> | null, uv: ArrayLike<number> | null, idx: ArrayLike<number>, box: Box3): Part {
  const [x0, x1, y0, y1, z0, z1] = box;
  const out: Part = { pos: [], uv: [], nrm: [], idx: [] };
  const vert = (i: number): V => ({ p: [pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]], n: nrm ? [nrm[i * 3], nrm[i * 3 + 1], nrm[i * 3 + 2]] : [0, 1, 0], t: uv ? [uv[i * 2], uv[i * 2 + 1]] : [0, 0] });
  const emit = (poly: V[]) => {
    if (poly.length < 3) return;
    const base = out.pos.length / 3;
    for (const v of poly) {
      out.pos.push(...v.p);
      const l = Math.hypot(...v.n) || 1;
      out.nrm.push(v.n[0] / l, v.n[1] / l, v.n[2] / l);
      out.uv.push(...v.t);
    }
    for (let k = 1; k + 1 < poly.length; k++) out.idx.push(base, base + k, base + k + 1);
  };
  // the six regions outside the box, each the planes that bound it: [axis, at, keep below]
  const regions: Array<Array<[number, number, boolean]>> = [
    [[0, x0, true]],
    [[0, x1, false]],
    [[0, x0, false], [0, x1, true], [2, z0, true]],
    [[0, x0, false], [0, x1, true], [2, z1, false]],
    [[0, x0, false], [0, x1, true], [2, z0, false], [2, z1, true], [1, y0, true]],
    [[0, x0, false], [0, x1, true], [2, z0, false], [2, z1, true], [1, y1, false]],
  ];
  for (let k = 0; k + 2 < idx.length; k += 3) {
    const tri = [vert(idx[k]), vert(idx[k + 1]), vert(idx[k + 2])];
    const lo = [0, 1, 2].map((a) => Math.min(...tri.map((v) => v.p[a])));
    const hi = [0, 1, 2].map((a) => Math.max(...tri.map((v) => v.p[a])));
    // (wholly outside: kept as it is; wholly inside: gone)
    if (hi[0] <= x0 || lo[0] >= x1 || hi[1] <= y0 || lo[1] >= y1 || hi[2] <= z0 || lo[2] >= z1) {
      emit(tri);
      continue;
    }
    if (lo[0] >= x0 && hi[0] <= x1 && lo[1] >= y0 && hi[1] <= y1 && lo[2] >= z0 && hi[2] <= z1) continue;
    for (const planes of regions) {
      let poly = tri;
      for (const [axis, at, below] of planes) {
        poly = clipPlane(poly, axis, at, below);
        if (poly.length < 3) break;
      }
      emit(poly);
    }
  }
  return out;
}

/** a mesh's triangles turned to face the other way, normals reversed: a one-sided shell seen from inside too */
export function backFaces(pos: ArrayLike<number>, nrm: ArrayLike<number> | null, uv: ArrayLike<number> | null, idx: ArrayLike<number>): Part {
  const out: Part = { pos: Array.from(pos), uv: uv ? Array.from(uv) : new Array((pos.length / 3) * 2).fill(0), nrm: nrm ? Array.from(nrm).map((v) => -v) : new Array(pos.length).fill(0), idx: [] };
  for (let k = 0; k + 2 < idx.length; k += 3) out.idx.push(idx[k], idx[k + 2], idx[k + 1]);
  return out;
}

/** a box's six faces into a part, mapped by the metre (`scale` of the texture a metre) along each face */
export function boxInto(p: Part, x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, scale: number, skip: { top?: boolean; bottom?: boolean; septum?: boolean } = {}): void {
  const quad = (a: number[], b: number[], c: number[], d: number[], n: number[], uv: number[][]) => {
    const base = p.pos.length / 3;
    for (const [k, v] of [a, b, c, d].entries()) {
      p.pos.push(...v);
      p.nrm.push(...n);
      p.uv.push(uv[k][0] * scale, uv[k][1] * scale);
    }
    p.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  };
  // each face wound counter-clockwise seen from outside it
  quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [0, 0, 1], [[x0, -y0], [x1, -y0], [x1, -y1], [x0, -y1]]);
  quad([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [0, 0, -1], [[-x1, -y0], [-x0, -y0], [-x0, -y1], [-x1, -y1]]);
  quad([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [1, 0, 0], [[z1, -y0], [z0, -y0], [z0, -y1], [z1, -y1]]);
  quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [-1, 0, 0], [[z0, -y0], [z1, -y0], [z1, -y1], [z0, -y1]]);
  if (!skip.top) quad([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], [0, 1, 0], [[x0, z1], [x1, z1], [x1, z0], [x0, z0]]);
  if (!skip.bottom) quad([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], [0, -1, 0], [[x0, z0], [x1, z0], [x1, z1], [x0, z1]]);
  // a plane down a thin box's middle, never seen: the collision fills a cell a triangle passes through, and a wall a
  // cell thick whose faces lie on the cells' edges left the cell between them empty (the core's north wall, walked through)
  if (skip.septum) {
    const [zm, xm] = [(z0 + z1) / 2, (x0 + x1) / 2];
    if (x1 - x0 >= z1 - z0) quad([x0, y0, zm], [x1, y0, zm], [x1, y1, zm], [x0, y1, zm], [0, 0, 1], [[0, 0], [0, 0], [0, 0], [0, 0]]);
    else quad([xm, y0, z1], [xm, y0, z0], [xm, y1, z0], [xm, y1, z1], [1, 0, 0], [[0, 0], [0, 0], [0, 0], [0, 0]]);
  }
}

export type CoreSpec = {
  /** the core's box on the map: x0, x1, z0, z1 (outer faces) */
  box: number[];
  /** the storeys it serves, their floors' heights, in order up; it stands to `top` */
  storeys: number[];
  top: number;
  /** its walls' thickness, the landing's depth from the west wall in, the wall between the flights */
  wall: number;
  landing: number;
  divider: number;
  /** a step's tread, its highest riser, a step's and a landing's depth */
  tread: number;
  riser: number;
  stepDepth: number;
  slab: number;
  /** each storey's doors (w, n, s), their width and height */
  doors: string[][];
  door: number[];
};

/**
 * The stair core: a box of walls the whole height, a doorway on each named side of each storey's landing; inside, at
 * each storey a landing across its west end, a flight up its north half to a landing across its east end half a storey
 * up, and a flight back down its south half to the next storey's landing, a wall between the flights. Steps are boxes, a
 * riser no higher than `riser`; the landings are slabs. Returns the walls, the landings and the steps, each a part, and
 * the way up for a body (x, z, height), storey by storey
 */
export function stairCore(c: CoreSpec, scale: { wall: number; floor: number; step: number }): { walls: Part; landings: Part; steps: Part; route: number[][] } {
  const [X0, X1, Z0, Z1] = c.box;
  const w = c.wall;
  const [ix0, ix1, iz0, iz1] = [X0 + w, X1 - w, Z0 + w, Z1 - w];
  const zMid = (iz0 + iz1) / 2;
  const [north, south] = [[iz0, zMid - c.divider / 2], [zMid + c.divider / 2, iz1]];
  const part = (): Part => ({ pos: [], uv: [], nrm: [], idx: [] });
  const walls = part(), landings = part(), steps = part();
  const route: number[][] = [];
  const bottom = c.storeys[0];
  // the walls: each a run of boxes between its doors, a storey at a time
  const [dw, dh] = c.door;
  type Wall = { side: string; along: "x" | "z"; at: [number, number]; from: number; to: number; door: number };
  const ws: Wall[] = [
    { side: "w", along: "z", at: [X0, X0 + w], from: Z0, to: Z1, door: (Z0 + Z1) / 2 },
    { side: "e", along: "z", at: [X1 - w, X1], from: Z0, to: Z1, door: NaN },
    { side: "n", along: "x", at: [Z0, Z0 + w], from: X0 + w, to: X1 - w, door: ix0 + c.landing / 2 },
    { side: "s", along: "x", at: [Z1 - w, Z1], from: X0 + w, to: X1 - w, door: ix0 + c.landing / 2 },
  ];
  const levels = [...c.storeys, c.top];
  for (const W of ws)
    for (let k = 0; k < c.storeys.length; k++) {
      const [y0, y1] = [levels[k], levels[k + 1]];
      const has = c.doors[k].includes(W.side) && !Number.isNaN(W.door);
      const cuts = has ? [W.from, W.door - dw / 2, W.door + dw / 2, W.to] : [W.from, W.to];
      const seg = (u0: number, u1: number, v0: number, v1: number) => {
        if (u1 - u0 < 1e-3 || v1 - v0 < 1e-3) return;
        if (W.along === "z") boxInto(walls, W.at[0], W.at[1], v0, v1, u0, u1, scale.wall, { top: true, bottom: true, septum: true });
        else boxInto(walls, u0, u1, v0, v1, W.at[0], W.at[1], scale.wall, { top: true, bottom: true, septum: true });
      };
      if (has) {
        seg(cuts[0], cuts[1], y0, y1);
        seg(cuts[2], cuts[3], y0, y1);
        seg(cuts[1], cuts[2], y0 + dh, y1);
      } else seg(W.from, W.to, y0, y1);
    }
  // inside, storey by storey: the landing, the flight up the north half, the half landing, the flight back the south half
  for (let k = 0; k < c.storeys.length; k++) {
    const h = c.storeys[k];
    // (the bottom storey stands on the floor already there; every other landing is the core's own, out under its walls)
    if (h > bottom) boxInto(landings, X0, ix0 + c.landing, h - c.slab, h, Z0, Z1, scale.floor);
    if (k === c.storeys.length - 1) break;
    const rise = c.storeys[k + 1] - h;
    const n = Math.ceil(rise / 2 / c.riser);
    const r = rise / 2 / n;
    const fx = ix0 + c.landing;
    const run = (n - 1) * c.tread;
    // the flight up the north half: steps 1..n-1, then the half landing is the n-th riser up
    for (let s = 1; s < n; s++) boxInto(steps, fx + (s - 1) * c.tread, fx + s * c.tread, h + s * r - c.stepDepth, h + s * r, north[0], north[1], scale.step);
    const half = h + rise / 2;
    boxInto(landings, fx + run, ix1, half - c.slab, half, iz0, iz1, scale.floor);
    // the flight back along the south half, from the half landing to the next storey's landing
    for (let s = 1; s < n; s++) boxInto(steps, fx + run - s * c.tread, fx + run - (s - 1) * c.tread, half + s * r - c.stepDepth, half + s * r, south[0], south[1], scale.step);
    // the wall between the flights, from this storey's floor to the next's, no longer than the flight under it (a 3.5 m
    // storey's flights run longer than a 3 m one's, and its wall stood 1.5 m over the half landing below it)
    const below = k > 0 ? (Math.ceil((h - c.storeys[k - 1]) / 2 / c.riser) - 1) * c.tread : run;
    boxInto(walls, fx, fx + Math.min(run, below), h, h + rise, north[1], south[0], scale.wall, { top: true, bottom: true, septum: true });
    const [nz, sz] = [(north[0] + north[1]) / 2, (south[0] + south[1]) / 2];
    route.push([ix0 + c.landing / 2, nz, h], [fx + 0.2, nz, h + r], [fx + run - 0.2, nz, half - r], [fx + run + 0.6, nz, half], [fx + run + 0.6, sz, half], [fx + run - 0.2, sz, half + r], [fx + 0.2, sz, h + rise - r]);
  }
  route.push([ix0 + c.landing / 2, (iz0 + iz1) / 2, c.storeys.at(-1)!]);
  return { walls, landings, steps, route };
}

/**
 * How many of a fan of level rays from points on a floor get out without meeting a face turned toward them: from each
 * point `n` rays round at eye height, each meeting the nearest of `tris` (each crossing that height) that faces back
 * along it; one that meets none within `far` metres got out (the room is see-through there). The faces a ray meets are
 * the drawn ones: a one-sided wall seen from behind is not met
 */
export function escapes(tris: Array<[number[], number[], number[]]>, points: number[][], y: number, n: number, far: number): { rays: number; out: number[][] } {
  const near = tris.filter(([a, b, c]) => Math.min(a[1], b[1], c[1]) <= y && Math.max(a[1], b[1], c[1]) >= y);
  const out: number[][] = [];
  let rays = 0;
  for (const p of points)
    for (let k = 0; k < n; k++) {
      const t = (k / n) * 2 * Math.PI;
      const d = [Math.cos(t), 0, Math.sin(t)];
      rays++;
      let best = Infinity;
      for (const [a, b, c] of near) {
        // Moller-Trumbore, and the face's own normal (b - a) x (c - a) against the ray
        const e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], e2 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
        const nx = e1[1] * e2[2] - e1[2] * e2[1], ny = e1[2] * e2[0] - e1[0] * e2[2], nz = e1[0] * e2[1] - e1[1] * e2[0];
        if (nx * d[0] + ny * d[1] + nz * d[2] >= 0) continue;
        const pv = [d[1] * e2[2] - d[2] * e2[1], d[2] * e2[0] - d[0] * e2[2], d[0] * e2[1] - d[1] * e2[0]];
        const det = e1[0] * pv[0] + e1[1] * pv[1] + e1[2] * pv[2];
        if (Math.abs(det) < 1e-12) continue;
        const tv = [p[0] - a[0], y - a[1], p[1] - a[2]];
        const u = (tv[0] * pv[0] + tv[1] * pv[1] + tv[2] * pv[2]) / det;
        if (u < 0 || u > 1) continue;
        const qv = [tv[1] * e1[2] - tv[2] * e1[1], tv[2] * e1[0] - tv[0] * e1[2], tv[0] * e1[1] - tv[1] * e1[0]];
        const v = (d[0] * qv[0] + d[1] * qv[1] + d[2] * qv[2]) / det;
        if (v < 0 || u + v > 1) continue;
        const dist = (e2[0] * qv[0] + e2[1] * qv[1] + e2[2] * qv[2]) / det;
        if (dist > 0.01 && dist < best) best = dist;
      }
      if (best > far) out.push([p[0], p[1], +((t * 180) / Math.PI).toFixed(0)]);
    }
  return { rays, out };
}
