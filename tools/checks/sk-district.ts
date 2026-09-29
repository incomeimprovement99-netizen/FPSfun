// The districts made of the packs' own demo scenes, played (Phase 25; src/config/citydistricts.json, city.ts, the
// collision tools/import-city.ts districtSolids measures off the scene's triangles). The owner, 2026-09-28: "continue
// with the one district with the exact assets til it's playable so I can test it". Run with the real movement over the
// real city: into each canyon from the city's own street and along it to the crossroads; every pad up onto its walkway;
// every fire escape it asks for built; and nowhere behind the film set's faces, where there is nothing but its backs to
// see through. Then the bots' graph through it, and its loot.
//
// Run: GAME=speedkills npx tsx tools/checks/sk-district.ts
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
const { GAME } = await import("../../src/game/game");
const { buildCityMap, FIRE_ESCAPES } = await import("../../src/game/city");
const { Player } = await import("../../src/game/player");
const { BR_X, BR_Z } = await import("../../src/game/br");
const { RANGE_SOLIDS } = await import("../../src/game/range");
const { DISTRICT_SOLIDS, DISTRICT_INSIDES } = await import("../../src/game/districtsolids");
const DISTRICTS = (await import("../../src/config/citydistricts.json")).default;
const map = buildCityMap(new THREE.Scene());
console.warn = warn;
if (!hadDocument) delete g.document;

type Action = import("../../src/game/input").Action;
let fails = 0;
function check(label: string, cond: boolean, detail = ""): void {
  if (!cond) fails++;
  console.log(`${cond ? "  ok  " : "FAIL  "}${label}${detail ? ` (${detail})` : ""}`);
}
class Script {
  down = new Set<Action>();
  taps = new Set<Action>();
  held = (a: Action): boolean => this.down.has(a) || this.taps.has(a);
  pressedNow = (a: Action): boolean => this.taps.has(a);
}
const DT = 1 / 144;
const yawTo = (dx: number, dz: number): number => (Math.atan2(-dx, -dz) * 180) / Math.PI;
const body = () => {
  const p = new Player({ minX: BR_X - 400, maxX: BR_X + 400, minZ: BR_Z - 400, maxZ: BR_Z + 400 });
  p.extraMoves = true;
  p.autoClimb = true;
  p.sprintMode = "auto";
  return p;
};
/** a sprint (SpeedKills always sprints) from `from` toward `to` (map-local), standing at height y: where it ended, its highest and lowest */
function walk(from: [number, number], y: number, to: [number, number], seconds: number): { x: number; y: number; z: number; low: number; high: number; gone: number } {
  const p = body();
  const [fx, fz] = [from[0] + BR_X, from[1] + BR_Z];
  const [tx, tz] = [to[0] + BR_X, to[1] + BR_Z];
  p.teleport(fx, y, fz, yawTo(tx - fx, tz - fz));
  const s = new Script();
  s.down.add("forward");
  let t = 1000;
  let low = Infinity;
  let high = -Infinity;
  const len = Math.hypot(tx - fx, tz - fz);
  for (let i = 0; i < seconds / DT; i++) {
    t += DT;
    p.update(DT, t, s, 0, 1, false);
    low = Math.min(low, p.pos.y);
    high = Math.max(high, p.pos.y);
    if ((p.pos.x - fx) * (tx - fx) + (p.pos.z - fz) * (tz - fz) >= len * len) break;
  }
  return { x: p.pos.x - BR_X, y: p.pos.y, z: p.pos.z - BR_Z, low, high, gone: Math.hypot(p.pos.x - fx, p.pos.z - fz) };
}
const inPoly = (poly: number[][], x: number, z: number): boolean => {
  let n = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i];
    const [xj, zj] = poly[j];
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) n = !n;
  }
  return n;
};

console.log(`\nThe packs' demo districts, played (game: ${GAME})`);
check("this runs with SpeedKills' movement", GAME === "speedkills");
for (const d of DISTRICTS.districts) {
  const boxes = DISTRICT_SOLIDS[d.id] ?? [];
  const F = d.fill;
  console.log(`\n${d.id}`);
  check("its collision is measured and in the city's", boxes.length > 1000 && boxes.every(([x0, x1, z0, z1, y0, y1]) => RANGE_SOLIDS.some((s) => Math.abs(s.minX - (x0 + BR_X)) < 1e-6 && Math.abs(s.maxZ - (z1 + BR_Z)) < 1e-6 && Math.abs(s.top - y1) < 1e-6 && Math.abs(s.base - y0) < 1e-6 && Math.abs(s.maxX - (x1 + BR_X)) < 1e-6 && Math.abs(s.minZ - (z0 + BR_Z)) < 1e-6)), `${boxes.length} boxes`);

  // Behind the faces: every half metre of its plan inside the map is its canyons' street, a walkway (solid under it, to
  // stand on), or solid at a body's height: the film set's backs are never a place to stand.
  {
    const open: string[] = [];
    let cells = 0;
    const onStreet = (x: number, z: number) => F.streets.some(([x0, x1, z0, z1]) => x >= x0 && x <= x1 && z >= z0 && z <= z1);
    for (let x = 0.25; x < F.half; x += 0.5)
      for (let z = 0.25; z < F.half; z += 0.5) {
        if (!inPoly(d.hole, x, z) || onStreet(x, z)) continue;
        cells++;
        const here = boxes.filter(([x0, x1, z0, z1]) => x > x0 && x < x1 && z > z0 && z < z1);
        if (!here.some(([, , , , y0, y1]) => y0 < 0.35 && y1 > 1.9) && !here.some(([, , , , y0, y1]) => y0 < 0.35 && y1 >= F.walkway[0])) open.push(`${x},${z}`);
      }
    check("behind its faces, nowhere to stand at the street: every cell off its canyons is solid or a walkway", open.length === 0, `${cells} cells, ${open.length} open${open.length ? `: ${open.slice(0, 6).join(" ")}` : ""}`);
  }

  // Its canyons: from the city's streets at an arm's end, in and along to the crossroads, on the street, and on along
  // the arms that run out to the map's edge
  {
    const [cx, , cz] = d.at;
    const runs: Array<{ name: string; from: [number, number]; to: [number, number] }> = [
      { name: "the north arm from the city's street to the crossroads", from: [cx, 40], to: [cx, cz] },
      { name: "the west arm from the city's street to the crossroads", from: [40, cz], to: [cx, cz] },
      { name: "the crossroads down the south arm to the map's edge", from: [cx, cz], to: [cx, F.half - 3] },
      { name: "the crossroads along the east arm to the map's edge", from: [cx, cz], to: [F.half - 3, cz] },
    ];
    for (const r of runs) {
      const w = walk(r.from, 0, r.to, 30);
      const len = Math.hypot(r.to[0] - r.from[0], r.to[1] - r.from[1]);
      check(r.name, Math.hypot(w.x - r.to[0], w.z - r.to[1]) < 1 && w.high < 1, `${w.gone.toFixed(1)} of ${len.toFixed(1)} m, highest ${w.high.toFixed(2)} m`);
    }
  }

  // Its pads: each one throws you from the canyon's floor onto its walkway, and you stay there
  {
    const mine = map.pads.filter((p) => p.up !== undefined && p.hold === undefined && inPoly(d.hole, p.x - BR_X, p.z - BR_Z));
    check("a pad a spot (citydistricts.json pads), each found its walkway's front", mine.length === d.pads.length, `${mine.length} of ${d.pads.length}`);
    for (const pad of mine) {
      const p = body();
      p.teleport(pad.x, pad.y ?? 0, pad.z, yawTo(pad.dx, pad.dz));
      const s = new Script();
      let t = 1000;
      for (let i = 0; i < 20; i++) p.update(DT, (t += DT), s, 0, 1, false);
      p.impulse(0, pad.up ?? 0, 0);
      let carry = true;
      for (let i = 0; i < 4 / DT; i++) {
        t += DT;
        p.update(DT, t, s, 0, 1, false);
        if (carry && p.pos.y >= (pad.over ?? 0)) {
          p.vel.x = pad.dx;
          p.vel.z = pad.dz;
          carry = false;
        }
      }
      const [x, z] = [(pad.x - BR_X).toFixed(1), (pad.z - BR_Z).toFixed(1)];
      const landed = { x: p.pos.x - BR_X, y: p.pos.y, z: p.pos.z - BR_Z };
      check(`the pad at ${x}, ${z} lands you on its walkway, short of its rail, and you stay`, p.onGround && landed.y >= F.walkway[0] && landed.y <= F.walkway[1] - 0.5, `on ${landed.y.toFixed(2)} m at ${landed.x.toFixed(1)}, ${landed.z.toFixed(1)}`);
      // and from there into the building: a sprint away from the canyon for 3 s gets no deeper than the walkway and
      // stays up on it, never down behind the face
      const len = Math.hypot(pad.dx, pad.dz);
      const [ux, uz] = [pad.dx / len, pad.dz / len];
      // (three lines a metre apart: the walkways' rail is posts 2 m apart, and one line may meet a post first)
      const tries = [-1, 0, 1].map((o) => {
        const from: [number, number] = [landed.x - uz * o, landed.z + ux * o];
        const w = walk(from, landed.y, [from[0] + ux * 40, from[1] + uz * 40], 3);
        return { deep: (w.x - from[0]) * ux + (w.z - from[1]) * uz, low: w.low };
      });
      const deep = Math.max(...tries.map((t) => t.deep));
      const low = Math.min(...tries.map((t) => t.low));
      check(`  and off it, into the building, its face stops you`, deep < 12 && low > landed.y - 1.5, `${tries.map((t) => t.deep.toFixed(1)).join(", ")} m in, lowest ${low.toFixed(2)} m`);
    }
  }

  // Its fire escapes (citydistricts.json escapes): each one it asks for is built (none turned down by the city's rules),
  // from its canyon's street up to a walkway; tools/checks/sk-escapes.ts climbs every one
  {
    const mine = FIRE_ESCAPES.filter((e) => inPoly(d.hole, (e.box.minX + e.box.maxX) / 2 - BR_X, (e.box.minZ + e.box.maxZ) / 2 - BR_Z));
    check(
      "a fire escape a spot (citydistricts.json escapes), each from the street up to a walkway",
      mine.length === d.escapes.length && mine.every((e) => Math.abs(e.outside.y) < 0.3 && e.roof >= F.walkway[0] && e.roof <= F.walkway[1]),
      `${mine.length} of ${d.escapes.length}${mine.length ? `: ${mine.map((e) => `${e.family} at ${((e.box.minX + e.box.maxX) / 2 - BR_X).toFixed(0)}, ${((e.box.minZ + e.box.maxZ) / 2 - BR_Z).toFixed(0)} to ${e.roof.toFixed(2)} m`).join("; ")}` : ""}`,
    );
  }
}

// The bots (citydistricts.json bots, city.ts): the district on their graph, its canyons reached from the city's streets
// and its walkways by its pads, one way up, every node of it
{
  type N = { x: number; z: number; y?: number; links: number[]; pad?: { to: number } };
  const nodes = map.nodes as N[];
  const reach = new Set<number>([0]);
  const queue = [0];
  for (let q = 0; q < queue.length; q++) {
    const n = nodes[queue[q]];
    for (const j of [...n.links, ...(n.pad ? [n.pad.to] : [])])
      if (!reach.has(j)) {
        reach.add(j);
        queue.push(j);
      }
  }
  for (const d of DISTRICTS.districts) {
    const mine = nodes.map((n, i) => ({ n, i })).filter(({ n }) => inPoly(d.hole, n.x - BR_X, n.z - BR_Z));
    const low = mine.filter(({ n }) => (n.y ?? 0) < 1);
    const up = mine.filter(({ n }) => (n.y ?? 0) >= d.fill.walkway[0]);
    const lost = mine.filter(({ i }) => !reach.has(i));
    const pads = mine.filter(({ n }) => n.pad);
    check(
      `${d.id}: on the bots' graph, its canyons from the city's streets and its walkways by its ${d.pads.length} pads, every node reached`,
      low.length >= 20 && up.length >= d.pads.length * 4 && pads.length === d.pads.length && lost.length === 0,
      `${low.length} in its canyons, ${up.length} on its walkways, ${pads.length} pads, ${lost.length} not reached${lost.length ? `: ${lost.slice(0, 10).map(({ n }) => `${(n.x - BR_X).toFixed(0)},${(n.y ?? 0).toFixed(1)},${(n.z - BR_Z).toFixed(0)}(${n.links.length})`).join(" ")}` : ""}`,
    );
  }
}

// From above: a glide or a jump onto the corner lands only on what is drawn. The owner, 2026-09-28: "i was able to
// glitch into the corner map area"; its buildings were filled solid to 40 m whatever stood there, an invisible floor
// over every lower building and empty lot. A body dropped from 120 m on a 1 m grid over the whole corner lands on the
// highest box under it; that top must be the street, a walkway, a roof drawn over a hollow (covers and caps) or over the
// film set's backs closed (backs), or the scene's own triangles there (its file, read here when the bought files are,
// as they are where this runs)
{
  const { existsSync } = await import("node:fs");
  const cfgV = DISTRICTS.version;
  for (const d of DISTRICTS.districts) {
    const file = `public/models/paid/city/${d.id}-v${cfgV}.glb`;
    if (!existsSync(file)) {
      console.log(`  --  ${d.id}: its file is not here, the landings not judged (${file})`);
      continue;
    }
    const { kitIO } = await import("../kit-glb");
    const doc = await kitIO().read(file);
    // every triangle's height span, by the 1 m cells its footprint covers (map-local)
    const spans = new Map<string, number[]>();
    for (const mesh of doc.getRoot().listMeshes())
      for (const prim of mesh.listPrimitives()) {
        const pos = prim.getAttribute("POSITION")!.getArray()!;
        const idx = prim.getIndices()?.getArray();
        const n = idx ? idx.length : pos.length / 3;
        for (let t = 0; t + 2 < n; t += 3) {
          const v = [0, 1, 2].map((q) => (idx ? idx[t + q] : t + q) * 3);
          const xs = v.map((o) => pos[o]), ys = v.map((o) => pos[o + 1]), zs = v.map((o) => pos[o + 2]);
          const y0 = Math.min(...ys), y1 = Math.max(...ys);
          for (let x = Math.floor(Math.min(...xs)); x <= Math.floor(Math.max(...xs)); x++)
            for (let z = Math.floor(Math.min(...zs)); z <= Math.floor(Math.max(...zs)); z++) {
              const k = `${x},${z}`;
              (spans.get(k) ?? spans.set(k, []).get(k)!).push(y0, y1);
            }
        }
      }
    const drawnAt = (x: number, z: number, y: number): boolean => {
      for (let dx = -1; dx <= 1; dx++)
        for (let dz = -1; dz <= 1; dz++) {
          const list = spans.get(`${Math.floor(x) + dx},${Math.floor(z) + dz}`) ?? [];
          for (let i = 0; i < list.length; i += 2) if (y >= list[i] - 0.4 && y <= list[i + 1] + 0.4) return true;
        }
      return false;
    };
    const boxes = DISTRICT_SOLIDS[d.id] ?? [];
    const ins = DISTRICT_INSIDES[d.id] ?? { covers: [], caps: [], backs: [] };
    const roofAt = (x: number, z: number, y: number) => [...ins.covers, ...ins.caps, ...ins.backs].some(([x0, x1, z0, z1, top]) => x >= x0 && x <= x1 && z >= z0 && z <= z1 && Math.abs(top - y) < 0.1);
    let n = 0, street = 0, walk = 0, roof = 0, geometry = 0, inside = 0;
    const bad: string[] = [];
    for (let x = 0.75; x < d.fill.half - 3; x += 1)
      for (let z = 0.75; z < d.fill.half - 3; z += 1) {
        if (!inPoly(d.hole, x, z)) continue;
        const here = boxes.filter(([x0, x1, z0, z1]) => x > x0 && x < x1 && z > z0 && z < z1);
        if (here.some(([, , , , y0, y1]) => y0 < 120 && y1 > 120)) {
          inside++;
          continue;
        }
        n++;
        const y = Math.max(0, ...here.filter(([, , , , , y1]) => y1 < 120).map(([, , , , , y1]) => y1));
        if (y < 0.05) street++;
        else if (y >= d.fill.walkway[0] && y <= d.fill.walkway[1] && drawnAt(x, z, y)) walk++;
        else if (roofAt(x, z, y)) roof++;
        else if (drawnAt(x, z, y)) geometry++;
        else bad.push(`${x},${y.toFixed(1)},${z}`);
      }
    check(
      `${d.id}: dropped onto from 120 m anywhere, a body lands only on what is drawn: the street, a walkway, a roof over a hollow or a back, the scene's own triangles`,
      n > 1000 && bad.length === 0,
      `${n} drops: ${street} street, ${walk} walkway, ${roof} roofs drawn over hollows and backs, ${geometry} on the scene's own; ${inside} over its open ground, solid far above; ${bad.length} on nothing drawn${bad.length ? `: ${bad.slice(0, 6).join(" ")}` : ""}`,
    );
  }
}

// Beside anywhere you stand, nothing undrawn: the scene's open ground, solid to fill.open and not drawn (Milestone 315),
// must not meet the city's street or pavement round the district, its canyons' floor or its walkways, or it is an
// invisible wall where the street seems to go on (Phase 26.4: four lots at its arms' ends were). Every half metre from
// 6 m outside its plan in, where the highest thing is the street, a pavement or a walkway, and the half metres beside it
{
  for (const d of DISTRICTS.districts) {
    const open = (DISTRICT_SOLIDS[d.id] ?? []).filter(([, , , , y0, y1]) => y0 < 1 && y1 >= d.fill.open - 1);
    const xs = d.hole.map(([x]) => x);
    const zs = d.hole.map(([, z]) => z);
    const lim = d.fill.half;
    const inOpen = (x: number, z: number) => open.some(([x0, x1, z0, z1]) => x > x0 && x < x1 && z > z0 && z < z1);
    const topAt = (x: number, z: number): number => {
      let t = 0;
      for (const s of RANGE_SOLIDS) if (s.base < 1 && x + BR_X > s.minX && x + BR_X < s.maxX && z + BR_Z > s.minZ && z + BR_Z < s.maxZ && s.top > t) t = s.top;
      return t;
    };
    const walls: string[] = [];
    let cells = 0;
    for (let x = Math.min(...xs) - 6 + 0.25; x < Math.min(Math.max(...xs) + 6, lim); x += 0.5)
      for (let z = Math.min(...zs) - 6 + 0.25; z < Math.min(Math.max(...zs) + 6, lim); z += 0.5) {
        if (inOpen(x, z)) continue;
        const t = topAt(x, z);
        if (!(t < 0.6 || (t >= d.fill.walkway[0] && t <= d.fill.walkway[1]))) continue;
        cells++;
        if ([[0.5, 0], [-0.5, 0], [0, 0.5], [0, -0.5]].some(([dx, dz]) => inOpen(x + dx, z + dz))) walls.push(`${x},${t.toFixed(1)},${z}`);
      }
    check(
      `${d.id}: nothing undrawn beside anywhere you stand, the city's street round it, its canyons, its walkways`,
      cells > 1000 && walls.length === 0,
      `${cells} half metres stood on, ${walls.length} beside the undrawn open ground${walls.length ? `: ${walls.filter((_, i) => i % Math.max(1, Math.floor(walls.length / 8)) === 0).slice(0, 8).join(" ")}` : ""}`,
    );
  }
}

// Their loot (loot.json districts, loot.ts): spots of their own on the canyons' floor and the walkways, drawn last on a
// stream of their own, so the rest of the field is the same item for item with them and without them
{
  const { LootField } = await import("../../src/game/loot");
  const lootCfg = (await import("../../src/config/loot.json")).default;
  const bounds = { minX: BR_X - 250, maxX: BR_X + 250, minZ: BR_Z - 250, maxZ: BR_Z + 250 };
  const places = map.pois.map((p: { x: number; z: number }) => ({ x: p.x, z: p.z, radius: 30 }));
  const field = new LootField(null);
  const run = (seed: number) => {
    field.generate(seed, places, bounds);
    return [...field.drops.values()].map((d) => ({ at: d.pos.clone(), key: `${d.item.kind}:${d.item.id}@${d.pos.x.toFixed(2)},${d.pos.y.toFixed(2)},${d.pos.z.toFixed(2)}` }));
  };
  const seeds = [7, 42, 1234];
  const per = lootCfg.districts.perDistrict;
  const withThem = seeds.map(run);
  lootCfg.districts.perDistrict = 0;
  const without = seeds.map(run);
  lootCfg.districts.perDistrict = per;
  for (const d of DISTRICTS.districts) {
    const mine = (items: Array<{ at: THREE.Vector3; key: string }>) => items.filter((i) => inPoly(d.hole, i.at.x - BR_X, i.at.z - BR_Z));
    const extra = withThem.map((items, s) => mine(items).filter((i) => !without[s].some((o) => o.key === i.key)));
    const standing = (y: number) => Math.abs(y) < 0.1 || (y >= d.fill.walkway[0] && y <= d.fill.walkway[1] + 0.1);
    const upWant = Math.round(per * lootCfg.districts.walkways);
    check(
      `${d.id}: loot of its own on its canyons' floor and its walkways, ${per} spots and more a match, ${upWant} of them up on the walkways`,
      extra.every((items) => items.length >= per && items.every((i) => standing(i.at.y)) && new Set(items.filter((i) => i.at.y > 1).map((i) => `${Math.round(i.at.x)},${Math.round(i.at.z)}`)).size >= upWant - 1),
      extra.map((items, s) => `seed ${seeds[s]}: ${items.length} (${items.filter((i) => i.at.y > 1).length} up on the walkways)`).join(", "),
    );
  }
  check(
    "and the rest of the field is the same item for item with the districts' loot and without it",
    withThem.every((items, s) => {
      const keys = new Set(without[s].map((o) => o.key));
      return without[s].every((o) => items.some((i) => i.key === o.key)) && items.filter((i) => !keys.has(i.key)).length === items.length - without[s].length;
    }),
  );
}

console.log(fails ? `\n${fails} FAILED` : "\nall passed");
process.exit(fails ? 1 : 0);
