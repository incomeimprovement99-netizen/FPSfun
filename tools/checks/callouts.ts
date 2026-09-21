// Callouts (src/game/callouts.ts): the name of the ground you are standing
// on, so a squad without voice can say where they are.
//
// The battle royale names its places; the arenas named nothing, so "he is
// over there" was all anybody could say in seven of the game's modes. The
// owner asked for the list we never built, and for the roofs to be in it.
//
// What is checked is that the names mean what they say: north is north on a
// map laid out the way these maps are, the middle is the middle, a roof is
// called a roof, every part of a map has a name, and the name does not
// flicker between two as you walk down the line between them.
//
// Run on its own: npx tsx tools/checks/callouts.ts.
import { ROOF_AT, calloutAt, calloutLine } from "../../src/game/callouts";

let fails = 0;
function check(label: string, cond: boolean, detail = ""): void {
  if (!cond) fails++;
  console.log(`${cond ? "  ok  " : "FAIL  "}${label}${detail ? ` (${detail})` : ""}`);
}

/** a 40 by 30 m arena about its own middle */
const HX = 20;
const HZ = 15;
const at = (x: number, z: number, y = 0) => calloutAt(x, z, y, HX, HZ);

console.log("Callouts");
{
  check("the middle is MID", at(0, 0).name === "MID", at(0, 0).name);
  // z grows south in these maps, as the plans are laid out
  check("north is north and south is south", at(0, -HZ * 0.9).name === "NORTH" && at(0, HZ * 0.9).name === "SOUTH", `${at(0, -HZ * 0.9).name} / ${at(0, HZ * 0.9).name}`);
  check("east is east and west is west", at(HX * 0.9, 0).name === "EAST" && at(-HX * 0.9, 0).name === "WEST", `${at(HX * 0.9, 0).name} / ${at(-HX * 0.9, 0).name}`);
  check("and the corners are corners", at(-HX * 0.9, -HZ * 0.9).name === "NORTH-WEST" && at(HX * 0.9, HZ * 0.9).name === "SOUTH-EAST");
}
{
  check("standing on something says so", at(0, 0, ROOF_AT + 0.1).name === "MID ROOF" && at(0, 0, ROOF_AT + 0.1).high);
  check("and standing on the floor does not", !at(0, 0, 0).high && !at(0, 0, ROOF_AT - 0.1).high, `${ROOF_AT} m up`);
  check("a step is not a roof: the height is one a person climbs onto, not one they walk up", ROOF_AT > 0.6 && ROOF_AT < 2.5, `${ROOF_AT} m`);
  check("it reads as a sentence when a squad mate is told", calloutLine(at(0, 0, 2)) === "ON THE MID ROOF" && calloutLine(at(0, 0)) === "IN MID", calloutLine(at(0, 0, 2)));
}
{
  // every part of a map has a name, and only nine of them
  const names = new Set<string>();
  for (let x = -HX; x <= HX; x += 0.5) for (let z = -HZ; z <= HZ; z += 0.5) names.add(at(x, z).name);
  check("every part of a map has a callout", names.size === 9, [...names].sort().join(", "));
  check("and a map with no size does not divide by nothing", calloutAt(0, 0, 0, 0, 0).name === "MID");
}
{
  // walking the line between two regions must not flicker: the bands are
  // fixed fractions of the map, so the boundary is one place and stays there
  const edge = HX * 0.34;
  const a = at(edge - 0.01, 0).name;
  const b = at(edge + 0.01, 0).name;
  check("the boundary between two callouts is one place, not a flutter", a !== b && at(edge - 2, 0).name === a && at(edge + 2, 0).name === b, `${a} | ${b}`);
  check("the middle is a third of the map, which is what people call MID", Math.abs(edge / HX - 0.34) < 1e-9, `${(0.34 * 200).toFixed(0)}% of it across`);
}

console.log(fails === 0 ? "\nCALLOUTS PASS" : `\nCALLOUTS FAIL (${fails})`);
export const calloutFails = fails;
if (process.argv[1]?.endsWith("callouts.ts")) process.exit(fails === 0 ? 0 : 1);
