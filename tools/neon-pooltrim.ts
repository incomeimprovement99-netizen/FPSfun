// Each street lamp's pool of light cut to its floor (Milestone 810; the lobby agent's bug hunt of 2026-10-27: on a roof
// or a walkway the pool's flat disc spilled past the edge into the air, and by THE WELL it lay over the open shaft).
// For a pool over 0.5 m up, the widest radius whose rim, sampled every 22.5 degrees at 0.85 of it, still stands on a box
// topped at the pool's height in the last bake's collision; for one on the street by THE WELL, short of its hole. Writes
// src/config/neonmap.json game.pools.trim ([x, z, radius], 0 drops the pool). Run after a bake that moves lamps:
//   npx tsx tools/neon-pooltrim.ts
// (tools/checks/sk-neon.ts holds every pool to its floor, so a stale list fails the checks.)
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
const ROOT = join(import.meta.dirname, "..");
const cfgPath = join(ROOT, "src", "config", "neonmap.json");
const cfg = JSON.parse(readFileSync(cfgPath, "utf8"));
// (measured untrimmed: the pools as the lamps alone would lay them)
const P = cfg.game.pools;
delete P.trim;
writeFileSync(cfgPath, JSON.stringify(cfg, null, 1) + "\n");
const { poolSpots } = await import("../src/game/lightpools");
const S: number[][] = JSON.parse(readFileSync(join(ROOT, "src", "config", "neon", "neonmap.solids.json"), "utf8")).solids;
const cell = 4;
const grid = new Map<string, number[][]>();
for (const b of S) for (let i = Math.floor(b[0] / cell); i <= Math.floor(b[1] / cell); i++) for (let j = Math.floor(b[2] / cell); j <= Math.floor(b[3] / cell); j++) (grid.get(`${i},${j}`) ?? grid.set(`${i},${j}`, []).get(`${i},${j}`)!).push(b);
const floorAt = (x: number, z: number, y: number) => (grid.get(`${Math.floor(x / cell)},${Math.floor(z / cell)}`) ?? []).some((b) => x >= b[0] && x <= b[1] && z >= b[2] && z <= b[3] && Math.abs(b[5] - y) < 0.35);
const hole: number[] | undefined = cfg.well?.hole;
const inHole = (x: number, z: number) => !!hole && x > hole[0] && x < hole[1] && z > hole[2] && z < hole[3];
const own = new Set(((P.spots ?? []) as number[][]).map((q) => `${q[0]},${q[2]}`));
const trims: number[][] = [];
for (const [x, y, z, r] of poolSpots()) {
  if (r >= P.wash.r - 0.01 || own.has(`${x},${z}`)) continue;
  if (y <= 0.5 && !(hole && x > hole[0] - r && x < hole[1] + r && z > hole[2] - r && z < hole[3] + r)) continue;
  const ok = (rr: number) => {
    for (let a = 0; a < 16; a++) {
      const [px, pz] = [x + Math.cos((a * Math.PI) / 8) * rr, z + Math.sin((a * Math.PI) / 8) * rr];
      if (y > 0.5 ? !floorAt(px, pz, y) : inHole(px, pz)) return false;
    }
    return true;
  };
  if (ok(r * 0.85)) continue;
  let rr = r * 0.85;
  while (rr > 1 && !ok(rr)) rr -= 0.25;
  trims.push([+x.toFixed(3), +z.toFixed(3), rr > 1.2 ? +(rr / 0.85).toFixed(2) : 0]);
}
const fresh = JSON.parse(readFileSync(cfgPath, "utf8"));
fresh.game.pools.trim = trims;
writeFileSync(cfgPath, JSON.stringify(fresh, null, 1) + "\n");
console.log(`pools trimmed to their floors: ${trims.length} (${trims.filter((t) => t[2] === 0).length} dropped)`);
