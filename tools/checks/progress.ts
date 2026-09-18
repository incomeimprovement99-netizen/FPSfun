// XP, the account level and the challenges (src/game/progress.ts,
// src/config/progress.json).
//
// Run on its own: npx tsx tools/checks/progress.ts. Also runs inside npm run verify.
import cfg from "../../src/config/progress.json";
import { CHALLENGES, Progress, levelCost, levelFor, xpFor } from "../../src/game/progress";
import type { MatchSummary } from "../../src/game/stats";

let fails = 0;
function check(label: string, ok: boolean, detail = ""): void {
  if (!ok) fails++;
  console.log(`${ok ? "  ok  " : "FAIL  "}${label}${detail ? ` (${detail})` : ""}`);
}

/** a storage that lives in a plain object, so a check can see what was kept */
function memory(): Pick<Storage, "getItem" | "setItem"> & { data: Record<string, string> } {
  const data: Record<string, string> = {};
  return { data, getItem: (k) => data[k] ?? null, setItem: (k, v) => void (data[k] = v) };
}
const match = (m: Partial<MatchSummary>): MatchSummary => ({ won: false, roundsWon: 0, roundsLost: 0, kills: 0, deaths: 0, damage: 0, shots: 0, hits: 0, ...m });

console.log("\nProgression: XP, levels, challenges");

// what a match pays
const lost = xpFor("duel", match({}));
check("finishing a match at all pays something", lost === cfg.xp.played, `${lost} XP`);
const good = xpFor("duel", match({ won: true, roundsWon: 3, kills: 5, damage: 560 }));
check(
  "a won 1v1 pays for the win, the rounds, the kills and the damage",
  good === cfg.xp.played + cfg.xp.win + 3 * cfg.xp.roundWon + 5 * cfg.xp.kill + 5 * cfg.xp.damagePer100,
  `${good} XP`
);
const brTop = xpFor("br", match({ placement: 2, players: 12, survived: 600, kills: 3, damage: 800 }));
const brMid = xpFor("br", match({ placement: 8, players: 12, survived: 600, kills: 3, damage: 800 }));
const brLow = xpFor("br", match({ placement: 11, players: 12, survived: 600, kills: 3, damage: 800 }));
check("a battle royale pays for placement: top 3 more than top 10, top 10 more than the rest", brTop > brMid && brMid > brLow, `${brTop} / ${brMid} / ${brLow}`);
check("a small lobby's 8th of 9 is not a top-10 finish", xpFor("br", match({ placement: 8, players: 9 })) === xpFor("br", match({ placement: 9, players: 9 })));
check("and third of three squads is not a podium: last is last", xpFor("br", match({ placement: 3, players: 3 })) === xpFor("br", match({ placement: 3, players: 3, survived: 0 })) && xpFor("br", match({ placement: 3, players: 3 })) < xpFor("br", match({ placement: 3, players: 6 })));
const hide = xpFor("br", match({ placement: 11, players: 12, survived: 3600 }));
const capped = xpFor("br", match({ placement: 11, players: 12, survived: cfg.xp.brMinutesCap * 60 }));
check("survival time is capped, so an hour spent hiding pays what fifteen minutes does", hide === capped, `${hide} against ${capped}`);
check("a match cannot pay negative XP whatever it reports", xpFor("duel", match({ kills: -9, damage: -500, roundsWon: -3 })) >= 0);

// levels
check("level 1 to 2 costs the configured first step", levelCost(1) === cfg.levels.first, String(levelCost(1)));
check("each level costs more than the one before", levelCost(10) > levelCost(9) && levelCost(40) > levelCost(39), `${levelCost(9)} -> ${levelCost(10)}`);
check("no XP is level 1 with the first step to go", levelFor(0).level === 1 && levelFor(0).need === cfg.levels.first);
check("exactly the first step is level 2", levelFor(cfg.levels.first).level === 2 && levelFor(cfg.levels.first).into === 0);
let total = 0;
for (let n = 1; n < cfg.levels.cap; n++) total += levelCost(n);
check("the cap stops the count, and asks for nothing more", levelFor(total * 10).level === cfg.levels.cap && levelFor(total * 10).need === 0, `cap ${cfg.levels.cap} at ${total} XP`);
// the pace the config's note promises, held to it: an ordinary match is
// finished, two kills, 300 damage
const ordinary = cfg.xp.played + 2 * cfg.xp.kill + 3 * cfg.xp.damagePer100;
check("a first level is about five ordinary matches", cfg.levels.first / ordinary >= 3 && cfg.levels.first / ordinary <= 8, `${(cfg.levels.first / ordinary).toFixed(1)} matches`);
let to50 = 0;
for (let n = 1; n < 50; n++) to50 += levelCost(n);
check("and level 50 is several hundred, a long season and not a lifetime", to50 / ordinary >= 400 && to50 / ordinary <= 1200, `${Math.round(to50 / ordinary)} matches`);

// challenges
const store = memory();
const p = new Progress(store);
check("three challenges are active from the start", p.challenges.length === cfg.active, p.challenges.map((c) => c.id).join(", "));
check("every challenge in the pool has an id of its own and a goal", new Set(CHALLENGES.map((c) => c.id)).size === CHALLENGES.length && CHALLENGES.every((c) => c.goal > 0 && c.xp > 0));
const first = p.challenges[0];
// feed the first challenge exactly to its goal
const big = match({ kills: 1000, damage: 1e6, hits: 1e5, won: true });
const a = p.award("duel", big);
check("a match that finishes challenges pays their XP on top of its own", a.completed.length > 0 && a.gained === a.match + a.completed.reduce((s, c) => s + c.xp, 0), `${a.match} + ${a.gained - a.match}`);
check("a finished challenge is replaced, and the list stays full", p.challenges.length === cfg.active && !p.challenges.some((c) => c.id === first.id), p.challenges.map((c) => c.id).join(", "));
check("progress on the others is kept, not reset, by a match that finishes one", p.challenges.every((c) => c.got <= c.goal));
check("the level goes up with the XP", a.levelAfter >= a.levelBefore && p.xp === a.gained);
// persistence: a new Progress on the same storage picks up where it was
const again = new Progress(store);
check("it is kept: a reload has the same XP, level and challenges", again.xp === p.xp && again.challenges.map((c) => c.id).join() === p.challenges.map((c) => c.id).join());
// junk in storage is not an error
const junk = memory();
junk.setItem("range.progress.v1", '{"xp":"lots","active":[{"id":"nope","got":5}],"done":-3}');
const j = new Progress(junk);
check("junk in storage starts fresh rather than breaking", j.xp === 0 && j.done === 0 && j.challenges.length === cfg.active && j.challenges.every((c) => CHALLENGES.some((x) => x.id === c.id)));
// a course run
const run = new Progress(memory()).awardRun("S");
check("a course run pays, and a medal pays more", run.match === cfg.xp.courseRun + cfg.xp.courseMedal.S, String(run.match));
check("the config carries its own notes", Boolean(cfg._note && cfg._xp && cfg._levels && cfg._challenges));

console.log(fails === 0 ? "\nPROGRESS PASS" : "\nPROGRESS FAIL (" + fails + ")");
export const progressFails = fails;
if (process.argv[1]?.endsWith("progress.ts")) process.exit(fails === 0 ? 0 : 1);
