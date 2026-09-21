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
  check("the factory paint is first in the list", FINISHES[0].id === "factory" && FINISHES[0].level === 1);
  check("every finish its own id, and the list runs from plain to fancy", new Set(ids).size === ids.length && FINISHES.every((f, i) => i === 0 || f.level >= FINISHES[i - 1].level), FINISHES.map((f) => `${f.id}@${f.level}`).join(", "));
  check("every finish after the factory's paints something", FINISHES.slice(1).every((f) => f.body !== undefined || f.accent !== undefined));
  // No levels on them any anymore: the owner asked for the grind to come off a
  // paint job. `level` is kept in the data as the order the list is shown in.
  const top = FINISHES[FINISHES.length - 1];
  check(`every finish is open to everybody, all ${FINISHES.length} of them`, unlocked().length === FINISHES.length);
  check("the last one in the list can be taken from the first minute", chooseFinish("r97", top.id) && finishFor("r97").id === top.id);
  check("a finish that does not exist is not taken", !chooseFinish("r97", "no-such-paint") && finishFor("r97").id === top.id);
  check("each gun keeps its own", finishFor("rspn101").id === "factory");
}

console.log(fails === 0 ? "\nFINISHES PASS" : `\nFINISHES FAIL (${fails})`);
export const finishesFails = fails;
if (process.argv[1]?.endsWith("finishes.ts")) process.exit(fails === 0 ? 0 : 1);
