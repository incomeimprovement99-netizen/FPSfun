// The ping wheel (src/game/brplay.ts PING_INTENTS, src/config/squad.json
// `pingWheel`): a tap of the ping key marks what you are looking at, and
// holding it opens a wheel of what the mark MEANS.
//
// What has to hold: the wheel is what a squad without voice needs said (going,
// attacking, watching, an enemy, ammo, defending), the direction the mouse
// points picks exactly one of them and the deadzone in the middle picks none,
// every intent has a life of its own, and a plan outlives a warning, because a
// warning is about this second and a plan about the next minute.
//
// Run on its own: npx tsx tools/checks/pingwheel.ts.
import { PING_INTENTS, pingPickAt } from "../../src/game/brplay";
import squad from "../../src/config/squad.json";

let fails = 0;
function check(label: string, cond: boolean, detail = ""): void {
  if (!cond) fails++;
  console.log(`${cond ? "  ok  " : "FAIL  "}${label}${detail ? ` (${detail})` : ""}`);
}

console.log("The ping wheel");
{
  const ids = PING_INTENTS.map((x) => x.id);
  check("the wheel says the things a squad without voice has to say", ids.length === 6 && ["go", "attack", "watch", "enemy", "ammo", "defend"].every((x) => ids.includes(x as never)), ids.join(", "));
  check("each of them says it in words, not in a symbol nobody learns", PING_INTENTS.every((x) => /^[A-Z ]{5,20}$/.test(x.label)), PING_INTENTS.map((x) => x.label).join(" / "));
  check("and each lands as a marker the game already draws", PING_INTENTS.every((x) => x.marker === "enemy" || x.marker === "loot" || x.marker === "go"));
}
{
  // the wheel's geometry: up is the first, then clockwise
  check("pointing up picks the first of them", pingPickAt(0, -100) === 0, PING_INTENTS[0].label);
  check("pointing right picks a quarter of the way round", pingPickAt(100, 0) === Math.round(PING_INTENTS.length / 4), PING_INTENTS[Math.round(PING_INTENTS.length / 4)].label);
  check("pointing down picks the one opposite the first", pingPickAt(0, 100) === PING_INTENTS.length / 2, PING_INTENTS[PING_INTENTS.length / 2].label);
  check("and the middle picks nothing, so a hold that never moves marks nothing", pingPickAt(0, 0) === null && pingPickAt(20, 20) === null);
  const picked = new Set<number>();
  for (let deg = 0; deg < 360; deg += 3) {
    const a = (deg * Math.PI) / 180;
    const p = pingPickAt(Math.sin(a) * 100, -Math.cos(a) * 100);
    if (p !== null) picked.add(p);
  }
  check("every slice of the wheel can be picked, and none of them twice over", picked.size === PING_INTENTS.length, `${picked.size} of ${PING_INTENTS.length}`);
}
{
  const life = squad.pingWheel.life as Record<string, number>;
  check("every intent has a life of its own", PING_INTENTS.every((x) => typeof life[x.id] === "number" && life[x.id] > 0), Object.entries(life).map(([k, v]) => `${k} ${v}s`).join(", "));
  check("a plan outlives a warning: defending stays up longer than an enemy call", life.defend > life.enemy && life.go > life.enemy, `${life.defend} s against ${life.enemy} s`);
  check("and nothing stays up so long that the map fills with old marks", Math.max(...Object.values(life)) <= 30, `${Math.max(...Object.values(life))} s at the longest`);
  check("the wheel opens on a hold rather than a tap", squad.pingWheel.openAfter >= 0.1 && squad.pingWheel.openAfter <= 0.35, `${squad.pingWheel.openAfter} s`);
}

console.log(fails === 0 ? "\nPING WHEEL PASS" : `\nPING WHEEL FAIL (${fails})`);
export const pingWheelFails = fails;
if (process.argv[1]?.endsWith("pingwheel.ts")) process.exit(fails === 0 ? 0 : 1);
