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
// (and the street's slab over each of the court's halls)
check("the collision the bake measured, every box, and a slab over each hall", RANGE_SOLIDS.length - firstSolid === SOLIDS.solids.length + cfg.court.halls.length && SOLIDS.solids.length === cfg.baked.boxes, `${RANGE_SOLIDS.length - firstSolid} of ${SOLIDS.solids.length} + ${cfg.court.halls.length}, bake ${cfg.baked.boxes}`);
check("the ship passes the tallest building's top", Math.abs(SPIRE_TOP.y - cfg.tallest.top) < 1e-6 && SPIRE_TOP.y > 100, `${SPIRE_TOP.y}`);

// the court the tallest building stands in: a body dropped in its corners stands on its drawn floor, 7 m down, not on
// the street's height over nothing (the hole showed the sky through the world before it was floored)
const K = cfg.court;
const rests = [
  [K.x0 + 1, K.z0 + 1],
  [K.x1 - 1, K.z0 + 1],
  [K.x0 + 1, K.z1 - 1],
  [K.x1 - 1, K.z1 - 1],
].map(([x, z]) => {
  const p = new Player({ minX: BR_X - 400, maxX: BR_X + 400, minZ: BR_Z - 400, maxZ: BR_Z + 400 });
  p.teleport(x + BR_X, 3, z + BR_Z, 0);
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
for (const h of K.halls.filter((q) => !("route" in q))) {
  // from 3 m inside the court's edge, straight down the hall's middle line
  const alongX = h.z1 - h.z0 < h.x1 - h.x0;
  const [mx, mz] = [(h.x0 + h.x1) / 2, (h.z0 + h.z1) / 2];
  const out = alongX ? Math.sign(mx) : Math.sign(mz);
  const [fx, fz] = alongX ? [out > 0 ? K.x1 - 3 : K.x0 + 3, mz] : [mx, out > 0 ? K.z1 - 3 : K.z0 + 3];
  const yaw = alongX ? (out > 0 ? -90 : 90) : out > 0 ? 180 : 0;
  const r = sprint(fx, fz, K.y + 0.05, yaw, 3);
  const far = alongX ? (out > 0 ? h.x1 : h.x0) : out > 0 ? h.z1 : h.z0;
  const gone = Math.abs((alongX ? r.x : r.z) - far);
  // (the plaza over its corridor: an entrance's well beyond is open to the street)
  const [sx0, sx1, sz0, sz1] = h.slab;
  const over = sprint((sx0 + sx1) / 2, (sz0 + sz1) / 2, 0.05, yaw, 0.5);
  check(`hall at (${mx.toFixed(0)}, ${mz.toFixed(0)}): walked from the court to its far wall on the court's floor, and the plaza over it holds a body`, gone < 1.2 && Math.abs(r.y - K.y) < 0.05 && r.low > K.y - 0.05 && Math.abs(over.y) < 0.05, `ended ${gone.toFixed(2)} m from its end at ${r.y.toFixed(2)} m; on the plaza over it ${over.y.toFixed(2)} m`);
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

// every pad the bake found, ridden: a player stood on it thrown straight up, carried across once above `over`
check("a jump pad onto each side of the four high city blocks", map.pads.length === cfg.pads.length && map.pads.length === 8, `${map.pads.length}`);
for (const [k, pad] of map.pads.entries()) {
  const q = cfg.pads[k];
  const p = new Player({ minX: BR_X - 400, maxX: BR_X + 400, minZ: BR_Z - 400, maxZ: BR_Z + 400 });
  p.teleport(pad.x, pad.y ?? 0, pad.z, 0);
  const DT = 1 / 144;
  let t = 1000;
  for (let i = 0; i < 20; i++) p.update(DT, (t += DT), idle, 0, 1, false);
  p.impulse(0, pad.up ?? 0, 0);
  let carry = true;
  let high = 0;
  for (let i = 0; i < 6 / DT; i++) {
    if (carry && p.pos.y >= (pad.over ?? 0)) {
      p.vel.x = pad.dx;
      p.vel.z = pad.dz;
      carry = false;
    }
    p.update(DT, (t += DT), idle, 0, 1, false);
    high = Math.max(high, p.pos.y);
    if (!carry && p.onGround) break;
  }
  const past = (p.pos.x - BR_X - q.face[0]) * -q.out[0] + (p.pos.z - BR_Z - q.face[1]) * -q.out[1];
  check(`pad ${q.id}: lands you on its ${q.roof} m roof, past the edge`, p.onGround && Math.abs(p.pos.y - q.roof) < 0.3 && past > 1, `at ${p.pos.y.toFixed(2)} m, ${past.toFixed(1)} m in, highest ${high.toFixed(1)}`);
}
const padNodes = map.nodes.filter((n) => n.pad);
const stranded = padNodes.filter((n) => !map.nodes[n.pad!.to].links.length);
check("every pad a bot is sent up lands it on the roof's graph", padNodes.length >= 6 && stranded.length === 0, `${padNodes.length} pads for bots, ${stranded.length} stranded`);

// the small named places: each high city block's deck and the lobby
check("the four high city decks and the lobby as the map's named sites", map.sites.length === cfg.game.sites.list.length, map.sites.map((s) => s.name).join(", "));

// The rooms to fight in (rules.low.rooms): each corner block's realistic building walked into from the street round it
// and up its stairs, on foot, no climbing, an eighth of a metre at a time (at the collision's own quarter a body a door's
// width round was seen not to fit it, sampled only there): every floor with a standing body's room over it is
// a spot, and from a spot a body walks to a neighbour's floor within a step. The body is taken as the square round the
// player's round one, so what it passes a player passes. Its ground floor and the two over it by the stairs (the roof
// over those is a climb)
{
  const [o0, o1] = cfg.rules.blocks.outer;
  const third = (o1 - o0) / 3;
  const C = 0.125;
  const H = MOVE.radius;
  const chunks = cfg.chunks as Record<string, { place: unknown[][] }>;
  const isRooms = (p: unknown[]) => String(p[0]).endsWith(`/${cfg.rules.low.rooms.piece}`);
  const rooms = chunks["c-se"].place.find(isRooms);
  check("the rooms building on each corner block", Object.keys(chunks).filter((k) => /^c-[ns][ew]$/.test(k)).every((k) => chunks[k].place.some(isRooms)), `${rooms?.[0]}`);
  for (const [sx, sz, name] of [[-1, -1, "nw"], [1, -1, "ne"], [-1, 1, "sw"], [1, 1, "se"]] as const) {
    const [mx, mz] = [sx * (o0 + third), sz * (o0 + third)];
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

// loot where the fights are, as a match lays it (brmatch.ts): each place's and site's spots on any floor there with a
// head's room, the roofs and rooms among them
const loot = new LootField(null);
loot.generate(
  20260929,
  map.pois.map((p) => ({ x: p.x, z: p.z, id: p.id, radius: p.radius })),
  { minX: BR_X - BR_HALF, maxX: BR_X + BR_HALF, minZ: BR_Z - BR_HALF, maxZ: BR_Z + BR_HALF },
  map.sites.map((s) => ({ x: s.x, z: s.z, id: s.id, radius: brmapCfg.siteRadius })),
);
const drops = [...loot.drops.values()];
const over12 = drops.filter((d) => d.pos.y > 12).length;
const over24 = drops.filter((d) => d.pos.y > 24).length;
check("loot over the map, 150 items and more", drops.length >= 150, `${drops.length}`);
// (the old city's bar, its e2e's: the eight districts round the centre are plain ground until their own build)
check("loot on the roofs too, 40 items over 12 m and 10 over 24 m", over12 >= 40 && over24 >= 10, `${over12} over 12 m, ${over24} over 24 m, of ${drops.length}`);

console.log(fails ? `\n${fails} FAILED` : "\nall passed");
process.exit(fails ? 1 : 0);
