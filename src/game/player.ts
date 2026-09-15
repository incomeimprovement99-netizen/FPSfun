// First-person controller.
//
// Every rule in here is either an engine constant (src/config/movement.json)
// or a documented Apex behaviour from the Apex Movement Wiki
// (apexmovement.tech), which the movement community built by measuring the
// game frame by frame. Where neither source covers something, the comment
// says so and the constant is marked as ours.
//
// Shape of the model:
//   ground  accelerate-to-target in three speed bands, hard deceleration.
//           The bands depend on SPEED, not stance: crouch, walk and sprint
//           accelerate identically and differ only in top speed.
//   air     Quake-style, no friction or drag at all, plus the lurch.
//   slide   an instant, capped boost with a 2 s cooldown from the last slide
//           ENTRY, gentle friction, and gravity along slopes both ways.
//   climb   the climb space and attach offset system, end boost, zone-based
//           jump-offs and reattach rules.
//   mantle  with the superglide window at the end of it.
//   zip     ziplines: interact to ride where you look, a speed cap, three
//           ways off, and the interact limits.
import * as THREE from "three";
import type { Action } from "./input";
import { HU, MOVE, jumpVelocityFor, slideFriction } from "./movement";
import { RANGE_SOLIDS, type Solid } from "./range";
import { ZIPLINES, type Zipline } from "./traversal";

const DEG = Math.PI / 180;
/** the skydive: terminal speed and steering, m/s (ours; the game's dive is its own system) */
const DROP_SPEED = 22;
const DROP_STEER = 9;

export interface Bounds {
  minX: number; maxX: number; minZ: number; maxZ: number;
}

/** what the controller needs from input; Input satisfies it, and so can a test */
export interface MoveInput {
  held(action: Action): boolean;
  pressedNow(action: Action): boolean;
}

export type Stance = "stand" | "crouch" | "slide" | "air" | "mantle" | "climb" | "zip";
export type SprintMode = "toggle" | "hold";

interface Mantle {
  fromX: number;
  fromY: number;
  fromZ: number;
  toX: number;
  toY: number;
  toZ: number;
  started: number;
  duration: number;
  /** sprinting into (or during) the mantle opens the full superglide window */
  sprint: boolean;
  /** direction you were facing, which a superglide launches you along */
  dirX: number;
  dirZ: number;
}

interface WallNormal {
  nx: number;
  nz: number;
}

/** a zipline ride in progress */
interface ZipRide {
  line: Zipline;
  len: number;
  /** unit vector from a to b */
  dx: number;
  dy: number;
  dz: number;
  /** metres from a */
  s: number;
  /** +1 rides toward b, -1 toward a */
  sign: 1 | -1;
  /** m/s along the ride direction */
  speed: number;
  max: number;
  /** steeper than 45 degrees: jump off in any direction */
  steep: boolean;
  mountedAt: number;
  /** where you were relative to the hang point at the interact, pulled in to zero */
  offX: number;
  offY: number;
  offZ: number;
  pullTime: number;
  climbReset: boolean;
}

/** a zipline in reach and in view, and where on it you would grab */
interface ZipTarget {
  line: Zipline;
  s: number;
}

export class Player {
  pos = new THREE.Vector3(0, 0, 0); // feet
  vel = new THREE.Vector3();
  yaw = 0; // degrees, positive = left
  pitch = 0; // degrees, positive = up
  onGround = true;
  crouchHeld = false;
  crouched = false; // the actual crouched STATE, which lags the key
  sprinting = false;
  sliding = false;
  climbing = false;
  speed = 0;

  /** 1.15 while holstered; scales walk, sprint, crouch and the slide boost */
  holsterBoost = 1;
  /** Apex's default is press (toggle) sprint with a 3 s buffer */
  sprintMode: SprintMode = "toggle";

  // ----- timers and states -----
  private height = MOVE.standHeight;
  private eye = MOVE.eyeStand;
  private frame = 0;
  private crouchPressedAt = -Infinity;
  private lastGroundAt = 0;
  private landedAt = -Infinity;
  private slideStartedAt = -Infinity;
  private lastSlideEnterAt = -Infinity;
  private slideBoosted = false;
  private lastJumpAt = -Infinity;
  private mantle: Mantle | null = null;
  private lastDt = 1 / 60;
  private sprintArmedUntil = -Infinity;
  /**
   * Jump fatigue is a STATE plus a timer. The state turns on when you leave
   * the ground with a jump (from the ground, a climb, or coyote time) and off
   * when you mantle, fall off a ledge, or detach from a climb without jumping.
   * The timer starts on landing. A jump only suffers fatigue if the state is
   * on, which is why walking off a ledge and jumping on landing is full height.
   */
  private fatigueOn = false;

  // ----- climb -----
  /** feet height the climb space is measured from; set by ground contact */
  private climbBaseline = 0;
  private climbNormal: WallNormal | null = null;
  private attachY = 0;
  private attachedAt = -Infinity;
  private lastAttachY = Infinity;
  private lastAttachNormal: WallNormal | null = null;

  // ----- lurch -----
  private lurchFrame = -1;

  // ----- superglide -----
  private sgJumpFrame = -10;

  // ----- fall stun -----
  private stunUntil = -Infinity;
  private stunStrength = 0;

  // ----- zipline -----
  private zip: ZipRide | null = null;
  private zipExitAt = -Infinity;
  /** mid-air interacts used since you last touched the ground or mantled */
  zipAirUses = 0;
  private zipRegenAt = 0;
  /** a zipline is in reach and in view: the HUD shows the interact prompt */
  zipPrompt = false;

  /**
   * Called when the controller registers a named piece of tech (a
   * superglide, a wallbounce, a deadslide), so the HUD can say what the game
   * saw. `good` is false for penalties.
   */
  onTech: ((name: string, detail: string, good: boolean) => void) | null = null;
  private tech(name: string, detail = "", good = true): void {
    this.onTech?.(name, detail, good);
  }

  // ----- view, cosmetic only -----
  /** FOV kick while sliding, as a fraction added to 1 (slideFovScale) */
  slideFov = 0;
  /** camera dip on landing, metres below the eye */
  viewDip = 0;
  private viewDipVel = 0;
  /** speed at the moment of the last landing */
  landingSpeed = 0;
  /** set on a superglide so the HUD can show it */
  superglidedAt = -Infinity;
  /**
   * How fast the feet descended across the PREVIOUS frame, m/s, positive going
   * down. slideMove runs before integrate, so a same-frame drop is always
   * zero; this is measured across the last frame instead.
   */
  private descentRate = 0;
  private prevY = 0;

  constructor(private bounds: Bounds) {}

  get stance(): Stance {
    if (this.zip) return "zip";
    if (this.mantle) return "mantle";
    if (this.climbing) return "climb";
    if (this.sliding) return "slide";
    if (!this.onGround) return "air";
    return this.crouched ? "crouch" : "stand";
  }

  /**
   * A drop from the sky (the battle royale's start): falling at a terminal
   * speed with full steering, no fall stun on landing. Cleared by the landing.
   */
  dropping = false;
  beginDrop(x: number, y: number, z: number, yaw: number): void {
    this.teleport(x, y, z, yaw, -35);
    this.dropping = true;
  }

  /** riding a zipline */
  get onZip(): boolean {
    return this.zip !== null;
  }

  /**
   * A mantle in progress, for the superglide trainer and the mantle boost
   * cue: when it started, how long it lasts, and the window at its end in
   * which a jump then a crouch one frame later is a superglide (wider when you
   * sprinted into it).
   */
  get mantleInfo(): { started: number; duration: number; window: number; remaining: number } | null {
    const mt = this.mantle;
    if (!mt) return null;
    return { started: mt.started, duration: mt.duration, window: mt.sprint ? MOVE.superglideWindow : MOVE.superglideWalkWindow, remaining: mt.started + mt.duration - this.lastNow };
  }

  // ----- JOLT (abilities.ts): a level dash -----
  private joltLeft = 0;
  private joltDirX = 0;
  private joltDirZ = 0;
  private joltSpeed = 0;
  private joltExit = 0;
  /** mid-JOLT: the dash owns the horizontal velocity and holds you level */
  get jolting(): boolean {
    return this.joltLeft > 0;
  }

  /**
   * JOLT: `distance` metres along (dirX, dirZ) over `duration` seconds, level
   * (no gravity during it), through the normal collision so a wall stops it,
   * leaving at `exitSpeed` m/s in the same direction. It ends a slide, and
   * cannot start on a zipline, in a mantle or climb, or in the drop. Returns
   * whether it started.
   */
  jolt(dirX: number, dirZ: number, distance: number, duration: number, exitSpeed: number): boolean {
    if (this.zip || this.mantle || this.climbing || this.dropping || this.joltLeft > 0) return false;
    const l = Math.hypot(dirX, dirZ);
    if (l < 1e-6 || duration <= 0) return false;
    this.joltDirX = dirX / l;
    this.joltDirZ = dirZ / l;
    this.joltLeft = duration;
    this.joltSpeed = distance / duration;
    this.joltExit = exitSpeed;
    this.endSlide();
    this.vel.y = 0;
    return true;
  }

  /** one frame of a JOLT: the dash speed for what is left of it, the exit speed for the rest of the frame */
  private stepJolt(dt: number, now: number): void {
    const use = Math.min(dt, this.joltLeft);
    const k = dt > 1e-9 ? use / dt : 1;
    const sp = this.joltSpeed * k + this.joltExit * (1 - k);
    // a wall hit earlier in the dash zeroed that component: it stays zeroed
    this.vel.x = this.joltBlockedX ? 0 : this.joltDirX * sp;
    this.vel.z = this.joltBlockedZ ? 0 : this.joltDirZ * sp;
    this.vel.y = 0;
    const wantX = this.vel.x;
    const wantZ = this.vel.z;
    this.integrate(dt, now, 0);
    if (wantX !== 0 && this.vel.x === 0) this.joltBlockedX = true;
    if (wantZ !== 0 && this.vel.z === 0) this.joltBlockedZ = true;
    this.joltLeft -= dt;
    if (this.joltLeft <= 0) {
      this.joltLeft = 0;
      this.joltBlockedX = false;
      this.joltBlockedZ = false;
      const h = this.hSpeed();
      if (h > this.joltExit && h > 1e-6) {
        this.vel.x *= this.joltExit / h;
        this.vel.z *= this.joltExit / h;
      }
    }
  }
  private joltBlockedX = false;
  private joltBlockedZ = false;

  /** the way the movement keys point, flattened (forward with none held): JOLT goes this way */
  moveDir(input: MoveInput): { x: number; z: number } {
    let fwd = 0;
    let side = 0;
    if (input.held("forward")) fwd += 1;
    if (input.held("back")) fwd -= 1;
    if (input.held("right")) side += 1;
    if (input.held("left")) side -= 1;
    if (fwd === 0 && side === 0) fwd = 1;
    const { fx, fz } = this.look();
    const x = fx * fwd - fz * side;
    const z = fz * fwd + fx * side;
    const l = Math.hypot(x, z) || 1;
    return { x: x / l, z: z / l };
  }

  /**
   * Put the player somewhere else, standing still and in no special state:
   * off any zipline, out of any mantle, climb or slide. Respawns, the course's
   * return to the start and the menu use this; setting `pos` alone left a
   * zipline ride or a mantle running from the old place.
   */
  teleport(x: number, y: number, z: number, yaw: number, pitch = 0): void {
    this.pos.set(x, y, z);
    this.vel.set(0, 0, 0);
    this.yaw = yaw;
    this.pitch = pitch;
    this.zip = null;
    this.mantle = null;
    this.climbing = false;
    this.climbNormal = null;
    this.sliding = false;
    this.crouched = false;
    this.sprinting = false;
    this.onGround = false;
    this.lastGroundAt = -Infinity;
    this.lastJumpAt = -Infinity;
    this.climbBaseline = y;
    this.zipAirUses = 0;
    // Nothing from before the move carries over: a respawn taken mid-jump gave
    // a fatigued first jump, and a fall stun followed you to your spawn.
    this.fatigueOn = false;
    this.stunUntil = -Infinity;
    this.stunStrength = 0;
    this.sprintArmedUntil = -Infinity;
    this.landedAt = -Infinity;
    this.viewDip = 0;
    this.viewDipVel = 0;
    this.slideFov = 0;
    this.descentRate = 0;
    this.prevY = y;
    // ...nor the slide boost's 2 s cooldown (a hazard respawn after a slide
    // read as a deadslide), nor a superglide's jump frame or a zip exit
    this.lastSlideEnterAt = -Infinity;
    this.sgJumpFrame = -10;
    this.zipExitAt = -Infinity;
    this.joltLeft = 0;
    this.joltBlockedX = false;
    this.joltBlockedZ = false;
  }

  /** change the play area the player is clamped to (the range, or the 1v1 arena) */
  setBounds(b: Bounds): void {
    this.bounds = b;
  }

  /** true while a fall stun is slowing you */
  get stunned(): boolean {
    return this.lastNow < this.stunUntil;
  }
  private lastNow = 0;

  applyMouse(dx: number, dy: number, degPerCount: number, invert: boolean): void {
    this.yaw -= dx * degPerCount;
    this.pitch += (invert ? 1 : -1) * dy * degPerCount;
    this.pitch = Math.max(-89, Math.min(89, this.pitch));
  }

  addAngles(pitchUp: number, yawLeft: number): void {
    this.pitch = Math.max(-89, Math.min(89, this.pitch + pitchUp));
    this.yaw += yawLeft;
  }

  /** horizontal speed, m/s */
  private hSpeed(): number {
    return Math.hypot(this.vel.x, this.vel.z);
  }

  private look(): { fx: number; fz: number } {
    const yawR = this.yaw * DEG;
    return { fx: -Math.sin(yawR), fz: -Math.cos(yawR) };
  }

  // ---------- collision helpers ----------

  /** solids whose footprint the player's circle overlaps at this position */
  private overlapping(x: number, z: number, r: number): Solid[] {
    const out: Solid[] = [];
    for (const s of RANGE_SOLIDS) {
      if (x + r > s.minX && x - r < s.maxX && z + r > s.minZ && z - r < s.maxZ) out.push(s);
    }
    return out;
  }

  /** highest surface under the player at (x,z) that is at or below `ceiling` */
  private groundUnder(x: number, z: number, r: number, ceiling: number): number {
    let best = 0;
    for (const s of this.overlapping(x, z, r)) {
      if (s.top <= ceiling + 1e-4 && s.top > best) best = s.top;
    }
    return best;
  }

  /** does the player's body intersect this solid vertically at feet height y */
  private blocks(s: Solid, feet: number, height: number): boolean {
    return s.top > feet + MOVE.stepHeight + 1e-4 && s.base < feet + height - 1e-4;
  }

  /**
   * The outward normal of a wall within `reach` of the body, or null.
   * Collision is axis-aligned boxes, so a wall is whichever face we are
   * against in one of the four axis directions.
   */
  private wallNear(reach: number): WallNormal | null {
    const r = MOVE.radius;
    const feet = this.pos.y;
    const bodyH = this.height;
    const inside = this.overlapping(this.pos.x, this.pos.z, r);
    for (const [dx, dz] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const) {
      for (const s of this.overlapping(this.pos.x + dx * reach, this.pos.z + dz * reach, r)) {
        if (!this.blocks(s, feet, bodyH)) continue;
        if (inside.includes(s)) continue;
        return { nx: -dx, nz: -dz };
      }
    }
    return null;
  }

  /** is there something overhead lower than a standing player's head */
  private headroomBlocked(): boolean {
    for (const s of this.overlapping(this.pos.x, this.pos.z, MOVE.radius)) {
      if (s.base > this.pos.y + MOVE.stepHeight && s.base < this.pos.y + MOVE.standHeight - 1e-4) return true;
    }
    return false;
  }

  // ---------- main step ----------

  update(dt: number, now: number, input: MoveInput, adsFrac: number, adsMoveScale: number, firing: boolean): void {
    this.frame++;
    this.lastNow = now;
    this.lastDt = dt;
    this.prevY = this.pos.y;

    const jumpPressed = input.pressedNow("jump");
    const crouchPressed = input.pressedNow("crouch");

    if (this.zip) {
      this.zipPrompt = false;
      this.stepZip(now, dt, input, jumpPressed, crouchPressed);
      this.updateHeights(dt);
      this.speed = this.hSpeed();
      this.descentRate = 0;
      this.updateView(dt);
      return;
    }

    if (this.mantle) {
      // sprinting during a mantle still opens the full superglide window
      if (input.pressedNow("sprint")) this.mantle.sprint = true;
      this.checkSuperglide(now, jumpPressed, crouchPressed);
      if (this.mantle) {
        this.stepMantle(now);
        this.updateHeights(dt);
        this.speed = 0;
        this.updateView(dt);
        return;
      }
    }

    if (this.joltLeft > 0) {
      this.zipPrompt = false;
      this.stepJolt(dt, now);
      this.updateHeights(dt);
      this.speed = this.hSpeed();
      this.descentRate = 0;
      this.updateView(dt);
      return;
    }

    // ----- inputs: the wish direction combines every held direction -----
    let fwd = 0;
    let side = 0;
    if (input.held("forward")) fwd += 1;
    if (input.held("back")) fwd -= 1;
    if (input.held("right")) side += 1;
    if (input.held("left")) side -= 1;
    const wantCrouch = input.held("crouch");

    const { fx, fz } = this.look();
    const rx = -fz;
    const rz = fx;
    let wx = fx * fwd + rx * side;
    let wz = fz * fwd + rz * side;
    const wl = Math.hypot(wx, wz);
    if (wl > 0) {
      wx /= wl;
      wz /= wl;
    }

    // ----- zipline interact -----
    // One interact comes back after 3 s off a zip, however you spent them.
    if (this.zipAirUses > 0 && now - this.zipRegenAt >= MOVE.ziplineInteractRegen) {
      this.zipAirUses--;
      this.zipRegenAt = now;
    }
    const zipTarget = this.findZip(adsFrac);
    this.zipPrompt = zipTarget !== null;
    if (zipTarget && input.pressedNow("interact")) {
      this.mountZip(now, zipTarget);
      this.updateHeights(dt);
      this.speed = this.hSpeed();
      this.updateView(dt);
      return;
    }

    // ----- crouch state: 0.4 s to go down when standing, instant to stand
    //       back up, instant both ways while sliding -----
    if (wantCrouch && !this.crouchHeld) this.crouchPressedAt = now;
    this.crouchHeld = wantCrouch;
    // You cannot stand up under something lower than your standing height:
    // let go of crouch in a crawl space and you stay crouched until you are out.
    if (!wantCrouch) this.crouched = (this.crouched || this.sliding) && this.headroomBlocked();
    else if (this.sliding) this.crouched = true;
    else if (now - this.crouchPressedAt >= MOVE.crouchDelay) this.crouched = true;

    // ----- sprint -----
    this.updateSprint(now, input, fwd, adsFrac, firing);

    // ----- slide start on the ground -----
    const h = this.hSpeed();
    if (!this.sliding && wantCrouch && this.onGround && h >= MOVE.slideRequiredStartSpeed) {
      const vLen = Math.max(1e-6, h);
      const dot = wl > 0 ? (this.vel.x / vLen) * wx + (this.vel.z / vLen) * wz : 1;
      if (dot >= MOVE.slideMaxAngleDot) this.startSlide(now, h);
    }
    if (this.sliding && (!wantCrouch || !this.onGround)) this.endSlide();

    // ----- jumps -----
    const coyote = !this.onGround && now - this.lastGroundAt <= MOVE.jumpGracePeriod;
    if (jumpPressed) {
      if (this.climbing) this.climbJump(now, wx, wz, wl, crouchPressed);
      else if (this.onGround || coyote) this.doJump(now, !this.onGround);
      // a jump pressed in the air at a wall you are not on: say why not
      else if (!this.mantle) this.explainNoAttach(wx, wz, wl);
    }

    // ----- climb -----
    if (!this.climbing) this.tryAttach(now, wx, wz, wl);
    if (this.climbing) this.stepClimb(now, dt, fwd, wx, wz, wl, crouchPressed);

    // ----- horizontal movement -----
    if (this.climbing) {
      // velocity is owned by stepClimb while on a wall
    } else if (this.onGround && !this.sliding) {
      this.groundMove(now, dt, wx, wz, wl, adsFrac, adsMoveScale);
    } else if (this.sliding) {
      this.slideMove(dt, wx, wz, wl);
    } else {
      this.tryLurch(now, input, wx, wz, wl);
      this.airMove(dt, wx, wz, wl);
    }

    // ----- gravity and integration with collision -----
    // Height uses the AVERAGE of this frame's start and end vertical speed
    // (trapezoidal), which is exact under constant gravity. Plain Euler put a
    // 56 hu jump's apex at 57 hu at 144 fps, and the error grows as the
    // framerate drops.
    const vyStart = this.vel.y;
    if (!this.climbing) this.vel.y -= MOVE.gravity * dt;
    if (this.dropping && !this.onGround) {
      // the skydive: terminal speed, and the stick steers the fall directly
      this.vel.y = Math.max(this.vel.y, -DROP_SPEED);
      this.vel.x = wx * DROP_STEER;
      this.vel.z = wz * DROP_STEER;
    }
    this.integrate(dt, now, vyStart);

    // Non-upward climbing has a 1 s timer: after it, anything slower than
    // 10 hu/s upward drops you off. Read after collision: a ceiling zeroes the
    // climb speed in integrate(), and checked before it, stepClimb's own
    // acceleration had already put it back over the line (25 hu/s a frame at
    // 60 fps), so a climb under an overhang never let go below 240 fps.
    if (this.climbing && now - this.attachedAt >= MOVE.climbNonUpwardTime && this.vel.y < MOVE.climbUpwardThreshold) {
      this.detach(MOVE.climbDetachPenalty);
    }

    // ----- auto mantle when pressed into a ledge in the air -----
    if (!this.onGround && !this.climbing && this.vel.y < 1.0) this.tryMantle(now, wx, wz, wl);

    this.updateHeights(dt);
    this.speed = this.hSpeed();
    this.descentRate = dt > 1e-6 ? (this.prevY - this.pos.y) / dt : 0;
    this.updateView(dt);
  }

  // ---------- sprint ----------

  /**
   * Press sprint arms it for up to 3 s until you move forward; a running
   * sprint keeps it armed. Letting go of forward, firing or aiming ends it and
   * needs a new press. Forward only, up to 45 degrees either side, which is
   * what W plus A or D gives.
   */
  private updateSprint(now: number, input: MoveInput, fwd: number, adsFrac: number, firing: boolean): void {
    const blocked = this.crouched || this.sliding || adsFrac >= 0.05 || firing;
    if (this.sprintMode === "hold") {
      this.sprinting = input.held("sprint") && fwd > 0 && !blocked;
      return;
    }
    if (input.pressedNow("sprint")) this.sprintArmedUntil = now + MOVE.sprintBuffer;
    const wasSprinting = this.sprinting;
    // a sprint interrupted by releasing forward, firing or aiming is over
    if (wasSprinting && (fwd <= 0 || firing || adsFrac >= 0.05)) this.sprintArmedUntil = -Infinity;
    this.sprinting = now <= this.sprintArmedUntil && fwd > 0 && !blocked;
    if (this.sprinting) this.sprintArmedUntil = now + MOVE.sprintBuffer;
  }

  // ---------- slide ----------

  private startSlide(now: number, h: number): void {
    this.sliding = true;
    this.crouched = true;
    this.slideStartedAt = now;
    // The boost cooldown runs from the last slide ENTRY, boosted or not.
    this.slideBoosted = now - this.lastSlideEnterAt >= MOVE.slideBoostCooldown;
    this.lastSlideEnterAt = now;
    if (this.slideBoosted) {
      const hb = this.holsterBoost;
      const boosted = Math.min(h + MOVE.slideSpeedBoost * hb, MOVE.slideSpeedBoostCap * hb);
      if (h > 1e-6 && boosted > h) {
        const k = boosted / h;
        this.vel.x *= k;
        this.vel.z *= k;
      }
    }
  }

  private endSlide(): void {
    this.sliding = false;
  }

  // ---------- jump ----------

  private doJump(now: number, coyote: boolean): void {
    let height = this.sliding ? MOVE.slideJumpHeight : MOVE.jumpHeight;

    // Jump fatigue: only while the fatigue state is on, and never for a coyote
    // jump. 30% height for 0.15 s after landing, linear to full by 0.75 s.
    const sinceLand = now - this.landedAt;
    const fatigued = this.fatigueOn && !coyote && sinceLand < MOVE.antiMultiJumpTimeMax;
    if (fatigued) {
      const t = Math.max(0, (sinceLand - MOVE.antiMultiJumpTimeMin) / (MOVE.antiMultiJumpTimeMax - MOVE.antiMultiJumpTimeMin));
      const frac = MOVE.antiMultiJumpHeightFrac + (1 - MOVE.antiMultiJumpHeightFrac) * Math.min(1, t);
      height *= frac;
      this.tech("JUMP FATIGUE", `${Math.round(frac * 100)}% height`, false);
    }

    const hb = this.holsterBoost;
    if (this.sliding) {
      // A slide jump only carries the slide speed if the slide got its boost
      // AND you jump below 350 hu/s or at least 0.24 s in. Otherwise it is a
      // deadslide: you jump, but the slide speed does not come with you.
      const h = this.hSpeed();
      const inTime = now - this.slideStartedAt >= MOVE.slideJumpGraceTime;
      const slowEnough = h <= MOVE.slideMaxJumpSpeed;
      if (!this.slideBoosted || (!inTime && !slowEnough)) {
        const cap = Math.min(h, MOVE.sprintSpeed * hb);
        const k = cap / Math.max(1e-6, h);
        this.vel.x *= k;
        this.vel.z *= k;
        if (cap < h - 1e-3) {
          this.tech("DEADSLIDE", this.slideBoosted ? "jumped too early: wait 0.24 s" : "no slide boost (2 s cooldown)", false);
        }
      } else {
        this.tech("SLIDE JUMP", `${Math.round(h / HU)} hu/s`);
      }
      this.endSlide();
    }

    // Bunny- and slide-hop penalty (apexmovement.tech, measured in R5 with a
    // script): leaving the ground within 0.1 s of landing while ABOVE sprint
    // speed costs up to 100 hu/s, never taking you below sprint speed. The
    // height cut does not stack on jump fatigue: the wiki measures a flat 30%
    // for the whole first 0.15 s, which a stacked 0.75 would have split in two.
    const hNow = this.hSpeed();
    if (now - this.landedAt < MOVE.skipTime && hNow > MOVE.sprintSpeed * hb) {
      const target = Math.max(MOVE.sprintSpeed * hb, hNow - MOVE.skipSpeedReduce * hb);
      const k = target / hNow;
      this.vel.x *= k;
      this.vel.z *= k;
      if (!fatigued) height *= MOVE.skipJumpHeightFraction;
      this.tech("HOP PENALTY", `-${Math.round((hNow - target) / HU)} hu/s`, false);
    }

    // A coyote-time jump STACKS on upward momentum you already have (Apex
    // Movement Wiki, Superjump). The only way to be rising in coyote time is a
    // zip jump off a zipline grabbed from the ground, and that is the
    // superjump: interact, jump, jump, the second jump adding a full jump on
    // top of the zip jump's pop. A scroll wheel on jump makes the two presses
    // land on consecutive frames.
    const stacking = coyote && this.vel.y > 0;
    if (stacking && now - this.zipExitAt < MOVE.jumpGracePeriod) this.tech("SUPERJUMP", `+${Math.round(height / HU)} hu on the zip jump`);
    this.launch(now, height, stacking);
  }

  /** set the jump velocity and open the lurch window */
  private launch(now: number, height: number, stack = false): void {
    // No per-frame compensation: the trapezoidal integration makes the apex
    // exactly `height` at any framerate.
    this.vel.y = (stack ? this.vel.y : 0) + jumpVelocityFor(height);
    this.onGround = false;
    this.lastJumpAt = now;
    this.fatigueOn = true;
    // Coyote time is consumed by jumping.
    this.lastGroundAt = -Infinity;
  }

  // ---------- lurch ----------

  /**
   * Lurch: pressing a direction inside 400 ms of a jump redirects velocity.
   * Only a PRESS counts (not a release, not a key held since before the
   * jump), the new direction is the combination of every direction held at
   * that moment, and the strength is full for 200 ms then falls linearly to
   * zero. The redirect blends the velocity toward (speed x new direction),
   * which is why a wide lurch costs speed and the small angles of a tap-strafe
   * cost almost none. Above about 1200 hu/s it stops working.
   */
  private tryLurch(now: number, input: MoveInput, wx: number, wz: number, wl: number): void {
    if (this.lurchFrame === this.frame) return;
    const pressed =
      input.pressedNow("forward") || input.pressedNow("back") || input.pressedNow("left") || input.pressedNow("right");
    if (!pressed) return;
    const since = now - this.lastJumpAt;
    if (since < 0 || since > MOVE.lurchGraceMax) return;
    this.lurchFrame = this.frame;
    const h = this.hSpeed();
    if (h < 1e-3 || h > MOVE.lurchSpeedCap) return;
    if (wl === 0) return; // opposing keys: a null lurch
    const fade =
      since <= MOVE.lurchGraceMin ? 1 : 1 - (since - MOVE.lurchGraceMin) / (MOVE.lurchGraceMax - MOVE.lurchGraceMin);
    const f = Math.min(MOVE.lurchMaxFraction, MOVE.lurchStrength * fade);
    const ox = this.vel.x;
    const oz = this.vel.z;
    this.vel.x += f * (h * wx - this.vel.x);
    this.vel.z += f * (h * wz - this.vel.z);
    const turned = Math.abs(Math.atan2(ox * this.vel.z - oz * this.vel.x, ox * this.vel.x + oz * this.vel.z)) / DEG;
    if (turned >= 1) this.tech("LURCH", `${Math.round(turned)} deg, ${Math.round((this.hSpeed() / h) * 100)}% speed`);
  }

  // ---------- climb ----------

  /**
   * Attach to a wall. You must already be off the ground, face the wall within
   * 45.57 degrees, be pushing into it (input or momentum), and be inside the
   * climb space. After a detach you cannot reattach to the same wall until you
   * drop below your previous attach point.
   */
  private tryAttach(now: number, wx: number, wz: number, wl: number): void {
    if (this.onGround || this.climbing || this.mantle || this.sliding) return;
    const n = this.wallNear(MOVE.climbAttachReach);
    if (!n) return;
    const { fx, fz } = this.look();
    if (-(fx * n.nx + fz * n.nz) < MOVE.climbAngleDot) return;
    const inputInto = wl > 0 ? -(wx * n.nx + wz * n.nz) : 0;
    const velInto = -(this.vel.x * n.nx + this.vel.z * n.nz);
    if (inputInto <= 0.05 && velInto <= 0.05) return;
    if (this.pos.y >= this.climbBaseline + MOVE.climbSpaceHeight) return;
    const same = this.lastAttachNormal && this.lastAttachNormal.nx === n.nx && this.lastAttachNormal.nz === n.nz;
    if (same && this.pos.y >= this.lastAttachY - 1e-4) return;
    this.climbing = true;
    this.climbNormal = n;
    this.attachY = this.pos.y;
    this.attachedAt = now;
    this.lastAttachY = this.pos.y;
    this.lastAttachNormal = n;
    // starting a climb ends coyote time
    this.lastGroundAt = -Infinity;
  }

  /**
   * Why a wall in reach did not take. The same tests as tryAttach, in the
   * same order, each with its reason; only fires when jump is pressed in the
   * air beside a wall, so the feed says what to change rather than nothing.
   */
  private explainNoAttach(wx: number, wz: number, wl: number): void {
    const n = this.wallNear(MOVE.climbAttachReach * 2);
    if (!n) return;
    const { fx, fz } = this.look();
    const facing = -(fx * n.nx + fz * n.nz);
    if (facing < MOVE.climbAngleDot) {
      const off = Math.round(Math.acos(Math.max(-1, Math.min(1, facing))) / DEG);
      this.tech("NO WALL", `look at it (${off} deg off, 45 max)`, false);
      return;
    }
    if (this.pos.y >= this.climbBaseline + MOVE.climbSpaceHeight) {
      this.tech("NO WALL", "climb space used up: land first", false);
      return;
    }
    const same = this.lastAttachNormal && this.lastAttachNormal.nx === n.nx && this.lastAttachNormal.nz === n.nz;
    if (same && this.pos.y >= this.lastAttachY - 1e-4) {
      this.tech("NO WALL", "same wall: drop below where you let go", false);
      return;
    }
    const inputInto = wl > 0 ? -(wx * n.nx + wz * n.nz) : 0;
    const velInto = -(this.vel.x * n.nx + this.vel.z * n.nz);
    if (inputInto <= 0.05 && velInto <= 0.05) this.tech("NO WALL", "push into it (W, or speed toward it)", false);
  }

  private stepClimb(now: number, dt: number, fwd: number, wx: number, wz: number, wl: number, crouchPressed: boolean): void {
    const n = this.climbNormal!;
    const { fx, fz } = this.look();

    // normal detaches: crouch, backwards, or looking more than 45.57 degrees away
    if (crouchPressed || fwd < 0 || -(fx * n.nx + fz * n.nz) < MOVE.climbAngleDot) {
      this.detach(MOVE.climbDetachPenalty);
      return;
    }
    // climbed off the side of the wall
    if (!this.wallNear(MOVE.climbAttachReach * 2)) {
      this.detach(0);
      return;
    }
    // A ledge within reach ends the climb in a mantle, with no detach at all.
    if (this.tryMantle(now, wx, wz, wl)) {
      this.climbing = false;
      this.climbNormal = null;
      return;
    }
    // Climb space cutoff or attach offset, whichever comes first, ends the
    // climb with the end boost: 28 hu further up than where you let go.
    const limit = Math.min(this.climbBaseline + MOVE.climbSpaceHeight, this.attachY + MOVE.climbAttachOffset);
    if (this.pos.y >= limit) {
      this.vel.y = jumpVelocityFor(MOVE.climbEndBoostHeight);
      this.detach(MOVE.climbDetachPenalty);
      return;
    }

    // the wall's tangent, and how the input splits into "into" and "along"
    const tx = -n.nz;
    const tz = n.nx;
    const into = wl > 0 ? -(wx * n.nx + wz * n.nz) : 0;
    const along = wl > 0 ? wx * tx + wz * tz : 0;
    let vt = this.vel.x * tx + this.vel.z * tz;
    const approach = (v: number, target: number, rate: number) =>
      v < target ? Math.min(target, v + rate * dt) : Math.max(target, v - rate * dt);

    if (into > 0.05) {
      // upward climb at up to 225 hu/s, carrying any faster upward momentum
      if (this.vel.y < MOVE.climbSpeed) this.vel.y = Math.min(MOVE.climbSpeed, this.vel.y + MOVE.climbAccel * dt);
      else this.vel.y = Math.max(MOVE.climbSpeed, this.vel.y - MOVE.gravity * dt);
      vt = approach(vt, along * MOVE.climbUpHorizontalMax, MOVE.climbAccel);
      vt = Math.max(-MOVE.climbUpHorizontalMax, Math.min(MOVE.climbUpHorizontalMax, vt));
    } else if (Math.abs(along) > 0.05) {
      // sideways climb: 258 hu/s along the wall, holding height
      this.vel.y = approach(this.vel.y, 0, MOVE.climbAccel);
      vt = approach(vt, Math.sign(along) * MOVE.climbSideSpeed, MOVE.climbAccel);
    } else {
      // no input: slipping down the wall under gravity
      this.vel.y -= MOVE.gravity * dt;
      vt = approach(vt, 0, MOVE.climbAccel);
    }
    // stay pressed against the face
    const stick = 0.3;
    this.vel.x = tx * vt - n.nx * stick;
    this.vel.z = tz * vt - n.nz * stick;
    // the 1 s non-upward timer is checked in update(), after collision
  }

  /** leave the wall without jumping; drops the climb space and ends fatigue */
  private detach(penalty: number): void {
    this.climbing = false;
    this.climbNormal = null;
    this.climbBaseline -= penalty;
    this.fatigueOn = false;
  }

  /**
   * Jump off a climb. What you get depends on the climb zone you jump from:
   *
   *   mini    (bottom 19 hu)  28.21 hu up, 188 hu/s out, 128 hu penalty: a mini-bounce
   *   green   (19 to 47 hu)   more height the lower you are, 258 hu/s out: a wallbounce
   *   neutral (above 47 hu)   no added height, 258 hu/s out: a wall push
   *
   * Green and neutral drop the climb space 256 hu. Vertical speed you already
   * had carries through: a jump never slows you if you were rising faster.
   * The direction you look does not matter, only the wall and your momentum
   * along it.
   */
  private climbJump(now: number, wx: number, wz: number, wl: number, crouchPressed: boolean): void {
    const n = this.climbNormal!;
    const h = this.pos.y - this.climbBaseline;
    const hHu = h / HU;
    const zone = h <= MOVE.climbMiniZone ? "mini" : h <= MOVE.climbGreenZoneTop ? "green" : "neutral";
    // a mini-bounce with crouch on the same frame throws you harder: the crouch kick
    const kick = zone === "mini" && crouchPressed;
    let out = zone === "mini" ? (kick ? MOVE.crouchKickOut : MOVE.climbJumpOutMini) : MOVE.climbJumpOut;
    // Wallskip (the wiki): keep holding into the wall and you get the height
    // but no distance from it. The push out fades with how hard you hold in.
    const into = wl > 0 ? Math.max(0, -(wx * n.nx + wz * n.nz)) : 0;
    out *= 1 - into;
    const tx = -n.nz;
    const tz = n.nx;
    const vt = this.vel.x * tx + this.vel.z * tz;
    const vy = this.vel.y;
    this.vel.x = tx * vt + n.nx * out;
    this.vel.z = tz * vt + n.nz * out;
    this.climbing = false;
    this.climbNormal = null;
    this.climbBaseline -= zone === "mini" ? MOVE.climbDetachPenalty : MOVE.climbJumpPenalty;
    // it is a jump: fatigue on, lurch window open, coyote time spent
    this.launch(now, 0);
    // The vertical part. Green zone: from the wiki's measured dismounts, 409
    // hu/s at the bottom of the zone down to 236 at its top (484 and 350
    // total with the 258 out). Mini: the 28.21 hu climb jump. Neutral: none,
    // only what you were already doing.
    let up = 0;
    if (zone === "mini") up = jumpVelocityFor(MOVE.climbJumpHeight);
    else if (zone === "green") {
      const t = Math.max(0, Math.min(1, (h - MOVE.climbMiniZone) / (MOVE.climbGreenZoneTop - MOVE.climbMiniZone)));
      up = MOVE.wallbounceVyBottom + (MOVE.wallbounceVyTop - MOVE.wallbounceVyBottom) * t;
    }
    this.vel.y = up > 0 ? Math.max(vy, up) : vy;
    if (zone === "green") this.tech("WALLBOUNCE", `${Math.round(this.vel.length() / HU)} hu/s, from ${Math.round(hHu)} hu up${into > 0.5 ? " (wallskip: W held, no distance)" : ""}`);
    else if (zone === "mini") this.tech(kick ? "CROUCH KICK" : "MINI-BOUNCE", `${Math.round(this.vel.length() / HU)} hu/s, small penalty`);
    else this.tech("WALL PUSH", `too high: ${Math.round(hHu)} hu up, the green zone is 19 to 47. Slide jump (apex 44) or drop below your apex first`, false);
  }

  // ---------- mantle ----------

  /**
   * Look for a ledge ahead: its top above the step height but within
   * mantleHeight, room to stand, and the movement input pointing at it within
   * 50 degrees either side.
   */
  private tryMantle(now: number, wx: number, wz: number, wl: number): boolean {
    if (this.mantle || this.sliding || wl === 0) return false;
    const { fx, fz } = this.look();
    if (wx * fx + wz * fz < MOVE.mantleInputDot) return false;
    const r = MOVE.radius;
    const feet = this.pos.y;
    const px = this.pos.x + fx * (r + 0.35);
    const pz = this.pos.z + fz * (r + 0.35);
    let ledge = -Infinity;
    for (const s of this.overlapping(px, pz, r * 0.6)) {
      if (s.top > feet + MOVE.stepHeight && s.top <= feet + MOVE.mantleHeight && s.top > ledge) ledge = s.top;
    }
    if (ledge === -Infinity) return false;
    for (const s of this.overlapping(px, pz, r * 0.6)) {
      if (s.top > ledge + 1e-4 && s.base < ledge + MOVE.crouchHeight) return false;
    }
    const rise = ledge - feet;
    const duration =
      rise > MOVE.mantleHeight * 0.75
        ? MOVE.mantleDurationHigh
        : rise > MOVE.mantleHeight * 0.5
          ? MOVE.mantleDurationAbove
          : rise > MOVE.mantleHeight * 0.25
            ? MOVE.mantleDurationLevel
            : MOVE.mantleDurationBelow;
    // the landing spot must be supported and clear, since a mantle runs with
    // collision off
    const toX = this.pos.x + fx * (r + 0.55);
    const toZ = this.pos.z + fz * (r + 0.55);
    let supported = false;
    for (const s of this.overlapping(toX, toZ, r * 0.9)) {
      if (Math.abs(s.top - ledge) < 0.02) supported = true;
      if (s.top > ledge + 1e-4 && s.base < ledge + MOVE.standHeight) return false;
    }
    if (!supported) return false;
    this.mantle = {
      fromX: this.pos.x,
      fromY: feet,
      fromZ: this.pos.z,
      toX,
      toY: ledge,
      toZ,
      started: now,
      duration,
      sprint: this.sprinting || this.hSpeed() > MOVE.speed * 1.02,
      dirX: fx,
      dirZ: fz,
    };
    this.vel.set(0, 0, 0);
    this.endSlide();
    return true;
  }

  private stepMantle(now: number): void {
    const mt = this.mantle!;
    const t = Math.min(1, (now - mt.started) / mt.duration);
    // Absolute interpolation from the START pose, so the result does not
    // depend on framerate.
    const up = Math.min(1, t / 0.65);
    const fwd = Math.max(0, Math.min(1, (t - 0.35) / 0.65));
    this.pos.y = mt.fromY + (mt.toY - mt.fromY) * up;
    this.pos.x = mt.fromX + (mt.toX - mt.fromX) * fwd;
    this.pos.z = mt.fromZ + (mt.toZ - mt.fromZ) * fwd;
    if (t >= 1) this.finishMantle(now);
  }

  private finishMantle(now: number): void {
    const mt = this.mantle!;
    this.pos.set(mt.toX, mt.toY, mt.toZ);
    this.mantle = null;
    // a jump pressed in this mantle's window must not count for the next one
    this.sgJumpFrame = -10;
    this.onGround = true;
    this.lastGroundAt = now;
    this.landedAt = now;
    this.climbBaseline = this.pos.y;
    // mantling turns jump fatigue off, and gives back every zipline interact
    this.fatigueOn = false;
    this.zipAirUses = 0;
  }

  /**
   * Superglide: jump, then crouch exactly one frame later, in the last 0.15 s
   * of a mantle (0.01 s out of a walk). You get a slide boost and a jump at
   * once, in the air, where no ground friction takes it back.
   */
  private checkSuperglide(now: number, jumpPressed: boolean, crouchPressed: boolean): void {
    const mt = this.mantle!;
    const remaining = mt.started + mt.duration - now;
    const window = mt.sprint ? MOVE.superglideWindow : MOVE.superglideWalkWindow;
    if (crouchPressed && this.sgJumpFrame === this.frame - 1 && remaining <= window + this.lastDt) {
      const hb = this.holsterBoost;
      const base = (mt.sprint ? MOVE.sprintSpeed : MOVE.speed) * hb;
      const speed = Math.min(base + MOVE.slideSpeedBoost * hb, MOVE.slideSpeedBoostCap * hb);
      this.sgJumpFrame = -10;
      this.finishMantle(now);
      this.vel.set(mt.dirX * speed, 0, mt.dirZ * speed);
      this.launch(now, MOVE.superglideHeight);
      this.superglidedAt = now;
      this.tech("SUPERGLIDE", `${Math.round(speed / HU)} hu/s`);
      return;
    }
    // the misses, each with what to change
    if (crouchPressed && jumpPressed) {
      this.tech("SUPERGLIDE MISS", "jump and crouch on the same frame: crouch one frame later", false);
      this.sgJumpFrame = -10;
      return;
    }
    if (crouchPressed && this.sgJumpFrame >= 0) {
      const late = this.frame - this.sgJumpFrame;
      this.tech("SUPERGLIDE MISS", `crouch ${late} frames after jump (needs exactly 1)`, false);
      this.sgJumpFrame = -10;
      return;
    }
    if (crouchPressed && remaining <= MOVE.superglideWindow + this.lastDt) {
      this.tech("SUPERGLIDE MISS", "crouch came before jump: jump first, crouch a frame later", false);
      return;
    }
    if (jumpPressed) {
      if (remaining <= window) this.sgJumpFrame = this.frame;
      else if (!mt.sprint && remaining <= MOVE.superglideWindow) this.tech("SUPERGLIDE MISS", "not sprinting into the mantle: the window is 0.01 s", false);
      else this.tech("SUPERGLIDE MISS", `jump early: ${remaining.toFixed(2)} s of mantle left (window ${window.toFixed(2)})`, false);
    }
  }

  // ---------- zipline ----------

  /**
   * The zipline you would grab if you pressed interact now, or null. It has to
   * be within reach of your hands and in view: within 35 degrees of where you
   * face on the ground, 90 in the air, or anywhere in the air if you look
   * straight up or down (though not down while jump fatigue is on). Not on
   * the ground while aiming, not within 0.4 s of leaving one, and not a
   * fourth time in the air.
   */
  private findZip(adsFrac: number): ZipTarget | null {
    if (ZIPLINES.length === 0 || this.mantle) return null;
    if (this.lastNow - this.zipExitAt < MOVE.useZiplineCooldown) return null;
    if (this.onGround && adsFrac > 0.5) return null;
    if (!this.onGround && this.zipAirUses >= MOVE.ziplineMaxAirInteracts) return null;
    const hx = this.pos.x;
    const hy = this.pos.y + MOVE.ziplineHang;
    const hz = this.pos.z;
    const { fx, fz } = this.look();
    const lookLimit = Math.cos((this.onGround ? MOVE.ziplineGroundLookDeg : MOVE.ziplineAirLookDeg) * DEG);
    const steepLook =
      !this.onGround &&
      (this.pitch >= MOVE.ziplineAirPitchDeg || (this.pitch <= -MOVE.ziplineAirPitchDeg && !this.fatigueOn));
    let best: ZipTarget | null = null;
    let bestD = Infinity;
    for (const line of ZIPLINES) {
      const abx = line.b.x - line.a.x;
      const aby = line.b.y - line.a.y;
      const abz = line.b.z - line.a.z;
      const len2 = abx * abx + aby * aby + abz * abz;
      const t = Math.max(0, Math.min(1, ((hx - line.a.x) * abx + (hy - line.a.y) * aby + (hz - line.a.z) * abz) / len2));
      const px = line.a.x + abx * t;
      const py = line.a.y + aby * t;
      const pz = line.a.z + abz * t;
      const d = Math.hypot(px - hx, py - hy, pz - hz);
      if (d > MOVE.ziplineReach || d >= bestD) continue;
      // Right under or beside it, where no direction is "toward" it, any
      // facing will do.
      const tx = px - this.pos.x;
      const tz = pz - this.pos.z;
      const hd = Math.hypot(tx, tz);
      if (hd > 0.45 && (fx * tx + fz * tz) / hd < lookLimit && !steepLook) continue;
      best = { line, s: t * Math.sqrt(len2) };
      bestD = d;
    }
    return best;
  }

  /** feet position hanging from the rope at s metres from a */
  private hangAt(z: ZipRide, s: number, out: THREE.Vector3): THREE.Vector3 {
    const a = z.line.a;
    return out.set(a.x + z.dx * s, a.y + z.dy * s - MOVE.ziplineHang, a.z + z.dz * s);
  }

  /**
   * Grab the zipline. You ride it the way you are looking, except near a pole,
   * where it takes you away from the pole. Momentum already going along it is
   * kept up to its top speed. You are pulled onto the rope over a moment.
   */
  private mountZip(now: number, target: ZipTarget): void {
    const { line, s } = target;
    const abx = line.b.x - line.a.x;
    const aby = line.b.y - line.a.y;
    const abz = line.b.z - line.a.z;
    const len = Math.hypot(abx, aby, abz);
    const dx = abx / len;
    const dy = aby / len;
    const dz = abz / len;
    const slopeDeg = Math.asin(Math.min(1, Math.abs(dy))) / DEG;
    const steep = slopeDeg > MOVE.ziplineSteepDeg;
    // The rare vertical zips top out at 480; anything near vertical counts.
    const max = slopeDeg > 75 ? MOVE.ziplineVerticalSpeed : MOVE.ziplineSpeed;

    const cp = Math.cos(this.pitch * DEG);
    const { fx, fz } = this.look();
    const lookAlong = fx * cp * dx + Math.sin(this.pitch * DEG) * dy + fz * cp * dz;
    let sign: 1 | -1 = lookAlong >= 0 ? 1 : -1;
    if (s < MOVE.ziplinePoleZone) sign = 1;
    else if (s > len - MOVE.ziplinePoleZone) sign = -1;

    const along = (this.vel.x * dx + this.vel.y * dy + this.vel.z * dz) * sign;
    const ride: ZipRide = {
      line,
      len,
      dx,
      dy,
      dz,
      s,
      sign,
      speed: Math.max(0, Math.min(max, along)),
      max,
      steep,
      mountedAt: now,
      offX: 0,
      offY: 0,
      offZ: 0,
      pullTime: 0,
      climbReset: false,
    };
    const hang = this.hangAt(ride, s, new THREE.Vector3());
    ride.offX = this.pos.x - hang.x;
    ride.offY = this.pos.y - hang.y;
    ride.offZ = this.pos.z - hang.z;
    ride.pullTime = MOVE.ziplinePullTime * Math.min(1, Math.hypot(ride.offX, ride.offY, ride.offZ) / MOVE.ziplineReach);

    if (!this.onGround) this.zipAirUses++;
    this.zip = ride;
    this.onGround = false;
    this.climbing = false;
    this.climbNormal = null;
    this.endSlide();
    this.crouched = false;
    this.sprinting = false;
    this.zipPrompt = false;
    this.vel.set(dx * sign * ride.speed, dy * sign * ride.speed, dz * sign * ride.speed);
  }

  private stepZip(now: number, dt: number, input: MoveInput, jumpPressed: boolean, crouchPressed: boolean): void {
    const z = this.zip!;
    const since = now - z.mountedAt;
    // Riding half a second resets the climb space, so you can climb or
    // wallbounce straight out of a zip.
    if (!z.climbReset && since >= MOVE.mountZiplineTime) {
      z.climbReset = true;
      this.climbBaseline = this.pos.y;
      this.lastAttachY = Infinity;
      this.lastAttachNormal = null;
    }

    let fwd = 0;
    let side = 0;
    if (input.held("forward")) fwd += 1;
    if (input.held("back")) fwd -= 1;
    if (input.held("right")) side += 1;
    if (input.held("left")) side -= 1;
    const { fx, fz } = this.look();
    let wx = fx * fwd - fz * side;
    let wz = fz * fwd + fx * side;
    const wl = Math.hypot(wx, wz);
    if (wl > 0) {
      wx /= wl;
      wz /= wl;
    } else {
      wx = fx;
      wz = fz;
    }

    if (jumpPressed) {
      this.zipJump(z, wx, wz);
      return;
    }
    if (crouchPressed) {
      this.zipCrouch(z, fx, fz);
      return;
    }

    const accel = since < MOVE.mountZiplineTime ? MOVE.ziplineJumpOnAcceleration : MOVE.ziplineAcceleration;
    z.speed = Math.min(z.max, z.speed + accel * dt);
    z.s += z.sign * z.speed * dt;
    const atEnd = z.s <= 0 || z.s >= z.len;
    z.s = Math.max(0, Math.min(z.len, z.s));

    const prevX = this.pos.x;
    const prevY = this.pos.y;
    const prevZ = this.pos.z;
    this.hangAt(z, z.s, this.pos);
    const pull = z.pullTime > 0 ? Math.max(0, 1 - since / z.pullTime) : 0;
    if (pull > 0) {
      const k = pull * pull;
      this.pos.x += z.offX * k;
      this.pos.y += z.offY * k;
      this.pos.z += z.offZ * k;
    }
    this.vel.set(z.dx * z.sign * z.speed, z.dy * z.sign * z.speed, z.dz * z.sign * z.speed);

    // Hitting geometry throws you off. How much speed a graze keeps is not
    // published; half is ours.
    if (pull === 0) {
      for (const s of this.overlapping(this.pos.x, this.pos.z, MOVE.radius)) {
        if (!this.blocks(s, this.pos.y, MOVE.standHeight)) continue;
        this.pos.set(prevX, prevY, prevZ);
        this.vel.multiplyScalar(0.5);
        this.leaveZip(now);
        return;
      }
    }

    if (atEnd) this.zipEnd(now, z, fx, fz);
  }

  /** leave the zip, whichever way; starts the re-use cooldown and the regen clock */
  private leaveZip(now: number): void {
    this.zip = null;
    this.zipExitAt = now;
    this.zipRegenAt = now;
    this.onGround = false;
  }

  private capHorizontal(max: number): void {
    const h = this.hSpeed();
    if (h > max) {
      this.vel.x *= max / h;
      this.vel.z *= max / h;
    }
  }

  /**
   * Zip jump: off with slight forward and upward momentum. Steeper than 45
   * degrees you go whichever way you steer (or look); shallower, along the
   * zip. It is not a jump: no jump fatigue, and no lurch window.
   */
  private zipJump(z: ZipRide, wx: number, wz: number): void {
    const damp = MOVE.ziplineJumpOffDampScale;
    const vy = this.vel.y * damp;
    const pop = jumpVelocityFor(MOVE.ziplineJumpPop);
    if (z.steep) {
      this.vel.x = wx * MOVE.ziplineJumpOffSpeed;
      this.vel.z = wz * MOVE.ziplineJumpOffSpeed;
      this.vel.y = Math.max(vy, pop);
    } else {
      this.vel.x *= damp;
      this.vel.z *= damp;
      this.vel.y = Math.max(vy, 0) + pop;
    }
    this.capHorizontal(MOVE.ziplineExitManualMax);
    this.vel.y = Math.min(this.vel.y, MOVE.ziplineExitManualMax);
    this.leaveZip(this.lastNow);
    this.tech("ZIP JUMP", `${Math.round(this.hSpeed() / HU)} hu/s`);
  }

  /** Zip crouch: drop off with the zip's forward momentum and no pop. */
  private zipCrouch(z: ZipRide, fx: number, fz: number): void {
    if (z.steep) {
      this.vel.x = fx * MOVE.ziplineSteepExitPush;
      this.vel.z = fz * MOVE.ziplineSteepExitPush;
    }
    this.capHorizontal(MOVE.ziplineExitManualMax);
    this.vel.y = Math.max(-MOVE.ziplineExitManualMax, Math.min(this.vel.y, MOVE.ziplineExitManualMax));
    this.leaveZip(this.lastNow);
    this.tech("ZIP CROUCH", `${Math.round(this.hSpeed() / HU)} hu/s`);
  }

  /**
   * The end of the rope throws you off at up to 600 hu/s. At the top of a
   * steep zip it puts you forward onto the floor you rode up to.
   */
  private zipEnd(now: number, z: ZipRide, fx: number, fz: number): void {
    if (z.steep && z.dy * z.sign > 0) {
      this.vel.set(fx * MOVE.ziplineSteepExitPush, jumpVelocityFor(MOVE.ziplineJumpPop), fz * MOVE.ziplineSteepExitPush);
    } else {
      const v = this.vel.length();
      if (v > MOVE.ziplineExitEndMax) this.vel.multiplyScalar(MOVE.ziplineExitEndMax / v);
    }
    this.leaveZip(now);
  }

  // ---------- ground, slide, air ----------

  /**
   * Ground movement. Three acceleration bands by speed going forward, a hard
   * deceleration for everything else. The bands depend on speed, not stance,
   * so crouch-walking accelerates exactly like walking and only tops out
   * lower. A counter-strafe uses the deceleration rate, which is why it stops
   * in 0.21 s rather than grinding through the slow sprint band.
   */
  private groundMove(now: number, dt: number, wx: number, wz: number, wl: number, adsFrac: number, adsMoveScale: number): void {
    const hb = this.holsterBoost;
    let target = (this.crouched ? MOVE.crouchSpeed : this.sprinting ? MOVE.sprintSpeed : MOVE.speed) * hb;
    target *= 1 + (adsMoveScale - 1) * adsFrac;
    // Fall stun slows acceleration while it lasts. How much is not published.
    const stun = now < this.stunUntil ? 1 - this.stunStrength * (1 - MOVE.fallstunAccelScale) : 1;

    const h = this.hSpeed();
    if (wl === 0) {
      const drop = MOVE.deceleration * dt;
      const k = h > drop ? (h - drop) / h : 0;
      this.vel.x *= k;
      this.vel.z *= k;
      return;
    }

    const along = this.vel.x * wx + this.vel.z * wz;
    const perpX = this.vel.x - wx * along;
    const perpZ = this.vel.z - wz * along;
    const perp = Math.hypot(perpX, perpZ);
    // Changing direction brakes AND drives at once, as in every Source-family
    // engine: friction on the old motion plus acceleration toward the new.
    // Braking alone made a strafe reversal a visible stall before the new
    // direction took over.
    const turnRate = MOVE.deceleration + MOVE.lowAcceleration;
    const perpDrop = turnRate * dt;
    const perpK = perp > perpDrop ? (perp - perpDrop) / perp : 0;

    let nextAlong: number;
    if (along < target) {
      // The bands, by SPEED: lowAcceleration below lowSpeed (the engine names
      // pair them), then acceleration up to walk speed, then the slow sprint
      // tail. They were assigned the other way round before, which put the
      // slowest band at the start of every movement.
      //
      // Integrated THROUGH the band edges inside the frame. Choosing one band
      // per frame let a frame that started just under 120 hu/s run the fast
      // band well past it: up to 42 hu/s of overshoot at 60 fps, so movement
      // felt quicker at low framerates than high ones.
      let v = along;
      let rem = dt;
      if (v < 0) {
        const tn = -v / turnRate;
        if (tn >= rem) {
          v += turnRate * rem;
          rem = 0;
        } else {
          v = 0;
          rem -= tn;
        }
      }
      // Holding a weapon halves the acceleration (the wiki: 0.35 s to 200
      // hu/s armed, 0.12 s holstered), so the bands are the holstered rates.
      const armed = hb <= 1 ? MOVE.armedAccelScale : 1;
      while (rem > 1e-9 && v < target) {
        const low = MOVE.lowSpeed * hb;
        const band = MOVE.sprintBandStart * hb;
        const accel = v < low ? MOVE.lowAcceleration : v < band ? MOVE.acceleration : MOVE.sprintAcceleration;
        const top = v < low ? low : v < band ? band : Infinity;
        const rate = accel * stun * armed;
        const edge = Math.min(target, top);
        const tn = (edge - v) / rate;
        if (tn >= rem) {
          v += rate * rem;
          rem = 0;
        } else {
          v = edge;
          rem -= tn;
        }
      }
      nextAlong = Math.min(target, v);
    } else {
      nextAlong = Math.max(target, along - MOVE.deceleration * dt);
    }

    this.vel.x = wx * nextAlong + perpX * perpK;
    this.vel.z = wz * nextAlong + perpZ * perpK;
  }

  /**
   * Slide: gentle friction, a little steering, pushing against it stops it
   * fast, and gravity along the slope in BOTH directions: downhill reduces the
   * decay and can reverse it, uphill adds to it.
   */
  private slideMove(dt: number, wx: number, wz: number, wl: number): void {
    const h = this.hSpeed();
    if (h < 1e-6) {
      this.endSlide();
      return;
    }
    // Fitted to the wiki's two measured slide timings (movement.json).
    let decel = slideFriction(h);
    if (wl > 0) {
      const dot = (this.vel.x / h) * wx + (this.vel.z / h) * wz;
      if (dot < -0.3) decel = MOVE.slideWantToStopDecel;
    }
    const next = Math.max(0, h - decel * dt);
    const k = next / h;
    this.vel.x *= k;
    this.vel.z *= k;
    if (wl > 0) {
      this.vel.x += wx * MOVE.slideAccel * dt;
      this.vel.z += wz * MOVE.slideAccel * dt;
    }
    // g*sin(theta), where sin(theta) is the rate of height change over the
    // speed. descentRate is positive going down and negative going up.
    if (Math.abs(this.descentRate) > 1e-4) {
      const speedNow = Math.max(this.hSpeed(), 1e-3);
      const gain = MOVE.gravity * (this.descentRate / speedNow) * MOVE.slideSlopeAccelScale * dt;
      const after = Math.max(0, Math.min(this.hSpeed() + gain, MOVE.slideSlopeMaxSpeed));
      const kk = after / speedNow;
      this.vel.x *= kk;
      this.vel.z *= kk;
    }
    if (this.hSpeed() < MOVE.slideStopSpeed) this.endSlide();
  }

  /** Quake air acceleration: only add what is missing up to airSpeed */
  private airMove(dt: number, wx: number, wz: number, wl: number): void {
    if (wl === 0) return;
    const current = this.vel.x * wx + this.vel.z * wz;
    const add = MOVE.airSpeed - current;
    if (add <= 0) return;
    const accel = Math.min(add, MOVE.airAcceleration * dt);
    this.vel.x += wx * accel;
    this.vel.z += wz * accel;
  }

  // ---------- integration ----------

  /** move, resolving per axis so sliding along a wall works, then land */
  private integrate(dt: number, now: number, vyStart: number): void {
    const r = MOVE.radius;
    const feet = this.pos.y;
    const bodyH = this.crouched || this.sliding ? MOVE.crouchHeight : MOVE.standHeight;

    // X. Push out to the face we came from, chosen by the PREVIOUS position.
    const fromX = this.pos.x;
    const nx = fromX + this.vel.x * dt;
    let hitX = false;
    for (const s of this.overlapping(nx, this.pos.z, r)) {
      if (!this.blocks(s, feet, bodyH)) continue;
      hitX = true;
      const mid = (s.minX + s.maxX) / 2;
      this.pos.x = fromX <= mid ? s.minX - r : s.maxX + r;
      this.vel.x = 0;
      break;
    }
    if (!hitX) this.pos.x = nx;

    // Z
    const fromZ = this.pos.z;
    const nz = fromZ + this.vel.z * dt;
    let hitZ = false;
    for (const s of this.overlapping(this.pos.x, nz, r)) {
      if (!this.blocks(s, feet, bodyH)) continue;
      hitZ = true;
      const mid = (s.minZ + s.maxZ) / 2;
      this.pos.z = fromZ <= mid ? s.minZ - r : s.maxZ + r;
      this.vel.z = 0;
      break;
    }
    if (!hitZ) this.pos.z = nz;

    // In the air the step allowance in blocks() let the body INTO a solid: a
    // top within stepHeight of the feet is not a wall, but the air landing
    // below only takes tops at or below the feet, so it was not a floor
    // either. A jump at a 1.1 m wall went into it and out the far side. So in
    // the air the body goes up onto such a top when there is room over it
    // (the stepped ramps and the FLOW room's slide-jump walls rely on that),
    // and back out the way it came when there is not.
    let feetY = feet;
    let vy0 = vyStart;
    if (!this.onGround) {
      const here = this.overlapping(this.pos.x, this.pos.z, r);
      let lift = feet;
      for (const s of here) {
        if (s.top > feet + 1e-4 && s.base < feet + bodyH - 1e-4 && !this.blocks(s, feet, bodyH)) lift = Math.max(lift, s.top);
      }
      if (lift > feet) {
        const room = !here.some((s) => s.top > lift + 1e-4 && s.base < lift + bodyH - 1e-4);
        if (room) {
          // the lift is paid for out of the rise still to come, so a jump's
          // apex is never raised by it: rising at v from `feet` peaks at
          // feet + v^2/2g, and from the top it keeps only what is left of that
          if (vyStart > 0) {
            const apex = feet + (vyStart * vyStart) / (2 * MOVE.gravity);
            this.vel.y = apex > lift ? Math.sqrt(2 * MOVE.gravity * (apex - lift)) : 0;
          }
          // the rest of this frame moves from the top at that speed
          vy0 = this.vel.y;
          this.pos.y = lift;
          feetY = lift;
        } else {
          this.pos.x = fromX;
          this.pos.z = fromZ;
          this.vel.x = 0;
          this.vel.z = 0;
        }
      }
    }

    // Y
    const wasAir = !this.onGround;
    const wasOnGround = this.onGround;
    this.pos.y += 0.5 * (vy0 + this.vel.y) * dt;
    // Ceilings: anything whose underside is above the feet stops the head.
    // Without this, a jump under an overhang put the body inside it, and the
    // horizontal push-out then threw the player clean out of the side.
    for (const s of this.overlapping(this.pos.x, this.pos.z, r)) {
      if (s.base > feetY + MOVE.stepHeight && s.base < this.pos.y + bodyH) {
        this.pos.y = Math.max(feetY, s.base - bodyH);
        if (this.vel.y > 0) this.vel.y = 0;
      }
    }
    const ceiling = this.onGround ? feetY + MOVE.stepHeight : feetY;
    const ground = this.groundUnder(this.pos.x, this.pos.z, r, Math.max(ceiling, this.pos.y));
    if (this.pos.y <= ground + 1e-4) {
      this.pos.y = ground;
      const impact = Math.max(0, -this.vel.y);
      if (this.vel.y < 0) this.vel.y = 0;
      if (wasAir) this.land(now, impact);
      this.onGround = true;
      this.lastGroundAt = now;
    } else if (wasOnGround && this.vel.y <= 0 && this.pos.y - ground <= MOVE.stepHeight) {
      // Step down, so a staircase or ramp does not make you briefly airborne.
      this.pos.y = ground;
      this.vel.y = 0;
      this.onGround = true;
      this.lastGroundAt = now;
    } else {
      // Leaving the ground without a jump (walking off a ledge) turns jump
      // fatigue off.
      if (wasOnGround) this.fatigueOn = false;
      this.onGround = false;
    }

    // The climb space sits at your feet while you are on the ground, and
    // follows you down if you drop below it.
    if (this.onGround) {
      this.climbBaseline = this.pos.y;
      this.lastAttachY = Infinity;
      this.lastAttachNormal = null;
      // touching the ground gives back every zipline interact
      this.zipAirUses = 0;
    } else if (this.pos.y < this.climbBaseline) {
      this.climbBaseline = this.pos.y;
    }

    // arena bounds
    const b = this.bounds;
    this.pos.x = Math.max(b.minX + r, Math.min(b.maxX - r, this.pos.x));
    this.pos.z = Math.max(b.minZ + r, Math.min(b.maxZ - r, this.pos.z));
  }

  /** landing: fatigue timer, fall stun, slide on landing, camera dip */
  private land(now: number, impact: number): void {
    this.landedAt = now;
    if (this.climbing) {
      this.climbing = false;
      this.climbNormal = null;
    }
    this.landingSpeed = impact;
    if (this.dropping) {
      // the end of a drop: on your feet, no stun, no slide, a small dip
      this.dropping = false;
      this.vel.x = 0;
      this.vel.z = 0;
      this.viewDip -= MOVE.landDipMetres;
      return;
    }

    // Fall stun: none below the speed of a 300 hu fall, a full 1 s and all
    // horizontal speed lost at the speed of an 800 hu fall, quadratic between.
    if (impact > MOVE.fallstunMinSpeed) {
      const x = Math.min(1, (impact - MOVE.fallstunMinSpeed) / (MOVE.fallstunMaxSpeed - MOVE.fallstunMinSpeed));
      const s = x * x;
      this.stunStrength = s;
      this.stunUntil = now + s * MOVE.fallstunMaxDuration;
      this.vel.x *= 1 - s;
      this.vel.z *= 1 - s;
    }

    // A slide on landing needs 90 hu/s horizontal AND 200 hu/s downward.
    if (this.crouchHeld && this.hSpeed() >= MOVE.slideRequiredStartSpeedAir && impact >= MOVE.slideRequiredFallSpeedAir) {
      this.startSlide(now, this.hSpeed());
    }

    this.viewDip -= MOVE.landDipMetres * Math.min(1, impact / MOVE.landDipMaxSpeed);
  }

  // ---------- view ----------

  private updateView(dt: number): void {
    const targetSlideFov = this.sliding ? MOVE.slideFovScale - 1 : 0;
    this.slideFov += (targetSlideFov - this.slideFov) * Math.min(1, dt / MOVE.slideFovLerpTime);
    // Landing dip: a critically damped spring back to zero, stepped at no more
    // than 1/120 s. In one step per frame it went unstable at frame times over
    // about 0.08 s (under 12 fps, or one long hitch): each frame grew the dip
    // by a quarter and within a second the camera was metres off.
    const w = MOVE.landDipRecover;
    const n = Math.max(1, Math.ceil(dt * 120));
    const h = dt / n;
    for (let i = 0; i < n; i++) {
      this.viewDipVel += (-w * w * this.viewDip - 2 * w * this.viewDipVel) * h;
      this.viewDip += this.viewDipVel * h;
    }
  }

  /**
   * The view and the hull move between standing and crouched height at a
   * steady rate that covers the whole distance in crouchVisualTime. An
   * exponential ease used to do this, and it took 300 ms to get 90% of the way
   * down: a slide that had physically started on the first frame looked like
   * it was still thinking about it.
   */
  private updateHeights(dt: number): void {
    // The hull follows the crouch STATE (instant on a slide, crouchDelay after
    // the press when standing, instant on standing up). The view follows the
    // crouch ANIMATION: a slide drops it at once; a standing crouch lowers it
    // over the crouchDelay the state takes to arrive, so both land together.
    const stateDown = this.crouched || this.sliding;
    const animDown = stateDown || (this.crouchHeld && this.onGround && !this.mantle);
    const approach = (v: number, target: number, full: number, time: number) => {
      const step = (full / time) * dt;
      return v < target ? Math.min(target, v + step) : Math.max(target, v - step);
    };
    this.height = approach(this.height, stateDown ? MOVE.crouchHeight : MOVE.standHeight, MOVE.standHeight - MOVE.crouchHeight, MOVE.crouchVisualTime);
    const eyeTime = animDown && !this.sliding && !this.crouched ? MOVE.crouchDelay : MOVE.crouchVisualTime;
    this.eye = approach(this.eye, animDown ? MOVE.eyeCrouch : MOVE.eyeStand, MOVE.eyeStand - MOVE.eyeCrouch, eyeTime);
  }

  // Reused every call rather than allocated: these run several times a frame,
  // and garbage made per frame is a collector pause waiting to land on a
  // frame. Callers copy the result straight away.
  private readonly eyeOut = new THREE.Vector3();
  private readonly eulerTmp = new THREE.Euler(0, 0, 0, "YXZ");
  private readonly quatOut = new THREE.Quaternion();

  /** the eye position; the returned vector is reused, so copy it */
  eyePosition(): THREE.Vector3 {
    return this.eyeOut.set(this.pos.x, this.pos.y + this.eye, this.pos.z);
  }

  /** the view rotation; the returned quaternion is reused, so copy it */
  orientation(offPitchUp: number, offYawLeft: number): THREE.Quaternion {
    return this.orientationAt(this.yaw, this.pitch, offPitchUp, offYawLeft);
  }

  /** a rotation from any angles (the third-person camera, an aim that is not the view); reused, so copy it */
  orientationAt(yaw: number, pitch: number, offPitchUp: number, offYawLeft: number): THREE.Quaternion {
    const p = Math.max(-89, Math.min(89, pitch + offPitchUp));
    this.eulerTmp.set(p * DEG, (yaw + offYawLeft) * DEG, 0, "YXZ");
    return this.quatOut.setFromEuler(this.eulerTmp);
  }
}
