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

/**
 * A one-sided shell's upright triangles (on the map: |normal.y| under `upright`) turned to face the other way, normals
 * reversed, so it is seen from inside too. Upright alone: a corner piece's bottom cap turned over lay face up on the
 * floor it stands on, and the two fought for the same pixels; the floors and ceilings close the shell top and bottom.
 * With `scale`, mapped by the metre along the wall (the axis its face runs along) and down it, for a material of the
 * builder's choosing, the piece's own UVs suiting only its own; without, the piece's own UVs (its glass, kept as glass)
 */
export function backFaces(pos: ArrayLike<number>, nrm: ArrayLike<number> | null, uv: ArrayLike<number> | null, idx: ArrayLike<number>, upright: number, scale: number | null): Part {
  const out: Part = { pos: [], uv: [], nrm: [], idx: [] };
  for (let k = 0; k + 2 < idx.length; k += 3) {
    const tri = [idx[k], idx[k + 2], idx[k + 1]];
    const [a, b, c] = tri.map((i) => [pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]]);
    const [u, v] = [[b[0] - a[0], b[1] - a[1], b[2] - a[2]], [c[0] - a[0], c[1] - a[1], c[2] - a[2]]];
    const f = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    const len = Math.hypot(f[0], f[1], f[2]);
    if (len < 1e-12 || Math.abs(f[1]) / len >= upright) continue;
    const alongZ = Math.abs(f[0]) > Math.abs(f[2]);
    for (const i of tri) {
      out.pos.push(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]);
      if (nrm) out.nrm.push(-nrm[i * 3], -nrm[i * 3 + 1], -nrm[i * 3 + 2]);
      else out.nrm.push(f[0] / len, f[1] / len, f[2] / len);
      if (scale !== null) out.uv.push((alongZ ? pos[i * 3 + 2] : pos[i * 3]) * scale, -pos[i * 3 + 1] * scale);
      else out.uv.push(uv ? uv[i * 2] : 0, uv ? uv[i * 2 + 1] : 0);
    }
    const n = out.pos.length / 3;
    out.idx.push(n - 3, n - 2, n - 1);
  }
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

/**
 * How much drawn surface lies face up in the same plane as another material's, over the same ground: two surfaces at one
 * height fight for the same pixels, first one and then the other showing through as the view moves (a corner piece's
 * bottom cap, turned over to be seen from inside, lay on the floor it stands on). The face-up triangles flat to the
 * millimetre whose middles are in `box` (x0, x1, z0, z1), each laid at its height on a grid of `cell` metres by its
 * material; the area two materials both cover at a height, the middle of its biggest patch (x, z) and the patches'
 * count, and the two materials most of it is with the pieces they are of (`who`), the most first
 */
export function coplanar(tris: Iterable<{ p: number[][]; mat: string; who: string }>, box: number[], cell: number): Array<{ y: number; m2: number; at: number[]; patches: number; mats: string[] }> {
  const [x0, x1, z0, z1] = box;
  const byY = new Map<number, Array<{ p: number[][]; mat: string; who: string }>>();
  for (const t of tris) {
    const [a, b, c] = t.p;
    if (Math.max(a[1], b[1], c[1]) - Math.min(a[1], b[1], c[1]) > 0.001) continue;
    // (the y of (b - a) x (c - a): over nothing, face up)
    if ((b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]) < 1e-9) continue;
    const [mx, mz] = [(a[0] + b[0] + c[0]) / 3, (a[2] + b[2] + c[2]) / 3];
    if (mx < x0 || mx > x1 || mz < z0 || mz > z1) continue;
    const y = Math.round(a[1] * 1000);
    (byY.get(y) ?? byY.set(y, []).get(y)!).push(t);
  }
  const out: Array<{ y: number; m2: number; at: number[]; patches: number; mats: string[] }> = [];
  // (cells' middles a hair off the grid, so one on a shared edge is not in both triangles)
  const off = cell * 0.0137;
  for (const [y, list] of byY) {
    if (new Set(list.map((t) => t.mat)).size < 2) continue;
    const mats = new Map<string, number>();
    const whos = new Map<string, number>();
    const first = new Map<number, number>();
    const firstWho = new Map<number, number>();
    const both = new Map<number, string>();
    const nx = Math.ceil((x1 - x0) / cell) + 1;
    for (const t of list) {
      const id = mats.get(t.mat) ?? mats.set(t.mat, mats.size).get(t.mat)!;
      const who = whos.get(t.who) ?? whos.set(t.who, whos.size).get(t.who)!;
      const [a, b, c] = t.p;
      const side = (px: number, pz: number, q: number[], r: number[]) => (q[0] - px) * (r[2] - pz) - (r[0] - px) * (q[2] - pz);
      const i0 = Math.max(0, Math.floor((Math.min(a[0], b[0], c[0]) - x0) / cell)), i1 = Math.min(nx - 1, Math.ceil((Math.max(a[0], b[0], c[0]) - x0) / cell));
      const j0 = Math.max(0, Math.floor((Math.min(a[2], b[2], c[2]) - z0) / cell)), j1 = Math.ceil((Math.max(a[2], b[2], c[2]) - z0) / cell);
      for (let j = j0; j <= j1; j++)
        for (let i = i0; i <= i1; i++) {
          const [px, pz] = [x0 + (i + 0.5) * cell + off, z0 + (j + 0.5) * cell + off];
          const s1 = side(px, pz, a, b), s2 = side(px, pz, b, c), s3 = side(px, pz, c, a);
          if (!((s1 > 0 && s2 > 0 && s3 > 0) || (s1 < 0 && s2 < 0 && s3 < 0))) continue;
          const k = j * nx + i;
          const was = first.get(k);
          if (was === undefined) (first.set(k, id), firstWho.set(k, who));
          else if (was !== id && !both.has(k)) both.set(k, `${was},${firstWho.get(k)}|${id},${who}`);
        }
    }
    if (!both.size) continue;
    const pairs = new Map<string, number>();
    for (const pair of both.values()) pairs.set(pair, (pairs.get(pair) ?? 0) + 1);
    // the patches, cells joined side to side: the biggest one's middle says where to look
    const seen = new Set<number>();
    let [patches, most, at] = [0, 0, [0, 0]];
    for (const k0 of both.keys()) {
      if (seen.has(k0)) continue;
      patches++;
      const todo = [k0];
      seen.add(k0);
      let [n, sx, sz] = [0, 0, 0];
      while (todo.length) {
        const k = todo.pop()!;
        n++;
        sx += x0 + ((k % nx) + 0.5) * cell;
        sz += z0 + (Math.floor(k / nx) + 0.5) * cell;
        for (const q of [k + 1, k - 1, k + nx, k - nx]) if (both.has(q) && !seen.has(q)) (seen.add(q), todo.push(q));
      }
      if (n > most) [most, at] = [n, [+(sx / n).toFixed(2), +(sz / n).toFixed(2)]];
    }
    const top = [...pairs].sort((p, q) => q[1] - p[1])[0][0].split("|").map((q) => q.split(",").map(Number));
    const [names, people] = [[...mats.keys()], [...whos.keys()]];
    out.push({ y: y / 1000, m2: +(both.size * cell * cell).toFixed(2), at, patches, mats: top.map(([i, w]) => `${names[i]} (${people[w]})`) });
  }
  return out.sort((p, q) => q.m2 - p.m2);
}

/**
 * Coplanar's fights settled: at each height, the flat triangles (to the millimetre, middles in `box`) laid on a grid of
 * `cell` metres by material, and a face-up one is to be left out when every cell of it is covered by a face-down one
 * (something sits on it: a wall's top under the wall stacked on it, never seen) or by another material face up, one
 * with more face-up area at that height in the box (the floor a strip or a wall's top lies on, the ground a tile lies
 * on). Returns the keys (`key` of each triangle) to leave out
 */
export function settle(tris: Iterable<{ p: number[][]; mat: string; key: number }>, box: number[], cell: number): Set<number> {
  const [x0, x1, z0, z1] = box;
  const byY = new Map<number, Array<{ p: number[][]; mat: string; key: number; area: number }>>();
  const downAt = new Map<number, Array<number[][]>>();
  for (const t of tris) {
    const [a, b, c] = t.p;
    if (Math.max(a[1], b[1], c[1]) - Math.min(a[1], b[1], c[1]) > 0.001) continue;
    const up = (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]);
    if (Math.abs(up) < 1e-9) continue;
    const [mx, mz] = [(a[0] + b[0] + c[0]) / 3, (a[2] + b[2] + c[2]) / 3];
    if (mx < x0 || mx > x1 || mz < z0 || mz > z1) continue;
    const y = Math.round(a[1] * 1000);
    if (up < 0) (downAt.get(y) ?? downAt.set(y, []).get(y)!).push(t.p);
    else (byY.get(y) ?? byY.set(y, []).get(y)!).push({ ...t, area: up / 2 });
  }
  const out = new Set<number>();
  const off = cell * 0.0137;
  const nx = Math.ceil((x1 - x0) / cell) + 1;
  // a triangle's cells: those whose middles are in it
  const cellsIn = (p: number[][]): number[] => {
    const [a, b, c] = p;
    const side = (px: number, pz: number, q: number[], r: number[]) => (q[0] - px) * (r[2] - pz) - (r[0] - px) * (q[2] - pz);
    const i0 = Math.max(0, Math.floor((Math.min(a[0], b[0], c[0]) - x0) / cell)), i1 = Math.min(nx - 1, Math.ceil((Math.max(a[0], b[0], c[0]) - x0) / cell));
    const j0 = Math.max(0, Math.floor((Math.min(a[2], b[2], c[2]) - z0) / cell)), j1 = Math.ceil((Math.max(a[2], b[2], c[2]) - z0) / cell);
    const ks: number[] = [];
    for (let j = j0; j <= j1; j++)
      for (let i = i0; i <= i1; i++) {
        const [px, pz] = [x0 + (i + 0.5) * cell + off, z0 + (j + 0.5) * cell + off];
        const s1 = side(px, pz, a, b), s2 = side(px, pz, b, c), s3 = side(px, pz, c, a);
        if ((s1 > 0 && s2 > 0 && s3 > 0) || (s1 < 0 && s2 < 0 && s3 < 0)) ks.push(j * nx + i);
      }
    return ks;
  };
  for (const [y, list] of byY) {
    const area = new Map<string, number>();
    for (const t of list) area.set(t.mat, (area.get(t.mat) ?? 0) + t.area);
    const down = new Set<number>();
    for (const p of downAt.get(y) ?? []) for (const k of cellsIn(p)) down.add(k);
    if (area.size < 2 && !down.size) continue;
    // each triangle's cells, and each cell's materials
    const cellsOf = list.map((t) => cellsIn(t.p));
    const mats = new Map<number, Set<string>>();
    list.forEach((t, n) => {
      for (const k of cellsOf[n]) (mats.get(k) ?? mats.set(k, new Set()).get(k)!).add(t.mat);
    });
    list.forEach((t, n) => {
      const mine = area.get(t.mat)!;
      const ks = cellsOf[n];
      if (ks.length && ks.every((k) => down.has(k) || [...mats.get(k)!].some((m) => m !== t.mat && area.get(m)! > mine))) out.add(t.key);
    });
  }
  return out;
}
