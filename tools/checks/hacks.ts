// SpeedKills' hacks (src/game/hacks.ts, src/config/hacks.json): the ten the
// owner chose, in their two slots, and the rules of carrying them. What each
// does in a match is the e2e's (the speedkills section): these are the rules
// that decide what you hold, which a player learns once and must be able to
// trust.
//
// Run on its own: npx tsx tools/checks/hacks.ts
import { MOVE } from "../../src/game/movement";
import { Hacks, HACK, HACK_DEFS, cooldownOf, hackSlotOf } from "../../src/game/hacks";
import SK from "../../src/config/games/speedkills.json";

let fails = 0;
function check(label: string, cond: boolean, detail = ""): void {
  if (!cond) fails++;
  console.log(`${cond ? "  ok  " : "FAIL  "}${label}${detail ? ` (${detail})` : ""}`);
}

console.log("SpeedKills' hacks");
{
  const ids = HACK_DEFS.map((h) => h.id).sort();
  check("the owner's ten: dash, slam, leap, grapple; heal, armor, wall, invisibility, reveal, mine", JSON.stringify(ids) === JSON.stringify(["armor", "dash", "grapple", "heal", "invis", "leap", "mine", "reveal", "slam", "wall"]), ids.join(","));
  check("four mobility and six utility", HACK_DEFS.filter((h) => h.slot === "mobility").length === 4 && HACK_DEFS.filter((h) => h.slot === "utility").length === 6);
  check("every hack has its numbers and a cooldown", HACK_DEFS.every((h) => HACK[h.id] && HACK[h.id].cooldown > 0));
  check("DASH's cooldowns are Hyper Scape's Teleport's, 12 s to 7 s over four fusions", [0, 1, 2, 3, 4].map((l) => cooldownOf("dash", l)).join(",") === "12,11,10,9,7" && cooldownOf("dash", 9) === 7);
  // Phase 20 A9: Hyper Scape's final published numbers (hacks.json _note has the sources)
  const table = (id: Parameters<typeof cooldownOf>[0]) => [0, 1, 2, 3, 4].map((l) => cooldownOf(id, l)).join(",");
  const X = HACK as unknown as Record<string, Record<string, number | number[]>>;
  check("the cooldowns are Hyper Scape's final tables: SLAM, WALL and REVEAL 12 to 7; HEAL, ARMOR, INVISIBILITY and MINE 14 to 9", ["slam", "wall", "reveal"].every((id) => table(id as never) === "12,11,10,9,7") && ["heal", "armor", "invis", "mine"].every((id) => table(id as never) === "14,13,12,11,9"), ["slam", "wall", "reveal", "heal", "armor", "invis", "mine"].map((id) => `${id} ${table(id as never)}`).join("; "));
  check("REVEAL is a 50 degree cone out to 60 m for 8 s; INVISIBILITY 4 s; ARMOR 4 s; HEAL for 9 s", HACK.reveal.cone === 50 && HACK.reveal.range === 60 && HACK.reveal.seconds === 8 && HACK.invis.seconds === 4 && HACK.armor.seconds === 4 && HACK.heal.seconds === 9);
  // HEAL's rate is ours (hacks.json _heal): Hyper Scape's 4.4 a second was 40 health, barely over the regeneration's 4
  {
    const rates = X.heal.perSeconds as number[];
    const regen = SK.health.healthRegen;
    check("HEAL gives back at least a whole health bar over its seconds, at every level", rates.every((r) => r * HACK.heal.seconds >= SK.health.health), rates.join(","));
    check("HEAL heals at least twice the regeneration's rate, and never less at a higher level", rates.every((r, i) => r >= 2 * regen && (i === 0 || r >= rates[i - 1])) && X.heal.perSecond === rates[0], `${rates.join(",")} against ${regen}`);
  }
  check("SLAM does 20 at every level and 30 at the top; a MINE 40 and 60, chasing for 8 s from 15 m, one at a time; at most 2 WALLS for 15 s", JSON.stringify(X.slam.damages) === "[20,20,20,20,30]" && JSON.stringify(X.mine.damages) === "[40,40,40,40,60]" && HACK.mine.chase === 8 && HACK.mine.trigger === 15 && HACK.mine.max === 1 && HACK.wall.max === 2 && HACK.wall.seconds === 15);
  {
    // measured off Hyper Scape's footage (hacks.json _note): SLAM's apex about 30 m, TELEPORT (our DASH) about 26 m
    const g = MOVE.gravity;
    const v = Math.sqrt(2 * g * HACK.slam.apex);
    const peak = (v * v) / (2 * g);
    check("SLAM rises to its measured apex, about 30 m (ours was 2.3 m, under a double jump)", Math.abs(peak - 30) < 0.01 && HACK.slam.apex >= 26 && HACK.slam.apex <= 36, `${peak.toFixed(1)} m at ${v.toFixed(1)} m/s`);
    check("DASH reaches Hyper Scape's Teleport's measured 26 m (ours was 8)", HACK.dash.distance >= 23 && HACK.dash.distance <= 31, `${HACK.dash.distance} m`);
  }
  check("a hack with no published table takes 10% a level off, to four levels", Math.abs(cooldownOf("leap", 4) - HACK.leap.cooldown * 0.6) < 1e-9);
  check("every table falls level by level and ends at or below where it started", HACK_DEFS.every((h) => [0, 1, 2, 3].every((l) => cooldownOf(h.id, l + 1) <= cooldownOf(h.id, l))));

  const h = new Hacks();
  h.set("dash");
  h.set("heal");
  check("a pick goes in its own slot", h.get("mobility")?.id === "dash" && h.get("utility")?.id === "heal");
  check("both ready at the start", h.left("mobility", 0) === 0 && h.left("utility", 0) === 0);
  check("used, it is gone for its cooldown", h.use("mobility", 10) === "dash" && h.use("mobility", 11) === null && Math.abs(h.left("mobility", 11) - (cooldownOf("dash", 0) - 1)) < 1e-9);
  check("and back after it", h.use("mobility", 10 + cooldownOf("dash", 0)) === "dash");
  check("a copy of what you hold fuses it up a level", h.take("dash", 0, 50) === "fused" && h.get("mobility")?.level === 1);
  check("a higher-level copy takes you to its level", h.take("dash", 3, 50) === "fused" && h.get("mobility")?.level === 3);
  h.take("dash", 0, 50);
  check("to the top, and a copy after that says so", h.get("mobility")?.level === HACK.fuseLevels && h.take("dash", 0, 50) === "maxed");
  check("another of the same slot swaps in, at its own level", h.take("grapple", 1, 50) === "swapped" && h.get("mobility")?.id === "grapple" && h.get("mobility")?.level === 1 && h.get("utility")?.id === "heal");
  const t = 100;
  h.use("utility", t);
  const leftBefore = h.left("utility", t);
  h.take("wall", 0, t);
  check("a swap keeps the cooldown that was running (no free use by swapping)", h.get("utility")?.id === "wall" && Math.abs(h.left("utility", t) - leftBefore) < 1e-9);
  h.refund("utility");
  check("a use that did not happen gives the cooldown back", h.left("utility", t) === 0);
  check("each hack's slot is the one the profile gives it", hackSlotOf("mine") === "utility" && hackSlotOf("slam") === "mobility");
}

console.log(fails === 0 ? "\nHACKS PASS" : `\nHACKS FAIL (${fails})`);
export const hacksFails = fails;
if (process.argv[1]?.endsWith("hacks.ts")) process.exit(fails === 0 ? 0 : 1);
