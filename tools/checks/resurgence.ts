// Resurgence (src/game/resurgence.ts, src/config/br.json resurgence).
//
// The rules' arithmetic: the wait grows as the ring closes and stops at the
// round where deaths go final; your side's knocks and kills cut it, never
// below its floor; a side of one always comes back while the rules are on, a
// side with nobody up does not; and the faster ring keeps its circles and its
// damage and shortens only its clock.
//
// Run on its own: npx tsx tools/checks/resurgence.ts.
import { RESURGENCE, Redeploy, asRules, comesBack, redeployWait, resurgenceLive, resurgencePhases, secondsToFinal } from "../../src/game/resurgence";
import { RING_PHASES } from "../../src/game/ring";

let fails = 0;
function check(label: string, cond: boolean, detail = ""): void {
  if (!cond) fails++;
  console.log(`${cond ? "  ok  " : "FAIL  "}${label}${detail ? ` (${detail})` : ""}`);
}

console.log("The wait and the cut-off");
{
  const waits = RING_PHASES.map((_, p) => redeployWait(p));
  check("the wait starts short and grows with the ring, never shrinking", waits[0] <= 20 && waits.every((w, i) => i === 0 || w >= waits[i - 1]), waits.join(", "));
  check("the first rounds are 15 s, the late ones about 39", waits[0] === 15 && waits[waits.length - 1] >= 35, waits.join(", "));
  const live = RING_PHASES.map((_, p) => resurgenceLive(p));
  check(`the dead come back until round ${RESURGENCE.endPhase + 1}, then every death is final`, live.slice(0, RESURGENCE.endPhase).every(Boolean) && live.slice(RESURGENCE.endPhase).every((x) => !x), live.map((x) => (x ? "on" : "final")).join(", "));
  check("and there is an end game with no coming back", RESURGENCE.endPhase < RING_PHASES.length && RESURGENCE.endPhase >= 2);
}

console.log("\nWho comes back");
{
  check("a side of one comes back while the rules are on", comesBack(0, 1, 0) && comesBack(RESURGENCE.endPhase - 1, 1, 0));
  check("a squad with someone up comes back", comesBack(1, 3, 1));
  check("a squad with nobody up is out: there is nobody to come back to", !comesBack(1, 3, 0) && !comesBack(0, 2, 0));
  check("from the final round nobody comes back", !comesBack(RESURGENCE.endPhase, 1, 0) && !comesBack(RESURGENCE.endPhase, 3, 2));
  check("the lobby row and the welcome read safely: anything but resurgence is the battle royale", asRules("resurgence") === "resurgence" && asRules("br") === "br" && asRules(undefined) === "br" && asRules(42) === "br");
}

console.log("\nThe side's knocks and kills cut the wait");
{
  const r = new Redeploy(1, 20);
  const k = r.cut("kill");
  check(`a kill takes ${RESURGENCE.killCut} s off`, k === RESURGENCE.killCut && r.left === 20 - RESURGENCE.killCut, `${r.left} s left`);
  r.cut("knock");
  check(`a knock takes ${RESURGENCE.knockCut} s`, r.left === 20 - RESURGENCE.killCut - RESURGENCE.knockCut, `${r.left} s left`);
  for (let i = 0; i < 10; i++) r.cut("kill");
  check(`never below ${RESURGENCE.floor} s: you do not land in the middle of the fight that got the kill`, r.left === RESURGENCE.floor, `${r.left} s left`);
  const low = new Redeploy(2, 20);
  low.tick(19);
  const before = low.left;
  low.cut("kill");
  check("a cut never lengthens a wait already under the floor", low.left === before, `${before} -> ${low.left}`);
  const t = new Redeploy(3, 15);
  let steps = 0;
  while (!t.tick(1 / 60) && steps < 10000) steps++;
  check("the wait runs out on time", Math.abs((steps + 1) / 60 - 15) < 0.05, `${((steps + 1) / 60).toFixed(2)} s`);
}

console.log("\nThe faster ring");
{
  const fast = resurgencePhases(RING_PHASES);
  check("the same circles and the same damage", fast.every((p, i) => p.radius === RING_PHASES[i].radius && p.damage === RING_PHASES[i].damage));
  const slow = RING_PHASES.reduce((a, p) => a + p.wait + p.close, 0);
  const quick = fast.reduce((a, p) => a + p.wait + p.close, 0);
  check(`the clock ${Math.round(RESURGENCE.ringScale * 100)}% of the battle royale's`, Math.abs(quick - slow * RESURGENCE.ringScale) < 1e-6, `${(slow / 60).toFixed(1)} min -> ${(quick / 60).toFixed(1)} min`);
  const toFinal = secondsToFinal(fast, 0, false, fast[0].wait);
  let want = 0;
  for (let p = 0; p < RESURGENCE.endPhase; p++) want += fast[p].wait + fast[p].close;
  check("the clock to final deaths, from the start, is every round before the cut", Math.abs(toFinal - want) < 1e-6, `${(toFinal / 60).toFixed(1)} min`);
  check("and it is zero once they are final", secondsToFinal(fast, RESURGENCE.endPhase, false, 10) === 0);
  const mid = secondsToFinal(fast, 1, true, 5);
  let rest = 5;
  for (let p = 2; p < RESURGENCE.endPhase; p++) rest += fast[p].wait + fast[p].close;
  check("mid-close, it counts what is left of the close and the rounds after", Math.abs(mid - rest) < 1e-6);
}

console.log(fails === 0 ? "\nRESURGENCE PASS" : `\nRESURGENCE FAIL (${fails})`);
export const resurgenceFails = fails;
if (process.argv[1]?.endsWith("resurgence.ts")) process.exit(fails === 0 ? 0 : 1);
