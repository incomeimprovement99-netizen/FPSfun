// Looting checks: the walk-over pickup, the hold that empties a spot, and the
// reach list (src/game/brplay.ts, tuned in src/config/hud.json).
//
// Ranked item 9 was that picking up cost you the fight: one item a press at
// whatever happened to be nearest the crosshair, so a landing was dozens of
// presses with your head down. What is asserted here is the three habits that
// replace it, and every expected value comes from the config rather than a
// number typed out twice.
//
// Run on its own: npx tsx tools/checks/pickup-reach.ts.
import { autoTakes, holdDue, nothingToGain, reachRows, type CarryState, type ReachDrop } from "../../src/game/brplay";
import type { LootItem } from "../../src/game/loot";
import hudCfg from "../../src/config/hud.json";

const L = hudCfg.loot;
let fails = 0;
function check(label: string, cond: boolean, detail = ""): void {
  if (!cond) fails++;
  console.log(`${cond ? "  ok  " : "FAIL  "}${label}${detail ? ` (${detail})` : ""}`);
}
function near(label: string, got: number, want: number, tol: number): void {
  const ok = Math.abs(got - want) <= tol;
  if (!ok) fails++;
  console.log(`${ok ? "  ok  " : "FAIL  "}${label} = ${got.toFixed(3)} (want ${want} +/- ${tol})`);
}

const ammo = (id: string, n = 60): LootItem => ({ kind: "ammo", id, n, rarity: "common" });
const heal = (id: string, n: number): LootItem => ({ kind: "heal", id, n, rarity: "common" });
const mag = (level: number): LootItem => ({ kind: "attach", id: `mag:${level}`, n: 1, rarity: "rare" });
const gun = (id: string): LootItem => ({ kind: "weapon", id, n: 1, rarity: "rare" });
const deathBox: LootItem = { kind: "box", id: "box", n: 1, rarity: "common" };
const at = (key: number, item: LootItem, x: number, z: number, y = 0): ReachDrop => ({ key, item, pos: { x, y, z } });
const HERE = { x: 0, y: 0, z: 0 };
const keysOf = (rows: Array<{ key: number }>): string => rows.map((r) => r.key).join(",");

// ------------------------------------------------------------------ the reach list
console.log("\nThe reach list: what is at your feet, nearest first (src/game/brplay.ts)");
{
  const rows = reachRows([at(5, gun("r97"), 2, 0), at(9, ammo("light"), 0.5, 0), at(2, heal("cell", 2), 0, 1.2)], HERE, null);
  check("nearest first", keysOf(rows) === "9,2,5", `keys ${keysOf(rows)}`);
  check("and the distances rise down the list", rows.every((r, i) => i === 0 || r.dist >= rows[i - 1].dist), rows.map((r) => r.dist.toFixed(2)).join(" "));
  near("the nearest row's distance, metres", rows[0].dist, 0.5, 0.001);

  // two things the same distance off must not swap places frame to frame
  const tied = reachRows([at(7, ammo("light"), 1, 0), at(3, ammo("heavy"), -1, 0)], HERE, null);
  check("equal distances go to the lower key, so the list holds still", keysOf(tied) === "3,7", `keys ${keysOf(tied)}`);

  const far = reachRows([at(1, ammo("light"), L.reach + 0.5, 0)], HERE, null);
  check("past the reach radius is not listed", far.length === 0, `${L.reach} m reach`);
  const inside = reachRows([at(1, ammo("light"), L.reach - 0.1, 0)], HERE, null);
  check("just inside it is", inside.length === 1);

  const upstairs = reachRows([at(1, ammo("light"), 0.2, 0, L.floorGap + 0.5)], HERE, null);
  check("loot on the floor above is out of reach however close on the map", upstairs.length === 0, `${L.floorGap} m floor gap`);

  const boxed = reachRows([at(1, deathBox, 0.4, 0), at(2, ammo("light"), 0.6, 0)], HERE, null);
  check("a death box is the box, not a row", keysOf(boxed) === "2", `keys ${keysOf(boxed)}`);

  const crowd = Array.from({ length: L.listMax + 3 }, (_, i) => at(i + 1, ammo("light"), 0.2 + i * 0.1, 0));
  check("a pile longer than the list is cut to listMax", reachRows(crowd, HERE, null).length === L.listMax, `${L.listMax} rows`);
  check("and the rows it keeps are the nearest ones", keysOf(reachRows(crowd, HERE, null)) === Array.from({ length: L.listMax }, (_, i) => i + 1).join(","));
}

// ------------------------------------------------------------------ walking over it
console.log("\nWalk-over pickup: the refills only, and only when they are of use (src/config/hud.json)");
{
  const carry: CarryState = { ammo: ["light"], healRoom: { cell: 4, syringe: 0 }, mag: 2 };
  check("ammo for a gun you carry comes up with no press", autoTakes(ammo("light"), carry));
  check("ammo for a gun you do not carry is left where it lies", !autoTakes(ammo("heavy"), carry), "heavy, carrying a light gun");
  check("a shield cell comes up when the kit has room", autoTakes(heal("cell", 2), carry), "room 4, stack 2");
  check("a syringe is refused when the kit is full", !autoTakes(heal("syringe", 2), carry), "room 0");
  check("and refused when only part of the stack fits", !autoTakes(heal("cell", 2), { ...carry, healRoom: { cell: 1 } }), "room 1, stack 2");
  check("a medkit is not a walk-over heal", !autoTakes(heal("medkit", 1), { ammo: [], healRoom: { medkit: 2 } }), `autoHeals: ${L.autoHeals.join(", ")}`);
  check("a gun is a choice, so it waits for the key", !autoTakes(gun("r97"), carry));
  check("so does a magazine", !autoTakes(mag(4), carry));
  check("nothing is swept while what you carry is unknown", !autoTakes(ammo("light"), null));
  check("every walk-over kind is one of the two the config names", L.autoKinds.every((k) => k === "ammo" || k === "heal"), L.autoKinds.join(", "));
  check("the sweep is smaller than the reach radius", L.sweep < L.reach, `${L.sweep} m inside ${L.reach} m`);
}

// ------------------------------------------------------------------ the grey-out
console.log("\nNothing to gain: the rows the list greys and the hold steps over");
{
  const carry: CarryState = { ammo: ["light"], healRoom: { cell: 4, syringe: 0 }, mag: 2 };
  check("ammo neither gun takes is greyed", nothingToGain(ammo("heavy"), carry));
  check("ammo you can use is not", !nothingToGain(ammo("light"), carry));
  check("a heal your kit is full of is greyed", nothingToGain(heal("syringe", 2), carry));
  check("one you have room for is not", !nothingToGain(heal("cell", 2), carry));
  check("a magazine no better than yours is greyed", nothingToGain(mag(2), carry), "mag 2, holding 2");
  check("a better one is not", !nothingToGain(mag(3), carry));
  check("a gun is never greyed, because it is a choice", !nothingToGain(gun("r97"), carry));
  check("nothing is greyed while what you carry is unknown", !nothingToGain(ammo("heavy"), null));

  const rows = reachRows([at(1, ammo("heavy"), 0.3, 0), at(2, heal("cell", 2), 0.6, 0), at(3, mag(3), 0.9, 0)], HERE, carry);
  check("the list greys that row and leaves the rest alone", rows.map((r) => (r.dim ? "x" : "-")).join("") === "x--", rows.map((r) => `${r.label}:${r.dim}`).join(" "));
  check("and what a hold would take is the rest, nearest first", keysOf(rows.filter((r) => !r.dim)) === "2,3");
}

// ------------------------------------------------------------------ the hold
console.log("\nHold to take everything: the first item late, the rest on a cadence");
{
  check("the cadence is shorter than the wait before the first one", L.cadence < L.startAfter, `${L.cadence} s inside ${L.startAfter} s`);
  const down = 0;
  check("a tap takes nothing extra", !holdDue(L.startAfter - 0.01, down, down), `${L.startAfter} s to start`);
  check("the first extra item is due at startAfter", holdDue(L.startAfter, down, down));
  check("and the next one only a cadence after it", !holdDue(L.startAfter + L.cadence - 0.01, down, L.startAfter));
  check("which then comes due", holdDue(L.startAfter + L.cadence, down, L.startAfter));

  // the real frame loop: the press takes one, then the hold keeps going
  const FPS = 144;
  const run = (seconds: number, release = Infinity): number[] => {
    const taken: number[] = [0];
    let last = 0;
    for (let i = 1; i <= Math.round(seconds * FPS); i++) {
      const t = i / FPS;
      if (t >= release) break;
      if (holdDue(t, down, last)) {
        taken.push(t);
        last = t;
      }
    }
    return taken;
  };
  const second = run(1);
  const want = 2 + Math.floor((1 - L.startAfter) / L.cadence);
  check("a second of holding takes that many items", second.length === want, `${second.length} items, want ${want}`);
  near("the second item's moment, seconds", second[1], L.startAfter, 1 / FPS);
  near("the third's, one cadence later", second[2], L.startAfter + L.cadence, 1 / FPS);
  check("the gaps after the first are all the cadence", second.slice(2).every((t, i) => Math.abs(t - second[i + 1] - L.cadence) <= 1 / FPS), second.map((t) => t.toFixed(2)).join(" "));
  check("letting go before startAfter leaves you the one you pressed for", run(1, L.startAfter - 0.01).length === 1);
}

console.log(fails === 0 ? "\nPICKUP-REACH PASS" : `\nPICKUP-REACH FAIL (${fails})`);
export const pickupReachFails = fails;
if (process.argv[1]?.endsWith("pickup-reach.ts")) process.exit(fails === 0 ? 0 : 1);
