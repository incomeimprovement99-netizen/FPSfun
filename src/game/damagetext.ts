// Damage, health and shield as a player reads them (Phase 20 A2).
//
// The amounts underneath keep their fractions: a SpeedKills bot's shield and
// health come back a sliver a frame, a tuned round is 7.8 or 11.16, ARMOR
// takes 60% of what reaches you, and SpeedKills lands each hit at its tuned
// value rather than rounded down (dummy.ts). Only the text is whole. The
// owner saw "33.66666666666666" over a bot he finished.
//
// Pure, no DOM: the HUD, the range's boards and the node checks share it.

/**
 * A damage amount: whole, and at least 1 for a hit that did anything, so a
 * finishing hit on a bot with 0.3 left does not read 0 beside ELIMINATED. A
 * total is rounded once, so a spray's number is what it took off rather than
 * a sum of rounded pieces.
 */
export function damageText(n: number): string {
  return String(n > 0 ? Math.max(1, Math.round(n)) : 0);
}

/**
 * What is left of a pool (health, shield): whole, and never 0 while any is
 * left. The allowance keeps a float's 42.00000000000001 at 42 rather than 43.
 */
export function poolText(n: number): string {
  return String(Math.max(0, Math.ceil(n - 1e-6)));
}
