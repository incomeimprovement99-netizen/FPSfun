// Movement constants converted from Hammer units to metres, once, here.
// The raw values live in src/config/movement.json in the units the engine
// stores them, so they can be checked against a source without arithmetic.
import raw from "../config/movement.json";

/** metres per Hammer unit: 1 hu = 1 inch */
export const HU = 0.0254;

const m = (hu: number) => hu * HU;

export const MOVE = {
  // hull
  standHeight: m(raw.standHeight),
  crouchHeight: m(raw.crouchHeight),
  radius: m(raw.radius),
  eyeStand: m(raw.standHeight - raw.eyeFromTop),
  eyeCrouch: m(raw.crouchHeight - raw.eyeFromTop),

  /** how long the view takes to catch up with the feet after a step, seconds */
  stepSmoothTime: raw.stepSmoothTime,

  /** how fast a slide can be steered, radians a second */
  slideTurn: (raw.slideTurn * Math.PI) / 180,

  /** how much of the speed you arrive at a ledge with comes out on top of it */
  mantleCarry: raw.mantleCarry,

  // ground, accelerate-to-target in three bands
  speed: m(raw.speed),
  sprintSpeed: m(raw.sprintSpeed),
  crouchSpeed: m(raw.crouchSpeed),
  lowSpeed: m(raw.lowSpeed),
  acceleration: m(raw.acceleration),
  lowAcceleration: m(raw.lowAcceleration),
  sprintAcceleration: m(raw.sprintAcceleration),
  sprintBandStart: m(raw.sprintBandStart),
  armedAccelScale: raw.armedAccelScale,
  deceleration: m(raw.deceleration),
  crouchAcceleration: m(raw.crouchAcceleration),
  holsterBoost: raw.holsterBoost,

  // air, Quake-style with zero friction
  gravity: m(raw.gravity),
  jumpHeight: m(raw.jumpHeight),
  slideJumpHeight: m(raw.slideJumpHeight),
  airAcceleration: m(raw.airAcceleration),
  airSpeed: m(raw.airSpeed),
  jumpGracePeriod: raw.jumpGracePeriod,

  antiMultiJumpHeightFrac: raw.antiMultiJumpHeightFrac,
  antiMultiJumpTimeMin: raw.antiMultiJumpTimeMin,
  antiMultiJumpTimeMax: raw.antiMultiJumpTimeMax,

  skipTime: raw.skipTime,
  skipSpeedReduce: m(raw.skipSpeedReduce),
  skipSpeedRetain: m(raw.skipSpeedRetain),
  skipJumpHeightFraction: raw.skipJumpHeightFraction,

  // slide
  slideRequiredStartSpeed: m(raw.slideRequiredStartSpeed),
  slideRequiredStartSpeedAir: m(raw.slideRequiredStartSpeedAir),
  slideSpeedBoost: m(raw.slideSpeedBoost),
  slideSpeedBoostCap: m(raw.slideSpeedBoostCap),
  slideDecel: m(raw.slideDecel),
  slideVelocityDecay: raw.slideVelocityDecay,
  slideAccel: m(raw.slideAccel),
  slideWantToStopDecel: m(raw.slideWantToStopDecel),
  slideStopSpeed: m(raw.slideStopSpeed),
  slideMaxJumpSpeed: m(raw.slideMaxJumpSpeed),
  slideJumpGraceTime: raw.slideJumpGraceTime,
  slideBoostCooldown: raw.slideBoostCooldown,
  slideMaxAngleDot: raw.slideMaxAngleDot,
  slideFovScale: raw.slideFovScale,
  slideFovLerpTime: raw.slideFovLerpTime,

  // mantle
  mantleHeight: m(raw.mantleHeight),
  mantleDurationBelow: raw.mantleDurationBelow,
  mantleDurationLevel: raw.mantleDurationLevel,
  mantleDurationAbove: raw.mantleDurationAbove,
  mantleDurationHigh: raw.mantleDurationHigh,
  stepHeight: m(raw.stepHeight),

  crouchDelay: raw.crouchDelay,
  crouchVisualTime: raw.crouchVisualTime,

  // climb (apexmovement.tech)
  climbSpeed: m(raw.climbSpeed),
  climbSideSpeed: m(raw.climbSideSpeed),
  climbUpHorizontalMax: m(raw.climbUpHorizontalMax),
  climbSpaceHeight: m(raw.climbSpaceHeight),
  climbAttachOffset: m(raw.climbAttachOffset),
  climbEndBoostHeight: m(raw.climbEndBoostHeight),
  climbUpwardThreshold: m(raw.climbUpwardThreshold),
  climbNonUpwardTime: raw.climbNonUpwardTime,
  climbAngleDot: raw.climbAngleDot,
  climbAttachReach: m(raw.climbAttachReach),
  climbDetachPenalty: m(raw.climbDetachPenalty),
  climbJumpPenalty: m(raw.climbJumpPenalty),
  climbMiniZone: m(raw.climbMiniZone),
  climbJumpHeight: m(raw.climbJumpHeight),
  climbJumpOutMini: m(raw.climbJumpOutMini),
  climbJumpOut: m(raw.climbJumpOut),
  climbAccel: m(raw.climbAccel),
  climbGreenZoneTop: m(raw.climbGreenZoneTop),
  wallbounceVyBottom: m(raw.wallbounceVyBottom),
  wallbounceVyTop: m(raw.wallbounceVyTop),
  crouchKickOut: m(raw.crouchKickOut),

  // lurch
  lurchGraceMin: raw.lurchGraceMin,
  lurchGraceMax: raw.lurchGraceMax,
  lurchStrength: raw.lurchStrength,
  lurchMaxFraction: raw.lurchMaxFraction,
  lurchSpeedCap: m(raw.lurchSpeedCap),

  // superglide
  superglideHeight: m(raw.superglideHeight),
  superglideWindow: raw.superglideWindow,
  superglideWalkWindow: raw.superglideWalkWindow,

  // fall stun: landing SPEEDS equivalent to free falls of these heights
  fallstunMinSpeed: Math.sqrt(2 * m(raw.gravity) * m(raw.fallstunMinHeight)),
  fallstunMaxSpeed: Math.sqrt(2 * m(raw.gravity) * m(raw.fallstunMaxHeight)),
  fallstunMaxDuration: raw.fallstunMaxDuration,
  fallstunAccelScale: raw.fallstunAccelScale,

  sprintBuffer: raw.sprintBuffer,
  mantleInputDot: raw.mantleInputDot,
  slideRequiredFallSpeedAir: m(raw.slideRequiredFallSpeedAir),

  // slide friction, fitted (see movement.json _slideFriction)
  slideExcessAbove: m(raw.slideExcessAbove),
  slideExcessDecayRate: raw.slideExcessDecayRate,

  // slide on a slope
  slideSlopeAccelScale: raw.slideSlopeAccelScale,
  slideSlopeMaxSpeed: m(raw.slideSlopeMaxSpeed),

  // ziplines (apexmovement.tech, Zipline Basics)
  ziplineSpeed: m(raw.ziplineSpeed),
  ziplineVerticalSpeed: m(raw.ziplineVerticalSpeed),
  ziplineAcceleration: m(raw.ziplineAcceleration),
  ziplineJumpOnAcceleration: m(raw.ziplineJumpOnAcceleration),
  mountZiplineTime: raw.mountZiplineTime,
  useZiplineCooldown: raw.useZiplineCooldown,
  ziplineJumpOffSpeed: m(raw.ziplineJumpOffSpeed),
  ziplineJumpOffDampScale: raw.ziplineJumpOffDampScale,
  ziplineExitManualMax: m(raw.ziplineExitManualMax),
  ziplineExitEndMax: m(raw.ziplineExitEndMax),
  ziplineMaxAirInteracts: raw.ziplineMaxAirInteracts,
  ziplineInteractRegen: raw.ziplineInteractRegen,
  ziplineSteepDeg: raw.ziplineSteepDeg,
  ziplineGroundLookDeg: raw.ziplineGroundLookDeg,
  ziplineAirLookDeg: raw.ziplineAirLookDeg,
  ziplineAirPitchDeg: raw.ziplineAirPitchDeg,
  ziplineReach: m(raw.ziplineReach),
  ziplineHang: m(raw.ziplineHang),
  ziplinePullTime: raw.ziplinePullTime,
  ziplinePoleZone: m(raw.ziplinePoleZone),
  ziplineJumpPop: m(raw.ziplineJumpPop),
  ziplineSteepExitPush: m(raw.ziplineSteepExitPush),

  // view, cosmetic only
  landDipMaxSpeed: m(raw.landDipMaxSpeed),
  landDipMetres: raw.landDipMetres,
  landDipRecover: raw.landDipRecover,
} as const;

/**
 * The two moves this game does not have by default (src/config/movement.json
 * `extra`): a double jump and a wall run. Kept apart from MOVE because
 * everything in MOVE is Apex's, measured against the wiki and the reference
 * files, and these two are ours. A match turns them on; off, nothing here is
 * read.
 */
export const EXTRA = {
  doubleJump: { height: m(raw.extra.doubleJump.height), grace: raw.extra.doubleJump.grace },
  wallRun: {
    seconds: raw.extra.wallRun.seconds,
    fall: raw.extra.wallRun.fall,
    minSpeed: m(raw.extra.wallRun.minSpeed),
    out: m(raw.extra.wallRun.out),
    up: m(raw.extra.wallRun.up),
    cooldown: raw.extra.wallRun.cooldown,
    hold: m(raw.extra.wallRun.hold),
  },
} as const;

/**
 * Slide friction at a given speed: a gentle constant, plus a fast shed of any
 * speed above 350 hu/s. Fitted to the two wiki timings (movement.json).
 */
export function slideFriction(speed: number): number {
  return MOVE.slideDecel + MOVE.slideExcessDecayRate * Math.max(0, speed - MOVE.slideExcessAbove);
}

/**
 * The shallowest slope on which a slide at `speed` holds its speed: where
 * g*sin(theta) equals slide friction.
 */
export function slideBreakEvenAngle(speed: number): number {
  return Math.asin(Math.min(1, slideFriction(speed) / MOVE.gravity));
}

/**
 * The angle the range's ramp is built at: 30.44 degrees. It was derived from
 * the old friction formula; under the fitted one, a slide down it settles at
 * about 372 hu/s, just above the point where friction starts shedding.
 */
export const SLIDE_RAMP_ANGLE = 0.5313;

/** jump velocity that reaches a given height under this gravity */
export function jumpVelocityFor(height: number): number {
  return Math.sqrt(2 * MOVE.gravity * height);
}
