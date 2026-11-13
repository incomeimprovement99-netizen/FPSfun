// The map's gameplay numbers, measured off the bake's collision (docs/PLAN_MAP_TO_8.md): the space budget, street
// sightlines and free sprint runs, how much of the street the high ground sees, the roofs as islands, walls to run along.
// The fresh reviews score pictures; these numbers are what a body meets. They are proxies: no reach test, straight walls only.
// node tools/neon-mapstats.cjs  ->  mapstats.json and four pictures (heights, exposure, free runs, roof islands)
const fs = require("fs");
const sharp = require("sharp");
// (the map's own files by default; a snapshot folder holding neonmap.json and neonmap.solids.json as SNAP, the pictures and
// mapstats.json to OUT or the working folder)
const path = require("path");
const ROOT = path.join(__dirname, "..");
const SNAP = process.env.SNAP ? process.env.SNAP.replace(/[\/]?$/, "/") : null;
const FILE = (n) => (SNAP ? SNAP + n : path.join(ROOT, "src", "config", n === "neonmap.solids.json" ? "neon/neonmap.solids.json" : n));
const OUT = (process.env.OUT ?? process.cwd()).replace(/[\/]?$/, "/");
const S = JSON.parse(fs.readFileSync(FILE("neonmap.solids.json"), "utf8")).solids.filter((b) => b[2] < 160 && b[3] > -160);
const R = 150; // the play square's half side (the fence)
// the world's floor (src/game/neonmap.ts): 0 everywhere but the court, its halls and the underground's rects, lowered to
// their own; the street's slab over a hall and the station where the config names one
{
  const C = JSON.parse(fs.readFileSync(FILE("neonmap.json"), "utf8"));
  const K = C.court, UG = C.underground ?? { floors: [], slabs: [] };
  const floors = [[K.x0, K.x1, K.z0, K.z1, K.y], ...K.halls.map((h) => [h.x0, h.x1, h.z0, h.z1, K.y]), ...UG.floors.map((f) => [...f.rect, f.y])];
  const slabs = [...K.halls.map((h) => h.slab), ...UG.slabs];
  for (let x = -R; x < R; x++) for (let z = -R; z < R; z++) {
    const [cx, cz] = [x + 0.5, z + 0.5];
    const f = floors.find(([x0, x1, z0, z1]) => cx > x0 && cx < x1 && cz > z0 && cz < z1);
    S.push([x, x + 1, z, z + 1, (f ? f[4] : 0) - 0.3, f ? f[4] : 0]);
    if (f && slabs.some(([x0, x1, z0, z1]) => cx > x0 && cx < x1 && cz > z0 && cz < z1)) S.push([x, x + 1, z, z + 1, -0.3, 0]);
  }
}
const out = {};

// ---------- 1 m columns with their exact boxes ----------
const N1 = 2 * R;
const cols = Array.from({ length: N1 * N1 }, () => null);
for (const b of S) {
  const i0 = Math.max(0, Math.ceil(b[0] + R - 0.5)), i1 = Math.min(N1 - 1, Math.floor(b[1] + R - 0.5));
  const j0 = Math.max(0, Math.ceil(b[2] + R - 0.5)), j1 = Math.min(N1 - 1, Math.floor(b[3] + R - 0.5));
  for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) (cols[i * N1 + j] ??= []).push(b);
}
// a column's standable levels: [top, roofed (something over it within 10 m), headroom]
const levels = new Array(N1 * N1);
for (let k = 0; k < N1 * N1; k++) {
  const bs = cols[k];
  const lv = [];
  if (bs) {
    const tops = [...new Set(bs.map((b) => b[5]))].sort((a, b) => a - b);
    for (const t of tops) {
      let clear = Infinity;
      let inside = false;
      for (const b of bs) {
        if (b[4] < t - 0.01 && b[5] > t + 0.01) { inside = true; break; }
        if (b[4] >= t - 0.01 && b[5] > t + 0.01) clear = Math.min(clear, b[4] - t);
      }
      if (inside || clear < 1.8) continue;
      lv.push([t, clear < 10 ? 1 : 0, clear]);
    }
  }
  levels[k] = lv;
}
const at = (i, j) => (i < 0 || j < 0 || i >= N1 || j >= N1 ? [] : levels[i * N1 + j]);
const xz = (i, j) => [i - R + 0.5, j - R + 0.5];
const zoneOf = (x, z) => (Math.max(Math.abs(x), Math.abs(z)) <= 50 ? "centre sector (the tower, plaza, Loop)" : Math.max(Math.abs(x), Math.abs(z)) <= 100 ? "inner ring (High City, corner blocks)" : "outer band (the eight districts)");

// ---------- A. the space budget ----------
{
  const z = {};
  for (let i = 0; i < N1; i++) for (let j = 0; j < N1; j++) {
    const [x, y] = xz(i, j);
    const k = zoneOf(x, y);
    const o = (z[k] ??= { cells: 0, mass: 0, streetOpen: 0, streetRoofed: 0, indoorUp: 0, roofOpen: 0, under: 0 });
    o.cells++;
    const lv = at(i, j);
    const street = lv.find((q) => q[0] > -0.6 && q[0] <= 0.4);
    if (!street) {
      // nothing to stand on at street level: a building's or a wall's mass, or a raised floor (the terraces)
      if (!lv.some((q) => q[0] > 0.4 && q[0] < 2.5)) o.mass++;
    } else street[1] ? o.streetRoofed++ : o.streetOpen++;
    for (const q of lv) {
      if (q[0] <= -1) o.under++;
      else if (q[0] >= 2.5) q[1] ? o.indoorUp++ : o.roofOpen++;
    }
  }
  out.space = z;
}

// ---------- the 0.5 m voxels (any overlap fills) ----------
const V = 0.5, X0 = -155, Y0 = -14, NX = 620, NY = 180, NZ = 620; // to 76 m up
const vox = new Uint8Array(NX * NY * NZ);
for (const b of S) {
  const i0 = Math.max(0, Math.floor((b[0] - X0) / V + 1e-6)), i1 = Math.min(NX - 1, Math.ceil((b[1] - X0) / V - 1e-6) - 1);
  const k0 = Math.max(0, Math.floor((b[2] - X0) / V + 1e-6)), k1 = Math.min(NZ - 1, Math.ceil((b[3] - X0) / V - 1e-6) - 1);
  const j0 = Math.max(0, Math.floor((b[4] - Y0) / V + 1e-6)), j1 = Math.min(NY - 1, Math.ceil((b[5] - Y0) / V - 1e-6) - 1);
  for (let i = i0; i <= i1; i++) for (let k = k0; k <= k1; k++) { const base = (i * NZ + k) * NY; for (let j = j0; j <= j1; j++) vox[base + j] = 1; }
}
const solid = (x, y, z) => {
  const i = Math.floor((x - X0) / V), j = Math.floor((y - Y0) / V), k = Math.floor((z - X0) / V);
  if (i < 0 || k < 0 || i >= NX || k >= NZ || j < 0) return 2; // off the map
  if (j >= NY) return 0;
  return vox[(i * NZ + k) * NY + j];
};
// the distance a ray runs before something solid, to `far`
const run = (x, y, z, dx, dy, dz, far, step = 0.25) => {
  for (let d = step; d <= far; d += step) if (solid(x + dx * d, y + dy * d, z + dz * d)) return d;
  return far;
};
const los = (a, b) => {
  const d = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
  const u = [(b[0] - a[0]) / d, (b[1] - a[1]) / d, (b[2] - a[2]) / d];
  for (let t = 0.6; t < d - 0.6; t += 0.4) if (solid(a[0] + u[0] * t, a[1] + u[1] * t, a[2] + u[2] * t)) return false;
  return true;
};

// ---------- street samples (every 4 m) ----------
const street = [];
for (let i = 2; i < N1; i += 4) for (let j = 2; j < N1; j += 4) {
  const q = at(i, j).find((q) => q[0] > -0.6 && q[0] <= 0.4);
  if (q) { const [x, z] = xz(i, j); street.push({ x, y: q[0], z, roofed: q[1], zone: zoneOf(x, z) }); }
}
const pct = (a, p) => { const s = [...a].sort((u, v) => u - v); return s.length ? +s[Math.min(s.length - 1, Math.floor(p * s.length))].toFixed(1) : 0; };
const DIRS = Array.from({ length: 48 }, (_, k) => [Math.cos((k / 48) * 2 * Math.PI), Math.sin((k / 48) * 2 * Math.PI)]);
// ---------- B. sightlines at a standing eye, and free runs at shin-to-hip height ----------
{
  const z = {};
  for (const p of street) {
    const eye = DIRS.map(([dx, dz]) => run(p.x, p.y + 1.6, p.z, dx, 0, dz, 150));
    // (a run: the way is clear at 0.75 m and at 1.5 m, so nothing to vault or stop against)
    const low = DIRS.map(([dx, dz]) => Math.min(run(p.x, p.y + 0.75, p.z, dx, 0, dz, 80), run(p.x, p.y + 1.5, p.z, dx, 0, dz, 80)));
    p.longest = Math.max(...eye);
    p.mean = eye.reduce((a, b) => a + b, 0) / eye.length;
    p.over50 = eye.filter((d) => d >= 50).length / eye.length;
    p.runBest = Math.max(...low);
    p.runMean = low.reduce((a, b) => a + b, 0) / low.length;
    const o = (z[p.zone] ??= { n: 0, longest: [], mean: [], over50: [], runBest: [], runMean: [] });
    o.n++; o.longest.push(p.longest); o.mean.push(p.mean); o.over50.push(p.over50); o.runBest.push(p.runBest); o.runMean.push(p.runMean);
  }
  out.street = Object.fromEntries(Object.entries(z).map(([k, o]) => [k, {
    samples: o.n,
    longestSight_median: pct(o.longest, 0.5), longestSight_p90: pct(o.longest, 0.9),
    meanSight_median: pct(o.mean, 0.5),
    shareOfSpotsWithA60mLine: +(o.longest.filter((d) => d >= 60).length / o.n).toFixed(2),
    shareOfSpotsWithA100mLine: +(o.longest.filter((d) => d >= 100).length / o.n).toFixed(2),
    bestFreeRun_median: pct(o.runBest, 0.5), bestFreeRun_p25: pct(o.runBest, 0.25),
    meanFreeRun_median: pct(o.runMean, 0.5),
  }]));
}

// ---------- C. what the high ground sees ----------
const high = [];
for (let i = 2; i < N1; i += 5) for (let j = 2; j < N1; j += 5) for (const q of at(i, j)) if (q[0] >= 6 && q[0] <= 60) { const [x, z] = xz(i, j); high.push({ x, y: q[0], z, roofed: q[1], sees: 0 }); }
{
  for (const p of street) p.seenBy = 0;
  const open = street.filter((p) => !p.roofed);
  for (const h of high) {
    for (const p of open) {
      const d = Math.hypot(h.x - p.x, h.z - p.z);
      if (d > 120 || d < 6) continue;
      if (los([h.x, h.y + 1.6, h.z], [p.x, p.y + 1.0, p.z])) { h.sees++; p.seenBy++; }
    }
  }
  const z = {};
  for (const p of open) { const o = (z[p.zone] ??= []); o.push(p.seenBy); }
  out.highGround = {
    highSpots: high.length, openStreetSpots: open.length,
    byZone: Object.fromEntries(Object.entries(z).map(([k, a]) => [k, { seenByNoHighSpot: +(a.filter((n) => n === 0).length / a.length).toFixed(2), seenBy10plus: +(a.filter((n) => n >= 10).length / a.length).toFixed(2), seenBy40plus: +(a.filter((n) => n >= 40).length / a.length).toFixed(2), median: pct(a, 0.5) }])),
    top: [...high].sort((a, b) => b.sees - a.sees).slice(0, 14).map((h) => ({ at: [h.x, +h.y.toFixed(1), h.z], inside: !!h.roofed, seesShareOfOpenStreet: +(h.sees / open.length).toFixed(2) })),
  };
}

// ---------- D. the roofs as islands ----------
{
  const H = 6;
  const id = new Int32Array(N1 * N1).fill(-1);
  const top = new Float32Array(N1 * N1);
  for (let i = 0; i < N1; i++) for (let j = 0; j < N1; j++) {
    const q = at(i, j).filter((q) => q[0] >= H && !q[1]).pop();
    if (q) top[i * N1 + j] = q[0]; else top[i * N1 + j] = -99;
  }
  const isl = [];
  for (let s = 0; s < N1 * N1; s++) {
    if (top[s] < H || id[s] >= 0) continue;
    const n = isl.length; const cells = [s]; id[s] = n;
    for (let c = 0; c < cells.length; c++) {
      const k = cells[c]; const i = Math.floor(k / N1), j = k % N1;
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const a = i + di, b = j + dj; if (a < 0 || b < 0 || a >= N1 || b >= N1) continue;
        const m = a * N1 + b;
        if (top[m] >= H && id[m] < 0 && Math.abs(top[m] - top[k]) <= 1.0) { id[m] = n; cells.push(m); }
      }
    }
    isl.push(cells);
  }
  const big = isl.map((cells, n) => ({ n, cells })).filter((q) => q.cells.length >= 40);
  const info = big.map(({ n, cells }) => {
    let sx = 0, sz = 0, sy = 0; for (const k of cells) { const [x, z] = xz(Math.floor(k / N1), k % N1); sx += x; sz += z; sy += top[k]; }
    // its rim: cells with a neighbour that is not of it
    const rim = cells.filter((k) => { const i = Math.floor(k / N1), j = k % N1; return [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([di, dj]) => { const a = i + di, b = j + dj; return a < 0 || b < 0 || a >= N1 || b >= N1 || id[a * N1 + b] !== n; }); });
    return { n, area: cells.length, at: [+(sx / cells.length).toFixed(0), +(sy / cells.length).toFixed(1), +(sz / cells.length).toFixed(0)], rim };
  });
  // the gap from each island to each other one near it: the nearest pair of rim cells
  const links = [];
  for (let a = 0; a < info.length; a++) for (let b = a + 1; b < info.length; b++) {
    const A = info[a], B = info[b];
    if (Math.hypot(A.at[0] - B.at[0], A.at[2] - B.at[2]) > 140) continue;
    let best = 1e9, dy = 0;
    for (let u = 0; u < A.rim.length; u += 2) { const ka = A.rim[u]; const ia = Math.floor(ka / N1), ja = ka % N1;
      for (let v = 0; v < B.rim.length; v += 2) { const kb = B.rim[v]; const d = Math.hypot(ia - Math.floor(kb / N1), ja - (kb % N1)); if (d < best) { best = d; dy = top[kb] - top[ka]; } } }
    if (best <= 30) links.push({ a: A.n, b: B.n, gap: +best.toFixed(1), rise: +dy.toFixed(1) });
  }
  const total = info.reduce((s, q) => s + q.area, 0);
  const sorted = [...info].sort((a, b) => b.area - a.area);
  // a leap: a sprint jump carries about 11 m level and a double jump about 20 m; up to 2.7 m of rise with the second jump
  const leap = (l) => l.gap >= 2 && l.gap <= 18 && Math.abs(l.rise) <= 2.7;
  const deg = new Map(); for (const l of links.filter(leap)) { deg.set(l.a, (deg.get(l.a) ?? 0) + 1); deg.set(l.b, (deg.get(l.b) ?? 0) + 1); }
  out.roofs = {
    openRoofArea_m2: total, islandsOver40m2: info.length,
    largest: sorted.slice(0, 8).map((q) => ({ at: q.at, area: q.area, shareOfRoofArea: +(q.area / total).toFixed(2) })),
    gapsUnder30m: links.length, leapableGaps_2to18m_riseUnder2_7: links.filter(leap).length,
    gapsTooClose_under2m: links.filter((l) => l.gap < 2).length,
    islandsWithNoLeap: info.filter((q) => !deg.has(q.n)).length,
    gapHistogram: [[2, 6], [6, 11], [11, 18], [18, 30]].map(([a, b]) => ({ from: a, to: b, n: links.filter((l) => l.gap >= a && l.gap < b).length })),
    heightBands: [[6, 12], [12, 20], [20, 30], [30, 60]].map(([a, b]) => ({ from: a, to: b, area: info.filter((q) => q.at[1] >= a && q.at[1] < b).reduce((s, q) => s + q.area, 0) })),
  };
  out._roofId = { id, top, info, deg };
}

// ---------- E. walls to run along ----------
{
  // a 0.5 m column is a wall if it is solid from 0.5 to 4.5 m; free if clear from 0.5 to 2 m
  const col = (i, k, y0, y1, want) => { const base = (i * NZ + k) * NY; for (let j = Math.floor((y0 - Y0) / V); j < Math.floor((y1 - Y0) / V); j++) if (!!vox[base + j] !== want) return false; return true; };
  const wall = new Uint8Array(NX * NZ), free = new Uint8Array(NX * NZ);
  for (let i = 10; i < NX - 10; i++) for (let k = 10; k < NZ - 10; k++) { wall[i * NZ + k] = col(i, k, 0.5, 4.5, true) ? 1 : 0; free[i * NZ + k] = col(i, k, 0.5, 2, false) ? 1 : 0; }
  const runs = [];
  for (const [di, dk, ai, ak] of [[1, 0, 0, 1], [-1, 0, 0, 1], [0, 1, 1, 0], [0, -1, 1, 0]]) {
    // the wall on side (di, dk) of a free cell; runs along (ai, ak)
    const seen = new Uint8Array(NX * NZ);
    for (let i = 10; i < NX - 10; i++) for (let k = 10; k < NZ - 10; k++) {
      const ok = (a, b) => free[a * NZ + b] && wall[(a + di) * NZ + (b + dk)];
      if (seen[i * NZ + k] || !ok(i, k)) continue;
      let n = 0, a = i, b = k;
      while (a > 9 && b > 9 && a < NX - 10 && b < NZ - 10 && ok(a, b)) { seen[a * NZ + b] = 1; n++; a += ai; b += ak; }
      if (n * V >= 6) runs.push({ len: n * V, x: X0 + (i + 0.5) * V, z: X0 + (k + 0.5) * V });
    }
  }
  const z = {};
  for (const r of runs) { const o = (z[zoneOf(r.x, r.z)] ??= { runs: 0, metres: 0, over15: 0 }); o.runs++; o.metres += r.len; if (r.len >= 15) o.over15++; }
  out._runs = runs;
  out.wallRun = { note: "straight walls 4 m and taller with a clear lane beside them, 6 m and longer", byZone: z, longest: runs.sort((a, b) => b.len - a.len).slice(0, 6) };
}

// ---------- F. the inner ring by quarter ----------
// (a quarter rebuilt as a trial is read against the other three: north is -z and east +x, so NE is x > 0, z < 0)
{
  const inRing = (x, z) => { const m = Math.max(Math.abs(x), Math.abs(z)); return m > 50 && m <= 100; };
  const qOf = (x, z) => (z < 0 ? "N" : "S") + (x > 0 ? "E" : "W");
  const Q = {};
  const get = (x, z) => (Q[qOf(x, z)] ??= { cells: 0, open: 0, roofed: 0, runMean: [], runBest: [], seen: [], roof: [0, 0, 0, 0], wall: 0, islands: 0, noLeap: 0 });
  const { top, info, deg } = out._roofId;
  for (let i = 0; i < N1; i++) for (let j = 0; j < N1; j++) {
    const [x, z] = xz(i, j);
    if (!inRing(x, z)) continue;
    const o = get(x, z);
    o.cells++;
    const st = at(i, j).find((q) => q[0] > -0.6 && q[0] <= 0.4);
    if (st) st[1] ? o.roofed++ : o.open++;
    const t = top[i * N1 + j];
    if (t >= 6) o.roof[t < 12 ? 0 : t < 20 ? 1 : t < 30 ? 2 : 3]++;
  }
  for (const p of street) if (inRing(p.x, p.z)) { const o = get(p.x, p.z); o.runMean.push(p.runMean); o.runBest.push(p.runBest); if (!p.roofed) o.seen.push(p.seenBy); }
  for (const r of out._runs) if (inRing(r.x, r.z)) get(r.x, r.z).wall += r.len;
  for (const q of info) if (inRing(q.at[0], q.at[2])) { const o = get(q.at[0], q.at[2]); o.islands++; if (!deg.has(q.n)) o.noLeap++; }
  delete out._runs;
  out.innerRingByQuarter = Object.fromEntries(Object.entries(Q).sort().map(([k, o]) => [k, {
    openStreet: +(o.open / o.cells).toFixed(2), streetUnderARoof: +(o.roofed / o.cells).toFixed(2),
    meanFreeRun_median: pct(o.runMean, 0.5), bestFreeRun_median: pct(o.runBest, 0.5),
    openSpotsSeenBy10plus: +(o.seen.filter((n) => n >= 10).length / o.seen.length).toFixed(2), openSpotsSeenBy40plus: +(o.seen.filter((n) => n >= 40).length / o.seen.length).toFixed(2),
    openRoof_m2: { "6to12": o.roof[0], "12to20": o.roof[1], "20to30": o.roof[2], over30: o.roof[3] },
    wallToRunAlong_m: Math.round(o.wall), roofIslands: o.islands, islandsWithNoLeap: o.noLeap,
  }]));
}

// ---------- pictures ----------
(async () => {
  const W = 2 * R * 2; // 0.5 m a pixel
  const img = Buffer.alloc(W * W * 3);
  const heat = Buffer.alloc(W * W * 3);
  for (let px = 0; px < W; px++) for (let pz = 0; pz < W; pz++) {
    const i = px + 10, k = pz + 10; const base = (i * NZ + k) * NY;
    let h = -99; for (let j = NY - 1; j >= 0; j--) if (vox[base + j]) { h = Y0 + (j + 1) * V; break; }
    const c = h <= 0.4 ? [38, 40, 46] : h <= 1.2 ? [150, 110, 60] : h <= 2.6 ? [230, 150, 50] : h <= 6 ? [90, 120, 170] : h <= 12 ? [70, 150, 190] : h <= 20 ? [80, 190, 170] : h <= 30 ? [150, 215, 150] : h <= 60 ? [235, 235, 200] : [255, 255, 255];
    const o = (pz * W + px) * 3; img[o] = c[0]; img[o + 1] = c[1]; img[o + 2] = c[2];
    const d = h <= 0.4 ? 30 : 58; heat[o] = d; heat[o + 1] = d; heat[o + 2] = d + 6;
  }
  const line = (buf, f) => { for (let t = 0; t < W; t++) for (const v of [100, 200, 400, 500]) f(buf, v, t); };
  line(img, (buf, v, t) => { for (const o of [(t * W + v) * 3, (v * W + t) * 3]) { buf[o] = 255; buf[o + 1] = 60; buf[o + 2] = 60; } });
  await sharp(img, { raw: { width: W, height: W, channels: 3 } }).png().toFile(OUT + "map-heights.png");
  // how exposed each open street spot is to the high ground
  const dot = (buf, x, z, c, r = 3) => { const cx = Math.round((x + R) * 2), cz = Math.round((z + R) * 2); for (let a = -r; a <= r; a++) for (let b = -r; b <= r; b++) { const px = cx + a, pz = cz + b; if (px < 0 || pz < 0 || px >= W || pz >= W) continue; const o = (pz * W + px) * 3; buf[o] = c[0]; buf[o + 1] = c[1]; buf[o + 2] = c[2]; } };
  for (const p of street) { if (p.roofed) { dot(heat, p.x, p.z, [70, 90, 160]); continue; } const n = p.seenBy; dot(heat, p.x, p.z, n === 0 ? [40, 170, 90] : n < 10 ? [170, 200, 70] : n < 40 ? [240, 170, 40] : [235, 60, 50]); }
  await sharp(heat, { raw: { width: W, height: W, channels: 3 } }).png().toFile(OUT + "map-exposure.png");
  const runs = Buffer.from(heat);
  for (let o = 0; o < runs.length; o++) runs[o] = heat[o] > 60 && heat[o] !== 58 ? runs[o] : heat[o];
  const flow = Buffer.alloc(W * W * 3);
  for (let o = 0; o < W * W; o++) { const d = img[o * 3] === 38 ? 30 : 58; flow[o * 3] = d; flow[o * 3 + 1] = d; flow[o * 3 + 2] = d + 6; }
  for (const p of street) { const n = p.runBest; dot(flow, p.x, p.z, n >= 40 ? [60, 200, 240] : n >= 20 ? [90, 200, 120] : n >= 10 ? [240, 190, 60] : [230, 70, 60]); }
  await sharp(flow, { raw: { width: W, height: W, channels: 3 } }).png().toFile(OUT + "map-freerun.png");
  // the roof islands, each its own colour
  const { id, top, info } = out._roofId; delete out._roofId;
  const isl = Buffer.alloc(W * W * 3);
  const big = new Map(info.map((q, n) => [q.n, n]));
  for (let px = 0; px < W; px++) for (let pz = 0; pz < W; pz++) {
    const k = Math.floor(px / 2) * N1 + Math.floor(pz / 2); const o = (pz * W + px) * 3; const n = id[k];
    let c = img[o] === 38 ? [30, 30, 36] : [58, 58, 64];
    if (n >= 0 && big.has(n)) { const h = (big.get(n) * 67) % 360; const f = (m) => { const kk = (m + h / 60) % 6; return Math.round(255 * (0.85 - 0.6 * Math.max(0, Math.min(kk, 4 - kk, 1)))); }; c = [f(5), f(3), f(1)]; }
    isl[o] = c[0]; isl[o + 1] = c[1]; isl[o + 2] = c[2];
  }
  await sharp(isl, { raw: { width: W, height: W, channels: 3 } }).png().toFile(OUT + "map-roofs.png");
  fs.writeFileSync(OUT + "mapstats.json", JSON.stringify(out, null, 1));
  console.log(JSON.stringify(out, null, 1));
})();
