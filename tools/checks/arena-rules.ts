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
  const page = readFileSync(new URL("../../src/main.ts", import.meta.url), "utf8");
  // (Milestone 954) what a press does where it cannot go off, and what comes of it
  check("a move hack is refused on a rope, GRAPPLE in a climb or a dive, INVISIBILITY aiming, no cooldown spent", /player\.onZip && moves \? "NOT ON A ROPE"/.test(page) && /"NOT WHILE CLIMBING"/.test(page) && /"NOT WHILE AIMING"/.test(page));
  check("WALL, HEAL and MINE go on what is under them", /const at = restingSpot\(player\.pos\)/.test(page) && /restingSpot\(aimPoint\(H\.mine\.range\)\)/.test(page) && /y: restingSpot\(new THREE\.Vector3\(x, player\.pos\.y, z\)\)\.y/.test(page));
  check("INVISIBILITY ends on a shot since it began, at any frame rate", /lastShotAt >= invisAt/.test(page));
  check("a hack's kill says so as a round's does, and a REVEAL's count stands", /if \(kill\) sayKill\(fig, gameTime\)/.test(page) && /if \(id !== "reveal"\) hud\.notice\(name/.test(page));
  check("THE RUN starts your hacks at their first level", /for \(const h of savedHacks\) hacks\.set\(h\.id, 0\)/.test(page));
  check("a REVEAL against bots has an end", /this\.shownKit\.step\(now\)/.test(bots));
  const play = read("brplay.ts");
  // (Milestones 955 to 957)
  check("the watch camera holds who you chose", /x\.figure === watchFig/.test(page) && /!killcam\.active && input\.pressedNow\("fire"\)/.test(page));
  check("a Gulag loss has a replay", /const room = this\.gulagBot \? \[\{ bot: this\.gulagBot \}\] : \[\]/.test(br));
  check("a restore holds through the guns round the echo, and a mate in the Gulag can be brought out", /this\.hold\?\.kind !== "echo"/.test(play) && /!match\.inGulag\(d\.item\.owner\)/.test(play));
  check("an out-for-good mate's echo stands in nobody's way, and only a ghost is drawn as one", /return Number\.isFinite\(match\.boxLockout\(d\.item\.owner\)\)/.test(play) && /r\.life !== LIFE_WIRE\.ghost/.test(page));
  check("a restore's beam lasts as long as the hold", /this\.deps\.beam\?\.\(at, need \/ rate\)/.test(play));
  check("the city is whole as a match ends, and a bot just down stays down for an heir", /announcer\.clear\(\);\s+\/\/[^\n]*\n\s+\/\/[^\n]*\n\s+cityDecay\(null, gameTime\)/.test(page) && /!row\.al \|\| r\?\.alive === false/.test(br));
  check("the Gulag's bot does not see through INVISIBILITY", /const sees = this\.alive && bot\.alive && !hidden && bot\.sees\(feet\)/.test(br));
}

{
  // (Milestone 950) what a match is worth, and a summary that is not numbers
  const { xpFor } = await import("../../src/game/progress");
  const { cleanSummary } = await import("../../src/game/stats");
  const d = solo("control");
  run([{ d, l: () => local() }], 5);
  d.winner = -10;
  d.control.score = [500, 310];
  d.summarise?.();
  const end = (d.endSummary ?? d.lastSummary ?? null) as Any;
  const win = { won: true, roundsWon: 1, roundsLost: 0, kills: 0, deaths: 0, damage: 0, shots: 0, hits: 0 };
  check("a mode's match pays one round, whatever its score", !end || end.roundsWon <= 1, JSON.stringify(end));
  check("and pays what a 1v1's round does", xpFor("control", win) < 1000, `${xpFor("control", win)} XP`);
  const nan = cleanSummary({ ...win, kills: NaN, damage: Infinity, hits: -3 });
  check("a summary's numbers are counts: no NaN or Infinity reaches a total", nan.kills === 0 && nan.damage === 0 && nan.hits === 0, JSON.stringify(nan));
}
{
  // (Milestone 951) the Gulag's countdown holds your hands as it holds its bot
  const { BrMatch } = await import("../../src/game/brmatch");
  const fire = Object.getOwnPropertyDescriptor(BrMatch.prototype, "canFire")?.get;
  const at = (phase: string): boolean => !!fire?.call(Object.create(BrMatch.prototype, { phase: { value: "fight" }, alive: { value: true }, gulag: { value: { phase } } }));
  check("no gun or hack in the Gulag's countdown; both once it is FIGHT", !at("countdown") && at("fight"), JSON.stringify({ countdown: at("countdown"), fight: at("fight") }));
}
{
  // (Milestone 955) the real Killcam: a replay with so many seconds before you are back
  const { Killcam, Recorder } = await import("../../src/game/killcam");
  const cfg = (await import("../../src/config/killcam.json")).default as { before: number; after: number };
  const rec: Any = new Recorder();
  const frames: Any[] = [];
  for (let t = 0; t <= 10; t += 0.1) frames.push({ t, actors: [{ id: 7, name: "K", x: 0, y: 0, z: 0, yaw: 0, pitch: 0, stance: "stand", speed: 0, weapon: "vinson", op: "vanguard", alive: true }, { id: 0, name: "ME", x: 5, y: 0, z: 0, yaw: 0, pitch: 0, stance: "stand", speed: 0, weapon: "vinson", op: "vanguard", alive: true }], shots: [] });
  rec.frames = frames;
  const k: Any = new Killcam(scene, projectiles);
  const ok = k.start(rec, 8, 7, "K", 0, 3);
  const len = k.endT - k.startT;
  check("a replay with 3 s before you are back ends by then, and reaches the kill", ok && len <= 3 + 1e-6 && k.startT < 8 && k.endT >= 8, JSON.stringify({ start: k.startT, end: k.endT }));
  k.stop();
  const whole = k.start(rec, 8, 7, "K", 0);
  check("and one with all the time in the world is the whole replay", whole && Math.abs(k.endT - k.startT - (cfg.before + cfg.after)) < 1e-6, `${k.endT - k.startT} s`);
  k.killerId = 99;
  k.pose(new THREE.PerspectiveCamera());
  check("a killer gone from the recording ends the replay", !k.active);
  k.stop();
}
{
  // (Milestone 958) the real LootField's settle: what lay on a gone sector comes down, and nothing else moves
  const { LootField } = await import("../../src/game/loot");
  const f: Any = Object.create(LootField.prototype);
  f.drops = new Map([[1, { key: 1, item: {}, pos: new THREE.Vector3(10, 40, 0) }], [2, { key: 2, item: {}, pos: new THREE.Vector3(-10, 40, 0) }]]);
  f.add = (item: unknown, pos: THREE.Vector3, key: number): void => f.drops.set(key, { key, item, pos });
  f.settle((x: number) => x > 0, (p: THREE.Vector3) => new THREE.Vector3(p.x, 3, p.z));
  check("loot on a gone sector comes down to what is under it; elsewhere it stays", f.drops.get(1).pos.y === 3 && f.drops.get(2).pos.y === 40, JSON.stringify([f.drops.get(1).pos.y, f.drops.get(2).pos.y]));
  const src = readFileSync(new URL("../../src/game/brmatch.ts", import.meta.url), "utf8");
  check("a package's items each lie on a clear spot, at the floor's height", /const o = openGround\(p\.at\.x \+ Math\.cos\(i \* 2\.1\) \* 1\.3/.test(src) && /const at = restingSpot\(new THREE\.Vector3\(clear\.x, brCfg\.pod\.stepUp, clear\.z\)\)/.test(src));
  check("a side's capture meter stays through stepping off and a change of host", !/c\.held = 0;/.test(src) && !/this\.capture\.progress\.clear\(\)/.test(src));
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

console.log("\nThe hands and the guns (src/game/loadout.ts, weapon-state.ts, recoil.ts, lootcard.ts)");
{
  const { Loadout } = await import("../../src/game/loadout");
  const { WeaponState } = await import("../../src/game/weapon-state");
  const { resolveWeapon, weaponIds } = await import("../../src/game/weapons");
  const { gunStats } = await import("../../src/game/lootcard");
  const page = readFileSync(new URL("../../src/main.ts", import.meta.url), "utf8");
  const brs = readFileSync(new URL("../../src/game/brmatch.ts", import.meta.url), "utf8");
  // (Milestone 969) one gun, and Q: it stays in your hand
  const one = new Loadout(["vinson", "r97"]);
  one.clearSlot(1);
  check("with one gun Q and the other slot's key do nothing, where they left you on fists", !one.requestNext(100) && !one.requestSwap(1, 100) && !one.active.empty);
  const two = new Loadout(["vinson", "r97"]);
  two.land(1, 100);
  check("a restore lands on the gun held, one raise, no swap", two.activeIndex === 1 && two.display === two.active, `slot ${two.activeIndex}, ${two.swapProgress(100).toFixed(2)} through`);
  check("from fists the keys still work, and a restore gives both guns at once", /const canSwap = holster === "out" && !knockedOut;/.test(page) && /giveGuns\(deathKit, deathHand\)/.test(page));
  check("a loadout picked on the ship leaves a loot start's hands alone", /duel instanceof BrMatch && duel\.phase !== "waiting" && \(duel\.startLoot/.test(page));
  check("a dead player's items go on a clear bearing", /deathSpot\(at, floor,/.test(brs));
  const rocket = gunStats(weaponIds().find((id) => !!resolveWeapon(id, [], 0).blast)!, 0);
  check("a launcher's card reads its full range, with its point-blank damage beside it", rocket.ttk < 3 && / TO /.test(rocket.dmg), `${rocket.dmg}, ${rocket.ttk.toFixed(2)} s`);
  // (Milestone 990) a semi gun's button held through a gate is no new pull
  const gun = resolveWeapon("wingman", [], 0);
  const semi = new WeaponState(gun);
  semi.onDeploy();
  let t = 100;
  const step = (s: InstanceType<typeof WeaponState>, gate: boolean, button: boolean): number => s.update(1 / 60, (t += 1 / 60), gate && button, false, "stand", "still", false, false, () => 0.5, button).length;
  for (let i = 0; i < 90; i++) step(semi, false, false);
  step(semi, true, true);
  let more = 0;
  for (let i = 0; i < 60; i++) step(semi, false, true);
  for (let i = 0; i < 60; i++) more += step(semi, true, true);
  check("a semi gun does not fire itself when a gate lifts off a held button", more === 0, `${more} shots with no new click`);
  // a spray walks one pattern at any frame rate
  const heads = [30, 60, 144].map((fps) => {
    const s = new WeaponState(resolveWeapon("vinson", [], 0));
    s.onDeploy();
    let now = 100;
    let n = 0;
    const sprayed = resolveWeapon("vinson", [], 0).clipSize;
    while (n < sprayed) n += s.update(1 / fps, (now += 1 / fps), true, false, "stand", "still", false, false, () => 0.5).length;
    return s.kick.cursor();
  });
  check("PANDA's pattern cursor is the same at 30, 60 and 144 fps", Math.max(...heads) - Math.min(...heads) <= 1.5, heads.map((c) => c.toFixed(1)).join(" "));
  // fusing a CHOOCH that has overheated
  const hot = new Loadout(["lstar", "r97"]);
  const heat = hot.active.state;
  heat.overheated = true;
  heat.reloading = true;
  hot.fuse(0, 1);
  check("a fused CHOOCH is not locked, and its levels cool faster", !heat.overheated && !heat.reloading && resolveWeapon("lstar", [], 5).mech.overheat!.lockout < resolveWeapon("lstar", [], 0).mech.overheat!.lockout);
  // a gun taken back owes its bolt
  const bolt = new WeaponState(resolveWeapon("sentinel", [], 0));
  bolt.onDeploy();
  bolt.owes(200);
  check("a gun taken back up still owes its bolt", bolt.readyAt === 200 && /st\.owes\(boltOwed\.get\(it\.id\) \?\? -Infinity\)/.test(page));
  check("a shot leaves the camera's roll alone", !/if \(!third\) camera\.quaternion\.copy\(player\.orientation\(off\.pitchUp, off\.yawLeft\)\);/.test(page));
  check("a squad mate is no target for your rounds", /if \(this\.friendly\(r\.id\)\) \(this\.friendlyFire \? this\.projectiles\.addDummy/.test(brs));
  check("no sights on the ship or in a dive", /!loadout\.active\.empty && !player\.dropping && !player\.aboard;/.test(page));
  check("a rocket on a range target goes by its face", /const point = t\.hitMeshes\[0\]\.getWorldPosition/.test(page));
  check("a rule keeps the guns on its own list", /if \(s\.empty \|\| list\.includes\(s\.id\)\) continue;/.test(page));
  // (Milestone 994) the range's own
  const tools = readFileSync(new URL("../../src/game/rangetools.ts", import.meta.url), "utf8");
  check("a drill's figure knocked by the same pull stands up again", /if \(this\.hitPull === this\.pull\) \{\s+this\.target\.popUp\(\);/.test(tools));
  check("the menu holds a run, body and all", /if \(!duel && courseRunning\(\) && !input\.playing && !scriptInput\) dt = 0;/.test(page));
  check("a match's Guns rule ends with it", /else if \(ruled\) applyLoadout\(loadouts\.current\);/.test(page));
  check("the tutorial's beacon and the run's ghost go with them", /this\.showBeacon\(null, 0\);/.test(readFileSync(new URL("../../src/game/tutorial.ts", import.meta.url), "utf8")) && /this\.ghostFig\.visible = false;\s+for \(const d of this\.enemies\)/.test(readFileSync(new URL("../../src/game/course.ts", import.meta.url), "utf8")));
  const { mergeProfiles, isRecordKey } = await import("../../src/net/mergeprofile");
  check("the drill's best is a record, and the lower one stands", isRecordKey("range.drill.blink") && mergeProfiles({ "range.drill.blink": "20.5" }, { "range.drill.blink": "33.1" })["range.drill.blink"] === "20.5");
}

console.log(fails === 0 ? "\nARENA RULES PASS" : `\nARENA RULES FAIL (${fails})`);
process.exit(fails === 0 ? 0 : 1);
