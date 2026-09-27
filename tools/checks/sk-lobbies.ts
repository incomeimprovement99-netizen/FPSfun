// The Sky Lobby's window pads, proven in the built city (Phase 21, city.ts skyLobby, docs/PHASE_21_LAYOUT.md): every
// window pad throws the real controller, with SpeedKills' movement over the city's own solids, through its window
// onto the lobby's floor 32 m up, from standing on it, from a run at it and from the side, with 0.4 m clear of the
// window's frame on every side (the brief's clearance). And the towers take pads from two sides where the survey
// (tools/centre-towers.ts) found room.
//
// It needs the game named: GAME=speedkills npx tsx tools/checks/sk-lobbies.ts (verify runs it that way).
import * as THREE from "three";

const g = globalThis as unknown as Record<string, unknown>;
const hadDocument = "document" in g;
const anyProxy = (): unknown =>
  new Proxy(function () {}, {
    get: (_t, k) => (k === "measureText" ? () => ({ width: 10 }) : k === Symbol.toPrimitive ? () => 0 : k === "width" || k === "height" ? 64 : anyProxy()),
    set: () => true,
    apply: () => anyProxy(),
  });
const fakeEl = (): unknown => ({ width: 64, height: 64, style: {}, getContext: () => anyProxy(), addEventListener() {}, removeEventListener() {}, set src(_v: string) {} });
if (!hadDocument) g.document = { createElement: () => fakeEl(), createElementNS: () => fakeEl() };
const warn = console.warn;
console.warn = () => undefined;
const { GAME } = await import("../../src/game/game");
const { buildCityMap, LOBBY_BRIDGES, LOBBY_CANYONS } = await import("../../src/game/city");
const { Player } = await import("../../src/game/player");
const { MOVE } = await import("../../src/game/movement");
const { stepPads } = await import("../../src/game/course");
const { RANGE_SOLIDS } = await import("../../src/game/range");
const { BR_X, BR_Z } = await import("../../src/game/br");
const chain = (await import("../../src/config/chaincourse.json")).default;
const city = (await import("../../src/config/city.json")).default;
const map = buildCityMap(new THREE.Scene());
console.warn = warn;
if (!hadDocument) delete g.document;

type Action = import("../../src/game/input").Action;
let fails = 0;
function check(label: string, cond: boolean, detail = ""): void {
  if (!cond) fails++;
  console.log(`${cond ? "  ok  " : "FAIL  "}${label}${detail ? ` (${detail})` : ""}`);
}
class Script {
  down = new Set<Action>();
  taps = new Set<Action>();
  held = (a: Action): boolean => this.down.has(a) || this.taps.has(a);
  pressedNow = (a: Action): boolean => this.taps.has(a);
}

console.log(`\nThe Sky Lobby's window pads, in the city (game: ${GAME})`);
check("this runs with SpeedKills' movement", GAME === "speedkills");
const pads = map.pads.filter((p) => p.hold !== undefined);
const L = city.skyLobby;
const DT = 1 / 144;
/** the pad as the course engine takes it (brplay.ts does the same) */
const asCourse = (p: (typeof pads)[number]) => ({ x: p.x, z: p.z, y: p.y ?? 0, reach: chain.window.reach, up: p.up ?? 0, vx: p.dx, vz: p.dz, over: p.over ?? 0, hold: p.hold ?? 0 });

/** a throw off one pad from where the player starts (dx, dz from the pad, running at it when `run`) */
function throwFrom(pad: (typeof pads)[number], ox: number, oz: number, run: boolean): { in: boolean; clear: { under: number; over: number; side: number } } {
  const cp = asCourse(pad);
  const len = Math.hypot(cp.vx, cp.vz);
  // the face's normal points out of the tower, toward the pad; the window's middle is stand-off back along it
  const nx = -cp.vx / len;
  const nz = -cp.vz / len;
  const fx = cp.x - nx * chain.window.standOff;
  const fz = cp.z - nz * chain.window.standOff;
  const floor = cp.over - chain.window.overAt;
  const p = new Player({ minX: BR_X - 400, maxX: BR_X + 400, minZ: BR_Z - 400, maxZ: BR_Z + 400 });
  p.extraMoves = true;
  p.autoClimb = true;
  p.sprintMode = "auto";
  const sx = cp.x + ox;
  const sz = cp.z + oz;
  // facing the pad (reach.ts: yaw 0 runs -z)
  const yaw = ox === 0 && oz === 0 ? (Math.atan2(nx, nz) * 180) / Math.PI : (Math.atan2(-(cp.x - sx), -(cp.z - sz)) * 180) / Math.PI;
  p.teleport(sx, cp.y, sz, yaw);
  const s = new Script();
  if (run) s.down.add("forward");
  const state = { at: -Infinity, carry: null };
  let t = 1000;
  let thrown = false;
  const clear = { under: Infinity, over: Infinity, side: Infinity };
  for (let i = 0; i < 6 / DT; i++) {
    t += DT;
    p.update(DT, t, s, 0, 1, false);
    s.taps.clear();
    if (stepPads([cp], 0, state, p, t)) {
      thrown = true;
      s.down.clear();
    }
    // how far in through the face (0 at its outer face, the wall's thickness at its inner), and across it
    const inward = -((p.pos.x - fx) * nx + (p.pos.z - fz) * nz);
    const across = Math.abs((p.pos.x - fx) * -nz + (p.pos.z - fz) * nx);
    if (thrown && inward > -MOVE.radius && inward < L.wall + MOVE.radius && p.pos.y > cp.y + 1) {
      clear.under = Math.min(clear.under, p.pos.y - floor);
      clear.over = Math.min(clear.over, floor + L.height - (p.pos.y + MOVE.standHeight));
      clear.side = Math.min(clear.side, L.width / 2 - (across + MOVE.radius));
    }
    if (thrown && p.onGround && Math.abs(p.pos.y - floor) < 0.15 && inward > L.wall) return { in: true, clear };
    if (thrown && p.onGround && p.pos.y < floor - 1 && t - state.at > 0.5) break;
  }
  return { in: false, clear };
}

// the approaches: standing on it, a run at it from behind, and in from each side along the face
let worst = { under: Infinity, over: Infinity, side: Infinity };
const missed: string[] = [];
for (const pad of pads) {
  const cp = asCourse(pad);
  const len = Math.hypot(cp.vx, cp.vz);
  const nx = -cp.vx / len;
  const nz = -cp.vz / len;
  const ways: Array<[string, number, number, boolean]> = [
    ["standing", 0, 0, false],
    ["a run from behind", nx * 2.4, nz * 2.4, true],
    ["from the left", -nz * 4, nx * 4, true],
    ["from the right", nz * 4, -nx * 4, true],
  ];
  for (const [name, ox, oz, run] of ways) {
    const r = throwFrom(pad, ox, oz, run);
    if (!r.in) missed.push(`${(pad.x - BR_X).toFixed(1)},${(pad.z - BR_Z).toFixed(1)} ${name}`);
    worst = { under: Math.min(worst.under, r.clear.under), over: Math.min(worst.over, r.clear.over), side: Math.min(worst.side, r.clear.side) };
  }
}
check(
  `every window pad (${pads.length}) throws you through its window onto the lobby's floor from standing, a run and either side, with 0.4 m clear of its frame on every side`,
  pads.length > 0 && missed.length === 0 && worst.under >= 0.4 && worst.over >= 0.4 && worst.side >= 0.4,
  `${missed.length ? `missed: ${missed.slice(0, 6).join("; ")}` : "all in"}; least clear: under ${worst.under.toFixed(2)} m, over ${worst.over.toFixed(2)} m, either side ${worst.side.toFixed(2)} m`,
);
// the towers the pads serve: the solid a metre in behind each pad's face, under the lobby, is its tower; a bridge's
// or a canyon's end is a way in too
const byTower = new Map<string, number>();
const towerAt = (x: number, z: number, floor: number) => RANGE_SOLIDS.find((s) => x > s.minX && x < s.maxX && z > s.minZ && z < s.maxZ && Math.abs(s.top - floor) < 0.05);
for (const e of [...LOBBY_BRIDGES, ...LOBBY_CANYONS]) {
  const len = Math.hypot(e.bx - e.ax, e.bz - e.az);
  const ux = (e.bx - e.ax) / len;
  const uz = (e.bz - e.az) / len;
  for (const [x, z] of [
    [e.ax - ux, e.az - uz],
    [e.bx + ux, e.bz + uz],
  ]) {
    const tw = towerAt(x, z, e.y);
    const key = tw ? `${tw.minX.toFixed(1)},${tw.minZ.toFixed(1)}` : `none ${x.toFixed(0)},${z.toFixed(0)}`;
    byTower.set(key, (byTower.get(key) ?? 0) + 1);
  }
}
for (const pad of pads) {
  const cp = asCourse(pad);
  const len = Math.hypot(cp.vx, cp.vz);
  const ix = cp.x + (cp.vx / len) * (chain.window.standOff + 1);
  const iz = cp.z + (cp.vz / len) * (chain.window.standOff + 1);
  const floor = cp.over - chain.window.overAt;
  const tower = RANGE_SOLIDS.find((s) => ix > s.minX && ix < s.maxX && iz > s.minZ && iz < s.maxZ && Math.abs(s.top - floor) < 0.05);
  const key = tower ? `${tower.minX.toFixed(1)},${tower.minZ.toFixed(1)}` : `none ${ix.toFixed(0)},${iz.toFixed(0)}`;
  byTower.set(key, (byTower.get(key) ?? 0) + 1);
}
const twoSided = [...byTower.values()].filter((n) => n >= 2).length;
check(
  "every lobby has a way in, and most two or more (window pads, bridges, canyon windows; the survey found room for pads on two sides of 11 of 16)",
  ![...byTower.keys()].some((k) => k.startsWith("none")) && byTower.size === 16 && twoSided >= 12,
  `${byTower.size} lobbies, ${twoSided} with two ways in or more`,
);

/** from inside one lobby toward the other along a bridge or a canyon's line: a run (and at a canyon a jump at the window); true when it lands clean on the far lobby's floor (a climb or a mantle catches a sill a run off falls short of, so neither counts, as the gaps' proofs have it) */
function across(e: (typeof LOBBY_BRIDGES)[number], jump: boolean): { in: boolean; y: number } {
  const len = Math.hypot(e.bx - e.ax, e.bz - e.az);
  const ux = (e.bx - e.ax) / len;
  const uz = (e.bz - e.az) / len;
  const home = towerAt(e.ax - ux, e.az - uz, e.y);
  // as far back in the lobby as it has room for, to eight metres
  let back = 8;
  while (back > 1.5 && !towerAt(e.ax - ux * back, e.az - uz * back, e.y)) back -= 0.5;
  if (!home) return { in: false, y: 0 };
  const p = new Player({ minX: BR_X - 400, maxX: BR_X + 400, minZ: BR_Z - 400, maxZ: BR_Z + 400 });
  p.extraMoves = true;
  p.autoClimb = true;
  p.sprintMode = "auto";
  p.teleport(e.ax - ux * (back - 0.8), e.y, e.az - uz * (back - 0.8), (Math.atan2(-ux, -uz) * 180) / Math.PI);
  const s = new Script();
  s.down.add("forward");
  let t = 1000;
  let jumped = false;
  let low = Infinity;
  let climbed = false;
  for (let i = 0; i < 6 / DT; i++) {
    t += DT;
    // the jump at the window: the body's front at the face
    const along = (p.pos.x - e.ax) * ux + (p.pos.z - e.az) * uz;
    if (jump && !jumped && p.onGround && along > -MOVE.radius - 0.2) {
      s.taps.add("jump");
      jumped = true;
    }
    p.update(DT, t, s, 0, 1, false);
    s.taps.clear();
    low = Math.min(low, p.pos.y);
    if (p.climbing || p.stance === "mantle") climbed = true;
    const past = (p.pos.x - e.bx) * ux + (p.pos.z - e.bz) * uz;
    if (p.onGround && past > 1 && Math.abs(p.pos.y - e.y) < 0.15) return { in: !climbed, y: low };
    if (p.pos.y < e.y - 3) break;
  }
  return { in: false, y: low };
}
const canyons = LOBBY_CANYONS.map((e) => ({ e, r: across(e, true), fall: across(e, false) }));
check(
  `every canyon between two lobbies (${LOBBY_CANYONS.length}) is a sprint jump from one window through the other onto its floor, clean; running off without the jump is not (at best a mantle over the far sill)`,
  LOBBY_CANYONS.length > 0 && canyons.every((c) => c.r.in && !c.fall.in),
  canyons.filter((c) => !c.r.in || c.fall.in).map((c) => `${(c.e.ax - BR_X).toFixed(0)},${(c.e.az - BR_Z).toFixed(0)}: ${c.r.in ? "in" : "short"}${c.fall.in ? ", and in without a jump" : ""}`).join("; ") || "all",
);
const bridges = LOBBY_BRIDGES.map((e) => ({ e, r: across(e, false) }));
check(
  `every bridge between two lobbies (${LOBBY_BRIDGES.length}) runs from one lobby's window to the other's, onto its floor, without a fall`,
  LOBBY_BRIDGES.length > 0 && bridges.every((b) => b.r.in && b.r.y > b.e.y - 0.3),
  bridges.map((b) => `${Math.hypot(b.e.bx - b.e.ax, b.e.bz - b.e.az).toFixed(0)} m: ${b.r.in ? "in" : "not"}`).join("; "),
);
console.log(`        ${pads.length} window pads`);
console.log(fails === 0 ? "\nSK LOBBIES PASS" : `\nSK LOBBIES FAIL (${fails})`);
process.exit(fails === 0 ? 0 : 1);
