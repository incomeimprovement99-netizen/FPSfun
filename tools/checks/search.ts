// Search, plant and defuse (src/config/modes.json search, src/game/modes.ts
// Search): the round's rules on their own, driven step by step.
//
// A plant takes plantTime of holding on a site, and starts over if the
// planter lets go or steps off; a planted bomb goes off bombTime later for
// the attackers; a defuse takes defuseTime beside the bomb; the clock running
// out before a plant is the defenders' round; a side wiped out loses it,
// except that attackers wiped out after a plant still need the bomb defused;
// the sides swap after swapAt rounds; and the bomb's beep quickens.
//
// Run on its own: npx tsx tools/checks/search.ts.
import { MODES, Search, searchAttackers, type SearchFighter } from "../../src/game/modes";

let fails = 0;
function check(label: string, cond: boolean, detail = ""): void {
  if (!cond) fails++;
  console.log(`${cond ? "  ok  " : "FAIL  "}${label}${detail ? ` (${detail})` : ""}`);
}

const S = MODES.search;
const SITES = [
  { id: "A", x: -12, z: -13 },
  { id: "B", x: 12, z: 13 },
];
const DT = 0.05;

/** an attacker (team 0) and a defender (team 1) where the case puts them */
function pair(atk: Partial<SearchFighter>, def: Partial<SearchFighter>): SearchFighter[] {
  return [
    { id: 1, x: 0, z: 0, team: 0, alive: true, holding: false, ...atk },
    { id: 2, x: 30, z: 30, team: 1, alive: true, holding: false, ...def },
  ];
}

/** run the round from `t` for `secs`, the fighters as `f` gives them each step; the first decided result, or the last */
function run(s: Search, t: number, secs: number, f: (t: number) => SearchFighter[]): { t: number; winner: 0 | 1 | null; events: string[]; at: number } {
  const events: string[] = [];
  let at = NaN;
  let end = t + secs;
  for (; t < end; t += DT) {
    const r = s.update(t, DT, f(t));
    if (r.event) {
      events.push(r.event);
      if (Number.isNaN(at)) at = t;
    }
    if (r.winner !== null) return { t, winner: r.winner, events, at };
  }
  end = t;
  return { t: end, winner: null, events, at };
}

console.log("Search: plant and defuse");
{
  const s = new Search(0, SITES, 0);
  const onA = pair({ x: -12, z: -13, holding: true }, {});
  const r = run(s, 0, S.plantTime - 0.3, () => onA);
  check("a plant is not done before its time", s.phase === "live" && !!s.work && s.work.kind === "plant" && r.events.length === 0);
  const r2 = run(s, r.t, 0.6, () => onA);
  check(`holding interact on a site for ${S.plantTime} s plants the bomb there`, s.phase === "planted" && s.bomb?.site === 0 && r2.events.includes("planted"), JSON.stringify(s.bomb));
  check(`the bomb's clock is ${S.bombTime} s`, Math.abs(s.left(r2.at) - S.bombTime) < 0.01, `${s.left(r2.at).toFixed(2)} s`);
  const r3 = run(s, r2.t, S.bombTime + 1, () => pair({ x: -12, z: -13 }, {}));
  check("left alone, it goes off: the attackers' round", r3.winner === 0 && r3.events.includes("exploded") && Math.abs(r3.t - r2.at - S.bombTime) < 0.06, `${(r3.t - r2.at).toFixed(2)} s`);
}
{
  const s = new Search(0, SITES, 0);
  // off the site, or not holding: nothing
  run(s, 0, 6, () => pair({ x: 0, z: 0, holding: true }, {}));
  const offSite = s.phase === "live" && !s.work;
  run(s, 6, 6, () => pair({ x: -12, z: -13, holding: false }, {}));
  check("holding off a site, or standing on one without holding, plants nothing", offSite && s.phase === "live" && !s.work);
  // three seconds, let go, three more: still not planted (it starts over)
  let t = run(s, 12, 3, () => pair({ x: -12, z: -13, holding: true }, {})).t;
  t = run(s, t, 0.2, () => pair({ x: -12, z: -13, holding: false }, {})).t;
  run(s, t, 3, () => pair({ x: -12, z: -13, holding: true }, {}));
  check("letting go starts the plant over", s.phase === "live");
  const s2 = new Search(0, SITES, 0);
  run(s2, 0, S.plantTime + 1, () => pair({ x: 12, z: 13, holding: true }, { holding: true, x: 12, z: 13 }));
  check("only an attacker plants (a defender holding on the site does not), on site B too", s2.phase === "planted" && s2.bomb?.site === 1);
  const s3 = new Search(0, SITES, 1);
  run(s3, 0, S.plantTime + 1, () => pair({ x: -12, z: -13, holding: true }, {}));
  check("with the sides swapped, team A's player cannot plant", s3.phase === "live");
}
{
  // a defuse beside the bomb, and one that starts over
  const s = new Search(0, SITES, 0);
  let t = run(s, 0, S.plantTime + 0.2, () => pair({ x: -12, z: -13, holding: true }, {})).t;
  const beside = { x: -12 + 1, z: -13, holding: true };
  const half = run(s, t, S.defuseTime - 0.5, () => pair({ alive: false }, beside));
  check("a defuse is not done before its time", half.winner === null && s.work?.kind === "defuse");
  t = run(s, half.t, 0.2, () => pair({ alive: false }, { ...beside, holding: false })).t;
  const again = run(s, t, S.defuseTime - 0.5, () => pair({ alive: false }, beside));
  check("letting go of a defuse starts it over", again.winner === null);
  const done = run(s, again.t, 1, () => pair({ alive: false }, beside));
  check(`holding beside the bomb for ${S.defuseTime} s defuses it: the defenders' round, with the attackers already down`, done.winner === 1 && done.events.includes("defused"));
  const far = new Search(0, SITES, 0);
  t = run(far, 0, S.plantTime + 0.2, () => pair({ x: -12, z: -13, holding: true }, {})).t;
  const r = run(far, t, S.defuseTime + 1, () => pair({ x: -12, z: -13 }, { x: -12 + S.defuseReach + 1, z: -13, holding: true }));
  check(`a defuse from further than ${S.defuseReach} m does nothing`, r.winner === null && !far.work);
}
{
  const time = new Search(0, SITES, 0);
  const r = run(time, 0, S.roundTime + 1, () => pair({}, {}));
  check("the clock running out before a plant is the defenders' round", r.winner === 1 && r.events.includes("time") && Math.abs(r.t - S.roundTime) < 0.2);
  const wipe = new Search(0, SITES, 0);
  check("every attacker down before a plant: the defenders' round", run(wipe, 0, 1, () => pair({ alive: false }, {})).winner === 1);
  const wipe2 = new Search(0, SITES, 0);
  check("every defender down: the attackers' round", run(wipe2, 0, 1, () => pair({}, { alive: false })).winner === 0);
  const after = new Search(0, SITES, 0);
  const t = run(after, 0, S.plantTime + 0.2, () => pair({ x: -12, z: -13, holding: true }, {})).t;
  const r2 = run(after, t, 5, () => pair({ alive: false }, {}));
  check("every attacker down after a plant: the round goes on, the bomb still ticking", r2.winner === null && after.phase === "planted");
}
{
  check(`team A attacks the first ${S.swapAt} rounds, team B after`, searchAttackers(1) === 0 && searchAttackers(S.swapAt) === 0 && searchAttackers(S.swapAt + 1) === 1 && searchAttackers(S.swapAt * 2) === 1);
  const gaps = [S.bombTime, 20, 5, 0].map((l) => Search.beepGap(l));
  check("the bomb's beep quickens as it runs down", gaps.every((g, i) => i === 0 || g < gaps[i - 1]) && Math.abs(gaps[0] - S.beepSlow) < 1e-9 && Math.abs(gaps[3] - S.beepFast) < 1e-9, gaps.map((g) => g.toFixed(2)).join(" "));
  // the heir's copy, from a guest's view mid-defuse, finishes it at the same moment
  const host = new Search(0, SITES, 0);
  let t = run(host, 0, S.plantTime + 0.2, () => pair({ x: -12, z: -13, holding: true }, {})).t;
  const beside = pair({ alive: false }, { x: -11, z: -13, holding: true });
  t = run(host, t, 3, () => beside).t;
  const heir = new Search(t, SITES, 0);
  heir.restore({ phase: host.phase, left: host.left(t), site: host.bomb?.site ?? -1, bx: host.bomb?.x ?? 0, bz: host.bomb?.z ?? 0, work: host.work }, t);
  const a = run(host, t, 10, () => beside);
  const b = run(heir, t, 10, () => beside);
  check("a round rebuilt from a guest's view mid-defuse (host migration) finishes it at the same moment", a.winner === 1 && b.winner === 1 && Math.abs(a.t - b.t) < 1e-9);
}

console.log(fails === 0 ? "\nSEARCH PASS" : `\nSEARCH FAIL (${fails})`);
export const searchFails = fails;
if (process.argv[1]?.endsWith("search.ts")) process.exit(fails === 0 ? 0 : 1);
