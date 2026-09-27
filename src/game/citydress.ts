// Where the city bundle's pieces go on the centre (docs/CITY_BUNDLE_IMPLEMENTATION.md sections 4.3 to 4.6, the rules
// in citykit.json dress): worked out from the city as built (city.ts KIT_SITES), after the build, from a hash of
// each place. Never from the city's random stream, which lays out every district after the centre too, and never
// with collision: the kit is how the city looks, the boxes are how it plays, so the city is the same whether or not
// the bought files are there. Pure data, so the checks run it in node without the files (tools/checks/citykit.ts).
import * as THREE from "three";
import kit from "../config/citykit.json";
import cityCfg from "../config/city.json";
import { CONCOURSE, KIT_SITES, PARK_BRIDGES } from "./city";
import { BR_X, BR_Z } from "./br";

export interface KitPlace {
  piece: string;
  /** map-local placement */
  m: THREE.Matrix4;
  /** the graphics tier from which it is drawn (quality.ts cityDetail) */
  tier: number;
  /** what it is, for the checks' clearances: facade and parapet stand flush, the rest stand out of a wall or stand free */
  kind: "facade" | "flat" | "band" | "car" | "podium" | "shop" | "parapet" | "cornice" | "sign" | "blade" | "poster" | "ac" | "billboard" | "roof" | "antenna" | "lamp" | "cable" | "pipe" | "wire" | "prop" | "skyline" | "zeppelin";
}

type Facing = "px" | "nx" | "pz" | "nz";
const MEASURED = kit.measured as unknown as Record<string, number[]>;
const FACING = kit.facing as unknown as Record<string, Facing>;
/** how far behind a piece's front its wall stands (import-city.ts measures it): its frames and cornices stand out of the building */
const PLANE = (kit as unknown as { plane: Record<string, number> }).plane ?? {};
export const planeOf = (id: string): number => PLANE[id] ?? 0;
/** a module's depth scale and how far its front stands out: its relief pressed into dress.relief, its wall on the face */
const relief = (id: string): { sz: number; out: number } => {
  const pl = planeOf(id);
  const sz = pl > D.relief ? D.relief / pl : 1;
  return { sz, out: D.outset + pl * sz };
};
const D = kit.dress;
const STOREY = cityCfg.storey;
/** the rotation about y that turns +z to face each way */
const ANGLE: Record<Facing, number> = { pz: 0, px: Math.PI / 2, nz: Math.PI, nx: -Math.PI / 2 };

/** a stable number in [0, 1) from a place and a purpose: the same on every client, from nothing but where */
export function kitHash(...n: number[]): number {
  let a = 0x9e3779b9 | 0;
  for (const v of n) {
    a ^= Math.imul(Math.round(v * 97) | 0, 0x85ebca6b);
    a = Math.imul(a ^ (a >>> 13), 0xc2b2ae35);
    a ^= a >>> 16;
  }
  return (a >>> 0) / 4294967296;
}
const pick = <T,>(list: readonly T[], r: number): T => list[Math.min(list.length - 1, Math.floor(r * list.length))];

/** a piece's size once turned to face +z: width along x, height, depth along z */
function dims(id: string): { w: number; h: number; d: number } | null {
  const m = MEASURED[id];
  if (!m) return null;
  const f = FACING[id] ?? "pz";
  const side = f === "px" || f === "nx";
  return { w: side ? m[2] : m[0], h: m[1], d: side ? m[0] : m[2] };
}
const T = new THREE.Matrix4();
const R = new THREE.Matrix4();
const S = new THREE.Matrix4();
/**
 * The matrix that takes a piece into its standing frame: facing +z, centred on x, its bottom at y = 0, and either
 * centred on z (`front` false) or with its front at z = 0 and the rest behind (`front` true, for a wall's face).
 */
function standing(id: string, front: boolean): THREE.Matrix4 | null {
  const m = MEASURED[id];
  if (!m) return null;
  const [w, h, d, mx, my, mz] = m;
  void h;
  const f = FACING[id] ?? "pz";
  const out = new THREE.Matrix4().makeTranslation(-(mx + w / 2), -my, -(mz + d / 2));
  out.premultiply(R.makeRotationY(-ANGLE[f]));
  if (front) out.premultiply(T.makeTranslation(0, 0, -(dims(id)!.d / 2)));
  return out;
}
/** a piece placed: at (x, y, z) map-local, turned `yaw` about y, scaled in its standing frame */
function place(id: string, x: number, y: number, z: number, yaw: number, sx: number, sy: number, sz: number, front: boolean): THREE.Matrix4 | null {
  const base = standing(id, front);
  if (!base) return null;
  return base.premultiply(S.makeScale(sx, sy, sz)).premultiply(R.makeRotationY(yaw)).premultiply(T.makeTranslation(x, y, z));
}

/** a face of a box: where it is, which way it looks, and how to walk along it */
interface Face {
  key: "n" | "s" | "w" | "e";
  /** outward normal */
  nx: number;
  nz: number;
  yaw: number;
  /** the plane: x for west and east faces, z for north and south */
  at: number;
  /** along the face: the other axis, from a to b */
  a: number;
  b: number;
}
function faces(x0: number, x1: number, z0: number, z1: number): Face[] {
  return [
    { key: "n", nx: 0, nz: -1, yaw: Math.PI, at: z0, a: x0, b: x1 },
    { key: "s", nx: 0, nz: 1, yaw: 0, at: z1, a: x0, b: x1 },
    { key: "w", nx: -1, nz: 0, yaw: -Math.PI / 2, at: x0, a: z0, b: z1 },
    { key: "e", nx: 1, nz: 0, yaw: Math.PI / 2, at: x1, a: z0, b: z1 },
  ];
}
/** a point on a face, `u` along it, `out` metres out of it */
function onFace(f: Face, u: number, out: number): [number, number] {
  return f.nx !== 0 ? [f.at + f.nx * out, u] : [u, f.at + f.nz * out];
}

/** the block a point is in, by column and row of the centre's 3 by 3 ("x,z"), and so its facade family */
function familyAt(x: number, z: number): keyof typeof D.rows {
  const c = (v: number) => (v < -36 ? 0 : v > 36 ? 2 : 1);
  return (D.families as Record<string, keyof typeof D.rows>)[`${c(x)},${c(z)}`] ?? "high";
}

export interface KitClear {
  /** the pads (map-local x, z) and the height they throw to */
  pads: Array<{ x: number; z: number; y: number; top: number }>;
}

/**
 * Every piece the centre wears, with the tier each is drawn from. `pads` are the city's jump pads (BrMap pads,
 * world metres), kept clear of anything that stands out of a wall.
 */
/**
 * The flying traffic (citykit.json dress traffic): each car's piece, its lane as a closed loop of corners (map-local),
 * where on the loop it starts (metres) and how fast it goes. Pure data; citykit.ts moves them.
 */
export function cityKitTraffic(): Array<{ piece: string; loop: Array<[number, number, number]>; length: number; start: number; speed: number; standing: THREE.Matrix4 | null }> {
  const out: ReturnType<typeof cityKitTraffic> = [];
  D.traffic.lanes.forEach((ln, li) => {
    const h = ln.half;
    // clockwise from above (y up, z south): north-west, north-east, south-east, south-west
    const cw: Array<[number, number, number]> = [
      [-h, ln.y, -h],
      [h, ln.y, -h],
      [h, ln.y, h],
      [-h, ln.y, h],
    ];
    const loop = ln.dir > 0 ? cw : [...cw].reverse();
    const length = 8 * h;
    for (let i = 0; i < ln.n; i++) {
      const piece = pick(D.traffic.cars, kitHash(li, i, 80));
      // standing, a car's long side faces +z: a quarter turn puts its length along the way it flies
      const f = FACING[piece] ?? "pz";
      const turn = f === "px" ? Math.PI / 2 : f === "nx" ? -Math.PI / 2 : 0;
      const st = standing(piece, false);
      out.push({ piece, loop, length, start: (i / ln.n) * length + kitHash(li, i, 81) * 6, speed: ln.speed, standing: st ? st.premultiply(new THREE.Matrix4().makeRotationY(turn)) : null });
    }
  });
  return out;
}

/** `lean`: the competitive preset's lighter modules (citykit.json dress lean), the same city in about half the triangles */
export function cityKitPlaces(padsWorld: ReadonlyArray<{ x: number; z: number; y?: number; up?: number }>, lean = false): KitPlace[] {
  const out: KitPlace[] = [];
  const add = (piece: string, m: THREE.Matrix4 | null, tier: number, kind: KitPlace["kind"]): void => {
    if (m) out.push({ piece, m, tier, kind });
  };
  const C = D.centre;
  const inCentre = (x: number, z: number) => Math.abs(x) <= C && Math.abs(z) <= C;
  const pads = padsWorld.map((p) => ({ x: p.x - BR_X, z: p.z - BR_Z }));
  const nearPad = (x: number, z: number, r = D.clear.pad) => pads.some((p) => Math.hypot(p.x - x, p.z - z) < r);
  const bridges = CONCOURSE.bridges.map((b) => ({ x: (b.a.x + b.b.x) / 2 - BR_X, z: (b.a.z + b.b.z) / 2 - BR_Z }));
  const nearBridge = (x: number, z: number) => bridges.some((b) => Math.hypot(b.x - x, b.z - z) < D.clear.bridge + 6);
  const inStair = (x: number, z: number, pad = D.clear.stair) => KIT_SITES.stairs.some((s) => x > s.x0 - pad && x < s.x1 + pad && z > s.z0 - pad && z < s.z1 + pad);
  /** where a Sky Park bridge meets a roof's edge (the Spire's terrace): its parapet is open there */
  const bridgeEnds = PARK_BRIDGES.flatMap((b) => [{ x: b.ax - BR_X, z: b.az - BR_Z, y: b.y }, { x: b.bx - BR_X, z: b.bz - BR_Z, y: b.y }]);
  const atBridgeEnd = (x: number, z: number, y: number) => bridgeEnds.some((e) => Math.abs(e.y - y) < 0.5 && Math.hypot(e.x - x, e.z - z) < 2.5);
  const towers = KIT_SITES.towers.filter((t) => inCentre(t.x, t.z));
  /** a face with another tower close in front of it: a canyon's, where nothing may stand out of the wall */
  const canyonFace = (t: (typeof towers)[number], f: Face): boolean =>
    towers.some((o) => {
      if (o === t) return false;
      const lat = f.nx !== 0 ? Math.min(t.z + t.d / 2, o.z + o.d / 2) - Math.max(t.z - t.d / 2, o.z - o.d / 2) : Math.min(t.x + t.w / 2, o.x + o.w / 2) - Math.max(t.x - t.w / 2, o.x - o.w / 2);
      if (lat <= 0) return false;
      const gap = f.nx !== 0 ? (f.nx > 0 ? o.x - o.w / 2 - f.at : f.at - (o.x + o.w / 2)) : f.nz > 0 ? o.z - o.d / 2 - f.at : f.at - (o.z + o.d / 2);
      return gap >= -0.1 && gap < D.canyon;
    });

  // the decks' heights (dress bands): a storey near one wears the full modules, one between them the lighter far row
  const decks = D.bands.decks.map((s) => cityCfg.kerb + s * STOREY);
  const nearDeck = (y: number): boolean => decks.some((dy) => y > dy - (D.bands.near + 0.5) * STOREY && y < dy + (D.bands.near - 0.5) * STOREY);

  // ------------------------------------------------ Neon Alley (city.json neonAlley, citykit.json dress alley)
  const NA = cityCfg.neonAlley;
  const A = D.alley;
  const streetLines = cityCfg.blocks.slice(0, -1).map((b, i) => (b[1] + cityCfg.blocks[i + 1][0]) / 2);
  const alleyZ = streetLines[NA.street];
  /** a face fronting the alley: looking at its street across the pavement, and along its stretch; the stretch it fronts */
  const alleyFace = (f: Face): [number, number] | null => {
    if (f.nx !== 0 || (alleyZ - f.at) * f.nz <= 0 || Math.abs(alleyZ - f.at) > A.front) return null;
    const a = Math.max(f.a, NA.from) + 1;
    const b = Math.min(f.b, NA.to) - 1;
    return b - a > 3 ? [a, b] : null;
  };

  // ------------------------------------------------ the towers' faces, storey by storey
  for (const t of towers) {
    const fam = familyAt(t.x, t.z);
    // its family's rows, or another of the family's styles (dress styles): neighbours of one family differ
    const styles = [D.rows[fam], ...((D.styles as Record<string, unknown[]>)[fam] ?? [])];
    const rows = pick(styles, kitHash(t.x, t.z, 90)) as { bay: number; ground: string[]; mid: string[]; top: string[]; far?: string[]; farBay?: number; cornice?: string };
    const spire = Math.abs(t.x) < 30 && Math.abs(t.z) < 30;
    for (const f of faces(t.x - t.w / 2, t.x + t.w / 2, t.z - t.d / 2, t.z + t.d / 2)) {
      const len = f.b - f.a;
      const n = Math.max(1, Math.round(len / rows.bay));
      const bay = len / n;
      const canyon = canyonFace(t, f);
      // a canyon's face, and the bays a pad throws you up past, wear flat panels: nothing stands out where you run
      const fn = Math.max(1, Math.round(len / 8));
      const fb = len / fn;
      const padBay = (u: number) => {
        const [px, pz] = onFace(f, u, 1.8);
        return nearPad(px, pz, bay / 2 + 1.5);
      };
      for (let s = 0; s < t.storeys; s++) {
        const y = t.base + s * STOREY;
        // the Sky Lobby's storey and the Sky Park's keep their own walls, so their windows stay open (the plan's rule 2)
        if ((t.lobby !== undefined && Math.abs(y - t.lobby) < 0.5) || (t.park !== undefined && Math.abs(y - t.park) < 0.5) || (t.floors ?? []).some((q) => Math.abs(y - q) < 0.5)) continue;
        if (canyon) {
          for (let i = 0; i < fn; i++) {
            const id = pick(D.flat, kitHash(t.x, t.z, s, i, 30));
            const dm = dims(id);
            if (!dm) continue;
            const r = relief(id);
            const [x, z] = onFace(f, f.a + (i + 0.5) * fb, r.out);
            add(id, place(id, x, y, z, f.yaw, fb / dm.w, STOREY / dm.h, r.sz, true), 0, "flat");
          }
          continue;
        }
        const leanMid = (D.lean.mid as Record<string, string[]>)[fam];
        const edge = s === 0 || s === t.storeys - 1;
        const far = !edge && !nearDeck(y) && !(lean && leanMid) && rows.far;
        const row = s === 0 ? rows.ground : s === t.storeys - 1 ? rows.top : lean && leanMid ? leanMid : far ? rows.far! : rows.mid;
        const id = pick(row, kitHash(t.x, t.z, s, 1));
        // a far row's bays are its own width
        const rn = far && rows.farBay ? Math.max(1, Math.round(len / rows.farBay)) : n;
        const rb = len / rn;
        // a door the city cut in this storey (the Spire's drop): the bays over it narrowed to the wall either side
        const [fx0, fz0] = onFace(f, f.a, -0.1);
        const [fx1, fz1] = onFace(f, f.b, 0.3);
        const doorHere = KIT_SITES.doors.find(
          (q) => Math.max(fx0, fx1) > q.x0 && Math.min(fx0, fx1) < q.x1 && Math.max(fz0, fz1) > q.z0 && Math.min(fz0, fz1) < q.z1 && q.y0 < y + STOREY - 0.05 && q.y1 > y + 0.05,
        );
        const [da, db] = doorHere ? (f.nx !== 0 ? [doorHere.z0, doorHere.z1] : [doorHere.x0, doorHere.x1]) : [Infinity, -Infinity];
        for (let i = 0; i < rn; i++) {
          const u = f.a + (i + 0.5) * rb;
          const spans = u + rb / 2 <= da || u - rb / 2 >= db ? [[u - rb / 2, u + rb / 2]] : [[u - rb / 2, da], [db, u + rb / 2]].filter(([a, b]) => b - a > 0.5);
          for (const [a, b] of spans) {
            const um = (a + b) / 2;
            const piece = padBay(um) ? pick(D.flat, kitHash(um, s, 31)) : id;
            const pd = dims(piece);
            if (!pd) continue;
            const r = relief(piece);
            const [x, z] = onFace(f, um, r.out);
            add(piece, place(piece, x, y, z, f.yaw, (b - a) / pd.w, STOREY / pd.h, r.sz, true), 0, piece === id ? "facade" : "flat");
          }
        }
        // up a street wall near a deck: an AC unit on a bay here and there, a pipe and a run of wires down one column
        if (!canyon && !edge && nearDeck(y)) {
          for (let i = 0; i < n; i++) {
            const u = f.a + (i + 0.5) * bay;
            const [px, pz] = onFace(f, u, 0);
            if (nearPad(px, pz)) continue;
            if (kitHash(t.x, t.z, s, i, f.nx, f.nz, 2) < (alleyFace(f) ? A.ac : D.chance.wallAc)) {
              const ac = pick(D.wallAc, kitHash(u, s, 3));
              const [x, z] = onFace(f, u, D.outset + 0.05);
              add(ac, place(ac, x, y + 0.4, z, f.yaw, 1, 1, 1, true), 1, "ac");
            }
          }
          const col = f.a + (Math.floor(kitHash(t.x, t.z, f.nx, f.nz, 4) * n) + 0.02) * bay;
          const [cx, cz] = onFace(f, col, 0);
          if (!nearPad(cx, cz)) {
            if (fam === "kyber" && kitHash(t.x, t.z, f.nx, f.nz, 5) < D.chance.wire) {
              const [x, z] = onFace(f, col, D.outset + 0.05);
              const w = D.wires[0];
              const wd = dims(w);
              if (wd) add(w, place(w, x, y, z, f.yaw, 1, STOREY / wd.h, 1, true), 2, "wire");
            } else if (kitHash(t.x, t.z, f.nx, f.nz, 6) < D.chance.pipe) {
              const [x, z] = onFace(f, col, D.outset + 0.2);
              const p = pick(D.pipes, kitHash(t.x, t.z, f.nx, f.nz, 7));
              const pd = dims(p);
              if (pd) add(p, place(p, x, y, z, f.yaw, 1, STOREY / pd.h, 1, true), 2, "pipe");
            }
          }
        }
      }
      // the roof's edge: parapet tiles over the knee-high parapet the roof already has (0.7 m, measured the same)
      const pn = Math.max(1, Math.round(len / 4));
      const pb = len / pn;
      const pd = dims(D.parapet);
      if (pd)
        for (let i = 0; i < pn; i++) {
          const [x, z] = onFace(f, f.a + (i + 0.5) * pb, D.outset);
          if (atBridgeEnd(x, z, t.roof)) continue;
          add(D.parapet, place(D.parapet, x, t.roof, z, f.yaw, pb / pd.w, 1, 1, true), 0, "parapet");
        }
      if (rows.cornice) {
        const cd = dims(rows.cornice);
        if (cd)
          for (let i = 0; i < n; i++) {
            const [x, z] = onFace(f, f.a + (i + 0.5) * bay, D.outset + 0.1);
            add(rows.cornice, place(rows.cornice, x, t.roof - cd.h - 0.1, z, f.yaw, bay / cd.w, 1, 1, true), 2, "cornice");
          }
      }
      // the Spire's billboards: a lit picture on each face of each tier, beside a pad's climb where the face has one
      if (spire) {
        // a pad's climb, or a door of the drop, keeps the billboard to one side of the face
        const padHere = pads.some((p) => Math.abs((f.nx !== 0 ? p.x : p.z) - f.at) < 3 && (f.nx !== 0 ? p.z : p.x) > f.a && (f.nx !== 0 ? p.z : p.x) < f.b) || KIT_SITES.doors.some((q) => f.nz !== 0 && Math.abs(q.z0 + 0.2 - f.at) < 0.5 && q.y0 < t.roof && q.y1 > t.base);
        const bw = Math.min(16, padHere ? len / 2 - 4.5 : len - 4);
        if (bw >= 6) {
          const id = pick(D.billboards, kitHash(t.x, t.z, t.base, f.nx, f.nz, 7));
          const bd = dims(id);
          const u = padHere ? f.a + bw / 2 + 1.5 : (f.a + f.b) / 2;
          const bh = Math.min(t.storeys * STOREY - 3, 22 * (bw / 16));
          if (bd) {
            const [x, z] = onFace(f, u, D.outset + 0.12);
            add(id, place(id, x, t.base + 1.5, z, f.yaw, bw / bd.w, bh / bd.h, 1, true), 0, "billboard");
          }
        }
      }
    }
    // the roof's plant: the collision boxes the roof already has, each wearing a piece its size
    for (const c of t.clutter) {
      const list = c.h > 2.2 ? D.roof.tall : Math.max(c.w, c.d) < 2.6 && c.h < 1.8 ? D.roof.small : D.roof.medium;
      const id = pick(list, kitHash(c.x, c.z, 8));
      const rd = dims(id);
      if (!rd) continue;
      add(id, place(id, c.x, c.y, c.z, 0, (c.w * 1.04) / rd.w, (c.h * 1.02) / rd.h, (c.d * 1.04) / rd.d, false), 1, "roof");
    }
  }
  // antennas on the tallest roofs, in a corner clear of the parapet
  {
    const tall = [...towers].sort((a, b) => b.roof - a.roof).slice(0, 10);
    for (const t of tall) {
      if (kitHash(t.x, t.z, 9) > D.chance.antenna) continue;
      const id = pick(D.antennas, kitHash(t.x, t.z, 10));
      const sx = Math.sign(kitHash(t.x, 11) - 0.5) || 1;
      const sz = Math.sign(kitHash(t.z, 12) - 0.5) || 1;
      add(id, place(id, t.x + sx * (t.w / 2 - 1.4), t.roof, t.z + sz * (t.d / 2 - 1.4), 0, 1, 1, 1, false), 1, "antenna");
    }
  }

  // ------------------------------------------------ the podiums: shop fronts on the street floor, the family above
  for (const p of KIT_SITES.podia) {
    if (!inCentre((p.x0 + p.x1) / 2, (p.z0 + p.z1) / 2)) continue;
    const fam = familyAt((p.x0 + p.x1) / 2, (p.z0 + p.z1) / 2);
    const rows = D.rows[fam] as { bay: number; mid: string[] };
    const y0 = cityCfg.kerb;
    for (const f of faces(p.x0, p.x1, p.z0, p.z1)) {
      const len = f.b - f.a;
      // the street floor, in 8 m shops: clear of the public stair and of the pads that throw up this face
      const n = Math.max(1, Math.round(len / 8));
      const bay = len / n;
      for (let i = 0; i < n; i++) {
        const u = f.a + (i + 0.5) * bay;
        const [fx, fz] = onFace(f, u, 1.5);
        if (inStair(fx, fz, D.clear.stair + bay / 2) || nearPad(fx, fz, D.clear.pad + bay / 2)) continue;
        const id = pick(lean ? D.lean.shops : D.shops, kitHash(p.x0, p.z0, u, 13));
        const sd = dims(id);
        if (!sd) continue;
        const r = relief(id);
        const [x, z] = onFace(f, u, r.out);
        add(id, place(id, x, y0, z, f.yaw, bay / sd.w, STOREY / sd.h, r.sz, true), 0, "shop");
      }
      // the floor above: the block's family, and signs, posters and AC units on it
      const upper = pick(rows.mid, kitHash(p.x0, p.z0, 14));
      const ud = dims(upper);
      const un = Math.max(1, Math.round(len / rows.bay));
      const ub = len / un;
      for (let i = 0; i < un && ud; i++) {
        const u = f.a + (i + 0.5) * ub;
        const r = relief(upper);
        const [x, z] = onFace(f, u, r.out);
        add(upper, place(upper, x, y0 + STOREY, z, f.yaw, ub / ud.w, (p.top - y0 - STOREY - 0.12) / ud.h, r.sz, true), 0, "podium");
      }
      for (let i = 0; i < n; i++) {
        const u = f.a + (i + 0.5) * bay;
        const [fx, fz] = onFace(f, u, 1.5);
        if (nearPad(fx, fz, D.clear.pad + 2) || inStair(fx, fz, 2)) continue;
        const r = kitHash(p.x0, p.z0, u, 15);
        if (r < D.chance.sign) {
          const id = pick(D.signs, kitHash(u, p.z1, 16));
          const [x, z] = onFace(f, u, D.outset + 0.06);
          add(id, place(id, x, y0 + STOREY + 0.8, z, f.yaw, 1, 1, 1, true), 1, "sign");
        } else if (r < D.chance.sign + D.chance.poster) {
          const id = pick(D.posters, kitHash(u, p.z1, 17));
          const pd = dims(id);
          const [x, z] = onFace(f, u, D.outset + 0.06);
          if (pd) add(id, place(id, x, y0 + STOREY + 0.4, z, f.yaw, Math.min(1, (bay - 1.5) / pd.w), Math.min(1, 3.2 / pd.h), 1, true), 1, "poster");
        } else if (r < D.chance.sign + D.chance.poster + D.chance.wallAc) {
          const id = pick(D.wallAc, kitHash(u, p.z1, 18));
          const [x, z] = onFace(f, u, D.outset + 0.05);
          add(id, place(id, x, y0 + STOREY + 1.2, z, f.yaw, 1, 1, 1, true), 1, "ac");
        }
      }
      // a blade sign at each end past the canopy's end, standing out from the corner (the canopies stop a metre short)
      for (const end of [f.a + 0.5, f.b - 0.5]) {
        const [cx, cz] = onFace(f, end, 1);
        if (nearPad(cx, cz, D.clear.pad + 2) || inStair(cx, cz, 2) || kitHash(end, f.at, 19) > D.chance.blade) continue;
        const id = pick(D.blades, kitHash(end, f.at, 20));
        const bd = dims(id);
        if (!bd) continue;
        // turned side-on to the face, its inner edge on the wall
        const [x, z] = onFace(f, end, D.outset + bd.w / 2);
        add(id, place(id, x, y0 + 1.1, z, f.yaw + Math.PI / 2, 1, Math.min(1, (p.top - y0 - 1.4) / bd.h), 1, false), 1, "blade");
      }
    }
    // a Kyber block's podium corners carry its neon shop holders
    if (fam === "kyber")
      for (const [cx, cz, yaw] of [
        [p.x0 + 2, p.z0 - D.outset, Math.PI],
        [p.x1 - 2, p.z1 + D.outset, 0],
      ] as const) {
        if (nearPad(cx, cz, D.clear.pad + 2) || inStair(cx, cz, 2)) continue;
        const id = pick(D.neonHolders, kitHash(cx, cz, 21));
        add(id, place(id, cx, cityCfg.kerb + STOREY + 0.3, cz, yaw, 1, 1, 1, true), 1, "sign");
      }
  }

  // ------------------------------------------------ the streets: lamps, cables overhead, clutter on the pavement
  for (const [lx, lz] of KIT_SITES.lamps) {
    if (!inCentre(lx, lz)) continue;
    // its arm toward the middle of the crossing it lights
    const sx = cityCfg.blocks.slice(0, -1).map((b, i) => (b[1] + cityCfg.blocks[i + 1][0]) / 2).reduce((a, s) => (Math.abs(s - lx) < Math.abs(a - lx) ? s : a), 0);
    const sz = cityCfg.blocks.slice(0, -1).map((b, i) => (b[1] + cityCfg.blocks[i + 1][0]) / 2).reduce((a, s) => (Math.abs(s - lz) < Math.abs(a - lz) ? s : a), 0);
    add(D.lamp, place(D.lamp, lx, 0, lz, Math.atan2(sx - lx, sz - lz), 1, 1, 1, false), 1, "lamp");
  }
  {
    const streets = cityCfg.blocks.slice(0, -1).map((b, i) => (b[1] + cityCfg.blocks[i + 1][0]) / 2).filter((s) => Math.abs(s) < C);
    const faceOf = (s: number, side: -1 | 1, along: number, alongX: boolean): number | null => {
      // the podium face across the pavement from the street, on one side of it, at this point along it
      let best: number | null = null;
      for (const p of KIT_SITES.podia) {
        if (alongX ? along < p.x0 || along > p.x1 : along < p.z0 || along > p.z1) continue;
        const faceAt = alongX ? (side < 0 ? p.z1 : p.z0) : side < 0 ? p.x1 : p.x0;
        if ((faceAt - s) * side <= 0 || Math.abs(faceAt - s) > 16) continue;
        if (best === null || Math.abs(faceAt - s) < Math.abs(best - s)) best = faceAt;
      }
      return best;
    };
    for (const s of streets) {
      for (const alongX of [true, false]) {
        for (let a = -C + 6; a < C - 6; a += D.cableEvery) {
          const along = a + (kitHash(s, a, alongX ? 1 : 0, 22) - 0.5) * 4;
          if (Math.abs(along - streets.find((q) => Math.abs(q - along) < 10)!) < 10) continue;
          const f0 = faceOf(s, -1, along, alongX);
          const f1 = faceOf(s, 1, along, alongX);
          if (f0 === null || f1 === null) continue;
          const [x, z] = alongX ? [along, s] : [s, along];
          if (nearPad(x, z, D.clear.pad + 5) || nearBridge(x, z) || inStair(x, z, 4)) continue;
          if (kitHash(s, along, 23) > D.chance.cable) continue;
          const id = pick(D.cables, kitHash(s, along, 24));
          const cd = dims(id);
          if (!cd) continue;
          const span = Math.abs(f1 - f0) - 0.2;
          const y = D.cableAt[0] + kitHash(s, along, 25) * (D.cableAt[1] - D.cableAt[0]);
          // a cable runs along its own x: across a street along x, it turns to run along z
          add(id, place(id, x, y, z, alongX ? Math.PI / 2 : 0, span / cd.w, 1, 1, false), 2, "cable");
        }
      }
    }
  }
  for (const p of KIT_SITES.podia) {
    if (!inCentre((p.x0 + p.x1) / 2, (p.z0 + p.z1) / 2)) continue;
    for (const f of faces(p.x0, p.x1, p.z0, p.z1)) {
      for (let u = f.a + 3; u < f.b - 3; u += 5) {
        const [x, z] = onFace(f, u, 1.1);
        if (kitHash(x, z, 26) > D.chance.prop || nearPad(x, z) || inStair(x, z, 1.5)) continue;
        const id = pick(D.streetProps, kitHash(x, z, 27));
        add(id, place(id, x, cityCfg.kerb, z, f.yaw, 1, 1, 1, false), 2, "prop");
      }
    }
  }

  // ------------------------------------------------ the Sky Lobby's and the Sky Park's band: glass either side of each window
  {
    const B = D.band;
    const win = cityCfg.skyLobby.width;
    for (const r of KIT_SITES.rooms) {
      if (!inCentre(r.x, r.z)) continue;
      for (const f of faces(r.x - r.w / 2, r.x + r.w / 2, r.z - r.d / 2, r.z + r.d / 2)) {
        const c = (f.a + f.b) / 2 + r.at[f.key];
        for (const [a, b] of [
          [f.a, c - win / 2],
          [c + win / 2, f.b],
        ]) {
          const len = b - a;
          if (len < 0.5) continue;
          // a module a bay of up to 8 m, the bays filling the piece of wall
          const n = Math.max(1, Math.round(len / 8));
          const bay = len / n;
          for (let i = 0; i < n; i++) {
            const id = pick(B.modules, kitHash(r.x, r.z, r.y, f.nx, f.nz, i, 50));
            const dm = dims(id);
            if (!dm) continue;
            const pl = planeOf(id);
            const sz = pl > B.relief ? B.relief / pl : 1;
            const [x, z] = onFace(f, a + (i + 0.5) * bay, D.outset + pl * sz);
            add(id, place(id, x, r.y, z, f.yaw, bay / dm.w, cityCfg.storey / dm.h, sz, true), 0, "band");
          }
        }
      }
    }
  }

  // ------------------------------------------------ Neon Alley: signs up every face, a web of cables, stands, the kerbs
  {
    const chimneys = cityCfg.chimneys.list;
    const Ch = cityCfg.chimneys;
    /** a column up a face at the mouth of a chimney: nothing may stand out there (the plan's rule 1) */
    const atChimney = (f: Face, u: number) => chimneys.some((c) => Math.abs(u - c.x) < Ch.width / 2 + Ch.wall + 1.5 && (Math.abs(f.at - c.z0) < 2 || Math.abs(f.at - c.z1) < 2));
    const sites: Array<{ f: Face; foot: number; top: number; spire: boolean }> = [];
    for (const t of towers) for (const f of faces(t.x - t.w / 2, t.x + t.w / 2, t.z - t.d / 2, t.z + t.d / 2)) if (alleyFace(f)) sites.push({ f, foot: t.base, top: t.roof, spire: Math.abs(t.x) < 30 && Math.abs(t.z) < 30 });
    // (the podiums' own upper floors carry their signs already: the stacks go up the towers)
    for (const { f, foot, top, spire } of sites) {
      const [a, b] = alleyFace(f)!;
      // the Spire's billboard is in the middle of a tier's face with no pad
      const board = spire ? Math.min(16, f.b - f.a - 4) / 2 + 1 : 0;
      for (let u = a + 1; u <= b - 1; u += A.signEvery) {
        const [px, pz] = onFace(f, u, 1.8);
        if (nearPad(px, pz, D.clear.pad + 2) || atChimney(f, u) || (board && Math.abs(u - (f.a + f.b) / 2) < board)) continue;
        const vertical = kitHash(u, f.at, 40) < 0.4;
        let y = foot + A.signFrom;
        const yTop = Math.min(top - 1, A.signTo);
        // the rooms' windows up this face (the open floors, the lobby): a sign over one is left out
        const windowsHere = KIT_SITES.rooms
          .filter((rm) => (f.nx !== 0 ? Math.abs(f.at - (rm.x + f.nx * (rm.w / 2))) < 0.2 && Math.abs(rm.z - (f.a + f.b) / 2) < 0.2 : Math.abs(f.at - (rm.z + f.nz * (rm.d / 2))) < 0.2 && Math.abs(rm.x - (f.a + f.b) / 2) < 0.2))
          .map((rm) => ({ c: (f.a + f.b) / 2 + rm.at[f.key], y: rm.y }));
        for (let k = 0; y < yTop; k++) {
          const id = pick(vertical ? D.blades : D.signs, kitHash(u, f.at, k, 41));
          const sd = dims(id);
          if (!sd || y + sd.h > yTop) break;
          // nor over a door the city cut in the face (a stair core's)
          const [sx0, sz0] = onFace(f, u - sd.w / 2, -0.2);
          const [sx1, sz1] = onFace(f, u + sd.w / 2, 0.5);
          const overDoor = KIT_SITES.doors.some((q) => Math.max(sx0, sx1) > q.x0 && Math.min(sx0, sx1) < q.x1 && Math.max(sz0, sz1) > q.z0 && Math.min(sz0, sz1) < q.z1 && y < q.y1 && y + sd.h > q.y0);
          if (overDoor || windowsHere.some((wn) => Math.abs(wn.c - u) < cityCfg.skyLobby.width / 2 + sd.w / 2 + 0.2 && y < wn.y + cityCfg.skyLobby.height && y + sd.h > wn.y)) {
            y += sd.h + A.signGap;
            continue;
          }
          // in front of the facade's relief (dress relief), or a module's pilasters hide it
          const [x, z] = onFace(f, u, D.outset + D.relief + 0.06);
          add(id, place(id, x, y, z, f.yaw, 1, 1, 1, true), 0, "sign");
          y += sd.h + A.signGap;
        }
      }
    }
    // the web of cables over it, in two layers, each from the face across the alley that stands at its height (the
    // podiums' under 8 m, the towers' over), never across a pad's throw
    const across = [
      ...KIT_SITES.podia.flatMap((p) => faces(p.x0, p.x1, p.z0, p.z1).filter((f) => alleyFace(f)).map((f) => ({ f, foot: 0, top: p.top }))),
      ...towers.flatMap((t) => faces(t.x - t.w / 2, t.x + t.w / 2, t.z - t.d / 2, t.z + t.d / 2).filter((f) => alleyFace(f)).map((f) => ({ f, foot: t.base, top: t.roof }))),
    ];
    const padsUp = padsWorld.map((q) => ({ x: q.x - BR_X, z: q.z - BR_Z, top: (q.y ?? 0) + ((q.up ?? 0) * (q.up ?? 0)) / (2 * 17.5) + 2 }));
    for (let u = NA.from + 2; u <= NA.to - 2; u += A.cableEvery) {
      A.cableAt.forEach(([lo, hi], layer) => {
        const y = lo + kitHash(u, layer, 42) * (hi - lo);
        const ends = across.filter((q) => u > q.f.a + 0.5 && u < q.f.b - 0.5 && y > q.foot + 0.5 && y < q.top - 0.5).map((q) => q.f.at);
        // the nearest face each side of the street
        const near = ends.filter((z) => z < alleyZ).reduce((m, z) => Math.max(m, z), -Infinity);
        const far = ends.filter((z) => z > alleyZ).reduce((m, z) => Math.min(m, z), Infinity);
        if (!Number.isFinite(near) || !Number.isFinite(far)) return;
        if (padsUp.some((q) => Math.abs(q.x - u) < 3.5 && q.z > near - 3 && q.z < far + 3 && q.top > y - 2)) return;
        // nor into a room's window where it meets a face
        const id = pick(D.cables, kitHash(u, layer, 43));
        const cd = dims(id);
        if (!cd) return;
        // (its sag hangs cd.h under where it is hung from, which is its top)
        const intoWindow = KIT_SITES.rooms.some((rm) =>
          [rm.z - rm.d / 2, rm.z + rm.d / 2].some((fz) => (Math.abs(fz - near) < 0.2 || Math.abs(fz - far) < 0.2) && Math.abs(rm.x + (fz < rm.z ? rm.at.n : rm.at.s) - u) < cityCfg.skyLobby.width / 2 + 1 && y < rm.y + cityCfg.skyLobby.height + 0.3 && y + cd.h > rm.y - 0.3),
        );
        if (intoWindow) return;
        add(id, place(id, u, y, (near + far) / 2, Math.PI / 2, (far - near - 0.2) / cd.w, 1, 1, false), 1, "cable");
      });
    }
    // the stalls: a food stand over each of the city's boxes
    for (const s of KIT_SITES.stalls) {
      const id = pick(A.stands, kitHash(s.x, s.z, 44));
      const sd = dims(id);
      if (sd) add(id, place(id, s.x, cityCfg.kerb, s.z, s.yaw, (s.w * 1.06) / sd.w, (s.h * 1.04) / sd.h, (s.d * 1.1) / sd.d, false), 1, "prop");
    }
    // bins and a hydrant along both kerbs, and street lamps, clear of the pads, the stalls and the stairwells
    const kerbs = [-1, 1].map((sg) => alleyZ + sg * (cityCfg.streetLife.lane + 2.2));
    const clearOf = (x: number, z: number, r: number) =>
      !nearPad(x, z, D.clear.pad + r) &&
      !KIT_SITES.stalls.some((s) => Math.abs(s.x - x) < s.w / 2 + r && Math.abs(s.z - z) < s.d / 2 + r) &&
      !KIT_SITES.openings.some((o) => x > o.x0 - r && x < o.x1 + r && z > o.z0 - r && z < o.z1 + r);
    for (const kz of kerbs) {
      for (let u = NA.from + 2; u <= NA.to - 2; u += A.kerbEvery) {
        const x = u + (kitHash(u, kz, 45) - 0.5) * 2;
        if (!clearOf(x, kz, 1) || A.lampAt.some((l) => Math.abs(l - x) < 1.5)) continue;
        const id = pick(A.kerb, kitHash(u, kz, 46));
        add(id, place(id, x, 0, kz, kz < alleyZ ? 0 : Math.PI, 1, 1, 1, false), 1, "prop");
      }
      for (const lx of A.lampAt) {
        if (!clearOf(lx, kz, 0.6)) continue;
        // its arm out over the street
        add(D.lamp, place(D.lamp, lx, 0, kz, kz < alleyZ ? 0 : Math.PI, 1, 1, 1, false), 1, "lamp");
      }
    }
  }

  // ------------------------------------------------ the Spire's machinery: Glass's pipes and machine over the city's boxes
  for (const q of KIT_SITES.machinery) {
    const id = q.kind === "stack" ? D.machinery.stack : D.machinery.machine;
    const md = dims(id);
    if (md) add(id, place(id, q.x, q.y, q.z, 0, (q.w * 1.04) / md.w, (q.h * 1.02) / md.h, (q.d * 1.04) / md.d, false), 1, "prop");
  }

  // ------------------------------------------------ the centre's parked cars, each a van from High City, its box's size
  {
    const [cl, cw] = cityCfg.streetLife.car;
    const tall = 0.25 + cityCfg.streetLife.car[2] + cityCfg.streetLife.cabin[2];
    for (const c of KIT_SITES.cars) {
      const id = pick(D.cars, kitHash(c.x, c.z, 70));
      const cd = dims(id);
      if (!cd) continue;
      // standing, a van's length runs along x: a car along x keeps it, one along z turns
      const yaw = c.alongX ? (c.facing > 0 ? 0 : Math.PI) : c.facing > 0 ? -Math.PI / 2 : Math.PI / 2;
      add(id, place(id, c.x, 0, c.z, yaw, cl / cd.w, tall / cd.h, cw / cd.d, false), 1, "car");
    }
  }

  // ------------------------------------------------ the metro: posters down its walls, signals at its ends, bins
  {
    const Mc = cityCfg.metro;
    const Mk = D.metro;
    const lines = Mc.streets.map((i) => streetLines[i]);
    const half = Mc.width / 2;
    const [lo, hi] = [Math.min(...lines), Math.max(...lines)];
    const y0 = Mc.floor;
    const T = Mc.train;
    const trainLen = T.cars * T.length + (T.cars - 1) * T.gap;
    /** a wall of the tunnel as a face: along x at z = at when alongX, looking toward `n` */
    const wallFace = (alongX: boolean, at: number, n: number, a: number, b: number): Face =>
      alongX ? { key: n > 0 ? "s" : "n", nx: 0, nz: n, yaw: n > 0 ? 0 : Math.PI, at, a, b } : { key: n > 0 ? "e" : "w", nx: n, nz: 0, yaw: n > 0 ? Math.PI / 2 : -Math.PI / 2, at, a, b };
    for (const line of [lo, hi]) {
      for (const alongX of [true, false]) {
        const out = Math.sign(line);
        const [a, b] = alongX ? [lo - half, hi + half] : [lo + half, hi - half];
        const mid = (a + b) / 2;
        // the outer wall looks in toward the centre, the inner out
        for (const [at, n, inner] of [
          [line + out * half, -out, false],
          [line - out * half, out, true],
        ] as const) {
          // the inner wall runs between the corners, where the tunnel turns
          const f = inner ? wallFace(alongX, at, n, lo + half, hi - half) : wallFace(alongX, at, n, a, b);
          for (let u = f.a + 3; u <= f.b - 3; u += Mk.posterEvery) {
            // not behind a stair (the outer lane's) or a parked train (the inner lane's)
            const [px, pz] = onFace(f, u, 1);
            if (!inner && KIT_SITES.openings.some((o) => px > o.x0 - 1.5 && px < o.x1 + 1.5 && pz > o.z0 - 3 && pz < o.z1 + 3)) continue;
            if (inner && Math.abs(u - mid) < trainLen / 2 + 1.5) continue;
            const id = pick(D.posters, kitHash(u, at, 60));
            const pd = dims(id);
            if (!pd) continue;
            const [x, z] = onFace(f, u, D.outset + 0.02);
            add(id, place(id, x, y0 + Mk.posterAt, z, f.yaw, Math.min(1, 3 / pd.w), Math.min(1, 2.2 / pd.h), 1, true), 1, "poster");
            // a bin under one here and there
            if (kitHash(u, at, 61) < Mk.binChance) {
              const bid = pick(Mk.bins, kitHash(u, at, 62));
              const [bx, bz] = onFace(f, u + 1.6, 0.5);
              add(bid, place(bid, bx, y0, bz, f.yaw, 1, 1, 1, false), 1, "prop");
            }
          }
          // a signal at each end of the side, up the outer wall
          if (!inner)
            for (const u of [f.a + 4, f.b - 4]) {
              const [x, z] = onFace(f, u, D.outset);
              add(Mk.signal, place(Mk.signal, x, y0 + Mk.signalAt, z, f.yaw, 1, 1, 1, true), 1, "sign");
            }
        }
      }
    }
  }

  // ------------------------------------------------ the streets: decals and sewer covers down them, traffic lights at the crossings
  {
    const St = D.streets;
    const lines = cityCfg.blocks.slice(0, -1).map((b, i) => (b[1] + cityCfg.blocks[i + 1][0]) / 2).filter((s) => Math.abs(s) < C);
    const clearAt = (x: number, z: number) =>
      !nearPad(x, z, 3) && !KIT_SITES.openings.some((o) => x > o.x0 - 2 && x < o.x1 + 2 && z > o.z0 - 2 && z < o.z1 + 2) && !KIT_SITES.cars.some((c) => Math.hypot(c.x - x, c.z - z) < 3.5);
    for (const s of lines) {
      for (const alongX of [true, false]) {
        for (let a = -C + 4; a < C - 4; a += St.every) {
          // off the crossings: their zebras are the city's own
          if (lines.some((q) => Math.abs(q - a) < 9)) continue;
          const across = (kitHash(s, a, alongX ? 1 : 0, 100) - 0.5) * 8;
          const [x, z] = alongX ? [a, s + across] : [s + across, a];
          if (!clearAt(x, z)) continue;
          const r = kitHash(s, a, alongX ? 1 : 0, 101);
          if (r < St.decalChance) {
            const id = pick(St.decals, kitHash(s, a, 102));
            add(id, place(id, x, 0.03, z, alongX ? Math.PI / 2 : 0, 1, 1, 1, false), 1, "prop");
          } else if (r < St.decalChance + St.sewerChance) {
            const id = pick(St.sewers, kitHash(s, a, 103));
            add(id, place(id, x, 0.02, z, 0, 1, 1, 1, false), 1, "prop");
          }
        }
      }
    }
    // a traffic light at the two corners of each crossing round the Spire the city's lamps leave free
    for (const sx of lines)
      for (const sz of lines)
        for (const [ox, oz] of [
          [6.4, -6.4],
          [-6.4, 6.4],
        ] as const) {
          const [x, z] = [sx + ox, sz + oz];
          if (!clearAt(x, z)) continue;
          const id = pick(St.lights, kitHash(x, z, 104));
          // its arm out over the crossing
          add(id, place(id, x, 0, z, Math.atan2(sx - x, sz - z), 1, 1, 1, false), 2, "lamp");
        }
    // string lights over a shop front here and there, under the podium's edge
    for (const p of KIT_SITES.podia) {
      if (!inCentre((p.x0 + p.x1) / 2, (p.z0 + p.z1) / 2)) continue;
      for (const f of faces(p.x0, p.x1, p.z0, p.z1)) {
        for (let u = f.a + 5; u < f.b - 5; u += 9) {
          const [fx, fz] = onFace(f, u, 1.5);
          if (kitHash(u, f.at, 105) > St.garlandChance || nearPad(fx, fz, D.clear.pad + 2) || inStair(fx, fz, 2)) continue;
          const gd = dims(St.garland);
          if (!gd) continue;
          const [x, z] = onFace(f, u, D.outset + 0.3);
          add(St.garland, place(St.garland, x, cityCfg.kerb + STOREY + 0.2, z, f.yaw, 1, 1, 1, true), 2, "sign");
        }
      }
    }
  }

  // ------------------------------------------------ the skyline: lit towers over the skyline's boxes, and two airships
  for (const b of KIT_SITES.skyline) {
    const id = pick(D.skyline, kitHash(b.x, b.z, 28));
    const sd = dims(id);
    if (!sd) continue;
    add(id, place(id, b.x, 0, b.z, 0, (b.w * 1.03) / sd.w, b.h / sd.h, (b.w * 1.03) / sd.d, false), 0, "skyline");
  }
  for (const [x, y, z, yaw] of D.zeppelins) add(D.zeppelin, place(D.zeppelin, x, y, z, yaw, 1, 1, 1, false), 1, "zeppelin");
  return out;
}
