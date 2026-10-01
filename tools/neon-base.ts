// The base's floors (rules.base, tools/neon-layout.ts writes cfg.base): each storey's slab filled from the base's
// outline in to whatever already stands there (the tower's own floors and walls, the court's rim, the metro's kiosks),
// less its holes (each stair's well, the atria over the kiosks and the glass hall), worn as the pack's FloorBasic00 wears
// its faces. What already stands there is measured off its own triangles a cell at a time, never typed: the tower's
// storeys are each a different shape, and the base's floors meet every one of them.
import { fieldSurface, contours, type Pt } from "./neon-streets";

export type Poly = Pt[];
type Part = { pos: number[]; uv: number[]; nrm: number[]; idx: number[] };

/** signed distance from (x, z) to a simple polygon's edge, negative inside (even-odd) */
export function sdPoly(p: Poly, x: number, z: number): number {
  let d = Infinity;
  let inside = false;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
    const [ax, az] = p[j];
    const [bx, bz] = p[i];
    const [ex, ez] = [bx - ax, bz - az];
    const t = Math.max(0, Math.min(1, ((x - ax) * ex + (z - az) * ez) / (ex * ex + ez * ez || 1)));
    d = Math.min(d, Math.hypot(x - ax - ex * t, z - az - ez * t));
    if (az > z !== bz > z && x < ((bx - ax) * (z - az)) / (bz - az) + ax) inside = !inside;
  }
  return inside ? -d : d;
}

/** a grid of cells over a box: [x0, z0] its corner, `cell` metres a side, nx by nz */
export type Grid = { x0: number; z0: number; cell: number; nx: number; nz: number };

/**
 * The cells something already stands in at a storey: every triangle with any of itself between `y0` and `y1` marks the
 * cells it passes over (sampled at half a cell, so a wall seen edge on, a line from above, marks its own cells too)
 */
export function standing(g: Grid, tris: Iterable<[number[], number[], number[]]>, y0: number, y1: number): Uint8Array {
  const m = new Uint8Array(g.nx * g.nz);
  const mark = (x: number, z: number) => {
    const i = Math.floor((x - g.x0) / g.cell), j = Math.floor((z - g.z0) / g.cell);
    if (i >= 0 && i < g.nx && j >= 0 && j < g.nz) m[j * g.nx + i] = 1;
  };
  for (const [a, b, c] of tris) {
    if (Math.max(a[1], b[1], c[1]) < y0 || Math.min(a[1], b[1], c[1]) > y1) continue;
    const L = Math.max(Math.hypot(b[0] - a[0], b[2] - a[2]), Math.hypot(c[0] - a[0], c[2] - a[2]), Math.hypot(c[0] - b[0], c[2] - b[2]));
    const n = Math.max(1, Math.ceil(L / (g.cell / 2)));
    for (let i = 0; i <= n; i++)
      for (let j = 0; j <= n - i; j++) mark(a[0] + ((b[0] - a[0]) * i + (c[0] - a[0]) * j) / n, a[2] + ((b[2] - a[2]) * i + (c[2] - a[2]) * j) / n);
  }
  return m;
}

/**
 * A storey's slab: where `region` (negative inside) holds, less the holes, less what already stands there (`stood`,
 * cells: the slab is taken a cell short of it, so its edge tucks under the walls and floors it meets instead of leaving
 * a crack beside them), its top at `top`, `thick` deep; its top and underside mapped by the metre over the ground and its
 * edges along their length and down, `scale` of the texture a metre (FloorBasic00's 10 m tile is one texture across)
 */
export function storeySlab(g: Grid, region: (x: number, z: number) => number, holes: Poly[], stood: Uint8Array | null, top: number, thick: number, scale: number): Record<"top" | "under" | "edge", Part> {
  // what stands there, a cell in from its edge: a corner of the grid is under it when all four cells round it are
  const corner = new Uint8Array((g.nx + 1) * (g.nz + 1));
  if (stood) {
    const at = (i: number, j: number) => i >= 0 && i < g.nx && j >= 0 && j < g.nz && stood[j * g.nx + i] === 1;
    const kept = (i: number, j: number) => at(i, j) && at(i - 1, j) && at(i + 1, j) && at(i, j - 1) && at(i, j + 1);
    for (let j = 0; j <= g.nz; j++) for (let i = 0; i <= g.nx; i++) corner[j * (g.nx + 1) + i] = kept(i - 1, j - 1) && kept(i, j - 1) && kept(i - 1, j) && kept(i, j) ? 1 : 0;
  }
  const value = (x: number, z: number): number => {
    let v = region(x, z);
    for (const h of holes) v = Math.max(v, -sdPoly(h, x, z));
    if (stood) {
      const i = Math.round((x - g.x0) / g.cell), j = Math.round((z - g.z0) / g.cell);
      const under = i >= 0 && i <= g.nx && j >= 0 && j <= g.nz && corner[j * (g.nx + 1) + i] === 1;
      v = Math.max(v, under ? g.cell / 2 : -g.cell / 2);
    }
    return v;
  };
  const [x1, z1] = [g.x0 + g.nx * g.cell, g.z0 + g.nz * g.cell];
  const part = (): Part => ({ pos: [], uv: [], nrm: [], idx: [] });
  const out = { top: part(), under: part(), edge: part() };
  const surf = fieldSurface(value, g.x0, x1, g.z0, z1, g.cell, top);
  for (const [p, y, ny] of [[out.top, top, 1], [out.under, top - thick, -1]] as const) {
    for (let k = 0; k < surf.pos.length; k += 3) {
      p.pos.push(surf.pos[k], y, surf.pos[k + 2]);
      p.uv.push(surf.pos[k] * scale, surf.pos[k + 2] * scale);
      p.nrm.push(0, ny, 0);
    }
    // (the surface's triangles face up: the underside's are turned over)
    for (let k = 0; k < surf.idx.length; k += 3) p.idx.push(...(ny > 0 ? [surf.idx[k], surf.idx[k + 1], surf.idx[k + 2]] : [surf.idx[k], surf.idx[k + 2], surf.idx[k + 1]]));
  }
  // the edges: a face down from the top to the underside along every contour, facing away from the slab
  for (const line of contours(value, g.x0, x1, g.z0, z1, g.cell)) {
    const pts = line.closed ? [...line.pts, line.pts[0]] : line.pts;
    let run = 0;
    for (let k = 1; k < pts.length; k++) {
      const [a, b] = [pts[k - 1], pts[k]];
      const d = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (d < 1e-6) continue;
      let n: Pt = [(b[1] - a[1]) / d, -(b[0] - a[0]) / d];
      const mid: Pt = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      if (value(mid[0] + n[0] * 0.05, mid[1] + n[1] * 0.05) < value(mid[0] - n[0] * 0.05, mid[1] - n[1] * 0.05)) n = [-n[0], -n[1]];
      const p = out.edge;
      const base = p.pos.length / 3;
      for (const [q, y, u] of [[a, top, run], [b, top, run + d], [b, top - thick, run + d], [a, top - thick, run]] as const) {
        p.pos.push(q[0], y, q[1]);
        p.uv.push(u * scale, (top - y) * scale);
        p.nrm.push(n[0], 0, n[1]);
      }
      // (wound to face along n, counter-clockwise seen from there: a, b, b-down does when n is b-a turned toward -z from +x)
      const ccw = (b[0] - a[0]) * n[1] - (b[1] - a[1]) * n[0] < 0;
      p.idx.push(...(ccw ? [base, base + 1, base + 2, base, base + 2, base + 3] : [base, base + 2, base + 1, base, base + 3, base + 2]));
      run += d;
    }
  }
  return out;
}

/**
 * The cells inside a closed outline (a building's shell, `stood`), from a seed: the shell grown by `close` cells first
 * so a gap narrower than that between two of its pieces does not let the flood out, the inside grown back by `reach`
 * cells after so it meets the shell again (and runs a cell under it). Returns the inside and how many cells it has
 */
export function inside(g: Grid, stood: Uint8Array, seed: [number, number], close: number, reach: number): { cells: Uint8Array; n: number } {
  const at = (m: Uint8Array, i: number, j: number) => i >= 0 && i < g.nx && j >= 0 && j < g.nz && m[j * g.nx + i] === 1;
  const grow = (m: Uint8Array, k: number) => {
    let cur = m;
    for (let t = 0; t < k; t++) {
      const next = cur.slice();
      for (let j = 0; j < g.nz; j++) for (let i = 0; i < g.nx; i++) if (!cur[j * g.nx + i] && (at(cur, i - 1, j) || at(cur, i + 1, j) || at(cur, i, j - 1) || at(cur, i, j + 1))) next[j * g.nx + i] = 1;
      cur = next;
    }
    return cur;
  };
  const wall = grow(stood, close);
  const cells = new Uint8Array(g.nx * g.nz);
  const [si, sj] = [Math.floor((seed[0] - g.x0) / g.cell), Math.floor((seed[1] - g.z0) / g.cell)];
  if (at(wall, si, sj)) throw new Error(`the seed (${seed.join(", ")}) is in the shell`);
  const todo = [sj * g.nx + si];
  cells[todo[0]] = 1;
  let n = 1;
  while (todo.length) {
    const k = todo.pop()!;
    const [i, j] = [k % g.nx, Math.floor(k / g.nx)];
    for (const [a, b] of [[i + 1, j], [i - 1, j], [i, j + 1], [i, j - 1]]) {
      if (a < 0 || a >= g.nx || b < 0 || b >= g.nz) throw new Error("the flood left the grid: the shell is not closed");
      const q = b * g.nx + a;
      if (cells[q] || wall[q]) continue;
      cells[q] = 1;
      n++;
      todo.push(q);
    }
  }
  const out = grow(cells, close + reach);
  let m = 0;
  for (const v of out) m += v;
  return { cells: out, n: m };
}
