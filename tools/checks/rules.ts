// Custom match rules (src/config/rules.json).
//
// A class of guns hands anyone holding another gun that class's first two,
// and arms the bots with its first: each of those has to be a real gun of
// that class, or the rule would hand out a gun it forbids.
//
// Run on its own: npx tsx tools/checks/rules.ts.
import cfg from "../../src/config/rules.json";
import { weaponClass, weaponIds } from "../../src/game/weapons";

let fails = 0;
function check(label: string, cond: boolean, detail = ""): void {
  if (!cond) fails++;
  console.log(`${cond ? "  ok  " : "FAIL  "}${label}${detail ? ` (${detail})` : ""}`);
}

console.log("Custom match rules");
{
  const ids = new Set(weaponIds());
  const bad: string[] = [];
  for (const [cls, c] of Object.entries(cfg.classes)) for (const id of c.guns) if (!ids.has(id) || weaponClass(id) !== cls) bad.push(`${cls}:${id}=${weaponClass(id)}`);
  check("every class's guns are real guns of that class", bad.length === 0, bad.join(", ") || Object.keys(cfg.classes).join(", "));
  const covered = new Set(weaponIds().map(weaponClass));
  const missing = Object.keys(cfg.classes).filter((c) => !covered.has(c));
  check("and every class has a gun in the data", missing.length === 0, missing.join(", "));
  check("the 1v1's usual first to 3 is one of the choices", cfg.rounds.includes(3), cfg.rounds.join(","));
}

console.log(fails === 0 ? "\nRULES PASS" : `\nRULES FAIL (${fails})`);
export const rulesFails = fails;
if (process.argv[1]?.endsWith("rules.ts")) process.exit(fails === 0 ? 0 : 1);
