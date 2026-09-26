// SpeedKills' hacks (src/game/hacks.ts, src/config/hacks.json): the ten the
// owner chose, in their two slots, and the rules of carrying them. What each
// does in a match is the e2e's (the speedkills section): these are the rules
// that decide what you hold, which a player learns once and must be able to
// trust.
//
// Run on its own: npx tsx tools/checks/hacks.ts
import { Hacks, HACK, HACK_DEFS, cooldownOf, hackSlotOf } from "../../src/game/hacks";

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
  check("REVEAL is Hyper Scape's: 14 s to 9, everyone within 60 m for 6 s; a MINE does 50", cooldownOf("reveal", 0) === 14 && cooldownOf("reveal", 4) === 9 && HACK.reveal.range === 60 && HACK.reveal.seconds === 6 && HACK.mine.damage === 50);
  check("a hack with no published table takes 10% a level off, to four levels", Math.abs(cooldownOf("heal", 4) - HACK.heal.cooldown * 0.6) < 1e-9);
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
