// The city bundle on SpeedKills' centre (citydress.ts, docs/CITY_BUNDLE_IMPLEMENTATION.md section 4.6): every piece
// placed is one the importer baked and measured, the centre's towers and podiums are dressed, and nothing that stands
// out of a wall sits in a chimney, a pad's column or the Sky Lobby's storey, where the movement lives. Its triangles
// per graphics preset are counted off the measured pieces, so the budget holds without the bought files present,
// which is how verify runs everywhere but the owner's machine.
//
// It needs the game named: GAME=speedkills npx tsx tools/checks/citykit.ts (verify runs it that way). REPORT=1 prints
// the counts by kind and the faces left bare.
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
const { IS_SK } = await import("../../src/game/game");
const { buildCityMap, KIT_SITES, CHIMNEYS } = await import("../../src/game/city");
const { cityKitPlaces, planeOf } = await import("../../src/game/citydress");
const { PRESETS } = await import("../../src/game/quality");
const { BR_X, BR_Z } = await import("../../src/game/br");
const kit = (await import("../../src/config/citykit.json")).default;
const map = buildCityMap(new THREE.Scene());
console.warn = warn;
if (!hadDocument) delete g.document;
let fails = 0;
function check(label: string, cond: boolean, detail = ""): void {
  if (!cond) fails++;
  console.log(`${cond ? "  ok  " : "FAIL  "}${label}${detail ? ` (${detail})` : ""}`);
}
console.log("The city bundle on the centre");
check("this is SpeedKills (the city is its map)", IS_SK);
const places = cityKitPlaces(map.pads);
const measured = kit.measured as unknown as Record<string, number[]>;
check("every piece placed is one the importer baked and measured (citykit.json measured)", places.every((p) => measured[p.piece]), [...new Set(places.filter((p) => !measured[p.piece]).map((p) => p.piece))].join(", "));

/** a placed piece's bounds, map-local, from its measured box through its matrix */
function bounds(p: (typeof places)[number]): THREE.Box3 {
  const m = measured[p.piece];
  const box = new THREE.Box3(new THREE.Vector3(m[3], m[4], m[5]), new THREE.Vector3(m[3] + m[0], m[4] + m[1], m[5] + m[2]));
  return box.applyMatrix4(p.m);
}
const byKind = new Map<string, number>();
for (const p of places) byKind.set(p.kind, (byKind.get(p.kind) ?? 0) + 1);

// every centre tower's four faces carry facade modules, but for a storey (the lobby's) left open
const centre = kit.dress.centre;
const towers = KIT_SITES.towers.filter((t) => Math.abs(t.x) <= centre && Math.abs(t.z) <= centre);
const facades = places.filter((p) => p.kind === "facade" || p.kind === "flat").map((p) => ({ p, b: bounds(p) }));
const bare: string[] = [];
for (const t of towers) {
  for (const [key, fx, fz] of [
    ["n", t.x, t.z - t.d / 2],
    ["s", t.x, t.z + t.d / 2],
    ["w", t.x - t.w / 2, t.z],
    ["e", t.x + t.w / 2, t.z],
  ] as const) {
    const mid = new THREE.Vector3(fx, t.base + 2, fz);
    const hit = facades.some(({ b }) => b.clone().expandByScalar(0.3).containsPoint(mid));
    if (!hit) bare.push(`${key} face of the tower at ${t.x.toFixed(1)}, ${t.z.toFixed(1)} (base ${t.base.toFixed(1)}, ${t.storeys} storeys)`);
  }
}
check(`every face of the centre's ${towers.length} towers wears its facade at its first storey`, bare.length === 0, bare.slice(0, 4).join("; "));
check("the centre's podiums wear shop fronts on their street floors", (byKind.get("shop") ?? 0) >= 40, `${byKind.get("shop") ?? 0} shop fronts`);
check("the skyline's towers each wear a lit building from the bundle", (byKind.get("skyline") ?? 0) === KIT_SITES.skyline.length, `${byKind.get("skyline") ?? 0} of ${KIT_SITES.skyline.length}`);

// the movement's volumes are clear of anything that stands out of a wall (the plan's rules 1, 2 and 4)
// a facade module stands out of its building by its relief (citykit.json plane): past the plan's 0.15 m it counts
const standOut = places
  .filter((p) => !["flat", "podium", "parapet", "shop", "skyline", "zeppelin", "roof"].includes(p.kind) && !(p.kind === "facade" && Math.min(planeOf(p.piece), kit.dress.relief) + kit.dress.outset <= 0.15))
  .map((p) => ({ p, b: bounds(p) }));
const clashes: string[] = [];
for (const c of CHIMNEYS) {
  const vol = new THREE.Box3(new THREE.Vector3(c.x - BR_X - c.innerW / 2, c.base, c.z0 - BR_Z), new THREE.Vector3(c.x - BR_X + c.innerW / 2, c.top + 2, c.z1 - BR_Z));
  for (const { p, b } of standOut) if (b.intersectsBox(vol)) clashes.push(`${p.piece} in the ${c.name} chimney`);
}
for (const pad of map.pads) {
  const x = pad.x - BR_X, z = pad.z - BR_Z, y0 = pad.y ?? 0;
  const up = pad.up ?? 0;
  const top = y0 + (up * up) / (2 * 17.5) + 2;
  const col = new THREE.Box3(new THREE.Vector3(x - 1.2, y0 + 0.2, z - 1.2), new THREE.Vector3(x + 1.2, top, z + 1.2));
  for (const { p, b } of standOut) if (b.intersectsBox(col)) clashes.push(`${p.piece} over the pad at ${x.toFixed(1)}, ${z.toFixed(1)}`);
}
for (const t of towers) {
  for (const [name, y] of [["Sky Lobby", t.lobby], ["Sky Park", t.park]] as const) {
    if (y === undefined) continue;
    const lob = new THREE.Box3(new THREE.Vector3(t.x - t.w / 2 - 1.5, y + 0.1, t.z - t.d / 2 - 1.5), new THREE.Vector3(t.x + t.w / 2 + 1.5, y + kit.dress.outset + 3.9, t.z + t.d / 2 + 1.5));
    for (const { p, b } of [...standOut, ...facades]) if (p.kind !== "billboard" && b.intersectsBox(lob) && b.min.y > y - 0.5 && b.max.y < y + 4.5) clashes.push(`${p.piece} across a ${name}'s windows at ${t.x.toFixed(1)}, ${t.z.toFixed(1)}`);
  }
}
const flatBad = places.filter((p) => p.kind === "flat" && Math.min(planeOf(p.piece), kit.dress.relief) + kit.dress.outset > 0.15);
check("a canyon's faces and a pad's climb wear flat panels, within 0.15 m of the wall (the plan's rule 1)", flatBad.length === 0, flatBad.slice(0, 3).map((p) => p.piece).join(", "));
check("nothing stands out of a wall in a chimney, a pad's column or across the Sky Lobby's or the Sky Park's windows", clashes.length === 0, `${clashes.length}: ${clashes.slice(0, 4).join("; ")}`);

// the triangles each preset draws, off the measured pieces
// the competitive preset wears the lean modules (citykit.json dress lean)
const leanPlaces = cityKitPlaces(map.pads, true);
const tris = (tier: number) => (tier === 0 ? leanPlaces : places).filter((p) => p.tier <= tier).reduce((a, p) => a + (measured[p.piece]?.[6] ?? 0), 0);
const budget = kit.budget as Record<string, number>;
for (const [name, q] of Object.entries(PRESETS)) {
  const t = tris(q.cityDetail);
  check(`the ${name} preset draws the centre's bundle in ${(t / 1000).toFixed(0)}k triangles, inside its ${(budget[name] / 1000).toFixed(0)}k`, t <= budget[name]);
}
if (process.env.REPORT) {
  console.log("by kind:", [...byKind.entries()].map(([k, n]) => `${k} ${n}`).join(", "));
  const trisBy = new Map<string, number>();
  for (const p of places) trisBy.set(`${p.tier}:${p.kind}`, (trisBy.get(`${p.tier}:${p.kind}`) ?? 0) + (measured[p.piece]?.[6] ?? 0));
  console.log("triangles by tier and kind:", [...trisBy.entries()].sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} ${(n / 1000).toFixed(0)}k`).join(", "));
  const byPiece = new Map<string, number>();
  for (const p of places.filter((q) => q.tier === 0)) byPiece.set(p.piece, (byPiece.get(p.piece) ?? 0) + (measured[p.piece]?.[6] ?? 0));
  console.log("heaviest tier-0 pieces:", [...byPiece.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([k, n]) => `${k} ${(n / 1000).toFixed(0)}k`).join(", "));
  console.log(`bare faces (${bare.length}):\n  ${bare.join("\n  ")}`);
  console.log(`clashes (${clashes.length}):\n  ${clashes.slice(0, 30).join("\n  ")}`);
}
console.log(fails ? `\nCITYKIT FAIL (${fails})` : "\nCITYKIT PASS");
process.exit(fails ? 1 : 0);
