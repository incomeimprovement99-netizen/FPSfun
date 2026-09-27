// The centre's towers, measured for Sky Lobby window pads (Phase 21, the brief's 4.4: "window pads into every tower's
// deck floors from at least two sides"; the Sky Lobby deck is storey 8, about 32 m). For each tower in THE SPIRE
// sector tall enough to hold that storey with storeys above it: its footprint, base and roof, and for each face the
// open floor in front of it at the height a pad would stand (the tower's own base: the podium or the street), and
// whether anything hangs over the column a pad throws you up. Read with src/config/chaincourse.json's window pad:
// a pad needs its stand-off (1.4 m) and its reach (1.2 m) of floor in front of a face, and a clear column above.
//
// Run: GAME=speedkills npx tsx tools/centre-towers.ts. It measured the city before the lobbies (city.ts skyLobby)
// were built; with them in, a tower is two masses and it lists the upper ones, so read it against that.
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
const { buildCityMap } = await import("../src/game/city");
const { RANGE_SOLIDS } = await import("../src/game/range");
const { BR_X, BR_Z } = await import("../src/game/br");
buildCityMap(new THREE.Scene());
console.warn = warn;

/** the Sky Lobby's floor, metres over the street (the brief: storey 8 of 4 m) */
const LOBBY = 32;
/** a tower holds it with at least two storeys above it */
const towers = RANGE_SOLIDS.filter((s) => s.top >= LOBBY + 8 && s.top - s.base >= 4 && s.maxX - s.minX >= 10 && s.maxZ - s.minZ >= 10 && Math.abs((s.minX + s.maxX) / 2 - BR_X) < 100 && Math.abs((s.minZ + s.maxZ) / 2 - BR_Z) < 100);
type S = (typeof RANGE_SOLIDS)[number];

/** what stands on the floor at height `y` at (x, z): the highest solid top at or under y + 0.3 there */
function floorAt(x: number, z: number, y: number): number {
  let best = 0;
  for (const s of RANGE_SOLIDS) if (x > s.minX && x < s.maxX && z > s.minZ && z < s.maxZ && s.top <= y + 0.3 && s.top > best) best = s.top;
  return best;
}
/** the open floor in front of a face: how far out from it the ground stays at the face's base height, to 20 m */
function openInFront(t: S, nx: number, nz: number): { run: number; overhead: boolean } {
  const cx = nx !== 0 ? (nx > 0 ? t.maxX : t.minX) : (t.minX + t.maxX) / 2;
  const cz = nz !== 0 ? (nz > 0 ? t.maxZ : t.minZ) : (t.minZ + t.maxZ) / 2;
  let run = 0;
  for (let d = 0.5; d <= 20; d += 0.5) {
    const x = cx + nx * d;
    const z = cz + nz * d;
    const f = floorAt(x, z, t.base);
    const blocked = RANGE_SOLIDS.some((s) => s !== t && x > s.minX && x < s.maxX && z > s.minZ && z < s.maxZ && s.base < t.base + 2 && s.top > t.base + 0.3);
    if (Math.abs(f - t.base) > 0.3 || blocked) break;
    run = d;
  }
  // over the pad's spot (stand-off plus reach out), anything between the floor and the lobby's window
  const px = cx + nx * 2.6;
  const pz = cz + nz * 2.6;
  const overhead = RANGE_SOLIDS.some((s) => s !== t && px > s.minX - 0.5 && px < s.maxX + 0.5 && pz > s.minZ - 0.5 && pz < s.maxZ + 0.5 && s.base > t.base + 2 && s.base < LOBBY + 3);
  return { run, overhead };
}

console.log(`${towers.length} towers in the centre with the Sky Lobby's storey (${LOBBY} m) and two above it:`);
const rows: string[] = [];
for (const t of towers) {
  const faces = (
    [
      ["N", 0, -1],
      ["S", 0, 1],
      ["W", -1, 0],
      ["E", 1, 0],
    ] as const
  ).map(([n, nx, nz]) => {
    const o = openInFront(t, nx, nz);
    return { n, ...o, ok: o.run >= 4 && !o.overhead };
  });
  const good = faces.filter((f) => f.ok).map((f) => f.n);
  rows.push(
    `x ${(t.minX - BR_X).toFixed(1)} to ${(t.maxX - BR_X).toFixed(1)}, z ${(t.minZ - BR_Z).toFixed(1)} to ${(t.maxZ - BR_Z).toFixed(1)} | base ${t.base.toFixed(1)} roof ${t.top.toFixed(1)} | ` +
      faces.map((f) => `${f.n} ${f.run.toFixed(1)} m${f.overhead ? " (overhead)" : ""}`).join(", ") +
      ` | pad faces: ${good.join("") || "none"}`,
  );
}
rows.sort();
for (const r of rows) console.log(`  ${r}`);
