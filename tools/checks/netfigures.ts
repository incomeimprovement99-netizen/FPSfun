// What a player sees of the others over a real connection's faults (Milestones 934 and 935, from a review of the network
// sync), the real Duel on both ends of a hand-driven wire:
//   - a friend's connection drops with the host holding their seat: the other guests keep the figure, the dropped guest
//     keeps everyone's, nobody reads LOST, and a figure first seen out lies where it is;
//   - a clean link and a player who taps a key are drawn 100 ms behind, the sender's quiet no lateness;
//   - a figure that stopped is drawn where they stopped, not on past it until the next state;
//   - a bot's down is stamped, as a player's is, so a state from just before it cannot stand it back up;
//   - a guest's fair hit on someone who then used a DASH passes the host's check (Milestone 939);
//   - a player down, a swap of theirs landing after it: their figure stays in the scene and in reach (Milestone 951);
//   - a guest speaks only for itself, and a frame whose counts promise more than it holds is dropped unread (Milestone 953);
//   - the drop (Milestones 932 to 934): a won Gulag comes down by a mate on ground that has not decayed, a friend down
//     first starts the fight, a bot's fall meets the floor it fell past, and no WALL, HEAL or MINE stands in the sky.
//
// It moves the page's clock, so it runs in a process of its own: GAME=speedkills npx tsx tools/checks/netfigures.ts
// (verify runs it that way).
import { readFileSync } from "node:fs";
import { Duel, Wire, scene, projectiles, at, tick, ins } from "./net-harness";
import { BrMatch } from "../../src/game/brmatch";
import { BR_CENTER } from "../../src/game/br";
import type { LocalState } from "../../src/game/duel";

let fails = 0;
function check(label: string, cond: boolean, detail = ""): void {
  if (!cond) fails++;
  console.log(`${cond ? "  ok  " : "FAIL  "}${label}${detail ? ` (${detail})` : ""}`);
}

const ONE_WAY_MS = 30;
class LagWire extends Wire {
  timed: Array<{ due: number; go: () => void }> = [];
  override drain(): void {
    for (const go of this.queue.splice(0)) this.timed.push({ due: performance.now() + ONE_WAY_MS, go });
    const now = performance.now();
    const ready = this.timed.filter((x) => x.due <= now);
    this.timed = this.timed.filter((x) => x.due > now);
    for (const x of ready) x.go();
  }
}
const st = (x: number, speed: number): LocalState => ({ x, y: 0, z: 0, yaw: 90, pitch: 0, crouch: false, weapon: "vinson", operator: "vanguard", name: "P", ready: true, stance: "stand", speed, ads: 0, act: 0 });

console.log("A connection dropped with the seat held (src/game/duel.ts)");
{
  const wire = new Wire();
  const [h1, g1] = wire.pair(0, 1);
  const [h2, g2] = wire.pair(0, 2);
  const host = new Duel(scene, projectiles, { players: 3, myId: 0, link: h1, guestId: 1, mode: "arena" });
  host.addGuest(h2, 2);
  const a = new Duel(scene, projectiles, { players: 3, myId: 1, link: g1, mode: "arena" });
  const b = new Duel(scene, projectiles, { players: 3, myId: 2, link: g2, mode: "arena" });
  const notices: string[] = [];
  a.onNotice = (s) => notices.push(s);
  b.onNotice = (s) => notices.push(s);
  for (const d of [host, a, b]) {
    (d as unknown as { onHostLost: () => void }).onHostLost = () => undefined;
    ins(d).phase = "fight";
  }
  // player 2 is out (a ghost), standing 300 m off
  (b as unknown as { alive: boolean }).alive = false;
  let f = 0;
  const step = (n: number): void => {
    for (let i = 0; i < n; i++, f++) {
      tick(1000 / 30);
      host.update(at(0, f));
      a.update(at(1, f));
      b.update(at(2, f, true, 300, -200));
      wire.drain();
    }
  };
  step(90);
  // the Wi-Fi goes, both ways, no goodbye: 11 s is past a guest's 10 s silence limit
  wire.cut.add("1>0");
  wire.cut.add("0>1");
  step(30 * 11);
  check("a friend reconnecting, the host holding their seat, stays on the other guests' screens", ins(b).remotes.has(1), `guest 2 sees [${[...ins(b).remotes.keys()]}]`);
  check("and the guest getting back in keeps every figure", ins(a).remotes.has(2), `guest 1 sees [${[...ins(a).remotes.keys()]}]`);
  check("nobody reads LOST for them", notices.length === 0, JSON.stringify(notices));
  wire.cut.clear();
  const [h1b, g1b] = wire.pair(0, 1);
  host.rejoin(h1b, 1);
  a.swapHost(g1b);
  step(60);
  const fig = ins(a).remotes.get(2)?.avatar.group.position;
  const real = at(2, f, true, 300, -200);
  check("back in, a figure that is out lies where it is, not at the world's origin", !!fig && Math.hypot(fig.x - real.x, fig.z - real.z) < 1, fig ? `${fig.x.toFixed(1)}, ${fig.z.toFixed(1)}` : "no figure");
}

console.log("\nHow far behind a figure is drawn (src/game/duel.ts)");
for (const [label, runF, standF] of [["always running", 1e9, 0], ["run 0.5 s, stand 0.7 s", 30, 42], ["run 0.5 s, stand 1 s", 30, 60]] as Array<[string, number, number]>) {
  const wire = new LagWire();
  const [h, gl] = wire.pair(0, 1);
  const host = new Duel(scene, projectiles, { players: 2, myId: 0, link: h, guestId: 1, mode: "arena" });
  const guest = new Duel(scene, projectiles, { players: 2, myId: 1, link: gl, mode: "arena" });
  for (const d of [host, guest]) ins(d).phase = "fight";
  let x = 0;
  let dir = 1;
  const delays: number[] = [];
  for (let f = 0; f < 60 * 30; f++) {
    tick(1000 / 60);
    const c = f % (runF + standF);
    const moving = c < runF;
    if (moving) x += (8 * dir) / 60;
    else if (c === runF) dir = -dir;
    host.update(st(0, 0));
    guest.update(st(x, moving ? 8 : 0));
    wire.drain();
    if (f > 600) delays.push((ins(host).remotes.get(1) as unknown as { buffer?: { delay: number } }).buffer?.delay ?? 0);
  }
  delays.sort((p, q) => p - q);
  const mid = delays[delays.length >> 1] * 1000;
  check(`on a clean link, ${label}: drawn no more than 110 ms behind`, mid <= 110, `${mid.toFixed(0)} ms`);
}

console.log("\nA figure that stopped (src/game/duel.ts)");
{
  let seed = 3;
  const rnd = (): number => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  for (const [dist, loss] of [[250, 0], [40, 0.15]] as Array<[number, number]>) {
    let off = 0;
    let worst = 0;
    const TRIALS = 12;
    for (let t = 0; t < TRIALS; t++) {
      const wire = new LagWire();
      wire.drop = (c) => c.fast && rnd() < loss;
      const [h1, g1] = wire.pair(0, 1);
      const [h2, g2] = wire.pair(0, 2);
      const host = new Duel(scene, projectiles, { players: 3, myId: 0, link: h1, guestId: 1, mode: "arena" });
      host.addGuest(h2, 2);
      const a = new Duel(scene, projectiles, { players: 3, myId: 1, link: g1, mode: "arena" });
      const b = new Duel(scene, projectiles, { players: 3, myId: 2, link: g2, mode: "arena" });
      for (const d of [host, a, b]) ins(d).phase = "fight";
      let bx = dist;
      const stopAfter = 120 + Math.floor(rnd() * 60);
      let peak = 0;
      for (let f = 0; f < stopAfter + 60 * 4; f++) {
        tick(1000 / 60);
        const moving = f < stopAfter;
        if (moving) bx += 8 / 60;
        host.update(st(0, 0));
        a.update(st(0, 0));
        b.update(st(bx, moving ? 8 : 0));
        wire.drain();
        // half a second after the stop the 100 to 300 ms delay has run out
        const fig = ins(a).remotes.get(2)?.avatar.group.position;
        if (f > stopAfter + 30 && fig) peak = Math.max(peak, Math.abs(fig.x - bx));
      }
      if (peak > 0.25) off++;
      worst = Math.max(worst, peak);
    }
    check(`${dist} m off, ${(loss * 100).toFixed(0)}% lost: a figure that stopped is drawn where it stopped`, off === 0, `${off} of ${TRIALS} over 25 cm off, worst ${worst.toFixed(2)} m`);
  }
}

console.log("\nA bot's down (src/game/brmatch.ts, src/game/modematch.ts)");
{
  // the sender's stamp is what orders a down against a state late on the unordered channel: a player's has always had it
  const stamped = (file: string, send: RegExp): boolean => {
    const line = readFileSync(new URL(`../../src/game/${file}`, import.meta.url), "utf8").split("\n").find((l) => send.test(l));
    return !!line && /tm: senderStamp\(\)/.test(line);
  };
  check("a bot's down in a battle royale carries the sender's stamp", stamped("brmatch.ts", /broadcast\(\{ t: "down", from: r\.id/));
  check("and in the arena modes", stamped("modematch.ts", /broadcast\(\{ t: "down", from: r\.id/));
}

console.log("\nA hit on someone who dashed (src/game/duel.ts, src/net/hitcheck.ts)");
{
  const wire = new Wire();
  const [h1, g1] = wire.pair(0, 1);
  const [h2, g2] = wire.pair(0, 2);
  const host = new Duel(scene, projectiles, { players: 3, myId: 0, link: h1, guestId: 1, mode: "arena" });
  host.addGuest(h2, 2);
  const a = new Duel(scene, projectiles, { players: 3, myId: 1, link: g1, mode: "arena" });
  const b = new Duel(scene, projectiles, { players: 3, myId: 2, link: g2, mode: "arena" });
  for (const d of [host, a, b]) ins(d).phase = "fight";
  let bx = 10;
  const step = (n: number): void => {
    for (let i = 0; i < n; i++) {
      tick(1000 / 30);
      host.update(st(-100, 0));
      a.update(st(0, 0));
      b.update(st(bx, 0));
      wire.drain();
    }
  };
  step(60);
  // the shooter fires at the figure 10 m off; the target's DASH, 26 m in a frame, is on the host before the hit's message
  bx += 26;
  step(6);
  const h = host as unknown as { hitSane(from: number, m: unknown): boolean; shotAt: Map<number, number> };
  h.shotAt.set(1, performance.now() / 1000);
  const passed = h.hitSane(1, { t: "hit", to: 2, amount: 10, w: "vinson", d: 10 });
  check("a guest's round on where a target was, before its 26 m DASH, passes the host's check", passed, `the host has them ${bx} m apart, the claim 10 m`);
  const forged = h.hitSane(1, { t: "hit", to: 2, amount: 10, w: "vinson", d: 300 });
  check("and a claim from 300 m does not", !forged);
}

console.log("\nA swap that lands after a death (src/game/duel.ts)");
{
  const reach: unknown[] = [];
  const hits = { addDummy: (x: unknown) => void (reach.includes(x) || reach.push(x)), removeDummy: (x: unknown) => void (reach.includes(x) && reach.splice(reach.indexOf(x), 1)), fire: () => undefined } as unknown as typeof projectiles;
  const wire = new Wire();
  const [h, gl] = wire.pair(0, 1);
  const host = new Duel(scene, hits, { players: 2, myId: 0, link: h, guestId: 1, mode: "arena" }) as unknown as { applyState(m: unknown, from: number, now: number): void; receive(m: unknown, via: number): void; remotes: Map<number, { avatar: { group: { parent: unknown }; knocked: boolean } }> };
  void gl;
  const st = (w: string, alive = true): unknown => ({ t: "s", x: 1, y: 0, z: 2, yaw: 0, pitch: 0, hp: 100, sh: 50, w, op: "vanguard", alive, crouch: false });
  const now = (): number => performance.now() / 1000;
  host.applyState(st("vinson"), 1, now());
  host.applyState(st("r97"), 1, now());
  host.applyState(st("vinson"), 1, now());
  host.receive({ t: "down", by: 0 }, 1);
  host.applyState(st("r97", false), 1, now());
  const fig = host.remotes.get(1)?.avatar;
  check("down mid-swap: the figure stays in the scene, down, and in reach", !!fig && fig.group.parent === scene && fig.knocked && reach.includes(fig), JSON.stringify({ inScene: fig?.group.parent === scene, knocked: fig?.knocked, reach: reach.includes(fig) }));
  tick(3000);
  host.applyState(st("r97", true), 1, now());
  const up = host.remotes.get(1)?.avatar;
  check("and back up it has the gun, seen and hittable", !!up && up.group.parent === scene && reach.includes(up));
}

console.log("\nA ghost's look (src/game/duel.ts)");
{
  // (Milestone 954) only a real REVEAL tells the one it found
  const wire = new Wire();
  const [h, gl] = wire.pair(0, 1);
  const host = new Duel(scene, projectiles, { players: 2, myId: 0, link: h, guestId: 1, mode: "arena" });
  const guest = new Duel(scene, projectiles, { players: 2, myId: 1, link: gl, mode: "arena" });
  let told = 0;
  guest.onRevealed = () => void told++;
  for (const d of [host, guest]) ins(d).phase = "fight";
  for (let i = 0; i < 20; i++) {
    tick(1000 / 30);
    host.update(st(0, 0));
    guest.update(st(5, 0));
    wire.drain();
  }
  const at = new (await import("three")).Vector3();
  host.reveal(at, null, 25, 360, 0.7, true);
  wire.drain();
  const quiet = told;
  host.reveal(at, null, 25, 360, 0.7);
  wire.drain();
  check("a ghost's look does not tell them REVEALED; a real one does", quiet === 0 && told === 1, JSON.stringify({ quiet, told }));
}

console.log("\nWhat a peer may say (src/net/statesync.ts, src/net/framecheck.ts, src/main.ts)");
{
  const wire = new Wire();
  const [h, gl] = wire.pair(0, 1);
  const host = new Duel(scene, projectiles, { players: 2, myId: 0, link: h, guestId: 1, mode: "arena" });
  const guest = new Duel(scene, projectiles, { players: 2, myId: 1, link: gl, mode: "arena" });
  for (const d of [host, guest]) ins(d).phase = "fight";
  for (let i = 0; i < 30; i++) {
    tick(1000 / 30);
    host.update(st(0, 0));
    guest.update(st(5, 0));
    wire.drain();
  }
  const before = ins(host).remotes.size;
  const keyframe = (f: number | undefined, seq: number, epoch: number, over: Record<string, unknown> = {}) => ({ ...(f === undefined ? {} : { f }), q: seq, e: epoch, d: { x: 100, y: 0, z: 100, aw: 0, ap: 0, cr: 0, hp: 100, sh: 75, al: 1, w: "vinson", op: "vanguard", nm: "FORGED", ...over } });
  const forged = Array.from({ length: 2000 }, (_, i) => keyframe(1000 + i, 1000 + i, 1000 + i, { nm: `P${i}` }));
  (host as unknown as { receive(m: unknown, via: number): void }).receive({ t: "sd", from: 1, p: forged }, 1);
  check("a guest naming 2,000 others makes no figures", ins(host).remotes.size === before, `${before} to ${ins(host).remotes.size}`);
  const { frameFits } = await import("../../src/net/framecheck");
  const { pack } = await import("peerjs-js-binarypack");
  const real = [{ t: "s", x: 1.5, y: -2, z: 300000, w: "vinson", name: "P", alive: true, sp: null }, { p: [{ f: 1, x: [1, 2, 3] }, { f: 2, s: "x".repeat(300) }] }, Array.from({ length: 900 }, (_, i) => i % 7), { b: new Uint8Array(70000).buffer }];
  const buf = async (v: unknown) => {
    const p = pack(v as never) as unknown;
    return p instanceof Blob ? p.arrayBuffer() : (p as ArrayBuffer);
  };
  let good = 0;
  for (const v of real) if (frameFits(await buf(v))) good++;
  check("every real message's frame passes", good === real.length, `${good} of ${real.length}`);
  const bombs = [[0xdd, 0xff, 0xff, 0xff, 0xff], [0xdf, 0xff, 0xff, 0xff, 0xff], [0xdc, 0xff, 0xff], [0x92, 0xdd, 0x7f, 0xff, 0xff, 0xff, 0x00]];
  check("a frame promising more than it holds is dropped", bombs.every((f) => !frameFits(new Uint8Array(f).buffer)));
  const main = readFileSync(new URL("../../src/main.ts", import.meta.url), "utf8");
  check("what a host's welcome names goes through the escape, and its numbers are numbers", /const goal = escapeHtml\(/.test(main) && /const whole = \(v: unknown, most: number\)/.test(main));
}

console.log("\nThe drop (src/game/brmatch.ts, src/game/bots.ts, src/main.ts)");
{
  // the real dropBackSpot: a mate at the edge of a lost half of the city
  type Back = { dropBackSpot(near: { x: number; z: number } | null): { x: number; z: number } };
  const circle = { cx: BR_CENTER.x, cz: BR_CENTER.z, r: 40 };
  const edge = BR_CENTER.x - 100;
  const mate = { x: edge + 2, z: BR_CENTER.z };
  const stand = { lostAt: (x: number) => x < edge, decay: true, decayCircle: circle, view: { current: circle } };
  const spot = (BrMatch.prototype as unknown as Back).dropBackSpot;
  let lost = 0;
  for (let i = 0; i < 400; i++) if (stand.lostAt(spot.call(stand, mate).x)) lost++;
  check("a won Gulag comes down by a mate on ground the decay has not reached", lost === 0, `${lost} of 400 in a lost sector`);
  const gone = { ...stand, lostAt: () => true };
  const far = spot.call(gone, mate);
  check("and with nothing clear round them, in the final sector", Math.hypot(far.x - circle.cx, far.z - circle.cz) <= circle.r, `${far.x.toFixed(0)}, ${far.z.toFixed(0)}`);

  const src = (file: string): string => readFileSync(new URL(`../../src/${file}`, import.meta.url), "utf8");
  check("a friend down first starts the fight, for those still riding", /\(!airborne\(local\.stance\) \|\| friendDown\)/.test(src("game/brmatch.ts")));
  check("a bot's fall asks for the ground from where the frame began", /this\.pos\.y = Math\.max\(end, fellFrom\);\s+const ground = this\.groundAt/.test(src("game/bots.ts")));
  check("WALL, HEAL and MINE are refused in a dive", /player\.dropping && \(held\.id === "leap"[^\n]*"wall"[^\n]*"heal"[^\n]*"mine"/.test(src("main.ts")));
}

console.log(fails === 0 ? "\nNET FIGURES PASS" : `\nNET FIGURES FAIL (${fails})`);
process.exit(fails === 0 ? 0 : 1);
