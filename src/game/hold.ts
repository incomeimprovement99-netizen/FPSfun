// Where a long gun hangs on a figure (src/config/figure.json, used by
// src/game/mannequin.ts).
//
// The motion-capture library this game's figures use is a pistol library: it
// has an aim pose with two hands out in front and nothing at all for a rifle.
// So a rifle is not animated, it is hung off the chest at a point we choose
// and both arms are reached onto it. That point is the whole of how a figure
// looks holding a gun, and it was three numbers in the middle of the rigging
// code, one of which put the grip inboard of the shoulder. A stock sits
// behind the grip, so inboard of the shoulder means the stock is beside the
// neck: guns went through people, which is exactly what the owner saw.
//
// The arithmetic is here, away from the bones, because it is the part worth
// checking: a gun's own length decides where it can hang, and every gun in the
// game is a different length.
import figureCfg from "../config/figure.json";

/** the hold's numbers: the shoulder pocket, and how far a gun may be pushed out of it */
export const HOLD = figureCfg.hold;
/** the long gun lowered and canted across the body (a sprint, a swap) */
export const LOWER = figureCfg.lower;
/** how fast a hand takes its hold, per second */
export const REACH = figureCfg.reach;

/** a point in the figure's own space: +x its right, +y up, +z the way it faces */
export interface Spot {
  x: number;
  y: number;
  z: number;
}

/**
 * How far in front of the shoulder a gun's grip has to sit for the stock to
 * clear the body. `rear` is how far the gun reaches behind its own grip.
 *
 * A stock belongs in the shoulder, so `stockAllow` of it may sit behind the
 * joint; anything longer is pushed forward until it clears. The push stops at
 * `maxForward`, because a gun held further out than that is one the support
 * hand cannot reach, and an arm stretched at nothing is the floating hand.
 */
export function gripForward(rear: number): number {
  const need = rear - HOLD.stockAllow;
  return Math.min(HOLD.maxForward, Math.max(HOLD.forward, need));
}

/**
 * Where the grip goes, given the shoulder joint and how far the gun reaches
 * behind its grip. Outboard of the joint (the pocket), below it, and in front
 * of it by enough to clear.
 */
export function gripAt(shoulder: Spot, rear: number): Spot {
  const side = Math.sign(shoulder.x) || 1;
  return { x: shoulder.x + side * HOLD.out, y: shoulder.y - HOLD.drop, z: shoulder.z + gripForward(rear) };
}

/**
 * How far behind the shoulder joint the stock ends up, once it is placed.
 * Positive is behind. This is the number the checks look at: no gun may put
 * it past `stockAllow`, and a gun long enough that it would has been pushed
 * forward instead.
 */
export function stockBehind(rear: number): number {
  return rear - gripForward(rear);
}

/** true when a gun is so long that even pushed to the limit its stock is still in the body */
export function tooLongToHold(rear: number): boolean {
  return stockBehind(rear) > HOLD.stockAllow + 1e-6;
}

/**
 * Where on the gun the support hand can actually take hold.
 *
 * A handguard on a long gun is further from the left shoulder than the left
 * arm is long, and an arm reaching for something out of reach stops short and
 * hangs there: the floating hand. A person in that position does the obvious
 * thing and slides their hand back along the gun until they have it. This
 * returns how far back along the line from the handguard (0) to the grip (1)
 * the hand has to go to be on the gun and within reach.
 *
 * `u` is the handguard measured from the shoulder, `v` the step from the
 * handguard to the grip, and `arm` how far the arm reaches. Solving
 * |u + t v| = arm is a quadratic; the smaller root is the first place along
 * the gun that comes within reach, and if nothing on that line does, the hand
 * goes to the grip and holds the gun with both hands together.
 */
export function reachFraction(u: readonly number[], v: readonly number[], arm: number): number {
  const uu = u[0] * u[0] + u[1] * u[1] + u[2] * u[2];
  if (uu <= arm * arm) return 0;
  const vv = v[0] * v[0] + v[1] * v[1] + v[2] * v[2];
  if (vv < 1e-9) return 1;
  const uv = u[0] * v[0] + u[1] * v[1] + u[2] * v[2];
  const c = uu - arm * arm;
  const disc = uv * uv - vv * c;
  if (disc < 0) return 1;
  const t = (-uv - Math.sqrt(disc)) / vv;
  return Math.max(0, Math.min(1, t));
}
