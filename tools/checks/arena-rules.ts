// The arena modes' rules and how bots fight in them (Milestones 940 to 943, from reviews of both), the real ArenaMode,
// BotMatch and Bot on a fake clock with stub links:
//   - bots are held to THE CENTRE's circle, and to their marks until FIGHT;
//   - a host left alone gets no rematch, where each one paid a win; a rematch starts you at your start, and a solo one has
//     a board; ARMOR's share is kept;
//   - Control counts who is on a zone, not over it, brings nobody back on an enemy or in a box, and tells guests what the
//     host hears;
//   - a beginner is no faster than Easy, and a bot on lost ground goes, whoever it sees and whatever is beside it.
//
// It moves the page's clock and needs the game named, so it runs in a process of its own:
// GAME=speedkills npx tsx tools/checks/arena-rules.ts (verify runs it that way).
import * as THREE from "three";
import { readFileSync } from "node:fs";

let fails = 0;
function check(label: string, cond: boolean, detail = ""): void {
  if (!cond) fails++;
  console.log(`${cond ? "  ok  " : "FAIL  "}${label}${detail ? ` (${detail})` : ""}`);
}

// the game's wall clock is performance.now(): ours to step, before anything reads it
let clock = 1000;
Object.defineProperty(performance, "now", { value: () => clock * 1000, configurable: true, writable: true });
const g = globalThis as unknown as Record<string, unknown>;
if (!("document" in g)) g.document = { createElement: () => ({ width: 0, height: 0, getContext: () => ({ createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }), putImageData: () => undefined }) }) };
const warn = console.warn;
console.warn = (...a: unknown[]) => void (String(a[0]).includes("Unable to serialize Texture") ? undefined : warn(...a));

const { ArenaMode } = await import("../../src/game/modematch");
const { BotMatch, tierSpeed, Bot, DIFFICULTY } = await import("../../src/game/bots");
const { RANGE_SOLIDS } = await import("../../src/game/range");
const { MODES } = await import("../../src/game/modes");

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;
const projectiles = { addDummy: () => undefined, removeDummy: () => undefined, fire: () => undefined } as never;
const scene = new THREE.Scene();
const local = (over: Record<string, unknown> = {}): Any => ({ x: 0, y: 0, z: 500, yaw: 0, pitch: 0, crouch: false, weapon: "vinson", operator: "", name: "HOST", ready: true, stance: "stand", speed: 0, ads: 0, act: 0, ...over });
class Wire {
  q: Array<() => void> = [];
  pair(): [Any, Any] {
    const end = (role: string): Any => ({ role, closed: false, onMessage: null, onClose: null, close() { this.send({ t: "bye" }); this.closed = true; }, abandon() { this.closed = true; } });
    const a = end("host");
    const b = end("guest");
    const way = (to: Any) => (m: unknown): void => {
      const c = structuredClone(m);
      this.q.push(() => {
        if (!to.closed) to.onMessage?.(c);
      });
    };
    a.send = a.sendFast = way(b);
    b.send = b.sendFast = way(a);
    return [a, b];
  }
  pump(): void {
    while (this.q.length) (this.q.shift() as () => void)();
  }
}
function run(steps: Array<{ d: Any; l: () => Any }>, seconds: number, wire?: Wire, dt = 1 / 30): void {
  const n = Math.round(seconds / dt);
  for (let i = 0; i < n; i++) {
    clock += dt;
    for (const s of steps) s.d.update(s.l());
    wire?.pump();
  }
}
const solo = (kind: string, bots = 3): Any => {
  const d: Any = new ArenaMode(scene, projectiles, { players: 1, myId: 0, link: null, kind, bots, difficulty: "normal", botWeapon: "vinson", map: null } as never);
  d.holdFire = true;
  return d;
};

console.log("Bots in the arena (src/game/modematch.ts, src/game/bots.ts)");
for (const kind of ["ffa", "tdm", "control"]) {
  const d = solo(kind);
  const off = d.bots.filter((b: Any) => !b.bot.ring).length;
  check(`${kind}: every bot held to THE CENTRE's circle, as a player is`, d.bots.length > 0 && off === 0, `${off} of ${d.bots.length} free of it`);
}
{
  const d: Any = new BotMatch(scene, projectiles, "normal", 3, "yard");
  d.holdFire = true;
  const at = d.bots.map((b: Any) => b.pos.clone());
  const l = local({ held: true, x: d.center.x, z: d.center.z + 30 });
  run([{ d, l: () => l }], 2.5);
  const stay = Math.max(...d.bots.map((b: Any, i: number) => b.pos.distanceTo(at[i])));
  check("under the first countdown, the card held on it, the bots stand at their marks", d.phase === "countdown" && stay < 0.01, `${stay.toFixed(2)} m walked`);
}

console.log("\nA match's end (src/game/modematch.ts)");
{
  const w = new Wire();
  const [h, gl] = w.pair();
  const d: Any = new ArenaMode(scene, projectiles, { players: 2, myId: 0, link: h, guestId: 1, kind: "ffa", bots: 0, difficulty: "normal", map: null } as never);
  const gd: Any = new ArenaMode(scene, projectiles, { players: 2, myId: 1, link: gl, kind: "ffa", bots: 0, difficulty: "normal", map: null } as never);
  const ends: Any[] = [];
  let left = "";
  d.onMatchEnd = (s: Any) => ends.push(s);
  d.onEnd = (r: string) => (left = r);
  run([{ d, l: () => local() }, { d: gd, l: () => local({ name: "G", x: 5 }) }], 5, w);
  gd.leave();
  w.pump();
  run([{ d, l: () => local() }], 40, w);
  check("a host left alone is not paid a win every rematch", ends.length <= 1, `${ends.length} match ends`);
  check("and the match is over, with a word why", /Nobody/.test(left), left || "still running");
}
{
  const d = solo("ffa");
  const seen: Any[] = [];
  run([{ d, l: () => local() }], 5);
  d.onRespawn = () => seen.push(d.spawn);
  d.respawnMe();
  d.respawn();
  const start = d.startSpawn(0, d.teamFor(0));
  check("a rematch starts you at your start, not where you last came back", seen.length === 2 && Math.hypot(seen[1].x - start.x, seen[1].z - start.z) < 0.01, JSON.stringify({ at: seen[1], start }));
  d.board.clear();
  d.sendMode(clock);
  check("a solo rematch has everyone on its board", d.board.rows.size === d.bots.length + 1, `${d.board.rows.size} rows`);
}
{
  const w = new Wire();
  const [h, gl] = w.pair();
  const d: Any = new ArenaMode(scene, projectiles, { players: 2, myId: 0, link: h, guestId: 1, kind: "ffa", bots: 0, difficulty: "normal", map: null } as never);
  const gd: Any = new ArenaMode(scene, projectiles, { players: 2, myId: 1, link: gl, kind: "ffa", bots: 0, difficulty: "normal", map: null } as never);
  run([{ d, l: () => local() }, { d: gd, l: () => local({ name: "G", x: 5 }) }], 5, w);
  const r = d.remotes.get(1);
  const before = r.health + r.shield;
  d.localHit(r, 100, false, "vinson", 5, 25);
  check("ARMOR's share is kept: a hit of 100 felt as 25 takes 25", before - (r.health + r.shield) === 25, `${before - (r.health + r.shield)} taken`);
}

console.log("\nControl (src/game/modematch.ts)");
{
  const d = solo("control");
  const zone = d.layout.zones[0];
  const at = { x: zone[1] + d.layout.ox, z: zone[2] + d.layout.oz };
  run([{ d, l: () => local({ ...at, y: 3.5 }) }], 4);
  const deck = d.onZones?.()[0].alive;
  run([{ d, l: () => local({ ...at, y: 0 }) }], 0.5);
  check("up on the Sky Ring's deck over a zone is not on it; on the street is", deck === false && d.onZones?.()[0].alive === true, JSON.stringify({ deck }));
  d.control.zones[0].owner = 0;
  d.control.zones[0].v = -0.6;
  const foe = d.bots.find((b: Any) => b.team === 1);
  foe.bot.pos.set(at.x, 0, at.z);
  let near = Infinity;
  for (let i = 0; i < 100; i++) {
    const s = d.respawnSpawn(0);
    near = Math.min(near, Math.hypot(s.x - at.x, s.z - at.z));
  }
  check("nobody comes back on a zone with the other team on it", near > MODES.control.radius, `${near.toFixed(1)} m at the nearest`);
  foe.bot.pos.set(at.x + 200, 0, at.z);
  // a box filling most of the ground beside the zone
  const box = { minX: at.x + 0.4, maxX: at.x + 6, minZ: at.z - 6, maxZ: at.z + 6, base: 0, top: 3 };
  RANGE_SOLIDS.push(box as never);
  let boxed = 0;
  for (let i = 0; i < 100; i++) {
    const s = d.respawnSpawn(0);
    if (s.x > box.minX && s.x < box.maxX && s.z > box.minZ && s.z < box.maxZ) boxed++;
  }
  RANGE_SOLIDS.pop();
  check("and a body comes back by a zone in the clear, not in a box", boxed === 0, `${boxed} of 100 in the box`);
}
{
  const w = new Wire();
  const [h, gl] = w.pair();
  const d: Any = new ArenaMode(scene, projectiles, { players: 2, myId: 0, link: h, guestId: 1, kind: "control", bots: 0, difficulty: "normal", map: null } as never);
  const gd: Any = new ArenaMode(scene, projectiles, { players: 2, myId: 1, link: gl, kind: "control", bots: 0, difficulty: "normal", map: null } as never);
  const said: string[] = [];
  gd.onNotice = (s: string) => said.push(s);
  run([{ d, l: () => local() }, { d: gd, l: () => local({ name: "G", x: 5 }) }], 5, w);
  if (d.control) {
    d.sendMode(clock, ["taken A 0"]);
    w.pump();
  }
  check("a guest gets Control's notices", said.some((s) => /ZONE A (TAKEN|LOST)/.test(s)), JSON.stringify(said.slice(-3)));
}

console.log("\nHow bots go (src/game/bots.ts, src/game/brmatch.ts)");
check("a beginner is no faster than Easy", tierSpeed("beginner") <= tierSpeed("easy"), `${tierSpeed("beginner").toFixed(2)} and ${tierSpeed("easy").toFixed(2)} m/s`);
{
  RANGE_SOLIDS.length = 0;
  const b: Any = new Bot(0, scene, projectiles, DIFFICULTY.beginner, { x: 0, z: 0, yaw: 0 });
  const safe = new THREE.Vector3(-15, 0, 0);
  const enemy = new THREE.Vector3(0, 0, -30);
  let t = clock;
  for (let i = 0; i < 90; i++) {
    t += 1 / 30;
    b.update(t, 1 / 30, { target: enemy, targetId: 0, goal: safe, canShoot: false, urgent: true });
  }
  const left = Math.hypot(b.pos.x - safe.x, b.pos.z - safe.z);
  check("on lost ground, a bot goes for safe ground with an enemy in sight", left < 3, `${left.toFixed(1)} m from it after 3 s`);
}
{
  const read = (f: string): string => readFileSync(new URL(`../../src/game/${f}`, import.meta.url), "utf8");
  const br = read("brmatch.ts");
  const bots = read("bots.ts");
  check("crouching counts against the bots of a 1v1 and the Gulag", /hitsBody\(s\.from, s\.dir, feet, local\.crouch \? CROUCH_TOP : BODY_TOP\)/.test(bots) && /hitsBody\(s\.from, s\.dir, feet, local\.crouch \? CROUCH_TOP : BODY_TOP\)/.test(br));
  check("bots do not fight a dropped friend's held figure, or take the zone by it", /unseen\(r\.id\) \|\| this\.held\.has\(r\.id\)/.test(br) && /!r\.alive \|\| this\.held\.has\(r\.id\)\) continue;\s+const last = r\.samples\[r\.samples\.length - 1\];\s+if \(last && inside/.test(br));
  check("nobody in the sky is a target", /if \(last && !inSky\(last\.stance, last\.y\)\) humans\.push/.test(br) && /!inSky\(local\.stance, local\.y\)\) humans\.push/.test(br));
  check("the Gulag's bot does not see through INVISIBILITY", /const sees = this\.alive && bot\.alive && !hidden && bot\.sees\(feet\)/.test(br));
}

{
  // (Milestone 947) a friend gone before the host starts, a seat left empty
  const w = new Wire();
  const [h, gl] = w.pair();
  const [h2] = w.pair();
  const short = (kind: string, split: boolean): Any => {
    const d: Any = new ArenaMode(scene, projectiles, { players: 4, myId: 0, link: h, guestId: 2, kind, bots: 2, difficulty: "normal", split, map: null } as never);
    d.addGuest(h2, 3);
    d.startNow();
    return d;
  };
  void gl;
  const tdm = short("tdm", true);
  check("friends split, a seat empty: still on two sides", tdm.teamFor(0) !== tdm.teamFor(2), `${tdm.teamFor(0)} and ${tdm.teamFor(2)}`);
  const ffa = short("ffa", false);
  const a = ffa.startSpawn(3, 0);
  const b = ffa.startSpawn(100, 0);
  check("and in a free-for-all the last friend and the first bot do not start as one", Math.hypot(a.x - b.x, a.z - b.z) > 1, `${Math.hypot(a.x - b.x, a.z - b.z).toFixed(1)} m apart`);
}
{
  // (Milestone 946) a gun's level through a bot, and what a won or lost Gulag leaves
  const { BotLooter } = await import("../../src/game/bots");
  const l: Any = new (BotLooter as Any)();
  check("a level 5 gun is worth its level to a bot", l.wants({ kind: "weapon", id: "r97", rarity: "legendary", fusion: 5 }) && (l.put({ kind: "weapon", id: "r97", rarity: "legendary", fusion: 5 }), l.kit.gun === 6), `rank ${l.kit.gun}`);
  const br = readFileSync(new URL("../../src/game/brmatch.ts", import.meta.url), "utf8");
  const main = readFileSync(new URL("../../src/main.ts", import.meta.url), "utf8");
  check("a lost Gulag puts your ghost by your squad", /this\.onGulagLost\?\.\(at\)/.test(br) && /d\.onGulagLost = /.test(main));
  check("a won Gulag does not hear the match's opening again", /if \(!d\.backFromGulag\) hud\.notice\(`DROPPING INTO/.test(main));
}

console.log(fails === 0 ? "\nARENA RULES PASS" : `\nARENA RULES FAIL (${fails})`);
process.exit(fails === 0 ? 0 : 1);
