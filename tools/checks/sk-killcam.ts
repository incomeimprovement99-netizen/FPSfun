// The killcam shows the soldier you saw (Phase 21): a recording of a bot wearing its own soldier (soldier.ts
// botSoldierCode) replayed by the killcam, whose figure of it must wear that soldier, not its operator's look, which
// was all the recording carried before. Needs no paid files: the soldier is read off the figure's look.
//
// Run: GAME=speedkills npx tsx tools/checks/sk-killcam.ts (verify runs it that way).
import * as THREE from "three";

const g = globalThis as unknown as Record<string, unknown>;
const anyProxy = (): unknown =>
  new Proxy(function () {}, {
    get: (_t, k) => (k === "measureText" ? () => ({ width: 10 }) : k === Symbol.toPrimitive ? () => 0 : k === "width" || k === "height" ? 64 : anyProxy()),
    set: () => true,
    apply: () => anyProxy(),
  });
const fakeEl = (): unknown => ({ width: 64, height: 64, style: {}, getContext: () => anyProxy(), addEventListener() {}, removeEventListener() {}, set src(_v: string) {} });
g.document = { createElement: () => fakeEl(), createElementNS: () => fakeEl() };
const warn = console.warn;
console.warn = () => undefined;
const { Killcam, Recorder } = await import("../../src/game/killcam");
const { botSoldierCode } = await import("../../src/game/soldier");

let fails = 0;
function check(label: string, cond: boolean, detail = ""): void {
  if (!cond) fails++;
  console.log(`${cond ? "  ok  " : "FAIL  "}${label}${detail ? ` (${detail})` : ""}`);
}

console.log("\nThe killcam's figures");
const BOT = 105;
const code = botSoldierCode(BOT);
const rec = new Recorder();
const actor = (id: number, t: number, soldier?: string) => ({ id, name: "BOT", x: 0, y: 0, z: -5 - t, yaw: 0, pitch: 0, stance: "stand" as const, speed: 1, weapon: "rspn101", op: "vanguard", alive: true, soldier });
// you (id 0, no soldier recorded) and the bot that got you, four seconds of them
for (let t = 0; t < 4; t += 0.05) rec.sample(t, () => [actor(0, t), actor(BOT, t, code)]);
const kc = new Killcam(new THREE.Scene(), { fire() {} } as never);
const started = kc.start(rec, 3.5, BOT, "BOT");
kc.update(3.5, 1 / 60);
const ghosts = (kc as unknown as { ghosts: Map<number, { skin: { soldier?: string } }> }).ghosts;
console.warn = warn;
check("the killcam replays a bot's kill", started && ghosts.has(BOT));
check("and its figure of the bot wears the bot's own soldier, not its operator's look", ghosts.get(BOT)?.skin.soldier === code, `${ghosts.get(BOT)?.skin.soldier} against ${code}`);
check("while a figure with no soldier recorded keeps its operator's", ghosts.get(0)?.skin.soldier === undefined);

console.log(fails === 0 ? "\nSK KILLCAM PASS" : `\nSK KILLCAM FAIL (${fails})`);
process.exit(fails === 0 ? 0 : 1);
