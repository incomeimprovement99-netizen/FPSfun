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
// a bot in the replay, and the bot that got you (its own figure would sit on the camera, so the replay builds none)
const BOT = 105;
const KILLER = 106;
const code = botSoldierCode(BOT);
const rec = new Recorder();
const actor = (id: number, t: number, soldier?: string) => ({ id, name: "BOT", x: 0, y: 0, z: -5 - t, yaw: 0, pitch: 0, stance: "stand" as const, speed: 1, weapon: "vinson", op: "vanguard", alive: true, soldier });
// you (id 0, no soldier recorded), a bot and the bot that got you, four seconds of them
for (let t = 0; t < 4; t += 0.05) rec.sample(t, () => [actor(0, t), actor(BOT, t, code), actor(KILLER, t, botSoldierCode(KILLER))]);
const kc = new Killcam(new THREE.Scene(), { fire() {} } as never);
const started = kc.start(rec, 3.5, KILLER, "BOT", 0);
// one figure a frame (killcam.json ghostsAFrame): three frames for the two it shows
for (let i = 0; i < 3; i++) kc.update(3.5 + i / 60, 1 / 60);
const ghosts = (kc as unknown as { ghosts: Map<number, { skin: { soldier?: string } }> }).ghosts;
console.warn = warn;
check("the killcam replays a bot's kill", started && ghosts.has(BOT));
check("and its figure of a bot wears the bot's own soldier, not its operator's look", ghosts.get(BOT)?.skin.soldier === code, `${ghosts.get(BOT)?.skin.soldier} against ${code}`);
check("while a figure with no soldier recorded keeps its operator's", ghosts.has(0) && ghosts.get(0)?.skin.soldier === undefined);
check("and the killer has none: its own figure would sit on the camera", !ghosts.has(KILLER), [...ghosts.keys()].join());

// (Milestone 999) the rounds it fires again, the figures' shaders, and the loot of the replay's moment
console.log("\nThe killcam's rounds, figures and floor");
{
  const { Dummy } = await import("../../src/game/dummy");
  const { ProjectileSystem } = await import("../../src/game/projectile");
  const { resolveWeapon } = await import("../../src/game/weapons");
  const rec2 = new Recorder();
  for (let t = 0; t < 4; t += 0.05) rec2.sample(t, () => [actor(0, t), actor(BOT, t, code), actor(KILLER, t, botSoldierCode(KILLER))], t < 3.5 ? 40 : 46);
  const o = new THREE.Vector3(0, 1.6, -5);
  const d = new THREE.Vector3(0, 0, 1);
  rec2.shot(3.2, KILLER, o, d, "vinson");
  rec2.shot(3.3, 0, o, d, "vinson", true);
  const fired: Array<{ from: THREE.Vector3 | null; firer: { ally?: boolean; replay?: unknown[] } | null }> = [];
  const kc2 = new Killcam(new THREE.Scene(), { fire: (_o: unknown, _d: unknown, _w: unknown, _v: unknown, _s: unknown, _sp: unknown, from: THREE.Vector3 | null, _st: unknown, firer: { ally?: boolean; replay?: unknown[] } | null) => void fired.push({ from, firer }) } as never);
  const muzzle = new THREE.Vector3(0.2, 1.4, -4.5);
  kc2.killerMuzzle = () => muzzle;
  // the figure dressed before its shaders are asked for, and an older figure's finishing not showing a newer one unbuilt
  const order: string[] = [];
  const dressNow = Dummy.prototype.dressNow;
  Dummy.prototype.dressNow = function (this: InstanceType<typeof Dummy>) {
    order.push("dress");
    dressNow.call(this);
  };
  const done: Array<() => void> = [];
  kc2.prepare = () => {
    order.push("prepare");
    return new Promise<void>((r) => done.push(r));
  };
  kc2.start(rec2, 3.5, KILLER, "BOT", 0);
  for (let i = 0; i < 3; i++) kc2.update(3.5 + i / 60, 1 / 60);
  Dummy.prototype.dressNow = dressNow;
  check("a replay figure puts its soldier on before its shaders are compiled (they were compiled on its volumes alone)", order[0] === "dress" && order[1] === "prepare", order.join(" "));
  const ghosts2 = (kc2 as unknown as { ghosts: Map<number, InstanceType<typeof Dummy>>; pending: Set<number> });
  // the victim's figure rebuilt (a new gun): the first one's compile finishing leaves the new one hidden until its own is in
  const first = ghosts2.ghosts.get(0)!;
  (kc2 as unknown as { ghostKey: Map<number, string> }).ghostKey.set(0, "changed");
  kc2.update(3.5 + 3 / 60, 1 / 60);
  const second = ghosts2.ghosts.get(0)!;
  done[0]();
  await new Promise((r) => setTimeout(r, 0));
  kc2.update(3.5 + 4 / 60, 1 / 60);
  check("an older figure's compile finishing does not show the figure built after it before its own is in", first !== second && !second.group.visible && ghosts2.pending.has(0), `shown ${second.group.visible}`);
  for (const r of done) r();
  await new Promise((r) => setTimeout(r, 0));

  // the replay at 3.6 s of the recording (it runs 3.5 s behind the clock here, from the recording's start): both rounds are due
  kc2.update(3.5 + 3.6, 1 / 60);
  kc2.refire();
  const killer = fired.find((f) => f.from === muzzle);
  const mine = fired.find((f) => f.from !== muzzle);
  check("the killer's rounds leave the gun in view, not the eye (on the line of sight a tracer is never seen)", !!killer, `${fired.length} fired`);
  check("your own rounds are drawn in the team's colour, the killer's as an enemy's", mine?.firer?.ally === true && killer?.firer?.ally === false, JSON.stringify(fired.map((f) => f.firer?.ally)));
  check("they stop on the replay's figures, not on the live ones", fired.every((f) => Array.isArray(f.firer?.replay)));
  check("and the replay knows what loot was on the floor at its moment", kc2.lootFrom === 46, `${kc2.lootFrom} at ${kc2.t.toFixed(2)} s`);
  kc2.stop();
  check("with no replay, no loot is hidden", kc2.lootFrom === Infinity);

  // a replayed round marks no second hole, where a round fired the same way by someone else does
  const ps = new ProjectileSystem(new THREE.Scene(), [], []);
  let marks = 0;
  ps.onVisualImpact = () => void marks++;
  const down = new THREE.Vector3(0, -1, 0);
  const w = resolveWeapon("vinson");
  ps.fire(new THREE.Vector3(0, 1, 0), down.clone(), w, true, 1, 1, null, null, { replay: [] });
  for (let i = 0; i < 30; i++) ps.update(1 / 60, i / 60, () => undefined);
  const replayed = marks;
  ps.fire(new THREE.Vector3(0, 1, 0), down.clone(), w, true);
  for (let i = 0; i < 30; i++) ps.update(1 / 60, 1 + i / 60, () => undefined);
  check("a replayed round marks no second hole; someone else's live round does mark its own", replayed === 0 && marks === 1, `${replayed} then ${marks}`);
}

console.log(fails === 0 ? "\nSK KILLCAM PASS" : `\nSK KILLCAM FAIL (${fails})`);
process.exit(fails === 0 ? 0 : 1);
