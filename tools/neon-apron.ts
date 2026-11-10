// The plaza's apron (neonmap.json rules.dress.plaza.apron, Milestone 1110), shared by the bake (tools/import-neon.ts: the
// centre's street surface) and the map check. The centre's twenty-second reviews, both, of picture 06: "the plaza floor
// smeared, the foreground empty", "a paving pattern in place of the smeared flat floor", "a paving pattern with inlaid light
// lines". That picture's camera stands on the Loop's carriageway, and the floor it sees from 2.4 m to the Sky Ring's shade is
// the Loop's asphalt, not the plaza's tiles: so the Loop, the ring road round the tower's plaza, is paved as the plaza's apron.
// Its carriageway, kerb to kerb, in the pavers of the plaza, the Sky Ring's deck and the base's floor (`field`), with a
// pattern of the court's pale flags (`band`): a band round its middle (`ring`, over its painted middle line) and `bands.n`
// bands across it radiating from the tower (`bands.w` wide, the first `bands.from` degrees from +x toward +z), off the four
// axes (the Loop's crossings) and the four forks; and light strips inlaid in the pavers either side of each radial band
// (`strip`), in a light the centre already draws. Every material is one the centre's file draws already, so no primitive
// more. The eight streets off it keep their asphalt from the outer kerb's circle on.
import type { Pt } from "./neon-streets";

export type Apron = {
  /** the carriageway's inner and outer edges, metres from the tower's middle (the Loop's, apronOf) */
  r: [number, number];
  field: string;
  band: string;
  ring: [number, number];
  bands: { n: number; from: number; w: number };
  /** metres of ground a texture repeat, as the ground's tiles are mapped (a tenth of a texture a metre) */
  every: number;
  strip: { mat: string; w: number; off: number; up: number; runs: number[][] };
};
export type Prim = { pos: Float32Array; nrm: Float32Array; uv: Float32Array; idx: Uint32Array; material: string };

const RAD = Math.PI / 180;

/** the apron's rules with its edges, the Loop's carriageway's (rules.streets.curves: loop.r either side by half the road), or
 * null when the map has none */
export function apronOf(rules: { dress: unknown; streets: { curves: { road: number; loop: { r: number } } } }): Apron | null {
  const A = (rules.dress as { plaza?: { apron?: Omit<Apron, "r"> } }).plaza?.apron;
  const CV = rules.streets.curves;
  return A ? { ...A, r: [CV.loop.r - CV.road / 2, CV.loop.r + CV.road / 2] } : null;
}

/** each radial band's bearing, degrees from +x toward +z */
export function apronBearings(A: Apron): number[] {
  return Array.from({ length: A.bands.n }, (_, k) => A.bands.from + (k * 360) / A.bands.n);
}

/** which part of the apron a point is in: a radial band's index, "ring" (the band round its middle), "field", or null when
 * off the apron (past its outer edge: the eight streets' asphalt) */
export function apronPart(A: Apron, x: number, z: number): number | "ring" | "field" | null {
  const r = Math.hypot(x, z);
  if (r > A.r[1]) return null;
  if (r >= A.ring[0] && r <= A.ring[1]) return "ring";
  const B = apronBearings(A);
  for (let k = 0; k < B.length; k++) {
    const [c, s] = [Math.cos(B[k] * RAD), Math.sin(B[k] * RAD)];
    if (x * c + z * s > 0 && Math.abs(-x * s + z * c) <= A.bands.w / 2) return k;
  }
  return "field";
}

type Poly = Pt[];
/** a convex polygon cut along f = 0 (f's crossing on each edge found by halving: a circle's edge is no line) */
function cut(p: Poly, f: (x: number, z: number) => number): Poly[] {
  const v = p.map(([x, z]) => f(x, z));
  if (v.every((q) => q >= 0) || v.every((q) => q <= 0)) return [p];
  const [neg, pos]: [Poly, Poly] = [[], []];
  for (let i = 0; i < p.length; i++) {
    const j = (i + 1) % p.length;
    const [a, b] = [p[i], p[j]];
    if (v[i] <= 0) neg.push(a);
    if (v[i] >= 0) pos.push(a);
    if ((v[i] < 0 && v[j] > 0) || (v[i] > 0 && v[j] < 0)) {
      let [lo, hi] = [0, 1];
      for (let n = 0; n < 40; n++) {
        const m = (lo + hi) / 2;
        const fm = f(a[0] + (b[0] - a[0]) * m, a[1] + (b[1] - a[1]) * m);
        if (Math.sign(fm) === Math.sign(v[i])) lo = m;
        else hi = m;
      }
      const t = (lo + hi) / 2;
      const q: Pt = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
      neg.push(q);
      pos.push(q);
    }
  }
  return [neg, pos].filter((q) => q.length >= 3);
}

/**
 * The street surface (tools/neon-streets.ts fieldSurface: x z map-local, y up, wound to face up) cut along the apron's
 * edges and its pattern's, as one prim a material: the eight streets past the outer kerb's circle in `road` as before, the
 * apron's field and bands in theirs. The surface's runs are first cut into half-metre cells, so a cell's edge crosses a
 * circle once. The field mapped as the ground's tiles are (world x z over `every`); a radial band
 * along its own line, a flag's middle down its middle; the ring band round the circle, a whole number of repeats round it
 */
export function apronSurface(pos: number[], idx: number[], A: Apron, road: string, roadEvery: number): Prim[] {
  const y = pos[1] ?? 0;
  const B = apronBearings(A);
  const out = new Map<string, { pos: number[]; uv: number[]; idx: number[] }>();
  const ringN = Math.max(1, Math.round((2 * Math.PI * (A.ring[0] + A.ring[1])) / 2 / A.every));
  const emit = (p: Poly) => {
    // (a sliver a cut leaves along an edge it grazed, no area, left out)
    let area = 0;
    for (let k = 0; k < p.length; k++) area += p[k][0] * p[(k + 1) % p.length][1] - p[(k + 1) % p.length][0] * p[k][1];
    if (Math.abs(area) < 1e-6) return;
    const [cx, cz] = [p.reduce((s, q) => s + q[0], 0) / p.length, p.reduce((s, q) => s + q[1], 0) / p.length];
    const part = apronPart(A, cx, cz);
    const mat = part === null ? road : part === "field" ? A.field : A.band;
    const o = out.get(mat) ?? out.set(mat, { pos: [], uv: [], idx: [] }).get(mat)!;
    const base = o.pos.length / 3;
    // (the ring band's angle from the polygon's middle, so a polygon at the circle's seam does not wrap across it)
    const a0 = Math.atan2(cz, cx);
    for (const [x, z] of p) {
      o.pos.push(x, y, z);
      if (part === null) o.uv.push(x / roadEvery, z / roadEvery);
      else if (part === "field") o.uv.push(x / A.every, z / A.every);
      else if (part === "ring") {
        let a = Math.atan2(z, x);
        if (a - a0 > Math.PI) a -= 2 * Math.PI;
        if (a0 - a > Math.PI) a += 2 * Math.PI;
        o.uv.push((a / (2 * Math.PI)) * ringN, (Math.hypot(x, z) - A.ring[0] + (A.every / 4 - (A.ring[1] - A.ring[0])) / 2) / A.every);
      } else {
        const [c, s] = [Math.cos(B[part] * RAD), Math.sin(B[part] * RAD)];
        o.uv.push((x * c + z * s) / A.every, (-x * s + z * c + A.every / 8) / A.every);
      }
    }
    // (fanned from its first corner, a fan triangle along a cut's straight run of corners left out: it has no area)
    for (let k = 1; k + 1 < p.length; k++) {
      const [a, b, c] = [p[0], p[k], p[k + 1]];
      if (Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])) > 1e-9) o.idx.push(base, base + k, base + k + 1);
    }
  };
  for (let t = 0; t + 2 < idx.length; t += 3) {
    let polys: Poly[] = [[0, 1, 2].map((k) => [pos[idx[t + k] * 3], pos[idx[t + k] * 3 + 2]] as Pt)];
    const xs = polys[0].map((q) => q[0]), zs = polys[0].map((q) => q[1]);
    // (every triangle into half-metre cells on the one grid, across x and then along z, the far streets' too: two triangles
    // that share an edge are cut at the same points along it, so no cut leaves a vertex on one side of an edge alone)
    for (let gx = Math.ceil(Math.min(...xs) / 0.5) * 0.5; gx < Math.max(...xs); gx += 0.5) polys = polys.flatMap((p) => cut(p, (x) => x - gx));
    for (let gz = Math.ceil(Math.min(...zs) / 0.5) * 0.5; gz < Math.max(...zs); gz += 0.5) polys = polys.flatMap((p) => cut(p, (_x, z) => z - gz));
    polys = polys.flatMap((p) => cut(p, (x, z) => Math.hypot(x, z) - A.r[1]));
    for (const R of A.ring) polys = polys.flatMap((p) => cut(p, (x, z) => Math.hypot(x, z) - R));
    // (each cell by the edges of the radial bands near it: a band's edge is a line through the tower's middle, so a cell on the
    // far side of it is left alone)
    polys = polys.flatMap((p) => {
      const [cx, cz] = [p.reduce((q, v) => q + v[0], 0) / p.length, p.reduce((q, v) => q + v[1], 0) / p.length];
      const at = Math.atan2(cz, cx) / RAD;
      let ps = [p];
      for (const b of B) {
        if (Math.abs(((at - b + 540) % 360) - 180) > 4) continue;
        const [c, s] = [Math.cos(b * RAD), Math.sin(b * RAD)];
        for (const e of [-A.bands.w / 2, A.bands.w / 2]) ps = ps.flatMap((q) => cut(q, (x, z) => -x * s + z * c - e));
      }
      return ps;
    });
    polys.forEach(emit);
  }
  return [...out.entries()].map(([material, o]) => {
    const nrm = new Float32Array(o.pos.length);
    for (let k = 1; k < nrm.length; k += 3) nrm[k] = 1;
    return { pos: new Float32Array(o.pos), nrm, uv: new Float32Array(o.uv), idx: new Uint32Array(o.idx), material };
  });
}

/** each light strip's line: [bearing, its offset off the band's middle line, from, to] (metres from the tower's middle) */
export function apronStripLines(A: Apron): number[][] {
  const e = A.bands.w / 2 + A.strip.off;
  return apronBearings(A).flatMap((b) => [-e, e].flatMap((o) => A.strip.runs.map(([a0, a1]) => [b, o, a0, a1])));
}

/** the light strips inlaid in the pavers either side of each radial band, `off` metres out from its edge: a quad `w` wide
 * on each of `runs` [from, to] along it, `up` over the surface at `y`, wound to face up as the surface is */
export function apronStrips(A: Apron, y: number): Prim {
  const pos: number[] = [], uv: number[] = [], idx: number[] = [];
  const h = A.strip.w / 2;
  for (const [b, o, a0, a1] of apronStripLines(A)) {
    const [c, s] = [Math.cos(b * RAD), Math.sin(b * RAD)];
    const base = pos.length / 3;
    for (const [t, e] of [[a0, o - h], [a1, o - h], [a1, o + h], [a0, o + h]] as const) {
      pos.push(t * c - e * s, y + A.strip.up, t * s + e * c);
      uv.push((t - a0) / (a1 - a0), e > o ? 1 : 0);
    }
    idx.push(base, base + 2, base + 1, base, base + 3, base + 2);
  }
  const nrm = new Float32Array(pos.length);
  for (let k = 1; k < nrm.length; k += 3) nrm[k] = 1;
  return { pos: new Float32Array(pos), nrm, uv: new Float32Array(uv), idx: new Uint32Array(idx), material: A.strip.mat };
}
