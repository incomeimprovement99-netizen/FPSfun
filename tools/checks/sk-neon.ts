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
check("the collision the bake measured, every box", RANGE_SOLIDS.length - firstSolid === SOLIDS.solids.length && SOLIDS.solids.length === cfg.baked.boxes, `${RANGE_SOLIDS.length - firstSolid} of ${SOLIDS.solids.length}, bake ${cfg.baked.boxes}`);
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
const tiles = cfg.chunks["c-court"].place.filter((q) => q[5] === "g").length;
check("the court round the tallest building: a body dropped in its corners stands on its floor, 7 m down, and it is drawn", K.y < -6 && rests.every((y) => Math.abs(y - K.y) < 0.05) && tiles * 100 >= (K.x1 - K.x0) * (K.z1 - K.z0), `rests at ${rests.join(", ")}; ${tiles} tiles`);

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
