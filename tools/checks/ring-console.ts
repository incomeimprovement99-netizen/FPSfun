// Ring Consoles (src/game/ringconsole.ts) and the ring's chain (ring.ts plan).
//
// A console shows the circle after next, so two things have to hold. The
// chain the ring works out at the start must be the chain it actually closes
// onto, round by round, or a scan would show a circle the ring never goes to;
// and a guest's chain, drawn from the same seed, must be the host's. Then the
// consoles themselves: the same spots on every browser for the same match,
// near their places, on clear ground, one a place.
//
// Run on its own: npx tsx tools/checks/ring-console.ts.
import { Ring, RING_PHASES, RING_BOUNDS, type Circle } from "../../src/game/ring";
import { CONSOLE, consoleSpots } from "../../src/game/ringconsole";
import { seeded } from "../../src/game/loot";
import { RANGE_SOLIDS } from "../../src/game/range";

let fails = 0;
function check(label: string, cond: boolean, detail = ""): void {
  if (!cond) fails++;
  console.log(`${cond ? "  ok  " : "FAIL  "}${label}${detail ? ` (${detail})` : ""}`);
}

const START = (): Circle => ({ cx: RING_BOUNDS.centerX, cz: RING_BOUNDS.centerZ, r: RING_BOUNDS.half * 1.35 });
const same = (a: Circle, b: Circle) => Math.abs(a.cx - b.cx) < 1e-9 && Math.abs(a.cz - b.cz) < 1e-9 && Math.abs(a.r - b.r) < 1e-9;

console.log("The ring's chain, worked out at the start (ring.ts plan)");
{
  let wrong = 0;
  let guestWrong = 0;
  let matches = 0;
  for (let seed = 1; seed <= 200; seed++) {
    const ring = new Ring(START(), seeded(seed * 2654435761));
    const guest = new Ring(START(), seeded(seed * 2654435761)).plan;
    if (ring.plan.length !== RING_PHASES.length) wrong++;
    for (let p = 0; p < ring.plan.length; p++) if (!same(ring.plan[p], guest[p])) guestWrong++;
    // run the whole ring: at the start of every round, where it closes to is the plan's circle
    let checked = 0;
    let lastPhase = -1;
    for (let t = 0; t < 4000 && !ring.done; t += 0.5) {
      if (ring.phase !== lastPhase) {
        lastPhase = ring.phase;
        if (!same(ring.next, ring.plan[ring.phase])) wrong++;
        checked++;
      }
      ring.update(0.5);
    }
    if (checked !== RING_PHASES.length) wrong++;
    // and it finishes on the plan's last circle
    if (!same(ring.current, ring.plan[RING_PHASES.length - 1])) wrong++;
    matches++;
  }
  check("every round closes onto the circle the plan drew for it, and the last is where it ends", wrong === 0, `${wrong} wrong in ${matches} matches`);
  check("a guest's ring from the same seed has the host's chain", guestWrong === 0, `${guestWrong} circles differ`);
  const a = new Ring(START(), seeded(11)).plan;
  const b = new Ring(START(), seeded(12)).plan;
  check("another seed, another chain", !same(a[3], b[3]));
  // each circle inside the one before: a console shows a circle you can reach from the one you are in
  let nested = 0;
  for (let seed = 1; seed <= 200; seed++) {
    const plan = new Ring(START(), seeded(seed)).plan;
    for (let p = 1; p < plan.length; p++) if (Math.hypot(plan[p].cx - plan[p - 1].cx, plan[p].cz - plan[p - 1].cz) + plan[p].r > plan[p - 1].r + 1e-6) nested++;
  }
  check("every circle of a chain sits inside the one before it", nested === 0, `${nested} outside`);
}

console.log("\nWhere the consoles stand (ringconsole.ts consoleSpots)");
{
  const saved = RANGE_SOLIDS.slice();
  RANGE_SOLIDS.length = 0;
  const places = [
    { name: "HUB", x: 0, z: 500 },
    { name: "NORTH", x: 0, z: 360 },
    { name: "SOUTH", x: 0, z: 640 },
    { name: "EAST", x: 140, z: 500 },
    { name: "WEST", x: -140, z: 500 },
    { name: "NE", x: 120, z: 380 },
    { name: "NW", x: -120, z: 380 },
    { name: "SE", x: 120, z: 620 },
    { name: "SW", x: -120, z: 620 },
  ];
  const a = consoleSpots(77, places);
  const b = consoleSpots(77, places);
  check(`${CONSOLE.count} consoles, one a place`, a.length === CONSOLE.count && new Set(a.map((s) => s.place)).size === a.length, a.map((s) => s.place).join(", "));
  check("the same match puts them in the same spots on every browser", JSON.stringify(a) === JSON.stringify(b));
  const off = a.map((s) => {
    const p = places.find((q) => q.name === s.place)!;
    return Math.hypot(s.x - p.x, s.z - p.z);
  });
  check(`each ${CONSOLE.near} to ${CONSOLE.far} m from its place's middle`, off.every((d) => d >= CONSOLE.near - 1e-6 && d <= CONSOLE.far + 1e-6), off.map((d) => d.toFixed(1)).join(", "));
  const sets = new Set<string>();
  for (let seed = 1; seed <= 60; seed++) sets.add(consoleSpots(seed, places).map((s) => s.place).sort().join(","));
  check("different matches put them by different places", sets.size >= 20, `${sets.size} different sets in 60 matches`);
  // a building over the first spot it would pick: it finds clear ground round it instead
  const first = a[0];
  RANGE_SOLIDS.push({ minX: first.x - 6, maxX: first.x + 6, minZ: first.z - 6, maxZ: first.z + 6, base: 0, top: 4 });
  const moved = consoleSpots(77, places);
  const m = moved.find((s) => s.place === first.place);
  const inside = m ? m.x > first.x - 6.9 && m.x < first.x + 6.9 && m.z > first.z - 6.9 && m.z < first.z + 6.9 : true;
  check("a building on the spot: it stands on clear ground beside it, not in it", !!m && !inside, m ? `${Math.hypot(m.x - first.x, m.z - first.z).toFixed(1)} m over` : "none");
  RANGE_SOLIDS.length = 0;
  RANGE_SOLIDS.push(...saved);
}

console.log(fails === 0 ? "\nRING CONSOLE PASS" : `\nRING CONSOLE FAIL (${fails})`);
export const ringConsoleFails = fails;
if (process.argv[1]?.endsWith("ring-console.ts")) process.exit(fails === 0 ? 0 : 1);
