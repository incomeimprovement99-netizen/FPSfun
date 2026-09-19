// The Gulag (src/game/gulag.ts, src/config/br.json gulag).
//
// Its clock and rules: who goes, the two guns, the phases in their order and
// on time, and overtime's flag, where only a fighter alone on it gains and the
// first to the capture wins. The room, the bot and the way back are the
// match's (brmatch.ts) and the e2e gulag section plays them.
//
// Run on its own: npx tsx tools/checks/gulag.ts.
import { GULAG, Gulag, gulagFor } from "../../src/game/gulag";
import { seeded } from "../../src/game/loot";

let fails = 0;
function check(label: string, cond: boolean, detail = ""): void {
  if (!cond) fails++;
  console.log(`${cond ? "  ok  " : "FAIL  "}${label}${detail ? ` (${detail})` : ""}`);
}

console.log("Who goes to the Gulag");
{
  check("a first death, early, in the battle royale", gulagFor("br", 0, false) && gulagFor("br", GULAG.untilPhase - 1, false));
  check("not a second: one trip a match", !gulagFor("br", 0, true));
  check(`not from ring ${GULAG.untilPhase + 1} on: the late game is final`, !gulagFor("br", GULAG.untilPhase, false));
  check("not in Resurgence, which has its own way back", !gulagFor("resurgence", 0, false));
}

console.log("\nThe guns");
{
  let same = 0;
  let outside = 0;
  const pairs = new Set<string>();
  for (let s = 1; s <= 400; s++) {
    const g = new Gulag(0, seeded(s * 97));
    if (g.guns[0] === g.guns[1]) same++;
    if (!GULAG.guns.includes(g.guns[0]) || !GULAG.guns.includes(g.guns[1])) outside++;
    pairs.add([...g.guns].sort().join("+"));
  }
  check("two different guns, every time", same === 0, `${same} of 400 the same gun twice`);
  check("both from the Gulag's list", outside === 0);
  check("and the pair changes from fight to fight", pairs.size >= 20, `${pairs.size} pairs in 400`);
}

console.log("\nThe clock");
{
  const g = new Gulag(100, seeded(5));
  check(`a moment first (${GULAG.delay} s), the death's`, g.phase === "wait" && g.tick(100 + GULAG.delay - 0.01, 0.01, false, false) === null && Math.abs(g.clock(100) - GULAG.delay) < 1e-9);
  check("then in, with a countdown", g.tick(100 + GULAG.delay, 0.01, false, false) === "enter" && g.phase === "countdown" && !g.live);
  check(`the fight after ${GULAG.countdown} s`, g.tick(g.fightAt, 0.01, false, false) === "fight" && g.live);
  check(`overtime after ${GULAG.fight} s of it`, g.tick(g.overtimeAt - 0.01, 0.01, false, false) === null && g.tick(g.overtimeAt, 0.01, false, false) === "overtime" && g.live);
}

console.log("\nOvertime's flag");
{
  const at = (g: Gulag) => {
    g.tick(g.enterAt, 0.01, false, false);
    g.tick(g.fightAt, 0.01, false, false);
    g.tick(g.overtimeAt, 0.01, false, false);
    return g.overtimeAt;
  };
  const both = new Gulag(0, seeded(1));
  let t = at(both);
  for (let i = 0; i < 600; i++) both.tick((t += 0.05), 0.05, true, true);
  check("both on it: a stand-off, nobody gains", both.phase === "overtime" && both.capMe === 0 && both.capThem === 0);
  const mine = new Gulag(0, seeded(2));
  t = at(mine);
  let ev = null;
  let took = 0;
  while (!ev && took < 60) {
    ev = mine.tick((t += 0.05), 0.05, true, false);
    took += 0.05;
  }
  check(`alone on it for ${GULAG.capture} s: won`, ev === "won" && Math.abs(took - GULAG.capture) < 0.06, `${took.toFixed(2)} s`);
  const theirs = new Gulag(0, seeded(3));
  t = at(theirs);
  ev = null;
  while (!ev) ev = theirs.tick((t += 0.05), 0.05, false, true);
  check("them alone on it: lost", ev === "lost" && theirs.phase === "lost");
  check("decided once: a win after a loss changes nothing", theirs.won(t + 1) === null && theirs.phase === "lost");
}

console.log(fails === 0 ? "\nGULAG PASS" : `\nGULAG FAIL (${fails})`);
export const gulagFails = fails;
if (process.argv[1]?.endsWith("gulag.ts")) process.exit(fails === 0 ? 0 : 1);
