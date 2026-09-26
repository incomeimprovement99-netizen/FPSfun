// SpeedKills' decay (docs/PHASE_18_PLAN_SPEEDKILLS.md 7.10): the city is
// taken away a sector at a time, from its edges in, toward a final sector
// where the capture zone opens. Hyper Scape's own shape, as it was left: the
// Decay "phases out sectors of the map, starting at the edges of the city and
// moving across the districts one by one", and the endgame opens in the last
// sector standing.
//
// The owner's numbers: a match of about 6 to 7 minutes; the centre, the
// Spire, the biggest and hottest sector, the final one more often than any
// other, so landing there means less early running.
//
// This is the plan and the arithmetic, pure, so every browser works out the
// same decay from the match seed and the ring's clock (brmatch.ts carries the
// clock to every guest already) and nothing new goes over the wire. A wave is
// one of the ring's phases: its wait is the warning, its close the decay.
import cityCfg from "../config/city.json";
import decayCfg from "../config/decay.json";

export type SectorPhase = "live" | "warning" | "decaying" | "gone";

export interface DecayPlan {
  /** the sector the match ends in */
  final: string;
  /** the sectors that go in each wave, in order */
  waves: string[][];
}

const SECTOR_IDS = cityCfg.sectors.map((s) => s.id);
const centreOf = (id: string): { x: number; z: number } => {
  const s = cityCfg.sectors.find((x) => x.id === id)!;
  return { x: (s.minX + s.maxX) / 2, z: (s.minZ + s.maxZ) / 2 };
};

/** a seeded random (mulberry32), so every browser draws the same plan */
function seeded(seed: number): () => number {
  let a = seed >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * The match's decay: the final sector (the centre with decay.json's
 * finalCentre odds, else one of the eight), and the rest in waves of
 * perWave, the furthest from the final sector first, so the city closes from
 * its edges toward where the match ends.
 */
export function decayPlan(seed: number): DecayPlan {
  const rnd = seeded(Math.imul(seed >>> 0 || 1, 2246822519) >>> 0);
  const outer = SECTOR_IDS.filter((id) => id !== "c");
  const final = rnd() < decayCfg.finalCentre ? "c" : outer[Math.floor(rnd() * outer.length)];
  const f = centreOf(final);
  const rest = SECTOR_IDS.filter((id) => id !== final)
    .map((id) => ({ id, d: Math.hypot(centreOf(id).x - f.x, centreOf(id).z - f.z) + rnd() * decayCfg.jitter }))
    .sort((a, b) => b.d - a.d)
    .map((x) => x.id);
  const waves: string[][] = [];
  for (let i = 0; i < rest.length; i += decayCfg.perWave) waves.push(rest.slice(i, i + decayCfg.perWave));
  return { final, waves };
}

/**
 * Where every sector stands, from the ring's round and clock: a wave's
 * sectors are warned through its round's wait and decay through its close
 * (k from 0 to 1), and are gone after; everything later is live, and the
 * final sector is never anything but live.
 */
export function sectorPhases(
  plan: DecayPlan,
  ring: { phase: number; state: "waiting" | "closing" | "closed"; timeLeft: number },
  closeOf: (phase: number) => number
): Record<string, { phase: SectorPhase; k: number }> {
  const out: Record<string, { phase: SectorPhase; k: number }> = {};
  for (const id of SECTOR_IDS) out[id] = { phase: "live", k: 0 };
  plan.waves.forEach((wave, w) => {
    for (const id of wave) {
      if (ring.phase > w || ring.state === "closed") out[id] = { phase: "gone", k: 1 };
      else if (ring.phase === w && ring.state === "closing") {
        const close = Math.max(1e-6, closeOf(w));
        out[id] = { phase: "decaying", k: Math.max(0, Math.min(1, 1 - ring.timeLeft / close)) };
      } else if (ring.phase === w) out[id] = { phase: "warning", k: 0 };
    }
  });
  return out;
}

/** the wave the capture zone opens after: every sector but the final one gone */
export const captureOpens = (plan: DecayPlan, ringPhase: number): boolean => ringPhase >= plan.waves.length;

/** the height up to which a decaying sector has dissolved, metres: the ground floors first */
export const dissolvedTo = (k: number): number => k * decayCfg.height;

/** the sector a map-local point is in */
export function sectorIdAt(x: number, z: number): string | null {
  return cityCfg.sectors.find((s) => x >= s.minX && x <= s.maxX && z >= s.minZ && z <= s.maxZ)?.id ?? null;
}
