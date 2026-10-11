// The decay's clock (src/game/decay.ts decayRounds and sectorPhases, src/config/decay.json).
//
// The owner, 2026-10-11: "don't have any decay until a 1 min into the game, i
// don't want anything to decay at the start. if people want to loot for a
// couple mins then that's their choice and should be able to without fearing
// the zonepull". Before this the ring's clock started wave 1's warning the
// moment the dropship was gone, so two sectors were flagged at once and the
// first dissolved under 50 s later. These run the real Ring on the rounds a
// match uses, at every lobby pace, and read the sectors the way brmatch.ts
// does, so a warning, a beam or a tick in the first minute fails here.
//
// Run on its own: npx tsx tools/checks/decay-clock.ts.
import decayCfg from "../../src/config/decay.json";
import { Ring, RING_PACE, RING_TICK, type Circle } from "../../src/game/ring";
import { decayPlan, decayRounds, sectorPhases } from "../../src/game/decay";

let fails = 0;
function check(label: string, cond: boolean, detail = ""): void {
  if (!cond) fails++;
  console.log(`${cond ? "  ok  " : "FAIL  "}${label}${detail ? ` (${detail})` : ""}`);
}

const QUIET = 60;
const DT = 0.05;
const AT: Circle = { cx: 0, cz: 0, r: 500 };

/** one match's clock, seconds from the ring's start: when each wave's sectors are first warned and first decay */
function run(pace: string, seed: number) {
  const rounds = decayRounds(pace);
  const plan = decayPlan(seed);
  const ring = new Ring(AT, () => 0.5, [], rounds, { cx: 0, cz: 0, r: 20 });
  const warned: number[] = [];
  const decays: number[] = [];
  let firstFlag = Infinity;
  let firstTick = Infinity;
  for (let t = 0; ring.state !== "closed" && t < 1200; t += DT) {
    const tick = ring.update(DT);
    const st = sectorPhases(plan, ring, (p) => rounds[Math.min(p, rounds.length - 1)]);
    plan.waves.forEach((wave, w) => {
      for (const id of wave) {
        if (st[id].phase === "warning" && warned[w] === undefined) warned[w] = t;
        if (st[id].phase === "decaying" && decays[w] === undefined) decays[w] = t;
      }
    });
    const any = Object.values(st).some((s) => s.phase !== "live");
    if (any && firstFlag === Infinity) firstFlag = t;
    // a tick hurts only where a sector is decaying or gone (brmatch.ts lostAt)
    if (tick && Object.values(st).some((s) => s.phase === "decaying" || s.phase === "gone") && firstTick === Infinity) firstTick = t;
  }
  const captureAt = rounds.slice(0, plan.waves.length).reduce((a, r) => a + r.wait + r.close, 0);
  return { rounds, plan, warned, decays, firstFlag, firstTick, captureAt };
}

console.log("The quiet minute");
check(`decay.json's grace is the owner's minute: at least ${QUIET} s`, decayCfg.grace >= QUIET, `${decayCfg.grace}`);
for (const pace of Object.keys(RING_PACE)) {
  for (const seed of [1, 7, 42]) {
    const m = run(pace, seed);
    const tag = `${pace} pace, seed ${seed}`;
    check(`${tag}: no sector warned, beamed or decaying in the first ${QUIET} s`, m.firstFlag >= QUIET - DT, `first at ${m.firstFlag.toFixed(1)} s`);
    check(`${tag}: no decay tick in the first ${QUIET} s`, m.firstTick >= QUIET, `first at ${m.firstTick.toFixed(1)} s`);
    const warn = m.rounds[0].warn ?? m.rounds[0].wait;
    check(`${tag}: wave 1 warned its whole ${warn} s before it dissolves`, Math.abs(m.decays[0] - m.warned[0] - warn) <= 2 * DT, `${(m.decays[0] - m.warned[0]).toFixed(1)} s`);
    const late = m.plan.waves.map((_, w) => w).filter((w) => w > 0 && Math.abs(m.decays[w] - m.warned[w] - m.rounds[w].wait) > 2 * DT);
    check(`${tag}: every later wave warned its whole wait`, late.length === 0, late.map((w) => `wave ${w + 1}`).join(", "));
  }
}

console.log("\nThe match's length at the normal pace");
{
  const m = run("normal", 1);
  check("the first sector dissolves no sooner than the minute and wave 1's warning (about two minutes of looting)", m.decays[0] >= QUIET + 50 - DT, `${m.decays[0].toFixed(1)} s after the ship`);
  // with the dropship's ride and boarding, about 40 s, that is the owner's 6 to 7 minutes
  const end = m.captureAt + decayCfg.capture.hold;
  check("the ring's start to a capture held is 320 to 380 s", end >= 320 && end <= 380, `${end} s`);
  check(`a tick of the decay is ${RING_TICK} s, so a sector decaying hurts within its close`, RING_TICK < m.rounds[0].close);
}

console.log(fails === 0 ? "\nDECAY CLOCK PASS" : `\nDECAY CLOCK FAIL (${fails})`);
export const decayClockFails = fails;
if (process.argv[1]?.endsWith("decay-clock.ts")) process.exit(fails === 0 ? 0 : 1);
