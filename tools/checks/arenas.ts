// The arenas' list (src/game/arena.ts ARENA_MAPS), checked before anybody plays them.
//
// Every map a match is played on is drawn in the Neon City's file and walked off the bake's own collision by
// tools/checks/sk-neon.ts (NEON YARD, NEON HALL, THE GULAG; THE CENTRE by its own checks). What is held here is the list
// itself, plain node and no browser: which maps there are, THE CENTRE's circle, that every mode has a map, and that no
// two places in the world (the range, the battle royale, the movement lab) stand in each other. The arenas drawn from a
// plan, and the flood that walked them cell by cell with a bot's rules, went with the last of them, the Vault, in
// Milestone 663.
//
// Run on its own: npx tsx tools/checks/arenas.ts.
import { MOVELAB } from "../../src/game/arenas/movelab";
import { boundsOf } from "../../src/game/arenas/plan";
import { ARENA_MAPS, ZONE_RADIUS, mapFor } from "../../src/game/arena";
import { CENTRE_MAP } from "../../src/game/arenas/centre";
import { RANGE_BOUNDS } from "../../src/game/range";
import { BR_BOUNDS } from "../../src/game/br";
import { MODE_KINDS } from "../../src/game/modes";

let fails = 0;
function check(label: string, ok: boolean, detail = ""): void {
  if (!ok) fails++;
  console.log(`${ok ? "  ok  " : "FAIL  "}${label}${detail ? ` (${detail})` : ""}`);
}

console.log("\nThe arenas");

// -------------------------------------------------------------- the maps

// (the legacy game's Warehouse, Triangle, Crossing, Ringworks and NEON BLOCK went in Milestone 533, the Vault in 663)
check(
  "the list holds the Neon City's two arenas (each its own piece of the city's file), THE CENTRE and the Gulag's street (its own piece too, for the Gulag alone)",
  ARENA_MAPS.length === 4 &&
    ARENA_MAPS.slice(0, 2).every((m, i) => m.id === ["yard", "hall"][i] && !!m.city && m.chunk === `a-${m.id}`) && ARENA_MAPS[2].id === "centre" && !!ARENA_MAPS[2].city &&
    ARENA_MAPS[3].id === "gulag" && !!ARENA_MAPS[3].city && ARENA_MAPS[3].chunk === "a-gulag" && ARENA_MAPS[3].bestFor.join() === "gulag",
  ARENA_MAPS.map((m) => m.id).join(", ")
);
// THE CENTRE (arenas/centre.ts): the city's own middle inside a circle. Its spawns, its 1v1 circle and Control's
// points inside that circle (the 1v1's by its own radius), its spawns in opposite pairs, each facing the tower
{
  const c = CENTRE_MAP.bounds.circle!;
  const r = (p: { x: number; z: number }) => Math.hypot(p.x - c.x, p.z - c.z);
  const pairs = CENTRE_MAP.spawns.every((s, i) => i % 2 === 1 || (Math.abs(s.x + CENTRE_MAP.spawns[i + 1].x - 2 * c.x) < 0.5 && Math.abs(s.z + CENTRE_MAP.spawns[i + 1].z - 2 * c.z) < 0.5));
  const facing = CENTRE_MAP.spawns.every((s) => {
    const fx = -Math.sin((s.yaw * Math.PI) / 180);
    const fz = -Math.cos((s.yaw * Math.PI) / 180);
    return (fx * (c.x - s.x) + fz * (c.z - s.z)) / r(s) > 0.99;
  });
  check(
    "THE CENTRE: its spawns, its 1v1 circle and its points inside its circle, the spawns in opposite pairs facing the tower",
    CENTRE_MAP.spawns.length === 8 && CENTRE_MAP.spawns.every((s) => r(s) < c.r - 1) && r(CENTRE_MAP.center) + ZONE_RADIUS < c.r && CENTRE_MAP.zones.every((z) => r(z) < c.r) && pairs && facing &&
      c.x >= CENTRE_MAP.bounds.minX + c.r - 0.01 && c.x <= CENTRE_MAP.bounds.maxX - c.r + 0.01,
    JSON.stringify({ r: c.r, spawns: CENTRE_MAP.spawns.map((s) => +r(s).toFixed(1)), zone: +r(CENTRE_MAP.center).toFixed(1), pairs, facing })
  );
}
check(
  "every map id is its own, and every map names modes that exist",
  new Set(ARENA_MAPS.map((m) => m.id)).size === ARENA_MAPS.length &&
    ARENA_MAPS.every((m) => m.bestFor.every((k) => k === "duel" || k === "gulag" || (MODE_KINDS as string[]).includes(k))),
  ARENA_MAPS.map((m) => `${m.id}: ${m.bestFor.join("/")}`).join(", ")
);
check(
  "every mode has a map picked for it, and a 1v1 and a lobby have one too",
  ["duel", ...MODE_KINDS].every((k) => ARENA_MAPS.some((m) => m.id === mapFor(k, 8))) && Boolean(mapFor("duel", 2)) && Boolean(mapFor("ffa", 8)),
  ["duel", ...MODE_KINDS].map((k) => `${k}: ${mapFor(k, 8)}`).join(", ")
);

// Nowhere may two places in the world sit on top of each other: RANGE_SOLIDS
// is one flat list for the whole game, so two maps that overlap are one map
// with each other's walls in it.
const rects = [
  { id: "range", ...RANGE_BOUNDS },
  { id: "battle royale", ...BR_BOUNDS },
  // SpeedKills' movement lab is no match's map, and still a place in the world
  { id: MOVELAB.id, ...boundsOf(MOVELAB) },
];
let clash = "";
for (let i = 0; i < rects.length; i++) {
  for (let j = i + 1; j < rects.length; j++) {
    const a = rects[i];
    const b = rects[j];
    // two metres of margin, because every map's outer wall stands outside its bounds
    if (a.minX - 2 < b.maxX && a.maxX + 2 > b.minX && a.minZ - 2 < b.maxZ && a.maxZ + 2 > b.minZ) clash = `${a.id} and ${b.id}`;
  }
}
check("no two places in the world stand in each other", !clash, clash || `${rects.length} rectangles, all clear of each other`);

// The sun's shadow camera covers a box 135 m either side of (-10, 12) on the range's side (src/game/range.ts
// setShadowRegion). The lab outside it would be a place with no shadows in it, which reads as a different game.
{
  const b = boundsOf(MOVELAB);
  check("the movement lab stands inside the sun's shadow box", b.minX >= -145 && b.maxX <= 125 && b.minZ >= -123 && b.maxZ <= 147, `x ${b.minX} to ${b.maxX}, z ${b.minZ} to ${b.maxZ}`);
}

export const arenasFails = fails;
if (process.argv[1]?.includes("arenas")) console.log(fails ? `\n${fails} FAILED` : "\narenas PASS");
