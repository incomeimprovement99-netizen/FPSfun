// The Neon City map (Phase 28, src/game/neonmap.ts, src/config/neonmap.json): built headless as the game builds it, off
// the collision the bake measured (src/config/neon/neonmap.solids.json). Its nine places each with their drops on the
// street; the street one network the bots walk; the collision the bake wrote, all of it; the tallest building's top
// where the ship passes; and every jump pad the bake found, ridden by a player's own movement as a match throws it
// (brplay.ts: straight up, carried across once above its roof's edge), onto its roof, its landing joined to the roof's
// graph wherever a bot is sent up it.
//
// Run on its own: GAME=speedkills npx tsx tools/checks/sk-neon.ts (npm run verify runs it).
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
const { buildNeonMap } = await import("../../src/game/neonmap");
const { Player } = await import("../../src/game/player");
const { BR_X, BR_Z, BR_HALF } = await import("../../src/game/br");
const { SPIRE_TOP } = await import("../../src/game/city");
const { LootField } = await import("../../src/game/loot");
const brmapCfg = (await import("../../src/config/brmap.json")).default;
const { RANGE_SOLIDS } = await import("../../src/game/range");
const { solidsIn } = await import("../../src/game/solidgrid");
const { floorAt } = await import("../../src/game/floors");
const { MOVE } = await import("../../src/game/movement");
const { streets: curvedStreets, StreetField } = await import("../neon-streets");
const cfg = (await import("../../src/config/neonmap.json")).default;
const SOLIDS = (await import("../../src/config/neon/neonmap.solids.json")).default;
const firstSolid = RANGE_SOLIDS.length;
const map = buildNeonMap(new THREE.Scene());
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
check("the street a network of at least 700 nodes", street.length >= 700, `${street.length}`);
check("the street one network: every street node reaches the rest", seen.size === street.length, `${seen.size} of ${street.length}`);

// the collision the bake wrote, all of it; the tallest building's top where the ship passes
// (and the street's slab over each of the court's halls and over the station, its tunnel and its concourse)
const slabs = cfg.court.halls.length + cfg.underground.slabs.length;
check("the collision the bake measured, every box, and the street's slab over each hall and the station", RANGE_SOLIDS.length - firstSolid === SOLIDS.solids.length + slabs && SOLIDS.solids.length === cfg.baked.boxes, `${RANGE_SOLIDS.length - firstSolid} of ${SOLIDS.solids.length} + ${slabs}, bake ${cfg.baked.boxes}`);
check("the ship passes the tallest building's top", Math.abs(SPIRE_TOP.y - cfg.tallest.top) < 1e-6 && SPIRE_TOP.y > 100, `${SPIRE_TOP.y}`);

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
const SPINE = (cfg as unknown as { spine: { up: Array<{ id: string; face: number[]; out: number[]; pad: number[]; floor: number; roof: number; land: number; ground: number }>; down: Array<{ id: string; pad: number[]; floor: number; land: number[]; landY: number }> } }).spine;
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
check("a jump pad onto each side of the four high city blocks, and the centre's", cfg.pads.length === 8 && map.pads.length === cfg.pads.length + SPINE.up.length + SPINE.down.length, `${cfg.pads.length} and ${map.pads.length - cfg.pads.length}`);
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
check("the centre's pads: each up from the plaza onto the base's roof, and from there onto the top, lands you past its face", ups.length >= 5 && ups.every((u) => u.ok), ups.map((u) => u.said).join("; "));
const downs = SPINE.down.map((q, k) => {
  const { p } = ride(map.pads[cfg.pads.length + SPINE.up.length + k]);
  const off = Math.hypot(p.pos.x - BR_X - q.land[0], p.pos.z - BR_Z - q.land[1]);
  return { ok: p.onGround && Math.abs(p.pos.y - q.landY) < 0.3 && off < 1.5, said: `${q.id} from ${q.floor} m to ${p.pos.y.toFixed(2)} m, ${off.toFixed(1)} m off its mark` };
});
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
  check("a beam of light over each corner block in its own colour", placed.length === 4 && lit.every((q) => q.mat && q.mat === q.want) && new Set(lit.map((q) => q.mat)).size === 4, lit.map((q) => `${q.name} ${q.mat ?? "none"}`).join(", "));
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
  const MK = (cfg.rules.low as unknown as { market?: Array<{ count: number; pieces: string[]; extras: unknown[] }> }).market ?? [];
  const CR = (cfg as unknown as { crates?: Array<{ at: number[] }> }).crates ?? [];
  const sw = (cfg.chunks as Record<string, { place: unknown[][] }>)["c-sw"]?.place ?? [];
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
  const zipRide = (from: number[], to: number[]) => {
    const p = new Player({ minX: BR_X - 400, maxX: BR_X + 400, minZ: BR_Z - 400, maxZ: BR_Z + 400 });
    const [dx, dz] = [to[0] - from[0], to[2] - from[2]];
    const l = Math.hypot(dx, dz);
    // (0.6 m along it from its end, on what is under there)
    const [sx, sz] = [from[0] + (dx / l) * 0.6, from[2] + (dz / l) * 0.6];
    p.teleport(sx + BR_X, from[1] - 2.3, sz + BR_Z, (Math.atan2(-dx, -dz) * 180) / Math.PI);
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
  const rides = ZS.map((q) => ({ q, down: zipRide(q.a, q.b), up: zipRide(q.b, q.a) }));
  const ok = (r: { rode: boolean; x: number; y: number; z: number }, end: number[]) => r.rode && Math.hypot(r.x - end[0], r.z - end[2]) < 4 && Math.abs(r.y - (end[1] - 2.35)) < 0.6;
  check("the zip lines: from the roof yards to the High City decks (rules.low.zip.decks), ridden down onto the yard and back up onto the deck, by a player", ZS.length === Object.keys((cfg.rules.low as unknown as { zip?: { decks: object } }).zip?.decks ?? {}).length && ZS.length > 0 && rides.every((r) => ok(r.down, r.q.b) && ok(r.up, r.q.a)), rides.map((r) => `${r.q.block}: down ${r.down.rode ? "rode" : "no grab"} to (${r.down.x.toFixed(1)}, ${r.down.y.toFixed(2)}, ${r.down.z.toFixed(1)}), up ${r.up.rode ? "rode" : "no grab"} to (${r.up.x.toFixed(1)}, ${r.up.y.toFixed(2)}, ${r.up.z.toFixed(1)})`).join("; "));
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
  // (on the road a metre in from its kerb, a metre at a time: a box taller than a car standing across a body's height)
  const onRoad: string[] = [];
  let cells = 0;
  for (let x = -CV.inside + 0.5; x < CV.inside; x += 1)
    for (let z = -CV.inside + 0.5; z < CV.inside; z += 1) {
      if (SF.surface(x, z, CV.round) > -1) continue;
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
  const stops = [
    ...SPN.up.map((q) => ({ id: `${q.id}'s pad`, x: q.pad[0], z: q.pad[1], y: q.floor })),
    ...SPN.up.filter((q) => q.floor === 0).map((q) => ({ id: `${q.id}'s landing`, x: q.face[0] - q.out[0] * q.land, z: q.face[1] - q.out[1] * q.land, y: q.ground })),
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
  const stuck = WN.filter((q) => !outOf(q));
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
  const TW = (cfg as unknown as { tower: { square: number[]; shaft: number[]; core: { box: number[]; storeys: number[]; route: number[][] }; measured: { floors: number[]; seal: Array<{ at: number; rays: number; out: number }> } } }).tower;
  const [cx0, cx1, cz0, cz1] = TW.core.box;
  // (from the lobby a metre and a half out of its west door, through the door's middle)
  const route = [[cx0 - 1.5, (cz0 + cz1) / 2, TW.core.storeys[0]], [cx0 + 0.75, (cz0 + cz1) / 2, TW.core.storeys[0]], ...TW.core.route];
  // (a longer walk than an entrance's: fourteen storeys up a switchback)
  const walk = (pts: number[][]) => {
    const p = new Player({ minX: BR_X - 400, maxX: BR_X + 400, minZ: BR_Z - 400, maxZ: BR_Z + 400 });
    p.teleport(pts[0][0] + BR_X, pts[0][2] + 0.05, pts[0][1] + BR_Z, 0);
    const go = { held: (a: Action) => a === "forward", pressedNow: (_a: Action) => false };
    let t = 1000;
    let k = 1;
    for (let i = 0; i < 240 * 144 && k < pts.length; i++) {
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
      for (const b of here) if (b.minX <= x && b.maxX >= x && b.minZ <= z && b.maxZ >= z && b.top < 50) ys.add(b.top);
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
  // a storey's floor out of the core: what of it a body stands on, what of that it walked to
  const storey = (y: number) => {
    let [of, got] = [0, 0];
    spots.forEach((s, k) => {
      const [x, z] = [X0 + (s.i + 0.5) * C, Z0 + (s.j + 0.5) * C];
      if (Math.abs(s.y - y) > 0.1 || x < sx0 || x > sx1 || z < sz0 || z > sz1 || (x > cx0 - 0.3 && x < cx1 + 0.3 && z > cz0 - 0.3 && z < cz1 + 0.3)) return;
      of++;
      if (seen[k]) got++;
    });
    return { y, of: of * C * C, got: got * C * C };
  };
  const all = TW.core.storeys.map(storey);
  check("the tower: every storey its core serves walked to from the plaza, beyond the core's doors", all.every((q) => q.got > 30), all.map((q) => `${q.y} m ${q.got.toFixed(0)} m2`).join("; "));
  const shaft = all.filter((q) => TW.shaft.includes(q.y));
  check("the tower: its new floors walked over, most of each", shaft.length === TW.shaft.length && shaft.every((q) => q.of > 100 && q.got / q.of > 0.9), shaft.map((q) => `${q.y} m ${((q.got / q.of) * 100).toFixed(0)}% of ${q.of.toFixed(0)} m2`).join("; "));
  // (measured by the bake: a layout run since without a bake leaves none)
  const F = TW.measured?.floors ?? [];
  check("the tower: its new floors each the inside of its shell, the same on every storey", F.length === TW.shaft.length && Math.min(...F) > 300 && Math.max(...F) - Math.min(...F) < 0.05 * Math.max(...F), `${F.join(", ")} m2`);
  const S = (TW.measured?.seal ?? []) as Array<{ at: number; rays: number; out: number; windows?: number }>;
  // (but through its windows, open since the owner asked: a ray out anywhere else is a gap in its shell)
  check("the tower: its new floors not seen through but by their windows, every other ray from each meets a wall", S.length === TW.shaft.length && S.every((q) => q.rays > 500 && q.out === 0 && (q.windows ?? 0) > 0), S.map((q) => `${q.at} m ${q.out} of ${q.rays} out elsewhere, ${q.windows ?? 0} through windows`).join("; "));
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
  for (const f of FI) {
    const on = (x: number, z: number, y: number) => {
      const a = (f.yaw * Math.PI) / 180;
      return [f.at[0] + Math.cos(a) * x + Math.sin(a) * z, f.at[1] - Math.sin(a) * x + Math.cos(a) * z, y];
    };
    const up: number[][] = [on(1.75, 2.5, 0), on(1.75, -1.6, f.roof - f.flights * f.rise + 0.6)];
    for (let n = f.flights - 1; n >= 0; n--) {
      const y = f.roof - n * f.rise;
      up.push(on(1.75, -4.2, y), on(0.5, -4.2, y));
      if (n) up.push(on(0.5, -0.5, y), [...on(1.75, -0.7, y), 0.1]);
    }
    up.push(on(-1.5, -4.2, f.roof));
    const u = climb(up, 1);
    // (the way down at the walking tolerance: lining up on a flight's middle is for the way up)
    const d = climb([...up].reverse().map((q) => q.slice(0, 3)), -1);
    check(`the fire escape on the ${f.block} block's rooms building: climbed from the street onto its roof and back down, by a player`, u.k === up.length && d.k === up.length && Math.abs(u.y - f.roof) < 0.1 && d.y < 0.1, `up ${u.k - 1} of ${up.length - 1} legs, at ${u.y.toFixed(2)} m (${u.x.toFixed(1)}, ${u.z.toFixed(1)}); down ${d.k - 1}, at ${d.y.toFixed(2)} m`);
  }
  check("a fire escape on each rooms building", FI.length === Object.keys(chunks).filter((k) => /^c-[ns][ew]$/.test(k) && blockOf(k) !== wellBlock).length, `${FI.length}`);
  // and its walled yard (rules.low.yard, the layout's yards): on each rooms building's roof, its inside reached from
  // where the fire escape steps over the parapet, a body's square a quarter metre at a time over the collision at the
  // roof's height (a floor there under its middle, nothing over a step in its room)
  const YD = (cfg as unknown as { yards?: Array<{ block: string; inside: number[]; y: number }> }).yards ?? [];
  check("a walled yard on each rooms building's roof", YD.length === FI.length && YD.length > 0, `${YD.length}`);
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
  const C = 0.125;
  const H = MOVE.radius;
  const drop = B.deck - B.roof + 0.1;
  const decks = map.sites.filter((q) => q.id.endsWith("-deck")).map((q) => [q.x - BR_X, q.z - BR_Z]);
  const nearest = (p: number[]) => decks.reduce((best, q) => (Math.hypot(q[0] - p[0], q[1] - p[1]) < Math.hypot(best[0] - p[0], best[1] - p[1]) ? q : best));
  for (const path of B.paths) {
    const past = (p: number[], q: number[], by: number) => { const l = Math.hypot(p[0] - q[0], p[1] - q[1]); return [p[0] + ((p[0] - q[0]) / l) * by, p[1] + ((p[1] - q[1]) / l) * by]; };
    // the foot of each end's stair: a metre and a half past the deck's end, on the roof
    const feet = [past(path[0], path[1], 1.5), past(path.at(-1)!, path.at(-2)!, 1.5)];
    const sites = [nearest(path[0]), nearest(path.at(-1)!)];
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
      if (start !== null && Math.abs(start - B.roof) < 0.1) (seen.set(si * NJ + sj, start), todo.push(si * NJ + sj));
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
      const got = [reached(sites[way], 4), reached(feet[1 - way], 0.5), reached(sites[1 - way], 4)];
      const high = [...seen.values()].filter((y) => Math.abs(y - B.deck) < 0.1).length;
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
      return Math.abs(y - B.deck) < 0.05 ? "" : `ends at ${y.toFixed(2)} m`;
    });
    check(`High City's bridge ${name}: the stair at each end climbed straight up its middle, roof to deck`, climbs.every((c) => c === ""), climbs.map((c, w) => `${w ? "far" : "near"} ${c || "climbed"}`).join(", "));
    // its rails: a look from p toward d (along x or z) at the waist, a box standing across that height within `far`
    const waist = B.deck + 0.5;
    const railed = (p: number[], d: number[], far: number): boolean => {
      const [x0, x1, z0, z1] = [Math.min(p[0], p[0] + d[0] * far) + BR_X, Math.max(p[0], p[0] + d[0] * far) + BR_X, Math.min(p[1], p[1] + d[1] * far) + BR_Z, Math.max(p[1], p[1] + d[1] * far) + BR_Z];
      return solidsIn(x0, x1, z0, z1).some((s) => s.minX <= x1 && s.maxX >= x0 && s.minZ <= z1 && s.maxZ >= z0 && s.base < waist && s.top > waist);
    };
    const open: string[] = [];
    let looks = 0;
    const width = 5;
    for (let i = 0; i + 1 < path.length; i++) {
      const [a, b] = [path[i], path[i + 1]];
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const d = [(b[0] - a[0]) / len, (b[1] - a[1]) / len];
      const side = [-d[1], d[0]];
      // the leg's straights: from its end (or past the corner it left) to the corner it meets (or its end)
      for (let t = (i ? width / 2 : 0) + 0.5; t < len - (i + 2 < path.length ? width / 2 : 0); t += 1)
        for (const sd of [side, [-side[0], -side[1]]]) {
          looks++;
          const p = [a[0] + d[0] * t, a[1] + d[1] * t];
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
    check(`High City's bridge ${name}: railed both sides all its way, and its corner's outer sides`, looks > 100 && open.length === 0, `${looks} looks, ${open.length} open${open.length ? `: ${open.slice(0, 4).join("; ")}` : ""}`);
  }
}

// loot where the fights are, as a match lays it (brmatch.ts): each place's and site's spots on any floor there with a
// head's room, the roofs and rooms among them
const loot = new LootField(null);
loot.generate(
  20260929,
  map.pois.map((p) => ({ x: p.x, z: p.z, id: p.id, radius: p.radius })),
  { minX: BR_X - BR_HALF, maxX: BR_X + BR_HALF, minZ: BR_Z - BR_HALF, maxZ: BR_Z + BR_HALF },
  map.sites.map((s) => ({ x: s.x, z: s.z, id: s.id, radius: s.radius ?? brmapCfg.siteRadius })),
);
const drops = [...loot.drops.values()];
const over12 = drops.filter((d) => d.pos.y > 12).length;
const over24 = drops.filter((d) => d.pos.y > 24).length;
check("loot over the map, 150 items and more", drops.length >= 150, `${drops.length}`);
// (the old city's bar, its e2e's: the eight districts round the centre are plain ground until their own build)
check("loot on the roofs too, 40 items over 12 m and 10 over 24 m", over12 >= 40 && over24 >= 10, `${over12} over 12 m, ${over24} over 24 m, of ${drops.length}`);
// every floor of the tower its core serves over the lobby stocked (src/game/neonmap.ts: each a hall's for the loot)
{
  const TW = (cfg as unknown as { tower: { square: number[]; shaft: number[]; core: { storeys: number[] } } }).tower;
  const [sx0, sx1, sz0, sz1] = TW.square;
  const per = TW.core.storeys.slice(1).map((h) => ({ h, n: drops.filter((d) => Math.abs(d.pos.y - h) < 0.2 && d.pos.x - BR_X > sx0 && d.pos.x - BR_X < sx1 && d.pos.z - BR_Z > sz0 && d.pos.z - BR_Z < sz1).length }));
  check("loot on every floor of the tower over its lobby, 5 items and more each", per.every((q) => q.n >= 5), per.map((q) => `${q.h} m ${q.n}`).join(", "));
}
// each corner block's own loot (game.sites, its `reach`): in its rooms building or the Well, some of it up the fire escape
{
  const corner = map.sites.filter((q) => q.radius !== undefined);
  const each = corner.map((q) => {
    const near = drops.filter((d) => Math.hypot(d.pos.x - q.x, d.pos.z - q.z) <= (q.radius ?? 0) + 1.5);
    return { name: q.name, n: near.length, up: near.filter((d) => d.pos.y > 10).length };
  });
  // (a site lays its four spots, each one item and more: a count over that is the seed's, and moves with the collision)
  check("each corner block's own loot about its name, an item a spot and more (4)", corner.length === 4 && each.every((q) => q.n >= 4), each.map((q) => `${q.name} ${q.n} (${q.up} on the roof)`).join(", "));
}

console.log(fails ? `\n${fails} FAILED` : "\nall passed");
process.exit(fails ? 1 : 0);
