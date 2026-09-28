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
  /** how far its front stands out of the wall it is on, when that is not what its measured relief says (a canyon's pressed module) */
  out?: number;
  /** what it is, for the checks' clearances: facade and parapet stand flush, the rest stand out of a wall or stand free */
  kind: "facade" | "flat" | "band" | "car" | "podium" | "shop" | "parapet" | "cornice" | "sign" | "blade" | "poster" | "ac" | "billboard" | "roof" | "antenna" | "lamp" | "cable" | "pipe" | "wire" | "prop" | "skyline" | "zeppelin" | "escape" | "strip";
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
/** how much of a piece's front-facing area stands within 0.3 m of its front (import-city.ts measures it) */
const FRONT = (kit as unknown as { front?: Record<string, number> }).front ?? {};
/** a room module: its facade is its front, a room behind the glass (dress rooms) */
export const isRoom = (id: string): boolean => (FRONT[id] ?? 0) >= D.rooms.front && planeOf(id) > D.relief;
/** a module with relief (Phase 23.4): a room, or frames and cornices before a wall; either sits whole, its front on the face */
const hasDepth = (id: string): boolean => planeOf(id) > D.rooms.flat;
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

/**
 * Which way a piece faces as measured. A demo street's facade strip is baked facing +z whatever its measured sides
 * say: a strip's balconies and escapes can outweigh its wall, and dims() taking that side swapped a strip's width
 * for its depth (three of Kyber's twelve, scaled wrong and leaving holes)
 */
const facingOf = (id: string): Facing => (id.includes("/facade ") ? "pz" : (FACING[id] ?? "pz"));
/** a piece's size once turned to face +z: width along x, height, depth along z */
function dims(id: string): { w: number; h: number; d: number } | null {
  const m = MEASURED[id];
  if (!m) return null;
  const f = facingOf(id);
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
  const f = facingOf(id);
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
  const add = (piece: string, m: THREE.Matrix4 | null, tier: number, kind: KitPlace["kind"], stands?: number): void => {
    if (m) out.push({ piece, m, tier, kind, ...(stands !== undefined ? { out: stands } : {}) });
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
  /**
   * How a module sits on face `f` of tower `t` across `a` to `b` along it (dress rooms): a room module with its front on
   * the face and its room inside the tower, as deep as the room goes, short of the stair core, and on a west or east face
   * off the corners the north and south faces' rooms own; anything else not a room (null), for the caller to press
   */
  /** the rooms set so far, their footprints in plan by tower and storey: a west or east room stops short of them */
  const roomsSet: Array<{ t: object; y: number; x0: number; x1: number; z0: number; z1: number }> = [];
  const seat = (id: string, t: (typeof KIT_SITES.towers)[number], f: Face, a: number, b: number, y: number): { sz: number; out: number } | null => {
    if (!hasDepth(id)) return null;
    const dm = dims(id);
    if (!dm) return null;
    const R = D.rooms;
    let depth = dm.d;
    // on a west or east face, short of the north and south faces' rooms at this storey (faces() gives n and s first)
    if (f.nx !== 0)
      for (const q of roomsSet)
        if (q.t === t && Math.abs(q.y - y) < 0.01 && q.z1 > a && q.z0 < b) depth = Math.min(depth, (f.key === "w" ? q.x0 - f.at : f.at - q.x1) - R.gap);
    const c = t.core;
    if (c) {
      const [l0, l1] = f.nx !== 0 ? [c.z0, c.z1] : [c.x0, c.x1];
      if (l1 > a && l0 < b) {
        const dist = f.key === "n" ? c.z0 - f.at : f.key === "s" ? f.at - c.z1 : f.key === "w" ? c.x0 - f.at : f.at - c.x1;
        if (dist >= 0) depth = Math.min(depth, dist - R.core);
      }
    }
    if (depth < R.min) return null;
    const sz = Math.min(1, depth / dm.d);
    const reach = dm.d * sz;
    const plan = f.key === "n" ? { x0: a, x1: b, z0: f.at, z1: f.at + reach } : f.key === "s" ? { x0: a, x1: b, z0: f.at - reach, z1: f.at } : f.key === "w" ? { x0: f.at, x1: f.at + reach, z0: a, z1: b } : { x0: f.at - reach, x1: f.at, z0: a, z1: b };
    roomsSet.push({ t, y, ...plan });
    return { sz, out: D.outset };
  };
  /** inside a fire escape's box (city.ts KIT_SITES escapes), `pad` metres round it */
  const inEscape = (x: number, z: number, y: number, pad = 0.5) => KIT_SITES.escapes.some((e) => x > e.x0 - pad && x < e.x1 + pad && z > e.z0 - pad && z < e.z1 + pad && y > e.y0 - 0.5 && y < e.y1);
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
    type Rows = { bay: number; ground: string[]; mid: string[]; top: string[]; far?: string[]; farBay?: number; cornice?: string };
    const rows = pick(styles, kitHash(t.x, t.z, 90)) as Rows;
    // The tower a stack of buildings (dress stack, Phase 23.4): its storeys in bands of stack.storeys, each band one of
    // the family's styles with its own top storey and a ledge over it, as the packs' own streets stack buildings of five
    // to eight storeys; band 0 keeps the tower's first style
    const ST = (D as unknown as { stack?: { storeys: [number, number]; ledge: Record<string, string | null>; ledgeDepth: number } }).stack;
    const band: number[] = [];
    const bandTop: boolean[] = [];
    {
      let k = 0;
      let s0 = 0;
      while (s0 < t.storeys) {
        const len = ST ? ST.storeys[0] + Math.floor(kitHash(t.x, t.z, 91, k) * (ST.storeys[1] - ST.storeys[0] + 1)) : t.storeys;
        const s1 = Math.min(t.storeys, s0 + len);
        for (let s = s0; s < s1; s++) {
          band[s] = k;
          bandTop[s] = s === s1 - 1 && s1 < t.storeys;
        }
        s0 = s1;
        k++;
      }
    }
    const rowsAt = (s: number): Rows => (band[s] === 0 ? rows : (pick(styles, kitHash(t.x, t.z, 90, band[s])) as Rows));
    const spire = Math.abs(t.x) < 30 && Math.abs(t.z) < 30;
    for (const f of faces(t.x - t.w / 2, t.x + t.w / 2, t.z - t.d / 2, t.z + t.d / 2)) {
      const len = f.b - f.a;
      const n = Math.max(1, Math.round(len / rows.bay));
      const bay = len / n;
      const canyon = canyonFace(t, f);
      // a canyon's face wears its rows pressed flat, and the bays a pad throws you up past flat panels: nothing stands out where you run
      const fn = Math.max(1, Math.round(len / 8));
      const fb = len / fn;
      const padBay = (u: number) => {
        const [px, pz] = onFace(f, u, 1.8);
        return nearPad(px, pz, bay / 2 + 1.5);
      };
      // The demo streets' facade strips (dress strips, Phase 24.3): a street face split into columns, each column a stack
      // of the family's strips from its foot up, each strip near its own proportions and a whole number of storeys tall,
      // so the columns' buildings end at different heights as a street's do. The open storeys keep their own walls, a
      // fire escape, a chimney's mouth and a pad's lane keep the modules across their own width (the columns laid in the
      // stretches between), and a strip beside a pad's column further out is pressed shallow enough to stand clear of it.
      const covered: Array<{ a: number; b: number; y0: number; y1: number }> = [];
      const SF = (D as unknown as { strips?: { families: Record<string, string[]>; col: [number, number]; scale: [number, number]; minStoreys: number; padDepth: number; clear: number } }).strips;
      const famStrips = SF?.families[fam] ?? [];
      if (!lean && !canyon && !spire && famStrips.length) {
        const rooms = [t.lobby, t.park, ...(t.floors ?? [])].filter((v): v is number => v !== undefined).sort((p, q) => p - q);
        // the stretches of the face between the open storeys, in whole storeys
        const segs: Array<[number, number]> = [];
        let from = t.base;
        for (const r of [...rooms, t.roof]) {
          if (r - from >= SF!.minStoreys * STOREY - 0.01) segs.push([from, r]);
          from = r + STOREY;
        }
        const Ch = cityCfg.chimneys;
        // the face's free stretches: less each fire escape's width and each chimney's mouth, `clear` spare either side
        let free: Array<[number, number]> = [[f.a, f.b]];
        const cut = (p0: number, p1: number): void => {
          free = free.flatMap(([p, q]) => (p1 <= p || p0 >= q ? [[p, q] as [number, number]] : ([[p, p0], [p1, q]] as Array<[number, number]>).filter(([p2, q2]) => q2 - p2 > 0.01)));
        };
        {
          const [ox0, oz0] = onFace(f, f.a, -0.5);
          const [ox1, oz1] = onFace(f, f.b, 1.5);
          for (const e of KIT_SITES.escapes)
            if (e.x1 > Math.min(ox0, ox1) && e.x0 < Math.max(ox0, ox1) && e.z1 > Math.min(oz0, oz1) && e.z0 < Math.max(oz0, oz1))
              if (f.nx !== 0) cut(e.z0 - SF!.clear, e.z1 + SF!.clear);
              else cut(e.x0 - SF!.clear, e.x1 + SF!.clear);
          // a chimney within a strip's depth in front of the face, its mouth on the face or its length along it
          const reach = Math.max(...famStrips.map((sid) => (MEASURED[sid]?.[5] ?? 0) + (dims(sid)?.d ?? 0)));
          for (const c of Ch.list) {
            const [cx0, cx1] = [c.x - Ch.width / 2 - Ch.wall, c.x + Ch.width / 2 + Ch.wall];
            const [lo, hi] = f.nx !== 0 ? [cx0, cx1] : [c.z0, c.z1];
            const [near, far] = [f.at, f.at + (f.nx || f.nz) * reach].sort((p, q) => p - q);
            if (hi > near && lo < far) {
              if (f.nx !== 0) cut(c.z0 - SF!.clear, c.z1 + SF!.clear);
              else cut(cx0 - SF!.clear, cx1 + SF!.clear);
            }
          }
          // and a pad's lane, where the pad stands so close that a strip beside it would be pressed flatter than padDepth
          for (const p of pads) {
            const out = f.nx !== 0 ? (p.x - f.at) * f.nx : (p.z - f.at) * f.nz;
            const along = f.nx !== 0 ? p.z : p.x;
            if (out > -1.2 && out - 1.35 < SF!.padDepth) cut(along - 1.2 - SF!.clear, along + 1.2 + SF!.clear);
          }
        }
        // columns across each free stretch, each as wide as a strip of the family, the lot stretched to the stretch; one
        // too narrow for a column keeps the modules
        const cols: Array<[number, number]> = [];
        for (const [s0, s1] of free) {
          if (s1 - s0 < SF!.col[0] * SF!.scale[0]) continue;
          const ws: number[] = [];
          let sum = 0;
          for (let k = 0; sum < s1 - s0 - SF!.col[0]; k++) {
            const sid = pick(famStrips, kitHash(t.x, t.z, f.nx, f.nz, s0, k, 60));
            const w = Math.max(SF!.col[0], Math.min(SF!.col[1], dims(sid)?.w ?? 10));
            ws.push(w);
            sum += w;
          }
          if (!ws.length) ws.push(s1 - s0);
          const k = (s1 - s0) / Math.max(1, ws.reduce((p, q) => p + q, 0));
          let u = s0;
          for (const w of ws) (cols.push([u, u + w * k]), (u += w * k));
        }
        for (const [a, b2] of cols) {
          const uc = (a + b2) / 2;
          const doorIn = (y0: number, y1: number) => {
            const [x0, z0] = onFace(f, a, -0.2);
            const [x1, z1] = onFace(f, b2, 0.6);
            return KIT_SITES.doors.some((q) => q.x1 > Math.min(x0, x1) && q.x0 < Math.max(x0, x1) && q.z1 > Math.min(z0, z1) && q.z0 < Math.max(z0, z1) && q.y1 > y0 && q.y0 < y1);
          };
          // how far out of the face a strip here may stand: short of the nearest pad's column (the check's, 1.2 m round
          // the pad) across the column's width; a pad throws you to a roof, so the whole height
          let room = Infinity;
          for (const p of pads) {
            const along = f.nx !== 0 ? p.z : p.x;
            const out = f.nx !== 0 ? (p.x - f.at) * f.nx : (p.z - f.at) * f.nz;
            if (along > a - 1.2 && along < b2 + 1.2 && out > -1.2) room = Math.min(room, out - 1.2 - 0.15);
          }
          if (room < SF!.padDepth) continue;
          for (const [y0, y1] of segs) {
            if (doorIn(y0, y1)) continue;
            let y = y0;
            for (let k = 0; y1 - y >= SF!.minStoreys * STOREY - 0.01; k++) {
              const sid = pick(famStrips, kitHash(uc, y, f.nx, f.nz, k, 61));
              const sd = dims(sid);
              if (!sd) break;
              const sx = (b2 - a) / sd.w;
              // near its own proportions, a whole number of storeys, never past the stretch's top
              const want = Math.min(SF!.scale[1], Math.max(SF!.scale[0], sx)) * sd.h;
              let storeys = Math.max(SF!.minStoreys, Math.round(want / STOREY));
              const left = Math.round((y1 - y) / STOREY);
              if (storeys > left || left - storeys < SF!.minStoreys) storeys = left;
              const h = storeys * STOREY;
              const mz = (MEASURED[sid] ?? [0, 0, 0, 0, 0, 0])[5];
              // its front (its wall at the face, what stands out of it in front) pressed to the room a pad leaves
              const front = mz + sd.d;
              const sz = front > room ? room / front : 1;
                const [x, z] = onFace(f, uc, (mz + sd.d / 2) * sz);
              add(sid, place(sid, x, y, z, f.yaw, sx, h / sd.h, sz, false), 0, "strip");
              covered.push({ a, b: b2, y0: y, y1: y + h });
              y += h;
            }
          }
        }
      }
      /** the stretches of face at storey y the strips leave to the modules */
      const openAt = (y: number): Array<[number, number]> => {
        let out: Array<[number, number]> = [[f.a, f.b]];
        for (const c of covered)
          if (c.y0 <= y + 0.01 && c.y1 >= y + STOREY - 0.01) out = out.flatMap(([p, q]) => (c.b <= p || c.a >= q ? [[p, q] as [number, number]] : ([[p, c.a], [c.b, q]] as Array<[number, number]>).filter(([p2, q2]) => q2 - p2 > 0.3)));
        return out;
      };
      for (let s = 0; s < t.storeys; s++) {
        const y = t.base + s * STOREY;
        // the Sky Lobby's storey and the Sky Park's keep their own walls, so their windows stay open (the plan's rule 2)
        if ((t.lobby !== undefined && Math.abs(y - t.lobby) < 0.5) || (t.park !== undefined && Math.abs(y - t.park) < 0.5) || (t.floors ?? []).some((q) => Math.abs(y - q) < 0.5)) continue;
        if (canyon) {
          if (lean) {
            for (let i = 0; i < fn; i++) {
              const id = pick(D.flat, kitHash(t.x, t.z, s, i, 30));
              const dm = dims(id);
              if (!dm) continue;
              const r = relief(id);
              const [x, z] = onFace(f, f.a + (i + 0.5) * fb, r.out);
              add(id, place(id, x, y, z, f.yaw, fb / dm.w, STOREY / dm.h, r.sz, true), 0, "flat");
            }
          } else {
            // the tower's own row for the storey, its relief pressed into canyonRelief
            const cr = rowsAt(s);
            const cEdge = s === 0 || s === t.storeys - 1 || bandTop[s];
            const cFar = !cEdge && !nearDeck(y) && cr.far;
            const cRow = s === 0 ? cr.ground : s === t.storeys - 1 || bandTop[s] ? cr.top : cFar ? cr.far! : cr.mid;
            const cn = Math.max(1, Math.round(len / (cFar && cr.farBay ? cr.farBay : cr.bay)));
            const cb = len / cn;
            const id = pick(cRow, kitHash(t.x, t.z, s, 32));
            const dm = dims(id);
            if (dm) {
              const pl = planeOf(id);
              const psz = pl > D.canyonRelief ? D.canyonRelief / pl : 1;
              for (let i = 0; i < cn; i++) {
                const u = f.a + (i + 0.5) * cb;
                // a room module whole, its front on the face; any other pressed into canyonRelief
                const st = seat(id, t, f, u - cb / 2, u + cb / 2, y) ?? { sz: psz, out: D.outset + pl * psz };
                const [x, z] = onFace(f, u, st.out);
                add(id, place(id, x, y, z, f.yaw, cb / dm.w, STOREY / dm.h, st.sz, true), 0, "flat", st.out);
              }
            }
          }
          continue;
        }
        const leanMid = (D.lean.mid as Record<string, string[]>)[fam];
        const rs = rowsAt(s);
        const edge = s === 0 || s === t.storeys - 1 || bandTop[s];
        const far = !edge && !nearDeck(y) && !(lean && leanMid) && rs.far;
        const leanTop = (D.lean as unknown as { top?: Record<string, string[]> }).top?.[fam];
        const row = s === 0 ? rs.ground : s === t.storeys - 1 || bandTop[s] ? (lean && leanTop ? leanTop : rs.top) : lean && leanMid ? leanMid : far ? rs.far! : rs.mid;
        const id = pick(row, kitHash(t.x, t.z, s, 1));
        // a far row's bays are its own width, and a band's its style's
        const rn = Math.max(1, Math.round(len / (far && rs.farBay ? rs.farBay : rs.bay)));
        const rb = len / rn;
        // a door the city cut in this storey (the Spire's drop): the bays over it narrowed to the wall either side
        const [fx0, fz0] = onFace(f, f.a, -0.1);
        const [fx1, fz1] = onFace(f, f.b, 0.3);
        const doorHere = KIT_SITES.doors.find(
          (q) => Math.max(fx0, fx1) > q.x0 && Math.min(fx0, fx1) < q.x1 && Math.max(fz0, fz1) > q.z0 && Math.min(fz0, fz1) < q.z1 && q.y0 < y + STOREY - 0.05 && q.y1 > y + 0.05,
        );
        const [da, db] = doorHere ? (f.nx !== 0 ? [doorHere.z0, doorHere.z1] : [doorHere.x0, doorHere.x1]) : [Infinity, -Infinity];
        // the bays over what the strips leave open, each stretch in bays of about the row's width
        const bays: Array<[number, number]> = [];
        for (const [p0, q0] of openAt(y)) {
          const m = Math.max(1, Math.round((q0 - p0) / rb));
          for (let i = 0; i < m; i++) bays.push([p0 + (i * (q0 - p0)) / m, p0 + ((i + 1) * (q0 - p0)) / m]);
        }
        for (const [ba, bb] of bays) {
          const spans = bb <= da || ba >= db ? [[ba, bb]] : [[ba, da], [db, bb]].filter(([a, b]) => b - a > 0.5);
          for (const [a, b] of spans) {
            const um = (a + b) / 2;
            // a pad's bay keeps a flat panel only where its row's module would stand out of the face (it cannot sit whole)
            // the row's module whole, its front on the face (seat); a pad's bay keeps a flat panel only where it cannot
            // sit whole (at a corner or before a stair core it would stand out into the pad's column)
            const room = seat(id, t, f, a, b, y);
            const piece = padBay(um) && !room && planeOf(id) + D.outset > 0.15 ? pick(D.flat, kitHash(um, s, 31)) : id;
            const pd = dims(piece);
            if (!pd) continue;
            // behind a fire escape a module that cannot sit whole is pressed as a canyon's is, so its relief stays behind
            // the landings
            const [ex, ez] = onFace(f, um, 1);
            const behind = inEscape(ex, ez, y + STOREY / 2, -0.5 + (b - a) / 2);
            const r = room ?? (behind ? { sz: planeOf(piece) > D.canyonRelief ? D.canyonRelief / planeOf(piece) : 1, out: D.outset + Math.min(planeOf(piece), D.canyonRelief) } : relief(piece));
            const [x, z] = onFace(f, um, r.out);
            add(piece, place(piece, x, y, z, f.yaw, (b - a) / pd.w, STOREY / pd.h, r.sz, true), 0, piece === id ? "facade" : "flat", room ? r.out : undefined);
          }
        }
        // up a street wall near a deck: an AC unit on a bay here and there, a pipe and a run of wires down one column
        if (!canyon && !edge && nearDeck(y) && openAt(y).length === 1 && openAt(y)[0][1] - openAt(y)[0][0] > len - 0.5) {
          for (let i = 0; i < n; i++) {
            const u = f.a + (i + 0.5) * bay;
            const [px, pz] = onFace(f, u, 0);
            if (nearPad(px, pz)) continue;
            if (inEscape(px, pz, y)) continue;
            if (kitHash(t.x, t.z, s, i, f.nx, f.nz, 2) < (alleyFace(f) ? A.ac : D.chance.wallAc)) {
              const ac = pick(D.wallAc, kitHash(u, s, 3));
              const [x, z] = onFace(f, u, D.outset + 0.05);
              add(ac, place(ac, x, y + 0.4, z, f.yaw, 1, 1, 1, true), 1, "ac");
            }
          }
          const col = f.a + (Math.floor(kitHash(t.x, t.z, f.nx, f.nz, 4) * n) + 0.02) * bay;
          const [cx, cz] = onFace(f, col, 0);
          if (!nearPad(cx, cz) && !inEscape(cx, cz, y)) {
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
      // a ledge over each band's top (dress stack): the line between two stacked buildings, pressed to ledgeDepth; not in a
      // canyon, a pad's column, a fire escape, a chimney's mouth, nor against a room's storey
      const ledge = ST?.ledge[fam];
      const ld = ledge ? dims(ledge) : null;
      if (ST && ledge && ld && !canyon) {
        const rooms = [t.lobby, t.park, ...(t.floors ?? [])].filter((v): v is number => v !== undefined);
        const Ch = cityCfg.chimneys;
        for (let s = 0; s < t.storeys; s++) {
          if (!bandTop[s]) continue;
          const yTop = t.base + (s + 1) * STOREY;
          if (rooms.some((r) => Math.abs(r - yTop) < 0.5 || Math.abs(r + STOREY - yTop) < 0.5)) continue;
          const lsz = Math.min(1, ST.ledgeDepth / ld.d);
          const ln = Math.max(1, Math.round(len / 8));
          const lb = len / ln;
          for (let i = 0; i < ln; i++) {
            const u = f.a + (i + 0.5) * lb;
            const [px, pz] = onFace(f, u, 1);
            if (nearPad(px, pz, D.clear.pad + lb / 2) || inEscape(px, pz, yTop, lb / 2) || Ch.list.some((c) => Math.abs(u - c.x) < Ch.width / 2 + Ch.wall + lb / 2 && (Math.abs(f.at - c.z0) < 2 || Math.abs(f.at - c.z1) < 2))) continue;
            const [x, z] = onFace(f, u, D.outset + ld.d * lsz);
            add(ledge, place(ledge, x, yTop - ld.h * 0.6, z, f.yaw, lb / ld.w, 1, lsz, true), 1, "cornice");
          }
        }
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
    // one of the family's styles (dress styles), as its towers wear
    const rows = pick([D.rows[fam], ...((D.styles as Record<string, unknown[]>)[fam] ?? [])], kitHash(p.x0, p.z0, 91)) as { bay: number; mid: string[] };
    const y0 = cityCfg.kerb;
    // its hall's doors (city.ts podiumBody), which the street floor leaves open
    const hall = KIT_SITES.halls.find((h) => h.x0 > p.x0 - 1 && h.x1 < p.x1 + 1 && h.z0 > p.z0 - 1 && h.z1 < p.z1 + 1);
    for (const f of faces(p.x0, p.x1, p.z0, p.z1)) {
      const len = f.b - f.a;
      // the street floor, in 8 m shops: clear of the public stair and of the pads that throw up this face
      const n = Math.max(1, Math.round(len / 8));
      const bay = len / n;
      const hallDoors = (hall?.doors ?? []).filter((d) => d.face === f.key);
      for (let i = 0; i < n; i++) {
        const u = f.a + (i + 0.5) * bay;
        const [fx, fz] = onFace(f, u, 1.5);
        if (inStair(fx, fz, D.clear.stair + bay / 2) || nearPad(fx, fz, D.clear.pad + bay / 2)) continue;
        // a bay with a hall's door in it: the door open, a shop window either side of it where there is room for one
        const inBay = hallDoors.filter((d) => d.u1 > u - bay / 2 && d.u0 < u + bay / 2);
        if (inBay.length) {
          const spans: Array<[number, number]> = [];
          let from = u - bay / 2;
          for (const d of [...inBay.sort((p2, q2) => p2.u0 - q2.u0), null]) {
            spans.push([from, d ? d.u0 - 0.15 : u + bay / 2]);
            if (d) from = d.u1 + 0.15;
          }
          // (Competitive on the wider side only, the very shop the bay wore before it had a door, narrowed)
          const widest = spans.reduce((a, s) => (s[1] - s[0] > a[1] - a[0] ? s : a));
          for (const [s0, s1] of lean ? [widest] : spans) {
            if (s1 - s0 < 1.4) continue;
            const id = lean ? pick(D.lean.shops, kitHash(p.x0, p.z0, u, 13)) : pick(D.shopPairs.windows, kitHash(p.x0, p.z0, s0, 37));
            const sd = dims(id);
            if (!sd) continue;
            const r = relief(id);
            const [x, z] = onFace(f, (s0 + s1) / 2, r.out);
            add(id, place(id, x, y0, z, f.yaw, (s1 - s0) / sd.w, STOREY / sd.h, r.sz, true), 0, "shop");
          }
          continue;
        }
        // from Balanced up, now and then a door and a window rather than one shop (dress shopPairs)
        const SP = D.shopPairs;
        const pair = !lean && kitHash(p.x0, p.z0, u, 33) < SP.chance;
        const door = pick(SP.doors, kitHash(p.x0, p.z0, u, 34));
        const win = pick(SP.windows, kitHash(p.x0, p.z0, u, 35));
        const parts: Array<[string, number, number]> = pair
          ? kitHash(p.x0, p.z0, u, 36) < 0.5
            ? [[door, u - bay / 4, bay / 2], [win, u + bay / 4, bay / 2]]
            : [[win, u - bay / 4, bay / 2], [door, u + bay / 4, bay / 2]]
          : [[pick(lean ? D.lean.shops : D.shops, kitHash(p.x0, p.z0, u, 13)), u, bay]];
        for (const [id, pu, pw] of parts) {
          const sd = dims(id);
          if (!sd) continue;
          const r = relief(id);
          const [x, z] = onFace(f, pu, r.out);
          add(id, place(id, x, y0, z, f.yaw, pw / sd.w, STOREY / sd.h, r.sz, true), 0, "shop");
        }
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

  // ------------------------------------------------ the halls inside the podiums (city.ts podiumBody, Phase 24.4)
  // An arcade: shop fronts facing in along every wall between the doors, a sign over every other one. From Balanced up:
  // Competitive's halls keep their lined walls and the line of light (the fronts were 107k triangles on its 620k)
  for (const h of lean ? [] : KIT_SITES.halls) {
    // each wall seen from inside: the hall's own faces turned about, at the same planes
    const inward: Array<[Face, "n" | "s" | "w" | "e"]> = [
      [{ key: "s", nx: 0, nz: 1, yaw: 0, at: h.z0, a: h.x0, b: h.x1 }, "n"],
      [{ key: "n", nx: 0, nz: -1, yaw: Math.PI, at: h.z1, a: h.x0, b: h.x1 }, "s"],
      [{ key: "e", nx: 1, nz: 0, yaw: Math.PI / 2, at: h.x0, a: h.z0, b: h.z1 }, "w"],
      [{ key: "w", nx: -1, nz: 0, yaw: -Math.PI / 2, at: h.x1, a: h.z0, b: h.z1 }, "e"],
    ];
    for (const [f, wall] of inward) {
      const doorsHere = h.doors.filter((d) => d.face === wall).sort((p2, q2) => p2.u0 - q2.u0);
      let from = f.a;
      for (const d of [...doorsHere, null]) {
        const to = d ? d.u0 - 0.15 : f.b;
        const run = to - from;
        const n = Math.floor(run / 5);
        for (let i = 0; i < n; i++) {
          const a = from + (i * run) / n;
          const b = from + ((i + 1) * run) / n;
          const u = (a + b) / 2;
          const id = pick(D.shops, kitHash(h.x0, h.z0, u, f.nx, f.nz, 38));
          const sd = dims(id);
          if (!sd) continue;
          const r = relief(id);
          const [x, z] = onFace(f, u, r.out);
          add(id, place(id, x, h.y0, z, f.yaw, (b - a) / sd.w, STOREY / sd.h, r.sz, true), 0, "shop");
          if (i % 2 === 0) {
            const sg = pick(D.signs, kitHash(h.x0, u, 39));
            const [sx, sz] = onFace(f, u, D.outset + 0.06);
            add(sg, place(sg, sx, h.y0 + STOREY + 0.5, sz, f.yaw, 1, 1, 1, true), 1, "sign");
          }
        }
        if (d) from = d.u1 + 0.15;
      }
    }
  }

  // ------------------------------------------------ the pads (city.ts padLook): the kit's round vent laid over each grate
  // (dress padVent), a wall vent turned to face up, flattened to `thick` and its top just over the floor. From Balanced up
  {
    const PV = (D as unknown as { padVent: { piece: string; size: number; roadSize: number; thick: number } }).padVent;
    const vd = dims(PV.piece);
    const base = standing(PV.piece, false);
    if (vd && base)
      for (const p of padsWorld) {
        const x = p.x - BR_X;
        const z = p.z - BR_Z;
        if (!inCentre(x, z)) continue;
        const s = (p.up === undefined ? PV.roadSize : PV.size) / vd.w;
        const m = base
          .clone()
          .premultiply(new THREE.Matrix4().makeTranslation(0, -vd.h / 2, 0))
          .premultiply(new THREE.Matrix4().makeScale(s, s, PV.thick / vd.d))
          .premultiply(new THREE.Matrix4().makeRotationX(-Math.PI / 2))
          .premultiply(new THREE.Matrix4().makeTranslation(x, (p.y ?? 0) + 0.03 - PV.thick / 2, z));
        add(PV.piece, m, 1, "prop");
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
          // neither end on a fire escape, its landings or its doorways
          const [e0, e1] = alongX ? [[along, f0], [along, f1]] : [[f0, along], [f1, along]];
          if (inEscape(e0[0], e0[1], y, 1) || inEscape(e1[0], e1[1], y, 1)) continue;
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
        // the doorways cut in this wall at this storey (a fire escape's), which the band leaves open
        const cut = KIT_SITES.doors
          .filter((q) => Math.abs(q.y0 - r.y) < 0.5 && (f.nx === 0 ? Math.abs((q.z0 + q.z1) / 2 - f.at) < 0.6 : Math.abs((q.x0 + q.x1) / 2 - f.at) < 0.6))
          .map((q) => (f.nx === 0 ? [q.x0, q.x1] : [q.z0, q.z1]) as [number, number]);
        const spans = [
          [f.a, c - win / 2],
          [c + win / 2, f.b],
        ].flatMap(([a, b]) => {
          let out: Array<[number, number]> = [[a, b]];
          for (const [d0, d1] of cut) out = out.flatMap(([p, q]) => (d1 <= p || d0 >= q ? [[p, q] as [number, number]] : ([[p, d0 - 0.05], [d1 + 0.05, q]] as Array<[number, number]>)));
          return out;
        });
        for (const [a, b] of spans) {
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
        if (intoWindow || inEscape(u, near, y, 1) || inEscape(u, far, y, 1)) return;
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

  // ------------------------------------------------ the fire escapes (city.json fireEscape): the family's pieces over the city's boxes
  {
    const E = D.escapes;
    const yawOf = { n: Math.PI, s: 0, w: -Math.PI / 2, e: Math.PI / 2 } as const;
    for (const e of KIT_SITES.escapes) {
      const fam = (E.families as Record<string, (typeof E.families)[keyof typeof E.families] | undefined>)[e.family];
      if (!fam) continue;
      const along = (x: number, out: number): [number, number] => {
        const u = e.uStart + e.dir * x;
        return e.face === "n" || e.face === "s" ? [u, e.at + (e.face === "s" ? 1 : -1) * out] : [e.at + (e.face === "e" ? 1 : -1) * out, u];
      };
      for (let k = 1; k < e.storeys; k++) {
        // the lowest the drop ladder's (its landing measured higher, so drawn a storey tall), the highest High City's
        // with the gooseneck over the parapet, a tile between
        const top = k === e.storeys - 1 && fam.top ? fam.top : null;
        const id = k === 1 ? fam.down : (top ?? fam.tile);
        const dm = dims(id);
        if (!dm) continue;
        const sy = k === 1 ? STOREY / fam.downLanding : 1;
        const [x, z] = along(dm.w / 2 - (top ? fam.topShift[0] : 0), (dm.d - (top ? fam.topShift[1] : 0)) * E.depthScale);
        add(id, place(id, x, e.base + (k - 1) * STOREY, z, yawOf[e.face], 1, sy, E.depthScale, true), 1, "escape");
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
