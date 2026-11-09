// The Neon City map (Phase 28, src/game/neonmap.ts, src/config/neonmap.json): built headless as the game builds it, off
// the collision the bake measured (src/config/neon/neonmap.solids.json). Its nine places each with their drops on the
// street; the street one network the bots walk; the collision the bake wrote, all of it; the tallest building's top
// where the ship passes; and every jump pad the bake found, ridden by a player's own movement as a match throws it
// (brplay.ts: straight up, carried across once above its roof's edge), onto its roof, its landing joined to the roof's
// graph wherever a bot is sent up it.
//
// Run on its own: GAME=speedkills npx tsx tools/checks/sk-neon.ts (npm run verify runs it).
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import * as THREE from "three";

const g = globalThis as unknown as Record<string, unknown>;
const hadDocument = "document" in g;
const anyProxy = (): unknown =>
  new Proxy(function () {}, {
    get: (_t, k) => (k === "measureText" ? () => ({ width: 10 }) : k === Symbol.toPrimitive ? () => 0 : k === "width" || k === "height" ? 64 : anyProxy()),
    set: () => true,
    apply: () => anyProxy(),
  });
const fakeEl = (): unknown => ({ width: 64, height: 64, style: {}, getContext: () => anyProxy(), addEventListener() {}, removeEventListener() {}, set src(_v: string) {} });
if (!hadDocument) g.document = { createElement: () => fakeEl(), createElementNS: () => fakeEl() };
const warn = console.warn;
console.warn = () => undefined;
const { buildNeonMap, neonFillSpots, neonFillPool, neonFillColours, wellFrame, ropeFrames } = await import("../../src/game/neonmap");
const { Player } = await import("../../src/game/player");
const { BR_X, BR_Z, BR_HALF } = await import("../../src/game/br");
const { SPIRE_TOP } = await import("../../src/game/world");
const { LootField } = await import("../../src/game/loot");
const brmapCfg = (await import("../../src/config/brmap.json")).default;
const { RANGE_SOLIDS } = await import("../../src/game/range");
const { solidsIn } = await import("../../src/game/solidgrid");
const { floorAt } = await import("../../src/game/floors");
const { MOVE } = await import("../../src/game/movement");
const { streets: curvedStreets, StreetField } = await import("../neon-streets");
const cfg = (await import("../../src/config/neonmap.json")).default;
const worldCfg = (await import("../../src/config/world.json")).default;
const SOLIDS = (await import("../../src/config/neon/neonmap.solids.json")).default;
const firstSolid = RANGE_SOLIDS.length;
// (the page asks for the boxes after its first screen, neonmap.ts loadNeonSolids; a check has them now)
const scene = new THREE.Scene();
const map = buildNeonMap(scene, (SOLIDS as { solids: number[][] }).solids);
console.warn = warn;
if (!hadDocument) delete g.document;

type Action = import("../../src/game/input").Action;
let fails = 0;
function check(label: string, cond: boolean, detail = ""): void {
  if (!cond) fails++;
  console.log(`${cond ? "  ok  " : "FAIL  "}${label}${detail ? ` (${detail})` : ""}`);
}
const idle = { held: (_a: Action) => false, pressedNow: (_a: Action) => false };

console.log("SpeedKills: the Neon City map (neonmap.ts)");

// the interiors' fill (game.fill): a lamp spot under every ceiling of the base's storeys and the tower's floors, and a
// grid over the court and the station, each spot over a floor with a standing body's room under it
{
  const spots = neonFillSpots();
  const floorsOf = (ys: number[], tol: number) => ys.map((y) => spots.filter((q) => Math.abs(q.y - (y + 3.5 - 0.5 - 0.3)) < tol).length);
  const base = floorsOf((cfg.rules.base.storeys as number[]), 0.2);
  // (each tower floor under its own ceiling, the storey over it less the slab: the halls at 35 m are a 3.5 m storey, and
  // their lamps hung for a 3 m one floated half a metre under it)
  const ST = (cfg.rules.tower as unknown as { core: { storeys: number[] } }).core.storeys;
  const tower = (cfg.tower as unknown as { shaft: number[] }).shaft.map((h) => spots.filter((q) => Math.abs(q.y - (ST[ST.indexOf(h) + 1] - 0.5 - 0.3)) < 0.2).length);
  const court = spots.filter((q) => Math.abs(q.y - (cfg.court.y + cfg.game.fill.height)) < 0.1).length;
  const station = spots.filter((q) => Math.abs(q.y - (-10 + cfg.game.fill.height)) < 0.1).length;
  const bare = spots.filter((q) => floorAt(q.x, q.z) > q.y - 1 || solidsIn(q.x, q.x, q.z, q.z).some((b) => q.x >= b.minX && q.x <= b.maxX && q.z >= b.minZ && q.z <= b.maxZ && b.base < q.y && b.top > q.y));
  check("the interiors' fill: lamp spots under every ceiling of the base and the tower, and over the court and the station", base.every((n) => n >= 6) && tower.every((n) => n >= 3) && court >= 8 && station >= 6, `base ${base.join("/")}, tower ${tower.join("/")}, court ${court}, station ${station}`);
  check("the interiors' fill: no spot inside something solid", bare.length === 0, `${bare.length} of ${spots.length}`);
  // (its pool sized by the graphics preset, game.fill.byPreset: each light is in every lit shader per pixel; the checks
  // run as Competitive, the default with no storage)
  const FB = (cfg.game.fill as unknown as { count: number; byPreset?: Record<string, number> });
  check("the interiors' fill: its pool sized by preset, fewer lights on Competitive and Balanced than High's", !!FB.byPreset && FB.byPreset.competitive < FB.byPreset.balanced && FB.byPreset.balanced < FB.count && neonFillPool() === FB.byPreset.competitive, `${neonFillPool()} lights here (Competitive); ${JSON.stringify(FB.byPreset ?? {})}, High ${FB.count}`);
}

// the nine places, each with its drops on the street
check("nine places, as the city's sectors", map.pois.length === 9, map.pois.map((p) => p.id).join(","));
const few = map.pois.filter((p) => p.drops.length < cfg.game.drops);
check(`each place with its ${cfg.game.drops} drops`, few.length === 0, few.map((p) => `${p.id}:${p.drops.length}`).join(" "));
const dropsOff = map.pois.flatMap((p) => p.drops).filter((d) => !map.nodes.some((n) => !n.y && Math.hypot(n.x - d.x, n.z - d.z) < 0.01 && n.links.length));
check("every drop on a street node the bots walk from", dropsOff.length === 0, `${dropsOff.length} off`);

// the street one network: every street node that walks anywhere reaches the rest
const street = map.nodes.map((n, i) => ({ n, i })).filter(({ n }) => !n.y && n.links.length);
const seen = new Set<number>([street[0]?.i ?? 0]);
const todo = [street[0]?.i ?? 0];
while (todo.length) for (const j of map.nodes[todo.pop()!].links) if (!map.nodes[j].y && !seen.has(j)) (seen.add(j), todo.push(j));
// (at least 640: the districts past the ring road stand on what was open street, THE CANYON's solid blocks alone on about
// 60 of the south-west's nodes, 735 to 677; the districts' cover within 6 m, Milestone 671, 253 pieces, took 10 more,
// 659 to 649, each piece off the nodes and the streets whole but standing at the edge of some)
check("the street a network of at least 640 nodes", street.length >= 640, `${street.length}`);
check("the street one network: every street node reaches the rest", seen.size === street.length, `${seen.size} of ${street.length}` + (seen.size < street.length ? `; cut off: ${street.filter(({ i }) => !seen.has(i)).slice(0, 4).map(({ n }) => `(${(n.x - BR_X).toFixed(1)}, ${(n.z - BR_Z).toFixed(1)})`).join(" ")}` : ""));

// the collision the bake wrote, all of it; the tallest building's top where the ship passes
// (and the street's slab over each of the court's halls and over the station, its tunnel and its concourse; and THE WELL's
// frame's post, Milestone 1091)
const slabs = cfg.court.halls.length + cfg.underground.slabs.length + (wellFrame() ? 1 : 0) + ropeFrames().length;
check("the collision the bake measured, every box, and the street's slab over each hall and the station", RANGE_SOLIDS.length - firstSolid === SOLIDS.solids.length + slabs && SOLIDS.solids.length === cfg.baked.boxes, `${RANGE_SOLIDS.length - firstSolid} of ${SOLIDS.solids.length} + ${slabs}, bake ${cfg.baked.boxes}`);
check("the ship passes the tallest building's top", Math.abs(SPIRE_TOP.y - cfg.tallest.top) < 1e-6 && SPIRE_TOP.y > 100, `${SPIRE_TOP.y}`);

// Head-high cover in the districts' open ground (Milestone 660; the districts' first review: "no stretch past about 15 m
// without head-high cover"): measured off the bake's collision, at the ground and each of rules.dress.districtCover's
// levels, every open spot of the band past the ring road within `far` of a box a standing body hides behind. Allowed:
// 1% of a district's ground past it and nothing past 10 m; on the raised levels (THE TERRACES' tiers, GLASS HEIGHTS'
// deck) 10% and nothing past 15 m
{
  const DC = (cfg.rules.dress as { districtCover?: { far: number; farBy?: Record<string, number>; tall: number; band: number[]; levels: Array<{ y: number; far?: number; districts?: string[]; rect?: number[] }>; sectors: Record<string, string> } }).districtCover;
  const said: string[] = [];
  let ok = !!DC && ((cfg as { districtCover?: unknown[] }).districtCover?.length ?? 0) >= 200;
  if (DC) {
    const C = 0.5, H = DC.band[1] + 2, N = Math.round((2 * H) / C);
    const sectorOf = (x: number, z: number) => (Math.abs(x) <= 50 ? (z < 0 ? "n" : "s") : Math.abs(z) <= 50 ? (x < 0 ? "w" : "e") : (z < 0 ? "n" : "s") + (x < 0 ? "w" : "e"));
    // (lowest first: cover is a stack climbed from the floor, a crate on crates head-high as surely as a wall)
    const boxes = [...(SOLIDS as { solids: number[][] }).solids].sort((a, b) => a[4] - b[4]);
    for (const L of DC.levels) {
      const y0 = L.y;
      const body = new Uint8Array(N * N), cover = new Uint8Array(N * N), floor = new Uint8Array(N * N);
      const stack = new Float32Array(N * N).fill(y0 + 0.45);
      for (const b of boxes) {
        if (b[1] < -H || b[0] > H || b[3] < -H || b[2] > H) continue;
        const i0 = Math.max(0, Math.floor((b[0] + H) / C)), i1 = Math.min(N - 1, Math.floor((b[1] + H) / C));
        const j0 = Math.max(0, Math.floor((b[2] + H) / C)), j1 = Math.min(N - 1, Math.floor((b[3] + H) / C));
        for (let i = i0; i <= i1; i++)
          for (let j = j0; j <= j1; j++) {
            const k = i * N + j;
            if (b[4] < y0 + 1.8 && b[5] > y0 + 0.3) body[k] = 1;
            if (b[4] <= stack[k] + 0.05 && b[4] >= y0 - 0.5 && b[5] > stack[k]) stack[k] = b[5];
            if (stack[k] > y0 + DC.tall) cover[k] = 1;
            if (Math.abs(b[5] - y0) <= 0.35) floor[k] = 1;
          }
      }
      const D = new Float32Array(N * N);
      for (let k = 0; k < D.length; k++) D[k] = cover[k] ? 0 : 1e9;
      for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) { const k = i * N + j; if (i > 0) D[k] = Math.min(D[k], D[k - N] + 1, j > 0 ? D[k - N - 1] + Math.SQRT2 : 1e9, j < N - 1 ? D[k - N + 1] + Math.SQRT2 : 1e9); if (j > 0) D[k] = Math.min(D[k], D[k - 1] + 1); }
      for (let i = N - 1; i >= 0; i--) for (let j = N - 1; j >= 0; j--) { const k = i * N + j; if (i < N - 1) D[k] = Math.min(D[k], D[k + N] + 1, j < N - 1 ? D[k + N + 1] + Math.SQRT2 : 1e9, j > 0 ? D[k + N - 1] + Math.SQRT2 : 1e9); if (j < N - 1) D[k] = Math.min(D[k], D[k + 1] + 1); }
      const per = new Map<string, { open: number; far: number; max: number }>();
      for (let i = 0; i < N; i++)
        for (let j = 0; j < N; j++) {
          const k = i * N + j, x = -H + (i + 0.5) * C, z = -H + (j + 0.5) * C;
          const m = Math.max(Math.abs(x), Math.abs(z));
          const d = DC.sectors[sectorOf(x, z)];
          if (m < DC.band[0] || m > DC.band[1] || body[k] || !(floor[k] || y0 === 0) || (L.districts && !L.districts.includes(d))) continue;
          if (L.rect && !(x >= L.rect[0] && x <= L.rect[1] && z >= L.rect[2] && z <= L.rect[3])) continue;
          const st = per.get(d) ?? per.set(d, { open: 0, far: 0, max: 0 }).get(d)!;
          st.open++;
          // (a district's own `far` on the ground, Milestone 821)
          if (D[k] * C > (L.far ?? (y0 === 0 ? DC.farBy?.[d] : undefined) ?? DC.far)) st.far++;
          st.max = Math.max(st.max, D[k] * C);
        }
      // (nothing on the ground past 8.5 m: the fill holds 6 m, and where no piece fits, as by THE STACKS' towers, a spot
      // or two stand a little past 8)
      for (const [d, st] of per) {
        const [share, most] = y0 === 0 ? [0.01, (DC.farBy?.[d] ?? DC.far) + 2.5] : [0.1, 15];
        const bad = st.far / st.open > share || st.max > most;
        if (bad) ok = false;
        if (bad || y0 === 0) said.push(`${d}${y0 ? ` at ${y0} m` : ""} ${((st.far / st.open) * 100).toFixed(1)}%, farthest ${st.max.toFixed(1)} m${bad ? " (too far)" : ""}`);
      }
    }
  }
  check(`the districts' open ground: head-high cover within ${DC?.far ?? 0} m of every spot on the ground (a raised level its own), nothing on the ground past 8.5 m (1% of a district's ground, 10% of a raised level, may lack it), 200 pieces or more`, ok, said.join("; "));
}

// The city's air thin and its bloom almost none (Milestone 658; the owner, 2026-10-18: "thin the golden-hour haze ... bloom
// is a big thing, we don't want that almost at all ... the night fog, just a bit if anything"): the haze's far end
// 400 m and more by day and no nearer by night, its near end 40 m and more; the bloom's strength 0.1 at most and its
// threshold 1 and more
{
  const air = cfg.game.air as { near: number; far: number; nightNear?: number; nightFar?: number };
  const bloom = (worldCfg as { bloom?: { strength: number; threshold: number } }).bloom;
  const thin = air.far >= 400 && air.near >= 40 && (air.nightFar ?? air.far) >= air.far && (air.nightNear ?? air.near) >= 40;
  check("the city's air thin by day and thinner by night, and its bloom almost none (the owner's calls)", thin && !!bloom && bloom.strength <= 0.1 && bloom.threshold >= 1, `haze ${air.near} to ${air.far} m by day, ${air.nightNear} to ${air.nightFar} m by night; bloom ${bloom?.strength} over ${bloom?.threshold}`);
}

// The centre's draws (Milestone 657, docs/PLAN_CITY_DRAWS.md): at each size rules.bake.batch names, the bake wrote the
// centre's opaque lit materials in batches over texture arrays (tools/import-city.ts writePack, src/game/neonbatch.ts),
// so the centre is under half the 441 primitives of one a material, each of which was drawn whichever way a camera
// looked; and no batch past 255 materials and a neutral layer, no array past 256 layers (WebGL 2's least) or the cap's
// bytes at a byte a pixel and its mips
{
  const BR = (cfg.rules.bake as { batch?: { sizes: string[]; capMB: number } }).batch;
  const draw = ((cfg.baked as { draw?: Record<string, { size: number[]; batches: number[]; layers: Record<string, number[]>; left: number }> }).draw ?? {});
  const said: string[] = [];
  const ok = !!BR && BR.sizes.every((s) => {
    const d = draw[s];
    if (!d) return said.push(`${s}: not batched`), false;
    const prims = d.batches.length + d.left;
    const bytes = (kind: string, n: number) => n * (kind === "normal" ? d.size[1] : d.size[0]) ** 2 * (4 / 3);
    const big = Object.entries(d.layers).flatMap(([kind, v]) => v.filter((n) => n > 256 || bytes(kind, n) > BR.capMB * 1e6).map((n) => `${kind} ${n} layers`));
    said.push(`${s}: ${prims} primitives (${d.batches.length} batches of ${d.batches.join("/")} materials, ${d.left} left), arrays of ${Object.entries(d.layers).map(([k, v]) => `${k} ${v.join("/")}`).join(", ")}${big.length ? `; too big: ${big.join(", ")}` : ""}`);
    return prims <= 220 && d.batches.every((n) => n <= 255) && big.length === 0;
  });
  check("the centre's draws: its opaque materials in batches over texture arrays at each size named, under half its 441 primitives, every array within WebGL 2's 256 layers and its byte cap", ok, said.join("; "));
}

// the court the tallest building stands in: a body dropped in its corners stands on its drawn floor, 7 m down, not on
// the street's height over nothing (the hole showed the sky through the world before it was floored). Dropped from under
// the street: the base's ground floor covers the court now (rules.base), a basement under it
const K = cfg.court;
const rests = [
  [K.x0 + 1, K.z0 + 1],
  [K.x1 - 1, K.z0 + 1],
  [K.x0 + 1, K.z1 - 1],
  [K.x1 - 1, K.z1 - 1],
].map(([x, z]) => {
  const p = new Player({ minX: BR_X - 400, maxX: BR_X + 400, minZ: BR_Z - 400, maxZ: BR_Z + 400 });
  p.teleport(x + BR_X, -5, z + BR_Z, 0);
  let t = 1000;
  for (let i = 0; i < 2 * 144; i++) p.update(1 / 144, (t += 1 / 144), idle, 0, 1, false);
  return +p.pos.y.toFixed(2);
});
const tiles = cfg.chunks["c-court"].place.filter((q) => q[5] === "g" && String(q[0]).endsWith(cfg.rules.ground.tile)).length;
check("the court round the tallest building: a body dropped in its corners stands on its floor, 7 m down, and it is drawn", K.y < -6 && rests.every((y) => Math.abs(y - K.y) < 0.05) && tiles * 100 >= (K.x1 - K.x0) * (K.z1 - K.z0), `rests at ${rests.join(", ")}; ${tiles} tiles`);
// Its floor and its cover (Milestone 655; the sixth review: "a bare trench", its pavement read as grass underground):
// every tile of its floor worn in rules.court.floorMat; each set of its cover solid from the floor to 1.4 m or more;
// and none of it shuts any of the court off. Walked on foot from a corner an eighth of a metre at a time, a body the
// square round the player's round one, every spot reached without the cover is reached with it but those it stands on
{
  const worn = cfg.chunks["c-court"].place.filter((q) => q[5] === "g" && String(q[0]).endsWith(cfg.rules.ground.tile) && q[6] === cfg.rules.court.floorMat).length;
  const cover = ((K as { cover?: number[][] }).cover ?? []).map(([x, z, hx, hz, top]) => ({ x: x + BR_X, z: z + BR_Z, hx, hz, top }));
  type Box = { minX: number; maxX: number; minZ: number; maxZ: number; base: number; top: number };
  // (a set's boxes: its pieces collide as faces in half-metre columns, which stand out of the set's own box by up to that)
  const ofCover = (b: Box) => cover.some((c) => b.minX >= c.x - c.hx - 0.5 && b.maxX <= c.x + c.hx + 0.5 && b.minZ >= c.z - c.hz - 0.5 && b.maxZ <= c.z + c.hz + 0.5 && b.base >= K.y - 0.1 && b.top <= c.top + 0.1);
  const tall = cover.map((c) => {
    const bs = solidsIn(c.x - c.hx + 0.1, c.x + c.hx - 0.1, c.z - c.hz + 0.1, c.z + c.hz - 0.1).filter((b) => b.minX < c.x + c.hx - 0.1 && b.maxX > c.x - c.hx + 0.1 && b.minZ < c.z + c.hz - 0.1 && b.maxZ > c.z - c.hz + 0.1 && b.base <= K.y + 0.1);
    return bs.length ? Math.max(...bs.map((b) => b.top)) - K.y : 0;
  });
  const C = 0.125, H = MOVE.radius;
  const [NI, NJ] = [Math.round((K.x1 - K.x0) / C), Math.round((K.z1 - K.z0) / C)];
  const floorOf = (i: number, j: number, without: boolean): number | null => {
    const [wx, wz] = [K.x0 + (i + 0.5) * C + BR_X, K.z0 + (j + 0.5) * C + BR_Z];
    const here = solidsIn(wx - H, wx + H, wz - H, wz + H).filter((b) => b.minX < wx + H && b.maxX > wx - H && b.minZ < wz + H && b.maxZ > wz - H && !(without && ofCover(b)));
    let f = K.y;
    for (const b of here) if (b.top <= K.y + MOVE.stepHeight && b.top > f) f = b.top;
    return here.some((b) => b.base < f + MOVE.standHeight && b.top > f + MOVE.stepHeight) ? null : f;
  };
  const walk = (without: boolean) => {
    const seen = new Set<number>();
    const [si, sj] = [NI - 1 - Math.round(1 / C), NJ - 1 - Math.round(1 / C)];
    const todo: Array<[number, number]> = [];
    const f0 = floorOf(si, sj, without);
    if (f0 !== null) (seen.add(si * NJ + sj), todo.push([si * NJ + sj, f0]));
    while (todo.length) {
      const [k, y] = todo.pop()!;
      const [i, j] = [Math.floor(k / NJ), k % NJ];
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const [a2, b2] = [i + di, j + dj];
        if (a2 < 0 || b2 < 0 || a2 >= NI || b2 >= NJ || seen.has(a2 * NJ + b2)) continue;
        const f = floorOf(a2, b2, without);
        if (f === null || Math.abs(f - y) > MOVE.stepHeight) continue;
        seen.add(a2 * NJ + b2);
        todo.push([a2 * NJ + b2, f]);
      }
    }
    return seen;
  };
  const [bare, laid] = [walk(true), walk(false)];
  const shut: string[] = [];
  for (const k of bare) if (!laid.has(k) && floorOf(Math.floor(k / NJ), k % NJ, false) !== null) shut.push(`(${(K.x0 + (Math.floor(k / NJ) + 0.5) * C).toFixed(1)}, ${(K.z0 + ((k % NJ) + 0.5) * C).toFixed(1)})`);
  check("the court: its floor in marble, its cover standing on it 1.4 m and more, and none of the court shut off by it", tiles > 0 && worn === tiles && cover.length >= 6 && tall.every((h) => h >= 1.4) && shut.length === 0 && laid.size > 0.5 * NI * NJ, `${worn} of ${tiles} tiles in ${cfg.rules.court.floorMat}; ${cover.length} sets of cover, ${tall.map((h) => h.toFixed(1)).join("/")} m; walked over ${((laid.size / (NI * NJ)) * 100).toFixed(0)}% of its floor, ${shut.length} spots shut off${shut.length ? `: ${shut.slice(0, 3).join(", ")}` : ""}`);
}
// its halls: from the court's floor a body sprints down each one to its far end, on the court's floor all the way; and
// on the plaza over a hall it stands at the street's height, not fallen through onto the corridor's roof
const sprint = (x: number, z: number, y: number, yaw: number, s: number) => {
  const p = new Player({ minX: BR_X - 400, maxX: BR_X + 400, minZ: BR_Z - 400, maxZ: BR_Z + 400 });
  p.sprintMode = "auto";
  p.teleport(x + BR_X, y, z + BR_Z, yaw);
  const run = { held: (a: Action) => a === "forward", pressedNow: (_a: Action) => false };
  let t = 1000;
  let low = Infinity;
  for (let i = 0; i < s * 144; i++) {
    p.update(1 / 144, (t += 1 / 144), run, 0, 1, false);
    low = Math.min(low, p.pos.y);
  }
  return { x: p.pos.x - BR_X, z: p.pos.z - BR_Z, y: p.pos.y, low };
};
for (const h of K.halls.filter((q) => !("route" in q) && !("open" in q))) {
  // from 3 m inside the court's edge, straight down the hall's middle line
  const alongX = h.z1 - h.z0 < h.x1 - h.x0;
  const [mx, mz] = [(h.x0 + h.x1) / 2, (h.z0 + h.z1) / 2];
  const out = alongX ? Math.sign(mx) : Math.sign(mz);
  const [fx, fz] = alongX ? [out > 0 ? K.x1 - 3 : K.x0 + 3, mz] : [mx, out > 0 ? K.z1 - 3 : K.z0 + 3];
  const yaw = alongX ? (out > 0 ? -90 : 90) : out > 0 ? 180 : 0;
  const r = sprint(fx, fz, K.y + 0.05, yaw, 3);
  const far = alongX ? (out > 0 ? h.x1 : h.x0) : out > 0 ? h.z1 : h.z0;
  const gone = Math.abs((alongX ? r.x : r.z) - far);
  // (the plaza over its corridor: an entrance's well beyond is open to the street; not sunk through is what counts, the
  // base's walls stand over some of them now)
  const [sx0, sx1, sz0, sz1] = h.slab;
  const over = sprint((sx0 + sx1) / 2, (sz0 + sz1) / 2, 0.05, yaw, 0.5);
  check(`hall at (${mx.toFixed(0)}, ${mz.toFixed(0)}): walked from the court to its far wall on the court's floor, and the plaza over it holds a body`, gone < 1.2 && Math.abs(r.y - K.y) < 0.05 && r.low > K.y - 0.05 && over.y > -0.05, `ended ${gone.toFixed(2)} m from its end at ${r.y.toFixed(2)} m; on the plaza over it ${over.y.toFixed(2)} m`);
}
// The side rooms of the court's shop corridors (rules.court.halls, the pack's noodle bar and market): each walked into on
// foot from its hall's middle, an eighth of a metre at a time, a body the square round the player's round one, a step
// up at a time; most of each room's floor with a standing body's room over it is reached (its tables and stools take
// the rest), and the street over it holds a body
for (const h of K.halls) {
  const rooms = cfg.underground.floors.filter((f) => "room" in f && f.rect[0] < h.x1 && f.rect[1] > h.x0 && f.rect[2] < h.z1 + 0.01 && f.rect[3] > h.z0 - 0.01 && (f.rect[2] >= h.z1 - 0.01 || f.rect[3] <= h.z0 + 0.01 || f.rect[0] >= h.x1 - 0.01 || f.rect[1] <= h.x0 + 0.01)).map((f) => f.rect);
  if (!rooms.length) continue;
  const C = 0.125, H = MOVE.radius;
  const all = [[h.x0, h.x1, h.z0, h.z1], ...rooms];
  const inside = (x: number, z: number) => all.some(([x0, x1, z0, z1]) => x >= x0 && x <= x1 && z >= z0 && z <= z1);
  const [X0, X1, Z0, Z1] = [Math.min(...all.map((r) => r[0])), Math.max(...all.map((r) => r[1])), Math.min(...all.map((r) => r[2])), Math.max(...all.map((r) => r[3]))];
  const [NI, NJ] = [Math.ceil((X1 - X0) / C), Math.ceil((Z1 - Z0) / C)];
  const floorOf = (i: number, j: number): number | null => {
    const x = X0 + (i + 0.5) * C, z = Z0 + (j + 0.5) * C;
    if (!inside(x, z)) return null;
    const [wx, wz] = [x + BR_X, z + BR_Z];
    const here = solidsIn(wx - H, wx + H, wz - H, wz + H).filter((b) => b.minX < wx + H && b.maxX > wx - H && b.minZ < wz + H && b.maxZ > wz - H);
    let f = K.y;
    for (const b of here) if (b.top <= K.y + MOVE.stepHeight && b.top > f) f = b.top;
    return here.some((b) => b.base < f + MOVE.standHeight && b.top > f + MOVE.stepHeight) ? null : f;
  };
  const seen = new Map<number, number>();
  const [si, sj] = [Math.floor(((h.x0 + h.x1) / 2 - X0) / C), Math.floor(((h.z0 + h.z1) / 2 - Z0) / C)];
  const f0 = floorOf(si, sj);
  const todo: number[] = [];
  if (f0 !== null) (seen.set(si * NJ + sj, f0), todo.push(si * NJ + sj));
  while (todo.length) {
    const k = todo.pop()!;
    const [i, j, y] = [Math.floor(k / NJ), k % NJ, seen.get(k)!];
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const [a2, b2] = [i + di, j + dj];
      if (a2 < 0 || b2 < 0 || a2 >= NI || b2 >= NJ || seen.has(a2 * NJ + b2)) continue;
      const f = floorOf(a2, b2);
      if (f === null || Math.abs(f - y) > MOVE.stepHeight) continue;
      seen.set(a2 * NJ + b2, f);
      todo.push(a2 * NJ + b2);
    }
  }
  const shares = rooms.map(([x0, x1, z0, z1]) => {
    let [got, of] = [0, 0];
    for (let i = 0; i < NI; i++)
      for (let j = 0; j < NJ; j++) {
        const x = X0 + (i + 0.5) * C, z = Z0 + (j + 0.5) * C;
        if (x < x0 || x > x1 || z < z0 || z > z1 || floorOf(i, j) === null) continue;
        of++;
        if (seen.has(i * NJ + j)) got++;
      }
    return of ? got / of : 0;
  });
  const over = rooms.map(([x0, x1, z0, z1]) => sprint((x0 + x1) / 2, (z0 + z1) / 2, 0.05, 0, 0.5).y);
  check(`hall at (${((h.x0 + h.x1) / 2).toFixed(0)}, ${((h.z0 + h.z1) / 2).toFixed(0)}): its side rooms walked into from the hall, and the street over them holds a body`, shares.every((q) => q >= 0.6) && over.every((y) => y > -0.05), `${shares.map((q) => `${(q * 100).toFixed(0)}%`).join(", ")} of their floors reached; on the street over them ${over.map((y) => y.toFixed(2)).join(", ")} m`);
}
// (an entrance's hall: the plaza over its corridor holds a body too; its walk is its route, below)
for (const h of K.halls.filter((q) => "route" in q)) {
  const [sx0, sx1, sz0, sz1] = h.slab;
  const over = sprint((sx0 + sx1) / 2, (sz0 + sz1) / 2, 0.05, 0, 0.5);
  // (over an entrance's corridor stands its kiosk, whose floor is a few centimetres up: not sunk through is what counts)
  check(`hall at (${((h.x0 + h.x1) / 2).toFixed(0)}, ${((h.z0 + h.z1) / 2).toFixed(0)}): the plaza over its corridor holds a body`, over.y > -0.05, `${over.y.toFixed(2)} m`);
}

// each entrance walked by a player's own movement along its way through (rules.court.entrance.route): from the plaza
// beside its kiosk into it, down its two flights and along its hall into the court; and back up and out
const along = (pts: number[][]): { k: number; x: number; z: number; y: number } => {
  const p = new Player({ minX: BR_X - 400, maxX: BR_X + 400, minZ: BR_Z - 400, maxZ: BR_Z + 400 });
  p.sprintMode = "auto";
  p.teleport(pts[0][0] + BR_X, pts[0][2] + 0.05, pts[0][1] + BR_Z, 0);
  const run = { held: (a: Action) => a === "forward", pressedNow: (_a: Action) => false };
  let t = 1000;
  let k = 1;
  for (let i = 0; i < 30 * 144 && k < pts.length; i++) {
    const [tx, tz, ty] = pts[k];
    const dx = tx - (p.pos.x - BR_X), dz = tz - (p.pos.z - BR_Z);
    if (Math.hypot(dx, dz) < 0.35 && Math.abs(p.pos.y - ty) < 1) {
      k++;
      continue;
    }
    p.yaw = (Math.atan2(-dx, -dz) * 180) / Math.PI;
    p.update(1 / 144, (t += 1 / 144), run, 0, 1, false);
  }
  return { k, x: p.pos.x - BR_X, z: p.pos.z - BR_Z, y: p.pos.y };
};
for (const h of K.halls.filter((q) => "route" in q && q.route)) {
  const route = (h as { route: number[][] }).route;
  const down = along(route);
  const up = along([...route].reverse());
  check(`the entrance at (${route[1][0].toFixed(0)}, ${route[1][1].toFixed(0)}): a player walks from the plaza down into the court, and back up`, down.k === route.length && up.k === route.length, `down ${down.k - 1} of ${route.length - 1} legs to (${down.x.toFixed(1)}, ${down.z.toFixed(1)}) at ${down.y.toFixed(2)} m; up ${up.k - 1} to (${up.x.toFixed(1)}, ${up.z.toFixed(1)}) at ${up.y.toFixed(2)} m`);
}

// every pad the bake found, ridden: a player stood on it thrown as a match throws it (brplay.ts), straight up and carried
// across once above `over`, or a way down thrown out at once
const SPINE = (cfg as unknown as { spine: { up: Array<{ id: string; face: number[]; out: number[]; pad: number[]; floor: number; roof: number; land: number; ground: number }>; down: Array<{ id: string; pad: number[]; floor: number; land: number[]; landY: number }>; across: Array<{ id: string; pad: number[]; floor: number; land: number[]; landY: number }> } }).spine;
const ride = (pad: (typeof map.pads)[number]) => {
  const p = new Player({ minX: BR_X - 400, maxX: BR_X + 400, minZ: BR_Z - 400, maxZ: BR_Z + 400 });
  p.teleport(pad.x, pad.y ?? 0, pad.z, 0);
  const DT = 1 / 144;
  let t = 1000;
  for (let i = 0; i < 20; i++) p.update(DT, (t += DT), idle, 0, 1, false);
  const across = pad.over !== undefined;
  p.impulse(across ? 0 : pad.dx, pad.up ?? 0, across ? 0 : pad.dz);
  let carry = across;
  let high = 0;
  for (let i = 0; i < 8 / DT; i++) {
    if (carry && p.pos.y >= (pad.over ?? 0)) {
      p.vel.x = pad.dx;
      p.vel.z = pad.dz;
      carry = false;
    }
    p.update(DT, (t += DT), idle, 0, 1, false);
    high = Math.max(high, p.pos.y);
    if (!carry && p.onGround) break;
  }
  return { p, high };
};
check("a jump pad onto each side of the four high city blocks, and the centre's", cfg.pads.length === 8 && map.pads.length === cfg.pads.length + SPINE.up.length + SPINE.down.length + SPINE.across.length, `${cfg.pads.length} and ${map.pads.length - cfg.pads.length}`);
for (const [k, pad] of map.pads.slice(0, cfg.pads.length).entries()) {
  const q = cfg.pads[k];
  const { p, high } = ride(pad);
  const past = (p.pos.x - BR_X - q.face[0]) * -q.out[0] + (p.pos.z - BR_Z - q.face[1]) * -q.out[1];
  check(`pad ${q.id}: lands you on its ${q.roof} m roof, past the edge`, p.onGround && Math.abs(p.pos.y - q.roof) < 0.3 && past > 1, `at ${p.pos.y.toFixed(2)} m, ${past.toFixed(1)} m in, highest ${high.toFixed(1)}`);
}
// the centre's spine (the owner, 2026-10-02: "clear jump pads to get all the way up and all the way down"): each up pad
// ridden onto what is past its face, from the plaza onto the base's roof and from there onto the top; each way down ridden
// off the top, landing where it aims on the base's roof
const ups = SPINE.up.map((q, k) => {
  const { p, high } = ride(map.pads[cfg.pads.length + k]);
  const past = (p.pos.x - BR_X - q.face[0]) * -q.out[0] + (p.pos.z - BR_Z - q.face[1]) * -q.out[1];
  return { q, ok: p.onGround && Math.abs(p.pos.y - q.ground) < 0.3 && past > 1, said: `${q.id} at ${p.pos.y.toFixed(2)} m, ${past.toFixed(1)} m in, highest ${high.toFixed(1)}` };
});
check("the centre's pads: each up from the plaza onto the base's roof, and from there onto the top and the crown, lands you past its face", ups.length >= 7 && ups.every((u) => u.ok), ups.map((u) => u.said).join("; "));
// the crown (the tower's roof at 109 m) reached by two pads from the base's roof, and cover on it and on the lookout,
// each piece standing level at its perch's height
const crown = ups.filter((u) => u.q.id.startsWith("crown") && u.q.ground > 100);
const PCH = (cfg as unknown as { perches?: Array<{ name: string; at: number[][] }> }).perches ?? [];
const onIt = (p: { at: number[][] }) => p.at.filter(([x, y, z]) => solidsIn(x + BR_X, x + BR_X, z + BR_Z, z + BR_Z).some((b) => Math.abs(b.top - y) < 0.06));
check("the crown at 109 m: two pads up to it from the base's roof, each landing on it", crown.length === 2 && crown.every((u) => u.ok), crown.map((u) => u.said).join("; "));
// (and a pad up onto each corner block's roof from the edge road, rules.pads.spine's corner-*, the master plan's item 8:
// onto the rooms buildings' roofs at 10.5 m and THE WELL's at 7.5 m)
const corners = ups.filter((u) => u.q.id.startsWith("corner-"));
check("a pad up onto each corner block's roof from the street, each landing on it", corners.length === 4 && corners.every((u) => u.ok && u.q.ground > 7), corners.map((u) => u.said).join("; "));
// (and LANTERN ALLEYS' four, rules.pads.spine's lantern-*: from its alleys and back lanes onto its houses' roofs)
const lanternPads = ups.filter((u) => u.q.id.startsWith("lantern-"));
check("LANTERN ALLEYS: a pad up onto a house from each main alley and each back lane, each landing on its roof", lanternPads.length === 4 && lanternPads.every((u) => u.ok && u.q.ground > 7), lanternPads.map((u) => u.said).join("; "));
// (and THE CANYON's four, rules.pads.spine's canyon-*: up each wall of its two passages onto the inner roofs, over the
// rail along the roof's edge)
const canyonPads = ups.filter((u) => u.q.id.startsWith("canyon-"));
check("THE CANYON: a pad up each wall of each passage, each landing on the roof over it", canyonPads.length === 4 && canyonPads.every((u) => u.ok && u.q.ground > 26), canyonPads.map((u) => u.said).join("; "));
// (and no squad dropped on or by a pad, game.dropClear: four drops stood on a pad's own street node, a squad dropped
// there thrown off as it landed)
{
  const near = map.pois.flatMap((p) => p.drops.filter((d) => map.pads.some((q) => Math.hypot(q.x - d.x, q.z - d.z) < (cfg.game as unknown as { dropClear: number }).dropClear)).map((d) => `${p.id} (${(d.x - BR_X).toFixed(1)}, ${(d.z - BR_Z).toFixed(1)})`));
  // (and each with room round it, game.dropRoom: a drop falls onto the first floor under it, and drops in the rooms
  // buildings' ground floors put the squad on their roofs at 11 m, one by the Sky Ring's stair on the stair at 3.6 m)
  const R = (cfg.game as unknown as { dropRoom: number }).dropRoom;
  const crowded = map.pois.flatMap((p) => p.drops.filter((d) => solidsIn(d.x - R, d.x + R, d.z - R, d.z + R).some((b) => b.minX < d.x + R && b.maxX > d.x - R && b.minZ < d.z + R && b.maxZ > d.z - R && b.top > MOVE.stepHeight)).map((d) => `${p.id} (${(d.x - BR_X).toFixed(1)}, ${(d.z - BR_Z).toFixed(1)})`));
  check("the squads' drops: none on or by a jump pad, each with room round it (no roof over it, nothing beside it over a step)", near.length === 0 && crowded.length === 0 && map.pois.every((p) => p.drops.length > 0), `${map.pois.reduce((n, p) => n + p.drops.length, 0)} drops${near.length ? `; by a pad: ${near.join(", ")}` : ""}${crowded.length ? `; crowded: ${crowded.join(", ")}` : ""}`);
}
// (and on the four bridges of the ring round the tower and the gangway, two pieces and more each: the fourth and fifth
// reviews asked for cover there)
const least = (name: string) => (name.startsWith("canyon-roof") ? 2 : /-2$/.test(name) && !name.startsWith("ring") ? 1 : name === "crown" ? 6 : name === "lookout" ? 2 : name === "base-roof" ? 8 : name === "motel-sign" ? 1 : name === "stacks-roof" ? 4 : name.startsWith("works-") ? 2 : name.startsWith("landmark") || name.startsWith("roof") ? 1 : name.startsWith("lantern") ? 1 : name.startsWith("terraces") || name.startsWith("glass") || name.startsWith("strip") ? 1 : name.startsWith("ring") ? 2 : 6);
check("the perches: cover on the crown, the lookout, the base's roof, THE STACKS' hotel roof, the four High City decks, the four bridges round the tower, the corner blocks' roofs, LANTERN ALLEYS' houses, THE TERRACES' blocks, GLASS HEIGHTS' decks and THE STRIP's pyramid, a landmark on each deck, each piece standing on its roof", PCH.length === (cfg.rules.perches as unknown[]).length && PCH.length === 51 && PCH.every((p) => p.at.length >= least(p.name) && onIt(p).length === p.at.length), PCH.map((p) => `${p.name} ${p.at.length} pieces, ${onIt(p).length} on its roof`).join("; "));
// THE GANGWAY's cover (Milestone 656; the sixth review: "the gangway's cover staggered with side shields"): along its long
// leg its sets alternate rails, each solid on its deck 1.4 m and more, each with its shield 1.4 m and more along the same
// rail; and from every half metre of the deck's middle line between the window's cell and the corner's, cover a body
// stands behind is within 4 m
{
  const GW = (cfg as unknown as { gangway?: { leg: number[]; z: number; deck: number; sets: number[][]; shields: number[][] } }).gangway;
  const tall = (q: number[]) => {
    const [x, z, hx, hz] = [q[0] + BR_X, q[1] + BR_Z, q[2] - 0.1, q[3] - 0.1];
    const bs = solidsIn(x - hx, x + hx, z - hz, z + hz).filter((b) => b.minX < x + hx && b.maxX > x - hx && b.minZ < z + hz && b.maxZ > z - hz && b.base < GW!.deck + 0.5 && b.top > GW!.deck + 0.3);
    return bs.length ? Math.max(...bs.map((b) => b.top)) - GW!.deck : 0;
  };
  const sets = [...(GW?.sets ?? [])].sort((p, q) => p[0] - q[0]);
  const staggered = sets.every((q, k) => k === 0 || q[5] !== sets[k - 1][5]);
  const [setH, shieldH] = [sets.map(tall), (GW?.shields ?? []).map(tall)];
  const all = [...sets, ...(GW?.shields ?? [])].filter((q) => tall(q) >= 1.4);
  const bare: number[] = [];
  for (let x = (GW?.leg[0] ?? 0) + 5.5; x <= (GW?.leg[1] ?? 0) - 2.5; x += 0.5) {
    const d = Math.min(...all.map((q) => Math.hypot(Math.max(0, Math.abs(x - q[0]) - q[2]), Math.max(0, Math.abs(GW!.z - q[1]) - q[3]))));
    if (d > 4) bare.push(x);
  }
  check("THE GANGWAY: its cover staggered from rail to rail, each set and its side shield solid on the deck 1.4 m and more, and cover within 4 m of every half metre of it", !!GW && sets.length >= 6 && staggered && setH.every((h) => h >= 1.4) && shieldH.length === sets.length && shieldH.every((h) => h >= 1.4) && bare.length === 0, `${sets.length} sets ${sets.map((q) => (q[5] < 0 ? "N" : "S")).join("")}, ${setH.map((h) => h.toFixed(1)).join("/")} m; shields ${shieldH.map((h) => h.toFixed(1)).join("/")} m; ${bare.length} half metres bare${bare.length ? ` (x ${bare.slice(0, 4).join(", ")})` : ""}`);
}
// each corner block's sign (rules.low.identity): four, each scaled up, standing on its roof (the collision's top there
// at its foot), its lit face turned to the middle of the map, and solid: its own collision standing 2 m and more over its
// roof within 1.5 m of its foot (drawn only, a player on MOTEL HILL's roof walked through MOTEL)
{
  const ID = (cfg as unknown as { identity?: Array<{ block: string; at: number[]; yaw: number; scale: number; w: number; h: number }> }).identity ?? [];
  const bad = ID.filter((q) => {
    const [x, y, z] = q.at;
    // (the roof under its foot: the highest top there no higher than its foot and a little, not the sign's own boxes)
    const roof = solidsIn(x + BR_X - 0.6, x + BR_X + 0.6, z + BR_Z - 0.6, z + BR_Z + 0.6).reduce((t, b) => (b.minX < x + BR_X + 0.6 && b.maxX > x + BR_X - 0.6 && b.minZ < z + BR_Z + 0.6 && b.maxZ > z + BR_Z - 0.6 && b.top <= y + 0.6 && b.top > t ? b.top : t), 0);
    const face = (Math.atan2(-x, -z) * 180) / Math.PI;
    const turn = Math.abs(((q.yaw - face + 540) % 360) - 180);
    const solid = solidsIn(x + BR_X - 1.5, x + BR_X + 1.5, z + BR_Z - 1.5, z + BR_Z + 1.5).some((b) => b.minX < x + BR_X + 1.5 && b.maxX > x + BR_X - 1.5 && b.minZ < z + BR_Z + 1.5 && b.maxZ > z + BR_Z - 1.5 && b.top > y + 2);
    return Math.abs(roof - y) > 0.6 || q.scale < 2.5 || turn > 1 || !solid;
  });
  check("the corner blocks' signs: one on each block's roof, three times the pack's size or near it, its face to the middle, solid", ID.length === 4 && new Set(ID.map((q) => q.block)).size === 4 && bad.length === 0, ID.map((q) => `${q.block} ${q.w} by ${q.h} m`).join("; ") + (bad.length ? `; wrong: ${bad.map((q) => q.block).join(", ")}` : ""));
}
// High City's crowns (the decks' landmarks, the master plan's item 7): each deck's whole crown, its pieces together
// (each within the perch's `near` of its first) and its tallest 9.5 m and more, so it shows over the deck's edge from
// the Loop and across the city (a single parked car, the east deck's landmark before, showed from nowhere off it)
{
  const RP = (cfg.rules.perches as unknown as Array<{ name: string; count: number; near?: number }>).filter((q) => q.name.startsWith("landmark"));
  const r = (a: number[]) => Math.hypot(a[4], a[5]);
  const of = (name: string) => PCH.find((p) => p.name === name)?.at ?? [];
  const bad = RP.filter((q) => {
    const at = of(q.name);
    return at.length !== q.count || at.some((a) => Math.hypot(a[0] - at[0][0], a[2] - at[0][2]) > (q.near ?? 0) + r(a) + r(at[0]) + 0.01) || Math.max(...at.map((a) => a[6])) < 9.5;
  });
  check("High City's crowns: each deck's whole crown, its pieces together and its tallest 9.5 m and more", RP.length === 4 && bad.length === 0, RP.map((q) => `${q.name} ${of(q.name).length} of ${q.count}, ${Math.max(0, ...of(q.name).map((a) => a[6]))} m`).join("; "));
}
// High City's signs (rules.high.signs): one on each island's face to the Loop, the face standing right behind its
// middle (the collision a hand past its back, across its height), lit to the Loop, and none of them a corner block's own
// sign, which names its block alone
{
  const HS = (cfg as unknown as { highSigns?: Array<{ block: string; at: number[]; yaw: number; piece: string; w: number; h: number }> }).highSigns ?? [];
  const own = new Set(((cfg as unknown as { identity?: Array<{ piece: string }> }).identity ?? []).map((q) => q.piece));
  const inward: Record<string, number[]> = { n: [0, -1], s: [0, 1], w: [-1, 0], e: [1, 0] };
  const bad = HS.filter((q) => {
    const [x, y, z] = q.at;
    const [dx, dz] = inward[q.block];
    const [bx, bz] = [x + BR_X + dx * 0.3, z + BR_Z + dz * 0.3];
    const behind = solidsIn(bx - 0.1, bx + 0.1, bz - 0.1, bz + 0.1).some((b) => b.minX <= bx && b.maxX >= bx && b.minZ <= bz && b.maxZ >= bz && b.base < y && b.top > y);
    const lit = Math.abs(((q.yaw - (Math.atan2(-dx, -dz) * 180) / Math.PI + 540) % 360) - 180) < 1;
    return !behind || !lit || own.has(q.piece);
  });
  check("High City's signs: one on each island's face to the Loop, hung on it and lit to the Loop, none a corner block's own sign", HS.length === 4 && new Set(HS.map((q) => q.block)).size === 4 && bad.length === 0, HS.map((q) => `${q.block} ${q.piece.replace(".prefab", "")} ${q.w} by ${q.h} m`).join("; ") + (bad.length ? `; wrong: ${bad.map((q) => q.block).join(", ")}` : ""));
}
// (and none of those four in the street's own signs, as none of the corner blocks' is: MOVIE hung on a low building
// down the street from the north block that it names)
{
  const HSP = new Set(((cfg as unknown as { highSigns?: Array<{ piece: string }> }).highSigns ?? []).map((q) => q.piece));
  const twins = ((cfg.chunks as unknown as Record<string, { place: unknown[][] }>)["c-signs"]?.place ?? []).filter((q) => HSP.has(String(q[0]).split("/").pop()!));
  check("the street's signs: none of High City's own among them", HSP.size === 4 && twins.length === 0, `${twins.length} of them${twins.length ? `: ${twins.slice(0, 3).map((q) => String(q[0]).split("/").pop()).join(", ")}` : ""}`);
}
// THE WELL's and MARKET's names (rules.low.names, the master plan's item 8: the fourth review could not tell them apart
// from the Loop): each standing on its wedge's roof at its front (the roof's top under its foot, a metre behind it),
// lit in its sector's accent; and each block's beam tinted the same, where it was teal and green against violet and blue
{
  const NMS = (cfg as unknown as { names?: Array<{ block: string; text: string; at: number[]; yaw: number; h: number; colour: string }> }).names ?? [];
  const SEC: Record<string, string> = { "-1,1": "sw", "1,1": "se" };
  const accent = (b: string) => (cfg.game.sectors as Array<{ id: string; accent: string }>).find((s) => s.id === SEC[b])?.accent;
  const lift = (cfg.rules.low as unknown as { names: { lift: number } }).names.lift;
  const bad = NMS.filter((q) => {
    const a = (q.yaw * Math.PI) / 180;
    // (a metre behind it, the way its back faces)
    const [bx, bz] = [q.at[0] - Math.sin(a) * 1 + BR_X, q.at[2] - Math.cos(a) * 1 + BR_Z];
    const foot = q.at[1] - q.h / 2 - lift;
    const roof = solidsIn(bx - 0.1, bx + 0.1, bz - 0.1, bz + 0.1).some((b) => b.minX <= bx && b.maxX >= bx && b.minZ <= bz && b.maxZ >= bz && Math.abs(b.top - foot) < 0.3);
    return !roof || q.colour !== accent(q.block);
  });
  const beams = (cfg as unknown as { beams?: Array<{ block: string; mat: string }> }).beams ?? [];
  // (their beams, while the blocks had them: none since Milestone 689)
  const off = (cfg.rules.low as unknown as { beam?: unknown }).beam ? Object.keys(SEC).filter((b) => !beams.find((q) => q.block === b)?.mat.includes(accent(b) ?? "none")) : beams.map((q) => q.block);
  check("THE WELL's and MARKET's names on their wedges' roofs, lit in their sectors' colours, and their beams the same colours", NMS.length === 2 && bad.length === 0 && off.length === 0, NMS.map((q) => `${q.text} ${q.colour}`).join("; ") + (bad.length ? `; wrong: ${bad.map((q) => q.text).join(", ")}` : "") + (off.length ? `; beams off: ${off.join(", ")}` : ""));
}
// no piece the map must not show (rules.banned): the pack's letter sign that spells "free sex" in Korean stood in the
// street seven times and 14 m tall on the south deck until Milestone 571
{
  const BAN = (cfg.rules as unknown as { banned: { pieces: string[] } }).banned.pieces;
  const shown = Object.values(cfg.chunks as unknown as Record<string, { place: unknown[][] }>).flatMap((ch) => ch.place).filter((q) => BAN.some((b) => String(q[0]).endsWith(`/${b}`)));
  check("no piece the map must not show: none of rules.banned placed anywhere", BAN.length > 0 && shown.length === 0, `${shown.length} placed${shown.length ? `: ${shown.slice(0, 3).map((q) => q[0]).join("; ")}` : ""}`);
}
// (and the decks' cover off where a pad lands, a lift lands, a bridge ends and a zip tops out, by rules.perches_clear)
{
  const PC = (cfg.rules as unknown as { perches_clear: { pad: number; lift: number; bridge: number; zip: number } }).perches_clear;
  const spots: number[][] = [];
  for (const q of cfg.pads) spots.push([q.face[0] - q.out[0] * 3, q.face[1] - q.out[1] * 3, PC.pad]);
  for (const q of (cfg as unknown as { lifts: Array<{ land: number[] }> }).lifts) spots.push([q.land[0], q.land[1], PC.lift]);
  for (const path of (cfg.rules as unknown as { bridges: { paths: number[][][] } }).bridges.paths) for (const e of [path[0], path[path.length - 1]]) spots.push([e[0], e[1], PC.bridge]);
  for (const q of (cfg as unknown as { zips: Array<{ a: number[] }> }).zips) spots.push([q.a[0], q.a[2], PC.zip]);
  const near = PCH.filter((p) => p.name.startsWith("deck") || p.name.startsWith("landmark")).flatMap((p) => p.at.filter(([x, , z]) => spots.some((s) => Math.hypot(s[0] - x, s[1] - z) < s[2])));
  check("the decks' cover: none within reach of a pad's landing, a lift's landing, a bridge's end or a zip's top", near.length === 0, `${near.length} too near`);
}
// the streets' median (rules.dress.median; the second review: "street cover is a lamp post and a kiosk"): thirty-five
// pieces and more down the streets' middles, each planter solid from the ground past a crouched head on its footprint (a
// box from under 0.3 m to over 1 m within a metre of its middle: the collision is built in half-metre columns, which miss
// a piece's very middle as often as not), and each of the tall boards among them (`tall`; the third review's sightlines)
// solid from the ground to over a standing eye; the street one network checked above with them in it. And hover vans
// among the parked cars
{
  const MED = (cfg as unknown as { medians?: Array<{ at: number[]; piece?: string }> }).medians ?? [];
  const solidAt = ([x, z]: number[], ok: (b: { base: number; top: number }) => boolean) => solidsIn(x + BR_X - 1, x + BR_X + 1, z + BR_Z - 1, z + BR_Z + 1).some((b) => b.minX < x + BR_X + 1 && b.maxX > x + BR_X - 1 && b.minZ < z + BR_Z + 1 && b.maxZ > z + BR_Z - 1 && ok(b));
  const soft = MED.filter((q) => !solidAt(q.at, q.piece ? (b) => b.base < 0.3 && b.top > 1.8 : (b) => b.base < 0.3 && b.top > 1));
  const boards = MED.filter((q) => q.piece).length;
  // (and since Milestone 1075 the carriageway's islands, rules.dress.carriage: on the streets' middles their planters and low
  // panels are the median where they stand, and its own blocks make way for every station; a low panel, 1.8 m, stands over
  // a standing eye, 1.68 m)
  const ISL = ((cfg as unknown as { carriage?: Array<{ set: string; parts: Array<[string, number, number]> }> }).carriage ?? []).filter((s) => s.set === "island").flatMap((s) => s.parts.map(([name, x, z]) => ({ at: [x, z], panel: name !== cfg.rules.dress.median.piece })));
  const softIsl = ISL.filter((q) => !solidAt(q.at, q.panel ? (b) => b.base < 0.3 && b.top > 1.7 : (b) => b.base < 0.3 && b.top > 1));
  const panels = ISL.filter((q) => q.panel).length;
  check("the streets' median: thirty planters and boards and more down the streets' middles, the median's and the carriageway's islands', the planters solid past a crouched head and the boards and panels over a standing eye", MED.length + ISL.length >= 30 && boards + panels >= 8 && soft.length === 0 && softIsl.length === 0, `${MED.length - boards} planters and ${boards} boards, the islands' ${ISL.length - panels} planters and ${panels} panels${soft.length + softIsl.length ? `, ${soft.length + softIsl.length} not solid: ${[...soft, ...softIsl].slice(0, 3).map((q) => q.at.join(", ")).join("; ")}` : ""}`);
  // (and the planters solid no higher than a crouched head, rules.collision.caps: their fern and fronds over it, which
  // stood solid to 2.3 m, shot through)
  const tallPlanters = MED.filter((q) => !q.piece).filter(({ at: [x, z] }) => solidsIn(x + BR_X - 0.3, x + BR_X + 0.3, z + BR_Z - 0.3, z + BR_Z + 0.3).some((b) => b.minX < x + BR_X + 0.3 && b.maxX > x + BR_X - 0.3 && b.minZ < z + BR_Z + 0.3 && b.maxZ > z + BR_Z - 0.3 && b.base < 1.4 && b.top > 1.5));
  check("the streets' median: its planters solid no higher than a crouched head, their fern over it shot through", tallPlanters.length === 0, tallPlanters.length ? `${tallPlanters.length} solid past 1.5 m, first at ${tallPlanters[0].at.join(", ")}` : `${MED.filter((q) => !q.piece).length} planters`);
  // (and what stands in the street looks like what it collides as: no barred railing, solid to a shot and a bot's eye,
  // in the median or the cover; and every tall board the pack's concrete panel with its poster sheet on each face,
  // rules.dress.board: the pack's loose wall posters stood there before, hanging in the air with nothing behind them)
  const FACED = (cfg.rules.dress as unknown as { seeThrough: string[]; board: { piece: string } });
  const all = Object.values(cfg.chunks as unknown as Record<string, { place: unknown[][] }>).flatMap((ch) => ch.place);
  const barred = [...((cfg.chunks as unknown as Record<string, { place: unknown[][] }>)["c-cover"]?.place ?? []), ...MED.map((q) => [q.piece ?? cfg.rules.dress.median.piece])].filter((q) => FACED.seeThrough.some((n) => String(q[0]).endsWith(n)));
  const sheets = all.filter((q) => String(q[0]).endsWith(`/${FACED.board.piece}`) && q[5] === "g");
  // (each board the layout lists, by its footprint's middle: a sheet on each face within its half length, turned about)
  const listed = [...MED.filter((q) => q.piece).map((q) => q.at), ...((cfg as unknown as { streetCover?: Array<{ c: number[]; half?: number[] }> }).streetCover ?? []).filter((q) => q.half).map((q) => q.c)];
  const dressed = ([cx, cz]: number[]) => {
    const near = sheets.filter((q) => Math.hypot(Number(q[1]) - cx, Number(q[3]) - cz) < 2.5);
    return near.some((a) => near.some((b) => Math.abs((((Number(b[4]) - Number(a[4])) % 360) + 360) % 360 - 180) < 0.1));
  };
  const bare = listed.filter((c) => !dressed(c));
  check("the street's cover looks like what it collides as: no barred railing in the median or the cover, every tall board a panel with a poster sheet on each face", barred.length === 0 && listed.length > 0 && bare.length === 0, `${barred.length} railings, ${listed.length - bare.length} of ${listed.length} boards dressed${bare.length ? `; bare at ${bare.slice(0, 3).map((c) => c.join(", ")).join("; ")}` : ""}`);
  // (and the street cover's planters, each colliding as a box of its own, listed with the rest of the cover in the
  // bake's `laid`: left out, the layout's next run found the last run's planters standing in the street as cover already
  // there and laid 69 pieces where the run before it laid 134, so the city would change at every bake)
  const CAPS = (cfg.rules.collision as unknown as { caps: { pieces: string[]; top: number } }).caps;
  const LAIDR = (SOLIDS as { laid?: number[][] }).laid ?? [];
  const S = (SOLIDS as { solids: number[][] }).solids;
  const capped = ((cfg as unknown as { streetCover?: Array<{ piece: string; c: number[] }> }).streetCover ?? []).filter((q) => CAPS.pieces.includes(q.piece));
  const unlisted = capped.filter(({ c: [x, z] }) => !S.some((b, i) => b[0] < x && b[1] > x && b[2] < z && b[3] > z && Math.abs(b[5] - b[4] - CAPS.top) < 0.01 && LAIDR.some(([a, e]) => i >= a && i < e)));
  // (none when no set of the street cover has a planter: the yellow palm planter left the pavements in Milestone 772)
  const COv = (cfg.rules.dress as unknown as { cover: { road: string[]; pave: string[] } }).cover;
  // (or, since Milestone 1074, on the ring road's band a facing district's sets with one: THE TERRACES' hedges stand in planters)
  const DCv = (cfg.rules.dress as unknown as { districtCover: { sets?: Record<string, Array<{ parts: unknown[][] }>> }; cover: { band?: { from: number } } });
  const bandCaps = !!DCv.cover.band && Object.values(DCv.districtCover.sets ?? {}).some((k) => k.some((s) => s.parts.some((q) => CAPS.pieces.includes(String(q[0])))));
  const usesCaps = [...COv.road, ...COv.pave].some((p) => CAPS.pieces.includes(p)) || bandCaps;
  // (since Milestone 1075 none is asked for where a kit has planters, any it lays still listed: whether the fill lays one is its
  // draw, the one hedge set of THE TERRACES' band with planters. Moved by the carriageway's stations, at a station every 16 m
  // it laid that band its two other hedge sets and no planter, at 15 m the hedge set with three as version 138 did)
  check("the street cover's planters laid again by the layout's next run: each one's box listed in the bake's laid-last boxes", (usesCaps || capped.length === 0) && unlisted.length === 0, `${capped.length - unlisted.length} of ${capped.length} listed${unlisted.length ? `; first unlisted at ${unlisted[0].c.join(", ")}` : ""}`);
  const VAN = (cfg.rules.dress as unknown as { cars: { vans?: { pieces: string[] } } }).cars.vans;
  const vans = Object.values(cfg.chunks as unknown as Record<string, { place: unknown[][] }>).flatMap((ch) => ch.place).filter((q) => VAN?.pieces.some((v) => String(q[0]).endsWith(`/${v}`)) && Number(q[2]) < 2);
  check("hover vans parked among the cars: six and more, whole cover", vans.length >= 6, `${vans.length}`);
}
// each corner block its own thing at street level (the second review: "16 no stalls, 18 no crates", the corners
// interchangeable there): NOODLE ROW's lanterns over its streets, every one 3.5 m and more over the ground it hangs above
// and drawn only; MARKET's crate stacks, each solid over a body's height; THE WELL's ring of lamps on its rim; and the
// shop signs none of the corner blocks' own, and none within `twin` metres of the same sign
{
  const LN = (cfg.rules.low as unknown as { lanterns?: { lanterns: string[]; height: number } }).lanterns;
  const places = (chunk: string) => ((cfg.chunks as unknown as Record<string, { place: unknown[][] }>)[chunk]?.place ?? []) as Array<[string, number, number, number, number, string]>;
  // (the canopy's, hung at its height: the stalls' own two lanterns each stand low over their counters)
  const lan = places("c-ne").filter((q) => LN?.lanterns.some((l) => q[0].endsWith(`/${l}`)) && Math.abs(q[2] - LN.height) < 0.01);
  const low = lan.filter((q) => q[5] !== "g" || q[2] - 1.4 - floorAt(q[1] + BR_X, q[3] + BR_Z) < 3.5);
  check("NOODLE ROW's lantern canopy over its streets: sixty lanterns and more, each 3.5 m and more over the ground, drawn only", lan.length >= 60 && low.length === 0, `${lan.length} lanterns${low.length ? `, ${low.length} too low or solid` : ""}`);
  const ST = (cfg as unknown as { crateStacks?: Array<{ at: number[] }> }).crateStacks ?? [];
  const soft = ST.filter(({ at: [x, z] }) => !solidsIn(x + BR_X - 1.2, x + BR_X + 1.2, z + BR_Z - 1.2, z + BR_Z + 1.2).some((b) => b.minX < x + BR_X + 1.2 && b.maxX > x + BR_X - 1.2 && b.minZ < z + BR_Z + 1.2 && b.maxZ > z + BR_Z - 1.2 && b.top > 1.8 && b.base < 1.2));
  check("MARKET's crate stacks along its streets: four and more, each solid to over a body's height", ST.length >= 4 && soft.length === 0, `${ST.length} stacks${soft.length ? `, ${soft.length} not solid` : ""}`);
  const WR = (cfg as unknown as { wellRing?: Array<{ at: number[] }> }).wellRing ?? [];
  check("THE WELL's ring of lamps round its shaft: four and more", WR.length >= 4, `${WR.length}`);
  const S = cfg.rules.signs as unknown as { twin: number };
  const own = new Set(Object.values((cfg.rules.low as unknown as { identity: { signs: Record<string, { piece: string }> } }).identity.signs).map((q) => q.piece));
  const signs = places("c-signs").map((q) => ({ piece: q[0].split("/").pop()!, at: [q[1], q[3]] }));
  const owned = signs.filter((q) => own.has(q.piece));
  // (measured between their pivots, where the layout measures between their faces: up to half a sign's width each way,
  // the widest 3 m, so 3 m short of `twin`)
  const twins = signs.filter((q, i) => signs.some((o, j) => j > i && o.piece === q.piece && Math.hypot(o.at[0] - q.at[0], o.at[1] - q.at[1]) < S.twin - 3));
  check("the shop signs: none of the corner blocks' own, none within twin distance of the same sign", signs.length > 30 && owned.length === 0 && twins.length === 0, `${signs.length} signs${owned.length ? `, ${owned.length} a corner block's own` : ""}${twins.length ? `, ${twins.length} by a twin` : ""}`);
}
// THE CENTRE's spawns and zones (the 1v1 on the Loop, src/config/centre.json, round the map's middle) each with a body's
// room: nothing over the ground within a body's radius and a hand of the spot (a median block laid on a spawn held its
// bot fast, the lobby's e2e, 2026-10-04)
{
  const CEN = (await import("../../src/config/centre.json")).default as { x: number; z: number; spawnR: number; spawns: number[]; zone: { bearing: number; r: number }; zones: number[] };
  const spot = (b: number, r: number) => [CEN.x + Math.sin((b * Math.PI) / 180) * r, CEN.z + Math.cos((b * Math.PI) / 180) * r];
  const spots = [...CEN.spawns.map((b) => ({ what: `spawn at ${b}°`, at: spot(b, CEN.spawnR) })), ...[CEN.zone.bearing, ...CEN.zones].map((b) => ({ what: `zone at ${b}°`, at: spot(b, CEN.zone.r) }))];
  const r = MOVE.radius + 0.1;
  const held = spots.filter(({ at: [x, z] }) => solidsIn(x - r, x + r, z - r, z + r).some((b) => b.minX < x + r && b.maxX > x - r && b.minZ < z + r && b.maxZ > z - r && b.top > 0.3 && b.base < 1.8));
  check("THE CENTRE: its spawns and zones on the Loop each with a body's room", CEN.x === BR_X && CEN.z === BR_Z && held.length === 0, `${spots.length} spots${held.length ? `; held: ${held.map((q) => q.what).join(", ")}` : ""}`);
}
// the decks' cover cuts no deck in two (rules.perches_clear.walk): on each High City deck's roof, its level cells a quarter
// metre each, less a body's width round anything standing on them or off them, flooded from the deck's site; every
// arrival on the deck (where a pad lands, the lift's top, each bridge stair's foot, the zip line's top) is on that one
// piece, within 1.5 m (a zip's top within 3 m: its rope's top hangs over the deck's rim, and a rider is set down on the
// rim's ledge 0.15 to 0.5 m under the deck, by the zip lines' check, and steps on from there). A deck's cover at the gap
// between two lobes walled the south deck's west lobe and its bridge off from the rest
{
  const W = (cfg.rules as unknown as { perches_clear: { walk: number } }).perches_clear.walk;
  const C4 = 0.25;
  const arrivals: Array<[string, number, number, number?]> = [];
  for (const q of cfg.pads) arrivals.push([`pad (${q.face.join(", ")})`, q.face[0] - q.out[0] * 3, q.face[1] - q.out[1] * 3]);
  for (const q of (cfg as unknown as { lifts: Array<{ id: string; land: number[] }> }).lifts) arrivals.push([`lift ${q.id}`, q.land[0], q.land[1]]);
  for (const path of (cfg.rules as unknown as { bridges: { paths: number[][][] } }).bridges.paths)
    for (const [e, f] of [[path[0], path[1]], [path.at(-1)!, path.at(-2)!]]) {
      const l = Math.hypot(e[0] - f[0], e[1] - f[1]);
      arrivals.push([`bridge stair (${e.join(", ")})`, e[0] + ((e[0] - f[0]) / l) * 1.5, e[1] + ((e[1] - f[1]) / l) * 1.5]);
    }
  for (const q of (cfg as unknown as { zips: Array<{ a: number[] }> }).zips) arrivals.push([`zip (${q.a[0]}, ${q.a[2]})`, q.a[0], q.a[2], 3]);
  const said: string[] = [];
  const cut: string[] = [];
  for (const P of (cfg.rules.perches as Array<{ name: string; y: number[]; box: number[] }>).filter((q) => q.name.startsWith("deck-"))) {
    const site = map.sites.find((q) => q.id === `${P.name.slice(5)}-deck`)!;
    const [NI, NJ] = [Math.round((P.box[1] - P.box[0]) / C4) + 1, Math.round((P.box[3] - P.box[2]) / C4) + 1];
    const lv = new Uint8Array(NI * NJ);
    for (let i = 0; i < NI; i++)
      for (let j = 0; j < NJ; j++) {
        const [x, z] = [P.box[0] + i * C4 + BR_X, P.box[2] + j * C4 + BR_Z];
        const t = solidsIn(x, x, z, z).reduce((m, b) => (x >= b.minX && x <= b.maxX && z >= b.minZ && z <= b.maxZ && b.top > m ? b.top : m), -Infinity);
        lv[i * NJ + j] = t >= P.y[0] && t <= P.y[1] ? 1 : 0;
      }
    const k = Math.ceil(W / C4);
    const g = new Uint8Array(NI * NJ);
    for (let i = 0; i < NI; i++)
      for (let j = 0; j < NJ; j++) {
        if (!lv[i * NJ + j]) continue;
        let ok = true;
        for (let di = -k; di <= k && ok; di++) for (let dj = -k; dj <= k && ok; dj++) if ((di * C4) ** 2 + (dj * C4) ** 2 <= W * W && i + di >= 0 && j + dj >= 0 && i + di < NI && j + dj < NJ && !lv[(i + di) * NJ + j + dj]) ok = false;
        g[i * NJ + j] = ok ? 1 : 0;
      }
    // (from the walkable cell nearest the site)
    let s0 = -1, best = Infinity;
    for (let c = 0; c < g.length; c++) if (g[c]) { const d = Math.hypot(P.box[0] + Math.floor(c / NJ) * C4 - (site.x - BR_X), P.box[2] + (c % NJ) * C4 - (site.z - BR_Z)); if (d < best) (best = d, s0 = c); }
    const stack = s0 >= 0 ? [s0] : [];
    if (s0 >= 0) g[s0] = 2;
    let size = 0;
    while (stack.length) {
      const c = stack.pop()!;
      size++;
      const i = Math.floor(c / NJ), j = c % NJ;
      for (const [n, okn] of [[c - NJ, i > 0], [c + NJ, i < NI - 1], [c - 1, j > 0], [c + 1, j < NJ - 1]] as Array<[number, boolean]>) if (okn && g[n] === 1) (g[n] = 2, stack.push(n));
    }
    const mine = arrivals.filter(([, x, z]) => x >= P.box[0] && x <= P.box[1] && z >= P.box[2] && z <= P.box[3]);
    const reach = (x: number, z: number, r: number) => {
      for (let i = Math.max(0, Math.floor((x - r - P.box[0]) / C4)); i <= Math.min(NI - 1, Math.ceil((x + r - P.box[0]) / C4)); i++)
        for (let j = Math.max(0, Math.floor((z - r - P.box[2]) / C4)); j <= Math.min(NJ - 1, Math.ceil((z + r - P.box[2]) / C4)); j++)
          if (g[i * NJ + j] === 2 && Math.hypot(P.box[0] + i * C4 - x, P.box[2] + j * C4 - z) <= r) return true;
      return false;
    };
    for (const [what, x, z, r] of mine) if (!reach(x, z, r ?? 1.5)) cut.push(`${P.name}: ${what}`);
    said.push(`${P.name} ${mine.length} arrivals, ${(size * C4 * C4).toFixed(0)} m² walked`);
  }
  check("the decks' cover cuts no deck in two: from each deck's site a body walks its roof to every pad landing, lift top, bridge stair and zip top on it", said.length === 4 && cut.length === 0, said.join("; ") + (cut.length ? `; cut off: ${cut.join(", ")}` : ""));
}
const downs = SPINE.down.map((q, k) => {
  const { p } = ride(map.pads[cfg.pads.length + SPINE.up.length + k]);
  const off = Math.hypot(p.pos.x - BR_X - q.land[0], p.pos.z - BR_Z - q.land[1]);
  return { ok: p.onGround && Math.abs(p.pos.y - q.landY) < 0.3 && off < 1.5, said: `${q.id} from ${q.floor} m to ${p.pos.y.toFixed(2)} m, ${off.toFixed(1)} m off its mark` };
});
// the roof routes (rules.pads.spine.across): each pad ridden as a match throws it, onto its mark on the roof it aims at
const acrossRides = SPINE.across.map((q, k) => {
  const { p, high } = ride(map.pads[cfg.pads.length + SPINE.up.length + SPINE.down.length + k]);
  const off = Math.hypot(p.pos.x - BR_X - q.land[0], p.pos.z - BR_Z - q.land[1]);
  return { ok: p.onGround && Math.abs(p.pos.y - q.landY) < 0.3 && off < 1.5, said: `${q.id} from ${q.floor} to ${p.pos.y.toFixed(2)} m, ${off.toFixed(1)} m off its mark, top ${high.toFixed(1)}` };
});
check("the roof routes: each pad throws you across onto its mark, Market's to its 17.5 m roof and the bridge ring, the Well's to its domed roof and the bridge ring, each of the ring's gaps' over to its far deck", acrossRides.length >= 4 && acrossRides.every((r) => r.ok), acrossRides.map((r) => r.said).join("; "));
check("the centre's pads: the way down off the top lands you on the base's roof where it aims", downs.length >= 1 && downs.every((d) => d.ok), downs.map((d) => d.said).join("; "));
const padNodes = map.nodes.filter((n) => n.pad);
const stranded = padNodes.filter((n) => !map.nodes[n.pad!.to].links.length);
check("every pad a bot is sent up lands it on the roof's graph", padNodes.length >= 6 && stranded.length === 0, `${padNodes.length} pads for bots, ${stranded.length} stranded`);

// the small named places: each high city block's deck and the lobby
// (and each corner block's own name, over its rooms building's roof yard or over the Well, the master plan's names)
const YDS = (cfg as unknown as { yards?: Array<{ block: string; inside: number[] }> }).yards ?? [];
const WH = (cfg as unknown as { well?: { hole: number[] } }).well?.hole;
const WAT = WH ? [(WH[0] + WH[1]) / 2, (WH[2] + WH[3]) / 2] : undefined;
const cornerAt = (id: string) => map.sites.find((s) => s.id === id);
check("each corner block named on the map over its roof yard, or the Well's over the Well", ["motel", "noodle", "market", "well"].every((id) => cornerAt(id)) && YDS.every((y) => map.sites.some((s) => s.radius !== undefined && Math.abs(s.x - BR_X - (y.inside[0] + y.inside[1]) / 2) < 0.01 && Math.abs(s.z - BR_Z - (y.inside[2] + y.inside[3]) / 2) < 0.01)) && !!WAT && Math.hypot(cornerAt("well")!.x - BR_X - WAT[0], cornerAt("well")!.z - BR_Z - WAT[1]) < 0.01, ["motel", "noodle", "market", "well"].map((id) => { const s = cornerAt(id); return s ? `${s.name} (${(s.x - BR_X).toFixed(1)}, ${(s.z - BR_Z).toFixed(1)})` : `${id} missing`; }).join(", "));
// (and each corner block's own light: the pack's beam in its colour, over its name)
{
  const BM = (cfg.rules.low as unknown as { beam?: { piece: string; mats: Record<string, string> } }).beam;
  const placed = Object.entries(cfg.chunks as Record<string, { place: unknown[][] }>).flatMap(([, v]) => v.place.filter((p) => !!BM && String(p[0]).endsWith(`/${BM.piece}`)));
  const blockOfSite: Record<string, string> = { motel: "-1,-1", noodle: "1,-1", market: "-1,1", well: "1,1" };
  const lit = Object.entries(blockOfSite).map(([id, block]) => {
    const s = cornerAt(id);
    const p = s && placed.find((q) => Math.hypot((q[1] as number) - (s.x - BR_X), (q[3] as number) - (s.z - BR_Z)) < 0.01);
    return { name: s?.name ?? id, mat: p ? (p[6] as string) : null, want: BM?.mats[block] };
  });
  // (none since Milestone 689: the tenth reviews' "pink bar" down THE WELL and "gold pole straight up into the sky")
  if (BM) check("a beam of light over each corner block in its own colour", placed.length === 4 && lit.every((q) => q.mat && q.mat === q.want) && new Set(lit.map((q) => q.mat)).size === 4, lit.map((q) => `${q.name} ${q.mat ?? "none"}`).join(", "));
  else check("no beam over the corner blocks (their names on their roofs say where they are)", placed.length === 0 && !(cfg as unknown as { beams?: unknown }).beams, `${placed.length} placed`);
}
// (and NOODLE ROW's own: the pack's street food stalls on its ground, each with two paper lanterns at its front, none on
// a pavement or in a fire escape's room)
{
  const ST = (cfg.rules.low as unknown as { stalls?: { block: string; pieces: string[]; count: number; lantern: string } }).stalls;
  const SS = (cfg as unknown as { stalls?: Array<{ at: number[]; yaw: number; piece: string }> }).stalls ?? [];
  const ne = (cfg.chunks as Record<string, { place: unknown[][] }>)["c-ne"]?.place ?? [];
  const CVs = cfg.rules.streets.curves as unknown as Parameters<typeof curvedStreets>[0] & { round: number; pave: number };
  const SFs = new StreetField(curvedStreets(CVs));
  // (on the carriageway or its pavement: the road's distance under a pavement's width)
  const onStreetHere = (x: number, z: number) => SFs.surface(x, z, CVs.round) < CVs.pave;
  const lanterns = ne.filter((p) => !!ST && String(p[0]).endsWith(`/${ST.lantern}`));
  const each = SS.map((q) => ({ q, lit: lanterns.filter((p) => Math.hypot((p[1] as number) - q.at[0], (p[3] as number) - q.at[1]) < 3).length, street: onStreetHere(q.at[0], q.at[1]) }));
  check("NOODLE ROW: its food stalls, each with its two lanterns, on the block's own ground off the street", !!ST && SS.length === ST.count && each.every((e) => e.lit >= 2 && !e.street && e.q.at[0] > 0 && e.q.at[1] < 0), each.map((e) => `(${e.q.at.join(", ")}) ${e.lit} lanterns${e.street ? " ON THE STREET" : ""}`).join("; "));
  // (and MARKET's: crate stacks for cover on its ground, each its three crates, none on the street)
  // (the crate stacks' sets, saved as `crates`; MARKET's food stalls a set of their own since Milestone 876)
  const MK = ((cfg.rules.low as unknown as { market?: Array<{ count: number; pieces: string[]; extras: unknown[]; save?: string }> }).market ?? []).filter((m) => m.save === "crates");
  const CR = (cfg as unknown as { crates?: Array<{ at: number[] }> }).crates ?? [];
  const sw = (cfg.chunks as Record<string, { place: unknown[][] }>)["c-sw"]?.place ?? [];
  // the street furniture (rules.dress.furniture): along the pavements, each on a pavement (off the road, within it), plenty
  const FUR = (cfg as unknown as { furniture?: Array<{ at: number[]; piece: string }> }).furniture ?? [];
  const onPave = (x: number, z: number) => { const d = SFs.surface(x, z, CVs.round); return d >= 0.2 && d <= CVs.pave; };
  const offPave = FUR.filter((q) => !onPave(q.at[0], q.at[1]));
  // (36 and more since Milestone 819: the walk-ins' doors at their buildings' ends keep four pieces off their ways in)
  check("street furniture along every pavement, each piece on its pavement and off the road", FUR.length >= 36 && offPave.length === 0 && new Set(FUR.map((q) => q.piece)).size >= 6, `${FUR.length} pieces, ${new Set(FUR.map((q) => q.piece)).size} kinds, ${offPave.length} off the pavement`);
  const stacks = CR.map((q) => ({ q, n: sw.filter((p) => /\/Crate0/.test(String(p[0])) && Math.hypot((p[1] as number) - q.at[0], (p[3] as number) - q.at[1]) < 2.5).length, street: onStreetHere(q.at[0], q.at[1]) }));
  check("MARKET: its crate stacks, three crates each, on the block's own ground off the street", MK.length > 0 && CR.length === MK.reduce((a, m) => a + m.count, 0) && stacks.every((e) => e.n >= 3 && !e.street && e.q.at[0] < 0 && e.q.at[1] > 0), stacks.map((e) => `(${e.q.at.join(", ")}) ${e.n} crates${e.street ? " ON THE STREET" : ""}`).join("; "));
}
// (and the walk-in buildings on the curves, the master plan's shop fronts: each entered from the street at its door side, a
// body's square a quarter metre at a time over the collision, a step at most between squares, to its ground floor's middle)
{
  const WIs = (cfg as unknown as { walkIns?: Array<{ chunk: string; piece: string; at: number[]; door: number[] }> }).walkIns ?? [];
  const [G, r] = [0.25, MOVE.radius];
  const standAt = (x: number, z: number, from: number): number | null => {
    const [wx, wz] = [x + BR_X, z + BR_Z];
    const near = solidsIn(wx - r, wx + r, wz - r, wz + r).filter((s) => s.maxX > wx - r && s.minX < wx + r && s.maxZ > wz - r && s.minZ < wz + r);
    // the highest top under its middle within a step of where it comes from, the street's floor at 0 the least
    let top = Math.abs(from) <= MOVE.stepHeight ? 0 : -Infinity;
    for (const s of near) if (wx >= s.minX && wx <= s.maxX && wz >= s.minZ && wz <= s.maxZ && s.top <= from + MOVE.stepHeight && s.top > top) top = s.top;
    if (top === -Infinity) return null;
    return near.some((s) => s.top > top + MOVE.stepHeight && s.base < top + MOVE.standHeight) ? null : top;
  };
  const each = WIs.map((w) => {
    const seen = new Map<string, number>();
    const [i0, j0] = [Math.round(w.door[0] / G), Math.round(w.door[1] / G)];
    const y0 = standAt(i0 * G, j0 * G, 0);
    const todo: Array<[number, number, number]> = y0 === null ? [] : [[i0, j0, y0]];
    if (y0 !== null) seen.set(`${i0},${j0}`, y0);
    let inside = false;
    while (todo.length && !inside) {
      const [i, j, y] = todo.pop()!;
      if (Math.hypot(i * G - w.at[0], j * G - w.at[1]) < 2.5 && y > -0.5 && y < 1) inside = true;
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const [ni, nj] = [i + di, j + dj];
        if (seen.has(`${ni},${nj}`) || Math.hypot(ni * G - w.at[0], nj * G - w.at[1]) > 16) continue;
        const ny = standAt(ni * G, nj * G, y);
        if (ny === null || ny > 1.5) continue;
        seen.set(`${ni},${nj}`, ny);
        todo.push([ni, nj, ny]);
      }
    }
    return { w, inside, n: seen.size };
  });
  check("the walk-in buildings on the curves: one a corner block, each entered from the street to its ground floor's middle", each.length === 4 && each.every((e) => e.inside), each.map((e) => `${e.w.chunk} ${e.w.piece.replace(".prefab", "")} ${e.inside ? "entered" : `NOT entered (${e.n} squares)`}`).join("; "));
}
// (and the zip lines from the roof yards to the High City decks: each ridden down from the deck onto its yard's roof and
// back up from the yard onto the deck, by a player: stood under its end facing along it, interact, and left to ride)
{
  const ZS = (cfg as unknown as { zips?: Array<{ block: string; a: number[]; b: number[] }> }).zips ?? [];
  // (and from the tower's lookout to its decks, rules.low.zip.lookout, its end at the lookout `over` its roof)
  const ZR = cfg.rules.low as unknown as { zip: { over: number; decks: object; lookout?: { decks: string[]; over: number } } };
  // (a block's own `up` on the top end, Milestone 989)
  const overOf = (q: { block: string; a?: number[]; b: number[] }, end: number[]) => (q.block.startsWith("lookout") && end === q.b ? ZR.zip.lookout!.over : ZR.zip.over + (end === q.a ? ((ZR.zip as unknown as { up?: Record<string, number> }).up?.[q.block] ?? 0) : 0));
  const zipRide = (from: number[], to: number[], over: number) => {
    const p = new Player({ minX: BR_X - 400, maxX: BR_X + 400, minZ: BR_Z - 400, maxZ: BR_Z + 400 });
    const [dx, dz] = [to[0] - from[0], to[2] - from[2]];
    const l = Math.hypot(dx, dz);
    // (0.6 m along it from its end, on what is under there)
    const [sx, sz] = [from[0] + (dx / l) * 0.6, from[2] + (dz / l) * 0.6];
    p.teleport(sx + BR_X, from[1] - over + 0.05, sz + BR_Z, (Math.atan2(-dx, -dz) * 180) / Math.PI);
    p.pitch = 15;
    let [t, tap] = [1000, false];
    const input = { held: (_a: Action) => false, pressedNow: (a: Action) => tap && a === "interact" };
    const step = () => p.update(1 / 144, (t += 1 / 144), input, 0, 1, false);
    for (let i = 0; i < 72; i++) step();
    tap = true;
    step();
    tap = false;
    const rode = p.stance === "zip";
    for (let i = 0; i < 144 * 20 && p.stance === "zip"; i++) step();
    for (let i = 0; i < 144 * 2; i++) step();
    return { rode, x: p.pos.x - BR_X, y: p.pos.y, z: p.pos.z - BR_Z };
  };
  const rides = ZS.map((q) => ({ q, down: zipRide(q.a, q.b, overOf(q, q.a)), up: zipRide(q.b, q.a, overOf(q, q.b)) }));
  // (ridden up to the lookout, anywhere on its roof: a rider comes off a rope's top end at its speed, up to 15 m/s along
  // it, and is carried 8 to 14 m, across the lookout's middle or against the tower's wall; ridden down one onto its deck,
  // within 6 m of its end and a metre of its height, carried on 2 to 5 m and onto the deck's lower parts; on the roof
  // yards' ropes it stops by the end)
  const look = (cfg.rules.perches as unknown as Array<{ name: string; box: number[]; y: number[] }>).find((p) => p.name === "lookout");
  const onLookout = (r: { x: number; y: number; z: number }) => !!look && r.x > look.box[0] && r.x < look.box[1] && r.z > look.box[2] && r.z < look.box[3] && r.y > look.y[0] - 0.2;
  const ok = (r: { rode: boolean; x: number; y: number; z: number }, q: { block: string; b: number[] }, end: number[]) =>
    r.rode && (q.block.startsWith("lookout") && end === q.b ? onLookout(r) : Math.hypot(r.x - end[0], r.z - end[2]) < (q.block.startsWith("lookout") ? 6 : overOf(q, end) > ZR.zip.over ? 16 : 4) && Math.abs(r.y - (end[1] - overOf(q, end))) < (q.block.startsWith("lookout") ? 1 : 0.6));
  check(
    "the zip lines: from the roof yards to the High City decks (rules.low.zip.decks) and from the tower's lookout to its decks, each ridden from end to end both ways by a player",
    ZS.length === Object.keys(ZR.zip.decks).length + (ZR.zip.lookout?.decks.length ?? 0) && ZS.length > 0 && rides.every((r) => ok(r.down, r.q, r.q.b) && ok(r.up, r.q, r.q.a)),
    rides.map((r) => `${r.q.block}: ${r.down.rode ? "rode" : "no grab"} to (${r.down.x.toFixed(1)}, ${r.down.y.toFixed(2)}, ${r.down.z.toFixed(1)}), back ${r.up.rode ? "rode" : "no grab"} to (${r.up.x.toFixed(1)}, ${r.up.y.toFixed(2)}, ${r.up.z.toFixed(1)})`).join("; "),
  );
}
check("the high city decks, the lobby and the corner blocks as the map's named sites", map.sites.length === cfg.game.sites.list.length, map.sites.map((s) => s.name).join(", "));

// The centre's curved streets (rules.streets.curves; the owner, 2026-09-30: "have them curve left and right along with
// buildings so that it's different visually"): each of the eight bends one way and then the other, and meets the edge
// road on the line of the outer district's straight road, heading along it; nothing but a parked car stands in any of
// them; and each corner block is built along its curves (its rooms building and three more at least)
{
  const CV = cfg.rules.streets.curves as unknown as Parameters<typeof curvedStreets>[0] & { inside: number; round: number };
  const ST = curvedStreets(CV);
  const SF = new StreetField(ST);
  const bends: string[] = [];
  for (const st of ST.filter((q) => !q.closed)) {
    // the way it turns, a metre at a time (left or right, where it turns at all), and how often that changes
    let last = 0, changes = 0;
    for (let i = 2; i + 2 < st.tan.length; i += 2) {
      const [a, b] = [st.tan[i - 2], st.tan[i + 2]];
      const turn = a[0] * b[1] - a[1] * b[0];
      if (Math.abs(turn) < 0.01) continue;
      const sgn = Math.sign(turn);
      if (last && sgn !== last) changes++;
      last = sgn;
    }
    bends.push(`${st.id} ${changes}`);
  }
  check("the centre's eight streets each bend one way and then the other (an S), none straight", bends.length === 8 && bends.every((b) => Number(b.split(" ")[1]) >= 2), bends.join(", "));
  const ends = (CV.spokes as Array<{ id: string; to: number[]; out: number[] }>).map((q) => {
    const st = ST.find((x) => x.id === q.id)!;
    const [e, t] = [st.pts[st.pts.length - 1], st.tan[st.tan.length - 1]];
    return Math.hypot(e[0] - q.to[0], e[1] - q.to[1]) < 0.05 && t[0] * q.out[0] + t[1] * q.out[1] > 0.999 && Math.max(Math.abs(e[0]), Math.abs(e[1])) === CV.inside && (cfg.rules.streets.centres as number[]).some((c) => Math.abs(Math.min(Math.abs(e[0]), Math.abs(e[1])) - Math.abs(c)) < 0.05);
  });
  check("each curved street meets the edge road on the outer district's straight road, heading along it", ends.every(Boolean), `${ends.filter(Boolean).length} of ${ends.length}`);
  // (on the road a metre in from its kerb, a metre at a time: a box taller than a car standing across a body's height,
  // but the median's boards, rules.dress.median.tall, and the street cover's, rules.dress.cover.tall, which stand over an
  // eye to cut the street's long sightlines)
  const boards = [
    ...((cfg as unknown as { medians?: Array<{ at: number[]; yaw: number; half?: number[] }> }).medians ?? []),
    ...((cfg as unknown as { streetCover?: Array<{ c: number[]; yaw: number; half?: number[] }> }).streetCover ?? []).map((q) => ({ at: q.c, yaw: q.yaw, half: q.half })),
  ].filter((q) => q.half);
  // (its own boxes, the collision's half-metre columns: a column a turned board's face crosses reaches a cell's diagonal,
  // 0.71 m, past it; a cover board turned 56 degrees blocked the road 0.77 m off its middle line)
  const onBoard = (x: number, z: number) =>
    boards.some((q) => {
      const a = (q.yaw * Math.PI) / 180;
      const [px, pz] = [x - q.at[0], z - q.at[1]];
      return Math.abs(px * Math.cos(a) - pz * Math.sin(a)) < q.half![0] + 0.75 && Math.abs(px * Math.sin(a) + pz * Math.cos(a)) < q.half![1] + 0.75;
    });
  const onRoad: string[] = [];
  let cells = 0;
  for (let x = -CV.inside + 0.5; x < CV.inside; x += 1)
    for (let z = -CV.inside + 0.5; z < CV.inside; z += 1) {
      if (SF.surface(x, z, CV.round) > -1 || onBoard(x, z)) continue;
      cells++;
      const [wx, wz] = [x + BR_X, z + BR_Z];
      if (solidsIn(wx, wx, wz, wz).some((b) => wx >= b.minX && wx <= b.maxX && wz >= b.minZ && wz <= b.maxZ && b.base < MOVE.standHeight && b.top > 2.6)) onRoad.push(`(${x}, ${z})`);
    }
  check("nothing taller than a parked car stands on the centre's roads", cells > 3000 && onRoad.length === 0, `${cells} m2 of road, ${onRoad.length} blocked${onRoad.length ? `: ${onRoad.slice(0, 4).join("; ")}` : ""}`);
  // (the Well's block, rules.well, the Well where its rooms building was)
  const wellBlock = (cfg.rules as unknown as { well?: { block: string } }).well?.block;
  const built = ["c-nw", "c-ne", "c-sw", "c-se"].map((k) => (cfg.chunks as Record<string, { place: unknown[] }>)[k].place.length + (`${k.endsWith("w") ? -1 : 1},${k[2] === "n" ? -1 : 1}` === wellBlock && (cfg.chunks as Record<string, { place: unknown[] }>)["c-well"]?.place.length ? 1 : 0));
  check("each corner block built along its curves: its rooms building (or the Well) and three more at least", built.every((n) => n >= 4), built.join(", "));
}

// The Sky Ring (rules.skyring): the walkway storey round the tower's plaza. Walked up each of its stairs from the
// plaza, on foot (a body the square round the player's round one, a step up at a time, a quarter metre at a time), onto
// its deck and round the whole of it to the tops of the other three; railed along both edges from every metre but its
// stairs' openings (a look across the deck at the waist, in and out, meets a fence); and a standing body's room under
// it wherever it passes over the plaza and the Loop
{
  const SR = cfg.rules.skyring as { r0: number; r1: number; deck: number; fence: { gap: number } };
  const K2 = (cfg as unknown as { skyring: { stairs: number[][]; exits: number[][] } }).skyring;
  const C = 0.25, H = MOVE.radius, E = SR.r1 + 4;
  const N = Math.round((2 * E) / C);
  const boxes = (i: number, j: number) => {
    const x = -E + (i + 0.5) * C + BR_X, z = -E + (j + 0.5) * C + BR_Z;
    return solidsIn(x - H, x + H, z - H, z + H).filter((b) => b.minX < x + H && b.maxX > x - H && b.minZ < z + H && b.maxZ > z - H);
  };
  const floorFor = (i: number, j: number, y: number): number | null => {
    const r = Math.hypot(-E + (i + 0.5) * C, -E + (j + 0.5) * C);
    if (r < SR.r0 - 9 || r > SR.r1 + 1) return null;
    const here = boxes(i, j);
    let f = 0;
    for (const b of here) if (b.top <= y + MOVE.stepHeight && b.top > f) f = b.top;
    return here.some((b) => b.base < Math.max(f, y) + MOVE.standHeight && b.top > Math.max(f, y) + MOVE.stepHeight) ? null : f;
  };
  const cell = (x: number, z: number) => [Math.floor((x + E) / C), Math.floor((z + E) / C)];
  const seen = new Map<number, number>();
  const todo: number[] = [];
  // (from the plaza in front of each stair: its lower flight's foot is under the ring's edge, a metre on out)
  for (const [sx, sz] of K2.stairs) {
    const r = Math.hypot(sx, sz);
    const [i, j] = cell((sx / r) * (r - 4), (sz / r) * (r - 4));
    const f = floorFor(i, j, 0);
    if (f !== null && !seen.has(i * N + j)) (seen.set(i * N + j, f), todo.push(i * N + j));
  }
  while (todo.length) {
    const k = todo.pop()!;
    const [i, j, y] = [Math.floor(k / N), k % N, seen.get(k)!];
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const [a, b] = [i + di, j + dj];
      if (a < 0 || b < 0 || a >= N || b >= N) continue;
      const was = seen.get(a * N + b);
      const f = floorFor(a, b, y);
      if (f === null || f < y - 0.6) continue;
      if (was !== undefined && was >= f) continue;
      seen.set(a * N + b, f);
      todo.push(a * N + b);
    }
  }
  // the deck's middle circle a metre at a time: reached, and railed both ways
  const mid = (SR.r0 + SR.r1) / 2;
  let deck = 0, reached = 0;
  const open: string[] = [];
  const waist = SR.deck + 0.5;
  const railed = (x: number, z: number, dx: number, dz: number, far: number) => {
    for (let t = 0; t <= far; t += 0.1) {
      const [wx, wz] = [x + dx * t + BR_X, z + dz * t + BR_Z];
      if (solidsIn(wx, wx, wz, wz).some((b) => wx >= b.minX && wx <= b.maxX && wz >= b.minZ && wz <= b.maxZ && b.base < waist && b.top > waist)) return true;
    }
    return false;
  };
  const n = Math.round(2 * Math.PI * mid);
  for (let k = 0; k < n; k++) {
    const a = (k / n) * 2 * Math.PI;
    const [x, z] = [Math.cos(a) * mid, Math.sin(a) * mid];
    const [i, j] = cell(x, z);
    deck++;
    if (Math.abs((seen.get(i * N + j) ?? -9) - SR.deck) < 0.1) reached++;
    // (and where the base's bridges meet it, rules.base)
    // (the fence is left open by the chord: within its gap of a bridge, a chord's half length on)
    const nearExit = K2.exits.some(([ex, ez]) => Math.hypot(ex - Math.cos(a) * SR.r0, ez - Math.sin(a) * SR.r0) < SR.fence.gap + 0.5) || ((cfg as unknown as { base?: { bridges: number[][] } }).base?.bridges ?? []).some(([ex, ez]) => Math.hypot(ex - Math.cos(a) * SR.r0, ez - Math.sin(a) * SR.r0) < SR.fence.gap + 1.3);
    // (and its outer edge where each glass lift's bridge leaves it, rules.lifts)
    const nearLift = ((cfg as unknown as { lifts?: Array<{ ring: number[] }> }).lifts ?? []).some(({ ring: [ex, ez] }) => Math.hypot(ex - Math.cos(a) * SR.r1, ez - Math.sin(a) * SR.r1) < SR.fence.gap + 1.3);
    if (!nearLift && !railed(x, z, Math.cos(a), Math.sin(a), (SR.r1 - SR.r0) / 2 + 0.3)) open.push(`out at ${((a * 180) / Math.PI).toFixed(0)} deg`);
    if (!nearExit && !railed(x, z, -Math.cos(a), -Math.sin(a), (SR.r1 - SR.r0) / 2 + 0.3)) open.push(`in at ${((a * 180) / Math.PI).toFixed(0)} deg`);
  }
  const tops = K2.exits.filter(([ex, ez]) => {
    const [i, j] = cell(ex, ez);
    return Math.abs((seen.get(i * N + j) ?? -9) - SR.deck) < 0.2;
  }).length;
  check("the Sky Ring: walked up its stairs from the plaza onto its deck and round the whole of it, on foot", reached / deck > 0.98 && tops === K2.exits.length, `${reached} of ${deck} metres of its deck reached, ${tops} of ${K2.exits.length} stairs' tops`);
  check("the Sky Ring: railed along both edges from every metre, but where its stairs arrive", deck > 200 && open.length === 0, `${open.length} open${open.length ? `: ${open.slice(0, 5).join("; ")}` : ""}`);
  // (under it: the lowest thing over the plaza and the Loop between its edges)
  let low = Infinity;
  for (let k = 0; k < n; k++) {
    const a = (k / n) * 2 * Math.PI;
    for (let r = SR.r0 + 0.3; r < SR.r1 - 0.3; r += 0.5) {
      const [wx, wz] = [Math.cos(a) * r + BR_X, Math.sin(a) * r + BR_Z];
      // (what stands overhead: the deck and what is on it, not a parked car in the lane under it)
      for (const b of solidsIn(wx, wx, wz, wz)) if (wx >= b.minX && wx <= b.maxX && wz >= b.minZ && wz <= b.maxZ && b.top > SR.deck - 1 && b.base < low) low = b.base;
    }
  }
  check("the Sky Ring: a standing body's room under it all the way round", low > MOVE.standHeight + 0.5, `its underside ${low.toFixed(2)} m up at its lowest`);
}

// The base (rules.base): the tower's wide lower floors. Each of its stairs walked up and down by a player's own movement
// along its flights; from the plaza round it and the tops of the stairs walked, on foot (a body the square round the
// player's round one, a quarter metre at a time, up a step at a time, down any drop), each of its storeys and its roof
// reached over most of its floor; and each door in its faces and each bridge from the Sky Ring walked through by a
// player's own movement, ending inside on that storey; and from its roof onto the tower's terrace and in through its
// glass waist (the tower's core kept out of the walk: the plaza walks into it through the lobby's door, and up it to every
// storey). (The stairs are walked, not flooded: the collision's quarter
// metre widens the pack's double flight's cheeks to leave its lower flight 1.0 m clear, room for the player's round
// 0.82 but not for the flood's square on its own grid)
{
  const BS = (cfg as unknown as { base: { outline: number[][]; levels: Array<{ y: number }>; stairs: Array<{ at: number; top: number[]; route: number[][] }>; gates: Array<{ at: number; out: number[]; in: number[] }>; bridges: number[][] } }).base;
  const T = cfg.tallest;
  const C = 0.25, H = MOVE.radius;
  const xs = BS.outline.map((p) => p[0]), zs = BS.outline.map((p) => p[1]);
  const [X0, X1, Z0, Z1] = [Math.min(...xs) - 4, Math.max(...xs) + 4, Math.min(...zs) - 4, Math.max(...zs) + 4];
  const [NI, NJ] = [Math.ceil((X1 - X0) / C), Math.ceil((Z1 - Z0) / C)];
  const [cx0, cx1, cz0, cz1] = (cfg as unknown as { tower: { core: { box: number[] } } }).tower.core.box;
  const inCore = (q: { i: number; j: number }) => {
    const [x, z] = [X0 + (q.i + 0.5) * C, Z0 + (q.j + 0.5) * C];
    return x > cx0 - 0.3 && x < cx1 + 0.3 && z > cz0 - 0.3 && z < cz1 + 0.3;
  };
  const insideBase = (x: number, z: number) => {
    let inside = false;
    const p = BS.outline;
    for (let i = 0, j = p.length - 1; i < p.length; j = i++) if (p[i][1] > z !== p[j][1] > z && x < ((p[j][0] - p[i][0]) * (z - p[i][1])) / (p[j][1] - p[i][1]) + p[i][0]) inside = !inside;
    return inside;
  };
  // each cell's floors with a standing body's room over them
  const spots: Array<{ i: number; j: number; y: number }> = [];
  const at = new Map<number, number[]>();
  for (let i = 0; i < NI; i++)
    for (let j = 0; j < NJ; j++) {
      const [x, z] = [X0 + (i + 0.5) * C + BR_X, Z0 + (j + 0.5) * C + BR_Z];
      const here = solidsIn(x - H, x + H, z - H, z + H).filter((b) => b.minX < x + H && b.maxX > x - H && b.minZ < z + H && b.maxZ > z - H);
      const ys = new Set<number>([floorAt(x, z)]);
      for (const b of here) if (b.minX <= x && b.maxX >= x && b.minZ <= z && b.maxZ >= z && b.top < 20) ys.add(b.top);
      const list = [...ys].filter((y) => !here.some((b) => b.base < y + MOVE.standHeight && b.top > y + MOVE.stepHeight));
      if (list.length) at.set(i * NJ + j, list.map((y) => (spots.push({ i, j, y }), spots.length - 1)));
    }
  const seen = new Uint8Array(spots.length);
  const todo: number[] = [];
  for (const [k, list] of at) {
    const [i, j] = [Math.floor(k / NJ), k % NJ];
    if (i > 1 && i < NI - 2 && j > 1 && j < NJ - 2) continue;
    for (const s of list) if (Math.abs(spots[s].y) < 0.05) ((seen[s] = 1), todo.push(s));
  }
  // each stair walked up its flights and back down; the top of each one walked up seeds the flood on its storey
  const walked = BS.stairs.map((q) => ({ q, up: along(q.route), down: along([...q.route].reverse()) }));
  const climbed = walked.filter((w) => w.up.k === w.q.route.length && w.down.k === w.q.route.length);
  for (const { q } of climbed) {
    const [tx, tz, ty] = q.route.at(-1)!;
    for (const s of at.get(Math.floor((tx - X0) / C) * NJ + Math.floor((tz - Z0) / C)) ?? []) if (Math.abs(spots[s].y - ty) < 0.1 && !seen[s]) ((seen[s] = 1), todo.push(s));
  }
  while (todo.length) {
    const a = spots[todo.pop()!];
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      if (a.i + di < 0 || a.i + di >= NI || a.j + dj < 0 || a.j + dj >= NJ) continue;
      for (const s of at.get((a.i + di) * NJ + a.j + dj) ?? []) if (!seen[s] && spots[s].y - a.y <= MOVE.stepHeight && !inCore(spots[s])) ((seen[s] = 1), todo.push(s));
    }
  }
  if (process.env.DEBUG_BASE) { const band = new Map<number, number[]>(); spots.forEach((q, k) => { const r = band.get(Math.round(q.y)) ?? [0, 0]; r[0]++; if (seen[k]) r[1]++; band.set(Math.round(q.y), r); }); console.log("base spots by height", JSON.stringify([...band].sort((x, y) => x[0] - y[0]))); }
  const reachedAt = (x: number, z: number, y: number) => (at.get(Math.floor((x - X0) / C) * NJ + Math.floor((z - Z0) / C)) ?? []).some((s) => seen[s] && Math.abs(spots[s].y - y) < 0.1);
  // a storey's own floor: in the outline, out of the tower's footprint, at the storey's height
  const shares = BS.levels.map(({ y }) => {
    let [of, got] = [0, 0];
    spots.forEach((s, k) => {
      const [x, z] = [X0 + (s.i + 0.5) * C, Z0 + (s.j + 0.5) * C];
      if (Math.abs(s.y - y) > 0.1 || !insideBase(x, z) || (x > T.x0 && x < T.x1 && z > T.z0 && z < T.z1)) return;
      of++;
      if (seen[k]) got++;
    });
    return { y, of: of * C * C, share: of ? got / of : 0 };
  });
  check("the base: each of its storeys and its roof walked to from the plaza, up its stairs, over most of its floor", shares.every((q) => q.of > 500 && q.share > 0.9), shares.map((q) => `${q.y} m: ${(q.share * 100).toFixed(0)}% of ${q.of.toFixed(0)} m2`).join("; "));
  check("the base: every stair walked up from its foot and back down by a player", climbed.length === BS.stairs.length, `${climbed.length} of ${BS.stairs.length}${climbed.length < BS.stairs.length ? `: not ${walked.filter((w) => !climbed.includes(w)).map((w) => `${w.q.at} m at (${w.q.top.join(", ")}): up ${w.up.k - 1} of ${w.q.route.length - 1} legs to ${w.up.y.toFixed(2)} m, down ${w.down.k - 1}`).join("; ")}` : ""}`);
  // the waist's floor (rules.tower.waist, its box in the tower's own frame) at the roof's height
  const TWR = cfg as unknown as { tower: { pivot: number[] }; rules: { tower: { waist: number[] } } };
  const [wx0, wx1, wz0, wz1] = TWR.rules.tower.waist.map((v, k) => v + TWR.tower.pivot[k < 2 ? 0 : 1]);
  const roof = BS.levels.at(-1)!.y;
  let waist = 0;
  spots.forEach((s, k) => {
    const [x, z] = [X0 + (s.i + 0.5) * C, Z0 + (s.j + 0.5) * C];
    if (seen[k] && Math.abs(s.y - roof) < 0.1 && x > wx0 && x < wx1 && z > wz0 && z < wz1) waist += C * C;
  });
  check("the base: its roof walked onto the tower's terrace and in through its glass waist, the core kept out", waist > 100, `${waist.toFixed(0)} m2 of the waist's floor at ${roof} m`);
  check("the base: each stair's foot on the plaza's side reached on foot", BS.stairs.every((q) => q.at > 0 || reachedAt(q.route[0][0], q.route[0][1], q.at)), "");
  // each door sprinted through from a metre outside to three in, and each bridge from the Sky Ring's deck to the door
  const through = (from: number[], to: number[], y: number) => {
    const yaw = (Math.atan2(-(to[0] - from[0]), -(to[1] - from[1])) * 180) / Math.PI;
    const p = new Player({ minX: BR_X - 400, maxX: BR_X + 400, minZ: BR_Z - 400, maxZ: BR_Z + 400 });
    p.teleport(from[0] + BR_X, y + 0.05, from[1] + BR_Z, yaw);
    const walk = { held: (a: Action) => a === "forward", pressedNow: (_a: Action) => false };
    let t = 1000;
    const want = Math.hypot(to[0] - from[0], to[1] - from[1]);
    for (let i = 0; i < 144 * 4; i++) {
      p.update(1 / 144, (t += 1 / 144), walk, 0, 1, false);
      if (Math.hypot(p.pos.x - BR_X - from[0], p.pos.z - BR_Z - from[1]) >= want) break;
    }
    return Math.hypot(p.pos.x - BR_X - to[0], p.pos.z - BR_Z - to[1]) < 0.6 && Math.abs(p.pos.y - y) < 0.3;
  };
  const doors = BS.gates.filter((g) => !through(g.out, g.in, g.at));
  check("the base: every door in its faces walked through from outside", BS.gates.length > 10 && doors.length === 0, `${BS.gates.length - doors.length} of ${BS.gates.length}${doors.length ? `: not ${doors.map((g) => `${g.at} m at (${g.out.join(", ")})`).join("; ")}` : ""}`);
  // the ground floor the most open (the owner, 2026-10-02: "the first floor should be the most open and wide"): its faces
  // open at a body's height along most of their length, and of the storeys the most of its floor a standing body's room
  const openAlong = (y: number) => {
    let [of, open] = [0, 0];
    const O = BS.outline;
    for (let k = 0; k < O.length; k++) {
      const [a, b] = [O[k], O[(k + 1) % O.length]];
      const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
      for (let t = 0.125; t < L; t += 0.25) {
        const [x, z] = [a[0] + ((b[0] - a[0]) * t) / L + BR_X, a[1] + ((b[1] - a[1]) * t) / L + BR_Z];
        of++;
        if (!solidsIn(x - 0.3, x + 0.3, z - 0.3, z + 0.3).some((q) => q.minX < x + 0.3 && q.maxX > x - 0.3 && q.minZ < z + 0.3 && q.maxZ > z - 0.3 && q.base < y + 2 && q.top > y + 0.5)) open++;
      }
    }
    return open / of;
  };
  const faces = BS.levels.slice(0, -1).map(({ y }) => ({ y, open: openAlong(y) }));
  const room = BS.levels.slice(0, -1).map(({ y }) => {
    let [of, got] = [0, 0];
    for (let i = 0; i < NI; i++)
      for (let j = 0; j < NJ; j++) {
        const [x, z] = [X0 + (i + 0.5) * C, Z0 + (j + 0.5) * C];
        if (!insideBase(x, z) || (x > T.x0 && x < T.x1 && z > T.z0 && z < T.z1)) continue;
        of++;
        if ((at.get(i * NJ + j) ?? []).some((s) => Math.abs(spots[s].y - y) < 0.1)) got++;
      }
    return { y, share: got / of };
  });
  // (half: the collision's half-metre cells make a colonnade's 1 m pillar 1.5 m, so a 5 m bay is 3.5 m open; the storeys
  // over it a quarter, their windows 2.5 m of each 5 m bay less the probe's reach either side; the ground floor was about
  // a sixth with its fourteen doors)
  check("the base: its ground floor open to the plaza all round, the storeys over it windowed", faces[0].open > 0.5 && faces.slice(1).every((f) => f.open > 0.1 && f.open < 0.4), faces.map((f) => `${f.y} m: ${(f.open * 100).toFixed(0)}% of its faces open`).join("; "));
  check("the base: its ground floor the most open of its storeys, the most of its floor a standing body's room", room.slice(1).every((r) => r.share < room[0].share), room.map((r) => `${r.y} m: ${(r.share * 100).toFixed(0)}%`).join("; "));
  const SR = cfg.rules.skyring as { r0: number; r1: number; deck: number };
  // (along each bridge's own line, from a metre and a half out on the ring to three in through its door)
  const axes = (BS as unknown as { bridgeAxes: number[][][] }).bridgeAxes;
  const bridges = axes.filter(([door, far]) => {
    const L = Math.hypot(far[0] - door[0], far[1] - door[1]);
    const u = [(far[0] - door[0]) / L, (far[1] - door[1]) / L];
    return through([far[0] + u[0] * 1.5, far[1] + u[1] * 1.5], [door[0] - u[0] * 3, door[1] - u[1] * 3], SR.deck);
  });
  // the centre's pads joined on foot: each pad on the plaza and the pad up to the top walked to from the plaza, each landing
  // on the base's roof (from the plaza, and the way down's) walked from there
  const SPN = (cfg as unknown as { spine: { up: Array<{ id: string; face: number[]; out: number[]; pad: number[]; floor: number; land: number; ground: number }>; down: Array<{ id: string; land: number[]; landY: number }> } }).spine;
  // (not the corner blocks' pads, rules.pads.spine's corner-*: they go up from the edge road, out of the centre, and each
  // is ridden by its own check)
  // (the centre's own: not the corner blocks' or the districts' pads, out on their streets and alleys)
  const SPU = SPN.up.filter((q) => !["corner-", "lantern-", "terminal-", "stacks-", "glass-", "canyon-", "works-", "worksyard-"].some((p) => q.id.startsWith(p)));
  const stops = [
    ...SPU.map((q) => ({ id: `${q.id}'s pad`, x: q.pad[0], z: q.pad[1], y: q.floor })),
    ...SPU.filter((q) => q.floor === 0).map((q) => ({ id: `${q.id}'s landing`, x: q.face[0] - q.out[0] * q.land, z: q.face[1] - q.out[1] * q.land, y: q.ground })),
    ...SPN.down.map((q) => ({ id: `${q.id}'s landing`, x: q.land[0], z: q.land[1], y: q.landY })),
  ];
  const astray = stops.filter((q) => !reachedAt(q.x, q.z, q.y));
  check("the centre's pads: each on the plaza and the one up to the top walked to, each landing on the base's roof walked from", stops.length >= 10 && astray.length === 0, `${stops.length - astray.length} of ${stops.length}${astray.length ? `: not ${astray.map((q) => q.id).join(", ")}` : ""}`);
  // the windows (rules.windows; the owner, 2026-10-02: "actual windows that are open and that we can just go right on
  // through ... regular sized windows, like it would have to be a well placed sniper shot"): each in the tower and the
  // base open to a shot through its middle at a standing chest's height, through the wall's depth and more either side
  // of its plane; each walked out of by a player from three quarters of a metre inside, over its 0.44 m sill (a table stands a
  // metre and a quarter in behind one); none wider than a window
  const WN = (cfg as unknown as { windows: Array<{ at: number[]; out: number[]; wide: number; sill: number; high: number; chunk: string }> }).windows ?? [];
  const shot = (q: (typeof WN)[number]) => {
    const y = q.sill + 1.3;
    for (let k = -0.7; k <= 0.7; k += 0.05) {
      const [x, z] = [q.at[0] + q.out[0] * k + BR_X, q.at[2] + q.out[1] * k + BR_Z];
      if (solidsIn(x, x, z, z).some((b) => x >= b.minX && x <= b.maxX && z >= b.minZ && z <= b.maxZ && y >= b.base && y <= b.top)) return false;
    }
    return true;
  };
  const outOf = (q: (typeof WN)[number]) => {
    const p = new Player({ minX: BR_X - 400, maxX: BR_X + 400, minZ: BR_Z - 400, maxZ: BR_Z + 400 });
    const floor = q.sill - 0.44;
    p.teleport(q.at[0] - q.out[0] * 0.75 + BR_X, floor + 0.05, q.at[2] - q.out[1] * 0.75 + BR_Z, (Math.atan2(-q.out[0], -q.out[1]) * 180) / Math.PI);
    const go = { held: (a: Action) => a === "forward", pressedNow: (_a: Action) => false };
    let t = 1000;
    for (let i = 0; i < 144 * 2; i++) {
      p.update(1 / 144, (t += 1 / 144), go, 0, 1, false);
      if ((p.pos.x - BR_X - q.at[0]) * q.out[0] + (p.pos.z - BR_Z - q.at[2]) * q.out[1] > 0.6) return true;
    }
    return false;
  };
  const shut = WN.filter((q) => !shot(q));
  // (a window a stair's half landing stands against inside, `rules.windows.landing` [x, z]: open to a shot, shut to a body. The
  // base's at (24.75, 0.875): its landing leaves 0.38 m of the window, and the push-out threw the walk's start through it, so
  // it read open until Milestone 991)
  const landing = (cfg.rules as unknown as { windows: { landing?: number[][] } }).windows.landing ?? [];
  const boxedIn = (q: (typeof WN)[number]): boolean => landing.some(([x, z]) => Math.abs(q.at[0] - x) < 0.01 && Math.abs(q.at[2] - z) < 0.01);
  const stuck = WN.filter((q) => !boxedIn(q) && !outOf(q));
  const where = (l: typeof WN) => l.slice(0, 6).map((q) => `${q.chunk} (${q.at.map((v) => v.toFixed(1)).join(", ")})`).join("; ");
  const inTower = WN.filter((q) => q.chunk === "c-middle").length;
  check("the windows: each in the tower and the base open to a shot through its middle", inTower > 80 && WN.length - inTower > 80 && shut.length === 0, `${WN.length - shut.length} of ${WN.length} (the tower ${inTower})${shut.length ? `: not ${where(shut)}` : ""}`);
  check("the windows: each walked out of by a player from inside", stuck.length === 0, `${WN.length - stuck.length} of ${WN.length}${stuck.length ? `: not ${where(stuck)}` : ""}`);
  check("the windows: each a window, 1.5 m wide or under and a body's height", WN.every((q) => q.wide <= 1.5 && q.wide > 0.9 && q.high > MOVE.standHeight), `${Math.min(...WN.map((q) => q.wide)).toFixed(2)} to ${Math.max(...WN.map((q) => q.wide)).toFixed(2)} m wide, ${Math.min(...WN.map((q) => q.high)).toFixed(2)} m high`);
  check("the base: every bridge from the Sky Ring walked across into its first floor", BS.bridges.length > 0 && bridges.length === BS.bridges.length, `${bridges.length} of ${BS.bridges.length}`);
}

// The tower's floors (rules.tower): its stair core walked by a player's own movement from the lobby in through its west
// door to its top storey's landing and back down; from the plaza and the core's landings so walked, on foot (the base's
// flood), every storey the core serves reached beyond its doors and the main body's new floors over most of their floor;
// those floors each the inside of the tower's shell, the same on every storey; and none of them seen through: the
// bake's fan of rays from all over each floor at eye height meets a face turned toward it every time
{
  const TW = (cfg as unknown as { tower: { square: number[]; shaft: number[]; levels?: Array<{ floor: { at: number }; ceiling: { at: number; slab: number } }>; core: { box: number[]; storeys: number[]; doors: string[][]; route: number[][] }; measured: { floors: number[]; seal: Array<{ at: number; rays: number; out: number }> } } }).tower;
  const [cx0, cx1, cz0, cz1] = TW.core.box;
  // (the storeys with a floor, the ones the core has doors on: from the sky floors to the crown it climbs the hollow with
  // closed landings every 3 m between the three levels, rules.tower.levels)
  const FLOORED = TW.core.storeys.filter((_, k) => TW.core.doors[k]?.length);
  const LVL = (TW.levels ?? []).map((q) => q.floor.at);
  // (from the lobby a metre and a half out of its west door, through the door's middle)
  const route = [[cx0 - 1.5, (cz0 + cz1) / 2, TW.core.storeys[0]], [cx0 + 0.75, (cz0 + cz1) / 2, TW.core.storeys[0]], ...TW.core.route];
  // (a longer walk than an entrance's: fourteen storeys up a switchback)
  const walk = (pts: number[][]) => {
    const p = new Player({ minX: BR_X - 400, maxX: BR_X + 400, minZ: BR_Z - 400, maxZ: BR_Z + 400 });
    p.teleport(pts[0][0] + BR_X, pts[0][2] + 0.05, pts[0][1] + BR_Z, 0);
    const go = { held: (a: Action) => a === "forward", pressedNow: (_a: Action) => false };
    let t = 1000;
    let k = 1;
    // (to the crown since Milestone 509: thirty-five storeys)
    for (let i = 0; i < 600 * 144 && k < pts.length; i++) {
      const [tx, tz, ty] = pts[k];
      const dx = tx - (p.pos.x - BR_X), dz = tz - (p.pos.z - BR_Z);
      if (Math.hypot(dx, dz) < 0.3 && Math.abs(p.pos.y - ty) < 0.6) {
        k++;
        continue;
      }
      p.yaw = (Math.atan2(-dx, -dz) * 180) / Math.PI;
      p.update(1 / 144, (t += 1 / 144), go, 0, 1, false);
    }
    return { k, y: p.pos.y };
  };
  const up = walk(route);
  const down = walk([...route].reverse());
  const climbed = up.k === route.length && down.k === route.length;
  check("the tower: its stair core walked from the lobby to its top storey and back down by a player", climbed, `up ${up.k - 1} of ${route.length - 1} legs to ${up.y.toFixed(2)} m, down ${down.k - 1}`);
  // every storey from the plaza and the walked core's landings, on foot
  const [sx0, sx1, sz0, sz1] = TW.square;
  const C = 0.25, H = MOVE.radius;
  const [X0, X1, Z0, Z1] = [sx0 - 3, sx1 + 3, sz0 - 3, sz1 + 3];
  const [NI, NJ] = [Math.ceil((X1 - X0) / C), Math.ceil((Z1 - Z0) / C)];
  const spots: Array<{ i: number; j: number; y: number }> = [];
  const at = new Map<number, number[]>();
  const boxesAt = new Map<number, Array<{ base: number; top: number }>>();
  for (let i = 0; i < NI; i++)
    for (let j = 0; j < NJ; j++) {
      const [x, z] = [X0 + (i + 0.5) * C + BR_X, Z0 + (j + 0.5) * C + BR_Z];
      const here = solidsIn(x - H, x + H, z - H, z + H).filter((b) => b.minX < x + H && b.maxX > x - H && b.minZ < z + H && b.maxZ > z - H);
      boxesAt.set(i * NJ + j, here);
      const ys = new Set<number>([floorAt(x, z)]);
      // (up to the crown since Milestone 509: the three levels and the crown's deck are floors the core serves)
      for (const b of here) if (b.minX <= x && b.maxX >= x && b.minZ <= z && b.maxZ >= z && b.top < TW.core.storeys[TW.core.storeys.length - 1] + 0.5) ys.add(b.top);
      const list = [...ys].filter((y) => !here.some((b) => b.base < y + MOVE.standHeight && b.top > y + MOVE.stepHeight));
      if (list.length) at.set(i * NJ + j, list.map((y) => (spots.push({ i, j, y }), spots.length - 1)));
    }
  const seen = new Uint8Array(spots.length);
  const todo: number[] = [];
  const seed = (x: number, z: number, y: number) => {
    for (const s of at.get(Math.floor((x - X0) / C) * NJ + Math.floor((z - Z0) / C)) ?? []) if (Math.abs(spots[s].y - y) < 0.15 && !seen[s]) ((seen[s] = 1), todo.push(s));
  };
  for (const [k, list] of at) {
    const [i, j] = [Math.floor(k / NJ), k % NJ];
    if (i > 1 && i < NI - 2 && j > 1 && j < NJ - 2) continue;
    for (const s of list) if (Math.abs(spots[s].y) < 0.05) ((seen[s] = 1), todo.push(s));
  }
  if (climbed) for (const [x, z, y] of TW.core.route) seed(x, z, y);
  while (todo.length) {
    const a = spots[todo.pop()!];
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      if (a.i + di < 0 || a.i + di >= NI || a.j + dj < 0 || a.j + dj >= NJ) continue;
      // (a drop only down a clear column: nothing in the cell dropped into between its floor and the faller's head; the
      // flood dropped through the tower's shell from the sky floors' balconies onto its floors otherwise)
      const q = (a.i + di) * NJ + a.j + dj;
      for (const s of at.get(q) ?? []) {
        if (seen[s] || spots[s].y - a.y > MOVE.stepHeight) continue;
        if (spots[s].y < a.y - MOVE.stepHeight && boxesAt.get(q)!.some((b) => b.top > spots[s].y + MOVE.stepHeight && b.base < a.y + MOVE.standHeight)) continue;
        seen[s] = 1;
        todo.push(s);
      }
    }
  }
  // a storey's floor out of the core: what of it a body stands on, what of that it walked to, and the same for each of
  // the eight rooms of the ring round the core (north, south, east and west of it and the four corners, as the
  // partitions' lines part them)
  const storey = (y: number) => {
    let [of, got] = [0, 0];
    const rooms = Array.from({ length: 9 }, () => ({ of: 0, got: 0 }));
    spots.forEach((s, k) => {
      const [x, z] = [X0 + (s.i + 0.5) * C, Z0 + (s.j + 0.5) * C];
      if (Math.abs(s.y - y) > 0.1 || x < sx0 || x > sx1 || z < sz0 || z > sz1 || (x > cx0 - 0.3 && x < cx1 + 0.3 && z > cz0 - 0.3 && z < cz1 + 0.3)) return;
      const room = rooms[(z < cz0 ? 0 : z > cz1 ? 2 : 1) * 3 + (x < cx0 ? 0 : x > cx1 ? 2 : 1)];
      of++;
      room.of++;
      if (seen[k]) (got++, room.got++);
    });
    return { y, of: of * C * C, got: got * C * C, rooms: rooms.filter((_, i) => i !== 4) };
  };
  const all = FLOORED.map(storey);
  check("the tower: every storey its core serves walked to from the plaza, beyond the core's doors", all.every((q) => q.got > 30), all.map((q) => `${q.y} m ${q.got.toFixed(0)} m2`).join("; "));
  // (and the sky floors over them, rules.tower.sky, partitioned as they are: most of each floor, and two-fifths of every
  // room of it, so a room walled off by cover is caught however small: on the bunkers floor two crates walled the east
  // room off, 12% of it walked, and the floor was still 94% walked. The sky floors 85%: each face's groove holds a
  // balcony of the pack's behind its glass, walked to from nowhere before they were partitioned, 94% of 277 m2 on 38.5
  // and 42 m, and half the west room there, 53 to 54% of it walked)
  const SKYW = (TW as unknown as { sky?: number[] }).sky ?? [];
  // (and the three levels over them, rules.tower.levels, as the sky floors are)
  const laid = all.filter((q) => TW.shaft.includes(q.y) || SKYW.includes(q.y) || LVL.includes(q.y));
  const roomsOk = (q: (typeof laid)[number]) => q.rooms.every((r) => r.of * C * C < 4 || r.got / r.of > 0.4);
  check(
    "the tower: its new floors, its sky floors and its three levels walked over, most of each and every room of it",
    laid.length === TW.shaft.length + SKYW.length + LVL.length && laid.every((q) => q.of > 100 && q.got / q.of > (SKYW.includes(q.y) || LVL.includes(q.y) ? 0.85 : 0.9) && roomsOk(q)),
    // (the rooms named by where they lie round the core, the rooms list's order less its middle)
    laid.map((q) => `${q.y} m ${((q.got / q.of) * 100).toFixed(0)}% of ${q.of.toFixed(0)} m2${roomsOk(q) ? "" : ` (${q.rooms.map((r, i) => ({ r, name: ["north-west", "north", "north-east", "west", "east", "south-west", "south", "south-east"][i] })).filter(({ r }) => r.of * C * C >= 4 && r.got / r.of <= 0.4).map(({ r, name }) => `its ${name} room ${((r.got / r.of) * 100).toFixed(0)}%`).join(", ")})`}`).join("; "),
  );
  // (measured by the bake: a layout run since without a bake leaves none)
  const F = TW.measured?.floors ?? [];
  check("the tower: its new floors each the inside of its shell, the same on every storey", F.length === TW.shaft.length && Math.min(...F) > 300 && Math.max(...F) - Math.min(...F) < 0.05 * Math.max(...F), `${F.join(", ")} m2`);
  const S = (TW.measured?.seal ?? []) as Array<{ at: number; rays: number; out: number; windows?: number }>;
  // (but through its windows, open since the owner asked: a ray out anywhere else is a gap in its shell)
  check("the tower: its new floors not seen through but by their windows, every other ray from each meets a wall", S.length === TW.shaft.length && S.every((q) => q.rays > 500 && q.out === 0 && (q.windows ?? 0) > 0), S.map((q) => `${q.at} m ${q.out} of ${q.rays} out elsewhere, ${q.windows ?? 0} through windows`).join("; "));
  // (the sky floors over them, rules.tower.sky, the pack's own storeys)
  const SKY = (TW as unknown as { sky?: number[] }).sky ?? [];
  // A ceiling over every storey from the new floors up (the lid over the top one, rules.tower.lid): over each spot a
  // body stands on inside the main body, out of the core, a box within the storey's height. The top storey had none
  // over most of it, and a body there looked 60 m up into the tower's hollow upper half
  {
    const LID = (TW as unknown as { lid?: { at: number; slab: number } }).lid;
    const ST = TW.core.storeys;
    const slab = (cfg.rules.tower as unknown as { slab: number }).slab;
    // (each floor's ceiling the nearest slab over it: the storey over it's, or the lid's or a level's own, as the layout has
    // it; the crown, the core's top storey, is open to the sky)
    const own = [...(LID ? [LID] : []), ...(TW.levels ?? []).map((q) => q.ceiling)];
    const open = FLOORED.filter((h) => h >= TW.shaft[0] && h < ST[ST.length - 1]).map((h) => {
      const i = ST.indexOf(h);
      const mine = (TW.levels ?? []).find((q) => q.floor.at === h)?.ceiling ?? own.find((q) => q.at > h && q.at <= ST[i + 1] + 0.1);
      const ceiling = mine ? mine.at - mine.slab : ST[i + 1] - slab;
      let [stood, bare] = [0, 0];
      // (and the express ropes' shafts, open over the 45.5 m floor where they start: rules.tower.express)
      const EXs = (TW as unknown as { express?: { at: number[][]; hole: number; to: number } }).express;
      const inShaft = (x: number, z: number) => !!EXs && h < EXs.to && EXs.at.some(([ex, ez]) => Math.abs(x - ex) < EXs.hole / 2 + 0.3 && Math.abs(z - ez) < EXs.hole / 2 + 0.3);
      // (and the holes in the slab over it, open on purpose since Milestone 879: rules.tower.floors.at[the storey over].holes)
      const holesOver = (cfg.rules.tower as unknown as { floors: { at: Record<string, { holes?: number[][] }> } }).floors.at[String(ST[i + 1])]?.holes ?? [];
      const inHole = (x: number, z: number) => holesOver.some(([a, b, c, d]) => x > a - 0.3 && x < b + 0.3 && z > c - 0.3 && z < d + 0.3);
      for (let x = sx0 + 0.5; x < sx1 - 0.5; x += C)
        for (let z = sz0 + 0.5; z < sz1 - 0.5; z += C) {
          if (x > cx0 - 0.3 && x < cx1 + 0.3 && z > cz0 - 0.3 && z < cz1 + 0.3) continue;
          if (inShaft(x, z) || inHole(x, z)) continue;
          const [wx, wz] = [x + BR_X, z + BR_Z];
          const here = solidsIn(wx, wx, wz, wz).filter((b) => b.minX <= wx && b.maxX >= wx && b.minZ <= wz && b.maxZ >= wz);
          if (![floorAt(wx, wz), ...here.map((b) => b.top)].some((t) => Math.abs(t - h) < 0.1) || here.some((b) => b.base < h + MOVE.standHeight && b.top > h + MOVE.stepHeight)) continue;
          stood++;
          if (!here.some((b) => b.base > h + MOVE.standHeight && b.base < ceiling + 0.3)) bare++;
        }
      return { h, stood: stood * C * C, bare: bare * C * C };
    });
    check("the tower: a ceiling over every floor from its new floors up, the sky floors' top one under its lid and each level under its own", !!LID && open.length === TW.shaft.length + SKY.length + LVL.length && open.every((q) => q.stood > 100 && q.bare <= 2), open.map((q) => `${q.h} m ${q.bare.toFixed(0)} of ${q.stood.toFixed(0)} m2 open`).join("; "));
  }
  // nothing drawn face up over another material in the same plane over the base and the tower (the bake's measure,
  // tools/neon-tower.ts coplanar): two such fight for the same pixels, a sawtooth of the two by turns as the view moves
  const CP = (TW as unknown as { coplanar: { most: number }; measured?: { coplanar?: Array<{ y: number; m2: number; at: number[] }> } });
  const fights = CP.measured?.coplanar;
  const fought = (fights ?? []).reduce((a, q) => a + q.m2, 0);
  check("the base and the tower: no floor drawn over another in the same plane", fights !== undefined && fought <= CP.coplanar.most, fights === undefined ? "not measured: bake the map" : fights.length ? `${fought.toFixed(1)} m2: ${fights.slice(0, 6).map((q) => `${q.m2} m2 at ${q.y} m (${q.at.join(", ")})`).join("; ")}` : "none");
}

// The glass lifts (rules.lifts): each by a player's own movement, from the Sky Ring across its footbridge into its glass
// car; in the car, interact facing the rope, ridden up and put off at its top onto the landing at the bridges' height;
// from the landing down its stair onto the island's roof; and from the landing, interact facing the rope, ridden down
// into the car again
{
  const LF = (cfg as unknown as { lifts?: Array<{ id: string; rope: number[][]; floor: number; ring: number[]; car: number[]; out: number[]; land: number[]; foot: number[] }> }).lifts ?? [];
  const BRG = (cfg.rules as unknown as { bridges: { deck: number; roof: number } }).bridges;
  const facing = (d: number[]) => (Math.atan2(-d[0], -d[1]) * 180) / Math.PI;
  /** a player stood at (x, z) on a floor at y facing `yaw`: walking forward `walk` metres and stopping, or with `zip`
   * interact pressed once settled and left to ride and land; where it comes to rest, and whether it rode */
  const go = (x: number, z: number, y: number, yaw: number, o: { walk?: number; zip?: boolean; pitch?: number }) => {
    const p = new Player({ minX: BR_X - 400, maxX: BR_X + 400, minZ: BR_Z - 400, maxZ: BR_Z + 400 });
    p.teleport(x + BR_X, y + 0.05, z + BR_Z, yaw);
    p.pitch = o.pitch ?? 0;
    let [t, tap, rode, walking] = [1000, false, false, !!o.walk];
    const input = { held: (a: Action) => walking && a === "forward", pressedNow: (a: Action) => tap && a === "interact" };
    const step = () => p.update(1 / 144, (t += 1 / 144), input, 0, 1, false);
    if (o.walk) {
      for (let i = 0; i < 144 * 8 && Math.hypot(p.pos.x - BR_X - x, p.pos.z - BR_Z - z) < o.walk; i++) step();
      // (a run is quick: off a landing's end it is in the air at the stair's foot, so it stops and comes to rest)
      walking = false;
      for (let i = 0; i < 144; i++) step();
    } else {
      for (let i = 0; i < 36; i++) step();
      tap = true;
      step();
      tap = false;
      rode = p.stance === "zip";
      // (the ride, then the fall off its end, and a moment to stand)
      for (let i = 0; i < 144 * 6 && p.stance === "zip"; i++) step();
      for (let i = 0; i < 144 * 2; i++) step();
    }
    return { rode, x: p.pos.x - BR_X, y: p.pos.y, z: p.pos.z - BR_Z };
  };
  const SRK = cfg.rules.skyring as { deck: number };
  const across = LF.map((q) => {
    const [w, r] = [q.out, q.ring];
    const from = [r[0] - w[0] * 1.5, r[1] - w[1] * 1.5];
    const want = Math.hypot(q.car[0] - from[0], q.car[1] - from[1]) - 0.8;
    const e = go(from[0], from[1], SRK.deck, facing(w), { walk: want });
    return { q, ok: Math.abs(e.y - q.floor) < 0.15 && Math.hypot(e.x - q.car[0], e.z - q.car[1]) < 1.2, e };
  });
  check("the glass lifts: each walked into from the Sky Ring across its footbridge", LF.length === 4 && across.every((a) => a.ok), across.map((a) => `${a.q.id} ${a.ok ? "in" : `stopped at (${a.e.x.toFixed(1)}, ${a.e.y.toFixed(2)}, ${a.e.z.toFixed(1)})`}`).join("; "));
  const ups = LF.map((q) => {
    const w = q.out;
    const e = go(q.car[0] - w[0] * 0.6, q.car[1] - w[1] * 0.6, q.floor, facing(w), { zip: true });
    // (put off onto the landing, past the rope along the way out)
    const past = (e.x - q.car[0]) * w[0] + (e.z - q.car[1]) * w[1];
    return { q, ok: e.rode && Math.abs(e.y - BRG.deck) < 0.15 && past > 0.5, e, past };
  });
  check("the glass lifts: each ridden up from its car and put off onto its landing", LF.length === 4 && ups.every((a) => a.ok), ups.map((a) => `${a.q.id} ${a.e.rode ? "rode" : "did not grab"}, off at ${a.e.y.toFixed(2)} m ${a.past.toFixed(1)} m past the rope`).join("; "));
  const downs = LF.map((q) => {
    const w = q.out;
    // (a metre on past the stair's foot, so it is not left standing on the stair's last step)
    const toFoot = go(q.land[0], q.land[1], BRG.deck, facing(w), { walk: Math.hypot(q.foot[0] - q.land[0], q.foot[1] - q.land[1]) + 1 });
    const back = go(q.land[0], q.land[1], BRG.deck, facing([-w[0], -w[1]]), { zip: true });
    // (down at the roof's level, off the landing 0.9 m over it: the roof itself has plates a step high on it)
    return { q, roof: Math.abs(toFoot.y - BRG.roof) < 0.3, toFoot, ok: back.rode && Math.abs(back.y - q.floor) < 0.15 && Math.hypot(back.x - q.car[0], back.z - q.car[1]) < 1.3, back };
  });
  check("the glass lifts: each landing walked off down its stair onto the island's roof", LF.length === 4 && downs.every((a) => a.roof), downs.map((a) => `${a.q.id} at ${a.toFoot.y.toFixed(2)} m`).join("; "));
  // (and walked back up onto it from the stair's foot: the landing's deck stood half a metre past its end over the
  // stair's top tread, as every bridge's did, until Milestone 595)
  const upStairs = LF.map((q) => {
    const w = q.out;
    const e = go(q.foot[0], q.foot[1], BRG.roof, facing([-w[0], -w[1]]), { walk: Math.hypot(q.foot[0] - q.land[0], q.foot[1] - q.land[1]) });
    return { q, ok: Math.abs(e.y - BRG.deck) < 0.15, e };
  });
  check("the glass lifts: each landing walked back up onto from its stair's foot", LF.length === 4 && upStairs.every((a) => a.ok), upStairs.map((a) => `${a.q.id} at ${a.e.y.toFixed(2)} m`).join("; "));
  check("the glass lifts: each ridden down from its landing into its car", LF.length === 4 && downs.every((a) => a.ok), downs.map((a) => `${a.q.id} ${a.back.rode ? "rode" : "did not grab"}, off at ${a.back.y.toFixed(2)} m, ${Math.hypot(a.back.x - a.q.car[0], a.back.z - a.q.car[1]).toFixed(1)} m from the rope`).join("; "));
}

// The Well (rules.well): its rope, by a player's own movement, ridden up from the bottom of the well and put off over
// the ground ring's railing onto the street, and from the street, pressed against that railing and looking down, ridden
// down to the bottom (a way out of the well, and a way in)
{
  const WL = (cfg as unknown as { well?: { ropes: Array<{ rope: number[][]; floor: number; onto: number; out: number[] }> } }).well;
  const ride = (sx: number, sz: number, y: number, d: number[], pitch: number) => {
    const p = new Player({ minX: BR_X - 400, maxX: BR_X + 400, minZ: BR_Z - 400, maxZ: BR_Z + 400 });
    p.teleport(sx + BR_X, y + 0.05, sz + BR_Z, (Math.atan2(-d[0], -d[1]) * 180) / Math.PI);
    p.pitch = pitch;
    let [t, tap] = [1000, false];
    const input = { held: (_a: Action) => false, pressedNow: (a: Action) => tap && a === "interact" };
    const step = () => p.update(1 / 144, (t += 1 / 144), input, 0, 1, false);
    for (let i = 0; i < 36; i++) step();
    tap = true;
    step();
    tap = false;
    const rode = p.stance === "zip";
    for (let i = 0; i < 144 * 6 && p.stance === "zip"; i++) step();
    for (let i = 0; i < 144 * 2; i++) step();
    return { rode, x: p.pos.x - BR_X, y: p.pos.y, z: p.pos.z - BR_Z };
  };
  for (const q of WL?.ropes ?? []) {
    const [[x, , z], top] = q.rope;
    const w = q.out;
    const up = ride(x - w[0] * 0.6, z - w[1] * 0.6, q.floor, w, 0);
    const off = (up.x - x) * w[0] + (up.z - z) * w[1];
    check("the Well: its rope ridden up from the bottom and put off over the railing onto the street", up.rode && Math.abs(up.y - q.onto) < 0.5 && off > 1, `${up.rode ? "rode" : "did not grab"}, off at ${up.y.toFixed(2)} m, ${off.toFixed(1)} m out from the rope`);
    // (as near as a body stands to the rope from the street: against the railing, 0.41 m round)
    const down = ride(x + w[0] * 2.35, z + w[1] * 2.35, q.onto + 0.45, [-w[0], -w[1]], -45);
    check("the Well: its rope ridden down from the street to the bottom", down.rode && Math.abs(down.y - q.floor) < 0.15 && Math.hypot(down.x - x, down.z - z) < 1, `${down.rode ? "rode" : "did not grab"}, off at ${down.y.toFixed(2)} m, ${Math.hypot(down.x - x, down.z - z).toFixed(1)} m from the rope (rope to ${top[1]} m)`);
  }
  check("the Well: a rope up it", (WL?.ropes ?? []).length > 0, `${(WL?.ropes ?? []).length}`);
  // its stairs (rules.well.flights): each walked down by a player from a metre short of its top to a metre past its foot,
  // and back up
  const FL = (WL as unknown as { flights?: Array<{ high: number; low: number; route: number[][] }> } | undefined)?.flights ?? [];
  const walked = FL.map((q) => ({ q, down: along(q.route), up: along([...q.route].reverse()) }));
  const ok = (w: (typeof walked)[number]) => w.down.k === w.q.route.length && Math.abs(w.down.y - w.q.low) < 0.2 && w.up.k === w.q.route.length && Math.abs(w.up.y - w.q.high) < 0.2;
  // its corridor (rules.well.corridor): from inside the station's concourse out through its gated end, east, round the
  // corner and south, in through the lowest gallery's shop door onto its walkway; and back
  const CR = (WL as unknown as { corridor?: number[][]; bottom: number } | undefined)?.corridor ?? [];
  if (CR.length) {
    const [east, south] = CR;
    const yb = (WL as unknown as { bottom: number }).bottom;
    const [zc, xc] = [(east[2] + east[3]) / 2, (south[0] + south[1]) / 2];
    const route = [[east[0] - 3, zc, yb], [east[0] + 1, zc, yb], [xc, zc, yb], [xc, south[3] - 1, yb], [xc, south[3] + 1.5, yb]];
    const [there, back] = [along(route), along([...route].reverse())];
    check("the Well: its corridor walked from the station's concourse to its lowest gallery and back, by a player", there.k === route.length && back.k === route.length, `there ${there.k - 1} of ${route.length - 1} legs, stopped at (${there.x.toFixed(1)}, ${there.y.toFixed(2)}, ${there.z.toFixed(1)}); back ${back.k - 1}, stopped at (${back.x.toFixed(1)}, ${back.y.toFixed(2)}, ${back.z.toFixed(1)})`);
  }
  // sealed: the bake's fan of level rays from every metre of each gallery's floor at eye height, each meeting a drawn face
  // (tools/import-neon.ts; the collision cannot see a gap a low wall's cells fill)
  const SL = (WL as unknown as { measured?: { seal: Array<{ at: number; points: number; rays: number; out: number; where: number[][] }> } } | undefined)?.measured?.seal ?? [];
  check("the Well sealed: from every metre of its galleries a look at eye height meets a wall", SL.length >= 3 && SL.every((q) => q.points > 40 && q.out === 0), SL.map((q) => `${q.at} m ${q.out} of ${q.rays} out${q.out ? ` (${q.where.slice(0, 3).map((w) => `${w[0].toFixed(1)}, ${w[1].toFixed(1)} toward ${w[2]}`).join("; ")})` : ""}`).join("; "));
  check("the Well: each of its stairs walked down from the floor above to the gallery below and back up, by a player", FL.length >= 3 && walked.every(ok), walked.map((w) => `${w.q.high} to ${w.q.low} m: down ${w.down.k - 1} of ${w.q.route.length - 1} legs to ${w.down.y.toFixed(2)} m, up to ${w.up.y.toFixed(2)} m`).join("; "));
}

// The rooms to fight in (rules.low.rooms): each corner block's realistic building walked into from the street round it
// and up its stairs, on foot, no climbing, an eighth of a metre at a time (at the collision's own quarter a body a door's
// width round was seen not to fit it, sampled only there): every floor with a standing body's room over it is
// a spot, and from a spot a body walks to a neighbour's floor within a step. The body is taken as the square round the
// player's round one, so what it passes a player passes. Its ground floor and the two over it by the stairs (the roof
// over those is a climb)
{
  // (each corner block's rooms building where the layout put it: neonmap.json rooms, its footprint)
  const R4 = (cfg as unknown as { rooms: number[][] }).rooms;
  const C = 0.125;
  const H = MOVE.radius;
  const chunks = cfg.chunks as Record<string, { place: unknown[][] }>;
  const isRooms = (p: unknown[]) => String(p[0]).endsWith(`/${cfg.rules.low.rooms.piece}`);
  // (but the Well's block, rules.well: the Well stands where its rooms building did)
  const wellBlock = (cfg.rules as unknown as { well?: { block: string } }).well?.block;
  const blockOf = (k: string) => `${k.endsWith("w") ? -1 : 1},${k[2] === "n" ? -1 : 1}`;
  const rooms = chunks["c-nw"].place.find(isRooms);
  check("the rooms building on each corner block but the Well's", Object.keys(chunks).filter((k) => /^c-[ns][ew]$/.test(k) && blockOf(k) !== wellBlock).every((k) => chunks[k].place.some(isRooms)), `${rooms?.[0]}`);
  // its fire escape (rules.low.fire, the layout's fires): climbed by a player's own movement from the street, a jump
  // onto its lowest flight (it hangs over the street as a real one's drop stair does), up every flight and its landing
  // and over the parapet onto the roof; and back down to the street. Points in the flight's own metres (its wall side
  // at x 0, its landing 2.6 m out and 5 m along -z, its stair's foot near z -1 under the landing's +z end and its top
  // near z -4, measured off it: the way onto a flight is from beyond that end, along its own -z)
  const FI = (cfg as unknown as { fires?: Array<{ block: string; at: number[]; yaw: number; roof: number; rise: number; flights: number }> }).fires ?? [];
  const climb = (pts: number[][], jumpLeg: number): { k: number; x: number; z: number; y: number } => {
    const p = new Player({ minX: BR_X - 400, maxX: BR_X + 400, minZ: BR_Z - 400, maxZ: BR_Z + 400 });
    p.sprintMode = "auto";
    p.teleport(pts[0][0] + BR_X, pts[0][2] + 0.05, pts[0][1] + BR_Z, 0);
    let t = 1000, k = 1, jumped = false;
    for (let i = 0; i < 40 * 144 && k < pts.length; i++) {
      const [tx, tz, ty] = pts[k];
      const dx = tx - (p.pos.x - BR_X), dz = tz - (p.pos.z - BR_Z);
      if (Math.hypot(dx, dz) < (pts[k][3] ?? 0.35) && Math.abs(p.pos.y - ty) < 1) {
        k++;
        continue;
      }
      const jump = k === jumpLeg && !jumped && Math.hypot(dx, dz) < 1.4;
      if (jump) jumped = true;
      p.yaw = (Math.atan2(-dx, -dz) * 180) / Math.PI;
      p.update(1 / 144, (t += 1 / 144), { held: (a: Action) => a === "forward", pressedNow: (a: Action) => jump && a === "jump" }, 0, 1, false);
    }
    // (and on its feet where it ends: the last leg is reached in the drop from the lowest flight's foot)
    for (let i = 0; i < 144; i++) p.update(1 / 144, (t += 1 / 144), idle, 0, 1, false);
    return { k, x: p.pos.x - BR_X, z: p.pos.z - BR_Z, y: p.pos.y };
  };
  // (and High City's, rules.high.fire: up the south and east islands' outer faces from the street to the deck, its lowest
  // stair's foot on the pavement, so walked onto from 1.2 m past its +z end, where the lobe beside it leaves room; and
  // off onto the deck from its top landing's middle, its far end meeting the lobe's 0.85 m lip)
  const HFI = (cfg as unknown as { highFires?: Array<{ block: string; at: number[]; yaw: number; roof: number; rise: number; flights: number }> }).highFires ?? [];
  for (const [f, high] of [...FI.map((q) => [q, false] as const), ...HFI.map((q) => [q, true] as const)]) {
    const on = (x: number, z: number, y: number) => {
      const a = (f.yaw * Math.PI) / 180;
      return [f.at[0] + Math.cos(a) * x + Math.sin(a) * z, f.at[1] - Math.sin(a) * x + Math.cos(a) * z, y];
    };
    const up: number[][] = [on(1.75, high ? 1.2 : 2.5, 0), on(1.75, -1.6, f.roof - f.flights * f.rise + 0.6)];
    for (let n = f.flights - 1; n >= 0; n--) {
      const y = f.roof - n * f.rise;
      up.push(on(1.75, -4.2, y), on(0.5, -4.2, y));
      if (n) up.push(on(0.5, -0.5, y), [...on(1.75, -0.7, y), 0.1]);
    }
    up.push(...(high ? [on(0.5, -2.5, f.roof), on(-1.5, -2.5, f.roof)] : [on(-1.5, -4.2, f.roof)]));
    const u = climb(up, 1);
    // (the way down at the walking tolerance: lining up on a flight's middle is for the way up)
    const d = climb([...up].reverse().map((q) => q.slice(0, 3)), -1);
    const what = high ? `the fire escape up High City's ${f.block} block: climbed from the street onto its deck and back down, by a player` : `the fire escape on the ${f.block} block's rooms building: climbed from the street onto its roof and back down, by a player`;
    check(what, u.k === up.length && d.k === up.length && Math.abs(u.y - f.roof) < 0.1 && d.y < 0.1, `up ${u.k - 1} of ${up.length - 1} legs, at ${u.y.toFixed(2)} m (${u.x.toFixed(1)}, ${u.z.toFixed(1)}); down ${d.k - 1}, at ${d.y.toFixed(2)} m`);
  }
  check("a fire escape up each round-lobed High City block, the south and the east", HFI.length === 2 && ["s", "e"].every((b) => HFI.some((f) => f.block === b)), HFI.map((f) => `${f.block} ${f.flights} flights`).join("; "));
  // the corner blocks' roof bridges (rules.low.roofs, the layout's roofBridges): each walked by a player from the rooms
  // building's roof over its footbridge, down its step onto the roof beside it, and back up, a jump at each leg more
  // than a step higher (onto the step, onto the deck, over the parapet)
  const RBS = (cfg as unknown as { roofBridges?: Array<{ block: string; a: number[]; b: number[]; deck: number; step: number[] | null }> }).roofBridges ?? [];
  const walkLegs = (pts: number[][]): { k: number; x: number; y: number; z: number } => {
    const p = new Player({ minX: BR_X - 400, maxX: BR_X + 400, minZ: BR_Z - 400, maxZ: BR_Z + 400 });
    p.sprintMode = "auto";
    p.teleport(pts[0][0] + BR_X, pts[0][1] + 0.05, pts[0][2] + BR_Z, 0);
    let t = 2000, k = 1, jumped = -1, endY = NaN;
    for (let i = 0; i < 40 * 144 && k < pts.length; i++) {
      const [tx, ty, tz] = pts[k];
      const dx = tx - (p.pos.x - BR_X), dz = tz - (p.pos.z - BR_Z);
      if (Math.hypot(dx, dz) < 0.35 && Math.abs(p.pos.y - ty) < 1) {
        // (its height on reaching the last, once it lands: run on idle after it, a sprint carried it 2.5 m onto a roof's
        // crate, and reached in the drop off a step it was still in the air)
        if (++k === pts.length) {
          for (let n = 0; n < 144 && !p.onGround; n++) p.update(1 / 144, (t += 1 / 144), idle, 0, 1, false);
          endY = p.pos.y;
        }
        continue;
      }
      const jump = jumped !== k && ty > p.pos.y + 0.4 && Math.hypot(dx, dz) < 1.6;
      if (jump) jumped = k;
      p.yaw = (Math.atan2(-dx, -dz) * 180) / Math.PI;
      p.update(1 / 144, (t += 1 / 144), { held: (a: Action) => a === "forward", pressedNow: (a: Action) => jump && a === "jump" }, 0, 1, false);
    }
    return { k, x: p.pos.x - BR_X, y: endY, z: p.pos.z - BR_Z };
  };
  for (const q of RBS) {
    const L = Math.hypot(q.b[0] - q.a[0], q.b[2] - q.a[2]);
    const u = [(q.b[0] - q.a[0]) / L, (q.b[2] - q.a[2]) / L];
    // (on its deck a metre and a half in from each end: its ends are 1.5 m past the roofs' edges)
    const deckAt = (d: number) => [q.a[0] + u[0] * d, q.deck, q.a[2] + u[1] * d];
    const across = [q.a, deckAt(2.2), deckAt(L - (q.step ? 3.2 : 2.2)), ...(q.step ? [q.step] : []), q.b];
    const there = walkLegs(across);
    const back = walkLegs([...across].reverse());
    check(`the ${q.block} block's roof bridge: walked over by a player from its rooms building's roof onto the roof beside it and back`, there.k === across.length && back.k === across.length && Math.abs(there.y - q.b[1]) < 0.2 && Math.abs(back.y - q.a[1]) < 0.2, `there ${there.k - 1} of ${across.length - 1} legs, at ${there.y.toFixed(2)} m (${there.x.toFixed(1)}, ${there.z.toFixed(1)}); back ${back.k - 1}, at ${back.y.toFixed(2)} m (${back.x.toFixed(1)}, ${back.z.toFixed(1)})`);
  }
  check("a roof bridge on MOTEL HILL and on MARKET", RBS.length === 2 && ["-1,-1", "-1,1"].every((b) => RBS.some((q) => q.block === b)), RBS.map((q) => q.block).join("; "));
  // (THE WORKS' outside stairs, Milestone 829, are on `fires` to be climbed, but are on no rooms building)
  const FIr = FI.filter((q) => !String((q as { block?: string }).block ?? "").startsWith("THE WORKS"));
  check("a fire escape on each rooms building", FIr.length === Object.keys(chunks).filter((k) => /^c-[ns][ew]$/.test(k) && blockOf(k) !== wellBlock).length, `${FIr.length}`);
  // and its walled yard (rules.low.yard, the layout's yards): on each rooms building's roof, its inside reached from
  // where the fire escape steps over the parapet, a body's square a quarter metre at a time over the collision at the
  // roof's height (a floor there under its middle, nothing over a step in its room)
  const YD = (cfg as unknown as { yards?: Array<{ block: string; inside: number[]; y: number }> }).yards ?? [];
  check("a walled yard on each rooms building's roof", YD.length === FIr.length && YD.length > 0, `${YD.length}`);
  for (const yd of YD) {
    const f = FI.find((q) => q.block === yd.block);
    const rect = R4.find((r) => `${Math.sign(r[0] + r[1])},${Math.sign(r[2] + r[3])}` === yd.block);
    if (!f || !rect) {
      check(`the ${yd.block} block's roof yard: reached from its fire escape`, false, "no fire escape or rooms building");
      continue;
    }
    const a = (f.yaw * Math.PI) / 180;
    const from = [f.at[0] + Math.cos(a) * -1.5 + Math.sin(a) * -4.2, f.at[1] - Math.sin(a) * -1.5 + Math.cos(a) * -4.2];
    const [G, r, y] = [0.25, MOVE.radius, yd.y];
    const stands = (x: number, z: number): boolean => {
      const [wx, wz] = [x + BR_X, z + BR_Z];
      const near = solidsIn(wx - r, wx + r, wz - r, wz + r).filter((s) => s.maxX > wx - r && s.minX < wx + r && s.maxZ > wz - r && s.minZ < wz + r);
      return near.some((s) => wx >= s.minX && wx <= s.maxX && wz >= s.minZ && wz <= s.maxZ && Math.abs(s.top - y) < 0.06) && !near.some((s) => s.top > y + MOVE.stepHeight && s.base < y + MOVE.standHeight);
    };
    const [i0, j0] = [Math.round(from[0] / G), Math.round(from[1] / G)];
    const seen = new Set<string>([`${i0},${j0}`]);
    const todo = stands(i0 * G, j0 * G) ? [[i0, j0]] : [];
    let into = false;
    while (todo.length && !into) {
      const [i, j] = todo.pop()!;
      const [x, z] = [i * G, j * G];
      if (x > yd.inside[0] && x < yd.inside[1] && z > yd.inside[2] && z < yd.inside[3]) into = true;
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const [ni, nj] = [i + di, j + dj];
        const k = `${ni},${nj}`;
        if (seen.has(k) || ni * G < rect[0] - 3 || ni * G > rect[1] + 3 || nj * G < rect[2] - 3 || nj * G > rect[3] + 3) continue;
        seen.add(k);
        if (stands(ni * G, nj * G)) todo.push([ni, nj]);
      }
    }
    check(`the ${yd.block} block's roof yard: its inside reached on the roof from where its fire escape steps over the parapet`, into, `${seen.size} squares tried`);
  }
  for (const [sx, sz, name] of [[-1, -1, "nw"], [1, -1, "ne"], [-1, 1, "sw"], [1, 1, "se"]] as const) {
    if (`${sx},${sz}` === wellBlock) continue;
    const rect = R4.find((r) => Math.sign(r[0] + r[1]) === sx && Math.sign(r[2] + r[3]) === sz)!;
    const [mx, mz] = [(rect[0] + rect[1]) / 2, (rect[2] + rect[3]) / 2];
    // the building's 20 m and 6 m of street round it
    const [X0, Z0] = [mx - 16, mz - 16];
    const N = Math.round(32 / C);
    const spots: Array<{ i: number; j: number; y: number }> = [];
    const at = new Map<number, number[]>();
    for (let i = 0; i < N; i++)
      for (let j = 0; j < N; j++) {
        const x = X0 + (i + 0.5) * C + BR_X, z = Z0 + (j + 0.5) * C + BR_Z;
        const here = solidsIn(x - H, x + H, z - H, z + H).filter((s) => s.minX < x + H && s.maxX > x - H && s.minZ < z + H && s.maxZ > z - H);
        const ground = floorAt(x, z);
        const ys = new Set<number>([ground]);
        for (const s of here) if (s.minX <= x && s.maxX >= x && s.minZ <= z && s.maxZ >= z && s.top > ground) ys.add(s.top);
        const list = [...ys].filter((y) => !here.some((s) => s.base < y + MOVE.standHeight && s.top > y + MOVE.stepHeight));
        if (list.length) at.set(i * N + j, list.map((y) => (spots.push({ i, j, y }), spots.length - 1)));
      }
    const seen = new Uint8Array(spots.length);
    const todo: number[] = [];
    for (const [k, list] of at) {
      const i = Math.floor(k / N), j = k % N;
      if (i > 1 && i < N - 2 && j > 1 && j < N - 2) continue;
      for (const s of list) if (Math.abs(spots[s].y) < 0.05) ((seen[s] = 1), todo.push(s));
    }
    while (todo.length) {
      const a = spots[todo.pop()!];
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        if (a.i + di < 0 || a.i + di >= N) continue;
        for (const s of at.get((a.i + di) * N + a.j + dj) ?? []) if (!seen[s] && spots[s].y - a.y <= MOVE.stepHeight) ((seen[s] = 1), todo.push(s));
      }
    }
    // its floors by storey (the ground's, the first at about 3.5 m, the second at about 7), the share of each reached
    const storeys = [0, 0, 0].map(() => [0, 0]);
    spots.forEach((s, k) => {
      const x = X0 + (s.i + 0.5) * C, z = Z0 + (s.j + 0.5) * C;
      if (Math.abs(x - mx) > 10 || Math.abs(z - mz) > 10) return;
      const f = s.y < 2 ? 0 : s.y < 5 ? 1 : s.y < 8.5 ? 2 : -1;
      if (f < 0) return;
      storeys[f][0]++;
      if (seen[k]) storeys[f][1]++;
    });
    const share = storeys.map(([all, got]) => (all ? got / all : 0));
    check(`the ${name} rooms: walked into from the street and up its stairs, on foot, its ground floor and the two over it`, share.every((q) => q >= 0.95), share.map((q, f) => `${["ground", "first", "second"][f]} ${(q * 100).toFixed(0)}%`).join(", "));
  }
}

// Centre Station (rules.underground): closed, and reached. The owner found the new map's lower floor see-through: under
// the street there is nothing, and an arch or a doorway that opens onto nothing shows the sky and the city through the
// ground. From every metre of the platform and the concourse, at eye height, a look along the ground eight ways and one
// straight up meets the station's walls within 60 m, and from every metre of the ramp down from the court. And a
// player's own movement sprints down to it from the court and back up
{
  const S = cfg.rules.underground.station;
  const [sx, sy, sz] = [S.x, S.platform, S.back];
  // (the way down from the court is lowered to the station's floor under its ramp, where nobody stands: its looks are
  // from on the ramp, below)
  // (not the Well's, rules.well: it lies open to the sky by its light-well)
  const areas = cfg.underground.floors.filter((f) => Math.abs(f.y - sy) < 0.05 && !("ramp" in f) && !("well" in f)).map((f) => f.rect);
  // the platform itself: its back to its edge, along the modules
  areas.push([sx, sx + 10 * S.modules, sz, sz + 5]);
  const dirs = [...Array.from({ length: 8 }, (_, k) => [Math.cos((k * Math.PI) / 4), 0, Math.sin((k * Math.PI) / 4)]), [0, 1, 0]];
  /** how far along the ray from p the first box is, up to `far` */
  const hit = (p: number[], d: number[], far: number): number => {
    let best = far;
    const o = new THREE.Vector3(p[0], p[1], p[2]);
    for (const s of solidsIn(Math.min(p[0], p[0] + d[0] * far), Math.max(p[0], p[0] + d[0] * far), Math.min(p[2], p[2] + d[2] * far), Math.max(p[2], p[2] + d[2] * far))) {
      let t0 = 0, t1 = best;
      for (const [a, lo, hi] of [[0, s.minX, s.maxX], [1, s.base, s.top], [2, s.minZ, s.maxZ]] as const) {
        const [oa, da] = [a === 0 ? o.x : a === 1 ? o.y : o.z, d[a]];
        if (Math.abs(da) < 1e-9) { if (oa < lo || oa > hi) t0 = Infinity; continue; }
        let [u0, u1] = [(lo - oa) / da, (hi - oa) / da];
        if (u0 > u1) [u0, u1] = [u1, u0];
        t0 = Math.max(t0, u0); t1 = Math.min(t1, u1);
      }
      if (t0 <= t1) best = Math.min(best, t0);
    }
    return best;
  };
  const eye = sy + 1.6;
  // (how far a look goes before it must have met a wall: the station and the Well's corridor out of its concourse run
  // 80 m in a straight line, rules.well.corridor, and a look down them met the corridor's corner past 60)
  const far = 100;
  let spots = 0;
  const open: string[] = [];
  // on the ramp down from the court: from every metre of it, an eye's height over the ramp there
  for (const f of cfg.underground.floors.filter((q) => "ramp" in q)) {
    const [x0, x1, z0, z1] = f.rect;
    for (let x = x0 + 0.5; x < x1; x += 1)
      for (let z = z0 + 0.5; z < z1; z += 1) {
        const under = solidsIn(x + BR_X, x + BR_X, z + BR_Z, z + BR_Z).filter((b) => x + BR_X >= b.minX && x + BR_X <= b.maxX && z + BR_Z >= b.minZ && z + BR_Z <= b.maxZ && b.top <= cfg.court.y + 0.05);
        const p = [x + BR_X, Math.max(sy, ...under.map((b) => b.top)) + 1.6, z + BR_Z];
        spots++;
        for (const d of dirs) if (hit(p, d, far) >= far) open.push(`the ramp (${x.toFixed(1)}, ${z.toFixed(1)}) ${d[1] ? "up" : `toward ${d[0].toFixed(1)},${d[2].toFixed(1)}`}`);
      }
  }
  for (const [x0, x1, z0, z1] of areas)
    for (let x = x0 + 0.5; x < x1; x += 1)
      for (let z = z0 + 0.5; z < z1; z += 1) {
        const p = [x + BR_X, eye, z + BR_Z];
        // (not a spot inside a wall or a pillar: something standing across the eye's height there)
        if (solidsIn(p[0], p[0], p[2], p[2]).some((s) => p[0] >= s.minX && p[0] <= s.maxX && p[2] >= s.minZ && p[2] <= s.maxZ && s.base < eye && s.top > eye)) continue;
        spots++;
        for (const d of dirs) if (hit(p, d, far) >= far) open.push(`(${x.toFixed(1)}, ${z.toFixed(1)}) ${d[1] ? "up" : `toward ${d[0].toFixed(1)},${d[2].toFixed(1)}`}`);
      }
  check(`Centre Station closed: from every metre of its platform, its concourse and the ramp down from the court a look along the ground or up meets its walls within ${far} m`, spots > 300 && open.length === 0, `${spots} spots, ${open.length} looks out on nothing${open.length ? `: ${open.slice(0, 4).join("; ")}` : ""}`);

  // The way down from the court (rules.underground.link): a player's own movement sprints from the court's floor
  // through the door in its south wall, along the corridor, down the ramp and through the gate into the marble room,
  // on the station's floor; and back up the ramp into the court. (The first try at this join, the pack's stair room,
  // met a wall at its head and shut gate leaves at its foot.)
  const link = K.halls.find((q) => "open" in q);
  check("the court's way down to the station is laid", Boolean(link));
  if (link) {
    const mx = (link.x0 + link.x1) / 2;
    const hall = cfg.underground.floors.find((f) => !("ramp" in f) && Math.abs(f.y - sy) < 0.05 && mx > f.rect[0] && mx < f.rect[1])!.rect;
    const walk = (z: number, y: number, yaw: number, done: (pz: number) => boolean) => {
      const p = new Player({ minX: BR_X - 400, maxX: BR_X + 400, minZ: BR_Z - 400, maxZ: BR_Z + 400 });
      p.sprintMode = "auto";
      p.teleport(mx + BR_X, y, z + BR_Z, yaw);
      const run = { held: (a: Action) => a === "forward", pressedNow: (_a: Action) => false };
      let t = 1000;
      for (let i = 0; i < 12 * 144 && !done(p.pos.z - BR_Z); i++) p.update(1 / 144, (t += 1 / 144), run, 0, 1, false);
      return { x: p.pos.x - BR_X, z: p.pos.z - BR_Z, y: p.pos.y };
    };
    // (to the marble room's middle, and to a metre inside the court: the tower's basement wall stands 2.5 m in there)
    const down = walk(K.z1 - 1, K.y + 0.05, 180, (z) => z >= (hall[2] + hall[3]) / 2);
    const up = walk((hall[2] + hall[3]) / 2, sy + 0.05, 0, (z) => z <= K.z1 - 1);
    check("the court's way down to the station: a player sprints from the court down the ramp into the marble room, and back up into the court", down.z >= (hall[2] + hall[3]) / 2 && Math.abs(down.y - sy) < 0.05 && up.z <= K.z1 - 1 && Math.abs(up.y - K.y) < 0.05, `down to (${down.x.toFixed(1)}, ${down.z.toFixed(1)}) at ${down.y.toFixed(2)} m; up to (${up.x.toFixed(1)}, ${up.z.toFixed(1)}) at ${up.y.toFixed(2)} m`);
  }
}

// High City's bridges (rules.bridges): each walked from one island's deck to the next and back, on foot, and railed.
// The islands are fenced all round and a bridge crosses the fence in its own deck's body, stepping down to the roof
// inside by a stair: with its stair missing or short of it a deck's end is a wall 0.9 m high, a deck stopped short of
// the fence is fenced off from its island, and a landing on a lobe with no way off it goes nowhere. A body a square round the
// player's round one is flooded an eighth of a metre at a time from the foot of the stair at one end: up a step at a
// time, down as far as a deck stands over its roof. It reaches the named deck of the island it starts on, the foot of
// the stair at the far end and that island's named deck. (A fence's top is no floor: it stands 4 cm under a deck
// beside the deck's end, and a body let stand on it walked the fences round to anywhere.) And from every metre of a
// deck's middle a look to either side at the waist meets a rail, the corner's two outer sides among them: a corner
// turned wrong is open over the street. Each stair is also climbed on its own, straight up its middle from the roof
// onto the deck: the deck's skirt stands half a metre proud of its sides half a metre under it, and with no stair at
// all the flood still got up two of the eight ends by it, round the outside of the rail
{
  const B = cfg.rules.bridges as { roof: number; fence: number; deck: number; paths: number[][][] };
  // (the ring's gaps, rules.bridges.gaps, Milestone 1082: a point's distance along a path from its first end and how far off
  // its line, and the point that far along it)
  const GAPS1082 = ((cfg.rules.bridges as unknown as { gaps?: Array<{ at: number[]; pads: string[] }> }).gaps ?? []);
  const onLine1082 = (path: number[][], p: number[]) => {
    let [s, best] = [0, { s: 0, off: Infinity }];
    for (let k = 1; k < path.length; k++) {
      const [a, b] = [path[k - 1], path[k]];
      const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const t = Math.max(0, Math.min(L, ((p[0] - a[0]) * (b[0] - a[0]) + (p[1] - a[1]) * (b[1] - a[1])) / L));
      const off = Math.hypot(a[0] + ((b[0] - a[0]) * t) / L - p[0], a[1] + ((b[1] - a[1]) * t) / L - p[1]);
      if (off < best.off) best = { s: s + t, off };
      s += L;
    }
    return best;
  };
  const pointAt1082 = (path: number[][], s: number) => {
    for (let k = 1; k < path.length; k++) {
      const [a, b] = [path[k - 1], path[k]];
      const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (s <= L || k === path.length - 1) return [a[0] + ((b[0] - a[0]) * s) / L, a[1] + ((b[1] - a[1]) * s) / L];
      s -= L;
    }
    return path[0];
  };
  const C = 0.125;
  const H = MOVE.radius;
  const drop = B.deck - B.roof + 0.1;
  const decks = map.sites.filter((q) => q.id.endsWith("-deck")).map((q) => [q.x - BR_X, q.z - BR_Z]);
  const nearest = (p: number[]) => decks.reduce((best, q) => (Math.hypot(q[0] - p[0], q[1] - p[1]) < Math.hypot(best[0] - p[0], best[1] - p[1]) ? q : best));
  for (const path of B.paths) {
    const past = (p: number[], q: number[], by: number) => { const l = Math.hypot(p[0] - q[0], p[1] - q[1]); return [p[0] + ((p[0] - q[0]) / l) * by, p[1] + ((p[1] - q[1]) / l) * by]; };
    // the foot of each end's stair: a metre and a half past the deck's end and the stair's setback there (cfg.bridgeStairs,
    // the layout's), on the roof
    const backAt = (e: number[]) => ((cfg as unknown as { bridgeStairs?: Array<{ at: number[]; back: number }> }).bridgeStairs ?? []).find((q) => q.at[0] === e[0] && q.at[1] === e[1])?.back ?? 0;
    const feet = [past(path[0], path[1], 1.5 + backAt(path[0])), past(path.at(-1)!, path.at(-2)!, 1.5 + backAt(path.at(-1)!))];
    // (an end that runs into a building, rules.bridges.into, the gangway's into the tower: its goal the foot of its stair
    // on the floor inside, there being no island's deck at that end)
    const into = (e: number[]) => ((cfg.rules.bridges as unknown as { into?: number[][] }).into ?? []).some((q) => q[0] === e[0] && q[1] === e[1]);
    // (and an end on a deck with no site of the bots', GLASS HEIGHTS' slabs past the ring road (Milestone 594): its goal
    // the roof two and a half metres on past its stair's foot, inside its fence)
    const sites = [path[0], path.at(-1)!].map((e, w) => {
      if (into(e)) return feet[w];
      const site = nearest(e);
      return Math.hypot(site[0] - e[0], site[1] - e[1]) < 40 ? site : past(feet[w], w ? path.at(-1)! : path[0], 2.5);
    });
    const pts = [sites[0], feet[0], ...path, feet[1], sites[1]];
    const M = 8;
    const [X0, X1, Z0, Z1] = [Math.min(...pts.map((p) => p[0])) - M, Math.max(...pts.map((p) => p[0])) + M, Math.min(...pts.map((p) => p[1])) - M, Math.max(...pts.map((p) => p[1])) + M];
    const near = (x: number, z: number) => pts.slice(0, -1).some((p, k) => {
      const q = pts[k + 1];
      return x >= Math.min(p[0], q[0]) - M && x <= Math.max(p[0], q[0]) + M && z >= Math.min(p[1], q[1]) - M && z <= Math.max(p[1], q[1]) + M;
    });
    const [NI, NJ] = [Math.round((X1 - X0) / C), Math.round((Z1 - Z0) / C)];
    const boxes = (i: number, j: number) => {
      const x = X0 + (i + 0.5) * C + BR_X, z = Z0 + (j + 0.5) * C + BR_Z;
      return solidsIn(x - H, x + H, z - H, z + H).filter((s) => s.minX < x + H && s.maxX > x - H && s.minZ < z + H && s.maxZ > z - H);
    };
    /** the floor a body at y finds at a spot: the highest top under its square within a step up; null, blocked there */
    const floorFor = (i: number, j: number, y: number): number | null => {
      const here = boxes(i, j);
      let f = -Infinity;
      for (const s of here) if (s.top <= y + MOVE.stepHeight && s.top > f && Math.abs(s.top - B.fence) > 0.02) f = s.top;
      const at = Math.max(f, y - drop);
      return here.some((s) => s.base < at + MOVE.standHeight && s.top > at + MOVE.stepHeight) ? null : f;
    };
    const cell = (p: number[]) => [Math.floor((p[0] - X0) / C), Math.floor((p[1] - Z0) / C)];
    const name = `(${path[0].join(", ")}) to (${path.at(-1)!.join(", ")})`;
    for (const way of [0, 1]) {
      const seen = new Map<number, number>();
      const [si, sj] = cell(feet[way]);
      const start = floorFor(si, sj, B.roof);
      const todo: number[] = [];
      // (on the roof: a body at the foot may touch the stair's first tread, 0.1 m up, or a lifted stair's, 0.3)
      if (start !== null && start > B.roof - 0.1 && start < B.roof + 0.35) (seen.set(si * NJ + sj, start), todo.push(si * NJ + sj));
      while (todo.length) {
        const k = todo.pop()!;
        const [i, j, y] = [Math.floor(k / NJ), k % NJ, seen.get(k)!];
        for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const [a, b] = [i + di, j + dj];
          if (a < 0 || b < 0 || a >= NI || b >= NJ) continue;
          const was = seen.get(a * NJ + b);
          if (!near(X0 + (a + 0.5) * C, Z0 + (b + 0.5) * C)) continue;
          const f = floorFor(a, b, y);
          if (f === null || f < y - drop) continue;
          // (a spot reached lower down is reached again from higher: from a deck the way on is along the deck)
          if (was !== undefined && was >= f) continue;
          seen.set(a * NJ + b, f);
          todo.push(a * NJ + b);
        }
      }
      const reached = (p: number[], within: number) => { for (const k of seen.keys()) if (Math.hypot(X0 + (Math.floor(k / NJ) + 0.5) * C - p[0], Z0 + ((k % NJ) + 0.5) * C - p[1]) <= within) return true; return false; };
      const high = [...seen.values()].filter((y) => Math.abs(y - B.deck) < 0.1).length;
      // (a path the ring is cut on, rules.bridges.gaps, Milestone 1082: walked from each end to the gap's lip and its pad and no
      // further, and the far side's pad's mark on this side joined on foot to this end's island; the throws are the gaps' own check)
      const gap = GAPS1082.find((g) => onLine1082(path, g.at).off < 0.01);
      if (gap) {
        const sg = onLine1082(path, gap.at).s;
        const side = (p: number[]) => (onLine1082(path, p).s < sg ? 0 : 1);
        const lip = pointAt1082(path, way ? sg + 3.25 : sg - 3.25);
        const mine = SPINE.across.filter((q) => gap.pads.includes(q.id));
        const padsG = mine.filter((q) => side(q.pad) === way).map((q) => q.pad);
        const landsG = mine.filter((q) => side(q.land) === way).map((q) => q.land);
        const gotG = [reached(sites[way], 4), reached(lip, 0.75), !reached(feet[1 - way], 0.5), padsG.length === 1 && padsG.every((q) => reached(q, 0.5)), landsG.length === 1 && landsG.every((q) => reached(q, 0.5))];
        check(`High City's bridge ${name}, ${way ? "back" : "there"}: cut at (${gap.at.join(", ")}), walked on foot from its island's deck up its stair to the gap's lip and its pad and no further, the far pad's mark on this side joined to its island`, gotG.every(Boolean) && high > 1000, `${seen.size} spots, ${high} on the bridge; its own deck ${gotG[0] ? "reached" : "NOT reached"}, the lip ${gotG[1] ? "reached" : "NOT reached"}, the far stair's foot ${gotG[2] ? "not reached" : "REACHED on foot"}, its pad ${gotG[3] ? "reached" : "NOT reached"}, the far pad's mark ${gotG[4] ? "reached" : "NOT reached"}`);
        continue;
      }
      const got = [reached(sites[way], 4), reached(feet[1 - way], 0.5), reached(sites[1 - way], 4)];
      check(`High City's bridge ${name}, ${way ? "back" : "there"}: walked on foot from its island's deck up its stair, across, down and onto the next island's deck`, got.every(Boolean) && high > 1000, `${seen.size} spots, ${high} on the bridge; its own deck ${got[0] ? "reached" : "NOT reached"}, the far stair's foot ${got[1] ? "reached" : "NOT reached"}, the far deck ${got[2] ? "reached" : "NOT reached"}`);
    }
    // its stairs: from each foot straight along the leg's line to a metre and a half onto the deck
    const climbs = feet.map((foot, w) => {
      const end = w ? path.at(-1)! : path[0];
      let y = B.roof;
      for (let t = 0; t <= 3 + 1e-6; t += C) {
        const [i, j] = cell([foot[0] + ((end[0] - foot[0]) / 1.5) * t, foot[1] + ((end[1] - foot[1]) / 1.5) * t]);
        const f = floorFor(i, j, y);
        if (f === null || f < y - 0.05) return `stopped ${t.toFixed(2)} m on at ${y.toFixed(2)} m`;
        y = f;
      }
      // (into a building, rules.bridges.into: onto the cell the layout lays at its window's sill)
      const want = into(end) ? ((cfg as unknown as { windows: Array<{ at: number[]; sill: number }> }).windows.find((q) => Math.hypot(q.at[0] - end[0], q.at[2] - end[1]) < 0.5 && q.sill > B.roof && q.sill < B.deck)?.sill ?? B.deck) : B.deck;
      return Math.abs(y - want) < 0.05 ? "" : `ends at ${y.toFixed(2)} m`;
    });
    check(`High City's bridge ${name}: the stair at each end (at a window it runs into, the sill) climbed straight up its middle, roof to deck`, climbs.every((c) => c === ""), climbs.map((c, w) => `${w ? "far" : "near"} ${c || "climbed"}`).join(", "));
    // (and each stair walked by a player's own movement, up from its foot onto the deck two metres and back down: the
    // flood above walks a body's square an eighth of a metre at a time and found its way up round the stair's edge,
    // where a player walking up its middle stopped on its third tread, the deck's body 0.65 m over it, and had to hop
    // on, at every end of every bridge (Milestone 594). Not along the decks: the ring's carry cover)
    const ends = [[path[0], path[1]], [path.at(-1)!, path.at(-2)!]].filter(([e]) => !into(e));
    const stepped = ends.flatMap(([e, n], w) => {
      const foot = past(e, n, 1.5 + backAt(e));
      const on = past(e, n, -2);
      const up = along([[foot[0], foot[1], B.roof], [on[0], on[1], B.deck]]);
      const down = along([[on[0], on[1], B.deck], [foot[0], foot[1], B.roof]]);
      return [up, down].flatMap((r, k) => (r.k === 2 ? [] : [`${w ? "far" : "near"} ${k ? "down" : "up"} stopped at (${r.x.toFixed(1)}, ${r.y.toFixed(2)}, ${r.z.toFixed(1)})`]));
    });
    check(`High City's bridge ${name}: each stair walked up onto the deck and back down by a player's own movement`, stepped.length === 0, stepped.join("; ") || `${ends.length} stairs`);
    // its rails: a look from p toward d (along x or z) at the waist, a box standing across that height within `far`
    const width = 5;
    // (the cell at a window it runs into lies at the window's sill, the layout's, and its rails with it)
    const sillOf = (e: number[]) => (cfg as unknown as { windows: Array<{ at: number[]; sill: number }> }).windows.find((q) => Math.hypot(q.at[0] - e[0], q.at[2] - e[1]) < 0.5 && q.sill > B.roof && q.sill < B.deck)?.sill;
    const waistAt = (p: number[]) => [path[0], path.at(-1)!].reduce((w, e) => (into(e) && Math.hypot(p[0] - e[0], p[1] - e[1]) < width ? (sillOf(e) ?? B.deck) + 0.5 : w), B.deck + 0.5);
    const railed = (p: number[], d: number[], far: number): boolean => {
      const [x0, x1, z0, z1] = [Math.min(p[0], p[0] + d[0] * far) + BR_X, Math.max(p[0], p[0] + d[0] * far) + BR_X, Math.min(p[1], p[1] + d[1] * far) + BR_Z, Math.max(p[1], p[1] + d[1] * far) + BR_Z];
      const waist = waistAt(p);
      return solidsIn(x0, x1, z0, z1).some((s) => s.minX <= x1 && s.maxX >= x0 && s.minZ <= z1 && s.maxZ >= z0 && s.base < waist && s.top > waist);
    };
    const open: string[] = [];
    let looks = 0;
    for (let i = 0; i + 1 < path.length; i++) {
      const [a, b] = [path[i], path[i + 1]];
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const d = [(b[0] - a[0]) / len, (b[1] - a[1]) / len];
      const side = [-d[1], d[0]];
      // the leg's straights: from its end (or past the corner it left) to the corner it meets (or its end)
      for (let t = (i ? width / 2 : 0) + 0.5; t < len - (i + 2 < path.length ? width / 2 : 0); t += 1)
        for (const sd of [side, [-side[0], -side[1]]]) {
          const p = [a[0] + d[0] * t, a[1] + d[1] * t];
          // (none over a gap in the ring, rules.bridges.gaps, Milestone 1082: no deck there to rail)
          if (GAPS1082.some((g) => Math.abs(g.at[0] - p[0]) <= 2.5 && Math.abs(g.at[1] - p[1]) <= 2.5)) continue;
          looks++;
          if (!railed(p, sd, width / 2 + 0.25)) open.push(`(${p[0].toFixed(1)}, ${p[1].toFixed(1)}) toward ${sd.join(",")}`);
        }
      // the corner: on past it the way this leg came, and back against the way the next one goes
      if (i + 2 < path.length) {
        const c = path[i + 2];
        const l2 = Math.hypot(c[0] - b[0], c[1] - b[1]);
        for (const sd of [d, [-(c[0] - b[0]) / l2, -(c[1] - b[1]) / l2]]) {
          looks++;
          if (!railed(b, sd, width / 2 + 0.25)) open.push(`the corner (${b.join(", ")}) toward ${sd.join(",")}`);
        }
      }
    }
    // (a look a metre each side all the way: the ring's paths make a hundred and more, GLASS HEIGHTS' 10 m one twenty)
    const span = path.slice(1).reduce((t, q, k) => t + Math.hypot(q[0] - path[k][0], q[1] - path[k][1]), 0);
    check(`High City's bridge ${name}: railed both sides all its way, and its corner's outer sides`, looks >= Math.min(100, 2 * Math.floor(span) - 4) && open.length === 0, `${looks} looks, ${open.length} open${open.length ? `: ${open.slice(0, 4).join("; ")}` : ""}`);
  }
}

// loot where the fights are, as a match lays it (brmatch.ts): each place's and site's spots on any floor there with a
// head's room, the roofs and rooms among them
const loot = new LootField(null);
loot.generate(
  20260929,
  map.pois.map((p) => ({ x: p.x, z: p.z, id: p.id, radius: p.radius })),
  { minX: BR_X - BR_HALF, maxX: BR_X + BR_HALF, minZ: BR_Z - BR_HALF, maxZ: BR_Z + BR_HALF },
  map.sites.map((s) => ({ x: s.x, z: s.z, id: s.id, radius: s.radius ?? brmapCfg.siteRadius, y: s.y, tier: s.tier })),
);
const drops = [...loot.drops.values()];
// every gun on the floor one of SpeedKills' own: the Hot Zone's kitted prize was drawn off the legacy game's epic list
// until Milestone 499, and a bot was seen carrying the legacy bow
{
  const { PROFILE } = await import("../../src/game/game");
  const strays = drops.filter((d) => d.item.kind === "weapon" && !PROFILE.roster.includes(d.item.id)).map((d) => d.item.id);
  check("every gun a match lays on the city's floor is on SpeedKills' roster", strays.length === 0, strays.length ? strays.join(", ") : `${drops.filter((d) => d.item.kind === "weapon").length} guns`);
}
// The districts' landmarks (Milestone 661, docs/GAP_ANALYSIS_MAP.md: Hyper Scape and Apex put their best loot in their
// landmarks): each of the eight districts a loot site at its landmark, rolled at the `landmark` tier, six items and more
// lying within its reach, on its own floor where it names one
{
  const marks = map.sites.filter((s) => s.tier === "landmark");
  const counts = marks.map((s) => drops.filter((d) => Math.hypot(d.pos.x - s.x, d.pos.z - s.z) < (s.radius ?? 9) + 1 && (s.y === undefined || Math.abs(d.pos.y - s.y) < 0.8)).length);
  check("the districts' landmarks: each of the eight districts a loot site at its landmark, its loot lying there", marks.length === 8 && counts.every((n) => n >= 6), marks.map((s, i) => `${s.name} ${counts[i]}`).join(", "));
}
// THE VAULT (game.sites `vault`): a site on the tower's 32 m floor with its own tier, its loot on that floor alone and
// richer than a floor's share: the floor's items within its reach against the floor under it
{
  const v = map.sites.find((s) => s.id === "vault");
  const near = (y: number) => drops.filter((d) => Math.abs(d.pos.y - y) < 0.6 && v && Math.hypot(d.pos.x - v.x, d.pos.z - v.z) < (v.radius ?? 9) + 1.5).length;
  // (rich as SpeedKills counts it, by how much lies there: its guns come at a fusion level, not a rarity)
  check("THE VAULT: a site on the tower's 32 m floor, its own tier, its loot on that floor alone and rich", !!v && v.y === 32 && v.tier === "vault" && near(32) >= near(29) + 12 && near(32) >= 2 * near(29), v ? `${near(32)} items on its floor within reach against ${near(29)} on the floor under` : "no vault site");
}
// the tower's floors meet its facade (rules.tower.fill, skin): no crack left open along a floor's edge or its ceiling, as
// the bake measured them (the inside of the facade's skin less the slab and what stands at its height). A slab stopped at
// the window frames left 46 to 60 m2 a floor, the sky and the street seen through it (the owner's play test, 2026-10-04)
{
  const H = (cfg.tower as unknown as { measured: { holes?: number[] } }).measured.holes ?? [];
  check("the tower's floors meet its facade: no crack along a floor's edge or its ceiling, as the bake measured", H.length === (cfg.tower as unknown as { shaft: number[] }).shaft.length && H.every((m) => m < 0.5), `${H.join("/")} m2`);
}
// THE VAULT marked from outside (rules.tower.vaultBand): a gold band round the facade at each floor `at`, the vault
// storey's floor and the one over it, as the bake laid them, each most of the way round (the tower's skin is 70 m and more
// round outside the east block it leans on) and filling the solid strip under or over the storey's windows, not a line
// (the fourth review: "a thin gold line", 0.3 m bands); and the storey's lamps gold inside
{
  const VB = (cfg.rules.tower as unknown as { vaultBand?: { at: number[] } }).vaultBand;
  const B = (cfg.tower as unknown as { measured: { bands?: Array<{ at: number; length: number; high?: number }> } }).measured.bands ?? [];
  check("THE VAULT marked from outside: a gold band round the tower filling the strip under its windows and the strip over them", !!VB && VB.at.every((h) => B.some((b) => b.at === h && b.length > 60 && (b.high ?? 0) >= 0.6)), B.map((b) => `${b.at} m ${b.length} m long, ${b.high ?? "?"} m high`).join(", ") || "no bands");
  const FA = (cfg.rules.tower as unknown as { floors: { lamp: { piece: string }; at: Record<string, { lampMat?: string }> } }).floors;
  const vaultLamps = (cfg.chunks as unknown as Record<string, { place: unknown[][] }>)["c-tower"].place.filter((q) => String(q[0]).endsWith(FA.lamp.piece) && Math.abs(Number(q[2]) - 34.4) < 0.6);
  const gold = vaultLamps.filter((q) => /#ffb020/.test(String(q[6] ?? ""))).length;
  check("THE VAULT's lamps burn gold", !!FA.at["32"]?.lampMat && vaultLamps.length >= 6 && gold === vaultLamps.length, `${gold} of ${vaultLamps.length} lamps gold`);
  // and its name on each face (rules.tower.vaultSign, drawn in src/game/neonmap.ts off the tower's square): within the
  // storey, and seen, a clear line 30 m out from its middle and near both its ends at the letters' height (the east
  // face's first stood behind the lookout's block, the fifth review having asked for a sign seen from every roof)
  const VS = (cfg.rules.tower as unknown as { vaultSign?: { y: number; h: number; faces: Array<[string, number, number, number]> } }).vaultSign;
  const [sx0, sx1, sz0, sz1] = (cfg.tower as unknown as { square: number[] }).square;
  const hidden: string[] = [];
  for (const [side, w, out, along] of VS?.faces ?? []) {
    const [xc, zc] = [(sx0 + sx1) / 2, (sz0 + sz1) / 2];
    const [nx, nz] = side === "e" ? [1, 0] : side === "w" ? [-1, 0] : side === "n" ? [0, -1] : [0, 1];
    const [cx, cz] = side === "e" ? [sx1 + out, zc + along] : side === "w" ? [sx0 - out, zc + along] : side === "n" ? [xc + along, sz0 - out] : [xc + along, sz1 + out];
    for (const t of [-w / 2 + 0.3, 0, w / 2 - 0.3]) {
      const [px, pz] = [cx + Math.abs(nz) * t, cz + Math.abs(nx) * t];
      const [ax, bx] = [Math.min(px + nx * 0.05, px + nx * 30) + BR_X, Math.max(px + nx * 0.05, px + nx * 30) + BR_X];
      const [az, bz] = [Math.min(pz + nz * 0.05, pz + nz * 30) + BR_Z, Math.max(pz + nz * 0.05, pz + nz * 30) + BR_Z];
      if (solidsIn(ax, bx, az, bz).some((q) => q.minX <= bx && q.maxX >= ax && q.minZ <= bz && q.maxZ >= az && q.base < VS!.y && q.top > VS!.y)) hidden.push(`${side} at ${t.toFixed(1)} m`);
    }
  }
  check("THE VAULT's name on each of the tower's four faces, within its storey, seen from 30 m out along all its width", !!VS && VS.faces.length === 4 && VS.y - VS.h / 2 >= 31.9 && VS.y + VS.h / 2 <= 35.1 && hidden.length === 0, hidden.length ? `hidden: ${hidden.join(", ")}` : `${VS?.faces.length ?? 0} faces`);
}
// no stair of the big building runs into a ceiling (the owner's play test, 2026-10-04: "stairs don't lead to ceilings"):
// along every way up it, the stair core's, each of the base's stairs and the court's ways in, a quarter metre at a time,
// the tread there (the highest top up to 0.6 m over the way's line: the line runs straight from landing to landing and a
// flight's first tread stands up to 0.4 m over it, where a window of a quarter metre took the slab under the stair for
// the floor and the tread for a ceiling) and the first thing over it, a standing body's height and more apart
{
  const routes: Array<[string, number[][]]> = [["the core", (cfg.tower as unknown as { core: { route: number[][] } }).core.route]];
  for (const q of (cfg.base as unknown as { stairs: Array<{ at: number; top: number[]; route: number[][] }> }).stairs) routes.push([`the base's stair at ${q.at} m (${q.top.join(", ")})`, q.route]);
  for (const h of K.halls.filter((q) => "route" in q && q.route)) routes.push([`the court's way in at (${((h.x0 + h.x1) / 2).toFixed(0)}, ${((h.z0 + h.z1) / 2).toFixed(0)})`, (h as unknown as { route: number[][] }).route]);
  const low: string[] = [];
  let worst = Infinity;
  for (const [name, route] of routes) {
    let least = Infinity, at = "";
    for (let k = 1; k < route.length; k++) {
      const [a, b] = [route[k - 1], route[k]];
      // (a way's legs between storeys turn on the landings: a leg back down to the next flight's foot is the turn, walked
      // on the landing, not a tread)
      const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
      for (let t = 0; t <= L; t += 0.25) {
        const f = L ? t / L : 0;
        const [x, z, y] = [a[0] + (b[0] - a[0]) * f + BR_X, a[1] + (b[1] - a[1]) * f + BR_Z, a[2] + (b[2] - a[2]) * f];
        const here = solidsIn(x, x, z, z).filter((s) => x >= s.minX && x <= s.maxX && z >= s.minZ && z <= s.maxZ);
        const tread = here.reduce((m, s) => (s.top <= y + 0.6 && s.top > m ? s.top : m), -Infinity);
        if (!Number.isFinite(tread)) continue;
        const over = here.reduce((m, s) => (s.base > tread + 0.1 && s.base < m ? s.base : m), Infinity);
        const head = over - tread;
        if (head < least) (least = head), (at = `(${(x - BR_X).toFixed(1)}, ${(z - BR_Z).toFixed(1)}) at ${tread.toFixed(2)} m`);
      }
    }
    worst = Math.min(worst, least);
    if (least < MOVE.standHeight) low.push(`${name}: ${least.toFixed(2)} m at ${at}`);
  }
  check("no stair of the big building runs into a ceiling: a standing body's headroom over every tread of every way up", routes.length >= 14 && low.length === 0, `${routes.length} ways, the least headroom ${worst.toFixed(2)} m${low.length ? `; too low: ${low.slice(0, 4).join("; ")}` : ""}`);
}
// each new floor's number beside its core doors (rules.tower.floors.digits): the right digit, two signs and more a floor
{
  const DG = (cfg.rules.tower.floors as unknown as { digits?: { piece: string; first: number; up: number; big?: { scale: number; up: number } } }).digits;
  const TWn = cfg.tower as unknown as { shaft: number[]; sky?: number[] };
  // (the new floors 1 to 8, the sky floors over them 9 to 11)
  const floors = [...TWn.shaft, ...(TWn.sky ?? [])];
  const signs = (cfg.chunks as unknown as Record<string, { place: unknown[][] }>)["c-tower"].place.filter((q) => String(q[0]).includes(DG?.piece ?? "LineNumber")) as Array<[string, number, number, number, number, string, unknown, unknown, number?]>;
  const ups = [DG?.up ?? 0, DG?.big?.up ?? DG?.up ?? 0];
  const figure = (q: (typeof signs)[number]) => q[0].slice(-8, -7);
  // each floor's signs at a door: its number's figures and no other, read left to right from outside the core (the w
  // door's on its face along z, the n and s doors' along x; seen from the north, x runs right to left)
  const box = (cfg.tower as unknown as { core: { box: number[] } }).core.box;
  const midZ = (box[2] + box[3]) / 2;
  const along = { w: (q: (typeof signs)[number]) => q[3], n: (q: (typeof signs)[number]) => -q[1], s: (q: (typeof signs)[number]) => q[1] };
  const wrong: string[] = [];
  const perFloor = floors.map((h, k) => {
    const num = String((DG?.first ?? 1) + k);
    const byFace = { w: [] as (typeof signs)[number][], n: [] as (typeof signs)[number][], s: [] as (typeof signs)[number][] };
    for (const q of signs.filter((o) => ups.some((u) => Math.abs(o[2] - (h + u)) < 0.05))) byFace[q[4] === 0 ? "w" : q[3] < midZ ? "n" : "s"].push(q);
    const faces = (Object.keys(byFace) as Array<keyof typeof byFace>).filter((f) => byFace[f].length);
    for (const f of faces) {
      const read = [...byFace[f]].sort((a, b) => along[f](a) - along[f](b)).map(figure).join("");
      if (read !== num) wrong.push(`${h} m ${f} reads ${read}`);
    }
    return faces.length;
  });
  check("the tower's floors numbered: the right lit figures beside each core door, read in order, 1 to 11 up the new floors and the sky floors", !!DG && floors.length === 11 && perFloor.every((n, k) => n >= (cfg.tower as unknown as { core: { storeys: number[]; doors: string[][] } }).core.doors[(cfg.tower as unknown as { core: { storeys: number[] } }).core.storeys.indexOf(floors[k])].length) && wrong.length === 0, `${perFloor.join("/")} doors${wrong.length ? `; ${wrong.join(", ")}` : ""}`);
  // (and 2 m high beside the north and south doors, rules.tower.floors.digits.big: the second review did not see the 1 m
  // ones; two a floor and more)
  const bigPer = floors.map((h) => signs.filter((q) => (q[8] ?? 1) >= 2 && Math.abs(q[2] - (h + (DG?.big?.up ?? -99))) < 0.05).length);
  check("the tower's floors numbered 2 m high beside the north and south doors", !!DG?.big && DG.big.scale >= 2 && bigPer.every((n, k) => n >= (floors[k] === 32 ? 1 : 2)), bigPer.join("/"));
}
const over12 = drops.filter((d) => d.pos.y > 12).length;
const over24 = drops.filter((d) => d.pos.y > 24).length;
check("loot over the map, 150 items and more", drops.length >= 150, `${drops.length}`);
// (the old city's bar, its e2e's: the eight districts round the centre are plain ground until their own build)
check("loot on the roofs too, 40 items over 12 m and 10 over 24 m", over12 >= 40 && over24 >= 10, `${over12} over 12 m, ${over24} over 24 m, of ${drops.length}`);
// every floor of the tower its core serves over the lobby stocked (src/game/neonmap.ts: each a hall's for the loot)
{
  const TW = (cfg as unknown as { tower: { square: number[]; shaft: number[]; core: { storeys: number[]; doors: string[][] } } }).tower;
  const [sx0, sx1, sz0, sz1] = TW.square;
  // (every storey with a floor, the ones the core has doors on: neonmap.ts HALL_FLOORS)
  const per = TW.core.storeys.slice(1).filter((_, k) => TW.core.doors[k + 1]?.length).map((h) => ({ h, n: drops.filter((d) => Math.abs(d.pos.y - h) < 0.2 && d.pos.x - BR_X > sx0 && d.pos.x - BR_X < sx1 && d.pos.z - BR_Z > sz0 && d.pos.z - BR_Z < sz1).length }));
  check("loot on every floor of the tower over its lobby, 5 items and more each", per.every((q) => q.n >= 5), per.map((q) => `${q.h} m ${q.n}`).join(", "));
}
// each corner block's own loot (game.sites, its `reach`): in its rooms building or the Well, some of it up the fire escape
{
  // (the four corner blocks: THE VAULT has a reach too, on one floor of the tower)
  const corner = map.sites.filter((q) => q.radius !== undefined && ["noodle", "motel", "well", "market"].includes(q.id));
  const each = corner.map((q) => {
    const near = drops.filter((d) => Math.hypot(d.pos.x - q.x, d.pos.z - q.z) <= (q.radius ?? 0) + 1.5);
    return { name: q.name, n: near.length, up: near.filter((d) => d.pos.y > 10).length };
  });
  // (a site lays its four spots, each one item and more: a count over that is the seed's, and moves with the collision)
  check("each corner block's own loot about its name, an item a spot and more (4)", corner.length === 4 && each.every((q) => q.n >= 4), each.map((q) => `${q.name} ${q.n} (${q.up} on the roof)`).join(", "));
}

// the High City's climbs (rules.blocks.climbs, the layout's climbs; the centre's third review: "nothing to climb on the
// facades between 10.5 and 26.9 m"): each climbed by a player's own movement with SpeedKills' moves, from the street onto
// the first balcony, up each by a jump held through its rise, the double jump at its top and the grab, from the end of
// one nearer the next onto the next one's nearer end, and from the last one's back onto the deck. Each leg from a stop on
// its take-off spot: a run-up carries a climber on under the balcony it jumps for
{
  const CB = (cfg as unknown as { climbs?: Array<{ block: string; deck: number[]; balconies: Array<{ at: number[]; y: number; yaw: number; ends: number[][] }> }> }).climbs ?? [];
  const climb = (start: number[], legs: Array<{ to: number[]; takeoff?: number[] }>): { k: number; at: string } => {
    const p = new Player({ minX: BR_X - 400, maxX: BR_X + 400, minZ: BR_Z - 400, maxZ: BR_Z + 400 });
    p.sprintMode = "auto";
    p.extraMoves = true;
    p.teleport(start[0] + BR_X, start[2] + 0.05, start[1] + BR_Z, 0);
    let t = 1000, k = 0, phase = 0, jumpedAt = -1, legTime = 0, holdTo = 0;
    for (let i = 0; i < 144; i++) p.update(1 / 144, (t += 1 / 144), idle, 0, 1, false);
    for (let i = 0; i < 90 * 144 && k < legs.length; i++) {
      const L = legs[k];
      const [tx, tz, ty] = L.to;
      legTime += 1 / 144;
      if (legTime > 15) break;
      const here = [p.pos.x - BR_X, p.pos.z - BR_Z];
      if (Math.hypot(tx - here[0], tz - here[1]) < 0.7 && Math.abs(p.pos.y - ty) < 0.4 && p.onGround) {
        k++, (phase = 0), (jumpedAt = -1), (legTime = 0);
        for (let j = 0; j < 36; j++) p.update(1 / 144, (t += 1 / 144), idle, 0, 1, false);
        continue;
      }
      let goal = [tx, tz], fwd = true, press: Action | null = null;
      const speed = Math.hypot(p.vel.x, p.vel.z);
      if (L.takeoff) {
        if (phase === 0) {
          goal = L.takeoff;
          const d = Math.hypot(goal[0] - here[0], goal[1] - here[1]);
          fwd = d > 1.2 ? true : speed > 1.5 ? false : d > 0.15;
          if (d < 0.25 && speed < 0.3 && p.onGround) (phase = 1), (fwd = false);
        }
        if (phase === 1) {
          fwd = false;
          if (jumpedAt < 0 && p.onGround) (press = "jump"), (jumpedAt = t), (holdTo = t + 0.35);
          else if (jumpedAt > 0 && t - jumpedAt > 0.38) (press = "jump"), (phase = 2), (holdTo = t + 0.35);
        } else if (phase === 2) fwd = p.pos.y > ty - 1.7;
      }
      const [dx, dz] = [goal[0] - here[0], goal[1] - here[1]];
      p.yaw = (Math.atan2(-dx, -dz) * 180) / Math.PI;
      p.update(1 / 144, (t += 1 / 144), { held: (a: Action) => (fwd && a === "forward") || (a === "jump" && t < holdTo), pressedNow: (a: Action) => a === press }, 0, 1, false);
    }
    return { k, at: `(${(p.pos.x - BR_X).toFixed(1)}, ${p.pos.y.toFixed(2)}, ${(p.pos.z - BR_Z).toFixed(1)})` };
  };
  for (const c of CB) {
    const B = c.balconies;
    const a = (B[0].yaw * Math.PI) / 180;
    const out = [-Math.sin(a), -Math.cos(a)];
    const near = (ends: number[][], to: number[]) => ends.reduce((m, e) => (Math.hypot(e[0] - to[0], e[1] - to[1]) < Math.hypot(m[0] - to[0], m[1] - to[1]) ? e : m));
    // (the first from 2.6 m out of the balcony's middle: its collision stands half a metre past its slab, and a body's
    // breadth more)
    const legs: Array<{ to: number[]; takeoff?: number[] }> = [{ to: [B[0].at[0] - out[0] * 0.3, B[0].at[1] - out[1] * 0.3, B[0].y], takeoff: [B[0].at[0] + out[0] * 2.6, B[0].at[1] + out[1] * 2.6] }];
    for (let i = 1; i < B.length; i++) {
      const from = near(B[i - 1].ends, B[i].at), onto = near(B[i].ends, B[i - 1].at);
      const L = Math.hypot(onto[0] - from[0], onto[1] - from[1]);
      legs.push({ to: [from[0], from[1], B[i - 1].y] }, { to: [onto[0], onto[1], B[i].y], takeoff: [from[0] + ((onto[0] - from[0]) / L) * 0.6, from[1] + ((onto[1] - from[1]) / L) * 0.6] });
    }
    const top = B[B.length - 1];
    legs.push({ to: c.deck, takeoff: [top.at[0] - out[0] * 0.5, top.at[1] - out[1] * 0.5] });
    const r = climb([B[0].at[0] + out[0] * 4, B[0].at[1] + out[1] * 4, 0], legs);
    check(`the ${c.block} block's climb: from the street up ${B.length} balconies onto the deck at ${c.deck[2]} m, by a player`, r.k === legs.length, `${r.k} of ${legs.length} legs, at ${r.at}`);
  }
  check("the High City's climbs, as many as the rule lays", CB.length === ((cfg.rules.blocks as unknown as { climbs?: { at: unknown[] } }).climbs?.at.length ?? 0) && CB.length > 0, `${CB.length}`);
}

// the tower's partitioned floors' walls (rules.tower.floors.at; the centre's third review: "the tower floors' walls are
// flat colour with a speckle"): each in a material with a pattern of its own, not one of the pack's coloured plastics
// (a noise texture under a flat colour), and each floor's its own, THE VAULT's at 32 m among them
{
  const AT = (cfg.rules.tower as unknown as { floors: { at: Record<string, { plan: string; mat: string }> } }).floors.at;
  const parted = Object.entries(AT).filter(([, q]) => q.plan !== "open");
  const flat = parted.filter(([, q]) => /^Plastic(Green|Black|Orange|Blue|Red|White|Yellow)\d+$/.test(q.mat));
  const mats = parted.map(([, q]) => q.mat);
  check("the tower's partitioned floors' walls in patterned panels, each floor its own", parted.length >= 5 && flat.length === 0 && new Set(mats).size === mats.length && !!AT["32"], `${parted.map(([h, q]) => `${h} m ${q.mat}`).join(", ")}${flat.length ? `; flat colour: ${flat.map(([h]) => h).join(", ")}` : ""}`);
}

// the battle royale's sectors on this map (game.sectors, src/game/decay.ts SECTOR_RECTS; the lobby agent's survey,
// 2026-10-04: city.json's put the whole of the Neon City in its centre, a match's first three waves took the empty ground
// round it, the whole city went at once in the fourth, and eight of the nine places' drops stood out past the edge road):
// set as the map is built, each holding a thousand of the collision's boxes and more, every wave of the plans of a hundred
// seeds taking some, each place's drops on its own sector, and each final circle's middle on its district
{
  const NS = (cfg.game as unknown as { sectors: Array<{ id: string; name: string; minX: number; maxX: number; minZ: number; maxZ: number }> }).sectors;
  const { SECTOR_RECTS, decayPlan, centreOf } = await import("../../src/game/decay");
  const { SECTORS } = await import("../../src/game/world");
  const inRect = (s: { minX: number; maxX: number; minZ: number; maxZ: number }, x: number, z: number) => x >= s.minX && x <= s.maxX && z >= s.minZ && z <= s.maxZ;
  const set = NS.every((s, i) => SECTOR_RECTS[i]?.id === s.id && SECTORS[i]?.name === s.name && SECTORS[i]?.minX === s.minX);
  check("the battle royale's sectors are the Neon City's own nine, set as it is built", set && SECTOR_RECTS.length === NS.length, SECTORS.map((s) => s.name).join(", "));
  // (by the sectors in play, as the decay takes them)
  const count = new Map<string, number>(SECTOR_RECTS.map((s) => [s.id, 0]));
  for (const b of SOLIDS.solids as number[][]) {
    if (b[5] <= 0.001) continue;
    const s = SECTOR_RECTS.find((q) => inRect(q, (b[0] + b[1]) / 2, (b[2] + b[3]) / 2));
    if (s) count.set(s.id, count.get(s.id)! + 1);
  }
  check("each sector holds buildings of its own, a thousand of the collision's boxes and more", [...count.values()].every((n) => n >= 1000), [...count].map(([k, n]) => `${k} ${n}`).join(", "));
  let empty = 0;
  for (let seed = 1; seed <= 100; seed++) for (const wave of decayPlan(seed).waves) if (wave.reduce((a, id) => a + (count.get(id) ?? 0), 0) < 1000) empty++;
  check("every wave of a hundred matches' decay takes buildings, none only empty ground", empty === 0, `${empty} waves without`);
  const off = map.pois.flatMap((p) => p.drops.filter((d) => !inRect(NS.find((s) => s.id === p.id)!, d.x - BR_X, d.z - BR_Z)).map(() => p.id));
  check("each place's drops on its own sector", map.pois.length === NS.length && off.length === 0, `${off.length} off${off.length ? `: ${[...new Set(off)].join(", ")}` : ""}`);
  const far = NS.filter((s) => { const m = centreOf(s.id); return !inRect(s, m.x, m.z) || Math.max(Math.abs(m.x), Math.abs(m.z)) > 85; });
  check("each sector's final circle on its district, not out past the edge road", far.length === 0, far.map((s) => s.id).join(", "));
}

// each sector's dissolve top (src/game/world.ts holdForDecay, decay.ts dissolveTop), as the game measured it building this
// map: a decaying sector's line reaches a body standing on its highest box by the close's end (under the line's jag, up
// to 1.4 m, world.ts teachDecay), and spends the close on its own floors, not on empty air over them. A fixed 80 m never
// reached the tower's top (its roofs at 132 m, its mast's box at 144 m), and had a corner block's roofs gone in a
// few seconds of its 20
{
  const { SECTORS, decayTops } = await import("../../src/game/world");
  const tops = decayTops();
  const JAG = 1.4;
  const high = SECTORS.map((s) => (SOLIDS.solids as number[][]).reduce((a, b) => {
    const x = (b[0] + b[1]) / 2, z = (b[2] + b[3]) / 2;
    return x >= s.minX && x <= s.maxX && z >= s.minZ && z <= s.maxZ ? Math.max(a, b[5]) : a;
  }, 0));
  const short = SECTORS.filter((_, i) => tops[i] - JAG < high[i] + MOVE.standHeight);
  const air = SECTORS.filter((_, i) => tops[i] > high[i] + MOVE.standHeight + JAG + 1);
  check(
    "each sector dissolves to its own top: a body on its highest box under the line by the close's end, and not past it",
    tops.length === SECTORS.length && short.length === 0 && air.length === 0,
    SECTORS.map((s, i) => `${s.id} ${high[i].toFixed(1)} to ${tops[i].toFixed(1)} m`).join(", "),
  );
}

// the bots' way to each sector's capture zone (brmatch.ts zoneTree; the lobby agent's survey, 2026-10-04: a bot in the
// final sector had no way to the zone, start and goal the same node): the walk's end is a node a bot gets to from every
// street node, within the zone's reach (decay.json capture.radius) of the sector's middle, so a bot that walks it stands in
// the zone. The nearest of all was a roof only a player climbs, the court under the tower, a gallery down THE WELL
{
  const { navTree, reachedFrom } = await import("../../src/game/navgraph");
  const { SECTOR_RECTS, centreOf } = await import("../../src/game/decay");
  const R = ((await import("../../src/config/decay.json")).default as { capture: { radius: number } }).capture.radius;
  const streetNodes = map.nodes.flatMap((n, i) => (Math.abs(n.y ?? 0) < 0.5 && n.links.length ? [i] : []));
  const reach = reachedFrom(map.nodes, streetNodes);
  const bad = SECTOR_RECTS.flatMap((s) => {
    const m = centreOf(s.id);
    const t = navTree(map.nodes, m.x + BR_X, m.z + BR_Z, { reach });
    const n = map.nodes[t.target];
    const off = Math.hypot(n.x - BR_X - m.x, n.z - BR_Z - m.z);
    const cut = streetNodes.filter((i) => t.toward[i] === -2).length;
    return off > R || cut ? [`${s.id} ${off.toFixed(1)} m off, ${cut} street nodes without a way`] : [];
  });
  check(`the bots' way to every sector's capture zone: from every street node, ending inside its ${R} m`, bad.length === 0, bad.join("; ") || `${SECTOR_RECTS.length} sectors`);
}

// each High City block its own colour (rules.high.<dir>.looks; the centre's fourth review: "the four High City blocks are
// the same clover-shaped glass tower copied four times"): each block's placement wears a remap of its frames and trims
// (the bake throws on a name it finds no part in), and no two the same
{
  const blocks = ["n", "s", "e", "w"].map((d) => (cfg.chunks as unknown as Record<string, { place: unknown[][] }>)[`c-${d}`]?.place.find((q) => /HighPlatform_Island/.test(String(q[0]))));
  const looks = blocks.map((q) => (q && typeof q[6] === "string" ? (q[6] as string) : ""));
  check("each High City block in its own colour, its frames and trims remapped", looks.every((l) => l.includes("=")) && new Set(looks).size === 4, looks.map((l, i) => `${["n", "s", "e", "w"][i]} ${l.match(/#[0-9a-f]{6}/i)?.[0] ?? "none"}`).join(", "));
}

// the street level's exposure (rules.sightlines; the centre's third review: "no street sightline past 60 m but the Loop's",
// "streets are wide bare plains overlooked from 27 m"): from open street ground every `step` metres (a floor within 0.3 m
// of the ground, nothing a body would stand in from 0.3 to 1.8 m over it), a standing eye `eye` metres up looks along
// `bearings` bearings until a box stands across that height (every half-metre cell a box touches, so a thin wall stops
// it); the share of the bearings from which a standing body there is seen from past `long` metres, averaged over the
// points on the curves' road and pavements and on the Loop's, each at most `most` per cent. On map version 39, before
// the street walls, the median's boards and a van every second car: 8.1% on the curves and 13.0% on the Loop
{
  const SL = cfg.rules.sightlines as { long: number; eye: number; step: number; bearings: number; most: Record<string, number> };
  const CV = cfg.rules.streets.curves as unknown as Parameters<typeof curvedStreets>[0] & { pave: number };
  const SF = new StreetField(curvedStreets(CV));
  const [C, X0, N] = [0.5, -100, 400];
  const open = new Uint8Array(N * N), eye = new Uint8Array(N * N), body = new Uint8Array(N * N);
  const floor = new Float32Array(N * N).fill(-Infinity);
  for (const b of SOLIDS.solids as number[][]) {
    if (b[5] < -0.5 || b[4] > 2.5) continue;
    for (let i = Math.max(0, Math.floor((b[0] - X0) / C)); i <= Math.min(N - 1, Math.floor((b[1] - X0) / C)); i++)
      for (let j = Math.max(0, Math.floor((b[2] - X0) / C)); j <= Math.min(N - 1, Math.floor((b[3] - X0) / C)); j++) {
        const k = i * N + j;
        if (b[4] < SL.eye && b[5] > SL.eye) eye[k] = 1;
        if (b[4] < 1.8 && b[5] > 0.3) body[k] = 1;
        if (b[5] <= 0.3 && b[5] > floor[k]) floor[k] = b[5];
      }
  }
  for (let k = 0; k < N * N; k++) if (!body[k] && (floor[k] > -0.3 || !Number.isFinite(floor[k]))) open[k] = 1;
  const zones = new Map<string, { n: number; seen: number }>();
  const step = Math.round(SL.step / C);
  for (let i = 0; i < N; i += step)
    for (let j = 0; j < N; j += step) {
      if (!open[i * N + j]) continue;
      const [x, z] = [X0 + (i + 0.5) * C, X0 + (j + 0.5) * C];
      const near = SF.nearest(x, z, 20);
      if (!near || near.d > near.street.half + CV.pave || Math.max(Math.abs(x), Math.abs(z)) >= cfg.rules.low.edge) continue;
      let seen = 0;
      for (let d = 0; d < SL.bearings; d++) {
        const a = (d / SL.bearings) * Math.PI * 2;
        const [ux, uz] = [Math.sin(a), Math.cos(a)];
        let last = 0;
        for (let t = C; ; t += C / 2) {
          const [ii, jj] = [Math.floor((x + ux * t - X0) / C), Math.floor((z + uz * t - X0) / C)];
          if (ii < 0 || jj < 0 || ii >= N || jj >= N || eye[ii * N + jj]) break;
          if (open[ii * N + jj]) last = t;
        }
        if (last > SL.long) seen++;
      }
      const zk = near.street.closed ? "loop" : "curves";
      const zr = zones.get(zk) ?? zones.set(zk, { n: 0, seen: 0 }).get(zk)!;
      zr.n++;
      zr.seen += seen / SL.bearings;
    }
  const pct = (k: string) => ((zones.get(k)?.seen ?? 0) / (zones.get(k)?.n ?? 1)) * 100;
  check(
    `the street level's exposure: a standing body on the curves and the Loop seen from past ${SL.long} m along few bearings`,
    Object.entries(SL.most).every(([k, most]) => (zones.get(k)?.n ?? 0) > 100 && pct(k) <= most),
    Object.entries(SL.most).map(([k, most]) => `${k} ${pct(k).toFixed(1)}% of ${zones.get(k)?.n ?? 0} points, at most ${most}%`).join("; "),
  );
}

// the streets' cover (rules.dress.cover; the centre's fourth review: "cover every 8 to 12 m in the streets and plaza"):
// from every open half-metre of the streets (a curve's or the Loop's road and pavements and the ring road from its inner
// pavement out, open as the exposure's above), the distance to the nearest box standing from the ground (under 0.5 m) past
// a crouched head (1 m); at most `left` per cent of them over `far` metres, and none over `farthest`
{
  const CO = cfg.rules.dress.cover as { far: number; left: number; farthest: number };
  const CV = cfg.rules.streets.curves as unknown as Parameters<typeof curvedStreets>[0] & { pave: number; round: number };
  const SF = new StreetField(curvedStreets(CV));
  const H = (cfg.rules.ring as number[])[1];
  const C = 0.5, N = Math.round((2 * H) / C);
  const body = new Uint8Array(N * N), cover = new Uint8Array(N * N);
  const floor = new Float32Array(N * N).fill(-Infinity);
  // (a cell's cover the reach of the boxes standing one on another from under 0.5 m: a crate stack is two boxes, the
  // lower's top 1 m and the upper's foot 1 m, the band's district kits stack them)
  const reach = new Float32Array(N * N).fill(-Infinity);
  const stacked: Array<[number, number[]]> = [];
  for (const b of SOLIDS.solids as number[][]) {
    if (b[5] < -0.5 || b[4] > 2.5 || b[1] < -H || b[0] > H || b[3] < -H || b[2] > H) continue;
    for (let i = Math.max(0, Math.floor((b[0] + H) / C)); i <= Math.min(N - 1, Math.floor((b[1] + H) / C)); i++)
      for (let j = Math.max(0, Math.floor((b[2] + H) / C)); j <= Math.min(N - 1, Math.floor((b[3] + H) / C)); j++) {
        const k = i * N + j;
        if (b[4] < 1.8 && b[5] > 0.3) body[k] = 1;
        if (b[4] < 0.5 && b[5] > reach[k]) reach[k] = b[5];
        else if (b[4] >= 0.5) stacked.push([k, b]);
        if (b[5] <= 0.3 && b[5] > floor[k]) floor[k] = b[5];
      }
  }
  stacked.sort((p, q) => p[1][4] - q[1][4]);
  for (const [k, b] of stacked) if (b[4] <= reach[k] + 0.02 && b[5] > reach[k]) reach[k] = b[5];
  for (let k = 0; k < N * N; k++) if (reach[k] > 1) cover[k] = 1;
  const D = new Float32Array(N * N);
  for (let k = 0; k < D.length; k++) D[k] = cover[k] ? 0 : 1e9;
  for (let i = 0; i < N; i++)
    for (let j = 0; j < N; j++) {
      const k = i * N + j;
      if (i > 0) D[k] = Math.min(D[k], D[k - N] + 1, j > 0 ? D[k - N - 1] + Math.SQRT2 : 1e9, j < N - 1 ? D[k - N + 1] + Math.SQRT2 : 1e9);
      if (j > 0) D[k] = Math.min(D[k], D[k - 1] + 1);
    }
  for (let i = N - 1; i >= 0; i--)
    for (let j = N - 1; j >= 0; j--) {
      const k = i * N + j;
      if (i < N - 1) D[k] = Math.min(D[k], D[k + N] + 1, j < N - 1 ? D[k + N + 1] + Math.SQRT2 : 1e9, j > 0 ? D[k + N - 1] + Math.SQRT2 : 1e9);
      if (j < N - 1) D[k] = Math.min(D[k], D[k + 1] + 1);
    }
  let n = 0, far = 0, farthest = 0, at = [0, 0];
  for (let k = 0; k < N * N; k++) {
    if (body[k] || !(floor[k] > -0.3 || !Number.isFinite(floor[k]))) continue;
    const [x, z] = [-H + (Math.floor(k / N) + 0.5) * C, -H + ((k % N) + 0.5) * C];
    if (!(SF.surface(x, z, CV.round) < CV.pave || Math.max(Math.abs(x), Math.abs(z)) >= cfg.rules.low.edge)) continue;
    n++;
    const d = D[k] * C;
    if (d > CO.far) far++;
    if (d > farthest) (farthest = d), (at = [x, z]);
  }
  check(
    `the streets' cover: from the curves, the Loop and the ring road, something to crouch behind within ${CO.far} m`,
    n > 10000 && (far / n) * 100 <= CO.left && farthest <= CO.farthest,
    `${((far / n) * 100).toFixed(1)}% of ${n} points over ${CO.far} m, at most ${CO.left}%; the farthest ${farthest.toFixed(1)} m at (${at[0].toFixed(1)}, ${at[1].toFixed(1)}), at most ${CO.farthest} m`,
  );
}

// the tower floors' doorways framed (rules.tower.floors.frame; the centre's fourth review: "partitions look like stage
// flats short of the ceiling"): on every floor whose plan opens a line with a doorway or a gate, the pack's door or gate
// in each, its top at the ceiling or into the slab over it (within 3 cm under it) and its foot not over the floor, and its
// head (`head`, measured off the model) showing under the ceiling, its faces in the floor's wall and its frame left as
// it is; and every floor number's plate black
{
  const F = cfg.rules.tower.floors as unknown as { gate: string; frame: { door: string; head: number; faces: string[] }; plans: Record<string, Record<string, string>>; at: Record<string, { plan: string; mat?: string }>; digits: { piece: string; mat: string } };
  const TWc = cfg.tower as unknown as { core: { storeys: number[] }; lid?: { at: number; slab: number } };
  const slab = (cfg.rules.tower as unknown as { slab: number }).slab;
  const place = (cfg.chunks as unknown as Record<string, { place: unknown[][] }>)["c-tower"].place;
  const bad: string[] = [];
  let doors = 0, gates = 0;
  for (const [hs, P] of Object.entries(F.at)) {
    const h = Number(hs);
    const plan = F.plans[P.plan];
    const want = { door: Object.values(plan).filter((v) => v === "door").length, gate: Object.values(plan).filter((v) => v === "gate").length };
    // (over the top storey, its lid)
    // (the nearest slab over it, as the layout's ceilingOf: the storey over it's, or the lid's or a level's own)
    const i = TWc.core.storeys.indexOf(h);
    const lvC = (TWc as unknown as { levels?: Array<{ floor: { at: number }; ceiling: { at: number; slab: number } }> }).levels ?? [];
    const ownC = lvC.find((q) => q.floor.at === h)?.ceiling ?? [...(TWc.lid ? [TWc.lid] : []), ...lvC.map((q) => q.ceiling)].find((q) => q.at > h && q.at <= TWc.core.storeys[i + 1] + 0.1);
    const ceiling = ownC ? ownC.at - ownC.slab : TWc.core.storeys[i + 1] - slab;
    for (const [kind, name] of [["door", F.frame.door], ["gate", F.gate]] as const) {
      const got = place.filter((q) => String(q[0]).endsWith(name) && Math.abs(Number(q[2]) - h) < 1);
      const ok = got.filter((q) => {
        const y = Number(q[2]);
        // (its frame in a material of its own: each remap's target, since THE VAULT's gates remap their steel to gold)
        return y <= h && y + 3 > ceiling - 0.03 && y + F.frame.head < ceiling - 0.03 && String(q[6] ?? "").includes("=") && !String(q[6] ?? "").split(";").some((r) => /BareSteel|MetalBare|MetalPanel/.test(r.split("=")[1] ?? r));
      });
      if (got.length !== want[kind] || ok.length !== want[kind]) bad.push(`${h} m ${kind}s ${ok.length} of ${want[kind]} (${got.length} placed)`);
      if (kind === "door") doors += ok.length;
      else gates += ok.length;
    }
  }
  const signs = place.filter((q) => String(q[0]).includes(F.digits.piece));
  // (THE VAULT's figures gold, Milestone 977, on black or on their gold plate)
  const dark = signs.filter((q) => String(q[6]).split(";").includes(F.digits.mat) || String(q[6]).includes("PlasticBlue00=MetalPaintPannelsYellow00")).length;
  check(
    "the tower floors' doorways framed: a door or gate in each, its head under the ceiling, its frame its own; the floor numbers on black",
    bad.length === 0 && doors > 0 && gates > 0 && signs.length > 0 && dark === signs.length,
    `${doors} doors, ${gates} gates${bad.length ? `; ${bad.join(", ")}` : ""}; ${dark} of ${signs.length} numbers on black`,
  );
}

// The two Neon 1v1 arenas (rules.arenas, arenas/neonarenas.ts; the owner, 2026-10-09: "2 1v1 maps ... super basic"), off
// the bake's collision as the game has it: each out past the battle royale's edge and every sector, so no ring, decay or
// drop reaches it; baked as its own node of the file; a wall the height of the room standing along every side; every
// spawn and point with a body's room, on the ground, inside the walls; the line between each pair of opposite spawns
// broken at eye height (a 1v1 that starts with both players in each other's sight is decided by who loads first), each
// spawn facing open floor all the same; and
// the hall's roof over all of its floor
{
  const { YARD_MAP, HALL_MAP } = await import("../../src/game/arenas/neonarenas");
  const A = (cfg as unknown as { arenas: Record<string, { chunk: string; at: number[]; half: number[]; roof: number | null }> }).arenas;
  const rules = (cfg.rules as unknown as { arenas: { list: Array<{ id: string; walls: { top: number } }> } }).arenas.list;
  const baked = cfg.baked.chunks as Record<string, { min: number[]; max: number[] }>;
  const r = MOVE.radius + 0.1;
  const eye = MOVE.standHeight - 0.1;
  const solidAt = (x: number, z: number, y: number) => solidsIn(x, x, z, z).some((b) => b.minX <= x && b.maxX >= x && b.minZ <= z && b.maxZ >= z && b.base <= y && b.top >= y);
  for (const m of [YARD_MAP, HALL_MAP]) {
    const L = A[m.id];
    const W = rules.find((q) => q.id === m.id)!.walls;
    const high = W.top - 0.3;
    const b = m.bounds;
    const sectors = cfg.game.sectors as Array<{ minX: number; maxX: number; minZ: number; maxZ: number }>;
    const lx = [b.minX - BR_X, b.maxX - BR_X];
    const lz = [b.minZ - BR_Z, b.maxZ - BR_Z];
    const apart = lz[0] > BR_HALF || lz[1] < -BR_HALF || lx[0] > BR_HALF || lx[1] < -BR_HALF;
    const inSector = sectors.some((s) => lx[0] < s.maxX && lx[1] > s.minX && lz[0] < s.maxZ && lz[1] > s.minZ);
    const node = baked[L.chunk];
    const drawn = !!node && node.min[0] < lx[0] && node.max[0] > lx[1] && node.min[2] < lz[0] && node.max[2] > lz[1];
    check(`${m.name}: past the battle royale's edge and every sector, baked as its own node round its room`, apart && !inSector && drawn, `x ${lx.map((v) => v.toFixed(0)).join(" to ")}, z ${lz.map((v) => v.toFixed(0)).join(" to ")}${node ? `; its node x ${node.min[0].toFixed(0)} to ${node.max[0].toFixed(0)}, z ${node.min[2].toFixed(0)} to ${node.max[2].toFixed(0)}` : "; not baked"}`);
    // (a quarter metre outside each inner face, every half metre along it, solid from a body's foot to the room's top)
    const gaps: string[] = [];
    for (let x = b.minX + 0.25; x < b.maxX; x += 0.5) for (const z of [b.minZ - 0.25, b.maxZ + 0.25]) if (![0.4, eye, high].every((y) => solidAt(x, z, y))) gaps.push(`${(x - BR_X).toFixed(1)}, ${(z - BR_Z).toFixed(1)}`);
    for (let z = b.minZ + 0.25; z < b.maxZ; z += 0.5) for (const x of [b.minX - 0.25, b.maxX + 0.25]) if (![0.4, eye, high].every((y) => solidAt(x, z, y))) gaps.push(`${(x - BR_X).toFixed(1)}, ${(z - BR_Z).toFixed(1)}`);
    check(`${m.name}: a wall ${high.toFixed(1)} m high along every side`, gaps.length === 0, gaps.length ? `${gaps.length} gaps, first at ${gaps.slice(0, 3).join("; ")}` : `${(2 * (b.maxX - b.minX + b.maxZ - b.minZ)).toFixed(0)} m of wall`);
    const spots = [...m.spawns.map((s, i) => ({ what: `spawn ${i + 1}`, x: s.x, z: s.z })), ...m.zones.map((q) => ({ what: `point ${q.id}`, x: q.x, z: q.z }))];
    const held = spots.filter(({ x, z }) => x < b.minX + r || x > b.maxX - r || z < b.minZ + r || z > b.maxZ - r || floorAt(x, z) !== 0 || solidsIn(x - r, x + r, z - r, z + r).some((q) => q.minX < x + r && q.maxX > x - r && q.minZ < z + r && q.maxZ > z - r && q.top > 0.3 && q.base < 1.8));
    check(`${m.name}: its spawns and points each with a body's room, on the ground, inside its walls`, m.spawns.length >= 4 && m.zones.length === 3 && held.length === 0, `${spots.length} spots${held.length ? `; held: ${held.map((q) => q.what).join(", ")}` : ""}`);
    const open: string[] = [];
    for (let i = 0; i + 1 < m.spawns.length; i += 2) {
      const [p, q] = [m.spawns[i], m.spawns[i + 1]];
      const n = Math.ceil(Math.hypot(q.x - p.x, q.z - p.z) / 0.25);
      let cut = false;
      for (let k = 1; k < n && !cut; k++) cut = solidAt(p.x + ((q.x - p.x) * k) / n, p.z + ((q.z - p.z) * k) / n, eye);
      if (!cut) open.push(`${i + 1} and ${i + 2}`);
    }
    check(`${m.name}: no pair of opposite spawns in each other's sight at eye height`, open.length === 0, open.length ? `in sight: ${open.join(", ")}` : `${m.spawns.length / 2} pairs`);
    // (and each spawn faces open floor: 6 m clear ahead at eye height, the e2e's rule for every arena, arenaMapsTest)
    const ahead = m.spawns.map((s) => {
      const y = (s.yaw * Math.PI) / 180;
      let d = 0;
      while (d < 30 && !solidAt(s.x - Math.sin(y) * d, s.z - Math.cos(y) * d, eye)) d += 0.25;
      return d;
    });
    check(`${m.name}: every spawn faces at least 6 m of open floor`, ahead.every((d) => d >= 6), ahead.map((d) => `${d.toFixed(1)} m`).join(", "));
    if (L.roof !== null) {
      let under = 0;
      let bare = 0;
      for (let x = b.minX + 0.5; x < b.maxX; x += 1) for (let z = b.minZ + 0.5; z < b.maxZ; z += 1) solidAt(x, z, L.roof + 0.2) ? under++ : bare++;
      check(`${m.name}: its roof over all of its floor at ${L.roof} m`, bare === 0, `${under} m2 roofed${bare ? `, ${bare} open` : ""}`);
    }
  }
}

// THE WORKS made rust and machinery (Milestone 664; the districts' review: "grey boxes, not rust and machinery; an empty
// hall"): every set of the works block's ground floor laid and standing in the bake's collision (something over a metre
// tall at each), its pipe runs drawn, its halls' walls in rust, and no beam over a pad under a roof (the atrium's two, the
// review's "light cones" indoors) while every other pad has its own
{
  const Wr = (cfg.rules.districts as unknown as { works: { wallMat?: string; upper: { ground?: Array<[string, number, number, number]>; pipes?: unknown[] } } }).works;
  const Uc = (cfg as unknown as { works: { upper: { ground?: { laid: number; of: number; left: string[] }; pipes?: number } } }).works.upper;
  const PB = (cfg.baked as unknown as { padBeams?: { pads: number; drawn: number; roofed: string[] } }).padBeams;
  const want = Wr.upper.ground ?? [];
  // (standing: something over a metre tall within 1.2 m of the set's middle, not a wall: a gas riser's pipes stand at
  // its sides, a tank on its legs)
  const bare = want.filter(([, x, z]) => !solidsIn(x + BR_X - 1.2, x + BR_X + 1.2, z + BR_Z - 1.2, z + BR_Z + 1.2).some((b) => b.minX < x + BR_X + 1.2 && b.maxX > x + BR_X - 1.2 && b.minZ < z + BR_Z + 1.2 && b.maxZ > z + BR_Z - 1.2 && Math.min(b.maxX - b.minX, b.maxZ - b.minZ) > 0.35 && b.base < 3 && b.top > 1 && b.top < 6.4));
  const roofedWant = (cfg.rules.pads as unknown as { spine: { up: Array<{ id: string; below?: number }> } }).spine.up.filter((q) => q.below !== undefined).map((q) => q.id).sort();
  check(
    "THE WORKS: the works block's ground floor furnished, every set laid and standing, pipes on its walls, its halls in rust, and no beam over a pad under its roof",
    want.length >= 8 && Uc.ground?.laid === want.length && bare.length === 0 && Uc.pipes === (Wr.upper.pipes ?? []).length && (Uc.pipes ?? 0) > 0 && !!Wr.wallMat && !!PB &&
      JSON.stringify([...PB.roofed].sort()) === JSON.stringify(roofedWant) && roofedWant.length === 2 && PB.drawn === ((cfg.rules.pads as unknown as { beamScale?: number }).beamScale === 0 ? 0 : PB.pads - PB.roofed.length),
    `${Uc.ground?.laid ?? 0} of ${want.length} sets${bare.length ? `, nothing standing at ${bare.map(([n, x, z]) => `${n} ${x}, ${z}`).join("; ")}` : ""}, ${Uc.pipes ?? 0} pipe runs, walls ${Wr.wallMat ?? "their own"}, beams ${PB ? `${PB.drawn} of ${PB.pads} pads, none over ${PB.roofed.join(" and ")}` : "not recorded"}`
  );
}

// THE TERRACES' rooms furnished and lit (Milestone 665; the districts' review: "an untextured room"): in each of its
// rooms, off the bake's collision, three pieces of furniture and more standing on its floor (the crate alone before), a
// ceiling lamp the game lights as fill under its slab, and its inside walls in plaster
{
  const RMr = (cfg.rules.districts as unknown as { terraces: { rooms: { innerMat?: string; lamp?: string; furnish?: unknown[] } } }).terraces.rooms;
  const rooms = ((cfg as unknown as { terraces: { rooms: number[][] } }).terraces.rooms ?? []);
  const place = (cfg.chunks as unknown as Record<string, { place: Array<[string, number, number, number]> }>)[(cfg.rules.districts as unknown as { terraces: { chunk: string } }).terraces.chunk]?.place ?? [];
  const each = rooms.map(([x0, z0, floor]) => {
    const [ax, az] = [x0 + BR_X, z0 + BR_Z];
    const n = solidsIn(ax + 0.3, ax + 4.7, az + 0.3, az + 4.7).filter((b) => b.minX >= ax + 0.2 && b.maxX <= ax + 4.8 && b.minZ >= az + 0.2 && b.maxZ <= az + 4.8 && b.base >= floor - 0.1 && b.base < floor + 0.3 && b.top > floor + 0.5 && b.top < floor + 2.2).length;
    // (its pivot within half a metre of the room's middle: the slim strip lamp's pivot is off its own middle)
    const lit = !!RMr.lamp && place.some((q) => q[0].endsWith(RMr.lamp!.split("/").pop()!) && Math.abs(q[1] - (x0 + 2.5)) < 0.5 && Math.abs(q[3] - (z0 + 2.5)) < 0.5);
    return { n, lit };
  });
  check("THE TERRACES: each room furnished (three pieces and more standing in it), lit by a lamp the game lights, its walls in plaster", rooms.length === 6 && each.every((q) => q.n >= 3 && q.lit) && !!RMr.innerMat && (RMr.furnish?.length ?? 0) >= 3, each.map((q, i) => `room ${i + 1}: ${q.n} pieces${q.lit ? ", lit" : ", dark"}`).join("; "));
}
// THE STRIP's screens and glow (Milestone 666; the districts' review: "solid blue screens", "flat red planes"): each ad
// stand's blue glow quad worn as its ad, and the pyramid's and the club canopy's flat red as the pack's lit-window glass, as
// the layout laid them
{
  const SR = (cfg.rules.districts as unknown as { strip: { chunk: string; ads: { piece: string }; pyramid: { piece: string }; club: { canopy: string; roof?: unknown } } }).strip;
  const place = (cfg.chunks as unknown as Record<string, { place: Array<[string, number, number, number, number, string, string?]> }>)[SR.chunk]?.place ?? [];
  const of = (name: string) => place.filter((q) => q[0].endsWith(`/${name}`));
  const ads = of(SR.ads.piece);
  const glow = [...of(SR.pyramid.piece), ...of(SR.club.canopy)];
  // (the club's canopy out since Milestone 825, the club roofed)
  check("THE STRIP: both ad screens show their ads (the blue glow quad over each worn as it), the pyramid and the club canopy in the pack's lit-window glass", ads.length === 2 && ads.every((q) => (q[6] ?? "").includes("Light02=Ads")) && glow.length === (SR.club.roof ? 1 : 2) && glow.every((q) => q[6] === "Light00=BuildingWindows04"), `ads ${ads.map((q) => q[6] ?? "as drawn").join(", ")}; glow ${glow.map((q) => q[6] ?? "as drawn").join(", ")}`);
}

// THE GULAG (rules.arenas gulag, Milestone 662; the owner, 2026-10-18: "one street like the firing range with one building
// in the middle ... a ledge that has two levels to it and can see the rest of the gulag when they are on top, just a
// double jump height worth"), off the bake's collision: past the battle royale's edge and every sector, its own node; the
// Gulag's map (br.json gulag.map); walls along every side; the two spawns with a body's room on the ground and out of each
// other's sight, each facing open floor; the ledge's top under the flag at the height the game reads (cfg.arenas
// ledge.y), a jump over the lower level, which is a jump over the street, the top a double jump over it (a jump and a
// double jump, no mantle), with a body's room over the flag and the flag's circle all on the top; from the top a
// standing eye sees the street's floor past the cover all round but behind the walls before the spawns; and a bot's
// straight walk from each way up (it cannot jump: brmatch.ts gulagFrame walks it there first) reaching the top
{
  const { GULAG_MAP } = await import("../../src/game/arenas/neonarenas");
  const { EXTRA } = await import("../../src/game/movement");
  const { botWalk } = await import("../../src/game/botbody");
  const brJson = JSON.parse(readFileSync(join(import.meta.dirname, "..", "..", "src", "config", "br.json"), "utf8"));
  const m = GULAG_MAP;
  const b = m.bounds;
  const L = (cfg as unknown as { arenas: Record<string, { chunk: string; ledge?: { y: number } }> }).arenas.gulag;
  const baked = cfg.baked.chunks as Record<string, { min: number[]; max: number[] }>;
  const sectors = cfg.game.sectors as Array<{ minX: number; maxX: number; minZ: number; maxZ: number }>;
  const lx = [b.minX - BR_X, b.maxX - BR_X];
  const lz = [b.minZ - BR_Z, b.maxZ - BR_Z];
  const apart = lz[0] > BR_HALF || lz[1] < -BR_HALF || lx[0] > BR_HALF || lx[1] < -BR_HALF;
  const inSector = sectors.some((s) => lx[0] < s.maxX && lx[1] > s.minX && lz[0] < s.maxZ && lz[1] > s.minZ);
  const node = baked[L.chunk];
  const drawn = !!node && node.min[0] < lx[0] && node.max[0] > lx[1] && node.min[2] < lz[0] && node.max[2] > lz[1];
  check("THE GULAG: past the battle royale's edge and every sector, baked as its own node, and the Gulag's map", apart && !inSector && drawn && brJson.gulag.map === m.id, `x ${lx.map((v) => v.toFixed(0)).join(" to ")}, z ${lz.map((v) => v.toFixed(0)).join(" to ")}, map ${brJson.gulag.map}${node ? "" : "; not baked"}`);
  const r = MOVE.radius + 0.1;
  const eye = MOVE.standHeight - 0.1;
  const solidAt = (x: number, z: number, y: number) => solidsIn(x, x, z, z).some((q) => q.minX <= x && q.maxX >= x && q.minZ <= z && q.maxZ >= z && q.base <= y && q.top >= y);
  const gaps: string[] = [];
  for (let x = b.minX + 0.25; x < b.maxX; x += 0.5) for (const z of [b.minZ - 0.25, b.maxZ + 0.25]) if (![0.4, eye, 6.7].every((y) => solidAt(x, z, y))) gaps.push(`${(x - BR_X).toFixed(1)}, ${(z - BR_Z).toFixed(1)}`);
  for (let z = b.minZ + 0.25; z < b.maxZ; z += 0.5) for (const x of [b.minX - 0.25, b.maxX + 0.25]) if (![0.4, eye, 6.7].every((y) => solidAt(x, z, y))) gaps.push(`${(x - BR_X).toFixed(1)}, ${(z - BR_Z).toFixed(1)}`);
  check("THE GULAG: a wall 6.7 m high along every side", gaps.length === 0, gaps.length ? `${gaps.length} gaps, first at ${gaps.slice(0, 3).join("; ")}` : `${(2 * (b.maxX - b.minX + b.maxZ - b.minZ)).toFixed(0)} m of wall`);
  const held = m.spawns.filter(({ x, z }) => floorAt(x, z) !== 0 || solidsIn(x - r, x + r, z - r, z + r).some((q) => q.minX < x + r && q.maxX > x - r && q.minZ < z + r && q.maxZ > z - r && q.top > 0.3 && q.base < 1.8));
  const [p, q] = m.spawns;
  let cut = false;
  for (let k = 1, n = Math.ceil(Math.hypot(q.x - p.x, q.z - p.z) / 0.25); k < n && !cut; k++) cut = solidAt(p.x + ((q.x - p.x) * k) / n, p.z + ((q.z - p.z) * k) / n, eye);
  const ahead = m.spawns.map((s) => {
    const y = (s.yaw * Math.PI) / 180;
    let d = 0;
    while (d < 30 && !solidAt(s.x - Math.sin(y) * d, s.z - Math.cos(y) * d, eye)) d += 0.25;
    return d;
  });
  check("THE GULAG: its two spawns each with a body's room on the ground, out of each other's sight, each facing 6 m of open floor and more", m.spawns.length === 2 && held.length === 0 && cut && ahead.every((d) => d >= 6), `held ${held.length}, cut ${cut}, ahead ${ahead.map((d) => d.toFixed(1)).join(", ")} m`);
  // the ledge's two levels: the top as the solids have it under the flag, the lower level's halfway out to an end
  const c = m.center;
  const topAt = (x: number, z: number) => Math.max(0, ...solidsIn(x, x, z, z).filter((s) => s.minX <= x && s.maxX >= x && s.minZ <= z && s.maxZ >= z && s.top < 8).map((s) => s.top));
  const top = topAt(c.x, c.z);
  const lower = topAt(c.x - 5, c.z + 2);
  const roomOver = !solidsIn(c.x - r, c.x + r, c.z - r, c.z + r).some((s) => s.minX < c.x + r && s.maxX > c.x - r && s.minZ < c.z + r && s.maxZ > c.z - r && s.base < top + MOVE.standHeight && s.top > top + 0.05);
  const ring: number[] = [];
  for (let a = 0; a < 16; a++) ring.push(topAt(c.x + Math.cos((a * Math.PI) / 8) * (brJson.gulag.flagRadius - 0.3), c.z + Math.sin((a * Math.PI) / 8) * (brJson.gulag.flagRadius - 0.3)));
  const jump = MOVE.jumpHeight;
  const dj = jump + EXTRA.doubleJump.height;
  check(
    "THE GULAG: the ledge's top under the flag where the game has it, a jump over its lower level, a jump over the street, the top a jump and a double jump over it, a body's room over the flag and its circle on the top",
    m.ledge !== undefined && Math.abs(top - m.ledge.y) < 0.05 && Math.abs((L.ledge?.y ?? -1) - top) < 0.05 && lower > 0.5 && lower <= jump && top - lower <= jump && top > jump && top <= dj && roomOver && ring.every((y) => Math.abs(y - top) < 0.05),
    `top ${top.toFixed(2)} m (the game ${m.ledge?.y}), lower ${lower.toFixed(2)} m, a jump ${jump.toFixed(2)}, with a double jump ${dj.toFixed(2)}, room ${roomOver}, the circle ${[...new Set(ring.map((y) => y.toFixed(2)))].join("/")}`
  );
  // from the top, a standing eye at its edge nearest the spot: the street's floor seen at every half metre along both long
  // walls' foot, but behind the walls before the spawns
  let seen = 0;
  const hidden: string[] = [];
  for (let x = b.minX + 1; x < b.maxX; x += 0.5)
    for (const z of [b.minZ + 1, b.maxZ - 1]) {
      const from = new THREE.Vector3(c.x + Math.max(-2.5, Math.min(2.5, x - c.x)), top + eye, c.z + Math.sign(z - c.z) * 2.5);
      const n = Math.ceil(from.distanceTo(new THREE.Vector3(x, 0.3, z)) / 0.2);
      let blocked = false;
      for (let k = 1; k < n && !blocked; k++) {
        const t = k / n;
        blocked = solidAt(from.x + (x - from.x) * t, from.z + (z - from.z) * t, from.y + (0.3 - from.y) * t);
      }
      if (blocked) hidden.push(`${(x - c.x).toFixed(1)}, ${(z - c.z).toFixed(1)}`);
      else seen++;
    }
  check("THE GULAG: from the top a standing eye sees the street's floor along both long walls past all of the cover (most of it, the walls before the spawns hide their own corners)", seen / (seen + hidden.length) > 0.85, `${seen} of ${seen + hidden.length} spots seen${hidden.length ? `; hidden ${hidden.slice(0, 6).join("; ")}` : ""}`);
  // a bot from each way up, straight to the flag
  const walks = (m.ledge?.ways ?? []).map((w) => botWalk(w.x, w.z, 0, c.x, c.z));
  check("THE GULAG: a bot's straight walk from each way up (it cannot jump) climbs the stairs to the flag on the top", walks.length === 2 && walks.every((w) => w.ok && Math.abs(w.y - top) < 0.05), walks.map((w) => `${w.ok ? "up" : `stopped at ${(w.x - c.x).toFixed(1)}, ${(w.z - c.z).toFixed(1)}`} at ${w.y.toFixed(2)} m`).join("; "));
}

// The tower's express lifts (rules.tower.express; the owner, 2026-10-09: "express lifts and three new levels up to the
// crown, with multiple ways to get up"), off the bake's collision: each rope's column, a rider's radius and a hand round
// its line, clear of every box from over the 45.5 m floor to its top (a rider meeting anything is thrown off the rope, and
// a hole closed in the collision is a ceiling to them); the floor under its foot; floor all round its hole at each level
// to step off onto, a metre out from the hole; and its top over the penthouse's floor by a lift's height
{
  const TWx = (cfg as unknown as { tower: { express?: { at: number[][]; from: number; to: number; hole: number }; levels?: Array<{ floor: { at: number } }> } }).tower;
  const EX = TWx.express;
  const ropes = ((cfg as unknown as { express?: Array<{ rope: number[][] }> }).express ?? []);
  const r = MOVE.radius + 0.1;
  const boxesAt = (x: number, z: number, h: number) => solidsIn(x + BR_X - h, x + BR_X + h, z + BR_Z - h, z + BR_Z + h).filter((b) => b.minX < x + BR_X + h && b.maxX > x + BR_X - h && b.minZ < z + BR_Z + h && b.maxZ > z + BR_Z - h);
  const each = (EX?.at ?? []).map(([x, z], i) => {
    const rope = ropes[i];
    const y0 = EX!.from + 0.2, y1 = rope ? rope.rope[1][1] : 0;
    const inWay = boxesAt(x, z, r).filter((b) => b.top > y0 && b.base < y1);
    const foot = boxesAt(x, z, 0.05).some((b) => Math.abs(b.top - EX!.from) < 0.1) || Math.abs(floorAt(x + BR_X, z + BR_Z) - EX!.from) < 0.1;
    const out = EX!.hole / 2 + 1;
    const ringAt = (y: number) => [[x - out, z], [x + out, z], [x, z - out], [x, z + out]].filter(([qx, qz]) => boxesAt(qx, qz, 0.05).some((b) => Math.abs(b.top - y) < 0.1)).length;
    const rings = (TWx.levels ?? []).map((q) => ringAt(q.floor.at));
    const crown = ringAt(EX!.to);
    const over = rope ? rope.rope[1][1] - EX!.to : 0;
    return { x, z, inWay: inWay.map((b) => `${(b.base).toFixed(2)} to ${b.top.toFixed(2)}`), foot, rings, crown, over: +over.toFixed(2) };
  });
  check(
    "the tower's express lifts: each rope's column clear from its foot on the 45.5 m floor to its top, floor round its hole on every level, its top a lift's height over the penthouse's floor",
    !!EX && each.length === 2 && ropes.length === 2 && each.every((q) => q.inWay.length === 0 && q.foot && q.rings.length === 3 && q.rings.every((n) => n >= 3) && q.over > 2.3 && q.over < 2.7),
    each.map((q) => `(${q.x}, ${q.z}): ${q.inWay.length ? `in the way ${q.inWay.slice(0, 3).join(", ")}` : "clear"}, foot ${q.foot}, round its holes ${q.rings.join("/")} of 4, top ${q.over} m over the penthouse`).join("; "),
  );
}

// The express lifts ridden by a player's own movement, non-stop between the 45.5 m sky floor and the penthouse: from the
// 45.5 m floor, facing the rope a metre off it, interact, ridden up the whole way and put off onto the penthouse's floor
// past its barrier; from the penthouse, from outside the barrier looking at the rope level, ridden down and let off at its
// foot on the 45.5 m floor; and from each level between, from outside its barrier looking a little up, ridden up to the
// penthouse (jumping off at a level on the way, riding at 12 m/s, has under 0.2 s between clearing the barrier and the
// head meeting the ceiling, whose hole then lifted the body onto the ceiling's top in the hollow over the level)
{
  const EXr = (cfg as unknown as { tower: { express?: { at: number[][]; from: number; to: number }; levels?: Array<{ floor: { at: number } }> } }).tower;
  const between = (EXr.levels ?? []).map((q) => q.floor.at).filter((h) => h < EXr.express!.to);
  const ride = (x: number, z: number, off: number[], from: number, pitch: number) => {
    const p = new Player({ minX: BR_X - 400, maxX: BR_X + 400, minZ: BR_Z - 400, maxZ: BR_Z + 400 });
    p.teleport(x + off[0] + BR_X, from + 0.05, z + off[1] + BR_Z, (Math.atan2(off[0], off[1]) * 180) / Math.PI);
    p.pitch = pitch;
    let [t, tap] = [1000, false];
    const input = { held: (_a: Action) => false, pressedNow: (a: Action) => tap && a === "interact" };
    const step = () => p.update(1 / 144, (t += 1 / 144), input, 0, 1, false);
    for (let i = 0; i < 36; i++) step();
    tap = true;
    step();
    tap = false;
    const rode = p.stance === "zip";
    for (let i = 0; i < 144 * 12 && p.stance === "zip"; i++) step();
    for (let i = 0; i < 144 * 3; i++) step();
    return { rode, y: p.pos.y, d: Math.hypot(p.pos.x - BR_X - x, p.pos.z - BR_Z - z) };
  };
  // (from the side away from the room's faces, the NW rope's east and the SE rope's west: a metre off it on the 45.5 m floor,
  // which has no barrier, and 2.2 m off from outside the barrier on the levels)
  const sides = [[1, 0], [-1, 0]];
  const runs = (EXr.express?.at ?? []).map(([x, z], i) => {
    const [ox, oz] = sides[i];
    return {
      up: ride(x, z, [ox, oz], EXr.express!.from, 0),
      down: ride(x, z, [ox * 2.2, oz * 2.2], EXr.express!.to, 0),
      ons: between.map((h) => ({ h, r: ride(x, z, [ox * 2.2, oz * 2.2], h, 20) })),
    };
  });
  const top = EXr.express!.to, foot = EXr.express!.from;
  check(
    "the tower's express lifts: each ridden up from the 45.5 m floor and put off onto the penthouse's floor past its barrier, down from the penthouse to the 45.5 m floor, and up from each level between, by a player",
    runs.length === 2 && between.length === 2 && runs.every((q) => q.up.rode && Math.abs(q.up.y - top) < 0.15 && q.up.d > 1.7 && q.down.rode && Math.abs(q.down.y - foot) < 0.15 && q.ons.every((l) => l.r.rode && Math.abs(l.r.y - top) < 0.15 && l.r.d > 1.7)),
    runs.map((q, i) => `rope ${i + 1}: up ${q.up.rode ? "rode" : "no grab"}, off at ${q.up.y.toFixed(2)} m ${q.up.d.toFixed(1)} m out; down ${q.down.rode ? "rode" : "no grab"}, off at ${q.down.y.toFixed(2)} m; ${q.ons.map((l) => `from ${l.h} m ${l.r.rode ? "rode" : "no grab"}, off at ${l.r.y.toFixed(2)}`).join(", ")}`).join("; "),
  );
}

// LANTERN ALLEYS (rules.districts.lantern, the north-east district): its houses in the sector's band past the ring road
// and its pavement, none in another or across a main alley; each main alley walked end to end by a body, and each row's
// cross alley through it (nothing standing from under a head to over a step within a body's reach), and the lantern
// lines over the main alleys
{
  type Row = { id: string; from: number[]; to: number[]; front: number[]; deep: number; skip?: number[][] };
  const DL = (cfg.rules as unknown as { districts?: { lantern?: { rows: Row[]; lights: { alleys: Array<{ from: number[]; to: number[]; half: number }> } } } }).districts?.lantern;
  const LA = (cfg as unknown as { lanternAlleys?: { houses: Array<{ c: number[]; yaw: number; hu: number; hv: number }>; lanterns: number } }).lanternAlleys;
  const ne = (cfg.game as unknown as { sectors: Array<{ id: string; minX: number; maxX: number; minZ: number; maxZ: number }> }).sectors.find((q) => q.id === "ne")!;
  const ring = (cfg.rules as unknown as { ring: number[] }).ring[1] + 2.5;
  // (each house's footprint: its turns are quarter turns, so its box is axis-aligned)
  const foot = (h: { c: number[]; yaw: number; hu: number; hv: number }) => {
    const side = Math.abs(Math.round(h.yaw / 90)) % 2 === 1;
    const [ex, ez] = side ? [h.hv, h.hu] : [h.hu, h.hv];
    return [h.c[0] - ex, h.c[0] + ex, h.c[1] - ez, h.c[1] + ez];
  };
  const houses = (LA?.houses ?? []).map(foot);
  // (a row along the fence stands `past` metres past it at most, on the map's own ground, Milestone 1066: only on the map's
  // edge, not into the next sector)
  const past = (DL as unknown as { past?: number } | undefined)?.past ?? 0;
  const strayed = houses.filter(([x0, x1, z0, z1]) => x0 < ne.minX || x1 > ne.maxX + (ne.maxX >= BR_HALF ? past : 0) || z0 < ne.minZ - (ne.minZ <= -BR_HALF ? past : 0) || z1 > ne.maxZ || !(x0 >= ring || z1 <= -ring));
  const overlaps = houses.flatMap((a, i) => houses.slice(i + 1).filter((b) => a[0] < b[1] - 0.01 && a[1] > b[0] + 0.01 && a[2] < b[3] - 0.01 && a[3] > b[2] + 0.01).map(() => i));
  const alleys = DL?.lights.alleys ?? [];
  const onAlley = houses.filter(([x0, x1, z0, z1]) => alleys.some((al) => {
    const ns = al.from[0] === al.to[0];
    const [ax0, ax1, az0, az1] = [Math.min(al.from[0], al.to[0]) - (ns ? al.half : 0), Math.max(al.from[0], al.to[0]) + (ns ? al.half : 0), Math.min(al.from[1], al.to[1]) - (ns ? 0 : al.half), Math.max(al.from[1], al.to[1]) + (ns ? 0 : al.half)];
    return x0 < ax1 - 0.01 && x1 > ax0 + 0.01 && z0 < az1 - 0.01 && z1 > az0 + 0.01;
  }));
  check("LANTERN ALLEYS: a dozen houses and more in the north-east band past the ring road, none in another or across a main alley", houses.length >= 12 && strayed.length === 0 && overlaps.length === 0 && onAlley.length === 0, `${houses.length} houses, ${strayed.length} out of the band, ${overlaps.length} overlapping, ${onAlley.length} on an alley`);
  // a body's way: at each half metre, nothing within its reach standing from under its head to over its step
  const R0 = MOVE.radius;
  const blockedAt = (x: number, z: number) => solidsIn(x - R0 + BR_X, x + R0 + BR_X, z - R0 + BR_Z, z + R0 + BR_Z).some((q) => q.minX < x + R0 + BR_X && q.maxX > x - R0 + BR_X && q.minZ < z + R0 + BR_Z && q.maxZ > z - R0 + BR_Z && q.base < MOVE.standHeight && q.top > MOVE.stepHeight);
  const walk = (a: number[], b: number[]) => {
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    for (let k = 0; k <= L; k += 0.5) {
      const [x, z] = [a[0] + ((b[0] - a[0]) * k) / L, a[1] + ((b[1] - a[1]) * k) / L];
      if (blockedAt(x, z)) return `(${x.toFixed(1)}, ${z.toFixed(1)})`;
    }
    return "";
  };
  const shut: string[] = [];
  for (const al of alleys) {
    const w = walk(al.from, al.to);
    if (w) shut.push(`main alley at ${w}`);
  }
  for (const row of DL?.rows ?? []) {
    const L = Math.hypot(row.to[0] - row.from[0], row.to[1] - row.from[1]);
    const t = [(row.to[0] - row.from[0]) / L, (row.to[1] - row.from[1]) / L];
    for (const [s0, s1] of row.skip ?? []) {
      const m = (s0 + s1) / 2;
      const p = [row.from[0] + t[0] * m, row.from[1] + t[1] * m];
      const w = walk([p[0] + row.front[0], p[1] + row.front[1]], [p[0] - row.front[0] * (row.deep + 1), p[1] - row.front[1] * (row.deep + 1)]);
      if (w) shut.push(`row ${row.id}'s cross alley at ${w}`);
    }
  }
  check("LANTERN ALLEYS: each main alley walked end to end, and each row's cross alley through it", alleys.length === 2 && shut.length === 0, shut.join("; ") || `${alleys.length} alleys, ${(DL?.rows ?? []).reduce((n, r) => n + (r.skip?.length ?? 0), 0)} cross alleys`);
  check("LANTERN ALLEYS: lanterns over its main alleys", (LA?.lanterns ?? 0) >= 200, `${LA?.lanterns ?? 0} lanterns`);
}

// THE TERRACES (rules.districts.terraces, the west district): its squares in the west band past the ring road and
// between its two roads; each tier solid (a body dropped on each square rests on its top, none sinks into a tier or
// stands inside one); each way up walked by a player from the promenade to the top tier and back down; every edge with
// a drop railed, a rail standing over it that a body cannot step through, but where a ramp arrives; the gardens on it;
// and its name on the gate at the head of the grand stair seen from the ring road
{
  type TRule = { cell: number; z: number[]; ramp: { up: number[]; cells: number[][] }; walks: Record<string, number[][]>; name: { at: number[]; w: number; h: number } };
  const DT = (cfg.rules as unknown as { districts?: { terraces?: TRule } }).districts?.terraces;
  const TC = (cfg as unknown as { terraces?: { cells: number[][]; rise: number; trees: number; flowers: number; ferns: number; benches: number; lamps: number } }).terraces;
  const wSec = (cfg.game as unknown as { sectors: Array<{ id: string; minX: number; maxX: number; minZ: number; maxZ: number }> }).sectors.find((q) => q.id === "w")!;
  const ring = (cfg.rules as unknown as { ring: number[] }).ring[1] + 2.5;
  const S = DT?.cell ?? 5;
  const cells = TC?.cells ?? [];
  // (the grid starts half a metre past the fence, its first column's walls standing in the map's margin)
  const strayed = cells.filter(([x0, z0]) => x0 < wSec.minX - 0.51 || x0 + S > -ring + 0.01 || z0 < DT!.z[0] - 0.01 || z0 + S > DT!.z[1] + 0.01 || z0 < wSec.minZ || z0 + S > wSec.maxZ);
  const raised = cells.filter((c) => c[2] > 0 || c[3]);
  check("THE TERRACES: its tiers in the west band past the ring road and its pavement, between the two roads, three storeys and twenty-one ramps", !!DT && raised.length >= 90 && strayed.length === 0 && new Set(cells.filter((c) => !c[3] && c[2] > 0).map((c) => c[2])).size === 3 && cells.filter((c) => c[3]).length === 21, `${raised.length} squares raised, ${cells.filter((c) => c[3]).length} ramps, ${strayed.length} out of the band`);
  // a body dropped 2 m over each square's middle (over whatever stands there: the blocks on the top tier): on a tier it
  // rests on the top or on what stands there, never lower, on a ramp between its foot and its head
  const sunk: string[] = [];
  for (const [x0, z0, top, ramp] of raised) {
    const p = new Player({ minX: BR_X - 400, maxX: BR_X + 400, minZ: BR_Z - 400, maxZ: BR_Z + 400 });
    const [cx, cz] = [x0 + S / 2 + BR_X, z0 + S / 2 + BR_Z];
    const r = MOVE.radius;
    const over = solidsIn(cx - r, cx + r, cz - r, cz + r).reduce((h, q) => (q.minX < cx + r && q.maxX > cx - r && q.minZ < cz + r && q.maxZ > cz - r && q.top < 40 && q.top > h ? q.top : h), 0);
    const y0 = Math.max(top + (ramp ? TC!.rise : 0), over);
    p.teleport(cx, y0 + 2, cz, 0);
    let t = 1000;
    for (let i = 0; i < 2 * 144; i++) p.update(1 / 144, (t += 1 / 144), idle, 0, 1, false);
    const ok = ramp ? p.pos.y > top + 0.05 && p.pos.y < top + TC!.rise + 0.05 : p.pos.y > top - 0.05;
    if (!ok) sunk.push(`(${x0}, ${z0}) at ${p.pos.y.toFixed(2)} m of ${top}${ramp ? "+" : ""}`);
  }
  check("THE TERRACES: a body dropped on each square of its tiers and ramps rests on it, none sunk into a tier", raised.length > 0 && sunk.length === 0, sunk.slice(0, 6).join("; ") || `${raised.length} squares`);
  // each way up walked by a player: from the promenade up its ramps and landings to the top tier, and back down
  const ways = Object.entries(DT?.walks ?? {}).filter(([n]) => n !== "roofs");
  const failed: string[] = [];
  for (const [name, route] of ways) {
    const up = along(route);
    const down = along([...route].reverse());
    if (up.k !== route.length || down.k !== route.length) failed.push(`${name}: up ${up.k - 1} of ${route.length - 1} legs to (${up.x.toFixed(1)}, ${up.z.toFixed(1)}) at ${up.y.toFixed(2)} m, down ${down.k - 1} to (${down.x.toFixed(1)}, ${down.z.toFixed(1)}) at ${down.y.toFixed(2)} m`);
  }
  check("THE TERRACES: a player walks up the grand stair and each side's ramps from the promenade to the top tier, and back down", ways.length === 3 && failed.length === 0, failed.join("; ") || ways.map(([n, r]) => `${n} ${r.length - 1} legs`).join(", "));
  // the rails: on each edge of a tier square over a drop (to the ground past the band, to a lower tier or into a ramp's
  // slot), but the one a ramp arrives at, something standing on the tier at the edge from under a step to over a waist
  const at = new Map(cells.map((c) => [`${c[0]},${c[1]}`, c]));
  const [ux, uz] = DT?.ramp.up ?? [-1, 0];
  const low = (x0: number, z0: number) => at.get(`${x0},${z0}`)?.[2] ?? 0;
  const open: string[] = [];
  let edges = 0;
  for (const [x0, z0, top, ramp] of raised) {
    if (ramp) continue;
    for (const [nx, nz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const [ax, az] = [x0 + nx * S, z0 + nz * S];
      const n = at.get(`${ax},${az}`);
      if (n?.[3] && ax + ux * S === x0 && az + uz * S === z0) continue;
      if (low(ax, az) >= top - 0.5) continue;
      edges++;
      // (along the edge, at its middle and a metre each way, a quarter metre in from it)
      const hit = [-1, 0, 1].every((s) => {
        const [px, pz] = [x0 + S / 2 + nx * (S / 2 - 0.25) + Math.abs(nz) * s, z0 + S / 2 + nz * (S / 2 - 0.25) + Math.abs(nx) * s];
        return solidsIn(px - 0.3 + BR_X, px + 0.3 + BR_X, pz - 0.3 + BR_Z, pz + 0.3 + BR_Z).some((q) => q.minX < px + 0.3 + BR_X && q.maxX > px - 0.3 + BR_X && q.minZ < pz + 0.3 + BR_Z && q.maxZ > pz - 0.3 + BR_Z && q.base < top + MOVE.stepHeight && q.top > top + 0.9);
      });
      if (!hit) open.push(`(${x0}, ${z0}) toward (${nx}, ${nz})`);
    }
  }
  check("THE TERRACES: every edge of its tiers over a drop railed, a body kept from walking off, but where a ramp arrives", edges >= 50 && open.length === 0, open.slice(0, 6).join("; ") || `${edges} edges`);
  // (the counts are what the layout lays less what the rooms' openings took since Milestone 586: none stands in a room's
  // way, so a room's wall square has neither the cypress at its edge nor the flower planter at its middle)
  check("THE TERRACES: its gardens: cypresses at the walls' feet, on the top tier and along both roads, flower planters, fern planters and benches as cover, lamps by the grand stair's landings", (TC?.trees ?? 0) >= 12 && (TC?.flowers ?? 0) >= 10 && (TC?.ferns ?? 0) + (TC?.benches ?? 0) >= 12 && (TC?.lamps ?? 0) >= 4, `${TC?.trees ?? 0} cypresses, ${TC?.flowers ?? 0} flower planters, ${TC?.ferns ?? 0} ferns, ${TC?.benches ?? 0} benches, ${TC?.lamps ?? 0} lamps`);
  // its name: from the middle of the ring road's west side at a standing eye, a clear line to the plate's middle and near both ends
  const N = DT?.name;
  const roadMid = ((cfg.rules as unknown as { ring: number[] }).ring[0] + (cfg.rules as unknown as { ring: number[] }).ring[1]) / 2;
  const blocked: string[] = [];
  const inBox = (x: number, y: number, z: number) => solidsIn(x - 0.01 + BR_X, x + 0.01 + BR_X, z - 0.01 + BR_Z, z + 0.01 + BR_Z).some((q) => q.minX <= x + BR_X && q.maxX >= x + BR_X && q.minZ <= z + BR_Z && q.maxZ >= z + BR_Z && q.base < y && q.top > y);
  for (const ez of [-10, 0, 10])
    for (const t of N ? [-N.w / 2 + 0.5, 0, N.w / 2 - 0.5] : []) {
      const [a, b] = [[-roadMid, 1.7, ez], [N!.at[0] + 0.3, N!.at[1], N!.at[2] + t]];
      const L = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
      for (let k = 0; k < L; k += 0.25) {
        const f = k / L;
        const p = [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
        if (inBox(p[0], p[1], p[2])) {
          blocked.push(`from z ${ez} to ${t.toFixed(1)} at (${p.map((v) => v.toFixed(1)).join(", ")})`);
          break;
        }
      }
    }
  const named = ((cfg as unknown as { districtNames?: Array<{ district: string }> }).districtNames ?? []).some((q) => q.district === "terraces");
  check("THE TERRACES: its name on the gate at the head of the grand stair, seen from the ring road", named && !!N && blocked.length === 0, blocked.slice(0, 4).join("; ") || "9 sight lines clear");
}

// THE TERRACES' blocks on the top tier (rules.districts.terraces.blocks, Milestone 585): five along the fence, none in
// another, a jump apart, their roofs stepping a storey up to the middle; the run along them climbed and dropped by a
// player with SpeedKills' moves (a wall a storey high climbed by running into it, a gap jumped from the roof's edge onto
// the next one's wall); each roof's long sides and the band's ends railed; each balcony standing a body
{
  type BRule = { x: number[]; rows: number[][] };
  const TB = (cfg.rules as unknown as { districts?: { terraces?: { blocks?: BRule; walks: Record<string, number[][]> } } }).districts?.terraces;
  const BK = TB?.blocks;
  const TO = (cfg as unknown as { terraces?: { balconies?: number[][] } }).terraces;
  const rows = [...(BK?.rows ?? [])].sort((a, b) => a[0] - b[0]);
  const gaps = rows.slice(1).map((r, i) => r[0] - rows[i][1]);
  const mid = rows.reduce((a, r, i) => (r[2] > rows[a][2] ? i : a), 0);
  const steps = rows.every((r, i) => i === mid || Math.abs(Math.abs(r[2] - rows[i < mid ? i + 1 : i - 1][2]) - 3) < 0.01);
  check("THE TERRACES: five blocks on the top tier along the fence, none in another, each a jump from the next (0.75 to 2 m), their roofs a storey apart stepping up to the middle", rows.length === 5 && gaps.every((g) => g >= 0.75 && g <= 2) && steps && (BK?.x[0] ?? 0) >= -152.51, `${rows.map((r) => `${r[0]} to ${r[1]} at ${r[2]} m`).join(", ")}; gaps ${gaps.join(", ")} m`);
  // (the highest floor at a point no higher than a step over `y`)
  const floorUnder = (x: number, z: number, y: number) => solidsIn(x + BR_X, x + BR_X, z + BR_Z, z + BR_Z).reduce((f, q) => (q.minX <= x + BR_X && q.maxX >= x + BR_X && q.minZ <= z + BR_Z && q.maxZ >= z + BR_Z && q.top <= y + MOVE.stepHeight && q.top > f ? q.top : f), 0);
  const climbRun = (pts: number[][]): { k: number; at: string } => {
    const p = new Player({ minX: BR_X - 400, maxX: BR_X + 400, minZ: BR_Z - 400, maxZ: BR_Z + 400 });
    p.sprintMode = "auto";
    p.extraMoves = true;
    p.autoClimb = true;
    p.teleport(pts[0][0] + BR_X, pts[0][2] + 0.05, pts[0][1] + BR_Z, 0);
    let t = 1000, k = 1, legT = 0;
    for (let i = 0; i < 144; i++) p.update(1 / 144, (t += 1 / 144), idle, 0, 1, false);
    for (let i = 0; i < 90 * 144 && k < pts.length; i++) {
      const [tx, tz, ty] = pts[k];
      const here = [p.pos.x - BR_X, p.pos.z - BR_Z];
      if (Math.hypot(tx - here[0], tz - here[1]) < 0.8 && Math.abs(p.pos.y - ty) < 0.4 && p.onGround) {
        (k++), (legT = 0);
        continue;
      }
      if ((legT += 1 / 144) > 12) break;
      const [dx, dz] = [tx - here[0], tz - here[1]];
      const L = Math.hypot(dx, dz) || 1;
      p.yaw = (Math.atan2(-dx, -dz) * 180) / Math.PI;
      // (bound for a higher roof across a gap: a jump where the roof gives out 0.7 m ahead)
      const leap = p.onGround && ty > p.pos.y + 1 && floorUnder(here[0] + (dx / L) * 0.7, here[1] + (dz / L) * 0.7, p.pos.y) < p.pos.y - 1;
      p.update(1 / 144, (t += 1 / 144), { held: (a: Action) => a === "forward" || (a === "jump" && leap), pressedNow: (a: Action) => a === "jump" && leap }, 0, 1, false);
    }
    return { k, at: `(${(p.pos.x - BR_X).toFixed(1)}, ${p.pos.y.toFixed(2)}, ${(p.pos.z - BR_Z).toFixed(1)})` };
  };
  const route = TB?.walks.roofs ?? [];
  const run = climbRun(route);
  check("THE TERRACES: a player climbs from the top tier onto the first block, jumps each gap up onto the next block to the top roof, then drops roof to roof to the last and down into its gap and out", route.length > 4 && run.k === route.length, `${run.k - 1} of ${route.length - 1} legs, at ${run.at}`);
  // the roofs' rails: along each long side, and the band's two ends, as the tiers' (a body kept from walking off)
  const open: string[] = [];
  let edges = 0;
  for (const [i, [z0, z1, top]] of rows.entries()) {
    const sides: Array<[number, number, number, number]> = [];
    for (let z = z0 + 2.5; z < z1; z += 5) sides.push([BK!.x[1] - 0.25, z, 1, 0], [BK!.x[0] + 0.25, z, -1, 0]);
    if (i === 0) for (let x = BK!.x[0] + 2.5; x < BK!.x[1]; x += 5) sides.push([x, z0 + 0.25, 0, -1]);
    if (i === rows.length - 1) for (let x = BK!.x[0] + 2.5; x < BK!.x[1]; x += 5) sides.push([x, z1 - 0.25, 0, 1]);
    for (const [px, pz] of sides) {
      edges++;
      const hit = solidsIn(px - 0.3 + BR_X, px + 0.3 + BR_X, pz - 0.3 + BR_Z, pz + 0.3 + BR_Z).some((q) => q.minX < px + 0.3 + BR_X && q.maxX > px - 0.3 + BR_X && q.minZ < pz + 0.3 + BR_Z && q.maxZ > pz - 0.3 + BR_Z && q.base < top + MOVE.stepHeight && q.top > top + 0.9);
      if (!hit) open.push(`(${px}, ${pz}) at ${top} m`);
    }
  }
  check("THE TERRACES: each block's roof railed along its long sides, and the band's two ends, open across the gaps", rows.length === 5 && open.length === 0, open.slice(0, 6).join("; ") || `${edges} edges`);
  // each balcony: a body dropped on it rests on its floor
  const off: string[] = [];
  for (const [bx, bz, by] of TO?.balconies ?? []) {
    const p = new Player({ minX: BR_X - 400, maxX: BR_X + 400, minZ: BR_Z - 400, maxZ: BR_Z + 400 });
    p.teleport(bx + 1.2 + BR_X, by + 1.5, bz + BR_Z, 0);
    let t = 1000;
    for (let i = 0; i < 2 * 144; i++) p.update(1 / 144, (t += 1 / 144), idle, 0, 1, false);
    if (Math.abs(p.pos.y - by) > 0.3) off.push(`(${bx}, ${bz}) at ${p.pos.y.toFixed(2)} m of ${by}`);
  }
  check("THE TERRACES: the blocks' balconies, one each storey over the first on their street faces, each standing a body", (TO?.balconies?.length ?? 0) >= 4 && off.length === 0, off.join("; ") || `${TO?.balconies?.length ?? 0} balconies`);
}

// THE TERRACES' rooms (rules.districts.terraces.rooms, Milestone 586): each walked into by a player from the tier before
// it to its middle, under its slab, and back out (a body drops onto the tier over it in the squares' check)
{
  const TR = (cfg as unknown as { terraces?: { rooms?: number[][] } }).terraces?.rooms ?? [];
  const shut: string[] = [];
  for (const [x0, z0, floor] of TR) {
    const route = [[x0 + 7, z0 + 2.5, floor], [x0 + 2.5, z0 + 2.5, floor]];
    const inn = along(route);
    const out = along([...route].reverse());
    if (inn.k !== route.length || out.k !== route.length) shut.push(`(${x0}, ${z0}) at ${floor} m: in to (${inn.x.toFixed(1)}, ${inn.z.toFixed(1)}) at ${inn.y.toFixed(2)}, out to (${out.x.toFixed(1)}, ${out.z.toFixed(1)})`);
  }
  check("THE TERRACES: six rooms in its tiers' street walls, two a tier, each walked into from the tier before it and back out by a player", TR.length === 6 && new Set(TR.map((q) => q[2])).size === 3 && shut.length === 0, shut.join("; ") || `${TR.length} rooms`);
}

// THE TERMINAL (rules.districts.terminal, the south district): its halls in a row in the south band past the ring road
// and its pavement, between the two roads; in each a body dropped by its north arcade stands on its floor at the street,
// and a player walks into each from the forecourt through the arcade and back out; its name over the arcade seen from
// the ring road
{
  type HRule = { name: { at: number[]; w: number; h: number } };
  const TH = (cfg.rules as unknown as { districts?: { terminal?: HRule } }).districts?.terminal;
  const TO = (cfg as unknown as { terminal?: { halls: number[][]; box: number[] } }).terminal;
  const ring = (cfg.rules as unknown as { ring: number[] }).ring[1] + 2.5;
  const [X0, X1, Z0, Z1] = TO?.box ?? [0, 0, 0, 0];
  check("THE TERMINAL: six halls in a row in the south band past the ring road, between the two roads", (TO?.halls.length ?? 0) === 6 && X0 >= -30 && X1 <= 30 && Z0 >= ring && Z1 <= 152, `x ${X0} to ${X1}, z ${Z0} to ${Z1}`);
  const off: string[] = [];
  const shut: string[] = [];
  for (const [hx0, hx1, hz0] of TO?.halls ?? []) {
    const cx = (hx0 + hx1) / 2;
    const p = new Player({ minX: BR_X - 400, maxX: BR_X + 400, minZ: BR_Z - 400, maxZ: BR_Z + 400 });
    p.teleport(cx + BR_X, 2, hz0 + 2.5 + BR_Z, 0);
    let t = 1000;
    for (let i = 0; i < 2 * 144; i++) p.update(1 / 144, (t += 1 / 144), idle, 0, 1, false);
    if (Math.abs(p.pos.y) > 0.1) off.push(`(${cx}, ${hz0 + 2.5}) at ${p.pos.y.toFixed(2)} m`);
    // (past the forecourt's wagon where it stands before a hall, Milestone 888: its own check walks between it and the arcade)
    const FW = (cfg.rules as unknown as { districts: { terminal: { trains: { front?: { x: number; z: number } } } } }).districts.terminal.trains.front;
    const route = [[cx, FW && Math.abs(cx - FW.x) < 6 ? FW.z + 2.7 : hz0 - 6, 0], [cx, hz0 + 3, 0]];
    const inn = along(route);
    const out = along([...route].reverse());
    if (inn.k !== route.length || out.k !== route.length) shut.push(`at x ${cx}: in to (${inn.x.toFixed(1)}, ${inn.z.toFixed(1)}), out to (${out.x.toFixed(1)}, ${out.z.toFixed(1)})`);
  }
  check("THE TERMINAL: in each hall a body stands on its floor at the street, and a player walks in from the forecourt through the arcade and back out", (TO?.halls.length ?? 0) === 6 && off.length === 0 && shut.length === 0, [...off, ...shut].join("; ") || `${TO?.halls.length} halls`);
  // its name: from the middle of the ring road's south side at a standing eye, a clear line to the plate's middle and near
  // both ends
  const N = TH?.name;
  const roadMid = ((cfg.rules as unknown as { ring: number[] }).ring[0] + (cfg.rules as unknown as { ring: number[] }).ring[1]) / 2;
  const blocked: string[] = [];
  const inBox = (x: number, y: number, z: number) => solidsIn(x - 0.01 + BR_X, x + 0.01 + BR_X, z - 0.01 + BR_Z, z + 0.01 + BR_Z).some((q) => q.minX <= x + BR_X && q.maxX >= x + BR_X && q.minZ <= z + BR_Z && q.maxZ >= z + BR_Z && q.base < y && q.top > y);
  for (const ex of [-10, 0, 10])
    for (const t of N ? [-N.w / 2 + 0.5, 0, N.w / 2 - 0.5] : []) {
      const [a, b] = [[ex, 1.7, roadMid], [N!.at[0] + t, N!.at[1], N!.at[2] - 0.3]];
      const L = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
      for (let k = 0; k < L; k += 0.25) {
        const f = k / L;
        const p = [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
        if (inBox(p[0], p[1], p[2])) {
          blocked.push(`from x ${ex} to ${t.toFixed(1)} at (${p.map((v) => v.toFixed(1)).join(", ")})`);
          break;
        }
      }
    }
  const named = ((cfg as unknown as { districtNames?: Array<{ district: string }> }).districtNames ?? []).some((q) => q.district === "terminal");
  check("THE TERMINAL: its name over the arcade, seen from the ring road", named && !!N && blocked.length === 0, blocked.slice(0, 4).join("; ") || "9 sight lines clear");
}

// THE TERMINAL's trains (rules.districts.terminal.trains, Milestone 588): the metro train behind the station along its
// south arcade with its buffer stop past its front, and the trams on both strips clear of the bots' street lines; and
// a player walks out of each hall through its south arch onto the platform beside the train
{
  type TR = { metro: { piece: string; at: number[]; stop: string }; strips: Array<{ x: number; trams: number[][] }> };
  const T2 = (cfg.rules as unknown as { districts?: { terminal?: { trains?: TR } } }).districts?.terminal?.trains;
  const TO = (cfg as unknown as { terminal?: { box: number[]; trams?: number } }).terminal;
  const place = (cfg.chunks as unknown as Record<string, { place: unknown[][] }>)["c-terminal"]?.place ?? [];
  const has = (name?: string) => !!name && place.some((q) => String(q[0]).endsWith(`/${name}`));
  const lim = 152 - (cfg.game as unknown as { graph: { margin: number } }).graph.margin;
  const onLine = (v: number) => Math.abs((v + lim) / 10 - Math.round((v + lim) / 10)) * 10;
  const nearLine = (T2?.strips ?? []).filter((s) => onLine(s.x) < 1.25 + MOVE.radius + 0.2);
  check("THE TERMINAL: the metro train behind the station with its buffer stop, and four trams on rails along both strips, clear of the bots' street lines", !!T2 && has(T2.metro.piece) && has(T2.metro.stop) && (TO?.trams ?? 0) === 4 && nearLine.length === 0 && T2.metro.at[2] > (TO?.box[3] ?? 0), `${TO?.trams ?? 0} trams, ${nearLine.length} strips on a street line`);
  const Z1 = TO?.box[3] ?? 0;
  const shut: string[] = [];
  // (through the arch at each hall's middle: between them the south arcade is wall)
  for (const x of ((cfg as unknown as { terminal?: { halls: number[][] } }).terminal?.halls ?? []).map((h) => (h[0] + h[1]) / 2)) {
    const route = [[x, Z1 - 4, 0], [x, Z1 + 2.4, 0]];
    const w = along(route);
    if (w.k !== route.length) shut.push(`at x ${x}: to (${w.x.toFixed(1)}, ${w.z.toFixed(1)})`);
  }
  check("THE TERMINAL: a player walks out of the hall through its south arcade onto the platform beside the train, through each hall's arch", shut.length === 0, shut.join("; ") || "6 walks");
}

// the stairs run up at a sprint with SpeedKills' own moves (the double jump, the wall runs and the auto-climb, which the
// game turns on and the walks above leave off): the tower's stair core from the lobby to its top storey, and each of the
// base's stairs. No climb or mantle may start on a stair, and the body never rises half a metre over the flight it is
// on: on the core's landings, with the landing above overhead, running into the core's wall climbed it into that
// landing and the mantle off its edge lifted the body up through it (the owner, 2026-10-12: "i can glitch through
// stairs all the time when going up")
{
  const sprintUp = (pts: number[][]) => {
    const p = new Player({ minX: BR_X - 400, maxX: BR_X + 400, minZ: BR_Z - 400, maxZ: BR_Z + 400 });
    p.sprintMode = "auto";
    p.extraMoves = true;
    p.autoClimb = true;
    p.teleport(pts[0][0] + BR_X, pts[0][2] + 0.05, pts[0][1] + BR_Z, 0);
    const go = { held: (a: Action) => a === "forward", pressedNow: (_a: Action) => false };
    let t = 1000, k = 1, starts = 0, over = 0, last = "stand", at = "";
    for (let i = 0; i < 120 * 144 && k < pts.length; i++) {
      const [tx, tz, ty] = pts[k];
      const dx = tx - (p.pos.x - BR_X), dz = tz - (p.pos.z - BR_Z);
      if (Math.hypot(dx, dz) < 0.35 && Math.abs(p.pos.y - ty) < 1) {
        k++;
        continue;
      }
      p.yaw = (Math.atan2(-dx, -dz) * 180) / Math.PI;
      p.update(1 / 144, (t += 1 / 144), go, 0, 1, false);
      const st = p.stance;
      if (st !== last && (st === "climb" || st === "mantle")) {
        starts++;
        if (!at) at = `${st} at (${(p.pos.x - BR_X).toFixed(1)}, ${p.pos.y.toFixed(1)}, ${(p.pos.z - BR_Z).toFixed(1)})`;
      }
      last = st;
      over = Math.max(over, p.pos.y - Math.max(pts[k - 1][2], ty));
    }
    return { k, n: pts.length, starts, over, at };
  };
  const routes: Array<[string, number[][]]> = [["the tower's core", (cfg.tower as unknown as { core: { route: number[][] } }).core.route]];
  for (const q of (cfg.base as unknown as { stairs: Array<{ at: number; top: number[]; route: number[][] }> }).stairs) routes.push([`the base's ${q.at} m stair (${q.top.join(", ")})`, q.route]);
  // (and THE CAPSULE HOTEL's, Milestone 592: the same double flight, out in its court)
  for (const q of (cfg as unknown as { stacks?: { hotel?: { stairs: Array<{ wing: string; at: number; route: number[][] }> } } }).stacks?.hotel?.stairs ?? []) routes.push([`the hotel's ${q.wing} ${q.at} m stair`, q.route]);
  const bad: string[] = [];
  for (const [name, r] of routes) {
    const w = sprintUp(r);
    if (w.k !== w.n || w.starts > 0 || w.over > 0.5) bad.push(`${name}: ${w.k - 1} of ${w.n - 1} legs, ${w.starts} climbs or mantles${w.at ? ` (first ${w.at})` : ""}, ${w.over.toFixed(2)} m over the flight`);
  }
  check("the stairs run up at a sprint with SpeedKills' moves: the tower's core to its top storey, each of the base's stairs and THE CAPSULE HOTEL's, no climb or mantle started, never half a metre over the flight", bad.length === 0 && routes.length >= 18, bad.slice(0, 4).join("; ") || `${routes.length} stairs`);
}

// THE TERMINAL's concourse and roofs (Milestone 590): a player walks each hall from the forecourt through its north arch,
// past the machines and benches either side, out through its south arch onto the platform; and each AC box on the
// vaults' ridges stands on the roof under it
{
  const TO = (cfg as unknown as { terminal?: { halls: number[][]; cover?: number; roofCover?: number } }).terminal;
  const RF = (cfg.rules as unknown as { districts?: { terminal?: { roof?: { y: number; at: number[][] } } } }).districts?.terminal?.roof;
  const shut: string[] = [];
  for (const [hx0, hx1, hz0, hz1] of TO?.halls ?? []) {
    const cx = (hx0 + hx1) / 2;
    const FW = (cfg.rules as unknown as { districts: { terminal: { trains: { front?: { x: number; z: number } } } } }).districts.terminal.trains.front;
    const route = [[cx, FW && Math.abs(cx - FW.x) < 6 ? FW.z + 2.7 : hz0 - 6, 0], [cx, (hz0 + hz1) / 2, 0], [cx, hz1 + 2.4, 0]];
    const w = along(route);
    if (w.k !== route.length) shut.push(`at x ${cx}: to (${w.x.toFixed(1)}, ${w.z.toFixed(1)})`);
  }
  check("THE TERMINAL: a player walks each hall from the forecourt through to the platform, past its concourse's machines and benches", (TO?.cover ?? 0) >= 24 && shut.length === 0, shut.join("; ") || `${TO?.halls.length} halls, ${TO?.cover} pieces of cover`);
  // (the bake merges a box and the roof under it into one column, so at its middle the top is the box's own: it stands
  // on the roof when that top is the ridge's height and a box's (1 to 1.5 m) over it, and the ridge a metre either side
  // of it is at its foot's height)
  const topAt = (x: number, z: number) => solidsIn(x + BR_X, x + BR_X, z + BR_Z, z + BR_Z).reduce((t, b) => (b.minX <= x + BR_X && b.maxX >= x + BR_X && b.minZ <= z + BR_Z && b.maxZ >= z + BR_Z && b.top < 20 && b.top > t ? b.top : t), 0);
  const off = (RF?.at ?? []).filter(([x, z]) => {
    const own = topAt(x, z) - RF!.y;
    return !(own > 0.9 && own < 1.6 && [-1, 1].every((d) => Math.abs(topAt(x + d, z) - RF!.y) < 0.3));
  });
  check("THE TERMINAL: the AC boxes along the vaults' ridges each stand on the roof", (RF?.at.length ?? 0) >= 8 && off.length === 0, off.map(([x, z]) => `(${x}, ${z})`).join("; ") || `${RF?.at.length} boxes`);
}

// THE STACKS (rules.districts.stacks, Milestone 591): its three capsule towers inside the north-west L and none in
// another; cover within 6 m over the L's open ground; its name over 10's podium seen from the ring road; its lamps
{
  type Tower = { piece: string; foot: number[]; top: number };
  const SO = (cfg as unknown as { stacks?: { towers: Tower[]; cover: number; lamps: number } }).stacks;
  const SR = (cfg.rules as unknown as { districts?: { stacks?: { name: { at: number[]; w: number } } } }).districts?.stacks;
  const T = SO?.towers ?? [];
  const IN = 107.5, HALF = 152;
  const inL = (x: number, z: number) => x >= -HALF && z >= -HALF && x <= -40 && z <= -40 && (x <= -IN || z <= -IN);
  const out = T.filter((t) => !(inL(t.foot[0], t.foot[2]) && inL(t.foot[1], t.foot[3]) && inL(t.foot[0], t.foot[3]) && inL(t.foot[1], t.foot[2])));
  const overlap = T.some((a, i) => T.some((b, j) => j > i && a.foot[0] < b.foot[1] && b.foot[0] < a.foot[1] && a.foot[2] < b.foot[3] && b.foot[2] < a.foot[3]));
  check("THE STACKS: three capsule towers inside the north-west L, off the roads and the ring, none in another, 49 to 60 m", T.length === 3 && out.length === 0 && !overlap && T.every((t) => t.top > 49 && t.top < 61), T.map((t) => `${t.piece.replace(".prefab", "")} x ${t.foot[0]} to ${t.foot[1]}, z ${t.foot[2]} to ${t.foot[3]}, ${t.top} m`).join("; "));
  // (the L's open ground: from every open half-metre of it a body's width of open ground stands round, outside the towers'
  // footprints, the distance to the nearest box standing from the ground past a crouched head, as the streets' check
  // measures it. Not the towers' own shut rooms, nor the quarter metre between 10's back and the map's edge)
  const C = 0.5, X0 = -HALF, N = Math.round((HALF - 40) / C);
  const body = new Uint8Array(N * N), cover = new Uint8Array(N * N);
  const floor = new Float32Array(N * N).fill(-Infinity);
  for (const b of SOLIDS.solids as number[][]) {
    if (b[5] < -0.5 || b[4] > 2.5 || b[1] < X0 || b[0] > -40 || b[3] < X0 || b[2] > -40) continue;
    for (let i = Math.max(0, Math.floor((b[0] - X0) / C)); i <= Math.min(N - 1, Math.floor((b[1] - X0) / C)); i++)
      for (let j = Math.max(0, Math.floor((b[2] - X0) / C)); j <= Math.min(N - 1, Math.floor((b[3] - X0) / C)); j++) {
        const k = i * N + j;
        if (b[4] < 1.8 && b[5] > 0.3) body[k] = 1;
        if (b[4] < 0.5 && b[5] > 1) cover[k] = 1;
        if (b[5] <= 0.3 && b[5] > floor[k]) floor[k] = b[5];
      }
  }
  const D = new Float32Array(N * N);
  for (let k = 0; k < D.length; k++) D[k] = cover[k] ? 0 : 1e9;
  for (let i = 0; i < N; i++)
    for (let j = 0; j < N; j++) {
      const k = i * N + j;
      if (i > 0) D[k] = Math.min(D[k], D[k - N] + 1, j > 0 ? D[k - N - 1] + Math.SQRT2 : 1e9, j < N - 1 ? D[k - N + 1] + Math.SQRT2 : 1e9);
      if (j > 0) D[k] = Math.min(D[k], D[k - 1] + 1);
    }
  for (let i = N - 1; i >= 0; i--)
    for (let j = N - 1; j >= 0; j--) {
      const k = i * N + j;
      if (i < N - 1) D[k] = Math.min(D[k], D[k + N] + 1, j < N - 1 ? D[k + N + 1] + Math.SQRT2 : 1e9, j > 0 ? D[k + N - 1] + Math.SQRT2 : 1e9);
      if (j < N - 1) D[k] = Math.min(D[k], D[k + 1] + 1);
    }
  let n = 0, far = 0, farthest = 0, at = [0, 0];
  const openAt = (k: number) => !body[k] && (floor[k] > -0.3 || !Number.isFinite(floor[k]));
  for (let k = N + 1; k < N * N - N - 1; k++) {
    const [x, z] = [X0 + (Math.floor(k / N) + 0.5) * C, X0 + ((k % N) + 0.5) * C];
    if (!inL(x, z) || T.some((t) => x > t.foot[0] && x < t.foot[1] && z > t.foot[2] && z < t.foot[3])) continue;
    if (![-N - 1, -N, -N + 1, -1, 0, 1, N - 1, N, N + 1].every((d) => openAt(k + d))) continue;
    n++;
    const d = D[k] * C;
    if (d > 6) far++;
    if (d > farthest) (farthest = d), (at = [x, z]);
  }
  check("THE STACKS: something to crouch behind within 6 m over its ground (at most 1% of it farther, none past 8 m)", n > 10000 && (far / n) * 100 <= 1 && farthest <= 8, `${((far / n) * 100).toFixed(1)}% of ${n} points over 6 m; the farthest ${farthest.toFixed(1)} m at (${at[0].toFixed(1)}, ${at[1].toFixed(1)}); ${SO?.cover ?? 0} pieces of cover`);
  // its name: from the middle of the ring road's north side at a standing eye, a clear line to the plate's middle and
  // near both ends
  const NM = SR?.name;
  const roadMid = ((cfg.rules as unknown as { ring: number[] }).ring[0] + (cfg.rules as unknown as { ring: number[] }).ring[1]) / 2;
  const blockedAt: string[] = [];
  const inBox = (x: number, y: number, z: number) => solidsIn(x - 0.01 + BR_X, x + 0.01 + BR_X, z - 0.01 + BR_Z, z + 0.01 + BR_Z).some((q) => q.minX <= x + BR_X && q.maxX >= x + BR_X && q.minZ <= z + BR_Z && q.maxZ >= z + BR_Z && q.base < y && q.top > y);
  // (from seven points along the ring road's north side, five or more with every line clear: the street cover keeps its
  // 3 m boards off the road in front of a district's name, rules.dress.cover.nameView, as from right behind one no name
  // over the plaza shows; a hover van parked at the kerb, 2.4 m high, still hides it from the point right behind it)
  const viewsBlocked = new Set<number>();
  for (const ex of [-15, -10, -5, 0, 5, 10, 15])
    for (const t of NM ? [-NM.w / 2 + 0.5, 0, NM.w / 2 - 0.5] : []) {
      const [a, b] = [[NM!.at[0] + ex, 1.7, -roadMid], [NM!.at[0] + t, NM!.at[1], NM!.at[2] + 0.3]];
      const L = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
      for (let k = 0; k < L; k += 0.25) {
        const f = k / L;
        const p = [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
        if (inBox(p[0], p[1], p[2])) {
          blockedAt.push(`from x ${ex} to ${t.toFixed(1)} at (${p.map((v) => v.toFixed(1)).join(", ")})`);
          viewsBlocked.add(ex);
          break;
        }
      }
    }
  const named = ((cfg as unknown as { districtNames?: Array<{ district: string }> }).districtNames ?? []).some((q) => q.district === "stacks");
  check("THE STACKS: its name in pink over 10's podium stair, seen from five of seven points along the ring road and more", named && !!NM && viewsBlocked.size <= 2, `${7 - viewsBlocked.size} of 7 points clear${blockedAt.length ? `; ${blockedAt.slice(0, 3).join("; ")}` : ""}`);
  check("THE STACKS: street lamps along its inner edge, both arms", (SO?.lamps ?? 0) >= 6, `${SO?.lamps ?? 0} lamps`);
}

// THE CAPSULE HOTEL (rules.districts.stacks.hotel, Milestone 592): every pod's floor holds a body at its storey with a
// standing body's room over it; a player walks each storey's gallery end to end and into every pod off it; the
// galleries' outer edges and the roof's railed but where a stair comes off or sets out; the AC boxes on the roof; its
// name seen from the court. (Its stairs are sprinted up with the base's, in the stairs check)
{
  type HotelOut = { pods: Array<{ c: number[]; y: number; wing: string }>; galleries: Array<{ wing: string; y: number; box: number[] }>; stairs: Array<{ wing: string; at: number; route: number[][] }>; roof: number; outline: number[][]; cover: number };
  type HWing = { id: string; axis: "x" | "z"; back: number; deep: number; gallery: number; run: number[]; fenceRun: number[]; width: number; from: number; count: number };
  const HO = (cfg as unknown as { stacks?: { hotel?: HotelOut } }).stacks?.hotel;
  const HR = (cfg.rules as unknown as { districts?: { stacks?: { hotel?: { wings: HWing[]; rail: { inset: number }; roofCover: { at: number[][] }; name: { at: number[]; w: number }; stairs: { arrive: number[] } } } } }).districts?.stacks?.hotel;
  const at = (x: number, z: number) => solidsIn(x + BR_X, x + BR_X, z + BR_Z, z + BR_Z).filter((q) => q.minX <= x + BR_X && q.maxX >= x + BR_X && q.minZ <= z + BR_Z && q.maxZ >= z + BR_Z);
  const floorAtY = (x: number, z: number, y: number) => at(x, z).reduce((f, q) => (q.top <= y + 0.3 && q.top > f ? q.top : f), 0);
  const badPods = (HO?.pods ?? []).filter((p) => {
    const f = floorAtY(p.c[0], p.c[1], p.y);
    return Math.abs(f - p.y) > 0.15 || at(p.c[0], p.c[1]).some((q) => q.base > f + 0.3 && q.base < f + MOVE.standHeight);
  });
  check("THE CAPSULE HOTEL: 21 pods on three storeys, each one's floor holding a body at its storey with room to stand", (HO?.pods.length ?? 0) === 21 && badPods.length === 0, badPods.map((p) => `(${p.c.join(", ")}) at ${p.y} m`).join("; ") || `${HO?.pods.length} pods`);
  // (each storey's gallery walked from its far end to the inside corner, stepping into each pod off it and back out)
  const walked: string[] = [], shut: string[] = [];
  for (const W of HR?.wings ?? []) {
    for (const y of [0, 3.5, 7]) {
      const mid = W.deep + W.gallery / 2;
      const pt = (a: number, d: number) => (W.axis === "x" ? [a, W.back + d, y] : [W.back + d, a, y]);
      const route: number[][] = [pt(W.run[1] - 1, mid)];
      for (let k = W.count - 1; k >= 0; k--) {
        const a = W.from + W.width * (k + 0.5);
        route.push(pt(a, mid), pt(a, W.deep / 2), pt(a, mid));
      }
      route.push(pt(W.fenceRun[0] + 1, mid));
      const w = along(route);
      if (w.k === route.length) walked.push(`${W.id} ${y} m`);
      else shut.push(`${W.id} at ${y} m: ${w.k - 1} of ${route.length - 1} legs, at (${w.x.toFixed(1)}, ${w.z.toFixed(1)}, ${w.y.toFixed(2)})`);
    }
  }
  check("THE CAPSULE HOTEL: a player walks each storey's gallery end to end and into every pod off it", walked.length === 6 && shut.length === 0, shut.join("; ") || walked.join(", "));
  // (the rails: along each gallery's outer edge on the upper storeys and round the roof, a point every half metre a
  // fence's inset in from the edge, each under a box from the floor to past a body's waist, but in a stair's stretch)
  const fenced = (x: number, z: number, y: number) => at(x, z).some((q) => q.base <= y + 0.3 && q.top >= y + 0.9);
  const inset = HR?.rail.inset ?? 0.1;
  // (a stair's stretch of the edge: 2 m either side of where its way up leaves the gallery, and of where the one from
  // the storey below comes off onto it)
  const gapsAt = (wing: string, y: number) => {
    const W = HR!.wings.find((q) => q.id === wing)!;
    const along = (p: number[]) => (W.axis === "x" ? p[0] : p[1]);
    return (HO?.stairs ?? []).filter((q) => q.wing === wing).flatMap((q) => [
      ...(y > 0 && Math.abs(q.at - y) < 0.01 ? [[along(q.route[0]) - 2, along(q.route[0]) + 2]] : []),
      ...(Math.abs(q.at + 3.5 - y) < 0.01 ? [[along(q.route.at(-1)!) - 2, along(q.route.at(-1)!) + 2]] : []),
    ]);
  };
  const open: string[] = [];
  let points = 0;
  for (const W of HR?.wings ?? [])
    for (const y of [3.5, 7, HO?.roof ?? 10.5]) {
      const d = W.deep + W.gallery - inset;
      for (let a = Math.min(...W.fenceRun) + 0.5; a < Math.max(...W.fenceRun) - 0.5; a += 0.5) {
        if (gapsAt(W.id, y).some(([g0, g1]) => a > g0 && a < g1)) continue;
        const [x, z] = W.axis === "x" ? [a, W.back + d] : [W.back + d, a];
        points++;
        if (!fenced(x, z, y)) open.push(`${W.id} ${y} m at (${x.toFixed(1)}, ${z.toFixed(1)})`);
      }
    }
  check("THE CAPSULE HOTEL: the galleries' outer edges and the roof's court side railed, but where a stair sets out or comes off", points > 200 && open.length === 0, open.slice(0, 4).join("; ") + (open.length > 4 ? ` and ${open.length - 4} more` : "") || `${points} points`);
  const R = HO?.roof ?? 10.5;
  const off = (HR?.roofCover.at ?? []).filter(([x, z]) => !at(x, z).some((q) => q.top > R + 0.9 && q.top < R + 1.7));
  check("THE CAPSULE HOTEL: AC boxes standing on its roof as cover", (HR?.roofCover.at.length ?? 0) >= 6 && off.length === 0 && (HO?.cover ?? 0) >= 6, off.map((p) => `(${p.join(", ")})`).join("; ") || `${HO?.cover} boxes`);
  // its name: from the court's open corner toward the plaza at a standing eye, a clear line to the plate
  const NM = HR?.name;
  const inBox = (x: number, y: number, z: number) => at(x, z).some((q) => q.base < y && q.top > y);
  const blockedAt: string[] = [];
  for (const [ex, ez] of [[-112, -112], [-120, -112], [-112, -120]])
    for (const t of NM ? [-NM.w / 2 + 0.5, 0, NM.w / 2 - 0.5] : []) {
      const [a, b] = [[ex, 1.7, ez], [NM!.at[0] + t, NM!.at[1], NM!.at[2] + 0.3]];
      const L = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
      for (let k = 0; k < L; k += 0.25) {
        const f = k / L;
        const p = [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
        if (inBox(p[0], p[1], p[2])) {
          blockedAt.push(`from (${ex}, ${ez}) to ${t.toFixed(1)} at (${p.map((v) => v.toFixed(1)).join(", ")})`);
          break;
        }
      }
    }
  const named = ((cfg as unknown as { districtNames?: Array<{ district: string }> }).districtNames ?? []).some((q) => q.district === "stacks-hotel");
  check("THE CAPSULE HOTEL: CAPSULE HOTEL in pink on the roof's edge, seen from the court", named && !!NM && blockedAt.length === 0, blockedAt.slice(0, 4).join("; ") || "9 sight lines clear");
}

// THE STACKS' high ground and light (Milestone 593): the east pod's roof railed on its three open edges, its AC boxes
// standing on it (its pad, stacks-e, is ridden with every pad above); the hotel's pink strip lights under its galleries'
// ceilings and a light in every pod
{
  const PR = (cfg.rules as unknown as { districts?: { stacks?: { perch?: { box: number[]; y: number; inset: number; cover: { at: number[][] } } } } }).districts?.stacks?.perch;
  const at = (x: number, z: number) => solidsIn(x + BR_X, x + BR_X, z + BR_Z, z + BR_Z).filter((q) => q.minX <= x + BR_X && q.maxX >= x + BR_X && q.minZ <= z + BR_Z && q.maxZ >= z + BR_Z);
  const open: string[] = [];
  let points = 0;
  if (PR) {
    const [x0, x1, z0, z1] = PR.box;
    const i = PR.inset;
    const edge: Array<[number, number]> = [];
    for (let x = x0 + 0.5; x < x1 - 0.3; x += 0.5) edge.push([x, z0 + i], [x, z1 - i]);
    for (let z = z0 + 0.5; z < z1 - 0.3; z += 0.5) edge.push([x1 - i, z]);
    for (const [x, z] of edge) {
      points++;
      if (!at(x, z).some((q) => q.base <= PR.y + 0.3 && q.top >= PR.y + 0.9)) open.push(`(${x.toFixed(1)}, ${z.toFixed(1)})`);
    }
  }
  const pad = ((cfg as unknown as { spine: { up: Array<{ id: string; roof: number }> } }).spine.up ?? []).find((q) => q.id === "stacks-e");
  const off = (PR?.cover.at ?? []).filter(([x, z]) => !at(x, z).some((q) => q.top > PR!.y + 0.9 && q.top < PR!.y + 1.7));
  check("THE STACKS: the high ground on 10's east pod at 20.5 m, its pad solved onto it, railed on its three open edges, AC boxes on it", !!pad && Math.abs(pad.roof - (PR?.y ?? 0)) < 1.5 && points > 20 && open.length === 0 && off.length === 0 && (PR?.cover.at.length ?? 0) >= 2, `${pad ? `the pad onto ${pad.roof} m` : "no pad"}; ${open.length} of ${points} edge points open${open.length ? ` (${open.slice(0, 3).join("; ")})` : ""}; ${(PR?.cover.at.length ?? 0) - off.length} boxes standing on it`);
  const L = (cfg.rules as unknown as { districts?: { stacks?: { hotel?: { lights?: { strip: string; pod: string } } } } }).districts?.stacks?.hotel?.lights;
  const placed = (cfg as unknown as { chunks: Record<string, { place: unknown[][] }> }).chunks["c-stacks"]?.place ?? [];
  const count = (name?: string) => placed.filter((q) => name && String(q[0]).endsWith(`/${name}`)).length;
  check("THE CAPSULE HOTEL: pink strip lights under every gallery's ceiling and a light in each of its 21 pods", !!L && count(L.strip) >= 30 && count(L.pod) === 21, `${count(L?.strip)} strips, ${count(L?.pod)} pod lights`);
}

// GLASS HEIGHTS (rules.districts.glass, Milestone 594): its slabs and tower inside the north band; a player walks each
// of its gangways (rules.bridges.paths that end in the band) from one deck's roof up its stair, over, and down onto the
// next, the first from the North deck across the ring road; its name seen from the ring road
{
  const GO = (cfg as unknown as { glass?: { slabs: Array<{ piece: string; foot: number[]; top: number }> } }).glass;
  const GR = (cfg.rules as unknown as { districts?: { glass?: { name: { at: number[]; w: number } } } }).districts?.glass;
  const S = GO?.slabs ?? [];
  const out = S.filter((s) => s.foot[0] < -30.01 || s.foot[1] > 30.01 || s.foot[2] < -152.01 || s.foot[3] > -107.49);
  check("GLASS HEIGHTS: its four white slabs and its 72 m glass tower inside the north band", S.length === 5 && out.length === 0 && S.some((s) => s.top > 70), S.map((s) => `${s.piece.replace(".prefab", "")} x ${s.foot[0]} to ${s.foot[1]}, z ${s.foot[2]} to ${s.foot[3]}, ${s.top} m`).join("; "));
  const BR = (cfg.rules as unknown as { bridges: { roof: number; deck: number; paths: number[][][] } }).bridges;
  const mine = BR.paths.filter((p) => p.some((q) => q[1] < -105));
  const shut: string[] = [];
  for (const p of mine) {
    const [a, b] = [p[0], p.at(-1)!];
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const u = [(b[0] - a[0]) / L, (b[1] - a[1]) / L];
    const at = (q: number[], t: number, y: number) => [q[0] + u[0] * t, q[1] + u[1] * t, y];
    const route = [at(a, -2, BR.roof), at(a, 2.5, BR.deck), at(b, -2.5, BR.deck), at(b, 2, BR.roof)];
    const w = along(route);
    if (w.k !== route.length) shut.push(`(${a.join(", ")}) to (${b.join(", ")}): ${w.k - 1} of 3 legs, at (${w.x.toFixed(1)}, ${w.y.toFixed(2)}, ${w.z.toFixed(1)})`);
  }
  check("GLASS HEIGHTS: a player walks from the North deck over the ring road onto its front deck, and over each gangway onto each of its decks", mine.length === 4 && shut.length === 0, shut.join("; ") || `${mine.length} gangways`);
  const NM = GR?.name;
  const roadMid = ((cfg.rules as unknown as { ring: number[] }).ring[0] + (cfg.rules as unknown as { ring: number[] }).ring[1]) / 2;
  const inBox = (x: number, y: number, z: number) => solidsIn(x - 0.01 + BR_X, x + 0.01 + BR_X, z - 0.01 + BR_Z, z + 0.01 + BR_Z).some((q) => q.minX <= x + BR_X && q.maxX >= x + BR_X && q.minZ <= z + BR_Z && q.maxZ >= z + BR_Z && q.base < y && q.top > y);
  const blockedAt: string[] = [];
  for (const ex of [-10, 0, 10])
    for (const t of NM ? [-NM.w / 2 + 0.5, 0, NM.w / 2 - 0.5] : []) {
      const [p0, p1] = [[NM!.at[0] + ex, 1.7, -roadMid], [NM!.at[0] + t, NM!.at[1], NM!.at[2] + 0.3]];
      const L = Math.hypot(p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]);
      for (let k = 0; k < L; k += 0.25) {
        const f = k / L;
        const q = [p0[0] + (p1[0] - p0[0]) * f, p0[1] + (p1[1] - p0[1]) * f, p0[2] + (p1[2] - p0[2]) * f];
        if (inBox(q[0], q[1], q[2])) {
          blockedAt.push(`from x ${ex} to ${t.toFixed(1)} at (${q.map((v) => v.toFixed(1)).join(", ")})`);
          break;
        }
      }
    }
  const named = ((cfg as unknown as { districtNames?: Array<{ district: string }> }).districtNames ?? []).some((q) => q.district === "glass");
  check("GLASS HEIGHTS: its name in cyan on the front deck's arm, seen from the ring road", named && !!NM && blockedAt.length === 0, blockedAt.slice(0, 4).join("; ") || "9 sight lines clear");
}

// GLASS HEIGHTS' ground and ways up (Milestone 595): its glass lift ridden up from its car onto its landing, its stair
// walked down onto the front deck and back up, and ridden down again; cover within 6 m over the band's open ground; its
// pads are ridden with the rest
{
  const GLq = (cfg as unknown as { glass?: { lift?: { rope: number[][]; floor: number; car: number[]; out: number[]; land: number[]; foot: number[] }; cover?: number; slabs: Array<{ foot: number[] }> } }).glass;
  const q = GLq?.lift;
  const BRG = (cfg.rules as unknown as { bridges: { deck: number; roof: number } }).bridges;
  const facing = (d: number[]) => (Math.atan2(-d[0], -d[1]) * 180) / Math.PI;
  const go = (x: number, z: number, y: number, yaw: number, o: { walk?: number; zip?: boolean }) => {
    const p = new Player({ minX: BR_X - 400, maxX: BR_X + 400, minZ: BR_Z - 400, maxZ: BR_Z + 400 });
    p.teleport(x + BR_X, y + 0.05, z + BR_Z, yaw);
    let [t, tap, rode, walking] = [1000, false, false, !!o.walk];
    const input = { held: (a: Action) => walking && a === "forward", pressedNow: (a: Action) => tap && a === "interact" };
    const step = () => p.update(1 / 144, (t += 1 / 144), input, 0, 1, false);
    if (o.walk) {
      for (let i = 0; i < 144 * 8 && Math.hypot(p.pos.x - BR_X - x, p.pos.z - BR_Z - z) < o.walk; i++) step();
      walking = false;
      for (let i = 0; i < 144; i++) step();
    } else {
      for (let i = 0; i < 36; i++) step();
      tap = true;
      step();
      tap = false;
      rode = p.stance === "zip";
      for (let i = 0; i < 144 * 6 && p.stance === "zip"; i++) step();
      for (let i = 0; i < 144 * 2; i++) step();
    }
    return { rode, x: p.pos.x - BR_X, y: p.pos.y, z: p.pos.z - BR_Z };
  };
  const said: string[] = [];
  let ok = !!q;
  if (q) {
    const w = q.out;
    const up = go(q.car[0] - w[0] * 0.6, q.car[1] - w[1] * 0.6, q.floor, facing(w), { zip: true });
    const past = (up.x - q.car[0]) * w[0] + (up.z - q.car[1]) * w[1];
    const upOk = up.rode && Math.abs(up.y - BRG.deck) < 0.15 && past > 0.5;
    const down = go(q.land[0], q.land[1], BRG.deck, facing(w), { walk: Math.hypot(q.foot[0] - q.land[0], q.foot[1] - q.land[1]) + 1 });
    const back = go(q.foot[0], q.foot[1], BRG.roof, facing([-w[0], -w[1]]), { walk: Math.hypot(q.foot[0] - q.land[0], q.foot[1] - q.land[1]) });
    const ride = go(q.land[0], q.land[1], BRG.deck, facing([-w[0], -w[1]]), { zip: true });
    const rideOk = ride.rode && Math.abs(ride.y - q.floor) < 0.15 && Math.hypot(ride.x - q.car[0], ride.z - q.car[1]) < 1.3;
    ok = upOk && Math.abs(down.y - BRG.roof) < 0.3 && Math.abs(back.y - BRG.deck) < 0.15 && rideOk;
    said.push(`up ${up.rode ? "rode" : "did not grab"}, off at ${up.y.toFixed(2)} m ${past.toFixed(1)} m past the rope`, `down its stair to ${down.y.toFixed(2)} m`, `back up to ${back.y.toFixed(2)} m`, `down ${ride.rode ? "rode" : "did not grab"}, off at ${ride.y.toFixed(2)} m`);
  }
  check("GLASS HEIGHTS: its glass lift ridden up from its car in the courtyard onto its landing, its stair walked down onto the front deck and back up, and ridden down again", ok, said.join("; "));
  // (the band's open ground: from every open half-metre outside the buildings with a body's width round it, the distance
  // to the nearest box standing from the ground past a crouched head, as THE STACKS' check measures it)
  const feet = GLq?.slabs ?? [];
  const C = 0.5, X0 = -30, Z0 = -152, NI = Math.round(60 / C), NJ = Math.round((152 - 107.5) / C);
  const body = new Uint8Array(NI * NJ), cov = new Uint8Array(NI * NJ);
  const floor = new Float32Array(NI * NJ).fill(-Infinity);
  for (const b of SOLIDS.solids as number[][]) {
    if (b[5] < -0.5 || b[4] > 2.5 || b[1] < X0 || b[0] > 30 || b[3] < Z0 || b[2] > -107.5) continue;
    for (let i = Math.max(0, Math.floor((b[0] - X0) / C)); i <= Math.min(NI - 1, Math.floor((b[1] - X0) / C)); i++)
      for (let j = Math.max(0, Math.floor((b[2] - Z0) / C)); j <= Math.min(NJ - 1, Math.floor((b[3] - Z0) / C)); j++) {
        const k = i * NJ + j;
        if (b[4] < 1.8 && b[5] > 0.3) body[k] = 1;
        if (b[4] < 0.5 && b[5] > 1) cov[k] = 1;
        if (b[5] <= 0.3 && b[5] > floor[k]) floor[k] = b[5];
      }
  }
  const D = new Float32Array(NI * NJ);
  for (let k = 0; k < D.length; k++) D[k] = cov[k] ? 0 : 1e9;
  for (let i = 0; i < NI; i++)
    for (let j = 0; j < NJ; j++) {
      const k = i * NJ + j;
      if (i > 0) D[k] = Math.min(D[k], D[k - NJ] + 1, j > 0 ? D[k - NJ - 1] + Math.SQRT2 : 1e9, j < NJ - 1 ? D[k - NJ + 1] + Math.SQRT2 : 1e9);
      if (j > 0) D[k] = Math.min(D[k], D[k - 1] + 1);
    }
  for (let i = NI - 1; i >= 0; i--)
    for (let j = NJ - 1; j >= 0; j--) {
      const k = i * NJ + j;
      if (i < NI - 1) D[k] = Math.min(D[k], D[k + NJ] + 1, j < NJ - 1 ? D[k + NJ + 1] + Math.SQRT2 : 1e9, j > 0 ? D[k + NJ - 1] + Math.SQRT2 : 1e9);
      if (j < NJ - 1) D[k] = Math.min(D[k], D[k + 1] + 1);
    }
  const openAt = (k: number) => !body[k] && (floor[k] > -0.3 || !Number.isFinite(floor[k]));
  let n = 0, far = 0, farthest = 0, at = [0, 0];
  for (let i = 1; i < NI - 1; i++)
    for (let j = 1; j < NJ - 1; j++) {
      const k = i * NJ + j;
      const [x, z] = [X0 + (i + 0.5) * C, Z0 + (j + 0.5) * C];
      if (feet.some((t) => x > t.foot[0] && x < t.foot[1] && z > t.foot[2] && z < t.foot[3])) continue;
      if (![-NJ - 1, -NJ, -NJ + 1, -1, 0, 1, NJ - 1, NJ, NJ + 1].every((d) => openAt(k + d))) continue;
      n++;
      const d = D[k] * C;
      if (d > 6) far++;
      if (d > farthest) (farthest = d), (at = [x, z]);
    }
  check("GLASS HEIGHTS: something to crouch behind within 6 m over its ground (at most 1% of it farther, none past 8 m)", n > 1500 && (far / n) * 100 <= 1 && farthest <= 8, `${((far / n) * 100).toFixed(1)}% of ${n} points over 6 m; the farthest ${farthest.toFixed(1)} m at (${at[0].toFixed(1)}, ${at[1].toFixed(1)}); ${GLq?.cover ?? 0} pieces of cover`);
}

// THE STRIP (rules.districts.strip, Milestone 596): its tower across the city's edge at the boulevard's end, its glowing
// blocks and pyramid inside the east band; each block shut to its top in the collision (the pack's are faces round
// nothing); a player walks up the pyramid from each side onto its top; its name seen from the ring road, cover within
// 6 m over its ground, its lamps
{
  const SO = (cfg as unknown as { strip?: { tower: { piece: string; foot: number[]; top: number }; base: number[][]; pyramid: { c: number[]; foot: number[]; top: number; steps: number }; cover: number; lamps: number } }).strip;
  const SR = (cfg.rules as unknown as { districts?: { strip?: { name: { at: number[]; w: number } } } }).districts?.strip;
  const T = SO?.tower;
  const boxes = [...(SO?.base ?? []), ...(SO ? [SO.pyramid.foot] : [])];
  const out = boxes.filter((b) => b[0] < 107.49 || b[1] > 152.01 || b[2] < -30.01 || b[3] > 30.01);
  const overlap = boxes.some((a, i) => boxes.some((b, j) => j > i && a[0] < b[1] - 0.01 && a[1] > b[0] + 0.01 && a[2] < b[3] - 0.01 && a[3] > b[2] + 0.01));
  const edgeOk = !!T && T.foot[0] > 107.5 && T.foot[0] < 152 && T.foot[1] > 152 && T.foot[2] >= -30 && T.foot[3] <= 30 && T.top > 85;
  check("THE STRIP: its 87 m tower across the city's edge at the boulevard's end, its eight glowing blocks and the pyramid inside the east band, none in another", edgeOk && (SO?.base.length ?? 0) === 8 && out.length === 0 && !overlap, `${T ? `the tower x ${T.foot[0]} to ${T.foot[1]}, ${T.top} m` : "no tower"}; ${SO?.base.length ?? 0} blocks; ${out.length} outside the band${overlap ? "; two overlap" : ""}`);
  const S = SOLIDS.solids as number[][];
  const open = (SO?.base ?? []).filter((b) => {
    const [x, z] = [(b[0] + b[1]) / 2, (b[2] + b[3]) / 2];
    return !S.some((q) => q[0] <= x && q[1] >= x && q[2] <= z && q[3] >= z && q[4] <= 0.05 && q[5] >= b[5] - 0.05);
  });
  check("THE STRIP: each glowing block shut from the street to its top in the collision", !!SO && open.length === 0, open.map((b) => `(${((b[0] + b[1]) / 2).toFixed(1)}, ${((b[2] + b[3]) / 2).toFixed(1)}) open`).join("; ") || `${SO?.base.length ?? 0} shut`);
  // (the pyramid walked up from 2.5 m off the middle of each face, toward its middle, until 1 m from it)
  const climbs: string[] = [];
  let climbed = 0;
  if (SO) {
    const [cx, cz] = SO.pyramid.c;
    const half = (SO.pyramid.foot[1] - SO.pyramid.foot[0]) / 2;
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const [x, z] = [cx + dx * (half + 2.5), cz + dz * (half + 2.5)];
      const p = new Player({ minX: BR_X - 400, maxX: BR_X + 400, minZ: BR_Z - 400, maxZ: BR_Z + 400 });
      p.teleport(x + BR_X, 0.05, z + BR_Z, (Math.atan2(dx, dz) * 180) / Math.PI);
      let t = 1000;
      const input = { held: (a: Action) => a === "forward", pressedNow: () => false };
      for (let i = 0; i < 144 * 8 && Math.hypot(p.pos.x - BR_X - cx, p.pos.z - BR_Z - cz) > 1; i++) p.update(1 / 144, (t += 1 / 144), input, 0, 1, false);
      const up = Math.abs(p.pos.y - SO.pyramid.top) < 0.15 && Math.hypot(p.pos.x - BR_X - cx, p.pos.z - BR_Z - cz) <= 1.2;
      if (up) climbed++;
      climbs.push(`from the ${dx > 0 ? "east" : dx < 0 ? "west" : dz > 0 ? "south" : "north"} to ${p.pos.y.toFixed(2)} m, ${Math.hypot(p.pos.x - BR_X - cx, p.pos.z - BR_Z - cz).toFixed(1)} m off its middle`);
    }
  }
  check("THE STRIP: a player walks up the glowing pyramid from each side onto its top, 7 m up", climbed === 4, climbs.join("; "));
  const NM = SR?.name;
  const inBox = (x: number, y: number, z: number) => solidsIn(x - 0.01 + BR_X, x + 0.01 + BR_X, z - 0.01 + BR_Z, z + 0.01 + BR_Z).some((q) => q.minX <= x + BR_X && q.maxX >= x + BR_X && q.minZ <= z + BR_Z && q.maxZ >= z + BR_Z && q.base < y && q.top > y);
  const blockedAt: string[] = [];
  // (from the ring road's outer pavement across the boulevard's mouth, 5 m either side of its middle: from 10 m off it
  // the club's corner column stands between, as a building does at any street's corner, and from the road's middle a
  // parked hover car stands at eye height)
  const pave = (cfg.rules as unknown as { ring: number[] }).ring[1] + (cfg.rules as unknown as { streets: { curves: { pave: number } } }).streets.curves.pave / 2;
  for (const ez of [-5, 0, 5])
    for (const t of NM ? [-NM.w / 2 + 0.5, 0, NM.w / 2 - 0.5] : []) {
      const [p0, p1] = [[pave, 1.7, NM!.at[2] + ez], [NM!.at[0] - 0.3, NM!.at[1], NM!.at[2] + t]];
      const L = Math.hypot(p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]);
      for (let k = 0; k < L; k += 0.25) {
        const f = k / L;
        const q = [p0[0] + (p1[0] - p0[0]) * f, p0[1] + (p1[1] - p0[1]) * f, p0[2] + (p1[2] - p0[2]) * f];
        if (inBox(q[0], q[1], q[2])) {
          blockedAt.push(`from z ${ez} to ${t.toFixed(1)} at (${q.map((v) => v.toFixed(1)).join(", ")})`);
          break;
        }
      }
    }
  const named = ((cfg as unknown as { districtNames?: Array<{ district: string }> }).districtNames ?? []).some((q) => q.district === "strip");
  check("THE STRIP: its name in magenta over the gate at the boulevard's end, seen from the ring road", named && !!NM && blockedAt.length === 0, blockedAt.slice(0, 4).join("; ") || "9 sight lines clear");
  // (the band's open ground, as GLASS HEIGHTS' check measures it: the tower's, the blocks' and the pyramid's feet left out)
  const feet = SO ? [SO.tower.foot, ...SO.base, SO.pyramid.foot] : [];
  const C = 0.5, X0 = 107.5, Z0 = -30, NI = Math.round((152 - 107.5) / C), NJ = Math.round(60 / C);
  const body = new Uint8Array(NI * NJ), cov = new Uint8Array(NI * NJ);
  const floor = new Float32Array(NI * NJ).fill(-Infinity);
  for (const b of S) {
    if (b[5] < -0.5 || b[4] > 2.5 || b[1] < X0 || b[0] > 152 || b[3] < Z0 || b[2] > 30) continue;
    for (let i = Math.max(0, Math.floor((b[0] - X0) / C)); i <= Math.min(NI - 1, Math.floor((b[1] - X0) / C)); i++)
      for (let j = Math.max(0, Math.floor((b[2] - Z0) / C)); j <= Math.min(NJ - 1, Math.floor((b[3] - Z0) / C)); j++) {
        const k = i * NJ + j;
        if (b[4] < 1.8 && b[5] > 0.3) body[k] = 1;
        if (b[4] < 0.5 && b[5] > 1) cov[k] = 1;
        if (b[5] <= 0.3 && b[5] > floor[k]) floor[k] = b[5];
      }
  }
  const D = new Float32Array(NI * NJ);
  for (let k = 0; k < D.length; k++) D[k] = cov[k] ? 0 : 1e9;
  for (let i = 0; i < NI; i++)
    for (let j = 0; j < NJ; j++) {
      const k = i * NJ + j;
      if (i > 0) D[k] = Math.min(D[k], D[k - NJ] + 1, j > 0 ? D[k - NJ - 1] + Math.SQRT2 : 1e9, j < NJ - 1 ? D[k - NJ + 1] + Math.SQRT2 : 1e9);
      if (j > 0) D[k] = Math.min(D[k], D[k - 1] + 1);
    }
  for (let i = NI - 1; i >= 0; i--)
    for (let j = NJ - 1; j >= 0; j--) {
      const k = i * NJ + j;
      if (i < NI - 1) D[k] = Math.min(D[k], D[k + NJ] + 1, j < NJ - 1 ? D[k + NJ + 1] + Math.SQRT2 : 1e9, j > 0 ? D[k + NJ - 1] + Math.SQRT2 : 1e9);
      if (j < NJ - 1) D[k] = Math.min(D[k], D[k + 1] + 1);
    }
  const openAt = (k: number) => !body[k] && (floor[k] > -0.3 || !Number.isFinite(floor[k]));
  let n = 0, far = 0, farthest = 0, at = [0, 0];
  for (let i = 1; i < NI - 1; i++)
    for (let j = 1; j < NJ - 1; j++) {
      const k = i * NJ + j;
      const [x, z] = [X0 + (i + 0.5) * C, Z0 + (j + 0.5) * C];
      if (feet.some((f) => x > f[0] && x < f[1] && z > f[2] && z < f[3])) continue;
      if (![-NJ - 1, -NJ, -NJ + 1, -1, 0, 1, NJ - 1, NJ, NJ + 1].every((d) => openAt(k + d))) continue;
      n++;
      const d = D[k] * C;
      if (d > 6) far++;
      if (d > farthest) (farthest = d), (at = [x, z]);
    }
  check("THE STRIP: something to crouch behind within 6 m over its ground (at most 1% of it farther, none past 8 m)", n > 1500 && (far / n) * 100 <= 1 && farthest <= 8, `${((far / n) * 100).toFixed(1)}% of ${n} points over 6 m; the farthest ${farthest.toFixed(1)} m at (${at[0].toFixed(1)}, ${at[1].toFixed(1)}); ${SO?.cover ?? 0} pieces of cover`);
  check("THE STRIP: street lamps along the ring road", (SO?.lamps ?? 0) >= 3, `${SO?.lamps ?? 0} lamps`);
}

// THE STRIP's club (rules.districts.strip.club, Milestone 597): its four columns shut to their tops and its balcony's
// deck in the collision; a player walks in through each gate onto the dance floor, sprints up each stair onto the
// balcony up its middle and near each side, walks the whole ring, and every rail stands in the collision (walked into,
// a rail is mantled over, as every rail in the game is)
{
  type Club = { hall: number[]; columns: number[][]; deck: number[][]; stairs: Array<{ route: number[][]; lanes: number[][][] }>; rails: number; railLines: number[][]; ring: number[][]; gates: number[][]; y: number; at: number[] };
  const CO = (cfg as unknown as { strip?: { club?: Club } }).strip?.club;
  const S = SOLIDS.solids as number[][];
  const has = (x: number, z: number, base: number, top: number) => S.some((q) => q[0] <= x && q[1] >= x && q[2] <= z && q[3] >= z && q[4] <= base + 0.05 && q[5] >= top - 0.05);
  const openCols = (CO?.columns ?? []).filter((b) => !has((b[0] + b[1]) / 2, (b[2] + b[3]) / 2, 0, b[5]));
  const openDeck = (CO?.deck ?? []).filter((d) => !has((d[0] + d[1]) / 2, (d[2] + d[3]) / 2, (CO?.y ?? 0) - 0.1, CO?.y ?? 0));
  check("THE STRIP's club: four glowing columns shut to 14 m at its corners, every cell of its balcony's deck in the collision", !!CO && CO.columns.length === 4 && openCols.length === 0 && CO.deck.length >= 20 && openDeck.length === 0, `${CO?.columns.length ?? 0} columns, ${openCols.length} open; ${CO?.deck.length ?? 0} deck cells, ${openDeck.length} missing`);
  const walks: string[] = [];
  let walked = 0;
  for (const g of CO?.gates ?? []) {
    // (from 3.5 m outside the gate's middle, through it, 1.8 m in under the balcony, then to the dance floor's middle)
    const [gx, gz] = [(g[0] + g[1]) / 2, (g[2] + g[3]) / 2];
    const acrossX = g[1] - g[0] < g[3] - g[2];
    const sgn = acrossX ? Math.sign(CO!.at[0] - gx) : Math.sign(CO!.at[1] - gz);
    const out = acrossX ? [gx - sgn * 3.5, gz, 0] : [gx, gz - sgn * 3.5, 0];
    const inn = acrossX ? [gx + sgn * 1.8, gz - 1.1, 0] : [gx, gz + sgn * 2.8, 0];
    const route = [out, [gx, gz, 0], inn, [CO!.at[0], CO!.at[1] - 4, 0], [CO!.at[0], CO!.at[1], 0]];
    const w = along(route);
    if (w.k === route.length) walked++;
    walks.push(`the gate at (${gx.toFixed(1)}, ${gz.toFixed(1)}): ${w.k - 1} of ${route.length - 1} legs, at (${w.x.toFixed(1)}, ${w.z.toFixed(1)})`);
  }
  check("THE STRIP's club: a player walks in through each of its two gates onto the dance floor", !!CO && CO.gates.length === 2 && walked === 2, walks.join("; "));
  const ups = (CO?.stairs ?? []).flatMap((s, i) => s.lanes.map((r, j) => ({ i, j, r, w: along(r) })));
  const stuck = ups.filter((u) => u.w.k !== u.r.length || Math.abs(u.w.y - CO!.y) > 0.15);
  check("THE STRIP's club: a player sprints up each of its two stairs onto the balcony, up the middle of its flights and near each side", !!CO && ups.length === 6 && stuck.length === 0, stuck.map((u) => `stair ${u.i + 1} lane ${u.j + 1}: ${u.w.k - 1} of ${u.r.length - 1} legs, at (${u.w.x.toFixed(1)}, ${u.w.z.toFixed(1)}) ${u.w.y.toFixed(2)} m`).join("; ") || `${ups.length} walks to ${CO?.y} m`);
  const ring = CO ? along(CO.ring) : null;
  check("THE STRIP's club: a player walks the whole balcony round, past every column", !!ring && ring.k === CO!.ring.length && Math.abs(ring.y - CO!.y) < 0.15, ring ? `${ring.k - 1} of ${CO!.ring.length - 1} legs, at (${ring.x.toFixed(1)}, ${ring.z.toFixed(1)}) ${ring.y.toFixed(2)} m` : "no club");
  // (along every rail, a point every half metre a fence's inset onto the deck: a box from the deck to past a body's
  // waist, as THE CAPSULE HOTEL's rails are checked)
  const unfenced: string[] = [];
  let railPoints = 0;
  for (const [x0, z0, x1, z1] of CO?.railLines ?? []) {
    const L = Math.hypot(x1 - x0, z1 - z0);
    for (let t = 0.25; t < L - 0.2; t += 0.5) {
      const [x, z] = [x0 + ((x1 - x0) * t) / L, z0 + ((z1 - z0) * t) / L];
      railPoints++;
      if (!S.some((q) => q[0] <= x + 0.05 && q[1] >= x - 0.05 && q[2] <= z + 0.05 && q[3] >= z - 0.05 && q[4] <= CO!.y + 0.3 && q[5] >= CO!.y + 0.9)) unfenced.push(`(${x.toFixed(1)}, ${z.toFixed(1)})`);
    }
  }
  check("THE STRIP's club: its balcony railed along every open edge, over its gates too, but where a stair comes off", !!CO && CO.railLines.length >= 20 && railPoints > 80 && unfenced.length === 0, unfenced.slice(0, 4).join("; ") || `${railPoints} points along ${CO?.railLines.length ?? 0} rails`);
}

// THE CANYON (rules.districts.canyon, Milestone 641): its blocks inside the south-west L and shut to their roofs; a
// player walks the whole canyon from the south road round the corner to the west road, and in through each passage from
// the ring road; its name seen from the ring road
{
  const CN = (cfg as unknown as { canyon?: { blocks: number[][]; fronts: number } }).canyon;
  const CR = (cfg.rules as unknown as { districts?: { canyon?: { height: number; name: { at: number[]; w: number } } } }).districts?.canyon;
  const S = SOLIDS.solids as number[][];
  // (the outer blocks run half a metre past the map's 152 m edge, so their sides are whole fronts)
  const inL = (b: number[]) => (b[0] >= -152.51 && b[1] <= -42.49 && b[2] >= 107.49 && b[3] <= 152.51) || (b[0] >= -152.51 && b[1] <= -107.49 && b[2] >= 42.49 && b[3] <= 152.51);
  const open = (CN?.blocks ?? []).filter((b) => !S.some((q) => q[0] <= (b[0] + b[1]) / 2 && q[1] >= (b[0] + b[1]) / 2 && q[2] <= (b[2] + b[3]) / 2 && q[3] >= (b[2] + b[3]) / 2 && q[4] <= 0.05 && q[5] >= (CR?.height ?? 26.86) - 0.05));
  check("THE CANYON: its blocks of the pack's lower fronts inside the south-west L, each shut to its roof", !!CN && CN.blocks.length >= 6 && CN.blocks.every(inL) && open.length === 0 && CN.fronts >= 100, `${CN?.blocks.length ?? 0} blocks, ${CN?.fronts ?? 0} fronts, ${open.length} open`);
  // (each front's windows to the open air: a front is lit windows on its own -x face and its frame from behind, its
  // own x from -5 to -2.5 and its own z from minus its length to 0; so from its middle, 3 m behind it is inside its
  // block and a metre out from its windows is not)
  const inBlk = (x: number, z: number) => (CN?.blocks ?? []).some(([x0, x1, z0, z1]) => x > x0 && x < x1 && z > z0 && z < z1);
  const placedC = (cfg as unknown as { chunks: Record<string, { place: unknown[][] }> }).chunks["c-canyon"]?.place ?? [];
  // (UnderWall06 since Milestone 1086, the glass front: the same box as UnderWall00)
  const backwards = (placedC.filter((q) => /\/UnderWall0[016]/.test(String(q[0]))) as Array<[string, number, number, number, number]>).filter(([name, x, , z, yaw]) => {
    const a = (yaw * Math.PI) / 180;
    const [c, s] = [Math.cos(a), Math.sin(a)];
    const own = (lx: number, lz: number) => [x + c * lx + s * lz, z - s * lx + c * lz];
    const mid = /UnderWall01/.test(name) ? -3.75 : -2.5;
    const [bx, bz] = own(-3.75 + 3, mid);
    const [fx, fz] = own(-3.75 - 2.25, mid);
    return !inBlk(bx, bz) || inBlk(fx, fz);
  });
  check("THE CANYON: every front's windows face out of its block, onto the canyon, the passages, the ring road or the roads", !!CN && placedC.length > 0 && backwards.length === 0, backwards.slice(0, 3).map(([, x, , z, yaw]) => `(${x.toFixed(1)}, ${z.toFixed(1)}) at ${yaw}`).join("; ") || `${CN?.fronts ?? 0} fronts face out`);
  const walks: Array<[string, number[][]]> = [
    ["the whole canyon, from the south road round the corner to the west road", [[-45, 125, 0], [-125, 125, 0], [-125, 45, 0]]],
    ["in through the south arm's passage", [[-85, 104, 0], [-85, 125, 0]]],
    ["in through the west arm's passage", [[-104, 85, 0], [-125, 85, 0]]],
  ];
  const said = walks.map(([name, r]) => ({ name, r, w: along(r) }));
  check("THE CANYON: a player walks the whole canyon round its corner, and in through each passage from the ring road", said.every((q) => q.w.k === q.r.length), said.map((q) => `${q.name}: ${q.w.k - 1} of ${q.r.length - 1} legs, at (${q.w.x.toFixed(1)}, ${q.w.z.toFixed(1)})`).join("; "));
  const NM = CR?.name;
  const roadMid = ((cfg.rules as unknown as { ring: number[] }).ring[0] + (cfg.rules as unknown as { ring: number[] }).ring[1]) / 2;
  const inBox = (x: number, y: number, z: number) => solidsIn(x - 0.01 + BR_X, x + 0.01 + BR_X, z - 0.01 + BR_Z, z + 0.01 + BR_Z).some((q) => q.minX <= x + BR_X && q.maxX >= x + BR_X && q.minZ <= z + BR_Z && q.maxZ >= z + BR_Z && q.base < y && q.top > y);
  const blockedAt: string[] = [];
  for (const ex of [-10, 0, 10])
    for (const t of NM ? [-NM.w / 2 + 0.5, 0, NM.w / 2 - 0.5] : []) {
      const [p0, p1] = [[NM!.at[0] + ex, 1.7, roadMid], [NM!.at[0] + t, NM!.at[1], NM!.at[2] - 0.3]];
      const L = Math.hypot(p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]);
      for (let k = 0; k < L; k += 0.25) {
        const f = k / L;
        const q = [p0[0] + (p1[0] - p0[0]) * f, p0[1] + (p1[1] - p0[1]) * f, p0[2] + (p1[2] - p0[2]) * f];
        if (inBox(q[0], q[1], q[2])) {
          blockedAt.push(`from x ${ex} to ${t.toFixed(1)} at (${q.map((v) => v.toFixed(1)).join(", ")})`);
          break;
        }
      }
    }
  const named = ((cfg as unknown as { districtNames?: Array<{ district: string }> }).districtNames ?? []).some((q) => q.district === "canyon");
  check("THE CANYON: its name in yellow-green over the south passage, seen from the ring road", named && !!NM && blockedAt.length === 0, blockedAt.slice(0, 4).join("; ") || "9 sight lines clear");
  // (its walkways, Milestone 642: each L of them walked end to end at their height, and every rail edge, a point every
  // half metre along it, standing in the collision from the walk to past a body's waist)
  const WKc = (cfg as unknown as { canyon?: { walkways?: { y: number; rails: number[][] } } }).canyon?.walkways;
  const y = WKc?.y ?? 3.5;
  const wl: Array<[string, number[][]]> = [
    ["the inner walkways, from the south road round the crossroads to the west road", [[-44, 121.25, y], [-121.25, 121.25, y], [-121.25, 44, y]]],
    ["the outer walkways, the same way round", [[-44, 128.75, y], [-128.75, 128.75, y], [-128.75, 44, y]]],
  ];
  const ww = wl.map(([name, r]) => ({ name, r, w: along(r) }));
  check("THE CANYON: a player walks each L of its walkways end to end, 3.5 m up its walls", !!WKc && ww.every((q) => q.w.k === q.r.length && Math.abs(q.w.y - y) < 0.15), ww.map((q) => `${q.name}: ${q.w.k - 1} of ${q.r.length - 1} legs, at (${q.w.x.toFixed(1)}, ${q.w.z.toFixed(1)}) ${q.w.y.toFixed(2)} m`).join("; "));
  const unrailed: string[] = [];
  for (const [x, z, ox] of WKc?.rails ?? [])
    for (const t of [-1, -0.5, 0, 0.5, 1]) {
      const [px, pz] = ox ? [x, z + t] : [x + t, z];
      if (!S.some((b) => b[0] <= px + 0.05 && b[1] >= px - 0.05 && b[2] <= pz + 0.05 && b[3] >= pz - 0.05 && b[4] <= y + 0.3 && b[5] >= y + 0.9)) unrailed.push(`(${px.toFixed(1)}, ${pz.toFixed(1)})`);
    }
  check("THE CANYON: its walkways railed along every open edge, but where a stair arrives", !!WKc && (WKc.rails.length ?? 0) > 100 && unrailed.length === 0, unrailed.slice(0, 4).join("; ") || `${WKc?.rails.length ?? 0} rail lengths`);
  // (its roofs, Milestone 643: each bridge walked across, from 4 m into one roof to 4 m into the other and back; each
  // piece of cover standing in the collision on the roof; and every roof edge with a drop past it railed, as the
  // walkways' are, but where a bridge arrives)
  const RFc = (cfg as unknown as { canyon?: { roofs?: { y: number; bridges: number[][]; cover: Array<[string, number, number, number, number, number]>; rails: number[][] } } }).canyon?.roofs;
  const ry = RFc?.y ?? 26.86;
  const crossed = (RFc?.bridges ?? []).map(([x, z, yaw]) => {
    const [ux, uz] = Math.abs(yaw % 180) < 1 ? [1, 0] : [0, 1];
    const r = [[x - ux * 9, z - uz * 9, ry], [x + ux * 9, z + uz * 9, ry]];
    return { x, z, there: along(r), back: along([...r].reverse()) };
  });
  check("THE CANYON: a player walks each bridge across the canyon from roof to roof, and back", crossed.length === 4 && crossed.every((q) => q.there.k === 2 && q.back.k === 2), crossed.map((q) => `(${q.x}, ${q.z}): ${q.there.k === 2 ? "across" : `stopped at (${q.there.x.toFixed(1)}, ${q.there.z.toFixed(1)}) ${q.there.y.toFixed(2)} m`}, ${q.back.k === 2 ? "back" : `back stopped at (${q.back.x.toFixed(1)}, ${q.back.z.toFixed(1)}) ${q.back.y.toFixed(2)} m`}`).join("; "));
  // (over its footprint, not at its middle: the roof tank is a shell, its wall round it and its lid 3 m up over nothing)
  const bare = (RFc?.cover ?? []).filter(([, x, z, , hx, hz]) => !S.some((b) => b[0] < x + hx && b[1] > x - hx && b[2] < z + hz && b[3] > z - hz && b[4] <= ry + 0.3 && b[5] >= ry + 0.9));
  check("THE CANYON: cover on its roofs, each piece standing in the collision on the roof", (RFc?.cover.length ?? 0) >= 30 && bare.length === 0, bare.map(([n, x, z]) => `${n} at (${x}, ${z})`).slice(0, 4).join("; ") || `${RFc?.cover.length ?? 0} pieces`);
  const roofOpen: string[] = [];
  for (const [x, z, ox] of RFc?.rails ?? [])
    for (const t of [-1, -0.5, 0, 0.5, 1]) {
      const [px, pz] = ox ? [x, z + t] : [x + t, z];
      if (!S.some((b) => b[0] <= px + 0.05 && b[1] >= px - 0.05 && b[2] <= pz + 0.05 && b[3] >= pz - 0.05 && b[4] <= ry + 0.3 && b[5] >= ry + 0.9)) roofOpen.push(`(${px.toFixed(1)}, ${pz.toFixed(1)})`);
    }
  // (its market floor, Milestone 644: every set of cover the rules list laid, none left out for standing on a street node
  // or cutting the bots' streets in two; the canyon, its passages, walkways and stairs walked with it in place above)
  const MKc = (cfg as unknown as { canyon?: { market?: { laid: number; of: number } } }).canyon?.market;
  check("THE CANYON: its market floor, cover down both walls of both arms and food stands in the passages, every set laid", !!MKc && MKc.of >= 30 && MKc.laid === MKc.of, `${MKc?.laid ?? 0} of ${MKc?.of ?? 0} sets laid`);
  check("THE CANYON: its roofs railed along every drop, but where a bridge arrives", (RFc?.rails.length ?? 0) > 200 && roofOpen.length === 0, roofOpen.slice(0, 4).join("; ") || `${((RFc?.rails.length ?? 0) * 2.5).toFixed(0)} m of edge`);
}

// GLASS HEIGHTS' light (rules.districts.glass.light, Milestone 640): cyan strips under its four gangways, each hung
// against a deck's underside, and its street lamps' heads cyan
{
  const GL = (cfg.rules as unknown as { districts?: { glass?: { light?: { strip: string; remap: string; lampRemap: string; panel: string; panelRemap: string } } } }).districts?.glass?.light;
  const placed = (cfg as unknown as { chunks: Record<string, { place: unknown[][] }> }).chunks["c-glass"]?.place ?? [];
  const strips = placed.filter((q) => GL && String(q[0]).endsWith(`/${GL.strip}`) && q[6] === GL.remap) as Array<[string, number, number, number]>;
  const panels = placed.filter((q) => GL && String(q[0]).endsWith(`/${GL.panel.split("/").pop()}`) && q[6] === GL.panelRemap) as Array<[string, number, number, number]>;
  const S = SOLIDS.solids as number[][];
  const loose = strips.filter(([, x, y, z]) => !S.some((b) => b[0] <= x && b[1] >= x && b[2] <= z && b[3] >= z && b[4] >= y - 0.1 && b[4] <= y + 0.6));
  const heads = placed.filter((q) => GL && String(q[0]).endsWith("/Lighting_Deco002_lgt.prefab") && q[6] === GL.lampRemap).length;
  check("GLASS HEIGHTS' light: cyan strips and panels under its four gangways, each strip hung against a deck's underside, and its street lamps cyan", !!GL && strips.length >= 28 && panels.length >= 8 && loose.length === 0 && heads >= 3, `${strips.length} strips and ${panels.length} panels, ${loose.length} strips hanging free${loose.length ? ` (${loose.slice(0, 3).map(([, x, y, z]) => `(${x.toFixed(1)}, ${y.toFixed(1)}, ${z.toFixed(1)})`).join("; ")})` : ""}, ${heads} cyan street lamps`);
}

// every floor tile the layout draws only (the pack's FloorBasic, "g"), drawn where it is walked: a collision box's top at
// its drawn top over its middle, or the ground's under a tile at the street. THE CANYON's walkways were drawn half a
// metre under their walk from Milestone 642 to 644 (the tile's pivot is its top), and the strips hung under them were lost
// inside the drawn slab; the sizes are the bundle's catalogue's, as the layout reads them
{
  const PAID = process.env.PAID_DIR ?? "C:/Users/jwilb/Downloads/speedkills-paid";
  const cat = existsSync(join(PAID, "neon", "catalogue.json")) ? (JSON.parse(readFileSync(join(PAID, "neon", "catalogue.json"), "utf8")) as Array<{ path: string; size: number[] | null; min: number[] | null; max: number[] | null }>) : [];
  const rows = new Map(cat.filter((r) => r.size).map((r) => [r.path.split("City Builder/")[1] ?? r.path, r]));
  const S = SOLIDS.solids as number[][];
  let tiles = 0;
  const off: string[] = [];
  for (const [chunk, c] of Object.entries((cfg as unknown as { chunks: Record<string, { place: unknown[][] }> }).chunks))
    for (const q of c.place) {
      const r = rows.get(String(q[0]));
      if (!r || !/FloorBasic/.test(String(q[0])) || q[5] !== "g") continue;
      const [x, y, z, yaw] = [q[1], q[2], q[3], q[4]] as number[];
      // (THE TERRACES' grand stair's treads and its walls' courses, in the same brick, walked and stood against by their own
      // checks, Milestones 974 and 975; and the beds' sides and the pergolas' beams, the pack's tiles scaled, no floor at all)
      const TD = (cfg.rules.districts as unknown as { terraces: { ramp: { flight: { mat: string } }; rail: { wall?: { coping?: string } } } }).terraces;
      if (chunk === "c-terraces" && (q[6] === TD.ramp.flight.mat || q[6] === TD.rail.wall?.coping || ((q[8] as number | undefined) ?? 1) !== 1)) continue;
      const sc = (q[8] as number | undefined) ?? 1;
      const top = y + r.max![1] * sc;
      const [mx, mz] = [((r.min![0] + r.max![0]) / 2) * sc, ((r.min![2] + r.max![2]) / 2) * sc];
      const a = (yaw * Math.PI) / 180;
      const [cx, cz] = [x + Math.cos(a) * mx + Math.sin(a) * mz, z - Math.sin(a) * mx + Math.cos(a) * mz];
      tiles++;
      const under = S.some((b) => b[0] <= cx && b[1] >= cx && b[2] <= cz && b[3] >= cz && Math.abs(b[5] - top) < 0.06);
      if (!under && Math.abs(top) > 0.06) off.push(`${chunk} (${cx.toFixed(1)}, ${cz.toFixed(1)}) drawn at ${top.toFixed(2)} m`);
    }
  check("every floor tile drawn where it is walked: a collision top at its drawn top, or the ground", tiles > 500 && off.length === 0, !cat.length ? `no catalogue at ${PAID}/neon` : off.slice(0, 4).join("; ") || `${tiles} tiles`);
}

// THE CANYON's light (rules.districts.canyon.light, Milestone 644): yellow-green strips under its walkways' open edges,
// each hung against a walkway's underside; ceiling lamps down the walkways' middles that the game takes for fill lights'
// spots, over the market floor; and its roofs' street lamps yellow-green
{
  const LG = (cfg.rules as unknown as { districts?: { canyon?: { light?: { strip: string; remap: string; lamp: string; lampRemap: string; roofLamp: string } } } }).districts?.canyon?.light;
  const runs = (cfg as unknown as { canyon?: { walkways?: { y: number; runs: number[][] } } }).canyon?.walkways;
  const placed = (cfg as unknown as { chunks: Record<string, { place: unknown[][] }> }).chunks["c-canyon"]?.place ?? [];
  const strips = placed.filter((q) => LG && String(q[0]).endsWith(`/${LG.strip}`) && q[6] === LG.remap) as Array<[string, number, number, number]>;
  const S = SOLIDS.solids as number[][];
  const loose = strips.filter(([, x, y, z]) => !S.some((b) => b[0] <= x && b[1] >= x && b[2] <= z && b[3] >= z && b[4] >= y - 0.1 && b[4] <= y + 0.6));
  const inRun = (x: number, z: number) => (runs?.runs ?? []).some(([x0, x1, z0, z1]) => x > x0 && x < x1 && z > z0 && z < z1);
  const spots = neonFillSpots().filter((q) => inRun(q.x - BR_X, q.z - BR_Z) && q.y > 1.5 && q.y < (runs?.y ?? 3.5));
  const heads = placed.filter((q) => LG && String(q[0]).endsWith(`/${LG.roofLamp}`) && q[6] === LG.lampRemap).length;
  check("THE CANYON's light: yellow-green strips under its walkways, each hung against one's underside, ceiling lamps under them lit as fill, and street lamps on its roofs", !!LG && strips.length >= 100 && loose.length === 0 && spots.length >= 30 && heads >= 12, `${strips.length} strips, ${loose.length} hanging free${loose.length ? ` (${loose.slice(0, 3).map(([, x, y, z]) => `(${x.toFixed(1)}, ${y.toFixed(1)}, ${z.toFixed(1)})`).join("; ")})` : ""}, ${spots.length} fill spots under the walkways, ${heads} yellow-green lamps on the roofs`);
}

// THE WORKS (rules.districts.works, Milestone 646): its L walked indoors from the south road through both halls of each
// arm and the works block to the east road; each hall shut to a body along every side but at its doors, and roofed; and
// in from the ring road through each arm hall's side doors and out to the edge
{
  const W = (cfg as unknown as { works?: { halls: Array<{ id: string; box: number[]; top: number; doors: Record<string, number[][]> }> } }).works;
  const S = SOLIDS.solids as number[][];
  const route = [[41, 125], [50, 125], [75, 125], [92.5, 125], [110, 125], [125, 125], [125, 110], [125, 92.5], [125, 75], [125, 57.5], [125, 41]].map(([x, z]) => [x, z, 0]);
  const L = along(route);
  check("THE WORKS: a player walks the whole L indoors, from the south road through each arm's halls and the works block to the east road", !!W && L.k === route.length, `${L.k - 1} of ${route.length - 1} legs, at (${L.x.toFixed(1)}, ${L.z.toFixed(1)})`);
  const open: string[] = [];
  for (const h of W?.halls ?? []) {
    const [x0, x1, z0, z1] = h.box;
    for (const [k, line, a0, a1, alongX] of [["n", z0, x0, x1, true], ["s", z1, x0, x1, true], ["w", x0, z0, z1, false], ["e", x1, z0, z1, false]] as Array<[string, number, number, number, boolean]>)
      for (let a = a0 + 0.25; a < a1; a += 0.5) {
        if ((h.doors[k] ?? []).some(([d0, d1]) => a > d0 && a < d1)) continue;
        const [px, pz] = alongX ? [a, line] : [line, a];
        if (!S.some((b) => b[0] <= px + 0.01 && b[1] >= px - 0.01 && b[2] <= pz + 0.01 && b[3] >= pz - 0.01 && b[4] <= 0.3 && b[5] >= 2)) open.push(`${h.id} ${k} (${px.toFixed(1)}, ${pz.toFixed(1)})`);
      }
  }
  const roofless = (W?.halls ?? []).filter((h) => {
    const [cx, cz] = [(h.box[0] + h.box[1]) / 2, (h.box[2] + h.box[3]) / 2];
    return !S.some((b) => b[0] <= cx && b[1] >= cx && b[2] <= cz && b[3] >= cz && Math.abs(b[5] - h.top) < 0.05);
  });
  check("THE WORKS: each hall shut to a body but at its doors, and roofed", (W?.halls.length ?? 0) === 5 && open.length === 0 && roofless.length === 0, [...open.slice(0, 4), ...roofless.map((h) => `${h.id} roofless`)].join("; ") || `${W?.halls.length ?? 0} halls`);
  const sides = (W?.halls ?? []).filter((h) => h.id !== "works").map((h) => {
    const southArm = h.box[2] > 100;
    const m = (southArm ? h.doors.n : h.doors.w)[0];
    const mid = (m[0] + m[1]) / 2;
    const r = southArm ? [[mid, 108, 0], [mid, 130, 0], [mid, 150, 0]] : [[108, mid, 0], [130, mid, 0], [150, mid, 0]];
    return { id: h.id, w: along(r), n: r.length };
  });
  check("THE WORKS: in from the ring road through each arm hall's side doors and out to the edge", sides.length === 4 && sides.every((q) => q.w.k === q.n), sides.map((q) => `${q.id}: ${q.w.k - 1} of ${q.n - 1} legs`).join("; "));
  // (inside the arm halls, Milestone 647: each gallery walked end to end at its height, railed along its open edge but
  // where its stair arrives (the stairs themselves walked with the rest); every set of cover laid; each column floor to
  // the roof slab)
  const IN = (cfg as unknown as { works?: { inside?: { laid: number; of: number; columns: number; galleries: Array<{ hall: string; y: number; a: number[]; b: number[] }>; rails: number[][] } } }).works?.inside;
  const gw = (IN?.galleries ?? []).map((g) => ({ g, w: along([[g.a[0], g.a[1], g.y], [g.b[0], g.b[1], g.y]]) }));
  check("THE WORKS: each arm hall's gallery walked end to end at its height", gw.length === 4 && gw.every((q) => q.w.k === 2 && Math.abs(q.w.y - q.g.y) < 0.15), gw.map((q) => `${q.g.hall}: ${q.w.k === 2 ? "end to end" : `stopped at (${q.w.x.toFixed(1)}, ${q.w.z.toFixed(1)}) ${q.w.y.toFixed(2)} m`}`).join("; "));
  const bareRail = (IN?.rails ?? []).filter(([x, z, y]) => !S.some((b) => b[0] <= x + 0.06 && b[1] >= x - 0.06 && b[2] <= z + 0.06 && b[3] >= z - 0.06 && b[4] <= y + 0.3 && b[5] >= y + 0.9));
  check("THE WORKS: its galleries railed along their open edges, but where a stair arrives", (IN?.rails.length ?? 0) >= 30 && bareRail.length === 0, bareRail.slice(0, 4).map(([x, z]) => `(${x}, ${z})`).join("; ") || `${IN?.rails.length ?? 0} rail lengths`);
  check("THE WORKS: inside the arm halls, columns floor to roof and every set of cover laid", (IN?.columns ?? 0) === 24 && (IN?.of ?? 0) >= 24 && IN?.laid === IN?.of, `${IN?.columns ?? 0} columns, ${IN?.laid ?? 0} of ${IN?.of ?? 0} sets of cover laid`);
  // (the works block's upper floor, Milestone 648: each pad up from the atrium's floor landing on its ring, the ring
  // walked round, its rail standing along every edge of the atrium, its cover laid)
  const UPc = (cfg as unknown as { works?: { upper?: { rails: number[][]; cover: number; walk: number[][] } } }).works?.upper;
  const worksPads = ups.filter((u) => u.q.id.startsWith("works-"));
  const ring = along(UPc?.walk ?? [[0, 0, 0]]);
  const bareRing = (UPc?.rails ?? []).filter(([x, z, y]) => !S.some((b) => b[0] <= x + 0.06 && b[1] >= x - 0.06 && b[2] <= z + 0.06 && b[3] >= z - 0.06 && b[4] <= y + 0.3 && b[5] >= y + 0.9));
  check("THE WORKS: the works block's upper floor, a pad up onto it from each side of the atrium, walked round, the atrium railed", worksPads.length === 2 && worksPads.every((u) => u.ok && Math.abs(u.q.ground - 7) < 0.3) && ring.k === (UPc?.walk.length ?? -1) && (UPc?.rails.length ?? 0) === 21 && bareRing.length === 0 && (UPc?.cover ?? 0) >= 8, `${worksPads.map((u) => u.said).join("; ")}; round the ring ${ring.k - 1} of ${(UPc?.walk.length ?? 1) - 1} legs; ${bareRing.length} of ${UPc?.rails.length ?? 0} rail lengths bare; ${UPc?.cover ?? 0} pieces of cover`);
  // (its yards and roofs, Milestone 649: each yard pad ridden onto its roof, each footbridge walked across and back,
  // every roof edge railed but where a bridge arrives, the roofs' cover standing in the collision on them, every yard
  // piece laid)
  const RWc = (cfg as unknown as { works?: { roofs?: { rails: number[][]; bridges: number[][]; cover: number[][]; names: string[]; laid: number; of: number } } }).works?.roofs;
  const yardPads = ups.filter((u) => u.q.id.startsWith("worksyard-"));
  check("THE WORKS: a pad up each wall of each yard, each landing on the roof over it", yardPads.length === 8 && yardPads.every((u) => u.ok && u.q.ground > 6), yardPads.map((u) => u.said).join("; "));
  const crossed = (RWc?.bridges ?? []).map(([x, z, yaw, y]) => {
    const [ux, uz] = Math.abs(yaw % 180) < 1 ? [1, 0] : [0, 1];
    const r = [[x - ux * 9, z - uz * 9, y], [x + ux * 9, z + uz * 9, y]];
    return { x, z, there: along(r), back: along([...r].reverse()) };
  });
  check("THE WORKS: each footbridge walked across its yard from roof to roof, and back", crossed.length === 2 && crossed.every((q) => q.there.k === 2 && q.back.k === 2), crossed.map((q) => `(${q.x}, ${q.z}): ${q.there.k === 2 ? "across" : `stopped at (${q.there.x.toFixed(1)}, ${q.there.z.toFixed(1)}) ${q.there.y.toFixed(2)} m`}, ${q.back.k === 2 ? "back" : `back stopped at (${q.back.x.toFixed(1)}, ${q.back.z.toFixed(1)}) ${q.back.y.toFixed(2)} m`}`).join("; "));
  const bareRoof = (RWc?.rails ?? []).filter(([x, z, y]) => !S.some((b) => b[0] <= x + 0.06 && b[1] >= x - 0.06 && b[2] <= z + 0.06 && b[3] >= z - 0.06 && b[4] <= y + 0.3 && b[5] >= y + 0.9));
  const unstood = (RWc?.cover ?? []).map((q, i) => ({ q, name: RWc!.names[i] })).filter(({ q: [x, z, hx, hz, y] }) => !S.some((b) => b[0] < x + hx && b[1] > x - hx && b[2] < z + hz && b[3] > z - hz && b[4] <= y + 0.3 && b[5] >= y + 0.9));
  check("THE WORKS: its roofs railed along every drop but where a bridge arrives, their cover standing on them, every yard piece laid", (RWc?.rails.length ?? 0) > 150 && bareRoof.length === 0 && (RWc?.cover.length ?? 0) >= 18 && unstood.length === 0 && (RWc?.of ?? 0) === 8 && RWc?.laid === RWc?.of, [...bareRoof.slice(0, 3).map(([x, z]) => `bare (${x}, ${z})`), ...unstood.slice(0, 3).map(({ q, name }) => `${name} at (${q[0]}, ${q[1]}) not standing`)].join("; ") || `${RWc?.rails.length ?? 0} rail lengths, ${RWc?.cover.length ?? 0} pieces on the roofs, ${RWc?.laid ?? 0} of ${RWc?.of ?? 0} yard pieces`);
}

// THE WORKS' light and name (rules.districts.works.light and .name, Milestone 650): teal strips under its galleries
// and round the works block's atrium, each hung against an underside; teal lamps on its roofs; its name on the south
// arm's second hall seen from the ring road
{
  const LG = (cfg.rules as unknown as { districts?: { works?: { light?: { strip: string; remap: string; roofLamp: string; lampRemap: string }; name?: { at: number[]; w: number } } } }).districts?.works;
  const placed = (cfg as unknown as { chunks: Record<string, { place: unknown[][] }> }).chunks["c-works"]?.place ?? [];
  const strips = placed.filter((q) => LG?.light && String(q[0]).endsWith(`/${LG.light.strip}`) && q[6] === LG.light.remap) as Array<[string, number, number, number]>;
  const S = SOLIDS.solids as number[][];
  const loose = strips.filter(([, x, y, z]) => !S.some((b) => b[0] <= x && b[1] >= x && b[2] <= z && b[3] >= z && b[4] >= y - 0.1 && b[4] <= y + 0.6));
  const heads = placed.filter((q) => LG?.light && String(q[0]).endsWith(`/${LG.light.roofLamp}`) && q[6] === LG.light.lampRemap).length;
  check("THE WORKS' light: teal strips under its galleries and round the works block's atrium, each hung against an underside, and teal lamps on its roofs", !!LG?.light && strips.length >= 60 && loose.length === 0 && heads >= 12, `${strips.length} strips, ${loose.length} hanging free${loose.length ? ` (${loose.slice(0, 3).map(([, x, y, z]) => `(${x.toFixed(1)}, ${y.toFixed(1)}, ${z.toFixed(1)})`).join("; ")})` : ""}, ${heads} teal lamps on the roofs`);
  const NM = LG?.name;
  const roadMid = ((cfg.rules as unknown as { ring: number[] }).ring[0] + (cfg.rules as unknown as { ring: number[] }).ring[1]) / 2;
  const inBox = (x: number, y: number, z: number) => solidsIn(x - 0.01 + BR_X, x + 0.01 + BR_X, z - 0.01 + BR_Z, z + 0.01 + BR_Z).some((q) => q.minX <= x + BR_X && q.maxX >= x + BR_X && q.minZ <= z + BR_Z && q.maxZ >= z + BR_Z && q.base < y && q.top > y);
  const blocked: string[] = [];
  for (const ex of [-10, 0, 10])
    for (const t of NM ? [-NM.w / 2 + 0.5, 0, NM.w / 2 - 0.5] : []) {
      const [p0, p1] = [[NM!.at[0] + ex, 1.7, roadMid], [NM!.at[0] + t, NM!.at[1], NM!.at[2] - 0.3]];
      const L = Math.hypot(p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]);
      for (let k = 0; k < L; k += 0.25) {
        const f = k / L;
        const q = [p0[0] + (p1[0] - p0[0]) * f, p0[1] + (p1[1] - p0[1]) * f, p0[2] + (p1[2] - p0[2]) * f];
        if (inBox(q[0], q[1], q[2])) {
          blocked.push(`from x ${ex} to ${t.toFixed(1)} at (${q.map((v) => v.toFixed(1)).join(", ")})`);
          break;
        }
      }
    }
  const named = ((cfg as unknown as { districtNames?: Array<{ district: string }> }).districtNames ?? []).some((q) => q.district === "works");
  check("THE WORKS: its name in teal on the south arm's second hall, seen from the ring road", named && !!NM && blocked.length === 0, blocked.slice(0, 4).join("; ") || "9 sight lines clear");
}

// THE VAULT's gold trim (rules.tower.floors.at's trim, Milestone 653): the strip light lit gold along its partitions'
// feet, at the floor's height (32 lengths along its plain walls: most of the maze's walls are doors and their fills)
{
  const TR = (cfg.rules.tower.floors.at as unknown as Record<string, { trim?: { strip: string; remap: string } }>)["32"]?.trim;
  const lit = ((cfg as unknown as { chunks: Record<string, { place: unknown[][] }> }).chunks["c-tower"]?.place ?? []).filter((q) => TR && String(q[0]).endsWith(`/${TR.strip}`) && q[6] === TR.remap) as Array<[string, number, number, number]>;
  const off = lit.filter(([, , y]) => y < 32 || y > 32.6);
  // (30 along a maze's partitions; its halls since Milestone 674 have fewer, the gates' walls only)
  const vplan = (cfg.rules.tower as unknown as { floors: { at: Record<string, { plan: string }> } }).floors.at["32"].plan;
  check("THE VAULT: its partitions lit gold along their feet", !!TR && lit.length >= (vplan === "maze" ? 30 : 8) && off.length === 0, `${lit.length} lengths of gold trim, ${off.length} off the floor`);
}

// what the sixth review read wrong (Milestone 651): the names' planes drawn after the city's other see-through pieces
// (THE VAULT's lost two letters to panes behind it drawn over it, "THE ##LT"); and every rope a cable unlit at `zipGlow`
// with lit collars in its colour (lit whole, the ropes read as lasers and glowing tubes, THE WELL's two as debug lines)
{
  const names = scene.getObjectByName("neon:names");
  const planes: THREE.Mesh[] = [];
  names?.traverse((o) => (o as THREE.Mesh).isMesh && planes.push(o as THREE.Mesh));
  const early = planes.filter((m) => m.renderOrder <= 0);
  check("the names' planes drawn after the city's other see-through pieces", planes.length >= 12 && early.length === 0, `${planes.length} name planes, ${early.length} drawn in the scene's own order`);
  const ropes = scene.getObjectByName("neon:ropes");
  const G2 = cfg.game as unknown as { zipGlow: number; zipCollar: { glow: number }; zipCable?: string };
  const byColour = new Map<string, Set<number>>();
  ropes?.traverse((o) => {
    const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
    if (!(o as THREE.Mesh).isMesh || !m?.emissive) return;
    const k = m.emissive.getHexString();
    (byColour.get(k) ?? byColour.set(k, new Set()).get(k)!).add(m.emissiveIntensity);
  });
  // (since Milestone 689 every rope one dark cable, `zipCable`, and only its collars in its colour)
  const cableK = G2.zipCable ? new THREE.Color(G2.zipCable).getHexString() : null;
  const bare = [...byColour].filter(([k, g]) => (cableK ? (k === cableK ? !g.has(G2.zipGlow) : !g.has(G2.zipCollar.glow)) : !g.has(G2.zipGlow) || !g.has(G2.zipCollar.glow))).map(([k]) => `#${k}`);
  check("every rope a cable unlit at zipGlow with lit collars in its colour", byColour.size >= 3 && bare.length === 0 && (!cableK || byColour.has(cableK)), bare.join(", ") || `${byColour.size} rope colours${cableK ? `, the cable #${cableK}` : ""}, each with its collars`);
}

// THE STRIP's light (rules.districts.strip.light, Milestone 599): magenta strips under the club's balcony over its rails,
// a ceiling lamp under every balcony cell that the game takes for a fill light's spot, the street lamps' heads magenta
{
  const LT = (cfg.rules as unknown as { districts?: { strip?: { light?: { strip: string; remap: string; lamp: string; lampRemap: string } } } }).districts?.strip?.light;
  const CL = (cfg as unknown as { strip?: { club?: { hall: number[]; deck: number[][]; y: number } } }).strip?.club;
  const placed = (cfg as unknown as { chunks: Record<string, { place: unknown[][] }> }).chunks["c-strip"]?.place ?? [];
  const n = (name: string | undefined, mat?: string) => placed.filter((q) => name && String(q[0]).endsWith(`/${name.split("/").pop()}`) && (mat === undefined || q[6] === mat)).length;
  const [x0, x1, z0, z1] = CL?.hall ?? [0, 0, 0, 0];
  const spots = neonFillSpots().filter((q) => q.x - BR_X > x0 && q.x - BR_X < x1 && q.z - BR_Z > z0 && q.z - BR_Z < z1 && q.y > 2 && q.y < (CL?.y ?? 0));
  const [strips, lamps, heads] = [n(LT?.strip, LT?.remap), n(LT?.lamp), n("Lighting_Deco002_lgt.prefab", LT?.lampRemap)];
  check("THE STRIP's light: magenta strips under the club's balcony, a ceiling lamp under each balcony cell lit as fill, the street lamps magenta", !!LT && !!CL && strips >= 20 && lamps === CL.deck.length && spots.length === CL.deck.length && heads >= 3, `${strips} strips, ${lamps} lamps of ${CL?.deck.length ?? 0} cells, ${spots.length} fill spots under the balcony, ${heads} magenta street lamps`);
}

// every double-flight stair (rules.doubleStair, Milestone 598): the tower base's twelve, the Sky Ring's four, the capsule
// hotel's six and THE STRIP club's two, each walked up by a player in three lanes across its flights, up their middle
// and as near each side as a body fits (the owner, 2026-10-12: "i can glitch through stairs all the time when going up")
{
  const ST = (cfg as unknown as { stairs?: { list: Array<{ where: string; lanes: number[][][] }> } }).stairs;
  const stuck: string[] = [];
  let walks = 0;
  for (const s of ST?.list ?? [])
    for (const [j, r] of s.lanes.entries()) {
      walks++;
      const w = along(r);
      if (w.k !== r.length || Math.abs(w.y - r.at(-1)![2]) > 0.15) stuck.push(`${s.where} lane ${j + 1}: ${w.k - 1} of ${r.length - 1} legs, at (${w.x.toFixed(1)}, ${w.z.toFixed(1)}) ${w.y.toFixed(2)} m`);
    }
  check("every double-flight stair, the base's, the Sky Ring's, the capsule hotel's, the club's, THE CANYON's and THE WORKS' halls', walked up by a player in three lanes across its flights", (ST?.list.length ?? 0) === 31 && stuck.length === 0, stuck.slice(0, 4).join("; ") + (stuck.length > 4 ? ` and ${stuck.length - 4} more` : "") || `${walks} walks up ${ST?.list.length ?? 0} stairs`);
}

// a city past the fence (src/game/skyline.ts, Milestone 680): a ring of towers all round, none where a body can go (past
// the out-of-bounds margin, the map's half and edge.margin, with 2 m to spare), every top under the dropship's line so no
// ride flies through one, and the ground carried on from where the map's own ends
{
  const { SKYLINE } = await import("../../src/game/skyline");
  const S = (worldCfg as unknown as { skyline: { from: number; inner: number; outer: number } }).skyline;
  const reach = BR_HALF + (worldCfg as unknown as { edge: { margin: number } }).edge.margin + 2;
  const shipY = (await import("../../src/config/squad.json")).default.ship.height;
  const inside = SKYLINE.towers.filter((t) => Math.max(Math.abs(t.x) - t.w / 2, Math.abs(t.z) - t.d / 2) < reach);
  const high = SKYLINE.towers.filter((t) => t.y + t.h >= shipY - 5);
  // (and none in the firing range's footprint, which stands past the fence inside the ring: `keep`, measured off the
  // range's solids in the game, which these checks do not build)
  const range = (worldCfg as unknown as { skyline: { keep: number[][] } }).skyline.keep;
  const inRange = SKYLINE.towers.filter((t) => range.some(([x0, x1, z0, z1]) => t.x + t.w / 2 > x0 && t.x - t.w / 2 < x1 && t.z + t.d / 2 > z0 && t.z - t.d / 2 < z1));
  const sides = [(t: { x: number }) => t.x > reach, (t: { x: number }) => t.x < -reach, (t: { z: number }) => t.z > reach, (t: { z: number }) => t.z < -reach].map((f) => SKYLINE.towers.filter(f).length);
  const drawn = scene.getObjectByName("skyline") as THREE.InstancedMesh | undefined;
  const ground = scene.getObjectByName("skylineGround");
  check(
    "a city past the fence: towers on every side, none within the out-of-bounds margin or in the firing range, all under the dropship's line, the ground carried on from the map's own",
    !!drawn && drawn.count === SKYLINE.towers.length && SKYLINE.towers.length >= 200 && sides.every((n) => n >= 40) && inside.length === 0 && inRange.length === 0 && high.length === 0 && !!ground && ground.children.length >= 4 && SKYLINE.ground > S.outer,
    `${SKYLINE.towers.length} blocks (${sides.join("/")} east, west, south, north), ${inside.length} within ${reach} m, ${inRange.length} in the firing range, ${high.length} within 5 m of the ship's ${shipY} m, tallest ${Math.max(...SKYLINE.towers.map((t) => t.y + t.h)).toFixed(0)} m`
  );
}

// the lit roads past the fence (src/game/skyline.ts, Milestone 813): a grid of lines on the ground, every one wholly past
// `from` and under no block, lit at night and not drawn by day
{
  const { skylineHour, SKYLINE } = await import("../../src/game/skyline");
  const RD = (worldCfg as unknown as { skyline: { roads: { from: number } } }).skyline.roads;
  const roads = scene.getObjectByName("skylineRoads") as THREE.InstancedMesh | undefined;
  const [m4, p, s, q] = [new THREE.Matrix4(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Quaternion()];
  // (an interval's nearest point to 0)
  const near = (a: number, b: number) => (a < 0 && b > 0 ? 0 : Math.min(Math.abs(a), Math.abs(b)));
  const [inside, under] = [[] as string[], [] as string[]];
  for (let i = 0; i < (roads?.count ?? 0); i++) {
    roads!.getMatrixAt(i, m4);
    m4.decompose(p, q, s);
    const [x0, x1, z0, z1] = [p.x - s.x / 2, p.x + s.x / 2, p.z - s.z / 2, p.z + s.z / 2];
    if (Math.max(near(x0, x1), near(z0, z1)) < RD.from - 0.01) inside.push(`(${p.x.toFixed(0)}, ${p.z.toFixed(0)})`);
    if (SKYLINE.towers.some((t) => x1 > t.x - t.w / 2 && x0 < t.x + t.w / 2 && z1 > t.z - t.d / 2 && z0 < t.z + t.d / 2)) under.push(`(${p.x.toFixed(0)}, ${p.z.toFixed(0)})`);
  }
  const mat = roads?.material as THREE.MeshBasicMaterial | undefined;
  skylineHour(true);
  const byDay = mat?.visible;
  skylineHour(false);
  const byNight = mat?.visible;
  check(
    "the lit roads past the fence: every line past the fence's band and under no block, lit by night and not drawn by day",
    !!roads && roads.count >= 40 && inside.length === 0 && under.length === 0 && byDay === false && byNight === true,
    `${roads?.count ?? 0} lines, ${inside.length} inside ${RD.from} m${inside.length ? ` (${inside[0]})` : ""}, ${under.length} under a block${under.length ? ` (${under.slice(0, 3).join(", ")})` : ""}, drawn by day ${byDay}, by night ${byNight}`
  );
}

// the edge fence's lines gone toward its top (src/game/world.ts, Milestone 826; the districts' sixth review: from a roof
// beside it "fence wires fan across the sky"): its four sides, each lit to `fade` of its height and dark at its top
{
  const F = (worldCfg as unknown as { edge: { fence: { height: number; fade?: number } } }).edge.fence;
  const sides: THREE.Mesh[] = [];
  scene.traverse((o) => {
    if (o.name === "edgeFence") sides.push(o as THREE.Mesh);
  });
  const faded = sides.filter((m) => {
    const pos = m.geometry.getAttribute("position");
    const col = m.geometry.getAttribute("color");
    if (!col || F.fade === undefined) return false;
    let [lit, dark] = [true, true];
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i) + F.height / 2;
      if (y <= F.fade * F.height + 1e-3 && col.getX(i) < 0.99) lit = false;
      if (y >= F.height - 1e-3 && col.getX(i) > 0.01) dark = false;
    }
    return lit && dark;
  }).length;
  check("the edge fence's lines fade toward its top: each side lit to its fade height and dark at its top", sides.length === 4 && faded === 4, `${faded} of ${sides.length} sides, the fade from ${((F.fade ?? 1) * F.height).toFixed(1)} m of ${F.height}`);
}

// a ring of light round every pad (src/game/padrings.ts, Milestone 668): one a pad on its floor, in its district's colour
// past the ring road, its sector's inside, so the pads of one district read alike and not as the reviews' white wedges
{
  const { padColour } = await import("../../src/game/padrings");
  const rings = scene.getObjectByName("padRings") as THREE.InstancedMesh | undefined;
  const SP = (cfg as unknown as { spine?: { up: Array<{ pad: number[]; floor: number }>; down: Array<{ pad: number[]; floor: number }>; across?: Array<{ pad: number[]; floor: number }> } }).spine;
  const pads = [...cfg.pads, ...(SP?.up ?? []), ...(SP?.down ?? []), ...(SP?.across ?? [])];
  const m4 = new THREE.Matrix4();
  const p = new THREE.Vector3();
  const c = new THREE.Color();
  const off: string[] = [];
  const colours = new Set<string>();
  pads.forEach((q, i) => {
    if (!rings || i >= rings.count) return;
    rings.getMatrixAt(i, m4);
    p.setFromMatrixPosition(m4);
    rings.getColorAt(i, c);
    colours.add(c.getHexString());
    const want = padColour(q.pad[0], q.pad[1]).multiplyScalar(cfg.game.padRings.glow);
    if (Math.hypot(p.x - q.pad[0], p.z - q.pad[1]) > 0.05 || Math.abs(p.y - q.floor - 0.04) > 0.05 || Math.abs(c.r - want.r) + Math.abs(c.g - want.g) + Math.abs(c.b - want.b) > 0.02) off.push(`(${q.pad.join(", ")})`);
  });
  const district = pads.filter((q) => Math.max(Math.abs(q.pad[0]), Math.abs(q.pad[1])) > cfg.game.padRings.band).length;
  check(
    "a ring of light round every pad, on its floor, in its district's colour past the ring road and its sector's inside",
    !!rings && rings.count === pads.length && off.length === 0 && colours.size >= 6 && district >= 8,
    `${rings?.count ?? 0} rings for ${pads.length} pads (${district} in the districts), ${colours.size} colours, ${off.length} off: ${off.slice(0, 4).join(" ")}`
  );
}

// the decay against the districts' sizes (Milestone 682; docs/PLAN_CITY_FINISH.md "the decay re-timed"): from every
// street node of a wave's sectors, a sprint along the bots' streets (no pad, no rope, no slide: the slowest way a player
// has) reaches a sector still standing inside the wave's warning, at the lobby's fastest pace, in every plan of 400
// seeds. The far corners of the outer districts are the longest runs: measured, so the warning is the right length for
// the map that is drawn now, not the centre's alone it was set on
{
  const { decayPlan, decayRounds, sectorIdAt } = await import("../../src/game/decay");
  const sprint = MOVE.sprintSpeed;
  const rounds = decayRounds("fast");
  const nodes = map.nodes;
  const sectorOf = nodes.map((n) => sectorIdAt(n.x - BR_X, n.z - BR_Z));
  const seen = new Set<string>();
  let worst = { t: 0, warn: 0, at: "", wave: 0, plan: "" };
  let runs = 0;
  for (let seed = 1; seed <= 400; seed++) {
    const plan = decayPlan(seed);
    const key = `${plan.final}:${plan.waves.map((w) => w.join("+")).join("/")}`;
    if (seen.has(key)) continue;
    seen.add(key);
    plan.waves.forEach((wave, w) => {
      // (standing after this wave: every sector of the later waves and the final one)
      const gone = new Set(plan.waves.slice(0, w + 1).flat());
      const dist = new Float64Array(nodes.length).fill(Infinity);
      const todo: number[] = [];
      nodes.forEach((n, i) => {
        if (n.links.length && sectorOf[i] && !gone.has(sectorOf[i]!)) {
          dist[i] = 0;
          todo.push(i);
        }
      });
      // (a plain Dijkstra from every standing node at once; a few thousand nodes)
      const done = new Uint8Array(nodes.length);
      while (todo.length) {
        let b = 0;
        for (let k = 1; k < todo.length; k++) if (dist[todo[k]] < dist[todo[b]]) b = k;
        const i = todo[b];
        todo[b] = todo[todo.length - 1];
        todo.pop();
        if (done[i]) continue;
        done[i] = 1;
        const a = nodes[i];
        for (const j of a.links) {
          const c = nodes[j];
          const d = dist[i] + Math.hypot(c.x - a.x, (c.y ?? 0) - (a.y ?? 0), c.z - a.z);
          if (d < dist[j]) {
            dist[j] = d;
            todo.push(j);
          }
        }
      }
      const warn = rounds[w].warn ?? rounds[w].wait;
      nodes.forEach((n, i) => {
        if (!n.links.length || !sectorOf[i] || !wave.includes(sectorOf[i]!) || !Number.isFinite(dist[i])) return;
        runs++;
        const t = dist[i] / sprint;
        if (t / warn > worst.t / Math.max(worst.warn, 1e-6)) worst = { t, warn, at: `${sectorOf[i]} (${(n.x - BR_X).toFixed(0)}, ${(n.z - BR_Z).toFixed(0)})`, wave: w + 1, plan: key };
      });
    });
  }
  check(
    "the decay against the districts: from every street node of a wave's sectors a sprint reaches a standing sector inside the wave's warning, at the fastest pace, every plan of 400 seeds",
    runs > 0 && worst.t <= worst.warn,
    `${seen.size} plans, ${runs} runs at ${sprint.toFixed(1)} m/s; the longest against its warning ${worst.t.toFixed(1)} s of ${worst.warn.toFixed(0)} s, from ${worst.at} in wave ${worst.wave}`
  );
}

// the finish sweep (Milestone 667): each fault the districts' review (round 2) and the centre's (round 8) named, fixed
// where it stands. The club's walls in the strip's red panels, each laid back to back (one face of the pack's slab is
// drawn, and the back stood as "a black slab"); THE TERMINAL's halls in light hex glass and amber light; the 72 m GLASS
// HEIGHTS tower's chevrons cyan; a mast where LANTERN ALLEYS' lantern lines meet; every roof box in its grey (rules.wear);
// a METRO sign over each court kiosk's door, clear of anything solid (at 3.6 m it stood inside the base hall's ceiling)
{
  const placed = Object.values((cfg as unknown as { chunks: Record<string, { place: unknown[][] }> }).chunks).flatMap((ch) => ch.place);
  const D = cfg.rules.districts as unknown as { strip: { club: { walls: unknown[]; wallMat: string } }; terminal: { hall: { piece: string; count: number; mat: string } }; glass: { buildings: Array<[string, number, number, number, string?]> }; lantern: { court: { web: { from: number[]; mast: string } } } };
  const of = (name: string, mat?: string) => placed.filter((q) => String(q[0]).endsWith(`/${name}`) && (mat === undefined || q[6] === mat));
  const clubWalls = of("CityWallsWall005.prefab", D.strip.club.wallMat).length + of("CityWallsWall00.prefab", D.strip.club.wallMat).length;
  const halls = of(D.terminal.hall.piece, D.terminal.hall.mat).length;
  const tower = D.glass.buildings.find((b) => b[0] === "StreetBuilding00_10x10.prefab" && b[4]);
  const towerOk = !!tower && of(tower[0], tower[4]).length === 1;
  const mast = of(D.lantern.court.web.mast).filter((q) => Math.hypot(Number(q[1]) - D.lantern.court.web.from[0], Number(q[3]) - D.lantern.court.web.from[1]) < 1).length;
  const wear = (cfg.rules as unknown as { wear: Record<string, string> }).wear;
  const unworn = Object.entries(wear).flatMap(([name, mat]) => of(name).filter((q) => !q[6] || (q[6] !== mat && !String(q[6]).includes("=")))).length;
  const worn = Object.entries(wear).reduce((n, [name, mat]) => n + of(name, mat).length, 0);
  const labels = (cfg as unknown as { labels?: Array<{ text: string; at: number[]; yaw: number; w: number; h: number }> }).labels ?? [];
  // (its face seen: across its width at its middle height, 0.3 m out in front of it, nothing solid; the collision's
  // cells round the kiosk reach a cell past its drawn face, so the sign's own plane is tested from just in front)
  const buried = labels.filter((q) => {
    const [ux, uz] = [Math.cos((q.yaw * Math.PI) / 180), -Math.sin((q.yaw * Math.PI) / 180)];
    const [nx, nz] = [Math.sin((q.yaw * Math.PI) / 180), Math.cos((q.yaw * Math.PI) / 180)];
    for (let a = -0.5; a <= 0.5; a += 0.25)
      for (const b of [0]) {
        const [x, y, z] = [q.at[0] + ux * a * q.w + nx * 0.3 + BR_X, q.at[1] + b * q.h, q.at[2] + uz * a * q.w + nz * 0.3 + BR_Z];
        if (solidsIn(x, x, z, z).some((s) => x >= s.minX && x <= s.maxX && z >= s.minZ && z <= s.maxZ && y > s.base && y < s.top)) return true;
      }
    return false;
  });
  check(
    "the finish sweep: the club's walls red and back to back, THE TERMINAL's halls glass and amber, GLASS HEIGHTS' tower in its own wear, a mast where the lantern lines meet, every roof box grey, a METRO sign over each kiosk clear of the ceiling",
    clubWalls === 2 * D.strip.club.walls.length && halls === D.terminal.hall.count && towerOk && mast === 1 && unworn === 0 && worn >= 30 && labels.length === 2 && buried.length === 0,
    `${clubWalls} club walls, ${halls} halls, tower ${towerOk}, ${mast} mast, ${worn} roof boxes worn grey (${unworn} not), ${labels.length} signs (${buried.length} in something solid)`
  );
}

// a pool of light under every street lamp by night (src/game/lightpools.ts, Milestone 681): one a lamp (the arenas' own
// left out), on its lamp's floor, in its place's colour mixed with the lamp's warm white
// (since Milestone 1090 the districts' washes a mesh of their own, `lightWashes`, broad and even, and the lamps' pools
// bright under the lamp with a long dim tail: half their middle's brightness by 35% of the radius, where the old falloff
// still had 77%, and nothing left at the rim)
{
  const pools = scene.getObjectByName("lightPools") as THREE.InstancedMesh | undefined;
  const washes = scene.getObjectByName("lightWashes") as THREE.InstancedMesh | undefined;
  const P = (cfg.game as unknown as { pools: { sets: Array<{ pieces: string[] }>; lift: number } }).pools;
  const lamps = Object.entries((cfg as unknown as { chunks: Record<string, { place: unknown[][] }> }).chunks)
    .filter(([id]) => !id.startsWith("a-"))
    .flatMap(([, ch]) => ch.place)
    .filter((q) => P.sets[0].pieces.includes(String(q[0]).split("/").pop()!));
  const { poolSpots, lampPool, washPool } = await import("../../src/game/lightpools");
  const all = poolSpots();
  const shaped = lampPool(0.35) <= 0.5 * lampPool(0) && lampPool(0.999) < 0.01 && washPool(0.35) > 0.7;
  const m4 = new THREE.Matrix4();
  const p = new THREE.Vector3();
  let off = 0;
  // (but those whose pool its trim drops, Milestone 810: the lamps round THE WELL, whose pools lay over its shaft)
  const TR = new Map((((cfg.game as unknown as { pools: { trim?: number[][] } }).pools.trim ?? []) as number[][]).map(([x, z, r]) => [`${x.toFixed(2)},${z.toFixed(2)}`, r]));
  const lit = lamps.filter((q) => TR.get(`${Number(q[1]).toFixed(2)},${Number(q[3]).toFixed(2)}`) !== 0);
  lit.forEach((q, i) => {
    if (!pools || i >= pools.count) return;
    pools.getMatrixAt(i, m4);
    p.setFromMatrixPosition(m4);
    if (Math.hypot(p.x - Number(q[1]), p.z - Number(q[3])) > 0.05 || Math.abs(p.y - Number(q[2]) - P.lift) > 0.05) off++;
  });
  check(
    "a pool of light under every street lamp by night, on its floor, the arenas' own left out, bright under the lamp and fading to nothing; small ones under LANTERN ALLEYS' lanterns, a broad wash of each district's colour",
    !!pools && !!washes && washes.count === 8 && pools.count + washes.count === all.length && lamps.length >= 100 && off === 0 && all.length - lit.length >= 8 + 100 && shaped,
    `${pools?.count ?? 0} pools (${lit.length} of ${lamps.length} street lamps, ${all.length - lit.length - 8} lanterns and the centre's own), ${washes?.count ?? 0} district washes, ${off} off their lamp; a pool at 35% of its radius ${(lampPool(0.35) * 100).toFixed(0)}% of its middle, at its rim ${(lampPool(0.999) * 100).toFixed(1)}%`
  );
}

// the districts' own faces (Milestones 669 to 672): GLASS HEIGHTS' four peninsula towers in white and cyan glass; THE
// CANYON's cliffs with blade signs over its walkways and wall units up them, none low enough to meet a body on a walkway
// (3.5 m, a standing body and a jump over it) and none out over the canyon's middle; THE WORKS' doors each under a lintel
// at its height (two half walls back to back to a 10 m door) and colliding there, its halls' outside panels lit teal;
// THE STRIP's club with a lit dance floor, the DJ's booth standing and the rig over it
{
  const placed = Object.values((cfg as unknown as { chunks: Record<string, { place: unknown[][] }> }).chunks).flatMap((ch) => ch.place);
  const D = cfg.rules.districts as unknown as {
    glass: { buildings: Array<[string, number, number, number, string?]> };
    canyon: { cliffs: { signs: { pieces: string[] }; units: { pieces: string[] } } };
    works: { wall: string; lintel: number; storey: number; facade: { piece: string; remap: string }; halls: Array<{ box: number[]; doors: Record<string, number[]> }> };
  };
  const towers = D.glass.buildings.filter((b) => b[0].startsWith("HighPlatform_Peninsula"));
  const glassOk = towers.length === 4 && towers.every((b) => placed.some((q) => String(q[0]).endsWith(`/${b[0]}`) && q[6] === b[4]));
  const C = (cfg as unknown as { canyon: { cliffs?: { signs: number; units: number } } }).canyon.cliffs;
  // (past the ring road: MARKET's corner block, inside it, wears the same signs on its fronts)
  const canyonPlaced = placed.filter((q) => [...D.canyon.cliffs.signs.pieces, ...D.canyon.cliffs.units.pieces].some((n) => String(q[0]).endsWith(`/${n.split("/").pop()}`)) && Number(q[1]) < -40 && Number(q[3]) > 40 && Math.max(-Number(q[1]), Number(q[3])) > 105 && q[5] === "g");
  const low = canyonPlaced.filter((q) => Number(q[2]) < 5.4);
  // (the canyon's middle: 5 m either side of its arms' middle lines, z 125 and x -125)
  const out = canyonPlaced.filter((q) => (Math.abs(Number(q[3]) - 125) < 2.6 && Number(q[1]) > -122) || (Math.abs(Number(q[1]) + 125) < 2.6 && Number(q[3]) < 122));
  const W = D.works;
  const doors = W.halls.reduce((n, h) => n + Object.values(h.doors).reduce((m, at) => m + at.length, 0), 0);
  const lintels = placed.filter((q) => String(q[0]).endsWith(`/${W.wall}`) && Math.abs(Number(q[2]) - W.lintel) < 0.01 && q[8] === 0.5).length;
  const lintelBoxes = (SOLIDS as { solids: number[][] }).solids.filter((b) => Math.abs(b[4] - W.lintel) < 0.05 && Math.abs(b[5] - W.storey) < 0.05 && Math.max(b[1] - b[0], b[3] - b[2]) > 9.5).length;
  const teal = placed.filter((q) => String(q[0]).endsWith(`/${W.facade.piece}`) && q[6] === W.facade.remap && Number(q[1]) > 40 && Number(q[3]) > 40).length;
  const club = (cfg as unknown as { strip: { club: { dance?: { tiles: number; booth: number; rig: number; left: string[] } } } }).strip.club.dance;
  check(
    "the districts' faces: GLASS HEIGHTS' towers in white and cyan, THE CANYON's cliffs signed and dressed above the walkways and off its middle, THE WORKS' doors under lintels that collide and its halls lit teal, THE STRIP's club a dance floor with its booth and rig",
    glassOk && (C?.signs ?? 0) >= 30 && (C?.units ?? 0) >= 40 && low.length === 0 && out.length === 0 && lintels === doors * 4 && lintelBoxes >= doors && teal >= 60 && !!club && club.tiles === 6 && club.booth === 4 && club.rig === (cfg.rules.districts as unknown as { strip: { club: { dance: { rig: unknown[] } } } }).strip.club.dance.rig.length && club.left.length === 0,
    `glass ${glassOk}; canyon ${C?.signs ?? 0} signs, ${C?.units ?? 0} units (${low.length} low, ${out.length} over the middle); works ${lintels} lintel halves for ${doors} doors, ${lintelBoxes} lintel boxes, ${teal} teal strips; club ${club ? `${club.tiles} tiles, ${club.booth} booth, ${club.rig} rig${club.left.length ? `, left out ${club.left.join(", ")}` : ""}` : "none"}`
  );
}

// the centre's payoffs (Milestones 673 and 674): cover on the base roof (the perches' check counts it) and THE VAULT four
// halls of the strongroom's crates and racks
{
  const placed = Object.values((cfg as unknown as { chunks: Record<string, { place: unknown[][] }> }).chunks).flatMap((ch) => ch.place) as Array<[string, number, number, number]>;
  const V = (cfg.rules.tower as unknown as { floors: { at: Record<string, { plan: string; pieces?: string[] }> } }).floors.at["32"];
  const vault = placed.filter((p) => (V.pieces ?? []).some((n) => String(p[0]).endsWith(`/${n}`)) && p[2] > 31.5 && p[2] < 34.5 && Math.abs(p[1]) < 22 && Math.abs(p[3]) < 22).length;
  const base = ((cfg as unknown as { perches: Array<{ name: string; at: unknown[] }> }).perches.find((q) => q.name === "base-roof")?.at.length ?? 0);
  check(
    "the centre's payoffs: cover on the base roof, THE VAULT four halls of the strongroom's crates and racks",
    base >= 8 && V.plan === "halls" && vault >= 8,
    `base roof ${base}; the vault ${V.plan}, ${vault} of its pieces`
  );
}

// the corner blocks' marks and the doors (Milestones 676, 678 and 681's second half): a lit cap along THE WELL's rail, on
// its top and nowhere over the hole, and a pool of light at its bottom; MOTEL HILL's pole sign on
// its roof showing its ad; each walk-in's door under an awning and two lit strips; THE STRIP's wash the brightest
{
  const { outlineBoxes } = await import("../../src/game/outlines");
  const { poolSpots } = await import("../../src/game/lightpools");
  const W = (cfg as unknown as { well: { hole: number[]; bottom: number } }).well;
  const boxes = outlineBoxes();
  const [hx0, hx1, hz0, hz1] = W.hole;
  // (each cap on a box of the bake's own collision, its top the rail's: the rail curves inside the hole's measured
  // rectangle, so a cap is checked against the rail it stands on, not the rectangle)
  const overHole = boxes.filter((b) => b[4] < 5 && !(SOLIDS as { solids: number[][] }).solids.some((q) => (b[0] + b[1]) / 2 >= q[0] && (b[0] + b[1]) / 2 <= q[1] && (b[2] + b[3]) / 2 >= q[2] && (b[2] + b[3]) / 2 <= q[3] && Math.abs(q[5] - b[4]) < 0.01)).length;
  const bottom = poolSpots().some((q) => Math.abs(q[1] - W.bottom) < 0.01 && q[0] > hx0 && q[0] < hx1 && q[2] > hz0 && q[2] < hz1);
  const placed = Object.values((cfg as unknown as { chunks: Record<string, { place: unknown[][] }> }).chunks).flatMap((ch) => ch.place);
  const sign = ((cfg as unknown as { perches: Array<{ name: string; at: unknown[] }> }).perches.find((q) => q.name === "motel-sign")?.at.length ?? 0);
  const signWorn = placed.filter((q) => String(q[0]).endsWith("/AD_Structure02.prefab") && q[6]).length === placed.filter((q) => String(q[0]).endsWith("/AD_Structure02.prefab")).length;
  const D = (cfg.rules.low as unknown as { walkIn: { door: { awning: string; strip: string; remap: string } } }).walkIn.door;
  const walk = ((cfg as unknown as { walkIns: unknown[] }).walkIns ?? []).length;
  // (the corner blocks' own: THE CANYON's stalls wear the same awning, Milestone 886)
  // (the doors' own, unworn: the corner blocks' kits' stalls and canopies wear the same awning in their cloths, Milestone 1084)
  const awnings = Object.entries((cfg as unknown as { chunks: Record<string, { place: unknown[][] }> }).chunks).filter(([k]) => /^c-[ns][ew]$/.test(k)).flatMap(([, ch]) => ch.place).filter((q) => String(q[0]).endsWith(`/${D.awning}`) && !q[6]).length;
  const strips = placed.filter((q) => String(q[0]).endsWith(`/${D.strip}`) && q[6] === D.remap).length;
  const PK = (cfg.game as unknown as { pools: { wash: { k: number }; washK: Record<string, number> } }).pools;
  const brightest = Object.values(PK.washK).every((k) => k > PK.wash.k) && (PK.washK.strip ?? 0) > PK.wash.k;
  // (the tower lit by its storey bands since Milestone 1046, where four corner posts 97 m tall stood: each band
  // rules.tower.storeyBands asks for, laid by the bake round the facade)
  // (since Milestone 1081 each line a played storey touches alone, rules.tower.lit: the dummy storeys dark)
  const SBs = (cfg.rules.tower as unknown as { storeyBands?: { at: number[][] } }).storeyBands?.at ?? [];
  const LITs = (cfg.rules.tower as unknown as { lit?: { spans: Array<[number, number, string]> } }).lit?.spans;
  const SBlit = LITs ? SBs.filter(([h]) => LITs.some(([y0, y1]) => Math.abs(y0 - h) < 0.01 || (h > y0 + 0.01 && h <= y1 + 0.01))) : SBs;
  const litBands = ((cfg.tower as unknown as { measured: { storeyBands?: Array<{ at: number; length: number }> } }).measured.storeyBands ?? []).filter((b) => b.length > 60).length;
  const storeysLit = SBlit.length > 0 && litBands === SBlit.length;
  check(
    "the corner blocks' marks and the doors: the tower lit a storey at a time, a pool of light at THE WELL's bottom, MOTEL HILL's pole sign showing its ad, each walk-in's door under an awning and two lit strips, THE STRIP's wash the brightest",
    storeysLit && bottom && sign === 1 && signWorn && walk >= 4 && awnings === walk && strips === 2 * walk && brightest,
    `${litBands} of ${SBlit.length} played storeys' lines banded round the tower, ${overHole} of ${boxes.length} lit strips off their boxes, a pool at the bottom ${bottom}; the pole sign ${sign}, every ad stand worn ${signWorn}; ${awnings} awnings and ${strips} strips for ${walk} walk-ins; the strip's wash ${PK.washK.strip} over ${PK.wash.k}`
  );
}

// the hand-placed pieces (rules.dress.extras, Milestone 687): every one laid, drawn only, THE WORKS' pipes over its doors'
// lintels and THE CANYON's lantern lines over a body on its walkways, their lanterns only over its floor's middle
{
  const EX = (cfg.rules.dress as unknown as { extras?: Array<[string, string, number, number, number, number]> }).extras ?? [];
  const placed = Object.values((cfg as unknown as { chunks: Record<string, { place: unknown[][] }> }).chunks).flatMap((ch) => ch.place);
  const laid = EX.filter(([, name]) => placed.some((q) => String(q[0]).endsWith(`/${name}`) && q[5] === "g")).length;
  // (a bundle's pivot is its top: its sag hangs 2.2 m under it, Milestone 772)
  const low = EX.filter(([, name, , , , y]) => (/CableBunch/.test(name) ? y < 7.8 : /Cable|Lamp/.test(name) ? y < 5.6 : y < 3.6)).length;
  const lanternsOffMiddle = EX.filter(([chunk, name, x, z]) => chunk === "c-canyon" && /ChineseLamp/.test(name) && Math.abs(z - 125) > 2.6 && Math.abs(x + 125) > 2.6).length;
  check(
    "the hand-placed pieces: THE WORKS' pipe runs across its yards and THE CANYON's cable bundles, all laid drawn only, over a body's head",
    EX.length >= 26 && EX.filter(([chunk, name]) => chunk === "c-canyon" && /CableBunch/.test(name)).length === 18 && laid === EX.length && low === 0 && lanternsOffMiddle === 0 && (cfg as unknown as { extras?: number }).extras === EX.length,
    `${EX.length} pieces, ${laid} laid, ${low} too low, ${lanternsOffMiddle} lanterns over a walkway`
  );
}

// the lighting pass (Milestone 688): fill spots over THE TERMINAL's concourse and every one of THE WORKS' halls, none in
// anything solid; THE STRIP's dance floor in lit panes; its pyramid's four ridges and foot outlined
{
  const FR = (cfg.game as unknown as { fill: { rects?: number[][] } }).fill.rects ?? [];
  const spots = neonFillSpots();
  const empty = FR.filter(([x0, x1, z0, z1, y]) => !spots.some((q) => q.x - BR_X > x0 && q.x - BR_X < x1 && q.z - BR_Z > z0 && q.z - BR_Z < z1 && q.y > y && q.y < y + 6));
  const mats = (cfg.rules.districts as unknown as { strip: { club: { dance: { mats: string[] } } } }).strip.club.dance.mats;
  const O = (cfg.game as unknown as { outlines: Array<{ name: string }> }).outlines;
  // (its ridges and foot: its steps are counted on their own since Milestone 786)
  const ridges = O.filter((q) => q.name.startsWith("the strip pyramid") && !q.name.startsWith("the strip pyramid step")).length;
  check(
    "the lighting pass: fill light over THE TERMINAL's concourse and THE WORKS' halls, THE STRIP's dance floor in lit panes, its pyramid's ridges and foot in light",
    FR.length >= 6 && empty.length === 0 && mats.every((m) => m.includes("^#")) && ridges === 5,
    `${FR.length} floors with fill (${empty.length} with no spot), dance floor ${mats.join(" / ")}, ${ridges} pyramid outlines`
  );
}

// the centre's ground and THE VAULT (Milestone 689): the street cover's carriageway set real cover (no drawn-only planter
// alone), THE VAULT's gates in gold steel, its floor edged in gold light
{
  const CO = (cfg.rules.dress as unknown as { cover: { road: string[] } }).cover;
  const placed = Object.values((cfg as unknown as { chunks: Record<string, { place: unknown[][] }> }).chunks).flatMap((ch) => ch.place);
  const V = (cfg.rules.tower as unknown as { floors: { gate: string; at: Record<string, { gateMat?: string }> } }).floors;
  const gold = placed.filter((q) => String(q[0]).endsWith(`/${V.gate}`) && Number(q[2]) > 31 && Number(q[2]) < 33 && String(q[6] ?? "").includes(V.at["32"].gateMat ?? "none")).length;
  const edge = (cfg.game as unknown as { outlines: Array<{ name: string }> }).outlines.some((q) => q.name === "the vault floor");
  const street = ((cfg as unknown as { streetCover?: unknown[] }).streetCover ?? []).length;
  check(
    "the centre's ground and THE VAULT: the carriageway's cover real cover, THE VAULT's gates gold, its floor edged in gold light",
    CO.road.length >= 2 && CO.road[0] !== "GardenPit_premade00c Variant.prefab" && gold >= 4 && edge && street >= 120,
    `carriageway set ${CO.road.join(", ")}, ${street} pieces of street cover, ${gold} gold gates, edge ${edge}`
  );
}

// the tenth reviews' finish (Milestone 689): no beam over a pad, the flying cars over NOODLE ROW's lantern lines and under
// the bridges, the zip ropes dark, the roof box grey, GLASS HEIGHTS' tower without its brown panels, THE VAULT's floor gold
{
  const placed = Object.values((cfg as unknown as { chunks: Record<string, { place: unknown[][] }> }).chunks).flatMap((ch) => ch.place);
  const FLY = (cfg.rules.dress as unknown as { flying: { pieces: string[] } }).flying.pieces;
  const cars = placed.filter((q) => FLY.some((f) => String(q[0]).endsWith(`/${f}`)) && q[5] === "g");
  const low = cars.filter((q) => Number(q[2]) < 19 || Number(q[2]) > 24.5).length;
  const PB = (cfg.baked as unknown as { padBeams?: { drawn: number } }).padBeams;
  const G = cfg.game as unknown as { zipCable?: string; zipRope: number };
  const box = placed.filter((q) => String(q[0]).endsWith("/Coolbox00.prefab"));
  const boxGrey = box.every((q) => q[6] == null || String(q[6]).includes("MetalBare01Dust"));
  const tower = placed.find((q) => String(q[0]).endsWith("/StreetBuilding00_10x10.prefab") && Number(q[3]) < -130);
  // (THE VAULT's floor tinted gold, or since Milestone 823 the pack's gold marble)
  const V = (cfg.rules.tower as unknown as { floors: { at: Record<string, { floorMat?: string }> } }).floors.at["32"];
  check(
    "the tenth reviews' finish: no beam over a pad, the flying cars 19 to 24 m up, the zip ropes dark and thin, the roof box grey, GLASS HEIGHTS' tower without its brown panels, THE VAULT's floor gold",
    !!PB && PB.drawn === 0 && cars.length >= 10 && low === 0 && !!G.zipCable && G.zipRope <= 0.04 && boxGrey && String(tower?.[6] ?? "").includes("Concrete03d=") && /\*#|Gold/.test(String(V.floorMat)),
    `${PB?.drawn ?? "?"} pad beams, ${cars.length} flying cars (${low} out of 19 to 24 m), rope ${G.zipCable} ${G.zipRope} m, ${box.length} roof boxes grey ${boxGrey}, tower ${tower?.[6] ?? "missing"}, the vault floor ${V.floorMat}`
  );
}

// every climb marked (Milestone 774): a lit frame at the foot of each fire escape and each stair onto the Sky Ring and the
// base, standing on the street, each within 2.5 m of the climb's first step (the collision's lowest step box under 0.6 m,
// or for the fire escapes, whose first step is 1.5 m up, a step box under 2 m). Ten since Milestone 1098: the High City fire
// escapes' two frames read as free-standing portals (round 21, B, 27), and their first flights are lit up their treads instead
// (game.outlines, the fire escape * flight, checked with the street finish)
{
  const { outlineBoxes } = await import("../../src/game/outlines");
  const CL = (cfg.game as unknown as { outlines: Array<{ name: string; frames?: number[][] }> }).outlines.find((q) => q.name === "the climbs");
  const boxes = outlineBoxes();
  const S2 = (SOLIDS as { solids: number[][] }).solids;
  const far = (CL?.frames ?? []).filter(([x, z]) => !S2.some((b) => b[5] > 0.1 && b[5] < 2 && b[4] < 1.6 && Math.max(b[0] - x, x - b[1], 0) < 2.5 && Math.max(b[2] - z, z - b[3], 0) < 2.5));
  const onStreet = (CL?.frames ?? []).every(([, , , y]) => y === 0);
  check(
    "every climb marked: a lit frame at the foot of each fire escape and each stair onto the Sky Ring and the base, on the street, by its first step",
    !!CL && (CL.frames ?? []).length === 10 && far.length === 0 && onStreet && boxes.length >= 39,
    `${CL?.frames?.length ?? 0} frames${far.length ? `; no step by ${far.map(([x, z]) => `(${x}, ${z})`).join(", ")}` : ""}`
  );
}

// the districts' edges lit (Milestone 776): THE TERRACES' three tier lips, THE CANYON's two walkway edges, a cornice round
// each of THE WORKS' five halls and THE STACKS' hotel roof edge, each strip on or against something solid (a tier's top,
// a walkway's slab, a hall's wall, the hotel's roof) within half a metre
{
  const { outlineBoxes } = await import("../../src/game/outlines");
  const O2 = (cfg.game as unknown as { outlines: Array<{ name: string }> }).outlines;
  const names = O2.map((q) => q.name);
  const want = ["the terraces tier 3", "the terraces tier 6", "the terraces tier 9", "the canyon inner walkway edge", "the canyon outer walkway edge", "the capsule hotel roof edge"];
  const halls = names.filter((n) => /^the works .* cornice$/.test(n)).length;
  // (the edges alone: a climb's frame's lintel and the grand stair's lines stand over openings by design)
  const edge = (n: string) => n.startsWith("the terraces tier") || n.startsWith("the canyon") || /^the works .* cornice$/.test(n) || n === "the capsule hotel roof edge" || / roof cornice$/.test(n);
  const boxes = outlineBoxes(edge);
  const S3 = (SOLIDS as { solids: number[][] }).solids;
  // (each lit strip below 20 m and outside the tower, within half a metre of a box: none hangs in the air)
  const loose = boxes.filter((b) => b[4] < 20 && Math.max(Math.abs((b[0] + b[1]) / 2), Math.abs((b[2] + b[3]) / 2)) > 100 && !S3.some((q) => q[0] < b[1] + 0.5 && q[1] > b[0] - 0.5 && q[2] < b[3] + 0.5 && q[3] > b[2] - 0.5 && q[4] < b[5] + 0.5 && q[5] > b[4] - 0.5)).length;
  check(
    "the districts' edges lit: THE TERRACES' tier lips, THE CANYON's walkway edges, THE WORKS' halls' cornices and THE STACKS' hotel roof edge, none in the air",
    want.every((n) => names.some((m) => m === n || m.startsWith(`${n} `))) && halls === 5 && names.filter((n) => / roof cornice$/.test(n)).length === 3 && loose === 0 && boxes.length > 500,
    `${want.filter((n) => names.some((m) => m === n || m.startsWith(`${n} `))).length} of ${want.length} edges, ${halls} cornices, ${boxes.length} strips, ${loose} in the air`
  );
}

// the pads' columns, the walk-ins' doors and the night's pools (Milestones 779 to 781): a column over every pad's ring, a
// lit frame at each walk-in's door, within half a metre of the front over its door (its door point 2 m out, less 1.75 m
// along its way out, since Milestone 819), pools under the Sky Ring's deck all round
{
  const cols = scene.getObjectByName("padColumns") as THREE.InstancedMesh | undefined;
  const rings = scene.getObjectByName("padRings") as THREE.InstancedMesh | undefined;
  const WI = (cfg as unknown as { walkIns: Array<{ door: number[]; out: number[] }> }).walkIns;
  const DF = (cfg.game as unknown as { outlines: Array<{ name: string; frames?: number[][] }> }).outlines.find((q) => q.name === "the walk-in doors");
  const byDoor = WI.filter((w) => (DF?.frames ?? []).some(([x, z]) => Math.hypot(x - (w.door[0] - w.out[0] * 1.75), z - (w.door[1] - w.out[1] * 1.75)) < 0.5));
  const { poolSpots } = await import("../../src/game/lightpools");
  const SR = (cfg as unknown as { skyring: { r0: number; r1: number } }).skyring;
  const under = poolSpots().filter(([x, y, z]) => y === 0 && Math.hypot(x, z) > SR.r0 && Math.hypot(x, z) < SR.r1).length;
  check(
    "the pads' columns, the walk-ins' doors and the night's pools: a column of light over every pad's ring, a lit frame at each walk-in's door, pools under the Sky Ring all round",
    !!cols && !!rings && cols.count === rings.count && WI.length === 4 && byDoor.length === 4 && under >= 12,
    `${cols?.count ?? 0} columns for ${rings?.count ?? 0} rings, ${byDoor.length} of ${WI.length} doors framed, ${under} pools under the Sky Ring`
  );
}

// GLASS HEIGHTS' tower white with a cyan crown, THE TERRACES' landmark trees, THE STRIP's pyramid stepped in light
// (Milestones 784 to 786): the tower's body worn white and its crown's band cyan; the two tall trees laid on the top tier
// either side of the grand stair's head; every step of the pyramid outlined at its top, each strip on its step's box
{
  const placed = Object.values((cfg as unknown as { chunks: Record<string, { place: unknown[][] }> }).chunks).flatMap((ch) => ch.place);
  const tower = placed.find((q) => String(q[0]).endsWith("/StreetBuilding00_10x10.prefab") && Number(q[3]) < -130);
  const tm = String(tower?.[6] ?? "");
  const LM = (cfg.rules.districts as unknown as { terraces: { garden: { landmarks?: Array<[string, number, number]> } } }).terraces.garden.landmarks ?? [];
  const trees = LM.filter(([name, x, z]) => placed.some((q) => String(q[0]).endsWith(`/${name}`) && Math.hypot(Number(q[1]) - x, Number(q[3]) - z) < 1.5 && Number(q[2]) > 8.9)).length;
  // (by its pivot, which stands off its pit's middle by about a metre: the layout lays a piece by its footprint's middle)
  const { outlineBoxes } = await import("../../src/game/outlines");
  const stepBoxes = outlineBoxes((n) => n.startsWith("the strip pyramid step"));
  const S4 = (SOLIDS as { solids: number[][] }).solids;
  const off = stepBoxes.filter((b) => !S4.some((q) => q[0] < b[1] + 0.1 && q[1] > b[0] - 0.1 && q[2] < b[3] + 0.1 && q[3] > b[2] - 0.1 && Math.abs(q[5] - b[5]) < 0.06)).length;
  check(
    "GLASS HEIGHTS' tower white with a cyan crown, THE TERRACES' two tall trees on its top tier, THE STRIP's pyramid's every step edged in light at its top",
    tm.includes(`MetalBare02=${(cfg.rules.districts as unknown as { glass: { look?: { white: string } } }).glass.look?.white ?? "(no look)"}`) && tm.includes("MetalBare01_lgt 2=") && LM.length === 2 && trees === 2 && stepBoxes.length === 56 && off === 0,
    `tower ${tm.includes(`MetalBare02=${(cfg.rules.districts as unknown as { glass: { look?: { white: string } } }).glass.look?.white ?? "(no look)"}`) ? "white" : "not white"}, ${trees} of ${LM.length} trees on the top tier, ${stepBoxes.length} step strips, ${off} off their steps`
  );
}

// the lit pieces with the decay, the pools on their floors, the centre's lights not white (Milestone 810, the lobby
// agent's bug hunt of 2026-10-27): every outline's, pad ring's and column's and pool's material taught the decay as a
// light; each lamp's pool on a roof or a walkway, its rim at 0.85 of it sampled every 22.5 degrees, on a box topped at
// its height, and none by THE WELL over its hole; the centre's pads' colour its own, not white
{
  // (the districts' washes their own mesh since Milestone 1090)
  const lit = ["outlines", "padRings", "padColumns", "lightPools", "lightWashes"].map((n) => scene.getObjectByName(n) as THREE.Mesh | undefined);
  const taught = lit.filter((m) => m && (m.material as THREE.Material).userData.decay && (m.material as THREE.Material).userData.decayLight).length;
  const { poolSpots } = await import("../../src/game/lightpools");
  const { padColour } = await import("../../src/game/padrings");
  const PK = (cfg.game as unknown as { pools: { wash: { r: number }; spots?: number[][] } }).pools;
  const own = new Set((PK.spots ?? []).map((q) => `${q[0]},${q[2]}`));
  const S5 = (SOLIDS as { solids: number[][] }).solids;
  const H = (cfg as unknown as { well?: { hole: number[] } }).well?.hole ?? [0, 0, 0, 0];
  const onFloor = (x: number, z: number, y: number) => S5.some((b) => x >= b[0] && x <= b[1] && z >= b[2] && z <= b[3] && Math.abs(b[5] - y) < 0.35);
  const spill = poolSpots().filter(([x, y, z, r]) => {
    if (r >= PK.wash.r - 0.01 || own.has(`${x},${z}`)) return false;
    for (let a = 0; a < 16; a++) {
      const [px, pz] = [x + Math.cos((a * Math.PI) / 8) * r * 0.85, z + Math.sin((a * Math.PI) / 8) * r * 0.85];
      if (y > 0.5 ? !onFloor(px, pz, y) : px > H[0] && px < H[1] && pz > H[2] && pz < H[3]) return true;
    }
    return false;
  });
  const centre = padColour(0, -38).getHexString();
  check(
    "the lit pieces go with their sector's decay, every lamp's pool on its floor, the centre's pads and frames not white",
    taught === 5 && spill.length === 0 && centre !== "ffffff",
    `${taught} of 5 lit meshes taught the decay as lights, ${spill.length} pools spilling${spill.length ? ` (first at ${spill[0].slice(0, 3).map((v) => v.toFixed(1)).join(", ")})` : ""}, the centre's colour #${centre}`
  );
}

// THE CANYON's hanging signs, LANTERN ALLEYS' way in all shophouses and THE WORKS lined in teal inside (Milestones 814
// to 816, the districts' fifth review): a banner across the street for each the config asks for, each from wall to wall
// over the walkways' heads; no capsule building in LANTERN ALLEYS' swapped rows; a teal strip on each inside panel of
// THE WORKS' halls, every one of them placed (the outside ones and the inside ones together)
{
  const BN = (cfg as unknown as { banners?: Array<{ at: number[]; span: number }> }).banners ?? [];
  const ask = (cfg.rules as unknown as { districts: { canyon: { cliffs: { banners?: { at: unknown[] } } } } }).districts.canyon.cliffs.banners?.at.length ?? 0;
  const across = BN.filter((b) => Math.abs(b.span - 10) < 0.01 && b.at[1] > 6 && b.at[1] < 20).length;
  const place = (k: string) => (cfg as unknown as { chunks: Record<string, { place: unknown[][] }> }).chunks[k]?.place ?? [];
  const SW = (cfg.rules as unknown as { districts: { lantern: { swap?: { pieces: Record<string, string>; rows: string[] } } } }).districts.lantern.swap;
  const houses = (cfg as unknown as { lanternAlleys: { houses: Array<{ row: string; piece: string }> } }).lanternAlleys.houses;
  const pods = houses.filter((q) => !SW || (SW.rows.includes(q.row) && q.piece in SW.pieces)).length;
  const swapped = houses.filter((q) => SW?.rows.includes(q.row) && Object.values(SW.pieces).includes(q.piece)).length;
  const WS = (cfg as unknown as { works?: { strips?: { facades: number; inside: number } } }).works?.strips;
  const WF = (cfg.rules as unknown as { districts: { works: { facade: { piece: string; remap: string } } } }).districts.works.facade;
  // (under 20 m, the halls' own: the stacks' bands wear the same strip, Milestone 829)
  const teal = place("c-works").filter((q) => String(q[0]).endsWith(`/${WF.piece}`) && q[6] === WF.remap && Number(q[2]) < 20).length;
  check(
    "THE CANYON's banners across the street, LANTERN ALLEYS' way in all shophouses, THE WORKS lined in teal inside",
    ask >= 6 && across === ask && pods === 0 && swapped > 0 && !!WS && WS.inside >= 80 && teal === WS.facades + WS.inside,
    `${across} of ${ask} banners from wall to wall at ${BN.map((b) => b.at[1]).join(", ")} m, ${pods} capsule buildings in LANTERN ALLEYS' rows ${SW?.rows.join(", ") ?? "(none swapped)"}, ${WS?.inside ?? 0} teal strips inside THE WORKS (${teal} placed of ${(WS?.facades ?? 0) + (WS?.inside ?? 0)})`
  );
}

// THE CANYON's first banner seen whole from its south mouth (Milestone 1107, the districts' fifteenth reviews, A, d19: "a
// railing post hides the M of NIGHT MARKET"): from the eye where the review stands in the mouth (d19, x -44 on the street's
// middle), the banner's foot over the top of every fence (the walkways' typed rails, 1 m boxes a body's width or less thick)
// between the eye and it within its width, by 2 degrees and more: seen over the fence, not through its posts
{
  const BN = (cfg as unknown as { banners?: Array<{ text: string; at: number[]; yaw: number; h: number; w: number }> }).banners ?? [];
  const b = BN.find((q) => q.text === "NIGHT MARKET");
  const S3 = (SOLIDS as { solids: number[][] }).solids;
  const eye = [-44, 1.7, 125];
  let worst = 90;
  let over = "";
  if (b) {
    const [bx, by, bz] = b.at;
    const foot = Math.atan2(by - b.h / 2 - eye[1], Math.abs(bx - eye[0]));
    for (const q of S3) {
      const thin = q[1] - q[0] <= 0.35 && q[5] - q[4] > 0.8 && q[5] - q[4] < 1.2;
      if (!thin || q[1] > eye[0] || q[0] < bx || q[3] < bz - b.w / 2 || q[2] > bz + b.w / 2) continue;
      const a = Math.atan2(q[5] - eye[1], eye[0] - q[1]);
      const m = ((foot - a) * 180) / Math.PI;
      if (m < worst) [worst, over] = [m, `(${q[1].toFixed(2)}, ${q[5].toFixed(2)})`];
    }
  }
  check(
    "THE CANYON's NIGHT MARKET banner seen over the walkways' fences from its south mouth, not through their posts",
    !!b && worst >= 2,
    b ? `its foot ${worst.toFixed(1)} degrees over the nearest fence's top${over ? ` at x, y ${over}` : ""}, the banner at ${b.at[1]} m` : "no NIGHT MARKET banner"
  );
}

// the station's concourse a metro's and THE VAULT's ceiling a strongroom's (Milestones 817 and 818, the centre's eleventh
// review): every module of the concourse worn in its own floor's tiles, the tower's basement floor beside the court in
// the court's, and the slab over THE VAULT baked with its underside in the floor's own ceiling
{
  const UC = (cfg.rules as unknown as { underground: { concourse: { piece: string; mat?: string } } }).underground.concourse;
  const mods = ((cfg as unknown as { chunks: Record<string, { place: unknown[][] }> }).chunks["c-station"]?.place ?? []).filter((q) => String(q[0]).endsWith(`/${UC.piece}`));
  const worn = mods.filter((q) => UC.mat && q[6] === UC.mat).length;
  const FA = (cfg.rules as unknown as { tower: { floors: { at: Record<string, { ceilingMat?: string }> } } }).tower.floors.at;
  const want = Object.entries(FA).filter(([, v]) => v.ceilingMat).map(([k, v]) => `${k}:${v.ceilingMat}`);
  const MR = cfg.rules as unknown as { middle: { remap?: string }; court: { floorMat: string } };
  const basement = MR.middle.remap?.split("=")[1]?.split(";")[0];
  const got = ((cfg as unknown as { tower: { measured: { ceilings?: Array<{ over: number; mat: string }> } } }).tower.measured.ceilings ?? []).map((q) => `${q.over}:${q.mat}`);
  check(
    "the station's concourse in its own tiles, the tower's basement in the court's, THE VAULT's ceiling baked in its own",
    !!UC.mat && mods.length >= 4 && worn === mods.length && basement === MR.court.floorMat && want.includes("32:" + FA["32"]?.ceilingMat) && want.every((w) => got.includes(w)),
    `${worn} of ${mods.length} concourse modules worn in ${UC.mat}, the basement in ${basement} (the court ${MR.court.floorMat}), ceilings asked ${want.join(", ") || "none"}, baked ${got.join(", ") || "none"}`
  );
}

// the walk-ins' doors where their doors are and the pads' columns clear of the walls (Milestones 819 and 820, the
// centre's twelfth review): from each walk-in's door point, 2 m out in the street, a body walks in through its door (a
// ray at 1 m and at 1.7 m straight in meets no box for 3.5 m, 1.5 m inside), and each column, at its scale, meets no box standing
// in its height (its circle at a third and two thirds of its height, every 22.5 degrees)
{
  const WI = (cfg as unknown as { walkIns: Array<{ door: number[]; out?: number[] }> }).walkIns;
  const S7 = (SOLIDS as { solids: number[][] }).solids;
  const inBox = (x: number, y: number, z: number) => S7.some((b) => x > b[0] && x < b[1] && z > b[2] && z < b[3] && y > b[4] && y < b[5]);
  const shut = WI.filter((w) => {
    if (!w.out) return true;
    const [dx, dz] = [-w.out[0], -w.out[1]];
    return [1, 1.7].some((y) => {
      for (let k = 0; k <= 3.5; k += 0.1) if (inBox(w.door[0] + dx * k, y, w.door[1] + dz * k)) return true;
      return false;
    });
  });
  const cols = scene.getObjectByName("padColumns") as THREE.InstancedMesh | undefined;
  const PRc = (cfg.game as unknown as { padRings: { outer: number; column: { h: number; r?: number } } }).padRings;
  const [m4, p, s, q] = [new THREE.Matrix4(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Quaternion()];
  const into: string[] = [];
  for (let i = 0; i < (cols?.count ?? 0); i++) {
    cols!.getMatrixAt(i, m4);
    m4.decompose(p, q, s);
    if (s.x < 0.01) continue;
    const r = (PRc.column.r ?? PRc.outer) * s.x - 0.05;
    let hit = false;
    for (const f of [1 / 3, 2 / 3]) for (let a = 0; a < 16 && !hit; a++) hit = inBox(p.x + Math.cos((a * Math.PI) / 8) * r, p.y + PRc.column.h * f, p.z + Math.sin((a * Math.PI) / 8) * r);
    if (hit) into.push(`(${p.x.toFixed(1)}, ${p.z.toFixed(1)})`);
  }
  check(
    "the walk-ins entered through their doors, the pads' columns clear of the walls round them",
    WI.length === 4 && shut.length === 0 && !!cols && cols.count > 40 && into.length === 0,
    `${WI.length - shut.length} of ${WI.length} walk-ins open from their door points${shut.length ? ` (shut: ${shut.map((w) => `(${w.door.join(", ")})`).join(", ")})` : ""}, ${into.length} columns into a wall${into.length ? `: ${into.slice(0, 4).join(", ")}` : ""}`
  );
}

// THE VAULT's gold and the station's hall floored as its concourse (Milestones 823 and 824, the centre's twelfth
// review): every piece of cover on THE VAULT's floor worn in its `coverMat`, its floor in its own tiles, and the hall
// worn in its `mat`
{
  const TF = (cfg.rules as unknown as { tower: { floors: { at: Record<string, { coverMat?: Record<string, string>; floorMat?: string; pieces?: string[] }> } } }).tower.floors.at["32"];
  const vault = ((cfg as unknown as { chunks: Record<string, { place: unknown[][] }> }).chunks["c-tower"]?.place ?? []).filter((q) => q[5] === "o" && Math.abs(Number(q[2]) - 32) < 0.6 && (TF.pieces ?? []).some((n) => String(q[0]).endsWith(`/${n}`)));
  const gold = vault.filter((q) => TF.coverMat && q[6] === TF.coverMat[String(q[0]).split("/").pop()!]).length;
  const HL = (cfg.rules as unknown as { underground: { hall: { piece: string; mat?: string } } }).underground.hall;
  const hall = ((cfg as unknown as { chunks: Record<string, { place: unknown[][] }> }).chunks["c-station"]?.place ?? []).filter((q) => String(q[0]).endsWith(`/${HL.piece}`));
  check(
    "THE VAULT's cover in gold on a gold floor, the station's hall floored as its concourse",
    !!TF.coverMat && Object.keys(TF.coverMat).length >= 3 && vault.length >= 8 && gold === vault.length && /Gold/.test(TF.floorMat ?? "") && !!HL.mat && hall.length === 1 && hall.every((q) => q[6] === HL.mat),
    `${gold} of ${vault.length} pieces on THE VAULT's floor in gold, its floor ${TF.floorMat}, the hall ${hall.map((q) => q[6]).join(", ") || "none"}`
  );
}

// THE STRIP's club roofed (Milestone 825, the districts' sixth review: "the club has no roof"): no canopy over it, the
// roof's tiles over the whole hall at its height, a typed slab under them and the rig of strip lights under that
{
  const CLr = (cfg.rules.districts as unknown as { strip: { chunk: string; club: { canopy: string; roof?: { y: number; slab: number; tile: string; mat: string } } } }).strip;
  const cl = (cfg as unknown as { strip?: { club?: { hall: number[]; roof?: { tiles: number; rig: number } } } }).strip?.club;
  const placedS = (cfg as unknown as { chunks: Record<string, { place: unknown[][] }> }).chunks[CLr.chunk]?.place ?? [];
  const RFc = CLr.club.roof;
  const canopy = placedS.filter((q) => String(q[0]).endsWith(`/${CLr.club.canopy}`)).length;
  const tiles = placedS.filter((q) => RFc && String(q[0]).endsWith(`/${RFc.tile.split("/").pop()}`) && q[6] === RFc.mat).length;
  const H = cl?.hall ?? [0, 0, 0, 0];
  const slab = (SOLIDS as { solids: number[][] }).solids.some((b) => RFc && b[0] <= H[0] + 0.01 && b[1] >= H[1] - 0.01 && b[2] <= H[2] + 0.01 && b[3] >= H[3] - 0.01 && Math.abs(b[5] - RFc.y) < 0.3);
  check(
    "THE STRIP's club roofed: no canopy, its roof's tiles over the whole hall, a slab under them, a rig of lights under that",
    !!RFc && canopy === 0 && !!cl?.roof && tiles === cl.roof.tiles && tiles >= 64 && slab && cl.roof.rig >= 16,
    `${canopy} canopies, ${tiles} roof tiles of ${cl?.roof?.tiles ?? 0}, the slab ${slab ? "in the collision" : "missing"}, ${cl?.roof?.rig ?? 0} rig lights`
  );
}

// THE TERRACES' hedges light and THE TERMINAL's boards (Milestones 870 and 871, the districts' sixth review): every
// material of its 3 m walls of cover worn in a tinted plaster, none in the grass; two boards on THE TERMINAL's front,
// each in front of it, beside its name and off it
{
  const TM = (cfg.rules.dress as unknown as { districtCover: { mats: Record<string, Record<string, string>> } }).districtCover.mats.terraces ?? {};
  const wall = Object.values(TM)[0] ?? "";
  const hedge = wall.split(";").every((r) => /=PlasterDirt00\*#/.test(r)) && !/ETPGrass/.test(wall);
  // (the boards on THE TERMINAL's front: by its name, on its plane)
  const BD = ((cfg.game as unknown as { boards?: Array<{ at: number[]; w: number; h: number; text: string }> }).boards ?? []).filter((b) => Math.abs(b.at[0]) < 20 && Math.abs(b.at[2] - 117.4) < 1);
  const NM = (cfg.rules.districts as unknown as { terminal: { name: { at: number[]; w: number; h: number }; hall: { front: number } } }).terminal;
  const clear = BD.filter((b) => Math.abs(b.at[2] - NM.name.at[2]) < 0.2 && b.at[2] < NM.hall.front && (Math.abs(b.at[0] - NM.name.at[0]) > NM.name.w / 2 + b.w / 2 || b.at[1] + b.h / 2 < NM.name.at[1] - NM.name.h / 2)).length;
  check(
    "THE TERRACES' hedges in tinted plaster, THE TERMINAL's departures board and clock on its front beside its name",
    hedge && BD.length === 2 && clear === 2 && BD.some((b) => b.text === "DEPARTURES"),
    `hedge ${wall}; ${BD.length} boards (${BD.map((b) => b.text).join(", ")}), ${clear} clear of the name`
  );
}

// each corner block's name over its walk-in's door and MARKET's street stalls (Milestones 875 and 876, the centre's
// twelfth review): a board within a metre of the front over each walk-in's door, above its awning; MARKET's stalls all
// laid on its own block (the layout lays them off the street, as NOODLE ROW's)
{
  const WIb = (cfg as unknown as { walkIns: Array<{ door: number[]; out: number[] }> }).walkIns;
  const BDb = (cfg.game as unknown as { boards?: Array<{ text: string; at: number[] }> }).boards ?? [];
  const named = WIb.filter((w) => BDb.some((b) => Math.hypot(b.at[0] - (w.door[0] - w.out[0] * 1.75), b.at[2] - (w.door[1] - w.out[1] * 1.75)) < 1 && b.at[1] > 3.5 && b.at[1] < 6)).length;
  const MS = (cfg.rules.low as unknown as { market: Array<{ save?: string; count: number }> }).market.find((m) => m.save === "marketStalls");
  const ST = (cfg as unknown as { marketStalls?: Array<{ at: number[] }> }).marketStalls ?? [];
  check(
    "each corner block's name over its walk-in's door, MARKET's food stalls on its own ground",
    WIb.length === 4 && named === 4 && !!MS && ST.length === MS.count && ST.every((q) => q.at[0] < 0 && q.at[1] > 0),
    `${named} of ${WIb.length} walk-ins with their block's name over the door; ${ST.length} of ${MS?.count ?? 0} MARKET stalls on its block`
  );
}

// the city past the fence dimmer at night (Milestone 878, the districts' sixth review: "halve its window light at night"):
// the skyline's windows at night under 0.7
{
  const glow = (worldCfg as unknown as { skyline: { glow: { night: number } } }).skyline.glow.night;
  check("the city past the fence dimmer at night", glow < 0.7, `the skyline's night glow ${glow}`);
}
// (and Milestone 1102, the districts' fifteenth reviews, both: "the outer city brighter and cleaner than the play area, the eye
// drifts outward", "at night the outer city's window grid brighter than the playable districts": its walls by day half the
// pack's colours and less, its windows by night under 0.2 with under a quarter lit; and each district's wash at night 0.3 and
// more)
{
  const SK2 = (worldCfg as unknown as { skyline: { lit: number; glow: { night: number }; facade: { body: { day: number } } } }).skyline;
  const WK2 = (cfg.game as unknown as { pools: { wash: { k: number } } }).pools.wash.k;
  check("the city past the fence quieter than the play area: its walls by day dimmed, fewer and dimmer windows by night, the districts' washes brighter", SK2.facade.body.day <= 0.5 && SK2.glow.night < 0.2 && SK2.lit < 0.25 && WK2 >= 0.3, `walls by day ${SK2.facade.body.day}, night glow ${SK2.glow.night}, ${SK2.lit} lit; the districts' washes ${WK2}`);
}

// the ground past the fence pale by day (Milestone 884, the districts' seventh review: "the black ground past the fence a
// pale road by day"): at least three times the night's colour in its green, which carries most of a colour's light
{
  const SKg = (worldCfg as unknown as { skyline: { groundColour: string; groundDay?: string } }).skyline;
  const g = (hex: string) => parseInt(hex.slice(3, 5), 16);
  check("the ground past the fence pale by day", !!SKg.groundDay && g(SKg.groundDay) >= 3 * g(SKg.groundColour), `${SKg.groundDay} by day, ${SKg.groundColour} by night`);
}

// faces in shade not pure black (Milestone 882, the thirteenth reviews): the grade's gamma on the darks, after its S-curve
{
  const { GRADE } = await import("../../src/game/grade");
  check("the grade lifts the darks its S-curve crushes", GRADE.shadowGamma < 0.8 && GRADE.shadowKnee > 0.2 && GRADE.shadowKnee < 0.6, `gamma ${GRADE.shadowGamma} to a luma of ${GRADE.shadowKnee}`);
}

// each district its own cover (Milestone 883, the districts' seventh review: "the white-framed crate pile" in 8 pictures,
// the yellow machines in 7): the crate pile only in THE WORKS, the ticket machines only at THE TERMINAL
{
  const DCp = (cfg as unknown as { districtCover?: Array<{ piece: string; d: string }> }).districtCover ?? [];
  const crates = DCp.filter((q) => q.piece === "crates" && q.d !== "works").length;
  const tickets = DCp.filter((q) => q.piece.startsWith("TicketPickMachine") && q.d !== "terminal").length;
  const kinds = new Set(DCp.map((q) => q.d)).size;
  check("each district its own cover: the crate pile in THE WORKS alone, the ticket machines at THE TERMINAL alone", DCp.length > 100 && kinds === 8 && crates === 0 && tickets === 0, `${DCp.length} pieces in ${kinds} districts, ${crates} crate piles and ${tickets} ticket machines out of place`);
}

// THE WELL lit (Milestone 885, the centre's thirteenth reviews): a cyan strip on each of its beams and METRO at the bottom,
// every plate inside the shaft's footprint and under the street
{
  const BDw = ((cfg.game as unknown as { boards?: Array<{ text: string; at: number[]; h: number }> }).boards ?? []).filter((b) => b.at[1] < 0 && b.at[0] > 73 && b.at[0] < 90 && b.at[2] > 66 && b.at[2] < 88);
  check("THE WELL lit: a strip on each of its beams, METRO at the bottom", BDw.filter((b) => b.h < 0.4).length >= 4 && BDw.some((b) => b.text === "METRO" && b.at[1] < -7), `${BDw.filter((b) => b.h < 0.4).length} strips, ${BDw.filter((b) => b.text).map((b) => b.text).join(", ") || "no sign"}`);
}

// no sign in the Sky Ring's walk (Milestone 970): the signs' rays read its rail's columns as a front
{
  const SKs = cfg.rules.skyring as unknown as { r0: number; r1: number; deck: number };
  const signs = (cfg as unknown as { chunks: Record<string, { place: unknown[][] }> }).chunks["c-signs"]?.place ?? [];
  const onWalk = signs.filter((q) => { const r = Math.hypot(Number(q[1]), Number(q[3])); return r > SKs.r0 && r < SKs.r1 && Number(q[2]) > SKs.deck - 0.5 && Number(q[2]) < SKs.deck + 2.2; });
  check("no sign in the Sky Ring's walk", signs.length > 20 && onWalk.length === 0, `${signs.length} signs, ${onWalk.length} on its deck`);
}

// the tower's floors open between storeys and walked between (Milestones 879, 881 and 827, the centre's twelfth review:
// "holes and inner stairs between floors"): over each hole in a slab, off the collision's half and quarter metre lines
// (on one a point is in no box, and batch 31's first check of this saw a shell's corner disc of floor as open), no box
// tops out at that floor but the stair's own treads, the floor under it is there, and no lamp hangs in it; and each inner
// stair walked up and down by a player in its three lanes, from the floor under it onto the floor over it, no core in it
// (with the slab's plate 0.1 m past the foot the walk stops at 23.25 m: a step up with the head in a slab is a wall)
{
  const FA9 = (cfg.rules.tower as unknown as { floors: { lamp: { piece: string }; at: Record<string, { holes?: number[][] }> } }).floors;
  const S9 = (SOLIDS as { solids: number[][] }).solids;
  const IS9 = (cfg.tower as unknown as { stairs?: Array<{ where: string; box: number[]; lanes: number[][][] }> }).stairs ?? [];
  const towerPlaced = (cfg as unknown as { chunks: Record<string, { place: unknown[][] }> }).chunks["c-tower"]?.place ?? [];
  const lampEnd = `/${FA9.lamp.piece.split("/").pop()}`;
  const res: Array<{ h: number; n: number; open: number; under: number; lamps: number }> = [];
  for (const [hs, P] of Object.entries(FA9.at))
    for (const [x0, x1, z0, z1] of P.holes ?? []) {
      const h = Number(hs);
      let [n, open, under] = [0, 0, 0];
      for (let x = x0 + 0.625; x < x1 - 0.4; x += 0.5)
        for (let z = z0 + 0.625; z < z1 - 0.4; z += 0.5) {
          if (IS9.some((s) => x > s.box[0] - 0.1 && x < s.box[1] + 0.1 && z > s.box[2] - 0.1 && z < s.box[3] + 0.1)) continue;
          n++;
          // (the slab's own: a wall's top under the hole, 2.4 m tall, stands up out of the floor below)
          if (!S9.some((b) => x > b[0] && x < b[1] && z > b[2] && z < b[3] && Math.abs(b[5] - h) < 0.3 && b[5] - b[4] < 1.5)) open++;
          if (S9.some((b) => x > b[0] && x < b[1] && z > b[2] && z < b[3] && Math.abs(b[5] - (h - 3)) < 0.3)) under++;
        }
      const lamps = towerPlaced.filter((q) => String(q[0]).endsWith(lampEnd) && Number(q[2]) > h - 3 && Number(q[2]) < h && Number(q[1]) > x0 && Number(q[1]) < x1 && Number(q[3]) > z0 && Number(q[3]) < z1).length;
      res.push({ h, n, open, under, lamps });
    }
  check(
    "the tower's floors open between storeys: each hole open through its slab, the floor under it there, no lamp in it",
    res.length >= 1 && res.every((r) => r.n >= 4 && r.open === r.n && r.under >= r.n * 0.5 && r.lamps === 0),
    res.map((r) => `${r.h} m: ${r.open} of ${r.n} spots open, ${r.under} over the floor under, ${r.lamps} lamps`).join("; ") || "no holes"
  );
  const stuck: string[] = [];
  let walks = 0;
  for (const s of IS9)
    for (const [j, r] of s.lanes.entries())
      for (const [way, pts] of [["up", r], ["down", [...r].reverse()]] as const) {
        walks++;
        const w = along(pts);
        if (w.k !== pts.length || Math.abs(w.y - pts.at(-1)![2]) > 0.15) stuck.push(`${s.where} lane ${j + 1} ${way}: ${w.k - 1} of ${pts.length - 1} legs, at (${w.x.toFixed(1)}, ${w.z.toFixed(1)}) ${w.y.toFixed(2)} m`);
      }
  check("the tower's inner stairs: each walked up and down by a player in three lanes, no core in it", IS9.length >= 1 && stuck.length === 0, stuck.slice(0, 4).join("; ") || `${walks} walks over ${IS9.length} stairs`);
}

// THE WORKS from outside (Milestones 828 to 829, the districts' review: "black boxes edged in teal, the rust barely shows
// ... big doors, outside stairs, a chimney or crane as a landmark seen from afar"): its walls and lintels glow in their own
// colour maps, its stacks on the works block's roof over the crown tank's 31 m and clear of that roof's pad landings, its
// outside stairs on the fires list, which the fire escape check climbs
{
  const Wk = (cfg.rules.districts as unknown as { works: { wallMat: string; lintelMat?: string; fires?: { at: number[][] }; stacks?: { at: number[][]; clear: number } } }).works;
  const Sk = (cfg as unknown as { works: { stacks?: Array<{ at: number[]; top: number; box: number[] }> } }).works.stacks ?? [];
  const lands = SPINE.up.filter((q) => q.id.startsWith("worksyard-") && q.ground === 14).map((q) => [q.face[0] - q.out[0] * q.land, q.face[1] - q.out[1] * q.land]);
  const near = Sk.map((s) => Math.min(...lands.map(([x, z]) => Math.hypot(Math.max(s.box[0] - x, 0, x - s.box[1]), Math.max(s.box[2] - z, 0, z - s.box[3])))));
  const FW = ((cfg as unknown as { fires?: Array<{ block: string }> }).fires ?? []).filter((f) => f.block.startsWith("THE WORKS"));
  const glowing = [Wk.wallMat, Wk.lintelMat].filter((m) => m?.includes("~#")).length;
  check(
    "THE WORKS from outside: walls and lintels glowing in their own colour maps, two stacks over the crown tank clear of the pads' landings, outside stairs on the fires list",
    glowing === 2 && lands.length === 2 && Sk.length === (Wk.stacks?.at.length ?? 0) && Sk.length >= 2 && Sk.every((s) => s.top > 31 && s.box[4] === 14) && near.every((d) => d >= (Wk.stacks?.clear ?? 0)) && FW.length === (Wk.fires?.at.length ?? 0) && FW.length >= 2,
    `${glowing} of 2 materials; stacks to ${Sk.map((s) => s.top).join(" and ")} m, ${near.map((d) => d.toFixed(1)).join(" and ")} m off a landing; ${FW.length} outside stairs`
  );
}

// THE CANYON's floor a market (Milestones 886 and 887, the districts' sixth review: "stall rows with awnings and goods,
// carts, hanging cloth"): stalls down all four walls, every one under a walkway and off the bots' street nodes, nothing of
// it through the walkway's walk, no food stall's sign frame in a ceiling lamp, the goods laid; and the lines of cloth across
// the street's middle, each panel both ways, over a body on a walkway's rail
{
  type CM = { walkways: { y: number; railH: number; runs: number[][] }; light: { lamp: string }; market: { cloth: { panel: string; wire: string; scale: number; y: number; panels: number; at: unknown[] } } };
  const CN = (cfg.rules as unknown as { districts: { canyon: CM } }).districts.canyon;
  const got = (cfg as unknown as { canyon?: { market?: { stalls?: Array<[string, number, number, number, number, number, number]>; booths?: number; cloth?: number; wires?: number } } }).canyon?.market;
  const ST = got?.stalls ?? [];
  const placedM = (cfg.chunks as unknown as Record<string, { place: unknown[][] }>)["c-canyon"]?.place ?? [];
  const named = (end: string) => placedM.filter((q) => String(q[0]).endsWith(`/${end}`));
  const WKm = CN.walkways;
  const inRun = (x: number, z: number) => WKm.runs.some(([x0, x1, z0, z1]) => x > x0 && x < x1 && z > z0 && z < z1);
  const limM = 152 - (cfg.game as unknown as { graph: { margin: number } }).graph.margin;
  const walk = (cfg.rules as unknown as { perches_clear: { walk: number } }).perches_clear.walk;
  const axes = (yaw: number) => {
    const a = (yaw * Math.PI) / 180;
    return { u: [Math.cos(a), -Math.sin(a)], v: [Math.sin(a), Math.cos(a)] };
  };
  const onNodeM = (x: number, z: number, yaw: number, hu: number, hv: number) => {
    const { u, v } = axes(yaw);
    for (let nx = -limM; nx <= limM + 1e-6; nx += 10)
      for (let nz = -limM; nz <= limM + 1e-6; nz += 10) {
        const [dx, dz] = [nx - x, nz - z];
        if (Math.abs(dx * u[0] + dz * u[1]) < hu + walk && Math.abs(dx * v[0] + dz * v[1]) < hv + walk) return true;
      }
    return false;
  };
  const lamps = named(CN.light.lamp.split("/").pop()!);
  const food = ST.filter((s) => s[0] === "food");
  // (the food stall's sign frame stands to 2.89 m and a lamp hangs to 2.72 m: 1.32 m the stall's half width, 1.57 m the lamp's)
  const inLamp = food.filter(([, x, z, yaw, , hv]) => {
    const { u, v } = axes(yaw);
    return lamps.some((q) => Math.abs(((q[1] as number) - x) * u[0] + ((q[3] as number) - z) * u[1]) < 1.32 + 1.57 && Math.abs(((q[1] as number) - x) * v[0] + ((q[3] as number) - z) * v[1]) < hv + 0.41);
  });
  const offRun = ST.filter(([, x, z]) => !inRun(x, z));
  const nodes = ST.filter(([, x, z, yaw, hu, hv]) => onNodeM(x, z, yaw, hu, hv));
  const high = ST.filter((s) => s[6] > WKm.y - 0.3);
  const walls = [0, 180, 270, 90].map((yaw) => ST.filter((s) => s[3] === yaw).length);
  const awnings = named("Window_sunshade001.prefab").length;
  const goods = named("Table001b Variant.prefab").length + named("Rack00b Variant.prefab").length;
  const CC = CN.market.cloth;
  const panels = named(CC.panel);
  const lowest = Math.min(...panels.map((q) => (q[2] as number) + (-0.5 * CC.scale)));
  check(
    "THE CANYON's floor a market: stalls down all four walls under the walkways and off the street nodes, each under the walk, no food stall in a ceiling lamp, awnings over goods, and lines of cloth across the street over the rails",
    ST.length >= 29 && walls.every((n) => n >= 6) && food.length >= 10 && awnings === ST.length - food.length + (got?.booths ?? 0) && goods >= awnings && offRun.length === 0 && nodes.length === 0 && high.length === 0 && inLamp.length === 0 && (got?.wires ?? 0) === CC.at.length && (got?.cloth ?? 0) === CC.at.length * CC.panels * 2 && panels.length === got?.cloth && lowest >= WKm.y + WKm.railH,
    `${ST.length} stalls (${walls.join(", ")} a wall), ${food.length} food; ${awnings} awnings, ${goods} goods; ${offRun.length} off a walkway, ${nodes.length} on a node, ${high.length} too tall, ${inLamp.length} in a lamp; ${got?.wires ?? 0} lines, ${got?.cloth ?? 0} panel faces, the lowest ${lowest.toFixed(2)} m`
  );
}

// THE TERMINAL's wagons where the player looks (Milestone 888, the districts' sixth review: "a wagon at the end of the
// arcade"): from each end of the hall's north aisle a clear line to a tram on the far strip, through the end arch; and a
// wagon on rails on the forecourt, off the street nodes, in clear sight from the forecourt, a player walking between it
// and the arcade
{
  type TG = { strips: Array<{ x: number; trams: number[][] }>; front?: { piece: string; x: number; z: number; yaw: number; plates: number[] } };
  const TG2 = (cfg.rules as unknown as { districts: { terminal: { trains: TG } } }).districts.terminal.trains;
  const TOg = (cfg as unknown as { terminal?: { front?: number } }).terminal;
  const placeG = (cfg.chunks as unknown as Record<string, { place: unknown[][] }>)["c-terminal"]?.place ?? [];
  const inBoxG = (x: number, y: number, z: number) => solidsIn(x - 0.01 + BR_X, x + 0.01 + BR_X, z - 0.01 + BR_Z, z + 0.01 + BR_Z).some((q) => q.minX <= x + BR_X && q.maxX >= x + BR_X && q.minZ <= z + BR_Z && q.maxZ >= z + BR_Z && q.base < y && q.top > y);
  const blockedG = (a: number[], b: number[]) => {
    const L = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    for (let k = 0; k < L; k += 0.25) {
      const f = k / L;
      const p = [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
      if (inBoxG(p[0], p[1], p[2])) return `(${p.map((v) => v.toFixed(1)).join(", ")})`;
    }
    return "";
  };
  // (the far arch frames z 117.5 to 123.9 on the strips, measured off the hall's faces: a tram over all of it, half a
  // metre spare; the sight line stops 1.5 m short of the tram, which is itself in the collision)
  const ends = TG2.strips.map((s) => {
    const sign = Math.sign(s.x);
    const over = s.trams.some(([z]) => z - 5.21 <= 117 && z + 5.21 >= 124.4);
    return { x: s.x, over, stop: blockedG([-sign * 19, 1.7, 123], [s.x - sign * 1.5, 2.2, 120.7]) };
  });
  const FG = TG2.front;
  const onNodeG = (x0: number, x1: number, z0: number, z1: number) => {
    const lim = 152 - (cfg.game as unknown as { graph: { margin: number } }).graph.margin;
    const walk = (cfg.rules as unknown as { perches_clear: { walk: number } }).perches_clear.walk;
    for (let x = -lim; x <= lim + 1e-6; x += 10) for (let z = -lim; z <= lim + 1e-6; z += 10) if (x > x0 - walk && x < x1 + walk && z > z0 - walk && z < z1 + walk) return true;
    return false;
  };
  const [fhx, fhz] = FG && Math.abs(FG.yaw % 180) > 1 ? [5.21, 1.23] : [1.23, 5.21];
  const nodeG = !!FG && onNodeG(FG.x - fhx, FG.x + fhx, FG.z - fhz, FG.z + fhz);
  const platesG = placeG.filter((q) => FG && String(q[0]).endsWith("/CityTerrain_Rail_10x5.prefab") && Math.abs((q[3] as number) - FG.z) < 6 && q[4] === 90).length;
  const sight = FG ? blockedG([6, 1.7, 106], [FG.x + 3, 2.2, FG.z - fhz - 0.2]) : "no wagon";
  const between = FG ? along([[FG.x - fhx, FG.z + fhz + 1.5, 0], [FG.x + fhx, FG.z + fhz + 1.5, 0]]) : null;
  check(
    "THE TERMINAL: a tram framed by the aisle's far arch from each end of the hall, and a wagon on rails on the forecourt, off the street nodes, seen from the forecourt, a player walking between it and the arcade",
    ends.length === 2 && ends.every((e) => e.over && !e.stop) && TOg?.front === 1 && !nodeG && platesG >= 3 && !sight && between?.k === 2,
    `${ends.map((e) => `x ${e.x}: ${e.over ? "a tram over the arch's view" : "no tram there"}${e.stop ? `, stopped at ${e.stop}` : ""}`).join("; ")}; forecourt wagon ${TOg?.front ?? 0}, ${nodeG ? "on a node" : "off the nodes"}, ${platesG} plates${sight ? `, sight stopped at ${sight}` : ""}, walked ${between?.k ?? 0} of 2`
  );
}

// GLASS HEIGHTS' deck and lift (Milestone 889, the districts' sixth review): each deck's top tiled and laid flat on
// the map; the car in its clear glass, every pane of the shaft drawn only and none on the landing's side past its
// underside; the kiosk with its door side left out and solid past a head; the barrel gone from where it stands; a piece of
// cover on each new perch; and the cypress either side of the court's mouth
{
  const GD = (cfg.rules as unknown as { districts: { glass: { buildings: Array<[string, number, number, number, string?]>; lift: { car: number[]; out: number[]; carMat: string; shaft: { piece: string; half: number; tiers: number; under: number; lamp: string } }; ground: { rows: Array<{ pieces?: string[]; at: number[][] }> } } } }).districts.glass;
  const CG = (cfg as unknown as { chunks: Record<string, { place: unknown[][] }> }).chunks;
  const tiled = GD.buildings.filter((b) => b[0].startsWith("HighPlatform_Peninsula") && /(^|;)ConcretePanels00=[^;@]+@\d/.test(b[4] ?? "")).length;
  const SH = GD.lift.shaft;
  const car = CG["c-glass"].place.find((q) => String(q[0]).endsWith("/Elevator02.prefab"));
  const panes = CG["c-glass"].place.filter((q) => String(q[0]).endsWith(`/${SH.piece}`));
  const tall = [...new Set(panes.map((q) => Number(q[2])))].sort((a, b) => a - b).reduce((d, y, i, ys) => (i ? y - ys[i - 1] : d), 0);
  const [cx, cz] = GD.lift.car;
  const off = (q: unknown[], d: number[]) => Math.hypot(Number(q[1]) - (cx + d[0] * SH.half), Number(q[3]) - (cz + d[1] * SH.half));
  const stepOff = panes.filter((q) => off(q, GD.lift.out) < 0.2);
  const sides = [[1, 0], [-1, 0], [0, 1], [0, -1]].map((d) => panes.filter((q) => off(q, d) < 0.2).length);
  const lamps = CG["c-glass"].place.filter((q) => String(q[0]).endsWith(`/${SH.lamp}`) && q[5] === "g" && Math.hypot(Number(q[1]) - cx, Number(q[3]) - cz) < 0.5).length;
  const shaftOk = !!car && car[6] === GD.lift.carMat && Array.isArray(car[7]) && panes.length > 0 && panes.every((q) => q[5] === "g") && sides.filter((n) => n === SH.tiers).length === 3 && stepOff.length > 0 && stepOff.every((q) => Number(q[2]) + tall <= SH.under) && lamps === 1;
  const per = (name: string) => PCH.find((p) => p.name === name)?.at ?? [];
  const kiosk = per("glass-kiosk")[0];
  const kioskPlace = CG["c-dress"].place.find((q) => String(q[0]).endsWith("/Elevator02.prefab") && Array.isArray(q[7]));
  // (a wall's box within a metre of its middle, from under a head over the deck to over one: its door side left out)
  const S9b = (SOLIDS as { solids: number[][] }).solids;
  const walled = !!kiosk && S9b.some((b) => b[0] < kiosk[0] + 2.1 && b[1] > kiosk[0] - 2.1 && b[2] < kiosk[2] + 2.1 && b[3] > kiosk[2] - 2.1 && b[4] < kiosk[1] + 1.5 && b[5] > kiosk[1] + 2.5);
  const coverOk = !!kioskPlace && walled && per("glass-front-2").length === 1 && ["glass-low-n", "glass-nw-2", "glass-ne-2"].every((n) => per(n).length >= 1);
  const row = GD.ground.rows[0];
  const framed = row.at.slice(0, 2).filter(([x, z]) => CG["c-glass"].place.some((q) => String(q[0]).endsWith(`/${row.pieces![0]}`) && Math.hypot(Number(q[1]) - x, Number(q[3]) - z) < 0.6)).length;
  check(
    "GLASS HEIGHTS: its four decks tiled, its lift a clear cabin in a drawn shaft, a kiosk, low glass walls and planters on its decks, and a cypress either side of the court's mouth",
    tiled === 4 && shaftOk && coverOk && framed === 2,
    `${tiled} of 4 decks tiled; ${panes.length} panes (${sides.join(", ")} a side), ${lamps} lamp, the car ${car?.[6] === GD.lift.carMat ? "in clear glass" : "not worn"}; the kiosk ${kiosk ? `at (${kiosk[0]}, ${kiosk[2]})${walled ? "" : ", no wall"}` : "not laid"}; ${["glass-front-2", "glass-low-n", "glass-nw-2", "glass-ne-2"].map((n) => `${n} ${per(n).length}`).join(", ")}; ${framed} of 2 cypress`
  );
}

// solid cover on the Sky Ring, the bridge ring and the lookout (Milestone 971, the centre's twelfth review: "solid cover
// every 8-10 m ... the glass rails are see-through and do not count as cover"), read off the collision. Each piece stands
// in the bake's own boxes and in `laid`, so the next layout cannot read it; round the ring's middle circle none more than
// 10 m from the next and none across a stair's top; along each of the ring's four bridges a piece 1.4 m tall or more (the
// gangway's own height: a crouched body is 1.19 m) within 5.5 m of every half metre of its middle line, the walks being
// the checks above; on the lookout each panel on its rim, 49.5 m, and off each zip's end
{
  const HC = (cfg as unknown as { highCover?: Record<string, number[][]> }).highCover ?? {};
  const [RG, BG, LK] = [HC.ring ?? [], HC.bridge ?? [], HC.lookout ?? []];
  const F9 = SOLIDS as unknown as { solids: number[][]; laid: number[][] };
  const inLaid = new Uint8Array(F9.solids.length);
  for (const [a, b] of F9.laid) inLaid.fill(1, a, b);
  // (a box of its own by its middle, from its foot to its top: half a metre round, a column's width, as the middle of a
  // piece may be a hollow cell)
  const stands = ([x, z, y, top]: number[]) => F9.solids.some((b, i) => inLaid[i] && x + 0.5 >= b[0] && x - 0.5 <= b[1] && z + 0.5 >= b[2] && z - 0.5 <= b[3] && b[4] < y + 0.2 && Math.abs(b[5] - top) < 0.15);
  const all = [...RG, ...BG, ...LK];
  const stood = all.filter(stands).length;
  const SRc = cfg.rules.skyring as { r0: number; r1: number };
  const SKe = (cfg as unknown as { skyring: { exits: number[][] } }).skyring.exits;
  const ang = RG.map(([x, z]) => Math.atan2(z, x)).sort((p, q) => p - q);
  const gaps = ang.map((a, k) => (((ang[(k + 1) % ang.length] - a + 2 * Math.PI) % (2 * Math.PI)) * (SRc.r0 + SRc.r1)) / 2);
  const byStair = RG.filter(([x, z]) => SKe.some((e) => Math.hypot(e[0] - x, e[1] - z) < 2.5)).length;
  const B9 = cfg.rules.bridges as { deck: number; paths: number[][][]; gaps?: Array<{ at: number[] }> };
  const tallB = BG.filter((q) => q[3] - B9.deck >= 1.4);
  let far = 0;
  for (const path of B9.paths.slice(0, 4))
    for (let k = 1; k < path.length; k++) {
      const [a, b] = [path[k - 1], path[k]];
      const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
      for (let t = 0; t <= L; t += 0.5) {
        const [x, z] = [a[0] + ((b[0] - a[0]) * t) / L, a[1] + ((b[1] - a[1]) * t) / L];
        // (not over a gap in the ring, rules.bridges.gaps, Milestone 1082: there is no deck there to stand on)
        if ((B9.gaps ?? []).some((g) => Math.abs(g.at[0] - x) <= 2.5 && Math.abs(g.at[1] - z) <= 2.5)) continue;
        far = Math.max(far, Math.min(...tallB.map((q) => Math.hypot(q[0] - x, q[1] - z))));
      }
    }
  // (over its floor as well as on what stands there: the floor has no spot for a piece with a body's way round it, and a
  // panel on it would stand on a box just as level)
  const floorLK = (cfg.rules.perches as unknown as Array<{ name: string; y: number[] }>).find((p) => p.name === "lookout")!.y[1];
  const rimAt = ([x, z, y]: number[]) => y > floorLK + 0.3 && F9.solids.some((b, i) => !inLaid[i] && x >= b[0] && x <= b[1] && z >= b[2] && z <= b[3] && Math.abs(b[5] - y) < 0.06);
  const onRim = LK.filter(rimAt).length;
  const ZL = (cfg as unknown as { zips: Array<{ block: string; b: number[] }> }).zips.filter((q) => q.block.startsWith("lookout"));
  const byZip = LK.filter(([x, z]) => ZL.some((q) => Math.hypot(q.b[0] - x, q.b[2] - z) < 3.5)).length;
  check(
    "solid cover on the Sky Ring, the bridge ring and the lookout, standing in the bake's boxes and left out of what the next layout reads: a panel every 10 m of the ring, none by a stair's top; 1.4 m and more within 5.5 m of every half metre of each bridge; the lookout's panels on its rim, off its zips",
    all.length > 0 && stood === all.length && RG.length >= 25 && Math.max(...gaps) <= 10.1 && byStair === 0 && tallB.length >= 40 && far <= 5.5 && LK.length >= 4 && onRim === LK.length && byZip === 0,
    `${stood} of ${all.length} pieces standing in laid boxes; the ring ${RG.length} panels, at most ${Math.max(...gaps, 0).toFixed(1)} m apart, ${byStair} by a stair's top; the bridges ${tallB.length} tall pieces, none further than ${far.toFixed(1)} m; the lookout ${onRim} of ${LK.length} on its rim, ${byZip} by a zip's end`
  );
}

// the sun's edge soft (Milestone 972, the fresh reviews of 2026-10-30: "a hard-edged sun"): a corona over the clipped disk
{
  const SC = (await import("../../src/config/sky.json")).default as unknown as { sunCorona?: { power: number; k: number } };
  check("the sun's edge soft", !!SC.sunCorona && SC.sunCorona.k >= 0.3 && SC.sunCorona.power <= 900, `corona ${SC.sunCorona?.power} at ${SC.sunCorona?.k}`);
}

// the haze thins with height (Milestone 973, the districts' eighth reviews: "thin the haze at drop height"): at the dropship's
// height the ground under it is past the fog's near end, and on a roof the fog is as it was
{
  const AT = (worldCfg as unknown as { atmosphere: { climb?: { from: number; nearUp: number } } }).atmosphere;
  const GA = (cfg.game as unknown as { air: { near: number } }).air;
  const nearAt = (y: number) => GA.near + Math.max(0, y - (AT.climb?.from ?? 0)) * (AT.climb?.nearUp ?? 0);
  check("the haze thins with height: the ground under the dropship past its near end", !!AT.climb && nearAt(140) >= 140 && nearAt(27) === GA.near, `near ${nearAt(140)} m from 140 m up, ${nearAt(27)} m from 27 m up`);
}

// THE TERRACES' grand stair, gate, gardens and rooms' fronts, and THE STRIP's pink block (Milestones 974 to 976, the districts'
// eighth review): the stair's three flights drawn in steps, walked up and down by a player in five lanes across its 20 m
// and its banks; a lit riser every third step; nothing standing on its axis across the ring road; the gate's five arches
// each walked through; the name over the arches and wider than the stair is half; beds and pergolas on the top tier; no
// plain wall of cover on any tier; a room's front shut but for its door; the pink block's two screens clear of its pad
{
  type FRule = { z: number[]; treads: number; piece: string };
  const TR9 = cfg.rules.districts as unknown as { terraces: { ramp: { flight: FRule }; name: { w: number; at: number[] }; garden: { beds: { at: unknown[] }; pergola: { at: number[][] } }; rooms: { front: { door: number } }; chunk: string; gate: { x: number; z: number; count: number } }; strip: { blockAds: number[][]; ads: { piece: string } } };
  const TC9 = (cfg as unknown as { terraces: { flights: Array<{ x0: number; foot: number }>; beds: number[][]; pergolas: number[][]; gate: number[]; rooms: number[][] } }).terraces;
  const F9 = TR9.terraces.ramp.flight;
  const placed9 = (cfg.chunks as unknown as Record<string, { place: Array<[string, number, number, number]> }>)[TR9.terraces.chunk].place;
  const steps9 = placed9.filter((q) => q[0].endsWith(`/${F9.piece}`)).length;
  const lanes = [-9, -4.5, 0, 4.5, 9, -11.25, 11.25];
  const stuck9: string[] = [];
  for (const z of lanes)
    for (const f of TC9.flights) {
      const r = [[f.x0 + 6, z, f.foot], [f.x0 - 0.3, z, f.foot + 3]];
      const up = along(r);
      const dn = along([...r].reverse());
      if (up.k !== r.length || dn.k !== r.length) stuck9.push(`z ${z} at x ${f.x0}: up to (${up.x.toFixed(1)}, ${up.y.toFixed(2)}), down to (${dn.x.toFixed(1)}, ${dn.y.toFixed(2)})`);
    }
  const G9 = cfg.game as unknown as { outlines: Array<{ name: string }> };
  const risers = G9.outlines.filter((q) => q.name.startsWith("the terraces stair riser")).length;
  const onAxis = (cfg.chunks as unknown as Record<string, { place: Array<[string, number, number, number]> }>)["c-dress"].place.filter((q) => /Car/.test(q[0]) && q[2] < 3 && q[1] > -101 && q[1] < -86 && Math.abs(q[3]) < 9.5).length;
  check(
    "THE TERRACES' grand stair: three flights of steps 20 m wide, walked up and down in five lanes and over both banks, a lit riser every third step, no car on its axis across the ring road",
    TC9.flights.length === 3 && steps9 >= 3 * (F9.treads * 4 + 5) && F9.z[1] - F9.z[0] === 20 && stuck9.length === 0 && risers === 9 && onAxis === 0,
    stuck9.slice(0, 4).join("; ") || `${TC9.flights.length} flights, ${steps9} kerbs, ${lanes.length * 6} walks, ${risers} lit risers, ${onAxis} cars on the axis`
  );
  const [gx0, gx1, gz0, , gy] = TC9.gate;
  const shutArch: string[] = [];
  for (let k = 0; k < TR9.terraces.gate.count; k++) {
    const z = gz0 + 2.5 + k * 5;
    const r = [[gx1 + 0.4, z, gy], [gx0 - 1, z, gy]];
    const a = along(r);
    const b = along([...r].reverse());
    if (a.k !== r.length || b.k !== r.length) shutArch.push(`the arch at z ${z}: to (${a.x.toFixed(1)}, ${a.z.toFixed(1)})`);
  }
  check("THE TERRACES' gate: five arches over the head of its stair, each walked through both ways, its name over them", TR9.terraces.gate.count === 5 && shutArch.length === 0 && TR9.terraces.name.w >= 20 && TR9.terraces.name.at[1] > gy + 6, shutArch.join("; ") || `${TR9.terraces.gate.count} arches, the name ${TR9.terraces.name.w} m wide at ${TR9.terraces.name.at[1]} m`);
  const coverOnTiers = ((cfg as unknown as { districtCover: Array<{ piece: string; y: number; d: string }> }).districtCover ?? []).filter((q) => q.d === "terraces" && q.y > 0).length;
  const topBeds = TC9.beds.filter((b) => b[2] === 9).length;
  check("THE TERRACES' gardens: raised beds and two pergolas on its top tier, none of the fill's plain walls on a tier", topBeds >= 7 && TC9.pergolas.length === 2 && coverOnTiers === 0, `${TC9.beds.length} beds, ${topBeds} on the top tier, ${TC9.pergolas.length} pergolas, ${coverOnTiers} pieces of the fill on a tier`);
  // (a room's front off the collision: a box each side of its door, the door itself clear, a player's way in being the
  // rooms' own check)
  const S9 = (SOLIDS as { solids: number[][] }).solids;
  const door = TR9.terraces.rooms.front.door;
  const shut9 = TC9.rooms.filter(([x0, z0, floor]) => {
    const [fx, mid] = [x0 + 4.9, z0 + 2.5];
    const box = (z: number) => S9.some((b) => fx > b[0] && fx < b[1] && z > b[2] && z < b[3] && b[4] < floor + 1 && b[5] > floor + 2);
    return !box(mid - door / 2 - 0.5) || !box(mid + door / 2 - 0.0 + 0.5) || box(mid);
  }).length;
  check("THE TERRACES' rooms: each with a front, a glass wall each side of its door", TC9.rooms.length === 6 && shut9 === 0, `${TC9.rooms.length - shut9} of ${TC9.rooms.length} fronts`);
  const stripPlace = (cfg.chunks as unknown as Record<string, { place: Array<[string, number, number, number]> }>)["c-e"].place;
  const big = stripPlace.filter((q) => q[0].endsWith(`/${TR9.strip.ads.piece}`) && (q as unknown as unknown[]).length > 8).length;
  const nearPad = TR9.strip.blockAds.filter((q) => Math.abs(q[1]) < 8).length;
  check("THE STRIP's pink block: two big screens on the lobes either side of its pad", big === 2 && TR9.strip.blockAds.length === 2 && nearPad === 0, `${big} screens, ${nearPad} over the pad`);
}

// THE VAULT's strongroom (Milestone 977, the centre's fourteenth review: "a real payoff", "a central strongroom behind the
// gold door", "gold bars on racks", "crates that read gold"; since Milestone 1043 the fifteenth's "the strongroom door ... on the
// entrance's axis"): the core's south doors open on it at 32 m and at 35 m; a body walks out of the core's landing through
// the 32 m one to the hero door's foot, along it and out by the east gate, in from the west hall through its gate, along
// the deposit wall, and on the gallery; the chamber two storeys tall under the 35 m hole; the can shelves gone, bars on the
// rack and in the crates, the safe-deposit wall on the core beside the door and its floor number; since Milestone 1078 the
// hero door's wall stands at z 5.15 with the strongroom behind it, walked into over its threshold and out
{
  const FV = (cfg.rules.tower as unknown as { floors: { at: Record<string, { pieces?: string[]; vault?: { bar: { piece: string }; boxes: number[][]; rows: unknown[][]; plates: { piece: string; columns: number[]; rows: number[] } }; holes?: number[][] }> } }).floors.at;
  const V9 = FV["32"].vault;
  const tw = (cfg.tower as unknown as { core: { storeys: number[]; doors: string[][] } }).core;
  const shut = tw.doors[tw.storeys.indexOf(32)].includes("s") && tw.doors[tw.storeys.indexOf(35)].includes("s");
  const pl9 = (cfg as unknown as { chunks: Record<string, { place: unknown[][] }> }).chunks["c-tower"]?.place ?? [];
  const bars = pl9.filter((q) => String(q[0]).endsWith(`/${V9?.bar.piece}`)).length;
  const faces = pl9.filter((q) => V9 && String(q[0]).includes(V9.plates.piece) && q[5] === "g" && Number(q[8] ?? 1) < 1 && Number(q[2]) > 32 && Number(q[2]) < 34.5).length;
  const cans = pl9.filter((q) => /Rack0[0-2]b Variant/.test(String(q[0])) && Math.abs(Number(q[2]) - 32) < 0.6).length;
  const [hx0, hx1, hz0, hz1] = FV["35"].holes![0];
  // (since Milestone 1078 the doorway's wall stands at z 5.15 with the strongroom behind it: from the core's door a body
  // steps over the threshold into the room and back out, then goes along the leaf, which stands against the wall, to the
  // far gate through its north half; from the west hall through its gate's north half and into the room along its aisle)
  // (since Milestone 1095 the wall stands 0.6 m nearer, at z 4.55, and the gates beside it open into the room, their north
  // halves filled: from the core's door over the threshold into the room and back, through the room and out by the east
  // side door, from the west hall in by its side door; the gates' north halves are no way now)
  const ways = [
    [[-9.975, 1, 32], [-9.975, 2.9, 32], [-9.1, 3.75, 32], [-9.1, 5.4, 32], [-9.1, 3.75, 32], [-9.975, 2.9, 32]],
    [[-9.1, 5.4, 32], [-6.4, 5.4, 32], [-4.6, 5.37, 32], [-2.4, 5.37, 32], [-1.6, 3.4, 32]],
    [[-12.2, -0.25, 32], [-12.6, 2.4, 32], [-12.4, 5.37, 32], [-10.2, 5.37, 32], [-9.1, 5.4, 32]],
    [[-9.6, 3.2, 32], [-5, 3.2, 32]],
    [[-9.97, 3, 35], [-5, 3, 35]],
  ];
  const stuck9 = ways.flatMap((r) => [r, [...r].reverse()]).filter((r) => { const w = along(r); return w.k !== r.length || Math.abs(w.y - r.at(-1)![2]) > 0.15; }).length;
  check(
    "THE VAULT's strongroom: the core's south doors open on it, walked from the stair over the doorway's threshold into the room behind it and out, through the room and out by its east side door, from the west hall in by its west one, along the deposit wall, two storeys tall under the 35 m hole with a walked gallery, bars on the racks and in crates, a wall of deposit boxes, no can shelves",
    !!V9 && shut && stuck9 === 0 && hx1 - hx0 > 6 && hz1 - hz0 > 4.5 && bars >= 100 && faces >= 30 && cans === 0,
    `south doors open ${shut}, ${stuck9} of ${2 * ways.length} ways stuck, hole ${(hx1 - hx0).toFixed(1)} by ${(hz1 - hz0).toFixed(1)} m, ${bars} bars, ${faces} deposit boxes, ${cans} can shelves`
  );
}

// The base's atrium (Milestone 978, the review: "an atrium from hall to terrace"): over each spot of each of its holes no box
// tops out at that slab, the ground under it is there, and a body stands on the first floor and on the second round it; since
// Milestone 1083 the roof is whole over it (the coffer, "the atrium under a designed ceiling"), so the first floor's and the
// second's
{
  const AT9 = (cfg.rules.base as unknown as { atrium?: { slabs: Array<{ y: number; at: number[][] }>; flights: unknown[] } }).atrium;
  const S10 = (SOLIDS as { solids: number[][] }).solids;
  const FB = ((cfg.tower as unknown as { stairs?: Array<{ where: string; box: number[] }> }).stairs ?? []).filter((s) => s.where.startsWith("the base's"));
  const res = (AT9?.slabs ?? []).map(({ y, at }) => {
    let [n, open] = [0, 0];
    for (const [x0, x1, z0, z1] of at)
      for (let x = x0 + 0.625; x < x1 - 0.4; x += 0.5)
        for (let z = z0 + 0.625; z < z1 - 0.4; z += 0.5) {
          if (FB.some((s) => x > s.box[0] - 0.1 && x < s.box[1] + 0.1 && z > s.box[2] - 0.1 && z < s.box[3] + 0.1)) continue;
          n++;
          if (!S10.some((b) => x > b[0] && x < b[1] && z > b[2] && z < b[3] && Math.abs(b[5] - y) < 0.2 && b[5] - b[4] < 1)) open++;
        }
    return { y, n, open };
  });
  const flights = ((cfg.tower as unknown as { stairs?: Array<{ where: string }> }).stairs ?? []).filter((s) => s.where.startsWith("the base's")).length;
  check(
    "the base's atrium: its slabs open over it at 3.5 and 7 m, a wide flight through each",
    res.length === 2 && res.every((r) => r.n >= 20 && r.open === r.n) && flights === (AT9?.flights.length ?? 0) && flights >= 2,
    `${res.map((r) => `${r.y} m ${r.open} of ${r.n} open`).join("; ")}; ${flights} flights`
  );
}

// The finish (Milestone 979, the fourteenth review: "curved walls stop short of the floor with jagged brick", "a white
// rectangle at the hall's far side", "pale cyan patches on the far floor"): the plinth on every floor, the base's boards
// off the pack's blank light, THE VAULT's marble off a mirror
{
  const TW9 = cfg.rules.tower as unknown as { plinth?: { high: number }; floors: { at: Record<string, { floorMat?: string }> } };
  const remap = String((cfg.rules.middle as unknown as { remap: string }).remap);
  const soft = Number(/%([\d.]+)/.exec(TW9.floors.at["32"].floorMat ?? "")?.[1] ?? 1);
  check(
    "the finish: a plinth over the shell's foot, the tower's lit boards pictures, THE VAULT's marble no mirror",
    (TW9.plinth?.high ?? 0) > 0.48 && /Light=ADS_/.test(remap) && soft < 0.7,
    `plinth ${TW9.plinth?.high} m, ${remap}, marble smoothness times ${soft}`
  );
}

// THE CANYON's street broken (Milestone 984, the districts' eighth reviews: "offset kiosk islands", "stalls hug the walls and leave
// a straight shooting lane"): every island laid, on neither side of the bots' one line of nodes nearer than a body and the
// collision's half cell, 20 to 32 m to the next down each arm on the other side of the middle, and a player walking round
// behind each, between it and its wall
{
  type IS = [string, number, number, number, number, number, number];
  const IL = (cfg as unknown as { canyon: { market: { islands?: IS[] } } }).canyon.market.islands ?? [];
  const ask = (cfg.rules as unknown as { districts: { canyon: { market: { islands?: Array<{ at: number[][] }> } } } }).districts.canyon.market.islands ?? [];
  const body = (cfg.rules as unknown as { perches_clear: { walk: number }; dress: { graphPad: number } }).perches_clear.walk + (cfg.rules as unknown as { dress: { graphPad: number } }).dress.graphPad;
  const across = (s: IS) => (s[3] === 0 || s[3] === 180 ? Math.abs(s[2] - 125) : Math.abs(s[1] + 125));
  const close = IL.filter((s) => across(s) < s[5] + body);
  const arm = (south: boolean) => IL.filter((s) => (s[3] === 0 || s[3] === 180) === south).sort((p, q) => (south ? p[1] - q[1] : p[2] - q[2]));
  const gaps = [true, false].flatMap((south) => arm(south).slice(1).map((s, i) => {
    const p = arm(south)[i];
    return { d: south ? s[1] - p[1] : s[2] - p[2], flip: Math.abs(s[3] - p[3]) === 180 };
  }));
  const stuck: string[] = [];
  for (const s of IL) {
    const [, x, z, yaw, hu, hv] = s;
    const a = (yaw * Math.PI) / 180;
    const [u, v] = [[Math.cos(a), -Math.sin(a)], [Math.sin(a), Math.cos(a)]];
    const at = (al: number, out: number) => [x + u[0] * al + v[0] * out, z + u[1] * al + v[1] * out, 0];
    // (between the stall's back and the fronts' mullions, 0.5 m off the wall)
    const lane = -(hv + 0.58);
    const r = [at(hu + 1, 0.2), at(hu + 0.6, lane), at(-hu - 0.6, lane), at(-hu - 1, 0.2)];
    for (const w of [along(r), along([...r].reverse())]) if (w.k !== r.length) stuck.push(`(${x}, ${z}) at (${w.x.toFixed(1)}, ${w.z.toFixed(1)})`);
  }
  check(
    "THE CANYON's street broken: kiosk islands off the bots' line, staggered down each arm, each with a lane behind it walked both ways",
    IL.length === ask.reduce((n, r) => n + r.at.length, 0) && IL.length >= 6 && close.length === 0 && gaps.length >= 4 && gaps.every((g) => g.d >= 20 && g.d <= 32 && g.flip) && stuck.length === 0,
    `${IL.length} islands, ${close.length} too near the line, gaps ${gaps.map((g) => g.d.toFixed(1)).join(", ")} m, ${stuck.slice(0, 3).join("; ") || "every lane walked"}`
  );
}

// THE CANYON's walkways and roofs (Milestone 985, the same reviews: "booths on the walkways", "rail posts with no top rail", "its roof
// deck cut into islands"): each bay stepped into from its walkway, a booth on each, a top rail along both long edges of
// each arm; each deck a step over the roof, drawn at its typed top and walked onto and off, no shed on a line of the bots' roof
// nodes, which stay a body clear of it
{
  type DK = { rise: number; at: number[][]; sheds: number[][]; shed: string };
  const CR = (cfg.rules as unknown as { districts: { canyon: { height: number; walkways: { y: number; runs: number[][] }; market: { bays?: unknown[] }; roofs: { decks?: DK } } } }).districts.canyon;
  const got = (cfg as unknown as { canyon: { market: { booths?: number }; walkways: { handrails?: number } } }).canyon;
  const main = CR.walkways.runs.slice(0, 4);
  const bays = CR.walkways.runs.slice(4);
  const wy = CR.walkways.y;
  const stuck: string[] = [];
  for (const [x0, x1, z0, z1] of bays) {
    const [cx, cz] = [(x0 + x1) / 2, (z0 + z1) / 2];
    const alongX = x1 - x0 > z1 - z0;
    const mainRun = main.find((m) => (alongX ? m[0] <= cx && m[1] >= cx && (Math.abs(m[2] - z1) < 0.01 || Math.abs(m[3] - z0) < 0.01) : m[2] <= cz && m[3] >= cz && (Math.abs(m[0] - x1) < 0.01 || Math.abs(m[1] - x0) < 0.01)));
    if (!mainRun) {
      stuck.push(`(${cx}, ${cz}) on no walkway`);
      continue;
    }
    const from = [(mainRun[0] + mainRun[1]) / 2, (mainRun[2] + mainRun[3]) / 2];
    const start = alongX ? [cx, from[1], wy] : [from[0], cz, wy];
    const edge = alongX ? [cx, Math.abs(z1 - mainRun[2]) < 0.01 ? z1 - 0.45 : z0 + 0.45, wy] : [Math.abs(x1 - mainRun[0]) < 0.01 ? x1 - 0.45 : x0 + 0.45, cz, wy];
    const w = along([start, edge]);
    if (w.k !== 2 || Math.abs(w.y - wy) > 0.15) stuck.push(`(${cx}, ${cz}) stopped at (${w.x.toFixed(1)}, ${w.z.toFixed(1)}) ${w.y.toFixed(2)} m`);
  }
  const DKc = CR.roofs.decks;
  const up = DKc?.rise ?? 0;
  const lim = 145;
  // (a shed 3.5 m square stands a body's 0.4 m off the 5 m lines of the roof's nodes with its middle 2.15 m and more off them)
  const offLine = (v: number) => {
    const m = (((v + lim) % 5) + 5) % 5;
    return Math.min(m, 5 - m);
  };
  const onLine = (DKc?.sheds ?? []).filter(([x, z]) => offLine(x) < 2.15 || offLine(z) < 2.15);
  const off: string[] = [];
  for (const [x0, x1, z0, z1] of DKc?.at ?? []) {
    const [cx, cz] = [(x0 + x1) / 2, (z0 + z1) / 2];
    const y = CR.height;
    // (from whichever side has a free stretch of roof: a deck's other sides may have cover or a shed on the way)
    const sides = [[[x0 - 1.2, cz, y], [x0 + 0.5, cz, y + up]], [[x1 + 1.2, cz, y], [x1 - 0.5, cz, y + up]], [[cx, z0 - 1.2, y], [cx, z0 + 0.5, y + up]], [[cx, z1 + 1.2, y], [cx, z1 - 0.5, y + up]]];
    const walked = sides.some((r) => {
      const [on, offIt] = [along(r), along([...r].reverse())];
      return on.k === 2 && Math.abs(on.y - y - up) < 0.15 && offIt.k === 2 && Math.abs(offIt.y - y) < 0.15;
    });
    if (!walked) off.push(`(${cx}, ${cz})`);
  }
  check(
    "THE CANYON's walkways and roofs: each bay stepped into from its walkway with a booth, a lit top rail, each roof deck a step up walked onto and off, no shed on the bots' roof lines",
    bays.length >= 6 && stuck.length === 0 && got.market.booths === (CR.market.bays?.length ?? -1) && (got.walkways.handrails ?? 0) >= 12 && (DKc?.at.length ?? 0) >= 12 && (DKc?.sheds.length ?? 0) >= 5 && up > 0 && up <= 0.55 && off.length === 0 && onLine.length === 0,
    `${bays.length} bays, ${got.market.booths ?? 0} booths, ${got.walkways.handrails ?? 0} lengths of top rail, ${DKc?.at.length ?? 0} decks, ${DKc?.sheds.length ?? 0} sheds; ${[...stuck, ...off].slice(0, 4).join("; ") || "all walked"}${onLine.length ? `, ${onLine.length} sheds on a line` : ""}`
  );
}

// THE WORKS' hall (Milestone 986, the same reviews: "a clean gym", "machines to fight round", "a gantry with a way up"; "chimney caps
// like heads"): every machine laid, the gantry walked from ring to ring both ways and its stair up and down in three lanes
// from the floor to the ring, the bots' street round the atrium walked, no column over the hall's two pads, a plain top on
// each stack
{
  type WU = { machines?: { laid: number; of: number; left: string[] }; gantry?: { walk: number[][]; lanes: number[][][]; rails: number[][] } };
  const U = (cfg as unknown as { works: { upper: WU } }).works.upper;
  const S = (SOLIDS as { solids: number[][] }).solids;
  const stuck: string[] = [];
  const G = U.gantry;
  if (G) {
    for (const [name, r] of [["the gantry", G.walk], ...G.lanes.map((l, i) => [`the stair, lane ${i + 1}`, l] as [string, number[][]])] as Array<[string, number[][]]>)
      for (const [way, pts] of [["there", r], ["back", [...r].reverse()]] as const) {
        const w = along(pts);
        if (w.k !== pts.length || Math.abs(w.y - pts.at(-1)![2]) > 0.2) stuck.push(`${name} ${way}: ${w.k - 1} of ${pts.length - 1} legs, at (${w.x.toFixed(1)}, ${w.z.toFixed(1)}) ${w.y.toFixed(2)} m`);
      }
  }
  const bareRail = (G?.rails ?? []).filter(([x, z, y]) => !S.some((b) => b[0] <= x + 0.06 && b[1] >= x - 0.06 && b[2] <= z + 0.06 && b[3] >= z - 0.06 && b[4] <= y + 0.3 && b[5] >= y + 0.9));
  const round = along([[125, 125, 0], [135, 125, 0], [135, 135, 0], [125, 135, 0], [125, 125, 0]]);
  const R9 = cfg.rules as unknown as { districts: { works: { stacks: { cap: string; capMat?: string } } } };
  const trims = (cfg.game as unknown as { padRings: { column: { trim?: number[][] } } }).padRings.column.trim ?? [];
  const hallPads = ((cfg as unknown as { spine: { up: Array<{ id: string; pad: number[] }> } }).spine.up).filter((q) => q.id === "works-a" || q.id === "works-b");
  const unTrimmed = hallPads.filter((q) => !trims.some(([x, z, s]) => x === q.pad[0] && z === q.pad[1] && s === 0));
  check(
    "THE WORKS' hall: its machines laid, its gantry walked both ways, its stair up and down in three lanes, the bots' square round the atrium walked, no column over its two pads, a plain top on each stack",
    !!U.machines && U.machines.of >= 2 && U.machines.laid === U.machines.of && !!G && G.lanes.length === 3 && stuck.length === 0 && bareRail.length === 0 && round.k === 5 && hallPads.length === 2 && unTrimmed.length === 0 && !R9.districts.works.stacks.cap.includes("Chimney") && !!R9.districts.works.stacks.capMat,
    `${U.machines?.laid ?? 0} of ${U.machines?.of ?? 0} machines${U.machines?.left.length ? ` (${U.machines.left.join("; ")})` : ""}; ${stuck.slice(0, 4).join("; ") || "walked"}; round the atrium ${round.k - 1} of 4 legs; ${unTrimmed.length} pads with a column`
  );
}

// THE STRIP (Milestone 987, the same reviews: "red tile kept to the club", "letter signs", "two more panel patterns", "cover on the pyramid
// top", "a lit crown"): the red tile on the club's columns alone, the blocks in screens and two patterns, four letter signs,
// the pyramid's cover off the axes a body climbs by, a crown over the tower (since Milestone 1108 a dark cap lit by its own
// band: worn whole in the magenta it read from the aerials as "a glowing pink disc", "a stray sphere at the fence")
{
  type SD = { base: { at: number[][]; mats?: string[] }; pyramid: { at: number[]; rim: number; top?: Array<[string, number, number, number]> } };
  const D = (cfg.rules as unknown as { districts: { strip: SD } }).districts.strip;
  const placed = (cfg as unknown as { chunks: Record<string, { place: unknown[][] }> }).chunks["c-strip"].place;
  const blocks = placed.filter((q) => String(q[0]).endsWith("/BuildingFake12_BuildBlock00.prefab"));
  const red = blocks.filter((q) => !q[6]);
  const onClub = red.filter((q) => Number(q[3]) > 5 && Number(q[3]) < 28 && Number(q[1]) < 131);
  const wears = new Set((D.base.mats ?? []).map((m) => m.split("=")[1]));
  const LETTERS = (cfg.game as unknown as { boards: Array<{ text: string; h: number; at: number[] }> }).boards.filter((b) => b.h >= 2 && b.at[0] > 107 && Math.abs(b.at[2]) < 30);
  const [px, pz] = D.pyramid.at;
  const onAxis = (D.pyramid.top ?? []).filter(([n, x, z]) => !/BeamColumn/.test(n) && (Math.abs(x - px) < 1.4 || Math.abs(z - pz) < 1.4));
  const crown = ((cfg.rules.dress as unknown as { extras: Array<[string, string, number, number, number, number, number?, string?]> }).extras).filter(([chunk, , , , , y]) => chunk === "c-strip" && y > 80);
  const banded = crown.filter((c) => {
    const pairs = String(c[7] ?? "").split(";");
    return pairs.every((p) => p.includes("=")) && pairs.filter((p) => /=Light06/.test(p)).length === 1;
  });
  check(
    "THE STRIP: red tile on the club alone, its blocks in screens and two lit patterns, four letter signs, cover on the pyramid off its climbs, a crown on the tower",
    red.length === onClub.length && red.length === 8 && wears.size >= 3 && (D.base.mats?.length ?? 0) === D.base.at.length && LETTERS.length >= 4 && (D.pyramid.top?.length ?? 0) >= 3 && onAxis.length === 0 && crown.length >= 1 && banded.length === crown.length,
    `${red.length} red storeys, ${onClub.length} on the club; ${wears.size} wears; ${LETTERS.length} letter signs; ${D.pyramid.top?.length ?? 0} pieces on the pyramid, ${onAxis.length} on an axis; ${crown.length} crown, ${banded.length} lit by its band alone`
  );
}

// the finish (Milestone 988, the same reviews): each lantern line of LANTERN ALLEYS' court ending on something at its height, not in
// the sky; GLASS HEIGHTS' east block's open corner shut by its own family's corner; the club stairs worn plain and signed;
// the road's tile finer than the pack's 10 m
{
  type WB = { from: number[]; height: number; to: number[][] };
  const Web = (cfg.rules.districts as unknown as { lantern: { court: { web: WB } } }).lantern.court.web;
  const S = (SOLIDS as { solids: number[][] }).solids;
  const loose = Web.to.filter(([x, z]) => {
    const L = Math.hypot(x - Web.from[0], z - Web.from[1]);
    const [ux, uz] = [(x - Web.from[0]) / L, (z - Web.from[1]) / L];
    return ![0, 0.25, 0.5, 0.75].some((d) => S.some((b) => b[0] <= x + ux * d && b[1] >= x + ux * d && b[2] <= z + uz * d && b[3] >= z + uz * d && b[4] <= Web.height && b[5] >= Web.height));
  });
  const X = (cfg.rules.dress as unknown as { extras: Array<[string, string, number, number, number, number]> }).extras;
  const shut = X.filter(([chunk, name]) => chunk === "c-glass" && name.includes("LargeHighPlatformWall00_5Corner")).length;
  const CL = (cfg.rules.districts as unknown as { strip: { club: { stairMat: string } } }).strip.club;
  const G9 = cfg.rules.ground as unknown as { roadTile?: string; roadEvery?: number };
  check(
    "the finish: every lantern line ends on a wall, the east block's corner shut, the club's stairs plain, the road's tile finer",
    Web.to.length >= 9 && loose.length === 0 && shut === 1 && !CL.stairMat.includes("pannel03_03") && !!G9.roadTile?.includes(`@${G9.roadEvery}`) && (G9.roadEvery ?? 10) < 10,
    `${Web.to.length} lines, ${loose.length} ending in the air (${loose.map((q) => q.join(", ")).join("; ")}), ${shut} corner, stairs ${CL.stairMat}, road ${G9.roadTile}`
  );
}

// a rope ridden up reaches its roof (Milestone 989, the lobby agent's movement review: 0 of 16 rides up MOTEL HILL's): a rider's
// feet, the hang under the rope, clear the rail at the top end of each corner block's rope
{
  const hangR = (await import("../../src/config/movement.json")).default.ziplineHang * 0.0254;
  const ZZ = (cfg as unknown as { zips: Array<{ block: string; a: number[] }> }).zips.filter((q) => q.block === "-1,-1");
  const low = ZZ.filter((q) => q.a[1] - hangR < 26.95);
  check("a rope ridden up reaches its roof: a rider's feet over the rail at its top", ZZ.length === 1 && low.length === 0, `${ZZ.length} ropes, ${low.map((q) => `${q.block} feet at ${(q.a[1] - hangR).toFixed(2)} m`).join("; ") || "all clear of 26.95 m"}`);
}

// the underground's edges (rules.underground.edge, the lobby agent's movement review of 2026-11-01, its sixth): along every
// floor under the street as the game reads it (FLOORS: the court, its halls, the station's), wherever the floor past the
// edge is more than a step higher, the game's own collision stands across the edge from the floor to that floor's height.
// floorAt alone stood there: the player read the rise as a wall (Milestone 991), a bot and a thrown ball came up through
// the slab to the street
{
  const E = (cfg.rules as unknown as { underground: { edge?: { out: number; in: number; every: number; knee: number; lip: number } } }).underground.edge;
  const K = (cfg as unknown as { court: { x0: number; x1: number; z0: number; z1: number; y: number; halls: Array<{ x0: number; x1: number; z0: number; z1: number }> } }).court;
  const UGF = (cfg as unknown as { underground: { floors: Array<{ rect: number[]; y: number }> } }).underground.floors;
  const F = [[K.x0, K.x1, K.z0, K.z1, K.y], ...K.halls.map((h) => [h.x0, h.x1, h.z0, h.z1, K.y]), ...UGF.map((f) => [...f.rect, f.y])];
  const [step, out, inn, knee, lip, every] = [MOVE.stepHeight, E?.out ?? 0.3, E?.in ?? 1.2, E?.knee ?? 0.6, E?.lip ?? 0.05, E?.every ?? 0.5];
  let rises = 0;
  const open: string[] = [];
  for (const [x0, x1, z0, z1, y] of F) {
    const sides: Array<[boolean, number, number, number, number]> = [[true, z0, -1, x0, x1], [true, z1, 1, x0, x1], [false, x0, -1, z0, z1], [false, x1, 1, z0, z1]];
    for (const [ax, e, sg, a, b] of sides)
      for (let k = 0, n = Math.max(1, Math.ceil((b - a) / every)); k <= n; k++) {
        const t = a + (k * (b - a)) / n;
        const [px, pz] = ax ? [t, e + sg * out] : [e + sg * out, t];
        const next = floorAt(px + BR_X, pz + BR_Z);
        if (next - y <= step) continue;
        rises++;
        const [s0, s1] = sg < 0 ? [e - out, e + inn] : [e - inn, e + out];
        const [bx0, bx1, bz0, bz1] = (ax ? [t, t, s0, s1] : [s0, s1, t, t]).map((v, i) => v + (i < 2 ? BR_X : BR_Z));
        const shut = solidsIn(bx0, bx1, bz0, bz1).some((q: { minX: number; maxX: number; minZ: number; maxZ: number; base: number; top: number }) => q.minX <= bx1 && q.maxX >= bx0 && q.minZ <= bz1 && q.maxZ >= bz0 && q.base <= y + knee && q.top >= next - lip);
        if (!shut) open.push(`(${px.toFixed(2)}, ${pz.toFixed(2)}) at ${y} under ${next}`);
      }
  }
  check("the underground's edges: a wall up to the next floor wherever the floor past one rises more than a step", !!E && rises > 0 && open.length === 0, `${F.length} floors, ${rises} points past a rise, ${open.length} open${open.length ? `, ${open.slice(0, 6).join("; ")}` : ""}${E ? "" : ", no rules.underground.edge"}`);
}

// cover in sets, each district its own ground and kit, no black faces (Milestones 980 to 983, the fourteenth reviews of the
// centre and eighth of the districts: mid-range the weakest play style, cover "evenly sprinkled"; one brown cobble the largest
// surface in five pictures; shared props crossing the districts; "the black cover faces swallow silhouettes"). The fills'
// own guarantee, cover in reach of every open spot, is the two checks above: this holds what they cannot see
{
  type Cov = { piece: string; c: number[]; yaw: number; set?: number; d?: string; half?: number[] };
  const CH = (cfg as unknown as { chunks: Record<string, { place: unknown[][] }> }).chunks;
  const SC = (cfg as unknown as { streetCover?: Cov[] }).streetCover ?? [];
  const DV = (cfg as unknown as { districtCover?: Cov[] }).districtCover ?? [];
  const setsOf = (list: Cov[]) => {
    const m = new Map<string, Cov[]>();
    for (const q of list) if (q.set !== undefined) (m.get(`${q.set}`) ?? m.set(`${q.set}`, []).get(`${q.set}`)!).push(q);
    return [...m.values()];
  };
  // (a set's middle and its reach; each set's nearest other, middle to middle: the reviews' "10 m apart")
  const hull = (s: Cov[]) => {
    const [x, z] = [s.reduce((a, q) => a + q.c[0], 0) / s.length, s.reduce((a, q) => a + q.c[1], 0) / s.length];
    return { x, z, r: Math.max(...s.map((q) => Math.hypot(q.c[0] - x, q.c[1] - z))) + 1 };
  };
  const gaps = (sets: Cov[][]) => {
    const H9 = sets.map(hull);
    return H9.map((a, i) => Math.min(...H9.filter((_, j) => j !== i).map((b) => Math.hypot(a.x - b.x, a.z - b.z)))).sort((p, q) => p - q);
  };
  const [SS, DS] = [setsOf(SC), setsOf(DV)];
  const share = (l: Cov[]) => l.filter((q) => q.set !== undefined).length / (l.length || 1);
  const [gS, gD] = [gaps(SS), gaps(DS)];
  const wide = [...SS, ...DS].filter((s) => hull(s).r > 7.5).length;
  const CL = cfg.rules.dress as unknown as { cover: { tall: { within: number }; sets: unknown[] }; board: { piece: string }; trim: { piece: string; on: string; glow: Record<string, string> } };
  check(
    "the cover in sets: most of the street's and the districts' pieces in sets, each set whole in 7.5 m of its middle, the sets about 10 m apart, the median nearest 7 to 14 m",
    CL.cover.sets.length >= 3 && share(SC) >= 0.7 && share(DV) >= 0.7 && SS.length >= 40 && DS.length >= 40 && wide === 0 && gS[gS.length >> 1] >= 7 && gS[gS.length >> 1] <= 14 && gD[gD.length >> 1] >= 7 && gD[gD.length >> 1] <= 14,
    `${SS.length} sets in the streets, ${((share(SC)) * 100).toFixed(0)}% of its pieces, the median nearest ${(gS[gS.length >> 1] ?? 0).toFixed(1)} m; ${DS.length} in the districts, ${(share(DV) * 100).toFixed(0)}%, ${(gD[gD.length >> 1] ?? 0).toFixed(1)} m; ${wide} past 7.5 m`,
  );
  // (one kit a district: the barrels gone, the ribbed box the centre's, the cooling units THE STACKS', the poster sheets inside)
  const named = (q: Cov, n: string) => q.piece.startsWith(n);
  const barrels = [...SC, ...DV].filter((q) => named(q, "Barrel00")).length;
  const ribbed = DV.filter((q) => named(q, "Streetdeco002")).length;
  // (a street piece on the ring road's band is its facing district's, Milestone 1074: THE STACKS' cooling units at its own mouth)
  const BD5 = (cfg.rules.dress as unknown as { cover: { band?: { from: number } }; districtCover: { sectors: Record<string, string> } });
  const facing5 = (c?: number[]) => {
    if (!c || !BD5.cover.band || Math.max(Math.abs(c[0]), Math.abs(c[1])) < BD5.cover.band.from) return undefined;
    const [x, z] = c;
    return BD5.districtCover.sectors[Math.abs(x) <= 50 ? (z < 0 ? "n" : "s") : Math.abs(z) <= 50 ? (x < 0 ? "w" : "e") : (z < 0 ? "n" : "s") + (x < 0 ? "w" : "e")];
  };
  // (by its set: a set laid from a spot on the band is its spot's district's, the most of its parts', though a part may reach
  // inside the band or over a sector's line)
  const votes5 = new Map<number, Map<string, number>>();
  for (const q of SC as Array<{ c?: number[]; set?: number }>) {
    const f = facing5(q.c);
    if (!f || q.set === undefined) continue;
    const v = votes5.get(q.set) ?? votes5.set(q.set, new Map()).get(q.set)!;
    v.set(f, (v.get(f) ?? 0) + 1);
  }
  const setFacing5 = (s?: number) => (s === undefined ? undefined : [...(votes5.get(s) ?? new Map<string, number>())].sort((p, q) => q[1] - p[1])[0]?.[0]);
  const cooling = [...SC, ...DV].filter((q) => named(q, "Coolbox") && (q.d ?? setFacing5((q as { set?: number }).set) ?? facing5((q as { c?: number[] }).c)) !== "stacks").length;
  const outer = (CH["c-cover"]?.place ?? []).filter((q) => String(q[0]).endsWith(`/${CL.board.piece}`) && Math.max(Math.abs(Number(q[1])), Math.abs(Number(q[3]))) >= CL.cover.tall.within + 3).length;
  const kinds = new Map<string, Set<string>>();
  for (const q of DV) (kinds.get(q.piece) ?? kinds.set(q.piece, new Set()).get(q.piece)!).add(q.d!);
  const shared = [...kinds].filter(([p, ds]) => ds.size > 1 && !p.startsWith("Wall_Simple") && !p.startsWith("Fastfood") && !p.startsWith("Rack") && !p.startsWith("Window_sunshade") && !p.startsWith("VendingMachine00b")).map(([p]) => p);
  check(
    "one kit a district: no barrel in the cover, the ribbed box the centre's, the cooling units THE STACKS' alone, the poster sheets inside the middle",
    barrels === 0 && ribbed === 0 && cooling === 0 && outer === 0 && shared.length === 0,
    `${barrels} barrels, ${ribbed} ribbed boxes and ${cooling} cooling units out of place, ${outer} sheets past ${CL.cover.tall.within} m, shared ${shared.join(", ") || "none"}`,
  );
  // (each district its own ground: every tile past the centre worn by its side of the straight roads, the road's its own)
  const GD = (cfg.rules.ground as unknown as { tile: string; road: string; districts: { seam: number; sides: Record<string, string> } });
  let tiles = 0, wrong = 0, cobble = 0;
  for (const [k, ch] of Object.entries(CH)) {
    if (!k.startsWith("ground-")) continue;
    for (const q of ch.place) {
      if (!String(q[0]).endsWith(GD.tile)) continue;
      tiles++;
      const [x, z] = [Number(q[1]) + 5, Number(q[3]) - 5];
      const s = GD.districts.seam;
      const want = GD.districts.sides[(z < -s ? "n" : z > s ? "s" : "") + (x < -s ? "w" : x > s ? "e" : "")];
      // (the road's own, in its finer tile since Milestone 988)
      if (q[6] === GD.road || q[6] === (GD as unknown as { roadTile?: string }).roadTile) continue;
      if (!q[6]) cobble++;
      if ((q[6] ?? undefined) !== want) wrong++;
    }
  }
  const YL = (cfg.rules.districts as unknown as { works: { chunk: string; halls: Array<{ box: number[] }>; lines: { piece: string; mat: string } } }).works;
  const lines = (CH[YL.chunk]?.place ?? []).filter((q) => String(q[0]).endsWith(`/${YL.lines.piece}`) && q[6] === YL.lines.mat);
  const inHall = lines.filter((q) => YL.halls.some(({ box: [a, b, e, f] }) => Number(q[1]) > a && Number(q[1]) < b && Number(q[3]) > e && Number(q[3]) < f)).length;
  check(
    "each district its own ground: every tile past the centre worn by its side of the straight roads, the brown cobble LANTERN ALLEYS' alone, yellow lines round THE WORKS' halls",
    tiles > 500 && wrong === 0 && new Set(Object.values(GD.districts.sides)).size >= 7 && cobble > 0 && cobble <= 120 && lines.length >= 30 && inHall === 0,
    `${tiles} tiles, ${wrong} wrong, ${new Set(Object.values(GD.districts.sides)).size} grounds, ${cobble} in the cobble; ${lines.length} lengths of line, ${inHall} in a hall`,
  );
  // (and none of those grounds black by day, Milestone 1041: THE STRIP's black glass, its map times its colour 0.11, read
  // "close to black, half of every frame a void" in both district reviews of version 131. Each ground's colour map, read
  // off the pack's own files, times the material's colour and its tint, at least `least`)
  const least = (GD.districts as unknown as { least?: number }).least;
  const X = join(process.env.PAID_DIR ?? "C:/Users/jwilb/Downloads/speedkills-paid", "neon", "extract");
  const albedo: string[] = [];
  let dark = 0;
  if (existsSync(X)) {
    const { default: sharp } = await import("sharp");
    const byName = new Map<string, string>(), byGuid = new Map<string, string>();
    for (const pk of readdirSync(X))
      for (const g of readdirSync(join(X, pk))) {
        const p = join(X, pk, g, "pathname");
        if (!existsSync(p)) continue;
        const path = readFileSync(p, "utf8").split("\n")[0];
        byGuid.set(g, join(X, pk, g));
        if (path.endsWith(".mat")) byName.set(path.split("/").pop()!.slice(0, -4), join(X, pk, g));
      }
    for (const [side, spec] of Object.entries(GD.districts.sides)) {
      const [name, hex] = spec.split("*#");
      const s = readFileSync(join(byName.get(name)!, "asset"), "utf8");
      const m = s.match(/- _(?:MainTex|BaseMap|BaseColorMap):\s*\n\s*m_Texture: \{fileID: \d+, guid: ([0-9a-f]+)/)!;
      const col = s.match(/- _(?:Color|BaseColor): \{r: ([0-9.]+), g: ([0-9.]+), b: ([0-9.]+)/);
      const n = hex ? parseInt(hex.slice(0, 6), 16) : 0xffffff;
      const c = (col ? col.slice(1, 4).map(Number) : [1, 1, 1]).map((v, i) => v * (((n >> (16 - 8 * i)) & 255) / 255));
      const { data, info } = await sharp(join(byGuid.get(m[1])!, "asset")).resize(64, 64).removeAlpha().raw().toBuffer({ resolveWithObject: true });
      const avg = [0, 1, 2].map((i) => { let t = 0; for (let k = i; k < data.length; k += info.channels) t += data[k]; return (t / (data.length / info.channels) / 255) * c[i]; });
      const lum = 0.2126 * avg[0] + 0.7152 * avg[1] + 0.0722 * avg[2];
      if (lum < (least ?? 1)) dark++;
      albedo.push(`${side} ${lum.toFixed(2)}`);
    }
  }
  check(
    "no district's ground black by day: each one's colour map times its colour at least the least",
    least !== undefined && albedo.length === Object.keys(GD.districts.sides).length && dark === 0,
    `${albedo.join(", ") || "no pack files"}; least ${least}`,
  );
  // (no black faces: the ribbed box and the crate carry their own map as a glow wherever they stand with no material of their
  // own, and each low panel of a set in a lit place its strip)
  const WR = cfg.rules.wear as unknown as Record<string, string>;
  const glowing = ["Streetdeco002c.prefab", "Streetdeco002.prefab", "Streetdeco002b.prefab", "Crate00.prefab"];
  const unlit = Object.values(CH).flatMap((ch) => ch.place).filter((q) => glowing.some((n) => String(q[0]).endsWith(`/${n}`)) && !String(q[6] ?? "").includes("~#") && !q[6]).length;
  const lowStreet = (CH["c-cover"]?.place ?? []).filter((q) => String(q[0]).endsWith(`/${CL.trim.on}`) && Number(q[8]) < 1).length;
  const LOW = lowStreet + DV.filter((q) => q.piece === CL.trim.on && CL.trim.glow[q.d!]).length;
  const strips = Object.values(CH).flatMap((ch) => ch.place).filter((q) => String(q[0]).endsWith(`/${CL.trim.piece}`) && (q[6] === undefined || Object.values(CL.trim.glow).includes(String(q[6]))) && Number(q[2]) > 1.4 && Number(q[2]) < 2.4).length;
  check(
    "no black faces: the ribbed box and the crate glowing their own maps wherever they stand, each low panel of a set with its lit strip",
    glowing.every((n) => (WR[n] ?? "").split(";").every((r) => r.includes("~#"))) && unlit === 0 && strips >= LOW * 0.9 && LOW > 0,
    `${unlit} left unlit, ${strips} strips for ${LOW} panels`,
  );
}


// THE VAULT's door, its gold, the slabs' rims and the tower's lines (Milestones 1043 to 1046; the centre's fifteenth reviews: "the
// strongroom door not identifiable", "at most a small octagon far right", "flat mustard boxes on marble", "grey side rooms",
// "the low-res ceiling", "brick slab edges", "a brick beam across the room", "the tower's yellow edge lines read as
// selection outlines")
{
  type Row = [string, number, number, number, number, string, string?, unknown?, number?, number?];
  const TWr = cfg.rules.tower as unknown as { mats: { rim?: string }; vaultBand: { mat: string }; storeyBands?: { at: number[][]; mat: string }; clad?: Array<{ mat: string; boxes: number[][] }>; floors: { at: Record<string, { mat?: string; plinthMat?: string; gateMat?: string; ceilingScale?: number; coverMat?: Record<string, string>; holes?: number[][]; vault?: { door?: { across: number; parts: unknown[][] } } }> } };
  const FA3 = TWr.floors.at;
  const C3 = (cfg.tower as unknown as { core: { box: number[]; wall: number; landing: number; storeys: number[]; doors: string[][] } }).core;
  const S3 = (SOLIDS as { solids: number[][] }).solids;
  const pl3 = ((cfg as unknown as { chunks: Record<string, { place: Row[] }> }).chunks["c-tower"]?.place ?? []) as Row[];
  // 1: the round doorway on its edge, at least 3.2 m across, under the 35 m hole, facing the core's south door, which is
  // open, 2.4 to 7 m off, its opening over the racks of gold standing in it seen from a standing eye in the doorway (nine sight
  // lines to points a third of a metre in front of its middle and upper half, none through a box). Milestone 1060: it was a closed
  // leaf 4 m across; the sixteenth reviews asked for the door swung open, and the strongroom is 4 m deep from the core's face
  // to the wall, so a leaf 2.7 m across stands open with a 1.5 m way round its edge, in a doorway 3.25 m across
  const D3 = FA3["32"].vault?.door;
  const leafName = String(D3?.parts[0]?.[0] ?? "");
  const leaf = pl3.find((q) => leafName !== "" && String(q[0]).endsWith(`/${leafName}`) && q[2] > 32 && q[2] < 37 && Number(q[9] ?? 0) === 90);
  const open32 = C3.doors[C3.storeys.indexOf(32)]?.includes("s") ?? false;
  const r3 = leaf && D3 ? (D3.across * Number(leaf[8] ?? 1)) / 2 : 0;
  const [dx3, dz3] = [C3.box[0] + C3.wall + C3.landing / 2, C3.box[3]];
  let angle = 180, dist = 0, blocked = 9, under = false;
  if (leaf) {
    const yaw = (leaf[4] * Math.PI) / 180;
    // (a cap tipped a quarter about its own x faces its own +y: turned by its yaw, that is (sin, 0, cos) on the map)
    const n3 = [Math.sin(yaw), Math.cos(yaw)];
    const [tx, tz] = [dx3 - leaf[1], dz3 - leaf[3]];
    dist = Math.hypot(tx, tz);
    angle = (Math.acos((n3[0] * tx + n3[1] * tz) / dist) * 180) / Math.PI;
    const eye = [dx3, 33.7, dz3 + 0.35];
    // (not through a slab's plate under its drawn face, Milestone 1095: a face thinner than rules.collision.thin is thickened
    // 0.3 m downward in the collision, and from the door the ring's upper half is seen 16 cm under the 35 m gallery's drawn
    // edge, 34.5 m, through its plate, 34.2 to 34.5)
    const plate3 = (b: number[]) => b[5] - b[4] <= 0.35 && Math.abs(b[5] - 34.5) < 0.06;
    const seg = (p: number[], q: number[]) => S3.some((b) => {
      if (plate3(b)) return false;
      let [t0, t1] = [0, 1];
      for (const [a, lo, hi] of [[0, b[0], b[1]], [1, b[4], b[5]], [2, b[2], b[3]]] as Array<[number, number, number]>) {
        const d = q[a] - p[a];
        if (Math.abs(d) < 1e-9) {
          if (p[a] < lo || p[a] > hi) return false;
          continue;
        }
        const [u, v] = [(lo - p[a]) / d, (hi - p[a]) / d];
        [t0, t1] = [Math.max(t0, Math.min(u, v)), Math.min(t1, Math.max(u, v))];
        if (t0 > t1) return false;
      }
      return true;
    });
    const [ax, az] = [Math.cos(yaw), -Math.sin(yaw)];
    blocked = 0;
    for (const [u, v] of [[0, 0], [-0.7, 0], [0.7, 0], [0, 0.7], [-0.5, 0.5], [0.5, 0.5], [0, 0.35], [-0.35, 0.35], [0.35, 0.35]]) {
      const p = [leaf[1] + ax * u * r3 + n3[0] * 0.3, leaf[2] + v * r3, leaf[3] + az * u * r3 + n3[1] * 0.3];
      if (seg(eye, p)) blocked++;
    }
    // (what of it stands over the 35 m slab's underside, 34.5 m, inside the hole: its middle is under the slab there)
    const H3 = FA3["35"].holes?.[0] ?? [0, 0, 0, 0];
    const w3 = leaf[2] + r3 > 34.5 ? Math.sqrt(Math.max(0, r3 * r3 - Math.max(0, 34.5 - leaf[2]) ** 2)) : 0;
    under = leaf[1] - w3 > H3[0] && leaf[1] + w3 < H3[1] && leaf[3] > H3[2] && leaf[3] < H3[3] && leaf[2] + r3 < 38;
  }
  check(
    "THE VAULT's door the hero: a round doorway 3.2 m across and more under the 35 m hole, on the axis of the core's open south door 2.4 to 7 m off, its opening seen from it",
    // (2.4 m and more since Milestone 1095: the wall came 0.6 m nearer so the gates beside it open into the room, the ring's back
    // 2.52 m from the door's middle; picture 30's spot moves into the doorway to keep its framing)
    open32 && !!leaf && 2 * r3 >= 3.2 && angle <= 25 && dist >= 2.4 && dist <= 7 && blocked === 0 && under,
    `south door open ${open32}, ${leaf ? `${(2 * r3).toFixed(2)} m across, ${angle.toFixed(1)} degrees off the door's axis, ${dist.toFixed(1)} m off, ${blocked} of 9 sight lines blocked, under the hole ${under}` : "no round door"}`
  );
  // 2: the gold darker and trimmed black: the walls a tint of the yellow paint each channel at three quarters and less (or
  // another material), the skirting and the gates' frames black, each container's gold glow at 0.4 and less with a black
  // part, the ceiling's tiles at a UV scale of 0.2 and more (MetalSquareTiles01 tiles twice a UV: 2.5 m a map and less), the
  // stair core's inside skinned at the storey, nothing of the 35 m floor's plinth over its hole
  const tintOk = (m?: string) => !!m && m !== "MetalPaintPannelsYellow00" && (!m.includes("*#") || [0, 2, 4].every((i) => parseInt(m.split("*#")[1].slice(i, i + 2), 16) <= 0.75 * 255));
  const CM = FA3["32"].coverMat ?? {};
  const glowK = Object.values(CM).flatMap((m) => [...m.matchAll(/~#[0-9a-f]{6}\|([\d.]+)/g)].map((x) => Number(x[1])));
  // (a rack's frame is the pack's own black paint, so it needs no remap: three containers with a part worn black)
  const coverOk = Object.keys(CM).length >= 3 && Object.values(CM).filter((m) => /=(MetalPaintBlack|PlasticBlack00)/.test(m)).length >= 3 && glowK.length > 0 && glowK.every((k) => k <= 0.4);
  const [cx0, cx1, cz0, cz1] = C3.box;
  const inside = (TWr.clad ?? []).flatMap((c) => c.boxes).filter(([x0, x1, y0, y1, z0, z1]) => x0 >= cx0 + C3.wall - 0.05 && x1 <= cx1 - C3.wall + 0.05 && z0 >= cz0 + C3.wall - 0.05 && z1 <= cz1 - C3.wall + 0.05 && y0 >= 31.99 && y1 <= 35.01).length;
  const OH = (cfg.tower as unknown as { measured: { offHoles?: Array<{ at: number; part: string; tris: number }> } }).measured.offHoles ?? [];
  const plinthOff = OH.some((q) => q.at === 35 && q.part === "plinth" && q.tris > 0);
  check(
    "THE VAULT's gold darker and trimmed black: its walls off the paint's mustard, black skirting and gate frames, dark gold containers with black parts, the ceiling's tiles a sane size, the stair core's inside in gold, no plinth over the 35 m hole",
    tintOk(FA3["32"].mat) && /Black/.test(FA3["32"].plinthMat ?? "") && /MetalBare00=MetalPaintBlack/.test(FA3["32"].gateMat ?? "") && coverOk && (FA3["32"].ceilingScale ?? 0) >= 0.2 && inside >= 6 && plinthOff,
    `walls ${FA3["32"].mat}, skirting ${FA3["32"].plinthMat}, gates ${/MetalBare00=MetalPaintBlack/.test(FA3["32"].gateMat ?? "") ? "black framed" : "not black framed"}, containers ${coverOk ? "dark gold and black" : "not"} (glow ${glowK.join("/")}), ceiling ${FA3["32"].ceilingScale ?? "0.1"} a metre, ${inside} skins inside the core, plinth trimmed off the hole ${plinthOff}`
  );
  // 3: every slab's rim in the tower and the base off brick, as the layout copied them for the bake
  const BMr = (cfg.rules.base as unknown as { mats: { rim?: string } }).mats;
  const rims = [TWr.mats.rim, BMr.rim, (cfg.tower as unknown as { mats: { rim?: string } }).mats.rim, (cfg.base as unknown as { mats: { rim?: string } }).mats.rim];
  check("the slabs' rims, every hole's and stair's edge in the tower and the base, in concrete not brick", rims.every((m) => !!m && !/Brick/.test(m)) && rims[0] === rims[2] && rims[1] === rims[3], rims.map((m) => m ?? "none").join(", "));
  // 4: no lit post or strip taller than 3 m within 3 m of the tower's square nor a ring round it at its crown; a band at
  // each storey the rules list, each round most of the tower, in another colour than THE VAULT's gold, and thinner
  const [qx0, qx1, qz0, qz1] = (cfg.tower as unknown as { square: number[] }).square;
  const OL = (cfg.game as unknown as { outlines: Array<{ name: string; rect?: number[]; posts?: boolean; y: number; h: number }> }).outlines;
  const boxy = OL.filter((o) => o.rect && o.rect[0] > qx0 - 3 && o.rect[1] < qx1 + 3 && o.rect[2] > qz0 - 3 && o.rect[3] < qz1 + 3 && (o.posts || o.h > 3 || o.y > 100)).map((o) => o.name);
  const SBm = (cfg.tower as unknown as { measured: { storeyBands?: Array<{ at: number; length: number; high: number }>; bands?: Array<{ high?: number }> } }).measured;
  const sb = SBm.storeyBands ?? [];
  // (since Milestone 1081 a band at each line a played storey touches, in that storey's light, rules.tower.lit; none gold)
  const LIT5 = (cfg.rules.tower as unknown as { lit?: { spans: Array<[number, number, string]> } }).lit?.spans;
  const lit5 = (h: number) => LIT5?.find(([y0]) => Math.abs(y0 - h) < 0.01) ?? LIT5?.find(([y0, y1]) => h > y0 + 0.01 && h <= y1 + 0.01);
  const want5 = (TWr.storeyBands?.at ?? []).filter(([h]) => !LIT5 || !!lit5(h));
  const gold5 = (TWr.storeyBands?.at ?? []).filter(([h]) => /#ffb020/.test(lit5(h)?.[2] ?? "")).length;
  const thinner = sb.every((b) => b.high < Math.min(...(SBm.bands ?? []).map((v) => v.high ?? 0)));
  check(
    "the tower's lines a storey at a time: no lit box round its square, a band round the facade at each line a played storey touches, none in THE VAULT's gold, THE VAULT's two gold and thicker",
    boxy.length === 0 && !!TWr.storeyBands && want5.length > 0 && sb.length === want5.length && sb.every((b) => b.length > 60) && /#ffb020/.test(TWr.vaultBand.mat) && !/#ffb020/.test(TWr.storeyBands.mat) && gold5 === 0 && thinner,
    `${boxy.length ? `round its square: ${boxy.join(", ")}; ` : ""}${sb.length} of ${want5.length} played storeys' lines baked (of ${TWr.storeyBands?.at.length ?? 0} lines), ${gold5} gold, the shortest ${sb.length ? Math.min(...sb.map((b) => b.length)) : 0} m, THE VAULT's in ${TWr.vaultBand.mat}`
  );
}

// The roofs dressed (Milestones 1047 to 1050; the centre's fifteenth reviews and the districts' ninth, 2026-11-02: "the lookout bare, its rim a
// black band", "the High City roof a bare disc", "the gangway's cover on one rail, its shield a huge stretched texture", "THE
// CANYON's roofs acres of flat brown"): every piece of rules.highCover.roofs' groups laid, in the bake's laid boxes from its
// foot to its top, on a floor topped at its foot; on the lookout's raised middle and on every High City deck and THE CANYON a
// piece over a standing eye, each deck its stair house, plant and sign frame, THE CANYON its stair houses, tank stands and sign
// frames; none nearer a way onto a roof than its keep-off (a deck pad's landing, a lift's top, a zip's end, a bridge's end, a pad's
// landing elsewhere, the lookout's way down, THE CANYON's crossings and roof lamps); each rail of the gangway cover past a crouch
// with no gap between pieces longer than `every`, a lane between the rails wider than `lane` at a body's height all the way, walked
// end to end both ways, and the lookout's floor walked round from the top pad's landing; the lookout's coping not the pack's black;
// every half-size shield panel worn in its own top concrete
{
  type Row = [string, string, number, number, number, number, number, string?];
  type RR = { groups: Record<string, number>; tall: number; decks: { hut: string; plant: string[]; sign: string }; canyon: { huts: number; tanks: number; signs: number; tank: string }; keep: Record<string, number>; lane: number; every: number; high: number; shield: { piece: string; scale: number; mat: string }; coping: string; walk: { lookout: number[][][]; gangway: number[] } };
  const HCR = (cfg.rules as unknown as { highCover: { at: Row[]; roofs?: RR } }).highCover;
  const RR = HCR.roofs;
  const HCo = (cfg as unknown as { highCover?: Record<string, number[][]> }).highCover ?? {};
  const F9 = SOLIDS as unknown as { solids: number[][]; laid: number[][] };
  const inLaid = new Uint8Array(F9.solids.length);
  for (const [a, b] of F9.laid) inLaid.fill(1, a, b);
  const said: string[] = [];
  let ok = !!RR;
  if (!RR) said.push("no rules.highCover.roofs");
  else {
    // (a spot's footprint on the map from what the layout wrote: [x, z, foot, top, half along its own x, half along its own z, turn])
    const foot = (q: number[]) => {
      const t = q.length > 6 && ((q[6] % 180) + 180) % 180 === 90;
      const [hx, hz] = t ? [q[5], q[4]] : [q[4], q[5]];
      return [q[0] - hx, q[0] + hx, q[1] - hz, q[1] + hz];
    };
    const gap = (f: number[], x: number, z: number) => Math.hypot(Math.max(0, f[0] - x, x - f[1]), Math.max(0, f[2] - z, z - f[3]));
    const rowsOf = (g: string) => HCR.at.filter((r) => r[0] === g);
    const short: string[] = [];
    const unlaid: string[] = [];
    const floating: string[] = [];
    for (const [g, least] of Object.entries(RR.groups)) {
      const got = HCo[g] ?? [];
      if (got.length < least || got.length !== rowsOf(g).length) short.push(`${g} ${got.length} of ${least}`);
      for (const q of got) {
        const f = foot(q);
        const over = (b: number[]) => b[0] < f[1] && b[1] > f[0] && b[2] < f[3] && b[3] > f[2];
        if (!F9.solids.some((b, i) => inLaid[i] && over(b) && Math.abs(b[5] - q[3]) < 0.16) || !F9.solids.some((b, i) => inLaid[i] && over(b) && Math.abs(b[4] - q[2]) < 0.16)) unlaid.push(`${g} (${q[0]}, ${q[1]})`);
        // (a floor topped at its foot under it: a sign frame's legs stand either side of a notch in a deck, so not under its middle)
        if (!F9.solids.some((b) => over(b) && Math.abs(b[5] - q[2]) < 0.07)) floating.push(`${g} (${q[0]}, ${q[1]})`);
      }
    }
    if (short.length || unlaid.length || floating.length) (ok = false), said.push(`${[...short, ...unlaid.map((s) => `${s} not in laid boxes`), ...floating.map((s) => `${s} on no floor`)].slice(0, 4).join("; ")}`);
    // the kinds asked for, and pieces over a standing eye
    const kinds = (g: string, names: string[]) => rowsOf(g).filter((r) => names.some((n) => r[1].endsWith(n))).length;
    const tallIn = (g: string) => (HCo[g] ?? []).filter((q) => q[3] - q[2] >= RR.tall).length;
    const decks = ["deck-n", "deck-s", "deck-w", "deck-e"];
    const thin = decks.filter((g) => !(kinds(g, [RR.decks.hut]) >= 1 && kinds(g, RR.decks.plant) >= 1 && kinds(g, [RR.decks.sign]) >= 1 && tallIn(g) >= 3));
    const CK = RR.canyon;
    const canyon = [kinds("canyon", [RR.decks.hut]), kinds("canyon", [CK.tank]), kinds("canyon", [RR.decks.sign])];
    if (thin.length || canyon[0] < CK.huts || canyon[1] < CK.tanks || canyon[2] < CK.signs || tallIn("lookout-mid") < 1) (ok = false), said.push(`decks short of a kind: ${thin.join(", ") || "none"}; THE CANYON ${canyon.join("/")} of ${CK.huts}/${CK.tanks}/${CK.signs}; the lookout ${tallIn("lookout-mid")} over an eye`);
    // the ways onto a roof
    const K = RR.keep;
    const ways: Array<[string, number, number, number]> = [];
    for (const q of cfg.pads) ways.push([`pad ${q.id}`, q.face[0] - q.out[0] * 3, q.face[1] - q.out[1] * 3, K.pad]);
    for (const q of (cfg as unknown as { lifts: Array<{ id: string; land: number[] }> }).lifts) ways.push([`lift ${q.id}`, q.land[0], q.land[1], K.lift]);
    for (const q of (cfg as unknown as { zips: Array<{ block: string; a: number[]; b: number[] }> }).zips) {
      ways.push([`zip ${q.block}`, q.a[0], q.a[2], K.zip]);
      if (q.block.startsWith("lookout")) ways.push([`zip top ${q.block}`, q.b[0], q.b[2], K.zipTop]);
    }
    for (const path of (cfg.rules as unknown as { bridges: { paths: number[][][] } }).bridges.paths) for (const e of [path[0], path.at(-1)!]) ways.push([`bridge (${e.join(", ")})`, e[0], e[1], K.bridge]);
    for (const q of SPINE.up) ways.push([`pad ${q.id}`, q.face[0] - q.out[0] * q.land, q.face[1] - q.out[1] * q.land, K.landing]);
    for (const q of SPINE.down) ways.push([`pad ${q.id}`, q.pad[0], q.pad[1], K.downPad]);
    const CR = (cfg.rules as unknown as { districts: { canyon: { roofs: { bridges: number[][] }; light: { roofLamps: number[][] } } } }).districts.canyon;
    for (const [x, z, yaw] of CR.roofs.bridges) for (const s of [-1, 1]) ways.push([`crossing (${x}, ${z})`, yaw % 180 ? x : x + s * 5.05, yaw % 180 ? z + s * 5.05 : z, K.crossing]);
    for (const [x, z] of CR.light.roofLamps) ways.push([`roof lamp (${x}, ${z})`, x, z, K.lamp]);
    const near: string[] = [];
    for (const g of Object.keys(RR.groups).filter((g) => g !== "gangway"))
      for (const q of HCo[g] ?? []) {
        const f = foot(q);
        for (const [n, x, z, r] of ways) if (gap(f, x, z) < r) near.push(`${g} (${q[0]}, ${q[1]}) ${gap(f, x, z).toFixed(1)} m from ${n}`);
      }
    if (near.length) (ok = false), said.push(near.slice(0, 3).join("; "));
    // the gangway: each rail's cover past a crouch as spans along it, its own sets and shields and the new pieces
    const GW = (cfg as unknown as { gangway: { leg: number[]; z: number; deck: number; sets: number[][]; shields: number[][] } }).gangway;
    const [g0, g1] = [GW.leg[0] + RR.walk.gangway[0], GW.leg[1] - RR.walk.gangway[1]];
    const longest = (side: number) => {
      const s: number[][] = [];
      for (const q of [...GW.sets, ...GW.shields]) if (q[5] === side && q[4] - GW.deck >= RR.high) s.push([q[0] - q[2], q[0] + q[2]]);
      for (const q of HCo.gangway ?? []) {
        const f = foot(q);
        if (Math.sign((f[2] + f[3]) / 2 - GW.z) === side && q[3] - GW.deck >= RR.high) s.push([f[0], f[1]]);
      }
      s.sort((a, b) => a[0] - b[0]);
      let [at, most] = [g0, 0];
      for (const [a, b] of s) {
        if (b < g0 || a > g1) continue;
        most = Math.max(most, a - at);
        at = Math.max(at, b);
      }
      return Math.max(most, g1 - at);
    };
    const rails = [longest(-1), longest(1)];
    // (the lane: at each quarter metre the widest clear stretch between the rails' glass at a body's height, in the game's grid)
    let lane = Infinity;
    let laneAt = 0;
    for (let x = g0; x <= g1; x += 0.25) {
      const [wx, z0, z1] = [x + BR_X, GW.z - 2 + BR_Z, GW.z + 2 + BR_Z];
      const occ = solidsIn(wx - 0.01, wx + 0.01, z0, z1).filter((b) => b.minX <= wx && b.maxX >= wx && b.maxZ > z0 && b.minZ < z1 && b.base < GW.deck + MOVE.standHeight && b.top > GW.deck + MOVE.stepHeight).map((b) => [b.minZ, b.maxZ]).sort((a, b) => a[0] - b[0]);
      let [z, best] = [z0, 0];
      for (const [a, b] of occ) {
        best = Math.max(best, a - z);
        z = Math.max(z, b);
      }
      best = Math.max(best, z1 - z);
      if (best < lane) [lane, laneAt] = [best, x];
    }
    const there = along([[g0, GW.z, GW.deck], [g1, GW.z, GW.deck]]);
    const back = along([[g1, GW.z, GW.deck], [g0, GW.z, GW.deck]]);
    if (rails.some((d) => d > RR.every) || lane < RR.lane || there.k !== 2 || back.k !== 2) (ok = false), said.push(`the gangway: rails' longest stretch bare ${rails.map((d) => d.toFixed(1)).join("/")} m, lane ${lane.toFixed(2)} m at x ${laneAt}, walked ${there.k - 1} and ${back.k - 1} of 1`);
    // the lookout's floor walked from the top pad's landing to each end of it
    const stuck = RR.walk.lookout.map((r) => along(r)).map((w, i) => (w.k === RR.walk.lookout[i].length ? "" : `walk ${i + 1} stopped at (${w.x.toFixed(1)}, ${w.z.toFixed(1)}) ${w.y.toFixed(2)} m`)).filter(Boolean);
    if (stuck.length) (ok = false), said.push(`the lookout: ${stuck.join("; ")}`);
    // the coping, and the half-size panels' faces
    const CH = cfg.chunks as unknown as Record<string, { place: unknown[][] }>;
    const mid = CH["c-middle"].place[0];
    const coped = String(mid[6] ?? "").split(";").some((p) => p.startsWith(`${RR.coping}=`) && !p.endsWith(`=${RR.coping}`));
    const panels = [...CH["c-bridges"].place, ...CH["c-hcover"].place].filter((q) => String(q[0]).endsWith(`/${RR.shield.piece}`) && q[8] === RR.shield.scale);
    const bare = panels.filter((q) => !RR.shield.mat.split(";").every((p) => String(q[6] ?? "").split(";").includes(p)));
    if (!coped || bare.length || !panels.length) (ok = false), said.push(`the coping ${coped ? "worn" : "black"}; ${bare.length} of ${panels.length} half-size panels in the pack's own faces`);
    if (ok) said.push(`${Object.keys(RR.groups).map((g) => `${g} ${(HCo[g] ?? []).length}`).join(", ")}; the gangway's rails bare at most ${rails.map((d) => d.toFixed(1)).join("/")} m, its lane ${lane.toFixed(2)} m; ${panels.length} panels worn`);
  }
  check("the roofs dressed: the lookout's middle, the High City decks and THE CANYON's roofs, the gangway's cover on both rails, each piece laid on its roof off every way onto it; the lookout's coping grey, the half-size panels' faces at their own scale", ok, said.join("; "));
}
// GLASS HEIGHTS its own (the districts' ninth reviews of version 131, the district the weakest at 5.7 and 5.0: "it reads as
// more of the centre's High City", "pale glass", "white cladding, a tower that reads white", "a big lit name at eye level
// by the court", "a lift car that reads, cover off the lift's line", "the two slabs off the lift's foot", "planters, glass
// partitions, kiosks every 12 m" on "an empty hex runway"). Its blocks, tower, cover and car in the look's white and pale
// glass; its name at eye level on the face it stands on; nothing standing on its lift's line from the court's mouth to the
// car's door but the car and the court's lamp, the lift lit and capped; on each deck nothing but its own kit, and standing
// cover within `far` of every open spot, measured off the collision
{
  type GlassOwn = {
    buildings: Array<[string, number, number, number, string?]>;
    look?: { white: string; glass: string; windows: string; frames: string[]; panes: string[] };
    name: { at: number[]; w: number; h: number; yaw: number };
    lift: { car: number[]; carMat: string; line?: number[][]; lineClear?: number; view?: { tall: number; within: number }; shaft: { half: number; from: number; tiers: number; cap?: { piece: string } } };
    ground: { rows: Array<{ at: number[][] }>; lamps: { at: number[][] } };
    deck?: { kit: Record<string, string>; decks: Record<string, number[]>; far: number; tall: number; foot: number };
  };
  const GH = (cfg.rules as unknown as { districts: { glass: GlassOwn } }).districts.glass;
  const LK = GH.look;
  const CHg = (cfg as unknown as { chunks: Record<string, { place: unknown[][] }> }).chunks;
  const S9 = (SOLIDS as { solids: number[][] }).solids.filter((b) => b[1] > -40 && b[0] < 40 && b[3] > -160 && b[2] < -95);
  const remapOf = (s?: string) => new Map((s ?? "").split(";").filter(Boolean).map((p) => p.split("=") as [string, string]));
  // (1) the look: each block's frames in the white, its dark glass pale, its lit windows pale; the tower's body white; the
  // districts' cover panels and the car's frame in the same white
  const offLook: string[] = [];
  for (const [piece, , , , mat] of LK ? GH.buildings : []) {
    const m = remapOf(mat);
    for (const [from, to] of m) {
      if (LK!.frames.includes(from) && to !== LK!.white) offLook.push(`${piece} ${from}`);
      if (LK!.panes.includes(from) && to !== `${from}${LK!.glass}`) offLook.push(`${piece} ${from}`);
      if (/^BuildWindows00[bc]?$/.test(from) && to !== `${from}${LK!.windows}`) offLook.push(`${piece} ${from}`);
    }
    if (![...m.keys()].some((k) => LK!.frames.includes(k))) offLook.push(`${piece}: no white frame`);
  }
  const DCm = (cfg.rules.dress as unknown as { districtCover: { mats: Record<string, Record<string, string>> } }).districtCover.mats.glass ?? {};
  // (each piece of its cover all the look's white, or since Milestone 1077 worn as its decks' own kit wears it: the screens' white
  // frames on the patterned glass lit cyan, the troughs and benches white with lit edges)
  const coverWhite = !!LK && Object.values(DCm).length > 0 && Object.entries(DCm).every(([k, s]) => GH.deck?.kit?.[k] === s || [...remapOf(s).values()].every((v) => v === LK.white));
  const carWhite = !!LK && [...remapOf(GH.lift.carMat).values()].filter((v) => !v.startsWith("Cristal") && !v.startsWith("Light")).every((v) => v === LK.white);
  check(
    "GLASS HEIGHTS its own look: its blocks and tower framed in clean white, their glass pale, its cover the same white or its decks' own kit, its lift's car white",
    !!LK && offLook.length === 0 && coverWhite && carWhite,
    LK ? `${GH.buildings.length} buildings, ${offLook.length} parts off the look${offLook.length ? ` (${offLook.slice(0, 4).join(", ")})` : ""}; its cover ${coverWhite ? "white or its decks' kit" : "neither white nor its decks' kit"}; the car ${carWhite ? "white" : "not white"}` : "no rules.districts.glass.look",
  );
  // (2) its name at eye level, big, on a face: its plate over a head and under 6 m, 10 m and more wide, a box behind it
  // within 0.8 m across its middle three fifths at its middle height (the collision's columns are half a metre) and nothing
  // solid 0.3 m in front of it
  const NMg = GH.name;
  const [ux, uz] = [Math.cos((NMg.yaw * Math.PI) / 180), -Math.sin((NMg.yaw * Math.PI) / 180)];
  const [ox, oz] = [Math.sin((NMg.yaw * Math.PI) / 180), Math.cos((NMg.yaw * Math.PI) / 180)];
  const solidAt = (x: number, y: number, z: number) => S9.some((b) => x >= b[0] && x <= b[1] && z >= b[2] && z <= b[3] && b[4] < y && b[5] > y);
  let backed = 0, fronted = 0, across = 0;
  for (let a = -0.3; a <= 0.3001; a += 0.1) {
    across++;
    const [px, pz] = [NMg.at[0] + ux * a * NMg.w, NMg.at[2] + uz * a * NMg.w];
    let hit = false;
    for (let d = 0; d <= 0.8001 && !hit; d += 0.05) hit = solidAt(px - ox * d, NMg.at[1], pz - oz * d);
    if (hit) backed++;
    if (solidAt(px + ox * 0.3, NMg.at[1], pz + oz * 0.3)) fronted++;
  }
  const [bottom, top] = [NMg.at[1] - NMg.h / 2, NMg.at[1] + NMg.h / 2];
  check(
    "GLASS HEIGHTS: its name big and lit at eye level, on the face of the front deck's arm beside its court",
    bottom >= 2.2 && top <= 6 && NMg.w >= 8 && backed === across && fronted === 0,
    `${NMg.w} m wide, ${bottom.toFixed(1)} to ${top.toFixed(1)} m up; a face behind it at ${backed} of ${across} points, ${fronted} in something solid`,
  );
  // (3) the lift: its line from the court's mouth (between the first row's cypress pair) to the car's door, nothing standing
  // on it from the street past a crouched head and more than a pole across within `lineClear` of it but the car's own walls
  // and the court's lamps; a LIFT plate over the door and one on the shaft toward the court's mouth; a cap on the shaft
  const [c0, c1] = GH.ground.rows[0].at;
  const mouth = [(c0[0] + c1[0]) / 2, (c0[1] + c1[1]) / 2];
  const [cx, cz] = GH.lift.car;
  // (with no line in the rules, version 131's, the same line measured: from the mouth's middle to the car's open side)
  const L = GH.lift.line ?? [[mouth[0], -95], [mouth[0], cz + 3], [cx + 1.9, cz]];
  const lineOk = !!GH.lift.line && L.length >= 2 && Math.abs(L[0][0] - mouth[0]) < 0.5 && L[0][1] > mouth[1] && Math.hypot(L.at(-1)![0] - cx, L.at(-1)![1] - cz) < 2.5;
  const pts: number[][] = [];
  for (let i = 0; i + 1 < L.length; i++) {
    const n = Math.ceil(Math.hypot(L[i + 1][0] - L[i][0], L[i + 1][1] - L[i][1]) / 0.25);
    for (let k = 0; k <= n; k++) pts.push([L[i][0] + ((L[i + 1][0] - L[i][0]) * k) / n, L[i][1] + ((L[i + 1][1] - L[i][1]) * k) / n]);
  }
  const lamp = (b: number[]) => GH.ground.lamps.at.some(([x, z]) => Math.abs((b[0] + b[1]) / 2 - x) < 0.8 && Math.abs((b[2] + b[3]) / 2 - z) < 0.8);
  const inCar = (b: number[]) => [b[0], b[1]].every((x) => [b[2], b[3]].every((z) => Math.hypot(x - cx, z - cz) < 2.6));
  const off = (b: number[]) => Math.min(...pts.map(([x, z]) => Math.hypot(Math.max(b[0] - x, 0, x - b[1]), Math.max(b[2] - z, 0, z - b[3]))));
  const VW = GH.lift.view ?? { tall: 2.2, within: 4 };
  // (on it inside the district's band, past a crouched head; beside it from the ring road's middle, within the view's band
  // read half a metre in, as the collision's columns reach up to half a metre past a face: past a head)
  const band0 = (cfg.rules.dress as unknown as { districtCover: { band: number[] } }).districtCover.band[0] + (GH.lift.lineClear ?? 1.5);
  const inBand = pts.filter(([x, z]) => Math.max(Math.abs(x), Math.abs(z)) >= band0);
  const offIn = (b: number[]) => Math.min(...inBand.map(([x, z]) => Math.hypot(Math.max(b[0] - x, 0, x - b[1]), Math.max(b[2] - z, 0, z - b[3]))));
  const onLine = S9.filter((b) => b[4] < 0.5 && (b[1] - b[0] > 0.6 || b[3] - b[2] > 0.6) && !inCar(b) && !lamp(b) && ((b[5] > 1.2 && offIn(b) < (GH.lift.lineClear ?? 1.5)) || (b[5] > VW.tall && off(b) < VW.within - 0.5)));
  const SHg = GH.lift.shaft;
  const boards = ((cfg.game as unknown as { boards?: Array<{ text: string; at: number[]; yaw: number }> }).boards ?? []).filter((b) => b.text === "LIFT");
  const overDoor = boards.some((b) => Math.abs(((b.yaw % 360) + 360) % 360 - 90) < 1 && Math.abs(b.at[0] - (cx + SHg.half)) < 0.3 && Math.abs(b.at[2] - cz) < 0.5 && b.at[1] > SHg.from);
  const toMouth = boards.some((b) => Math.abs(b.yaw) < 1 && Math.abs(b.at[2] - (cz + SHg.half)) < 0.3 && Math.abs(b.at[0] - cx) < 0.5 && b.at[1] > SHg.from);
  const capped = !!SHg.cap && (CHg["c-glass"]?.place ?? []).some((q) => String(q[0]).endsWith(`/${SHg.cap!.piece}`) && Math.hypot(Number(q[1]) - cx, Number(q[3]) - cz) < 0.5 && Number(q[2]) > SHg.from + SHg.tiers * 3 - 0.5);
  check(
    "GLASS HEIGHTS: its lift's line clear from the court's mouth to the car's door and nothing over a head beside it, a lit LIFT over the door and toward the court, its shaft capped",
    lineOk && onLine.length === 0 && overDoor && toMouth && capped,
    `${lineOk ? `line of ${L.length} points` : "no line from the court's mouth to the car"}; ${onLine.length} standing on it${onLine.length ? ` (${onLine.slice(0, 3).map((b) => `x ${b[0]} to ${b[1]}, z ${b[2]} to ${b[3]}, ${b[5]} m`).join("; ")})` : ""}; LIFT over the door ${overDoor}, toward the court ${toMouth}; capped ${capped}`,
  );
  // (4) the decks: every piece on them its kit's and in its kit's material; nothing within `foot` of the lift's stair's
  // foot; every open spot of each deck (level at 26 m, a body's room round it) within `far` of standing cover, `tall` and
  // more over the deck, off the collision
  const DK = GH.deck;
  // (the decks' boxes the glass perches' own when the rules name none, version 131's, so it is measured all the same)
  const DECKS: Record<string, number[]> = DK?.decks ?? Object.fromEntries((cfg.rules.perches as unknown as Array<{ name: string; box: number[] }>).filter((p) => /^glass-(front|east|ne|nw)$/.test(p.name)).map((p) => [p.name.slice(6), p.box]));
  const FAR = DK?.far ?? 5, TALL = DK?.tall ?? 1.4;
  const inDeck = (x: number, z: number, m = 1) => Object.values(DECKS).some((b) => x > b[0] - m && x < b[1] + m && z > b[2] - m && z < b[3] + m);
  const laidOn = (CHg["c-dress"]?.place ?? []).filter((q) => Number(q[2]) > 24 && Number(q[2]) < 28 && inDeck(Number(q[1]), Number(q[3])));
  const offKit = laidOn.filter((q) => {
    const short = Object.keys(DK?.kit ?? {}).find((k) => String(q[0]).endsWith(`/${k.split("/").pop()}`));
    return !short || (DK!.kit[short] !== "*" && q[6] !== DK!.kit[short]);
  });
  const foot = (cfg as unknown as { glass?: { lift?: { foot: number[] } } }).glass?.lift?.foot ?? [0, 0];
  const byFoot = ((cfg as unknown as { perches?: Array<{ name: string; at: number[][] }> }).perches ?? []).filter((p) => p.name.startsWith("glass")).flatMap((p) => p.at).filter(([x, , z, , hx, hz]) => Math.hypot(Math.max(Math.abs(x - foot[0]) - hx, 0), Math.max(Math.abs(z - foot[1]) - hz, 0)) < (DK?.foot ?? 1.5));
  const far: string[] = [];
  let farthest = 0;
  {
    const C = 0.25, X0 = -32, Z0 = -154, NI = Math.round(64 / C), NJ = Math.round(50 / C), Y = 26;
    const topA = new Float32Array(NI * NJ).fill(-1e9), body = new Uint8Array(NI * NJ), cov = new Uint8Array(NI * NJ);
    for (const b of S9) {
      if (b[5] < 20) continue;
      for (let i = Math.max(0, Math.floor((b[0] - X0) / C)); i <= Math.min(NI - 1, Math.floor((b[1] - X0) / C)); i++)
        for (let j = Math.max(0, Math.floor((b[2] - Z0) / C)); j <= Math.min(NJ - 1, Math.floor((b[3] - Z0) / C)); j++) {
          const k = i * NJ + j;
          if (b[4] < Y + 0.3 && b[5] > topA[k]) topA[k] = b[5];
          if (b[4] < Y + 1.8 && b[5] > Y + 0.3) body[k] = 1;
          if (b[4] < Y + 1 && b[5] > Y + TALL) cov[k] = 1;
        }
    }
    const level = (i: number, j: number) => i >= 0 && j >= 0 && i < NI && j < NJ && Math.abs(topA[i * NJ + j] - Y) < 0.12 && !body[i * NJ + j];
    const D = new Float32Array(NI * NJ);
    for (let k = 0; k < D.length; k++) D[k] = cov[k] ? 0 : 1e9;
    for (let i = 0; i < NI; i++)
      for (let j = 0; j < NJ; j++) {
        const k = i * NJ + j;
        if (i > 0) D[k] = Math.min(D[k], D[k - NJ] + 1, j > 0 ? D[k - NJ - 1] + Math.SQRT2 : 1e9, j < NJ - 1 ? D[k - NJ + 1] + Math.SQRT2 : 1e9);
        if (j > 0) D[k] = Math.min(D[k], D[k - 1] + 1);
      }
    for (let i = NI - 1; i >= 0; i--)
      for (let j = NJ - 1; j >= 0; j--) {
        const k = i * NJ + j;
        if (i < NI - 1) D[k] = Math.min(D[k], D[k + NJ] + 1, j < NJ - 1 ? D[k + NJ + 1] + Math.SQRT2 : 1e9, j > 0 ? D[k + NJ - 1] + Math.SQRT2 : 1e9);
        if (j < NJ - 1) D[k] = Math.min(D[k], D[k + 1] + 1);
      }
    for (const [name, [a0, a1, b0, b1]] of Object.entries(DECKS)) {
      let worst = 0, at = [0, 0];
      for (let i = 0; i < NI; i++)
        for (let j = 0; j < NJ; j++) {
          const [x, z] = [X0 + (i + 0.5) * C, Z0 + (j + 0.5) * C];
          if (x <= a0 || x >= a1 || z <= b0 || z >= b1 || !level(i, j)) continue;
          if (![-2, 0, 2].every((di) => [-2, 0, 2].every((dj) => level(i + di, j + dj)))) continue;
          if (D[i * NJ + j] * C > worst) (worst = D[i * NJ + j] * C), (at = [x, z]);
        }
      farthest = Math.max(farthest, worst);
      far.push(`${name} ${worst.toFixed(1)} m${worst > FAR ? ` at (${at[0].toFixed(1)}, ${at[1].toFixed(1)})` : ""}`);
    }
  }
  check(
    "GLASS HEIGHTS' decks: cover from their own kit, glass partitions, white planters and the glass kiosk, standing cover within reach of every open spot, the lift's stair foot clear",
    !!DK && laidOn.length >= 20 && offKit.length === 0 && byFoot.length === 0 && farthest <= FAR,
    `${laidOn.length} pieces on the decks, ${offKit.length} off the kit${offKit.length ? ` (${[...new Set(offKit.map((q) => String(q[0]).split("/").pop()))].join(", ")})` : ""}; ${byFoot.length} by the stair's foot; standing cover at the farthest ${far.join(", ") || "not measured"}`,
  );
}


// the districts' positions (rules.dress.districtCover.posts, Milestone 1055; the districts' ninth reviews: "a second height
// level in the dead ground ... hard cover 2 to 3 m tall plus an upper level every 15 to 20 m"): THE WORKS' yard in three or
// four of rust and olive containers, two of them two high; THE STACKS' court split by a capsule kiosk two storeys high and a
// low wall; THE STRIP's boulevard a stage with a riser. Each laid whole, on no street node and across no link of the bots'
// grid, and climbed onto by a player; and no crate of THE WORKS' cover in the white glow ("small clean white sci-fi crates")
{
  type Post = { id: string; d: string; at: number[]; parts: unknown[][]; climb: number[][] };
  type Laid = { id: string; d: string; box: number[]; top: number; parts: number };
  const DCo = cfg.rules.dress.districtCover as unknown as { posts?: Post[]; crate: string };
  const PO = DCo.posts ?? [];
  const LP = (cfg as unknown as { posts?: Laid[] }).posts ?? [];
  const DVp = (cfg as unknown as { districtCover?: Array<{ piece: string; d: string; post?: string }> }).districtCover ?? [];
  // (each laid whole: every part of it that collides recorded under it)
  const whole = PO.filter((p) => LP.some((l) => l.id === p.id && l.parts === p.parts.filter((q) => q[6] !== "g").length && DVp.filter((q) => q.post === p.id).length === l.parts));
  const halls = (cfg.rules.districts as unknown as { works: { halls: Array<{ box: number[] }> } }).works.halls.map((h) => h.box);
  const inHall = (b: number[]) => halls.some(([x0, x1, z0, z1]) => b[0] < x1 && b[1] > x0 && b[2] < z1 && b[3] > z0);
  const yard = LP.filter((l) => l.d === "works" && !inHall(l.box));
  const court = LP.filter((l) => l.d === "stacks" && l.box[0] > -140 && l.box[1] < -101 && l.box[2] > -140 && l.box[3] < -101);
  const lowWall = DVp.filter((q) => court.some((l) => l.id === q.post) && q.piece === "Wall_Simple_2Sides_5x3.prefab").length;
  const stage = LP.filter((l) => l.d === "strip" && l.box[0] > 101 && l.box[1] < 136 && l.box[2] > -8 && l.box[3] < 8);
  // (the bots' grid round each: no street node in its footprint grown by a body's half width, and no line of the grid between two
  // street nodes nearer its footprint than half a metre, the most its baked columns stand past its pieces, and a body's half
  // width. Read off its own footprint, not the game's links: round THE STACKS' court some were cut in version 131 already)
  const GN = map.nodes as unknown as Array<{ x: number; z: number; y?: number; links: number[] }>;
  const street = GN.map((n, i) => ({ i, x: n.x - BR_X, z: n.z - BR_Z, n })).filter((q) => Math.abs(q.n.y ?? 0) < MOVE.stepHeight);
  const atNode = new Map(street.map((q) => [`${Math.round(q.x)},${Math.round(q.z)}`, q]));
  const gap = (b: number[], x0: number, x1: number, z0: number, z1: number) => Math.hypot(Math.max(0, b[0] - Math.max(x0, x1), Math.min(x0, x1) - b[1]), Math.max(0, b[2] - Math.max(z0, z1), Math.min(z0, z1) - b[3]));
  const onNode: string[] = [];
  const cut: string[] = [];
  for (const l of LP)
    for (const q of street) {
      if (q.x > l.box[0] - MOVE.radius && q.x < l.box[1] + MOVE.radius && q.z > l.box[2] - MOVE.radius && q.z < l.box[3] + MOVE.radius) onNode.push(`${l.id} on (${q.x}, ${q.z})`);
      for (const [dx, dz] of [[10, 0], [0, 10]]) {
        const r = atNode.get(`${Math.round(q.x + dx)},${Math.round(q.z + dz)}`);
        if (r && gap(l.box, q.x, r.x, q.z, r.z) < 0.5 + MOVE.radius + 0.05) cut.push(`${l.id} by (${q.x}, ${q.z})-(${r.x}, ${r.z})`);
      }
    }
  // (each climbed by a player from the ground onto its upper level, a jump at each leg more than a step higher: a mantle
  // onto a container's 2.19 m top and from it onto the 4.38 m one, onto the kiosk's deck and its upper pod, the stage and its riser)
  const legs = (pts: number[][]): { k: number; y: number } => {
    const p = new Player({ minX: BR_X - 400, maxX: BR_X + 400, minZ: BR_Z - 400, maxZ: BR_Z + 400 });
    p.sprintMode = "auto";
    p.teleport(pts[0][0] + BR_X, pts[0][1] + 0.05, pts[0][2] + BR_Z, 0);
    let t = 3000, k = 1, jumped = -1, endY = NaN;
    for (let i = 0; i < 30 * 144 && k < pts.length; i++) {
      const [tx, ty, tz] = pts[k];
      const dx = tx - (p.pos.x - BR_X), dz = tz - (p.pos.z - BR_Z);
      if (Math.hypot(dx, dz) < 0.35 && Math.abs(p.pos.y - ty) < 1) {
        if (++k === pts.length) {
          for (let n = 0; n < 144 && !p.onGround; n++) p.update(1 / 144, (t += 1 / 144), idle, 0, 1, false);
          endY = p.pos.y;
        }
        continue;
      }
      const jump = jumped !== k && ty > p.pos.y + 0.4 && Math.hypot(dx, dz) < 1.6;
      if (jump) jumped = k;
      p.yaw = (Math.atan2(-dx, -dz) * 180) / Math.PI;
      p.update(1 / 144, (t += 1 / 144), { held: (a: Action) => a === "forward", pressedNow: (a: Action) => jump && a === "jump" }, 0, 1, false);
    }
    return { k, y: endY };
  };
  const climbs = PO.map((p) => ({ id: p.id, top: p.climb[p.climb.length - 1][1], r: legs(p.climb), n: p.climb.length }));
  const fell = climbs.filter((c) => c.r.k < c.n || !(Math.abs(c.r.y - c.top) < 0.15));
  // (THE WORKS' crates: none in its cover worn as rules.wear wears the crate elsewhere, white at 0.7, or in nothing at all)
  const glow = (cfg.rules.wear as unknown as Record<string, string>)[DCo.crate];
  const worksCrates = ((cfg as unknown as { chunks: Record<string, { place: unknown[][] }> }).chunks["c-dcover"]?.place ?? []).filter((q) => String(q[0]).endsWith(`/${DCo.crate}`) && Number(q[1]) > 50 && Number(q[3]) > 50);
  const white = worksCrates.filter((q) => !q[6] || q[6] === glow).length;
  check(
    "the districts' positions: THE WORKS' yard in three or four of rust and olive containers, two of them two high; THE STACKS' court split by a capsule kiosk two storeys high and a low wall; THE STRIP's boulevard a stage with a riser; each whole, on no street node, across no grid link, climbed onto by a player; no white crate in THE WORKS",
    PO.length >= 6 && whole.length === PO.length && yard.length >= 3 && yard.length <= 4 && yard.filter((l) => l.top > 4).length >= 2 && court.filter((l) => l.top > 4.5).length === 1 && lowWall >= 1 && stage.length === 1 && stage[0].top > 2.2 && onNode.length === 0 && cut.length === 0 && fell.length === 0 && white === 0,
    `${PO.length} positions, ${whole.length} whole; THE WORKS' yard ${yard.length} (${yard.map((l) => `${l.id} ${l.top} m`).join(", ")}), THE STACKS' court ${court.map((l) => `${l.top} m, ${lowWall} low panels`).join("") || "none"}, THE STRIP's boulevard ${stage.map((l) => `${l.top} m`).join("") || "none"}; ${onNode.length} on a node, ${cut.length} grid lines within a body${cut.length ? ` (${cut.slice(0, 3).join("; ")})` : ""}; climbed ${climbs.length - fell.length} of ${climbs.length}${fell.length ? ` (${fell.map((c) => `${c.id} ${c.r.k - 1} of ${c.n - 1} legs, at ${c.r.y.toFixed(2)} m`).join("; ")})` : ""}; ${white} of ${worksCrates.length} crates in THE WORKS white`,
  );
}

// the climbs' frames whole (Milestone 1058; the centre's sixteenth reviews: "the fire escape's lit frame two loose pink
// sticks", "two thin pink posts with no lintel", "the lit frames with a lintel and a foot plate, attached to their stair",
// 16 and 27): each frame's lintel under whatever stands over its line and through nothing, so it is seen from the street (at
// 3 m it lay on the High City fire escapes' first landing, 2.85 m up, and in the Sky Ring's and the base's decks, 2.7 m),
// and a lit plate across each one's foot on its floor
{
  const { outlineBoxes } = await import("../../src/game/outlines");
  const CLf = (cfg.game as unknown as { outlines: Array<{ name: string; frames?: number[][]; foot?: number[] }> }).outlines.find((q) => q.name === "the climbs");
  const own = outlineBoxes((n) => n === "the climbs");
  const per = CLf?.foot ? 4 : 3;
  const S5 = (SOLIDS as { solids: number[][] }).solids;
  const hidden: string[] = [];
  let plates = 0;
  (CLf?.frames ?? []).forEach(([x, z, , y], i) => {
    const [, , L, F] = own.slice(i * per, (i + 1) * per);
    const onIt = (b: number[]) => b[0] < L[1] && b[1] > L[0] && b[2] < L[3] && b[3] > L[2];
    // (anything over its footprint from a standing body's height up and lower than its top: it is in that or on it; anything
    // through it)
    const over = S5.filter((b) => onIt(b) && ((b[4] >= y + MOVE.standHeight && b[4] < L[5] - 1e-3) || (b[4] < L[5] && b[5] > L[4])));
    if (over.length) hidden.push(`(${x}, ${z}) its top ${L[5].toFixed(2)} m, ${Math.min(...over.map((b) => b[4])).toFixed(2)} m over it`);
    if (F && Math.abs(F[4] - y) < 1e-6 && F[5] - y <= 0.1 && F[1] - F[0] > 1 !== F[3] - F[2] > 1) plates++;
  });
  check(
    "the climbs' frames whole: each lintel under what stands over its stair's foot and through nothing, seen from the street, and a lit plate across each foot",
    !!CLf && (CLf.frames ?? []).length === 10 && own.length === per * 10 && hidden.length === 0 && plates === 10,
    `${CLf?.frames?.length ?? 0} frames, ${plates} foot plates; ${hidden.length} lintels hidden${hidden.length ? ` (${hidden.slice(0, 4).join("; ")})` : ""}`,
  );
}

// the ground matt where it was a mirror, the ring road kerbed and lined, every road's dashes painted (Milestone 1058; the
// districts' tenth reviews: the ring road's and the entrances' ground "smeared, noisy, low-res", "a bright specular smear in
// every approach shot", "tiled road with kerbs, lane paint", "asphalt with lane marks", d01, d13b, d22; GLASS HEIGHTS' "bright
// zig-zag glitter streak along the hex paving's seams", d13, d13b, d15; the centre's "red and green blotches", 18)
{
  // (a ground's smoothness at its most, off the pack's own material: _GlossMapScale where its smoothness is read from a map,
  // its gloss map's or its colour map's alpha, else _Glossiness; times the spec's `%k`. The road's colour map, the pack's cloud
  // noise, has no alpha, so Asphalt00's 0.852 was every road's: roughness 0.15, a mirror of the sun and of the city's one
  // reflection picture)
  const X = join(process.env.PAID_DIR ?? "C:/Users/jwilb/Downloads/speedkills-paid", "neon", "extract");
  const matFile = new Map<string, string>();
  if (existsSync(X))
    for (const pk of readdirSync(X))
      for (const g of readdirSync(join(X, pk))) {
        const p = join(X, pk, g, "pathname");
        if (!existsSync(p)) continue;
        const path = readFileSync(p, "utf8").split("\n")[0];
        if (path.endsWith(".mat")) matFile.set(path.split("/").pop()!.slice(0, -4), join(X, pk, g, "asset"));
      }
  const smooth = (spec: string): number => {
    const [name, rest] = spec.split("*#");
    const k = rest?.includes("%") ? Number(rest.split("%")[1]) : 1;
    const f = matFile.get(name);
    if (!f) return NaN;
    const s = readFileSync(f, "utf8");
    const num = (key: string, d: number) => Number(s.match(new RegExp(`- ${key}: ([0-9.]+)`))?.[1] ?? d);
    const map = /- _MetallicGlossMap:\s*\n\s*m_Texture: \{fileID: [1-9]/.test(s) || num("_SmoothnessTextureChannel", 0) === 1;
    return (map ? num("_GlossMapScale", 1) : num("_Glossiness", 0.5)) * k;
  };
  const GR = cfg.rules.ground as unknown as { road: string; roadTile: string; districts: { sides: Record<string, string> } };
  const road = smooth(GR.road);
  const tile = smooth(GR.roadTile.split("=").pop()!.split("@")[0]);
  const hex = smooth(GR.districts.sides.n);
  // (and its tone, its colour map's mean times the material's colour and the spec's tint, as the districts' ground is read:
  // matt, a road shows its colour, the pack's cloud noise at 0.765 of white times its asphalt detail, 0.34 in all, lighter
  // than the pavers beside it. Asphalt is darker than the pavers, PavementDirtTiles00b at 0.26, and no darker than the
  // darkest ground that read by day, rules.ground.districts.least)
  const texFile = new Map<string, string>();
  if (existsSync(X)) for (const pk of readdirSync(X)) for (const g of readdirSync(join(X, pk))) texFile.set(g, join(X, pk, g, "asset"));
  const tone = async (spec: string): Promise<number> => {
    const [name, rest] = spec.split("*#");
    const f = matFile.get(name);
    if (!f) return NaN;
    const s = readFileSync(f, "utf8");
    const m = s.match(/- _(?:MainTex|BaseMap|BaseColorMap):\s*\n\s*m_Texture: \{fileID: \d+, guid: ([0-9a-f]+)/);
    if (!m || !texFile.has(m[1])) return NaN;
    const col = s.match(/- _(?:Color|BaseColor): \{r: ([0-9.]+), g: ([0-9.]+), b: ([0-9.]+)/);
    const n = rest ? parseInt(rest.slice(0, 6), 16) : 0xffffff;
    const c = (col ? col.slice(1, 4).map(Number) : [1, 1, 1]).map((v, i) => v * (((n >> (16 - 8 * i)) & 255) / 255));
    const { default: sharp } = await import("sharp");
    const mean = async (file: string) => {
      const { data, info } = await sharp(file).resize(64, 64).removeAlpha().raw().toBuffer({ resolveWithObject: true });
      return [0, 1, 2].map((i) => { let t = 0; for (let k = i; k < data.length; k += info.channels) t += data[k]; return t / (data.length / info.channels) / 255; });
    };
    // (a detail colour map multiplies in at twice in gamma, as src/game/detailmaps.ts draws it: the asphalt's real surface is
    // its detail, at 0.225, the noise its main map)
    const dm = s.match(/- _DetailAlbedoMap:\s*\n\s*m_Texture: \{fileID: \d+, guid: ([0-9a-f]+)/);
    const detail = dm && texFile.has(dm[1]) ? (await mean(texFile.get(dm[1])!)).map((v) => v * 2) : [1, 1, 1];
    const avg = (await mean(texFile.get(m[1])!)).map((v, i) => v * c[i] * detail[i]);
    return 0.2126 * avg[0] + 0.7152 * avg[1] + 0.0722 * avg[2];
  };
  const leastG = (GR.districts as unknown as { least?: number }).least ?? 0.25;
  // (and its grain: the asphalt is the detail map at its material's own tiling over the road's repeat, `roadEvery`; at 2.5 m
  // it came round every 0.25 m and its light and dark patches tiled into ripples, pale sand in the low sun; at 5 m, every
  // 0.5 m, none)
  const asphaltMat = matFile.get(GR.road.split("*#")[0]);
  const detailScale = asphaltMat ? Number(readFileSync(asphaltMat, "utf8").match(/- _DetailAlbedoMap:\s*\n\s*m_Texture: [^\n]*\n\s*m_Scale: \{x: ([0-9.]+)/)?.[1] ?? 1) : NaN;
  const grain = ((GR as unknown as { roadEvery?: number }).roadEvery ?? 10) / detailScale;
  const [roadTone, tileTone, paveTone] = [await tone(GR.road), await tone(GR.roadTile.split("=").pop()!.split("@")[0]), await tone("PavementDirtTiles00b")];
  // (the ring road: its dashes' middles on its middle line, its kerbs' faces on its edges, off the catalogue's sizes as the
  // layout lays them; none in something solid)
  const PAIDc = process.env.PAID_DIR ?? "C:/Users/jwilb/Downloads/speedkills-paid";
  const catc = existsSync(join(PAIDc, "neon", "catalogue.json")) ? (JSON.parse(readFileSync(join(PAIDc, "neon", "catalogue.json"), "utf8")) as Array<{ path: string; min: number[] | null; max: number[] | null }>) : [];
  const ST = cfg.rules.streets as unknown as { line: { piece: string; mat?: string }; kerb: { piece: string }; ring?: { kerbs?: boolean; line?: boolean } };
  const [r0, r1] = cfg.rules.ring as unknown as number[];
  const midOf = (q: unknown[], piece: string): number[] => {
    const r = catc.find((c) => c.path.endsWith(`/${piece}`));
    const [mx, mz] = r?.min && r.max ? [(r.min[0] + r.max[0]) / 2, (r.min[2] + r.max[2]) / 2] : [0, 0];
    const a = (Number(q[4]) * Math.PI) / 180;
    return [Number(q[1]) + Math.cos(a) * mx + Math.sin(a) * mz, Number(q[3]) - Math.sin(a) * mx + Math.cos(a) * mz];
  };
  const groundRows = Object.entries((cfg as unknown as { chunks: Record<string, { place: unknown[][] }> }).chunks).filter(([k]) => k === "c-ground" || k.startsWith("ground-")).flatMap(([, ch]) => ch.place);
  const dashes = groundRows.filter((q) => String(q[0]).endsWith(`/${ST.line.piece}`));
  const ringDash = dashes.map((q) => midOf(q, ST.line.piece)).filter(([x, z]) => {
    const [a, b] = Math.abs(Math.abs(x) - (r0 + r1) / 2) < 0.5 ? [x, z] : [z, x];
    return Math.abs(Math.abs(a) - (r0 + r1) / 2) < 0.5 && Math.abs(b) < r0;
  }).length;
  const unpainted = dashes.filter((q) => !ST.line.mat || q[6] !== ST.line.mat).length;
  const kerbMids = groundRows.filter((q) => String(q[0]).endsWith(`/${ST.kerb.piece}`)).map((q) => midOf(q, ST.kerb.piece));
  const onEdge = (v: number) => [r0, r1].some((e) => Math.abs(Math.abs(v) - e) < 0.2);
  const ringKerbs = kerbMids.filter(([x, z]) => (onEdge(x) && Math.abs(z) <= r1) || (onEdge(z) && Math.abs(x) <= r1));
  // (in what stands, as the layout reads it, lastSolids: not the boxes of what is laid last, the street cover among them, laid
  // after the kerbs and on the kerb's line where it stands, a planter on a kerb, as 13 of the centre's 633 kerbs are)
  const S6 = SOLIDS as { solids: number[][]; laid?: number[][] };
  const later = new Uint8Array(S6.solids.length);
  for (const [a, b] of S6.laid ?? []) later.fill(1, a, b);
  const inSolid = ringKerbs.filter(([x, z]) => S6.solids.some((b, i) => !later[i] && b[0] <= x && b[1] >= x && b[2] <= z && b[3] >= z && b[4] < 0.2 && b[5] > 0.3)).length;
  check(
    "the roads matt, asphalt in tone and the ring road kerbed and lined: the asphalt's smoothness 0.3 at most (dry asphalt), its tone darker than the pavers and no darker than the least ground, its asphalt coming round every 0.4 m or more, GLASS HEIGHTS' hex 0.5 at most, a dashed line down the ring road and its kerbs along both edges, every road's dash painted",
    road <= 0.3 && tile <= 0.3 && hex <= 0.5 && ringDash >= 40 && ringKerbs.length >= 500 && inSolid === 0 && unpainted === 0 &&
      [roadTone, tileTone].every((t) => t >= leastG && t < paveTone) && grain >= 0.4,
    `road ${road.toFixed(3)}, its tiles ${tile.toFixed(3)}, GLASS HEIGHTS' hex ${hex.toFixed(3)}; tone road ${roadTone.toFixed(3)}, tiles ${tileTone.toFixed(3)}, pavers ${paveTone.toFixed(3)}, least ${leastG}; the asphalt round every ${grain.toFixed(2)} m; the ring road ${ringDash} dashes, ${ringKerbs.length} kerbs (${inSolid} in something standing); ${unpainted} of ${dashes.length} dashes unpainted`,
  );
  // (Milestone 1069: each main map the game pulls to its mean, game.flatten, its mean measured again off the map itself, its
  // linear values', so the pull leaves the material's tone where the roads' tone above reads it; and some of its contrast
  // kept, as the noise is there to break the detail's repeat)
  const FL = (cfg.game as unknown as { flatten?: Record<string, { keep: number; mean: number }> }).flatten ?? {};
  const flatSaid: string[] = [];
  let flatOk = Object.keys(FL).length > 0;
  for (const [name, f] of Object.entries(FL)) {
    const mf = matFile.get(name);
    const ms = mf ? readFileSync(mf, "utf8") : "";
    const mm = ms.match(/- _(?:MainTex|BaseMap|BaseColorMap):\s*\n\s*m_Texture: \{fileID: \d+, guid: ([0-9a-f]+)/);
    let lin = NaN;
    if (mm && texFile.has(mm[1])) {
      const { default: sharp } = await import("sharp");
      const { data, info } = await sharp(texFile.get(mm[1])!).resize(256, 256).removeAlpha().raw().toBuffer({ resolveWithObject: true });
      let t = 0;
      for (let k = 0; k < data.length; k += info.channels) {
        const v = data[k] / 255;
        t += v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
      }
      lin = t / (data.length / info.channels);
    }
    flatOk &&= Math.abs(lin - f.mean) <= 0.01 && f.keep >= 0.2 && f.keep <= 0.6;
    flatSaid.push(`${name} mean ${f.mean} against its map's ${lin.toFixed(3)}, keep ${f.keep}`);
  }
  check("the asphalt's cloud noise pulled to its own mean: each flattened main map's mean its map's own, measured, a fifth to three fifths of its contrast kept", flatOk, flatSaid.join("; ") || "none");
}

// no parked car across a walk-in's door (Milestone 1058; the centre's sixteenth review: "the camera in parked cars' bonnets",
// 22 looking at MOTEL HILL's walk-in's door across a car parked 4.3 m out of it): no parked car's body over a walk-in's door's
// line, from the door out to its street's middle, half its lit frame and a body's radius either side
{
  const WI5 = (cfg as unknown as { walkIns: Array<{ door: number[]; out: number[] }> }).walkIns;
  const CA = cfg.rules.dress as unknown as { cars: { pieces: string[]; vans?: { pieces: string[] }; doors?: { out: number; half: number } } };
  const PAIDd = process.env.PAID_DIR ?? "C:/Users/jwilb/Downloads/speedkills-paid";
  const catd = existsSync(join(PAIDd, "neon", "catalogue.json")) ? (JSON.parse(readFileSync(join(PAIDd, "neon", "catalogue.json"), "utf8")) as Array<{ path: string; size: number[] | null; min: number[] | null; max: number[] | null }>) : [];
  const kinds = [...CA.cars.pieces, ...(CA.cars.vans?.pieces ?? [])];
  const DO = CA.cars.doors ?? { out: 7.5, half: 1.71 };
  const blocking: string[] = [];
  for (const q of (cfg as unknown as { chunks: Record<string, { place: unknown[][] }> }).chunks["c-dress"]?.place ?? []) {
    const kind = kinds.find((k) => String(q[0]).endsWith(`/${k}`));
    if (!kind || q[5] !== "o") continue;
    const r = catd.find((c) => c.path.endsWith(`/${kind}`));
    if (!r?.min || !r.max || !r.size) continue;
    // (its middle, as the layout lays it: placeTurned's pivot is the footprint's middle less its own offset, turned)
    const [mx, mz] = [(r.min[0] + r.max[0]) / 2, (r.min[2] + r.max[2]) / 2];
    const a = (Number(q[4]) * Math.PI) / 180;
    const [x, z] = [Number(q[1]) + Math.cos(a) * mx + Math.sin(a) * mz, Number(q[3]) - Math.sin(a) * mx + Math.cos(a) * mz];
    for (const w of WI5) {
      const [rx, rz] = [x - w.door[0], z - w.door[1]];
      const along = rx * w.out[0] + rz * w.out[1];
      if (along > 0 && along < DO.out && Math.abs(rx * w.out[1] - rz * w.out[0]) < DO.half + r.size[2] / 2) blocking.push(`${kind.replace(".prefab", "")} at (${x.toFixed(1)}, ${z.toFixed(1)}), ${along.toFixed(1)} m out of (${w.door.join(", ")})`);
    }
  }
  check(
    "no parked car across a walk-in's door: none whose body crosses a door's line out to its street's middle",
    !!CA.cars.doors && WI5.length === 4 && blocking.length === 0,
    `${WI5.length} doors; ${blocking.length} cars across one${blocking.length ? ` (${blocking.join("; ")})` : ""}${CA.cars.doors ? "" : "; no rules.dress.cars.doors"}`,
  );
}

// THE STACKS' ground, GLASS HEIGHTS' deck and lift, THE WORKS' hall and yard (Milestone 1059; the districts' tenth reviews of
// version 132, 2026-11-02: THE STACKS 5.5 and 6, "a wide flat car park of identical hover cars and louvred boxes", "half the
// hovercars, a raised pod deck with stairs and two cover clusters", "the kiosk an unreadable beige cluster", "pink light at
// the tower bases by day"; GLASS HEIGHTS "the frosted panels like untextured boards", "the lift's stacked cyan plates like a
// rendering fault", "one clear tube with a visible cab"; THE WORKS "cyan rings on the floor that nothing explains", "rows of
// machines and crates forming indoor lanes, steel trusses under the roof", the yard's "grey and white boards")
{
  type Post4 = { id: string; d: string; at: number[]; parts: unknown[][]; flights?: number[][] };
  type Laid4 = { id: string; d: string; box: number[]; top: number; parts: number; lanes?: number[][][] };
  const { outlineBoxes } = await import("../../src/game/outlines");
  const DC4 = cfg.rules.dress.districtCover as unknown as { posts?: Post4[]; mats: Record<string, Record<string, string>> };
  const PO4 = DC4.posts ?? [];
  const LP4 = (cfg as unknown as { posts?: Laid4[] }).posts ?? [];
  const CH4 = (cfg as unknown as { chunks: Record<string, { place: unknown[][] }> }).chunks;
  const S4 = (SOLIDS as { solids: number[][] }).solids;
  const G4 = cfg.game as unknown as { boards: Array<{ text: string; at: number[]; yaw: number }>; outlines: Array<{ name: string; colour: string }>; padRings: { column: { trim?: number[][] } } };
  const remap4 = (s: unknown) => new Map(String(s ?? "").split(";").filter((p) => p.includes("=")).map((p) => p.split("=") as [string, string]));
  // (a player's walk from point to point of a lane, [x, z, y] each as the layout writes them, on foot, no jump: the legs it
  // got through and its height at the end)
  const walk4 = (pts: number[][]): { k: number; y: number } => {
    const p = new Player({ minX: BR_X - 400, maxX: BR_X + 400, minZ: BR_Z - 400, maxZ: BR_Z + 400 });
    p.teleport(pts[0][0] + BR_X, pts[0][2] + 0.05, pts[0][1] + BR_Z, 0);
    let t = 7000, k = 1;
    for (let i = 0; i < 20 * 144 && k < pts.length; i++) {
      const [tx, tz, ty] = pts[k];
      const dx = tx - (p.pos.x - BR_X), dz = tz - (p.pos.z - BR_Z);
      if (Math.hypot(dx, dz) < 0.3 && Math.abs(p.pos.y - ty) < 0.5) {
        k++;
        continue;
      }
      p.yaw = (Math.atan2(-dx, -dz) * 180) / Math.PI;
      p.update(1 / 144, (t += 1 / 144), { held: (a: Action) => a === "forward", pressedNow: () => false }, 0, 1, false);
    }
    for (let n = 0; n < 144 && !p.onGround; n++) p.update(1 / 144, (t += 1 / 144), idle, 0, 1, false);
    return { k, y: p.pos.y };
  };
  // (a lit strip within half a metre of something solid: none hangs in the air)
  const held4 = (b: number[]) => S4.some((q) => q[0] < b[1] + 0.5 && q[1] > b[0] - 0.5 && q[2] < b[3] + 0.5 && q[3] > b[2] - 0.5 && q[4] < b[5] + 0.5 && q[5] > b[4] - 0.5);

  // THE STACKS: its car park's cars at most half the 24, a deck in its front row walked up its flight on foot in every lane, two
  // islands beside it, the kiosk's pods lit and a sign on it, pink bands on its towers' feet against their walls
  const cars4 = (CH4["c-stacks"]?.place ?? []).filter((q) => /\/UrbanCar00[cd]\.prefab$/.test(String(q[0])) && Number(q[1]) > -105 && Number(q[1]) < -45 && Number(q[3]) > -125 && Number(q[3]) < -105).length;
  const front4 = LP4.filter((l) => l.d === "stacks" && l.box[0] > -106 && l.box[1] < -44 && l.box[2] > -115 && l.box[3] < -101);
  const deck4 = front4.filter((l) => l.top > 2.4 && (l.lanes ?? []).length > 0);
  const isles4 = front4.filter((l) => !(l.lanes ?? []).length && l.parts >= 3);
  const lanes4 = deck4.flatMap((l) => l.lanes ?? []);
  const fell4 = lanes4.map((r) => ({ r, w: walk4(r) })).filter(({ r, w }) => w.k < r.length || Math.abs(w.y - r[r.length - 1][2]) > 0.15);
  const kiosk4 = PO4.find((p) => p.id === "stacks-kiosk");
  const pods4 = (kiosk4?.parts ?? []).filter((p) => String(p[0]).startsWith("RoomSemiCapsule"));
  // (lit by a glow, or since Milestone 1071 by the pack's lit ads: the flat pink glow read as a blank face)
  const lit4 = pods4.length > 0 && pods4.every((p) => /~#|\^#|^Ads\d/.test(remap4(p[7]).get("Cristal04") ?? "") && /\^#ff4fd8/i.test(remap4(p[7]).get("MetalBare01_lgt 1") ?? ""));
  const kl4 = LP4.find((l) => l.id === "stacks-kiosk");
  const sign4 = !!kl4 && G4.boards.some((b) => b.text.trim().length > 0 && b.at[0] > kl4.box[0] - 1 && b.at[0] < kl4.box[1] + 1 && b.at[2] > kl4.box[2] - 1 && b.at[2] < kl4.box[3] + 1 && b.at[1] > 0.5 && b.at[1] < 3);
  const baseNames = G4.outlines.filter((o) => o.name.startsWith("the stacks tower base"));
  const baseBoxes = outlineBoxes((n: string) => n.startsWith("the stacks tower base"));
  const loose4 = baseBoxes.filter((b) => !held4(b)).length;
  check(
    "THE STACKS' ground: the car park at most half its cars, a pod deck in its front row walked up its flight on foot, two islands beside it, the kiosk's pods lit and signed, pink bands on its towers' feet",
    cars4 <= 12 && deck4.length === 1 && lanes4.length >= 3 && fell4.length === 0 && isles4.length >= 2 && lit4 && sign4 && baseNames.length >= 3 && baseNames.every((o) => o.colour.toLowerCase() === "#ff4fd8") && baseBoxes.length > 0 && loose4 === 0,
    `${cars4} cars in the car park; ${deck4.length} deck${deck4.length ? ` (${deck4.map((l) => `${l.id} ${l.top} m`).join("")})` : ""}, ${lanes4.length - fell4.length} of ${lanes4.length} lanes up its flight${fell4.length ? ` (${fell4.map(({ r, w }) => `${w.k - 1} of ${r.length - 1} legs, at ${w.y.toFixed(2)} m`).join("; ")})` : ""}; ${isles4.length} islands; the kiosk's pods ${lit4 ? "lit" : "not lit"}, ${sign4 ? "signed" : "no sign"}; ${baseNames.length} tower bands, ${baseBoxes.length} strips, ${loose4} in the air`,
  );

  // GLASS HEIGHTS: its deck's glass walls framed in a lit edge on a patterned pane, every one on its decks so worn; its lift's
  // shaft one clear glass, no part of its panes lit, a lit line up each of its four corners from the street, its car's
  // glass a lit frosted cab unlike the shaft's
  const GH4 = (cfg.rules.districts as unknown as { glass: { deck: { kit: Record<string, string> }; lift: { car: number[]; carMat: string; shaft: { mat: string; half: number; under: number } } } }).glass;
  const wallKeys = ["WindowWall00 Variant.prefab", "WindowWall01 Variant.prefab"];
  // (since Milestone 1067 the frame in the look's white, its bevels lit by the sun, and the inner strip lit: at a glow of 1.2 the
  // frame drew flat, "floating blank cards" in the districts' eleventh reviews)
  const white4 = (cfg.rules.districts as unknown as { glass: { look: { white: string } } }).glass.look.white;
  const framed4 = wallKeys.every((k) => {
    const m = remap4(GH4.deck.kit[k]);
    return m.get("BareSteelScratched00") === white4 && /\^#/.test(m.get("MetalBare01_lgt 2") ?? "") && /Pattern/.test(m.get("Cristal04") ?? "");
  });
  const deckWalls = (CH4["c-dress"]?.place ?? []).filter((q) => /\/WindowWall0[01] Variant\.prefab$/.test(String(q[0])) && Number(q[2]) > 24 && Number(q[2]) < 28 && Math.abs(Number(q[1])) < 32 && Number(q[3]) > -154 && Number(q[3]) < -104);
  const wallsOff = deckWalls.filter((q) => q[6] !== GH4.deck.kit[String(q[0]).split("/").pop()!]).length;
  const shaft4 = remap4(GH4.lift.shaft.mat);
  // (since Milestone 1099 its pane's frame and inner strip in its own clear glass: Milestone 1067's white band where two tiers
  // met read as "floating shelves" and "broken stairs" to the districts' fifteenth reviews; never the Light06 whose map drew
  // stacked plates)
  const oneGlass = ["Cristal04", "BareSteelScratched00", "MetalBare01_lgt 2"].every((k) => shaft4.has(k)) && /^Cristal/.test(shaft4.get("Cristal04")!) && !/~#|\|#/.test(shaft4.get("Cristal04")!) && shaft4.get("BareSteelScratched00") === shaft4.get("Cristal04") && shaft4.get("MetalBare01_lgt 2") === shaft4.get("Cristal04") && ![...shaft4.values()].some((v) => v.startsWith("Light06"));
  const cab4 = remap4(GH4.lift.carMat).get("Cristal04") ?? "";
  const cabLit = /~#/.test(cab4) && cab4 !== shaft4.get("Cristal04");
  const [lx4, lz4] = GH4.lift.car;
  const hf4 = GH4.lift.shaft.half;
  const cornerBoxes = outlineBoxes((n: string) => n.startsWith("the glass lift corners"));
  const corners4 = [[lx4 - hf4, lz4 - hf4], [lx4 + hf4, lz4 - hf4], [lx4 - hf4, lz4 + hf4], [lx4 + hf4, lz4 + hf4]].filter(([x, z]) => cornerBoxes.some((b) => x > b[0] - 0.1 && x < b[1] + 0.1 && z > b[2] - 0.1 && z < b[3] + 0.1 && b[4] < 0.5 && b[5] > GH4.lift.shaft.under - 0.1)).length;
  check(
    "GLASS HEIGHTS' deck and lift: the deck's glass walls in a white frame on a patterned pane, its lift's shaft one clear tube, no band at its tiers, lit up its corners, its car a lit cab",
    framed4 && deckWalls.length >= 10 && wallsOff === 0 && oneGlass && cabLit && corners4 === 4,
    `walls ${framed4 ? "framed and patterned" : "plain"}, ${deckWalls.length} on the decks, ${wallsOff} off; the shaft ${oneGlass ? "one clear glass" : `${[...shaft4.values()].join(", ")}`}, the car's glass ${cab4 || "none"}, ${corners4} of 4 corners lit`,
  );

  // THE WORKS: a lit board over each of the works block's atrium pads, facing its ring; steel trusses across its ring's
  // underside, up to its slab; rows down its aisles; its yard's low panels in the halls' own glowing rust
  const WK4 = (cfg.rules.districts as unknown as { works: { wallMat: string; plates?: string; storey: number; slab: number; upper: { atrium: number[] } } }).works;
  const rings4 = (G4.padRings.column.trim ?? []).map(([x, z]) => [x, z]);
  const told4 = rings4.filter(([x, z]) => G4.boards.some((b) => b.text.trim().length > 0 && Math.hypot(b.at[0] - x, b.at[2] - z) < 2.5 && b.at[1] > 4 && b.at[1] < WK4.storey && Math.sin((b.yaw * Math.PI) / 180) * (x - b.at[0]) + Math.cos((b.yaw * Math.PI) / 180) * (z - b.at[2]) > 0.5));
  const [ax0, ax1, az0, az1] = WK4.upper.atrium;
  const under4 = WK4.storey - WK4.slab;
  const EX4 = (cfg.rules.dress as unknown as { extras: Array<[string, string, number, number, number, number, number?]> }).extras;
  const trusses4 = EX4.filter(([ch, n, x, z, , y, s]) => ch === "c-works" && n === "BeamStructure02.prefab" && x > 115 && x < 145 && z > 115 && z < 145 && !(x > ax0 && x < ax1 && z > az0 && z < az1) && Math.abs(y + 1.1 * (s ?? 1) - under4) < 0.02).length;
  const rows4 = LP4.filter((l) => l.d === "works" && l.box[0] >= 115 && l.box[1] <= 145 && l.box[2] >= 115 && l.box[3] <= 145 && l.parts >= 3);
  const panel4 = remap4(DC4.mats.works?.["Wall_Simple_2Sides_5x3.prefab"]);
  // (since Milestone 1086 its two faces in the plates, `plates`, its top and foot still the halls' rust)
  const rust4 = panel4.size === 4 && [...panel4.values()].every((v) => v === WK4.wallMat || v === WK4.plates) && panel4.get("Concrete01") === WK4.wallMat;
  check(
    "THE WORKS' hall and yard: a lit board over each atrium pad, trusses across the ring's underside, rows down the aisles, the yard's panels in the halls' rust",
    rings4.length === 2 && told4.length === 2 && trusses4 >= 8 && rows4.length >= 2 && rust4,
    `${told4.length} of ${rings4.length} pads told; ${trusses4} trusses under the ring; ${rows4.length} rows (${rows4.map((l) => l.id).join(", ")}); the yard's panels ${rust4 ? "in the halls' rust" : [...panel4.values()].join(", ") || "none"}`,
  );
}

// THE VAULT's door swung open, the loot in sight, the court and the base hall furnished (Milestone 1060; the centre's sixteenth
// reviews, both: "the door a speaker grille with a 0", "black not gold, on a square black plate whose corners show, white
// arcs into the ceiling, it looks shut", "a gold face swung 90 to 110 degrees open on a visible hinge, the strongroom seen
// through it, a spoke wheel", "no chests or crates show in 28 or 30, the gold bars are decoration", "caches in THE WELL, the
// court, the station", "20 empty concrete, bricked niches", "07 modules loose on a dim floor")
{
  type Part4 = [string, number, number, number, number, number, number, string, string[]?];
  const TW4 = cfg.rules.tower as unknown as { clad?: Array<{ mat: string; boxes: number[][] }>; floors: { at: Record<string, { holes?: number[][]; vault?: { mats: Record<string, string>; rows: unknown[][]; door?: { across: number; leaf?: { across: number; deep: number }; parts: Part4[] } } }> } };
  const V4 = TW4.floors.at["32"].vault;
  const D4 = V4?.door;
  const P4 = D4?.parts ?? [];
  const S4 = (SOLIDS as { solids: number[][] }).solids;
  const near4 = (a: number[], b: number[]) => a.length === b.length && a.every((v, i) => Math.abs(v - b[i]) < 0.011);
  const inBox4 = (b: number[], x: number, y: number, z: number) => x > b[0] && x < b[1] && z > b[2] && z < b[3] && y > b[4] && y < b[5];
  const through4 = (p: number[], q: number[]) => S4.some((b) => {
    let [t0, t1] = [0, 1];
    for (const [a, lo, hi] of [[0, b[0], b[1]], [1, b[4], b[5]], [2, b[2], b[3]]] as Array<[number, number, number]>) {
      const d = q[a] - p[a];
      if (Math.abs(d) < 1e-9) {
        if (p[a] < lo || p[a] > hi) return false;
        continue;
      }
      const [u, v] = [(lo - p[a]) / d, (hi - p[a]) / d];
      [t0, t1] = [Math.max(t0, Math.min(u, v)), Math.min(t1, Math.max(u, v))];
      if (t0 > t1) return false;
    }
    return true;
  });
  // 1: the doorway (RING) and the leaf (LEAF), each a round piece stood on its edge; the leaf swung open about its side, since
  // Milestone 1078 right back against the doorway's wall (the eighteenth reviews: "seat the door on its hinge against the wall";
  // the room behind the doorway leaves no floor for a leaf stood a quarter open): 150 to 180 degrees from shut (shut, its
  // wheel would face the room), beside the doorway, its middle within its depth and 0.6 m of the doorway's face, one of its
  // edges within 0.6 m of the doorway's rim and a pin (PIN) at that edge; a spoke wheel (six WHEEL parts and more) on its
  // face away from the wall, inside its round; the leaf's body and face gold, the doorway's rim gold, its back black and
  // its grille left out; no numbered plate; no black clad plate before the doorway; a wall round it from the floor to the
  // 38 m slab across the whole hole, its face at the doorway's, and nothing drawn across the opening over its threshold from
  // its face to 0.3 m behind its back (the old wall stood 1 cm behind the ring and filled it); the leaf collides; its wheel
  // and the doorway's opening seen from a standing eye 0.7 m out of the core's south door
  const ring = P4.find((q) => q[7] === "RING" && q[5] === 90);
  const leaf = P4.find((q) => q[7] === "LEAF" && q[5] === 90);
  const M4 = V4?.mats ?? {};
  const H4 = TW4.floors.at["35"].holes?.[0] ?? [0, 0, 0, 0];
  const CO4 = (cfg.tower as unknown as { core: { box: number[]; wall: number; landing: number } }).core;
  const eye4 = [CO4.box[0] + CO4.wall + CO4.landing / 2, 33.7, CO4.box[3] + 0.7];
  const DX4 = D4 as unknown as { deep?: number; inner?: number; sill?: number } | undefined;
  let doorSaid = "no doorway or no leaf", doorOk = false;
  if (ring && leaf && D4?.leaf) {
    const [rr, rl] = [(D4.across * ring[6]) / 2, (D4.leaf.across * leaf[6]) / 2];
    const rIn = ((DX4?.inner ?? D4.across) * ring[6]) / 2;
    const ax = (yaw: number) => [Math.cos((yaw * Math.PI) / 180), -Math.sin((yaw * Math.PI) / 180)];
    // (a cap tipped a quarter about its own x faces its own +y, (sin, cos) of its turn on the map: the doorway faces the
    // core, and a shut leaf's face, where its wheel is, the other way)
    const fc = (yaw: number) => [Math.sin((yaw * Math.PI) / 180), Math.cos((yaw * Math.PI) / 180)];
    const [ur, ul, nr, nl] = [ax(ring[4]), ax(leaf[4]), fc(ring[4]), fc(leaf[4])];
    const swing = (Math.acos(Math.max(-1, Math.min(1, -(nl[0] * nr[0] + nl[1] * nr[1])))) * 180) / Math.PI;
    let hinge = 9, edge = [0, 0];
    for (const s of [-1, 1])
      for (const t of [-1, 1]) {
        const [ex, ez] = [leaf[1] + s * ul[0] * rl, leaf[3] + s * ul[1] * rl];
        const d = Math.hypot(ex - (ring[1] + t * ur[0] * rr), ez - (ring[3] + t * ur[1] * rr));
        if (d < hinge) [hinge, edge] = [d, [ex, ez]];
      }
    const lid = D4.leaf.deep * leaf[6];
    const deep4 = (DX4?.deep ?? 0) * ring[6];
    const face = [ring[1] + nr[0] * deep4, ring[3] + nr[1] * deep4];
    const beside = Math.abs((leaf[1] - ring[1]) * ur[0] + (leaf[3] - ring[3]) * ur[1]) >= rr + 0.8 * rl;
    const seated = Math.abs((leaf[1] - face[0]) * nr[0] + (leaf[3] - face[1]) * nr[1]) <= lid + 0.6;
    const pin = P4.some((q) => q[7] === "PIN" && Math.hypot(q[1] - edge[0], q[3] - edge[1]) < 0.4 && q[2] < 0.2 && q[2] + 2 * q[6] > leaf[2]);
    const wheel = P4.filter((q) => q[7] === "WHEEL" && (q[1] - leaf[1]) * nl[0] + (q[3] - leaf[3]) * nl[1] > lid * 0.6 && (q[1] - leaf[1]) * nl[0] + (q[3] - leaf[3]) * nl[1] < lid + 0.6 && Math.abs((q[1] - leaf[1]) * ul[0] + (q[3] - leaf[3]) * ul[1]) < rl && Math.abs(q[2] - leaf[2]) < rl).length;
    const gold = /MetalPaintWhiteCracked00b=GoldenScratched00/.test(M4.LEAF ?? "") && /MetalPaintBlueCracked00=GoldenScratched00/.test(M4.LEAF ?? "") && /MetalBare02=GoldenScratched00/.test(M4.RING ?? "") && /MetalPlanks02b=MetalPaintBlack/.test(M4.RING ?? "") && (ring[8] ?? []).some((w) => w.startsWith("*#"));
    const plate = P4.some((q) => /LineNumber/.test(q[0]));
    const clad = (TW4.clad ?? []).flatMap((c) => c.boxes.map((b) => ({ mat: c.mat, b })));
    // (a black plate before the doorway: the old housing stood round it; the threshold's black step stands in it)
    const black = clad.filter(({ mat, b }) => /MetalPaintBlack/.test(mat) && b[0] < H4[1] && b[1] > H4[0] && b[2] < 36 && b[3] > 32 && ((b[0] + b[1]) / 2 - face[0]) * nr[0] + ((b[4] + b[5]) / 2 - face[1]) * nr[1] > 0.05).length;
    // (the wall round it: the boxes whose face is the doorway's, from the floor beside it and to the slab across the hole)
    // (anywhere within the ring's own depth, from its face to its back: the ring stands proud of its wall, Milestone 1078, so
    // its lowered rim covers the wall's stepped hole)
    const atFace = clad.filter(({ mat, b }) => !/Black/.test(mat) && (b[4] - face[1]) * -nr[1] >= -0.05 && (b[4] - ring[3]) * -nr[1] <= 0.05);
    const covers = (list: number[][], lo: number, hi: number) => {
      let at = lo;
      for (const [a, b] of list.sort((p, q) => p[0] - q[0])) if (a <= at + 0.02 && b > at) at = b;
      return at >= hi - 0.02;
    };
    const wallTop = covers(atFace.filter(({ b }) => b[3] >= 37.6).map(({ b }) => [b[0], b[1]]), H4[0], H4[1]);
    const foot = atFace.filter(({ b }) => b[2] <= 32.01).map(({ b }) => [b[0], b[1]]);
    const wallFoot = covers(foot.map((q) => [...q]), H4[0], ring[1] - rr) && covers(foot.map((q) => [...q]), ring[1] + rr, H4[1]);
    // (nothing drawn across the opening over its threshold, between its face and 0.3 m behind its back)
    const yS = 32 + (DX4?.sill ?? 0) + 0.01;
    const [mx, my] = [ring[1], 32 + ring[2]];
    const across = clad.filter(({ b }) => b[3] > yS && Math.hypot(Math.max(b[0] - mx, 0, mx - b[1]), Math.max(b[2] - my, 0, my - b[3])) < rIn - 0.02 && Math.min(b[5], Math.max(face[1], ring[3] - nr[1] * 0.3)) > Math.max(b[4], Math.min(face[1], ring[3] - nr[1] * 0.3)) - 0.05).length;
    const solid = S4.some((b) => inBox4(b, leaf[1], 33, leaf[3]));
    const lidAt = [leaf[1] + nl[0] * (lid + 0.5), 32 + leaf[2], leaf[3] + nl[1] * (lid + 0.5)];
    const opening = [[0, 0], [0, 0.5], [-0.4, 0.3], [0.4, 0.3]].map(([u, v]) => [ring[1] + ur[0] * u * rr, 32 + ring[2] + v * rr, ring[3] + ur[1] * u * rr - 0.3]);
    const hidden = [lidAt, ...opening].filter((p) => through4(eye4, p)).length;
    doorOk = 2 * rr >= 3.2 && 2 * rl >= 2.5 && swing >= 150 && beside && seated && hinge <= 0.6 && pin && wheel >= 6 && gold && !plate && black === 0 && wallTop && wallFoot && across === 0 && solid && hidden === 0;
    doorSaid = `doorway ${(2 * rr).toFixed(2)} m, leaf ${(2 * rl).toFixed(2)} m swung ${swing.toFixed(0)} degrees from shut, ${beside ? "beside" : "not beside"} the doorway and ${seated ? "on" : "off"} its wall, ${hinge.toFixed(2)} m from the rim, pin ${pin}, ${wheel} wheel parts, gold ${gold}, numbered plate ${plate}, ${black} black plates before it, wall to the slab ${wallTop}, at the floor ${wallFoot}, ${across} drawn across the opening, leaf collides ${solid}, ${hidden} of 5 sight lines blocked`;
  }
  check("THE VAULT's door swung open: a round doorway in gold on a black back, open through its wall, a gold leaf with a spoke wheel swung back against the wall on a pin, no black plate before it, no numbered dial, a wall to the slab round it", doorOk, doorSaid);
  // 2: loot in sight and the rooms furnished (rules.dress.caches): a lit chest in three sets of THE VAULT's halls (and its
  // lid lit gold), in THE WELL's bottom, on the station's concourse, in two of the court's sets and two of the base's; every
  // set's boxes in the bake's collision, each on a floor (the game's own, a box's top, or a box of its stack); none cutting a
  // way: on a grid of 0.1 m 6 m round each set, the floor a body (0.35 m each side) stands on in pieces each joined before
  // the set, and each piece still one piece after it (a set across a corridor parts it, a set closing a nook shuts it off,
  // and both are caught; a way round longer than the window is not seen); the court with two machines, a stack and six
  // lit panels under its ceiling (base5: the two lamp posts stood through its 3 m ceiling); the base's hall with a
  // counter of three bars and more, a machine, a stack and a lit panel under its ceiling with a pool of light under it
  type Cache4 = { id: string; where: string; y: number; boxes: number[][]; pieces: string[] };
  const CA4 = ((cfg as unknown as { caches?: Cache4[] }).caches ?? []) as Cache4[];
  const of4 = (w: string) => CA4.filter((s) => s.where === w);
  const chests = (w: string) => of4(w).filter((s) => s.pieces.some((p) => p.startsWith("Crate01b"))).length;
  const CM4 = ((cfg.rules.dress as unknown as { caches?: { mats: Record<string, string> } }).caches?.mats ?? {}) as Record<string, string>;
  const unbaked = CA4.flatMap((s) => s.boxes).filter((b) => !S4.some((q) => near4(q, b))).length;
  const floating = CA4.flatMap((s) => s.boxes.filter((b) => {
    const [x, z] = [(b[0] + b[1]) / 2, (b[2] + b[3]) / 2];
    return !(Math.abs(floorAt(x + BR_X, z + BR_Z) - b[4]) < 0.15 || S4.some((q) => !near4(q, b) && Math.abs(q[5] - b[4]) < 0.15 && x >= q[0] && x <= q[1] && z >= q[2] && z <= q[3]));
  })).length;
  const cut4: string[] = [];
  for (const s of CA4) {
    if (!s.boxes.length) continue;
    const [C, R0, y] = [0.1, 0.35, s.y];
    const [x0, x1, z0, z1] = [Math.min(...s.boxes.map((b) => b[0])) - 6, Math.max(...s.boxes.map((b) => b[1])) + 6, Math.min(...s.boxes.map((b) => b[2])) - 6, Math.max(...s.boxes.map((b) => b[3])) + 6];
    const near = S4.filter((b) => b[1] > x0 - 1 && b[0] < x1 + 1 && b[3] > z0 - 1 && b[2] < z1 + 1);
    const tops = near.filter((b) => Math.abs(b[5] - y) < 0.15);
    const stand = near.filter((b) => b[4] < y + 1.8 && b[5] > y + 0.3).map((b) => ({ b, own: s.boxes.some((q) => near4(q, b)) }));
    const [nx, nz] = [Math.ceil((x1 - x0) / C), Math.ceil((z1 - z0) / C)];
    const floor = new Uint8Array(nx * nz), freeA = new Uint8Array(nx * nz), freeB = new Uint8Array(nx * nz);
    for (let i = 0; i < nx; i++)
      for (let j = 0; j < nz; j++) {
        const [x, z, k] = [x0 + (i + 0.5) * C, z0 + (j + 0.5) * C, j * nx + i];
        floor[k] = Math.abs(floorAt(x + BR_X, z + BR_Z) - y) < 0.15 || tops.some((b) => x >= b[0] && x <= b[1] && z >= b[2] && z <= b[3]) ? 1 : 0;
        let [a, c] = [1, 1];
        for (const { b, own } of stand)
          if (x > b[0] - R0 && x < b[1] + R0 && z > b[2] - R0 && z < b[3] + R0) {
            c = 0;
            if (!own) a = 0;
          }
        [freeA[k], freeB[k]] = [a, c];
      }
    // (the floor's pieces, before the set and after it: each cell the piece it is joined to)
    const pieces = (free: Uint8Array) => {
      const L = new Int32Array(nx * nz).fill(-1);
      let n = 0;
      for (let k0 = 0; k0 < nx * nz; k0++) {
        if (!floor[k0] || !free[k0] || L[k0] >= 0) continue;
        const todo = [k0];
        L[k0] = n;
        while (todo.length) {
          const k = todo.pop()!;
          const [i, j] = [k % nx, Math.floor(k / nx)];
          for (const q of [i > 0 ? k - 1 : -1, i < nx - 1 ? k + 1 : -1, j > 0 ? k - nx : -1, j < nz - 1 ? k + nx : -1])
            if (q >= 0 && floor[q] && free[q] && L[q] < 0) (L[q] = n), todo.push(q);
        }
        n++;
      }
      return L;
    };
    const [A, B] = [pieces(freeA), pieces(freeB)];
    const into = new Map<number, Map<number, number>>();
    for (let k = 0; k < nx * nz; k++) {
      if (A[k] < 0 || B[k] < 0) continue;
      const m = into.get(A[k]) ?? into.set(A[k], new Map()).get(A[k])!;
      m.set(B[k], (m.get(B[k]) ?? 0) + 1);
    }
    // (what a piece of the floor lost to its biggest part, in cells)
    const lost = [...into.values()].reduce((a, m) => a + [...m.values()].reduce((p, v) => p + v, 0) - Math.max(...m.values()), 0);
    if (lost) cut4.push(`${s.id} ${(lost * C * C).toFixed(2)} m2`);
  }
  const count4 = (L: Cache4[], re: RegExp) => L.reduce((a, s) => a + s.pieces.filter((p) => re.test(p)).length, 0);
  const stacks4 = (L: Cache4[]) => L.filter((s) => s.boxes.some((b) => s.boxes.some((q) => q !== b && Math.abs(q[5] - b[4]) < 0.02 && q[0] < b[1] && q[1] > b[0] && q[2] < b[3] && q[3] > b[2]))).length;
  const [court4, base4] = [of4("court"), of4("base")];
  const placed4 = Object.values((cfg as unknown as { chunks: Record<string, { place: unknown[][] }> }).chunks).flatMap((c) => c.place) as Array<[string, number, number, number]>;
  const pools4 = (cfg.game as unknown as { pools: { spots: number[][]; sets: Array<{ pieces: string[] }> } }).pools;
  const panels = placed4.filter((q) => /\/Lighting_Deco007[bc]?\.prefab$/.test(q[0]) && q[2] > 2.9 && q[2] <= 3.0 && Math.abs(q[1]) < 25 && Math.abs(q[3]) < 30.5);
  const pooled = panels.filter((q) => pools4.spots.some((p) => Math.abs(p[1]) < 0.1 && Math.hypot(p[0] - q[1], p[2] - q[3]) < 3)).length;
  const lampsPooled = pools4.sets.some((s) => s.pieces.includes("Lighting_Deco002_lgt.prefab"));
  const ok4 = chests("vault") >= 3 && /LightWall03_02=Light06\|#ffb020/.test(CM4.CHEST ?? "") && chests("well") >= 1 && chests("station") >= 1 && chests("court") >= 2 && chests("base") >= 2 && unbaked === 0 && floating === 0 && cut4.length === 0 && count4(court4, /^(Coolbox|ElectricStreetBox)/) >= 2 && stacks4(court4) >= 1 && count4(court4, /^Lighting_Deco007/) >= 6 && lampsPooled && count4(base4, /^Bar0/) >= 3 && count4(base4, /^(Coolbox|TicketPickMachine)/) >= 1 && stacks4(base4) >= 1 && panels.length >= 1 && pooled === panels.length;
  check(
    "loot in sight and the rooms furnished: lit chests in THE VAULT's halls, THE WELL, the station, the court and the base's hall, each set on its floor in the collision and no way cut, the court's plant, stack and lit panels, the hall's counter, plant, stack and lit panels",
    ok4,
    `chests: vault ${chests("vault")}, well ${chests("well")}, station ${chests("station")}, court ${chests("court")}, base ${chests("base")}; ${unbaked} boxes not baked, ${floating} on no floor, ways cut ${cut4.join(", ") || "none"}; court ${count4(court4, /^(Coolbox|ElectricStreetBox)/)} machines, ${stacks4(court4)} stacks, ${count4(court4, /^Lighting_Deco007/)} lit panels; hall ${count4(base4, /^Bar0/)} counter bars, ${count4(base4, /^(Coolbox|TicketPickMachine)/)} machines, ${stacks4(base4)} stacks, ${pooled} of ${panels.length} lit panels pooled`
  );
}

// Milestone 1089 (the centre's nineteenth reviews, A, 19: "every chest gold-lidded and glowing", "the violet floor's one object
// white-grey not gold"): every cache set's chest, the pack's crate with a lit lid, worn with THE VAULT's gold lid
// (rules.dress.caches.mats.CHEST) in the rules and as laid; until then THE WELL's, the station's, the court's and the base's
// wore the pack's own white
{
  const CS9 = (cfg.rules.dress as unknown as { caches: { mats: Record<string, string>; sets: Array<{ id: string; parts: unknown[][] }> } }).caches;
  const own9 = CS9.sets.flatMap((s) => s.parts.filter((p) => String(p[0]).startsWith("Crate01b")).map((p) => ({ id: s.id, p })));
  const bare9 = own9.filter((q) => q.p[6] !== "CHEST").map((q) => q.id);
  // (and the bake's placements: a chest at each cache chest's spot wearing the gold lid's remap)
  const laid9 = Object.values((cfg as unknown as { chunks: Record<string, { place: unknown[][] }> }).chunks).flatMap((ch) => ch.place).filter((q) => String(q[0]).endsWith("/Crate01b Variant.prefab") && q[6] === CS9.mats.CHEST);
  check(
    "every chest gold-lidded and lit: each cache set's chest worn with THE VAULT's gold lid, in the rules and as laid",
    own9.length >= 9 && bare9.length === 0 && laid9.length >= own9.length,
    `${own9.length} chests in the cache sets, ${bare9.length} in the pack's own colours${bare9.length ? ` (${bare9.join(", ")})` : ""}, ${laid9.length} laid gold-lidded`
  );
}

// Milestone 1091 (the centre's nineteenth reviews, A, 19b: "the rope rising past the rim into empty sky"): THE WELL's rope
// hangs from a frame at its rim: a post on the rim's paving outside the rail (nothing of the rail within 0.3 m of it), clear
// of the rope's way out (a body's 0.35 m and the post's half each side of the line out), standing on something at the
// street's height and in the collision; its boom over the rope's line, over the ride's top with a head's room, nothing solid
// through boom or brace; the rope drawn up to the boom
{
  const F1 = wellFrame();
  const W1 = (cfg as unknown as { well: { ropes: Array<{ rope: number[][]; out: number[] }>; rail: number[][] } }).well;
  const said1: string[] = [];
  let ok1 = !!F1;
  if (F1) {
    const [rx, rz] = F1.rope;
    const [ox, oz] = W1.ropes[0].out;
    const [px, pz] = F1.post;
    const railNear = W1.rail.filter(([x0, x1, z0, z1]) => px > x0 - 0.3 && px < x1 + 0.3 && pz > z0 - 0.3 && pz < z1 + 0.3).length;
    const across = Math.abs((px - rx) * -oz + (pz - rz) * ox);
    const outward = (px - rx) * ox + (pz - rz) * oz;
    const S1 = (SOLIDS as { solids: number[][] }).solids;
    const under = S1.some((b) => px >= b[0] && px <= b[1] && pz >= b[2] && pz <= b[3] && b[5] >= -0.05 && b[5] <= 0.5);
    const inSolids = RANGE_SOLIDS.some((b) => Math.abs(b.minX - (F1.box[0] + BR_X)) < 1e-6 && Math.abs(b.maxZ - (F1.box[3] + BR_Z)) < 1e-6 && Math.abs(b.top - F1.top) < 1e-6);
    const [ex, ez] = F1.end;
    const len = Math.hypot(ex - px, ez - pz);
    const offLine = Math.abs((rx - px) * (ez - pz) - (rz - pz) * (ex - px)) / len;
    const past = ((rx - px) * (ex - px) + (rz - pz) * (ez - pz)) / len;
    const rideTop = W1.ropes[0].rope[1][1];
    const head = F1.top - F1.cfg.thick / 2 - rideTop;
    // (nothing of the city's collision through the boom or the brace, sampled every 10 cm, but the rail the boom passes over)
    const through: string[] = [];
    for (let t = 0; t <= len; t += 0.1) {
      const [x, z] = [px + ((ex - px) * t) / len, pz + ((ez - pz) * t) / len];
      const yb = F1.brace.post + (F1.top - F1.brace.post) * Math.min(1, t / F1.brace.boom);
      for (const y of t <= F1.brace.boom ? [F1.top, yb] : [F1.top])
        if (S1.some((b) => x > b[0] && x < b[1] && z > b[2] && z < b[3] && y > b[4] && y < b[5])) through.push(`${x.toFixed(1)}, ${y.toFixed(1)}, ${z.toFixed(1)}`);
    }
    const ropes1 = scene.getObjectByName("neon:ropes");
    let ropeTop = -Infinity;
    ropes1?.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      const pos = m.geometry.getAttribute("position");
      for (let i = 0; i < pos.count; i++) if (Math.hypot(pos.getX(i) - rx, pos.getZ(i) - rz) < 0.05 && pos.getY(i) > ropeTop && pos.getY(i) < F1.top) ropeTop = pos.getY(i);
    });
    ok1 = railNear === 0 && across >= 0.35 + F1.cfg.thick / 2 + 0.4 && outward > 0 && under && inSolids && offLine < 0.01 && past > len - F1.cfg.over - 0.01 && past < len && head >= 0.3 && through.length === 0 && Math.abs(ropeTop - (F1.top - F1.cfg.thick / 2)) < 0.02;
    said1.push(`post at (${px.toFixed(2)}, ${pz.toFixed(2)}), ${railNear} rail cells within 0.3 m, ${across.toFixed(2)} m across the way out and ${outward.toFixed(2)} m out from the rope, ${under ? "on the paving" : "on nothing"}, ${inSolids ? "colliding" : "not colliding"}; the boom ${offLine.toFixed(3)} m off the rope's line, its end ${(len - past).toFixed(2)} m past it, ${head.toFixed(2)} m over the ride's top; ${through.length} points through something${through.length ? ` (${through.slice(0, 2).join("; ")})` : ""}; the rope drawn to ${ropeTop.toFixed(2)} m`);
  } else said1.push("no frame");
  check("THE WELL's rope hung from a frame at its rim: a post outside the rail clear of the way out, colliding, a boom over the rope with a head's room over the ride's top, the rope drawn up to it", ok1, said1.join("; "));
}

// Milestone 1092 (the centre's nineteenth reviews, A, 11 and 13: "the floor number facing each stair"): each numbered floor's
// number at its storey's landing in the core, on the west wall's inside south of the west door, facing the climber who comes
// back west along the south half; in the floor's own colour, its middle at eye height over the landing, clear of the door,
// the south wall and the next landing's slab
{
  type B2 = { text: string; at: number[]; yaw: number; w: number; h: number; colour: string };
  const BD2 = (cfg.game as unknown as { boards: B2[] }).boards;
  const C2 = (cfg.tower as unknown as { core: { box: number[]; wall: number; door: number[]; storeys: number[]; doors: string[][]; slab: number } }).core;
  const FA2 = (cfg.rules.tower as unknown as { floors: { at: Record<string, { lampMat?: string; mat?: string }> } }).floors.at;
  const [X0, , Z0, Z1] = C2.box;
  const dz2 = (Z0 + Z1) / 2;
  const nums2 = Object.keys(FA2).map(Number).sort((a, b) => a - b);
  const bad2: string[] = [];
  let n2 = 0;
  for (const h of nums2) {
    const i = C2.storeys.indexOf(h);
    if (i < 0 || !C2.doors[i]?.includes("w")) continue;
    n2++;
    const P = FA2[String(h)];
    const colour = ((P.lampMat ?? "").match(/#[0-9a-f]{6}/i) ?? (P.mat ?? "").match(/#[0-9a-f]{6}/i))?.[0]?.toLowerCase();
    const next = C2.storeys[i + 1] ?? h + 3;
    const b = BD2.find((q) => q.text === String(1 + nums2.indexOf(h)) && Math.abs(q.at[0] - (X0 + C2.wall)) < 0.05 && q.at[1] > h && q.at[1] < next);
    const why = !b ? "none" : b.yaw !== 90 ? "not facing the stair" : b.colour.toLowerCase() !== colour ? `${b.colour} for ${colour}` : b.at[2] - b.w / 2 < dz2 + C2.door[0] / 2 + 0.1 ? "over the door" : b.at[2] + b.w / 2 > Z1 - C2.wall - 0.05 ? "into the south wall" : b.at[1] - b.h / 2 < h + 1 || b.at[1] + b.h / 2 > next - C2.slab - 0.05 ? "not at eye height under the slab" : "";
    if (why) bad2.push(`${h} m ${why}`);
  }
  check("each tower floor's number in its own colour facing the stair's climber at its landing in the core", n2 >= 14 && bad2.length === 0, `${n2 - bad2.length} of ${n2} floors${bad2.length ? `: ${bad2.join(", ")}` : ""}`);
}

// Milestone 1093 (the centre's twentieth reviews, both, 28 and 30: "gold racks stand outside the strongroom as well as inside it,
// which muddles which room is the prize", "the gold is flat orange paint"): every gold bar laid on the 32 m storey inside the
// strongroom (`door.room`), 100 and more; no rack outside it worn gold; the storey's walls off the yellow paint
{
  const V3b = (cfg.rules.tower as unknown as { floors: { at: Record<string, { mat?: string; coverMat?: Record<string, string>; vault?: { bar: { piece: string }; door?: { room?: number[] } } }> } }).floors.at["32"];
  const room3 = V3b.vault?.door?.room;
  const pl3 = (cfg as unknown as { chunks: Record<string, { place: Array<[string, number, number, number, number, string, string?]> }> }).chunks["c-tower"].place;
  const bars3 = pl3.filter((q) => q[0].endsWith(`/${V3b.vault?.bar.piece}`) && q[2] > 31.9 && q[2] < 35);
  const out3 = room3 ? bars3.filter((q) => !(q[1] > room3[0] && q[1] < room3[1] && q[3] > room3[2] && q[3] < room3[3])) : bars3;
  const goldRacks = pl3.filter((q) => /\/Rack0[0-2]( Variant)?\.prefab$/.test(q[0]) && q[2] > 31.9 && q[2] < 35 && /Golden/.test(q[6] ?? "") && !(room3 && q[1] > room3[0] && q[1] < room3[1] && q[3] > room3[2] && q[3] < room3[3]));
  check(
    "THE VAULT's prize in one room: every gold bar on the strongroom's racks, no gold rack outside it, the storey's walls off the yellow paint",
    !!room3 && bars3.length >= 100 && out3.length === 0 && goldRacks.length === 0 && !/MetalPaintPannelsYellow00/.test(V3b.mat ?? ""),
    `${bars3.length} bars on the storey, ${out3.length} outside the strongroom, ${goldRacks.length} gold racks outside it, walls ${V3b.mat}`
  );
}

// Milestone 1105 (the centre's twentieth reviews, A, 04 and 14, and the twenty-first, B, 14: ropes ending in mid-air): every
// glass lift's top and both ends of every zip line carried by a frame: a post on a floor (a box's top or the world's floor
// within 0.3 m of its foot), through nothing solid from 0.35 m over its foot to its top, 0.75 m and more across the line the
// rider leaves the end along, its boom from its top to over the end through nothing solid; twelve frames and more
{
  const RF2 = ropeFrames();
  const S2 = (SOLIDS as { solids: number[][] }).solids;
  const bad2: string[] = [];
  for (const f of RF2) {
    const [px, pz] = f.post;
    const [ex, , ez] = f.end;
    const onFloor = Math.abs(floorAt(px + BR_X, pz + BR_Z) - f.base) < 0.3 || S2.some((b) => px >= b[0] && px <= b[1] && pz >= b[2] && pz <= b[3] && Math.abs(b[5] - f.base) < 0.3);
    const h = 0.06;
    const inWall = S2.some((b) => px + h > b[0] && px - h < b[1] && pz + h > b[2] && pz - h < b[3] && b[4] < f.top - 0.05 && b[5] > f.base + 0.35);
    const len = Math.hypot(ex - px, ez - pz);
    let boomHit = false;
    for (let t = 0; t <= len && !boomHit; t += 0.1) {
      const [x, z] = [px + ((ex - px) * t) / len, pz + ((ez - pz) * t) / len];
      boomHit = S2.some((b) => x > b[0] && x < b[1] && z > b[2] && z < b[3] && f.top > b[4] && f.top < b[5]);
    }
    const why = !onFloor ? "over no floor" : inWall ? "through a wall" : len < 0.75 ? "on the rider's line" : boomHit ? "its boom through something" : "";
    if (why) bad2.push(`${f.id} ${why} at (${px.toFixed(1)}, ${f.base.toFixed(1)}, ${pz.toFixed(1)})`);
  }
  check(
    "every glass lift's top and zip line's end carried by a frame: its post on a floor, in no wall, clear of the rider's line, its boom clear",
    RF2.length >= 12 && bad2.length === 0,
    `${RF2.length - bad2.length} of ${RF2.length} frames${bad2.length ? `: ${bad2.join("; ")}` : ""}`
  );
}

// Milestone 1062 (the districts' tenth reviews of version 132, 2026-11-02): THE CANYON cut across at walkway height ("one long
// straight lane at both levels, a sniper's corridor", "a bridge or a hanging sign block at walkway height every 25 to 30
// m") and each ad stand on its roofs its own ad ("one ad on six billboards"); LANTERN ALLEYS' roofs, THE TERRACES' tiers
// and THE WORKS' roofs each their own from the drop ("one brown-tan carpet"); the edge: THE CANYON's sides on the map's
// edge in its fronts ("a bare orange-tan tiled strip ... inside the fence on the south and west"), a ring road past the
// fence ("a grey moat ... a stage in a void") and the city past it dimmer by night ("the filler city brighter than the
// districts"). Each crossing walked across and back at the walk's height, a sign solid along each of its open sides from
// the rail's top to over a standing eye, and no stretch of an arm's street longer than `every` without one
{
  type Look = { canyon: { crossings: number; every: number; eye: number; ads: number }; lantern: number; brown: string; works: number; nightGlow: number; ring: { lines: number } };
  const LK = (cfg.rules as unknown as { edgeLook?: Look }).edgeLook;
  const said: string[] = [];
  let ok = !!LK;
  if (!LK) said.push("no rules.edgeLook");
  else {
    const CH4 = cfg.chunks as unknown as Record<string, { place: unknown[][] }>;
    const DS4 = cfg.rules.districts as unknown as {
      canyon: { edge: number; blocks: number[][]; walkways: { y: number; railH: number; crossings?: number[][] } };
      lantern: { chunk: string; roofs?: Record<string, string> };
      terraces: { chunk: string; top: { piece: string; mat: string } };
      works: { chunk: string; storey: number; roof: string[]; roofWear?: { band: string; middle: string; width: number }; halls: Array<{ id: string; box: number[]; storeys: number }> };
    };
    // (a typed box holding a point, map metres)
    const solidAt = (x: number, y: number, z: number) => solidsIn(x + BR_X, x + BR_X, z + BR_Z, z + BR_Z).some((b) => b.minX <= x + BR_X && b.maxX >= x + BR_X && b.minZ <= z + BR_Z && b.maxZ >= z + BR_Z && b.base <= y && b.top >= y);
    // 1 each ad stand on THE CANYON's roofs (the canyon's own and the high cover's in the south-west L) its own ad
    const stands = ["c-canyon", "c-hcover"].flatMap((k) => (CH4[k]?.place ?? []).filter((q) => String(q[0]).endsWith("/AD_Structure02.prefab") && Number(q[1]) < -40 && Number(q[3]) > 40));
    const ads = stands.map((q) => /Light02=([^;]+)/.exec(String(q[6] ?? ""))?.[1] ?? "its own");
    const worn = ((cfg.rules.wear as unknown as Record<string, string>)["AD_Structure02.prefab"] ?? "").split("=")[1];
    if (stands.length < LK.canyon.ads || new Set(ads).size !== ads.length || ads.some((a) => a === worn || a === "its own")) (ok = false), said.push(`THE CANYON's ${stands.length} ad stands show ${new Set(ads).size} ads (${ads.join(", ")})`);
    // 2 its crossings: runs across the street from walkway to walkway, walked across and back, a sign along each open side
    const CY4 = DS4.canyon;
    const WK4 = CY4.walkways;
    const y = WK4.y;
    const arms = [
      { id: "south", ends: [-122.5, -42.5], across: (r: number[]) => r[2] <= 122.51 && r[3] >= 127.49 && r[0] >= -122.51 && r[1] <= -42.49, mid: (r: number[]) => (r[0] + r[1]) / 2, way: (m: number) => [[m, 121.25, y], [m, 128.75, y]], side: (r: number[]) => [r[0] + 0.06, r[1] - 0.06].map((v) => (t: number) => [v, t]) },
      { id: "west", ends: [42.5, 120], across: (r: number[]) => r[0] <= -127.49 && r[1] >= -122.51 && r[2] >= 42.49 && r[3] <= 120.01, mid: (r: number[]) => (r[2] + r[3]) / 2, way: (m: number) => [[-121.25, m, y], [-128.75, m, y]], side: (r: number[]) => [r[2] + 0.06, r[3] - 0.06].map((v) => (t: number) => [t, v]) },
    ];
    for (const A of arms) {
      const cross = (WK4.crossings ?? []).filter(A.across);
      const mids = cross.map(A.mid).sort((p, q) => p - q);
      const gaps = [mids[0] - A.ends[0], ...mids.slice(1).map((m, i) => m - mids[i]), A.ends[1] - mids[mids.length - 1]];
      const longest = mids.length ? Math.max(...gaps) : A.ends[1] - A.ends[0];
      const stopped: string[] = [];
      const open: string[] = [];
      for (const r of cross) {
        const m = A.mid(r);
        const there = along(A.way(m));
        const back = along([...A.way(m)].reverse());
        if (there.k !== 2 || back.k !== 2) stopped.push(`at ${m}: ${there.k === 2 ? "back" : "across"} stopped at (${(there.k === 2 ? back : there).x.toFixed(1)}, ${(there.k === 2 ? back : there).z.toFixed(1)}) ${(there.k === 2 ? back : there).y.toFixed(2)} m`);
        // (across the street's 5 m, every half metre, at the rail's top and at a standing eye with a hand to spare)
        for (const at of A.side(r))
          for (let t = 122.75; t < 127.5; t += 0.5)
            for (const h of [y + WK4.railH + 0.1, y + LK.canyon.eye]) {
              const [px, pz] = A.id === "south" ? at(t) : at(-t);
              if (!solidAt(px, h, pz)) open.push(`(${px.toFixed(2)}, ${pz.toFixed(2)}) at ${h.toFixed(1)} m`);
            }
      }
      if (cross.length < LK.canyon.crossings || longest > LK.canyon.every || stopped.length || open.length) (ok = false), said.push(`THE CANYON's ${A.id} arm: ${cross.length} crossings, ${longest.toFixed(1)} m of street the longest without one${stopped.length ? `; ${stopped.slice(0, 2).join("; ")}` : ""}${open.length ? `; ${open.length} points of the signs open, ${open.slice(0, 2).join("; ")}` : ""}`);
      else said.push(`${A.id} arm ${cross.length} crossings, ${longest.toFixed(1)} m the longest without one`);
    }
    // 3 THE CANYON's sides on the map's edge: every metre of them a front's window face (its own -x face, at its own x -5,
    // z from minus its length to 0, as the fronts' check above reads them)
    const faces = (CH4["c-canyon"]?.place ?? [])
      .filter((q) => /\/UnderWall0[016]/.test(String(q[0])))
      .map((q) => {
        const [name, x, , z, yaw] = q as [string, number, number, number, number];
        const a = (yaw * Math.PI) / 180;
        const [cc, s] = [Math.cos(a), Math.sin(a)];
        const own = (lx: number, lz: number) => [x + cc * lx + s * lz, z - s * lx + cc * lz];
        return [own(-5, /UnderWall01/.test(name) ? -7.5 : -5), own(-5, 0)];
      });
    const onFace = (px: number, pz: number) =>
      faces.some(([p, q]) => {
        const [dx, dz] = [q[0] - p[0], q[1] - p[1]];
        const t = Math.max(0, Math.min(1, ((px - p[0]) * dx + (pz - p[1]) * dz) / (dx * dx + dz * dz)));
        return Math.hypot(px - p[0] - dx * t, pz - p[1] - dz * t) < 0.1;
      });
    const bare: string[] = [];
    let edgeM = 0;
    for (const [x0, x1, z0, z1] of CY4.blocks)
      for (const [v, a0, a1, alongX] of [[z0, x0, x1, true], [z1, x0, x1, true], [x0, z0, z1, false], [x1, z0, z1, false]] as Array<[number, number, number, boolean]>) {
        if (Math.abs(v) < CY4.edge - 0.01) continue;
        for (let s = a0 + 0.5; s < a1; s += 1) {
          edgeM++;
          const [px, pz] = alongX ? [s, v] : [v, s];
          if (!onFace(px, pz)) bare.push(`(${px}, ${pz})`);
        }
      }
    if (edgeM < 200 || bare.length) (ok = false), said.push(`THE CANYON's sides on the map's edge: ${bare.length} of ${edgeM} m bare${bare.length ? ` (${bare.slice(0, 3).join("; ")})` : ""}`);
    // 4 the districts from the drop: LANTERN ALLEYS' houses in their roofs' material, THE TERRACES' tops not the brown roof
    // tile, THE WORKS' hall roofs whole, a band round each in `band` and its middle in `middle`
    const LR = DS4.lantern;
    const nameOf = (q: unknown[]) => String(q[0]).split("/").pop()!;
    const houses = (CH4[LR.chunk]?.place ?? []).filter((q) => !!LR.roofs?.[nameOf(q)]);
    const unworn = houses.filter((q) => q[6] !== LR.roofs![nameOf(q)]);
    const TR4 = DS4.terraces;
    const tops = (CH4[TR4.chunk]?.place ?? []).filter((q) => String(q[0]).endsWith(`/${TR4.top.piece}`));
    const offTop = tops.filter((q) => q[6] !== TR4.top.mat).length;
    const WR4 = DS4.works;
    const RW4 = WR4.roofWear;
    const plain: string[] = [];
    for (const H of WR4.halls) {
      const [x0, x1, z0, z1] = H.box;
      const top = H.storeys * WR4.storey;
      // (a roof tile's middle: the pack's floor tiles run to -x and -z of their pivot, their size in their name)
      let [area, off] = [0, 0];
      for (const q of CH4[WR4.chunk]?.place ?? []) {
        if (!WR4.roof.some((n) => String(q[0]).endsWith(`/${n}`)) || Math.abs(Number(q[2]) - top) > 0.01) continue;
        const s = Number(/_(\d+(?:\.\d+)?)x/.exec(nameOf(q))?.[1] ?? 0);
        const [cx, cz] = [Number(q[1]) - s / 2, Number(q[3]) - s / 2];
        if (cx < x0 || cx > x1 || cz < z0 || cz > z1) continue;
        area += s * s;
        const w = RW4?.width ?? 0;
        const band = cx - s / 2 < x0 + w - 0.01 || cx + s / 2 > x1 - w + 0.01 || cz - s / 2 < z0 + w - 0.01 || cz + s / 2 > z1 - w + 0.01;
        if (!RW4 || q[6] !== (band ? RW4.band : RW4.middle)) off++;
      }
      if (Math.abs(area - (x1 - x0) * (z1 - z0)) > 0.1 || off) plain.push(`${H.id} ${area} of ${(x1 - x0) * (z1 - z0)} m2, ${off} tiles in neither`);
    }
    if (houses.length < LK.lantern || unworn.length || tops.length < 90 || offTop || TR4.top.mat.split(/[*=]/)[0] === LK.brown || WR4.halls.length < LK.works || plain.length) (ok = false), said.push(`LANTERN ALLEYS ${houses.length - unworn.length} of ${houses.length} houses in their roofs; THE TERRACES' ${tops.length} tops in ${TR4.top.mat} (${offTop} not); THE WORKS ${plain.slice(0, 2).join("; ") || "banded"}`);
    else said.push(`LANTERN ALLEYS ${houses.length} roofs, THE TERRACES ${tops.length} tops, THE WORKS ${WR4.halls.length} roofs banded`);
    // 5 past the fence: the city's windows by night no brighter than `nightGlow`, and the ring road drawn between the map's
    // own ground and the low blocks, with its lane marks
    const SKY = (worldCfg as unknown as { skyline: { from: number; glow: { night: number }; low: { from: number }; ring?: { from: number; to: number } } }).skyline;
    const ringObj = scene.getObjectByName("skylineRing");
    const marks = scene.getObjectByName("skylineRingLines") as THREE.InstancedMesh | undefined;
    const RG4 = SKY.ring;
    if (SKY.glow.night > LK.nightGlow || !RG4 || !ringObj || ringObj.children.length < 5 || (marks?.count ?? 0) < LK.ring.lines || RG4.from < BR_HALF + SKY.from || RG4.to > SKY.low.from) (ok = false), said.push(`past the fence: windows by night ${SKY.glow.night} (at most ${LK.nightGlow}); ring road ${RG4 ? `${RG4.from} to ${RG4.to} m` : "none"}, ${ringObj ? ringObj.children.length : 0} meshes, ${marks?.count ?? 0} lane marks`);
    else said.push(`past the fence the windows by night ${SKY.glow.night}, a ring road ${RG4.from} to ${RG4.to} m with ${marks!.count} lane marks`);
    said.push(`${stands.length} ads, ${edgeM} m of the canyon's edge in fronts`);
  }
  check("the canyon cut and its ads, the districts from the drop, the edge built: THE CANYON's crossings at walkway height walked across with a sign solid along each side, each of its ad stands its own ad, its sides on the map's edge in fronts; LANTERN ALLEYS' roofs, THE TERRACES' tops and THE WORKS' banded roofs their own; the city past the fence dimmer by night, a ring road past the fence", ok, said.join("; "));
}

// the shops on the street (rules.low.shops, Milestone 1061; the centre's sixteenth reviews: "the street level has nowhere to
// go", "3-4 walk-in ground rooms a corner block with windows on the street and an inside stair to the roof", "MARKET and
// NOODLE ROW halls to walk into, stalls and a mezzanine", "pavilions ... to enter and climb", "MARKET canopies and crate walls",
// "street blockers 2-2.5 m ... kiosk clusters"): a shop or a hall in each corner block's street front, the shops with windows on their street
// side, MARKET's and NOODLE ROW's halls and one by a High City block's outer end; each walked into by a player from 2 m out in the street through
// its doorway to its floor, up its stair in its three lanes onto its roof, and over its roof round the stair's hole; no drop
// in one; MARKET's hall under its awnings with its crate walls; and the street's food kiosks among its sets
{
  type Shop = { id: string; block: string; kit: string; box: number[]; roof: number; door: number[]; way: number[][]; stair: number[][][]; up: number[][] };
  const SHc = (cfg as unknown as { shops?: { list: Shop[]; solids: number[][] } }).shops;
  const LS = SHc?.list ?? [];
  const SHr = (cfg.rules.low as unknown as { shops?: { chunk: string } }).shops;
  const SP = (cfg as unknown as { chunks: Record<string, { place: unknown[][] }> }).chunks[SHr?.chunk ?? "c-shops"]?.place ?? [];
  const inBox = (q: unknown[], b: number[], m: number) => Number(q[1]) > b[0] - m && Number(q[1]) < b[1] + m && Number(q[3]) > b[2] - m && Number(q[3]) < b[3] + m;
  const shopBlocks = new Set(LS.filter((s) => s.block !== "THE CENTRE").map((s) => s.block));
  const halls = LS.filter((s) => s.kit === "hall").map((s) => s.block);
  // (a shop's windows: the pack's window panels in its walls)
  const windows = LS.filter((s) => s.kit === "shop").map((s) => SP.filter((q) => /Window00\.prefab$/.test(String(q[0])) && inBox(q, s.box, 1)).length);
  const walks = LS.map((s) => {
    const inn = along(s.way);
    const ups = s.stair.filter((lane) => {
      const w = along(lane);
      return w.k === lane.length && Math.abs(w.y - lane.at(-1)![2]) < 0.15;
    }).length;
    const over = along(s.up);
    return { s, inn: inn.k === s.way.length && Math.abs(inn.y - s.way.at(-1)![2]) < 0.15, ups, lanes: s.stair.length, over: over.k === s.up.length && Math.abs(over.y - s.roof) < 0.15, at: inn };
  });
  const fell = walks.filter((w) => !w.inn || w.ups < 3 || w.ups !== w.lanes || !w.over);
  const drops = map.pois.flatMap((p) => p.drops).filter((d) => LS.some((s) => d.x - BR_X > s.box[0] - 0.5 && d.x - BR_X < s.box[1] + 0.5 && d.z - BR_Z > s.box[2] - 0.5 && d.z - BR_Z < s.box[3] + 0.5)).length;
  const mk = LS.find((s) => s.block === "MARKET" && s.kit === "hall");
  const awnings = mk ? SP.filter((q) => String(q[0]).endsWith("/Window_sunshade001.prefab") && inBox(q, mk.box, 3)).length : 0;
  const crates = mk ? SP.filter((q) => String(q[0]).endsWith("/Crate00.prefab") && inBox(q, mk.box, 0)).length : 0;
  const SCs = (cfg as unknown as { streetCover?: Array<{ piece: string }> }).streetCover ?? [];
  const kiosks = SCs.filter((q) => q.piece.startsWith("Fastfood_street01")).length;
  check(
    "the shops on the street: a shop or a hall on each corner block's street front, the shops with windows on their street side, MARKET's and NOODLE ROW's halls and one by a High City block's outer end, each walked into from the street, up its stair onto its roof and over it; no drop in one; MARKET's hall under awnings with crate walls; kiosks among the street's sets",
    LS.length >= 6 && shopBlocks.size === 4 && halls.includes("MARKET") && halls.includes("NOODLE ROW") && halls.includes("THE CENTRE") && windows.every((n) => n >= 3) && fell.length === 0 && drops === 0 && awnings >= 2 && crates >= 5 && kiosks >= 6,
    `${LS.length} shops (${shopBlocks.size} corner blocks with a shop, halls in ${halls.join(", ") || "none"}), windows ${windows.join("/") || "none"}; ${walks.length - fell.length} of ${walks.length} walked in, up and over${fell.length ? ` (${fell.slice(0, 3).map((w) => `${w.s.id}: in ${w.inn ? "yes" : `no, at (${w.at.x.toFixed(1)}, ${w.at.z.toFixed(1)})`}, ${w.ups} of ${w.lanes} lanes up, over ${w.over ? "yes" : "no"}`).join("; ")})` : ""}; ${drops} drops in one; MARKET's hall ${awnings} awnings, ${crates} crates; the street's sets ${kiosks} kiosk stalls`,
  );
}

// The tower's floors each their own (Milestone 1065; the centre's seventeenth reviews of pictures 11 to 13: "each its own light
// colour and ceiling, raw slab edges trimmed; the floors look like one room recoloured", "the stair rises under an unbroken
// tiled ceiling, so the hole it climbs through is hard to read", "a bare concrete beam crosses the room diagonally at head
// height", "the stair's side rails and the curved plinth carry stretched textures"; the sixteenth: "floor material and
// light colour per floor"): every new floor with a ceiling of its own, baked (the 35 m floor's is the sky floor's own
// storey over it, which the bake does not lay), a light of its own that the game's fill lights each lamp spot over it in,
// each light 40 and more apart in RGB from every other floor's and from the fill's own, its ceiling lamps worn in its lamp
// light, its skirting not its patterned walls; every hole over a floor under THE VAULT rimmed in a finish and not the bare
// concrete, with a lit line along its rim on the floor and another under the slab; and the inner stairs' sides off the
// cracked paint that stretched along them
{
  type Fl5 = { mat?: string; ceilingMat?: string; lampMat?: string; light?: string; plinthMat?: string; edgeMat?: string; holes?: number[][] };
  const TW5 = cfg.rules.tower as unknown as { slab: number; mats: { rim?: string; edge: string }; floors: { lamp: { piece: string }; stair: { piece: string; mat?: string }; at: Record<string, Fl5> } };
  const C5 = cfg.tower as unknown as { shaft: number[]; square: number[]; measured: { ceilings?: Array<{ over: number; mat: string }> } };
  const [q0, q1, r0, r1] = C5.square;
  const FA5 = TW5.floors.at;
  const inSq5 = (x: number, z: number) => x > q0 && x < q1 && z > r0 && z < r1;
  const lampEnd5 = `/${TW5.floors.lamp.piece.split("/").pop()}`;
  const placed5 = (cfg as unknown as { chunks: Record<string, { place: unknown[][] }> }).chunks["c-tower"].place as Array<[string, number, number, number, number, string, string?]>;
  const spots5 = neonFillSpots();
  const cols5 = typeof neonFillColours === "function" ? neonFillColours() : [];
  const rgb5 = (s?: string) => (s && /^#[0-9a-f]{6}$/i.test(s) ? [1, 3, 5].map((i) => parseInt(s.slice(i, i + 2), 16)) : null);
  const apart5 = (a: number[] | null, b: number[] | null) => (a && b ? Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) : 0);
  const fill5 = rgb5((cfg.game as unknown as { fill: { colour: string } }).fill.colour);
  const top5 = C5.shaft[C5.shaft.length - 1];
  const rows5 = C5.shaft.map((h) => {
    const P = FA5[String(h)] ?? {};
    const own = rgb5(P.light);
    const over = spots5.map((q, i) => ({ q, i })).filter(({ q }) => inSq5(q.x - BR_X, q.z - BR_Z) && q.y > h + 1 && q.y < h + 3.4);
    const lit = over.filter(({ i }) => {
      const c = cols5[i];
      if (!own || !c) return false;
      const got = [(c.getHex() >> 16) & 255, (c.getHex() >> 8) & 255, c.getHex() & 255];
      return got.every((v, k) => Math.abs(v - own[k]) <= 2);
    }).length;
    const lamps = placed5.filter((q) => q[0].endsWith(lampEnd5) && q[2] > h && q[2] < h + 3.4 && inSq5(q[1], q[3]));
    const lampsOk = !!P.lampMat && lamps.length >= 6 && lamps.every((q) => q[6] === P.lampMat);
    const ceil = h === top5 ? "its sky floor's" : P.ceilingMat && (C5.measured.ceilings ?? []).some((q) => q.over === h && q.mat === P.ceilingMat) ? P.ceilingMat : undefined;
    return { h, own, n: over.length, lit, lamps: lamps.length, lampsOk, ceil, plain: !!P.plinthMat && P.plinthMat !== P.mat };
  });
  const ceils5 = rows5.filter((r) => r.h !== top5).map((r) => r.ceil);
  const close5: string[] = [];
  // (near white since Milestone 1092, each 10 to 45 from the fill's warm white and still 12 or more from every other floor's:
  // the floor's colour is its trim, its lamps, walls and number; 40 apart and 40 from the warm white until then)
  rows5.forEach((a, i) => rows5.slice(i + 1).forEach((b) => apart5(a.own, b.own) < 12 && close5.push(`${a.h}/${b.h}`)));
  // (each hole of a floor under THE VAULT: its rim's own finish and a lit line round it on the floor and under the slab)
  const OL5 = (cfg.game as unknown as { outlines: Array<{ name: string; rect?: number[]; y: number }> }).outlines;
  const holes5: string[] = [];
  let holesOk5 = true;
  for (const h of C5.shaft.filter((v) => v < 32))
    for (const hole of FA5[String(h)]?.holes ?? []) {
      const P = FA5[String(h)];
      const along = OL5.filter((o) => o.rect && o.rect.every((v, k) => Math.abs(v - hole[k]) < 0.02));
      const onTop = along.some((o) => Math.abs(o.y - h) < 0.05);
      const under = along.some((o) => o.y < h - TW5.slab && o.y > h - TW5.slab - 0.1);
      const rim = !!P.edgeMat && P.edgeMat !== (TW5.mats.rim ?? TW5.mats.edge);
      holesOk5 &&= onTop && under && rim;
      holes5.push(`${h} m rim ${P.edgeMat ?? TW5.mats.rim ?? TW5.mats.edge}, lit ${onTop ? "on top" : "not on top"} and ${under ? "under" : "not under"}`);
    }
  const SP5 = TW5.floors.stair as { piece: string; mat?: string };
  const wear5 = SP5.mat ?? "";
  const stairs5 = placed5.filter((q) => q[0].endsWith(`/${SP5.piece}`));
  const stairOk5 = /MetalPaintGreyCracked00=/.test(wear5) && stairs5.length > 0 && stairs5.every((q) => q[6] === wear5);
  check(
    "the tower's floors each their own: a ceiling a floor and a near-white light with a hint of its colour, its lamps in its colour and the game's fill lighting it so, plain skirting, every hole's rim finished and lit on the floor and under the slab, the inner stairs' sides off the stretched paint",
    rows5.every((r) => !!r.own && apart5(r.own, fill5) >= 10 && apart5(r.own, fill5) <= 45 && r.n >= 3 && r.lit === r.n && r.lampsOk && !!r.ceil && r.plain) && new Set(ceils5).size === ceils5.length && close5.length === 0 && holes5.length >= 3 && holesOk5 && stairOk5,
    `${rows5.map((r) => `${r.h} m ceiling ${r.ceil ?? "none"}, light ${r.own ? `#${r.own.map((v) => v.toString(16).padStart(2, "0")).join("")}` : "none"} ${r.lit}/${r.n} spots, ${r.lampsOk ? "lamps in it" : "lamps not in it"}, skirting ${r.plain ? "plain" : "its walls"}`).join("; ")}; too alike ${close5.join(", ") || "none"}; ${holes5.join("; ")}; stairs' sides ${stairOk5 ? wear5 : "as the pack has them"}`
  );
}
// Chest-high furniture across the tower's open floor, its rooms and its maze (Milestone 1065; the seventeenth reviews: "chest-high
// furniture clusters every 6 to 8 m", "the open floor in 11 has knee-high monitors as its only cover"): on the 17, 23 and
// 26 m floors, walked as the tower's floors' own walk walks them (a quarter-metre grid on its lines, a spot where a box tops
// out at the floor under its middle and nothing from a step to a standing body's height within a body's half-width, a
// square, flooded from the core's route at that storey), the distance from each spot reached to the nearest box standing
// on the floor (its foot within 0.6 m of it) and topping out 1.1 to 2.2 m over it, an inner stair's own boxes left out: 95%
// of the spots within 6 m and none past 7.5 m (version 133: the rooms floor none at all, the open floor 14.4 m and 16.9 m,
// the maze 13 m and 15.8 m). Each floor's clusters laid (rules.dress.caches, `where` "tower<h>"), four and more, and the
// caches' own check finds each on its floor, in the collision and cutting no way
{
  const S6 = (SOLIDS as { solids: number[][] }).solids;
  const T6 = cfg.tower as unknown as { square: number[]; core: { route: number[][] }; stairs?: Array<{ box: number[] }> };
  const [sx0, sx1, sz0, sz1] = T6.square;
  const [G6, R6] = [0.25, MOVE.radius];
  // (the walk's own grid, from 3 m outside the square, cut to the square)
  const [i0, j0] = [Math.floor(3 / G6), Math.floor(3 / G6)];
  const [nx6, nz6] = [Math.ceil((sx1 - sx0) / G6), Math.ceil((sz1 - sz0) / G6)];
  const X6 = (i: number) => sx0 - 3 + (i0 + i + 0.5) * G6;
  const Z6 = (j: number) => sz0 - 3 + (j0 + j + 0.5) * G6;
  const dRect6 = (b: number[], x: number, z: number) => Math.hypot(Math.max(b[0] - x, 0, x - b[1]), Math.max(b[2] - z, 0, z - b[3]));
  const sets6 = ((cfg as unknown as { caches?: Array<{ where: string }> }).caches ?? []);
  const res6 = [17, 23, 26].map((h) => {
    const near = S6.filter((b) => b[1] > sx0 - 1 && b[0] < sx1 + 1 && b[3] > sz0 - 1 && b[2] < sz1 + 1 && b[5] > h - 0.6 && b[4] < h + 3);
    const floorB = near.filter((b) => Math.abs(b[5] - h) < 0.15);
    const meet = near.filter((b) => b[4] < h + MOVE.standHeight && b[5] > h + MOVE.stepHeight);
    const inStair = (b: number[]) => (T6.stairs ?? []).some((s) => b[0] >= s.box[0] - 0.2 && b[1] <= s.box[1] + 0.2 && b[2] >= s.box[2] - 0.2 && b[3] <= s.box[3] + 0.2);
    const cover = near.filter((b) => Math.abs(b[4] - h) < 0.6 && b[5] >= h + 1.1 && b[5] <= h + 2.2 && !inStair(b));
    const free = new Uint8Array(nx6 * nz6);
    for (let i = 0; i < nx6; i++)
      for (let j = 0; j < nz6; j++) {
        const [x, z] = [X6(i), Z6(j)];
        free[j * nx6 + i] = floorB.some((b) => x >= b[0] && x <= b[1] && z >= b[2] && z <= b[3]) && !meet.some((b) => b[0] < x + R6 && b[1] > x - R6 && b[2] < z + R6 && b[3] > z - R6) ? 1 : 0;
      }
    const seen = new Uint8Array(nx6 * nz6);
    const todo: number[] = [];
    for (const [x, z, y] of T6.core.route) {
      if (Math.abs(y - h) > 0.15) continue;
      const [i, j] = [Math.round((x - X6(0)) / G6), Math.round((z - Z6(0)) / G6)];
      const q = j * nx6 + i;
      if (i >= 0 && i < nx6 && j >= 0 && j < nz6 && free[q] && !seen[q]) ((seen[q] = 1), todo.push(q));
    }
    while (todo.length) {
      const q = todo.pop()!;
      const [i, j] = [q % nx6, Math.floor(q / nx6)];
      for (const [a, b] of [[i + 1, j], [i - 1, j], [i, j + 1], [i, j - 1]]) {
        if (a < 0 || a >= nx6 || b < 0 || b >= nz6) continue;
        const r = b * nx6 + a;
        if (free[r] && !seen[r]) ((seen[r] = 1), todo.push(r));
      }
    }
    const d: number[] = [];
    for (let q = 0; q < nx6 * nz6; q++) if (seen[q]) d.push(cover.reduce((m, b) => Math.min(m, dRect6(b, X6(q % nx6), Z6(Math.floor(q / nx6)))), Infinity));
    d.sort((a, b) => a - b);
    return { h, area: d.length * G6 * G6, cover: cover.length, p95: d.length ? d[Math.floor(d.length * 0.95)] : Infinity, max: d.length ? d[d.length - 1] : Infinity, sets: sets6.filter((s) => s.where === `tower${h}`).length };
  });
  check(
    "chest-high furniture across the tower's rooms, maze and open floor (17, 23, 26 m): 95% of the floor a body walks within 6 m of it and none past 7.5 m, four clusters and more a floor",
    res6.every((r) => r.area > 90 && r.sets >= 4 && r.p95 <= 6 && r.max <= 7.5),
    res6.map((r) => `${r.h} m: ${r.area.toFixed(0)} m2 walked, ${r.sets} clusters, ${r.cover} boxes 1.1 to 2.2 m, 95% within ${r.p95.toFixed(1)} m, the farthest ${r.max.toFixed(1)} m`).join("; ")
  );
}

// LANTERN ALLEYS as alleys (Milestone 1066; the districts' eleventh reviews of version 133, 2026-11-05, LANTERN ALLEYS 6 and
// 6: "fill the gaps between shophouses with infill shophouses and walls so the streets narrow to alleys 4 to 6 m wide",
// "run lantern lines down every alley and out to the ring-road entry", "densify LANTERN ALLEYS' outer half", "these are not
// alleys ... streets 15 to 20 m wide, lined with free-standing houses with gaps between them", d01, d03, the NE aerial):
// its lanes (rules.districts.lantern.narrow) each walked end to end by a body; the back lanes along the fence measured across
// every metre from house box to house box, the cross alleys' openings at each row; houses along the fence; every gap between
// two houses' ground storeys along a row walled at a body's height or a way the bots walk; lantern lines over every lane,
// each end in a wall at its height and its length clear; a mast either side of each cross alley's mouth with its lines
{
  type Lane6 = { id: string; from: number[]; to: number[]; kind: string; rows?: string[] };
  type Row6 = { id: string; from: number[]; to: number[]; front: number[]; deep: number; skip?: number[][] };
  type House6 = { row: string; piece: string; c: number[]; yaw: number; hu: number; hv: number };
  const LD6 = (cfg.rules.districts as unknown as { lantern: { rows: Row6[]; infill?: { sides: Record<string, number[]>; thick: number }; lights: { lines?: number[][]; masts?: number[][]; cable: string }; narrow?: { lanes: Lane6[]; most: number; least: number; fence: number; edgeHouses: number; lines: number; reach: number; mastLines: number; face: number[] } } }).lantern;
  const NW6 = LD6.narrow;
  const HS6 = (cfg as unknown as { lanternAlleys: { houses: House6[] } }).lanternAlleys.houses;
  const said: string[] = [];
  let ok = !!NW6;
  if (!NW6) said.push("no rules.districts.lantern.narrow");
  else {
    const R6 = MOVE.radius;
    const boxesAt = (x: number, z: number) => solidsIn(x + BR_X - 0.01, x + BR_X + 0.01, z + BR_Z - 0.01, z + BR_Z + 0.01).filter((q) => q.minX <= x + BR_X && q.maxX >= x + BR_X && q.minZ <= z + BR_Z && q.maxZ >= z + BR_Z);
    // (standing across a body's height there, from under its knee to over its chest)
    const wallAt = (x: number, z: number) => boxesAt(x, z).some((q) => q.base < 0.6 && q.top > 1.6);
    const solidAt = (x: number, y: number, z: number) => boxesAt(x, z).some((q) => q.base <= y && q.top >= y);
    const blockedAt = (x: number, z: number) => solidsIn(x - R6 + BR_X, x + R6 + BR_X, z - R6 + BR_Z, z + R6 + BR_Z).some((q) => q.minX < x + R6 + BR_X && q.maxX > x - R6 + BR_X && q.minZ < z + R6 + BR_Z && q.maxZ > z - R6 + BR_Z && q.base < MOVE.standHeight && q.top > MOVE.stepHeight);
    // (each house's box on the map: its turns are quarter turns)
    const boxOf6 = (h: House6) => {
      const side = Math.abs(Math.round(h.yaw / 90)) % 2 === 1;
      const [ex, ez] = side ? [h.hv, h.hu] : [h.hu, h.hv];
      return [h.c[0] - ex, h.c[0] + ex, h.c[1] - ez, h.c[1] + ez];
    };
    const HB = HS6.map(boxOf6);
    const inHouse = (x: number, z: number) => HB.some(([x0, x1, z0, z1]) => x >= x0 - 1e-6 && x <= x1 + 1e-6 && z >= z0 - 1e-6 && z <= z1 + 1e-6);
    // 1 each lane walked end to end at its middle by a body
    for (const ln of NW6.lanes) {
      const L = Math.hypot(ln.to[0] - ln.from[0], ln.to[1] - ln.from[1]);
      for (let k = 0; k <= L; k += 0.5) {
        const [x, z] = [ln.from[0] + ((ln.to[0] - ln.from[0]) * k) / L, ln.from[1] + ((ln.to[1] - ln.from[1]) * k) / L];
        if (blockedAt(x, z)) {
          ok = false;
          said.push(`${ln.id} shut at (${x.toFixed(1)}, ${z.toFixed(1)})`);
          break;
        }
      }
    }
    // 2 the back lanes along the fence: across each, every metre, from house box to house box (the fence past them counts
    // as open: a lane with a row on one side only measures to the fence and past it); the cross alleys' openings at each row
    // from house box or infill wall to house box or wall, at the row's front line
    const across = (x: number, z: number, dx: number, dz: number, cap: number) => {
      for (let d = 0; d < cap; d += 0.05) if (inHouse(x + dx * d, z + dz * d)) return d;
      return cap;
    };
    const widths: string[] = [];
    for (const ln of NW6.lanes.filter((q) => q.kind === "fence")) {
      const L = Math.hypot(ln.to[0] - ln.from[0], ln.to[1] - ln.from[1]);
      const t = [(ln.to[0] - ln.from[0]) / L, (ln.to[1] - ln.from[1]) / L];
      const ws: number[] = [];
      for (let k = 0.5; k <= L - 0.5; k += 1) {
        const [x, z] = [ln.from[0] + t[0] * k, ln.from[1] + t[1] * k];
        ws.push(across(x, z, -t[1], t[0], 15) + across(x, z, t[1], -t[0], 15));
      }
      ws.sort((p, q) => p - q);
      const med = ws[Math.floor(ws.length / 2)];
      if (med > NW6.most || ws[0] < NW6.least) (ok = false), said.push(`${ln.id} ${med.toFixed(2)} m across at its median, ${ws[0].toFixed(2)} at its least`);
      widths.push(`${ln.id} ${med.toFixed(2)} m (${ws[0].toFixed(2)} to ${ws[ws.length - 1].toFixed(2)})`);
    }
    const W6 = (cfg as unknown as { lanternAlleys: { walls?: Array<{ row: string; line: string; a: number[]; b: number[] }> } }).lanternAlleys.walls ?? [];
    for (const row of LD6.rows) {
      const L = Math.hypot(row.to[0] - row.from[0], row.to[1] - row.from[1]);
      const t = [(row.to[0] - row.from[0]) / L, (row.to[1] - row.from[1]) / L];
      for (const [s0, s1] of row.skip ?? []) {
        // (from the skip's middle along the front line each way to a house box or a front wall, a hand behind the line)
        const m = (s0 + s1) / 2;
        const p = [row.from[0] + t[0] * m - row.front[0] * 0.25, row.from[1] + t[1] * m - row.front[1] * 0.25];
        const shut = (x: number, z: number) => inHouse(x, z) || W6.some((w) => w.row === row.id && w.line === "front" && Math.abs((x - w.a[0]) * row.front[0] + (z - w.a[1]) * row.front[1]) < 0.3 && (x - w.a[0]) * (w.b[0] - w.a[0]) + (z - w.a[1]) * (w.b[1] - w.a[1]) >= -1e-6 && (x - w.b[0]) * (w.a[0] - w.b[0]) + (z - w.b[1]) * (w.a[1] - w.b[1]) >= -1e-6);
        let [d0, d1] = [15, 15];
        for (let d = 0; d < 15; d += 0.05) if (shut(p[0] - t[0] * d, p[1] - t[1] * d)) { d0 = d; break; }
        for (let d = 0; d < 15; d += 0.05) if (shut(p[0] + t[0] * d, p[1] + t[1] * d)) { d1 = d; break; }
        const open = d0 + d1;
        if (open > NW6.most) (ok = false), said.push(`row ${row.id}'s cross alley ${open.toFixed(2)} m open at its front`);
        widths.push(`row ${row.id} cross ${open.toFixed(2)} m`);
      }
    }
    // 3 houses along the fence, their fronts within `fence` of it
    const fronting = HS6.filter((h) => {
      const [x0, x1, z0, z1] = boxOf6(h);
      // (the face toward the map's middle within `fence` of the fence)
      return (x1 > BR_HALF && BR_HALF - x0 <= NW6.fence) || (z0 < -BR_HALF && BR_HALF + z1 <= NW6.fence) || (x0 < -BR_HALF && BR_HALF + x1 <= NW6.fence) || (z1 > BR_HALF && BR_HALF - z0 <= NW6.fence);
    });
    if (fronting.length < NW6.edgeHouses) (ok = false), said.push(`${fronting.length} houses along the fence`);
    // 4 every gap between two houses' ground storeys along a row, outside its cross alleys, walled across at a body's height
    // on its front line, or crossed there by a link of the bots' street graph
    const SN = (map as unknown as { nodes: Array<{ x: number; z: number; y?: number; links: number[] }> }).nodes.map((n) => ({ x: n.x - BR_X, z: n.z - BR_Z, y: n.y ?? 0, links: n.links }));
    const crossing = (a: number[], b: number[]) =>
      SN.some((n) => Math.abs(n.y) < 0.6 && n.links.some((j) => {
        const m = SN[j];
        if (Math.abs(m.y) > 0.6) return false;
        const d1 = (b[0] - a[0]) * (n.z - a[1]) - (b[1] - a[1]) * (n.x - a[0]);
        const d2 = (b[0] - a[0]) * (m.z - a[1]) - (b[1] - a[1]) * (m.x - a[0]);
        const d3 = (m.x - n.x) * (a[1] - n.z) - (m.z - n.z) * (a[0] - n.x);
        const d4 = (m.x - n.x) * (b[1] - n.z) - (m.z - n.z) * (b[0] - n.x);
        return d1 * d2 < 0 && d3 * d4 < 0;
      }));
    const SD = LD6.infill?.sides ?? {};
    const gaps: string[] = [];
    let walled = 0, ways = 0;
    for (const row of LD6.rows) {
      const L = Math.hypot(row.to[0] - row.from[0], row.to[1] - row.from[1]);
      const t = [(row.to[0] - row.from[0]) / L, (row.to[1] - row.from[1]) / L];
      const at = (a: number, b: number) => [row.from[0] + t[0] * a - row.front[0] * b, row.from[1] + t[1] * a - row.front[1] * b];
      const spans = HS6.filter((h) => h.row === row.id).map((h) => {
        const a = (h.c[0] - row.from[0]) * t[0] + (h.c[1] - row.from[1]) * t[1];
        const [sx0, sx1] = SD[h.piece] ?? [0, 0];
        const ox = [Math.cos((h.yaw * Math.PI) / 180), -Math.sin((h.yaw * Math.PI) / 180)];
        const down = ox[0] * t[0] + ox[1] * t[1] > 0;
        return [a - h.hu + (down ? sx0 : sx1), a + h.hu - (down ? sx1 : sx0)];
      }).sort((p, q) => p[0] - q[0]);
      for (let k = 0; k + 1 < spans.length; k++) {
        let segs: number[][] = [[spans[k][1], spans[k + 1][0]]];
        for (const [s0, s1] of row.skip ?? []) segs = segs.flatMap(([g0, g1]) => [[g0, Math.min(g1, s0)], [Math.max(g0, s1), g1]]).filter(([g0, g1]) => g1 - g0 > 1e-6);
        for (const [g0, g1] of segs) {
          if (g1 - g0 < 0.3) continue;
          let shut = true;
          for (let a = g0 + 0.1; a <= g1 - 0.1 + 1e-6 && shut; a += 0.25) {
            const p = at(a, 0.25);
            if (!wallAt(p[0], p[1])) shut = false;
          }
          if (shut) walled++;
          else if (crossing(at(g0, 0), at(g1, 0))) ways++;
          else gaps.push(`row ${row.id} ${g0.toFixed(1)} to ${g1.toFixed(1)} m (${at((g0 + g1) / 2, 0).map((v) => v.toFixed(1)).join(", ")})`);
        }
      }
    }
    if (gaps.length) (ok = false), said.push(`${gaps.length} gaps open and no bots' way: ${gaps.slice(0, 4).join("; ")}`);
    // 5 lantern lines over every lane but the main alleys, each end in a wall at its height and its length clear; the masts
    const LL = LD6.lights.lines ?? [];
    const masts = LD6.lights.masts ?? [];
    const bad: string[] = [];
    // (an end on a house's face: in or by its box, no deeper in than face[1]; or at a mast)
    const onFace = (x: number, z: number) =>
      masts.some(([mx, mz]) => Math.hypot(mx - x, mz - z) < 0.6) ||
      HB.some(([x0, x1, z0, z1]) => {
        const d = Math.min(x - x0, x1 - x, z - z0, z1 - z);
        return d >= -NW6.face[0] && d <= NW6.face[1];
      });
    for (const [x0, z0, x1, z1, y] of LL) {
      const L = Math.hypot(x1 - x0, z1 - z0);
      const ends = solidAt(x0, y, z0) && solidAt(x1, y, z1) && onFace(x0, z0) && onFace(x1, z1);
      let clear = true;
      // (0.8 m short of each end: a mast's own arms reach 0.73 m round its pole at a line's height)
      for (let k = 0.8; k <= L - 0.8 && clear; k += 0.25) if (solidAt(x0 + ((x1 - x0) * k) / L, y, z0 + ((z1 - z0) * k) / L)) clear = false;
      if (!ends || !clear || L > 2 * NW6.reach || y < MOVE.standHeight + 1.5) bad.push(`(${x0}, ${z0}) to (${x1}, ${z1}) at ${y}: ${!ends ? "an end in the air or off a face" : !clear ? "through a wall" : "too long or low"}`);
    }
    if (bad.length) (ok = false), said.push(`${bad.length} lines: ${bad.slice(0, 3).join("; ")}`);
    // (and each one drawn: a cable of the chunk along it)
    const cab = ((cfg as unknown as { chunks: Record<string, { place: unknown[][] }> }).chunks["c-lantern"]?.place ?? []).filter((q) => String(q[0]).endsWith(`/${LD6.lights.cable}`));
    const drawn = LL.filter(([x0, z0, x1, z1, y]) => cab.some((q) => Math.abs(Number(q[2]) - y) < 0.01 && Math.abs(Number(q[8] ?? 1) * 10 - Math.hypot(x1 - x0, z1 - z0)) < 0.05)).length;
    if (drawn < LL.length) (ok = false), said.push(`${LL.length - drawn} lines not drawn`);
    const over: string[] = [];
    for (const ln of NW6.lanes.filter((q) => q.kind !== "main")) {
      const L = Math.hypot(ln.to[0] - ln.from[0], ln.to[1] - ln.from[1]);
      const t = [(ln.to[0] - ln.from[0]) / L, (ln.to[1] - ln.from[1]) / L];
      const n = LL.filter(([x0, z0, x1, z1]) => {
        const [mx, mz] = [(x0 + x1) / 2 - ln.from[0], (z0 + z1) / 2 - ln.from[1]];
        const a = mx * t[0] + mz * t[1];
        return a >= -1 && a <= L + 1 && Math.abs(-mx * t[1] + mz * t[0]) < 4;
      }).length;
      if (n < NW6.lines) (ok = false), said.push(`${ln.id} under ${n} lantern lines`);
      over.push(`${ln.id} ${n}`);
    }
    const mastSaid: string[] = [];
    for (const [x, z] of masts) {
      const n = LL.filter(([x0, z0, x1, z1]) => Math.hypot(x0 - x, z0 - z) < 0.6 || Math.hypot(x1 - x, z1 - z) < 0.6).length;
      if (!solidAt(x, 0.5, z) || !solidAt(x, 7, z) || n < NW6.mastLines) (ok = false), said.push(`the mast at (${x}, ${z}): ${solidAt(x, 7, z) ? "" : "no pole, "}${n} lines`);
      mastSaid.push(`${n}`);
    }
    if (masts.length < 4) (ok = false), said.push(`${masts.length} masts at the cross alleys' mouths`);
    said.push(`${fronting.length} houses along the fence; ${widths.join(", ")}; ${walled} gaps walled, ${ways} bots' ways, ${gaps.length} open; ${LL.length} lines (${over.join(", ")}), ${bad.length} bad; ${masts.length} masts (${mastSaid.join(", ")} lines)`);
  }
  check("LANTERN ALLEYS as alleys: its lanes walked end to end, the back lanes along the fence between two rows of houses and the cross alleys 4 to 6.5 m between house fronts, every gap between two houses walled or a bots' way, lantern lines over every alley wall to wall, a mast either side of each cross alley's mouth on the ring road", ok, said.join("; "));
}

// The base's three interiors (base5, Milestone 1064; the centre's seventeenth reviews): a straight line through no box of
// the collision, as vault4's, for the sight lines of all three
const through5 = (p: number[], q: number[]) =>
  (SOLIDS as { solids: number[][] }).solids.some((b) => {
    let [t0, t1] = [0, 1];
    for (const [a, lo, hi] of [[0, b[0], b[1]], [1, b[4], b[5]], [2, b[2], b[3]]] as Array<[number, number, number]>) {
      const d = q[a] - p[a];
      if (Math.abs(d) < 1e-9) {
        if (p[a] < lo || p[a] > hi) return false;
        continue;
      }
      const [u, v] = [(lo - p[a]) / d, (hi - p[a]) / d];
      [t0, t1] = [Math.max(t0, Math.min(u, v)), Math.min(t1, Math.max(u, v))];
      if (t0 > t1) return false;
    }
    return true;
  });
const placed5 = (ch: string) => (((cfg.chunks as unknown as Record<string, { place: unknown[][] }>)[ch]?.place ?? []) as Array<[string, number, number, number, number, string, (string | null)?, unknown?, (number | null)?]>);
type Board5 = { text: string; at: number[]; yaw: number; w: number; h: number };
type Outline5 = { name: string; rect?: number[]; posts?: boolean; frames?: number[][]; span?: number; y: number; h: number };
const boards5 = ((cfg.game as unknown as { boards?: Board5[] }).boards ?? []) as Board5[];
const outlines5 = ((cfg.game as unknown as { outlines?: Outline5[] }).outlines ?? []) as Outline5[];

// 1. The sunken court rebuilt (picture 20b, the court from its east side, both: "a pale seam runs where the floor meets the
// right wall, and the room is empty", "the ceiling texture is smeared, and a lone pole stands in an empty room"; A: "pillars,
// a raised platform or mezzanine, three cover clusters and one lit landmark piece, under a brighter ceiling"; B: "split the
// empty floor into lanes with cover, add coloured light and a loot set-piece, and fix the white seam")
{
  const S5 = (SOLIDS as { solids: number[][] }).solids;
  const K5 = cfg.court as unknown as { x0: number; x1: number; z0: number; z1: number; y: number; halls: Array<{ x0: number; x1: number; z0: number; z1: number; open?: boolean }>; cover: number[][] };
  const RC5 = cfg.rules.court as unknown as { wall: string; under: number };
  const near5 = (a: number[], b: number[]) => a.length === b.length && a.every((v, i) => Math.abs(v - b[i]) < 0.011);
  const inK5 = (x: number, z: number, g = 0) => x > K5.x0 - g && x < K5.x1 + g && z > K5.z0 - g && z < K5.z1 + g;
  // (1) its walls on its floor: each wall along its four edges (its pivot within half a metre outside one) and at a hall's
  // far end stands with its foot at or under its floor's tiles' top, `under` beneath its floor. At its floor, the slit
  // between the tiles and the wall's lower edge, which has no face under it, showed the sky: the "pale seam"
  const tile5 = K5.y - RC5.under;
  const walls5 = placed5("c-court").filter((q) => q[0].endsWith("/" + RC5.wall) && Math.abs(q[2] - K5.y) < 0.2).filter(([, x, , z]) =>
    ((z > K5.z0 - 0.5 && z <= K5.z0) || (z >= K5.z1 && z < K5.z1 + 0.5)) && x >= K5.x0 - 0.6 && x <= K5.x1 + 0.6 ||
    ((x > K5.x0 - 0.5 && x <= K5.x0) || (x >= K5.x1 && x < K5.x1 + 0.5)) && z >= K5.z0 - 0.6 && z <= K5.z1 + 0.6 ||
    K5.halls.some((h) => !h.open && ((Math.abs(z - h.z0) < 0.05 || Math.abs(z - h.z1) < 0.05) && Math.abs(z) > K5.z1 + 1 && x >= h.x0 - 0.05 && x <= h.x1 + 0.05 || (Math.abs(x - h.x0) < 0.05 || Math.abs(x - h.x1) < 0.05) && Math.abs(x) > K5.x1 + 1 && z >= h.z0 - 0.05 && z <= h.z1 + 0.05)));
  const seam5 = walls5.filter((q) => q[2] > tile5 + 0.005);
  // (2) nothing through its ceiling: each box of the court's sets (cfg.caches) and of its cover tops out no higher than the
  // first box over it above a body's height (the ceiling's slab, -4.3 to -4.0, or the plaza's over the double-height bands)
  type Cache5 = { id: string; where: string; y: number; boxes: number[][]; pieces: string[] };
  const CA5 = (((cfg as unknown as { caches?: Cache5[] }).caches ?? []) as Cache5[]).filter((s) => s.where === "court");
  const own5 = CA5.flatMap((s) => s.boxes);
  const over5 = (b: number[]) => {
    const [x0, x1, z0, z1] = [b[0] + 0.05, b[1] - 0.05, b[2] + 0.05, b[3] - 0.05];
    const up = S5.filter((q) => q[0] < x1 && q[1] > x0 && q[2] < z1 && q[3] > z0 && q[4] > K5.y + 2 && !own5.some((o) => near5(o, q)));
    return up.length ? up.reduce((m, q) => (q[4] < m[4] ? q : m)) : null;
  };
  const cover5 = K5.cover.map(([x, z, hx, hz, top]) => [x - hx, x + hx, z - hz, z + hz, K5.y, top]);
  const poke5 = [...own5, ...cover5].filter((b) => inK5((b[0] + b[1]) / 2, (b[2] + b[3]) / 2) && b[4] < K5.y + 2 && (over5(b)?.[5] ?? Infinity) < b[5] - 0.05);
  // (3) the pillars: boxes of its sets from its floor into the ceiling over them and not through it (within 5 cm of its
  // collision's bottom and top: the ceiling's collision is a box -4.3 to -4.0 under most of it, -4.0 to -3.5 over some),
  // 0.6 to 1.2 m across, in two rows and more of three and more on one line (its lanes), each lit
  const pillars5 = own5.filter((b) => {
    const c = over5(b);
    return Math.abs(b[4] - K5.y) < 0.05 && b[1] - b[0] >= 0.6 && b[1] - b[0] <= 1.2 && b[3] - b[2] >= 0.6 && b[3] - b[2] <= 1.2 && !!c && b[5] >= c[4] - 0.05 && b[5] <= c[5] + 0.05;
  });
  const rows5 = new Map<number, number>();
  for (const b of pillars5) rows5.set(Math.round(b[2] + b[3]), (rows5.get(Math.round(b[2] + b[3])) ?? 0) + 1);
  const lanes5 = [...rows5.values()].filter((n) => n >= 3).length;
  // (each lit up its corners and along its top: a frame of the outlines, two posts and a lintel, on two opposite faces)
  const frames5 = outlines5.flatMap((o) => (o.frames ?? []).map(([x, z, yaw, y, top, span]) => ({ x, z, yaw, y, top: top ?? o.h, span: span ?? o.span ?? 2 })));
  const litPillars5 = pillars5.filter((b) => frames5.filter((f) => Math.abs(f.x - (b[0] + b[1]) / 2) < 0.05 && (Math.abs(f.z - b[2]) < 0.05 || Math.abs(f.z - b[3]) < 0.05) && Math.round(f.yaw / 90) % 2 === 0 && Math.abs(f.y - b[4]) < 0.05 && f.top >= b[5] - b[4] - 0.05 && Math.abs(f.span - (b[1] - b[0])) < 0.05).length >= 2).length;
  // (4) a raised platform: a box of its sets on its floor 0.35 m to a step high and 8 m2 and more, its edge lit (an outline
  // along it at its top), walked onto by a player's own movement from the floor 1.5 m before its front; on it two chests
  // and more with their lids lit (rules.dress.caches.mats.CHEST: the loot set-piece)
  const D5 = own5.find((b) => Math.abs(b[4] - K5.y) < 0.05 && b[5] - b[4] >= 0.35 && b[5] - b[4] <= MOVE.stepHeight && (b[1] - b[0]) * (b[3] - b[2]) >= 8);
  let onto5 = { k: 0, x: 0, z: 0, y: 0 };
  let chests5 = 0;
  let edge5 = false;
  if (D5) {
    const mx = (D5[0] + D5[1]) / 2;
    // (its front the long side away from its wall)
    const s = D5[2] - K5.z0 < K5.z1 - D5[3] ? 1 : -1;
    const f = s > 0 ? D5[3] : D5[2];
    onto5 = along([[mx, f + s * 1.5, K5.y], [mx, f - s * 0.5, D5[5]], [mx, f - s * 0.7, D5[5]]]);
    chests5 = placed5("c-dress").filter((q) => /\/Crate01b Variant\.prefab$/.test(q[0]) && /LightWall03_02=Light06/.test(String(q[6] ?? "")) && q[1] > D5[0] - 0.8 && q[1] < D5[1] + 0.8 && q[3] > D5[2] - 0.8 && q[3] < D5[3] + 0.8 && Math.abs(q[2] - D5[5]) < 0.05).length;
    edge5 = outlines5.some((o) => !o.posts && o.rect && [0, 1, 2, 3].every((i) => Math.abs(o.rect![i] - D5[i]) < 0.25) && Math.abs(o.y - D5[5]) < 0.05);
  }
  // (5) lit panels under its ceiling: the pack's ceiling panels (Lighting_Deco007, b, c) in the court hung with their tops
  // within 3 cm under the ceiling over them, each in a tinted light ("^#"), two colours and more, each with a pool of
  // light (game.pools.spots) on the floor under its middle; six and more
  const panels5 = placed5("c-dress").filter((q) => /\/Lighting_Deco007[bc]?\.prefab$/.test(q[0]) && inK5(q[1], q[3]) && q[2] < K5.y + 3.5);
  const spots5 = (cfg.game as unknown as { pools: { spots: number[][] } }).pools.spots;
  // (the ceiling's underside over it: its collision box's top where that box hangs under the drawn ceiling, -4.3 to -4.0,
  // its bottom where it sits on it, -4.0 to -3.5)
  const hung5 = panels5.filter((q) => {
    const c = over5([q[1] - 0.3, q[1] + 0.3, q[3] - 0.3, q[3] + 0.3, q[2] - 0.3, q[2]]);
    const u = c ? (c[4] < q[2] - 0.05 ? c[5] : c[4]) : Infinity;
    return q[2] <= u + 0.005 && q[2] >= u - 0.03;
  }).length;
  const tints5 = panels5.map((q) => (String(q[6] ?? "").match(/\^(#[0-9a-fA-F]{6})/) ?? [])[1]);
  const colours5 = new Set(tints5.filter(Boolean)).size;
  const pooled5 = panels5.filter((q) => spots5.some((p) => Math.abs(p[1] - K5.y) < 0.1 && Math.hypot(p[0] - q[1], p[2] - q[3]) < 1.5)).length;
  // (6) its landmark: a lit board in the court over the platform, its middle and the platform's front seen from picture
  // 20b's eye (the review's spot, (-6.5, -5.3, -1.0)): the line to each through no box
  const eye5 = [-6.5, -5.3, -1.0];
  const B5 = boards5.find((q) => q.text && !!D5 && inK5(q.at[0], q.at[2], 0.1) && q.at[0] > D5[0] && q.at[0] < D5[1] && q.at[1] > D5[5] + 1);
  const seen5 = !!B5 && !!D5 && !through5(eye5, [B5.at[0], B5.at[1], B5.at[2] + 0.1]) && !through5(eye5, [(D5[0] + D5[1]) / 2, D5[5] + 0.3, D5[3] + 0.3]);
  // (7) three cover clusters and more: its cover and its sets' stacks 1.4 m and more over its floor
  const clusters5 = cover5.filter((b) => b[5] - K5.y >= 1.4).length + CA5.filter((s) => s.boxes.some((b) => b[5] - K5.y >= 1.4 && b[5] - K5.y < 2.9)).length;
  const ok5 = walls5.length >= 20 && seam5.length === 0 && poke5.length === 0 && pillars5.length >= 6 && lanes5 >= 2 && litPillars5 === pillars5.length && !!D5 && edge5 && onto5.k === 3 && Math.abs(onto5.y - D5[5]) < 0.1 && chests5 >= 2 && panels5.length >= 6 && hung5 === panels5.length && tints5.every(Boolean) && colours5 >= 2 && pooled5 === panels5.length && seen5 && clusters5 >= 3;
  check(
    "the sunken court rebuilt: its walls on its floor (no seam), nothing through its ceiling, lit pillars floor to ceiling in rows, a raised platform walked onto with lit chests on it and its edge lit, its sign seen from picture 20b, coloured panels under the ceiling each with its pool, three cover clusters",
    ok5,
    `${walls5.length} walls, ${seam5.length} over the tiles${seam5.length ? ` (${seam5.slice(0, 2).map((q) => `(${q[1]}, ${q[3]}) at ${q[2]}`).join("; ")})` : ""}; ${poke5.length} through the ceiling${poke5.length ? ` (${poke5.slice(0, 2).map((b) => `(${((b[0] + b[1]) / 2).toFixed(1)}, ${((b[2] + b[3]) / 2).toFixed(1)}) to ${b[5].toFixed(2)}`).join("; ")})` : ""}; ${pillars5.length} pillars in ${lanes5} rows, ${litPillars5} lit; platform ${D5 ? `${D5.map((v) => v.toFixed(2)).join(",")}, edge lit ${edge5}, walked onto ${onto5.k - 1} of 2 legs at ${onto5.y.toFixed(2)} m, ${chests5} lit chests` : "none"}; ${panels5.length} panels, ${hung5} hung, ${colours5} colours, ${pooled5} pooled; sign ${B5?.text ?? "none"}, seen from 20b ${seen5}; ${clusters5} clusters`
  );
}

// 2. The atrium under a designed ceiling (Milestone 1083; the centre's nineteenth reviews, picture 29, both, three rounds
// running: "a black dome half over the T skylight", "the T skylight with a black dome, a mis-cut hole"; B: "a square atrium with
// galleries for the T-shaped hole and its black dome"). The void stands under the tower and the dome is the tower's 13.5 m round
// balcony seen from under it, so no sky can be had there: Milestone 1064's T (the roof's band joined by its cut, "open the atrium
// to the sky") is closed, the void's ceiling a coffer its own size, its field lit, a ring of light round its frame's outer and
// inner edges, THE LOBBY hung in it on four faces, each gallery's edge lit. Milestone 1064's lanterns and THE LOBBY on the void's
// edge are checked as they were
{
  const S6 = (SOLIDS as { solids: number[][] }).solids;
  type Coffer6 = { y: number; rect: number[]; under: number; frame: number[]; sign: number[] };
  const AT6 = (cfg.rules.base as unknown as { atrium: { slabs: Array<{ y: number; at: number[][]; rails: number[][] }>; coffer?: Coffer6 } }).atrium;
  const CL6 = (cfg.rules.base as unknown as { clad?: Array<{ name: string; mat: string; boxes: number[][] }> }).clad ?? [];
  const clad6 = (name: string) => CL6.filter((q) => q.name === name).flatMap((q) => q.boxes.map((b) => ({ mat: q.mat, b })));
  const V6 = AT6.slabs.find((q) => q.y === 3.5)!.at[0];
  const CO6 = AT6.coffer;
  const said6: string[] = [];
  let coffered6 = false;
  if (CO6) {
    const [x0, x1, z0, z1] = CO6.rect;
    // (1) the roof whole over the void: no hole of the roof's storey in the atrium's slabs, and over every half-metre cell of the
    // first floor's hole (each a centimetre off the cells' lines) a line straight up from over the second floor (7.5 m) meets the
    // roof's slab, a layer under a metre thick topping out at the roof's height
    const roofHoles = AT6.slabs.filter((q) => q.y === CO6.y).length;
    let cells = 0, roofed = 0;
    for (let x = V6[0] + 0.26; x < V6[1]; x += 0.5)
      for (let z = V6[2] + 0.26; z < V6[3]; z += 0.5) {
        cells++;
        if (S6.some((b) => x >= b[0] && x <= b[1] && z >= b[2] && z <= b[3] && b[5] > 7.5 && Math.abs(b[5] - CO6.y) < 0.1 && b[5] - b[4] < 1)) roofed++;
      }
    // (2) the coffer's frame: a box along each of the void's four edges, its outer face on the edge and the edge's whole length,
    // `frame[0]` wide, from `frame[1]` or lower up to the roof's underside or over
    const [fw, fb] = CO6.frame;
    const frame = clad6("coffer frame").map((q) => q.b);
    const sides = [[x0, x1, z0, z0 + fw], [x0, x1, z1 - fw, z1], [x0, x0 + fw, z0 + fw, z1 - fw], [x1 - fw, x1, z0 + fw, z1 - fw]];
    const framed = sides.filter(([a0, a1, c0, c1]) => frame.some((b) => Math.abs(b[0] - a0) < 0.05 && Math.abs(b[1] - a1) < 0.05 && Math.abs(b[4] - c0) < 0.05 && Math.abs(b[5] - c1) < 0.05 && b[2] <= fb + 0.01 && b[3] >= CO6.under)).length;
    // (3) its field lit: the pack's lit panels hung with their tops (their pivots) within 2 cm under the underside, their middles
    // in the field
    const field = [x0 + fw, x1 - fw, z0 + fw, z1 - fw];
    const panels = Object.values(cfg.chunks as unknown as Record<string, { place: unknown[][] }>).flatMap((ch) => ch.place as Array<[string, number, number, number]>).filter((q) => /\/Lighting_Deco007[bc]?\.prefab$/.test(q[0]) && q[2] <= CO6.under && q[2] >= CO6.under - 0.02 && q[1] > field[0] && q[1] < field[1] && q[3] > field[2] && q[3] < field[3]).length;
    // (4) a ring of light round the frame's outer edge and round its inner one: along each of their eight sides a lit strip (a
    // glow, "|#") within 0.1 m of it over 90% of its length and more, its top at the frame's foot
    const lit = clad6("coffer rings").filter((q) => /\|#/.test(q.mat)).map((q) => q.b);
    const along = (b: number[], [ax, az, bx, bz]: number[], g: number) =>
      Math.abs(az - bz) < 1e-6
        ? Math.abs((b[4] + b[5]) / 2 - az) < g && Math.min(b[1], Math.max(ax, bx)) - Math.max(b[0], Math.min(ax, bx)) >= 0.9 * Math.abs(bx - ax)
        : Math.abs((b[0] + b[1]) / 2 - ax) < g && Math.min(b[5], Math.max(az, bz)) - Math.max(b[4], Math.min(az, bz)) >= 0.9 * Math.abs(bz - az);
    const edges = [[x0, z0, x1, z0], [x0, z1, x1, z1], [x0, z0, x0, z1], [x1, z0, x1, z1], [field[0], field[2], field[1], field[2]], [field[0], field[3], field[1], field[3]], [field[0], field[2], field[0], field[3]], [field[1], field[2], field[1], field[3]]];
    const ringed = edges.filter((e) => lit.some((b) => along(b, e, 0.1) && Math.abs(b[3] - fb) < 0.01)).length;
    // (5) THE LOBBY hung: four boards facing the four ways, each within 5 cm of a face of the sign's dark box and its middle over
    // 4 m inside the void, the box drawn and hung by two rods and more from its top to the roof's underside, each face seen from
    // a standing eye on the first floor or the second 2 m back from the void's edge it faces, or on the ground under the void 2 m
    // out from it: the line to its middle (a decimetre out) through no box
    const sg = CO6.sign;
    const dark = clad6("sign").map((q) => q.b);
    const boxed = dark.some((b) => b.every((v, i) => Math.abs(v - sg[i]) < 0.01));
    const rods = dark.filter((b) => b[0] >= sg[0] && b[1] <= sg[1] && b[4] >= sg[4] && b[5] <= sg[5] && Math.abs(b[2] - sg[3]) < 0.01 && b[3] >= CO6.under).length;
    // (its underside lit: a glow under its foot, within 2 cm of it, over half its plan and more, as picture 29's eye sees it)
    const litUnder = clad6("sign underside").some((q) => /\|#/.test(q.mat) && q.b[3] <= sg[2] && q.b[3] >= sg[2] - 0.02 && (q.b[1] - q.b[0]) * (q.b[5] - q.b[4]) >= 0.5 * (sg[1] - sg[0]) * (sg[5] - sg[4]));
    const hung = boards5.filter((q) => q.text === "THE LOBBY" && q.at[1] - q.h / 2 >= 4 && q.at[0] > x0 && q.at[0] < x1 && q.at[2] > z0 && q.at[2] < z1);
    const facing = (q: Board5) => {
      const k = (((Math.round(q.yaw / 90) % 4) + 4) % 4);
      // (0 south, its face at the box's z1; 1 east, x1; 2 north, z0; 3 west, x0)
      return [Math.abs(q.at[2] - sg[5]) < 0.05, Math.abs(q.at[0] - sg[1]) < 0.05, Math.abs(q.at[2] - sg[4]) < 0.05, Math.abs(q.at[0] - sg[0]) < 0.05][k] ? k : -1;
    };
    const ways = new Set(hung.map(facing).filter((k) => k >= 0));
    const seenHung = hung.filter((q) => {
      const [nx, nz] = [Math.round(Math.sin((q.yaw * Math.PI) / 180)), Math.round(Math.cos((q.yaw * Math.PI) / 180))];
      const mid = [q.at[0] + nx * 0.1, q.at[1], q.at[2] + nz * 0.1];
      const edgeX = nx > 0 ? x1 : nx < 0 ? x0 : q.at[0];
      const edgeZ = nz > 0 ? z1 : nz < 0 ? z0 : q.at[2];
      const eyes = [[edgeX + nx * 2, 3.5 + 1.7, edgeZ + nz * 2], [edgeX + nx * 2, 7 + 1.7, edgeZ + nz * 2], [q.at[0] + nx * 2, 1.7, q.at[2] + nz * 2]];
      return eyes.some((e) => !through5(e, mid));
    }).length;
    // (6) each gallery's edge lit: along each rail of the first floor's and the second's holes a lit strip within 0.12 m of it in
    // plan over 90% of it and more, its top within 0.15 m under the floor's top
    const strips = clad6("gallery strips").filter((q) => /\|#/.test(q.mat)).map((q) => q.b);
    const rails = AT6.slabs.filter((q) => q.y < CO6.y).flatMap((q) => q.rails.map((r) => ({ y: q.y, r })));
    const litRails = rails.filter(({ y, r }) => strips.some((b) => b[3] <= y && b[3] >= y - 0.15 && along(b, r, 0.12))).length;
    // (7) no ceiling lamp of the storey under the roof (the pack's, 3.14 m along z) over the void
    const lamps = placed5("c-base").filter((q) => /\/Lighting_Deco006\.prefab$/.test(q[0]) && Math.abs(q[2] - (CO6.under - 0.02)) < 0.1 && q[1] + 0.41 > x0 && q[1] - 0.41 < x1 && q[3] + 1.57 > z0 && q[3] - 1.57 < z1).length;
    coffered6 = roofHoles === 0 && cells >= 150 && roofed === cells && framed === 4 && panels >= 2 && ringed === 8 && boxed && rods >= 2 && litUnder && hung.length === 4 && ways.size === 4 && seenHung === 4 && rails.length >= 8 && litRails === rails.length && lamps === 0;
    said6.push(`roof holes ${roofHoles}, ${roofed} of ${cells} cells over the void roofed; frame ${framed} of 4 sides, ${panels} lit panels in its field, ${ringed} of 8 ring sides lit; THE LOBBY hung: box ${boxed}, ${rods} rods, underside lit ${litUnder}, ${hung.length} faces facing ${ways.size} ways, ${seenHung} seen; ${litRails} of ${rails.length} gallery edges lit; ${lamps} lamps over the void`);
  } else said6.push("no coffer");
  // (8) the stalls' lanterns hung from the ceiling: each one's top (its pivot) within 2 cm under the ceiling over it, its foot
  // (1.396 m at its scale) over a standing body
  const lanterns6 = placed5("c-base").filter((q) => /\/ChineseLamp00 Variant\.prefab$/.test(q[0]) && q[2] < 3.5);
  // (the ceiling: the top of the first box over it, the slab's lower layer, whose top is its underside: 3.0 m, the 3.5 m
  // slab's collision two layers, 2.7 to 3.0 and 3.2 to 3.5)
  const loose6 = lanterns6.filter((q) => {
    const up = S6.filter((b) => q[1] > b[0] && q[1] < b[1] && q[3] > b[2] && q[3] < b[3] && b[4] > q[2] - 0.5 && b[5] >= q[2] - 0.01);
    const c = up.length ? Math.min(...up.map((b) => b[5])) : Infinity;
    return !(c - q[2] <= 0.02) || q[2] - 1.396 * (q[8] ?? 1) < MOVE.standHeight + 0.05;
  });
  // (9) THE LOBBY, the base's name, on the void's edge: a board each way back to back on the first floor's hole's edge (within
  // 0.1 m of its line, the two faces within 0.1 m and turned 180 degrees), from over a standing body to the slab's top at the
  // most, each face seen from the hall's floor: a standing eye 15 m out along it (8 m on the west, where the base's face is 15 m
  // off), the line to its lower half's middle through no box (the faces hung in the void are (5)'s; those on the base's four
  // faces over its roof, Milestone 1081's, are the facade check's)
  const lobby6 = boards5.filter((q) => q.text === "THE LOBBY" && q.at[1] + q.h / 2 <= 3.5);
  const pair6 = lobby6.some((a) => lobby6.some((b) => b !== a && Math.abs(Math.abs(a.yaw - b.yaw) - 180) < 1 && Math.hypot(a.at[0] - b.at[0], a.at[2] - b.at[2]) < 0.1));
  const placed6 = lobby6.filter((q) => (Math.abs(q.at[0] - V6[0]) < 0.1 || Math.abs(q.at[0] - V6[1]) < 0.1) && q.at[2] - q.w / 2 > V6[2] && q.at[2] + q.w / 2 < V6[3] && q.at[1] - q.h / 2 >= MOVE.standHeight + 0.05).length;
  const seen6 = lobby6.filter((q) => {
    const [nx, nz] = [Math.sin((q.yaw * Math.PI) / 180), Math.cos((q.yaw * Math.PI) / 180)];
    const d = nx < -0.5 ? 8 : 15;
    return !through5([q.at[0] + nx * d, 1.7, q.at[2] + nz * d], [q.at[0] + nx * 0.1, q.at[1] - q.h / 4, q.at[2] + nz * 0.1]);
  }).length;
  const ok6 = coffered6 && lanterns6.length >= 6 && loose6.length === 0 && pair6 && lobby6.length >= 2 && placed6 === lobby6.length && seen6 === lobby6.length;
  check(
    "the atrium under a designed ceiling: the roof whole over the void, a coffer its size with a lit field and a ring of light round it, THE LOBBY hung in it on four faces, each gallery's edge lit, no lamp in it; the stalls' lanterns hung, THE LOBBY both ways on its edge and seen from the hall",
    ok6,
    `${said6.join("; ")}; ${loose6.length} of ${lanterns6.length} lanterns not hung${loose6.length ? ` (${loose6.slice(0, 2).map((q) => `(${q[1]}, ${q[3]}) at ${q[2]}`).join("; ")})` : ""}; THE LOBBY on the edge ${lobby6.length} faces, a pair ${pair6}, ${placed6} on the edge, ${seen6} seen from the hall`
  );
}

// 3. THE WELL legible (picture 19, both: "you cannot tell how deep the shaft is or where you can land", "too dark, a small
// crate seems to hang on a beam mid-shaft"; A: "a lit floor at the bottom, stepped platforms on the way down, a sign on the
// rim"; B: "light the shaft's depth in stages and make the landing platforms readable"; round 16 both: "the Well's bottom
// black")
{
  const W7 = cfg.well as unknown as { hole: number[]; bottom: number; levels: number[]; ropes: Array<{ rope: number[][] }> };
  const RW7 = cfg.rules.well as unknown as { bottom: { piece: string; sink: number; mat?: string } };
  const [hx0, hx1, hz0, hz1] = W7.hole;
  // (1) its bottom lit: every tile of it worn in rules.well.bottom.mat, a glow ("~#" its own map lit, or "|#" flat)
  const tiles7 = placed5("c-well").filter((q) => q[0].endsWith("/" + RW7.bottom.piece));
  const worn7 = tiles7.filter((q) => !!RW7.bottom.mat && q[6] === RW7.bottom.mat).length;
  const glow7 = /~#|\|#/.test(RW7.bottom.mat ?? "");
  // (2) where you land: a lit square (an outline) on its tiles' top, 4 m across and more, inside the hole, a metre and more
  // off the rope's foot
  const top7 = W7.bottom - RW7.bottom.sink;
  const rope7 = W7.ropes[0].rope[0];
  const land7 = outlines5.filter((o) => !o.posts && o.rect && Math.abs(o.y - top7) < 0.03 && o.rect[1] - o.rect[0] >= 4 && o.rect[3] - o.rect[2] >= 4 && o.rect[0] >= hx0 && o.rect[1] <= hx1 && o.rect[2] >= hz0 && o.rect[3] <= hz1 && !(rope7[0] > o.rect[0] - 1 && rope7[0] < o.rect[1] + 1 && rope7[2] > o.rect[2] - 1 && rope7[2] < o.rect[3] + 1)).length;
  // (3) THE WELL on its rim: on a face of the shaft (its middle within 0.1 m of the hole's edge, turned into it), between
  // the street and the first gallery
  const face7 = (q: Board5) => q.at[0] > hx0 && q.at[0] < hx1 && ((Math.abs(q.at[2] - hz1) < 0.1 && Math.abs(Math.abs(q.yaw) - 180) < 1) || (Math.abs(q.at[2] - hz0) < 0.1 && Math.abs(q.yaw) < 1));
  const sign7 = boards5.filter((q) => q.text === "THE WELL" && face7(q) && q.at[1] + q.h / 2 <= W7.levels[0] && q.at[1] - q.h / 2 >= W7.levels[1]).length;
  // (4) its depth in stages: at each gallery over its bottom a lit strip on two faces and more (Milestone 885's)
  const stages7 = W7.levels.slice(1, -1).map((y) => boards5.filter((q) => !q.text && face7(q) && q.at[1] <= y && q.at[1] >= y - 0.5).length);
  // (5) its cache stands on the bottom's lit floor (vault4's chest and stack against its south wall)
  type Cache7 = { where: string; boxes: number[][] };
  const cache7 = (((cfg as unknown as { caches?: Cache7[] }).caches ?? []) as Cache7[]).filter((s) => s.where === "well").flatMap((s) => s.boxes).filter((b) => Math.abs(b[4] - W7.bottom) < 0.05).length;
  const ok7 = tiles7.length >= 30 && worn7 === tiles7.length && glow7 && land7 >= 1 && sign7 >= 1 && stages7.every((n) => n >= 2) && cache7 >= 2;
  check(
    "THE WELL legible: its bottom's tiles lit, a lit landing square on them clear of the rope's foot, THE WELL on its rim, its galleries' strips in stages, its cache standing on the lit floor",
    ok7,
    `${worn7} of ${tiles7.length} bottom tiles worn lit (${RW7.bottom.mat ?? "no mat"}); ${land7} landing squares; ${sign7} rim signs; strips at the galleries ${stages7.join("/")}; ${cache7} cache boxes on the bottom`
  );
}

// THE STACKS and GLASS HEIGHTS, the two weakest districts (Milestone 1067; the districts' eleventh reviews of version 133,
// 2026-11-05: THE STACKS 6 and 5.7, "fill the empty paving with rows of cars and kiosk stalls, the lone central crate out",
// "two or three head-high clusters per field", "the thin beige grate box in the middle of d10", "the kiosk's CAP... sign
// hidden behind a tan slab", "pink trims under the tower capsules", "a small box with a helmet-like icon"; GLASS HEIGHTS 6
// and 5.9, "the frosted panels look like floating blank cards", "tinted frosted glass with bevelled frames, in L shapes with
// benches or planters", "sets that sit on bases", "the lift shaft frame bands, one object", "a stray black object", "a tall
// white plinth in the way to the lift", "the name on a dark translucent panel hovering")
{
  type Post7 = { id: string; d: string; at: number[]; parts: unknown[][] };
  type Laid7 = { id: string; d: string; box: number[]; top: number; parts: number };
  const { outlineBoxes } = await import("../../src/game/outlines");
  const DC7 = cfg.rules.dress.districtCover as unknown as { posts?: Post7[]; pieces: Record<string, string[]> };
  const PO7 = DC7.posts ?? [];
  const LP7 = (cfg as unknown as { posts?: Laid7[] }).posts ?? [];
  const DV7 = (cfg as unknown as { districtCover?: Array<{ piece: string; d?: string; set?: number | null; post?: string }> }).districtCover ?? [];
  const CH7 = (cfg as unknown as { chunks: Record<string, { place: unknown[][] }> }).chunks;
  const S7 = (SOLIDS as { solids: number[][] }).solids;
  const G7 = cfg.game as unknown as { boards: Array<{ text: string; at: number[]; yaw: number; w: number; h: number }>; outlines: Array<{ name: string; colour: string }> };
  const remap7 = (s: unknown) => new Map(String(s ?? "").split(";").filter((p) => p.includes("=")).map((p) => p.split("=") as [string, string]));
  // (a line between two map-local points, [x, y, z], clear of every box but the last `stop` metres)
  const clear7 = (a: number[], b: number[], stop = 0.3) => {
    const L = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    for (let k = 0.2; k < L - stop; k += 0.1) {
      const f = k / L;
      const [x, y, z] = [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
      if (solidsIn(x + BR_X - 0.01, x + BR_X + 0.01, z + BR_Z - 0.01, z + BR_Z + 0.01).some((q: { minX: number; maxX: number; minZ: number; maxZ: number; base: number; top: number }) => q.minX <= x + BR_X && q.maxX >= x + BR_X && q.minZ <= z + BR_Z && q.maxZ >= z + BR_Z && q.base < y && q.top > y)) return false;
    }
    return true;
  };

  // THE STACKS: no louvred box in its fill, alone or in a row; a raised planter at its avenue's mouth, its strips pink;
  // two head-high clusters and a stall in its court besides the kiosk, no metro bench there; the kiosk's sign read whole
  // from the court's open corner; pink strips under the tower's capsules, each against a capsule's underside; no boxed
  // helmet icon on the hotel's roof
  const lone7 = DV7.filter((q) => q.d === "stacks" && !q.post && q.piece === "Coolbox01.prefab").length;
  const singles7 = (DC7.pieces.stacks ?? []).includes("Coolbox01.prefab");
  const mouth7 = LP7.filter((l) => l.d === "stacks" && l.box[0] > -80 && l.box[1] < -74 && l.box[2] > -112 && l.box[3] < -104);
  const pinkBeds7 = mouth7.some((l) => (PO7.find((p) => p.id === l.id)?.parts ?? []).some((p) => /Light06\|#ff4fd8/i.test(String(p[7] ?? ""))));
  const court7 = LP7.filter((l) => l.d === "stacks" && l.box[0] > -140 && l.box[1] < -101 && l.box[2] > -140 && l.box[3] < -101);
  const clusters7 = court7.filter((l) => l.top <= 4.5 && l.top >= 1.4 && l.parts >= 2);
  const benches7 = (CH7["c-stacks"]?.place ?? []).filter((q) => /\/Metro_Bench00/.test(String(q[0])) && Number(q[1]) > -142 && Number(q[1]) < -105 && Number(q[3]) > -142 && Number(q[3]) < -105).length;
  const kiosk7 = LP7.find((l) => l.id === "stacks-kiosk");
  const corner7 = [-112, 1.7, -112];
  const signs7 = !kiosk7 ? [] : G7.boards.filter((b) => b.text === "CAPSULE BAR" && b.at[0] > kiosk7.box[0] - 1.5 && b.at[0] < kiosk7.box[1] + 1.5 && b.at[2] > kiosk7.box[2] - 1.5 && b.at[2] < kiosk7.box[3] + 1.5);
  const read7 = signs7.filter((b) => {
    const [ux, uz] = [Math.cos((b.yaw * Math.PI) / 180), -Math.sin((b.yaw * Math.PI) / 180)];
    const [ox, oz] = [Math.sin((b.yaw * Math.PI) / 180), Math.cos((b.yaw * Math.PI) / 180)];
    const to = [corner7[0] - b.at[0], corner7[2] - b.at[2]];
    const facing = (to[0] * ox + to[1] * oz) / Math.hypot(to[0], to[1]) > 0.5;
    return facing && [-0.45, 0, 0.45].every((t) => clear7(corner7, [b.at[0] + ux * t * b.w + ox * 0.05, b.at[1], b.at[2] + uz * t * b.w + oz * 0.05]));
  });
  const trimNames7 = G7.outlines.filter((o) => o.name.startsWith("the stacks capsule trim"));
  const trims7 = outlineBoxes((n: string) => n.startsWith("the stacks capsule trim"));
  // (each strip under a box of the tower: one whose base is within 0.25 m over the strip's top across its middle)
  const hung7 = trims7.filter((b) => S7.some((q) => q[0] < (b[0] + b[1]) / 2 && q[1] > (b[0] + b[1]) / 2 && q[2] < b[3] + 0.3 && q[3] > b[2] - 0.3 && q[4] >= b[5] - 0.05 && q[4] <= b[5] + 0.25));
  const helmet7 = (CH7["c-dress"]?.place ?? []).filter((q) => String(q[0]).endsWith("/Coolbox00b.prefab") && Number(q[1]) > -153 && Number(q[1]) < -111 && Number(q[3]) > -153 && Number(q[3]) < -111 && Number(q[2]) > 10 && Number(q[2]) < 12).length;
  check(
    "THE STACKS' fields: no lone louvred box, a pink-lit raised planter at the avenue's mouth, two head-high clusters and a stall in the court besides the kiosk, the kiosk's sign read whole from the court's open corner, pink trims under the tower's capsules, no helmet box on the hotel roof",
    lone7 === 0 && !singles7 && mouth7.length === 1 && pinkBeds7 && clusters7.length >= 3 && benches7 === 0 && read7.length >= 1 && trimNames7.length >= 8 && trimNames7.every((o) => o.colour.toLowerCase() === "#ff4fd8") && trims7.length > 0 && hung7.length === trims7.length && helmet7 === 0,
    `${lone7} louvred boxes in the fill${singles7 ? ", the louvred box a single piece" : ""}; the avenue's mouth ${mouth7.map((l) => `${l.id} ${l.top} m`).join("") || "bare"}${pinkBeds7 ? ", lit pink" : ""}; the court ${clusters7.length} clusters (${clusters7.map((l) => `${l.id} ${l.top} m`).join(", ")}), ${benches7} metro benches; the kiosk's sign read whole from the open corner ${read7.length} of ${signs7.length}; ${trimNames7.length} capsule trims, ${hung7.length} of ${trims7.length} strips under a capsule; ${helmet7} helmet boxes on the hotel roof`,
  );

  // GLASS HEIGHTS: every glass wall on its decks but two standing in a planter trough (its base) on its own middle and turn, eight
  // benches and more against them, a set an L; the walls' frames in the look's white (their
  // bevels lit by the sun) on a tinted patterned pane; its lift's shaft framed in white bands at every tier, its glass clear;
  // its name on an opaque plate inside its face's flat run, a lit frame round it; no box over a head on the looks from the
  // ring road to the lift's door; no metro bench in its court
  type GPerch = { name: string; at?: Array<[string, number, number, number]> };
  const GH7 = (cfg.rules.districts as unknown as { glass: { look: { white: string }; name: { at: number[]; w: number; h: number }; deck: { kit: Record<string, string> }; lift: { car: number[]; line?: number[][]; view?: { tall: number; eyes?: number[][]; eyeClear?: number }; shaft: { mat: string } } } }).glass;
  const LAID7 = ((cfg as unknown as { perches?: Array<{ name: string; at: number[][] }> }).perches ?? []);
  const own7 = (cfg.rules.perches as unknown as GPerch[]).filter((p) => p.name.startsWith("glass"));
  const laidAt = (name: string, x: number, z: number) => (LAID7.find((p) => p.name === name)?.at ?? []).some((q) => Math.abs(q[0] - x) < 0.03 && Math.abs(q[2] - z) < 0.03);
  const screens7 = own7.flatMap((p) => (p.at ?? []).filter((q) => /^WindowWall0[01] /.test(q[0])).map((q) => ({ p: p.name, q })));
  // (all but two: two of the twelve walls' spots take no trough, the pass refusing it by the east gangway's end and in the
  // deck's neck)
  const based7 = screens7.filter(({ p, q }) => laidAt(p, q[1], q[2]) && own7.find((o) => o.name === p)!.at!.some((t) => t[0] === "GardenPit_premade01.prefab" && Math.abs(t[1] - q[1]) < 0.03 && Math.abs(t[2] - q[2]) < 0.03 && ((t[3] - q[3]) % 180 + 180) % 180 === 0 && laidAt(p, t[1], t[2])));
  // (a bench against a screen's trough: within 1.2 m of a screen's middle, laid where its perch puts it)
  const benches7g = own7.flatMap((p) => (p.at ?? []).filter((t) => t[0] === "StreetFurniture00.prefab" && laidAt(p.name, t[1], t[2]) && (p.at ?? []).some((q) => /^WindowWall0[01] /.test(q[0]) && Math.hypot(t[1] - q[1], t[2] - q[2]) < 1.2)).map((t) => t)).length;
  const ells7 = screens7.filter(({ p, q }) => screens7.some((o) => o.p === p && o.q !== q && Math.abs(((o.q[3] - q[3]) % 180 + 180) % 180 - 90) < 1 && Math.hypot(o.q[1] - q[1], o.q[2] - q[2]) < 2.3)).length / 2;
  const wall7 = remap7(GH7.deck.kit["WindowWall01 Variant.prefab"]);
  const glassy7 = wall7.get("BareSteelScratched00") === GH7.look.white && /^Crystal\w+~#[0-9a-f]{6}\|/i.test(wall7.get("Cristal04") ?? "") && /\^#/.test(wall7.get("MetalBare01_lgt 2") ?? "");
  const shaft7 = remap7(GH7.lift.shaft.mat);
  const banded7 = shaft7.get("BareSteelScratched00") === shaft7.get("Cristal04") && /^Cristal/.test(shaft7.get("Cristal04") ?? "") && !/~#|\|#/.test(shaft7.get("Cristal04") ?? "");
  const NN7 = ((cfg as unknown as { districtNames?: Array<{ district: string; back?: string; w: number; at: number[] }> }).districtNames ?? []).find((q) => q.district === "glass");
  const opaque7 = !!NN7 && (!NN7.back || /^#|rgba?\([^)]*,\s*1(\.0+)?\s*\)$|^rgb\(/.test(NN7.back));
  // (the plate backed across its whole width: a box within 0.8 m behind each of its ends and its middle at its middle height)
  const NMg7 = GH7.name;
  const backedAll7 = [-0.45, -0.25, 0, 0.25, 0.45].every((t) => {
    const [px, pz] = [NMg7.at[0] + t * NMg7.w, NMg7.at[2]];
    for (let d = 0; d <= 0.8001; d += 0.05) if (S7.some((b) => px >= b[0] && px <= b[1] && pz - d >= b[2] && pz - d <= b[3] && b[4] < NMg7.at[1] && b[5] > NMg7.at[1])) return true;
    return false;
  });
  const frame7 = outlineBoxes((n: string) => n.startsWith("the glass heights name frame"));
  const edges7 = [NMg7.at[0] - NMg7.w / 2, NMg7.at[0] + NMg7.w / 2].filter((x) => frame7.some((b) => b[0] < x + 0.15 && b[1] > x - 0.15 && b[4] <= NMg7.at[1] - NMg7.h / 2 + 0.05 && b[5] >= NMg7.at[1] + NMg7.h / 2 - 0.05)).length;
  const topBar7 = frame7.some((b) => b[0] <= NMg7.at[0] - NMg7.w / 2 + 0.1 && b[1] >= NMg7.at[0] + NMg7.w / 2 - 0.1 && b[4] >= NMg7.at[1] + NMg7.h / 2 - 0.2);
  // (the looks from the ring road to the car's door: no box standing from the street past view.tall and wider than a pole
  // within half a metre of one, inside the band, but the car's own walls and the court's lamps; with no eyes in the rules,
  // version 133's, the look d13 was taken from)
  const VW7 = GH7.lift.view ?? { tall: 2.2 };
  const eyes7 = VW7.eyes ?? [[18, -96]];
  const door7 = (GH7.lift.line ?? [[11.4, -130]]).at(-1)!;
  const [cx7, cz7] = GH7.lift.car;
  const seg7 = (x: number, z: number, a: number[], b: number[]) => {
    const l2 = (b[0] - a[0]) ** 2 + (b[1] - a[1]) ** 2;
    const t = Math.max(0, Math.min(1, ((x - a[0]) * (b[0] - a[0]) + (z - a[1]) * (b[1] - a[1])) / l2));
    return Math.hypot(x - a[0] - (b[0] - a[0]) * t, z - a[1] - (b[1] - a[1]) * t);
  };
  const lamps7 = ((cfg.rules.districts as unknown as { glass: { ground: { lamps: { at: number[][] } } } }).glass.ground.lamps.at);
  const blockers7 = S7.filter((b) => b[4] < 0.5 && b[5] > VW7.tall && (b[1] - b[0] > 0.6 || b[3] - b[2] > 0.6) && b[2] < -101 && b[2] > -128 && b[0] < 30 && b[1] > -10 && !lamps7.some(([x, z]) => Math.abs((b[0] + b[1]) / 2 - x) < 0.8 && Math.abs((b[2] + b[3]) / 2 - z) < 0.8) && ![b[0], b[1]].every((x) => [b[2], b[3]].every((z) => Math.hypot(x - cx7, z - cz7) < 2.6)))
    .filter((b) => eyes7.some((e) => [[b[0], b[2]], [b[0], b[3]], [b[1], b[2]], [b[1], b[3]], [(b[0] + b[1]) / 2, (b[2] + b[3]) / 2]].some(([x, z]) => seg7(x, z, e, door7) < 0.5)));
  const metro7 = (CH7["c-glass"]?.place ?? []).filter((q) => /\/Metro_Bench00/.test(String(q[0]))).length;
  check(
    "GLASS HEIGHTS' sets: every deck screen but two standing in a white planter trough, eight benches and more against them, an L, white bevelled frames on a tinted patterned pane; its lift's shaft one clear glass, its frame too; its name on an opaque plate backed whole, a lit frame round it; the looks from the ring road to the lift clear; no metro bench in its court",
    screens7.length >= 12 && based7.length >= screens7.length - 2 && benches7g >= 8 && ells7 >= 1 && glassy7 && banded7 && opaque7 && backedAll7 && edges7 === 2 && topBar7 && (VW7.eyes ?? []).length >= 5 && blockers7.length === 0 && metro7 === 0,
    `${screens7.length} screens, ${based7.length} in a trough, ${benches7g} benches against them, ${ells7} L's; the walls ${glassy7 ? "white-framed on a tinted pane" : `${wall7.get("BareSteelScratched00")} on ${wall7.get("Cristal04")}`}; the shaft ${banded7 ? "one clear glass" : shaft7.get("BareSteelScratched00")}; the name ${opaque7 ? "opaque" : "see-through"}, ${backedAll7 ? "backed whole" : "its ends off its face"}, framed ${edges7} sides${topBar7 ? " and over" : ""}; ${(VW7.eyes ?? []).length} eyes, ${blockers7.length} boxes on their looks${blockers7.length ? ` (${blockers7.slice(0, 3).map((b) => `x ${b[0]} to ${b[1]}, z ${b[2]} to ${b[3]}, ${b[5]} m`).join("; ")})` : ""}; ${metro7} metro benches in the court`,
  );
}

// the seventeenth reviews' finish list (Milestone 1068): the base's and the Sky Ring's rails out of the pack's
// clover-printed glass ("the same green clover glass rail on the Sky Ring, the base roof and the court makes those levels look
// alike"; a tint keeps the print, so the glass must be another material, not CrystalPattern03 tinted), and THE TERRACES' lawn
// a lawn's green ("a flat, very bright green lawn"): its tint's green, linear, at most half, and its green at most twice its red
{
  const CH8 = (cfg as unknown as { chunks: Record<string, { place: unknown[][] }> }).chunks;
  const railsOf = (c: string) => (CH8[c]?.place ?? []).filter((q) => /\/FenceElegant00_x/.test(String(q[0])));
  const clover = (q: unknown[]) => !q[6] || !/CrystalPattern03=/.test(String(q[6])) || /CrystalPattern03=CrystalPattern/.test(String(q[6]));
  const rails8 = [...railsOf("c-base"), ...railsOf("c-skyring")];
  const printed8 = rails8.filter(clover).length;
  const lin = (h: string, i: number) => {
    const v = parseInt(h.slice(1 + 2 * i, 3 + 2 * i), 16) / 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  const lawn8 = String((cfg.rules.districts as unknown as { terraces: { top: { mat: string } } }).terraces.top.mat);
  const tint8 = /#[0-9a-f]{6}/i.exec(lawn8)?.[0] ?? "#ffffff";
  const [r8, g8] = [lin(tint8, 0), lin(tint8, 1)];
  check(
    "the seventeenth reviews' finish: the base's and the Sky Ring's rails out of the pack's clover-printed glass, THE TERRACES' lawn a lawn's green (its tint's green at most half, its green at most twice its red)",
    // (the moss's own albedo under a white tint, 0.692 red and 0.226 green linear, off Milestone 1062's measure of it at #60ff50)
    rails8.length > 300 && printed8 === 0 && g8 <= 0.5 && 0.226 * g8 <= 2 * 0.692 * r8,
    `${rails8.length} rails, ${printed8} in the clover print; the lawn ${lawn8}, its tint's green ${g8.toFixed(3)}, red ${r8.toFixed(3)}`
  );
}

// the eighteenth reviews' finish (Milestone 1070): THE WELL's name on the shaft's wall clear of the rope up the shaft, seen
// from the rim along the rope's line ("the cable runs through the W, so the sign reads THE VELL", 19, 19b): the rope's x
// outside the board's span by a body's width at least
{
  const B9 = (cfg.game as unknown as { boards: Array<{ text: string; at: number[]; yaw: number; w: number }> }).boards.filter((b) => b.text === "THE WELL" && b.at[1] < 0);
  const rope9 = (cfg as unknown as { well: { ropes: Array<{ rope: number[][] }> } }).well.ropes[0]?.rope[0];
  const clear9 = B9.map((b) => (Math.abs(Math.sin((b.yaw * Math.PI) / 180)) < 0.5 ? Math.abs(rope9[0] - b.at[0]) - b.w / 2 : Math.abs(rope9[2] - b.at[2]) - b.w / 2));
  check(
    "the eighteenth reviews' finish: THE WELL's name on its shaft's wall clear of the rope up the shaft, seen along the rope's line from the rim",
    B9.length >= 1 && !!rope9 && clear9.every((c) => c >= 0.4),
    `${B9.length} names in the shaft, the rope at x ${rope9?.[0]}; clear by ${clear9.map((c) => c.toFixed(2)).join(", ")} m`
  );
}

// the eighteenth reviews' blank faces (Milestone 1071): every map board in THE TERMINAL's halls with a second board turned
// about behind it, so its lit blank face shows nowhere ("a blank white lightbox", rounds 15 to 18); THE STACKS kiosk's windows
// are held lit by THE STACKS' check
{
  const T10 = (cfg.chunks as unknown as Record<string, { place: unknown[][] }>)["c-terminal"]?.place ?? [];
  const MP10 = (cfg.rules.districts as unknown as { terminal: { concourse: { map: string } } }).terminal.concourse.map;
  const boards10 = T10.filter((q) => String(q[0]).endsWith(`/${MP10}`));
  const PAID10 = process.env.PAID_DIR ?? "C:/Users/jwilb/Downloads/speedkills-paid";
  const cat10 = existsSync(join(PAID10, "neon", "catalogue.json")) ? (JSON.parse(readFileSync(join(PAID10, "neon", "catalogue.json"), "utf8")) as Array<{ path: string; max: number[] | null }>) : [];
  const maxZ10 = cat10.find((r) => r.path.endsWith(`/${MP10}`))?.max?.[2] ?? NaN;
  const single10 = boards10.filter((q) => {
    const a = (Number(q[4]) * Math.PI) / 180;
    const want = [Number(q[1]) + Math.sin(a) * 2 * maxZ10, Number(q[3]) + Math.cos(a) * 2 * maxZ10];
    const back = boards10.find((r) => Math.abs(Math.hypot(Number(r[1]) - want[0], Number(r[3]) - want[1])) < 0.02 && Math.abs((((Number(r[4]) - Number(q[4])) % 360) + 360) % 360 - 180) < 0.5);
    const front = boards10.find((r) => {
      const b = (Number(r[4]) * Math.PI) / 180;
      return Math.hypot(Number(r[1]) + Math.sin(b) * 2 * maxZ10 - Number(q[1]), Number(r[3]) + Math.cos(b) * 2 * maxZ10 - Number(q[3])) < 0.02 && r !== q;
    });
    return !back && !front;
  });
  check(
    "the eighteenth reviews' blank faces: every map board in THE TERMINAL's halls back to back with a second turned about, its lit blank face nowhere",
    boards10.length >= 4 && Number.isFinite(maxZ10) && single10.length === 0,
    `${boards10.length} map boards, ${single10.length} alone (the board's +z extent ${maxZ10} m)`
  );
}

// the eighteenth reviews' blank faces (Milestone 1073): THE CANYON's lines of cloth each a poster, not a flat colour ("the
// advert blocks hung over the street are plain green, grey and pink squares", d20)
{
  const CL12 = (cfg.rules.districts as unknown as { canyon: { chunk: string; market: { cloth: { panel: string; wear: string[] } } } }).canyon;
  const P12 = (cfg.chunks as unknown as Record<string, { place: unknown[][] }>)[CL12.chunk]?.place ?? [];
  const panels12 = P12.filter((q) => String(q[0]).endsWith(`/${CL12.market.cloth.panel}`));
  const plain12 = panels12.filter((q) => !/^Advert00=Advert\d/.test(String(q[6] ?? ""))).length;
  check(
    "the eighteenth reviews' blank faces: THE CANYON's hanging cloths each one of the pack's posters, none a flat colour",
    panels12.length >= 40 && plain12 === 0,
    `${panels12.length} cloths, ${plain12} a flat colour`
  );
}

// the eighteenth reviews' district mouths (Milestone 1074): the street's cover on the ring road's band in the facing district's
// materials, each piece that district dresses ("white sci-fi pods that don't fit the theme", "a blank concrete cube", d01, d22)
{
  const CO13 = (cfg.rules.dress as unknown as { cover: { chunk: string; band?: { from: number }; road: string[]; pave: string[] } }).cover;
  const DC13 = (cfg.rules.dress as unknown as { districtCover: { sectors: Record<string, string>; mats?: Record<string, Record<string, string>> } }).districtCover;
  // (and the centre's single street pieces there in the district's wear wherever it dresses its walls, Milestone 1080: the
  // white street boxes before THE TERRACES' stair)
  const centre13 = new Set([...CO13.road, ...CO13.pave]);
  const P13 = (cfg.chunks as unknown as Record<string, { place: unknown[][] }>)[CO13.chunk]?.place ?? [];
  const sec13 = (x: number, z: number) => (Math.abs(x) <= 50 ? (z < 0 ? "n" : "s") : Math.abs(z) <= 50 ? (x < 0 ? "w" : "e") : (z < 0 ? "n" : "s") + (x < 0 ? "w" : "e"));
  let dressed13 = 0;
  const bare13: string[] = [];
  for (const q of P13) {
    const [x, z] = [Number(q[1]), Number(q[3])];
    if (!CO13.band || Math.max(Math.abs(x), Math.abs(z)) < CO13.band.from) continue;
    const district = DC13.sectors[sec13(x, z)];
    const name = String(q[0]).split("/").pop()!;
    const want = DC13.mats?.[district]?.[name];
    if (centre13.has(name) && !want && Object.keys(DC13.mats?.[district] ?? {}).some((n) => n.startsWith("Wall_"))) {
      bare13.push(`${name} the centre's own wear by ${district} at (${x}, ${z})`);
      continue;
    }
    if (!want) continue;
    if (q[6] === want) dressed13++;
    else bare13.push(`${name} by ${district} at (${x}, ${z})`);
  }
  check(
    "the eighteenth reviews' district mouths: the street's cover on the ring road's band in the facing district's own materials",
    !!CO13.band && dressed13 >= 10 && bare13.length === 0,
    `band from ${CO13.band?.from ?? "none"}; ${dressed13} pieces dressed, ${bare13.length} not${bare13.length ? `: ${bare13.slice(0, 3).join("; ")}` : ""}`
  );
}

// the districts' reviews' kerb (Milestone 1079): every street kerb in the kerb's own wear, none the pack's lit metal panel (the
// districts' thirteenth reviews, both: "the ring road's kerb a black pipe with blue dots", "the black bar with blue dots")
{
  const K14 = (cfg.rules.streets as unknown as { kerb: { piece: string; mat?: string } }).kerb;
  const kerbs14 = Object.entries(cfg.chunks as unknown as Record<string, { place: unknown[][] }>)
    .filter(([id]) => id === "c-ground" || id.startsWith("ground-"))
    .flatMap(([, ch]) => ch.place)
    .filter((q) => String(q[0]).endsWith(`/${K14.piece}`));
  const lit14 = kerbs14.filter((q) => !K14.mat || q[6] !== K14.mat).length;
  check(
    "the districts' reviews' kerb: every street kerb in the kerb's own wear, none the pack's lit metal panel",
    kerbs14.length >= 1000 && !!K14.mat && !/FloorTiles04$/.test(K14.mat) && lit14 === 0,
    `${kerbs14.length} kerbs, ${lit14} in the lit panel; the wear ${K14.mat ?? "none"}`
  );
}

// THE VAULT's strongroom a room behind its round doorway (Milestone 1078; the centre's nineteenth reviews of picture 30: "make the
// strongroom read as a room: darker, differently lit space behind the round doorway", "the round doorway shows flat gold
// wall inside, so it reads as a ring on a wall", "a darker strongroom with lit racks receding behind the ring", "leading
// nowhere"; the eighteenth: "a real round hole with the strongroom visible through it", "a lit tunnel 1.5 to 2 m deep"):
// the doorway open through its wall (along its axis at its middle and half its opening over and under it, from 1 m before
// its face to 0.3 m behind its back, no box of the collision and nothing drawn); the room's back, the first thing drawn
// behind the ring along its axis, 1.5 m and more from its face; walked into over the threshold and back out by a player
// from the core's south door; its floor (`door.room`) reached from the core's door and both halls, half a square metre a
// body's middle stands on and more, and none of it with the doorway shut by a box (walked into only through it: the
// gates beside it filled); under a ceiling of its own, and darker than THE VAULT's gold, its back, both sides, floor,
// ceiling and the back of its front wall skinned in a material that is neither the floor's gold walls nor a light
{
  type Part8 = [string, number, number, number, number, number, number, string, string[]?];
  const TW8 = cfg.rules.tower as unknown as { clad?: Array<{ mat: string; boxes: number[][] }>; floors: { at: Record<string, { mat?: string; vault?: { door?: { deep?: number; inner?: number; room?: number[]; parts: Part8[] } } }> } };
  const D8 = TW8.floors.at["32"].vault?.door;
  const ring8 = D8?.parts.find((q) => q[7] === "RING" && q[5] === 90);
  const room8 = D8?.room;
  const S8 = (SOLIDS as { solids: number[][] }).solids;
  const clad8 = (TW8.clad ?? []).flatMap((c) => c.boxes.map((b) => ({ mat: c.mat, b })));
  const CO8 = (cfg.tower as unknown as { core: { box: number[]; wall: number; landing: number } }).core;
  // (a segment p to q, [x, y, z], against a box [x0, x1, y0, y1, z0, z1]: where along it it enters, or null)
  const enter8 = (p: number[], q: number[], b: number[]): number | null => {
    let [t0, t1] = [0, 1];
    for (let a = 0; a < 3; a++) {
      const [lo, hi, d] = [b[a * 2], b[a * 2 + 1], q[a] - p[a]];
      if (Math.abs(d) < 1e-9) {
        if (p[a] < lo || p[a] > hi) return null;
        continue;
      }
      const [u, v] = [(lo - p[a]) / d, (hi - p[a]) / d];
      [t0, t1] = [Math.max(t0, Math.min(u, v)), Math.min(t1, Math.max(u, v))];
      if (t0 > t1) return null;
    }
    return t0;
  };
  const solidXYZ8 = S8.filter((b) => b[1] > -16 && b[0] < 2 && b[3] > -4 && b[2] < 12 && b[5] > 31 && b[4] < 39).map((b) => [b[0], b[1], b[4], b[5], b[2], b[3]]);
  const cladXYZ8 = clad8.map(({ b }) => b);
  let said8 = "no doorway", ok8 = false;
  if (ring8) {
    const [rx, ry, rz, s] = [ring8[1], 32 + ring8[2], ring8[3], ring8[6]];
    const nr = [Math.sin((ring8[4] * Math.PI) / 180), Math.cos((ring8[4] * Math.PI) / 180)];
    // (the cap's rim, 2.186 to 2.416 m round and 0.313 m deep in its own metres, measured off the model, where the door
    // names none: version 138's did not)
    const [rIn, deep] = [((D8?.inner ?? 4.372) * s) / 2, (D8?.deep ?? 0.313) * s];
    // (d metres behind the ring's back along its axis, into the room; its face at d = -deep)
    const axis = (d: number, v = 0) => [rx - nr[0] * d, ry + v * rIn, rz - nr[1] * d];
    const open = [-0.5, 0, 0.5].every((v) => {
      // (from 1 m before its face, or from the 35 m hole's edge where that is nearer, Milestone 1095: under the gallery the
      // slab's plate stands in the collision 0.3 m below its drawn face, over the opening's upper half)
      const H8 = (TW8.floors.at as unknown as Record<string, { holes?: number[][] }>)["35"]?.holes?.[0];
      const lead8 = H8 ? Math.min(1, Math.max(0.3, Math.abs(rz + nr[1] * deep - (nr[1] < 0 ? H8[2] : H8[3])))) : 1;
      const [p, q] = [axis(-deep - lead8, v), axis(0.3, v)];
      return !solidXYZ8.some((b) => enter8(p, q, b) !== null) && !cladXYZ8.some((b) => enter8(p, q, b) !== null);
    });
    const far = axis(8);
    const hit = cladXYZ8.map((b) => enter8(axis(0.005), far, b)).filter((t): t is number => t !== null);
    const depth = hit.length ? deep + 0.005 + Math.min(...hit) * 7.995 : Infinity;
    said8 = `open through its wall ${open}; its back ${depth.toFixed(2)} m from its face; no room named behind it (its door's \`room\`)`;
    if (room8) {
      const [x0, x1, z0, z1, y0, y1] = room8;
      // (walked in: from the core's landing out of its south door, before the doorway, half a metre into the room, and out)
      const [fx, fz] = [CO8.box[0] + CO8.wall + CO8.landing / 2, CO8.box[3] + 0.65];
      const before = [rx + nr[0] * (deep + 0.85), rz + nr[1] * (deep + 0.85)];
      const into = Math.max(0, nr[1] < 0 ? z0 - rz : rz - z1) + 0.5;
      const inside = [rx - nr[0] * into, rz - nr[1] * into];
      const walk = [[fx, fz - 1.9, 32], [fx, fz, 32], [before[0], before[1], 32], [inside[0], inside[1], 32], [before[0], before[1], 32], [fx, fz, 32]];
      const w8 = along(walk);
      const walked = w8.k === walk.length && Math.abs(w8.y - 32) < 0.15;
      // (the floor round it on a grid of 0.1 m: a body's square, MOVE.radius each side, stands on the highest top under it up
      // to a step over the floor with nothing from a step to a standing body's height over it; it moves to a side cell a
      // step up or down, as the player's own feet do)
      const [G, Rb] = [0.1, MOVE.radius];
      const [X0, X1, Z0, Z1] = [Math.min(x0, fx, -12.6) - 1, Math.max(x1, -2.2) + 1, Math.min(z0, fz) - 1, z1 + 1];
      const near = solidXYZ8.filter((b) => b[1] > X0 - 1 && b[0] < X1 + 1 && b[5] > Z0 - 1 && b[4] < Z1 + 1 && b[3] > 31.5 && b[2] < 34.5);
      const [NX, NZ] = [Math.ceil((X1 - X0) / G), Math.ceil((Z1 - Z0) / G)];
      const flood = (extra: number[][]) => {
        const all = [...near, ...extra];
        const ground = new Float32Array(NX * NZ).fill(NaN);
        for (let i = 0; i < NX; i++)
          for (let j = 0; j < NZ; j++) {
            const [x, z] = [X0 + (i + 0.5) * G, Z0 + (j + 0.5) * G];
            const under = all.filter((b) => b[0] < x + Rb && b[1] > x - Rb && b[4] < z + Rb && b[5] > z - Rb);
            let g = -Infinity;
            for (const b of under) if (b[3] > 31.8 && b[3] <= 32 + MOVE.stepHeight && b[3] > g) g = b[3];
            if (g === -Infinity || !all.some((b) => x >= b[0] && x <= b[1] && z >= b[4] && z <= b[5] && b[3] > 31.8 && b[3] <= 32 + MOVE.stepHeight)) continue;
            if (under.some((b) => b[2] < g + MOVE.standHeight && b[3] > g + MOVE.stepHeight)) continue;
            ground[j * NX + i] = g;
          }
        const seen = new Uint8Array(NX * NZ);
        const todo: number[] = [];
        for (const [sx, sz] of [[fx, fz], [-12.4, 4.3], [-2.2, 4.05]]) {
          const k = Math.floor((sz - Z0) / G) * NX + Math.floor((sx - X0) / G);
          if (!Number.isNaN(ground[k]) && !seen[k]) ((seen[k] = 1), todo.push(k));
        }
        while (todo.length) {
          const k = todo.pop()!;
          const [i, j] = [k % NX, Math.floor(k / NX)];
          for (const [a, b] of [[i + 1, j], [i - 1, j], [i, j + 1], [i, j - 1]]) {
            if (a < 0 || a >= NX || b < 0 || b >= NZ) continue;
            const q = b * NX + a;
            if (seen[q] || Number.isNaN(ground[q]) || Math.abs(ground[q] - ground[k]) > MOVE.stepHeight) continue;
            seen[q] = 1;
            todo.push(q);
          }
        }
        let [of, got] = [0, 0];
        for (let i = 0; i < NX; i++)
          for (let j = 0; j < NZ; j++) {
            const [x, z] = [X0 + (i + 0.5) * G, Z0 + (j + 0.5) * G];
            if (x < x0 || x > x1 || z < z0 || z > z1 || Number.isNaN(ground[j * NX + i])) continue;
            of++;
            if (seen[j * NX + i]) got++;
          }
        return { of: of * G * G, got: got * G * G };
      };
      const opened = flood([]);
      // (the doorway shut: a box over its whole round, from its face to its back)
      const shutBox = [rx - Math.abs(nr[1]) * (rIn + 0.2) - Math.abs(nr[0]) * deep, rx + Math.abs(nr[1]) * (rIn + 0.2) + Math.abs(nr[0]) * deep, 32, 36, Math.min(rz, rz + nr[1] * deep) - 0.05, Math.max(rz, rz + nr[1] * deep) + 0.05];
      const shut = flood([shutBox]);
      // (skinned darker: a material that is neither the floor's gold walls nor a light, on each face of the room)
      const own8 = TW8.floors.at["32"].mat ?? "";
      const dark = clad8.filter(({ mat }) => mat !== own8 && !mat.includes("|")).map(({ b }) => b);
      const spans = (b: number[], a: number, lo: number, hi: number) => b[a * 2] <= lo + 0.2 && b[a * 2 + 1] >= hi - 0.2;
      const sides8 = (D8 as unknown as { sides?: number[][] } | undefined)?.sides ?? [];
      const jamb8 = sides8.length ? Math.max(...sides8.map((s) => s[2])) : z0;
      const slabOver8 = () => {
        for (let x = x0 + 0.25; x < x1; x += 0.5) for (let z = z0 + 0.25; z < z1; z += 0.5) if (!solidXYZ8.some((b) => x >= b[0] && x <= b[1] && z >= b[4] && z <= b[5] && b[2] <= 38.1 && b[3] >= 37.7)) return false;
        return true;
      };
      const [Y0, Y1] = [32 + y0, 32 + y1];
      const skins: Record<string, boolean> = {
        back: dark.some((b) => Math.abs(b[4] - z1) <= 0.03 && spans(b, 0, x0, x1) && spans(b, 1, Y0, Y1)),
        // (since Milestone 1095 each side skinned past its side door, `door.sides`, and a room two storeys tall under the 38 m slab:
        // the slab over every half metre of it, a box at its height, 37.7 to 38.1)
        west: dark.some((b) => Math.abs(b[1] - x0) <= 0.03 && spans(b, 2, jamb8, z1) && spans(b, 1, Y0, Y1)),
        east: dark.some((b) => Math.abs(b[0] - x1) <= 0.03 && spans(b, 2, jamb8, z1) && spans(b, 1, Y0, Y1)),
        floor: dark.some((b) => b[3] >= Y0 && b[3] <= Y0 + 0.05 && spans(b, 0, x0, x1) && spans(b, 2, z0, z1)),
        ceiling: Y1 >= 37.9 ? slabOver8() : dark.some((b) => Math.abs(b[2] - Y1) <= 0.03 && spans(b, 0, x0, x1) && spans(b, 2, z0, z1)),
        "wall's back": dark.some((b) => Math.abs(b[5] - z0) <= 0.03 && b[2] < Y1 && b[3] > Y0 && b[0] < x1 && b[1] > x0),
      };
      const bare = Object.entries(skins).filter(([, v]) => !v).map(([k]) => k);
      // (with side doors, Milestone 1095, the room is reached past the doorway shut through them; with none, not at all)
      ok8 = open && depth >= 1.5 && walked && opened.got >= 0.5 && opened.got >= 0.9 * opened.of && (sides8.length ? shut.got >= 0.9 * shut.of : shut.got === 0) && bare.length === 0;
      said8 = `open through its wall ${open}; its back ${depth.toFixed(2)} m from its face; walked in and out ${walked} (${w8.k - 1} of ${walk.length - 1} legs); ${opened.got.toFixed(2)} of ${opened.of.toFixed(2)} m2 of its floor reached, ${shut.got.toFixed(2)} with the doorway shut; skins ${bare.length ? `missing on its ${bare.join(", ")}` : "on every face"}`;
    }
  }
  check("THE VAULT's strongroom a room behind its round doorway: open through its wall, its back 1.5 m and more behind it, walked into over the threshold and out, reached through the doorway and its side doors where it names them (only the doorway where it names none), under a ceiling (its own, or the 38 m slab over a room two storeys tall) and skinned darker than the vault's gold", ok8, said8);
}
// THE VAULT's gold on shelves in the strongroom (Milestone 1078; the nineteenth reviews: "the bars on shelves inside rather than
// piled in front", "lit racks receding behind the ring; halve the gold bars", "the gold bars are slabs the size of benches";
// the eighteenth: "the bars to side racks so the path is clear"): two racks and more side by side in the room (`door.room`),
// each tier with 24 bars and more on its shelves (over its footprint, from its foot to a metre over it) and a gold lit strip
// over it within 1.6 m of its top; no rack, crate, cooler or bar between the core's face and the doorway's face within its width
// (by each one's footprint's middle, the catalogue's, as the layout lays them); the bars half Milestone 977's and less,
// their longest side 0.33 m and less (the pack's piece is 0.64 m)
{
  type Row9 = [string, number, number, number, number, number, string, string?];
  type Part9 = [string, number, number, number, number, number, number, string, string[]?];
  const V9b = (cfg.rules.tower as unknown as { floors: { at: Record<string, { vault?: { rows: Row9[]; bar: { piece: string; scale: number }; door?: { across: number; deep?: number; room?: number[]; parts: Part9[] } } }> } }).floors.at["32"].vault;
  const PAIDv = process.env.PAID_DIR ?? "C:/Users/jwilb/Downloads/speedkills-paid";
  const catv = existsSync(join(PAIDv, "neon", "catalogue.json")) ? (JSON.parse(readFileSync(join(PAIDv, "neon", "catalogue.json"), "utf8")) as Array<{ path: string; size: number[] | null; min: number[] | null; max: number[] | null }>) : [];
  const rowsv = new Map(catv.filter((r) => r.size).map((r) => [r.path.split("City Builder/")[1] ?? r.path, r]));
  const byEnd = (name: string) => [...rowsv.entries()].find(([k]) => k === name || k.endsWith(`/${name}`))?.[1];
  const plv = ((cfg as unknown as { chunks: Record<string, { place: Array<[string, number, number, number, number, string, string?, unknown?, number?]> }> }).chunks["c-tower"]?.place ?? []);
  const room9 = V9b?.door?.room;
  const ring9 = V9b?.door?.parts.find((q) => q[7] === "RING" && q[5] === 90);
  let said9 = "no doorway, or no catalogue", ok9 = false;
  if (V9b && ring9 && catv.length) {
    const turnedHalf = (name: string, yaw: number) => {
      const r = byEnd(name);
      const q = Math.round((((yaw % 360) + 360) % 360) / 90) % 2;
      return r?.size ? (q ? [r.size[2] / 2, r.size[0] / 2] : [r.size[0] / 2, r.size[2] / 2]) : [0, 0];
    };
    const bars = plv.filter((q) => q[0].endsWith(`/${V9b.bar.piece}`));
    const racks = room9 ? V9b.rows.filter((q) => /^Rack0[0-2] Variant\.prefab$/.test(q[0]) && q[1] > room9[0] && q[1] < room9[1] && q[2] > room9[2] && q[2] < room9[3]) : [];
    const lit = racks.map(([name, x, z, yaw, y]) => {
      const [hx, hz] = turnedHalf(name, yaw);
      const n = bars.filter((b) => Math.abs(b[1] - x) <= hx && Math.abs(b[3] - z) <= hz && b[2] >= 32 + y - 0.01 && b[2] <= 32 + y + 1.05).length;
      const strip = plv.some((q) => /\/Lighting_Deco00e_lgt Variant\.prefab$/.test(q[0]) && /Light06\|#ffb020/.test(q[6] ?? "") && Math.abs(q[1] - x) <= hx + 0.05 && Math.abs(q[3] - z) <= hz + 0.05 && q[2] > 32 + y + 1 && q[2] < 32 + y + 2.6);
      return { n, strip };
    });
    // (the doorway's width before it, between the core's face and the doorway's face: its footprint's middle off each
    // placement's pivot; the cap 0.313 m deep, measured, where the door names none)
    const rr = ((V9b.door!.across) * ring9[6]) / 2;
    const face = ring9[3] - (V9b.door!.deep ?? 0.313) * ring9[6];
    const coreFace = ((cfg.tower as unknown as { core: { box: number[] } }).core.box)[3];
    const pile = plv.filter((q) => {
      if (!/\/(Rack0[0-2] Variant|Crate01|Crate01b Variant|Coolbox01d Variant|ComputerCase00 Variant)\.prefab$/.test(q[0]) || q[2] < 31.9 || q[2] > 34.5) return false;
      const r = byEnd(q[0].split("/").pop()!);
      const k = q[8] ?? 1;
      const [mx, mz] = r?.min && r.max ? [((r.min[0] + r.max[0]) / 2) * k, ((r.min[2] + r.max[2]) / 2) * k] : [0, 0];
      const a = (q[4] * Math.PI) / 180;
      const [cx, cz] = [q[1] + Math.cos(a) * mx + Math.sin(a) * mz, q[3] - Math.sin(a) * mx + Math.cos(a) * mz];
      return Math.abs(cx - ring9[1]) < rr && cz > coreFace && cz < face - 0.05;
    }).length;
    const piece = byEnd(V9b.bar.piece);
    const longest = piece?.size ? Math.max(...piece.size) * V9b.bar.scale : Infinity;
    // (racks side by side, each footprint once: a rack stood on another is one rack two high)
    const units = new Set(racks.map((q) => `${q[1]},${q[2]}`)).size;
    ok9 = !!room9 && units >= 2 && lit.every((q) => q.n >= 24 && q.strip) && pile === 0 && longest <= 0.33;
    said9 = `${room9 ? `${units} racks in the room (${racks.length} tiers), bars on them ${lit.map((q) => q.n).join("/") || "none"}, ${lit.filter((q) => q.strip).length} lit` : "no room named behind the doorway (its door's `room`)"}; ${pile} racks, crates and bars before the doorway; the bars ${longest.toFixed(2)} m long`;
  }
  check("THE VAULT's gold on shelves in the strongroom: racks of bars inside, each lit by a strip, nothing piled between the core's door and the doorway, the bars half their old size", ok9, said9);
}

// The city past the fence (backdrop6, Milestone 1076; the nineteenth reviews, all four: "the road is empty and the city
// past it is untextured boxes with dot windows", "flat boxes with dot windows, some seeming to float over grey ground",
// "low-detail copies of pack buildings, or thicken the fog", "the fence's lit lines streak across the sky like red lasers")
const CH76 = cfg.chunks as unknown as Record<string, { place: Array<[string, number, number, number, number, string, (string | null)?, unknown?, number?]> }>;
const RB76 = (cfg.rules as unknown as { backdrop?: { chunk: string; from: number; to: number; most: number; props: Array<{ piece: string }>; cars?: { pieces: string[]; vans?: { pieces: string[] } } } }).backdrop;
const B76 = (cfg as unknown as { backdrop?: { chunk: string; blocks: number[][]; props: number[][]; cars: number[][]; tris: number } }).backdrop;
const placed76 = CH76[RB76?.chunk ?? "c-backdrop"]?.place ?? [];
const PAID76 = process.env.PAID_DIR ?? "C:/Users/jwilb/Downloads/speedkills-paid";
const cat76 = existsSync(join(PAID76, "neon", "catalogue.json")) ? (JSON.parse(readFileSync(join(PAID76, "neon", "catalogue.json"), "utf8")) as Array<{ path: string; tris: number; materials?: string[] }>) : [];
const row76 = new Map(cat76.map((r) => [r.path.split("City Builder/")[1] ?? r.path, r]));
const { SKYLINE: SKY76, skylineHour: hour76 } = await import("../../src/game/skyline");
// (read as maybe missing: before Milestone 1076 the skyline kept neither, and a check that throws stops every check after it)
const back76 = (SKY76 as unknown as { backdrop?: number[][] }).backdrop ?? [];
const field76 = (SKY76 as unknown as { field?: { n: number; res: number; reach: number; far: number; data: Uint8Array } | null }).field ?? null;
const ship76 = (await import("../../src/config/squad.json")).default.ship.height;
const reach76 = BR_HALF + (worldCfg as unknown as { edge: { margin: number } }).edge.margin + 2;
// (a rectangle's distance out from the map's middle as the bands are measured: the larger of its gaps across x and z)
const out76 = (b: number[]) => Math.max(Math.max(b[0], -b[1], 0), Math.max(b[2], -b[3], 0));
const rectOf76 = (t: { x: number; z: number; w: number; d: number }) => [t.x - t.w / 2, t.x + t.w / 2, t.z - t.d / 2, t.z + t.d / 2];
// (a material's shader as three builds the material's own, put through its onBeforeCompile: a replace that finds no
// anchor in three's shader changes nothing, and what it should have drawn is silently not drawn)
const compiled76 = (m: THREE.Material | undefined, lib: { vertexShader: string; fragmentShader: string }) => {
  const sh = { uniforms: {} as Record<string, { value: unknown }>, vertexShader: lib.vertexShader, fragmentShader: lib.fragmentShader, defines: {} };
  (m?.onBeforeCompile as unknown as ((s: typeof sh, r: unknown) => void) | undefined)?.call(m, sh, undefined);
  return sh;
};

// 1. Its first rows the pack's own buildings (rules.backdrop; districts A: "give its boxes storey lines, roof clutter and
// set-back silhouettes", districts B: "the outer city's first two rows: roof caps, setbacks, roof props", the centre's:
// "replace the skyline boxes with low-detail copies of pack buildings"): the pack's Decorative Modules, every one wholly
// past the out-of-bounds margin (the map's half, edge.margin and 2 m, as the towers' check) with its roof 5 m and more
// under the dropship's line, none within a metre of another, 40 and more on every side; every roof prop standing on a roof
// and inside its parapet; every piece the bundle's and drawn only; every material one the city's file draws already (the
// centre's draws stand at their limit: a material it does not have is a primitive more); their triangles within `most`; the
// game's own boxes none in their band and none within a metre of one, and its lit roads under none of them
{
  const blocks = B76?.blocks ?? [];
  const props = B76?.props ?? [];
  const near = blocks.filter((b) => out76(b) < reach76);
  const high = [...blocks.map((b) => b[4]), ...props.map((p) => p[5])].filter((y) => y > ship76 - 5).length;
  const clash: string[] = [];
  for (let i = 0; i < blocks.length; i++)
    for (let j = i + 1; j < blocks.length; j++) {
      const [a, b] = [blocks[i], blocks[j]];
      if (a[0] < b[1] + 1 && a[1] > b[0] - 1 && a[2] < b[3] + 1 && a[3] > b[2] - 1) clash.push(`(${((a[0] + a[1]) / 2).toFixed(1)}, ${((a[2] + a[3]) / 2).toFixed(1)})`);
    }
  const sides = [(b: number[]) => (b[0] + b[1]) / 2 > reach76, (b: number[]) => (b[0] + b[1]) / 2 < -reach76, (b: number[]) => (b[2] + b[3]) / 2 > reach76, (b: number[]) => (b[2] + b[3]) / 2 < -reach76].map((f) => blocks.filter(f).length);
  // (a prop on a roof: inside the roof's run either way of the block's middle, its foot on the roof)
  const loose = props.filter((p) => !blocks.some((b) => {
    const [cx, cz] = [(b[0] + b[1]) / 2, (b[2] + b[3]) / 2];
    return b[5] > 0 && p[0] >= cx - b[5] - 0.01 && p[1] <= cx + b[5] + 0.01 && p[2] >= cz - b[5] - 0.01 && p[3] <= cz + b[5] + 0.01 && Math.abs(p[4] - b[4]) < 0.01;
  }));
  const extra = new Set([...(RB76?.props ?? []).map((p) => p.piece), ...(RB76?.cars?.pieces ?? []), ...(RB76?.cars?.vans?.pieces ?? [])]);
  const foreign = placed76.filter((q) => !row76.has(q[0]) || !(/^1_Premade\/Essential\/Decorative\/Modules\/Simple\//.test(q[0]) || extra.has(q[0].split("/").pop()!)) || q[5] !== "g");
  // (each placement's materials as the bake wears them: its piece's own through its remap, rules.wear's already on its row)
  const worn = (q: unknown[]) => {
    const own = row76.get(String(q[0]))?.materials ?? [];
    const m = q[6] ? String(q[6]) : "";
    if (m && !m.includes("=")) return [m];
    const re = new Map(m ? m.split(";").map((s) => s.split("=") as [string, string]) : []);
    return own.filter((n) => n !== "none").map((n) => re.get(n) ?? n);
  };
  const others = new Set(Object.entries(CH76).filter(([k]) => k.startsWith(cfg.rules.bake.merge) && k !== (RB76?.chunk ?? "c-backdrop")).flatMap(([, ch]) => ch.place.flatMap(worn)));
  const fresh = [...new Set(placed76.flatMap(worn))].filter((n) => !others.has(n));
  const tris = placed76.reduce((a, q) => a + (row76.get(q[0])?.tris ?? 0), 0);
  const own = SKY76.towers.filter((t) => t.y === 0 && (out76(rectOf76(t)) < (RB76?.to ?? 0) || blocks.some((b) => { const r = rectOf76(t); return r[0] < b[1] + 1 && r[1] > b[0] - 1 && r[2] < b[3] + 1 && r[3] > b[2] - 1; })));
  const roads = scene.getObjectByName("skylineRoads") as THREE.InstancedMesh | undefined;
  const [m4, p3, s3, q4] = [new THREE.Matrix4(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Quaternion()];
  let under = 0;
  for (let i = 0; i < (roads?.count ?? 0); i++) {
    roads!.getMatrixAt(i, m4);
    m4.decompose(p3, q4, s3);
    if (blocks.some((b) => p3.x + s3.x / 2 > b[0] && p3.x - s3.x / 2 < b[1] && p3.z + s3.z / 2 > b[2] && p3.z - s3.z / 2 < b[3])) under++;
  }
  check(
    "the city past the fence's first rows the pack's own buildings: past the out-of-bounds margin and under the ship's line, none on another, 40 and more a side, their roof props on their roofs, the bundle's pieces drawn only in materials the city's file has, their triangles within their budget; the game's own boxes out of their band and its lit roads under none of them",
    !!B76 && !!RB76 && cat76.length > 0 && blocks.length >= 160 && near.length === 0 && high === 0 && clash.length === 0 && sides.every((n) => n >= 40) && props.length >= 100 && loose.length === 0 && foreign.length === 0 && fresh.length === 0 && tris <= RB76.most && back76.length === blocks.length && own.length === 0 && under === 0,
    !B76 ? "no backdrop laid (rules.backdrop)" : `${blocks.length} buildings (${sides.join("/")} east, west, south, north), ${near.length} within ${reach76} m, ${high} within 5 m of the ship's ${ship76} m, ${clash.length} on another${clash.length ? ` (${clash.slice(0, 2).join("; ")})` : ""}; ${props.length} roof props, ${loose.length} off their roofs; ${foreign.length} pieces not the bundle's modules and props or not drawn only${foreign.length ? ` (${foreign[0][0]})` : ""}; ${fresh.length} materials the city's file lacks${fresh.length ? ` (${fresh.slice(0, 3).join(", ")})` : ""}; ${tris} triangles of ${RB76?.most}; the game handed ${back76.length}, ${own.length} of its own boxes in their band or on one, ${under} lit road lines under one`
  );
}

// 2. The ground past the fence shaded at every block's foot and paved round it (world.json skyline.field; districts B:
// "a dark base with a contact shadow so they sit on the ground", "some seeming to float over grey ground"): the field the
// game builds holds, half a metre out from the middle of each wall of every block on the ground (the backdrop's and the
// game's towers'), a distance under `shade`, and a metre past the kerb, where no other block stands that near, a distance
// past the kerb; and the ground's shader reads it
{
  const FD = field76;
  const F = (worldCfg as unknown as { skyline: { field?: { shade: number; kerb: number } } }).skyline.field;
  const g = scene.getObjectByName("skylineGround")?.children[0] as THREE.Mesh | undefined;
  const sh = compiled76(g?.material as THREE.Material | undefined, THREE.ShaderLib.standard);
  const wired = !!sh.uniforms.uSkyField && sh.vertexShader.includes("vSkyG = transformed.xz;") && /#include <color_fragment>\s*\{\s*vec2 fuv/.test(sh.fragmentShader);
  const at = (x: number, z: number) => {
    if (!FD) return Infinity;
    const [i, j] = [Math.floor((x + FD.reach) / FD.res), Math.floor((z + FD.reach) / FD.res)];
    return i < 0 || j < 0 || i >= FD.n || j >= FD.n ? Infinity : (FD.data[j * FD.n + i] / 255) * FD.far;
  };
  const rects = [...SKY76.towers.filter((t) => t.y === 0).map(rectOf76), ...back76];
  const gap = (x: number, z: number, r: number[]) => Math.hypot(Math.max(r[0] - x, 0, x - r[1]), Math.max(r[2] - z, 0, z - r[3]));
  let walls = 0, roads = 0;
  const bare: string[] = [], unpaved: string[] = [];
  if (FD && F)
    for (const r of rects)
      for (const [mx, mz, nx, nz] of [[(r[0] + r[1]) / 2, r[2], 0, -1], [(r[0] + r[1]) / 2, r[3], 0, 1], [r[0], (r[2] + r[3]) / 2, -1, 0], [r[1], (r[2] + r[3]) / 2, 1, 0]]) {
        walls++;
        if (!(at(mx + nx * 0.5, mz + nz * 0.5) < F.shade)) bare.push(`(${mx.toFixed(1)}, ${mz.toFixed(1)})`);
        const [px, pz] = [mx + nx * (F.kerb + 1), mz + nz * (F.kerb + 1)];
        if (rects.some((o) => o !== r && gap(px, pz, o) < F.kerb + 2)) continue;
        roads++;
        if (!(at(px, pz) > F.kerb)) unpaved.push(`(${px.toFixed(1)}, ${pz.toFixed(1)})`);
      }
  check(
    "the ground past the fence shaded at every block's foot and paved round it, the backdrop's and the towers', and its shader reading the field",
    !!FD && !!F && wired && walls >= 4000 && bare.length === 0 && roads >= 1000 && unpaved.length === 0,
    !FD ? "no field (world.json skyline.field)" : `${walls - bare.length} of ${walls} wall feet shaded${bare.length ? ` (bare at ${bare.slice(0, 3).join("; ")})` : ""}, ${roads - unpaved.length} of ${roads} points past the kerb on the road${unpaved.length ? ` (paved at ${unpaved.slice(0, 3).join("; ")})` : ""}; the shader reads it ${wired}`
  );
}

// 3. The towers past them built as buildings (world.json skyline.facade; districts A: "storey lines ... set-back
// silhouettes", the whole map: "untextured boxes with dot windows"): their shader works out a slab edge at each storey, the
// glass dark in every window by day, a cap, a shop storey, a shaded foot and a roof with its coping, each replace finding
// its anchor in three's own shader; three window styles and more; their walls by day in the pack's own measured colours
// (MetalBare02 to Concrete03d, linear luminance 0.07 to 0.27) and by night no lighter than version 138's boxes were
// (#1d212b, #2b2721, #222b35, #2c2c30, #1f2622: a mean linear luminance of 0.0205); and half the setbacks and more
// stepped off their towers' middles (by day at 0.4 to the whole of the pack's colours since Milestone 1102, the fifteenth
// districts' reviews: "the outer city brighter and cleaner than the play area"; the whole until then)
{
  const sky = scene.getObjectByName("skyline") as THREE.InstancedMesh | undefined;
  const sh = compiled76(sky?.material as THREE.Material | undefined, THREE.ShaderLib.standard);
  const FA = (worldCfg as unknown as { skyline: { bodies: string[]; facade?: { styles: number[][]; share: number[]; body: { day: number; night: number } } } }).skyline;
  const marks = ["uniform float uSkyBody;", "float slab = ", "float cap = ", "float shop = ", "float rim = ", "metalnessFactor = mix(", "roughnessFactor = mix("].filter((s) => !sh.fragmentShader.includes(s));
  const anchored = /#include <metalnessmap_fragment>\s*float skWin/.test(sh.fragmentShader) && /#include <emissivemap_fragment>\s*\{\s*float h = /.test(sh.fragmentShader) && sh.vertexShader.includes("vSkyBase = instanceMatrix[3].y;");
  const lin = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((v) => (v > 0.04045 ? ((v + 0.055) / 1.055) ** 2.4 : v / 12.92));
  const lum = (h: string) => { const [r, g, b] = lin(h); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
  const L = FA.bodies.map(lum);
  hour76(true);
  const day = (sh.uniforms.uSkyBody?.value as number | undefined) ?? NaN;
  hour76(false);
  const nightK = (sh.uniforms.uSkyBody?.value as number | undefined) ?? NaN;
  const night = (L.reduce((a, b) => a + b, 0) / L.length) * nightK;
  let shifted = 0, setbacks = 0;
  SKY76.towers.forEach((t, i) => {
    if (t.y === 0 || i === 0) return;
    setbacks++;
    const b = SKY76.towers[i - 1];
    if (Math.hypot(t.x - b.x, t.z - b.z) > 0.05) shifted++;
  });
  const styles = FA.facade?.styles.length ?? 0;
  const shares = (FA.facade?.share ?? []).reduce((a, b) => a + b, 0);
  check(
    "the towers past the fence's first rows built as buildings: storey slabs, dark glass, a cap, a shop storey, a shaded foot and a coped roof in their shader, each at its anchor; three window styles; their walls by day in the pack's colours and by night no lighter than the boxes were; their setbacks stepped off their middles",
    !!FA.facade && marks.length === 0 && anchored && styles >= 3 && Math.abs(shares - 1) < 1e-6 && day >= 0.4 && day <= 1 && L.every((v) => v >= 0.07 && v <= 0.27) && night <= 0.0205 * 1.02 && setbacks > 100 && shifted >= setbacks / 2,
    `${marks.length ? `missing ${marks.join(", ")}` : "every part in the shader"}, anchored ${anchored}; ${styles} styles (shares ${shares.toFixed(2)}); walls by day ${day} at luminance ${Math.min(...L).toFixed(3)} to ${Math.max(...L).toFixed(3)}, by night ${night.toFixed(4)} (version 138's 0.0205); ${shifted} of ${setbacks} setbacks stepped`
  );
}

// 4. A few cars on the ring road past the fence (rules.backdrop.cars; districts A: "put a few vehicles on the outer ring
// road", "the outer road empty"): three and more a side, each one of the street's own cars (rules.dress.cars, in the
// materials it is drawn in already), drawn only, in one of the ring road's lanes (between two of its lines, world.json
// skyline.ring, its half width clear of each) and along it, clear of its corners, none within half a metre of another
{
  const C = B76?.cars ?? [];
  const RG = (worldCfg as unknown as { skyline: { ring?: { from: number; to: number; lines: number[][] } } }).skyline.ring;
  const RC = (cfg.rules.dress as unknown as { cars: { pieces: string[]; vans?: { pieces: string[] } } }).cars;
  const street = new Set([...RC.pieces, ...(RC.vans?.pieces ?? [])]);
  const carsPlaced = placed76.filter((q) => /\/Cars\//.test(q[0]));
  const offs = (RG?.lines ?? []).map((l) => l[0]).sort((a, b) => a - b);
  const bad: string[] = [];
  const perSide = [0, 0, 0, 0];
  C.forEach(([x, z, , side, , x0, x1, z0, z1], i) => {
    perSide[side]++;
    const alongX = side % 2 === 0;
    const out = alongX ? Math.abs(z) : Math.abs(x);
    const [len, wid] = alongX ? [x1 - x0, z1 - z0] : [z1 - z0, x1 - x0];
    const off = out - (RG?.from ?? 0);
    const inLane = offs.some((o, k) => k > 0 && off - wid / 2 >= offs[k - 1] && off + wid / 2 <= o);
    const end = (alongX ? Math.max(Math.abs(x0), Math.abs(x1)) : Math.max(Math.abs(z0), Math.abs(z1))) <= (RG?.from ?? 0);
    const apart = C.every((o, j) => j === i || o[5] > x1 + 0.5 || o[6] < x0 - 0.5 || o[7] > z1 + 0.5 || o[8] < z0 - 0.5);
    if (!inLane || len <= wid || !end || !apart) bad.push(`(${x.toFixed(1)}, ${z.toFixed(1)}): lane ${inLane}, along ${len > wid}, clear of the corners ${end}, apart ${apart}`);
  });
  const notStreet = carsPlaced.filter((q) => !street.has(q[0].split("/").pop()!) || q[5] !== "g").length;
  check(
    "a few cars on the ring road past the fence: three and more a side, the street's own, drawn only, each in a lane and along it, clear of the corners and of each other",
    !!RG && C.length >= 12 && carsPlaced.length === C.length && perSide.every((n) => n >= 3) && bad.length === 0 && notStreet === 0,
    `${C.length} cars (${perSide.join("/")} north, east, south, west), ${carsPlaced.length} placed, ${notStreet} not the street's or not drawn only${bad.length ? `; ${bad.slice(0, 2).join("; ")}` : ""}`
  );
}

// 5. The fence's lines off the city past it (world.json edge.fence far and eye; districts B, d11 and d12: "the fence's lit
// lines streak across the sky like red lasers", districts A, d12: "a red line crosses the sky at right"): its shader fades
// them a pixel at a time (its replaces anchored in three's own shader), and as fenceLight works it out: from d11's eye (the
// street, 40 m from the north and west sides, its spot (-112, -112)) no line over `far.top` is lit 40 m off and more, so
// none crosses the buildings past the fence; from d12's (a roof's 12.2 m, 2 m off the north side) none over the eye within 40 m of it; and from the
// street 5 m from the fence every line to 6 m still lit, so the fence still reads where a body walks into it
{
  const W76 = (await import("../../src/game/world")) as unknown as { fenceLight?: (y: number, d: number, eye: number) => number };
  const F = (worldCfg as unknown as { edge: { fence: { height: number; far?: { from: number; to: number; top: number }; eye?: { from: number; below: number } } } }).edge.fence;
  const fence = scene.getObjectByName("edgeFence") as THREE.Mesh | undefined;
  const sh = compiled76(fence?.material as THREE.Material | undefined, THREE.ShaderLib.basic);
  const wired = sh.vertexShader.includes("vFenceW = (modelMatrix * vec4(transformed, 1.0)).xyz;") && /#include <color_fragment>\s*\{\s*float fenceK/.test(sh.fragmentShader) && sh.fragmentShader.includes("cameraPosition");
  const fl = W76.fenceLight;
  // (points up each side's fence, every 2 m along and half a metre up, with their distance across the ground from an eye)
  const sidesPts = (e: number[]) => {
    const pts: Array<{ y: number; d: number }> = [];
    for (let t = -BR_HALF; t <= BR_HALF; t += 2)
      for (const [x, z] of [[t, -BR_HALF], [t, BR_HALF], [-BR_HALF, t], [BR_HALF, t]])
        for (let y = 0.25; y < F.height; y += 0.5) pts.push({ y, d: Math.hypot(x - e[0], z - e[2]) });
    return pts;
  };
  let farLit = 0, overLit = 0, streetDark = 0;
  if (fl && F.far && F.eye) {
    const d11 = [-112, 1.7, -112], d12 = [-115, 12.2, -150], street = [0, 1.7, -147];
    farLit = sidesPts(d11).filter((p) => p.d >= 40 && p.y >= F.far!.top + 0.5 && fl(p.y, p.d, d11[1]) > 0.02).length;
    overLit = sidesPts(d12).filter((p) => p.d <= 40 && p.y >= d12[1] - F.eye!.below && fl(p.y, p.d, d12[1]) > 0.02).length;
    streetDark = sidesPts(street).filter((p) => p.d <= 12 && p.y <= 6 && fl(p.y, p.d, street[1]) < 0.98).length;
  }
  check(
    "the fence's lines off the city past it: from d11's eye 40 m off and more only its foot band lit, none over a raised eye near it, every line to 6 m still lit from the street 5 m off, its shader fading them a pixel at a time",
    !!fl && !!F.far && !!F.eye && wired && farLit === 0 && overLit === 0 && streetDark === 0,
    !fl ? "no fenceLight in world.ts" : `from d11 ${farLit} lit points over the foot band 40 m off and more; from d12 ${overLit} lit over the eye within 40 m; from the street ${streetDark} dark within 12 m to 6 m; the shader ${wired}`
  );
}

// GLASS HEIGHTS at street level (Milestone 1077; the districts' thirteenth reviews of version 138, 2026-11-06, GLASS HEIGHTS
// 5.5 and 6.0: "lit lobbies and shop signs in the grey lower panels" (d13, d15), "white planter-and-bench sets in place of the
// cream boxes" (d13b), "the plain white blocks at its mouth as built kit, frosted planters with lit edges and benches" (d13b,
// d13), "cover round the lift's foot" (d15), "white troughs for the hazard ones, no flower box" (d14), "near-white deck tops so
// it reads from the air" (d00))
{
  const { outlineBoxes } = await import("../../src/game/outlines");
  type Gl77 = { look: { white: string }; deck: { kit: Record<string, string>; decks: Record<string, number[]> }; lift: { car: number[]; view?: { tall: number } }; buildings: Array<[string, number, number, number, string?]> };
  const G77 = (cfg.rules.districts as unknown as { glass: Gl77 }).glass;
  const W77 = G77.look.white;
  const DC77 = cfg.rules.dress.districtCover as unknown as { tall: number; sets: Record<string, Array<{ id: string; last?: boolean; parts: unknown[][] }>>; pieces: Record<string, string[]>; mats: Record<string, Record<string, string>> };
  const BAND77 = (cfg.rules.dress as unknown as { cover: { chunk: string; band?: { from: number } } }).cover;
  const CH77 = (cfg as unknown as { chunks: Record<string, { place: unknown[][] }> }).chunks;
  const S77 = (SOLIDS as { solids: number[][] }).solids.filter((b) => b[1] > -40 && b[0] < 40 && b[3] > -160 && b[2] < -85);
  const remap77 = (s: unknown) => new Map(String(s ?? "").split(";").filter((p) => p.includes("=")).map((p) => p.split("=") as [string, string]));
  const name77 = (q: unknown[]) => String(q[0]).split("/").pop()!;
  const TROUGH77 = "GardenPit_premade01.prefab", BENCH77 = "StreetFurniture00.prefab";
  // (1) its kit: every set a frosted screen standing in a trough on the screen's own middle and turn, every set but those for
  // nooks with a bench; no panel of the pack's plain walls among its sets or single pieces; each piece of its sets worn as the
  // decks' kit wears it
  const SETS77 = DC77.sets.glass ?? [];
  const built77 = SETS77.filter((s) => s.parts.some((p) => /^WindowWall0[01] /.test(String(p[0])) && s.parts.some((t) => t[0] === TROUGH77 && t[1] === p[1] && t[2] === p[2] && (((Number(t[3]) - Number(p[3])) % 180) + 180) % 180 === 0)) && (s.last || s.parts.some((p) => p[0] === BENCH77)));
  const kitNames77 = [...new Set(SETS77.flatMap((s) => s.parts.map((p) => String(p[0]))))];
  const plain77 = [...kitNames77, ...(DC77.pieces.glass ?? [])].filter((n) => n.startsWith("Wall_Simple"));
  const worn77 = kitNames77.filter((n) => DC77.mats.glass?.[n] !== G77.deck.kit[n]);
  // (2) laid: no plain wall of its kit in its fill, none of the old kit's (the 1.8 m panels, the 3 m posts) on the street's band
  // facing it; ten sets and more laid, each a screen in its trough; two low sets by the lift's foot (low under the lift's view,
  // standing cover over the fill's `tall`)
  const DV77 = ((cfg as unknown as { districtCover?: Array<{ piece: string; d?: string; set?: number }> }).districtCover ?? []).filter((q) => q.d === "glass");
  const walls77 = DV77.filter((q) => q.piece.startsWith("Wall_Simple")).length;
  const inBand77 = (q: unknown[]) => !!BAND77.band && Math.max(Math.abs(Number(q[1])), Math.abs(Number(q[3]))) >= BAND77.band.from && Math.abs(Number(q[1])) <= 50 && Number(q[3]) < 0;
  const oldKit77 = (CH77[BAND77.chunk]?.place ?? []).filter((q) => inBand77(q) && /^Wall_Simple_2Sides_/.test(name77(q)) && (/_(1x3|2\.5x3)\.prefab$/.test(name77(q)) || (q[8] !== undefined && q[8] !== null && Number(q[8]) !== 1))).length;
  const bySet77 = new Map<number, string[]>();
  for (const q of DV77) if (q.set !== undefined) (bySet77.get(q.set) ?? bySet77.set(q.set, []).get(q.set)!).push(q.piece);
  const laid77 = [...bySet77.values()].filter((ps) => ps.includes(TROUGH77) && ps.some((p) => /^WindowWall0[01] /.test(p))).length;
  const LP77 = ((cfg as unknown as { posts?: Array<{ id: string; d: string; box: number[]; top: number }> }).posts ?? []).filter((l) => l.d === "glass");
  const [cx77, cz77] = G77.lift.car;
  const foot77 = LP77.filter((l) => Math.hypot(Math.max(l.box[0] - cx77, 0, cx77 - l.box[1]), Math.max(l.box[2] - cz77, 0, cz77 - l.box[3])) < 12 && l.top >= DC77.tall && l.top <= (G77.lift.view?.tall ?? 2.2));
  // (2b) the looks from the ring road's eyes to the lift's door (`view.eyes`): no box standing from the street past the eyes' height
  // (`view.eyeTall`) and no taller than a screen, wider than a pole, within half a metre of one inside the band (the collision's
  // columns reach half a metre past a face), the car's own walls left out
  const VW77 = G77.lift.view as { tall: number; eyes?: number[][]; eyeTall?: number } | undefined;
  const door77 = ((G77.lift as unknown as { line?: number[][] }).line ?? [[11.4, -130]]).at(-1)!;
  const segd77 = (x: number, z: number, p: number[], q: number[]) => {
    const l2 = (q[0] - p[0]) ** 2 + (q[1] - p[1]) ** 2;
    const t = Math.max(0, Math.min(1, ((x - p[0]) * (q[0] - p[0]) + (z - p[1]) * (q[1] - p[1])) / l2));
    return Math.hypot(x - p[0] - (q[0] - p[0]) * t, z - p[1] - (q[1] - p[1]) * t);
  };
  const onLook77 = S77.filter((b) => b[4] < 0.5 && b[5] > (VW77?.eyeTall ?? Infinity) && b[5] <= 3.1 && (b[1] - b[0] > 0.6 || b[3] - b[2] > 0.6) && b[2] < -101 && b[2] > -128 && b[0] < 30 && b[1] > -10 && ![b[0], b[1]].every((x) => [b[2], b[3]].every((z) => Math.hypot(x - cx77, z - cz77) < 2.6)))
    .filter((b) => (VW77?.eyes ?? []).some((e) => [[b[0], b[2]], [b[0], b[3]], [b[1], b[2]], [b[1], b[3]], [(b[0] + b[1]) / 2, (b[2] + b[3]) / 2]].some(([x, z]) => segd77(x, z, e, door77) < 0.5)));
  // (3) every pit of the court and the decks and every trough of the cover white: the pack's yellow-lit cross panel round each
  // pit (Concrete_Lgt 5, the "hazard stripes") and its mossy rim (GroundDirt00) in the look's white, the band inside its rim lit
  const onDecks77 = (q: unknown[]) => Number(q[2]) > 20 && Object.values(G77.deck.decks).some((b) => Number(q[1]) > b[0] - 2 && Number(q[1]) < b[1] + 2 && Number(q[3]) > b[2] - 2 && Number(q[3]) < b[3] + 2);
  const pits77 = [...(CH77["c-glass"]?.place ?? []), ...(CH77["c-dress"]?.place ?? []).filter(onDecks77), ...[...(CH77["c-dcover"]?.place ?? []), ...(CH77[BAND77.chunk]?.place ?? [])].filter((q) => name77(q) === TROUGH77)].filter((q) => name77(q).startsWith("GardenPit"));
  const striped77 = pits77.filter((q) => {
    const m = remap77(q[6]);
    return m.get("Concrete_Lgt 5") !== W77 || m.get("GroundDirt00") !== W77 || !/^Light06\|/.test(m.get("Light01") ?? "");
  });
  // (4) no flower box: every planted pit's grass and flower cards (cut-outs the bake reads as opaque, white cards round purple
  // flowers, d14) worn as something cut out
  const cards77: Record<string, string[]> = { "GardenPit_premade00b Variant.prefab": ["ETP_Plants16", "ETPGrass00"], "GardenPit_premade00c Variant.prefab": ["ETPGrass00"], "GardenPit_premade00d Variant.prefab": ["ETPGrass00"] };
  const flower77 = pits77.filter((q) => (cards77[name77(q)] ?? []).some((k) => !remap77(q[6]).get(k) || remap77(q[6]).get(k)!.startsWith("ETP")));
  // (5) shops and lobbies on its blocks' lower panes: the boards inside its band bar its name and the lift's, each over a head
  // and under the storey's 4.7 m, a face behind it within 0.8 m at its middle and both ends and nothing solid 0.6 m in front of
  // it (the collision's half-metre columns stand up to half a metre past a curved face); four shops and a LOBBY over a lit door
  // frame
  const BD77 = (cfg.game as unknown as { boards: Array<{ text: string; at: number[]; yaw: number; w: number; h: number }> }).boards.filter((b) => b.at[0] > -31 && b.at[0] < 31 && b.at[2] > -153 && b.at[2] < -107.5 && b.text !== "LIFT");
  const solid77 = (x: number, y: number, z: number) => S77.some((b) => x >= b[0] && x <= b[1] && z >= b[2] && z <= b[3] && b[4] < y && b[5] > y);
  const onPane77 = BD77.filter((b) => {
    const [ux, uz] = [Math.cos((b.yaw * Math.PI) / 180), -Math.sin((b.yaw * Math.PI) / 180)];
    const [ox, oz] = [Math.sin((b.yaw * Math.PI) / 180), Math.cos((b.yaw * Math.PI) / 180)];
    const backed = [-0.45, 0, 0.45].every((t) => {
      const [px, pz] = [b.at[0] + ux * t * b.w, b.at[2] + uz * t * b.w];
      for (let d = 0; d <= 0.8001; d += 0.05) if (solid77(px - ox * d, b.at[1], pz - oz * d)) return true;
      return false;
    });
    const fronted = [-0.45, 0, 0.45].some((t) => solid77(b.at[0] + ux * t * b.w + ox * 0.6, b.at[1], b.at[2] + uz * t * b.w + oz * 0.6));
    return b.at[1] - b.h / 2 >= 2.2 && b.at[1] + b.h / 2 <= 4.7 && backed && !fronted;
  });
  const shops77 = onPane77.filter((b) => b.text !== "LOBBY");
  const frames77 = outlineBoxes((n: string) => n.startsWith("the glass heights lobby"));
  const lobbies77 = onPane77.filter((b) => b.text === "LOBBY" && frames77.some((f) => f[5] <= b.at[1] - b.h / 2 + 1e-6 && f[5] >= b.at[1] - b.h / 2 - 0.3 && Math.hypot((f[0] + f[1]) / 2 - b.at[0], (f[2] + f[3]) / 2 - b.at[2]) < 0.8));
  // (6) its decks' tops near white: the pack's white hex tile glowing its own map near white, at 0.5 and more
  const decks77 = G77.buildings.filter((b) => b[0].startsWith("HighPlatform_Peninsula"));
  const white77 = decks77.filter((b) => {
    const m = /(^|;)ConcretePanels00=HexaTiles_Plastic01~#([0-9a-f]{6})\|([\d.]+)@\d/i.exec(b[4] ?? "");
    return !!m && [0, 2, 4].every((i) => parseInt(m[2].slice(i, i + 2), 16) >= 0xc0) && Number(m[3]) >= 0.5;
  }).length;
  check(
    "GLASS HEIGHTS at street level: its cover its decks' kit, frosted screens in white troughs with benches, no plain wall in its fill or the street's band facing it; two low sets by the lift's foot, the looks from the ring road to the lift clear past a standing body; every pit white with lit edges, no flower box; shop signs and a lit lobby on its blocks' lower panes; its decks' tops near white",
    SETS77.length >= 4 && built77.length === SETS77.length && plain77.length === 0 && worn77.length === 0 && walls77 === 0 && oldKit77 === 0 && laid77 >= 10 && foot77.length >= 2 && !!VW77?.eyeTall && onLook77.length === 0 && pits77.length >= 20 && striped77.length === 0 && flower77.length === 0 && shops77.length >= 4 && lobbies77.length >= 1 && decks77.length === 4 && white77 === 4,
    `${built77.length} of ${SETS77.length} sets a screen in a trough${plain77.length ? `, plain walls ${[...new Set(plain77)].join(", ")}` : ""}${worn77.length ? `, not the decks' wear: ${worn77.join(", ")}` : ""}; laid ${laid77} sets, ${walls77} plain walls, ${oldKit77} of the old kit on the band; ${foot77.length} low sets by the lift's foot (${LP77.map((l) => `${l.id} ${l.top} m`).join(", ") || "none"}); the lift's looks ${VW77?.eyeTall ? `clear past ${VW77.eyeTall} m` : "with no eyes' height"}, ${onLook77.length} boxes on them${onLook77.length ? ` (${onLook77.slice(0, 3).map((b) => `x ${b[0]} to ${b[1]}, z ${b[2]} to ${b[3]}, ${b[5]} m`).join("; ")})` : ""}; ${pits77.length} pits, ${striped77.length} striped, ${flower77.length} with cards; ${BD77.length} boards on the blocks, ${shops77.length} shops on a pane, ${lobbies77.length} lobbies over a frame; ${white77} of ${decks77.length} decks near white`,
  );
}

// The streets as mid-range ground (Milestone 1075; the centre's nineteenth reviews of version 138, 2026-11-06, both: "cover
// in the carriageway every 15-20 m on the Loop and the corner streets: angled hover vans, median islands with barriers,
// road-works pens; lane dashes, crossings, manholes", "an angled wrecked van plus a barrier set in each empty 15 m
// stretch", "the plaza designed ... light lines radiating from the tower", "lit stairs onto the Sky Ring", 06, 18, 22)
{
  type St75 = { street: string; at: number; set: string; side: number; c: number[]; parts: Array<[string, number, number, number, number]> };
  type Row75 = { path: string; size: number[] | null; min: number[] | null; max: number[] | null };
  const CA75 = (cfg.rules.dress as unknown as { carriage?: { gap: number; kerb: number; clear: number } }).carriage;
  const ST75 = (cfg as unknown as { carriage?: St75[] }).carriage ?? [];
  const CV75 = cfg.rules.streets.curves as unknown as Parameters<typeof curvedStreets>[0] & { round: number; loop: { r: number } };
  const list75 = curvedStreets(CV75);
  const SF75 = new StreetField(list75);
  const PAID75 = process.env.PAID_DIR ?? "C:/Users/jwilb/Downloads/speedkills-paid";
  const cat75 = existsSync(join(PAID75, "neon", "catalogue.json")) ? (JSON.parse(readFileSync(join(PAID75, "neon", "catalogue.json"), "utf8")) as Row75[]) : [];
  const rowOf75 = new Map<string, Row75>();
  for (const r of cat75) if (r.size) rowOf75.set(r.path.split("City Builder/")[1] ?? r.path, r);
  const S75 = (SOLIDS as { solids: number[][] }).solids;
  // (the collision a 2 m cell at a time, for the parts' looks)
  const grid75 = new Map<string, number[][]>();
  for (const b of S75) {
    if (b[4] > 3 || b[5] < 0.3 || b[1] < -100 || b[0] > 100 || b[3] < -100 || b[2] > 100) continue;
    for (let i = Math.floor(b[0] / 2); i <= Math.floor(b[1] / 2); i++) for (let j = Math.floor(b[2] / 2); j <= Math.floor(b[3] / 2); j++) (grid75.get(`${i},${j}`) ?? grid75.set(`${i},${j}`, []).get(`${i},${j}`)!).push(b);
  }
  // (a placement's footprint: its middle, its axes, its half sizes, off the catalogue as the layout lays it)
  const foot75 = (q: unknown[]) => {
    const r = rowOf75.get(String(q[0]));
    if (!r?.size) return null;
    const sc = Number(q[8] ?? 1) || 1;
    const a = (Number(q[4]) * Math.PI) / 180;
    const [mx, mz] = [((r.min![0] + r.max![0]) / 2) * sc, ((r.min![2] + r.max![2]) / 2) * sc];
    return { c: [Number(q[1]) + Math.cos(a) * mx + Math.sin(a) * mz, Number(q[3]) - Math.sin(a) * mx + Math.cos(a) * mz], u: [Math.cos(a), -Math.sin(a)], v: [Math.sin(a), Math.cos(a)], hu: (r.size[0] / 2) * sc, hv: (r.size[2] / 2) * sc, top: Number(q[2]) + r.max![1] * sc };
  };
  type F75 = NonNullable<ReturnType<typeof foot75>>;
  const overlap75 = (a: F75, b: F75, gap: number) => [a.u, a.v, b.u, b.v].every((ax) => {
    const pr = (o: F75) => (o.hu + gap / 2) * Math.abs(o.u[0] * ax[0] + o.u[1] * ax[1]) + (o.hv + gap / 2) * Math.abs(o.v[0] * ax[0] + o.v[1] * ax[1]);
    return Math.abs((a.c[0] - b.c[0]) * ax[0] + (a.c[1] - b.c[1]) * ax[1]) <= pr(a) + pr(b);
  });
  const corners75 = (o: F75) => [[-1, -1], [1, -1], [1, 1], [-1, 1], [0, 0]].map(([s, t]) => [o.c[0] + o.u[0] * s * o.hu + o.v[0] * t * o.hv, o.c[1] + o.u[1] * s * o.hu + o.v[1] * t * o.hv]);
  // (standing in the collision: a box from under `foot` to `over` and more, inside the part's footprint less 0.3 m; a hover
  // van's body floats 0.3 to 0.7 m over the road, its thrusters under it, as the kerb lanes' vans do)
  const stands75 = (o: F75, foot: number, over: number) => corners75({ ...o, hu: Math.max(0.05, o.hu - 0.3), hv: Math.max(0.05, o.hv - 0.3) }).some(([x, z]) => (grid75.get(`${Math.floor(x / 2)},${Math.floor(z / 2)}`) ?? []).some((b) => x >= b[0] && x <= b[1] && z >= b[2] && z <= b[3] && b[4] < foot && b[5] >= over));
  const dress75 = ((cfg.chunks as unknown as Record<string, { place: unknown[][] }>)["c-dress"]?.place ?? []).filter((q) => Number(q[2]) < 2 && q[5] !== "g");
  const D75 = cfg.rules.dress as unknown as { cars: { pieces: string[]; vans: { pieces: string[] } }; median: { piece: string; tall?: { piece: string } } };
  const carNames75 = [...D75.cars.pieces, ...D75.cars.vans.pieces];
  // each station's parts laid as it lists them, standing, on the carriageway in its kerb
  const parts75 = ST75.flatMap((s) => s.parts.map(([name, x, z, yaw, scale]) => {
    const q = dress75.find((p) => String(p[0]).endsWith(`/${name}`) && Math.abs(Number(p[4]) - yaw) < 0.02 && (() => { const f = foot75(p); return !!f && Math.hypot(f.c[0] - x, f.c[1] - z) < 0.03; })());
    return { s, name, yaw, scale, q, f: q ? foot75(q) : null };
  }));
  const unlaid75 = parts75.filter((p) => !p.f);
  const soft75 = parts75.filter((p) => p.f && !(carNames75.includes(p.name) ? stands75(p.f, 0.8, 2) : stands75(p.f, 0.3, p.name === D75.median.piece ? 1 : 1.5)));
  const offRoad75 = parts75.filter((p) => p.f && !corners75(p.f).every(([x, z]) => SF75.surface(x, z, CV75.round) <= -((CA75?.kerb ?? 0) - 0.05)));
  // (a van slewed off its street's line: its long side's turn against the street's way at its middle)
  const vans75 = parts75.filter((p) => p.f && carNames75.includes(p.name) && (() => {
    const n = SF75.nearest(p.f!.c[0], p.f!.c[1], 12);
    if (!n) return false;
    const c = Math.abs(n.t[0] * p.f!.v[0] + n.t[1] * p.f!.v[1]);
    return (Math.acos(Math.min(1, c)) * 180) / Math.PI >= 12;
  })());
  // (and no parked car or median block within a body of one of its parts: the cars and the median made way)
  const mine75 = new Set(parts75.map((p) => p.q).filter(Boolean));
  const others75 = dress75.filter((q) => !mine75.has(q) && [...carNames75, D75.median.piece, D75.median.tall?.piece ?? ""].some((n) => n && String(q[0]).endsWith(`/${n}`))).map(foot75).filter((f): f is F75 => !!f && Math.max(Math.abs(f.c[0]), Math.abs(f.c[1])) < 88);
  const crowded75 = parts75.filter((p) => p.f && others75.some((o) => overlap75(p.f!, o, (CA75?.clear ?? 0) - 0.1)));
  // every centre street a station every `gap` metres and less, but across one of the Loop's axes
  const axes75 = [0, 90, 180, 270].map((d) => ((d * Math.PI) / 180) * CV75.loop.r);
  const said75: string[] = [];
  let spaced75 = true;
  for (const st of list75) {
    const L = (st.pts.length - (st.closed ? 0 : 1)) * 0.5;
    const at = ST75.filter((s) => s.street === st.id).map((s) => s.at).sort((a, b) => a - b);
    const gaps = at.slice(1).map((a, i) => [at[i], a]);
    if (st.closed && at.length) gaps.push([at[at.length - 1], at[0] + L]);
    const long = gaps.filter(([a, b]) => b - a > (CA75?.gap ?? 0) && !(st.closed && axes75.some((x) => [x, x + L].some((y) => y > a && y < b))));
    if (at.length < (st.closed ? 12 : 3) || long.length) spaced75 = false;
    said75.push(`${st.id} ${at.length}${long.length ? ` (${long.map(([a, b]) => `${(b - a).toFixed(0)} m from ${a.toFixed(0)}`).join(", ")})` : ""}`);
  }
  check(
    "the carriageway's stations: down the Loop and every corner street a set in the carriageway every 20 m and less but across the Loop's axes, angled hover vans, planted islands and low barriers, each part laid, standing and in its kerb, the parked cars and the median off them",
    !!CA75 && ST75.length >= 36 && spaced75 && unlaid75.length === 0 && soft75.length === 0 && offRoad75.length === 0 && vans75.length >= 6 && crowded75.length === 0 && ["island", "barrier"].every((k) => ST75.some((s) => s.set === k)),
    `${ST75.length} stations (${["van", "island", "barrier"].map((k) => `${ST75.filter((s) => s.set === k).length} ${k}s`).join(", ")}): ${said75.join(", ")}; ${parts75.length} parts, ${unlaid75.length} not laid, ${soft75.length} not standing${soft75.length ? ` (${soft75.slice(0, 2).map((p) => `${p.name} at ${p.f!.c.map((v) => v.toFixed(1)).join(", ")}`).join("; ")})` : ""}, ${offRoad75.length} out of their kerb; ${vans75.length} vans slewed 12 degrees and more; ${crowded75.length} parts with a parked car or median block within a body`,
  );

  // the road marks: a zebra across each corner street near each end and across the Loop on each axis, painted; manhole covers
  // on the carriageways, sunk to the road's surface; the worn lane edges in from the kerbs, painted
  const MK75 = cfg.rules.streets as unknown as { marks?: { zebra: { piece: string }; covers: { piece: string; up: number }; edge: { piece: string; in: number } }; line: { mat?: string }; curves: { surface: { y: number } } };
  const ground75 = (cfg.chunks as unknown as Record<string, { place: unknown[][] }>)["c-ground"]?.place ?? [];
  const zebra75 = MK75.marks ? ground75.filter((q) => String(q[0]).endsWith(`/${MK75.marks!.zebra.piece}`)) : [];
  const zf75 = zebra75.map((q) => ({ q, f: foot75(q)! }));
  // (each crossing two quads side by side across a street: their middles 5.06 m apart across it, on its middle line)
  const pairs75 = zf75.filter((a, i) => zf75.some((b, j) => j > i && Math.abs(Math.hypot(a.f.c[0] - b.f.c[0], a.f.c[1] - b.f.c[1]) - 2 * a.f.hu) < 0.05 && Math.abs(Number(a.q[4]) - Number(b.q[4])) < 0.05));
  const centred75 = pairs75.filter(({ f }) => { const n = SF75.nearest(f.c[0], f.c[1], 12); return !!n && Math.abs(n.d - f.hu) < 0.3; }).length;
  const zPaint75 = zebra75.filter((q) => q[6] !== MK75.line.mat).length;
  const covers75 = MK75.marks ? ground75.filter((q) => String(q[0]).endsWith(`/${MK75.marks!.covers.piece}`)) : [];
  const badCover75 = covers75.filter((q) => { const f = foot75(q)!; return !(SF75.surface(f.c[0], f.c[1], CV75.round) < -0.5) || Math.abs(f.top - (MK75.curves.surface.y + MK75.marks!.covers.up)) > 0.02; }).length;
  const edges75 = MK75.marks ? ground75.filter((q) => String(q[0]).endsWith(`/${MK75.marks!.edge.piece}`)) : [];
  const badEdge75 = edges75.filter((q) => { const f = foot75(q)!; const s = SF75.surface(f.c[0], f.c[1], CV75.round); return q[6] !== MK75.line.mat || !(s < -0.15 && s > -0.6); }).length;
  check(
    "the centre's road marks: a painted zebra across each corner street near both its ends and across the Loop on each axis, manhole covers on the carriageways sunk to the road's surface, a worn lane edge in from each kerb",
    pairs75.length >= 20 && centred75 === pairs75.length && zPaint75 === 0 && covers75.length >= 16 && badCover75 === 0 && edges75.length >= 100 && badEdge75 === 0,
    `${pairs75.length} crossings (${centred75} on their streets' middles, ${zPaint75} quads unpainted), ${covers75.length} covers (${badCover75} off the road or its surface), ${edges75.length} lane edges (${badEdge75} unpainted or off their kerb)`,
  );

  // the plaza: the Sky Ring's four stairs lit up both flights, strips on their treads inside each flight's guards, rising
  // from its foot to the deck; light lines out of the base's gates across the plaza's floor, none on a stair or a pad
  const { outlineBoxes: ob75 } = await import("../../src/game/outlines");
  const SR75 = cfg.rules.skyring as unknown as { r0: number; deck: number; stairs: { at: number[] } };
  const DS75 = cfg.rules.doubleStair as unknown as { rise: number; up: number[]; down: number[]; run: number; treads: number };
  const OL75 = (cfg.game as unknown as { outlines: Array<{ name: string; lines?: number[][] }> }).outlines;
  const lit75 = SR75.stairs.at.map((deg) => {
    const [ux, uz] = [Math.cos((deg * Math.PI) / 180), Math.sin((deg * Math.PI) / 180)];
    const flights = ["up", "down"].map((fl) => ob75((n: string) => n === `the sky ring stair ${deg} ${fl}`));
    // (each strip within the stair's flights across its axis, and between the deck's edge and the landing along it)
    const along = (b: number[]) => ((b[0] + b[1]) / 2) * ux + ((b[2] + b[3]) / 2) * uz;
    const across = (b: number[]) => Math.abs(-((b[0] + b[1]) / 2) * uz + ((b[2] + b[3]) / 2) * ux);
    const inside = flights.every((bs) => bs.length >= 2 * DS75.treads && bs.every((b) => along(b) <= SR75.r0 + 0.05 && along(b) >= SR75.r0 - DS75.run - 0.05 && across(b) <= Math.max(-DS75.down[0], DS75.up[1])));
    const rises = flights.every((bs) => bs.length > 0 && Math.max(...bs.map((b) => b[5])) - Math.min(...bs.map((b) => b[4])) >= DS75.rise / 2 - 0.3);
    return inside && rises && flights[1].length > 0 && Math.max(...flights[1].map((b) => b[5])) > SR75.deck - 0.3;
  });
  const gates75 = (cfg as unknown as { base: { gates: Array<{ at: number; out: number[] }> } }).base.gates.filter((g) => g.at === 0);
  const lines75 = OL75.filter((o) => o.name.startsWith("the plaza line") && o.lines);
  const padsC75 = (cfg as unknown as { spine: { up: Array<{ pad: number[] }> } }).spine.up.map((q) => q.pad);
  const stairsC75 = SR75.stairs.at.map((deg) => [Math.cos((deg * Math.PI) / 180) * (SR75.r0 - 2.4), Math.sin((deg * Math.PI) / 180) * (SR75.r0 - 2.4)]);
  const goodLines75 = lines75.filter((o) => {
    const [a, b] = [o.lines![0], o.lines![o.lines!.length - 1]];
    const fromGate = gates75.some((g) => Math.hypot(g.out[0] - a[0], g.out[1] - a[1]) < 0.3);
    const toEdge = Math.abs(Math.hypot(b[0], b[1]) - SR75.r0) < 1;
    const boxes = ob75((n: string) => n === o.name);
    const clear = boxes.every((q) => { const [x, z] = [(q[0] + q[1]) / 2, (q[2] + q[3]) / 2]; return !padsC75.some(([px, pz]) => Math.hypot(px - x, pz - z) < 1.5) && !stairsC75.some(([sx, sz]) => Math.abs(sx - x) < 2.6 && Math.abs(sz - z) < 2.6); });
    return fromGate && toEdge && clear && boxes.length >= 2;
  });
  check(
    "the plaza lit: the Sky Ring's four stairs lit up both flights on their treads, from the foot to the deck, and light lines out of the base's gates across the plaza's floor to the Sky Ring's edge, none on a stair or a pad",
    lit75.length === 4 && lit75.every(Boolean) && lines75.length >= 12 && goodLines75.length === lines75.length,
    `${lit75.filter(Boolean).length} of ${lit75.length} stairs lit up both flights; ${goodLines75.length} of ${lines75.length} plaza lines out of a gate to the edge, clear`,
  );
}

// The tower lit by its played storeys (Milestone 1081; the centre's nineteenth reviews, A's second ask: "the tower's bands
// and windows lit only on the playable storeys, each in its floor's colour, the dummy storeys dark", pictures 02, 14, 25):
// rules.tower.lit's spans light every storey of the shell that is played (a floor of rules.tower.floors.at, a level's
// storeys up to its ceiling, the crown's deck) and none other; each span's light one the map already wears (a light it does
// not is a primitive more, at the draws' limit) and none gold but THE VAULT's own storeys; the materials the game lights by
// storey (src/game/neonmap.ts lightTower) worn by no piece standing in its boxes outside the tower's inner square but the
// shell and those it names (`also`), and the inner square inside the tower's own
{
  type Lit9 = { spans: Array<[number, number, string]>; mats: string[]; boxes: number[][]; inner: number[]; dark: number; gain: number; also?: number[][] };
  const TW9 = cfg.rules.tower as unknown as { lit?: Lit9; floors: { at: Record<string, { vault?: unknown }> }; levels?: Array<{ floor: { at: number }; ceiling: { at: number } }>; core: { storeys: number[] } };
  const L9 = TW9.lit;
  const PAID9 = process.env.PAID_DIR ?? "C:/Users/jwilb/Downloads/speedkills-paid";
  const cat9 = existsSync(join(PAID9, "neon", "catalogue.json")) ? (JSON.parse(readFileSync(join(PAID9, "neon", "catalogue.json"), "utf8")) as Array<{ path: string; size: number[] | null; min: number[] | null; max: number[] | null; materials: string[] }>) : [];
  const row9 = new Map(cat9.map((r) => [r.path.split("City Builder/")[1] ?? r.path, r]));
  const CH9 = (cfg as unknown as { chunks: Record<string, { place: Array<[string, number, number, number, number, string, string?, unknown?, number?]> }> }).chunks;
  const placed9 = Object.entries(CH9).filter(([k]) => k.startsWith(cfg.rules.bake.merge)).flatMap(([, ch]) => ch.place);
  // (a placement's materials as the bake wears them: its piece's own through its remap)
  const worn9 = (q: unknown[]) => {
    const own = row9.get(String(q[0]))?.materials ?? [];
    const m = q[6] ? String(q[6]) : "";
    if (m && !m.includes("=")) return [m];
    const re = new Map(m ? m.split(";").map((s) => s.split("=") as [string, string]) : []);
    return own.filter((n) => n !== "none").map((n) => re.get(n) ?? n);
  };
  const wears9 = new Set(placed9.flatMap(worn9));
  let said9 = "no rules.tower.lit, or no catalogue", ok9 = false;
  if (L9 && cat9.length) {
    const played = (s: number) => s in TW9.floors.at || String(s) in TW9.floors.at || (TW9.levels ?? []).some((l) => s > l.floor.at + 0.01 && s < l.ceiling.at - 0.01) || s === Math.max(...TW9.core.storeys);
    const lit = (s: number) => L9.spans.some(([y0, y1]) => s >= y0 - 0.01 && s < y1 - 0.01);
    const shell = TW9.core.storeys.filter((s) => s >= 14);
    const wrong = shell.filter((s) => played(s) !== lit(s));
    const fresh = L9.spans.filter(([, , m]) => !wears9.has(m)).map(([y0, , m]) => `${y0} m ${m}`);
    const gold = L9.spans.filter(([y0, , m]) => /#ffb020/.test(m) && !TW9.floors.at[String(y0)]?.vault).map(([y0]) => y0);
    const base9 = (n: string) => n.split(/[*~^|]/)[0];
    const sq = (cfg.tower as unknown as { square: number[] }).square;
    const innerIn = L9.inner[0] > sq[0] && L9.inner[1] < sq[1] && L9.inner[2] > sq[2] && L9.inner[3] < sq[3];
    const foreign = placed9.filter((q) => {
      if (String(q[0]).endsWith("/Neon Building 08.prefab")) return false;
      if (!worn9(q).some((n) => L9.mats.includes(base9(n)))) return false;
      const r = row9.get(String(q[0]));
      if (!r?.min || !r.max) return false;
      const k = q[8] ?? 1;
      const a = (q[4] * Math.PI) / 180;
      const [mx, mz] = [((r.min[0] + r.max[0]) / 2) * k, ((r.min[2] + r.max[2]) / 2) * k];
      const [x, y, z] = [q[1] + Math.cos(a) * mx + Math.sin(a) * mz, q[2] + ((r.min[1] + r.max[1]) / 2) * k, q[3] - Math.sin(a) * mx + Math.cos(a) * mz];
      const inBox = L9.boxes.some(([x0, x1, y0, y1, z0, z1]) => x > x0 && x < x1 && y > y0 && y < y1 && z > z0 && z < z1);
      const inner = x > L9.inner[0] && x < L9.inner[1] && z > L9.inner[2] && z < L9.inner[3];
      const named = (L9.also ?? []).some(([ax, ay, az]) => Math.abs(ax - q[1]) < 0.5 && Math.abs(ay - q[2]) < 0.5 && Math.abs(az - q[3]) < 0.5);
      return inBox && !inner && !named;
    });
    ok9 = wrong.length === 0 && fresh.length === 0 && gold.length === 0 && innerIn && foreign.length === 0 && L9.dark < 0.2 && L9.mats.length > 0;
    said9 = `${shell.length - wrong.length} of ${shell.length} storeys lit as played${wrong.length ? ` (wrong: ${wrong.join(", ")})` : ""}; ${fresh.length} lights the map does not wear${fresh.length ? ` (${fresh.join(", ")})` : ""}; ${gold.length} gold off THE VAULT${gold.length ? ` (${gold.join(", ")})` : ""}; the inner square inside the tower's ${innerIn}; ${foreign.length} other pieces wearing ${L9.mats.join(", ")} in its boxes${foreign.length ? ` (${foreign.slice(0, 3).map((q) => `${String(q[0]).split("/").pop()} at ${q[1]}, ${q[2]}, ${q[3]}`).join("; ")})` : ""}; dark ${L9.dark}`;
  }
  check("the tower lit by its played storeys: every played storey in a light of its own the map already wears, every other storey dark, gold only on THE VAULT's, the window strips taken on the tower's shell alone", ok9, said9);
}

// The base a facade (Milestone 1081; the centre's nineteenth reviews, B's fourth ask: "the base a facade: window frames,
// shutters, loading doors, ledges, lit bands", pictures 06, 08; the eighteenth's B: "the base a landmark: a distinct facade,
// its name large on four sides, a canopy over the hall's entrances", 06, 09): rules.base.facade bands every floor line of
// the base round its whole outline and corniced over the colonnade, frames every window on its four straight faces, roofs
// two entrance bays on each with a canopy 2.85 m and more over the plaza, clear of every other piece; THE LOBBY (game.sites)
// on each straight face over the roof's edge, facing out; every material one the city's file draws already; none of it
// through the layout's signs on the faces (a cornice or a sill 14 cm proud would cut their letters)
{
  type F9 = { out: number; scale: number; tuck: number; cell: number; ledges: Array<[number, number, number, string]>; bands: Array<[number, number, string]>; boxes: Array<{ mat: string; boxes: number[][] }>; canopy?: boolean };
  const BF9 = (cfg.rules.base as unknown as { facade?: F9; wall: string; roof: number }).facade;
  const RB9 = cfg.rules.base as unknown as { wall: string; roof: number };
  const B9 = cfg.base as unknown as { outline: number[][]; levels: Array<{ y: number }>; slab: number };
  const PAIDf = process.env.PAID_DIR ?? "C:/Users/jwilb/Downloads/speedkills-paid";
  const catf = existsSync(join(PAIDf, "neon", "catalogue.json")) ? (JSON.parse(readFileSync(join(PAIDf, "neon", "catalogue.json"), "utf8")) as Array<{ path: string; min: number[] | null; max: number[] | null; materials: string[] }>) : [];
  const rowf = new Map(catf.map((r) => [r.path.split("City Builder/")[1] ?? r.path, r]));
  const CHf = (cfg as unknown as { chunks: Record<string, { place: Array<[string, number, number, number, number, string, string?, unknown?, number?]> }> }).chunks;
  const placedf = Object.entries(CHf).filter(([k]) => k.startsWith(cfg.rules.bake.merge)).flatMap(([k, ch]) => ch.place.map((q) => ({ k, q })));
  const wornf = (q: unknown[]) => {
    const own = rowf.get(String(q[0]))?.materials ?? [];
    const m = q[6] ? String(q[6]) : "";
    if (m && !m.includes("=")) return [m];
    const re = new Map(m ? m.split(";").map((s) => s.split("=") as [string, string]) : []);
    return own.filter((n) => n !== "none").map((n) => re.get(n) ?? n);
  };
  // (the materials the rest of the city wears, and the tower's floors' and bands' own, which the bake draws from the rules)
  const TWf = cfg.rules.tower as unknown as { mats: Record<string, string>; storeyBands?: { mat: string }; vaultBand: { mat: string }; floors: { at: Record<string, { plinthMat?: string }> } };
  const drawsf = new Set([...placedf.flatMap(({ q }) => wornf(q)), ...Object.values(TWf.mats), TWf.vaultBand.mat, TWf.storeyBands?.mat ?? "", ...Object.values(TWf.floors.at).map((f) => f.plinthMat ?? ""), ...Object.values((cfg.rules.base as unknown as { mats: Record<string, string> }).mats)]);
  // (a placement's box in the map's metres, square to it as the catalogue gives its piece)
  const boxf = (q: unknown[]) => {
    const r = rowf.get(String(q[0]));
    if (!r?.min || !r.max) return null;
    const k = Number(q[8] ?? 1);
    const a = (Number(q[4]) * Math.PI) / 180;
    const [co, si] = [Math.cos(a), Math.sin(a)];
    const xs: number[] = [], zs: number[] = [];
    for (const X of [r.min[0] * k, r.max[0] * k]) for (const Z of [r.min[2] * k, r.max[2] * k]) xs.push(co * X + si * Z + Number(q[1])), zs.push(-si * X + co * Z + Number(q[3]));
    return [Math.min(...xs), Math.max(...xs), Number(q[2]) + r.min[1] * k, Number(q[2]) + r.max[1] * k, Math.min(...zs), Math.max(...zs)];
  };
  const meets = (a: number[], b: number[]) => a[0] < b[1] && a[1] > b[0] && a[2] < b[3] && a[3] > b[2] && a[4] < b[5] && a[5] > b[4];
  const sdf = (x: number, z: number) => {
    let d = Infinity, inside = false;
    const p = B9.outline;
    for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
      const [ax, az] = p[j], [bx, bz] = p[i];
      const [ex, ez] = [bx - ax, bz - az];
      const t = Math.max(0, Math.min(1, ((x - ax) * ex + (z - az) * ez) / (ex * ex + ez * ez || 1)));
      d = Math.min(d, Math.hypot(x - ax - ex * t, z - az - ez * t));
      if (az > z !== bz > z && x < ((bx - ax) * (z - az)) / (bz - az) + ax) inside = !inside;
    }
    return inside ? -d : d;
  };
  // (how far a box stands out of the outline at its farthest, and how deep it runs out from its nearest)
  const proud = (b: number[]) => Math.max(sdf(b[0], b[4]), sdf(b[1], b[5]), sdf(b[0], b[5]), sdf(b[1], b[4]));
  const depth = (b: number[]) => proud(b) - Math.min(sdf(b[0], b[4]), sdf(b[1], b[5]), sdf(b[0], b[5]), sdf(b[1], b[4]));
  let saidf = "no rules.base.facade, or no catalogue", okf = false;
  if (BF9 && catf.length) {
    const lines = [...new Set([...B9.levels.map((l) => l.y).filter((y) => y > 0), RB9.roof])];
    const banded = lines.filter((L) => BF9.bands.some(([y0, y1]) => y0 > L - B9.slab - 0.01 && y1 <= L + 0.01 && y1 > y0));
    const corniced = BF9.ledges.filter(([y0, y1, deep]) => deep >= 0.2 && y1 > y0 && lines.some((L) => y0 > L - B9.slab - 0.1 && y0 < L - B9.slab + 0.1)).length;
    const all = BF9.boxes.flatMap((c) => c.boxes);
    const sx = Math.max(...B9.outline.map((p) => p[0])), sz = Math.max(...B9.outline.map((p) => p[1]));
    // (the windows on the four straight faces: the base's wall piece at a storey, square to the map, on the outline)
    const wins = (CHf["c-base"]?.place ?? []).filter((q) => q[0].endsWith(`/${RB9.wall}`) && q[2] > 0 && Math.abs((((q[4] % 90) + 90) % 90) - 45) > 44.9 && (Math.abs(Math.abs(q[3]) - (sz - 0.5)) < 0.05 || Math.abs(Math.abs(q[1]) - (sx - 0.5)) < 0.05));
    // (framed: within the window's own bay and outside its face, both jambs, a head over its opening and a sill under it)
    const framed = wins.filter((q) => {
      const b = boxf(q);
      if (!b) return false;
      const alongX = Math.abs(Math.sin((q[4] * Math.PI) / 180)) < 0.5;
      const [a0, a1] = alongX ? [b[0], b[1]] : [b[4], b[5]];
      const lo = (c: number[]) => (alongX ? c[0] : c[4]);
      const hi = (c: number[]) => (alongX ? c[1] : c[5]);
      const mine = all.filter((c) => lo(c) >= a0 - 0.01 && hi(c) <= a1 + 0.01 && c[2] >= q[2] - 0.01 && c[3] <= q[2] + 3.01 && (alongX ? c[4] < b[5] + 0.2 && c[5] > b[4] - 0.2 : c[0] < b[1] + 0.2 && c[1] > b[0] - 0.2) && sdf((c[0] + c[1]) / 2, (c[4] + c[5]) / 2) > 0);
      const head = mine.some((c) => hi(c) - lo(c) >= 0.8 * (a1 - a0) && c[2] >= q[2] + 2.4);
      const sill = mine.some((c) => hi(c) - lo(c) >= 0.8 * (a1 - a0) && c[3] <= q[2] + 0.5);
      const jambs = mine.filter((c) => hi(c) - lo(c) <= 0.3 && c[3] - c[2] >= 1.5);
      return head && sill && jambs.some((c) => lo(c) < a0 + 0.5) && jambs.some((c) => hi(c) > a1 - 0.5);
    });
    // (a canopy: a box over the plaza 1.5 m and more out of a face, from 2.85 m up, under the first slab)
    const canopies = all.filter((c) => c[2] >= 2.85 && c[3] <= lines[0] && Math.max(c[1] - c[0], c[5] - c[4]) >= 3 && proud(c) >= 1.5 && depth(c) >= 1.5);
    // (and nothing of it over the plaza, half a metre and more out, under a head's room)
    const lowOver = all.filter((c) => proud(c) > 0.5 && c[2] < 2.85).length;
    // (nothing of the city in a canopy's box or a sill's, but the base's own colonnade under the canopies' tucked ends)
    const deep = all.filter((c) => Math.min(c[1] - c[0], c[5] - c[4]) > 0.1 || c[2] >= 2.85);
    const struck = placedf.filter(({ k, q }) => {
      const b = boxf(q);
      if (!b) return false;
      if (k === "c-signs" || (k === "c-base" && /\/(Pillar_Simple_1x3|Wall_Simple_5x3Window00|Wall_Simple_2Sides_1x3|Wall_Simple_WideGate00_5x3)\.prefab$/.test(q[0]))) return false;
      return deep.some((c) => meets(b, c));
    });
    // (the layout's signs on the faces: none a cornice or a box stands out through, as far out as the sign's front or
    // farther; a frame's bar behind a sign's front is hidden by it)
    const signs = (CHf["c-signs"]?.place ?? []).map(boxf).filter((b): b is number[] => !!b);
    const cut = signs.filter((s) => BF9.ledges.some(([y0, y1, d]) => s[2] < y1 && s[3] > y0 && proud(s) > -0.5 && d >= proud(s) - 0.02) || all.some((c) => meets(s, c) && proud(c) >= proud(s) - 0.02)).length;
    // (THE LOBBY on each straight face: a board 5 cm off its plane, facing out, from over the roof, wide)
    const name = ((cfg.game as unknown as { sites: { list: Array<{ id: string; name: string }> } }).sites.list.find((s) => s.id === "lobby")?.name) ?? "";
    const BD = (cfg.game as unknown as { boards: Array<{ text: string; at: number[]; yaw: number; w: number; h: number }> }).boards;
    const faces: Array<[number, number, number]> = [[0, -sz, 180], [0, sz, 0], [sx, 0, 90], [-sx, 0, -90]];
    const named = faces.filter(([fx, fz, yaw]) => BD.some((b) => b.text === name && b.w >= 12 && Math.abs((((b.yaw - yaw) % 360) + 360) % 360) < 1 && (fx ? Math.abs(Math.abs(b.at[0]) - sx) < 0.15 && Math.sign(b.at[0]) === Math.sign(fx) : Math.abs(Math.abs(b.at[2]) - sz) < 0.15 && Math.sign(b.at[2]) === Math.sign(fz)) && b.at[1] - b.h / 2 >= RB9.roof && !signs.some((s) => s[3] > b.at[1] - b.h / 2 && s[2] < b.at[1] + b.h / 2 && (fx ? Math.abs(s[4] + s[5]) / 2 < b.w / 2 + 0.5 && Math.abs(Math.abs(s[0] + s[1]) / 2 - sx) < 1.5 : Math.abs(s[0] + s[1]) / 2 < b.w / 2 + 0.5 && Math.abs(Math.abs(s[4] + s[5]) / 2 - sz) < 1.5))));
    const mats = [...BF9.ledges.map((q) => q[3]), ...BF9.bands.map((q) => q[2]), ...BF9.boxes.map((c) => c.mat)];
    const fresh = [...new Set(mats)].filter((m) => !drawsf.has(m));
    okf = banded.length === lines.length && corniced >= 1 && wins.length >= 40 && framed.length === wins.length && (BF9.canopy === false ? canopies.length === 0 : canopies.length >= 8) && lowOver === 0 && struck.length === 0 && cut === 0 && named.length === 4 && fresh.length === 0;
    saidf = `${banded.length} of ${lines.length} floor lines banded, ${corniced} cornices; ${framed.length} of ${wins.length} windows on the straight faces framed; ${canopies.length} canopies, ${lowOver} boxes over the plaza under 2.85 m; ${struck.length} pieces in a canopy or a sill${struck.length ? ` (${struck.slice(0, 2).map(({ q }) => `${q[0].split("/").pop()} at ${q[1]}, ${q[3]}`).join("; ")})` : ""}; ${cut} signs cut by it; ${name || "no name"} on ${named.length} of 4 faces; ${fresh.length} materials the city's file lacks${fresh.length ? ` (${fresh.join(", ")})` : ""}`;
  }
  check("the base a facade: a lit band at every floor line round it, a cornice over the colonnade, every window on its straight faces framed with a sill, a canopy over two entrance bays a face, its name over the roof on all four faces, in materials the city draws, through none of the signs", okf, saidf);
}

// each corner block its own kit at street level (rules.low.kits, Milestone 1084; the centre's nineteenth reviews: "MARKET themed:
// stall canopies, produce and cargo crates, an awning over the street, for the white sci-fi crates", "a stall canopy over
// MARKET's street, a two-storey L-shaped motel with outside walkways at MOTEL HILL"; the eighteenth's "ledges and balconies on
// MARKET and NOODLE ROW"): every set of the rows laid, off the street on its block's own ground, MARKET's awnings in the kit's
// cloths and NOODLE ROW's bistro sets each by a stall; three canopies and more over MARKET's streets, each cable from lamp
// head to lamp head over the road and every awning of it drawn only, 4.5 m and more over the ground; no crate on MARKET's
// ground or in its streets in the street's white; MOTEL HILL's walkway walked up its stair in its three lanes and down, and
// along both wings to their far ends at its height, and a body walked out at each open edge held on the walk by the rail;
// MARKET's balcony a floor at its height
{
  type CK = { rows: Array<{ id: string; set: string; at: number[]; yaw: number; box: number[]; parts: number[][]; cloth: { at: number[]; mat: string } | null }>; of: number; canopies: Array<{ street: string; at: number; a: number[]; b: number[]; y: number; awnings: number }>; balconies: number[][]; motel: { decks: number[][]; y: number; lanes: number[][][]; routes: number[][][]; edges: number[][][] } | null };
  const KC = (cfg as unknown as { cornerKits?: CK }).cornerKits;
  const KR = (cfg.rules.low as unknown as { kits?: { rows: Array<{ id: string; block: string; at: number[][] }>; wear: string[]; canopy?: { piece: string }; cover?: Record<string, Record<string, string>> } }).kits;
  const CVk = cfg.rules.streets.curves as unknown as Parameters<typeof curvedStreets>[0] & { round: number; pave: number };
  const SFk = new StreetField(curvedStreets(CVk));
  const off = (x: number, z: number) => SFk.surface(x, z, CVk.round);
  const placed = (chunk: string) => (((cfg.chunks as unknown as Record<string, { place: unknown[][] }>)[chunk]?.place ?? []) as Array<[string, number, number, number, number, string, (string | null)?, (string[] | null)?]>);
  const rowsOf = (id: string) => (KC?.rows ?? []).filter((q) => q.id === id);
  const spots = (KR?.rows ?? []).reduce((s, r) => s + r.at.length, 0);
  // (a set off the street: every corner of each of its colliding parts past the pavement)
  const onStreet = (KC?.rows ?? []).filter((q) =>
    q.parts.some(([cx, cz, hu, hv, yaw]) => {
      const a = (yaw * Math.PI) / 180;
      const u = [Math.cos(a), -Math.sin(a)], v = [Math.sin(a), Math.cos(a)];
      return [-1, 1].some((i) => [-1, 1].some((j) => off(cx + u[0] * hu * i + v[0] * hv * j, cz + u[1] * hu * i + v[1] * hv * j) < CVk.pave));
    }),
  );
  const sw = placed("c-sw");
  const awnPiece = `/${KR?.canopy?.piece ?? "Window_sunshade001.prefab"}`;
  // (each MARKET stall's awning where its record puts it, in its cloth, one of the kit's)
  const worn = rowsOf("market-walk-in").filter((q) => !!q.cloth && (KR?.wear ?? []).includes(q.cloth.mat) && sw.some((p) => p[0].endsWith(awnPiece) && Math.abs(p[1] - q.cloth!.at[0]) < 0.01 && Math.abs(p[3] - q.cloth!.at[1]) < 0.01 && p[6] === q.cloth!.mat));
  const ne = placed("c-ne");
  const bistros = rowsOf("noodle-bistro").filter((q) => (cfg as unknown as { stalls: Array<{ at: number[] }> }).stalls.some((s) => Math.hypot(s.at[0] - q.at[0], s.at[1] - q.at[1]) < 6) && ne.filter((p) => p[0].endsWith("/Chair001b.prefab") && p[5] === "g" && Math.hypot(p[1] - q.at[0], p[3] - q.at[1]) < 1.2).length >= 3);
  // (the canopies: each cable's ends over the road, each awning of it drawn only with its frame left out, its lip over a body's double jump)
  const canopies = (KC?.canopies ?? []).filter((q) => q.street.startsWith("sw-"));
  const awns = sw.filter((p) => p[0].endsWith(awnPiece) && (p[7]?.length ?? 0) > 0);
  // (the awning's cloth from 2.24 to 2.87 m up in its own metres, measured off the model: its pivot hangs 2.87 under the
  // cable and its lip 0.63 under that; a body's double jump tops out about 4.4 m over the road, movement.json)
  const badCanopy = canopies.filter((q) => {
    const mine = awns.filter((p) => Math.abs(p[2] - (q.y - 2.87)) < 0.01 && Math.hypot(p[1] - (q.a[0] + q.b[0]) / 2, p[3] - (q.a[1] + q.b[1]) / 2) < 6);
    return off(q.a[0], q.a[1]) > 0 || off(q.b[0], q.b[1]) > 0 || mine.length !== q.awnings || mine.some((p) => p[5] !== "g" || p[2] + 2.24 < 4.5);
  });
  // (no crate in the street's white on MARKET's ground or in its streets: the white is rules.wear's, given where a placement
  // gives none. MARKET's own chunk on the ground, not the roof bridge's step; the street cover's 3 m inside the block's
  // streets, as it wears a set by its spot, up to 3 m from its parts: past the High City blocks' 27.5 m and the Loop's
  // pavement, short of the ring road's band)
  const white = (cfg.rules as unknown as { wear: Record<string, string> }).wear["Crate00.prefab"];
  const BDk = (cfg.rules.dress as unknown as { cover: { band: { from: number; reach: number } } }).cover.band;
  const inMarket = (x: number, z: number) => x < -27.5 - 3 && z > 27.5 + 3 && Math.hypot(x, z) > 52.5 + 3 && Math.max(-x, z) < BDk.from - BDk.reach - 3;
  const whites = [...sw.filter((p) => p[2] < 2.1), ...placed("c-cover").filter((p) => inMarket(p[1], p[3]))].filter((p) => p[0].endsWith("/Crate00.prefab") && (p[6] ?? white) === white);
  // (the motel: up and down its stair, along its wings, out at its edges)
  const MO = KC?.motel;
  const stuck: string[] = [];
  for (const [j, r] of (MO?.lanes ?? []).entries())
    for (const [way, pts] of [["up", r], ["down", [...r].reverse()]] as const) {
      const w = along(pts);
      if (w.k !== pts.length || Math.abs(w.y - pts.at(-1)![2]) > 0.15) stuck.push(`stair lane ${j + 1} ${way}: ${w.k - 1} of ${pts.length - 1} legs, at (${w.x.toFixed(1)}, ${w.z.toFixed(1)}) ${w.y.toFixed(2)} m`);
    }
  for (const [j, r] of (MO?.routes ?? []).entries()) {
    const w = along([MO!.lanes[1][0], ...MO!.lanes[1].slice(1), ...r]);
    if (w.k !== MO!.lanes[1].length + r.length || Math.abs(w.y - MO!.y) > 0.15) stuck.push(`wing ${j + 1}: at (${w.x.toFixed(1)}, ${w.z.toFixed(1)}) ${w.y.toFixed(2)} m`);
  }
  // (a body walked from the walk out across an open edge: a rail it mantles over (the game's mantle takes a 1.1 m rail on a
  // push), so where it leaves the walk it is up over the rail's top; with no rail it walks off the edge and is falling)
  const fell = (MO?.edges ?? []).filter((e) => {
    const w = along(e);
    return w.k === e.length ? w.y < MO!.y + 0.5 : Math.abs(w.y - MO!.y) > 0.15;
  });
  // (the balcony: a floor at its height over its middle)
  const balc = (KC?.balconies ?? []).filter((b) => {
    const [x, z] = [(b[0] + b[1]) / 2, (b[2] + b[3]) / 2];
    return solidsIn(x + BR_X, x + BR_X, z + BR_Z, z + BR_Z).some((q) => Math.abs(q.top - b[5]) < 0.15);
  });
  check(
    "each corner block its own kit: MARKET's stalls against its walk-in under its cloths, NOODLE ROW's bistro tables by its stalls, every set laid off the street; canopies of awnings over MARKET's streets from lamp head to lamp head, drawn only, high over a body; no crate in the street's white in MARKET; MOTEL HILL's walkway up its stair and along both wings, railed; MARKET's balcony",
    !!KC && KC.rows.length === KC.of && KC.of === spots && onStreet.length === 0 && rowsOf("market-walk-in").length >= 3 && worn.length === rowsOf("market-walk-in").length && bistros.length === rowsOf("noodle-bistro").length && bistros.length >= 4 &&
      canopies.length >= 3 && badCanopy.length === 0 && whites.length === 0 && !!MO && MO.lanes.length === 3 && stuck.length === 0 && fell.length === 0 && MO.edges.length >= 3 && balc.length === KC.balconies.length && KC.balconies.length >= 1,
    `${KC?.rows.length ?? 0} of ${KC?.of ?? 0} sets laid (${spots} in the rules)${onStreet.length ? `, ${onStreet.length} on the street` : ""}; MARKET ${rowsOf("market-walk-in").length} stalls, ${worn.length} under the kit's cloths; NOODLE ROW ${bistros.length} of ${rowsOf("noodle-bistro").length} bistro sets by a stall; ${canopies.length} canopies over MARKET's streets${badCanopy.length ? `, ${badCanopy.length} wrong (${badCanopy.map((q) => `${q.street} ${q.at}`).join(", ")})` : ""}; ${whites.length} white crates in MARKET; the motel ${MO ? `${MO.lanes.length} stair lanes, ${(MO.routes ?? []).length} wings, ${MO.edges.length} edges` : "missing"}${stuck.length ? ` (${stuck.slice(0, 3).join("; ")})` : ""}${fell.length ? `, ${fell.length} edges let a body off` : ""}; ${balc.length} of ${KC?.balconies.length ?? 0} balconies a floor`,
  );
}
// THE CANYON's cliffs in segments, its balconies and its lane past the fence (Milestone 1086; the districts' thirteenth
// reviews of version 138, THE CANYON 6.5 and 6.3: "a different facade every 20-30 m", "the cliffs stepped, balconies, ledges, a
// second window material", d20 and d21; "the orange strip between THE CANYON and the fence" empty, both aerials): no run of one
// facade along a side past 30 m, three facades each a fifth of the fronts and more, two and more down each of the canyon's
// four faces, every facade's wear and its own pieces' materials ones the map draws without it (the centre's draws stand at
// their limit); each balcony on a white or dark front with its back on its face, clear of every sign, unit, cable bundle and
// banner; the strip past the fence the road's asphalt, dashed, vans parked on it, all of it past the fence
{
  type RowC6 = { path: string; size: number[] | null; min: number[] | null; max: number[] | null; materials?: string[] };
  type KitC6 = { fronts?: string[]; mat?: string; long?: string; longMat?: string };
  const PAIDc6 = process.env.PAID_DIR ?? "C:/Users/jwilb/Downloads/speedkills-paid";
  const catC6 = existsSync(join(PAIDc6, "neon", "catalogue.json")) ? (JSON.parse(readFileSync(join(PAIDc6, "neon", "catalogue.json"), "utf8")) as RowC6[]) : [];
  const rowC6 = new Map<string, RowC6>();
  for (const r of catC6) {
    if (!r.size) continue;
    const k = r.path.split("City Builder/")[1] ?? r.path;
    rowC6.set(k, r);
    if (!rowC6.has(k.split("/").pop()!)) rowC6.set(k.split("/").pop()!, r);
  }
  // (a placement's box on the map [x0, x1, y0, y1, z0, z1], off the catalogue as the layout lays it)
  const boxC6 = (q: unknown[]): number[] | null => {
    const r = rowC6.get(String(q[0]));
    if (!r?.min || !r.max) return null;
    const sc = Number(q[8] ?? 1) || 1;
    const a = (Number(q[4]) * Math.PI) / 180;
    const [c, s] = [Math.cos(a), Math.sin(a)];
    const xs: number[] = [];
    const zs: number[] = [];
    for (const lx of [r.min[0] * sc, r.max[0] * sc])
      for (const lz of [r.min[2] * sc, r.max[2] * sc]) {
        xs.push(Number(q[1]) + c * lx + s * lz);
        zs.push(Number(q[3]) - s * lx + c * lz);
      }
    return [Math.min(...xs), Math.max(...xs), Number(q[2]) + r.min[1] * sc, Number(q[2]) + r.max[1] * sc, Math.min(...zs), Math.max(...zs)];
  };
  const DC6 = (cfg.rules.districts as unknown as { canyon: { chunk: string; segments?: { lengths: number[]; kits: KitC6[] }; cliffs: { faces: Array<[string, number, number, number, number]>; balconies?: { piece: string; clear: number; kits: number[]; at: number[][] } }; lane?: { marks: { piece: string; mat: string }; parked: Array<[string, number, number, number, number, string?]> } } }).canyon;
  const CH6 = cfg.chunks as unknown as Record<string, { place: unknown[][] }>;
  const SEG6 = (cfg as unknown as { canyon: { segments?: number[][] } }).canyon.segments ?? [];
  const K6 = DC6.segments?.kits ?? [];
  const placed6 = CH6[DC6.chunk]?.place ?? [];
  // 1 the runs: each side's fronts in order along it, run together while one kit goes on with no gap
  const sides6 = new Map<string, Array<{ a: number; l: number; k: number }>>();
  for (const [fx, fz, , k, , ox, oz, line, l] of SEG6) {
    const key = `${ox},${oz},${line}`;
    (sides6.get(key) ?? sides6.set(key, []).get(key)!).push({ a: ox ? fz : fx, l, k });
  }
  let longest6 = 0;
  let longAt6 = "";
  for (const [key, fs] of sides6) {
    fs.sort((p, q) => p.a - q.a);
    let run = 0;
    for (const [i, f] of fs.entries()) {
      const prev = fs[i - 1];
      run = prev && prev.k === f.k && Math.abs(f.a - prev.a - (f.l + prev.l) / 2) < 0.05 ? run + f.l : f.l;
      if (run > longest6) [longest6, longAt6] = [run, `the side ${key} at ${f.a}`];
    }
  }
  const counts6 = K6.map((_, i) => SEG6.filter((f) => f[3] === i).length);
  const share6 = counts6.length ? Math.min(...counts6) / Math.max(1, SEG6.length) : 0;
  const faceKits6 = DC6.cliffs.faces.map(([axis, line, a0, a1, out]) =>
    new Set(SEG6.filter((f) => f[4] === 1 && (axis === "z" ? f[5] === 0 && f[6] === out : f[6] === 0 && f[5] === out) && Math.abs(f[7] - line) < 0.01 && (axis === "z" ? f[0] : f[1]) > a0 && (axis === "z" ? f[0] : f[1]) < a1).map((f) => f[3])).size,
  );
  // (every wear a material the map draws without the canyon's fronts: each c- placement's own materials through its remap)
  const drawn6 = new Set<string>();
  for (const [k, ch] of Object.entries(CH6)) {
    if (!k.startsWith("c")) continue;
    for (const q of ch.place) {
      if (k === DC6.chunk && /\/UnderWall0/.test(String(q[0]))) continue;
      const m = (q[6] ?? "") as string;
      if (m && !m.includes("=")) drawn6.add(m);
      else {
        const re = new Map(m.split(";").filter((p) => p.includes("=")).map((p) => p.split("=") as [string, string]));
        for (const n of rowC6.get(String(q[0]))?.materials ?? []) if (n !== "none") drawn6.add((re.get(n) ?? n).split("@")[0]);
      }
    }
  }
  const worn6 = (m?: string) => new Map((m ?? "").split(";").filter((p) => p.includes("=")).map((p) => p.split("=") as [string, string]));
  const fresh6 = K6.flatMap((k) => [
    ...[...worn6(k.mat).values(), ...worn6(k.longMat).values()],
    ...(k.fronts ?? []).flatMap((n) => (rowC6.get(n)?.materials ?? []).filter((m) => m !== "none" && !worn6(k.mat).has(m))),
  ]).filter((m) => !drawn6.has(m));
  // 2 the balconies
  const BL6 = DC6.cliffs.balconies;
  const balc6 = BL6 ? placed6.filter((q) => String(q[0]).endsWith(`/${BL6.piece}`)) : [];
  const skip6 = /\/(UnderWall0|FloorBasic00|FenceCrystal_Border|Lighting_Deco00e|Lighting_Deco006|StairsDoble|Cable03)/;
  const others6 = placed6.filter((q) => !skip6.test(String(q[0])) && !balc6.includes(q)).map(boxC6).filter((b): b is number[] => !!b);
  for (const b of (cfg as unknown as { banners?: Array<{ at: number[]; yaw: number; h: number; span: number }> }).banners ?? []) {
    const [x, y, z] = b.at;
    others6.push(b.yaw === 90 ? [x - 0.1, x + 0.1, y - b.h / 2, y + b.h / 2 + 0.1, z - b.span / 2, z + b.span / 2] : [x - b.span / 2, x + b.span / 2, y - b.h / 2, y + b.h / 2 + 0.1, z - 0.1, z + 0.1]);
  }
  const cl6 = BL6?.clear ?? 0.25;
  const bad6: string[] = [];
  for (const q of balc6) {
    const b = boxC6(q);
    if (!b) {
      bad6.push(`${String(q[0])} not in the catalogue`);
      continue;
    }
    const hit = others6.some((o) => o[0] < b[1] + cl6 && o[1] > b[0] - cl6 && o[2] < b[3] + cl6 && o[3] > b[2] - cl6 && o[4] < b[5] + cl6 && o[5] > b[4] - cl6);
    const [mx, mz] = [(b[0] + b[1]) / 2, (b[4] + b[5]) / 2];
    // (its back on the face's line and its whole width along the face: past a face's end stands a block's corner)
    const face = DC6.cliffs.faces.find(([axis, line, a0, a1, out]) => (axis === "z" ? Math.abs((out > 0 ? b[4] : b[5]) - line) < 0.05 && b[0] > a0 - 0.05 && b[1] < a1 + 0.05 : Math.abs((out > 0 ? b[0] : b[1]) - line) < 0.05 && b[4] > a0 - 0.05 && b[5] < a1 + 0.05));
    const front = face && SEG6.find((f) => f[4] === 1 && Math.abs(f[7] - face[1]) < 0.01 && Math.abs(face[0] === "z" ? f[0] - mx : f[1] - mz) < 0.1 && (face[0] === "z" ? f[6] === face[4] : f[5] === face[4]));
    const onKit = !!front && BL6!.kits.includes(front[3]);
    if (hit || !face || !onKit) bad6.push(`(${mx.toFixed(1)}, ${b[2].toFixed(1)}, ${mz.toFixed(1)})${hit ? " in a sign's, unit's, cable's or banner's way" : ""}${!face ? " off the faces" : !onKit ? " not on a white or dark front" : ""}`);
  }
  // 3 the lane: its tiles the road's, its dashes, its vans, everything parked past the fence
  const LN6 = DC6.lane;
  const GD6 = cfg.rules.ground as unknown as { tile: string; roadTile?: string; districts: { lanes?: Array<[number, number, number, number, string]> } };
  const laneTiles6 = Object.entries(CH6).filter(([k]) => k.startsWith("ground-")).flatMap(([, ch]) => ch.place)
    .filter((q) => String(q[0]).endsWith(GD6.tile) && (GD6.districts.lanes ?? []).some(([x0, x1, z0, z1]) => Number(q[1]) + 5 > x0 && Number(q[1]) + 5 < x1 && Number(q[3]) - 5 > z0 && Number(q[3]) - 5 < z1));
  const asphalt6 = laneTiles6.filter((q) => q[6] === GD6.roadTile).length;
  const dashes6 = LN6 ? placed6.filter((q) => String(q[0]).endsWith(`/${LN6.marks.piece}`) && q[6] === LN6.marks.mat && q[5] === "g").length : 0;
  const vans6 = placed6.filter((q) => /\/FloatingCar00b?\.prefab$/.test(String(q[0])) && q[5] === "g" && (() => { const b = boxC6(q); return !!b && Math.max(Math.abs(b[0]), Math.abs(b[1]), Math.abs(b[4]), Math.abs(b[5])) > 155; })()).length;
  const inside6 = (LN6?.parked ?? []).filter(([, x, z]) => Math.max(Math.abs(x), Math.abs(z)) <= 152.5).length;
  check(
    "THE CANYON's cliffs in segments, its balconies and its lane past the fence: no run of one facade past 30 m along a side, three facades each a fifth of the fronts and more, two and more down each of the canyon's four faces, no material new; each balcony on a white or dark front at its face, clear of every sign, unit, cable bundle and banner; the strip past the fence the road's asphalt, dashed, vans parked on it",
    SEG6.length >= 140 && K6.length >= 3 && longest6 <= 30.01 && share6 >= 0.2 && faceKits6.every((n) => n >= 2) && fresh6.length === 0 && balc6.length >= 24 && balc6.length === (BL6?.at.length ?? -1) && bad6.length === 0 && laneTiles6.length >= 20 && asphalt6 === laneTiles6.length && dashes6 >= 16 && vans6 >= 8 && inside6 === 0,
    `${SEG6.length} fronts in ${K6.length} facades (${counts6.join("/") || "none"}), the longest run ${longest6} m${longAt6 ? ` (${longAt6})` : ""}, ${faceKits6.join("/")} facades down the four faces, ${fresh6.length ? `new materials ${[...new Set(fresh6)].join(", ")}` : "no material new"}; ${balc6.length} balconies${bad6.length ? `: ${bad6.slice(0, 3).join("; ")}` : ""}; the lane ${asphalt6} of ${laneTiles6.length} tiles the road's, ${dashes6} dashes, ${vans6} vans, ${inside6} pieces inside the fence`,
  );
}

// THE WORKS' halls (Milestone 1086; the districts' thirteenth reviews, d22 and d23: "the hall oiled concrete, the light pool
// dimmed", "bolted plates on the flat rust L-walls"; the twelfth and thirteenth, d23: "the pads flat rings"): every hall's floor
// tiled whole in its concrete; the fill's spots over THE WORKS' halls at their own height, under the slab, none left at the
// grid's 3 m; the yard's panels' faces in the plates and their edges in the halls' rust; a lit ring round each of the atrium's
// two pads, outside its ring of light
{
  const WK7 = cfg.rules.districts as unknown as { works: { chunk: string; storey: number; slab: number; wallMat: string; plates?: string; floor?: { tiles: string[]; mat: string; y: number }; halls: Array<{ id: string; box: number[] }>; upper: { padBase?: { piece: string; scale: number; mat: string; at: number[][] } } } };
  const W7 = WK7.works;
  const CH7 = (cfg.chunks as unknown as Record<string, { place: unknown[][] }>)[W7.chunk]?.place ?? [];
  // (a flat tile's middle and size: the pack's ground tiles run from their pivot to +x and -z, their size in their name)
  const sizeOf7 = (n: string) => Number(/_(\d+(?:\.\d+)?)x/.exec(n)?.[1] ?? 0);
  const floors7 = W7.halls.map((H) => {
    const [x0, x1, z0, z1] = H.box;
    let area = 0;
    for (const q of CH7) {
      const n = String(q[0]).split("/").pop()!;
      if (!W7.floor || !W7.floor.tiles.includes(n) || q[6] !== W7.floor.mat || Math.abs(Number(q[2]) - W7.floor.y) > 0.005) continue;
      const s = sizeOf7(n);
      const [cx, cz] = [Number(q[1]) + s / 2, Number(q[3]) - s / 2];
      if (cx > x0 && cx < x1 && cz > z0 && cz < z1) area += s * s;
    }
    return { id: H.id, area, want: (x1 - x0) * (z1 - z0) };
  });
  const bare7 = floors7.filter((f) => Math.abs(f.area - f.want) > 0.1);
  // (the fill's spots over THE WORKS' halls: each row naming its own height, its spots there, none at the old 3 m)
  const FR7 = (cfg.game as unknown as { fill: { height: number; rects?: number[][] } }).fill;
  const hallRects7 = (FR7.rects ?? []).filter(([x0, x1, z0, z1]) => W7.halls.some((H) => x0 >= H.box[0] - 0.01 && x1 <= H.box[1] + 0.01 && z0 >= H.box[2] - 0.01 && z1 <= H.box[3] + 0.01));
  const spots7 = neonFillSpots();
  const under7 = W7.storey - W7.slab;
  const lowSpots7 = hallRects7.filter(([x0, x1, z0, z1, y]) => spots7.some((q) => q.x - BR_X > x0 && q.x - BR_X < x1 && q.z - BR_Z > z0 && q.z - BR_Z < z1 && q.y > y + 0.5 && q.y < y + FR7.height + 0.5)).length;
  const own7 = hallRects7.filter((r) => r[5] !== undefined && r[5] > FR7.height && r[5] < under7 && r[5] < 6).length;
  // (the yard's panels: both faces in the plates, the top and foot in the halls' rust)
  const DC7 = cfg.rules.dress.districtCover as unknown as { mats: Record<string, Record<string, string>> };
  const panel7 = new Map(String(DC7.mats.works?.["Wall_Simple_2Sides_5x3.prefab"] ?? "").split(";").filter((p) => p.includes("=")).map((p) => p.split("=") as [string, string]));
  const plated7 = !!W7.plates && panel7.get("ConcretePannelsPerforated00") === W7.plates && panel7.get("PlasterDirt00") === W7.plates && panel7.get("Concrete01") === W7.wallMat && panel7.get("PlasterPannelsDirt00") === W7.wallMat;
  // (a base round each hall pad: the pack's cap ring on its spot, its rim lit, the rim's inside outside the pad's ring of light)
  const PB7 = W7.upper.padBase;
  const hallPads7 = ((cfg as unknown as { spine: { up: Array<{ id: string; pad: number[] }> } }).spine.up).filter((q) => q.id === "works-a" || q.id === "works-b");
  const ringOut7 = (cfg.game as unknown as { padRings: { outer: number } }).padRings.outer;
  // (its wear the config's own since Milestone 1100: a plain collar round a dark plate, the teal glow read as a ragged decal)
  const based7 = hallPads7.filter((q) => !!PB7 && CH7.some((b) => String(b[0]).endsWith(`/${PB7.piece}`) && Math.hypot(Number(b[1]) - q.pad[0], Number(b[3]) - q.pad[1]) < 0.05 && String(b[6] ?? "") === PB7.mat && Number(b[8] ?? 1) * 2.186 > ringOut7 + 0.01 && b[5] === "g"));
  check(
    "THE WORKS' halls: every hall's floor tiled whole in its concrete, the fill's spots over its halls at their own height under the slab and none at the old 3 m, the yard's panels' faces bolted plates and their edges the halls' rust, a lit ring round each of the atrium's two pads",
    !!W7.floor && bare7.length === 0 && hallRects7.length >= 6 && own7 === hallRects7.length && lowSpots7 === 0 && plated7 && hallPads7.length === 2 && based7.length === 2,
    `floors ${floors7.map((f) => `${f.id} ${f.area} of ${f.want} m2`).join(", ")}; ${own7} of ${hallRects7.length} hall rects at their own height, ${lowSpots7} with spots at the old height; the yard's panels ${plated7 ? "plated" : [...panel7.values()].join(", ") || "none"}; ${based7.length} of ${hallPads7.length} pads on a lit base`,
  );
}

// THE WORKS' yard as set pieces (Milestone 1100; the districts' fifteenth reviews of version 140, THE WORKS 6.7 and 6.1, d24 and d22:
// "recompose the yard into 3 or 4 deliberate container and pipe-rack positions with lanes between, plus a crane; drop the evenly
// scattered crate piles; the crates a rust texture", "texture the outdoor ground: concrete slabs, oil stains, bay lines, drains",
// "plain rust and olive paint for the camo"; d23: "the pad rings irregular decals"): no fill piece on THE WORKS' ground; each set
// piece laid whole, its legs on no street node and across no grid link, a standing body's room under the rack's pipes; no crate or
// container of THE WORKS in the cracked olive; its ground the slabs, an oily apron and a drain at each ring-road door, bays off its
// lines; each atrium pad's base a plain collar round a dark plate lying between the hall's floor and the ring of light
{
  type YS8 = { id: string; parts: unknown[][]; boxes: number[][] };
  const W8 = (cfg.rules.districts as unknown as { works: { chunk: string; halls: Array<{ box: number[]; doors: Record<string, number[]> }>; floor: { y: number }; yardSets?: YS8[]; yardGround?: { apron: { piece: string; mat: string; at: number[][] }; drain: { piece: string; at: number[][] }; stub: { piece: string; mat: string; at: number[][] } }; upper: { padBase?: { piece: string; scale: number; mat: string; y?: number } } } }).works;
  const CH8 = cfg.chunks as unknown as Record<string, { place: unknown[][] }>;
  const P8 = CH8[W8.chunk]?.place ?? [];
  const S8 = SOLIDS.solids as number[][];
  // (1 the fill: none of its pieces on THE WORKS' ground)
  const fill8 = ((cfg as unknown as { districtCover?: Array<{ d: string; post?: string }> }).districtCover ?? []).filter((q) => q.d === "works" && !q.post).length;
  // (2 the set pieces: each recorded whole, its boxes in the collision, its legs off the bots' grid as the positions' are)
  const rec8 = (cfg as unknown as { works?: { yardSets?: Array<{ id: string; parts: number; boxes: number[][] }> } }).works?.yardSets ?? [];
  const sets8 = W8.yardSets ?? [];
  const whole8 = sets8.filter((s) => rec8.some((r) => r.id === s.id && r.parts === s.parts.length) && s.boxes.every((b) => S8.some((q) => [0, 1, 2, 3, 4, 5].every((i) => Math.abs(q[i] - b[i]) < 0.03))));
  const GN8 = map.nodes as unknown as Array<{ x: number; z: number; y?: number }>;
  const street8 = GN8.map((n) => ({ x: n.x - BR_X, z: n.z - BR_Z, y: n.y ?? 0 })).filter((q) => Math.abs(q.y) < MOVE.stepHeight);
  const atNode8 = new Set(street8.map((q) => `${Math.round(q.x)},${Math.round(q.z)}`));
  const gap8 = (b: number[], x0: number, x1: number, z0: number, z1: number) => Math.hypot(Math.max(0, b[0] - Math.max(x0, x1), Math.min(x0, x1) - b[1]), Math.max(0, b[2] - Math.max(z0, z1), Math.min(z0, z1) - b[3]));
  const legs8 = sets8.flatMap((s) => s.boxes.filter((b) => b[4] < MOVE.standHeight).map((b) => ({ id: s.id, b })));
  const grid8: string[] = [];
  for (const { id, b } of legs8)
    for (const q of street8) {
      if (q.x > b[0] - MOVE.radius && q.x < b[1] + MOVE.radius && q.z > b[2] - MOVE.radius && q.z < b[3] + MOVE.radius) grid8.push(`${id} on (${q.x}, ${q.z})`);
      for (const [dx, dz] of [[10, 0], [0, 10]])
        if (atNode8.has(`${Math.round(q.x + dx)},${Math.round(q.z + dz)}`) && gap8(b, q.x, q.x + dx, q.z, q.z + dz) < 0.5 + MOVE.radius + 0.05) grid8.push(`${id} by (${q.x}, ${q.z})-(${q.x + dx}, ${q.z + dz})`);
    }
  const over8 = sets8.flatMap((s) => s.boxes.filter((b) => b[4] >= MOVE.standHeight));
  const low8 = over8.filter((b) => b[4] < MOVE.standHeight + 0.5).length;
  const rack8 = sets8.some((s) => s.parts.some((q) => /Pipe_/.test(String(q[0]))) && s.boxes.some((b) => b[4] >= MOVE.standHeight + 0.5));
  const crane8 = sets8.some((s) => s.parts.some((q) => /BeamStructure/.test(String(q[0]))) && s.boxes.filter((b) => b[5] > 5).length >= 4);
  // (3 the crates and containers: none of THE WORKS' in the cracked olive, its kit's crate nowhere in it)
  const DC8 = cfg.rules.dress.districtCover as unknown as { mats: Record<string, Record<string, string>>; posts?: Array<{ id: string; d: string; parts: unknown[][] }> };
  const camoKit8 = /MetalPaintGreyCracked00/.test(DC8.mats.works?.["Crate00.prefab"] ?? "");
  const camoPosts8 = (DC8.posts ?? []).filter((q) => q.d === "works" && q.parts.some((r) => /MetalPaintGreyCracked00/.test(String(r[7] ?? "")))).length;
  // (4 the ground: THE WORKS' side the slabs, an apron at each ring-road door with a drain in it, the bays)
  const GD8 = cfg.rules.ground as unknown as { districts: { sides: Record<string, string> } };
  const YG8 = W8.yardGround;
  const ringDoors8 = W8.halls.flatMap((h) => [...(h.box[2] === 115 ? (h.doors.n ?? []).map((a) => [a, h.box[2]]) : []), ...(h.box[0] === 115 ? (h.doors.w ?? []).map((a) => [h.box[0], a]) : [])]);
  const laidOf8 = (name: string, mat?: string) => P8.filter((q) => String(q[0]).endsWith(`/${name}`) && (mat === undefined || q[6] === mat) && q[5] === "g");
  const aprons8 = YG8 ? laidOf8(YG8.apron.piece, YG8.apron.mat) : [];
  const drains8 = YG8 ? laidOf8(YG8.drain.piece) : [];
  // (the stubs are the yard lines' own piece and paint, so counted off the layout's record)
  const stubs8 = (cfg as unknown as { works?: { yardGround?: { stubs: number } } }).works?.yardGround?.stubs ?? 0;
  const doorsDressed8 = ringDoors8.filter(([x, z]) => YG8 && YG8.apron.at.some(([ax, az]) => Math.hypot(ax - (x === 115 ? 112.5 : x), az - (x === 115 ? z : 112.5)) < 0.6) && YG8.drain.at.some(([dx, dz]) => Math.hypot(dx - (x === 115 ? 111.5 : x), dz - (x === 115 ? z : 111.5)) < 1.5));
  const slab8 = /^ConcreteTiles00/.test(GD8.districts.sides.se ?? "");
  // (5 the atrium pads' bases: plain, the grille kept dark, the plate between the floor and the ring of light)
  const PB8 = W8.upper.padBase;
  const plate8 = PB8 ? (PB8.y ?? 0) + 0.03 * PB8.scale : 0;
  const based8 = P8.filter((q) => PB8 && String(q[0]).endsWith(`/${PB8.piece}`) && q[6] === PB8.mat && !/[|~^]/.test(PB8.mat) && /MetalDotsGrid01=/.test(PB8.mat) && !q[7] && Math.abs(Number(q[2]) - (PB8.y ?? 0)) < 0.001).length;
  const between8 = plate8 > W8.floor.y + 0.004 && plate8 < 0.04 - 0.008;
  check(
    "THE WORKS' yard as set pieces: no fill piece on its ground, a pipe rack and a gantry crane laid whole off the bots' grid with a body's room under the pipes, no camouflage olive on its crates or containers, its ground in slabs with an oily apron and a drain at each ring-road door and bays off its lines, each atrium pad on a plain collar round a dark plate under its ring of light",
    fill8 === 0 && sets8.length >= 2 && whole8.length === sets8.length && rack8 && crane8 && grid8.length === 0 && low8 === 0 && !camoKit8 && camoPosts8 === 0 && slab8 && !!YG8 && aprons8.length >= 6 && drains8.length >= 6 && stubs8 >= 6 && doorsDressed8.length === ringDoors8.length && ringDoors8.length === 6 && based8 === 2 && between8,
    `${fill8} fill pieces on its ground; ${whole8.length} of ${sets8.length} set pieces whole (a rack ${rack8}, a crane ${crane8}), ${grid8.length ? grid8.slice(0, 3).join("; ") : "its legs off the grid"}, ${low8} boxes overhead too low; olive on the kit's crate ${camoKit8}, on ${camoPosts8} positions; the slabs ${slab8}, ${aprons8.length} aprons, ${drains8.length} drains, ${stubs8} bay stubs, ${doorsDressed8.length} of ${ringDoors8.length} ring-road doors dressed; ${based8} of 2 pad bases plain round a dark plate, the plate at ${plate8.toFixed(4)} m (${between8 ? "between the floor and the ring" : "not between the floor and the ring"})`,
  );
}

// THE TERRACES and THE STACKS (Milestone 1085; the districts' thirteenth reviews of version 138, 2026-11-06, THE TERRACES 6.0 and
// 5.9, THE STACKS 6.0 and 6.0). THE TERRACES: "slimmer pergolas", "the pergola posts oversized, the wood stretched", "terracotta
// pots for the yellow-black planters" (d05), "the name larger, lamps on the dark approach", "the gate sign" (d04), "the lawn
// empty". THE STACKS: "a cover line across the court's middle" (d11), "its roof two or three sets, a pink rail, a roof surface
// for the wet cobble" (d12), "blends into the centre's browns from above" (d00)
{
  type Pl85 = [string, number, number, number, number, string, (string | null)?, unknown?, (number | null)?];
  const CH85 = (cfg as unknown as { chunks: Record<string, { place: Pl85[] }> }).chunks;
  const remap85 = (s: unknown) => new Map(String(s ?? "").split(";").filter((p) => p.includes("=")).map((p) => p.split("=") as [string, string]));
  type Tr85 = { chunk: string; tiers: number[][]; raised: number[][]; ramp: { flight: { z: number[] } }; garden: { pots?: Record<string, string>; pergola: { post: string; beam: string; seats?: { piece: string } }; approach?: { piece: string } }; gate: { attic: { h: number } }; name: { at: number[]; w: number; h: number } };
  const DT85 = (cfg.rules.districts as unknown as { terraces: Tr85 }).terraces;
  const TC85 = (cfg as unknown as { terraces: { solids: number[][]; pergolas: number[][]; gate: number[]; seats?: number[][]; approach?: number[][] } }).terraces;
  const TP85 = CH85[DT85.chunk]?.place ?? [];
  const said85: string[] = [];
  let ok85 = true;
  const part85 = (ok: boolean, text: string) => {
    if (!ok) ok85 = false;
    said85.push(`${ok ? "" : "NOT: "}${text}`);
  };
  const typedAt85 = (bs: number[][], x: number, z: number, y: number, lo: number, hi: number) => bs.some((b) => b[0] < x && b[1] > x && b[2] < z && b[3] > z && Math.abs(b[4] - y) < 0.01 && b[5] - b[4] >= lo && b[5] - b[4] <= hi);
  // (1) the pits terracotta: no garden pit of THE TERRACES (or of its kit on the ground) in the pack's lit cross panel
  // (Concrete_Lgt 5): each wears it as an unlit material (a "|" or "^" spec glows, and a Concrete_Lgt is the pack's lit panel)
  const lit85 = (spec?: string) => !spec || /[|^]/.test(spec) || spec.startsWith("Concrete_Lgt");
  const pits85 = TP85.filter((q) => String(q[0]).split("/").pop()!.startsWith("GardenPit"));
  const unworn85 = pits85.filter((q) => lit85(remap85(q[6]).get("Concrete_Lgt 5")));
  const DC85 = cfg.rules.dress.districtCover as unknown as { mats: Record<string, Record<string, string>>; sets: Record<string, Array<{ parts: unknown[][] }>> };
  const kit85 = [...new Set((DC85.sets.terraces ?? []).flatMap((s) => s.parts.map((p) => String(p[0]))).filter((n) => n.startsWith("GardenPit")))];
  const kitLit85 = kit85.filter((n) => lit85(remap85(DC85.mats.terraces?.[n]).get("Concrete_Lgt 5")));
  part85(pits85.length >= 80 && unworn85.length === 0 && kitLit85.length === 0, `${pits85.length - unworn85.length} of ${pits85.length} pits terracotta${kitLit85.length ? `, the kit's ${kitLit85.join(", ")} lit` : ""}`);
  // (2) the pergolas slim, their grain along each member: every post piece 0.275 m across and less, every beam and joist 0.3 m and
  // less, each in a wear whose every material lays its uvs off the map ("@m"); a typed post at each post, 0.3 m across and less
  const PG85 = DT85.garden.pergola;
  const grain85 = (q: Pl85) => {
    const v = [...remap85(q[6]).values()];
    return v.length > 0 && v.every((s) => /^Wood.*@[0-9.]+$/.test(s));
  };
  const posts85 = TP85.filter((q) => String(q[0]).endsWith(`/${PG85.post}`));
  const fat85 = posts85.filter((q) => Number(q[8] ?? 1) * 0.5 > 0.275 || !grain85(q));
  const beams85 = TP85.filter((q) => String(q[0]).endsWith(`/${PG85.beam}`) && /Wood/.test(String(q[6] ?? "")));
  const thick85 = beams85.filter((q) => Number(q[8] ?? 1) * 0.5 > 0.3 || !grain85(q));
  const typedPosts85 = TC85.solids.filter((b) => TC85.pergolas.some((p) => Math.abs(b[4] - p[4]) < 0.01 && b[5] - b[4] > 2 && (b[0] + b[1]) / 2 > p[0] - 0.01 && (b[0] + b[1]) / 2 < p[1] + 0.01 && [p[2], p[3]].some((z) => Math.abs((b[2] + b[3]) / 2 - z) < 0.01)));
  const wide85 = typedPosts85.filter((b) => b[1] - b[0] > 0.3 || b[3] - b[2] > 0.3);
  part85(TC85.pergolas.length === 2 && posts85.length >= 24 && fat85.length === 0 && beams85.length >= 8 && thick85.length === 0 && typedPosts85.length >= 12 && wide85.length === 0,
    `the pergolas' ${posts85.length} post pieces (${fat85.length} thick or with their grain unlaid), ${beams85.length} beams and joists (${thick85.length} thick or unlaid), ${typedPosts85.length} typed posts (${wide85.length} past 0.3 m)`);
  // (3) the benches by the pergolas: four and more, each typed on the top tier, a bench's height
  const seats85 = TC85.seats ?? [];
  const seated85 = seats85.filter(([x, z, y]) => typedAt85(TC85.solids, x, z, y, 0.6, 1.3));
  part85(!!PG85.seats && seats85.length >= 4 && seated85.length === seats85.length, `${seats85.length} benches by the pergolas, ${seated85.length} typed on the tier`);
  // (4) the name twice the size on the gate's attic: its letters (0.62 of the plate's height, or less where its text, about 6.05
  // times its letters' height off d04, would pass 0.9 of the plate's width: src/game/neonmap.ts neonLetters) 3.4 m and more, the
  // plate on the attic's face (its height within the attic's, its width inside the end walls)
  const [, , gz0_, gz1_, , gTop85] = TC85.gate;
  const aBot85 = gTop85 - DT85.gate.attic.h;
  const N85 = DT85.name;
  const letters85 = Math.min(0.62 * N85.h, (0.9 * N85.w) / 6.05);
  const onAttic85 = N85.at[1] - N85.h / 2 >= aBot85 - 0.01 && N85.at[1] + N85.h / 2 <= gTop85 + 0.01 && Math.abs(N85.at[2] - (gz0_ + gz1_) / 2) + N85.w / 2 <= (gz1_ - gz0_) / 2 - 0.25;
  part85(letters85 >= 3.4 && onAttic85, `the name's letters about ${letters85.toFixed(2)} m on a ${N85.w} by ${N85.h} m plate ${onAttic85 ? "on" : "off"} the attic's ${(gTop85 - aBot85).toFixed(1)} m face`);
  // (5) the approach's lamps: four and more of a piece the game pools by night, each on the promenade (between the first tier's
  // front and the band's edge, on the street's floor, where its pool cannot spill), off the grand stair's walked lanes, its post typed
  const PO85 = (cfg.game as unknown as { pools: { sets: Array<{ pieces: string[] }> } }).pools.sets.flatMap((s) => s.pieces);
  const AP85 = DT85.garden.approach;
  const front85 = Math.max(...DT85.tiers.map((t) => t[1]));
  const edge85 = Math.max(...DT85.raised.map((r) => r[1]));
  const lane85 = Math.max(...DT85.ramp.flight.z.map(Math.abs)) + 2.25;
  const lamps85 = TC85.approach ?? [];
  const lampOk85 = lamps85.filter(([x, z, y]) => x > front85 && x < edge85 && y === 0 && Math.abs(z) >= lane85 && typedAt85(TC85.solids, x, z, y, 4, 7));
  part85(!!AP85 && PO85.includes(AP85.piece) && lamps85.length >= 4 && lampOk85.length === lamps85.length, `${lamps85.length} lamps on the approach, ${lampOk85.length} on the promenade off the stair's lanes, their posts typed${AP85 && PO85.includes(AP85.piece) ? ", pooled by night" : ""}`);
  // (6) THE STACKS' roof pink: every deck tile of its roof and every rail of the hotel in a pink wear, no rail in its clover glass
  type Ho85 = { roof: number; deck: string; roofMat?: string; rail: { mat?: string }; roofSets?: unknown[]; line?: Array<{ piece: string; at: number[] }> };
  const DS85 = (cfg.rules.districts as unknown as { stacks: { chunk: string; hotel: Ho85 } }).stacks;
  const H85 = DS85.hotel;
  const SP85 = CH85[DS85.chunk]?.place ?? [];
  const pink85 = (spec?: string) => !!spec && /#ff8fe8|#ff4fd8/i.test(spec);
  const tiles85 = SP85.filter((q) => String(q[0]).endsWith(`/${H85.deck}`) && Math.abs(q[2] - H85.roof) < 0.01);
  const greyTiles85 = tiles85.filter((q) => !pink85(remap85(q[6]).get("PavementDirtTiles00b")));
  const rails85 = SP85.filter((q) => /\/FenceElegant00_x/.test(String(q[0])));
  const green85 = rails85.filter((q) => {
    const m = remap85(q[6]);
    return !pink85(m.get("MetalPaintWhiteCracked00b")) || !pink85(m.get("CrystalPattern03"));
  });
  part85(tiles85.length >= 100 && greyTiles85.length === 0 && rails85.length >= 60 && green85.length === 0, `${tiles85.length - greyTiles85.length} of ${tiles85.length} roof tiles pink, ${rails85.length - green85.length} of ${rails85.length} rails pink`);
  // (7) the roof's sets: two and more, each three typed boxes and more standing on the roof (1 to 2.5 m), a set the boxes within
  // a metre of one another
  const ST85 = (cfg as unknown as { stacks: { solids: number[][] } }).stacks;
  const onRoof85 = ST85.solids.filter((b) => Math.abs(b[4] - H85.roof) < 0.01 && b[5] - b[4] >= 1 && b[5] - b[4] <= 2.5);
  const up85 = onRoof85.map((_, i) => i);
  const find85 = (i: number): number => (up85[i] === i ? i : (up85[i] = find85(up85[i])));
  onRoof85.forEach((a, i) => onRoof85.forEach((b, j) => {
    if (j > i && a[0] < b[1] + 1 && b[0] < a[1] + 1 && a[2] < b[3] + 1 && b[2] < a[3] + 1) up85[find85(i)] = find85(j);
  }));
  const sizes85 = [...onRoof85.reduce((m, _, i) => m.set(find85(i), (m.get(find85(i)) ?? 0) + 1), new Map<number, number>()).values()];
  const sets85 = sizes85.filter((n) => n >= 3).length;
  part85((H85.roofSets ?? []).length >= 2 && sets85 >= 2, `${sets85} sets of three and more on the roof (${onRoof85.length} typed boxes)`);
  // (8) the court's line: along the line's z, in each of the court's four cells of the bots' 10 m grid (x -145 to -105), a box from
  // the floor past a crouched head's 1.15 m within 1.5 m of it; two cars and two cabinets on it; and a player walks across it
  // through its two middle gaps, along the grid's lines
  const lz85 = (H85.line ?? []).length ? (H85.line ?? []).reduce((s, q) => s + q.at[1], 0) / (H85.line ?? []).length : NaN;
  const cells85 = [[-142, -135], [-135, -125], [-125, -115], [-115, -105]];
  const covered85 = cells85.filter(([x0, x1]) => solidsIn(x0 + BR_X, x1 + BR_X, lz85 - 1.5 + BR_Z, lz85 + 1.5 + BR_Z).some((q) => q.base < 0.3 && q.top > 1.15 && q.maxX > x0 + BR_X && q.minX < x1 + BR_X && q.maxZ > lz85 - 1.5 + BR_Z && q.minZ < lz85 + 1.5 + BR_Z));
  const onLine85 = ["c-stacks", "c-dcover"].flatMap((k) => CH85[k]?.place ?? []).filter((q) => q[1] > -142 && q[1] < -105 && Math.abs(q[3] - lz85) < 2.5 && q[2] < 1);
  const cars85 = onLine85.filter((q) => /\/UrbanCar/.test(String(q[0]))).length;
  const cabinets85 = onLine85.filter((q) => /\/(Coolbox01d|TicketMachine00)/.test(String(q[0]))).length;
  const crossed85 = [-135, -125].filter((x) => along([[x, lz85 - 5, 0], [x, lz85 + 5, 0]]).k === 2 && along([[x, lz85 + 5, 0], [x, lz85 - 5, 0]]).k === 2);
  part85(covered85.length === 4 && cars85 >= 2 && cabinets85 >= 2 && crossed85.length === 2, `the court's line at z ${lz85.toFixed(1)}: cover in ${covered85.length} of 4 cells, ${cars85} cars, ${cabinets85} cabinets, crossed at ${crossed85.length} of its 2 middle gaps`);
  check("THE TERRACES and THE STACKS (Milestone 1085): THE TERRACES' pits terracotta, its pergolas slim with the grain along them and benches by them, its name twice the size on a taller attic, lamps on its approach; THE STACKS' roof and rails pink, sets on its roof, a line of cars and cabinets across its court", ok85, said85.join("; "));
}

// The plaza round the base a designed set (rules.dress.plaza, Milestone 1088; the centre's nineteenth reviews of picture 06,
// both: "the plaza designed: sunken planters, kiosks, low L-walls round the base, paving with light lines from the tower", "a
// flat kill bowl", "the plaza a place to fight: paving, a central feature, two cover clusters"): every set laid whole and each
// part standing in the collision; the ring round the base's foot with a gap a body and a hand wide in front of every ground
// gate on its four straight faces (none of its own boxes there), and a player walking through it onto the gate's out point
// wherever the ground beyond it is open; two cover clusters, each a panel over a standing body's chest, a crate stack two high and a planter; the centrepiece's
// sign column on the east axis between the base and the Sky Ring's stair, a name lit on each of its four faces; no part on a
// street node or within a body and half a metre of a grid line between two (as the districts' positions), on a light line,
// within a spine pad's ring or its run-up or by the Sky Ring's stairs; no street cover on the plaza; its ground a field of
// pale flags in each straight face's band, every rect of it inside the plaza, none of its flags outside them
{
  type Set88 = { id: string; at: number[]; turn: number; parts: unknown[][] };
  type PZ88 = { chunk: string; sets: Set88[]; ring: { out: number; gap: number }; paving?: { tile: string; field: string; rects: number[][] } };
  type Laid88 = { set: string; piece: string; c: number[]; yaw: number; hu: number; hv: number; y: number; top: number };
  const PZ88 = (cfg.rules.dress as unknown as { plaza?: PZ88 }).plaza;
  const LP88 = (cfg as unknown as { plaza?: Laid88[] }).plaza ?? [];
  const S88 = (SOLIDS as { solids: number[][] }).solids;
  const CAPS88 = (cfg.rules as unknown as { collision: { caps: { pieces: string[] } } }).collision.caps.pieces;
  const OL88 = (cfg as unknown as { base: { outline: number[][]; gates: Array<{ at: number; out: number[]; in: number[] }> } }).base;
  const CV88 = cfg.rules.streets.curves as unknown as { road: number; pave: number; loop: { r: number } };
  const rIn88 = CV88.loop.r - CV88.road / 2 - CV88.pave;
  const inBase88 = (x: number, z: number) => {
    let s = false;
    const p = OL88.outline;
    for (let i = 0, j = p.length - 1; i < p.length; j = i++) if (p[i][1] > z !== p[j][1] > z && x < ((p[j][0] - p[i][0]) * (z - p[i][1])) / (p[j][1] - p[i][1]) + p[i][0]) s = !s;
    return s;
  };
  const onPlaza88 = (x: number, z: number) => Math.hypot(x, z) < rIn88 && !inBase88(x, z);
  // (the collision about the plaza a 2 m cell at a time)
  const grid88 = new Map<string, number[][]>();
  for (const b of S88) {
    if (b[4] > 2 || b[5] < 0.3 || b[1] < -46 || b[0] > 46 || b[3] < -46 || b[2] > 46) continue;
    for (let i = Math.floor(b[0] / 2); i <= Math.floor(b[1] / 2); i++) for (let j = Math.floor(b[2] / 2); j <= Math.floor(b[3] / 2); j++) (grid88.get(`${i},${j}`) ?? grid88.set(`${i},${j}`, []).get(`${i},${j}`)!).push(b);
  }
  const boxesAt88 = (x0: number, x1: number, z0: number, z1: number) => {
    const out = new Set<number[]>();
    for (let i = Math.floor(x0 / 2); i <= Math.floor(x1 / 2); i++) for (let j = Math.floor(z0 / 2); j <= Math.floor(z1 / 2); j++) for (const b of grid88.get(`${i},${j}`) ?? []) if (b[0] < x1 && b[1] > x0 && b[2] < z1 && b[3] > z0) out.add(b);
    return [...out];
  };
  // (a part's footprint, a planter by its 1 m pit: its fern's fronds are drawn only)
  const fp88 = (q: Laid88) => {
    const a = (q.yaw * Math.PI) / 180;
    const pit = CAPS88.some((n) => q.piece.endsWith(n));
    return { c: q.c, u: [Math.cos(a), -Math.sin(a)], v: [Math.sin(a), Math.cos(a)], hu: pit ? 0.5 : q.hu, hv: pit ? 0.5 : q.hv };
  };
  type F88 = ReturnType<typeof fp88>;
  // (the distance from a point to a footprint, and from a segment to it, sampled every 5 cm)
  const ptDist88 = (o: F88, x: number, z: number) => {
    const [px, pz] = [x - o.c[0], z - o.c[1]];
    const [a, b] = [px * o.u[0] + pz * o.u[1], px * o.v[0] + pz * o.v[1]];
    return Math.hypot(Math.max(0, Math.abs(a) - o.hu), Math.max(0, Math.abs(b) - o.hv));
  };
  const segDist88 = (o: F88, p: number[], q: number[]) => {
    const n = Math.max(1, Math.ceil(Math.hypot(q[0] - p[0], q[1] - p[1]) / 0.05));
    let best = Infinity;
    for (let k = 0; k <= n; k++) best = Math.min(best, ptDist88(o, p[0] + ((q[0] - p[0]) * k) / n, p[1] + ((q[1] - p[1]) * k) / n));
    return best;
  };
  const sets88 = PZ88?.sets ?? [];
  // (1) each set whole: every part of it that collides recorded under it; each part on the ground standing in the collision, a
  // box from its foot to its top (or a crouched head's metre) under its footprint less 0.1 m
  const whole88 = sets88.filter((s) => LP88.filter((q) => q.set === s.id).length === s.parts.filter((p) => p[6] !== "g").length && LP88.some((q) => q.set === s.id));
  const soft88 = LP88.filter((q) => {
    if (q.y) return false;
    const o = fp88(q);
    const r = Math.hypot(o.hu, o.hv);
    return !boxesAt88(o.c[0] - r, o.c[0] + r, o.c[1] - r, o.c[1] + r).some((b) => b[4] < 0.3 && b[5] >= Math.min(q.top, 1) - 0.05 && ptDist88({ ...o, hu: Math.max(0.05, o.hu - 0.1), hv: Math.max(0.05, o.hv - 0.1) }, Math.max(b[0], Math.min(b[1], o.c[0])), Math.max(b[2], Math.min(b[3], o.c[1]))) === 0);
  });
  // (2) the ring: in front of each ground gate on a straight face (its way in square to the face), no box of the collision a
  // body stands against from its out point out past the ring's line half a metre, within half `gap` of its axis; and walked
  // through by a player from 1.5 m past the ring's line onto its out point, where that ground is open
  const gates88 = OL88.gates.filter((g) => g.at === 0 && (Math.abs(g.out[0] - g.in[0]) < 1e-6 || Math.abs(g.out[1] - g.in[1]) < 1e-6));
  const shut88: string[] = [];
  let walked88 = 0, faced88 = 0;
  for (const g of gates88) {
    const L = Math.hypot(g.out[0] - g.in[0], g.out[1] - g.in[1]);
    const u = [(g.out[0] - g.in[0]) / L, (g.out[1] - g.in[1]) / L];
    const reach = (PZ88?.ring.out ?? 2.5) - 1 + 0.5;
    const half = (PZ88?.ring.gap ?? 1.2) / 2;
    const [a, b] = [g.out, [g.out[0] + u[0] * reach, g.out[1] + u[1] * reach]];
    const [x0, x1] = [Math.min(a[0], b[0]) - (u[0] ? 0 : half), Math.max(a[0], b[0]) + (u[0] ? 0 : half)];
    const [z0, z1] = [Math.min(a[1], b[1]) - (u[1] ? 0 : half), Math.max(a[1], b[1]) + (u[1] ? 0 : half)];
    // (the set's own collision: a box with its middle within half a metre of one of its parts, the columns' reach; the Sky Ring's
    // north and south stairs stand 1.25 m off their gates' out points, as they did)
    const inWay = boxesAt88(x0, x1, z0, z1).filter((q) => q[4] < MOVE.standHeight && q[5] > MOVE.stepHeight && LP88.some((l) => !l.y && ptDist88(fp88(l), (q[0] + q[1]) / 2, (q[2] + q[3]) / 2) < 0.5));
    if (inWay.length) shut88.push(`(${g.out.join(", ")})`);
    const from = [g.out[0] + u[0] * (reach + 1), g.out[1] + u[1] * (reach + 1)];
    if (boxesAt88(from[0] - MOVE.radius, from[0] + MOVE.radius, from[1] - MOVE.radius, from[1] + MOVE.radius).some((q) => q[4] < MOVE.standHeight && q[5] > MOVE.stepHeight)) {
      faced88++;
      continue;
    }
    const p = new Player({ minX: BR_X - 400, maxX: BR_X + 400, minZ: BR_Z - 400, maxZ: BR_Z + 400 });
    p.teleport(from[0] + BR_X, 0.05, from[1] + BR_Z, (Math.atan2(u[0], u[1]) * 180) / Math.PI);
    let t = 5000;
    const want = Math.hypot(from[0] - g.out[0], from[1] - g.out[1]);
    for (let i = 0; i < 144 * 4; i++) {
      p.update(1 / 144, (t += 1 / 144), { held: (k: Action) => k === "forward", pressedNow: (_k: Action) => false }, 0, 1, false);
      if (Math.hypot(p.pos.x - BR_X - from[0], p.pos.z - BR_Z - from[1]) >= want) break;
    }
    if (Math.hypot(p.pos.x - BR_X - g.out[0], p.pos.z - BR_Z - g.out[1]) < 0.6 && Math.abs(p.pos.y) < 0.3) walked88++;
    else shut88.push(`(${g.out.join(", ")}) walked to (${(p.pos.x - BR_X).toFixed(1)}, ${(p.pos.z - BR_Z).toFixed(1)})`);
  }
  const ring88 = LP88.filter((q) => q.set.startsWith("ring-"));
  // (3) the clusters and (4) the centrepiece
  const clusters88 = sets88.filter((s) => s.id.startsWith("cluster-")).map((s) => {
    const mine = LP88.filter((q) => q.set === s.id);
    return { id: s.id, ok: mine.some((q) => !q.y && q.top >= 1.7) && mine.some((q) => q.y > 0.9 && q.top >= 2) && mine.some((q) => CAPS88.some((n) => q.piece.endsWith(n))) };
  });
  const faceX88 = Math.max(...OL88.outline.map((p) => p[0]));
  const SR88 = cfg.rules.skyring as unknown as { r0: number };
  const column88 = LP88.find((q) => q.set === "centrepiece" && q.top >= 4 && Math.abs(q.c[1]) < 0.5 && q.c[0] - q.hu > faceX88 + 1 && q.c[0] + q.hu < SR88.r0 - 2.4 - 2.375);
  const BD88 = (cfg.game as unknown as { boards: Array<{ text: string; at: number[]; yaw: number }> }).boards;
  const named88 = column88 ? BD88.filter((b) => Math.abs(b.at[0] - column88.c[0]) < column88.hu + 0.1 && Math.abs(b.at[2] - column88.c[1]) < column88.hv + 0.1 && (Math.abs(Math.abs(b.at[0] - column88.c[0]) - column88.hu) < 0.1 || Math.abs(Math.abs(b.at[2] - column88.c[1]) - column88.hv) < 0.1) && b.at[1] > 2 && b.at[1] < column88.top) : [];
  const faces88 = new Set(named88.map((b) => ((Math.round(b.yaw / 90) % 4) + 4) % 4)).size;
  // (5) clear of what the plaza keeps clear
  const GN88 = map.nodes as unknown as Array<{ x: number; z: number; y?: number }>;
  // (the plaza's nodes of the street's 10 m grid (game.graph) at any height under a part's top: a node a part stands on the game
  // raises onto its top, so a street node the part took is no street node in the map it is checked on (the raised grid's own
  // nodes between, on whatever stands, are no street's); and the grid's lines between the nodes under 2.5 m, the
  // street's and those raised onto a part, none of the Sky Ring's deck)
  const nodes88 = GN88.map((n) => ({ x: n.x - BR_X, z: n.z - BR_Z, y: n.y ?? 0 })).filter((q) => q.y > -0.3 && Math.hypot(q.x, q.z) < 50 && !inBase88(q.x, q.z) && [q.x, q.z].every((v) => Math.abs((v - 5) / 10 - Math.round((v - 5) / 10)) < 1e-3));
  const street88 = nodes88.filter((q) => q.y < 2.5);
  const atNode88 = new Map(street88.map((q) => [`${Math.round(q.x)},${Math.round(q.z)}`, q]));
  const OLs88 = (cfg.game as unknown as { outlines: Array<{ name: string; lines?: number[][]; side?: number }> }).outlines.filter((o) => o.name.startsWith("the plaza line") && o.lines);
  const SP88 = (cfg as unknown as { spine: { up: Array<{ id: string; pad: number[] }> } }).spine.up;
  const TO88 = new Map(((cfg.rules.pads as unknown as { spine: { up: Array<{ id: string; to: number[] }> } }).spine.up).map((u) => [u.id, u.to]));
  const stairs88 = (cfg.rules.skyring as unknown as { stairs: { at: number[] } }).stairs.at.map((deg) => [Math.cos((deg * Math.PI) / 180) * (SR88.r0 - 2.4), Math.sin((deg * Math.PI) / 180) * (SR88.r0 - 2.4)]);
  const near88: string[] = [];
  for (const q of LP88) {
    if (q.y) continue;
    const o = fp88(q);
    const tag = `${q.set} ${q.piece.split("/").pop()!.split(".")[0]}`;
    for (const n of nodes88) if (n.y <= q.top + 0.1 && ptDist88(o, n.x, n.z) < MOVE.radius) near88.push(`${tag} on node (${n.x}, ${n.z})`);
    for (const n of street88) {
      for (const [dx, dz] of [[10, 0], [0, 10]]) {
        const r = atNode88.get(`${Math.round(n.x + dx)},${Math.round(n.z + dz)}`);
        if (r && segDist88(o, [n.x, n.z], [r.x, r.z]) < 0.5 + MOVE.radius) near88.push(`${tag} by (${n.x}, ${n.z})-(${r.x}, ${r.z})`);
      }
    }
    for (const L of OLs88) {
      const [a, b] = [L.lines![0], L.lines![L.lines!.length - 1]];
      const d = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const [nx, nz] = [(-(b[1] - a[1]) / d) * (L.side ?? 0), ((b[0] - a[0]) / d) * (L.side ?? 0)];
      if ([1, -1].some((s) => segDist88(o, [a[0] + nx * s, a[1] + nz * s], [b[0] + nx * s, b[1] + nz * s]) < 0.25)) near88.push(`${tag} on ${L.name}`);
    }
    for (const s of SP88) {
      const to = TO88.get(s.id) ?? [0, 0];
      if (ptDist88(o, s.pad[0], s.pad[1]) < 2.5 || segDist88(o, s.pad, [s.pad[0] - to[0] * 5, s.pad[1] - to[1] * 5]) < 1.3) near88.push(`${tag} by pad ${s.id}`);
    }
    for (const [sx, sz] of stairs88) if ([[-1, -1], [1, -1], [1, 1], [-1, 1], [0, 0]].some(([a, b]) => ptDist88(o, sx + a * 2.6, sz + b * 2.6) < 1) || ptDist88(o, sx, sz) < 3.6) near88.push(`${tag} by the stair at (${sx.toFixed(1)}, ${sz.toFixed(1)})`);
  }
  // (6) no street cover on the plaza: no piece of the street fill with its footprint's middle there
  const cover88 = ((cfg as unknown as { streetCover?: Array<{ piece: string; c: number[] }> }).streetCover ?? []).filter((q) => onPlaza88(q.c[0], q.c[1]));
  // (7) its ground: each of the field's rects on the small tile's grid and inside the plaza, corner to corner; every small tile
  // in one worn in the field, none of the field's wear on the plaza outside them, no big tile over one
  const ground88 = (cfg.chunks as unknown as Record<string, { place: unknown[][] }>)["c-ground"]?.place ?? [];
  const bigEnd88 = String(cfg.rules.ground.tile);
  const rects88 = PZ88?.paving?.rects ?? [];
  const inField88 = (x: number, z: number) => rects88.some(([x0, x1, z0, z1]) => x > x0 && x < x1 && z > z0 && z < z1);
  const outRects88 = rects88.filter(([x0, x1, z0, z1]) => [[x0, z0], [x0, z1], [x1, z0], [x1, z1], [(x0 + x1) / 2, (z0 + z1) / 2]].some(([x, z]) => Math.hypot(x, z) > rIn88 + 1e-6 || inBase88(x, z)) || [x0, x1, z0, z1].some((v) => Math.abs(v / 2.5 - Math.round(v / 2.5)) > 1e-6));
  let field88 = 0;
  const wrong88: string[] = [];
  for (const q of ground88) {
    const name = String(q[0]);
    const [px, pz] = [Number(q[1]), Number(q[3])];
    if (name.endsWith(bigEnd88)) {
      for (let x = px + 1.25; x < px + 10; x += 2.5) for (let z = pz - 8.75; z < pz; z += 2.5) if (inField88(x, z)) wrong88.push(`a 10 m tile at (${px}, ${pz})`);
      continue;
    }
    if (!PZ88?.paving || !name.endsWith(PZ88.paving.tile)) continue;
    const [cx, cz] = [px + 1.25, pz - 1.25];
    if (inField88(cx, cz)) {
      if (q[6] === PZ88.paving.field) field88++;
      else wrong88.push(`(${cx}, ${cz}) ${q[6]}`);
    } else if (q[6] === PZ88.paving.field && onPlaza88(cx, cz)) wrong88.push(`(${cx}, ${cz}) the field's wear out of its rects`);
  }
  check(
    "the plaza a designed set: every set whole and standing, the ring round the base's foot with a gap walked through in front of every gate on its straight faces, two cover clusters (a panel over a chest, a crate stack two high, a planter), the sign column on the east axis named on its four faces, none of it on a street node, a grid line, a light line, a pad's ring or run-up or by the Sky Ring's stairs, no street cover on the plaza, its ground a field of pale flags in each straight face's band",
    !!PZ88 && sets88.length >= 20 && whole88.length === sets88.length && soft88.length === 0 && ring88.length >= 16 && gates88.length >= 15 && shut88.length === 0 && walked88 >= gates88.length - 3 &&
      clusters88.length >= 2 && clusters88.every((c) => c.ok) && !!column88 && faces88 === 4 && near88.length === 0 && cover88.length === 0 && rects88.length >= 4 && outRects88.length === 0 && wrong88.length === 0 && field88 >= 60,
    `${sets88.length} sets, ${whole88.length} whole, ${soft88.length} parts not standing${soft88.length ? ` (${soft88.slice(0, 2).map((q) => `${q.set} at ${q.c.join(", ")}`).join("; ")})` : ""}; the ring ${ring88.length} pieces, ${gates88.length} gates, ${walked88} walked through, ${faced88} faced by a set, ${shut88.length} shut${shut88.length ? ` (${shut88.slice(0, 3).join("; ")})` : ""}; clusters ${clusters88.map((c) => `${c.id} ${c.ok ? "whole" : "short"}`).join(", ") || "none"}; the column ${column88 ? `at (${column88.c.join(", ")}) ${column88.top} m, named on ${faces88} faces` : "none"}; ${near88.length} too near${near88.length ? ` (${near88.slice(0, 3).join("; ")})` : ""}; ${cover88.length} street cover pieces on the plaza; its ground ${field88} field tiles in ${rects88.length} rects (${outRects88.length} off the plaza or the grid), ${wrong88.length} wrong${wrong88.length ? ` (${wrong88.slice(0, 2).join("; ")})` : ""}`,
  );
}

// The bridge ring cut at two points (Milestone 1082; the centre's nineteenth reviews, A rank 8: "the High City ring cut at two
// points into gaps with a pad"; B: "the bridge ring one walkway, not parkour"): each of rules.bridges.gaps a straight cell of
// one of the ring's four paths that the layout left out, open over the street (no deck placed there and nothing of the
// collision across its void at the deck's height), and a pad on the deck either side that throws a body over onto the other:
// its spot and its mark at the deck's height on the deck's middle 3 m, the spot within 3 m of its lip, the mark on the far
// side so far past the far pad that a body thrown from the near edge of the pad's reach (squad.json pad.reach: the game throws
// a body from where it steps in, src/game/brplay.ts) lands out of the far pad's reach too; and each ridden from that edge by
// the game's own Player, landing on the far deck there. The walks either side are the bridges' own checks above
{
  const BG = cfg.rules.bridges as unknown as { deck: number; paths: number[][][]; straight: { piece: string }; gaps?: Array<{ at: number[]; pads: string[] }> };
  const GP = BG.gaps ?? [];
  const reachG = (await import("../../src/config/squad.json")).default.pad.reach;
  const placedG = (cfg.chunks as unknown as Record<string, { place: unknown[][] }>)["c-bridges"].place.filter((q) => String(q[0]).endsWith(`/${BG.straight.piece}`));
  const said: string[] = [];
  let ok = GP.length >= 2;
  for (const g of GP) {
    // (its leg: the ring's paths are the first four, a gap's cell a straight cell whole on one leg)
    let leg: number[] | null = null;
    for (const path of BG.paths.slice(0, 4))
      for (let k = 1; k < path.length; k++) {
        const [a, b] = [path[k - 1], path[k]];
        const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
        const u = [(b[0] - a[0]) / L, (b[1] - a[1]) / L];
        const s = (g.at[0] - a[0]) * u[0] + (g.at[1] - a[1]) * u[1];
        if (Math.abs((g.at[0] - a[0]) * u[1] - (g.at[1] - a[1]) * u[0]) < 0.01 && s >= 2.5 && s <= L - 2.5) leg = u;
      }
    if (!leg) {
      ok = false;
      said.push(`(${g.at.join(", ")}) no cell of the ring`);
      continue;
    }
    const d = leg;
    const along = (p: number[]) => (p[0] - g.at[0]) * d[0] + (p[1] - g.at[1]) * d[1];
    const across = (p: number[]) => (p[0] - g.at[0]) * d[1] - (p[1] - g.at[1]) * d[0];
    // (no deck there: a straight's middle is its pivot and half a cell along its own x, turned)
    const decked = placedG.filter((q) => {
      const a = ((q[4] as number) * Math.PI) / 180;
      return Math.hypot((q[1] as number) + Math.round(Math.cos(a)) * 2.5 - g.at[0], (q[3] as number) - Math.round(Math.sin(a)) * 2.5 - g.at[1]) < 0.5;
    }).length;
    // (and open: nothing of the collision over the gap's middle 4 by 3 m from a metre under the deck to two over it)
    const [ux, uz] = [Math.abs(d[0]) * 2 + Math.abs(d[1]) * 1.5, Math.abs(d[1]) * 2 + Math.abs(d[0]) * 1.5];
    const [x0, x1, z0, z1] = [g.at[0] - ux + BR_X, g.at[0] + ux + BR_X, g.at[1] - uz + BR_Z, g.at[1] + uz + BR_Z];
    const shut = solidsIn(x0, x1, z0, z1).filter((b) => b.maxX > x0 && b.minX < x1 && b.maxZ > z0 && b.minZ < z1 && b.top > BG.deck - 1 && b.base < BG.deck + 2).length;
    const mine = SPINE.across.map((q, k) => ({ q, k })).filter(({ q }) => g.pads.includes(q.id));
    const bad: string[] = [];
    if (decked || shut) bad.push(`${decked} decks placed, ${shut} boxes across its void`);
    if (mine.length !== 2 || new Set(mine.map(({ q }) => Math.sign(along(q.pad)))).size !== 2) bad.push(`${mine.length} pads, not one each side`);
    for (const { q, k } of mine) {
      const far = mine.find((o) => o.q !== q)?.q;
      const [sp, sl] = [along(q.pad), along(q.land)];
      const lip = Math.abs(sp) - 2.5;
      const fromFar = far ? Math.hypot(q.land[0] - far.pad[0], q.land[1] - far.pad[1]) : 0;
      if (Math.abs(q.floor - BG.deck) > 0.1 || Math.abs(q.landY - BG.deck) > 0.1 || lip < 0 || lip > 3 || Math.abs(across(q.pad)) > 1.5 || Math.abs(across(q.land)) > 1.5 || Math.sign(sl) === Math.sign(sp) || Math.abs(sl) < 3 || fromFar - reachG <= reachG + 0.2)
        bad.push(`${q.id}: its spot at ${q.floor} m ${lip.toFixed(2)} m in from its lip, its mark at ${q.landY} m on the ${Math.sign(sl) === Math.sign(sp) ? "same" : "far"} side, ${fromFar.toFixed(2)} m from the far pad`);
      // ridden from where a body steps into its reach: the game's own pad, the body set down on its reach's edge and two
      // thirds of the way in, every 15 degrees round the half of it behind the pad, wherever a body stands there (on a deck 3 m
      // between its rails, and a perch behind a pad, the way in is round its sides)
      const pad = map.pads[cfg.pads.length + SPINE.up.length + SPINE.down.length + k];
      const h = Math.hypot(pad.dx, pad.dz);
      const R9 = MOVE.radius;
      const stands = (x: number, z: number, y: number) => {
        const here = solidsIn(x - R9, x + R9, z - R9, z + R9).filter((b) => b.minX < x + R9 && b.maxX > x - R9 && b.minZ < z + R9 && b.maxZ > z - R9);
        return here.some((b) => Math.abs(b.top - y) < 0.1) && !here.some((b) => b.base < y + MOVE.standHeight && b.top > y + MOVE.stepHeight);
      };
      let rode = 0;
      let worst = Infinity;
      for (const rr of [reachG - 0.05, reachG * 0.66]) for (let deg = -90; deg <= 90; deg += 15) {
        const a = (deg * Math.PI) / 180;
        const [bx, bz] = [-(pad.dx / h), -(pad.dz / h)];
        const [ox, oz] = [(bx * Math.cos(a) - bz * Math.sin(a)) * rr, (bx * Math.sin(a) + bz * Math.cos(a)) * rr];
        if (!stands(pad.x + ox, pad.z + oz, pad.y ?? 0)) continue;
        const p = new Player({ minX: BR_X - 400, maxX: BR_X + 400, minZ: BR_Z - 400, maxZ: BR_Z + 400 });
        p.teleport(pad.x + ox, pad.y ?? 0, pad.z + oz, 0);
        const DT = 1 / 144;
        let t = 1000;
        for (let i = 0; i < 20; i++) p.update(DT, (t += DT), idle, 0, 1, false);
        p.impulse(pad.dx, pad.up ?? 0, pad.dz);
        for (let i = 0; i < 4 / DT; i++) {
          p.update(DT, (t += DT), idle, 0, 1, false);
          if (p.onGround) break;
        }
        rode++;
        const at = [p.pos.x - BR_X, p.pos.z - BR_Z];
        const out = far ? Math.hypot(at[0] - far.pad[0], at[1] - far.pad[1]) : 0;
        worst = Math.min(worst, out);
        if (!p.onGround || Math.abs(p.pos.y - BG.deck) > 0.3 || Math.sign(along(at)) === Math.sign(sp) || out <= reachG) bad.push(`${q.id} ridden from ${rr.toFixed(2)} m off its middle ${deg} degrees off straight behind to (${at.map((v) => v.toFixed(1)).join(", ")}) at ${p.pos.y.toFixed(2)} m, ${out.toFixed(2)} m from the far pad`);
      }
      if (rode < 1) bad.push(`${q.id}: no spot of its reach a body stands on`);
      else said.push(`${q.id} ridden from ${rode} spots of its reach onto the far deck, ${worst.toFixed(1)} m and more from the far pad`);
    }
    if (bad.length) {
      ok = false;
      said.push(`(${g.at.join(", ")}): ${bad.join("; ")}`);
    }
  }
  check("the bridge ring cut at two points: each gap a straight cell of the ring left out and open over the street, a pad on the deck either side throwing a body over onto the far deck, past the far pad's reach even thrown from the edge of its own", ok, said.join("; "));
}

// The High City decks' rooflines and the lookout's walled middle (Milestone 1082; the centre's nineteenth reviews, B rank 5: "the
// bare tops covered: skylight boxes, HVAC rows, antennas on the teal roof, a low-walled raised centre on the lookout"; A rank 8:
// "chest-high cover on the bare roof"; rules.highCover.roofs.roofline): each deck's rows of cooling plant, three in line a metre
// apart, each between a crouched body's height and a standing eye's over its roof (`chest`); a mast over 9 m on the decks named;
// on the lookout's raised middle (its cells 1.5 m over the lookout's floor, read off the collision) the walls `wall` metres tall
// standing on it at its edges (a drop to the floor within half a metre past one long side), a way up left on `sides` of its four
// sides and more (a stretch of the side's edge 2 m long with no piece within half a metre of it), and the chest on it. The
// pieces' ways, floors and laid boxes are the roofs check's ("the roofs dressed")
{
  type Row = [string, string, number, number, number, number, number, string?];
  type RL9 = { row: string; mast: string; rows: Record<string, number>; masts: string[]; chest: number[]; wall: number[]; chestPiece: string; sides: number };
  const HCR = (cfg.rules as unknown as { highCover: { at: Row[]; roofs: { roofline?: RL9 } } }).highCover;
  const RL = HCR.roofs.roofline;
  const HCo = (cfg as unknown as { highCover?: Record<string, number[][]> }).highCover ?? {};
  const said: string[] = [];
  let ok = !!RL;
  // (a group's rows paired with what the layout wrote for them, in order)
  const pairs = (g: string) => {
    const rows = HCR.at.filter((r) => r[0] === g);
    return rows.map((r, k) => ({ r, q: (HCo[g] ?? [])[k] }));
  };
  if (RL) {
    for (const [g, want] of Object.entries(RL.rows)) {
      const plant = pairs(g).filter(({ r }) => r[1] === RL.row);
      let rows = 0;
      for (const { r, q } of plant) {
        const tall = q ? q[3] - q[2] : 0;
        const inLine = plant.filter((o) => o.r !== r && Math.abs(o.r[2] - r[2]) < 0.01 && Math.abs(Math.abs(o.r[3] - r[3]) - 1) < 0.01).length;
        if (inLine === 2 && tall > RL.chest[0] && tall < RL.chest[1]) rows++;
      }
      const masts = pairs(g).filter(({ r, q }) => r[1] === RL.mast && !!q && q[3] - q[2] > 9).length;
      if (rows < want || masts < (RL.masts.includes(g) ? 1 : 0)) ok = false;
      said.push(`${g} ${rows} of ${want} rows chest-high, ${masts} masts`);
    }
    // (the lookout's floor the middle of its perch's height, the raised middle 1.5 m over it, measured)
    const LKp = (cfg.rules.perches as unknown as Array<{ name: string; y: number[] }>).find((p) => p.name === "lookout")!.y;
    const LKy = (LKp[0] + LKp[1]) / 2;
    const mid = LKy + 1.5;
    const footOf = (q: number[]) => {
      const t = ((q[6] % 180) + 180) % 180 === 90;
      const [hx, hz] = t ? [q[5], q[4]] : [q[4], q[5]];
      return [q[0] - hx, q[0] + hx, q[1] - hz, q[1] + hz];
    };
    // (the highest box under a point below 3 m over the floor: the middle's own top, the floor's, a wall's)
    const topAt9 = (x: number, z: number) => solidsIn(x + BR_X, x + BR_X, z + BR_Z, z + BR_Z).reduce((m, b) => (x + BR_X >= b.minX && x + BR_X <= b.maxX && z + BR_Z >= b.minZ && z + BR_Z <= b.maxZ && b.base < mid - 0.2 ? Math.max(m, b.top) : m), -Infinity);
    const W = pairs("lookout-wall").filter(({ r, q }) => r[1] !== RL.chestPiece && !!q);
    const walls = W.filter(({ q }) => q[3] - q[2] >= RL.wall[0] && q[3] - q[2] <= RL.wall[1] && Math.abs(q[2] - mid) < 0.1);
    const onEdge = walls.filter(({ q }) => {
      const f = footOf(q);
      const alongX = f[1] - f[0] > f[3] - f[2];
      const probes = alongX ? [[(f[0] + f[1]) / 2, f[2] - 0.5], [(f[0] + f[1]) / 2, f[3] + 0.5]] : [[f[0] - 0.5, (f[2] + f[3]) / 2], [f[1] + 0.5, (f[2] + f[3]) / 2]];
      return probes.some(([x, z]) => topAt9(x, z) < LKy + 0.6);
    });
    let [x0, x1, z0, z1] = [Infinity, -Infinity, Infinity, -Infinity];
    for (let x = 4; x <= 20; x += 0.25) for (let z = -12; z <= 2; z += 0.25) if (Math.abs(topAt9(x, z) - mid) < 0.1) [x0, x1, z0, z1] = [Math.min(x0, x), Math.max(x1, x), Math.min(z0, z), Math.max(z1, z)];
    const pieces = [...(HCo["lookout-wall"] ?? []), ...(HCo["lookout-mid"] ?? [])].map(footOf);
    const sides = [[x0, z0, x1, z0], [x1, z0, x1, z1], [x0, z1, x1, z1], [x0, z0, x0, z1]].filter(([ax, az, bx, bz]) => {
      const L = Math.hypot(bx - ax, bz - az);
      let [run, best] = [0, 0];
      for (let t = 0; t <= L + 1e-6; t += 0.25) {
        const [x, z] = [ax + ((bx - ax) * t) / L, az + ((bz - az) * t) / L];
        run = pieces.some((f) => x > f[0] - 0.5 && x < f[1] + 0.5 && z > f[2] - 0.5 && z < f[3] + 0.5) ? 0 : run + 0.25;
        best = Math.max(best, run);
      }
      return best >= 2;
    }).length;
    const chest = pairs("lookout-wall").filter(({ r, q }) => r[1] === RL.chestPiece && !!q && Math.abs(q[2] - mid) < 0.1).length;
    if (walls.length < 3 || onEdge.length !== walls.length || W.length !== walls.length || sides < RL.sides || chest < 1) ok = false;
    said.push(`the lookout's middle x ${x0} to ${x1}, z ${z0} to ${z1}: ${walls.length} of ${W.length} walls ${RL.wall.join(" to ")} m on it, ${onEdge.length} at its edge, a way up on ${sides} sides, ${chest} chest`);
  }
  check("the High City roofs' own rooflines: rows of chest-high plant on the decks, a mast where a deck had none, the lookout's raised middle walled low with a way up and a chest on it", ok, said.join("; ") || "no rules.highCover.roofs.roofline");
}

// The base's hall a lobby and the metro kiosks signed (Milestone 1083; the centre's nineteenth reviews, A: "the base hall a
// recognisable lobby (turnstiles, desk, lounge) (07)"; B: "07 the white open capsule unexplained"): rules.dress.caches' gate line
// across the north kiosk's way in (picture 07's eye looks down it), its reception desk under a RECEPTION board and its lounge
// under the atrium's coffer (picture 29c's), a METRO blade hung by each kiosk's door square to its face
{
  type Cache7 = { id: string; where: string; y: number; boxes: number[][]; pieces: string[] };
  type Part7 = [string, number, number, number, number, number, string, number];
  const CA7 = ((cfg as unknown as { caches?: Cache7[] }).caches ?? []) as Cache7[];
  const SETS7 = (cfg.rules.dress as unknown as { caches: { sets: Array<{ id: string; parts: Part7[] }> } }).caches.sets;
  const parts7 = (id: string) => SETS7.find((s) => s.id === id)?.parts ?? [];
  const boxes7 = (id: string) => CA7.find((s) => s.id === id)?.boxes ?? [];
  const said7: string[] = [];
  // (1) the gates: three cabinets and more in a row (their middles on one line), each gap between neighbours 0.95 to 1.3 m in
  // the collision with a flap drawn in it, and the court's north entrance's route's first leg through a gap a body's radius and
  // 5 cm clear of each cabinet
  const gb = boxes7("base-gates").slice().sort((a, b) => a[2] - b[2]);
  const flaps = parts7("base-gates").filter((q) => q[0] === "GateSmall00.prefab");
  const rowX = gb.length ? (gb[0][0] + gb[0][1]) / 2 : NaN;
  const inRow = gb.every((b) => Math.abs((b[0] + b[1]) / 2 - rowX) < 0.05);
  const gaps = gb.slice(1).map((b, i) => [gb[i][3], b[2]]);
  const goodGaps = gaps.filter(([g0, g1]) => g1 - g0 >= 0.95 && g1 - g0 <= 1.3 && flaps.some((f) => Math.abs(f[1] - rowX) < 0.05 && f[2] > g0 - 0.01 && f[2] < g1 + 0.01)).length;
  const R7 = ((cfg.court as unknown as { halls: Array<{ route?: number[][] }> }).halls[0].route ?? []) as number[][];
  const [ra, rb] = [R7[0], R7[1]];
  const tz = ra && rb && Math.abs(rb[0] - ra[0]) > 1e-6 ? ra[1] + ((rowX - ra[0]) / (rb[0] - ra[0])) * (rb[1] - ra[1]) : NaN;
  const through = gaps.some(([g0, g1]) => tz - MOVE.radius - 0.05 >= g0 && tz + MOVE.radius + 0.05 <= g1);
  const gatesOk = gb.length >= 3 && inRow && goodGaps === gaps.length && gaps.length >= 2 && through;
  said7.push(`gates: ${gb.length} cabinets in a row ${inRow}, ${goodGaps} of ${gaps.length} gaps with a flap, the kiosk's way in through one ${through}`);
  // (2) the reception desk: three Bar0 pieces and more in a row, touching, a computer on its top, a RECEPTION board each way
  // back to back over it (within 0.6 m of its middle in plan), from over a standing body to under the ceiling
  const dp = parts7("base-reception");
  const db = boxes7("base-reception");
  const desk = dp.map((q, i) => ({ q, i })).filter(({ q }) => /^Bar0/.test(q[0]) && q[7]);
  const deskBoxes = db.filter((b) => desk.some(({ q }) => Math.abs((b[0] + b[1]) / 2 - q[1]) < 0.01 && Math.abs((b[2] + b[3]) / 2 - q[2]) < 0.01)).sort((a, b) => a[0] - b[0]);
  const touching = deskBoxes.length >= 3 && deskBoxes.slice(1).every((b, i) => Math.abs(b[0] - deskBoxes[i][1]) < 0.05 && Math.abs((b[2] + b[3]) / 2 - (deskBoxes[0][2] + deskBoxes[0][3]) / 2) < 0.05);
  const top = deskBoxes.length ? Math.max(...deskBoxes.map((b) => b[5])) : 0;
  const dmid = deskBoxes.length ? [(deskBoxes[0][0] + deskBoxes[deskBoxes.length - 1][1]) / 2, (deskBoxes[0][2] + deskBoxes[0][3]) / 2] : [NaN, NaN];
  const computer = dp.some((q) => /^Computer/.test(q[0]) && Math.abs(q[4] - top) < 0.02 && deskBoxes.some((b) => q[1] > b[0] && q[1] < b[1] && q[2] > b[2] && q[2] < b[3]));
  const rec = boards5.filter((q) => q.text === "RECEPTION" && Math.hypot(q.at[0] - dmid[0], q.at[2] - dmid[1]) < 0.6 && q.at[1] - q.h / 2 >= MOVE.standHeight + 0.05 && q.at[1] + q.h / 2 <= 2.997);
  const recPair = rec.some((a) => rec.some((b) => b !== a && Math.abs(Math.abs(a.yaw - b.yaw) - 180) < 1 && Math.hypot(a.at[0] - b.at[0], a.at[2] - b.at[2]) < 0.1));
  const deskOk = touching && computer && recPair;
  said7.push(`desk: ${deskBoxes.length} pieces touching ${touching}, a computer on it ${computer}, RECEPTION ${rec.length} faces a pair ${recPair}`);
  // (3) the lounge: two couches facing each other on one line 2 to 3.5 m apart (the pack's couch faces its own -x), a table
  // between them
  const lp = parts7("base-lounge");
  const couches = lp.filter((q) => /^Couch00/.test(q[0]));
  const facesTo = (q: Part7) => [-Math.cos((q[3] * Math.PI) / 180), Math.sin((q[3] * Math.PI) / 180)];
  const facing = couches.length === 2 && (() => {
    const [a, b] = couches;
    const d = [b[1] - a[1], b[2] - a[2]];
    const L = Math.hypot(d[0], d[1]);
    const [fa, fb] = [facesTo(a), facesTo(b)];
    return L >= 2 && L <= 3.5 && (Math.abs(d[0]) < 0.1 || Math.abs(d[1]) < 0.1) && fa[0] * d[0] + fa[1] * d[1] > 0.9 * L && -(fb[0] * d[0] + fb[1] * d[1]) > 0.9 * L;
  })();
  const table = facing && lp.some((q) => /^TableOctogonal/.test(q[0]) && Math.hypot(q[1] - (couches[0][1] + couches[1][1]) / 2, q[2] - (couches[0][2] + couches[1][2]) / 2) < 0.3);
  said7.push(`lounge: ${couches.length} couches facing ${facing}, a table between ${table}`);
  // (4) the METRO blades: by each kiosk's door (cfg.labels' METRO over it), two METRO boards back to back within 3 m of the
  // label, square to it, from over a standing body to under the ceiling, each face seen from a standing eye 6 m out along it
  const labels7 = ((cfg as unknown as { labels?: Board5[] }).labels ?? []).filter((q) => q.text === "METRO");
  const bladesOk = labels7.length >= 2 && labels7.every((l) => {
    const bl = boards5.filter((q) => q.text === "METRO" && Math.hypot(q.at[0] - l.at[0], q.at[2] - l.at[2]) < 3 && Math.abs((((q.yaw - l.yaw) % 180) + 180) % 180 - 90) < 1 && q.at[1] - q.h / 2 >= MOVE.standHeight + 0.05 && q.at[1] + q.h / 2 <= 2.997);
    const pair = bl.some((a) => bl.some((b) => b !== a && Math.abs(Math.abs(a.yaw - b.yaw) - 180) < 1 && Math.hypot(a.at[0] - b.at[0], a.at[2] - b.at[2]) < 0.1));
    const seen = bl.filter((q) => {
      const [nx, nz] = [Math.sin((q.yaw * Math.PI) / 180), Math.cos((q.yaw * Math.PI) / 180)];
      return !through5([q.at[0] + nx * 6, 1.7, q.at[2] + nz * 6], [q.at[0] + nx * 0.1, q.at[1], q.at[2] + nz * 0.1]);
    }).length;
    said7.push(`METRO by (${l.at[0]}, ${l.at[2]}): ${bl.length} faces, a pair ${pair}, ${seen} seen`);
    return pair && seen === bl.length && bl.length >= 2;
  });
  check(
    "the base's hall a lobby and the metro kiosks signed: a gate line across the north kiosk's way in with a flap in each gate, a reception desk under its RECEPTION board, a lounge of two couches facing over a table, a METRO blade by each kiosk's door",
    gatesOk && deskOk && facing && table && bladesOk,
    said7.join("; ")
  );
}

// The base's flat ceilings beamed and lit (Milestone 1083; the centre's nineteenth reviews, B: "beams, ducts and light strips on
// the flat dark ceilings (07, 29c, 20c)"): rules.base.clad's beams in concrete, each under the slab over it (inside its collision:
// the slab's lower layer over every quarter metre of it, and its foot no lower than that layer's), clear of every other box save
// the pillars it rests on and of all that hangs from the ceiling, a lit strip under each; the hall's grid and the court's rows
{
  const S8 = (SOLIDS as { solids: number[][] }).solids;
  const CL8 = (cfg.rules.base as unknown as { clad?: Array<{ name: string; mat: string; boxes: number[][] }> }).clad ?? [];
  const of8 = (n: string) => CL8.filter((q) => q.name === n).flatMap((q) => q.boxes);
  const glow8 = (n: string) => CL8.filter((q) => q.name === n && /\|#/.test(q.mat)).flatMap((q) => q.boxes);
  // (what hangs: the lamps, lit panels and lanterns by their pieces' sizes, turned; the boards and labels by their planes)
  const SIZE8: Record<string, number[]> = { "Lighting_Deco006.prefab": [0.81, 0.28, 3.14], "Lighting_Deco007.prefab": [0.81, 0.28, 0.89], "Lighting_Deco007b.prefab": [2.81, 0.28, 2.39], "Lighting_Deco007c.prefab": [7.31, 0.28, 2.39], "ChineseLamp00 Variant.prefab": [0.6, 1.4, 0.6] };
  const hung8: number[][] = [];
  for (const [ch, c] of Object.entries(cfg.chunks as unknown as Record<string, { place: Array<[string, number, number, number, number, string, unknown?, unknown?, number?]> }>)) {
    if (!ch.startsWith("c-")) continue;
    for (const q of c.place) {
      const sz = SIZE8[q[0].split("/").pop()!];
      if (!sz || q[2] < -8 || q[2] > 12) continue;
      const s = q[8] ?? 1;
      const turned = Math.abs(Math.sin((q[4] * Math.PI) / 180)) > 0.5;
      const [hx, hz] = turned ? [(sz[2] * s) / 2, (sz[0] * s) / 2] : [(sz[0] * s) / 2, (sz[2] * s) / 2];
      hung8.push([q[1] - hx, q[1] + hx, q[3] - hz, q[3] + hz, q[2] - sz[1] * s, q[2]]);
    }
  }
  for (const b of [...boards5, ...((cfg as unknown as { labels?: Board5[] }).labels ?? [])]) {
    const turned = Math.abs(Math.sin((b.yaw * Math.PI) / 180)) > 0.5;
    const [hx, hz] = turned ? [0.02, b.w / 2] : [b.w / 2, 0.02];
    hung8.push([b.at[0] - hx, b.at[0] + hx, b.at[2] - hz, b.at[2] + hz, b.at[1] - b.h / 2, b.at[1] + b.h / 2]);
  }
  // (the base's pillars on the ground floor, Pillar_Simple_1x3, 1 m square on its own -x and -z of its pivot)
  const pil8 = placed5("c-base").filter((q) => /\/Pillar_Simple_1x3\.prefab$/.test(q[0]) && Math.abs(q[2]) < 0.01).map((q) => {
    const a = (q[4] * Math.PI) / 180;
    const pts = [[-1, -1], [0, -1], [-1, 0], [0, 0]].map(([ox, oz]) => [q[1] + Math.cos(a) * ox + Math.sin(a) * oz, q[3] - Math.sin(a) * ox + Math.cos(a) * oz]);
    return [Math.min(...pts.map((p) => p[0])), Math.max(...pts.map((p) => p[0])), Math.min(...pts.map((p) => p[1])), Math.max(...pts.map((p) => p[1]))];
  });
  const res8 = ([["hall", 2.7, 3.0], ["court", -4.3, -4.0]] as Array<[string, number, number]>).map(([where, p0, p1]) => {
    const beams = of8(`${where} beams`);
    const strips = glow8(`${where} strips`);
    const plates = S8.filter((b) => Math.abs(b[4] - p0) < 0.011 && Math.abs(b[5] - p1) < 0.011);
    // (a column from the floor to the ceiling, a metre square or less, is what a beam rests on: the hall's pillars at the grid's
    // crossings, the court's under its rows; and the ceiling is solid where a column stands or something stands through the
    // slab's own height, as the slab is laid round what stands in it)
    // (the hall's pillars collide as a ring of half-metre cells up to 1.5 m across: a box inside a pillar's footprint grown by
    // half a metre is that pillar)
    const column = (q: number[]) => (q[1] - q[0] <= 1.1 && q[3] - q[2] <= 1.1 || pil8.some((f) => q[0] >= f[0] - 0.5 && q[1] <= f[1] + 0.5 && q[2] >= f[2] - 0.5 && q[3] <= f[3] + 0.5)) && q[4] <= p1 - 2.5 && q[5] >= p1 - 0.05;
    const solid = S8.filter((q) => column(q) || (q[4] <= p1 - 0.05 && q[5] >= p1 + 0.3));
    const bad: string[] = [];
    let length = 0;
    for (const b of beams) {
      const alongZ = b[5] - b[4] > b[1] - b[0];
      const [lo, hi] = alongZ ? [b[4], b[5]] : [b[0], b[1]];
      const [cx, cz] = [(b[0] + b[1]) / 2, (b[4] + b[5]) / 2];
      length += hi - lo;
      let under = b[2] >= p0 - 0.011;
      for (let t = lo; t <= hi + 1e-6 && under; t += 0.25) {
        const [px, pz] = alongZ ? [cx, Math.min(t, hi)] : [Math.min(t, hi), cz];
        if (!plates.some((q) => px >= q[0] && px <= q[1] && pz >= q[2] && pz <= q[3]) && !solid.some((q) => px >= q[0] && px <= q[1] && pz >= q[2] && pz <= q[3])) under = false;
      }
      const into = S8.filter((q) => !(Math.abs(q[4] - p0) < 0.011 && Math.abs(q[5] - p1) < 0.011) && !column(q) && q[0] < b[1] - 0.02 && q[1] > b[0] + 0.02 && q[2] < b[5] - 0.02 && q[3] > b[4] + 0.02 && q[4] < b[3] - 0.02 && q[5] > b[2] + 0.02).length;
      const hangs = hung8.filter((h) => h[0] < b[1] && h[1] > b[0] && h[2] < b[5] && h[3] > b[4] && h[5] > b[2] && h[4] < b[3]).length;
      const strip = strips.some((s) => s[0] >= b[0] - 0.01 && s[1] <= b[1] + 0.01 && s[4] >= b[4] - 0.01 && s[5] <= b[5] + 0.01 && Math.abs(s[3] - b[2]) < 0.01 && (alongZ ? s[5] - s[4] : s[1] - s[0]) >= 0.8 * (hi - lo));
      if (!under || into || hangs || !strip) bad.push(`(${cx.toFixed(2)}, ${cz.toFixed(2)})${under ? "" : " not under the slab"}${into ? ` ${into} boxes in it` : ""}${hangs ? ` ${hangs} hung through it` : ""}${strip ? "" : " unlit"}`);
    }
    return { where, n: beams.length, length, bad, north: beams.filter((b) => (b[4] + b[5]) / 2 < -10).length, rows: new Set(beams.map((b) => Math.round(((b[4] + b[5]) / 2) * 10) / 10)).size };
  });
  const [hall8, court8] = res8;
  check(
    "the base's flat ceilings beamed and lit: the hall's grid of concrete beams and the court's on its pillar rows, each under the slab over it, clear of all else and of what hangs there, a lit strip under each",
    hall8.n >= 30 && hall8.north >= 15 && hall8.length >= 150 && court8.n >= 2 && court8.rows >= 2 && hall8.bad.length === 0 && court8.bad.length === 0,
    res8.map((r) => `${r.where}: ${r.n} beams, ${r.length.toFixed(1)} m${r.where === "hall" ? `, ${r.north} in the north half` : `, on ${r.rows} rows`}${r.bad.length ? `; bad ${r.bad.slice(0, 4).join(", ")}` : ""}`).join("; ")
  );
}

// LANTERN ALLEYS, THE TERRACES and THE STACKS (Milestone 1101; the districts' fifteenth reviews of version 140, 2026-11-08,
// LANTERN 6.5 and 6.3, THE TERRACES 6.2 and 6.3, THE STACKS 6.4 and 5.9, and the fourteenth). LANTERN ALLEYS: "a pale slab floats
// across the mouth" (d01), "the brick box with a red sliding door like a lift door" (d02), "a court centrepiece such as a lantern
// gate or shrine". THE TERRACES: "interiors plaster and timber instead of a green container" (d06), "the yellow sci-fi bench
// timber or stone (it runs into the pergola post)", "terracotta planters on the top tier" (d05). THE STACKS: "the cypresses in
// pink planters, not on crates" (d10), "a clean pink parapet" (d12)
{
  type Pl101 = [string, number, number, number, number, string, (string | null)?, unknown?, (number | null)?];
  const CH101 = (cfg as unknown as { chunks: Record<string, { place: Pl101[] }> }).chunks;
  const rows101 = (k: string) => CH101[k]?.place ?? [];
  const named101 = (q: Pl101, n: string) => String(q[0]).endsWith(`/${n}`);
  const remap101 = (s: unknown) => new Map(String(s ?? "").split(";").filter((p) => p.includes("=")).map((p) => p.split("=") as [string, string]));
  const PAID101 = process.env.PAID_DIR ?? "C:/Users/jwilb/Downloads/speedkills-paid";
  const cat101 = existsSync(join(PAID101, "neon", "catalogue.json")) ? (JSON.parse(readFileSync(join(PAID101, "neon", "catalogue.json"), "utf8")) as Array<{ path: string; min: number[] | null; max: number[] | null }>) : [];
  const box101 = (n: string) => cat101.find((c) => c.path.endsWith(`/${n}`) && c.min && c.max);
  // (a placement's footprint's middle on the map, as the layout lays it: its pivot plus its box's middle turned and scaled)
  const mid101 = (q: Pl101): number[] => {
    const r = box101(String(q[0]).split("/").pop()!);
    const s = Number(q[8] ?? 1);
    const [mx, mz] = r ? [((r.min![0] + r.max![0]) / 2) * s, ((r.min![2] + r.max![2]) / 2) * s] : [0, 0];
    const a = (q[4] * Math.PI) / 180;
    return [q[1] + Math.cos(a) * mx + Math.sin(a) * mz, q[3] - Math.sin(a) * mx + Math.cos(a) * mz];
  };
  const said101: string[] = [];
  let ok101 = true;
  const part101 = (ok: boolean, text: string) => {
    if (!ok) ok101 = false;
    said101.push(`${ok ? "" : "NOT: "}${text}`);
  };
  type Pv101 = { post: string; roof: string; roofMat?: string; lamp: string };
  type Dl101 = { chunk: string; roofs: Record<string, string>; court: { web: { from: number[] }; stalls: { pieces: string[]; at: number[][]; turn?: number[] }; pavilion?: Pv101 } };
  type Dt101 = { chunk: string; rooms: { inner: string; innerMat?: string; dado?: { h: number; mat: string } }; garden: { bench: string; benchMat?: string; pergola: { post: string; seats?: { piece: string; gap?: number } }; beds: { scale: number; pieces: Record<string, string> } } };
  type Ds101 = { chunk: string; ground: { pots?: Record<string, string> }; hotel: { rail: { mat?: string } } };
  const D101 = cfg.rules.districts as unknown as { lantern: Dl101; terraces: Dt101; stacks: Ds101 };
  const all101 = Object.values(CH101).flatMap((c) => c.place);
  // (1) LANTERN ALLEYS' mouths: in each of the ring road's `drops`, four kerbs and more, and none standing past 5 cm over the
  // ground (the kerb's own top off the catalogue)
  const RG101 = cfg.rules.streets as unknown as { kerb: { piece: string }; ring?: { drops?: number[][] } };
  const kTop101 = box101(RG101.kerb.piece)?.max?.[1] ?? 0.17;
  const mouths101 = (RG101.ring?.drops ?? []).map(([a, b, c, d]) => all101.filter((q) => named101(q, RG101.kerb.piece) && q[1] >= a - 0.2 && q[1] <= b + 0.2 && q[3] >= c - 0.2 && q[3] <= d + 0.2));
  const standing101 = mouths101.flat().filter((q) => q[2] + kTop101 > 0.05).length;
  part101(mouths101.length >= 2 && mouths101.every((m) => m.length >= 4) && standing101 === 0, `LANTERN ALLEYS' ${mouths101.length} mouths: ${mouths101.map((m) => m.length).join(", ")} kerbs, ${standing101} standing past 5 cm`);
  // (2) the court's stalls: none in a red door (PlasticRed00 in its wear), and the stall nearest the court's south-west corner,
  // its way in from the ring road, shows its awning side (its own +x) toward the ring road (+z) within 45 degrees
  const DL101 = D101.lantern;
  const stalls101 = rows101(DL101.chunk).filter((q) => DL101.court.stalls.pieces.some((n) => named101(q, n)));
  const red101 = stalls101.filter((q) => [...remap101(q[6]).values()].some((v) => /PlasticRed00/.test(v))).length;
  const [cx101, cz101] = [Math.min(...DL101.court.stalls.at.map((p) => p[0])) - 5, Math.max(...DL101.court.stalls.at.map((p) => p[1])) + 9];
  const wayIn101 = [...stalls101].sort((p, q) => Math.hypot(mid101(p)[0] - cx101, mid101(p)[1] - cz101) - Math.hypot(mid101(q)[0] - cx101, mid101(q)[1] - cz101))[0];
  // (a piece's own +x on the map is (cos yaw, -sin yaw): its z part the cosine of its angle off +z)
  const awning101 = wayIn101 ? -Math.sin((wayIn101[4] * Math.PI) / 180) : -1;
  part101(stalls101.length >= 3 && red101 === 0 && awning101 >= Math.SQRT1_2, `${stalls101.length} court stalls, ${red101} with a red door; the way in's awning ${(Math.acos(Math.max(-1, Math.min(1, awning101))) * 180 / Math.PI).toFixed(0)} degrees off the ring road's side`);
  // (3) the court's pavilion: four posts round the mast, each typed in the collision from the ground past 2.5 m and 0.3 m across
  // at most; its roof on them at the mast in the houses' roof wear; every lantern of the web over its square clear of its tiles
  // by 0.1 m; and the court's middle street node (the nearest the mast) keeps its five links, walked under it along both grid
  // lines
  const PVr101 = (cfg as unknown as { lanternAlleys: { pavilion?: { at: number[]; half: number; posts: number[][]; top: number; roof: number[]; lamps: number } } }).lanternAlleys.pavilion;
  const PV101 = DL101.court.pavilion;
  const [mx101, mz101] = DL101.court.web.from;
  const typed101 = (PVr101?.posts ?? []).filter(([x, z]) => {
    const bs = solidsIn(x + BR_X - 0.05, x + BR_X + 0.05, z + BR_Z - 0.05, z + BR_Z + 0.05).filter((b) => b.minX <= x + BR_X && b.maxX >= x + BR_X && b.minZ <= z + BR_Z && b.maxZ >= z + BR_Z && b.base < 3);
    // (a post's own cells: the bake types a piece this thin in its half-metre grid)
    return bs.length > 0 && bs.every((b) => b.maxX - b.minX <= 0.55 && b.maxZ - b.minZ <= 0.55) && Math.min(...bs.map((b) => b.base)) < 0.1 && Math.max(...bs.map((b) => b.top)) >= 2.5;
  }).length;
  const ring101 = (PVr101?.posts ?? []).every(([x, z]) => Math.abs(Math.abs(x - mx101) - (PVr101?.half ?? 0)) < 0.01 && Math.abs(Math.abs(z - mz101) - (PVr101?.half ?? 0)) < 0.01);
  const roofRow101 = PV101 ? rows101(DL101.chunk).find((q) => named101(q, PV101.roof) && Math.hypot(mid101(q)[0] - mx101, mid101(q)[1] - mz101) < 0.1) : undefined;
  const roofWorn101 = !!roofRow101 && !!PV101?.roofMat && Object.values(DL101.roofs).includes(PV101.roofMat) && roofRow101[6] === PV101.roofMat;
  const [eaveY101, apexY101, halfSq101] = PVr101?.roof ?? [0, 0, 1];
  const tileAt101 = (dx: number, dz: number) => apexY101 - ((apexY101 - eaveY101) * Math.min(1, Math.max(Math.abs(dx), Math.abs(dz)) / halfSq101));
  const lb101 = box101("ChineseLamp00 Variant.prefab");
  const lamps101 = rows101(DL101.chunk).filter((q) => /\/ChineseLamp00/.test(String(q[0])) && q[2] > (PVr101?.top ?? 0) + 0.5 && Math.max(Math.abs(q[1] - mx101), Math.abs(q[3] - mz101)) < halfSq101 + 0.5);
  const lampGap101 = lamps101.length ? Math.min(...lamps101.map((q) => {
    const s = Number(q[8] ?? 1);
    const r = ((lb101?.max?.[0] ?? 0.22) - (lb101?.min?.[0] ?? -0.22)) / 2 * s;
    const near = Math.max(0, Math.max(Math.abs(q[1] - mx101), Math.abs(q[3] - mz101)) - r);
    return q[2] + (lb101?.min?.[1] ?? -1.4) * s - tileAt101(near, 0);
  })) : 9;
  const mid101n = map.nodes.filter((n) => !n.y).sort((p, q) => Math.hypot(p.x - BR_X - mx101, p.z - BR_Z - mz101) - Math.hypot(q.x - BR_X - mx101, q.z - BR_Z - mz101))[0];
  const [nx101, nz101] = mid101n ? [mid101n.x - BR_X, mid101n.z - BR_Z] : [0, 0];
  const walks101 = [[[nx101, nz101 - 8, 0], [nx101, nz101 + 8, 0]], [[nx101 - 8, nz101, 0], [nx101 + 8, nz101, 0]]].filter((w) => along(w).k === 2 && along([...w].reverse()).k === 2).length;
  part101(!!PV101 && typed101 === 4 && ring101 && roofWorn101 && Math.abs(eaveY101 - (PVr101?.top ?? 0)) < 2 && lampGap101 >= 0.1 && (mid101n?.links.length ?? 0) >= 5 && walks101 === 2,
    `the pavilion: ${typed101} of ${(PVr101?.posts ?? []).length} posts typed${ring101 ? "" : ", off their square"}, its roof ${roofRow101 ? (roofWorn101 ? "on the mast in the houses' wear" : "unworn") : "missing"}, the web's ${lamps101.length} lanterns over it ${lampGap101.toFixed(2)} m clear of its tiles at the least; the court's middle node (${nx101}, ${nz101}) ${mid101n?.links.length ?? 0} links, walked under it on ${walks101} of 2 lines`);
  // (4) THE TERRACES' rooms: each room's three inside walls in a plaster (no lit panel, no glow) and a timber dado of the same
  // quad at dado.h over its height, three to a wall
  const DT101 = D101.terraces;
  const rooms101 = ((cfg as unknown as { terraces: { rooms: number[][] } }).terraces.rooms ?? []);
  const inner101 = (q: Pl101) => named101(q, DT101.rooms.inner);
  const roomsOk101 = rooms101.filter(([x0, z0, floor]) => {
    const here = rows101(DT101.chunk).filter((q) => inner101(q) && Math.abs(q[2] - floor) < 0.01 && mid101(q)[0] > x0 - 0.01 && mid101(q)[0] < x0 + 5.01 && mid101(q)[1] > z0 - 0.01 && mid101(q)[1] < z0 + 5.01);
    // (its inside walls the quads worn innerMat, the tier's plain walls on its edges being the same quad unworn)
    const walls = here.filter((q) => Number(q[8] ?? 1) === 1 && q[6] === DT101.rooms.innerMat);
    const lit = here.filter((q) => /pannel03|[|^~]/.test(String(q[6] ?? ""))).length;
    const dado = here.filter((q) => Number(q[8] ?? 1) < 0.5);
    return walls.length === 3 && lit === 0 && /^Plaster/.test(DT101.rooms.innerMat ?? "") && dado.length >= 9 && dado.every((q) => /Wood/.test(String(q[6] ?? "")) && Math.abs(Number(q[8]) * 3 - (DT101.rooms.dado?.h ?? 0)) < 0.01);
  }).length;
  part101(rooms101.length === 6 && roomsOk101 === 6 && !/pannel03/.test(DT101.rooms.innerMat ?? "pannel03"), `${roomsOk101} of ${rooms101.length} rooms in plaster with a timber dado`);
  // (5) THE TERRACES' benches: every one in a timber wear (its yellow paint remapped to a Wood), and every pergola bench's typed
  // box 0.25 m and more clear of every post's typed box in plan
  const benches101 = rows101(DT101.chunk).filter((q) => named101(q, DT101.garden.bench));
  const yellow101 = benches101.filter((q) => !/Wood/.test(remap101(q[6]).get("MetalPaintPannelsYellow00") ?? "")).length;
  const TC101 = (cfg as unknown as { terraces: { solids: number[][]; pergolas: number[][]; seats?: number[][] } }).terraces;
  const seatBoxes101 = (TC101.seats ?? []).map(([x, z, y]) => TC101.solids.find((b) => b[0] < x && b[1] > x && b[2] < z && b[3] > z && Math.abs(b[4] - y) < 0.01 && b[5] - b[4] < 1.3)).filter((b): b is number[] => !!b);
  const postBoxes101 = TC101.solids.filter((b) => TC101.pergolas.some((p) => Math.abs(b[4] - p[4]) < 0.01 && b[5] - b[4] > 2 && b[1] - b[0] <= 0.3 && (b[0] + b[1]) / 2 > p[0] - 0.01 && (b[0] + b[1]) / 2 < p[1] + 0.01 && [p[2], p[3]].some((z) => Math.abs((b[2] + b[3]) / 2 - z) < 0.01)));
  const gapOf101 = (a: number[], b: number[]) => Math.hypot(Math.max(0, a[0] - b[1], b[0] - a[1]), Math.max(0, a[2] - b[3], b[2] - a[3]));
  const seatGap101 = seatBoxes101.length && postBoxes101.length ? Math.min(...seatBoxes101.flatMap((a) => postBoxes101.map((b) => gapOf101(a, b)))) : 0;
  part101(benches101.length >= 8 && yellow101 === 0 && seatBoxes101.length >= 4 && seatBoxes101.length === (TC101.seats ?? []).length && seatGap101 >= 0.25, `${benches101.length} benches, ${yellow101} yellow; the pergolas' ${seatBoxes101.length} benches ${seatGap101.toFixed(2)} m from the posts at the least`);
  // (6) the beds terracotta: every piece of THE TERRACES' beds (its slab, coping kerbs and soil at the beds' scale) with its brick
  // worn in the terracotta
  const bedNames101 = Object.values(DT101.garden.beds.pieces);
  const beds101 = rows101(DT101.chunk).filter((q) => bedNames101.some((n) => named101(q, n)) && Math.abs(Number(q[8] ?? 1) - DT101.garden.beds.scale) < 0.001);
  const greyBeds101 = beds101.filter((q) => !/#ff9080/i.test(remap101(q[6]).get("BrickDamaged00b") ?? "")).length;
  part101(beds101.length >= 50 && greyBeds101 === 0, `${beds101.length - greyBeds101} of ${beds101.length} bed pieces terracotta`);
  // (7) THE STACKS' planters pink: every garden pit of its chunk, and of the district cover in its sector (x and z under -50,
  // past the ring road), out of the pack's lit cross panel (Concrete_Lgt 5 worn), and THE STACKS' own in its pink
  const DS101 = D101.stacks;
  const pink101 = (v?: string) => !!v && /#ff8fe8/i.test(v);
  const pitsS101 = rows101(DS101.chunk).filter((q) => /\/GardenPit/.test(String(q[0])));
  const pitsC101 = rows101("c-dcover").filter((q) => /\/GardenPit/.test(String(q[0])) && q[1] < -50 && q[3] < -50 && Math.max(Math.abs(q[1]), Math.abs(q[3])) > 100);
  const lit101 = [...pitsS101, ...pitsC101].filter((q) => !remap101(q[6]).get("Concrete_Lgt 5") || /^Concrete_Lgt/.test(remap101(q[6]).get("Concrete_Lgt 5")!)).length;
  const pinkS101 = pitsS101.filter((q) => pink101(remap101(q[6]).get("Concrete_Lgt 5"))).length;
  const pinkC101 = pitsC101.filter((q) => pink101(remap101(q[6]).get("Concrete_Lgt 5"))).length;
  part101(!!DS101.ground.pots && pitsS101.length >= 15 && lit101 === 0 && pinkS101 === pitsS101.length && pinkC101 >= 5, `THE STACKS: ${pinkS101} of ${pitsS101.length} of its pits pink, ${pinkC101} of the district cover's ${pitsC101.length} in its sector; ${lit101} in the lit cross panel`);
  // (8) the hotel's parapet: every rail's panel and frame in a pink paint, none in the near flat glossy plastic
  const rails101 = rows101(DS101.chunk).filter((q) => /\/FenceElegant00_x/.test(String(q[0])));
  const glossy101 = rails101.filter((q) => {
    const m = remap101(q[6]);
    return !pink101(m.get("CrystalPattern03")) || !pink101(m.get("MetalPaintWhiteCracked00b")) || /PlasticWhite01/.test(String(q[6] ?? ""));
  }).length;
  part101(rails101.length >= 60 && glossy101 === 0, `${rails101.length - glossy101} of ${rails101.length} hotel rails one pink paint`);
  check("LANTERN ALLEYS, THE TERRACES and THE STACKS (Milestone 1101): LANTERN's kerbs dropped at its mouths, its court's stalls without a red door and one turned to the way in, a lantern pavilion round its mast; THE TERRACES' rooms plaster and timber, its benches timber and clear of the posts, its beds terracotta; THE STACKS' planters pink and its parapet one pink paint", ok101, said101.join("; "));
}

// The map-made ceilings in a plaster with no panel frame (Milestone 1106; the centre's twenty-first reviews, A rank 8: "a
// diagonal crease across every ceiling tile (07, 11, 29c)", "fix the crease on the ceiling tiles (07, 11, 20b, 29c), with flat
// normals on each tile or a seamless texture"). Measured on version 140 (proposals8/ceilings8.md): no crease was in the bake,
// whose ceilings are flat-shaded with one unbroken UV map, nor in the textures; every line in those pictures is the panel
// plaster's own border (PlasterPannelsDirt00, a dark double line round each panel) seen through the 121 degree view at about
// 45 degrees to the grid. The seamless remedy: the base's and the tower's slab undersides and the 26 m floor's ceiling in the
// pack's plain plaster, the bake's own record of that floor's ceiling in it, and the plain plaster a material the centre draws
// already (a placed piece of the pack whose own materials hold it, worn in nothing), so the batch keeps its rows
{
  const PANEL106 = "PlasterPannelsDirt00";
  const PLAIN106 = "PlasterDirt00";
  const R106 = cfg.rules as unknown as { base: { mats: { under: string } }; tower: { mats: { under: string }; floors: { at: Record<string, { ceilingMat?: string }> } } };
  const unders106 = { base: R106.base.mats.under, tower: R106.tower.mats.under };
  const panelled106 = Object.entries(unders106).filter(([, m]) => m.split("*")[0] === PANEL106).map(([k]) => k);
  const floors106 = Object.entries(R106.tower.floors.at).filter(([, f]) => f.ceilingMat?.split("*")[0] === PANEL106).map(([k]) => k);
  const measured106 = ((cfg as unknown as { tower: { measured: { ceilings?: Array<{ over: number; mat: string }> } } }).tower.measured.ceilings ?? []).find((q) => q.over === 26);
  const PAID106 = process.env.PAID_DIR ?? "C:/Users/jwilb/Downloads/speedkills-paid";
  const cat106 = existsSync(join(PAID106, "neon", "catalogue.json")) ? (JSON.parse(readFileSync(join(PAID106, "neon", "catalogue.json"), "utf8")) as Array<{ path: string; materials?: string[] }>) : [];
  const own106 = new Set(cat106.filter((r) => (r.materials ?? []).includes(PLAIN106)).map((r) => r.path.split("/").pop()!));
  let drawn106 = 0;
  for (const [name, ch] of Object.entries(cfg.chunks as unknown as Record<string, { place?: unknown[][] }>))
    if (name.startsWith("c-")) for (const p of ch.place ?? []) if (own106.has(String(p[0]).split("/").pop()!) && !p[6]) drawn106++;
  check(
    "the map-made ceilings in a plaster with no panel frame: the base's and the tower's slab undersides and every tower floor's own ceiling off the panel plaster, whose border read through the wide view as a diagonal crease, the bake's ceiling over the 26 m floor in the plain plaster, a material the centre draws already",
    panelled106.length === 0 && floors106.length === 0 && unders106.base === PLAIN106 && unders106.tower === PLAIN106 && measured106?.mat === PLAIN106 && drawn106 > 0,
    `undersides: base ${unders106.base}, tower ${unders106.tower}; floors with the panel plaster overhead: ${floors106.join(", ") || "none"}; the bake's ceiling over 26: ${measured106?.mat ?? "none"}; ${drawn106} placed pieces in the centre draw ${PLAIN106} unworn`,
  );
}

// The base's roof furnished (Milestone 1097; the centre's twenty-first reviews, A rank 2: "furnish the bare high slabs: the
// lookout floor (10), the base roof (09), the High City dome caps (14), cover at two heights and one small enclosed structure
// each"; both: "waist-to-head walls and staggered crates"; rules.highCover.roofs.baseRoof): on each band of the base's roof a
// small enclosed structure (the pack's roof stair house, `enclosed` metres and more), walls between a crouched body and a
// standing eye (`low`) and crate stacks over a standing body (`high`), each group's `least`; every piece on the roof's floor
// and off each way the roof's players use: each pad up from it by `pad` (its reach, a body and a hand), each landing from the
// plaza by `landing` and the strip its throw crosses from the base's face by `throw`, the way down's landing by `down`, each
// stair's top by `stair`, and the bots' raised nodes by `node`. (Laid, on a floor and off the roofs' ways: "the roofs dressed")
{
  type BRF9 = { groups: string[]; hut: string; enclosed: number; low: number[]; high: number; least: { huts: number; low: number; high: number }; pad: number; landing: number; throw: number; down: number; stair: number; node: number };
  const HCB = (cfg.rules as unknown as { highCover: { at: Array<[string, string, number, number, number, number, number, string?]>; roofs: { baseRoof?: BRF9 } } }).highCover;
  const BRF = HCB.roofs.baseRoof;
  const HCo = (cfg as unknown as { highCover?: Record<string, number[][]> }).highCover ?? {};
  const roofB = (cfg.rules as unknown as { base: { roof: number } }).base.roof;
  const said: string[] = [];
  let ok = !!BRF;
  if (BRF) {
    const footB = (q: number[]) => {
      const t = ((q[6] % 180) + 180) % 180 === 90;
      const [hx, hz] = t ? [q[5], q[4]] : [q[4], q[5]];
      return [q[0] - hx, q[0] + hx, q[1] - hz, q[1] + hz];
    };
    const gapB = (f: number[], x: number, z: number) => Math.hypot(Math.max(0, f[0] - x, x - f[1]), Math.max(0, f[2] - z, z - f[3]));
    // (the ways, each a point and its keep-off; a throw's strip as points a quarter metre apart from the face to the landing)
    const ways: Array<[string, number, number, number]> = [];
    for (const q of SPINE.up) {
      if (Math.abs(q.floor - roofB) < 0.1) ways.push([`the pad ${q.id}`, q.pad[0], q.pad[1], BRF.pad]);
      if (Math.abs(q.ground - roofB) < 0.1) {
        ways.push([`${q.id}'s landing`, q.face[0] - q.out[0] * q.land, q.face[1] - q.out[1] * q.land, BRF.landing]);
        for (let t = 0; t <= q.land + 1e-6; t += 0.25) ways.push([`${q.id}'s throw over the parapet`, q.face[0] - q.out[0] * t, q.face[1] - q.out[1] * t, BRF.throw]);
      }
    }
    for (const q of SPINE.down) if (Math.abs(q.landY - roofB) < 0.1) ways.push([`${q.id}'s landing`, q.land[0], q.land[1], BRF.down]);
    for (const s of (cfg as unknown as { base: { stairs: Array<{ route: number[][] }> } }).base.stairs) {
      const e = s.route.at(-1)!;
      if (Math.abs(e[2] - roofB) < 0.1) ways.push([`the stair's top at (${e[0]}, ${e[1]})`, e[0], e[1], BRF.stair]);
    }
    const GR9 = (cfg.game as unknown as { graph: { raised: number; margin: number } }).graph;
    const lim9 = worldCfg.cut.half - GR9.margin;
    const near: string[] = [];
    for (const g of BRF.groups) {
      const rows = HCB.at.filter((r) => r[0] === g);
      const got = HCo[g] ?? [];
      let [huts, low, high] = [0, 0, 0];
      // (a stack: the pieces at one spot, from the lowest foot to the highest top)
      const stacks = new Map<string, number[]>();
      got.forEach((q, k) => {
        const tall = q[3] - q[2];
        const onRoof = Math.abs(q[2] - roofB) < 0.05;
        if (rows[k]?.[1] === BRF.hut && tall >= BRF.enclosed && onRoof) huts++;
        else if (tall >= BRF.low[0] && tall <= BRF.low[1] && onRoof) low++;
        const s = stacks.get(`${q[0]},${q[1]}`) ?? [Infinity, -Infinity];
        stacks.set(`${q[0]},${q[1]}`, [Math.min(s[0], q[2]), Math.max(s[1], q[3])]);
        const f = footB(q);
        const hit = ways.find(([, x, z, r9]) => gapB(f, x, z) < r9);
        if (hit) near.push(`${g} (${q[0]}, ${q[1]}) ${gapB(f, hit[1], hit[2]).toFixed(2)} m from ${hit[0]}`);
        for (let x = Math.ceil((f[0] - BRF.node + lim9) / GR9.raised) * GR9.raised - lim9; x <= f[1] + BRF.node; x += GR9.raised)
          for (let z = Math.ceil((f[2] - BRF.node + lim9) / GR9.raised) * GR9.raised - lim9; z <= f[3] + BRF.node; z += GR9.raised)
            if (gapB(f, x, z) < BRF.node) near.push(`${g} (${q[0]}, ${q[1]}) by the bots' node (${x}, ${z})`);
      });
      for (const [s0, s1] of stacks.values()) if (Math.abs(s0 - roofB) < 0.05 && s1 - s0 >= BRF.high && s1 - s0 < BRF.enclosed) high++;
      if (got.length !== rows.length || huts < BRF.least.huts || low < BRF.least.low || high < BRF.least.high) ok = false;
      said.push(`${g}: ${got.length} of ${rows.length} laid, ${huts} enclosed, ${low} walls ${BRF.low.join(" to ")} m, ${high} stacks over ${BRF.high} m`);
    }
    if (near.length) (ok = false), said.push(near.slice(0, 4).join("; "));
  }
  check("the base's roof furnished: on each band a small enclosed structure, chest-high walls and crate stacks over a standing body, every piece off the pads, the landings and their throws, the way down's landing, the stairs' tops and the bots' nodes", ok, said.join("; ") || "no rules.highCover.roofs.baseRoof");
}

// The Sky Ring's underside and edge lit (Milestone 1097; the centre's twenty-first reviews, A rank 6: "the brick underside
// lit"; B rank 9: "the hall's light spilling out under the Sky Ring"; rules.skyring.lights and band): the pack's ceiling
// panel light hung under the deck every `every` degrees round it, each drawn only, wholly between the deck's edges, its top
// `under` metres under the underside, its foot (`hang` under its top) over a standing body by half a metre, its length along
// the ring; and the band at the deck's outer edge in the base's own band light, a material the centre draws already
{
  type SL9 = { piece: string; r: number; every: number; from: number; under: number; hang: number; most: number };
  const SRL = cfg.rules.skyring as unknown as { r0: number; r1: number; deck: number; thick: number; lights?: SL9; band?: { mat: string; h: number; out: number } };
  const LT = SRL.lights;
  const said: string[] = [];
  let ok = !!LT && !!SRL.band;
  if (LT) {
    const PL = (cfg.chunks as unknown as Record<string, { place: unknown[][] }>)["c-skyring"].place.filter((q) => String(q[0]).endsWith(`/${LT.piece}`));
    const want = Math.round(360 / LT.every);
    const under = SRL.deck - SRL.thick;
    const bad = PL.filter((q) => {
      const [x, y, z, yaw] = [q[1], q[2], q[3], q[4]] as number[];
      const r = Math.hypot(x, z);
      // (its own z along the ring's tangent at its angle: its turn the angle's negative, either way along)
      const off = ((((yaw + (Math.atan2(z, x) * 180) / Math.PI) % 180) + 180) % 180);
      return q[5] !== "g" || r - 0.5 < SRL.r0 || r + 0.5 > SRL.r1 || Math.abs(y - (under - LT.under)) > 0.01 || y - LT.hang < MOVE.standHeight + 0.5 || Math.min(off, 180 - off) > 1;
    });
    // (and all round: the longest stretch of the deck's middle between two lights no more than `most`)
    const angs = PL.map((q) => Math.atan2(q[3] as number, q[1] as number)).sort((a, b) => a - b);
    const gapL = angs.length ? Math.max(...angs.map((a, k) => (k ? a - angs[k - 1] : a + 2 * Math.PI - angs.at(-1)!))) * LT.r : Infinity;
    if (PL.length !== want || bad.length || gapL > LT.most) ok = false;
    said.push(`${PL.length} of ${want} lights under the deck, ${bad.length} off it, low or turned across, at most ${gapL.toFixed(1)} m apart`);
  }
  if (SRL.band) {
    const facade = (cfg.rules.base as unknown as { facade: { bands: Array<[number, number, string]> } }).facade.bands;
    const drawn = facade.some((b) => b[2] === SRL.band!.mat);
    if (!drawn || SRL.band.h <= 0 || SRL.band.h > SRL.thick || SRL.band.out <= 0) ok = false;
    said.push(`the edge's band ${SRL.band.h} m in ${SRL.band.mat}, ${drawn ? "the base's own band light" : "a light the centre does NOT draw"}`);
  }
  check("the Sky Ring's underside and edge lit: a ceiling light under its deck every few metres all round it, hung over a standing body's head, and a band of the base's own light along its outer edge", ok, said.join("; ") || "no rules.skyring.lights");
}

// THE VAULT's strongroom closed wall to wall and floor to ceiling, with side doors and drop-ins (Milestone 1095; the centre's
// twenty-first reviews of picture 30: "the strongroom built into the structure: the door sits in a free-standing gold box with
// open floor and windows past it; its walls to the slab and ceiling, a second way in", "the strongroom closed to the ceiling in
// dark steel with gold trim", "a drop-in from 35 m, so the best loot stops being a single stair choke"): (1) the vestibule closed
// at both its sides, a box over every point of each gate's opening from its jamb to the wall's back and from the floor to
// 37.95 m, and the doorway's wall solid from the floor to the slab's collision across the room's width but its round opening;
// (2) the wall dark (no gold, no light) with gold strips on its face along its foot, at both its ends and under the slab;
// (3) each side door walked by a player both ways, from its hall into the room and out through the round doorway to the
// core's door; (4) from each 35 m hall a player running through the gate's south half lands on the room's floor; (5) the room two storeys
// tall: no box over it from 35 to 37.6 m inside the racks' row, the slab over it; no lit strip left hanging between them
{
  type Part95 = [string, number, number, number, number, number, number, string, string[]?];
  const TW95 = cfg.rules.tower as unknown as { clad?: Array<{ mat: string; boxes: number[][] }>; floors: { at: Record<string, { vault?: { rows: unknown[][]; door?: { across: number; inner?: number; room?: number[]; sides?: number[][]; parts: Part95[] } } }> } };
  const D95 = TW95.floors.at["32"].vault?.door;
  const room95 = D95?.room;
  const sides95 = D95?.sides ?? [];
  const ring95 = D95?.parts.find((q) => q[7] === "RING" && q[5] === 90);
  const S95 = (SOLIDS as { solids: number[][] }).solids.filter((b) => b[1] > -16 && b[0] < 2 && b[3] > -1 && b[2] < 11 && b[5] > 31 && b[4] < 39);
  const solid95 = (x: number, y: number, z: number) => S95.some((b) => x >= b[0] && x <= b[1] && z >= b[2] && z <= b[3] && y >= b[4] && y <= b[5]);
  const said95: string[] = [];
  let ok95 = !!room95 && !!ring95 && sides95.length === 2;
  if (room95 && ring95 && sides95.length === 2) {
    const [rx0, rx1, rz0, rz1] = room95;
    // (1) each gate's north half filled: across its thickness, from its jamb's collision (3.0) to the wall's back, floor to 37.95
    let gaps = 0;
    for (const [gx] of sides95)
      for (const dx of [-0.2, 0, 0.2])
        for (let z = 3.05; z < rz0 - 0.02; z += 0.1) for (let y = 32.1; y <= 37.95; y += 0.25) if (!solid95(gx + dx, y, z)) gaps++;
    const rIn = ((D95!.inner ?? 4.372) * ring95[6]) / 2;
    const [mx, my] = [ring95[1], 32 + ring95[2]];
    let wallGaps = 0;
    for (let x = rx0 + 0.05; x < rx1; x += 0.1)
      for (let y = 32.6; y <= 37.65; y += 0.1) if (Math.hypot(x - mx, y - my) > rIn + 0.25 && !solid95(x, y, rz0 - 0.1)) wallGaps++;
    said95.push(`sides closed ${gaps === 0} (${gaps} open points), the wall to the slab ${wallGaps === 0} (${wallGaps} open)`);
    // (2) the wall's face dark, gold strips on it
    const face = rz0 - 0.19;
    const onFace = (TW95.clad ?? []).flatMap((c) => c.boxes.map((b) => ({ mat: c.mat, b }))).filter(({ b }) => b[4] >= face - 0.06 && b[5] <= rz0 + 0.001 && b[0] < rx1 && b[1] > rx0);
    const wallMats = onFace.filter(({ b }) => b[5] - b[4] > 0.1).map(({ mat }) => mat);
    const dark = wallMats.length >= 30 && wallMats.every((m) => !/Golden|\|/.test(m));
    const gold = onFace.filter(({ mat, b }) => /Golden/.test(mat) && b[5] - b[4] < 0.06);
    const len = (list: number[][]) => list.reduce((s, b) => s + (b[1] - b[0]), 0);
    const foot = len(gold.filter(({ b }) => b[2] <= 32.01 && b[3] <= 32.3).map(({ b }) => b));
    const top = gold.some(({ b }) => b[3] >= 37.9 && b[0] <= rx0 + 0.05 && b[1] >= rx1 - 0.05);
    const ends = [rx0, rx1].every((e) => gold.some(({ b }) => b[2] <= 32.01 && b[3] >= 37.9 && Math.min(Math.abs(b[0] - e), Math.abs(b[1] - e)) < 0.1 && b[1] - b[0] < 0.2));
    ok95 &&= gaps === 0 && wallGaps === 0 && dark && foot >= 4 && top && ends;
    said95.push(`the wall ${dark ? "dark steel" : `not dark (${[...new Set(wallMats)].join(", ")})`}, gold trim: ${foot.toFixed(2)} m along its foot, under the slab ${top}, at both ends ${ends}`);
    // (3) the side doors walked both ways, on into the room and out through the doorway to the core's door
    const mid = (rz0 + Math.min(rz1, sides95[0][2])) / 2;
    const ways95 = sides95.map(([gx]) => {
      const s = gx < ring95[1] ? -1 : 1;
      return [[gx + s * 1.6, mid - 1.6, 32], [gx + s * 1.2, mid, 32], [gx - s * 0.9, mid, 32], [ring95[1], mid, 32], [ring95[1], face - 0.8, 32], [-9.975, 2.9, 32], [-9.975, 1, 32]];
    });
    const walked = ways95.map((w) => [w, [...w].reverse()].every((r) => { const a = along(r); return a.k === r.length && Math.abs(a.y - r.at(-1)![2]) < 0.15; }));
    ok95 &&= walked.every(Boolean);
    said95.push(`side doors walked both ways ${walked.join("/")}`);
    // (4) the drop-ins: a player 1.2 m out from each gate on the 35 m floor, facing the room, running on
    const drops = sides95.map(([gx]) => {
      const s = gx < ring95[1] ? -1 : 1;
      const p = new Player({ minX: BR_X - 400, maxX: BR_X + 400, minZ: BR_Z - 400, maxZ: BR_Z + 400 });
      p.teleport(gx + s * 1.2 + BR_X, 35.05, mid + BR_Z, s < 0 ? -90 : 90);
      let t = 1000;
      const input = { held: (a: Action) => a === "forward", pressedNow: (_a: Action) => false };
      for (let i = 0; i < 144 * 4; i++) {
        p.update(1 / 144, (t += 1 / 144), input, 0, 1, false);
        if (p.pos.y < 32.3 && p.onGround) break;
      }
      const [x, z] = [p.pos.x - BR_X, p.pos.z - BR_Z];
      return { ok: p.onGround && Math.abs(p.pos.y - 32) < 0.15 && x > rx0 && x < rx1 && z > rz0 && z < rz1 + 0.05, at: `(${x.toFixed(1)}, ${p.pos.y.toFixed(2)}, ${z.toFixed(1)})` };
    });
    ok95 &&= drops.every((d) => d.ok);
    said95.push(`dropped in from 35 m to ${drops.map((d) => d.at).join(" and ")}`);
    // (5) two storeys tall, the slab over it, no strip hanging in between
    let roofed = 0, cells = 0;
    // (half a metre in from its sides: each gate's collision column stands 0.45 m into the room past its face)
    for (let x = rx0 + 0.5; x < rx1 - 0.5; x += 0.25)
      for (let z = rz0 + 0.3; z < 6.3; z += 0.25) {
        cells++;
        if (S95.some((b) => x >= b[0] && x <= b[1] && z >= b[2] && z <= b[3] && b[5] > 35.05 && b[4] < 37.6)) roofed++;
      }
    const slab = (() => {
      for (let x = rx0 + 0.25; x < rx1; x += 0.5) for (let z = rz0 + 0.25; z < rz1; z += 0.5) if (!S95.some((b) => x >= b[0] && x <= b[1] && z >= b[2] && z <= b[3] && b[4] <= 38.1 && b[5] >= 37.7)) return false;
      return true;
    })();
    const pl95 = ((cfg as unknown as { chunks: Record<string, { place: unknown[][] }> }).chunks["c-tower"]?.place ?? []);
    const hanging = pl95.filter((q) => String(q[0]).endsWith("/Lighting_Deco00e_lgt Variant.prefab") && Number(q[1]) > rx0 && Number(q[1]) < rx1 && Number(q[3]) > rz0 && Number(q[3]) < rz1 && Number(q[2]) > 34.6 && Number(q[2]) < 37.8).length;
    ok95 &&= roofed === 0 && cells > 100 && slab && hanging === 0;
    said95.push(`${roofed} of ${cells} cells over it shut from 35 to 37.6 m, the slab over it ${slab}, ${hanging} strips hanging mid-air`);
  }
  check(
    "THE VAULT's strongroom closed wall to wall and floor to ceiling: the vestibule's sides filled to the slab, its wall solid to the slab in dark steel with gold trim, a side door from each hall walked, a drop-in from each 35 m hall, two storeys tall under the slab",
    ok95,
    said95.join("; ") || "no room, ring or side doors named",
  );
}

// The centre's streets dense, and the street finish (Milestone 1098; the centre's twenty-first reviews of version 140). The
// streets: A rank 5 "break the long sightlines down the carriageways with cover 2 to 3 m high", 03 and 04; B rank 4 "narrow
// the exposed streets ... in denser clusters, about 8 m apart", 05 and 16: the carriageway's stations `between` (rules.dress.
// carriage.between), laid in the gaps between the stations of each street, each its own street's `apart` and more from the
// rest, the stations about 8 m apart down the Loop and seven corner streets, and the share of a standing eye's lines down each
// street past 35 m cut. The finish: 16 "a curved panel with a blue glow lies flat on the paving, like a fallen sign" (both), the street
// furniture's double bench, out of its list for the single one; 19 "a hard black rectangle on the concrete with no caster"
// (both), THE WELL's frame's post drawn in the ropes' near-black cable 2 m beside the rope's step-off, in its own steel now
// and behind the step-off; 20b "a pillar cuts off the LOWER COURT sign" (A), the board moved along its wall to where the
// court's east lane sees it whole; 27 "the pink frame at the stair foot reads as a free-standing portal" (B), the High City
// fire escapes' frames out and their first flights lit up both sides on their treads
{
  type St98 = { street: string; at: number; set: string; between?: boolean };
  const CA98 = (cfg.rules.dress as unknown as { carriage: { every: number; between?: { apart: number; spread: number } } }).carriage;
  const ST98 = (cfg as unknown as { carriage?: St98[] }).carriage ?? [];
  const CV98 = cfg.rules.streets.curves as unknown as Parameters<typeof curvedStreets>[0];
  const list98 = curvedStreets(CV98);
  // (1) the stations between: how many, and each street's stations about 8 m apart, none nearer than `apart`
  const bt98 = ST98.filter((s) => s.between);
  const near98: string[] = [];
  const gapsSaid98: string[] = [];
  let spaced98 = true;
  for (const st of list98) {
    const L = (st.pts.length - (st.closed ? 0 : 1)) * 0.5;
    const at = ST98.filter((s) => s.street === st.id).map((s) => s.at).sort((a, b) => a - b);
    const gaps = at.slice(1).map((a, i) => a - at[i]);
    if (st.closed && at.length) gaps.push(at[0] + L - at[at.length - 1]);
    for (const g of gaps) if (g < (CA98.between?.apart ?? 0) - 0.01) near98.push(`${st.id} ${g.toFixed(1)} m`);
    const med = [...gaps].sort((a, b) => a - b)[Math.floor(gaps.length / 2)] ?? Infinity;
    // (a street with stations between them about 8 m apart; one corner street may take none, as ne-n does: its gaps' spots
    // shut the last ways out of the four street nodes beside it, rules.dress.carriage.between.keep)
    if (bt98.some((s) => s.street === st.id) ? !(med <= 10.5) : st.closed) spaced98 = false;
    gapsSaid98.push(`${st.id} ${at.length} (${bt98.filter((s) => s.street === st.id).length} between, ${med} m)`);
  }
  // (2) sight lines down the streets at a standing eye (1.6 m): from each street's carriageway every metre along it and across
  // its lanes, a ray each way along the street's own line, stopped by the first box of the collision spanning the eye's height,
  // out to 100 m; the share past 35 m, each street's (version 140: the Loop 19.3%, nw-n 30.9%)
  const EYE98 = 1.6, C98 = 0.25, H98 = 160, N98 = Math.round((2 * H98) / C98);
  const occ98 = new Uint8Array(N98 * N98);
  for (const b of (SOLIDS as { solids: number[][] }).solids) {
    if (!(b[4] < EYE98 && b[5] > EYE98) || b[1] < -H98 || b[0] > H98 || b[3] < -H98 || b[2] > H98) continue;
    const i0 = Math.max(0, Math.floor((b[0] + H98) / C98)), i1 = Math.min(N98 - 1, Math.ceil((b[1] + H98) / C98) - 1);
    const j0 = Math.max(0, Math.floor((b[2] + H98) / C98)), j1 = Math.min(N98 - 1, Math.ceil((b[3] + H98) / C98) - 1);
    for (let i = i0; i <= i1; i++) if (j1 >= j0) occ98.fill(1, i * N98 + j0, i * N98 + j1 + 1);
  }
  const cell98 = (x: number, z: number) => {
    const i = Math.floor((x + H98) / C98), j = Math.floor((z + H98) / C98);
    return i < 0 || j < 0 || i >= N98 || j >= N98 ? 1 : occ98[i * N98 + j];
  };
  const ray98 = (x: number, z: number, dx: number, dz: number) => {
    for (let t = 0; t < 100; t += 0.125) if (cell98(x + dx * t, z + dz * t)) return t;
    return 100;
  };
  const EDGE98 = (cfg.rules.low as unknown as { edge: number }).edge;
  const far98: Record<string, number> = {};
  for (const st of list98) {
    let n = 0, past = 0;
    for (let k = 0; k < st.pts.length; k += 2) {
      const [px, pz] = st.pts[k];
      if (Math.max(Math.abs(px), Math.abs(pz)) >= EDGE98) continue;
      const [tx, tz] = st.tan[k];
      for (let off = -st.half + 0.75; off <= st.half - 0.75 + 1e-9; off += 1) {
        const [x, z] = [px - tz * off, pz + tx * off];
        if (cell98(x, z)) continue;
        for (const sg of [1, -1]) {
          n++;
          if (ray98(x, z, tx * sg, tz * sg) > 35) past++;
        }
      }
    }
    far98[st.id] = +((past / Math.max(1, n)) * 100).toFixed(1);
  }
  const long98 = Object.entries(far98).filter(([id, v]) => v > (id === "loop" ? 18 : 27));
  check(
    "the streets dense: stations between the carriageway's stations down the Loop and seven corner streets and more, those streets' about 8 m apart and none nearer than `apart`, and a standing eye's lines down each street past 35 m cut (the Loop 18% and under, every corner street 27%)",
    !!CA98.between && bt98.length >= 16 && bt98.filter((s) => s.street === "loop").length >= 5 && list98.filter((st) => !st.closed && bt98.some((s) => s.street === st.id)).length >= 7 && spaced98 && near98.length === 0 && long98.length === 0,
    `${bt98.length} between of ${ST98.length} stations: ${gapsSaid98.join(", ")}${near98.length ? `; too near ${near98.slice(0, 3).join(", ")}` : ""}; lines past 35 m ${Object.entries(far98).map(([id, v]) => `${id} ${v}%`).join(", ")}`,
  );
  // (3) no double bench
  const placed98 = Object.values((cfg as unknown as { chunks: Record<string, { place: unknown[][] }> }).chunks).flatMap((ch) => ch.place);
  const FU98 = (cfg.rules.dress as unknown as { furniture: { pieces: string[] } }).furniture.pieces;
  const dbl98 = placed98.filter((q) => String(q[0]).endsWith("/StreetFurniture004.prefab")).length;
  check(
    "16's fallen sign gone: no double bench (StreetFurniture004, its wide lit seat face up) in the street furniture's list or laid anywhere",
    FU98.length >= 9 && !FU98.includes("StreetFurniture004.prefab") && dbl98 === 0,
    `${FU98.filter((p) => p === "StreetFurniture004.prefab").length} in the list of ${FU98.length}, ${dbl98} laid`,
  );
  // (4) THE WELL's frame in its own steel, its post behind the rope's step-off: a mid grey, not the cable's near black, drawn
  // so in the ropes' group; the post a metre and more past the rail's outer face along the rope's way out (19's eye stands at
  // the rail, where a rider steps off)
  const F98 = wellFrame();
  const W98 = (cfg as unknown as { well: { ropes: Array<{ rope: number[][]; out: number[] }>; rail: number[][] } }).well;
  const FC98 = (F98?.cfg ?? {}) as { colour?: string };
  let back98 = NaN, grey98 = NaN, drawn98 = 0;
  if (F98) {
    const [rx, rz] = F98.rope;
    const [ox, oz] = W98.ropes[0].out;
    const [ax, az] = [-oz, ox];
    const nearRail = W98.rail.filter(([x0, x1, z0, z1]) => Math.abs(((x0 + x1) / 2 - rx) * ax + ((z0 + z1) / 2 - rz) * az) < 1);
    const face = Math.max(...nearRail.flatMap(([x0, x1, z0, z1]) => [x0, x1].flatMap((x) => [z0, z1].map((z) => (x - rx) * ox + (z - rz) * oz))));
    back98 = (F98.post[0] - rx) * ox + (F98.post[1] - rz) * oz - face;
    if (FC98.colour && /^#[0-9a-f]{6}$/i.test(FC98.colour)) {
      grey98 = [1, 3, 5].reduce((s, i) => s + parseInt(FC98.colour!.slice(i, i + 2), 16) / 255, 0) / 3;
      const want = new THREE.Color(FC98.colour).getHexString();
      scene.getObjectByName("neon:ropes")?.traverse((o) => {
        const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
        if ((o as THREE.Mesh).isMesh && m?.color && m.color.getHexString() === want) drawn98++;
      });
    }
  }
  check(
    "19's black rectangle gone: THE WELL's frame drawn in its own mid-grey steel, not the ropes' near-black cable, its post a metre and more behind the rail where a rider steps off",
    !!F98 && back98 >= 1 && grey98 >= 0.3 && grey98 <= 0.7 && drawn98 >= 1,
    F98 ? `post ${back98.toFixed(2)} m past the rail's face, ${FC98.colour ?? "no colour"} (grey ${grey98.toFixed(2)}), ${drawn98} meshes in it` : "no frame",
  );
  // (5) LOWER COURT seen whole from the court's east lane (picture 20b's eye): the lines to its ends, middle, foot and top clear
  // of the collision, and nothing standing within 0.4 m of its face
  type B98 = { text: string; at: number[]; yaw: number; w: number; h: number };
  const LC98 = (cfg.game as unknown as { boards: B98[] }).boards.filter((b) => b.text === "LOWER COURT");
  const S98 = (SOLIDS as { solids: number[][] }).solids.filter((b) => b[1] > -25 && b[0] < 5 && b[3] > -12 && b[2] < 3 && b[4] < -2 && b[5] > -8);
  const eye98 = [-6.5, -5.3, -1.0];
  const hid98: string[] = [];
  let front98 = 0;
  for (const b of LC98) {
    const a = (b.yaw * Math.PI) / 180;
    const [ux, uz, nx, nz] = [Math.cos(a), -Math.sin(a), Math.sin(a), Math.cos(a)];
    for (const s of [-0.48, 0, 0.48])
      for (const t of [-0.45, 0, 0.45]) {
        const p = [b.at[0] + ux * s * b.w + nx * 0.03, b.at[1] + t * b.h, b.at[2] + uz * s * b.w + nz * 0.03];
        const n = Math.ceil(Math.hypot(p[0] - eye98[0], p[1] - eye98[1], p[2] - eye98[2]) / 0.05);
        for (let k = 1; k < n; k++) {
          const [x, y, z] = [0, 1, 2].map((i) => eye98[i] + ((p[i] - eye98[i]) * k) / n);
          if (S98.some((q) => x > q[0] && x < q[1] && z > q[2] && z < q[3] && y > q[4] && y < q[5])) {
            hid98.push(`(${p[0].toFixed(1)}, ${p[1].toFixed(1)})`);
            break;
          }
        }
      }
    const cs = [-0.5, 0.5].flatMap((s) => [0, 0.4].map((d) => [b.at[0] + ux * s * b.w + nx * d, b.at[2] + uz * s * b.w + nz * d]));
    const [x0, x1, z0, z1] = [Math.min(...cs.map((q) => q[0])), Math.max(...cs.map((q) => q[0])), Math.min(...cs.map((q) => q[1])), Math.max(...cs.map((q) => q[1]))];
    front98 += S98.filter((q) => q[0] < x1 && q[1] > x0 && q[2] < z1 && q[3] > z0 && q[4] < b.at[1] + b.h / 2 && q[5] > b.at[1] - b.h / 2 && !(q[3] <= b.at[2] + 0.001 && nz > 0.5) && !(q[2] >= b.at[2] - 0.001 && nz < -0.5)).length;
  }
  check(
    "20b's sign whole: LOWER COURT seen from the court's east lane (picture 20b's eye), the lines to its ends, middle, foot and top clear of the pillars and the chests, nothing standing within 0.4 m of its face",
    LC98.length === 1 && hid98.length === 0 && front98 === 0,
    `${LC98.length} board${LC98[0] ? ` at (${LC98[0].at.join(", ")}) ${LC98[0].w} m` : ""}, ${hid98.length} of 9 points hidden${hid98.length ? ` (${hid98.slice(0, 3).join(", ")})` : ""}, ${front98} boxes in front of it`,
  );
  // (6) the High City fire escapes' first flights lit up both sides, each strip on a tread of the collision (its foot within 3
  // cm over the tread's top), foot to landing; no frame of the climbs standing at their foot
  const O98 = (cfg.game as unknown as { outlines: Array<{ name: string; frames?: number[][]; lines?: number[][] }> }).outlines;
  const FE98 = O98.filter((q) => /^the fire escape .* flight$/.test(q.name) && q.lines);
  const { outlineBoxes: ob98 } = await import("../../src/game/outlines");
  const SA98 = (SOLIDS as { solids: number[][] }).solids;
  const CL98 = O98.find((q) => q.name === "the climbs")?.frames ?? [];
  const said98: string[] = [];
  let lit98 = 0, off98 = 0;
  for (const q of FE98) {
    const mine = ob98((n) => n === q.name);
    const bad = mine.filter((s) => {
      const [x, z] = [(s[0] + s[1]) / 2, (s[2] + s[3]) / 2];
      return !SA98.some((b) => x > b[0] && x < b[1] && z > b[2] && z < b[3] && s[4] - b[5] >= -0.005 && s[4] - b[5] < 0.03 && b[5] - b[4] < 0.1);
    }).length;
    off98 += bad;
    const lo = Math.min(...mine.map((b) => b[4])), hi = Math.max(...mine.map((b) => b[4]));
    const portal = CL98.some(([x, z]) => Math.hypot(x - q.lines![0][0], z - q.lines![0][1]) < 2);
    if (mine.length >= 20 && lo < 0.3 && hi > 2.7 && !portal) lit98++;
    said98.push(`${q.name} ${mine.length} strips ${lo.toFixed(2)} to ${hi.toFixed(2)} m, ${bad} off a tread${portal ? ", a frame at its foot" : ""}`);
  }
  check(
    "27's portal gone: the High City fire escapes' first flights lit up both sides on their treads, foot to landing, no frame standing at their foot",
    FE98.length === 2 && lit98 === 2 && off98 === 0,
    said98.join("; ") || "no flights lit",
  );
}

// The High City's ledge stacks (Milestone 1096; the centre's twenty-first reviews, A rank 1: "a balcony stack or ledge band per
// block"; B rank 5: "ledges, AC units and balconies a mantle apart on the High City towers"; rules.blocks.ledges as the layout
// laid them, cfg.ledges): a stack on every block, each ledge `every` over the one under it and within a plain jump and a
// mantle of it (movement.json's jump and mantle heights, less `spare`), the first so from the street under it and the deck
// so from the last; each ledge's back on its block's face (the block's own collision, not the laid boxes, within 0.6 m in
// from its back's middle at the ledge's height) and none over the ledge under it; each in its block's own colour; and each
// stack climbed by the game's own Player with SpeedKills' extra moves off (no double jump, no wall run): from the street
// onto the first by its far end, then from each ledge's near end onto the next one's, each from a stop 0.7 m short of
// the next one's collision and a standing jump with the way held, then from the last onto the deck
{
  type LD9 = { block: string; deck: number[]; ledges: Array<{ c: number[]; y: number; yaw: number; n: number[]; hu: number; hv: number }> };
  const LDs = (cfg as unknown as { ledges?: LD9[] }).ledges ?? [];
  const LR = (cfg.rules.blocks as unknown as { ledges?: { every: number; spare: number; mats: Record<string, string>; at: Array<{ block: string }> } }).ledges;
  const HL = cfg.rules.high as unknown as Record<string, { looks?: string }>;
  const up = MOVE.jumpHeight + MOVE.mantleHeight - (LR?.spare ?? 0.25);
  const F9 = SOLIDS as unknown as { solids: number[][]; laid: number[][] };
  const laid9 = new Uint8Array(F9.solids.length);
  for (const [a, b] of F9.laid) laid9.fill(1, a, b);
  // (the top of what stands at a point under a height, the laid boxes in or out)
  const topUnder = (x: number, z: number, below: number, own: boolean) => F9.solids.reduce((t, b, i) => (x >= b[0] && x <= b[1] && z >= b[2] && z <= b[3] && b[4] < below && b[5] > t && (own || !laid9[i]) ? b[5] : t), -Infinity);
  const inBlock = (x: number, z: number, y: number) => F9.solids.some((b, i) => !laid9[i] && x >= b[0] && x <= b[1] && z >= b[2] && z <= b[3] && b[4] < y && b[5] > y);
  const said: string[] = [];
  let ok = !!LR && LDs.length >= 3 && LDs.length === LR.at.length && new Set(LDs.map((s) => s.block)).size === LDs.length;
  const DT = 1 / 144;
  const goal = (p: InstanceType<typeof Player>, to: number[]) => (Math.atan2(-(to[0] - (p.pos.x - BR_X)), -(to[1] - (p.pos.z - BR_Z))) * 180) / Math.PI;
  // (a ledge's footprint as laid, `pad` past it: its middle, its own x out of the face, its own z along it; a body stands on
  // its collision up to a half-metre column past the drawn piece)
  const onLedge = (L: LD9["ledges"][number], x: number, z: number, pad = 0.55) => {
    const [dx, dz] = [x - L.c[0], z - L.c[1]];
    return Math.abs(dx * L.n[0] + dz * L.n[1]) <= L.hu + pad && Math.abs(-dx * L.n[1] + dz * L.n[0]) <= L.hv + pad;
  };
  for (const S of LDs) {
    const bad: string[] = [];
    const L = S.ledges;
    // the heights: the street under the first ledge's lip, each step, the deck over the last
    const street = Math.max(0, topUnder(L[0].c[0] + L[0].n[0] * (L[0].hu + 0.5), L[0].c[1] + L[0].n[1] * (L[0].hu + 0.5), 2, false));
    const steps = [L[0].y - street, ...L.slice(1).map((q, k) => q.y - L[k].y), S.deck[2] - L[L.length - 1].y];
    if (steps.some((d) => d > up || d <= 0)) bad.push(`steps ${steps.map((d) => d.toFixed(2)).join("/")} m, a jump and a mantle ${up.toFixed(2)}`);
    // on the face: the block's own collision within 0.6 m in from each back's middle, at the ledge's height
    const off = L.filter((q) => !inBlock(q.c[0] - q.n[0] * (q.hu + 0.6), q.c[1] - q.n[1] * (q.hu + 0.6), q.y - 0.5));
    if (off.length) bad.push(`${off.length} ledges off the face (${off.map((q) => q.y).join(", ")} m)`);
    // none over the one under it: a body on a ledge never stands under the next
    const overlap = L.slice(1).filter((q, k) => {
      const P = L[k];
      for (let a = -1; a <= 1; a += 0.25) for (let b = -1; b <= 1; b += 0.25) {
        const [x, z] = [P.c[0] + P.n[0] * P.hu * a - P.n[1] * P.hv * b, P.c[1] + P.n[1] * P.hu * a + P.n[0] * P.hv * b];
        if (onLedge(q, x, z, 0.05)) return true;
      }
      return false;
    });
    if (overlap.length) bad.push(`${overlap.length} ledges over the one under`);
    const tint = /MetalPaintWhiteCracked00=MetalPaintWhiteCracked00\*(#[0-9a-f]{6})/.exec(HL[S.block]?.looks ?? "")?.[1];
    if (!tint || !(LR?.mats[S.block] ?? "").includes(`*${tint}`)) bad.push(`not in its block's ${tint ?? "?"}`);
    // climbed: the game's own Player, no extra moves; each leg from a stop on its spot, a standing jump with the way held
    const p = new Player({ minX: BR_X - 400, maxX: BR_X + 400, minZ: BR_Z - 400, maxZ: BR_Z + 400 });
    p.sprintMode = "auto";
    p.extraMoves = false;
    const t = { v: 1000 };
    const still = (s: number) => {
      for (let i = 0; i < s / DT; i++) p.update(DT, (t.v += DT), idle, 0, 1, false);
    };
    const walkTo = (to: number[]) => {
      for (let i = 0; i < 6 / DT; i++) {
        const d = Math.hypot(to[0] - (p.pos.x - BR_X), to[1] - (p.pos.z - BR_Z));
        if (d < 0.1) break;
        p.yaw = goal(p, to);
        const fwd = d > 0.6 || Math.hypot(p.vel.x, p.vel.z) < 0.8;
        p.update(DT, (t.v += DT), { held: (a: Action) => fwd && a === "forward", pressedNow: (_a: Action) => false }, 0, 1, false);
      }
      still(0.4);
    };
    const jumpTo = (to: number[]) => {
      p.yaw = goal(p, to);
      let left = false;
      for (let i = 0; i < 3 / DT; i++) {
        p.update(DT, (t.v += DT), { held: (a: Action) => a === "forward" || (a === "jump" && i < 40), pressedNow: (a: Action) => a === "jump" && i === 0 }, 0, 1, false);
        if (!p.onGround) left = true;
        else if (left) break;
      }
      still(0.4);
    };
    const at = () => `(${(p.pos.x - BR_X).toFixed(2)}, ${p.pos.y.toFixed(2)}, ${(p.pos.z - BR_Z).toFixed(2)})`;
    // (where a line from `a` to `b` first meets a box spanning a ledge's slab at `y`, and the take-off 0.7 m short of
    // it: the bake's half-metre columns stand up to a cell past the drawn piece, and a body under one bumps its head; 0.7 m is a body's half breadth and the walk's stop)
    const shortOf = (a: number[], b: number[], y: number) => {
      const L9 = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const d = [(b[0] - a[0]) / L9, (b[1] - a[1]) / L9];
      for (let s9 = 0; s9 <= L9; s9 += 0.05) {
        const [x, z] = [a[0] + d[0] * s9, a[1] + d[1] * s9];
        if (F9.solids.some((q) => x >= q[0] && x <= q[1] && z >= q[2] && z <= q[3] && q[5] > y - 0.15 && q[4] < y - 0.4)) return [x - d[0] * 0.7, z - d[1] * 0.7];
      }
      return b;
    };
    // (from the street: along the face to 0.75 m past the first ledge's far end, 0.8 m out of the face, a jump into its end;
    // its lip is a diagonal of half-metre cells on a lobe, some topped at its bevel, and a mantle there finds the bevel)
    const L0 = L[0];
    const al0 = [-L0.n[1], L0.n[0]];
    const s0 = L.length > 1 ? -Math.sign((L[1].c[0] - L0.c[0]) * al0[0] + (L[1].c[1] - L0.c[1]) * al0[1]) : 1;
    const by0 = (d: number) => [L0.c[0] - L0.n[0] * (L0.hu - 0.8) + al0[0] * s0 * (L0.hv + d), L0.c[1] - L0.n[1] * (L0.hu - 0.8) + al0[1] * s0 * (L0.hv + d)];
    p.teleport(by0(3)[0] + BR_X, street + 0.05, by0(3)[1] + BR_Z, 0);
    still(0.5);
    let k = 0;
    walkTo(shortOf(by0(3), L0.c, L0.y));
    jumpTo(L0.c);
    let onto = onLedge(L0, p.pos.x - BR_X, p.pos.z - BR_Z) && Math.abs(p.pos.y - L0.y) < 0.3;
    if (!onto) bad.push(`from the street, at ${at()}`);
    // (ledge to ledge: along the one under, 0.8 m out of its back, toward the next one's near end, from a stop short of it)
    for (k = 1; onto && k < L.length; k++) {
      const [P, Q] = [L[k - 1], L[k]];
      const alongP = [-P.n[1], P.n[0]];
      const s = Math.sign((Q.c[0] - P.c[0]) * alongP[0] + (Q.c[1] - P.c[1]) * alongP[1]);
      const backP = [P.c[0] - P.n[0] * P.hu, P.c[1] - P.n[1] * P.hu];
      const end = [backP[0] + P.n[0] * 0.8 + alongP[0] * s * (P.hv - 0.6), backP[1] + P.n[1] * 0.8 + alongP[1] * s * (P.hv - 0.6)];
      const alongQ = [-Q.n[1], Q.n[0]];
      const backQ = [Q.c[0] - Q.n[0] * Q.hu, Q.c[1] - Q.n[1] * Q.hu];
      const toward = [backQ[0] + Q.n[0] * 0.8 - alongQ[0] * s * (Q.hv - 0.6), backQ[1] + Q.n[1] * 0.8 - alongQ[1] * s * (Q.hv - 0.6)];
      walkTo(shortOf(end, toward, Q.y));
      jumpTo(toward);
      onto = onLedge(Q, p.pos.x - BR_X, p.pos.z - BR_Z) && Math.abs(p.pos.y - Q.y) < 0.3;
      if (!onto) bad.push(`from the ${P.y} m ledge to the ${Q.y} m, at ${at()}`);
    }
    // (onto the deck: from the last one's middle, 0.8 m out of its back, a jump into the face, and a second where the face
    // has a band to stand on short of the deck's rim; on the deck when standing at its floor or its rim, 0.85 m over it)
    if (onto) {
      const Z = L[L.length - 1];
      walkTo([Z.c[0] - Z.n[0] * (Z.hu - 0.8), Z.c[1] - Z.n[1] * (Z.hu - 0.8)]);
      const onDeck = () => p.onGround && p.pos.y > S.deck[2] - 0.1 && p.pos.y < S.deck[2] + 1 && Math.hypot(p.pos.x - BR_X - S.deck[0], p.pos.z - BR_Z - S.deck[1]) < 3;
      jumpTo([S.deck[0], S.deck[1]]);
      if (!onDeck() && p.pos.y > Z.y + 0.5) jumpTo([S.deck[0], S.deck[1]]);
      const there = onDeck();
      if (!there) bad.push(`from the ${Z.y} m ledge onto the deck, at ${at()}`);
      else k++;
    }
    if (bad.length) ok = false;
    said.push(`${S.block} ${L.length} ledges to the deck at ${S.deck[2]} m: ${bad.length ? bad.join("; ") : `climbed, ${k} of ${L.length + 1} legs`}`);
  }
  check("the High City's ledge stacks: one up the outer face of every block the rule names (north, west, south), in its block's own colour, each ledge a plain jump and a mantle over the one under it and on the face, climbed from the street onto the deck by a player with no double jump", ok, said.join("; ") || "no rules.blocks.ledges");
}

// GLASS HEIGHTS at street level, for real (Milestone 1099; the districts' fifteenth reviews of version 140, 2026-11-08, GLASS
// HEIGHTS 6.4 and 5.9: "give GLASS HEIGHTS' street level real fronts: replace the blank grey lower panels with glazed lobbies,
// lit interiors, canopies and recessed doors" (d13, d13b, d15); "the slabs inside the lift shaft read as unsupported floating
// shelves"; "cyan crystal shapes on the left facade look like stray decals" (d14); the gap plan's "the lift's foot a sheltered
// stop")
{
  type Pl99 = [string, number, number, number, number, string, (string | null)?, (string[] | null)?, (number | null)?];
  const CH99 = (cfg as unknown as { chunks: Record<string, { place: Pl99[] }> }).chunks;
  const GP99 = CH99[(cfg.rules.districts as unknown as { glass: { chunk: string } }).glass.chunk]?.place ?? [];
  type Sh99 = { id: string; kind: string; at: number[]; out: number[]; w: number; h: number; glaze: number; front: number; back: number; canopy: number; cuts: number; building: number };
  const GC99 = (cfg as unknown as { glass: { shops?: Sh99[]; stop?: number[][]; slabs: Array<{ piece: string; c: number[] }> } }).glass;
  type Gr99 = { look: { white: string }; buildings: Array<[string, number, number, number, string?]>; light: { strip: string }; lift: { car: number[]; shaft: { mat: string; half: number }; stop?: { piece: string } }; shops?: { light: string; tile: string; kinds: Record<string, Array<[string, number, number, number]>>; list: Array<{ id: string; skin: number[] }> } };
  const G99 = (cfg.rules.districts as unknown as { glass: Gr99 }).glass;
  const S99 = (SOLIDS as { solids: number[][] }).solids.filter((b) => b[1] > -40 && b[0] < 40 && b[3] > -160 && b[2] < -95);
  const solid99 = (x: number, y: number, z: number) => S99.some((b) => x >= b[0] && x <= b[1] && z >= b[2] && z <= b[3] && b[4] < y && b[5] > y);
  const remap99 = (s: unknown) => new Map(String(s ?? "").split(";").filter((p) => p.includes("=")).map((p) => p.split("=") as [string, string]));
  const said99: string[] = [];
  let ok99 = true;
  const part99 = (ok: boolean, text: string) => {
    if (!ok) ok99 = false;
    said99.push(`${ok ? "" : "NOT: "}${text}`);
  };
  // (1) the shops: seven and more, each cut out of its block's own skin (its placement's "*|" boxes), its glazing in the clear
  // glass across the opening, the doorway open in front of it (a body's middle there meets nothing), the glazing solid across
  // its width and a lid over the recess at the opening's head, a lit ceiling and the kind's furniture in the room behind, a
  // canopy reaching 0.8 m and more past the skin with a lit strip under it where it has one, and the glazing seen whole from a
  // standing eye 4 m out (nothing solid on the look to its middle)
  const SH99 = GC99.shops ?? [];
  // (each block's row by its order among its own piece's rows: the layout lays `buildings` first and in order, two of them the
  // same piece)
  const blocks99 = G99.buildings.map(([name], i) => GP99.filter((q) => String(q[0]).endsWith(`/${name}`) && q[5] === "o")[G99.buildings.slice(0, i).filter(([n]) => n === name).length]);
  const frame99 = (s: Sh99, q: Pl99) => {
    const [nx, nz] = s.out;
    const [dx, dz] = [Number(q[1]) - s.at[0], Number(q[3]) - s.at[1]];
    return { a: -nz * dx + nx * dz, n: nx * dx + nz * dz };
  };
  const bad99: string[] = [];
  const canopied99: string[] = [];
  for (const s of SH99) {
    const [nx, nz] = s.out;
    const u = [-nz, nx];
    const P = (a: number, n: number) => [s.at[0] + u[0] * a + nx * n, s.at[1] + u[1] * a + nz * n];
    const fault: string[] = [];
    const B = blocks99[s.building];
    const cut = ((B?.[7] ?? []) as string[]).filter((w) => w.startsWith("*|")).length;
    if (cut < s.cuts || s.cuts < 1) fault.push(`${cut} cuts`);
    const near = GP99.map((q) => ({ q, f: frame99(s, q) })).filter(({ f }) => Math.abs(f.a) < s.w / 2 + 0.8 && f.n < s.front + 1.5 && f.n > s.back - 1);
    const glazing = near.filter(({ q, f }) => /\/WindowWall0[01] Variant\.prefab$/.test(String(q[0])) && Math.abs(f.n - s.glaze) < 0.15 && /^Cristal03/.test(remap99(q[6]).get("Cristal04") ?? ""));
    if (!glazing.length) fault.push("no clear glazing");
    const door = P(0, s.glaze + 0.22);
    if (solid99(door[0], 1, door[1])) fault.push("the doorway shut");
    const across = [-0.4, 0, 0.4].filter((t) => {
      const p = P(t * s.w, s.glaze);
      return solid99(p[0], 1, p[1]);
    }).length;
    if (across < 3) fault.push(`the glazing solid at ${across} of 3`);
    if (!solid99(door[0], s.h + 0.12, door[1])) fault.push("no lid over the recess");
    const lit = near.filter(({ q, f }) => String(q[0]).endsWith(`/${G99.shops!.light}`) && f.n < s.glaze && f.n > s.back).length;
    const kit = (G99.shops!.kinds[s.kind] ?? []).map(([n]) => n);
    const furnished = near.filter(({ q, f }) => kit.some((n) => String(q[0]).endsWith(`/${n}`)) && f.n < s.glaze && f.n > s.back - 0.2).length;
    if (!lit || furnished < Math.min(2, kit.length)) fault.push(`${lit} lights, ${furnished} pieces of furniture inside`);
    if (s.canopy) {
      const skinHi = (G99.shops!.list.find((l) => l.id === s.id)?.skin ?? [0, 0])[1];
      const strip = near.filter(({ q, f }) => String(q[0]).endsWith(`/${G99.light.strip}`) && f.n > s.glaze && f.n < s.canopy && Number(q[2]) < s.h + 0.3).length;
      if (s.canopy < skinHi + 0.8 || !strip) fault.push(`the canopy to ${s.canopy.toFixed(2)}, ${strip} strips`);
      else canopied99.push(s.id);
    }
    const eye = P(0, s.front + 4);
    const mid = P(0, s.glaze + 0.08);
    let blocked = false;
    for (let t = 0; t <= 1.0001; t += 0.02) {
      const [x, z] = [eye[0] + (mid[0] - eye[0]) * t, eye[1] + (mid[1] - eye[1]) * t];
      if (solid99(x, 1.6 + (1.5 - 1.6) * t, z)) blocked = true;
    }
    if (blocked) fault.push("hidden from 4 m out");
    if (fault.length) bad99.push(`${s.id}: ${fault.join(", ")}`);
  }
  part99(SH99.length >= 7 && bad99.length === 0 && canopied99.length >= 6, `${SH99.length} shops (${SH99.map((s) => `${s.id} ${s.w} by ${s.h} m`).join(", ")}), ${canopied99.length} canopied${bad99.length ? `; ${bad99.join("; ")}` : ""}`);
  // (2) the lift's shaft one clear glass, its frame and strip in it; its foot a stop: six squares and more of its canopy over
  // the car's south and east sides at its roof (2.7 to 3.05 m), each within 2 m of the shaft's face, lit strips under it
  const shaft99 = remap99(G99.lift.shaft.mat);
  const clear99 = /^Cristal03/.test(shaft99.get("Cristal04") ?? "") && shaft99.get("BareSteelScratched00") === shaft99.get("Cristal04") && shaft99.get("MetalBare01_lgt 2") === shaft99.get("Cristal04");
  const [lx99, lz99] = G99.lift.car;
  const hf99 = G99.lift.shaft.half;
  const stop99 = (GC99.stop ?? []).filter(([x, z, top]) => top >= 2.7 && top <= 3.05 && (Math.abs(x - lx99) > hf99 || Math.abs(z - lz99) > hf99) && Math.abs(x - lx99) < hf99 + 2 && Math.abs(z - lz99) < hf99 + 2);
  const south99 = stop99.filter(([, z]) => z > lz99 + hf99).length, east99 = stop99.filter(([x]) => x > lx99 + hf99).length;
  const stopStrips99 = GP99.filter((q) => String(q[0]).endsWith(`/${G99.light.strip}`) && Number(q[2]) > 2.4 && Number(q[2]) < 3.05 && Math.abs(Number(q[1]) - lx99) < hf99 + 2 && Math.abs(Number(q[3]) - lz99) < hf99 + 2).length;
  part99(clear99 && stop99.length >= 6 && south99 >= 3 && east99 >= 3 && stopStrips99 >= 2, `the shaft ${clear99 ? "one clear glass" : [...shaft99.values()].join(", ")}; its stop ${stop99.length} squares (${south99} south, ${east99} east), ${stopStrips99} strips under`);
  // (3) the tower's chevrons in its white: its Light03 worn the look's white, no glow tint of the pack light
  const tower99 = G99.buildings.find((b) => b[0] === "StreetBuilding00_10x10.prefab");
  const chev99 = remap99(tower99?.[4]).get("Light03") ?? "";
  part99(chev99 === G99.look.white, `the tower's chevrons ${chev99 || "as the pack's"}`);
  check("GLASS HEIGHTS at street level, for real (Milestone 1099): shops cut into its blocks' lower panes, glazed and recessed behind white jambs, lit and furnished rooms behind the glass, canopies with lit strips; its lift's shaft one clear glass and its foot a sheltered stop; the tower's chevrons white", ok99, said99.join("; "));
}

console.log(fails ? `\n${fails} FAILED` : "\nall passed");
process.exit(fails ? 1 : 0);
