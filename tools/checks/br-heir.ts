// A battle royale's care packages across a change of host (Milestone 1003, from the review of the BR after the landing),
// with the real BrMatch on the real Neon map, a fake clock and a wire through PeerJS's packing:
//   - a package that comes down between the host going and the heir taking over is laid by the heir, where it lay empty
//     all match (nobody but the host lays one's items, and it had gone);
//   - a package called after the heir's last snapshot is not called a second time for its wave.
//
// It moves the page's clock and needs the game named, so it runs in a process of its own:
// GAME=speedkills npx tsx tools/checks/br-heir.ts (verify runs it that way).
import * as THREE from "three";

let fails = 0;
function check(label: string, cond: boolean, detail = ""): void {
  if (!cond) fails++;
  console.log(`${cond ? "  ok  " : "FAIL  "}${label}${detail ? ` (${detail})` : ""}`);
}

let clock = 1000;
Object.defineProperty(performance, "now", { value: () => clock * 1000, configurable: true, writable: true });
const g = globalThis as unknown as Record<string, unknown>;
const anyProxy = (): unknown =>
  new Proxy(function () {}, {
    get: (_t, k) => (k === "measureText" ? () => ({ width: 10 }) : k === Symbol.toPrimitive ? () => 0 : k === "width" || k === "height" ? 64 : anyProxy()),
    set: () => true,
    apply: () => anyProxy(),
  });
const fakeEl = (): unknown => ({ width: 64, height: 64, style: {}, getContext: () => anyProxy(), addEventListener() {}, removeEventListener() {}, set src(_v: string) {} });
if (!("document" in g)) g.document = { createElement: () => fakeEl(), createElementNS: () => fakeEl() };
const warn = console.warn;
console.warn = () => undefined;
const { buildNeonMap } = await import("../../src/game/neonmap");
const SOLIDS = (await import("../../src/config/neon/neonmap.solids.json", { with: { type: "json" } })).default as { solids: number[][] };
const map = buildNeonMap(new THREE.Scene(), SOLIDS.solids);
const { BrMatch } = await import("../../src/game/brmatch");
const decay = await import("../../src/game/decay");
const br = await import("../../src/game/br");
const { pack, unpack } = await import("peerjs-js-binarypack");
const { withoutUndefined } = await import("../../src/net/wire");
console.warn = warn;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;
const scene = new THREE.Scene();
const projectiles = { addDummy: () => undefined, removeDummy: () => undefined, fire: () => undefined } as never;
const via = (v: unknown): unknown => unpack(pack(withoutUndefined(v) as Parameters<typeof pack>[0]) as ArrayBuffer);
class Wire {
  q: Array<() => void> = [];
  pair(a: number, b: number): [Any, Any] {
    const ends: Any[] = [];
    const make = (me: number, role: string): Any => {
      const send = (m: Any) => {
        if (ends[me === a ? 0 : 1].closed) return;
        const arrived = via(m);
        const other = ends[me === a ? 1 : 0];
        this.q.push(() => {
          if (!other.closed) other.onMessage?.(arrived);
        });
      };
      return { role, closed: false, send, sendFast: send, onMessage: null, onClose: null, close() { this.closed = true; }, abandon() { this.closed = true; } };
    };
    ends.push(make(a, "host"), make(b, "guest"));
    return [ends[0], ends[1]];
  }
  pump(): void {
    while (this.q.length) (this.q.shift() as () => void)();
  }
}
const local = (over: Record<string, unknown> = {}): Any => ({ x: 0, y: 0, z: 500, yaw: 0, pitch: 0, crouch: false, weapon: "vinson", operator: "", name: "P", ready: true, stance: "stand", speed: 0, ads: 0, act: 0, ...over });
const makeMatch = (opts: Any): Any => new BrMatch(scene, projectiles, map, "normal", 9, { players: 1, myId: 0, link: null, seed: 8, ship: false, team: "trio", poi: map.pois[0].id, ...opts });
const run = (steps: Array<{ d: Any; l: () => Any }>, seconds: number, wire: Wire): void => {
  for (let i = 0, n = Math.round(seconds * 30); i < n; i++) {
    clock += 1 / 30;
    for (const s of steps) if (!s.d.ended) s.d.update(s.l());
    wire.pump();
  }
};
/** a host and two guests, landed and fighting, the host's heir named */
function start(): { host: Any; heir: Any; g2: Any; wire: Wire; ls: Array<{ d: Any; l: () => Any }>; pos: Array<{ x: number; z: number }> } {
  const wire = new Wire();
  const host = makeMatch({ players: 3, myId: 0, team: "trio" });
  const guests: Any[] = [];
  for (let id = 1; id < 3; id++) {
    const [a, b] = wire.pair(0, id);
    host.addGuest(a, id);
    const gm = makeMatch({ players: 3, myId: id, link: b, guestId: id, team: "trio" });
    gm.onTakeOver = () => undefined;
    gm.onHostLost = () => undefined;
    guests.push(gm);
  }
  host.incomingScale = 0;
  for (const gm of guests) gm.incomingScale = 0;
  host.holdFire = true;
  const mid = decay.centreOf(host.decay.final);
  const safe = { x: br.BR_X + mid.x + 3, z: br.BR_Z + mid.z };
  // (where each stands, which a check may move)
  const pos = [{ ...safe }, { x: safe.x + 1, z: safe.z }, { x: safe.x + 2, z: safe.z }];
  const ls = [host, ...guests].map((d, i) => ({ d, l: () => local({ ...pos[i] }) }));
  for (let i = 0; i < 400 && host.phase !== "fight"; i++) run(ls, 1 / 30, wire);
  for (let i = 0; i < 60 * 30 && !host.canMigrate(); i++) run(ls, 1 / 30, wire);
  run(ls, 1.2, wire);
  return { host, heir: guests[0], g2: guests[1], wire, ls, pos };
}
const gone = (host: Any): void => {
  host.ended = true;
  for (const l of host.links.values()) l.abandon?.();
};

console.log("A battle royale's care packages across a change of host (src/game/brmatch.ts)");
{
  const { host, heir, wire, ls } = start();
  host.ring.phase = 1;
  host.ring.state = "closing";
  host.ring.timeLeft = 20;
  host.ringSendNext = 0;
  run(ls, 0.3, wire);
  const pod = heir.pods[0];
  // the host goes 1.5 s before the package is down; the heir has the code 3 s later
  run(ls, pod.landsAt - clock - 1.5, wire);
  const snap = heir.heirSnap;
  gone(host);
  run(ls.slice(1), 3, wire);
  const landedFirst = pod.landed && heir.role === "guest";
  // (a death's gun beside it, as at any contested package: it read as the package's own, Milestone 1006)
  heir.lootField.add({ kind: "weapon", id: "r97", n: 1, rarity: "common", fusion: 0 }, pod.at.clone().add(new THREE.Vector3(1, 0, 0)), heir.lootField.keyNext);
  heir.takeOver(snap);
  run(ls.slice(1), 2, wire);
  // (counted by the package's own keys: anything else laid near it in those seconds, a bot's death, a restock, is not it)
  const near = pod.keys.filter((k: number) => heir.lootField.drops.has(k)).length;
  check("a package down between the host going and the heir taking over is laid by the heir, a death's gun beside it or not (it lay empty all match)", landedFirst && near === 3, `${near} of 3 items on the floor`);
}
{
  // (Milestone 1006) the host laid it, everything was taken, and the host went within the second: not laid a second time
  const { host, heir, wire, ls } = start();
  host.ring.phase = 1;
  host.ring.state = "closing";
  host.ring.timeLeft = 20;
  host.ringSendNext = 0;
  run(ls, 0.3, wire);
  const pod = heir.pods[0];
  run(ls, pod.landsAt - clock + 0.2, wire);
  const heard = pod.keys.length;
  for (const k of pod.keys) heir.lootField.remove(k);
  const snap = heir.heirSnap;
  gone(host);
  run(ls.slice(1), 1, wire);
  heir.takeOver(snap);
  run(ls.slice(1), 1, wire);
  // (by its keys too: a bot's death beside it in that second read as a second package, and failed the deploy's gate once)
  const again = pod.keys.length - heard;
  check("a package the old host laid, all taken, is not laid again by the heir", heard === 3 && again === 0, `${heard} heard laid, ${again} laid again`);
}
{
  const { host, heir, wire, ls } = start();
  // the package called after the heir's last snapshot: the heir takes over with the snapshot it had before the call
  const snap = heir.heirSnap;
  host.ring.phase = 2;
  host.ring.state = "closing";
  host.ring.timeLeft = 15;
  host.ringSendNext = 0;
  run(ls, 0.1, wire);
  const heard = heir.pods.length === 1 && !(snap?.mode?.pp ?? []).includes(2);
  gone(host);
  run(ls.slice(1), 0.5, wire);
  heir.takeOver(snap);
  run(ls.slice(1), 0.5, wire);
  check("a package called after the heir's last snapshot is not called again for its wave", heard && heir.pods.length === 1, `${heir.pods.length} packages for one wave`);
}
{
  // (Milestone 1005) the heir dies in the seconds the host is gone: its guns and echo, said to a host that never came back
  const { host, heir, wire, ls } = start();
  const snap = heir.heirSnap;
  gone(host);
  heir.hostLink?.onClose?.();
  const keyAt = heir.lootField.keyNext;
  const last = heir.remotes.get(0)?.samples?.at(-1);
  const at = new THREE.Vector3((last?.x ?? 0) + 2, last?.y ?? 0, last?.z ?? 500);
  heir.dropDeath([{ kind: "weapon", id: "vinson", n: 1, rarity: "common", fusion: 0 }, { kind: "echo", id: "echo", n: 1, rarity: "common", owner: 1, ownerName: "P" }], at);
  const waiting = heir.outbox.length;
  run(ls.slice(1), 1, wire);
  heir.takeOver(snap);
  run(ls.slice(1), 0.5, wire);
  const laid = [...heir.lootField.drops.values()].filter((d: Any) => d.key >= keyAt && (d.item.id === "vinson" || d.item.kind === "echo"));
  check("an heir's own death in the seconds the host was gone leaves its guns and echo on the floor (they were cleared with the messages)", waiting === 2 && laid.length === 2, `${waiting} waiting, ${laid.length} laid`);
}
{
  // (Milestone 1005) a guest getting back in as the match ends: its seat stays held for its time, and its result is there
  const { host, heir: guest, wire, ls } = start();
  host.links.get(1)?.onClose?.();
  guest.hostLink?.onClose?.();
  const held = host.held.has(1) && guest.reconnectUntil !== null;
  host.endBr(true);
  run([ls[0], ls[2]], 2, wire);
  const [h, gl] = wire.pair(0, 1);
  const back = host.rejoin(h, 1);
  guest.swapHost(gl, 0);
  run(ls, 0.5, wire);
  check("a guest back in as the match ended gets its result, not a lost connection", held && back && guest.brOver && guest.placement === 1 && !guest.ended, JSON.stringify({ held, back, over: guest.brOver, placement: guest.placement }));
}

console.log("\nThe host's word on a guest's take (src/game/brmatch.ts)");
{
  // (Milestone 1007) a take is granted within reach of where the host has the guest, and round the guest's own echo
  const { host, heir: guest, wire, ls } = start();
  const last = host.remotes.get(1).samples.at(-1);
  const at = (dx: number, dz: number) => new THREE.Vector3(last.x + dx, last.y, last.z + dz);
  const gun = { kind: "weapon", id: "r97", n: 1, rarity: "common", fusion: 0 };
  const add = (pos: THREE.Vector3, item: Any = gun): number => {
    const key = host.lootField.keyNext;
    host.dropLoot(item, pos);
    run(ls, 0.1, wire);
    return key;
  };
  const near = add(at(1.5, 0));
  const far = add(at(60, 0));
  const echo = add(at(-80, 0), { kind: "echo", id: "echo", n: 1, rarity: "common", owner: 1, ownerName: "P" });
  const byEcho = add(at(-80.8, 0.5));
  for (const k of [near, far, echo, byEcho]) guest.takeLoot(k);
  run(ls, 0.5, wire);
  const left = (k: number) => host.lootField.drops.has(k);
  check(
    "a guest's take of an item across the map is refused; one in reach, its own echo and what lies round it are granted",
    !left(near) && left(far) && !left(echo) && !left(byEcho),
    JSON.stringify({ near: !left(near), far: !left(far), echo: !left(echo), byEcho: !left(byEcho) }),
  );
}

{
  // (Milestone 1008) a take asked for while away, 30 m from where the host last had the guest: sent ahead of any state on
  // the way back in, it was judged on the place from before the drop and refused
  const { host, g2, wire, ls, pos } = start();
  const s0 = host.remotes.get(2).samples.at(-1);
  const key = host.lootField.keyNext;
  host.dropLoot({ kind: "weapon", id: "r97", n: 1, rarity: "common", fusion: 0 }, new THREE.Vector3(s0.x + 30, s0.y + 0.5, s0.z));
  run(ls, 0.2, wire);
  host.links.get(2).onClose();
  g2.hostLink.onClose();
  const d = g2.lootField.drops.get(key);
  pos[2] = { x: d.pos.x, z: d.pos.z };
  run(ls, 5, wire);
  g2.takeLoot(key);
  const [h, gl] = wire.pair(0, 2);
  host.rejoin(h, 2);
  g2.swapHost(gl, 0);
  run(ls, 0.5, wire);
  check("a take asked for while away is granted on the way back in, the guest 30 m from where it dropped", !host.lootField.drops.has(key));
}
{
  // (Milestone 1008) a guest's link dies silently in the match's last seconds: seen gone only after the end, 10 s on
  const { host, g2, wire, ls } = start();
  const hostEnd = host.links.get(2);
  hostEnd.send = () => undefined;
  g2.hostLink.onClose();
  host.endBr(true);
  run([ls[0], ls[1]], 1, wire);
  hostEnd.onClose?.();
  const held = host.held.has(2);
  const [h, gl] = wire.pair(0, 2);
  const back = host.rejoin(h, 2);
  g2.swapHost(gl, 0);
  run(ls, 0.5, wire);
  check("a guest whose drop is seen only after the end still gets its result on the way back in", held && back && g2.brOver && g2.placement === 1, JSON.stringify({ held, back, over: g2.brOver }));
}

{
  // (Milestone 1015) the kill leader: the host takes out three bots and is named on every page; a bot takes the host out, and
  // every page says the leader fell and names nobody (one kill is not enough); the heir's four kills, counted by the host,
  // make the heir the leader, said on the heir's own page as itself
  const { host, heir, g2, wire, ls } = start();
  const said: string[] = [];
  heir.onFeed = (t: string) => said.push(t);
  const bots = host.bots.filter((b: Any) => b.bot.alive);
  for (let i = 0; i < 3; i++) host.botDown(bots[i], 0);
  run(ls, 0.6, wire);
  const named = heir.hud().br.leader;
  const ok1 = host.hud().br.leader?.you === true && named?.id === 0 && named.kills === 3 && !named.you && g2.hud().br.leader?.id === 0 && said.some((t) => /IS THE KILL LEADER: 3 KILLS/.test(t));
  check("three kills make the host the kill leader, named on every page", ok1, JSON.stringify({ host: host.hud().br.leader, heir: named, said: said.slice(-2) }));
  const killer = bots[3].bot.remote.id;
  host.incomingScale = 1;
  host.takeHit(999, killer);
  run(ls, 0.6, wire);
  const fell = [host, heir, g2].map((d: Any) => ({ leader: d.hud().br.leader, downs: d.hud().br.leaderDowns }));
  check("the leader taken out is said on every page, and one kill names nobody next", fell.every((f) => f.leader === null && f.downs === 1) && said.some((t) => /THE KILL LEADER .* IS DOWN/.test(t)), JSON.stringify(fell));
  for (let i = 4; i < 8; i++) host.botDown(bots[i], 1);
  run(ls, 0.6, wire);
  const mine = heir.hud().br.leader;
  check("four kills by a guest, counted where the host lands them, make the guest the leader on its own page", mine?.id === 1 && mine.you && mine.kills === 4 && g2.hud().br.leader?.id === 1, JSON.stringify({ heir: mine, g2: g2.hud().br.leader }));
}

{
  // (Milestone 1016) a guest's round in a bot, which the host lands: the bot's flinch pushes it away from the guest, read
  // back out of its own frame, not straight back whichever way the shot came
  const { host } = start();
  const b = host.bots.find((x: Any) => x.bot.alive && !x.bot.dropping);
  const shooter = host.remotes.get(1).avatar.group.position.clone();
  host.onHitOther(b.bot.remote.id, 5, false, 1, "r97");
  const fd = b.bot.dummy.flinchDir;
  const yaw = b.bot.dummy.group.rotation.y;
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  // (the push away, in the world: back out of the figure's frame, where a point toward the shooter becomes its opposite)
  const toward = { x: -(fd.x * c + fd.y * s), z: -(-fd.x * s + fd.y * c) };
  const dx = shooter.x - b.bot.pos.x;
  const dz = shooter.z - b.bot.pos.z;
  const l = Math.hypot(dx, dz) || 1;
  const along = toward.x * (dx / l) + toward.z * (dz / l);
  check("a guest's round in a bot pushes it away from the guest on the host's page, not straight back", along > 0.99, `${along.toFixed(2)} along the line to the guest, the push ${fd.x.toFixed(2)}, ${fd.y.toFixed(2)} in its frame`);
}

console.log(fails === 0 ? "\nBR HEIR PASS" : `\nBR HEIR FAIL (${fails})`);
process.exit(fails === 0 ? 0 : 1);
