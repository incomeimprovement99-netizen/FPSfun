// The callouts and the announcer (src/game/announcer.ts): which change in a
// match calls for which line, and that the lines themselves are sayable.
//
// That the lines are said in a real match (the drop, a knock, a finish) and
// that the drop theme comes on aboard the ship and goes off on landing is the
// e2e's (the br and botsquads sections).
//
// Run on its own: npx tsx tools/checks/announcer.ts.
import { cues, wordsFor, type Watch, type Line } from "../../src/game/announcer";
import CFG from "../../src/config/announcer.json";

let fails = 0;
function check(label: string, cond: boolean, detail = ""): void {
  if (!cond) fails++;
  console.log(`${cond ? "  ok  " : "FAIL  "}${label}${detail ? ` (${detail})` : ""}`);
}

console.log("The announcer");
{
  const base: Watch = { dropping: false, ringPhase: 1, ringPhases: 5, closing: false, outside: false, squads: 8, team: 3, placement: null };
  const w = (o: Partial<Watch>): Watch => ({ ...base, ...o });
  const same = (a: Line[], b: Line[]) => JSON.stringify(a) === JSON.stringify(b);
  check("the first frame on the ship says the drop, and nothing else", same(cues(null, w({ dropping: true })), ["drop"]));
  check("the first frame on the ground says nothing: how a match starts is not news", same(cues(null, base), []));
  check("nothing changed, nothing said", same(cues(base, base), []));
  check("the ring starting to close is said", same(cues(base, w({ closing: true })), ["ringClosing"]));
  check("the last ring closing is the final ring", same(cues(w({ ringPhase: 5 }), w({ ringPhase: 5, closing: true })), ["finalRing"]));
  check("still closing the next frame is not said again", same(cues(w({ closing: true }), w({ closing: true })), []));
  check("stepping outside the ring is said, but not while dropping into it", same(cues(base, w({ outside: true })), ["outside"]) && same(cues(w({ dropping: true }), w({ dropping: true, outside: true })), []));
  check("down to three squads, then two, each said once", same(cues(w({ squads: 4 }), w({ squads: 3 })), ["squads3"]) && same(cues(w({ squads: 3 }), w({ squads: 2 })), ["squads2"]) && same(cues(w({ squads: 5 }), w({ squads: 4 })), []));
  check("in solo the count is not said: it is everyone", same(cues(w({ team: 1, squads: 4 }), w({ team: 1, squads: 3 })), []));
  check("the end says the win or the loss, once", same(cues(base, w({ placement: 1 })), ["won"]) && same(cues(base, w({ placement: 4 })), ["lost"]) && same(cues(w({ placement: 4 }), w({ placement: 4 })), []));
  check("two things at once are both said, in order", same(cues(base, w({ closing: true, squads: 3 })), ["ringClosing", "squads3"]));
  // the config: every line said by a voice there is, with words to say, and short enough to be a callout
  const lines = Object.entries(CFG.lines);
  check("every line has a voice there is and something to say", lines.every(([, l]) => l.by in CFG.voices && l.say.length > 0 && l.say.every((s) => s.trim().length > 0)));
  const longest = Math.max(...lines.flatMap(([, l]) => l.say.map((s) => s.split(" ").length)));
  check("every line is a callout, not a speech (at most seven words)", longest <= 7, `${longest} words`);
  check("a spray of knocks is one callout: the knock and kill lines wait at least 2 s", CFG.lines.knock.cooldown >= 2 && CFG.lines.kill.cooldown >= 2);
  check("being down outranks a knock, and the end of the match outranks everything", CFG.lines.down.priority > CFG.lines.knock.priority && lines.every(([k, l]) => k === "won" || k === "lost" || l.priority < CFG.lines.won.priority));
  check("each pick of words comes from the line's own list", lines.every(([k, l]) => [0, 0.5, 0.999].every((r) => l.say.includes(wordsFor(k as Line, r)))));
}

console.log(fails === 0 ? "\nANNOUNCER PASS" : `\nANNOUNCER FAIL (${fails})`);
export const announcerFails = fails;
if (process.argv[1]?.endsWith("announcer.ts")) process.exit(fails === 0 ? 0 : 1);
