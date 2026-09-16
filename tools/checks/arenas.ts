// The arenas, walked before anybody plays them (src/game/arenas/).
//
// A map is the one kind of content in this game that cannot be judged by
// reading it. The rule that breaks an arena is not visible in the numbers:
// bots cannot jump, climb or mantle, so a floor whose only way up is a crate
// is a floor no bot ever stands on, and a room whose only door is 0.7 m wide
// is a room a bot grinds against for the whole match. That has cost this
// project two rounds of debugging already (roadmap milestone 50), so here the
// maps are flooded instead: every arena is walked cell by cell with the bot's
// own rules from src/game/bots.ts, and again with the player's, and the
// answers are checked against what the map claims about itself.
//
// This runs in plain node with no browser. That is why an arena is split in
// two: the geometry is data in src/game/arenas/plan.ts and the meshes and
// materials are built from it in src/game/arenas/build.ts, which is the half
// that needs a canvas. Nothing in this file touches the builder.
//
// Run on its own: npx tsx tools/checks/arenas.ts.
import { MOVE } from "../../src/game/movement";
import { PLAN_MAPS, ARENA_PLANS } from "../../src/game/arenas";
import { allBoxes, boundsOf, solidsOf, type ArenaPlan, type PlanSolid } from "../../src/game/arenas/plan";
import { ARENA_BOUNDS, TRI_BOUNDS, ARENA_MAPS, mapFor } from "../../src/game/arena";
import { RANGE_BOUNDS } from "../../src/game/range";
import { BR_BOUNDS } from "../../src/game/br";
import { MODE_KINDS } from "../../src/game/modes";

let fails = 0;
function check(label: string, ok: boolean, detail = ""): void {
  if (!ok) fails++;
  console.log(`${ok ? "  ok  " : "FAIL  "}${label}${detail ? ` (${detail})` : ""}`);
}

console.log("\nThe arenas");

// The body doing the walking, from src/config/movement.json by way of
// movement.ts, so these can never drift from what the game actually moves.
const R = MOVE.radius;
const STAND = MOVE.standHeight;
const STEP = MOVE.stepHeight;
const MANTLE = MOVE.mantleHeight;
/** the flood's grid; a quarter metre resolves a doorway a body can fit through */
const CELL = 0.25;
const EPS = 1e-4;

// ------------------------------------------------------------- the flood

/**
 * Every place a body can stand in one map, and what can be reached from
 * where. A column of the map can hold more than one floor (the ground and the
 * gallery over it), so a cell is not one node but one node per floor, which
 * is the part the battle royale's flood never needed and these maps do.
 */
interface Field {
  nx: number;
  nz: number;
  x0: number;
  z0: number;
  /** the standable floors in each cell, low to high */
  levels: Float64Array[];
  /** for each floor, the underside of whatever is above it (Infinity: open sky) */
  ceils: Float64Array[];
  cellOf(x: number, z: number): number;
  centre(i: number): { x: number; z: number };
}

function fieldOf(plan: ArenaPlan): Field {
  const solids = solidsOf(plan);
  const b = boundsOf(plan);
  const nx = Math.floor((b.maxX - b.minX) / CELL);
  const nz = Math.floor((b.maxZ - b.minZ) / CELL);
  const x0 = b.minX + CELL / 2;
  const z0 = b.minZ + CELL / 2;
  // solids bucketed by 4 m, so a cell tests a dozen boxes and not two hundred
  const B = 4;
  const bx = Math.ceil((b.maxX - b.minX) / B) + 2;
  const bz = Math.ceil((b.maxZ - b.minZ) / B) + 2;
  const bucket: PlanSolid[][] = Array.from({ length: bx * bz }, () => []);
  const bi = (x: number) => Math.max(0, Math.min(bx - 1, Math.floor((x - b.minX) / B)));
  const bj = (z: number) => Math.max(0, Math.min(bz - 1, Math.floor((z - b.minZ) / B)));
  for (const s of solids) {
    for (let i = bi(s.minX - R); i <= bi(s.maxX + R); i++) for (let j = bj(s.minZ - R); j <= bj(s.maxZ + R); j++) bucket[i * bz + j].push(s);
  }
  const near = (x: number, z: number): PlanSolid[] => bucket[bi(x) * bz + bj(z)];

  const levels: Float64Array[] = new Array(nx * nz);
  const ceils: Float64Array[] = new Array(nx * nz);
  for (let i = 0; i < nx; i++) {
    for (let j = 0; j < nz; j++) {
      const x = x0 + i * CELL;
      const z = z0 + j * CELL;
      const hit = near(x, z).filter((s) => x + R > s.minX && x - R < s.maxX && z + R > s.minZ && z - R < s.maxZ);
      // the floor, then the top of everything the body overlaps
      const tops = [0, ...hit.map((s) => s.top)].sort((a, c) => a - c);
      const ls: number[] = [];
      const cs: number[] = [];
      for (let k = 0; k < tops.length; k++) {
        const t = tops[k];
        if (k > 0 && Math.abs(t - tops[k - 1]) < EPS) continue;
        // standing on t means nothing may cross the body's own height, and
        // nothing may be sitting on t either
        let ceil = Infinity;
        let blocked = false;
        for (const s of hit) {
          if (s.top > t + EPS && s.base < t + STAND - EPS) blocked = true;
          if (s.base >= t - EPS && s.base < ceil) ceil = s.base;
        }
        if (blocked) continue;
        ls.push(t);
        cs.push(ceil);
      }
      levels[i * nz + j] = new Float64Array(ls);
      ceils[i * nz + j] = new Float64Array(cs);
    }
  }
  return {
    nx,
    nz,
    x0,
    z0,
    levels,
    ceils,
    cellOf(x, z) {
      const i = Math.round((x - x0) / CELL);
      const j = Math.round((z - z0) / CELL);
      if (i < 0 || j < 0 || i >= nx || j >= nz) return -1;
      return i * nz + j;
    },
    centre(k) {
      return { x: x0 + Math.floor(k / nz) * CELL, z: z0 + (k % nz) * CELL };
    },
  };
}

/**
 * Walk the map from one spot. `climb` is how high a step up may be: a bot's
 * 0.56 m, or a player's 2.03 m mantle. Coming down is free at any height, as
 * long as there is no floor in the way to fall through, which is what keeps
 * the flood from walking through the underside of a gallery.
 *
 * The player's flood is deliberately generous: it grants a mantle wherever a
 * ledge is in reach, without asking whether the player could face it. It is
 * used to prove that nowhere is sealed off, and being generous there can only
 * make the check quieter, never louder.
 */
function walk(f: Field, from: { x: number; z: number }, climb: number): Uint8Array[] {
  const seen: Uint8Array[] = f.levels.map((l) => new Uint8Array(l.length));
  const start = f.cellOf(from.x, from.z);
  if (start < 0 || !f.levels[start].length) return seen;
  // start on the lowest floor of the spawn's own cell: spawns stand on the ground
  const queue: number[] = [start * 8];
  seen[start][0] = 1;
  while (queue.length) {
    const node = queue.pop() as number;
    const cell = Math.floor(node / 8);
    const li = node % 8;
    const y = f.levels[cell][li];
    const i = Math.floor(cell / f.nz);
    const j = cell % f.nz;
    for (const [di, dj] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const ni = i + di;
      const nj = j + dj;
      if (ni < 0 || nj < 0 || ni >= f.nx || nj >= f.nz) continue;
      const nc = ni * f.nz + nj;
      const ls = f.levels[nc];
      const cs = f.ceils[nc];
      for (let k = 0; k < ls.length && k < 8; k++) {
        if (seen[nc][k]) continue;
        // up is limited by the step or the mantle; down is free, but only
        // into a space that is open from where the body already is
        if (ls[k] > y + climb + EPS) continue;
        if (y > cs[k] - STAND + EPS && ls[k] < y - EPS) continue;
        if (y >= cs[k] - EPS) continue;
        seen[nc][k] = 1;
        queue.push(nc * 8 + k);
      }
    }
  }
  return seen;
}

/** was this spot reached, on any floor, or on the floor nearest `at` */
function reached(f: Field, seen: Uint8Array[], x: number, z: number, at?: number): boolean {
  const c = f.cellOf(x, z);
  if (c < 0) return false;
  const ls = f.levels[c];
  for (let k = 0; k < ls.length; k++) {
    if (!seen[c][k]) continue;
    if (at === undefined || Math.abs(ls[k] - at) < 0.2) return true;
  }
  return false;
}

/** every solid within half a metre of a body standing at (x, z), the reason a spawn is a bad spawn */
function crowding(plan: ArenaPlan, x: number, z: number): number {
  let worst = 0;
  const clear = R + 0.5;
  for (const s of solidsOf(plan)) {
    if (s.base > STAND - EPS || s.top < EPS) continue;
    const dx = Math.max(s.minX - x, 0, x - s.maxX);
    const dz = Math.max(s.minZ - z, 0, z - s.maxZ);
    const d = Math.hypot(dx, dz);
    if (d < clear) worst = Math.max(worst, clear - d);
  }
  return worst;
}

/**
 * Is there anything between these two spots at eye height? A map whose two
 * 1v1 spawns can see each other is a map where the round is decided by who
 * clicked first, which is the whole reason the warehouse grew a building in
 * its middle lane.
 */
function lineBlocked(plan: ArenaPlan, a: { x: number; z: number }, b: { x: number; z: number }, eye = 1.6): boolean {
  const solids = solidsOf(plan);
  const steps = Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / 0.1);
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const x = a.x + (b.x - a.x) * t;
    const z = a.z + (b.z - a.z) * t;
    for (const s of solids) {
      if (x > s.minX && x < s.maxX && z > s.minZ && z < s.maxZ && s.base < eye && s.top > eye) return true;
    }
  }
  return false;
}

/**
 * What the arena costs to draw, before main.ts merges it. Counted from the
 * plan rather than measured in a browser, because the point of counting is to
 * notice a map that has quietly grown a thousand crates.
 */
function meshCount(plan: ArenaPlan): number {
  const boxes = allBoxes(plan);
  let n = boxes.length + boxes.filter((b) => b.cap).length;
  n += 1; // the floor
  n += 3; // the capture circle: ring, disc, column
  n += 2; // a sign on each end wall
  n += plan.zips.length * 3; // a rope and two posts
  if (plan.roof) {
    const z0 = -plan.halfZ - 1;
    const z1 = plan.halfZ + 1;
    let bay = 0;
    let sky = 0;
    for (let z = z0; z < z1 - 1e-3; z += 2.5, bay++) {
      const d = Math.min(2.5, z1 - z);
      if (bay % 4 === 1) {
        sky++;
        continue;
      }
      n += 1 + (d > 1 ? plan.lights.length : 0);
    }
    for (let z = z0 + 1.5; z < z1; z += 2.5) n += 1;
    n += plan.girders.length + (sky ? 1 : 0);
  }
  return n;
}

// -------------------------------------------------------------- the maps

check("three more arenas, so six modes are no longer one map", ARENA_PLANS.length === 3, ARENA_PLANS.map((p) => p.id).join(", "));
check(
  "the menu's list holds the old two as well as the new three",
  ARENA_MAPS.length === 5 && ARENA_MAPS[0].id === "warehouse" && ARENA_MAPS[1].id === "triangle",
  ARENA_MAPS.map((m) => m.id).join(", ")
);
check(
  "every map id is its own, and every map names modes that exist",
  new Set(ARENA_MAPS.map((m) => m.id)).size === ARENA_MAPS.length &&
    ARENA_MAPS.every((m) => m.bestFor.every((k) => k === "duel" || (MODE_KINDS as string[]).includes(k))),
  ARENA_MAPS.map((m) => `${m.id}: ${m.bestFor.join("/")}`).join(", ")
);
check(
  "every mode has a map picked for it, and a 1v1 and a lobby have one too",
  ["duel", ...MODE_KINDS].every((k) => ARENA_MAPS.some((m) => m.id === mapFor(k, 8))) && mapFor("duel", 2) !== "" && mapFor("ffa", 8) !== "",
  ["duel", ...MODE_KINDS].map((k) => `${k}: ${mapFor(k, 8)}`).join(", ")
);

// Nowhere may two places in the world sit on top of each other: RANGE_SOLIDS
// is one flat list for the whole game, so two maps that overlap are one map
// with each other's walls in it.
const rects = [
  { id: "range", ...RANGE_BOUNDS },
  { id: "warehouse", ...ARENA_BOUNDS },
  { id: "triangle", ...TRI_BOUNDS },
  { id: "battle royale", ...BR_BOUNDS },
  ...ARENA_PLANS.map((p) => ({ id: p.id, ...boundsOf(p) })),
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

// The sun's shadow camera covers a box 135 m either side of (-10, 12)
// (src/game/range.ts setShadowRegion). A map outside it is a map with no
// shadows in it, which reads as a different game.
const outside = ARENA_PLANS.filter((p) => {
  const b = boundsOf(p);
  return b.minX < -145 || b.maxX > 125 || b.minZ < -123 || b.maxZ > 147;
});
check("every new arena stands inside the sun's shadow box", outside.length === 0, outside.map((p) => p.id).join(", ") || "all three lit like the range");

for (const info of PLAN_MAPS) {
  const plan = info.plan as ArenaPlan;
  const f = fieldOf(plan);
  const b = boundsOf(plan);
  const name = plan.id;

  // ---- inside its own walls
  const stray = plan.boxes.filter((x) => {
    const y = x.y ?? 0;
    return (
      x.x - x.w / 2 < -plan.halfX - EPS ||
      x.x + x.w / 2 > plan.halfX + EPS ||
      x.z - x.d / 2 < -plan.halfZ - EPS ||
      x.z + x.d / 2 > plan.halfZ + EPS ||
      y + x.h > plan.wallH + EPS
    );
  });
  check(
    `${name}: everything in it fits inside the ${plan.halfX * 2} by ${plan.halfZ * 2} it declares`,
    stray.length === 0,
    stray.length ? stray.map((s) => `${s.mat} at ${s.x},${s.z}`).join("; ") : `${plan.boxes.length} boxes, walls ${plan.wallH} m`
  );

  // ---- the spawns
  const crowded = plan.spawns.filter((s) => crowding(plan, plan.x + s.x, plan.z + s.z) > 0);
  check(
    `${name}: all ${plan.spawns.length} spawns stand more than half a metre clear of anything solid`,
    crowded.length === 0,
    crowded.length ? crowded.map((s) => `${s.x},${s.z} by ${crowding(plan, plan.x + s.x, plan.z + s.z).toFixed(2)} m`).join("; ") : "eight for a full lobby, the first two a 1v1's ends"
  );

  // ---- no shooting gallery
  const s0 = { x: plan.x + plan.spawns[0].x, z: plan.z + plan.spawns[0].z };
  const s1 = { x: plan.x + plan.spawns[1].x, z: plan.z + plan.spawns[1].z };
  // and no spawn on one side is in view of a spawn on the other; two spawns
  // on the same end seeing each other is only a team mate waving
  const open: string[] = [];
  for (const i of plan.teams.a) {
    for (const j of plan.teams.b) {
      const p = { x: plan.x + plan.spawns[i].x, z: plan.z + plan.spawns[i].z };
      const q = { x: plan.x + plan.spawns[j].x, z: plan.z + plan.spawns[j].z };
      if (!lineBlocked(plan, p, q)) open.push(`${plan.spawns[i].x},${plan.spawns[i].z} sees ${plan.spawns[j].x},${plan.spawns[j].z}`);
    }
  }
  check(
    `${name}: no spawn can be shot from a spawn on the other side`,
    lineBlocked(plan, s0, s1) && open.length === 0,
    open.length ? open.join("; ") : `${plan.teams.a.length * plan.teams.b.length} pairs, the 1v1's own ends ${Math.hypot(s1.x - s0.x, s1.z - s0.z).toFixed(0)} m apart`
  );

  // ---- a bot's walk from every spawn to every other
  let cut = "";
  const botSeen = plan.spawns.map((s) => walk(f, { x: plan.x + s.x, z: plan.z + s.z }, STEP));
  plan.spawns.forEach((from, i) => {
    plan.spawns.forEach((to, j) => {
      if (i === j) return;
      if (!reached(f, botSeen[i], plan.x + to.x, plan.z + to.z)) cut = `${from.x},${from.z} cannot walk to ${to.x},${to.z}`;
    });
  });
  check(`${name}: a bot walks from every spawn to every other spawn`, !cut, cut || `${plan.spawns.length * (plan.spawns.length - 1)} routes, none over a ${STEP.toFixed(2)} m step`);

  // ---- the floors the map says a bot must be able to use
  const botFloors = allBoxes(plan).filter((x) => x.walk === "bot");
  const unreached = botFloors.filter((x) => !reached(f, botSeen[0], plan.x + x.x, plan.z + x.z, (x.y ?? 0) + x.h));
  check(
    `${name}: every floor above the ground has a staircase a bot can climb`,
    botFloors.length > 0 && unreached.length === 0,
    unreached.length ? unreached.map((x) => `${x.x},${x.z} at ${((x.y ?? 0) + x.h).toFixed(1)} m`).join("; ") : `${botFloors.length} raised floors, all walkable`
  );

  // ---- what the modes score has to be somewhere a bot can stand
  const modeSpots = [...plan.zones.map((z) => ({ id: `zone ${z.id}`, x: z.x, z: z.z })), { id: "crown", x: plan.crown.x, z: plan.crown.z }];
  const lost = modeSpots.filter((s) => !reached(f, botSeen[0], plan.x + s.x, plan.z + s.z));
  check(`${name}: Control's three points and the crown are all on a bot's route`, lost.length === 0, lost.map((s) => s.id).join("; ") || "three zones and the crown");

  // ---- the places only a player goes
  const playerSeen = walk(f, { x: plan.x + plan.spawns[0].x, z: plan.z + plan.spawns[0].z }, MANTLE);
  const playerFloors = allBoxes(plan).filter((x) => x.walk === "player");
  const sealed = playerFloors.filter((x) => !reached(f, playerSeen, plan.x + x.x, plan.z + x.z, (x.y ?? 0) + x.h));
  check(
    `${name}: every player-only floor is still one a player can mantle to`,
    sealed.length === 0,
    sealed.length ? sealed.map((x) => `${x.x},${x.z}`).join("; ") : playerFloors.length ? `${playerFloors.length} of them` : "none in this map"
  );

  // ---- nowhere walled in
  // Every spot on the ground a body fits in has to be a spot it can also
  // leave: a pocket between two boxes, or a room with no door, is somewhere a
  // player lands and stays for the rest of the round.
  let pockets = 0;
  let worst = "";
  for (let c = 0; c < f.levels.length; c++) {
    const ls = f.levels[c];
    if (!ls.length || ls[0] > STEP) continue;
    if (playerSeen[c][0]) continue;
    pockets++;
    if (!worst) {
      const p = f.centre(c);
      worst = `${(p.x - plan.x).toFixed(1)},${(p.z - plan.z).toFixed(1)}`;
    }
  }
  check(`${name}: no pocket on the floor a player could be shut inside`, pockets === 0, pockets ? `${pockets} cells, first at ${worst}` : `${f.nx * f.nz} cells of floor, all with a way out`);

  // ---- what it costs to draw
  const meshes = meshCount(plan);
  check(`${name}: ${meshes} meshes before the static merge`, meshes <= 320, `${allBoxes(plan).length} boxes, ${plan.roof ? "a roof" : "open sky"}, bounds ${b.minX},${b.minZ} to ${b.maxX},${b.maxZ}`);
}

export const arenasFails = fails;
if (process.argv[1]?.includes("arenas")) console.log(fails ? `\n${fails} FAILED` : "\narenas PASS");
