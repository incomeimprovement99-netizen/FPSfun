// The centre's steam and flickering signs (Phase 22.2; city.json steam and flicker, steam.ts): where the steam rises
// and how much of it there is, and that no sign ever flashes more than three times in a second (the photosensitive
// line, WCAG 2.3.1), sampled over ten minutes of every flickering sign's light. And the haze (Phase 23.4b, atmosphere.ts):
// its colour a block's, its reach growing as you climb, the hour's fog given back when you leave or it is off.
//
// Run: GAME=speedkills npx tsx tools/checks/sk-atmosphere.ts
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
const { buildCityMap, STEAM_SOURCES, FLICKER_SIGNS, KIT_SITES } = await import("../../src/game/city");
const { steamPuff, cityFlicker } = await import("../../src/game/steam");
const { RANGE_SOLIDS } = await import("../../src/game/range");
const { BR_X, BR_Z, BR_HALF } = await import("../../src/game/br");
const cityCfg = (await import("../../src/config/city.json")).default;
const map = buildCityMap(new THREE.Scene());
console.warn = warn;
if (!hadDocument) delete g.document;

let fails = 0;
function check(label: string, cond: boolean, detail = ""): void {
  if (!cond) fails++;
  console.log(`${cond ? "  ok  " : "FAIL  "}${label}${detail ? ` (${detail})` : ""}`);
}
const S = cityCfg.steam;
const Fl = cityCfg.flicker;

console.log(`\nThe centre's steam and flickering signs (game: ${GAME})`);
check("this runs with SpeedKills' city", GAME === "speedkills");

// ---- the steam
const kinds = new Map<string, number>();
for (const s of STEAM_SOURCES) kinds.set(s.kind, (kinds.get(s.kind) ?? 0) + 1);
check("steam rises out of the metro's stairwells, off drains at the kerbs and off roof plant", ["metro", "drain", "vent"].every((k) => (kinds.get(k) ?? 0) > 0), [...kinds].map(([k, n]) => `${n} ${k}`).join(", "));
const puffs = Math.min(S.cap, STEAM_SOURCES.length * S.perSource);
check("within its cap of puffs, two triangles each, one draw", puffs <= S.cap && STEAM_SOURCES.length * S.perSource <= S.cap, `${STEAM_SOURCES.length} sources, ${puffs} puffs, ${puffs * 2} triangles`);
const local = STEAM_SOURCES.map((s) => ({ ...s, lx: s.x - BR_X, lz: s.z - BR_Z }));
const nearPad = local.filter((s) => map.pads.some((p) => Math.hypot(p.x - s.x, p.z - s.z) < S.clear));
check(`none within ${S.clear} m of a pad's column, a fire escape or a parked car`, nearPad.length === 0 && local.every((s) => !KIT_SITES.escapes.some((e) => s.lx > e.x0 - 1 && s.lx < e.x1 + 1 && s.lz > e.z0 - 1 && s.lz < e.z1 + 1) && !KIT_SITES.cars.some((c) => Math.hypot(c.x - s.lx, c.z - s.lz) < S.clear)), nearPad.map((s) => `${s.kind} at ${s.lx.toFixed(0)},${s.lz.toFixed(0)}`).slice(0, 3).join("; ") || "clear");
const buried = STEAM_SOURCES.filter((s) => RANGE_SOLIDS.some((b) => s.x > b.minX && s.x < b.maxX && s.z > b.minZ && s.z < b.maxZ && s.y + 0.3 > b.base && s.y + 0.3 < b.top));
check("every source in the open: none rises from inside something solid", buried.length === 0, buried.map((s) => `${s.kind} at ${(s.x - BR_X).toFixed(0)},${(s.z - BR_Z).toFixed(0)}`).slice(0, 3).join("; ") || "all open");
// a puff through its life: rising, growing, brightest halfway, dark at both ends
{
  const v = new THREE.Vector3();
  const life: Array<{ y: number; size: number; bright: number }> = [];
  for (let t = 0; t < S.life; t += S.life / 50) {
    const p = steamPuff(0, 0, t, v);
    life.push({ y: v.y, size: p.size, bright: p.bright });
  }
  const top = Math.max(...life.map((p) => p.y)) - STEAM_SOURCES[0].y;
  const peak = Math.max(...life.map((p) => p.bright));
  check("a puff rises its height, never brighter than its peak, and fades out at both ends of its life", top <= S.rise + 0.01 && top > S.rise * 0.9 && peak <= S.peak + 1e-9 && Math.min(...life.map((p) => p.bright)) < S.peak * 0.1, `rises ${top.toFixed(2)} m, peak ${peak.toFixed(3)}`);
}

// ---- the flicker
check("the flickering signs are the centre's, as many as the config says, each in a material of its own", FLICKER_SIGNS.length === Fl.signs && new Set(FLICKER_SIGNS.map((f) => f.material)).size === FLICKER_SIGNS.length, `${FLICKER_SIGNS.length} signs`);
{
  const STEP = 0.002;
  const SPAN = 600;
  let worst = 0;
  let dims = 0;
  let dipped = 0;
  let bad = 0;
  for (const f of FLICKER_SIGNS) {
    const starts: number[] = [];
    let was = 1;
    for (let t = 0; t < SPAN; t += STEP) {
      const v = cityFlicker(t, f.seed);
      if (v < 1) {
        dipped++;
        if (v < Fl.dip[0] - 1e-9 || v > Fl.dip[1] + 1e-9) bad++;
        if (was === 1) starts.push(t);
      }
      was = v;
    }
    dims += starts.length;
    // the most dips starting inside any one second
    let j = 0;
    for (let i = 0; i < starts.length; i++) {
      while (starts[i] - starts[j] >= 1) j++;
      worst = Math.max(worst, i - j + 1);
    }
  }
  const share = dipped / ((SPAN / STEP) * Math.max(1, FLICKER_SIGNS.length));
  check("the signs do flicker, briefly: dimmed a small share of the time", dims > 0 && share < 0.05, `${dims} dips over ten minutes of ${FLICKER_SIGNS.length} signs, dimmed ${(share * 100).toFixed(2)}% of the time`);
  check("never more than three flashes in any second (WCAG 2.3.1)", worst <= 3, `at most ${worst} in a second`);
  check("each dip to between its lowest and highest", bad === 0, `${bad} samples outside ${Fl.dip[0]} to ${Fl.dip[1]}`);
}

// ---- the haze: off, the fog is the hour's; on, in a block the fog takes that block's colour, starts near and thins as
// you climb, and leaving the city gives the hour's fog back
{
  console.log("\nThe haze");
  const { atmosphereOn, tickAir } = await import("../../src/game/atmosphere");
  const A = cityCfg.atmosphere;
  const kitCfg = (await import("../../src/config/citykit.json")).default;
  const scene = new THREE.Scene();
  const hourFog = new THREE.Fog(0x101018, 30, 600);
  scene.fog = hourFog.clone();
  const cam = new THREE.PerspectiveCamera();
  const blocks = cityCfg.blocks as Array<[number, number]>;
  const mid = (blocks.length - 1) / 2;
  const nw = (blocks[mid - 1][0] + blocks[mid - 1][1]) / 2;
  // the north-west block's family, and a camera in its middle
  const fam = (kitCfg.dress.families as Record<string, string>)["0,0"] as keyof typeof A.night;
  const at = (x: number, y: number, z: number) => cam.position.set(x + BR_X, y, z + BR_Z);
  const run = (seconds: number, t0: number) => {
    for (let t = 0; t <= seconds; t += 0.1) tickAir(scene, cam, t0 + t, false);
  };
  const fog = scene.fog as THREE.Fog;
  const isHour = () => fog.color.equals(hourFog.color) && fog.near === hourFog.near && fog.far === hourFog.far;
  atmosphereOn(false);
  at(nw, 2, nw);
  run(3, 0);
  check("off (Competitive), the fog is the hour's", isHour());
  atmosphereOn(true);
  run(12, 10);
  const want = new THREE.Color(A.night[fam]);
  const off = Math.abs(fog.color.r - want.r) + Math.abs(fog.color.g - want.g) + Math.abs(fog.color.b - want.b);
  check(`on, in the ${fam} block the fog is the ${fam} colour (${A.night[fam]}), starting ${A.near} m off`, off < 0.08 && fog.near === A.near && fog.far === A.far, `#${fog.color.getHexString()}, ${fog.near} to ${fog.far} m`);
  at(nw, 80, nw);
  run(1, 30);
  check("and thinner up a tower: 80 m up it reaches further, never past the hour's", fog.far > A.far && fog.far <= hourFog.far, `${fog.far.toFixed(0)} m`);
  at(BR_HALF + A.margin + 50, 2, 0);
  run(1, 40);
  check("leaving the city gives the hour's fog back", isHour(), `#${fog.color.getHexString()}, ${fog.near} to ${fog.far} m`);
  atmosphereOn(false);
}
console.log(fails === 0 ? "\nSK ATMOSPHERE PASS" : `\nSK ATMOSPHERE FAIL (${fails})`);
process.exit(fails === 0 ? 0 : 1);
