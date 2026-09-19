// Weapon finishes (src/config/finishes.json, src/game/finishes.ts).
//
// The factory paint is always yours; every other finish opens at a level, in
// order; a finish chosen above your level is not taken, and one chosen when
// it was open but that the level no longer allows (a reset profile) falls
// back to the factory paint.
//
// Run on its own: npx tsx tools/checks/finishes.ts.
import { FINISHES, chooseFinish, finishFor, unlocked } from "../../src/game/finishes";

let fails = 0;
function check(label: string, cond: boolean, detail = ""): void {
  if (!cond) fails++;
  console.log(`${cond ? "  ok  " : "FAIL  "}${label}${detail ? ` (${detail})` : ""}`);
}

console.log("Weapon finishes");
{
  const ids = FINISHES.map((f) => f.id);
  check("the factory paint first, open from level 1", FINISHES[0].id === "factory" && FINISHES[0].level === 1);
  check("every finish its own id, and they open in order of level", new Set(ids).size === ids.length && FINISHES.every((f, i) => i === 0 || f.level >= FINISHES[i - 1].level), FINISHES.map((f) => `${f.id}@${f.level}`).join(", "));
  check("every finish after the factory's paints something", FINISHES.slice(1).every((f) => f.body !== undefined || f.accent !== undefined));
  const top = FINISHES[FINISHES.length - 1];
  check(`at level 1 only the factory paint is open; at ${top.level} all ${FINISHES.length} are`, unlocked(1).length === 1 && unlocked(top.level).length === FINISHES.length);
  check("a finish above your level is not taken", !chooseFinish("r97", top.id, 1) && finishFor("r97", 1).id === "factory");
  check("one within it is, and the gun wears it", chooseFinish("r97", top.id, top.level) && finishFor("r97", top.level).id === top.id);
  check("and a level that no longer allows it falls back to the factory paint", finishFor("r97", 1).id === "factory");
  check("each gun keeps its own", finishFor("rspn101", top.level).id === "factory");
}

console.log(fails === 0 ? "\nFINISHES PASS" : `\nFINISHES FAIL (${fails})`);
export const finishesFails = fails;
if (process.argv[1]?.endsWith("finishes.ts")) process.exit(fails === 0 ? 0 : 1);
