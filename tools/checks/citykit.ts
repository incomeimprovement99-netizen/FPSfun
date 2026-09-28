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
const cityCfg = (await import("../../src/config/city.json")).default;
const scene = new THREE.Scene();
const map = buildCityMap(scene);
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
// the packs hold only the pieces the dressing named when they were baked (Phase 23.1): a piece named since, with no
// re-bake, would be in no pack and silently not drawn
{
  const baked = new Set((kit as unknown as { baked?: string[] }).baked ?? []);
  const { cityKitTraffic } = await import("../../src/game/citydress");
  const missing = [...new Set([...places, ...cityKitPlaces(map.pads, true)].map((p) => p.piece).concat(cityKitTraffic().map((c) => c.piece)))].filter((id) => !baked.has(id));
  check("and in the packs as baked (citykit.json baked): every piece any preset places, the flying cars too", baked.size > 0 && missing.length === 0, missing.slice(0, 5).join(", ") || `${baked.size} pieces baked`);
}

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
    // a door the city cut there (the Spire's drop) is left bare: look beside it
    const door = KIT_SITES.doors.find((q) => mid.x > q.x0 - 0.5 && mid.x < q.x1 + 0.5 && mid.z > q.z0 - 0.5 && mid.z < q.z1 + 0.5 && mid.y > q.y0 && mid.y < q.y1);
    if (door) {
      if (key === "n" || key === "s") mid.x = door.x1 + 2;
      else mid.z = door.z1 + 2;
    }
    const hit = facades.some(({ b }) => b.clone().expandByScalar(0.3).containsPoint(mid));
    if (!hit) bare.push(`${key} face of the tower at ${t.x.toFixed(1)}, ${t.z.toFixed(1)} (base ${t.base.toFixed(1)}, ${t.storeys} storeys)`);
  }
}
check(`every face of the centre's ${towers.length} towers wears its facade at its first storey`, bare.length === 0, bare.slice(0, 4).join("; "));
// Every storey of every face, covered end to end (Phase 23.2): once the kit dresses the centre, its towers' own outward
// faces stop drawing (city.ts skins), so a bay the kit leaves open would be a hole into the tower. A storey that is a
// room of its own (the lobby's, the Sky Park's, an open floor) keeps its walls, and a door's width is open by design.
{
  const storey = cityCfg.storey;
  const holes: string[] = [];
  let storeys = 0;
  for (const t of towers) {
    const rooms = [t.lobby, t.park, ...(t.floors ?? [])].filter((v): v is number => v !== undefined);
    for (const [key, alongX, at, a0, a1] of [
      ["n", true, t.z - t.d / 2, t.x - t.w / 2, t.x + t.w / 2],
      ["s", true, t.z + t.d / 2, t.x - t.w / 2, t.x + t.w / 2],
      ["w", false, t.x - t.w / 2, t.z - t.d / 2, t.z + t.d / 2],
      ["e", false, t.x + t.w / 2, t.z - t.d / 2, t.z + t.d / 2],
    ] as const) {
      for (let s = 0; s < t.storeys; s++) {
        const y = t.base + s * storey;
        if (rooms.some((r) => Math.abs(r - y) < 0.5)) continue;
        storeys++;
        const mid = y + storey / 2;
        // the pieces across this face at this storey: their span along it, where their bounds take in the face's plane
        const spans = facades
          .filter(({ b }) => b.min.y < mid && b.max.y > mid && (alongX ? b.min.z - 0.2 <= at && b.max.z + 0.2 >= at : b.min.x - 0.2 <= at && b.max.x + 0.2 >= at))
          .map(({ b }) => (alongX ? [b.min.x, b.max.x] : [b.min.z, b.max.z]) as [number, number]);
        for (const q of KIT_SITES.doors)
          if (q.y0 < mid && q.y1 > mid && (alongX ? q.z0 - 0.6 <= at && q.z1 + 0.6 >= at : q.x0 - 0.6 <= at && q.x1 + 0.6 >= at)) spans.push(alongX ? [q.x0, q.x1] : [q.z0, q.z1]);
        spans.sort((p, q) => p[0] - q[0]);
        let reach = a0;
        let gap = 0;
        for (const [p, q] of spans) {
          if (p > reach) gap = Math.max(gap, Math.min(p, a1) - reach);
          reach = Math.max(reach, q);
        }
        if (reach < a1) gap = Math.max(gap, a1 - reach);
        if (gap > 0.3) holes.push(`${key} face at ${t.x.toFixed(0)}, ${t.z.toFixed(0)}, ${y.toFixed(0)} m: ${gap.toFixed(1)} m open`);
      }
    }
  }
  check("every storey of every face of the centre's towers covered end to end by the kit, so their own faces can stop drawing", holes.length === 0, holes.slice(0, 4).join("; ") || `${storeys} face storeys`);
}
check("the centre's podiums wear shop fronts on their street floors", (byKind.get("shop") ?? 0) >= 40, `${byKind.get("shop") ?? 0} shop fronts`);
check("the skyline's towers each wear a lit building from the bundle", (byKind.get("skyline") ?? 0) === KIT_SITES.skyline.length, `${byKind.get("skyline") ?? 0} of ${KIT_SITES.skyline.length}`);

// what the kit hides once it has drawn over it (city.ts STAND_INS) is the stalls' alone: flat() and emissive() share a
// material a colour, and hiding a shared one took every parapet in the city and the centre's cyan neon with it
{
  const { STAND_INS } = await import("../../src/game/city");
  const users = new Map<THREE.Material, number>();
  scene.traverse((o) => {
    const m = (o as THREE.Mesh).material as THREE.Material | undefined;
    if ((o as THREE.Mesh).isMesh && m && STAND_INS.stalls.includes(m)) users.set(m, (users.get(m) ?? 0) + 1);
  });
  const stalls = KIT_SITES.stalls.length;
  check(
    "what the kit hides over the stalls is the stalls' own: each stand-in material on the stalls' meshes and nothing else",
    STAND_INS.stalls.length === 2 && STAND_INS.stalls.every((m) => users.get(m) === stalls),
    STAND_INS.stalls.map((m) => `${users.get(m) ?? 0} meshes`).join(", ") + ` for ${stalls} stalls`,
  );
  // the centre's cars: five meshes a car (body, cabin, sill, head and tail lights), all in the centre's own materials
  let carMeshes = 0;
  scene.traverse((o) => {
    const m = (o as THREE.Mesh).material as THREE.Material | undefined;
    if ((o as THREE.Mesh).isMesh && m && STAND_INS.cars.includes(m)) carMeshes++;
  });
  const dressedCars = places.filter((p) => p.kind === "car").length;
  // the Spire's machinery: one mesh each, in its own material
  let machineMeshes = 0;
  scene.traverse((o) => {
    const m = (o as THREE.Mesh).material as THREE.Material | undefined;
    if ((o as THREE.Mesh).isMesh && m && STAND_INS.machinery.includes(m)) machineMeshes++;
  });
  const machinePieces = new Set([kit.dress.machinery.stack, kit.dress.machinery.machine]);
  check(
    "the Spire's machinery: each of its boxes wearing its Glass piece, and what the kit hides over them theirs alone",
    KIT_SITES.machinery.length === 5 && machineMeshes === 5 && places.filter((p) => machinePieces.has(p.piece)).length === 5,
    `${KIT_SITES.machinery.length} boxes, ${machineMeshes} meshes in their material`,
  );
  check(
    "and what it hides over the centre's cars is theirs alone, every one of them wearing a van",
    KIT_SITES.cars.length > 0 && carMeshes === 5 * KIT_SITES.cars.length && dressedCars === KIT_SITES.cars.length,
    `${KIT_SITES.cars.length} cars, ${dressedCars} vans, ${carMeshes} meshes in their materials`,
  );
}

// Neon Alley (city.json neonAlley, the plan's 4.3.1): its stalls each a stand, signs up its towers, a web over it
{
  const NA = (await import("../../src/config/city.json")).default.neonAlley;
  const lines = (await import("../../src/config/city.json")).default.blocks.slice(0, -1).map((b: number[], i: number, all: number[][]) => (b[1] + (all[i + 1] ?? b)[0]) / 2);
  const z0 = lines[NA.street];
  const inAlley = (p: (typeof places)[number]) => {
    const b = bounds(p);
    const cx = (b.min.x + b.max.x) / 2;
    const cz = (b.min.z + b.max.z) / 2;
    return cx > NA.from - 1 && cx < NA.to + 1 && Math.abs(cz - z0) < 20;
  };
  const stands = new Set(kit.dress.alley.stands);
  const dressed = places.filter((p) => stands.has(p.piece)).length;
  const signs = places.filter((p) => (p.kind === "sign" || p.kind === "blade") && inAlley(p)).length;
  const cables = places.filter((p) => p.kind === "cable" && inAlley(p)).length;
  check(
    "Neon Alley: every stall wears a food stand, its towers carry 30 signs and more, a web of 10 cables and more crosses it",
    KIT_SITES.stalls.length === NA.stalls.length && dressed === KIT_SITES.stalls.length && signs >= 30 && cables >= 10,
    `${dressed} of ${KIT_SITES.stalls.length} stalls, ${signs} signs, ${cables} cables`,
  );
}

// the movement's volumes are clear of anything that stands out of a wall (the plan's rules 1, 2 and 4)
// a facade module stands out of its building by its relief (citykit.json plane): past the plan's 0.15 m it counts
const standOut = places
  .filter((p) => !["flat", "podium", "parapet", "shop", "skyline", "zeppelin", "roof"].includes(p.kind) && !(p.kind === "facade" && Math.min(planeOf(p.piece), kit.dress.relief) + kit.dress.outset <= 0.15))
  .map((p) => ({ p, b: bounds(p) }));
const clashes: string[] = [];
for (const c of CHIMNEYS) {
  const vol = new THREE.Box3(new THREE.Vector3(c.x - BR_X - c.innerW / 2, c.base, c.z0 - BR_Z), new THREE.Vector3(c.x - BR_X + c.innerW / 2, c.summit + 2, c.z1 - BR_Z));
  for (const { p, b } of standOut) if (b.intersectsBox(vol)) clashes.push(`${p.piece} in the ${c.name} chimney`);
}
for (const pad of map.pads) {
  const x = pad.x - BR_X, z = pad.z - BR_Z, y0 = pad.y ?? 0;
  const up = pad.up ?? 0;
  const top = y0 + (up * up) / (2 * 17.5) + 2;
  const col = new THREE.Box3(new THREE.Vector3(x - 1.2, y0 + 0.2, z - 1.2), new THREE.Vector3(x + 1.2, top, z + 1.2));
  for (const { p, b } of standOut) if (b.intersectsBox(col)) clashes.push(`${p.piece} over the pad at ${x.toFixed(1)}, ${z.toFixed(1)}`);
}
// every room's windows (the Sky Lobby's and the Sky Park's, KIT_SITES rooms): nothing of the kit across one, a metre out
// of the face and up the window's height (the band beside them stands flush, rule 1)
const win = (await import("../../src/config/city.json")).default.skyLobby;
for (const r of KIT_SITES.rooms) {
  const name = r.y > 60 ? "Sky Park" : "Sky Lobby";
  for (const [key, nx, nz] of [
    ["n", 0, -1],
    ["s", 0, 1],
    ["w", -1, 0],
    ["e", 1, 0],
  ] as const) {
    const c = (nx === 0 ? r.x : r.z) + r.at[key];
    const at = nx === 0 ? r.z + (nz * r.d) / 2 : r.x + (nx * r.w) / 2;
    const [x0, x1] = nx === 0 ? [c - win.width / 2 + 0.05, c + win.width / 2 - 0.05] : [Math.min(at, at + nx * 1.0), Math.max(at, at + nx * 1.0)];
    const [z0, z1] = nx === 0 ? [Math.min(at, at + nz * 1.0), Math.max(at, at + nz * 1.0)] : [c - win.width / 2 + 0.05, c + win.width / 2 - 0.05];
    const box = new THREE.Box3(new THREE.Vector3(x0, r.y + 0.1, z0), new THREE.Vector3(x1, r.y + win.height - 0.1, z1));
    for (const { p, b } of [...standOut, ...facades]) if (p.kind !== "billboard" && b.intersectsBox(box)) clashes.push(`${p.piece} across a ${name}'s window at ${r.x.toFixed(1)}, ${r.z.toFixed(1)}`);
  }
}
// and nothing of the kit across a door the city cut (a stair core's, the drop's): the facade narrowed either side, the
// Spire's billboard and the alley's signs beside them
const doorsCrossed: string[] = [];
for (const d of KIT_SITES.doors) {
  const box = new THREE.Box3(new THREE.Vector3(d.x0 + 0.05, d.y0 + 0.3, d.z0 + 0.05), new THREE.Vector3(d.x1 - 0.05, d.y1 - 0.3, d.z1 - 0.05));
  // (a fire escape's pieces stand in front of its own doorways, as the landing the door opens onto)
  for (const p of places) if (p.kind !== "escape" && bounds(p).intersectsBox(box)) doorsCrossed.push(`${p.piece} over the door at ${((d.x0 + d.x1) / 2).toFixed(1)}, ${((d.z0 + d.z1) / 2).toFixed(1)}`);
}
check(`nothing of the kit across any of the ${KIT_SITES.doors.length} doors the city cut in its towers`, doorsCrossed.length === 0, doorsCrossed.slice(0, 3).join("; "));
const flatBad = places.filter((p) => p.kind === "flat" && (p.out ?? Math.min(planeOf(p.piece), kit.dress.relief) + kit.dress.outset) > 0.15);
check("a canyon's faces (their tower's rows pressed flat) and a pad's climb (flat panels) stand within 0.15 m of the wall (the plan's rule 1)", flatBad.length === 0, flatBad.slice(0, 3).map((p) => p.piece).join(", "));
check("nothing stands out of a wall in a chimney, a pad's column or across the Sky Lobby's or the Sky Park's windows", clashes.length === 0, `${clashes.length}: ${clashes.slice(0, 4).join("; ")}`);

// the triangles each preset draws, off the measured pieces
// the competitive preset wears the lean modules (citykit.json dress lean)
const leanPlaces = cityKitPlaces(map.pads, true);
// the flying traffic (citydress cityKitTraffic), drawn from Balanced up
const { cityKitTraffic } = await import("../../src/game/citydress");
const traffic = cityKitTraffic();
const trafficTris = traffic.reduce((a, c) => a + (measured[c.piece]?.[6] ?? 0), 0);
check("the flying traffic: every car a piece the importer baked, on its loop", traffic.length >= 12 && traffic.every((c) => measured[c.piece] && c.standing), `${traffic.length} cars, ${(trafficTris / 1000).toFixed(0)}k triangles`);
const tris = (tier: number) => (tier === 0 ? leanPlaces : places).filter((p) => p.tier <= tier).reduce((a, p) => a + (measured[p.piece]?.[6] ?? 0), 0) + (tier >= 1 ? trafficTris : 0);
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
