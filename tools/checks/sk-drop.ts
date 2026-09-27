// The Spire's drop (city.json spire drop, city.ts SPIRE_DROP): the shaft down inside the Spire from its top tier's
// roof to the podium, and the doors out of it at its foot and at the Sky Park's height. Run with the real movement over
// the real city: the shaft open top to bottom, a step into its mouth landing at its foot, out of the foot's door onto
// the podium's terrace, and in from the Sky Park's terrace and down.
//
// Run: GAME=speedkills npx tsx tools/checks/sk-drop.ts
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
const { buildCityMap, SPIRE_DROP } = await import("../../src/game/city");
const { Player } = await import("../../src/game/player");
const { solidHit } = await import("../../src/game/projectile");
const { BR_X, BR_Z } = await import("../../src/game/br");
buildCityMap(new THREE.Scene());
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
const DT = 1 / 144;
const yawTo = (dx: number, dz: number): number => (Math.atan2(-dx, -dz) * 180) / Math.PI;
/** from (x, y, z) forward toward (dx, dz) while `hold` says so (seconds held, or the body's place), then let go; where it stood after `seconds`, and the time it first stood low */
function walk(x: number, y: number, z: number, dx: number, dz: number, hold: number | ((p: { x: number; z: number }) => boolean), seconds: number, low = -Infinity): { x: number; y: number; z: number; t: number } {
  const p = new Player({ minX: BR_X - 400, maxX: BR_X + 400, minZ: BR_Z - 400, maxZ: BR_Z + 400 });
  p.extraMoves = true;
  p.autoClimb = true;
  p.sprintMode = "auto";
  p.teleport(x, y, z, yawTo(dx, dz));
  const s = new Script();
  s.down.add("forward");
  let t = 1000;
  let at = Infinity;
  for (let i = 0; i < seconds / DT; i++) {
    t += DT;
    if (typeof hold === "number" ? i * DT > hold : !hold(p.pos)) s.down.delete("forward");
    p.update(DT, t, s, 0, 1, false);
    if (at === Infinity && p.onGround && p.pos.y < low) at = i * DT;
  }
  return { x: p.pos.x, y: p.pos.y, z: p.pos.z, t: at };
}

console.log(`\nThe Spire's drop (game: ${GAME})`);
check("this runs with SpeedKills' movement", GAME === "speedkills");
const S = SPIRE_DROP.shaft;
const mx = (S.minX + S.maxX) / 2;
const mz = (S.minZ + S.maxZ) / 2;
const fall = SPIRE_DROP.top - SPIRE_DROP.foot;
check("the shaft runs from the top tier's roof to the podium, a hundred metres and more", fall > 100 && SPIRE_DROP.doors.length === 2, `${SPIRE_DROP.top.toFixed(1)} to ${SPIRE_DROP.foot.toFixed(1)} m`);
const hit = solidHit(new THREE.Vector3(mx, SPIRE_DROP.top + 2, mz), new THREE.Vector3(0, -1, 0), fall + 10);
check("and it is open all the way: a line down its middle meets nothing until its foot", Math.abs(hit - (fall + 2)) < 0.05, `${hit.toFixed(2)} m of ${(fall + 2).toFixed(2)}`);
// into the mouth from the roof beside it, and down
const edge = walk(S.maxX + 1.5, SPIRE_DROP.top + 0.01, mz, -1, 0, 0.3, 6, SPIRE_DROP.foot + 0.5);
check(
  `a step into its mouth from the roof beside it lands at its foot, ${fall.toFixed(0)} m down, in under five seconds`,
  Math.abs(edge.y - SPIRE_DROP.foot) < 0.1 && edge.x > S.minX - 0.1 && edge.x < S.maxX + 0.1 && edge.t < 5,
  `at ${edge.y.toFixed(2)} m after ${edge.t.toFixed(2)} s`,
);
// out of the foot's door
const [foot, park] = [...SPIRE_DROP.doors].sort((a, b) => a.y - b.y);
// (forward until through the door: a sprint on runs off the 5 m terrace into the street)
const out = walk(mx, SPIRE_DROP.foot + 0.01, mz, 0, 1, (q) => q.z < foot.maxZ + 0.5, 3);
check("and out of the door at its foot onto the podium's terrace", Math.abs(out.y - SPIRE_DROP.foot) < 0.1 && out.z > foot.maxZ + 0.3, `at ${out.y.toFixed(2)} m, ${(out.z - foot.maxZ).toFixed(1)} m out of the door`);
// in from the Sky Park's terrace, through its door, and down the shaft
const inPark = walk((park.minX + park.maxX) / 2, park.y + 0.01, park.maxZ + 1.5, 0, -1, 1.2, 7, SPIRE_DROP.foot + 0.5);
check(
  "and from the Sky Park's terrace in through its door and down the shaft to the foot",
  Math.abs(inPark.y - SPIRE_DROP.foot) < 0.1 && inPark.z > S.minZ - 0.1 && inPark.z < S.maxZ + 0.1,
  `at ${inPark.y.toFixed(2)} m`,
);
console.log(fails === 0 ? "\nSK DROP PASS" : `\nSK DROP FAIL (${fails})`);
process.exit(fails === 0 ? 0 : 1);
