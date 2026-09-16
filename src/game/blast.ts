// A shotgun's blast pattern: where each pellet goes round the blast's centre.
//
// The game's shotguns do not scatter pellets at random inside a cone; each
// fires a fixed shape (the Mastiff's horizontal line, the EVA-8's figure 8,
// the Peacekeeper's star, the Mozambique's triangle, the Triple Take's three
// in a row), sized by the weapon data's blast_pattern_default_scale, tightened
// to blast_pattern_ads_scale when aimed where the gun has one, closed further
// by a choke, and defined at blast_pattern_zero_distance. The shapes and their
// unit are ours (src/config/weapon-mechanics.json, `blast`); the scales and
// the distance are the data's.
//
// The spread stat still applies, but to the blast as a whole (one deviation a
// trigger pull), not to each pellet. Before this, a gun with a zero spread stat
// fired every pellet down one line: the Mastiff read as one 19-damage pellet.
import type { ResolvedWeapon } from "./weapons";

const DEG = Math.PI / 180;

/**
 * Each pellet's offset from the blast's centre, [across, up] in degrees
 * (positive: right, up). Null for a gun with no pattern.
 */
export function blastOffsets(w: ResolvedWeapon, aimed: boolean, chokeScale: number, rnd: () => number = Math.random): Array<[number, number]> | null {
  const b = w.mech.blast;
  if (!b) return null;
  const scale = (aimed ? b.adsScale : b.scale) * chokeScale;
  const at = (v: number) => Math.atan((v * b.unit * scale) / b.zeroDistance) / DEG;
  return b.shape.map(([x, y]) => [at(x) + (rnd() * 2 - 1) * b.jitter, at(y) + (rnd() * 2 - 1) * b.jitter]);
}

/** how wide the blast is, edge to edge in degrees, at a scale (tools/verify.ts) */
export function blastWidth(w: ResolvedWeapon, aimed = false, chokeScale = 1): number {
  const b = w.mech.blast;
  if (!b) return 0;
  const scale = (aimed ? b.adsScale : b.scale) * chokeScale;
  const xs = b.shape.map(([x]) => Math.atan((x * b.unit * scale) / b.zeroDistance) / DEG);
  return Math.max(...xs) - Math.min(...xs);
}
