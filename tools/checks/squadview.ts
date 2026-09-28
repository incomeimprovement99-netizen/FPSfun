// The squad you can see (Phase 27, src/game/squadview.ts): every screen in a
// squad giving each member the same number and colour, a teammate's state
// from what their packets say, the news when it changes, their health heard
// going up as well as down, and the life stage on the wire (state.ts `lf`).
// The panel, the names over them and the rings are drawn by hud.ts and
// outline.ts, and the e2e sksquad section plays them with two real pages.
//
// Run on its own: npx tsx tools/checks/squadview.ts.
import announcerCfg from "../../src/config/announcer.json";
import netCfg from "../../src/config/net.json";
import squadCfg from "../../src/config/squad.json";
import { applyDiff, dequantise, diff, quantise, stateMsg, stateOf, wholeQuant, type PlayerState } from "../../src/net/state";
import { heardVital, LIFE_WIRE, mateLife, mateNews, slotColor, squadSlots, SquadWatch, type MateFacts, type MateLife, type MateNow } from "../../src/game/squadview";

let fails = 0;
function check(label: string, cond: boolean, detail = ""): void {
  if (!cond) fails++;
  console.log(`${cond ? "  ok  " : "FAIL  "}${label}${detail ? ` (${detail})` : ""}`);
}

/** a colour's hue in degrees */
function hue(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const d = max - Math.min(r, g, b);
  if (d === 0) return 0;
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return (h * 60 + 360) % 360;
}
const hueGap = (a: number, b: number): number => Math.min(Math.abs(a - b), 360 - Math.abs(a - b));
/** an sRGB channel in linear light, as the renderer blooms it */
const linear = (c: number): number => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);

console.log("The squad's numbers and colours");
{
  const a = squadSlots([4, 1, 0]);
  check("numbered from 1 in player id order", a.get(0) === 1 && a.get(1) === 2 && a.get(4) === 3, JSON.stringify([...a]));
  const b = squadSlots([1, 4, 0, 1]);
  check("two screens that heard the same ids in another order agree", [0, 1, 4].every((id) => a.get(id) === b.get(id)));
  check("an id heard twice takes one number", b.size === 3);
  const names = [1, 2, 3, 4].map((s) => slotColor(s).name);
  check("the owner's colours in the owner's order: blue, green, orange, white", names.join() === "BLUE,GREEN,ORANGE,WHITE", names.join());
  check("a fifth goes round to blue again", slotColor(5).name === "BLUE");
  const hexes = squadCfg.colors.map((c) => c.hex);
  check("four different colours", new Set(hexes).size === 4);
  // the enemy red of the aim outline and the enemy trails (speedkills.json feel.outline, hud.json trails)
  const red = hue("#ff2a3a");
  const near = Math.min(...hexes.filter((h) => h !== "#eef2f6").map((h) => hueGap(hue(h), red)));
  check("none reads as the enemy's red: at least 30 degrees of hue away", near >= 30, `${near.toFixed(0)} degrees`);
  const w = parseInt(slotColor(4).hex.slice(1), 16);
  const lum = 0.2126 * linear(((w >> 16) & 255) / 255) + 0.7152 * linear(((w >> 8) & 255) / 255) + 0.0722 * linear((w & 255) / 255);
  check("the white's outline stays under the bloom's threshold (0.95), so it does not glow", lum < 0.95, lum.toFixed(3));
  const sw = new SquadWatch();
  sw.members([0, 2]);
  const before = [sw.slotOf(0), sw.slotOf(2)];
  sw.members([0, 2, 5]);
  check("a member heard later is numbered after, and nobody's number moves", sw.slotOf(0) === before[0] && sw.slotOf(2) === before[1] && sw.slotOf(5) === 3);
  sw.members([0]);
  check("and one who has gone keeps theirs", sw.slotOf(5) === 3 && sw.squad);
  const solo = new SquadWatch();
  solo.members([3]);
  check("a squad of one has nothing to show", !solo.squad);
}

console.log("\nA teammate's state");
{
  const up: MateFacts = { alive: true, downed: false, gulag: false, quietFor: 0, gone: false };
  const cases: Array<[string, MateFacts, MateLife]> = [
    ["up, saying nothing", up, "up"],
    ["on the way to the Gulag or in it (lf 1)", { ...up, alive: false, lf: LIFE_WIRE.gulag }, "gulag"],
    ["in the Gulag's room, where their packets say alive (lf 1)", { ...up, lf: LIFE_WIRE.gulag }, "gulag"],
    ["in the Gulag by their effect alone (a build that sends no lf)", { ...up, alive: false, gulag: true }, "gulag"],
    ["a ghost (lf 2)", { ...up, alive: false, lf: LIFE_WIRE.ghost }, "ghost"],
    ["out (lf 3)", { ...up, alive: false, lf: LIFE_WIRE.out }, "out"],
    ["dead, saying nothing (a build from before)", { ...up, alive: false }, "out"],
    ["waiting to redeploy (lf 4)", { ...up, alive: false, lf: LIFE_WIRE.redeploy }, "redeploy"],
    ["knocked down (the legacy game)", { ...up, downed: true }, "down"],
    [`silent past ${squadCfg.mates.quiet} s`, { ...up, quietFor: squadCfg.mates.quiet + 0.1 }, "quiet"],
    ["silent, but only for a keyframe's gap across the relay (5 s)", { ...up, quietFor: 5 }, "up"],
    ["a ghost gone silent", { ...up, alive: false, lf: LIFE_WIRE.ghost, quietFor: 30 }, "quiet"],
    ["out and silent: still out", { ...up, alive: false, lf: LIFE_WIRE.out, quietFor: 30 }, "out"],
    ["gone from the match", { ...up, gone: true }, "left"],
  ];
  for (const [label, f, want] of cases) {
    const got = mateLife(f);
    check(`${label}: ${want}`, got === want, got);
  }
  const quietMin = 2 * netCfg.keyframe.seconds * (1 + netCfg.keyframe.spread);
  check("the silence allowed is longer than a keyframe's longest gap across the host's relay", squadCfg.mates.quiet > quietMin, `${squadCfg.mates.quiet} s against ${quietMin} s`);
}

console.log("\nThe news");
{
  const say = (was: MateLife, now: MateLife) => mateNews("Ana", was, now);
  const cues = new Set(Object.keys(announcerCfg.lines));
  const all: MateLife[] = ["up", "down", "gulag", "ghost", "out", "redeploy", "quiet", "left"];
  let unsaid = 0;
  for (const a of all) for (const b of all) {
    const n = mateNews("Ana", a, b);
    if (n?.cue && !cues.has(n.cue)) unsaid++;
  }
  check("every word the news says is an announcer line", unsaid === 0);
  check("no change, no news", all.every((l) => say(l, l) === null));
  const g = say("up", "gulag");
  check("to the Gulag: the feed and the middle of the screen say so", !!g && /Gulag/.test(g.feed) && /GULAG/.test(g.notice ?? ""), g?.notice);
  check("but not the announcer, which the death itself already had say it", !g?.cue);
  const won = say("gulag", "up");
  check("the Gulag won: dropping back in, and said aloud", /WON THE GULAG/.test(won?.notice ?? "") && won?.cue === "mateBack", won?.notice);
  const lost = say("gulag", "ghost");
  check("the Gulag lost, a ghost: where to restore them", /LOST THE GULAG/.test(lost?.notice ?? "") && /RESTORE/.test(lost?.notice ?? ""), lost?.notice);
  const ghost = say("up", "ghost");
  check("down to a ghost: restore them at their echo", /RESTORE THEM AT THEIR ECHO/.test(ghost?.notice ?? ""), ghost?.notice);
  const back = say("ghost", "up");
  check("restored: back in the fight, said aloud", /BACK/.test(back?.notice ?? "") && back?.cue === "mateBack", back?.notice);
  check("out: said aloud", say("ghost", "out")?.cue === "mateOut" && say("gulag", "out")?.cue === "mateOut");
  check("the connection lost, and back", say("up", "quiet")?.cue === "mateLost" && /back/.test(say("quiet", "up")?.feed ?? ""));
  check("left the match", /LEFT/.test(say("up", "left")?.notice ?? ""));

  const sw = new SquadWatch();
  sw.members([0, 1]);
  const mate = (facts: Partial<MateFacts>): MateNow => ({ id: 1, name: "Ana", facts: { alive: true, downed: false, gulag: false, quietFor: 0, gone: false, ...facts }, health: 100, healthMax: 100, shield: 50, shieldMax: 50, dist: 10, talking: false });
  const first = sw.step([mate({ alive: false, lf: LIFE_WIRE.ghost })], 0);
  check("a teammate first seen already a ghost: no news (opening on it is not news)", first.news.length === 0 && first.rows[0]?.life === "ghost");
  const again = sw.step([mate({ alive: false, lf: LIFE_WIRE.ghost })], 0.1);
  check("the same state the next frame: none", again.news.length === 0);
  const restored = sw.step([mate({})], 0.2);
  check("restored: one piece of news, for them", restored.news.length === 1 && restored.news[0].id === 1 && restored.news[0].cue === "mateBack");
  check("their row has their number and colour", restored.rows[0]?.slot === 2 && restored.rows[0]?.color === slotColor(2).hex);
}

console.log("\nTheir numbers, heard");
{
  const T = netCfg.hitTrust;
  check("just after our hit, a packet from before it cannot undo it", heardVital(40, 60, 0.2) === 40);
  check("just after our hit, a packet can still lower it further", heardVital(40, 30, 0.2) === 30);
  check(`${T} s on, their word goes up too: a regeneration or a heal is seen`, heardVital(40, 70, T + 0.01) === 70);
  check("never hit by us: their word from the first packet (a teammate)", heardVital(40, 90, Infinity) === 90);
}

console.log("\nA hit on their row");
{
  const sw = new SquadWatch();
  sw.members([0, 1]);
  const at = (health: number, shield: number, t: number) => sw.step([{ id: 1, name: "Ana", facts: { alive: true, downed: false, gulag: false, quietFor: 0, gone: false }, health, healthMax: 100, shield, shieldMax: 50, dist: 5, talking: false }], t).rows[0];
  at(100, 50, 0);
  const hit = at(100, 20, 1);
  check("a hit flashes the row", hit.hurtK === 1);
  check("and the shield it took off still shows, fading", hit.chipShield === 50 && hit.chipK === 1);
  const burst = at(80, 0, 1.2);
  check("a burst's next hit keeps the chip where the first began", burst.chipShield === 50 && burst.chipHealth === 100);
  const later = at(80, 0, 1.2 + squadCfg.mates.chip + 0.05);
  check("after the chip's time the bars are what they are", later.chipShield === 0 && later.chipHealth === 80 && later.chipK === 0);
  check("and the flash is over", later.hurtK === 0);
  const healed = at(95, 0, 3);
  check("a heal does not flash", healed.hurtK === 0);
}

console.log("\nOn the wire");
{
  const base: PlayerState = { x: 1, y: 2, z: 3, yaw: 10, pitch: 0, crouch: false, w: "r97", hp: 100, sh: 50, alive: true, op: "a", name: "Ana" };
  const q = quantise({ ...base, lf: LIFE_WIRE.ghost });
  check("the life stage goes on the wire", q.lf === LIFE_WIRE.ghost && dequantise(q).lf === LIFE_WIRE.ghost);
  check("up is nothing on the wire", !("lf" in quantise(base)) && dequantise(quantise(base)).lf === undefined);
  const { d, c } = diff(quantise(base), q);
  const got = applyDiff(quantise(base), d, c);
  check("a difference carries it", got?.lf === LIFE_WIRE.ghost);
  const back = diff(q, quantise(base));
  const cleared = applyDiff(q, back.d, back.c);
  check("and clears it when they are back up", !!cleared && !("lf" in cleared));
  // the older keys' clear bits are where an older build reads them: lk, the last of them, is still bit 9
  const lk = diff(quantise({ ...base, lk: "x" }), quantise(base));
  check("the new key went on the end: the older keys' mask bits have not moved", lk.c === 1 << 9, String(lk.c));
  check("the whole-packet test takes it as a number", wholeQuant({ ...q }) && !wholeQuant({ ...q, lf: "ghost" }));
  check("a full packet keeps it (what an older peer is sent and a decoded part becomes)", stateOf(stateMsg({ ...base, lf: LIFE_WIRE.out })).lf === LIFE_WIRE.out);
}

console.log(fails === 0 ? "\nSQUAD VIEW PASS" : `\nSQUAD VIEW FAIL (${fails})`);
export const squadViewFails = fails;
if (process.argv[1]?.endsWith("squadview.ts")) process.exit(fails === 0 ? 0 : 1);
